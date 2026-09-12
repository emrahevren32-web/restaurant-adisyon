// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 / Güven katmanı — Sayım belgesi deposu
//
// ⚠️ Bu dosyada BAKİYE hesaplanmaz. Beklenen miktar sayım AÇILIRKEN defterden
// okunup satıra dondurulur; sonrasında kimse yeniden hesaplamaz. Sebebi
// kilittir: sayım açıkken o kaleme hareket yazılamadığı için beklenen miktar
// değişemez. Değişmişse bir yerde kilit delinmiştir ve bunu GÖRMEK isteriz —
// sessizce yeniden hesaplayıp üstünü örtmek, sayımı anlamsız kılardı.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'

export type SayimDurumu = 'DRAFT' | 'OPEN' | 'APPLIED' | 'CANCELLED'

export const SAYIM_DURUM_ETIKETLERI: Record<SayimDurumu, string> = {
  DRAFT: 'Hazırlanıyor',
  OPEN: 'Sayım sürüyor',
  APPLIED: 'Uygulandı',
  CANCELLED: 'İptal',
}

/**
 * Durum geçişleri, kod olarak değil VERİ olarak.
 *
 * Uygulanmış bir sayımdan geri dönüş YOK: farklar deftere yazıldı, geri almak
 * ayrı bir iştir (ters kayıt). İptal yalnızca deftere hiçbir şey yazılmadan
 * yapılabilir.
 */
export const SAYIM_GECISLERI: Readonly<Record<SayimDurumu, readonly SayimDurumu[]>> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['APPLIED', 'CANCELLED'],
  APPLIED: [],
  CANCELLED: [],
}

export type SayimSatiri = {
  id: string
  siraNo: number
  stokKalemiId: string
  stokKalemiAd?: string
  stokKalemiKod?: string
  lotId?: string
  lotKodu?: string
  sonKullanma?: string
  /** Sayım açıldığı andaki defter bakiyesi, temel birimde. Dondurulmuştur. */
  beklenen: number
  /** Fiziksel sayım sonucu. `undefined` = HENÜZ SAYILMADI (0 ile aynı şey değil). */
  sayilan?: number
  birim: string
  hareketId?: string
  not?: string
  sayimZamani?: string
}

export type Sayim = {
  id: string
  sayimNo: string
  durum: SayimDurumu
  not?: string
  acilisZamani?: string
  uygulamaZamani?: string
  olusturmaTarihi: string
  satirlar: SayimSatiri[]
}

export type YeniSayimSatiri = {
  stokKalemiId: string
  lotId?: string
  beklenen: number
  birim: string
}

export type YeniSayim = {
  sayimNo: string
  not?: string
  satirlar: YeniSayimSatiri[]
}

export interface SayimDeposu {
  hepsi(ctx: TenantCtx): Promise<Sayim[]>
  tekil(ctx: TenantCtx, id: string): Promise<Sayim>
  /** Açık sayımlar — kilit uyarısını ekranda göstermek için. */
  acikOlanlar(ctx: TenantCtx): Promise<Sayim[]>
  ekle(ctx: TenantCtx, girdi: YeniSayim): Promise<Sayim>
  satirlariDegistir(ctx: TenantCtx, sayimId: string, satirlar: YeniSayimSatiri[]): Promise<Sayim>
  sayilaniYaz(ctx: TenantCtx, satirId: string, sayilan: number, not?: string): Promise<void>
  /**
   * Girilmiş bir sayım sonucunu SİLER — satır "sayılmadı"ya döner.
   *
   * Yanlış rakam girip düzeltmek kolaydır; asıl eksik olan GERİ ALMAKTI.
   * Kullanıcı kutuyu boşaltıp başka yere tıkladığında ekran boş, belge dolu
   * kalıyordu: ikisi ayrışınca ekranda "sayılmadı" görünen bir satır sessizce
   * deftere hareket yazıyordu. Bu, sayım yazılımının söyleyebileceği en kötü
   * yalandır.
   */
  sayilaniSil(ctx: TenantCtx, satirId: string): Promise<void>
  /** Kilit devreye girdikten SONRA beklenen miktarları defterden tazeler. */
  beklenenleriYaz(
    ctx: TenantCtx, degerler: ReadonlyArray<{ satirId: string; beklenen: number }>,
  ): Promise<void>
  /**
   * Kilit kurulduktan SONRA keşfedilen lotlar için satır ekler.
   *
   * `satirlariDegistir`'den farkı: o, satırların TAMAMINI siler ve yeniden
   * yazar — sayım açıkken bunu yapmak, girilmiş sayım sonuçlarını silmek
   * olurdu. Bu ise var olanlara dokunmaz, sonuna ekler.
   */
  satirEkle(ctx: TenantCtx, sayimId: string, satirlar: YeniSayimSatiri[]): Promise<void>
  satiraHareketBagla(ctx: TenantCtx, satirId: string, hareketId: string): Promise<void>
  durumDegistir(ctx: TenantCtx, id: string, durum: SayimDurumu): Promise<Sayim>
}

export class SayimNoCakismasiError extends Error {
  constructor(no: string) {
    super(`"${no}" numarası başka bir sayımda kullanılıyor.`)
    this.name = 'SayimNoCakismasiError'
  }
}

const metin = (d: unknown): string | undefined => {
  const s = typeof d === 'string' ? d.trim() : ''
  return s === '' ? undefined : s
}
const sayi = (d: unknown): number => {
  const n = Number(d)
  return Number.isFinite(n) ? n : 0
}
const sayiVeyaYok = (d: unknown): number | undefined =>
  d === null || d === undefined ? undefined : sayi(d)

// ═══════════════════════════════════════════════════════════════════════════
// Postgres uygulaması — kiracı süzmesini RLS yapar (ADR-004)
// ═══════════════════════════════════════════════════════════════════════════

type SatirKaydi = {
  id: string; line_no: number; stock_item_id: string; lot_id: string | null
  expected_qty: number | string; counted_qty: number | string | null; uom: string
  movement_id: string | null; note: string | null; counted_at: string | null
  stock_item?: { name: string; code: string } | null
  stock_lot?: { lot_code: string; expires_on: string | null } | null
}

type SayimKaydi = {
  id: string; count_no: string; status: string; note: string | null
  opened_at: string | null; applied_at: string | null; created_at: string
  stock_count_line: SatirKaydi[] | null
}

const sayimaCevir = (k: SayimKaydi): Sayim => ({
  id: k.id,
  sayimNo: k.count_no,
  durum: k.status as SayimDurumu,
  not: metin(k.note),
  acilisZamani: k.opened_at ?? undefined,
  uygulamaZamani: k.applied_at ?? undefined,
  olusturmaTarihi: k.created_at,
  satirlar: [...(k.stock_count_line ?? [])]
    .map(s => ({
      id: s.id,
      siraNo: s.line_no,
      stokKalemiId: s.stock_item_id,
      stokKalemiAd: s.stock_item?.name,
      stokKalemiKod: s.stock_item?.code,
      lotId: s.lot_id ?? undefined,
      lotKodu: s.stock_lot?.lot_code,
      sonKullanma: s.stock_lot?.expires_on ?? undefined,
      beklenen: sayi(s.expected_qty),
      sayilan: sayiVeyaYok(s.counted_qty),
      birim: s.uom,
      hareketId: s.movement_id ?? undefined,
      not: metin(s.note),
      sayimZamani: s.counted_at ?? undefined,
    }))
    .sort((a, b) => a.siraNo - b.siraNo),
})

const SECIM = `
  id, count_no, status, note, opened_at, applied_at, created_at,
  stock_count_line (
    id, line_no, stock_item_id, lot_id, expected_qty, counted_qty, uom,
    movement_id, note, counted_at,
    stock_item ( name, code ),
    stock_lot ( lot_code, expires_on )
  )
`

export class PostgresSayimDeposu implements SayimDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async hepsi(_ctx: TenantCtx): Promise<Sayim[]> {
    const { data, error } = await this.client
      .from('stock_count').select(SECIM).order('created_at', { ascending: false })
    if(error) throw new Error(error.message)
    return ((data as unknown as SayimKaydi[] | null) ?? []).map(sayimaCevir)
  }

  async tekil(_ctx: TenantCtx, id: string): Promise<Sayim> {
    const { data, error } = await this.client
      .from('stock_count').select(SECIM).eq('id', id).single()
    if(error) throw new Error(error.message)
    return sayimaCevir(data as unknown as SayimKaydi)
  }

  async acikOlanlar(_ctx: TenantCtx): Promise<Sayim[]> {
    const { data, error } = await this.client
      .from('stock_count').select(SECIM).eq('status', 'OPEN')
    if(error) throw new Error(error.message)
    return ((data as unknown as SayimKaydi[] | null) ?? []).map(sayimaCevir)
  }

  async ekle(ctx: TenantCtx, girdi: YeniSayim): Promise<Sayim> {
    const { data, error } = await this.client
      .from('stock_count')
      .insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        count_no: girdi.sayimNo,
        note: girdi.not ?? null,
      })
      .select('id').single()
    if(error?.code === '23505') throw new SayimNoCakismasiError(girdi.sayimNo)
    if(error) throw new Error(error.message)

    const id = (data as { id: string }).id
    await this.satirlariYaz(ctx, id, girdi.satirlar, true)
    return this.tekil(ctx, id)
  }

  async satirlariDegistir(
    ctx: TenantCtx, sayimId: string, satirlar: YeniSayimSatiri[],
  ): Promise<Sayim> {
    await this.satirlariYaz(ctx, sayimId, satirlar, false)
    return this.tekil(ctx, sayimId)
  }

  async sayilaniYaz(
    _ctx: TenantCtx, satirId: string, sayilan: number, not?: string,
  ): Promise<void> {
    const { error } = await this.client
      .from('stock_count_line')
      .update({
        counted_qty: sayilan,
        counted_at: new Date().toISOString(),
        note: not ?? null,
      })
      .eq('id', satirId)
    if(error) throw new Error(error.message)
  }

  async sayilaniSil(_ctx: TenantCtx, satirId: string): Promise<void> {
    const { error } = await this.client
      .from('stock_count_line')
      .update({ counted_qty: null, counted_at: null })
      .eq('id', satirId)
    if(error) throw new Error(error.message)
  }

  async beklenenleriYaz(
    _ctx: TenantCtx, degerler: ReadonlyArray<{ satirId: string; beklenen: number }>,
  ): Promise<void> {
    for(const d of degerler){
      const { error } = await this.client
        .from('stock_count_line').update({ expected_qty: d.beklenen }).eq('id', d.satirId)
      if(error) throw new Error(error.message)
    }
  }

  async satirEkle(
    ctx: TenantCtx, sayimId: string, satirlar: YeniSayimSatiri[],
  ): Promise<void> {
    if(satirlar.length === 0) return

    // Sıra numarası var olanların ARDINDAN devam eder; baştan numaralamak
    // girilmiş satırların sırasını karıştırırdı.
    const { data, error: okumaHatasi } = await this.client
      .from('stock_count_line').select('line_no').eq('count_id', sayimId)
    if(okumaHatasi) throw new Error(okumaHatasi.message)
    const enBuyuk = ((data as Array<{ line_no: number }> | null) ?? [])
      .reduce((acc, r) => Math.max(acc, Number(r.line_no) || 0), 0)

    const { error } = await this.client.from('stock_count_line').insert(
      satirlar.map((s, i) => ({
        tenant_id: ctx.tenantId,
        count_id: sayimId,
        line_no: enBuyuk + i + 1,
        stock_item_id: s.stokKalemiId,
        lot_id: s.lotId ?? null,
        expected_qty: s.beklenen,
        uom: s.birim,
      })),
    )
    if(error) throw new Error(error.message)
  }

  async satiraHareketBagla(
    _ctx: TenantCtx, satirId: string, hareketId: string,
  ): Promise<void> {
    const { error } = await this.client
      .from('stock_count_line').update({ movement_id: hareketId }).eq('id', satirId)
    if(error) throw new Error(error.message)
  }

  async durumDegistir(ctx: TenantCtx, id: string, durum: SayimDurumu): Promise<Sayim> {
    const yama: Record<string, unknown> = { status: durum }
    const simdi = new Date().toISOString()
    if(durum === 'OPEN'){ yama.opened_at = simdi; yama.opened_by = ctx.userId ?? null }
    if(durum === 'APPLIED'){ yama.applied_at = simdi; yama.applied_by = ctx.userId ?? null }

    const { error } = await this.client.from('stock_count').update(yama).eq('id', id)
    if(error) throw new Error(error.message)
    return this.tekil(ctx, id)
  }

  private async satirlariYaz(
    ctx: TenantCtx, sayimId: string, satirlar: readonly YeniSayimSatiri[], yeni: boolean,
  ): Promise<void> {
    const { error: silmeHatasi } = await this.client
      .from('stock_count_line').delete().eq('count_id', sayimId)
    if(silmeHatasi) throw new Error(silmeHatasi.message)

    if(satirlar.length === 0) return

    const { error } = await this.client.from('stock_count_line').insert(
      satirlar.map((s, i) => ({
        tenant_id: ctx.tenantId,
        count_id: sayimId,
        line_no: i + 1,
        stock_item_id: s.stokKalemiId,
        lot_id: s.lotId ?? null,
        expected_qty: s.beklenen,
        uom: s.birim,
      })),
    )

    if(error){
      // Tarayıcıdan işlem açamıyoruz: satırsız bir sayım belgesi, hiç
      // olmayandan kötüdür — kilit kurar ama sayacak şey göstermez.
      if(yeni) await this.client.from('stock_count').delete().eq('id', sayimId)
      throw new Error(error.message)
    }
  }
}
