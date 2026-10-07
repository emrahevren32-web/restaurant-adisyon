// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · ANALİZ — GERÇEK DEFTERDEN
//
// Emrah (07.10.2026): *"görünsün ama gerçeğe dayalı olsun!"*
//
// ⚠️ BU EKRANDA UYDURMA RAKAM YOKTUR. Katsayı yok, "sektör ortalaması" yok,
// "size yılda şu kadar kazandırır" yok. Her sayının altında bir
// `stock_movement` ya da bir `sales_order` satırı var ve dökümde hangisi
// olduğu yazıyor.
//
// ⚠️ EKRAN HESAPLAMIYOR. Toplama ve değerleme 0065'te, veritabanında.
// Burada yapılsaydı iki yerde iki hesap olurdu; ekranla rapor tutmazdı.
//
// ⚠️ KARŞILAŞTIRMA İŞLETMENİN KENDİ GEÇMİŞİYLE. "Geçen döneme göre arttı"
// doğrulanabilir bir cümledir; "sektöre göre yüksek" değildir, çünkü öyle
// bir veriye sahip değiliz.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { resolveStockRepositoryMode } from '../core/stock/index'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import {
  PostgresGostergeDeposu, oncekiDonem, sonGunler, type Donem,
} from '../reporting/gosterge.repository'
import {
  bulgular, fireNedeniYaz, fireOrani, fireninYogunlastigi, nedeneGoreFire,
  ozetiOku, paraYaz, sayiYaz, yuzdeYaz,
  type Bulgu, type FireSatiri, type Onem, type Ozet,
} from '../reporting/gostergeler'

type Props = { currentUser: User }

const hataMetni = (h: unknown) =>
  h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.'

const ARALIKLAR = [
  { gun: 7,   ad: 'Son 7 gün' },
  { gun: 30,  ad: 'Son 30 gün' },
  { gun: 90,  ad: 'Son 90 gün' },
  { gun: 365, ad: 'Son 1 yıl' },
] as const

const ONEM_SINIFI: Record<Onem, string> = {
  kritik: 'bulgu-kritik',
  uyari:  'bulgu-uyari',
  bilgi:  'bulgu-bilgi',
  iyi:    'bulgu-iyi',
}

const ONEM_ETIKETI: Record<Onem, string> = {
  kritik: 'Acil',
  uyari:  'Dikkat',
  bilgi:  'Bilgi',
  iyi:    'Sorun yok',
}

const tarihYaz = (g: string) => {
  const [y, a, d] = g.split('-')
  return `${d}.${a}.${y}`
}

export default function Analiz({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  // ⚠️ `finance.read` — PARA İZNİ. Bu ekranda fire TUTARI, alım tutarı ve
  // stok değeri var; bunlar maliyet bilgisidir. Depo, üretim, kalite ve
  // sevkiyat rollerinde bu izin YOK ve olmamalı (07.10 kararı: parayı
  // yalnız müdür ve işletme sahibi görür). İşletme sahibi, müdür, muhasebe
  // ve satınalma görür.
  //
  // ⚠️ Menüde gizlemek YETMEZ; kapı burada da duruyor.
  const gorebilir = !currentUser.permissions
    || currentUser.permissions.includes('finance.read')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [gun, setGun] = React.useState<number>(30)
  const [ozet, setOzet] = React.useState<Ozet | null>(null)
  const [gecmis, setGecmis] = React.useState<Ozet | null>(null)
  const [fire, setFire] = React.useState<FireSatiri[]>([])
  const [donem, setDonem] = React.useState<Donem | null>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')

  const depo = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new PostgresGostergeDeposu(getSupabase())
  }, [mod])

  React.useEffect(() => {
    let iptal = false
    if(!depo){ setYukleniyor(false); return }
    ;(async () => {
      setYukleniyor(true)
      try{
        const kurulan = baglam ?? await depoBaglamiKur(getSupabase())
        if(iptal) return
        if(!baglam) setBaglam(kurulan)

        const d = sonGunler(gun)
        const o = oncekiDonem(d)

        // ⚠️ İKİ DÖNEM BİRDEN okunuyor: karşılaştırma cümlesi ancak geçmişin
        // gerçek sayısı elde olunca kurulabiliyor. Tahmin edilmiyor.
        const [simdi, once, dokum] = await Promise.all([
          depo.gostergeler(kurulan.ctx, d),
          depo.gostergeler(kurulan.ctx, o),
          depo.fireDokumu(kurulan.ctx, d),
        ])
        if(iptal) return

        setDonem(d)
        setOzet(ozetiOku(simdi))
        setGecmis(ozetiOku(once))
        setFire(dokum)
        setHata('')
      } catch (e){ if(!iptal) setHata(hataMetni(e)) }
      finally { if(!iptal) setYukleniyor(false) }
    })()
    return () => { iptal = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depo, gun])

  if(!gorebilir){
    return (
      <div className="page">
        <div className="page-title"><div><h2>Analiz</h2></div></div>
        <p className="muted">Bu ekranı görme yetkiniz yok.</p>
      </div>
    )
  }

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="page">
        <div className="page-title"><div><h2>Analiz</h2></div></div>
        {/* ⚠️ Veritabanı yoksa ÖRNEK RAKAM GÖSTERMİYORUZ. Boş bir ekran,
            uydurma dolu bir ekrandan iyidir. */}
        <div className="form-error">
          Bu ekran yalnız gerçek veritabanıyla çalışır. Örnek veri
          göstermiyoruz: bir analiz ekranının uydurma rakamı, olmamasından
          kötüdür.
        </div>
      </div>
    )
  }

  const liste: Bulgu[] = ozet ? bulgular(ozet, gecmis ?? undefined) : []
  const oran = ozet ? fireOrani(ozet.fireTutari, ozet.alimTutari) : undefined
  const yogun = fireninYogunlastigi(fire)
  const nedenler = nedeneGoreFire(fire)
  const enBuyukler = [...fire]
    .filter(f => typeof f.tutar === 'number' && (f.tutar ?? 0) > 0)
    .sort((a, b) => (b.tutar ?? 0) - (a.tutar ?? 0))
    .slice(0, 10)

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h2>Analiz</h2>
          <p className="muted">
            Bütün rakamlar işletmenin kendi defterinden.
            {donem && <> {tarihYaz(donem.bas)} – {tarihYaz(donem.bit)}</>}
          </p>
        </div>
        <div className="form-actions">
          {ARALIKLAR.map(a => (
            <button
              key={a.gun}
              type="button"
              className={`btn ${gun === a.gun ? 'primary' : ''}`}
              onClick={() => setGun(a.gun)}
            >{a.ad}</button>
          ))}
        </div>
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {yukleniyor && <p className="muted">Defter okunuyor…</p>}

      {!yukleniyor && ozet && (
        <>
          {/* ── NE YAPMALI ───────────────────────────────────────────────
              ⚠️ Rakamlardan ÖNCE geliyor. Bir yönetici ekranı açtığında
              "ne oldu" değil "ne yapmam lazım" sorusunu sorar; sayı tablosu
              bu soruya cevap vermez, cümle verir. */}
          <h3>Ne yapmalı</h3>
          <div className="bulgu-listesi">
            {liste.map(b => (
              <div key={b.anahtar} className={`bulgu ${ONEM_SINIFI[b.onem]}`}>
                <div className="bulgu-ust">
                  <span className="bulgu-rozet">{ONEM_ETIKETI[b.onem]}</span>
                  <strong>{b.baslik}</strong>
                </div>
                <p>{b.cumle}</p>
                <p className="bulgu-yapilacak">{b.yapilacak}</p>
              </div>
            ))}
          </div>

          {/* ── SAYILAR ──────────────────────────────────────────────── */}
          <h3>Sayılar</h3>
          <div className="gosterge-grid">
            <Kutu
              baslik="Dönem firesi"
              deger={paraYaz(ozet.fireTutari)}
              alt={oran !== undefined
                ? `Alımın ${yuzdeYaz(oran)}'i · ${sayiYaz(ozet.fireKalemSayisi)} kalem`
                : `${sayiYaz(ozet.fireKalemSayisi)} kalem`}
              eksik={ozet.fireFiyatsizHareket > 0}
            />
            <Kutu
              baslik="Tarihi geçmiş stok"
              deger={paraYaz(ozet.sktGecmisDeger)}
              alt={`${sayiYaz(ozet.sktGecmisParti)} parti · hâlâ depoda`}
            />
            <Kutu
              baslik="30 günde dolacak"
              deger={paraYaz(ozet.sktYaklasanDeger)}
              alt={`${sayiYaz(ozet.sktYaklasanParti)} parti`}
            />
            <Kutu
              baslik="Dönem alımı"
              deger={paraYaz(ozet.alimTutari)}
              alt="Mal kabulle giren"
            />
            <Kutu
              baslik="Sipariş"
              deger={sayiYaz(ozet.siparisSayisi)}
              alt={`${sayiYaz(ozet.iptalSiparis)} iptal · `
                + `${sayiYaz(ozet.farkliTeslimSiparis)} teslimde fark`}
            />
            <Kutu
              baslik="Geciken sipariş"
              deger={sayiYaz(ozet.gecikenSiparis)}
              alt="Teslim tarihi geçmiş, teslim edilmemiş"
            />
            <Kutu
              baslik="Onay bekleyen"
              deger={sayiYaz(ozet.onayBekleyenSiparis)}
              alt="Zincirde bekliyor"
            />
            <Kutu
              baslik="Kritik seviyede"
              deger={sayiYaz(ozet.kritikKalem)}
              alt="En az miktarının altında"
            />
          </div>

          {/* ── FİRE NEREDEN GELİYOR ─────────────────────────────────────
              "Fire 47.000 TL" kimseye bir şey yaptırmaz. "31.000'i SKT'den
              ve 19.000'i tek bir üründen" bir karar aldırır. */}
          <h3>Fire nereden geliyor</h3>

          {fire.length === 0 && (
            <p className="muted">Bu dönemde fire kaydı yok.</p>
          )}

          {fire.length > 0 && (
            <>
              {yogun && yogun.kalemSayisi > 0 && (
                <p>
                  Firenin <strong>{yuzdeYaz(yogun.kapsanan / yogun.toplam)}</strong>'i
                  {' '}<strong>{sayiYaz(yogun.kalemSayisi)} kalemden</strong> geliyor.
                  {' '}Önce bunlara bak.
                </p>
              )}

              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr><th>Sebep</th><th className="num">Tutar</th><th className="num">Satır</th></tr>
                  </thead>
                  <tbody>
                    {nedenler.map(n => (
                      <tr key={n.neden}>
                        <td>{fireNedeniYaz(n.neden)}</td>
                        <td className="num">
                          {paraYaz(n.tutar)}
                          {/* ⚠️ Eksik tutarı tam gibi göstermek, raporun
                              tamamına olan güveni bitirir. */}
                          {n.eksik && <span className="muted"> + fiyatsız</span>}
                        </td>
                        <td className="num muted">{sayiYaz(n.kalem)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4>En çok fire veren kalemler</h4>
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Ürün</th><th>Sebep</th>
                      <th className="num">Miktar</th><th className="num">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enBuyukler.length === 0 && (
                      <tr><td colSpan={4} className="muted">
                        Fire var ama hiçbirinin alış fiyatı bulunamadı; tutar
                        hesaplanamıyor.
                      </td></tr>
                    )}
                    {enBuyukler.map(f => (
                      <tr key={`${f.neden}-${f.kalemId}`}>
                        {/* ⚠️ Kalem kartı silinmişse ad boş gelir ve
                            UYDURULMAZ; kimliğin başı yazılır. */}
                        <td>{f.kalemAdi ?? `Kalem kaydı bulunamadı (${f.kalemId.slice(0, 8)}…)`}</td>
                        <td className="muted">{fireNedeniYaz(f.neden)}</td>
                        <td className="num">{sayiYaz(f.miktar)} {f.birim ?? ''}</td>
                        <td className="num">{paraYaz(f.tutar ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── BU SAYILAR NEREDEN GELİYOR ───────────────────────────────
              Müşteri bir rakamı sorduğunda cevabın ekranda olması gerekir.
              "Bilmiyorum, sistem öyle hesaplıyor" diyen bir satıcı o satışı
              kaybeder. */}
          <h3>Bu sayılar nereden geliyor</h3>
          <ul className="muted">
            <li>
              <strong>Fire</strong> — stok defterindeki zayi, tarihi geçtiği
              için imha, üretim firesi ve sayımda eksik çıkan hareketler.
              Her biri <strong>o günkü alış fiyatıyla</strong> değerlenir;
              bugünkü zam dünün firesini pahalılaştırmaz.
            </li>
            <li>
              <strong>İptal edilen hareketler sayılmaz.</strong> Ters kayıt ve
              iptal ettiği hareket, ikisi birden hesap dışıdır.
            </li>
            <li>
              <strong>Tarihi geçmiş stok</strong> — bugün elde duran partiler.
              Tükenmiş bir parti risk sayılmaz.
            </li>
            <li>
              <strong>Karşılaştırma</strong> bir önceki aynı uzunluktaki
              dönemle yapılır. Sektör ortalaması kullanmıyoruz — elimizde
              öyle bir veri yok ve uydurmuyoruz.
            </li>
            {ozet.fireFiyatsizHareket > 0 && (
              <li>
                <strong>Fire tutarı eksiktir:</strong>{' '}
                {sayiYaz(ozet.fireFiyatsizHareket)} hareketin alış fiyatı
                bulunamadı ve bu hareketler tutara girmedi.
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  )
}

function Kutu({ baslik, deger, alt, eksik }: {
  baslik: string; deger: string; alt?: string; eksik?: boolean
}){
  return (
    <div className="gosterge-kutu">
      <div className="gosterge-baslik">{baslik}</div>
      <div className="gosterge-deger">
        {deger}
        {eksik && <span className="gosterge-eksik" title="Fiyatı bulunamayan hareket var">*</span>}
      </div>
      {alt && <div className="gosterge-alt">{alt}</div>}
    </div>
  )
}
