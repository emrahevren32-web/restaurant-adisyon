// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4B — ÜRÜN ETİKETİ
//
// Yol haritası maddeleri:
//   · "Ürün etiketi çıktısı"   → Etikette ürün, lot, üretim ve son kullanma
//                                 tarihi, gramaj var
//   · "Etikette alerjen basılıyor" → Yasal alerjen listesi ambalajda görünüyor
//
// ── BU DOSYA NİÇİN DİĞERLERİNDEN DAHA DİKKATLİ YAZILDI ────────────────────
// Yanlış alerjen beyanı insan hayatına mal olur ve yasal sorumluluğu
// doğrudandır. Bu yüzden buradaki tek kural şu:
//
//      EKSİK VERİYLE "TEMİZ" GÖRÜNEN BİR ETİKET BASILMAZ.
//
// Alerjeni incelenmemiş bir malzeme varsa ya da besin değeri türetilemiyorsa
// etiket basılır AMA üstünde TASLAK bandı ve eksiğin listesi olur. Sessizce
// boş bir alerjen satırı basmak, "bu üründe alerjen yok" demektir — ve bu,
// bilinmeyeni bilinen gibi göstermektir.
//
// ⚠️ Alerjenler içindekiler listesinde BÜYÜK HARFLE vurgulanıyor: mevzuat
// alerjenin diğer bileşenlerden ayırt edilebilir olmasını istiyor.
// ═══════════════════════════════════════════════════════════════════════════

import { kacir } from '../core/print/print'

export type EtiketAlerjeni = {
  kod: string
  ad: string
  /** 'İÇERİR' bileşendir; 'İZ' çapraz bulaşma ihtimalidir. Hukuken farklı. */
  tur: 'İÇERİR' | 'İZ'
}

export type EtiketBesinDegeri = {
  enerjiKj?: number
  enerjiKcal?: number
  yag?: number
  doymusYag?: number
  karbonhidrat?: number
  seker?: number
  protein?: number
  tuz?: number
}

export type EtiketBileseni = {
  ad: string
  /** Alerjen taşıyan bileşen BÜYÜK HARFLE vurgulanır. */
  alerjenMi: boolean
}

export type EtiketVerisi = {
  urunAdi: string
  /** Ambalaj içeriği, örn. "5 kg". Boşsa etiket TASLAK olur. */
  netMiktar?: string
  lotKodu?: string
  uretimTarihi?: string
  sonKullanma?: string
  saklama?: string
  firmaAdi: string
  firmaAdresi?: string
  /** Azalan miktar sırasında. Boş olabilir; o zaman içindekiler basılmaz. */
  bilesenler: EtiketBileseni[]
  alerjenler: EtiketAlerjeni[]
  besin?: EtiketBesinDegeri
  /** Alerjeni hiç incelenmemiş malzemeler. Doluysa etiket TASLAK. */
  alerjeniIncelenmemis: string[]
  /** Besin değeri türetilemeyen malzemeler. Doluysa etiket TASLAK. */
  besinEksikleri: string[]
}

/**
 * Etiket kesilebilir mi, kesilemez mi — ve kesilemiyorsa NEDEN.
 *
 * Tek bir boolean döndürmek yetmez: kullanıcı "neden taslak" diye sorduğunda
 * cevabı ekranda görmeli, yoksa kuralı atlamanın yolunu arar.
 */
export const etiketEksikleri = (v: EtiketVerisi): string[] => {
  const eksik: string[] = []
  if(v.alerjeniIncelenmemis.length > 0){
    eksik.push(
      `Alerjeni incelenmemiş malzeme: ${v.alerjeniIncelenmemis.join(', ')}. `
      + 'Alerjen satırı olmaması "alerjen yok" demek değildir.',
    )
  }
  if(v.besinEksikleri.length > 0){
    eksik.push(`Besin değeri türetilemiyor: ${v.besinEksikleri.join(', ')}.`)
  }
  if(!v.besin) eksik.push('Besin değeri tablosu hesaplanamadı.')
  if(!v.netMiktar) eksik.push('Net miktar (gramaj) girilmemiş.')
  if(!v.lotKodu) eksik.push('Parti numarası yok.')
  if(!v.sonKullanma) eksik.push('Son kullanma tarihi yok.')
  return eksik
}

export const etiketKesilebilir = (v: EtiketVerisi): boolean =>
  etiketEksikleri(v).length === 0

const tarih = (d?: string) =>
  (d ? new Date(`${d}T00:00:00`).toLocaleDateString('tr-TR') : '—')

const sayi = (n?: number, basamak = 1) =>
  (n === undefined ? '—' : n.toLocaleString('tr-TR', {
    minimumFractionDigits: basamak, maximumFractionDigits: basamak,
  }))

/** Besin bildirimi tablosu. Eksikse HİÇ basılmıyor — yarım tablo yanıltır. */
const besinTablosu = (b?: EtiketBesinDegeri): string => {
  if(!b) return ''
  const satir = (ad: string, deger: string, girintili = false) =>
    `<tr><td${girintili ? ' class="girintili"' : ''}>${kacir(ad)}</td>`
    + `<td class="num">${deger}</td></tr>`
  return `
  <h2>Beslenme bildirimi<span class="kucuk"> — 100 g için</span></h2>
  <table class="besin">
    <tbody>
      ${satir('Enerji', `${sayi(b.enerjiKj, 0)} kJ / ${sayi(b.enerjiKcal, 0)} kcal`)}
      ${satir('Yağ', `${sayi(b.yag, 1)} g`)}
      ${satir('— doymuş yağ', `${sayi(b.doymusYag, 1)} g`, true)}
      ${satir('Karbonhidrat', `${sayi(b.karbonhidrat, 1)} g`)}
      ${satir('— şeker', `${sayi(b.seker, 1)} g`, true)}
      ${satir('Protein', `${sayi(b.protein, 1)} g`)}
      ${satir('Tuz', `${sayi(b.tuz, 2)} g`)}
    </tbody>
  </table>`
}

export const etiketHtml = (v: EtiketVerisi): string => {
  const eksikler = etiketEksikleri(v)
  const icerir = v.alerjenler.filter(a => a.tur === 'İÇERİR')
  const iz = v.alerjenler.filter(a => a.tur === 'İZ')

  return `
  ${eksikler.length > 0 ? `
  <div class="taslak">
    <strong>TASLAK ETİKET — AMBALAJA YAPIŞTIRILAMAZ</strong>
    <ul>${eksikler.map(e => `<li>${kacir(e)}</li>`).join('')}</ul>
  </div>` : ''}

  <div class="etiket">
    <h1>${kacir(v.urunAdi)}</h1>
    ${v.netMiktar ? `<p class="net">Net: <strong>${kacir(v.netMiktar)}</strong></p>` : ''}

    ${v.bilesenler.length > 0 ? `
    <h2>İçindekiler</h2>
    <p class="icindekiler">${
      // ⚠️ Alerjen taşıyan bileşen BÜYÜK HARFLE: mevzuat ayırt edilebilir
      // olmasını istiyor. Renk ya da yalnız kalın yazı yetmez — siyah beyaz
      // yazıcıda kaybolur.
      v.bilesenler.map(b => b.alerjenMi
        ? `<strong>${kacir(b.ad.toLocaleUpperCase('tr-TR'))}</strong>`
        : kacir(b.ad)).join(', ')
    }</p>` : ''}

    ${icerir.length > 0 ? `
    <p class="alerjen"><strong>Alerjen uyarısı:</strong>
      ${kacir(icerir.map(a => a.ad).join(', '))} içerir.</p>` : ''}
    ${iz.length > 0 ? `
    <p class="alerjen iz">${kacir(iz.map(a => a.ad).join(', '))} içerebilir
      (aynı tesiste işlenmektedir).</p>` : ''}
    ${icerir.length === 0 && iz.length === 0 && eksikler.length === 0 ? `
    <p class="alerjen yok">Bilinen alerjen içermez.</p>` : ''}

    ${besinTablosu(v.besin)}

    <dl class="kunye">
      <dt>Parti</dt><dd>${kacir(v.lotKodu ?? '—')}</dd>
      <dt>Üretim</dt><dd>${tarih(v.uretimTarihi)}</dd>
      <dt>Son kullanma</dt><dd><strong>${tarih(v.sonKullanma)}</strong></dd>
      ${v.saklama ? `<dt>Saklama</dt><dd>${kacir(v.saklama)}</dd>` : ''}
    </dl>

    <p class="uretici">
      <strong>${kacir(v.firmaAdi)}</strong>
      ${v.firmaAdresi ? `<br>${kacir(v.firmaAdresi)}` : ''}
    </p>
  </div>`
}
