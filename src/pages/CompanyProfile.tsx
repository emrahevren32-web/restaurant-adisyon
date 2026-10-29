import React from 'react'
import {
  firmaProfiliniOku,
  firmaProfiliniYaz,
  type FirmaProfili,
  type FirmaProfiliYazimi,
} from '../companies/firma-profili.repository'
import type { User } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Firma Profili
//
// ⚠️ 29.10.2026'ya kadar bu ekran Kaydet'e basınca veriyi TARAYICIYA
// yazıyordu. Müşteri vergi numarasını girip "kaydedildi" yazısını görüyor,
// başka bir bilgisayardan giriyor ve hiçbir şey bulamıyordu. Artık
// `company` tablosunu okuyup yazıyor; gerekçe ve yazma sözleşmesi
// `src/companies/firma-profili.repository.ts` dosya başında.
//
// ⚠️ BOŞ ALAN UYDURULMUYOR (MIYOP-060). Ticari unvan boşsa boş görünür;
// eskiden firma adı unvan gibi gösteriliyordu ve kullanıcı alanı boşaltsa
// geri doluyordu. Göç 0084 bu yalanı veritabanında onarmıştı; ikinci
// katmanda yaşıyordu.
//
// ⚠️ Şube göstergeleri KALDIRILDI: tarayıcıdaki şube listesinden
// besleniyorlardı ve şube bu seviyede artık yok (tek merkez kararı).
// Yerlerine veritabanından okunan şeyler kondu — "son güncelleme" dâhil,
// çünkü "kaydedildi" iddiasının tek kanıtı odur.
// ═══════════════════════════════════════════════════════════════════════════

type Props = { currentUser: User }

type Form = FirmaProfiliYazimi

const BOS_FORM: Form = {
  firmaAdi: '', kisaAd: '', ticariUnvan: '', vergiDairesi: '', vergiNumarasi: '',
  telefon: '', eposta: '', web: '', adres: '', il: '', ilce: '', postaKodu: '',
  logoAdresi: '', yetkiliAdSoyad: '', yetkiliUnvan: '', yetkiliTelefon: '',
  yetkiliEposta: '',
}

/** ⚠️ `null` alan BOŞ metne döner — başka bir alandan DOLDURULMAZ. */
const formaCevir = (profil: FirmaProfili): Form => ({
  firmaAdi: profil.firmaAdi,
  kisaAd: profil.kisaAd ?? '',
  ticariUnvan: profil.ticariUnvan ?? '',
  vergiDairesi: profil.vergiDairesi ?? '',
  vergiNumarasi: profil.vergiNumarasi ?? '',
  telefon: profil.telefon ?? '',
  eposta: profil.eposta ?? '',
  web: profil.web ?? '',
  adres: profil.adres ?? '',
  il: profil.il ?? '',
  ilce: profil.ilce ?? '',
  postaKodu: profil.postaKodu ?? '',
  logoAdresi: profil.logoAdresi ?? '',
  yetkiliAdSoyad: profil.yetkiliAdSoyad ?? '',
  yetkiliUnvan: profil.yetkiliUnvan ?? '',
  yetkiliTelefon: profil.yetkiliTelefon ?? '',
  yetkiliEposta: profil.yetkiliEposta ?? '',
})

const tarih = (iso: string | null): string => {
  if(!iso) return '—'
  const d = new Date(iso)
  if(Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Yazma yetkisi.
 *
 * ⚠️ `permissions` TANIMSIZ olabiliyor (App.tsx'teki bilinçli taviz).
 * Tanımsızken "yetkin yok" demek YALAN olur — bilmiyoruz. O yüzden form
 * açık bırakılıyor ve kararı veritabanı veriyor: yetkisiz UPDATE `izin_company`
 * tetiğinde reddedilir ve ekran o sebebi yazar. Rozet kolaylık, kapı sunucuda.
 */
const yazabilirMi = (user: User): boolean => (
  user.permissions === undefined || user.permissions.includes('company.manage')
)

export default function CompanyProfile({ currentUser }: Props){
  const yazabilir = yazabilirMi(currentUser)

  const [profil, setProfil] = React.useState<FirmaProfili | null>(null)
  const [values, setValues] = React.useState<Form>(BOS_FORM)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [kaydediliyor, setKaydediliyor] = React.useState(false)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const yukle = React.useCallback(async () => {
    setYukleniyor(true)
    setHata('')
    setBilgi('')
    const gelen = await firmaProfiliniOku(currentUser.companyId)
    if(gelen){
      setProfil(gelen)
      setValues(formaCevir(gelen))
    } else {
      setProfil(null)
      setValues(BOS_FORM)
      setHata('Firma kaydı okunamadı. Bu kullanıcı bir firmaya bağlı olmayabilir.')
    }
    setYukleniyor(false)
  }, [currentUser.companyId])

  React.useEffect(() => { void yukle() }, [yukle])

  const alanYaz = <K extends keyof Form>(key: K, value: Form[K]) => {
    setValues(previous => ({ ...previous, [key]: value }))
    setBilgi('')
  }

  const kaydet = async (event: React.FormEvent) => {
    event.preventDefault()
    if(!profil || kaydediliyor) return

    setKaydediliyor(true)
    setHata('')
    setBilgi('')

    const sonuc = await firmaProfiliniYaz(profil.id, values)
    if(sonuc.durum === 'hata'){
      setHata(sonuc.mesaj)
      setKaydediliyor(false)
      return
    }

    // ⚠️ Ekranda gösterilen şey, VERİTABANINDAN GERİ OKUNAN şey.
    setProfil(sonuc.profil)
    setValues(formaCevir(sonuc.profil))
    setBilgi('Firma bilgileri kaydedildi.')
    setKaydediliyor(false)
  }

  if(yukleniyor){
    return (
      <div className="company-profile-page">
        <section className="card"><p className="muted">Firma bilgileri yükleniyor…</p></section>
      </div>
    )
  }

  if(!profil){
    return (
      <div className="company-profile-page">
        <section className="card">
          <h3>Firma Profili</h3>
          <p className="form-error">{hata || 'Firma kaydı bulunamadı.'}</p>
          <div className="form-actions">
            <button className="btn" type="button" onClick={() => void yukle()}>Tekrar dene</button>
          </div>
        </section>
      </div>
    )
  }

  const kilitli = !yazabilir || kaydediliyor

  return (
    <div className="company-profile-page">
      <div className="metric-grid">
        <div className="metric-card">
          <span>Firma</span>
          <strong>{profil.firmaAdi || '—'}</strong>
        </div>
        <div className="metric-card">
          <span>Firma Kodu</span>
          <strong>{profil.firmaKodu || '—'}</strong>
        </div>
        <div className="metric-card">
          <span>Vergi Numarası</span>
          <strong>{profil.vergiNumarasi || '—'}</strong>
        </div>
        <div className="metric-card">
          <span>Son Kayıt</span>
          <strong>{tarih(profil.guncellendi)}</strong>
        </div>
      </div>

      {!yazabilir && (
        <div className="form-error">
          Firma bilgilerini yalnızca işletme sahibi değiştirebilir. Bilgileri
          görebilirsiniz, kaydedemezsiniz.
        </div>
      )}
      {hata && <div className="form-error">{hata}</div>}
      {bilgi && !hata && <div className="form-success">{bilgi}</div>}

      <form className="company-profile-form" onSubmit={e => void kaydet(e)}>
        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>Firma Bilgileri</h3>
              <p className="muted">
                Bu bilgiler irsaliye, etiket ve sözleşmelerde kullanılır.
                Boş bıraktığınız alan boş kalır; tahmin edilmez.
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Firma Adı</label>
              <input value={values.firmaAdi} disabled={kilitli} required
                onChange={e => alanYaz('firmaAdi', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Kısa Ad</label>
              <input value={values.kisaAd} disabled={kilitli}
                onChange={e => alanYaz('kisaAd', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Ticari Unvan (resmî)</label>
              <input value={values.ticariUnvan} disabled={kilitli}
                placeholder="Vergi levhasındaki tam unvan"
                onChange={e => alanYaz('ticariUnvan', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Vergi Dairesi</label>
              <input value={values.vergiDairesi} disabled={kilitli}
                onChange={e => alanYaz('vergiDairesi', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Vergi Numarası</label>
              <input value={values.vergiNumarasi} disabled={kilitli} inputMode="numeric"
                onChange={e => alanYaz('vergiNumarasi', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Telefon</label>
              <input value={values.telefon} disabled={kilitli}
                onChange={e => alanYaz('telefon', e.target.value)} />
            </div>
            <div className="form-field">
              <label>E-posta</label>
              <input type="email" value={values.eposta} disabled={kilitli}
                onChange={e => alanYaz('eposta', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Web Sitesi</label>
              <input value={values.web} disabled={kilitli} placeholder="https://"
                onChange={e => alanYaz('web', e.target.value)} />
            </div>
            <div className="form-field">
              <label>İl</label>
              <input value={values.il} disabled={kilitli}
                onChange={e => alanYaz('il', e.target.value)} />
            </div>
            <div className="form-field">
              <label>İlçe</label>
              <input value={values.ilce} disabled={kilitli}
                onChange={e => alanYaz('ilce', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Posta Kodu</label>
              <input value={values.postaKodu} disabled={kilitli} inputMode="numeric"
                onChange={e => alanYaz('postaKodu', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Firma Logosu (bağlantı)</label>
              <input value={values.logoAdresi} disabled={kilitli} placeholder="https://"
                onChange={e => alanYaz('logoAdresi', e.target.value)} />
            </div>
            <div className="form-field form-field-wide">
              <label>Adres</label>
              <textarea rows={2} value={values.adres} disabled={kilitli}
                onChange={e => alanYaz('adres', e.target.value)} />
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>Yetkili Bilgileri</h3>
              <p className="muted">Firma adına iletişim kurulacak kişi.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Ad Soyad</label>
              <input value={values.yetkiliAdSoyad} disabled={kilitli}
                onChange={e => alanYaz('yetkiliAdSoyad', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Görevi / Unvanı</label>
              <input value={values.yetkiliUnvan} disabled={kilitli}
                onChange={e => alanYaz('yetkiliUnvan', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Telefon</label>
              <input value={values.yetkiliTelefon} disabled={kilitli}
                onChange={e => alanYaz('yetkiliTelefon', e.target.value)} />
            </div>
            <div className="form-field">
              <label>E-posta</label>
              <input type="email" value={values.yetkiliEposta} disabled={kilitli}
                onChange={e => alanYaz('yetkiliEposta', e.target.value)} />
            </div>
          </div>

          {yazabilir && (
            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={kaydediliyor}>
                {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              <button className="btn" type="button" disabled={kaydediliyor}
                onClick={() => { setValues(formaCevir(profil)); setHata(''); setBilgi('') }}>
                Değişiklikleri Geri Al
              </button>
            </div>
          )}
        </section>
      </form>
    </div>
  )
}
