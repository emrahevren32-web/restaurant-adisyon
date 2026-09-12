// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 / İzlenebilirlik — Geri çağırma raporu
//
// Yol haritası maddeleri:
//   "Tek tuşla geri çağırma listesi + PDF" → Rastgele lot numarasıyla 2 saniyede sonuç
//   "Geri izleme: bu sevkiyatın içinde ne var" → Tedarikçi partisine kadar iniliyor
//
// ── BU DOSYA NEDEN AYRI ──────────────────────────────────────────────────
// `ileriIzle` ham zinciri verir: lot kimlikleri ve miktarlar. Aranacak insan
// orada yok — müşteri adı ve telefon SEVKİYAT BELGESİNDE durur. Rapor, bu
// ikisini birleştirir ve ekranın da yazıcının da aynı listeyi görmesini
// sağlar. İki yerde iki kez birleştirilseydi, biri düzelirken diğeri
// unutulurdu.
//
// ── EN ÖNEMLİ ALAN: `eksik` ──────────────────────────────────────────────
// Bir geri çağırma listesinin eksik olduğunu bilmemek, listenin hiç
// olmamasından tehlikelidir: dolu görünür, insan güvenir, bir müşteri
// aranmaz. Bu yüzden zincirin taranamadığı ya da belgesi okunamadığı her
// durum rapora YAZILIR ve çıktının başına basılır.
// ═══════════════════════════════════════════════════════════════════════════

import type { Movement } from '../core/stock/stock.repository'
import type { IleriIzlemeSonucu, SoyagaciLotu } from './genealogy'
import type { Sevkiyat } from './shipment.repository'

export type GeriCagirmaSatiri = {
  sevkiyatId: string
  sevkiyatNo: string
  musteriAd: string
  musteriTelefon?: string
  adres?: string
  sevkTarihi?: string
  /** Müşteriye giden parti — kaynak partinin kendisi ya da ondan türeyen mamul. */
  gidenLotKodu: string
  gidenUrun: string
  /** Temel birimde. */
  miktar: number
  /** Kaynak partiden buraya kadar geçilen partiler. */
  yol: string[]
}

export type GeriCagirmaRaporu = {
  kaynakLot: SoyagaciLotu
  olusturmaZamani: string
  /** Kaynak partiden türeyen mamul partileri. */
  tureyenLotlar: SoyagaciLotu[]
  satirlar: GeriCagirmaSatiri[]
  /** Kaç ayrı müşteri aranacak. */
  musteriSayisi: number
  /** Liste eksik olabilir mi? */
  eksik: boolean
  /** Eksikse neden — çıktının başına basılır. */
  eksikSebepleri: string[]
}

/**
 * İleri izleme sonucunu, aranacak müşteri listesine çevirir.
 *
 * Belgesi bulunamayan bir sevkiyat SESSİZCE ATILMAZ: satır listede kalır
 * ("belge bulunamadı" adıyla) ve rapor eksik işaretlenir. Atılsaydı liste
 * kısalır ve kimse eksildiğini fark etmezdi.
 */
export const geriCagirmaRaporu = (
  kaynakLot: SoyagaciLotu,
  sonuc: IleriIzlemeSonucu,
  sevkiyatlar: readonly Sevkiyat[],
  olusturmaZamani: string = new Date().toISOString(),
): GeriCagirmaRaporu => {
  const belgeler = new Map(sevkiyatlar.map(s => [s.id, s]))
  const eksikSebepleri: string[] = []

  const satirlar: GeriCagirmaSatiri[] = sonuc.sevkiyatlar.map(iz => {
    const belge = belgeler.get(iz.sevkiyatId)
    return {
      sevkiyatId: iz.sevkiyatId,
      sevkiyatNo: belge?.sevkiyatNo ?? '—',
      musteriAd: belge?.musteriAd ?? 'belge bulunamadı',
      musteriTelefon: belge?.musteriTelefon,
      adres: belge?.adres,
      sevkTarihi: belge?.sevkTarihi,
      gidenLotKodu: iz.lot.lotKodu,
      gidenUrun: iz.lot.stokKalemiAd,
      miktar: iz.miktar,
      yol: iz.yol,
    }
  })

  const belgesiz = satirlar.filter(s => !belgeler.has(s.sevkiyatId)).length
  if(belgesiz > 0){
    eksikSebepleri.push(
      `${belgesiz} sevkiyatın belgesi okunamadı; müşteri adı ve telefonu bilinmiyor.`,
    )
  }
  if(sonuc.derinlikAsildi){
    eksikSebepleri.push(
      'Zincir derinlik sınırına dayandı; bu partiden türeyen üretimlerin bir '
      + 'kısmı taranmadı.',
    )
  }

  return {
    kaynakLot,
    olusturmaZamani,
    tureyenLotlar: sonuc.tureyenLotlar,
    satirlar,
    // Aynı müşteriye iki ayrı sevkiyat gitmişse bir kez aranır; sayı
    // SEVKİYAT değil MÜŞTERİ sayısıdır — telefonu eline alan kişi bunu sorar.
    musteriSayisi: new Set(
      satirlar.map(s => (s.musteriTelefon ?? '') + '|' + s.musteriAd),
    ).size,
    eksik: eksikSebepleri.length > 0,
    eksikSebepleri,
  }
}

/**
 * Bir sevkiyatın deftere yazdığı hareketlerden, GİDEN PARTİLERİ çıkarır.
 *
 * Geri izlemenin ("bu sevkiyatın içinde ne var") giriş noktası budur:
 * belgede parti yazmadığı için soru ancak defterden cevaplanır.
 *
 * Ters kaydı olan hareket dışarıda bırakılır: iptal edilmiş bir çıkış
 * gitmemiştir, içeriği de sorulmaz.
 */
export const sevkiyatinLotIdleri = (hareketler: readonly Movement[]): string[] => {
  const tersleneler = new Set(
    hareketler
      .filter(h => h.reason === 'REVERSAL' && h.reversesMovementId)
      .map(h => h.reversesMovementId!),
  )
  return [...new Set(
    hareketler
      .filter(h => h.reason === 'SHIPMENT_OUT' && h.lotId && !tersleneler.has(h.id))
      .map(h => h.lotId!),
  )]
}
