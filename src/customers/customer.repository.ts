// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C1 — Müşteri deposu
//
// Yol haritası maddesi: "Müşteri kartı ve sözleşme"
//          Bitti sayılır ki: "Sevkiyatta müşteri adı elle yazılmıyor,
//                             karttan seçiliyor"
//
// Biçim tedarikçi deposuyla (0017 / supplier.repository.ts) BİREBİR aynı:
// bir PORT (arayüz) ve onun Postgres uygulaması (ADR-003). Aynı işi iki
// farklı şekilde yapmak, iki farklı hata demektir.
//
// ── ÜÇ KAYIT, TEK DEPO ───────────────────────────────────────────────────
// Müşteri, teslim noktası ve fiyat aynı arayüzde toplanıyor çünkü ekranda da
// birlikte yaşıyorlar: müşteriyi seçince noktaları, noktayı seçince fiyatını
// görüyorsun. Üç ayrı depo sınıfı, üç ayrı bağlam kurulumu demekti.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'
import { normalizeIdentifier } from '../core/identifier'

export type Musteri = {
  id: string
  kod: string
  ad: string
  vergiNo?: string
  vergiDairesi?: string
  yetkili?: string
  telefon?: string
  eposta?: string
  adres?: string
  /** Gün. Boş = vade konuşulmamış. Sıfır "peşin" demektir ve o bir karardır. */
  vadeGunu?: number
  /** Varsayılan sipariş penceresi. Nokta boş bırakırsa buraya düşülür. */
  kesimSaati?: string
  teslimGunFarki?: number
  not?: string
  aktif: boolean
}

export type MusteriGirdisi = {
  kod: string
  ad: string
  vergiNo?: string
  vergiDairesi?: string
  yetkili?: string
  telefon?: string
  eposta?: string
  adres?: string
  vadeGunu?: number
  kesimSaati?: string
  teslimGunFarki?: number
  not?: string
}

export type TeslimNoktasi = {
  id: string
  musteriId: string
  kod: string
  ad: string
  adres?: string
  ilce?: string
  il?: string
  yetkili?: string
  telefon?: string
  kesimSaati?: string
  teslimGunFarki?: number
  teslimBaslangic?: string
  teslimBitis?: string
  not?: string
  aktif: boolean
}

export type TeslimNoktasiGirdisi = Omit<TeslimNoktasi, 'id' | 'aktif'>

/**
 * Fiyat satırı.
 *
 * `noktaId` BOŞ = müşterinin bütün noktaları için geçerli.
 * `noktaId` DOLU = yalnız o nokta (Emrah kararı 2026-09-27: aynı müşterinin
 * farklı noktalarına farklı fiyat uygulanıyor).
 *
 * `kaldirildi` satırı "artık fiyatlı değil" demektir. `birimFiyat` orada sıfır
 * yazar ama anlamı "bedava" DEĞİLDİR — okuyucu fonksiyon onu boşa çevirir.
 */
export type Fiyat = {
  id: string
  musteriId: string
  noktaId?: string
  noktaAdi?: string
  kalemId: string
  kalemAdi?: string
  birimFiyat: number
  paraBirimi: string
  birim: string
  gecerlilikBaslangici: string
  kaldirildi: boolean
  not?: string
  olusturmaZamani: string
}

export type FiyatGirdisi = {
  musteriId: string
  noktaId?: string
  kalemId: string
  birimFiyat: number
  paraBirimi: string
  birim: string
  gecerlilikBaslangici: string
  kaldirildi?: boolean
  not?: string
}

/** `public.siparis_penceresi` çıktısı. Kaynak ekranda gösterilecek. */
export type SiparisPenceresi = {
  kesimSaati?: string
  gunFarki?: number
  kaynak: 'nokta' | 'musteri' | 'yok'
}

export interface MusteriDeposu {
  /** Pasifler de dahil hepsi; süzmeyi ekran yapar. */
  hepsi(ctx: TenantCtx): Promise<Musteri[]>
  ekle(ctx: TenantCtx, girdi: MusteriGirdisi): Promise<Musteri>
  guncelle(ctx: TenantCtx, id: string, girdi: MusteriGirdisi): Promise<Musteri>
  /** Pasife alma / geri açma. Silme YOK — geçmiş belgeler kopar. */
  aktiflikDegistir(ctx: TenantCtx, id: string, aktif: boolean): Promise<Musteri>

  noktalar(ctx: TenantCtx, musteriId: string): Promise<TeslimNoktasi[]>
  noktaEkle(ctx: TenantCtx, girdi: TeslimNoktasiGirdisi): Promise<TeslimNoktasi>
  noktaGuncelle(ctx: TenantCtx, id: string, girdi: TeslimNoktasiGirdisi): Promise<TeslimNoktasi>
  noktaAktiflikDegistir(ctx: TenantCtx, id: string, aktif: boolean): Promise<TeslimNoktasi>

  fiyatlar(ctx: TenantCtx, musteriId: string): Promise<Fiyat[]>
  /** Fiyat defteri EKLEMELİ: güncelleme ve silme yok, yeni satır var. */
  fiyatEkle(ctx: TenantCtx, girdi: FiyatGirdisi): Promise<void>
  /** Bir noktanın bir kalem için o tarihteki geçerli fiyatı. Yoksa boş. */
  gecerliFiyat(ctx: TenantCtx, noktaId: string, kalemId: string, tarih?: string): Promise<number | undefined>
  pencere(ctx: TenantCtx, noktaId: string): Promise<SiparisPenceresi>
}

export class MusteriKoduCakismasiError extends Error {
  constructor(kod: string) {
    super(`"${kod}" kodu başka bir müşteride kullanılıyor.`)
    this.name = 'MusteriKoduCakismasiError'
  }
}

export class NoktaKoduCakismasiError extends Error {
  constructor(kod: string) {
    super(`"${kod}" kodu bu müşterinin başka bir teslim noktasında kullanılıyor.`)
    this.name = 'NoktaKoduCakismasiError'
  }
}

export class FiyatCakismasiError extends Error {
  constructor() {
    super('Aynı kapsam, aynı kalem ve aynı tarih için zaten bir fiyat var. '
      + 'Fiyatı değiştirmek için başka bir geçerlilik tarihi seçin.')
    this.name = 'FiyatCakismasiError'
  }
}

const bosaCevir = (deger: unknown): string | undefined => {
  const metin = typeof deger === 'string' ? deger.trim() : ''
  return metin === '' ? undefined : metin
}

const sayiyaCevir = (deger: unknown): number | undefined =>
  deger === null || deger === undefined ? undefined : Number(deger)

/** Postgres tekillik ihlali. */
const TEKILLIK_IHLALI = '23505'

type MusteriSatiri = {
  id: string
  code: string
  name: string
  tax_number: string | null
  tax_office: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  payment_term_days: number | null
  order_cutoff_time: string | null
  delivery_lead_days: number | null
  notes: string | null
  is_active: boolean
}

// ⚠️ TEK PARÇA METİN OLMAK ZORUNDA. `+` ile birleştirilirse supabase-js'in
// tip çözücüsü listeyi okuyamıyor, `data`yı `GenericStringError[]` sayıyor ve
// aşağıdaki dönüşüm TS2352 ile reddediliyor. Satır uzun ama bölünemez.
const MUSTERI_SUTUNLARI = 'id, code, name, tax_number, tax_office, contact_name, phone, email, address, payment_term_days, order_cutoff_time, delivery_lead_days, notes, is_active'

const musteriyeCevir = (s: MusteriSatiri): Musteri => ({
  id: s.id,
  kod: s.code,
  ad: s.name,
  vergiNo: bosaCevir(s.tax_number),
  vergiDairesi: bosaCevir(s.tax_office),
  yetkili: bosaCevir(s.contact_name),
  telefon: bosaCevir(s.phone),
  eposta: bosaCevir(s.email),
  adres: bosaCevir(s.address),
  vadeGunu: sayiyaCevir(s.payment_term_days),
  kesimSaati: bosaCevir(s.order_cutoff_time),
  teslimGunFarki: sayiyaCevir(s.delivery_lead_days),
  not: bosaCevir(s.notes),
  aktif: s.is_active,
})

type NoktaSatiri = {
  id: string
  customer_id: string
  code: string
  name: string
  address: string | null
  district: string | null
  city: string | null
  contact_name: string | null
  phone: string | null
  order_cutoff_time: string | null
  delivery_lead_days: number | null
  delivery_window_start: string | null
  delivery_window_end: string | null
  notes: string | null
  is_active: boolean
}

// Aynı kural: tek parça (bkz. MUSTERI_SUTUNLARI üstündeki not).
const NOKTA_SUTUNLARI = 'id, customer_id, code, name, address, district, city, contact_name, phone, order_cutoff_time, delivery_lead_days, delivery_window_start, delivery_window_end, notes, is_active'

const noktayaCevir = (s: NoktaSatiri): TeslimNoktasi => ({
  id: s.id,
  musteriId: s.customer_id,
  kod: s.code,
  ad: s.name,
  adres: bosaCevir(s.address),
  ilce: bosaCevir(s.district),
  il: bosaCevir(s.city),
  yetkili: bosaCevir(s.contact_name),
  telefon: bosaCevir(s.phone),
  kesimSaati: bosaCevir(s.order_cutoff_time),
  teslimGunFarki: sayiyaCevir(s.delivery_lead_days),
  teslimBaslangic: bosaCevir(s.delivery_window_start),
  teslimBitis: bosaCevir(s.delivery_window_end),
  not: bosaCevir(s.notes),
  aktif: s.is_active,
})

type FiyatSatiri = {
  id: string
  customer_id: string
  delivery_point_id: string | null
  stock_item_id: string
  unit_price: string | number
  currency: string
  uom_code: string
  valid_from: string
  removed: boolean
  note: string | null
  created_at: string
  stock_item: { name: string } | null
  delivery_point: { name: string } | null
}

// Gömülü seçim (`stock_item(name)`) yabancı anahtar üzerinden çalışıyor;
// 0047 ikisini de kurdu. Kalem adını ayrı sorguyla çekmek, fiyat listesini
// N+1 isteğe çevirirdi.
// Aynı kural: tek parça. Gömülü seçim yüzünden okunan satır yine de
// `as unknown as` ile çevriliyor — çözücü gömülü ilişkiyi düz bir alan
// sanıyor ve doğrudan dönüşümü reddediyor.
const FIYAT_SUTUNLARI = 'id, customer_id, delivery_point_id, stock_item_id, unit_price, currency, uom_code, valid_from, removed, note, created_at, stock_item(name), delivery_point(name)'

const fiyataCevir = (s: FiyatSatiri): Fiyat => ({
  id: s.id,
  musteriId: s.customer_id,
  noktaId: s.delivery_point_id ?? undefined,
  noktaAdi: s.delivery_point?.name,
  kalemId: s.stock_item_id,
  kalemAdi: s.stock_item?.name,
  birimFiyat: Number(s.unit_price),
  paraBirimi: s.currency,
  birim: s.uom_code,
  gecerlilikBaslangici: s.valid_from,
  kaldirildi: s.removed,
  not: bosaCevir(s.note),
  olusturmaZamani: s.created_at,
})

/**
 * Postgres uygulaması.
 *
 * ⚠️ Kiracı süzmesini BU SINIF yapmaz — RLS yapar (ADR-004). Sorgulara
 * `tenant_id` eşitliği eklenmiyor; eklersek "filtre var, demek ki güvenli"
 * yanılsaması doğar ve asıl koruma olan RLS'in kapalı kalması fark edilmez.
 * `ctx.tenantId` yalnızca YAZARKEN not-null sütunu doldurmak için kullanılır.
 */
export class PostgresMusteriDeposu implements MusteriDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async hepsi(_ctx: TenantCtx): Promise<Musteri[]> {
    const { data, error } = await this.client
      .from('customer').select(MUSTERI_SUTUNLARI).order('name')
    if(error) throw new Error(`Müşteriler okunamadı: ${error.message}`)
    return ((data as MusteriSatiri[] | null) ?? []).map(musteriyeCevir)
  }

  async ekle(ctx: TenantCtx, girdi: MusteriGirdisi): Promise<Musteri> {
    const { data, error } = await this.client
      .from('customer')
      .insert({ tenant_id: ctx.tenantId, ...musteriAlanlari(girdi) })
      .select(MUSTERI_SUTUNLARI).single()
    if(error) throw musteriCakismasi(error, girdi.kod)
    return musteriyeCevir(data as MusteriSatiri)
  }

  async guncelle(_ctx: TenantCtx, id: string, girdi: MusteriGirdisi): Promise<Musteri> {
    const { data, error } = await this.client
      .from('customer').update(musteriAlanlari(girdi)).eq('id', id)
      .select(MUSTERI_SUTUNLARI).single()
    if(error) throw musteriCakismasi(error, girdi.kod)
    return musteriyeCevir(data as MusteriSatiri)
  }

  async aktiflikDegistir(_ctx: TenantCtx, id: string, aktif: boolean): Promise<Musteri> {
    const { data, error } = await this.client
      .from('customer').update({ is_active: aktif }).eq('id', id)
      .select(MUSTERI_SUTUNLARI).single()
    if(error) throw new Error(`Müşteri durumu değiştirilemedi: ${error.message}`)
    return musteriyeCevir(data as MusteriSatiri)
  }

  async noktalar(_ctx: TenantCtx, musteriId: string): Promise<TeslimNoktasi[]> {
    const { data, error } = await this.client
      .from('delivery_point').select(NOKTA_SUTUNLARI)
      .eq('customer_id', musteriId).order('name')
    if(error) throw new Error(`Teslim noktaları okunamadı: ${error.message}`)
    return ((data as NoktaSatiri[] | null) ?? []).map(noktayaCevir)
  }

  async noktaEkle(ctx: TenantCtx, girdi: TeslimNoktasiGirdisi): Promise<TeslimNoktasi> {
    const { data, error } = await this.client
      .from('delivery_point')
      .insert({ tenant_id: ctx.tenantId, ...noktaAlanlari(girdi) })
      .select(NOKTA_SUTUNLARI).single()
    if(error) throw noktaCakismasi(error, girdi.kod)
    return noktayaCevir(data as NoktaSatiri)
  }

  async noktaGuncelle(_ctx: TenantCtx, id: string, girdi: TeslimNoktasiGirdisi): Promise<TeslimNoktasi> {
    const { data, error } = await this.client
      .from('delivery_point').update(noktaAlanlari(girdi)).eq('id', id)
      .select(NOKTA_SUTUNLARI).single()
    if(error) throw noktaCakismasi(error, girdi.kod)
    return noktayaCevir(data as NoktaSatiri)
  }

  async noktaAktiflikDegistir(_ctx: TenantCtx, id: string, aktif: boolean): Promise<TeslimNoktasi> {
    const { data, error } = await this.client
      .from('delivery_point').update({ is_active: aktif }).eq('id', id)
      .select(NOKTA_SUTUNLARI).single()
    if(error) throw new Error(`Teslim noktası durumu değiştirilemedi: ${error.message}`)
    return noktayaCevir(data as NoktaSatiri)
  }

  async fiyatlar(_ctx: TenantCtx, musteriId: string): Promise<Fiyat[]> {
    const { data, error } = await this.client
      .from('customer_price').select(FIYAT_SUTUNLARI)
      .eq('customer_id', musteriId)
      .order('valid_from', { ascending: false })
      .order('created_at', { ascending: false })
    if(error) throw new Error(`Fiyatlar okunamadı: ${error.message}`)
    return ((data as unknown as FiyatSatiri[] | null) ?? []).map(fiyataCevir)
  }

  async fiyatEkle(ctx: TenantCtx, girdi: FiyatGirdisi): Promise<void> {
    const { error } = await this.client.from('customer_price').insert({
      tenant_id: ctx.tenantId,
      customer_id: girdi.musteriId,
      delivery_point_id: girdi.noktaId ?? null,
      stock_item_id: girdi.kalemId,
      unit_price: girdi.birimFiyat,
      currency: girdi.paraBirimi,
      uom_code: girdi.birim,
      valid_from: girdi.gecerlilikBaslangici,
      removed: girdi.kaldirildi ?? false,
      note: bosaCevir(girdi.not) ?? null,
      created_by: ctx.userId,
    })
    if(error){
      if(error.code === TEKILLIK_IHLALI) throw new FiyatCakismasiError()
      throw new Error(`Fiyat kaydedilemedi: ${error.message}`)
    }
  }

  /**
   * ⚠️ `app.musteri_fiyati` DEĞİL, `public.musteri_fiyati`.
   *
   * PostgREST yalnızca `public` şemasını yayınlar; `app` şemasındaki bir
   * fonksiyon tarayıcıdan ÇAĞRILAMAZ. 0048 bu yüzden ince bir sarmalayıcı
   * kuruyor. Kuralın kendisi hâlâ tek yerde: `app` içindeki fonksiyonda.
   */
  async gecerliFiyat(
    _ctx: TenantCtx, noktaId: string, kalemId: string, tarih?: string,
  ): Promise<number | undefined> {
    const { data, error } = await this.client.rpc('musteri_fiyati', {
      p_nokta: noktaId, p_kalem: kalemId, p_tarih: tarih ?? null,
    })
    if(error) throw new Error(`Fiyat okunamadı: ${error.message}`)
    return data === null || data === undefined ? undefined : Number(data)
  }

  async pencere(_ctx: TenantCtx, noktaId: string): Promise<SiparisPenceresi> {
    const { data, error } = await this.client.rpc('siparis_penceresi', { p_nokta: noktaId })
    if(error) throw new Error(`Sipariş penceresi okunamadı: ${error.message}`)
    const satir = (Array.isArray(data) ? data[0] : data) as
      { kesim_saati: string | null; gun_farki: number | null; kaynak: string } | undefined
    if(!satir) return { kaynak: 'yok' }
    return {
      kesimSaati: bosaCevir(satir.kesim_saati),
      gunFarki: sayiyaCevir(satir.gun_farki),
      kaynak: (satir.kaynak === 'nokta' || satir.kaynak === 'musteri') ? satir.kaynak : 'yok',
    }
  }
}

const bosSayi = (deger?: number) =>
  deger === undefined || Number.isNaN(deger) ? null : deger

const musteriAlanlari = (girdi: MusteriGirdisi) => ({
  code: girdi.kod.trim(),
  // Tekillik `code_key` üzerinden. Uygulama ile veritabanı AYNI
  // normalleştirmeyi kullanmalı; ayrışırlarsa ekran "bu kod boş" der,
  // veritabanı "dolu" der.
  code_key: normalizeIdentifier(girdi.kod),
  name: girdi.ad.trim(),
  tax_number: bosaCevir(girdi.vergiNo) ?? null,
  tax_office: bosaCevir(girdi.vergiDairesi) ?? null,
  contact_name: bosaCevir(girdi.yetkili) ?? null,
  phone: bosaCevir(girdi.telefon) ?? null,
  email: bosaCevir(girdi.eposta) ?? null,
  address: bosaCevir(girdi.adres) ?? null,
  payment_term_days: bosSayi(girdi.vadeGunu),
  order_cutoff_time: bosaCevir(girdi.kesimSaati) ?? null,
  delivery_lead_days: bosSayi(girdi.teslimGunFarki),
  notes: bosaCevir(girdi.not) ?? null,
})

const noktaAlanlari = (girdi: TeslimNoktasiGirdisi) => ({
  customer_id: girdi.musteriId,
  code: girdi.kod.trim(),
  code_key: normalizeIdentifier(girdi.kod),
  name: girdi.ad.trim(),
  address: bosaCevir(girdi.adres) ?? null,
  district: bosaCevir(girdi.ilce) ?? null,
  city: bosaCevir(girdi.il) ?? null,
  contact_name: bosaCevir(girdi.yetkili) ?? null,
  phone: bosaCevir(girdi.telefon) ?? null,
  order_cutoff_time: bosaCevir(girdi.kesimSaati) ?? null,
  delivery_lead_days: bosSayi(girdi.teslimGunFarki),
  delivery_window_start: bosaCevir(girdi.teslimBaslangic) ?? null,
  delivery_window_end: bosaCevir(girdi.teslimBitis) ?? null,
  notes: bosaCevir(girdi.not) ?? null,
})

/**
 * Ham Postgres mesajı ("duplicate key value violates unique constraint
 * customer_code_unique") kullanıcıya bir şey anlatmaz. Daha kötüsü: ne
 * yapacağını da söylemez. Kodun çakıştığını söylemek, çözümü de söylemektir.
 */
const musteriCakismasi = (hata: { code?: string; message: string }, kod: string): Error =>
  hata.code === TEKILLIK_IHLALI
    ? new MusteriKoduCakismasiError(kod.trim())
    : new Error(`Müşteri kaydedilemedi: ${hata.message}`)

const noktaCakismasi = (hata: { code?: string; message: string }, kod: string): Error =>
  hata.code === TEKILLIK_IHLALI
    ? new NoktaKoduCakismasiError(kod.trim())
    : new Error(`Teslim noktası kaydedilemedi: ${hata.message}`)
