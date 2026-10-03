// Portal açıldıktan sonra en tehlikeli hâl: müşteri sipariş verdi, kimse
// görmedi. Bu testler o hâlin ekranda görünmesini koruyor.

import { describe, it, expect } from 'vitest'
import type { Fark, Siparis } from '../sales/sales-order.repository'
import { siparisBildirimleri, siparisOzeti } from './siparis-bildirimleri'

const BUGUN = '2026-09-30'

const sip = (ek: Partial<Siparis> = {}): Siparis => ({
  id: 'sp1', siparisNo: 'SIP-2026-0001', musteriId: 'm1', musteriAdi: 'Migros',
  noktaAdi: 'Ataşehir', siparisTarihi: '2026-09-30', durum: 'Onay Bekliyor',
  guncelRevizyon: 1, olusturmaZamani: '2026-09-30T08:00:00Z', ...ek,
})

const fark = (ek: Partial<Fark> = {}): Fark => ({
  id: 'f1', siparisId: 'sp1', tur: 'Eksik', adim: 'Teslimde',
  bildirenId: 'u1', bildirimZamani: '2026-09-30T10:00:00Z',
  aciklama: '2 koli eksik çıktı', durum: 'Açık', ...ek,
})

describe('siparisBildirimleri', () => {
  it('onay bekleyen siparişi gösteriyor', () => {
    const b = siparisBildirimleri([sip()], [], BUGUN)
    expect(b).toHaveLength(1)
    expect(b[0]?.baslik).toBe('Sipariş onay bekliyor')
    expect(b[0]?.ayrinti).toContain('SIP-2026-0001')
    expect(b[0]?.ayrinti).toContain('Migros')
  })

  it('onaylanmış siparişi GÖSTERMİYOR — satır defterden türetiliyor', () => {
    // Saklanan bildirim, onaydan sonra da ekranda durur ve yalan söyler.
    for(const d of ['Onaylandı', 'Hazır', 'Teslim Edildi', 'İptal'] as const){
      expect(siparisBildirimleri([sip({ durum: d })], [], BUGUN)).toEqual([])
    }
  })

  it('teslim tarihi YAKLAŞMIŞ onaysız sipariş KRİTİK', () => {
    expect(siparisBildirimleri([sip({ teslimTarihi: '2026-10-01' })], [], BUGUN)[0]?.aciliyet)
      .toBe('kritik')
    expect(siparisBildirimleri([sip({ teslimTarihi: '2026-10-20' })], [], BUGUN)[0]?.aciliyet)
      .toBe('uyari')
  })

  it('teslim tarihi GEÇMİŞSE kaç gün geçtiğini yazıyor', () => {
    const b = siparisBildirimleri([sip({ teslimTarihi: '2026-09-27' })], [], BUGUN)
    expect(b[0]?.ayrinti).toContain('3 gün GEÇTİ')
    expect(b[0]?.aciliyet).toBe('kritik')
  })

  it('bugün teslim edilecek siparişi ayrı yazıyor', () => {
    expect(siparisBildirimleri([sip({ teslimTarihi: BUGUN })], [], BUGUN)[0]?.ayrinti)
      .toContain('teslim BUGÜN')
  })

  it('ONAYLIYKEN DEĞİŞMİŞ siparişi ayırt ediyor', () => {
    // 0055: miktar revizyonu onayı düşürür ve sipariş onaya geri döner.
    // Bu, yeni bir siparişten farklı bir iştir; ekranda da farklı görünmeli.
    const b = siparisBildirimleri([sip({ guncelRevizyon: 3 })], [], BUGUN)
    expect(b[0]?.ayrinti).toContain('revizyon 3 — onaylar düştü')
  })

  it('AÇIK fark kaydı her zaman kritik', () => {
    // Birisi bayrağı kaldırdı ve kimse bakmadı demektir.
    const b = siparisBildirimleri([], [fark()], BUGUN)
    expect(b[0]?.aciliyet).toBe('kritik')
    expect(b[0]?.ayrinti).toContain('2 koli eksik çıktı')
  })

  it('karara bağlanmış fark GÖRÜNMÜYOR', () => {
    expect(siparisBildirimleri([], [fark({ durum: 'Karara Bağlandı' })], BUGUN)).toEqual([])
  })

  it('incelemedeki fark uyarı seviyesinde', () => {
    expect(siparisBildirimleri([], [fark({ durum: 'İncelemede' })], BUGUN)[0]?.aciliyet)
      .toBe('uyari')
  })

  it('kritikler ÖNCE sıralanıyor', () => {
    const b = siparisBildirimleri(
      [sip({ id: 'a', siparisNo: 'SIP-1', teslimTarihi: '2026-10-20' })],
      [fark()],
      BUGUN,
    )
    expect(b[0]?.aciliyet).toBe('kritik')
    expect(b[1]?.aciliyet).toBe('uyari')
  })
})

describe('siparisOzeti', () => {
  it('boşken doğru cümleyi kuruyor', () => {
    expect(siparisOzeti([])).toBe('Bekleyen sipariş işi yok.')
  })

  it('onay ve farkı ayrı sayıyor', () => {
    const b = siparisBildirimleri([sip(), sip({ id: 'sp2', siparisNo: 'SIP-2' })], [fark()], BUGUN)
    expect(siparisOzeti(b)).toBe('2 sipariş onay bekliyor · 1 fark kaydı açık')
  })
})
