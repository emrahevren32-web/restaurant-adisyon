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
//   3. ⚠️ Geçici yedek yol SİLİNDİ (29.10.2026) — ve bu test onun geri
//      GELMEDİĞİNİ ölçüyor. Eskiden burada "yedek yol hâlâ duruyor"
//      diyen bir blok vardı; borç kapanınca bloğun kendisi de değişti.
//      Ön koşullar ölçüldü: `giris-yap` canlıda POST 200, göç 0102
//      `anon` ve `authenticated` haklarını aldı (prova-0102, 19 ölçüm).
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const oku = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

const FONKSIYON = oku('supabase', 'functions', 'giris-yap', 'index.ts')
const ISTEMCI   = oku('src', 'auth', 'sunucu-girisi.ts')
const DEPO      = oku('src', 'storage.ts')
const SERVIS    = oku('src', 'auth', 'authentication.service.ts')
const GIRIS     = oku('src', 'pages', 'Login.tsx')
const GOC_0102  = oku('db', 'migrations', '0102_giris_adresi_kapandi.sql')

// ⚠️ TEK DOSYAYA BAKMAK YETMEZ: yedek yol `storage.ts`ten silinse bile
// başka bir ekran aynı RPC'yi çağırarak sızıntıyı geri açabilirdi.
// Bu yüzden bütün tarayıcı kaynağı taranıyor — testler hariç.
const KAYNAK_METNI = (() => {
  const topla = (dizin: string): string[] => readdirSync(dizin).flatMap((ad) => {
    const yol = join(dizin, ad)
    if(statSync(yol).isDirectory()) return topla(yol)
    if(!/\.tsx?$/.test(ad)) return []
    if(/\.test\.tsx?$/.test(ad)) return []
    return [readFileSync(yol, 'utf8')]
  })
  return topla(join(process.cwd(), 'src')).join('\n')
})()

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

  it('tarayıcı girişi YALNIZ sunucudan yapıyor', () => {
    expect(DEPO).toContain('sunucudaGirisYap')
    const bas = DEPO.indexOf('const sunucu = await sunucudaGirisYap')
    expect(bas, 'sunucu çağrısı authenticateUser içinde yok').toBeGreaterThan(0)
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

  // ⚠️ BORÇ KAPANDI · bu blok eskiden "yedek yol hâlâ duruyor" diyordu.
  // Şimdi tam tersini ölçüyor: o yol GERİ GELMEDİ.
  it('⚠️ YEDEK YOL SİLİNDİ ve geri gelmedi', () => {
    // Tarayıcı artık adresi hiçbir koşulda sormuyor.
    expect(DEPO).not.toContain('girisAdresiniCoz')
    expect(DEPO).not.toContain("rpc('giris_adresi_bul'")
    expect(DEPO).not.toContain('GEÇİCİ YEDEK YOL')
    // Ve bütün tarayıcı kodunda o RPC'nin adı geçmiyor.
    expect(KAYNAK_METNI).not.toContain("'giris_adresi_bul'")
    // Silindiği, sebebiyle birlikte YAZILI duruyor.
    expect(DEPO).toContain('MIYOP-043 KAPANDI')
  })

  it('⚠️ ulaşılamama PAROLA HATASI olarak gösterilmiyor', () => {
    // Yedek yol silinince `ulasilamadi` dalı "giriş olmadı" demek oldu.
    // Sebep söylenmezse ekran "şifre hatalı" der ve parolası DOĞRU olan
    // kişi şifresini boş yere değiştirmeye kalkar (MIYOP-051'in dersi).
    // ⚠️ DAHA ÖNCE İKİ KEZ AYNI HATAYI YAPTIM: "bu metin dosyada GEÇMESİN"
    // diye ölçüp kendi açıklama satırıma takıldım. Ölçülecek şey yorum
    // değil, EKRANA GİDEN DİZGİ. O yüzden dizginin kendisi çekiliyor.
    const bas = DEPO.indexOf('MIYOP-043 KAPANDI')
    expect(bas, 'silme açıklaması bulunamadı').toBeGreaterThan(0)
    const parca = DEPO.slice(bas, bas + 1800)
    const mesaj = /ariza\.deger = \{ mesaj: '([^']*)'/.exec(parca)?.[1] ?? ''
    expect(mesaj, 'ulaşılamadı dalında mesaj hiç kurulmuyor').toBeTruthy()
    expect(mesaj).not.toMatch(/şifre|parola/i)
  })

  it('göç 0102 depoda duruyor ve iki rolden birden alıyor', () => {
    expect(GOC_0102).toContain('from anon')
    expect(GOC_0102).toContain('from authenticated')
    // ⚠️ Fonksiyon SİLİNMİYOR: Edge Function onu `service_role` ile
    // çağırıyor. Silmek girişi kırardı.
    expect(GOC_0102).toContain('to service_role')
    expect(GOC_0102).not.toMatch(/drop\s+function/i)
    // ⚠️ Personel akışı dokunulmamış olmalı; göç bunu kendisi ölçüyor.
    expect(GOC_0102).toContain('personel_giris_adresi')
  })
})
