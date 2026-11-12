// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — KAYDA NE GİRİYOR (MIYOP-110 · Codex 4. tur)
//
// ── NE OLDU ──────────────────────────────────────────────────────────────
// `araclar/kaydet.ps1` `git add -A → git commit → git push` çalıştırıyor.
// 10.11'de push eklenince "her şeyi al" artık "her şeyi GitHub'a gönder"
// demek oldu. Çalışma ağacında makineye özel bir dosya takipsiz duruyordu
// (`.claude/settings.local.json`) ve `.gitignore` onu kapsamıyordu: bir
// sonraki kayıtta gidecekti. Kimse kayda neyin girdiğine bakmıyordu, çünkü
// betik göstermiyordu.
//
// ── ÜÇ KAT VE HER BİRİNİN ÖLÇÜSÜ ─────────────────────────────────────────
//   1 · `.gitignore` o dosyayı kapsıyor.
//   2 · Betik, dosya önceden takibe girmişse takipten çıkarıyor.
//   3 · Betik kayda girenleri listeliyor ve yasak bir ad görürse DURUYOR.
//
// ⚠️ BU TEST BETİĞİ KOŞTURMUYOR — sınırı yazılı. Burada PowerShell yok;
// ölçülen şey betiğin METNİ ve yasak desenlerinin örnek adlara verdiği
// cevap. Git adımlarının gerçekten böyle davrandığı 12.11'de aynı
// komutlar bash ile koşturularak ölçüldü (takipsiz · önceden takipte ·
// yalnız takipten çıkarma · zorla eklenmiş `.env.local`); çıktısı
// `docs/kararlar/kararlar-ve-tuzaklar.md` tuzak 204'te.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from './test-support/goc-tarama'

const KOK = projeKokunuBul()
const oku = (yol: string): string => readFileSync(join(KOK, yol), 'utf8') as string

/** PowerShell yorum satırları atılmış betik gövdesi. */
const ps1Kodu = (metin: string): string =>
  metin.split('\n').filter(satir => !satir.trim().startsWith('#')).join('\n')

const YEREL_DOSYA = '.claude/settings.local.json'
const KAYDET = ps1Kodu(oku('araclar/kaydet.ps1'))

describe('kayıt kapsamı · makineye özel dosya depoya girmiyor (MIYOP-110)', () => {
  it('⚠️ `.gitignore` yerel ayar dosyasını ADIYLA kapsıyor', () => {
    const satirlar = oku('.gitignore').split('\n').map(s => s.trim())
    expect(satirlar, `${YEREL_DOSYA} yok sayılmıyor`).toContain(YEREL_DOSYA)
    // Gizli anahtar dosyaları da hâlâ kapsamda (düzeltirken düşmemiş).
    for(const ad of ['.env', '.env.local', '.env.*.local', '*.pem']){
      expect(satirlar, `${ad} artık yok sayılmıyor`).toContain(ad)
    }
  })

  it('⚠️ betik adımları DOĞRU SIRADA', () => {
    const sira = [
      `git rm -r -q --cached --ignore-unmatch -- ${YEREL_DOSYA}`,
      'git status --porcelain',
      'git add -A',
      'git diff --cached --name-only --diff-filter=d',
      'git reset -q',
      'git diff --cached --name-status',
      'git commit -F',
      'git push',
    ]
    let onceki = -1
    for(const adim of sira){
      const yer = KAYDET.indexOf(adim)
      expect(yer, `betikte bu adım yok: ${adim}`).toBeGreaterThan(-1)
      expect(yer, `bu adım yanlış sırada: ${adim}`).toBeGreaterThan(onceki)
      onceki = yer
    }
  })

  it('⚠️ yasak görülünce betik DURUYOR (commit ve push yolu kesiliyor)', () => {
    const bas = KAYDET.indexOf('if ($yasaklar.Count -gt 0) {')
    expect(bas, 'yasak denetimi bulunamadı').toBeGreaterThan(-1)
    const blok = KAYDET.slice(bas, KAYDET.indexOf('git diff --cached --name-status', bas))
    expect(blok).toContain('git reset -q')
    expect(blok).toContain('exit 1')
  })

  it('⚠️ SİLİNENLER yasak listesine girmiyor (betik kendi düzeltmesini durdurmasın)', () => {
    // `git rm --cached` dosyayı takipten ÇIKARIR ve bu bir silme olarak
    // görünür. İlk yazımda yasak denetimi onu da yakaladı ve betik kendi
    // düzeltmesini durdurdu; ölçümde görüldü.
    expect(KAYDET).toContain('$eklenenler = @(git diff --cached --name-only --diff-filter=d)')
    expect(KAYDET).toContain('$yasaklar = @($eklenenler | Where-Object {')
  })

  it('⚠️ yasak desenleri örnek adlara beklenen cevabı veriyor', () => {
    // Desenler betikten OKUNUYOR, buraya kopyalanmıyor. .NET ile
    // JavaScript düzenli ifadeleri bu kadar yalın desenlerde aynı çalışır.
    const bas = KAYDET.indexOf('$yasaklar = @($eklenenler | Where-Object {')
    const blok = KAYDET.slice(bas, KAYDET.indexOf('})', bas))
    const desenler = [...blok.matchAll(/-match '([^']+)'/g)].map(m => new RegExp(m[1] as string))
    expect(desenler.length, 'yasak deseni okunamadı').toBeGreaterThanOrEqual(4)
    const yasakMi = (ad: string): boolean => desenler.some(d => d.test(ad))

    for(const ad of [YEREL_DOSYA, '.claude/baska.local.json', '.env', '.env.local',
      '.env.test.local', 'alt/klasor/.env', 'sunucu/anahtar.pem']){
      expect(yasakMi(ad), `${ad} kayda girebiliyor`).toBe(true)
    }
    for(const ad of ['.env.example', '.gitignore', 'src/App.tsx', 'docs/HEDEFLER.md',
      'araclar/commit-mesaji.txt', 'db/migrations/0115_numune_bosluk_sozlesmesi.sql',
      '.claude/settings.json', 'src/environment.ts']){
      expect(yasakMi(ad), `${ad} yanlışlıkla yasak sayılıyor`).toBe(false)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// `araclar/` ALTINDAKİ BETİKLER VE COMMIT MESAJI YALNIZ ASCII
//
// Windows PowerShell 5.1 BOM'suz UTF-8'i ANSI sanıp çözüyor: çok baytlı
// karakterler bozuluyor ve betik "Missing closing '}'" ile ayrıştırılamıyor
// (`kaydet.ps1`in ilk sürümü tam böyle kırılmıştı). Kural yazılıydı ama
// ÖLÇÜLMÜYORDU: Codex 4. tur, `powershell-kacis.arch.test.ts`in kaçış ve
// parantez denetlediğini, ASCII şartını denetlemediğini gösterdi.
//
// ⚠️ Kök dizindeki `miyop-yukle.ps1` ve `miyop-yedek.ps1` BU KURALIN
// DIŞINDA: onlar Türkçe karakter taşıyor ve bugüne kadar öyle çalıştı.
// Kural `araclar/` için yazılmıştı; ölçüm de orayı ölçüyor.
// ═══════════════════════════════════════════════════════════════════════════
describe('araclar/ · PowerShell betikleri ve commit mesajı yalnız ASCII', () => {
  const asciiDisi = (metin: string): string[] => {
    const bulunan: string[] = []
    metin.split('\n').forEach((satir, i) => {
      for(const k of satir){
        const kod = k.codePointAt(0) ?? 0
        if(kod > 0x7E || (kod < 0x20 && kod !== 0x09 && kod !== 0x0D)){
          bulunan.push(`satır ${i + 1} · U+${kod.toString(16).toUpperCase()}`)
          break
        }
      }
    })
    return bulunan
  }

  const betikler = (readdirSync(join(KOK, 'araclar')) as string[])
    .filter((ad: string) => ad.endsWith('.ps1')).sort()

  it('sağlama · betikler bulundu', () => {
    expect(betikler.length).toBeGreaterThanOrEqual(5)
    expect(betikler).toContain('kaydet.ps1')
  })

  it('⚠️ hiçbir betikte ASCII dışı karakter yok', () => {
    const kirli = betikler
      .map(ad => ({ ad, yerler: asciiDisi(oku(join('araclar', ad))) }))
      .filter(b => b.yerler.length > 0)
      .map(b => `${b.ad}: ${b.yerler.slice(0, 3).join(', ')}`)
    expect(kirli).toEqual([])
  })

  it('⚠️ commit mesajı yalnız ASCII (`kaydet.ps1` onu `git commit -F` ile okuyor)', () => {
    expect(asciiDisi(oku('araclar/commit-mesaji.txt'))).toEqual([])
  })

  it('negatif denetim · dedektör Türkçe harfi ve BOM\'u YAKALIYOR', () => {
    expect(asciiDisi('Write-Host "tamam"')).toEqual([])
    expect(asciiDisi('Write-Host "' + String.fromCharCode(0x130) + 'ptal"')).toHaveLength(1)
    expect(asciiDisi(String.fromCharCode(0xFEFF) + 'param()')).toHaveLength(1)
  })
})
