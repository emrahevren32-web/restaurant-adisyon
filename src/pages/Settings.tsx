import React from 'react'
import LisansKarti from '../components/LisansKarti'
import {
  PARA_BIRIMLERI,
  isletmeAyarlariniOku,
  isletmeAyarlariniYaz,
  type IsletmeAyarlari,
} from '../workspace/isletme-ayarlari.repository'
import { firmaProfiliniOku, type FirmaProfili } from '../companies/firma-profili.repository'
import type { User } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · İşletme Ayarları · MIYOP-060b
//
// ⚠️ 29.10.2026'ya kadar bu ekran iki ayarı — para birimi ve KDV oranı —
// `localStorage`a yazıyordu ve ikisinin de veritabanında KARŞILIĞI YOKTU.
// Üstüne `DEFAULT_SETTINGS.vatRate = 10` duruyordu ve form bunu
// **işletmenin KDV oranı** gibi gösteriyordu. Kimse %10 demedi.
//
// Göç **0103** (`public.tenant_settings`) ikisinin de yerini açtı; ekran
// artık oraya yazıyor. Gerekçe ve ölçümler:
// `src/workspace/isletme-ayarlari.repository.ts` dosya başı.
//
// ⚠️ FİRMA ADI VE LOGO ARTIK BURADAN DEĞİŞMİYOR. İkisi de `company`
// tablosunda ve o tablonun sahibi **Firma Profili** ekranı (3.1). İki ekranın
// aynı kolona yazması, "orada değiştirdim burada değişti" karışıklığının ta
// kendisidir — ve o kolonların kapısı (`company.manage`) buradakinden
// (`settings.manage`) farklı. Burada yalnız GÖSTERİLİYOR.
//
// ⚠️ "Yetkisiz Erişim" ekranı da kaldırıldı: eski hâli `role === 'Admin'`
// değilse hiçbir şey göstermiyordu. Müdür ayarları GÖREBİLMELİ, yalnız
// değiştiremez. Görmeyi engellemek, ona işletmenin para biriminin ne
// olduğunu da söylememek demekti.
// ═══════════════════════════════════════════════════════════════════════════

type Props = {
  currentUser: User
  /** Üst çubuk adı/logoyu tazelesin diye; firma adı buradan değişmese de
   *  çağıran taraf için duruyor. */
  onSettingsChange?: () => void
}

/**
 * ⚠️ `permissions` TANIMSIZ olabiliyor (App.tsx'teki bilinçli taviz).
 * Tanımsızken "yetkin yok" demek YALAN olur. Form açık bırakılıyor ve
 * kararı veritabanı veriyor: yetkisiz UPDATE `izin_tenant_settings`
 * tetiğinde reddedilir, ekran o sebebi yazar.
 */
const yazabilirMi = (user: User): boolean => (
  user.permissions === undefined || user.permissions.includes('settings.manage')
)

const tarih = (iso: string | null): string => {
  if(!iso) return '—'
  const d = new Date(iso)
  if(Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Settings({ currentUser }: Props){
  const yazabilir = yazabilirMi(currentUser)

  const [ayarlar, setAyarlar] = React.useState<IsletmeAyarlari | null>(null)
  const [firma, setFirma] = React.useState<FirmaProfili | null>(null)
  const [paraBirimi, setParaBirimi] = React.useState('TRY')
  const [kdv, setKdv] = React.useState('')
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [kaydediliyor, setKaydediliyor] = React.useState(false)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const yukle = React.useCallback(async () => {
    setYukleniyor(true)
    setHata('')
    setBilgi('')
    const [gelenAyar, gelenFirma] = await Promise.all([
      isletmeAyarlariniOku(),
      firmaProfiliniOku(currentUser.companyId),
    ])
    setFirma(gelenFirma)
    if(gelenAyar){
      setAyarlar(gelenAyar)
      setParaBirimi(gelenAyar.paraBirimi)
      // ⚠️ `null` BOŞ metne dönüyor — `0` değil. "Seçilmedi" ile "%0" ayrı.
      setKdv(gelenAyar.kdvOrani === null ? '' : String(gelenAyar.kdvOrani))
    } else {
      setAyarlar(null)
      setHata('İşletme ayarları okunamadı. Bağlantınızı kontrol edip tekrar deneyin.')
    }
    setYukleniyor(false)
  }, [currentUser.companyId])

  React.useEffect(() => { void yukle() }, [yukle])

  const kaydet = async (event: React.FormEvent) => {
    event.preventDefault()
    if(!ayarlar || kaydediliyor) return

    setKaydediliyor(true)
    setHata('')
    setBilgi('')

    const sonuc = await isletmeAyarlariniYaz(ayarlar.id, { paraBirimi, kdvOrani: kdv })
    if(sonuc.durum === 'hata'){
      setHata(sonuc.mesaj)
      setKaydediliyor(false)
      return
    }

    // ⚠️ Ekranda gösterilen şey, VERİTABANINDAN GERİ OKUNAN şey.
    setAyarlar(sonuc.ayarlar)
    setParaBirimi(sonuc.ayarlar.paraBirimi)
    setKdv(sonuc.ayarlar.kdvOrani === null ? '' : String(sonuc.ayarlar.kdvOrani))
    setBilgi('İşletme ayarları kaydedildi.')
    setKaydediliyor(false)
  }

  const kilitli = !yazabilir || kaydediliyor

  return (
    <div className="settings-page">
      <div className="page-title">
        <div>
          <h2>İşletme Ayarları</h2>
          <p className="muted">
            Para birimi ve KDV oranı. Veri yedeği için soldaki
            <strong> Veri Yedeği</strong> ekranını kullanın.
          </p>
        </div>
      </div>

      {!yazabilir && (
        <div className="form-error">
          İşletme ayarlarını yalnızca işletme sahibi değiştirebilir.
          Bilgileri görebilirsiniz, kaydedemezsiniz.
        </div>
      )}
      {hata && <div className="form-error">{hata}</div>}
      {bilgi && !hata && <div className="form-success">{bilgi}</div>}

      <div className="settings-layout">
        {/* Lisans EN ÜSTTE: müşterinin "ne zamana kadar kullanabilirim"
            sorusu, para birimi ayarından önce gelir. */}
        <LisansKarti currentUser={currentUser} />

        <section className="card">
          <div className="section-header compact">
            <h3>Firma</h3>
          </div>
          {/* ⚠️ SALT OKUNUR. Bu iki alan `company` tablosunda ve oranın
              sahibi Firma Profili ekranı. Bkz. dosya başı. */}
          <div className="form-grid">
            <div className="form-field">
              <label>Firma adı</label>
              <input value={firma?.firmaAdi ?? ''} disabled readOnly />
            </div>
            <div className="form-field">
              <label>Firma logosu (bağlantı)</label>
              <input value={firma?.logoAdresi ?? ''} disabled readOnly />
            </div>
          </div>
          <p className="muted small-text">
            Firma adı ve logo <strong>Firma Profili</strong> ekranından
            değiştirilir. Orası vergi dairesi, adres ve yetkili bilgilerinin de
            tutulduğu yerdir.
          </p>
          {firma?.logoAdresi && (
            <div className="logo-preview">
              <span>Logo önizleme</span>
              <img src={firma.logoAdresi} alt="Firma logosu" />
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-header compact">
            <h3>Para Birimi ve KDV</h3>
          </div>

          {yukleniyor ? (
            <p className="muted">Ayarlar yükleniyor…</p>
          ) : !ayarlar ? (
            <div className="form-actions">
              <button className="btn" type="button" onClick={() => void yukle()}>
                Tekrar dene
              </button>
            </div>
          ) : (
            <form className="settings-form" onSubmit={e => void kaydet(e)}>
              <div className="settings-form-grid">
                <div className="form-field">
                  <label>Para birimi</label>
                  <select value={paraBirimi} disabled={kilitli}
                    onChange={e => { setParaBirimi(e.target.value); setBilgi('') }}>
                    {PARA_BIRIMLERI.map(p => (
                      <option key={p.kod} value={p.kod}>{p.ad}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>KDV oranı (%)</label>
                  {/* ⚠️ `type="number"` DEĞİL ve bu bilinçli: boş bırakmak
                      geçerli bir cevap ("henüz seçmedim") ve sayı kutusu boş
                      değeri bazı tarayıcılarda 0'a çeviriyor. 0 ile "boş"
                      aynı şey değil. */}
                  <input
                    value={kdv}
                    disabled={kilitli}
                    inputMode="decimal"
                    placeholder="Belirlenmedi"
                    onChange={e => { setKdv(e.target.value); setBilgi('') }}
                  />
                  <p className="muted small-text">
                    {ayarlar.kdvOrani === null
                      ? 'Henüz belirlenmedi. Boş bırakabilirsiniz — MİYOP sizin '
                        + 'adınıza bir oran varsaymaz.'
                      : 'Boşaltırsanız "belirlenmedi" durumuna döner.'}
                  </p>
                </div>
              </div>

              <p className="muted small-text">
                Son kayıt: {tarih(ayarlar.guncellendi)}
              </p>

              {yazabilir && (
                <div className="form-actions">
                  <button className="btn primary" type="submit" disabled={kaydediliyor}>
                    {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                  <button className="btn" type="button" disabled={kaydediliyor}
                    onClick={() => {
                      setParaBirimi(ayarlar.paraBirimi)
                      setKdv(ayarlar.kdvOrani === null ? '' : String(ayarlar.kdvOrani))
                      setHata(''); setBilgi('')
                    }}>
                    Değişiklikleri Geri Al
                  </button>
                </div>
              )}
            </form>
          )}
        </section>

        {/* ⚠️ BURADA "Yedekleme" ve "Geri Yükleme" BÖLÜMLERİ VARDI. KALDIRILDI
            (2026-09-13). İkisi de TARAYICI HAFIZASINI yedekliyor ve geri
            yüklüyordu; gerçek iş verisi Postgres'te. O düğmeye basan müşteri
            "yedeğim var" sanıyor ama dosyada stok defteri, sayım, sevkiyat,
            HACCP kaydı YOK. Yedeği olduğunu sanıp olmamak, hiç yedek
            almamaktan tehlikelidir.
            Gerçek yedek: Ayarlar → Veri Yedeği (src/pages/VeriYedegi.tsx).
            "Geri Yükleme" BİLEREK yeniden yapılmadı: yanlış yapılmış bir geri
            yükleme veri kaybından kötüdür. Karar (Emrah, 2026-09-13): talep
            MİYOP'a gelir, elle ve kayıt altında yapılır. docs/YEDEKLEME.md §4.6 */}
      </div>
    </div>
  )
}
