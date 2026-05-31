import React from 'react'
import { KitchenOrder, KitchenOrderItem, KitchenOrderStatus, User } from '../types'
import { addActionLog, loadKitchenOrders, saveKitchenOrders } from '../storage'

type Props = { currentUser: User }
type KitchenFilter = 'all' | KitchenOrderStatus
type KitchenViewMode = 'order' | 'table'

type KitchenTableGroup = {
  tableId: string
  tableName: string
  waiterNames: string[]
  statuses: KitchenOrderStatus[]
  items: KitchenOrderItem[]
  orders: KitchenOrder[]
  createdAt: string
}

const VIEW_MODE_KEY = 'ra_kitchen_view_mode'

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

const loadViewMode = (): KitchenViewMode => {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'table' ? 'table' : 'order'
  } catch {
    return 'order'
  }
}

const saveViewMode = (mode: KitchenViewMode) => {
  localStorage.setItem(VIEW_MODE_KEY, mode)
}

const getStatusPriority = (status: KitchenOrderStatus) => {
  if(status === 'Hazır') return 2
  if(status === 'Hazırlanıyor') return 1
  return 0
}

const getGroupStatus = (statuses: KitchenOrderStatus[]) => {
  return statuses.reduce<KitchenOrderStatus>((lowest, status) => {
    return getStatusPriority(status) < getStatusPriority(lowest) ? status : lowest
  }, 'Hazır')
}

const mergeKitchenItems = (orders: KitchenOrder[]) => {
  const items = new Map<string, KitchenOrderItem>()

  orders.forEach(order => {
    order.items.forEach(item => {
      const key = `${item.productId}_${item.isGift ? 'gift' : 'sale'}`
      const existing = items.get(key)

      if(existing){
        items.set(key, { ...existing, qty: existing.qty + item.qty })
        return
      }

      items.set(key, { ...item })
    })
  })

  return Array.from(items.values())
}

const groupOrdersByTable = (orders: KitchenOrder[]): KitchenTableGroup[] => {
  const groups = new Map<string, KitchenOrder[]>()

  orders.forEach(order => {
    groups.set(order.tableId, [...(groups.get(order.tableId) || []), order])
  })

  return Array.from(groups.entries()).map(([tableId, tableOrders]) => {
    const sortedOrders = [...tableOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const waiterNames = Array.from(new Set(sortedOrders.map(order => order.waiterName)))
    const statuses = Array.from(new Set(sortedOrders.map(order => order.status)))

    return {
      tableId,
      tableName: sortedOrders[0]?.tableName || 'Masa',
      waiterNames,
      statuses,
      items: mergeKitchenItems(sortedOrders),
      orders: sortedOrders,
      createdAt: sortedOrders[0]?.createdAt || new Date().toISOString()
    }
  }).sort((a, b) => {
    const statusDiff = getStatusPriority(getGroupStatus(a.statuses)) - getStatusPriority(getGroupStatus(b.statuses))
    if(statusDiff !== 0) return statusDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export default function Kitchen({ currentUser }: Props){
  const [orders, setOrders] = React.useState<KitchenOrder[]>(() => loadKitchenOrders())
  const [filter, setFilter] = React.useState<KitchenFilter>('all')
  const [viewMode, setViewMode] = React.useState<KitchenViewMode>(() => loadViewMode())

  React.useEffect(() => {
    saveViewMode(viewMode)
  }, [viewMode])

  const filteredOrders = React.useMemo(() => {
    return orders
      .filter(order => filter === 'all' || order.status === filter)
      .sort((a, b) => {
        if(getStatusPriority(a.status) !== getStatusPriority(b.status)) return getStatusPriority(a.status) - getStatusPriority(b.status)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [filter, orders])

  const tableGroups = React.useMemo(() => groupOrdersByTable(filteredOrders), [filteredOrders])

  const updateOrdersStatus = (targetOrders: KitchenOrder[], nextStatus: KitchenOrderStatus) => {
    const movableOrders = targetOrders.filter(order => canMoveToStatus(order.status, nextStatus))
    if(movableOrders.length === 0) return

    const movableIds = new Set(movableOrders.map(order => order.id))
    const now = new Date().toISOString()
    const nextOrders = orders.map(item => movableIds.has(item.id) ? { ...item, status: nextStatus, updatedAt: now } : item)

    setOrders(nextOrders)
    saveKitchenOrders(nextOrders)

    movableOrders.forEach(order => {
      addActionLog({
        operationType: nextStatus === 'Hazırlanıyor' ? 'Sipariş Hazırlanıyor' : 'Sipariş Hazır',
        user: currentUser,
        tableId: order.tableId,
        tableName: order.tableName,
        description: `${order.tableName} siparişi ${nextStatus} durumuna alındı.`
      })
    })
  }

  const updateStatus = (order: KitchenOrder, nextStatus: KitchenOrderStatus) => {
    updateOrdersStatus([order], nextStatus)
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

      <div className="kitchen-view-switch">
        <button
          className={`btn ${viewMode === 'order' ? 'primary' : ''}`}
          onClick={()=>setViewMode('order')}
          type="button"
        >
          Sipariş Bazlı
        </button>
        <button
          className={`btn ${viewMode === 'table' ? 'primary' : ''}`}
          onClick={()=>setViewMode('table')}
          type="button"
        >
          Masa Bazlı
        </button>
      </div>

      <div className="kitchen-grid">
        {viewMode === 'order' ? (
          <>
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
          </>
        ) : (
          <>
            {tableGroups.length === 0 && <div className="card empty-state">Filtreye uygun mutfak siparişi bulunmuyor.</div>}
            {tableGroups.map(group => {
              const groupStatus = getGroupStatus(group.statuses)

              return (
                <section className={`kitchen-card ${getStatusClass(groupStatus)}`} key={group.tableId}>
                  <div className="section-header compact">
                    <div>
                      <h3>{group.tableName}</h3>
                      <p className="muted small-text">İlk Sipariş Saati: {formatTime(group.createdAt)}</p>
                    </div>
                    <span className={`kitchen-status ${getStatusClass(groupStatus)}`}>{groupStatus}</span>
                  </div>

                  <ul className="kitchen-item-list">
                    {group.items.map(item => (
                      <li key={`${group.tableId}_${item.productId}_${item.isGift ? 'gift' : 'sale'}`}>
                        <span>{item.productName}</span>
                        <strong>x{item.qty}</strong>
                        {item.isGift && <small>İkram</small>}
                      </li>
                    ))}
                  </ul>

                  <div className="kitchen-meta">
                    <span>Garson</span>
                    <strong>{group.waiterNames.join(', ')}</strong>
                  </div>
                  <div className="kitchen-meta">
                    <span>Sipariş Sayısı</span>
                    <strong>{group.orders.length}</strong>
                  </div>

                  <div className="form-actions">
                    <button
                      className="btn"
                      type="button"
                      disabled={!group.orders.some(order => canMoveToStatus(order.status, 'Hazırlanıyor'))}
                      onClick={()=>updateOrdersStatus(group.orders, 'Hazırlanıyor')}
                    >
                      Hazırlanıyor
                    </button>
                    <button
                      className="btn primary"
                      type="button"
                      disabled={!group.orders.some(order => canMoveToStatus(order.status, 'Hazır'))}
                      onClick={()=>updateOrdersStatus(group.orders, 'Hazır')}
                    >
                      Hazır
                    </button>
                  </div>
                </section>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
