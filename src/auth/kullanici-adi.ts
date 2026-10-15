// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Kullanıcı adı önerisi (0078)
//
// ── NEDEN GÖREV ADI DEĞİL, KİŞİ ADI ──────────────────────────────────────
// Hesaplar bir ay boyunca "depocu", "sefi", "muhasebe" diye açılacak gibi
// duruyordu. Emrah itiraz etti ve haklıydı — gerekçesi sandığından güçlü:
//
// ⚠️ GÖREV ADIYLA AÇILAN HESAP DEVREDİLİR. Alaattin işten ayrılır, yerine
// gelen aynı hesabı kullanır. O andan sonra defterdeki her imza yalan
// söyler: "depocu onayladı" KİMİN onayladığını söylemez. İzlenebilirliğin
// ve HACCP'in tek dayanağı imzanın bir KİŞİYİ göstermesidir. Görev adıyla
// açılan hesap, müşteriye sattığımız iki şeyi birden çürütür.
//
// İkinci gerekçe: 35 firma × 40 personel ortamında "depocu" 35 kez var.
// Kişi adı çakışmayı azaltır; firma kodu (0078) kalanını bitirir.
//
// ── ⚠️ BU DOSYA KURAL KOYMAZ, ÖNERİ ÜRETİR ───────────────────────────────
// Asıl normalleştirici VERİTABANINDA (`app.kullanici_adi_duzelt`, 0078).
// Buradaki kopya yalnız yazarken canlı önizleme içindir — her tuş için
// sunucuya gitmek saçma olurdu. Kaydedilen ad her zaman SUNUCUNUN
// döndürdüğü addır; ekran onu gösterir.
//
// Yine de ikisi ayrışmasın diye `kullanici-adi.test.ts` içinde, doğrudan
// SQL'den üretilmiş bir örnek tablosu var. Sunucudaki kural değişirse o
// tablo kırmızıya döner.
// ═══════════════════════════════════════════════════════════════════════════

const TURKCE: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
}

/**
 * Ad soyadı kullanıcı adına çevirir: "Alaattin Kocatepe" → "alaattin.kocatepe".
 *
 * ⚠️ Sıra, SQL'deki sırayla BİREBİR aynı: küçük harf → Türkçe harfleri
 * sadeleştir → boşluk/alt çizgi noktaya → kalan işaretleri at → çift
 * noktayı teke indir → 40'a kırp → baştaki/sondaki noktayı at.
 * Kırpma noktadan ÖNCE olmalı; tersi "ali.veli." bırakırdı.
 */
export const kullaniciAdiOner = (adSoyad: string): string => {
  const kucuk = (adSoyad || '').trim().toLowerCase()
  const sade = Array.from(kucuk).map(h => TURKCE[h] ?? h).join('')
  return sade
    .replace(/[\s_]+/g, '.')
    // Türkçe 'İ' küçültülünce geriye bir birleşik nokta (U+0307) kalabiliyor;
    // harf/rakam/nokta dışındaki her şeyle birlikte o da burada düşüyor.
    .replace(/[^a-z0-9.]/g, '')
    .replace(/\.{2,}/g, '.')
    .slice(0, 40)
    .replace(/^\.+|\.+$/g, '')
}

/**
 * Görev adları — kullanıcı adı olarak kullanılmaları UYARI gerektirir.
 *
 * ⚠️ YASAK DEĞİL, UYARI. Yönetici ısrar ederse açabilir: belki gerçekten
 * paylaşılan bir tablet hesabı istiyordur. Karar onun, ama sonucunu
 * bilerek versin.
 */
const GOREV_SOZCUKLERI = [
  'depo', 'depocu', 'sef', 'sefi', 'asci', 'ascibasi', 'mudur', 'muduru',
  'muhasebe', 'muhasebeci', 'kalite', 'kalitesorumlusu', 'uretim',
  'sevkiyat', 'satinalma', 'planlama', 'personel', 'admin', 'yonetici',
  'operator', 'sorumlu', 'sorumlusu', 'gidamuhendisi', 'patron', 'usta',
]

/** Kullanıcı adı bir görev adına mı benziyor? */
export const gorevAdiMi = (kullaniciAdi: string): boolean => {
  const ad = (kullaniciAdi || '').trim().toLowerCase()
  if(!ad) return false
  // Noktayla ayrılmış parçalar: "depo.sorumlusu" da yakalansın.
  const parcalar = ad.split('.').filter(Boolean)
  if(parcalar.length === 0) return false
  // ⚠️ İçinde bir isim geçiyorsa uyarmıyoruz: "ali.depocu" bir kişiyi
  // gösteriyor, devredilebilir bir hesap değil.
  return parcalar.every(p => GOREV_SOZCUKLERI.includes(p))
}
