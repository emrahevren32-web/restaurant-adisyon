// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · İZİN KURALI İKİ YERDE AYNI OLMALI (mimari testi)
//
// ── NEDEN VAR ─────────────────────────────────────────────────────────────
// "Onay Bekleyen İşletmeler" ekranı 0 kayıt gösterdi. Veritabanında başvuru
// vardı. Hata mesajı da yoktu. Sebep: aynı kural iki yerde yazılmıştı ve
// ayrışmıştı.
//
//   Tarayıcı (permission.repository.ts, 0015'in kuralı):
//       etkin izinler = app_user.role_code  ∪  user_role satırları
//   Veritabanı (app.yetkim_var, 0032'de yazdığım hâli):
//       etkin izinler = yalnız user_role satırları
//
// Tarayıcı menüyü açtı, RLS satırları gizledi. Ekran sessizce boş kaldı —
// en kötü hata türü: hiçbir şey bağırmıyor.
//
// 0036 fonksiyonu kurala getirdi. Bu test ayrışmanın BİR DAHA sessizce
// olmamasını sağlıyor: kural iki taraftan da okunuyor ve karşılaştırılıyor.
//
// ── SINIRI DÜRÜSTÇE ──────────────────────────────────────────────────────
// Bu test SQL'i çalıştırmıyor; metnini okuyor. Yani "fonksiyon doğru sonuç
// veriyor" demiyor, "fonksiyon her iki kaynağa da bakıyor" diyor. Çalışma
// zamanı kanıtı scripts/prova/goc-prova.sh + prova-akis.sql tarafında.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gocMetni, projeKokunuBul } from '../core/test-support/goc-tarama'

/**
 * `app.yetkim_var`ın GEÇERLİ gövdesi: göçler dosya adına göre sıralı
 * birleştirildiği için SON tanım kazanan tanımdır — veritabanında da öyle
 * olur (`create or replace` üzerine yazar).
 */
const yetkimVarGovdesi = (): string => {
  const sql = gocMetni()

  // ⚠️ Burada BİR KEZ yanlış sebeple yeşil kaldım: anahtarı
  // `'function app.yetkim_var'` yazmıştım, o da en son `comment on function
  // app.yetkim_var(...)` satırını buluyordu; ardından gelen ilk `$$` ise
  // DOĞRULAMA bloğunun `do $$`si oluyordu. Yani test fonksiyonun gövdesi
  // yerine doğrulama bloğunu okuyordu ve bozuk fonksiyonla bile geçti.
  // Anahtar artık TANIM satırı: `create ... function app.yetkim_var`.
  const tanim = /create\s+(?:or\s+replace\s+)?function\s+app\.yetkim_var/g
  let son = -1
  for(let m = tanim.exec(sql); m !== null; m = tanim.exec(sql)) son = m.index
  if(son === -1) throw new Error('app.yetkim_var göçlerde TANIMLANMIYOR.')

  // Gövde: tanımdan sonraki `as $$` ile onu kapatan `$$` arası.
  const basla = sql.indexOf('$$', son)
  if(basla === -1) throw new Error('app.yetkim_var gövdesi açılmıyor.')
  const bitir = sql.indexOf('$$', basla + 2)
  if(bitir === -1) throw new Error('app.yetkim_var gövdesi kapanmıyor.')
  const govde = sql.slice(basla + 2, bitir)

  // Gövdeyi okuduğumuzdan emin ol: her hâlinde bu iki parça vardı.
  if(!govde.includes('auth.uid()') || !govde.includes('app_user'))
    throw new Error('app.yetkim_var gövdesi okunamadı; test kendini kandırıyor olabilir.')
  return govde
}

describe('izin kuralı: birincil rol ∪ ek roller', () => {
  it('app.yetkim_var EK ROLLERE (user_role) bakıyor', () => {
    expect(yetkimVarGovdesi()).toContain('user_role')
  })

  it('app.yetkim_var BİRİNCİL ROLE (app_user.role_code) de bakıyor', () => {
    // Kırmızıya düşen hâl tam olarak 0032'deki hâliydi: burada yalnız
    // `user_role` vardı ve ekran boş kaldı.
    const govde = yetkimVarGovdesi()
    expect(govde).toMatch(/u\.role_code/)
  })

  it('app.yetkim_var kapatılmış kullanıcıyı yetkili saymıyor', () => {
    expect(yetkimVarGovdesi()).toMatch(/u\.is_active/)
  })

  it('tarayıcı tarafı da aynı birleşimi kuruyor', () => {
    // İki uygulamanın aynı kuralı izlediğinin okunabilir kanıtı. Biri
    // değiştirilirse bu test hangi ikisinin karşılaştırıldığını söyler.
    const kaynak = readFileSync(
      join(projeKokunuBul(), 'src', 'authorization', 'permission.repository.ts'),
      'utf8'
    ) as string
    expect(kaynak).toContain('loadExtraRoleCodes')
    expect(kaynak).toMatch(/new Set\(\[primaryRoleCode, \.\.\.extraRoles\]\)/)
  })

  it("birincil rolü 'admin' olan kullanıcı platform.manage iznini alıyor", () => {
    // 0008 Emrah'a `admin` birincil rolünü veriyor; 0015 `admin` rolüne
    // katalogdaki BÜTÜN izinleri veriyor (platform.* dâhil, bilinçli karar).
    // Bu zincir kırılırsa ekran yine sessizce boşalır, o yüzden sınanıyor.
    const sql = gocMetni()
    expect(sql).toMatch(/select 'admin', code from permission/)
    expect(sql).toMatch(/\('platform\.manage',/)
  })
})
