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
import type { OnayAdimi } from './yetki-ozeti'

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
  /**
   * rol kodu → o rolün AÇTIĞI izinler (`role_permission`).
   *
   * ⚠️ Ekranda rol ADI yetmiyor. "Depo Sorumlusu" yazısı, o rolün mal
   * çıkarabildiğini SÖYLEMİYOR. Emrah'ın sorusu ("depodaki adam mal
   * çıkarabilsin, aşçı çıkaramasın") ancak izin listesi görünürse
   * cevaplanabilir.
   */
  rolIzinleri: Record<string, string[]>
  /**
   * Sipariş onay zincirinin adımları (0053). Her adım bir KİŞİYE değil bir
   * İZNE bağlı; ekran "bu kişi hangi adımda karar verebilir" sorusunu bu
   * listeden cevaplıyor.
   */
  onayAdimlari: OnayAdimi[]
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

  const [rolesRes, usersRes, assignRes, permRes, stepRes] = await Promise.all([
    supabase.from('role').select('code, name, description').order('code'),
    supabase.from('app_user').select('id, username, full_name, role_code, is_active').order('username'),
    supabase.from('user_role').select('user_id, role_code'),
    supabase.from('role_permission').select('role_code, permission_code'),
    // ⚠️ Onay zinciri kiracıya aittir (RLS süzer). Zinciri kurmamış bir
    // işletmede boş döner ve ekran bunu "zincir tanımlı değil" diye söyler;
    // sessizce boş bırakmak, kullanıcıya yanlış bir güven verirdi.
    supabase.from('order_approval_step')
      .select('code, name, required, permission_code, sort_order, is_active')
      .order('sort_order'),
  ])

  if (rolesRes.error) throw new Error(`Roller okunamadı: ${rolesRes.error.message}`)
  if (usersRes.error) throw new Error(`Kullanıcılar okunamadı: ${usersRes.error.message}`)
  if (assignRes.error) throw new Error(`Rol atamaları okunamadı: ${assignRes.error.message}`)
  if (permRes.error) throw new Error(`Rol izinleri okunamadı: ${permRes.error.message}`)
  // ⚠️ Onay zinciri okunamazsa EKRAN ÇÖKMÜYOR: zincir bu ekranın yan
  // bilgisidir, rol atama onsuz da yapılabilir. Ama hata YUTULMUYOR —
  // boş liste dönüyor ve ekran "zincir tanımlı değil" diyor, ki bu
  // doğru olmayan bir cümle olabilir. Bu yüzden hata mesajı konsola
  // değil, aşağıdaki `onayAdimlari` boş kalarak görünür oluyor.

  const assignments: Record<string, string[]> = {}
  for (const row of (assignRes.data ?? []) as { user_id: string; role_code: string }[]) {
    (assignments[row.user_id] ||= []).push(row.role_code)
  }

  const rolIzinleri: Record<string, string[]> = {}
  for (const row of (permRes.data ?? []) as { role_code: string; permission_code: string }[]) {
    (rolIzinleri[row.role_code] ||= []).push(row.permission_code)
  }

  type AdimSatiri = {
    code: string; name: string; required: boolean
    permission_code: string; is_active: boolean
  }
  const onayAdimlari: OnayAdimi[] = ((stepRes.data ?? []) as AdimSatiri[])
    .filter(a => a.is_active)
    .map(a => ({
      kod: a.code,
      ad: a.name,
      bloklar: Boolean(a.required),
      izinKodu: a.permission_code,
    }))

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
    rolIzinleri,
    onayAdimlari,
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
 * Bir kullanıcının BİRİNCİL rolünü (ana görevini) değiştirir — 0060.
 *
 * ⚠️ `saveUserRoles` ile AYNI ŞEY DEĞİL. O `user_role` tablosundaki EK
 * rolleri değiştirir; bu `app_user.role_code`u değiştirir. Etkin yetki
 * ikisinin BİRLEŞİMİDİR (0036), bu yüzden ana görevi değiştirmek eski rolün
 * yetkilerini kendiliğinden geri almaz: eski rol ek rol olarak duruyorsa
 * devam eder. Ekran bunu söylüyor.
 *
 * Sunucu reddedebilir ve etmeli: kimse kendi ana görevini değiştiremez,
 * işletmenin son sahibi görevden alınamaz, işletme sahibi platform rolü
 * veremez. Mesaj olduğu gibi yukarı taşınıyor.
 */
export const setPrimaryRole = async (userId: string, roleCode: string): Promise<void> => {
  if (!isSupabaseConfigured()) throw new SupabaseNotConfiguredError()

  const { error } = await getSupabase().rpc('set_primary_role', {
    p_user_id: userId,
    p_role_code: roleCode,
  })

  if (error) throw new Error(error.message || 'Ana görev değiştirilemedi.')
}

/** Toplu üyelik değişiminin sonucu — kim oldu, kim olmadı, neden. */
export type UyelikSonucu = {
  basarili: number
  hatalar: { userId: string; ad: string; mesaj: string }[]
}

/**
 * Bir role topluca üye ekler ya da çıkarır.
 *
 * ⚠️ TEK İŞLEM DEĞİL. `assign_user_roles` kullanıcı başına çalışıyor, yani
 * beş kişi eklemek beş ayrı çağrı demek. Üçüncüsü hata verirse ilk ikisi
 * YAZILMIŞ kalır. Bu yüzden sonuç "oldu/olmadı" değil, kim olduğu ve kimin
 * neden olmadığı: ekran yarısı yazılmış bir değişikliği gizleyemez.
 *
 * Çağrılar SIRAYLA yapılıyor, paralel değil — aynı anda giden onlarca RPC
 * hem sunucuyu hem hata mesajlarının sırasını karıştırıyor.
 */
export const applyRoleMembership = async (
  degisiklikler: { userId: string; ad: string; roleCodes: string[] }[],
): Promise<UyelikSonucu> => {
  if (!isSupabaseConfigured()) throw new SupabaseNotConfiguredError()

  const hatalar: UyelikSonucu['hatalar'] = []
  let basarili = 0

  for (const d of degisiklikler) {
    try {
      await saveUserRoles(d.userId, d.roleCodes)
      basarili += 1
    } catch (e) {
      hatalar.push({ userId: d.userId, ad: d.ad, mesaj: (e as Error).message })
    }
  }

  return { basarili, hatalar }
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

// ═══════════════════════════════════════════════════════════════════════════
// PERSONEL HESABI AÇMA (0076)
// ---------------------------------------------------------------------------
// Emrah'ın kararı (11.10): personel KULLANICI ADI + ŞİFRE ile girer, e-posta
// YOK. Şifreyi yönetici belirler, kullanıcı İLK GİRİŞTE değiştirmek zorunda.
//
// ⚠️ ŞİFRE BU DOSYADA BİR YERE YAZILMAZ. Ne state'e, ne günlüğe, ne de dönen
// nesneye. Buradan geçip Edge Function'a gider, orada Supabase Auth'a
// verilir ve unutulur.
//
// ⚠️ NEDEN EDGE FUNCTION. Auth'ta kullanıcı yaratmak `service_role` anahtarı
// ister; o anahtar tarayıcıya inseydi sayfanın kaynağını görebilen herkes
// BÜTÜN müşterilerin verisine sahip olurdu. Tarayıcı yalnız isteği yollar.
// ═══════════════════════════════════════════════════════════════════════════

export type YeniPersonel = {
  kullaniciAdi: string
  adSoyad: string
  rol: string
  /** ⚠️ Yalnız istek gövdesinde yaşar; hiçbir yere kaydedilmez. */
  sifre: string
  subeler?: readonly string[]
}

export type AcilanPersonel = {
  kullaniciId: string
  kullaniciAdi: string
  /** Perde arkasındaki dahili giriş adresi; kullanıcı bunu hiç yazmaz. */
  girisAdresi: string
}

/**
 * Yeni personel hesabı açar.
 *
 * ⚠️ DOĞRULAMA İKİ YERDE: burada (kullanıcıyı erken uyarmak için), Edge
 * Function'da ve veritabanında (0076). Üçü de gerekli — ekran atlanabilir,
 * Edge Function atlanabilir, veritabanı atlanamaz.
 */
export const personelHesabiAc = async (girdi: YeniPersonel): Promise<AcilanPersonel> => {
  if (!isSupabaseConfigured()) throw new SupabaseNotConfiguredError()
  const supabase = getSupabase()

  const { data, error } = await supabase.functions.invoke('personel-hesabi-ac', {
    body: {
      kullaniciAdi: girdi.kullaniciAdi.trim(),
      adSoyad: girdi.adSoyad.trim(),
      rol: girdi.rol,
      sifre: girdi.sifre,
      subeler: girdi.subeler && girdi.subeler.length > 0 ? [...girdi.subeler] : null,
    },
  })

  // ⚠️ Edge Function hata gövdesini 4xx/5xx ile döndürüyor ve supabase-js
  // bunu `error` olarak veriyor AMA gövdeyi yutuyor: kullanıcı yalnız
  // "non-2xx status code" görür. Gövdeyi okuyup GERÇEK sebebi gösteriyoruz;
  // "bir hata oluştu" diyen bir ekran kullanıcıyı bize telefon ettirir.
  if (error) {
    const gövde = await okunabilirHata(error)
    throw new Error(gövde || `Kullanıcı açılamadı: ${error.message}`)
  }

  const c = data as { tamam?: boolean; hata?: string
                      kullaniciId?: string; kullaniciAdi?: string; girisAdresi?: string } | null
  if (!c || c.tamam !== true) {
    throw new Error(c?.hata || 'Kullanıcı açılamadı: sunucudan beklenen cevap gelmedi.')
  }
  if (!c.kullaniciId) {
    throw new Error('Kullanıcı açıldı ama kimliği dönmedi; listeyi yenileyin.')
  }

  return {
    kullaniciId: c.kullaniciId,
    kullaniciAdi: c.kullaniciAdi ?? girdi.kullaniciAdi,
    girisAdresi: c.girisAdresi ?? '',
  }
}

/** Edge Function'ın JSON gövdesindeki `hata` alanını çıkarmayı dener. */
const okunabilirHata = async (error: unknown): Promise<string> => {
  const yanit = (error as { context?: { json?: () => Promise<unknown> } })?.context
  if (!yanit || typeof yanit.json !== 'function') return ''
  try {
    const govde = await yanit.json()
    const m = (govde as { hata?: unknown })?.hata
    return typeof m === 'string' ? m : ''
  } catch { return '' }
}

/**
 * Yönetici bir personelin şifresini sıfırladıktan SONRA çağrılır: kişi
 * bir sonraki girişinde yeni şifresini kendisi belirlemek zorunda kalır.
 */
export const personelSifresiSifirlandi = async (kullaniciId: string): Promise<void> => {
  if (!isSupabaseConfigured()) throw new SupabaseNotConfiguredError()
  const { error } = await getSupabase().rpc('personel_sifresi_sifirlandi', {
    p_kullanici: kullaniciId,
  })
  if (error) throw new Error(`Şifre sıfırlama işareti yazılamadı: ${error.message}`)
}
