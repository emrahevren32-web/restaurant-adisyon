// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 / Güven katmanı — Denetim kaydı (okuma tarafı)
//
// ⚠️ Bu dosyada YAZMA yok ve olmayacak. Denetim kaydını tek yazan, veritabanı
// tetikleyicisidir (0027). Uygulamaya yazma yolu açsaydık "atlanması mümkün
// olmayan kayıt" iddiası çökerdi; kaydın bütün değeri atlanamamasından geliyor.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'

export type DenetimIslemi = 'INSERT' | 'UPDATE' | 'DELETE'

export const ISLEM_ETIKETLERI: Record<DenetimIslemi, string> = {
  INSERT: 'Oluşturuldu',
  UPDATE: 'Değiştirildi',
  DELETE: 'Silindi',
}

/**
 * İzlenen tabloların insan dilindeki karşılığı.
 *
 * Ekranda `stock_count_line` yazmak kullanıcıya hiçbir şey anlatmaz —
 * "Sayım satırı" anlatır. Sözlükte olmayan bir tablo adı ham hâliyle
 * gösteriliyor: uydurma bir isim üretmektense teknik adı göstermek dürüst.
 */
export const TABLO_ETIKETLERI: Record<string, string> = {
  stock_count: 'Sayım',
  stock_count_line: 'Sayım satırı',
  shipment: 'Sevkiyat',
  shipment_line: 'Sevkiyat satırı',
  haccp_measurement: 'HACCP ölçümü',
  haccp_corrective_action: 'Düzeltici işlem',
  haccp_ccp: 'Kritik kontrol noktası',
  haccp_plan: 'HACCP planı',
  stock_item: 'Stok kartı',
  stock_lot: 'Lot',
}

export const tabloAdi = (tablo: string) => TABLO_ETIKETLERI[tablo] ?? tablo

/** Alan adları. Eksik bırakmak, yanlış çevirmekten iyidir. */
export const ALAN_ETIKETLERI: Record<string, string> = {
  status: 'Durum',
  count_no: 'Sayım no',
  shipment_no: 'Sevkiyat no',
  expected_qty: 'Beklenen',
  counted_qty: 'Sayılan',
  counted_at: 'Sayım zamanı',
  opened_at: 'Açılış',
  applied_at: 'Uygulama',
  opened_by: 'Açan',
  applied_by: 'Uygulayan',
  note: 'Not',
  name: 'Ad',
  code: 'Kod',
  lot_code: 'Lot kodu',
  expires_on: 'Son kullanma',
  min_qty: 'En az miktar',
  base_uom: 'Temel birim',
  tracks_lot: 'Lot takibi',
  tracks_expiry: 'SKT takibi',
  is_active: 'Aktif',
  customer_name: 'Müşteri',
  shipped_on: 'Sevk tarihi',
  quantity: 'Miktar',
  measured_value: 'Ölçüm',
  supplier_name: 'Tedarikçi',
  movement_id: 'Hareket',
}

export const alanAdi = (alan: string) => ALAN_ETIKETLERI[alan] ?? alan

/**
 * Değeri bir KULLANICI KİMLİĞİ olan alanlar.
 *
 * Denetim kaydında `Uygulayan: (yok) → f3d3aebd…` yazması, kaydı okunmaz
 * yapıyordu — "kim uyguladı" sorusunun cevabı yine bir kimlik numarasıydı.
 * Bu alanların değeri ekranda kullanıcı adına çevriliyor.
 *
 * ⚠️ Çeviri EKRANDA yapılıyor, kayda yazılmıyor: bunlar kaydın kendi
 * "kim" alanı değil, belgenin içindeki referanslar. Kullanıcının adı
 * sonradan değişirse burada güncel ad görünür — ve doğrusu budur, çünkü
 * gösterilen şey "o gün kim yazdı" değil, "belgede kim yazıyor".
 */
export const KULLANICI_ALANLARI = new Set([
  'opened_by', 'applied_by', 'created_by', 'updated_by',
  'measured_by', 'shipped_by', 'actor_user_id',
])

export type AlanDegisimi = { alan: string; eski: unknown; yeni: unknown }

export type DenetimKaydi = {
  id: number
  tarih: string
  tablo: string
  satirId: string
  islem: DenetimIslemi
  aktorAd?: string
  ozet?: string
  /** UPDATE'te değişen alanlar. INSERT/DELETE'te boş. */
  degisimler: AlanDegisimi[]
  /** INSERT/DELETE'te satırın tamamı. */
  kayit?: Record<string, unknown>
}

export type DenetimSorgusu = {
  baslangic?: string
  bitis?: string
  tablo?: string
  islem?: DenetimIslemi
  /** Tek bir belgenin geçmişi — "bu sayıma ne oldu" sorusu. */
  satirId?: string
  limit?: number
}

export interface DenetimDefteri {
  kayitlar(ctx: TenantCtx, sorgu?: DenetimSorgusu): Promise<DenetimKaydi[]>
}

type Satir = {
  id: number
  occurred_at: string
  table_name: string
  row_id: string
  action: string
  actor_name: string | null
  summary: string | null
  changes: Record<string, unknown> | null
}

const KAYIT_ANAHTARI = '_kayit'

const kayitaCevir = (satir: Satir): DenetimKaydi => {
  const ham = satir.changes ?? {}
  const tamKayit = ham[KAYIT_ANAHTARI] as Record<string, unknown> | undefined

  const degisimler: AlanDegisimi[] = tamKayit
    ? []
    : Object.entries(ham)
      .map(([alan, deger]) => {
        const d = deger as { eski?: unknown; yeni?: unknown }
        return { alan, eski: d?.eski, yeni: d?.yeni }
      })
      // Alfabetik: aynı belgenin iki kaydı alt alta gelince alanlar aynı
      // sırada durur ve göz karşılaştırabilir.
      .sort((a, b) => alanAdi(a.alan).localeCompare(alanAdi(b.alan), 'tr'))

  return {
    id: satir.id,
    tarih: satir.occurred_at,
    tablo: satir.table_name,
    satirId: satir.row_id,
    islem: satir.action as DenetimIslemi,
    aktorAd: satir.actor_name ?? undefined,
    ozet: satir.summary ?? undefined,
    degisimler,
    kayit: tamKayit,
  }
}

/**
 * ⚠️ Kiracı süzmesi burada YOK — RLS'in işi (ADR-004). Buraya bir
 * `eq('tenant_id', …)` yazsaydık RLS kapalı olsa bile doğru sonuç görünür,
 * açık fark edilmezdi.
 */
export class PostgresDenetimDefteri implements DenetimDefteri {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Kullanıcı kimliği → ad sözlüğü. Denetim kaydındaki `opened_by`,
   * `applied_by` gibi alanlar ham kimlik taşıyor; ekran bunları buradan
   * çeviriyor. Ad bulunamazsa kimlik olduğu gibi kalır — uydurmuyoruz.
   */
  async kullaniciAdlari(_ctx: TenantCtx): Promise<Record<string, string>> {
    const { data, error } = await this.client
      .from('app_user')
      .select('id, full_name, username')
    if(error) return {}
    const harita: Record<string, string> = {}
    ;((data as Array<{ id: string; full_name: string | null; username: string }> | null) ?? [])
      .forEach(u => { harita[u.id] = (u.full_name || '').trim() || u.username })
    return harita
  }

  async kayitlar(_ctx: TenantCtx, sorgu: DenetimSorgusu = {}): Promise<DenetimKaydi[]> {
    let q = this.client
      .from('audit_log')
      .select('id, occurred_at, table_name, row_id, action, actor_name, summary, changes')
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(sorgu.limit ?? 300)

    if(sorgu.baslangic) q = q.gte('occurred_at', `${sorgu.baslangic}T00:00:00`)
    if(sorgu.bitis) q = q.lte('occurred_at', `${sorgu.bitis}T23:59:59.999`)
    if(sorgu.tablo) q = q.eq('table_name', sorgu.tablo)
    if(sorgu.islem) q = q.eq('action', sorgu.islem)
    if(sorgu.satirId) q = q.eq('row_id', sorgu.satirId)

    const { data, error } = await q
    if(error) throw new Error(`Denetim kaydı okunamadı: ${error.message}`)
    return ((data as unknown as Satir[] | null) ?? []).map(kayitaCevir)
  }
}
