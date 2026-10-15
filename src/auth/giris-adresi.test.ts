import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 0077 · Kullanıcı adını giriş adresine çevirme.
 *
 * Buradaki testlerin tamamı tek bir soruyu koruyor: "bu kullanıcı adı var mı"
 * sorusu kapıdan cevaplanabiliyor mu? Cevap hayır olmalı — hem sunucu
 * tarafında (prova-0077.sql), hem burada.
 */

const rpc = vi.fn()
let yapilandirildi = true

vi.mock('../core/supabase', () => ({
  isSupabaseConfigured: () => yapilandirildi,
  getSupabase: () => ({ rpc })
}))

const { girisAdresiniCoz, kesinEpostaMi } = await import('./giris-adresi')

describe('kesinEpostaMi — giriş adı ile e-postayı ayırmak', () => {
  it('alan adında nokta varsa e-postadır', () => {
    expect(kesinEpostaMi('abc@ornek.com')).toBe(true)
    expect(kesinEpostaMi('depocu@abcgida.miyop.local')).toBe(true)
  })

  it('⚠️ ad@FIRMAKODU e-posta SAYILMAZ — sunucuya sorulmalı', () => {
    // İlk sürüm bunu e-posta sayıp olduğu gibi Supabase'e gönderiyordu;
    // o hâlde yeni giriş adlarının hiçbiri çalışmazdı.
    expect(kesinEpostaMi('alaattin.kocatepe@ABCGIDA')).toBe(false)
    expect(kesinEpostaMi('depocu@ERSIN')).toBe(false)
  })

  it('@ yoksa e-posta değildir', () => {
    expect(kesinEpostaMi('depocu')).toBe(false)
    expect(kesinEpostaMi('')).toBe(false)
  })
})

describe('girisAdresiniCoz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    yapilandirildi = true
  })

  it('e-posta girdisinde sunucuya hiç gitmez, küçük harfe indirir', async () => {
    const adres = await girisAdresiniCoz('  ABC.Bey@Ornek.COM  ')
    expect(adres).toBe('abc.bey@ornek.com')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('kullanıcı adını sunucudan çözer', async () => {
    rpc.mockResolvedValue({ data: 'depocu@abcgida.miyop.local', error: null })
    const adres = await girisAdresiniCoz('depocu')
    expect(adres).toBe('depocu@abcgida.miyop.local')
    expect(rpc).toHaveBeenCalledWith('giris_adresi_bul', {
      p_kullanici: 'depocu',
      p_isletme: null
    })
  })

  it('işletme kodu boşsa null geçer (boş metin değil)', async () => {
    rpc.mockResolvedValue({ data: 'x@y.local', error: null })
    await girisAdresiniCoz('depocu', '   ')
    expect(rpc).toHaveBeenCalledWith('giris_adresi_bul', {
      p_kullanici: 'depocu',
      p_isletme: null
    })
  })

  it('⚠️ ad@FIRMAKODU sunucuya gönderilir (yerel kısa yol çalışmaz)', async () => {
    rpc.mockResolvedValue({ data: 'depocu@abcgida.miyop.local', error: null })
    const adres = await girisAdresiniCoz('alaattin.kocatepe@ABCGIDA')
    expect(rpc).toHaveBeenCalledWith('giris_adresi_bul', {
      p_kullanici: 'alaattin.kocatepe@ABCGIDA',
      p_isletme: null
    })
    expect(adres).toBe('depocu@abcgida.miyop.local')
  })

  it('⚠️ dahili adres yazan kişi için sunucuya gidilmez', async () => {
    const adres = await girisAdresiniCoz('Depocu@ABCGIDA.miyop.local')
    expect(adres).toBe('depocu@abcgida.miyop.local')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('⚠️ bulunamayan ad için HATA ATMAZ — sahte adresi olduğu gibi döndürür', async () => {
    // Sunucu bulunamayan ad için de geçerli biçimde bir adres döndürüyor.
    // Burada "böyle biri yok" diye ayrı bir hata atsaydık, ekran kullanıcı
    // adı saymaya yarayan bir araca dönerdi.
    rpc.mockResolvedValue({ data: 'yokboylebiri@bulunamadi.miyop.local', error: null })
    const adres = await girisAdresiniCoz('yokboylebiri')
    expect(adres).toBe('yokboylebiri@bulunamadi.miyop.local')
  })

  it('⚠️ RPC arızasında girdiyi olduğu gibi geçirir, hata ATMAZ', async () => {
    // Sebep: ağ arızasında kullanıcı adıyla giriş çalışmayacak ama
    // e-postasıyla giren işletme sahibi etkilenmemeli. Hata atsaydık bir
    // RPC arızası bütün girişleri kilitlerdi.
    rpc.mockResolvedValue({ data: null, error: { message: 'network' } })
    await expect(girisAdresiniCoz('depocu')).resolves.toBe('depocu')
  })

  it('sunucu metin dışında bir şey döndürürse girdi korunur', async () => {
    rpc.mockResolvedValue({ data: { tuhaf: true }, error: null })
    await expect(girisAdresiniCoz('depocu')).resolves.toBe('depocu')
  })

  it('Supabase yapılandırılmamışsa sunucuya gitmez', async () => {
    yapilandirildi = false
    await expect(girisAdresiniCoz('depocu')).resolves.toBe('depocu')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('boş girdi için sunucuya gitmez', async () => {
    await expect(girisAdresiniCoz('   ')).resolves.toBe('')
    expect(rpc).not.toHaveBeenCalled()
  })
})
