import React from 'react'
import {
  NotificationEngineService,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_MODULE_LABELS,
  NOTIFICATION_MODULES,
  NOTIFICATION_STATUS_LABELS,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS
} from '../notification-engine/notification-engine.service'
import type {
  NotificationFilters,
  NotificationRecord,
  NotificationStatus,
  NotificationType
} from '../notification-engine/notification-engine.types'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import { formatNumber } from '../kpi-reporting/kpi.utils'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error' | 'info'
  text: string
}

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const formatDateTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
}

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const getTypeClass = (type: NotificationType) => {
  if(type === 'CRITICAL' || type === 'ERROR') return 'danger-pill'
  if(type === 'WARNING') return 'warning-pill'
  if(type === 'SUCCESS') return 'success'
  return 'muted-pill'
}

const getStatusClass = (status: NotificationStatus) => {
  if(status === 'UNREAD') return 'warning-pill'
  if(status === 'ARCHIVED') return 'muted-pill'
  return 'success'
}

const getNotificationTone = (record: NotificationRecord) => {
  if(record.type === 'CRITICAL' || record.type === 'ERROR') return 'danger'
  if(record.type === 'WARNING') return 'warning'
  if(record.type === 'SUCCESS') return 'success'
  return 'info'
}

export default function NotificationCenter({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [version, setVersion] = React.useState(0)
  const [filters, setFilters] = React.useState<NotificationFilters>(() => NotificationEngineService.createDefaultFilters())
  const [selectedNotificationId, setSelectedNotificationId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const notifications = React.useMemo(() => NotificationEngineService.list(sourceData, userName), [sourceData, userName, version])
  const filteredNotifications = React.useMemo(() => NotificationEngineService.filter(notifications, filters), [filters, notifications])
  const statistics = React.useMemo(() => NotificationEngineService.statistics(notifications), [notifications])
  const logs = React.useMemo(() => NotificationEngineService.history.list().slice(0, 8), [version])
  const selectedNotification = filteredNotifications.find(record => record.id === selectedNotificationId)
    || notifications.find(record => record.id === selectedNotificationId)
    || filteredNotifications[0]
    || notifications[0]
    || null

  React.useEffect(() => {
    if(selectedNotificationId && notifications.some(record => record.id === selectedNotificationId)) return
    setSelectedNotificationId(filteredNotifications[0]?.id || notifications[0]?.id || '')
  }, [filteredNotifications, notifications, selectedNotificationId])

  const refresh = () => setVersion(current => current + 1)

  const updateFilter = <TKey extends keyof NotificationFilters>(key: TKey, value: NotificationFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const runAction = (
    action: () => NotificationRecord | NotificationRecord[],
    successText: string
  ) => {
    try {
      action()
      refresh()
      setMessage({ type: 'success', text: successText })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Bildirim islemi tamamlanamadi.' })
    }
  }

  const markSelectedRead = () => {
    if(!selectedNotification) return
    runAction(
      () => NotificationEngineService.markRead(selectedNotification.id, userName),
      `${selectedNotification.notificationNo} okundu yapildi.`
    )
  }

  const markSelectedUnread = () => {
    if(!selectedNotification) return
    runAction(
      () => NotificationEngineService.markUnread(selectedNotification.id, userName),
      `${selectedNotification.notificationNo} okunmadi yapildi.`
    )
  }

  const archiveSelected = () => {
    if(!selectedNotification) return
    runAction(
      () => NotificationEngineService.archive(selectedNotification.id, userName),
      `${selectedNotification.notificationNo} arsivlendi.`
    )
  }

  const markFilteredRead = () => {
    runAction(
      () => NotificationEngineService.markAllRead(filters, userName),
      `${formatNumber(filteredNotifications.length)} bildirim okundu yapildi.`
    )
  }

  const publishTestToast = () => {
    NotificationEngineService.toast({
      moduleKey: 'production',
      type: 'SUCCESS',
      title: 'Bildirim altyapisi',
      message: 'NotificationEngineService toast bildirimi yayinladi.'
    }, userName)
    refresh()
    setMessage({ type: 'info', text: 'Test toast bildirimi yayinlandi.' })
  }

  return (
    <div className="notification-center-page">
      <div className="page-header">
        <div>
          <h2>Bildirim Merkezi</h2>
          <p className="muted">Sistem bildirimleri, uyari, hatirlatma, kritik alarm ve toast kayitlari tek merkezden izlenir.</p>
        </div>
        <div className="notification-center-header-actions">
          <button className="btn" type="button" onClick={publishTestToast}>Test Toast</button>
          <button className="btn" type="button" onClick={refresh}>Yenile</button>
          <button className="btn primary" type="button" onClick={markFilteredRead} disabled={filteredNotifications.length === 0}>Tumunu Okundu Yap</button>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid notification-center-metric-grid">
        <div className="metric-card">
          <span>Toplam Bildirim</span>
          <strong>{formatNumber(statistics.total)}</strong>
          <small>{formatNumber(filteredNotifications.length)} filtre sonucu</small>
        </div>
        <div className="metric-card warning">
          <span>Okunmadi</span>
          <strong>{formatNumber(statistics.unread)}</strong>
          <small>{formatNumber(statistics.read)} okundu</small>
        </div>
        <div className="metric-card danger">
          <span>Kritik Alarm</span>
          <strong>{formatNumber(statistics.critical)}</strong>
          <small>{formatNumber(statistics.warning)} uyari/error</small>
        </div>
        <div className="metric-card success">
          <span>Bugunku Kayit</span>
          <strong>{formatNumber(statistics.today)}</strong>
          <small>{formatNumber(statistics.archived)} arsiv</small>
        </div>
      </div>

      <section className="card notification-center-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredNotifications.length)} / {formatNumber(notifications.length)} bildirim listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(NotificationEngineService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="notification-center-toolbar">
          <label className="form-field">
            <span>Durum</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as NotificationFilters['status'])}>
              <option value="all">Tum Durumlar</option>
              {Object.entries(NOTIFICATION_STATUS_LABELS).map(([status, label]) => (
                <option key={status} value={status}>{label}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Modul</span>
            <select value={filters.moduleKey} onChange={event => updateFilter('moduleKey', event.target.value as NotificationFilters['moduleKey'])}>
              <option value="all">Tum Moduller</option>
              {NOTIFICATION_MODULES.map(moduleKey => (
                <option key={moduleKey} value={moduleKey}>{NOTIFICATION_MODULE_LABELS[moduleKey]}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Tip</span>
            <select value={filters.type} onChange={event => updateFilter('type', event.target.value as NotificationFilters['type'])}>
              <option value="all">Tum Tipler</option>
              {NOTIFICATION_TYPES.map(type => (
                <option key={type} value={type}>{NOTIFICATION_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Kategori</span>
            <select value={filters.category} onChange={event => updateFilter('category', event.target.value as NotificationFilters['category'])}>
              <option value="all">Tum Kategoriler</option>
              {NOTIFICATION_CATEGORIES.map(category => (
                <option key={category} value={category}>{NOTIFICATION_CATEGORY_LABELS[category]}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field search-field">
            <span>Arama</span>
            <input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Kod, modul, olay veya metin" />
          </label>
        </div>
      </section>

      <div className="notification-center-layout">
        <section className="card notification-center-list-card">
          <div className="section-header compact">
            <div>
              <h3>Bildirimler</h3>
              <p className="muted">Okundu, okunmadi, filtre, arama, kategori ve tarih bilgileriyle listelenir.</p>
            </div>
          </div>
          <div className="notification-center-list">
            {filteredNotifications.map(record => (
              <button
                className={`notification-center-row ${record.status.toLocaleLowerCase('tr-TR')} ${getNotificationTone(record)} ${selectedNotification?.id === record.id ? 'selected' : ''}`}
                key={record.id}
                type="button"
                onClick={() => setSelectedNotificationId(record.id)}
              >
                <span className="notification-center-row-icon" aria-hidden="true">{record.type.slice(0, 1)}</span>
                <span className="notification-center-row-copy">
                  <span className="notification-center-row-meta">
                    <span>{record.notificationNo}</span>
                    <span>{record.moduleLabel}</span>
                    <span>{formatDateTime(record.createdAt)}</span>
                  </span>
                  <strong>{record.title}</strong>
                  <span>{record.message || NOTIFICATION_EVENT_LABELS[record.eventKey]}</span>
                </span>
                <span className="notification-center-row-badges">
                  <span className={`status-pill ${getTypeClass(record.type)}`}>{NOTIFICATION_TYPE_LABELS[record.type]}</span>
                  <span className={`status-pill ${getStatusClass(record.status)}`}>{NOTIFICATION_STATUS_LABELS[record.status]}</span>
                </span>
              </button>
            ))}
            {filteredNotifications.length === 0 && (
              <div className="notification-center-empty">
                <strong>Bildirim bulunamadi</strong>
                <span>Filtreleri degistirerek sistem kayitlarini yeniden listeleyebilirsiniz.</span>
              </div>
            )}
          </div>
        </section>

        <aside className="notification-center-side">
          <section className="card notification-center-detail-card">
            <div className="section-header compact">
              <div>
                <h3>Detay</h3>
                {selectedNotification && <p className="muted">{selectedNotification.notificationNo}</p>}
              </div>
            </div>
            {selectedNotification ? (
              <>
                <div className={`notification-center-detail-hero ${getNotificationTone(selectedNotification)}`}>
                  <span>{NOTIFICATION_CATEGORY_LABELS[selectedNotification.category]}</span>
                  <strong>{selectedNotification.title}</strong>
                  <p>{selectedNotification.message || NOTIFICATION_EVENT_LABELS[selectedNotification.eventKey]}</p>
                </div>
                <div className="notification-center-detail-grid">
                  <span>Modul</span><strong>{selectedNotification.moduleLabel}</strong>
                  <span>Olay</span><strong>{NOTIFICATION_EVENT_LABELS[selectedNotification.eventKey]}</strong>
                  <span>Tip</span><strong>{NOTIFICATION_TYPE_LABELS[selectedNotification.type]}</strong>
                  <span>Durum</span><strong>{NOTIFICATION_STATUS_LABELS[selectedNotification.status]}</strong>
                  <span>Kayit</span><strong>{selectedNotification.entityCode || selectedNotification.entityId || '-'}</strong>
                  <span>Tarih</span><strong>{formatDateTime(selectedNotification.createdAt)}</strong>
                  <span>Termin</span><strong>{formatDate(selectedNotification.dueAt)}</strong>
                  <span>Kullanici</span><strong>{selectedNotification.createdBy}</strong>
                </div>
                <div className="notification-center-detail-actions">
                  <button className="btn" type="button" onClick={markSelectedRead} disabled={selectedNotification.status === 'READ'}>Okundu</button>
                  <button className="btn" type="button" onClick={markSelectedUnread} disabled={selectedNotification.status === 'UNREAD'}>Okunmadi</button>
                  <button className="btn danger" type="button" onClick={archiveSelected} disabled={selectedNotification.status === 'ARCHIVED'}>Arsivle</button>
                </div>
              </>
            ) : (
              <div className="notification-center-empty">
                <strong>Secili bildirim yok</strong>
                <span>Liste uzerinden bir bildirim secin.</span>
              </div>
            )}
          </section>

          <section className="card notification-center-log-card">
            <div className="section-header compact">
              <div>
                <h3>Log</h3>
                <p className="muted">Son bildirim islemleri</p>
              </div>
            </div>
            <div className="notification-center-log-list">
              {logs.map(log => (
                <div className="notification-center-log-row" key={log.id}>
                  <span>{formatDateTime(log.date)}</span>
                  <strong>{log.description || log.action}</strong>
                  <small>{log.userName} / {log.moduleLabel} / {NOTIFICATION_TYPE_LABELS[log.type]}</small>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="notification-center-empty compact">
                  <strong>Log yok</strong>
                  <span>Bildirim islemleri burada listelenecek.</span>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {statistics.modules.length > 0 && (
        <section className="card notification-center-module-card">
          <div className="section-header compact">
            <div>
              <h3>Modul Dagilimi</h3>
              <p className="muted">Desteklenen ERP modullerindeki bildirim yogunlugu.</p>
            </div>
          </div>
          <div className="notification-center-module-grid">
            {statistics.modules.map(item => (
              <div className="notification-center-module-row" key={item.moduleKey}>
                <span>{item.moduleLabel}</span>
                <strong>{formatNumber(item.count)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
