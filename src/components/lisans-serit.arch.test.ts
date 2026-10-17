// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — LİSANS UYARISI TEK EŞİKTEN BESLENİR
//
// Uyarı artık İKİ yerde görünüyor: Ayarlar'daki lisans kartı ve Kontrol
// Paneli'nin üstündeki şerit. İki ekran demek, iki ayrı "kaç gün kaldı"
// hesabı yazma riski demek — ve o iki hesap bir gün ayrışırsa müşteri
// bir ekranda "15 gün", diğerinde "uyarı yok" görür.
//
// Bu test eşiğin TEK yerde kalmasını zorluyor: `lisansUyarisi()`.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'

const SRC = join(projeKokunuBul(), 'src')
const oku = (yol: string) => readFileSync(join(SRC, yol), 'utf8') as string

const SERIT = oku('components/LisansUyariSeridi.tsx')
const KART = oku('components/LisansKarti.tsx')
const PANEL = oku('pages/KontrolPaneli.tsx')

describe('lisans uyarısı · tek eşik', () => {
  it('şerit eşiği kendi hesaplamıyor, lisansUyarisi() çağırıyor', () => {
    expect(SERIT).toContain("from '../billing/license.repository'")
    expect(SERIT).toContain('lisansUyarisi(lisans)')
  })

  it('şeritte elle yazılmış gün eşiği YOK', () => {
    // `<= 7`, `< 30`, `=== 0` gibi gün karşılaştırmaları ikinci bir
    // gerçeklik demek olurdu.
    const govde = SERIT.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
    expect(govde).not.toMatch(/[<>]=?\s*\d+/)
  })

  it('kart da aynı kaynağı kullanıyor', () => {
    expect(KART).toContain('lisansUyarisi(lisans)')
  })

  it('Kontrol Paneli şeridi en üstte gösteriyor', () => {
    expect(PANEL).toContain("import LisansUyariSeridi from '../components/LisansUyariSeridi'")
    expect(PANEL).toContain('<LisansUyariSeridi')
    // Şerit, sayı kartlarından (metric-grid) ÖNCE gelmeli.
    expect(PANEL.indexOf('<LisansUyariSeridi')).toBeLessThan(PANEL.indexOf('metric-grid'))
  })

  it('platform kullanıcısına şerit gösterilmiyor', () => {
    expect(SERIT).toContain("platformKullanicisi")
    expect(SERIT).toContain("'platform.manage'")
    expect(SERIT).toContain('if(!lisans || platformKullanicisi(currentUser)) return null')
  })

  it('lisans okunamazsa şerit hata basmıyor, sessizce çıkmıyor da', () => {
    // Konsola yazıyor ama ekrana kırmızı uyarı BASMIYOR: ağ hatasını
    // lisans sorunu gibi göstermek yanlış bilgidir.
    expect(SERIT).toContain('console.error')
    expect(SERIT).not.toContain('setHata')
  })
})
