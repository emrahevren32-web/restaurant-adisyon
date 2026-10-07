// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Gösterge deposu — RAPOR DEFTERDEN OKUR, BAŞKA YERDEN DEĞİL
//
// ⚠️ BU DOSYA HİÇBİR ŞEY HESAPLAMAZ. Toplama, değerleme ve süzme 0065'te,
// veritabanında yapılıyor. Burada yapılsaydı iki yerde iki farklı hesap
// olurdu ve ekranla rapor birbirini tutmazdı — üstelik tarayıcıya çekilen
// satırlar PostgREST'in satır sınırında sessizce kesilirdi.
//
// ⚠️ Eski KPI katmanı (`kpi-source.service.ts`) 27 ayrı `.mock` modülünden,
// yani tarayıcı hafızasından besleniyor. Bu depo onun yerine geçmiyor;
// GERÇEK defterin üstüne ayrı bir kapı açıyor.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'
import type { FireSatiri, GostergeSatiri } from './gostergeler'

export type Donem = { bas: string; bit: string }

/**
 * ⚠️ PORT. Değiştirirsen UYGULAYANLARIN HEPSİNİ değiştirmek zorundasın ve
 * bunu yalnızca `tsc` yakalar, `vitest` yakalamaz.
 */
export type GostergeDeposu = {
  gostergeler(ctx: TenantCtx, donem: Donem): Promise<GostergeSatiri[]>
  fireDokumu(ctx: TenantCtx, donem: Donem): Promise<FireSatiri[]>
}

const sayi = (v: string | number | null | undefined): number => {
  if(v === null || v === undefined) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** `numeric` PostgREST'ten METİN gelir; `undefined` ile `0` ayrı şeylerdir. */
const sayiVeyaBos = (v: string | number | null | undefined): number | undefined => {
  if(v === null || v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export class PostgresGostergeDeposu implements GostergeDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async gostergeler(ctx: TenantCtx, donem: Donem): Promise<GostergeSatiri[]> {
    const { data, error } = await this.client.rpc('isletme_gostergeleri', {
      p_sube: ctx.branchId, p_bas: donem.bas, p_bit: donem.bit,
    })
    if(error) throw new Error(`Göstergeler okunamadı: ${error.message}`)

    type S = { anahtar: string; deger: string | number | null; ek: string | number | null }
    return ((data as unknown as S[] | null) ?? []).map(r => ({
      anahtar: r.anahtar,
      deger: sayi(r.deger),
      ek: sayiVeyaBos(r.ek),
    }))
  }

  async fireDokumu(ctx: TenantCtx, donem: Donem): Promise<FireSatiri[]> {
    const { data, error } = await this.client.rpc('fire_dokumu', {
      p_sube: ctx.branchId, p_bas: donem.bas, p_bit: donem.bit,
    })
    if(error) throw new Error(`Fire dökümü okunamadı: ${error.message}`)

    type S = {
      neden: string; kalem_id: string; kalem_adi: string | null
      miktar: string | number | null; birim: string | null
      tutar: string | number | null; fiyatsiz: boolean
    }
    return ((data as unknown as S[] | null) ?? []).map(r => ({
      neden: r.neden,
      kalemId: r.kalem_id,
      // ⚠️ Kalem kartı silinmişse ad BOŞ gelir ve boş KALIR. Uydurmuyoruz.
      kalemAdi: r.kalem_adi ?? undefined,
      miktar: sayi(r.miktar),
      birim: r.birim ?? undefined,
      // ⚠️ `undefined` ile `0` AYRI: biri "hesaplanamadı", öteki "bedava".
      tutar: sayiVeyaBos(r.tutar),
      fiyatsiz: Boolean(r.fiyatsiz),
    }))
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Dönem yardımcıları
// ═══════════════════════════════════════════════════════════════════════════

const gunYaz = (t: Date): string =>
  `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`

/** Son `gun` günü kapsayan dönem — bugün dahil. */
export const sonGunler = (gun: number, bugun: Date = new Date()): Donem => {
  const bit = new Date(bugun)
  const bas = new Date(bugun)
  bas.setDate(bas.getDate() - (gun - 1))
  return { bas: gunYaz(bas), bit: gunYaz(bit) }
}

/**
 * Bir dönemin hemen ÖNCESİNDEKİ aynı uzunlukta dönem.
 *
 * ⚠️ Karşılaştırma bunun için var: işletme kendi geçmişiyle kıyaslanıyor.
 * "Sektör ortalaması" diye bir sayı uydurmuyoruz — öyle bir sayımız yok.
 */
export const oncekiDonem = (donem: Donem): Donem => {
  const bas = new Date(`${donem.bas}T00:00:00`)
  const bit = new Date(`${donem.bit}T00:00:00`)
  const gun = Math.round((bit.getTime() - bas.getTime()) / 86400000) + 1

  const oncekiBit = new Date(bas); oncekiBit.setDate(oncekiBit.getDate() - 1)
  const oncekiBas = new Date(oncekiBit); oncekiBas.setDate(oncekiBas.getDate() - (gun - 1))
  return { bas: gunYaz(oncekiBas), bit: gunYaz(oncekiBit) }
}
