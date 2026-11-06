// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — GİRİŞ VİTRİNİ KİMİN BAKTIĞINA GÖRE DEĞİŞMEZ
//
// ── NEDEN VAR (06.11.2026 · HEDEFLER 4.11.6) ─────────────────────────────
// Emrah aynı sayfanın iki görüntüsünü gönderdi: `localhost`ta form kutuları
// beyaz, `miyop.emrahevren.com`da koyu ve etiketler okunmuyor. Aynı kod.
//
// Sebep: `ThemeProvider` kayıtlı temayı `<html>` üzerine HER SAYFADA
// uyguluyor — giriş vitrini dahil. Depo alan adı başına ayrı olduğu için
// prod'da bir tema kayıtlı, localhost'ta yok. Yani sayfanın kimliği
// BAKANA göre değişiyordu.
//
// ── NE ÖLÇÜYOR ───────────────────────────────────────────────────────────
// Bu test CSS METNİNİ okur: kuralın var olduğunu, kapsamının iki herkese
// açık sayfayı da tuttuğunu ve özgüllüğün tema kuralını yeneceğini
// doğrular.
//
// ⚠️ RENKLERİN GERÇEKTEN AYNI ÇIKTIĞINI BU TEST KANITLAMAZ. O ölçüm
// tarayıcıda yapıldı (Playwright, gerçek `styles.css`, yedi tema/vurgu
// birleşimi, hesaplanan renkler birebir aynı) ve sonucu kuralın başındaki
// yorumda yazılı. Burada donan şey KURALIN KENDİSİ: silinirse ya da
// kapsamı daralırsa kırmızı verir.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'

const KOK = projeKokunuBul()
const CSS = readFileSync(join(KOK, 'src/styles.css'), 'utf8') as string

/** Kuralın bloğu — başlığından dosya sonuna (yorumlar dahil). */
const blok = (): string => {
  const isaret = CSS.indexOf('GİRİŞ VİTRİNİ TEMADAN BAĞIMSIZ')
  if(isaret < 0) return ''
  // ⚠️ Başlık, açıklama yorumunun İÇİNDE. Kesmeye oradan başlarsak
  // yorumun açılışı (`/*`) dışarıda kalır ve yorum soyma onu atamaz —
  // ilk denemede tam bu oldu. Kesim, yorumun başından başlıyor.
  const bas = CSS.lastIndexOf('/*', isaret)
  return CSS.slice(bas < 0 ? isaret : bas)
}

/**
 * Bloğun YALNIZ seçicileri — yorumlar atılmış hâli.
 *
 * ⚠️ BU AYRIM BİR HATANIN BEDELİ (ve bu depoda üçüncü kez aynı hata).
 * "Her seçici kapsamlı mı" sınaması ham metne bakıyordu ve bloğun kendi
 * AÇIKLAMA yorumuna takıldı: orada `.unified-login-portal.unified-login-portal`
 * örnek olarak geçiyor, ama o bir seçici değil bir cümle.
 * Yorumlar kuralı ANLATIR; kuralı ölçen şey onları atmak zorunda
 * (tuzak 181 · MIYOP-098'in CSS tarafı).
 */
const seciciler = (): string => blok().replace(/\/\*[\s\S]*?\*\//g, '')

/** İki herkese açık sayfanın kök sınıfları. */
const SAYFALAR = ['unified-login-portal', 'public-application-page'] as const

describe('sağlama · ölçüm çalışıyor', () => {
  it('styles.css okundu ve büyük', () => {
    expect(CSS.length).toBeGreaterThan(500_000)
  })

  it('kural bloğu dosyada', () => {
    expect(blok().length, 'vitrin bloğu silinmiş').toBeGreaterThan(1_000)
  })
})

describe('vitrin temadan bağımsız', () => {
  it('⚠️ `color-scheme: light` var — onay kutusunu ve açılır listeyi tarayıcı çiziyor', () => {
    // Bu satır olmadan onay kutusu, açılır liste oku ve kaydırma çubuğu
    // tarayıcının KOYU paletiyle çizilir; beyaz kartın içinde.
    expect(blok()).toMatch(/color-scheme:\s*light/)
  })

  it('iki herkese açık sayfa da kapsamda', () => {
    for(const sayfa of SAYFALAR){
      expect(blok(), `${sayfa} kapsam dışı`).toContain(sayfa)
    }
  })

  it('sağlama: yorum soyma iş yapıyor ama kuralı silmiyor', () => {
    expect(seciciler().length).toBeLessThan(blok().length)
    expect(seciciler()).toContain('color-scheme: light')
    expect(seciciler()).not.toContain('ThemeProvider')
  })

  it('⚠️ özgüllük tema kuralını YENİYOR (sınıf adı iki kez yazılı)', () => {
    // Tema kuralı `html[data-theme-engine="premium"] :where(input, …)`
    // (0,1,1). Tek yazımla berabere kalınır ve yalnızca dosya sırası
    // sayesinde kazanılır — sıraya dayanan kural bir sonraki eklemede
    // sessizce kaybeder.
    for(const sayfa of SAYFALAR){
      expect(
        blok(),
        `${sayfa} tek kez yazılmış: özgüllük tema kuralıyla berabere kalır`,
      ).toContain(`.${sayfa}.${sayfa}`)
    }
  })

  it('⚠️ kapsam `html[data-theme-engine="premium"]` ile başlıyor', () => {
    // Tema motoru kapalıyken (ileride kaldırılırsa) bu kurallar da
    // devreye girmemeli; vitrin o zaman zaten varsayılan görünümde olur.
    const satirlar = seciciler().split('\n').filter(s => s.includes('.unified-login-portal.unified-login-portal'))
    expect(satirlar.length).toBeGreaterThanOrEqual(6)
    for(const satir of satirlar){
      expect(satir, `kapsamsız seçici: ${satir}`).toContain('html[data-theme-engine="premium"]')
    }
  })

  it('girdi, açılır liste ve çok satırlı alan üçü de kapsamda', () => {
    const b = blok()
    expect(b).toMatch(/\binput\b/)
    expect(b).toMatch(/\bselect\b/)
    expect(b).toMatch(/\btextarea\b/)
  })

  it('⚠️ onay kutusunun zemini SAYDAM bırakılmış', () => {
    // Genel `input` kuralı buraya da düşüyor ve kutuya beyaz zemin
    // veriyordu; bugünkü görünümde zemin saydam. Ölçüm yakaladı.
    const kutu = blok().slice(blok().indexOf('input[type="checkbox"]'))
    expect(kutu).toContain('background: transparent')
    expect(kutu).toContain('accent-color')
  })

  it('tema motoru DEĞİŞTİRİLMEMİŞ — yalnız iki sayfa kapsam dışına alınmış', () => {
    // ⚠️ Uygulamanın geri kalanı temayı kullanmaya devam ediyor.
    // `ThemeProvider` hâlâ üç veriyi `<html>` üzerine yazıyor; burada
    // yapılan onu kapatmak değil, iki sayfayı etkisinden çıkarmak.
    const tema = readFileSync(join(KOK, 'src/components/ThemeProvider.tsx'), 'utf8') as string
    expect(tema).toContain("root.dataset.themeEngine = 'premium'")
    expect(tema).toContain('root.dataset.theme = themeMode')
  })

  it('gerekçe yazılı — bir sonraki kişi "bu ne" diye sormasın', () => {
    const b = blok()
    expect(b).toMatch(/KİMİN BAKTIĞINA GÖRE DEĞİŞMEMELİ/)
    expect(b).toMatch(/ThemeProvider/)
    // Ölçümün kendisi de yazılı olmalı: iddia, kanıtını taşısın.
    expect(b).toMatch(/Playwright/)
  })
})
