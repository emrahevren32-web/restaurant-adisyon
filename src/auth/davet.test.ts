// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Davet bağlantısı çözümlemesi
//
// Bu ekran müşterinin MİYOP'la ilk teması. Burada bir hata, müşteriyi
// kapıda bırakır ve geri dönüşü yoktur: e-posta bir kez gelir.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { davetiCozumle, sifreDogrula, SIFRE_EN_AZ } from './davet'

const davetHash = '#access_token=abc.def.ghi&expires_in=3600'
  + '&refresh_token=rrr&token_type=bearer&type=invite'

describe('Davet bağlantısı', () => {
  it('davet parçasını okur', () => {
    const s = davetiCozumle(davetHash)
    expect(s).toEqual({
      durum: 'var', tur: 'invite',
      erisimJetonu: 'abc.def.ghi', yenilemeJetonu: 'rrr',
    })
  })

  it('şifre sıfırlama da aynı yoldan gelir', () => {
    const s = davetiCozumle(davetHash.replace('type=invite', 'type=recovery'))
    expect(s.durum === 'var' && s.tur).toBe('recovery')
  })

  it('# olmadan da çalışır', () => {
    expect(davetiCozumle(davetHash.slice(1)).durum).toBe('var')
  })

  it('boş adreste hiçbir şey yapmaz', () => {
    expect(davetiCozumle('')).toEqual({ durum: 'yok' })
    expect(davetiCozumle('#')).toEqual({ durum: 'yok' })
  })

  it('ilgisiz parça davet sayılmaz', () => {
    expect(davetiCozumle('#bolum=stok')).toEqual({ durum: 'yok' })
  })

  it('süresi dolmuş bağlantıyı insan cümlesiyle söyler', () => {
    const s = davetiCozumle(
      '#error=access_denied&error_code=otp_expired'
      + '&error_description=Email+link+is+invalid+or+has+expired',
    )
    expect(s.durum).toBe('hata')
    expect(s.durum === 'hata' && s.mesaj).toMatch(/süresi dolmuş/)
  })

  it('tür doğru ama jeton yoksa SESSİZ GEÇMEZ', () => {
    // Yarım bir bağlantı "davet yok" sayılsaydı müşteri normal giriş
    // ekranına düşer ve neden giremediğini asla anlamazdı.
    const s = davetiCozumle('#type=invite&token_type=bearer')
    expect(s.durum).toBe('hata')
  })
})

describe('Şifre kuralı', () => {
  it('kurallara uyan şifre geçer', () => {
    expect(sifreDogrula('Mutfak2026', 'Mutfak2026')).toEqual([])
  })

  it('kısa şifre reddedilir', () => {
    expect(sifreDogrula('ab12', 'ab12'))
      .toContain(`Şifre en az ${SIFRE_EN_AZ} karakter olmalı.`)
  })

  it('rakamsız ve harfsiz şifre reddedilir', () => {
    expect(sifreDogrula('sadeceharf', 'sadeceharf'))
      .toContain('Şifre en az bir rakam içermeli.')
    expect(sifreDogrula('12345678', '12345678'))
      .toContain('Şifre en az bir harf içermeli.')
  })

  it('iki alan tutmuyorsa söyler', () => {
    expect(sifreDogrula('Mutfak2026', 'Mutfak2027')).toContain('İki şifre aynı değil.')
  })

  it('baştaki ya da sondaki boşluk reddedilir', () => {
    // Kopyala-yapıştırda en sık olan hata; sonra "şifrem çalışmıyor" gelir.
    expect(sifreDogrula(' Mutfak2026', ' Mutfak2026'))
      .toContain('Şifrenin başında ya da sonunda boşluk olmamalı.')
  })

  it('Türkçe harf de harf sayılır', () => {
    expect(sifreDogrula('şeker2026', 'şeker2026')).toEqual([])
  })
})
