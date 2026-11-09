import { describe, expect, it } from 'vitest'
import {
  ADRES_EN_COK,
  BASLIK_EN_AZ,
  BASLIK_EN_COK,
  KAYNAK_EN_COK,
  MEVZUAT_DURUM_ETIKETI,
  OZET_EN_COK,
  VITRIN_SATIR_SINIRI,
  adresGecerliMi,
  mevzuatDogrula,
  tarihiGoster,
  vitrinGosterilsinMi,
  yayimTarihiGecerliMi,
  type MevzuatGirdisi,
} from './mevzuat.service'
import { BellekMevzuatDefteri } from './mevzuat.repository'

const BUGUN = new Date('2026-11-09T12:00:00Z')

const gecerli = (): MevzuatGirdisi => ({
  baslik: 'Gıda Hijyeni Yönetmeliğinde değişiklik',
  ozet: 'Yüzey temizliği kayıtlarının saklama süresi güncellendi.',
  kaynakAdi: 'Resmî Gazete',
  kaynakAdresi: 'https://www.resmigazete.gov.tr/ornek',
  yayimTarihi: '2026-11-07',
  durum: 'YAYINDA',
})

describe('adresGecerliMi · tıklanabilir bağlantının kapısı', () => {
  it('https adres geçiyor', () => {
    expect(adresGecerliMi('https://www.resmigazete.gov.tr/x')).toBe(true)
  })

  it('⚠️ `javascript:` REDDEDİLİYOR — bu bağlantı vitrinde tıklanabilir', () => {
    // Panele erişen birinin ziyaretçinin tarayıcısında kod çalıştırması
    // tam olarak böyle olurdu. Asıl kapı veritabanında (0113).
    expect(adresGecerliMi('javascript:alert(1)')).toBe(false)
    expect(adresGecerliMi('JavaScript:alert(1)')).toBe(false)
    expect(adresGecerliMi('data:text/html,<script>')).toBe(false)
  })

  it('⚠️ `http://` de reddediliyor (şifresiz)', () => {
    expect(adresGecerliMi('http://ornek.gov.tr/x')).toBe(false)
  })

  it('boşluklu ve boş adres reddediliyor', () => {
    expect(adresGecerliMi('https://ornek.gov.tr/ bir yer')).toBe(false)
    expect(adresGecerliMi('')).toBe(false)
    expect(adresGecerliMi(undefined)).toBe(false)
  })

  it('çok uzun adres reddediliyor (kısıtla aynı sınır)', () => {
    expect(adresGecerliMi(`https://a.gov.tr/${'x'.repeat(ADRES_EN_COK)}`)).toBe(false)
  })
})

describe('yayimTarihiGecerliMi', () => {
  it('geçmiş ve bugünkü tarih geçiyor', () => {
    expect(yayimTarihiGecerliMi('2026-11-09', BUGUN)).toBe(true)
    expect(yayimTarihiGecerliMi('2020-01-15', BUGUN)).toBe(true)
  })

  it('⚠️ bir gün pay var (sunucu UTC, Türkiye UTC+3)', () => {
    expect(yayimTarihiGecerliMi('2026-11-10', BUGUN)).toBe(true)
  })

  it('⚠️ gelecek tarih reddediliyor', () => {
    expect(yayimTarihiGecerliMi('2026-12-09', BUGUN)).toBe(false)
  })

  it('çok eski ve bozuk tarih reddediliyor', () => {
    expect(yayimTarihiGecerliMi('1999-12-31', BUGUN)).toBe(false)
    expect(yayimTarihiGecerliMi('09.11.2026', BUGUN)).toBe(false)
    expect(yayimTarihiGecerliMi('', BUGUN)).toBe(false)
  })
})

describe('mevzuatDogrula', () => {
  it('geçerli kayıt hiç eksik vermiyor', () => {
    expect(mevzuatDogrula(gecerli(), BUGUN)).toEqual([])
  })

  it('kısa başlık reddediliyor (eşik sunucudakiyle aynı)', () => {
    expect(mevzuatDogrula({ ...gecerli(), baslik: 'x'.repeat(BASLIK_EN_AZ - 1) }, BUGUN))
      .toContain('Başlık en az beş karakter olmalı.')
    expect(mevzuatDogrula({ ...gecerli(), baslik: 'x'.repeat(BASLIK_EN_AZ) }, BUGUN))
      .toEqual([])
  })

  it('uzun başlık, uzun özet ve uzun kaynak adı reddediliyor', () => {
    expect(mevzuatDogrula({ ...gecerli(), baslik: 'x'.repeat(BASLIK_EN_COK + 1) }, BUGUN).length)
      .toBe(1)
    expect(mevzuatDogrula({ ...gecerli(), ozet: 'x'.repeat(OZET_EN_COK + 1) }, BUGUN).length)
      .toBe(1)
    expect(mevzuatDogrula({ ...gecerli(), kaynakAdi: 'x'.repeat(KAYNAK_EN_COK + 1) }, BUGUN).length)
      .toBe(1)
  })

  it('⚠️ KAYNAK boş geçilemiyor — isteğin çekirdeği bu', () => {
    // Emrah: "kaynak gösterilerek". Kaynaksız bir mevzuat cümlesi,
    // MIYOP-059'un uydurma duyurusundan farksızdır.
    expect(mevzuatDogrula({ ...gecerli(), kaynakAdi: '' }, BUGUN))
      .toContain('Kaynak adı yazılmadı (örnek: Resmî Gazete).')
    expect(mevzuatDogrula({ ...gecerli(), kaynakAdresi: '' }, BUGUN).length).toBe(1)
  })

  it('özet BOŞ geçilebiliyor', () => {
    expect(mevzuatDogrula({ ...gecerli(), ozet: '' }, BUGUN)).toEqual([])
  })

  it('bütün eksikler TEK listede dönüyor', () => {
    const eksikler = mevzuatDogrula(
      { baslik: '', ozet: '', kaynakAdi: '', kaynakAdresi: 'javascript:x',
        yayimTarihi: '', durum: 'YAYINDA' }, BUGUN)
    expect(eksikler.length).toBe(4)
  })
})

describe('tarihiGoster', () => {
  it('ISO günü okunur hâle getiriyor', () => {
    expect(tarihiGoster('2026-11-09')).toBe('09.11.2026')
  })

  it('⚠️ tam zaman damgası gelse de kırpıyor', () => {
    // Sunucu bazı yollarda tam damga döndürebiliyor; şahit numunede aynı
    // tuzağa düşülmüştü.
    expect(tarihiGoster('2026-11-09T00:00:00+03:00')).toBe('09.11.2026')
  })

  it('boş ve bozuk metni olduğu gibi bırakıyor', () => {
    expect(tarihiGoster('')).toBe('')
    expect(tarihiGoster(undefined)).toBe('')
    // ⚠️ 10 karakterden uzun bozuk metin KIRPILIR; bu on karakter, aynen kalır.
    expect(tarihiGoster('bilinmiyor')).toBe('bilinmiyor')
    expect(tarihiGoster('tarih bilinmiyor')).toBe('tarih bili')
  })
})

describe('vitrinGosterilsinMi · boş kutu çizilmez', () => {
  it('⚠️ kayıt yokken kutu ÇİZİLMİYOR', () => {
    // Aynı köşede MIYOP-059'un uydurma duyuruları vardı. Boş bir "Mevzuat"
    // başlığı okuyana "burada bir şey olmalıydı" der.
    expect(vitrinGosterilsinMi(0)).toBe(false)
    expect(vitrinGosterilsinMi(Number.NaN)).toBe(false)
  })

  it('kayıt varken çiziliyor', () => {
    expect(vitrinGosterilsinMi(1)).toBe(true)
  })
})

describe('durum etiketleri', () => {
  it('üç durumun da Türkçe karşılığı var', () => {
    expect(MEVZUAT_DURUM_ETIKETI.TASLAK).toBe('Taslak')
    expect(MEVZUAT_DURUM_ETIKETI.YAYINDA).toBe('Yayında')
    expect(MEVZUAT_DURUM_ETIKETI.ARSIV).toBe('Arşiv')
  })
})

describe('defter · bellek', () => {
  it('yazılan kayıt listeye giriyor, kimlik dönüyor', async () => {
    const defter = new BellekMevzuatDefteri()
    const kimlik = await defter.yaz(null, gecerli())
    expect(kimlik).toBeTruthy()
    expect((await defter.listele()).length).toBe(1)
  })

  it('⚠️ TASLAK ve ARSIV vitrine ÇIKMIYOR', async () => {
    const defter = new BellekMevzuatDefteri()
    await defter.yaz(null, { ...gecerli(), baslik: 'Yayindaki satir' })
    await defter.yaz(null, { ...gecerli(), baslik: 'Taslak satir', durum: 'TASLAK' })
    await defter.yaz(null, { ...gecerli(), baslik: 'Arsiv satir', durum: 'ARSIV' })

    const vitrin = await defter.vitriniOku()
    expect(vitrin.map(s => s.baslik)).toEqual(['Yayindaki satir'])
  })

  it('vitrin tavanı uygulanıyor', async () => {
    const defter = new BellekMevzuatDefteri()
    for(let i = 1; i <= 30; i++){
      await defter.yaz(null, { ...gecerli(), baslik: `Satir ${i}` })
    }
    expect((await defter.vitriniOku()).length).toBe(VITRIN_SATIR_SINIRI)
    expect((await defter.vitriniOku(1000)).length).toBe(20)
  })

  it('güncelleme aynı kimliği koruyor; olmayan kayıt hata veriyor', async () => {
    const defter = new BellekMevzuatDefteri()
    const kimlik = await defter.yaz(null, gecerli())
    expect(await defter.yaz(kimlik, { ...gecerli(), baslik: 'Degisti baslik' }))
      .toBe(kimlik)
    expect((await defter.listele())[0].baslik).toBe('Degisti baslik')
    await expect(defter.yaz('yok-boyle', gecerli())).rejects.toThrow('Kayıt bulunamadı.')
  })

  it('silinen kayıt listeden çıkıyor', async () => {
    const defter = new BellekMevzuatDefteri()
    const kimlik = await defter.yaz(null, gecerli())
    await defter.sil(kimlik)
    expect((await defter.listele()).length).toBe(0)
    await expect(defter.sil(kimlik)).rejects.toThrow('Kayıt bulunamadı.')
  })
})
