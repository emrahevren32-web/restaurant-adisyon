// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C2 — Sipariş defteri deposu
//
// Yol haritası: sipariş belgesi · revizyon append-only · değişikliğin kaynağı
// · durum akışı · sipariş–teslim farkı.
//
// Biçim müşteri (0047) ve tedarikçi (0017) depolarıyla aynı: port + Postgres
// uygulaması (ADR-003).
//
// ⚠️ Kiracı süzmesini bu sınıf YAPMAZ, RLS yapar (ADR-004). `ctx.tenantId`
// yalnız YAZARKEN not-null sütunu doldurur.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'

export type SiparisDurumu =
  | 'Taslak' | 'Onaylandı' | 'Hazırlanıyor' | 'Hazır'
  | 'Kısmi Sevk' | 'Sevk Edildi' | 'Teslim Edildi' | 'İptal'

/** MIKTAR satırları değiştirir; LOJISTIK yalnız teslim bilgisini. */
export type RevizyonTuru = 'MIKTAR' | 'LOJISTIK'

/** "Kaynağı olmayan değişiklik, sonradan sahibi olmayan değişikliktir." */
export type RevizyonKaynagi =
  'Telefon' | 'Portal' | 'E-posta' | 'WhatsApp' | 'Yüz Yüze' | 'Sistem'

export type FarkTuru = 'Eksik' | 'Fazla' | 'Hasarlı' | 'Yanlış ürün'

export type FarkAdimi =
  'Üretim' | 'Paketleme' | 'Yükleme' | 'Yolda' | 'Teslimde'
  | 'Müşteri bildirdi' | 'Sayımda'

export type FarkDurumu = 'Açık' | 'İncelemede' | 'Karara Bağlandı'

export type FarkKarari =
  'Tamamlanacak' | 'Sorumlu Bulundu' | 'Müşteri Hatası' | 'Diğer'

export type Siparis = {
  id: string
  siparisNo: string
  musteriId: string
  musteriAdi?: string
  noktaId?: string
  noktaAdi?: string
  siparisTarihi: string
  sevkTarihi?: string
  teslimTarihi?: string
  durum: SiparisDurumu
  guncelRevizyon: number
  not?: string
  olusturmaZamani: string
}

export type SiparisSatiri = {
  id: string
  siraNo: number
  kalemId: string
  kalemAdi?: string
  miktar: number
  birim: string
  birimFiyat?: number
  paraBirimi?: string
  revizyonNo: number
}

export type Revizyon = {
  id: string
  revizyonNo: number
  tur: RevizyonTuru
  kaynak: RevizyonKaynagi
  gerekce: string
  farkId?: string
  olusturanId?: string
  olusturmaZamani: string
  /** Bu revizyonun satırları. LOJİSTİK revizyonunda boş. */
  satirlar: SiparisSatiri[]
}

export type Fark = {
  id: string
  siparisId: string
  sevkiyatId?: string
  kalemId?: string
  kalemAdi?: string
  tur: FarkTuru
  miktar?: number
  birim?: string
  adim: FarkAdimi
  bildirenId: string
  bildirenAdi?: string
  bildirimZamani: string
  aciklama: string
  durum: FarkDurumu
  karar?: FarkKarari
  sorumluId?: string
  kararNotu?: string
  kararVerenId?: string
  kararZamani?: string
}

export type SiparisOlayi = {
  id: number
  tur: string
  oncekiDurum?: string
  yeniDurum?: string
  ayrinti?: string
  zaman: string
}

export type YeniSiparis = {
  siparisNo: string
  musteriId: string
  noktaId?: string
  sevkTarihi?: string
  teslimTarihi?: string
  not?: string
  satirlar: YeniSatir[]
}

export type YeniSatir = {
  kalemId: string
  miktar: number
  birim: string
  birimFiyat?: number
  paraBirimi?: string
  not?: string
}

export type YeniRevizyon = {
  siparisId: string
  tur: RevizyonTuru
  kaynak: RevizyonKaynagi
  gerekce: string
  farkId?: string
  /** LOJİSTİK revizyonunda BOŞ olmalı. */
  satirlar?: YeniSatir[]
  /** LOJİSTİK revizyonunda değişen teslim bilgileri. */
  noktaId?: string
  sevkTarihi?: string
  teslimTarihi?: string
}

export type YeniFark = {
  siparisId: string
  sevkiyatId?: string
  kalemId?: string
  tur: FarkTuru
  miktar?: number
  birim?: string
  adim: FarkAdimi
  aciklama: string
}

export type FarkKarariGirdisi = {
  karar: FarkKarari
  sorumluId?: string
  kararNotu?: string
}

export interface SiparisDeposu {
  hepsi(ctx: TenantCtx): Promise<Siparis[]>
  ekle(ctx: TenantCtx, girdi: YeniSiparis): Promise<Siparis>
  durumDegistir(ctx: TenantCtx, id: string, durum: SiparisDurumu): Promise<Siparis>
  /** Güncel satırlar = en son SATIRLI revizyonun satırları (0050). */
  guncelSatirlar(ctx: TenantCtx, siparisId: string): Promise<SiparisSatiri[]>
  /** Bütün revizyonlar, satırlarıyla. Değişiklik geçmişi ekranı bunu okur. */
  revizyonlar(ctx: TenantCtx, siparisId: string): Promise<Revizyon[]>
  revizyonEkle(ctx: TenantCtx, girdi: YeniRevizyon): Promise<void>
  farklar(ctx: TenantCtx, siparisId: string): Promise<Fark[]>
  farkAc(ctx: TenantCtx, girdi: YeniFark): Promise<Fark>
  farkiKararaBagla(ctx: TenantCtx, farkId: string, girdi: FarkKarariGirdisi): Promise<Fark>
  olaylar(ctx: TenantCtx, siparisId: string): Promise<SiparisOlayi[]>
}

export class SiparisNoCakismasiError extends Error {
  constructor(no: string) {
    super(`"${no}" sipariş numarası zaten kullanılıyor.`)
    this.name = 'SiparisNoCakismasiError'
  }
}

const bos = (d: unknown): string | undefined => {
  const m = typeof d === 'string' ? d.trim() : ''
  return m === '' ? undefined : m
}
const sayi = (d: unknown): number | undefined =>
  d === null || d === undefined ? undefined : Number(d)

const TEKILLIK = '23505'

// ⚠️ Sütun listeleri TEK PARÇA metin olmak zorunda (tuzak 40): `+` ile
// birleştirilirse supabase-js tip çözücüsü okuyamıyor ve `data`
// `GenericStringError[]` oluyor.
const SIPARIS_SUTUNLARI = 'id, order_no, customer_id, delivery_point_id, order_date, requested_ship_date, requested_delivery_date, status, current_revision, note, created_at, customer(name), delivery_point(name)'
const SATIR_SUTUNLARI = 'id, line_no, stock_item_id, qty, uom_code, unit_price, currency, note, revision_id, stock_item(name)'
const REVIZYON_SUTUNLARI = 'id, revision_no, kind, source, reason, discrepancy_id, created_by, created_at'
const FARK_SUTUNLARI = 'id, order_id, shipment_id, stock_item_id, kind, qty, uom_code, noticed_step, noticed_by, noticed_at, description, status, resolution, responsible_user_id, decision_note, decided_by, decided_at, stock_item(name), app_user!order_discrepancy_noticed_by_fkey(full_name)'
const OLAY_SUTUNLARI = 'id, kind, from_status, to_status, detail, created_at'

type SiparisSatir = {
  id: string; order_no: string; customer_id: string
  delivery_point_id: string | null; order_date: string
  requested_ship_date: string | null; requested_delivery_date: string | null
  status: string; current_revision: number; note: string | null; created_at: string
  customer: { name: string } | null
  delivery_point: { name: string } | null
}

const siparise = (s: SiparisSatir): Siparis => ({
  id: s.id,
  siparisNo: s.order_no,
  musteriId: s.customer_id,
  musteriAdi: s.customer?.name,
  noktaId: s.delivery_point_id ?? undefined,
  noktaAdi: s.delivery_point?.name,
  siparisTarihi: s.order_date,
  sevkTarihi: bos(s.requested_ship_date),
  teslimTarihi: bos(s.requested_delivery_date),
  durum: s.status as SiparisDurumu,
  guncelRevizyon: s.current_revision,
  not: bos(s.note),
  olusturmaZamani: s.created_at,
})

type SatirSatiri = {
  id: string; line_no: number; stock_item_id: string
  qty: string | number; uom_code: string
  unit_price: string | number | null; currency: string | null
  note: string | null; revision_id: string
  stock_item: { name: string } | null
}

const satira = (s: SatirSatiri, revizyonNo: number): SiparisSatiri => ({
  id: s.id,
  siraNo: s.line_no,
  kalemId: s.stock_item_id,
  kalemAdi: s.stock_item?.name,
  miktar: Number(s.qty),
  birim: s.uom_code,
  birimFiyat: sayi(s.unit_price),
  paraBirimi: bos(s.currency),
  revizyonNo,
})

type FarkSatiri = {
  id: string; order_id: string; shipment_id: string | null
  stock_item_id: string | null; kind: string
  qty: string | number | null; uom_code: string | null
  noticed_step: string; noticed_by: string; noticed_at: string
  description: string; status: string; resolution: string | null
  responsible_user_id: string | null; decision_note: string | null
  decided_by: string | null; decided_at: string | null
  stock_item: { name: string } | null
  app_user: { full_name: string | null } | null
}

const farka = (s: FarkSatiri): Fark => ({
  id: s.id,
  siparisId: s.order_id,
  sevkiyatId: s.shipment_id ?? undefined,
  kalemId: s.stock_item_id ?? undefined,
  kalemAdi: s.stock_item?.name,
  tur: s.kind as FarkTuru,
  miktar: sayi(s.qty),
  birim: bos(s.uom_code),
  adim: s.noticed_step as FarkAdimi,
  bildirenId: s.noticed_by,
  bildirenAdi: bos(s.app_user?.full_name ?? undefined),
  bildirimZamani: s.noticed_at,
  aciklama: s.description,
  durum: s.status as FarkDurumu,
  karar: (s.resolution ?? undefined) as FarkKarari | undefined,
  sorumluId: s.responsible_user_id ?? undefined,
  kararNotu: bos(s.decision_note),
  kararVerenId: s.decided_by ?? undefined,
  kararZamani: bos(s.decided_at),
})

export class PostgresSiparisDeposu implements SiparisDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async hepsi(_ctx: TenantCtx): Promise<Siparis[]> {
    const { data, error } = await this.client
      .from('sales_order').select(SIPARIS_SUTUNLARI)
      .order('order_date', { ascending: false })
      .order('order_no', { ascending: false })
    if(error) throw new Error(`Siparişler okunamadı: ${error.message}`)
    return ((data as unknown as SiparisSatir[] | null) ?? []).map(siparise)
  }

  /**
   * Sipariş + revizyon 1 + satırlar.
   *
   * ⚠️ Üç ayrı yazım ve aralarında işlem YOK: PostgREST tek çağrıda çok
   * tablolu işlem açmıyor. Satır yazımı düşerse başlık ortada kalır — o
   * yüzden sipariş TASLAK doğuyor: yarım kalmış bir taslak, yarım kalmış
   * bir onaylı siparişten çok daha az zararlı. Servis, satırsız taslağı
   * onaya sokmuyor.
   */
  async ekle(ctx: TenantCtx, girdi: YeniSiparis): Promise<Siparis> {
    const { data: bas, error: basHata } = await this.client
      .from('sales_order')
      .insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        order_no: girdi.siparisNo.trim(),
        customer_id: girdi.musteriId,
        delivery_point_id: girdi.noktaId ?? null,
        requested_ship_date: girdi.sevkTarihi ?? null,
        requested_delivery_date: girdi.teslimTarihi ?? null,
        note: bos(girdi.not) ?? null,
        created_by: ctx.userId,
      })
      .select(SIPARIS_SUTUNLARI).single()
    if(basHata){
      if(basHata.code === TEKILLIK) throw new SiparisNoCakismasiError(girdi.siparisNo)
      throw new Error(`Sipariş açılamadı: ${basHata.message}`)
    }
    const siparis = siparise(bas as unknown as SiparisSatir)

    const { data: rev, error: revHata } = await this.client
      .from('sales_order_revision')
      .insert({
        tenant_id: ctx.tenantId, order_id: siparis.id, revision_no: 1,
        kind: 'MIKTAR', source: 'Telefon', reason: 'İlk sipariş',
        created_by: ctx.userId,
      })
      .select('id').single()
    if(revHata) throw new Error(`Sipariş revizyonu yazılamadı: ${revHata.message}`)

    await this.satirlariYaz(ctx, siparis.id, (rev as { id: string }).id, girdi.satirlar)
    return siparis
  }

  private async satirlariYaz(
    ctx: TenantCtx, siparisId: string, revizyonId: string, satirlar: YeniSatir[],
  ): Promise<void> {
    if(satirlar.length === 0) return
    const { error } = await this.client.from('sales_order_line').insert(
      satirlar.map((s, i) => ({
        tenant_id: ctx.tenantId,
        order_id: siparisId,
        revision_id: revizyonId,
        line_no: i + 1,
        stock_item_id: s.kalemId,
        qty: s.miktar,
        uom_code: s.birim.trim(),
        unit_price: s.birimFiyat ?? null,
        currency: s.paraBirimi ?? 'TRY',
        note: bos(s.not) ?? null,
      })),
    )
    if(error) throw new Error(`Sipariş satırları yazılamadı: ${error.message}`)
  }

  async durumDegistir(_ctx: TenantCtx, id: string, durum: SiparisDurumu): Promise<Siparis> {
    const { data, error } = await this.client
      .from('sales_order').update({ status: durum }).eq('id', id)
      .select(SIPARIS_SUTUNLARI).single()
    if(error) throw new Error(`Sipariş durumu değiştirilemedi: ${error.message}`)
    return siparise(data as unknown as SiparisSatir)
  }

  async guncelSatirlar(_ctx: TenantCtx, siparisId: string): Promise<SiparisSatiri[]> {
    // ⚠️ `app.siparis_guncel_satirlari` DEĞİL — PostgREST yalnız `public`
    // şemasını yayınlıyor (tuzak, 0048'de de yaşandı). Kuralı burada
    // TEKRARLAMAMAK için bütün revizyonları okuyup en son satırlıyı
    // seçiyoruz: kural "en son satırlı revizyon" tek cümle ve iki yerde
    // yazılması riski yok.
    const revizyonlar = await this.revizyonlar(_ctx, siparisId)
    const satirli = revizyonlar.filter(r => r.satirlar.length > 0)
    if(satirli.length === 0) return []
    return satirli[satirli.length - 1].satirlar
  }

  async revizyonlar(_ctx: TenantCtx, siparisId: string): Promise<Revizyon[]> {
    const { data, error } = await this.client
      .from('sales_order_revision').select(REVIZYON_SUTUNLARI)
      .eq('order_id', siparisId).order('revision_no')
    if(error) throw new Error(`Revizyonlar okunamadı: ${error.message}`)

    const { data: satirVerisi, error: satirHata } = await this.client
      .from('sales_order_line').select(SATIR_SUTUNLARI)
      .eq('order_id', siparisId).order('line_no')
    if(satirHata) throw new Error(`Sipariş satırları okunamadı: ${satirHata.message}`)

    type RevSatiri = {
      id: string; revision_no: number; kind: string; source: string
      reason: string; discrepancy_id: string | null
      created_by: string | null; created_at: string
    }
    const satirlar = (satirVerisi as unknown as SatirSatiri[] | null) ?? []
    return ((data as unknown as RevSatiri[] | null) ?? []).map(r => ({
      id: r.id,
      revizyonNo: r.revision_no,
      tur: r.kind as RevizyonTuru,
      kaynak: r.source as RevizyonKaynagi,
      gerekce: r.reason,
      farkId: r.discrepancy_id ?? undefined,
      olusturanId: r.created_by ?? undefined,
      olusturmaZamani: r.created_at,
      satirlar: satirlar.filter(s => s.revision_id === r.id).map(s => satira(s, r.revision_no)),
    }))
  }

  async revizyonEkle(ctx: TenantCtx, girdi: YeniRevizyon): Promise<void> {
    // Sıradaki revizyon numarası defterden okunuyor; ekranın saydığı sayıya
    // güvenmiyoruz (iki kişi aynı anda revizyon açarsa numara çakışır ve
    // tekillik kısıtı reddeder — doğru davranış).
    const mevcut = await this.revizyonlar(ctx, girdi.siparisId)
    const sonraki = Math.max(0, ...mevcut.map(r => r.revizyonNo)) + 1

    const { data, error } = await this.client
      .from('sales_order_revision')
      .insert({
        tenant_id: ctx.tenantId,
        order_id: girdi.siparisId,
        revision_no: sonraki,
        kind: girdi.tur,
        source: girdi.kaynak,
        reason: girdi.gerekce.trim(),
        discrepancy_id: girdi.farkId ?? null,
        created_by: ctx.userId,
      })
      .select('id').single()
    if(error) throw new Error(`Revizyon açılamadı: ${error.message}`)

    if(girdi.tur === 'MIKTAR' && girdi.satirlar){
      await this.satirlariYaz(ctx, girdi.siparisId, (data as { id: string }).id, girdi.satirlar)
    }

    // Lojistik revizyonu teslim bilgisini değiştirir. Başlık güncellemesi
    // revizyondan SONRA: revizyon yazılamazsa başlık da değişmemiş olur.
    if(girdi.tur === 'LOJISTIK'){
      const yama: Record<string, unknown> = {}
      if(girdi.noktaId !== undefined) yama.delivery_point_id = girdi.noktaId || null
      if(girdi.sevkTarihi !== undefined) yama.requested_ship_date = girdi.sevkTarihi || null
      if(girdi.teslimTarihi !== undefined) yama.requested_delivery_date = girdi.teslimTarihi || null
      if(Object.keys(yama).length > 0){
        const { error: bHata } = await this.client
          .from('sales_order').update(yama).eq('id', girdi.siparisId)
        if(bHata) throw new Error(`Teslim bilgisi güncellenemedi: ${bHata.message}`)
      }
    }

    const { error: rHata } = await this.client
      .from('sales_order').update({ current_revision: sonraki }).eq('id', girdi.siparisId)
    if(rHata) throw new Error(`Revizyon numarası güncellenemedi: ${rHata.message}`)
  }

  async farklar(_ctx: TenantCtx, siparisId: string): Promise<Fark[]> {
    const { data, error } = await this.client
      .from('order_discrepancy').select(FARK_SUTUNLARI)
      .eq('order_id', siparisId).order('noticed_at', { ascending: false })
    if(error) throw new Error(`Fark kayıtları okunamadı: ${error.message}`)
    return ((data as unknown as FarkSatiri[] | null) ?? []).map(farka)
  }

  async farkAc(ctx: TenantCtx, girdi: YeniFark): Promise<Fark> {
    const { data, error } = await this.client
      .from('order_discrepancy')
      .insert({
        tenant_id: ctx.tenantId,
        order_id: girdi.siparisId,
        shipment_id: girdi.sevkiyatId ?? null,
        stock_item_id: girdi.kalemId ?? null,
        kind: girdi.tur,
        qty: girdi.miktar ?? null,
        uom_code: bos(girdi.birim) ?? null,
        noticed_step: girdi.adim,
        // ⚠️ Bayrağı kaldıran KİŞİ oturumdan geliyor, formdan DEĞİL.
        // Emrah: "farkı açan kişi farkı fark eden kişi olmalı."
        noticed_by: ctx.userId,
        description: girdi.aciklama.trim(),
      })
      .select(FARK_SUTUNLARI).single()
    if(error) throw new Error(`Fark kaydı açılamadı: ${error.message}`)
    return farka(data as unknown as FarkSatiri)
  }

  async farkiKararaBagla(
    ctx: TenantCtx, farkId: string, girdi: FarkKarariGirdisi,
  ): Promise<Fark> {
    const { data, error } = await this.client
      .from('order_discrepancy')
      .update({
        status: 'Karara Bağlandı',
        resolution: girdi.karar,
        responsible_user_id: girdi.sorumluId ?? null,
        decision_note: bos(girdi.kararNotu) ?? null,
        decided_by: ctx.userId,
        decided_at: new Date().toISOString(),
      })
      .eq('id', farkId)
      .select(FARK_SUTUNLARI).single()
    if(error) throw new Error(`Fark kararı yazılamadı: ${error.message}`)
    return farka(data as unknown as FarkSatiri)
  }

  async olaylar(_ctx: TenantCtx, siparisId: string): Promise<SiparisOlayi[]> {
    const { data, error } = await this.client
      .from('sales_order_event').select(OLAY_SUTUNLARI)
      .eq('order_id', siparisId).order('created_at')
    if(error) throw new Error(`Sipariş olayları okunamadı: ${error.message}`)
    type OlaySatiri = {
      id: number; kind: string; from_status: string | null
      to_status: string | null; detail: string | null; created_at: string
    }
    return ((data as unknown as OlaySatiri[] | null) ?? []).map(o => ({
      id: o.id,
      tur: o.kind,
      oncekiDurum: bos(o.from_status),
      yeniDurum: bos(o.to_status),
      ayrinti: bos(o.detail),
      zaman: o.created_at,
    }))
  }
}
