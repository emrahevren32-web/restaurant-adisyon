// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Satın alma servisi
//
// Yol haritası maddesi: "Satın alma talebi ve siparişi"
//                       Bitti sayılır ki: "Talep → sipariş akışı uçtan uca"
//
// Kurallar burada, formda değil: aynı akış Excel içe aktarma ve mal kabul
// ekranından da geçecek. Kuralı forma koymak, üçüncü giriş yolunda sessizce
// kaybolması demektir.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../core/context'
import type {
  SatinAlmaDeposu,
  YeniSiparis,
  YeniTalep,
} from './purchase.repository'
import {
  GecersizDurumGecisiError,
  SatinAlmaDogrulamaError,
  SIPARIS_GECISLERI,
  TALEP_GECISLERI,
  type Siparis,
  type SiparisDurumu,
  type Talep,
  type TalepDurumu,
} from './purchase.types'

export class SatinAlmaServisi {
  constructor(private readonly depo: SatinAlmaDeposu) {}

  talepler(ctx: TenantCtx): Promise<Talep[]> {
    return this.depo.talepler(ctx)
  }

  siparisler(ctx: TenantCtx): Promise<Siparis[]> {
    return this.depo.siparisler(ctx)
  }

  async talepAc(ctx: TenantCtx, girdi: YeniTalep): Promise<Talep> {
    if(!girdi.talepNo.trim()) throw new SatinAlmaDogrulamaError('Talep numarası zorunludur.')
    if(girdi.satirlar.length === 0){
      // Kalemsiz talep hiçbir soruyu cevaplamaz ve onaya gidince onaylayan
      // kişinin neyi onayladığı belirsiz olur.
      throw new SatinAlmaDogrulamaError('Talep en az bir kalem içermelidir.')
    }
    girdi.satirlar.forEach((satir, i) => {
      if(!(satir.miktar > 0)){
        throw new SatinAlmaDogrulamaError(`${i + 1}. kalemin miktarı 0’dan büyük olmalıdır.`)
      }
      if(!satir.stokKalemiId) throw new SatinAlmaDogrulamaError(`${i + 1}. kalemde stok kalemi seçilmedi.`)
      if(!satir.birim) throw new SatinAlmaDogrulamaError(`${i + 1}. kalemde birim seçilmedi.`)
    })

    return this.depo.talepEkle(ctx, girdi)
  }

  /**
   * Durum geçişi — tek kapı.
   *
   * Geçişin geçerliliği `TALEP_GECISLERI` tablosundan okunuyor. Ekran da aynı
   * tabloyu okuyup düğmeleri gizliyor; ama kural burada uygulanıyor. Ekran
   * kuralın TEK uygulayıcısı olsaydı, ikinci bir giriş yolu onu hiç görmezdi.
   */
  async talepDurumDegistir(
    ctx: TenantCtx, talep: Talep, yeniDurum: TalepDurumu, kararNotu?: string,
  ): Promise<Talep> {
    if(!TALEP_GECISLERI[talep.durum].includes(yeniDurum)){
      throw new GecersizDurumGecisiError('Talep', talep.durum, yeniDurum)
    }
    if(yeniDurum === 'REJECTED' && !kararNotu?.trim()){
      // Ret bir gerekçe gerektirir: gerekçesiz ret, talebi açan kişinin aynı
      // talebi bir hafta sonra aynı şekilde tekrar açması demektir.
      throw new SatinAlmaDogrulamaError('Reddetme gerekçesi zorunludur.')
    }
    return this.depo.talepDurumDegistir(ctx, talep.id, yeniDurum, kararNotu)
  }

  /**
   * Onaylı bir talebi siparişe dönüştürür.
   *
   * ── NEDEN YALNIZCA ONAYLI TALEP ──────────────────────────────────────
   * Sipariş bir TAAHHÜTTÜR: firma parayı harcamayı kabul etmiştir. Onaysız
   * talepten sipariş üretmek, onay adımını süs hâline getirirdi.
   *
   * Kalemler ve miktarlar taleple aynı gelir; fiyat ve tedarikçi burada
   * eklenir — talebi açan mutfak bunları bilmez, satın alma bilir.
   */
  async talepteSiparisOlustur(
    ctx: TenantCtx,
    talep: Talep,
    girdi: Omit<YeniSiparis, 'satirlar' | 'talepId'> & {
      /** Kalem başına birim fiyat. Girilmeyen kalem 0 fiyatla gider. */
      fiyatlar?: Record<string, number>
    },
  ): Promise<Siparis> {
    if(talep.durum !== 'APPROVED'){
      throw new SatinAlmaDogrulamaError(
        `Yalnızca onaylanmış talepten sipariş oluşturulabilir. Bu talep: ${talep.durum}.`,
      )
    }

    return this.siparisAc(ctx, {
      ...girdi,
      talepId: talep.id,
      satirlar: talep.satirlar.map(satir => ({
        stokKalemiId: satir.stokKalemiId,
        miktar: satir.miktar,
        birim: satir.birim,
        birimFiyat: girdi.fiyatlar?.[satir.stokKalemiId] ?? 0,
        not: satir.not,
      })),
    })
  }

  async siparisAc(ctx: TenantCtx, girdi: YeniSiparis): Promise<Siparis> {
    if(!girdi.siparisNo.trim()) throw new SatinAlmaDogrulamaError('Sipariş numarası zorunludur.')
    if(!girdi.tedarikciId) throw new SatinAlmaDogrulamaError('Tedarikçi seçilmelidir.')
    if(girdi.satirlar.length === 0){
      throw new SatinAlmaDogrulamaError('Sipariş en az bir kalem içermelidir.')
    }
    girdi.satirlar.forEach((satir, i) => {
      if(!(satir.miktar > 0)){
        throw new SatinAlmaDogrulamaError(`${i + 1}. kalemin miktarı 0’dan büyük olmalıdır.`)
      }
      if(satir.birimFiyat < 0){
        throw new SatinAlmaDogrulamaError(`${i + 1}. kalemin birim fiyatı eksi olamaz.`)
      }
    })

    return this.depo.siparisEkle(ctx, girdi)
  }

  /**
   * Teslim durumunu MAL KABULÜN SONUCU olarak günceller.
   *
   * ── NEDEN AYRI BİR KAPI ──────────────────────────────────────────────
   * `SIPARIS_GECISLERI` tablosu `SENT → PARTIAL` ve `SENT → RECEIVED`
   * geçişlerine izin VERMEZ; bu bilinçliydi. Sebebi: bu iki durum bir
   * kullanıcı kararı değil, bir HESABIN sonucudur — teslim alınan miktar
   * sipariş miktarına eşitse RECEIVED, azsa PARTIAL. Elle seçilebilir
   * olsaydı "sistemde teslim alınmış ama depoda olmayan mal" üretilebilirdi.
   *
   * Bu metot o hesabı yapan tarafın (mal kabul) kullanacağı kapıdır. Ekrandan
   * çağrılmaz; `MalKabulServisi` deftere yazdıktan SONRA çağırır. Yani durum
   * her zaman gerçekleşmiş bir stok hareketinin ardından değişir.
   */
  async teslimDurumunuGuncelle(
    ctx: TenantCtx, siparis: Siparis, yeniDurum: 'PARTIAL' | 'RECEIVED',
  ): Promise<Siparis> {
    if(siparis.durum !== 'SENT' && siparis.durum !== 'PARTIAL'){
      throw new SatinAlmaDogrulamaError(
        `Teslim yalnızca gönderilmiş siparişe işlenebilir. Bu sipariş: ${siparis.durum}.`,
      )
    }
    return this.depo.siparisDurumDegistir(ctx, siparis.id, yeniDurum)
  }

  async siparisDurumDegistir(
    ctx: TenantCtx, siparis: Siparis, yeniDurum: SiparisDurumu,
  ): Promise<Siparis> {
    if(!SIPARIS_GECISLERI[siparis.durum].includes(yeniDurum)){
      throw new GecersizDurumGecisiError('Sipariş', siparis.durum, yeniDurum)
    }
    if(yeniDurum === 'SENT' && siparis.satirlar.some(s => s.birimFiyat <= 0)){
      // Fiyatsız gönderilen sipariş, ortalama maliyeti sıfırla besler ve
      // "malın maliyeti ne" sorusunu sessizce yanlış cevaplar (sıradaki madde).
      throw new SatinAlmaDogrulamaError(
        'Fiyatı girilmemiş kalem var. Sipariş gönderilmeden önce her kalemin birim fiyatı yazılmalıdır.',
      )
    }
    return this.depo.siparisDurumDegistir(ctx, siparis.id, yeniDurum)
  }
}

/**
 * Sıradaki belge numarasını üretir: SAT-2026-0001, SIP-2026-0001…
 *
 * Numara veritabanında bir dizi (sequence) ile üretilmiyor; sebebi kiracı
 * başına ayrı sayaç gerekmesi ve dizilerin RLS tanımaması. Burada mevcut en
 * büyük numaraya bakılıyor. Aynı anda iki kişi açarsa çakışma olur — ama
 * çakışma SESSİZ DEĞİL: veritabanındaki tekillik kısıtı yakalar ve kullanıcı
 * yeni numarayla tekrar dener.
 */
export const sonrakiBelgeNo = (onek: string, mevcutlar: readonly string[], yil = new Date().getFullYear()): string => {
  const desen = new RegExp(`^${onek}-${yil}-(\\d+)$`)
  const enBuyuk = mevcutlar.reduce((enb, no) => {
    const eslesme = desen.exec(no.trim())
    return eslesme ? Math.max(enb, Number(eslesme[1])) : enb
  }, 0)
  return `${onek}-${yil}-${String(enBuyuk + 1).padStart(4, '0')}`
}
