// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 / Güven katmanı — Zayi defteri (okuma tarafı)
//
// Yol haritası maddesi:
//   "Fire, zayi, SKT geçmiş lot imhası → üçü de AYRI sebep koduyla deftere"
//
// ── BU DOSYA NEDEN VAR ───────────────────────────────────────────────────
// Üç ayrı sebep kodu yazmanın tek anlamı, sonradan AYRI SORULABİLMESİDİR:
// "bu ay fire oranımız yükseldi mi", "hangi kalemde en çok zayi var",
// "kaç kilo malı SKT'den imha ettik". Kodları ayırıp raporu yazmazsak
// ayırma işi boşa gitmiş olur.
//
// ── NEDEN ÇEKİRDEK DEFTER PORTUNA EKLENMEDİ ──────────────────────────────
// `StockRepository` I1–I12 sözleşmesine bağlı ve kalem bazlı okur
// (`ledgerOf(stokKalemiId)`). Buradaki soru kalem bazlı değil: "TÜM kalemlerde
// şu üç sebep". Sözleşmeyi genişletmek yerine yanına ayrı bir okuma portu
// kuruluyor (ADR-003, dikey dilim). Bu port hiçbir şey YAZMAZ — yazma yolu
// tek: `DepoServisi.cikis()`.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'

/** Fire/zayi/imha sebep kodları — deftere yazılabilecek üç "kayıp" nedeni. */
export const ZAYI_NEDENLERI = ['WASTE', 'LOSS', 'EXPIRY_WRITE_OFF'] as const
export type ZayiNedeni = (typeof ZAYI_NEDENLERI)[number]

export const ZAYI_ETIKETLERI: Record<ZayiNedeni, string> = {
  WASTE: 'Fire',
  LOSS: 'Zayi',
  EXPIRY_WRITE_OFF: 'SKT imhası',
}

/**
 * Üç sebebin farkı — ekranda da bu metinler gösteriliyor, çünkü kullanıcı
 * hangisini seçeceğini bilmezse kodların ayrı olması hiçbir işe yaramaz.
 */
export const ZAYI_ACIKLAMALARI: Record<ZayiNedeni, string> = {
  WASTE: 'İşlenirken bozuldu, döküldü, kesim/ayıklama kaybı.',
  LOSS: 'Kırıldı, kayboldu, çalındı, sayımda bulunamadı.',
  EXPIRY_WRITE_OFF: 'Son kullanma tarihi geçti; satılamaz, kullanılamaz.',
}

export const zayiNedeniMi = (neden: string): neden is ZayiNedeni =>
  (ZAYI_NEDENLERI as readonly string[]).includes(neden)

/** Rapor satırı — defterden okunmuş tek bir kayıp hareketi. */
export type ZayiHareketi = {
  id: string
  tarih: string
  kalemId: string
  kalemAd: string
  kalemKodu: string
  lotKodu?: string
  neden: ZayiNedeni
  /** Temel birimde, POZİTİF gösterilir; defterde negatif durur. */
  miktar: number
  birim: string
  /** Hareket anındaki birim maliyet (varsa) — tutar bundan türetilir. */
  birimMaliyet?: number
  not?: string
}

export type ZayiSorgusu = {
  /** ISO tarih (YYYY-MM-DD), dahil. */
  baslangic?: string
  /** ISO tarih (YYYY-MM-DD), dahil. */
  bitis?: string
}

export interface ZayiDefteri {
  hareketler(ctx: TenantCtx, sorgu?: ZayiSorgusu): Promise<ZayiHareketi[]>
}

type Satir = {
  id: string
  occurred_at: string
  reason: string
  quantity_base: number | string
  unit_cost: number | string | null
  note: string | null
  stock_item_id: string
  stock_item: { code: string; name: string; base_uom: string } | null
  stock_lot: { lot_code: string } | null
}

const satiraCevir = (satir: Satir): ZayiHareketi => ({
  id: satir.id,
  tarih: satir.occurred_at,
  kalemId: satir.stock_item_id,
  kalemAd: satir.stock_item?.name ?? '—',
  kalemKodu: satir.stock_item?.code ?? '—',
  lotKodu: satir.stock_lot?.lot_code ?? undefined,
  neden: satir.reason as ZayiNedeni,
  // Defterde çıkış negatiftir; raporda "kaç kilo kaybettik" okunur, o yüzden
  // mutlak değer. İşareti burada kaybetmek güvenli: sorgu zaten üç çıkış
  // sebebiyle sınırlı, hepsi negatif.
  miktar: Math.abs(Number(satir.quantity_base)),
  birim: satir.stock_item?.base_uom ?? '',
  birimMaliyet: satir.unit_cost === null ? undefined : Number(satir.unit_cost),
  not: satir.note ?? undefined,
})

/**
 * ⚠️ Kiracı süzmesi burada YOK — RLS'in işi (ADR-004). `ctx` yalnızca
 * imzayı tutarlı tutmak için duruyor; burada bir `eq('tenant_id', …)`
 * yazsaydık RLS kapalı olsa bile doğru sonuç görünür, koruma açığı fark
 * edilmezdi.
 */
export class PostgresZayiDefteri implements ZayiDefteri {
  constructor(private readonly client: SupabaseClient) {}

  async hareketler(_ctx: TenantCtx, sorgu: ZayiSorgusu = {}): Promise<ZayiHareketi[]> {
    let q = this.client
      .from('stock_movement')
      .select(`
        id, occurred_at, reason, quantity_base, unit_cost, note, stock_item_id,
        stock_item:stock_item_id ( code, name, base_uom ),
        stock_lot:lot_id ( lot_code )
      `)
      .in('reason', [...ZAYI_NEDENLERI])
      .order('occurred_at', { ascending: false })
      .limit(500)

    if(sorgu.baslangic) q = q.gte('occurred_at', `${sorgu.baslangic}T00:00:00`)
    // Bitiş DAHİL olsun diye günün sonuna kadar: kullanıcı "31 Ağustos'a kadar"
    // dediğinde 31 Ağustos sabahı yazılan hareketi de görmek ister.
    if(sorgu.bitis) q = q.lte('occurred_at', `${sorgu.bitis}T23:59:59.999`)

    const { data, error } = await q
    if(error) throw new Error(`Fire ve zayi kayıtları okunamadı: ${error.message}`)
    return ((data as unknown as Satir[] | null) ?? []).map(satiraCevir)
  }
}
