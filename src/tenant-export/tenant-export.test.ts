// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 — Kiracı dışa aktarma testleri
//
// En kritik iddia: DOSYA EKSİKSE BUNU SÖYLER. Sessizce eksik yedek üretmek,
// yedeği hiç almamaktan tehlikelidir — çünkü kullanıcı yedeği olduğunu sanır
// ve ihtiyaç anında öğrenir.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import type { TenantCtx } from '../core/context'
import {
  DISA_AKTARILAN_TABLOLAR, boyutOku, dosyaAdi, kiraciyiDisaAktar, kunyeOzeti,
} from './tenant-export'

const ctx: TenantCtx = { tenantId: 'tenant-1234-5678', branchId: 'branch-1', userId: 'u1' }

/**
 * Sahte Supabase istemcisi. Yalnızca `from().select().range()` zincirini
 * taklit ediyor; dışa aktarmanın kullandığı tek yüzey bu.
 */
const sahteClient = (
  tablolar: Record<string, unknown[]>,
  hatalar: Record<string, { code?: string; message: string }> = {},
) => ({
  from(tablo: string){
    return {
      select(){
        return {
          async range(bas: number, son: number){
            if(hatalar[tablo]) return { data: null, error: hatalar[tablo] }
            const hepsi = tablolar[tablo] ?? []
            return { data: hepsi.slice(bas, son + 1), error: null }
          },
        }
      },
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any

describe('Kiracı dışa aktarma', () => {
  it('bütün tabloları okuyor ve künyeye yazıyor', async () => {
    const sonuc = await kiraciyiDisaAktar(sahteClient({
      stock_item: [{ id: 'k1' }, { id: 'k2' }],
      stock_movement: [{ id: 'h1' }],
    }), ctx)

    expect(sonuc.veri.stock_item).toHaveLength(2)
    expect(sonuc.veri.stock_movement).toHaveLength(1)
    expect(sonuc.kunye.toplamSatir).toBe(3)
    expect(sonuc.kunye.tablolar).toHaveLength(DISA_AKTARILAN_TABLOLAR.length)
  })

  it('BİN SATIRDAN fazlasını sayfalayarak alıyor', async () => {
    // PostgREST tek sorguda 1000 satır döner. Sayfalamasaydık defterin
    // yalnızca ilk 1000 hareketi yedeklenir, gerisi sessizce kaybolurdu.
    const cokSatir = Array.from({ length: 2500 }, (_, i) => ({ id: `h${i}` }))
    const sonuc = await kiraciyiDisaAktar(sahteClient({ stock_movement: cokSatir }), ctx)

    expect(sonuc.veri.stock_movement).toHaveLength(2500)
    expect(sonuc.kunye.toplamSatir).toBe(2500)
  })

  it('tam bin satırda durmuyor — sınırdaki hata', async () => {
    // Dilim tam 1000 gelirse "belki daha var" denip devam edilmeli.
    const tamBin = Array.from({ length: 1000 }, (_, i) => ({ id: `h${i}` }))
    const sonuc = await kiraciyiDisaAktar(sahteClient({ stock_movement: tamBin }), ctx)
    expect(sonuc.veri.stock_movement).toHaveLength(1000)
  })

  it('OLMAYAN tablo dosyayı eksik saymıyor — kurulum farkı meşrudur', async () => {
    const sonuc = await kiraciyiDisaAktar(
      sahteClient({ stock_item: [{ id: 'k1' }] }, { recipe: { code: '42P01', message: 'yok' } }),
      ctx,
    )
    expect(sonuc.kunye.eksikTablolar).toEqual([])
    expect(sonuc.kunye.uyari).toBeUndefined()
    expect(sonuc.kunye.tablolar.find(t => t.tablo === 'recipe')?.atlandi)
      .toBe('Bu kurulumda tablo yok')
  })

  it('OKUNAMAYAN tablo dosyayı EKSİK damgalıyor', async () => {
    // İzin hatası, ağ hatası, RLS reddi… Sebebi ne olursa olsun kullanıcı
    // bu dosyayı yedek sanmamalı.
    const sonuc = await kiraciyiDisaAktar(
      sahteClient({ stock_item: [{ id: 'k1' }] },
        { stock_movement: { code: '42501', message: 'permission denied' } }),
      ctx,
    )
    expect(sonuc.kunye.eksikTablolar).toContain('stock_movement')
    expect(sonuc.kunye.uyari).toContain('EKSİKTİR')
  })

  it('eksik tablo veri bölümüne BOŞ DİZİ olarak da yazılmıyor', async () => {
    // Boş dizi "bu tabloda veri yok" demektir. Okunamamış tabloyu boş
    // göstermek, yanlış bir gerçeği belgelemek olurdu.
    const sonuc = await kiraciyiDisaAktar(
      sahteClient({}, { stock_movement: { code: '42501', message: 'permission denied' } }),
      ctx,
    )
    expect(sonuc.veri.stock_movement).toBeUndefined()
  })

  it('künye dosyanın NE OLMADIĞINI da söylüyor', async () => {
    const sonuc = await kiraciyiDisaAktar(sahteClient({}), ctx)
    expect(sonuc.kunye.aciklama).toContain('pg_dump')
    expect(sonuc.kunye.aciklama).toContain('YOKTUR')
  })

  it('referans tabloları dışa aktarılmıyor', async () => {
    // uom, permission, role… ürünün kendi tanımları. Geri yüklerken güncel
    // tanımları eskiye döndürme riski taşırlar.
    const liste: readonly string[] = DISA_AKTARILAN_TABLOLAR
    expect(liste).not.toContain('uom')
    expect(liste).not.toContain('permission')
    expect(liste).not.toContain('role_permission')
  })

  it('sıralama üst kayıtları önce alıyor', async () => {
    const liste: readonly string[] = DISA_AKTARILAN_TABLOLAR
    expect(liste.indexOf('stock_item')).toBeLessThan(liste.indexOf('stock_lot'))
    expect(liste.indexOf('stock_lot')).toBeLessThan(liste.indexOf('stock_movement'))
    expect(liste.indexOf('stock_count')).toBeLessThan(liste.indexOf('stock_count_line'))
    expect(liste.indexOf('shipment')).toBeLessThan(liste.indexOf('shipment_line'))
  })

  it('denetim kaydı da yedeğe giriyor', async () => {
    const liste: readonly string[] = DISA_AKTARILAN_TABLOLAR
    expect(liste).toContain('audit_log')
  })

  it('ilerleme bildirimi her tablo için çağrılıyor', async () => {
    const gorulen: string[] = []
    await kiraciyiDisaAktar(sahteClient({}), ctx, t => gorulen.push(t))
    expect(gorulen).toHaveLength(DISA_AKTARILAN_TABLOLAR.length)
    expect(gorulen[0]).toBe('tenant')
  })
})

describe('Dosya adı ve boyut', () => {
  it('dosya adı tarih ve saat taşıyor — üst üste yazmaz', () => {
    const ad = dosyaAdi('abcdef12-3456', new Date('2026-09-13T08:30:45Z'))
    expect(ad).toBe('miyop-yedek-abcdef12-2026-09-13-08-30-45.json')
  })

  it('boyut insan diliyle yazılıyor', () => {
    expect(boyutOku('x'.repeat(500))).toBe('500 B')
    expect(boyutOku('x'.repeat(2048))).toBe('2.0 KB')
  })
})

describe('Künye özeti', () => {
  it('dolu, boş ve atlanan tabloları ayrı sayıyor', () => {
    const satirlar = kunyeOzeti({
      aciklama: '', bicimSurumu: 1, olusturmaZamani: '', kiracıId: 't1',
      toplamSatir: 5, eksikTablolar: [],
      tablolar: [
        { tablo: 'a', satir: 5 },
        { tablo: 'b', satir: 0 },
        { tablo: 'c', satir: 0, atlandi: 'yok' },
      ],
    })
    expect(satirlar[0]).toContain('5 satır')
    expect(satirlar[0]).toContain('1 dolu tablo')
    expect(satirlar[1]).toContain('1 tablo boş')
    expect(satirlar[2]).toContain('1 tablo atlandı')
  })
})
