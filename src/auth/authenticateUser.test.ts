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
// ⚠️ 28.10 · SAHTE CEVAP TİPLERİ AÇIKÇA YAZILDI. Önce `vi.fn(async () =>
// ({ data: null, error: null }))` biçimindeydi; TypeScript dönüş tipini
// `{ data: null; error: null }` diye DARALTIYOR ve sınamaların
// `mockResolvedValue({ data: 'x' })` çağrıları tip hatası veriyordu. Hata
// `tsc` hattında hiç koşmadığı için 12 satır sessizce bekledi. Sahte cevap
// gerçek cevabın şeklini taşımalı: veri VEYA hata.
type SahteCevap<T> = {
  data: T | null
  error: { message: string; context?: { status: number } } | null
}

const rpc = vi.fn(
  async (_ad: string, _p: unknown): Promise<SahteCevap<string>> =>
    ({ data: null, error: null }),
)

// ── MIYOP-043 · giriş sunucuya taşındı ──────────────────────────────────
// `authenticateUser` artık önce `giris-yap` Edge Function'ını çağırıyor.
// ⚠️ Bu mock'lar EKLENMEDEN testler geçiyordu ama YANLIŞ SEBEPLE: mock
// supabase'de `functions` yoktu, `invoke` çağrısı TypeError atıyordu,
// yakalanıp "ulaşılamadı" sayılıyor ve hep YEDEK yola düşülüyordu. Yani
// 14 test, dağıtımdan sonra çalışacak yolu hiç sınamıyordu.
//
// ⚠️ 29.10 · YEDEK YOL SİLİNDİ (göç 0102). Daha önce varsayılan "fonksiyon
// DAĞITILMAMIŞ (404)" idi ve bütün eski testler sessizce YEDEK yoldan
// geçiyordu. Göç 0102 `giris_adresi_bul`un `anon` VE `authenticated`
// haklarını aldı; tarayıcının eski yolu artık YOK. Bu yüzden varsayılan
// ARTIK BAŞARIDIR. Reddi sınayan test `sunucuReddeder()`, ulaşılamamayı
// sınayan `sunucuyaUlasilamiyor()` çağırır.
const OTURUM = { access_token: 'erisim-jetonu', refresh_token: 'tazeleme-jetonu' }
const invoke = vi.fn(
  async (
    _ad: string, _ayar?: unknown,
  ): Promise<SahteCevap<{ access_token: string; refresh_token: string }>> => ({
    data: { ...OTURUM },
    error: null,
  }),
)
const setSession = vi.fn(
  async (): Promise<SahteCevap<Record<string, unknown>>> =>
    ({ data: {}, error: null }),
)
const getUser = vi.fn(
  async (): Promise<{
    data: { user: { id: string; email?: string } | null }
    error: { message: string } | null
  }> => ({ data: { user: null }, error: null }),
)

vi.mock('../core/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    auth: { signInWithPassword, signOut, setSession, getUser },
    from,
    rpc,
    functions: { invoke }
  })
}))

const { authenticateUser } = await import('../storage')

// ── YARDIMCILAR · üç hâl, üç ayrı kurulum ───────────────────────────────
// ⚠️ Bu üçü KARIŞTIRILMAMALI: "reddedildi" kullanıcıya söylenir,
// "ulaşılamadı" bir arızadır ve artık giriş OLMAZ (yedek yol silindi).

/** Sunucu girişi OLDU: fonksiyon oturum verir, oturumdan kullanıcı okunur. */
const sunucuGirisVerir = (kullanici: { id: string; email?: string }) => {
  invoke.mockResolvedValue({ data: { ...OTURUM }, error: null })
  setSession.mockResolvedValue({ data: {}, error: null })
  getUser.mockResolvedValue({ data: { user: kullanici }, error: null })
}

/** Sunucu REDDETTİ. ⚠️ Olmayan kullanıcı ile yanlış parola AYNI cevaptır. */
const sunucuReddeder = () => {
  invoke.mockResolvedValue({
    data: null,
    error: { message: 'Unauthorized', context: { status: 401 } },
  })
}

/** Fonksiyona ULAŞILAMIYOR. ⚠️ 0102'den sonra bu, girişin olmaması demek. */
const sunucuyaUlasilamiyor = () => {
  invoke.mockResolvedValue({
    data: null,
    error: { message: 'Function not found', context: { status: 404 } },
  })
}

describe('authenticateUser — Supabase Auth ile gerçek oturum açma', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('yanlış e-posta veya şifre reddedilir, app_user hiç sorgulanmaz', async () => {
    sunucuReddeder()

    const user = await authenticateUser('yanlis@ornek.com', 'yanlis-sifre')

    expect(user).toBeNull()
    expect(from).not.toHaveBeenCalled()
    // ⚠️ Tarayıcı parolayı Auth'a KENDİ sormuyor; bu iş sunucuda.
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('Supabase girişi başarılı ama app_user eşleşmesi yoksa reddedilir ve oturum kapatılır', async () => {
    sunucuGirisVerir({ id: 'auth-uid-eslesmeyen' })
    maybeSingle.mockResolvedValue({ data: null, error: null })

    const user = await authenticateUser('eslesmeyen@ornek.com', 'sifre123')

    expect(user).toBeNull()
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('pasif (is_active=false) app_user girişi reddedilir ve oturum kapatılır', async () => {
    sunucuGirisVerir({ id: 'auth-uid-pasif' })
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
    sunucuGirisVerir({ id: authUid })
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
    sunucuGirisVerir({ id: 'auth-uid-eposta', email: 'kullanici@ornek.com' })
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
    sunucuGirisVerir({ id: 'auth-uid-epostasiz' })
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
    sunucuGirisVerir({ id: 'auth-uid-personel' })
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

describe('giriş adıyla giriş (0077/0102) ve geçici şifre bayrağı (0076)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  // ⚠️ 29.10 · BURADA DÖRT TEST SİLİNDİ, ÇÜNKÜ ÖLÇTÜKLERİ KOD SİLİNDİ.
  // Eskiden tarayıcı kullanıcı adını kendisi adrese çeviriyordu
  // (`giris_adresi_bul`), e-posta yazana çevirmiyordu, çeviri düşerse
  // girdiyi olduğu gibi deniyordu. Bu üç davranış ARTIK SUNUCUDA:
  // `supabase/functions/giris-yap/index.ts`. Metni
  // `giris-sunucuda.arch.test.ts` ölçüyor.
  //
  // ⚠️ Bu testleri "sahte bir sunucu" kurup burada yaşatmak mümkündü ve
  // YANLIŞ olurdu: o sahte sunucunun içine aynı kuralı ben yazardım ve
  // test kendi taklidini ölçerdi. Tarayıcıda ölçülecek şey artık tek:
  // girdiyi OLDUĞU GİBİ gövdeye koyuyor mu, ve adresi HİÇ sormuyor mu.

  it('⚠️ giriş adı ve işletme kodu sunucuya GÖVDEDE gider, tarayıcı çözmez', async () => {
    sunucuGirisVerir({ id: 'auth-depocu', email: 'depocu@abcgida.miyop.local' })
    maybeSingle.mockResolvedValue(personelSatiri(false))

    const user = await authenticateUser('  depocu  ', 'gecici-sifre1', 'ABCGIDA')

    expect(invoke).toHaveBeenCalledWith('giris-yap', {
      body: { giris: 'depocu', sifre: 'gecici-sifre1', isletme: 'ABCGIDA' },
    })
    expect(user!.username).toBe('depocu')
  })

  it('⚠️ tarayıcı adresi HİÇ sormuyor — sızıntının kapandığının kanıtı', async () => {
    sunucuGirisVerir({ id: 'auth-patron', email: 'abc.bey@ornek.com' })
    maybeSingle.mockResolvedValue(personelSatiri(false))

    await authenticateUser('ABC.Bey@Ornek.COM', 'sifre123')

    // ⚠️ Göç 0102'den sonra tarayıcının bu hakkı ZATEN YOK; çağırsa 42501
    // alırdı. Yine de ölçülüyor: hakkı olmayan bir çağrı yapmak, girişi
    // sessizce kıran bir hata olurdu.
    expect(rpc).not.toHaveBeenCalled()
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('⚠️ geçici şifre bayrağı User nesnesine taşınır (taşınmazsa kapı hiç kapanmaz)', async () => {
    sunucuGirisVerir({ id: 'auth-depocu' })
    maybeSingle.mockResolvedValue(personelSatiri(true))

    const user = await authenticateUser('depocu', 'gecici-sifre1')

    expect(user!.mustChangePassword).toBe(true)
  })

  it('bayrak yoksa (eski kayıt / null) false olur — kimse boşuna kapıda kalmaz', async () => {
    sunucuGirisVerir({ id: 'auth-eski' })
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
    sunucuGirisVerir({ id: 'auth-depocu' })
    maybeSingle.mockResolvedValue(personelSatiri(true))

    await authenticateUser('depocu', 'gecici-sifre1')

    // Sütun listede olmasa Supabase alanı hiç döndürmez ve bayrak sessizce
    // false kalırdı — kapı açık, hata görünmez.
    expect(select).toHaveBeenCalledWith(expect.stringContaining('must_change_password'))
  })
})


// ═══════════════════════════════════════════════════════════════════════════
// MIYOP-043 · SUNUCU YOLU
//
// Codex denetimi (18.10.2026): `giris_adresi_bul` `anon`a açıktı ve bulunan
// kullanıcı için gerçek Auth e-postasını dönüyordu. Çözüm: adres çözümü ve
// parola doğrulaması `giris-yap` Edge Function'ında.
//
// ⚠️ Buradaki testlerin asıl işi, sunucu yolu çalışırken TARAYICININ ADRESİ
// HİÇ SORMADIĞINI kanıtlamak. `giris_adresi_bul` çağrılıyorsa sızıntı
// kapanmamış demektir.
// ═══════════════════════════════════════════════════════════════════════════
describe('MIYOP-043 · giriş sunucuda yapılıyor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSession.mockResolvedValue({ data: {}, error: null })
  })

  const sunucuOturumVerir = () => {
    invoke.mockResolvedValue({
      data: {
        access_token: 'erisim-jetonu',
        refresh_token: 'tazeleme-jetonu',
      },
      error: null
    })
  }

  it('sunucu oturum verince giriş olur ve TARAYICI ADRESİ HİÇ SORMAZ', async () => {
    sunucuOturumVerir()
    getUser.mockResolvedValue({
      data: { user: { id: 'auth-uid-1', email: 'depocu@abcgida.miyop.local' } },
      error: null
    })
    maybeSingle.mockResolvedValue({
      data: {
        id: 'u1', tenant_id: 't1', company_id: 'c1', username: 'depocu',
        full_name: 'Depo Cu', phone: null, profile_photo_url: null,
        role_code: 'depo_sorumlusu', is_active: true, must_change_password: false
      },
      error: null
    })

    const user = await authenticateUser('depocu@ABCGIDA', 'sifre123')

    expect(user).not.toBeNull()
    expect(invoke).toHaveBeenCalledWith('giris-yap', expect.anything())
    // ⚠️ SIZINTININ KAPANDIĞININ KANITI: adres sorulmadı.
    expect(rpc).not.toHaveBeenCalledWith('giris_adresi_bul', expect.anything())
    // Ve eski yola hiç düşülmedi.
    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'erisim-jetonu',
      refresh_token: 'tazeleme-jetonu'
    })
  })

  it('parola çağrı gövdesinde gider ama dönen User nesnesinde düz metin yok', async () => {
    sunucuOturumVerir()
    getUser.mockResolvedValue({
      data: { user: { id: 'auth-uid-2', email: 'x@y.miyop.local' } }, error: null
    })
    maybeSingle.mockResolvedValue({
      data: {
        id: 'u2', tenant_id: 't1', company_id: 'c1', username: 'depocu',
        full_name: 'Depo Cu', phone: null, profile_photo_url: null,
        role_code: 'depo_sorumlusu', is_active: true, must_change_password: false
      },
      error: null
    })

    const user = await authenticateUser('depocu@ABCGIDA', 'gizli-parola')

    expect(JSON.stringify(user)).not.toContain('gizli-parola')
  })

  it('sunucu 401 derse giriş reddedilir ve YEDEK YOLA DÜŞÜLMEZ', async () => {
    // ⚠️ Burası kritik: gerçek reddi "ulaşılamadı" sayıp eski sızdıran
    // yola düşseydik, 043 hiç kapanmazdı.
    invoke.mockResolvedValue({
      data: null,
      error: { message: 'Unauthorized', context: { status: 401 } }
    })

    const user = await authenticateUser('yok@ABCGIDA', 'yanlis')

    expect(user).toBeNull()
    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalledWith('giris_adresi_bul', expect.anything())
    expect(from).not.toHaveBeenCalled()
  })

  it('⚠️ fonksiyona ULAŞILAMAZSA giriş OLMAZ — yedek yol SİLİNDİ (0102)', async () => {
    // ⚠️ BU TESTİN ÖNCEKİ HÂLİ TAM TERSİNİ SÖYLÜYORDU: "yedek yol devreye
    // girer (bugünkü canlı durum)". O dal 29.10'da silindi; `giris-yap`
    // canlıda doğrulandıktan (Invocations · POST 200) ve göç 0102
    // `giris_adresi_bul`un `anon`/`authenticated` haklarını aldıktan
    // sonra. Yedek yol dursaydı, kapanan sızıntı ilk ağ arızasında geri
    // açılırdı — ve kimse fark etmezdi.
    sunucuyaUlasilamiyor()
    maybeSingle.mockResolvedValue({
      data: {
        id: 'u3', tenant_id: 't1', company_id: 'c1', username: 'depocu',
        full_name: 'Depo Cu', phone: null, profile_photo_url: null,
        role_code: 'depo_sorumlusu', is_active: true, must_change_password: false
      },
      error: null
    })

    const ariza: { deger?: { mesaj: string } } = {}
    const user = await authenticateUser('depocu@ABCGIDA', 'sifre123', undefined, ariza)

    expect(user).toBeNull()
    // Eski yol gerçekten YOK: ne adres soruluyor, ne de Auth'a gidiliyor.
    expect(rpc).not.toHaveBeenCalled()
    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
    // ⚠️ Ve sebep PAROLA DEĞİL: kişi şifresini boş yere değiştirmeye
    // kalkmasın diye mesaj çağırana taşınıyor (MIYOP-051'in dersi).
    expect(ariza.deger?.mesaj).toBeTruthy()
    expect(ariza.deger?.mesaj).not.toMatch(/şifre|parola/i)
  })

  it('MIYOP-051 · kota/arıza yanlış parola sayılmaz ve YEDEK YOLA DÜŞÜLMEZ', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { message: 'Too Many Requests', context: { status: 429 } }
    })

    const ariza: { deger?: { mesaj: string } } = {}
    const user = await authenticateUser('depocu@ABCGIDA', 'dogru-parola',
      undefined, ariza)

    expect(user).toBeNull()
    // ⚠️ Bir kota arızasını eski SIZDIRAN yola yönlendirmek olurdu.
    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalledWith('giris_adresi_bul', expect.anything())
    // ⚠️ Ve mesaj ÇAĞIRANA ULAŞMALI; yoksa ekran "şifre hatalı" der.
    expect(ariza.deger?.mesaj).toBeTruthy()
    expect(ariza.deger?.mesaj).not.toMatch(/şifre|parola/i)
  })

  it('MIYOP-052 · kullanıcı okunamazsa OTURUM KAPATILIR', async () => {
    sunucuOturumVerir()
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'network' } })

    const user = await authenticateUser('depocu@ABCGIDA', 'sifre123')

    expect(user).toBeNull()
    // `setSession` başarılıydı: Auth oturumu kurulmuştu. Temizlenmeli.
    // ⚠️ MIYOP-055 · YALNIZ bu oturum. Varsayılan `global` kapsam,
    // kullanıcının başka cihazdaki oturumunu da düşürürdü.
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(from).not.toHaveBeenCalled()
  })

  it('oturum kurulamazsa giriş reddedilir, yarım oturum bırakılmaz', async () => {
    sunucuOturumVerir()
    setSession.mockResolvedValue({ data: {}, error: { message: 'bozuk jeton' } })

    const user = await authenticateUser('depocu@ABCGIDA', 'sifre123')

    expect(user).toBeNull()
    // ⚠️ Yedek yola da düşülmüyor: oturum kurulamaması bir arızadır,
    // eski sızdıran yolu açmanın gerekçesi değil.
    expect(signInWithPassword).not.toHaveBeenCalled()
  })
})
