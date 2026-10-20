// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Edge Function: giris-yap  ·  MIYOP-043
//
// ── SORUN ─────────────────────────────────────────────────────────────────
// Giriş iki adımdı: tarayıcı önce `giris_adresi_bul` RPC'siyle giriş
// adresini soruyor, sonra o adresle Supabase'e giriyordu. O RPC `anon`
// rolüne AÇIK. Codex denetimi (18.10.2026, MIYOP-043) iki sızıntı buldu:
//
//   1. Bulunan kullanıcıya **gerçek Auth e-postası** dönüyordu. İşletme
//      sahibinin gmail adresi, parola bilmeyen herkese açıktı.
//   2. Bulunamayan ad `@bulunamadi.miyop.local` ile dönüyordu. Yani
//      cevabın ALAN ADINA bakarak "bu kullanıcı var mı" sorusu parola
//      bilmeden cevaplanabiliyordu.
//
// 0077/0078'in sahte adres fikri enumerasyonu DÜŞÜNMÜŞTÜ ve kısmen
// engelliyordu; ama cevabın biçimi iki hâli ayırt ettirdiği için yetmedi.
//
// ── ÇÖZÜM ────────────────────────────────────────────────────────────────
// Adres çözümü TARAYICIDAN ALINIP SUNUCUYA taşındı. Tarayıcı artık giriş
// adını, işletme kodunu ve parolayı buraya gönderir; adres burada
// `service_role` ile çözülür, parola burada doğrulanır, dışarı yalnız
// oturum ya da TEK BİR genel hata çıkar.
//
// ⚠️ İKİ HÂL AYNI CEVABI VERİR: olmayan kullanıcı ile yanlış parola.
// Mesaj, kod, ve HTTP durumu birebir aynıdır. Bu, bu fonksiyonun bütün
// varlık sebebidir; "kullanıcı bulunamadı" demek baştaki açığı geri açar.
//
// ── ŞİFRE ────────────────────────────────────────────────────────────────
// ⚠️ Parola hiçbir günlüğe, hiçbir cevaba, hiçbir hata nesnesine girmez.
// Burada yalnız Supabase Auth'a iletilir ve değişken kapsamdan çıkar.
// MİYOP'un kendi veritabanına ASLA yazılmaz (0076'nın kuralı).
//
// ── NEDEN TARAYICIDA DEĞİL ───────────────────────────────────────────────
// Adresi çözmek için kullanıcı/kiracı tablolarını okumak gerekir. O okuma
// `anon`a açık olduğu sürece sızıntı da açıktır. `service_role` anahtarı
// burada kalır.
//
// ── SIRAYLA ──────────────────────────────────────────────────────────────
//  1. Girdiler okunur. Parola boşsa daha adres bile çözülmeden reddedilir.
//  2. Girdi gerçek e-posta biçimindeyse olduğu gibi kullanılır (kullanıcı
//     zaten kendi adresini yazmış; çözecek bir şey yok).
//  3. Değilse adres `service_role` ile `public.giris_adresi_bul`dan
//     çözülür. ⚠️ Çözülen adres DIŞARI VERİLMEZ.
//  4. `anon` istemciyle parola doğrulanır.
//  5. Başarıda oturum döner; başarısızlıkta TEK genel hata.
// ═══════════════════════════════════════════════════════════════════════════

// ⚠️ `npm:` öneki. `jsr:` bazı ortamlarda bulunamıyor ve fonksiyon ilk
// satırda çöküyor (personel-hesabi-ac'ta öğrenildi).
import { createClient } from 'npm:@supabase/supabase-js@2'

const BASLIKLAR = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

/** Dışarı çıkan TEK başarısızlık cevabı. Hiçbir ayrıntı eklenmez. */
const GENEL_HATA = 'Giriş adı veya şifre hatalı.'

const cevap = (govde: Record<string, unknown>, durum = 200) => {
  // ⚠️ Gövde günlüğe yazılırken içinde parola OLMAZ: bu fonksiyonda
  // `sifre` hiçbir zaman bir cevap nesnesine konmuyor.
  if(durum >= 500) console.error('[giris-yap]', durum, JSON.stringify(govde))
  return new Response(JSON.stringify(govde), { status: durum, headers: BASLIKLAR })
}

/**
 * Girdi kesinlikle bir e-posta mı? (`src/auth/giris-adresi.ts` ile AYNI kural)
 * Ayıran şey @'in sağında nokta olup olmaması: işletme kodlarında nokta yok.
 */
const kesinEpostaMi = (girdi: string): boolean => {
  const g = (girdi || '').trim()
  if(!g.includes('@')) return false
  return g.slice(g.indexOf('@') + 1).includes('.')
}

Deno.serve(async (istek: Request) => {
  if(istek.method === 'OPTIONS') return new Response('ok', { headers: BASLIKLAR })
  if(istek.method !== 'POST') return cevap({ hata: 'Yalnız POST.' }, 405)

  const url    = Deno.env.get('SUPABASE_URL')
  const anon   = Deno.env.get('SUPABASE_ANON_KEY')
  const servis = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url || !anon || !servis){
    return cevap({ hata: 'Sunucu ayarları eksik.' }, 500)
  }

  let govde: { giris?: unknown; sifre?: unknown; isletme?: unknown }
  try {
    govde = await istek.json()
  } catch {
    return cevap({ hata: 'Geçersiz istek.' }, 400)
  }

  const giris   = String(govde.giris   ?? '').trim()
  const isletme = String(govde.isletme ?? '').trim()
  const sifre   = String(govde.sifre   ?? '')

  // ⚠️ Boş girdi için de GENEL hata: "giriş adı boş" demek, bir sonraki
  // adımın ne olduğunu söylemektir.
  if(!giris || !sifre) return cevap({ hata: GENEL_HATA }, 401)

  let adres = ''
  if(kesinEpostaMi(giris)){
    // Kullanıcı kendi adresini yazmış. Çözecek bir şey yok, kimse bir şey
    // öğrenmiyor.
    adres = giris.toLowerCase()
  } else {
    const yonetim = createClient(url, servis, { auth: { persistSession: false } })
    const { data, error } = await yonetim.rpc('giris_adresi_bul', {
      p_kullanici: giris,
      p_isletme: isletme || null,
    })
    if(error){
      // ⚠️ Çözüm arızası parolayı doğrulamamızı engeller. Burada girdiyi
      // "olduğu gibi" denemek, eski tarayıcı davranışıydı; bu bir arızayı
      // sessizce yutar. Açıkça söylüyoruz — ama yine kullanıcı hakkında
      // hiçbir şey söylemeden.
      console.error('[giris-yap] adres cozulemedi:', error.message)
      return cevap({ hata: 'Giriş şu an yapılamıyor, birazdan tekrar deneyin.' }, 503)
    }
    adres = typeof data === 'string' ? data : ''
    // ⚠️ Çözülemeyen ad için bile parola doğrulamasına GİRİYORUZ: hemen
    // dönmek, cevap süresini kısaltıp "bu ad yok" bilgisini zamanla
    // sızdırırdı. Sahte adresle Auth zaten reddedecek.
    if(!adres) adres = 'bos@bulunamadi.miyop.local'
  }

  const istemci = createClient(url, anon, { auth: { persistSession: false } })
  const { data: oturum, error: girisHatasi } =
    await istemci.auth.signInWithPassword({ email: adres, password: sifre })

  if(girisHatasi || !oturum?.session){
    // ⚠️ Supabase'in kendi hata metni DIŞARI VERİLMEZ. "Email not
    // confirmed" ile "Invalid login credentials" farklı mesajlardır ve o
    // fark tam olarak sızdırmak istemediğimiz şeydir.
    return cevap({ hata: GENEL_HATA }, 401)
  }

  // ⚠️ Adres cevaba KONMUYOR. Tarayıcının onu bilmesine gerek yok ve
  // bilmesi MIYOP-043'ü geri açardı.
  return cevap({
    access_token: oturum.session.access_token,
    refresh_token: oturum.session.refresh_token,
    expires_in: oturum.session.expires_in,
    expires_at: oturum.session.expires_at,
    token_type: oturum.session.token_type,
  })
})
