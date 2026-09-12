// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 / Üretim — İş emirleri ekranı
//
// Yol haritası maddeleri:
//   "Üretim iş emri açma"                         → Yetersiz stokla başlatılamıyor
//   "Hammadde tüketimi deftere yazıyor"           → FEFO ile en yakın SKT'li lot
//   "Mamul girişi + yeni lot oluşumu"             → Verim oranı hesaba katılıyor
//   "Üretim firesi ayrı hareket olarak yazılıyor" → Fire gizlenmiyor
//   "İptal edilen iş emri tüketimi geri alıyor"   → Ters kayıtla, silmeyle değil
//
// ── EKRANIN İDDİASI ──────────────────────────────────────────────────────
// Sağ panel bir iş emrinin üç hâlini de aynı yerde gösteriyor:
//   PLAN     — reçeteden ölçeklenmiş miktarlar, depodaki bakiyeyle yan yana
//   GERÇEK   — deftere yazılmış hareketler, HANGİ LOTTAN çekildiği dahil
//   MALİYET  — tüketilen hammaddenin parası, mamulün birim maliyeti
//
// "Hangi lottan çekildi" satırı demonun can alıcı yeri: geri çağırma listesi
// bu bağın üstüne kurulu. Ekranda görünmesi, zincirin gerçekten var olduğunun
// kanıtı — anlatılan bir şey değil, gösterilen bir şey.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { createStockRepository, resolveStockRepositoryMode } from '../core/stock/index'
import { InMemoryStockItemLookup } from '../core/stock/stock-item-lookup'
import type { Movement, MovementReason } from '../core/stock/stock.repository'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import {
  PostgresStokKatalogu, type Birim, type KatalogKalemi, type KatalogLotu,
} from '../warehouse/warehouse.catalog'
import { DepoServisi, cevrilebilirBirimler, type DepoKalemi } from '../warehouse/warehouse.service'
import { PostgresReceteDeposu, type Recete } from '../production/recipe.repository'
import { ReceteServisi, receteyiOlcekle } from '../production/recipe.service'
import {
  IS_EMRI_DURUM_ETIKETLERI,
  IS_EMRI_GECISLERI,
  PostgresIsEmriDeposu,
  type IsEmri,
  type IsEmriDurumu,
  type YeniIsEmri,
} from '../production/work-order.repository'
import {
  IsEmriServisi,
  receteyiIsEmrineDok,
  sonrakiIsEmriNo,
  type TamamlamaGirdisi,
  type UretimMaliyeti,
} from '../production/work-order.service'
import type { YeterlilikSatiri } from '../production/recipe.service'

/** Ekranın maliyet kartına taşıdığı ek bilgi: neye bölündüğü. */
type EkranMaliyeti = UretimMaliyeti & {
  /** Gerçekleşen üretim miktarı; iş emri henüz tamamlanmadıysa boş. */
  gerceklesen?: number
  /** Birim maliyetin biriminin adı. */
  birim: string
}

type Props = { currentUser: User }
type Islem = 'yeni' | 'tamamla' | null

const sayiBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 })
const bicimle = (d: number) => sayiBicimi.format(d)
const paraBicimi = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })
const para = (d: number) => paraBicimi.format(d)
const hataMetni = (h: unknown) => (h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.')

const tarihBicimle = (d?: string) => {
  if(!d) return '—'
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleString('tr-TR')
}

const durumSinifi = (durum: IsEmriDurumu) =>
  durum === 'COMPLETED' ? 'success-pill'
    : durum === 'STARTED' ? 'warning-pill'
      : durum === 'CANCELLED' ? 'muted-pill' : 'info-pill'

const GECIS_ETIKETLERI: Record<IsEmriDurumu, string> = {
  DRAFT: 'Taslağa al',
  STARTED: 'Üretimi Başlat',
  COMPLETED: 'Üretimi Tamamla',
  CANCELLED: 'İptal Et',
}

const HAREKET_ETIKETLERI: Partial<Record<MovementReason, string>> = {
  PRODUCTION_CONSUME: 'Hammadde tüketimi',
  PRODUCTION_WASTE: 'Üretim firesi',
  PRODUCTION_OUTPUT: 'Mamul girişi',
  REVERSAL: 'Ters kayıt (iptal)',
}

/** Tarih alanları için üst sınır — beş haneli yıl bir yazım hatasıdır. */
const enGecTarih = (() => {
  const t = new Date()
  return `${t.getFullYear() + 10}-12-31`
})()

export default function WorkOrders({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  const yazabilir = !currentUser.permissions || currentUser.permissions.includes('production.write')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [isEmirleri, setIsEmirleri] = React.useState<IsEmri[]>([])
  const [receteler, setReceteler] = React.useState<Recete[]>([])
  const [kalemler, setKalemler] = React.useState<KatalogKalemi[]>([])
  const [birimler, setBirimler] = React.useState<Birim[]>([])
  const [bakiyeler, setBakiyeler] = React.useState<DepoKalemi[]>([])
  const [seciliId, setSeciliId] = React.useState<string | null>(null)
  const [hareketler, setHareketler] = React.useState<Movement[]>([])
  const [lotlar, setLotlar] = React.useState<KatalogLotu[]>([])
  const [maliyet, setMaliyet] = React.useState<EkranMaliyeti | null>(null)
  const [islem, setIslem] = React.useState<Islem>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [calisiyor, setCalisiyor] = React.useState(false)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const servis = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    const client = getSupabase()
    return new IsEmriServisi(
      new PostgresIsEmriDeposu(client),
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
    const [i, b] = await Promise.all([servis.hepsi(aktif.ctx), depoServisi.kalemler(aktif.ctx)])
    setIsEmirleri(i)
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
        const receteServisi = new ReceteServisi(new PostgresReceteDeposu(getSupabase()))
        const [i, r, kl, bl, bk] = await Promise.all([
          servis.hepsi(kurulan.ctx),
          receteServisi.hepsi(kurulan.ctx),
          katalog.kalemler(kurulan.ctx),
          katalog.birimler(),
          depoServisi.kalemler(kurulan.ctx),
        ])
        if(iptal) return
        setIsEmirleri(i)
        setReceteler(r)
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

  const secili = isEmirleri.find(i => i.id === seciliId) ?? null

  /**
   * Seçilen iş emrinin DEFTERDEKİ izi.
   *
   * Plan yukarıda, gerçek burada. İkisi ayrı ayrı okunuyor çünkü ikisi ayrı
   * şey: plan bir niyet beyanı, defter olan biten.
   */
  React.useEffect(() => {
    let iptal = false
    if(!secili || !servis || !baglam || !depoServisi){
      setHareketler([]); setLotlar([]); setMaliyet(null); return
    }

    ;(async () => {
      try{
        const h = await servis.hareketleri(baglam.ctx, secili)
        if(iptal) return
        setHareketler(h)

        const katalog = new PostgresStokKatalogu(getSupabase())
        const kalemIdleri = [...new Set([
          ...secili.satirlar.map(s => s.stokKalemiId), secili.ciktiKalemiId,
        ])]
        const lotListeleri = await Promise.all(
          kalemIdleri.map(id => katalog.lotlar(baglam.ctx, id)),
        )
        if(iptal) return
        setLotlar(lotListeleri.flat())

        if(secili.durum === 'STARTED' || secili.durum === 'COMPLETED'){
          // Mamul girişi hareketi varsa GERÇEKLEŞEN miktarı ondan alıyoruz —
          // kullanıcının yazdığı hâliyle (48 kg), temel birime çevrilmiş
          // hâliyle değil (48.000 g). Birim maliyet böylece çıktı biriminde
          // okunur kalıyor.
          const cikti = h.find(x => x.reason === 'PRODUCTION_OUTPUT')
          const bolen = cikti ? Math.abs(cikti.quantityEntered) : secili.planlananMiktar
          const m = await servis.maliyet(baglam.ctx, secili, bolen)
          if(!iptal) setMaliyet({ ...m, gerceklesen: cikti ? bolen : undefined,
            birim: cikti ? cikti.uomEntered : secili.ciktiBirimi })
        } else {
          setMaliyet(null)
        }
      } catch (e) { if(!iptal) setHata(hataMetni(e)) }
    })()

    return () => { iptal = true }
  }, [secili, servis, baglam, depoServisi])

  const bakiyeHaritasi = React.useMemo(
    () => new Map(bakiyeler.map(b => [b.id, b.miktar])),
    [bakiyeler],
  )

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Üretim İş Emirleri</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>Tüketim ve mamul girişi stok defterine yazılır.</p>
        </section>
      </div>
    )
  }

  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Üretim İş Emirleri</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }

  if(!baglam){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Üretim İş Emirleri</h2></div></div>
        <section className="card empty-state">{hata || 'Çalışma alanı çözülemedi.'}</section>
      </div>
    )
  }

  const sonrasi = async (mesaj: string) => {
    setBilgi(mesaj); setHata(''); setIslem(null)
    await yenile(baglam)
  }

  const olustur = async (girdi: YeniIsEmri) => {
    try{
      const yeni = await servis!.ekle(baglam.ctx, girdi)
      setSeciliId(yeni.id)
      await sonrasi(`${yeni.isEmriNo} açıldı. Başlatınca hammadde deftere düşecek.`)
    } catch (e) { setHata(hataMetni(e)) }
  }

  const baslat = async (isEmri: IsEmri) => {
    setCalisiyor(true)
    try{
      const guncel = await servis!.baslat(baglam.ctx, isEmri, bakiyeHaritasi, kalemler)
      await sonrasi(
        `${guncel.isEmriNo} başladı. Hammadde stok defterine ÇIKIŞ olarak yazıldı; `
        + 'lotlar FEFO ile seçildi.',
      )
    } catch (e) { setHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  const tamamla = async (isEmri: IsEmri, girdi: TamamlamaGirdisi) => {
    setCalisiyor(true)
    try{
      const guncel = await servis!.tamamla(
        baglam.ctx, isEmri, girdi,
        id => kalemler.find(k => k.id === id)?.lotTakipli ?? false,
        id => kalemler.find(k => k.id === id)?.sktTakipli ?? false,
      )
      await sonrasi(
        `${guncel.isEmriNo} tamamlandı. ${bicimle(girdi.uretilenMiktar)} ${isEmri.ciktiBirimi} `
        + 'mamul deftere giriş olarak yazıldı ve yeni lotu açıldı.',
      )
    } catch (e) { setHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  const iptalEt = async (isEmri: IsEmri) => {
    if(!window.confirm(
      `${isEmri.isEmriNo} iptal edilecek.\n\n`
      + 'Deftere yazılmış hareketler SİLİNMEZ; her birinin tersi yazılır ve '
      + 'bakiyeler eski değerine döner. Bu işlem geri alınamaz.',
    )) return

    setCalisiyor(true)
    try{
      const guncel = await servis!.iptalEt(baglam.ctx, isEmri)
      await sonrasi(
        `${guncel.isEmriNo} iptal edildi. Tüketilen hammadde ters kayıtla geri alındı.`,
      )
    } catch (e) { setHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  const durumIslemi = (isEmri: IsEmri, durum: IsEmriDurumu) => {
    if(durum === 'STARTED') return void baslat(isEmri)
    if(durum === 'COMPLETED') return setIslem('tamamla')
    if(durum === 'CANCELLED') return void iptalEt(isEmri)
  }

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Üretim İş Emirleri</h2>
          <p className="muted">Aşama 3 · Plan yukarıda, defter aşağıda</p>
        </div>
        {yazabilir && (
          <button
            className="btn primary"
            onClick={() => { setIslem('yeni'); setHata(''); setBilgi('') }}
          >
            Yeni İş Emri
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
                  <th>İş Emri</th><th>Üretilen</th><th className="num">Planlanan</th>
                  <th className="num">Verim</th><th>Durum</th><th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {isEmirleri.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      Henüz iş emri yok. Bir iş emri, reçeteyi gerçek üretime çeviren
                      belgedir: başlatınca hammadde deftere düşer, tamamlayınca mamul
                      girer ve yeni lotu açılır.
                    </td>
                  </tr>
                )}
                {isEmirleri.map(isEmri => (
                  <tr
                    key={isEmri.id}
                    className={isEmri.id === seciliId ? 'is-selected' : ''}
                    onClick={() => { setSeciliId(isEmri.id); setIslem(null) }}
                  >
                    <td>{isEmri.isEmriNo}</td>
                    <td>{isEmri.ciktiKalemiAd ?? '—'}</td>
                    <td className="num">
                      {bicimle(isEmri.planlananMiktar)} {isEmri.ciktiBirimi}
                    </td>
                    <td className={`num ${isEmri.verim < 100 ? '' : 'muted'}`}>
                      %{bicimle(isEmri.verim)}
                    </td>
                    <td>
                      <span className={`status-pill ${durumSinifi(isEmri.durum)}`}>
                        {IS_EMRI_DURUM_ETIKETLERI[isEmri.durum]}
                      </span>
                    </td>
                    <td className="muted">{isEmri.planlananTarih ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="warehouse-side">
          {islem === 'yeni' && (
            <section className="card">
              <div className="section-header compact"><h3>Yeni İş Emri</h3></div>
              <IsEmriFormu
                receteler={receteler.filter(r => r.durum === 'ACTIVE')}
                kalemler={kalemler}
                birimler={birimler}
                onerilenNo={sonrakiIsEmriNo(isEmirleri.map(i => i.isEmriNo))}
                onIptal={() => setIslem(null)}
                onKaydet={olustur}
              />
            </section>
          )}

          {islem === 'tamamla' && secili && (
            <section className="card">
              <div className="section-header compact">
                <h3>{secili.isEmriNo} · Üretimi Tamamla</h3>
              </div>
              <TamamlamaFormu
                isEmri={secili}
                kalemler={kalemler}
                birimler={birimler}
                calisiyor={calisiyor}
                onIptal={() => setIslem(null)}
                onKaydet={girdi => tamamla(secili, girdi)}
              />
            </section>
          )}

          {!islem && secili && (
            <IsEmriDetayi
              isEmri={secili}
              yeterlilik={servis!.yeterlilik(secili, bakiyeHaritasi, kalemler)}
              hareketler={hareketler}
              lotlar={lotlar}
              kalemler={kalemler}
              maliyet={maliyet}
              yazabilir={yazabilir}
              calisiyor={calisiyor}
              onDurum={durum => durumIslemi(secili, durum)}
            />
          )}

          {!islem && !secili && (
            <section className="card empty-state">
              Bir iş emri seçin: planlanan malzemeleri, depodaki bakiyeyi ve
              üretim başladıysa <strong>hangi lottan çekildiğini</strong> burada
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

function IsEmriDetayi({
  isEmri, yeterlilik, hareketler, lotlar, kalemler, maliyet,
  yazabilir, calisiyor, onDurum,
}: {
  isEmri: IsEmri
  yeterlilik: YeterlilikSatiri[]
  hareketler: Movement[]
  lotlar: KatalogLotu[]
  kalemler: KatalogKalemi[]
  maliyet: EkranMaliyeti | null
  yazabilir: boolean
  calisiyor: boolean
  onDurum: (durum: IsEmriDurumu) => void
}){
  const gecisler = IS_EMRI_GECISLERI[isEmri.durum]
  const taslak = isEmri.durum === 'DRAFT'

  /**
   * Gerçekleşen üretim, DEFTERDEN okunuyor — iş emrinde saklanmıyor.
   * Planla arasındaki fark asıl verimdir; bu satır olmadan "verim hesaba
   * katılıyor" iddiası ekranda görünmez.
   */
  const gerceklesen = (() => {
    const cikti = hareketler.find(h => h.reason === 'PRODUCTION_OUTPUT')
    if(!cikti) return null
    const miktar = Math.abs(cikti.quantityEntered)
    return {
      miktar,
      birim: cikti.uomEntered,
      sapma: isEmri.planlananMiktar > 0
        ? ((miktar - isEmri.planlananMiktar) / isEmri.planlananMiktar) * 100
        : 0,
    }
  })()
  const eksikler = yeterlilik.filter(y => !y.yeterli)

  const lotKodu = (lotId?: string) =>
    lotId ? (lotlar.find(l => l.id === lotId)?.kod ?? '—') : '—'
  const kalemAdi = (id: string) =>
    kalemler.find(k => k.id === id)?.ad ?? id
  const temelBirim = (id: string) =>
    kalemler.find(k => k.id === id)?.temelBirim ?? ''

  return (
    <>
      <section className="card">
        <div className="section-header compact">
          <h3>{isEmri.isEmriNo}</h3>
          <span className={`status-pill ${durumSinifi(isEmri.durum)}`}>
            {IS_EMRI_DURUM_ETIKETLERI[isEmri.durum]}
          </span>
        </div>

        <dl className="detail-grid">
          <dt>Üretilen</dt><dd>{isEmri.ciktiKalemiAd ?? '—'}</dd>
          <dt>Planlanan</dt>
          <dd>{bicimle(isEmri.planlananMiktar)} {isEmri.ciktiBirimi}</dd>
          <dt>Verim</dt>
          <dd>
            %{bicimle(isEmri.verim)}
            {isEmri.verim < 100 && (
              <span className="muted">
                {' · '}malzemeler bu orana göre büyütüldü
              </span>
            )}
          </dd>
          {isEmri.receteAd && (<><dt>Reçete</dt><dd>{isEmri.receteAd}</dd></>)}
          {isEmri.baslamaZamani && (
            <><dt>Başladı</dt><dd>{tarihBicimle(isEmri.baslamaZamani)}</dd></>
          )}
          {isEmri.bitisZamani && (
            <><dt>Bitti</dt><dd>{tarihBicimle(isEmri.bitisZamani)}</dd></>
          )}
          {gerceklesen !== null && (
            <>
              <dt>Gerçekleşen</dt>
              <dd>
                <strong>{bicimle(gerceklesen.miktar)} {gerceklesen.birim}</strong>
                {Math.abs(gerceklesen.sapma) >= 0.05 && (
                  <span className={gerceklesen.sapma < 0 ? 'is-critical' : 'muted'}>
                    {' · '}plandan %{bicimle(Math.abs(gerceklesen.sapma))}{' '}
                    {gerceklesen.sapma > 0 ? 'fazla' : 'eksik'}
                  </span>
                )}
              </dd>
            </>
          )}
          {isEmri.not && (<><dt>Not</dt><dd>{isEmri.not}</dd></>)}
        </dl>

        {/* ── PLAN ─────────────────────────────────────────────────────── */}
        <div className="section-header compact"><h3>Plan</h3></div>
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Malzeme</th><th className="num">Gerekli</th>
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
            <strong>Bu iş emri başlatılamaz.</strong> Depoda yeterli hammadde yok.
            Planı yazmak serbesttir — yarın gelecek malla üretim planlanabilir —
            ama deftere yazmak eldeki mala bağlıdır.
          </p>
        )}
        {taslak && eksikler.length === 0 && (
          <p className="muted detail-hint">
            Başlatınca bu miktarlar stok defterine <strong>çıkış</strong> olarak
            yazılacak. Lot seçimini sistem yapar: en yakın son kullanma tarihli
            partiden başlar (FEFO).
          </p>
        )}

        {yazabilir && gecisler.length > 0 && (
          <div className="form-actions">
            {gecisler.map(durum => (
              <button
                key={durum}
                className={durum === 'CANCELLED' ? 'btn' : 'btn primary'}
                type="button"
                disabled={calisiyor || (durum === 'STARTED' && eksikler.length > 0)}
                // Kapalı bir düğme, sebebi yazmıyorsa bozuk görünür. Fare
                // üstüne gelince eksik olan malzeme adıyla söyleniyor.
                title={durum === 'STARTED' && eksikler.length > 0
                  ? `Eksik: ${eksikler.map(e => `${e.satir.stokKalemiAd ?? 'malzeme'} ${bicimle(e.eksik)} ${e.birim}`).join(', ')}`
                  : undefined}
                onClick={() => onDurum(durum)}
              >
                {calisiyor ? 'İşleniyor…' : GECIS_ETIKETLERI[durum]}
              </button>
            ))}
          </div>
        )}
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
                <tr><th>Kalem</th><th>Neden</th><th className="num">Miktar</th><th>Lot</th></tr>
              </thead>
              <tbody>
                {hareketler.map(h => (
                  <tr key={h.id}>
                    <td>{kalemAdi(h.stockItemId)}</td>
                    <td className="muted">{HAREKET_ETIKETLERI[h.reason] ?? h.reason}</td>
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
            <strong>Lot sütunu zincirin kendisidir.</strong> “Bu mamulün içinde hangi
            partiler var” sorusu bu satırlardan cevaplanır; ayrı bir soyağacı kaydı
            tutulmuyor, çünkü defterle senkron kalması gereken ikinci bir gerçek
            olurdu.
          </p>
        </section>
      )}

      {/* ── MALİYET ────────────────────────────────────────────────────── */}
      {maliyet && (
        <section className="card">
          <div className="section-header compact"><h3>Üretim maliyeti</h3></div>
          <dl className="detail-grid">
            <dt>Tüketilen hammadde</dt>
            <dd><strong>{para(maliyet.toplamMaliyet)}</strong></dd>
            <dt>{maliyet.gerceklesen === undefined ? 'Planlanan miktara göre birim' : 'Birim maliyet'}</dt>
            <dd>
              <strong>{para(maliyet.birimMaliyet)}</strong> / {maliyet.birim}
              {maliyet.gerceklesen !== undefined && (
                <span className="muted">
                  {' · '}{bicimle(maliyet.gerceklesen)} {maliyet.birim} üretildi
                </span>
              )}
            </dd>
          </dl>
          {maliyet.eksikVeri && (
            <p className="muted detail-hint">
              Tüketilen hammaddelerin bir kısmında <strong>alış fiyatı yok</strong>
              {' '}(elle giriş veya açılış bakiyesi). Bu rakam eksik veriye dayanıyor;
              mamulün maliyeti deftere yazılmadı — yanlış bir sayı, olmayan bir
              sayıdan kötüdür.
            </p>
          )}
          {!maliyet.eksikVeri && (
            <p className="muted detail-hint">
              Verim buraya kendiliğinden giriyor: az mamul çıkarsa aynı para daha az
              birime bölünür ve birim maliyet yükselir. Ayrıca bir düzeltme yok —
              gerçek zaten bu.
            </p>
          )}
        </section>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Yeni iş emri formu
// ═══════════════════════════════════════════════════════════════════════════

type SatirTaslagi = { stokKalemiId: string; miktar: string; birim: string }

const sayiyaCevir = (d: string): number => {
  const n = Number(String(d).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function IsEmriFormu({
  receteler, kalemler, birimler, onerilenNo, onIptal, onKaydet,
}: {
  receteler: Recete[]
  kalemler: KatalogKalemi[]
  birimler: Birim[]
  onerilenNo: string
  onIptal: () => void
  onKaydet: (girdi: YeniIsEmri) => Promise<void>
}){
  const [isEmriNo, setIsEmriNo] = React.useState(onerilenNo)
  const [receteId, setReceteId] = React.useState('')
  const [ciktiKalemiId, setCiktiKalemiId] = React.useState('')
  const [miktar, setMiktar] = React.useState('')
  const [birim, setBirim] = React.useState('')
  const [verim, setVerim] = React.useState('100')
  const [tarih, setTarih] = React.useState(new Date().toISOString().slice(0, 10))
  const [not, setNot] = React.useState('')
  const [satirlar, setSatirlar] = React.useState<SatirTaslagi[]>([])
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  const recete = receteler.find(r => r.id === receteId) ?? null
  const birimKodlari = React.useMemo(() => birimler.map(b => b.kod), [birimler])
  const ciktiKalemi = kalemler.find(k => k.id === ciktiKalemiId)

  /**
   * Reçete seçilince mamul, birim ve verim ondan gelir.
   *
   * Kullanıcının bunları tekrar seçmesini beklemek gereksiz bir adım olurdu;
   * dahası, reçetedekinden farklı bir verim yazarsa iki gerçek doğardı.
   */
  React.useEffect(() => {
    if(!recete) return
    setCiktiKalemiId(recete.ciktiKalemiId)
    setBirim(recete.ciktiBirimi)
    setVerim(String(recete.verim))
    if(miktar === '') setMiktar(String(recete.ciktiMiktari))
  }, [recete])

  /**
   * Miktar ya da reçete değişince satırlar YENİDEN ölçeklenir.
   *
   * Ölçeklenmiş miktarlar iş emrine KOPYALANIR (referans değil): reçete yarın
   * değişse bile bu iş emrinin neye göre planlandığı belli kalır.
   */
  React.useEffect(() => {
    if(!recete) return
    const hedef = sayiyaCevir(miktar)
    if(!(hedef > 0)) return
    try{
      setSatirlar(receteyiIsEmrineDok(receteyiOlcekle(recete, hedef)).map(s => ({
        stokKalemiId: s.stokKalemiId,
        // Gram hassasiyeti (3 hane) yeterli. Ham hesap 60,386473 gibi altı
        // haneli çıkıyor; formda okunmuyor ve kimse yarım miligram tartmıyor.
        miktar: String(Math.round(s.planlananMiktar * 1000) / 1000),
        birim: s.birim,
      })))
    } catch { /* geçersiz miktar; kullanıcı yazmaya devam ediyor */ }
  }, [recete, miktar])

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
            isEmriNo,
            receteId: receteId || undefined,
            ciktiKalemiId,
            planlananMiktar: sayiyaCevir(miktar),
            ciktiBirimi: birim,
            verim: sayiyaCevir(verim),
            planlananTarih: tarih || undefined,
            not: not.trim() || undefined,
            satirlar: satirlar
              .filter(s => s.stokKalemiId !== '' && sayiyaCevir(s.miktar) > 0)
              .map(s => ({
                stokKalemiId: s.stokKalemiId,
                planlananMiktar: sayiyaCevir(s.miktar),
                birim: s.birim,
              })),
          })
        } finally { setGonderiliyor(false) }
      }}
    >
      <div className="form-row">
        <label>
          İş Emri No *
          <input value={isEmriNo} required onChange={e => setIsEmriNo(e.target.value)} />
        </label>
        <label className="narrow">
          Planlanan tarih
          <input type="date" max={enGecTarih} value={tarih}
            onChange={e => setTarih(e.target.value)} />
        </label>
      </div>

      <label>
        Reçete
        <select value={receteId} onChange={e => setReceteId(e.target.value)}>
          <option value="">Reçetesiz (tek seferlik üretim)</option>
          {receteler.map(r => (
            <option key={r.id} value={r.id}>{r.ad} ({r.kod})</option>
          ))}
        </select>
        <small className="muted">
          {receteler.length === 0
            ? 'Yürürlükte reçete yok. Reçeteler ekranından bir tanesini “Yürürlüğe Al” deyin.'
            : 'Reçete seçilince malzemeler istenen miktara göre kendiliğinden ölçeklenir.'}
        </small>
      </label>

      <label>
        Üretilecek mamul *
        <select
          value={ciktiKalemiId} required disabled={!!recete}
          onChange={e => setCiktiKalemiId(e.target.value)}
        >
          <option value="">Seçin…</option>
          {kalemler.map(k => <option key={k.id} value={k.id}>{k.ad} ({k.kod})</option>)}
        </select>
      </label>

      <div className="form-row">
        <label className="narrow">
          Miktar *
          <input type="number" min="0" step="any" value={miktar} required
            onChange={e => setMiktar(e.target.value)} />
        </label>
        <label className="narrow">
          Birim *
          <select value={birim} required disabled={!!recete}
            onChange={e => setBirim(e.target.value)}>
            <option value="">Seçin…</option>
            {(ciktiKalemi ? cevrilebilirBirimler(ciktiKalemi.temelBirim, birimKodlari) : birimKodlari)
              .map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label className="narrow">
          Verim %
          <input type="number" min="1" max="100" step="0.1" value={verim}
            disabled={!!recete} onChange={e => setVerim(e.target.value)} />
        </label>
      </div>

      {satirlar.length === 0 && (
        <p className="muted">
          Malzeme yok. Reçete seçin ya da elle ekleyin — malzemesiz iş emri
          başlatılamaz.
        </p>
      )}

      <div className="purchase-lines">
        {satirlar.map((satir, sira) => {
          const kalem = kalemler.find(k => k.id === satir.stokKalemiId)
          return (
            <div className="purchase-line" key={sira}>
              <div className="form-row">
                <label>
                  Malzeme
                  <select
                    value={satir.stokKalemiId}
                    onChange={e => {
                      const yeni = kalemler.find(k => k.id === e.target.value)
                      guncelle(sira, { stokKalemiId: e.target.value, birim: yeni?.temelBirim ?? '' })
                    }}
                  >
                    <option value="">Seçin…</option>
                    {kalemler.filter(k => k.id !== ciktiKalemiId)
                      .map(k => <option key={k.id} value={k.id}>{k.ad} ({k.kod})</option>)}
                  </select>
                </label>
                <label className="narrow">
                  Miktar
                  <input type="number" min="0" step="any" value={satir.miktar}
                    onChange={e => guncelle(sira, { miktar: e.target.value })} />
                </label>
                <label className="narrow">
                  Birim
                  <select value={satir.birim} onChange={e => guncelle(sira, { birim: e.target.value })}>
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

      <div className="form-actions">
        <button className="btn" type="button"
          onClick={() => setSatirlar(o => [...o, { stokKalemiId: '', miktar: '', birim: '' }])}>
          Malzeme Ekle
        </button>
      </div>

      {recete && (
        <p className="muted detail-hint">
          Miktarlar reçeteden ölçeklendi: verim ve satır firesi dahil edildi.
          Buradaki rakamlar iş emrine <strong>kopyalanır</strong> — reçete sonradan
          değişse bile bu iş emri neye göre planlandığını unutmaz.
        </p>
      )}

      <label>
        Not
        <textarea rows={2} value={not} onChange={e => setNot(e.target.value)} />
      </label>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Kaydediliyor…' : 'İş Emrini Aç'}
        </button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Tamamlama formu
// ═══════════════════════════════════════════════════════════════════════════

type FireTaslagi = { stokKalemiId: string; miktar: string; birim: string; neden: string }

function TamamlamaFormu({
  isEmri, kalemler, birimler, calisiyor, onIptal, onKaydet,
}: {
  isEmri: IsEmri
  kalemler: KatalogKalemi[]
  birimler: Birim[]
  calisiyor: boolean
  onIptal: () => void
  onKaydet: (girdi: TamamlamaGirdisi) => Promise<void>
}){
  const mamul = kalemler.find(k => k.id === isEmri.ciktiKalemiId)
  const [uretilen, setUretilen] = React.useState(String(isEmri.planlananMiktar))
  const [lotKodu, setLotKodu] = React.useState('')
  const [sonKullanma, setSonKullanma] = React.useState('')
  const [not, setNot] = React.useState('')
  const [fireler, setFireler] = React.useState<FireTaslagi[]>([])
  const birimKodlari = React.useMemo(() => birimler.map(b => b.kod), [birimler])

  const sayi = sayiyaCevir(uretilen)
  const sapma = isEmri.planlananMiktar > 0
    ? ((sayi - isEmri.planlananMiktar) / isEmri.planlananMiktar) * 100
    : 0

  const guncelle = (sira: number, yama: Partial<FireTaslagi>) =>
    setFireler(o => o.map((s, i) => (i === sira ? { ...s, ...yama } : s)))

  return (
    <form
      className="stacked-form"
      onSubmit={async event => {
        event.preventDefault()
        await onKaydet({
          uretilenMiktar: sayi,
          lotKodu: lotKodu.trim() || undefined,
          sonKullanma: sonKullanma || undefined,
          not: not.trim() || undefined,
          fireler: fireler
            .filter(f => f.stokKalemiId !== '' && sayiyaCevir(f.miktar) > 0)
            .map(f => ({
              stokKalemiId: f.stokKalemiId,
              miktar: sayiyaCevir(f.miktar),
              birim: f.birim,
              neden: f.neden.trim() || undefined,
            })),
        })
      }}
    >
      <label>
        Kazandan kaç {isEmri.ciktiBirimi} çıktı? *
        <input type="number" min="0" step="any" value={uretilen} required
          onChange={e => setUretilen(e.target.value)} />
        <small className="muted">
          Plan {bicimle(isEmri.planlananMiktar)} {isEmri.ciktiBirimi} idi.
          {sayi > 0 && Math.abs(sapma) >= 0.05 && (
            <> Gerçekleşen <strong>%{bicimle(Math.abs(sapma))}</strong>{' '}
            {sapma > 0 ? 'fazla' : 'eksik'}.</>
          )}
          {' '}Plandan kopyalamıyoruz: asıl verim, gerçekte çıkan miktardır.
        </small>
      </label>

      {mamul?.lotTakipli && (
        <div className="form-row">
          <label>
            Lot kodu *
            <input value={lotKodu} required placeholder="MML-2026-001"
              onChange={e => setLotKodu(e.target.value)} />
          </label>
          {mamul.sktTakipli && (
            <label className="narrow">
              Son kullanma *
              <input type="date" max={enGecTarih} value={sonKullanma} required
                onChange={e => setSonKullanma(e.target.value)} />
            </label>
          )}
        </div>
      )}

      <div className="section-header compact"><h3>Üretim firesi</h3></div>
      <p className="muted detail-hint">
        Üretim sırasında <strong>zayi olan</strong> hammadde. Planlı tüketimden
        ayrı yazılır: “reçeteye göre kullandık” ile “yere döktük” aynı satıra
        düşerse fire oranı hiç görünmez ve iyileştirilemez.
      </p>

      {fireler.length === 0 && (
        <p className="muted">
          Fire yoksa bir şey yapmayın. Varsa aşağıdan ekleyin.
        </p>
      )}

      {fireler.length > 0 && (
      <div className="purchase-lines">
        {fireler.map((fire, sira) => {
          const kalem = kalemler.find(k => k.id === fire.stokKalemiId)
          return (
            <div className="purchase-line" key={sira}>
              <div className="form-row">
                <label>
                  Malzeme
                  <select
                    value={fire.stokKalemiId}
                    onChange={e => {
                      const yeni = kalemler.find(k => k.id === e.target.value)
                      guncelle(sira, { stokKalemiId: e.target.value, birim: yeni?.temelBirim ?? '' })
                    }}
                  >
                    <option value="">Seçin…</option>
                    {isEmri.satirlar.map(s => (
                      <option key={s.stokKalemiId} value={s.stokKalemiId}>
                        {s.stokKalemiAd ?? s.stokKalemiId}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="narrow">
                  Miktar
                  <input type="number" min="0" step="any" value={fire.miktar}
                    onChange={e => guncelle(sira, { miktar: e.target.value })} />
                </label>
                <label className="narrow">
                  Birim
                  <select value={fire.birim} onChange={e => guncelle(sira, { birim: e.target.value })}>
                    <option value="">—</option>
                    {(kalem ? cevrilebilirBirimler(kalem.temelBirim, birimKodlari) : [])
                      .map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </label>
                <button className="btn" type="button"
                  onClick={() => setFireler(o => o.filter((_, i) => i !== sira))}>
                  Sil
                </button>
              </div>
              <label>
                Gerekçe
                <input value={fire.neden} placeholder="Yere döküldü, kazan dibi"
                  onChange={e => guncelle(sira, { neden: e.target.value })} />
              </label>
            </div>
          )
        })}
      </div>
      )}

      <div className="form-actions">
        <button className="btn" type="button"
          onClick={() => setFireler(o => [...o, { stokKalemiId: '', miktar: '', birim: '', neden: '' }])}>
          Fire Ekle
        </button>
      </div>

      <label>
        Not
        <textarea rows={2} value={not} onChange={e => setNot(e.target.value)} />
      </label>

      <p className="muted detail-hint">
        Tamamlayınca mamul stok defterine <strong>giriş</strong> olarak yazılır ve
        yeni lotu açılır. Lotun kaynağı “üretim” olur — satın alınmadığı,
        üretildiği defterde belli olur.
      </p>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={calisiyor || !(sayi > 0)}>
          {calisiyor ? 'Deftere işleniyor…' : 'Üretimi Tamamla'}
        </button>
      </div>
    </form>
  )
}
