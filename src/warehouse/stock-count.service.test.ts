// Sayım servisi. Buradaki testlerin çoğu tek bir hatayı kolluyor:
// "SAYILMADI"yı SIFIR sanmak. O hata, sayılmayan her kalemi zayi yazar ve
// bunu kimse fark etmez — bir sayım yazılımının yapabileceği en pahalı şey.

import { describe, it, expect, beforeEach } from 'vitest'
import type { TenantCtx } from '../core/context'
import type { Movement } from '../core/stock/stock.repository'
import {
  type Sayim, type SayimDeposu, type SayimDurumu, type SayimSatiri,
  type YeniSayim, type YeniSayimSatiri,
} from './stock-count.repository'
import {
  GecersizSayimGecisiError, SayimDogrulamaError, SayimServisi,
  satirFarki, sayimOzeti, sonrakiSayimNo, supheliFark,
} from './stock-count.service'

const ctx: TenantCtx = { tenantId: 't1', branchId: 'b1', userId: 'u1' }

const satir = (yama: Partial<SayimSatiri> = {}): SayimSatiri => ({
  id: 's1', siraNo: 1, stokKalemiId: 'k1', stokKalemiAd: 'mercimek',
  beklenen: 100, birim: 'kg', ...yama,
})

const sayimYap = (yama: Partial<Sayim> = {}): Sayim => ({
  id: 'c1', sayimNo: 'SAY-2026-0001', durum: 'OPEN',
  olusturmaTarihi: '2026-09-12T08:00:00Z', satirlar: [satir()], ...yama,
})

/** Bellekte yaşayan sayım defteri. */
class BellekDepo implements SayimDeposu {
  kayitlar: Sayim[] = []
  baglanan: Array<{ satirId: string; hareketId: string }> = []
  async hepsi() { return this.kayitlar }
  async tekil(_c: TenantCtx, id: string) { return this.kayitlar.find(s => s.id === id)! }
  async acikOlanlar() { return this.kayitlar.filter(s => s.durum === 'OPEN') }
  async ekle(_c: TenantCtx, girdi: YeniSayim) {
    const yeni: Sayim = {
      id: `c${this.kayitlar.length + 1}`, sayimNo: girdi.sayimNo, durum: 'DRAFT',
      not: girdi.not, olusturmaTarihi: '2026-09-12T08:00:00Z',
      satirlar: girdi.satirlar.map((s, i) => ({
        id: `s${i + 1}`, siraNo: i + 1, stokKalemiId: s.stokKalemiId,
        lotId: s.lotId, beklenen: s.beklenen, birim: s.birim,
      })),
    }
    this.kayitlar.push(yeni); return yeni
  }
  async satirlariDegistir(_c: TenantCtx, id: string, satirlar: YeniSayimSatiri[]) {
    const s = this.kayitlar.find(x => x.id === id)!
    s.satirlar = satirlar.map((l, i) => ({
      id: `s${i + 1}`, siraNo: i + 1, stokKalemiId: l.stokKalemiId,
      lotId: l.lotId, beklenen: l.beklenen, birim: l.birim,
    }))
    return s
  }
  async sayilaniYaz(_c: TenantCtx, satirId: string, sayilan: number, not?: string) {
    for(const s of this.kayitlar){
      const l = s.satirlar.find(x => x.id === satirId)
      if(l){ l.sayilan = sayilan; l.not = not; return }
    }
  }
  async sayilaniSil(_c: TenantCtx, satirId: string) {
    for(const s of this.kayitlar){
      const l = s.satirlar.find(x => x.id === satirId)
      if(l){ l.sayilan = undefined; l.not = undefined; return }
    }
  }
  async beklenenleriYaz(_c: TenantCtx, degerler: ReadonlyArray<{ satirId: string; beklenen: number }>) {
    for(const d of degerler){
      for(const s of this.kayitlar){
        const l = s.satirlar.find(x => x.id === d.satirId)
        if(l) l.beklenen = d.beklenen
      }
    }
  }
  async satirEkle(_c: TenantCtx, id: string, satirlar: YeniSayimSatiri[]) {
    const s = this.kayitlar.find(x => x.id === id)!
    const enBuyuk = s.satirlar.reduce((acc, l) => Math.max(acc, l.siraNo), 0)
    s.satirlar.push(...satirlar.map((l, i) => ({
      id: `s${enBuyuk + i + 1}`, siraNo: enBuyuk + i + 1, stokKalemiId: l.stokKalemiId,
      lotId: l.lotId, beklenen: l.beklenen, birim: l.birim,
    })))
  }
  async satiraHareketBagla(_c: TenantCtx, satirId: string, hareketId: string) {
    this.baglanan.push({ satirId, hareketId })
  }
  async durumDegistir(_c: TenantCtx, id: string, durum: SayimDurumu) {
    const s = this.kayitlar.find(x => x.id === id)!
    s.durum = durum; return s
  }
}

/** Yalnızca `sayimFarki` çağrısını kaydeden sahte depo servisi. */
class SahteDepoServisi {
  cagrilar: Array<{ girdi: any; anahtar: string }> = []
  async sayimFarki(_c: TenantCtx, girdi: any, anahtar: string): Promise<Movement> {
    this.cagrilar.push({ girdi, anahtar })
    return { id: `h${this.cagrilar.length}` } as Movement
  }
}

/**
 * `baslat` için kaynak nesnesi. Lot listesi varsayılan olarak BOŞ: testlerin
 * çoğu lotsuz kalemle çalışıyor ve keşif adımının onlara dokunmaması gerek.
 */
const kaynak = (
  bakiye: (satir: SayimSatiri) => Promise<number>,
  lotlar: (kalemId: string) => Promise<Array<{ lotId: string; miktar: number }>> = async () => [],
) => ({ bakiye, lotlar })

const kur = () => {
  const depo = new BellekDepo()
  const depoServisi = new SahteDepoServisi()
  return { depo, depoServisi, servis: new SayimServisi(depo, depoServisi as any) }
}

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// Ondalık ayracı tuzağı
//
// Ekran Türkçe biçimle yazıyor: "93,237 kg". Kullanıcı bunu okuyup kutuya
// virgülsüz "93237" yazınca fark 93.137 kg çıkıyor — bin katı. Kutu artık
// virgül kabul ediyor, ama sıfır ekleyerek yapılan hata her zaman mümkün.
// Bu yüzden ayrıca İŞARETLİYORUZ. Engellemiyoruz: gerçek büyük farklar olur
// (kaybolan palet, yanlış kaleme yazılmış lot) ve sayımın işi gerçeği
// söylemektir.
describe('supheliFark · yazım hatası gibi duran farklar', () => {
  it('bin katı fark işaretleniyor (93,237 yerine 93237)', () => {
    expect(supheliFark(satir({ beklenen: 93.237, sayilan: 93237 }))).toBe(true)
  })

  it('makul bir sayım farkı işaretlenmiyor', () => {
    expect(supheliFark(satir({ beklenen: 170, sayilan: 167 }))).toBe(false)
    expect(supheliFark(satir({ beklenen: 170, sayilan: 11 }))).toBe(false)
    expect(supheliFark(satir({ beklenen: 48500, sayilan: 48501 }))).toBe(false)
  })

  it('on kat sınırında işaretleniyor', () => {
    expect(supheliFark(satir({ beklenen: 24, sayilan: 264 }))).toBe(true)
    expect(supheliFark(satir({ beklenen: 24, sayilan: 263 }))).toBe(false)
  })

  it('sayılmamış satır ve sıfır fark işaretlenmiyor', () => {
    expect(supheliFark(satir({ beklenen: 100, sayilan: undefined }))).toBe(false)
    expect(supheliFark(satir({ beklenen: 100, sayilan: 100 }))).toBe(false)
  })

  it('SIFIR sayılmak işaretlenmiyor — "hiç bulamadım" meşru bir sonuçtur', () => {
    // 100 → 0 farkı beklenenin tam 1 katı; eşik 10 kat olduğu için geçmez.
    // Geçseydi en sık kullanılan meşru giriş her seferinde uyarı verirdi.
    expect(supheliFark(satir({ beklenen: 100, sayilan: 0 }))).toBe(false)
  })

  it('defterde sıfır olan kalemde ölçüm yapılmıyor', () => {
    expect(supheliFark(satir({ beklenen: 0, sayilan: 500 }))).toBe(false)
  })

  it('özet şüpheli satırları sayıyor', () => {
    const s = sayimYap({ satirlar: [
      satir({ id: 's1', beklenen: 93.237, sayilan: 93237 }),
      satir({ id: 's2', beklenen: 170, sayilan: 167 }),
    ] })
    expect(sayimOzeti(s).supheli).toBe(1)
  })
})

describe('satirFarki · "sayılmadı" ile "sıfır fark" AYRI şeyler', () => {
  it('sayılmamış satır null döner — sıfır değil', () => {
    expect(satirFarki(satir({ sayilan: undefined }))).toBeNull()
  })

  it('sayılan beklenene eşitse fark 0 döner', () => {
    expect(satirFarki(satir({ beklenen: 100, sayilan: 100 }))).toBe(0)
  })

  it('fazla çıktıysa artı, eksik çıktıysa eksi', () => {
    expect(satirFarki(satir({ beklenen: 100, sayilan: 103 }))).toBe(3)
    expect(satirFarki(satir({ beklenen: 100, sayilan: 97 }))).toBe(-3)
  })

  it('sıfır sayılmış satır, sayılmamış satırla karışmıyor', () => {
    // Depoda 100 vardı, hiç bulunamadı: bu GERÇEK bir bulgu, -100 fark.
    expect(satirFarki(satir({ beklenen: 100, sayilan: 0 }))).toBe(-100)
  })

  it('ondalık farklar üç haneye yuvarlanıyor', () => {
    expect(satirFarki(satir({ beklenen: 0.1 + 0.2, sayilan: 0.3 }))).toBe(0)
  })
})

describe('sayimOzeti', () => {
  it('sayılan, sayılmayan ve farklı satırları ayırıyor', () => {
    const s = sayimOzeti(sayimYap({ satirlar: [
      satir({ id: 'a', beklenen: 100, sayilan: 100 }),   // sayıldı, fark yok
      satir({ id: 'b', beklenen: 50, sayilan: 55 }),     // fazla
      satir({ id: 'c', beklenen: 20, sayilan: 18 }),     // eksik
      satir({ id: 'd', beklenen: 10 }),                  // sayılmadı
    ] }))
    expect(s.toplam).toBe(4)
    expect(s.sayilan).toBe(3)
    expect(s.sayilmayan).toBe(1)
    expect(s.farkli).toBe(2)
    expect(s.fazla).toBe(1)
    expect(s.eksik).toBe(1)
    expect(s.tamam).toBe(false)
  })

  it('hepsi sayıldıysa tamam', () => {
    const s = sayimOzeti(sayimYap({ satirlar: [satir({ sayilan: 100 })] }))
    expect(s.tamam).toBe(true)
  })

  it('satırsız sayım TAMAM sayılmıyor', () => {
    expect(sayimOzeti(sayimYap({ satirlar: [] })).tamam).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SayimServisi · açılış', () => {
  it('satırsız sayım oluşturulamıyor', async () => {
    const { servis } = kur()
    await expect(servis.ekle(ctx, { sayimNo: 'SAY-1', satirlar: [] }))
      .rejects.toThrow(SayimDogrulamaError)
  })

  it('numarasız sayım oluşturulamıyor', async () => {
    const { servis } = kur()
    await expect(servis.ekle(ctx, {
      sayimNo: '   ',
      satirlar: [{ stokKalemiId: 'k1', beklenen: 10, birim: 'kg' }],
    })).rejects.toThrow(SayimDogrulamaError)
  })

  it('taslak sayım başlatılınca durum OPEN oluyor — kilit devreye girer', async () => {
    const { servis } = kur()
    const yeni = await servis.ekle(ctx, {
      sayimNo: 'SAY-1', satirlar: [{ stokKalemiId: 'k1', beklenen: 100, birim: 'kg' }],
    })
    const acik = await servis.baslat(ctx, yeni, kaynak(async l => l.beklenen))
    expect(acik.durum).toBe('OPEN')
  })

  it('başlatırken beklenen miktarlar DEFTERDEN TAZELENİYOR', async () => {
    const { servis, depo } = kur()
    const yeni = await servis.ekle(ctx, {
      // Taslakta 100 yazmıştı…
      sayimNo: 'SAY-1', satirlar: [{ stokKalemiId: 'k1', beklenen: 100, birim: 'kg' }],
    })
    // …ama başlatma anında defterde 88 var.
    const acik = await servis.baslat(ctx, yeni, kaynak(async () => 88))
    expect(acik.satirlar[0].beklenen).toBe(88)
  })

  it('fotoğraf KİLİTTEN SONRA çekiliyor', async () => {
    const { servis, depo } = kur()
    const yeni = await servis.ekle(ctx, {
      sayimNo: 'SAY-1', satirlar: [{ stokKalemiId: 'k1', beklenen: 100, birim: 'kg' }],
    })
    let okumaAnindakiDurum: string | undefined
    await servis.baslat(ctx, yeni, kaynak(async () => {
      // Bakiye okunurken sayım ZATEN açık olmalı; ters sırada okuma ile kilit
      // arasına bir hareket sızabilirdi.
      okumaAnindakiDurum = depo.kayitlar[0].durum
      return 88
    }))
    expect(okumaAnindakiDurum).toBe('OPEN')
  })

  // ── Taslak ile başlatma arasındaki pencere ──────────────────────────────
  // Belge hazırlanırken satırlar O ANKİ lotlara göre açılıyor. Belge taslak
  // beklerken depoya yeni bir parti girerse o lot listede olmaz — ve kilit
  // henüz kurulmadığı için giriş de engellenmez. Kilit kurulduktan sonra yeni
  // lot doğamaz; yani kapatılması gereken tek delik burası.

  it('taslak beklerken doğan LOT, başlatınca listeye ekleniyor', async () => {
    const { servis } = kur()
    const yeni = await servis.ekle(ctx, {
      sayimNo: 'SAY-1',
      satirlar: [{ stokKalemiId: 'k1', lotId: 'lot-eski', beklenen: 175, birim: 'adet' }],
    })

    const acik = await servis.baslat(ctx, yeni, kaynak(
      async l => l.beklenen,
      // Defterde artık İKİ lot var: biri belgede, biri sonradan girmiş.
      async () => [{ lotId: 'lot-eski', miktar: 175 }, { lotId: 'lot-yeni', miktar: 60 }],
    ))

    expect(acik.satirlar).toHaveLength(2)
    const eklenen = acik.satirlar.find(l => l.lotId === 'lot-yeni')
    expect(eklenen?.beklenen).toBe(60)
    expect(eklenen?.birim).toBe('adet')
    expect(eklenen?.sayilan).toBeUndefined()
  })

  it('eklenen satır var olan satırların SONUNA geliyor, sıraları bozulmuyor', async () => {
    const { servis } = kur()
    const yeni = await servis.ekle(ctx, {
      sayimNo: 'SAY-1',
      satirlar: [
        { stokKalemiId: 'k1', lotId: 'lot-a', beklenen: 10, birim: 'kg' },
        { stokKalemiId: 'k1', lotId: 'lot-b', beklenen: 20, birim: 'kg' },
      ],
    })
    const acik = await servis.baslat(ctx, yeni, kaynak(
      async l => l.beklenen,
      async () => [
        { lotId: 'lot-a', miktar: 10 }, { lotId: 'lot-b', miktar: 20 },
        { lotId: 'lot-c', miktar: 5 },
      ],
    ))
    expect(acik.satirlar.map(l => l.lotId)).toEqual(['lot-a', 'lot-b', 'lot-c'])
  })

  it('bakiyesi SIFIR olan yeni lot eklenmiyor — rafta olmayan şey sayılmaz', async () => {
    const { servis } = kur()
    const yeni = await servis.ekle(ctx, {
      sayimNo: 'SAY-1',
      satirlar: [{ stokKalemiId: 'k1', lotId: 'lot-eski', beklenen: 175, birim: 'adet' }],
    })
    const acik = await servis.baslat(ctx, yeni, kaynak(
      async l => l.beklenen,
      async () => [{ lotId: 'lot-eski', miktar: 175 }, { lotId: 'lot-bos', miktar: 0 }],
    ))
    expect(acik.satirlar).toHaveLength(1)
  })

  it('LOTSUZ kalemde lot keşfi HİÇ yapılmıyor', async () => {
    const { servis } = kur()
    const yeni = await servis.ekle(ctx, {
      sayimNo: 'SAY-1', satirlar: [{ stokKalemiId: 'k1', beklenen: 100, birim: 'kg' }],
    })
    let sorulduMu = false
    const acik = await servis.baslat(ctx, yeni, kaynak(
      async l => l.beklenen,
      async () => { sorulduMu = true; return [{ lotId: 'lot-x', miktar: 5 }] },
    ))
    // Lotsuz kalemin tek satırı var ve beklenen miktarı zaten tazelendi.
    expect(sorulduMu).toBe(false)
    expect(acik.satirlar).toHaveLength(1)
  })

  it('keşif KİLİTTEN SONRA yapılıyor', async () => {
    const { servis, depo } = kur()
    const yeni = await servis.ekle(ctx, {
      sayimNo: 'SAY-1',
      satirlar: [{ stokKalemiId: 'k1', lotId: 'lot-eski', beklenen: 175, birim: 'adet' }],
    })
    let kesifAnindakiDurum: string | undefined
    await servis.baslat(ctx, yeni, kaynak(
      async l => l.beklenen,
      async () => {
        kesifAnindakiDurum = depo.kayitlar[0].durum
        return [{ lotId: 'lot-eski', miktar: 175 }]
      },
    ))
    expect(kesifAnindakiDurum).toBe('OPEN')
  })

  it('uygulanmış sayım tekrar başlatılamıyor', async () => {
    const { servis } = kur()
    await expect(servis.baslat(ctx, sayimYap({ durum: 'APPLIED' }), kaynak(async l => l.beklenen)))
      .rejects.toThrow(GecersizSayimGecisiError)
  })
})

describe('SayimServisi · sonuç yazma', () => {
  it('yalnızca SÜREN sayıma sonuç yazılabiliyor', async () => {
    const { servis } = kur()
    await expect(servis.sayilaniYaz(ctx, sayimYap({ durum: 'DRAFT' }), 's1', 10))
      .rejects.toThrow(SayimDogrulamaError)
  })

  it('negatif sayım sonucu reddediliyor', async () => {
    const { servis } = kur()
    await expect(servis.sayilaniYaz(ctx, sayimYap(), 's1', -5))
      .rejects.toThrow(SayimDogrulamaError)
  })

  // ── Girilen sonucu GERİ ALMAK ───────────────────────────────────────────
  // Emrah'ın testinde çıktı: kutuya rakam yazıldı, sonra silindi. Ekran boş
  // göründü ama belgede rakam duruyordu ve "Uygula" o rakamı deftere yazdı.
  // Ekranın söylediği ile defterin yaptığı ayrışırsa sayım güvenilmez olur.

  it('girilen sonuç geri alınabiliyor — satır "sayılmadı"ya dönüyor', async () => {
    const { servis, depo } = kur()
    const yeni = await servis.ekle(ctx, {
      sayimNo: 'SAY-1', satirlar: [{ stokKalemiId: 'k1', beklenen: 100, birim: 'kg' }],
    })
    await servis.baslat(ctx, yeni, kaynak(async l => l.beklenen))
    await servis.sayilaniYaz(ctx, depo.kayitlar[0], 's1', 97)
    expect(depo.kayitlar[0].satirlar[0].sayilan).toBe(97)

    await servis.sayilaniSil(ctx, depo.kayitlar[0], 's1')
    expect(depo.kayitlar[0].satirlar[0].sayilan).toBeUndefined()
  })

  it('geri alınan satır UYGULAMAYI TEKRAR DURDURUYOR', async () => {
    const k = kur()
    const yeni = await k.servis.ekle(ctx, {
      sayimNo: 'SAY-1', satirlar: [{ stokKalemiId: 'k1', beklenen: 100, birim: 'kg' }],
    })
    await k.servis.baslat(ctx, yeni, kaynak(async l => l.beklenen))
    await k.servis.sayilaniYaz(ctx, k.depo.kayitlar[0], 's1', 97)
    await k.servis.sayilaniSil(ctx, k.depo.kayitlar[0], 's1')

    await expect(k.servis.uygula(ctx, k.depo.kayitlar[0]))
      .rejects.toThrow(SayimDogrulamaError)
    // Deftere hiçbir şey yazılmamalı.
    expect(k.depoServisi.cagrilar).toHaveLength(0)
  })

  it('geri alma yalnızca SÜREN sayımda yapılabiliyor', async () => {
    const { servis } = kur()
    await expect(servis.sayilaniSil(ctx, sayimYap({ durum: 'APPLIED' }), 's1'))
      .rejects.toThrow(SayimDogrulamaError)
  })

  it('sıfır KABUL EDİLİYOR — "hiç bulamadım" geçerli bir sonuçtur', async () => {
    const { servis, depo } = kur()
    const yeni = await servis.ekle(ctx, {
      sayimNo: 'SAY-1', satirlar: [{ stokKalemiId: 'k1', beklenen: 100, birim: 'kg' }],
    })
    await servis.baslat(ctx, yeni, kaynak(async l => l.beklenen))
    await servis.sayilaniYaz(ctx, depo.kayitlar[0], 's1', 0)
    expect(depo.kayitlar[0].satirlar[0].sayilan).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SayimServisi.uygula · en kritik davranış', () => {
  let k: ReturnType<typeof kur>
  beforeEach(() => { k = kur() })

  const acikSayim = async (satirlar: YeniSayimSatiri[]) => {
    const yeni = await k.servis.ekle(ctx, { sayimNo: 'SAY-1', satirlar })
    await k.servis.baslat(ctx, yeni, kaynak(async l => l.beklenen))
    return k.depo.kayitlar[0]
  }

  it('SAYILMAMIŞ SATIR VARSA UYGULANMIYOR', async () => {
    const s = await acikSayim([
      { stokKalemiId: 'k1', beklenen: 100, birim: 'kg' },
      { stokKalemiId: 'k2', beklenen: 50, birim: 'kg' },
    ])
    await k.servis.sayilaniYaz(ctx, s, 's1', 95)
    // s2 sayılmadı
    await expect(k.servis.uygula(ctx, k.depo.kayitlar[0]))
      .rejects.toThrow(/henüz sayılmadı/)
    // Ve deftere HİÇBİR ŞEY yazılmadı — yarım uygulama yok.
    expect(k.depoServisi.cagrilar).toHaveLength(0)
  })

  it('fark sıfır olan satır için hareket YAZILMIYOR', async () => {
    const s = await acikSayim([{ stokKalemiId: 'k1', beklenen: 100, birim: 'kg' }])
    await k.servis.sayilaniYaz(ctx, s, 's1', 100)
    const { hareketler } = await k.servis.uygula(ctx, k.depo.kayitlar[0])
    expect(hareketler).toHaveLength(0)
    expect(k.depoServisi.cagrilar).toHaveLength(0)
  })

  it('deftere SAYILAN değil FARK yazılıyor', async () => {
    const s = await acikSayim([{ stokKalemiId: 'k1', beklenen: 100, birim: 'kg' }])
    await k.servis.sayilaniYaz(ctx, s, 's1', 97)
    await k.servis.uygula(ctx, k.depo.kayitlar[0])

    expect(k.depoServisi.cagrilar).toHaveLength(1)
    // 97 değil, −3.
    expect(k.depoServisi.cagrilar[0].girdi.fark).toBe(-3)
    // Sayılan miktar nota geçiyor — denetimde kaybolmasın.
    expect(k.depoServisi.cagrilar[0].girdi.not).toContain('97')
    expect(k.depoServisi.cagrilar[0].girdi.not).toContain('100')
  })

  it('hareket SAYIM KİMLİĞİYLE yazılıyor — yoksa kendi kilidimize takılırız', async () => {
    const s = await acikSayim([{ stokKalemiId: 'k1', beklenen: 100, birim: 'kg' }])
    await k.servis.sayilaniYaz(ctx, s, 's1', 105)
    await k.servis.uygula(ctx, k.depo.kayitlar[0])
    expect(k.depoServisi.cagrilar[0].girdi.sayimId).toBe(k.depo.kayitlar[0].id)
  })

  it('idempotency anahtarı SATIRA sabitleniyor — iki kez uygulanırsa çiftlenmez', async () => {
    const s = await acikSayim([{ stokKalemiId: 'k1', beklenen: 100, birim: 'kg' }])
    await k.servis.sayilaniYaz(ctx, s, 's1', 105)
    await k.servis.uygula(ctx, k.depo.kayitlar[0])
    expect(k.depoServisi.cagrilar[0].anahtar).toBe('sayim:s1')
  })

  it('yazılan hareket satıra bağlanıyor — denetim izi', async () => {
    const s = await acikSayim([{ stokKalemiId: 'k1', beklenen: 100, birim: 'kg' }])
    await k.servis.sayilaniYaz(ctx, s, 's1', 105)
    await k.servis.uygula(ctx, k.depo.kayitlar[0])
    expect(k.depo.baglanan).toEqual([{ satirId: 's1', hareketId: 'h1' }])
  })

  it('çok satırlı sayımda yalnızca FARKLI olanlar deftere düşüyor', async () => {
    const s = await acikSayim([
      { stokKalemiId: 'k1', beklenen: 100, birim: 'kg' },
      { stokKalemiId: 'k2', beklenen: 50, birim: 'kg' },
      { stokKalemiId: 'k3', beklenen: 20, birim: 'kg' },
    ])
    await k.servis.sayilaniYaz(ctx, s, 's1', 100)  // fark yok
    await k.servis.sayilaniYaz(ctx, k.depo.kayitlar[0], 's2', 48)   // −2
    await k.servis.sayilaniYaz(ctx, k.depo.kayitlar[0], 's3', 23)   // +3
    const { hareketler } = await k.servis.uygula(ctx, k.depo.kayitlar[0])

    expect(hareketler).toHaveLength(2)
    expect(k.depoServisi.cagrilar.map(c => c.girdi.fark)).toEqual([-2, 3])
  })

  it('uygulanan sayım APPLIED oluyor ve tekrar uygulanamıyor', async () => {
    const s = await acikSayim([{ stokKalemiId: 'k1', beklenen: 100, birim: 'kg' }])
    await k.servis.sayilaniYaz(ctx, s, 's1', 99)
    const { sayim } = await k.servis.uygula(ctx, k.depo.kayitlar[0])
    expect(sayim.durum).toBe('APPLIED')
    await expect(k.servis.uygula(ctx, sayim)).rejects.toThrow(GecersizSayimGecisiError)
  })

  it('lot takipli satırda lot kimliği hareketle birlikte gidiyor', async () => {
    const s = await acikSayim([
      { stokKalemiId: 'k1', lotId: 'LOT-1', beklenen: 40, birim: 'kg' },
    ])
    await k.servis.sayilaniYaz(ctx, s, 's1', 38)
    await k.servis.uygula(ctx, k.depo.kayitlar[0])
    expect(k.depoServisi.cagrilar[0].girdi.lotId).toBe('LOT-1')
  })
})

describe('SayimServisi.iptalEt', () => {
  it('iptalde deftere hiçbir şey yazılmıyor', async () => {
    const k = kur()
    const yeni = await k.servis.ekle(ctx, {
      sayimNo: 'SAY-1', satirlar: [{ stokKalemiId: 'k1', beklenen: 100, birim: 'kg' }],
    })
    await k.servis.baslat(ctx, yeni, kaynak(async l => l.beklenen))
    const iptal = await k.servis.iptalEt(ctx, k.depo.kayitlar[0])
    expect(iptal.durum).toBe('CANCELLED')
    expect(k.depoServisi.cagrilar).toHaveLength(0)
  })

  it('uygulanmış sayım iptal edilemiyor', async () => {
    const k = kur()
    await expect(k.servis.iptalEt(ctx, sayimYap({ durum: 'APPLIED' })))
      .rejects.toThrow(GecersizSayimGecisiError)
  })
})

describe('sonrakiSayimNo', () => {
  it('boş listede ilk numara', () => {
    expect(sonrakiSayimNo([], 2026)).toBe('SAY-2026-0001')
  })
  it('en büyüğün bir fazlası', () => {
    expect(sonrakiSayimNo(['SAY-2026-0001', 'SAY-2026-0007'], 2026)).toBe('SAY-2026-0008')
  })
  it('başka yılın numarası karışmıyor', () => {
    expect(sonrakiSayimNo(['SAY-2025-0099'], 2026)).toBe('SAY-2026-0001')
  })
})
