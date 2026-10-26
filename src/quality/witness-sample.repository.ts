// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3.9 / Kalite — ŞAHİT NUMUNE DEFTERİ (okuma ve yazma sınırı)
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────
// Göç 0093 defteri kurdu, 0094 kiracı sınırını ve açık raf ömrünü ekledi.
// Ama o güne kadar MİYOP'ta şahit numune diye GÖRÜNEN tek şey
// `src/witness-samples/witness-sample.mock.ts` idi: uydurma satırlar. Yani
// "şahit numune var" demek yalan olurdu — defter vardı, ekran yoktu.
//
// ── BU DOSYANIN SINIRI ───────────────────────────────────────────────────
// Burada HİÇBİR KURAL YOK. Saklama sonu, saklama koşulu, açık raf ömrü,
// imza ve kiracı — hepsini VERİTABANI türetiyor (0093/0094 tetikleri).
// Bu dosya yalnız okur, yazar ve Türkçeye çevirir.
//
// ⚠️ Kuralı burada TEKRAR yazmak en tehlikeli seçenek olurdu: iki yerde
// duran bir kural bir gün ayrışır ve hangisinin doğru olduğu bilinemez.
// Ekran "72 saat" gibi bir sayı hesaplamıyor; sunucunun yazdığını okuyor.
//
// ⚠️ Kiracı süzmesi burada YOK — RLS'in işi (ADR-004). Buraya bir
// `eq('tenant_id', …)` yazsaydık, RLS kapalı olsa bile ekran doğru
// görünür ve açık fark edilmezdi.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'

export const NUMUNE_DURUMLARI = ['SAKLANIYOR', 'ACILDI', 'IMHA'] as const
export type NumuneDurumu = (typeof NUMUNE_DURUMLARI)[number]

export const NUMUNE_DURUM_ETIKETLERI: Record<NumuneDurumu, string> = {
  SAKLANIYOR: 'Saklanıyor',
  ACILDI: 'Açıldı',
  IMHA: 'İmha edildi',
}

export const NUMUNE_OLAYLARI = ['ALINDI', 'ACILDI', 'IMHA'] as const
export type NumuneOlayTipi = (typeof NUMUNE_OLAYLARI)[number]

export const NUMUNE_OLAY_ETIKETLERI: Record<NumuneOlayTipi, string> = {
  ALINDI: 'Numune alındı',
  ACILDI: 'Müşteri önünde açıldı',
  IMHA: 'İmha edildi',
}

export type SahitNumune = {
  id: string
  kod: string
  kalemId: string
  kalemAd: string
  kalemKodu: string
  lotId: string
  lotKodu: string
  /** Partinin SKT'si. Saklama sonunun kaynağı (0093). */
  partiSkt?: string
  isEmriId?: string
  alinmaZamani: string
  alanKisi?: string
  /** Ürün kartından KOPYALANMIŞ koşul; kart sonradan değişse bile donar. */
  saklamaKosulu: string
  /** Sunucunun türettiği saklama sonu (YYYY-MM-DD). */
  saklamaSonu: string
  /** Açıldıktan sonra kaç gün uygun — ürün kartından kopyalanır (0094). */
  acikRafOmruGun?: number
  durum: NumuneDurumu
  not?: string
}

export type NumuneOlayi = {
  id: number
  numuneId: string
  tip: NumuneOlayTipi
  zaman: string
  yazanKisi?: string
  gerekce?: string
  sonuc?: string
}

/** Numune alınabilecek bir parti — ekranın seçim listesi. */
export type NumuneAdayi = {
  lotId: string
  lotKodu: string
  kalemId: string
  kalemAd: string
  kalemKodu: string
  skt: string
  /** Üretim partisi ise iş emri kimliği; mal kabulde boş. */
  isEmriId?: string
  uretimPartisiMi: boolean
  /** Ürün kartındaki saklama koşulu. Boşsa numune ALINAMAZ (0093). */
  saklamaKosulu?: string
  acikRafOmruGun?: number
  /** Bu partinin AÇIK (imha edilmemiş) numunesi var mı? */
  numunesiVar: boolean
}

export type YeniNumune = {
  lotId: string
  kod: string
  isEmriId?: string
  not?: string
}

export type YeniNumuneOlayi = {
  numuneId: string
  tip: Exclude<NumuneOlayTipi, 'ALINDI'>
  gerekce: string
  sonuc?: string
}

export interface SahitNumuneDeposu {
  numuneler(ctx: TenantCtx): Promise<SahitNumune[]>
  olaylar(ctx: TenantCtx, numuneId: string): Promise<NumuneOlayi[]>
  adaylar(ctx: TenantCtx): Promise<NumuneAdayi[]>
  numuneAl(ctx: TenantCtx, girdi: YeniNumune): Promise<void>
  olayYaz(ctx: TenantCtx, girdi: YeniNumuneOlayi): Promise<void>
}

const NUMUNE_SECIM = `
  id, sample_code, stock_item_id, lot_id, work_order_id, taken_at,
  storage_condition, keep_until, opened_shelf_life_days, status, note,
  stock_item:stock_item_id ( code, name ),
  stock_lot:lot_id ( lot_code, expires_on ),
  alan:taken_by ( full_name )
`

type NumuneKaydi = {
  id: string
  sample_code: string
  stock_item_id: string
  lot_id: string
  work_order_id: string | null
  taken_at: string
  storage_condition: string
  keep_until: string
  opened_shelf_life_days: number | null
  status: string
  note: string | null
  stock_item: { code: string; name: string } | null
  stock_lot: { lot_code: string; expires_on: string | null } | null
  alan: { full_name: string | null } | null
}

const numuneyeCevir = (satir: NumuneKaydi): SahitNumune => ({
  id: satir.id,
  kod: satir.sample_code,
  kalemId: satir.stock_item_id,
  kalemAd: satir.stock_item?.name ?? '—',
  kalemKodu: satir.stock_item?.code ?? '—',
  lotId: satir.lot_id,
  lotKodu: satir.stock_lot?.lot_code ?? '—',
  partiSkt: satir.stock_lot?.expires_on ?? undefined,
  isEmriId: satir.work_order_id ?? undefined,
  alinmaZamani: satir.taken_at,
  alanKisi: satir.alan?.full_name ?? undefined,
  saklamaKosulu: satir.storage_condition,
  saklamaSonu: satir.keep_until,
  acikRafOmruGun: satir.opened_shelf_life_days ?? undefined,
  durum: satir.status as NumuneDurumu,
  not: satir.note ?? undefined,
})

type OlayKaydi = {
  id: number
  sample_id: string
  event_type: string
  occurred_at: string
  reason: string | null
  result: string | null
  yazan: { full_name: string | null } | null
}

const olayaCevir = (satir: OlayKaydi): NumuneOlayi => ({
  id: satir.id,
  numuneId: satir.sample_id,
  tip: satir.event_type as NumuneOlayTipi,
  zaman: satir.occurred_at,
  yazanKisi: satir.yazan?.full_name ?? undefined,
  gerekce: satir.reason ?? undefined,
  sonuc: satir.result ?? undefined,
})

type AdayKaydi = {
  id: string
  lot_code: string
  expires_on: string | null
  origin_type: string
  origin_id: string | null
  stock_item_id: string
  stock_item: {
    code: string
    name: string
    storage_condition: string | null
    opened_shelf_life_days: number | null
  } | null
}

export class PostgresSahitNumuneDeposu implements SahitNumuneDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async numuneler(_ctx: TenantCtx): Promise<SahitNumune[]> {
    const { data, error } = await this.client
      .from('witness_sample')
      .select(NUMUNE_SECIM)
      .order('taken_at', { ascending: false })
      .limit(500)
    if(error) throw new Error(`Şahit numuneler okunamadı: ${error.message}`)
    return ((data as unknown as NumuneKaydi[] | null) ?? []).map(numuneyeCevir)
  }

  async olaylar(_ctx: TenantCtx, numuneId: string): Promise<NumuneOlayi[]> {
    const { data, error } = await this.client
      .from('witness_sample_event')
      .select('id, sample_id, event_type, occurred_at, reason, result, yazan:actor_user_id ( full_name )')
      .eq('sample_id', numuneId)
      .order('occurred_at', { ascending: true })
    if(error) throw new Error(`Numune olayları okunamadı: ${error.message}`)
    return ((data as unknown as OlayKaydi[] | null) ?? []).map(olayaCevir)
  }

  /**
   * Numune alınabilecek partiler.
   *
   * ⚠️ SKT'si OLMAYAN parti listede YOK: saklama sonu türetilemediği için
   * sunucu da reddediyor (0093). Reddedilecek bir satırı listeye koymak,
   * kullanıcıyı denemeye davet edip hata göstermek olurdu.
   *
   * ⚠️ Saklama koşulu TANIMSIZ ürünün partisi listede VAR ama seçilemez
   * hâlde, sebebi yazılı. Burada da gizlemek, "neden bu parti listede yok"
   * sorusunu cevapsız bırakırdı — eksik olan ürün kartıdır, kullanıcı onu
   * düzeltebilir.
   */
  async adaylar(_ctx: TenantCtx): Promise<NumuneAdayi[]> {
    const { data, error } = await this.client
      .from('stock_lot')
      .select(`
        id, lot_code, expires_on, origin_type, origin_id, stock_item_id,
        stock_item:stock_item_id ( code, name, storage_condition, opened_shelf_life_days )
      `)
      .not('expires_on', 'is', null)
      .order('created_at', { ascending: false })
      .limit(300)
    if(error) throw new Error(`Partiler okunamadı: ${error.message}`)

    const partiler = (data as unknown as AdayKaydi[] | null) ?? []
    if(partiler.length === 0) return []

    // Hangi partilerin AÇIK numunesi var? Tek sorguda, listedeki partiler için.
    const { data: mevcut, error: mevcutHatasi } = await this.client
      .from('witness_sample')
      .select('lot_id, status')
      .in('lot_id', partiler.map(p => p.id))
      .neq('status', 'IMHA')
    if(mevcutHatasi) throw new Error(`Mevcut numuneler okunamadı: ${mevcutHatasi.message}`)

    const numunesiOlanlar = new Set(
      ((mevcut as Array<{ lot_id: string }> | null) ?? []).map(s => s.lot_id),
    )

    return partiler.map(p => ({
      lotId: p.id,
      lotKodu: p.lot_code,
      kalemId: p.stock_item_id,
      kalemAd: p.stock_item?.name ?? '—',
      kalemKodu: p.stock_item?.code ?? '—',
      // Bu listede `expires_on` dolu olmayan satır yok (sorgu süzüyor).
      skt: p.expires_on as string,
      uretimPartisiMi: p.origin_type === 'PRODUCTION',
      isEmriId: p.origin_type === 'PRODUCTION' ? (p.origin_id ?? undefined) : undefined,
      saklamaKosulu: p.stock_item?.storage_condition ?? undefined,
      acikRafOmruGun: p.stock_item?.opened_shelf_life_days ?? undefined,
      numunesiVar: numunesiOlanlar.has(p.id),
    }))
  }

  /**
   * ⚠️ `stock_item_id`, `storage_condition`, `keep_until` ve
   * `sample_code_key` NOT NULL olduğu için gönderilmek zorunda; ama DÖRDÜ DE
   * SUNUCUDA EZİLİYOR (0093/0094 tetikleri karttan, partiden ve koddan
   * türetiyor). PostgreSQL NOT NULL denetimini BEFORE tetiğinden SONRA
   * yaptığı için `null` göndermek de geçerli.
   *
   * ⚠️ Buraya anlamlı bir tahmin yazmak — örneğin saklama sonunu ekranda
   * hesaplamak — "ekran biliyor" izlenimi verirdi ve bir gün sunucudan
   * ayrışırdı. Bilinçli olarak yer tutucu gönderiliyor; gerçek değerler
   * listeyi yenilerken sunucudan okunuyor.
   */
  async numuneAl(ctx: TenantCtx, girdi: YeniNumune): Promise<void> {
    const { error } = await this.client
      .from('witness_sample')
      .insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        // Sunucu partiden türetiyor; yine de NOT NULL olduğu için gönderiliyor.
        stock_item_id: null,
        lot_id: girdi.lotId,
        work_order_id: girdi.isEmriId ?? null,
        sample_code: girdi.kod,
        // Sunucu `app.kimlik_anahtari()` ile türetiyor (0094). Yerel ayarla
        // küçültmek burada bir hata olurdu: 'ISTANBUL' → 'ıstanbul'.
        sample_code_key: girdi.kod.trim(),
        storage_condition: '-',
        keep_until: new Date().toISOString().slice(0, 10),
        note: girdi.not?.trim() ? girdi.not.trim() : null,
      })
    if(error) throw new Error(error.message)
  }

  async olayYaz(ctx: TenantCtx, girdi: YeniNumuneOlayi): Promise<void> {
    const { error } = await this.client
      .from('witness_sample_event')
      .insert({
        tenant_id: ctx.tenantId,
        sample_id: girdi.numuneId,
        event_type: girdi.tip,
        reason: girdi.gerekce.trim(),
        result: girdi.sonuc?.trim() ? girdi.sonuc.trim() : null,
      })
    if(error) throw new Error(error.message)
  }
}
