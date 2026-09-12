// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 1 — Kullanıcının izinlerini VERİTABANINDAN okur
//
// Yol haritası: "PERMISSION_CATALOG (15 izin) tablolara taşındı /
//                Yetkisiz uç yok, varsayılan reddet"
//
// Bundan önce izinler `role.service.ts` içindeki sabit `DEFAULT_ROLES`
// dizisinden, üstelik `app_user.role_code` yerine `identity.userType` üzerinden
// geliyordu. Yani veritabanındaki `permission` / `role_permission` tabloları
// (0001'de kurulmuşlardı) uygulama tarafından HİÇ OKUNMUYORDU.
//
// ── VARSAYILAN REDDET ─────────────────────────────────────────────────────
// Bu dosyanın en önemli davranışı: emin olmadığı hiçbir durumda izin VERMEZ.
// İki farklı "izin yok" durumu var ve ikisi farklı ele alınıyor:
//
//   1. Sorgu BAŞARILI, sonuç boş  → kullanıcının gerçekten izni yok.
//      Boş dizi döner. Kullanıcı girer ama hiçbir ekran görmez. Doğru davranış.
//
//   2. Sorgu BAŞARISIZ (ağ hatası, RLS, tablo yok) → izinler BİLİNMİYOR.
//      `null` döner. Çağıran taraf (`authenticateUser`) bunu girişi REDDETME
//      sebebi sayar — yarım yetkili bir oturum açmaz.
//
// İkisini ayırmak şart: "izni yok" ile "izinlerini okuyamadım" aynı şey değil.
// Birincisinde kullanıcı içeri girip boş bir ekran görmeli; ikincisinde hiç
// girmemeli. `null` ile `[]` arasındaki fark tam olarak budur.
// ═══════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { normalizePermissions } from './permission.service'
import type { PermissionName } from './permission.types'

/**
 * Kullanıcının EK rollerini (`user_role`, 0015) okur.
 *
 * Küçük bir işletmede bir kişi birden çok şapka takar — depo sorumlusu aynı
 * zamanda satın almacı olabilir. `app_user.role_code` tek rol tuttuğu için
 * ek roller ayrı bir tabloda duruyor; etkin küme ikisinin BİRLEŞİMİdir.
 *
 * Hata durumunda boş dizi döner, `null` DEĞİL — ve bu bilinçli: `user_role`
 * tablosu 0015 çalıştırılmadan önce mevcut değil. Bu sorgunun başarısızlığı
 * girişi engellememeli, kullanıcı en azından birincil rolüyle çalışabilmeli.
 * Asıl sorgu (`role_permission`) başarısız olursa giriş yine reddedilir.
 */
const loadExtraRoleCodes = async (userId: string): Promise<string[]> => {
  if (!userId) return []
  try {
    const { data, error } = await getSupabase()
      .from('user_role')
      .select('role_code')
      .eq('user_id', userId)

    if (error) return []
    return (data ?? []).map((row: { role_code: string }) => row.role_code)
  } catch {
    return []
  }
}

/**
 * Kullanıcının ETKİN izinlerini okur: birincil rol ∪ ek roller.
 *
 * @param userId          `app_user.id` — ek rolleri bulmak için
 * @param primaryRoleCode `app_user.role_code` — birincil rol
 * @returns İzin listesi (boş olabilir), ya da okunamadıysa `null`.
 *          `null` "izin yok" DEĞİL, "bilinmiyor" demektir — bkz. dosya başı notu.
 */
export const loadPermissionsForUser = async (
  userId: string,
  primaryRoleCode: string
): Promise<PermissionName[] | null> => {
  if (!isSupabaseConfigured()) return null
  if (!primaryRoleCode) return []

  try {
    const extraRoles = await loadExtraRoleCodes(userId)
    const roleCodes = Array.from(new Set([primaryRoleCode, ...extraRoles]))

    const { data, error } = await getSupabase()
      .from('role_permission')
      .select('permission_code')
      .in('role_code', roleCodes)

    if (error) return null

    const codes = (data ?? []).map((row: { permission_code: string }) => row.permission_code)

    // `normalizePermissions` kod kataloğunda TANINMAYAN izinleri eler.
    // Veritabanında kodun bilmediği bir izin varsa (ör. ileride eklenmiş ama
    // henüz kodda karşılığı olmayan), sessizce yok sayılır — tanımadığı bir
    // yetkiyi geçerli saymak, varsayılan reddet ilkesine aykırı olurdu.
    return normalizePermissions(codes)
  } catch {
    return null
  }
}
