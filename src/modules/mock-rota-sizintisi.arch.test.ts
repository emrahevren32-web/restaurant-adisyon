// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — AÇIK BİR ROTA UYDURMA VERİYE ULAŞAMAZ
//
// Emrah'ın kuralı: "Mock veri asla ama asla olmayacak."
//
// Bu kuralı yorumla tutmak iki kez yetmedi:
//
//   1) Raporlama'nın yedi ekranı `ra_recipes='[]'` iken bile 58 reçete
//      gösteriyordu — veriyi okumuyor, ÜRETİYORLARDI.
//   2) 2026-10-14: eski lojistik üçlüsü, Karar Destek'in on ekranı,
//      Bildirim Merkezi ve Personel'in sekiz ekranı menüde GÖRÜNMÜYORDU
//      ama ROTALARI AÇIKTI. Adres çubuğuna yazan kişi, tohumunu kendi
//      üretip localStorage'a yazan ekranlar buluyordu.
//
// İkisinin de dersi aynı: **menüde görünmemek, kapalı olmak değildir.**
// Kapalılığın tek ölçüsü `getCoreWorkspaceRoutes()`.
//
// Bu yüzden test menüye değil ROTAYA bakar ve rotanın açtığı sayfadan
// başlayıp BÜTÜN içe aktarma zincirini yürür. Sayfanın kendisi temiz
// görünüp üçüncü basamakta bir `.mock` modülüne bağlanıyorsa ekran yine
// uydurma veri gösteriyor demektir — nitekim Karar Destek'in on ekranı
// tam böyleydi: hepsi `kpi-reporting/kpi-source.service.ts`e bağlıydı ve
// o dosya YİRMİ SEKİZ ayrı `.mock` modülünden besleniyor.
//
// ⚠️ EN KÖTÜ SONUÇ "HİÇ DOSYA BULAMADIM" DEYİP YEŞİL GEÇMEKTİR (tuzak 58).
// Üç sağlama var: kök bulunamazsa patlar · bilinen rotalar eşlenemezse
// patlar · zincir bir yerde çözülemezse patlar.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'
import { getCoreWorkspaceRoutes } from './business-workspace.registry'

const KOK = projeKokunuBul()
const SRC = join(KOK, 'src')

/** src altındaki bütün TS/TSX dosyaları: tam yol → içerik. */
const dosyalar = ((): Map<string, string> => {
  const harita = new Map<string, string>()
  const yurut = (dizin: string) => {
    for(const ad of readdirSync(dizin) as string[]){
      const tam = join(dizin, ad)
      if(statSync(tam).isDirectory()){ yurut(tam); continue }
      if(/\.tsx?$/.test(ad)) harita.set(resolve(tam), readFileSync(tam, 'utf8') as string)
    }
  }
  yurut(SRC)
  return harita
})()

/** Çözülmesi beklenmeyen uzantılar (stil, veri, görsel). */
const KODDISI = /\.(css|scss|sass|less|json|svg|png|jpe?g|gif|webp|woff2?|ttf|md|txt)$/

/**
 * Göreli içe aktarmayı dosya yoluna çevirir.
 * `null` → göreli değil ya da kod değil. `undefined` → ÇÖZÜLEMEDİ.
 */
const coz = (kaynak: string, spec: string): string | null | undefined => {
  if(!spec.startsWith('.')) return null
  if(KODDISI.test(spec)) return null
  const temel = resolve(dirname(kaynak), spec)
  for(const son of ['.ts', '.tsx', '/index.ts', '/index.tsx']){
    if(dosyalar.has(temel + son)) return temel + son
  }
  return dosyalar.has(temel) ? temel : undefined
}

const kisaYol = (tam: string) => tam.slice(KOK.length + 1).replace(/\\/g, '/')

// ── Rota → sayfa dosyası, ROTA SUNUCUSUNDAN okunuyor ────────────────────
//
// İki içe aktarma biçimi de var: düz `import X from` ve
// `const X = React.lazy(() => import(...))` (18 tanesi öyle).
//
// ⚠️ Rotalar bazen bir çerçeveyle sarılı dönüyor:
//   `return <DecisionRouteFrame route={route}><AIAnalysis .../></...>`
// Yalnız ilk bileşeni almak, bu on üç rotayı SESSİZCE taramanın dışında
// bırakıyordu. O yüzden bloktaki BÜTÜN bileşen adlarına bakılıyor.
const HOST = resolve(join(SRC, 'modules', 'BusinessWorkspaceRouteHost.tsx'))
const hostIcerik = dosyalar.get(HOST)
if(!hostIcerik) throw new Error(
  'BusinessWorkspaceRouteHost.tsx okunamadı; bu test onun metnine dayanıyor.',
)

const bilesenYolu = new Map<string, string>()
for(const m of hostIcerik.matchAll(/import\s+(\w+)\s+from\s+'([^']+)'/g)){
  const yol = coz(HOST, m[2])
  if(typeof yol === 'string') bilesenYolu.set(m[1], yol)
}
for(const m of hostIcerik.matchAll(
  /const\s+(\w+)\s*=\s*React\.lazy\(\s*\(\)\s*=>\s*import\('([^']+)'\)/g,
)){
  const yol = coz(HOST, m[2])
  if(typeof yol === 'string') bilesenYolu.set(m[1], yol)
}

const rotaSayfalar = new Map<string, Set<string>>()
const rotaYerleri = [...hostIcerik.matchAll(/route === '([a-z0-9-]+)'/g)]
rotaYerleri.forEach((m, i) => {
  const bas = m.index as number
  const son = i + 1 < rotaYerleri.length ? rotaYerleri[i + 1].index as number : hostIcerik.length
  const blok = hostIcerik.slice(bas, son)
  const kume = rotaSayfalar.get(m[1]) ?? new Set<string>()
  for(const c of blok.matchAll(/<(\w+)/g)){
    const yol = bilesenYolu.get(c[1])
    if(yol) kume.add(yol)
  }
  if(kume.size > 0) rotaSayfalar.set(m[1], kume)
})

// ── Suç tanımı ──────────────────────────────────────────────────────────
const mockModulu = (yol: string) => /\.mock\.tsx?$/.test(yol)

/**
 * Tohum üretip tarayıcıya yazan modül.
 *
 * İmza: bir tohum sayacı sabiti (`..._SEED_COUNT`) + `localStorage.setItem`.
 * `src/storage.ts` bu imzaya UYMAZ (tohum sabiti yok); yani eski
 * localStorage katmanı yanlışlıkla suçlanmıyor. Aranan şey "veri yoksa
 * uyduranlar" — `delivery-note.service.ts` tam buna takıldı: adında `.mock`
 * yoktu ama veri yoksa sekiz irsaliye üretip kaydediyordu.
 */
const tohumYazan = (icerik: string) => (
  /SEED[_A-Z]*COUNT/.test(icerik) && /localStorage\.setItem\(/.test(icerik)
)

const cozulemeyen = new Set<string>()

const tara = (baslangiclar: Set<string>): string[] => {
  const gorulen = new Set<string>(baslangiclar)
  const yigin = [...baslangiclar]
  const suclular = new Set<string>()
  while(yigin.length > 0){
    const yol = yigin.pop() as string
    const icerik = dosyalar.get(yol)
    if(icerik === undefined) continue
    if(mockModulu(yol)) suclular.add(`${kisaYol(yol)} → .mock modülü`)
    else if(tohumYazan(icerik)) suclular.add(`${kisaYol(yol)} → tohum üretip localStorage'a yazıyor`)
    for(const m of icerik.matchAll(/from\s+'([^']+)'/g)){
      const hedef = coz(yol, m[1])
      if(hedef === undefined){ cozulemeyen.add(`${kisaYol(yol)} → ${m[1]}`); continue }
      if(hedef === null || gorulen.has(hedef)) continue
      gorulen.add(hedef)
      yigin.push(hedef)
    }
  }
  return [...suclular].sort()
}

const acikRotalar = getCoreWorkspaceRoutes() as Set<string>
const taranan = [...rotaSayfalar.keys()].filter(r => acikRotalar.has(r)).sort()
const sonuclar = taranan.map(rota => ({
  rota, suclular: tara(rotaSayfalar.get(rota) as Set<string>),
}))

/**
 * ⚠️ SAĞLAMA ÇİVİLERİ. Sayı yerine İSİM: eşleme kalıbı bozulursa sayı
 * tutmaya devam edebilir ama bu rotalar listeden düşer.
 *
 * Bunlar ürünün omurgası — hepsi `getCoreWorkspaceRoutes()` içinde ve
 * hepsi rota sunucusunda düz `import` ile duruyor.
 */
const CIVILER = [
  'depo', 'sayimlar', 'zayi-imha', 'receteler', 'uretim-emirleri',
  'etiketler', 'sevkiyatlar', 'haccp-kayitlari', 'izlenebilirlik',
  'tedarikciler', 'satinalma', 'musteriler', 'siparisler',
  'kpi-dashboard', 'users', 'settings', 'veri-yedegi', 'islem-gecmisi',
]

// ═══════════════════════════════════════════════════════════════════════════

describe('açık rota uydurma veriye ulaşamaz', () => {
  it('tarama gerçekten çalıştı — omurga rotaların hepsi tarandı', () => {
    expect(rotaSayfalar.size,
      'rota → sayfa eşlemesi kurulamadı; rota sunucusunun yazım kalıbı mı değişti?',
    ).toBeGreaterThan(60)

    expect(CIVILER.filter(r => !taranan.includes(r)),
      'Bu rotalar taramanın dışında kaldı. Ya rotaları kapandı (o zaman ' +
      'çivi listesi güncellenmeli) ya da eşleme kalıbı bozuldu — ikincisi ' +
      'ise test sessizce zayıflamış olur.',
    ).toEqual([])
  })

  it('içe aktarma zinciri eksiksiz çözüldü', () => {
    expect([...cozulemeyen].sort(),
      '\nÇözülemeyen göreli içe aktarma var. Tarama orada DURUYOR, yani ' +
      'arkasındaki bir .mock modülünü göremiyor olabilir.\n' +
      'Dosya taşındıysa içe aktarmayı düzelt; uzantı kod değilse ' +
      '`KODDISI` listesine ekle.\n',
    ).toEqual([])
  })

  it('hiçbir açık rota .mock modülüne ya da tohum üreticisine bağlanmıyor', () => {
    const ihlaller = sonuclar
      .filter(s => s.suclular.length > 0)
      .map(s => `${s.rota}: ${s.suclular.join(' | ')}`)

    expect(ihlaller,
      '\nAÇIK BİR ROTA UYDURMA VERİ KAYNAĞINA BAĞLANIYOR.\n' +
      'İki doğru çözümden birini seç:\n' +
      "  1) Menü ögesine ya da modüle `foundationScope: 'frozen'` ekle —\n" +
      '     rota kapanır, ekran adres çubuğundan da açılmaz.\n' +
      '  2) Ekranı gerçek deftere (Supabase) bağla ve .mock modülünü sil.\n' +
      'Testi susturmak için suç imzasını daraltmak YANLIŞTIR.\n',
    ).toEqual([])
  })
})
