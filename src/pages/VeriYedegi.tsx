// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 / Güven katmanı — Veri Yedeği
//
// Yol haritası maddeleri:
//   "Tenant dışa aktarma"   → İşletme kendi verisini tek dosyada alabiliyor
//   "Otomatik günlük yedek" → Sunucu tarafında; burada UNUTTURMAMA var
//
// ── NEDEN AYRI SAYFA ─────────────────────────────────────────────────────
// Önce İşlem Geçmişi sayfasının bir kartıydı. Emrah bulamadı — iki kez.
// Bir işlev, başka bir ekranın içinde saklıysa yok sayılır. Yedek almak
// günlük bir iş; menüde kendi adıyla durmalı.
//
// ── NEDEN "OTOMATİK İNDİR" DÜĞMESİ YOK ───────────────────────────────────
// Tarayıcı zamanlanmış iş çalıştıramaz. Sekme kapalıyken hiçbir şey
// çalışmaz. "Her gece indirir" diyen bir düğme, çalışmayan bir güvence
// satmaktır.
//
// Girişte otomatik indirme de denenmedi ve denenmeyecek: tarayıcılar
// kullanıcı el atmadan dosya indirmeyi engeller, engellemediğinde de her
// sabah İndirilenler klasörüne 100 MB'lık bir dosya bırakır. Ayıklaması
// kullanıcıda kalan bir yığın, yedek değildir.
//
// Yapılan şey: her yedek günlüğe yazılıyor, eskiyince ekran söylüyor.
// Gerçek otomatik yedek A5'te sunucu tarafında (docs/YEDEKLEME.md).
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { resolveStockRepositoryMode } from '../core/stock/index'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import type { TenantCtx } from '../core/context'
import {
  boyutOku, dosyaAdi, kiraciyiDisaAktar, kunyeOzeti,
  type DisaAktarmaKunyesi,
} from '../tenant-export/tenant-export'
import {
  PostgresYedekGunlugu, UYARI_ESIGI_GUN, yedekDurumu,
  type YedekKaydi,
} from '../tenant-export/backup-log'
import {
  yedegiDogrula, type DogrulamaSonucu,
} from '../tenant-export/backup-verify'

type Props = { currentUser: User }

const hataMetni = (h: unknown) => (h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.')

export default function VeriYedegiSayfasi({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  const yetkili = !currentUser.permissions
    || currentUser.permissions.includes('settings.manage')
    || currentUser.permissions.includes('company.manage')
    || currentUser.permissions.includes('audit.read')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [kurulumHatasi, setKurulumHatasi] = React.useState('')

  React.useEffect(() => {
    let iptal = false
    if(mod !== 'postgres' || !isSupabaseConfigured()){ setYukleniyor(false); return }
    ;(async () => {
      try{
        const kurulan = await depoBaglamiKur(getSupabase())
        if(!iptal) setBaglam(kurulan)
      } catch(e){ if(!iptal) setKurulumHatasi(hataMetni(e)) }
      finally { if(!iptal) setYukleniyor(false) }
    })()
    return () => { iptal = true }
  }, [mod])

  const kabuk = (icerik: React.ReactNode) => (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Veri Yedeği</h2>
          <p className="muted">Aşama 4 · Veriniz sizin; istediğiniz an alın</p>
        </div>
      </div>
      {icerik}
    </div>
  )

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return kabuk(
      <section className="card empty-state">
        <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
        <p>Tarayıcı hafızasındaki verinin yedeği alınmaz — zaten yedeklenecek bir yer değildir.</p>
      </section>,
    )
  }
  if(yukleniyor) return kabuk(<section className="card empty-state">Yükleniyor…</section>)
  if(!baglam){
    return kabuk(
      <section className="card empty-state">{kurulumHatasi || 'Çalışma alanı çözülemedi.'}</section>,
    )
  }

  return kabuk(
    <VeriYedegi
      ctx={baglam.ctx}
      yetkili={yetkili}
      aktorAd={currentUser.fullName || currentUser.username}
    />,
  )
}

/**
 * Veri dışa aktarma / yedek kartı.
 *
 * ── NEDEN BU SAYFADA ─────────────────────────────────────────────────────
 * Denetim kaydı ve yedek aynı soruya hizmet ediyor: "bu sisteme
 * güvenebilir miyim". Biri "kim ne yaptı", öteki "veri benim ve
 * kaybolmayacak" diyor. Ayrı menü ögesi açmak yerine aynı sayfada
 * duruyorlar. (A5'te yönetim ögelerine ayrı bir başlık açılacak.)
 *
 * ── NE VAAT EDİYOR, NE ETMİYOR ───────────────────────────────────────────
 * Bu düğme İŞ VERİSİNİ çıkarır. Veritabanı şemasını, tetikleyicileri, RLS
 * politikalarını ve giriş hesaplarını ÇIKARMAZ. Ekranda da böyle yazıyor —
 * çünkü yedeği olduğunu sanıp olmamak, hiç yedek almamaktan kötüdür.
 */
function VeriYedegi({
  ctx, yetkili, aktorAd,
}: { ctx: TenantCtx; yetkili: boolean; aktorAd?: string }){
  const [calisiyor, setCalisiyor] = React.useState(false)
  const [durum, setDurum] = React.useState('')
  const [kunye, setKunye] = React.useState<DisaAktarmaKunyesi | null>(null)
  const [boyut, setBoyut] = React.useState('')
  const [hata, setHata] = React.useState('')
  const [gunluk, setGunluk] = React.useState<YedekKaydi[]>([])
  const [dogrulama, setDogrulama] = React.useState<DogrulamaSonucu | null>(null)
  const [dosyaSecici] = React.useState(() => React.createRef<HTMLInputElement>())

  const defter = React.useMemo(() => new PostgresYedekGunlugu(getSupabase()), [])

  const gunlugüOku = React.useCallback(async () => {
    // Günlük tablosu henüz kurulmamış olabilir (0029 çalıştırılmadıysa).
    // Bu, yedek almayı engellemez — sadece geçmişi gösteremeyiz.
    try { setGunluk(await defter.son(ctx)) } catch { setGunluk([]) }
  }, [defter, ctx])

  React.useEffect(() => { void gunlugüOku() }, [gunlugüOku])

  const dstm = yedekDurumu(gunluk)

  const indir = async () => {
    setCalisiyor(true); setHata(''); setKunye(null); setDurum('Hazırlanıyor…')
    try{
      const sonuc = await kiraciyiDisaAktar(getSupabase(), ctx, (tablo, sira, toplam) => {
        setDurum(`${sira}/${toplam} · ${tablo}`)
      })
      const metin = JSON.stringify(sonuc, null, 2)
      setKunye(sonuc.kunye)
      setBoyut(boyutOku(metin))

      // Tarayıcıdan indirme: dosya sunucuya hiç uğramıyor, doğrudan
      // kullanıcının diskine iniyor. Aracı bir yer olmaması, verinin
      // başka hiçbir yere kopyalanmadığının garantisi.
      const bag = URL.createObjectURL(new Blob([metin], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = bag
      a.download = dosyaAdi(ctx.tenantId)
      a.click()
      URL.revokeObjectURL(bag)
      setDurum('İndirildi.')

      // Günlüğe yaz — "son yedek ne zaman" sorusunun tek kaynağı burası.
      // Yazamazsa yedek yine alınmıştır; kullanıcıya hata gösterilmez.
      await defter.yaz(ctx, {
        satir: sonuc.kunye.toplamSatir,
        bayt: new Blob([metin]).size,
        eksiksiz: sonuc.kunye.eksikTablolar.length === 0,
        alanAd: aktorAd,
        not: sonuc.kunye.uyari,
      })
      await gunlugüOku()
    } catch(e){
      setHata(hataMetni(e)); setDurum('')
    } finally { setCalisiyor(false) }
  }

  const dogrula = async (dosya: File) => {
    setDogrulama(null); setHata('')
    try{
      const metin = await dosya.text()
      // Bugünkü defterle karşılaştırma için güncel sayılar. Okunamazsa
      // karşılaştırma atlanır; doğrulamanın geri kalanı yine çalışır.
      let guncelSayilar: Record<string, number> | undefined
      try{
        const simdiki = await kiraciyiDisaAktar(getSupabase(), ctx)
        guncelSayilar = Object.fromEntries(
          simdiki.kunye.tablolar.filter(t => t.satir > 0).map(t => [t.tablo, t.satir]),
        )
      } catch { guncelSayilar = undefined }

      setDogrulama(yedegiDogrula(metin, { kiracıId: ctx.tenantId, guncelSayilar }))
    } catch(e){ setHata(hataMetni(e)) }
  }

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h3>Veri Dışa Aktarma ve Yedek</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            İşletmenizin bütün iş verisi tek dosyada. Dosya doğrudan
            bilgisayarınıza iner; hiçbir aracı sunucuya uğramaz.
          </p>
        </div>
        {yetkili && (
          <button className="btn primary" type="button" disabled={calisiyor}
            onClick={() => void indir()}>
            {calisiyor ? (durum || 'Hazırlanıyor…') : 'Yedeği İndir'}
          </button>
        )}
      </div>

      {hata && <div className="form-error">{hata}</div>}

      {/* Son yedek ne zaman alındı. Tarayıcı zamanlanmış iş çalıştıramaz —
          vaat edebileceğimiz şey otomatik yedek değil, UNUTTURMAMAK. */}
      <p className={dstm.uyari ? 'is-critical' : 'muted'} style={{ marginTop: 0 }}>
        {dstm.uyari ? <strong>⚠ {dstm.mesaj}</strong> : dstm.mesaj}
        {dstm.sonEksiksiz?.alanAd && (
          <span className="muted"> · {dstm.sonEksiksiz.alanAd}</span>
        )}
      </p>

      {kunye && (
        <>
          <p className={kunye.uyari ? 'is-critical' : 'muted'} style={{ marginTop: 0 }}>
            {kunye.uyari
              ? <strong>{kunye.uyari}</strong>
              : <>Alındı: {kunyeOzeti(kunye).join(' · ')} · {boyut}</>}
          </p>
          <div className="table-wrap">
            <table className="data-table compact">
              <thead><tr><th>Tablo</th><th className="num">Satır</th><th>Not</th></tr></thead>
              <tbody>
                {kunye.tablolar.map(t => (
                  <tr key={t.tablo}>
                    <td>{t.tablo}</td>
                    <td className={`num ${t.satir === 0 ? 'muted' : ''}`}>{t.satir}</td>
                    <td className={t.atlandi ? 'muted' : ''}>{t.atlandi ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {gunluk.length > 1 && (
        <details style={{ marginBottom: 12 }}>
          <summary className="muted">Yedek geçmişi ({gunluk.length})</summary>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="data-table compact">
              <thead><tr><th>Tarih</th><th>Alan</th><th className="num">Satır</th><th>Durum</th></tr></thead>
              <tbody>
                {gunluk.map(k => (
                  <tr key={k.id}>
                    <td>{new Date(k.tarih).toLocaleString('tr-TR')}</td>
                    <td className="muted">{k.alanAd ?? '—'}</td>
                    <td className="num">{k.satir ?? '—'}</td>
                    <td className={k.eksiksiz ? 'muted' : 'is-critical'}>
                      {k.eksiksiz ? 'eksiksiz' : 'EKSİK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* ── YEDEĞİ DOĞRULA ────────────────────────────────────────────
          "Alındığı sanılan yedeğin çalışmaması" en tehlikeli durumdur.
          Bir yedek ancak GERİ OKUNDUĞUNDA yedektir. Bu bölüm dosyayı geri
          okur ve dört soruyu cevaplar — ama HİÇBİR ŞEY YAZMAZ. */}
      <div className="section-header" style={{ marginTop: 20, marginBottom: 8 }}>
        <div>
          <h3 style={{ fontSize: '1rem' }}>Yedeği Doğrula</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            İndirdiğiniz dosyayı seçin: okunabiliyor mu, eksiksiz mi,
            <strong> bu işletmeye mi ait</strong>. Hiçbir şey değiştirilmez.
          </p>
        </div>
        <button className="btn" type="button"
          onClick={() => dosyaSecici.current?.click()}>
          Dosya Seç
        </button>
      </div>
      <input
        ref={dosyaSecici} type="file" accept="application/json,.json" hidden
        onChange={e => {
          const d = e.target.files?.[0]
          if(d) void dogrula(d)
          e.target.value = ''
        }}
      />

      {dogrulama && (
        <div className="table-wrap" style={{ marginBottom: 12 }}>
          <table className="data-table compact">
            <thead><tr><th style={{ width: 46 }}></th><th>Kontrol</th><th>Sonuç</th></tr></thead>
            <tbody>
              {dogrulama.bulgular.map((b, i) => (
                <tr key={i}>
                  <td className={b.durum === 'kaldi' ? 'is-critical' : ''}>
                    {b.durum === 'gecti' ? '✓' : b.durum === 'uyari' ? '!' : '✕'}
                  </td>
                  <td className={b.durum === 'kaldi' ? 'is-critical' : ''}>
                    <strong>{b.baslik}</strong>
                  </td>
                  <td className="muted">{b.aciklama}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dogrulama && (
        <p className={dogrulama.gecti ? 'muted' : 'is-critical'}>
          {dogrulama.gecti
            ? <strong>Bu dosya geçerli bir yedek.</strong>
            : <strong>Bu dosyaya yedek olarak GÜVENMEYİN.</strong>}
        </p>
      )}

      <p className="muted detail-hint">
        <strong>Otomatik yedek diye bir düğme yok</strong> — ve olmayacak.
        Tarayıcı kapalıyken hiçbir şey çalışmaz; "her gece indir" diyen bir
        web uygulaması yalan söyler. Yapabildiğimiz, {UYARI_ESIGI_GUN} günden
        eskiyse yüzünüze söylemek. Gerçek otomatik yedek sunucu tarafında
        kurulur (<code>docs/YEDEKLEME.md</code>).
      </p>

      <p className="muted detail-hint">
        <strong>Bu dosya sunucu yedeği DEĞİLDİR.</strong> İş verisini taşır;
        veritabanı şemasını, tetikleyicileri, yetki politikalarını ve giriş
        hesaplarını taşımaz. "Sunucu yandı, her şeyi geri kur" senaryosunun
        yolu <code>pg_dump</code>'tır ve <code>docs/YEDEKLEME.md</code>'de
        adım adım yazılıdır. İkisini birbirinin yerine koymak, yedeği olduğunu
        sanıp olmamak demektir.
      </p>
    </section>
  )
}
