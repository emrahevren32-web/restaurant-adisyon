// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — TİP DENETİMİ HATTIN İÇİNDE
//
// ── NEDEN VAR (28.10.2026 · canlıda çöken ekran) ─────────────────────────
// Şahit Numune ekranı CANLIDA *"Bu ekran açılamadı"* veriyordu. Sebep tek bir
// satırdı: `NUMUNE_SAYFA` sabiti kullanılmış ama **import edilmemişti**.
// Tarayıcı `ReferenceError: NUMUNE_SAYFA is not defined` fırlatıyor, React
// ağacı sökülüyor, kullanıcı güvenli mod kutusunu görüyordu.
//
// ⚠️ ASIL MESELE O SATIR DEĞİL, HATTIN KENDİSİYDİ:
//   · `npm test`  → vitest, tip DENETLEMEZ (dönüştürür, denetlemez).
//   · `vite build`→ esbuild, tip DENETLEMEZ.
//   · `typecheck` betiği package.json'da DURUYORDU ve hiçbir yerden
//     çağrılmıyordu.
// Yani *"1584 test yeşil"* ve *"derleme başarılı"* cümlelerinin ikisi de
// doğruydu ve kod ÇALIŞMIYORDU. `tsc` bunu ilk saniyede yakalardı.
//
// ⚠️ Tuzak 139'un üçüncü örneği: kuralı belgeye yazmak hatırlatma, teste
// yazmak engellemedir. Bu test, kapının betiklerden DÜŞMESİNİ engelliyor.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from './test-support/goc-tarama'

const KOK = projeKokunuBul()
const oku = (ad: string) => readFileSync(join(KOK, ad), 'utf8') as string

const PAKET = JSON.parse(oku('package.json')) as { scripts?: Record<string, string> }
const KAYDET = oku('araclar/kaydet.ps1')
const YUKLE = oku('miyop-yukle.ps1')

/**
 * PowerShell yorum satırlarını atar.
 *
 * ⚠️ 28.10 · Bu test ilk yazışımda SIRA kontrolünde yanlış kırmızı verdi:
 * betiklere eklediğim AÇIKLAMA satırları `npm test` ifadesini geçiriyordu ve
 * `indexOf('npm test')` kodu değil YORUMU buluyordu. Ölçüm, ölçmek istediği
 * şeyi ölçmeli; yorum kod değildir.
 */
const kodu = (ps: string) => ps
  .split('\n')
  .filter(satir => !satir.trimStart().startsWith('#'))
  .join('\n')

describe('derleme kapısı · tip denetimi hattın içinde', () => {
  it('sağlama: üç dosya da okundu', () => {
    expect(Object.keys(PAKET.scripts ?? {}).length).toBeGreaterThan(3)
    expect(KAYDET.length).toBeGreaterThan(500)
    expect(YUKLE.length).toBeGreaterThan(500)
  })

  it('package.json `typecheck` betiğini taşıyor ve gerçekten tsc çağırıyor', () => {
    const betik = PAKET.scripts?.typecheck
    expect(betik, 'package.json içinde `typecheck` betiği yok').toBeTruthy()
    expect(betik, '`typecheck` tsc çağırmıyor').toMatch(/tsc/)
    expect(betik, '`typecheck` çıktı üretmemeli (--noEmit)').toMatch(/--noEmit/)
  })

  it('⚠️ kaydet.ps1 commit ETMEDEN ÖNCE tip denetimi koşuyor', () => {
    // Bu satır kırmızı verirse kapı düşmüş demektir: tip hatası taşıyan bir
    // commit yine atılabilir hâle gelmiştir.
    expect(
      KAYDET,
      'araclar/kaydet.ps1 `npm run typecheck` çağırmıyor — tip hatası taşıyan '
      + 'bir commit yine atılabilir (28.10 · NUMUNE_SAYFA).',
    ).toMatch(/npm run typecheck/)
  })

  it('kaydet.ps1 tip denetimi kırmızıysa DURUYOR', () => {
    const yer = KAYDET.indexOf('npm run typecheck')
    expect(yer).toBeGreaterThan(-1)
    // Çağrının hemen ardından çıkış kodu sınanmalı; sınanmazsa kapı
    // "çalıştı ama kimse bakmadı" olur (tuzak 132).
    const ardindan = KAYDET.slice(yer, yer + 400)
    expect(ardindan, 'typecheck çıktı kodu sınanmıyor').toMatch(/LASTEXITCODE/)
    expect(ardindan, 'typecheck kırmızıyken betik durmuyor').toMatch(/exit 1/)
  })

  it('⚠️ miyop-yukle.ps1 YAYINA ÇIKMADAN ÖNCE tip denetimi koşuyor', () => {
    expect(
      YUKLE,
      'miyop-yukle.ps1 `npm run typecheck` çağırmıyor — tip hatası taşıyan '
      + 'bir sürüm yine yayına çıkabilir.',
    ).toMatch(/npm run typecheck/)
    const yer = YUKLE.indexOf('npm run typecheck')
    const ardindan = YUKLE.slice(yer, yer + 300)
    expect(ardindan, 'typecheck kırmızıyken dağıtım durmuyor').toMatch(/LASTEXITCODE/)
  })

  it('tip denetimi TESTLERDEN ÖNCE koşuyor (hızlı geri bildirim)', () => {
    // ⚠️ Sıra önemli: tip hatası saniyeler içinde bulunur, testler dakikalar
    // sürüyor. Önce ucuz olan koşar.
    for(const [ad, ham] of [['kaydet.ps1', KAYDET], ['miyop-yukle.ps1', YUKLE]] as const){
      const metin = kodu(ham)
      const tip = metin.indexOf('npm run typecheck')
      const test = metin.indexOf('npm test')
      expect(tip, `${ad} · typecheck yok`).toBeGreaterThan(-1)
      expect(test, `${ad} · npm test yok`).toBeGreaterThan(-1)
      expect(tip, `${ad} · tip denetimi testlerden SONRA koşuyor`).toBeLessThan(test)
    }
  })
})
