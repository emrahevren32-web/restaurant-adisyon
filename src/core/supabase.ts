import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase istemcisi — uygulamanın sunucuyla konuştuğu tek nokta.
 *
 * ADR-005: bu bağımlılık KASTEN tek dosyada toplanmıştır. Ekranlar ve servisler
 * `supabase.from(...)` yazmaz; repository katmanı üzerinden geçerler (G6).
 * Bu kural tutulduğu sürece ileride başka bir sağlayıcıya geçmek bir uygulama
 * sınıfını değiştirmekten ibaret kalır.
 *
 * Yapılandırma yoksa uygulama ÇALIŞMAYA DEVAM EDER; henüz localStorage
 * katmanındayız ve geçiş dilim dilim yapılıyor. Bu yüzden istemci null
 * olabilir ve çağıranlar `isSupabaseConfigured()` ile kontrol eder.
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || ''

const looksConfigured = (
  url.startsWith('https://')
  && anonKey.length > 20
  && !anonKey.startsWith('BURAYA')
)

const client: SupabaseClient | null = looksConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
  : null

export const isSupabaseConfigured = () => client !== null

export const getSupabase = (): SupabaseClient => {
  if(!client){
    throw new Error(
      'Supabase yapılandırılmamış. Proje kökünde .env.local dosyasını oluşturup '
      + 'VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY değerlerini yazın. '
      + 'Şablon: .env.example'
    )
  }
  return client
}

/** Yapılandırma özeti — anahtarı ASLA döndürmez, sadece var olup olmadığını söyler. */
export const describeSupabaseConfig = () => ({
  configured: isSupabaseConfigured(),
  url: url ? url.replace(/^https:\/\/([^.]{4})[^.]*/, 'https://$1…') : '(yok)',
  anonKeyPresent: anonKey.length > 20
})
