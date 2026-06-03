import React from 'react'
import {
  KitchenOrder,
  Order,
  Product,
  ProductCategory,
  QRAuditEvent,
  QRRejectReason,
  QRRequest,
  QRRequestItem,
  TableState,
  User,
  WaiterCall
} from '../types'
import {
  addActionLog,
  addQRAuditEvent,
  addQRRequestHistory,
  addWaiterCallHistory,
  loadCategories,
  loadKitchenOrders,
  loadProducts,
  loadQRAuditEvents,
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

const rejectReasons: QRRejectReason[] = ['Ürün mevcut değil', 'Mutfak kapalı', 'Müşteri iptali', 'Hatalı masa', 'Stok yetersiz', 'Diğer']

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const getUserName = (user: User) => user.fullName || user.username

const formatDateTime = (value: string | undefined) => {
  const date = value ? new Date(value) : null
  if(!date || Number.isNaN(date.getTime())) return { date: '-', time: '-' }

  return {
    date: date.toLocaleDateString('tr-TR'),
    time: date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }
}

const formatDuration = (start: string, end = new Date().toISOString()) => {
  const startDate = new Date(start)
  const endDate = new Date(end)
  if(Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '-'

  const totalMinutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000))
  if(totalMinutes < 60) return `${totalMinutes} dk`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours} sa ${minutes} dk`
}

const requestTotal = (request: Pick<QRRequest, 'items'>) => {
  return request.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
}

const sortByCreatedAtDesc = <T extends { createdAt: string }>(items: T[]) => {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

const sortAuditDesc = (items: QRAuditEvent[]) => {
  return [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

const loadSortedQRRequests = () => sortByCreatedAtDesc(loadQRRequests().filter(request => request.status === 'Garson Onayı Bekliyor'))
const loadSortedWaiterCalls = () => sortByCreatedAtDesc(loadWaiterCalls().filter(call => call.status !== 'Kapatıldı'))
const loadSortedAuditEvents = () => sortAuditDesc(loadQRAuditEvents())

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
    waiterName: getUserName(currentUser),
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

const mergeTableNoteWithQRNotes = (note: string | undefined, request: QRRequest) => {
  const qrNotes = []
  if(request.customerNote?.trim()) qrNotes.push(`Müşteri notu: ${request.customerNote.trim()}`)
  if(request.staffNote?.trim()) qrNotes.push(`Personel notu: ${request.staffNote.trim()}`)

  if(qrNotes.length === 0) return note

  return [note?.trim(), `[QR ${request.id.slice(-6)}] ${qrNotes.join(' | ')}`].filter(Boolean).join('\n')
}

const getEventLabel = (event: QRAuditEvent) => {
  if(event.eventType === 'created') return 'Oluşturuldu'
  if(event.eventType === 'edited') return 'Düzenlendi'
  if(event.eventType === 'approved') return 'Onaylandı'
  if(event.eventType === 'rejected') return 'Reddedildi'
  if(event.eventType === 'assigned') return 'Sahiplenildi'
  if(event.eventType === 'visited') return 'Masaya Gidildi'
  if(event.eventType === 'closed') return 'Kapatıldı'
  return 'Not Güncellendi'
}

const getComparisonRows = (originalItems: QRRequestItem[], currentItems: QRRequestItem[]) => {
  const rows = new Map<string, { productName: string; originalQty: number; currentQty: number; unitPrice: number }>()

  originalItems.forEach(item => {
    rows.set(item.productId, {
      productName: item.productName,
      originalQty: item.qty,
      currentQty: 0,
      unitPrice: item.unitPrice
    })
  })

  currentItems.forEach(item => {
    const existing = rows.get(item.productId)
    rows.set(item.productId, {
      productName: item.productName,
      originalQty: existing?.originalQty || 0,
      currentQty: item.qty,
      unitPrice: item.unitPrice
    })
  })

  return Array.from(rows.values())
}

export default function QROrders({ currentUser }: Props){
  const [requests, setRequests] = React.useState<QRRequest[]>(() => loadSortedQRRequests())
  const [waiterCalls, setWaiterCalls] = React.useState<WaiterCall[]>(() => loadSortedWaiterCalls())
  const [auditEvents, setAuditEvents] = React.useState<QRAuditEvent[]>(() => loadSortedAuditEvents())
  const [products, setProducts] = React.useState<Product[]>(() => loadProducts())
  const [categories, setCategories] = React.useState<ProductCategory[]>(() => loadCategories())
  const [feedback, setFeedback] = React.useState<Feedback>(null)
  const [editingRequestId, setEditingRequestId] = React.useState('')
  const [editItems, setEditItems] = React.useState<QRRequestItem[]>([])
  const [editStaffNote, setEditStaffNote] = React.useState('')
  const [editProductId, setEditProductId] = React.useState('')
  const [editProductQty, setEditProductQty] = React.useState('1')
  const [rejectingRequestId, setRejectingRequestId] = React.useState('')
  const [rejectReason, setRejectReason] = React.useState<QRRejectReason>('Ürün mevcut değil')
  const [rejectNote, setRejectNote] = React.useState('')
  const [closingCallId, setClosingCallId] = React.useState('')
  const [closeNote, setCloseNote] = React.useState('')

  const canProcessRequests = currentUser.role === 'Admin' || currentUser.role === 'Garson'
  const activeProducts = React.useMemo(() => products.filter(product => product.active), [products])

  const refreshLiveData = React.useCallback(() => {
    setRequests(loadSortedQRRequests())
    setWaiterCalls(loadSortedWaiterCalls())
    setAuditEvents(loadSortedAuditEvents())
    setProducts(loadProducts())
    setCategories(loadCategories())
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

  React.useEffect(() => {
    if(activeProducts.length === 0){
      setEditProductId('')
      return
    }

    if(!activeProducts.find(product => product.id === editProductId)){
      setEditProductId(activeProducts[0].id)
    }
  }, [activeProducts, editProductId])

  const getRequestEvents = (requestId: string) => {
    return auditEvents.filter(event => event.entityType === 'QRRequest' && event.entityId === requestId)
  }

  const removeRequest = (requestId: string) => {
    const nextRequests = loadQRRequests().filter(request => request.id !== requestId)
    saveQRRequests(nextRequests)
    refreshLiveData()
  }

  const startEditRequest = (request: QRRequest) => {
    if(!canProcessRequests) return
    setEditingRequestId(request.id)
    setEditItems(request.items.map(item => ({ ...item })))
    setEditStaffNote(request.staffNote || '')
    setRejectingRequestId('')
    setRejectNote('')
    setFeedback(null)
  }

  const cancelEditRequest = () => {
    setEditingRequestId('')
    setEditItems([])
    setEditStaffNote('')
  }

  const updateEditItemQty = (productId: string, qty: number) => {
    setEditItems(prev => {
      if(qty <= 0) return prev.filter(item => item.productId !== productId)
      return prev.map(item => item.productId === productId ? { ...item, qty } : item)
    })
  }

  const addProductToEdit = () => {
    const product = activeProducts.find(item => item.id === editProductId)
    const qty = Math.max(1, Math.floor(Number(editProductQty) || 1))
    if(!product) return

    setEditItems(prev => {
      const existing = prev.find(item => item.productId === product.id)

      if(existing){
        return prev.map(item => item.productId === product.id ? { ...item, qty: item.qty + qty } : item)
      }

      return [...prev, {
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        qty
      }]
    })
    setEditProductQty('1')
  }

  const saveRequestEdits = (request: QRRequest) => {
    if(!canProcessRequests){
      setFeedback({ type: 'error', text: 'QR sipariş talebi düzenlemek için yetkiniz yok.' })
      return
    }

    if(editItems.length === 0){
      setFeedback({ type: 'error', text: 'Düzenlenen siparişte en az bir ürün olmalıdır.' })
      return
    }

    const storedRequest = loadQRRequests().find(item => item.id === request.id)
    if(!storedRequest){
      setFeedback({ type: 'error', text: 'QR sipariş talebi bulunamadı.' })
      return
    }

    const now = new Date().toISOString()
    const before = storedRequest
    const after: QRRequest = {
      ...storedRequest,
      items: editItems,
      staffNote: editStaffNote.trim(),
      updatedAt: now,
      updatedByUserId: currentUser.id,
      updatedByFullName: getUserName(currentUser),
      editCount: (storedRequest.editCount || 0) + 1
    }
    const noteChanged = (storedRequest.staffNote || '') !== after.staffNote

    saveQRRequests(loadQRRequests().map(item => item.id === request.id ? after : item))
    addQRAuditEvent({
      entityType: 'QRRequest',
      entityId: request.id,
      eventType: 'edited',
      user: currentUser,
      tableId: request.tableId,
      tableName: request.tableName,
      before,
      after,
      note: `${getUserName(currentUser)} QR siparişini düzenledi.`
    })
    addActionLog({
      operationType: 'QR Siparişi Düzenlendi',
      user: currentUser,
      tableId: request.tableId,
      tableName: request.tableName,
      description: `${getUserName(currentUser)} ${request.tableName} QR siparişini düzenledi. Güncel sipariş: ${summarizeItems(editItems)}.`
    })

    if(noteChanged){
      addQRAuditEvent({
        entityType: 'QRRequest',
        entityId: request.id,
        eventType: 'note_updated',
        user: currentUser,
        tableId: request.tableId,
        tableName: request.tableName,
        before: { staffNote: storedRequest.staffNote || '' },
        after: { staffNote: after.staffNote || '' },
        note: `${getUserName(currentUser)} personel notunu güncelledi.`
      })
      addActionLog({
        operationType: 'QR Sipariş Notu Güncellendi',
        user: currentUser,
        tableId: request.tableId,
        tableName: request.tableName,
        description: `${getUserName(currentUser)} ${request.tableName} QR sipariş personel notunu güncelledi.`
      })
    }

    cancelEditRequest()
    refreshLiveData()
    setFeedback({ type: 'success', text: `${request.tableName} QR siparişi güncellendi.` })
  }

  const startRejectRequest = (request: QRRequest) => {
    if(!canProcessRequests) return
    setRejectingRequestId(request.id)
    setRejectReason('Ürün mevcut değil')
    setRejectNote('')
    cancelEditRequest()
    setFeedback(null)
  }

  const rejectRequest = (request: QRRequest) => {
    if(!canProcessRequests){
      setFeedback({ type: 'error', text: 'QR sipariş talebi işlemek için yetkiniz yok.' })
      return
    }

    if(rejectReason === 'Diğer' && !rejectNote.trim()){
      setFeedback({ type: 'error', text: 'Diğer red nedeni için açıklama girin.' })
      return
    }

    const storedRequest = loadQRRequests().find(item => item.id === request.id)
    if(!storedRequest){
      setFeedback({ type: 'error', text: 'QR sipariş talebi bulunamadı.' })
      return
    }

    const now = new Date().toISOString()
    const rejectedRequest = {
      ...storedRequest,
      status: 'Reddedildi' as const,
      rejectedAt: now,
      rejectedByUserId: currentUser.id,
      rejectedByFullName: getUserName(currentUser),
      rejectReason,
      rejectNote: rejectNote.trim(),
      archivedAt: now
    }

    addQRRequestHistory(rejectedRequest)
    removeRequest(request.id)
    addQRAuditEvent({
      entityType: 'QRRequest',
      entityId: request.id,
      eventType: 'rejected',
      user: currentUser,
      tableId: request.tableId,
      tableName: request.tableName,
      before: storedRequest,
      after: rejectedRequest,
      note: `${getUserName(currentUser)} reddetti. Neden: ${rejectReason}${rejectNote.trim() ? ` - ${rejectNote.trim()}` : ''}`
    })
    addActionLog({
      operationType: 'QR Siparişi Reddedildi',
      user: currentUser,
      tableId: request.tableId,
      tableName: request.tableName,
      description: `${getUserName(currentUser)} ${request.tableName} QR sipariş talebini reddetti. Neden: ${rejectReason}${rejectNote.trim() ? ` - ${rejectNote.trim()}` : ''}. Sipariş: ${summarizeItems(storedRequest.items)}`
    })

    setRejectingRequestId('')
    setRejectNote('')
    refreshLiveData()
    setFeedback({ type: 'success', text: `${request.tableName} QR sipariş talebi reddedildi.` })
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

    const now = new Date().toISOString()
    const approvedRequest = {
      ...request,
      status: 'Onaylandı' as const,
      approvedAt: now,
      approvedByUserId: currentUser.id,
      approvedByFullName: getUserName(currentUser),
      archivedAt: now
    }
    const nextTables = tables.map(item => item.id === table.id
      ? {
        ...item,
        open: true,
        orders: mergeRequestItemsIntoOrders(item.orders, request.items),
        note: mergeTableNoteWithQRNotes(item.note, request)
      }
      : item
    )

    saveTables(nextTables)
    const kitchenItemCount = addKitchenOrderForRequest(request, table, currentUser, products, categories)
    addQRRequestHistory(approvedRequest)
    removeRequest(request.id)

    addQRAuditEvent({
      entityType: 'QRRequest',
      entityId: request.id,
      eventType: 'approved',
      user: currentUser,
      tableId: table.id,
      tableName: table.name,
      before: request,
      after: approvedRequest,
      note: `${getUserName(currentUser)} QR siparişini onayladı.`
    })
    addActionLog({
      operationType: 'QR Siparişi Onaylandı',
      user: currentUser,
      tableId: table.id,
      tableName: table.name,
      description: `${getUserName(currentUser)} ${table.name} QR sipariş talebini onayladı. ${summarizeItems(request.items)} adisyona eklendi.${kitchenItemCount > 0 ? ` ${kitchenItemCount} ürün mutfağa gönderildi.` : ''}${request.customerNote?.trim() ? ` Müşteri notu: ${request.customerNote.trim()}.` : ''}${request.staffNote?.trim() ? ` Personel notu: ${request.staffNote.trim()}.` : ''}`
    })

    setFeedback({ type: 'success', text: `${table.name} QR sipariş talebi onaylandı.` })
    refreshLiveData()
  }

  const updateWaiterCall = (call: WaiterCall, nextCall: WaiterCall, eventType: 'assigned' | 'visited') => {
    saveWaiterCalls(loadWaiterCalls().map(item => item.id === call.id ? nextCall : item))
    addQRAuditEvent({
      entityType: 'WaiterCall',
      entityId: call.id,
      eventType,
      user: currentUser,
      tableId: call.tableId,
      tableName: call.tableName,
      before: call,
      after: nextCall,
      note: `${getUserName(currentUser)} ${call.tableName} garson çağrısını ${eventType === 'assigned' ? 'sahiplendi' : 'masaya gidildi olarak işaretledi'}.`
    })
    refreshLiveData()
  }

  const claimWaiterCall = (call: WaiterCall) => {
    if(!canProcessRequests){
      setFeedback({ type: 'error', text: 'Garson çağrısını sahiplenmek için yetkiniz yok.' })
      return
    }

    const now = new Date().toISOString()
    const nextCall: WaiterCall = {
      ...call,
      status: 'Sahiplenildi',
      assignedAt: call.assignedAt || now,
      assignedByUserId: call.assignedByUserId || currentUser.id,
      assignedByFullName: call.assignedByFullName || getUserName(currentUser),
      updatedAt: now
    }

    updateWaiterCall(call, nextCall, 'assigned')
    addActionLog({
      operationType: 'Garson Çağrısı Sahiplenildi',
      user: currentUser,
      tableId: call.tableId,
      tableName: call.tableName,
      description: `${getUserName(currentUser)} ${call.tableName} garson çağrısını sahiplendi.`
    })
    setFeedback({ type: 'success', text: `${call.tableName} garson çağrısı sahiplenildi.` })
  }

  const markWaiterCallVisited = (call: WaiterCall) => {
    if(!canProcessRequests){
      setFeedback({ type: 'error', text: 'Garson çağrısını güncellemek için yetkiniz yok.' })
      return
    }

    const now = new Date().toISOString()
    const nextCall: WaiterCall = {
      ...call,
      status: 'Masaya Gidildi',
      assignedAt: call.assignedAt || now,
      assignedByUserId: call.assignedByUserId || currentUser.id,
      assignedByFullName: call.assignedByFullName || getUserName(currentUser),
      visitedAt: now,
      visitedByUserId: currentUser.id,
      visitedByFullName: getUserName(currentUser),
      updatedAt: now
    }

    updateWaiterCall(call, nextCall, 'visited')
    addActionLog({
      operationType: 'Garson Çağrısı Masaya Gidildi',
      user: currentUser,
      tableId: call.tableId,
      tableName: call.tableName,
      description: `${getUserName(currentUser)} ${call.tableName} garson çağrısını Masaya Gidildi durumuna aldı.`
    })
    setFeedback({ type: 'success', text: `${call.tableName} çağrısı Masaya Gidildi olarak işaretlendi.` })
  }

  const closeWaiterCall = (call: WaiterCall) => {
    if(!canProcessRequests){
      setFeedback({ type: 'error', text: 'Garson çağrısını kapatmak için yetkiniz yok.' })
      return
    }

    const storedCall = loadWaiterCalls().find(item => item.id === call.id)
    if(!storedCall){
      setFeedback({ type: 'error', text: 'Garson çağrısı bulunamadı.' })
      return
    }

    const now = new Date().toISOString()
    const closedCall = {
      ...storedCall,
      status: 'Kapatıldı' as const,
      closedAt: now,
      closedByUserId: currentUser.id,
      closedByFullName: getUserName(currentUser),
      closeNote: closeNote.trim(),
      updatedAt: now,
      archivedAt: now
    }

    addWaiterCallHistory(closedCall)
    saveWaiterCalls(loadWaiterCalls().filter(item => item.id !== call.id))
    addQRAuditEvent({
      entityType: 'WaiterCall',
      entityId: call.id,
      eventType: 'closed',
      user: currentUser,
      tableId: call.tableId,
      tableName: call.tableName,
      before: storedCall,
      after: closedCall,
      note: `${getUserName(currentUser)} çağrıyı kapattı. Süre: ${formatDuration(storedCall.createdAt, now)}${closeNote.trim() ? ` - ${closeNote.trim()}` : ''}`
    })
    addActionLog({
      operationType: 'Garson Çağrısı Kapatıldı',
      user: currentUser,
      tableId: call.tableId,
      tableName: call.tableName,
      description: `${getUserName(currentUser)} ${call.tableName} garson çağrısını kapattı. Süre: ${formatDuration(storedCall.createdAt, now)}${closeNote.trim() ? ` Not: ${closeNote.trim()}` : ''}.`
    })

    setClosingCallId('')
    setCloseNote('')
    refreshLiveData()
    setFeedback({ type: 'success', text: `${call.tableName} garson çağrısı kapatıldı.` })
  }

  const renderAuditList = (events: QRAuditEvent[]) => (
    <details className="qr-audit-details">
      <summary>Değişiklik geçmişi ({events.length})</summary>
      {events.length === 0 ? (
        <p className="muted small-text">Bu kayıt için henüz audit kaydı yok.</p>
      ) : (
        <ul className="qr-audit-list">
          {events.map(event => {
            const timestamp = formatDateTime(event.timestamp)
            return (
              <li key={event.id}>
                <strong>{getEventLabel(event)}</strong>
                <span>{event.userName} · {timestamp.time} · {timestamp.date}</span>
                {event.note && <small>{event.note}</small>}
              </li>
            )
          })}
        </ul>
      )}
    </details>
  )

  return (
    <div className="qr-orders-page">
      <div className="page-title">
        <div>
          <h2>QR Siparişler</h2>
          <p className="muted">Müşteri QR menüsünden gelen talepleri düzenleyin, onaylayın, reddedin ve çağrı denetimini takip edin.</p>
        </div>
        <span className="status-pill">{requests.length} talep</span>
      </div>

      {feedback && <div className={`qr-message ${feedback.type}`}>{feedback.text}</div>}

      <section className="card">
        <div className="section-header compact">
          <div>
            <h3>Garson Çağrıları</h3>
            <p className="muted">Çağrılar sahiplenme, masaya gidildi ve kapatma adımlarıyla denetlenir.</p>
          </div>
          <span className="status-pill">{waiterCalls.length} aktif çağrı</span>
        </div>

        {waiterCalls.length === 0 ? (
          <div className="empty-state">Bekleyen garson çağrısı yok.</div>
        ) : (
          <div className="waiter-call-list">
            {waiterCalls.map(call => {
              const createdAt = formatDateTime(call.createdAt)
              const assignedAt = formatDateTime(call.assignedAt)
              const visitedAt = formatDateTime(call.visitedAt)

              return (
                <article className="waiter-call-card" key={call.id}>
                  <div>
                    <span className="small-text">Garson çağrısı</span>
                    <strong>{call.tableName}</strong>
                    <p className="muted">{createdAt.time} · {createdAt.date} · Geçen süre: {formatDuration(call.createdAt)}</p>
                    {call.assignedByFullName && <p className="muted small-text">Sahiplenen: {call.assignedByFullName} · {assignedAt.time}</p>}
                    {call.visitedByFullName && <p className="muted small-text">Masaya giden: {call.visitedByFullName} · {visitedAt.time}</p>}
                  </div>
                  <div className="row-actions">
                    <span className="status-pill">{call.status}</span>
                    {call.status === 'Bekliyor' && <button className="btn" onClick={() => claimWaiterCall(call)} type="button">Sahiplen</button>}
                    {call.status !== 'Masaya Gidildi' && <button className="btn" onClick={() => markWaiterCallVisited(call)} type="button">Masaya Gidildi</button>}
                    <button className="btn primary" onClick={() => { setClosingCallId(call.id); setCloseNote('') }} type="button">Kapat</button>
                  </div>
                  {closingCallId === call.id && (
                    <div className="qr-inline-panel">
                      <label>Kapatma notu</label>
                      <textarea rows={2} value={closeNote} onChange={event => setCloseNote(event.target.value)} placeholder="Opsiyonel çağrı kapatma notu" />
                      <div className="form-actions">
                        <button className="btn primary" onClick={() => closeWaiterCall(call)} type="button">Çağrıyı Kapat</button>
                        <button className="btn" onClick={() => setClosingCallId('')} type="button">Vazgeç</button>
                      </div>
                    </div>
                  )}
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
            <p className="muted">Düzenleme, karşılaştırma, red nedeni ve audit kayıtları canlı yenilenir.</p>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="empty-state">Henüz QR sipariş talebi bulunmuyor.</div>
        ) : (
          <div className="qr-request-list">
            {requests.map(request => {
              const createdAt = formatDateTime(request.createdAt)
              const updatedAt = formatDateTime(request.updatedAt)
              const requestEvents = getRequestEvents(request.id)
              const isEditing = editingRequestId === request.id
              const isRejecting = rejectingRequestId === request.id
              const comparisonRows = getComparisonRows(request.originalItems || request.items, isEditing ? editItems : request.items)

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

                  {(request.customerNote || request.staffNote) && (
                    <div className="qr-note-box">
                      {request.customerNote && <p><strong>Müşteri notu:</strong> {request.customerNote}</p>}
                      {request.staffNote && <p><strong>Personel notu:</strong> {request.staffNote}</p>}
                    </div>
                  )}

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
                    <div>
                      <span>Düzenleme</span>
                      <strong>{request.editCount || 0}</strong>
                      <small>{request.updatedByFullName ? `${request.updatedByFullName} · ${updatedAt.time}` : 'Henüz yok'}</small>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="qr-inline-panel">
                      <div className="section-header compact">
                        <h3>QR Siparişi Düzenle</h3>
                        <span className="status-pill">Karşılaştırma</span>
                      </div>

                      <div className="table-wrap">
                        <table className="data-table report-table">
                          <thead>
                            <tr><th>Ürün</th><th>Orijinal</th><th>Güncel</th><th>Fark</th></tr>
                          </thead>
                          <tbody>
                            {comparisonRows.map(row => (
                              <tr key={row.productName}>
                                <td>{row.productName}</td>
                                <td>{row.originalQty}</td>
                                <td>{row.currentQty}</td>
                                <td>{row.currentQty - row.originalQty > 0 ? `+${row.currentQty - row.originalQty}` : row.currentQty - row.originalQty}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="qr-edit-list">
                        {editItems.map(item => (
                          <div className="qr-edit-row" key={item.productId}>
                            <div>
                              <strong>{item.productName}</strong>
                              <span>{formatCurrency(item.unitPrice)} · {formatCurrency(item.unitPrice * item.qty)}</span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              value={item.qty}
                              onChange={event => updateEditItemQty(item.productId, Math.floor(Number(event.target.value) || 0))}
                              aria-label={`${item.productName} adedi`}
                            />
                            <button className="btn" type="button" onClick={() => updateEditItemQty(item.productId, 0)}>Sil</button>
                          </div>
                        ))}
                      </div>

                      <div className="qr-edit-add-row">
                        <select value={editProductId} onChange={event => setEditProductId(event.target.value)} disabled={activeProducts.length === 0}>
                          {activeProducts.length === 0 && <option value="">Aktif ürün yok</option>}
                          {activeProducts.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
                        </select>
                        <input type="number" min={1} value={editProductQty} onChange={event => setEditProductQty(event.target.value)} />
                        <button className="btn" type="button" disabled={!editProductId} onClick={addProductToEdit}>Ürün Ekle</button>
                      </div>

                      <div className="form-field">
                        <label>Personel notu</label>
                        <textarea rows={3} value={editStaffNote} onChange={event => setEditStaffNote(event.target.value)} placeholder="Onay/red öncesi personel notu" />
                      </div>

                      <div className="qr-cart-total">
                        <span>Güncel talep tutarı</span>
                        <strong>{formatCurrency(requestTotal({ items: editItems }))}</strong>
                      </div>

                      <div className="form-actions">
                        <button className="btn primary" type="button" onClick={() => saveRequestEdits(request)}>Değişiklikleri Kaydet</button>
                        <button className="btn" type="button" onClick={cancelEditRequest}>Vazgeç</button>
                      </div>
                    </div>
                  )}

                  {isRejecting && (
                    <div className="qr-inline-panel">
                      <div className="section-header compact">
                        <h3>Red Nedeni</h3>
                      </div>
                      <div className="form-row qr-reject-row">
                        <div className="form-field">
                          <label>Neden</label>
                          <select value={rejectReason} onChange={event => setRejectReason(event.target.value as QRRejectReason)}>
                            {rejectReasons.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                          </select>
                        </div>
                        <div className="form-field">
                          <label>Açıklama</label>
                          <textarea rows={3} value={rejectNote} onChange={event => setRejectNote(event.target.value)} placeholder="Red açıklaması" />
                        </div>
                      </div>
                      <div className="form-actions">
                        <button className="btn primary" type="button" onClick={() => rejectRequest(request)}>Reddet</button>
                        <button className="btn" type="button" onClick={() => setRejectingRequestId('')}>Vazgeç</button>
                      </div>
                    </div>
                  )}

                  {renderAuditList(requestEvents)}

                  <div className="qr-request-actions">
                    <button className="btn primary" onClick={() => approveRequest(request)} type="button">Onayla</button>
                    <button className="btn" onClick={() => startEditRequest(request)} type="button">Düzenle</button>
                    <button className="btn" onClick={() => startRejectRequest(request)} type="button">Reddet</button>
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
