// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 1 — Rol atama testleri
//
// `SupabaseClient` sahte (fake). Sınanan şey: doğru tabloların okunduğu, RPC'nin
// doğru parametrelerle çağrıldığı, ve arayüzün hangi rolleri tiklenebilir
// gösterdiği.
//
// ⚠️ Bu testler YETKİYİ SINAMAZ. Yetki kararı `public.assign_user_roles`
// içinde, veritabanında verilir (0015) — istemci tarafındaki
// `assignableRolesFor` yalnızca kutu göstermemek içindir. Buradaki bir testin
// geçmesi "işletme sahibi admin rolü atayamaz" iddiasını KANITLAMAZ; onu
// kanıtlayan şey RPC'nin kendisidir ve canlı sınaması ayrıca yapılmalıdır.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockIsConfigured = vi.fn(() => true)
const mockGetSupabase = vi.fn()

vi.mock('../core/supabase', () => ({
  isSupabaseConfigured: () => mockIsConfigured(),
  getSupabase: () => mockGetSupabase(),
}))

import {
  loadRoleAssignmentData,
  saveUserRoles,
  canAssignRoles,
  assignableRolesFor,
  SupabaseNotConfiguredError,
  type AssignableRole,
} from './role-assignment.repository'

const ROLLER: AssignableRole[] = [
  { code: 'super_admin', name: 'Platform Yöneticisi', description: '' },
  { code: 'admin', name: 'Platform Sahibi', description: '' },
  { code: 'isletme_sahibi', name: 'İşletme Sahibi', description: '' },
  { code: 'depo_sorumlusu', name: 'Depo Sorumlusu', description: '' },
]

beforeEach(() => {
  mockIsConfigured.mockReturnValue(true)
  mockGetSupabase.mockReset()
})

describe('canAssignRoles · arayüz kapısı', () => {
  it('users.manage veya roles.manage varsa açılır', () => {
    expect(canAssignRoles(['users.manage'])).toBe(true)
    expect(canAssignRoles(['roles.manage'])).toBe(true)
  })

  it('yalnızca okuma izni yetmez', () => {
    expect(canAssignRoles(['users.read', 'stock.read'])).toBe(false)
  })

  it('izin yoksa veya bilinmiyorsa kapalı', () => {
    expect(canAssignRoles([])).toBe(false)
    expect(canAssignRoles(undefined)).toBe(false)
  })
})

describe('assignableRolesFor · hangi kutular gösterilir', () => {
  it('platform yöneticisi her rolü atayabilir', () => {
    expect(assignableRolesFor(ROLLER, 'super_admin').map(r => r.code))
      .toEqual(['super_admin', 'admin', 'isletme_sahibi', 'depo_sorumlusu'])
  })

  it('admin, super_admin DIŞINDA her rolü atayabilir', () => {
    expect(assignableRolesFor(ROLLER, 'admin').map(r => r.code))
      .toEqual(['admin', 'isletme_sahibi', 'depo_sorumlusu'])
  })

  it('işletme sahibi platform rollerini (admin/super_admin) HİÇ göremez', () => {
    // "Firma sahibi benim işimi bozamamalı" kuralının arayüz tarafı.
    // Asıl engel RPC'de — bu yalnızca reddedilecek kutuyu göstermemek için.
    expect(assignableRolesFor(ROLLER, 'isletme_sahibi').map(r => r.code))
      .toEqual(['isletme_sahibi', 'depo_sorumlusu'])
  })
})

describe('loadRoleAssignmentData', () => {
  it('beş tabloyu okur, atamaları ve rol izinlerini gruplar', async () => {
    const okunanTablolar: string[] = []
    mockGetSupabase.mockReturnValue({
      // 0078: `loadRoleAssignmentData` artık giriş adlarını da okuyor
      // (`giris_adlari` RPC). Göç uygulanmamış kurulumda bu RPC YOKTUR ve
      // ekran yine ayakta kalmalı — sahte istemci o durumu taklit ediyor.
      rpc: async () => ({ data: null, error: { message: 'function does not exist' } }),
      from: (tablo: string) => {
        okunanTablolar.push(tablo)
        const sonuc = {
          role: { data: [{ code: 'depo_sorumlusu', name: 'Depo Sorumlusu', description: 'Depo' }], error: null },
          app_user: { data: [{ id: 'u1', username: 'ali', full_name: 'Ali Veli', role_code: 'personel', is_active: true }], error: null },
          user_role: { data: [
            { user_id: 'u1', role_code: 'depo_sorumlusu' },
            { user_id: 'u1', role_code: 'satinalma_sorumlusu' },
          ], error: null },
          role_permission: { data: [
            { role_code: 'depo_sorumlusu', permission_code: 'stock.read' },
            { role_code: 'depo_sorumlusu', permission_code: 'stock.write' },
          ], error: null },
          order_approval_step: { data: [
            { code: 'SATIS', name: 'Satış sorumlusu — onay', required: true,
              permission_code: 'operations.write', sort_order: 3, is_active: true },
            { code: 'ESKI', name: 'Kapatılmış adım', required: false,
              permission_code: 'stock.read', sort_order: 9, is_active: false },
          ], error: null },
        }[tablo]
        const b: any = {
          select: () => b,
          order: () => Promise.resolve(sonuc),
          then: (r: any, j: any) => Promise.resolve(sonuc).then(r, j),
        }
        return b
      },
    })

    const data = await loadRoleAssignmentData()

    expect(okunanTablolar.sort())
      .toEqual(['app_user', 'order_approval_step', 'role', 'role_permission', 'user_role'])
    expect(data.users[0]).toMatchObject({ id: 'u1', username: 'ali', fullName: 'Ali Veli', isActive: true })
    // Bir kullanıcı birden çok rol taşıyabilir — çerçevenin özü bu.
    expect(data.assignments['u1']).toEqual(['depo_sorumlusu', 'satinalma_sorumlusu'])
    // Rol ADI yetmiyor: o rolün neyi açtığı da okunmalı.
    expect(data.rolIzinleri['depo_sorumlusu']).toEqual(['stock.read', 'stock.write'])
  })

  it('KAPATILMIŞ onay adımını listeye almıyor', async () => {
    // Pasif bir adımı göstermek, artık işlemeyen bir kuralı işliyor gibi
    // göstermek olurdu.
    mockGetSupabase.mockReturnValue({
      // 0078: `loadRoleAssignmentData` artık giriş adlarını da okuyor
      // (`giris_adlari` RPC). Göç uygulanmamış kurulumda bu RPC YOKTUR ve
      // ekran yine ayakta kalmalı — sahte istemci o durumu taklit ediyor.
      rpc: async () => ({ data: null, error: { message: 'function does not exist' } }),
      from: (tablo: string) => {
        const sonuc = tablo === 'order_approval_step'
          ? { data: [
              { code: 'A', name: 'Açık', required: true, permission_code: 'operations.write', sort_order: 1, is_active: true },
              { code: 'K', name: 'Kapalı', required: true, permission_code: 'stock.read', sort_order: 2, is_active: false },
            ], error: null }
          : { data: [], error: null }
        const b: any = {
          select: () => b,
          order: () => Promise.resolve(sonuc),
          then: (r: any, j: any) => Promise.resolve(sonuc).then(r, j),
        }
        return b
      },
    })

    const data = await loadRoleAssignmentData()
    expect(data.onayAdimlari.map(a => a.kod)).toEqual(['A'])
    expect(data.onayAdimlari[0]!.bloklar).toBe(true)
  })

  it('bir tablo okunamazsa hata mesajı yukarı taşınır', async () => {
    mockGetSupabase.mockReturnValue({
      // 0078: `loadRoleAssignmentData` artık giriş adlarını da okuyor
      // (`giris_adlari` RPC). Göç uygulanmamış kurulumda bu RPC YOKTUR ve
      // ekran yine ayakta kalmalı — sahte istemci o durumu taklit ediyor.
      rpc: async () => ({ data: null, error: { message: 'function does not exist' } }),
      from: (tablo: string) => {
        const sonuc = tablo === 'app_user'
          ? { data: null, error: { message: 'izin yok' } }
          : { data: [], error: null }
        const b: any = {
          select: () => b,
          order: () => Promise.resolve(sonuc),
          then: (r: any, j: any) => Promise.resolve(sonuc).then(r, j),
        }
        return b
      },
    })

    await expect(loadRoleAssignmentData()).rejects.toThrow(/Kullanıcılar okunamadı: izin yok/)
  })

  it('Supabase yapılandırılmamışsa net bir hata verir', async () => {
    mockIsConfigured.mockReturnValue(false)
    await expect(loadRoleAssignmentData()).rejects.toThrow(SupabaseNotConfiguredError)
  })
})

describe('saveUserRoles', () => {
  it('doğrudan tabloya YAZMAZ, assign_user_roles RPC\'sini çağırır', async () => {
    // Kritik davranış: 0015 `user_role` tablosuna yazma yetkisini geri aldı.
    // İstemci tabloya yazmaya kalkarsa sessizce başarısız olurdu.
    const cagrilar: { ad: string; parametre: any }[] = []
    mockGetSupabase.mockReturnValue({
      rpc: (ad: string, parametre: any) => {
        cagrilar.push({ ad, parametre })
        return Promise.resolve({ data: null, error: null })
      },
      from: () => { throw new Error('tabloya doğrudan yazılmamalı') },
    })

    await saveUserRoles('u1', ['depo_sorumlusu', 'satinalma_sorumlusu'])

    expect(cagrilar).toHaveLength(1)
    expect(cagrilar[0].ad).toBe('assign_user_roles')
    expect(cagrilar[0].parametre).toEqual({
      p_user_id: 'u1',
      p_role_codes: ['depo_sorumlusu', 'satinalma_sorumlusu'],
    })
  })

  it('boş liste gönderilebilir — tüm ek rolleri kaldırmak için', async () => {
    let gonderilen: any = null
    mockGetSupabase.mockReturnValue({
      rpc: (_ad: string, p: any) => { gonderilen = p; return Promise.resolve({ data: null, error: null }) },
    })

    await saveUserRoles('u1', [])
    expect(gonderilen.p_role_codes).toEqual([])
  })

  it('RPC reddederse veritabanının KENDİ mesajı kullanıcıya taşınır', async () => {
    // "Bir hata oluştu" demek yerine, neden reddedildiğini söylemek.
    mockGetSupabase.mockReturnValue({
      rpc: () => Promise.resolve({
        data: null,
        error: { code: 'MI403', message: 'admin rolünü işletme sahibi atayamaz.' },
      }),
    })

    await expect(saveUserRoles('u1', ['admin']))
      .rejects.toThrow('admin rolünü işletme sahibi atayamaz.')
  })
})
