// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Dilim 0 / G6.4 + G7 — ADR-001 sözleşme testleri (ORTAK GÖVDE)
//
// Yol haritası maddesi: "PostgreSQL uygulaması, aynı testler"
//                       Bitti sayılır ki: "İki uygulamada da aynı suite geçiyor"
//
// Bu dosya o cümlenin karşılığıdır. Testler artık tek bir yerde yazılı ve İKİ
// uygulama da AYNI gövdeden geçiyor:
//
//   • stock.contract.test.ts       → LocalStorageStockRepository (her koşumda)
//   • stock.contract.live.test.ts  → PostgresStockRepository (canlı, .env.test.local varsa)
//
// Testleri kopyalayıp ikinci bir dosyaya yapıştırmak da mümkündü ama o zaman
// "aynı suite" iddiası bir gün sessizce yanlış olurdu: biri güncellenir, diğeri
// unutulurdu. Tek gövde, iddianın kendisini korur.
//
// ── HARNESS NEDEN VAR ─────────────────────────────────────────────────────
// İki uygulamanın "temiz bir zemin" tanımı farklı:
//   • LocalStorage: `localStorage.clear()` yeter, kalem kimlikleri sabit olabilir.
//   • Postgres: defter APPEND-ONLY (0003) — yazılan hareket SİLİNEMEZ. Temizlik
//     diye bir şey yok. Bunun yerine her test KENDİ TAZE kalemlerini alır, böylece
//     bakiyesi her zaman 0'dan başlar; idempotency anahtarları da koşuma özgü
//     benzersiz bir önek taşır (aynı anahtar ikinci kez yazılamaz — I2).
//
// Harness bu farkı soğurur; testlerin gövdesi ikisi için de birebir aynı kalır.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import type { TenantCtx } from '../context'
import type { StockRepository, NegativeStockPolicy } from './stock.repository'
import {
  DuplicateIdempotencyKeyError,
  LotRequiredError,
  MovementAlreadyReversedError,
  MovementNotFoundError,
  NegativeBalanceBlockedError,
  UnknownStockItemError,
  ZeroQuantityMovementError,
} from './stock.repository'
import { convertUom } from './uom'

/** Tek bir testin ihtiyaç duyduğu, başka testlerden bağımsız zemin. */
export type ContractZemin = {
  repo: StockRepository
  ctx: TenantCtx
  /** Aynı tenant, BAŞKA şube. */
  baskaSubeCtx: TenantCtx
  /**
   * BAŞKA tenant'ın kendi repository'si ve bağlamı (I9).
   *
   * Neden ayrı bir repo: `PostgresStockRepository` tenant süzmesini `ctx`ten
   * DEĞİL, oturumun JWT'sinden alır (RLS yapar). Bu yüzden "başka tenant"ı
   * yalnızca `ctx` değiştirerek taklit etmek Postgres'te anlamsız olurdu —
   * gerçekten başka bir oturum gerekir. LocalStorage'da ikisi aynı repodur.
   */
  baskaTenant: { repo: StockRepository; ctx: TenantCtx }
  /** base_uom = 'kg', lot takibi YOK */
  lotsuzKalem: string
  /** base_uom = 'kg', lot takibi VAR */
  lotluKalem: string
  /** `lotluKalem` için geçerli bir lot kimliği */
  lotId: string
  /** Koşuma özgü benzersiz idempotency anahtarı üretir. */
  anahtar(ek: string): string
}

export type ContractHarness = {
  /** Rapor başlığında görünür: "LocalStorage" / "Postgres (canlı)" */
  ad: string
  /**
   * Taze bir zemin kurar. HER testin başında çağrılır.
   * `policy` verilirse tenant'ın negatif bakiye politikası o değere ayarlanır.
   */
  hazirla(policy?: NegativeStockPolicy): Promise<ContractZemin>
  /** Uzak veritabanı yavaştır; canlı harness bunu yükseltir. */
  zamanAsimi?: number
}

export function sozlesmeTestleriniKos(h: ContractHarness): void {
  const zamanAsimi = h.zamanAsimi ?? 5_000
  const test = (ad: string, govde: () => Promise<void> | void) => it(ad, govde, zamanAsimi)

  describe(`I1 · Miktar defterden türetilir [${h.ad}]`, () => {
    test('200 giriş - 150 çıkış = 50 kalır', async () => {
      const z = await h.hazirla()
      await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 200, uom: 'kg', reason: 'PURCHASE_RECEIPT', sourceType: 'goods_receipt' },
        z.anahtar('giris:1'),
      )
      await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: -150, uom: 'kg', reason: 'PRODUCTION_CONSUME', sourceType: 'work_order' },
        z.anahtar('cikis:1'),
      )
      await expect(z.repo.quantityOf(z.ctx, z.lotsuzKalem)).resolves.toBe(50)
    })
  })

  describe(`I2 · Aynı idempotency key ikinci kez yazılamaz [${h.ad}]`, () => {
    test('ikinci gönderim reddedilir, stok iki katına çıkmaz', async () => {
      const z = await h.hazirla()
      const yuk = {
        stockItemId: z.lotsuzKalem,
        quantity: 200,
        uom: 'kg',
        reason: 'PURCHASE_RECEIPT' as const,
        sourceType: 'goods_receipt' as const,
      }
      const k = z.anahtar('tekrar:1')
      await z.repo.postMovement(z.ctx, yuk, k)

      await expect(z.repo.postMovement(z.ctx, yuk, k)).rejects.toThrow(DuplicateIdempotencyKeyError)
      await expect(z.repo.quantityOf(z.ctx, z.lotsuzKalem)).resolves.toBe(200)
    })
  })

  describe(`I3 · Ters kayıt bakiyeyi eski değerine döndürür [${h.ad}]`, () => {
    test('bakiye sıfırdan başlamıyor: ters kayıt tam olarak ÖNCEKİ bakiyeye döner', async () => {
      // Bakiye 0'dan başlayıp 200 giriş sonrası tekrar 0'a dönmesi zayıf bir
      // kanıt: "eski değere döner" iddiası sıfır-olmayan bir önceki bakiyeyle
      // sınanmalı (Codex incelemesi, 2026-08-25).
      const z = await h.hazirla()
      await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 50, uom: 'kg', reason: 'OPENING_BALANCE', sourceType: 'manual' },
        z.anahtar('ters:baseline'),
      )
      const terslenecek = await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 200, uom: 'kg', reason: 'PURCHASE_RECEIPT', sourceType: 'goods_receipt' },
        z.anahtar('ters:1'),
      )

      await expect(z.repo.quantityOf(z.ctx, z.lotsuzKalem)).resolves.toBe(250)
      await z.repo.reverseMovement(z.ctx, terslenecek.id, z.anahtar('ters:reversal:1'))
      await expect(z.repo.quantityOf(z.ctx, z.lotsuzKalem)).resolves.toBe(50)
    })
  })

  describe(`I4 · Bir hareket yalnızca bir kez ters çevrilebilir [${h.ad}]`, () => {
    test('ikinci ters çevirme reddedilir', async () => {
      const z = await h.hazirla()
      const asil = await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 200, uom: 'kg', reason: 'PURCHASE_RECEIPT', sourceType: 'goods_receipt' },
        z.anahtar('ters:2'),
      )
      await z.repo.reverseMovement(z.ctx, asil.id, z.anahtar('ters:reversal:2a'))

      await expect(
        z.repo.reverseMovement(z.ctx, asil.id, z.anahtar('ters:reversal:2b')),
      ).rejects.toThrow(MovementAlreadyReversedError)
    })
  })

  describe(`Şube sınırı (I9'un tamamlayıcısı) [${h.ad}]`, () => {
    test('başka şube context\'i, bu şubenin hareketini bulamaz/ters çeviremez', async () => {
      // reverseMovement, quantityOf/ledgerOf'un aksine branchId'ye göre filtre
      // yapmıyordu; aynı tenant içindeki başka bir şube diğerininkini ters
      // çevirebiliyordu (Codex incelemesi, 2026-08-25).
      const z = await h.hazirla()
      const asil = await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 100, uom: 'kg', reason: 'PURCHASE_RECEIPT', sourceType: 'goods_receipt' },
        z.anahtar('sube-sinir:1'),
      )

      await expect(
        z.repo.reverseMovement(z.baskaSubeCtx, asil.id, z.anahtar('sube-sinir:reversal:1')),
      ).rejects.toThrow(MovementNotFoundError)
    })
  })

  describe(`I5 · Hareket güncellenemez/silinemez [${h.ad}]`, () => {
    test('StockRepository arayüzünde update/delete metodu hiç yok', async () => {
      // Postgres tarafında bunu bir tetikleyici zorluyor (0003). Arayüzde böyle
      // bir metot TANIMLI DEĞİL; TypeScript olmayan bir metodu çağırtmaz. Bu,
      // çalışma zamanı testi değil yapısal bir garantidir — burada yalnızca o
      // yapının kod tabanına girmediğini kaydediyoruz.
      const z = await h.hazirla()
      const repo = z.repo as unknown as Record<string, unknown>
      expect(repo.updateMovement).toBeUndefined()
      expect(repo.deleteMovement).toBeUndefined()
    })
  })

  describe(`I6 · Sıfır/geçersiz miktarlı hareket yazılamaz [${h.ad}]`, () => {
    test('quantity 0 reddedilir', async () => {
      const z = await h.hazirla()
      await expect(
        z.repo.postMovement(
          z.ctx,
          { stockItemId: z.lotsuzKalem, quantity: 0, uom: 'kg', reason: 'WASTE', sourceType: 'manual' },
          z.anahtar('sifir:1'),
        ),
      ).rejects.toThrow(ZeroQuantityMovementError)
    })

    // NaN/Infinity JSON.stringify'da sessizce `null`a dönüşür ve deftere anlamsız
    // bir kayıt sızdırabilirdi — 0 kontrolü tek başına yetmiyordu
    // (Codex incelemesi, 2026-08-25).
    for (const gecersiz of [NaN, Infinity, -Infinity]) {
      test(`quantity ${gecersiz} reddedilir`, async () => {
        const z = await h.hazirla()
        await expect(
          z.repo.postMovement(
            z.ctx,
            { stockItemId: z.lotsuzKalem, quantity: gecersiz, uom: 'kg', reason: 'WASTE', sourceType: 'manual' },
            z.anahtar(`gecersiz:${gecersiz}`),
          ),
        ).rejects.toThrow(ZeroQuantityMovementError)
      })
    }
  })

  describe(`I7 · Birim dönüşümü kayıpsız [${h.ad}]`, () => {
    test('kg → g → kg aynı sayıyı verir (birim yardımcı fonksiyonu)', () => {
      expect(convertUom(convertUom(2.5, 'kg', 'g'), 'g', 'kg')).toBe(2.5)
    })

    test('tanımsız dönüşüm hata verir (birim yardımcı fonksiyonu)', () => {
      expect(() => convertUom(1, 'kg', 'lt')).toThrow()
    })

    // Yukarıdaki iki test yalnızca `convertUom()`'u doğruluyor — `postMovement()`
    // bu fonksiyonu hiç çağırmasa bile geçerlerdi. Repository üzerinden uçtan
    // uca doğrulama şart (Codex incelemesi, 2026-08-25).
    test('postMovement, kalemin base_uom\'una göre gerçekten dönüşüm yapar', async () => {
      const z = await h.hazirla()
      // Kalemin base_uom'u 'kg'; 2500 g girilince quantityBase 2.5 olmalı.
      await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 2500, uom: 'g', reason: 'PURCHASE_RECEIPT', sourceType: 'goods_receipt' },
        z.anahtar('donusum:1'),
      )
      await expect(z.repo.quantityOf(z.ctx, z.lotsuzKalem)).resolves.toBe(2.5)
    })
  })

  describe(`I8 · Lot izleyen kalem lotsuz hareket alamaz [${h.ad}]`, () => {
    test('lot_id olmadan reddedilir', async () => {
      const z = await h.hazirla()
      await expect(
        z.repo.postMovement(
          z.ctx,
          { stockItemId: z.lotluKalem, quantity: 10, uom: 'kg', reason: 'PURCHASE_RECEIPT', sourceType: 'goods_receipt' },
          z.anahtar('lotsuz:1'),
        ),
      ).rejects.toThrow(LotRequiredError)
    })

    test('lot_id verilince kabul edilir', async () => {
      const z = await h.hazirla()
      await expect(
        z.repo.postMovement(
          z.ctx,
          {
            stockItemId: z.lotluKalem,
            lotId: z.lotId,
            quantity: 10,
            uom: 'kg',
            reason: 'PURCHASE_RECEIPT',
            sourceType: 'goods_receipt',
          },
          z.anahtar('lotlu:1'),
        ),
      ).resolves.toBeTruthy()
    })

    test('bilinmeyen stok kalemi reddedilir', async () => {
      const z = await h.hazirla()
      await expect(
        z.repo.postMovement(
          z.ctx,
          {
            stockItemId: '00000000-0000-0000-0000-000000000000',
            quantity: 10,
            uom: 'kg',
            reason: 'WASTE',
            sourceType: 'manual',
          },
          z.anahtar('bilinmeyen:1'),
        ),
      ).rejects.toThrow(UnknownStockItemError)
    })
  })

  describe(`I9 · Farklı tenant'ın hareketi okunamaz [${h.ad}]`, () => {
    test('bir tenant için yazılan hareket diğerinin oturumundan görünmez', async () => {
      const z = await h.hazirla()
      await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 200, uom: 'kg', reason: 'PURCHASE_RECEIPT', sourceType: 'goods_receipt' },
        z.anahtar('izolasyon:1'),
      )

      const { repo: digerRepo, ctx: digerCtx } = z.baskaTenant
      await expect(digerRepo.quantityOf(digerCtx, z.lotsuzKalem)).resolves.toBe(0)
      await expect(digerRepo.ledgerOf(digerCtx, z.lotsuzKalem)).resolves.toEqual([])
    })

    // NOT: "RLS kapatılınca test kırmızıya döner" negatif kontrolü ayrı bir
    // dosyada, gerçek iki oturumla yapılıyor: `tenant-isolation.live.test.ts`.
    // localStorage'da atlanacak bir RLS zaten yok.
  })

  describe(`I11 · occurred_at geçmişe dönük olabilir, recorded_at gerçek yazma anı [${h.ad}]`, () => {
    test('geçmiş tarihli hareket kabul edilir, recorded_at şimdiki zamana yakın olur', async () => {
      const z = await h.hazirla()
      const onGunOnce = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      const once = Date.now()

      const hareket = await z.repo.postMovement(
        z.ctx,
        {
          stockItemId: z.lotsuzKalem,
          quantity: 5,
          uom: 'kg',
          reason: 'OPENING_BALANCE',
          sourceType: 'manual',
          occurredAt: onGunOnce,
        },
        z.anahtar('gecmis:1'),
      )

      expect(hareket.occurredAt.getTime()).toBe(onGunOnce.getTime())
      // Sunucu saati ile istemci saati birebir aynı olmayabilir; bir dakikalık
      // pay bırakılıyor. Kanıtlanmak istenen şey saatin doğruluğu değil,
      // recorded_at'in occurred_at'ten BAĞIMSIZ ve yazma anına ait olmasıdır.
      expect(hareket.recordedAt.getTime()).toBeGreaterThan(onGunOnce.getTime())
      expect(hareket.recordedAt.getTime()).toBeGreaterThanOrEqual(once - 60_000)
      expect(hareket.recordedAt.getTime()).toBeLessThanOrEqual(Date.now() + 60_000)
    })
  })

  describe(`I12 · Negatif bakiye politikası (allow/warn/block) [${h.ad}]`, () => {
    test('block: bakiyeyi negatife düşüren hareket reddedilir, defter değişmez', async () => {
      const z = await h.hazirla('block')
      await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 10, uom: 'kg', reason: 'PURCHASE_RECEIPT', sourceType: 'goods_receipt' },
        z.anahtar('i12:block:giris'),
      )

      await expect(
        z.repo.postMovement(
          z.ctx,
          { stockItemId: z.lotsuzKalem, quantity: -15, uom: 'kg', reason: 'PRODUCTION_CONSUME', sourceType: 'work_order' },
          z.anahtar('i12:block:cikis'),
        ),
      ).rejects.toThrow(NegativeBalanceBlockedError)

      // Reddedilen hareket deftere hiç yazılmadı.
      await expect(z.repo.quantityOf(z.ctx, z.lotsuzKalem)).resolves.toBe(10)
    })

    test('warn: hareket kabul edilir, dönen Movement.warning doludur', async () => {
      const z = await h.hazirla('warn')
      await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 10, uom: 'kg', reason: 'PURCHASE_RECEIPT', sourceType: 'goods_receipt' },
        z.anahtar('i12:warn:giris'),
      )

      const sonuc = await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: -15, uom: 'kg', reason: 'PRODUCTION_CONSUME', sourceType: 'work_order' },
        z.anahtar('i12:warn:cikis'),
      )

      expect(sonuc.warning).toBeTruthy()
      await expect(z.repo.quantityOf(z.ctx, z.lotsuzKalem)).resolves.toBe(-5)
    })

    test('allow: hareket sessizce kabul edilir, warning yok', async () => {
      const z = await h.hazirla('allow')
      const sonuc = await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: -20, uom: 'kg', reason: 'WASTE', sourceType: 'manual' },
        z.anahtar('i12:allow:cikis'),
      )

      expect(sonuc.warning).toBeUndefined()
      await expect(z.repo.quantityOf(z.ctx, z.lotsuzKalem)).resolves.toBe(-20)
    })

    test('bakiyeyi negatife düşürmeyen hareket, politika ne olursa olsun kabul edilir', async () => {
      const z = await h.hazirla('block')
      await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 10, uom: 'kg', reason: 'PURCHASE_RECEIPT', sourceType: 'goods_receipt' },
        z.anahtar('i12:pozitif'),
      )
      await expect(z.repo.quantityOf(z.ctx, z.lotsuzKalem)).resolves.toBe(10)
    })

    test('reverseMovement, bakiyeyi NEGATİFE düşürse bile block altında izinlidir (I3 > I12)', async () => {
      // Bu testin ilk hâli yanlış pozitifti: +10 yazıp tersliyor, bakiye 0
      // oluyordu. 0 negatif olmadığı için muafiyet KALDIRILMIŞ olsa bile test
      // geçerdi (Codex incelemesi, 2026-08-26).
      //   +10 → 10 · -8 → 2 (block altında meşru) · +10'u tersle → -8
      const z = await h.hazirla('block')

      const giris = await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 10, uom: 'kg', reason: 'PURCHASE_RECEIPT', sourceType: 'goods_receipt' },
        z.anahtar('i12:ters:giris'),
      )
      await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: -8, uom: 'kg', reason: 'PRODUCTION_CONSUME', sourceType: 'work_order' },
        z.anahtar('i12:ters:tuketim'),
      )
      await expect(z.repo.quantityOf(z.ctx, z.lotsuzKalem)).resolves.toBe(2)

      await expect(
        z.repo.reverseMovement(z.ctx, giris.id, z.anahtar('i12:ters:1')),
      ).resolves.toBeTruthy()

      // Muafiyetin işlediğinin kanıtı: bakiye negatife düştü.
      await expect(z.repo.quantityOf(z.ctx, z.lotsuzKalem)).resolves.toBe(-8)
    })

    test('tam sıfır sınırı: bakiyeyi tam 0 yapan hareket block altında bile kabul edilir', async () => {
      // Sınır koşulu: kontrol `< 0` olmalı, `<= 0` değil — stoğu tam bitirmek meşrudur.
      const z = await h.hazirla('block')
      await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 10, uom: 'kg', reason: 'PURCHASE_RECEIPT', sourceType: 'goods_receipt' },
        z.anahtar('i12:sifir:giris'),
      )
      await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: -10, uom: 'kg', reason: 'PRODUCTION_CONSUME', sourceType: 'work_order' },
        z.anahtar('i12:sifir:cikis'),
      )
      await expect(z.repo.quantityOf(z.ctx, z.lotsuzKalem)).resolves.toBe(0)
    })

    test('politika kontrolü DÖNÜŞTÜRÜLMÜŞ miktara bakar, girilen miktara değil', async () => {
      // base_uom 'kg'. Bakiye 0.4 kg iken -500 g → -0.1 kg, reddedilmeli.
      // Kontrol ham `quantity` (-500) kullansaydı bu test yakalardı.
      const z = await h.hazirla('block')
      await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 400, uom: 'g', reason: 'PURCHASE_RECEIPT', sourceType: 'goods_receipt' },
        z.anahtar('i12:uom:giris'),
      )
      await expect(z.repo.quantityOf(z.ctx, z.lotsuzKalem)).resolves.toBeCloseTo(0.4)

      await expect(
        z.repo.postMovement(
          z.ctx,
          { stockItemId: z.lotsuzKalem, quantity: -500, uom: 'g', reason: 'PRODUCTION_CONSUME', sourceType: 'work_order' },
          z.anahtar('i12:uom:cikis'),
        ),
      ).rejects.toThrow(NegativeBalanceBlockedError)
    })

    test('warning KALICI DEĞİLDİR: ledgerOf onu geri döndürmez', async () => {
      // `Movement.warning` yazma anına ait bir ekran ipucudur, defterin parçası
      // değildir. LocalStorage tüm nesneyi sakladığı için onda kalıcı oluyordu,
      // Postgres'te olmuyordu — aynı sözleşmeden geçmesi gereken iki uygulamada
      // kabul edilemez bir sapma (Codex incelemesi, 2026-08-26).
      const z = await h.hazirla('warn')
      const yazilan = await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: -5, uom: 'kg', reason: 'WASTE', sourceType: 'manual' },
        z.anahtar('i12:warning:kalici-degil'),
      )
      expect(yazilan.warning).toBeTruthy()

      const defter = await z.repo.ledgerOf(z.ctx, z.lotsuzKalem)
      expect(defter).toHaveLength(1)
      expect(defter[0].warning).toBeUndefined()
    })
  })

  describe(`Lot bakiyeleri ve defter dökümü (arayüzün diğer metotları) [${h.ad}]`, () => {
    test('lotBalances bir lotun toplam bakiyesini verir', async () => {
      const z = await h.hazirla()
      await z.repo.postMovement(
        z.ctx,
        {
          stockItemId: z.lotluKalem,
          lotId: z.lotId,
          quantity: 30,
          uom: 'kg',
          reason: 'PURCHASE_RECEIPT',
          sourceType: 'goods_receipt',
        },
        z.anahtar('lot-bakiye:1'),
      )

      const bakiyeler = await z.repo.lotBalances(z.ctx, z.lotluKalem)
      const bizim = bakiyeler.find(b => b.lotId === z.lotId)
      expect(bizim?.qty).toBe(30)
    })

    test('ledgerOf hareketleri occurred_at sırasıyla döndürür', async () => {
      const z = await h.hazirla()
      const eski = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      const yeni = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)

      // Bilerek TERS sırada yazılıyor: sıralama yazma sırasına değil,
      // occurred_at'e göre olmalı.
      await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 5, uom: 'kg', reason: 'OPENING_BALANCE', sourceType: 'manual', occurredAt: yeni },
        z.anahtar('defter:yeni'),
      )
      await z.repo.postMovement(
        z.ctx,
        { stockItemId: z.lotsuzKalem, quantity: 3, uom: 'kg', reason: 'OPENING_BALANCE', sourceType: 'manual', occurredAt: eski },
        z.anahtar('defter:eski'),
      )

      const defter = await z.repo.ledgerOf(z.ctx, z.lotsuzKalem)
      expect(defter).toHaveLength(2)
      expect(defter[0].quantityBase).toBe(3)
      expect(defter[1].quantityBase).toBe(5)
    })
  })
}
