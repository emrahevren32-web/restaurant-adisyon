// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3.5 / Endüstriyel mutfak kapsamı — HACCP ekranı
//
// Yol haritası (A3.5): "HACCP · sıcaklık ölçümü ve düzeltici faaliyet"
//   Bitti sayılır ki: "Limit aşılınca kayıt kendiliğinden uygunsuzluk açıyor
//   ve ölçüm partiye bağlıysa geri çağırma listesinden görülüyor"
//
// ── EKRANIN İDDİASI ──────────────────────────────────────────────────────
// Kağıtta da sıcaklık yazılır. Fark, yazılanın DEĞERLENDİRİLMESİ:
//
//   1. Değer yazılırken ekran anında "uygun / UYGUN DEĞİL" diyor — kimse
//      limiti hatırlamak zorunda değil.
//   2. Uygun değilse kayıt yazılırken düzeltici faaliyet KENDİLİĞİNDEN
//      açılıyor; "yazdım ama ne yaptığımı yazmadım" boşluğu kapanıyor.
//   3. Ölçüm bir partiye bağlanabiliyor. Bağlandığında o parti
//      İzlenebilirlik ekranında "soğuk zincir kırılmış" olarak görünüyor —
//      geri çağırma listesi bunu görüyor.
//
// Üçüncüsü sahte veriyle asla yapılamaz: uydurma bir kayıt gerçek bir
// partiye bağlanamaz. Bu ekranın mock olan eskisinden farkı budur.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { resolveStockRepositoryMode } from '../core/stock/index'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import {
  PostgresStokKatalogu, type KatalogKalemi, type KatalogLotu,
} from '../warehouse/warehouse.catalog'
import { PostgresMalKabulDeposu } from '../purchasing/goods-receipt.repository'
import type { Kabul } from '../purchasing/goods-receipt.repository'
import { PostgresIsEmriDeposu, type IsEmri } from '../production/work-order.repository'
import {
  ASAMA_ETIKETLERI, FAALIYET_ETIKETLERI, PostgresHaccpDeposu, TEHLIKE_ETIKETLERI,
  type Ccp, type DuzelticiFaaliyet, type Olcum, type OlcumKaynagi, type UretimAsamasi,
} from '../quality/haccp.repository'
import {
  HaccpServisi, haccpOzeti, limitOzeti, sapmaMetni, sonucHesapla,
} from '../quality/haccp.service'
import { ccpPlaniHtml, olcumKayitFormuHtml } from '../quality/haccp-documents'
import { belgeYazdir } from '../core/print/print'

type Props = { currentUser: User }

const sayiBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })
const bicimle = (d: number) => sayiBicimi.format(d)
const hataMetni = (h: unknown) => (h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.')

const zamanBicimle = (d?: string) => {
  if(!d) return '—'
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleString('tr-TR')
}

const sayiyaCevir = (d: string): number => Number(String(d).replace(',', '.'))

/** Aşamaların üretim akışındaki sırası — menüde ve listede bu sırayla. */
const ASAMA_SIRASI: UretimAsamasi[] = [
  'RECEIVING', 'STORAGE', 'PREPARATION', 'COOKING',
  'BLAST_CHILLING', 'HOT_HOLDING', 'PACKAGING', 'LABELING', 'DISPATCH',
]

const KAYNAK_ETIKETLERI: Record<OlcumKaynagi, string> = {
  goods_receipt: 'Mal kabul',
  work_order: 'İş emri',
  cold_room: 'Soğuk oda',
  shipment: 'Sevkiyat',
  manual: 'Serbest kayıt',
}

export default function Haccp({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  const yazabilir = !currentUser.permissions
    || currentUser.permissions.includes('quality.write')
    || currentUser.permissions.includes('stock.write')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [ccpler, setCcpler] = React.useState<Ccp[]>([])
  const [olcumler, setOlcumler] = React.useState<Olcum[]>([])
  const [faaliyetler, setFaaliyetler] = React.useState<DuzelticiFaaliyet[]>([])
  const [kalemler, setKalemler] = React.useState<KatalogKalemi[]>([])
  const [kabuller, setKabuller] = React.useState<Kabul[]>([])
  const [isEmirleri, setIsEmirleri] = React.useState<IsEmri[]>([])
  const [seciliCcpId, setSeciliCcpId] = React.useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [calisiyor, setCalisiyor] = React.useState(false)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const servis = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new HaccpServisi(new PostgresHaccpDeposu(getSupabase()))
  }, [mod])

  const yenile = React.useCallback(async (aktif: DepoBaglami) => {
    if(!servis) return
    const [o, f] = await Promise.all([
      servis.olcumler(aktif.ctx, 200),
      servis.faaliyetler(aktif.ctx),
    ])
    setOlcumler(o)
    setFaaliyetler(f)
  }, [servis])

  React.useEffect(() => {
    let iptal = false
    if(!servis){ setYukleniyor(false); return }

    ;(async () => {
      try{
        const kurulan = await depoBaglamiKur(getSupabase())
        if(iptal) return
        setBaglam(kurulan)

        const client = getSupabase()
        const katalog = new PostgresStokKatalogu(client)
        const [c, o, f, kl, mk, ie] = await Promise.all([
          servis.ccpler(kurulan.ctx),
          servis.olcumler(kurulan.ctx, 200),
          servis.faaliyetler(kurulan.ctx),
          katalog.kalemler(kurulan.ctx),
          new PostgresMalKabulDeposu(client).hepsi(kurulan.ctx),
          new PostgresIsEmriDeposu(client).hepsi(kurulan.ctx),
        ])
        if(iptal) return
        setCcpler(c)
        setOlcumler(o)
        setFaaliyetler(f)
        setKalemler(kl.filter(k => k.aktif))
        setKabuller(mk)
        setIsEmirleri(ie)
      } catch (e) {
        if(!iptal) setHata(hataMetni(e))
      } finally {
        if(!iptal) setYukleniyor(false)
      }
    })()

    return () => { iptal = true }
  }, [servis])

  const secili = ccpler.find(c => c.id === seciliCcpId) ?? null
  const ozet = React.useMemo(() => haccpOzeti(olcumler, faaliyetler), [olcumler, faaliyetler])
  const faaliyetHaritasi = React.useMemo(
    () => new Map(faaliyetler.map(f => [f.olcumId, f])),
    [faaliyetler],
  )
  const acikFaaliyetler = faaliyetler.filter(
    f => f.durum === 'OPEN' || f.durum === 'IN_PROGRESS',
  )

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>HACCP</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>HACCP kaydı yasal kayıttır; tarayıcı hafızasında tutulamaz.</p>
        </section>
      </div>
    )
  }

  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>HACCP</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }

  if(!baglam || !servis){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>HACCP</h2></div></div>
        <section className="card empty-state">{hata || 'Çalışma alanı çözülemedi.'}</section>
      </div>
    )
  }

  const subeAdi = baglam.subeler.find(s => s.id === baglam.ctx.branchId)?.ad

  const olcumKaydet = async (
    ccp: Ccp,
    deger: number,
    kaynakTipi: OlcumKaynagi,
    kaynakId?: string,
    lotId?: string,
    stokKalemiId?: string,
    not?: string,
  ) => {
    setCalisiyor(true)
    try{
      const { olcum, faaliyet } = await servis.olcumEkle(baglam.ctx, ccp, {
        ccpId: ccp.id, deger, kaynakTipi, kaynakId, lotId, stokKalemiId, not,
      })
      setHata('')
      setBilgi(
        olcum.sonuc === 'PASS'
          ? `${ccp.kod} · ${bicimle(deger)} ${ccp.birim} kaydedildi. Limit içinde.`
          : `${ccp.kod} · ${bicimle(deger)} ${ccp.birim} KRİTİK LİMİTİ AŞTI. `
            + `Düzeltici faaliyet kendiliğinden açıldı${faaliyet?.atananRol ? ` (${faaliyet.atananRol})` : ''}.`,
      )
      await yenile(baglam)
    } catch (e) { setHata(hataMetni(e)); setBilgi('') }
    finally { setCalisiyor(false) }
  }

  const faaliyetKapat = async (faaliyet: DuzelticiFaaliyet) => {
    const yapilan = window.prompt(
      'Ne yapıldı? Bu metin denetim kaydına girer.\n\n'
      + faaliyet.aciklama,
    )
    if(yapilan === null) return
    setCalisiyor(true)
    try{
      await servis.faaliyetiKapat(baglam.ctx, faaliyet, yapilan)
      setHata('')
      setBilgi('Düzeltici faaliyet kapatıldı, yapılan işlem kayda geçti.')
      await yenile(baglam)
    } catch (e) { setHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  const olcumIptal = async (olcum: Olcum) => {
    const gerekce = window.prompt(
      'İptal gerekçesi zorunludur.\n\n'
      + 'Kayıt SİLİNMEZ; iptal olarak durur ve gerekçesi denetimde görünür.',
    )
    if(gerekce === null) return
    setCalisiyor(true)
    try{
      await servis.olcumIptalEt(baglam.ctx, olcum, gerekce)
      setHata('')
      setBilgi('Ölçüm iptal edildi. Kayıt gerekçesiyle duruyor.')
      await yenile(baglam)
    } catch (e) { setHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>HACCP · Kritik Kontrol Noktaları</h2>
          <p className="muted">
            Aşama 3.5 · Limit aşılınca kayıt kendiliğinden uygunsuzluk açar
          </p>
        </div>
        <div>
          <button
            className="btn" type="button"
            onClick={() => belgeYazdir('HACCP planı', ccpPlaniHtml(ccpler, subeAdi))}
          >
            HACCP Planı · Yazdır / PDF
          </button>
          <button
            className="btn" type="button"
            onClick={() => belgeYazdir(
              'HACCP izleme kayıtları',
              olcumKayitFormuHtml(olcumler, faaliyetler, subeAdi),
            )}
          >
            İzleme Kayıtları · Yazdır / PDF
          </button>
        </div>
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-info">{bilgi}</div>}

      {/* ── BUGÜNÜN DURUMU — hepsi gerçek kayıtlardan ──────────────────── */}
      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Bugün ölçüm</span>
          <strong>{ozet.bugunOlcum}</strong>
          <p className="muted">{ccpler.filter(c => c.durum === 'ACTIVE').length} aktif kontrol noktası</p>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Uygun</span>
          <strong>{ozet.bugunUygun}</strong>
          <p className="muted">
            {ozet.bugunOlcum === 0 ? 'bugün ölçüm yok' : `%${ozet.uygunlukYuzdesi} uygunluk`}
          </p>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Uygun değil</span>
          <strong className={ozet.bugunUygunsuz > 0 ? 'is-critical' : undefined}>
            {ozet.bugunUygunsuz}
          </strong>
          <p className="muted">kritik limit aşımı</p>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Açık düzeltici faaliyet</span>
          <strong className={ozet.acikFaaliyet > 0 ? 'is-critical' : undefined}>
            {ozet.acikFaaliyet}
          </strong>
          <p className="muted">kapanmayı bekliyor</p>
        </div>
      </div>

      {/* ── AÇIK FAALİYETLER — en üstte, çünkü bekleyen iş budur ───────── */}
      {acikFaaliyetler.length > 0 && (
        <section className="card">
          <div className="section-header compact">
            <h3>Kapanmayı bekleyen düzeltici faaliyetler</h3>
            <span className="status-pill warning-pill">{acikFaaliyetler.length}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr><th>Ne oldu</th><th>Sorumlu</th><th>Durum</th><th></th></tr>
              </thead>
              <tbody>
                {acikFaaliyetler.map(f => (
                  <tr key={f.id}>
                    <td>{f.aciklama}</td>
                    <td className="muted">{f.atananRol ?? '—'}</td>
                    <td>
                      <span className="status-pill warning-pill">
                        {FAALIYET_ETIKETLERI[f.durum]}
                      </span>
                    </td>
                    <td className="actions-cell">
                      {yazabilir && (
                        <button className="btn" type="button" disabled={calisiyor}
                          onClick={() => { void faaliyetKapat(f) }}>
                          Kapat
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted detail-hint">
            Bir faaliyet <strong>ne yapıldığı yazılmadan</strong> kapatılamaz.
            Boş kapanış, kapanmamış bir faaliyetten kötüdür: liste temiz görünür,
            yapılan iş kayıtsız kalır.
          </p>
        </section>
      )}

      <div className="warehouse-layout">
        <section className="card warehouse-main">
          <div className="section-header compact">
            <h3>Kontrol noktaları</h3>
            <span className="muted">ölçüm girmek için satıra tıklayın</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kod</th><th>Kontrol noktası</th>
                  <th>Kritik limit</th><th>Son ölçüm</th>
                </tr>
              </thead>
              <tbody>
                {ccpler.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Kontrol noktası yok. 0024 göçü çalıştırıldığında endüstriyel
                      mutfağın sekiz kritik noktası hazır gelir.
                    </td>
                  </tr>
                )}
                {ASAMA_SIRASI.filter(a => ccpler.some(c => c.asama === a)).map(asama => (
                  <React.Fragment key={asama}>
                    <tr>
                      <td colSpan={4} className="muted">
                        <strong>{ASAMA_ETIKETLERI[asama]}</strong>
                      </td>
                    </tr>
                    {ccpler.filter(c => c.asama === asama).map(c => {
                      const sonu = olcumler.find(o => o.ccpId === c.id && !o.iptalZamani)
                      return (
                        <tr
                          key={c.id}
                          className={c.id === seciliCcpId ? 'is-selected' : ''}
                          onClick={() => { setSeciliCcpId(c.id); setBilgi(''); setHata('') }}
                        >
                          <td>
                            <strong>{c.kod}</strong>
                            {c.durum !== 'ACTIVE' && (
                              <div className="muted">pasif</div>
                            )}
                          </td>
                          <td>{c.ad}</td>
                          <td>{c.limitMetni ?? limitOzeti(c)}</td>
                          <td className={sonu ? '' : 'muted'}>
                            {sonu
                              ? <>
                                  {bicimle(sonu.deger)} {sonu.birim}{' '}
                                  <span className={sonu.sonuc === 'PASS' ? 'muted' : 'is-critical'}>
                                    · {sonu.sonuc === 'PASS' ? 'uygun' : 'UYGUN DEĞİL'}
                                  </span>
                                </>
                              : 'ölçüm yok'}
                          </td>
                        </tr>
                      )
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="warehouse-side">
          {secili
            ? (
              <>
                <section className="card">
                  <div className="section-header compact">
                    <h3>{secili.kod} · {secili.ad}</h3>
                    <span className="muted">{ASAMA_ETIKETLERI[secili.asama]}</span>
                  </div>
                  <dl className="detail-grid">
                    <dt>Kritik limit</dt>
                    <dd><strong>{secili.limitMetni ?? limitOzeti(secili)}</strong></dd>
                    {secili.olcumYontemi && (
                      <><dt>Yöntem</dt><dd>{secili.olcumYontemi}</dd></>
                    )}
                    {secili.olcumSikligi && (
                      <><dt>Sıklık</dt><dd>{secili.olcumSikligi}</dd></>
                    )}
                    {secili.sorumluRol && (
                      <><dt>Sorumlu</dt><dd>{secili.sorumluRol}</dd></>
                    )}
                    {secili.tehlikeTipi && (
                      <>
                        <dt>Tehlike</dt>
                        <dd>
                          {TEHLIKE_ETIKETLERI[secili.tehlikeTipi]}
                          {secili.tehlikeNotu && (
                            <span className="muted"> · {secili.tehlikeNotu}</span>
                          )}
                        </dd>
                      </>
                    )}
                  </dl>
                  {secili.duzelticiTalimat && (
                    <p className="muted detail-hint">
                      <strong>Limit aşılırsa:</strong> {secili.duzelticiTalimat}
                    </p>
                  )}
                </section>

                {yazabilir && secili.durum === 'ACTIVE' && (
                  <section className="card">
                    <div className="section-header compact"><h3>Ölçüm gir</h3></div>
                    <OlcumFormu
                      ccp={secili}
                      kalemler={kalemler}
                      kabuller={kabuller}
                      isEmirleri={isEmirleri}
                      ctx={baglam.ctx}
                      calisiyor={calisiyor}
                      onKaydet={olcumKaydet}
                    />
                  </section>
                )}
              </>
            )
            : (
              <section className="card empty-state">
                Bir kontrol noktası seçin: kritik limitini, ölçüm yöntemini ve
                limit aşılırsa ne yapılacağını burada göreceksiniz.
              </section>
            )}
        </aside>
      </div>

      {/* ── KAYITLAR ───────────────────────────────────────────────────── */}
      <section className="card">
        <div className="section-header compact">
          <h3>İzleme kayıtları</h3>
          <span className="muted">{olcumler.length} kayıt</span>
        </div>
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Tarih / saat</th><th>Kontrol noktası</th>
                <th className="num">Ölçülen</th><th>Kritik limit</th>
                <th>Sonuç</th><th>Bağlı</th><th></th>
              </tr>
            </thead>
            <tbody>
              {olcumler.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    Henüz ölçüm yok. Bir kontrol noktası seçip sağdaki formdan
                    değeri girin; limit aşılırsa uygunsuzluk kendiliğinden açılır.
                  </td>
                </tr>
              )}
              {olcumler.map(o => {
                const f = faaliyetHaritasi.get(o.id)
                return (
                  <tr key={o.id}>
                    <td className="muted">{zamanBicimle(o.olcumZamani)}</td>
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
                      {f && !o.iptalZamani && (
                        <div className="muted">{FAALIYET_ETIKETLERI[f.durum]}</div>
                      )}
                    </td>
                    <td className="muted">
                      {KAYNAK_ETIKETLERI[o.kaynakTipi]}
                      {o.lotId && <div className="muted">partiye bağlı</div>}
                    </td>
                    <td className="actions-cell">
                      {yazabilir && !o.iptalZamani && (
                        <button className="btn" type="button" disabled={calisiyor}
                          onClick={() => { void olcumIptal(o) }}>
                          İptal
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="muted detail-hint">
          Ölçüm kaydı <strong>silinemez</strong> — veritabanı reddediyor. Yanlış
          kayıt gerekçesiyle iptal edilir ve iptal satırı listede kalır.
          Denetimde “bu kaydı sonradan düzelttiniz mi” sorusunun cevabı bu.
          Kritik limit de her satırda <strong>ölçüm anındaki hâliyle</strong>
          yazılı: limit yarın gevşetilse dünkü uygunsuzluk uygunluğa dönmez.
        </p>
      </section>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Ölçüm formu
//
// Formun can alıcı yeri CANLI SONUÇ: kullanıcı değeri yazarken ekran
// "uygun / UYGUN DEĞİL" diyor. Kimse limiti akılda tutmak zorunda kalmıyor,
// ve uygunsuz bir değerin ne olacağı KAYDETMEDEN ÖNCE görülüyor.
// ═══════════════════════════════════════════════════════════════════════════

function OlcumFormu({
  ccp, kalemler, kabuller, isEmirleri, ctx, calisiyor, onKaydet,
}: {
  ccp: Ccp
  kalemler: KatalogKalemi[]
  kabuller: Kabul[]
  isEmirleri: IsEmri[]
  ctx: DepoBaglami['ctx']
  calisiyor: boolean
  onKaydet: (
    ccp: Ccp, deger: number, kaynakTipi: OlcumKaynagi,
    kaynakId?: string, lotId?: string, stokKalemiId?: string, not?: string,
  ) => Promise<void>
}){
  /** Aşamaya göre en olası bağ önceden seçili gelsin. */
  const varsayilanKaynak = (): OlcumKaynagi => {
    if(ccp.asama === 'RECEIVING') return 'goods_receipt'
    if(ccp.asama === 'COOKING' || ccp.asama === 'BLAST_CHILLING') return 'work_order'
    if(ccp.asama === 'STORAGE') return 'cold_room'
    if(ccp.asama === 'DISPATCH') return 'shipment'
    return 'manual'
  }

  const [deger, setDeger] = React.useState('')
  const [kaynakTipi, setKaynakTipi] = React.useState<OlcumKaynagi>(varsayilanKaynak())
  const [kaynakId, setKaynakId] = React.useState('')
  const [stokKalemiId, setStokKalemiId] = React.useState('')
  const [lotId, setLotId] = React.useState('')
  const [lotlar, setLotlar] = React.useState<KatalogLotu[]>([])
  const [not, setNot] = React.useState('')

  // CCP değişince form baştan kurulur: başka bir noktanın değeri kalmasın.
  React.useEffect(() => {
    setDeger(''); setKaynakId(''); setStokKalemiId(''); setLotId('')
    setLotlar([]); setNot('')
    setKaynakTipi(varsayilanKaynak())
  }, [ccp.id])

  // Kalem seçilince o kalemin partileri geliyor.
  React.useEffect(() => {
    let iptal = false
    if(!stokKalemiId){ setLotlar([]); setLotId(''); return }
    ;(async () => {
      try{
        const liste = await new PostgresStokKatalogu(getSupabase()).lotlar(ctx, stokKalemiId)
        if(!iptal) setLotlar(liste)
      } catch { if(!iptal) setLotlar([]) }
    })()
    return () => { iptal = true }
  }, [stokKalemiId, ctx])

  const sayi = sayiyaCevir(deger)
  const yazildi = deger.trim() !== '' && Number.isFinite(sayi)
  const sonuc = yazildi ? sonucHesapla(ccp, sayi) : null

  return (
    <form
      className="stacked-form"
      onSubmit={async e => {
        e.preventDefault()
        if(!yazildi) return
        await onKaydet(
          ccp, sayi, kaynakTipi,
          kaynakId || undefined, lotId || undefined,
          stokKalemiId || undefined, not.trim() || undefined,
        )
        setDeger(''); setNot('')
      }}
    >
      <div className="form-row">
        <label className="narrow">
          Ölçülen değer * ({ccp.birim})
          <input
            type="number" step="any" value={deger} required autoFocus
            placeholder={ccp.limitMetni ?? ''}
            onChange={e => setDeger(e.target.value)}
          />
        </label>
      </div>

      {/* CANLI SONUÇ — kaydetmeden önce ne olacağı görünüyor. */}
      {sonuc === 'PASS' && (
        <p className="muted detail-hint">
          <strong>Uygun.</strong> {limitOzeti(ccp)} sınırının içinde.
        </p>
      )}
      {sonuc === 'FAIL' && (
        <p className="detail-hint is-critical">
          <strong>UYGUN DEĞİL.</strong> {sapmaMetni(ccp, sayi)}
          {' '}Kaydedince düzeltici faaliyet kendiliğinden açılacak
          {ccp.sorumluRol ? ` (${ccp.sorumluRol})` : ''}.
          {ccp.duzelticiTalimat && <> Yapılacak: {ccp.duzelticiTalimat}</>}
        </p>
      )}

      <label>
        Neye ait
        <select
          value={kaynakTipi}
          onChange={e => {
            setKaynakTipi(e.target.value as OlcumKaynagi)
            setKaynakId('')
          }}
        >
          {(Object.keys(KAYNAK_ETIKETLERI) as OlcumKaynagi[]).map(k => (
            <option key={k} value={k}>{KAYNAK_ETIKETLERI[k]}</option>
          ))}
        </select>
      </label>

      {kaynakTipi === 'goods_receipt' && (
        <label>
          Mal kabul belgesi
          <select value={kaynakId} onChange={e => setKaynakId(e.target.value)}>
            <option value="">Belge seçilmedi</option>
            {kabuller.map(k => (
              <option key={k.id} value={k.id}>
                {k.kabulNo} · {k.tedarikciAd ?? ''} · {k.kabulTarihi}
              </option>
            ))}
          </select>
          <small className="muted">
            {kabuller.length === 0
              ? 'Henüz mal kabul belgesi yok.'
              : 'Belgeye bağlanan ölçüm o belgenin yanında durur.'}
          </small>
        </label>
      )}

      {kaynakTipi === 'work_order' && (
        <label>
          İş emri
          <select value={kaynakId} onChange={e => setKaynakId(e.target.value)}>
            <option value="">İş emri seçilmedi</option>
            {isEmirleri.map(i => (
              <option key={i.id} value={i.id}>
                {i.isEmriNo} · {i.ciktiKalemiAd ?? ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* ── PARTİ BAĞI — geri çağırmanın dayandığı yer ─────────────────── */}
      <div className="form-row">
        <label>
          Ürün
          <select value={stokKalemiId} onChange={e => setStokKalemiId(e.target.value)}>
            <option value="">Seçilmedi</option>
            {kalemler.map(k => (
              <option key={k.id} value={k.id}>{k.ad} ({k.kod})</option>
            ))}
          </select>
        </label>
        <label>
          Parti
          <select
            value={lotId} disabled={lotlar.length === 0}
            onChange={e => setLotId(e.target.value)}
          >
            <option value="">
              {stokKalemiId === ''
                ? 'önce ürün seçin'
                : lotlar.length === 0 ? 'bu ürünün partisi yok' : 'Seçilmedi'}
            </option>
            {lotlar.map(l => (
              <option key={l.id} value={l.id}>
                {l.kod}{l.sonKullanma ? ` · SKT ${l.sonKullanma}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <small className="muted">
        Parti seçmek <strong>zorunlu değil</strong> ama seçilirse ölçüm o partiye
        bağlanır: uygunsuz bir ölçüm İzlenebilirlik ekranında görünür ve geri
        çağırma listesine düşer. Soğuk oda ölçümü gibi partisiz ölçümler boş
        bırakılır.
      </small>

      <label>
        Not
        <input value={not} onChange={e => setNot(e.target.value)}
          placeholder="Ölçümü yapan, cihaz, gözlem…" />
      </label>

      <div className="form-actions">
        <button
          className={sonuc === 'FAIL' ? 'btn' : 'btn primary'}
          type="submit" disabled={calisiyor || !yazildi}
        >
          {calisiyor ? 'Kaydediliyor…' : 'Ölçümü Kaydet'}
        </button>
      </div>
    </form>
  )
}
