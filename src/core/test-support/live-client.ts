// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · G7 — Canlı sınama istemcisi
//
// Uygulamanın `core/supabase.ts` tekil istemcisi ÜRETİM projesine bakar.
// Canlı testler oraya ASLA bağlanmamalıdır: `stock_movement` append-only bir
// defterdir (0003), yazılan sınama hareketi bir daha silinemez.
//
// Bu yüzden canlı testler kendi istemcilerini AYRI ortam değişkenlerinden
// kurar (`VITE_TEST_*`). Değişkenler yoksa testler ÇALIŞMAZ, atlanır —
// `npm test` her makinede yeşil kalmaya devam eder.
//
// Kurulum: `.env.test.local.example` dosyasını `.env.test.local` olarak
// kopyala ve doldur. `.gitignore` `.env.*.local` deseniyle onu zaten dışlıyor.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type LiveTestConfig = {
  url: string
  anonKey: string
  tenantA: { email: string; password: string }
  tenantB: { email: string; password: string }
}

const oku = (ad: string): string => {
  const v = (import.meta.env as Record<string, string | undefined>)[ad]
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Canlı sınama yapılandırması — eksikse `null`.
 *
 * ⚠️ ÜRETİM KORUMASI: sınama URL'i uygulamanın kendi `VITE_SUPABASE_URL`'iyle
 * AYNIYSA yapılandırma geçersiz sayılır. Bu, en tehlikeli kazayı (üretim
 * defterine sınama verisi yazmak) tek satırla imkânsız kılar.
 */
export const liveTestConfig = (): LiveTestConfig | null => {
  const url = oku('VITE_TEST_SUPABASE_URL')
  const anonKey = oku('VITE_TEST_SUPABASE_ANON_KEY')
  const emailA = oku('VITE_TEST_TENANT_A_EMAIL')
  const passwordA = oku('VITE_TEST_TENANT_A_PASSWORD')
  const emailB = oku('VITE_TEST_TENANT_B_EMAIL')
  const passwordB = oku('VITE_TEST_TENANT_B_PASSWORD')

  if (!url || !anonKey || !emailA || !passwordA || !emailB || !passwordB) return null
  if (!url.startsWith('https://')) return null

  const uygulamaUrl = oku('VITE_SUPABASE_URL')
  if (uygulamaUrl && uygulamaUrl === url) {
    throw new Error(
      'VITE_TEST_SUPABASE_URL, uygulamanın VITE_SUPABASE_URL değeriyle AYNI. ' +
      'Canlı testler üretim projesine bağlanamaz: stock_movement append-only bir ' +
      'defterdir, yazılan sınama verisi silinemez. G7 için AYRI bir Supabase projesi aç.'
    )
  }

  return {
    url,
    anonKey,
    tenantA: { email: emailA, password: passwordA },
    tenantB: { email: emailB, password: passwordB },
  }
}

/**
 * Verilen hesapla giriş yapmış, taze bir istemci döndürür.
 *
 * Her çağrı KENDİ istemcisini kurar ve oturumu belleğe alır
 * (`persistSession: false`): iki kiracının oturumu aynı depoyu paylaşırsa
 * biri diğerini ezer ve test yanlış sonuç verir.
 */
export const signedInClient = async (
  config: LiveTestConfig,
  hesap: { email: string; password: string }
): Promise<SupabaseClient> => {
  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { error } = await client.auth.signInWithPassword({
    email: hesap.email,
    password: hesap.password,
  })

  if (error) {
    throw new Error(
      `Sınama hesabıyla giriş yapılamadı (${hesap.email}): ${error.message}. ` +
      'Authentication → Users altında bu hesabın var olduğundan ve şifrenin ' +
      '.env.test.local ile aynı olduğundan emin ol.'
    )
  }

  // ── SAAT KAYMASI BEKLEMESİ ────────────────────────────────────────────
  // Jetonu Auth sunucusu basıyor, doğrulamayı ise veritabanı yapıyor. İki
  // tarafın saati birkaç saniye kayabiliyor; jetonun `iat` (düzenlenme anı)
  // alanı doğrulayanın saatine göre GELECEKTE kalırsa istek
  // "JWT issued at future" ile reddediliyor.
  //
  // Bu bir kod hatası değil, zamanlama sorunu — ve testin ölçtüğü şeyle
  // hiç ilgisi yok. Sessizce yutmak yerine kısa bir yeniden deneme yapıyoruz:
  // jeton birkaç saniye içinde "geçmişe" düşüyor ve istek geçiyor.
  //
  // Yeniden deneme YALNIZCA bu hataya özgü. Başka bir hata (yetki, ağ, RLS)
  // olduğu gibi yukarı taşınır — aksi hâlde gerçek bir arızayı gizlerdik.
  const enFazlaDeneme = 5
  for (let deneme = 1; deneme <= enFazlaDeneme; deneme++) {
    const { error: sinamaHatasi } = await client.from('tenant').select('id').limit(1)
    if (!sinamaHatasi) return client

    const saatKaymasi = /issued at future|JWSInvalidSignature|token used before issued/i
      .test(sinamaHatasi.message)
    if (!saatKaymasi || deneme === enFazlaDeneme) {
      throw new Error(
        `Sınama oturumu kullanılamadı (${hesap.email}): ${sinamaHatasi.message}` +
        (saatKaymasi
          ? ` — ${enFazlaDeneme} denemeye rağmen sürdü. Bilgisayarının saati ` +
            'Supabase sunucusundan belirgin şekilde ileride olabilir; Windows ' +
            'saat ayarlarından "Saati otomatik ayarla" ile eşitlemeyi dene.'
          : '')
      )
    }
    await new Promise(coz => setTimeout(coz, 1500))
  }

  return client
}

/** JWT'deki `tenant_id` claim'ini okur. Hook çalışmıyorsa `null`. */
export const tenantClaimOf = async (client: SupabaseClient): Promise<string | null> => {
  const { data } = await client.auth.getSession()
  const token = data.session?.access_token
  if (!token) return null
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf-8')
    ) as Record<string, unknown>
    return typeof payload.tenant_id === 'string' ? payload.tenant_id : null
  } catch {
    return null
  }
}
