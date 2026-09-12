// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Tedarikçi servisi
//
// Doğrulama neden burada, formda değil: aynı kurallar Excel içe aktarma ve
// (sıradaki madde) satın alma siparişi ekranından da geçecek. Kuralı forma
// koymak, üçüncü giriş yolunda sessizce kaybolması demektir.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../core/context'
import { normalizeIdentifier } from '../core/identifier'
import type {
  Tedarikci,
  TedarikciDeposu,
  TedarikciGirdisi,
} from './supplier.repository'

export class TedarikciDogrulamaError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'TedarikciDogrulamaError'
  }
}

/**
 * E-posta için KASTEN gevşek bir kontrol.
 *
 * Katı bir desen, gerçekte geçerli adresleri reddeder (RFC 5322'ye tam uyan bir
 * düzenli ifade pratikte yazılamaz) ve kullanıcıyı doğru veriyi giremez hâle
 * getirir. Buradaki amaç sahtekârlığı önlemek değil, "@" unutulmuş bir yazım
 * hatasını yakalamak.
 */
const EPOSTA_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const kirp = (deger?: string) => (deger ?? '').trim()

export class TedarikciServisi {
  constructor(private readonly depo: TedarikciDeposu) {}

  hepsi(ctx: TenantCtx): Promise<Tedarikci[]> {
    return this.depo.hepsi(ctx)
  }

  async ekle(ctx: TenantCtx, girdi: TedarikciGirdisi): Promise<Tedarikci> {
    return this.depo.ekle(ctx, this.dogrula(girdi))
  }

  async guncelle(ctx: TenantCtx, id: string, girdi: TedarikciGirdisi): Promise<Tedarikci> {
    return this.depo.guncelle(ctx, id, this.dogrula(girdi))
  }

  /**
   * Pasife alma — silme DEĞİL.
   *
   * Tedarikçi silinirse ondan alınmış partilerin geçmişi kopar. Geri çağırma
   * tam olarak o geçmişe dayanıyor: "bu partiyi kimden aldık, başka nereye
   * gitti". Ürünün asıl sattığı şey bu; silme düğmesi onu tek tıkla yok eder.
   * Pasif tedarikçi yeni siparişlerde seçilemez, geçmişte görünmeye devam eder.
   */
  aktiflikDegistir(ctx: TenantCtx, id: string, aktif: boolean): Promise<Tedarikci> {
    return this.depo.aktiflikDegistir(ctx, id, aktif)
  }

  private dogrula(girdi: TedarikciGirdisi): TedarikciGirdisi {
    const kod = kirp(girdi.kod)
    const ad = kirp(girdi.ad)

    if(!kod) throw new TedarikciDogrulamaError('Tedarikçi kodu zorunludur.')
    if(!ad) throw new TedarikciDogrulamaError('Tedarikçi adı zorunludur.')

    // Boşluk ve büyük/küçük harf farkı tekilliği delerdi: "ET-01" ile "et 01"
    // veritabanında iki ayrı kayıt olurdu ve toplamları ayrışırdı.
    if(!normalizeIdentifier(kod)){
      throw new TedarikciDogrulamaError('Tedarikçi kodu yalnızca boşluktan oluşamaz.')
    }

    const eposta = kirp(girdi.eposta)
    if(eposta && !EPOSTA_DESENI.test(eposta)){
      throw new TedarikciDogrulamaError(`"${eposta}" geçerli bir e-posta adresine benzemiyor.`)
    }

    return {
      kod,
      ad,
      vergiNo: kirp(girdi.vergiNo) || undefined,
      yetkili: kirp(girdi.yetkili) || undefined,
      telefon: kirp(girdi.telefon) || undefined,
      eposta: eposta || undefined,
      adres: kirp(girdi.adres) || undefined,
      not: kirp(girdi.not) || undefined,
    }
  }
}

/**
 * Ekranın liste süzgeci.
 *
 * Arama hem koda hem ada hem yetkiliye bakıyor: depo sorumlusu tedarikçiyi
 * kodla değil, "Mehmet Bey'in firması" diye hatırlar.
 */
export const tedarikcileriSuz = (
  hepsi: Tedarikci[],
  arama: string,
  pasifleriGoster: boolean,
): Tedarikci[] => {
  const q = normalizeIdentifier(arama)
  return hepsi
    .filter(t => (pasifleriGoster ? true : t.aktif))
    .filter(t => !q || [t.kod, t.ad, t.yetkili ?? '', t.vergiNo ?? '']
      .some(alan => normalizeIdentifier(alan).includes(q)))
}
