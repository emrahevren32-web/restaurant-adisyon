// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4D / KAPI — Başvuru defteri (0032)
//
// Bugüne kadar başvuru `storage.ts` içinde tarayıcı hafızasındaydı: sekme
// kapanınca kayboluyor, başka bir bilgisayardan görünmüyordu. Demonun ilk
// perdesi bu; en kırılgan parça olamaz.
//
// ── İKİ ROL, İKİ AYRI KAPI ────────────────────────────────────────────────
// `gonder()`  → oturum AÇMADAN çalışır (anon). Yalnız ekler.
// diğer hepsi → `platform.manage` izni ister (MİYOP personeli).
//
// Kiracı süzmesi YOK — olamaz: başvuru kiracıdan önce doğar. İzolasyonu
// izin sağlıyor (0032, `app.yetkim_var`).
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

export type BasvuruDurumu =
  | 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export const DURUM_ETIKETLERI: Record<BasvuruDurumu, string> = {
  PENDING: 'Beklemede',
  IN_REVIEW: 'İnceleniyor',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  CANCELLED: 'İptal edildi',
}

/** Karar verilmiş durumlar: buradan çıkış yok. */
export const SON_DURUMLAR: readonly BasvuruDurumu[] =
  ['APPROVED', 'REJECTED', 'CANCELLED'] as const

export type YeniBasvuru = {
  sektorKodu?: string
  firmaAdi: string
  yetkiliAdi: string
  telefon: string
  eposta: string
  il: string
  ilce: string
  adres: string
  /** Bildirilen şube sayısı. ZORUNLU: onayda yalnız merkez şube açılıyor. */
  subeSayisi: number | null
  /** Yaklaşık personel sayısı. ZORUNLU: kaç hesap açılacağını bu söyler. */
  personelSayisi: number | null
  // ⚠️ 0038: vergi bilgisi ZORUNLU DEĞİL. Başvuru anı sözleşme anı değil.
  vergiNo?: string
  vergiDairesi?: string
  not?: string
}

export type Basvuru = {
  id: string
  /** Okunabilir numara (`MIY-K7R3Q`). Anahtar DEĞİL, sorgulama yetkisi vermez. */
  referans: string
  olusturmaZamani: string
  guncellemeZamani: string
  durum: BasvuruDurumu
  sektorKodu: string
  firmaAdi: string
  yetkiliAdi: string
  telefon: string
  eposta: string
  /** Boş olabilir (0038): başvuruda vergi bilgisi zorunlu değil. */
  vergiNo?: string
  vergiDairesi?: string
  il: string
  ilce: string
  adres: string
  /** Eski kayıtlarda yok — o başvurulara bu soru hiç sorulmadı. */
  subeSayisi?: number
  personelSayisi?: number
  not?: string
  kararNotu?: string
  kararZamani?: string
  kiraciId?: string
}

export type BasvuruOlayi = {
  id: number
  zaman: string
  oncekiDurum?: BasvuruDurumu
  yeniDurum: BasvuruDurumu
  aktorAd?: string
  not?: string
}

export type KararGirdisi = {
  durum: BasvuruDurumu
  gerekce: string
  /** Onayda zorunlu: başvurunun dönüştüğü kiracı. */
  kiraciId?: string
  kararVerenId?: string
}

/** Onayın sonucu: başvuru hangi işletmeye dönüştü. */
export type OnaySonucu = {
  kiraciId: string
  kiraciKodu: string
  firmaId: string
  subeId: string
}

export interface BasvuruDefteri {
  /**
   * Herkese açık form. Oturum gerektirmez.
   * Döndürdüğü şey BAŞVURU NUMARASI (`MIY-K7R3Q`) — müşteriye gösterilir.
   */
  gonder(basvuru: YeniBasvuru): Promise<string>
  liste(durumlar?: BasvuruDurumu[]): Promise<Basvuru[]>
  tekil(id: string): Promise<Basvuru | null>
  olaylar(id: string): Promise<BasvuruOlayi[]>
  karar(id: string, girdi: KararGirdisi): Promise<void>
  /**
   * Onay. `karar()`dan AYRI bir metot, çünkü onay yalnızca durum
   * değiştirmiyor: kiracı + firma + merkez şube açıyor (0035). Tek işlem,
   * hepsi ya da hiçbiri.
   *
   * ⚠️ GİRİŞ HESABI AÇMAZ. `auth_user_id` yalnız Supabase Auth üretebilir
   * (A4D madde 4). Ekran bunu açıkça söylemek zorunda.
   */
  onayla(id: string, gerekce: string): Promise<OnaySonucu>
}

type Satir = {
  id: string
  reference: string
  created_at: string
  updated_at: string
  status: string
  sector_code: string
  company_name: string
  owner_name: string
  phone: string
  email: string
  tax_number: string | null
  tax_office: string | null
  city: string
  district: string
  address: string
  branch_count: number | null
  staff_count: number | null
  note: string | null
  decision_note: string | null
  decided_at: string | null
  tenant_id: string | null
}

const KOLONLAR =
  'id, reference, created_at, updated_at, status, sector_code, company_name, owner_name, ' +
  'phone, email, tax_number, tax_office, city, district, address, ' +
  'branch_count, staff_count, note, ' +
  'decision_note, decided_at, tenant_id'

const durumaCevir = (ham: string): BasvuruDurumu =>
  (ham in DURUM_ETIKETLERI ? ham : 'PENDING') as BasvuruDurumu

const basvuruyaCevir = (s: Satir): Basvuru => ({
  id: s.id,
  referans: s.reference,
  olusturmaZamani: s.created_at,
  guncellemeZamani: s.updated_at,
  durum: durumaCevir(s.status),
  sektorKodu: s.sector_code,
  firmaAdi: s.company_name,
  yetkiliAdi: s.owner_name,
  telefon: s.phone,
  eposta: s.email,
  vergiNo: s.tax_number ?? undefined,
  vergiDairesi: s.tax_office ?? undefined,
  il: s.city,
  ilce: s.district,
  adres: s.address,
  subeSayisi: s.branch_count ?? undefined,
  personelSayisi: s.staff_count ?? undefined,
  not: s.note ?? undefined,
  kararNotu: s.decision_note ?? undefined,
  kararZamani: s.decided_at ?? undefined,
  kiraciId: s.tenant_id ?? undefined,
})

export class PostgresBasvuruDefteri implements BasvuruDefteri {
  constructor(private readonly client: SupabaseClient) {}

  async gonder(basvuru: YeniBasvuru): Promise<string> {
    // ⚠️ DOĞRUDAN INSERT YOK. 0033 o yetkiyi kaldırdı; tek yol bu fonksiyon.
    // Sebep: fonksiyon `status`, `tenant_id` ve karar alanlarını PARAMETRE
    // OLARAK BİLE kabul etmiyor — yazılamayacak alanı göndermek mümkün değil.
    const { data, error } = await this.client.rpc('basvuru_gonder', {
      p_company_name: basvuru.firmaAdi.trim(),
      p_owner_name: basvuru.yetkiliAdi.trim(),
      p_phone: basvuru.telefon.trim(),
      p_email: basvuru.eposta.trim().toLowerCase(),
      p_city: basvuru.il.trim(),
      p_district: basvuru.ilce.trim(),
      p_address: basvuru.adres.trim(),
      p_branch_count: basvuru.subeSayisi,
      p_staff_count: basvuru.personelSayisi,
      // ⚠️ Boş vergi alanı boş METİN değil `null` gitmeli: '' veritabanında
      // "yazıldı ama boş" demektir, null "sorulmadı/verilmedi" demektir.
      p_tax_number: basvuru.vergiNo?.trim() || null,
      p_tax_office: basvuru.vergiDairesi?.trim() || null,
      p_sector_code: basvuru.sektorKodu ?? 'industrial-kitchen',
      p_note: basvuru.not?.trim() || null,
    })
    if(error){
      // MI409: aynı e-postadan açık başvuru. Veritabanı zaten insan cümlesi
      // veriyor; ham teknik metni ekrana basmıyoruz.
      if(error.code === 'MI409' || /bekleyen bir başvuru/.test(error.message)){
        throw new Error(
          'Bu e-posta ile değerlendirilmeyi bekleyen bir başvuru zaten var. ' +
          'Sonucu e-posta ile bildireceğiz.',
        )
      }
      throw new Error(`Başvuru kaydedilemedi: ${error.message}`)
    }
    const referans = typeof data === 'string' ? data : ''
    if(!referans) throw new Error('Başvuru kaydedildi ama numara okunamadı.')
    return referans
  }

  async liste(durumlar?: BasvuruDurumu[]): Promise<Basvuru[]> {
    let sorgu = this.client
      .from('business_application')
      .select(KOLONLAR)
      .order('created_at', { ascending: false })
    if(durumlar && durumlar.length > 0) sorgu = sorgu.in('status', durumlar)
    const { data, error } = await sorgu
    if(error) throw new Error(`Başvurular okunamadı: ${error.message}`)
    return ((data as unknown as Satir[] | null) ?? []).map(basvuruyaCevir)
  }

  async tekil(id: string): Promise<Basvuru | null> {
    const { data, error } = await this.client
      .from('business_application').select(KOLONLAR).eq('id', id).maybeSingle()
    if(error) throw new Error(`Başvuru okunamadı: ${error.message}`)
    return data ? basvuruyaCevir(data as unknown as Satir) : null
  }

  async olaylar(id: string): Promise<BasvuruOlayi[]> {
    const { data, error } = await this.client
      .from('business_application_event')
      .select('id, occurred_at, from_status, to_status, actor_name, note')
      .eq('application_id', id)
      .order('occurred_at', { ascending: true })
    if(error) throw new Error(`Başvuru geçmişi okunamadı: ${error.message}`)
    type OlaySatiri = {
      id: number; occurred_at: string; from_status: string | null
      to_status: string; actor_name: string | null; note: string | null
    }
    return ((data as unknown as OlaySatiri[] | null) ?? []).map(o => ({
      id: o.id,
      zaman: o.occurred_at,
      oncekiDurum: o.from_status ? durumaCevir(o.from_status) : undefined,
      yeniDurum: durumaCevir(o.to_status),
      aktorAd: o.actor_name ?? undefined,
      not: o.note ?? undefined,
    }))
  }

  async onayla(id: string, gerekce: string): Promise<OnaySonucu> {
    const { data, error } = await this.client.rpc('basvuruyu_onayla', {
      p_basvuru_id: id,
      p_gerekce: gerekce.trim(),
    })
    if(error) throw new Error(error.message)
    // `returns table` tek satırlık bir dizi döndürür.
    const satir = (Array.isArray(data) ? data[0] : data) as {
      kiraci_id: string; kiraci_kodu: string; firma_id: string; sube_id: string
    } | null
    if(!satir?.kiraci_id) throw new Error('Onay yazıldı ama işletme bilgisi okunamadı.')
    return {
      kiraciId: satir.kiraci_id,
      kiraciKodu: satir.kiraci_kodu,
      firmaId: satir.firma_id,
      subeId: satir.sube_id,
    }
  }

  async karar(id: string, girdi: KararGirdisi): Promise<void> {
    const { error } = await this.client
      .from('business_application')
      .update({
        status: girdi.durum,
        decision_note: girdi.gerekce.trim(),
        decided_at: new Date().toISOString(),
        decided_by: girdi.kararVerenId ?? null,
        tenant_id: girdi.kiraciId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if(error) throw new Error(`Başvuru kararı yazılamadı: ${error.message}`)
  }
}

/** Bellekte tutan defter — testler ve ekran denemeleri için. */
export class BellekBasvuruDefteri implements BasvuruDefteri {
  private sayac = 0
  readonly kayitlar: Basvuru[] = []
  readonly olayKayitlari: Array<BasvuruOlayi & { basvuruId: string }> = []

  async gonder(basvuru: YeniBasvuru): Promise<string> {
    const acik = this.kayitlar.find(
      k => k.eposta === basvuru.eposta.trim().toLowerCase()
        && (k.durum === 'PENDING' || k.durum === 'IN_REVIEW'),
    )
    if(acik) throw new Error(
      'Bu e-posta ile değerlendirilmeyi bekleyen bir başvuru zaten var. ' +
      'Sonucu e-posta ile bildireceğiz.',
    )
    this.sayac += 1
    const simdi = new Date(this.sayac * 1000).toISOString()
    const kayit: Basvuru = {
      id: `bsv-${this.sayac}`,
      referans: `MIY-TEST${this.sayac}`,
      olusturmaZamani: simdi,
      guncellemeZamani: simdi,
      durum: 'PENDING',
      sektorKodu: basvuru.sektorKodu ?? 'industrial-kitchen',
      firmaAdi: basvuru.firmaAdi.trim(),
      yetkiliAdi: basvuru.yetkiliAdi.trim(),
      telefon: basvuru.telefon.trim(),
      eposta: basvuru.eposta.trim().toLowerCase(),
      vergiNo: basvuru.vergiNo?.trim() || undefined,
      vergiDairesi: basvuru.vergiDairesi?.trim() || undefined,
      subeSayisi: basvuru.subeSayisi ?? undefined,
      personelSayisi: basvuru.personelSayisi ?? undefined,
      il: basvuru.il.trim(),
      ilce: basvuru.ilce.trim(),
      adres: basvuru.adres.trim(),
      not: basvuru.not?.trim() || undefined,
    }
    this.kayitlar.unshift(kayit)
    this.olayKayitlari.push({
      basvuruId: kayit.id, id: this.olayKayitlari.length + 1,
      zaman: simdi, yeniDurum: 'PENDING',
    })
    return kayit.referans
  }

  async liste(durumlar?: BasvuruDurumu[]): Promise<Basvuru[]> {
    return durumlar && durumlar.length > 0
      ? this.kayitlar.filter(k => durumlar.includes(k.durum))
      : [...this.kayitlar]
  }

  async tekil(id: string): Promise<Basvuru | null> {
    return this.kayitlar.find(k => k.id === id) ?? null
  }

  async olaylar(id: string): Promise<BasvuruOlayi[]> {
    return this.olayKayitlari.filter(o => o.basvuruId === id)
  }

  async onayla(id: string, gerekce: string): Promise<OnaySonucu> {
    const kayit = this.kayitlar.find(k => k.id === id)
    if(!kayit) throw new Error('Başvuru bulunamadı.')
    if(kayit.durum !== 'IN_REVIEW'){
      throw new Error(`Önce başvuruyu incelemeye almalısınız (şu an: ${kayit.durum}).`)
    }
    const kod = `TST${String(this.kayitlar.length).padStart(3, '0')}`
    await this.karar(id, { durum: 'APPROVED', gerekce, kiraciId: `kiraci-${kod}` })
    return {
      kiraciId: `kiraci-${kod}`, kiraciKodu: kod,
      firmaId: `firma-${kod}`, subeId: `sube-${kod}`,
    }
  }

  async karar(id: string, girdi: KararGirdisi): Promise<void> {
    const kayit = this.kayitlar.find(k => k.id === id)
    if(!kayit) throw new Error('Başvuru bulunamadı.')
    const onceki = kayit.durum
    kayit.durum = girdi.durum
    kayit.kararNotu = girdi.gerekce.trim()
    kayit.kararZamani = new Date().toISOString()
    kayit.kiraciId = girdi.kiraciId
    this.olayKayitlari.push({
      basvuruId: id, id: this.olayKayitlari.length + 1,
      zaman: kayit.kararZamani, oncekiDurum: onceki,
      yeniDurum: girdi.durum, not: girdi.gerekce.trim(),
    })
  }
}
