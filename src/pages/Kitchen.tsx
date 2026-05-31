import React from 'react'
import { KitchenOrder, KitchenOrderStatus, User } from '../types'
import { addActionLog, loadKitchenOrders, saveKitchenOrders } from '../storage'

type Props = { currentUser: User }
type KitchenFilter = 'all' | KitchenOrderStatus

const filters: { value: KitchenFilter; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'Yeni Sipariş', label: 'Yeni Sipariş' },
  { value: 'Hazırlanıyor', label: 'Hazırlanıyor' },
  { value: 'Hazır', label: 'Hazır' }
]

const getStatusClass = (status: KitchenOrderStatus) => {
  if(status === 'Hazır') return 'ready'
  if(status === 'Hazırlanıyor') return 'preparing'
  return 'new'
}

const formatTime = (value: string) => {
  return new Date(value).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const canMoveToStatus = (current: KitchenOrderStatus, next: KitchenOrderStatus) => {
  if(current === 'Yeni Sipariş' && next === 'Hazırlanıyor') return true
  if(current === 'Hazırlanıyor' && next === 'Hazır') return true
  return false
}

export default function Kitchen({ currentUser }: Props){
  const [orders, setOrders] = React.useState<KitchenOrder[]>(() => loadKitchenOrders())
  const [filter, setFilter] = React.useState<KitchenFilter>('all')

  const filteredOrders = React.useMemo(() => {
    return orders
      .filter(order => filter === 'all' || order.status === filter)
      .sort((a, b) => {
        const statusOrder: Record<KitchenOrderStatus, number> = {
          'Yeni Sipariş': 0,
          'Hazırlanıyor': 1,
          'Hazır': 2
        }

        if(statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status]
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [filter, orders])

  const updateStatus = (order: KitchenOrder, nextStatus: KitchenOrderStatus) => {
    if(!canMoveToStatus(order.status, nextStatus)) return

    const now = new Date().toISOString()
    const nextOrders = orders.map(item => item.id === order.id ? { ...item, status: nextStatus, updatedAt: now } : item)

    setOrders(nextOrders)
    saveKitchenOrders(nextOrders)
    addActionLog({
      operationType: nextStatus === 'Hazırlanıyor' ? 'Sipariş Hazırlanıyor' : 'Sipariş Hazır',
      user: currentUser,
      tableId: order.tableId,
      tableName: order.tableName,
      description: `${order.tableName} siparişi ${nextStatus} durumuna alındı.`
    })
  }

  return (
    <div className="kitchen-page">
      <div className="page-title">
        <div>
          <h2>Mutfak Ekranı</h2>
          <p className="muted">İçecek dışındaki siparişleri mutfak durumuna göre takip edin.</p>
        </div>
        <div className="kitchen-filters">
          {filters.map(item => (
            <button
              className={`btn ${filter === item.value ? 'primary' : ''}`}
              key={item.value}
              onClick={()=>setFilter(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="kitchen-grid">
        {filteredOrders.length === 0 && <div className="card empty-state">Filtreye uygun mutfak siparişi bulunmuyor.</div>}
        {filteredOrders.map(order => (
          <section className={`kitchen-card ${getStatusClass(order.status)}`} key={order.id}>
            <div className="section-header compact">
              <div>
                <h3>{order.tableName}</h3>
                <p className="muted small-text">Sipariş Saati: {formatTime(order.createdAt)}</p>
              </div>
              <span className={`kitchen-status ${getStatusClass(order.status)}`}>{order.status}</span>
            </div>

            <ul className="kitchen-item-list">
              {order.items.map(item => (
                <li key={`${order.id}_${item.productId}_${item.isGift ? 'gift' : 'sale'}`}>
                  <span>{item.productName}</span>
                  <strong>x{item.qty}</strong>
                  {item.isGift && <small>İkram</small>}
                </li>
              ))}
            </ul>

            <div className="kitchen-meta">
              <span>Garson</span>
              <strong>{order.waiterName}</strong>
            </div>

            <div className="form-actions">
              <button
                className="btn"
                type="button"
                disabled={!canMoveToStatus(order.status, 'Hazırlanıyor')}
                onClick={()=>updateStatus(order, 'Hazırlanıyor')}
              >
                Hazırlanıyor
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={!canMoveToStatus(order.status, 'Hazır')}
                onClick={()=>updateStatus(order, 'Hazır')}
              >
                Hazır
              </button>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
