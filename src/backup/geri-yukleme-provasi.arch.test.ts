// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — GERİ YÜKLEME PROVASI KİMSENİN VERİSİNİ SİLMESİN
//
// ── NEDEN VAR (04.11.2026 · MIYOP-093 · Codex) ───────────────────────────
// Prova betiğinin ilk sürümü şunu yapıyordu:
//
//     param([string]$Veritabani = 'miyop_geri_provasi')
//     ...
//     & $dropdb --if-exists -U postgres $Veritabani
//
// Yani veritabanı adı SERBEST bir parametreydi ve betiğin ilk işi onu
// SİLMEKTİ. `-Veritabani` ile var olan bir veritabanının adı verilse, prova
// daha başlamadan o veritabanı gidiyordu. Üstüne hiçbir komutta sunucu
// belirtilmemişti; `PGHOST` / `PGHOSTADDR` / `PGSERVICE` ortam değişkenleri
// hedefi UZAK bir sunucuya çevirebiliyordu.
//
// ⚠️ Betiğin başındaki yorum "BU BETİK CANLI VERİTABANINA DOKUNMAZ" diyordu.
// Yorum bir koruma değildir. Koruma budur.
//
// ── NE ÖLÇÜYOR ───────────────────────────────────────────────────────────
// Dört halkayı birlikte donduruyor:
//   1. serbest ad parametresi YOK, ad her koşuda üretiliyor,
//   2. var olan bir ada denk gelirse DOKUNMADAN duruyor,
//   3. devralınan bağlantı değişkenleri temizleniyor, her komut aynı
//      hedefe açıkça bağlanıyor, hedefin yerelliği sunucuya sorulyor,
//   4. tek `dropdb` çağrısı var ve yalnız BU KOŞUNUN açtığını siliyor.
// Ayrıca MIYOP-095: yeşil ölçüsü "kiracı sıfır değil" değil, dökümle
// TABLO TABLO karşılaştırma.
//
// ── NİÇİN YORUMLAR SOYULUYOR (MIYOP-098 sınıfı) ──────────────────────────
// Bu dosyadaki açıklamalar eski KÖTÜ kodu kelime kelime alıntılıyor. Metne
// düz baksak, kodu yorum satırına almak testi yeşil bırakırdı. O yüzden
// bütün iddialar `#` ile başlayan satırlar SOYULDUKTAN sonra kuruluyor.
//
// ── NEGATİF DENETİM ──────────────────────────────────────────────────────
// Her dedektör, eski kötü şeklin küçük bir örneğine de uygulanıyor ve onu
// YAKALADIĞI ayrıca iddia ediliyor. Dedektör bozulursa test kırmızı olur —
// MIYOP-097'de öğrendiğimiz ders: ölçen şeyin ölçtüğü de kanıtlanmalı.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'

const KOK = projeKokunuBul()
const HAM = readFileSync(join(KOK, 'araclar/geri-yukle-provasi.ps1'), 'utf8') as string

/** `#` ile başlayan satırları atar — yoruma alınmış kod iddiayı kurtarmasın. */
export const yorumsuz = (metin: string): string =>
  metin.split('\n').filter(satir => !/^\s*#/.test(satir)).join('\n')

const KOD = yorumsuz(HAM)

/** Betikteki bir fonksiyonun gövdesi (ilk sütundaki `}` satırına kadar). */
const govde = (ad: string): string => {
  const bas = KOD.indexOf(`function ${ad}(){`)
  if(bas < 0) throw new Error(`${ad} fonksiyonu bulunamadı`)
  const son = KOD.indexOf('\n}', bas)
  if(son < 0) throw new Error(`${ad} gövdesi kapanmıyor`)
  return KOD.slice(bas, son)
}

// ── dedektörler · hem gerçek betiğe hem kötü örneğe uygulanıyor ───────────
const serbestAdParametresi = (kod: string): boolean => {
  const blok = /param\(([\s\S]*?)\)/.exec(kod)
  if(blok === null) return false
  return /\$Veritabani/.test(blok[1])
}

const silVarsa = (kod: string): boolean => /--if-exists/.test(kod)

const dropdbCagrilari = (kod: string): string[] =>
  kod.split('\n').filter(satir => /&\s+\$(script:)?dropdb\b/.test(satir))

/** Bağlantı kurduğu hâlde hedefi açıkça bağlamayan komut satırları. */
const baglanmayanKomutlar = (kod: string): string[] =>
  kod.split('\n').filter(satir => {
    const cagri = /&\s+\$(script:)?(psql|createdb|dropdb|pgRestore)\b/.exec(satir)
    if(!cagri) return false
    // pg_restore'un `--list` ve `-f` kullanımları veritabanına bağlanmaz.
    if(cagri[2] === 'pgRestore' && !/\s-d\s/.test(satir)) return false
    return !/@(ortakBaglanti|baglanti)\b/.test(satir)
  })

// Eski — ve tehlikeli — şeklin küçük bir örneği. Dedektörler bunu
// YAKALAMAK zorunda; yakalamazlarsa ölçmüyorlar demektir.
const KOTU_ORNEK = [
  'param(',
  "  [string]$Dosya = '',",
  "  [string]$Veritabani = 'miyop_geri_provasi'",
  ')',
  '& $dropdb --if-exists -U postgres $Veritabani 2>&1 | Out-Null',
  '& $createdb -U postgres $Veritabani 2>&1 | Out-Null',
  '& $psql -U postgres -d $Veritabani -f "$sorgu" 2>&1 | Out-String'
].join('\n')

describe('geri yükleme provası · MIYOP-093', () => {
  it('yorum soyma gerçekten iş yapıyor ve kodu silmiyor (sağlama)', () => {
    expect(HAM.length).toBeGreaterThan(KOD.length)
    expect(HAM).toMatch(/dropdb --if-exists/)   // eski kod yorumlarda anlatılıyor
    expect(KOD).toContain('function TemizlikYap()')
    expect(KOD).toContain('$pgRestore --no-owner --no-privileges')
  })

  it('veritabanı adı serbest parametre DEĞİL, her koşuda üretiliyor', () => {
    expect(serbestAdParametresi(KOD)).toBe(false)
    expect(serbestAdParametresi(KOTU_ORNEK)).toBe(true)   // negatif denetim
    expect(KOD).toMatch(/\$Veritabani\s*=\s*'miyop_prova_'\s*\+/)
    expect(KOD).toContain('[guid]::NewGuid()')
  })

  it('var olan bir veritabanına DOKUNMADAN duruyor', () => {
    expect(KOD).toMatch(/from pg_database where datname/)
    const bas = KOD.indexOf('from pg_database where datname')
    const pencere = KOD.slice(bas, bas + 400)
    expect(pencere).toMatch(/Hata\s+"'\$Veritabani' adinda bir veritabani ZATEN VAR/)
    expect(silVarsa(KOD)).toBe(false)
    expect(silVarsa(KOTU_ORNEK)).toBe(true)               // negatif denetim
  })

  it('tek bir dropdb var, o da yalnız bu koşunun açtığını siliyor', () => {
    const cagrilar = dropdbCagrilari(KOD)
    expect(cagrilar).toHaveLength(1)
    // negatif denetim: kötü örnekte de bulunuyor, ama orada korumasız
    const kotu = dropdbCagrilari(KOTU_ORNEK)
    expect(kotu).toHaveLength(1)
    expect(kotu[0]).toContain('--if-exists')
    expect(KOTU_ORNEK).not.toContain('bizYarattik')
    const temizlik = govde('TemizlikYap')
    expect(temizlik).toContain(cagrilar[0].trim())
    expect(temizlik).toMatch(/if\(-not \$script:bizYarattik\)\{ return \}/)
    // bayrak ancak createdb BAŞARILI olduktan sonra kalkıyor
    const createdbYeri = KOD.indexOf('& $createdb')
    const bayrakYeri = KOD.indexOf('$bizYarattik = $true')
    expect(createdbYeri).toBeGreaterThan(-1)
    expect(bayrakYeri).toBeGreaterThan(createdbYeri)
  })

  it('devralınan bağlantı ortam değişkenleri temizleniyor', () => {
    for(const ad of ['PGHOST', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGDATABASE', 'PGPORT']){
      expect(KOD).toContain(`'${ad}'`)
    }
    expect(KOD).toMatch(/Remove-Item "env:\$ad"/)
  })

  it('her veritabanı komutu aynı hedefe AÇIKÇA bağlanıyor', () => {
    expect(baglanmayanKomutlar(KOD)).toEqual([])
    expect(baglanmayanKomutlar(KOTU_ORNEK).length).toBeGreaterThan(0)  // negatif denetim
    expect(KOD).toMatch(/\$ortakBaglanti = @\('-h', \$Sunucu, '-p', "\$Kapi", '-U', 'postgres'\)/)
  })

  it('hedefin yerel olduğu SUNUCUYA sorularak doğrulanıyor', () => {
    expect(KOD).toContain('inet_server_addr()')
    expect(KOD).toMatch(/'yerel-soket','127\.0\.0\.1','::1'/)
    expect(KOD).toMatch(/Hata "HEDEF YEREL DEGIL/)
    // doğrulama, veritabanı açılmadan ÖNCE olmalı
    expect(KOD.indexOf('inet_server_addr()')).toBeLessThan(KOD.indexOf('& $createdb'))
  })

  it('tuzak 180 · PowerShell\'de ters bölü ile tırnak kaçışı YOK', () => {
    // ⚠️ 05.11'de ÖLÇÜLDÜ: `\\"` yazdım, PowerShell'de çift tırnak içinde
    // kaçış karakteri ters bölü DEĞİL ters tırnaktır. Betik ayrıştırılamadı,
    // yani hiç çalışmadı. Tırnak artık string birleştirmeyle konuyor.
    // Bu dosyada tek tırnaklı dizgede ters bölü kullanma ihtiyacı yok;
    // çıkarsa bu iddia uyarır ve bilinçli karar vermek gerekir.
    expect(KOD).not.toContain('\\"')
    // negatif denetim: dedektör o şekli gerçekten görüyor
    expect('$x = "a \\"b\\" c"').toContain('\\"')
  })

  it('MIYOP-095 · yeşil ölçüsü dökümle tablo tablo karşılaştırma', () => {
    // dökümün kendi satırları sayılıyor
    expect(KOD).toMatch(/\^COPY\\s\+\(\\S\+\)/)
    expect(KOD).toContain('$dokumSayim')
    // ⚠️ ÖLÇÜLDÜ: yedek `--quote-all-identifiers` ile alınıyor, COPY satırı
    // `COPY "public"."allergen" (...)` biçiminde geliyor. Tırnak soyma
    // olmadan hiçbir tablo tanınmaz ve prova yanlış kırmızı verir.
    expect(KOD).toMatch(/\$Matches\[1\] -replace '"', ''/)
    expect(KOD).toMatch(/\$tirnakli = '"' \+ \$parca\[0\]/)
    expect(KOD).toMatch(/count\(\*\)::text as kac from \$tirnakli/)
    // arşivin kendi künyesi sayılıyor
    for(const tip of ['TABLE', 'FUNCTION', 'TRIGGER', 'POLICY']){
      expect(KOD).toContain(`${tip}\\s+`)
    }
    // eksik olan tek kalem bile provayı kırıyor
    expect(KOD).toMatch(/if\(\$eksikler\.Count -gt 0\)\{[\s\S]{0,300}?Hata /)
    // ve ölçü artık "kiraci sıfır değil"e BAĞLI DEĞİL
    expect(KOD).not.toMatch(/kiraci\\s\*\\\|\\s\*0/)
  })
})
