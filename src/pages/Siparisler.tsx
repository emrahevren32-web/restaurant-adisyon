// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C2 — Siparişler ekranı
//
// Emrah'ın cümlesi: "Sonradan kimse 'ben bunu istiyordum, eksik hazırlanmış,
// fazla gelmiş' diyemesin."
//
// Bu ekranın kalbi sol taraftaki liste değil, sağdaki DEĞİŞİKLİK GEÇMİŞİ:
// "200 kg → 150 kg", kim, ne zaman, hangi kaynaktan. O panel olmasa bu ekran
// sıradan bir sipariş formu olurdu.
//
// ⚠️ Kuralları bu ekran UYGULAMIYOR. Uygulayan 0050'nin tetikleri; servis
// iyi mesaj veriyor; ekran yalnız gösteriyor ve hangi düğmenin görüneceğini
// biliyor. Sunucudan gelen MI403/MI422/MI425 savunmanın çalıştığının
// kanıtıdır, ekranın hatası değil.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { resolveStockRepositoryMode } from '../core/stock/index'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import { PostgresStokKatalogu, type KatalogKalemi } from '../warehouse/warehouse.catalog'
import {
  PostgresMusteriDeposu, type Musteri, type TeslimNoktasi,
} from '../customers/customer.repository'
import {
  PostgresSiparisDeposu,
  type Fark, type FarkAdimi, type FarkKarari, type FarkTuru,
  type Revizyon, type RevizyonKaynagi, type Siparis, type SiparisDurumu,
  type SiparisSatiri, type YeniFark, type YeniRevizyon, type YeniSatir,
  type YeniSiparis,
} from '../sales/sales-order.repository'
import {
  IZINLI_GECISLER, SEVK_SONRASI, SiparisServisi,
  farkiYaz, revizyonFarki, siparisNoCakistiMi, siparisleriSuz, sonrakiSiparisNo,
} from '../sales/sales-order.service'
import {
  TURETILEBILIR_DURUMLAR, sevkOzeti, sevkToplami, sevkiyatTuret,
  type KalemSevkDurumu,
} from '../sales/sales-order-shipment'
import { PostgresSevkiyatDeposu } from '../production/shipment.repository'
import { sonrakiSevkiyatNo } from '../production/shipment.service'

type Props = { currentUser: User }

const hataMetni = (h: unknown) =>
  h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.'

const bugun = () => new Date().toLocaleDateString('sv-SE')
const tarih = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('tr-TR') : '—')
const zaman = (d: string) => new Date(d).toLocaleString('tr-TR')
const sayiYaz = (n: number) => n.toLocaleString('tr-TR')

const KAYNAKLAR: RevizyonKaynagi[] =
  ['Telefon', 'Portal', 'E-posta', 'WhatsApp', 'Yüz Yüze', 'Sistem']
const FARK_TURLERI: FarkTuru[] = ['Eksik', 'Fazla', 'Hasarlı', 'Yanlış ürün']
const FARK_ADIMLARI: FarkAdimi[] =
  ['Üretim', 'Paketleme', 'Yükleme', 'Yolda', 'Teslimde', 'Müşteri bildirdi', 'Sayımda']
const KARARLAR: FarkKarari[] = ['Tamamlanacak', 'Sorumlu Bulundu', 'Müşteri Hatası', 'Diğer']

const DURUM_ROZETI: Record<SiparisDurumu, string> = {
  'Taslak': 'muted-pill', 'Onaylandı': 'r-bilgi', 'Hazırlanıyor': 'r-bilgi',
  'Hazır': 'success-pill', 'Kısmi Sevk': 'warning-pill', 'Sevk Edildi': 'success-pill',
  'Teslim Edildi': 'success-pill', 'İptal': 'muted-pill',
}

type SatirTaslagi = { kalemId: string; miktar: string; birim: string; fiyat: string }

const bosSatir = (): SatirTaslagi => ({ kalemId: '', miktar: '', birim: '', fiyat: '' })

const sayiya = (d: string): number => {
  const n = Number(String(d).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

const taslaktanSatir = (t: SatirTaslagi): YeniSatir => ({
  kalemId: t.kalemId,
  miktar: sayiya(t.miktar),
  birim: t.birim,
  birimFiyat: t.fiyat.trim() === '' ? undefined : sayiya(t.fiyat),
})

export default function Siparisler({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  const yazabilir = !currentUser.permissions || currentUser.permissions.includes('operations.write')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [siparisler, setSiparisler] = React.useState<Siparis[]>([])
  const [musteriler, setMusteriler] = React.useState<Musteri[]>([])
  const [noktalar, setNoktalar] = React.useState<TeslimNoktasi[]>([])
  const [kalemler, setKalemler] = React.useState<KatalogKalemi[]>([])
  const [arama, setArama] = React.useState('')
  const [durumSuzgeci, setDurumSuzgeci] = React.useState<SiparisDurumu | 'hepsi'>('hepsi')
  const [secili, setSecili] = React.useState<Siparis | null>(null)
  const [satirlar, setSatirlar] = React.useState<SiparisSatiri[]>([])
  const [revizyonlar, setRevizyonlar] = React.useState<Revizyon[]>([])
  const [farklar, setFarklar] = React.useState<Fark[]>([])
  const [sekme, setSekme] = React.useState<'satirlar' | 'sevk' | 'gecmis' | 'farklar'>('satirlar')
  const [sevkDurumu, setSevkDurumu] = React.useState<KalemSevkDurumu[]>([])
  const [islem, setIslem] = React.useState<'yeni' | 'revizyon' | 'fark' | null>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const servis = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new SiparisServisi(new PostgresSiparisDeposu(getSupabase()))
  }, [mod])

  const musteriDeposu = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new PostgresMusteriDeposu(getSupabase())
  }, [mod])

  const sevkiyatDeposu = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new PostgresSevkiyatDeposu(getSupabase())
  }, [mod])

  const ayrintiYukle = React.useCallback(async (s: Siparis, b: DepoBaglami) => {
    if(!servis) return
    const [r, f, sd] = await Promise.all([
      servis.revizyonlar(b.ctx, s.id),
      servis.farklar(b.ctx, s.id),
      servis.sevkDurumu(b.ctx, s.id),
    ])
    setRevizyonlar(r)
    setFarklar(f)
    setSevkDurumu(sd)
    // Güncel satırlar = en son SATIRLI revizyon. Kuralı burada yeniden
    // yazmıyoruz: servis okunan revizyonlardan seçiyor.
    const satirli = r.filter(x => x.satirlar.length > 0)
    setSatirlar(satirli.length === 0 ? [] : satirli[satirli.length - 1].satirlar)
  }, [servis])

  React.useEffect(() => {
    let iptal = false
    if(!servis || !musteriDeposu){ setYukleniyor(false); return }

    ;(async () => {
      try{
        const kurulan = await depoBaglamiKur(getSupabase())
        if(iptal) return
        setBaglam(kurulan)
        const katalog = new PostgresStokKatalogu(getSupabase())
        const [sp, ms, ns, kl] = await Promise.all([
          servis.hepsi(kurulan.ctx),
          musteriDeposu.hepsi(kurulan.ctx),
          musteriDeposu.noktalar(kurulan.ctx),
          katalog.kalemler(kurulan.ctx),
        ])
        if(iptal) return
        setSiparisler(sp)
        setMusteriler(ms.filter(m => m.aktif))
        setNoktalar(ns.filter(n => n.aktif))
        setKalemler(kl.filter(k => k.aktif))
      } catch (e) {
        if(!iptal) setHata(hataMetni(e))
      } finally {
        if(!iptal) setYukleniyor(false)
      }
    })()

    return () => { iptal = true }
  }, [servis, musteriDeposu])

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Siparişler</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>Sipariş bir defterdir; veritabanı bağlantısı olmadan açılmaz.</p>
        </section>
      </div>
    )
  }

  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Siparişler</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }

  if(!baglam){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Siparişler</h2></div></div>
        <section className="card empty-state">{hata || 'Çalışma alanı çözülemedi.'}</section>
      </div>
    )
  }

  const gorunen = siparisleriSuz(siparisler, arama, durumSuzgeci)
  const acikFark = farklar.filter(f => f.durum !== 'Karara Bağlandı')

  const yenile = async (seciliId?: string) => {
    if(!servis) return
    const liste = await servis.hepsi(baglam.ctx)
    setSiparisler(liste)
    const hedef = liste.find(s => s.id === (seciliId ?? secili?.id)) ?? null
    setSecili(hedef)
    if(hedef) await ayrintiYukle(hedef, baglam)
  }

  const sec = async (s: Siparis) => {
    setSecili(s); setIslem(null); setHata(''); setSekme('satirlar')
    try { await ayrintiYukle(s, baglam) } catch (e) { setHata(hataMetni(e)) }
  }

  /**
   * Sipariş açma. Numara sistem üretiyor; çakışırsa BİR KEZ yeniden
   * hesaplayıp deniyoruz (iki kişi aynı anda açtıysa). İkinci kez de
   * çakışırsa tahmin etmek yerine kullanıcıya söylüyoruz.
   */
  const siparisAc = async (girdi: YeniSiparis) => {
    try{
      let yeni: Siparis
      try {
        yeni = await servis!.ekle(baglam.ctx, girdi)
      } catch (e) {
        if(!siparisNoCakistiMi(e)) throw e
        const guncel = await servis!.hepsi(baglam.ctx)
        yeni = await servis!.ekle(baglam.ctx, {
          ...girdi, siparisNo: sonrakiSiparisNo(guncel.map(s => s.siparisNo)),
        })
      }
      setBilgi(`${yeni.siparisNo} açıldı. Taslak durumunda — onaylayınca hazırlığa girer.`)
      setHata(''); setIslem(null)
      await yenile(yeni.id)
    } catch (e) { setHata(hataMetni(e)) }
  }

  const durumDegistir = async (yeni: SiparisDurumu) => {
    if(!secili) return
    try{
      await servis!.durumDegistir(baglam.ctx, secili, yeni)
      setBilgi(`${secili.siparisNo} → ${yeni}`)
      setHata('')
      await yenile()
    } catch (e) { setHata(hataMetni(e)) }
  }

  const revizyonAc = async (girdi: YeniRevizyon) => {
    if(!secili) return
    try{
      await servis!.revizyonEkle(baglam.ctx, secili, girdi)
      setBilgi('Revizyon deftere yazıldı. Eski hâli geçmişte duruyor.')
      setHata(''); setIslem(null); setSekme('gecmis')
      await yenile()
    } catch (e) { setHata(hataMetni(e)) }
  }

  const farkAc = async (girdi: YeniFark) => {
    try{
      await servis!.farkAc(baglam.ctx, girdi)
      setBilgi('Fark kaydı açıldı. İncelenip karara bağlanması gerekiyor.')
      setHata(''); setIslem(null); setSekme('farklar')
      await yenile()
    } catch (e) { setHata(hataMetni(e)) }
  }

  const kararVer = async (farkId: string, karar: FarkKarari, not: string, sorumluId?: string) => {
    try{
      await servis!.farkiKararaBagla(baglam.ctx, farkId, { karar, kararNotu: not, sorumluId })
      setBilgi('Fark karara bağlandı.')
      setHata('')
      await yenile()
    } catch (e) { setHata(hataMetni(e)) }
  }

  /**
   * Siparişin KALANINDAN bir sevkiyat TASLAĞI çıkarır.
   *
   * ⚠️ Taslak, sevk DEĞİL. Malın deftere çıkış yazılması ve stok yeterliliği
   * Sevkiyatlar ekranında; oradaki kontrolü atlarsak olmayan malı sevk
   * etmiş oluruz. Buradaki iş yalnızca "ne kadar kaldı" sorusunu elle
   * yazdırmamak.
   */
  const sevkiyataCikar = async () => {
    if(!secili || !sevkiyatDeposu || !baglam) return
    try{
      const mevcut = await sevkiyatDeposu.hepsi(baglam.ctx)
      const girdi = sevkiyatTuret(
        secili, sevkDurumu, sonrakiSevkiyatNo(mevcut.map(x => x.sevkiyatNo)),
      )
      const olusan = await sevkiyatDeposu.ekle(baglam.ctx, girdi)
      setHata('')
      setBilgi(
        `${olusan.sevkiyatNo} sevkiyat taslağı oluşturuldu ve bu siparişe `
        + 'bağlandı. Sevkiyatlar ekranından sevk edin — sipariş durumu o an '
        + 'kendiliğinden ilerleyecek.',
      )
      await yenile(secili.id)
    } catch (e) { setBilgi(''); setHata(hataMetni(e)) }
  }

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Siparişler</h2>
          <p className="muted">
            Aşama 4C · Sipariş bir defterdir: değişiklik üstüne yazılmaz, yeni
            revizyon olur
          </p>
        </div>
        {yazabilir && (
          <div className="form-actions">
            <button
              className="btn primary" type="button"
              onClick={() => { setIslem('yeni'); setHata('') }}
            >
              Yeni Sipariş
            </button>
          </div>
        )}
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-info">{bilgi}</div>}

      <div className="warehouse-layout">
        <section className="card warehouse-main">
          <div className="supplier-toolbar">
            <input
              type="search" value={arama}
              placeholder="Sipariş no, müşteri veya teslim noktası"
              aria-label="Sipariş ara"
              onChange={e => setArama(e.target.value)}
            />
            <select
              value={durumSuzgeci}
              aria-label="Durum süzgeci"
              onChange={e => setDurumSuzgeci(e.target.value as SiparisDurumu | 'hepsi')}
            >
              <option value="hepsi">Bütün durumlar</option>
              {(Object.keys(IZINLI_GECISLER) as SiparisDurumu[]).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Sipariş No</th><th>Müşteri</th><th>Teslim noktası</th>
                  <th>Sevk</th><th>Durum</th><th className="num">Rev</th><th />
                </tr>
              </thead>
              <tbody>
                {gorunen.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      {siparisler.length === 0
                        ? 'Henüz sipariş yok. İlk siparişi açarak başlayın.'
                        : 'Süzgece uyan sipariş yok.'}
                    </td>
                  </tr>
                )}
                {gorunen.map(s => (
                  <tr key={s.id} className={secili?.id === s.id ? 'is-selected' : ''}>
                    <td><strong>{s.siparisNo}</strong></td>
                    <td>{s.musteriAdi ?? '—'}</td>
                    <td className="muted">{s.noktaAdi ?? '—'}</td>
                    <td className="muted">{tarih(s.sevkTarihi)}</td>
                    <td>
                      <span className={`status-pill ${DURUM_ROZETI[s.durum]}`}>{s.durum}</span>
                    </td>
                    <td className="num muted">{s.guncelRevizyon}</td>
                    <td className="row-actions">
                      <button className="btn" type="button" onClick={() => { void sec(s) }}>
                        Aç ›
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="warehouse-side">
          {islem === 'yeni' && (
            <section className="card">
              <div className="section-header compact"><h3>Yeni Sipariş</h3></div>
              <SiparisFormu
                onerilenNo={sonrakiSiparisNo(siparisler.map(s => s.siparisNo))}
                musteriler={musteriler}
                noktalar={noktalar}
                kalemler={kalemler}
                fiyatOku={(noktaId, kalemId) =>
                  musteriDeposu!.gecerliFiyat(baglam.ctx, noktaId, kalemId)}
                onIptal={() => setIslem(null)}
                onKaydet={siparisAc}
              />
            </section>
          )}

          {!islem && !secili && (
            <section className="card empty-state">
              Sipariş bir defterdir. Satır asla üstüne yazılmaz; her değişiklik
              yeni bir revizyon olur ve eski hâli okunabilir kalır. Bir siparişi
              açıp <strong>Değişiklik geçmişi</strong> sekmesine bakın — bu
              ürünün sattığı şey orada.
            </section>
          )}

          {secili && (
            <section className="card">
              <div className="section-header compact">
                <h3>{secili.siparisNo}</h3>
                <span className={`status-pill ${DURUM_ROZETI[secili.durum]}`}>{secili.durum}</span>
              </div>

              <div className="karar-ozet">
                <div className="karar-ozet-satir">
                  <span>Müşteri</span><strong>{secili.musteriAdi ?? '—'}</strong>
                </div>
                <div className="karar-ozet-satir">
                  <span>Teslim noktası</span><strong>{secili.noktaAdi ?? '—'}</strong>
                </div>
                <div className="karar-ozet-satir">
                  <span>Sevk / teslim</span>
                  <strong>{tarih(secili.sevkTarihi)} → {tarih(secili.teslimTarihi)}</strong>
                </div>
                <div className="karar-ozet-satir">
                  <span>Revizyon</span><strong>{secili.guncelRevizyon}</strong>
                </div>
              </div>

              {acikFark.length > 0 && (
                <p className="muted detail-hint">
                  <span className="onem-rozeti kritik">{acikFark.length} açık fark</span>{' '}
                  Bu sipariş, farkı karara bağlanmadan tamamlanmış sayılmaz.
                </p>
              )}

              {yazabilir && (
                <div className="form-actions">
                  {IZINLI_GECISLER[secili.durum].map(d => (
                    <button
                      key={d} className="btn" type="button"
                      onClick={() => { void durumDegistir(d) }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}

              {yazabilir && !islem && secili.durum !== 'İptal' && (
                <div className="form-actions">
                  <button className="btn" type="button" onClick={() => { setIslem('revizyon'); setHata('') }}>
                    + Revizyon
                  </button>
                  <button className="btn" type="button" onClick={() => { setIslem('fark'); setHata('') }}>
                    Fark bildir
                  </button>
                </div>
              )}

              {islem === 'revizyon' && (
                <RevizyonFormu
                  siparis={secili}
                  guncelSatirlar={satirlar}
                  kalemler={kalemler}
                  noktalar={noktalar.filter(n => n.musteriId === secili.musteriId)}
                  farklar={farklar}
                  onIptal={() => setIslem(null)}
                  onKaydet={revizyonAc}
                />
              )}

              {islem === 'fark' && (
                <FarkFormu
                  siparis={secili}
                  kalemler={kalemler}
                  onIptal={() => setIslem(null)}
                  onKaydet={farkAc}
                />
              )}

              <div className="form-actions">
                <button
                  className={`btn ${sekme === 'satirlar' ? 'primary' : ''}`}
                  type="button" onClick={() => setSekme('satirlar')}
                >
                  Satırlar ({satirlar.length})
                </button>
                <button
                  className={`btn ${sekme === 'sevk' ? 'primary' : ''}`}
                  type="button" onClick={() => setSekme('sevk')}
                >
                  Sevk durumu
                </button>
                <button
                  className={`btn ${sekme === 'gecmis' ? 'primary' : ''}`}
                  type="button" onClick={() => setSekme('gecmis')}
                >
                  Değişiklik geçmişi ({revizyonlar.length})
                </button>
                <button
                  className={`btn ${sekme === 'farklar' ? 'primary' : ''}`}
                  type="button" onClick={() => setSekme('farklar')}
                >
                  Farklar ({farklar.length})
                </button>
              </div>

              {sekme === 'satirlar' && (
                <div className="table-wrap">
                  <table className="data-table compact">
                    <thead>
                      <tr><th>Ürün</th><th className="num">Miktar</th><th>Birim</th><th className="num">Fiyat</th></tr>
                    </thead>
                    <tbody>
                      {satirlar.length === 0 && (
                        <tr><td colSpan={4} className="muted">Satır yok.</td></tr>
                      )}
                      {satirlar.map(s => (
                        <tr key={s.id}>
                          <td>{s.kalemAdi ?? '—'}</td>
                          <td className="num">{sayiYaz(s.miktar)}</td>
                          <td className="muted">{s.birim}</td>
                          <td className="num muted">
                            {s.birimFiyat === undefined
                              ? '—'
                              : `${s.birimFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${s.paraBirimi ?? ''}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {sekme === 'sevk' && (
                <SevkPaneli
                  siparis={secili}
                  durumlar={sevkDurumu}
                  yazabilir={yazabilir}
                  onCikar={sevkiyataCikar}
                />
              )}

              {sekme === 'gecmis' && <GecmisPaneli revizyonlar={revizyonlar} />}

              {sekme === 'farklar' && (
                <FarkListesi
                  farklar={farklar}
                  yazabilir={yazabilir}
                  onKarar={kararVer}
                />
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

// ── Sevk durumu ────────────────────────────────────────────────────────────
/**
 * "Bu siparişin ne kadarı gitti?" — tek bakışta.
 *
 * Sayılar 0051'deki `app.siparis_sevk_durumu()`den geliyor; tarayıcıda
 * toplasaydık iki çağrı arasında yazılan bir sevkiyat sessizce kaçardı.
 */
function SevkPaneli({
  siparis, durumlar, yazabilir, onCikar,
}: {
  siparis: Siparis
  durumlar: KalemSevkDurumu[]
  yazabilir: boolean
  onCikar: () => void
}){
  const toplam = sevkToplami(durumlar)
  const turetilebilir = TURETILEBILIR_DURUMLAR.includes(siparis.durum)
  const kalanVar = durumlar.some(d => !d.siparisDisi && !d.birimUyusmuyor && (d.kalan ?? 0) > 0)

  return (
    <div>
      <p className="muted">
        {toplam.kalemSayisi} kalem · {toplam.tamamlanan} tamamlandı
        {toplam.bekleyen > 0 && <> · <strong>{toplam.bekleyen} bekliyor</strong></>}
        {toplam.fazlaGiden > 0 && <> · <strong>{toplam.fazlaGiden} fazla gitti</strong></>}
        {toplam.hesaplanamayan > 0 && <> · {toplam.hesaplanamayan} hesaplanamıyor</>}
        {toplam.siparisDisiKalem > 0 && <> · {toplam.siparisDisiKalem} sipariş dışı</>}
      </p>

      {(toplam.fazlaGiden > 0 || toplam.siparisDisiKalem > 0) && (
        <div className="form-error">
          Sipariş dışına çıkılmış: fazla ya da siparişte olmayan kalem gitmiş.
          Bu bir <strong>fark kaydı</strong> konusudur, revizyon değil.
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table compact">
          <thead>
            <tr><th>Ürün</th><th className="num">Sipariş</th><th className="num">Giden</th><th className="num">Kalan</th><th>Durum</th></tr>
          </thead>
          <tbody>
            {durumlar.length === 0 && (
              <tr><td colSpan={5} className="muted">Kalem yok.</td></tr>
            )}
            {durumlar.map(d => (
              <tr key={d.kalemId}>
                <td>{d.kalemAdi ?? d.kalemId}</td>
                <td className="num">
                  {d.siparisMiktar === undefined
                    ? '—'
                    : `${sayiYaz(d.siparisMiktar)} ${d.siparisBirim ?? ''}`}
                </td>
                <td className="num">{sayiYaz(d.sevkMiktar)}</td>
                <td className="num">
                  {/* ⚠️ Birim uyuşmuyorsa sayı YAZILMIYOR. Uydurulmuş bir
                      sayı, boş bir hücreden daha tehlikelidir. */}
                  {d.kalan === undefined ? '—' : sayiYaz(d.kalan)}
                </td>
                <td className="muted">{sevkOzeti(d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {yazabilir && turetilebilir && kalanVar && (
        <div className="form-actions">
          <button className="btn primary" type="button" onClick={onCikar}>
            Kalanı sevkiyata çıkar
          </button>
        </div>
      )}
      {yazabilir && turetilebilir && !kalanVar && durumlar.length > 0 && (
        <p className="muted">Sevk edilmemiş kalem kalmadı.</p>
      )}
      {yazabilir && !turetilebilir && (
        <p className="muted">
          Sevkiyat çıkarmak için sipariş <strong>Hazır</strong> olmalı.
        </p>
      )}
    </div>
  )
}

// ── Değişiklik geçmişi ─────────────────────────────────────────────────────
/**
 * Bu panel bu ekranın var olma sebebi.
 *
 * Ham iki liste göstermek, kullanıcıya farkı kendisinin bulmasını söylemek
 * olurdu. O yüzden her revizyonda NE DEĞİŞTİĞİ yazıyor: "200 kg → 150 kg".
 */
function GecmisPaneli({ revizyonlar }: { revizyonlar: Revizyon[] }){
  if(revizyonlar.length === 0){
    return <p className="muted detail-hint">Revizyon yok.</p>
  }

  // Karşılaştırma yalnız SATIRLI revizyonlar arasında: lojistik revizyonu
  // satır taşımıyor, onu miktar değişikliği gibi göstermek yanlış olurdu.
  const satirli = revizyonlar.filter(r => r.satirlar.length > 0)

  return (
    <>
      <p className="muted detail-hint">
        Hiçbir satır üstüne yazılmadı. Aşağıdaki her kayıt defterde duruyor ve
        silinemez.
      </p>
      {[...revizyonlar].reverse().map(r => {
        const sira = satirli.findIndex(x => x.id === r.id)
        const onceki = sira > 0 ? satirli[sira - 1].satirlar : []
        const farklar = r.satirlar.length > 0 ? revizyonFarki(onceki, r.satirlar) : []
        return (
          <div key={r.id} className="karar-ozet">
            <div className="karar-ozet-satir">
              <span>
                <strong>Rev {r.revizyonNo}</strong>{' '}
                <span className={`onem-rozeti ${r.tur === 'LOJISTIK' ? 'bilgi' : 'uyari'}`}>
                  {r.tur === 'LOJISTIK' ? 'Lojistik' : 'Miktar'}
                </span>
              </span>
              <span className="muted">{zaman(r.olusturmaZamani)}</span>
            </div>
            <div className="karar-ozet-satir">
              <span>Kaynak</span><strong>{r.kaynak}</strong>
            </div>
            <div className="karar-ozet-satir">
              <span>Gerekçe</span><strong>{r.gerekce}</strong>
            </div>
            {r.farkId && (
              <div className="karar-ozet-satir">
                <span>Bağlı fark kaydı</span>
                <strong>var — sevk sonrası miktar değişikliği</strong>
              </div>
            )}
            {sira === 0 && r.satirlar.length > 0 && (
              <div className="karar-ozet-satir">
                <span>İlk hâli</span>
                <strong>
                  {r.satirlar.map(s => `${s.kalemAdi ?? '—'} ${sayiYaz(s.miktar)} ${s.birim}`).join(' · ')}
                </strong>
              </div>
            )}
            {farklar.map(f => (
              <div className="karar-ozet-satir" key={f.kalemId}>
                <span>{f.kalemAdi ?? '—'}</span>
                <strong className={f.tur === 'çıkarıldı' ? 'is-critical' : undefined}>
                  {farkiYaz(f)}
                </strong>
              </div>
            ))}
            {r.tur === 'MIKTAR' && sira > 0 && farklar.length === 0 && (
              <div className="karar-ozet-satir">
                <span>Satırlar</span><strong className="muted">değişmedi</strong>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

// ── Fark listesi ───────────────────────────────────────────────────────────
function FarkListesi({
  farklar, yazabilir, onKarar,
}: {
  farklar: Fark[]
  yazabilir: boolean
  onKarar: (farkId: string, karar: FarkKarari, not: string, sorumluId?: string) => Promise<void>
}){
  const [acik, setAcik] = React.useState<string | null>(null)
  const [karar, setKarar] = React.useState<FarkKarari>('Tamamlanacak')
  const [not, setNot] = React.useState('')

  if(farklar.length === 0){
    return (
      <p className="muted detail-hint">
        Fark kaydı yok. Bir eksik, fazla ya da hasar fark eden kişi
        <strong> Fark bildir</strong> ile bayrağı kaldırır.
      </p>
    )
  }

  return (
    <>
      {farklar.map(f => (
        <div key={f.id} className="karar-ozet">
          <div className="karar-ozet-satir">
            <span>
              <span className={`onem-rozeti ${f.durum === 'Karara Bağlandı' ? 'bilgi' : 'kritik'}`}>
                {f.tur}
              </span>{' '}
              <strong>{f.miktar !== undefined ? `${sayiYaz(f.miktar)} ${f.birim ?? ''}` : ''}</strong>
            </span>
            <span className="muted">{f.adim}</span>
          </div>
          {f.kalemAdi && (
            <div className="karar-ozet-satir"><span>Ürün</span><strong>{f.kalemAdi}</strong></div>
          )}
          <div className="karar-ozet-satir">
            <span>Bildiren</span>
            <strong>{f.bildirenAdi ?? 'kullanıcı'} · {zaman(f.bildirimZamani)}</strong>
          </div>
          <div className="karar-ozet-satir"><span>Açıklama</span><strong>{f.aciklama}</strong></div>
          <div className="karar-ozet-satir">
            <span>Durum</span><strong>{f.durum}</strong>
          </div>
          {f.karar && (
            <div className="karar-ozet-satir">
              <span>Karar</span><strong>{f.karar} — {f.kararNotu ?? ''}</strong>
            </div>
          )}

          {yazabilir && f.durum !== 'Karara Bağlandı' && acik !== f.id && (
            <div className="form-actions">
              <button className="btn" type="button" onClick={() => { setAcik(f.id); setNot('') }}>
                Karara bağla
              </button>
            </div>
          )}

          {acik === f.id && (
            <form
              className="stacked-form"
              onSubmit={e => {
                e.preventDefault()
                void onKarar(f.id, karar, not).then(() => setAcik(null))
              }}
            >
              <label>Karar
                <select value={karar} onChange={e => setKarar(e.target.value as FarkKarari)}>
                  {KARARLAR.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <small className="muted">
                  Tamamlanacak: aynı siparişe ikinci sevkiyat çıkar.
                  Müşteri Hatası: sipariş bu kayda bağlı olarak revize edilir.
                </small>
              </label>
              <label>Karar notu *
                <textarea
                  rows={2} value={not} required
                  placeholder="Ne oldu, nasıl çözüldü"
                  onChange={e => setNot(e.target.value)}
                />
              </label>
              {karar === 'Sorumlu Bulundu' && (
                <p className="muted detail-hint">
                  Sorumlu kişi seçimi bu sürümde henüz yok; karar notuna yazın.
                  Kişi bazlı sorumluluk, personel modülü bağlanınca gelecek.
                </p>
              )}
              <div className="form-actions">
                <button className="btn" type="button" onClick={() => setAcik(null)}>İptal</button>
                <button className="btn primary" type="submit">Kaydet</button>
              </div>
            </form>
          )}
        </div>
      ))}
    </>
  )
}

// ── Sipariş formu ──────────────────────────────────────────────────────────
function SiparisFormu({
  onerilenNo, musteriler, noktalar, kalemler, fiyatOku, onIptal, onKaydet,
}: {
  onerilenNo: string
  musteriler: Musteri[]
  noktalar: TeslimNoktasi[]
  kalemler: KatalogKalemi[]
  fiyatOku: (noktaId: string, kalemId: string) => Promise<number | undefined>
  onIptal: () => void
  onKaydet: (girdi: YeniSiparis) => Promise<void>
}){
  const [musteriId, setMusteriId] = React.useState('')
  const [noktaId, setNoktaId] = React.useState('')
  const [sevk, setSevk] = React.useState(bugun())
  const [teslim, setTeslim] = React.useState('')
  const [not, setNot] = React.useState('')
  const [satirlar, setSatirlar] = React.useState<SatirTaslagi[]>([bosSatir()])
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  const musteriNoktalari = noktalar.filter(n => n.musteriId === musteriId)

  const guncelle = (i: number, yama: Partial<SatirTaslagi>) =>
    setSatirlar(o => o.map((s, j) => (j === i ? { ...s, ...yama } : s)))

  /**
   * Ürün seçilince birim ve FİYAT kendiliğinden doluyor.
   * Fiyat 0047'nin defterinden okunuyor (nokta > müşteri, en yeni tarih) —
   * burada yeniden hesaplanmıyor. Kullanıcı üzerine yazabilir: o günkü
   * anlaşma farklı olabilir ve belge o günü yazar.
   */
  const kalemSec = async (i: number, kalemId: string) => {
    const kalem = kalemler.find(k => k.id === kalemId)
    guncelle(i, { kalemId, birim: kalem?.temelBirim ?? '' })
    if(!noktaId || !kalemId) return
    try {
      const fiyat = await fiyatOku(noktaId, kalemId)
      if(fiyat !== undefined) guncelle(i, { fiyat: String(fiyat) })
    } catch { /* fiyat okunamazsa form çalışmaya devam eder */ }
  }

  return (
    <form
      className="stacked-form"
      onSubmit={async e => {
        e.preventDefault()
        setGonderiliyor(true)
        try{
          await onKaydet({
            siparisNo: onerilenNo,
            musteriId,
            noktaId: noktaId || undefined,
            sevkTarihi: sevk || undefined,
            teslimTarihi: teslim || undefined,
            not: not.trim() || undefined,
            satirlar: satirlar
              .filter(s => s.kalemId !== '' && sayiya(s.miktar) > 0)
              .map(taslaktanSatir),
          })
        } finally { setGonderiliyor(false) }
      }}
    >
      <label>Sipariş No
        <input value={onerilenNo} readOnly />
        <small className="muted">
          Sistem üretiyor. Elle yazılan numaralar birbirine karışır ve aynı
          sipariş iki kez sayılır.
        </small>
      </label>

      <label>Müşteri *
        <select
          value={musteriId} required
          onChange={e => { setMusteriId(e.target.value); setNoktaId('') }}
        >
          <option value="">Seçin…</option>
          {musteriler.map(m => <option key={m.id} value={m.id}>{m.kod} · {m.ad}</option>)}
        </select>
      </label>

      <label>Teslim noktası
        <select value={noktaId} disabled={!musteriId} onChange={e => setNoktaId(e.target.value)}>
          <option value="">{musteriId ? 'Seçin…' : 'Önce müşteri seçin'}</option>
          {musteriNoktalari.map(n => <option key={n.id} value={n.id}>{n.ad}</option>)}
        </select>
        <small className="muted">
          İrsaliye buraya çıkar. Fiyat da buradan okunuyor: aynı müşterinin
          farklı noktalarına farklı fiyat olabilir.
        </small>
      </label>

      <div className="form-row">
        <label>Sevk tarihi
          <input type="date" value={sevk} onChange={e => setSevk(e.target.value)} />
        </label>
        <label>Teslim tarihi
          <input type="date" value={teslim} onChange={e => setTeslim(e.target.value)} />
        </label>
      </div>

      <SatirDuzenleyici
        satirlar={satirlar} kalemler={kalemler}
        onKalemSec={(i, id) => { void kalemSec(i, id) }}
        onGuncelle={guncelle}
        onEkle={() => setSatirlar(o => [...o, bosSatir()])}
        onSil={i => setSatirlar(o => o.filter((_, j) => j !== i))}
      />

      <label>Not
        <textarea rows={2} value={not} onChange={e => setNot(e.target.value)} />
      </label>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Açılıyor…' : 'Siparişi aç'}
        </button>
      </div>
    </form>
  )
}

// ── Revizyon formu ─────────────────────────────────────────────────────────
function RevizyonFormu({
  siparis, guncelSatirlar, kalemler, noktalar, farklar, onIptal, onKaydet,
}: {
  siparis: Siparis
  guncelSatirlar: SiparisSatiri[]
  kalemler: KatalogKalemi[]
  noktalar: TeslimNoktasi[]
  farklar: Fark[]
  onIptal: () => void
  onKaydet: (girdi: YeniRevizyon) => Promise<void>
}){
  const sevkSonrasi = SEVK_SONRASI.includes(siparis.durum)
  const [tur, setTur] = React.useState<'MIKTAR' | 'LOJISTIK'>(sevkSonrasi ? 'LOJISTIK' : 'MIKTAR')
  const [kaynak, setKaynak] = React.useState<RevizyonKaynagi>('Telefon')
  const [gerekce, setGerekce] = React.useState('')
  const [farkId, setFarkId] = React.useState('')
  const [noktaId, setNoktaId] = React.useState(siparis.noktaId ?? '')
  const [sevk, setSevk] = React.useState(siparis.sevkTarihi ?? '')
  const [teslim, setTeslim] = React.useState(siparis.teslimTarihi ?? '')
  const [satirlar, setSatirlar] = React.useState<SatirTaslagi[]>(
    guncelSatirlar.length > 0
      ? guncelSatirlar.map(s => ({
          kalemId: s.kalemId, miktar: String(s.miktar), birim: s.birim,
          fiyat: s.birimFiyat === undefined ? '' : String(s.birimFiyat),
        }))
      : [bosSatir()],
  )
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  // Karara bağlanmış farklar revizyona bağlanabilir: inceleme bitmeden
  // miktarı değiştirmek, incelemeyi atlamak olurdu.
  const bagliFarklar = farklar.filter(f => f.durum === 'Karara Bağlandı')

  const guncelle = (i: number, yama: Partial<SatirTaslagi>) =>
    setSatirlar(o => o.map((s, j) => (j === i ? { ...s, ...yama } : s)))

  return (
    <form
      className="stacked-form"
      onSubmit={async e => {
        e.preventDefault()
        setGonderiliyor(true)
        try{
          await onKaydet(tur === 'MIKTAR'
            ? {
                siparisId: siparis.id, tur, kaynak, gerekce,
                farkId: farkId || undefined,
                satirlar: satirlar
                  .filter(s => s.kalemId !== '' && sayiya(s.miktar) > 0)
                  .map(taslaktanSatir),
              }
            : {
                siparisId: siparis.id, tur, kaynak, gerekce,
                noktaId, sevkTarihi: sevk, teslimTarihi: teslim,
              })
        } finally { setGonderiliyor(false) }
      }}
    >
      <h4>Yeni revizyon</h4>

      <label>Tür
        <select value={tur} onChange={e => setTur(e.target.value as 'MIKTAR' | 'LOJISTIK')}>
          <option value="MIKTAR">Miktar — satırlar değişiyor</option>
          <option value="LOJISTIK">Lojistik — teslim noktası ya da tarih</option>
        </select>
      </label>

      {sevkSonrasi && tur === 'MIKTAR' && (
        <p className="muted detail-hint">
          <span className="onem-rozeti kritik">Dikkat</span> Bu sipariş sevk
          edildi. İstenen mal zaten üretilip yola çıktı, o yüzden miktar
          <strong> yalnızca karara bağlanmış bir fark kaydına dayanarak</strong>
          değişebilir. Teslim noktası ya da tarih değişecekse Lojistik türünü
          seçin.
        </p>
      )}

      {sevkSonrasi && tur === 'MIKTAR' && (
        <label>Bağlı fark kaydı *
          <select value={farkId} required onChange={e => setFarkId(e.target.value)}>
            <option value="">Seçin…</option>
            {bagliFarklar.map(f => (
              <option key={f.id} value={f.id}>
                {f.tur} · {f.adim} · {f.karar ?? ''}
              </option>
            ))}
          </select>
          {bagliFarklar.length === 0 && (
            <small className="muted">
              Karara bağlanmış fark kaydı yok. Önce farkı bildirin, incelensin
              ve karara bağlanın.
            </small>
          )}
        </label>
      )}

      <label>Kaynak *
        <select value={kaynak} onChange={e => setKaynak(e.target.value as RevizyonKaynagi)}>
          {KAYNAKLAR.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <small className="muted">
          Kaynağı olmayan değişiklik, sonradan sahibi olmayan değişikliktir.
        </small>
      </label>

      <label>Gerekçe *
        <textarea
          rows={2} value={gerekce} required
          placeholder="Müşteri telefonla 150'ye düşürdü"
          onChange={e => setGerekce(e.target.value)}
        />
      </label>

      {tur === 'LOJISTIK' && (
        <>
          <label>Teslim noktası
            <select value={noktaId} onChange={e => setNoktaId(e.target.value)}>
              <option value="">—</option>
              {noktalar.map(n => <option key={n.id} value={n.id}>{n.ad}</option>)}
            </select>
          </label>
          <div className="form-row">
            <label>Sevk tarihi
              <input type="date" value={sevk} onChange={e => setSevk(e.target.value)} />
            </label>
            <label>Teslim tarihi
              <input type="date" value={teslim} onChange={e => setTeslim(e.target.value)} />
            </label>
          </div>
        </>
      )}

      {tur === 'MIKTAR' && (
        <SatirDuzenleyici
          satirlar={satirlar} kalemler={kalemler}
          onKalemSec={(i, id) => {
            const kalem = kalemler.find(k => k.id === id)
            guncelle(i, { kalemId: id, birim: kalem?.temelBirim ?? '' })
          }}
          onGuncelle={guncelle}
          onEkle={() => setSatirlar(o => [...o, bosSatir()])}
          onSil={i => setSatirlar(o => o.filter((_, j) => j !== i))}
        />
      )}

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Yazılıyor…' : 'Deftere yaz'}
        </button>
      </div>
    </form>
  )
}

// ── Fark formu ─────────────────────────────────────────────────────────────
function FarkFormu({
  siparis, kalemler, onIptal, onKaydet,
}: {
  siparis: Siparis
  kalemler: KatalogKalemi[]
  onIptal: () => void
  onKaydet: (girdi: YeniFark) => Promise<void>
}){
  const [tur, setTur] = React.useState<FarkTuru>('Eksik')
  const [adim, setAdim] = React.useState<FarkAdimi>('Teslimde')
  const [kalemId, setKalemId] = React.useState('')
  const [miktar, setMiktar] = React.useState('')
  const [birim, setBirim] = React.useState('')
  const [aciklama, setAciklama] = React.useState('')
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  return (
    <form
      className="stacked-form"
      onSubmit={async e => {
        e.preventDefault()
        setGonderiliyor(true)
        try{
          await onKaydet({
            siparisId: siparis.id,
            tur, adim,
            kalemId: kalemId || undefined,
            miktar: miktar.trim() === '' ? undefined : sayiya(miktar),
            birim: birim.trim() || undefined,
            aciklama,
          })
        } finally { setGonderiliyor(false) }
      }}
    >
      <h4>Fark bildir</h4>
      <p className="muted detail-hint">
        Farkı ilk fark eden bayrağı kaldırır. Kaydı <strong>siz</strong>
        açıyorsunuz — oturumunuz kaydediliyor, forma isim yazılmıyor.
      </p>

      <div className="form-row">
        <label>Tür
          <select value={tur} onChange={e => setTur(e.target.value as FarkTuru)}>
            {FARK_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Nerede fark ettiniz
          <select value={adim} onChange={e => setAdim(e.target.value as FarkAdimi)}>
            {FARK_ADIMLARI.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>

      <label>Ürün
        <select
          value={kalemId}
          onChange={e => {
            setKalemId(e.target.value)
            const k = kalemler.find(x => x.id === e.target.value)
            if(k && birim.trim() === '') setBirim(k.temelBirim)
          }}
        >
          <option value="">— bütün sipariş</option>
          {kalemler.map(k => <option key={k.id} value={k.id}>{k.kod} · {k.ad}</option>)}
        </select>
      </label>

      <div className="form-row">
        <label>Miktar
          <input value={miktar} onChange={e => setMiktar(e.target.value)} placeholder="2" />
        </label>
        <label>Birim
          <input value={birim} onChange={e => setBirim(e.target.value)} placeholder="koli" />
        </label>
      </div>

      <label>Ne fark ettiniz *
        <textarea
          rows={2} value={aciklama} required
          placeholder="Müşteri 2 koli eksik geldi dedi"
          onChange={e => setAciklama(e.target.value)}
        />
      </label>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Kaydediliyor…' : 'Bayrağı kaldır'}
        </button>
      </div>
    </form>
  )
}

// ── Satır düzenleyici ──────────────────────────────────────────────────────
function SatirDuzenleyici({
  satirlar, kalemler, onKalemSec, onGuncelle, onEkle, onSil,
}: {
  satirlar: SatirTaslagi[]
  kalemler: KatalogKalemi[]
  onKalemSec: (i: number, kalemId: string) => void
  onGuncelle: (i: number, yama: Partial<SatirTaslagi>) => void
  onEkle: () => void
  onSil: (i: number) => void
}){
  return (
    <>
      <p className="muted detail-hint">
        <strong>Satırlar.</strong> Miktar, firmanın kendi belgesindeki birimle
        giriliyor: palet, koli, kg. Çeviri stok tarafının işi.
      </p>
      {satirlar.map((s, i) => (
        <div className="purchase-line" key={i}>
          <div className="form-row">
            <label>Ürün
              <select value={s.kalemId} onChange={e => onKalemSec(i, e.target.value)}>
                <option value="">Seçin…</option>
                {kalemler.map(k => <option key={k.id} value={k.id}>{k.kod} · {k.ad}</option>)}
              </select>
            </label>
            <label className="narrow">Miktar
              <input value={s.miktar} onChange={e => onGuncelle(i, { miktar: e.target.value })} />
            </label>
            <label className="narrow">Birim
              <input value={s.birim} onChange={e => onGuncelle(i, { birim: e.target.value })} />
            </label>
            <label className="narrow">Fiyat
              <input value={s.fiyat} onChange={e => onGuncelle(i, { fiyat: e.target.value })} />
            </label>
          </div>
          {satirlar.length > 1 && (
            <button className="btn" type="button" onClick={() => onSil(i)}>Satırı çıkar</button>
          )}
        </div>
      ))}
      <button className="btn" type="button" onClick={onEkle}>+ Satır</button>
    </>
  )
}
