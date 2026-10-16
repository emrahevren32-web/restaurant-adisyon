import { describe, expect, it } from 'vitest'
import {
  HAREKET_OLAYLARI, KILIT_SURESI_MS, SON_HAREKET_ANAHTARI, YAZMA_ARALIGI_MS,
  kilideKalan, kilitAciklamasi, kilitDevamEtiketi, kilitlenmeliMi,
  sonHareketiOku, sonHareketiSil, sonHareketiYaz, yazmaZamaniMi,
  KILIT_BASKA_KULLANICI, KILIT_SIFRE_HATALI,
} from './oturum-kilidi'

const SAHTE_DEPO = (): Storage => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v) },
    removeItem: (k: string) => { m.delete(k) },
    clear: () => { m.clear() },
    key: () => null, length: 0,
  } as unknown as Storage
}

const PATLAYAN_DEPO = (): Storage => ({
  getItem: () => { throw new Error('depolama kapalı') },
  setItem: () => { throw new Error('depolama kapalı') },
  removeItem: () => { throw new Error('depolama kapalı') },
  clear: () => {}, key: () => null, length: 0,
} as unknown as Storage)

const AN = 1_760_000_000_000   // sabit bir "şimdi"

describe('vardiya kilidi · süre kararı', () => {
  it('45 dakika', () => {
    expect(KILIT_SURESI_MS).toBe(45 * 60 * 1000)
  })

  it('44:59 kilitlemiyor, 45:00 kilitliyor', () => {
    expect(kilitlenmeliMi(AN - (KILIT_SURESI_MS - 1000), AN)).toBe(false)
    expect(kilitlenmeliMi(AN - KILIT_SURESI_MS, AN)).toBe(true)
  })

  it('az önce hareket eden kilitlenmiyor', () => {
    expect(kilitlenmeliMi(AN - 5000, AN)).toBe(false)
  })

  it('⚠️ FAIL-CLOSED: damga yoksa ya da bozuksa KİLİTLİYOR', () => {
    // Bilinmeyen durumda açık kalan bir kilit, kilit değildir.
    expect(kilitlenmeliMi(null, AN)).toBe(true)
    expect(kilitlenmeliMi(undefined, AN)).toBe(true)
    expect(kilitlenmeliMi(Number.NaN, AN)).toBe(true)
    expect(kilitlenmeliMi(Number.POSITIVE_INFINITY, AN)).toBe(true)
    expect(kilitlenmeliMi(0, AN)).toBe(true)
    expect(kilitlenmeliMi(-1, AN)).toBe(true)
  })

  it('⚠️ saat ileri alınmışsa kilit SONSUZA KADAR kapalı kalmıyor', () => {
    // Damga geleceği gösteriyorsa "az önce hareket etti" sayıyoruz; aksi
    // hâlde sistem saati oynayan cihazda kilit hiç AÇILMAZDI.
    expect(kilitlenmeliMi(AN + 10_000_000, AN)).toBe(false)
  })

  it('uyuyan tablet senaryosu: üç saat sonra uyanınca kilitli', () => {
    // ⚠️ Testin asıl konusu bu. `setTimeout` uyurken ateşlenmez; karar
    // zaman damgası karşılaştırmasından çıktığı için uyanışta doğru çalışıyor.
    const ucSaat = 3 * 60 * 60 * 1000
    expect(kilitlenmeliMi(AN - ucSaat, AN)).toBe(true)
  })
})

describe('vardiya kilidi · kalan süre', () => {
  it('yarı yolda yarısı kalıyor', () => {
    expect(kilideKalan(AN - KILIT_SURESI_MS / 2, AN)).toBe(KILIT_SURESI_MS / 2)
  })
  it('kilitliyken sıfır', () => {
    expect(kilideKalan(AN - KILIT_SURESI_MS, AN)).toBe(0)
    expect(kilideKalan(null, AN)).toBe(0)
  })
})

describe('vardiya kilidi · damga saklama', () => {
  it('yazılan okunuyor', () => {
    const d = SAHTE_DEPO()
    sonHareketiYaz(AN, d)
    expect(sonHareketiOku(d)).toBe(AN)
  })

  it('silinince null', () => {
    const d = SAHTE_DEPO()
    sonHareketiYaz(AN, d)
    sonHareketiSil(d)
    expect(sonHareketiOku(d)).toBe(null)
  })

  it('bozuk değer null dönüyor — ve null KİLİT demek', () => {
    const d = SAHTE_DEPO()
    d.setItem(SON_HAREKET_ANAHTARI, 'elma')
    expect(sonHareketiOku(d)).toBe(null)
    expect(kilitlenmeliMi(sonHareketiOku(d), AN)).toBe(true)
  })

  it('⚠️ depolama HATA ATARSA uygulama çökmüyor', () => {
    // Gizli sekmede `localStorage` erişimi hata atar, boş dönmez.
    const d = PATLAYAN_DEPO()
    expect(() => sonHareketiOku(d)).not.toThrow()
    expect(() => sonHareketiYaz(AN, d)).not.toThrow()
    expect(() => sonHareketiSil(d)).not.toThrow()
    expect(sonHareketiOku(d)).toBe(null)
  })
})

describe('vardiya kilidi · yazma sıklığı', () => {
  it('dakikada bir yazıyor, her tuşta değil', () => {
    expect(YAZMA_ARALIGI_MS).toBe(60_000)
    expect(yazmaZamaniMi(AN, AN + 1000)).toBe(false)
    expect(yazmaZamaniMi(AN, AN + YAZMA_ARALIGI_MS)).toBe(true)
    expect(yazmaZamaniMi(null, AN)).toBe(true)
  })
})

describe('vardiya kilidi · hareket olayları', () => {
  it('tablette parmakla gezinmek de hareket sayılıyor', () => {
    expect(HAREKET_OLAYLARI).toContain('touchstart')
    expect(HAREKET_OLAYLARI).toContain('scroll')
    expect(HAREKET_OLAYLARI).toContain('wheel')
  })
  it('sekmeye geri dönmek de hareket', () => {
    expect(HAREKET_OLAYLARI).toContain('visibilitychange')
  })
})

describe('vardiya kilidi · perdedeki metin', () => {
  it('⚠️ KİMİN oturumu olduğunu SÖYLÜYOR', () => {
    // Yalnız şifre kutusu gösterseydik, vardiya değişiminde gelen kişi
    // oraya KENDİ şifresini yazar, açılmaz, "bozuk" der ve çoğu zaman eski
    // oturumu kullanmaya devam ederdi.
    expect(kilitDevamEtiketi('Alaattin Kocatepe'))
      .toBe('Alaattin Kocatepe olarak devam et')
    expect(kilitAciklamasi('Alaattin Kocatepe')).toContain('Alaattin Kocatepe')
    expect(kilitAciklamasi('Alaattin Kocatepe')).toContain('45 dakika')
  })

  it('adı olmayan hesapta da cümle bozulmuyor', () => {
    expect(kilitDevamEtiketi('   ')).toBe('Hesap olarak devam et')
    expect(kilitAciklamasi('')).toContain('Bu hesap')
  })

  it('başkasının hesabıysa ne yapması gerektiği yazıyor', () => {
    expect(KILIT_BASKA_KULLANICI).toContain('çıkış yapın')
    expect(KILIT_BASKA_KULLANICI).toContain('giriş yapan kişinin adına')
  })

  it('şifre yanlışsa "işin kaybolmadı" diyor', () => {
    expect(KILIT_SIFRE_HATALI).toContain('kaybolmadı')
  })
})
