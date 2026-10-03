// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C2 — Sipariş defteri servisi
//
// Kurallar serviste, formda DEĞİL: aynı kurallardan portal (A4C3) ve Excel
// aktarımı da geçecek.
//
// ⚠️ SON SÖZ VERİTABANINDA. Buradaki kontroller, kullanıcıya İYİ BİR MESAJ
// vermek için var; kuralı uygulayan 0050'nin tetikleri. Sunucudan gelen
// MI403/MI422/MI425 bir hata değil, savunmanın çalıştığının kanıtıdır.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../core/context'
import type {
  Fark, FarkKarariGirdisi, Onay, OnayAdimi, Revizyon, Siparis, SiparisDeposu,
  SiparisDurumu, SiparisOlayi, SiparisSatiri, YeniFark, YeniOnay, YeniRevizyon,
  YeniSiparis, YeniSatir,
} from './sales-order.repository'
import type { KalemSevkDurumu } from './sales-order-shipment'
import type { KarsilamaSatiri } from './sales-order-production'
import type { TeslimFarkiSatiri } from './sales-order-delivery'

export class SiparisDogrulamaError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'SiparisDogrulamaError'
  }
}

const kirp = (d?: string) => (d ?? '').trim()

/**
 * Durum akışı — 0050'deki tetiğin AYNISI.
 *
 * ⚠️ Kural iki yerde duruyor ve iki yerde duran kural ayrışır. O yüzden
 * `sales-order.service.test.ts` bu tabloyu GÖÇTEN okuyup karşılaştırıyor
 * (`siparisGecisleriGocten`). Biri değişip diğeri kalırsa test kırmızıya
 * döner. Ekranın bu tabloya ihtiyacı var: hangi düğmeyi göstereceğini
 * bilmesi gerekiyor.
 */
export const IZINLI_GECISLER: Record<SiparisDurumu, SiparisDurumu[]> = {
  // ⚠️ Taslak → Onaylandı KAPALI (0053). Emrah: "Kesinlikle sipariş onay
  // zincirine tabi olmalı." Bir istisna bırakırsak zincir, acelesi olan
  // herkesin atladığı bir süs olur.
  'Taslak':        ['Onay Bekliyor', 'İptal'],
  // Geri çekme serbest: onay sırasında müşteri fikrini değiştirebilir ve
  // siparişi düzeltmek, iptal edip yenisini açmaktan dürüsttür.
  'Onay Bekliyor': ['Onaylandı', 'Taslak', 'İptal'],
  // ⚠️ ONAYA GERİ DÖNÜŞ (0055). Onaylanmış bir siparişe MİKTAR revizyonu
  // yazılırsa onaylar düşer ve sipariş buraya geri döner — yoksa üretim,
  // kimsenin onaylamadığı bir miktarı hazırlamaya devam ederdi.
  'Onaylandı':     ['Hazırlanıyor', 'Onay Bekliyor', 'İptal'],
  'Hazırlanıyor':  ['Hazır', 'Onay Bekliyor', 'İptal'],
  'Hazır':         ['Kısmi Sevk', 'Sevk Edildi', 'Onay Bekliyor', 'İptal'],
  'Kısmi Sevk':    ['Sevk Edildi', 'Teslim Edildi'],
  'Sevk Edildi':   ['Kısmi Sevk', 'Teslim Edildi'],
  // Son duraklar. İptalden dönüş YENİ SİPARİŞLE olur, durumu geri
  // çevirerek değil — iptalin izi kalsın.
  'Teslim Edildi': [],
  'İptal':         [],
}

/** Sevkiyata çıkmış sayılan durumlar: miktar revizyonu artık farka bağlı. */
export const SEVK_SONRASI: SiparisDurumu[] = ['Kısmi Sevk', 'Sevk Edildi', 'Teslim Edildi']

export class SiparisServisi {
  // ⚠️ Doğrulama yapan her metot `async` (tuzak 41): değilse senkron
  // fırlatma Promise doğmadan olur ve `.catch()` yazan çağıran hatayı
  // hiç görmez.
  constructor(private readonly depo: SiparisDeposu) {}

  hepsi(ctx: TenantCtx): Promise<Siparis[]> { return this.depo.hepsi(ctx) }
  guncelSatirlar(ctx: TenantCtx, id: string): Promise<SiparisSatiri[]> {
    return this.depo.guncelSatirlar(ctx, id)
  }
  revizyonlar(ctx: TenantCtx, id: string): Promise<Revizyon[]> {
    return this.depo.revizyonlar(ctx, id)
  }
  farklar(ctx: TenantCtx, id: string): Promise<Fark[]> { return this.depo.farklar(ctx, id) }
  onayAdimlari(ctx: TenantCtx): Promise<OnayAdimi[]> { return this.depo.onayAdimlari(ctx) }
  onaylar(ctx: TenantCtx, id: string): Promise<Onay[]> { return this.depo.onaylar(ctx, id) }

  async onayVer(ctx: TenantCtx, girdi: YeniOnay): Promise<void> {
    return this.depo.onayVer(ctx, this.onayDogrula(girdi))
  }

  onayDogrula(girdi: YeniOnay): YeniOnay {
    if(girdi.karar === 'Olumsuz' && kirp(girdi.not) === ''){
      throw new SiparisDogrulamaError(
        'Olumsuz karar gerekçesiz olamaz. Gerekçesiz bir ret, satışçının '
        + 'müşteriye söyleyecek sözü olmaması demektir.',
      )
    }
    if(girdi.karar === 'Şartlı' && kirp(girdi.sozTarihi) === ''){
      throw new SiparisDogrulamaError(
        'Şartlı onayda söz verilen tarih zorunlu. Şartı olmayan bir şartlı '
        + 'onay, "belki" demektir ve müşteriye söylenemez.',
      )
    }
    return { ...girdi, not: kirp(girdi.not) || undefined,
             sozTarihi: kirp(girdi.sozTarihi) || undefined }
  }
  olaylar(ctx: TenantCtx, id: string): Promise<SiparisOlayi[]> { return this.depo.olaylar(ctx, id) }
  /** Kalem kalem: sipariş / sevk edilmiş / KALAN (0051). */
  sevkDurumu(ctx: TenantCtx, id: string): Promise<KalemSevkDurumu[]> {
    return this.depo.sevkDurumu(ctx, id)
  }
  /** Kalem kalem: depodan ne kadar, üretimden ne kadar (0056). */
  karsilamaPlani(ctx: TenantCtx, id: string): Promise<KarsilamaSatiri[]> {
    return this.depo.karsilamaPlani(ctx, id)
  }
  /** Kalem kalem: ne istendi · ne hazırlandı · ne gitti (0058). */
  teslimFarki(ctx: TenantCtx, id: string): Promise<TeslimFarkiSatiri[]> {
    return this.depo.teslimFarki(ctx, id)
  }

  async ekle(ctx: TenantCtx, girdi: YeniSiparis): Promise<Siparis> {
    return this.depo.ekle(ctx, this.siparisDogrula(girdi))
  }

  async durumDegistir(
    ctx: TenantCtx, siparis: Siparis, yeni: SiparisDurumu,
  ): Promise<Siparis> {
    if(!IZINLI_GECISLER[siparis.durum].includes(yeni)){
      throw new SiparisDogrulamaError(
        `Sipariş "${siparis.durum}" durumundan "${yeni}" durumuna geçemez.`,
      )
    }
    return this.depo.durumDegistir(ctx, siparis.id, yeni)
  }

  async revizyonEkle(
    ctx: TenantCtx, siparis: Siparis, girdi: YeniRevizyon,
  ): Promise<void> {
    return this.depo.revizyonEkle(ctx, this.revizyonDogrula(siparis, girdi))
  }

  async farkAc(ctx: TenantCtx, girdi: YeniFark): Promise<Fark> {
    return this.depo.farkAc(ctx, this.farkDogrula(girdi))
  }

  async farkiKararaBagla(
    ctx: TenantCtx, farkId: string, girdi: FarkKarariGirdisi,
  ): Promise<Fark> {
    if(girdi.karar === 'Sorumlu Bulundu' && !kirp(girdi.sorumluId)){
      throw new SiparisDogrulamaError(
        '"Sorumlu Bulundu" kararı için sorumlu kişi seçilmelidir. '
        + 'Sorumlusu adı olmayan bir sorumluluk, kimseye bir şey ödetmez.',
      )
    }
    if(kirp(girdi.kararNotu) === ''){
      throw new SiparisDogrulamaError(
        'Karar notu zorunlu: ne oldu, nasıl çözüldü. Notsuz bir karar, '
        + 'altı ay sonra kimsenin hatırlamayacağı bir karardır.',
      )
    }
    return this.depo.farkiKararaBagla(ctx, farkId, girdi)
  }

  siparisDogrula(girdi: YeniSiparis): YeniSiparis {
    const no = kirp(girdi.siparisNo)
    if(no === '') throw new SiparisDogrulamaError('Sipariş numarası zorunlu.')
    if(kirp(girdi.musteriId) === ''){
      throw new SiparisDogrulamaError('Sipariş bir müşteri kartına bağlı olmalı.')
    }
    if(girdi.sevkTarihi && girdi.teslimTarihi && girdi.teslimTarihi < girdi.sevkTarihi){
      throw new SiparisDogrulamaError('Teslim tarihi, sevk tarihinden önce olamaz.')
    }
    return { ...girdi, siparisNo: no, satirlar: satirlariDogrula(girdi.satirlar) }
  }

  revizyonDogrula(siparis: Siparis, girdi: YeniRevizyon): YeniRevizyon {
    if(kirp(girdi.gerekce) === ''){
      throw new SiparisDogrulamaError(
        'Revizyon gerekçesi zorunlu. Gerekçesi olmayan değişiklik, sonradan '
        + 'sahibi olmayan değişikliktir.',
      )
    }

    if(girdi.tur === 'LOJISTIK'){
      if(girdi.satirlar && girdi.satirlar.length > 0){
        throw new SiparisDogrulamaError(
          'Lojistik revizyonu satır taşımaz. Miktar değişecekse MİKTAR '
          + 'revizyonu açılmalı.',
        )
      }
      const degisen = girdi.noktaId !== undefined
        || girdi.sevkTarihi !== undefined
        || girdi.teslimTarihi !== undefined
      if(!degisen){
        throw new SiparisDogrulamaError(
          'Lojistik revizyonunda en az bir teslim bilgisi değişmeli: '
          + 'teslim noktası, sevk tarihi ya da teslim tarihi.',
        )
      }
      return girdi
    }

    // MİKTAR revizyonu
    if(SEVK_SONRASI.includes(siparis.durum) && !kirp(girdi.farkId)){
      throw new SiparisDogrulamaError(
        'Sevk edilmiş siparişin miktarı serbestçe değiştirilemez — istenen '
        + 'mal zaten üretilip yola çıktı. Önce bir fark kaydı açın, '
        + 'incelensin, kararı bu revizyona bağlayın. Teslim noktası ya da '
        + 'tarih değişecekse LOJİSTİK revizyonu kullanın.',
      )
    }
    if(!girdi.satirlar || girdi.satirlar.length === 0){
      throw new SiparisDogrulamaError(
        'Miktar revizyonu satırsız olamaz. Siparişin yeni hâli, bu '
        + 'revizyonun satırlarıdır — boş bırakmak siparişi silmek olurdu.',
      )
    }
    return { ...girdi, satirlar: satirlariDogrula(girdi.satirlar) }
  }

  farkDogrula(girdi: YeniFark): YeniFark {
    if(kirp(girdi.siparisId) === ''){
      throw new SiparisDogrulamaError('Fark kaydı bir siparişe bağlı olmalı.')
    }
    if(kirp(girdi.aciklama) === ''){
      throw new SiparisDogrulamaError(
        'Fark açıklaması zorunlu: ne fark ettiniz. Açıklaması olmayan bir '
        + 'bayrak, incelenemeyen bir bayraktır.',
      )
    }
    if(girdi.miktar !== undefined && !(girdi.miktar > 0)){
      throw new SiparisDogrulamaError('Fark miktarı sıfırdan büyük olmalı.')
    }
    return { ...girdi, aciklama: kirp(girdi.aciklama) }
  }
}

const satirlariDogrula = (satirlar: YeniSatir[]): YeniSatir[] => {
  if(satirlar.length === 0){
    throw new SiparisDogrulamaError('Sipariş en az bir kalem içermeli.')
  }
  const gorulen = new Set<string>()
  satirlar.forEach((s, i) => {
    const sira = i + 1
    if(kirp(s.kalemId) === ''){
      throw new SiparisDogrulamaError(`${sira}. satırda ürün seçilmemiş.`)
    }
    if(!(s.miktar > 0)){
      throw new SiparisDogrulamaError(`${sira}. satırın miktarı sıfırdan büyük olmalı.`)
    }
    if(kirp(s.birim) === ''){
      // Yol haritası: "firmanın kendi belgesindeki birimle giriliyor".
      // Birimsiz bir miktar, hangi büyüklükte olduğu bilinmeyen bir sayıdır.
      throw new SiparisDogrulamaError(`${sira}. satırın birimi zorunlu (palet, koli, kg…).`)
    }
    if(gorulen.has(s.kalemId)){
      throw new SiparisDogrulamaError(
        `${sira}. satırdaki ürün siparişte zaten var. İki satır toplanmaz, `
        + 'biri diğerini gizler.',
      )
    }
    gorulen.add(s.kalemId)
  })
  return satirlar.map(s => ({ ...s, birim: kirp(s.birim) }))
}

/** Arama ve durum süzmesi. */
export const siparisleriSuz = (
  hepsi: Siparis[], arama: string, durum: SiparisDurumu | 'hepsi',
): Siparis[] => {
  const q = arama.trim().toLocaleLowerCase('tr-TR')
  return hepsi
    .filter(s => durum === 'hepsi' ? true : s.durum === durum)
    .filter(s => !q || [s.siparisNo, s.musteriAdi ?? '', s.noktaAdi ?? '']
      .some(a => a.toLocaleLowerCase('tr-TR').includes(q)))
}

/**
 * İki revizyon arasında NE DEĞİŞTİ.
 *
 * Değişiklik geçmişi ekranının kalbi: "200 kg → 150 kg" cümlesini üreten
 * şey bu. Ekranda ham iki liste göstermek, kullanıcıya farkı kendi
 * bulmasını söylemek olurdu.
 */
export type SatirFarki = {
  kalemId: string
  kalemAdi?: string
  onceki?: number
  sonraki?: number
  birim: string
  tur: 'eklendi' | 'çıkarıldı' | 'değişti'
}

export const revizyonFarki = (
  onceki: SiparisSatiri[], sonraki: SiparisSatiri[],
): SatirFarki[] => {
  const farklar: SatirFarki[] = []
  const oncekiHarita = new Map(onceki.map(s => [s.kalemId, s]))
  const sonrakiHarita = new Map(sonraki.map(s => [s.kalemId, s]))

  for(const s of sonraki){
    const o = oncekiHarita.get(s.kalemId)
    if(!o){
      farklar.push({ kalemId: s.kalemId, kalemAdi: s.kalemAdi, sonraki: s.miktar, birim: s.birim, tur: 'eklendi' })
    } else if(o.miktar !== s.miktar){
      farklar.push({ kalemId: s.kalemId, kalemAdi: s.kalemAdi, onceki: o.miktar, sonraki: s.miktar, birim: s.birim, tur: 'değişti' })
    }
  }
  for(const o of onceki){
    if(!sonrakiHarita.has(o.kalemId)){
      farklar.push({ kalemId: o.kalemId, kalemAdi: o.kalemAdi, onceki: o.miktar, birim: o.birim, tur: 'çıkarıldı' })
    }
  }
  return farklar
}

/** "200 kg → 150 kg" · "+ 50 koli" · "− 20 kg" */
export const farkiYaz = (f: SatirFarki): string => {
  const s = (n?: number) => (n ?? 0).toLocaleString('tr-TR')
  if(f.tur === 'eklendi')   return `+ ${s(f.sonraki)} ${f.birim}`
  if(f.tur === 'çıkarıldı') return `− ${s(f.onceki)} ${f.birim}`
  return `${s(f.onceki)} ${f.birim} → ${s(f.sonraki)} ${f.birim}`
}

/**
 * Sipariş numarası üreticisi — sevkiyat, satın alma ve iş emriyle aynı kural.
 *
 * ── NİÇİN SİSTEM ÜRETİYOR (Emrah kararı 28.09) ───────────────────────────
 * Avantajı: kullanıcı numara düşünmüyor, elle yazılan numaralar birbirine
 * karışmıyor ("SIP-1" / "sip 1" / "SİP-01" aynı sipariş sanılmaz), sıra
 * takibi kendiliğinden doğru.
 *
 * Dezavantajı ve nasıl kapattığımız: iki kişi aynı anda sipariş açarsa ikisi
 * de aynı numarayı önerir. Veritabanı tekillik kısıtı ikincisini REDDEDER —
 * doğru davranış, sessizce aynı numarayı iki siparişe vermekten iyi. Ekran
 * bu reddi görünce numarayı yeniden hesaplayıp BİR KEZ daha deniyor
 * (`siparisNoCakistiMi`). İkinci kez de çakışırsa kullanıcıya söylüyor:
 * o noktada gerçekten eşzamanlı bir yoğunluk var ve tahmin etmek yerine
 * sormak doğru.
 */
export const sonrakiSiparisNo = (
  mevcutlar: readonly string[], yil = new Date().getFullYear(),
): string => {
  const onek = `SIP-${yil}-`
  const enBuyuk = mevcutlar
    .filter(no => no.startsWith(onek))
    .map(no => Number(no.slice(onek.length)))
    .filter(n => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0)
  return `${onek}${String(enBuyuk + 1).padStart(4, '0')}`
}

/** Numara çakışması mı? Ekran bir kez daha denemek için buna bakıyor. */
export const siparisNoCakistiMi = (hata: unknown): boolean =>
  hata instanceof Error && hata.name === 'SiparisNoCakismasiError'

// ── Onay zinciri · saf mantık (0053) ───────────────────────────────────────
// Ekran da, portal da (A4C3) bu hesabı kullanacak. İki yerde yazılırsa
// ayrışır ve biri "onaylandı" derken diğeri "bekliyor" der.

export type AdimDurumu = {
  adim: OnayAdimi
  /** Bu revizyon için SON karar. Eklemeli defterde son satır geçerlidir. */
  sonKarar?: Onay
  /** Bloklayan adım mı ve henüz olumlu bir karar yok mu. */
  bekliyor: boolean
}

/**
 * Zincirin şu andaki hâli.
 *
 * ⚠️ `revizyonNo` ZORUNLU ve hesabın kalbi burada: 200 koliyi onaylamak,
 * 350 koliyi onaylamak değildir. Sipariş revize edilince eski kararlar
 * kendiliğinden düşer.
 */
export const onayDurumu = (
  adimlar: readonly OnayAdimi[],
  onaylar: readonly Onay[],
  revizyonNo: number,
): AdimDurumu[] =>
  [...adimlar]
    .filter(a => a.aktif)
    .sort((a, b) => a.sira - b.sira)
    .map(adim => {
      const buAdim = onaylar
        .filter(o => o.adimKodu === adim.kod && o.revizyonNo === revizyonNo)
        .sort((a, b) => a.zaman.localeCompare(b.zaman))
      const sonKarar = buAdim[buAdim.length - 1]
      const olumlu = sonKarar?.karar === 'Olumlu' || sonKarar?.karar === 'Şartlı'
      const d: AdimDurumu = { adim, bekliyor: adim.bloklar && !olumlu }
      if(sonKarar) d.sonKarar = sonKarar
      return d
    })

/** Zincir tamam mı — 0053'teki `app.siparis_onayi_tam()` ile AYNI kural. */
export const onayTamamMi = (durumlar: readonly AdimDurumu[]): boolean =>
  durumlar.every(d => !d.bekliyor)

/** Ekranın üst şeridindeki tek cümle. */
export const onayOzeti = (durumlar: readonly AdimDurumu[]): string => {
  if(durumlar.length === 0) return 'Onay zinciri kurulmamış.'
  const bekleyen = durumlar.filter(d => d.bekliyor).map(d => d.adim.ad)
  if(bekleyen.length > 0) return `Bekleyen onay: ${bekleyen.join(', ')}`
  const olumsuz = durumlar.filter(d => d.sonKarar?.karar === 'Olumsuz')
  if(olumsuz.length > 0){
    return `Zincir tamam, ama olumsuz görüş var: ${olumsuz.map(d => d.adim.ad).join(', ')}`
  }
  return 'Zincir tamam — sipariş onaylanabilir.'
}

/**
 * Müşteriye söz verilen tarih: bu revizyonun kararlarındaki EN GEÇ tarih.
 *
 * En erkeni almak, tutamayacağımız bir tarihi müşteriye söylemek olurdu.
 * 0053'teki tetik de aynı hesabı yapıyor.
 */
export const sozVerilenTarih = (
  onaylar: readonly Onay[], revizyonNo: number,
): string | undefined => {
  const tarihler = onaylar
    .filter(o => o.revizyonNo === revizyonNo && o.sozTarihi)
    .map(o => o.sozTarihi as string)
    .sort()
  return tarihler[tarihler.length - 1]
}

/** "Müşteri 02.10 istedi, biz 05.10 dedik" — gecikme var mı. */
export const sozGecikmesi = (siparis: Siparis): number | undefined => {
  if(!siparis.teslimTarihi || !siparis.sozVerilenTarih) return undefined
  const gun = 86400000
  const fark = (new Date(`${siparis.sozVerilenTarih}T00:00:00`).getTime()
    - new Date(`${siparis.teslimTarihi}T00:00:00`).getTime()) / gun
  return Math.round(fark)
}
