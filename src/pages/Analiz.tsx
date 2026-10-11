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
  oranAsiriMi, ozetiOku, paraYaz, sayiYaz, yuzdeYaz,
  enAzKarli, enAzSatan, enCokSatan, enKarli, satisBulgulari, satisOzeti,
  yavasDevredenler,
  type DevirSatiri, type SatisSatiri,
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
  // ⚠️ İKİ KAPI VAR, BU BİRİNCİSİ (09.10'da ikincisi eklendi).
  //
  // Bu kontrol kullanıcıya NEDEN göremediğini söylüyor. Asıl kapı artık
  // VERİTABANINDA (0071): fonksiyonlar `finance.read` yoksa MI403 ile
  // reddediyor. Önce yalnız burası vardı ve bu, kendi kuralımı çiğnemekti
  // — menüde gizlemek yetmediği gibi ekranda gizlemek de yetmez; doğrudan
  // RPC çağıran herkes maliyetleri okuyabilirdi.
  //
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
  const [satislar, setSatislar] = React.useState<SatisSatiri[]>([])
  const [devir, setDevir] = React.useState<DevirSatiri[]>([])
  const [satisHatasi, setSatisHatasi] = React.useState('')
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
        // ⚠️ SATIŞ BÖLÜMÜ AYRI YAKALANIYOR, ÖTEKİLERİ DÜŞÜRMESİN.
        // 0074 göçü veritabanına uygulanmadan önce bu iki RPC yok; aynı
        // `Promise.all` içinde kalsalardı EKRANIN TAMAMI hata verirdi ve
        // çalışan fire/SKT bölümü de kaybolurdu. Hata yutulmuyor, ayrı bir
        // satırda SÖYLENİYOR — sessizce boş tablo göstermek yalan olurdu.
        let satisNotu = ''
        const yumusak = async <T,>(f: () => Promise<T[]>): Promise<T[]> => {
          try { return await f() }
          catch (e){ satisNotu = hataMetni(e); return [] }
        }

        const [simdi, once, dokum, satis, devirler] = await Promise.all([
          depo.gostergeler(kurulan.ctx, d),
          depo.gostergeler(kurulan.ctx, o),
          depo.fireDokumu(kurulan.ctx, d),
          yumusak(() => depo.satisKarliligi(kurulan.ctx, d)),
          yumusak(() => depo.stokDevri(kurulan.ctx, d)),
        ])
        if(iptal) return

        setDonem(d)
        setOzet(ozetiOku(simdi))
        setGecmis(ozetiOku(once))
        setFire(dokum)
        setSatislar(satis)
        setDevir(devirler)
        setSatisHatasi(satisNotu)
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

  const sOzet = satisOzeti(satislar)
  // ⚠️ Satış bulguları ESKİ bulguların ARDINA ekleniyor, araya karışmıyor:
  // sıra önem sırasıdır ve gıda güvenliği (SKT, fire) paradan önce gelir.
  const liste: Bulgu[] = ozet
    ? [...bulgular(ozet, gecmis ?? undefined), ...satisBulgulari(sOzet, satislar, devir)]
    : []
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
              // ⚠️ Oran %100'ü aşınca SEBEBİ aynı satırda yazıyor. Açıklamasız
              // bir "%576,6" ekranı bozuk gösterir; oysa rakam doğru — fire
              // o dönem alınan maldan değil, eski stoktan geliyor.
              alt={oran !== undefined
                ? `Alıma oranı ${yuzdeYaz(oran)}`
                  + (oranAsiriMi(oran) ? ' (alım düşük kaldı, fire eski stoktan)' : '')
                  + ` · ${sayiYaz(ozet.fireKalemSayisi)} kalem`
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
          {/* ── SATIŞ VE KÂRLILIK (0074) ────────────────────────────────
              Emrah'ın bilirkişisinin demo şartı. Fireden ÖNCE duruyor:
              "ne kazandım" sorusu "ne kaybettim" sorusundan önce gelir. */}
          <h3>Satış ve kârlılık</h3>
          {satisHatasi && (
            <div className="form-error">
              Satış ve kârlılık bölümü okunamadı: {satisHatasi}
              {' '}— bu bölüm <strong>0074</strong> göçünü gerektiriyor;
              veritabanına uygulanmadıysa sebebi budur. Ekranın geri kalanı
              çalışmaya devam ediyor.
            </div>
          )}
          {satislar.length === 0
            ? satisHatasi ? null : (
              <p className="muted detail-hint">
                <strong>Bu dönemde sevkiyat kaydı yok.</strong> Satış rakamları
                siparişten değil SEVKİYATTAN okunuyor: sipariş bir niyet,
                sevkiyat bir olaydır. Mal çıkışı yazıldığında burası dolar.
              </p>
            )
            : (
              <>
                <div className="gosterge-grid">
                  <Kutu baslik="Ciro" deger={paraYaz(sOzet.ciro)}
                    alt={`${sayiYaz(sOzet.kalemSayisi)} üründe sevkiyat`} />
                  <Kutu baslik="Malın maliyeti" deger={paraYaz(sOzet.maliyet)}
                    alt={sOzet.maliyetsizKalem > 0
                      ? `${sayiYaz(sOzet.maliyetsizKalem)} ürünün maliyeti bilinmiyor`
                      : 'bütün ürünlerin maliyeti biliniyor'}
                    eksik={sOzet.maliyetsizKalem > 0} />
                  <Kutu baslik="Brüt kâr" deger={paraYaz(sOzet.kar)}
                    alt="işçilik, nakliye ve genel gider HARİÇ" />
                  <Kutu baslik="Brüt marj"
                    deger={sOzet.marj !== undefined ? yuzdeYaz(sOzet.marj) : '—'}
                    alt={sOzet.zararliKalem > 0
                      ? `${sayiYaz(sOzet.zararliKalem)} ürün zararına satılıyor`
                      : 'zararına satılan ürün yok'}
                    eksik={sOzet.zararliKalem > 0} />
                </div>

                {/* ⚠️ Bu uyarı ekrandan KALDIRILMAZ. "Brüt kâr" ile "kâr"ı
                    karıştıran bir yönetici, zarar ederken kâr ettiğini sanır. */}
                <p className="muted detail-hint">
                  <strong>Bu BRÜT kârdır.</strong> Malın kendisinden kalanı
                  gösterir; işçilik, nakliye, enerji, kira ve genel gider
                  içinde YOKTUR. Maliyet <strong>son alış fiyatı</strong> ile,
                  üretilen ürünlerde <strong>reçeteden</strong> hesaplanıyor.
                  {sOzet.maliyetsizKalem > 0 && (
                    <> Maliyeti bulunamayan {sayiYaz(sOzet.maliyetsizKalem)} ürün
                    kâr hesabına <strong>girmedi</strong>.</>
                  )}
                </p>

                <div className="warehouse-layout">
                  <section className="card warehouse-main">
                    <div className="section-header compact">
                      <h3>En çok satan</h3><span className="muted">ciroya göre</span>
                    </div>
                    <SatisTablosu satirlar={enCokSatan(satislar)} />
                  </section>
                  <section className="card warehouse-side">
                    <div className="section-header compact">
                      <h3>En az satan</h3>
                      {/* ⚠️ HİÇ satılmayan ürün bu listede YOK; bu liste
                          satılanların en azıdır. */}
                      <span className="muted">satılanların en azı</span>
                    </div>
                    <SatisTablosu satirlar={enAzSatan(satislar)} />
                  </section>
                </div>

                <div className="warehouse-layout">
                  <section className="card warehouse-main">
                    <div className="section-header compact">
                      <h3>En karlı</h3><span className="muted">marja göre</span>
                    </div>
                    <SatisTablosu satirlar={enKarli(satislar)} />
                  </section>
                  <section className="card warehouse-side">
                    <div className="section-header compact">
                      <h3>En az karlı</h3>
                      <span className="muted">zarar edenler başta</span>
                    </div>
                    <SatisTablosu satirlar={enAzKarli(satislar)} />
                  </section>
                </div>
              </>
            )}

          {devir.length > 0 && (
            <>
              <h3>Rafta en uzun bekleyen stok</h3>
              <p className="muted detail-hint">
                Devir hızı = dönemdeki çıkış ÷ ortalama stok. Çıkışa hem
                sevkiyat hem üretim tüketimi dahil — hammadde satılmaz,
                üretime girer.
              </p>
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Ürün</th><th className="num">Dönem çıkışı</th>
                      <th className="num">Ortalama stok</th>
                      <th className="num">Kaç günde bir devrediyor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yavasDevredenler(devir, 10).map(d => (
                      <tr key={d.kalemId}>
                        <td><strong>{d.kalemAdi}</strong></td>
                        <td className="num">{sayiYaz(d.cikis)} {d.birim}</td>
                        <td className="num">{sayiYaz(d.ortalamaStok)} {d.birim}</td>
                        <td className={`num ${(d.gun ?? 0) >= 90 ? 'is-critical' : ''}`}>
                          {d.gun !== undefined ? `${sayiYaz(d.gun)} gün` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <h3>Fire nereden geliyor</h3>

          {fire.length === 0 && (
            <p className="muted">Bu dönemde fire kaydı yok.</p>
          )}

          {fire.length > 0 && (
            <>
              {yogun && yogun.kalemSayisi > 0 && (
                <p>
                  Firenin <strong>{yuzdeYaz(yogun.kapsanan / yogun.toplam)}</strong>
                  {' '}kadarı <strong>{sayiYaz(yogun.kalemSayisi)} kalemden</strong> geliyor.
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
              <strong>Satış ve ciro</strong> sipariş satırından değil
              <strong>sevkiyattan</strong> okunuyor; sipariş bir niyet,
              sevkiyat bir olaydır. Fiyat, siparişin güncel revizyonundaki
              birim fiyattır ve ürünün temel birimine çevrilir (koli fiyatı
              kilo fiyatına indirilir). Fiyatı bulunamayan miktar ciroya
              girmez ve bu <strong>ayrıca yazılır</strong>.
            </li>
            <li>
              <strong>Maliyet</strong> satın alınan ürünlerde son alış
              fiyatı, üretilen ürünlerde <strong>reçeteden</strong>
              (verim ve fire payı dahil, yarı mamuller özyinelemeli).
              Bir bileşenin maliyeti bilinmiyorsa toplam da bilinmiyor
              sayılır — sıfır değil.
            </li>
            <li>
              <strong>İptal edilmiş sevkiyat</strong> ciroya girmez; ters
              kayıt ve ters çevirdiği hareket birlikte ayıklanır.
            </li>
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

/**
 * Satış satırı tablosu.
 *
 * ⚠️ Marjı bilinmeyen satır "%0" DEĞİL "—" gösteriyor. Sıfır bir ölçümdür,
 * tire ise "ölçemedik" demektir; ikisini aynı göstermek yalan olur.
 */
function SatisTablosu({ satirlar }: { satirlar: readonly SatisSatiri[] }){
  if(satirlar.length === 0) return <p className="muted">Gösterilecek satır yok.</p>
  return (
    <div className="table-wrap">
      <table className="data-table compact">
        <thead>
          <tr>
            <th>Ürün</th><th className="num">Miktar</th>
            <th className="num">Ciro</th><th className="num">Brüt kâr</th>
            <th className="num">Marj</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map(s => (
            <tr key={s.kalemId}>
              <td>
                <strong>{s.kalemAdi}</strong>
                {s.fiyatsizMiktar > 0 && (
                  <div className="muted">
                    {sayiYaz(s.fiyatsizMiktar)} {s.birim} fiyatsız — ciroya girmedi
                  </div>
                )}
              </td>
              <td className="num">{sayiYaz(s.miktar)} {s.birim}</td>
              <td className="num">{paraYaz(s.ciro)}</td>
              <td className={`num ${(s.kar ?? 0) < 0 ? 'is-critical' : ''}`}>
                {s.kar !== undefined ? paraYaz(s.kar) : '—'}
              </td>
              <td className={`num ${(s.marj ?? 0) < 0 ? 'is-critical' : ''}`}>
                {s.marj !== undefined ? yuzdeYaz(s.marj) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
