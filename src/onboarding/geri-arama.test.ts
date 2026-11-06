// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · GERİ ARAMA TALEBİ · kural ve defter sınamaları
//
// ⚠️ Bu dosya DAVRANIŞ sınıyor. Kapıların veritabanında gerçekten kilitli
// olduğu burada ölçülemez — orası `db/prova/prova-0106.sql` (69 doğrulama,
// gerçek PostgreSQL, `anon` ve `authenticated` rollerine girilerek).
// Yapısal donma ise `geri-arama-kapisi.arch.test.ts` içinde.
// Üçü birlikte anlamlı: biri kural, biri kapı, biri sözleşme.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import {
  KVKK_AYDINLATMA_METNI,
  UYGUN_SAATLER,
  bosGeriAramaTalebi,
  geriAramaDogrula,
  telefonSadelestir,
  telefonuGoster,
  type GeriAramaTalebi,
} from './geri-arama.service'
import { BellekGeriAramaDefteri } from './geri-arama.repository'

const gecerli = (): GeriAramaTalebi => ({
  ...bosGeriAramaTalebi(),
  adSoyad: 'Ayşe Demir',
  telefon: '0532 123 45 67',
  isletmeAdi: 'Demir Gıda',
  onay: true,
})

describe('telefonSadelestir', () => {
  // ⚠️ ÜÇ YAZIM TEK NUMARA. Bu, "aynı numaradan ikinci talep" kapısının
  // ÖN KOŞULU: sadeleşme olmazsa kapı hiç çalışmaz.
  it('aynı numaranın üç yazımı AYNI sonucu veriyor', () => {
    expect(telefonSadelestir('0532 123 45 67')).toBe('5321234567')
    expect(telefonSadelestir('+90 532 1234567')).toBe('5321234567')
    expect(telefonSadelestir('5321234567')).toBe('5321234567')
  })

  it('noktalama ve parantez temizleniyor', () => {
    expect(telefonSadelestir('(0532) 123-45-67')).toBe('5321234567')
  })

  it('sabit hat KABUL ediliyor — işletmenin santrali olabilir', () => {
    expect(telefonSadelestir('0232 456 78 90')).toBe('2324567890')
    expect(telefonSadelestir('0312 456 78 90')).toBe('3124567890')
  })

  it('kısa, uzun ve geçersiz alan kodu REDDEDİLİYOR', () => {
    expect(telefonSadelestir('123')).toBeNull()
    expect(telefonSadelestir('0532 123 45 6')).toBeNull()
    expect(telefonSadelestir('0132 123 45 67')).toBeNull()
    expect(telefonSadelestir('1532 123 45 67')).toBeNull()
  })

  it('boş ve tanımsız null veriyor', () => {
    expect(telefonSadelestir('')).toBeNull()
    expect(telefonSadelestir(null)).toBeNull()
    expect(telefonSadelestir(undefined)).toBeNull()
  })

  it('gösterim biçimi okunabilir', () => {
    expect(telefonuGoster('5321234567')).toBe('0532 123 45 67')
    // Bozuk veriyi GÜZELLEŞTİRMİYOR: olduğu gibi veriyor ki fark edilsin.
    expect(telefonuGoster('123')).toBe('123')
  })
})

describe('geriAramaDogrula', () => {
  it('geçerli form hiç eksik vermiyor', () => {
    expect(geriAramaDogrula(gecerli())).toEqual([])
  })

  // ⚠️ EN ÖNEMLİ SINAMA. Onay kutusu işaretlenmemişse form gitmiyor.
  // Veritabanı da aynı şeyi söylüyor ve `consent_at` NOT NULL.
  it('⚠️ ONAY YOKSA gönderilmiyor', () => {
    const eksikler = geriAramaDogrula({ ...gecerli(), onay: false })
    expect(eksikler).toContain('Aranmayı kabul ettiğinizi işaretlemeniz gerekiyor.')
  })

  it('bütün eksikleri TEK SEFERDE veriyor', () => {
    // Boş form: ad, telefon, işletme ve onay — dört eksik.
    const eksikler = geriAramaDogrula(bosGeriAramaTalebi())
    expect(eksikler).toHaveLength(4)
  })

  it('e-posta BOŞ geçilebiliyor', () => {
    expect(geriAramaDogrula({ ...gecerli(), eposta: '' })).toEqual([])
  })

  it('⚠️ yarım e-posta reddediliyor — oraya yazıp cevap bekleriz', () => {
    expect(geriAramaDogrula({ ...gecerli(), eposta: 'ahmet@' }))
      .toContain('E-posta adresi eksik görünüyor. Düzeltin ya da boş bırakın.')
    expect(geriAramaDogrula({ ...gecerli(), eposta: 'ahmet@firma' }))
      .toContain('E-posta adresi eksik görünüyor. Düzeltin ya da boş bırakın.')
  })

  it('tam e-posta geçiyor', () => {
    expect(geriAramaDogrula({ ...gecerli(), eposta: 'ahmet@firma.com' })).toEqual([])
  })

  it('uzunluk sınırları veritabanındaki kısıtlarla aynı', () => {
    expect(geriAramaDogrula({ ...gecerli(), adSoyad: 'a'.repeat(121) }))
      .toContain('Ad soyad çok uzun (en çok 120 karakter).')
    expect(geriAramaDogrula({ ...gecerli(), isletmeAdi: 'a'.repeat(161) }))
      .toContain('İşletme adı çok uzun (en çok 160 karakter).')
    expect(geriAramaDogrula({ ...gecerli(), konu: 'a'.repeat(601) }))
      .toContain('Not çok uzun (en çok 600 karakter).')
  })

  it('tek harflik ad soyad yetmiyor', () => {
    expect(geriAramaDogrula({ ...gecerli(), adSoyad: 'A' }))
      .toContain('Ad soyad yazılmadı.')
  })

  it('yalnız boşluk yazmak YAZMAMAKTIR', () => {
    expect(geriAramaDogrula({ ...gecerli(), isletmeAdi: '    ' }))
      .toContain('İşletme adı yazılmadı.')
  })

  it('dört uygun saat seçeneği var ve hepsi geçerli', () => {
    expect(UYGUN_SAATLER).toHaveLength(4)
    for(const saat of UYGUN_SAATLER){
      expect(geriAramaDogrula({ ...gecerli(), uygunSaat: saat })).toEqual([])
    }
  })
})

describe('KVKK metni', () => {
  it('⚠️ SAKLAMA SÜRESİ VAAT ETMİYOR — kendiliğinden silen bir iş yok', () => {
    // Bu sınama bir cümle avı değil, bir sözün bekçisi: "12 ay sonra
    // silinir" demek için otomatik silme kurulu olmalı. Kurulu olmadığı
    // sürece metin süre yazamaz.
    expect(KVKK_AYDINLATMA_METNI).not.toMatch(/\d+\s*(ay|yıl|gün)/i)
  })

  it('tuttuğumuz sözü YAZIYOR: silme ve düzeltme talebi', () => {
    expect(KVKK_AYDINLATMA_METNI).toMatch(/sil/i)
    expect(KVKK_AYDINLATMA_METNI).toMatch(/düzelt/i)
  })

  it('ne YAPMADIĞIMIZI da yazıyor', () => {
    expect(KVKK_AYDINLATMA_METNI).toMatch(/pazarlama/i)
    expect(KVKK_AYDINLATMA_METNI).toMatch(/satılmaz|devredilmez/i)
  })
})

describe('defter · talep bırakma', () => {
  it('numara döndürüyor', async () => {
    const defter = new BellekGeriAramaDefteri()
    const referans = await defter.gonder(gecerli())
    expect(referans).toMatch(/^GER-/)
    expect(await defter.listele()).toHaveLength(1)
  })

  it('⚠️ onaysız gönderim defterde de reddediliyor', async () => {
    const defter = new BellekGeriAramaDefteri()
    await expect(defter.gonder({ ...gecerli(), onay: false })).rejects.toThrow(/onay/i)
    expect(await defter.listele()).toHaveLength(0)
  })

  it('⚠️ aynı numaradan İKİNCİ açık talep reddediliyor', async () => {
    const defter = new BellekGeriAramaDefteri()
    await defter.gonder(gecerli())
    // Farklı yazım, aynı numara.
    await expect(defter.gonder({ ...gecerli(), telefon: '+90 532 1234567' }))
      .rejects.toThrow(/bekleyen bir geri arama talebi/i)
  })

  it('kapanmış talepten sonra yeni talep geçiyor', async () => {
    const defter = new BellekGeriAramaDefteri()
    const r1 = await defter.gonder(gecerli())
    await defter.durumuYaz(r1, 'CLOSED', 'ilgilenmedi')
    const r2 = await defter.gonder(gecerli())
    expect(r2).not.toBe(r1)
  })

  it('⚠️ aynı numaradan en çok ÜÇ talep', async () => {
    const defter = new BellekGeriAramaDefteri()
    for(let i = 0; i < 3; i += 1){
      const r = await defter.gonder(gecerli())
      await defter.durumuYaz(r, 'CLOSED', 'kapatildi')
    }
    await expect(defter.gonder(gecerli())).rejects.toThrow(/çok sayıda talep/i)
  })

  it('başka numara aynı anda geçebiliyor — kapı NUMARAYA bağlı', async () => {
    const defter = new BellekGeriAramaDefteri()
    await defter.gonder(gecerli())
    const r = await defter.gonder({ ...gecerli(), telefon: '0555 111 22 33' })
    expect(r).toMatch(/^GER-/)
  })
})

describe('defter · durum', () => {
  it('⚠️ gerekçesiz KAPATMA reddediliyor', async () => {
    const defter = new BellekGeriAramaDefteri()
    const r = await defter.gonder(gecerli())
    await expect(defter.durumuYaz(r, 'CLOSED', '')).rejects.toThrow(/not yazın/i)
  })

  it('arandı işaretlenince zamanı ve arayanı doluyor', async () => {
    const defter = new BellekGeriAramaDefteri()
    const r = await defter.gonder(gecerli())
    await defter.durumuYaz(r, 'CONTACTED', 'arandı')
    const satir = (await defter.listele()).find(s => s.referans === r)
    expect(satir?.durum).toBe('CONTACTED')
    expect(satir?.arandi).not.toBeNull()
    expect(satir?.arayan).not.toBeNull()
  })

  it('⚠️ not BİRİKİYOR, üstüne yazılmıyor', async () => {
    const defter = new BellekGeriAramaDefteri()
    const r = await defter.gonder(gecerli())
    await defter.durumuYaz(r, 'CONTACTED', 'birinci not')
    await defter.durumuYaz(r, 'CLOSED', 'ikinci not')
    const satir = (await defter.listele()).find(s => s.referans === r)
    expect(satir?.notDefteri).toContain('birinci not')
    expect(satir?.notDefteri).toContain('ikinci not')
    expect((satir?.notDefteri ?? '').split('\n')).toHaveLength(2)
  })

  it('⚠️ "arandı" zamanı ikinci işlemde DEĞİŞMİYOR (ilk temas)', async () => {
    const defter = new BellekGeriAramaDefteri()
    const r = await defter.gonder(gecerli())
    await defter.durumuYaz(r, 'CONTACTED', 'ilk')
    const ilk = (await defter.listele()).find(s => s.referans === r)?.arandi
    await defter.durumuYaz(r, 'CLOSED', 'son')
    const son = (await defter.listele()).find(s => s.referans === r)?.arandi
    expect(son).toBe(ilk)
  })

  it('olmayan numara reddediliyor', async () => {
    const defter = new BellekGeriAramaDefteri()
    await expect(defter.durumuYaz('GER-YOKYO', 'CONTACTED', 'x'))
      .rejects.toThrow(/bulunamadı/i)
  })

  it('bekleyen talep listenin EN ÜSTÜNDE — ekranın işi "kimi aramalıyım"', async () => {
    const defter = new BellekGeriAramaDefteri()
    const r1 = await defter.gonder(gecerli())
    await defter.durumuYaz(r1, 'CLOSED', 'kapandi')
    await defter.gonder({ ...gecerli(), telefon: '0555 111 22 33' })
    const liste = await defter.listele()
    expect(liste[0]?.durum).toBe('NEW')
  })
})

describe('defter · KVKK silme hakkı', () => {
  it('⚠️ kayıt GERÇEKTEN siliniyor — metindeki sözün karşılığı', async () => {
    const defter = new BellekGeriAramaDefteri()
    const r = await defter.gonder(gecerli())
    await defter.sil(r)
    expect(await defter.listele()).toHaveLength(0)
  })

  it('olmayan kaydın silmesi hata veriyor', async () => {
    const defter = new BellekGeriAramaDefteri()
    await expect(defter.sil('GER-YOKYO')).rejects.toThrow(/bulunamadı/i)
  })
})

describe('defter · ana ekran telefonu', () => {
  it('⚠️ yazılmadan önce BOŞ — ekranda hiçbir şey görünmez', async () => {
    const defter = new BellekGeriAramaDefteri()
    expect(await defter.anaEkranTelefonu()).toBeNull()
  })

  it('yazılınca okunuyor, sadeleşmiş hâlde', async () => {
    const defter = new BellekGeriAramaDefteri()
    await defter.telefonuYaz('0232 123 45 67')
    expect(await defter.anaEkranTelefonu()).toBe('2321234567')
  })

  it('⚠️ boş göndermek numarayı KALDIRIYOR (bayrak değil veri)', async () => {
    const defter = new BellekGeriAramaDefteri()
    await defter.telefonuYaz('0232 123 45 67')
    await defter.telefonuYaz('')
    expect(await defter.anaEkranTelefonu()).toBeNull()
  })

  it('bozuk numara reddediliyor ve eski değeri bozmuyor', async () => {
    const defter = new BellekGeriAramaDefteri()
    await defter.telefonuYaz('0232 123 45 67')
    await expect(defter.telefonuYaz('abc')).rejects.toThrow(/anlaşılamadı/i)
    expect(await defter.anaEkranTelefonu()).toBe('2321234567')
  })
})
