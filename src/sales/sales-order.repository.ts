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
import type { KalemSevkDurumu } from './sales-order-shipment'
import type { KarsilamaSatiri } from './sales-order-production'

export type SiparisDurumu =
  | 'Taslak' | 'Onay Bekliyor' | 'Onaylandı' | 'Hazırlanıyor' | 'Hazır'
  | 'Kısmi Sevk' | 'Sevk Edildi' | 'Teslim Edildi' | 'İptal'

/** Onay zincirinin bir adımının kararı (0053). */
export type OnayKarari = 'Olumlu' | 'Olumsuz' | 'Şartlı'

/**
 * Zincirin bir adımı. `bloklar = true` ise ONAY, false ise GÖRÜŞ.
 *
 * Emrah'ın iki senaryosu (uzun zincir / tek karar verici) AYNI yapıyla
 * kuruluyor: uzun zincir isteyen adımların hepsini `bloklar` yapar.
 */
export type OnayAdimi = {
  id: string
  kod: string
  ad: string
  sira: number
  bloklar: boolean
  izinKodu: string
  aktif: boolean
}

export type Onay = {
  id: string
  siparisId: string
  revizyonNo: number
  adimKodu: string
  karar: OnayKarari
  not?: string
  /** "Şu tarihe kadar hazır olur." Şartlı kararda ZORUNLU. */
  sozTarihi?: string
  karariVerenId?: string
  karariVerenAd?: string
  zaman: string
}

export type YeniOnay = {
  siparisId: string
  revizyonNo: number
  adimKodu: string
  karar: OnayKarari
  not?: string
  sozTarihi?: string
}

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
  /**
   * Onay zincirinin SÖZ VERDİĞİ teslim tarihi (0053). `teslimTarihi`
   * müşterinin İSTEDİĞİ tarihtir; bu, mutfağın taahhüdü. İkisi ayrı
   * duruyor ki sözün tutulup tutulmadığı ölçülebilsin.
   */
  sozVerilenTarih?: string
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
  /**
   * Siparişin yazıldığı andaki KDV oranı (%) — DONMUŞ (0052). Kalemin oranı
   * sonradan değişse bile bu satır değişmez; fiyat defterindeki kuralın
   * aynısı. BOŞ = kalem kartında oran girilmemiş.
   */
  kdvOrani?: number
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

/**
 * `app.siparis_sevk_durumu()` satırı — ham hâliyle (0051).
 * TS karşılığı `sales-order-shipment.ts` içindeki `KalemSevkDurumu`.
 */
type SevkDurumuSatiri = {
  kalem_id: string
  siparis_miktar: string | number | null
  siparis_birim: string | null
  sevk_miktar: string | number | null
  sevk_birimleri: string[] | null
  kalan: string | number | null
  birim_uyusmuyor: boolean
  siparis_disi: boolean
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
  /** Kalem kalem: sipariş / sevk edilmiş / KALAN (0051). */
  sevkDurumu(ctx: TenantCtx, siparisId: string): Promise<KalemSevkDurumu[]>
  /** Kiracının onay zinciri (0053). */
  onayAdimlari(ctx: TenantCtx): Promise<OnayAdimi[]>
  onaylar(ctx: TenantCtx, siparisId: string): Promise<Onay[]>
  onayVer(ctx: TenantCtx, girdi: YeniOnay): Promise<void>
  /** Kalem kalem: depodan ne kadar, üretimden ne kadar (0056). */
  karsilamaPlani(ctx: TenantCtx, siparisId: string): Promise<KarsilamaSatiri[]>
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
const SIPARIS_SUTUNLARI = 'id, order_no, customer_id, delivery_point_id, order_date, requested_ship_date, requested_delivery_date, promised_delivery_date, status, current_revision, note, created_at, customer(name), delivery_point(name)'
const SATIR_SUTUNLARI = 'id, line_no, stock_item_id, qty, uom_code, unit_price, currency, vat_rate, note, revision_id, stock_item(name)'
const REVIZYON_SUTUNLARI = 'id, revision_no, kind, source, reason, discrepancy_id, created_by, created_at'
const FARK_SUTUNLARI = 'id, order_id, shipment_id, stock_item_id, kind, qty, uom_code, noticed_step, noticed_by, noticed_at, description, status, resolution, responsible_user_id, decision_note, decided_by, decided_at, stock_item(name), app_user!order_discrepancy_noticed_by_fkey(full_name)'
const ADIM_SUTUNLARI = 'id, code, name, sort_order, required, permission_code, is_active'
const ONAY_SUTUNLARI = 'id, order_id, revision_no, step_code, decision, note, promised_on, decided_by, decided_at, app_user(full_name)'
const OLAY_SUTUNLARI = 'id, kind, from_status, to_status, detail, created_at'

type SiparisSatir = {
  id: string; order_no: string; customer_id: string
  delivery_point_id: string | null; order_date: string
  requested_ship_date: string | null; requested_delivery_date: string | null
  promised_delivery_date: string | null
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
  sozVerilenTarih: bos(s.promised_delivery_date),
  durum: s.status as SiparisDurumu,
  guncelRevizyon: s.current_revision,
  not: bos(s.note),
  olusturmaZamani: s.created_at,
})

type SatirSatiri = {
  id: string; line_no: number; stock_item_id: string
  qty: string | number; uom_code: string
  unit_price: string | number | null; currency: string | null
  vat_rate: string | number | null
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
  kdvOrani: sayi(s.vat_rate),
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

  /**
   * Kalem kalem sevk durumu — 0051'deki `public.siparis_sevk_durumu`.
   *
   * ⚠️ Hesap TABLODA, burada değil. Tarayıcıda toplasaydık iki çağrı arasında
   * yazılan bir sevkiyat sessizce kaçardı ve kalan yanlış çıkardı.
   *
   * ⚠️ `kalan` null gelebilir: birimler uyuşmuyorsa veritabanı çıkarma
   * YAPMIYOR. Burada 0'a çevirmek, bilmediğimiz bir şeyi "bitti" diye
   * göstermek olurdu.
   */
  async sevkDurumu(_ctx: TenantCtx, siparisId: string): Promise<KalemSevkDurumu[]> {
    const { data, error } = await this.client
      .rpc('siparis_sevk_durumu', { p_siparis: siparisId })
    if(error) throw new Error(`Sevk durumu okunamadı: ${error.message}`)
    return ((data as unknown as SevkDurumuSatiri[] | null) ?? []).map(r => {
      const d: KalemSevkDurumu = {
        kalemId: r.kalem_id,
        sevkMiktar: sayi(r.sevk_miktar) ?? 0,
        sevkBirimleri: r.sevk_birimleri ?? [],
        birimUyusmuyor: r.birim_uyusmuyor,
        siparisDisi: r.siparis_disi,
      }
      const sip = sayi(r.siparis_miktar)
      if(sip !== undefined) d.siparisMiktar = sip
      const bir = bos(r.siparis_birim)
      if(bir !== undefined) d.siparisBirim = bir
      const kalan = sayi(r.kalan)
      if(kalan !== undefined) d.kalan = kalan
      return d
    })
  }

  // ── Onay zinciri (0053) ─────────────────────────────────────────────────
  async onayAdimlari(_ctx: TenantCtx): Promise<OnayAdimi[]> {
    const { data, error } = await this.client
      .from('order_approval_step').select(ADIM_SUTUNLARI).order('sort_order')
    if(error) throw new Error(`Onay adımları okunamadı: ${error.message}`)
    type AdimSatiri = {
      id: string; code: string; name: string; sort_order: number
      required: boolean; permission_code: string; is_active: boolean
    }
    return ((data as unknown as AdimSatiri[] | null) ?? []).map(a => ({
      id: a.id, kod: a.code, ad: a.name, sira: a.sort_order,
      bloklar: a.required, izinKodu: a.permission_code, aktif: a.is_active,
    }))
  }

  async onaylar(_ctx: TenantCtx, siparisId: string): Promise<Onay[]> {
    const { data, error } = await this.client
      .from('order_approval').select(ONAY_SUTUNLARI)
      .eq('order_id', siparisId).order('decided_at')
    if(error) throw new Error(`Onaylar okunamadı: ${error.message}`)
    type OnaySatiri = {
      id: string; order_id: string; revision_no: number; step_code: string
      decision: string; note: string | null; promised_on: string | null
      decided_by: string | null; decided_at: string
      app_user: { full_name: string } | null
    }
    return ((data as unknown as OnaySatiri[] | null) ?? []).map(o => {
      const k: Onay = {
        id: o.id, siparisId: o.order_id, revizyonNo: o.revision_no,
        adimKodu: o.step_code, karar: o.decision as OnayKarari,
        zaman: o.decided_at,
      }
      const n = bos(o.note);                 if(n !== undefined) k.not = n
      const t = bos(o.promised_on);          if(t !== undefined) k.sozTarihi = t
      if(o.decided_by) k.karariVerenId = o.decided_by
      const ad = bos(o.app_user?.full_name); if(ad !== undefined) k.karariVerenAd = ad
      return k
    })
  }

  /**
   * ⚠️ `decided_by` KULLANICIDAN GELMİYOR, oturumdan geliyor.
   *
   * Emrah'ın kuralı farkta neyse onayda da o: kararı veren, kararı VEREN
   * kişidir. Formda bir isim alanı olsaydı, herkes herkesin adına onay
   * verebilirdi ve zincirin hiçbir anlamı kalmazdı.
   */
  async onayVer(ctx: TenantCtx, girdi: YeniOnay): Promise<void> {
    const { error } = await this.client.from('order_approval').insert({
      tenant_id: ctx.tenantId,
      order_id: girdi.siparisId,
      revision_no: girdi.revizyonNo,
      step_code: girdi.adimKodu,
      decision: girdi.karar,
      note: bos(girdi.not) ?? null,
      promised_on: bos(girdi.sozTarihi) ?? null,
      decided_by: ctx.userId,
    })
    if(error) throw new Error(`Onay yazılamadı: ${error.message}`)
  }

  /**
   * Karşılama planı — 0056'daki `public.siparis_karsilama_plani`.
   *
   * ⚠️ Hesap TABLODA. Depo bakiyesi ile başka siparişlerin rezervi iki ayrı
   * sorgudan gelseydi, aradaki saniyede yazılan bir sipariş sessizce kaçar
   * ve aynı mal iki kez vaat edilirdi.
   */
  async karsilamaPlani(_ctx: TenantCtx, siparisId: string): Promise<KarsilamaSatiri[]> {
    const { data, error } = await this.client
      .rpc('siparis_karsilama_plani', { p_siparis: siparisId })
    if(error) throw new Error(`Karşılama planı okunamadı: ${error.message}`)
    type S = {
      kalem_id: string; kalem_adi: string
      siparis_miktar: string | number; birim: string; temel_birim: string
      birim_uyusmuyor: boolean
      depo_bakiye: string | number; rezerve: string | number
      musait: string | number | null; depodan: string | number | null
      uretilecek: string | number | null
      recete_id: string | null; uretilebilir: boolean
    }
    return ((data as unknown as S[] | null) ?? []).map(r => {
      const k: KarsilamaSatiri = {
        kalemId: r.kalem_id,
        kalemAdi: r.kalem_adi,
        siparisMiktar: Number(r.siparis_miktar),
        birim: r.birim,
        temelBirim: r.temel_birim,
        birimUyusmuyor: r.birim_uyusmuyor,
        depoBakiye: Number(r.depo_bakiye),
        rezerve: Number(r.rezerve),
        uretilebilir: r.uretilebilir,
      }
      // ⚠️ null → undefined, 0 DEĞİL. Birim uyuşmazlığında veritabanı
      // bilerek hesap yapmıyor; 0 yazmak "ihtiyaç yok" demek olurdu.
      const m = sayi(r.musait);       if(m !== undefined) k.musait = m
      const d = sayi(r.depodan);      if(d !== undefined) k.depodan = d
      const u = sayi(r.uretilecek);   if(u !== undefined) k.uretilecek = u
      if(r.recete_id) k.receteId = r.recete_id
      return k
    })
  }
}
