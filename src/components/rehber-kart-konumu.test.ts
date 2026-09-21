// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Rehber kartı ekranda GEZMEZ
//
// ── NEDEN BÖYLE BİR TEST ─────────────────────────────────────────────────
// Kartın konumu jsdom'da anlamlı biçimde sınanamaz: gerçek yerleşim yok,
// `getBoundingClientRect()` hep sıfır döner. Yani "kart sağ altta mı" sorusu
// davranış testiyle cevaplanamıyor.
//
// Cevaplanabilen soru şu: KODDA kartı oynatabilecek bir şey duruyor mu?
// Kart altı kez farklı sebeplerle gezdi ve her seferinde geri getiren şey
// iyi niyetli bir ekleme oldu ("şu adımda biraz yukarı alalım"). Bu test o
// eklemeyi yapan kişiye, daha tarayıcıyı açmadan söyler.
//
// ⚠️ Bu bir METİN testidir ve sınırı açıktır: kartı gezdirmenin burada
// aranmayan bir yolu bulunabilir. Yine de bilinen altı yolu kapatıyor.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const oku = (yol: string) => readFileSync(resolve(__dirname, yol), 'utf8')

const tour = oku('./ProductTour.tsx')
const css = oku('../styles.css')

describe('Rehber kartı sabit durur', () => {
  it('kodda tek bir konum sabiti var', () => {
    expect(tour).toContain('const SAG_ALT')
    // İkinci bir konum sabiti, ikinci bir yer demektir.
    expect(tour).not.toContain('SAG_UST')
    expect(tour).not.toContain('ORTA_YERLESIM')
  })

  it('konum hiçbir koşula bağlanmamış', () => {
    // `style: kosul ? A : B` kalıbı tam olarak gezinmenin kendisiydi.
    expect(tour).not.toMatch(/style:\s*\w+\s*\?/)
  })

  it('hedefin altında kalma durumu konumla değil saydamlıkla çözülüyor', () => {
    expect(tour).toContain('soluk')
  })

  it('CSS kartın konumunu ANİMASYONLA değiştirmiyor', () => {
    // `transition:left…` + `will-change:left, top` ikilisi kartı bir köşeden
    // diğerine süzülerek taşıyordu; "gezme" hissini yaratan buydu.
    expect(css).not.toContain('will-change:left, top')
    expect(css).not.toMatch(/transition:left [^;]*top /)
  })

  it('CSS kartı iki kenardan köşeye yapıştırıyor (taşma imkânsız)', () => {
    const blok = css.slice(css.indexOf('REHBER KARTI · SABİT SAĞ ALT KÖŞE'))
    expect(blok).toContain('right:24px')
    expect(blok).toContain('bottom:24px')
    // Yükseklik sınırı olmadan uzun bir adım metni kartı ekran dışına uzatır.
    expect(blok).toContain('max-height:calc(100dvh - 48px)')
    expect(blok).toContain('overflow-y:auto')
    // Yatayda kaydırma kabı bir kez başlığı kırpmıştı ("l Paneli").
    expect(blok).toContain('overflow-x:hidden')
  })
})
