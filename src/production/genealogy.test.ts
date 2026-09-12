// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 — Lot soyağacı testleri
//
// Yol haritası maddesi: "Lot soyağacı bağlanıyor"
//         Bitti sayılır ki: "'Bu mamulün içinde hangi lotlar var' cevaplanabiliyor"
//
// Kriterin sınanabilir hâli: bir mamul lotundan başlayıp TEDARİKÇİ PARTİSİNE
// kadar inebilmek. Aşağıdaki senaryo iki kademeli:
//
//   un + su ──(UE-1)──▶ HAMUR-1 ──(UE-2)──▶ EKMEK-1
//
// "EKMEK-1'in içinde ne var?" sorusunun cevabı yalnızca HAMUR-1 değil, onun
// da içindeki UN-A ve SU-B olmalı. Zincir bir kademede kesilirse geri çağırma
// listesi eksik çıkar ve bunu kimse fark etmez.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest'
import type { TenantCtx } from '../core/context'
import {
  VARSAYILAN_DERINLIK,
  etkilenenSevkiyatIdleri,
  ileriIzle,
  kopukluklar,
  soyagaciCikar,
  soyagaciniDuzlestir,
  tedarikciPartileri,
  yasamDongusunuKur,
  type SoyagaciHareketi,
  type SoyagaciKaynagi,
  type SoyagaciLotu,
} from './genealogy'

const ctx: TenantCtx = { tenantId: 't1', branchId: 'b1', userId: 'u1' }

/** Bellekte yaşayan defter. Gerçek şemadaki alanların aynısını taşıyor. */
class BellekKaynak implements SoyagaciKaynagi {
  lotlar: SoyagaciLotu[] = []
  hareketler: SoyagaciHareketi[] = []
  isEmirleri = new Map<string, string>()
  /** Kaç kez lot sorulduğu — önbellek davranışını sınamak için. */
  lotSorgusu = 0

  async lot(_c: TenantCtx, lotId: string) {
    this.lotSorgusu += 1
    return this.lotlar.find(l => l.lotId === lotId) ?? null
  }
  async lotAra(_c: TenantCtx, arama: string) {
    const a = arama.toLocaleLowerCase('tr-TR')
    return this.lotlar.filter(l => l.lotKodu.toLocaleLowerCase('tr-TR').includes(a))
  }
  async lotaGirisler(_c: TenantCtx, lotId: string) {
    return this.hareketler.filter(h => h.lotId === lotId && h.miktar > 0)
  }
  async lottanCikislar(_c: TenantCtx, lotId: string) {
    return this.hareketler.filter(h => h.lotId === lotId && h.miktar < 0)
  }
  async belgeninHareketleri(_c: TenantCtx, kaynakId: string) {
    return this.hareketler.filter(h => h.kaynakId === kaynakId)
  }
  async isEmriNo(_c: TenantCtx, id: string) { return this.isEmirleri.get(id) }
}

const lot = (
  lotId: string, kod: string, kalemAd: string,
  kaynakTipi: SoyagaciLotu['kaynakTipi'], tedarikci?: string,
): SoyagaciLotu => ({
  lotId, lotKodu: kod, stokKalemiId: `k-${kalemAd}`, stokKalemiAd: kalemAd,
  kaynakTipi, tedarikci,
})

let sayac = 0
const hareket = (
  lotId: string, miktar: number, neden: string, kaynakId?: string,
): SoyagaciHareketi => ({
  id: `h${++sayac}`, stokKalemiId: 'k', lotId, miktar, neden,
  kaynakTipi: 'work_order', kaynakId, tarih: '2026-09-09',
})

let kaynak: BellekKaynak

beforeEach(() => {
  sayac = 0
  kaynak = new BellekKaynak()

  // ── İki kademeli zincir ────────────────────────────────────────────────
  // UN-A (ABC Un'dan satın alındı) + SU-B → UE-1 → HAMUR-1
  // HAMUR-1 → UE-2 → EKMEK-1
  kaynak.lotlar = [
    lot('l-un', 'UN-A', 'Un', 'RECEIPT', 'ABC Un A.Ş.'),
    lot('l-su', 'SU-B', 'Su', 'RECEIPT', 'Şehir Suyu'),
    lot('l-hamur', 'HAMUR-1', 'Hamur', 'PRODUCTION'),
    lot('l-ekmek', 'EKMEK-1', 'Ekmek', 'PRODUCTION'),
  ]
  kaynak.isEmirleri.set('ue-1', 'UE-2026-0001')
  kaynak.isEmirleri.set('ue-2', 'UE-2026-0002')

  kaynak.hareketler = [
    // Satın alma girişleri
    hareket('l-un', 100_000, 'PURCHASE_RECEIPT', 'mk-1'),
    hareket('l-su', 60_000, 'PURCHASE_RECEIPT', 'mk-2'),
    // UE-1: 80 kg un + 50 lt su tüketildi, 120 kg hamur çıktı
    hareket('l-un', -80_000, 'PRODUCTION_CONSUME', 'ue-1'),
    hareket('l-su', -50_000, 'PRODUCTION_CONSUME', 'ue-1'),
    hareket('l-hamur', 120_000, 'PRODUCTION_OUTPUT', 'ue-1'),
    // UE-2: 100 kg hamur tüketildi, 90 kg ekmek çıktı
    hareket('l-hamur', -100_000, 'PRODUCTION_CONSUME', 'ue-2'),
    hareket('l-ekmek', 90_000, 'PRODUCTION_OUTPUT', 'ue-2'),
  ]
})

// ═══════════════════════════════════════════════════════════════════════════
describe('KRİTER: bu mamulün içinde hangi partiler var', () => {
  it('bir kademe aşağıya iniyor', async () => {
    const agac = (await soyagaciCikar(ctx, kaynak, 'l-ekmek'))!

    expect(agac.lot.lotKodu).toBe('EKMEK-1')
    expect(agac.isEmriNo).toBe('UE-2026-0002')
    expect(agac.icindekiler).toHaveLength(1)
    expect(agac.icindekiler[0].lot.lotKodu).toBe('HAMUR-1')
    expect(agac.icindekiler[0].kullanilanMiktar).toBe(100_000)
  })

  it('İKİ kademe aşağıya iniyor — hamurun içindeki un ve su da görünüyor', async () => {
    // Zincir bir kademede kesilirse geri çağırma listesi eksik çıkar.
    const agac = (await soyagaciCikar(ctx, kaynak, 'l-ekmek'))!
    const hamur = agac.icindekiler[0]

    expect(hamur.isEmriNo).toBe('UE-2026-0001')
    expect(hamur.icindekiler.map(x => x.lot.lotKodu).sort()).toEqual(['SU-B', 'UN-A'])
  })

  it('tedarikçi partisine kadar iniliyor ve tedarikçi adı taşınıyor', async () => {
    const agac = (await soyagaciCikar(ctx, kaynak, 'l-ekmek'))!
    const partiler = tedarikciPartileri(agac)

    expect(partiler.map(p => p.lot.tedarikci).sort())
      .toEqual(['ABC Un A.Ş.', 'Şehir Suyu'])
  })

  it('tüketilen miktarlar taşınıyor', async () => {
    const agac = (await soyagaciCikar(ctx, kaynak, 'l-ekmek'))!
    const hamur = agac.icindekiler[0]
    const un = hamur.icindekiler.find(x => x.lot.lotKodu === 'UN-A')!

    expect(un.kullanilanMiktar).toBe(80_000)
  })

  it('derinlik doğru sayılıyor', async () => {
    const satirlar = soyagaciniDuzlestir((await soyagaciCikar(ctx, kaynak, 'l-ekmek'))!)
    const derinlikler = Object.fromEntries(satirlar.map(s => [s.lot.lotKodu, s.derinlik]))

    expect(derinlikler).toEqual({ 'EKMEK-1': 0, 'HAMUR-1': 1, 'UN-A': 2, 'SU-B': 2 })
  })

  it('yol, kökten o partiye kadar olan zinciri gösteriyor', async () => {
    const satirlar = soyagaciniDuzlestir((await soyagaciCikar(ctx, kaynak, 'l-ekmek'))!)
    const un = satirlar.find(s => s.lot.lotKodu === 'UN-A')!

    expect(un.yol).toEqual(['EKMEK-1', 'HAMUR-1', 'UN-A'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('zincirin bittiği yerler', () => {
  it('satın alınan partinin "içi" yoktur; zincir orada biter', async () => {
    const agac = (await soyagaciCikar(ctx, kaynak, 'l-un'))!

    expect(agac.icindekiler).toHaveLength(0)
    expect(agac.kesildi).toBeUndefined()   // kopukluk değil, doğal son
  })

  it('FEFO ile bölünmüş tüketim TEK partide toplanıyor', async () => {
    // Aynı lottan iki satır çıkmış olabilir; ekranda iki kez görünmemeli.
    kaynak.hareketler.push(hareket('l-un', -5_000, 'PRODUCTION_CONSUME', 'ue-1'))
    const agac = (await soyagaciCikar(ctx, kaynak, 'l-ekmek'))!
    const hamur = agac.icindekiler[0]
    const unler = hamur.icindekiler.filter(x => x.lot.lotKodu === 'UN-A')

    expect(unler).toHaveLength(1)
    expect(unler[0].kullanilanMiktar).toBe(85_000)
  })

  it('İPTAL edilmiş tüketim mamulün içine girmez', async () => {
    // Ters kayıt, o malın üretime hiç girmediğini söyler.
    kaynak.hareketler.push(hareket('l-su', 50_000, 'REVERSAL', 'ue-1'))
    kaynak.hareketler.push(hareket('l-su', -50_000, 'REVERSAL', 'ue-1'))
    const agac = (await soyagaciCikar(ctx, kaynak, 'l-ekmek'))!
    const hamur = agac.icindekiler[0]

    // Ters kayıt satırı ayrı bir parti gibi listelenmiyor.
    expect(hamur.icindekiler.filter(x => x.lot.lotKodu === 'SU-B')).toHaveLength(1)
  })

  it('üretim lotunun iş emri bulunamazsa KOPUKLUK olarak işaretlenir', async () => {
    // Sessizce "içi boş" demek, eksik bir geri çağırma listesi üretirdi.
    kaynak.hareketler = kaynak.hareketler.filter(
      h => !(h.lotId === 'l-hamur' && h.neden === 'PRODUCTION_OUTPUT'),
    )
    const agac = (await soyagaciCikar(ctx, kaynak, 'l-ekmek'))!
    const hamur = agac.icindekiler[0]

    expect(hamur.kesildi).toBe('bilinmiyor')
    expect(kopukluklar(agac)).toHaveLength(1)
  })

  it('derinlik sınırına dayanınca işaretleniyor, sessizce kesilmiyor', async () => {
    const agac = (await soyagaciCikar(ctx, kaynak, 'l-ekmek', 1))!
    const hamur = agac.icindekiler[0]

    expect(hamur.kesildi).toBe('derinlik')
    expect(hamur.icindekiler).toHaveLength(0)
  })

  it('kendine dönen zincir sonsuza kadar inmiyor', async () => {
    // Veri hatası: hamurun üretiminde yine hamur tüketilmiş görünüyor.
    kaynak.hareketler.push(hareket('l-hamur', -10_000, 'PRODUCTION_CONSUME', 'ue-1'))
    const agac = (await soyagaciCikar(ctx, kaynak, 'l-ekmek'))!
    const kesikler = kopukluklar(agac)

    expect(kesikler.some(k => k.kesildi === 'dongu')).toBe(true)
  })

  it('olmayan lot için ağaç üretilmiyor', async () => {
    expect(await soyagaciCikar(ctx, kaynak, 'yok-boyle-lot')).toBeNull()
  })

  it('varsayılan derinlik makul bir tavan', () => {
    expect(VARSAYILAN_DERINLIK).toBeGreaterThanOrEqual(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('kardeş dallar birbirini engellemiyor', () => {
  it('aynı parti iki dalda da geçebiliyor', async () => {
    // Un hem hamura hem doğrudan ekmeğe girmiş olsun. Döngü koruması dal
    // bazlı olmasaydı, ikinci dalda "döngü" der ve partiyi gizlerdi.
    kaynak.hareketler.push(hareket('l-un', -10_000, 'PRODUCTION_CONSUME', 'ue-2'))
    const agac = (await soyagaciCikar(ctx, kaynak, 'l-ekmek'))!

    const kodlar = agac.icindekiler.map(x => x.lot.lotKodu).sort()
    expect(kodlar).toEqual(['HAMUR-1', 'UN-A'])

    const hamur = agac.icindekiler.find(x => x.lot.lotKodu === 'HAMUR-1')!
    expect(hamur.icindekiler.some(x => x.lot.lotKodu === 'UN-A')).toBe(true)
    expect(kopukluklar(agac)).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// İLERİ İZLEME — "bu parti nereye gitti"
//
// Yol haritası maddesi: "İleri izleme: bu lot nereye gitti"
//         Bitti sayılır ki: "Etkilenen sevkiyatlar ve müşteriler listeleniyor"
//
// Kurulum (beforeEach'e ek olarak): EKMEK-1'in 60 kg'ı SVK-1'e, 30 kg'ı
// SVK-2'ye gitti. Yani UN-A partisi iki müşteriye ulaştı — zincir iki kademe
// yukarıdan geçerek.
// ═══════════════════════════════════════════════════════════════════════════

describe('KRİTER: bu parti nereye gitti', () => {
  beforeEach(() => {
    kaynak.hareketler.push(
      hareket('l-ekmek', -60_000, 'SHIPMENT_OUT', 'svk-1'),
      hareket('l-ekmek', -30_000, 'SHIPMENT_OUT', 'svk-2'),
    )
  })

  it('mamul partisinden doğrudan sevkiyatlar bulunuyor', async () => {
    const sonuc = await ileriIzle(ctx, kaynak, 'l-ekmek')

    expect(etkilenenSevkiyatIdleri(sonuc).sort()).toEqual(['svk-1', 'svk-2'])
    expect(sonuc.sevkiyatlar.map(s => s.miktar).sort((a, b) => a - b)).toEqual([30_000, 60_000])
  })

  it('HAMMADDE partisinden iki kademe yukarı çıkıp sevkiyata ulaşıyor', async () => {
    // Asıl iddia bu: "şu un partisi bozuk" denince, o unun girdiği hamurdan
    // yapılan ekmeğin hangi müşterilere gittiği bulunabiliyor.
    const sonuc = await ileriIzle(ctx, kaynak, 'l-un')

    expect(etkilenenSevkiyatIdleri(sonuc).sort()).toEqual(['svk-1', 'svk-2'])
    expect(sonuc.tureyenLotlar.map(l => l.lotKodu).sort()).toEqual(['EKMEK-1', 'HAMUR-1'])
  })

  it('yol, hangi partilerden geçtiğini gösteriyor', async () => {
    const sonuc = await ileriIzle(ctx, kaynak, 'l-un')
    expect(sonuc.sevkiyatlar[0].yol).toEqual(['UN-A', 'HAMUR-1', 'EKMEK-1'])
  })

  it('hiç sevk edilmemiş parti boş liste döndürüyor', async () => {
    const sonuc = await ileriIzle(ctx, kaynak, 'l-su')
    // Su da ekmeğe girdi, o yüzden aynı sevkiyatlara ulaşır.
    expect(etkilenenSevkiyatIdleri(sonuc).sort()).toEqual(['svk-1', 'svk-2'])
  })

  it('İPTAL edilmiş sevkiyat listeye girmiyor', async () => {
    // Ters kaydı olan çıkış "gitmedi" demektir; müşteriyi boşuna aramayalım.
    kaynak.hareketler.push(hareket('l-ekmek', 60_000, 'REVERSAL', 'svk-1'))
    kaynak.hareketler = kaynak.hareketler.filter(
      h => !(h.kaynakId === 'svk-1' && h.neden === 'SHIPMENT_OUT'),
    )
    const sonuc = await ileriIzle(ctx, kaynak, 'l-ekmek')

    expect(etkilenenSevkiyatIdleri(sonuc)).toEqual(['svk-2'])
  })

  it('fire ve imha dallanmıyor — o mal müşteriye gitmedi', async () => {
    kaynak.hareketler.push(hareket('l-un', -3_000, 'PRODUCTION_WASTE', 'ue-9'))
    kaynak.hareketler.push(hareket('l-un', -2_000, 'EXPIRY_WRITE_OFF'))
    const sonuc = await ileriIzle(ctx, kaynak, 'l-un')

    expect(etkilenenSevkiyatIdleri(sonuc).sort()).toEqual(['svk-1', 'svk-2'])
  })

  it('derinlik sınırına dayanınca SÖYLENİYOR — liste eksik olabilir', async () => {
    const sonuc = await ileriIzle(ctx, kaynak, 'l-un', 1)
    expect(sonuc.derinlikAsildi).toBe(true)
  })

  it('olmayan lot boş sonuç döndürüyor', async () => {
    const sonuc = await ileriIzle(ctx, kaynak, 'yok')
    expect(sonuc.sevkiyatlar).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Yaşam döngüsü — "bu partiye ne oldu"
// ═══════════════════════════════════════════════════════════════════════════

describe('yasamDongusunuKur', () => {
  const h = (id: string, miktar: number, tarih: string, neden = 'RECEIPT'): SoyagaciHareketi => ({
    id, stokKalemiId: 'k1', lotId: 'L1', miktar, neden,
    kaynakTipi: 'RECEIPT', tarih,
  })

  it('hareketleri zamana göre sıralayıp kalan bakiyeyi türetiyor', () => {
    const olaylar = yasamDongusunuKur([
      h('c1', -30, '2026-02-02T10:00:00Z', 'SHIPMENT_OUT'),
      h('g1', 100, '2026-02-01T09:00:00Z'),
      h('c2', -20, '2026-02-03T10:00:00Z', 'PRODUCTION_CONSUME'),
    ])

    expect(olaylar.map(o => o.hareket.id)).toEqual(['g1', 'c1', 'c2'])
    expect(olaylar.map(o => o.kalan)).toEqual([100, 70, 50])
  })

  it('aynı ana düşen hareketlerde sıra HER AÇILIŞTA aynı', () => {
    const girdi = [
      h('b', -10, '2026-02-01T09:00:00Z', 'SHIPMENT_OUT'),
      h('a', 100, '2026-02-01T09:00:00Z'),
    ]
    const bir = yasamDongusunuKur(girdi).map(o => o.hareket.id)
    const iki = yasamDongusunuKur([...girdi].reverse()).map(o => o.hareket.id)
    expect(bir).toEqual(iki)
  })

  it('son satırın kalanı, partide kalan miktardır', () => {
    const olaylar = yasamDongusunuKur([
      h('g1', 100, '2026-02-01T09:00:00Z'),
      h('c1', -100, '2026-02-05T09:00:00Z', 'SHIPMENT_OUT'),
    ])
    expect(olaylar[olaylar.length - 1].kalan).toBe(0)
  })

  it('hareketsiz parti boş liste veriyor', () => {
    expect(yasamDongusunuKur([])).toEqual([])
  })
})
