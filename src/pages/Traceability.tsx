// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 / İzlenebilirlik — Lot soyağacı ekranı
//
// Yol haritası maddeleri:
//   "Lot soyağacı bağlanıyor"   → "Bu mamulün içinde hangi lotlar var" cevaplanabiliyor
//   "İleri izleme"              → "Bu lot nereye gitti" cevaplanabiliyor
//   "Tek tuşla geri çağırma listesi + PDF" → Rastgele lot numarasıyla 2 sn'de sonuç
//   "Ürün geçmişi ekranı"       → Bir mamulün tüm yaşam döngüsü tek sayfada
//   "HACCP · ölçüm zincire bağlı" → Uygunsuz ölçüm PARTİDE görünüyor
//
// Ekran iki yöne birden bakar. GERİ izleme içeri iner: mamulden hammaddeye,
// tedarikçi partisine. İLERİ izleme dışarı çıkar: hammaddeden mamule, mamulden
// müşteriye. Geri çağırmada sorulan soru ikincisidir — "bu partiden kime mal
// gitti, kimi arayacağız".
//
// ── DEMONUN EN ÖNEMLİ EKRANI ─────────────────────────────────────────────
// Kağıtla çalışan bir işletmede bu sorunun cevabı yoktur. "Şu partiden yaptığımız
// çorbanın içinde hangi mercimek vardı?" sorusu, klasörleri karıştırarak ve
// aşçıya sorarak, saatler içinde, kısmen cevaplanır. Burada tek bir lot
// numarası yazılıyor ve zincir tedarikçi partisine kadar iniyor.
//
// Ekranın giriş noktası LOT NUMARASI — çünkü geri çağırmada elde olan tek şey
// odur: ambalajın üstündeki numara.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { resolveStockRepositoryMode } from '../core/stock/index'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import { PostgresSoyagaciKaynagi } from '../production/genealogy.repository'
import {
  etkilenenSevkiyatIdleri,
  ileriIzle,
  kopukluklar,
  lotYasamDongusu,
  soyagaciCikar,
  soyagaciniDuzlestir,
  tedarikciPartileri,
  type IleriIzlemeSonucu,
  type SoyagaciDugumu,
  type YasamDongusuOlayi,
  type SoyagaciLotu,
  type SoyagaciSatiri,
} from '../production/genealogy'
import {
  PostgresSevkiyatDeposu, type Sevkiyat,
} from '../production/shipment.repository'
import { geriCagirmaRaporu } from '../production/recall'
import { geriCagirmaHtml } from '../production/shipment-documents'
import { belgeYazdir } from '../core/print/print'
import { PostgresHaccpDeposu, type Olcum } from '../quality/haccp.repository'
import { HaccpServisi } from '../quality/haccp.service'

type Props = { currentUser: User }

const sayiBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 })
const bicimle = (d: number) => sayiBicimi.format(d)
const hataMetni = (h: unknown) => (h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.')

const tarihBicimle = (d?: string) => {
  if(!d) return '—'
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleDateString('tr-TR')
}

const KAYNAK_ETIKETLERI: Record<SoyagaciLotu['kaynakTipi'], string> = {
  RECEIPT: 'Satın alındı',
  PRODUCTION: 'Üretildi',
  OPENING: 'Açılış',
}

/** Defterdeki sebep kodlarının insan dili karşılığı. */
const OLAY_ETIKETLERI: Record<string, string> = {
  RECEIPT: 'Mal kabul — parti doğdu',
  OPENING: 'Açılış bakiyesi',
  PRODUCTION_OUTPUT: 'Üretimden çıktı — parti doğdu',
  PRODUCTION_CONSUME: 'Üretime girdi',
  PRODUCTION_WASTE: 'Üretim firesi',
  SHIPMENT_OUT: 'Müşteriye sevk edildi',
  PURCHASE_RETURN: 'Tedarikçiye iade',
  ADJUSTMENT: 'Düzeltme',
  REVERSAL: 'Ters kayıt (iptal)',
}

const KESILME_ACIKLAMALARI: Record<NonNullable<SoyagaciDugumu['kesildi']>, string> = {
  derinlik: 'Zincir çok derin; bu noktadan aşağısı gösterilmedi.',
  dongu: 'Bu parti zincirde ikinci kez geçiyor — veri hatası olabilir.',
  bilinmiyor: 'Bu partiyi üreten iş emri defterde bulunamadı; zincir burada kopuyor.',
}

export default function Traceability({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  const okuyabilir = !currentUser.permissions || currentUser.permissions.includes('stock.read')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [arama, setArama] = React.useState('')
  const [sonuclar, setSonuclar] = React.useState<SoyagaciLotu[]>([])
  const [seciliLot, setSeciliLot] = React.useState<SoyagaciLotu | null>(null)
  const [agac, setAgac] = React.useState<SoyagaciDugumu | null>(null)
  const [ileri, setIleri] = React.useState<IleriIzlemeSonucu | null>(null)
  const [sevkiyatlar, setSevkiyatlar] = React.useState<Sevkiyat[]>([])
  const [gecmis, setGecmis] = React.useState<YasamDongusuOlayi[]>([])
  const [olcumler, setOlcumler] = React.useState<Olcum[]>([])
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [araniyor, setAraniyor] = React.useState(false)
  const [cikariliyor, setCikariliyor] = React.useState(false)
  const [hata, setHata] = React.useState('')

  const hazir = mod === 'postgres' && isSupabaseConfigured()

  React.useEffect(() => {
    let iptal = false
    if(!hazir){ setYukleniyor(false); return }
    ;(async () => {
      try{
        const kurulan = await depoBaglamiKur(getSupabase())
        if(!iptal) setBaglam(kurulan)
      } catch (e) { if(!iptal) setHata(hataMetni(e)) }
      finally { if(!iptal) setYukleniyor(false) }
    })()
    return () => { iptal = true }
  }, [hazir])

  const ara = async (metin: string) => {
    // Yeni arama, ESKİ ZİNCİRİ SİLER. Silmezsek ekranda "TVL aradım ama
    // altta hâlâ LHN'nin zinciri duruyor" hâli oluşur; kullanıcı yanlış
    // partinin içeriğine bakar ve bunu fark etmez. Geri çağırmada bu,
    // yanlış listeyi doğru sanmak demektir.
    setSeciliLot(null)
    setAgac(null)
    setIleri(null)
    setSevkiyatlar([])
    setGecmis([])
    setOlcumler([])

    if(!baglam || metin.trim() === ''){ setSonuclar([]); return }
    setAraniyor(true)
    try{
      setSonuclar(await new PostgresSoyagaciKaynagi(getSupabase()).lotAra(baglam.ctx, metin))
      setHata('')
    } catch (e) { setHata(hataMetni(e)) }
    finally { setAraniyor(false) }
  }

  const cikar = async (lot: SoyagaciLotu) => {
    if(!baglam) return
    setSeciliLot(lot)
    setAgac(null)
    setIleri(null)
    setSevkiyatlar([])
    setGecmis([])
    setOlcumler([])
    setCikariliyor(true)
    try{
      // Her çıkarım için YENİ bir kaynak: içindeki önbellek yalnızca bu
      // sorgunun ömrü kadar yaşasın, bayat veri göstermeyelim.
      const kaynak = new PostgresSoyagaciKaynagi(getSupabase())

      // İki yön AYNI ANDA çıkarılıyor: kullanıcı tek tıkla hem "içinde ne var"
      // hem "nereye gitti" cevabını alsın. Geri çağırmada ikisi de gerekir.
      const [geri, gidis, dongu, kaliteOlcumleri] = await Promise.all([
        soyagaciCikar(baglam.ctx, kaynak, lot.lotId),
        ileriIzle(baglam.ctx, kaynak, lot.lotId),
        lotYasamDongusu(baglam.ctx, kaynak, lot.lotId),
        // HACCP ölçümleri de partiye bağlı okunuyor: "bu partide soğuk zincir
        // kırılmış mı" sorusu geri çağırmada sıcaklıktan önce sorulur.
        new HaccpServisi(new PostgresHaccpDeposu(getSupabase()))
          .lotunOlcumleri(baglam.ctx, lot.lotId),
      ])
      setAgac(geri)
      setIleri(gidis)
      setGecmis(dongu)
      setOlcumler(kaliteOlcumleri)

      // Sevkiyat belgeleri ayrı okunuyor: defter yalnızca kimliği bilir,
      // müşteri adı ve telefon belgede durur — aranacak numara odur.
      const idler = etkilenenSevkiyatIdleri(gidis)
      setSevkiyatlar(
        idler.length === 0
          ? []
          : await new PostgresSevkiyatDeposu(getSupabase()).kimliklerden(baglam.ctx, idler),
      )
      setHata('')
    } catch (e) { setHata(hataMetni(e)) }
    finally { setCikariliyor(false) }
  }

  if(!hazir){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>İzlenebilirlik</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>Zincir stok defterinden türetilir; defter veritabanında durur.</p>
        </section>
      </div>
    )
  }

  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>İzlenebilirlik</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }

  if(!baglam || !okuyabilir){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>İzlenebilirlik</h2></div></div>
        <section className="card empty-state">
          {hata || (okuyabilir ? 'Çalışma alanı çözülemedi.' : 'Bu ekran için stok okuma izni gerekiyor.')}
        </section>
      </div>
    )
  }

  const subeAdi = baglam.subeler.find(sb => sb.id === baglam.ctx.branchId)?.ad
  const satirlar = agac ? soyagaciniDuzlestir(agac) : []
  const partiler = agac ? tedarikciPartileri(agac) : []
  const kesikler = agac ? kopukluklar(agac) : []

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>İzlenebilirlik</h2>
          <p className="muted">Aşama 3 · Bir lot numarası, tedarikçi partisine kadar zincir</p>
        </div>
      </div>

      {hata && <div className="form-error">{hata}</div>}

      <section className="card">
        <form
          className="supplier-toolbar"
          onSubmit={e => { e.preventDefault(); void ara(arama) }}
        >
          <input
            type="search"
            value={arama}
            placeholder="Lot numarası — ambalajın üstündeki numara"
            aria-label="Lot ara"
            onChange={e => setArama(e.target.value)}
          />
          <button className="btn primary" type="submit" disabled={araniyor}>
            {araniyor ? 'Aranıyor…' : 'Ara'}
          </button>
        </form>

        {sonuclar.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Lot</th><th>Kalem</th><th>Kaynak</th><th>SKT</th></tr>
              </thead>
              <tbody>
                {sonuclar.map(lot => (
                  <tr
                    key={lot.lotId}
                    className={lot.lotId === seciliLot?.lotId ? 'is-selected' : ''}
                    onClick={() => { void cikar(lot) }}
                  >
                    <td><strong>{lot.lotKodu}</strong></td>
                    <td>{lot.stokKalemiAd}</td>
                    <td className="muted">
                      {KAYNAK_ETIKETLERI[lot.kaynakTipi]}
                      {lot.tedarikci && ` · ${lot.tedarikci}`}
                    </td>
                    <td className="muted">{tarihBicimle(lot.sonKullanma)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {arama.trim() !== '' && sonuclar.length === 0 && !araniyor && (
          <p className="muted">Bu numarayla eşleşen bir parti yok.</p>
        )}

        {arama.trim() === '' && (
          <p className="muted detail-hint">
            Geri çağırmada elinizde genellikle tek bir şey olur: ambalajın
            üstündeki lot numarası. Onu yazın; sistem o partinin içine girer.
          </p>
        )}
      </section>

      {cikariliyor && <section className="card empty-state">Zincir çıkarılıyor…</section>}

      {!cikariliyor && agac && (
        <>
          {gecmis.length > 0 && (
            <section className="card">
              <div className="section-header compact">
                <h3>{agac.lot.lotKodu} · yaşam döngüsü</h3>
                <span className="muted">
                  kalan {bicimle(gecmis[gecmis.length - 1].kalan)}
                </span>
              </div>
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Tarih</th><th>Olay</th>
                      <th className="num">Miktar</th><th className="num">Kalan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gecmis.map(olay => (
                      <tr key={olay.hareket.id}>
                        <td className="muted">{tarihBicimle(olay.hareket.tarih)}</td>
                        <td>{OLAY_ETIKETLERI[olay.hareket.neden] ?? olay.hareket.neden}</td>
                        <td className={`num ${olay.hareket.miktar < 0 ? 'is-negative' : 'is-positive'}`}>
                          {olay.hareket.miktar > 0 ? '+' : ''}{bicimle(olay.hareket.miktar)}
                        </td>
                        <td className="num">{bicimle(olay.kalan)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted detail-hint">
                “Kalan” sütunu <strong>saklanmıyor</strong>, satırlar toplanarak
                bulunuyor. Son satır, bu partiden depoda ne kaldığını söyler —
                sıfırsa parti tükenmiştir ama geçmişi burada durur.
              </p>
            </section>
          )}

          {/* ── HACCP · bu partinin ölçümleri ─────────────────────────── */}
          {olcumler.length > 0 && (
            <section className="card">
              <div className="section-header compact">
                <h3>{agac.lot.lotKodu} · HACCP ölçümleri</h3>
                {olcumler.some(o => o.sonuc === 'FAIL' && !o.iptalZamani)
                  ? <span className="status-pill warning-pill">
                      {olcumler.filter(o => o.sonuc === 'FAIL' && !o.iptalZamani).length} uygunsuz
                    </span>
                  : <span className="muted">hepsi uygun</span>}
              </div>
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Tarih</th><th>Kontrol noktası</th>
                      <th className="num">Ölçülen</th><th>Kritik limit</th><th>Sonuç</th>
                    </tr>
                  </thead>
                  <tbody>
                    {olcumler.map(o => (
                      <tr key={o.id}>
                        <td className="muted">{tarihBicimle(o.olcumZamani)}</td>
                        <td>
                          <strong>{o.ccpKod ?? '—'}</strong>
                          {o.ccpAd && <div className="muted">{o.ccpAd}</div>}
                        </td>
                        <td className="num">{bicimle(o.deger)} {o.birim}</td>
                        <td className="muted">{o.limitOzeti}</td>
                        <td>
                          {o.iptalZamani
                            ? <span className="status-pill muted-pill">İptal</span>
                            : o.sonuc === 'PASS'
                              ? <span className="status-pill success-pill">Uygun</span>
                              : <span className="status-pill warning-pill">Uygun değil</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted detail-hint">
                {olcumler.some(o => o.sonuc === 'FAIL' && !o.iptalZamani)
                  ? <>
                      <strong>Bu partide kritik limit aşılmış.</strong> Aşağıdaki
                      “nereye gitti” listesi, bu partinin gittiği müşterileri
                      gösteriyor — geri çağırma kararı bu iki tabloya birlikte
                      bakılarak verilir.
                    </>
                  : <>
                      Sıcaklık ölçümleri partiye bağlı tutuluyor. Uygunsuz bir
                      ölçüm olsaydı burada görünür ve aşağıdaki müşteri listesiyle
                      birlikte okunurdu.
                    </>}
              </p>
            </section>
          )}

          <section className="card">
            <div className="section-header compact">
              <h3>{agac.lot.lotKodu} · içinde ne var</h3>
              <span className="muted">{satirlar.length - 1} parti</span>
            </div>

            {satirlar.length === 1 && (
              <p className="muted detail-hint">
                {agac.lot.kaynakTipi === 'RECEIPT'
                  ? <>Bu bir <strong>satın alma partisi</strong>{agac.lot.tedarikci ? ` (${agac.lot.tedarikci})` : ''}.
                    Zincirin ucu burasıdır: dışarıdan geldi, içinde başka parti yok.</>
                  : <>Bu partinin içine giren başka parti bulunamadı.</>}
              </p>
            )}

            {satirlar.length > 1 && (
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Parti</th><th>Kalem</th>
                      <th className="num">Kullanılan</th><th>Kaynak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {satirlar.map(satir => (
                      <SoyagaciSatirGorunumu key={`${satir.yol.join('>')}`} satir={satir} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="muted detail-hint">
              Bu zincir hiçbir yerde <strong>saklanmıyor</strong>; her sorguda stok
              defterinden türetiliyor. Ayrı bir soyağacı kaydı tutsaydık, defterle
              senkron kalmadığı gün liste eksik çıkar ve bunu kimse fark etmezdi.
            </p>
          </section>

          {partiler.length > 0 && (
            <section className="card">
              <div className="section-header compact">
                <h3>Tedarikçi partileri</h3>
                <span className="muted">zincirin ucu</span>
              </div>
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr><th>Parti</th><th>Kalem</th><th>Tedarikçi</th><th>SKT</th></tr>
                  </thead>
                  <tbody>
                    {partiler.map(p => (
                      <tr key={p.lot.lotId}>
                        <td><strong>{p.lot.lotKodu}</strong></td>
                        <td>{p.lot.stokKalemiAd}</td>
                        <td className={p.lot.tedarikci ? '' : 'muted'}>
                          {p.lot.tedarikci ?? 'belirtilmemiş'}
                        </td>
                        <td className="muted">{tarihBicimle(p.lot.sonKullanma)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted detail-hint">
                Bir tedarikçi partisi bozuk çıkarsa aranacak liste budur.
                “Hangi tedarikçiden gelen malla yapıldı” sorusunun cevabı.
              </p>
            </section>
          )}

          {/* ── İLERİ İZLEME: "bu parti nereye gitti" ─────────────────── */}
          {ileri && (
            <section className="card">
              <div className="section-header compact">
                <h3>{agac.lot.lotKodu} · nereye gitti</h3>
                {/* ⚠️ Rozet ve düğme AYNI kutuda duruyor. Düğmeyi başlığın
                    altına ayrı bir satır olarak koyduğumuzda tablonun üst
                    kenarına biniyordu: `.card:has(.data-table) > .section-header`
                    iki hücreli bir ızgara ve kart eylemleri o ızgaranın SAĞ
                    hücresine ait. Kuralın adresi burası. */}
                <div>
                  <span className={sevkiyatlar.length > 0 ? 'status-pill warning-pill' : 'muted'}>
                    {sevkiyatlar.length > 0
                      ? `${sevkiyatlar.length} sevkiyat`
                      : 'sevkiyat yok'}
                  </span>
                  {/* TEK TUŞ. Aranacak liste ekranda ne ise kâğıtta da odur —
                      ikisi aynı `geriCagirmaRaporu` çağrısından çıkıyor; iki
                      ayrı hesap olsaydı biri düzelirken diğeri unutulurdu. */}
                  {ileri.sevkiyatlar.length > 0 && (
                    <button
                      className="btn primary" type="button"
                      onClick={() => {
                        const rapor = geriCagirmaRaporu(agac.lot, ileri, sevkiyatlar)
                        belgeYazdir(
                          `Geri çağırma · ${agac.lot.lotKodu}`,
                          geriCagirmaHtml(rapor, subeAdi),
                        )
                      }}
                    >
                      Geri Çağırma Listesi · Yazdır / PDF
                    </button>
                  )}
                </div>
              </div>

              {ileri.sevkiyatlar.length === 0 && ileri.tureyenLotlar.length === 0 && (
                <p className="muted detail-hint">
                  Bu parti <strong>hâlâ elinizde</strong>: ne üretime girmiş ne de
                  müşteriye gitmiş. Bir sorun çıkarsa dışarıda aranacak kimse yok —
                  mal depoda bloke edilir.
                </p>
              )}

              {ileri.tureyenLotlar.length > 0 && (
                <>
                  <div className="table-wrap">
                    <table className="data-table compact">
                      <thead>
                        <tr><th>Türeyen parti</th><th>Ürün</th><th>SKT</th></tr>
                      </thead>
                      <tbody>
                        {ileri.tureyenLotlar.map(lot => (
                          <tr key={lot.lotId}>
                            <td><strong>{lot.lotKodu}</strong></td>
                            <td>{lot.stokKalemiAd}</td>
                            <td className="muted">{tarihBicimle(lot.sonKullanma)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted detail-hint">
                    Bu parti üretime girmiş ve yukarıdaki partilere dönüşmüş.
                    Geri çağırma bu partileri de kapsar: içinde bu maldan var.
                  </p>
                </>
              )}

              {sevkiyatlar.length > 0 && (
                <>
                  <div className="table-wrap">
                    <table className="data-table compact">
                      <thead>
                        <tr>
                          <th>Sevkiyat</th><th>Müşteri</th><th>Telefon</th>
                          <th>Giden parti</th><th className="num">Miktar</th><th>Tarih</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ileri.sevkiyatlar.map((iz, i) => {
                          const belge = sevkiyatlar.find(sv => sv.id === iz.sevkiyatId)
                          return (
                            <tr key={`${iz.sevkiyatId}-${iz.lot.lotId}-${i}`}>
                              <td><strong>{belge?.sevkiyatNo ?? '—'}</strong></td>
                              <td>{belge?.musteriAd ?? 'belge bulunamadı'}</td>
                              <td className={belge?.musteriTelefon ? '' : 'muted'}>
                                {belge?.musteriTelefon ?? '—'}
                              </td>
                              <td className="muted">
                                {iz.lot.lotKodu}
                                {iz.derinlik > 0 && (
                                  <div className="muted">{iz.yol.join(' → ')}</div>
                                )}
                              </td>
                              <td className="num">{bicimle(iz.miktar)}</td>
                              <td className="muted">
                                {belge?.sevkTarihi ?? tarihBicimle(belge?.sevkZamani)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted detail-hint">
                    <strong>Geri çağırma listesi budur.</strong> Bu parti bozuk çıkarsa
                    aranacak müşteriler bunlar. Liste belgeden değil{' '}
                    <strong>defterden</strong> çıkıyor: sevkiyat kâğıdında parti
                    yazmaz, çıkış hareketinde yazar — o yüzden FEFO bir çıkışı iki
                    partiye böldüğünde de doğru müşteri bulunur.
                  </p>
                </>
              )}

              {ileri.sevkiyatlar.length > 0 && sevkiyatlar.length === 0 && (
                <p className="muted detail-hint is-critical">
                  Defterde sevkiyat çıkışı var ama belgeleri okunamadı. Liste
                  <strong> eksik</strong>; olduğu gibi güvenmeyin.
                </p>
              )}

              {ileri.derinlikAsildi && (
                <p className="muted detail-hint is-critical">
                  <strong>Zincir derinlik sınırına dayandı.</strong> Bu partiden
                  türeyen üretimlerin bir kısmı taranmadı; liste eksik olabilir.
                </p>
              )}
            </section>
          )}

          {kesikler.length > 0 && (
            <section className="card">
              <div className="section-header compact">
                <h3>Zincirde kopukluk</h3>
                <span className="status-pill warning-pill">{kesikler.length}</span>
              </div>
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead><tr><th>Parti</th><th>Sebep</th></tr></thead>
                  <tbody>
                    {kesikler.map(k => (
                      <tr key={k.yol.join('>')}>
                        <td>{k.lot.lotKodu}</td>
                        <td className="muted">{KESILME_ACIKLAMALARI[k.kesildi!]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted detail-hint">
                Kopukluk <strong>gizlenmiyor</strong>. Eksik bir zinciri tam
                göstermek, geri çağırmada en tehlikeli şeydir: liste dolu görünür
                ama içinde olması gereken bir parti yoktur.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  )
}

/** Girintili tek satır. Girinti derinliği zincirdeki kademeyi anlatıyor. */
function SoyagaciSatirGorunumu({ satir }: { satir: SoyagaciSatiri }){
  const kok = satir.derinlik === 0
  return (
    <tr>
      <td>
        <span style={{ paddingLeft: `${satir.derinlik * 18}px` }}>
          {!kok && <span className="muted">└ </span>}
          <strong>{satir.lot.lotKodu}</strong>
        </span>
        {satir.isEmriNo && <div className="muted" style={{ paddingLeft: `${satir.derinlik * 18 + 14}px` }}>
          {satir.isEmriNo}
        </div>}
      </td>
      <td>{satir.lot.stokKalemiAd}</td>
      <td className="num">
        {kok ? <span className="muted">—</span> : bicimle(satir.kullanilanMiktar)}
      </td>
      <td className="muted">
        {KAYNAK_ETIKETLERI[satir.lot.kaynakTipi]}
        {satir.lot.tedarikci && ` · ${satir.lot.tedarikci}`}
        {satir.kesildi && <span className="is-critical"> · zincir kesildi</span>}
      </td>
    </tr>
  )
}
