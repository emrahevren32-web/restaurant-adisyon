// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Tedarikçiye iade (port, Postgres uygulaması ve servis)
//
// Yol haritası maddesi: "Kısmi kabul, ret ve iade"
//
// ── ÜÇÜ AYNI ŞEY DEĞİL ───────────────────────────────────────────────────
//   KISMİ KABUL — sipariş 200, gelen 180. Ayrı bir belge değil; mal kabulün
//                 doğal hâli. `accepted_qty` bunu zaten taşıyor.
//   RET         — kapıda reddedildi, depoya HİÇ girmedi.
//                 `rejected_qty` içinde durur, deftere YAZILMAZ.
//   İADE        — kabul edildi, depoya girdi, sonra geri gönderiliyor.
//                 Deftere ÇIKIŞ hareketi olarak yazılır (`PURCHASE_RETURN`).
//
// Bu dosya yalnızca üçüncüsünü ele alır. İlk ikisi mal kabulün içinde.
//
// Stoğa yazma işini bu dosya YAPMAZ: `DepoServisi.cikis()` çağırır, o da
// `postMovement()` kapısından geçer (ADR-001, mimari test).
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'
import type { DepoServisi } from '../warehouse/warehouse.service'
import type { Kabul, KabulSatiri } from './goods-receipt.repository'

export type IadeDurumu = 'DRAFT' | 'POSTED' | 'CANCELLED'

export type IadeSatiri = {
  id: string
  kabulSatirId: string
  stokKalemiId: string
  stokKalemiAd?: string
  miktar: number
  birim: string
  lotKodu?: string
  hareketId?: string
  siraNo: number
}

export type Iade = {
  id: string
  iadeNo: string
  durum: IadeDurumu
  kabulId: string
  kabulNo?: string
  tedarikciId: string
  tedarikciAd?: string
  iadeTarihi: string
  neden: string
  not?: string
  olusturmaTarihi: string
  satirlar: IadeSatiri[]
}

export type YeniIade = {
  iadeNo: string
  kabulId: string
  tedarikciId: string
  iadeTarihi?: string
  neden: string
  not?: string
  satirlar: Array<Omit<IadeSatiri, 'id' | 'siraNo' | 'stokKalemiAd' | 'hareketId'>>
}

export interface TedarikciIadeDeposu {
  hepsi(ctx: TenantCtx): Promise<Iade[]>
  taslakAc(ctx: TenantCtx, girdi: YeniIade): Promise<Iade>
  satiraHareketBagla(ctx: TenantCtx, satirId: string, hareketId: string): Promise<void>
  islendiIsaretle(ctx: TenantCtx, iadeId: string): Promise<Iade>
  tekil(ctx: TenantCtx, iadeId: string): Promise<Iade>
}

export class IadeDogrulamaError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'IadeDogrulamaError'
  }
}

const metin = (deger: unknown): string | undefined => {
  const s = typeof deger === 'string' ? deger.trim() : ''
  return s === '' ? undefined : s
}

const sayi = (deger: unknown): number => {
  const n = Number(deger)
  return Number.isFinite(n) ? n : 0
}

const yuvarla = (deger: number) => Math.round(deger * 1e6) / 1e6

// ═══════════════════════════════════════════════════════════════════════════
// Kabul satırının iade durumu
// ═══════════════════════════════════════════════════════════════════════════

export type KabulSatirIadeDurumu = {
  satir: KabulSatiri
  iadeEdilen: number
  /** Kabul edilen miktardan iade edilenler düşülmüş hâli. */
  kalan: number
}

/**
 * Bir kabul belgesinin satırlarının iade durumu.
 *
 * İade edilen miktar SAKLANMAZ; her okumada iade belgelerinden toplanır.
 * Gerekçe stok bakiyesiyle aynı (ADR-001): saklanan bir toplam, güncellemeyi
 * unutan tek bir kod yoluyla sessizce yanlış hâle gelir.
 */
export const kabulIadeDurumu = (
  kabul: Kabul,
  iadeler: readonly Iade[],
): KabulSatirIadeDurumu[] => {
  const ilgili = iadeler.filter(i => i.kabulId === kabul.id && i.durum !== 'CANCELLED')

  return kabul.satirlar.map(satir => {
    const iadeEdilen = yuvarla(
      ilgili.flatMap(i => i.satirlar)
        .filter(s => s.kabulSatirId === satir.id)
        .reduce((t, s) => t + s.miktar, 0),
    )
    return { satir, iadeEdilen, kalan: yuvarla(Math.max(0, satir.kabulMiktari - iadeEdilen)) }
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// Servis
// ═══════════════════════════════════════════════════════════════════════════

export class TedarikciIadeServisi {
  constructor(
    private readonly depo: TedarikciIadeDeposu,
    private readonly depoServisi: DepoServisi,
  ) {}

  hepsi(ctx: TenantCtx): Promise<Iade[]> {
    return this.depo.hepsi(ctx)
  }

  /**
   * İade belgesini açar ve satırlarını deftere ÇIKIŞ olarak işler.
   *
   * Sıra mal kabuldeki ile aynı ve aynı sebeple: önce belge (taslak), sonra
   * hareketler, en sonda kapanış. Arada bir hata olursa belge yarım görünür ve
   * tekrar denenebilir; idempotency anahtarı satır kimliğine sabit olduğu için
   * aynı satır iki kez düşmez.
   */
  async iadeEt(
    ctx: TenantCtx,
    girdi: YeniIade,
    kabul: Kabul,
    mevcutIadeler: readonly Iade[],
  ): Promise<Iade> {
    this.dogrula(girdi, kabul, mevcutIadeler)

    const taslak = await this.depo.taslakAc(ctx, girdi)
    return this.satirlariIsle(ctx, taslak)
  }

  async tekrarDene(ctx: TenantCtx, iade: Iade): Promise<Iade> {
    if(iade.durum !== 'DRAFT'){
      throw new IadeDogrulamaError('Yalnızca yarım kalmış (taslak) iadeler tekrar denenebilir.')
    }
    return this.satirlariIsle(ctx, iade)
  }

  private async satirlariIsle(ctx: TenantCtx, iade: Iade): Promise<Iade> {
    for(const satir of iade.satirlar){
      if(satir.hareketId) continue

      const hareketler = await this.depoServisi.cikis(
        ctx,
        {
          stokKalemiId: satir.stokKalemiId,
          miktar: satir.miktar,
          birim: satir.birim,
          neden: 'PURCHASE_RETURN',
          not: `${iade.iadeNo} tedarikçi iadesi · ${iade.neden}`
            + (iade.kabulNo ? ` · Kabul ${iade.kabulNo}` : ''),
        },
        `iade:${satir.id}`,
      )

      // `cikis()` lot takipli kalemlerde çıkışı birden çok lota bölebilir.
      // Belgeye ilk hareketin kimliği yazılıyor; bölünme olduğunda tamamı
      // aynı idempotency kökünden türediği için defterden izlenebilir.
      await this.depo.satiraHareketBagla(ctx, satir.id, hareketler[0].id)
    }

    return this.depo.islendiIsaretle(ctx, iade.id)
  }

  private dogrula(girdi: YeniIade, kabul: Kabul, mevcutIadeler: readonly Iade[]): void {
    if(!girdi.iadeNo.trim()) throw new IadeDogrulamaError('İade numarası zorunludur.')
    if(!girdi.neden.trim()){
      // Gerekçesiz iade, tedarikçiyle konuşurken elinde hiçbir şey olmaması
      // demektir — ve tedarikçi performansı da bu gerekçelerden doğacak.
      throw new IadeDogrulamaError('İade nedeni zorunludur.')
    }
    if(girdi.satirlar.length === 0){
      throw new IadeDogrulamaError('İade en az bir kalem içermelidir.')
    }

    const durumlar = kabulIadeDurumu(kabul, mevcutIadeler)

    girdi.satirlar.forEach((satir, i) => {
      const sira = i + 1
      if(!(satir.miktar > 0)){
        throw new IadeDogrulamaError(`${sira}. kalemin miktarı 0’dan büyük olmalıdır.`)
      }

      const durum = durumlar.find(d => d.satir.id === satir.kabulSatirId)
      if(!durum){
        throw new IadeDogrulamaError(`${sira}. kalem bu kabul belgesine ait değil.`)
      }
      if(satir.miktar > durum.kalan){
        // Kabul edilenden fazlasını iade etmek, olmayan malı geri göndermektir.
        // Defter de bunu reddederdi (negatif bakiye), ama hata mesajı orada
        // "stok yetersiz" derdi — burada hangi kalem ve ne kadar fazla olduğu
        // yazılı.
        throw new IadeDogrulamaError(
          `${sira}. kalemde kabul edilenden fazla iade edilemez. `
          + `Kabul ${durum.satir.kabulMiktari}, daha önce iade ${durum.iadeEdilen}, `
          + `iade edilebilir ${durum.kalan} ${durum.satir.birim}.`,
        )
      }
    })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Postgres uygulaması
// ═══════════════════════════════════════════════════════════════════════════

type IadeSatirKaydi = {
  id: string; receipt_line_id: string; stock_item_id: string
  qty: number | string; uom: string; lot_code: string | null
  stock_movement_id: string | null; line_no: number
  stock_item?: { name: string } | null
}

type IadeKaydi = {
  id: string; return_no: string; status: string; receipt_id: string
  supplier_id: string; returned_on: string; reason: string; note: string | null
  created_at: string
  supplier?: { name: string } | null
  goods_receipt?: { receipt_no: string } | null
  supplier_return_line: IadeSatirKaydi[] | null
}

const iadeyeCevir = (k: IadeKaydi): Iade => ({
  id: k.id,
  iadeNo: k.return_no,
  durum: k.status as IadeDurumu,
  kabulId: k.receipt_id,
  kabulNo: k.goods_receipt?.receipt_no,
  tedarikciId: k.supplier_id,
  tedarikciAd: k.supplier?.name,
  iadeTarihi: k.returned_on,
  neden: k.reason,
  not: metin(k.note),
  olusturmaTarihi: k.created_at,
  satirlar: [...(k.supplier_return_line ?? [])]
    .map(s => ({
      id: s.id,
      kabulSatirId: s.receipt_line_id,
      stokKalemiId: s.stock_item_id,
      stokKalemiAd: s.stock_item?.name,
      miktar: sayi(s.qty),
      birim: s.uom,
      lotKodu: metin(s.lot_code),
      hareketId: metin(s.stock_movement_id),
      siraNo: s.line_no,
    }))
    .sort((a, b) => a.siraNo - b.siraNo),
})

const SECIM = `
  id, return_no, status, receipt_id, supplier_id, returned_on, reason, note, created_at,
  supplier ( name ),
  goods_receipt ( receipt_no ),
  supplier_return_line (
    id, receipt_line_id, stock_item_id, qty, uom, lot_code,
    stock_movement_id, line_no, stock_item ( name )
  )
`

/** ⚠️ Kiracı süzmesini BU SINIF yapmaz — RLS yapar (ADR-004). */
export class PostgresTedarikciIadeDeposu implements TedarikciIadeDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async hepsi(_ctx: TenantCtx): Promise<Iade[]> {
    const { data, error } = await this.client
      .from('supplier_return').select(SECIM).order('created_at', { ascending: false })

    if(error) throw new Error(`İadeler okunamadı: ${error.message}`)
    return ((data as unknown as IadeKaydi[] | null) ?? []).map(iadeyeCevir)
  }

  async tekil(_ctx: TenantCtx, iadeId: string): Promise<Iade> {
    const { data, error } = await this.client
      .from('supplier_return').select(SECIM).eq('id', iadeId).single()
    if(error) throw new Error(`İade okunamadı: ${error.message}`)
    return iadeyeCevir(data as unknown as IadeKaydi)
  }

  async taslakAc(ctx: TenantCtx, girdi: YeniIade): Promise<Iade> {
    const { data, error } = await this.client
      .from('supplier_return')
      .insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        return_no: girdi.iadeNo.trim(),
        receipt_id: girdi.kabulId,
        supplier_id: girdi.tedarikciId,
        returned_on: girdi.iadeTarihi || new Date().toISOString().slice(0, 10),
        reason: girdi.neden.trim(),
        note: girdi.not?.trim() || null,
        status: 'DRAFT',
        created_by: ctx.userId,
      })
      .select('id')
      .single()

    if(error){
      throw error.code === '23505'
        ? new IadeDogrulamaError(`"${girdi.iadeNo.trim()}" iade numarası zaten kullanılıyor.`)
        : new Error(`İade açılamadı: ${error.message}`)
    }

    const iadeId = (data as { id: string }).id

    const { error: satirHatasi } = await this.client
      .from('supplier_return_line')
      .insert(girdi.satirlar.map((s, i) => ({
        tenant_id: ctx.tenantId,
        return_id: iadeId,
        receipt_line_id: s.kabulSatirId,
        stock_item_id: s.stokKalemiId,
        qty: s.miktar,
        uom: s.birim,
        lot_code: s.lotKodu?.trim() || null,
        line_no: i + 1,
      })))

    if(satirHatasi){
      await this.client.from('supplier_return').delete().eq('id', iadeId)
      throw new Error(`İade kalemleri kaydedilemedi, belge geri alındı: ${satirHatasi.message}`)
    }

    return this.tekil(ctx, iadeId)
  }

  async satiraHareketBagla(_ctx: TenantCtx, satirId: string, hareketId: string): Promise<void> {
    const { error } = await this.client
      .from('supplier_return_line')
      .update({ stock_movement_id: hareketId })
      .eq('id', satirId)

    if(error) throw new Error(`İade satırı hareketle eşlenemedi: ${error.message}`)
  }

  async islendiIsaretle(ctx: TenantCtx, iadeId: string): Promise<Iade> {
    const { error } = await this.client
      .from('supplier_return')
      .update({ status: 'POSTED', posted_at: new Date().toISOString() })
      .eq('id', iadeId)

    if(error) throw new Error(`İade kapatılamadı: ${error.message}`)
    return this.tekil(ctx, iadeId)
  }
}
