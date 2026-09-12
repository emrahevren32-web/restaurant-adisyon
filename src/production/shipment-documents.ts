// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 / İzlenebilirlik — Yazdırılabilir belgeler
//
// Yol haritası maddeleri:
//   "İrsaliye / sevk belgesi çıktısı"        → Yazdırılabilir, PDF alınabilir
//   "Tek tuşla geri çağırma listesi + PDF"   → Rastgele lot numarasıyla 2 sn'de sonuç
//
// İkisi de saf metin üreten işlevlerdir: tarayıcı gerekmez, testten geçerler.
// Yazdırma işini `core/print` yapar.
//
// ── İRSALİYEDE PARTİ NEDEN VAR ───────────────────────────────────────────
// Sevkiyat BELGESİNDE (veritabanında) parti yazmaz — FEFO bir çıkışı böldüğü
// için orada tek bir doğru cevap yoktur. Ama İRSALİYE çıktısı defterden
// üretiliyor: hangi partiden ne kadar gittiği hareketlerde yazılı olduğu için
// kâğıda basılabiliyor. Müşterinin elindeki kâğıtta parti numarasının olması,
// geri çağırmayı tek taraflı olmaktan çıkarır.
// ═══════════════════════════════════════════════════════════════════════════

import { kacir } from '../core/print/print'
import type { Movement } from '../core/stock/stock.repository'
import type { GeriCagirmaRaporu } from './recall'
import { SEVKIYAT_DURUM_ETIKETLERI, type Sevkiyat } from './shipment.repository'

const sayiBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 })
const bicimle = (d: number) => sayiBicimi.format(d)

const gunBicimle = (d?: string): string => {
  if(!d) return '—'
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleDateString('tr-TR')
}

const zamanBicimle = (d?: string): string => {
  if(!d) return '—'
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleString('tr-TR')
}

/** Ekranın elindeki adları belgeye taşıyan küçük sözlük. */
export type BelgeSozlugu = {
  kalemAdi: (stokKalemiId: string) => string
  temelBirim: (stokKalemiId: string) => string
  lotKodu: (lotId?: string) => string
  /** Başlıkta görünecek işletme adı; yoksa boş bırakılır. */
  firmaAdi?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// İrsaliye
// ═══════════════════════════════════════════════════════════════════════════

export const irsaliyeHtml = (
  sevkiyat: Sevkiyat,
  hareketler: readonly Movement[],
  sozluk: BelgeSozlugu,
): string => {
  const cikislar = hareketler.filter(h => h.reason === 'SHIPMENT_OUT')

  // Defterde çıkış varsa BELGE SATIRLARI DEĞİL, defter satırları basılır:
  // partiyi ancak defter bilir. Henüz sevk edilmemişse belge satırları
  // basılır ve kâğıdın üstünde "sevk edilmedi" yazar.
  const satirlar = cikislar.length > 0
    ? cikislar.map(h => ({
        ad: sozluk.kalemAdi(h.stockItemId),
        miktar: `${bicimle(Math.abs(h.quantityEntered))} ${kacir(h.uomEntered)}`,
        parti: sozluk.lotKodu(h.lotId),
      }))
    : sevkiyat.satirlar.map(s => ({
        ad: s.stokKalemiAd ?? sozluk.kalemAdi(s.stokKalemiId),
        miktar: `${bicimle(s.miktar)} ${kacir(s.birim)}`,
        parti: '—',
      }))

  return `
  <div class="ust">
    <div>
      <h1>Sevk İrsaliyesi</h1>
      <div class="kucuk">${kacir(sozluk.firmaAdi ?? '')}</div>
    </div>
    <div class="kucuk">
      <div><strong>${kacir(sevkiyat.sevkiyatNo)}</strong></div>
      <div>${kacir(gunBicimle(sevkiyat.sevkTarihi ?? sevkiyat.sevkZamani))}</div>
      <div>${kacir(SEVKIYAT_DURUM_ETIKETLERI[sevkiyat.durum])}</div>
    </div>
  </div>

  ${sevkiyat.durum !== 'SHIPPED' ? `<p class="uyari">
    Bu belge henüz sevk edilmemiş bir sevkiyata aittir; mal stoktan
    düşmemiştir. Resmî irsaliye yerine geçmez.
  </p>` : ''}

  <h2>Müşteri</h2>
  <dl>
    <dt>Ad</dt><dd><strong>${kacir(sevkiyat.musteriAd)}</strong></dd>
    ${sevkiyat.musteriTelefon ? `<dt>Telefon</dt><dd>${kacir(sevkiyat.musteriTelefon)}</dd>` : ''}
    ${sevkiyat.adres ? `<dt>Adres</dt><dd>${kacir(sevkiyat.adres)}</dd>` : ''}
    ${sevkiyat.not ? `<dt>Not</dt><dd>${kacir(sevkiyat.not)}</dd>` : ''}
  </dl>

  <h2>Gönderilen</h2>
  <table>
    <thead><tr><th>Kalem</th><th class="num">Miktar</th><th>Parti</th></tr></thead>
    <tbody>
      ${satirlar.map(s => `<tr>
        <td>${kacir(s.ad)}</td>
        <td class="num">${s.miktar}</td>
        <td>${kacir(s.parti)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  ${cikislar.length > sevkiyat.satirlar.length ? `<p class="dipnot">
    Bir kalem birden çok satırda görünüyor: elde tek bir partide yetecek mal
    yoktu, çıkış en yakın son kullanma tarihli partiden başlayarak bölündü.
    İki parti de kayıtlıdır.
  </p>` : ''}

  <div class="imza">
    <div>Teslim eden — ad, soyad, imza</div>
    <div>Teslim alan — ad, soyad, imza</div>
  </div>

  <p class="dipnot">
    Parti numaraları stok hareket defterinden alınmıştır. Bir sorun çıkarsa bu
    numaralarla, malın hangi tedarikçi partisinden geldiği ve aynı partiden
    kime daha mal gittiği kayıtlardan çıkarılabilir.
  </p>`
}

// ═══════════════════════════════════════════════════════════════════════════
// Geri çağırma listesi
// ═══════════════════════════════════════════════════════════════════════════

export const geriCagirmaHtml = (
  rapor: GeriCagirmaRaporu,
  firmaAdi?: string,
): string => `
  <div class="ust">
    <div>
      <h1>Geri Çağırma Listesi</h1>
      <div class="kucuk">${kacir(firmaAdi ?? '')}</div>
    </div>
    <div class="kucuk">
      <div><strong>${kacir(rapor.kaynakLot.lotKodu)}</strong></div>
      <div>${kacir(rapor.kaynakLot.stokKalemiAd)}</div>
      <div>${kacir(zamanBicimle(rapor.olusturmaZamani))}</div>
    </div>
  </div>

  ${rapor.eksik ? `<p class="uyari">
    DİKKAT — BU LİSTE EKSİK OLABİLİR.<br>
    ${rapor.eksikSebepleri.map(s => kacir(s)).join('<br>')}
  </p>` : ''}

  <h2>Kaynak parti</h2>
  <dl>
    <dt>Parti</dt><dd><strong>${kacir(rapor.kaynakLot.lotKodu)}</strong></dd>
    <dt>Ürün</dt><dd>${kacir(rapor.kaynakLot.stokKalemiAd)}</dd>
    ${rapor.kaynakLot.tedarikci ? `<dt>Tedarikçi</dt><dd>${kacir(rapor.kaynakLot.tedarikci)}</dd>` : ''}
    <dt>Son kullanma</dt><dd>${kacir(gunBicimle(rapor.kaynakLot.sonKullanma))}</dd>
    <dt>Aranacak müşteri</dt><dd><strong>${rapor.musteriSayisi}</strong></dd>
  </dl>

  ${rapor.tureyenLotlar.length > 0 ? `
  <h2>Etkilenen mamul partileri (${rapor.tureyenLotlar.length})</h2>
  <table>
    <thead><tr><th>Parti</th><th>Ürün</th><th>Son kullanma</th></tr></thead>
    <tbody>
      ${rapor.tureyenLotlar.map(l => `<tr>
        <td><strong>${kacir(l.lotKodu)}</strong></td>
        <td>${kacir(l.stokKalemiAd)}</td>
        <td>${kacir(gunBicimle(l.sonKullanma))}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  <h2>Aranacak müşteriler (${rapor.satirlar.length} sevkiyat satırı)</h2>
  ${rapor.satirlar.length === 0 ? `<p>
    Bu partiden hiçbir müşteriye mal gitmemiş. Mal hâlâ işletmede; dışarıda
    aranacak kimse yok.
  </p>` : `<table>
    <thead>
      <tr>
        <th>Müşteri</th><th>Telefon</th><th>Sevkiyat</th>
        <th>Tarih</th><th>Giden parti</th><th class="num">Miktar</th>
      </tr>
    </thead>
    <tbody>
      ${rapor.satirlar.map(s => `<tr>
        <td><strong>${kacir(s.musteriAd)}</strong>${s.adres ? `<br><span class="kucuk">${kacir(s.adres)}</span>` : ''}</td>
        <td>${kacir(s.musteriTelefon ?? '—')}</td>
        <td>${kacir(s.sevkiyatNo)}</td>
        <td>${kacir(gunBicimle(s.sevkTarihi))}</td>
        <td>${kacir(s.gidenLotKodu)}<br><span class="kucuk">${kacir(s.gidenUrun)}</span>
          ${s.yol.length > 1 ? `<br><span class="kucuk">${kacir(s.yol.join(' → '))}</span>` : ''}</td>
        <td class="num">${bicimle(s.miktar)}</td>
      </tr>`).join('')}
    </tbody>
  </table>`}

  <p class="dipnot">
    Bu liste stok hareket defterinden türetilmiştir; ayrı bir soyağacı kaydı
    tutulmuyor. Sevkiyat kâğıdında parti numarası yazmaz — çıkış hareketinde
    yazar. Bu yüzden bir çıkış iki partiye bölündüğünde de doğru müşteri
    bulunur.
  </p>`
