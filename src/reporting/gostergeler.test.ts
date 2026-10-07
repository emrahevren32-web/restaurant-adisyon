// Göstergelerin saf mantığı. Burada sınanan şey ARİTMETİK DEĞİL, KARAR:
// hangi sayı hangi cümleyi kurdurur, ve hangi durumda SUSMAYI seçer.

import { describe, it, expect } from 'vitest'
import {
  bulgular, fireNedeniYaz, fireOrani, fireninYogunlastigi, nedeneGoreFire,
  ozetiOku, paraYaz, yuzdeYaz,
  type FireSatiri, type GostergeSatiri, type Ozet,
} from './gostergeler'

const ozet = (yama: Partial<Ozet> = {}): Ozet => ({
  fireTutari: 0, fireFiyatsizHareket: 0, fireKalemSayisi: 0, alimTutari: 0,
  sktGecmisDeger: 0, sktGecmisParti: 0, sktYaklasanDeger: 0, sktYaklasanParti: 0,
  negatifBakiyeliKalem: 0, kritikKalem: 0,
  siparisSayisi: 0, iptalSiparis: 0, gecikenSiparis: 0,
  onayBekleyenSiparis: 0, farkliTeslimSiparis: 0,
  ...yama,
})

const fire = (yama: Partial<FireSatiri> = {}): FireSatiri => ({
  neden: 'WASTE', kalemId: 'k1', kalemAdi: 'Un', miktar: 5, birim: 'kg',
  tutar: 50, fiyatsiz: false, ...yama,
})

describe('ozetiOku', () => {
  it('ham satırları isimli özete çevirir', () => {
    const satirlar: GostergeSatiri[] = [
      { anahtar: 'fire_tutari', deger: 1250.5 },
      { anahtar: 'skt_gecmis_deger', deger: 800, ek: 2 },
    ]
    const o = ozetiOku(satirlar)

    expect(o.fireTutari).toBe(1250.5)
    expect(o.sktGecmisDeger).toBe(800)
    expect(o.sktGecmisParti).toBe(2)
  })

  // ⚠️ Veritabanına yeni bir gösterge eklendiğinde ESKİ EKRAN ÇALIŞMAYA
  // DEVAM ETMELİ. Yeni sayıyı göstermez, ama var olanları göstermeyi
  // bırakmaz.
  it('tanımadığı anahtarı sessizce atar, patlamaz', () => {
    const o = ozetiOku([
      { anahtar: 'fire_tutari', deger: 100 },
      { anahtar: 'bu_gosterge_yarin_eklendi', deger: 42 },
    ])
    expect(o.fireTutari).toBe(100)
  })

  it('eksik ya da bozuk sayıyı 0 sayar', () => {
    const o = ozetiOku([
      { anahtar: 'fire_tutari', deger: NaN },
      { anahtar: 'kritik_kalem', deger: Infinity },
    ])
    expect(o.fireTutari).toBe(0)
    expect(o.kritikKalem).toBe(0)
  })

  it('hiç satır gelmezse her şey sıfırdır', () => {
    expect(ozetiOku([]).fireTutari).toBe(0)
  })
})

describe('fireOrani', () => {
  it('fireyi alıma böler', () => {
    expect(fireOrani(50, 1000)).toBe(0.05)
  })

  // ⚠️ ALIM SIFIRSA ORAN YOKTUR — 0 değil, undefined. Sıfır yazmak "hiç fire
  // yok" demekti ve bu yanlış bir cümle olurdu.
  it('alım sıfırsa oran YOKTUR, sıfır değil', () => {
    expect(fireOrani(50, 0)).toBeUndefined()
  })
})

describe('bulgular', () => {
  // ── EN KRİTİK BULGU: satılamaz mal satılabilir gibi duruyor ────────────
  it('SKT’si geçmiş mal kritik bulgudur ve en üste çıkar', () => {
    const b = bulgular(ozet({
      sktGecmisParti: 2, sktGecmisDeger: 800,
      kritikKalem: 5,
    }))
    expect(b[0].anahtar).toBe('skt_gecmis')
    expect(b[0].onem).toBe('kritik')
  })

  // ⚠️ YAPILACAK ALANI BOŞ OLAMAZ. Ne yapılacağını söylemeyen bulgu
  // ekranı doldurur ve kimseyi harekete geçirmez.
  it('HER bulgunun bir “yapılacak”ı vardır', () => {
    const b = bulgular(ozet({
      sktGecmisParti: 1, sktYaklasanParti: 1, fireTutari: 100, alimTutari: 1000,
      fireFiyatsizHareket: 1, negatifBakiyeliKalem: 1, gecikenSiparis: 1,
      onayBekleyenSiparis: 1, farkliTeslimSiparis: 1, siparisSayisi: 10,
      kritikKalem: 1,
    }))
    expect(b.length).toBeGreaterThan(5)
    b.forEach(x => expect(x.yapilacak.length).toBeGreaterThan(10))
  })

  // ⚠️ "Sektör ortalaması" diye bir şey YOK. Karşılaştırma ancak geçmiş
  // dönem verilirse kurulur.
  it('önceki dönem YOKSA karşılaştırma cümlesi KURULMAZ', () => {
    const b = bulgular(ozet({ fireTutari: 100, alimTutari: 1000 }))
    const f = b.find(x => x.anahtar === 'fire')!
    expect(f.cumle).not.toContain('Önceki döneme göre')
  })

  it('önceki dönem verilince artışı söyler', () => {
    const b = bulgular(
      ozet({ fireTutari: 100, alimTutari: 1000 }),   // %10
      ozet({ fireTutari: 20,  alimTutari: 1000 }),   // %2
    )
    const f = b.find(x => x.anahtar === 'fire')!
    expect(f.cumle).toContain('arttı')
    expect(f.onem).toBe('uyari')
  })

  it('azalışı da söyler ve uyarıya çevirmez', () => {
    const b = bulgular(
      ozet({ fireTutari: 20,  alimTutari: 1000 }),
      ozet({ fireTutari: 100, alimTutari: 1000 }),
    )
    const f = b.find(x => x.anahtar === 'fire')!
    expect(f.cumle).toContain('azaldı')
    expect(f.onem).toBe('bilgi')
  })

  // Yarım puanlık oynama "arttı" diye bildirilmez; her dalgalanmayı
  // haber yapan ekran okunmaz hâle gelir.
  it('önemsiz oynamayı haber yapmaz', () => {
    const b = bulgular(
      ozet({ fireTutari: 101, alimTutari: 1000 }),
      ozet({ fireTutari: 100, alimTutari: 1000 }),
    )
    const f = b.find(x => x.anahtar === 'fire')!
    expect(f.cumle).not.toContain('Önceki döneme göre')
  })

  // ⚠️ RAKAMIN KENDİSİNE GÜVENİLMEMESİNİ SÖYLEYEN BULGU. Bu ekranı zayıf
  // göstermez; güvenilir yapar.
  it('fiyatı bulunamayan fire varsa tutarın EKSİK olduğunu söyler', () => {
    const b = bulgular(ozet({ fireTutari: 100, alimTutari: 1000, fireFiyatsizHareket: 3 }))
    const d = b.find(x => x.anahtar === 'fire_fiyatsiz')!
    expect(d.cumle).toContain('İÇERMİYOR')
    expect(d.onem).toBe('uyari')
  })

  it('eksi bakiye kritiktir — defterde tutarsızlık var demektir', () => {
    const b = bulgular(ozet({ negatifBakiyeliKalem: 2 }))
    const n = b.find(x => x.anahtar === 'negatif_bakiye')!
    expect(n.onem).toBe('kritik')
    expect(n.yapilacak).toContain('Sayım')
  })

  it('geciken siparişte müşteriyi ARAMAYI söyler', () => {
    const b = bulgular(ozet({ gecikenSiparis: 3 }))
    const g = b.find(x => x.anahtar === 'geciken_siparis')!
    expect(g.onem).toBe('kritik')
    expect(g.yapilacak).toContain('ara')
  })

  it('teslim farkı oranı yükselince uyarıya döner', () => {
    const az  = bulgular(ozet({ farkliTeslimSiparis: 1,  siparisSayisi: 100 }))
    const cok = bulgular(ozet({ farkliTeslimSiparis: 20, siparisSayisi: 100 }))
    expect(az.find(x => x.anahtar === 'farkli_teslim')!.onem).toBe('bilgi')
    expect(cok.find(x => x.anahtar === 'farkli_teslim')!.onem).toBe('uyari')
  })

  // ⚠️ Boş ekran "veri gelmedi mi, sorun mu yok" sorusunu bıraktırır.
  it('hiçbir sorun yoksa SUSMAZ, bunu söyler', () => {
    const b = bulgular(ozet())
    expect(b).toHaveLength(1)
    expect(b[0].anahtar).toBe('temiz')
    expect(b[0].onem).toBe('iyi')
  })

  it('bulgular önem sırasına dizilir', () => {
    const b = bulgular(ozet({ kritikKalem: 1, negatifBakiyeliKalem: 1 }))
    expect(b[0].onem).toBe('kritik')
  })

  it('sipariş yoksa teslim farkı bulgusu üretilmez (sıfıra bölme yok)', () => {
    const b = bulgular(ozet({ farkliTeslimSiparis: 0, siparisSayisi: 0 }))
    expect(b.find(x => x.anahtar === 'farkli_teslim')).toBeUndefined()
  })
})

describe('fire dökümü', () => {
  it('nedene göre toplar ve büyükten küçüğe dizer', () => {
    const g = nedeneGoreFire([
      fire({ neden: 'WASTE', tutar: 50 }),
      fire({ neden: 'EXPIRY_WRITE_OFF', tutar: 300 }),
      fire({ neden: 'WASTE', tutar: 20 }),
    ])
    expect(g[0].neden).toBe('EXPIRY_WRITE_OFF')
    expect(g[0].tutar).toBe(300)
    expect(g[1].tutar).toBe(70)
  })

  // ⚠️ Eksik bir tutarı tam gibi göstermek raporun tamamına olan güveni
  // bitirir; bayrak grubun üstünde taşınıyor.
  it('fiyatsız satır grubun tutarını EKSİK işaretler', () => {
    const g = nedeneGoreFire([
      fire({ neden: 'WASTE', tutar: 50 }),
      fire({ neden: 'WASTE', tutar: undefined, fiyatsiz: true }),
    ])
    expect(g[0].eksik).toBe(true)
  })

  it('nedenin okunur karşılığını verir, bilmediğini olduğu gibi bırakır', () => {
    expect(fireNedeniYaz('COUNT_SHORTAGE')).toBe('Sayımda eksik çıktı')
    expect(fireNedeniYaz('YENI_NEDEN')).toBe('YENI_NEDEN')
  })
})

describe('fireninYogunlastigi', () => {
  // Bir mutfakta fire birkaç üründe toplanır. Bu sayı listenin neresine
  // bakılacağını söyler.
  it('firenin %80’inin kaç kalemden geldiğini söyler', () => {
    const s = fireninYogunlastigi([
      fire({ kalemId: 'a', tutar: 800 }),
      fire({ kalemId: 'b', tutar: 120 }),
      fire({ kalemId: 'c', tutar: 50 }),
      fire({ kalemId: 'd', tutar: 30 }),
    ])!
    expect(s.kalemSayisi).toBe(1)
    expect(s.toplam).toBe(1000)
  })

  it('fire dağınıksa daha çok kalem gösterir', () => {
    const s = fireninYogunlastigi([
      fire({ kalemId: 'a', tutar: 100 }),
      fire({ kalemId: 'b', tutar: 100 }),
      fire({ kalemId: 'c', tutar: 100 }),
      fire({ kalemId: 'd', tutar: 100 }),
    ])!
    expect(s.kalemSayisi).toBe(4)
  })

  // ⚠️ Tutarı olmayan satırdan yüzde çıkarılmaz: "firenin %80'i" demek
  // için firenin ne olduğunu bilmek gerekir.
  it('hiç tutarlı satır yoksa hesap YAPMAZ', () => {
    expect(fireninYogunlastigi([fire({ tutar: undefined, fiyatsiz: true })])).toBeUndefined()
  })
})

describe('biçimleme', () => {
  it('parayı iki haneyle ve ₺ ile yazar', () => {
    expect(paraYaz(1234.5)).toContain('₺')
    expect(paraYaz(1234.5)).toContain('1.234,50')
  })

  it('yüzdeyi tek haneyle yazar', () => {
    expect(yuzdeYaz(0.0523)).toBe('%5,2')
  })
})
