// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C3 — MÜŞTERİ SİPARİŞ EKRANI
//
// Emrah'ın modeli: "MİYOP bana bir form linki verecek, ben o linki kendi
// siteme ekleyeceğim. Müşterimin müşterileri oradan sipariş verecek."
//
// Bu ekran MÜŞTERİNİN elinde çalışıyor. Üç şey bu yüzden farklı:
//
//   1. UYGULAMA KABUĞU YOK. Menü, kontrol paneli, işletme adı — hiçbiri
//      görünmez. Müşteri bizim iç ekranlarımızı görmez.
//   2. FİYAT YOK. Emrah'ın kararı. Tipinde bile yok (portal.repository).
//   3. BURADAKİ HİÇBİR KONTROLE GÜVENİLMEZ. Hepsi 0054'te tekrar yapılıyor;
//      bunlar yalnız iyi bir cümle kurmak için.
//
// ⚠️ PAROLA SORULMUYOR. Giriş, e-postaya gönderilen tek kullanımlık
// bağlantıyla. Parola unutulur, sızar, sıfırlanır — hiçbiri olmasın.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import {
  PostgresPortalDeposu, type PortalNoktasi, type PortalSatiri,
  type PortalSiparisi, type PortalUrunu,
} from '../portal/portal.repository'
import { PortalServisi, portalDurumu, tarihCumlesi } from '../portal/portal.service'
import { portalGirisiniCozumle } from '../portal/portal-giris'

const hataMetni = (h: unknown) =>
  h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.'

const tarih = (d?: string) =>
  (d ? new Date(`${d}T00:00:00`).toLocaleDateString('tr-TR') : '—')

type SatirTaslagi = { kalemId: string; miktar: string }
const bosSatir = (): SatirTaslagi => ({ kalemId: '', miktar: '' })

/**
 * ⚠️ İLK ÇİZİMDEN ÖNCE OKUNUYOR ve adres çubuğu HEMEN temizleniyor.
 *
 * Sonra okusaydık React iki kez çizerken parça kaybolabilirdi; temizlemeseydik
 * müşterinin oturum jetonu adres çubuğunda kalırdı ve ekran görüntüsüyle
 * paylaşılabilirdi (davet akışındaki aynı ders, 0039).
 */
const ILK_GIRIS = typeof window === 'undefined'
  ? { durum: 'yok' as const }
  : portalGirisiniCozumle(window.location.hash)

// ⚠️⚠️ ADRES YALNIZ BİZİM PARÇAMIZSA TEMİZLENİR.
//
// Bu dosya App.tsx tarafından `import` ediliyor ve ES modüllerinde içe
// aktarılan modülün gövdesi, aktaran modülün gövdesinden ÖNCE çalışır.
// Yani buradaki temizlik, App.tsx'in DAVET parçasını (`type=invite`)
// okumasından önce olur. Koşulsuz temizleseydik davet edilen her çalışanın
// bağlantısı sessizce silinir ve "davet yok" sayılıp giriş ekranında
// kalırdı — hiç fark edilmeyecek bir kırılma.
//
// `portalGirisiniCozumle` yalnız `magiclink` için 'var'/'hata' döndürüyor;
// davet ve şifre sıfırlama parçalarına dokunmuyoruz.
if(typeof window !== 'undefined' && ILK_GIRIS.durum !== 'yok'){
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

export default function Portal(){
  const [oturumVar, setOturumVar] = React.useState(false)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState(
    ILK_GIRIS.durum === 'hata' ? ILK_GIRIS.mesaj : '',
  )
  const [bilgi, setBilgi] = React.useState('')
  const [eposta, setEposta] = React.useState('')

  const [noktalar, setNoktalar] = React.useState<PortalNoktasi[]>([])
  const [noktaId, setNoktaId] = React.useState('')
  const [urunler, setUrunler] = React.useState<PortalUrunu[]>([])
  const [enErken, setEnErken] = React.useState<string>()
  const [teslim, setTeslim] = React.useState('')
  const [satirlar, setSatirlar] = React.useState<SatirTaslagi[]>([bosSatir()])
  const [not, setNot] = React.useState('')
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  const [siparisler, setSiparisler] = React.useState<PortalSiparisi[]>([])
  const [acikSiparis, setAcikSiparis] = React.useState<string | null>(null)
  const [acikSatirlar, setAcikSatirlar] = React.useState<PortalSatiri[]>([])

  const servis = React.useMemo(() => {
    if(!isSupabaseConfigured()) return null
    return new PortalServisi(new PostgresPortalDeposu(getSupabase()))
  }, [])

  // Oturum: ya adresteki bağlantıdan kuruluyor ya da zaten varsa okunuyor.
  React.useEffect(() => {
    let iptal = false
    ;(async () => {
      if(!isSupabaseConfigured()){ setYukleniyor(false); return }
      try{
        const sb = getSupabase()
        if(ILK_GIRIS.durum === 'var'){
          const { error } = await sb.auth.setSession({
            access_token: ILK_GIRIS.erisimJetonu,
            refresh_token: ILK_GIRIS.yenilemeJetonu,
          })
          if(error) throw new Error(error.message)
        }
        const { data } = await sb.auth.getSession()
        if(iptal) return
        setOturumVar(Boolean(data.session))
      } catch (e){ if(!iptal) setHata(hataMetni(e)) }
      finally { if(!iptal) setYukleniyor(false) }
    })()
    return () => { iptal = true }
  }, [])

  // Oturum varsa: noktalar ve geçmiş siparişler.
  React.useEffect(() => {
    if(!oturumVar || !servis) return
    let iptal = false
    ;(async () => {
      try{
        const [n, s] = await Promise.all([servis.noktalarim(), servis.siparislerim()])
        if(iptal) return
        setNoktalar(n)
        setSiparisler(s)
        if(n.length === 1 && n[0]) setNoktaId(n[0].noktaId)
      } catch (e){ if(!iptal) setHata(hataMetni(e)) }
    })()
    return () => { iptal = true }
  }, [oturumVar, servis])

  // Nokta seçilince: o noktanın ürünleri ve en erken tarihi.
  React.useEffect(() => {
    if(!noktaId || !servis) return
    let iptal = false
    ;(async () => {
      try{
        const [u, e] = await Promise.all([
          servis.urunlerim(noktaId), servis.enErkenSevk(noktaId),
        ])
        if(iptal) return
        setUrunler(u)
        setEnErken(e)
        // Tarihi KENDİLİĞİNDEN dolduruyoruz: müşteri geçmiş bir tarih yazıp
        // reddedilmesin. Değiştirebiliyor ama erkene alamıyor.
        if(e) setTeslim(t => t || e)
      } catch (err){ if(!iptal) setHata(hataMetni(err)) }
    })()
    return () => { iptal = true }
  }, [noktaId, servis])

  const girisIste = async (e: React.FormEvent) => {
    e.preventDefault()
    if(!isSupabaseConfigured()) return
    try{
      const { error } = await getSupabase().auth.signInWithOtp({
        email: eposta.trim().toLowerCase(),
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      })
      if(error) throw new Error(error.message)
      setHata('')
      // ⚠️ "Kayıtlıysa" diyoruz. "Bu e-posta kayıtlı değil" deseydik, form
      // bir müşteri listesi sorgulama aracına dönerdi.
      setBilgi(
        `${eposta.trim()} adresine bir giriş bağlantısı gönderildi (kayıtlı bir `
        + 'adresse). Bağlantı tek kullanımlıktır ve kısa süre geçerlidir.',
      )
    } catch (err){ setBilgi(''); setHata(hataMetni(err)) }
  }

  const cikis = async () => {
    if(isSupabaseConfigured()) await getSupabase().auth.signOut()
    setOturumVar(false); setNoktalar([]); setSiparisler([]); setNoktaId('')
  }

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault()
    if(!servis) return
    setGonderiliyor(true)
    try{
      const no = await servis.siparisVer(
        noktaId,
        satirlar
          .filter(s => s.kalemId && s.miktar)
          .map(s => ({
            kalemId: s.kalemId,
            miktar: Number(s.miktar.replace(',', '.')),
            birim: urunler.find(u => u.kalemId === s.kalemId)?.birim ?? '',
          })),
        teslim || undefined,
        not || undefined,
      )
      setHata('')
      setBilgi(
        `Siparişiniz alındı: ${no}. İnceleniyor — onaylandığında teslim `
        + 'tarihi kesinleşecek.',
      )
      setSatirlar([bosSatir()]); setNot('')
      setSiparisler(await servis.siparislerim())
    } catch (err){ setBilgi(''); setHata(hataMetni(err)) }
    finally { setGonderiliyor(false) }
  }

  const satirlariAc = async (no: string) => {
    if(!servis) return
    if(acikSiparis === no){ setAcikSiparis(null); return }
    try{
      setAcikSatirlar(await servis.satirlarim(no))
      setAcikSiparis(no)
    } catch (e){ setHata(hataMetni(e)) }
  }

  if(!isSupabaseConfigured()){
    return (
      <div className="portal-page">
        <p className="form-error">Sipariş formu şu anda kullanılamıyor.</p>
      </div>
    )
  }

  if(yukleniyor) return <div className="portal-page"><p className="muted">Yükleniyor…</p></div>

  // ── Giriş ekranı ────────────────────────────────────────────────────────
  if(!oturumVar){
    return (
      <div className="portal-page">
        <h1>Sipariş formu</h1>
        <p className="muted">
          E-posta adresinizi yazın; size tek kullanımlık bir giriş bağlantısı
          gönderelim. <strong>Parola gerekmiyor.</strong>
        </p>
        {hata && <div className="form-error">{hata}</div>}
        {bilgi && <div className="form-info">{bilgi}</div>}
        <form className="stacked-form" onSubmit={girisIste}>
          <label>E-posta
            <input
              type="email" required value={eposta}
              onChange={e => setEposta(e.target.value)}
              placeholder="satinalma@firmaniz.com"
            />
          </label>
          <button className="btn primary" type="submit">Giriş bağlantısı gönder</button>
        </form>
      </div>
    )
  }

  // ── Portal kullanıcısı değil ────────────────────────────────────────────
  if(noktalar.length === 0){
    return (
      <div className="portal-page">
        <h1>Sipariş formu</h1>
        <div className="form-error">
          Bu hesaba bağlı bir teslim noktası bulunamadı. Sipariş verebilmek
          için tedarikçinizin bu e-postayı müşteri kartınıza tanımlaması
          gerekiyor.
        </div>
        <button className="btn" type="button" onClick={() => { void cikis() }}>Çıkış</button>
      </div>
    )
  }

  const secilenNokta = noktalar.find(n => n.noktaId === noktaId)

  return (
    <div className="portal-page">
      <div className="page-title">
        <div>
          <h1>Sipariş formu</h1>
          <p className="muted">Siparişinizi girin ve durumunu buradan izleyin.</p>
        </div>
        <button className="btn" type="button" onClick={() => { void cikis() }}>Çıkış</button>
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-info">{bilgi}</div>}

      <section className="card">
        <h2>Yeni sipariş</h2>
        <form className="stacked-form" onSubmit={gonder}>
          <label>Teslim noktası *
            <select value={noktaId} onChange={e => { setNoktaId(e.target.value); setSatirlar([bosSatir()]) }}>
              <option value="">Seçin…</option>
              {noktalar.map(n => (
                <option key={n.noktaId} value={n.noktaId}>
                  {n.ad}{n.ilce ? ` · ${n.ilce}` : ''}
                </option>
              ))}
            </select>
          </label>

          {secilenNokta?.adres && <p className="muted">{secilenNokta.adres}</p>}

          {noktaId && (
            <>
              {/* ⚠️ En erken tarihi SÖYLÜYORUZ. Kesim saatini geçtiyse sipariş
                  bir sonraki güne kayar; bunu yazmasak müşteri "neden yarın
                  değil" diye soracaktı (0054, MI432). */}
              <label>Teslim tarihi
                <input
                  type="date" value={teslim} min={enErken}
                  onChange={e => setTeslim(e.target.value)}
                />
                {enErken && (
                  <small className="muted">
                    Bu noktaya en erken <strong>{tarih(enErken)}</strong> teslim
                    edilebilir. Sipariş kesim saatini geçtiyse bir sonraki güne kayar.
                  </small>
                )}
              </label>

              <fieldset>
                <legend>Ürünler</legend>
                {urunler.length === 0 && (
                  <p className="muted">
                    Bu noktaya tanımlı ürün yok. Tedarikçinizle görüşün.
                  </p>
                )}
                {satirlar.map((s, i) => (
                  <div className="form-row" key={i}>
                    <label>Ürün
                      <select
                        value={s.kalemId}
                        onChange={e => setSatirlar(satirlar.map((x, j) =>
                          j === i ? { ...x, kalemId: e.target.value } : x))}
                      >
                        <option value="">Seçin…</option>
                        {urunler
                          // Aynı ürünü iki satırda seçtirmiyoruz: biri
                          // diğerini gizler ve müşteri hangisinin gittiğini
                          // bilemez.
                          .filter(u => u.kalemId === s.kalemId
                            || !satirlar.some(x => x.kalemId === u.kalemId))
                          .map(u => (
                            <option key={u.kalemId} value={u.kalemId}>
                              {u.ad} ({u.birim})
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>Miktar
                      <input
                        inputMode="decimal" value={s.miktar}
                        onChange={e => setSatirlar(satirlar.map((x, j) =>
                          j === i ? { ...x, miktar: e.target.value } : x))}
                      />
                    </label>
                    {satirlar.length > 1 && (
                      <button
                        className="btn ac" type="button"
                        onClick={() => setSatirlar(satirlar.filter((_, j) => j !== i))}
                      >
                        Sil
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="btn" type="button"
                  disabled={satirlar.length >= urunler.length}
                  onClick={() => setSatirlar([...satirlar, bosSatir()])}
                >
                  + Satır
                </button>
              </fieldset>

              <label>Not
                <textarea rows={2} value={not} onChange={e => setNot(e.target.value)} />
              </label>

              <button className="btn primary" type="submit" disabled={gonderiliyor}>
                {gonderiliyor ? 'Gönderiliyor…' : 'Siparişi gönder'}
              </button>
              <p className="muted">
                Sipariş gönderildikten sonra tedarikçiniz inceler. Teslim
                tarihi onayla birlikte kesinleşir.
              </p>
            </>
          )}
        </form>
      </section>

      <section className="card">
        <h2>Siparişlerim</h2>
        {siparisler.length === 0 && <p className="muted">Henüz siparişiniz yok.</p>}
        {siparisler.length > 0 && (
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr><th>Sipariş</th><th>Nokta</th><th>Tarihler</th><th>Durum</th><th></th></tr>
              </thead>
              <tbody>
                {siparisler.map(s => (
                  <React.Fragment key={s.siparisNo}>
                    <tr>
                      <td>{s.siparisNo}</td>
                      <td className="muted">{s.noktaAdi ?? '—'}</td>
                      <td className="muted">{tarihCumlesi(s)}</td>
                      <td>{portalDurumu(s.durum)}</td>
                      <td>
                        <button
                          className="btn ac" type="button"
                          onClick={() => { void satirlariAc(s.siparisNo) }}
                        >
                          {acikSiparis === s.siparisNo ? 'Kapat' : 'Aç ›'}
                        </button>
                      </td>
                    </tr>
                    {acikSiparis === s.siparisNo && (
                      <tr>
                        <td colSpan={5}>
                          <ul>
                            {acikSatirlar.map((l, i) => (
                              <li key={i}>
                                {l.kalemAdi} — {l.miktar.toLocaleString('tr-TR')} {l.birim}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
