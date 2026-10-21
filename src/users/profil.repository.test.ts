// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Profilim deposu testleri
//
// Bu ekran "Kullanıcı kaydı bulunamadı" diyordu ve hiç çalışmıyordu: eski
// hâli localStorage'ı okuyordu, giriş yapan kullanıcı ise Supabase'den
// geliyordu (tuzak 82).
//
// ⚠️ Buradaki EN ÖNEMLİ test, yazılan kolon kümesini donduran test.
// `role_code` ya da `username` bir gün bu nesneye eklenirse veritabanı
// `42501` ile reddeder (kolon yetkisi yok, göç 0012) — ama o hata
// KULLANICIYA "kaydedilemedi" diye çıkar ve sebebi günlerce aranır.
// Testin işi, o günü hiç yaşatmamak.
// ═══════════════════════════════════════════════════════════════════════════

import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()
const updateUser = vi.fn()
const rpc = vi.fn()
const maybeSingle = vi.fn()
const update = vi.fn()
const eqUpdate = vi.fn()

/** `.from(tablo)` çağrılarını tablo adına göre ayıran mock. */
const from = vi.fn((tablo: string) => {
  if(tablo === 'app_user'){
    return {
      select: () => ({ eq: () => ({ maybeSingle }) }),
      update: (...a: unknown[]) => { update(...a); return { eq: eqUpdate } },
    }
  }
  if(tablo === 'company'){
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: { company_name: 'ABC Gıda' }, error: null }) }) }) }
  }
  // user_branch_access
  return { select: () => ({ eq: async () => ({
    data: [{ branch: { name: 'Merkez', is_active: true } }], error: null }) }) }
})

vi.mock('../core/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({ auth: { getUser, updateUser }, from, rpc }),
}))

const { profilimiOku, profilimiYaz, sifremiDegistir } =
  await import('./profil.repository')

const OTURUM = {
  data: { user: { id: 'auth-1', email: 'depocu@abcgida.miyop.local' } },
  error: null,
}

const SATIR = {
  data: {
    id: 'app-1', full_name: 'Depo Cu', username: 'depocu',
    phone: '5551112233', role_code: 'depo_sorumlusu', company_id: 'firma-1',
  },
  error: null,
}

describe('profilimiOku', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eqUpdate.mockResolvedValue({ error: null })
  })

  it('oturumdan DEĞİL, veritabanından okuyor', async () => {
    getUser.mockResolvedValue(OTURUM)
    maybeSingle.mockResolvedValue(SATIR)

    const profil = await profilimiOku()

    expect(from).toHaveBeenCalledWith('app_user')
    expect(profil?.adSoyad).toBe('Depo Cu')
    expect(profil?.kullaniciAdi).toBe('depocu')
    expect(profil?.rolKodu).toBe('depo_sorumlusu')
    // Giriş adresi `app_user`da DEĞİL, oturumda duruyor.
    expect(profil?.girisAdresi).toBe('depocu@abcgida.miyop.local')
  })

  it('firma adı ve şubeler okunuyor', async () => {
    getUser.mockResolvedValue(OTURUM)
    maybeSingle.mockResolvedValue(SATIR)

    const profil = await profilimiOku()

    expect(profil?.firmaAdi).toBe('ABC Gıda')
    expect(profil?.subeler).toEqual(['Merkez'])
  })

  it('oturum yoksa null döner, patlamaz', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await profilimiOku()).toBeNull()
  })

  it('satır okunamazsa null döner — "kayıt bulunamadı" uydurmuyor', async () => {
    getUser.mockResolvedValue(OTURUM)
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'network' } })
    expect(await profilimiOku()).toBeNull()
  })
})

describe('profilimiYaz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eqUpdate.mockResolvedValue({ error: null })
  })

  it('⚠️ YALNIZ üç kolon yazıyor · rol ve kullanıcı adı ASLA', async () => {
    await profilimiYaz('app-1', { adSoyad: 'Yeni Ad', telefon: '5559998877' })

    expect(update).toHaveBeenCalledTimes(1)
    const yazilan = update.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(yazilan).sort())
      .toEqual(['full_name', 'phone', 'updated_at'])
    // Bunların hiçbiri gönderilmemeli: veritabanı 42501 ile reddeder.
    for(const yasak of ['role_code', 'username', 'username_key', 'is_active',
                        'tenant_id', 'company_id', 'auth_user_id']){
      expect(yazilan, `${yasak} gönderilmiş`).not.toHaveProperty(yasak)
    }
  })

  it('boş telefon `null` yazılıyor, boş metin değil', async () => {
    await profilimiYaz('app-1', { adSoyad: 'Ad', telefon: '   ' })
    const yazilan = update.mock.calls[0][0] as Record<string, unknown>
    expect(yazilan.phone).toBeNull()
  })

  it('ad soyad boşsa veritabanına HİÇ gidilmiyor', async () => {
    const sonuc = await profilimiYaz('app-1', { adSoyad: '  ', telefon: '5' })
    expect(sonuc).toEqual({ durum: 'hata', mesaj: 'Ad soyad zorunludur.' })
    expect(update).not.toHaveBeenCalled()
  })

  it('yetki hatasında ham veritabanı metni GÖSTERİLMİYOR', async () => {
    eqUpdate.mockResolvedValue({
      error: { code: '42501', message: 'permission denied for table app_user' },
    })
    const sonuc = await profilimiYaz('app-1', { adSoyad: 'Ad', telefon: '' })
    expect(sonuc.durum).toBe('hata')
    expect(sonuc.durum === 'hata' && sonuc.mesaj).not.toContain('permission denied')
    expect(sonuc.durum === 'hata' && sonuc.mesaj).toContain('yetkiniz yok')
  })
})

describe('sifremiDegistir', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateUser.mockResolvedValue({ error: null })
    rpc.mockResolvedValue({ error: null })
  })

  it('kısa şifre Auth’a HİÇ gönderilmiyor', async () => {
    const sonuc = await sifremiDegistir('kisa')
    expect(sonuc.durum).toBe('hata')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('şifre yalnız Auth’a gidiyor ve geçici bayrak düşüyor', async () => {
    const sonuc = await sifremiDegistir('uzun-ve-guclu-sifre')

    expect(sonuc).toEqual({ durum: 'oldu' })
    expect(updateUser).toHaveBeenCalledWith({ password: 'uzun-ve-guclu-sifre' })
    expect(rpc).toHaveBeenCalledWith('sifremi_belirledim')
    // ⚠️ Şifre dönen nesnede OLMAMALI.
    expect(JSON.stringify(sonuc)).not.toContain('uzun-ve-guclu-sifre')
  })

  it('bayrak düşmezse şifre değişimi yine BAŞARILI sayılıyor', async () => {
    // Şifre DEĞİŞTİ; kullanıcıyı "olmadı" diye geri çevirmek yanlış olurdu.
    rpc.mockResolvedValue({ error: { message: 'network' } })
    expect(await sifremiDegistir('uzun-ve-guclu-sifre')).toEqual({ durum: 'oldu' })
  })

  it('Auth hatasında sağlayıcının metni gösterilmiyor', async () => {
    updateUser.mockResolvedValue({ error: { message: 'Password is too weak' } })
    const sonuc = await sifremiDegistir('uzun-ve-guclu-sifre')
    expect(sonuc.durum).toBe('hata')
    expect(sonuc.durum === 'hata' && sonuc.mesaj).not.toContain('too weak')
  })
})
