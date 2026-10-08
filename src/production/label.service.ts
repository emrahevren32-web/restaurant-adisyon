// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4B — Etiket servisi
//
// ⚠️ SON SÖZ 0057'DE. Buradaki kontroller kullanıcıya iyi bir cümle kurmak
// için; türetmeyi ve kısıtları veritabanı yapıyor.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../core/context'
import type {
  BesinDegeri, EksikKalem, EtiketDeposu, EtiketKalemi, KalemAlerjeni,
  TuretilmisAlerjen,
} from './label.repository'
import type { EtiketBileseni, EtiketVerisi } from './label-documents'

export class EtiketDogrulamaError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'EtiketDogrulamaError'
  }
}

const kirp = (d?: string) => (d ?? '').trim()

export class EtiketServisi {
  constructor(private readonly depo: EtiketDeposu) {}

  firmaBilgisi(ctx: TenantCtx) { return this.depo.firmaBilgisi(ctx) }
  alerjenKatalogu() { return this.depo.alerjenKatalogu() }
  kalemler(ctx: TenantCtx) { return this.depo.kalemler(ctx) }
  kalemAlerjenleri(ctx: TenantCtx, id: string) { return this.depo.kalemAlerjenleri(ctx, id) }
  besinDegeri(ctx: TenantCtx, id: string) { return this.depo.besinDegeri(ctx, id) }
  mamulAlerjenleri(ctx: TenantCtx, id: string) { return this.depo.mamulAlerjenleri(ctx, id) }
  mamulAlerjenEksikleri(ctx: TenantCtx, id: string) { return this.depo.mamulAlerjenEksikleri(ctx, id) }
  mamulBesinDegeri(ctx: TenantCtx, id: string) { return this.depo.mamulBesinDegeri(ctx, id) }
  mamulBesinEksikleri(ctx: TenantCtx, id: string) { return this.depo.mamulBesinEksikleri(ctx, id) }
  /** Etiketteki parti buradan seçilir — elle yazılmaz (0067). */
  uretilenPartiler(ctx: TenantCtx, id: string) { return this.depo.uretilenPartiler(ctx, id) }
  incelendiIsaretle(ctx: TenantCtx, id: string) { return this.depo.incelendiIsaretle(ctx, id) }

  // ⚠️ Doğrulama yapan metot `async` (tuzak 41).
  async alerjenleriYaz(
    ctx: TenantCtx, kalemId: string, satirlar: readonly KalemAlerjeni[],
  ): Promise<void> {
    return this.depo.alerjenleriYaz(ctx, kalemId, alerjenleriDogrula(satirlar))
  }

  async ambalajYaz(
    ctx: TenantCtx, kalemId: string, miktar?: number, birim?: string,
  ): Promise<void> {
    if(miktar !== undefined && !(miktar > 0)){
      throw new EtiketDogrulamaError('Ambalaj içeriği sıfırdan büyük olmalı.')
    }
    if((miktar === undefined) !== (kirp(birim) === '')){
      // Yarım bir ambalaj bilgisi hiç bilgi değildir: "5" neyin 5'i?
      throw new EtiketDogrulamaError(
        'Ambalaj içeriği için miktar ve birim BİRLİKTE girilmeli (örnek: 5 kg).',
      )
    }
    return this.depo.ambalajYaz(ctx, kalemId, miktar, kirp(birim) || undefined)
  }

  async besinYaz(ctx: TenantCtx, kalemId: string, girdi: BesinDegeri): Promise<void> {
    return this.depo.besinYaz(ctx, kalemId, besinDogrula(girdi))
  }
}

export const alerjenleriDogrula = (
  satirlar: readonly KalemAlerjeni[],
): KalemAlerjeni[] => {
  const gorulen = new Set<string>()
  for(const s of satirlar){
    if(kirp(s.kod) === ''){
      throw new EtiketDogrulamaError('Alerjen kodu boş olamaz.')
    }
    if(gorulen.has(s.kod)){
      // Aynı alerjen hem "içerir" hem "iz" olamaz: ikisi çelişir ve hangisinin
      // etikete basılacağı belirsiz kalır.
      throw new EtiketDogrulamaError(
        `"${s.kod}" iki kez işaretlenmiş. Bir alerjen ya "içerir" ya "iz" olur.`,
      )
    }
    gorulen.add(s.kod)
  }
  return [...satirlar]
}

export const besinDogrula = (g: BesinDegeri): BesinDegeri => {
  const eksi = (['enerjiKj','enerjiKcal','yag','doymusYag','karbonhidrat','seker','protein','tuz'] as const)
    .filter(k => { const v = g[k]; return typeof v === 'number' && v < 0 })
  if(eksi.length > 0){
    throw new EtiketDogrulamaError('Besin değerleri eksi olamaz.')
  }
  // Fizik: doymuş yağ yağın içinde, şeker karbonhidratın içindedir.
  if(g.doymusYag !== undefined && g.yag !== undefined && g.doymusYag > g.yag){
    throw new EtiketDogrulamaError('Doymuş yağ, toplam yağdan büyük olamaz.')
  }
  if(g.seker !== undefined && g.karbonhidrat !== undefined && g.seker > g.karbonhidrat){
    throw new EtiketDogrulamaError('Şeker, toplam karbonhidrattan büyük olamaz.')
  }
  if(kirp(g.kaynak) === ''){
    // Kaynağı yazılmayan bir besin değeri denetimde savunulamaz.
    throw new EtiketDogrulamaError(
      'Besin değerinin kaynağı zorunlu: tedarikçi spesifikasyonu, analiz '
      + 'raporu ya da hangi tablodan alındığı.',
    )
  }
  return { ...g, kaynak: kirp(g.kaynak) }
}

/**
 * Ekranın parçalarından etiket verisini kurar.
 *
 * ⚠️ Eksikleri GİZLEMİYOR, taşıyor: etiket belgesi onlara bakıp TASLAK bandı
 * basıyor. Burada temizleseydik, eksik veriyle "temiz" görünen bir etiket
 * basılırdı — bu modülün var olma sebebinin tam tersi.
 */
export const etiketVerisiKur = (girdi: {
  kalem: EtiketKalemi
  firmaAdi: string
  firmaAdresi?: string
  lotKodu?: string
  uretimTarihi?: string
  sonKullanma?: string
  saklama?: string
  bilesenler: EtiketBileseni[]
  alerjenler: TuretilmisAlerjen[]
  besin?: BesinDegeri
  alerjenEksikleri: EksikKalem[]
  besinEksikleri: EksikKalem[]
}): EtiketVerisi => {
  const v: EtiketVerisi = {
    urunAdi: girdi.kalem.ad,
    firmaAdi: girdi.firmaAdi,
    bilesenler: girdi.bilesenler,
    alerjenler: girdi.alerjenler.map(a => ({ kod: a.kod, ad: a.ad, tur: a.tur })),
    alerjeniIncelenmemis: girdi.alerjenEksikleri.map(e => e.kalemAdi),
    besinEksikleri: girdi.besinEksikleri.map(e => e.kalemAdi),
  }
  if(girdi.kalem.netMiktar !== undefined && girdi.kalem.netBirim){
    v.netMiktar = `${girdi.kalem.netMiktar.toLocaleString('tr-TR')} ${girdi.kalem.netBirim}`
  }
  if(girdi.firmaAdresi)  v.firmaAdresi  = girdi.firmaAdresi
  if(girdi.lotKodu)      v.lotKodu      = girdi.lotKodu
  if(girdi.uretimTarihi) v.uretimTarihi = girdi.uretimTarihi
  if(girdi.sonKullanma)  v.sonKullanma  = girdi.sonKullanma
  if(girdi.saklama)      v.saklama      = girdi.saklama
  if(girdi.besin){
    v.besin = {
      ...(girdi.besin.enerjiKj     !== undefined ? { enerjiKj: girdi.besin.enerjiKj } : {}),
      ...(girdi.besin.enerjiKcal   !== undefined ? { enerjiKcal: girdi.besin.enerjiKcal } : {}),
      ...(girdi.besin.yag          !== undefined ? { yag: girdi.besin.yag } : {}),
      ...(girdi.besin.doymusYag    !== undefined ? { doymusYag: girdi.besin.doymusYag } : {}),
      ...(girdi.besin.karbonhidrat !== undefined ? { karbonhidrat: girdi.besin.karbonhidrat } : {}),
      ...(girdi.besin.seker        !== undefined ? { seker: girdi.besin.seker } : {}),
      ...(girdi.besin.protein      !== undefined ? { protein: girdi.besin.protein } : {}),
      ...(girdi.besin.tuz          !== undefined ? { tuz: girdi.besin.tuz } : {}),
    }
  }
  return v
}

/** Listede kalemin yanına yazılan tek cümle. */
export const alerjenDurumu = (k: EtiketKalemi, sayi: number): string => {
  if(!k.incelemeZamani) return 'alerjeni incelenmedi'
  return sayi === 0 ? 'incelendi · alerjen yok' : `incelendi · ${sayi} alerjen`
}
