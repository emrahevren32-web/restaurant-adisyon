// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 / Depo çekirdeği — Depo ekranı
//
// Yol haritası Aşama 2: "İlk satılabilir nokta. Bu aşamadan sonra tek bir
// işletmeyle sınırlı pilot başlatılabilir."
//
// Bu ekran, MİYOP'un GERÇEK veritabanına konuşan ilk iş ekranıdır. Eski stok
// ekranları (StockCards, StockMovements) hâlâ localStorage üzerinde çalışıyor;
// onlara dokunulmadı. ADR-003'ün "dikey dilim" yaklaşımı budur: yeni çekirdek
// yanına kurulur, eskisi yerinde durur, geçiş bittiğinde eskisi emekliye ayrılır.
//
// ── EKRANIN TEK KURALI ───────────────────────────────────────────────────
// Burada hiçbir yerde miktar hesaplanıp saklanmaz. Ekranda gördüğünüz her
// rakam `DepoServisi` üzerinden DEFTERDEN türetilir. "Rakamın altına tıkla,
// onu oluşturan hareketleri gör" özelliği bu yüzden bir ek değil, mimarinin
// doğal sonucudur.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { createStockRepository, resolveStockRepositoryMode } from '../core/stock/index'
import { InMemoryStockItemLookup } from '../core/stock/stock-item-lookup'
import type { Movement, MovementReason } from '../core/stock/stock.repository'
import { PostgresStokKatalogu, type Birim, type YeniKalem } from '../warehouse/warehouse.catalog'
import { convertUom } from '../core/stock/uom'
import {
  DepoServisi,
  cevrilebilirBirimler,
  type CikisNedeni,
  type DepoKalemi,
  type DepoLotu,
  type DepoUyarilari,
} from '../warehouse/warehouse.service'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import { satirlariYaz } from '../core/import/sheet'
import {
  KALEM_SUTUNLARI,
  kalemleriCozumle,
  type KalemOnizlemesi,
} from '../warehouse/catalog-import'
import { SheetImport } from '../components/SheetImport'
import {
  MALIYET_YONTEM_ETIKETLERI,
  VARSAYILAN_MALIYET_YONTEMI,
  maliyetiHesapla,
  type StokMaliyeti,
} from '../warehouse/stock-cost'

type Props = { currentUser: User }
type Islem = 'kabul' | 'cikis' | 'sayim' | 'yeni-kalem' | 'ice-aktar' | null

const NEDEN_ETIKETLERI: Record<MovementReason, string> = {
  PURCHASE_RECEIPT: 'Mal kabul',
  PURCHASE_RETURN: 'Satın alma iadesi',
  PRODUCTION_CONSUME: 'Üretim tüketimi',
  PRODUCTION_OUTPUT: 'Mamul girişi',
  PRODUCTION_WASTE: 'Üretim firesi',
  SHIPMENT_OUT: 'Sevkiyat çıkışı',
  SHIPMENT_RETURN: 'Sevkiyat iadesi',
  COUNT_SURPLUS: 'Sayım fazlası',
  COUNT_SHORTAGE: 'Sayım eksiği',
  EXPIRY_WRITE_OFF: 'SKT imhası',
  WASTE: 'Fire',
  TRANSFER_IN: 'Transfer girişi',
  TRANSFER_OUT: 'Transfer çıkışı',
  OPENING_BALANCE: 'Açılış bakiyesi',
  REVERSAL: 'Ters kayıt',
}

const CIKIS_NEDENLERI: Array<{ deger: CikisNedeni; etiket: string }> = [
  { deger: 'PRODUCTION_CONSUME', etiket: 'Üretim tüketimi' },
  { deger: 'SHIPMENT_OUT', etiket: 'Sevkiyat çıkışı' },
  { deger: 'WASTE', etiket: 'Fire' },
  { deger: 'EXPIRY_WRITE_OFF', etiket: 'SKT imhası' },
  { deger: 'PURCHASE_RETURN', etiket: 'Tedarikçiye iade' },
]

const sayiBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 })
const bicimle = (deger: number) => sayiBicimi.format(deger)

const paraBicimi = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })
const para = (deger: number) => paraBicimi.format(deger)

/**
 * Birim maliyeti biçimler.
 *
 * Gram başına maliyet 0,04 TL gibi küçük sayılardır; iki hane gösterirsek
 * "0,04" ile "0,04" arasındaki gerçek farkı gizleriz. Bu yüzden küçük
 * değerlerde daha çok hane açıyoruz.
 */
const birimMaliyetBicimle = (deger: number) => {
  const hane = deger !== 0 && Math.abs(deger) < 1 ? 6 : 2
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY',
    minimumFractionDigits: 2, maximumFractionDigits: hane,
  }).format(deger)
}

const tarihBicimle = (deger: Date | string) => {
  const tarih = deger instanceof Date ? deger : new Date(deger)
  return Number.isNaN(tarih.getTime()) ? '—' : tarih.toLocaleString('tr-TR')
}

const hataMetni = (hata: unknown) =>
  hata instanceof Error ? hata.message : 'Beklenmeyen bir hata oluştu.'

/**
 * Bu kalem için seçilebilecek birimler.
 *
 * Kullanıcıya seçemeyeceği bir birim göstermek, hatayı forma değil "Deftere
 * yaz" düğmesine ertelemek olurdu: `adet` seçip miktarı yazıp kaydedince
 * "çevrilemiyor" demek kötü bir deneyim. Liste baştan süzülüyor.
 * Temel birim her zaman listede ve BAŞTA.
 */
const kullanilabilirBirimler = (kalem: DepoKalemi, birimler: Birim[]): string[] => {
  const uygun = cevrilebilirBirimler(kalem.temelBirim, birimler.map(b => b.kod))
  const temelsiz = uygun.filter(kod => kod !== kalem.temelBirim)
  return [kalem.temelBirim, ...temelsiz]
}

/**
 * Yazılan miktarın temel birimdeki karşılığı — form doldurulurken canlı gösterilir.
 *
 * "60 kg yazdım, deftere kaç gram gidecek?" sorusunu kaydetmeden önce
 * cevaplıyor. Sayı geçersizse (boş kutu, yarım yazılmış değer) hiçbir şey
 * göstermiyoruz; tahmini bir rakam göstermek yanıltıcı olurdu.
 */
const temelKarsiligi = (ham: string, birim: string, kalem: DepoKalemi): number | null => {
  const sayi = Number(ham)
  if(ham.trim() === '' || !Number.isFinite(sayi) || sayi <= 0) return null
  if(birim === kalem.temelBirim) return null
  try { return convertUom(sayi, birim, kalem.temelBirim) } catch { return null }
}

/**
 * İşlem anahtarı, form AÇILDIĞINDA üretilir ve başarıya kadar korunur.
 *
 * Sebebi I2: aynı anahtarla ikinci kayıt yazılmaz. Kullanıcı ağ hatası sonrası
 * "Kaydet"e tekrar basarsa aynı anahtar gider — ya işlem gerçekten yazılmamıştır
 * ve bu sefer yazılır, ya da ilk denemede yazılmıştır ve ikincisi reddedilir.
 * Her tıklamada yeni anahtar üretseydik, kararsız bir ağda stok iki katına
 * çıkabilirdi.
 */
const yeniAnahtar = (onek: string) => {
  const rastgele = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `depo:${onek}:${rastgele}`
}

/** Form ömrü boyunca DEĞİŞMEYEN işlem anahtarı. */
const useIslemAnahtari = (onek: string) => {
  const ref = React.useRef('')
  if(!ref.current) ref.current = yeniAnahtar(onek)
  return ref.current
}

/**
 * Deponun tepesindeki uyarı şeridi.
 *
 * ── NEDEN BU EKRANIN İLK ŞEYİ ────────────────────────────────────────────
 * Depo sorumlusu sabah ekranı açtığında "her şey listelensin" istemez; "benim
 * bugün ne yapmam gerekiyor" diye sorar. Bu şerit o sorunun cevabıdır:
 * süresi geçmiş mal (imha), SKT'si yaklaşan mal (önce bunu kullan), tükenmek
 * üzere olan kalem (sipariş ver).
 *
 * Üç rakam da defterden türetiliyor; hiçbiri saklanmıyor. Mal girince kritik
 * uyarısı kendiliğinden kayboluyor, lot boşalınca SKT uyarısı susuyor.
 */
const UyariSeridi = ({
  uyarilar,
  onKalemSec,
}: {
  uyarilar: DepoUyarilari
  onKalemSec: (kalemId: string) => void
}) => {
  const { kritikKalemler, suresiGecmis, yaklasan } = uyarilar
  if(kritikKalemler.length === 0 && suresiGecmis.length === 0 && yaklasan.length === 0){
    return (
      <section className="card warehouse-alerts is-clear">
        <strong>Bekleyen uyarı yok.</strong>{' '}
        <span className="muted">
          Süresi geçmiş mal, SKT’si yaklaşan lot ve en az seviyenin altına düşen kalem yok.
        </span>
      </section>
    )
  }

  return (
    <section className="card warehouse-alerts">
      {suresiGecmis.length > 0 && (
        <div className="warehouse-alert danger">
          <div className="warehouse-alert-head">
            <strong>{suresiGecmis.length} lotun süresi geçmiş</strong>
            <span className="muted">Bu mal kullanılamaz; imha hareketi girilmeli.</span>
          </div>
          <ul className="warehouse-alert-list">
            {suresiGecmis.slice(0, 5).map(u => (
              <li key={u.lotId}>
                <button type="button" className="linklike" onClick={() => onKalemSec(u.kalemId)}>
                  {u.kalemAd}
                </button>
                <span className="muted"> · {u.lotKodu} · {bicimle(u.miktar)} {u.birim} · </span>
                <span className="warehouse-alert-age">{Math.abs(u.kalanGun)} gün geçmiş</span>
              </li>
            ))}
            {suresiGecmis.length > 5 && (
              <li className="muted">…ve {suresiGecmis.length - 5} lot daha</li>
            )}
          </ul>
        </div>
      )}

      {yaklasan.length > 0 && (
        <div className="warehouse-alert warning">
          <div className="warehouse-alert-head">
            <strong>{yaklasan.length} lotun SKT’si yaklaşıyor</strong>
            <span className="muted">FEFO gereği önce bunlar tüketilmeli.</span>
          </div>
          <ul className="warehouse-alert-list">
            {yaklasan.slice(0, 5).map(u => (
              <li key={u.lotId}>
                <button type="button" className="linklike" onClick={() => onKalemSec(u.kalemId)}>
                  {u.kalemAd}
                </button>
                <span className="muted"> · {u.lotKodu} · {bicimle(u.miktar)} {u.birim} · </span>
                <span className="warehouse-alert-age">{u.kalanGun} gün kaldı</span>
              </li>
            ))}
            {yaklasan.length > 5 && (
              <li className="muted">…ve {yaklasan.length - 5} lot daha</li>
            )}
          </ul>
        </div>
      )}

      {kritikKalemler.length > 0 && (
        <div className="warehouse-alert notice">
          <div className="warehouse-alert-head">
            <strong>{kritikKalemler.length} kalem en az seviyenin altında</strong>
            <span className="muted">Sipariş verilmezse üretim durabilir.</span>
          </div>
          <ul className="warehouse-alert-list">
            {kritikKalemler.slice(0, 5).map(kalem => (
              <li key={kalem.id}>
                <button type="button" className="linklike" onClick={() => onKalemSec(kalem.id)}>
                  {kalem.ad}
                </button>
                <span className="muted">
                  {' '}· {bicimle(kalem.miktar)} {kalem.temelBirim} (en az {bicimle(kalem.minMiktar)})
                </span>
              </li>
            ))}
            {kritikKalemler.length > 5 && (
              <li className="muted">…ve {kritikKalemler.length - 5} kalem daha</li>
            )}
          </ul>
        </div>
      )}
    </section>
  )
}

export default function Warehouse({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  const yazabilir = !currentUser.permissions || currentUser.permissions.includes('stock.write')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [birimler, setBirimler] = React.useState<Birim[]>([])
  const [kalemler, setKalemler] = React.useState<DepoKalemi[]>([])
  const [seciliId, setSeciliId] = React.useState<string | null>(null)
  const [hareketler, setHareketler] = React.useState<Movement[]>([])
  const [lotlar, setLotlar] = React.useState<DepoLotu[]>([])
  const [uyarilar, setUyarilar] = React.useState<DepoUyarilari | null>(null)
  const [islem, setIslem] = React.useState<Islem>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const servis = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    const client = getSupabase()
    // `InMemoryStockItemLookup` yalnızca "local" modda kullanılır; postgres
    // modunda aynı kontrolü veritabanı tetikleyicisi yapar (bkz. core/stock/index.ts).
    const defter = createStockRepository(new InMemoryStockItemLookup([]))
    return new DepoServisi(defter, new PostgresStokKatalogu(client))
  }, [mod])

  const secili = kalemler.find(kalem => kalem.id === seciliId) ?? null

  /**
   * Maliyet, bakiye gibi, DEFTERDEN TÜRETİLİR — bir kolonda saklanmaz.
   * Ekranda zaten elimizde olan hareket listesinden hesaplanıyor; ayrı bir
   * sorgu yok, ayrı bir kayıt yok, dolayısıyla "güncellemeyi unutmak" diye
   * bir ihtimal de yok (ADR-001).
   */
  const maliyet: StokMaliyeti = React.useMemo(
    () => maliyetiHesapla(hareketler, VARSAYILAN_MALIYET_YONTEMI),
    [hareketler],
  )

  const kalemleriYenile = React.useCallback(async (aktifBaglam: DepoBaglami) => {
    if(!servis) return
    // Uyarılar da burada tazeleniyor. Ayrı bir tetikleyiciye bağlamak, "mal
    // girdim ama kırmızı uyarı duruyor" gibi bir tutarsızlık doğururdu; oysa
    // ikisi de aynı defterden okuyor ve aynı anda değişmeleri gerekir.
    const [kalemListesi, uyariOzeti] = await Promise.all([
      servis.kalemler(aktifBaglam.ctx),
      servis.uyarilar(aktifBaglam.ctx),
    ])
    setKalemler(kalemListesi)
    setUyarilar(uyariOzeti)
  }, [servis])

  const detayYenile = React.useCallback(async (aktifBaglam: DepoBaglami, kalemId: string) => {
    if(!servis) return
    const [dokum, lotBakiyeleri] = await Promise.all([
      servis.hareketler(aktifBaglam.ctx, kalemId),
      servis.lotBakiyeleri(aktifBaglam.ctx, kalemId),
    ])
    // En yeni hareket üstte: kullanıcı "en son ne oldu" diye bakar.
    setHareketler([...dokum].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()))
    setLotlar(lotBakiyeleri)
  }, [servis])

  // İlk yükleme
  React.useEffect(() => {
    let iptal = false
    if(!servis){ setYukleniyor(false); return }

    ;(async () => {
      try{
        const kurulan = await depoBaglamiKur(getSupabase())
        if(iptal) return
        setBaglam(kurulan)
        const [kalemListesi, birimListesi, uyariOzeti] = await Promise.all([
          servis.kalemler(kurulan.ctx),
          new PostgresStokKatalogu(getSupabase()).birimler(),
          servis.uyarilar(kurulan.ctx),
        ])
        if(iptal) return
        setKalemler(kalemListesi)
        setBirimler(birimListesi)
        setUyarilar(uyariOzeti)
      } catch (e) {
        if(!iptal) setHata(hataMetni(e))
      } finally {
        if(!iptal) setYukleniyor(false)
      }
    })()

    return () => { iptal = true }
  }, [servis])

  const kalemSec = async (kalem: DepoKalemi) => {
    setSeciliId(kalem.id)
    setIslem(null)
    setHata('')
    setBilgi('')
    if(!baglam) return
    try{
      await detayYenile(baglam, kalem.id)
    } catch (e) {
      setHata(hataMetni(e))
    }
  }

  const islemSonrasi = async (mesaj: string) => {
    setBilgi(mesaj)
    setHata('')
    setIslem(null)
    if(!baglam) return
    await kalemleriYenile(baglam)
    if(seciliId) await detayYenile(baglam, seciliId)
  }

  // ── Mod / yapılandırma engelleri ────────────────────────────────────────
  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title">
          <div>
            <h2>Depo</h2>
            <p className="muted">Aşama 2 · Depo çekirdeği</p>
          </div>
        </div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>
            Depo çekirdeği, stok defterini Postgres'te tutar — çok şubeli ve çok
            firmalı kullanım, izolasyon ve izlenebilirlik bunu gerektiriyor.
            localStorage tek tarayıcıda yaşadığı için burada kullanılmıyor.
          </p>
          <p className="muted">
            Açmak için <code>.env.local</code> içine
            {' '}<code>VITE_STOCK_REPOSITORY_MODE=postgres</code> ekleyin ve
            {' '}<code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>
            {' '}değerlerinin dolu olduğundan emin olun. Ardından geliştirme
            sunucusunu yeniden başlatın.
          </p>
        </section>
      </div>
    )
  }

  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Depo</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }

  if(!baglam){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Depo</h2></div></div>
        <div className="form-error">{hata || 'Depo bağlamı kurulamadı.'}</div>
      </div>
    )
  }

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Depo</h2>
          <p className="muted">
            Her rakam defterden türetilir · {baglam.subeler.find(s => s.id === baglam.ctx.branchId)?.ad ?? 'Şube'}
          </p>
        </div>
        {yazabilir && (
          <div className="form-actions">
            <button
              className="btn"
              onClick={() => { setIslem('ice-aktar'); setSeciliId(null); setHata(''); setBilgi('') }}
            >
              Excel’den Aktar
            </button>
            <button className="btn primary" onClick={() => { setIslem('yeni-kalem'); setHata('') }}>
              Yeni Stok Kalemi
            </button>
          </div>
        )}
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-info">{bilgi}</div>}

      {uyarilar && (
        <UyariSeridi
          uyarilar={uyarilar}
          onKalemSec={kalemId => {
            const kalem = kalemler.find(k => k.id === kalemId)
            if(kalem) void kalemSec(kalem)
          }}
        />
      )}

      <div className="warehouse-layout">
        <section className="card warehouse-main">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kod</th><th>Ad</th><th>Birim</th>
                  <th className="num">Miktar</th><th className="num">Min.</th><th>Takip</th>
                </tr>
              </thead>
              <tbody>
                {kalemler.length === 0 && (
                  <tr><td colSpan={6} className="muted">Henüz stok kalemi yok.</td></tr>
                )}
                {kalemler.map(kalem => (
                  <tr
                    key={kalem.id}
                    className={[
                      kalem.id === seciliId ? 'is-selected' : '',
                      kalem.kritik ? 'is-critical' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => { void kalemSec(kalem) }}
                  >
                    <td>{kalem.kod}</td>
                    <td>{kalem.ad}</td>
                    <td>{kalem.temelBirim}</td>
                    {/*
                      Rakam gerçek bir DÜĞME.
                      Eskiden satırın tamamı tıklanabilirdi ama rakamın kendisi
                      düz metindi: ürünün en önemli iddiası ("bu sayı saklanmıyor,
                      altındaki hareketlerden doğuyor") ekranda hiçbir işaret
                      taşımıyordu. Kimse tıklamayı denemezse iddia görünmez kalır.
                      Düğme olması ayrıca klavyeyle de erişilebilir kılıyor.
                    */}
                    <td className="num warehouse-qty">
                      <button
                        type="button"
                        className="warehouse-qty-btn"
                        title={`${kalem.ad}: bu rakamı oluşturan hareketleri gör`}
                        onClick={event => { event.stopPropagation(); void kalemSec(kalem) }}
                      >
                        {bicimle(kalem.miktar)}
                      </button>
                    </td>
                    <td className="num muted">{kalem.minMiktar > 0 ? bicimle(kalem.minMiktar) : '—'}</td>
                    <td className="muted">
                      {[kalem.lotTakipli ? 'Lot' : '', kalem.sktTakipli ? 'SKT' : ''].filter(Boolean).join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="warehouse-side">
          {!secili && islem !== 'yeni-kalem' && (
            <section className="card empty-state">
              Bir stok kalemi seçin: miktarın altındaki hareketleri, lot bakiyelerini
              ve işlem formlarını burada göreceksiniz.
            </section>
          )}

          {islem === 'ice-aktar' && (
            <section className="card">
              <div className="section-header compact"><h3>Excel’den Stok Kartı Aktar</h3></div>
              <p className="muted detail-hint">
                Buradan yalnızca <strong>kart tanımı</strong> gelir: kod, ad, birim,
                lot/SKT takibi ve en az miktar. <strong>Miktar gelmez</strong> —
                bakiye defterden türetilir, dışarıdan atanmaz. Açılış bakiyesi girmek
                için kartlar açıldıktan sonra ilgili kalemde “Elle Giriş” yapın;
                o zaman defterde bir hareket olur ve izi kalır.
              </p>
              <SheetImport<YeniKalem>
                varlikAdi="Stok Kartları"
                sutunlar={KALEM_SUTUNLARI}
                sablonDosyaAdi="stok-kartlari-sablon.xlsx"
                cozumle={satirlar => kalemleriCozumle(satirlar, kalemler, birimler)}
                // Katalogda henüz "kalem güncelle" işlemi YOK; kodu zaten olan
                // satırlar atlanır. Panel bunu ekranda açıkça yazıyor.
                guncellemeDestekli={false}
                yaz={(onizleme: KalemOnizlemesi) => satirlariYaz(
                  onizleme,
                  girdi => servis!.kalemEkle(baglam.ctx, girdi),
                )}
                onBitti={() => kalemleriYenile(baglam)}
                onIptal={() => setIslem(null)}
              />
            </section>
          )}

          {islem === 'yeni-kalem' && (
            <section className="card">
              <div className="section-header compact"><h3>Yeni Stok Kalemi</h3></div>
              <YeniKalemFormu
                birimler={birimler}
                onIptal={() => setIslem(null)}
                onKaydet={async girdi => {
                  try{
                    const yeni = await servis!.kalemEkle(baglam.ctx, girdi)
                    // Kartı ekleyip kullanıcıyı boş bir ekranda bırakmıyoruz.
                    // Yeni bir stok kaleminin bakiyesi tanım gereği 0'dır ve
                    // sıradaki iş her zaman aynıdır: ilk mal kabulünü yapmak.
                    // Kalem seçiliyor ve form doğrudan açılıyor.
                    setSeciliId(yeni.id)
                    setBilgi(`"${girdi.ad}" eklendi. Şimdi ilk mal kabulünü yap.`)
                    setHata('')
                    setIslem('kabul')
                    await kalemleriYenile(baglam)
                    await detayYenile(baglam, yeni.id)
                  } catch (e) { setHata(hataMetni(e)) }
                }}
              />
            </section>
          )}

          {secili && (
            <>
              <section className="card">
                <div className="section-header compact">
                  <h3>{secili.ad}</h3>
                  <span className="warehouse-qty-big">{bicimle(secili.miktar)} {secili.temelBirim}</span>
                </div>
                {yazabilir ? (
                  <>
                    <div className="form-actions">
                      <button className="btn primary" onClick={() => { setIslem('kabul'); setHata('') }}>Elle Giriş</button>
                      <button className="btn" onClick={() => { setIslem('cikis'); setHata('') }}>Çıkış</button>
                      <button className="btn" onClick={() => { setIslem('sayim'); setHata('') }}>Sayım</button>
                    </div>
                    {secili.miktar === 0 && (
                      <p className="muted">
                        Bu kalemin defterinde henüz hareket yok, bu yüzden bakiye 0.
                        {secili.lotTakipli && ' Çıkış yapabilmek için önce bir giriş ile ilk lotu açman gerekiyor.'}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="muted">İşlem yapmak için <code>stock.write</code> izni gerekiyor.</p>
                )}
              </section>

              {islem === 'kabul' && (
                <section className="card">
                  <div className="section-header compact"><h3>Elle Giriş</h3></div>
                  {/*
                    ── NEDEN "MAL KABUL" DEĞİL ────────────────────────────
                    Bu düğme önceden "Mal Kabul" adını taşıyordu ve Satın
                    Alma ekranındaki "Mal Kabul Yap" ile karışıyordu. İkisi
                    aynı şeyi yapmıyor:

                      • Satın Alma → Mal Kabul: BELGELİ giriş. Siparişe,
                        tedarikçiye ve irsaliyeye bağlıdır; siparişin kalan
                        miktarını düşürür ve durumunu kapatır.
                      • Buradaki Elle Giriş: BELGESİZ giriş. Arkasında
                        sipariş yoktur — açılış devri, numune, acil alım,
                        bağış gibi durumlar için.

                    İkisine de aynı adı vermek, kullanıcıya "hangisini
                    kullanacağım" sorusunu sordurur ve yanlış seçilen yol
                    siparişi açık bırakır. Ad farkı bu soruyu ortadan
                    kaldırıyor.
                  */}
                  <p className="muted detail-hint">
                    Arkasında sipariş olmayan girişler için: açılış devri, numune,
                    acil alım. <strong>Bir siparişe bağlı mal geldiyse</strong>{' '}
                    Satın Alma → Mal Kabul'ü kullanın; irsaliye, tedarikçi ve
                    sipariş bağı orada kurulur.
                  </p>
                  <MalKabulFormu
                    kalem={secili}
                    lotlar={lotlar}
                    birimler={birimler}
                    onIptal={() => setIslem(null)}
                    onKaydet={async (girdi, anahtar) => {
                      try{
                        await servis!.malKabul(baglam.ctx, { ...girdi, stokKalemiId: secili.id }, anahtar)
                        await islemSonrasi('Giriş deftere yazıldı.')
                      } catch (e) { setHata(hataMetni(e)) }
                    }}
                  />
                </section>
              )}

              {islem === 'cikis' && (
                <section className="card">
                  <div className="section-header compact"><h3>Çıkış</h3></div>
                  <CikisFormu
                    kalem={secili}
                    lotlar={lotlar}
                    birimler={birimler}
                    onIptal={() => setIslem(null)}
                    onKaydet={async (girdi, anahtar) => {
                      try{
                        const yazilan = await servis!.cikis(baglam.ctx, { ...girdi, stokKalemiId: secili.id }, anahtar)
                        await islemSonrasi(
                          yazilan.length > 1
                            ? `Çıkış ${yazilan.length} lota bölündü (FEFO).`
                            : 'Çıkış deftere yazıldı.',
                        )
                      } catch (e) { setHata(hataMetni(e)) }
                    }}
                  />
                </section>
              )}

              {islem === 'sayim' && (
                <section className="card">
                  <div className="section-header compact"><h3>Sayım</h3></div>
                  <SayimFormu
                    kalem={secili}
                    lotlar={lotlar}
                    birimler={birimler}
                    onIptal={() => setIslem(null)}
                    onKaydet={async (girdi, anahtar) => {
                      try{
                        const hareket = await servis!.sayim(baglam.ctx, { ...girdi, stokKalemiId: secili.id }, anahtar)
                        await islemSonrasi(
                          hareket
                            ? `Sayım farkı deftere yazıldı (${bicimle(hareket.quantityBase)} ${secili.temelBirim}).`
                            : 'Sayım defterle uyuştu, hareket yazılmadı.',
                        )
                      } catch (e) { setHata(hataMetni(e)) }
                    }}
                  />
                </section>
              )}

              <section className="card">
                <div className="section-header compact">
                  <h3>Maliyet</h3>
                  <span className="muted">{MALIYET_YONTEM_ETIKETLERI[maliyet.yontem]}</span>
                </div>
                <dl className="detail-grid">
                  <dt>Birim maliyet</dt>
                  <dd>
                    <strong>{birimMaliyetBicimle(maliyet.birimMaliyet)}</strong>
                    {' / '}{secili.temelBirim}
                  </dd>
                  <dt>Stok değeri</dt>
                  <dd><strong>{para(maliyet.deger)}</strong></dd>
                  <dt>Son alış fiyatı</dt>
                  <dd>
                    {maliyet.sonAlisFiyati === undefined
                      ? <span className="muted">Henüz fiyatlı bir alış yok</span>
                      : (
                        <>
                          {para(maliyet.sonAlisFiyati)} / {maliyet.sonAlisBirimi}
                          <span className="muted">
                            {' · '}{tarihBicimle(maliyet.sonAlisTarihi!)}
                          </span>
                        </>
                      )}
                  </dd>
                </dl>

                {maliyet.fiyatsizGirisVar && (
                  <p className="muted detail-hint">
                    Bu kalemde <strong>fiyatsız giriş</strong> var (elle giriş, sayım fazlası
                    veya açılış bakiyesi). O girişler, yapıldıkları andaki ortalamayla
                    değerlendi — sıfır TL sayılsalardı maliyet olduğundan ucuz görünürdü.
                  </p>
                )}

                <p className="muted detail-hint">
                  {maliyet.yontem === 'ORTALAMA' && (
                    <>
                      Aynı malı farklı fiyatlardan aldıkça birim maliyet{' '}
                      <strong>ortalamaya</strong> yaklaşır: 100 kg’ı 40 TL’den, 100 kg’ı
                      50 TL’den aldıysanız depodaki 200 kg’ın maliyeti 45 TL’dir.
                    </>
                  )}
                  {maliyet.yontem === 'FIFO' && (
                    <>
                      Çıkan mal <strong>ilk giren partiden</strong> düşülür; depoda kalanın
                      değeri en son gelen partilerin fiyatlarından oluşur.
                    </>
                  )}
                  {maliyet.yontem === 'SON_ALIS' && (
                    <>
                      Depodaki her birim <strong>en son ödenen fiyattan</strong> değerlenir;
                      geçmiş alışlar hesaba girmez.
                    </>
                  )}
                  {' '}Üretimde kullanılan mal da bu fiyattan düşer. Bu rakam hiçbir yerde
                  saklanmaz; yukarıdaki hareketlerden hesaplanır.
                </p>
              </section>

              {secili.lotTakipli && (
                <section className="card">
                  <div className="section-header compact"><h3>Lot bakiyeleri</h3></div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr><th>Lot</th><th>SKT</th><th className="num">Miktar</th></tr></thead>
                      <tbody>
                        {lotlar.length === 0 && <tr><td colSpan={3} className="muted">Lot yok.</td></tr>}
                        {lotlar.map(lot => (
                          <tr key={lot.id}>
                            <td>{lot.kod}</td>
                            <td className={lot.sonKullanma ? '' : 'muted'}>{lot.sonKullanma ?? '—'}</td>
                            <td className="num">{bicimle(lot.miktar)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted">Sıralama FEFO: en yakın son kullanma tarihi üstte.</p>
                </section>
              )}

              <section className="card">
                <div className="section-header compact"><h3>Hareketler</h3></div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Tarih</th><th>Neden</th><th className="num">Miktar</th><th>Not</th></tr></thead>
                    <tbody>
                      {hareketler.length === 0 && (
                        <tr><td colSpan={4} className="muted">Bu kalem için henüz hareket yok.</td></tr>
                      )}
                      {hareketler.map(hareket => (
                        <tr key={hareket.id}>
                          <td>{tarihBicimle(hareket.occurredAt)}</td>
                          <td>{NEDEN_ETIKETLERI[hareket.reason] ?? hareket.reason}</td>
                          <td className={`num ${hareket.quantityBase < 0 ? 'is-negative' : 'is-positive'}`}>
                            {hareket.quantityBase > 0 ? '+' : ''}{bicimle(hareket.quantityBase)}
                          </td>
                          <td className="muted">{hareket.note ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted">
                  Yukarıdaki {bicimle(secili.miktar)} {secili.temelBirim} bu satırların toplamıdır —
                  hiçbir yerde ayrıca saklanmaz.
                </p>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

// ── Formlar ────────────────────────────────────────────────────────────────

function YeniKalemFormu({ birimler, onKaydet, onIptal }: {
  birimler: Birim[]
  onKaydet: (girdi: { kod: string; ad: string; temelBirim: string; lotTakipli: boolean; sktTakipli: boolean; minMiktar: number }) => void | Promise<void>
  onIptal: () => void
}){
  const [kod, setKod] = React.useState('')
  const [ad, setAd] = React.useState('')
  const [temelBirim, setTemelBirim] = React.useState(birimler[0]?.kod ?? 'kg')
  const [lotTakipli, setLotTakipli] = React.useState(false)
  const [sktTakipli, setSktTakipli] = React.useState(false)
  const [minMiktar, setMinMiktar] = React.useState('0')

  return (
    <form className="stacked-form" onSubmit={e => {
      e.preventDefault()
      void onKaydet({ kod, ad, temelBirim, lotTakipli, sktTakipli, minMiktar: Number(minMiktar) || 0 })
    }}>
      <div className="form-field"><label>Kod</label>
        <input value={kod} onChange={e => setKod(e.target.value)} required /></div>
      <div className="form-field"><label>Ad</label>
        <input value={ad} onChange={e => setAd(e.target.value)} required /></div>
      <div className="form-field"><label>Temel birim</label>
        <select value={temelBirim} onChange={e => setTemelBirim(e.target.value)}>
          {birimler.map(b => <option key={b.kod} value={b.kod}>{b.kod} — {b.ad}</option>)}
        </select>
        <small className="muted">Defterin birimi budur; sonradan değiştirilmez.</small>
      </div>
      <div className="form-field"><label>Kritik seviye</label>
        <input type="number" min="0" step="any" value={minMiktar} onChange={e => setMinMiktar(e.target.value)} /></div>
      <label className="check-row form-check-field">
        <input type="checkbox" checked={lotTakipli} onChange={e => setLotTakipli(e.target.checked)} /> Lot takibi
      </label>
      <label className="check-row form-check-field">
        <input type="checkbox" checked={sktTakipli} onChange={e => setSktTakipli(e.target.checked)} /> SKT takibi
      </label>
      {/*
        Sık karışan nokta: bu iki kutucuk KURAL koyar, veri girmez. Lot kodu ve
        son kullanma tarihi kartın değil, HER MAL KABULÜN özelliğidir — aynı
        kalemin her partisi farklı tarih taşır. Kullanıcıya bunu burada
        söylemezsek "işaretledim ama bir şey çıkmadı" diye haklı olarak bekler.
      */}
      <p className="muted form-hint">
        Bu iki seçenek <strong>kural</strong> koyar, veri istemez. Lot kodunu ve
        son kullanma tarihini <strong>girişte</strong> yazarsınız —
        çünkü her parti farklı tarih taşır. İşaretliyken: lotsuz giriş yapılamaz,
        SKT’siz parti açılamaz, çıkışta FEFO uygulanır.
      </p>
      <div className="form-actions">
        <button className="btn primary" type="submit">Kaydet</button>
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
      </div>
    </form>
  )
}

function MalKabulFormu({ kalem, lotlar, birimler, onKaydet, onIptal }: {
  kalem: DepoKalemi
  lotlar: DepoLotu[]
  birimler: Birim[]
  onKaydet: (girdi: {
    miktar: number; birim: string; lotId?: string
    yeniLot?: { kod: string; sonKullanma?: string; tedarikci?: string }
    birimMaliyet?: number; not?: string
  }, anahtar: string) => void | Promise<void>
  onIptal: () => void
}){
  // Anahtar form açılırken üretilir — bkz. `yeniAnahtar` başındaki not.
  const anahtar = useIslemAnahtari('kabul')
  const [miktar, setMiktar] = React.useState('')
  const [birim, setBirim] = React.useState(kalem.temelBirim)
  const [lotSecimi, setLotSecimi] = React.useState('yeni')
  const [lotKodu, setLotKodu] = React.useState('')
  const [skt, setSkt] = React.useState('')
  const [tedarikci, setTedarikci] = React.useState('')
  const [maliyet, setMaliyet] = React.useState('')
  const [not, setNot] = React.useState('')

  const birimSecenekleri = birimler.length > 0 ? birimler : [{ kod: kalem.temelBirim, ad: kalem.temelBirim, boyut: '' }]

  return (
    <form className="stacked-form" onSubmit={e => {
      e.preventDefault()
      void onKaydet({
        miktar: Number(miktar),
        birim,
        lotId: kalem.lotTakipli && lotSecimi !== 'yeni' ? lotSecimi : undefined,
        yeniLot: kalem.lotTakipli && lotSecimi === 'yeni'
          ? { kod: lotKodu, sonKullanma: skt || undefined, tedarikci: tedarikci || undefined }
          : undefined,
        birimMaliyet: maliyet ? Number(maliyet) : undefined,
        not: not || undefined,
      }, anahtar)
    }}>
      <div className="form-field"><label>Miktar</label>
        <input type="number" min="0" step="any" value={miktar} onChange={e => setMiktar(e.target.value)} required /></div>
      <div className="form-field"><label>Birim</label>
        <select value={birim} onChange={e => setBirim(e.target.value)}>
          {birimSecenekleri.map(b => <option key={b.kod} value={b.kod}>{b.kod}</option>)}
        </select>
      </div>

      {kalem.lotTakipli && (
        <>
          <div className="form-field"><label>Lot</label>
            <select value={lotSecimi} onChange={e => setLotSecimi(e.target.value)}>
              <option value="yeni">Yeni lot aç</option>
              {lotlar.map(lot => (
                <option key={lot.id} value={lot.id}>
                  {lot.kod}{lot.sonKullanma ? ` · SKT ${lot.sonKullanma}` : ''}
                </option>
              ))}
            </select>
          </div>
          {lotSecimi === 'yeni' && (
            <>
              <div className="form-field"><label>Lot kodu</label>
                <input value={lotKodu} onChange={e => setLotKodu(e.target.value)} required /></div>
              <div className="form-field">
                <label>Son kullanma tarihi{kalem.sktTakipli ? ' (zorunlu)' : ''}</label>
                <input type="date" value={skt} onChange={e => setSkt(e.target.value)} required={kalem.sktTakipli} />
              </div>
              <div className="form-field"><label>Tedarikçi</label>
                <input value={tedarikci} onChange={e => setTedarikci(e.target.value)} /></div>
            </>
          )}
        </>
      )}

      <div className="form-field"><label>Birim maliyet</label>
        <input type="number" min="0" step="any" value={maliyet} onChange={e => setMaliyet(e.target.value)} /></div>
      <div className="form-field"><label>Not</label>
        <input value={not} onChange={e => setNot(e.target.value)} /></div>

      <div className="form-actions">
        <button className="btn primary" type="submit">Deftere yaz</button>
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
      </div>
    </form>
  )
}

function CikisFormu({ kalem, lotlar, birimler, onKaydet, onIptal }: {
  kalem: DepoKalemi
  lotlar: DepoLotu[]
  birimler: Birim[]
  onKaydet: (girdi: { miktar: number; birim: string; neden: CikisNedeni; lotId?: string; not?: string }, anahtar: string) => void | Promise<void>
  onIptal: () => void
}){
  const anahtar = useIslemAnahtari('cikis')
  const [miktar, setMiktar] = React.useState('')
  const [birim, setBirim] = React.useState(kalem.temelBirim)
  const [neden, setNeden] = React.useState<CikisNedeni>('PRODUCTION_CONSUME')
  const [lotSecimi, setLotSecimi] = React.useState('fefo')
  const [not, setNot] = React.useState('')

  const doluLotlar = lotlar.filter(lot => lot.miktar > 0)
  const secenekler = kullanilabilirBirimler(kalem, birimler)
  const temelKarsilik = temelKarsiligi(miktar, birim, kalem)

  return (
    <form className="stacked-form" onSubmit={e => {
      e.preventDefault()
      void onKaydet({
        miktar: Number(miktar),
        birim,
        neden,
        lotId: kalem.lotTakipli && lotSecimi !== 'fefo' ? lotSecimi : undefined,
        not: not || undefined,
      }, anahtar)
    }}>
      <div className="form-field"><label>Miktar</label>
        <input type="number" min="0" step="any" value={miktar} onChange={e => setMiktar(e.target.value)} required /></div>
      <div className="form-field"><label>Birim</label>
        <select value={birim} onChange={e => setBirim(e.target.value)}>
          {secenekler.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {temelKarsilik !== null && (
          <small className="muted">Deftere <strong>{bicimle(temelKarsilik)} {kalem.temelBirim}</strong> olarak işlenecek.</small>
        )}
      </div>
      <div className="form-field"><label>Neden</label>
        <select value={neden} onChange={e => setNeden(e.target.value as CikisNedeni)}>
          {CIKIS_NEDENLERI.map(n => <option key={n.deger} value={n.deger}>{n.etiket}</option>)}
        </select>
      </div>

      {kalem.lotTakipli && (
        <div className="form-field">
          <label>Lot</label>
          <select value={lotSecimi} onChange={e => setLotSecimi(e.target.value)}>
            <option value="fefo">FEFO — en yakın SKT’den başla</option>
            {doluLotlar.map(lot => (
              <option key={lot.id} value={lot.id}>
                {lot.kod}{lot.sonKullanma ? ` · SKT ${lot.sonKullanma}` : ''} · {bicimle(lot.miktar)}
              </option>
            ))}
          </select>
          <small className="muted">
            FEFO seçiliyken çıkış gerekirse birden çok lota bölünür ve her parça
            ayrı hareket olarak yazılır.
          </small>
        </div>
      )}

      <div className="form-field"><label>Not</label>
        <input value={not} onChange={e => setNot(e.target.value)} /></div>

      <div className="form-actions">
        <button className="btn primary" type="submit">Deftere yaz</button>
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
      </div>
    </form>
  )
}

function SayimFormu({ kalem, lotlar, birimler, onKaydet, onIptal }: {
  kalem: DepoKalemi
  lotlar: DepoLotu[]
  birimler: Birim[]
  onKaydet: (girdi: { sayilan: number; birim: string; lotId?: string; not?: string }, anahtar: string) => void | Promise<void>
  onIptal: () => void
}){
  const anahtar = useIslemAnahtari('sayim')
  const [sayilan, setSayilan] = React.useState('')
  const [birim, setBirim] = React.useState(kalem.temelBirim)
  const [lotSecimi, setLotSecimi] = React.useState(lotlar[0]?.id ?? '')
  const [not, setNot] = React.useState('')

  const secenekler = kullanilabilirBirimler(kalem, birimler)
  const secilenLot = lotlar.find(lot => lot.id === lotSecimi)
  const mevcut = kalem.lotTakipli ? (secilenLot?.miktar ?? 0) : kalem.miktar

  // Fark HER ZAMAN temel birimde hesaplanıyor — servisin yaptığının aynısı.
  // İki yer farklı hesaplasaydı ekranda gördüğün fark ile deftere yazılan
  // farklı olurdu; bu, güveni tek seferde bitiren türden bir tutarsızlıktır.
  const sayilanTemel = (() => {
    const sayi = Number(sayilan)
    if(sayilan.trim() === '' || !Number.isFinite(sayi) || sayi < 0) return null
    try { return convertUom(sayi, birim, kalem.temelBirim) } catch { return null }
  })()
  const fark = sayilanTemel === null ? null : sayilanTemel - mevcut

  return (
    <form className="stacked-form" onSubmit={e => {
      e.preventDefault()
      void onKaydet({
        sayilan: Number(sayilan),
        birim,
        lotId: kalem.lotTakipli ? lotSecimi : undefined,
        not: not || undefined,
      }, anahtar)
    }}>
      {kalem.lotTakipli && (
        <div className="form-field"><label>Lot</label>
          <select value={lotSecimi} onChange={e => setLotSecimi(e.target.value)} required>
            <option value="" disabled>Lot seçin</option>
            {lotlar.map(lot => (
              <option key={lot.id} value={lot.id}>
                {lot.kod}{lot.sonKullanma ? ` · SKT ${lot.sonKullanma}` : ''} · {bicimle(lot.miktar)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="form-field">
        <label>Sayılan miktar</label>
        <input type="number" min="0" step="any" value={sayilan} onChange={e => setSayilan(e.target.value)} required />
      </div>
      <div className="form-field"><label>Birim</label>
        <select value={birim} onChange={e => setBirim(e.target.value)}>
          {secenekler.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <small className="muted">
          Defterde görünen: <strong>{bicimle(mevcut)} {kalem.temelBirim}</strong>
          {fark !== null && fark !== 0 && (
            <> · fark <strong>{fark > 0 ? '+' : ''}{bicimle(fark)} {kalem.temelBirim}</strong> olarak yazılacak</>
          )}
          {fark === 0 && <> · fark yok, hareket yazılmayacak</>}
        </small>
      </div>

      <div className="form-field"><label>Not</label>
        <input value={not} onChange={e => setNot(e.target.value)} /></div>

      <div className="form-actions">
        <button className="btn primary" type="submit">Sayımı işle</button>
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
      </div>
    </form>
  )
}
