// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 — Yedek durumu testleri
//
// En kritik iddia: EKSİK bir yedek uyarıyı SUSTURMAZ. Bozuk bir dosyaya
// güvenip rahatlamak, hiç yedek almamaktan tehlikelidir.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { UYARI_ESIGI_GUN, yedekDurumu, type YedekKaydi } from './backup-log'

const BUGUN = new Date('2026-09-13T12:00:00Z')

const kayit = (gunOnce: number, yama: Partial<YedekKaydi> = {}): YedekKaydi => {
  const t = new Date(BUGUN)
  t.setDate(t.getDate() - gunOnce)
  return {
    id: yama.id ?? Math.floor(Math.random() * 100000),
    tarih: t.toISOString(),
    tur: yama.tur ?? 'export',
    eksiksiz: yama.eksiksiz ?? true,
    alanAd: yama.alanAd,
    satir: yama.satir,
    bayt: yama.bayt,
    not: yama.not,
  }
}

describe('Yedek durumu', () => {
  it('hiç yedek yoksa uyarıyor', () => {
    const d = yedekDurumu([], BUGUN)
    expect(d.uyari).toBe(true)
    expect(d.gecenGun).toBeNull()
    expect(d.mesaj).toContain('Hiç yedek alınmamış')
  })

  it('bugün alınmışsa uyarı yok', () => {
    const d = yedekDurumu([kayit(0)], BUGUN)
    expect(d.uyari).toBe(false)
    expect(d.gecenGun).toBe(0)
    expect(d.mesaj).toContain('bugün')
  })

  it('eşiğin altında uyarı yok', () => {
    const d = yedekDurumu([kayit(UYARI_ESIGI_GUN - 1)], BUGUN)
    expect(d.uyari).toBe(false)
  })

  it('eşiğe gelince uyarıyor', () => {
    const d = yedekDurumu([kayit(UYARI_ESIGI_GUN)], BUGUN)
    expect(d.uyari).toBe(true)
    expect(d.mesaj).toContain(`${UYARI_ESIGI_GUN} gün önce`)
  })

  it('EKSİK yedek uyarıyı SUSTURMUYOR', () => {
    // En önemli test. İçinde verinin tamamı olmayan bir dosya "yedek aldım"
    // saymaz; saysaydı kullanıcı bozuk dosyaya güvenerek rahatlardı.
    const d = yedekDurumu([kayit(0, { eksiksiz: false })], BUGUN)
    expect(d.uyari).toBe(true)
    expect(d.mesaj).toContain('Hiç yedek alınmamış')
  })

  it('eksik ve eksiksiz karışıkken EKSİKSİZ olan sayılıyor', () => {
    const d = yedekDurumu([
      kayit(0, { eksiksiz: false }),
      kayit(3, { eksiksiz: true }),
    ], BUGUN)
    expect(d.uyari).toBe(false)
    expect(d.gecenGun).toBe(3)
  })

  it('sıralamadan bağımsız olarak EN YENİ eksiksiz yedek esas alınıyor', () => {
    // Günlük tersten gelse bile doğru sonuç. Sıralamaya güvenmek, veritabanı
    // sırası değiştiğinde sessizce yanlış cevap verirdi.
    const d = yedekDurumu([kayit(30), kayit(2), kayit(15)], BUGUN)
    expect(d.gecenGun).toBe(2)
    expect(d.uyari).toBe(false)
  })

  it('çok eski yedekte gün sayısı mesajda görünüyor', () => {
    const d = yedekDurumu([kayit(23)], BUGUN)
    expect(d.uyari).toBe(true)
    expect(d.mesaj).toContain('23 gün önce')
  })

  it('pg_dump kaydı da eksiksiz yedek sayılıyor', () => {
    // A5'te sunucudaki cron buraya yazacak. Uygulama içi dışa aktarmadan
    // farkı yok: ikisi de "verinin bir kopyası dışarıda" demek.
    const d = yedekDurumu([kayit(1, { tur: 'pg_dump' })], BUGUN)
    expect(d.uyari).toBe(false)
  })
})
