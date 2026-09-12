// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Mal kabul servisi
//
// Yol haritası maddesi: "Mal kabul → stok girişi"
//          Bitti sayılır ki: "Kabul yapılınca stok kartı ve lot kendiliğinden
//                             oluşuyor"
//
// ── BU DOSYANIN TEK İŞİ ──────────────────────────────────────────────────
// Kabul belgesini deftere BAĞLAMAK. Stoğa yazma işini kendisi YAPMAZ:
// `DepoServisi.malKabul()` çağırır, o da `postMovement()` kapısından geçer.
// Bu ayrım mimari testle korunuyor — bu dosya deftere doğrudan yazmaya
// kalkarsa test kırmızıya döner.
//
// ── SIRA NEDEN BÖYLE: ÖNCE BELGE, SONRA HAREKET ──────────────────────────
// Tarayıcıdan veritabanı işlemi (transaction) açamıyoruz. Üç kalemlik bir
// kabulde üçüncü hareket düşerse, ilk ikisi zaten deftere yazılmış olur.
//
// Çözüm, hareketleri geri almak DEĞİL — geri alma da düşebilir. Çözüm sırayı
// tersine çevirmek:
//   1) Belge TASLAK olarak açılır (satırlar var, hareket yok)
//   2) Her satır tek tek deftere yazılır ve hareket kimliği satıra işlenir
//   3) Hepsi bittiğinde belge İŞLENDİ olarak kapanır
//
// Arada bir hata olursa belge TASLAK kalır; hangi satırın işlendiği satırın
// kendisinde yazılıdır ve tekrar denendiğinde yalnızca eksikler yazılır.
// Ayrıca idempotency anahtarı satır kimliğine sabitlendiği için, aynı satır
// iki kez gönderilse bile defter ikinci kaydı reddeder (I2).
//
// Yarım kalmış bir kabul, ekranda YARIM GÖRÜNÜR. Sessizce tamamlanmış
// görünen ama deftere yarısı düşmüş bir kabulden çok daha iyidir.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../core/context'
import type { DepoServisi } from '../warehouse/warehouse.service'
import type {
  Kabul,
  KabulSatiri,
  MalKabulDeposu,
  YeniKabul,
} from './goods-receipt.repository'
import type { Siparis, SiparisSatiri } from './purchase.types'

export class MalKabulDogrulamaError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'MalKabulDogrulamaError'
  }
}

/** Bir sipariş satırının kabul durumu — ekranda "ne kadarı geldi" sütunu. */
export type SiparisSatirDurumu = {
  satir: SiparisSatiri
  kabulEdilen: number
  reddedilen: number
  kalan: number
  tamamlandi: boolean
}

/**
 * Bir siparişin kalemlerinin kabul durumunu hesaplar.
 *
 * Kabul edilen miktar SAKLANMAZ; her okumada kabul belgelerinden toplanır.
 * Sebebi stok bakiyesiyle aynı (ADR-001): saklanan bir toplam, onu
 * güncellemeyi unutan tek bir kod yoluyla sessizce yanlış hâle gelir.
 */
export const siparisDurumu = (
  siparis: Siparis,
  kabuller: readonly Kabul[],
): SiparisSatirDurumu[] => {
  const ilgili = kabuller.filter(k => k.siparisId === siparis.id && k.durum !== 'CANCELLED')

  return siparis.satirlar.map(satir => {
    const satirlar = ilgili.flatMap(k => k.satirlar).filter(s => s.siparisSatirId === satir.id)
    const kabulEdilen = yuvarla(satirlar.reduce((t, s) => t + s.kabulMiktari, 0))
    const reddedilen = yuvarla(satirlar.reduce((t, s) => t + s.redMiktari, 0))
    const kalan = yuvarla(Math.max(0, satir.miktar - kabulEdilen))

    return { satir, kabulEdilen, reddedilen, kalan, tamamlandi: kalan <= 0 }
  })
}

const yuvarla = (deger: number) => Math.round(deger * 1e6) / 1e6

/** Siparişin tamamı geldi mi, bir kısmı mı? */
export const siparisTeslimDurumu = (
  durumlar: readonly SiparisSatirDurumu[],
): 'PARTIAL' | 'RECEIVED' | null => {
  const hicKabulVar = durumlar.some(d => d.kabulEdilen > 0)
  if(!hicKabulVar) return null
  return durumlar.every(d => d.tamamlandi) ? 'RECEIVED' : 'PARTIAL'
}

export class MalKabulServisi {
  constructor(
    private readonly depo: MalKabulDeposu,
    private readonly depoServisi: DepoServisi,
  ) {}

  hepsi(ctx: TenantCtx): Promise<Kabul[]> {
    return this.depo.hepsi(ctx)
  }

  /**
   * Kabul belgesini açar ve satırlarını deftere işler.
   *
   * `lotBilgisi` çağıranın sorumluluğundadır: lot izleyen bir kalemde lot kodu
   * yoksa defter zaten reddeder (I8). Burada da önden kontrol ediyoruz ki hata
   * mesajı hangi satırda olduğunu söylesin.
   */
  async kabulEt(
    ctx: TenantCtx,
    girdi: YeniKabul,
    lotGerekliMi: (stokKalemiId: string) => boolean,
    sktGerekliMi: (stokKalemiId: string) => boolean,
  ): Promise<Kabul> {
    this.dogrula(girdi, lotGerekliMi, sktGerekliMi)

    // 1) Belge TASLAK olarak açılır. Henüz hiçbir şey deftere düşmedi.
    const taslak = await this.depo.taslakAc(ctx, girdi)

    // 2) Satır satır deftere.
    return this.satirlariIsle(ctx, taslak)
  }

  /**
   * Yarım kalmış bir kabulü tamamlar.
   *
   * Hareketi zaten olan satırlar ATLANIR. Bu, tekrar denemeyi güvenli kılan
   * şeydir: aynı kabul iki kez işlenmeye çalışılsa bile stok iki katına
   * çıkmaz.
   */
  async tekrarDene(ctx: TenantCtx, kabul: Kabul): Promise<Kabul> {
    // `async` olması ŞART. Senkron bir metot `throw` ettiğinde hata çağrının
    // kendisinde patlar, dönen sözde bir "reddedilmiş söz" (rejected promise)
    // oluşmaz. Çağıran taraf `try/catch` yerine `.catch()` kullanıyorsa hatayı
    // hiç göremez — testte tam olarak bu oldu. `async`, senkron `throw`u da
    // reddedilmiş söze çevirir; böylece bu sınıftaki bütün metotlar hatayı
    // AYNI şekilde bildirir.
    if(kabul.durum !== 'DRAFT'){
      throw new MalKabulDogrulamaError('Yalnızca yarım kalmış (taslak) kabuller tekrar denenebilir.')
    }
    return this.satirlariIsle(ctx, kabul)
  }

  private async satirlariIsle(ctx: TenantCtx, kabul: Kabul): Promise<Kabul> {
    for(const satir of kabul.satirlar){
      // Zaten deftere düşmüş satır atlanır — tekrar denemeyi güvenli kılan yer.
      if(satir.hareketId) continue
      // Reddedilen mal depoya girmedi; deftere yazılacak bir şey yok.
      if(satir.kabulMiktari <= 0) continue

      const hareket = await this.depoServisi.malKabul(
        ctx,
        {
          stokKalemiId: satir.stokKalemiId,
          miktar: satir.kabulMiktari,
          birim: satir.birim,
          // Lot kodu verilmişse yeni lot açılır; SKT de buradan taşınır.
          // Kartın kendisi zaten var (sipariş satırı ona bağlı).
          yeniLot: satir.lotKodu
            ? {
              kod: satir.lotKodu,
              sonKullanma: satir.sonKullanma,
              tedarikci: kabul.tedarikciAd,
            }
            : undefined,
          birimMaliyet: satir.birimFiyat > 0 ? satir.birimFiyat : undefined,
          not: `${kabul.kabulNo} mal kabulü`
            + (kabul.irsaliyeNo ? ` · İrsaliye ${kabul.irsaliyeNo}` : '')
            + (kabul.siparisNo ? ` · Sipariş ${kabul.siparisNo}` : ''),
        },
        // Anahtar SATIR KİMLİĞİNE sabitlenmiştir. Aynı satır ikinci kez
        // gönderilirse defter reddeder — miktar iki katına çıkmaz (I2).
        `mk:${satir.id}`,
      )

      await this.depo.satiraHareketBagla(ctx, satir.id, hareket.id)
    }

    return this.depo.islendiIsaretle(ctx, kabul.id)
  }

  private dogrula(
    girdi: YeniKabul,
    lotGerekliMi: (stokKalemiId: string) => boolean,
    sktGerekliMi: (stokKalemiId: string) => boolean,
  ): void {
    if(!girdi.kabulNo.trim()) throw new MalKabulDogrulamaError('Kabul numarası zorunludur.')
    if(!girdi.tedarikciId) throw new MalKabulDogrulamaError('Tedarikçi seçilmelidir.')
    if(girdi.satirlar.length === 0){
      throw new MalKabulDogrulamaError('Mal kabul en az bir kalem içermelidir.')
    }

    girdi.satirlar.forEach((satir, i) => {
      const sira = i + 1
      if(satir.kabulMiktari < 0 || satir.redMiktari < 0){
        throw new MalKabulDogrulamaError(`${sira}. kalemde miktar eksi olamaz.`)
      }
      if(satir.kabulMiktari + satir.redMiktari <= 0){
        throw new MalKabulDogrulamaError(
          `${sira}. kalemde ne kabul ne ret miktarı var. Böyle bir satırın kaydedilecek bir bilgisi yok.`,
        )
      }
      if(satir.redMiktari > 0 && !satir.redNedeni?.trim()){
        // Gerekçesiz ret, tedarikçiyle konuşurken elinde hiçbir şey
        // olmaması demektir.
        throw new MalKabulDogrulamaError(`${sira}. kalemde ret var ama gerekçe yazılmamış.`)
      }
      if(satir.kabulMiktari > 0){
        if(lotGerekliMi(satir.stokKalemiId) && !satir.lotKodu?.trim()){
          throw new MalKabulDogrulamaError(
            `${sira}. kalem lot izliyor: lot/parti numarası zorunludur.`,
          )
        }
        if(sktGerekliMi(satir.stokKalemiId) && !satir.sonKullanma){
          throw new MalKabulDogrulamaError(
            `${sira}. kalem SKT izliyor: son kullanma tarihi zorunludur.`,
          )
        }
      }
    })
  }
}

/**
 * Sipariş satırından kabul satırı taslağı üretir.
 *
 * Miktar KALAN kadar gelir, sipariş miktarı kadar değil: ikinci kez kabul
 * yapılırken varsayılanın sipariş miktarı olması, kullanıcının fazladan
 * kabul etmesine giden en kısa yoldur.
 */
export const kabulSatiriOner = (durum: SiparisSatirDurumu): Omit<
  KabulSatiri, 'id' | 'siraNo' | 'stokKalemiAd' | 'hareketId'
> => ({
  siparisSatirId: durum.satir.id,
  stokKalemiId: durum.satir.stokKalemiId,
  kabulMiktari: durum.kalan,
  redMiktari: 0,
  birim: durum.satir.birim,
  birimFiyat: durum.satir.birimFiyat,
})
