// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C1 — Müşteri servisi
//
// Doğrulama neden burada, formda değil: aynı kurallar yakında sipariş
// ekranından, Excel içe aktarmadan ve portaldan da geçecek. Kuralı forma
// koymak, ikinci giriş yolunda sessizce kaybolması demektir (tedarikçide
// aynı karar verilmişti).
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../core/context'
import { normalizeIdentifier } from '../core/identifier'
import type {
  Fiyat,
  FiyatGirdisi,
  Musteri,
  MusteriDeposu,
  MusteriGirdisi,
  SiparisPenceresi,
  TeslimNoktasi,
  TeslimNoktasiGirdisi,
  PortalKullanicisi, PortalKullanicisiGirdisi,
} from './customer.repository'

export class MusteriDogrulamaError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'MusteriDogrulamaError'
  }
}

/**
 * E-posta için KASTEN gevşek kontrol. Katı bir desen gerçekte geçerli
 * adresleri reddeder ve kullanıcıyı doğru veriyi giremez hâle getirir.
 * Amaç sahtekârlığı önlemek değil, "@" unutulmuş bir yazım hatasını yakalamak.
 */
const EPOSTA_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** HH:MM ya da HH:MM:SS. Veritabanı `time` tipinde tutuyor. */
const SAAT_DESENI = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
const TARIH_DESENI = /^\d{4}-\d{2}-\d{2}$/

const kirp = (deger?: string) => (deger ?? '').trim()

const gunDogrula = (deger: number | undefined, ad: string) => {
  if(deger === undefined) return undefined
  if(!Number.isInteger(deger) || deger < 0){
    throw new MusteriDogrulamaError(`${ad} sıfır veya daha büyük bir tam sayı olmalı.`)
  }
  return deger
}

const saatDogrula = (deger: string | undefined, ad: string) => {
  const s = kirp(deger)
  if(s === '') return undefined
  if(!SAAT_DESENI.test(s)){
    throw new MusteriDogrulamaError(`${ad} SS:DD biçiminde olmalı (örnek 06:00).`)
  }
  return s
}

/**
 * VKN 10, TCKN 11 hane ve yalnız rakam.
 *
 * Neden burada duruyor: yanlış uzunluktaki bir numara ancak FATURA
 * KESİLİRKEN patlar. O an ne müşteri kartını açan kişi oradadır, ne de
 * hatanın nereden geldiği bellidir. Girişte durdurmak ucuz.
 */
export const VERGI_NO_DESENI = /^[0-9]{10,11}$/

const vergiNoDogrula = (d?: string): string | undefined => {
  const v = kirp(d)
  if(v === '') return undefined
  if(!VERGI_NO_DESENI.test(v)){
    throw new MusteriDogrulamaError(
      'Vergi numarası 10 hane (VKN) ya da 11 hane (TCKN) olmalı ve yalnız '
      + 'rakam içermeli.',
    )
  }
  return v
}

/**
 * KEP, firmanın resmî tebligat adresidir — e-posta biçimindedir ama
 * sıradan bir e-posta DEĞİLDİR. Biçimi aynı olduğu için aynı deseni
 * kullanıyoruz; ayrımı kullanıcıya etiket anlatıyor.
 */
const kepDogrula = (d?: string): string | undefined => {
  const v = kirp(d)
  if(v === '') return undefined
  if(!EPOSTA_DESENI.test(v)){
    throw new MusteriDogrulamaError(
      'KEP adresi geçersiz görünüyor (örnek: firma@hs01.kep.tr).',
    )
  }
  return v
}

/**
 * ⚠️ "e-Fatura mükellefi" bayrağı, KONTROL TARİHİ olmadan bir şey ifade
 * etmez: mükellefiyet sonradan başlar, bir yıl önceki "hayır" bugün
 * yanlıştır. Bu yüzden bayrak varsa tarih de zorunlu.
 */
const efaturaDogrula = (girdi: MusteriGirdisi): string | undefined => {
  const t = kirp(girdi.efaturaKontrolTarihi)
  if(girdi.efaturaMukellefi !== undefined && t === ''){
    throw new MusteriDogrulamaError(
      'e-Fatura mükellefiyeti işaretlendiyse kontrol tarihi de girilmeli. '
      + 'Tarihsiz bir bayrak, ne zaman doğru olduğu bilinmeyen bir bilgidir.',
    )
  }
  return t === '' ? undefined : t
}

export class MusteriServisi {
  // ⚠️ DOĞRULAMA YAPAN HER METOT `async` OLMAK ZORUNDA.
  // `dogrula()` senkron fırlatıyor. Metot `async` değilse fırlatma, Promise
  // hiç doğmadan olur: metot reddedilmiş söz döndürmez, doğrudan patlar.
  // O zaman `servis.ekle(...).catch(göster)` yazan çağıran doğrulama
  // hatasını HİÇ GÖRMEZ ve uygulama çöker. `async` senkron fırlatmayı
  // reddedilmiş söze çevirir. Tedarikçi servisinde de böyle.
  constructor(private readonly depo: MusteriDeposu) {}

  hepsi(ctx: TenantCtx): Promise<Musteri[]> {
    return this.depo.hepsi(ctx)
  }

  async ekle(ctx: TenantCtx, girdi: MusteriGirdisi): Promise<Musteri> {
    return this.depo.ekle(ctx, this.dogrula(girdi))
  }

  async guncelle(ctx: TenantCtx, id: string, girdi: MusteriGirdisi): Promise<Musteri> {
    return this.depo.guncelle(ctx, id, this.dogrula(girdi))
  }

  /**
   * Pasife alma — silme DEĞİL.
   *
   * Müşteri silinirse ona kesilmiş irsaliyelerin ve verilmiş siparişlerin
   * geçmişi kopar. Pasif müşteri yeni siparişlerde seçilemez, geçmişte
   * görünmeye devam eder.
   */
  aktiflikDegistir(ctx: TenantCtx, id: string, aktif: boolean): Promise<Musteri> {
    return this.depo.aktiflikDegistir(ctx, id, aktif)
  }

  /** `musteriId` verilmezse kiracının bütün teslim noktaları. */
  noktalar(ctx: TenantCtx, musteriId?: string): Promise<TeslimNoktasi[]> {
    return this.depo.noktalar(ctx, musteriId)
  }

  async noktaEkle(ctx: TenantCtx, girdi: TeslimNoktasiGirdisi): Promise<TeslimNoktasi> {
    return this.depo.noktaEkle(ctx, this.noktaDogrula(girdi))
  }

  async noktaGuncelle(ctx: TenantCtx, id: string, girdi: TeslimNoktasiGirdisi): Promise<TeslimNoktasi> {
    return this.depo.noktaGuncelle(ctx, id, this.noktaDogrula(girdi))
  }

  noktaAktiflikDegistir(ctx: TenantCtx, id: string, aktif: boolean): Promise<TeslimNoktasi> {
    return this.depo.noktaAktiflikDegistir(ctx, id, aktif)
  }

  fiyatlar(ctx: TenantCtx, musteriId: string): Promise<Fiyat[]> {
    return this.depo.fiyatlar(ctx, musteriId)
  }

  async fiyatEkle(ctx: TenantCtx, girdi: FiyatGirdisi): Promise<void> {
    return this.depo.fiyatEkle(ctx, this.fiyatDogrula(girdi))
  }

  gecerliFiyat(ctx: TenantCtx, noktaId: string, kalemId: string, tarih?: string) {
    return this.depo.gecerliFiyat(ctx, noktaId, kalemId, tarih)
  }

  pencere(ctx: TenantCtx, noktaId: string): Promise<SiparisPenceresi> {
    return this.depo.pencere(ctx, noktaId)
  }

  // ── Portal erişimi (0054) ───────────────────────────────────────────────
  portalKullanicilari(ctx: TenantCtx, musteriId: string): Promise<PortalKullanicisi[]> {
    return this.depo.portalKullanicilari(ctx, musteriId)
  }

  async portalErisimiVer(
    ctx: TenantCtx, girdi: PortalKullanicisiGirdisi,
  ): Promise<PortalKullanicisi> {
    return this.depo.portalErisimiVer(ctx, this.portalDogrula(girdi))
  }

  async portalErisimiDegistir(
    ctx: TenantCtx, id: string, aktif: boolean,
  ): Promise<PortalKullanicisi> {
    return this.depo.portalErisimiDegistir(ctx, id, aktif)
  }

  async portalNoktalariAyarla(
    ctx: TenantCtx, id: string, noktaIdler: readonly string[],
  ): Promise<PortalKullanicisi> {
    return this.depo.portalNoktalariAyarla(ctx, id, noktaIdler)
  }

  /**
   * ⚠️ Bu doğrulamada PAROLA YOK ve olmayacak. Giriş e-posta ile tek
   * kullanımlık bağlantıyla oluyor: unutulacak, sızacak, sıfırlanacak bir
   * parola yok. Bu projenin kuralı da aynı — parola hiç istenmez.
   */
  portalDogrula(girdi: PortalKullanicisiGirdisi): PortalKullanicisiGirdisi {
    const eposta = kirp(girdi.eposta).toLowerCase()
    if(kirp(girdi.musteriId) === ''){
      throw new MusteriDogrulamaError('Portal erişimi bir müşteri kartına bağlı olmalı.')
    }
    if(eposta === ''){
      throw new MusteriDogrulamaError(
        'E-posta zorunlu: giriş bu adrese gönderilen bağlantıyla yapılıyor.',
      )
    }
    if(!EPOSTA_DESENI.test(eposta)){
      throw new MusteriDogrulamaError('E-posta adresi geçersiz görünüyor.')
    }
    return {
      ...girdi,
      eposta,
      adSoyad: kirp(girdi.adSoyad) || undefined,
      // Yinelenen nokta kimliği, aynı kısıtı iki kez yazmaya çalışmak olurdu.
      noktaIdler: [...new Set((girdi.noktaIdler ?? []).map(n => kirp(n)).filter(Boolean))],
    }
  }

  dogrula(girdi: MusteriGirdisi): MusteriGirdisi {
    const kod = kirp(girdi.kod)
    const ad = kirp(girdi.ad)
    if(kod === '') throw new MusteriDogrulamaError('Müşteri kodu zorunlu.')
    if(ad === '')  throw new MusteriDogrulamaError('Müşteri adı zorunlu.')

    const eposta = kirp(girdi.eposta)
    if(eposta !== '' && !EPOSTA_DESENI.test(eposta)){
      throw new MusteriDogrulamaError('E-posta adresi geçersiz görünüyor.')
    }

    return {
      ...girdi,
      kod,
      ad,
      eposta: eposta === '' ? undefined : eposta,
      vergiNo: vergiNoDogrula(girdi.vergiNo),
      kepAdresi: kepDogrula(girdi.kepAdresi),
      efaturaKontrolTarihi: efaturaDogrula(girdi),
      vadeGunu: gunDogrula(girdi.vadeGunu, 'Ödeme vadesi'),
      kesimSaati: saatDogrula(girdi.kesimSaati, 'Sipariş kesim saati'),
      teslimGunFarki: gunDogrula(girdi.teslimGunFarki, 'Teslim gün farkı'),
    }
  }

  noktaDogrula(girdi: TeslimNoktasiGirdisi): TeslimNoktasiGirdisi {
    const kod = kirp(girdi.kod)
    const ad = kirp(girdi.ad)
    if(kirp(girdi.musteriId) === '') throw new MusteriDogrulamaError('Teslim noktası bir müşteriye bağlı olmalı.')
    if(kod === '') throw new MusteriDogrulamaError('Teslim noktası kodu zorunlu.')
    if(ad === '')  throw new MusteriDogrulamaError('Teslim noktası adı zorunlu.')

    const bas = saatDogrula(girdi.teslimBaslangic, 'Teslim aralığı başlangıcı')
    const bit = saatDogrula(girdi.teslimBitis, 'Teslim aralığı bitişi')
    if(bas && bit && bit <= bas){
      throw new MusteriDogrulamaError('Teslim aralığının bitişi başlangıcından sonra olmalı.')
    }

    return {
      ...girdi,
      kod,
      ad,
      kesimSaati: saatDogrula(girdi.kesimSaati, 'Sipariş kesim saati'),
      teslimGunFarki: gunDogrula(girdi.teslimGunFarki, 'Teslim gün farkı'),
      teslimBaslangic: bas,
      teslimBitis: bit,
    }
  }

  fiyatDogrula(girdi: FiyatGirdisi): FiyatGirdisi {
    if(kirp(girdi.musteriId) === '') throw new MusteriDogrulamaError('Fiyat bir müşteriye bağlı olmalı.')
    if(kirp(girdi.kalemId) === '')   throw new MusteriDogrulamaError('Fiyat için bir ürün seçilmeli.')
    if(kirp(girdi.birim) === '')     throw new MusteriDogrulamaError('Fiyatın birimi zorunlu (kg, koli, palet…).')
    if(!TARIH_DESENI.test(kirp(girdi.gecerlilikBaslangici))){
      throw new MusteriDogrulamaError('Geçerlilik başlangıcı YYYY-AA-GG biçiminde olmalı.')
    }
    if(!Number.isFinite(girdi.birimFiyat) || girdi.birimFiyat < 0){
      throw new MusteriDogrulamaError('Birim fiyat sıfır veya daha büyük olmalı.')
    }
    // Kaldırma satırı DIŞINDA sıfır fiyat kabul edilmiyor. Sıfır, "bedava"
    // demektir; birisi fiyatı kaldırmak isteyip sıfır yazarsa ürün bedava
    // satılmış görünür. Kaldırmanın kendi kutusu var.
    if(girdi.birimFiyat === 0 && !girdi.kaldirildi){
      throw new MusteriDogrulamaError(
        'Sıfır fiyat "bedava" demektir. Fiyatı kaldırmak istiyorsanız '
        + '"Fiyatı kaldır" seçeneğini işaretleyin.',
      )
    }
    return { ...girdi, birim: kirp(girdi.birim) }
  }
}

/** Arama ve pasif süzmesi. Tedarikçi ekranıyla aynı davranış. */
export const musterileriSuz = (
  hepsi: Musteri[],
  arama: string,
  pasifleriGoster: boolean,
): Musteri[] => {
  const q = normalizeIdentifier(arama)
  return hepsi
    .filter(m => (pasifleriGoster ? true : m.aktif))
    .filter(m => !q || [m.kod, m.ad, m.yetkili ?? '', m.vergiNo ?? '']
      .some(alan => normalizeIdentifier(alan).includes(q)))
}

/**
 * Sipariş penceresini insanın okuyacağı bir cümleye çevirir.
 *
 * ⚠️ Kaynağı GÖSTERMEK şart. Kullanıcı pencerenin müşteri varsayılanından
 * geldiğini görmezse, noktada değişiklik yaptığını sanıp aynı ekrana bakmaya
 * devam eder. "Neden değişmiyor" sorusunun cevabı ekranda yazmalı.
 */
export const pencereyiYaz = (p: SiparisPenceresi): string => {
  if(p.kaynak === 'yok' || (!p.kesimSaati && p.gunFarki === undefined)){
    return 'Sipariş penceresi yok — her saat sipariş girilebilir.'
  }
  // ⚠️ Ek almadan yazıyoruz: "06:00'a" ama "12:00'ye", "10:00'a" — Türkçe
  // ses uyumu okunan SAYIYA bağlı ve saatten türetilemez. Ek koymaya
  // çalışan bir kod, bazı saatlerde hep yanlış yazar. "Kesim 06:00" hem
  // doğru hem kısa.
  const kesim = p.kesimSaati ? `Kesim ${p.kesimSaati.slice(0, 5)}` : 'Saat sınırı yok'
  const gun = p.gunFarki === undefined ? ''
    : p.gunFarki === 0 ? ' · aynı gün teslim'
    : p.gunFarki === 1 ? ' · ertesi gün teslim'
    : ` · ${p.gunFarki} gün sonra teslim`
  const kaynak = p.kaynak === 'nokta' ? 'noktanın kendi penceresi' : 'müşteri varsayılanı'
  return `${kesim}${gun} (${kaynak})`
}

/** Fiyat satırını okunur hâle getirir. Kaldırma satırı fiyat DEĞİLDİR. */
export const fiyatiYaz = (f: Fiyat): string => {
  if(f.kaldirildi) return 'kaldırıldı'
  return `${f.birimFiyat.toLocaleString('tr-TR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })} ${f.paraBirimi} / ${f.birim}`
}

/** Fiyatın kapsamı: nokta adı varsa o, yoksa "bütün noktalar". */
export const fiyatKapsami = (f: Fiyat): string =>
  f.noktaId ? (f.noktaAdi ?? 'teslim noktası') : 'bütün noktalar'


// ── KOD ÜRETİCİLERİ ────────────────────────────────────────────────────────
// Emrah (03.10.2026): *"Müşteri eklerken kod istiyor. O kodu sistem kendi
// üretse daha doğru olmaz mı? Ben müşteri sorduğunda ne diyeceğim?"*
//
// Haklı. Kodun TEK işi kartı tekil kılmak ve belgede kısa bir tutamak
// olmak; müşteriyle konuşulan bir şey değil. Kullanıcıya "bir kod uydur"
// dedirtmek, uydurulmuş kodlar üretir ve iki kart aynı koda yakın yazılınca
// kimse ayıramaz. Sipariş numarasıyla aynı karar: **sistem üretir.**
//
// ⚠️ ALAN KİLİTLENMEDİ. Çok işletmenin eski programından gelen kendi
// müşteri kodu vardır ("35060" gibi) ve taşımak isterler. Kilitleseydik o
// işletme kendi defteriyle bağını koparırdı. Üretilen kod ÖNERİ olarak
// doluyor, isteyen üzerine yazıyor.

const sonrakiSira = (mevcutlar: readonly string[], onek: string): number =>
  mevcutlar
    .filter(k => k.toUpperCase().startsWith(onek.toUpperCase()))
    .map(k => Number(k.slice(onek.length).replace(/\D/g, '')))
    .filter(n => Number.isFinite(n) && n > 0)
    .reduce((a, b) => Math.max(a, b), 0) + 1

/**
 * Sıradaki müşteri kodu: MUS-0001, MUS-0002, …
 *
 * ⚠️ Elle yazılmış kodlar (35060) sayıma KATILMAZ: önekle başlamıyorlar.
 * Katsaydık bir sonraki önerilen kod 35061 olurdu ve iki ayrı kod düzeni
 * birbirine girerdi.
 */
export const sonrakiMusteriKodu = (mevcutlar: readonly string[]): string =>
  `MUS-${String(sonrakiSira(mevcutlar, 'MUS-')).padStart(4, '0')}`

/**
 * Sıradaki teslim noktası kodu: müşteri kodunun altında sıralı — 35060-01.
 *
 * Noktayı müşterisiyle birlikte okunabilir yapıyor: irsaliyede "35060-02"
 * görüldüğünde hangi müşterinin ikinci noktası olduğu belli.
 *
 * ⚠️ Sayım YALNIZCA o müşterinin noktaları içinden yapılır; başka
 * müşterinin noktaları karışırsa numaralar atlar.
 */
export const sonrakiNoktaKodu = (
  musteriKodu: string, mevcutNoktaKodlari: readonly string[],
): string => {
  const onek = `${musteriKodu}-`
  return `${onek}${String(sonrakiSira(mevcutNoktaKodlari, onek)).padStart(2, '0')}`
}
