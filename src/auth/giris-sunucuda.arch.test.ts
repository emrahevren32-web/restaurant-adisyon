// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — GİRİŞ SUNUCUDA (MIYOP-043)
//
// Codex denetimi (18.10.2026): `giris_adresi_bul` `anon`a açık ve
//   · bulunan kullanıcı için GERÇEK Auth e-postasını dönüyor,
//   · bulunamayan ad için `@bulunamadi.miyop.local` dönüyor.
// Yani cevabın BİÇİMİ "bu kullanıcı var mı" sorusunu parola bilmeden
// cevaplıyor, ve işletme sahibinin gerçek adresi dışarı sızıyor.
//
// Bu test üç şeyi dondurur:
//   1. `giris-yap` Edge Function'ı adresi DIŞARI VERMİYOR ve iki hâl
//      (olmayan kullanıcı / yanlış parola) için AYNI cevabı veriyor.
//   2. Tarayıcı girişi önce sunucudan deniyor.
//   3. ⚠️ Geçici yedek yol HÂLÂ DURUYOR — ve bu test onu SAYIYOR.
//      Yedek yol silindiğinde bu testin son bloğu güncellenecek; o güne
//      kadar MIYOP-043 "kapandı" diye işaretlenemez.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const oku = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

const FONKSIYON = oku('supabase', 'functions', 'giris-yap', 'index.ts')
const ISTEMCI   = oku('src', 'auth', 'sunucu-girisi.ts')
const DEPO      = oku('src', 'storage.ts')

describe('MIYOP-043 · giriş sunucuda', () => {
  it('sağlama: üç dosya da okundu', () => {
    expect(FONKSIYON.length).toBeGreaterThan(1000)
    expect(ISTEMCI.length).toBeGreaterThan(500)
    expect(DEPO.length).toBeGreaterThan(10_000)
  })

  it('Edge Function adresi çözüyor ama DIŞARI VERMİYOR', () => {
    expect(FONKSIYON).toContain("rpc('giris_adresi_bul'")
    expect(FONKSIYON).toContain('SUPABASE_SERVICE_ROLE_KEY')
    // Cevap gövdesinde adres taşıyan bir alan OLMAMALI.
    const cevapBlok = FONKSIYON.slice(FONKSIYON.lastIndexOf('return cevap({'))
    expect(cevapBlok).not.toMatch(/\badres\s*[,:]/)
    expect(cevapBlok).not.toContain('email')
  })

  it('iki hâl için TEK ve AYNI hata dönüyor', () => {
    expect(FONKSIYON).toContain('const GENEL_HATA')
    // Olmayan kullanıcı ve yanlış parola aynı sabiti kullanmalı.
    const kere = (FONKSIYON.match(/GENEL_HATA/g) || []).length
    expect(kere, 'GENEL_HATA en az üç yerde geçmeli (tanım + iki dal)')
      .toBeGreaterThanOrEqual(3)
    // Supabase'in kendi mesajı dışarı verilmemeli.
    expect(FONKSIYON).not.toContain('girisHatasi.message')
    expect(FONKSIYON).toContain('DIŞARI VERİLMEZ')
  })

  it('parola hiçbir cevaba ve günlüğe konmuyor', () => {
    // `sifre` yalnız okunduğu yerde ve Auth çağrısında geçmeli.
    expect(FONKSIYON).not.toMatch(/console\.(log|error|warn)\([^)]*sifre/)
    expect(FONKSIYON).toContain('password: sifre')
  })

  it('tarayıcı önce sunucudan deniyor', () => {
    expect(DEPO).toContain('sunucudaGirisYap')
    const bas = DEPO.indexOf('const sunucu = await sunucudaGirisYap')
    const yedek = DEPO.indexOf('girisAdresiniCoz(email, isletmeKodu)', bas)
    expect(bas, 'sunucu çağrısı authenticateUser içinde yok').toBeGreaterThan(0)
    expect(yedek, 'yedek yol sunucu çağrısından ÖNCE geliyor').toBeGreaterThan(bas)
  })

  it('`reddedildi` ile `ulasilamadi` ayrı tutuluyor', () => {
    // İkisini birleştirmek, fonksiyon dağıtılmadığı sürece herkesi kapıda
    // bırakırdı; ya da tersine, gerçek reddi "ağ arızası" sayıp eski
    // sızdıran yola düşürürdü.
    expect(ISTEMCI).toContain("durum: 'reddedildi'")
    expect(ISTEMCI).toContain("durum: 'ulasilamadi'")
    expect(ISTEMCI).toContain('durum === 401')
    expect(DEPO).toContain("sunucu.durum === 'reddedildi'")
  })

  // ⚠️ AÇIK BORÇ · bu blok BİLEREK "hâlâ duruyor" diyor.
  it('GEÇİŞ DÖNEMİ: yedek yol hâlâ duruyor ve bu YAZILI', () => {
    expect(DEPO).toContain('GEÇİCİ YEDEK YOL')
    expect(DEPO).toContain('0091')
    expect(ISTEMCI).toContain('MIYOP-043 KAPANMIŞ SAYILMAZ')
    // Yedek yol silindiğinde: bu bloğu, `giris_adresi_bul`un `anon`
    // hakkının alındığını sınayan bir blokla değiştir.
  })
})
