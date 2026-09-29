// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C2 — Sipariş defteri servisi testleri
//
// En önemli test en sonda: durum tablosunun GÖÇTEKİ tabloyla aynı olduğu.
// Kural iki yerde duruyor (veritabanı tetiği + ekranın düğme mantığı) ve iki
// yerde duran kural ayrışır. Bu test o ayrışmayı yakalıyor.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import type { TenantCtx } from '../core/context'
import { siparisGecisleriGocten } from '../core/test-support/goc-tarama'
import {
  IZINLI_GECISLER,
  SiparisDogrulamaError,
  SiparisServisi,
  farkiYaz,
  revizyonFarki,
  siparisleriSuz,
  siparisNoCakistiMi,
  sonrakiSiparisNo,
} from './sales-order.service'
import { SiparisNoCakismasiError } from './sales-order.repository'
import type {
  Fark, FarkKarariGirdisi, Revizyon, Siparis, SiparisDeposu, SiparisDurumu,
  SiparisOlayi, SiparisSatiri, YeniFark, YeniRevizyon, YeniSiparis,
} from './sales-order.repository'

const CTX: TenantCtx = { tenantId: 'k1', branchId: 's1', userId: 'u1' }

const siparis = (ek: Partial<Siparis> = {}): Siparis => ({
  id: 'sp1', siparisNo: 'SIP-1', musteriId: 'm1', siparisTarihi: '2026-09-28',
  durum: 'Taslak', guncelRevizyon: 1, olusturmaZamani: 'x', ...ek,
})

const satir = (ek: Partial<SiparisSatiri> = {}): SiparisSatiri => ({
  id: 'l1', siraNo: 1, kalemId: 'k1', miktar: 200, birim: 'kg', revizyonNo: 1, ...ek,
})

class BellekDeposu implements SiparisDeposu {
  sonSiparis?: YeniSiparis
  sonRevizyon?: YeniRevizyon
  sonFark?: YeniFark
  sonKarar?: FarkKarariGirdisi

  async hepsi(): Promise<Siparis[]> { return [] }
  async ekle(_c: TenantCtx, g: YeniSiparis): Promise<Siparis> {
    this.sonSiparis = g
    return siparis({ siparisNo: g.siparisNo, musteriId: g.musteriId })
  }
  async durumDegistir(_c: TenantCtx, id: string, d: SiparisDurumu): Promise<Siparis> {
    return siparis({ id, durum: d })
  }
  async guncelSatirlar(): Promise<SiparisSatiri[]> { return [] }
  async revizyonlar(): Promise<Revizyon[]> { return [] }
  async revizyonEkle(_c: TenantCtx, g: YeniRevizyon): Promise<void> { this.sonRevizyon = g }
  async farklar(): Promise<Fark[]> { return [] }
  async farkAc(_c: TenantCtx, g: YeniFark): Promise<Fark> {
    this.sonFark = g
    return {
      id: 'f1', siparisId: g.siparisId, tur: g.tur, adim: g.adim,
      bildirenId: 'u1', bildirimZamani: 'x', aciklama: g.aciklama, durum: 'Açık',
    }
  }
  async farkiKararaBagla(_c: TenantCtx, id: string, g: FarkKarariGirdisi): Promise<Fark> {
    this.sonKarar = g
    return {
      id, siparisId: 'sp1', tur: 'Eksik', adim: 'Teslimde', bildirenId: 'u1',
      bildirimZamani: 'x', aciklama: 'a', durum: 'Karara Bağlandı', karar: g.karar,
    }
  }
  async olaylar(): Promise<SiparisOlayi[]> { return [] }
}

const kur = () => {
  const depo = new BellekDeposu()
  return { depo, servis: new SiparisServisi(depo) }
}

const YENI: YeniSiparis = {
  siparisNo: 'SIP-2026-0001', musteriId: 'm1',
  satirlar: [{ kalemId: 'k1', miktar: 200, birim: 'kg' }],
}

describe('Sipariş doğrulaması', () => {
  it('numara ve müşteri zorunlu', async () => {
    const { servis } = kur()
    await expect(servis.ekle(CTX, { ...YENI, siparisNo: '  ' }))
      .rejects.toThrow(/numarası zorunlu/)
    await expect(servis.ekle(CTX, { ...YENI, musteriId: '' }))
      .rejects.toThrow(/müşteri kartına bağlı/)
  })

  it('satırsız sipariş açılamıyor', async () => {
    const { servis } = kur()
    await expect(servis.ekle(CTX, { ...YENI, satirlar: [] }))
      .rejects.toThrow(/en az bir kalem/)
  })

  it('miktar ve birim zorunlu', async () => {
    const { servis } = kur()
    await expect(servis.ekle(CTX, { ...YENI, satirlar: [{ kalemId: 'k1', miktar: 0, birim: 'kg' }] }))
      .rejects.toThrow(/sıfırdan büyük/)
    // Birimsiz bir miktar, hangi büyüklükte olduğu bilinmeyen bir sayıdır.
    await expect(servis.ekle(CTX, { ...YENI, satirlar: [{ kalemId: 'k1', miktar: 5, birim: ' ' }] }))
      .rejects.toThrow(/birimi zorunlu/)
  })

  it('aynı ürün iki satırda olamıyor', async () => {
    const { servis } = kur()
    await expect(servis.ekle(CTX, { ...YENI, satirlar: [
      { kalemId: 'k1', miktar: 5, birim: 'kg' },
      { kalemId: 'k1', miktar: 3, birim: 'kg' },
    ] })).rejects.toThrow(/zaten var/)
  })

  it('teslim tarihi sevkten önce olamıyor', async () => {
    const { servis } = kur()
    await expect(servis.ekle(CTX, { ...YENI, sevkTarihi: '2026-10-02', teslimTarihi: '2026-10-01' }))
      .rejects.toThrow(/sevk tarihinden önce/)
  })
})

describe('Durum akışı', () => {
  it('atlanan geçiş reddediliyor', async () => {
    const { servis } = kur()
    await expect(servis.durumDegistir(CTX, siparis({ durum: 'Taslak' }), 'Sevk Edildi'))
      .rejects.toThrow(/geçemez/)
  })

  it('izinli geçiş kabul ediliyor', async () => {
    const { servis } = kur()
    await expect(servis.durumDegistir(CTX, siparis({ durum: 'Hazır' }), 'Sevk Edildi'))
      .resolves.toBeTruthy()
  })

  it('son duraktan çıkış yok', async () => {
    const { servis } = kur()
    await expect(servis.durumDegistir(CTX, siparis({ durum: 'İptal' }), 'Taslak'))
      .rejects.toThrow(/geçemez/)
    await expect(servis.durumDegistir(CTX, siparis({ durum: 'Teslim Edildi' }), 'Hazır'))
      .rejects.toThrow(/geçemez/)
  })
})

describe('Revizyon kuralları', () => {
  const rev = (ek: Partial<YeniRevizyon> = {}): YeniRevizyon => ({
    siparisId: 'sp1', tur: 'MIKTAR', kaynak: 'Telefon', gerekce: 'Müşteri değiştirdi',
    satirlar: [{ kalemId: 'k1', miktar: 150, birim: 'kg' }], ...ek,
  })

  it('gerekçe zorunlu', async () => {
    const { servis } = kur()
    await expect(servis.revizyonEkle(CTX, siparis(), rev({ gerekce: '  ' })))
      .rejects.toThrow(/gerekçesi zorunlu/)
  })

  it('sevk ÖNCESİ miktar revizyonu serbest', async () => {
    const { depo, servis } = kur()
    await servis.revizyonEkle(CTX, siparis({ durum: 'Hazırlanıyor' }), rev())
    expect(depo.sonRevizyon?.satirlar?.[0].miktar).toBe(150)
  })

  it('sevk SONRASI miktar revizyonu farksız reddediliyor', async () => {
    // Emrah: "Sevk edildikten sonra 200 değil de 150 istiyorum olmaz — en
    // başından istediği şeyi üretmişim."
    const { servis } = kur()
    for(const d of ['Kısmi Sevk', 'Sevk Edildi', 'Teslim Edildi'] as SiparisDurumu[]){
      await expect(servis.revizyonEkle(CTX, siparis({ durum: d }), rev()))
        .rejects.toThrow(/fark kaydı açın/)
    }
  })

  it('sevk sonrası miktar revizyonu FARKA BAĞLI olunca geçiyor', async () => {
    const { depo, servis } = kur()
    await servis.revizyonEkle(CTX, siparis({ durum: 'Sevk Edildi' }), rev({ farkId: 'f1' }))
    expect(depo.sonRevizyon?.farkId).toBe('f1')
  })

  it('sevk sonrası LOJİSTİK revizyonu serbest', async () => {
    // Emrah: "a noktasına değil b noktasına olur."
    const { depo, servis } = kur()
    await servis.revizyonEkle(CTX, siparis({ durum: 'Sevk Edildi' }), rev({
      tur: 'LOJISTIK', satirlar: undefined, noktaId: 'n2',
    }))
    expect(depo.sonRevizyon?.noktaId).toBe('n2')
  })

  it('lojistik revizyonu satır taşıyamıyor', async () => {
    const { servis } = kur()
    await expect(servis.revizyonEkle(CTX, siparis(), rev({ tur: 'LOJISTIK' })))
      .rejects.toThrow(/satır taşımaz/)
  })

  it('hiçbir şey değiştirmeyen lojistik revizyonu reddediliyor', async () => {
    const { servis } = kur()
    await expect(servis.revizyonEkle(CTX, siparis(), rev({ tur: 'LOJISTIK', satirlar: undefined })))
      .rejects.toThrow(/en az bir teslim bilgisi/)
  })

  it('miktar revizyonu satırsız olamıyor', async () => {
    const { servis } = kur()
    await expect(servis.revizyonEkle(CTX, siparis(), rev({ satirlar: [] })))
      .rejects.toThrow(/satırsız olamaz/)
  })
})

describe('Fark kaydı', () => {
  const fark = (ek: Partial<YeniFark> = {}): YeniFark => ({
    siparisId: 'sp1', tur: 'Eksik', adim: 'Teslimde',
    aciklama: '2 koli eksik geldi', ...ek,
  })

  it('açıklama zorunlu', async () => {
    const { servis } = kur()
    await expect(servis.farkAc(CTX, fark({ aciklama: ' ' })))
      .rejects.toThrow(/açıklaması zorunlu/)
  })

  it('miktar verilirse sıfırdan büyük olmalı', async () => {
    const { servis } = kur()
    await expect(servis.farkAc(CTX, fark({ miktar: 0 })))
      .rejects.toThrow(/sıfırdan büyük/)
  })

  it('"Sorumlu Bulundu" kararı sorumlu kişi istiyor', async () => {
    const { servis } = kur()
    await expect(servis.farkiKararaBagla(CTX, 'f1', {
      karar: 'Sorumlu Bulundu', kararNotu: 'Yükleme sırasında',
    })).rejects.toThrow(/sorumlu kişi seçilmeli/)
  })

  it('karar notu zorunlu', async () => {
    const { servis } = kur()
    await expect(servis.farkiKararaBagla(CTX, 'f1', { karar: 'Tamamlanacak' }))
      .rejects.toThrow(/Karar notu zorunlu/)
  })
})

describe('Değişiklik geçmişi', () => {
  it('miktar değişimini buluyor', () => {
    const f = revizyonFarki([satir({ miktar: 200 })], [satir({ miktar: 150 })])
    expect(f).toHaveLength(1)
    expect(f[0].tur).toBe('değişti')
    expect(farkiYaz(f[0])).toBe('200 kg → 150 kg')
  })

  it('eklenen ve çıkarılan satırı buluyor', () => {
    const f = revizyonFarki(
      [satir({ kalemId: 'k1' })],
      [satir({ kalemId: 'k2', miktar: 50, birim: 'koli' })],
    )
    expect(f.map(x => x.tur).sort()).toEqual(['eklendi', 'çıkarıldı'])
    expect(farkiYaz(f.find(x => x.tur === 'eklendi')!)).toBe('+ 50 koli')
    expect(farkiYaz(f.find(x => x.tur === 'çıkarıldı')!)).toBe('− 200 kg')
  })

  it('değişmeyen satırı listelemiyor', () => {
    // Geçmiş panelinde değişmeyen satırı göstermek, farkı gürültüye boğmaktır.
    expect(revizyonFarki([satir()], [satir()])).toEqual([])
  })
})

describe('Süzme', () => {
  const liste = [
    siparis({ id: '1', siparisNo: 'SIP-1', musteriAdi: 'Migros', durum: 'Taslak' }),
    siparis({ id: '2', siparisNo: 'SIP-2', musteriAdi: 'Şok', durum: 'Sevk Edildi' }),
  ]

  it('duruma göre süzüyor', () => {
    expect(siparisleriSuz(liste, '', 'Sevk Edildi').map(s => s.id)).toEqual(['2'])
    expect(siparisleriSuz(liste, '', 'hepsi')).toHaveLength(2)
  })

  it('numara ve müşteri adına bakıyor', () => {
    expect(siparisleriSuz(liste, 'migros', 'hepsi').map(s => s.id)).toEqual(['1'])
    expect(siparisleriSuz(liste, 'SIP-2', 'hepsi').map(s => s.id)).toEqual(['2'])
  })
})

describe('Sipariş numarası', () => {
  it('boş listede birinciyi üretiyor', () => {
    expect(sonrakiSiparisNo([], 2026)).toBe('SIP-2026-0001')
  })

  it('en büyüğün bir fazlasını üretiyor · sıradaki değil', () => {
    // Araya boşluk girse bile (bir sipariş silinmedi ama numara atlandı)
    // en büyüğe bakmak doğru: sayma, çakışma üretir.
    expect(sonrakiSiparisNo(['SIP-2026-0001', 'SIP-2026-0007'], 2026)).toBe('SIP-2026-0008')
  })

  it('başka yılın ve başka belgenin numarasını saymıyor', () => {
    expect(sonrakiSiparisNo(['SIP-2025-0099', 'SVK-2026-0004'], 2026)).toBe('SIP-2026-0001')
  })

  it('çakışma hatasını tanıyor', () => {
    expect(siparisNoCakistiMi(new SiparisNoCakismasiError('SIP-2026-0001'))).toBe(true)
    expect(siparisNoCakistiMi(new Error('başka bir hata'))).toBe(false)
  })
})

// ── EN ÖNEMLİ TEST ────────────────────────────────────────────────────────
describe('Durum tablosu göçle AYNI', () => {
  it('ekranın tablosu 0050 tetiğiyle birebir eşleşiyor', () => {
    // Kural iki yerde: veritabanı tetiği kuralı UYGULUYOR, `IZINLI_GECISLER`
    // ekranın hangi düğmeyi göstereceğini söylüyor. Biri değişip diğeri
    // kalırsa ekran olmayan bir düğme gösterir ya da olan bir yolu saklar.
    const gocten = siparisGecisleriGocten()
    const kodda: Record<string, string[]> = IZINLI_GECISLER
    expect(Object.keys(gocten).sort()).toEqual(Object.keys(kodda).sort())
    for(const durum of Object.keys(gocten)){
      expect(gocten[durum].slice().sort(), `${durum} geçişleri ayrışmış`)
        .toEqual(kodda[durum].slice().sort())
    }
  })
})
