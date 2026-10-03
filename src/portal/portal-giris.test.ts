import { describe, it, expect } from 'vitest'
import { gommeKodu, portalBaglantisi, portalGirisiniCozumle } from './portal-giris'

describe('portalGirisiniCozumle', () => {
  it('boş adreste giriş yok', () => {
    expect(portalGirisiniCozumle('')).toEqual({ durum: 'yok' })
    expect(portalGirisiniCozumle('#')).toEqual({ durum: 'yok' })
  })

  it('geçerli bağlantıdan jetonları çıkarıyor', () => {
    const g = portalGirisiniCozumle('#access_token=A&refresh_token=R&type=magiclink')
    expect(g).toEqual({ durum: 'var', erisimJetonu: 'A', yenilemeJetonu: 'R' })
  })

  it('PERSONEL davetini yutmuyor', () => {
    // Yutsaydık, davet edilen bir çalışan şifre belirleme ekranına hiç
    // ulaşamazdı (0039).
    expect(portalGirisiniCozumle('#access_token=A&refresh_token=R&type=invite'))
      .toEqual({ durum: 'yok' })
    expect(portalGirisiniCozumle('#access_token=A&refresh_token=R&type=recovery'))
      .toEqual({ durum: 'yok' })
  })

  it('süresi dolmuş bağlantıyı İNSAN CÜMLESİYLE söylüyor', () => {
    const g = portalGirisiniCozumle('#error=access_denied&error_code=otp_expired')
    expect(g.durum).toBe('hata')
    if(g.durum === 'hata') expect(g.mesaj).toMatch(/süresi dolmuş/)
  })

  it('kullanılmış bağlantıyı söylüyor', () => {
    const g = portalGirisiniCozumle('#error=access_denied&error_code=invalid_request')
    expect(g.durum).toBe('hata')
    if(g.durum === 'hata') expect(g.mesaj).toMatch(/geçersiz ya da daha önce kullanılmış/)
  })

  it('yarım bağlantıyı sessizce geçmiyor', () => {
    const g = portalGirisiniCozumle('#type=magiclink&access_token=A')
    expect(g.durum).toBe('hata')
    if(g.durum === 'hata') expect(g.mesaj).toMatch(/eksik/)
  })
})

describe('gömme kodu', () => {
  it('bağlantı SIR TAŞIMIYOR', () => {
    // Bağlantı kiracının açık web sitesinde yazılı olacak. İçine bir anahtar
    // koysaydık, o anahtar herkese açık olurdu.
    const b = portalBaglantisi('https://miyop.example.com/')
    expect(b).toBe('https://miyop.example.com/portal')
    expect(b).not.toContain('token')
    expect(b).not.toContain('?')
  })

  it('iframe kodu üretiyor', () => {
    const k = gommeKodu('https://miyop.example.com')
    expect(k).toContain('https://miyop.example.com/portal')
    expect(k).toContain('<iframe')
  })
})

describe('Davet akışına dokunmama', () => {
  it('portal çözümleyicisi DAVET parçasında "yok" diyor', () => {
    // ⚠️ Bu yalnız bir tip kontrolü değil: Portal.tsx adres çubuğunu
    // "yok" olmadığında temizliyor ve App.tsx davet parçasını ondan SONRA
    // okuyor. Burada 'var' dönseydi, davet edilen her çalışanın bağlantısı
    // sessizce silinirdi.
    const davet = '#access_token=A&refresh_token=R&type=invite&expires_in=3600'
    expect(portalGirisiniCozumle(davet).durum).toBe('yok')
  })
})
