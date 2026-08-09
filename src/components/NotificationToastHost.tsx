import React from 'react'
import {
  NotificationEngineService,
  NOTIFICATION_TYPE_LABELS
} from '../notification-engine/notification-engine.service'
import type { ToastNotification } from '../notification-engine/notification-engine.types'

const getToastClass = (toast: ToastNotification) => (
  `notification-toast ${toast.type.toLocaleLowerCase('tr-TR')}`
)

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
            x
          </button>
        </section>
      ))}
    </div>
  )
}
