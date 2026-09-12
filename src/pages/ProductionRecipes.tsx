// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 / Üretim — Reçeteler ekranı
//
// Yol haritası maddesi: "Reçete yönetimi gerçek veriye bağlı"
//                       Bitti sayılır ki: "Reçete kalemleri stok kartlarına bağlı"
//
// ── EKRANIN ASIL İDDİASI ─────────────────────────────────────────────────
// Sağdaki panelde bir "Üretim provası" var: kaç porsiyon üreteceğini yaz,
// ekran o anki DEPO BAKİYESİNE bakıp neyin yetip neyin yetmediğini söylesin.
//
// Bu, reçete satırının stok kartına bağlı olmasının tek görünür kanıtı.
// Satır serbest metin olsaydı ("2 kg soğan") bu paneli yazmak mümkün olmazdı;
// ekran hangi soğana bakacağını bilemezdi.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { createStockRepository, resolveStockRepositoryMode } from '../core/stock/index'
import { InMemoryStockItemLookup } from '../core/stock/stock-item-lookup'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import { PostgresStokKatalogu, type Birim, type KatalogKalemi } from '../warehouse/warehouse.catalog'
import { DepoServisi, cevrilebilirBirimler, type DepoKalemi } from '../warehouse/warehouse.service'
import {
  PostgresReceteDeposu,
  RECETE_DURUM_ETIKETLERI,
  RECETE_GECISLERI,
  type Recete,
  type ReceteDurumu,
  type ReceteGirdisi,
} from '../production/recipe.repository'
import {
  ReceteServisi,
  donguVarMi,
  hepsiYeterli,
  receteyiOlcekle,
  yeterliligiHesapla,
  type YeterlilikSatiri,
} from '../production/recipe.service'

type Props = { currentUser: User }

const sayiBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 })
const bicimle = (deger: number) => sayiBicimi.format(deger)
const hataMetni = (h: unknown) => (h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.')

const durumSinifi = (durum: ReceteDurumu) =>
  durum === 'ACTIVE' ? 'success-pill' : durum === 'DRAFT' ? 'warning-pill' : 'muted-pill'

export default function ProductionRecipes({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  const yazabilir = !currentUser.permissions || currentUser.permissions.includes('production.write')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [receteler, setReceteler] = React.useState<Recete[]>([])
  const [kalemler, setKalemler] = React.useState<KatalogKalemi[]>([])
  const [birimler, setBirimler] = React.useState<Birim[]>([])
  const [bakiyeler, setBakiyeler] = React.useState<DepoKalemi[]>([])
  const [seciliId, setSeciliId] = React.useState<string | null>(null)
  const [duzenleme, setDuzenleme] = React.useState<Recete | 'yeni' | null>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const servis = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new ReceteServisi(new PostgresReceteDeposu(getSupabase()))
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
    const [r, b] = await Promise.all([servis.hepsi(aktif.ctx), depoServisi.kalemler(aktif.ctx)])
    setReceteler(r)
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
        const [r, kl, bl, bk] = await Promise.all([
          servis.hepsi(kurulan.ctx),
          katalog.kalemler(kurulan.ctx),
          katalog.birimler(),
          depoServisi.kalemler(kurulan.ctx),
        ])
        if(iptal) return
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

  const secili = receteler.find(r => r.id === seciliId) ?? null

  /** Bakiyeler TEMEL birimde — yeterlilik hesabı çevirmeyi kendisi yapar. */
  const bakiyeHaritasi = React.useMemo(
    () => new Map(bakiyeler.map(b => [b.id, b.miktar])),
    [bakiyeler],
  )

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Reçeteler</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>Reçete kalemleri stok kartlarına bağlıdır; kartlar veritabanında durur.</p>
        </section>
      </div>
    )
  }

  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Reçeteler</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }

  if(!baglam){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Reçeteler</h2></div></div>
        <section className="card empty-state">{hata || 'Çalışma alanı çözülemedi.'}</section>
      </div>
    )
  }

  const kaydet = async (girdi: ReceteGirdisi) => {
    try{
      // Dolaylı döngü kontrolü kaydetmeden ÖNCE: A'nın içinde B, B'nin
      // içinde A olursa ölçekleme sonsuza kadar dönerdi.
      const dongu = donguVarMi(
        girdi.ciktiKalemiId,
        girdi.satirlar.map(s => s.stokKalemiId),
        receteler.filter(r => r.id !== (duzenleme === 'yeni' ? '' : duzenleme?.id)),
      )
      if(dongu){
        setHata(`Bu reçete bir döngü oluşturuyor: "${dongu}" zaten bu mamulü içeriyor.`)
        return
      }

      const kayit = duzenleme === 'yeni' || !duzenleme
        ? await servis!.ekle(baglam.ctx, girdi, receteler)
        : await servis!.guncelle(baglam.ctx, duzenleme, girdi, receteler)

      setSeciliId(kayit.id)
      setDuzenleme(null)
      setHata('')
      setBilgi(`"${kayit.ad}" kaydedildi.`)
      await yenile(baglam)
    } catch (e) { setHata(hataMetni(e)) }
  }

  const durumDegistir = async (recete: Recete, durum: ReceteDurumu) => {
    try{
      const guncel = await servis!.durumDegistir(baglam.ctx, recete, durum)
      setHata('')
      setBilgi(`${guncel.ad}: ${RECETE_DURUM_ETIKETLERI[guncel.durum]}.`)
      await yenile(baglam)
    } catch (e) { setHata(hataMetni(e)) }
  }

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Reçeteler</h2>
          <p className="muted">Aşama 3 · Her satır bir stok kartına bağlı</p>
        </div>
        {yazabilir && (
          <button
            className="btn primary"
            onClick={() => { setDuzenleme('yeni'); setHata(''); setBilgi('') }}
          >
            Yeni Reçete
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
                  <th>Kod</th><th>Ad</th><th>Üretilen</th>
                  <th className="num">Çıktı</th><th className="num">Verim</th>
                  <th className="num">Malzeme</th><th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {receteler.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      Henüz reçete yok. Bir reçete, hangi mamulün hangi stok
                      kalemlerinden yapıldığını söyler — üretim iş emri bunun
                      üzerine kurulur.
                    </td>
                  </tr>
                )}
                {receteler.map(recete => (
                  <tr
                    key={recete.id}
                    className={recete.id === seciliId ? 'is-selected' : ''}
                    onClick={() => { setSeciliId(recete.id); setDuzenleme(null) }}
                  >
                    <td>{recete.kod}</td>
                    <td>{recete.ad}</td>
                    <td className="muted">{recete.ciktiKalemiAd ?? '—'}</td>
                    <td className="num">{bicimle(recete.ciktiMiktari)} {recete.ciktiBirimi}</td>
                    <td className={`num ${recete.verim < 100 ? '' : 'muted'}`}>%{bicimle(recete.verim)}</td>
                    <td className="num muted">{recete.satirlar.length}</td>
                    <td>
                      <span className={`status-pill ${durumSinifi(recete.durum)}`}>
                        {RECETE_DURUM_ETIKETLERI[recete.durum]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="warehouse-side">
          {duzenleme && (
            <section className="card">
              <div className="section-header compact">
                <h3>{duzenleme === 'yeni' ? 'Yeni Reçete' : duzenleme.ad}</h3>
              </div>
              <ReceteFormu
                baslangic={duzenleme === 'yeni' ? null : duzenleme}
                kalemler={kalemler}
                birimler={birimler}
                onIptal={() => setDuzenleme(null)}
                onKaydet={kaydet}
              />
            </section>
          )}

          {!duzenleme && secili && (
            <>
              <ReceteDetayi
                recete={secili}
                yazabilir={yazabilir}
                onDuzenle={() => { setDuzenleme(secili); setHata('') }}
                onDurum={durum => { void durumDegistir(secili, durum) }}
              />
              <UretimProvasi
                recete={secili}
                kalemler={kalemler}
                bakiyeler={bakiyeHaritasi}
              />
            </>
          )}

          {!duzenleme && !secili && (
            <section className="card empty-state">
              Bir reçete seçin: malzemelerini, verimini ve
              <strong> depoda şu an yetip yetmediğini </strong>
              burada göreceksiniz.
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

function ReceteDetayi({
  recete, yazabilir, onDuzenle, onDurum,
}: {
  recete: Recete
  yazabilir: boolean
  onDuzenle: () => void
  onDurum: (durum: ReceteDurumu) => void
}){
  const gecisler = RECETE_GECISLERI[recete.durum]

  return (
    <section className="card">
      <div className="section-header compact">
        <h3>{recete.kod}</h3>
        <span className={`status-pill ${durumSinifi(recete.durum)}`}>
          {RECETE_DURUM_ETIKETLERI[recete.durum]}
        </span>
      </div>

      <dl className="detail-grid">
        <dt>Üretilen</dt><dd>{recete.ciktiKalemiAd ?? '—'}</dd>
        <dt>Çıktı</dt><dd>{bicimle(recete.ciktiMiktari)} {recete.ciktiBirimi}</dd>
        <dt>Verim</dt>
        <dd>
          %{bicimle(recete.verim)}
          {recete.verim < 100 && (
            <span className="muted">
              {' · '}girdinin %{bicimle(100 - recete.verim)}’i pişirmede kayboluyor
            </span>
          )}
        </dd>
        {recete.not && (<><dt>Not</dt><dd>{recete.not}</dd></>)}
      </dl>

      <div className="table-wrap">
        <table className="data-table compact">
          <thead>
            <tr><th>Malzeme</th><th className="num">Miktar</th><th>Birim</th><th className="num">Fire</th></tr>
          </thead>
          <tbody>
            {recete.satirlar.map(satir => (
              <tr key={satir.id}>
                <td>
                  {satir.stokKalemiAd ?? satir.stokKalemiId}
                  {satir.stokKalemiKod && <span className="muted"> · {satir.stokKalemiKod}</span>}
                </td>
                <td className="num">{bicimle(satir.miktar)}</td>
                <td className="muted">{satir.birim}</td>
                <td className={`num ${satir.firePayi > 0 ? '' : 'muted'}`}>
                  {satir.firePayi > 0 ? `%${bicimle(satir.firePayi)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted detail-hint">
        Her satır bir <strong>stok kartına</strong> bağlıdır, serbest metne değil.
        Bu yüzden sistem “depoda var mı”, “kaç liraya mal olur” sorularını
        cevaplayabiliyor.
      </p>

      {yazabilir && (
        <div className="form-actions">
          {recete.durum !== 'ARCHIVED' && (
            <button className="btn" type="button" onClick={onDuzenle}>Düzenle</button>
          )}
          {gecisler.map(durum => (
            <button
              key={durum}
              className={durum === 'ACTIVE' ? 'btn primary' : 'btn'}
              type="button"
              onClick={() => onDurum(durum)}
            >
              {durum === 'ACTIVE' ? 'Yürürlüğe Al' : 'Arşivle'}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Üretim provası — kriterin görünür kanıtı
// ═══════════════════════════════════════════════════════════════════════════

function UretimProvasi({
  recete, kalemler, bakiyeler,
}: {
  recete: Recete
  kalemler: KatalogKalemi[]
  bakiyeler: ReadonlyMap<string, number>
}){
  const [hedef, setHedef] = React.useState(String(recete.ciktiMiktari))

  React.useEffect(() => { setHedef(String(recete.ciktiMiktari)) }, [recete.id, recete.ciktiMiktari])

  const sayi = Number(hedef.replace(',', '.'))
  const gecerli = Number.isFinite(sayi) && sayi > 0

  let satirlar: YeterlilikSatiri[] = []
  let coz = ''
  if(gecerli){
    try{
      satirlar = yeterliligiHesapla(receteyiOlcekle(recete, sayi), bakiyeler, kalemler)
    } catch (e) { coz = hataMetni(e) }
  }

  const yeterli = hepsiYeterli(satirlar)

  return (
    <section className="card">
      <div className="section-header compact">
        <h3>Üretim provası</h3>
        {gecerli && satirlar.length > 0 && (
          <span className={`status-pill ${yeterli ? 'success-pill' : 'warning-pill'}`}>
            {yeterli ? 'Stok yeterli' : 'Eksik var'}
          </span>
        )}
      </div>

      <label>
        Kaç {recete.ciktiBirimi} üretilecek?
        <input
          type="number" min="0" step="any" value={hedef}
          onChange={e => setHedef(e.target.value)}
        />
      </label>

      {!gecerli && <p className="muted">Bir miktar yazın.</p>}
      {coz !== '' && <div className="form-error">{coz}</div>}

      {gecerli && satirlar.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Malzeme</th><th className="num">Gerekli</th>
                  <th className="num">Depoda</th><th className="num">Eksik</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map(s => (
                  <tr key={s.satir.id}>
                    <td>{s.satir.stokKalemiAd ?? s.satir.stokKalemiId}</td>
                    <td className="num">
                      {bicimle(s.brutMiktar)} {s.birim}
                      {s.satir.firePayi > 0 && (
                        <span className="muted"> · fire dahil</span>
                      )}
                    </td>
                    <td className={`num ${s.cevrilemedi ? 'muted' : ''}`}>
                      {s.cevrilemedi ? '?' : bicimle(s.eldeki)}
                    </td>
                    <td className={`num ${s.yeterli ? 'muted' : 'is-critical'}`}>
                      {s.cevrilemedi ? '—' : s.yeterli ? '—' : bicimle(s.eksik)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {satirlar.some(s => s.cevrilemedi) && (
            <p className="muted detail-hint">
              Bazı satırlarda birim çevrilemedi (örneğin kg ile adet). Bu satırlar
              <strong> yeterli sayılmadı</strong> — “bilmiyorum”u “sorun yok”
              saymak üretimi yarıda bırakır.
            </p>
          )}

          <p className="muted detail-hint">
            “Depoda” sütunu <strong>defterden</strong> geliyor; hiçbir yerde ayrıca
            saklanmıyor. {recete.verim < 100 && (
              <>Verim %{bicimle(recete.verim)} olduğu için gerekli miktarlar
              çıktının oranından fazladır.</>
            )}
          </p>
        </>
      )}
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Form
// ═══════════════════════════════════════════════════════════════════════════

type SatirTaslagi = { stokKalemiId: string; miktar: string; birim: string; firePayi: string }
const BOS_SATIR: SatirTaslagi = { stokKalemiId: '', miktar: '', birim: '', firePayi: '' }

const sayiyaCevir = (deger: string): number => {
  const n = Number(String(deger).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function ReceteFormu({
  baslangic, kalemler, birimler, onIptal, onKaydet,
}: {
  baslangic: Recete | null
  kalemler: KatalogKalemi[]
  birimler: Birim[]
  onIptal: () => void
  onKaydet: (girdi: ReceteGirdisi) => Promise<void>
}){
  const [kod, setKod] = React.useState(baslangic?.kod ?? '')
  const [ad, setAd] = React.useState(baslangic?.ad ?? '')
  const [ciktiKalemiId, setCiktiKalemiId] = React.useState(baslangic?.ciktiKalemiId ?? '')
  const [ciktiMiktari, setCiktiMiktari] = React.useState(String(baslangic?.ciktiMiktari ?? ''))
  const [ciktiBirimi, setCiktiBirimi] = React.useState(baslangic?.ciktiBirimi ?? '')
  const [verim, setVerim] = React.useState(String(baslangic?.verim ?? 100))
  const [not, setNot] = React.useState(baslangic?.not ?? '')
  const [satirlar, setSatirlar] = React.useState<SatirTaslagi[]>(
    baslangic
      ? baslangic.satirlar.map(s => ({
          stokKalemiId: s.stokKalemiId, miktar: String(s.miktar),
          birim: s.birim, firePayi: s.firePayi > 0 ? String(s.firePayi) : '',
        }))
      : [{ ...BOS_SATIR }],
  )
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  const ciktiKalemi = kalemler.find(k => k.id === ciktiKalemiId)
  // `cevrilebilirBirimler` kod listesi bekliyor, nesne listesi değil.
  const birimKodlari = React.useMemo(() => birimler.map(b => b.kod), [birimler])

  // Çıktı birimi seçilmemişse mamulün temel biriminden başlat — kullanıcının
  // her seferinde aynı şeyi seçmesini beklemek gereksiz bir adım.
  React.useEffect(() => {
    if(ciktiKalemi && ciktiBirimi === '') setCiktiBirimi(ciktiKalemi.temelBirim)
  }, [ciktiKalemi, ciktiBirimi])

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
            kod, ad, ciktiKalemiId,
            ciktiMiktari: sayiyaCevir(ciktiMiktari),
            ciktiBirimi,
            verim: sayiyaCevir(verim),
            not: not.trim() || undefined,
            satirlar: satirlar
              .filter(s => s.stokKalemiId !== '')
              .map(s => ({
                stokKalemiId: s.stokKalemiId,
                miktar: sayiyaCevir(s.miktar),
                birim: s.birim,
                firePayi: s.firePayi === '' ? 0 : sayiyaCevir(s.firePayi),
              })),
          })
        } finally { setGonderiliyor(false) }
      }}
    >
      <div className="form-row">
        <label>
          Kod *
          <input value={kod} required onChange={e => setKod(e.target.value)} />
        </label>
        <label>
          Ad *
          <input value={ad} required onChange={e => setAd(e.target.value)} />
        </label>
      </div>

      <label>
        Üretilen mamul *
        <select value={ciktiKalemiId} required onChange={e => setCiktiKalemiId(e.target.value)}>
          <option value="">Seçin…</option>
          {kalemler.map(k => (
            <option key={k.id} value={k.id}>{k.ad} ({k.kod})</option>
          ))}
        </select>
        <small className="muted">
          Mamul de bir stok kartıdır: üretildiği anda stoktur, sevk edilir, sayılır.
        </small>
      </label>

      <div className="form-row">
        <label className="narrow">
          Çıktı miktarı *
          <input
            type="number" min="0" step="any" value={ciktiMiktari} required
            onChange={e => setCiktiMiktari(e.target.value)}
          />
        </label>
        <label className="narrow">
          Birim *
          <select value={ciktiBirimi} required onChange={e => setCiktiBirimi(e.target.value)}>
            <option value="">Seçin…</option>
            {(ciktiKalemi
              ? cevrilebilirBirimler(ciktiKalemi.temelBirim, birimKodlari)
              : birimler.map(b => b.kod)
            ).map(kod => <option key={kod} value={kod}>{kod}</option>)}
          </select>
        </label>
        <label className="narrow">
          Verim %
          <input
            type="number" min="1" max="100" step="0.1" value={verim}
            onChange={e => setVerim(e.target.value)}
          />
        </label>
      </div>
      <small className="muted">
        Reçete bu miktar için yazılır; iş emri ölçekler. Verim, pişirmede kaybolan
        payı anlatır — malzemenin kendi firesi aşağıda, satır satır girilir.
      </small>

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
                      guncelle(sira, {
                        stokKalemiId: e.target.value,
                        birim: yeni?.temelBirim ?? '',
                      })
                    }}
                  >
                    <option value="">Seçin…</option>
                    {kalemler
                      .filter(k => k.id !== ciktiKalemiId)
                      .map(k => <option key={k.id} value={k.id}>{k.ad} ({k.kod})</option>)}
                  </select>
                </label>
                <label className="narrow">
                  Miktar
                  <input
                    type="number" min="0" step="any" value={satir.miktar}
                    onChange={e => guncelle(sira, { miktar: e.target.value })}
                  />
                </label>
                <label className="narrow">
                  Birim
                  <select value={satir.birim} onChange={e => guncelle(sira, { birim: e.target.value })}>
                    <option value="">—</option>
                    {(kalem ? cevrilebilirBirimler(kalem.temelBirim, birimKodlari) : [])
                      .map(kod => <option key={kod} value={kod}>{kod}</option>)}
                  </select>
                </label>
                <label className="narrow">
                  Fire %
                  <input
                    type="number" min="0" max="99.9" step="0.1" value={satir.firePayi}
                    placeholder="0"
                    onChange={e => guncelle(sira, { firePayi: e.target.value })}
                  />
                </label>
                {satirlar.length > 1 && (
                  <button
                    className="btn" type="button"
                    onClick={() => setSatirlar(o => o.filter((_, i) => i !== sira))}
                  >
                    Sil
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="form-actions">
        <button className="btn" type="button" onClick={() => setSatirlar(o => [...o, { ...BOS_SATIR }])}>
          Malzeme Ekle
        </button>
      </div>

      <label>
        Not
        <textarea rows={2} value={not} onChange={e => setNot(e.target.value)} />
      </label>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}
