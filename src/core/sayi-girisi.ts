// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · SAYI GİRİŞİ — kullanıcı yazarken biçimlendirme (Türkçe)
//
// Emrah (03.10.2026): *"fiyat kısmına 12450 yazdım… ama noktalama falan yok.
// Bunlar ince ama önemli ayrıntılar. Sistem ben rakam girerken otomatik
// kendi yapmalı binleri."*
//
// Türkçe yazım: binlik ayracı NOKTA, ondalık ayracı VİRGÜL → 12.450,75
//
// ⚠️ BİÇİM İLE SAYI AYRI ŞEYLER. Ekranda `12.450,75` yazar; deftere giden
// sayı `12450.75`'tir. İkisini karıştıran kod, noktayı binlik mi ondalık mı
// sayacağını bilemez ve 12.450'yi ON İKİ BUÇUK diye kaydeder. Bu yüzden
// yazma (`tutarYaz`) ve okuma (`tutarOku`) ayrı iki fonksiyon.
//
// ⚠️ YAZARKEN YUVARLAMA YOK. Kullanıcı "12450," yazdığında virgül SİLİNMEZ;
// silinseydi ondalık yazmak imkânsız olurdu (her tuşta virgül kaybolurdu).
// ═══════════════════════════════════════════════════════════════════════════

/** Binlik ayracı eklenmiş tam kısım: 12450 → "12.450" */
const binlikle = (tamKisim: string): string => {
  const temiz = tamKisim.replace(/^0+(?=\d)/, '')
  return temiz.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Kullanıcı yazarken çağrılır. Girilen metni Türkçe biçime çevirir ve
 * geçersiz karakterleri atar.
 *
 * @param basamak ondalık hane sınırı (tutarda 2, miktarda 3)
 */
export const sayiYazarken = (ham: string, basamak = 2): string => {
  // Hem nokta hem virgül yazılabilir; ikisi de ondalık ayracı sayılır.
  // Yapıştırılan "12.450,75" metninde NOKTALAR binliktir, virgül ondalıktır:
  // önce virgülden böl, sonra sol tarafın noktalarını at.
  const virgulde = ham.indexOf(',')
  let sol = virgulde === -1 ? ham : ham.slice(0, virgulde)
  let sag = virgulde === -1 ? '' : ham.slice(virgulde + 1)

  // Virgül hiç yoksa ve TEK bir nokta varsa, kullanıcı ondalık yazıyor
  // olabilir (klavyedeki nokta tuşu). Sondan üçüncü hane değilse ondalık say.
  if(virgulde === -1){
    const noktalar = (sol.match(/\./g) ?? []).length
    if(noktalar === 1){
      const i = sol.indexOf('.')
      const kuyruk = sol.slice(i + 1).replace(/\D/g, '')
      if(kuyruk.length !== 3){
        sag = kuyruk
        sol = sol.slice(0, i)
      }
    }
  }

  const tam = sol.replace(/\D/g, '')
  const ondalik = sag.replace(/\D/g, '').slice(0, basamak)

  if(tam === '' && ondalik === '') return ham.includes(',') ? '0,' : ''

  const govde = binlikle(tam === '' ? '0' : tam)
  // Virgül yazılmışsa KORUNUYOR: yoksa ondalık yazmaya başlanamaz.
  if(virgulde === -1 && sag === '') return govde
  return `${govde},${ondalik}`
}

/**
 * Ekrandaki metni deftere gidecek sayıya çevirir.
 *
 * ⚠️ Boş metin 0 DEĞİL, `undefined` döner. Sıfır bir fiyattır ("bedava");
 * boşluk "yazılmadı" demektir. 0047'deki fiyat defteri kuralının aynısı.
 */
export const sayiOku = (metin: string): number | undefined => {
  const temiz = metin.trim()
  if(temiz === '') return undefined
  const n = Number(temiz.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

/** Sayıyı ekranda göstermek için biçimler: 12450.75 → "12.450,75" */
export const sayiBicimle = (n: number, basamak = 2): string =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: basamak })
