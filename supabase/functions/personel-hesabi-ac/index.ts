// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Edge Function: personel-hesabi-ac
//
// Mevcut bir işletmeye PERSONEL hesabı açar. `isletme-hesabi-ac`ın kardeşi
// ama iki yerde ondan ayrılıyor:
//
//   1. E-POSTA YOK, E-POSTA GİTMİYOR. Emrah'ın kararı (11.10): bir
//      depocunun iş e-postası çoğu zaman yoktur. Kişi "depocu" yazıp
//      girer; perde arkasında hiçbir zaman posta gitmeyecek dahili bir
//      adres kullanılır (`depocu@abcgida.miyop.local`).
//      ⚠️ Yan kazanç: ücretsiz plandaki "saatte birkaç davet e-postası"
//      sınırı tamamen devre dışı kalıyor. 15 personel = 0 e-posta.
//
//   2. ŞİFREYİ YÖNETİCİ BELİRLER. Karşılığında üç şart (Emrah onayladı):
//      · şifre MİYOP'un veritabanına HİÇ yazılmaz — yalnız Supabase
//        Auth'un özeti durur (0076'da bunu sınayan bir doğrulama var),
//      · hiçbir günlüğe/denetim kaydına/hata bildirimine düşmez,
//      · kullanıcı İLK GİRİŞTE değiştirmek ZORUNDADIR
//        (`app_user.must_change_password`, 0076).
//
// ── NEDEN TARAYICIDA DEĞİL ───────────────────────────────────────────────
// Auth'ta kullanıcı yaratmak `service_role` anahtarı ister. O anahtar
// tarayıcıya inseydi sayfanın kaynağını görebilen herkes BÜTÜN
// müşterilerin verisine sahip olurdu. Anahtar burada kalır.
//
// ── NE YAPAR, SIRAYLA ────────────────────────────────────────────────────
//  1. Çağıranın KENDİ oturumuyla `users.manage` iznini sorar.
//     ⚠️ service_role ile sormaz: o her şeye "evet" der.
//  2. Çağıranın kiracısını bulur, giriş adresini VERİTABANINA ürettirir.
//     ⚠️ Adres burada üretilmiyor: iki yerde üretilseydi biri değişince
//     kullanıcı sessizce giriş yapamaz olurdu.
//  3. Auth'ta kullanıcıyı yaratır (`email_confirm: true` — doğrulama
//     postası GÖNDERİLMEZ, hesap anında kullanılabilir).
//  4. Dönen kimliği `public.personel_hesabi_ac`a verir; app_user, rol,
//     şube erişimi ve zorunlu şifre bayrağı TEK İŞLEMDE orada yazılır.
//     ⚠️ Bu çağrı ÇAĞIRANIN oturumuyla yapılır: kiracı duvarı ve yetki
//     kontrolü oradan okunuyor.
//  5. 4. adım düşerse 3. adımda yaratılan Auth kullanıcısı SİLİNİR.
//     Silinemezse bu AÇIKÇA söylenir — sessizce yutulmaz.
// ═══════════════════════════════════════════════════════════════════════════

// ⚠️ `npm:` öneki. Panelin kod düzenleyicisi bunu her zaman çözüyor;
// `jsr:` bazı ortamlarda bulunamıyor ve fonksiyon ilk satırda çöküyor.
import { createClient } from 'npm:@supabase/supabase-js@2'

const BASLIKLAR = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const cevap = (govde: Record<string, unknown>, durum = 200) => {
  // ⚠️ GÖVDE GÜNLÜĞE YAZILIRKEN ŞİFRE ASLA İÇİNDE OLMAZ. Bu fonksiyonda
  // `sifre` hiçbir zaman bir cevap nesnesine konmuyor; buraya da gelmez.
  if (durum >= 400) console.error('[personel-hesabi-ac]', durum, JSON.stringify(govde))
  return new Response(JSON.stringify(govde), { status: durum, headers: BASLIKLAR })
}

Deno.serve(async (istek: Request) => {
  if (istek.method === 'OPTIONS') return new Response('ok', { headers: BASLIKLAR })
  try {
    return await isleyici(istek)
  } catch (e) {
    const metin = e instanceof Error ? e.message : String(e)
    console.error('[personel-hesabi-ac] beklenmeyen hata:', metin)
    return cevap({ hata: `Sunucu tarafında beklenmeyen hata: ${metin}` }, 500)
  }
})

async function isleyici(istek: Request): Promise<Response> {
  if (istek.method !== 'POST') return cevap({ hata: 'Yalnız POST.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const servis = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !servis) {
    return cevap({ hata: 'Sunucu yapılandırması eksik.' }, 500)
  }

  const yetkiBasligi = istek.headers.get('Authorization') ?? ''
  if (!yetkiBasligi.startsWith('Bearer ')) {
    return cevap({ hata: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' }, 401)
  }

  let kullaniciAdi = ''
  let adSoyad = ''
  let rol = ''
  let sifre = ''
  let subeler: string[] | null = null
  try {
    const govde = await istek.json()
    kullaniciAdi = String(govde?.kullaniciAdi ?? '').trim()
    adSoyad = String(govde?.adSoyad ?? '').trim()
    rol = String(govde?.rol ?? '').trim()
    sifre = String(govde?.sifre ?? '')
    if (Array.isArray(govde?.subeler) && govde.subeler.length > 0) {
      subeler = govde.subeler.map((s: unknown) => String(s))
    }
  } catch {
    return cevap({ hata: 'İstek gövdesi okunamadı.' }, 400)
  }

  if (kullaniciAdi.length < 3) {
    return cevap({ hata: 'Kullanıcı adı en az 3 karakter olmalı.' }, 400)
  }
  if (adSoyad.length < 2) {
    return cevap({ hata: 'Ad soyad yazılmalı; defterde "kim yaptı" diye görünecek.' }, 400)
  }
  if (!rol) return cevap({ hata: 'Rol seçilmeli.' }, 400)
  // ⚠️ Uzunluk DIŞINDA bir kural koymuyoruz. "Büyük harf + rakam + simge"
  // kuralları insanları `Sifre123!` yazmaya iter; uzunluk daha iyi korur.
  // Zaten ilk girişte değiştirilecek.
  if (sifre.length < 8) {
    return cevap({ hata: 'Geçici şifre en az 8 karakter olmalı.' }, 400)
  }

  // ── 1 · Yetki, ÇAĞIRANIN kendi oturumuyla ───────────────────────────────
  const cagiran = createClient(url, anon, {
    global: { headers: { Authorization: yetkiBasligi } },
    auth: { persistSession: false },
  })

  const { data: yetkili, error: yetkiHatasi } = await cagiran.rpc('yetkim_var', {
    p_izin: 'users.manage',
  })
  if (yetkiHatasi) return cevap({ hata: `Yetki sorulamadı: ${yetkiHatasi.message}` }, 500)
  if (yetkili !== true) {
    return cevap({ hata: 'Kullanıcı açmak için yetkiniz yok (`users.manage`).' }, 403)
  }

  // ── 2 · Kiracı ve giriş adresi ──────────────────────────────────────────
  const { data: oturum, error: oturumHatasi } = await cagiran.auth.getUser()
  if (oturumHatasi || !oturum?.user?.id) {
    return cevap({ hata: 'Oturum doğrulanamadı.' }, 401)
  }

  const { data: ben, error: benHatasi } = await cagiran
    .from('app_user')
    .select('tenant_id')
    .eq('auth_user_id', oturum.user.id)
    .maybeSingle()
  if (benHatasi) return cevap({ hata: `İşletme okunamadı: ${benHatasi.message}` }, 500)
  if (!ben?.tenant_id) return cevap({ hata: 'Kullanıcı kaydınız bulunamadı.' }, 403)

  // ⚠️ Adres VERİTABANINDA üretiliyor (0076). Burada string birleştirmek,
  // kuralın iki yere kopyalanması demek olurdu.
  const { data: girisAdresi, error: adresHatasi } = await cagiran.rpc(
    'personel_giris_adresi',
    { p_kiraci: ben.tenant_id, p_kullanici_adi: kullaniciAdi },
  )
  if (adresHatasi || !girisAdresi) {
    return cevap({ hata: `Giriş adresi üretilemedi: ${adresHatasi?.message ?? '—'}` }, 500)
  }

  // ── 3 · Auth kullanıcısı ────────────────────────────────────────────────
  const yonetim = createClient(url, servis, { auth: { persistSession: false } })

  // ⚠️ `email_confirm: true` — doğrulama postası GÖNDERİLMEZ ve hesap
  // anında kullanılabilir. Bu fonksiyonun hiç e-posta göndermemesinin
  // sebebi tam olarak bu satır.
  const { data: yeni, error: authHatasi } = await yonetim.auth.admin.createUser({
    email: String(girisAdresi),
    password: sifre,
    email_confirm: true,
    user_metadata: { ad_soyad: adSoyad, kullanici_adi: kullaniciAdi, tur: 'personel' },
  })

  if (authHatasi || !yeni?.user?.id) {
    const m = authHatasi?.message ?? 'bilinmeyen sebep'
    if (/already been registered/i.test(m)) {
      return cevap({
        hata: `"${kullaniciAdi}" kullanıcı adı bu işletmede daha önce kullanılmış. `
          + 'Başka bir kullanıcı adı seçin.',
      }, 409)
    }
    return cevap({ hata: `Giriş hesabı açılamadı: ${m}` }, 500)
  }

  // ── 4 · İşletme kaydı — ÇAĞIRANIN oturumuyla ───────────────────────────
  // ⚠️ service_role ile çağrılsaydı `app.current_tenant_id()` boş döner ve
  // `yetkim_var` false verirdi; kiracı duvarı buradan okunuyor.
  const { data: kayit, error: kayitHatasi } = await cagiran.rpc('personel_hesabi_ac', {
    p_auth_user_id: yeni.user.id,
    p_kullanici_adi: kullaniciAdi,
    p_ad_soyad: adSoyad,
    p_rol: rol,
    p_subeler: subeler,
  })

  if (kayitHatasi) {
    // ── 5 · Geri al ───────────────────────────────────────────────────────
    // ⚠️ Burada silmek GÜVENLİ: bu kullanıcıyı saniyeler önce biz yarattık
    // ve adresi yalnız bu işletmeye ait dahili bir adres. (Kardeş
    // fonksiyonda silmiyoruz çünkü orada adres müşterinin gerçek
    // e-postası ve başka bir işletmeye de bağlı olabiliyor.)
    const { error: silmeHatasi } = await yonetim.auth.admin.deleteUser(yeni.user.id)
    if (silmeHatasi) {
      return cevap({
        hata: `Kullanıcı kaydı yazılamadı (${kayitHatasi.message}). `
          + 'Giriş hesabı da silinemedi — Supabase panelinden '
          + `"${girisAdresi}" adresli kullanıcıyı elle silin.`,
      }, 500)
    }
    return cevap({ hata: `Kullanıcı açılamadı: ${kayitHatasi.message}` }, 400)
  }

  const satir = Array.isArray(kayit) ? kayit[0] : kayit

  // ⚠️ ŞİFRE CEVAPTA YOK. Ekran onu zaten biliyor (yönetici yazdı);
  // buradan geri döndürmek, tarayıcı geçmişine ve günlüklere sızma
  // ihtimali eklemekten başka bir işe yaramazdı.
  return cevap({
    tamam: true,
    kullaniciId: satir?.kullanici_id ?? null,
    kullaniciAdi: satir?.kullanici_adi ?? kullaniciAdi,
    girisAdresi: satir?.giris_adresi ?? girisAdresi,
    not: 'Kullanıcı ilk girişinde şifresini değiştirmek zorunda.',
  })
}
