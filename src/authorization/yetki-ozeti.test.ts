// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Yetki özeti testleri
//
// En önemli iki test: (1) iki rol taşıyan kişinin yetkisi BİRLEŞİM olmalı —
// kesişim alsaydık ikinci rol vermek yetkiyi AZALTIRDI; (2) tanınmayan izin
// GİZLENMEMELİ — görünmeyen bir yetkiyi kimse geri alamaz.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  alanAgaci,
  etkinIzinler,
  izinEtiketi,
  izinleriAlanaGore,
  kritikYetkiler,
  onayCumlesi,
  onayYetkileri,
  rolAgaci,
  rolCumlesi,
  rolKatkisi,
  yetkininKaynagi,
  yetkiTuru,
  type OnayAdimi,
} from './yetki-ozeti'

const ROL_IZINLERI: Record<string, string[]> = {
  depo_sorumlusu: ['dashboard.read', 'stock.read', 'stock.write', 'logistics.read'],
  satinalma_sorumlusu: ['dashboard.read', 'stock.read', 'purchase.read', 'purchase.write'],
  kalite_sorumlusu: ['dashboard.read', 'quality.read', 'quality.write', 'production.read'],
  izleyici: ['dashboard.read', 'stock.read'],
}

const ADIMLAR: OnayAdimi[] = [
  { kod: 'DEPO', ad: 'Depo — hammadde yeterli mi', bloklar: false, izinKodu: 'stock.read' },
  { kod: 'URETIM', ad: 'Üretim — yoğunluk ve tarih', bloklar: false, izinKodu: 'production.read' },
  { kod: 'SATIS', ad: 'Satış sorumlusu — onay', bloklar: true, izinKodu: 'operations.write' },
]

describe('etkinIzinler', () => {
  it('birincil rolün izinlerini veriyor', () => {
    expect(etkinIzinler('depo_sorumlusu', [], ROL_IZINLERI))
      .toEqual(['dashboard.read', 'logistics.read', 'stock.read', 'stock.write'])
  })

  it('EK ROLLERLE BİRLEŞTİRİYOR — kesişim değil', () => {
    // Küçük işletmede bir kişi birden çok şapka takar. Kesişim alsaydık
    // ikinci rol vermek yetkiyi AZALTIRDI.
    const izinler = etkinIzinler('depo_sorumlusu', ['satinalma_sorumlusu'], ROL_IZINLERI)
    expect(izinler).toContain('stock.write')      // depodan geldi
    expect(izinler).toContain('purchase.write')   // satın almadan geldi
  })

  it('aynı izni iki rolden alsa bile BİR KEZ yazıyor', () => {
    const izinler = etkinIzinler('depo_sorumlusu', ['satinalma_sorumlusu'], ROL_IZINLERI)
    expect(izinler.filter(i => i === 'stock.read')).toHaveLength(1)
  })

  it('tanımsız rol sessizce atlanıyor, patlamıyor', () => {
    // Veritabanına yeni bir rol eklenip katalog güncellenmediyse ekran
    // çalışmaya devam etmeli; boş ekran, yanlış ekrandan beterdir.
    expect(etkinIzinler('olmayan_rol', [], ROL_IZINLERI)).toEqual([])
  })

  it('birincil rolü boş olan kullanıcı yalnız ek rollerini taşır', () => {
    expect(etkinIzinler('', ['izleyici'], ROL_IZINLERI))
      .toEqual(['dashboard.read', 'stock.read'])
  })
})

describe('izinleriAlanaGore', () => {
  it('izinleri işin akış sırasına göre gruplar', () => {
    const gruplar = izinleriAlanaGore(['stock.write', 'purchase.read', 'dashboard.read'])
    expect(gruplar.map(g => g.alan)).toEqual(['Genel', 'Satın alma', 'Depo'])
  })

  it('TANINMAYAN izni GİZLEMİYOR, "Diğer" altında ham koduyla gösteriyor', () => {
    // Görmediği bir yetkiyi kimse geri alamaz.
    const gruplar = izinleriAlanaGore(['tuhaf.izin'])
    expect(gruplar).toHaveLength(1)
    expect(gruplar[0]!.alan).toBe('Diğer')
    expect(gruplar[0]!.cumleler).toEqual(['tuhaf.izin'])
  })

  it('mal çıkarma yetkisini açıkça yazıyor', () => {
    // Emrah'ın sorusu buydu: "depodaki adam mal çıkarabilsin, aşçı
    // çıkaramasın." Cevabın ekranda okunur olması gerekiyor.
    expect(izinEtiketi('stock.write').cumle).toContain('DEPODAN MAL ÇIKARIR')
  })
})

describe('onayYetkileri', () => {
  it('izni olan adımda karar verebilir diyor', () => {
    const y = onayYetkileri(['stock.read'], ADIMLAR)
    expect(y.find(a => a.kod === 'DEPO')!.kararVerebilir).toBe(true)
    expect(y.find(a => a.kod === 'SATIS')!.kararVerebilir).toBe(false)
  })

  it('karar VEREMEDİĞİ adımları da listeliyor', () => {
    // Yalnız verebildiklerini gösterseydik, kimin neyi onaylayamadığı
    // görünmezdi — oysa zincirin anlamı tam da budur.
    expect(onayYetkileri([], ADIMLAR)).toHaveLength(3)
  })
})

describe('onayCumlesi', () => {
  it('zincir yoksa bunu söylüyor', () => {
    expect(onayCumlesi([])).toContain('tanımlı değil')
  })

  it('hiç karar veremiyorsa açıkça söylüyor', () => {
    expect(onayCumlesi(onayYetkileri([], ADIMLAR))).toBe('Sipariş onay zincirinde karar veremez.')
  })

  it('onay ile görüşü ayırıyor', () => {
    const cumle = onayCumlesi(onayYetkileri(['stock.read', 'operations.write'], ADIMLAR))
    expect(cumle).toContain('3 adımın 2 tanesinde')
    expect(cumle).toContain('1 onay')
    expect(cumle).toContain('1 görüş')
  })
})

describe('kritikYetkiler', () => {
  it('Emrah’ın saydığı kritik yetkileri öne çıkarıyor', () => {
    const k = kritikYetkiler(['stock.write', 'logistics.write', 'dashboard.read'])
    expect(k).toHaveLength(2)
    expect(k.join(' ')).toContain('MAL ÇIKARIR')
    expect(k.join(' ')).toContain('İRSALİYE KESER')
  })

  it('kritik yetkisi olmayan kullanıcıda boş dönüyor', () => {
    expect(kritikYetkiler(['dashboard.read', 'stock.read'])).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// TÜMDENGELİM AĞACI
//
// Burada korunan üç şey: (1) yazma yetkisi listenin DİBİNDE kalmasın —
// yöneticinin aradığı satır o; (2) tanınmayan izin 'yapar' sayılsın, çünkü
// "yalnız görür" diye göstermek pahalı olan hata; (3) bir izni iki rol
// açıyorsa İKİSİ de yazılsın — tek rolü çıkarmak yetkiyi geri almıyor.
// ═══════════════════════════════════════════════════════════════════════════

describe('yetkiTuru', () => {
  it('.read görmedir, .write ve .manage yapmadır', () => {
    expect(yetkiTuru('stock.read')).toBe('gorur')
    expect(yetkiTuru('stock.write')).toBe('yapar')
    expect(yetkiTuru('users.manage')).toBe('yapar')
  })

  it('TANINMAYAN izni YAPAR sayıyor — zararsız göstermiyor', () => {
    // Bilinmeyen bir izni "yalnız görür" diye sunmak, yazma yetkisi olan
    // birini masum gibi gösterir. Ters yön yalnızca fazla dikkat çeker.
    expect(yetkiTuru('bilinmeyen.izin')).toBe('yapar')
  })
})

describe('alanAgaci', () => {
  it('izinleri alan alan ayırıyor ve iş akışı sırasına diziyor', () => {
    const agac = alanAgaci(['logistics.write', 'stock.read', 'dashboard.read', 'purchase.read'])
    expect(agac.map(a => a.alan)).toEqual(['Genel', 'Satın alma', 'Depo', 'Sevkiyat'])
  })

  it('YAPMA yetkisini alan içinde ÖNE alıyor', () => {
    const agac = alanAgaci(['stock.read', 'stock.write'])
    const depo = agac.find(a => a.alan === 'Depo')
    expect(depo?.yetenekler[0].izinKodu).toBe('stock.write')
    expect(depo?.yaparSayisi).toBe(1)
    expect(depo?.kritikSayisi).toBe(1)
  })

  it('tanınmayan izni GİZLEMİYOR, Diğer altında ham koduyla veriyor', () => {
    const agac = alanAgaci(['yeni.izin'])
    expect(agac.map(a => a.alan)).toEqual(['Diğer'])
    expect(agac[0].yetenekler[0].cumle).toBe('yeni.izin')
  })

  it('kaynak verilince yetkiyi AÇAN rolleri yazıyor', () => {
    const agac = alanAgaci(['stock.write'], {
      roller: ['depo_sorumlusu', 'satinalma_sorumlusu'],
      rolIzinleri: ROL_IZINLERI,
      rolAdlari: { depo_sorumlusu: 'Depo Sorumlusu' },
    })
    expect(agac[0].yetenekler[0].kaynakRoller).toEqual(['Depo Sorumlusu'])
  })

  it('aynı izin tek satır — iki rol aynı izni açsa bile', () => {
    const agac = alanAgaci(['stock.read', 'stock.read'])
    expect(agac[0].yetenekler).toHaveLength(1)
  })
})

describe('yetkininKaynagi', () => {
  it('izni açan TÜM rolleri döndürüyor', () => {
    // Tek rolü çıkarmak yetkiyi geri almaz; ekran bu yüzden hepsini yazıyor.
    expect(yetkininKaynagi('stock.read', ['depo_sorumlusu', 'satinalma_sorumlusu', 'izleyici'], ROL_IZINLERI))
      .toEqual(['depo_sorumlusu', 'satinalma_sorumlusu', 'izleyici'])
  })

  it('açmayan rolü yazmıyor', () => {
    expect(yetkininKaynagi('stock.write', ['satinalma_sorumlusu'], ROL_IZINLERI)).toEqual([])
  })
})

describe('rolAgaci', () => {
  const ROLLER = [
    { code: 'depo_sorumlusu', name: 'Depo Sorumlusu', description: 'Stok yürütür.' },
    { code: 'izleyici', name: 'Görüntüleyici', description: 'Her şeyi görür.' },
    { code: 'bos_rol', name: 'Boş Rol', description: '' },
  ]

  it('her rol için alan ağacını ve sayıları veriyor', () => {
    const agac = rolAgaci(ROLLER, ROL_IZINLERI)
    const depo = agac.find(r => r.kod === 'depo_sorumlusu')
    expect(depo?.izinSayisi).toBe(4)
    expect(depo?.kritikSayisi).toBe(1)
    expect(depo?.saltOkur).toBe(false)
    expect(depo?.alanlar.map(a => a.alan)).toEqual(['Genel', 'Depo', 'Sevkiyat'])
  })

  it('hiçbir şey değiştiremeyen rolü SALT OKUR işaretliyor', () => {
    const izleyici = rolAgaci(ROLLER, ROL_IZINLERI).find(r => r.kod === 'izleyici')
    expect(izleyici?.saltOkur).toBe(true)
    expect(izleyici?.kritikSayisi).toBe(0)
  })

  it('İZNİ OLMAYAN ROLÜ LİSTEDEN DÜŞÜRMÜYOR', () => {
    // "Bu rolü verdim ama hiçbir şey açılmadı" durumunun kendisi bilgi.
    const bos = rolAgaci(ROLLER, ROL_IZINLERI).find(r => r.kod === 'bos_rol')
    expect(bos).toBeTruthy()
    expect(bos?.izinSayisi).toBe(0)
    expect(bos?.saltOkur).toBe(false)
    expect(rolCumlesi(bos!)).toBe('Bu rol hiçbir ekranı açmıyor.')
  })
})

describe('rolCumlesi', () => {
  it('iş yaptığı alanlarla yalnız gördüğü alanları AYIRIYOR', () => {
    const depo = rolAgaci(
      [{ code: 'depo_sorumlusu', name: 'Depo Sorumlusu' }],
      ROL_IZINLERI,
    )[0]
    const cumle = rolCumlesi(depo)
    expect(cumle).toContain('İş yapar: Depo')
    expect(cumle).toContain('Yalnız görür: Genel, Sevkiyat')
  })
})

describe('rolKatkisi', () => {
  it('rolün EKLEDİĞİNİ gösteriyor, tamamını değil', () => {
    const katki = rolKatkisi(
      ['dashboard.read', 'stock.read'],
      ROL_IZINLERI.depo_sorumlusu,
    )
    expect(katki.yeni.map(y => y.izinKodu)).toEqual(['stock.write', 'logistics.read'])
    expect(katki.zatenVar).toBe(2)
    expect(katki.yeniKritik).toBe(1)
  })

  it('her şeyi zaten olan kişide hiçbir şey eklemiyor', () => {
    const katki = rolKatkisi(ROL_IZINLERI.depo_sorumlusu, ROL_IZINLERI.izleyici)
    expect(katki.yeni).toEqual([])
    expect(katki.zatenVar).toBe(2)
  })
})
