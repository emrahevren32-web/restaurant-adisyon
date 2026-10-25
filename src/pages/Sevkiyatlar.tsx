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
import { yazabilirMi } from '../authorization/yazma-yetkisi'
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
  PostgresMusteriDeposu, type Musteri, type TeslimNoktasi,
} from '../customers/customer.repository'
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
import {
  PostgresAracDeposu, type AracDeposu,
} from '../logistics/vehicle.repository'
import {
  aracEtiketi, ehliyetUyarisi, sogutmaUyarisi, type Arac, type Sofor,
} from '../logistics/vehicle.service'
import { irsaliyeHtml, type YuklemeOlcumu } from '../production/shipment-documents'
import {
  PostgresHaccpDeposu, type Olcum as HaccpOlcumu,
} from '../quality/haccp.repository'
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
  // ⚠️ `stock.write` DEĞİL `logistics.write` (14.10, Codex denetimi).
  // Sevkiyat bir lojistik eylemidir. Stok yazma izni olan herkes
  // (örn. operasyon personeli) sevkiyat çıkarabiliyordu; oysa onun
  // açıklaması sevkiyattan hiç söz etmiyor.
  const yazabilir = yazabilirMi(currentUser, 'logistics.write')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [sevkiyatlar, setSevkiyatlar] = React.useState<Sevkiyat[]>([])
  const [kalemler, setKalemler] = React.useState<KatalogKalemi[]>([])
  const [birimler, setBirimler] = React.useState<Birim[]>([])
  // Müşteri kartları ve teslim noktaları (0047). Sevkiyat artık bunlardan
  // seçiliyor; isim elle yazılmıyor.
  const [musteriler, setMusteriler] = React.useState<Musteri[]>([])
  const [noktalar, setNoktalar] = React.useState<TeslimNoktasi[]>([])
  // Araç ve şoför kartları (0064). Pasifler de yükleniyor: geçmiş bir
  // sevkiyat pasif bir araca bağlı olabilir ve düzenlerken kopmamalı.
  const [araclar, setAraclar] = React.useState<Arac[]>([])
  const [soforler, setSoforler] = React.useState<Sofor[]>([])
  const [bakiyeler, setBakiyeler] = React.useState<DepoKalemi[]>([])
  const [seciliId, setSeciliId] = React.useState<string | null>(null)
  const [hareketler, setHareketler] = React.useState<Movement[]>([])
  // ── YÜKLEME ÖLÇÜMLERİ (A4B-3/4) ────────────────────────────────────────
  // Bu sevkiyata bağlanmış HACCP ölçümleri. Kalite ekranından "Sevkiyat"
  // kaynağıyla girilirler; buraya okunup hem ekranda gösteriliyor hem de
  // irsaliyeye basılıyor.
  const [olcumler, setOlcumler] = React.useState<HaccpOlcumu[]>([])
  /** Eldeki ölçümler HANGİ sevkiyata ait. Geç gelen cevabı ayıklamak için. */
  const [olcumSevkiyatId, setOlcumSevkiyatId] = React.useState('')
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

  const aracDeposu = React.useMemo<AracDeposu | null>(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new PostgresAracDeposu(getSupabase())
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
        const musteriDeposu = new PostgresMusteriDeposu(getSupabase())
        const [s, kl, bl, bk, ms] = await Promise.all([
          servis.hepsi(kurulan.ctx),
          katalog.kalemler(kurulan.ctx),
          katalog.birimler(),
          depoServisi.kalemler(kurulan.ctx),
          musteriDeposu.hepsi(kurulan.ctx),
        ])
        if(iptal) return
        setSevkiyatlar(s)
        setKalemler(kl.filter(k => k.aktif))
        setBirimler(bl)
        setBakiyeler(bk)
        // Yalnız AKTİF müşteriler seçilebilir. Pasife alınmış müşteri
        // geçmişte görünür ama yeni sevkiyat açılamaz — pasife almanın
        // anlamı tam olarak budur.
        setMusteriler(ms.filter(m => m.aktif))
        // Bütün noktalar TEK istekte: müşteri seçilince ekran süzüyor.
        // İlk yazımda müşteri başına ayrı istek atıyordum — 200 müşterili bir
        // kiracıda ekran 200 isteğe bölünürdü. RLS kiracı sınırını zaten
        // koruyor, müşteri filtresine gerek yok.
        const ns = await musteriDeposu.noktalar(kurulan.ctx)
        if(iptal) return
        setNoktalar(ns.filter(n => n.aktif))

        if(aracDeposu){
          const [av, sv] = await Promise.all([
            aracDeposu.araclar(kurulan.ctx), aracDeposu.soforler(kurulan.ctx),
          ])
          if(iptal) return
          setAraclar(av); setSoforler(sv)
        }
      } catch (e) {
        if(!iptal) setHata(hataMetni(e))
      } finally {
        if(!iptal) setYukleniyor(false)
      }
    })()

    return () => { iptal = true }
  }, [servis, depoServisi, aracDeposu])

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
      setHareketler([]); setLotlar([]); setIcerik([])
      setOlcumler([]); setOlcumSevkiyatId(''); return
    }

    ;(async () => {
      // ⚠️ ÖNCEKİ SEVKİYATIN ÖLÇÜMLERİ HEMEN SİLİNİYOR (09.10).
      //
      // A sevkiyatından B'ye geçerken `olcumler` A'nınkini tutuyordu ve B
      // yüklenene kadar ekranda — daha kötüsü İRSALİYEDE — A'nın sıcaklığı
      // görünüyordu. Yazdır düğmesi de açıktı: A'nın "uygun" ölçümü B'nin
      // kâğıdına basılabilirdi.
      //
      // Bir belgeye BAŞKA BİR SEVKİYATIN ölçümünü basmak, hiç basmamaktan
      // kat kat kötüdür: kâğıt, olmayan bir soğuk zinciri belgeler.
      setOlcumler([])
      setOlcumSevkiyatId('')

      try{
        const h = await servis.hareketleri(baglam.ctx, secili)
        if(iptal) return
        setHareketler(h)

        // ⚠️ Ölçüm okunamazsa sevkiyat ekranı ÇALIŞMAYA DEVAM ETMELİ:
        // sıcaklık bir ek bilgidir, sevkiyatın kendisi değil. Hata
        // yutulmuyor ama ekranı da kilitlemiyor.
        try{
          const o = await new PostgresHaccpDeposu(getSupabase())
            .kaynaginOlcumleri(baglam.ctx, 'shipment', secili.id)
          // ⚠️ GEÇ GELEN CEVAP YANLIŞ SEVKİYATA YAZILMASIN. Kullanıcı A'yı
          // açıp hemen B'ye geçtiyse A'nın cevabı sonra dönebilir; hangi
          // sevkiyat için istendiğini birlikte yazıyoruz ve ekran bunu
          // seçili sevkiyatla karşılaştırıyor.
          if(!iptal){ setOlcumler(o); setOlcumSevkiyatId(secili.id) }
        } catch { if(!iptal){ setOlcumler([]); setOlcumSevkiyatId('') } }

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

  // ⚠️ 25.10.2026 · MIYOP-074 · `b.miktar` DEĞİL `b.kullanilabilir`.
  // Süresi geçmiş parti sevk edilemiyor (göç 0092); fiziksel bakiyeyi
  // göstermek **Sevk Et** düğmesini boşuna açık bırakıyordu.
  const bakiyeHaritasi = React.useMemo(
    () => new Map(bakiyeler.map(b => [b.id, b.kullanilabilir])),
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
                musteriler={musteriler}
                noktalar={noktalar}
                araclar={araclar}
                soforler={soforler}
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
                musteriler={musteriler}
                noktalar={noktalar}
                araclar={araclar}
                soforler={soforler}
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
              olcumler={olcumSevkiyatId === secili.id ? olcumler : []}
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

      {/* ── ARAÇLAR VE ŞOFÖRLER (0064) ───────────────────────────────────
          Ayrı bir menü maddesi YAPILMADI. Bu kartlar yalnız sevkiyat
          açarken lazım oluyor ve menüye bir madde daha eklemek, üç ayrı
          görünürlük kapısından geçmek demek (tuzak 50). İşin yapıldığı
          yerde dursun. */}
      {aracDeposu && baglam && (
        <FiloBolumu
          araclar={araclar}
          soforler={soforler}
          yazabilir={yazabilir}
          onYenile={async () => {
            const [av, sv] = await Promise.all([
              aracDeposu.araclar(baglam.ctx), aracDeposu.soforler(baglam.ctx),
            ])
            setAraclar(av); setSoforler(sv)
          }}
          depo={aracDeposu}
          ctx={baglam.ctx}
          onHata={setHata}
          onBilgi={setBilgi}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Araçlar ve şoförler
//
// Yol haritası: "Araç ve şoför kartları — plaka, şoför, kapasite ve soğutma
// bilgisi kayıtlı."
//
// ⚠️ KART SİLİNMİYOR, PASİFE ALINIYOR. Silmek, o araçla kesilmiş
// irsaliyelerin geçmişini kopuk bırakırdı; veritabanı da silmeye izin
// vermiyor (0064'te `revoke delete`).
// ═══════════════════════════════════════════════════════════════════════════

function FiloBolumu({
  araclar, soforler, yazabilir, depo, ctx, onYenile, onHata, onBilgi,
}: {
  araclar: Arac[]
  soforler: Sofor[]
  yazabilir: boolean
  depo: AracDeposu
  ctx: DepoBaglami['ctx']
  onYenile: () => Promise<void>
  onHata: (m: string) => void
  onBilgi: (m: string) => void
}){
  const [acik, setAcik] = React.useState(false)
  const [calisiyor, setCalisiyor] = React.useState(false)

  const [plaka, setPlaka] = React.useState('')
  const [aracAd, setAracAd] = React.useState('')
  const [kapasite, setKapasite] = React.useState('')
  const [sogutmali, setSogutmali] = React.useState(false)
  const [minS, setMinS] = React.useState('')
  const [maxS, setMaxS] = React.useState('')

  const [soforAd, setSoforAd] = React.useState('')
  const [soforTel, setSoforTel] = React.useState('')
  const [ehliyet, setEhliyet] = React.useState('')
  const [ehliyetTarih, setEhliyetTarih] = React.useState('')

  const sayiya = (d: string): number | undefined => {
    const m = d.trim().replace(',', '.')
    if(m === '') return undefined
    const n = Number(m)
    return Number.isNaN(n) ? undefined : n
  }

  const aracEkle = async () => {
    setCalisiyor(true); onHata(''); onBilgi('')
    try{
      await depo.aracEkle(ctx, {
        plaka,
        ad: aracAd.trim() || undefined,
        kapasiteKg: sayiya(kapasite),
        sogutmali,
        // ⚠️ Soğutmasızda aralık GÖNDERİLMİYOR: 0064 bunu reddediyor ve
        // doğrulama da reddediyor. Kullanıcı soğutmayı kapatınca alanlar
        // gizleniyor ama değerleri durabilir.
        minSicaklik: sogutmali ? sayiya(minS) : undefined,
        maxSicaklik: sogutmali ? sayiya(maxS) : undefined,
      })
      await onYenile()
      setPlaka(''); setAracAd(''); setKapasite(''); setSogutmali(false)
      setMinS(''); setMaxS('')
      onBilgi('Araç kartı eklendi.')
    } catch (e){ onHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  const soforEkle = async () => {
    setCalisiyor(true); onHata(''); onBilgi('')
    try{
      await depo.soforEkle(ctx, {
        adSoyad: soforAd,
        telefon: soforTel.trim() || undefined,
        ehliyetSinifi: ehliyet.trim() || undefined,
        ehliyetGecerlilik: ehliyetTarih || undefined,
      })
      await onYenile()
      setSoforAd(''); setSoforTel(''); setEhliyet(''); setEhliyetTarih('')
      onBilgi('Şoför kartı eklendi.')
    } catch (e){ onHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  const durumCevir = async (tur: 'arac' | 'sofor', id: string, aktif: boolean) => {
    setCalisiyor(true); onHata(''); onBilgi('')
    try{
      if(tur === 'arac') await depo.aracDurum(ctx, id, aktif)
      else await depo.soforDurum(ctx, id, aktif)
      await onYenile()
    } catch (e){ onHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  return (
    <section className="card">
      <button type="button" className="yetki-dal-basi" onClick={() => setAcik(!acik)}>
        <span className="yetki-dal-isaret" aria-hidden="true">{acik ? '−' : '+'}</span>
        <strong>Araçlar ve Şoförler</strong>
        <span className="muted">
          {araclar.filter(a => a.aktif).length} araç · {soforler.filter(d => d.aktif).length} şoför
        </span>
      </button>

      {acik && (
        <div className="yetki-detay">
          {/* ── ARAÇLAR ──────────────────────────────────────────────── */}
          <div>
            <h4>Araçlar</h4>
            {araclar.length === 0 && <p className="muted">Araç kartı yok.</p>}
            {araclar.length > 0 && (
              <ul className="uye-listesi">
                {araclar.map(a => (
                  <li key={a.id}>
                    <strong>{aracEtiketi(a)}</strong>
                    {a.kapasiteKg !== undefined && (
                      <span className="muted"> · {a.kapasiteKg.toLocaleString('tr-TR')} kg</span>
                    )}
                    {yazabilir && (
                      <button
                        type="button" className="baglanti-dugmesi"
                        disabled={calisiyor}
                        onClick={() => void durumCevir('arac', a.id, !a.aktif)}
                      >
                        {a.aktif ? 'pasife al' : 'aktifleştir'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {yazabilir && (
              <>
                <h4>Araç ekle</h4>
                <div className="form-row">
                  <label>Plaka *
                    <input value={plaka} onChange={e => setPlaka(e.target.value)}
                      placeholder="34 ABC 123" />
                  </label>
                  <label>Ad
                    <input value={aracAd} onChange={e => setAracAd(e.target.value)}
                      placeholder="Frigo 1" />
                  </label>
                </div>
                <div className="form-row">
                  <label>Kapasite (kg)
                    <input inputMode="decimal" value={kapasite}
                      onChange={e => setKapasite(e.target.value)} />
                  </label>
                  <label className="check-row">
                    <input type="checkbox" checked={sogutmali}
                      onChange={e => setSogutmali(e.target.checked)} />
                    <span>Soğutmalı</span>
                  </label>
                </div>
                {sogutmali && (
                  <div className="form-row">
                    <label>En düşük °C
                      <input inputMode="decimal" value={minS}
                        onChange={e => setMinS(e.target.value)} placeholder="-20" />
                    </label>
                    <label>En yüksek °C
                      <input inputMode="decimal" value={maxS}
                        onChange={e => setMaxS(e.target.value)} placeholder="4" />
                    </label>
                  </div>
                )}
                <p className="muted">
                  Soğutma bilgisi <strong>CCP-8</strong>'in ön koşulu: soğutmasız
                  araca soğuk zincir ürünü yüklenmesi, ölçüm yapılmadan bile
                  bilinebilen bir hatadır.
                </p>
                <div className="form-actions">
                  <button className="btn primary" type="button"
                    disabled={calisiyor || plaka.trim() === ''}
                    onClick={() => void aracEkle()}>
                    {calisiyor ? 'Ekleniyor…' : 'Araç ekle'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── ŞOFÖRLER ─────────────────────────────────────────────── */}
          <div>
            <h4>Şoförler</h4>
            {soforler.length === 0 && <p className="muted">Şoför kartı yok.</p>}
            {soforler.length > 0 && (
              <ul className="uye-listesi">
                {soforler.map(d => {
                  const uyari = ehliyetUyarisi(d)
                  return (
                    <li key={d.id}>
                      <strong>{d.adSoyad}</strong>
                      {d.telefon && <span className="muted"> · {d.telefon}</span>}
                      {d.ehliyetSinifi && <span className="muted"> · {d.ehliyetSinifi} sınıfı</span>}
                      {!d.aktif && <span className="muted"> · PASİF</span>}
                      {yazabilir && (
                        <button
                          type="button" className="baglanti-dugmesi"
                          disabled={calisiyor}
                          onClick={() => void durumCevir('sofor', d.id, !d.aktif)}
                        >
                          {d.aktif ? 'pasife al' : 'aktifleştir'}
                        </button>
                      )}
                      {/* Ehliyet uyarısı KARTTA da görünüyor: sevkiyat
                          açılırken değil, önceden bilinmeli. */}
                      {uyari && <div className="is-critical">{uyari}</div>}
                    </li>
                  )
                })}
              </ul>
            )}

            {yazabilir && (
              <>
                <h4>Şoför ekle</h4>
                <div className="form-row">
                  <label>Ad soyad *
                    <input value={soforAd} onChange={e => setSoforAd(e.target.value)} />
                  </label>
                  <label>Telefon
                    <input value={soforTel} onChange={e => setSoforTel(e.target.value)} />
                  </label>
                </div>
                <div className="form-row">
                  <label>Ehliyet sınıfı
                    <input value={ehliyet} onChange={e => setEhliyet(e.target.value)}
                      placeholder="E" />
                  </label>
                  <label>Geçerlilik
                    <input type="date" value={ehliyetTarih}
                      onChange={e => setEhliyetTarih(e.target.value)} />
                  </label>
                </div>
                <p className="muted">
                  Ehliyet tarihi girilirse dolmasına 30 gün kala uyarı çıkar.
                  Denetimde sorulan ilk şeylerden biridir.
                </p>
                <div className="form-actions">
                  <button className="btn primary" type="button"
                    disabled={calisiyor || soforAd.trim() === ''}
                    onClick={() => void soforEkle()}>
                    {calisiyor ? 'Ekleniyor…' : 'Şoför ekle'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Detay
// ═══════════════════════════════════════════════════════════════════════════

function SevkiyatDetayi({
  sevkiyat, yeterlilik, hareketler, olcumler, lotlar, kalemler, icerik, firmaAdi,
  yazabilir, calisiyor, onDuzenle, onDurum,
}: {
  sevkiyat: Sevkiyat
  yeterlilik: YeterlilikSatiri[]
  hareketler: Movement[]
  olcumler: HaccpOlcumu[]
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

  // ── YÜKLEME ÖLÇÜMLERİ (A4B-3/4) ────────────────────────────────────────
  // ⚠️ İPTAL EDİLMİŞ ÖLÇÜM KÂĞIDA BASILMIYOR ama ekranda duruyor: kâğıt
  // yalnız geçerli kaydı taşımalı, ekran ise ne olduğunu göstermeli.
  //
  // ⚠️ LİMİT METNİ KAYITTAN alınıyor, bugünkü CCP'den değil — o ölçüm kendi
  // günkü limitine göre değerlendirilmişti.
  const yuklemeOlcumleri: YuklemeOlcumu[] = olcumler
    .filter(o => !o.iptalZamani)
    .map(o => ({
      ad: [o.ccpKod, o.ccpAd].filter(Boolean).join(' · ') || 'Ölçüm',
      deger: o.deger,
      birim: o.birim,
      sonuc: o.sonuc,
      limitOzeti: o.limitOzeti,
      zaman: new Date(o.olcumZamani).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }),
    }))
  const sapanOlcum = yuklemeOlcumleri.some(o => o.sonuc !== 'PASS')

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
              }, yuklemeOlcumleri),
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
      {/* ── YÜKLEME SICAKLIĞI ───────────────────────────────────────────
          ⚠️ SAPMA SEVKİYATI DURDURMUYOR, UYARIYOR. Durdurmak ayrı bir karar
          (karantina/serbest bırakma) ve o zinciri henüz kurmadık; burada
          "durdurdu" gibi davranan bir ekran, aslında durdurmadığı için
          yalan söylemiş olurdu. */}
      {yuklemeOlcumleri.length > 0 && (
        <section className="card">
          <h4>Yükleme sıcaklığı</h4>
          {sapanOlcum && (
            <div className="form-error">
              <strong>Bu sevkiyatta sınır dışında bir ölçüm var.</strong>{' '}
              Düzeltici faaliyeti Kalite ekranında açık; kapatılmadan
              teslim belgesi tartışmalı kalır.
            </div>
          )}
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr><th>Ölçüm</th><th className="num">Değer</th>
                    <th>Sınır</th><th>Sonuç</th><th>Zaman</th></tr>
              </thead>
              <tbody>
                {yuklemeOlcumleri.map((o, i) => (
                  <tr key={i}>
                    <td>{o.ad}</td>
                    <td className="num">{o.deger} {o.birim}</td>
                    <td className="muted">{o.limitOzeti}</td>
                    <td>
                      {o.sonuc === 'PASS'
                        ? 'Uygun'
                        : <strong className="is-critical">UYGUN DEĞİL</strong>}
                    </td>
                    <td className="muted">{o.zaman}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">
            Bu ölçümler irsaliyeye basılır. Yeni ölçüm Kalite ekranından,
            kaynak olarak <strong>Sevkiyat</strong> seçilerek girilir.
          </p>
        </section>
      )}

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
  mevcut, kalemler, birimler, musteriler, noktalar, araclar, soforler,
  onerilenNo, onIptal, onKaydet,
}: {
  mevcut?: Sevkiyat
  kalemler: KatalogKalemi[]
  birimler: Birim[]
  musteriler: Musteri[]
  noktalar: TeslimNoktasi[]
  araclar: Arac[]
  soforler: Sofor[]
  onerilenNo: string
  onIptal: () => void
  onKaydet: (girdi: YeniSevkiyat) => Promise<void>
}){
  const [sevkiyatNo, setSevkiyatNo] = React.useState(mevcut?.sevkiyatNo ?? onerilenNo)
  const [musteriId, setMusteriId] = React.useState(mevcut?.musteriId ?? '')
  const [noktaId, setNoktaId] = React.useState(mevcut?.noktaId ?? '')
  const [telefon, setTelefon] = React.useState(mevcut?.musteriTelefon ?? '')
  const [adres, setAdres] = React.useState(mevcut?.adres ?? '')
  const [tarih, setTarih] = React.useState(
    mevcut?.sevkTarihi ?? new Date().toISOString().slice(0, 10),
  )
  const [not, setNot] = React.useState(mevcut?.not ?? '')
  const [aracId, setAracId] = React.useState(mevcut?.aracId ?? '')
  const [soforId, setSoforId] = React.useState(mevcut?.soforId ?? '')
  const [satirlar, setSatirlar] = React.useState<SatirTaslagi[]>(
    mevcut
      ? mevcut.satirlar.map(s => ({
          stokKalemiId: s.stokKalemiId, miktar: String(s.miktar), birim: s.birim,
        }))
      : [],
  )
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  const birimKodlari = React.useMemo(() => birimler.map(b => b.kod), [birimler])

  const secilenMusteri = musteriler.find(m => m.id === musteriId)
  const musteriNoktalari = noktalar.filter(n => n.musteriId === musteriId)

  /**
   * 0047 ÖNCESİNDEN kalan sevkiyatlar karta bağlı değil. Onları düzenlerken
   * listede karşılığı yoksa isim bir yere yazılmalı, yoksa kullanıcı neyi
   * düzenlediğini göremez. Uydurma bir kart atfı YAPMIYORUZ; sadece eski
   * ismi gösteriyoruz ve kart seçilmesini istiyoruz.
   */
  const eskiKayit = Boolean(mevcut && !mevcut.musteriId)

  /**
   * Kart seçilince telefon ve adres NOKTADAN doldurulur — ama kullanıcı
   * üzerine yazabilir. Sebep: o günkü teslimat başka bir kapıya, başka bir
   * telefonla yapılabilir ve belge o günün gerçeğini yazar.
   */
  const noktaSec = (id: string) => {
    setNoktaId(id)
    const nokta = noktalar.find(n => n.id === id)
    if(!nokta) return
    if(nokta.telefon) setTelefon(nokta.telefon)
    const tamAdres = [nokta.adres, nokta.ilce, nokta.il].filter(Boolean).join(' · ')
    if(tamAdres) setAdres(tamAdres)
  }

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
            musteriId,
            noktaId: noktaId || undefined,
            // Belgenin metni KARTTAN kopyalanıyor ve donuyor: kart sonradan
            // yeniden adlandırılsa bile kesilmiş irsaliye değişmez.
            // Eski (0047 öncesi) bir kaydı düzenliyorsak ve kart hâlâ
            // seçilmemişse, belgedeki ismi bozmuyoruz.
            musteriAd: secilenMusteri?.ad ?? mevcut?.musteriAd ?? '',
            musteriTelefon: telefon.trim() || undefined,
            adres: adres.trim() || undefined,
            sevkTarihi: tarih || undefined,
            // ⚠️ Araç ve şoför KOPYALANMIYOR, kimlikle bağlanıyor. Müşteri
            // adı tersine kopyalanıp donuyor çünkü o müşteriye ait bir
            // bilgi; plaka BİZİM aracımızın kimliği ve kart düzeltilirse
            // eski irsaliye de düzelsin isteniyor.
            aracId: aracId || undefined,
            soforId: soforId || undefined,
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

      {eskiKayit && (
        <p className="muted detail-hint">
          Bu sevkiyat müşteri kartı gelmeden önce açılmış. Belgedeki isim
          <strong> {mevcut?.musteriAd}</strong>. Kaydetmek için aşağıdan
          karşılığı olan müşteriyi seçin.
        </p>
      )}

      <label>
        Müşteri *
        <select
          value={musteriId}
          required
          onChange={e => { setMusteriId(e.target.value); setNoktaId('') }}
        >
          <option value="">Seçin…</option>
          {musteriler.map(m => (
            <option key={m.id} value={m.id}>{m.kod} · {m.ad}</option>
          ))}
        </select>
        <small className="muted">
          Elle yazılmıyor, karttan seçiliyor. Elle yazılan isim aynı müşteriyi
          “Migros”, “MİGROS”, “migros tic” diye üç ayrı müşteri hâline getirir
          ve geri çağırmada hiçbiri toplanamaz. Müşteri listede yoksa
          Müşteriler ekranından kartını açın.
        </small>
      </label>

      {musteriler.length === 0 && (
        <p className="muted detail-hint">
          Henüz müşteri kartı yok. Sevkiyat açabilmek için önce Müşteriler
          ekranından bir kart oluşturun.
        </p>
      )}

      <label>
        Teslim noktası
        <select
          value={noktaId}
          disabled={!musteriId}
          onChange={e => noktaSec(e.target.value)}
        >
          <option value="">
            {musteriId ? 'Seçin…' : 'Önce müşteri seçin'}
          </option>
          {musteriNoktalari.map(n => (
            <option key={n.id} value={n.id}>{n.ad}</option>
          ))}
        </select>
        <small className="muted">
          İrsaliyenin gittiği yer. Seçilince telefon ve adres buradan
          doldurulur — o günkü teslimat farklıysa üzerine yazabilirsiniz.
          {musteriId && musteriNoktalari.length === 0
            && ' Bu müşterinin teslim noktası yok; Müşteriler ekranından ekleyebilirsiniz.'}
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

      {/* ── TAŞIYAN (0064) ────────────────────────────────────────────────
          Yol haritası: "Sevkiyata sefer bağlanıyor — hangi mal, hangi
          plakayla, kimin götürdüğü defterde."

          Önce irsaliyede iki boş satırdı ve elle dolduruluyordu; elle yazılan
          plaka hiçbir yerde aranamıyordu. "Bu partiyi hangi araç taşıdı"
          sorusunun cevabı kâğıtta kalıyordu — CCP-8 ölçümü de öyle. */}
      <div className="form-row">
        <label>
          Araç
          <select value={aracId} onChange={e => setAracId(e.target.value)}>
            <option value="">Seçilmedi</option>
            {araclar
              // Pasif araç listede YOK — ama bu sevkiyata zaten bağlıysa
              // kalıyor, yoksa düzenlerken sessizce kopardı.
              .filter(a => a.aktif || a.id === aracId)
              .map(a => (
                <option key={a.id} value={a.id}>{aracEtiketi(a)}</option>
              ))}
          </select>
        </label>
        <label>
          Şoför
          <select value={soforId} onChange={e => setSoforId(e.target.value)}>
            <option value="">Seçilmedi</option>
            {soforler
              .filter(d => d.aktif || d.id === soforId)
              .map(d => (
                <option key={d.id} value={d.id}>
                  {d.adSoyad}{d.telefon ? ` · ${d.telefon}` : ''}
                </option>
              ))}
          </select>
        </label>
      </div>

      {araclar.length === 0 && (
        <small className="muted">
          Araç kartı yok. <strong>Sevkiyatlar ekranının altındaki Araçlar ve
          Şoförler</strong> bölümünden ekleyebilirsiniz. Araçsız sevkiyat da
          açılır — kargoyla gönderiyorsanız boş bırakın.
        </small>
      )}

      {/* ⚠️ Uyarılar ENGELLEMİYOR. Kuru gıda soğutmasız araçla gider ve bu
          doğrudur; hangi ürünün soğuk zincire girdiğini sistem henüz
          bilmiyor. Engelleseydik doğru sevkiyatları da durdururduk. */}
      {sogutmaUyarisi(araclar.find(a => a.id === aracId)) && (
        <div className="form-info">
          {sogutmaUyarisi(araclar.find(a => a.id === aracId))}
        </div>
      )}
      {(() => {
        const d = soforler.find(x => x.id === soforId)
        const uyari = d ? ehliyetUyarisi(d) : undefined
        return uyari ? <div className="form-error">{d?.adSoyad} — {uyari}</div> : null
      })()}

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
