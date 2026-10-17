// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · EVREN360 müşteri görünümü — veri katmanı
//
// ⚠️ NEDEN RPC, NEDEN DÜZ SORGU DEĞİL
// `tenant`, `company`, `app_user`, `audit_log` tablolarının hepsinde RLS var:
// bir oturum yalnız KENDİ kiracısının satırlarını görür — platform admini
// dâhil. Platformun bütün müşterileri görebilmesi için `security definer`
// fonksiyonlar kullanılıyor (0083) ve o fonksiyonların İLK SATIRI yetki
// kontrolü: `app.platform_kapisi()` → `platform.manage`.
//
// Yetkiyi ekran değil VERİTABANI sınıyor. Bu dosya silinse de kural durur.
//
// ⚠️ Fonksiyonlar müşterinin ticari verisini DÖNDÜRMEZ: fiyat yok, kime
// sattığı yok, ne ürettiği yok (Emrah kararı, 16.10.2026). Dönen şey
// künye, lisans ve kullanım yoğunluğu.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

const metin = (deger: unknown): string => (
  deger === null || deger === undefined ? '' : String(deger)
)

/** `null` ile `0`ı ayırmak gerekiyor: "bilinmiyor" ile "sıfır" aynı şey değil. */
const sayiVeyaBos = (deger: unknown): number | null => (
  deger === null || deger === undefined || deger === '' ? null : Number(deger)
)

export type MusteriSatiri = {
  kiraciId: string
  kiraciKodu: string
  kiraciAdi: string
  kiraciDurumu: string
  kayitTarihi: string
  firmaAdi: string
  il: string
  ilce: string
  sektor: string
  paketAdi: string
  lisansDurumu: string
  lisansBitis: string
  kalanGun: number | null
  kullaniciSayisi: number
  sonGiris: string
  sonHareket: string
}

export type MusteriDetayi = {
  // 1 · Şirket
  kiraciId: string
  kiraciKodu: string
  kiraciAdi: string
  kiraciDurumu: string
  firmaAdi: string
  ticariUnvan: string
  sektor: string
  il: string
  ilce: string
  adres: string
  telefon: string
  eposta: string
  webSitesi: string
  vergiDairesi: string
  vergiNo: string
  beyanCalisanSayisi: number | null
  beyanSubeSayisi: number | null
  kayitliSubeSayisi: number
  // 2 · Üyelik ve lisans
  kayitTarihi: string
  uyelikDurumu: string
  lisansDurumu: string
  lisansBaslangic: string
  lisansBitis: string
  kalanGun: number | null
  denemeMi: boolean
  paketKodu: string
  paketAdi: string
  moduller: string[]
  lisansNotu: string
  // 3 · Yetkili ve kullanıcı
  yetkiliAd: string
  yetkiliUnvan: string
  yetkiliTelefon: string
  yetkiliEposta: string
  kullaniciSayisi: number
  aktifKullanici: number
  sonGiris: string
  // 4 · Kullanım
  sonHareket: string
  son30GunIslem: number
  // 5 · Ödeme
  aylikUcret: number | null
  yillikUcret: number | null
  fiyatBelirlendi: boolean
}

export type MusteriKullanicisi = {
  kullaniciId: string
  adSoyad: string
  kullaniciAdi: string
  rolKodu: string
  aktif: boolean
  olusturma: string
  sonGiris: string
}

export type KullanimSaati = { saat: number; islemSayisi: number }

const satirlar = (veri: unknown): Record<string, unknown>[] => (
  (veri as Record<string, unknown>[] | null) ?? []
)

export const musteriListesiniOku = async (
  client: SupabaseClient
): Promise<MusteriSatiri[]> => {
  const { data, error } = await client.rpc('platform_musteri_listesi')
  if(error) throw new Error(`Müşteri listesi okunamadı: ${error.message}`)

  return satirlar(data).map(s => ({
    kiraciId: metin(s.kiraci_id),
    kiraciKodu: metin(s.kiraci_kodu),
    kiraciAdi: metin(s.kiraci_adi),
    kiraciDurumu: metin(s.kiraci_durumu),
    kayitTarihi: metin(s.kayit_tarihi),
    firmaAdi: metin(s.firma_adi),
    il: metin(s.il),
    ilce: metin(s.ilce),
    sektor: metin(s.sektor),
    paketAdi: metin(s.paket_adi),
    lisansDurumu: metin(s.lisans_durumu),
    lisansBitis: metin(s.lisans_bitis),
    kalanGun: sayiVeyaBos(s.kalan_gun),
    kullaniciSayisi: Number(s.kullanici_sayisi ?? 0),
    sonGiris: metin(s.son_giris),
    sonHareket: metin(s.son_hareket)
  }))
}

export const musteriDetayiniOku = async (
  client: SupabaseClient,
  kiraciId: string
): Promise<MusteriDetayi | null> => {
  const { data, error } = await client.rpc('platform_musteri_detayi', { p_kiraci: kiraciId })
  if(error) throw new Error(`Müşteri kartı okunamadı: ${error.message}`)

  const s = satirlar(data)[0]
  if(!s) return null

  return {
    kiraciId: metin(s.kiraci_id),
    kiraciKodu: metin(s.kiraci_kodu),
    kiraciAdi: metin(s.kiraci_adi),
    kiraciDurumu: metin(s.kiraci_durumu),
    firmaAdi: metin(s.firma_adi),
    ticariUnvan: metin(s.ticari_unvan),
    sektor: metin(s.sektor),
    il: metin(s.il),
    ilce: metin(s.ilce),
    adres: metin(s.adres),
    telefon: metin(s.telefon),
    eposta: metin(s.eposta),
    webSitesi: metin(s.web_sitesi),
    vergiDairesi: metin(s.vergi_dairesi),
    vergiNo: metin(s.vergi_no),
    beyanCalisanSayisi: sayiVeyaBos(s.beyan_calisan_sayisi),
    beyanSubeSayisi: sayiVeyaBos(s.beyan_sube_sayisi),
    kayitliSubeSayisi: Number(s.kayitli_sube_sayisi ?? 0),
    kayitTarihi: metin(s.kayit_tarihi),
    uyelikDurumu: metin(s.uyelik_durumu),
    lisansDurumu: metin(s.lisans_durumu),
    lisansBaslangic: metin(s.lisans_baslangic),
    lisansBitis: metin(s.lisans_bitis),
    kalanGun: sayiVeyaBos(s.kalan_gun),
    denemeMi: Boolean(s.deneme_mi),
    paketKodu: metin(s.paket_kodu),
    paketAdi: metin(s.paket_adi),
    moduller: Array.isArray(s.moduller) ? (s.moduller as unknown[]).map(metin) : [],
    lisansNotu: metin(s.lisans_notu),
    yetkiliAd: metin(s.yetkili_ad),
    yetkiliUnvan: metin(s.yetkili_unvan),
    yetkiliTelefon: metin(s.yetkili_telefon),
    yetkiliEposta: metin(s.yetkili_eposta),
    kullaniciSayisi: Number(s.kullanici_sayisi ?? 0),
    aktifKullanici: Number(s.aktif_kullanici ?? 0),
    sonGiris: metin(s.son_giris),
    sonHareket: metin(s.son_hareket),
    son30GunIslem: Number(s.son_30_gun_islem ?? 0),
    aylikUcret: sayiVeyaBos(s.aylik_ucret),
    yillikUcret: sayiVeyaBos(s.yillik_ucret),
    fiyatBelirlendi: Boolean(s.fiyat_belirlendi)
  }
}

export const musteriKullanicilariniOku = async (
  client: SupabaseClient,
  kiraciId: string
): Promise<MusteriKullanicisi[]> => {
  const { data, error } = await client.rpc('platform_musteri_kullanicilari', { p_kiraci: kiraciId })
  if(error) throw new Error(`Kullanıcı listesi okunamadı: ${error.message}`)

  return satirlar(data).map(s => ({
    kullaniciId: metin(s.kullanici_id),
    adSoyad: metin(s.ad_soyad),
    kullaniciAdi: metin(s.kullanici_adi),
    rolKodu: metin(s.rol_kodu),
    aktif: Boolean(s.aktif),
    olusturma: metin(s.olusturma),
    sonGiris: metin(s.son_giris)
  }))
}

export const kullanimSaatleriniOku = async (
  client: SupabaseClient,
  kiraciId: string,
  gun = 90
): Promise<KullanimSaati[]> => {
  const { data, error } = await client.rpc('platform_kullanim_saatleri', {
    p_kiraci: kiraciId, p_gun: gun
  })
  if(error) throw new Error(`Kullanım saatleri okunamadı: ${error.message}`)

  return satirlar(data).map(s => ({
    saat: Number(s.saat ?? 0),
    islemSayisi: Number(s.islem_sayisi ?? 0)
  }))
}
