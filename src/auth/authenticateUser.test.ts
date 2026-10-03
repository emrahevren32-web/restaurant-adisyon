import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * G4 · authenticateUser Supabase Auth testleri.
 *
 * Gerçek bir Supabase bağlantısı KURMAZ — supabase.ts'i mock'lar. Amaç ağa
 * bağımlı olmadan davranışı kanıtlamak: yanlış giriş reddedilir, app_user
 * eşleşmesi yoksa oturum kapatılır, pasif kullanıcı giremez, başarılı
 * girişte dönen User nesnesinde düz metin parola YOKTUR.
 *
 * Bkz. PLAN.md §5, dilim-0-gorevler.md G4.6, db/migrations/0008_ilk_yonetici.sql.
 */

const signInWithPassword = vi.fn()
const signOut = vi.fn()
const maybeSingle = vi.fn()
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ select }))

vi.mock('../core/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    auth: { signInWithPassword, signOut },
    from
  })
}))

const { authenticateUser } = await import('../storage')

describe('authenticateUser — Supabase Auth ile gerçek oturum açma', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('yanlış e-posta veya şifre reddedilir, app_user hiç sorgulanmaz', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' }
    })

    const user = await authenticateUser('yanlis@ornek.com', 'yanlis-sifre')

    expect(user).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it('Supabase girişi başarılı ama app_user eşleşmesi yoksa reddedilir ve oturum kapatılır', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-uid-eslesmeyen' } },
      error: null
    })
    maybeSingle.mockResolvedValue({ data: null, error: null })

    const user = await authenticateUser('eslesmeyen@ornek.com', 'sifre123')

    expect(user).toBeNull()
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('pasif (is_active=false) app_user girişi reddedilir ve oturum kapatılır', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-uid-pasif' } },
      error: null
    })
    maybeSingle.mockResolvedValue({
      data: {
        id: 'app-user-pasif',
        tenant_id: 'tenant-1',
        company_id: 'company-1',
        username: 'pasif-kullanici',
        full_name: 'Pasif Kullanıcı',
        phone: null,
        profile_photo_url: null,
        role_code: 'personel',
        is_active: false
      },
      error: null
    })

    const user = await authenticateUser('pasif@ornek.com', 'sifre123')

    expect(user).toBeNull()
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('geçerli admin girişinde User nesnesi döner ve düz metin parola içermez', async () => {
    const authUid = '141939e8-5779-43af-b468-9cbc8ee2b1fb'
    signInWithPassword.mockResolvedValue({
      data: { user: { id: authUid } },
      error: null
    })
    maybeSingle.mockResolvedValue({
      data: {
        id: 'app-user-emrah',
        tenant_id: 'tenant-miyop',
        company_id: 'company-miyop',
        username: 'emrah',
        full_name: 'Emrah Evren',
        phone: null,
        profile_photo_url: null,
        role_code: 'admin',
        is_active: true
      },
      error: null
    })

    const user = await authenticateUser('emrahevren32@gmail.com', 'dogru-sifre')

    expect(user).not.toBeNull()
    expect(user!.id).toBe('app-user-emrah')
    expect(user!.tenantId).toBe('tenant-miyop')
    expect(user!.role).toBe('Admin')
    expect(user!.active).toBe(true)
    expect(signOut).not.toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('auth_user_id', authUid)

    // Kanıt: dönen nesnede düz metin parola alanı yok.
    expect('password' in (user as object)).toBe(false)
    expect(JSON.stringify(user)).not.toContain('sifre')
    expect(JSON.stringify(user)).not.toContain('password')
  })

  it('giriş e-postası Supabase oturumundan User nesnesine taşınır', async () => {
    // Giriş e-postası `app_user` tablosunda YOK; yalnızca Supabase Auth
    // oturumunda var. Taşınmazsa kişi kendi giriş adresini programın
    // hiçbir ekranında göremez — "Profilim" ekranındaki alan da bu yüzden
    // yıllarca kullanıcı adını gösteriyordu.
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-uid-eposta', email: 'kullanici@ornek.com' } },
      error: null
    })
    maybeSingle.mockResolvedValue({
      data: {
        id: 'app-user-eposta',
        tenant_id: 'tenant-miyop',
        company_id: 'company-miyop',
        username: 'kullanici',
        full_name: 'Test Kullanıcı',
        phone: null,
        profile_photo_url: null,
        role_code: 'admin',
        is_active: true
      },
      error: null
    })

    const user = await authenticateUser('kullanici@ornek.com', 'sifre123')

    expect(user!.email).toBe('kullanici@ornek.com')
    // Kullanıcı adı ile e-posta AYRI alanlar; biri diğerinin yerine geçmiyor.
    expect(user!.username).toBe('kullanici')
  })

  it('oturumda e-posta yoksa alan boş kalır, kullanıcı adıyla doldurulmaz', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-uid-epostasiz' } },
      error: null
    })
    maybeSingle.mockResolvedValue({
      data: {
        id: 'app-user-epostasiz',
        tenant_id: 'tenant-miyop',
        company_id: 'company-miyop',
        username: 'epostasiz',
        full_name: 'E-postasız Kullanıcı',
        phone: null,
        profile_photo_url: null,
        role_code: 'personel',
        is_active: true
      },
      error: null
    })

    const user = await authenticateUser('epostasiz@ornek.com', 'sifre123')

    expect(user!.email).toBeUndefined()
  })

  it('role_code admin dışındaki her rolü Personel olarak eşler', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-uid-personel' } },
      error: null
    })
    maybeSingle.mockResolvedValue({
      data: {
        id: 'app-user-personel',
        tenant_id: 'tenant-miyop',
        company_id: 'company-miyop',
        username: 'ayse',
        full_name: 'Ayşe Yılmaz',
        phone: null,
        profile_photo_url: null,
        role_code: 'personel',
        is_active: true
      },
      error: null
    })

    const user = await authenticateUser('ayse@ornek.com', 'sifre123')

    expect(user!.role).toBe('Personel')
  })
})
