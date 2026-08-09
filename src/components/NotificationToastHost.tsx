import React from 'react'
import { AppIcon } from '../design-system/IconSystem'
import {
  NotificationEngineService,
  NOTIFICATION_TYPE_LABELS
} from '../notification-engine/notification-engine.service'
import type { ToastNotification } from '../notification-engine/notification-engine.types'

const getToastClass = (toast: ToastNotification) => (
  `notification-toast ${toast.type.toLocaleLowerCase('tr-TR')}`
)

const getToastIconName = (toast: ToastNotification) => {
  if(toast.type === 'SUCCESS') return 'success'
  if(toast.type === 'WARNING') return 'warning'
  if(toast.type === 'ERROR') return 'error'
  if(toast.type === 'CRITICAL') return 'critical'
  return 'info'
}

export default function NotificationToastHost(){
  const [toasts, setToasts] = React.useState<ToastNotification[]>([])

  React.useEffect(() => {
    const unsubscribe = NotificationEngineService.subscribeToasts(toast => {
      setToasts(current => [toast, ...current].slice(0, 5))
      window.setTimeout(() => {
        setToasts(current => current.filter(item => item.id !== toast.id))
      }, toast.durationMs)
    })

    return unsubscribe
  }, [])

  if(toasts.length === 0) return null

  return (
    <div className="notification-toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map(toast => (
        <section className={getToastClass(toast)} key={toast.id}>
          <span className="notification-toast-icon" aria-hidden="true">
            <AppIcon name={getToastIconName(toast)} size="SM" />
          </span>
          <div className="notification-toast-copy">
            <span>{NOTIFICATION_TYPE_LABELS[toast.type]} / {toast.moduleLabel}</span>
            <strong>{toast.title}</strong>
            {toast.message && <p>{toast.message}</p>}
          </div>
          <button
            className="notification-toast-close"
            type="button"
            aria-label="Bildirimi kapat"
            onClick={() => setToasts(current => current.filter(item => item.id !== toast.id))}
          >
            <AppIcon name="close" size="SM" />
          </button>
        </section>
      ))}
    </div>
  )
}
