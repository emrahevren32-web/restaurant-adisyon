// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — AYRINTI KAPISI ALTI EKRANA DA TAKILACAK
//
// ── NEDEN VAR (A3 · MIYOP-010 + MIYOP-064) ───────────────────────────────
// Codex aynı kusuru altı ekranda buldu: seçim hemen değişiyor, ayrıntı
// istekler dönünce yazılıyor; arada ekranda **yeni kaydın adı, eski kaydın
// ayrıntısı** duruyor ve o hâlde kaydedilebiliyor/yazdırılabiliyor.
//
// ⚠️ Tek ekrana yama atmak aileyi kapatmaz. Bu test iki şeyi birden yapıyor:
//   1. Kapısı TAKILMIŞ ekranların kapıyı gerçekten kullandığını ölçüyor.
//   2. Kapısı TAKILMAMIŞ ekranları **adlarıyla donduruyor** — liste yalnız
//      KISALABİLİR. Yani kalan iş görünür ve sayılabilir; bir ekran
//      dönüştürülünce testi kırmızıya düşürür ve listeden çıkarılmaya
//      zorlar. Yapılacak işi belgeye değil TESTE yazmak (tuzak 139).
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../test-support/goc-tarama'

const KOK = projeKokunuBul()
const ekran = (ad: string) => readFileSync(join(KOK, 'src/pages', ad), 'utf8') as string

/** Kapı takılmış ekranlar. Bu liste yalnız UZAR. */
const KAPISI_TAKILI = [
  'Etiketler.tsx',
  'Warehouse.tsx',
  'Siparisler.tsx',
  'Sevkiyatlar.tsx',
  'Musteriler.tsx',
  'WorkOrders.tsx',
  'Traceability.tsx',
] as const

/**
 * Kapı HENÜZ takılmamış ekranlar. ⚠️ Bu liste yalnız KISALIR.
 * Codex'in MIYOP-064'te adıyla işaret ettiği ekranlar + geç cevap koruması
 * olmayan izlenebilirlik ekranı.
 */
const KAPISI_YOK = [] as const

const KAPI_IZI = /from '\.\.\/core\/secim\/ayrinti-kapisi'/

describe('ayrıntı kapısı · ekranlara takılması', () => {
  it('sağlama: bütün ekranlar okunuyor', () => {
    for(const ad of [...KAPISI_TAKILI, ...KAPISI_YOK]){
      expect(ekran(ad).length, `${ad} okunamadı`).toBeGreaterThan(1000)
    }
  })

  it('⚠️ kapısı takılı ekranlar kapıyı GERÇEKTEN kullanıyor', () => {
    for(const ad of KAPISI_TAKILI){
      const m = ekran(ad)
      expect(m, `${ad} ayrıntı kapısını içeri almıyor`).toMatch(KAPI_IZI)

      // 1. Seçim anında ayrıntı düşüyor mu?
      expect(m, `${ad} seçimde \`secildi()\` çağırmıyor`).toMatch(/secildi\(/)

      // 2. Geç gelen cevap atılıyor mu? (asıl tuzak)
      // ⚠️ KURALI ÖLÇ, YAZIMI DEĞİL. İki biçim de geçerli: erken dönüş
      // (`!==` ile at) ya da korumalı yazım (`===` ise yaz). Sevkiyatlar
      // ikincisini kullanıyor çünkü yazım bir `useEffect` içinde ve `iptal`
      // bayrağıyla birlikte duruyor. Testin tek bir yazım biçimini dayatması,
      // doğru çözümü reddetmek olurdu.
      expect(
        m,
        `${ad} geç gelen cevabı atmıyor — hızlı A→B seçiminde A'nın cevabı `
        + `B'nin ayrıntısını ezebilir.`,
      ).toMatch(/secilenRef\.current\s*[!=]==/)

      // 3. Yazma/yazdırma düğmeleri ayrıntı hazır değilken kapalı mı?
      // ⚠️ Yine kural ölçülüyor: `disabled` ifadesi kapıya BAKIYOR mu.
      // `!ayrintiHazir(secim)` de olur, alt bileşene geçirilen
      // `!ayrintiHazirMi` de — Sevkiyatlar'da düğmeler alt bileşende.
      expect(
        m, `${ad} düğmeleri \`ayrintiHazir\` ile kapatmıyor`,
      ).toMatch(/disabled=\{[^}]*ayrintiHazir/)

      // 4. Kapı yalnız düğmede değil, eylemin GÖVDESİNDE de duruyor mu?
      expect(
        m, `${ad} yazma gövdesinde kapı yok — düğmeyi atlayan bir yol kaydı bozar`,
      ).toMatch(/ayrintiBekliyorMu\(\)/)

      // 5. Sebep ekranda yazılı mı? (tuzak 126)
      expect(
        m, `${ad} düğmenin neden kapalı olduğunu yazmıyor`,
      ).toMatch(/ayrintiBeklemeSebebi\(/)
    }
  })

  it('⚠️ DONDURULMUŞ LİSTE BOŞ · A3 kapandı (29.10)', () => {
    // Liste 6 → 5 → 4 → 3 → 2 → 0 diye kısaldı ve bitti. Artık boş kalmalı:
    // yeni bir "solda liste, sağda ayrıntı" ekranı eklenirse kapı da onunla
    // birlikte eklenir, buraya borç yazılmaz.
    expect(
      KAPISI_YOK as readonly string[],
      'Liste yeniden doldurulmuş — kapısız bir liste+ayrıntı ekranı eklenmiş. '
      + 'Yeni ekran kapıyla birlikte gelir; buraya borç yazılmaz.',
    ).toEqual([])
    // ⚠️ Tavan yalnız AŞAĞI gider: 6 → 5 (Warehouse) → 4 (Siparişler).
    // Her ekran kapatıldığında burası da küçülür ve kalan iş tek bakışta
    // sayılır.
    expect(KAPISI_TAKILI.length, 'kapı takılı ekran sayısı azalmış')
      .toBeGreaterThanOrEqual(7)
  })

  it('iki liste ÇAKIŞMIYOR', () => {
    const kesisim = KAPISI_TAKILI.filter(ad => (KAPISI_YOK as readonly string[]).includes(ad))
    expect(kesisim, 'aynı ekran iki listede').toEqual([])
  })

  it('kapı modülü saf kalıyor · React ya da istek sızmamış', () => {
    // ⚠️ Kapının değeri SAF olmasından geliyor: yedi ekran aynı kararı
    // paylaşıyor ve karar testle donduruldu. İçine bir `useState` ya da bir
    // sorgu girdiği gün, karar ekrana geri taşınmış olur.
    const kapi = readFileSync(
      join(KOK, 'src/core/secim/ayrinti-kapisi.ts'), 'utf8') as string
    expect(kapi, 'kapıya React sızmış').not.toMatch(/from 'react'/)
    expect(kapi, 'kapıya istek sızmış').not.toMatch(/supabase|fetch\(/)
  })
})
