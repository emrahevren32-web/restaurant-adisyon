// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — POWERSHELL BETİKLERİ AYRIŞTIRILABİLİR OLSUN
//
// ── NEDEN VAR (05.11.2026 · tuzak 180) ───────────────────────────────────
// `geri-yukle-provasi.ps1`e tırnaklı bir tablo adı yazdım:
//
//     "... from \"$($parca[0])\".\"$($parca[1])\""
//
// PowerShell'de çift tırnak içinde **kaçış karakteri ters bölü değil, ters
// tırnaktır**. Betik ayrıştırılamadı — yani hiç çalışmadı. Emrah komutu
// çalıştırdı ve karşısına iki `ParserError` çıktı.
//
// ⚠️ Daha önemlisi: bunu ben ÖLÇEMEDİM. Bu ortamda PowerShell yok, yani
// yazdığım `.ps1` dosyasının sözdizimini koşturarak sınayamıyorum. Hatayı
// Emrah'ın terminali buldu — yani ölçüm masrafını o ödedi.
//
// Bu test o boşluğun yerini **tam** doldurmuyor; dolduramaz, çünkü bir
// PowerShell ayrıştırıcısı değil. İki somut şeyi ölçüyor:
//   1. hiçbir betikte `\"` yok (beni yakan tam bu şekil),
//   2. küme/parantez/köşeli parantez dengesi tutuyor.
// Üçüncü bir şey de ölçüyor: kendisinin ölçtüğünü. Her iki dedektör bozuk
// bir örneğe de uygulanıyor ve onu YAKALADIĞI iddia ediliyor (tuzak 170).
//
// ⚠️ Tırnak gerektiğinde çözüm basit ve kaçışsız:
//     $tirnakli = '"' + $ad + '"'
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from './test-support/goc-tarama'

const KOK = projeKokunuBul()

const ps1Dosyalari = (): string[] => {
  const araclar = (readdirSync(join(KOK, 'araclar')) as string[])
    .filter((ad: string) => ad.endsWith('.ps1'))
    .map((ad: string) => join('araclar', ad))
  const kokte = (readdirSync(KOK) as string[]).filter((ad: string) => ad.endsWith('.ps1'))
  return [...araclar, ...kokte].sort()
}

/**
 * Yorum satırlarını ve here-string gövdelerini atar.
 *
 * ⚠️ Here-string'ler (`@'...'@`, `@"..."@`) içinde PowerShell kuralları
 * geçerli değil: orada `$$`, `\"`, tek parantez serbestçe durabilir.
 * Onları ölçmek sahte kırmızı üretir.
 */
export const ps1Govdesi = (metin: string): string[] => {
  const cikti: string[] = []
  let tekTirnakliHere = false
  let ciftTirnakliHere = false
  for(const satir of metin.split('\n')){
    if(tekTirnakliHere){ if(/^'@/.test(satir)) tekTirnakliHere = false; continue }
    if(ciftTirnakliHere){ if(/^"@/.test(satir)) ciftTirnakliHere = false; continue }
    if(/@'\s*$/.test(satir)){ tekTirnakliHere = true; continue }
    if(/@"\s*$/.test(satir)){ ciftTirnakliHere = true; continue }
    if(/^\s*#/.test(satir)) continue
    cikti.push(satir)
  }
  return cikti
}

const kacisliSatirlar = (satirlar: string[]): string[] =>
  satirlar.filter(satir => satir.includes('\\"'))

/**
 * Kaçış denetimi için AYRI bir gövde.
 *
 * ⚠️ `@"..."@` here-string'i değişken ve kaçış İŞLER; `@'...'@` işlemez.
 * Yukarıdaki `ps1Govdesi` ikisini de atıyor (parantez dengesi için şart,
 * çünkü here-string gövdesinde dengesiz parantez olabilir). Kaçış denetimi
 * ise çift tırnaklı here-string'i GÖRMELİ — ölçüldü: bu depodaki tek
 * geçersiz kaçış (`tam-yedek.ps1`, dekoratif ters tırnak) tam oradaydı.
 */
export const ps1KacisAlani = (metin: string): string[] => {
  const cikti: string[] = []
  let tekTirnakliHere = false
  for(const satir of metin.split('\n')){
    if(tekTirnakliHere){ if(/^'@/.test(satir)) tekTirnakliHere = false; continue }
    if(/@'\s*$/.test(satir)){ tekTirnakliHere = true; continue }
    if(/^\s*#/.test(satir)) continue
    if(/^"@/.test(satir)) continue
    if(/@"\s*$/.test(satir)) continue
    cikti.push(satir)
  }
  return cikti
}

/** PowerShell'in tanıdığı kaçışlar. Ters tırnak + satır sonu = devam işareti. */
const GECERLI_KACIS = new Set(['0', 'a', 'b', 'e', 'f', 'n', 'r', 't', 'v', '"', "'", '`', '$'])

/**
 * Ters tırnağın ARDINDAN gelen karakter geçerli bir kaçış değilse, PowerShell
 * ters tırnağı sessizce YUTAR. `tam-yedek.ps1`te süsleme olarak yazılan
 * ters tırnaklar (`` `git bundle verify` ``) yedek notundan böyle kayboluyordu.
 */
export const gecersizKacislar = (satirlar: string[]): string[] => {
  const suclular: string[] = []
  satirlar.forEach(satir => {
    for(let i = 0; i < satir.length; i += 1){
      if(satir[i] !== '`') continue
      if(i === satir.length - 1) continue
      if(!GECERLI_KACIS.has(satir[i + 1])){
        suclular.push('`' + satir[i + 1] + '  ' + satir.trim().slice(0, 90))
      }
    }
  })
  return suclular
}

/** Dizgeleri boşaltıp kalan parantezleri sayar. */
export const parantezDengesi = (satirlar: string[]): Record<string, number> => {
  const acik: Record<string, number> = { '{': 0, '(': 0, '[': 0 }
  for(const satir of satirlar){
    const temiz = satir
      .replace(/'[^']*'/g, "''")
      .replace(/"[^"]*"/g, '""')
      .replace(/#.*$/, '')
    for(const harf of temiz){
      if(harf === '{') acik['{'] += 1
      else if(harf === '}') acik['{'] -= 1
      else if(harf === '(') acik['('] += 1
      else if(harf === ')') acik['('] -= 1
      else if(harf === '[') acik['['] += 1
      else if(harf === ']') acik['['] -= 1
    }
  }
  return acik
}

const BOZUK_KACIS = [
  '$parca = $t -split \'\\.\'',
  '$ifadeler += "select from \\"$($parca[0])\\".\\"$($parca[1])\\""'
]

const BOZUK_DENGE = [
  'function Bir(){',
  '  if($a -eq 1){ Write-Host "bir"',
  '}'
]

describe('PowerShell betikleri · tuzak 180', () => {
  const dosyalar = ps1Dosyalari()

  it('betikler gerçekten bulundu (sağlama — sessiz geçme yok)', () => {
    expect(dosyalar.length).toBeGreaterThanOrEqual(5)
    expect(dosyalar).toContain(join('araclar', 'geri-yukle-provasi.ps1'))
    expect(dosyalar).toContain(join('araclar', 'kaydet.ps1'))
  })

  it('hiçbir betikte ters bölü ile tırnak kaçışı yok', () => {
    const suclular: string[] = []
    for(const dosya of dosyalar){
      const govde = ps1Govdesi(readFileSync(join(KOK, dosya), 'utf8') as string)
      for(const satir of kacisliSatirlar(govde)){
        suclular.push(`${dosya}: ${satir.trim().slice(0, 100)}`)
      }
    }
    expect(suclular).toEqual([])
  })

  it('negatif denetim · kaçış dedektörü bozuk satırı YAKALIYOR', () => {
    expect(kacisliSatirlar(BOZUK_KACIS)).toHaveLength(1)
    expect(kacisliSatirlar(ps1Govdesi(BOZUK_KACIS.join('\n')))).toHaveLength(1)
  })

  it('hiçbir betikte GEÇERSİZ ters tırnak kaçışı yok', () => {
    const suclular: string[] = []
    for(const dosya of dosyalar){
      const alan = ps1KacisAlani(readFileSync(join(KOK, dosya), 'utf8') as string)
      for(const bulgu of gecersizKacislar(alan)) suclular.push(`${dosya}: ${bulgu}`)
    }
    expect(suclular).toEqual([])
  })

  it('negatif denetim · geçersiz kaçış dedektörü YAKALIYOR, geçerliyi geçiriyor', () => {
    expect(gecersizKacislar(['Write-Host "bak: `git bundle verify` gecti"'])).toHaveLength(2)
    expect(gecersizKacislar(['Write-Host "ilk satir`nikinci satir"'])).toEqual([])
    expect(gecersizKacislar(['$x = "fiyat: `$5"'])).toEqual([])
    expect(gecersizKacislar(['robocopy . $hedef /E `'])).toEqual([])   // satır sonu = devam
  })

  it('⚠️ YAKALAMADIĞI ŞEY · geçerli bir kaçışın SÜS olarak yazılması', () => {
    // 05.11'de tam bunu yaptım: `npm test` yazdım, ters tırnak + n GEÇERLİ
    // bir kaçış (satır sonu) olduğu için dedektör bunu göremez ve ekrana
    // satır başı basılır. Statik olarak ayırt edilemez — niyet okunamıyor.
    // Sınırı yazmak, bir gün "bu test onu da tutar" sanılmasını önler.
    expect(gecersizKacislar(['Write-Host "bak: `npm test calistir"'])).toEqual([])
  })

  it('her betikte küme/parantez dengesi tutuyor', () => {
    const bozuk: string[] = []
    for(const dosya of dosyalar){
      const govde = ps1Govdesi(readFileSync(join(KOK, dosya), 'utf8') as string)
      const denge = parantezDengesi(govde)
      for(const [isaret, sayi] of Object.entries(denge)){
        if(sayi !== 0) bozuk.push(`${dosya}: '${isaret}' dengesi ${sayi}`)
      }
    }
    expect(bozuk).toEqual([])
  })

  it('negatif denetim · denge dedektörü eksik kapanışı YAKALIYOR', () => {
    const denge = parantezDengesi(BOZUK_DENGE)
    expect(denge['{']).toBe(1)
  })

  it('⚠️ bu test bir PowerShell ayrıştırıcısı DEĞİL — sınırı yazılı', () => {
    const kendisi = readFileSync(
      join(KOK, 'src/core/powershell-kacis.arch.test.ts'), 'utf8'
    ) as string
    // Sınırın yazılı olması, bir gün "betikler sınandı" sanılmasını önler.
    expect(kendisi).toContain('bir PowerShell ayrıştırıcısı değil')
    expect(kendisi).toContain('ölçüm masrafını o ödedi')
  })
})
