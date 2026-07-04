import React from 'react'
import { BusinessRegistration, BusinessRegistrationStatus, User } from '../types'
import { addActionLog, loadBusinessRegistrations, saveBusinessRegistrations } from '../storage'

type Props = {
  currentUser: User
}

type StatusFilter = BusinessRegistrationStatus | 'all'

type RegistrationFormValues = {
  businessName: string
  ownerName: string
  phone: string
  email: string
  city: string
  district: string
  taxNumber: string
  taxOffice: string
  address: string
  branchCount: number
  requestedPackage: 'Başlangıç'
}

const registrationStatuses: BusinessRegistrationStatus[] = ['Başvuru Bekliyor', 'Onaylandı', 'Reddedildi', 'Pasif']

const createId = () => `business_registration_${Date.now()}_${Math.random().toString(16).slice(2)}`

const createEmptyValues = (): RegistrationFormValues => ({
  businessName: '',
  ownerName: '',
  phone: '',
  email: '',
  city: '',
  district: '',
  taxNumber: '',
  taxOffice: '',
  address: '',
  branchCount: 1,
  requestedPackage: 'Başlangıç'
})

const getDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getCurrentMonth = () => new Date().toLocaleDateString('sv-SE').slice(0, 7)

const getWeekStartKey = () => {
  const date = new Date()
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  date.setHours(0, 0, 0, 0)
  return date.toLocaleDateString('sv-SE')
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'
  return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
}

const sortRegistrations = (items: BusinessRegistration[]) => {
  return [...items].sort((first, second) => second.createdAt.localeCompare(first.createdAt))
}

const getStatusClassName = (status: BusinessRegistrationStatus) => {
  if(status === 'Onaylandı') return 'success'
  if(status === 'Reddedildi') return 'danger-pill'
  if(status === 'Pasif') return 'muted-pill'
  return 'warning-pill'
}

const normalizeFormValues = (values: RegistrationFormValues): RegistrationFormValues => ({
  businessName: values.businessName.trim(),
  ownerName: values.ownerName.trim(),
  phone: values.phone.trim(),
  email: values.email.trim(),
  city: values.city.trim(),
  district: values.district.trim(),
  taxNumber: values.taxNumber.trim(),
  taxOffice: values.taxOffice.trim(),
  address: values.address.trim(),
  branchCount: Math.max(1, Math.round(Number(values.branchCount) || 1)),
  requestedPackage: values.requestedPackage
})

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

export default function BusinessRegistrationSystem({ currentUser }: Props){
  const [registrations, setRegistrations] = React.useState<BusinessRegistration[]>(() => loadBusinessRegistrations())
  const [selectedRegistration, setSelectedRegistration] = React.useState<BusinessRegistration | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [cityFilter, setCityFilter] = React.useState('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    saveBusinessRegistrations(registrations)
  }, [registrations])

  const cityOptions = React.useMemo(() => {
    return Array.from(new Set(registrations.map(item => item.city).filter(Boolean)))
      .sort((first, second) => first.localeCompare(second, 'tr-TR'))
  }, [registrations])

  const visibleRegistrations = React.useMemo(() => {
    return sortRegistrations(registrations).filter(item => {
      const dateKey = getDateKey(item.createdAt)
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      const matchesCity = cityFilter === 'all' || item.city === cityFilter
      const matchesStart = !startDate || dateKey >= startDate
      const matchesEnd = !endDate || dateKey <= endDate
      return matchesStatus && matchesCity && matchesStart && matchesEnd
    })
  }, [cityFilter, endDate, registrations, startDate, statusFilter])

  const currentMonth = getCurrentMonth()
  const currentWeekStart = getWeekStartKey()
  const totalCount = registrations.length
  const pendingCount = registrations.filter(item => item.status === 'Başvuru Bekliyor').length
  const approvedCount = registrations.filter(item => item.status === 'Onaylandı').length
  const rejectedCount = registrations.filter(item => item.status === 'Reddedildi').length
  const thisMonthCount = registrations.filter(item => getDateKey(item.createdAt).startsWith(currentMonth)).length
  const thisWeekCount = registrations.filter(item => getDateKey(item.createdAt) >= currentWeekStart).length
  const activeBusinessCount = registrations.filter(item => item.status === 'Onaylandı').length
  const passiveBusinessCount = registrations.filter(item => item.status === 'Pasif').length

  const applyUpdatedRegistration = (
    updatedRegistration: BusinessRegistration,
    operationType: 'İşletme başvurusu onaylandı' | 'İşletme başvurusu reddedildi' | 'İşletme başvurusu güncellendi',
    description: string
  ) => {
    setRegistrations(prev => prev.map(item => item.id === updatedRegistration.id ? updatedRegistration : item))
    setSelectedRegistration(updatedRegistration)
    addActionLog({
      operationType,
      user: currentUser,
      description
    })
  }

  const createRegistration = (values: RegistrationFormValues) => {
    const normalized = normalizeFormValues(values)

    if(!normalized.businessName){
      setFormError('İşletme adı zorunludur.')
      return false
    }

    if(!normalized.ownerName){
      setFormError('Yetkili adı zorunludur.')
      return false
    }

    if(!normalized.phone){
      setFormError('Telefon zorunludur.')
      return false
    }

    if(!normalized.email){
      setFormError('E-posta zorunludur.')
      return false
    }

    if(!normalized.city){
      setFormError('Şehir zorunludur.')
      return false
    }

    const now = new Date().toISOString()
    const registration: BusinessRegistration = {
      id: createId(),
      ...normalized,
      status: 'Başvuru Bekliyor',
      notes: '',
      approvedBy: '',
      approvedAt: '',
      rejectedReason: '',
      createdAt: now,
      updatedAt: now
    }

    setRegistrations(prev => [registration, ...prev])
    setSelectedRegistration(registration)
    setFormError('')
    addActionLog({
      operationType: 'İşletme başvurusu oluşturuldu',
      user: currentUser,
      description: `${registration.businessName} işletme başvurusu oluşturuldu. Başlangıç kapsamı: çekirdek sistem modülleri.`
    })
    return true
  }

  const approveRegistration = (registration: BusinessRegistration) => {
    const now = new Date().toISOString()
    const approvedRegistration: BusinessRegistration = {
      ...registration,
      status: 'Onaylandı',
      approvedBy: currentUser.fullName || currentUser.username,
      approvedAt: now,
      rejectedReason: '',
      updatedAt: now
    }

    applyUpdatedRegistration(
      approvedRegistration,
      'İşletme başvurusu onaylandı',
      `${approvedRegistration.businessName} işletme başvurusu onaylandı. Onaylayan: ${approvedRegistration.approvedBy}.`
    )
  }

  const rejectRegistration = (registration: BusinessRegistration) => {
    const reason = window.prompt(`${registration.businessName} başvurusu için red nedeni girin:`, registration.rejectedReason || '')
    const rejectedReason = String(reason || '').trim()
    if(!rejectedReason){
      alert('Red nedeni zorunludur.')
      return
    }

    const now = new Date().toISOString()
    const rejectedRegistration: BusinessRegistration = {
      ...registration,
      status: 'Reddedildi',
      rejectedReason,
      approvedBy: '',
      approvedAt: '',
      updatedAt: now
    }

    applyUpdatedRegistration(
      rejectedRegistration,
      'İşletme başvurusu reddedildi',
      `${rejectedRegistration.businessName} işletme başvurusu reddedildi. Red nedeni: ${rejectedReason}.`
    )
  }

  const updateRegistrationNote = (registration: BusinessRegistration) => {
    const note = window.prompt(`${registration.businessName} başvurusu için not girin:`, registration.notes || '')
    if(note === null) return

    const now = new Date().toISOString()
    const updatedRegistration: BusinessRegistration = {
      ...registration,
      notes: note.trim(),
      updatedAt: now
    }

    applyUpdatedRegistration(
      updatedRegistration,
      'İşletme başvurusu güncellendi',
      `${updatedRegistration.businessName} işletme başvurusu notu güncellendi.`
    )
  }

  return (
    <div className="business-registration-page">
      <div className="page-title">
        <div>
          <h2>İşletme Kayıt Sistemi</h2>
          <p className="muted">Sisteme katılmak isteyen işletmeleri yönetin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Başvuru</span>
          <strong>{formatNumber(totalCount)}</strong>
        </div>
        <div className="metric-card">
          <span>Bekleyen Başvuru</span>
          <strong>{formatNumber(pendingCount)}</strong>
        </div>
        <div className="metric-card">
          <span>Onaylanan Başvuru</span>
          <strong>{formatNumber(approvedCount)}</strong>
        </div>
        <div className="metric-card">
          <span>Reddedilen Başvuru</span>
          <strong>{formatNumber(rejectedCount)}</strong>
        </div>
      </div>

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Bu Ay Başvuru</span>
          <strong>{formatNumber(thisMonthCount)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Bu Hafta Başvuru</span>
          <strong>{formatNumber(thisWeekCount)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Aktif İşletme</span>
          <strong>{formatNumber(activeBusinessCount)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Pasif İşletme</span>
          <strong>{formatNumber(passiveBusinessCount)}</strong>
        </div>
      </div>

      <div className="product-layout business-registration-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Başvuru Tablosu</h3>
              <p className="muted">{formatNumber(visibleRegistrations.length)} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls business-registration-filters">
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm durumlar</option>
                {registrationStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
              <select value={cityFilter} onChange={event => setCityFilter(event.target.value)}>
                <option value="all">Tüm şehirler</option>
                {cityOptions.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
              <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
              <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table business-registration-table">
              <thead>
                <tr>
                  <th>İşletme</th>
                  <th>Yetkili</th>
                  <th>Telefon</th>
                  <th>E-posta</th>
                  <th>Şehir</th>
                  <th>Başvuru Tarihi</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visibleRegistrations.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Bu filtrelere uygun işletme başvurusu bulunamadı.</td></tr>
                )}
                {visibleRegistrations.map(registration => (
                  <tr key={registration.id} className={selectedRegistration?.id === registration.id ? 'selected-row' : ''}>
                    <td>
                      <strong>{registration.businessName}</strong>
                      <div className="muted small-text">{registration.district || '-'} / {registration.branchCount} şube</div>
                    </td>
                    <td>{registration.ownerName}</td>
                    <td>{registration.phone}</td>
                    <td>{registration.email}</td>
                    <td>{registration.city}</td>
                    <td>{formatDateTime(registration.createdAt)}</td>
                    <td><span className={`status-pill ${getStatusClassName(registration.status)}`}>{registration.status}</span></td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => setSelectedRegistration(registration)}>Detay</button>
                      <button className="btn" type="button" onClick={() => approveRegistration(registration)}>Onayla</button>
                      <button className="btn" type="button" onClick={() => rejectRegistration(registration)}>Reddet</button>
                      <button className="btn" type="button" onClick={() => updateRegistrationNote(registration)}>Not Ekle</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side">
          <section className="card">
            <div className="section-header compact">
              <h3>Yeni Başvuru Formu</h3>
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <RegistrationForm onSave={createRegistration} />
          </section>

          <section className="card business-registration-detail-card">
            <div className="section-header compact">
              <div>
                <h3>Başvuru Detayı</h3>
                <p className="muted">{selectedRegistration ? selectedRegistration.businessName : 'Başvuru seçilmedi.'}</p>
              </div>
            </div>
            {selectedRegistration ? (
              <div className="financial-summary-values business-registration-detail-values">
                <div>
                  <span>Durum</span>
                  <strong>{selectedRegistration.status}</strong>
                </div>
                <div>
                  <span>Başlangıç Kapsamı</span>
                  <strong>Çekirdek Sistem Modülleri</strong>
                </div>
                <div>
                  <span>Vergi Bilgisi</span>
                  <strong>{[selectedRegistration.taxOffice, selectedRegistration.taxNumber].filter(Boolean).join(' / ') || '-'}</strong>
                </div>
                <div>
                  <span>Onay Bilgisi</span>
                  <strong>{selectedRegistration.approvedAt ? `${selectedRegistration.approvedBy} - ${formatDateTime(selectedRegistration.approvedAt)}` : '-'}</strong>
                </div>
                <div>
                  <span>Red Nedeni</span>
                  <strong>{selectedRegistration.rejectedReason || '-'}</strong>
                </div>
                <div>
                  <span>Notlar</span>
                  <strong>{selectedRegistration.notes || '-'}</strong>
                </div>
              </div>
            ) : (
              <p className="muted">Detay görüntülemek için tablodan bir başvuru seçin.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function RegistrationForm({ onSave }: { onSave: (values: RegistrationFormValues) => boolean }){
  const [values, setValues] = React.useState<RegistrationFormValues>(() => createEmptyValues())

  const updateField = <K extends keyof RegistrationFormValues>(key: K, value: RegistrationFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const saved = onSave(values)
    if(saved) setValues(createEmptyValues())
  }

  return (
    <form className="stacked-form" onSubmit={submit}>
      <div className="form-field">
        <label>İşletme Adı</label>
        <input value={values.businessName} onChange={event => updateField('businessName', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Yetkili Ad Soyad</label>
        <input value={values.ownerName} onChange={event => updateField('ownerName', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Telefon</label>
        <input value={values.phone} onChange={event => updateField('phone', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>E-posta</label>
        <input type="email" value={values.email} onChange={event => updateField('email', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Şehir</label>
        <input value={values.city} onChange={event => updateField('city', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>İlçe</label>
        <input value={values.district} onChange={event => updateField('district', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Vergi Numarası</label>
        <input value={values.taxNumber} onChange={event => updateField('taxNumber', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Vergi Dairesi</label>
        <input value={values.taxOffice} onChange={event => updateField('taxOffice', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Adres</label>
        <textarea rows={3} value={values.address} onChange={event => updateField('address', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Şube Sayısı</label>
        <input
          type="number"
          min={1}
          value={values.branchCount}
          onChange={event => updateField('branchCount', Number(event.target.value))}
        />
      </div>
      <div className="form-actions">
        <button className="btn primary" type="submit">Kaydet</button>
      </div>
    </form>
  )
}
