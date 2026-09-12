// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3.5 / HACCP servisi
//
// Yol haritası (A3.5): "HACCP · sıcaklık ölçümü ve düzeltici faaliyet"
//         Bitti sayılır ki: "Limit aşılınca kayıt kendiliğinden uygunsuzluk
//         açıyor ve o parti geri çağırma listesinden görülüyor"
//
// ── BU DOSYANIN TEK İDDİASI ──────────────────────────────────────────────
// Kayıt tutmak kolaydır; KONTROL etmek zordur. Kağıtta da kayıt tutuluyor —
// sorun kaydın kimse tarafından değerlendirilmemesi. Burada değerlendirme
// yazma anında, koddan çıkıyor:
//
//   deger + CCP limiti → PASS/FAIL       (insan karar vermiyor)
//   FAIL → düzeltici faaliyet KENDİLİĞİNDEN açılıyor  (unutulamıyor)
//   FAIL + lot → o parti izlenebilirlikten görünüyor  (saklanamıyor)
//
// ── LİMİT ANLIK GÖRÜNTÜSÜ NEDEN SAKLANIYOR ───────────────────────────────
// Ölçüm yazılırken limit metni kaydın içine kopyalanıyor. İşletme yarın
// limiti 4 °C'den 6 °C'ye çekerse dünkü FAIL kayıtları PASS'a dönmez.
// Denetimde doğru olan budur: kayıt, o günün kuralına göre değerlendirilmiştir.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../core/context'
import {
  ASAMA_ETIKETLERI,
  type Ccp,
  type DuzelticiFaaliyet,
  type HaccpDeposu,
  type Olcum,
  type OlcumKaynagi,
  type OlcumSonucu,
  type UretimAsamasi,
  type YeniOlcum,
} from './haccp.repository'

export class HaccpDogrulamaError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'HaccpDogrulamaError'
  }
}

const sayiBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })
const bicimle = (d: number) => sayiBicimi.format(d)

/**
 * Ölçülen değer limiti karşılıyor mu?
 *
 * Sınır DEĞERİ uygun sayılıyor: "en çok 4 °C" kuralında tam 4,0 geçer.
 * Gıda mevzuatı bu şekilde okunur; sınırı reddetmek her termometreyi
 * uygunsuz gösterirdi.
 */
export const sonucHesapla = (ccp: Ccp, deger: number): OlcumSonucu => {
  if(!Number.isFinite(deger)) return 'FAIL'
  switch(ccp.limitTipi){
    case 'MAX':
      return ccp.limitUst !== undefined && deger <= ccp.limitUst ? 'PASS' : 'FAIL'
    case 'MIN':
      return ccp.limitAlt !== undefined && deger >= ccp.limitAlt ? 'PASS' : 'FAIL'
    case 'RANGE':
      return ccp.limitAlt !== undefined && ccp.limitUst !== undefined
        && deger >= ccp.limitAlt && deger <= ccp.limitUst ? 'PASS' : 'FAIL'
  }
}

/** Kayda gömülecek ve kâğıda basılacak limit metni. */
export const limitOzeti = (ccp: Ccp): string => {
  if(ccp.limitMetni) return `${ccp.limitMetni} (${ccp.birim})`
  switch(ccp.limitTipi){
    case 'MAX':   return `en çok ${bicimle(ccp.limitUst ?? 0)} ${ccp.birim}`
    case 'MIN':   return `en az ${bicimle(ccp.limitAlt ?? 0)} ${ccp.birim}`
    case 'RANGE': return `${bicimle(ccp.limitAlt ?? 0)} – ${bicimle(ccp.limitUst ?? 0)} ${ccp.birim}`
  }
}

/** Limit aşıldığında kullanıcıya gösterilecek cümle. */
export const sapmaMetni = (ccp: Ccp, deger: number): string => {
  const d = bicimle(deger)
  switch(ccp.limitTipi){
    case 'MAX':
      return `${d} ${ccp.birim} ölçüldü; sınır en çok ${bicimle(ccp.limitUst ?? 0)} ${ccp.birim}.`
    case 'MIN':
      return `${d} ${ccp.birim} ölçüldü; sınır en az ${bicimle(ccp.limitAlt ?? 0)} ${ccp.birim}.`
    case 'RANGE':
      return `${d} ${ccp.birim} ölçüldü; sınır ${bicimle(ccp.limitAlt ?? 0)} – ${bicimle(ccp.limitUst ?? 0)} ${ccp.birim}.`
  }
}

/** Bir aşamada ölçülmesi gereken aktif CCP'ler — ekran formu bunu kullanıyor. */
export const asamaninCcpleri = (
  ccpler: readonly Ccp[], asama: UretimAsamasi,
): Ccp[] => ccpler.filter(c => c.asama === asama && c.durum === 'ACTIVE')

export type HaccpOzeti = {
  bugunOlcum: number
  bugunUygun: number
  bugunUygunsuz: number
  acikFaaliyet: number
  /** Bugün ölçüm yapılmış aktif CCP oranı — panelin "uygunluk" rakamı. */
  uygunlukYuzdesi: number
}

const gunAnahtari = (zaman: string): string => {
  const t = new Date(zaman)
  return Number.isNaN(t.getTime()) ? zaman.slice(0, 10) : t.toISOString().slice(0, 10)
}

/**
 * Kontrol panelinin okuduğu rakamlar — hepsi GERÇEK kayıtlardan.
 *
 * ⚠️ Uygunluk yüzdesi, "kaç ölçüm geçti" değil "bugün ölçülen uygun ölçümlerin
 * payı"dır ve İPTAL EDİLMİŞ kayıtlar sayılmaz. Sahte bir yüzde göstermenin
 * en kolay yolu iptalleri de saymaktı; o rakam hiçbir şey anlatmaz.
 */
export const haccpOzeti = (
  olcumler: readonly Olcum[],
  faaliyetler: readonly DuzelticiFaaliyet[],
  bugun: string = new Date().toISOString().slice(0, 10),
): HaccpOzeti => {
  const bugunkuler = olcumler.filter(
    o => !o.iptalZamani && gunAnahtari(o.olcumZamani) === bugun,
  )
  const uygun = bugunkuler.filter(o => o.sonuc === 'PASS').length
  const uygunsuz = bugunkuler.filter(o => o.sonuc === 'FAIL').length

  return {
    bugunOlcum: bugunkuler.length,
    bugunUygun: uygun,
    bugunUygunsuz: uygunsuz,
    acikFaaliyet: faaliyetler.filter(
      f => f.durum === 'OPEN' || f.durum === 'IN_PROGRESS',
    ).length,
    uygunlukYuzdesi: bugunkuler.length === 0
      ? 100
      : Math.round((uygun / bugunkuler.length) * 100),
  }
}

export class HaccpServisi {
  constructor(private readonly depo: HaccpDeposu) {}

  ccpler(ctx: TenantCtx): Promise<Ccp[]> { return this.depo.ccpler(ctx) }
  olcumler(ctx: TenantCtx, limit?: number): Promise<Olcum[]> {
    return this.depo.olcumler(ctx, limit)
  }
  kaynaginOlcumleri(ctx: TenantCtx, tip: OlcumKaynagi, id: string): Promise<Olcum[]> {
    return this.depo.kaynaginOlcumleri(ctx, tip, id)
  }
  lotunOlcumleri(ctx: TenantCtx, lotId: string): Promise<Olcum[]> {
    return this.depo.lotunOlcumleri(ctx, lotId)
  }
  faaliyetler(ctx: TenantCtx): Promise<DuzelticiFaaliyet[]> {
    return this.depo.faaliyetler(ctx)
  }

  /**
   * Ölçümü yazar; limit aşıldıysa düzeltici faaliyeti KENDİ AÇAR.
   *
   * Faaliyeti kullanıcıya bırakmak, HACCP'in çalışmadığı en yaygın yer.
   * "Sıcaklığı yazdım" ile "ne yaptığımı yazdım" arasındaki boşluk denetimde
   * tam olarak burada çıkar.
   */
  async olcumEkle(
    ctx: TenantCtx, ccp: Ccp, girdi: YeniOlcum,
  ): Promise<{ olcum: Olcum; faaliyet?: DuzelticiFaaliyet }> {
    if(ccp.durum !== 'ACTIVE'){
      throw new HaccpDogrulamaError(
        `${ccp.kod} pasif. Pasif bir kontrol noktasına ölçüm yazılamaz.`,
      )
    }
    if(!Number.isFinite(girdi.deger)){
      throw new HaccpDogrulamaError('Ölçülen değer bir sayı olmalıdır.')
    }

    const sonuc = sonucHesapla(ccp, girdi.deger)
    const olcum = await this.depo.olcumYaz(
      ctx, { ...girdi, ccpId: ccp.id }, sonuc, limitOzeti(ccp), ccp.birim,
    )

    if(sonuc === 'PASS') return { olcum }

    const faaliyet = await this.depo.faaliyetAc(
      ctx,
      olcum.id,
      `${ccp.kod} · ${ccp.ad} — ${sapmaMetni(ccp, girdi.deger)}`
      + (ccp.duzelticiTalimat ? ` Yapılacak: ${ccp.duzelticiTalimat}` : ''),
      ccp.sorumluRol,
    )
    return { olcum, faaliyet }
  }

  /** Yanlış ölçüm SİLİNMEZ: iptal edilir, gerekçesi kalır. */
  async olcumIptalEt(ctx: TenantCtx, olcum: Olcum, gerekce: string): Promise<void> {
    const g = gerekce.trim()
    if(!g){
      throw new HaccpDogrulamaError(
        'İptal gerekçesi zorunludur. Gerekçesiz iptal, denetimde silme sayılır.',
      )
    }
    if(olcum.iptalZamani){
      throw new HaccpDogrulamaError('Bu ölçüm zaten iptal edilmiş.')
    }
    await this.depo.olcumIptal(ctx, olcum.id, g)
  }

  async faaliyetiKapat(
    ctx: TenantCtx, faaliyet: DuzelticiFaaliyet, yapilanIs: string,
  ): Promise<DuzelticiFaaliyet> {
    const is = yapilanIs.trim()
    if(!is){
      // Boş kapanış, kapanmamış bir faaliyetten kötüdür: liste temiz görünür,
      // yapılan iş kayıtsız kalır.
      throw new HaccpDogrulamaError('Ne yapıldığı yazılmadan faaliyet kapatılamaz.')
    }
    return this.depo.faaliyetGuncelle(ctx, faaliyet.id, {
      durum: 'COMPLETED',
      yapilanIs: is,
      kapanisZamani: new Date().toISOString(),
    })
  }
}

/** Ekranların ortak kullandığı aşama etiketi. */
export const asamaEtiketi = (asama?: UretimAsamasi): string =>
  asama ? ASAMA_ETIKETLERI[asama] : '—'
