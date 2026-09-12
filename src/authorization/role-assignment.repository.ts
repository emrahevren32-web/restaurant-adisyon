// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 1 — Rol atama veri erişimi
//
// Emrah'ın talebi: "oluşturulan her personel için roller tiklenmeli ona göre de
// hareket kabiliyeti olmalı."
//
// Bu dosya o ekranın veri tarafıdır. Üç şey okur (kullanıcılar, roller, mevcut
// atamalar) ve bir şey yazar (atama) — yazma İŞLEMİ DOĞRUDAN TABLOYA GİTMEZ,
// `public.assign_user_roles` RPC'sinden geçer.
//
// ── NEDEN RPC, NEDEN DOĞRUDAN TABLO DEĞİL ─────────────────────────────────
// `0015` `user_role` tablosuna `authenticated` rolü için yalnızca SELECT verdi;
// INSERT/UPDATE/DELETE açıkça geri alındı. Sebebi `0012`'de öğrenilen ders:
// RLS satırı korur ama SATIRIN İÇERİĞİNİ korumaz. Tabloya doğrudan yazma
// yetkisi verilseydi, herhangi bir personel kendi user_id'sine
// `isletme_sahibi` rolü yazabilirdi — RLS bunu engellemezdi, çünkü satır kendi
// tenant'ında geçerli bir satır olurdu.
//
// RPC ise yetkiyi kendi içinde denetler: çağıran aktif bir yönetici mi, hedef
// kullanıcı aynı işletmede mi, ve istenen rol atanabilir mi (işletme sahibi
// `admin`/`super_admin` atayamaz). Bkz. docs/yetki-cercevesi.md §3, Kural 3.
// ═══════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseConfigured } from '../core/supabase'

export type AssignableRole = {
  code: string
  name: string
  description: string
}

export type TenantUser = {
  id: string
  username: string
  fullName: string
  primaryRoleCode: string
  isActive: boolean
}

/** Rol atama ekranının ihtiyaç duyduğu her şey, tek seferde. */
export type RoleAssignmentData = {
  roles: AssignableRole[]
  users: TenantUser[]
  /** kullanıcı id → o kullanıcıya atanmış EK rol kodları (user_role) */
  assignments: Record<string, string[]>
}

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super('Veritabanı bağlantısı yapılandırılmamış. Rol atama yalnızca canlı bağlantıyla çalışır.')
    this.name = 'SupabaseNotConfiguredError'
  }
}

/**
 * Ekranın tüm verisini yükler.
 *
 * Kullanıcı listesi `app_user` tablosundan gelir — `storage.ts`'teki
 * localStorage listesinden DEĞİL. Rol ataması gerçek veritabanı kaydıdır;
 * onu sahte bir kullanıcı listesi üzerinden yapmak, ekranda görünenle
 * veritabanında olanın ayrışmasına yol açardı.
 *
 * RLS zaten tenant süzmesini yapıyor (ADR-004), bu yüzden burada ayrıca
 * `tenant_id` filtresi YOK: kullanıcı zaten yalnızca kendi işletmesinin
 * satırlarını görebilir.
 */
export const loadRoleAssignmentData = async (): Promise<RoleAssignmentData> => {
  if (!isSupabaseConfigured()) throw new SupabaseNotConfiguredError()

  const supabase = getSupabase()

  const [rolesRes, usersRes, assignRes] = await Promise.all([
    supabase.from('role').select('code, name, description').order('code'),
    supabase.from('app_user').select('id, username, full_name, role_code, is_active').order('username'),
    supabase.from('user_role').select('user_id, role_code'),
  ])

  if (rolesRes.error) throw new Error(`Roller okunamadı: ${rolesRes.error.message}`)
  if (usersRes.error) throw new Error(`Kullanıcılar okunamadı: ${usersRes.error.message}`)
  if (assignRes.error) throw new Error(`Rol atamaları okunamadı: ${assignRes.error.message}`)

  const assignments: Record<string, string[]> = {}
  for (const row of (assignRes.data ?? []) as { user_id: string; role_code: string }[]) {
    (assignments[row.user_id] ||= []).push(row.role_code)
  }

  return {
    roles: ((rolesRes.data ?? []) as any[]).map(r => ({
      code: r.code as string,
      name: (r.name as string) ?? r.code,
      description: (r.description as string) ?? '',
    })),
    users: ((usersRes.data ?? []) as any[]).map(u => ({
      id: u.id as string,
      username: (u.username as string) ?? '',
      fullName: (u.full_name as string) ?? '',
      primaryRoleCode: (u.role_code as string) ?? '',
      isActive: Boolean(u.is_active),
    })),
    assignments,
  }
}

/**
 * Bir kullanıcının EK rollerini topluca değiştirir.
 *
 * ⚠️ TAM DEĞİŞİM: gönderilen liste yeni gerçektir, gönderilmeyen roller silinir.
 * Ekran bu yüzden her zaman o kullanıcının TÜM tiklerini gönderir, farkı değil.
 *
 * Yetki denetimi sunucu tarafındadır (`assign_user_roles`). Buradaki hiçbir
 * kontrol güvenlik sınırı değildir; RPC hata döndürürse mesajı olduğu gibi
 * yukarı taşınır ki kullanıcı NEDEN reddedildiğini görsün.
 */
export const saveUserRoles = async (userId: string, roleCodes: string[]): Promise<void> => {
  if (!isSupabaseConfigured()) throw new SupabaseNotConfiguredError()

  const { error } = await getSupabase().rpc('assign_user_roles', {
    p_user_id: userId,
    p_role_codes: roleCodes,
  })

  if (error) {
    // MI403 = yetki yok, MI400 = geçersiz rol (bkz. 0015). Kullanıcıya
    // veritabanının kendi Türkçe mesajı gösteriliyor — "bir hata oluştu"
    // demek yerine, neden reddedildiğini söylemek.
    throw new Error(error.message || 'Rol ataması kaydedilemedi.')
  }
}

/**
 * Bu kullanıcı rol atayabilir mi?
 *
 * Yalnızca ARAYÜZ içindir — butonu gizlemek/göstermek için. Gerçek karar
 * sunucuda, `assign_user_roles` içinde verilir; buradaki kontrol atlansa bile
 * RPC reddeder.
 */
export const canAssignRoles = (permissions: readonly string[] | undefined | null): boolean => {
  if (!permissions) return false
  return permissions.includes('users.manage') || permissions.includes('roles.manage')
}

/**
 * İşletme sahibinin dağıtamayacağı roller (0015 ile aynı kural).
 *
 * Arayüzde bu roller tiklenebilir görünmez; sunucu zaten reddeder ama
 * kullanıcıya reddedilecek bir kutu göstermek kötü bir deneyimdir.
 */
export const PLATFORM_ROLE_CODES = ['super_admin', 'admin']

export const assignableRolesFor = (
  roles: AssignableRole[],
  assignerPrimaryRoleCode: string
): AssignableRole[] => {
  if (assignerPrimaryRoleCode === 'super_admin') return roles
  if (assignerPrimaryRoleCode === 'admin') {
    return roles.filter(r => r.code !== 'super_admin')
  }
  return roles.filter(r => !PLATFORM_ROLE_CODES.includes(r.code))
}
