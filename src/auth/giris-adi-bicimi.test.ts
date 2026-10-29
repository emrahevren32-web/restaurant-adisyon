import { describe, expect, it } from 'vitest'
import { kesinEpostaMi } from './giris-adi-bicimi'

// ⚠️ Bu kuralın bedeli: yanlış tarafa düşen bir girdi ya şifre sıfırlama
// bağlantısını HİÇBİR YERE göndermeye kalkar (personel giriş adını e-posta
// sanmak), ya da gerçek e-postasıyla gelen işletme sahibine "yöneticinize
// başvurun" der. İkisi de kullanıcıyı kapıda bırakır.
describe('kesinEpostaMi · giriş adı mı, e-posta mı', () => {
  it('gerçek e-posta adresleri E-POSTADIR', () => {
    expect(kesinEpostaMi('abc.bey@gercek-eposta.com')).toBe(true)
    expect(kesinEpostaMi('emrah@emrahevren.com')).toBe(true)
    expect(kesinEpostaMi('  ABC.Bey@Ornek.COM  ')).toBe(true)
  })

  it('⚠️ personel giriş adı E-POSTA DEĞİLDİR (@ taşısa bile)', () => {
    // `includes('@')` ile ayırsaydık buraya posta göndermeye kalkardık.
    expect(kesinEpostaMi('ad.soyad@ABCGIDA')).toBe(false)
    expect(kesinEpostaMi('depocu@ABCGIDA')).toBe(false)
  })

  it('@ hiç yoksa e-posta değildir', () => {
    expect(kesinEpostaMi('depocu')).toBe(false)
    expect(kesinEpostaMi('')).toBe(false)
  })

  it('⚠️ ayıran şey @ın SAĞINDAKİ nokta — solundaki değil', () => {
    // `ad.soyad@ABCGIDA` solda nokta taşıyor ama e-posta değil;
    // `a@b.c` solda nokta taşımıyor ama e-posta.
    expect(kesinEpostaMi('ad.soyad@ABCGIDA')).toBe(false)
    expect(kesinEpostaMi('a@b.c')).toBe(true)
  })

  it('iç boşluklar kırpılır, karar değişmez', () => {
    expect(kesinEpostaMi('   depocu@ABCGIDA   ')).toBe(false)
  })
})
