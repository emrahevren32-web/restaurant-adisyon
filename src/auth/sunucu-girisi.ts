// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Girişi sunucuya taşımak · MIYOP-043
//
// ── NEDEN ────────────────────────────────────────────────────────────────
// Giriş iki adımdı: tarayıcı önce `giris_adresi_bul` ile adresi soruyor,
// sonra o adresle Supabase'e giriyordu. O RPC `anon`a açık ve Codex
// denetimi (18.10.2026) iki sızıntı gösterdi:
//   · bulunan kullanıcı için GERÇEK Auth e-postası dönüyordu,
//   · bulunamayan ad `@bulunamadi.miyop.local` ile dönüyordu — yani
//     cevabın biçimi "bu kullanıcı var mı" sorusunu parola bilmeden
//     cevaplıyordu.
//
// Artık adres çözümü ve parola doğrulaması `giris-yap` Edge Function'ında
// yapılıyor. Tarayıcı adresi HİÇ görmüyor.
//
// ── ⚠️ GEÇİŞ DÖNEMİ · BU YEDEK YOL SİLİNECEK ─────────────────────────────
// `giris-yap` canlıya dağıtılmadan `giris_adresi_bul`un `anon` hakkını
// almak, HERKESİ KAPIDA BIRAKIRDI. Bu yüzden sıra şudur:
//
//   1. (bu dosya) Edge Function birincil yol olur; ulaşılamazsa ESKİ yola
//      düşer. Sızıntı bu adımda hâlâ AÇIKTIR — yalnız olağan giriş
//      akışı artık sızdırmıyor.
//   2. Emrah fonksiyonu dağıtır ve girişin çalıştığını doğrular.
//   3. Göç **0091** `giris_adresi_bul`un `anon` hakkını alır VE bu
//      dosyadaki yedek yol SİLİNİR.
//
// ⚠️ 3. adım yapılmadan MIYOP-043 KAPANMIŞ SAYILMAZ. HEDEFLER 1.8'de
// madde olarak duruyor ve `giris-sunucuda.arch.test.ts` 2. adımdan
// sonra yedek yolun kalkmasını bekliyor.
// ═══════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseConfigured } from '../core/supabase'

/** Edge Function'dan dönen oturum. Adres BİLEREK yok. */
export type SunucuOturumu = {
  access_token: string
  refresh_token: string
}

export type SunucuGirisSonucu =
  | { durum: 'oldu'; oturum: SunucuOturumu }
  | { durum: 'reddedildi' }        // olmayan kullanıcı VEYA yanlış parola
  | { durum: 'ulasilamadi' }       // fonksiyon yok / ağ arızası → yedek yol

const gecerliOturum = (govde: unknown): govde is SunucuOturumu => {
  if(!govde || typeof govde !== 'object') return false
  const g = govde as Record<string, unknown>
  return typeof g.access_token === 'string' && g.access_token.length > 0
      && typeof g.refresh_token === 'string' && g.refresh_token.length > 0
}

/**
 * Girişi sunucuda yapar ve oturumu tarayıcıya kurar.
 *
 * ⚠️ `reddedildi` ile `ulasilamadi` AYRI şeylerdir ve karıştırılmamalıdır:
 * birincisi "yanlış giriş" (kullanıcıya söylenir), ikincisi "fonksiyona
 * ulaşamadım" (yedek yola düşülür). İkisini birleştirmek, dağıtım
 * yapılmadığı sürece herkesi kapıda bırakırdı.
 *
 * ⚠️ Parola buradan geçer ama HİÇBİR YERE yazılmaz: günlüğe değil,
 * localStorage'a değil, hata nesnesine değil.
 */
export const sunucudaGirisYap = async (
  giris: string,
  sifre: string,
  isletme?: string,
): Promise<SunucuGirisSonucu> => {
  if(!isSupabaseConfigured()) return { durum: 'ulasilamadi' }

  const supabase = getSupabase()

  let govde: unknown
  try {
    const { data, error } = await supabase.functions.invoke('giris-yap', {
      body: {
        giris: (giris || '').trim(),
        sifre,
        isletme: (isletme || '').trim() || undefined,
      },
    })
    if(error){
      // ⚠️ 401 = reddedildi (fonksiyon ÇALIŞTI ve "hayır" dedi).
      // Başka her şey = ulaşılamadı. `FunctionsHttpError` durumu
      // `context.status` içinde taşıyor.
      const durum = (error as { context?: { status?: number } })?.context?.status
      if(durum === 401) return { durum: 'reddedildi' }
      console.warn('[MİYOP] giris-yap çağrılamadı:', error.message)
      return { durum: 'ulasilamadi' }
    }
    govde = data
  } catch(e){
    console.warn('[MİYOP] giris-yap çağrılamadı:', e)
    return { durum: 'ulasilamadi' }
  }

  if(!gecerliOturum(govde)) return { durum: 'ulasilamadi' }

  const { error: oturumHatasi } = await supabase.auth.setSession({
    access_token: govde.access_token,
    refresh_token: govde.refresh_token,
  })
  if(oturumHatasi){
    console.warn('[MİYOP] Oturum kurulamadı:', oturumHatasi.message)
    return { durum: 'ulasilamadi' }
  }

  return { durum: 'oldu', oturum: govde }
}
