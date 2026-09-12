// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Excel/CSV içe aktarmanın ortak çekirdeği
//
// Yol haritası maddesi: "Excel ile stok kartı ve tedarikçi içe aktarma"
//
// ── NEDEN ÖNCE ÖNİZLEME ──────────────────────────────────────────────────
// İçe aktarma iki adımdır: ÇÖZÜMLE, sonra YAZ. Arada kullanıcı ne olacağını
// görür — kaç kart açılacak, kaç tanesi güncellenecek, hangi satır neden
// reddedildi.
//
// Tek adımda yazsaydık, 400 satırlık bir dosyanın 380'i geçer, 20'si düşer ve
// kullanıcı hangi 20'sinin düştüğünü ancak listeye bakıp sayarak anlardı.
// Daha kötüsü: yanlış sütuna denk gelen bir dosya sessizce 400 hatalı kart
// açardı. Önizleme bunu ekranda gösterip kullanıcıya "vazgeç" imkânı verir.
//
// ── NEDEN BU DOSYA XLSX BİLMİYOR ─────────────────────────────────────────
// Buradaki her şey `string[][]` üzerinde çalışır: ilk satır başlık, kalanı
// veri. Dosyayı okuyup bu biçime çeviren kısım ekranda (tarayıcıda) durur.
// Böylece kuralların testi için gerçek bir .xlsx dosyası üretmek gerekmiyor —
// ve aynı kurallar CSV'de de aynen işliyor.
// ═══════════════════════════════════════════════════════════════════════════

/** Bir satırda bulunan tek bir sorun. */
export type SatirHatasi = {
  /** Dosyadaki satır numarası — başlık 1'dir, ilk veri satırı 2. */
  satir: number
  /** Hangi sütun. Satırın tamamına ait hatalarda boş. */
  alan?: string
  mesaj: string
}

export type OnizlemeSatiri<T> =
  | { durum: 'YENI'; satir: number; kod: string; girdi: T }
  | { durum: 'GUNCELLEME'; satir: number; kod: string; girdi: T; mevcutId: string }
  | { durum: 'HATA'; satir: number; kod: string; hatalar: SatirHatasi[] }

export type Onizleme<T> = {
  satirlar: OnizlemeSatiri<T>[]
  yeni: number
  guncelleme: number
  hatali: number
  /**
   * Tanınmayan başlıklar.
   *
   * Hata değil, uyarı: kullanıcının dosyasında bizim okumadığımız sütunlar
   * olabilir ve bu normaldir. Ama "Birim" yerine "Ölçü Birimi" yazdığı için
   * sütun okunmuyorsa, bunu görmesi gerekir — yoksa bütün satırlar "birim
   * zorunludur" diye düşer ve sebebini anlamaz.
   */
  bilinmeyenSutunlar: string[]
  /** Zorunlu olup dosyada bulunamayan sütunlar. Doluysa hiçbir satır okunmaz. */
  eksikSutunlar: string[]
}

/**
 * Başlığı karşılaştırılabilir hâle getirir.
 *
 * ⚠️ Türkçe yerel ayarıyla küçültme YAPILMIYOR: `'IBAN'.toLocaleLowerCase('tr-TR')`
 * → `'ıban'` olur ve `'iban'` ile eşleşmez. Bunun yerine Türkçe harfler tek
 * tek karşılıklarına çevriliyor; hem "Ürün Kodu" hem "URUN KODU" hem de
 * "urun_kodu" aynı şeye iner.
 */
export const basligiNormalize = (deger: unknown): string =>
  String(deger ?? '')
    .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİI]/g, 'i')
    .replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Bir sütunun tanımı: hangi başlıklar bu alana denk gelir. */
export type SutunTanimi = {
  alan: string
  /** Ekranda ve şablonda görünen başlık. */
  baslik: string
  /** Kabul edilen diğer yazımlar. Normalleştirilerek karşılaştırılır. */
  esanlamlilar?: readonly string[]
  zorunlu?: boolean
  /** Şablon dosyasındaki örnek satırda ne yazsın. */
  ornek?: string
  /** Şablonda başlığın altına düşülecek kısa açıklama. */
  aciklama?: string
}

export type SutunEslemesi = {
  /** alan → sütun indeksi */
  indeks: Record<string, number>
  bilinmeyenSutunlar: string[]
  eksikSutunlar: string[]
}

/**
 * Dosyadaki başlık satırını sütun tanımlarıyla eşler.
 *
 * Sütunların SIRASI önemli değildir; kullanıcı kolonları istediği gibi
 * dizebilir. Sıraya güvenseydik, araya eklenen tek bir sütun bütün dosyayı
 * bozardı.
 */
export const sutunlariEsle = (
  basliklar: readonly unknown[],
  tanimlar: readonly SutunTanimi[],
): SutunEslemesi => {
  const indeks: Record<string, number> = {}
  const kullanilan = new Set<number>()

  for(const tanim of tanimlar){
    const adaylar = [tanim.baslik, ...(tanim.esanlamlilar ?? [])].map(basligiNormalize)
    const bulunan = basliklar.findIndex(
      (b, i) => !kullanilan.has(i) && adaylar.includes(basligiNormalize(b)),
    )
    if(bulunan >= 0){
      indeks[tanim.alan] = bulunan
      kullanilan.add(bulunan)
    }
  }

  const bilinmeyenSutunlar = basliklar
    .map((b, i) => ({ ad: String(b ?? '').trim(), i }))
    .filter(x => x.ad !== '' && !kullanilan.has(x.i))
    .map(x => x.ad)

  const eksikSutunlar = tanimlar
    .filter(t => t.zorunlu && indeks[t.alan] === undefined)
    .map(t => t.baslik)

  return { indeks, bilinmeyenSutunlar, eksikSutunlar }
}

/** Hücreyi kırpılmış metin olarak okur. Sütun yoksa boş döner. */
export const hucre = (
  satir: readonly unknown[],
  esleme: SutunEslemesi,
  alan: string,
): string => {
  const i = esleme.indeks[alan]
  if(i === undefined) return ''
  const deger = satir[i]
  if(deger === null || deger === undefined) return ''
  return String(deger).trim()
}

/**
 * Metni sayıya çevirir.
 *
 * Hem "1.234,56" (Türkçe) hem "1234.56" (İngilizce) kabul edilir: Excel'in
 * dil ayarına göre iki biçim de gelebiliyor ve kullanıcı hangisini
 * gönderdiğini bilmiyor. Ayırt etme kuralı basit: virgül varsa, virgül
 * ondalık ayırıcıdır ve noktalar binlik ayırıcıdır.
 */
export const sayiyaCevir = (metin: string): number | undefined => {
  const temiz = metin.replace(/\s/g, '')
  if(temiz === '') return undefined

  const duzeltilmis = temiz.includes(',')
    ? temiz.replace(/\./g, '').replace(',', '.')
    : temiz

  const sayi = Number(duzeltilmis)
  return Number.isFinite(sayi) ? sayi : undefined
}

const EVET = new Set(['evet', 'e', 'var', 'x', 'true', '1', 'yes', 'y', 'dogru', 'acik'])
const HAYIR = new Set(['hayir', 'h', 'yok', 'false', '0', 'no', 'n', 'yanlis', 'kapali', ''])

/**
 * Evet/hayır sütununu okur.
 *
 * Kullanıcılar aynı şeyi yazmanın on yolunu bulur: "Evet", "E", "X", "VAR",
 * "1", boş... Tanımadığımız bir değer geldiğinde SESSİZCE "hayır" saymıyoruz,
 * `undefined` dönüp çağıranın hata vermesine izin veriyoruz. Lot takibini
 * yanlışlıkla kapatmak, sonradan geri alınması zor bir hatadır.
 */
export const evetMi = (metin: string): boolean | undefined => {
  const anahtar = basligiNormalize(metin).replace(/\s/g, '')
  if(EVET.has(anahtar)) return true
  if(HAYIR.has(anahtar)) return false
  return undefined
}

/** Boş satır: bütün hücreleri boş. Excel dosyalarının sonunda bolca bulunur. */
export const bosSatir = (satir: readonly unknown[]): boolean =>
  satir.every(h => h === null || h === undefined || String(h).trim() === '')

/** Önizleme sayaçlarını satırlardan türetir. */
export const sayaclariHesapla = <T>(
  satirlar: readonly OnizlemeSatiri<T>[],
): Pick<Onizleme<T>, 'yeni' | 'guncelleme' | 'hatali'> => ({
  yeni: satirlar.filter(s => s.durum === 'YENI').length,
  guncelleme: satirlar.filter(s => s.durum === 'GUNCELLEME').length,
  hatali: satirlar.filter(s => s.durum === 'HATA').length,
})

/**
 * Şablon dosyasının satırları: başlık, açıklama ve bir örnek.
 *
 * Şablonu indirtmek, "hangi sütunlar lazım" sorusunu tamamen ortadan
 * kaldırıyor. Açıklama satırı BAŞLIĞIN ALTINDA duruyor ve içe aktarmada
 * hatalı satır olarak düşüyor — bilerek: kullanıcı onu silmezse ekranda
 * "1. satır okunamadı" diye görür ve ne yapması gerektiğini anlar.
 */
export const sablonSatirlari = (tanimlar: readonly SutunTanimi[]): string[][] => [
  tanimlar.map(t => t.baslik + (t.zorunlu ? ' *' : '')),
  tanimlar.map(t => t.aciklama ?? ''),
  tanimlar.map(t => t.ornek ?? ''),
]

export type IceAktarmaSonucu = {
  eklendi: number
  guncellendi: number
  /** Yazarken düşenler — çakışma, izin, bağlantı kopması. */
  basarisiz: Array<{ satir: number; kod: string; mesaj: string }>
}

/**
 * Önizlemedeki geçerli satırları yazar.
 *
 * Hatalı satırlar zaten önizlemede ayrılmıştı; buraya gelmez. Yazarken düşen
 * bir satır bütün işi DURDURMAZ: kalanlar yazılır, düşenler tek tek
 * raporlanır. 400 kartın 399'unu 200. satırdaki bir çakışma yüzünden geri
 * almak kimsenin işine yaramaz — kullanıcı o tek satırı düzeltip yeniden
 * yükler, ikinci denemede o satır "güncelleme" olarak geçer.
 *
 * `guncelle` verilmezse mevcut kayıtlar ATLANIR (üzerine yazılmaz). Böylece
 * "yalnızca yenileri ekle" davranışı çağıranın tercihidir, buranın değil.
 */
export const satirlariYaz = async <T>(
  onizleme: Onizleme<T>,
  ekle: (girdi: T) => Promise<unknown>,
  guncelle?: (id: string, girdi: T) => Promise<unknown>,
): Promise<IceAktarmaSonucu> => {
  const sonuc: IceAktarmaSonucu = { eklendi: 0, guncellendi: 0, basarisiz: [] }

  for(const satir of onizleme.satirlar){
    if(satir.durum === 'HATA') continue
    try{
      if(satir.durum === 'YENI'){
        await ekle(satir.girdi)
        sonuc.eklendi += 1
      } else if(guncelle){
        await guncelle(satir.mevcutId, satir.girdi)
        sonuc.guncellendi += 1
      }
    } catch (e) {
      sonuc.basarisiz.push({
        satir: satir.satir,
        kod: satir.kod,
        mesaj: e instanceof Error ? e.message : 'Bilinmeyen hata',
      })
    }
  }

  return sonuc
}
