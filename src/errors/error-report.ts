// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 — Hata bildirimi
//
// Bir hata üç yerden gelir:
//   1. React bir ekranı çizerken çöker        → ErrorBoundary  ('crash')
//   2. Kod bir hatayı yakalar ama raporlar     → bildir()       ('error')
//   3. Hiç kimse yakalamaz                     → window olayı   ('unhandled')
//
// Üçünün de tek çıkışı var: HataDefteri. Bugünkü tek uygulaması Postgres
// (0030). Sentry gerekirse aynı arayüzü uygulayan ikinci bir sınıf olur;
// çağıran taraf değişmez.
//
// ── ÜÇ KURAL ──────────────────────────────────────────────────────────────
// 1. HATA BİLDİRMEK YENİ HATA ÜRETMEZ. Defter yazamazsa sessizce vazgeçilir.
//    Aksi halde bir hata, hata bildirirken hata çıkarıp sonsuz döngü yapar.
// 2. AYNI HATA BİR KEZ YAZILIR. Döngü içinde çöken bir ekran saniyede
//    yüzlerce satır yazabilir. Parmak izi + susma süresi bunu keser.
// 3. KİŞİSEL VERİ TEMİZLENİR. Yığın izinde e-posta, telefon, jeton
//    bulunabilir. Yazmadan önce maskelenir.
// ═══════════════════════════════════════════════════════════════════════════

export type HataTuru = 'crash' | 'error' | 'unhandled'

export type HataKaydi = {
  tur: HataTuru
  mesaj: string
  yigin?: string
  yol?: string
  tarayici?: string
  parmakIzi: string
  ek?: Record<string, unknown>
}

/**
 * ⚠️ Kiracı ve kullanıcı PARAMETRE DEĞİL. Postgres defteri onları
 * veritabanının kolon varsayılanından alıyor (0030) — gönderen taraf
 * kiracıyı yazamasın diye. İleride Sentry defteri eklenirse o da aynı
 * imzayı uygular.
 */
export interface HataDefteri {
  yaz(kayit: HataKaydi): Promise<void>
}

/** Mesaj sınırı. Uzun mesaj okunmaz, sadece tabloyu şişirir. */
export const MESAJ_SINIRI = 500
/** Yığın sınırı. İlk birkaç çerçeve sorunu söyler; gerisi gürültü. */
export const YIGIN_SINIRI = 4000
/** Aynı parmak izi bu süre içinde tekrar yazılmaz. */
export const TEKRAR_SESSIZLIGI_MS = 60_000
/** Bir oturumda en fazla bu kadar hata yazılır. Sonsuz döngü kalkanı. */
export const OTURUM_SINIRI = 50

// ── Kişisel veri temizliği ────────────────────────────────────────────────
// Tam bir çözüm değil, olamaz da: yığın izinin içinde ne olacağını önceden
// bilemeyiz. Ama en sık üç sızıntıyı kapatır. Eksikliği bilinen bir sınır,
// saklanan bir sınır değil.
const EPOSTA = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const UZUN_SAYI = /\d{10,}/g
const JETON = /\beyJ[\w-]{10,}\.[\w-]+\.?[\w-]*/g

export const kisiselVeriyiTemizle = (metin: string): string =>
  metin
    .replace(EPOSTA, '(e-posta)')
    .replace(JETON, '(jeton)')
    .replace(UZUN_SAYI, '(sayı)')

// ── Parmak izi ────────────────────────────────────────────────────────────
// Amaç: "aynı hata" sorusunu cevaplamak. Aynı hata her seferinde farklı
// kimlik, satır sayısı ve zaman taşır; onlar çıkarılmadan iki kayıt asla
// eşleşmez ve "bu hata 40 kez oldu" hiç görülmez.
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

const normalize = (metin: string): string =>
  metin.replace(UUID, '#').replace(/\d+/g, '#').trim().toLowerCase()

/** djb2. Kriptografik değil; sadece kısa ve kararlı bir etiket üretir. */
const hashle = (metin: string): string => {
  let h = 5381
  for(let i = 0; i < metin.length; i++){
    h = ((h << 5) + h + metin.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

/** Yığının ilk anlamlı çerçevesi. Hatanın DOĞDUĞU yer. */
export const ilkCerceve = (yigin?: string): string => {
  if(!yigin) return ''
  const satirlar = yigin.split('\n').map(s => s.trim()).filter(Boolean)
  return satirlar.find(s => s.startsWith('at ')) ?? satirlar[1] ?? ''
}

export const parmakIzi = (mesaj: string, yigin?: string): string =>
  hashle(`${normalize(mesaj)}|${normalize(ilkCerceve(yigin))}`)

// ── Kayıt üretme ──────────────────────────────────────────────────────────

const kirp = (metin: string, sinir: number): string =>
  metin.length <= sinir ? metin : `${metin.slice(0, sinir)}…`

export type BildirimBaglami = {
  tur?: HataTuru
  yol?: string
  tarayici?: string
  ek?: Record<string, unknown>
}

/**
 * Hatadan yazılabilir bir kayıt üretir.
 *
 * `hata` gerçekten `Error` olmak zorunda değil — JavaScript'te `throw 'metin'`
 * de yasaldır ve olur. Bu yüzden her şeyi kabul ediyoruz; aksi halde hata
 * bildiricinin kendisi çökerdi (Kural 1).
 */
export const hataKaydiYap = (
  hata: unknown, baglam: BildirimBaglami = {},
): HataKaydi => {
  const gercek = hata instanceof Error
  const hamMesaj = gercek
    ? `${hata.name}: ${hata.message}`
    : typeof hata === 'string' ? hata : JSON.stringify(hata) ?? 'bilinmeyen hata'
  const hamYigin = gercek ? hata.stack : undefined

  // ⚠️ Sıra önemli: ÖNCE maskele, SONRA parmak izini al.
  // Ham metinden alsaydık, "ali@x.com icin kayit yok" ile
  // "veli@y.com icin kayit yok" iki ayrı hata sayılırdı; oysa bu tek bir
  // hatadır ve gruplanması gerekir. Maskeleme hem kişisel veriyi kaldırıyor
  // hem de gruplamayı düzeltiyor.
  const temizMesaj = kisiselVeriyiTemizle(hamMesaj || 'bilinmeyen hata')
  const temizYigin = hamYigin ? kisiselVeriyiTemizle(hamYigin) : undefined

  return {
    tur: baglam.tur ?? 'error',
    mesaj: kirp(temizMesaj, MESAJ_SINIRI),
    yigin: temizYigin ? kirp(temizYigin, YIGIN_SINIRI) : undefined,
    yol: baglam.yol,
    tarayici: baglam.tarayici,
    // Kırpılmamış metinden: kırpma sınırı değişince parmak izi kaymasın.
    parmakIzi: parmakIzi(temizMesaj, temizYigin),
    ek: baglam.ek,
  }
}

// ── Bildirici ─────────────────────────────────────────────────────────────

/** Bellekte tutan defter. Testler ve defter yoksa kullanılır. */
export class BellekHataDefteri implements HataDefteri {
  readonly kayitlar: HataKaydi[] = []
  async yaz(kayit: HataKaydi): Promise<void> { this.kayitlar.push(kayit) }
}

/** Hep başarısız olan defter. Kural 1'in testi için. */
export class BozukHataDefteri implements HataDefteri {
  async yaz(): Promise<void> { throw new Error('defter yazamadı') }
}

export type BildiriciSecenekleri = {
  simdi?: () => number
  /** Konsola da yazsın mı. Geliştirmede evet, testte hayır. */
  konsol?: (mesaj: string, ayrinti?: unknown) => void
}

/**
 * Hataları deftere yazan katman. Susturma ve sayaç burada.
 *
 * Neden ayrı bir sınıf: susturma kararı defterin işi değil. Postgres defteri
 * de, Sentry defteri de aynı susturmadan faydalanmalı.
 */
export class HataBildirici {
  private readonly gorulen = new Map<string, number>()
  private yazilan = 0
  private readonly simdi: () => number
  private readonly konsol?: (mesaj: string, ayrinti?: unknown) => void

  constructor(
    private readonly defter: HataDefteri,
    secenek: BildiriciSecenekleri = {},
  ) {
    this.simdi = secenek.simdi ?? (() => Date.now())
    this.konsol = secenek.konsol
  }

  /** Kaç hata deftere yazıldı. Testler ve tanı için. */
  get yaziliAdet(): number { return this.yazilan }

  /**
   * Hatayı bildirir ve kaydın referans numarasını döndürür.
   *
   * Referans numarası (parmak izi) kullanıcıya gösterilebilir: "bir şey ters
   * gitti, referans a1b2c3". Böylece kullanıcı yığın izi görmeden bize
   * hangi hatayı gördüğünü söyleyebilir.
   *
   * ⚠️ ASLA fırlatmaz. Kural 1.
   */
  async bildir(
    hata: unknown, baglam: BildirimBaglami = {},
  ): Promise<string> {
    let kayit: HataKaydi
    try {
      kayit = hataKaydiYap(hata, baglam)
    } catch {
      // Kaydı üretirken bile çökebiliriz (döngüsel nesne vb.).
      return 'yok'
    }

    if(this.yazilan >= OTURUM_SINIRI){ return kayit.parmakIzi }

    const oncekiZaman = this.gorulen.get(kayit.parmakIzi)
    const an = this.simdi()
    if(oncekiZaman !== undefined && an - oncekiZaman < TEKRAR_SESSIZLIGI_MS){
      return kayit.parmakIzi
    }
    this.gorulen.set(kayit.parmakIzi, an)

    this.konsol?.(`[MİYOP hata ${kayit.parmakIzi}] ${kayit.mesaj}`, kayit.yigin)

    try {
      await this.defter.yaz(kayit)
      this.yazilan += 1
    } catch(defterHatasi) {
      // Kural 1: FIRLATMIYORUZ — hata bildirmek yeni hata üretmez.
      //
      // ⚠️ Ama SESSİZ de kalmıyoruz. İlk yazdığımda burası tamamen boştu ve
      // canlı denemede tam bu yüzden taşa çarptık: hata üretildi, konsola
      // düştü, tabloya yazılamadı ve NEDENİ hiçbir yerde görünmedi.
      // Yutulan hatanın izi kalmazsa, çalışmayan bir katman çalışıyor
      // görünür. Bu da "...mış gibi yapmak"tır.
      this.konsol?.(
        `[MİYOP hata ${kayit.parmakIzi}] DEFTERE YAZILAMADI`, defterHatasi,
      )
    }
    return kayit.parmakIzi
  }
}
