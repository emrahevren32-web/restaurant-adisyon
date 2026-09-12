// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 / İzlenebilirlik — Sevkiyat ekranı
//
// Yol haritası maddeleri:
//   "Sevkiyat → stok çıkışı"                  → Sevk edilen lot kaydediliyor
//   "İrsaliye / sevk belgesi çıktısı"         → Yazdırılabilir, PDF alınabilir
//   "Geri izleme: bu sevkiyatın içinde ne var" → Tedarikçi partisine kadar iniliyor
//
// ── EKRANIN İDDİASI ──────────────────────────────────────────────────────
// Belgede lot YAZMIYOR. Yazsaydı, FEFO bir çıkışı iki partiye böldüğünde
// satır hangisini yazacağını bilemezdi. Bunun yerine "Sevk Et" deyince
// hareketler deftere düşüyor ve HANGİ PARTİDEN NE KADAR gittiği aşağıdaki
// "Defterdeki iz" tablosunda görünüyor.
//
// Geri çağırma listesi işte bu satırların üstüne kurulu: "bu lot nereye
// gitti" sorusunun cevabı belgede değil, defterde.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { createStockRepository, resolveStockRepositoryMode } from '../core/stock/index'
import { InMemoryStockItemLookup } from '../core/stock/stock-item-lookup'
import type { Movement } from '../core/stock/stock.repository'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import {
  PostgresStokKatalogu, type Birim, type KatalogKalemi, type KatalogLotu,
} from '../warehouse/warehouse.catalog'
import { DepoServisi, cevrilebilirBirimler, type DepoKalemi } from '../warehouse/warehouse.service'
import {
  PostgresSevkiyatDeposu,
  SEVKIYAT_DURUM_ETIKETLERI,
  SEVKIYAT_GECISLERI,
  type Sevkiyat,
  type SevkiyatDurumu,
  type YeniSevkiyat,
} from '../production/shipment.repository'
import { SevkiyatServisi, sonrakiSevkiyatNo } from '../production/shipment.service'
import type { YeterlilikSatiri } from '../production/recipe.service'
import { PostgresSoyagaciKaynagi } from '../production/genealogy.repository'
import {
  soyagaciCikar, soyagaciniDuzlestir, type SoyagaciSatiri,
} from '../production/genealogy'
import { sevkiyatinLotIdleri } from '../production/recall'
import { irsaliyeHtml } from '../production/shipment-documents'
import { belgeYazdir } from '../core/print/print'

type Props = { currentUser: User }
type Islem = 'yeni' | 'duzenle' | null

const sayiBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 })
const bicimle = (d: number) => sayiBicimi.format(d)
const hataMetni = (h: unknown) => (h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.')

const tarihBicimle = (d?: string) => {
  if(!d) return '—'
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleDateString('tr-TR')
}

const durumSinifi = (durum: SevkiyatDurumu) =>
  durum === 'SHIPPED' ? 'success-pill'
    : durum === 'CANCELLED' ? 'muted-pill' : 'info-pill'

const GECIS_ETIKETLERI: Record<SevkiyatDurumu, string> = {
  DRAFT: 'Taslağa al',
  SHIPPED: 'Sevk Et',
  CANCELLED: 'İptal Et',
}

/** Tarih alanları için üst sınır — beş haneli yıl bir yazım hatasıdır. */
const enGecTarih = (() => {
  const t = new Date()
  return `${t.getFullYear() + 10}-12-31`
})()

export default function Sevkiyatlar({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  const yazabilir = !currentUser.permissions || currentUser.permissions.includes('stock.write')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [sevkiyatlar, setSevkiyatlar] = React.useState<Sevkiyat[]>([])
  const [kalemler, setKalemler] = React.useState<KatalogKalemi[]>([])
  const [birimler, setBirimler] = React.useState<Birim[]>([])
  const [bakiyeler, setBakiyeler] = React.useState<DepoKalemi[]>([])
  const [seciliId, setSeciliId] = React.useState<string | null>(null)
  const [hareketler, setHareketler] = React.useState<Movement[]>([])
  const [lotlar, setLotlar] = React.useState<KatalogLotu[]>([])
  /** Geri izleme: sevk edilen partilerin içine inen zincir, düz liste hâlinde. */
  const [icerik, setIcerik] = React.useState<SoyagaciSatiri[]>([])
  const [islem, setIslem] = React.useState<Islem>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [calisiyor, setCalisiyor] = React.useState(false)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const servis = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    const client = getSupabase()
    return new SevkiyatServisi(
      new PostgresSevkiyatDeposu(client),
      new DepoServisi(
        createStockRepository(new InMemoryStockItemLookup([])),
        new PostgresStokKatalogu(client),
      ),
    )
  }, [mod])

  const depoServisi = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    const client = getSupabase()
    return new DepoServisi(
      createStockRepository(new InMemoryStockItemLookup([])),
      new PostgresStokKatalogu(client),
    )
  }, [mod])

  const yenile = React.useCallback(async (aktif: DepoBaglami) => {
    if(!servis || !depoServisi) return
    const [s, b] = await Promise.all([servis.hepsi(aktif.ctx), depoServisi.kalemler(aktif.ctx)])
    setSevkiyatlar(s)
    setBakiyeler(b)
  }, [servis, depoServisi])

  React.useEffect(() => {
    let iptal = false
    if(!servis || !depoServisi){ setYukleniyor(false); return }

    ;(async () => {
      try{
        const kurulan = await depoBaglamiKur(getSupabase())
        if(iptal) return
        setBaglam(kurulan)

        const katalog = new PostgresStokKatalogu(getSupabase())
        const [s, kl, bl, bk] = await Promise.all([
          servis.hepsi(kurulan.ctx),
          katalog.kalemler(kurulan.ctx),
          katalog.birimler(),
          depoServisi.kalemler(kurulan.ctx),
        ])
        if(iptal) return
        setSevkiyatlar(s)
        setKalemler(kl.filter(k => k.aktif))
        setBirimler(bl)
        setBakiyeler(bk)
      } catch (e) {
        if(!iptal) setHata(hataMetni(e))
      } finally {
        if(!iptal) setYukleniyor(false)
      }
    })()

    return () => { iptal = true }
  }, [servis, depoServisi])

  const secili = sevkiyatlar.find(s => s.id === seciliId) ?? null

  /**
   * Seçilen sevkiyatın DEFTERDEKİ izi — hangi partiden ne kadar gittiği.
   *
   * Belgeden değil defterden okunuyor: kriterin "sevk edilen lot kaydediliyor"
   * cümlesinin ekrandaki karşılığı bu tablodur.
   */
  React.useEffect(() => {
    let iptal = false
    if(!secili || !servis || !baglam){
      setHareketler([]); setLotlar([]); setIcerik([]); return
    }

    ;(async () => {
      try{
        const h = await servis.hareketleri(baglam.ctx, secili)
        if(iptal) return
        setHareketler(h)

        const katalog = new PostgresStokKatalogu(getSupabase())
        const kalemIdleri = [...new Set(secili.satirlar.map(s => s.stokKalemiId))]
        const listeler = await Promise.all(
          kalemIdleri.map(id => katalog.lotlar(baglam.ctx, id)),
        )
        if(iptal) return
        setLotlar(listeler.flat())

        // GERİ İZLEME — "bu sevkiyatın içinde ne var".
        // Giriş noktası belge değil DEFTER: hangi partinin gittiği yalnızca
        // orada yazılı. Tek kaynak (önbelleği paylaşsın diye) her parti için
        // ayrı ayrı iniyor.
        const lotIdleri = sevkiyatinLotIdleri(h)
        if(lotIdleri.length === 0){ setIcerik([]); return }

        const kaynak = new PostgresSoyagaciKaynagi(getSupabase())
        const agaclar = await Promise.all(
          lotIdleri.map(id => soyagaciCikar(baglam.ctx, kaynak, id)),
        )
        if(!iptal){
          setIcerik(agaclar.flatMap(a => (a ? soyagaciniDuzlestir(a) : [])))
        }
      } catch (e) { if(!iptal) setHata(hataMetni(e)) }
    })()

    return () => { iptal = true }
  }, [secili, servis, baglam])

  const bakiyeHaritasi = React.useMemo(
    () => new Map(bakiyeler.map(b => [b.id, b.miktar])),
    [bakiyeler],
  )

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Sevkiyat</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>Sevk edilen mal stok defterine çıkış olarak yazılır.</p>
        </section>
      </div>
    )
  }

  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Sevkiyat</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }

  if(!baglam){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Sevkiyat</h2></div></div>
        <section className="card empty-state">{hata || 'Çalışma alanı çözülemedi.'}</section>
      </div>
    )
  }

  const sonrasi = async (mesaj: string) => {
    setBilgi(mesaj); setHata(''); setIslem(null)
    await yenile(baglam)
  }

  const olustur = async (girdi: YeniSevkiyat) => {
    try{
      const yeni = await servis!.ekle(baglam.ctx, girdi)
      setSeciliId(yeni.id)
      await sonrasi(`${yeni.sevkiyatNo} hazırlandı. “Sevk Et” deyince mal deftere düşecek.`)
    } catch (e) { setHata(hataMetni(e)) }
  }

  const kaydet = async (sevkiyat: Sevkiyat, girdi: YeniSevkiyat) => {
    try{
      const guncel = await servis!.guncelle(baglam.ctx, sevkiyat, girdi)
      await sonrasi(`${guncel.sevkiyatNo} güncellendi.`)
    } catch (e) { setHata(hataMetni(e)) }
  }

  const sevkEt = async (sevkiyat: Sevkiyat) => {
    setCalisiyor(true)
    try{
      const guncel = await servis!.sevkEt(baglam.ctx, sevkiyat, bakiyeHaritasi, kalemler)
      await sonrasi(
        `${guncel.sevkiyatNo} sevk edildi. Mal stok defterine ÇIKIŞ olarak yazıldı; `
        + 'hangi partiden gittiği aşağıdaki “Defterdeki iz” tablosunda.',
      )
    } catch (e) { setHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  const iptalEt = async (sevkiyat: Sevkiyat) => {
    const sevkEdilmis = sevkiyat.durum === 'SHIPPED'
    if(!window.confirm(
      `${sevkiyat.sevkiyatNo} iptal edilecek.\n\n`
      + (sevkEdilmis
        ? 'Deftere yazılmış çıkışlar SİLİNMEZ; her birinin tersi yazılır ve mal '
          + 'depoya geri döner.\n\nBunu yalnızca mal GERÇEKTEN geri geldiyse yapın: '
          + 'ters kayıt "bu mal hiç çıkmadı" demektir ve sevkiyat geri çağırma '
          + 'listesinden düşer.'
        : 'Bu sevkiyat henüz deftere yazılmadı; yalnızca belge kapanacak.'),
    )) return

    setCalisiyor(true)
    try{
      const guncel = await servis!.iptalEt(baglam.ctx, sevkiyat)
      await sonrasi(
        sevkEdilmis
          ? `${guncel.sevkiyatNo} iptal edildi. Çıkışlar ters kayıtla geri alındı.`
          : `${guncel.sevkiyatNo} iptal edildi.`,
      )
    } catch (e) { setHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  const durumIslemi = (sevkiyat: Sevkiyat, durum: SevkiyatDurumu) => {
    if(durum === 'SHIPPED') return void sevkEt(sevkiyat)
    if(durum === 'CANCELLED') return void iptalEt(sevkiyat)
  }

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Sevkiyat</h2>
          <p className="muted">Aşama 3 · Müşteriye giden mal, defterde partisiyle birlikte</p>
        </div>
        {yazabilir && (
          <button
            className="btn primary"
            onClick={() => { setIslem('yeni'); setHata(''); setBilgi('') }}
          >
            Yeni Sevkiyat
          </button>
        )}
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-info">{bilgi}</div>}

      <div className="warehouse-layout">
        <section className="card warehouse-main">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sevkiyat</th><th>Müşteri</th>
                  <th className="num">Kalem</th><th>Durum</th><th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {sevkiyatlar.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Henüz sevkiyat yok. Bir sevkiyat, malın kime gittiğini
                      yazan belgedir: “Sevk Et” deyince depodan düşer ve hangi
                      partiden gittiği defterde kalır.
                    </td>
                  </tr>
                )}
                {sevkiyatlar.map(sevkiyat => (
                  <tr
                    key={sevkiyat.id}
                    className={sevkiyat.id === seciliId ? 'is-selected' : ''}
                    onClick={() => { setSeciliId(sevkiyat.id); setIslem(null) }}
                  >
                    <td>{sevkiyat.sevkiyatNo}</td>
                    <td>{sevkiyat.musteriAd}</td>
                    <td className="num">{sevkiyat.satirlar.length}</td>
                    <td>
                      <span className={`status-pill ${durumSinifi(sevkiyat.durum)}`}>
                        {SEVKIYAT_DURUM_ETIKETLERI[sevkiyat.durum]}
                      </span>
                    </td>
                    <td className="muted">{sevkiyat.sevkTarihi ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="warehouse-side">
          {islem === 'yeni' && (
            <section className="card">
              <div className="section-header compact"><h3>Yeni Sevkiyat</h3></div>
              <SevkiyatFormu
                kalemler={kalemler}
                birimler={birimler}
                onerilenNo={sonrakiSevkiyatNo(sevkiyatlar.map(s => s.sevkiyatNo))}
                onIptal={() => setIslem(null)}
                onKaydet={olustur}
              />
            </section>
          )}

          {islem === 'duzenle' && secili && (
            <section className="card">
              <div className="section-header compact">
                <h3>{secili.sevkiyatNo} · Düzenle</h3>
              </div>
              <SevkiyatFormu
                mevcut={secili}
                kalemler={kalemler}
                birimler={birimler}
                onerilenNo={secili.sevkiyatNo}
                onIptal={() => setIslem(null)}
                onKaydet={girdi => kaydet(secili, girdi)}
              />
            </section>
          )}

          {!islem && secili && (
            <SevkiyatDetayi
              sevkiyat={secili}
              yeterlilik={servis!.yeterlilik(secili, bakiyeHaritasi, kalemler)}
              hareketler={hareketler}
              lotlar={lotlar}
              kalemler={kalemler}
              icerik={icerik}
              firmaAdi={baglam.subeler.find(sb => sb.id === baglam.ctx.branchId)?.ad}
              yazabilir={yazabilir}
              calisiyor={calisiyor}
              onDuzenle={() => { setIslem('duzenle'); setHata(''); setBilgi('') }}
              onDurum={durum => durumIslemi(secili, durum)}
            />
          )}

          {!islem && !secili && (
            <section className="card empty-state">
              Bir sevkiyat seçin: gönderilecek kalemleri, depodaki bakiyeyi ve
              sevk edildiyse <strong>hangi partiden gittiğini</strong> burada
              göreceksiniz.
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Detay
// ═══════════════════════════════════════════════════════════════════════════

function SevkiyatDetayi({
  sevkiyat, yeterlilik, hareketler, lotlar, kalemler, icerik, firmaAdi,
  yazabilir, calisiyor, onDuzenle, onDurum,
}: {
  sevkiyat: Sevkiyat
  yeterlilik: YeterlilikSatiri[]
  hareketler: Movement[]
  lotlar: KatalogLotu[]
  kalemler: KatalogKalemi[]
  icerik: SoyagaciSatiri[]
  firmaAdi?: string
  yazabilir: boolean
  calisiyor: boolean
  onDuzenle: () => void
  onDurum: (durum: SevkiyatDurumu) => void
}){
  const gecisler = SEVKIYAT_GECISLERI[sevkiyat.durum]
  const taslak = sevkiyat.durum === 'DRAFT'
  const eksikler = yeterlilik.filter(y => !y.yeterli)

  const lotKodu = (lotId?: string) =>
    lotId ? (lotlar.find(l => l.id === lotId)?.kod ?? '—') : '—'
  const kalemAdi = (id: string) => kalemler.find(k => k.id === id)?.ad ?? id
  const temelBirim = (id: string) => kalemler.find(k => k.id === id)?.temelBirim ?? ''

  /** Deftere yazılmış çıkışlar; ters kayıtlar ayrı gösterilir. */
  const cikislar = hareketler.filter(h => h.reason === 'SHIPMENT_OUT')

  /** Zincirin ucu: dışarıdan gelen partiler. Geri çağırmada aranacak liste. */
  const tedarikciSatirlari = icerik.filter(iz => iz.lot.kaynakTipi === 'RECEIPT')

  return (
    <>
      <section className="card">
        <div className="section-header compact">
          <h3>{sevkiyat.sevkiyatNo}</h3>
          <span className={`status-pill ${durumSinifi(sevkiyat.durum)}`}>
            {SEVKIYAT_DURUM_ETIKETLERI[sevkiyat.durum]}
          </span>
        </div>

        <dl className="detail-grid">
          <dt>Müşteri</dt><dd><strong>{sevkiyat.musteriAd}</strong></dd>
          {sevkiyat.musteriTelefon && (
            <><dt>Telefon</dt><dd>{sevkiyat.musteriTelefon}</dd></>
          )}
          {sevkiyat.adres && (<><dt>Adres</dt><dd>{sevkiyat.adres}</dd></>)}
          <dt>Sevk tarihi</dt><dd>{sevkiyat.sevkTarihi ?? '—'}</dd>
          {sevkiyat.sevkZamani && (
            <><dt>Sevk edildi</dt><dd>{tarihBicimle(sevkiyat.sevkZamani)}</dd></>
          )}
          {sevkiyat.not && (<><dt>Not</dt><dd>{sevkiyat.not}</dd></>)}
        </dl>

        {/* ── PLAN ─────────────────────────────────────────────────────── */}
        <div className="section-header compact"><h3>Gönderilecek</h3></div>
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Kalem</th><th className="num">Miktar</th>
                {taslak && <><th className="num">Depoda</th><th className="num">Eksik</th></>}
              </tr>
            </thead>
            <tbody>
              {yeterlilik.map(y => (
                <tr key={y.satir.id}>
                  <td>{y.satir.stokKalemiAd ?? kalemAdi(y.satir.stokKalemiId)}</td>
                  <td className="num">{bicimle(y.brutMiktar)} {y.birim}</td>
                  {taslak && (
                    <>
                      <td className={`num ${y.cevrilemedi ? 'muted' : ''}`}>
                        {y.cevrilemedi ? '?' : `${bicimle(y.eldeki)} ${y.birim}`}
                      </td>
                      <td className={`num ${y.yeterli ? 'muted' : 'is-critical'}`}>
                        {y.cevrilemedi ? '—' : y.yeterli ? '—' : `${bicimle(y.eksik)} ${y.birim}`}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {taslak && eksikler.length > 0 && (
          <p className="muted detail-hint">
            <strong>Bu sevkiyat gönderilemez.</strong> Depoda yeterli mal yok.
            Belgeyi hazırlamak serbesttir; deftere yazmak eldeki mala bağlıdır.
          </p>
        )}
        {taslak && eksikler.length === 0 && (
          <p className="muted detail-hint">
            “Sevk Et” deyince bu miktarlar stok defterine <strong>çıkış</strong> olarak
            yazılacak. Partiyi sistem seçer: en yakın son kullanma tarihlisinden
            başlar (FEFO). Belgede parti yazmaz — defterde yazar.
          </p>
        )}

        <div className="form-actions">
          {/* İrsaliye HER durumda alınabilir; sevk edilmemişse kâğıdın başına
              "bu belge resmî irsaliye yerine geçmez" uyarısı basılıyor. */}
          <button
            className="btn" type="button"
            onClick={() => belgeYazdir(
              `İrsaliye · ${sevkiyat.sevkiyatNo}`,
              irsaliyeHtml(sevkiyat, hareketler, {
                kalemAdi, temelBirim, lotKodu, firmaAdi,
              }),
            )}
          >
            İrsaliye Yazdır / PDF
          </button>
          {yazabilir && taslak && (
            <button className="btn" type="button" disabled={calisiyor} onClick={onDuzenle}>
              Düzenle
            </button>
          )}
          {yazabilir && gecisler.map(durum => (
            <button
              key={durum}
              className={durum === 'CANCELLED' ? 'btn' : 'btn primary'}
              type="button"
              disabled={calisiyor || (durum === 'SHIPPED' && eksikler.length > 0)}
              title={durum === 'SHIPPED' && eksikler.length > 0
                ? `Eksik: ${eksikler.map(e => `${e.satir.stokKalemiAd ?? 'kalem'} ${bicimle(e.eksik)} ${e.birim}`).join(', ')}`
                : undefined}
              onClick={() => onDurum(durum)}
            >
              {calisiyor ? 'İşleniyor…' : GECIS_ETIKETLERI[durum]}
            </button>
          ))}
        </div>
      </section>

      {/* ── GERÇEK: DEFTER ─────────────────────────────────────────────── */}
      {hareketler.length > 0 && (
        <section className="card">
          <div className="section-header compact">
            <h3>Defterdeki iz</h3>
            <span className="muted">{hareketler.length} hareket</span>
          </div>
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr><th>Kalem</th><th className="num">Miktar</th><th>Parti</th></tr>
              </thead>
              <tbody>
                {hareketler.map(h => (
                  <tr key={h.id}>
                    <td>
                      {kalemAdi(h.stockItemId)}
                      {h.reason === 'REVERSAL' && (
                        <span className="muted"> · ters kayıt (iptal)</span>
                      )}
                    </td>
                    <td className={`num ${h.quantityBase < 0 ? 'is-negative' : 'is-positive'}`}>
                      {h.quantityBase > 0 ? '+' : ''}{bicimle(h.quantityBase)}
                      {' '}<span className="muted">{temelBirim(h.stockItemId)}</span>
                    </td>
                    <td className="muted">{lotKodu(h.lotId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted detail-hint">
            {cikislar.length > sevkiyat.satirlar.length
              ? <>
                  Bir kalem <strong>birden çok satır</strong> yazmış: elde tek bir
                  partide yetecek kadar mal yoktu, FEFO çıkışı böldü. Belgede tek
                  satır, defterde iki parti — ve geri çağırma listesi ikisini de
                  görür.
                </>
              : <>
                  <strong>Parti sütunu, sevk edilen lotun kaydıdır.</strong> Bu parti
                  bozuk çıkarsa “kime gitti” sorusu buradan cevaplanır.
                </>}
          </p>
        </section>
      )}

      {/* ── GERİ İZLEME: "bu sevkiyatın içinde ne var" ─────────────────── */}
      {icerik.length > 0 && (
        <section className="card">
          <div className="section-header compact">
            <h3>Bu sevkiyatın içinde ne var</h3>
            <span className="muted">
              {tedarikciSatirlari.length} tedarikçi partisi
            </span>
          </div>
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr><th>Parti</th><th>Kalem</th><th>Kaynak</th></tr>
              </thead>
              <tbody>
                {icerik.map(iz => (
                  <tr key={iz.yol.join('>')}>
                    <td>
                      <span style={{ paddingLeft: `${iz.derinlik * 18}px` }}>
                        {iz.derinlik > 0 && <span className="muted">└ </span>}
                        <strong>{iz.lot.lotKodu}</strong>
                      </span>
                    </td>
                    <td>{iz.lot.stokKalemiAd}</td>
                    <td className="muted">
                      {iz.lot.kaynakTipi === 'RECEIPT'
                        ? `Satın alındı${iz.lot.tedarikci ? ` · ${iz.lot.tedarikci}` : ''}`
                        : iz.lot.kaynakTipi === 'PRODUCTION' ? 'Üretildi' : 'Açılış'}
                      {iz.kesildi && <span className="is-critical"> · zincir kesildi</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted detail-hint">
            Zincir <strong>tedarikçi partisine kadar</strong> iniyor: müşteriye
            giden mamulün içinde hangi hammadde partisi var, o hammadde hangi
            tedarikçiden gelmiş — hepsi burada. Soru belgeden değil defterden
            cevaplanıyor; sevkiyat kâğıdında parti numarası yazmaz.
          </p>
        </section>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Sevkiyat formu
// ═══════════════════════════════════════════════════════════════════════════

type SatirTaslagi = { stokKalemiId: string; miktar: string; birim: string }

const sayiyaCevir = (d: string): number => {
  const n = Number(String(d).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function SevkiyatFormu({
  mevcut, kalemler, birimler, onerilenNo, onIptal, onKaydet,
}: {
  mevcut?: Sevkiyat
  kalemler: KatalogKalemi[]
  birimler: Birim[]
  onerilenNo: string
  onIptal: () => void
  onKaydet: (girdi: YeniSevkiyat) => Promise<void>
}){
  const [sevkiyatNo, setSevkiyatNo] = React.useState(mevcut?.sevkiyatNo ?? onerilenNo)
  const [musteri, setMusteri] = React.useState(mevcut?.musteriAd ?? '')
  const [telefon, setTelefon] = React.useState(mevcut?.musteriTelefon ?? '')
  const [adres, setAdres] = React.useState(mevcut?.adres ?? '')
  const [tarih, setTarih] = React.useState(
    mevcut?.sevkTarihi ?? new Date().toISOString().slice(0, 10),
  )
  const [not, setNot] = React.useState(mevcut?.not ?? '')
  const [satirlar, setSatirlar] = React.useState<SatirTaslagi[]>(
    mevcut
      ? mevcut.satirlar.map(s => ({
          stokKalemiId: s.stokKalemiId, miktar: String(s.miktar), birim: s.birim,
        }))
      : [],
  )
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  const birimKodlari = React.useMemo(() => birimler.map(b => b.kod), [birimler])

  const guncelle = (sira: number, yama: Partial<SatirTaslagi>) =>
    setSatirlar(o => o.map((s, i) => (i === sira ? { ...s, ...yama } : s)))

  return (
    <form
      className="stacked-form"
      onSubmit={async event => {
        event.preventDefault()
        setGonderiliyor(true)
        try{
          await onKaydet({
            sevkiyatNo,
            musteriAd: musteri,
            musteriTelefon: telefon.trim() || undefined,
            adres: adres.trim() || undefined,
            sevkTarihi: tarih || undefined,
            not: not.trim() || undefined,
            satirlar: satirlar
              .filter(s => s.stokKalemiId !== '' && sayiyaCevir(s.miktar) > 0)
              .map(s => ({
                stokKalemiId: s.stokKalemiId,
                miktar: sayiyaCevir(s.miktar),
                birim: s.birim,
              })),
          })
        } finally { setGonderiliyor(false) }
      }}
    >
      <div className="form-row">
        <label>
          Sevkiyat No *
          <input value={sevkiyatNo} required onChange={e => setSevkiyatNo(e.target.value)} />
        </label>
        <label className="narrow">
          Sevk tarihi
          <input type="date" max={enGecTarih} value={tarih}
            onChange={e => setTarih(e.target.value)} />
        </label>
      </div>

      <label>
        Müşteri *
        <input
          value={musteri} required placeholder="Kime gidiyor?"
          onChange={e => setMusteri(e.target.value)}
        />
        <small className="muted">
          Geri çağırmada aranacak isim budur. Müşterisiz bir sevkiyat,
          “kimi arayacağız” sorusunu cevapsız bırakır.
        </small>
      </label>

      <div className="form-row">
        <label>
          Telefon
          <input value={telefon} onChange={e => setTelefon(e.target.value)} />
        </label>
      </div>

      <label>
        Adres
        <input value={adres} onChange={e => setAdres(e.target.value)} />
      </label>

      {satirlar.length === 0 && (
        <p className="muted">
          Kalem yok. Aşağıdan ekleyin — boş sevkiyat gönderilemez.
        </p>
      )}

      {satirlar.length > 0 && (
        <div className="purchase-lines">
          {satirlar.map((satir, sira) => {
            const kalem = kalemler.find(k => k.id === satir.stokKalemiId)
            return (
              <div className="purchase-line" key={sira}>
                <div className="form-row">
                  <label>
                    Kalem
                    <select
                      value={satir.stokKalemiId}
                      onChange={e => {
                        const yeni = kalemler.find(k => k.id === e.target.value)
                        guncelle(sira, {
                          stokKalemiId: e.target.value,
                          birim: yeni?.temelBirim ?? '',
                        })
                      }}
                    >
                      <option value="">Seçin…</option>
                      {kalemler.map(k => (
                        <option key={k.id} value={k.id}>{k.ad} ({k.kod})</option>
                      ))}
                    </select>
                  </label>
                  <label className="narrow">
                    Miktar
                    <input type="number" min="0" step="any" value={satir.miktar}
                      onChange={e => guncelle(sira, { miktar: e.target.value })} />
                  </label>
                  <label className="narrow">
                    Birim
                    <select value={satir.birim}
                      onChange={e => guncelle(sira, { birim: e.target.value })}>
                      <option value="">—</option>
                      {(kalem ? cevrilebilirBirimler(kalem.temelBirim, birimKodlari) : [])
                        .map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </label>
                  <button className="btn" type="button"
                    onClick={() => setSatirlar(o => o.filter((_, i) => i !== sira))}>
                    Sil
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button
        className="btn" type="button"
        onClick={() => setSatirlar(o => [...o, { stokKalemiId: '', miktar: '', birim: '' }])}
      >
        + Kalem Ekle
      </button>

      <label>
        Not
        <input value={not} onChange={e => setNot(e.target.value)} />
      </label>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>Vazgeç</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}
