// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 / Güven katmanı — Fire, Zayi ve İmha
//
// Yol haritası maddesi:
//   "Fire, zayi, SKT geçmiş lot imhası" → Üçü de AYRI sebep koduyla deftere
//
// ── EKRANIN İKİ İŞİ ──────────────────────────────────────────────────────
// 1. YAZMAK: SKT'si geçmiş lotları tek tek aramaya gerek kalmadan, listeden
//    seçip toplu imha etmek. Miktar kullanıcıdan değil DEFTERDEN gelir.
// 2. OKUMAK: "bu ay ne kadar kaybettik, hangi kalemde, hangi sebeple".
//    Üç sebep kodunu ayırmanın tek anlamı bu tablo; tablo olmasaydı ayırmak
//    boşa iş olurdu.
//
// ── NEDEN AYRI EKRAN ─────────────────────────────────────────────────────
// Fire/zayi Depo ekranının yan panelinden de yazılabiliyor (tek kalem, tek
// hareket). Ama SKT imhası ONLARCA LOTU aynı anda ilgilendirir ve "hangi
// lotlar bekliyor" sorusu kalem kalem gezerek cevaplanamaz. Rapor tarafı da
// depo listesine sığmazdı.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { createStockRepository, resolveStockRepositoryMode } from '../core/stock/index'
import { InMemoryStockItemLookup } from '../core/stock/stock-item-lookup'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import { PostgresStokKatalogu } from '../warehouse/warehouse.catalog'
import { DepoServisi, type RafOmruUyarisi } from '../warehouse/warehouse.service'
import {
  PostgresZayiDefteri, ZAYI_ACIKLAMALARI, ZAYI_ETIKETLERI, ZAYI_NEDENLERI,
  type ZayiHareketi, type ZayiNedeni,
} from '../warehouse/write-off.repository'
import {
  gerekceYeterliMi, gunOnce, kalemBazindaZayi, zayiOzeti,
} from '../warehouse/write-off.service'

type Props = { currentUser: User }

const sayiBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 })
const bicimle = (d: number) => sayiBicimi.format(d)
const paraBicimi = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })
const para = (d: number) => paraBicimi.format(d)
const hataMetni = (h: unknown) => (h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.')
const gunBicimle = (d: string) => {
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleDateString('tr-TR')
}

const nedenSinifi = (neden: ZayiNedeni) =>
  neden === 'EXPIRY_WRITE_OFF' ? 'danger-pill' : neden === 'LOSS' ? 'warning-pill' : 'info-pill'

export default function ZayiImha({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  const yazabilir = !currentUser.permissions || currentUser.permissions.includes('stock.write')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [gecmisLotlar, setGecmisLotlar] = React.useState<RafOmruUyarisi[]>([])
  const [hareketler, setHareketler] = React.useState<ZayiHareketi[]>([])
  const [secilenler, setSecilenler] = React.useState<Set<string>>(new Set())
  const [gerekce, setGerekce] = React.useState('')
  const [baslangic, setBaslangic] = React.useState(() => gunOnce(30))
  const [bitis, setBitis] = React.useState(() => gunOnce(0))
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [calisiyor, setCalisiyor] = React.useState(false)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const depoServisi = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new DepoServisi(
      createStockRepository(new InMemoryStockItemLookup([])),
      new PostgresStokKatalogu(getSupabase()),
    )
  }, [mod])

  const defter = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new PostgresZayiDefteri(getSupabase())
  }, [mod])

  const yenile = React.useCallback(async (aktif: DepoBaglami) => {
    if(!depoServisi || !defter) return
    const [uyarilar, kayitlar] = await Promise.all([
      depoServisi.uyarilar(aktif.ctx),
      defter.hareketler(aktif.ctx, { baslangic, bitis }),
    ])
    setGecmisLotlar(uyarilar.suresiGecmis)
    setHareketler(kayitlar)
  }, [depoServisi, defter, baslangic, bitis])

  React.useEffect(() => {
    let iptal = false
    if(!depoServisi || !defter){ setYukleniyor(false); return }
    ;(async () => {
      try{
        const kurulan = await depoBaglamiKur(getSupabase())
        if(iptal) return
        setBaglam(kurulan)
        await yenile(kurulan)
      } catch(e){ if(!iptal) setHata(hataMetni(e)) }
      finally { if(!iptal) setYukleniyor(false) }
    })()
    return () => { iptal = true }
  }, [depoServisi, defter, yenile])

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Fire, Zayi ve İmha</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>Kayıp kayıtları defterden okunur; tarayıcı hafızasında denetim izi olmaz.</p>
        </section>
      </div>
    )
  }
  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Fire, Zayi ve İmha</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }
  if(!baglam || !depoServisi || !defter){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Fire, Zayi ve İmha</h2></div></div>
        <section className="card empty-state">{hata || 'Çalışma alanı çözülemedi.'}</section>
      </div>
    )
  }

  const aktifBaglam = baglam
  const secili = gecmisLotlar.filter(u => secilenler.has(u.lotId))
  const imhaEdilebilir = yazabilir && secili.length > 0 && gerekceYeterliMi(gerekce)

  const degistir = (lotId: string) => setSecilenler(onceki => {
    const yeni = new Set(onceki)
    if(yeni.has(lotId)) yeni.delete(lotId); else yeni.add(lotId)
    return yeni
  })

  const hepsiniSec = () => setSecilenler(
    secilenler.size === gecmisLotlar.length ? new Set() : new Set(gecmisLotlar.map(u => u.lotId)),
  )

  const imhaEt = async () => {
    if(!window.confirm(
      `${secili.length} lot imha edilecek.\n\n`
      + 'Her lotun DEFTERDEKİ TAM BAKİYESİ "SKT imhası" olarak düşülecek. '
      + 'Bu işlem geri alınamaz; defter append-only.',
    )) return

    setCalisiyor(true)
    try{
      const sonuc = await depoServisi.imhaEt(
        aktifBaglam.ctx,
        secili.map(u => ({ kalemId: u.kalemId, lotId: u.lotId })),
        gerekce,
      )
      setSecilenler(new Set())
      setGerekce('')
      setHata(sonuc.hatalar.length === 0 ? '' :
        `${sonuc.hatalar.length} lot imha edilemedi: `
        + sonuc.hatalar.map(h => h.mesaj).join(' · '))
      setBilgi(
        sonuc.yazilan.length === 0
          ? 'Hiçbir lot imha edilmedi.'
          : `${sonuc.yazilan.length} lot imha edildi ve deftere "SKT imhası" olarak yazıldı.`,
      )
      await yenile(aktifBaglam)
    } catch(e){ setHata(hataMetni(e)); setBilgi('') }
    finally { setCalisiyor(false) }
  }

  const araligiUygula = async () => {
    setCalisiyor(true)
    try{ await yenile(aktifBaglam); setHata('') }
    catch(e){ setHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  const ozet = zayiOzeti(hareketler)
  const kalemler = kalemBazindaZayi(hareketler)
  const toplamTutar = ozet.reduce((acc, o) => acc + o.tutar, 0)
  const maliyetsizToplam = ozet.reduce((acc, o) => acc + o.maliyetsiz, 0)

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Fire, Zayi ve İmha</h2>
          <p className="muted">Aşama 4 · Üç sebep ayrı ölçülür, her kayıt gerekçelidir</p>
        </div>
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-info">{bilgi}</div>}

      {/* ── 1 · İMHA BEKLEYEN LOTLAR ─────────────────────────────────────── */}
      <section className="card">
        <div className="section-header">
          <div>
            <h3>İmha Bekleyen Lotlar</h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Son kullanma tarihi geçmiş ve hâlâ bakiyesi olan lotlar. Bakiyesi
              tükenmiş lot burada görünmez — uyarıyı doğuran şey lotun varlığı
              değil, içindeki maldır.
            </p>
          </div>
          {gecmisLotlar.length > 0 && (
            <button className="btn" type="button" onClick={hepsiniSec}>
              {secilenler.size === gecmisLotlar.length ? 'Seçimi kaldır' : 'Hepsini seç'}
            </button>
          )}
        </div>

        {gecmisLotlar.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Süresi geçmiş lot yok. Depoda satılamaz mal beklemiyor.
          </p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Kalem</th><th>Lot</th><th>SKT</th>
                    <th className="num">Gecikme</th><th className="num">Bakiye</th>
                  </tr>
                </thead>
                <tbody>
                  {gecmisLotlar.map(u => (
                    <tr key={u.lotId} className={secilenler.has(u.lotId) ? 'is-selected' : ''}>
                      <td>
                        <input type="checkbox" checked={secilenler.has(u.lotId)}
                          disabled={!yazabilir}
                          onChange={() => degistir(u.lotId)} />
                      </td>
                      <td>{u.kalemAd}</td>
                      <td className="muted">{u.lotKodu}</td>
                      <td>{gunBicimle(u.sonKullanma)}</td>
                      <td className="num is-critical">{Math.abs(u.kalanGun)} gün</td>
                      <td className="num">{bicimle(u.miktar)} {u.birim}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {yazabilir && (
              <div className="stacked-form" style={{ marginTop: 16 }}>
                <div className="form-field">
                  <label>Gerekçe</label>
                  <input value={gerekce} onChange={e => setGerekce(e.target.value)}
                    placeholder={ZAYI_ACIKLAMALARI.EXPIRY_WRITE_OFF} />
                  <small className="muted">
                    İmha tutanağının numarası, kimin karar verdiği — denetimde
                    sorulan budur. Gerekçesiz imha yazılamaz.
                  </small>
                </div>
                <div className="form-actions">
                  <button className="btn primary" type="button"
                    disabled={!imhaEdilebilir || calisiyor} onClick={() => void imhaEt()}>
                    {calisiyor ? 'İşleniyor…' : `Seçilenleri İmha Et (${secili.length})`}
                  </button>
                </div>
                <p className="muted detail-hint" style={{ margin: 0 }}>
                  Her lotun <strong>tam bakiyesi</strong> düşülür. Kısmi imha için
                  Depo ekranındaki tek kalem çıkışını kullanın.
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── 2 · RAPOR ────────────────────────────────────────────────────── */}
      <section className="card">
        <div className="section-header">
          <div><h3>Kayıp Raporu</h3></div>
          <div className="zayi-filtreler">
            <label>
              Başlangıç
              <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)} />
            </label>
            <label>
              Bitiş
              <input type="date" value={bitis} onChange={e => setBitis(e.target.value)} />
            </label>
            <button className="btn" type="button" disabled={calisiyor}
              onClick={() => void araligiUygula()}>Getir</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sebep</th><th>Ne demek</th>
                <th className="num">Kayıt</th><th className="num">Miktar</th><th className="num">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {ozet.map(o => (
                <tr key={o.neden}>
                  <td>
                    <span className={`status-pill ${nedenSinifi(o.neden)}`}>
                      {ZAYI_ETIKETLERI[o.neden]}
                    </span>
                  </td>
                  <td className="muted">{ZAYI_ACIKLAMALARI[o.neden]}</td>
                  <td className="num">{o.adet}</td>
                  <td className="num">
                    {o.birimBazinda.length === 0 ? '—'
                      : o.birimBazinda.map(b => `${bicimle(b.miktar)} ${b.birim}`).join(' · ')}
                  </td>
                  <td className="num">
                    {o.tutar > 0 ? para(o.tutar) : '—'}
                    {o.maliyetsiz > 0 && (
                      <div className="muted" style={{ fontSize: '0.8em' }}>
                        {o.maliyetsiz} kayıtta maliyet yok
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="muted detail-hint">
          Seçilen aralıkta toplam <strong>{para(toplamTutar)}</strong>
          {maliyetsizToplam > 0 && (
            <> — {maliyetsizToplam} kaydın birim maliyeti bilinmediği için bu rakam
            gerçek kaybın <strong>altındadır</strong>.</>
          )}
        </p>
      </section>

      {/* ── 3 · KALEM BAZINDA ────────────────────────────────────────────── */}
      {kalemler.length > 0 && (
        <section className="card">
          <div className="section-header"><div><h3>En Çok Kaybedilen Kalemler</h3></div></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kalem</th><th>Kod</th>
                  <th className="num">Kayıt</th><th className="num">Miktar</th><th className="num">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {kalemler.slice(0, 15).map(k => (
                  <tr key={k.kalemId}>
                    <td>{k.kalemAd}</td>
                    <td className="muted">{k.kalemKodu}</td>
                    <td className="num">{k.adet}</td>
                    <td className="num">{bicimle(k.miktar)} {k.birim}</td>
                    <td className="num">{k.tutar > 0 ? para(k.tutar) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 4 · KAYIT DÖKÜMÜ ─────────────────────────────────────────────── */}
      <section className="card">
        <div className="section-header"><div><h3>Kayıt Dökümü</h3></div></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarih</th><th>Kalem</th><th>Lot</th><th>Sebep</th>
                <th className="num">Miktar</th><th>Gerekçe</th>
              </tr>
            </thead>
            <tbody>
              {hareketler.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Seçilen aralıkta fire, zayi ya da imha kaydı yok.
                  </td>
                </tr>
              )}
              {hareketler.map(h => (
                <tr key={h.id}>
                  <td>{gunBicimle(h.tarih)}</td>
                  <td>{h.kalemAd}</td>
                  <td className="muted">{h.lotKodu ?? '—'}</td>
                  <td>
                    <span className={`status-pill ${nedenSinifi(h.neden)}`}>
                      {ZAYI_ETIKETLERI[h.neden]}
                    </span>
                  </td>
                  <td className="num">{bicimle(h.miktar)} {h.birim}</td>
                  <td className="muted">{h.not ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted detail-hint">
          Bu döküm defterin kendisinden geliyor; hiçbir satırı silinemez ya da
          değiştirilemez. Yanlış yazılan bir kayıt ancak ters kayıtla düzeltilir.
          {' '}Sebep kodları: {ZAYI_NEDENLERI.map(n => ZAYI_ETIKETLERI[n]).join(' · ')}.
        </p>
      </section>
    </div>
  )
}
