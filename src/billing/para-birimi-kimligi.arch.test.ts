// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — PARA BİRİMİ SÜRÜMÜNÜ KİM ARTIRIR
//
// ── NEDEN VAR (05.11.2026 · MIYOP-094 · MIYOP-096 · Codex) ───────────────
// `billing.ts`teki sayaç, uçuştaki bir okumanın cevabının hâlâ geçerli olup
// olmadığını söylüyor. İlk sürümde sayacı YALNIZ `App.tsx`teki etki
// artırıyordu ve bu iki yönden de yanlıştı:
//
// · **MIYOP-094 · AZ ARTIYORDU.** Aynı oturumda sayaç hiç değişmiyor. Giriş
//   anındaki okuma (cevabı TRY) uçarken EUR kaydedilirse, kaydetme sonrası
//   geri okuma EUR'yu besliyor, SONRA ilk okuma TRY ile dönüyor ve sürümü
//   geçerli olduğu için TRY kazanıyordu. Kullanıcının gördüğü cümle:
//   "kaydettim ama para birimi değişmedi."
//
// · **MIYOP-096 · ÇOK ARTIYORDU.** Etki `currentUser` NESNESİNE bağlıydı;
//   kişi kendi adını değiştirince yeni nesne doğuyor, etki koşuyor, sayaç
//   artıyordu — ve o sırada uçan MEŞRU okuma sessizce atılıyordu.
//
// ── NE ÖLÇÜYOR ───────────────────────────────────────────────────────────
// Davranışın kendisi iki yerde ölçülü: `billing.para-birimi.test.ts`
// (mekanizma) ve `isletme-ayarlari.repository.test.ts` (gerçek yarış).
// Bu dosya KABLOLAMAYI donduruyor — davranış doğru olsa bile yanlış
// kablolama onu yarın geri getirir:
//   1. `App.tsx` sayacı KİMLİĞE bakarak kuruyor, nesneye değil,
//   2. etkinin bağımlılığı `currentUser` DEĞİL,
//   3. koşulsuz artıran eski çağrı (`paraBirimiOturumuTazele`) hiçbir
//      yerde kalmamış,
//   4. yazma, geri okumadan ÖNCE sayacı artırıyor.
//
// ⚠️ Yorumlar soyuluyor (tuzak 181): bu dosyadaki ve `App.tsx`teki
// açıklamalar eski kablolamayı kelime kelime alıntılıyor; düz metne
// bakmak hem yanlış kırmızı hem yanlış yeşil üretirdi.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'
import { yorumsuzKod } from '../core/test-support/kaynak-soyma'

const KOK = projeKokunuBul()
const oku = (gorece: string) => yorumsuzKod(readFileSync(join(KOK, gorece), 'utf8') as string)

const APP = oku('src/App.tsx')
const DEPO = oku('src/workspace/isletme-ayarlari.repository.ts')
const BILLING = oku('src/billing.ts')

/** Para birimi etkisinin gövdesi: çağrıdan bağımlılık dizisine kadar. */
const etkiGovdesi = (kaynak: string): string => {
  const bas = kaynak.indexOf('paraBirimiKimligiKur(paraBirimiKimligi)')
  if(bas < 0) return ''
  const son = kaynak.indexOf('])', bas)
  if(son < 0) return ''
  return kaynak.slice(bas, son + 2)
}

/** `src` altındaki bütün kaynak dosyaları (testler dâhil). */
const kaynakDosyalari = (): string[] => {
  const bulunan: string[] = []
  const gez = (dizin: string) => {
    for(const ad of readdirSync(dizin) as string[]){
      const yol = join(dizin, ad)
      if(statSync(yol).isDirectory()){ gez(yol); continue }
      if(/\.(ts|tsx)$/.test(ad)) bulunan.push(yol)
    }
  }
  gez(join(KOK, 'src'))
  return bulunan
}

/** Koşulsuz artıran eski çağrının ÇAĞRI biçimi. Parça parça kuruluyor ki
 *  bu dosyanın kendisi taramaya takılmasın. */
const ESKI_CAGRI = 'paraBirimiOturumu' + 'Tazele('

describe('para birimi sürümünü kim artırır · MIYOP-094 · MIYOP-096', () => {
  it('sağlama · dosyalar okundu ve yorum soyma iş yaptı', () => {
    expect(APP.length).toBeGreaterThan(10000)
    expect(APP).toContain('paraBirimiKimligiKur')
    expect(DEPO).toContain('isletmeAyarlariniYaz')
    expect(BILLING).toContain('let surum = 0')
  })

  it('⚠️ MIYOP-096 · sayaç NESNEYE değil KİMLİĞE bakıyor', () => {
    expect(APP, 'kimlik hesaplanmıyor').toMatch(/const paraBirimiKimligi = React\.useMemo/)
    expect(APP, 'kimlik kullanıcı kimliğinden türemiyor')
      .toMatch(/\$\{currentUser\.id\}/)
    const govde = etkiGovdesi(APP)
    expect(govde, 'para birimi etkisi bulunamadı').not.toEqual('')
    expect(
      govde,
      'etki hâlâ `currentUser` NESNESİNE bağlı: ad değişince sayaç artar '
      + 've uçan meşru okuma atılır (MIYOP-096).'
    ).not.toMatch(/\}, \[currentUser\]\)/)
    expect(govde).toMatch(/\}, \[paraBirimiKimligi\]\)/)
  })

  it('negatif denetim · dedektör eski kablolamayı YAKALIYOR', () => {
    const ESKI = [
      '    paraBirimiKimligiKur(paraBirimiKimligi)',
      '    if(!currentUser){ paraBirimiAyarla(null); return }',
      '    void isletmeAyarlariniOku()',
      '  }, [currentUser])',
    ].join('\n')
    const govde = etkiGovdesi(ESKI)
    expect(govde).not.toEqual('')
    expect(govde).toMatch(/\}, \[currentUser\]\)/)
  })

  it('⚠️ koşulsuz artıran eski çağrı hiçbir yerde KALMAMIŞ', () => {
    // ⚠️ ÇAĞRI aranıyor (`(` ile), adın kendisi değil: bu dosya o adı
    // dizge olarak taşıyor ve kendi kendini suçlu bulurdu. İçe aktarım
    // parantezsizdir ama `billing.ts` artık o adı dışa vermiyor; parantezsiz
    // bir kalıntı tip denetiminde patlar.
    const dosyalar = kaynakDosyalari()
    expect(dosyalar.length, 'tarama hiçbir şey bulamadı — ölçüm anlamsız')
      .toBeGreaterThan(200)
    const kalanlar = dosyalar.filter(yol =>
      yorumsuzKod(readFileSync(yol, 'utf8') as string).includes(ESKI_CAGRI))
    expect(
      kalanlar.map(yol => yol.replace(KOK, '')),
      'koşulsuz sayaç artırımı geri gelmiş (MIYOP-096)'
    ).toEqual([])
  })

  it('negatif denetim · eski çağrı dedektörü GÖRÜYOR, benzerini görmüyor', () => {
    // ⚠️ Suçlu örnek PARÇA PARÇA kuruluyor; düz yazılsaydı bu dosya kendi
    // taramasına takılırdı. Sınır açık: bu denetim karşılaştırmanın
    // çalıştığını gösterir, deseni "keşfetmez".
    const ORNEK_SUCLU = '  ' + ESKI_CAGRI + ')'
    const ORNEK_MASUM = '  paraBirimiKimligiKur(kimlik)'
    expect(ORNEK_SUCLU.includes(ESKI_CAGRI)).toBe(true)
    expect(ORNEK_MASUM.includes(ESKI_CAGRI)).toBe(false)
  })

  it('⚠️ MIYOP-094 · yazma, GERİ OKUMADAN ÖNCE sayacı artırıyor', () => {
    const bump = DEPO.indexOf('paraBirimiYazimiBitti()')
    const geriOkuma = DEPO.indexOf('const ayarlar = await isletmeAyarlariniOku()')
    expect(bump, 'yazma sayacı hiç artırmıyor (MIYOP-094)').toBeGreaterThan(-1)
    expect(geriOkuma, 'kaydetme sonrası geri okuma bulunamadı').toBeGreaterThan(-1)
    expect(
      bump,
      'sayaç geri okumadan SONRA artıyor: geri okumanın kendi cevabı da '
      + 'bayat sayılır ve ekran beslenmez.'
    ).toBeLessThan(geriOkuma)
  })

  it('⚠️ kimlik kurucusu AYNI kimlikte hiçbir şey yapmıyor (kaynakta)', () => {
    const bas = BILLING.indexOf('export const paraBirimiKimligiKur')
    expect(bas).toBeGreaterThan(-1)
    const govde = BILLING.slice(bas, BILLING.indexOf('\n}', bas))
    expect(
      govde,
      'aynı kimlikte erken dönüş yok: her çağrı sayacı artırır (MIYOP-096)'
    ).toMatch(/if\(kimlik === beslenenKimlik\) return surum/)
  })
})
