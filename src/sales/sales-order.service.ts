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
  Fark, FarkKarariGirdisi, Revizyon, Siparis, SiparisDeposu, SiparisDurumu,
  SiparisOlayi, SiparisSatiri, YeniFark, YeniRevizyon, YeniSiparis, YeniSatir,
} from './sales-order.repository'

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
  'Taslak':        ['Onaylandı', 'İptal'],
  'Onaylandı':     ['Hazırlanıyor', 'İptal'],
  'Hazırlanıyor':  ['Hazır', 'İptal'],
  'Hazır':         ['Kısmi Sevk', 'Sevk Edildi', 'İptal'],
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
  olaylar(ctx: TenantCtx, id: string): Promise<SiparisOlayi[]> { return this.depo.olaylar(ctx, id) }

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
