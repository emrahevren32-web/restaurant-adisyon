import React from 'react'
import { BUSINESS_APPLICATION_PACKAGES, BusinessApplicationFormInput, submitBusinessApplication } from '../storage'

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
  requestedPackage: BUSINESS_APPLICATION_PACKAGES[0],
  note: ''
})

export default function BusinessApplicationPublicForm(){
  const [values, setValues] = React.useState<BusinessApplicationFormInput>(() => createEmptyForm())
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')

  const updateField = <K extends keyof BusinessApplicationFormInput>(key: K, value: BusinessApplicationFormInput[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setMessage('')
    setError('')

    try {
      const application = submitBusinessApplication(values)
      setValues(createEmptyForm())
      setMessage(`${application.companyName} başvurusu alındı. Başvuru numarası: ${application.id}.`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Başvuru gönderilemedi.')
    }
  }

  return (
    <div className="public-application-page">
      <section className="public-application-shell">
        <div className="public-application-header">
          <span>MIYOP</span>
          <h1>İşletme Başvuru Formu</h1>
          <p>Başvurunuzu gönderin, platform ekibi inceleme sonrası sizinle iletişime geçsin.</p>
        </div>

        {/* TODO: Başvuru sonrası "Ana Sayfaya Dön" butonu eklenecek. */}
        {message && <div className="form-success">{message}</div>}
        {error && <div className="form-error">{error}</div>}

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
            <label>Talep Edilen Paket</label>
            <select value={values.requestedPackage} onChange={event => updateField('requestedPackage', event.target.value)} required>
              {BUSINESS_APPLICATION_PACKAGES.map(packageName => (
                <option key={packageName} value={packageName}>{packageName}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Not</label>
            <textarea rows={4} value={values.note} onChange={event => updateField('note', event.target.value)} />
          </div>
          <div className="form-actions">
            <button className="btn primary" type="submit">Başvuruyu Gönder</button>
          </div>
        </form>
      </section>
    </div>
  )
}
