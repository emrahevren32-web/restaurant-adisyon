// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 / Güven katmanı — Fire, zayi ve SKT imhası
//
// ── ÜÇ AYRI SEBEP, ÜÇ AYRI SORU ──────────────────────────────────────────
//   WASTE            fire   → "üretim verimimiz düşüyor mu?"
//   LOSS             zayi   → "depoda mal kayboluyor mu?"
//   EXPIRY_WRITE_OFF imha   → "çok mu erken alıyoruz, yavaş mı tüketiyoruz?"
//
// Üçü de deftere aynı yönde (çıkış) yazılır ama üçü tamamen farklı bir sorunu
// gösterir. Tek koda sıkıştırılırsa hiçbiri cevaplanamaz.
//
// ── GEREKÇE NEDEN ZORUNLU ────────────────────────────────────────────────
// Stok düşen her hareketin bir belgesi vardır: sevkiyatın irsaliyesi, üretimin
// iş emri, iadenin faturası. Fire/zayi/imhanın belgesi YOKTUR — tek dayanağı
// yazan kişinin beyanıdır. Gerekçesiz bir zayi kaydı, denetimde "burada ne
// oldu" sorusuna cevap veremez; kötü niyetli bir kullanıcının stok açığını
// kapatmasının da en kolay yolu budur. Bu yüzden gerekçe EKRAN kuralı değil,
// SERVİS kuralıdır: hangi ekrandan gelirse gelsin boş geçilemez.
//
// ── İMHADA MİKTAR NEDEN LOTUN TAMAMI ─────────────────────────────────────
// SKT'si geçmiş bir lotun bir kısmını imha edip kalanını depoda bırakmak
// anlamsızdır: kalan da geçmiştir. Toplu imha bu yüzden lotun O ANKİ TAM
// bakiyesini yazar. Kısmi imha isteyen tek tek çıkış ekranını kullanır.
// ═══════════════════════════════════════════════════════════════════════════

import type { ZayiHareketi, ZayiNedeni } from './write-off.repository'
import { ZAYI_NEDENLERI } from './write-off.repository'

export class GerekceGerekliError extends Error {
  constructor(public readonly neden: string){
    super('Fire, zayi ve imha kayıtlarında gerekçe zorunludur. Ne olduğunu tek cümleyle yazın.')
    this.name = 'GerekceGerekliError'
  }
}

/** Gerekçe "boş sayılır mı" kararı tek yerde. Sadece boşluk da boştur. */
export const gerekceYeterliMi = (not: string | undefined): boolean =>
  (not ?? '').trim().length >= 3

export type ZayiSatirOzeti = {
  neden: ZayiNedeni
  /** Kaç ayrı hareket. */
  adet: number
  /**
   * Birimler karışabileceği için (kg + adet + lt) miktarlar birim bazında
   * ayrı toplanır. Hepsini tek sayıda toplamak "12 kg + 3 adet = 15" gibi
   * anlamsız bir rakam üretirdi.
   */
  birimBazinda: Array<{ birim: string; miktar: number }>
  /** Maliyeti bilinen hareketlerin tutar toplamı. */
  tutar: number
  /** Maliyeti bilinmeyen hareket sayısı — tutarın eksik olduğunu söyler. */
  maliyetsiz: number
}

const yuvarla = (d: number) => Math.round(d * 1000) / 1000

/**
 * Rapor özeti. Boş sebepler de listede kalır (adet 0): "bu ay hiç zayi yok"
 * ile "zayi diye bir şey ölçmüyoruz" farklı şeylerdir ve kullanıcı ikisini
 * ayırt edebilmelidir.
 */
export const zayiOzeti = (hareketler: ZayiHareketi[]): ZayiSatirOzeti[] =>
  ZAYI_NEDENLERI.map(neden => {
    const kendi = hareketler.filter(h => h.neden === neden)
    const birimler = new Map<string, number>()
    kendi.forEach(h => birimler.set(h.birim, yuvarla((birimler.get(h.birim) ?? 0) + h.miktar)))
    return {
      neden,
      adet: kendi.length,
      birimBazinda: [...birimler.entries()]
        .map(([birim, miktar]) => ({ birim, miktar }))
        .sort((a, b) => b.miktar - a.miktar),
      tutar: yuvarla(kendi.reduce((acc, h) => acc + (h.birimMaliyet ?? 0) * h.miktar, 0)),
      maliyetsiz: kendi.filter(h => h.birimMaliyet === undefined).length,
    }
  })

export type ZayiKalemSatiri = {
  kalemId: string
  kalemAd: string
  kalemKodu: string
  birim: string
  miktar: number
  tutar: number
  adet: number
}

/**
 * "En çok hangi kalemde kaybediyoruz" — tek soruya tek cevap.
 * Bir kalem farklı birimlerde ölçülmez (temel birim tektir), o yüzden burada
 * miktarlar toplanabilir.
 */
export const kalemBazindaZayi = (hareketler: ZayiHareketi[]): ZayiKalemSatiri[] => {
  const harita = new Map<string, ZayiKalemSatiri>()
  hareketler.forEach(h => {
    const mevcut = harita.get(h.kalemId) ?? {
      kalemId: h.kalemId, kalemAd: h.kalemAd, kalemKodu: h.kalemKodu,
      birim: h.birim, miktar: 0, tutar: 0, adet: 0,
    }
    mevcut.miktar = yuvarla(mevcut.miktar + h.miktar)
    mevcut.tutar = yuvarla(mevcut.tutar + (h.birimMaliyet ?? 0) * h.miktar)
    mevcut.adet += 1
    harita.set(h.kalemId, mevcut)
  })
  return [...harita.values()].sort((a, b) => b.tutar - a.tutar || b.miktar - a.miktar)
}

/** Bugünden geriye n gün — rapor varsayılan aralığı. */
export const gunOnce = (n: number, bugun: Date = new Date()): string => {
  const t = new Date(bugun)
  t.setDate(t.getDate() - n)
  return t.toISOString().slice(0, 10)
}
