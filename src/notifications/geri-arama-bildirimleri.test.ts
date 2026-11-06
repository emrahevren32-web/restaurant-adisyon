// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Zildeki geri arama bildirimleri · davranış sınamaları
//
// ⚠️ SAAT SABİTLENİYOR. Kural "4 saat bekleyen uyarıya döner" ve bunu
// gerçek zamanı bekleyerek sınamak mümkün değil; o yüzden `simdi`
// fonksiyona parametre olarak giriyor. İçeride `new Date()` çağıran bir
// kural, sınanamayan bir kuraldır.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import {
  GERI_ARAMA_BILDIRIM_SINIRI,
  GERI_ARAMA_UYARI_ESIGI_SAAT,
  beklemeSaati,
  geriAramaBildirimleriniYukle,
  geriAramaTalepleriniBildirimeCevir,
} from './geri-arama-bildirimleri'
import {
  BellekGeriAramaDefteri,
  type GeriAramaDefteri,
  type GeriAramaSatiri,
} from '../onboarding/geri-arama.repository'

const SIMDI = new Date('2026-11-06T21:00:00.000Z')

const satir = (ek: Partial<GeriAramaSatiri> = {}): GeriAramaSatiri => ({
  referans: 'GER-ABCDE',
  olusturma: '2026-11-06T20:30:00.000Z',   // yarım saat önce
  adSoyad: 'Emrah Evren',
  telefon: '5446847511',
  isletmeAdi: 'Anadolu Grup A.Ş.',
  eposta: null,
  konu: null,
  uygunSaat: 'FARKETMEZ',
  durum: 'NEW',
  arandi: null,
  arayan: null,
  notDefteri: null,
  sonIslem: '2026-11-06T20:30:00.000Z',
  onayZamani: '2026-11-06T20:30:00.000Z',
  onaySurumu: '2026-11-06-7b40ca4d',
  ...ek,
})

describe('beklemeSaati', () => {
  it('yarım saati 0 sayıyor', () => {
    expect(beklemeSaati('2026-11-06T20:30:00.000Z', SIMDI)).toBe(0)
  })

  it('tam saatleri sayıyor', () => {
    expect(beklemeSaati('2026-11-06T17:00:00.000Z', SIMDI)).toBe(4)
    expect(beklemeSaati('2026-11-05T21:00:00.000Z', SIMDI)).toBe(24)
  })

  it('⚠️ okunamayan tarih 0 — uyduruk bir uyarı üretmiyor', () => {
    expect(beklemeSaati('abc', SIMDI)).toBe(0)
    expect(beklemeSaati('', SIMDI)).toBe(0)
  })

  it('⚠️ gelecekteki tarih negatif değil 0 veriyor', () => {
    // Sunucu saati ile tarayıcı saati birkaç saniye kayabilir; "-1 saattir
    // bekliyor" diye bir cümle kurulmamalı.
    expect(beklemeSaati('2026-11-07T05:00:00.000Z', SIMDI)).toBe(0)
  })
})

describe('geriAramaTalepleriniBildirimeCevir', () => {
  it('bekleyen talep için bir satır üretiyor', () => {
    const [b] = geriAramaTalepleriniBildirimeCevir([satir()], {}, SIMDI)
    expect(b.type).toBe('callback_request')
    expect(b.title).toBe('Geri arama talebi')
    expect(b.targetId).toBe('GER-ABCDE')
  })

  // ⚠️ Zil "yapılacak iş" listesidir. Yapılmış işi orada tutmak, asıl
  // bekleyeni gizler.
  it('⚠️ ARANDI ve KAPANDI olanlar zile DÜŞMÜYOR', () => {
    const girdi = [
      satir({ referans: 'GER-1', durum: 'CONTACTED' }),
      satir({ referans: 'GER-2', durum: 'CLOSED' }),
      satir({ referans: 'GER-3', durum: 'NEW' }),
    ]
    const cikti = geriAramaTalepleriniBildirimeCevir(girdi, {}, SIMDI)
    expect(cikti.map(b => b.targetId)).toEqual(['GER-3'])
  })

  it('hiç bekleyen yoksa zil SUSUYOR', () => {
    const cikti = geriAramaTalepleriniBildirimeCevir(
      [satir({ durum: 'CLOSED' })], {}, SIMDI,
    )
    expect(cikti).toEqual([])
  })

  it('telefon okunabilir biçimde yazılıyor', () => {
    const [b] = geriAramaTalepleriniBildirimeCevir([satir()], {}, SIMDI)
    expect(b.description).toContain('0544 684 75 11')
    // Ham hâli görünmemeli: Emrah zilden okuyup telefonu tuşlayacak.
    expect(b.description).not.toContain('5446847511')
  })

  it('kim, hangi işletme ve ne kadar beklediği tek satırda', () => {
    const [b] = geriAramaTalepleriniBildirimeCevir([satir()], {}, SIMDI)
    expect(b.description).toContain('Emrah Evren')
    expect(b.description).toContain('Anadolu Grup A.Ş.')
    expect(b.description).toContain('şimdi geldi')
  })

  it('uygun arama saati yazılıyor — "şimdi mi arayayım" sorusunun cevabı', () => {
    const [b] = geriAramaTalepleriniBildirimeCevir(
      [satir({ uygunSaat: 'AKSAM' })], {}, SIMDI,
    )
    expect(b.description).toContain('Uygun saat:')
    expect(b.description).toContain('Akşam')
  })

  it('"Farketmez" seçilmişse saat notu YAZILMIYOR — bilgi vermeyen satır', () => {
    const [b] = geriAramaTalepleriniBildirimeCevir([satir()], {}, SIMDI)
    expect(b.description).not.toContain('Uygun saat:')
  })

  it('sorduğu konu varsa yazılıyor', () => {
    const [b] = geriAramaTalepleriniBildirimeCevir(
      [satir({ konu: 'Fiyat ve kurulum süresi' })], {}, SIMDI,
    )
    expect(b.description).toContain('Sorduğu: Fiyat ve kurulum süresi')
  })

  describe('önem derecesi', () => {
    it(`${GERI_ARAMA_UYARI_ESIGI_SAAT} saatten yeni talep "bilgi"`, () => {
      const [b] = geriAramaTalepleriniBildirimeCevir(
        [satir({ olusturma: '2026-11-06T18:30:00.000Z' })], {}, SIMDI, // 2,5 saat
      )
      expect(b.severity).toBe('info')
    })

    it(`⚠️ tam ${GERI_ARAMA_UYARI_ESIGI_SAAT} saatte "uyarı"ya dönüyor`, () => {
      const [b] = geriAramaTalepleriniBildirimeCevir(
        [satir({ olusturma: '2026-11-06T17:00:00.000Z' })], {}, SIMDI, // 4 saat
      )
      expect(b.severity).toBe('warning')
    })

    it('bir gün bekleyen "uyarı" ve metni gün cinsinden', () => {
      const [b] = geriAramaTalepleriniBildirimeCevir(
        [satir({ olusturma: '2026-11-05T20:00:00.000Z' })], {}, SIMDI,
      )
      expect(b.severity).toBe('warning')
      expect(b.description).toContain('1 gündür bekliyor')
    })
  })

  describe('okundu bilgisi', () => {
    it('okunmamışsa readAt boş', () => {
      const [b] = geriAramaTalepleriniBildirimeCevir([satir()], {}, SIMDI)
      expect(b.readAt).toBe('')
    })

    it('okunmuşsa readAt doluyor', () => {
      const okunanlar = { 'geri_arama_GER-ABCDE_NEW': '2026-11-06T20:45:00.000Z' }
      const [b] = geriAramaTalepleriniBildirimeCevir([satir()], okunanlar, SIMDI)
      expect(b.readAt).toBe('2026-11-06T20:45:00.000Z')
    })

    // ⚠️ Kimlik DURUMU içeriyor. İçermeseydi bir kez okunan talep bir daha
    // hiç haber vermezdi — oysa durum değişikliği tam da haber verilecek şey.
    it('⚠️ kimlik durumu içeriyor: durum değişince YENİ bildirim', () => {
      const okunanlar = { 'geri_arama_GER-ABCDE_NEW': '2026-11-06T20:45:00.000Z' }
      const [okunmus] = geriAramaTalepleriniBildirimeCevir([satir()], okunanlar, SIMDI)
      expect(okunmus.id).toBe('geri_arama_GER-ABCDE_NEW')
      expect(okunmus.readAt).not.toBe('')
    })
  })

  it('en yeni talep en üstte', () => {
    const cikti = geriAramaTalepleriniBildirimeCevir([
      satir({ referans: 'GER-ESKI', olusturma: '2026-11-04T10:00:00.000Z' }),
      satir({ referans: 'GER-YENI', olusturma: '2026-11-06T19:00:00.000Z' }),
    ], {}, SIMDI)
    expect(cikti.map(b => b.targetId)).toEqual(['GER-YENI', 'GER-ESKI'])
  })

  it(`zil en çok ${GERI_ARAMA_BILDIRIM_SINIRI} satır gösteriyor`, () => {
    const cok = Array.from({ length: 40 }, (_, i) => satir({
      referans: `GER-${String(i).padStart(5, '0')}`,
      olusturma: new Date(Date.UTC(2026, 10, 6, 10, i)).toISOString(),
    }))
    expect(geriAramaTalepleriniBildirimeCevir(cok, {}, SIMDI))
      .toHaveLength(GERI_ARAMA_BILDIRIM_SINIRI)
  })
})

describe('geriAramaBildirimleriniYukle', () => {
  it('defterden okuyup bildirime çeviriyor', async () => {
    const defter = new BellekGeriAramaDefteri()
    await defter.gonder({
      adSoyad: 'Ayşe Demir',
      telefon: '0532 123 45 67',
      isletmeAdi: 'Demir Gıda',
      eposta: '',
      konu: '',
      uygunSaat: 'SABAH',
      onay: true,
    })
    const cikti = await geriAramaBildirimleriniYukle(defter, {}, SIMDI)
    expect(cikti).toHaveLength(1)
    expect(cikti[0].description).toContain('Demir Gıda')
  })

  // ⚠️ Zil uygulamanın ÇERÇEVESİNDE duruyor. Orada fırlayan bir hata bütün
  // ekranı götürür; bildirim gösterememek, ekranı kaybetmekten iyidir.
  it('⚠️ okuma DÜŞERSE boş dizi dönüyor, hata yukarı fırlamıyor', async () => {
    const bozuk: GeriAramaDefteri = {
      gonder: async () => { throw new Error('olmaz') },
      listele: async () => { throw new Error('ağ gitti') },
      durumuYaz: async () => { throw new Error('olmaz') },
      sil: async () => { throw new Error('olmaz') },
      anaEkranTelefonu: async () => null,
      telefonuYaz: async () => null,
    }
    await expect(geriAramaBildirimleriniYukle(bozuk, {}, SIMDI)).resolves.toEqual([])
  })
})
