// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 — Hata bildirimi testleri
//
// En kritik üç iddia, üç kural:
//   1. Defter yazamasa bile bildir() FIRLATMAZ. (Yoksa hata bildirmek yeni
//      hata üretir ve sonsuz döngü doğar.)
//   2. Aynı hata susma süresi içinde BİR KEZ yazılır. (Yoksa döngüde çöken
//      bir ekran tabloyu saniyede yüzlerce satırla doldurur.)
//   3. Kişisel veri yazılmadan önce maskelenir.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  BellekHataDefteri,
  BozukHataDefteri,
  HataBildirici,
  MESAJ_SINIRI,
  OTURUM_SINIRI,
  TEKRAR_SESSIZLIGI_MS,
  YIGIN_SINIRI,
  hataKaydiYap,
  ilkCerceve,
  kisiselVeriyiTemizle,
  parmakIzi,
} from './error-report'

const hataUret = (mesaj: string, yigin?: string): Error => {
  const h = new Error(mesaj)
  h.stack = yigin ?? `Error: ${mesaj}\n    at birYer (dosya.ts:12:3)`
  return h
}

/** Sahte saat: testler gerçek zamanı beklemesin. */
const saat = (baslangic = 0) => {
  let an = baslangic
  return { simdi: () => an, ilerle: (ms: number) => { an += ms } }
}

describe('kisiselVeriyiTemizle', () => {
  it('e-postayı maskeler', () => {
    expect(kisiselVeriyiTemizle('kullanici abcbey@gida.com bulunamadi'))
      .toBe('kullanici (e-posta) bulunamadi')
  })

  it('on haneden uzun sayıyı maskeler (telefon, kart)', () => {
    expect(kisiselVeriyiTemizle('numara 05321234567 gecersiz'))
      .toBe('numara (sayı) gecersiz')
  })

  it('JWT jetonunu maskeler', () => {
    const metin = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.imza gecersiz'
    expect(kisiselVeriyiTemizle(metin)).toContain('(jeton)')
    expect(kisiselVeriyiTemizle(metin)).not.toContain('eyJhbGciOiJIUzI1NiJ9')
  })

  it('kısa sayılara dokunmaz — satır numarası ve miktar lazım', () => {
    expect(kisiselVeriyiTemizle('dosya.ts:12:3 satirinda 57 kg')).toBe('dosya.ts:12:3 satirinda 57 kg')
  })
})

describe('parmakIzi', () => {
  it('aynı hata farklı kimliklerle aynı parmak izini verir', () => {
    const a = parmakIzi('Lot 4f6c9a11-1111-4111-8111-111111111111 bulunamadi')
    const b = parmakIzi('Lot 9b2d1e55-2222-4222-8222-222222222222 bulunamadi')
    expect(a).toBe(b)
  })

  it('farklı hata farklı parmak izi verir', () => {
    expect(parmakIzi('Lot bulunamadi')).not.toBe(parmakIzi('Kalem bulunamadi'))
  })

  it('aynı mesaj farklı yerden fırlarsa ayrı sayılır', () => {
    const a = parmakIzi('bulunamadi', 'Error\n    at depo (a.ts:1:1)')
    const b = parmakIzi('bulunamadi', 'Error\n    at sayim (b.ts:1:1)')
    expect(a).not.toBe(b)
  })

  it('satır numarası değişse bile aynı sayılır', () => {
    const a = parmakIzi('bulunamadi', 'Error\n    at depo (a.ts:10:1)')
    const b = parmakIzi('bulunamadi', 'Error\n    at depo (a.ts:88:4)')
    expect(a).toBe(b)
  })
})

describe('ilkCerceve', () => {
  it('ilk "at" satırını döndürür', () => {
    expect(ilkCerceve('Error: x\n    at bir (a.ts:1:1)\n    at iki (b.ts:2:2)'))
      .toBe('at bir (a.ts:1:1)')
  })

  it('yığın yoksa boş döner', () => {
    expect(ilkCerceve(undefined)).toBe('')
  })
})

describe('hataKaydiYap', () => {
  it('Error olmayan fırlatmaları da kabul eder', () => {
    // JavaScript'te `throw "metin"` yasaldır ve olur.
    expect(hataKaydiYap('düz metin hata').mesaj).toBe('düz metin hata')
    expect(hataKaydiYap({ kod: 500 }).mesaj).toContain('500')
    expect(hataKaydiYap(undefined).mesaj).toBe('bilinmeyen hata')
  })

  it('uzun mesajı kırpar', () => {
    const kayit = hataKaydiYap(hataUret('x'.repeat(MESAJ_SINIRI + 500)))
    expect(kayit.mesaj.length).toBeLessThanOrEqual(MESAJ_SINIRI + 1)
  })

  it('uzun yığını kırpar', () => {
    const kayit = hataKaydiYap(hataUret('kisa', `Error\n${'    at x (a.ts:1:1)\n'.repeat(500)}`))
    expect((kayit.yigin ?? '').length).toBeLessThanOrEqual(YIGIN_SINIRI + 1)
  })

  it('mesajdaki kişisel veriyi maskeler', () => {
    const kayit = hataKaydiYap(hataUret('abcbey@gida.com icin kayit yok'))
    expect(kayit.mesaj).toContain('(e-posta)')
    expect(kayit.mesaj).not.toContain('abcbey@gida.com')
  })

  it('parmak izini MASKELENMİŞ metinden üretir — iki kullanıcı, tek hata', () => {
    // Aynı hata, iki farklı kullanıcı. Maskelendikten sonra ikisi de
    // "(e-posta) icin kayit yok" olur ve TEK hata olarak gruplanır.
    // Ham metinden parmak izi alsaydık iki ayrı hata sayılırdı.
    const a = hataKaydiYap(hataUret('ali@x.com icin kayit yok'))
    const b = hataKaydiYap(hataUret('veli@y.com icin kayit yok'))
    expect(a.parmakIzi).toBe(b.parmakIzi)
  })

  it('türü varsayılan olarak error', () => {
    expect(hataKaydiYap(hataUret('x')).tur).toBe('error')
    expect(hataKaydiYap(hataUret('x'), { tur: 'crash' }).tur).toBe('crash')
  })
})

describe('HataBildirici · Kural 1 — bildirmek yeni hata üretmez', () => {
  it('defter fırlatsa bile bildir() çözülür', async () => {
    const bildirici = new HataBildirici(new BozukHataDefteri())
    await expect(bildirici.bildir(hataUret('patlak'))).resolves.toBeTruthy()
    expect(bildirici.yaziliAdet).toBe(0)
  })

  it('defter fırlarsa referans numarası yine döner', async () => {
    const bildirici = new HataBildirici(new BozukHataDefteri())
    const referans = await bildirici.bildir(hataUret('patlak'))
    expect(referans).toBe(parmakIzi('Error: patlak', hataUret('patlak').stack))
  })
})

describe('HataBildirici · Kural 2 — aynı hata bir kez', () => {
  it('susma süresi içinde ikinci kez yazmaz', async () => {
    const defter = new BellekHataDefteri()
    const s = saat()
    const bildirici = new HataBildirici(defter, { simdi: s.simdi })

    await bildirici.bildir(hataUret('tekrar eden'))
    await bildirici.bildir(hataUret('tekrar eden'))
    await bildirici.bildir(hataUret('tekrar eden'))

    expect(defter.kayitlar).toHaveLength(1)
  })

  it('susma süresi geçince tekrar yazar', async () => {
    const defter = new BellekHataDefteri()
    const s = saat()
    const bildirici = new HataBildirici(defter, { simdi: s.simdi })

    await bildirici.bildir(hataUret('tekrar eden'))
    s.ilerle(TEKRAR_SESSIZLIGI_MS + 1)
    await bildirici.bildir(hataUret('tekrar eden'))

    expect(defter.kayitlar).toHaveLength(2)
  })

  it('FARKLI hatalar birbirini susturmaz', async () => {
    const defter = new BellekHataDefteri()
    const bildirici = new HataBildirici(defter, { simdi: saat().simdi })

    await bildirici.bildir(hataUret('birinci'))
    await bildirici.bildir(hataUret('ikinci'))

    expect(defter.kayitlar).toHaveLength(2)
  })

  it('oturum sınırını aşmaz — sonsuz döngü kalkanı', async () => {
    const defter = new BellekHataDefteri()
    const bildirici = new HataBildirici(defter, { simdi: saat().simdi })

    // ⚠️ Ayırt edici kısım HARF olmalı: parmak izi sayıları siliyor (aynı
    // hatanın satır numarası değişince ayrı sayılmaması için). Sayıyla
    // ayırsaydık 70 hata tek parmak izine düşer, bu test yanlış geçerdi.
    for(let i = 0; i < OTURUM_SINIRI + 20; i++){
      const etiket = 'x'.repeat(i + 1)
      await bildirici.bildir(hataUret(`hata ${etiket}`, `Error\n    at yer${etiket} (a.ts:1:1)`))
    }

    expect(defter.kayitlar).toHaveLength(OTURUM_SINIRI)
  })
})

describe('HataBildirici · yazılan kayıt', () => {
  it('bağlamı kayda geçirir', async () => {
    const defter = new BellekHataDefteri()
    const bildirici = new HataBildirici(defter, { simdi: saat().simdi })

    await bildirici.bildir(hataUret('ekran coktu'), {
      tur: 'crash', yol: 'stok-sayimlari', tarayici: 'Firefox', ek: { ekran: 'Stok Sayımları' },
    })

    const [kayit] = defter.kayitlar
    expect(kayit.tur).toBe('crash')
    expect(kayit.yol).toBe('stok-sayimlari')
    expect(kayit.tarayici).toBe('Firefox')
    expect(kayit.ek).toEqual({ ekran: 'Stok Sayımları' })
  })

  it('defter yazamazsa bunu KONSOLA SÖYLER — yutulan hatanın izi kalır', async () => {
    const gorulen: Array<{ mesaj: string; ayrinti?: unknown }> = []
    const bildirici = new HataBildirici(new BozukHataDefteri(), {
      simdi: saat().simdi,
      konsol: (mesaj, ayrinti) => { gorulen.push({ mesaj, ayrinti }) },
    })

    await bildirici.bildir(hataUret('yazilamayan'))

    // İki satır: hatanın kendisi, ve yazılamadığı.
    expect(gorulen).toHaveLength(2)
    expect(gorulen[1].mesaj).toContain('DEFTERE YAZILAMADI')
    expect((gorulen[1].ayrinti as Error).message).toContain('defter yazamadı')
  })

  it('defter ÇALIŞIRSA yazılamadı satırı çıkmaz', async () => {
    const gorulen: string[] = []
    const bildirici = new HataBildirici(new BellekHataDefteri(), {
      simdi: saat().simdi,
      konsol: mesaj => { gorulen.push(mesaj) },
    })

    await bildirici.bildir(hataUret('yazilan'))

    expect(gorulen).toHaveLength(1)
    expect(gorulen[0]).not.toContain('YAZILAMADI')
  })

  it('konsola da düşer — defter yazamasa bile hata kaybolmaz', async () => {
    const gorulen: string[] = []
    const bildirici = new HataBildirici(new BozukHataDefteri(), {
      simdi: saat().simdi,
      konsol: mesaj => { gorulen.push(mesaj) },
    })

    await bildirici.bildir(hataUret('kayip olmasin'))

    expect(gorulen[0]).toContain('kayip olmasin')
  })
})
