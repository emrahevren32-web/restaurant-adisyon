// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 / Güven katmanı — Sayım servisi
//
// Yol haritası maddeleri:
//   "Fiziksel sayım → fark hareketi"  → Üstüne yazma yok, fark ayrı kayıt
//   "Sayım kilidi"                    → Sayım sırasında hareket girilemiyor
//
// ── ÜÇ KURAL ─────────────────────────────────────────────────────────────
// 1. DEFTERE FARK YAZILIR, SAYILAN DEĞİL. Defter değişimleri saklar, mutlak
//    değerleri değil (ADR-001/I1). "40 kg saydım" bilgisi nota geçer.
// 2. SAYILMAYAN SATIR SIFIR DEĞİLDİR. Sayılmamış bir satır uygulanmaz;
//    sıfır sayılırsa bütün mal zayi yazılırdı. Ayrım `undefined` ile korunuyor.
// 3. FARK SIFIRSA HAREKET YOK. Değişmeyen şey için satır açmak dökümü
//    gürültüyle doldurur ve gerçek farkları gizler.
//
// ── KİLİT NEREDE ─────────────────────────────────────────────────────────
// Bu serviste DEĞİL. Kilit veritabanında bir tetikleyici (0025). Buradaki
// kod yalnızca durumu değiştirir; hareketi engelleyen şey defterin kendisi.
// Uygulama katmanındaki bir kontrol, o kontrolü çağırmayan her yol için
// yoktur — kilidin anlamı budur.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../core/context'
import type { Movement } from '../core/stock/stock.repository'
import type { DepoServisi } from './warehouse.service'
import {
  SAYIM_GECISLERI,
  type Sayim,
  type SayimDeposu,
  type SayimDurumu,
  type SayimSatiri,
  type YeniSayim,
  type YeniSayimSatiri,
} from './stock-count.repository'

/**
 * Sayım başlatılırken defterden okunacak iki şey.
 *
 * İkisi de KİLİTTEN SONRA çağrılır; bu yüzden servise iş olarak değil
 * ÇAĞRILABİLİR olarak veriliyor. Servis defteri doğrudan tanısaydı okumayı
 * kilitten önce yapma riski hep açık kalırdı.
 */
export type SayimBaslatmaKaynagi = {
  /** Bir satırın defterdeki güncel bakiyesi (lotluysa lottan, değilse kalemden). */
  bakiye(satir: SayimSatiri): Promise<number>
  /** Bir kalemin TÜM lotları ve bakiyeleri — listede olmayan lot var mı diye. */
  lotlar(stokKalemiId: string): Promise<Array<{ lotId: string; miktar: number }>>
}

export class SayimDogrulamaError extends Error {
  constructor(mesaj: string) { super(mesaj); this.name = 'SayimDogrulamaError' }
}

export class GecersizSayimGecisiError extends Error {
  constructor(mevcut: SayimDurumu, istenen: SayimDurumu) {
    super(`Sayım "${mevcut}" durumundan "${istenen}" durumuna geçemez.`)
    this.name = 'GecersizSayimGecisiError'
  }
}

/** Bir satırın farkı. Sayılmamışsa `null` — sıfır farkla karıştırılmasın. */
export const satirFarki = (satir: SayimSatiri): number | null => {
  if(satir.sayilan === undefined) return null
  const fark = Math.round((satir.sayilan - satir.beklenen) * 1000) / 1000
  // ⚠️ `-0` normalleştiriliyor. Kayan nokta 0,3 − (0,1 + 0,2) hesabında eksi
  // sıfır üretir; `fark === 0` bunu yakalar ama ekrana ve nota "-0" olarak
  // düşerdi. Kullanıcının "eksi sıfır fark" diye bir kavramı yok.
  return fark === 0 ? 0 : fark
}

/**
 * Bir satırın farkı "yazım hatası gibi mi" duruyor?
 *
 * ── Neden gerekli ─────────────────────────────────────────────────────────
 * Ekran Türkçe biçimle yazıyor: 93,237 kg. Kullanıcı bunu okuyup kutuya
 * "93237" yazarsa fark 93.137 kg çıkar — bin katı. Deftere yazılırsa depo
 * saçmalar ve append-only olduğu için ancak ters kayıtla düzeltilir.
 *
 * Bu yüzden ondalık ayracını da düzelttik (kutu artık virgül kabul ediyor)
 * AMA tek başına yetmez: sıfır ekleyerek yapılan yazım hatası her zaman
 * mümkün. Bu işaret kullanıcıyı uyarır.
 *
 * ── Neden ENGELLEMİYOR ────────────────────────────────────────────────────
 * Gerçek büyük farklar olur: bir palet kaybolur, bir lot yanlış kaleme
 * yazılmıştır. Sayımın işi zaten gerçeği söylemek. Engellemek, doğru olanı
 * yazamamak demek olurdu. Sadece "emin misin" diye sorulur.
 *
 * Eşik 10 KAT: makul bir sayım hatası (yüzde onlar) altında kalır; ondalık
 * ayracı hatası (bin kat) her zaman üstünde çıkar.
 */
export const supheliFark = (satir: SayimSatiri): boolean => {
  const fark = satirFarki(satir)
  if(fark === null || fark === 0) return false
  // Defterde sıfır olan bir kalemde "10 kat" ölçülemez; oradaki her giriş
  // zaten dikkat çeker, ayrıca işaretlemeye gerek yok.
  if(satir.beklenen <= 0) return false
  return Math.abs(fark) >= satir.beklenen * 10
}

export type SayimOzeti = {
  toplam: number
  sayilan: number
  sayilmayan: number
  /** Farkı sıfır olmayan satır sayısı. */
  farkli: number
  fazla: number
  eksik: number
  /** Bütün satırlar sayıldı mı? */
  tamam: boolean
  /** Yazım hatası gibi duran satır sayısı — uygulamayı engellemez, uyarır. */
  supheli: number
}

export const sayimOzeti = (sayim: Sayim): SayimOzeti => {
  const farklar = sayim.satirlar.map(satirFarki)
  const sayilan = farklar.filter(f => f !== null).length
  return {
    toplam: sayim.satirlar.length,
    sayilan,
    sayilmayan: sayim.satirlar.length - sayilan,
    farkli: farklar.filter(f => f !== null && f !== 0).length,
    fazla: farklar.filter(f => f !== null && f > 0).length,
    eksik: farklar.filter(f => f !== null && f < 0).length,
    tamam: sayilan === sayim.satirlar.length && sayim.satirlar.length > 0,
    supheli: sayim.satirlar.filter(supheliFark).length,
  }
}

export class SayimServisi {
  constructor(
    private readonly depo: SayimDeposu,
    private readonly depoServisi: DepoServisi,
  ) {}

  hepsi(ctx: TenantCtx): Promise<Sayim[]> { return this.depo.hepsi(ctx) }
  tekil(ctx: TenantCtx, id: string): Promise<Sayim> { return this.depo.tekil(ctx, id) }
  acikOlanlar(ctx: TenantCtx): Promise<Sayim[]> { return this.depo.acikOlanlar(ctx) }

  async ekle(ctx: TenantCtx, girdi: YeniSayim): Promise<Sayim> {
    const no = girdi.sayimNo.trim()
    if(!no) throw new SayimDogrulamaError('Sayım numarası zorunludur.')
    if(girdi.satirlar.length === 0){
      throw new SayimDogrulamaError('Sayım en az bir kalem içermelidir.')
    }
    return this.depo.ekle(ctx, { ...girdi, sayimNo: no })
  }

  /**
   * Sayımı başlatır.
   *
   * ── SIRA ÖNEMLİ: ÖNCE KİLİT, SONRA FOTOĞRAF ────────────────────────────
   * Beklenen miktarlar belge oluşturulurken de yazılıyor ama o rakam bayat
   * olabilir: taslak üç gün bekleyip bu arada mal girip çıkabilir. Bu yüzden
   * başlatırken defterden TAZELENİYOR.
   *
   * Ve tazeleme kilitten SONRA yapılıyor. Ters sırada yapsaydık — önce oku,
   * sonra kilitle — okuma ile kilit arasında yazılan bir hareket fotoğrafın
   * dışında kalır, sayım o kadar sapardı. Kilit önce devreye girdiği için
   * okunan rakamın değişme ihtimali kalmıyor.
   */
  async baslat(
    ctx: TenantCtx,
    sayim: Sayim,
    kaynak: SayimBaslatmaKaynagi,
  ): Promise<Sayim> {
    this.gecisiDogrula(sayim, 'OPEN')
    if(sayim.satirlar.length === 0){
      throw new SayimDogrulamaError('Satırsız sayım başlatılamaz.')
    }

    // 1 · Kilit
    const acik = await this.depo.durumDegistir(ctx, sayim.id, 'OPEN')

    // 2 · Fotoğraf — artık değişemez
    const taze: Array<{ satirId: string; beklenen: number }> = []
    for(const satir of acik.satirlar){
      taze.push({ satirId: satir.id, beklenen: await kaynak.bakiye(satir) })
    }
    await this.depo.beklenenleriYaz(ctx, taze)

    // 3 · Sonradan doğan lotlar
    const eklenecek = await this.yeniLotlariBul(acik, kaynak)
    if(eklenecek.length > 0) await this.depo.satirEkle(ctx, sayim.id, eklenecek)

    return this.depo.tekil(ctx, sayim.id)
  }

  /**
   * Belge açıldıktan SONRA, kilit kurulmadan önceki pencerede doğmuş lotları
   * bulur.
   *
   * ── Neden gerekli ─────────────────────────────────────────────────────
   * Satırlar belge hazırlanırken, o anki lotlara göre oluşuyor. Belge taslak
   * beklerken depoya yeni bir parti girerse o lot listede olmaz. Kilit
   * kurulduktan sonra yeni lot doğamaz — yani açık olan tek pencere
   * "hazırlandı ama başlatılmadı" aralığı. Bu satır onu kapatıyor.
   *
   * ── Neden yalnızca lot takipli kalemler ───────────────────────────────
   * Lotsuz kalemin tek satırı vardır ve o satırın beklenen miktarı zaten
   * yukarıda tazelendi; keşfedilecek bir şey yok.
   *
   * ── Neden bakiyesi sıfır olan lot atlanıyor ───────────────────────────
   * İçinde mal olmayan lot sayılmaz. Rafta olmayan bir şeyi kullanıcıya
   * "say" diye göstermek, sayımı gereksiz uzatır ve "sayılmadı" uyarısını
   * anlamsızlaştırır.
   */
  private async yeniLotlariBul(
    acik: Sayim, kaynak: SayimBaslatmaKaynagi,
  ): Promise<YeniSayimSatiri[]> {
    // Yalnızca lot takipli kalemler: en az bir satırında lot olan kalemler.
    const lotluKalemler = [...new Set(
      acik.satirlar.filter(s => s.lotId).map(s => s.stokKalemiId),
    )]
    const bilinenLotlar = new Set(acik.satirlar.map(s => s.lotId).filter(Boolean) as string[])

    const eklenecek: YeniSayimSatiri[] = []
    for(const kalemId of lotluKalemler){
      const birim = acik.satirlar.find(s => s.stokKalemiId === kalemId)?.birim ?? ''
      for(const lot of await kaynak.lotlar(kalemId)){
        if(bilinenLotlar.has(lot.lotId)) continue
        if(lot.miktar <= 0) continue
        eklenecek.push({
          stokKalemiId: kalemId, lotId: lot.lotId, beklenen: lot.miktar, birim,
        })
      }
    }
    return eklenecek
  }

  async sayilaniYaz(
    ctx: TenantCtx, sayim: Sayim, satirId: string, sayilan: number, not?: string,
  ): Promise<void> {
    if(sayim.durum !== 'OPEN'){
      throw new SayimDogrulamaError(
        'Yalnızca süren bir sayıma sonuç yazılabilir.',
      )
    }
    if(!Number.isFinite(sayilan) || sayilan < 0){
      throw new SayimDogrulamaError('Sayılan miktar negatif olamaz.')
    }
    await this.depo.sayilaniYaz(ctx, satirId, sayilan, not)
  }

  /**
   * Girilmiş sonucu geri alır — satır "sayılmadı"ya döner.
   *
   * Sıfır ile boş AYRI şeyler: 0 "aradım, bulamadım" demektir ve deftere
   * geçer; boş ise "henüz saymadım" demektir ve uygulamayı durdurur.
   * Kullanıcının yanlışlıkla yazdığı rakamı 0'a çevirmesi, aradaki farkı
   * yok eder. Bu yüzden geri alma ayrı bir işlem.
   */
  async sayilaniSil(ctx: TenantCtx, sayim: Sayim, satirId: string): Promise<void> {
    if(sayim.durum !== 'OPEN'){
      throw new SayimDogrulamaError(
        'Yalnızca süren bir sayımda sonuç geri alınabilir.',
      )
    }
    await this.depo.sayilaniSil(ctx, satirId)
  }

  /**
   * Farkları deftere yazar ve sayımı kapatır.
   *
   * ⚠️ SAYILMAMIŞ SATIR VARSA UYGULANMAZ. "Sayılmadı"yı sıfır kabul etmek,
   * sayılmayan her kalemi zayi yazmak demektir — sessizce yapılabilecek en
   * pahalı hata bu olurdu.
   */
  async uygula(
    ctx: TenantCtx, sayim: Sayim,
  ): Promise<{ sayim: Sayim; hareketler: Movement[] }> {
    this.gecisiDogrula(sayim, 'APPLIED')

    const ozet = sayimOzeti(sayim)
    if(ozet.sayilmayan > 0){
      throw new SayimDogrulamaError(
        `${ozet.sayilmayan} satır henüz sayılmadı. Sayılmamış satır sıfır `
        + 'kabul edilmez; ya sayın ya da satırı çıkarın.',
      )
    }

    const hareketler: Movement[] = []
    for(const satir of sayim.satirlar){
      const fark = satirFarki(satir)
      if(fark === null || fark === 0) continue

      // Deftere yazan tek kapı yine `DepoServisi`. Sayım kendi hareketini
      // yazmıyor; sayım da bir belge, defter yine defter (ADR-001).
      const hareket = await this.depoServisi.sayimFarki(ctx, {
        stokKalemiId: satir.stokKalemiId,
        lotId: satir.lotId,
        fark,
        birim: satir.birim,
        sayimId: sayim.id,
        not: `${sayim.sayimNo}: sayılan ${satir.sayilan} ${satir.birim}, `
          + `defterde ${satir.beklenen} ${satir.birim}`,
      }, `sayim:${satir.id}`)

      hareketler.push(hareket)
      await this.depo.satiraHareketBagla(ctx, satir.id, hareket.id)
    }

    const guncel = await this.depo.durumDegistir(ctx, sayim.id, 'APPLIED')
    return { sayim: guncel, hareketler }
  }

  /** İptal: deftere hiçbir şey yazılmaz, kilit kalkar. */
  async iptalEt(ctx: TenantCtx, sayim: Sayim): Promise<Sayim> {
    this.gecisiDogrula(sayim, 'CANCELLED')
    return this.depo.durumDegistir(ctx, sayim.id, 'CANCELLED')
  }

  private gecisiDogrula(sayim: Sayim, istenen: SayimDurumu): void {
    if(!SAYIM_GECISLERI[sayim.durum].includes(istenen)){
      throw new GecersizSayimGecisiError(sayim.durum, istenen)
    }
  }
}

/** Belge numarası üreticisi — diğer belgelerle aynı kural. */
export const sonrakiSayimNo = (
  mevcutlar: readonly string[], yil = new Date().getFullYear(),
): string => {
  const onek = `SAY-${yil}-`
  const enBuyuk = mevcutlar
    .filter(no => no.startsWith(onek))
    .map(no => Number(no.slice(onek.length)))
    .filter(n => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0)
  return `${onek}${String(enBuyuk + 1).padStart(4, '0')}`
}
