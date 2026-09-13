// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 — Yedek doğrulama
//
// ── EMRAH'IN SORUSU ──────────────────────────────────────────────────────
// "En tehlikelisi, alındığı sanılan yedeğin çalışmamasıdır."
//
// Tamamen doğru. Bir yedek ancak GERİ OKUNDUĞUNDA yedektir. İndirilen
// dosyanın bozuk, yarım ya da bambaşka bir işletmeye ait olduğu, ihtiyaç
// anında öğrenilirse çok geçtir.
//
// ── BU DOSYA NE YAPAR ────────────────────────────────────────────────────
// İndirilmiş dosyayı geri okur ve dört soruyu cevaplar:
//   1. Dosya OKUNABİLİYOR mu?          (bozulmuş JSON, yarım indirme)
//   2. MİYOP yedeği mi?                (başka bir dosya seçilmiş olabilir)
//   3. BU İŞLETMEYE mi ait?            ⚠️ en kritik soru — aşağıya bak
//   4. İçindekiler defterle TUTUYOR mu? (satır sayıları)
//
// ── NEDEN "BU İŞLETMEYE Mİ AİT" EN KRİTİK SORU ───────────────────────────
// Emrah'ın sorusu: "iki müşteri birbirinin yedeğini çaldı diyelim,
// birbirinin yedeğine dönebilir mi?"
//
// Bugünkü cevap: HAYIR, çünkü GERİ YÜKLEME DİYE BİR ŞEY YOK. Uygulama
// yalnızca dışa aktarıyor; içeri alma yolu bulunmuyor. Elindeki dosya bir
// çıktı, bir giriş kapısı değil.
//
// Ama soru ileriye dönük olarak da doğru ve cevabı şimdiden verilmeli.
// İçeri alma yazıldığı gün üç savunma birden olacak:
//   1. Bu doğrulama: dosyanın kiracı kimliği oturumunkiyle uyuşmazsa
//      kırmızı uyarı — kullanıcı yanlış dosyayı seçtiğini görür.
//   2. RLS `with check (tenant_id = app.current_tenant_id())`: başka
//      kiracının kimliğiyle satır YAZILAMAZ. Veritabanı reddeder.
//   3. İçeri alma dosyadaki kimlikleri KULLANMAZ; satırları oturumun
//      kiracısına yazar. Yani çalınmış bir dosya, çalanın kendi verisine
//      dönüşür — kurbanın verisine açılan bir pencere olmaz.
//
// Asıl risk geri yükleme değil, DOSYANIN KENDİSİ: sızarsa Not Defteri'yle
// okunur. Bu yüzden dosya sunucuya hiç uğramıyor, yalnızca yetkili
// kullanıcı üretebiliyor ve her üretim günlüğe (0029) yazılıyor.
// ═══════════════════════════════════════════════════════════════════════════

import type { DisaAktarmaKunyesi } from './tenant-export'

export type BulguDurumu = 'gecti' | 'uyari' | 'kaldi'

export type Bulgu = {
  baslik: string
  durum: BulguDurumu
  aciklama: string
}

export type DogrulamaSonucu = {
  gecti: boolean
  bulgular: Bulgu[]
  kunye?: DisaAktarmaKunyesi
}

type Beklenen = {
  /** Oturumdaki kiracı — dosyanınkiyle karşılaştırılır. */
  kiracıId: string
  /** Şu anki defterdeki satır sayıları (tablo → adet). İsteğe bağlı. */
  guncelSayilar?: Record<string, number>
}

const gecti = (baslik: string, aciklama: string): Bulgu =>
  ({ baslik, durum: 'gecti', aciklama })
const uyari = (baslik: string, aciklama: string): Bulgu =>
  ({ baslik, durum: 'uyari', aciklama })
const kaldi = (baslik: string, aciklama: string): Bulgu =>
  ({ baslik, durum: 'kaldi', aciklama })

/**
 * Yedek dosyasını doğrular.
 *
 * ⚠️ Bu bir GERİ YÜKLEME DEĞİLDİR. Hiçbir şey yazılmaz, hiçbir şey
 * değiştirilmez. Dosya yalnızca okunur ve kontrol edilir.
 */
export const yedegiDogrula = (
  ham: string, beklenen: Beklenen,
): DogrulamaSonucu => {
  const bulgular: Bulgu[] = []

  // ── 1 · Okunabiliyor mu ─────────────────────────────────────────────
  let icerik: { kunye?: DisaAktarmaKunyesi; veri?: Record<string, unknown[]> }
  try {
    icerik = JSON.parse(ham)
  } catch {
    return {
      gecti: false,
      bulgular: [kaldi(
        'Dosya okunamıyor',
        'İçerik geçerli bir JSON değil. Dosya bozulmuş ya da indirme yarım '
        + 'kalmış olabilir. Yeni bir yedek alın.',
      )],
    }
  }
  bulgular.push(gecti('Dosya okunabiliyor', 'İçerik eksiksiz ve çözümlenebildi.'))

  // ── 2 · MİYOP yedeği mi ─────────────────────────────────────────────
  const kunye = icerik?.kunye
  if(!kunye || typeof kunye.bicimSurumu !== 'number' || !icerik.veri){
    return {
      gecti: false,
      bulgular: [...bulgular, kaldi(
        'MİYOP yedeği değil',
        'Dosyada künye bulunamadı. Başka bir dosya seçmiş olabilirsiniz.',
      )],
    }
  }
  bulgular.push(gecti(
    'MİYOP yedeği',
    `Biçim sürümü ${kunye.bicimSurumu} · ${new Date(kunye.olusturmaZamani).toLocaleString('tr-TR')}`,
  ))

  // ── 3 · Bu işletmeye mi ait ─────────────────────────────────────────
  // En kritik kontrol. Yanlış dosyayı geri yüklemeye çalışmak, bir
  // işletmenin verisini başka bir işletmenin verisiyle karıştırmaktır.
  const ayni = kunye.kiracıId === beklenen.kiracıId
  bulgular.push(ayni
    ? gecti('Bu işletmeye ait', 'Dosyadaki işletme kimliği oturumla aynı.')
    : kaldi(
      'BAŞKA BİR İŞLETMENİN YEDEĞİ',
      `Dosya ${kunye.kiracıId.slice(0, 8)}… işletmesine ait, siz `
      + `${beklenen.kiracıId.slice(0, 8)}… ile giriş yaptınız. Bu dosya sizin `
      + 'verinizi geri getirmez. Yanlış dosyayı seçmiş olabilirsiniz.',
    ))

  // ── 4 · İçeriği eksiksiz mi ─────────────────────────────────────────
  if(kunye.eksikTablolar?.length > 0){
    bulgular.push(kaldi(
      'Yedek EKSİK alınmış',
      `${kunye.eksikTablolar.join(', ')} okunamamış. Bu dosya tam bir yedek `
      + 'değil; yenisini alın.',
    ))
  } else {
    bulgular.push(gecti(
      'Eksiksiz alınmış',
      `${kunye.toplamSatir} satır · ${kunye.tablolar.length} tablo.`,
    ))
  }

  // ── 5 · Dosyadaki sayılar künyeyle tutuyor mu ───────────────────────
  // Künye "5000 satır" diyor ama veri bölümünde 12 satır varsa dosya
  // kurcalanmış ya da yarım yazılmış demektir.
  const gercek = Object.values(icerik.veri).reduce((a, d) => a + (d?.length ?? 0), 0)
  bulgular.push(gercek === kunye.toplamSatir
    ? gecti('Künye ile içerik tutuyor', `${gercek} satır sayıldı.`)
    : kaldi(
      'Künye ile içerik TUTMUYOR',
      `Künye ${kunye.toplamSatir} satır diyor, dosyada ${gercek} satır var. `
      + 'Dosya değiştirilmiş ya da eksik yazılmış olabilir.',
    ))

  // ── 6 · Bugünkü defterle karşılaştırma ──────────────────────────────
  // Fark olması NORMAL: yedek geçmişte alındı, o günden beri iş yapıldı.
  // Anlamlı olan büyüklük: yedekte hiç yokken bugün çok satır varsa,
  // yedek çok eski demektir.
  if(beklenen.guncelSayilar){
    const farklar: string[] = []
    for(const [tablo, guncel] of Object.entries(beklenen.guncelSayilar)){
      const yedekte = icerik.veri[tablo]?.length ?? 0
      if(guncel > yedekte) farklar.push(`${tablo} +${guncel - yedekte}`)
    }
    bulgular.push(farklar.length === 0
      ? gecti('Defterle aynı', 'Yedek alındığından beri yeni kayıt eklenmemiş.')
      : uyari(
        'Yedekten sonra iş yapılmış',
        `Şu an defterde daha fazla kayıt var: ${farklar.join(' · ')}. `
        + 'Bu normaldir; yedek o anın fotoğrafıdır. Ama arada çok fark '
        + 'varsa yeni bir yedek almanın zamanı gelmiş demektir.',
      ))
  }

  return {
    gecti: bulgular.every(b => b.durum !== 'kaldi'),
    bulgular,
    kunye,
  }
}
