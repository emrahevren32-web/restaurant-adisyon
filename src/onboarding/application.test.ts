// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4D / KAPI — Başvuru testleri
//
// En kritik iddialar:
//   1. Aynı e-postadan AÇIK ikinci başvuru olmaz (ama reddedilen tekrar
//      başvurabilir — kapıyı kalıcı kapatmak yanlış).
//   2. Karar verilmiş başvurudan çıkış yok.
//   3. Gerekçesiz karar olmaz.
//   4. Her durum değişimi olay defterine düşer.
//   5. Ekrandaki geçiş tablosu ile VERİTABANINDAKİ tetikleyici aynı.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  BellekBasvuruDefteri, DURUM_ETIKETLERI, SON_DURUMLAR,
  type BasvuruDurumu, type YeniBasvuru,
} from './application.repository'
import {
  GECISLER, basvuruDogrula, basvuruOzeti, beklemeGunu, durumEtiketi,
  gecisGecerliMi, gerekceYeterliMi, sonDurumMu, tcKimlikGecerliMi, vergiBilgisiEksik,
} from './application.service'
import { basvuruGecisleriGocten } from '../core/test-support/goc-tarama'

const gecerliForm = (yama: Partial<YeniBasvuru> = {}): YeniBasvuru => ({
  firmaAdi: 'Deneme Endüstriyel Mutfak A.Ş.',
  yetkiliAdi: 'Deneme Yetkili',
  telefon: '05321234567',
  eposta: 'deneme@ornek.com',
  il: 'İzmir',
  ilce: 'Bornova',
  adres: 'Deneme Mahallesi 1. Sokak No 2',
  // 0038: zorunlu olanlar bunlar.
  subeSayisi: 1,
  personelSayisi: 12,
  // 0038: vergi bilgisi ARTIK ZORUNLU DEĞİL. Fikstürde dolu duruyor ki
  // "dolu yazıldığında biçim kuralı hâlâ işliyor mu" sınanabilsin.
  vergiNo: '1234567890',
  vergiDairesi: 'Bornova',
  ...yama,
})

describe('Giriş hesabı açma (bellek defteri)', () => {
  const onaylanmis = async () => {
    const defter = new BellekBasvuruDefteri()
    await defter.gonder(gecerliForm({ eposta: 'Turgut.Ozer@tavukcu.com' }))
    const [b] = await defter.liste()
    await defter.karar(b.id, { durum: 'IN_REVIEW', gerekce: 'incelemeye alindi' })
    await defter.onayla(b.id, 'belgeler tam')
    return { defter, id: b.id }
  }

  it('onaylanmamış başvuruda hesap açılmaz', async () => {
    const defter = new BellekBasvuruDefteri()
    await defter.gonder(gecerliForm())
    const [b] = await defter.liste()
    await expect(defter.girisHesabiAc(b.id)).rejects.toThrow(/onaylanmış/)
  })

  it('onaylanmış başvuruda hesap açılır ve kullanıcı adı e-postadan türer', async () => {
    const { defter, id } = await onaylanmis()
    const sonuc = await defter.girisHesabiAc(id)
    expect(sonuc.kullaniciAdi).toBe('turgutozer')
    expect(sonuc.eposta).toBe('turgut.ozer@tavukcu.com')
  })

  it('ikinci çağrı reddedilir — davet iki kez gitmez', async () => {
    const { defter, id } = await onaylanmis()
    await defter.girisHesabiAc(id)
    await expect(defter.girisHesabiAc(id)).rejects.toThrow(/zaten açılmış/)
  })

  it('hesap açıldıktan sonra başvuruda davet zamanı görünür', async () => {
    const { defter, id } = await onaylanmis()
    expect((await defter.tekil(id))?.davetZamani).toBeUndefined()
    await defter.girisHesabiAc(id)
    expect((await defter.tekil(id))?.davetZamani).toBeTruthy()
  })
})

describe('TC kimlik numarası', () => {
  /**
   * Geçerli bir numara ÜRETİYORUZ, sabit yazmıyoruz: gerçek bir kimlik
   * numarasını depoya koymak doğru olmaz. İlk 9 haneden son iki hane
   * kuralın kendisiyle hesaplanıyor.
   */
  const uret = (ilkDokuz: string): string => {
    const h = ilkDokuz.split('').map(Number)
    const tek = h[0] + h[2] + h[4] + h[6] + h[8]
    const cift = h[1] + h[3] + h[5] + h[7]
    const d10 = (((tek * 7) - cift) % 10 + 10) % 10
    const d11 = ([...h, d10].reduce((t, x) => t + x, 0)) % 10
    return `${ilkDokuz}${d10}${d11}`
  }

  it('kural gereği üretilen numara geçerli', () => {
    for(const kok of ['123456789', '987654321', '111111111', '246813579']){
      expect(tcKimlikGecerliMi(uret(kok))).toBe(true)
    }
  })

  it('SON HANE HER ZAMAN ÇİFT — kuralın kendisinden çıkıyor', () => {
    // Emrah'ın hatırlattığı kural. Ayrı bir denetim yazmadık çünkü
    // hesabın sonucu zaten bu; test onu kanıtlıyor.
    for(let i = 0; i < 200; i++){
      const kok = String(100000000 + i * 4337)
      const no = uret(kok)
      expect(Number(no[10]) % 2).toBe(0)
    }
  })

  it('son hanesi tek olan numara reddedilir', () => {
    const gecerli = uret('123456789')
    const tekSonlu = `${gecerli.slice(0, 10)}${(Number(gecerli[10]) + 1) % 10}`
    expect(tcKimlikGecerliMi(tekSonlu)).toBe(false)
  })

  it('sıfırla başlayan numara reddedilir', () => {
    expect(tcKimlikGecerliMi(uret('012345678'))).toBe(false)
  })

  it('hane sayısı ya da içeriği yanlışsa reddedilir', () => {
    expect(tcKimlikGecerliMi('1234567890')).toBe(false)   // 10 hane
    expect(tcKimlikGecerliMi('123456789012')).toBe(false) // 12 hane
    expect(tcKimlikGecerliMi('1234567890a')).toBe(false)  // harf
    expect(tcKimlikGecerliMi('')).toBe(false)
  })

  it('formda geçersiz TC uyarı veriyor, geçerli TC geçiyor', () => {
    expect(basvuruDogrula(gecerliForm({ vergiNo: '12345678901' })))
      .toContain('TC kimlik numarası geçerli görünmüyor. Lütfen kontrol edin.')
    expect(basvuruDogrula(gecerliForm({ vergiNo: uret('123456789') }))).toEqual([])
  })

  it('10 haneli vergi numarası TC kuralına sokulmaz', () => {
    // VKN'nin kendi algoritması var ama uygulamıyoruz (bkz. servis notu):
    // yanlış bir kontrol, geçerli numarayla gelen müşteriyi kapıda durdurur.
    expect(basvuruDogrula(gecerliForm({ vergiNo: '1234567890' }))).toEqual([])
  })
})

describe('Vergi bilgisi eksikliği', () => {
  // Eksiklik sessiz kalmamalı: fatura kesileceği gün fark edilmesi iş durdurur.
  it('ikisi de boşsa eksik', () => {
    expect(vergiBilgisiEksik({})).toBe(true)
    expect(vergiBilgisiEksik({ vergiNo: '', vergiDairesi: '' })).toBe(true)
  })

  it('yalnız biri doluysa DA eksik', () => {
    expect(vergiBilgisiEksik({ vergiNo: '1234567890' })).toBe(true)
    expect(vergiBilgisiEksik({ vergiDairesi: 'Bornova' })).toBe(true)
  })

  it('sadece boşluk yazılmışsa eksik sayılır', () => {
    expect(vergiBilgisiEksik({ vergiNo: '  ', vergiDairesi: '  ' })).toBe(true)
  })

  it('ikisi de doluysa eksik değil', () => {
    expect(vergiBilgisiEksik({ vergiNo: '1234567890', vergiDairesi: 'Bornova' })).toBe(false)
  })
})

describe('Form doğrulaması', () => {
  it('geçerli form hata vermiyor', () => {
    expect(basvuruDogrula(gecerliForm())).toEqual([])
  })

  it('boş alanlar TOPLU bildiriliyor — tek tek değil', () => {
    const hatalar = basvuruDogrula(gecerliForm({
      firmaAdi: '', yetkiliAdi: '', telefon: '',
    }))
    // Üç hatayı birlikte görmek, üç kez gönder-düzelt döngüsünden iyidir.
    expect(hatalar.length).toBeGreaterThanOrEqual(3)
    expect(hatalar.some(h => h.includes('Firma adı'))).toBe(true)
    expect(hatalar.some(h => h.includes('Yetkili adı'))).toBe(true)
  })

  it('e-posta biçimi denetleniyor', () => {
    expect(basvuruDogrula(gecerliForm({ eposta: 'abc' })))
      .toContain('E-posta adresi geçerli görünmüyor.')
    expect(basvuruDogrula(gecerliForm({ eposta: 'a b@c.com' })))
      .toContain('E-posta adresi geçerli görünmüyor.')
    expect(basvuruDogrula(gecerliForm({ eposta: 'ali@firma.com.tr' }))).toEqual([])
  })

  it('vergi numarası yalnız rakam', () => {
    expect(basvuruDogrula(gecerliForm({ vergiNo: '12345ABCDE' })))
      .toContain('Vergi/TC numarası yalnız rakamlardan oluşur.')
  })

  it('vergi bilgisi BOŞ bırakılabilir (0038)', () => {
    // Başvuru anı sözleşme anı değil. Bu alanı zorunlu tutmak, henüz fiyat
    // bile konuşmamış birinden vergi levhası istemek olurdu.
    expect(basvuruDogrula(gecerliForm({ vergiNo: '', vergiDairesi: '' }))).toEqual([])
    expect(basvuruDogrula(gecerliForm({ vergiNo: undefined, vergiDairesi: undefined }))).toEqual([])
  })

  it('şube sayısı zorunlu ve 1-500 arası', () => {
    expect(basvuruDogrula(gecerliForm({ subeSayisi: null })))
      .toContain('Şube sayısı zorunludur.')
    expect(basvuruDogrula(gecerliForm({ subeSayisi: 0 })))
      .toContain('Şube sayısı en az 1 olmalı.')
    expect(basvuruDogrula(gecerliForm({ subeSayisi: 501 })))
      .toContain('Şube sayısı en fazla 500 olabilir.')
    expect(basvuruDogrula(gecerliForm({ subeSayisi: 1.5 })))
      .toContain('Şube sayısı tam sayı olmalı.')
    expect(basvuruDogrula(gecerliForm({ subeSayisi: Number('abc') })))
      .toContain('Şube sayısı bir sayı olmalı.')
  })

  it('personel sayısı zorunlu', () => {
    expect(basvuruDogrula(gecerliForm({ personelSayisi: null })))
      .toContain('Yaklaşık personel sayısı zorunludur.')
  })

  it('vergi numarası 10 hane (vergi) ya da 11 hane (TC) olabilir', () => {
    expect(basvuruDogrula(gecerliForm({ vergiNo: '1234567890' }))).toEqual([])
    // ⚠️ 11 hanelik örnek ARTIK RASTGELE OLAMAZ: 11 hane TC demektir ve
    // TC kuralına sokuluyor (Emrah'ın hatırlattığı kural). Bu testin eski
    // hâli '12345678901' bekliyordu; o numara kurala uymuyor.
    expect(basvuruDogrula(gecerliForm({ vergiNo: '12345678950' }))).toEqual([])
    expect(basvuruDogrula(gecerliForm({ vergiNo: '123456789' })).length).toBeGreaterThan(0)
  })

  it('baştaki ve sondaki boşluk alan doldurmaz', () => {
    expect(basvuruDogrula(gecerliForm({ firmaAdi: '   ' })))
      .toContain('Firma adı zorunludur.')
  })
})

describe('Geçiş kuralları', () => {
  it('bekleyen başvuru incelemeye, redde ve iptale gidebiliyor', () => {
    expect(gecisGecerliMi('PENDING', 'IN_REVIEW')).toBe(true)
    expect(gecisGecerliMi('PENDING', 'REJECTED')).toBe(true)
    expect(gecisGecerliMi('PENDING', 'CANCELLED')).toBe(true)
  })

  it('bekleyen başvuru DOĞRUDAN onaylanamıyor — önce incelenir', () => {
    expect(gecisGecerliMi('PENDING', 'APPROVED')).toBe(false)
  })

  it('inceleme bırakılıp beklemeye dönebiliyor', () => {
    // "İnceliyorum" deyip bırakmak meşru; başvuru havada kalmamalı.
    expect(gecisGecerliMi('IN_REVIEW', 'PENDING')).toBe(true)
  })

  it('karar verilmiş başvurudan ÇIKIŞ YOK', () => {
    for(const son of SON_DURUMLAR){
      expect(sonDurumMu(son)).toBe(true)
      for(const hedef of Object.keys(DURUM_ETIKETLERI) as BasvuruDurumu[]){
        expect(gecisGecerliMi(son, hedef), `${son} -> ${hedef}`).toBe(false)
      }
    }
  })

  it('gerekçe üç harften kısa olamaz', () => {
    expect(gerekceYeterliMi('ok')).toBe(false)
    expect(gerekceYeterliMi('   ')).toBe(false)
    expect(gerekceYeterliMi(undefined)).toBe(false)
    expect(gerekceYeterliMi('belge eksik')).toBe(true)
  })
})

describe('Ekran ile veritabanı aynı kuralı söylüyor', () => {
  // ⚠️ Bu testin sebebi: aynı kural iki yerde duruyor. Biri değişip diğeri
  // kalırsa ekran "yapabilirsin" der, veritabanı reddeder — ya da tersi,
  // ekran düğmeyi kapatır ve meşru bir iş yapılamaz hâle gelir.
  it('geçiş tablosu 0032 tetikleyicisiyle birebir', () => {
    const gocten = basvuruGecisleriGocten()
    const koddan: Record<string, string[]> = {}
    for(const [durum, hedefler] of Object.entries(GECISLER)){
      koddan[durum] = [...hedefler]
    }
    for(const durum of Object.keys(koddan)){
      expect(
        [...(gocten[durum] ?? [])].sort(),
        `${durum} geçişleri ayrışmış`,
      ).toEqual([...koddan[durum]].sort())
    }
  })

  it('göçten okunan tablo boş değil — test sessizce geçmesin', () => {
    const gocten = basvuruGecisleriGocten()
    expect(Object.keys(gocten).length).toBeGreaterThanOrEqual(5)
    expect(gocten.PENDING).toContain('IN_REVIEW')
  })
})

describe('Başvuru defteri', () => {
  it('gönderme okunabilir bir NUMARA döndürüyor', async () => {
    // Müşteriye gösterilecek tek şey bu. İç kimlik (uuid) değil.
    const defter = new BellekBasvuruDefteri()
    const referans = await defter.gonder(gecerliForm())
    expect(referans).toMatch(/^MIY-/)
    const [kayit] = await defter.liste()
    expect(kayit.referans).toBe(referans)
  })

  it('her başvuru AYRI numara alıyor', async () => {
    const defter = new BellekBasvuruDefteri()
    const bir = await defter.gonder(gecerliForm({ eposta: 'bir@ornek.com' }))
    const iki = await defter.gonder(gecerliForm({ eposta: 'iki@ornek.com' }))
    expect(bir).not.toBe(iki)
  })

  it('gönderilen başvuru beklemede başlıyor ve olay defterine düşüyor', async () => {
    const defter = new BellekBasvuruDefteri()
    await defter.gonder(gecerliForm())

    const [kayit] = await defter.liste()
    expect(kayit.durum).toBe('PENDING')
    const olaylar = await defter.olaylar(kayit.id)
    expect(olaylar).toHaveLength(1)
    expect(olaylar[0].yeniDurum).toBe('PENDING')
    expect(olaylar[0].oncekiDurum).toBeUndefined()
  })

  it('e-posta küçük harfe çevriliyor — aynı adres iki kayıt açmasın', async () => {
    const defter = new BellekBasvuruDefteri()
    await defter.gonder(gecerliForm({ eposta: '  Ali@Firma.COM  ' }))
    const [kayit] = await defter.liste()
    expect(kayit.eposta).toBe('ali@firma.com')
  })

  it('aynı e-postadan AÇIK ikinci başvuru reddediliyor', async () => {
    const defter = new BellekBasvuruDefteri()
    await defter.gonder(gecerliForm({ eposta: 'ayni@ornek.com' }))
    await expect(defter.gonder(gecerliForm({ eposta: 'AYNI@ornek.com' })))
      .rejects.toThrow(/bekleyen bir başvuru zaten var/)
  })

  it('REDDEDİLEN başvurudan sonra tekrar başvurulabiliyor', async () => {
    // Kapıyı kalıcı kapatmak yanlış olur: eksik belge tamamlanır, tekrar
    // başvurulur.
    const defter = new BellekBasvuruDefteri()
    await defter.gonder(gecerliForm({ eposta: 'tekrar@ornek.com' }))
    const [ilk] = await defter.liste()
    await defter.karar(ilk.id, { durum: 'REJECTED', gerekce: 'belge eksik' })

    // Artık numara döndürüyor: yeni başvuru gerçekten açıldı demektir.
    await expect(defter.gonder(gecerliForm({ eposta: 'tekrar@ornek.com' })))
      .resolves.toMatch(/^MIY-/)
    expect((await defter.liste()).length).toBe(2)
  })

  it('karar olay defterine önceki durumla birlikte düşüyor', async () => {
    const defter = new BellekBasvuruDefteri()
    await defter.gonder(gecerliForm())
    const [kayit] = await defter.liste()

    await defter.karar(kayit.id, { durum: 'IN_REVIEW', gerekce: 'inceleniyor' })
    await defter.karar(kayit.id, {
      durum: 'APPROVED', gerekce: 'belgeler tam', kiraciId: 'kiraci-1',
    })

    const olaylar = await defter.olaylar(kayit.id)
    expect(olaylar.map(o => o.yeniDurum)).toEqual(['PENDING', 'IN_REVIEW', 'APPROVED'])
    expect(olaylar[2].oncekiDurum).toBe('IN_REVIEW')
    expect((await defter.tekil(kayit.id))?.kiraciId).toBe('kiraci-1')
  })

  it('durum süzmesi çalışıyor', async () => {
    const defter = new BellekBasvuruDefteri()
    await defter.gonder(gecerliForm({ eposta: 'bir@ornek.com' }))
    await defter.gonder(gecerliForm({ eposta: 'iki@ornek.com' }))
    const hepsi = await defter.liste()
    await defter.karar(hepsi[0].id, { durum: 'REJECTED', gerekce: 'olmadi' })

    expect(await defter.liste(['PENDING'])).toHaveLength(1)
    expect(await defter.liste(['REJECTED'])).toHaveLength(1)
    expect(await defter.liste(['PENDING', 'REJECTED'])).toHaveLength(2)
  })
})

describe('Liste özeti', () => {
  const kayit = (durum: BasvuruDurumu, gunOnce = 0) => ({
    id: `x-${durum}-${gunOnce}`,
    referans: `MIY-X${gunOnce}`,
    olusturmaZamani: new Date(Date.UTC(2026, 8, 18 - gunOnce)).toISOString(),
    guncellemeZamani: new Date(Date.UTC(2026, 8, 18 - gunOnce)).toISOString(),
    durum,
    sektorKodu: 'endustriyel-mutfak',
    firmaAdi: 'X', yetkiliAdi: 'Y', telefon: '05321234567',
    eposta: 'x@y.com', vergiNo: '1234567890', vergiDairesi: 'Z',
    il: 'İzmir', ilce: 'Bornova', adres: 'Adres',
    subeSayisi: 1, personelSayisi: 10,
  })

  it('ilgi bekleyen sayısı beklemede + inceleniyor', () => {
    const ozet = basvuruOzeti([
      kayit('PENDING'), kayit('PENDING'), kayit('IN_REVIEW'),
      kayit('APPROVED'), kayit('REJECTED'), kayit('CANCELLED'),
    ])
    expect(ozet.toplam).toBe(6)
    expect(ozet.bekleyen).toBe(2)
    expect(ozet.inceleniyor).toBe(1)
    expect(ozet.ilgiBekleyen).toBe(3)
  })

  it('boş liste sıfır veriyor, çökmüyor', () => {
    expect(basvuruOzeti([]).ilgiBekleyen).toBe(0)
  })

  it('bekleme günü hesaplanıyor — unutulan başvuru görünsün', () => {
    const simdi = new Date(Date.UTC(2026, 8, 18))
    expect(beklemeGunu(kayit('PENDING', 5), simdi)).toBe(5)
    expect(beklemeGunu(kayit('PENDING', 0), simdi)).toBe(0)
  })

  it('gelecek tarihli kayıt negatif gün vermiyor', () => {
    const simdi = new Date(Date.UTC(2026, 8, 18))
    expect(beklemeGunu(kayit('PENDING', -3), simdi)).toBe(0)
  })
})

describe('Etiketler', () => {
  it('beş durumun da Türkçe karşılığı var', () => {
    for(const durum of Object.keys(GECISLER) as BasvuruDurumu[]){
      expect(durumEtiketi(durum)).not.toBe(durum)
      expect(durumEtiketi(durum).length).toBeGreaterThan(3)
    }
  })
})
