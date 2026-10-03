// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C2 — SİPARİŞTEN İŞ EMRİ TÜRETME
//
// Yol haritası: "Depoda olan depodan, olmayan üretimden karşılanıyor"
//
// Hesabın kendisi 0056'da (`app.siparis_karsilama_plani`). Buradaki iş,
// o planı İŞ EMRİ GİRDİSİNE çevirmek — ve çeviremeyeceği durumları
// SESSİZCE ATLAMAMAK.
//
// ⚠️ Plan tarayıcıda hesaplanmıyor. Depo bakiyesi ile başka siparişlerin
// rezervi iki ayrı sorgudan gelseydi, aradaki saniyede yazılan bir sipariş
// sessizce kaçar ve aynı mal iki kez vaat edilirdi.
// ═══════════════════════════════════════════════════════════════════════════

// ⚠️ `Recete` tipi REÇETE DEPOSUNDAN gelir; `recipe.service` onu yalnız
// içeri aktarıyor, yeniden dışarı vermiyor. Yanlış yerden almak bun'da
// (yalnız derleme yapar) görünmez, `tsc`de TS2459 ile patlar.
import type { Recete } from '../production/recipe.repository'
import { receteyiOlcekle } from '../production/recipe.service'
import { receteyiIsEmrineDok, sonrakiIsEmriNo } from '../production/work-order.service'
import type { YeniIsEmri } from '../production/work-order.repository'
import type { Siparis } from './sales-order.repository'

/** `app.siparis_karsilama_plani()` satırının TS karşılığı. */
export type KarsilamaSatiri = {
  kalemId: string
  kalemAdi: string
  siparisMiktar: number
  birim: string
  temelBirim: string
  /** Sipariş birimi ile kalemin temel birimi farklı → hesap YAPILMADI. */
  birimUyusmuyor: boolean
  depoBakiye: number
  /** Başka açık siparişlere söz verilmiş miktar. */
  rezerve: number
  musait?: number
  depodan?: number
  uretilecek?: number
  receteId?: string
  /** Aktif reçetesi var mı. Yoksa üretilemez; satın alınır. */
  uretilebilir: boolean
}

export class IsEmriTuretmeError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'IsEmriTuretmeError'
  }
}

/** Ekranda kalemin yanına yazılan tek satır. */
export const karsilamaOzeti = (s: KarsilamaSatiri): string => {
  const n = (x: number) => x.toLocaleString('tr-TR')
  if(s.birimUyusmuyor){
    return `sipariş ${s.birim}, stok ${s.temelBirim} — birimler uyuşmuyor, `
      + 'karşılama hesaplanamıyor'
  }
  const parcalar: string[] = []
  if((s.depodan ?? 0) > 0) parcalar.push(`${n(s.depodan as number)} depodan`)
  if((s.uretilecek ?? 0) > 0){
    parcalar.push(s.uretilebilir
      ? `${n(s.uretilecek as number)} üretimden`
      // Reçetesi olmayan kalem üretilemez. "Üretimden" demek, olmayacak
      // bir işi planlamak olurdu.
      : `${n(s.uretilecek as number)} EKSİK — reçetesi yok, satın alınmalı`)
  }
  if(parcalar.length === 0) return 'ihtiyaç yok'
  const ek = s.rezerve > 0 ? ` · ${n(s.rezerve)} başka siparişe ayrılmış` : ''
  return parcalar.join(' + ') + ek
}

export type KarsilamaToplami = {
  kalemSayisi: number
  tamamenDepodan: number
  uretimGereken: number
  /** Reçetesi olmadığı için üretilemeyen — satın alınmalı. */
  uretilemeyen: number
  hesaplanamayan: number
}

export const karsilamaToplami = (plan: readonly KarsilamaSatiri[]): KarsilamaToplami => {
  const hesaplanan = plan.filter(s => !s.birimUyusmuyor)
  return {
    kalemSayisi: plan.length,
    tamamenDepodan: hesaplanan.filter(s => (s.uretilecek ?? 0) === 0).length,
    uretimGereken: hesaplanan.filter(s => (s.uretilecek ?? 0) > 0 && s.uretilebilir).length,
    uretilemeyen: hesaplanan.filter(s => (s.uretilecek ?? 0) > 0 && !s.uretilebilir).length,
    hesaplanamayan: plan.filter(s => s.birimUyusmuyor).length,
  }
}

export type TuretilenIsEmri = {
  kalemAdi: string
  girdi: YeniIsEmri
}

/**
 * Plandan iş emri girdileri üretir.
 *
 * @param receteler Kalem kimliği → reçete. Eksik olan kalem ATLANMAZ, HATA
 *   verir: "üretilecek 30 koli" deyip iş emri çıkarmamak, planın yalan
 *   söylemesi demektir.
 */
export const isEmirleriTuret = (
  siparis: Siparis,
  plan: readonly KarsilamaSatiri[],
  receteler: ReadonlyMap<string, Recete>,
  mevcutNumaralar: readonly string[],
): TuretilenIsEmri[] => {
  const uretilecekler = plan.filter(s =>
    !s.birimUyusmuyor && (s.uretilecek ?? 0) > 0 && s.uretilebilir)

  if(uretilecekler.length === 0){
    const sebep = plan.some(s => !s.birimUyusmuyor && (s.uretilecek ?? 0) > 0 && !s.uretilebilir)
      ? 'Üretilmesi gereken kalemlerin reçetesi yok; bunlar satın alınmalı.'
      : 'Bu siparişin üretilmesi gereken kalemi yok — tamamı depodan karşılanıyor.'
    throw new IsEmriTuretmeError(sebep)
  }

  const numaralar = [...mevcutNumaralar]
  return uretilecekler.map(s => {
    const recete = s.receteId ? receteler.get(s.receteId) : undefined
    if(!recete){
      throw new IsEmriTuretmeError(
        `${s.kalemAdi} için reçete okunamadı; iş emri çıkarılamıyor.`,
      )
    }
    const no = sonrakiIsEmriNo(numaralar)
    numaralar.push(no)

    const girdi: YeniIsEmri = {
      isEmriNo: no,
      siparisId: siparis.id,
      receteId: recete.id,
      ciktiKalemiId: s.kalemId,
      planlananMiktar: s.uretilecek as number,
      ciktiBirimi: s.birim,
      // Miktarlar reçeteden KOPYALANIYOR, referans verilmiyor: reçete yarın
      // değişse bile bu iş emrinin neye göre planlandığı belli kalır.
      satirlar: receteyiIsEmrineDok(receteyiOlcekle(recete, s.uretilecek as number)),
      not: `${siparis.siparisNo} siparişinden türetildi`,
    }
    if(siparis.sevkTarihi) girdi.planlananTarih = siparis.sevkTarihi
    return { kalemAdi: s.kalemAdi, girdi }
  })
}
