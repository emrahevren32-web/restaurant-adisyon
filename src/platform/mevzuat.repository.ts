// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · MEVZUAT AKIŞI · defter (veritabanı erişimi)
//
// ADR-005: ekranlar `supabase.from(...)` yazmaz; repository katmanından
// geçerler. Bu dosya o katman.
//
// ── DÖRT KAPI, BİRİ OTURUMSUZ ────────────────────────────────────────────
//   vitriniOku()  → oturum YOK (giriş ekranındaki ziyaretçi · yalnız YAYINDA)
//   listele()     → yalnız platform yöneticisi (her durum, imzalarıyla)
//   yaz()         → yalnız platform yöneticisi
//   sil()         → yalnız platform yöneticisi
//
// ⚠️ TABLOYA DOĞRUDAN ERİŞİM YOK, OLAMAZ. 0113 `anon` ve `authenticated`
// rollerine `regulation_news` üzerinde hiçbir yetki vermiyor ve RLS'te
// hiç politika yok. Yani buradaki her çağrı bir RPC olmak ZORUNDA;
// `.from('regulation_news')` yazan biri 42501 alır.
//
// ⚠️ VİTRİN OKUMASI `status`u HİÇ GÖRMÜYOR. Sunucu yalnız YAYINDA
// satırları ve yalnız gösterilecek alanları döndürüyor; taslak bir satırın
// ekrana düşmesi istemcinin bir hatasıyla bile mümkün değil.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  MEVZUAT_TURLERI,
  type MevzuatDurumu,
  type MevzuatGirdisi,
  type MevzuatTuru,
  VITRIN_SATIR_SINIRI,
} from './mevzuat.service'

/** Giriş vitrinine çıkan satır — `status` ve imza alanları YOK. */
export type MevzuatVitrinSatiri = {
  baslik: string
  ozet: string | null
  kaynakAdi: string
  kaynakAdresi: string
  yayimTarihi: string
  /** Göç 0114: vitrin satırı türüne göre gruplandırıyor. */
  tur: MevzuatTuru
}

/** Yönetim ekranının gördüğü satır. */
export type MevzuatSatiri = MevzuatVitrinSatiri & {
  kimlik: string
  durum: MevzuatDurumu
  olusturma: string
  yazan: string | null
  sonIslem: string
  sonYazan: string | null
}

export interface MevzuatDefteri {
  /** Oturumsuz. Boş dizi dönerse ekran kutuyu HİÇ çizmez. */
  vitriniOku(limit?: number): Promise<MevzuatVitrinSatiri[]>
  listele(): Promise<MevzuatSatiri[]>
  /** `kimlik` boşsa yeni kayıt açar; doluysa günceller. Kimliği döndürür. */
  yaz(kimlik: string | null, girdi: MevzuatGirdisi): Promise<string>
  sil(kimlik: string): Promise<void>
}

/**
 * Sunucunun verdiği hatayı kişiye gösterilecek cümleye çevirir.
 *
 * ⚠️ Bu kodlar veritabanında yazılı (0113). Burada yeniden YAZILMIYOR,
 * yalnızca tanınıyor: cümlenin kendisi sunucudan geliyor ki iki yerde iki
 * farklı cümle olmasın.
 */
const anlasilirHata = (kod: string | undefined, metin: string, varsayilan: string): Error => {
  if(kod === 'MI422' || kod === 'MI403' || kod === 'MI404') return new Error(metin)
  return new Error(`${varsayilan} (${metin})`)
}

/**
 * ⚠️ Tanınmayan bir tür `HABER`e düşüyor, ATILMIYOR.
 *
 * Satır zaten veritabanının kısıtından geçmiş (0114 · dört değer). Buraya
 * tanınmayan bir şey gelirse sebebi sunucunun yeni bir tür tanımış, bu
 * dosyanın henüz tanımamış olmasıdır. O satırı atmak, Emrah'ın panelden
 * yayına aldığı bir kaydın ekranda SESSİZCE yok olması demek olurdu.
 */
const tureCevir = (deger: unknown): MevzuatTuru => {
  const metin = String(deger ?? '').trim().toUpperCase()
  return (MEVZUAT_TURLERI as readonly string[]).includes(metin)
    ? (metin as MevzuatTuru)
    : 'HABER'
}

const vitrineCevir = (s: Record<string, unknown>): MevzuatVitrinSatiri => ({
  baslik: String(s.baslik ?? ''),
  ozet: (s.ozet as string | null) ?? null,
  kaynakAdi: String(s.kaynak_adi ?? ''),
  kaynakAdresi: String(s.kaynak_adresi ?? ''),
  yayimTarihi: String(s.yayim_tarihi ?? ''),
  tur: tureCevir(s.tur),
})

export class PostgresMevzuatDefteri implements MevzuatDefteri {
  constructor(private readonly client: SupabaseClient){ }

  async vitriniOku(limit: number = VITRIN_SATIR_SINIRI): Promise<MevzuatVitrinSatiri[]> {
    const { data, error } = await this.client.rpc('mevzuat_akisi_oku', { p_limit: limit })
    // ⚠️ VİTRİNDE HATA FIRLATILMIYOR. Burası giriş ekranı: oraya gelen kişi
    // giriş yapmaya gelmiştir, mevzuat okumaya değil. Okuma düşerse kutu
    // hiç çizilmez — hata mesajı göstermek giriş ekranını bozar.
    if(error){
      console.warn('[MİYOP] Mevzuat akışı okunamadı:', error.message)
      return []
    }
    return (Array.isArray(data) ? data : []).map(vitrineCevir)
  }

  async listele(): Promise<MevzuatSatiri[]> {
    const { data, error } = await this.client.rpc('mevzuat_listesi')
    if(error){
      throw anlasilirHata(error.code, error.message, 'Mevzuat listesi okunamadı.')
    }
    return (Array.isArray(data) ? data : []).map((s: Record<string, unknown>) => ({
      ...vitrineCevir(s),
      kimlik: String(s.kimlik ?? ''),
      durum: String(s.durum ?? 'TASLAK') as MevzuatDurumu,
      olusturma: String(s.olusturma ?? ''),
      yazan: (s.yazan as string | null) ?? null,
      sonIslem: String(s.son_islem ?? ''),
      sonYazan: (s.son_yazan as string | null) ?? null,
    }))
  }

  async yaz(kimlik: string | null, girdi: MevzuatGirdisi): Promise<string> {
    // ⚠️ `created_by`, `updated_by` ve zaman damgaları GÖNDERİLMİYOR —
    // sunucuda bile PARAMETRE olarak yok (0087'nin kuralı, 0113).
    const { data, error } = await this.client.rpc('mevzuat_yaz', {
      p_id: kimlik && kimlik.trim() ? kimlik.trim() : null,
      p_baslik: girdi.baslik.trim(),
      p_ozet: girdi.ozet.trim() || null,
      p_kaynak_adi: girdi.kaynakAdi.trim(),
      p_kaynak_adres: girdi.kaynakAdresi.trim(),
      p_yayim_tarihi: girdi.yayimTarihi,
      p_tur: girdi.tur,
      p_durum: girdi.durum,
    })
    if(error){
      throw anlasilirHata(error.code, error.message, 'Mevzuat kaydı yazılamadı.')
    }
    const id = typeof data === 'string' ? data : ''
    // ⚠️ "Kaydedildi" demek için kimlik şart: kimlik yoksa kaydın gerçekten
    // yazıldığını bilmiyoruz ve "kaydedildi" demek bir iddia olurdu.
    if(!id) throw new Error('Kayıt yazıldı ama kimliği okunamadı.')
    return id
  }

  async sil(kimlik: string): Promise<void> {
    const { error } = await this.client.rpc('mevzuat_sil', { p_id: kimlik })
    if(error){
      throw anlasilirHata(error.code, error.message, 'Kayıt silinemedi.')
    }
  }
}

/**
 * Bellek defteri — yalnız SINAMALAR için.
 *
 * ⚠️ Bu sınıf hiçbir ekranda kullanılmıyor ve kullanılmamalı: ekranda
 * kullanılsaydı "kaydettim" diyen ama veritabanına hiçbir şey yazmayan bir
 * yüzey olurdu (A1 başlığının tamamı bu hataydı).
 */
export class BellekMevzuatDefteri implements MevzuatDefteri {
  private satirlar: MevzuatSatiri[] = []
  private sayac = 0

  async vitriniOku(limit: number = VITRIN_SATIR_SINIRI): Promise<MevzuatVitrinSatiri[]> {
    const tavan = Math.min(Math.max(Math.floor(limit) || VITRIN_SATIR_SINIRI, 1), 30)
    // ⚠️ Sunucudaki sıra TAKLİT EDİLİYOR (0114 · kanun → yönetmelik →
    // tebliğ → haber). Bu bir ikinci gerçek değil: bu sınıf hiçbir ekranda
    // kullanılmıyor, yalnız sınamalar için var. Taklit etmezse sınamalar
    // sunucununkinden BAŞKA bir dünyayı ölçer.
    const turSirasi = (t: MevzuatTuru): number => MEVZUAT_TURLERI.indexOf(t)
    return this.satirlar
      .filter(s => s.durum === 'YAYINDA')
      .sort((a, b) => turSirasi(a.tur) - turSirasi(b.tur)
        || b.yayimTarihi.localeCompare(a.yayimTarihi))
      .slice(0, tavan)
      .map(({ baslik, ozet, kaynakAdi, kaynakAdresi, yayimTarihi, tur }) => ({
        baslik, ozet, kaynakAdi, kaynakAdresi, yayimTarihi, tur,
      }))
  }

  async listele(): Promise<MevzuatSatiri[]> {
    return [...this.satirlar].sort((a, b) => b.yayimTarihi.localeCompare(a.yayimTarihi))
  }


  async yaz(kimlik: string | null, girdi: MevzuatGirdisi): Promise<string> {
    // ⚠️ SUNUCUNUN KURALI BURADA DA GEÇERLİ (0114). Bu sınıf yalnız
    // sınamalar için var; türsüz kaydı kabul etseydi sınamalar sunucunun
    // REDDETTİĞİ bir dünyayı ölçer ve yeşil yanardı.
    if(!MEVZUAT_TURLERI.includes(girdi.tur as MevzuatTuru)){
      throw new Error('Tür seçilmedi (kanun, yönetmelik, tebliğ ya da haber).')
    }
    const tur = girdi.tur as MevzuatTuru
    const simdi = new Date().toISOString()
    if(kimlik){
      const satir = this.satirlar.find(s => s.kimlik === kimlik)
      if(!satir) throw new Error('Kayıt bulunamadı.')
      Object.assign(satir, {
        baslik: girdi.baslik.trim(),
        ozet: girdi.ozet.trim() || null,
        kaynakAdi: girdi.kaynakAdi.trim(),
        kaynakAdresi: girdi.kaynakAdresi.trim(),
        yayimTarihi: girdi.yayimTarihi,
        tur,
        durum: girdi.durum,
        sonIslem: simdi,
      })
      return kimlik
    }
    this.sayac += 1
    const yeni: MevzuatSatiri = {
      kimlik: `bellek-${this.sayac}`,
      baslik: girdi.baslik.trim(),
      ozet: girdi.ozet.trim() || null,
      kaynakAdi: girdi.kaynakAdi.trim(),
      kaynakAdresi: girdi.kaynakAdresi.trim(),
      yayimTarihi: girdi.yayimTarihi,
      tur,
      durum: girdi.durum,
      olusturma: simdi,
      yazan: null,
      sonIslem: simdi,
      sonYazan: null,
    }
    this.satirlar.push(yeni)
    return yeni.kimlik
  }

  async sil(kimlik: string): Promise<void> {
    const once = this.satirlar.length
    this.satirlar = this.satirlar.filter(s => s.kimlik !== kimlik)
    if(this.satirlar.length === once) throw new Error('Kayıt bulunamadı.')
  }
}
