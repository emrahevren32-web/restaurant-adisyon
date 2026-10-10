// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4B — ALERJEN VE BESİN DEĞERİ DEPOSU
//
// ⚠️ TÜRETME TABLODA, BURADA DEĞİL. Alerjenin reçete ağacında özyinelemeli
// aranması ve besin değerinin hesaplanması 0057'de. Tarayıcıda yapsaydık,
// reçete iki çağrı arasında değiştiğinde etiket eski veriyle basılırdı —
// ve bu, etikette yanlış beyandır.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'

export type AlerjenTuru = 'İÇERİR' | 'İZ'

/** Mevzuat listesi (0057). Kiracıya ait değil, herkes aynısını kullanır. */
export type Alerjen = { kod: string; ad: string; sira: number; not?: string }

export type KalemAlerjeni = { kod: string; tur: AlerjenTuru; not?: string }

export type BesinDegeri = {
  temel: '100g' | '100ml'
  enerjiKj?: number
  enerjiKcal?: number
  yag?: number
  doymusYag?: number
  karbonhidrat?: number
  seker?: number
  protein?: number
  tuz?: number
  /** Nereden geldi: tedarikçi spesifikasyonu, analiz raporu… */
  kaynak?: string
}

/** Etiketlenebilir kalem — stok kartının etiketle ilgili yüzü. */
export type EtiketKalemi = {
  id: string
  kod: string
  ad: string
  temelBirim: string
  netMiktar?: number
  netBirim?: string
  /** BOŞ = alerjeni hiç incelenmemiş. "Alerjen yok" DEĞİL. */
  incelemeZamani?: string
  aktif: boolean
}

export type TuretilmisAlerjen = {
  kod: string
  ad: string
  tur: AlerjenTuru
  /** Hangi malzemelerden geldiği — "bu nereden geliyor" sorusunun cevabı. */
  kaynaklar: string[]
}

export type EksikKalem = { kalemId: string; kalemAdi: string; sebep?: string }

/** Etikette yazacak üretici bilgisi. */
export type FirmaBilgisi = { ad: string; adres?: string }

/**
 * Bir mamulün ÜRETİLMİŞ partisi (0067).
 *
 * ⚠️ Etiketteki parti artık buradan seçiliyor, elle yazılmıyor. Zincirin
 * son metresi klavyeye bağlıyken biri 20261007 yerine 20261006 yazdığı gün
 * geri çağırma yanlış paleti toplar ya da doğru paleti kaçırır — ve
 * hangisinin olduğu anlaşılmaz, çünkü kâğıtla sistem arasındaki tek bağ
 * o numaraydı.
 */
export type UretilenParti = {
  id: string
  kod: string
  /** Malın DEFTERE GİRDİĞİ gün; parti kaydının açıldığı gün değil. */
  uretimTarihi?: string
  sonKullanma?: string
  /** Eldeki miktar. 0 olabilir — tükenmiş parti listeden DÜŞMEZ. */
  bakiye: number
  isEmriNo?: string
}

export interface EtiketDeposu {
  /**
   * ⚠️ Üretici adı ELLE YAZILMIYOR, kayıttan geliyor. Etikette yanlış üretici
   * adı yasal olarak yanlış beyandır.
   */
  firmaBilgisi(ctx: TenantCtx): Promise<FirmaBilgisi>
  alerjenKatalogu(): Promise<Alerjen[]>
  kalemler(ctx: TenantCtx): Promise<EtiketKalemi[]>
  kalemAlerjenleri(ctx: TenantCtx, kalemId: string): Promise<KalemAlerjeni[]>
  /**
   * Alerjen beyanını TEK İŞLEMDE yeniden yazar: eski satırlar silinir,
   * yenileri eklenir ve "incelendi" damgası atılır. Dönen değer damga zamanı.
   *
   * ⚠️ 0072'den ÖNCE bu iş İKİ metottu (`alerjenleriYaz` + `incelendiIsaretle`)
   * ve ekran ikisini arka arkaya çağırıyordu. Arada kopan bir bağlantı
   * SIFIR alerjen satırı + ESKİ "incelendi" damgası bırakıyordu; o kalemin
   * etiketi de "Bilinen alerjen içermez" yazıyordu. İkiye bölme.
   */
  beyaniKaydet(
    ctx: TenantCtx, kalemId: string, satirlar: readonly KalemAlerjeni[],
  ): Promise<string>
  ambalajYaz(ctx: TenantCtx, kalemId: string, miktar?: number, birim?: string): Promise<void>
  besinDegeri(ctx: TenantCtx, kalemId: string): Promise<BesinDegeri | undefined>
  besinYaz(ctx: TenantCtx, kalemId: string, girdi: BesinDegeri): Promise<void>

  // ── Türetilenler (0057) ────────────────────────────────────────────────
  mamulAlerjenleri(ctx: TenantCtx, kalemId: string): Promise<TuretilmisAlerjen[]>
  mamulAlerjenEksikleri(ctx: TenantCtx, kalemId: string): Promise<EksikKalem[]>
  mamulBesinDegeri(ctx: TenantCtx, kalemId: string): Promise<BesinDegeri | undefined>
  mamulBesinEksikleri(ctx: TenantCtx, kalemId: string): Promise<EksikKalem[]>

  // ── Üretilen partiler (0067) ───────────────────────────────────────────
  uretilenPartiler(ctx: TenantCtx, kalemId: string): Promise<UretilenParti[]>
}

const bos = (d: unknown): string | undefined => {
  const m = typeof d === 'string' ? d.trim() : ''
  return m === '' ? undefined : m
}
const sayi = (d: unknown): number | undefined =>
  d === null || d === undefined ? undefined : Number(d)

// ⚠️ Sütun listeleri TEK PARÇA metin (tuzak 40).
const KALEM_SUTUNLARI = 'id, code, name, base_uom, net_qty, net_uom, allergen_reviewed_at, is_active'
const BESIN_SUTUNLARI = 'basis, energy_kj, energy_kcal, fat, saturated_fat, carbohydrate, sugars, protein, salt, source'

export class PostgresEtiketDeposu implements EtiketDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async firmaBilgisi(_ctx: TenantCtx): Promise<FirmaBilgisi> {
    const { data, error } = await this.client
      .from('company').select('company_name').order('created_at').limit(1).maybeSingle()
    if(error) throw new Error(`Firma bilgisi okunamadı: ${error.message}`)
    const ad = bos((data as { company_name?: string } | null)?.company_name)
    // Firma kaydı yoksa uydurmuyoruz: etiket TASLAK kalsın, sebebi görünsün.
    return { ad: ad ?? '' }
  }

  async alerjenKatalogu(): Promise<Alerjen[]> {
    const { data, error } = await this.client
      .from('allergen').select('code, name, sort_order, note').order('sort_order')
    if(error) throw new Error(`Alerjen listesi okunamadı: ${error.message}`)
    type S = { code: string; name: string; sort_order: number; note: string | null }
    return ((data as unknown as S[] | null) ?? []).map(a => {
      const k: Alerjen = { kod: a.code, ad: a.name, sira: a.sort_order }
      const n = bos(a.note); if(n !== undefined) k.not = n
      return k
    })
  }

  async kalemler(_ctx: TenantCtx): Promise<EtiketKalemi[]> {
    const { data, error } = await this.client
      .from('stock_item').select(KALEM_SUTUNLARI).order('name')
    if(error) throw new Error(`Stok kalemleri okunamadı: ${error.message}`)
    type S = {
      id: string; code: string; name: string; base_uom: string
      net_qty: string | number | null; net_uom: string | null
      allergen_reviewed_at: string | null; is_active: boolean
    }
    return ((data as unknown as S[] | null) ?? []).map(k => {
      const e: EtiketKalemi = {
        id: k.id, kod: k.code, ad: k.name, temelBirim: k.base_uom, aktif: k.is_active,
      }
      const nm = sayi(k.net_qty);                 if(nm !== undefined) e.netMiktar = nm
      const nb = bos(k.net_uom);                  if(nb !== undefined) e.netBirim = nb
      const iz = bos(k.allergen_reviewed_at);     if(iz !== undefined) e.incelemeZamani = iz
      return e
    })
  }

  async kalemAlerjenleri(_ctx: TenantCtx, kalemId: string): Promise<KalemAlerjeni[]> {
    const { data, error } = await this.client
      .from('stock_item_allergen').select('allergen_code, kind, note')
      .eq('stock_item_id', kalemId)
    if(error) throw new Error(`Alerjen beyanı okunamadı: ${error.message}`)
    type S = { allergen_code: string; kind: string; note: string | null }
    return ((data as unknown as S[] | null) ?? []).map(a => {
      const k: KalemAlerjeni = { kod: a.allergen_code, tur: a.kind as AlerjenTuru }
      const n = bos(a.note); if(n !== undefined) k.not = n
      return k
    })
  }

  /**
   * ⚠️ TARAYICIDAN İŞLEM AÇILAMADIĞI İÇİN İŞLEM SUNUCUYA TAŞINDI (0072).
   * Tek RPC çağrısı; içeride sil + ekle + damgala tek işlemde oluyor.
   * Yarıda kalırsa veritabanı hiç dokunulmamış gibi kalıyor.
   *
   * ⚠️ `tenant_id` ARTIK BURADAN GÖNDERİLMİYOR. Kiracıyı sunucu oturumdan
   * okuyor; tarayıcının söylediği kiracıya güvenmek kiracı duvarını
   * tarayıcıya emanet etmek olurdu.
   */
  async beyaniKaydet(
    _ctx: TenantCtx, kalemId: string, satirlar: readonly KalemAlerjeni[],
  ): Promise<string> {
    const { data, error } = await this.client.rpc('alerjen_beyani_yaz', {
      p_kalem: kalemId,
      p_satirlar: satirlar.map(s => ({
        kod: s.kod, tur: s.tur, not: s.not ?? null,
      })),
    })
    if(error) throw new Error(`Alerjen beyanı kaydedilemedi: ${error.message}`)
    return typeof data === 'string' ? data : new Date().toISOString()
  }

  async ambalajYaz(
    _ctx: TenantCtx, kalemId: string, miktar?: number, birim?: string,
  ): Promise<void> {
    const { error } = await this.client.from('stock_item')
      .update({ net_qty: miktar ?? null, net_uom: birim ?? null })
      .eq('id', kalemId)
    if(error) throw new Error(`Ambalaj içeriği yazılamadı: ${error.message}`)
  }

  async besinDegeri(_ctx: TenantCtx, kalemId: string): Promise<BesinDegeri | undefined> {
    const { data, error } = await this.client
      .from('stock_item_nutrition').select(BESIN_SUTUNLARI)
      .eq('stock_item_id', kalemId).maybeSingle()
    if(error) throw new Error(`Besin değeri okunamadı: ${error.message}`)
    if(!data) return undefined
    return besine(data as unknown as BesinSatiri)
  }

  async besinYaz(ctx: TenantCtx, kalemId: string, g: BesinDegeri): Promise<void> {
    const { error } = await this.client.from('stock_item_nutrition').upsert({
      stock_item_id: kalemId,
      tenant_id: ctx.tenantId,
      basis: g.temel,
      energy_kj: g.enerjiKj ?? null,
      energy_kcal: g.enerjiKcal ?? null,
      fat: g.yag ?? null,
      saturated_fat: g.doymusYag ?? null,
      carbohydrate: g.karbonhidrat ?? null,
      sugars: g.seker ?? null,
      protein: g.protein ?? null,
      salt: g.tuz ?? null,
      source: g.kaynak ?? null,
    }, { onConflict: 'stock_item_id' })
    if(error) throw new Error(`Besin değeri yazılamadı: ${error.message}`)
  }

  async mamulAlerjenleri(_ctx: TenantCtx, kalemId: string): Promise<TuretilmisAlerjen[]> {
    const { data, error } = await this.client
      .rpc('mamul_alerjenleri', { p_kalem: kalemId })
    if(error) throw new Error(`Mamul alerjenleri okunamadı: ${error.message}`)
    type S = { kod: string; ad: string; tur: string; kaynaklar: string[] | null }
    return ((data as unknown as S[] | null) ?? []).map(a => ({
      kod: a.kod, ad: a.ad, tur: a.tur as AlerjenTuru, kaynaklar: a.kaynaklar ?? [],
    }))
  }

  async mamulAlerjenEksikleri(_ctx: TenantCtx, kalemId: string): Promise<EksikKalem[]> {
    const { data, error } = await this.client
      .rpc('mamul_alerjen_eksikleri', { p_kalem: kalemId })
    if(error) throw new Error(`Alerjen eksikleri okunamadı: ${error.message}`)
    type S = { kalem_id: string; kalem_adi: string }
    return ((data as unknown as S[] | null) ?? [])
      .map(e => ({ kalemId: e.kalem_id, kalemAdi: e.kalem_adi }))
  }

  async mamulBesinDegeri(_ctx: TenantCtx, kalemId: string): Promise<BesinDegeri | undefined> {
    const { data, error } = await this.client
      .rpc('mamul_besin_degeri', { p_kalem: kalemId })
    if(error) throw new Error(`Mamul besin değeri okunamadı: ${error.message}`)
    const satir = (Array.isArray(data) ? data[0] : data) as BesinSatiri | undefined
    return satir ? besine(satir) : undefined
  }

  async mamulBesinEksikleri(_ctx: TenantCtx, kalemId: string): Promise<EksikKalem[]> {
    const { data, error } = await this.client
      .rpc('mamul_besin_eksikleri', { p_kalem: kalemId })
    if(error) throw new Error(`Besin eksikleri okunamadı: ${error.message}`)
    type S = { kalem_id: string; kalem_adi: string; sebep: string | null }
    return ((data as unknown as S[] | null) ?? []).map(e => {
      const k: EksikKalem = { kalemId: e.kalem_id, kalemAdi: e.kalem_adi }
      const s = bos(e.sebep); if(s !== undefined) k.sebep = s
      return k
    })
  }

  // ── Üretilen partiler (0067) ───────────────────────────────────────────
  /**
   * Bir mamulün üretilmiş partileri — en yenisi en üstte.
   *
   * ⚠️ HESAP BURADA DEĞİL, 0067'DE. Üretim tarihi, bakiye ve iş emri
   * numarası veritabanından geliyor; tarayıcıda hesaplasaydık bakiye
   * PostgREST'in satır sınırında sessizce kesilirdi.
   */
  async uretilenPartiler(_ctx: TenantCtx, kalemId: string): Promise<UretilenParti[]> {
    const { data, error } = await this.client
      .rpc('uretilen_partiler', { p_kalem: kalemId })
    if(error) throw new Error(`Üretilen partiler okunamadı: ${error.message}`)

    type S = {
      parti_id: string; parti_kodu: string
      uretim_tarihi: string | null; son_kullanma: string | null
      bakiye: string | number | null; is_emri_no: string | null
    }
    return ((data as unknown as S[] | null) ?? []).map(r => ({
      id: r.parti_id,
      kod: r.parti_kodu,
      uretimTarihi: r.uretim_tarihi ?? undefined,
      sonKullanma: r.son_kullanma ?? undefined,
      bakiye: sayi(r.bakiye) ?? 0,
      isEmriNo: r.is_emri_no ?? undefined,
    }))
  }
}

type BesinSatiri = {
  basis?: string
  energy_kj: string | number | null
  energy_kcal: string | number | null
  fat: string | number | null
  saturated_fat: string | number | null
  carbohydrate: string | number | null
  sugars: string | number | null
  protein: string | number | null
  salt: string | number | null
  source?: string | null
}

const besine = (s: BesinSatiri): BesinDegeri => {
  const b: BesinDegeri = { temel: (s.basis === '100ml' ? '100ml' : '100g') }
  const al = (k: keyof BesinDegeri, v: unknown) => {
    const n = sayi(v)
    if(n !== undefined) (b as Record<string, unknown>)[k] = n
  }
  al('enerjiKj', s.energy_kj);        al('enerjiKcal', s.energy_kcal)
  al('yag', s.fat);                   al('doymusYag', s.saturated_fat)
  al('karbonhidrat', s.carbohydrate); al('seker', s.sugars)
  al('protein', s.protein);           al('tuz', s.salt)
  const k = bos(s.source); if(k !== undefined) b.kaynak = k
  return b
}
