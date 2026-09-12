// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 / Depo çekirdeği — Tedarikçi deposu
//
// Yol haritası maddesi: "Tedarikçi kayıtları"
//                       Bitti sayılır ki: "Ekle, düzenle, pasife al çalışıyor"
//
// Depo çekirdeğindeki `StokKatalogu` ile aynı biçim: bir PORT (arayüz) ve onun
// Postgres uygulaması. Sebebi ADR-003: ekran arayüze konuşur, testler belleğe
// konuşur, ikisi de aynı sözleşmeyi doğrular. Ekranı sınamak için canlı
// veritabanı gerekmez.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'
import { normalizeIdentifier } from '../core/identifier'

export type Tedarikci = {
  id: string
  kod: string
  ad: string
  vergiNo?: string
  yetkili?: string
  telefon?: string
  eposta?: string
  adres?: string
  not?: string
  aktif: boolean
}

/** Ekle ve düzenle formunun taşıdığı alanlar. `aktif` ayrı bir işlemdir. */
export type TedarikciGirdisi = {
  kod: string
  ad: string
  vergiNo?: string
  yetkili?: string
  telefon?: string
  eposta?: string
  adres?: string
  not?: string
}

export interface TedarikciDeposu {
  /** Pasifler de dahil hepsi; süzmeyi ekran yapar. */
  hepsi(ctx: TenantCtx): Promise<Tedarikci[]>
  ekle(ctx: TenantCtx, girdi: TedarikciGirdisi): Promise<Tedarikci>
  guncelle(ctx: TenantCtx, id: string, girdi: TedarikciGirdisi): Promise<Tedarikci>
  /** Pasife alma / geri açma. Silme YOK — bkz. aşağıdaki not. */
  aktiflikDegistir(ctx: TenantCtx, id: string, aktif: boolean): Promise<Tedarikci>
}

export class TedarikciKoduCakismasiError extends Error {
  constructor(kod: string) {
    super(`"${kod}" kodu başka bir tedarikçide kullanılıyor.`)
    this.name = 'TedarikciKoduCakismasiError'
  }
}

const bosaCevir = (deger: unknown): string | undefined => {
  const metin = typeof deger === 'string' ? deger.trim() : ''
  return metin === '' ? undefined : metin
}

type SupplierSatiri = {
  id: string
  code: string
  name: string
  tax_number: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
}

const tedarikciyeCevir = (satir: SupplierSatiri): Tedarikci => ({
  id: satir.id,
  kod: satir.code,
  ad: satir.name,
  vergiNo: bosaCevir(satir.tax_number),
  yetkili: bosaCevir(satir.contact_name),
  telefon: bosaCevir(satir.phone),
  eposta: bosaCevir(satir.email),
  adres: bosaCevir(satir.address),
  not: bosaCevir(satir.notes),
  aktif: satir.is_active,
})

const SUTUNLAR = 'id, code, name, tax_number, contact_name, phone, email, address, notes, is_active'

/** Postgres'in tekillik ihlali kodu. */
const TEKILLIK_IHLALI = '23505'

/**
 * Postgres uygulaması.
 *
 * ⚠️ Kiracı süzmesini BU SINIF yapmaz — RLS yapar (ADR-004). Sorgulara
 * `tenant_id` eşitliği eklenmiyor; eklersek "filtre var, demek ki güvenli"
 * yanılsaması doğar ve asıl koruma olan RLS'in kapalı kalması fark edilmez.
 * `ctx.tenantId` yalnızca YAZARKEN, not-null sütunu doldurmak için kullanılır.
 */
export class PostgresTedarikciDeposu implements TedarikciDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async hepsi(_ctx: TenantCtx): Promise<Tedarikci[]> {
    const { data, error } = await this.client
      .from('supplier')
      .select(SUTUNLAR)
      .order('name')

    if(error) throw new Error(`Tedarikçiler okunamadı: ${error.message}`)
    return ((data as SupplierSatiri[] | null) ?? []).map(tedarikciyeCevir)
  }

  async ekle(ctx: TenantCtx, girdi: TedarikciGirdisi): Promise<Tedarikci> {
    const { data, error } = await this.client
      .from('supplier')
      .insert({ tenant_id: ctx.tenantId, ...alanlar(girdi) })
      .select(SUTUNLAR)
      .single()

    if(error) throw cakismaVarsaCevir(error, girdi.kod)
    return tedarikciyeCevir(data as SupplierSatiri)
  }

  async guncelle(_ctx: TenantCtx, id: string, girdi: TedarikciGirdisi): Promise<Tedarikci> {
    const { data, error } = await this.client
      .from('supplier')
      .update(alanlar(girdi))
      .eq('id', id)
      .select(SUTUNLAR)
      .single()

    if(error) throw cakismaVarsaCevir(error, girdi.kod)
    return tedarikciyeCevir(data as SupplierSatiri)
  }

  async aktiflikDegistir(_ctx: TenantCtx, id: string, aktif: boolean): Promise<Tedarikci> {
    const { data, error } = await this.client
      .from('supplier')
      .update({ is_active: aktif })
      .eq('id', id)
      .select(SUTUNLAR)
      .single()

    if(error) throw new Error(`Tedarikçi durumu değiştirilemedi: ${error.message}`)
    return tedarikciyeCevir(data as SupplierSatiri)
  }
}

const alanlar = (girdi: TedarikciGirdisi) => ({
  code: girdi.kod.trim(),
  // Tekillik `code_key` üzerinden. Uygulama ile veritabanı AYNI normalleştirmeyi
  // kullanmalı; ayrışırlarsa ekran "bu kod boş" der, veritabanı "dolu" der.
  code_key: normalizeIdentifier(girdi.kod),
  name: girdi.ad.trim(),
  tax_number: bosaCevir(girdi.vergiNo) ?? null,
  contact_name: bosaCevir(girdi.yetkili) ?? null,
  phone: bosaCevir(girdi.telefon) ?? null,
  email: bosaCevir(girdi.eposta) ?? null,
  address: bosaCevir(girdi.adres) ?? null,
  notes: bosaCevir(girdi.not) ?? null,
})

/**
 * Tekillik ihlalini okunabilir bir hataya çevirir.
 *
 * Ham Postgres mesajı ("duplicate key value violates unique constraint
 * supplier_code_unique") kullanıcıya bir şey anlatmaz. Daha kötüsü: kullanıcı
 * ne yapacağını bilemez. Kodun çakıştığını söylemek, çözümü de söylemektir.
 */
const cakismaVarsaCevir = (hata: { code?: string; message: string }, kod: string): Error =>
  hata.code === TEKILLIK_IHLALI
    ? new TedarikciKoduCakismasiError(kod.trim())
    : new Error(`Tedarikçi kaydedilemedi: ${hata.message}`)
