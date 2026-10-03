// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C1 — Müşteriler ekranı
//
// Yol haritası maddesi: "Müşteri kartı ve sözleşme"
//          Bitti sayılır ki: "Sevkiyatta müşteri adı elle yazılmıyor,
//                             karttan seçiliyor"
//
// ── EKRANIN ŞEKLİ NEDEN BÖYLE ────────────────────────────────────────────
// Solda müşteri listesi, sağda seçilenin ayrıntısı. Ayrıntı iki sekme:
// TESLİM NOKTALARI ve FİYATLAR. Üçünü ayrı menü ögesine bölmek, kullanıcıyı
// "Migros'un Ataşehir fiyatı ne" sorusunu cevaplamak için üç ekran arasında
// dolaştırırdı. Bu soru tek bir soru; tek ekranda cevaplanıyor.
//
// ── SİLME DÜĞMESİ NEDEN YOK ──────────────────────────────────────────────
// Müşteri silinirse ona kesilmiş irsaliyelerin ve verilmiş siparişlerin
// geçmişi kopar. Pasife alınan müşteri yeni siparişlerde seçilemez, geçmişte
// görünmeye devam eder. Fiyat ise hiç silinmez: defter eklemeli (0047).
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { resolveStockRepositoryMode } from '../core/stock/index'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import { PostgresStokKatalogu, type KatalogKalemi } from '../warehouse/warehouse.catalog'
import { gommeKodu, portalBaglantisi } from '../portal/portal-giris'
import {
  PostgresMusteriDeposu,
  type Fiyat,
  type FiyatGirdisi,
  type Musteri,
  type MusteriGirdisi,
  type PortalKullanicisi,
  type SiparisPenceresi,
  type TeslimNoktasi,
  type TeslimNoktasiGirdisi,
} from '../customers/customer.repository'
import {
  MusteriServisi,
  fiyatKapsami,
  fiyatiYaz,
  musterileriSuz,
  pencereyiYaz,
  sonrakiMusteriKodu,
  sonrakiNoktaKodu,
} from '../customers/customer.service'

type Props = { currentUser: User }

const hataMetni = (hata: unknown) =>
  hata instanceof Error ? hata.message : 'Beklenmeyen bir hata oluştu.'

const bugun = () => new Date().toLocaleDateString('sv-SE')
const tarih = (d?: string) =>
  (d ? new Date(`${d}T00:00:00`).toLocaleDateString('tr-TR') : '—')

const BOS_MUSTERI: MusteriGirdisi = { kod: '', ad: '' }

const musteriGirdisi = (m: Musteri): MusteriGirdisi => ({
  kod: m.kod, ad: m.ad, vergiNo: m.vergiNo, vergiDairesi: m.vergiDairesi,
  resmiUnvan: m.resmiUnvan, il: m.il, ilce: m.ilce, kepAdresi: m.kepAdresi,
  efaturaMukellefi: m.efaturaMukellefi, efaturaKontrolTarihi: m.efaturaKontrolTarihi,
  yetkili: m.yetkili, telefon: m.telefon, eposta: m.eposta, adres: m.adres,
  vadeGunu: m.vadeGunu, kesimSaati: m.kesimSaati,
  teslimGunFarki: m.teslimGunFarki, not: m.not,
})

const noktaGirdisi = (n: TeslimNoktasi): TeslimNoktasiGirdisi => ({
  musteriId: n.musteriId, kod: n.kod, ad: n.ad, adres: n.adres, ilce: n.ilce,
  il: n.il, yetkili: n.yetkili, telefon: n.telefon, kesimSaati: n.kesimSaati,
  teslimGunFarki: n.teslimGunFarki, teslimBaslangic: n.teslimBaslangic,
  teslimBitis: n.teslimBitis, not: n.not,
})

/** Boş metin alanını sayıya çevirir. Boş = "girilmemiş", sıfır DEĞİL. */
const sayi = (deger: string): number | undefined =>
  deger.trim() === '' ? undefined : Number(deger)

const metin = (deger?: number) => (deger === undefined ? '' : String(deger))

export default function Musteriler({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  // Sevkiyat ve sipariş yetkisiyle aynı kapı: müşteri kartı o zincirin
  // başlangıcıdır. Ayrı bir izin uydurmuyoruz — izin katalogu göçle
  // yönetiliyor (0014), ekranda tanımlanan bir izin hiçbir yerde yok.
  const yazabilir = !currentUser.permissions || currentUser.permissions.includes('operations.write')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [musteriler, setMusteriler] = React.useState<Musteri[]>([])
  const [kalemler, setKalemler] = React.useState<KatalogKalemi[]>([])
  const [arama, setArama] = React.useState('')
  const [pasifleriGoster, setPasifleriGoster] = React.useState(false)
  const [secili, setSecili] = React.useState<Musteri | null>(null)
  const [sekme, setSekme] = React.useState<'noktalar' | 'fiyatlar' | 'portal'>('noktalar')
  const [portalcilar, setPortalcilar] = React.useState<PortalKullanicisi[]>([])
  const [noktalar, setNoktalar] = React.useState<TeslimNoktasi[]>([])
  const [fiyatlar, setFiyatlar] = React.useState<Fiyat[]>([])
  const [pencereler, setPencereler] = React.useState<Record<string, SiparisPenceresi>>({})
  const [musteriFormu, setMusteriFormu] = React.useState<MusteriGirdisi | null>(null)
  const [duzenlenenId, setDuzenlenenId] = React.useState<string | null>(null)
  const [noktaFormu, setNoktaFormu] = React.useState<TeslimNoktasiGirdisi | null>(null)
  const [duzenlenenNoktaId, setDuzenlenenNoktaId] = React.useState<string | null>(null)
  const [fiyatFormu, setFiyatFormu] = React.useState<FiyatGirdisi | null>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const servis = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new MusteriServisi(new PostgresMusteriDeposu(getSupabase()))
  }, [mod])

  React.useEffect(() => {
    let iptal = false
    if(!servis){ setYukleniyor(false); return }

    ;(async () => {
      try{
        const kurulan = await depoBaglamiKur(getSupabase())
        if(iptal) return
        setBaglam(kurulan)
        const katalog = new PostgresStokKatalogu(getSupabase())
        const [liste, kalemListesi] = await Promise.all([
          servis.hepsi(kurulan.ctx),
          katalog.kalemler(kurulan.ctx),
        ])
        if(iptal) return
        setMusteriler(liste)
        setKalemler(kalemListesi)
      } catch (e) {
        if(!iptal) setHata(hataMetni(e))
      } finally {
        if(!iptal) setYukleniyor(false)
      }
    })()

    return () => { iptal = true }
  }, [servis])

  /**
   * Seçilen müşterinin noktaları, fiyatları ve her noktanın GEÇERLİ
   * penceresi. Pencere ayrı ayrı okunuyor çünkü kuralı veritabanı çözüyor
   * (0047); ekranda `coalesce` yapsak kural iki yerde durur ve ayrışır.
   */
  const ayrintiyiYukle = React.useCallback(async (musteri: Musteri, ctx: DepoBaglami) => {
    if(!servis) return
    const [n, f, p] = await Promise.all([
      servis.noktalar(ctx.ctx, musteri.id),
      servis.fiyatlar(ctx.ctx, musteri.id),
      servis.portalKullanicilari(ctx.ctx, musteri.id),
    ])
    setNoktalar(n)
    setFiyatlar(f)
    setPortalcilar(p)
    const cozulen: Record<string, SiparisPenceresi> = {}
    for(const nokta of n){
      cozulen[nokta.id] = await servis.pencere(ctx.ctx, nokta.id)
    }
    setPencereler(cozulen)
  }, [servis])

  const musteriSec = async (musteri: Musteri) => {
    setSecili(musteri)
    setMusteriFormu(null)
    setNoktaFormu(null)
    setFiyatFormu(null)
    setHata('')
    if(!baglam) return
    try{ await ayrintiyiYukle(musteri, baglam) }
    catch (e) { setHata(hataMetni(e)) }
  }

  // ── Portal erişimi (0054) ─────────────────────────────────────────────
  // ⚠️ Hiçbir yerde PAROLA yok. Giriş, bu e-postaya gönderilen tek
  // kullanımlık bağlantıyla oluyor.
  const portalErisimiVer = async (eposta: string, adSoyad: string, noktaIdler: string[]) => {
    if(!servis || !baglam || !secili) return
    try{
      await servis.portalErisimiVer(baglam.ctx, {
        musteriId: secili.id, eposta,
        ...(adSoyad.trim() ? { adSoyad: adSoyad.trim() } : {}),
        noktaIdler,
      })
      setHata('')
      await yenile()
    } catch (e) { setHata(hataMetni(e)) }
  }

  const portalErisimiDegistir = async (id: string, aktif: boolean) => {
    if(!servis || !baglam) return
    try{ await servis.portalErisimiDegistir(baglam.ctx, id, aktif); setHata(''); await yenile() }
    catch (e) { setHata(hataMetni(e)) }
  }

  const portalNoktalariAyarla = async (id: string, noktaIdler: string[]) => {
    if(!servis || !baglam) return
    try{ await servis.portalNoktalariAyarla(baglam.ctx, id, noktaIdler); setHata(''); await yenile() }
    catch (e) { setHata(hataMetni(e)) }
  }

  const yenile = async () => {
    if(!servis || !baglam) return
    const liste = await servis.hepsi(baglam.ctx)
    setMusteriler(liste)
    if(secili){
      const guncel = liste.find(m => m.id === secili.id) ?? null
      setSecili(guncel)
      if(guncel) await ayrintiyiYukle(guncel, baglam)
    }
  }

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Müşteriler</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>
            Müşteri kartı sipariş ve sevkiyat zincirinin başlangıcıdır;
            veritabanı bağlantısı olmadan açılmaz.
          </p>
        </section>
      </div>
    )
  }

  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Müşteriler</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }

  if(!baglam){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Müşteriler</h2></div></div>
        <section className="card empty-state">{hata || 'Çalışma alanı çözülemedi.'}</section>
      </div>
    )
  }

  const gorunen = musterileriSuz(musteriler, arama, pasifleriGoster)
  const pasifSayisi = musteriler.filter(m => !m.aktif).length
  const aktifNoktalar = noktalar.filter(n => n.aktif)

  const musteriKaydet = async () => {
    if(!musteriFormu) return
    try{
      if(duzenlenenId){
        await servis!.guncelle(baglam.ctx, duzenlenenId, musteriFormu)
        setBilgi(`"${musteriFormu.ad.trim()}" güncellendi.`)
      } else {
        const yeni = await servis!.ekle(baglam.ctx, musteriFormu)
        setBilgi(`"${yeni.ad}" eklendi. Şimdi teslim noktalarını girebilirsiniz.`)
        setSecili(yeni)
      }
      setHata('')
      setMusteriFormu(null)
      setDuzenlenenId(null)
      await yenile()
    } catch (e) { setHata(hataMetni(e)) }
  }

  const aktiflikDegistir = async (m: Musteri) => {
    try{
      await servis!.aktiflikDegistir(baglam.ctx, m.id, !m.aktif)
      setBilgi(m.aktif
        ? `"${m.ad}" pasife alındı. Yeni siparişlerde seçilemez; geçmiş kayıtlar duruyor.`
        : `"${m.ad}" yeniden aktif.`)
      setHata('')
      await yenile()
    } catch (e) { setHata(hataMetni(e)) }
  }

  const noktaKaydet = async () => {
    if(!noktaFormu) return
    try{
      if(duzenlenenNoktaId){
        await servis!.noktaGuncelle(baglam.ctx, duzenlenenNoktaId, noktaFormu)
        setBilgi(`"${noktaFormu.ad.trim()}" güncellendi.`)
      } else {
        await servis!.noktaEkle(baglam.ctx, noktaFormu)
        setBilgi(`"${noktaFormu.ad.trim()}" teslim noktası eklendi.`)
      }
      setHata('')
      setNoktaFormu(null)
      setDuzenlenenNoktaId(null)
      if(secili) await ayrintiyiYukle(secili, baglam)
    } catch (e) { setHata(hataMetni(e)) }
  }

  const noktaAktiflikDegistir = async (n: TeslimNoktasi) => {
    try{
      await servis!.noktaAktiflikDegistir(baglam.ctx, n.id, !n.aktif)
      setHata('')
      setBilgi(n.aktif ? `"${n.ad}" pasife alındı.` : `"${n.ad}" yeniden aktif.`)
      if(secili) await ayrintiyiYukle(secili, baglam)
    } catch (e) { setHata(hataMetni(e)) }
  }

  const fiyatKaydet = async () => {
    if(!fiyatFormu) return
    try{
      await servis!.fiyatEkle(baglam.ctx, fiyatFormu)
      setBilgi('Fiyat deftere yazıldı. Fiyat değiştirilemez — yeni fiyat için '
        + 'yeni bir geçerlilik tarihiyle yeni satır eklenir.')
      setHata('')
      setFiyatFormu(null)
      if(secili) await ayrintiyiYukle(secili, baglam)
    } catch (e) { setHata(hataMetni(e)) }
  }

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Müşteriler</h2>
          <p className="muted">
            Aşama 4C · Sipariş ve sevkiyat zincirinin başlangıcı
          </p>
        </div>
        {yazabilir && (
          <div className="form-actions">
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                // ⚠️ Kodu SİSTEM öneriyor. Kullanıcıya "bir kod uydur"
                // dedirtmek uydurulmuş kodlar üretir; kodun tek işi kartı
                // tekil kılmak ve belgede kısa bir tutamak olmak.
                setMusteriFormu({
                  ...BOS_MUSTERI,
                  kod: sonrakiMusteriKodu(musteriler.map(m => m.kod)),
                })
                setDuzenlenenId(null)
                setHata('')
              }}
            >
              Yeni Müşteri
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
              type="search"
              value={arama}
              placeholder="Kod, ad, yetkili veya vergi no ile ara"
              aria-label="Müşteri ara"
              onChange={event => setArama(event.target.value)}
            />
            {pasifSayisi > 0 && (
              <label className="supplier-toggle">
                <input
                  type="checkbox"
                  checked={pasifleriGoster}
                  onChange={event => setPasifleriGoster(event.target.checked)}
                />
                Pasifleri göster ({pasifSayisi})
              </label>
            )}
          </div>

          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Kod</th><th>Ad</th><th>Yetkili</th><th className="num">Vade</th>
                  <th>Durum</th><th />
                </tr>
              </thead>
              <tbody>
                {gorunen.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      {musteriler.length === 0
                        ? 'Henüz müşteri yok. İlk kaydı ekleyerek başlayın.'
                        : 'Aramanıza uyan müşteri yok.'}
                    </td>
                  </tr>
                )}
                {gorunen.map(m => (
                  <tr
                    key={m.id}
                    className={`${m.aktif ? '' : 'is-passive'} ${secili?.id === m.id ? 'is-selected' : ''}`}
                  >
                    <td>{m.kod}</td>
                    <td><strong>{m.ad}</strong></td>
                    <td className="muted">{m.yetkili ?? '—'}</td>
                    <td className="num muted">
                      {m.vadeGunu === undefined ? '—' : m.vadeGunu === 0 ? 'peşin' : `${m.vadeGunu} gün`}
                    </td>
                    <td>
                      <span className={`status-pill ${m.aktif ? 'success-pill' : 'muted-pill'}`}>
                        {m.aktif ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="row-actions">
                      <button className="btn" type="button" onClick={() => { void musteriSec(m) }}>
                        Aç ›
                      </button>
                      {yazabilir && (
                        <>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => {
                              setMusteriFormu(musteriGirdisi(m))
                              setDuzenlenenId(m.id)
                              setHata('')
                            }}
                          >
                            Düzenle
                          </button>
                          <button
                            className="btn"
                            type="button"
                            title={m.aktif
                              ? 'Yeni siparişlerde seçilemez olur; geçmiş kayıtlar korunur.'
                              : 'Yeniden seçilebilir hâle gelir.'}
                            onClick={() => { void aktiflikDegistir(m) }}
                          >
                            {m.aktif ? 'Pasife al' : 'Aktif et'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="warehouse-side">
          {musteriFormu && (
            <MusteriFormu
              girdi={musteriFormu}
              duzenleme={Boolean(duzenlenenId)}
              onDegis={setMusteriFormu}
              onIptal={() => { setMusteriFormu(null); setDuzenlenenId(null) }}
              onKaydet={() => { void musteriKaydet() }}
            />
          )}

          {!musteriFormu && !secili && (
            <section className="card empty-state">
              Müşteri kartı, sipariş zincirinin ilk halkasıdır. Sipariş müşteriye
              değil TESLİM NOKTASINA yazılır: irsaliye oraya çıkar, araç oraya
              gider, yükleme sıcaklığı orada ölçülür. Bir müşteriyi açıp
              noktalarını ve fiyatlarını girin.
            </section>
          )}

          {!musteriFormu && secili && (
            <section className="card">
              <div className="section-header compact">
                <h3>{secili.ad}</h3>
                <span className="muted">{secili.kod}</span>
              </div>

              <div className="karar-ozet">
                <div className="karar-ozet-satir">
                  <span>Vergi no</span><strong>{secili.vergiNo ?? '—'}</strong>
                </div>
                <div className="karar-ozet-satir">
                  <span>e-Fatura mükellefi</span>
                  <strong>
                    {/* ⚠️ Kontrol tarihi yoksa bayrağa GÜVENMİYORUZ ve bunu
                        yazıyoruz. Sessizce "hayır" göstermek, eski bir
                        bilgiyi bugünkü gerçek gibi sunmak olurdu. */}
                    {secili.efaturaMukellefi === undefined
                      ? 'bilinmiyor'
                      : secili.efaturaKontrolTarihi
                        ? `${secili.efaturaMukellefi ? 'evet' : 'hayır'} · ${tarih(secili.efaturaKontrolTarihi)}`
                        : `${secili.efaturaMukellefi ? 'evet' : 'hayır'} (tarihsiz — güvenilmez)`}
                  </strong>
                </div>
                <div className="karar-ozet-satir">
                  <span>Ödeme vadesi</span>
                  <strong>
                    {secili.vadeGunu === undefined
                      ? 'konuşulmadı'
                      : secili.vadeGunu === 0 ? 'peşin' : `${secili.vadeGunu} gün`}
                  </strong>
                </div>
                <div className="karar-ozet-satir">
                  <span>Varsayılan pencere</span>
                  <strong>
                    {secili.kesimSaati
                      ? `Kesim ${secili.kesimSaati.slice(0, 5)}`
                      : 'yok'}
                  </strong>
                </div>
              </div>

              <div className="form-actions">
                <button
                  className={`btn ${sekme === 'noktalar' ? 'primary' : ''}`}
                  type="button"
                  onClick={() => setSekme('noktalar')}
                >
                  Teslim Noktaları ({noktalar.length})
                </button>
                <button
                  className={`btn ${sekme === 'fiyatlar' ? 'primary' : ''}`}
                  type="button"
                  onClick={() => setSekme('fiyatlar')}
                >
                  Fiyatlar ({fiyatlar.length})
                </button>
                <button
                  className={`btn ${sekme === 'portal' ? 'primary' : ''}`}
                  type="button"
                  onClick={() => setSekme('portal')}
                >
                  Portal erişimi ({portalcilar.filter(p => p.aktif).length})
                </button>
              </div>

              {sekme === 'portal' && (
                <PortalPaneli
                  kullanicilar={portalcilar}
                  noktalar={aktifNoktalar}
                  yazabilir={yazabilir}
                  onVer={portalErisimiVer}
                  onDegistir={portalErisimiDegistir}
                  onNoktalar={portalNoktalariAyarla}
                />
              )}

              {sekme === 'noktalar' && (
                <>
                  {yazabilir && !noktaFormu && (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        // Nokta kodu müşteri kodunun ALTINDA sıralanıyor
                        // (35060-01, 35060-02): irsaliyede görülünce hangi
                        // müşterinin kaçıncı noktası olduğu belli olsun.
                        setNoktaFormu({
                          musteriId: secili.id,
                          kod: sonrakiNoktaKodu(secili.kod, noktalar.map(n => n.kod)),
                          ad: '',
                        })
                        setDuzenlenenNoktaId(null)
                        setHata('')
                      }}
                    >
                      + Teslim noktası
                    </button>
                  )}

                  {noktaFormu && (
                    <NoktaFormu
                      girdi={noktaFormu}
                      duzenleme={Boolean(duzenlenenNoktaId)}
                      onDegis={setNoktaFormu}
                      onIptal={() => { setNoktaFormu(null); setDuzenlenenNoktaId(null) }}
                      onKaydet={() => { void noktaKaydet() }}
                    />
                  )}

                  {noktalar.length === 0 && !noktaFormu && (
                    <p className="muted detail-hint">
                      Bu müşterinin teslim noktası yok. Sipariş noktaya yazıldığı
                      için en az bir nokta gerekiyor — tek adresli bir müşteride
                      buna &quot;Merkez&quot; demek yeterli.
                    </p>
                  )}

                  {noktalar.map(n => (
                    <div key={n.id} className={`karar-ozet ${n.aktif ? '' : 'is-passive'}`}>
                      <div className="karar-ozet-satir">
                        <span><strong>{n.ad}</strong> · {n.kod}</span>
                        <span className="muted">{n.ilce ?? n.il ?? ''}</span>
                      </div>
                      <div className="karar-ozet-satir">
                        <span>Sipariş penceresi</span>
                        <strong>{pencereler[n.id] ? pencereyiYaz(pencereler[n.id]) : '…'}</strong>
                      </div>
                      {n.teslimBaslangic && n.teslimBitis && (
                        <div className="karar-ozet-satir">
                          <span>Teslim aralığı</span>
                          <strong>
                            {n.teslimBaslangic.slice(0, 5)} – {n.teslimBitis.slice(0, 5)}
                          </strong>
                        </div>
                      )}
                      {yazabilir && (
                        <div className="form-actions">
                          <button
                            className="btn"
                            type="button"
                            onClick={() => {
                              setNoktaFormu(noktaGirdisi(n))
                              setDuzenlenenNoktaId(n.id)
                              setHata('')
                            }}
                          >
                            Düzenle
                          </button>
                          <button className="btn" type="button" onClick={() => { void noktaAktiflikDegistir(n) }}>
                            {n.aktif ? 'Pasife al' : 'Aktif et'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {sekme === 'fiyatlar' && (
                <>
                  {yazabilir && !fiyatFormu && (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        setFiyatFormu({
                          musteriId: secili.id,
                          kalemId: '',
                          birimFiyat: 0,
                          paraBirimi: 'TRY',
                          birim: '',
                          gecerlilikBaslangici: bugun(),
                        })
                        setHata('')
                      }}
                    >
                      + Fiyat
                    </button>
                  )}

                  {fiyatFormu && (
                    <FiyatFormu
                      girdi={fiyatFormu}
                      kalemler={kalemler}
                      noktalar={aktifNoktalar}
                      onDegis={setFiyatFormu}
                      onIptal={() => setFiyatFormu(null)}
                      onKaydet={() => { void fiyatKaydet() }}
                    />
                  )}

                  <p className="muted detail-hint">
                    Fiyat defteri <strong>eklemelidir</strong>: satır
                    değiştirilemez ve silinemez. Zam, yeni bir geçerlilik
                    tarihiyle yeni satırdır — kesilmiş irsaliyenin fiyatı
                    sonradan değişmesin diye. Noktaya yazılan fiyat, müşteri
                    geneline yazılanı geçer.
                  </p>

                  {fiyatlar.length === 0 && (
                    <p className="muted detail-hint">Bu müşteri için fiyat girilmemiş.</p>
                  )}

                  {fiyatlar.length > 0 && (
                    <div className="table-wrap">
                      <table className="data-table compact">
                        <thead>
                          <tr>
                            <th>Ürün</th><th>Kapsam</th><th className="num">Fiyat</th>
                            <th>Geçerlilik</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fiyatlar.map(f => (
                            <tr key={f.id} className={f.kaldirildi ? 'is-passive' : ''}>
                              <td>{f.kalemAdi ?? '—'}</td>
                              <td className="muted">{fiyatKapsami(f)}</td>
                              <td className="num">{fiyatiYaz(f)}</td>
                              <td className="muted">{f.gecerlilikBaslangici}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

// ── Müşteri formu ──────────────────────────────────────────────────────────
type MusteriFormuProps = {
  girdi: MusteriGirdisi
  duzenleme: boolean
  onDegis: (girdi: MusteriGirdisi) => void
  onIptal: () => void
  onKaydet: () => void
}

// ── Portal erişimi (0054) ──────────────────────────────────────────────────
/**
 * "MİYOP bana bir form linki verecek, ben o linki kendi siteme ekleyeceğim."
 *
 * Bu panel o bağlantıyı KİMİN kullanabileceğini belirliyor.
 *
 * ⚠️ PAROLA YOK ve sorulmuyor. Giriş, buraya yazılan e-postaya gönderilen
 * tek kullanımlık bağlantıyla oluyor: unutulacak, sızacak, sıfırlanacak bir
 * parola yok. E-posta karttan silinince erişim o an kapanır.
 */
function PortalPaneli({
  kullanicilar, noktalar, yazabilir, onVer, onDegistir, onNoktalar,
}: {
  kullanicilar: PortalKullanicisi[]
  noktalar: TeslimNoktasi[]
  yazabilir: boolean
  onVer: (eposta: string, adSoyad: string, noktaIdler: string[]) => void
  onDegistir: (id: string, aktif: boolean) => void
  onNoktalar: (id: string, noktaIdler: string[]) => void
}){
  const [form, setForm] = React.useState(false)
  const [eposta, setEposta] = React.useState('')
  const [adSoyad, setAdSoyad] = React.useState('')
  const [secilenler, setSecilenler] = React.useState<string[]>([])
  const [acik, setAcik] = React.useState<string | null>(null)

  const noktaAdi = (id: string) => noktalar.find(n => n.id === id)?.ad ?? id

  const kapsam = (k: PortalKullanicisi) =>
    // ⚠️ BOŞ DİZİ = MERKEZ (bütün noktalar), "hiçbiri" DEĞİL. Bu, ekranda
    // açıkça yazılmazsa ters anlaşılan tek şey.
    k.noktaIdler.length === 0
      ? 'Merkez — bütün noktalar'
      : k.noktaIdler.map(noktaAdi).join(', ')

  return (
    <>
      <p className="muted detail-hint">
        Form bağlantısı: <code>{portalBaglantisi(window.location.origin)}</code>
        {' — '}bu bağlantıyı kendi sitenize koyabilirsiniz.
        {' '}
        <button
          className="btn ac" type="button"
          onClick={() => {
            // ⚠️ Pano yazımı bazı tarayıcılarda izin ister ve reddedilebilir.
            // Sessizce başarısız olmasın: bağlantı zaten ekranda yazılı.
            void navigator.clipboard?.writeText(gommeKodu(window.location.origin))
          }}
        >
          Gömme kodunu kopyala
        </button>
      </p>

      <p className="muted detail-hint">
        Portal kullanıcısı bu müşterinin siparişlerini girer ve izler.
        <strong> Fiyat görmez.</strong> Giriş parolayla değil, bu e-postaya
        gönderilen tek kullanımlık bağlantıyla yapılır. Gelen sipariş
        doğrudan <strong>Onay Bekliyor</strong> olarak düşer ve onay
        zincirinden geçer.
      </p>

      {yazabilir && !form && (
        <button className="btn" type="button" onClick={() => {
          setForm(true); setEposta(''); setAdSoyad(''); setSecilenler([])
        }}>
          + Portal erişimi ver
        </button>
      )}

      {form && (
        <form
          className="stacked-form"
          onSubmit={e => {
            e.preventDefault()
            onVer(eposta, adSoyad, secilenler)
            setForm(false)
          }}
        >
          <label>E-posta *
            <input
              type="email" value={eposta} required
              placeholder="satinalma@musteri.com"
              onChange={e => setEposta(e.target.value)}
            />
          </label>
          <label>Ad soyad
            <input value={adSoyad} onChange={e => setAdSoyad(e.target.value)} />
          </label>
          <fieldset>
            <legend>Hangi noktalara sipariş verebilir</legend>
            <p className="muted">
              Hiçbirini seçmezseniz <strong>merkez</strong> olur: müşterinin
              bütün noktalarına sipariş verebilir.
            </p>
            {noktalar.map(n => (
              <label key={n.id} className="check-row">
                <input
                  type="checkbox" checked={secilenler.includes(n.id)}
                  onChange={e => setSecilenler(
                    e.target.checked
                      ? [...secilenler, n.id]
                      : secilenler.filter(x => x !== n.id),
                  )}
                /> {n.ad}
              </label>
            ))}
          </fieldset>
          <div className="form-actions">
            <button className="btn primary" type="submit">Erişim ver</button>
            <button className="btn" type="button" onClick={() => setForm(false)}>Vazgeç</button>
          </div>
        </form>
      )}

      {kullanicilar.length === 0 && (
        <p className="muted detail-hint">
          Bu müşterinin portal erişimi yok — siparişleri telefonla alınıyor.
        </p>
      )}

      {kullanicilar.length > 0 && (
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr><th>E-posta</th><th>Ad</th><th>Kapsam</th><th>Durum</th><th></th></tr>
            </thead>
            <tbody>
              {kullanicilar.map(k => (
                <React.Fragment key={k.id}>
                  <tr>
                    <td>{k.eposta}</td>
                    <td className="muted">{k.adSoyad ?? '—'}</td>
                    <td className="muted">{kapsam(k)}</td>
                    <td>
                      <span className={k.aktif ? 'success-pill' : 'muted-pill'}>
                        {k.aktif ? 'açık' : 'kapalı'}
                      </span>
                    </td>
                    <td>
                      {yazabilir && (
                        <>
                          <button
                            className="btn ac" type="button"
                            onClick={() => {
                              setAcik(acik === k.id ? null : k.id)
                              setSecilenler([...k.noktaIdler])
                            }}
                          >
                            Noktalar
                          </button>
                          {' '}
                          <button
                            className="btn ac" type="button"
                            onClick={() => onDegistir(k.id, !k.aktif)}
                          >
                            {k.aktif ? 'Kapat' : 'Aç'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {acik === k.id && (
                    <tr>
                      <td colSpan={5}>
                        {noktalar.map(n => (
                          <label key={n.id} className="check-row">
                            <input
                              type="checkbox" checked={secilenler.includes(n.id)}
                              onChange={e => setSecilenler(
                                e.target.checked
                                  ? [...secilenler, n.id]
                                  : secilenler.filter(x => x !== n.id),
                              )}
                            /> {n.ad}
                          </label>
                        ))}
                        <div className="form-actions">
                          <button
                            className="btn primary" type="button"
                            onClick={() => { onNoktalar(k.id, secilenler); setAcik(null) }}
                          >
                            Kaydet
                          </button>
                          <span className="muted">
                            Hiçbiri seçili değilse merkez olur.
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}


function MusteriFormu({ girdi, duzenleme, onDegis, onIptal, onKaydet }: MusteriFormuProps){
  const alan = (ek: Partial<MusteriGirdisi>) => onDegis({ ...girdi, ...ek })

  return (
    <section className="card">
      <div className="section-header compact">
        <h3>{duzenleme ? 'Müşteriyi düzenle' : 'Yeni müşteri'}</h3>
      </div>
      <form
        className="stacked-form"
        onSubmit={event => { event.preventDefault(); onKaydet() }}
      >
        <label>Kod *
          <input value={girdi.kod} onChange={e => alan({ kod: e.target.value })} />
          <small className="muted">
            Sistem üretti. Kod müşteriyle konuşulan bir şey değil; kartı tekil
            kılar ve belgede kısa bir tutamak olur. Kendi müşteri kodunuz
            varsa üzerine yazabilirsiniz.
          </small>
        </label>
        <label>Ad *
          <input value={girdi.ad} onChange={e => alan({ ad: e.target.value })} />
        </label>
        <label>Vergi no
          <input value={girdi.vergiNo ?? ''} onChange={e => alan({ vergiNo: e.target.value })} />
        </label>
        <label>Vergi dairesi
          <input value={girdi.vergiDairesi ?? ''} onChange={e => alan({ vergiDairesi: e.target.value })} />
        </label>
        {/* ── Fatura bilgileri (0052) ───────────────────────────────────
            Fatura HENÜZ kesilmiyor. Bu alanlar bugün doldurulsun diye var:
            bir yıl canlı veriden sonra geriye dönük doldurmak pahalıdır. */}
        <label>Resmî ünvan
          <input
            value={girdi.resmiUnvan ?? ''}
            placeholder="Faturada yazan tam ünvan"
            onChange={e => alan({ resmiUnvan: e.target.value })}
          />
        </label>
        <div className="form-row">
          <label>İl
            <input value={girdi.il ?? ''} onChange={e => alan({ il: e.target.value })} />
          </label>
          <label>İlçe
            <input value={girdi.ilce ?? ''} onChange={e => alan({ ilce: e.target.value })} />
          </label>
        </div>
        <label>KEP adresi
          <input
            value={girdi.kepAdresi ?? ''}
            placeholder="firma@hs01.kep.tr"
            onChange={e => alan({ kepAdresi: e.target.value })}
          />
        </label>
        <label>e-Fatura mükellefi
          <select
            value={girdi.efaturaMukellefi === undefined ? '' : girdi.efaturaMukellefi ? 'e' : 'h'}
            onChange={e => alan({
              efaturaMukellefi: e.target.value === '' ? undefined : e.target.value === 'e',
            })}
          >
            <option value="">bilinmiyor</option>
            <option value="e">evet</option>
            <option value="h">hayır</option>
          </select>
        </label>
        {girdi.efaturaMukellefi !== undefined && (
          <label>Kontrol tarihi *
            <input
              type="date"
              value={girdi.efaturaKontrolTarihi ?? ''}
              onChange={e => alan({ efaturaKontrolTarihi: e.target.value })}
            />
            <small className="muted">
              Mükellefiyet sonradan başlar; tarihsiz bir &quot;hayır&quot;
              bir yıl sonra yanlıştır.
            </small>
          </label>
        )}
        <label>Yetkili
          <input value={girdi.yetkili ?? ''} onChange={e => alan({ yetkili: e.target.value })} />
        </label>
        <label>Telefon
          <input value={girdi.telefon ?? ''} onChange={e => alan({ telefon: e.target.value })} />
        </label>
        <label>E-posta
          <input value={girdi.eposta ?? ''} onChange={e => alan({ eposta: e.target.value })} />
        </label>
        <label>Adres
          <input value={girdi.adres ?? ''} onChange={e => alan({ adres: e.target.value })} />
        </label>
        <label>Ödeme vadesi (gün)
          <input
            type="number"
            min={0}
            value={metin(girdi.vadeGunu)}
            onChange={e => alan({ vadeGunu: sayi(e.target.value) })}
          />
          <small className="muted">Boş bırakılırsa &quot;vade konuşulmadı&quot;. Sıfır yazmak &quot;peşin&quot; demektir.</small>
        </label>

        <p className="muted detail-hint">
          <strong>Varsayılan sipariş penceresi.</strong> Teslim noktasının kendi
          penceresi yoksa buraya düşülür. İkisi de boşsa pencere yok — sipariş
          her saat girilebilir.
        </p>
        <label>Kesim saati
            <input
              placeholder="06:00"
              value={girdi.kesimSaati ?? ''}
              onChange={e => alan({ kesimSaati: e.target.value })}
            />
          </label>
          <label>Teslim gün farkı
            <input
              type="number"
              min={0}
              value={metin(girdi.teslimGunFarki)}
              onChange={e => alan({ teslimGunFarki: sayi(e.target.value) })}
            />
            <small className="muted">0 = aynı gün, 1 = ertesi gün.</small>
          </label>

        <label>Not
          <input value={girdi.not ?? ''} onChange={e => alan({ not: e.target.value })} />
        </label>

        <div className="form-actions">
          <button className="btn" type="button" onClick={onIptal}>İptal</button>
          <button className="btn primary" type="submit">Kaydet</button>
        </div>
      </form>
    </section>
  )
}

// ── Teslim noktası formu ───────────────────────────────────────────────────
type NoktaFormuProps = {
  girdi: TeslimNoktasiGirdisi
  duzenleme: boolean
  onDegis: (girdi: TeslimNoktasiGirdisi) => void
  onIptal: () => void
  onKaydet: () => void
}

function NoktaFormu({ girdi, duzenleme, onDegis, onIptal, onKaydet }: NoktaFormuProps){
  const alan = (ek: Partial<TeslimNoktasiGirdisi>) => onDegis({ ...girdi, ...ek })

  return (
    <form
      className="stacked-form"
      onSubmit={event => { event.preventDefault(); onKaydet() }}
    >
      <h4>{duzenleme ? 'Teslim noktasını düzenle' : 'Yeni teslim noktası'}</h4>
      <label>Kod *
        <input value={girdi.kod} onChange={e => alan({ kod: e.target.value })} />
        <small className="muted">
          Müşteri kodunun altında sıralanıyor. İrsaliyede görülünce hangi
          müşterinin kaçıncı noktası olduğu belli olur.
        </small>
      </label>
      <label>Ad *
        <input
          placeholder="Migros Ataşehir"
          value={girdi.ad}
          onChange={e => alan({ ad: e.target.value })}
        />
      </label>
      <label>Adres
        <input value={girdi.adres ?? ''} onChange={e => alan({ adres: e.target.value })} />
      </label>
      <label>İlçe
        <input value={girdi.ilce ?? ''} onChange={e => alan({ ilce: e.target.value })} />
      </label>
      <label>İl
        <input value={girdi.il ?? ''} onChange={e => alan({ il: e.target.value })} />
      </label>
      <label>Kapıdaki yetkili
        <input value={girdi.yetkili ?? ''} onChange={e => alan({ yetkili: e.target.value })} />
      </label>
      <label>Telefon
        <input value={girdi.telefon ?? ''} onChange={e => alan({ telefon: e.target.value })} />
      </label>

      <p className="muted detail-hint">
        <strong>Bu noktanın kendi sipariş penceresi.</strong> Boş bırakılırsa
        müşterinin varsayılanı geçerli olur. Boş bırakmak bir eksiklik değil,
        geçerli bir seçim.
      </p>
      <label>Kesim saati
          <input
            placeholder="06:00"
            value={girdi.kesimSaati ?? ''}
            onChange={e => alan({ kesimSaati: e.target.value })}
          />
        </label>
        <label>Teslim gün farkı
          <input
            type="number"
            min={0}
            value={metin(girdi.teslimGunFarki)}
            onChange={e => alan({ teslimGunFarki: sayi(e.target.value) })}
          />
        </label>

      <p className="muted detail-hint">
        <strong>Teslim saat aralığı.</strong> Aracın kapıda kabul edildiği saatler.
      </p>
      <label>Başlangıç
          <input
            placeholder="07:00"
            value={girdi.teslimBaslangic ?? ''}
            onChange={e => alan({ teslimBaslangic: e.target.value })}
          />
        </label>
        <label>Bitiş
          <input
            placeholder="11:00"
            value={girdi.teslimBitis ?? ''}
            onChange={e => alan({ teslimBitis: e.target.value })}
          />
        </label>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit">Kaydet</button>
      </div>
    </form>
  )
}

// ── Fiyat formu ────────────────────────────────────────────────────────────
type FiyatFormuProps = {
  girdi: FiyatGirdisi
  kalemler: KatalogKalemi[]
  noktalar: TeslimNoktasi[]
  onDegis: (girdi: FiyatGirdisi) => void
  onIptal: () => void
  onKaydet: () => void
}

function FiyatFormu({ girdi, kalemler, noktalar, onDegis, onIptal, onKaydet }: FiyatFormuProps){
  const alan = (ek: Partial<FiyatGirdisi>) => onDegis({ ...girdi, ...ek })
  const secilenKalem = kalemler.find(k => k.id === girdi.kalemId)

  return (
    <form
      className="stacked-form"
      onSubmit={event => { event.preventDefault(); onKaydet() }}
    >
      <h4>Yeni fiyat satırı</h4>

      <label>Ürün *
        <select
          value={girdi.kalemId}
          onChange={e => {
            const kalem = kalemler.find(k => k.id === e.target.value)
            // Birim varsayılan olarak defterin temel birimi. Kullanıcı
            // palet/koli ile satıyorsa değiştirir — ama boş kalmaz, çünkü
            // birimi olmayan bir fiyat çarpımı yanlış yapar.
            alan({ kalemId: e.target.value, birim: girdi.birim || (kalem?.temelBirim ?? '') })
          }}
        >
          <option value="">Seçin…</option>
          {kalemler.filter(k => k.aktif).map(k => (
            <option key={k.id} value={k.id}>{k.kod} · {k.ad}</option>
          ))}
        </select>
      </label>

      <label>Kapsam
        <select
          value={girdi.noktaId ?? ''}
          onChange={e => alan({ noktaId: e.target.value === '' ? undefined : e.target.value })}
        >
          <option value="">Bütün teslim noktaları</option>
          {noktalar.map(n => <option key={n.id} value={n.id}>{n.ad}</option>)}
        </select>
        <small className="muted">
          Bir nokta seçerseniz fiyat yalnız orada geçerli olur ve müşteri
          geneline yazılan fiyatı geçer.
        </small>
      </label>

      <label>Birim fiyat *
        <input
          type="number"
          step="0.01"
          min={0}
          value={girdi.birimFiyat}
          onChange={e => alan({ birimFiyat: Number(e.target.value) })}
        />
      </label>

      <label>Birim *
        <input
          placeholder={secilenKalem?.temelBirim ?? 'kg'}
          value={girdi.birim}
          onChange={e => alan({ birim: e.target.value })}
        />
        <small className="muted">
          Fiyat hangi birim için? Sipariş palet veya koli ile giriliyorsa
          fiyat da o birimde yazılmalı.
        </small>
      </label>

      <label>Para birimi
        <select value={girdi.paraBirimi} onChange={e => alan({ paraBirimi: e.target.value })}>
          <option value="TRY">TRY</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </label>

      <label>Geçerlilik başlangıcı *
        <input
          type="date"
          value={girdi.gecerlilikBaslangici}
          onChange={e => alan({ gecerlilikBaslangici: e.target.value })}
        />
      </label>

      <label className="supplier-toggle">
        <input
          type="checkbox"
          checked={girdi.kaldirildi ?? false}
          onChange={e => alan({ kaldirildi: e.target.checked, birimFiyat: e.target.checked ? 0 : girdi.birimFiyat })}
        />
        Fiyatı kaldır (bu tarihten sonra fiyatlı değil)
      </label>

      <label>Not
        <input value={girdi.not ?? ''} onChange={e => alan({ not: e.target.value })} />
      </label>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit">Deftere yaz</button>
      </div>
    </form>
  )
}
