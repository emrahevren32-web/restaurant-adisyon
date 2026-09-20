// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Edge Function: isletme-hesabi-ac
//
// Onaylanmış bir başvuruya GİRİŞ HESABI açar ve davet e-postası gönderir.
//
// ── NEDEN TARAYICIDA DEĞİL ───────────────────────────────────────────────
// Supabase Auth'ta kullanıcı yaratmak `service_role` anahtarı ister. O
// anahtar tarayıcıya inseydi, sayfanın kaynağını görebilen herkes
// veritabanının tamamına — bütün müşterilerin verisine — sahip olurdu.
// Anahtar burada, Supabase'in sunucusunda durur; dışarı çıkmaz.
//
// ── NE YAPAR, SIRAYLA ────────────────────────────────────────────────────
//  1. Çağıranın kendi oturumuyla `platform.manage` iznini sorar.
//     ⚠️ İzni service_role ile SORMAZ: o her şeye "evet" derdi.
//  2. Auth'ta davet açar (inviteUserByEmail).
//  3. Dönen kimliği `app.isletme_kullanicisi_ac`a verir; app_user, rol,
//     şube erişimi ve başvuru damgası TEK İŞLEMDE orada yazılır.
//
// ── DÜRÜST SINIRLAR ──────────────────────────────────────────────────────
// · Davet e-postası Supabase'in yerleşik servisinden gider. Free planda
//   saatte birkaç e-posta sınırı vardır ve gönderen adres bize ait
//   değildir. Kendi SMTP'mize geçmek A5'in işi.
// · 2. adım başarılı olup 3. adım düşerse, Auth'ta sahipsiz bir davet
//   kalır. Bunu geri almak yerine AÇIKÇA SÖYLÜYORUZ (aşağıya bak):
//   sessizce silmek, "sildim" deyip silememek riskini taşırdı.
// ═══════════════════════════════════════════════════════════════════════════

// ⚠️ `npm:` öneki. Supabase panelinin kod düzenleyicisi bu biçimi her
// zaman çözüyor; `jsr:` bazı çalışma ortamlarında bulunamıyor ve fonksiyon
// daha ilk satırda çöküyor — dışarıdan görünen tek şey "non-2xx" oluyor.
import { createClient } from 'npm:@supabase/supabase-js@2'

const BASLIKLAR = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

/** Tek biçimli cevap. Ekran `hata` alanını kullanıcıya olduğu gibi gösterir. */
const cevap = (govde: Record<string, unknown>, durum = 200) => {
  // ⚠️ Her hata Logs'a da yazılıyor. Tarayıcıya giden cümle kısa ve
  // Türkçe; burada ise tam metin kalıyor, çünkü teşhis panelden yapılıyor.
  if (durum >= 400) console.error('[isletme-hesabi-ac]', durum, JSON.stringify(govde))
  return new Response(JSON.stringify(govde), { status: durum, headers: BASLIKLAR })
}

Deno.serve(async (istek: Request) => {
  if (istek.method === 'OPTIONS') return new Response('ok', { headers: BASLIKLAR })

  // ⚠️ Beklenmeyen bir çökme de ANLAŞILIR bir cevap dönmeli. Yakalanmayan
  // hata, tarayıcıya gövdesiz bir 500 olarak gider ve ekranda yalnızca
  // "non-2xx" görünür — yani sebep kaybolur.
  try {
    return await isleyici(istek)
  } catch (e) {
    const metin = e instanceof Error ? `${e.message}` : String(e)
    console.error('[isletme-hesabi-ac] beklenmeyen hata:', metin)
    return cevap({ hata: `Sunucu tarafında beklenmeyen hata: ${metin}` }, 500)
  }
})

// Bildirim biçiminde (arrow değil): böylece `Deno.serve` modül daha
// yüklenirken bir istek alsa bile bu ad tanımlı olur.
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

  let basvuruId = ''
  let yonlendirme: string | undefined
  try {
    const govde = await istek.json()
    basvuruId = String(govde?.basvuruId ?? '')
    if (typeof govde?.yonlendirme === 'string') yonlendirme = govde.yonlendirme
  } catch {
    return cevap({ hata: 'İstek gövdesi okunamadı.' }, 400)
  }
  if (!/^[0-9a-f-]{36}$/i.test(basvuruId)) {
    return cevap({ hata: 'Başvuru kimliği geçersiz.' }, 400)
  }

  // ── 1 · Yetki, ÇAĞIRANIN kendi oturumuyla ───────────────────────────────
  const cagiran = createClient(url, anon, {
    global: { headers: { Authorization: yetkiBasligi } },
    auth: { persistSession: false },
  })

  const { data: yetkili, error: yetkiHatasi } = await cagiran.rpc('yetkim_var', {
    p_izin: 'platform.manage',
  })
  if (yetkiHatasi) {
    return cevap({ hata: `Yetki sorulamadı: ${yetkiHatasi.message}` }, 500)
  }
  if (yetkili !== true) {
    return cevap({ hata: 'Giriş hesabı açmak için platform yetkisi gerekir.' }, 403)
  }

  // ── 2 · Başvuruyu oku (yetki doğrulandıktan SONRA) ──────────────────────
  const yonetim = createClient(url, servis, { auth: { persistSession: false } })

  const { data: basvuru, error: okumaHatasi } = await yonetim
    .from('business_application')
    .select('id, status, email, owner_name, company_name, owner_user_id')
    .eq('id', basvuruId)
    .maybeSingle()

  if (okumaHatasi) return cevap({ hata: `Başvuru okunamadı: ${okumaHatasi.message}` }, 500)
  if (!basvuru) return cevap({ hata: 'Başvuru bulunamadı.' }, 404)
  if (basvuru.status !== 'APPROVED') {
    return cevap({ hata: 'Giriş hesabı yalnız onaylanmış başvuru için açılır.' }, 400)
  }
  if (basvuru.owner_user_id) {
    return cevap({ hata: 'Bu işletmenin giriş hesabı zaten açılmış.' }, 409)
  }

  // ── 3 · Auth'ta davet ───────────────────────────────────────────────────
  const { data: davet, error: davetHatasi } = await yonetim.auth.admin.inviteUserByEmail(
    basvuru.email,
    {
      redirectTo: yonlendirme,
      data: { firma: basvuru.company_name, yetkili: basvuru.owner_name },
    },
  )

  if (davetHatasi || !davet?.user?.id) {
    const metin = davetHatasi?.message ?? 'Auth kullanıcı kimliği dönmedi.'
    // Sınırı kullanıcının anlayacağı cümleye çeviriyoruz; ham metni de
    // ekliyoruz ki gerçek sebep kaybolmasın.
    const hizSiniri = /rate limit|too many/i.test(metin)
    return cevap({
      hata: hizSiniri
        ? `Davet e-postası gönderilemedi: Supabase'in e-posta sınırına takıldık. ` +
          `Bir süre sonra tekrar deneyin. (${metin})`
        : `Davet e-postası gönderilemedi: ${metin}`,
    }, 502)
  }

  // ── 4 · Veritabanı tarafı, tek işlemde ──────────────────────────────────
  // ⚠️ `public` şeması. PostgREST yalnız onu yayınlar; `app` şemasını
  // çağırmak "The schema must be one of the following: public,
  // graphql_public" hatası verirdi. Bu depoda dördüncü kez aynı ders.
  const { data: kurulum, error: kurulumHatasi } = await yonetim
    .rpc('isletme_kullanicisi_ac', {
      p_basvuru_id: basvuruId,
      p_auth_user_id: davet.user.id,
    })

  if (kurulumHatasi) {
    // ⚠️ Auth'ta davet AÇILDI ama bağlanamadı. Sessizce geçmiyoruz.
    return cevap({
      hata:
        `Davet gönderildi ama hesap işletmeye bağlanamadı: ${kurulumHatasi.message}. ` +
        `Supabase panelinde Authentication → Users altında ${basvuru.email} için ` +
        `bekleyen bir davet kaldı; tekrar denemeden önce onu silin.`,
    }, 500)
  }

  const satir = Array.isArray(kurulum) ? kurulum[0] : kurulum
  return cevap({
    tamam: true,
    kullaniciId: satir?.kullanici_id ?? null,
    kullaniciAdi: satir?.kullanici_adi ?? null,
    eposta: satir?.eposta ?? basvuru.email,
    kiraciKodu: satir?.kiraci_kodu ?? null,
  })
}
