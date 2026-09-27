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

  noktalar(ctx: TenantCtx, musteriId: string): Promise<TeslimNoktasi[]> {
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
