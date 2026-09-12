// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 — Yedek günlüğü (okuma ve yazma)
//
// "Otomatik yedek" bir web uygulamasının vaat edemeyeceği bir şey: tarayıcı
// kapalıyken hiçbir şey çalışmaz. Vaat edebileceğimiz şey UNUTTURMAMAK.
//
// Bu dosya iki soruyu cevaplıyor:
//   "Son yedek ne zaman alındı?"  → uyarı eşiği
//   "Düzenli alınıyor mu?"        → günlük listesi
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'

/**
 * Kaç gün sonra uyarılıyor.
 *
 * 7 gün: bir haftalık iş kaybı bir fabrikada telafi edilebilir; bir aylık
 * kayıp edilemez. Eşiği daha sıkı tutmak (2–3 gün) uyarıyı gürültüye
 * çevirir ve gürültü olan uyarı okunmaz.
 */
export const UYARI_ESIGI_GUN = 7

export type YedekKaydi = {
  id: number
  tarih: string
  alanAd?: string
  tur: 'export' | 'pg_dump'
  satir?: number
  bayt?: number
  eksiksiz: boolean
  not?: string
}

export type YeniYedekKaydi = {
  tur?: 'export' | 'pg_dump'
  satir?: number
  bayt?: number
  eksiksiz: boolean
  alanAd?: string
  not?: string
}

export interface YedekGunlugu {
  son(ctx: TenantCtx, adet?: number): Promise<YedekKaydi[]>
  yaz(ctx: TenantCtx, kayit: YeniYedekKaydi): Promise<void>
}

type Satir = {
  id: number
  taken_at: string
  taken_by_name: string | null
  kind: string
  row_count: number | null
  byte_size: number | null
  is_complete: boolean
  note: string | null
}

const kayitaCevir = (s: Satir): YedekKaydi => ({
  id: s.id,
  tarih: s.taken_at,
  alanAd: s.taken_by_name ?? undefined,
  tur: s.kind === 'pg_dump' ? 'pg_dump' : 'export',
  satir: s.row_count ?? undefined,
  bayt: s.byte_size ?? undefined,
  eksiksiz: s.is_complete,
  not: s.note ?? undefined,
})

/** ⚠️ Kiracı süzmesi yok — RLS'in işi (ADR-004). */
export class PostgresYedekGunlugu implements YedekGunlugu {
  constructor(private readonly client: SupabaseClient) {}

  async son(_ctx: TenantCtx, adet = 10): Promise<YedekKaydi[]> {
    const { data, error } = await this.client
      .from('tenant_backup_log')
      .select('id, taken_at, taken_by_name, kind, row_count, byte_size, is_complete, note')
      .order('taken_at', { ascending: false })
      .limit(adet)
    if(error) throw new Error(`Yedek günlüğü okunamadı: ${error.message}`)
    return ((data as unknown as Satir[] | null) ?? []).map(kayitaCevir)
  }

  async yaz(ctx: TenantCtx, kayit: YeniYedekKaydi): Promise<void> {
    const { error } = await this.client.from('tenant_backup_log').insert({
      tenant_id: ctx.tenantId,
      taken_by: ctx.userId ?? null,
      taken_by_name: kayit.alanAd ?? null,
      kind: kayit.tur ?? 'export',
      row_count: kayit.satir ?? null,
      byte_size: kayit.bayt ?? null,
      is_complete: kayit.eksiksiz,
      note: kayit.not ?? null,
    })
    // ⚠️ Günlüğe yazamamak, yedeğin alınmadığı anlamına GELMEZ. Dosya zaten
    // indi. Bu yüzden hata fırlatmıyoruz — kullanıcıya "yedek başarısız"
    // demek yanlış olurdu. Sessiz kalmıyoruz ama: konsola düşüyor.
    if(error) console.warn('Yedek günlüğüne yazılamadı:', error.message)
  }
}

export type YedekDurumu = {
  /** Hiç eksiksiz yedek alınmamışsa null. */
  sonEksiksiz?: YedekKaydi
  /** Son eksiksiz yedeğin üstünden geçen tam gün. Hiç yoksa null. */
  gecenGun: number | null
  /** Uyarı verilmeli mi. */
  uyari: boolean
  mesaj: string
}

const GUN = 24 * 60 * 60 * 1000

/**
 * Yedek durumu.
 *
 * ⚠️ EKSİK yedekler sayılmıyor. "Yedek aldım" demek yetmez; içinde verinin
 * tamamı olmayan bir dosya, uyarıyı susturmaya yetmemeli — yoksa kullanıcı
 * bozuk bir dosyaya güvenerek rahatlar.
 */
export const yedekDurumu = (
  kayitlar: YedekKaydi[], simdi: Date = new Date(),
): YedekDurumu => {
  const eksiksizler = kayitlar.filter(k => k.eksiksiz)
  if(eksiksizler.length === 0){
    return {
      gecenGun: null,
      uyari: true,
      mesaj: 'Hiç yedek alınmamış. Veriniz şu anda yalnızca sunucuda duruyor.',
    }
  }

  const son = eksiksizler.reduce((a, b) =>
    new Date(a.tarih) > new Date(b.tarih) ? a : b)
  const gun = Math.floor((simdi.getTime() - new Date(son.tarih).getTime()) / GUN)

  if(gun >= UYARI_ESIGI_GUN){
    return {
      sonEksiksiz: son, gecenGun: gun, uyari: true,
      mesaj: `Son yedek ${gun} gün önce alındı. Yenisini almanın zamanı geldi.`,
    }
  }
  return {
    sonEksiksiz: son, gecenGun: gun, uyari: false,
    mesaj: gun === 0
      ? 'Son yedek bugün alındı.'
      : `Son yedek ${gun} gün önce alındı.`,
  }
}
