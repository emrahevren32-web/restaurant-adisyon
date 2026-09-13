// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 — Yedek doğrulama testleri
//
// En kritik iddia: BAŞKA BİR İŞLETMENİN yedeği kırmızı düşer. İki müşterinin
// verisinin karışması, veri kaybından beter bir olaydır.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { yedegiDogrula } from './backup-verify'

const BENIM = 'aaaaaaaa-1111-2222-3333-444444444444'
const BASKASININ = 'bbbbbbbb-9999-8888-7777-666666666666'

const dosya = (yama: Record<string, unknown> = {}, veri?: Record<string, unknown[]>) =>
  JSON.stringify({
    kunye: {
      aciklama: 'MİYOP kiracı veri dışa aktarımı.',
      bicimSurumu: 1,
      olusturmaZamani: '2026-09-13T10:00:00Z',
      kiracıId: BENIM,
      tablolar: [{ tablo: 'stock_item', satir: 2 }],
      toplamSatir: 2,
      eksikTablolar: [],
      ...yama,
    },
    veri: veri ?? { stock_item: [{ id: 'k1' }, { id: 'k2' }] },
  })

describe('Yedek doğrulama · dosyanın kendisi', () => {
  it('bozuk dosya HEMEN kalıyor', () => {
    const s = yedegiDogrula('{ bu json degil', { kiracıId: BENIM })
    expect(s.gecti).toBe(false)
    expect(s.bulgular[0].baslik).toContain('okunamıyor')
  })

  it('boş dosya kalıyor', () => {
    expect(yedegiDogrula('', { kiracıId: BENIM }).gecti).toBe(false)
  })

  it('başka bir JSON dosyası "MİYOP yedeği değil" diyor', () => {
    const s = yedegiDogrula('{"ad":"bir sey"}', { kiracıId: BENIM })
    expect(s.gecti).toBe(false)
    expect(s.bulgular.some(b => b.baslik.includes('MİYOP yedeği değil'))).toBe(true)
  })

  it('sağlam dosya geçiyor', () => {
    const s = yedegiDogrula(dosya(), { kiracıId: BENIM })
    expect(s.gecti).toBe(true)
    expect(s.kunye?.toplamSatir).toBe(2)
  })
})

describe('Yedek doğrulama · KİRACI KİMLİĞİ', () => {
  it('BAŞKA BİR İŞLETMENİN yedeği KALIYOR', () => {
    // Emrah'ın sorusu: "iki müşteri birbirinin yedeğini çaldı diyelim".
    // Doğrulama bunu ilk bakışta söylemeli.
    const s = yedegiDogrula(dosya({ kiracıId: BASKASININ }), { kiracıId: BENIM })
    expect(s.gecti).toBe(false)
    const bulgu = s.bulgular.find(b => b.baslik.includes('BAŞKA BİR İŞLETMENİN'))
    expect(bulgu?.durum).toBe('kaldi')
    expect(bulgu?.aciklama).toContain(BASKASININ.slice(0, 8))
  })

  it('kendi yedeği "bu işletmeye ait" diyor', () => {
    const s = yedegiDogrula(dosya(), { kiracıId: BENIM })
    expect(s.bulgular.find(b => b.baslik === 'Bu işletmeye ait')?.durum).toBe('gecti')
  })
})

describe('Yedek doğrulama · içerik bütünlüğü', () => {
  it('EKSİK alınmış yedek kalıyor', () => {
    const s = yedegiDogrula(dosya({ eksikTablolar: ['stock_movement'] }), { kiracıId: BENIM })
    expect(s.gecti).toBe(false)
    expect(s.bulgular.some(b => b.baslik.includes('EKSİK'))).toBe(true)
  })

  it('künye ile içerik tutmuyorsa kalıyor', () => {
    // Dosya elle kurcalanmış ya da yazılırken kesilmiş olabilir.
    const s = yedegiDogrula(
      dosya({ toplamSatir: 5000 }, { stock_item: [{ id: 'k1' }] }),
      { kiracıId: BENIM },
    )
    expect(s.gecti).toBe(false)
    const b = s.bulgular.find(x => x.baslik.includes('TUTMUYOR'))
    expect(b?.aciklama).toContain('5000')
    expect(b?.aciklama).toContain('1 satır')
  })

  it('künye ile içerik tutuyorsa geçiyor', () => {
    expect(yedegiDogrula(dosya(), { kiracıId: BENIM }).gecti).toBe(true)
  })
})

describe('Yedek doğrulama · bugünkü defterle karşılaştırma', () => {
  it('yedekten sonra iş yapılmışsa UYARIR ama kalmaz', () => {
    // Fark olması normaldir: yedek geçmişin fotoğrafıdır. Bunu "hata"
    // saymak, kullanıcıyı her gün kırmızı uyarıya boğardı.
    const s = yedegiDogrula(dosya(), {
      kiracıId: BENIM,
      guncelSayilar: { stock_item: 7 },
    })
    expect(s.gecti).toBe(true)
    const b = s.bulgular.find(x => x.baslik.includes('sonra iş yapılmış'))
    expect(b?.durum).toBe('uyari')
    expect(b?.aciklama).toContain('+5')
  })

  it('defter aynıysa "aynı" diyor', () => {
    const s = yedegiDogrula(dosya(), {
      kiracıId: BENIM,
      guncelSayilar: { stock_item: 2 },
    })
    expect(s.bulgular.find(b => b.baslik === 'Defterle aynı')?.durum).toBe('gecti')
  })

  it('defterde AZALMA uyarı üretmiyor', () => {
    // Silinen/tüketilen kayıtlar olabilir; yedeğin fazla satır taşıması
    // sorun değildir.
    const s = yedegiDogrula(dosya(), {
      kiracıId: BENIM,
      guncelSayilar: { stock_item: 1 },
    })
    expect(s.bulgular.find(b => b.baslik === 'Defterle aynı')?.durum).toBe('gecti')
  })
})
