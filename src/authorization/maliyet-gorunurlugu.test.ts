import { describe, expect, it } from 'vitest'
import {
  maliyetGorebilir, MALIYET_IZNI, MALIYET_GIZLI, MALIYET_GIZLI_ACIKLAMA,
} from './maliyet-gorunurlugu'
import type { User } from '../types'

/**
 * Bu testler bir SÖZÜ koruyor. Yetki ekranında müşteriye şunlar yazılı:
 *   Depo Sorumlusu   — "Fiyat ve maliyet GÖRMEZ."
 *   Üretim Sorumlusu — "Fiyat GÖRMEZ."
 *   Satın Alma       — "...alış fiyatını görür."
 * Codex denetimi (12.10) sözün tutulmadığını gösterdi. Aşağıdakiler
 * tutulduğunu sınıyor.
 */
const kisi = (izinler?: string[]): User => ({
  id: 'u1', fullName: 'Test', username: 'test',
  role: 'Personel', active: true,
  ...(izinler === undefined ? {} : { permissions: izinler }),
}) as User

// Veritabanından okunan GERÇEK izin listeleri (13.10.2026).
const DEPO = ['dashboard.read', 'stock.read', 'stock.write', 'logistics.read',
  'logistics.write', 'purchase.read', 'production.read', 'quality.read',
  'recipe.read', 'branch.read', 'products.read']
const SATINALMA = ['dashboard.read', 'purchase.read', 'purchase.write',
  'finance.read', 'finance.write', 'stock.read', 'products.read']

describe('maliyetGorebilir', () => {
  it('⚠️ depo sorumlusu maliyeti GÖRMEZ — ekranda yazan söz bu', () => {
    expect(maliyetGorebilir(kisi(DEPO))).toBe(false)
  })

  it('satın alma sorumlusu alış fiyatını GÖRÜR', () => {
    expect(maliyetGorebilir(kisi(SATINALMA))).toBe(true)
  })

  it('⚠️ `purchase.read` tek başına fiyat açmıyor', () => {
    // Depo sorumlusunun da `purchase.read` izni var; ayıran şey finans izni.
    expect(maliyetGorebilir(kisi(['purchase.read']))).toBe(false)
  })

  it('⚠️ izin listesi YOKSA kapalı tarafta durur', () => {
    // Menü ve rota kapılarının TERSİ. Oradaki risk birini kilitlemek;
    // burada risk, görmemesi gereken kişiye parayı GÖSTERMEK.
    expect(maliyetGorebilir(kisi(undefined))).toBe(false)
    expect(maliyetGorebilir(null)).toBe(false)
    expect(maliyetGorebilir(undefined)).toBe(false)
  })

  it('boş izin listesi de kapalı', () => {
    expect(maliyetGorebilir(kisi([]))).toBe(false)
  })

  it('izin adı tek yerde yazılı', () => {
    expect(MALIYET_IZNI).toBe('finance.read')
    expect(maliyetGorebilir(kisi([MALIYET_IZNI]))).toBe(true)
  })

  it('⚠️ gizleme metni "veri yok" demiyor, "yetki yok" diyor', () => {
    // Boş çizgi bırakmak, kişiyi olmayan bir eksiği aramaya gönderir:
    // depocu "maliyet girilmemiş" sanıp girmeye çalışır.
    expect(MALIYET_GIZLI).toBe('yetki yok')
    // Açıklama SEBEBİ söylüyor ve bir yol gösteriyor…
    expect(MALIYET_GIZLI_ACIKLAMA).toContain('gizlendi')
    expect(MALIYET_GIZLI_ACIKLAMA).toContain('yöneticinizden')
    // …ama "veri yok" izlenimi VERMİYOR.
    expect(MALIYET_GIZLI_ACIKLAMA).not.toContain('girilmemiş')
    expect(MALIYET_GIZLI_ACIKLAMA).not.toContain('veri yok')
    // ⚠️ Kullanıcıya izin KODU gösterilmiyor; 'finance.read' bir iç addır.
    expect(MALIYET_GIZLI_ACIKLAMA).not.toContain('finance.read')
  })
})
