// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · YETKİ ÖZETİ — "bu kişi ne yapabilir?"
//
// Emrah (03.10.2026): *"Kaç yetki gerekiyorsa personel oluştururken onun
// yetkilerini de belirleyebileceğimiz ekran olmalı. Örneğin depodaki adam
// mal çıkarabilsin veya müdür, aşçı mal çıkaramasın… siparişi onaylayanlar
// da böyle olmalı."*
//
// Çerçeve zaten vardı (0014 izin kataloğu · 0015 departman rolleri): rol bir
// izin demetidir, kullanıcı birden çok rol taşıyabilir, etkin yetki hepsinin
// BİRLEŞİMİDİR. Eksik olan, bunun ekranda OKUNABİLİR olmasıydı.
//
// ⚠️ BU DOSYA BİR GÜVENLİK SINIRI DEĞİLDİR. Gerçek koruma veritabanındadır:
// RLS (ADR-004), kolon GRANT'leri (0012), tetikleyiciler (0003/0011) ve
// `assign_user_roles` RPC'si. Buradaki her şey, kullanıcıya "kim neyi
// yapabiliyor" sorusunun cevabını GÖSTERMEK içindir. Tarayıcıdaki bu liste
// elle değiştirilse bile veritabanı tutar.
//
// ⚠️ İZİN KODU ≠ CÜMLE. Katalogdaki açıklamalar teknik ("Stok hareketi ve
// kartlarini yonetme izni"). Buradaki cümleler İŞİN DİLİYLE yazıldı
// ("Depodan mal çıkarabilir"), çünkü bu ekranı okuyan kişi programcı değil,
// işletme sahibi.
// ═══════════════════════════════════════════════════════════════════════════

/** İznin hangi işi açtığı — işletmecinin diliyle. */
export type IzinEtiketi = {
  /** Ekranda hangi başlık altında toplanacağı. */
  alan: string
  /** "… yapabilir" diye okunan cümle. */
  cumle: string
}

/**
 * ⚠️ Bu tablo `permission` tablosunun İNSAN TARAFIDIR. Veritabanına yeni bir
 * izin eklenirse buraya da bir satır gelmeli; gelmezse ekran o izni ham kodu
 * ile gösterir (gizlemez — gizleseydi kullanıcı sahip olduğu bir yetkiyi
 * ekranda göremezdi, bu da yanlış bir güven duygusu olurdu).
 */
export const IZIN_ETIKETLERI: Record<string, IzinEtiketi> = {
  'dashboard.read':    { alan: 'Genel',     cumle: 'Kontrol panelini görür' },
  'stock.read':        { alan: 'Depo',      cumle: 'Stok durumunu ve hareketleri görür' },
  'stock.write':       { alan: 'Depo',      cumle: 'Depoya mal girer ve DEPODAN MAL ÇIKARIR' },
  'purchase.read':     { alan: 'Satın alma', cumle: 'Satın alma talep ve siparişlerini görür' },
  'purchase.write':    { alan: 'Satın alma', cumle: 'Satın alma siparişi açar, tedarikçi yönetir' },
  'production.read':   { alan: 'Üretim',    cumle: 'İş emirlerini görür' },
  'production.write':  { alan: 'Üretim',    cumle: 'İş emri açar, üretim yürütür, hammadde düşer' },
  'recipe.read':       { alan: 'Üretim',    cumle: 'Reçeteleri görür' },
  'recipe.write':      { alan: 'Üretim',    cumle: 'Reçete oluşturur ve değiştirir' },
  'quality.read':      { alan: 'Kalite',    cumle: 'Kalite kayıtlarını, lot ve izlenebilirliği görür' },
  'quality.write':     { alan: 'Kalite',    cumle: 'Kalite kaydı girer, geri çağırma başlatır' },
  /* 0073 — Emrah: "o rol/yetki kime verildiyse o personel yapabilsin".
     Ölçüm girmek ile ETİKETE BASILAN YASAL BEYANI yazmak ayrı iki iş. */
  'quality.declaration':{ alan: 'Kalite', cumle: 'ETİKET BEYANINI yazar (alerjen ve besin değeri)' },
  /* 0081 — ölçüm girmek ile kaydı DÜZELTMEK ayrı iki iş. Fırının
     başındaki kişi ölçer; sapmayı kayıttan düşürmek ve "çözüldü"
     demek kalite kararıdır. */
  'quality.record.manage':{ alan: 'Kalite', cumle: 'Ölçümü İPTAL EDER, düzeltici faaliyeti KAPATIR' },
  'logistics.read':    { alan: 'Sevkiyat',  cumle: 'Sevkiyat ve irsaliyeleri görür' },
  'logistics.write':   { alan: 'Sevkiyat',  cumle: 'Sevkiyat yürütür ve İRSALİYE KESER' },
  'operations.read':   { alan: 'Sipariş',   cumle: 'Sipariş defterini görür' },
  'operations.write':  { alan: 'Sipariş',   cumle: 'Sipariş açar ve revize eder' },
  /* 0061 — onaylamak, açmaktan AYRI bir hak. Önce tek cümleydi
     ("açar, revize eder ve ONAYLAR") ve bölünemiyordu: sipariş açma
     yetkisi veren kişi farkında olmadan onay yetkisini de veriyordu. */
  'operations.approve':{ alan: 'Sipariş',   cumle: 'Onay zincirinde KARAR VERİR (sipariş onaylar)' },
  'products.read':     { alan: 'Ürün',      cumle: 'Ürün kartlarını görür' },
  'products.write':    { alan: 'Ürün',      cumle: 'Ürün kartı oluşturur ve değiştirir' },
  'finance.read':      { alan: 'Para',      cumle: 'Maliyet ve cari bilgilerini görür' },
  'finance.write':     { alan: 'Para',      cumle: 'Finans işlemi yazar' },
  'personnel.read':    { alan: 'Personel',  cumle: 'Personel kayıtlarını görür' },
  'personnel.manage':  { alan: 'Personel',  cumle: 'Personel süreçlerini yönetir' },
  'branch.read':       { alan: 'Şube',      cumle: 'Şube listesini görür' },
  'branch.manage':     { alan: 'Şube',      cumle: 'Şube açar ve yetkilendirir' },
  'company.read':      { alan: 'Yönetim',   cumle: 'Firma bilgilerini görür' },
  'company.manage':    { alan: 'Yönetim',   cumle: 'Firma bilgilerini değiştirir' },
  'users.read':        { alan: 'Yönetim',   cumle: 'Kullanıcıları görür' },
  'users.manage':      { alan: 'Yönetim',   cumle: 'KULLANICI VE YETKİ YÖNETİR' },
  'roles.manage':      { alan: 'Yönetim',   cumle: 'Rol tanımlarını yönetir' },
  'settings.manage':   { alan: 'Yönetim',   cumle: 'İşletme ayarlarını değiştirir' },
  'audit.read':        { alan: 'Yönetim',   cumle: 'Değişiklik kaydını (kim ne yaptı) görür' },
  'platform.read':     { alan: 'Platform',  cumle: 'Platform bilgilerini görür' },
  'platform.manage':   { alan: 'Platform',  cumle: 'Platformu yönetir' },
}

/** Alanların ekranda görüneceği sıra — işin akış sırası, alfabe değil. */
export const ALAN_SIRASI = [
  'Genel', 'Satın alma', 'Depo', 'Üretim', 'Kalite', 'Sipariş', 'Sevkiyat',
  'Ürün', 'Para', 'Personel', 'Şube', 'Yönetim', 'Platform', 'Diğer',
] as const

export const izinEtiketi = (kod: string): IzinEtiketi =>
  IZIN_ETIKETLERI[kod] ?? { alan: 'Diğer', cumle: kod }

/**
 * Bir kullanıcının ETKİN izinleri = birincil rolün izinleri ∪ ek rollerin
 * izinleri (0036'daki kuralın aynısı).
 *
 * ⚠️ Birleşim, kesişim DEĞİL. Küçük bir işletmede bir kişi birden çok şapka
 * takar; "hem depo hem satın alma sorumlusu" olan biri ikisinin de işini
 * yapabilmeli. Kesişim alsaydık ikinci rol vermek yetkiyi AZALTIRDI.
 */
export const etkinIzinler = (
  birincilRol: string,
  ekRoller: readonly string[],
  rolIzinleri: Readonly<Record<string, readonly string[]>>,
): string[] => {
  const kume = new Set<string>()
  for(const rol of [birincilRol, ...ekRoller]){
    if(!rol) continue
    for(const izin of rolIzinleri[rol] ?? []) kume.add(izin)
  }
  return [...kume].sort()
}

export type AlanOzeti = { alan: string; cumleler: string[] }

/**
 * İzinleri ekranda gösterilecek başlıklara böler.
 *
 * ⚠️ Tanınmayan izin GİZLENMİYOR, "Diğer" başlığında ham koduyla çıkıyor.
 * Gizleseydik, kullanıcı sahip olduğu bir yetkiyi ekranda göremezdi — ve
 * görmediği bir yetkiyi kimse geri alamaz.
 */
export const izinleriAlanaGore = (izinler: readonly string[]): AlanOzeti[] => {
  const gruplar = new Map<string, string[]>()
  for(const kod of izinler){
    const e = izinEtiketi(kod)
    const liste = gruplar.get(e.alan) ?? []
    liste.push(e.cumle)
    gruplar.set(e.alan, liste)
  }
  const sira = (a: string) => {
    const i = (ALAN_SIRASI as readonly string[]).indexOf(a)
    return i === -1 ? ALAN_SIRASI.length : i
  }
  return [...gruplar.entries()]
    .map(([alan, cumleler]) => ({ alan, cumleler: [...cumleler].sort() }))
    .sort((a, b) => sira(a.alan) - sira(b.alan) || a.alan.localeCompare(b.alan, 'tr'))
}

export type OnayAdimi = {
  kod: string
  ad: string
  /** true = ONAY (zinciri bloklar), false = GÖRÜŞ. */
  bloklar: boolean
  izinKodu: string
}

export type OnayYetkisi = OnayAdimi & { kararVerebilir: boolean }

/**
 * Sipariş onay zincirinin (0053) hangi adımlarında bu kişi karar verebilir.
 *
 * Emrah'ın *"siparişi onaylayanlar da böyle olmalı"* cümlesinin karşılığı:
 * zincirin adımları bir KİŞİYE değil bir İZNE bağlı. "Satış sorumlusu kimdi"
 * diye sormaya gerek yok — o izni taşıyan karar verir.
 *
 * ⚠️ Karar verememek bir hata değil: zincirin anlamı zaten herkesin her adımı
 * onaylayamamasıdır. Ekran bu yüzden verebildiklerini DE veremediklerini DE
 * gösteriyor; yalnız verebildiklerini gösterseydi, kimin neyi
 * onaylayamadığı görünmezdi.
 */
export const onayYetkileri = (
  izinler: readonly string[], adimlar: readonly OnayAdimi[],
): OnayYetkisi[] => {
  const kume = new Set(izinler)
  return adimlar.map(a => ({ ...a, kararVerebilir: kume.has(a.izinKodu) }))
}

/** "3 adımın 2'sinde karar verebilir · 1'i onay, 1'i görüş" gibi tek cümle. */
export const onayCumlesi = (yetkiler: readonly OnayYetkisi[]): string => {
  if(yetkiler.length === 0) return 'Bu işletmede sipariş onay zinciri tanımlı değil.'
  const verebilir = yetkiler.filter(y => y.kararVerebilir)
  if(verebilir.length === 0) return 'Sipariş onay zincirinde karar veremez.'
  const bloklayan = verebilir.filter(y => y.bloklar).length
  const gorus = verebilir.length - bloklayan
  const parcalar: string[] = []
  if(bloklayan > 0) parcalar.push(`${bloklayan} onay`)
  if(gorus > 0) parcalar.push(`${gorus} görüş`)
  return `${yetkiler.length} adımın ${verebilir.length} tanesinde karar verebilir`
    + ` (${parcalar.join(' · ')}).`
}

/**
 * Kritik yetkiler — ekranda ayrıca vurgulanır.
 *
 * Emrah'ın saydığı üç şey: mal çıkarmak, sipariş onaylamak, irsaliye kesmek.
 * Bunlar "yanlış kişide olursa en pahalıya patlayan" yetkiler.
 */
export const KRITIK_IZINLER = [
  // ⚠️ Sipariş AÇMAK kritik değil, ONAYLAMAK kritik (0061). Siparişi
  // zaten açması beklenen kişiyi her gün uyarmak, uyarıyı değersizleştirir.
  // ⚠️ 0073 — etiket beyanı buraya EKLENDİ. Yanlış alerjen beyanı bu
  // listedeki en pahalı hata: mal çıkışı para kaybettirir, yanlış
  // alerjen beyanı insanı hastaneye düşürür.
  'stock.write', 'operations.approve', 'logistics.write', 'users.manage',
  'quality.declaration',
  // ⚠️ 0081 — düzeltici faaliyeti kapatmak "sorun çözüldü" beyanıdır.
  // Denetimde sorulan ilk şey budur ve yanlış kişideyse HACCP kaydının
  // tamamı tartışmalı hâle gelir.
  'quality.record.manage',
] as const

export const kritikYetkiler = (izinler: readonly string[]): string[] => {
  const kume = new Set(izinler)
  return KRITIK_IZINLER.filter(k => kume.has(k)).map(k => izinEtiketi(k).cumle)
}

// ═══════════════════════════════════════════════════════════════════════════
// TÜMDENGELİM — "önce rol, sonra alan, sonra tek tek iş"
//
// Emrah (03.10.2026): *"Yetki verme ekranlarını tümdengelim şeklinde
// yapalım, depocu seçilince depoda yapabilecekleri açılsın, ordan başka
// bişey seçince yapabilecekleri açılsın vs vs öyle sona kadar gitsin. Aynısı
// muhasebeci, stokcu, nakliyeci vs kimler varsa hepsi için geçerli olsun."*
//
// Yukarıdaki `izinleriAlanaGore` düz bir liste üretiyor: başlık + cümleler.
// Otuz iki izin tek sütuna dizildiğinde okunmuyordu. Aşağıdaki yapı aynı
// veriyi ÜÇ KADEMEYE bölüyor:
//
//     Rol  →  Alan  →  Tek tek yetki
//   depo_sorumlusu → Depo → "Depoya mal girer ve DEPODAN MAL ÇIKARIR"
//
// ⚠️ ZİNCİRİN SONU O CÜMLEDİR. Sistem yetkiyi bundan daha ince bölmüyor:
// `stock.write` tek bir izindir, "mal girişi verebilsin ama çıkış
// veremesin" diye ikiye ayrılmış değil. Ekran bunu söylemek zorunda;
// söylemezse kullanıcı aramadığı bir ayarı arar.
//
// ⚠️ ROL İÇERİĞİ BU EKRANDAN DEĞİŞTİRİLEMEZ. `role_permission` tablosuna
// uygulamanın yalnızca SELECT yetkisi var (0006/0007). Yani "depocuya bir de
// şu izni ver" diye tek izin eklenemez; kişiye ROL eklenir ya da çıkarılır.
// Bu yapı o yüzden bir DÜZENLEYİCİ değil, bir OKUMA ağacıdır — tikleme işi
// rol düzeyinde kalıyor ve ekran nedenini yazıyor.
// ═══════════════════════════════════════════════════════════════════════════

/** İzin bir şeyi GÖRMEYİ mi, YAPMAYI mı açıyor. */
export type YetkiTuru = 'gorur' | 'yapar'

/**
 * ⚠️ Tanınmayan son ek 'yapar' sayılıyor, 'gorur' değil.
 *
 * Yanılma payını hangi yöne bırakacağımız bir karar: bilinmeyen bir izni
 * "yalnız görür" diye göstermek, aslında yazma yetkisi olan birini zararsız
 * gibi sunar. Tersi yalnızca gereksiz dikkat çeker. Pahalı olan hatayı
 * seçmiyoruz.
 */
export const yetkiTuru = (kod: string): YetkiTuru => (
  kod.endsWith('.read') ? 'gorur' : 'yapar'
)

/** Ağacın en alt kademesi: tek bir yetki. */
export type Yetenek = {
  izinKodu: string
  cumle: string
  tur: YetkiTuru
  kritik: boolean
  /**
   * Bu yetkiyi AÇAN roller. Yöneticinin asıl sorusu "bunu neden
   * yapabiliyor" ve "geri almak için neyi çıkaracağım" — kaynak
   * yazılmazsa o soru cevapsız kalıyor.
   */
  kaynakRoller: string[]
}

export type AlanDugumu = {
  alan: string
  yetenekler: Yetenek[]
  /** Kaç tanesi yazma/değiştirme yetkisi. */
  yaparSayisi: number
  kritikSayisi: number
}

const KRITIK_KUMESI = new Set<string>(KRITIK_IZINLER)

const alanSirasi = (alan: string) => {
  const i = (ALAN_SIRASI as readonly string[]).indexOf(alan)
  return i === -1 ? ALAN_SIRASI.length : i
}

/**
 * Bir izni hangi roller açıyor.
 *
 * ⚠️ Birden çok rol aynı izni açabilir. O zaman TEK rolü çıkarmak yetkiyi
 * geri almaz — ekran bu yüzden listenin tamamını gösteriyor. "Depo
 * Sorumlusu'nu çıkardım ama hâlâ mal çıkarıyor" şikâyetinin kaynağı budur.
 */
export const yetkininKaynagi = (
  izinKodu: string,
  roller: readonly string[],
  rolIzinleri: Readonly<Record<string, readonly string[]>>,
): string[] => (
  roller.filter(rol => rol && (rolIzinleri[rol] ?? []).includes(izinKodu))
)

/**
 * İzin listesini alan alan ağaca dizer.
 *
 * `kaynak` verilirse her yetenek hangi rolden geldiğini de taşır. Verilmezse
 * `kaynakRoller` boş kalır — rol kataloğunda kaynak sormak anlamsız, orada
 * rol zaten bellidir.
 */
export const alanAgaci = (
  izinler: readonly string[],
  kaynak?: {
    roller: readonly string[]
    rolIzinleri: Readonly<Record<string, readonly string[]>>
    rolAdlari?: Readonly<Record<string, string>>
  },
): AlanDugumu[] => {
  const gruplar = new Map<string, Yetenek[]>()

  for(const kod of [...new Set(izinler)].sort()){
    const etiket = izinEtiketi(kod)
    const liste = gruplar.get(etiket.alan) ?? []
    liste.push({
      izinKodu: kod,
      cumle: etiket.cumle,
      tur: yetkiTuru(kod),
      kritik: KRITIK_KUMESI.has(kod),
      kaynakRoller: kaynak
        ? yetkininKaynagi(kod, kaynak.roller, kaynak.rolIzinleri)
          .map(rol => kaynak.rolAdlari?.[rol] ?? rol)
        : [],
    })
    gruplar.set(etiket.alan, liste)
  }

  return [...gruplar.entries()]
    .map(([alan, yetenekler]) => ({
      alan,
      // Önce YAPTIKLARI, sonra yalnız gördükleri. Yöneticinin aradığı şey
      // "bu kişi burada ne DEĞİŞTİREBİLİR" — o satır listenin dibinde
      // kalmamalı.
      yetenekler: [...yetenekler].sort((a, b) => (
        (a.tur === b.tur ? 0 : a.tur === 'yapar' ? -1 : 1)
        || (Number(b.kritik) - Number(a.kritik))
        || a.cumle.localeCompare(b.cumle, 'tr')
      )),
      yaparSayisi: yetenekler.filter(y => y.tur === 'yapar').length,
      kritikSayisi: yetenekler.filter(y => y.kritik).length,
    }))
    .sort((a, b) => alanSirasi(a.alan) - alanSirasi(b.alan) || a.alan.localeCompare(b.alan, 'tr'))
}

/** Ağacın en üst kademesi: tek bir rol. */
export type RolDugumu = {
  kod: string
  ad: string
  aciklama: string
  alanlar: AlanDugumu[]
  izinSayisi: number
  kritikSayisi: number
  /** Hiçbir şey değiştiremiyor — denetçi/danışman rolleri böyledir. */
  saltOkur: boolean
}

export type RolTanimi = { code: string; name: string; description?: string }

/**
 * Rol kataloğunu ağaç olarak verir: tümdengelimin birinci kademesi.
 *
 * ⚠️ İzni hiç olmayan rol LİSTEDEN DÜŞÜRÜLMÜYOR. "Bu rolü verdim ama hiçbir
 * şey açılmadı" durumunun kendisi bir bilgi; rolü gizlemek o bilgiyi saklar.
 */
export const rolAgaci = (
  roller: readonly RolTanimi[],
  rolIzinleri: Readonly<Record<string, readonly string[]>>,
): RolDugumu[] => (
  roller.map(rol => {
    const izinler = [...new Set(rolIzinleri[rol.code] ?? [])]
    const alanlar = alanAgaci(izinler)
    return {
      kod: rol.code,
      ad: rol.name || rol.code,
      aciklama: rol.description ?? '',
      alanlar,
      izinSayisi: izinler.length,
      kritikSayisi: alanlar.reduce((t, a) => t + a.kritikSayisi, 0),
      saltOkur: izinler.length > 0 && alanlar.every(a => a.yaparSayisi === 0),
    }
  })
)

/**
 * Rolün tek satırlık özeti.
 *
 * ⚠️ Türkçe hâl eki KULLANILMIYOR ("Depo'da" / "Sipariş'te" ayrı ek alır ve
 * alan adları veritabanından/etiket tablosundan geliyor). Ek üretmeye
 * çalışmak yerine iki ayrı başlık: ne yapıyor, neyi yalnız görüyor.
 */
export const rolCumlesi = (dugum: RolDugumu): string => {
  if(dugum.izinSayisi === 0) return 'Bu rol hiçbir ekranı açmıyor.'
  const yapar = dugum.alanlar.filter(a => a.yaparSayisi > 0).map(a => a.alan)
  const gorur = dugum.alanlar.filter(a => a.yaparSayisi === 0).map(a => a.alan)
  const parcalar: string[] = []
  if(yapar.length > 0) parcalar.push(`İş yapar: ${yapar.join(', ')}`)
  if(gorur.length > 0) parcalar.push(`Yalnız görür: ${gorur.join(', ')}`)
  return parcalar.join(' · ')
}

/**
 * Bir rol TİKLENDİĞİNDE kişiye ne EKLİYOR.
 *
 * Emrah yetki verirken "bu rolü eklesem ne olur" sorusunu soruyor. Rolün tüm
 * içeriğini göstermek bu soruyu cevaplamıyor: izinlerin yarısı kişide zaten
 * olabilir. Ekran bu yüzden FARKI gösteriyor.
 */
export type RolKatkisi = {
  /** Kişide olmayan, bu rolün ekleyeceği yetenekler. */
  yeni: Yetenek[]
  /** Kişide zaten bulunan izin sayısı. */
  zatenVar: number
  /** Eklenecekler arasında kaç kritik yetki var. */
  yeniKritik: number
}

export const rolKatkisi = (
  mevcutIzinler: readonly string[],
  rolunIzinleri: readonly string[],
): RolKatkisi => {
  const mevcut = new Set(mevcutIzinler)
  const rolun = [...new Set(rolunIzinleri)]
  const yeniKodlar = rolun.filter(k => !mevcut.has(k))
  const yeni = alanAgaci(yeniKodlar).flatMap(a => a.yetenekler)
  return {
    yeni,
    zatenVar: rolun.length - yeniKodlar.length,
    yeniKritik: yeni.filter(y => y.kritik).length,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ROL ÖNCE — "bu rolde kimler var"
//
// Emrah (04.10.2026): *"rollere mi kişileri tanımlayalım yoksa kişilere mi rol
// atayalım? … 35-40 kişinin çalıştığı fabrikayı düşün … her rolün
// kullanıcılarını tanımladığımız yetki grupları olsa daha mı iyi olur?"*
//
// Karar: ANA EKRAN ROL ÖNCE. Gerekçe iş yükü: 40 kişilik bir fabrikada ilk
// kurulumu kişi kişi dolaşmak 40 ekran demek; rolü açıp altı kişiyi tiklemek
// bir ekran. Denetim sorusu da ("kimde mal çıkarma var") rol tarafından
// cevaplanıyor.
//
// ⚠️ AMA KİŞİ TARAFI KAPANMIYOR. Bir kişinin etkin yetkisi bütün rollerinin
// BİRLEŞİMİ (0036). Yalnız rol tarafından bakan biri, birini Depo'ya eklerken
// onun ayrıca Muhasebe ve Sevkiyat'ta da olduğunu göremez. "Bu kişi TOPLAMDA
// ne yapabiliyor" sorusunun tek cevabı kişi kartıdır — bu yüzden rol
// kartındaki her isim kişi kartına açılıyor.
//
// ⚠️ İKİ TÜR ÜYELİK VAR ve ayrı davranıyorlar:
//   BİRİNCİL (`app_user.role_code`) → `set_primary_role` (0060) ile değişir
//   EK       (`user_role`)          → `assign_user_roles` (0015) ile değişir
// Ekran ikisini AYRI gösteriyor; aynı liste gibi gösterseydik "çıkar"
// düğmesinin neden bazı satırlarda çalışmadığı anlaşılmazdı.
// ═══════════════════════════════════════════════════════════════════════════

export type RolUyesi = {
  id: string
  ad: string
  /** true = bu rol kişinin ANA GÖREVİ; `user_role`dan çıkarılamaz. */
  birincil: boolean
  aktif: boolean
}

export type UyelikKaynagi = {
  id: string
  fullName: string
  username: string
  primaryRoleCode: string
  isActive: boolean
}

/**
 * Bir rolü taşıyan kişiler.
 *
 * ⚠️ Pasif kullanıcı LİSTEDEN DÜŞMÜYOR, "pasif" diye işaretleniyor. Gizleseydik
 * yönetici, yetkisi duran ama girişi kapalı bir hesabı hiç görmezdi; hesap
 * yeniden açıldığında eski yetkileriyle geri gelirdi.
 */
export const rolUyeleri = (
  rolKodu: string,
  kullanicilar: readonly UyelikKaynagi[],
  ekAtamalar: Readonly<Record<string, readonly string[]>>,
): RolUyesi[] => (
  kullanicilar
    .filter(k => k.primaryRoleCode === rolKodu || (ekAtamalar[k.id] ?? []).includes(rolKodu))
    .map(k => ({
      id: k.id,
      ad: k.fullName || k.username,
      birincil: k.primaryRoleCode === rolKodu,
      aktif: k.isActive,
    }))
    .sort((a, b) => (Number(b.birincil) - Number(a.birincil)) || a.ad.localeCompare(b.ad, 'tr'))
)

/** Role henüz eklenmemiş kişiler — "kişi ekle" listesi. */
export const roleEklenebilirler = (
  rolKodu: string,
  kullanicilar: readonly UyelikKaynagi[],
  ekAtamalar: Readonly<Record<string, readonly string[]>>,
): UyelikKaynagi[] => {
  const uyeler = new Set(rolUyeleri(rolKodu, kullanicilar, ekAtamalar).map(u => u.id))
  return kullanicilar
    .filter(k => !uyeler.has(k.id))
    .slice()
    .sort((a, b) => (a.fullName || a.username).localeCompare(b.fullName || b.username, 'tr'))
}

/**
 * Kişinin EK rol listesine bir rol ekler / listeden çıkarır.
 *
 * ⚠️ `assign_user_roles` TAM DEĞİŞİM yapar: gönderilen liste yeni gerçektir.
 * Bu yüzden "ekle" bile kişinin TÜM listesini yeniden göndermek zorunda.
 * Farkı gönderseydik, gönderilmeyen roller silinirdi.
 */
export const rolEklenmis = (mevcut: readonly string[], rolKodu: string): string[] =>
  mevcut.includes(rolKodu) ? [...mevcut] : [...mevcut, rolKodu]

export const rolCikarilmis = (mevcut: readonly string[], rolKodu: string): string[] =>
  mevcut.filter(r => r !== rolKodu)

/**
 * Ana görevi değişen kişide ESKİ rol ek rol olarak duruyor mu?
 *
 * `set_primary_role` (0060) ek rollere bilerek dokunmuyor. Sessizce silseydi
 * yönetici, bilerek verdiği bir ek rolü kaybederdi. Ama hiç söylemezsek de
 * "Hasan'ı sevkiyata aldım, hâlâ depodan mal çıkarıyor" şikâyeti doğar.
 * Ekran bu yüzden durumu SÖYLÜYOR — bu yardımcı o cümlenin koşulu.
 */
export const anaGorevDegisinceKalanRol = (
  eskiRolKodu: string,
  ekRoller: readonly string[],
): string | null => (
  eskiRolKodu && ekRoller.includes(eskiRolKodu) ? eskiRolKodu : null
)
