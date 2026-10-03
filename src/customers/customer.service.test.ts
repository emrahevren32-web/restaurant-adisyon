// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C1 — Müşteri servisi testleri
//
// Sınanan şey ekran değil KURAL. Kurallar servise konuldu tam da bu yüzden:
// sipariş ekranı, Excel aktarımı ve portal aynı kurallardan geçecek ve hepsi
// için tek bir sınama yeter.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import type { TenantCtx } from '../core/context'
import {
  MusteriDogrulamaError,
  MusteriServisi,
  fiyatKapsami,
  fiyatiYaz,
  musterileriSuz,
  pencereyiYaz,
  sonrakiMusteriKodu,
  sonrakiNoktaKodu,
} from './customer.service'
import type {
  Fiyat,
  FiyatGirdisi,
  Musteri,
  MusteriDeposu,
  MusteriGirdisi,
  SiparisPenceresi,
  TeslimNoktasi,
  TeslimNoktasiGirdisi,
  PortalKullanicisi, PortalKullanicisiGirdisi,
} from './customer.repository'

const CTX: TenantCtx = { tenantId: 'k1', branchId: 's1', userId: 'u1' }

const musteri = (ek: Partial<Musteri> = {}): Musteri => ({
  id: 'm1', kod: 'MIG', ad: 'Migros', aktif: true, ...ek,
})

/**
 * Bellek deposu. Doğrulamanın DEPOYA NE GİTTİĞİNİ de sınayabilmek için son
 * girdiyi saklıyor: "hata vermedi" demek "doğru veriyi yazdı" demek değil.
 */
class BellekDeposu implements MusteriDeposu {
  sonMusteri?: MusteriGirdisi
  sonNokta?: TeslimNoktasiGirdisi
  sonFiyat?: FiyatGirdisi

  async hepsi(): Promise<Musteri[]> { return [] }
  async ekle(_c: TenantCtx, g: MusteriGirdisi): Promise<Musteri> {
    this.sonMusteri = g
    return musteri({ kod: g.kod, ad: g.ad })
  }
  async guncelle(_c: TenantCtx, _id: string, g: MusteriGirdisi): Promise<Musteri> {
    this.sonMusteri = g
    return musteri({ kod: g.kod, ad: g.ad })
  }
  async aktiflikDegistir(_c: TenantCtx, _id: string, aktif: boolean): Promise<Musteri> {
    return musteri({ aktif })
  }
  async noktalar(): Promise<TeslimNoktasi[]> { return [] }
  async noktaEkle(_c: TenantCtx, g: TeslimNoktasiGirdisi): Promise<TeslimNoktasi> {
    this.sonNokta = g
    return { id: 'n1', aktif: true, ...g }
  }
  async noktaGuncelle(_c: TenantCtx, id: string, g: TeslimNoktasiGirdisi): Promise<TeslimNoktasi> {
    this.sonNokta = g
    return { id, aktif: true, ...g }
  }
  async noktaAktiflikDegistir(_c: TenantCtx, id: string, aktif: boolean): Promise<TeslimNoktasi> {
    return { id, musteriId: 'm1', kod: 'ATA', ad: 'Ataşehir', aktif }
  }
  async fiyatlar(): Promise<Fiyat[]> { return [] }
  async fiyatEkle(_c: TenantCtx, g: FiyatGirdisi): Promise<void> { this.sonFiyat = g }
  async gecerliFiyat(): Promise<number | undefined> { return undefined }
  async pencere(): Promise<SiparisPenceresi> { return { kaynak: 'yok' } }
  sonPortal?: PortalKullanicisiGirdisi
  sonNoktalar?: readonly string[]
  async portalKullanicilari(): Promise<PortalKullanicisi[]> { return [] }
  async portalErisimiVer(_c: TenantCtx, g: PortalKullanicisiGirdisi): Promise<PortalKullanicisi> {
    this.sonPortal = g
    return { id: 'p1', musteriId: g.musteriId, eposta: g.eposta,
             aktif: true, noktaIdler: [...(g.noktaIdler ?? [])] }
  }
  async portalErisimiDegistir(_c: TenantCtx, id: string, aktif: boolean): Promise<PortalKullanicisi> {
    return { id, musteriId: 'm1', eposta: 'a@b.c', aktif, noktaIdler: [] }
  }
  async portalNoktalariAyarla(_c: TenantCtx, id: string, n: readonly string[]): Promise<PortalKullanicisi> {
    this.sonNoktalar = n
    return { id, musteriId: 'm1', eposta: 'a@b.c', aktif: true, noktaIdler: [...n] }
  }
}

const servisKur = () => {
  const depo = new BellekDeposu()
  return { depo, servis: new MusteriServisi(depo) }
}

const BOS: MusteriGirdisi = { kod: '', ad: '' }

describe('Müşteri doğrulaması', () => {
  it('kod ve ad zorunlu', async () => {
    const { servis } = servisKur()
    await expect(servis.ekle(CTX, { ...BOS, ad: 'Migros' }))
      .rejects.toThrow(MusteriDogrulamaError)
    await expect(servis.ekle(CTX, { ...BOS, kod: 'MIG' }))
      .rejects.toThrow(MusteriDogrulamaError)
  })

  it('boşlukları kırpıyor', async () => {
    const { depo, servis } = servisKur()
    await servis.ekle(CTX, { kod: '  mig  ', ad: '  Migros  ' })
    expect(depo.sonMusteri?.kod).toBe('mig')
    expect(depo.sonMusteri?.ad).toBe('Migros')
  })

  it('bozuk e-postayı reddediyor, doğrusunu geçiriyor', async () => {
    const { servis } = servisKur()
    await expect(servis.ekle(CTX, { kod: 'A', ad: 'A', eposta: 'satinalma.migros' }))
      .rejects.toThrow(/E-posta/)
    await expect(servis.ekle(CTX, { kod: 'A', ad: 'A', eposta: 'satinalma@migros.com.tr' }))
      .resolves.toBeTruthy()
  })

  it('kesim saatini biçim olarak sınıyor', async () => {
    const { servis } = servisKur()
    await expect(servis.ekle(CTX, { kod: 'A', ad: 'A', kesimSaati: '6' }))
      .rejects.toThrow(/SS:DD/)
    await expect(servis.ekle(CTX, { kod: 'A', ad: 'A', kesimSaati: '25:00' }))
      .rejects.toThrow(/SS:DD/)
    await expect(servis.ekle(CTX, { kod: 'A', ad: 'A', kesimSaati: '06:00' }))
      .resolves.toBeTruthy()
  })

  it('negatif vade ve gün farkı kabul etmiyor', async () => {
    const { servis } = servisKur()
    await expect(servis.ekle(CTX, { kod: 'A', ad: 'A', vadeGunu: -1 }))
      .rejects.toThrow(/Ödeme vadesi/)
    await expect(servis.ekle(CTX, { kod: 'A', ad: 'A', teslimGunFarki: -2 }))
      .rejects.toThrow(/Teslim gün farkı/)
  })

  it('vade SIFIR kabul ediliyor — peşin bir karardır', async () => {
    // Boş "vade konuşulmamış", sıfır "peşin" demek. İkisini karıştırmak,
    // sözleşmesi olmayan müşteriyi peşin çalışıyor göstermek olurdu.
    const { depo, servis } = servisKur()
    await servis.ekle(CTX, { kod: 'A', ad: 'A', vadeGunu: 0 })
    expect(depo.sonMusteri?.vadeGunu).toBe(0)
  })
})

describe('Teslim noktası doğrulaması', () => {
  const nokta = (ek: Partial<TeslimNoktasiGirdisi> = {}): TeslimNoktasiGirdisi => ({
    musteriId: 'm1', kod: 'ATA', ad: 'Migros Ataşehir', ...ek,
  })

  it('müşteri, kod ve ad zorunlu', async () => {
    const { servis } = servisKur()
    await expect(servis.noktaEkle(CTX, nokta({ musteriId: '' }))).rejects.toThrow(/müşteriye bağlı/)
    await expect(servis.noktaEkle(CTX, nokta({ kod: '' }))).rejects.toThrow(/kodu zorunlu/)
    await expect(servis.noktaEkle(CTX, nokta({ ad: '' }))).rejects.toThrow(/adı zorunlu/)
  })

  it('teslim aralığının bitişi başlangıcından sonra olmalı', async () => {
    const { servis } = servisKur()
    await expect(servis.noktaEkle(CTX, nokta({
      teslimBaslangic: '08:00', teslimBitis: '07:00',
    }))).rejects.toThrow(/sonra olmalı/)
    await expect(servis.noktaEkle(CTX, nokta({
      teslimBaslangic: '07:00', teslimBitis: '11:00',
    }))).resolves.toBeTruthy()
  })

  it('penceresi boş bırakılabiliyor', async () => {
    // Emrah: "hem evet hem hayır" — bazı noktanın penceresi var, bazısının
    // yok. Boş bırakmak bir HATA DEĞİL, geçerli bir seçim.
    const { depo, servis } = servisKur()
    await servis.noktaEkle(CTX, nokta())
    expect(depo.sonNokta?.kesimSaati).toBeUndefined()
    expect(depo.sonNokta?.teslimGunFarki).toBeUndefined()
  })
})

describe('Fiyat doğrulaması', () => {
  const fiyat = (ek: Partial<FiyatGirdisi> = {}): FiyatGirdisi => ({
    musteriId: 'm1', kalemId: 'kl1', birimFiyat: 100, paraBirimi: 'TRY',
    birim: 'kg', gecerlilikBaslangici: '2026-09-27', ...ek,
  })

  it('ürün, birim ve tarih zorunlu', async () => {
    const { servis } = servisKur()
    await expect(servis.fiyatEkle(CTX, fiyat({ kalemId: '' }))).rejects.toThrow(/ürün seçilmeli/)
    await expect(servis.fiyatEkle(CTX, fiyat({ birim: '' }))).rejects.toThrow(/birimi zorunlu/)
    await expect(servis.fiyatEkle(CTX, fiyat({ gecerlilikBaslangici: '27.09.2026' })))
      .rejects.toThrow(/YYYY-AA-GG/)
  })

  it('SIFIR fiyat yalnızca kaldırma satırında geçerli', async () => {
    // Sıfır "bedava" demektir. Fiyatı kaldırmak isteyen biri sıfır yazarsa,
    // ürün bedava satılmış görünür. Kaldırmanın kendi kutusu var.
    const { servis } = servisKur()
    await expect(servis.fiyatEkle(CTX, fiyat({ birimFiyat: 0 })))
      .rejects.toThrow(/bedava/)
    await expect(servis.fiyatEkle(CTX, fiyat({ birimFiyat: 0, kaldirildi: true })))
      .resolves.toBeUndefined()
  })

  it('negatif fiyat reddediliyor', async () => {
    const { servis } = servisKur()
    await expect(servis.fiyatEkle(CTX, fiyat({ birimFiyat: -5 })))
      .rejects.toThrow(/sıfır veya daha büyük/)
  })

  it('noktaya özel fiyat depoya nokta kimliğiyle gidiyor', async () => {
    const { depo, servis } = servisKur()
    await servis.fiyatEkle(CTX, fiyat({ noktaId: 'n1', birimFiyat: 115 }))
    expect(depo.sonFiyat?.noktaId).toBe('n1')
    expect(depo.sonFiyat?.birimFiyat).toBe(115)
  })
})

describe('Süzme', () => {
  const liste = [
    musteri({ id: '1', kod: 'MIG', ad: 'Migros', aktif: true }),
    musteri({ id: '2', kod: 'A101', ad: 'A101', aktif: false }),
    musteri({ id: '3', kod: 'SOK', ad: 'Şok', yetkili: 'İlker', aktif: true }),
  ]

  it('pasifleri varsayılan olarak saklıyor', () => {
    expect(musterileriSuz(liste, '', false).map(m => m.id)).toEqual(['1', '3'])
    expect(musterileriSuz(liste, '', true)).toHaveLength(3)
  })

  it('kod, ad ve yetkiliye bakıyor', () => {
    expect(musterileriSuz(liste, 'mig', false).map(m => m.id)).toEqual(['1'])
    expect(musterileriSuz(liste, 'ilker', false).map(m => m.id)).toEqual(['3'])
  })

  it('Türkçe i harflerini katlıyor', () => {
    // 'İlker' / 'ilker' / 'İLKER' aynı sonucu vermeli. Bu hata G1'de bir kez
    // yaşandı: yerel ayarla küçültme 'ISTANBUL' → 'ıstanbul' yapıyordu.
    expect(musterileriSuz(liste, 'İLKER', false).map(m => m.id)).toEqual(['3'])
    expect(musterileriSuz(liste, 'ılker', false).map(m => m.id)).toEqual(['3'])
  })
})

describe('Pencere cümlesi', () => {
  it('pencere yoksa bunu açıkça söylüyor', () => {
    expect(pencereyiYaz({ kaynak: 'yok' })).toMatch(/pencere.*yok/i)
  })

  it('kaynağı GÖSTERİYOR', () => {
    // Kullanıcı pencerenin müşteri varsayılanından geldiğini görmezse,
    // noktada değişiklik yaptığını sanıp aynı ekrana bakmaya devam eder.
    expect(pencereyiYaz({ kesimSaati: '06:00:00', gunFarki: 0, kaynak: 'nokta' }))
      .toBe('Kesim 06:00 · aynı gün teslim (noktanın kendi penceresi)')
    expect(pencereyiYaz({ kesimSaati: '10:00:00', gunFarki: 1, kaynak: 'musteri' }))
      .toBe('Kesim 10:00 · ertesi gün teslim (müşteri varsayılanı)')
  })

  it('iki günden uzun farkı sayıyla yazıyor', () => {
    expect(pencereyiYaz({ kesimSaati: '12:00', gunFarki: 3, kaynak: 'nokta' }))
      .toMatch(/3 gün sonra/)
  })
})

describe('Fiyat cümlesi', () => {
  const f = (ek: Partial<Fiyat> = {}): Fiyat => ({
    id: 'f1', musteriId: 'm1', kalemId: 'kl1', birimFiyat: 130, paraBirimi: 'TRY',
    birim: 'kg', gecerlilikBaslangici: '2026-09-27', kaldirildi: false,
    olusturmaZamani: '2026-09-27T10:00:00Z', ...ek,
  })

  it('fiyatı birimiyle yazıyor', () => {
    expect(fiyatiYaz(f())).toBe('130,00 TRY / kg')
  })

  it('kaldırma satırını fiyat gibi göstermiyor', () => {
    // Sıfır yazıp geçmek, ürünü bedava satılmış göstermek olurdu.
    expect(fiyatiYaz(f({ kaldirildi: true, birimFiyat: 0 }))).toBe('kaldırıldı')
  })

  it('kapsamı söylüyor', () => {
    expect(fiyatKapsami(f())).toBe('bütün noktalar')
    expect(fiyatKapsami(f({ noktaId: 'n1', noktaAdi: 'Ataşehir' }))).toBe('Ataşehir')
  })
})

// ── Vergi alanları (0052) ──────────────────────────────────────────────────
// Bu alanlar FATURA için var ama fatura henüz kesilmiyor. Sınanan şey,
// yanlış verinin bugünden girmemesi: bir yıl sonra düzeltmek pahalı.
describe('Vergi alanları', () => {
  const TEMEL: MusteriGirdisi = { kod: 'MIG', ad: 'Migros' }

  it('VKN (10) ve TCKN (11) kabul ediliyor', async () => {
    const { servis, depo } = servisKur()
    await servis.ekle(CTX, { ...TEMEL, vergiNo: '1234567890' })
    expect(depo.sonMusteri?.vergiNo).toBe('1234567890')
    await servis.ekle(CTX, { ...TEMEL, vergiNo: '12345678901' })
    expect(depo.sonMusteri?.vergiNo).toBe('12345678901')
  })

  it('yanlış uzunluktaki vergi numarası reddediliyor', async () => {
    const { servis } = servisKur()
    await expect(servis.ekle(CTX, { ...TEMEL, vergiNo: '12345' }))
      .rejects.toThrow(/10 hane/)
    await expect(servis.ekle(CTX, { ...TEMEL, vergiNo: '123456789012' }))
      .rejects.toThrow(MusteriDogrulamaError)
  })

  it('harf içeren vergi numarası reddediliyor', async () => {
    const { servis } = servisKur()
    await expect(servis.ekle(CTX, { ...TEMEL, vergiNo: '12345A7890' }))
      .rejects.toThrow(MusteriDogrulamaError)
  })

  it('boş vergi numarası serbest — kart vergi bilgisi olmadan da açılabilir', async () => {
    const { servis, depo } = servisKur()
    await servis.ekle(CTX, { ...TEMEL, vergiNo: '   ' })
    expect(depo.sonMusteri?.vergiNo).toBeUndefined()
  })

  it('bozuk KEP adresi reddediliyor', async () => {
    const { servis } = servisKur()
    await expect(servis.ekle(CTX, { ...TEMEL, kepAdresi: 'migros.kep.tr' }))
      .rejects.toThrow(/KEP adresi/)
  })

  it('e-Fatura bayrağı KONTROL TARİHİ olmadan kabul edilmiyor', async () => {
    // Tarihsiz bayrak, ne zaman doğru olduğu bilinmeyen bir bilgidir:
    // mükellefiyet sonradan başlar, bir yıl önceki "hayır" bugün yanlıştır.
    const { servis } = servisKur()
    await expect(servis.ekle(CTX, { ...TEMEL, efaturaMukellefi: true }))
      .rejects.toThrow(/kontrol tarihi/)
    await expect(servis.ekle(CTX, { ...TEMEL, efaturaMukellefi: false }))
      .rejects.toThrow(/kontrol tarihi/)
  })

  it('bayrak ve tarih birlikte verilince geçiyor', async () => {
    const { servis, depo } = servisKur()
    await servis.ekle(CTX, {
      ...TEMEL, efaturaMukellefi: true, efaturaKontrolTarihi: '2026-09-29',
    })
    expect(depo.sonMusteri?.efaturaMukellefi).toBe(true)
    expect(depo.sonMusteri?.efaturaKontrolTarihi).toBe('2026-09-29')
  })

  it('resmî ünvan ayrı bir alan — günlük ad faturaya yazılmaz', async () => {
    const { servis, depo } = servisKur()
    await servis.ekle(CTX, {
      ...TEMEL, ad: 'Migros', resmiUnvan: 'Migros Ticaret A.Ş.',
    })
    expect(depo.sonMusteri?.ad).toBe('Migros')
    expect(depo.sonMusteri?.resmiUnvan).toBe('Migros Ticaret A.Ş.')
  })
})

// ── Portal erişimi (0054) ──────────────────────────────────────────────────
// Emrah'ın kararı: giriş e-posta ile tek kullanımlık bağlantı. PAROLA YOK —
// bu testlerde de parola diye bir kavram geçmiyor, geçmemeli.
describe('Portal erişimi', () => {
  const G: PortalKullanicisiGirdisi = { musteriId: 'm1', eposta: 'satinalma@migros.test' }

  it('e-posta KÜÇÜK HARFE indiriliyor', async () => {
    // Giriş e-postayla oluyor: "Ali@" ile "ali@" iki ayrı kullanıcı olsaydı
    // biri asla giremezdi.
    const { servis, depo } = servisKur()
    await servis.portalErisimiVer(CTX, { ...G, eposta: '  SatinAlma@Migros.TEST ' })
    expect(depo.sonPortal?.eposta).toBe('satinalma@migros.test')
  })

  it('e-postasız erişim verilemiyor', async () => {
    const { servis } = servisKur()
    await expect(servis.portalErisimiVer(CTX, { ...G, eposta: '  ' }))
      .rejects.toThrow(/E-posta zorunlu/)
  })

  it('bozuk e-posta reddediliyor', async () => {
    const { servis } = servisKur()
    await expect(servis.portalErisimiVer(CTX, { ...G, eposta: 'migros.test' }))
      .rejects.toThrow(MusteriDogrulamaError)
  })

  it('müşteri kartına bağlı olmayan erişim reddediliyor', async () => {
    const { servis } = servisKur()
    await expect(servis.portalErisimiVer(CTX, { ...G, musteriId: '' }))
      .rejects.toThrow(/müşteri kartına bağlı/)
  })

  it('nokta listesi BOŞSA merkez — bütün noktalar', async () => {
    // ⚠️ Boşluğun anlamı "hiçbiri" değil "hepsi". Emrah: "duruma göre şubede
    // sipariş verebilir, merkezde."
    const { servis, depo } = servisKur()
    const k = await servis.portalErisimiVer(CTX, G)
    expect(k.noktaIdler).toEqual([])
    expect(depo.sonPortal?.noktaIdler).toEqual([])
  })

  it('YİNELENEN nokta kimliği teke indiriliyor', async () => {
    const { servis, depo } = servisKur()
    await servis.portalErisimiVer(CTX, { ...G, noktaIdler: ['n1', 'n1', ' n2 ', ''] })
    expect(depo.sonPortal?.noktaIdler).toEqual(['n1', 'n2'])
  })

  it('erişim KAPATILABİLİYOR — silinmiyor', async () => {
    // Kimin ne zaman yetkisi vardı, kalsın.
    const { servis } = servisKur()
    expect((await servis.portalErisimiDegistir(CTX, 'p1', false)).aktif).toBe(false)
  })
})


describe('kod üreticileri', () => {
  it('hiç müşteri yokken ilk kodu verir', () => {
    expect(sonrakiMusteriKodu([])).toBe('MUS-0001')
  })

  it('en büyük sıradan devam eder, sayıyı atlamaz', () => {
    expect(sonrakiMusteriKodu(['MUS-0001', 'MUS-0003', 'MUS-0002'])).toBe('MUS-0004')
  })

  it('ELLE YAZILMIŞ kodları sayıma katmaz', () => {
    // "35060" işletmenin eski programından gelen kendi kodu. Sayıma
    // katsaydık bir sonraki öneri 35061 olurdu ve iki ayrı kod düzeni
    // birbirine girerdi.
    expect(sonrakiMusteriKodu(['35060', '9999999'])).toBe('MUS-0001')
  })

  it('küçük harfle yazılmış öneki de tanır', () => {
    expect(sonrakiMusteriKodu(['mus-0007'])).toBe('MUS-0008')
  })

  it('teslim noktası kodunu müşteri kodunun altında numaralar', () => {
    expect(sonrakiNoktaKodu('35060', [])).toBe('35060-01')
    expect(sonrakiNoktaKodu('35060', ['35060-01'])).toBe('35060-02')
  })

  it('nokta kodunu başka müşterinin kodundan türetmez', () => {
    expect(sonrakiNoktaKodu('MUS-0002', [])).toBe('MUS-0002-01')
  })

  it('iki haneyi aşan nokta sayısında numara kırpılmaz', () => {
    const mevcut = Array.from({ length: 99 }, (_, i) => `35060-${String(i + 1).padStart(2, '0')}`)
    expect(sonrakiNoktaKodu('35060', mevcut)).toBe('35060-100')
  })
})
