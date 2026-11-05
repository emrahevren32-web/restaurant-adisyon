// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · İşletme Ayarları deposu testleri · MIYOP-060b
//
// Bu ekran para birimini ve KDV oranını tarayıcıya yazıyordu ve
// `DEFAULT_SETTINGS.vatRate = 10` diye **kimsenin vermediği bir cevap**
// gösteriyordu.
//
// ⚠️ Buradaki EN ÖNEMLİ testler:
//   · "belirlenmemiş" KDV'nin `null` kaldığını, `0`a DÖNMEDİĞİNİ ölçen test.
//     `Number(null)` sıfırdır; o yüzden bu kusur sessizce geri gelebilir ve
//     kaldırdığımız yalanın aynısı olur (sadece 10 yerine 0).
//   · yazılan kolon kümesini donduran test: `updated_at`/`updated_by`
//     buraya KONMAZ, onları sunucu yazar (0103).
// ═══════════════════════════════════════════════════════════════════════════

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Hata = { message: string; code?: string } | null

const secimCagrisi = vi.fn()
const secimCevap = vi.fn(
  async (): Promise<{ data: Record<string, unknown>[] | null; error: Hata }> =>
    ({ data: [], error: null }),
)
const guncelle = vi.fn()
const eqGuncelle = vi.fn(async (): Promise<{ error: Hata }> => ({ error: null }))

const from = vi.fn((tablo: string) => ({
  select: (sutunlar: string) => { secimCagrisi(tablo, sutunlar); return secimCevap() },
  update: (yama: unknown) => { guncelle(yama); return { eq: eqGuncelle } },
}))

vi.mock('../core/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({ from }),
}))

const { isletmeAyarlariniOku, isletmeAyarlariniYaz, kdvOraniniDenetle } =
  await import('./isletme-ayarlari.repository')

// ⚠️ `billing` TAKLİT EDİLMİYOR: MIYOP-094'ün yarışı tam orada çözülüyor,
// taklit edilirse sınama kendi kurgusunu ölçerdi.
const { aktifParaBirimiKodu, paraBirimiKimligiKur } = await import('../billing')

/** Yeni açılmış işletme: para birimi TRY, KDV BELİRLENMEMİŞ. */
const YENI = {
  id: 'ayar-1',
  currency_code: 'TRY',
  vat_rate: null,
  updated_at: '2026-10-29T05:00:00.000Z',
}

describe('isletmeAyarlariniOku', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    secimCevap.mockResolvedValue({ data: [YENI], error: null })
  })

  it('`tenant_settings` tablosundan okuyor', async () => {
    const ayar = await isletmeAyarlariniOku()
    expect(secimCagrisi).toHaveBeenCalledWith('tenant_settings', expect.stringContaining('vat_rate'))
    expect(ayar?.paraBirimi).toBe('TRY')
  })

  it('⚠️ BELİRLENMEMİŞ KDV `null` kalıyor — `0`a DÖNMÜYOR', async () => {
    // `Number(null)` sıfırdır. Bu kusur sessizce geri gelebilir ve
    // kaldırdığımız yalanın aynısı olur, sadece 10 yerine 0.
    const ayar = await isletmeAyarlariniOku()
    expect(ayar?.kdvOrani).toBeNull()
    expect(ayar?.kdvOrani).not.toBe(0)
  })

  it('⚠️ gerçek %0, "belirlenmemiş"ten AYRI', async () => {
    secimCevap.mockResolvedValue({ data: [{ ...YENI, vat_rate: 0 }], error: null })
    expect((await isletmeAyarlariniOku())?.kdvOrani).toBe(0)
  })

  it('Postgres `numeric` metin döndürse de sayıya çevriliyor', async () => {
    // supabase-js `numeric` değerini METİN olarak döndürebiliyor.
    secimCevap.mockResolvedValue({ data: [{ ...YENI, vat_rate: '20.00' }], error: null })
    expect((await isletmeAyarlariniOku())?.kdvOrani).toBe(20)
  })

  it('⚠️ satır yoksa EKRAN AÇMIYOR, null dönüyor', async () => {
    // Satırı `tenant` tablosuna bağlı tetik açar (0103). Ekranın satır
    // açabilmesi, hangi kiracı adına açtığının ekranın elinde olması demek.
    secimCevap.mockResolvedValue({ data: [], error: null })
    expect(await isletmeAyarlariniOku()).toBeNull()
  })

  it('⚠️ birden çok satırda TAHMİN EDİLMİYOR', async () => {
    secimCevap.mockResolvedValue({
      data: [YENI, { ...YENI, id: 'ayar-2' }], error: null,
    })
    expect(await isletmeAyarlariniOku()).toBeNull()
  })

  it('⚠️ kiracı süzmesi sorguya ELLE eklenmiyor — RLS yapar', async () => {
    await isletmeAyarlariniOku()
    const [, sutunlar] = secimCagrisi.mock.calls[0] as [string, string]
    expect(sutunlar).not.toContain('tenant_id')
  })
})

describe('kdvOraniniDenetle', () => {
  it('BOŞ SERBEST — "seçmedim" geçerli bir cevap', () => {
    expect(kdvOraniniDenetle('')).toBeNull()
    expect(kdvOraniniDenetle('   ')).toBeNull()
  })

  it('0 ile 100 arası kabul, dışı red', () => {
    expect(kdvOraniniDenetle('0')).toBeNull()
    expect(kdvOraniniDenetle('20')).toBeNull()
    expect(kdvOraniniDenetle('100')).toBeNull()
    expect(kdvOraniniDenetle('101')).toContain('%0 ile %100')
    expect(kdvOraniniDenetle('-1')).toContain('%0 ile %100')
  })

  it('virgül de kabul ediliyor (kullanıcı 18,5 yazar)', () => {
    expect(kdvOraniniDenetle('18,5')).toBeNull()
  })

  it('sayı olmayan reddediliyor', () => {
    expect(kdvOraniniDenetle('yirmi')).toContain('sayı')
  })
})

describe('isletmeAyarlariniYaz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    secimCevap.mockResolvedValue({ data: [YENI], error: null })
    eqGuncelle.mockResolvedValue({ error: null })
  })

  it('⚠️ YAZILAN KOLON KÜMESİ DONDURULDU', async () => {
    await isletmeAyarlariniYaz('ayar-1', { paraBirimi: 'EUR', kdvOrani: '20' })

    const yama = guncelle.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(yama).sort()).toEqual(['currency_code', 'vat_rate'])
    // ⚠️ Bunları SUNUCU yazar (0103). Buraya konması, ekranın zamanı ve
    // aktörü belirlediği yanılsaması doğururdu.
    expect(yama).not.toHaveProperty('updated_at')
    expect(yama).not.toHaveProperty('updated_by')
    expect(yama).not.toHaveProperty('tenant_id')
  })

  it('⚠️ KDV BOŞALTILABİLİYOR — `null` yazılıyor, `0` değil', async () => {
    await isletmeAyarlariniYaz('ayar-1', { paraBirimi: 'TRY', kdvOrani: '' })

    const yama = guncelle.mock.calls[0][0] as Record<string, unknown>
    // "Seçmedim" durumuna geri dönmek de bir karardır.
    expect(yama.vat_rate).toBeNull()
  })

  it('bilinmeyen para birimi veritabanına HİÇ gitmiyor', async () => {
    const sonuc = await isletmeAyarlariniYaz('ayar-1', { paraBirimi: 'XXX', kdvOrani: '20' })
    expect(sonuc.durum).toBe('hata')
    expect(guncelle).not.toHaveBeenCalled()
  })

  it('geçersiz KDV veritabanına HİÇ gitmiyor', async () => {
    const sonuc = await isletmeAyarlariniYaz('ayar-1', { paraBirimi: 'TRY', kdvOrani: '250' })
    expect(sonuc.durum).toBe('hata')
    expect(guncelle).not.toHaveBeenCalled()
  })

  it('⚠️ başarıdan sonra GERİ OKUNUYOR', async () => {
    secimCevap.mockResolvedValue({
      data: [{ ...YENI, currency_code: 'USD', vat_rate: '8.00' }], error: null,
    })

    const sonuc = await isletmeAyarlariniYaz('ayar-1', { paraBirimi: 'EUR', kdvOrani: '20' })

    expect(sonuc.durum).toBe('oldu')
    // Formda EUR/20 vardı; ekran veritabanındakini göstermeli.
    expect(sonuc.durum === 'oldu' && sonuc.ayarlar.paraBirimi).toBe('USD')
    expect(sonuc.durum === 'oldu' && sonuc.ayarlar.kdvOrani).toBe(8)
  })

  it('⚠️ yetkisizlik ham metinle değil, SEBEBİYLE gösteriliyor', async () => {
    eqGuncelle.mockResolvedValue({
      error: { message: 'MI403: permission denied', code: 'MI403' },
    })

    const sonuc = await isletmeAyarlariniYaz('ayar-1', { paraBirimi: 'TRY', kdvOrani: '20' })

    expect(sonuc.durum === 'hata' && sonuc.mesaj).toContain('işletme sahibi')
    expect(JSON.stringify(sonuc)).not.toContain('permission denied')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// MIYOP-094 · BAYAT GİRİŞ OKUMASI (Codex, 04.11)
//
// Sıra şuydu ve ölçülmemişti:
//   1. giriş anında `isletmeAyarlariniOku()` başlar, cevabı TRY olacak;
//   2. cevap GELMEDEN kullanıcı EUR kaydeder;
//   3. kaydetme sonrası geri okuma EUR'yu besler, ekran EUR olur;
//   4. ŞİMDİ 1'deki okuma TRY ile döner — ve sürümü hâlâ geçerli olduğu
//      için TRY KAZANIR.
// Kullanıcının gördüğü: "kaydettim ama para birimi değişmedi."
//
// Burada o sıra GERÇEKTEN kuruluyor: ilk okuma elle askıda tutuluyor,
// yazma tamamlanıyor, sonra askıdaki okuma bırakılıyor.
// ═══════════════════════════════════════════════════════════════════════════
describe('MIYOP-094 · uçuştaki giriş okuması ile kaydetme yarışı', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eqGuncelle.mockResolvedValue({ error: null })
    paraBirimiKimligiKur('yaris-' + Math.random())
  })

  it('⚠️ giriş okuması GEÇ gelse de KAYDEDİLEN para birimi kalıyor', async () => {
    // 1) giriş okuması başlasın ve ASILI KALSIN
    const askidakiler: Array<() => void> = []
    secimCevap.mockImplementationOnce(() => new Promise(coz => {
      askidakiler.push(() => coz({
        data: [{ ...YENI, currency_code: 'TRY' }], error: null,
      }))
    }))
    const ucanOkuma = isletmeAyarlariniOku()

    // 2) kullanıcı EUR kaydetsin (geri okuma EUR döndürsün)
    secimCevap.mockResolvedValue({
      data: [{ ...YENI, currency_code: 'EUR' }], error: null,
    })
    const sonuc = await isletmeAyarlariniYaz('ayar-1', { paraBirimi: 'EUR', kdvOrani: '' })
    expect(sonuc.durum).toBe('oldu')
    expect(aktifParaBirimiKodu(), 'kaydetme sonrası besleme çalışmadı').toBe('EUR')

    // 3) ŞİMDİ askıdaki giriş okuması TRY ile dönsün
    expect(askidakiler, 'askıdaki okuma kurulamadı — sınama anlamsız').toHaveLength(1)
    askidakiler[0]()
    await ucanOkuma

    expect(
      aktifParaBirimiKodu(),
      'bayat giriş okuması kaydedilen para birimini EZDİ (MIYOP-094)',
    ).toBe('EUR')
  })

  it('sağlama · askıdaki okuma YARIŞ OLMADAN uygulanıyor', () => {
    // Yukarıdaki sınamanın bir şey ölçtüğünü gösteren kontrol: aynı okuma,
    // araya yazma girmeden, beslemeyi GERÇEKTEN yapıyor. Yoksa "EUR kaldı"
    // sonucu, okumanın hiç beslemediği anlamına da gelebilirdi.
    secimCevap.mockResolvedValue({
      data: [{ ...YENI, currency_code: 'GBP' }], error: null,
    })
    return isletmeAyarlariniOku().then(() => {
      expect(aktifParaBirimiKodu(), 'okuma hiç beslemiyor').toBe('GBP')
    })
  })
})
