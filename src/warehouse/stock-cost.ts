// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Alış fiyatı ve stok maliyeti
//
// Yol haritası maddesi: "Alış fiyatı ve ortalama maliyet"
//                       Bitti sayılır ki: "Maliyet defterden hesaplanıyor"
//
// ── ÜÇ YÖNTEM, TEK KAPI ──────────────────────────────────────────────────
// Aynı malı iki farklı fiyattan aldınız: 100 kg × 40 TL, sonra 100 kg × 50 TL.
// Depoda 200 kg var. Üretimde 50 kg kullanınca maliyeti kaç sayacağız?
//
//   ORTALAMA  45 TL — ağırlıklı ortalama. Fiyat dalgalanmasını yumuşatır,
//                     gıdada en yaygın yöntem budur.
//   FIFO      40 TL — ilk giren ilk çıkar. Fiziksel gerçeğe en yakın olan;
//                     lotları zaten FEFO ile çekiyoruz.
//   SON_ALIS  50 TL — "bugün yerine koysam ne öderim" sorusunun cevabı.
//
// Ürün sahibinin kararı (2026-09-03): ORTALAMA. Ama karar demo öncesinde,
// müşterinin muhasebecisiyle konuşulmadan verildi — bu yüzden yöntem BİR
// SABİTE bağlandı ve üçü de yazıldı. Değiştirmek `VARSAYILAN_MALIYET_YONTEMI`
// satırını değiştirmektir; hesap kodunu yeniden yazmak değil.
//
// ⚠️ Yöntem değişirse GEÇMİŞ maliyetler de değişir — çünkü hiçbir yerde
//    saklanmıyor, her okumada defterden yeniden hesaplanıyor. Bu, gerçek
//    kullanıma geçmeden önce netleşmesi gereken bir karardır. Kullanım
//    başladıktan sonra değiştirmek, geçmiş raporları da değiştirir.
//
// ── NEDEN SAKLANMIYOR ────────────────────────────────────────────────────
// Maliyet bir kolonda TUTULMUYOR; her okumada defterden türetiliyor. Gerekçe
// bakiyeyle aynı (ADR-001): saklanan bir toplam, güncellemeyi unutan tek bir
// kod yoluyla sessizce yanlış hâle gelir ve yanlış olduğu ancak aylar sonra
// fark edilir. Defter ise değişmez.
//
// ── EN İNCE NOKTA: FİYAT HANGİ BİRİMİN FİYATI ────────────────────────────
// `unitCost`, kullanıcının YAZDIĞI birimin fiyatıdır (`uomEntered`), temel
// birimin değil. Mercimek temel birimi "g" iken sipariş "kg" üzerinden 95
// TL'den verilmişse, defterde `quantityEntered = 57 kg`, `unitCost = 95`,
// `quantityBase = 57.000 g` durur.
//
// Değeri `quantityBase × unitCost` diye hesaplasaydık 5.415 TL yerine
// 5.415.000 TL çıkardı — bin kat hata, hiçbir uyarı vermeden. Bu yüzden:
//
//     SATIR DEĞERİ = |quantityEntered| × unitCost   ← fiyatla aynı birimde
//     MİKTAR       = quantityBase                   ← defterin birimi
//     BİRİM MALİYET = değer / miktar                ← temel birim başına
//
// Birim maliyet HER ZAMAN temel birim başınadır (yukarıdaki örnekte gram
// başına 0,095 TL), çünkü bakiye de temel birimdedir.
// ═══════════════════════════════════════════════════════════════════════════

import type { Movement } from '../core/stock/stock.repository'

export type MaliyetYontemi = 'ORTALAMA' | 'FIFO' | 'SON_ALIS'

export const MALIYET_YONTEM_ETIKETLERI: Record<MaliyetYontemi, string> = {
  ORTALAMA: 'Ağırlıklı ortalama',
  FIFO: 'İlk giren ilk çıkar (FIFO)',
  SON_ALIS: 'Son alış fiyatı',
}

/**
 * Yürürlükteki yöntem.
 *
 * ⚠️ DEĞİŞTİRİLECEK TEK YER BURASI. Ekranlar, raporlar ve üretim maliyeti
 * bu sabiti okur; hiçbiri kendi yöntemini seçmez. İleride kiracı başına
 * ayarlanabilir hâle gelirse, o ayarı okuyan tek fonksiyon yine burada olur.
 */
export const VARSAYILAN_MALIYET_YONTEMI: MaliyetYontemi = 'ORTALAMA'

export type StokMaliyeti = {
  /** Hangi yöntemle hesaplandı — ekranda göstermek için. */
  yontem: MaliyetYontemi
  /** Defterden türetilmiş bakiye, temel birimde. */
  miktar: number
  /** Elde kalan malın toplam parasal değeri. */
  deger: number
  /**
   * Temel birim başına maliyet.
   *
   * Bakiye 0 olduğunda değer de 0'a iner ama birim maliyet SIFIRLANMAZ: en
   * son bilinen değer korunur. Gerekçe: depo bir an boşaldı diye o malın
   * maliyeti "0 TL" değildir; yeni mal gelene kadar elimizdeki tek bilgi
   * son bilinen maliyettir.
   */
  birimMaliyet: number
  /** En son satın alma girişinin birim fiyatı — yazıldığı birimde. */
  sonAlisFiyati?: number
  /** Son alış fiyatının ait olduğu birim (`uomEntered`). */
  sonAlisBirimi?: string
  /** Son alışın defterdeki tarihi. */
  sonAlisTarihi?: Date
  /**
   * Fiyatsız giriş yapılmış mı?
   *
   * Elle giriş, sayım fazlası ve açılış bakiyesinde fiyat girilmemiş
   * olabilir. Bunlar o anki maliyetle değerlenir — yoksa 0 TL'lik mal
   * ortalamayı aşağı çeker ve maliyet olduğundan ucuz görünür. Ekranda
   * "bu rakam eksik veriye dayanıyor" diyebilmek için işaretliyoruz.
   */
  fiyatsizGirisVar: boolean
}

const yuvarla = (deger: number) => Math.round(deger * 1e6) / 1e6
/** Para 2 haneye yuvarlanır; kuruş altı fark birikip raporu bozmasın. */
const paraYuvarla = (deger: number) => Math.round(deger * 100) / 100

/**
 * Ters kayıt hesaba girmez: kendi karşıt hareketiyle birlikte okunuyor,
 * ikinci kez saymak değeri iki katına çıkarırdı.
 */
const HESABA_GIRMEZ: ReadonlySet<string> = new Set(['REVERSAL'])

/**
 * Bir GİRİŞ hareketinin temel birim başına fiyatı.
 *
 * Fiyat yazılan birimin fiyatı, miktar temel birimde — bölme işlemi ikisini
 * buluşturur. Dosya başındaki nota bakınız.
 */
const girisBirimFiyati = (h: Movement): number | undefined => {
  if(typeof h.unitCost !== 'number' || h.unitCost <= 0) return undefined
  if(h.quantityBase <= 0) return undefined
  return (Math.abs(h.quantityEntered) * h.unitCost) / h.quantityBase
}

/** Bir kalemin hareketleri, tarih sırasına dizilmiş ve ters kayıtlar ayıklanmış. */
const sirala = (hareketler: readonly Movement[]): Movement[] =>
  [...hareketler]
    .filter(h => !HESABA_GIRMEZ.has(h.reason))
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())

/** Son SATIN ALMA girişinin bilgileri. Üretim çıktısı bir alış değildir. */
const sonAlis = (sirali: readonly Movement[]) => {
  for(let i = sirali.length - 1; i >= 0; i -= 1){
    const h = sirali[i]
    if(h.reason !== 'PURCHASE_RECEIPT') continue
    if(typeof h.unitCost !== 'number' || h.unitCost <= 0) continue
    return {
      fiyat: h.unitCost,
      birim: h.uomEntered,
      tarih: h.occurredAt,
      temelBirimFiyati: girisBirimFiyati(h) ?? 0,
    }
  }
  return undefined
}

// ═══════════════════════════════════════════════════════════════════════════
// Yöntemler
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hareketli ağırlıklı ortalama.
 *
 * Her girişte ortalama yeniden kurulur; her çıkış O ANKİ ortalamadan gider ve
 * ortalamayı DEĞİŞTİRMEZ. 200 kg'ın 50'si çıkınca kalan 150 kg'ın birim
 * maliyeti hâlâ 45 TL'dir.
 */
const ortalamaIle = (sirali: readonly Movement[]) => {
  let miktar = 0
  let deger = 0
  let sonBilinen = 0
  let fiyatsizGirisVar = false

  for(const h of sirali){
    const birim = miktar > 0 ? deger / miktar : sonBilinen

    if(h.quantityBase > 0){
      const fiyat = girisBirimFiyati(h)
      if(fiyat === undefined) fiyatsizGirisVar = true
      // Fiyatsız giriş o anki maliyetle değerlenir. 0 TL saymak, maliyeti
      // gerçekte olmadığı kadar aşağı çekerdi — mal bedava gelmiş gibi.
      deger = paraYuvarla(deger + (h.quantityBase * (fiyat ?? birim)))
      miktar = yuvarla(miktar + h.quantityBase)
    } else if(h.quantityBase < 0){
      // Çıkan mal ortalamadan çıkar. Tedarikçi iadesi de buna dâhildir: iade
      // edilen mal depoda bir süre durdu ve o süre boyunca ortalamanın
      // parçasıydı.
      const cikan = Math.min(Math.abs(h.quantityBase), Math.max(0, miktar))
      miktar = yuvarla(miktar + h.quantityBase)
      deger = paraYuvarla(Math.max(0, deger - (cikan * birim)))
    }

    if(miktar > 0) sonBilinen = deger / miktar
    else deger = 0
  }

  return { miktar, deger, birimMaliyet: miktar > 0 ? deger / miktar : sonBilinen, fiyatsizGirisVar }
}

type Katman = { kalan: number; birimMaliyet: number }

/**
 * İlk giren ilk çıkar.
 *
 * Girişler sıraya dizilir; çıkışlar sıranın BAŞINDAN yer. Depodaki malın
 * değeri, en son gelen partilerin fiyatlarından oluşur — yani enflasyonda
 * stok değeri ortalamadan yüksek, kullanılan malın maliyeti düşük çıkar.
 * Ortalamayla arasındaki fark tam olarak budur.
 */
const fifoIle = (sirali: readonly Movement[]) => {
  const katmanlar: Katman[] = []
  let miktar = 0
  let sonBilinen = 0
  let fiyatsizGirisVar = false

  const katmanDegeri = () =>
    katmanlar.reduce((t, k) => t + (k.kalan * k.birimMaliyet), 0)

  for(const h of sirali){
    if(h.quantityBase > 0){
      const fiyat = girisBirimFiyati(h)
      if(fiyat === undefined) fiyatsizGirisVar = true
      // Fiyatsız giriş, o anki katman ortalamasıyla değerlenir.
      const oAnki = miktar > 0 ? katmanDegeri() / miktar : sonBilinen
      katmanlar.push({ kalan: h.quantityBase, birimMaliyet: fiyat ?? oAnki })
      miktar = yuvarla(miktar + h.quantityBase)
    } else if(h.quantityBase < 0){
      let kalanCikis = Math.abs(h.quantityBase)
      while(kalanCikis > 0 && katmanlar.length > 0){
        const bas = katmanlar[0]
        const pay = Math.min(bas.kalan, kalanCikis)
        bas.kalan = yuvarla(bas.kalan - pay)
        kalanCikis = yuvarla(kalanCikis - pay)
        if(bas.kalan <= 0) katmanlar.shift()
      }
      miktar = yuvarla(miktar + h.quantityBase)
    }

    if(miktar > 0) sonBilinen = katmanDegeri() / miktar
  }

  const deger = miktar > 0 ? paraYuvarla(katmanDegeri()) : 0
  return { miktar, deger, birimMaliyet: miktar > 0 ? deger / miktar : sonBilinen, fiyatsizGirisVar }
}

/**
 * Son alış fiyatı.
 *
 * Depodaki her birim, en son ödenen fiyattan değerlenir. Geçmişi hiç
 * hesaba katmaz; "bugün yerine koysam ne öderim" sorusunun cevabıdır.
 * Fiyat oynak bir üründe stok değerini de oynak yapar.
 */
const sonAlisIle = (sirali: readonly Movement[]) => {
  const miktar = yuvarla(sirali.reduce((t, h) => t + h.quantityBase, 0))
  const alis = sonAlis(sirali)
  const fiyatsizGirisVar = sirali.some(
    h => h.quantityBase > 0 && girisBirimFiyati(h) === undefined,
  )
  const birimMaliyet = alis?.temelBirimFiyati ?? 0
  return {
    miktar,
    deger: miktar > 0 ? paraYuvarla(miktar * birimMaliyet) : 0,
    birimMaliyet,
    fiyatsizGirisVar,
  }
}

const YONTEMLER: Record<MaliyetYontemi, (s: readonly Movement[]) => {
  miktar: number; deger: number; birimMaliyet: number; fiyatsizGirisVar: boolean
}> = {
  ORTALAMA: ortalamaIle,
  FIFO: fifoIle,
  SON_ALIS: sonAlisIle,
}

// ═══════════════════════════════════════════════════════════════════════════
// Tek giriş noktası
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hareket listesinden maliyet durumunu türetir.
 *
 * Hareketler tarih sırasına konur — sıra önemlidir, çünkü hesap yürüyerek
 * yapılır: bugün çıkan mal, dünkü maliyetten çıkar.
 */
export const maliyetiHesapla = (
  hareketler: readonly Movement[],
  yontem: MaliyetYontemi = VARSAYILAN_MALIYET_YONTEMI,
): StokMaliyeti => {
  const sirali = sirala(hareketler)
  const sonuc = YONTEMLER[yontem](sirali)
  const alis = sonAlis(sirali)

  return {
    yontem,
    miktar: sonuc.miktar,
    deger: paraYuvarla(sonuc.deger),
    birimMaliyet: yuvarla(sonuc.birimMaliyet),
    sonAlisFiyati: alis?.fiyat,
    sonAlisBirimi: alis?.birim,
    sonAlisTarihi: alis?.tarih,
    fiyatsizGirisVar: sonuc.fiyatsizGirisVar,
  }
}

/**
 * Bir çıkışın parasal maliyeti.
 *
 * Üretim maliyeti, fire maliyeti ve sevkiyat maliyeti hep bunu kullanır:
 * "şu kadar mal çıktı, kaç TL'lik mal çıktı?"
 */
export const cikisMaliyeti = (maliyet: StokMaliyeti, miktarTemel: number): number =>
  paraYuvarla(miktarTemel * maliyet.birimMaliyet)
