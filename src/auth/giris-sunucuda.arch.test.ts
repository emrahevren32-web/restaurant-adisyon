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
const SERVIS    = oku('src', 'auth', 'authentication.service.ts')
const GIRIS     = oku('src', 'pages', 'Login.tsx')

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

  it('MIYOP-051 · kota ve arıza, YANLIŞ PAROLA sayılmıyor', () => {
    // Auth 429/5xx verdiğinde parolası DOĞRU olan kişi de "şifre hatalı"
    // görüyordu; kişi şifresini boş yere değiştirmeye kalkar, arıza da
    // gizlenir. Üç durum ayrı: 401 / 429 / 503.
    expect(FONKSIYON).toContain('kod === 429')
    expect(FONKSIYON).toContain('kod >= 500')
    expect(FONKSIYON).toContain('429)')
    expect(FONKSIYON).toContain('503)')
    expect(ISTEMCI).toContain("durum: 'gecici'")
    // ⚠️ Geçici hata YEDEK YOLA DÜŞMEMELİ: bir kota arızasını eski
    // sızdıran yola yönlendirmek olurdu.
    expect(DEPO).toContain("sunucu.durum === 'gecici'")
  })

  it('MIYOP-051 · geçici hata EKRANA KADAR taşınıyor', () => {
    // ⚠️ İlk onarım yarım kalmıştı: Edge ve istemci kotayı ayırıyordu ama
    // `storage.ts` `null` döndüğü için mesaj ekrana hiç ulaşmıyordu ve
    // parolası DOĞRU olan kişi yine "şifre hatalı" görüyordu.
    expect(DEPO).toContain('ariza.deger = { mesaj: sunucu.mesaj }')
    expect(SERVIS).toContain('gecikmeMesaji')
    expect(GIRIS).toContain('result.gecikmeMesaji')
    // Ekran o mesajı GÖSTERMELİ, yutmamalı.
    const bas = GIRIS.indexOf('result.gecikmeMesaji')
    expect(GIRIS.slice(bas, bas + 200)).toContain('setError(result.gecikmeMesaji)')
  })

  it('MIYOP-055 · çıkış YALNIZ bu oturumu kapatıyor', () => {
    // Varsayılan kapsam `global`: kullanıcı başka cihazda çalışırken
    // buradaki geçici bir okuma hatası ONUN oturumunu da düşürürdü.
    expect(DEPO).toContain("signOut({ scope: 'local' })")
    // ⚠️ KAPSAMSIZ `signOut()` KALMAMALI: varsayılanı `global`dir ve
    // bir arıza anında başka cihazı düşürür.
    expect(DEPO).not.toMatch(/auth\.signOut\(\s*\)/)
    // Hesap PASİF ise `global` bilinçli bir karardır; o ayrım yazılı mı?
    expect(DEPO).toContain("appUserError ? { scope: 'local' } : { scope: 'global' }")
  })

  it('MIYOP-056 · izinler okunamazsa da yarım oturum kalmıyor', () => {
    // ⚠️ ÜÇÜNCÜ KEZ AYNI AİLE. Parola doğrulanmış, oturum kurulmuş, sonra
    // izin sorgusu düşmüş: ekran "giriş başarısız" derken Auth oturumu
    // açık kalıyordu. Üstelik sebep parola değildi.
    const bas = SERVIS.indexOf('permissions === null')
    const parca = SERVIS.slice(bas, bas + 1400)
    expect(bas, 'izin dalı bulunamadı').toBeGreaterThan(0)
    expect(parca).toContain("signOut({ scope: 'local' })")
    expect(parca).toContain('gecikmeMesaji')
    // Parola hatası DEMEMELİ.
    expect(parca).not.toMatch(/şifre hatalı|parola hatalı/i)
  })

  it('MIYOP-052 · yarım oturum bırakılmıyor', () => {
    // `setSession` başarılıysa Auth oturumu KURULMUŞTUR. `getUser`
    // düşerse `null` dönüp çıkmak, "giriş başarısız" diyen bir ekranın
    // arkasında açık oturum bırakırdı.
    const bas = DEPO.indexOf("sunucu.durum === 'oldu'")
    const parca = DEPO.slice(bas, bas + 1200)
    expect(parca).toContain('auth.signOut(')
  })

  it('MIYOP-053 · gövde şekli okunmadan ÖNCE doğrulanıyor', () => {
    // JSON `null` ya da `{"giris":{"toString":null}}` yakalanmamış hata
    // atıyordu; kontrollü cevap sözleşmesi (CORS başlıkları dâhil)
    // bozuluyordu.
    expect(FONKSIYON).toContain("ham === null || typeof ham !== 'object'")
    expect(FONKSIYON).toContain('Array.isArray(ham)')
    expect(FONKSIYON).toContain("typeof v === 'string'")
    // Tür hatasında SQL/Auth çağrılmadan 400 dönmeli.
    const bas = FONKSIYON.indexOf('const girisHam')
    const son = FONKSIYON.indexOf("rpc('giris_adresi_bul'")
    expect(bas).toBeGreaterThan(0)
    expect(son).toBeGreaterThan(bas)
    expect(FONKSIYON.slice(bas, son)).toContain('400)')
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
