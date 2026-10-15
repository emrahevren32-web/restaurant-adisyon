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
// 0077: giriş artık kullanıcı adıyla da yapılabiliyor; `authenticateUser`
// girdiyi önce `giris_adresi_bul` ile gerçek giriş adresine çeviriyor.
const rpc = vi.fn(async (_ad: string, _p: unknown) => ({ data: null, error: null }))

vi.mock('../core/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    auth: { signInWithPassword, signOut },
    from,
    rpc
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

describe('kullanıcı adıyla giriş (0077) ve geçici şifre bayrağı (0076)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({ data: null, error: null })
  })

  const personelSatiri = (bayrak: boolean) => ({
    data: {
      id: 'app-user-depocu',
      tenant_id: 'tenant-abc',
      company_id: null,
      username: 'depocu',
      full_name: 'Alaattin Kocatepe',
      phone: null,
      profile_photo_url: null,
      role_code: 'depo_sorumlusu',
      is_active: true,
      must_change_password: bayrak
    },
    error: null
  })

  it('⚠️ kullanıcı adı, girişten ÖNCE gerçek giriş adresine çevrilir', async () => {
    rpc.mockResolvedValue({ data: 'depocu@abcgida.miyop.local', error: null })
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-depocu', email: 'depocu@abcgida.miyop.local' } },
      error: null
    })
    maybeSingle.mockResolvedValue(personelSatiri(false))

    const user = await authenticateUser('depocu', 'gecici-sifre1')

    expect(rpc).toHaveBeenCalledWith('giris_adresi_bul', {
      p_kullanici: 'depocu',
      p_isletme: null
    })
    // Supabase'e kullanıcı adı DEĞİL, çözülen adres gidiyor.
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'depocu@abcgida.miyop.local',
      password: 'gecici-sifre1'
    })
    expect(user!.username).toBe('depocu')
  })

  it('işletme kodu verilirse sunucuya o kodla sorulur', async () => {
    rpc.mockResolvedValue({ data: 'depocu@abcgida.miyop.local', error: null })
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-depocu' } }, error: null
    })
    maybeSingle.mockResolvedValue(personelSatiri(false))

    await authenticateUser('depocu', 'gecici-sifre1', 'ABCGIDA')

    expect(rpc).toHaveBeenCalledWith('giris_adresi_bul', {
      p_kullanici: 'depocu',
      p_isletme: 'ABCGIDA'
    })
  })

  it('⚠️ e-posta yazan kişi için sunucuya HİÇ gidilmez (fazladan istek yok)', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-patron', email: 'abc.bey@ornek.com' } },
      error: null
    })
    maybeSingle.mockResolvedValue(personelSatiri(false))

    await authenticateUser('ABC.Bey@Ornek.COM', 'sifre123')

    expect(rpc).not.toHaveBeenCalled()
    // Adres küçük harfe indirilir; Supabase'in beklediği biçim budur.
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'abc.bey@ornek.com',
      password: 'sifre123'
    })
  })

  it('⚠️ çeviri başarısız olsa bile giriş denenir (RPC arızası bütün girişi kilitlemez)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'network' } })
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid' } })

    const user = await authenticateUser('depocu', 'sifre123')

    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'depocu', password: 'sifre123' })
    expect(user).toBeNull()
  })

  it('⚠️ geçici şifre bayrağı User nesnesine taşınır (taşınmazsa kapı hiç kapanmaz)', async () => {
    rpc.mockResolvedValue({ data: 'depocu@abcgida.miyop.local', error: null })
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'auth-depocu' } }, error: null })
    maybeSingle.mockResolvedValue(personelSatiri(true))

    const user = await authenticateUser('depocu', 'gecici-sifre1')

    expect(user!.mustChangePassword).toBe(true)
  })

  it('bayrak yoksa (eski kayıt / null) false olur — kimse boşuna kapıda kalmaz', async () => {
    rpc.mockResolvedValue({ data: 'patron@ornek.com', error: null })
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'auth-eski' } }, error: null })
    maybeSingle.mockResolvedValue({
      data: {
        id: 'app-user-eski', tenant_id: 'tenant-abc', company_id: null,
        username: 'eski', full_name: 'Eski Kayıt', phone: null,
        profile_photo_url: null, role_code: 'admin', is_active: true
        // must_change_password alanı YOK — eski satırları taklit ediyor.
      },
      error: null
    })

    const user = await authenticateUser('eski', 'sifre123')

    expect(user!.mustChangePassword).toBe(false)
  })

  it('⚠️ seçilen sütunlar arasında must_change_password VAR', async () => {
    rpc.mockResolvedValue({ data: 'depocu@abcgida.miyop.local', error: null })
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'auth-depocu' } }, error: null })
    maybeSingle.mockResolvedValue(personelSatiri(true))

    await authenticateUser('depocu', 'gecici-sifre1')

    // Sütun listede olmasa Supabase alanı hiç döndürmez ve bayrak sessizce
    // false kalırdı — kapı açık, hata görünmez.
    expect(select).toHaveBeenCalledWith(expect.stringContaining('must_change_password'))
  })
})
