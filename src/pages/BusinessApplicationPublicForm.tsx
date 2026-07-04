import React from 'react'
import { BusinessApplicationFormInput, submitBusinessApplication } from '../storage'
import type { BusinessApplication } from '../types'

const createEmptyForm = (): BusinessApplicationFormInput => ({
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

export default function BusinessApplicationPublicForm(){
  const [values, setValues] = React.useState<BusinessApplicationFormInput>(() => createEmptyForm())
  const [submittedApplication, setSubmittedApplication] = React.useState<BusinessApplication | null>(null)
  const [error, setError] = React.useState('')

  const updateField = <K extends keyof BusinessApplicationFormInput>(key: K, value: BusinessApplicationFormInput[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    try {
      const application = submitBusinessApplication(values)
      setValues(createEmptyForm())
      setSubmittedApplication(application)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Başvuru gönderilemedi.')
    }
  }

  const returnHome = () => {
    window.location.href = '/'
  }

  const createNewApplication = () => {
    setValues(createEmptyForm())
    setSubmittedApplication(null)
    setError('')
  }

  return (
    <div className="public-application-page">
      <section className="public-application-shell">
        <div className="public-application-header">
          <span>MIYOP</span>
          <h1>İşletme Başvuru Formu</h1>
          <p>Başvurunuzu gönderin, platform ekibi inceleme sonrası sizinle iletişime geçsin.</p>
        </div>

        {error && <div className="form-error">{error}</div>}

        {submittedApplication ? (
          <section className="public-application-success" aria-live="polite">
            <div className="public-application-success-icon" aria-hidden="true">✓</div>
            <h2>Başvurunuz başarıyla alınmıştır.</h2>
            <div className="public-application-reference">
              <span>Başvuru Numarası</span>
              <strong>{submittedApplication.id}</strong>
            </div>
            <p>Başvurunuz platform ekibi tarafından incelendikten sonra sizinle iletişime geçilecektir.</p>
            <div className="public-application-success-actions">
              <button className="btn primary" type="button" onClick={returnHome}>Ana Sayfaya Dön</button>
              <button className="btn" type="button" onClick={createNewApplication}>Yeni Başvuru Oluştur</button>
            </div>
          </section>
        ) : (
        <form className="public-application-form" onSubmit={submit}>
          <div className="form-field">
            <label>Firma Adı</label>
            <input value={values.companyName} onChange={event => updateField('companyName', event.target.value)} required />
          </div>
          <div className="form-field">
            <label>Yetkili Ad Soyad</label>
            <input value={values.ownerName} onChange={event => updateField('ownerName', event.target.value)} required />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Telefon</label>
              <input value={values.phone} onChange={event => updateField('phone', event.target.value)} required />
            </div>
            <div className="form-field">
              <label>E-Posta</label>
              <input type="email" value={values.email} onChange={event => updateField('email', event.target.value)} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Vergi Dairesi</label>
              <input value={values.taxOffice} onChange={event => updateField('taxOffice', event.target.value)} required />
            </div>
            <div className="form-field">
              <label>Vergi Numarası</label>
              <input value={values.taxNumber} onChange={event => updateField('taxNumber', event.target.value)} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Şehir</label>
              <input value={values.city} onChange={event => updateField('city', event.target.value)} required />
            </div>
            <div className="form-field">
              <label>İlçe</label>
              <input value={values.district} onChange={event => updateField('district', event.target.value)} required />
            </div>
          </div>
          <div className="form-field">
            <label>Adres</label>
            <textarea rows={3} value={values.address} onChange={event => updateField('address', event.target.value)} required />
          </div>
          <div className="form-field">
            <label>Not</label>
            <textarea rows={4} value={values.note} onChange={event => updateField('note', event.target.value)} />
          </div>
          <div className="form-actions">
            <button className="btn" type="button" onClick={returnHome}>Ana Sayfaya Dön</button>
            <button className="btn primary" type="submit">Başvuruyu Gönder</button>
          </div>
        </form>
        )}
      </section>
    </div>
  )
}
