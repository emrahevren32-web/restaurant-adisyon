// "Depoda olan depodan, olmayan üretimden" — en kritik iki şey burada:
// AYNI MALI İKİ SİPARİŞE VAAT ETMEMEK ve ÜRETİLEMEYEN KALEMİ ÜRETİLECEK
// GİBİ GÖSTERMEMEK.

import { describe, it, expect } from 'vitest'
import type { Siparis } from './sales-order.repository'
import type { Recete } from '../production/recipe.repository'
import {
  IsEmriTuretmeError, isEmirleriTuret, karsilamaOzeti, karsilamaToplami,
  type KarsilamaSatiri,
} from './sales-order-production'

const siparis = (yama: Partial<Siparis> = {}): Siparis => ({
  id: 'sip1', siparisNo: 'SIP-2026-0001', musteriId: 'm1', musteriAdi: 'Migros',
  siparisTarihi: '2026-09-30', sevkTarihi: '2026-10-02', durum: 'Onaylandı',
  guncelRevizyon: 1, olusturmaZamani: '2026-09-30T08:00:00Z', ...yama,
})

const satir = (yama: Partial<KarsilamaSatiri> = {}): KarsilamaSatiri => ({
  kalemId: 'k1', kalemAdi: 'Çorba', siparisMiktar: 40, birim: 'koli',
  temelBirim: 'koli', birimUyusmuyor: false,
  depoBakiye: 30, rezerve: 0, musait: 30, depodan: 30, uretilecek: 10,
  receteId: 'r1', uretilebilir: true, ...yama,
})

const recete = (yama: Partial<Recete> = {}): Recete => ({
  id: 'r1', kod: 'R-CRB', ad: 'Çorba reçetesi',
  ciktiKalemiId: 'k1', ciktiMiktari: 1, ciktiBirimi: 'koli',
  verim: 100, durum: 'ACTIVE',
  satirlar: [
    { id: 's1', stokKalemiId: 'un', miktar: 2, birim: 'kg', firePayi: 0, siraNo: 1 },
  ],
  ...yama,
} as Recete)

describe('karsilamaOzeti', () => {
  it('depodan ve üretimden ayrı yazıyor', () => {
    expect(karsilamaOzeti(satir())).toBe('30 depodan + 10 üretimden')
  })

  it('tamamı depodan karşılanıyorsa üretimden bahsetmiyor', () => {
    expect(karsilamaOzeti(satir({ siparisMiktar: 20, depodan: 20, uretilecek: 0 })))
      .toBe('20 depodan')
  })

  it('REÇETESİ YOKSA "üretimden" DEMİYOR', () => {
    // Olmayacak bir işi planlamak, planın yalan söylemesidir.
    const c = karsilamaOzeti(satir({ uretilebilir: false, receteId: undefined }))
    expect(c).toContain('reçetesi yok, satın alınmalı')
    expect(c).not.toContain('üretimden')
  })

  it('başka siparişe ayrılmış miktarı SÖYLÜYOR', () => {
    // Söylemeseydik kullanıcı "depoda 30 var, neden 10 aldım" diye sorardı.
    expect(karsilamaOzeti(satir({ rezerve: 20, musait: 10, depodan: 10, uretilecek: 30 })))
      .toContain('20 başka siparişe ayrılmış')
  })

  it('birim uyuşmazlığında SAYI VERMİYOR', () => {
    const c = karsilamaOzeti(satir({
      birim: 'kg', temelBirim: 'koli', birimUyusmuyor: true,
      musait: undefined, depodan: undefined, uretilecek: undefined,
    }))
    expect(c).toContain('hesaplanamıyor')
    expect(c).not.toMatch(/\d+ depodan/)
  })
})

describe('karsilamaToplami', () => {
  it('üretilemeyeni ayrı sayıyor', () => {
    const t = karsilamaToplami([
      satir({ kalemId: 'a', uretilecek: 0 }),
      satir({ kalemId: 'b', uretilecek: 10, uretilebilir: true }),
      satir({ kalemId: 'c', uretilecek: 5, uretilebilir: false }),
      satir({ kalemId: 'd', birimUyusmuyor: true, uretilecek: undefined }),
    ])
    expect(t).toMatchObject({
      kalemSayisi: 4, tamamenDepodan: 1, uretimGereken: 1,
      uretilemeyen: 1, hesaplanamayan: 1,
    })
  })
})

describe('isEmirleriTuret', () => {
  const receteler = new Map([['r1', recete()]])

  it('üretilecek miktarı iş emrine yazıyor, SİPARİŞ MİKTARINI DEĞİL', () => {
    // 40 sipariş, 30'u depoda. 40 üretseydik 30 koli fazla mal yapardık.
    const [ie] = isEmirleriTuret(siparis(), [satir()], receteler, [])
    expect(ie?.girdi.planlananMiktar).toBe(10)
    expect(ie?.girdi.ciktiKalemiId).toBe('k1')
  })

  it('iş emrini siparişe bağlıyor ve sevk tarihini taşıyor', () => {
    const [ie] = isEmirleriTuret(siparis(), [satir()], receteler, [])
    expect(ie?.girdi.siparisId).toBe('sip1')
    expect(ie?.girdi.planlananTarih).toBe('2026-10-02')
    expect(ie?.girdi.not).toContain('SIP-2026-0001')
  })

  it('reçeteyi ÖLÇEKLEYİP satırları kopyalıyor', () => {
    const [ie] = isEmirleriTuret(siparis(), [satir()], receteler, [])
    // 1 koli için 2 kg un → 10 koli için 20 kg.
    expect(ie?.girdi.satirlar).toHaveLength(1)
    expect(ie?.girdi.satirlar[0]?.planlananMiktar).toBe(20)
  })

  it('numaraları SIRAYLA üretiyor — iki iş emri aynı numarayı almıyor', () => {
    const ikili = new Map([['r1', recete()], ['r2', recete({ id: 'r2', ciktiKalemiId: 'k2' })]])
    const ie = isEmirleriTuret(siparis(), [
      satir(),
      satir({ kalemId: 'k2', kalemAdi: 'Pilav', receteId: 'r2', uretilecek: 25 }),
    ], ikili, ['UE-2026-0007'])
    expect(ie.map(x => x.girdi.isEmriNo)).toEqual(['UE-2026-0008', 'UE-2026-0009'])
  })

  it('üretilecek kalem YOKSA sebebini söylüyor', () => {
    expect(() => isEmirleriTuret(siparis(), [satir({ uretilecek: 0 })], receteler, []))
      .toThrow(/tamamı depodan/)
  })

  it('REÇETESİZ kalem için iş emri çıkarmıyor ve bunu SÖYLÜYOR', () => {
    expect(() => isEmirleriTuret(
      siparis(), [satir({ uretilebilir: false, receteId: undefined })], receteler, [],
    )).toThrow(/reçetesi yok; bunlar satın alınmalı/)
  })

  it('birim uyuşmayan kalemi iş emrine koymuyor', () => {
    expect(() => isEmirleriTuret(siparis(), [
      satir({ birimUyusmuyor: true, uretilecek: undefined }),
    ], receteler, [])).toThrow(IsEmriTuretmeError)
  })

  it('reçete OKUNAMADIYSA sessizce atlamıyor', () => {
    // Atlasaydık plan "30 üretilecek" der, iş emri çıkmaz ve kimse fark etmezdi.
    expect(() => isEmirleriTuret(siparis(), [satir()], new Map(), []))
      .toThrow(/reçete okunamadı/)
  })
})
