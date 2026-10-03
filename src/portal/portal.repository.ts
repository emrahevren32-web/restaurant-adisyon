// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C3 — MÜŞTERİ PORTALI (müşteri tarafı)
//
// Emrah'ın modeli: "MİYOP bana bir form linki verecek, ben o linki kendi
// siteme ekleyeceğim. Müşterimin müşterileri oradan sipariş verecek."
//
// ⚠️ BU DOSYA HİÇBİR TABLOYA DOKUNMAZ. Portal kullanıcısının `app_user`
// satırı yok, JWT'sinde tenant iddiası yok; `app.current_tenant_id()` onun
// için NULL döner ve bütün kiracı politikaları RED verir. Portalın TEK
// kapısı 0054'teki `security definer` fonksiyonlardır — 0033/0034'teki
// başvuru formuyla aynı kalıp.
//
// ⚠️ FİYAT YOK. Emrah'ın kararı: "Form fiyat gösterecek mi? Hayır."
// Bu dosyada fiyat TİPİ bile yok; olmayan bir alan sızdırılamaz.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

export type PortalNoktasi = {
  noktaId: string
  ad: string
  adres?: string
  ilce?: string
  il?: string
}

export type PortalUrunu = {
  kalemId: string
  ad: string
  birim: string
}

/** Portalın gördüğü sipariş — fiyat ALANI YOK ve olmayacak. */
export type PortalSiparisi = {
  siparisNo: string
  noktaAdi?: string
  tarih: string
  sevkTarihi?: string
  /** Mutfağın söz verdiği tarih (0053). Müşterinin istediğinden farklı olabilir. */
  sozTarihi?: string
  durum: string
}

export type PortalSatiri = {
  kalemAdi: string
  miktar: number
  birim: string
}

export type PortalSiparisSatiri = {
  kalemId: string
  miktar: number
  birim: string
}

export class PortalHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'PortalHatasi'
  }
}

const bos = (d: unknown): string | undefined => {
  const m = typeof d === 'string' ? d.trim() : ''
  return m === '' ? undefined : m
}

export interface PortalDeposu {
  noktalarim(): Promise<PortalNoktasi[]>
  urunlerim(noktaId: string): Promise<PortalUrunu[]>
  enErkenSevk(noktaId: string): Promise<string | undefined>
  siparislerim(): Promise<PortalSiparisi[]>
  satirlarim(siparisNo: string): Promise<PortalSatiri[]>
  siparisVer(
    noktaId: string, satirlar: readonly PortalSiparisSatiri[],
    teslimTarihi?: string, not?: string,
  ): Promise<string>
}

export class PostgresPortalDeposu implements PortalDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async noktalarim(): Promise<PortalNoktasi[]> {
    const { data, error } = await this.client.rpc('portal_noktalarim')
    if(error) throw new PortalHatasi(`Teslim noktaları okunamadı: ${error.message}`)
    type S = { nokta_id: string; nokta_adi: string; adres: string | null
               ilce: string | null; il: string | null }
    return ((data as unknown as S[] | null) ?? []).map(n => {
      const k: PortalNoktasi = { noktaId: n.nokta_id, ad: n.nokta_adi }
      const a = bos(n.adres); if(a !== undefined) k.adres = a
      const i = bos(n.ilce);  if(i !== undefined) k.ilce = i
      const l = bos(n.il);    if(l !== undefined) k.il = l
      return k
    })
  }

  async urunlerim(noktaId: string): Promise<PortalUrunu[]> {
    const { data, error } = await this.client
      .rpc('portal_urunlerim', { p_nokta: noktaId })
    if(error) throw new PortalHatasi(`Ürün listesi okunamadı: ${error.message}`)
    type S = { kalem_id: string; kalem_adi: string; birim: string }
    return ((data as unknown as S[] | null) ?? [])
      .map(u => ({ kalemId: u.kalem_id, ad: u.kalem_adi, birim: u.birim }))
  }

  async enErkenSevk(noktaId: string): Promise<string | undefined> {
    const { data, error } = await this.client
      .rpc('portal_en_erken_sevk', { p_nokta: noktaId })
    if(error) throw new PortalHatasi(`En erken tarih okunamadı: ${error.message}`)
    return bos(data as unknown as string | null)
  }

  async siparislerim(): Promise<PortalSiparisi[]> {
    const { data, error } = await this.client.rpc('portal_siparislerim')
    if(error) throw new PortalHatasi(`Siparişler okunamadı: ${error.message}`)
    type S = { siparis_no: string; nokta_adi: string | null; tarih: string
               sevk_tarihi: string | null; soz_tarihi: string | null; durum: string }
    return ((data as unknown as S[] | null) ?? []).map(o => {
      const k: PortalSiparisi = { siparisNo: o.siparis_no, tarih: o.tarih, durum: o.durum }
      const n = bos(o.nokta_adi);   if(n !== undefined) k.noktaAdi = n
      const s = bos(o.sevk_tarihi); if(s !== undefined) k.sevkTarihi = s
      const z = bos(o.soz_tarihi);  if(z !== undefined) k.sozTarihi = z
      return k
    })
  }

  async satirlarim(siparisNo: string): Promise<PortalSatiri[]> {
    const { data, error } = await this.client
      .rpc('portal_siparis_satirlarim', { p_siparis_no: siparisNo })
    if(error) throw new PortalHatasi(`Sipariş satırları okunamadı: ${error.message}`)
    type S = { kalem_adi: string; miktar: number | string; birim: string }
    return ((data as unknown as S[] | null) ?? [])
      .map(s => ({ kalemAdi: s.kalem_adi, miktar: Number(s.miktar), birim: s.birim }))
  }

  async siparisVer(
    noktaId: string, satirlar: readonly PortalSiparisSatiri[],
    teslimTarihi?: string, not?: string,
  ): Promise<string> {
    const { data, error } = await this.client.rpc('portal_siparis_ver', {
      p_nokta: noktaId,
      p_satirlar: satirlar.map(s => ({
        kalem_id: s.kalemId, miktar: s.miktar, birim: s.birim,
      })),
      p_teslim: teslimTarihi ?? null,
      p_not: not ?? null,
    })
    if(error) throw new PortalHatasi(error.message)
    return data as unknown as string
  }
}
