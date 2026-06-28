import React from 'react'
import {
  ANNOUNCEMENT_STATUSES,
  ANNOUNCEMENT_TARGET_TYPES,
  ANNOUNCEMENT_TYPES,
  NOTIFICATION_FOUNDATION_TYPES,
  archiveSystemAnnouncement,
  createSystemAnnouncement,
  loadSystemAnnouncements,
  publishSystemAnnouncement,
  saveSystemAnnouncements,
  updateSystemAnnouncement
} from '../notifications/notification.service'
import {
  AnnouncementStatus,
  AnnouncementTargetType,
  AnnouncementType,
  SystemAnnouncement,
  SystemAnnouncementInput
} from '../notifications/notification.types'
import { loadCompanies, loadCompanyLicenses, loadCompanyUsers, loadLicensePackages, loadUsers } from '../storage'
import { Company, CompanyLicense } from '../types'

type Props = {
  currentUserName: string
}

type FormState = SystemAnnouncementInput & {
  id: string
}

function toDateTimeInputValue(value: string){
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

const addDaysInputValue = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setMinutes(0, 0, 0)
  return toDateTimeInputValue(date.toISOString())
}

const defaultForm = (): FormState => ({
  id: '',
  title: '',
  content: '',
  type: 'Bilgilendirme',
  targetType: 'Tüm Kullanıcılar',
  targetId: '',
  targetLabel: 'Tüm Kullanıcılar',
  startAt: toDateTimeInputValue(new Date().toISOString()),
  endAt: addDaysInputValue(7),
  status: 'Taslak'
})

const fromDateTimeInputValue = (value: string) => {
  if(!value) return new Date().toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

const normalizeLookup = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/Ä±/g, 'i')
  .replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, '')

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const formatDateTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'
  return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
}

const getTypeClassName = (type: AnnouncementType) => {
  if(type === 'Güncelleme') return 'info-pill'
  if(type === 'Bakım' || type === 'Lisans') return 'warning-pill'
  if(type === 'Güvenlik') return 'danger-pill'
  if(type === 'Kampanya') return 'success'
  return 'muted-pill'
}

const getStatusClassName = (status: AnnouncementStatus) => {
  if(status === 'Yayında') return 'success'
  if(status === 'Planlandı') return 'warning-pill'
  if(status === 'Süresi Doldu') return 'danger-pill'
  return 'muted-pill'
}

const getCompanyStatusLabel = (company: Company, licenses: CompanyLicense[]) => {
  if(company.status !== 'Aktif') return company.status
  const activeLicense = licenses.find(license => license.companyId === company.id)
  return activeLicense?.isTrial || activeLicense?.status === 'Deneme' ? 'Deneme' : 'Aktif'
}

export default function SystemAnnouncements({ currentUserName }: Props){
  const context = React.useMemo(() => {
    const companies = loadCompanies().filter(company => company.status !== 'Silindi')
    const packages = loadLicensePackages()
    const appUsers = loadUsers({ allTenants: true })
    const companyUsers = loadCompanyUsers()

    return {
      companies,
      packages,
      targetContext: {
        companies: companies.map(company => ({ id: company.id, label: company.companyName })),
        packages: packages.map(packageItem => ({ id: packageItem.id, label: packageItem.name }))
      },
      licenses: loadCompanyLicenses(),
      userCount: appUsers.length + companyUsers.filter(user => user.status !== 'Silindi').length
    }
  }, [])

  const initialAnnouncements = React.useMemo(() => loadSystemAnnouncements(context.targetContext), [context.targetContext])
  const [announcements, setAnnouncements] = React.useState<SystemAnnouncement[]>(initialAnnouncements)
  const [selectedAnnouncementId, setSelectedAnnouncementId] = React.useState(initialAnnouncements[0]?.id || '')
  const [form, setForm] = React.useState<FormState>(() => defaultForm())
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<AnnouncementType | 'all'>('all')
  const [statusFilter, setStatusFilter] = React.useState<AnnouncementStatus | 'all'>('all')
  const [targetFilter, setTargetFilter] = React.useState<AnnouncementTargetType | 'all'>('all')
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')

  const selectedAnnouncement = announcements.find(announcement => announcement.id === selectedAnnouncementId) || announcements[0]
  const targetOptions = form.targetType === 'Belirli Firma'
    ? context.targetContext.companies
    : form.targetType === 'Belirli Paket'
      ? context.targetContext.packages
      : []

  const visibleAnnouncements = React.useMemo(() => {
    const searchValue = normalizeLookup(search)
    return announcements.filter(announcement => {
      const matchesSearch = !searchValue || [announcement.title, announcement.content]
        .some(value => normalizeLookup(value).includes(searchValue))
      const matchesType = typeFilter === 'all' || announcement.type === typeFilter
      const matchesStatus = statusFilter === 'all' || announcement.status === statusFilter
      const matchesTarget = targetFilter === 'all' || announcement.targetType === targetFilter
      return matchesSearch && matchesType && matchesStatus && matchesTarget
    })
  }, [announcements, search, statusFilter, targetFilter, typeFilter])

  const summary = React.useMemo(() => ({
    total: announcements.length,
    active: announcements.filter(announcement => announcement.status === 'Yayında').length,
    planned: announcements.filter(announcement => announcement.status === 'Planlandı').length,
    draft: announcements.filter(announcement => announcement.status === 'Taslak').length
  }), [announcements])

  const targetPreview = React.useMemo(() => {
    if(form.targetType === 'Tüm Kullanıcılar') return context.userCount
    if(form.targetType === 'Tüm Firmalar') return context.companies.length
    if(form.targetType === 'Aktif Müşteriler') return context.companies.filter(company => getCompanyStatusLabel(company, context.licenses) === 'Aktif').length
    if(form.targetType === 'Deneme Hesapları') return context.companies.filter(company => getCompanyStatusLabel(company, context.licenses) === 'Deneme').length
    return form.targetId ? 1 : 0
  }, [context.companies, context.licenses, context.userCount, form.targetId, form.targetType])

  const persistAnnouncements = (nextAnnouncements: SystemAnnouncement[], selectedId?: string) => {
    const sorted = [...nextAnnouncements].sort((first, second) => second.startAt.localeCompare(first.startAt))
    setAnnouncements(sorted)
    saveSystemAnnouncements(sorted)
    if(selectedId) setSelectedAnnouncementId(selectedId)
  }

  const resetForm = () => {
    setForm(defaultForm())
    setError('')
  }

  const submitAnnouncement = (event: React.FormEvent) => {
    event.preventDefault()
    setMessage('')
    setError('')

    const title = form.title.trim()
    const content = form.content.trim()
    if(!title){
      setError('Başlık zorunludur.')
      return
    }
    if(!content){
      setError('İçerik zorunludur.')
      return
    }
    if((form.targetType === 'Belirli Firma' || form.targetType === 'Belirli Paket') && !form.targetId){
      setError('Seçili hedef zorunludur.')
      return
    }

    const startAt = fromDateTimeInputValue(form.startAt)
    const endAt = fromDateTimeInputValue(form.endAt)
    if(new Date(endAt).getTime() <= new Date(startAt).getTime()){
      setError('Bitiş tarihi başlangıç tarihinden sonra olmalıdır.')
      return
    }

    const input: SystemAnnouncementInput = {
      title,
      content,
      type: form.type,
      targetType: form.targetType,
      targetId: form.targetId,
      startAt,
      endAt,
      status: form.status
    }

    if(form.id){
      const existing = announcements.find(announcement => announcement.id === form.id)
      if(!existing) return
      const updated = updateSystemAnnouncement(existing, input, context.targetContext)
      persistAnnouncements(announcements.map(announcement => announcement.id === updated.id ? updated : announcement), updated.id)
      setMessage('Duyuru güncellendi.')
    } else {
      const created = createSystemAnnouncement(input, currentUserName, context.targetContext)
      persistAnnouncements([created, ...announcements], created.id)
      setMessage('Duyuru oluşturuldu.')
    }

    resetForm()
  }

  const editAnnouncement = (announcement: SystemAnnouncement) => {
    setForm({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      targetType: announcement.targetType,
      targetId: announcement.targetId,
      targetLabel: announcement.targetLabel,
      startAt: toDateTimeInputValue(announcement.startAt),
      endAt: toDateTimeInputValue(announcement.endAt),
      status: announcement.status
    })
    setSelectedAnnouncementId(announcement.id)
    setMessage('')
    setError('')
  }

  const publishAnnouncement = (announcement: SystemAnnouncement) => {
    const published = publishSystemAnnouncement(announcement)
    persistAnnouncements(announcements.map(item => item.id === published.id ? published : item), published.id)
    setMessage('Duyuru yayına alındı.')
    setError('')
  }

  const archiveAnnouncement = (announcement: SystemAnnouncement) => {
    const archived = archiveSystemAnnouncement(announcement)
    persistAnnouncements(announcements.map(item => item.id === archived.id ? archived : item), archived.id)
    setMessage('Duyuru yayından kaldırıldı ve taslak duruma alındı.')
    setError('')
  }

  const markDeletePlaceholder = (announcement: SystemAnnouncement) => {
    setSelectedAnnouncementId(announcement.id)
    setMessage('Silme işlemi sonraki faz için placeholder olarak hazırlandı.')
    setError('')
  }

  const updateTargetType = (targetType: AnnouncementTargetType) => {
    setForm(current => ({
      ...current,
      targetType,
      targetId: '',
      targetLabel: targetType
    }))
  }

  return (
    <div className="system-announcements-page">
      <div className="evren360-hero">
        <div>
          <span>EVREN360</span>
          <h2>Sistem Duyuruları</h2>
          <p>Platform duyurularını hazırlayın, planlayın ve publisher tarafındaki yayın durumunu yönetin.</p>
        </div>
        <div className="evren360-hero-meta">
          <strong>{formatNumber(visibleAnnouncements.length)} kayıt</strong>
          <span>Publisher Foundation</span>
        </div>
      </div>

      {message && <div className="evren360-feedback">{message}</div>}
      {error && <div className="evren360-feedback error">{error}</div>}

      <div className="evren360-kpi-grid">
        <div className="evren360-kpi">
          <span>Toplam Duyuru</span>
          <strong>{formatNumber(summary.total)}</strong>
          <p>Tüm yayın kayıtları.</p>
        </div>
        <div className="evren360-kpi success">
          <span>Aktif Duyuru</span>
          <strong>{formatNumber(summary.active)}</strong>
          <p>Şu anda yayında.</p>
        </div>
        <div className="evren360-kpi warning">
          <span>Planlanan Duyuru</span>
          <strong>{formatNumber(summary.planned)}</strong>
          <p>İleri tarihli yayınlar.</p>
        </div>
        <div className="evren360-kpi muted">
          <span>Taslak Duyuru</span>
          <strong>{formatNumber(summary.draft)}</strong>
          <p>Henüz yayına alınmayanlar.</p>
        </div>
      </div>

      <div className="system-announcements-layout">
        <section className="evren360-panel system-announcements-form-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>{form.id ? 'Duyuru Düzenle' : 'Duyuru Oluştur'}</h3>
              <p>İstemci bildirimi ve dağıtım sistemi sonraki Platform Services fazında bağlanacaktır.</p>
            </div>
            {form.id && <button className="btn" type="button" onClick={resetForm}>Yeni</button>}
          </div>

          <form className="system-announcements-form" onSubmit={submitAnnouncement}>
            <label>
              <span>Başlık</span>
              <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              <span>Duyuru Tipi</span>
              <select value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value as AnnouncementType }))}>
                {ANNOUNCEMENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="system-announcements-wide-field">
              <span>İçerik</span>
              <textarea rows={5} value={form.content} onChange={event => setForm(current => ({ ...current, content: event.target.value }))} />
            </label>
            <label>
              <span>Hedef</span>
              <select value={form.targetType} onChange={event => updateTargetType(event.target.value as AnnouncementTargetType)}>
                {ANNOUNCEMENT_TARGET_TYPES.map(targetType => <option key={targetType} value={targetType}>{targetType}</option>)}
              </select>
            </label>
            {targetOptions.length > 0 && (
              <label>
                <span>Hedef Detayı</span>
                <select value={form.targetId || ''} onChange={event => setForm(current => ({ ...current, targetId: event.target.value }))}>
                  <option value="">Seçiniz</option>
                  {targetOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            )}
            <label>
              <span>Başlangıç Tarihi</span>
              <input type="datetime-local" value={form.startAt} onChange={event => setForm(current => ({ ...current, startAt: event.target.value }))} />
            </label>
            <label>
              <span>Bitiş Tarihi</span>
              <input type="datetime-local" value={form.endAt} onChange={event => setForm(current => ({ ...current, endAt: event.target.value }))} />
            </label>
            <label>
              <span>Durum</span>
              <select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as AnnouncementStatus }))}>
                {ANNOUNCEMENT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <div className="system-announcements-target-preview">
              <span>Hedeflenen kayıt</span>
              <strong>{formatNumber(targetPreview)}</strong>
            </div>
            <div className="system-announcements-form-actions">
              <button className="btn primary" type="submit">{form.id ? 'Güncelle' : 'Oluştur'}</button>
              <button className="btn" type="button" onClick={resetForm}>Temizle</button>
            </div>
          </form>
        </section>

        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Notification Foundation</h3>
              <p>Platform Services altında bağlanacak yayın kanalları.</p>
            </div>
          </div>
          <div className="system-announcements-foundation-grid">
            {NOTIFICATION_FOUNDATION_TYPES.map(type => (
              <div key={type}>
                <strong>{type}</strong>
                <span className="status-pill info-pill">Hazır</span>
              </div>
            ))}
          </div>
          {selectedAnnouncement && (
            <div className="system-announcements-preview">
              <span className={`status-pill ${getTypeClassName(selectedAnnouncement.type)}`}>{selectedAnnouncement.type}</span>
              <h3>{selectedAnnouncement.title}</h3>
              <p>{selectedAnnouncement.content}</p>
              <small>{selectedAnnouncement.targetLabel} · {formatDateTime(selectedAnnouncement.startAt)} - {formatDateTime(selectedAnnouncement.endAt)}</small>
            </div>
          )}
        </section>
      </div>

      <section className="evren360-panel system-announcements-panel">
        <div className="evren360-panel-header">
          <div>
            <h3>Duyuru Listesi</h3>
            <p>Publisher tarafında hazırlanan platform duyuruları.</p>
          </div>
          <div className="system-announcements-controls">
            <label>
              <span>Arama</span>
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Başlık veya içerik" />
            </label>
            <label>
              <span>Tip</span>
              <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as AnnouncementType | 'all')}>
                <option value="all">Tüm tipler</option>
                {ANNOUNCEMENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label>
              <span>Durum</span>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as AnnouncementStatus | 'all')}>
                <option value="all">Tüm durumlar</option>
                {ANNOUNCEMENT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label>
              <span>Hedef</span>
              <select value={targetFilter} onChange={event => setTargetFilter(event.target.value as AnnouncementTargetType | 'all')}>
                <option value="all">Tüm hedefler</option>
                {ANNOUNCEMENT_TARGET_TYPES.map(targetType => <option key={targetType} value={targetType}>{targetType}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table system-announcements-table">
            <thead>
              <tr>
                <th>Başlık</th>
                <th>Tip</th>
                <th>Hedef</th>
                <th>Yayın Tarihi</th>
                <th>Durum</th>
                <th>Oluşturan</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {visibleAnnouncements.map(announcement => (
                <tr key={announcement.id} className={selectedAnnouncement?.id === announcement.id ? 'selected-row' : ''}>
                  <td><strong>{announcement.title}</strong><span className="muted small-text">{announcement.content}</span></td>
                  <td><span className={`status-pill ${getTypeClassName(announcement.type)}`}>{announcement.type}</span></td>
                  <td>{announcement.targetLabel}</td>
                  <td>{formatDateTime(announcement.startAt)}</td>
                  <td><span className={`status-pill ${getStatusClassName(announcement.status)}`}>{announcement.status}</span></td>
                  <td>{announcement.createdBy}</td>
                  <td className="actions-cell">
                    <button className="btn" type="button" onClick={() => setSelectedAnnouncementId(announcement.id)}>Görüntüle</button>
                    <button className="btn" type="button" onClick={() => editAnnouncement(announcement)}>Düzenle</button>
                    <button className="btn" type="button" disabled={announcement.status === 'Yayında'} onClick={() => publishAnnouncement(announcement)}>Yayınla</button>
                    <button className="btn" type="button" disabled={announcement.status === 'Taslak'} onClick={() => archiveAnnouncement(announcement)}>Yayından Kaldır</button>
                    <button className="btn" type="button" onClick={() => markDeletePlaceholder(announcement)}>Sil</button>
                  </td>
                </tr>
              ))}
              {visibleAnnouncements.length === 0 && (
                <tr>
                  <td className="empty-cell" colSpan={7}>Duyuru kaydı bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
