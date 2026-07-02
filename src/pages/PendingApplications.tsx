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

type QueueStatus = Extract<ApplicationStatus, 'Beklemede' | 'İnceleniyor'>
type StatusFilter = QueueStatus | 'all'
type DetailMode = 'review' | 'notes' | 'history'

const queueStatuses: QueueStatus[] = ['Beklemede', 'İnceleniyor']

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const normalizeLookup = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/Ä±/g, 'i')
  .replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, '')

const getDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const getDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? getDate(value) : value
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('sv-SE') : ''
}

const formatDateTime = (value: string) => {
  const date = getDate(value)
  if(!date) return '-'
  return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
}

const getStartOfWeek = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = today.getDay() || 7
  today.setDate(today.getDate() - day + 1)
  return today
}

const getWaitingHours = (application: BusinessApplication) => {
  const createdAt = getDate(application.createdAt)
  if(!createdAt) return 0
  return Math.max(0, Date.now() - createdAt.getTime()) / 3600000
}

const formatAverageWaitingTime = (applications: BusinessApplication[]) => {
  if(applications.length === 0) return '-'
  const averageHours = applications.reduce((sum, application) => sum + getWaitingHours(application), 0) / applications.length
  if(averageHours < 24) return `${formatNumber(Math.max(1, Math.round(averageHours)))} saat`
  return `${formatNumber(Math.max(1, Math.round(averageHours / 24)))} gün`
}

const getStatusClassName = (status: ApplicationStatus) => {
  if(status === 'Onaylandı') return 'success'
  if(status === 'Reddedildi') return 'danger-pill'
  if(status === 'İnceleniyor') return 'info-pill'
  return 'warning-pill'
}

const sortApplications = (applications: BusinessApplication[]) => {
  return [...applications].sort((first, second) => second.createdAt.localeCompare(first.createdAt))
}

export default function PendingApplications({ currentUser }: Props){
  const [applications, setApplications] = React.useState<BusinessApplication[]>(() => loadBusinessApplications())
  const [notes, setNotes] = React.useState<ApplicationNote[]>(() => loadApplicationNotes())
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [applicationDate, setApplicationDate] = React.useState('')
  const [selectedApplicationId, setSelectedApplicationId] = React.useState('')
  const [detailMode, setDetailMode] = React.useState<DetailMode>('review')
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')
  const [approvalCredentials, setApprovalCredentials] = React.useState<FirstLoginCredentialDelivery | null>(null)

  const refresh = (selectedId = selectedApplicationId) => {
    const nextApplications = loadBusinessApplications()
    const nextNotes = loadApplicationNotes()
    setApplications(nextApplications)
    setNotes(nextNotes)

    const nextQueue = nextApplications.filter(application => queueStatuses.includes(application.status as QueueStatus))
    setSelectedApplicationId(selectedId && nextQueue.some(application => application.id === selectedId)
      ? selectedId
      : nextQueue[0]?.id || '')
  }

  const queueApplications = React.useMemo(() => {
    return applications.filter(application => queueStatuses.includes(application.status as QueueStatus))
  }, [applications])

  React.useEffect(() => {
    if(selectedApplicationId || queueApplications.length === 0) return
    setSelectedApplicationId(queueApplications[0].id)
  }, [queueApplications, selectedApplicationId])

  const selectedApplication = queueApplications.find(application => application.id === selectedApplicationId) || queueApplications[0]
  const selectedNotes = notes
    .filter(note => note.applicationId === selectedApplication?.id)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))

  const visibleApplications = React.useMemo(() => {
    const searchValue = normalizeLookup(search)
    return sortApplications(queueApplications).filter(application => {
      const matchesSearch = !searchValue || [
        application.companyName,
        application.ownerName,
        application.email
      ].some(value => normalizeLookup(value).includes(searchValue))
      const matchesStatus = statusFilter === 'all' || application.status === statusFilter
      const matchesDate = !applicationDate || getDateKey(application.createdAt) === applicationDate
      return matchesSearch && matchesStatus && matchesDate
    })
  }, [applicationDate, queueApplications, search, statusFilter])

  const todayKey = getDateKey(new Date())
  const weekStart = getStartOfWeek()
  const summary = React.useMemo(() => ({
    pending: queueApplications.length,
    today: queueApplications.filter(application => getDateKey(application.createdAt) === todayKey).length,
    thisWeek: queueApplications.filter(application => {
      const createdAt = getDate(application.createdAt)
      return createdAt ? createdAt >= weekStart : false
    }).length,
    averageWaiting: formatAverageWaitingTime(queueApplications)
  }), [queueApplications, todayKey, weekStart])

  const runAction = (action: () => void) => {
    setMessage('')
    setError('')
    setApprovalCredentials(null)
    try {
      action()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'İşlem tamamlanamadı.')
    }
  }

  const selectApplication = (application: BusinessApplication, mode: DetailMode) => {
    setSelectedApplicationId(application.id)
    setDetailMode(mode)
  }

  const inspectApplication = (application: BusinessApplication) => runAction(() => {
    const updated = markBusinessApplicationInReview(application.id, currentUser)
    refresh(updated.id)
    setDetailMode('review')
    setMessage(`${updated.companyName} başvurusu incelemeye alındı.`)
  })

  const approveApplication = (application: BusinessApplication) => runAction(() => {
    const approvalNote = window.prompt('Onay notu', application.approvalNote || '') || ''
    const result = approveBusinessApplication(application.id, approvalNote, currentUser)
    refresh()
    setApprovalCredentials(result.firstLoginCredentials)
    setMessage(`${result.company.companyName} onaylandı. Tenant: ${result.tenant.tenantCode}. İlk giriş bilgileri aşağıdaki kartta hazırlandı.`)
  })

  const rejectApplication = (application: BusinessApplication) => runAction(() => {
    const reason = window.prompt('Red sebebi', application.approvalNote || '')
    if(reason === null) return
    const updated = rejectBusinessApplication(application.id, reason, currentUser)
    refresh()
    setMessage(`${updated.companyName} başvurusu reddedildi.`)
  })

  const addNoteToApplication = (application: BusinessApplication) => runAction(() => {
    const note = window.prompt('Başvuru notu', '')
    if(note === null) return
    addApplicationNote(application.id, note, currentUser)
    refresh(application.id)
    setDetailMode('notes')
    setMessage('Başvuru notu eklendi.')
  })

  return (
    <div className="pending-applications-page">
      <div className="evren360-hero">
        <div>
          <span>EVREN360</span>
          <h2>Onay Bekleyen İşletmeler</h2>
          <p>Bekleyen işletme başvurularını inceleyin, onaylayın, reddedin ve operasyon notlarını yönetin.</p>
        </div>
        <div className="evren360-hero-meta">
          <strong>{formatNumber(visibleApplications.length)} kayıt</strong>
          <span>Operasyon kuyruğu</span>
        </div>
      </div>

      {message && <div className="evren360-feedback">{message}</div>}
      {error && <div className="evren360-feedback error">{error}</div>}
      {approvalCredentials && <FirstLoginCredentialsCard credentials={approvalCredentials} />}

      <div className="evren360-kpi-grid">
        <div className="evren360-kpi warning">
          <span>Bekleyen Başvuru</span>
          <strong>{formatNumber(summary.pending)}</strong>
          <p>Beklemede veya inceleniyor.</p>
        </div>
        <div className="evren360-kpi">
          <span>Bugün Gelen</span>
          <strong>{formatNumber(summary.today)}</strong>
          <p>Bugün oluşturulan açık kayıtlar.</p>
        </div>
        <div className="evren360-kpi success">
          <span>Bu Hafta Gelen</span>
          <strong>{formatNumber(summary.thisWeek)}</strong>
          <p>Pazartesi başlangıçlı hafta.</p>
        </div>
        <div className="evren360-kpi muted">
          <span>Ortalama Bekleme Süresi</span>
          <strong>{summary.averageWaiting}</strong>
          <p>Açık başvurular üzerinden.</p>
        </div>
      </div>

      <section className="evren360-panel pending-applications-panel">
        <div className="evren360-panel-header">
          <div>
            <h3>Başvuru Listesi</h3>
            <p>Beklemede ve inceleniyor durumundaki işletme başvuruları.</p>
          </div>
          <div className="pending-applications-controls">
            <label>
              <span>Arama</span>
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Firma, yetkili veya e-posta"
              />
            </label>
            <label>
              <span>Başvuru Durumu</span>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm açık durumlar</option>
                {queueStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label>
              <span>Başvuru Tarihi</span>
              <input type="date" value={applicationDate} onChange={event => setApplicationDate(event.target.value)} />
            </label>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table pending-applications-table">
            <thead>
              <tr>
                <th>Firma Adı</th>
                <th>Yetkili</th>
                <th>E-posta</th>
                <th>Telefon</th>
                <th>Başvuru Tarihi</th>
                <th>Başvuru Durumu</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {visibleApplications.map(application => (
                <tr key={application.id} className={selectedApplication?.id === application.id ? 'selected-row' : ''}>
                  <td><strong>{application.companyName}</strong><span className="muted small-text">{application.city} / {application.district}</span></td>
                  <td>{application.ownerName}</td>
                  <td>{application.email}</td>
                  <td>{application.phone}</td>
                  <td>{formatDateTime(application.createdAt)}</td>
                  <td><span className={`status-pill ${getStatusClassName(application.status)}`}>{application.status}</span></td>
                  <td className="actions-cell">
                    <button className="btn" type="button" onClick={() => inspectApplication(application)}>İncele</button>
                    <button className="btn primary" type="button" onClick={() => approveApplication(application)}>Onayla</button>
                    <button className="btn" type="button" onClick={() => rejectApplication(application)}>Reddet</button>
                    <button className="btn" type="button" onClick={() => addNoteToApplication(application)}>Notlar</button>
                    <button className="btn" type="button" onClick={() => selectApplication(application, 'history')}>Geçmiş</button>
                  </td>
                </tr>
              ))}
              {visibleApplications.length === 0 && (
                <tr>
                  <td className="empty-cell" colSpan={7}>Bekleyen başvuru bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedApplication && (
        <section className="evren360-panel pending-applications-detail">
          <div className="evren360-panel-header">
            <div>
              <h3>{selectedApplication.companyName}</h3>
              <p>{selectedApplication.requestedPackage} paketi için başvuru.</p>
            </div>
            <span className={`status-pill ${getStatusClassName(selectedApplication.status)}`}>{selectedApplication.status}</span>
          </div>

          <div className="pending-applications-tabs">
            <button className={`btn ${detailMode === 'review' ? 'primary' : ''}`} type="button" onClick={() => setDetailMode('review')}>İnceleme</button>
            <button className={`btn ${detailMode === 'notes' ? 'primary' : ''}`} type="button" onClick={() => setDetailMode('notes')}>Notlar</button>
            <button className={`btn ${detailMode === 'history' ? 'primary' : ''}`} type="button" onClick={() => setDetailMode('history')}>Geçmiş</button>
          </div>

          {detailMode === 'review' && (
            <div className="pending-applications-detail-grid">
              <div><span>Firma</span><strong>{selectedApplication.companyName}</strong></div>
              <div><span>Yetkili</span><strong>{selectedApplication.ownerName}</strong></div>
              <div><span>E-posta</span><strong>{selectedApplication.email}</strong></div>
              <div><span>Telefon</span><strong>{selectedApplication.phone}</strong></div>
              <div><span>Vergi Bilgisi</span><strong>{selectedApplication.taxOffice} / {selectedApplication.taxNumber}</strong></div>
              <div><span>Adres</span><strong>{selectedApplication.address}, {selectedApplication.city} / {selectedApplication.district}</strong></div>
            </div>
          )}

          {detailMode === 'notes' && (
            <div className="pending-applications-note-list">
              {selectedNotes.length === 0 && <p className="muted">Not bulunmuyor.</p>}
              {selectedNotes.map(note => (
                <div className="business-application-note" key={note.id}>
                  <strong>{note.createdBy}</strong>
                  <span>{formatDateTime(note.createdAt)}</span>
                  <p>{note.note}</p>
                </div>
              ))}
            </div>
          )}

          {detailMode === 'history' && (
            <div className="business-application-history pending-applications-history">
              <div><span>Oluşturuldu</span><strong>{formatDateTime(selectedApplication.createdAt)}</strong></div>
              <div><span>Son Güncelleme</span><strong>{formatDateTime(selectedApplication.updatedAt)}</strong></div>
              <div><span>Durum</span><strong>{selectedApplication.status}</strong></div>
              <div><span>Bekleme Süresi</span><strong>{formatAverageWaitingTime([selectedApplication])}</strong></div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
