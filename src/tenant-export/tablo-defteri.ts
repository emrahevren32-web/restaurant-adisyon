// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · VERİ DEFTERİ — "SİSTEMİ BIRAKIRSAM VERİM BENDE KALIR MI?"
//
// Emrah (08.10.2026): *"Sistemi tamamen terk etmek isteyen kullanıcıya tüm
// verilerini verebilme garantimiz olsun."*
//
// JSON yedeği zaten vardı ve EKSİKSİZ. Ama bir gıda mühendisi ya da bir mali
// müşavir 40 tablolu bir JSON dosyasını açamaz. "Verinizi her an
// alabilirsiniz" cümlesinin karşılığı, AÇILABİLEN bir dosya olmalı:
// tek bir Excel, her tablo bir sayfa.
//
// ⚠️ BU DOSYA MİYOP'A BAĞIMLI DEĞİLDİR. Excel'de, LibreOffice'te, Google
// Sheets'te açılır. Güvenin kaynağı budur: müşteri bize bağımlı olmadığını
// GÖREBİLİYOR. Göremediği bir garanti, garanti değildir.
//
// ⚠️ YENİ BAĞIMLILIK YOK: `xlsx` zaten projede.
// ═══════════════════════════════════════════════════════════════════════════

import type { DisaAktarmaKunyesi, DisaAktarmaSonucu } from './tenant-export'

/** Excel'in tek sayfada taşıyabildiği en fazla satır (başlık dahil). */
export const EXCEL_SATIR_SINIRI = 1_048_576

/** Excel sayfa adı en fazla 31 karakter ve bazı işaretleri kabul etmez. */
const YASAK_ISARETLER = /[[\]:*?/\\]/g

export type Sayfa = {
  ad: string
  basliklar: string[]
  satirlar: (string | number | boolean | null)[][]
}

/**
 * Sayfa adı — Excel'in kurallarına uydurulmuş.
 *
 * ⚠️ KISALTMA SONDAN DEĞİL, BAŞTAN KORUNARAK yapılıyor ve çakışma varsa
 * numaralanıyor. İki tablo aynı sayfa adına düşerse Excel dosyayı açmaz;
 * "yedeğim var" diyen ama açılmayan bir dosya, olmayan yedekten kötüdür.
 */
export const sayfaAdi = (tablo: string, kullanilan: Set<string>): string => {
  let ad = tablo.replace(YASAK_ISARETLER, '_').slice(0, 31)
  if(!kullanilan.has(ad)){ kullanilan.add(ad); return ad }

  for(let i = 2; i < 1000; i += 1){
    const ek = `~${i}`
    const aday = ad.slice(0, 31 - ek.length) + ek
    if(!kullanilan.has(aday)){ kullanilan.add(aday); return aday }
  }
  throw new Error(`Sayfa adı üretilemedi: ${tablo}`)
}

/**
 * Bir hücrenin Excel'e yazılacak hâli.
 *
 * ⚠️ NESNE VE DİZİ JSON METNİNE ÇEVRİLİYOR. `[object Object]` yazmak veriyi
 * YOK ETMEK demektir — denetim kaydındaki `changes` alanı tam olarak böyle
 * bir alandır ve içinde "kim neyi değiştirdi" duruyor.
 *
 * ⚠️ `null` BOŞ HÜCRE, boş metin DEĞİL. Excel'de ikisi aynı görünür ama
 * JSON'a geri çevirirken ayrılabilsin diye null olarak bırakılıyor.
 *
 * ⚠️ Sayılar SAYI olarak gidiyor: metin olsaydı Excel'de toplanamazlardı ve
 * "verimi aldım ama hesap yapamıyorum" olurdu. Ama `numeric` sütunlar
 * PostgREST'ten METİN gelir; sayıya ancak tam olarak sayıysa çevriliyor.
 */
export const hucre = (deger: unknown): string | number | boolean | null => {
  if(deger === null || deger === undefined) return null
  if(typeof deger === 'number') return Number.isFinite(deger) ? deger : String(deger)
  if(typeof deger === 'boolean') return deger
  if(typeof deger === 'string'){
    // ⚠️ Metni sayıya ÇEVİRMİYORUZ — tek istisna yok. "0532..." bir telefon
    // numarasıdır; sayıya çevirirsek baştaki sıfır gider ve numara bozulur.
    // Aynısı lot kodları ve vergi numaraları için de geçerli.
    return deger
  }
  if(deger instanceof Date) return deger.toISOString()
  try { return JSON.stringify(deger) } catch { return String(deger) }
}

/**
 * Bir tablonun sütun sırası.
 *
 * ⚠️ İLK GÖRÜLEN SIRA KORUNUYOR, alfabetik sıralanmıyor. İki dışa aktarım
 * aynı veriden aynı dosyayı üretmeli ki müşteri ikisini karşılaştırabilsin.
 * Ayrıca `id` ve `tenant_id` gibi alanlar doğal olarak başta durur.
 *
 * ⚠️ BÜTÜN SATIRLAR TARANIYOR, ilki değil: bazı satırlarda boş olan bir alan
 * JSON'da hiç görünmeyebilir. Yalnız ilk satıra baksaydık o sütun dosyadan
 * TAMAMEN düşerdi ve kimse fark etmezdi.
 */
export const sutunlar = (satirlar: readonly unknown[]): string[] => {
  const sira: string[] = []
  const gorulen = new Set<string>()
  for(const s of satirlar){
    if(!s || typeof s !== 'object') continue
    for(const k of Object.keys(s as Record<string, unknown>)){
      if(!gorulen.has(k)){ gorulen.add(k); sira.push(k) }
    }
  }
  return sira
}

/**
 * Bir tabloyu sayfaya çevirir.
 *
 * ⚠️ SATIR SINIRI AŞILIRSA BÖLÜNÜYOR, KESİLMİYOR. Excel bir sayfaya ~1 milyon
 * satır alır; büyük bir işletmenin stok defteri bunu aşabilir. Kesmek,
 * "verinizin tamamı burada" sözünü yalan yapardı.
 */
export const tabloyuSayfalara = (
  tablo: string,
  satirlar: readonly unknown[],
  kullanilan: Set<string>,
): Sayfa[] => {
  const basliklar = sutunlar(satirlar)
  // Hiç satırı olmayan tablo da SAYFA OLARAK VAR: "bu tablo boştu" ile
  // "bu tablo dosyaya girmedi" aynı şey değildir.
  if(basliklar.length === 0){
    return [{ ad: sayfaAdi(tablo, kullanilan), basliklar: ['(kayıt yok)'], satirlar: [] }]
  }

  const birSayfada = EXCEL_SATIR_SINIRI - 1   // başlık satırı
  const parcalar: Sayfa[] = []

  for(let bas = 0; bas < Math.max(satirlar.length, 1); bas += birSayfada){
    const dilim = satirlar.slice(bas, bas + birSayfada)
    const ad = parcalar.length === 0 ? tablo : `${tablo}_${parcalar.length + 1}`
    parcalar.push({
      ad: sayfaAdi(ad, kullanilan),
      basliklar,
      satirlar: dilim.map(s => basliklar.map(k => hucre((s as Record<string, unknown>)?.[k]))),
    })
    if(dilim.length < birSayfada) break
  }
  return parcalar
}

// ═══════════════════════════════════════════════════════════════════════════
// OKUBENİ sayfası
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tabloların Türkçe açıklaması.
 *
 * ⚠️ BU LİSTE EKSİK KALABİLİR ve kalması sorun değil: bilinmeyen tablo
 * adıyla yazılır. Ama boş bir açıklama, dosyayı açan kişinin "bu sayfa ne"
 * diye sormasına yol açar — ve o kişi bize soramayacak durumda olabilir
 * (sistemi zaten terk etmiştir).
 */
export const TABLO_ACIKLAMALARI: Record<string, string> = {
  tenant: 'İşletme kaydı',
  company: 'Firma bilgileri',
  branch: 'Şubeler',
  app_user: 'Kullanıcılar',
  user_role: 'Kullanıcıların ek rolleri',
  user_branch_access: 'Kullanıcının erişebildiği şubeler',
  tenant_settings: 'İşletme ayarları — para birimi ve KDV oranı',
  stock_item: 'Stok kartları (ürün ve hammadde tanımları)',
  stock_lot: 'Partiler — parti kodu, son kullanma tarihi, tedarikçi',
  stock_movement: 'STOK DEFTERİ — her giriş ve çıkış. Bakiye bundan hesaplanır.',
  stock_item_allergen: 'Stok kartlarının alerjen beyanı',
  stock_item_nutrition: 'Stok kartlarının besin değeri (100 g)',
  supplier: 'Tedarikçiler',
  purchase_request: 'Satın alma talepleri',
  purchase_request_line: 'Satın alma talebi satırları',
  purchase_order: 'Satın alma siparişleri',
  purchase_order_line: 'Satın alma siparişi satırları',
  goods_receipt: 'Mal kabul belgeleri',
  goods_receipt_line: 'Mal kabul satırları',
  supplier_return: 'Tedarikçiye iadeler',
  supplier_return_line: 'İade satırları',
  recipe: 'Reçeteler',
  recipe_line: 'Reçete satırları (hangi mamule hangi malzeme)',
  work_order: 'Üretim iş emirleri',
  work_order_line: 'İş emri satırları',
  lot_genealogy: 'Lot soyağacı tablosu (MİYOP bunu kullanmaz; zincir stok defterinden türetilir)',
  customer: 'Müşteri kartları',
  delivery_point: 'Müşterilerin teslim noktaları',
  customer_price: 'Sözleşme fiyatları — EKLEMELİ defter, zam yeni satırdır',
  portal_user: 'Müşteri portalı kullanıcıları',
  portal_user_point: 'Portal kullanıcısının görebildiği noktalar',
  vehicle: 'Araç kartları',
  driver: 'Şoför kartları',
  shipment: 'Sevkiyatlar (irsaliyeler)',
  shipment_line: 'Sevkiyat satırları',
  sales_order: 'Müşteri siparişleri',
  order_discrepancy: 'Teslimde çıkan farklar',
  sales_order_revision: 'Sipariş revizyonları — kim, ne zaman, neyi değiştirdi',
  sales_order_line: 'Sipariş satırları (revizyona bağlı)',
  sales_order_event: 'Sipariş olay günlüğü',
  order_approval_step: 'Onay zinciri adım tanımları',
  order_approval: 'Verilen onay kararları',
  haccp_plan: 'HACCP planları',
  haccp_ccp: 'Kritik kontrol noktaları ve limitleri',
  haccp_measurement: 'HACCP ölçümleri — GEÇTİ/KALDI sonucuyla',
  haccp_corrective_action: 'Düzeltici faaliyetler',
  stock_count: 'Sayımlar',
  stock_count_line: 'Sayım satırları',
  witness_sample: 'Şahit numuneler — hangi partiden, hangi koşulda, ne zamana kadar',
  witness_sample_event: 'Numune olayları — alındı / açıldı / imha, gerekçesiyle',
  audit_log: 'DEĞİŞİKLİK KAYDI — kim, ne zaman, neyi değiştirdi',
}

export const tabloAciklamasi = (tablo: string): string =>
  TABLO_ACIKLAMALARI[tablo] ?? '(açıklama yok)'

/**
 * OKUBENİ sayfası — dosyayı açan kişinin ilk göreceği şey.
 *
 * ⚠️ DOSYANIN NE OLMADIĞINI DA SÖYLÜYOR. Bu bir İŞ VERİSİDİR; veritabanı
 * şeması, tetikleyiciler ve giriş hesapları burada DEĞİLDİR. "Her şey
 * burada" demek, sunucuyu geri kuracağını sanan birini yanıltır.
 */
export const okubeniSayfasi = (kunye: DisaAktarmaKunyesi): Sayfa => {
  const satirlar: (string | number | null)[][] = [
    ['MİYOP · VERİ DIŞA AKTARIMI', '', ''],
    ['', '', ''],
    ['Bu dosya işletmenizin MİYOP’taki BÜTÜN İŞ VERİSİNİ içerir.', '', ''],
    ['Her sayfa bir tabloya karşılık gelir. Excel, LibreOffice ve Google', '', ''],
    ['Sheets ile açılır; MİYOP’a ihtiyaç duymaz.', '', ''],
    ['', '', ''],
    ['⚠️ BU DOSYADA OLMAYANLAR: veritabanı şeması, kurallar ve', '', ''],
    ['tetikleyiciler, yetki politikaları, giriş hesapları ve parolalar.', '', ''],
    ['Sunucuyu geri kurmak için bu dosya YETMEZ; o iş için pg_dump gerekir.', '', ''],
    ['', '', ''],
    ['Oluşturma zamanı', kunye.olusturmaZamani, ''],
    ['İşletme kimliği', kunye.kiracıId, ''],
    ['Biçim sürümü', kunye.bicimSurumu, ''],
    ['Toplam satır', kunye.toplamSatir, ''],
  ]

  // ⚠️ EKSİK UYARISI EN ÜSTE DEĞİL, KÜNYENİN HEMEN ALTINA: dosyanın
  // eksik olduğunu okumadan tabloya geçilmesin.
  if(kunye.uyari){
    satirlar.push(['', '', ''])
    satirlar.push(['⚠️ UYARI', kunye.uyari, ''])
    satirlar.push(['Okunamayan tablolar', kunye.eksikTablolar.join(', '), ''])
  }

  satirlar.push(['', '', ''])
  satirlar.push(['SAYFA', 'SATIR', 'NE İÇERİR'])

  for(const t of kunye.tablolar){
    satirlar.push([
      t.tablo,
      t.atlandi ? `— (${t.atlandi})` : t.satir,
      tabloAciklamasi(t.tablo),
    ])
  }

  return { ad: 'OKUBENI', basliklar: [], satirlar }
}

/**
 * Bütün dışa aktarımı sayfalara çevirir.
 *
 * ⚠️ TABLO SIRASI KORUNUYOR (künyedeki sıra): tablolar bağımlılık sırasına
 * göre dizilmiş ve bu sıra geri yüklemede anlamlı.
 */
export const defteriKur = (sonuc: DisaAktarmaSonucu): Sayfa[] => {
  const kullanilan = new Set<string>(['OKUBENI'])
  const sayfalar: Sayfa[] = [okubeniSayfasi(sonuc.kunye)]

  for(const t of sonuc.kunye.tablolar){
    if(t.atlandi) continue
    const satirlar = sonuc.veri[t.tablo] ?? []
    sayfalar.push(...tabloyuSayfalara(t.tablo, satirlar, kullanilan))
  }
  return sayfalar
}

/** Dosya adı — JSON yedeğinden AYRI, karışmasın. */
export const excelDosyaAdi = (kiracıId: string, zaman: Date = new Date()): string => {
  const t = zaman.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `miyop-verilerim-${kiracıId.slice(0, 8)}-${t}.xlsx`
}
