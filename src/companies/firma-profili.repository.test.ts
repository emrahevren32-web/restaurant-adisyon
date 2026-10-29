// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Firma Profili deposu testleri
//
// Bu ekran Kaydet'e basınca veriyi TARAYICIYA yazıyordu: müşteri vergi
// numarasını girip "kaydedildi" yazısını görüyor, başka bir bilgisayardan
// giriyor ve hiçbir şey bulamıyordu.
//
// ⚠️ Buradaki EN ÖNEMLİ iki test:
//   · yazılan kolon kümesini DONDURAN test. `company_code`, `tenant_id`,
//     `primary_sector_id`, `status` ya da `default_branch_id` bir gün bu
//     nesneye eklenirse, bir ekran kiracının kimliğini değiştirebiliyor
//     olur. Bu sessizce olur; hiçbir şey kırmızı yanmaz.
//   · boş alanın UYDURULMADIĞINI ölçen test (MIYOP-060). Göç 0084 bu yalanı
//     veritabanı tarafında onarmıştı ve ikinci katmanda yaşıyordu (tuzak 106).
// ═══════════════════════════════════════════════════════════════════════════

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Hata = { message: string; code?: string } | null

const selectCagrisi = vi.fn()
const selectCevap = vi.fn(
  async (): Promise<{ data: Record<string, unknown>[] | null; error: Hata }> =>
    ({ data: [], error: null }),
)
const guncelle = vi.fn()
const eqGuncelle = vi.fn(async (): Promise<{ error: Hata }> => ({ error: null }))

const from = vi.fn((tablo: string) => ({
  select: (sutunlar: string) => { selectCagrisi(tablo, sutunlar); return selectCevap() },
  update: (yama: unknown) => { guncelle(yama); return { eq: eqGuncelle } },
}))

vi.mock('../core/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({ from }),
}))

const { firmaProfiliniOku, firmaProfiliniYaz } =
  await import('./firma-profili.repository')

/** Yeni açılmış bir işletme: adı ve kodu var, gerisi BOŞ. */
const YENI_SATIR = {
  id: 'firma-1',
  company_code: 'YAM002',
  company_name: 'Yamaklar Endüstriyel Mutfak',
  short_name: null, legal_name: null, tax_office: null, tax_number: null,
  phone: null, email: null, website: null, address: null,
  city: null, district: null, postal_code: null, logo_url: null,
  authorized_person: null, authorized_title: null, authorized_phone: null,
  authorized_email: null,
  updated_at: '2026-10-29T05:00:00.000Z',
}

const DOLU_FORM = {
  firmaAdi: 'Yamaklar Endüstriyel Mutfak A.Ş.',
  kisaAd: 'Yamaklar',
  ticariUnvan: 'Yamaklar Endüstriyel Mutfak Sanayi ve Ticaret A.Ş.',
  vergiDairesi: 'Bornova',
  vergiNumarasi: '1234567890',
  telefon: '2321112233',
  eposta: 'bilgi@yamaklar.com',
  web: 'https://yamaklar.com',
  adres: 'Atatürk OSB 1. Cadde No 5',
  il: 'İzmir',
  ilce: 'Bornova',
  postaKodu: '35210',
  logoAdresi: 'https://yamaklar.com/logo.png',
  yetkiliAdSoyad: 'Ahmet Yamak',
  yetkiliUnvan: 'Genel Müdür',
  yetkiliTelefon: '5551112233',
  yetkiliEposta: 'ahmet@yamaklar.com',
}

describe('firmaProfiliniOku', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectCevap.mockResolvedValue({ data: [YENI_SATIR], error: null })
  })

  it('tarayıcıdan DEĞİL, `company` tablosundan okuyor', async () => {
    const profil = await firmaProfiliniOku('firma-1')

    expect(selectCagrisi).toHaveBeenCalledWith('company', expect.stringContaining('tax_number'))
    expect(profil?.firmaAdi).toBe('Yamaklar Endüstriyel Mutfak')
    expect(profil?.firmaKodu).toBe('YAM002')
  })

  it('⚠️ MIYOP-060 · BOŞ ALAN UYDURULMUYOR', async () => {
    const profil = await firmaProfiliniOku('firma-1')

    // Eskiden ticari unvan boşsa ekran FİRMA ADINI unvan gibi gösteriyordu,
    // yetkili kişi alanına da firma adı düşüyordu. Üçü de boş kalmalı.
    expect(profil?.ticariUnvan).toBeNull()
    expect(profil?.yetkiliAdSoyad).toBeNull()
    expect(profil?.yetkiliTelefon).toBeNull()
    expect(profil?.vergiNumarasi).toBeNull()
  })

  it('⚠️ kiracı süzmesi sorguya ELLE eklenmiyor — RLS yapar (ADR-004)', async () => {
    await firmaProfiliniOku('firma-1')

    // `tenant_id` eşitliği eklenirse "filtre var, demek ki güvenli"
    // yanılsaması doğar ve RLS'in kapalı kalması fark edilmez.
    const [, sutunlar] = selectCagrisi.mock.calls[0] as [string, string]
    expect(sutunlar).not.toContain('tenant_id')
  })

  it('kimlik eşleşmese de TEK satır kaldıysa o satır kullanılır', async () => {
    const profil = await firmaProfiliniOku('baska-kimlik')
    expect(profil?.id).toBe('firma-1')
  })

  it('⚠️ birden çok satırda TAHMİN EDİLMİYOR', async () => {
    selectCevap.mockResolvedValue({
      data: [YENI_SATIR, { ...YENI_SATIR, id: 'firma-2' }], error: null,
    })

    expect(await firmaProfiliniOku('baska-kimlik')).toBeNull()
  })

  it('okuma düşerse null döner, uydurma satır üretilmez', async () => {
    selectCevap.mockResolvedValue({ data: null, error: { message: 'network' } })
    expect(await firmaProfiliniOku('firma-1')).toBeNull()
  })
})

describe('firmaProfiliniYaz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectCevap.mockResolvedValue({ data: [YENI_SATIR], error: null })
    eqGuncelle.mockResolvedValue({ error: null })
  })

  it('⚠️ YAZILAN KOLON KÜMESİ DONDURULDU', async () => {
    await firmaProfiliniYaz('firma-1', DOLU_FORM)

    const yama = guncelle.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(yama).sort()).toEqual([
      'address', 'authorized_email', 'authorized_person', 'authorized_phone',
      'authorized_title', 'city', 'company_name', 'district', 'email',
      'legal_name', 'logo_url', 'phone', 'postal_code', 'short_name',
      'tax_number', 'tax_office', 'updated_at', 'website',
    ])
    // Bunların hiçbiri bu ekranın işi değil:
    expect(yama).not.toHaveProperty('company_code')
    expect(yama).not.toHaveProperty('tenant_id')
    expect(yama).not.toHaveProperty('primary_sector_id')
    expect(yama).not.toHaveProperty('status')
    expect(yama).not.toHaveProperty('default_branch_id')
  })

  it('⚠️ BOŞALTILAN ALAN `null` yazılıyor, boş metin DEĞİL', async () => {
    await firmaProfiliniYaz('firma-1', { ...DOLU_FORM, ticariUnvan: '   ', web: '' })

    const yama = guncelle.mock.calls[0][0] as Record<string, unknown>
    // "bilinmiyor" ile "boş bırakıldı" aynı şey değil.
    expect(yama.legal_name).toBeNull()
    expect(yama.website).toBeNull()
    expect(yama.tax_number).toBe('1234567890')
  })

  it('⚠️ vergi numarası biçimi yanlışsa veritabanına HİÇ gidilmiyor', async () => {
    // Yanlış numarayı kaydedip aylar sonra e-fatura tarafında öğrenmektense
    // burada söylemek ucuzdur.
    const kisa = await firmaProfiliniYaz('firma-1', { ...DOLU_FORM, vergiNumarasi: '12345' })
    expect(kisa.durum).toBe('hata')
    expect(kisa.durum === 'hata' && kisa.mesaj).toContain('10 hane')
    expect(guncelle).not.toHaveBeenCalled()

    const harfli = await firmaProfiliniYaz('firma-1', { ...DOLU_FORM, vergiNumarasi: '12345678A0' })
    expect(harfli.durum === 'hata' && harfli.mesaj).toContain('rakam')
    expect(guncelle).not.toHaveBeenCalled()
  })

  it('10 hane (VKN) ve 11 hane (TC) kabul ediliyor, boş da serbest', async () => {
    // ⚠️ Boş SERBEST: yeni açılmış işletme numarasını henüz girmemiş
    // olabilir; onu kapıda bırakmayız.
    for(const numara of ['1234567890', '12345678901', '']){
      vi.clearAllMocks()
      selectCevap.mockResolvedValue({ data: [YENI_SATIR], error: null })
      eqGuncelle.mockResolvedValue({ error: null })
      const sonuc = await firmaProfiliniYaz('firma-1', { ...DOLU_FORM, vergiNumarasi: numara })
      expect(sonuc.durum, `"${numara}" reddedildi`).toBe('oldu')
    }
  })

  it('aradaki boşluklar temizlenerek yazılıyor', async () => {
    await firmaProfiliniYaz('firma-1', { ...DOLU_FORM, vergiNumarasi: '1234 567 890' })

    const yama = guncelle.mock.calls[0][0] as Record<string, unknown>
    expect(yama.tax_number).toBe('1234567890')
  })

  it('firma adı boşsa veritabanına HİÇ gidilmiyor', async () => {
    const sonuc = await firmaProfiliniYaz('firma-1', { ...DOLU_FORM, firmaAdi: '  ' })

    expect(sonuc).toEqual({ durum: 'hata', mesaj: 'Firma adı zorunludur.' })
    expect(guncelle).not.toHaveBeenCalled()
  })

  it('⚠️ başarıdan sonra GERİ OKUNUYOR — ekranda formdaki değer kalmıyor', async () => {
    selectCevap.mockResolvedValue({
      data: [{ ...YENI_SATIR, company_name: 'Veritabanının yazdığı ad' }], error: null,
    })

    const sonuc = await firmaProfiliniYaz('firma-1', DOLU_FORM)

    expect(sonuc.durum).toBe('oldu')
    // Formda başka bir ad vardı; ekran veritabanındakini göstermeli.
    expect(sonuc.durum === 'oldu' && sonuc.profil.firmaAdi).toBe('Veritabanının yazdığı ad')
    expect(selectCagrisi).toHaveBeenCalled()
  })

  it('⚠️ yetkisizlik (42501) ham metinle değil, SEBEBİYLE gösteriliyor', async () => {
    eqGuncelle.mockResolvedValue({
      error: { message: 'permission denied for table company', code: '42501' },
    })

    const sonuc = await firmaProfiliniYaz('firma-1', DOLU_FORM)

    expect(sonuc.durum).toBe('hata')
    expect(sonuc.durum === 'hata' && sonuc.mesaj).toContain('işletme sahibi')
    // Ham veritabanı metni kullanıcıya gösterilmez (0030'un kuralı).
    expect(JSON.stringify(sonuc)).not.toContain('permission denied')
  })

  it('MI403 (tetik reddi) de aynı sebebi veriyor', async () => {
    eqGuncelle.mockResolvedValue({ error: { message: 'MI403', code: 'MI403' } })

    const sonuc = await firmaProfiliniYaz('firma-1', DOLU_FORM)
    expect(sonuc.durum === 'hata' && sonuc.mesaj).toContain('yetkiniz yok')
  })

  it('başka hatada ham metin sızmıyor', async () => {
    eqGuncelle.mockResolvedValue({
      error: { message: 'duplicate key value violates unique constraint', code: '23505' },
    })

    const sonuc = await firmaProfiliniYaz('firma-1', DOLU_FORM)
    expect(JSON.stringify(sonuc)).not.toContain('duplicate key')
  })

  it('⚠️ yazım geçip geri okuma düşerse "kaydedildi" DENMİYOR', async () => {
    selectCevap.mockResolvedValue({ data: null, error: { message: 'network' } })

    const sonuc = await firmaProfiliniYaz('firma-1', DOLU_FORM)

    // Yanlış bir tablo göstermektense yenilemesini söylemek dürüsttür.
    expect(sonuc.durum).toBe('hata')
    expect(sonuc.durum === 'hata' && sonuc.mesaj).toContain('yenileyin')
  })
})
