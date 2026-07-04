import React from 'react'
import { ApplicationNote, ApplicationStatus, BusinessApplication, User } from '../types'
import FirstLoginCredentialsCard from '../components/FirstLoginCredentialsCard'
import {
  addApplicationNote,
  approveBusinessApplication,
  loadApplicationNotes,
  loadBusinessApplications,
  markBusinessApplicationInReview,
  rejectBusinessApplication
} from '../storage'
import type { FirstLoginCredentialDelivery } from '../storage'

type Props = {
  currentUser: User
}

type StatusFilter = ApplicationStatus | 'all'

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const getDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'
  return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
}

const getStatusClassName = (status: ApplicationStatus) => {
  if(status === 'Onaylandı') return 'success'
  if(status === 'Reddedildi') return 'danger-pill'
  if(status === 'İnceleniyor') return 'info-pill'
  return 'warning-pill'
}

const sortApplications = (items: BusinessApplication[]) => {
  return [...items].sort((first, second) => second.createdAt.localeCompare(first.createdAt))
}

const getAverageApprovalTime = (applications: BusinessApplication[]) => {
  const approvedDurations = applications
    .filter(application => application.status === 'Onaylandı')
    .map(application => {
      const created = new Date(application.createdAt).getTime()
      const updated = new Date(application.updatedAt).getTime()
      return Number.isFinite(created) && Number.isFinite(updated) ? Math.max(0, updated - created) : 0
    })
    .filter(Boolean)

  if(approvedDurations.length === 0) return '-'
  const averageMs = approvedDurations.reduce((sum, value) => sum + value, 0) / approvedDurations.length
  const days = Math.max(1, Math.round(averageMs / 86400000))
  return `${formatNumber(days)} gün`
}

export default function BusinessApplicationSystem({ currentUser }: Props){
  const [applications, setApplications] = React.useState<BusinessApplication[]>(() => loadBusinessApplications())
  const [notes, setNotes] = React.useState<ApplicationNote[]>(() => loadApplicationNotes())
  const [selectedApplicationId, setSelectedApplicationId] = React.useState(() => loadBusinessApplications()[0]?.id || '')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [cityFilter, setCityFilter] = React.useState('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [approvalNote, setApprovalNote] = React.useState('')
  const [rejectionReason, setRejectionReason] = React.useState('')
  const [noteDraft, setNoteDraft] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')
  const [approvalCredentials, setApprovalCredentials] = React.useState<FirstLoginCredentialDelivery | null>(null)

  const refresh = (selectedId = selectedApplicationId) => {
    const nextApplications = loadBusinessApplications()
    setApplications(nextApplications)
    setNotes(loadApplicationNotes())
    if(selectedId && nextApplications.some(application => application.id === selectedId)){
      setSelectedApplicationId(selectedId)
    } else {
      setSelectedApplicationId(nextApplications[0]?.id || '')
    }
  }

  const selectedApplication = applications.find(application => application.id === selectedApplicationId) || applications[0]
  const selectedNotes = notes
    .filter(note => note.applicationId === selectedApplication?.id)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))

  const cityOptions = React.useMemo(() => {
    return Array.from(new Set(applications.map(application => application.city).filter(Boolean)))
      .sort((first, second) => first.localeCompare(second, 'tr-TR'))
  }, [applications])

  const visibleApplications = React.useMemo(() => {
    return sortApplications(applications).filter(application => {
      const dateKey = getDateKey(application.createdAt)
      const matchesStatus = statusFilter === 'all' || application.status === statusFilter
      const matchesCity = cityFilter === 'all' || application.city === cityFilter
      const matchesStart = !startDate || dateKey >= startDate
      const matchesEnd = !endDate || dateKey <= endDate
      return matchesStatus && matchesCity && matchesStart && matchesEnd
    })
  }, [applications, cityFilter, endDate, startDate, statusFilter])

  const todayKey = getDateKey(new Date())
  const currentMonth = todayKey.slice(0, 7)
  const totalCount = applications.length
  const pendingCount = applications.filter(application => application.status === 'Beklemede').length
  const approvedCount = applications.filter(application => application.status === 'Onaylandı').length
  const rejectedCount = applications.filter(application => application.status === 'Reddedildi').length
  const todayCount = applications.filter(application => getDateKey(application.createdAt) === todayKey).length
  const approvedThisMonth = applications.filter(application => application.status === 'Onaylandı' && getDateKey(application.updatedAt).startsWith(currentMonth)).length

  const runAction = (action: () => void) => {
    setError('')
    setMessage('')
    setApprovalCredentials(null)
    try {
      action()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'İşlem tamamlanamadı.')
    }
  }

  const inspectApplication = (application: BusinessApplication) => runAction(() => {
    const updated = markBusinessApplicationInReview(application.id, currentUser)
    refresh(updated.id)
    setMessage(`${updated.companyName} başvurusu incelemeye alındı.`)
  })

  const approveSelectedApplication = () => {
    if(!selectedApplication) return
    runAction(() => {
      const result = approveBusinessApplication(selectedApplication.id, approvalNote, currentUser)
      refresh(result.application.id)
      setApprovalCredentials(result.firstLoginCredentials)
      setApprovalNote('')
      setRejectionReason('')
      setNoteDraft('')
      setMessage(`${result.company.companyName} onaylandı. Tenant: ${result.tenant.tenantCode}. İlk giriş bilgileri aşağıdaki kartta hazırlandı.`)
    })
  }

  const rejectSelectedApplication = () => {
    if(!selectedApplication) return
    runAction(() => {
      const updated = rejectBusinessApplication(selectedApplication.id, rejectionReason, currentUser)
      refresh(updated.id)
      setRejectionReason('')
      setMessage(`${updated.companyName} başvurusu reddedildi.`)
    })
  }

  const addNoteToSelectedApplication = () => {
    if(!selectedApplication) return
    runAction(() => {
      addApplicationNote(selectedApplication.id, noteDraft, currentUser)
      refresh(selectedApplication.id)
      setNoteDraft('')
      setMessage('Başvuru notu eklendi.')
    })
  }

  return (
    <div className="business-application-page">
      <div className="page-title">
        <div>
          <h2>İşletme Başvuru Sistemi</h2>
          <p className="muted">Dış başvuruları inceleyin, onay sonrası firma, tenant, lisans ve ilk kullanıcı kurulumunu otomatik tamamlayın.</p>
        </div>
      </div>

      {message && <div className="form-success">{message}</div>}
      {error && <div className="form-error">{error}</div>}
      {approvalCredentials && <FirstLoginCredentialsCard credentials={approvalCredentials} />}

      <div className="metric-grid">
        <div className="metric-card"><span>Toplam Başvuru</span><strong>{formatNumber(totalCount)}</strong></div>
        <div className="metric-card"><span>Bekleyen Başvuru</span><strong>{formatNumber(pendingCount)}</strong></div>
        <div className="metric-card"><span>Onaylanan Başvuru</span><strong>{formatNumber(approvedCount)}</strong></div>
        <div className="metric-card"><span>Reddedilen Başvuru</span><strong>{formatNumber(rejectedCount)}</strong></div>
      </div>

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card"><span>Bugünkü Başvurular</span><strong>{formatNumber(todayCount)}</strong></div>
        <div className="metric-card compact-metric-card"><span>Bu Ay Onaylananlar</span><strong>{formatNumber(approvedThisMonth)}</strong></div>
        <div className="metric-card compact-metric-card"><span>Başlangıç Kapsamı</span><strong>Çekirdek Modüller</strong></div>
        <div className="metric-card compact-metric-card"><span>Ortalama Onay Süresi</span><strong>{getAverageApprovalTime(applications)}</strong></div>
      </div>

      <div className="product-layout business-application-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Başvuru Listesi</h3>
              <p className="muted">{formatNumber(visibleApplications.length)} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls business-application-filters">
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm durumlar</option>
                {(['Beklemede', 'İnceleniyor', 'Onaylandı', 'Reddedildi'] as ApplicationStatus[]).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
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
            <table className="data-table business-application-table">
              <thead>
                <tr>
                  <th>Firma</th>
                  <th>Yetkili</th>
                  <th>Telefon</th>
                  <th>Başvuru Tarihi</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visibleApplications.length === 0 && (
                  <tr><td colSpan={6} className="empty-cell">Bu filtrelere uygun başvuru bulunamadı.</td></tr>
                )}
                {visibleApplications.map(application => (
                  <tr key={application.id} className={selectedApplication?.id === application.id ? 'selected-row' : ''}>
                    <td>
                      <strong>{application.companyName}</strong>
                      <div className="muted small-text">{application.city} / {application.district}</div>
                    </td>
                    <td>{application.ownerName}</td>
                    <td>{application.phone}</td>
                    <td>{formatDateTime(application.createdAt)}</td>
                    <td><span className={`status-pill ${getStatusClassName(application.status)}`}>{application.status}</span></td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => setSelectedApplicationId(application.id)}>Detay</button>
                      <button className="btn" type="button" disabled={application.status === 'Onaylandı' || application.status === 'Reddedildi'} onClick={() => inspectApplication(application)}>Başvuruyu İncele</button>
                      <button className="btn" type="button" disabled={application.status === 'Onaylandı' || application.status === 'Reddedildi'} onClick={() => {
                        setSelectedApplicationId(application.id)
                        setApprovalNote('')
                      }}>Onayla</button>
                      <button className="btn" type="button" disabled={application.status === 'Onaylandı'} onClick={() => {
                        setSelectedApplicationId(application.id)
                        setRejectionReason(application.approvalNote || '')
                      }}>Reddet</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side business-application-side">
          <section className="card business-application-detail-card">
            <div className="section-header compact">
              <div>
                <h3>Başvuru Detayı</h3>
                <p className="muted">{selectedApplication ? selectedApplication.companyName : 'Başvuru seçilmedi.'}</p>
              </div>
              {selectedApplication && <span className={`status-pill ${getStatusClassName(selectedApplication.status)}`}>{selectedApplication.status}</span>}
            </div>

            {selectedApplication ? (
              <div className="business-application-detail-stack">
                <section>
                  <h4>Firma Bilgileri</h4>
                  <p><strong>{selectedApplication.companyName}</strong></p>
                  <p>{selectedApplication.taxOffice} / {selectedApplication.taxNumber}</p>
                </section>
                <section>
                  <h4>İletişim Bilgileri</h4>
                  <p>{selectedApplication.ownerName}</p>
                  <p>{selectedApplication.phone}</p>
                  <p>{selectedApplication.email}</p>
                </section>
                <section>
                  <h4>Adres</h4>
                  <p>{selectedApplication.address}</p>
                  <p>{selectedApplication.city} / {selectedApplication.district}</p>
                </section>
                <section>
                  <h4>Başlangıç Kapsamı</h4>
                  <p>Çekirdek Sistem Modülleri</p>
                </section>
                <section>
                  <h4>Notlar</h4>
                  {selectedApplication.approvalNote && <p>{selectedApplication.approvalNote}</p>}
                  {selectedNotes.length === 0 && <p className="muted">Not yok.</p>}
                  {selectedNotes.map(note => (
                    <div className="business-application-note" key={note.id}>
                      <strong>{note.createdBy}</strong>
                      <span>{formatDateTime(note.createdAt)}</span>
                      <p>{note.note}</p>
                    </div>
                  ))}
                </section>
                <section>
                  <h4>Başvuru Geçmişi</h4>
                  <div className="business-application-history">
                    <div><span>Oluşturuldu</span><strong>{formatDateTime(selectedApplication.createdAt)}</strong></div>
                    <div><span>Son Güncelleme</span><strong>{formatDateTime(selectedApplication.updatedAt)}</strong></div>
                    <div><span>Durum</span><strong>{selectedApplication.status}</strong></div>
                  </div>
                </section>
              </div>
            ) : (
              <p className="muted">Başvuru detayı için listeden kayıt seçin.</p>
            )}
          </section>

          {selectedApplication && (
            <section className="card">
              <div className="section-header compact">
                <h3>İşlemler</h3>
              </div>
              <div className="stacked-form">
                <button className="btn" type="button" disabled={selectedApplication.status === 'Onaylandı' || selectedApplication.status === 'Reddedildi'} onClick={() => inspectApplication(selectedApplication)}>
                  Başvuruyu İncele
                </button>
                <div className="form-field">
                  <label>Onay Notu</label>
                  <textarea rows={3} value={approvalNote} onChange={event => setApprovalNote(event.target.value)} />
                </div>
                <button className="btn primary" type="button" disabled={selectedApplication.status === 'Onaylandı' || selectedApplication.status === 'Reddedildi'} onClick={approveSelectedApplication}>
                  Onayla
                </button>
                <div className="form-field">
                  <label>Red Sebebi</label>
                  <textarea rows={3} value={rejectionReason} onChange={event => setRejectionReason(event.target.value)} />
                </div>
                <button className="btn" type="button" disabled={selectedApplication.status === 'Onaylandı'} onClick={rejectSelectedApplication}>
                  Reddet
                </button>
                <div className="form-field">
                  <label>Not Ekle</label>
                  <textarea rows={3} value={noteDraft} onChange={event => setNoteDraft(event.target.value)} />
                </div>
                <button className="btn" type="button" onClick={addNoteToSelectedApplication}>Not Ekle</button>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
