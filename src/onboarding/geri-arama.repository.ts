// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · GERİ ARAMA TALEBİ · defter (veritabanı erişimi)
//
// ADR-005: ekranlar `supabase.from(...)` yazmaz; repository katmanından
// geçerler. Bu dosya o katman.
//
// ── BEŞ KAPI, İKİSİ OTURUMSUZ ────────────────────────────────────────────
//   gonder()           → oturum YOK (ana ekrandaki ziyaretçi)
//   anaEkranTelefonu() → oturum YOK (numara boşsa ekranda hiç görünmez)
//   listele()          → yalnız platform yöneticisi
//   durumuYaz()        → yalnız platform yöneticisi
//   sil()              → yalnız platform yöneticisi (KVKK silme hakkı)
//   telefonuYaz()      → yalnız platform yöneticisi
//
// ⚠️ TABLOYA DOĞRUDAN ERİŞİM YOK, OLAMAZ. 0106 `anon` ve `authenticated`
// rollerine `callback_request` üzerinde hiçbir yetki vermiyor ve RLS'te
// hiç politika yok. Yani bu dosyadaki her çağrı bir RPC olmak ZORUNDA;
// `.from('callback_request')` yazan biri 42501 alır. Bu, katman kuralının
// yanında duran ikinci bir güvencedir.
//
// ⚠️ HAM VERİTABANI METNİ EKRANA BASILMIYOR. Sunucu zaten insan cümlesi
// veriyor (MI422/MI409/MI429); onları olduğu gibi geçiriyoruz, tanımadığımız
// hatayı ise kendi cümlemizle sarıyoruz.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type GeriAramaDurumu,
  type GeriAramaTalebi,
  telefonSadelestir,
} from './geri-arama.service'

export type GeriAramaSatiri = {
  referans: string
  olusturma: string
  adSoyad: string
  telefon: string
  isletmeAdi: string
  eposta: string | null
  konu: string | null
  uygunSaat: string
  durum: GeriAramaDurumu
  arandi: string | null
  arayan: string | null
  notDefteri: string | null
  sonIslem: string
  onayZamani: string
  onaySurumu: string
}

export interface GeriAramaDefteri {
  /** Oturumsuz. Talebin okunabilir numarasını döndürür (`GER-XXXXX`). */
  gonder(talep: GeriAramaTalebi): Promise<string>
  listele(): Promise<GeriAramaSatiri[]>
  durumuYaz(referans: string, durum: GeriAramaDurumu, aciklama: string): Promise<void>
  sil(referans: string): Promise<void>
  /** Oturumsuz. Yazılmamışsa `null` — o zaman ekran hiçbir şey göstermez. */
  anaEkranTelefonu(): Promise<string | null>
  telefonuYaz(telefon: string): Promise<string | null>
}

/**
 * Sunucunun verdiği hatayı kişiye gösterilecek cümleye çevirir.
 *
 * ⚠️ Bu kodlar veritabanında yazılı (0106). Burada yeniden YAZILMIYOR,
 * yalnızca tanınıyor: cümlenin kendisi sunucudan geliyor ki iki yerde iki
 * farklı cümle olmasın.
 */
const anlasilirHata = (kod: string | undefined, metin: string, varsayilan: string): Error => {
  if(kod === 'MI422' || kod === 'MI409' || kod === 'MI429' || kod === 'MI403'
     || kod === 'MI404'){
    return new Error(metin)
  }
  return new Error(`${varsayilan} (${metin})`)
}

export class PostgresGeriAramaDefteri implements GeriAramaDefteri {
  constructor(private readonly client: SupabaseClient){ }

  async gonder(talep: GeriAramaTalebi): Promise<string> {
    // ⚠️ `p_consent` BOOLEAN ve sunucu onu ilk satırda sınıyor. Buradan
    // `true` göndermek yetmez: kullanıcı kutuyu işaretlemediyse
    // `geriAramaDogrula` zaten göndermeye bırakmıyor. İki kat.
    const { data, error } = await this.client.rpc('geri_arama_gonder', {
      p_full_name: talep.adSoyad.trim(),
      // Sunucu da sadeleştiriyor; biz de sadeleştirip gönderiyoruz ki ağdan
      // geçen şey ile kaydedilen şey aynı olsun.
      p_phone: telefonSadelestir(talep.telefon) ?? talep.telefon.trim(),
      p_company_name: talep.isletmeAdi.trim(),
      p_email: talep.eposta.trim().toLowerCase() || null,
      p_topic: talep.konu.trim() || null,
      p_best_time: talep.uygunSaat,
      p_consent: talep.onay === true,
    })
    if(error){
      throw anlasilirHata(error.code, error.message, 'Talebiniz kaydedilemedi.')
    }
    const referans = typeof data === 'string' ? data : ''
    // ⚠️ "Kaydedildi" demek için numara şart: numara yoksa kaydın gerçekten
    // yazıldığını bilmiyoruz ve "aldık" demek bir iddia olurdu.
    if(!referans) throw new Error('Talep kaydedildi ama numara okunamadı.')
    return referans
  }

  async listele(): Promise<GeriAramaSatiri[]> {
    const { data, error } = await this.client.rpc('geri_arama_listesi')
    if(error){
      throw anlasilirHata(error.code, error.message, 'Geri arama listesi okunamadı.')
    }
    const satirlar = Array.isArray(data) ? data : []
    return satirlar.map((s: Record<string, unknown>) => ({
      referans: String(s.referans ?? ''),
      olusturma: String(s.olusturma ?? ''),
      adSoyad: String(s.ad_soyad ?? ''),
      telefon: String(s.telefon ?? ''),
      isletmeAdi: String(s.firma_adi ?? ''),
      eposta: (s.eposta as string | null) ?? null,
      konu: (s.konu as string | null) ?? null,
      uygunSaat: String(s.uygun_saat ?? 'FARKETMEZ'),
      durum: String(s.durum ?? 'NEW') as GeriAramaDurumu,
      arandi: (s.arandi as string | null) ?? null,
      arayan: (s.arayan as string | null) ?? null,
      notDefteri: (s.not_defteri as string | null) ?? null,
      sonIslem: String(s.son_islem ?? ''),
      onayZamani: String(s.onay_zamani ?? ''),
      onaySurumu: String(s.onay_surumu ?? ''),
    }))
  }

  async durumuYaz(referans: string, durum: GeriAramaDurumu, aciklama: string): Promise<void> {
    // ⚠️ "KİM aradı" parametresi YOK ve olmayacak. İmzayı sunucu atıyor
    // (0106 · 0087'nin kuralı). Buradan kimlik göndermek, o imzayı
    // istemcinin iddiasına çevirirdi.
    const { error } = await this.client.rpc('geri_arama_durumu_yaz', {
      p_reference: referans,
      p_status: durum,
      p_note: aciklama.trim() || null,
    })
    if(error){
      throw anlasilirHata(error.code, error.message, 'Durum kaydedilemedi.')
    }
  }

  async sil(referans: string): Promise<void> {
    const { error } = await this.client.rpc('geri_arama_sil', { p_reference: referans })
    if(error){
      throw anlasilirHata(error.code, error.message, 'Kayıt silinemedi.')
    }
  }

  async anaEkranTelefonu(): Promise<string | null> {
    const { data, error } = await this.client.rpc('platform_iletisim_oku')
    // ⚠️ HATA YUTULMUYOR AMA EKRANI DA DEVİRMİYOR: bu çağrı giriş ekranında
    // koşuyor ve tek işi bir telefon göstermek. Düşerse numara GÖRÜNMEZ —
    // uydurma bir numara göstermektense görünmemesi doğrudur.
    if(error){
      console.warn('[MİYOP] Ana ekran telefonu okunamadı:', error.message)
      return null
    }
    const metin = typeof data === 'string' ? data.trim() : ''
    return metin.length > 0 ? metin : null
  }

  async telefonuYaz(telefon: string): Promise<string | null> {
    const { data, error } = await this.client.rpc('platform_iletisim_yaz', {
      p_phone: telefon.trim(),
    })
    if(error){
      throw anlasilirHata(error.code, error.message, 'Telefon kaydedilemedi.')
    }
    const metin = typeof data === 'string' ? data.trim() : ''
    return metin.length > 0 ? metin : null
  }
}

/**
 * Bellek defteri · YALNIZ TEST İÇİN.
 *
 * ⚠️ Bu sınıf uygulamada HİÇ kullanılmıyor ve kullanılmamalı. Varlık
 * sebebi, ekranın davranışını veritabanı olmadan sınamak. Uygulama kodunda
 * buna düşen bir yol olsaydı, "kaydettim" diyen ama hiçbir yere yazmayan
 * bir form elde ederdik — bu depoda yasak olan şeyin tam tanımı.
 */
export class BellekGeriAramaDefteri implements GeriAramaDefteri {
  private satirlar: GeriAramaSatiri[] = []
  private sayac = 0
  private telefon: string | null = null

  async gonder(talep: GeriAramaTalebi): Promise<string> {
    if(talep.onay !== true){
      throw new Error('Formu gönderebilmek için kişisel verilerin işlenmesine onay vermeniz gerekiyor.')
    }
    const sade = telefonSadelestir(talep.telefon)
    if(sade === null) throw new Error('Telefon numarası anlaşılamadı.')
    if(this.satirlar.some(s => s.telefon === sade && s.durum === 'NEW')){
      throw new Error('Bu numara için bekleyen bir geri arama talebi zaten var. En kısa sürede arayacağız.')
    }
    if(this.satirlar.filter(s => s.telefon === sade).length >= 3){
      throw new Error('Bu numaradan bugün çok sayıda talep geldi. Yarın tekrar deneyin ya da bizi arayın.')
    }
    this.sayac += 1
    const simdi = new Date(this.sayac * 1000).toISOString()
    const referans = `GER-TEST${this.sayac}`
    this.satirlar.unshift({
      referans,
      olusturma: simdi,
      adSoyad: talep.adSoyad.trim(),
      telefon: sade,
      isletmeAdi: talep.isletmeAdi.trim(),
      eposta: talep.eposta.trim().toLowerCase() || null,
      konu: talep.konu.trim() || null,
      uygunSaat: talep.uygunSaat,
      durum: 'NEW',
      arandi: null,
      arayan: null,
      notDefteri: null,
      sonIslem: simdi,
      onayZamani: simdi,
      onaySurumu: 'test',
    })
    return referans
  }

  async listele(): Promise<GeriAramaSatiri[]> {
    const sira: Record<GeriAramaDurumu, number> = { NEW: 0, CONTACTED: 1, CLOSED: 2 }
    return [...this.satirlar].sort((a, b) => sira[a.durum] - sira[b.durum])
  }

  async durumuYaz(referans: string, durum: GeriAramaDurumu, aciklama: string): Promise<void> {
    const satir = this.satirlar.find(s => s.referans === referans)
    if(!satir) throw new Error(`Geri arama talebi bulunamadı: ${referans}`)
    if(durum === 'CLOSED' && !aciklama.trim()){
      throw new Error('Talebi kapatırken kısa bir not yazın (ne oldu?).')
    }
    this.sayac += 1
    const simdi = new Date(this.sayac * 1000).toISOString()
    satir.durum = durum
    // Not BİRİKİYOR — veritabanı da böyle yapıyor.
    const yeniSatir = `${simdi} · test · ${durum}${aciklama.trim() ? ` · ${aciklama.trim()}` : ''}`
    satir.notDefteri = satir.notDefteri ? `${satir.notDefteri}\n${yeniSatir}` : yeniSatir
    if(satir.arandi === null && durum !== 'NEW'){
      satir.arandi = simdi
      satir.arayan = 'Test Yöneticisi'
    }
    satir.sonIslem = simdi
  }

  async sil(referans: string): Promise<void> {
    const once = this.satirlar.length
    this.satirlar = this.satirlar.filter(s => s.referans !== referans)
    if(this.satirlar.length === once) throw new Error(`Geri arama talebi bulunamadı: ${referans}`)
  }

  async anaEkranTelefonu(): Promise<string | null> { return this.telefon }

  async telefonuYaz(telefon: string): Promise<string | null> {
    const temiz = telefon.trim()
    if(!temiz){ this.telefon = null; return null }
    const sade = telefonSadelestir(temiz)
    if(sade === null) throw new Error('Telefon numarası anlaşılamadı.')
    this.telefon = sade
    return sade
  }
}
