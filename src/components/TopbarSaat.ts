// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · ÜST PANEL SAATİ
//
// Emrah (03.10.2026): *"ekranda şık duracak bir yerde saat tarih yazsa fena
// olmaz… dijital olsun ve çok göze batmasın, küçük bir köşede dursun."*
//
// Süs değil: endüstriyel mutfakta her belgenin bir SAATİ var — kesim saati,
// teslim aralığı, HACCP ölçümü, vardiya. "Kesimi kaçırdım mı" sorusu günde
// onlarca kez soruluyor ve cevabı şu an ekranın hiçbir yerinde yazmıyor.
//
// ⚠️ SANİYE AKIYOR ama saniye GÖSTERİLMİYOR (küçük yazıda okunmuyor, ve
// akan rakam gözü sürekli oraya çekiyor). Yine de sayaç saniyede bir
// çalışıyor: dakika başı tam dakikada dönsün, 59 saniye geç kalmasın.
//
// ⚠️ TARAYICININ SAATİ. Bu saat bir KAYIT değil, bir göstergedir; deftere
// yazılan zamanlar sunucudan gelir (`now()`). İkisi karışırsa, bilgisayarının
// saati yanlış kurulmuş bir kullanıcının kayıtları da yanlış sanılır.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'

const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const AYLAR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

const iki = (n: number) => String(n).padStart(2, '0')

/** "14:05" — saniye yok, çünkü küçük yazıda okunmuyor ve gözü çekiyor. */
export const saatiYaz = (d: Date): string => `${iki(d.getHours())}:${iki(d.getMinutes())}`

/** "3 Ekim Cuma" — yıl yok; bugünün yılını kimse merak etmiyor. */
export const tarihiYaz = (d: Date): string =>
  `${d.getDate()} ${AYLAR[d.getMonth()]} ${GUNLER[d.getDay()]}`

/** Tam başlık (üstüne gelince): "3 Ekim 2026 Cuma · 14:05" */
export const saatBasligi = (d: Date): string =>
  `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()} ${GUNLER[d.getDay()]} · ${saatiYaz(d)}`

export const TopbarSaat = () => {
  const [simdi, setSimdi] = React.useState<Date>(() => new Date())

  React.useEffect(() => {
    // Saniyede bir: gösterilen dakika TAM dakikada dönsün. Dakikada bir
    // çalışan bir sayaç, sayfa 10:00:59'da açıldıysa 10:01'i 59 saniye geç
    // gösterirdi.
    const sayac = window.setInterval(() => setSimdi(new Date()), 1000)
    return () => window.clearInterval(sayac)
  }, [])

  return React.createElement(
    'div',
    {
      className: 'topbar-saat',
      title: saatBasligi(simdi),
      // Ekran okuyucu her saniye okumasın: bu bir gösterge, bir uyarı değil.
      'aria-hidden': true,
    },
    React.createElement('strong', null, saatiYaz(simdi)),
    React.createElement('span', null, tarihiYaz(simdi)),
  )
}

export default TopbarSaat
