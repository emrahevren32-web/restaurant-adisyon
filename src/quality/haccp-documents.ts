// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3.5 / HACCP — yazdırılabilir kayıt formu
//
// ── BU KÂĞIT NEDEN ÖNEMLİ ────────────────────────────────────────────────
// HACCP denetiminde istenen şey ekran değil KAYITTIR. Denetçi "gösterin"
// der; bugüne kadarki cevap dolu bir klasördü. Buradaki form aynı klasörün
// yerine geçiyor ama iki farkla:
//   • limit, ölçüm anındaki hâliyle basılıyor (sonradan gevşetilse bile)
//   • uygunsuz ölçümün altında NE YAPILDIĞI yazıyor — boşsa boş göründüğü
//     için saklanamıyor
// ═══════════════════════════════════════════════════════════════════════════

import { kacir } from '../core/print/print'
import {
  ASAMA_ETIKETLERI, FAALIYET_ETIKETLERI, TEHLIKE_ETIKETLERI,
  type Ccp, type DuzelticiFaaliyet, type Olcum,
} from './haccp.repository'

const sayiBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })
const bicimle = (d: number) => sayiBicimi.format(d)

const zamanBicimle = (d?: string): string => {
  if(!d) return '—'
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleString('tr-TR')
}

/** Kritik kontrol noktası planı — denetçinin ilk istediği belge. */
export const ccpPlaniHtml = (ccpler: readonly Ccp[], firmaAdi?: string): string => `
  <div class="ust">
    <div>
      <h1>HACCP · Kritik Kontrol Noktaları</h1>
      <div class="kucuk">${kacir(firmaAdi ?? '')}</div>
    </div>
    <div class="kucuk">
      <div>${kacir(ccpler.length)} kontrol noktası</div>
      <div>${kacir(zamanBicimle(new Date().toISOString()))}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Kod</th><th>Kontrol noktası</th><th>Aşama</th><th>Kritik limit</th>
        <th>Yöntem / sıklık</th><th>Limit aşılırsa</th>
      </tr>
    </thead>
    <tbody>
      ${ccpler.map(c => `<tr>
        <td><strong>${kacir(c.kod)}</strong></td>
        <td>${kacir(c.ad)}${c.tehlikeTipi
          ? `<br><span class="kucuk">${kacir(TEHLIKE_ETIKETLERI[c.tehlikeTipi])}${
              c.tehlikeNotu ? ` · ${kacir(c.tehlikeNotu)}` : ''}</span>` : ''}</td>
        <td>${kacir(ASAMA_ETIKETLERI[c.asama])}</td>
        <td><strong>${kacir(c.limitMetni ?? '')}</strong></td>
        <td class="kucuk">${kacir(c.olcumYontemi ?? '—')}${
          c.olcumSikligi ? `<br>${kacir(c.olcumSikligi)}` : ''}${
          c.sorumluRol ? `<br>${kacir(c.sorumluRol)}` : ''}</td>
        <td class="kucuk">${kacir(c.duzelticiTalimat ?? '—')}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="imza">
    <div>Hazırlayan — ad, soyad, imza</div>
    <div>Onaylayan — ad, soyad, imza</div>
  </div>`

/** Ölçüm kayıt formu — belirli bir dönemin izleme kayıtları. */
export const olcumKayitFormuHtml = (
  olcumler: readonly Olcum[],
  faaliyetler: readonly DuzelticiFaaliyet[],
  firmaAdi?: string,
  baslik = 'HACCP · İzleme Kayıtları',
): string => {
  const faaliyetHaritasi = new Map(faaliyetler.map(f => [f.olcumId, f]))
  const gecerli = olcumler.filter(o => !o.iptalZamani)
  const uygunsuz = gecerli.filter(o => o.sonuc === 'FAIL')

  return `
  <div class="ust">
    <div>
      <h1>${kacir(baslik)}</h1>
      <div class="kucuk">${kacir(firmaAdi ?? '')}</div>
    </div>
    <div class="kucuk">
      <div>${gecerli.length} ölçüm · ${uygunsuz.length} uygunsuz</div>
      <div>${kacir(zamanBicimle(new Date().toISOString()))}</div>
    </div>
  </div>

  ${uygunsuz.length > 0 ? `<p class="uyari">
    Bu dönemde ${uygunsuz.length} ölçüm kritik limiti aşmıştır.
    Her birinin altında yapılan işlem yazılıdır; boş olanlar HENÜZ KAPANMAMIŞ
    faaliyetlerdir.
  </p>` : ''}

  <table>
    <thead>
      <tr>
        <th>Tarih / saat</th><th>Kontrol noktası</th><th class="num">Ölçülen</th>
        <th>Kritik limit</th><th>Sonuç</th><th>Yapılan işlem</th>
      </tr>
    </thead>
    <tbody>
      ${olcumler.length === 0
        ? '<tr><td colspan="6">Bu dönemde ölçüm kaydı yok.</td></tr>'
        : olcumler.map(o => {
            const f = faaliyetHaritasi.get(o.id)
            return `<tr>
              <td class="kucuk">${kacir(zamanBicimle(o.olcumZamani))}</td>
              <td>${kacir(o.ccpKod ?? '')}${o.ccpAd ? `<br><span class="kucuk">${kacir(o.ccpAd)}</span>` : ''}</td>
              <td class="num"><strong>${bicimle(o.deger)}</strong> ${kacir(o.birim)}</td>
              <td class="kucuk">${kacir(o.limitOzeti)}</td>
              <td><strong>${o.iptalZamani ? 'İPTAL' : o.sonuc === 'PASS' ? 'Uygun' : 'UYGUN DEĞİL'}</strong>${
                o.iptalZamani ? `<br><span class="kucuk">${kacir(o.iptalGerekcesi ?? '')}</span>` : ''}</td>
              <td class="kucuk">${o.sonuc === 'FAIL' && !o.iptalZamani
                ? (f?.yapilanIs
                    ? kacir(f.yapilanIs)
                    : `<strong>${kacir(f ? FAALIYET_ETIKETLERI[f.durum] : 'kayıt yok')}</strong>`)
                : '—'}${o.not ? `<br>${kacir(o.not)}` : ''}</td>
            </tr>`
          }).join('')}
    </tbody>
  </table>

  <p class="dipnot">
    Kritik limit her satırda ÖLÇÜM ANINDAKİ hâliyle yazılıdır: limit sonradan
    değiştirilse bile geçmiş kayıtlar o günün kuralına göre değerlendirilmiş
    olarak kalır. Ölçüm kayıtları silinemez; yanlış kayıt gerekçesiyle iptal
    edilir ve iptal satırı bu listede görünür.
  </p>

  <div class="imza">
    <div>Ölçümü yapan — ad, soyad, imza</div>
    <div>Doğrulayan — ad, soyad, imza</div>
  </div>`
}
