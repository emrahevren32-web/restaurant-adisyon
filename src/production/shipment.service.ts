// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 / İzlenebilirlik — Sevkiyat servisi
//
// Yol haritası maddesi: "Sevkiyat → stok çıkışı"
//         Bitti sayılır ki: "Sevk edilen lot kaydediliyor"
//
// ── LOT NEREDE KAYDEDİLİYOR ──────────────────────────────────────────────
// Bu servis lot SEÇMEZ. `DepoServisi.cikis()` çağırır, o da FEFO uygular ve
// hangi partiden ne kadar gittiğini deftere yazar (`lot_id`). Kriterin cümlesi
// böyle karşılanıyor: sevk edilen lot BELGEDE değil DEFTERDE kayıtlı.
//
// Bunun bedeli tek bir cümle: "sevkiyat belgesinde lot yazmıyor". Karşılığı
// şu: FEFO bir çıkışı iki partiye böldüğünde ikisi de görünüyor, ve geri
// çağırma listesi eksik çıkmıyor.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../core/context'
import type { Movement } from '../core/stock/stock.repository'
import type { DepoServisi } from '../warehouse/warehouse.service'
import type { KatalogKalemi } from '../warehouse/warehouse.catalog'
import { hepsiYeterli, yeterliligiHesapla, type YeterlilikSatiri } from './recipe.service'
import {
  SEVKIYAT_GECISLERI,
  type Sevkiyat,
  type SevkiyatDeposu,
  type SevkiyatDurumu,
  type SevkiyatSatiri,
  type YeniSevkiyat,
} from './shipment.repository'

export class SevkiyatDogrulamaError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'SevkiyatDogrulamaError'
  }
}

export class GecersizSevkiyatGecisiError extends Error {
  constructor(mevcut: SevkiyatDurumu, istenen: SevkiyatDurumu) {
    super(`Sevkiyat "${mevcut}" durumundan "${istenen}" durumuna geçemez.`)
    this.name = 'GecersizSevkiyatGecisiError'
  }
}

export class YetersizStokIleSevkEdilemezError extends Error {
  constructor(public readonly eksikler: readonly YeterlilikSatiri[]) {
    const liste = eksikler
      .map(e => `${e.satir.stokKalemiAd ?? e.satir.stokKalemiId}: ${e.eksik} ${e.birim} eksik`)
      .join(', ')
    super(`Depoda yeterli mal yok. ${liste}`)
    this.name = 'YetersizStokIleSevkEdilemezError'
  }
}

/** Sevkiyat satırlarını yeterlilik hesabının anladığı biçime çevirir. */
const yeterlilikGirdisi = (satirlar: readonly SevkiyatSatiri[]) =>
  satirlar.map(satir => ({
    satir: {
      id: satir.id,
      stokKalemiId: satir.stokKalemiId,
      stokKalemiAd: satir.stokKalemiAd,
      miktar: satir.miktar,
      birim: satir.birim,
      firePayi: 0,
      siraNo: satir.siraNo,
    },
    netMiktar: satir.miktar,
    brutMiktar: satir.miktar,
    birim: satir.birim,
  }))

export class SevkiyatServisi {
  constructor(
    private readonly depo: SevkiyatDeposu,
    private readonly depoServisi: DepoServisi,
  ) {}

  hepsi(ctx: TenantCtx): Promise<Sevkiyat[]> { return this.depo.hepsi(ctx) }
  tekil(ctx: TenantCtx, id: string): Promise<Sevkiyat> { return this.depo.tekil(ctx, id) }
  kimliklerden(ctx: TenantCtx, idler: readonly string[]): Promise<Sevkiyat[]> {
    return this.depo.kimliklerden(ctx, idler)
  }

  async ekle(ctx: TenantCtx, girdi: YeniSevkiyat): Promise<Sevkiyat> {
    return this.depo.ekle(ctx, this.dogrula(girdi))
  }

  async guncelle(ctx: TenantCtx, sevkiyat: Sevkiyat, girdi: YeniSevkiyat): Promise<Sevkiyat> {
    if(sevkiyat.durum !== 'DRAFT'){
      // Sevk edilmiş bir belgeyi değiştirmek, defterde yazılı olanla kâğıtta
      // yazılanı ayırırdı — ve müşteriye giden mal değişmez.
      throw new SevkiyatDogrulamaError(
        'Yalnızca hazırlanmakta olan sevkiyat düzenlenebilir.',
      )
    }
    return this.depo.guncelle(ctx, sevkiyat.id, this.dogrula(girdi))
  }

  /** Ekran "Sevk Et" düğmesini buna bakarak açar. */
  yeterlilik(
    sevkiyat: Sevkiyat,
    bakiyeler: ReadonlyMap<string, number>,
    kalemler: readonly KatalogKalemi[],
  ): YeterlilikSatiri[] {
    return yeterliligiHesapla(yeterlilikGirdisi(sevkiyat.satirlar), bakiyeler, kalemler)
  }

  /**
   * Malı deftere ÇIKIŞ olarak yazar ve belgeyi kapatır.
   *
   * Lot seçimi burada YAPILMAZ: `cikis()` FEFO uygular, en yakın son kullanma
   * tarihli partiden başlar ve gerekirse birden çok partiye böler. Hangi
   * partinin gittiği o hareketlerde yazılı kalır — geri çağırmanın dayandığı
   * bağ budur.
   */
  async sevkEt(
    ctx: TenantCtx,
    sevkiyat: Sevkiyat,
    bakiyeler: ReadonlyMap<string, number>,
    kalemler: readonly KatalogKalemi[],
  ): Promise<Sevkiyat> {
    this.gecisiDogrula(sevkiyat, 'SHIPPED')

    if(sevkiyat.satirlar.length === 0){
      throw new SevkiyatDogrulamaError('Boş sevkiyat gönderilemez.')
    }

    const durumlar = this.yeterlilik(sevkiyat, bakiyeler, kalemler)
    if(!hepsiYeterli(durumlar)){
      throw new YetersizStokIleSevkEdilemezError(durumlar.filter(d => !d.yeterli))
    }

    for(const satir of sevkiyat.satirlar){
      await this.depoServisi.cikis(ctx, {
        stokKalemiId: satir.stokKalemiId,
        miktar: satir.miktar,
        birim: satir.birim,
        neden: 'SHIPMENT_OUT',
        kaynakId: sevkiyat.id,
        not: `${sevkiyat.sevkiyatNo} · ${sevkiyat.musteriAd}`,
      }, `sevk:${satir.id}`)
    }

    return this.depo.durumDegistir(ctx, sevkiyat.id, 'SHIPPED', new Date().toISOString())
  }

  /**
   * İptal: yazılmış her hareketin TERSİ yazılır.
   *
   * Mal geri döndüyse bu doğrudur. Dönmediyse iptal edilmemeli — çünkü ters
   * kayıt "bu mal hiç çıkmadı" demektir ve geri çağırma listesinden düşer.
   * Ekran bunu kullanıcıya söylüyor.
   */
  async iptalEt(ctx: TenantCtx, sevkiyat: Sevkiyat): Promise<Sevkiyat> {
    this.gecisiDogrula(sevkiyat, 'CANCELLED')

    for(const hareket of await this.hareketleri(ctx, sevkiyat)){
      if(hareket.reason === 'REVERSAL') continue
      await this.depoServisi.tersKayit(ctx, hareket.id, `sevk-iptal:${hareket.id}`)
    }

    return this.depo.durumDegistir(ctx, sevkiyat.id, 'CANCELLED')
  }

  /** Bu sevkiyatın deftere yazdığı hareketler — hangi partilerin gittiği dahil. */
  async hareketleri(ctx: TenantCtx, sevkiyat: Sevkiyat): Promise<Movement[]> {
    const kalemIdleri = [...new Set(sevkiyat.satirlar.map(s => s.stokKalemiId))]
    const hepsi: Movement[] = []
    for(const kalemId of kalemIdleri){
      const defter = await this.depoServisi.hareketler(ctx, kalemId)
      hepsi.push(...defter.filter(h => h.sourceId === sevkiyat.id))
    }
    return hepsi
  }

  private gecisiDogrula(sevkiyat: Sevkiyat, istenen: SevkiyatDurumu): void {
    if(!SEVKIYAT_GECISLERI[sevkiyat.durum].includes(istenen)){
      throw new GecersizSevkiyatGecisiError(sevkiyat.durum, istenen)
    }
  }

  private dogrula(girdi: YeniSevkiyat): YeniSevkiyat {
    const no = girdi.sevkiyatNo.trim()
    const musteri = girdi.musteriAd.trim()

    if(!no) throw new SevkiyatDogrulamaError('Sevkiyat numarası zorunludur.')
    if(!musteri){
      // Müşterisiz sevkiyat, geri çağırmada "kimi arayacağız" sorusunu
      // cevapsız bırakır. Belgenin var olma sebebi budur.
      throw new SevkiyatDogrulamaError('Müşteri adı zorunludur.')
    }
    if(girdi.satirlar.length === 0){
      throw new SevkiyatDogrulamaError('Sevkiyat en az bir kalem içermelidir.')
    }

    const gorulen = new Set<string>()
    girdi.satirlar.forEach((satir, i) => {
      const sira = i + 1
      if(!satir.stokKalemiId){
        throw new SevkiyatDogrulamaError(`${sira}. satırda kalem seçilmemiş.`)
      }
      if(!(satir.miktar > 0)){
        throw new SevkiyatDogrulamaError(`${sira}. satırın miktarı 0’dan büyük olmalıdır.`)
      }
      if(gorulen.has(satir.stokKalemiId)){
        throw new SevkiyatDogrulamaError(`${sira}. satırdaki kalem sevkiyatta zaten var.`)
      }
      gorulen.add(satir.stokKalemiId)
    })

    return {
      ...girdi,
      sevkiyatNo: no,
      musteriAd: musteri,
      musteriTelefon: girdi.musteriTelefon?.trim() || undefined,
      adres: girdi.adres?.trim() || undefined,
      not: girdi.not?.trim() || undefined,
    }
  }
}

/** Belge numarası üreticisi — satın alma ve iş emriyle aynı kural. */
export const sonrakiSevkiyatNo = (
  mevcutlar: readonly string[], yil = new Date().getFullYear(),
): string => {
  const onek = `SVK-${yil}-`
  const enBuyuk = mevcutlar
    .filter(no => no.startsWith(onek))
    .map(no => Number(no.slice(onek.length)))
    .filter(n => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0)
  return `${onek}${String(enBuyuk + 1).padStart(4, '0')}`
}
