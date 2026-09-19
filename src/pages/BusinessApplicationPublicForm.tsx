// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4D / KAPI — Herkese açık başvuru formu
//
// Demonun İLK ekranı. Oturum yok, müşteri MİYOP'u ilk kez burada görüyor.
//
// ── AŞAMA 4D'DE DEĞİŞEN ÜÇ ŞEY ───────────────────────────────────────────
// 1. BAŞVURU ARTIK VERİTABANINA GİDİYOR. Önce `storage.ts` üzerinden
//    tarayıcı hafızasına yazıyordu: sekme kapanınca kayboluyor, MİYOP
//    başka bir bilgisayardan görmüyordu.
// 2. NUMARA GERÇEK VE OKUNABİLİR. Önce `business_application_1789751294946_
//    0dc312d30e61f` gibi bir iç kimlik basılıyordu — müşteri onu ne okur ne
//    telefonda söyler. Şimdi `MIY-K7R3Q`; numarayı veritabanı üretiyor (0033).
// 3. HATALAR TOPLU VE TÜRKÇE. `required` niteliği tarayıcıya bırakılmış tek
//    tek uyarılar veriyordu; artık bütün eksikler bir arada görünüyor
//    (`basvuruDogrula`) ve sınırlar veritabanındaki kısıtlarla aynı.
//
// ⚠️ Postgres kapalıysa eski localStorage yoluna düşüyor. Sebep: bu ekran
// oturum gerektirmiyor ve demo dışı kurulumlarda da açılabilir; "kayıt
// yapamam" demek yerine çalışmaya devam ediyor. Ama hangi yola düştüğü
// EKRANDA yazıyor — sessiz düşüş yok, çünkü sessiz düşüş "...mış gibi
// yapmak"tır.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { AppIcon } from '../design-system/IconSystem'
import { BusinessApplicationFormInput, loadSectors, submitBusinessApplication } from '../storage'
import { DEFAULT_SECTOR_ID } from '../sector/sector.registry'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { resolveStockRepositoryMode } from '../core/stock/index'
import { PostgresBasvuruDefteri, type YeniBasvuru } from '../onboarding/application.repository'
import { basvuruDogrula } from '../onboarding/application.service'

const createEmptyForm = (): BusinessApplicationFormInput => ({
  primarySectorId: DEFAULT_SECTOR_ID,
  companyName: '',
  ownerName: '',
  phone: '',
  email: '',
  taxNumber: '',
  taxOffice: '',
  city: '',
  district: '',
  address: '',
  note: ''
})

type Sonuc = { referans: string; gercekKayit: boolean }

export default function BusinessApplicationPublicForm(){
  const [values, setValues] = React.useState<BusinessApplicationFormInput>(() => createEmptyForm())
  const [sonuc, setSonuc] = React.useState<Sonuc | null>(null)
  const [hatalar, setHatalar] = React.useState<string[]>([])
  const [gonderiliyor, setGonderiliyor] = React.useState(false)
  const sectors = React.useMemo(() => loadSectors(), [])

  const gercekVeritabani = resolveStockRepositoryMode() === 'postgres' && isSupabaseConfigured()

  const updateField = <K extends keyof BusinessApplicationFormInput>(key: K, value: BusinessApplicationFormInput[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  /** Ekran alanlarını defterin beklediği biçime çevirir. */
  const basvuruyaCevir = (): YeniBasvuru => ({
    // ⚠️ Sektörün KODU gönderilir (`industrial-kitchen`), ekranın iç kimliği
    // (`sector_industrial_kitchen`) değil. Veritabanı kodu bekliyor.
    sektorKodu: sectors.find(s => s.id === values.primarySectorId)?.code,
    firmaAdi: values.companyName,
    yetkiliAdi: values.ownerName,
    telefon: values.phone,
    eposta: values.email,
    vergiNo: values.taxNumber,
    vergiDairesi: values.taxOffice,
    il: values.city,
    ilce: values.district,
    adres: values.address,
    not: values.note,
  })

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if(gonderiliyor) return

    const basvuru = basvuruyaCevir()
    const bulunanlar = basvuruDogrula(basvuru)
    if(bulunanlar.length > 0){ setHatalar(bulunanlar); return }

    setHatalar([])
    setGonderiliyor(true)
    try {
      if(gercekVeritabani){
        const defter = new PostgresBasvuruDefteri(getSupabase())
        const referans = await defter.gonder(basvuru)
        setSonuc({ referans, gercekKayit: true })
      } else {
        const eski = submitBusinessApplication(values)
        setSonuc({ referans: eski.id, gercekKayit: false })
      }
      setValues(createEmptyForm())
    } catch(e){
      setHatalar([e instanceof Error ? e.message : 'Başvuru gönderilemedi.'])
    } finally {
      setGonderiliyor(false)
    }
  }

  const returnHome = () => { window.location.href = '/' }

  const createNewApplication = () => {
    setValues(createEmptyForm())
    setSonuc(null)
    setHatalar([])
  }

  return (
    <div className="public-application-page">
      <section className="public-application-shell">
        <div className="public-application-header">
          <span>MİYOP</span>
          <h1>İşletme Başvuru Formu</h1>
          <p>Başvurunuzu gönderin, platform ekibi inceleme sonrası sizinle iletişime geçsin.</p>
        </div>

        {hatalar.length > 0 && (
          <div className="form-error" role="alert">
            {hatalar.length === 1 ? (
              <p>{hatalar[0]}</p>
            ) : (
              <>
                <p><strong>Formda {hatalar.length} eksik var:</strong></p>
                <ul>
                  {hatalar.map(h => <li key={h}>{h}</li>)}
                </ul>
              </>
            )}
          </div>
        )}

        {sonuc ? (
          <section className="public-application-success" aria-live="polite">
            <div className="public-application-success-icon" aria-hidden="true">
              <AppIcon name="success" size="XXL" />
            </div>
            <h2>Başvurunuz alındı.</h2>
            <div className="public-application-reference">
              <span>Başvuru Numarası</span>
              <strong>{sonuc.referans}</strong>
            </div>
            <p>
              Bu numarayı not alın. Bizimle iletişime geçtiğinizde
              başvurunuzu bu numarayla bulacağız.
            </p>
            <p>
              Başvurunuz platform ekibi tarafından incelendikten sonra size
              e-posta ile dönülecektir.
            </p>
            {!sonuc.gercekKayit && (
              <p className="muted">
                Not: bu kurulum tarayıcı hafızasında çalışıyor; başvuru kalıcı
                olarak kaydedilmedi.
              </p>
            )}
            <div className="public-application-success-actions">
              <button className="btn primary" type="button" onClick={returnHome}>Ana Sayfaya Dön</button>
              <button className="btn" type="button" onClick={createNewApplication}>Yeni Başvuru Oluştur</button>
            </div>
          </section>
        ) : (
        <form className="public-application-form" onSubmit={submit}>
          <div className="form-field">
            <label>Firma Adı</label>
            <input value={values.companyName} onChange={event => updateField('companyName', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Yetkili Ad Soyad</label>
            <input value={values.ownerName} onChange={event => updateField('ownerName', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Sektör</label>
            <select value={values.primarySectorId} onChange={event => updateField('primarySectorId', event.target.value)}>
              {sectors.map(sector => (
                <option key={sector.id} value={sector.id}>{sector.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Telefon</label>
              <input inputMode="tel" value={values.phone} onChange={event => updateField('phone', event.target.value)} />
            </div>
            <div className="form-field">
              <label>E-Posta</label>
              <input inputMode="email" value={values.email} onChange={event => updateField('email', event.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Vergi Dairesi</label>
              <input value={values.taxOffice} onChange={event => updateField('taxOffice', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Vergi / TC Numarası</label>
              <input inputMode="numeric" value={values.taxNumber} onChange={event => updateField('taxNumber', event.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>İl</label>
              <input value={values.city} onChange={event => updateField('city', event.target.value)} />
            </div>
            <div className="form-field">
              <label>İlçe</label>
              <input value={values.district} onChange={event => updateField('district', event.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label>Adres</label>
            <textarea rows={3} value={values.address} onChange={event => updateField('address', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Ek Notlar (isteğe bağlı)</label>
            <textarea rows={4} maxLength={1000} value={values.note} onChange={event => updateField('note', event.target.value)} />
          </div>
          <div className="form-actions">
            <button className="btn" type="button" onClick={returnHome} disabled={gonderiliyor}>
              Ana Sayfaya Dön
            </button>
            <button className="btn primary" type="submit" disabled={gonderiliyor}>
              {gonderiliyor ? 'Gönderiliyor…' : 'Başvuruyu Gönder'}
            </button>
          </div>
        </form>
        )}
      </section>
    </div>
  )
}
