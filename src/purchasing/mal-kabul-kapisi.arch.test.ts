// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — MAL KABUL KAPISI İKİ YERDE AYNI
//
// ── NEDEN VAR (05.11.2026) ───────────────────────────────────────────────
// Mal kabul kapısı İKİ yerde duruyor ve bu bilinçli:
//   · `db/migrations/0088_kalan_yirmi_alti_tablo.sql` — asıl kapı.
//     `goods_receipt` · `goods_receipt_line` · `supplier_return` ·
//     `supplier_return_line` dördü de `["purchase.write","stock.write"]`.
//   · `src/authorization/yazma-yetkisi.ts > MAL_KABUL_IZINLERI` — o kapının
//     ekrandaki yüzü.
//
// ⚠️ 05.11'e kadar İKİSİ AYRIŞMIŞTI ve kurban **DEPO SORUMLUSU**'ydu.
// `PurchaseFlow` ekranının bütün yazma yüzeyi `purchase.write`e bağlıydı;
// depo sorumlusunda o izin YOK (`purchase.read` var, write yok). Yani
// "Mal Kabul Yap" düğmesini hiç göremiyordu.
//
// Üç kaynaktan ikisi aynı şeyi söylüyordu, ekran tek başına ayrı düştü:
//   · göç **0080** (30.10): *"MAL KABUL DEPO SORUMLUSUNUN İŞİDİR."*
//   · göç **0088**: veritabanı `stock.write` ile buna izin veriyor.
//   · ekran: `purchase.write` yoksa düğme yok.
// Yani ekran, rolün ASIL İŞİNİ yaptırmıyordu.
//
// ⚠️ Bu kapı YENİ BİR YETKİ VERMİYOR: `stock.write` zaten vardı, veritabanı
// zaten kabul ediyordu. Değişen tek şey ekranın aynı cevabı vermesi.
//
// ⚠️ NE DEĞİŞMEDİ: talep açma, sipariş açma ve sipariş durumunu ilerletme
// hâlâ YALNIZ `purchase.write`. Mal kabul etmek ile tedarikçiye sipariş
// geçmek ayrı iki yetkidir. Bu test o ayrımın korunduğunu da ölçüyor —
// yoksa "kapıyı hizala" diye mutfak personeline sipariş açtırabilirdik.
//
// ⚠️ SAYMAK DEĞİL ÖLÇMEK: beklenen liste göç dosyasından AYRIŞTIRILIYOR,
// elle kopyalanmıyor (`numune-kapisi.arch.test.ts` ile aynı kalıp).
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'
import { yorumsuzKod } from '../core/test-support/kaynak-soyma'
import { MAL_KABUL_IZINLERI } from '../authorization/yazma-yetkisi'

const KOK = projeKokunuBul()
const GOC_0088 = readFileSync(
  join(KOK, 'db/migrations/0088_kalan_yirmi_alti_tablo.sql'), 'utf8') as string
const EKRAN = yorumsuzKod(
  readFileSync(join(KOK, 'src/pages/PurchaseFlow.tsx'), 'utf8') as string)

/** Göçteki `'tablo', '["a","b"]'` satırından izin adlarını çıkarır. */
export const gocIzinleri = (sql: string, tablo: string): string[] => {
  const desen = new RegExp(`'${tablo}',\\s*'(\\[[^\\]]*\\])'`)
  const ham = desen.exec(sql)?.[1]
  if(!ham) return []
  return [...ham.matchAll(/"([a-z_.]+)"/g)].map(m => m[1] as string).sort()
}

const MAL_KABUL_TABLOLARI = [
  'goods_receipt', 'goods_receipt_line', 'supplier_return', 'supplier_return_line',
] as const

describe('mal kabul kapısı · ekran ile veritabanı aynı', () => {
  it('sağlama · ayrıştırıcı göçten GERÇEKTEN liste çıkarıyor', () => {
    // Bu olmadan, desen bozulup her tabloya `[]` dönse alttaki sınamalar
    // "ikisi de boş, demek ki aynı" diye YEŞİL kalırdı.
    expect(gocIzinleri(GOC_0088, 'goods_receipt')).toHaveLength(2)
    expect(gocIzinleri('x', 'goods_receipt'), 'olmayan tabloda da bir şey buluyor')
      .toEqual([])
  })

  it('⚠️ dört tablonun dördü de AYNI izin çiftini istiyor', () => {
    const beklenen = [...MAL_KABUL_IZINLERI].sort()
    for(const tablo of MAL_KABUL_TABLOLARI){
      expect(
        gocIzinleri(GOC_0088, tablo),
        `${tablo} göçte başka bir izin çifti istiyor:\n`
        + `göç   : ${gocIzinleri(GOC_0088, tablo).join(', ')}\n`
        + `ekran : ${beklenen.join(', ')}`,
      ).toEqual(beklenen)
    }
  })

  it('⚠️ ekran mal kabulü O kapıya bağlıyor, `purchase.write`e DEĞİL', () => {
    expect(EKRAN, 'ekran ortak listeyi hiç kullanmıyor')
      .toMatch(/herhangiBiriyleYazabilir\(currentUser, MAL_KABUL_IZINLERI\)/)
    expect(EKRAN, '"Mal Kabul Yap" düğmesi hâlâ tek izne bağlı')
      .toMatch(/\{malKabulYapabilir && malBekleniyor && \(/)
  })

  it('⚠️ talep ve sipariş AÇMA hâlâ yalnız `purchase.write`', () => {
    // Kapıyı hizalarken fazladan yetki vermediğimizin ölçüsü.
    expect(EKRAN).toMatch(/const yazabilir = yazabilirMi\(currentUser, 'purchase\.write'\)/)
    expect(
      EKRAN,
      'Yeni Talep / Yeni Sipariş düğmesi mal kabul kapısına kaymış: '
      + 'mutfak personeli tedarikçiye sipariş geçebilir hâle gelir.',
    ).toMatch(/\{yazabilir && \(sekme === 'talepler' \|\| sekme === 'siparisler'\) && \(/)
  })

  it('⚠️ `stock.write` kapıda GERÇEKTEN kabul ediliyor (negatif denetim)', () => {
    expect(MAL_KABUL_IZINLERI).toContain('stock.write')
    expect(MAL_KABUL_IZINLERI).toContain('purchase.write')
    expect(MAL_KABUL_IZINLERI, 'kapı sessizce genişlemiş').toHaveLength(2)
  })
})
