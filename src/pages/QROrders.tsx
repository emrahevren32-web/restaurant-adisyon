import React from 'react'
import { KitchenOrder, Order, Product, ProductCategory, QRRequest, QRRequestItem, TableState, User, WaiterCall } from '../types'
import {
  addActionLog,
  loadCategories,
  loadKitchenOrders,
  loadProducts,
  loadQRRequests,
  loadTables,
  loadWaiterCalls,
  saveKitchenOrders,
  saveQRRequests,
  saveTables,
  saveWaiterCalls
} from '../storage'
import { formatCurrency } from '../billing'

type Props = {
  currentUser: User
}

type Feedback = {
  type: 'success' | 'error'
  text: string
} | null

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return { date: '-', time: '-' }

  return {
    date: date.toLocaleDateString('tr-TR'),
    time: date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }
}

const requestTotal = (request: QRRequest) => {
  return request.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
}

const sortByCreatedAtDesc = <T extends { createdAt: string }>(items: T[]) => {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

const loadSortedQRRequests = () => sortByCreatedAtDesc(loadQRRequests())
const loadSortedWaiterCalls = () => sortByCreatedAtDesc(loadWaiterCalls())

const summarizeItems = (items: QRRequestItem[]) => {
  return items.map(item => `${item.productName} x${item.qty}`).join(', ')
}

const normalizeCategoryName = (value: string) => {
  return value
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr-TR')
}

const shouldSendToKitchen = (product: Product, categories: ProductCategory[]) => {
  const category = categories.find(item => item.id === product.categoryId)
  const categoryName = normalizeCategoryName(category?.name || '')
  return !categoryName.includes('icecek')
}

const findTargetTable = (request: QRRequest, tables: TableState[]) => {
  return tables.find(item => item.id === request.tableId)
}

const mergeRequestItemsIntoOrders = (orders: Order[], items: QRRequestItem[]) => {
  return items.reduce<Order[]>((nextOrders, item) => {
    const existingOrder = nextOrders.find(order => {
      return order.productId === item.productId
        && (order.unitPrice ?? item.unitPrice) === item.unitPrice
        && Boolean(order.isGift) === false
    })

    if(existingOrder){
      return nextOrders.map(order => order.id === existingOrder.id ? { ...order, qty: order.qty + item.qty } : order)
    }

    return [
      ...nextOrders,
      {
        id: createId('ord'),
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        qty: item.qty
      }
    ]
  }, orders.map(order => ({ ...order })))
}

const mergeKitchenItem = (items: QRRequestItem[], nextItem: QRRequestItem) => {
  const existingItem = items.find(item => item.productId === nextItem.productId)

  if(existingItem){
    return items.map(item => item.productId === nextItem.productId ? { ...item, qty: item.qty + nextItem.qty } : item)
  }

  return [...items, { ...nextItem }]
}

const addKitchenOrderForRequest = (
  request: QRRequest,
  table: TableState,
  currentUser: User,
  products: Product[],
  categories: ProductCategory[]
) => {
  const kitchenItems = request.items.reduce<QRRequestItem[]>((items, requestItem) => {
    const product = products.find(item => item.id === requestItem.productId)
    if(!product || !shouldSendToKitchen(product, categories)) return items
    return mergeKitchenItem(items, requestItem)
  }, [])

  if(kitchenItems.length === 0) return 0

  const now = new Date().toISOString()
  const kitchenOrders = loadKitchenOrders()
  const existingOrder = kitchenOrders.find(order =>
    order.tableId === table.id
    && order.waiterId === currentUser.id
    && order.status === 'Yeni Sipariş'
  )

  if(existingOrder){
    const nextOrders = kitchenOrders.map(order => {
      if(order.id !== existingOrder.id) return order

      const mergedItems = kitchenItems.reduce((items, item) => {
        const existingItem = items.find(kitchenItem => kitchenItem.productId === item.productId && !kitchenItem.isGift)
        if(existingItem){
          return items.map(kitchenItem => kitchenItem === existingItem
            ? { ...kitchenItem, qty: kitchenItem.qty + item.qty }
            : kitchenItem
          )
        }

        return [...items, {
          productId: item.productId,
          productName: item.productName,
          qty: item.qty
        }]
      }, order.items)

      return { ...order, items: mergedItems, updatedAt: now }
    })

    saveKitchenOrders(nextOrders)
    return kitchenItems.reduce((sum, item) => sum + item.qty, 0)
  }

  const kitchenOrder: KitchenOrder = {
    id: createId('kitchen'),
    tableId: table.id,
    tableName: table.name,
    waiterId: currentUser.id,
    waiterName: currentUser.fullName || currentUser.username,
    status: 'Yeni Sipariş',
    items: kitchenItems.map(item => ({
      productId: item.productId,
      productName: item.productName,
      qty: item.qty
    })),
    createdAt: now,
    updatedAt: now
  }

  saveKitchenOrders([kitchenOrder, ...kitchenOrders])
  return kitchenItems.reduce((sum, item) => sum + item.qty, 0)
}

export default function QROrders({ currentUser }: Props){
  const [requests, setRequests] = React.useState<QRRequest[]>(() => loadSortedQRRequests())
  const [waiterCalls, setWaiterCalls] = React.useState<WaiterCall[]>(() => loadSortedWaiterCalls())
  const [feedback, setFeedback] = React.useState<Feedback>(null)

  const canProcessRequests = currentUser.role === 'Admin' || currentUser.role === 'Garson'

  const refreshLiveData = React.useCallback(() => {
    setRequests(loadSortedQRRequests())
    setWaiterCalls(loadSortedWaiterCalls())
  }, [])

  React.useEffect(() => {
    refreshLiveData()
    const intervalId = window.setInterval(refreshLiveData, 3000)
    window.addEventListener('storage', refreshLiveData)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('storage', refreshLiveData)
    }
  }, [refreshLiveData])

  const removeRequest = (requestId: string) => {
    const nextRequests = loadQRRequests().filter(request => request.id !== requestId)
    saveQRRequests(nextRequests)
    refreshLiveData()
  }

  const completeWaiterCall = (call: WaiterCall) => {
    if(!canProcessRequests){
      setFeedback({ type: 'error', text: 'Garson çağrısını kapatmak için yetkiniz yok.' })
      return
    }

    const nextCalls = loadWaiterCalls().filter(item => item.id !== call.id)
    saveWaiterCalls(nextCalls)
    refreshLiveData()
    setFeedback({ type: 'success', text: `${call.tableName} garson çağrısı kapatıldı.` })
  }

  const approveRequest = (request: QRRequest) => {
    if(!canProcessRequests){
      setFeedback({ type: 'error', text: 'QR sipariş talebi işlemek için yetkiniz yok.' })
      return
    }

    if(request.items.length === 0){
      setFeedback({ type: 'error', text: 'Bu talepte adisyona eklenecek ürün bulunmuyor.' })
      return
    }

    const tables = loadTables()
    const table = findTargetTable(request, tables)

    if(!table){
      setFeedback({ type: 'error', text: `${request.tableName} için kayıtlı masa ID bulunamadı. Talep kaldırılmadı.` })
      return
    }

    const products = loadProducts()
    const categories = loadCategories()
    const nextTables = tables.map(item => item.id === table.id
      ? {
        ...item,
        open: true,
        orders: mergeRequestItemsIntoOrders(item.orders, request.items)
      }
      : item
    )

    saveTables(nextTables)
    const kitchenItemCount = addKitchenOrderForRequest(request, table, currentUser, products, categories)
    removeRequest(request.id)

    addActionLog({
      operationType: 'QR Siparişi Onaylandı',
      user: currentUser,
      tableId: table.id,
      tableName: table.name,
      description: `${table.name} QR sipariş talebi onaylandı. ${summarizeItems(request.items)} adisyona eklendi.${kitchenItemCount > 0 ? ` ${kitchenItemCount} ürün mutfağa gönderildi.` : ''}`
    })

    setFeedback({ type: 'success', text: `${table.name} QR sipariş talebi onaylandı.` })
  }

  const rejectRequest = (request: QRRequest) => {
    if(!canProcessRequests){
      setFeedback({ type: 'error', text: 'QR sipariş talebi işlemek için yetkiniz yok.' })
      return
    }

    removeRequest(request.id)
    addActionLog({
      operationType: 'QR Siparişi Reddedildi',
      user: currentUser,
      tableId: request.tableId,
      tableName: request.tableName,
      description: `${request.tableName} QR sipariş talebi reddedildi. ${summarizeItems(request.items)}`
    })

    setFeedback({ type: 'success', text: `${request.tableName} QR sipariş talebi reddedildi.` })
  }

  return (
    <div className="qr-orders-page">
      <div className="page-title">
        <div>
          <h2>QR Siparişler</h2>
          <p className="muted">Müşteri QR menüsünden gelen ve henüz garson onayı bekleyen talepler.</p>
        </div>
        <span className="status-pill">{requests.length} talep</span>
      </div>

      {feedback && <div className={`qr-message ${feedback.type}`}>{feedback.text}</div>}

      <section className="card">
        <div className="section-header compact">
          <div>
            <h3>Garson Çağrıları</h3>
            <p className="muted">QR menüden gelen çağrılar canlı yenilenir.</p>
          </div>
          <span className="status-pill">{waiterCalls.length} çağrı</span>
        </div>

        {waiterCalls.length === 0 ? (
          <div className="empty-state">Bekleyen garson çağrısı yok.</div>
        ) : (
          <div className="waiter-call-list">
            {waiterCalls.map(call => {
              const createdAt = formatDateTime(call.createdAt)

              return (
                <article className="waiter-call-card" key={call.id}>
                  <div>
                    <span className="small-text">Garson çağrısı</span>
                    <strong>{call.tableName}</strong>
                    <p className="muted">{createdAt.time} · {createdAt.date}</p>
                  </div>
                  <div className="row-actions">
                    <span className="status-pill">{call.status}</span>
                    <button className="btn primary" onClick={() => completeWaiterCall(call)} type="button">Görüldü</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-header compact">
          <div>
            <h3>Sipariş Talepleri</h3>
            <p className="muted">QR sipariş talepleri canlı yenilenir.</p>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="empty-state">Henüz QR sipariş talebi bulunmuyor.</div>
        ) : (
          <div className="qr-request-list">
            {requests.map(request => {
              const createdAt = formatDateTime(request.createdAt)

              return (
                <article className="qr-request-card" key={request.id}>
                  <div className="qr-request-head">
                    <div>
                      <span className="small-text">Masa adı</span>
                      <h3>{request.tableName}</h3>
                    </div>
                    <span className="status-pill">{request.status}</span>
                  </div>

                  <ul className="kitchen-item-list">
                    {request.items.map(item => (
                      <li key={`${request.id}_${item.productId}`}>
                        <span>{item.productName}</span>
                        <strong>{item.qty} x {formatCurrency(item.unitPrice)}</strong>
                      </li>
                    ))}
                  </ul>

                  <div className="qr-request-meta">
                    <div>
                      <span>Sipariş saati</span>
                      <strong>{createdAt.time}</strong>
                      <small>{createdAt.date}</small>
                    </div>
                    <div>
                      <span>Talep tutarı</span>
                      <strong>{formatCurrency(requestTotal(request))}</strong>
                      <small>Adisyona işlenmedi</small>
                    </div>
                  </div>

                  <div className="qr-request-actions">
                    <button className="btn primary" onClick={() => approveRequest(request)} type="button">Onayla</button>
                    <button className="btn" onClick={() => rejectRequest(request)} type="button">Reddet</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
