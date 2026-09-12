// ═══════════════════════════════════════════════════════════════════════════
// Ortalama maliyet testleri.
//
// Buradaki sayılar uydurma değil: her biri "iki farklı fiyattan aldık, kaç
// TL'lik mal kullandık" sorusunun bir hâli. Bir yöntem değişikliği (FIFO'ya
// geçmek gibi) bu testlerin çoğunu kırar — kırması da gerekir, çünkü rakamlar
// gerçekten değişir.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import type { Movement, MovementReason, SourceType } from '../core/stock/stock.repository'
import {
  VARSAYILAN_MALIYET_YONTEMI,
  cikisMaliyeti,
  maliyetiHesapla,
} from './stock-cost'

let sayac = 0

/** Test için tek hareket. Kalan alanlar hesaba girmiyor, sabit veriliyor. */
const hareket = (
  girdi: {
    gun: number
    /** İşaretli: giriş +, çıkış −. Temel birimde. */
    temel: number
    /** Kullanıcının yazdığı miktar; verilmezse temelle aynı. */
    yazilan?: number
    birim?: string
    fiyat?: number
    neden?: MovementReason
  },
): Movement => {
  sayac += 1
  const yazilan = girdi.yazilan ?? girdi.temel
  return {
    id: `m${sayac}`,
    tenantId: 't1',
    branchId: 'b1',
    stockItemId: 's1',
    quantityBase: girdi.temel,
    quantityEntered: yazilan,
    uomEntered: girdi.birim ?? 'kg',
    reason: girdi.neden ?? (girdi.temel > 0 ? 'PURCHASE_RECEIPT' : 'PRODUCTION_CONSUME'),
    sourceType: 'goods_receipt' as SourceType,
    unitCost: girdi.fiyat,
    idempotencyKey: `k${sayac}`,
    occurredAt: new Date(2026, 0, girdi.gun),
    recordedAt: new Date(2026, 0, girdi.gun),
  }
}

describe('ortalama maliyet', () => {
  it('tek alışta ortalama = alış fiyatı', () => {
    const m = maliyetiHesapla([hareket({ gun: 1, temel: 100, fiyat: 40 })])

    expect(m.miktar).toBe(100)
    expect(m.deger).toBe(4000)
    expect(m.birimMaliyet).toBe(40)
  })

  it('iki farklı fiyattan alış, ortalamada buluşur', () => {
    // Ürün sahibine anlatılan örnek: 100×40 + 100×50 → 200 kg, 45 TL.
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: 100, fiyat: 50 }),
    ])

    expect(m.miktar).toBe(200)
    expect(m.deger).toBe(9000)
    expect(m.birimMaliyet).toBe(45)
  })

  it('çıkış ortalamadan düşer, ortalamayı DEĞİŞTİRMEZ', () => {
    // Bu, yöntemin can alıcı noktası. 50 kg çıkarsa 2.250 TL değer gider ama
    // kalan 150 kg'ın birim maliyeti hâlâ 45 TL'dir.
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: 100, fiyat: 50 }),
      hareket({ gun: 3, temel: -50 }),
    ])

    expect(m.miktar).toBe(150)
    expect(m.deger).toBe(6750)
    expect(m.birimMaliyet).toBe(45)
  })

  it('çıkıştan sonra gelen yeni fiyat ortalamayı kaydırır', () => {
    // 150 kg × 45 TL = 6.750, üstüne 50 kg × 60 TL = 3.000 → 200 kg / 9.750
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: 100, fiyat: 50 }),
      hareket({ gun: 3, temel: -50 }),
      hareket({ gun: 4, temel: 50, fiyat: 60 }),
    ])

    expect(m.miktar).toBe(200)
    expect(m.deger).toBe(9750)
    expect(m.birimMaliyet).toBe(48.75)
  })

  it('sıra karışık gelse bile tarihe göre hesaplanır', () => {
    // Defterden okuma sırası garanti değil; hesap tarihe bakmalı.
    const duz = maliyetiHesapla([
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: -50 }),
      hareket({ gun: 3, temel: 100, fiyat: 60 }),
    ])
    const karisik = maliyetiHesapla([
      hareket({ gun: 3, temel: 100, fiyat: 60 }),
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: -50 }),
    ])

    expect(karisik.birimMaliyet).toBe(duz.birimMaliyet)
    expect(karisik.deger).toBe(duz.deger)
  })
})

describe('fiyatın birimi', () => {
  it('fiyat YAZILAN birimin fiyatıdır, temel birimin değil', () => {
    // Mercimek temel birimi g; sipariş kg üzerinden 40 TL'den verildi.
    // 100 kg = 100.000 g girdi, değer 4.000 TL olmalı — 4.000.000 değil.
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100_000, yazilan: 100, birim: 'kg', fiyat: 40 }),
    ])

    expect(m.deger).toBe(4000)
    // Ortalama TEMEL birim başınadır: gram başına 0,04 TL.
    expect(m.birimMaliyet).toBe(0.04)
  })

  it('gram başına maliyetten 250 gramlık çıkışın tutarı doğru çıkar', () => {
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100_000, yazilan: 100, birim: 'kg', fiyat: 40 }),
    ])

    expect(cikisMaliyeti(m, 250)).toBe(10)
  })
})

describe('fiyatsız giriş', () => {
  it('fiyatsız giriş ortalamayı AŞAĞI çekmez, o anki ortalamayla değerlenir', () => {
    // Elle giriş ve sayım fazlasında fiyat yoktur. 0 TL saysaydık 200 kg'ın
    // ortalaması 20 TL'ye inerdi — mal bedava gelmiş gibi.
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: 100, neden: 'COUNT_SURPLUS' }),
    ])

    expect(m.miktar).toBe(200)
    expect(m.birimMaliyet).toBe(40)
    expect(m.deger).toBe(8000)
    expect(m.fiyatsizGirisVar).toBe(true)
  })

  it('hiç fiyat girilmemişse maliyet 0 kalır ama işaret konur', () => {
    const m = maliyetiHesapla([hareket({ gun: 1, temel: 100, neden: 'OPENING_BALANCE' })])

    expect(m.birimMaliyet).toBe(0)
    expect(m.fiyatsizGirisVar).toBe(true)
  })

  it('fiyatlı alışlarda işaret konmaz', () => {
    const m = maliyetiHesapla([hareket({ gun: 1, temel: 100, fiyat: 40 })])
    expect(m.fiyatsizGirisVar).toBe(false)
  })
})

describe('son alış fiyatı', () => {
  it('yalnızca SATIN ALMA girişinden okunur', () => {
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: 100, fiyat: 50 }),
      // Üretim çıktısının birim maliyeti vardır ama o bir ALIŞ değildir.
      hareket({ gun: 3, temel: 20, fiyat: 999, neden: 'PRODUCTION_OUTPUT' }),
    ])

    expect(m.sonAlisFiyati).toBe(50)
    expect(m.sonAlisBirimi).toBe('kg')
    expect(m.sonAlisTarihi).toEqual(new Date(2026, 0, 2))
  })

  it('hiç alış yoksa son alış fiyatı boştur', () => {
    const m = maliyetiHesapla([hareket({ gun: 1, temel: 50, neden: 'OPENING_BALANCE' })])
    expect(m.sonAlisFiyati).toBeUndefined()
  })
})

describe('tedarikçi iadesi', () => {
  it('iade ortalamadan çıkar; kalanın birim maliyeti değişmez', () => {
    // 100×40 + 100×50 = 45 TL ortalama. 30 kg iade → 1.350 TL değer gider.
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: 100, fiyat: 50 }),
      hareket({ gun: 3, temel: -30, neden: 'PURCHASE_RETURN' }),
    ])

    expect(m.miktar).toBe(170)
    expect(m.deger).toBe(7650)
    expect(m.birimMaliyet).toBe(45)
  })
})

describe('sınır durumlar', () => {
  it('depo boşalınca değer sıfırlanır ama son ortalama unutulmaz', () => {
    // Depo bir an boşaldı diye o malın maliyeti "0 TL" değildir.
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: -100 }),
    ])

    expect(m.miktar).toBe(0)
    expect(m.deger).toBe(0)
    expect(m.birimMaliyet).toBe(40)
  })

  it('boşalıp yeniden dolunca yeni fiyat geçerli olur', () => {
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: -100 }),
      hareket({ gun: 3, temel: 50, fiyat: 70 }),
    ])

    expect(m.miktar).toBe(50)
    expect(m.birimMaliyet).toBe(70)
    expect(m.deger).toBe(3500)
  })

  it('ters kayıt (REVERSAL) hesaba girmez', () => {
    // Ters kayıt zaten kendi karşıt hareketiyle birlikte okunur; ikinci kez
    // saymak değeri iki katına çıkarırdı.
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: -100, fiyat: 40, neden: 'REVERSAL' }),
    ])

    expect(m.miktar).toBe(100)
    expect(m.birimMaliyet).toBe(40)
  })

  it('hiç hareket yoksa her şey sıfırdır', () => {
    const m = maliyetiHesapla([])

    expect(m.miktar).toBe(0)
    expect(m.deger).toBe(0)
    expect(m.birimMaliyet).toBe(0)
    expect(m.fiyatsizGirisVar).toBe(false)
  })

  it('çıkış maliyeti miktarla orantılıdır', () => {
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: 100, fiyat: 50 }),
    ])

    expect(cikisMaliyeti(m, 50)).toBe(2250)
    expect(cikisMaliyeti(m, 0)).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Yöntem değiştirilebilirliği
//
// Ürün sahibinin kararı ORTALAMA (2026-09-03) ama karar demo öncesinde,
// müşterinin muhasebecisiyle konuşulmadan verildi. Aşağıdaki testler,
// yöntemin gerçekten değiştirilebilir olduğunu ve üçünün AYNI DEFTERDEN
// FARKLI rakamlar ürettiğini gösteriyor. Biri kırılırsa, "sonra değiştiririz"
// sözü tutulamıyor demektir.
// ═══════════════════════════════════════════════════════════════════════════

describe('yöntem seçimi', () => {
  /** 100 kg × 40 TL, sonra 100 kg × 50 TL, sonra 50 kg çıkış. */
  const defter = () => [
    hareket({ gun: 1, temel: 100, fiyat: 40 }),
    hareket({ gun: 2, temel: 100, fiyat: 50 }),
    hareket({ gun: 3, temel: -50 }),
  ]

  it('ORTALAMA: kalan 150 kg, birim 45 TL', () => {
    const m = maliyetiHesapla(defter(), 'ORTALAMA')

    expect(m.yontem).toBe('ORTALAMA')
    expect(m.miktar).toBe(150)
    expect(m.birimMaliyet).toBe(45)
    expect(m.deger).toBe(6750)
  })

  it('FIFO: çıkan 50 kg ilk partiden gider, kalan pahalılaşır', () => {
    // Kalan: 40 TL'lik partiden 50 kg + 50 TL'lik partiden 100 kg
    //      = 2.000 + 5.000 = 7.000 TL / 150 kg = 46,67 TL
    const m = maliyetiHesapla(defter(), 'FIFO')

    expect(m.miktar).toBe(150)
    expect(m.deger).toBe(7000)
    expect(m.birimMaliyet).toBeCloseTo(46.666667, 5)
  })

  it('SON_ALIS: geçmişe bakmaz, her birim son fiyattan', () => {
    const m = maliyetiHesapla(defter(), 'SON_ALIS')

    expect(m.miktar).toBe(150)
    expect(m.birimMaliyet).toBe(50)
    expect(m.deger).toBe(7500)
  })

  it('yöntem belirtilmezse yürürlükteki varsayılan kullanılır', () => {
    const m = maliyetiHesapla(defter())
    expect(m.yontem).toBe(VARSAYILAN_MALIYET_YONTEMI)
  })

  it('son alış fiyatı yöntemden BAĞIMSIZDIR', () => {
    // "En son kaça aldık" sorusu bir değerleme yöntemi değil, bir olgudur.
    for(const yontem of ['ORTALAMA', 'FIFO', 'SON_ALIS'] as const){
      expect(maliyetiHesapla(defter(), yontem).sonAlisFiyati).toBe(50)
    }
  })

  it('tek fiyat varsa üç yöntem de aynı sonucu verir', () => {
    // Fiyat değişmiyorsa yöntemin bir anlamı kalmaz — ve kalmamalı.
    const tek = [
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: -30 }),
    ]
    const sonuclar = (['ORTALAMA', 'FIFO', 'SON_ALIS'] as const)
      .map(y => maliyetiHesapla(tek, y))

    for(const m of sonuclar){
      expect(m.miktar).toBe(70)
      expect(m.birimMaliyet).toBe(40)
      expect(m.deger).toBe(2800)
    }
  })
})

describe('FIFO ayrıntıları', () => {
  it('bir parti tükenince sonraki partiden yenir', () => {
    // 100 kg × 40 → 120 kg çıkış → 40'lık parti biter, 50'likten 20 gider.
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: 100, fiyat: 50 }),
      hareket({ gun: 3, temel: -120 }),
    ], 'FIFO')

    expect(m.miktar).toBe(80)
    expect(m.deger).toBe(4000)
    expect(m.birimMaliyet).toBe(50)
  })

  it('depo boşalınca değer sıfırlanır, son bilinen maliyet durur', () => {
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: -100 }),
    ], 'FIFO')

    expect(m.miktar).toBe(0)
    expect(m.deger).toBe(0)
    expect(m.birimMaliyet).toBe(40)
  })

  it('fiyatın birimi FIFO’da da doğru çevrilir', () => {
    // 57 kg × 95 TL = 5.415 TL — 5.415.000 değil.
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 57_000, yazilan: 57, birim: 'kg', fiyat: 95 }),
    ], 'FIFO')

    expect(m.deger).toBe(5415)
    expect(m.birimMaliyet).toBe(0.095)
  })
})

describe('SON_ALIS ayrıntıları', () => {
  it('hiç fiyatlı alış yoksa maliyet 0 kalır', () => {
    const m = maliyetiHesapla(
      [hareket({ gun: 1, temel: 100, neden: 'OPENING_BALANCE' })],
      'SON_ALIS',
    )

    expect(m.birimMaliyet).toBe(0)
    expect(m.fiyatsizGirisVar).toBe(true)
  })

  it('üretim çıktısının fiyatı son ALIŞ sayılmaz', () => {
    const m = maliyetiHesapla([
      hareket({ gun: 1, temel: 100, fiyat: 40 }),
      hareket({ gun: 2, temel: 20, fiyat: 999, neden: 'PRODUCTION_OUTPUT' }),
    ], 'SON_ALIS')

    expect(m.birimMaliyet).toBe(40)
  })
})
