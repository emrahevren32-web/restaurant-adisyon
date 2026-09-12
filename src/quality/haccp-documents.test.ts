// HACCP çıktıları. Denetimde verilecek kâğıt bunlar; en çok kolladığı şey
// UYGUNSUZ BİR ÖLÇÜMÜN KÂĞITTA SAKLANAMAMASI.

import { describe, it, expect } from 'vitest'
import type { Ccp, DuzelticiFaaliyet, Olcum } from './haccp.repository'
import { ccpPlaniHtml, olcumKayitFormuHtml } from './haccp-documents'

const ccp = (yama: Partial<Ccp> = {}): Ccp => ({
  id: 'c1', planId: 'p1', kod: 'CCP-1', ad: 'Soğuk zincir · mal kabul',
  asama: 'RECEIVING', limitTipi: 'MAX', limitUst: 4, birim: '°C',
  limitMetni: 'En çok 4 °C', durum: 'ACTIVE',
  olcumYontemi: 'Prob termometre', olcumSikligi: 'Her teslimatta',
  sorumluRol: 'Depo sorumlusu', tehlikeTipi: 'BIOLOGICAL',
  tehlikeNotu: 'Soğuk zincir kırılması',
  duzelticiTalimat: 'Malı kabul etme, iade et.', ...yama,
})

const olcum = (yama: Partial<Olcum> = {}): Olcum => ({
  id: 'o1', ccpId: 'c1', ccpKod: 'CCP-1', ccpAd: 'Soğuk zincir · mal kabul',
  deger: 3, birim: '°C', sonuc: 'PASS', limitOzeti: 'En çok 4 °C (°C)',
  kaynakTipi: 'goods_receipt', kaynakId: 'mk1',
  olcumZamani: '2026-09-10T08:00:00Z', ...yama,
})

const faaliyet = (yama: Partial<DuzelticiFaaliyet> = {}): DuzelticiFaaliyet => ({
  id: 'f1', olcumId: 'o1', aciklama: 'CCP-1 sapma', durum: 'OPEN', ...yama,
})

describe('ccpPlaniHtml', () => {
  it('kritik limiti, yöntemi ve limit aşılırsa yapılacağı basıyor', () => {
    const html = ccpPlaniHtml([ccp()], 'Merkez Depo')
    expect(html).toContain('CCP-1')
    expect(html).toContain('En çok 4 °C')
    expect(html).toContain('Prob termometre')
    // Denetçinin ilk sorusu: limit aşılınca ne yapıyorsunuz?
    expect(html).toContain('Malı kabul etme')
    expect(html).toContain('Merkez Depo')
  })

  it('aşama adı Türkçe basılıyor, ham kod değil', () => {
    const html = ccpPlaniHtml([ccp({ asama: 'BLAST_CHILLING' })])
    expect(html).toContain('Hızlı soğutma')
    expect(html).not.toContain('BLAST_CHILLING')
  })

  it('imza satırları var — kâğıt tek başına belge olmalı', () => {
    expect(ccpPlaniHtml([ccp()])).toContain('imza')
  })
})

describe('olcumKayitFormuHtml', () => {
  it('uygun ölçümü basıyor', () => {
    const html = olcumKayitFormuHtml([olcum()], [], 'Merkez Depo')
    expect(html).toContain('Uygun')
    expect(html).toContain('En çok 4 °C')
  })

  it('UYGUNSUZ ölçüm kâğıdın başında uyarı doğuruyor', () => {
    const html = olcumKayitFormuHtml([olcum({ sonuc: 'FAIL', deger: 9 })], [])
    expect(html).toContain('UYGUN DEĞİL')
    expect(html).toContain('kritik limiti aşmıştır')
    // Uyarı tablodan ÖNCE: sonra basılsaydı okunmazdı.
    expect(html.indexOf('kritik limiti aşmıştır'))
      .toBeLessThan(html.indexOf('Yapılan işlem'))
  })

  it('KAPANMAMIŞ faaliyet kâğıtta "Açık" olarak görünüyor — saklanamıyor', () => {
    const html = olcumKayitFormuHtml(
      [olcum({ sonuc: 'FAIL', deger: 9 })],
      [faaliyet({ durum: 'OPEN' })],
    )
    expect(html).toContain('Açık')
  })

  it('kapanmış faaliyette YAPILAN İŞ basılıyor', () => {
    const html = olcumKayitFormuHtml(
      [olcum({ sonuc: 'FAIL', deger: 9 })],
      [faaliyet({ durum: 'COMPLETED', yapilanIs: 'Mal iade edildi.' })],
    )
    expect(html).toContain('Mal iade edildi.')
  })

  it('iptal edilen ölçüm kâğıtta GEREKÇESİYLE duruyor', () => {
    const html = olcumKayitFormuHtml(
      [olcum({ iptalZamani: '2026-09-10T09:00:00Z', iptalGerekcesi: 'Termometre bozuktu' })],
      [],
    )
    expect(html).toContain('İPTAL')
    expect(html).toContain('Termometre bozuktu')
  })

  it('iptal edilen uygunsuz ölçüm, üst uyarıyı TETİKLEMİYOR', () => {
    const html = olcumKayitFormuHtml(
      [olcum({ sonuc: 'FAIL', iptalZamani: '2026-09-10T09:00:00Z', iptalGerekcesi: 'x' })],
      [],
    )
    expect(html).not.toContain('kritik limiti aşmıştır')
  })

  it('ölçüm yoksa kâğıt boş değil, "kayıt yok" diyor', () => {
    const html = olcumKayitFormuHtml([], [])
    expect(html).toContain('ölçüm kaydı yok')
  })

  it('limit metni her satırda ölçüm anındaki hâliyle basılıyor', () => {
    const html = olcumKayitFormuHtml([
      olcum({ id: 'a', limitOzeti: 'En çok 4 °C (°C)' }),
      olcum({ id: 'b', limitOzeti: 'En çok 8 °C (°C)' }),
    ], [])
    expect(html).toContain('En çok 4 °C')
    expect(html).toContain('En çok 8 °C')
    expect(html).toContain('ÖLÇÜM ANINDAKİ')
  })

  it('kayıtlardaki metin HTML olarak yorumlanmıyor', () => {
    const html = olcumKayitFormuHtml(
      [olcum({ not: '<img src=x onerror=alert(1)>' })], [],
    )
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })
})
