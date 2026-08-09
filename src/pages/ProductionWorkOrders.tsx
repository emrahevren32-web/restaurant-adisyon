import React from 'react'
import { BarcodeIntegrationService } from '../barcode-engine/barcode-integration.service'
import type { BarcodeGenerateInput } from '../barcode-engine/barcode.types'
import BarcodePreviewModal from '../components/BarcodePreviewModal'
import type { User } from '../types'
import {
  PRODUCTION_WORK_ORDER_BRANCHES,
  PRODUCTION_WORK_ORDER_PRIORITIES,
  PRODUCTION_WORK_ORDER_PRODUCTS,
  PRODUCTION_WORK_ORDER_STATUSES,
  PRODUCTION_WORK_ORDER_UNITS,
  loadProductionWorkOrders,
  saveProductionWorkOrders
} from '../production-work-orders/production-work-order.mock'
import type {
  ProductionWorkOrder,
  ProductionWorkOrderHistoryEvent,
  ProductionWorkOrderHistoryType,
  ProductionWorkOrderLine,
  ProductionWorkOrderPriority,
  ProductionWorkOrderStatus,
  ProductionWorkOrderUnit
} from '../production-work-orders/production-work-order.types'

type Props = { currentUser: User }
type StatusFilter = ProductionWorkOrderStatus | 'all'
type PanelMode = 'summary' | 'form'
type PageMode = 'list' | 'detail' | 'print'
type SortDirection = 'asc' | 'desc'
type ToastTone = 'success' | 'info'
type SortKey =
  | 'workOrderNo'
  | 'requester'
  | 'branch'
  | 'deliveryDate'
  | 'priority'
  | 'status'
  | 'lineCount'
  | 'totalQuantity'

type WorkOrderLineFormState = {
  id: string
  productName: string
  quantity: string
  unit: ProductionWorkOrderUnit
  note: string
}

type WorkOrderFormState = {
  requester: string
  branch: string
  deliveryDate: string
  priority: ProductionWorkOrderPriority
  description: string
  notes: string
  lines: WorkOrderLineFormState[]
}

type QuantityTotals = Record<ProductionWorkOrderUnit, number>
type ToastState = {
  id: string
  text: string
  tone: ToastTone
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const STATUS_FLOW: ProductionWorkOrderStatus[] = [
  'Taslak',
  'Bekliyor',
  'Üretimde',
  'Tamamlandı',
  'Sevkiyata Hazır'
]

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const createEmptyLine = (): WorkOrderLineFormState => ({
  id: createId('pwo_line'),
  productName: PRODUCTION_WORK_ORDER_PRODUCTS[0],
  quantity: '1',
  unit: 'kg',
  note: ''
})

const createInitialForm = (currentUser: User): WorkOrderFormState => ({
  requester: currentUser.fullName || currentUser.username || '',
  branch: PRODUCTION_WORK_ORDER_BRANCHES[0],
  deliveryDate: todayKey(),
  priority: 'Normal',
  description: '',
  notes: '',
  lines: [createEmptyLine()]
})

const createFormFromOrder = (order: ProductionWorkOrder): WorkOrderFormState => ({
  requester: order.requester,
  branch: order.branch,
  deliveryDate: order.deliveryDate,
  priority: order.priority,
  description: order.description,
  notes: order.notes,
  lines: order.lines.map(line => ({
    id: line.id,
    productName: line.productName,
    quantity: String(line.quantity),
    unit: line.unit,
    note: line.note
  }))
})

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  if(Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR', {
  maximumFractionDigits: 2
})

const createHistoryEvent = (
  type: ProductionWorkOrderHistoryType,
  description: string,
  actorName: string
): ProductionWorkOrderHistoryEvent => ({
  id: createId('pwo_history'),
  type,
  description,
  actorName,
  createdAt: new Date().toISOString()
})

const createEmptyTotals = (): QuantityTotals => ({
  kg: 0,
  lt: 0,
  adet: 0,
  tepsi: 0,
  koli: 0
})

const getQuantityTotals = (lines: Pick<ProductionWorkOrderLine, 'quantity' | 'unit'>[]): QuantityTotals => (
  lines.reduce<QuantityTotals>((totals, line) => ({
    ...totals,
    [line.unit]: totals[line.unit] + line.quantity
  }), createEmptyTotals())
)

const getTotalQuantityScore = (lines: ProductionWorkOrderLine[]) => (
  lines.reduce((sum, line) => sum + line.quantity, 0)
)

const formatTotalQuantity = (lines: ProductionWorkOrderLine[]) => {
  const totals = getQuantityTotals(lines)

  return PRODUCTION_WORK_ORDER_UNITS
    .filter(unit => totals[unit] > 0)
    .map(unit => `${formatNumber(totals[unit])} ${unit}`)
    .join(' / ') || '-'
}

const formatDuration = (minutes: number) => {
  if(minutes < 60) return `${minutes} dk`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours} sa ${remainingMinutes} dk` : `${hours} sa`
}

const getStatusClass = (status: ProductionWorkOrderStatus) => {
  if(status === 'Tamamlandı' || status === 'Sevkiyata Hazır') return 'success'
  if(status === 'Üretimde') return 'info-pill'
  if(status === 'Bekliyor') return 'warning-pill'
  if(status === 'İptal') return 'danger-pill'
  return 'muted-pill'
}

const getPriorityClass = (priority: ProductionWorkOrderPriority) => {
  if(priority === 'Acil') return 'danger-pill'
  if(priority === 'Yüksek') return 'warning-pill'
  if(priority === 'Düşük') return 'muted-pill'
  return 'info-pill'
}

const estimateDuration = (lines: ProductionWorkOrderLine[]) => {
  const weightedMinutes = lines.reduce((sum, line) => {
    if(line.unit === 'kg') return sum + line.quantity * 1.6
    if(line.unit === 'lt') return sum + line.quantity * 1
    return sum + line.quantity * 3
  }, 35)

  return Math.max(45, Math.round(weightedMinutes / 5) * 5)
}

const getNextWorkOrderNo = (orders: ProductionWorkOrder[]) => {
  const year = new Date().getFullYear()
  const maxNo = orders.reduce((max, order) => {
    const match = order.workOrderNo.match(/(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `UE-${year}-${String(maxNo + 1).padStart(4, '0')}`
}

const getNextStatus = (status: ProductionWorkOrderStatus) => {
  const statusIndex = STATUS_FLOW.indexOf(status)
  return statusIndex >= 0 && statusIndex < STATUS_FLOW.length - 1
    ? STATUS_FLOW[statusIndex + 1]
    : null
}

const compareStrings = (first: string, second: string) => first.localeCompare(second, 'tr-TR')

const getSortValue = (order: ProductionWorkOrder, key: SortKey) => {
  if(key === 'lineCount') return order.lines.length
  if(key === 'totalQuantity') return getTotalQuantityScore(order.lines)
  return order[key]
}

const getSortableHeaderLabel = (label: string, key: SortKey, sortKey: SortKey, direction: SortDirection) => {
  if(key !== sortKey) return label
  return `${label} ${direction === 'asc' ? '↑' : '↓'}`
}

const normalizeFormLines = (lines: WorkOrderLineFormState[]): ProductionWorkOrderLine[] => (
  lines.map(line => ({
    id: line.id,
    productName: line.productName.trim(),
    quantity: Number(line.quantity),
    unit: line.unit,
    note: line.note.trim()
  }))
)

const validateForm = (form: WorkOrderFormState) => {
  if(!form.requester.trim()) return 'Talep eden bilgisi zorunludur.'
  if(!form.branch.trim()) return 'Şube seçimi zorunludur.'
  if(!form.deliveryDate) return 'Teslim tarihi zorunludur.'
  if(form.lines.length === 0) return 'En az 1 ürün satırı eklenmelidir.'

  const invalidLineIndex = form.lines.findIndex(line => {
    const quantity = Number(line.quantity)
    return !line.productName.trim()
      || !line.quantity.trim()
      || !Number.isFinite(quantity)
      || quantity <= 0
  })

  if(invalidLineIndex >= 0){
    const line = form.lines[invalidLineIndex]
    if(!line.productName.trim()) return `${invalidLineIndex + 1}. satırda ürün adı zorunludur.`
    if(!line.quantity.trim()) return `${invalidLineIndex + 1}. satırda miktar boş bırakılamaz.`
    if(!Number.isFinite(Number(line.quantity))) return `${invalidLineIndex + 1}. satırda geçerli bir miktar girilmelidir.`
    return `${invalidLineIndex + 1}. satırda miktar 0 veya negatif olamaz.`
  }

  return ''
}

const getSortedHistory = (order: ProductionWorkOrder) => (
  [...order.history].sort((first, second) => second.createdAt.localeCompare(first.createdAt))
)

export default function ProductionWorkOrders({ currentUser }: Props){
  const [orders, setOrders] = React.useState<ProductionWorkOrder[]>(() => loadProductionWorkOrders())
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [dateFilter, setDateFilter] = React.useState('')
  const [selectedOrderId, setSelectedOrderId] = React.useState('pwo_001')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('summary')
  const [pageMode, setPageMode] = React.useState<PageMode>('list')
  const [editingOrderId, setEditingOrderId] = React.useState('')
  const [sortKey, setSortKey] = React.useState<SortKey>('deliveryDate')
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc')
  const [form, setForm] = React.useState<WorkOrderFormState>(() => createInitialForm(currentUser))
  const [formError, setFormError] = React.useState('')
  const [toast, setToast] = React.useState<ToastState | null>(null)
  const [barcodePreviewRequest, setBarcodePreviewRequest] = React.useState<BarcodeGenerateInput | null>(null)

  const actorName = currentUser.fullName || currentUser.username || 'Kullanıcı'

  const commitOrders = React.useCallback((updater: React.SetStateAction<ProductionWorkOrder[]>) => {
    setOrders(prev => {
      const nextOrders = typeof updater === 'function'
        ? (updater as (current: ProductionWorkOrder[]) => ProductionWorkOrder[])(prev)
        : updater
      saveProductionWorkOrders(nextOrders)
      return nextOrders
    })
  }, [])

  const showToast = React.useCallback((text: string, tone: ToastTone = 'success') => {
    setToast({
      id: createId('pwo_toast'),
      text,
      tone
    })
  }, [])

  const visibleOrders = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return orders
      .filter(order => {
        const matchesSearch = !normalizedSearch
          || order.workOrderNo.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
          || order.requester.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
          || order.branch.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
          || order.description.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
          || order.notes.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
          || order.lines.some(line => line.productName.toLocaleLowerCase('tr-TR').includes(normalizedSearch))
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter
        const matchesDate = !dateFilter || order.deliveryDate === dateFilter

        return matchesSearch && matchesStatus && matchesDate
      })
      .sort((first, second) => {
        const firstValue = getSortValue(first, sortKey)
        const secondValue = getSortValue(second, sortKey)
        const diff = typeof firstValue === 'number' && typeof secondValue === 'number'
          ? firstValue - secondValue
          : compareStrings(String(firstValue), String(secondValue))

        if(diff !== 0) return sortDirection === 'asc' ? diff : -diff
        return second.createdAt.localeCompare(first.createdAt)
      })
  }, [dateFilter, orders, search, sortDirection, sortKey, statusFilter])

  React.useEffect(() => {
    if(panelMode === 'form') return
    if(visibleOrders.some(order => order.id === selectedOrderId)) return
    setSelectedOrderId(visibleOrders[0]?.id || '')
  }, [panelMode, selectedOrderId, visibleOrders])

  const selectedOrder = orders.find(order => order.id === selectedOrderId) || null
  const selectedTotals = selectedOrder ? getQuantityTotals(selectedOrder.lines) : createEmptyTotals()
  const isEditing = Boolean(editingOrderId)
  const totalOrders = orders.length
  const waitingOrders = orders.filter(order => order.status === 'Bekliyor' || order.status === 'Üretimde').length
  const readyOrders = orders.filter(order => order.status === 'Sevkiyata Hazır').length
  const totalKg = orders.reduce((sum, order) => sum + getQuantityTotals(order.lines).kg, 0)

  const getCreatedByName = (order: ProductionWorkOrder) => (
    order.history.find(event => event.type === 'Oluşturuldu')?.actorName
    || (order.createdByUserId === currentUser.id ? actorName : 'MIYOP Demo')
  )

  const getLastUpdatedByName = (order: ProductionWorkOrder) => (
    getSortedHistory(order)[0]?.actorName || getCreatedByName(order)
  )

  const getLastUpdatedAt = (order: ProductionWorkOrder) => (
    order.updatedAt || getSortedHistory(order)[0]?.createdAt || order.createdAt
  )

  React.useEffect(() => {
    if(!toast) return undefined

    const timeoutId = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const showPlaceholder = (label: string) => {
    showToast(`${label} aksiyonu bu fazda taslak olarak bırakıldı.`, 'info')
  }

  const returnToList = () => {
    setPageMode('list')
    setToast(null)
  }

  const startNewOrder = React.useCallback(() => {
    setPageMode('list')
    setPanelMode('form')
    setEditingOrderId('')
    setForm(createInitialForm(currentUser))
    setFormError('')
    setToast(null)
  }, [currentUser])

  const startEditOrder = (order: ProductionWorkOrder) => {
    setPageMode('list')
    setSelectedOrderId(order.id)
    setPanelMode('form')
    setEditingOrderId(order.id)
    setForm(createFormFromOrder(order))
    setFormError('')
    setToast(null)
  }

  const cancelForm = () => {
    setPanelMode('summary')
    setEditingOrderId('')
    setForm(createInitialForm(currentUser))
    setFormError('')
  }

  const openDetail = (orderId = selectedOrderId) => {
    if(!orderId) return
    setSelectedOrderId(orderId)
    setPageMode('detail')
    setPanelMode('summary')
    setToast(null)
  }

  const openPrintPreview = (orderId = selectedOrderId) => {
    if(!orderId) return
    setSelectedOrderId(orderId)
    setPageMode('print')
    setPanelMode('summary')
    setToast(null)
  }

  const updateForm = <TKey extends keyof WorkOrderFormState>(key: TKey, value: WorkOrderFormState[TKey]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const updateLine = (lineId: string, changes: Partial<WorkOrderLineFormState>) => {
    setForm(prev => ({
      ...prev,
      lines: prev.lines.map(line => line.id === lineId ? { ...line, ...changes } : line)
    }))
  }

  const addLine = () => {
    setForm(prev => ({
      ...prev,
      lines: [...prev.lines, createEmptyLine()]
    }))
    setFormError('')
    showToast('Ürün satırı eklendi.')
  }

  const copyLine = (lineId: string) => {
    setForm(prev => {
      const sourceLine = prev.lines.find(line => line.id === lineId)
      if(!sourceLine) return prev

      const nextLine = {
        ...sourceLine,
        id: createId('pwo_line')
      }
      const sourceIndex = prev.lines.findIndex(line => line.id === lineId)
      const lines = [...prev.lines]
      lines.splice(sourceIndex + 1, 0, nextLine)

      return {
        ...prev,
        lines
      }
    })
    setFormError('')
    showToast('Ürün satırı eklendi.')
  }

  const removeLine = (lineId: string) => {
    if(!window.confirm('Bu ürün satırını silmek istediğinize emin misiniz?')) return

    if(form.lines.length <= 1){
      setFormError('En az 1 ürün satırı kalmalıdır.')
      return
    }

    setForm(prev => ({
      ...prev,
      lines: prev.lines.filter(line => line.id !== lineId)
    }))

    const existingOrder = editingOrderId
      ? orders.find(order => order.id === editingOrderId)
      : null
    const lineExistsInSavedOrder = existingOrder?.lines.some(line => line.id === lineId)

    if(existingOrder && lineExistsInSavedOrder && existingOrder.lines.length > 1){
      const now = new Date().toISOString()
      const nextLines = existingOrder.lines.filter(line => line.id !== lineId)
      const historyEvent = createHistoryEvent('Ürün Silindi', 'Ürün satırı silindi.', actorName)
      const updatedOrder: ProductionWorkOrder = {
        ...existingOrder,
        lines: nextLines,
        estimatedMinutes: estimateDuration(nextLines),
        updatedAt: now,
        history: [historyEvent, ...existingOrder.history]
      }

      commitOrders(prev => prev.map(order => order.id === updatedOrder.id ? updatedOrder : order))
      setSelectedOrderId(updatedOrder.id)
    }

    setFormError('')
    showToast('Ürün satırı silindi.')
  }

  const deleteOrder = (order: ProductionWorkOrder) => {
    if(!window.confirm('Bu iş emrini silmek istediğinize emin misiniz?')) return

    const nextOrders = orders.filter(item => item.id !== order.id)
    commitOrders(nextOrders)
    setSelectedOrderId(nextOrders[0]?.id || '')
    setPageMode('list')
    setPanelMode('summary')

    if(editingOrderId === order.id){
      setEditingOrderId('')
      setForm(createInitialForm(currentUser))
      setFormError('')
    }

    showToast('İş emri silindi.')
  }

  const changeSort = (key: SortKey) => {
    if(sortKey === key){
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
      return
    }

    setSortKey(key)
    setSortDirection(key === 'deliveryDate' ? 'asc' : 'desc')
  }

  const updateOrderStatus = (order: ProductionWorkOrder, status: ProductionWorkOrderStatus) => {
    if(order.status === status) return

    const now = new Date().toISOString()
    const historyEvent = createHistoryEvent(
      'Durum Değişti',
      `Durum ${order.status} durumundan ${status} durumuna alındı.`,
      actorName
    )
    const nextOrder: ProductionWorkOrder = {
      ...order,
      status,
      updatedAt: now,
      history: [historyEvent, ...order.history]
    }

    commitOrders(prev => prev.map(item => item.id === order.id ? nextOrder : item))
    setSelectedOrderId(order.id)
    showToast('Durum değiştirildi.')
  }

  const advanceStatus = (order: ProductionWorkOrder) => {
    const nextStatus = getNextStatus(order.status)
    if(nextStatus) updateOrderStatus(order, nextStatus)
  }

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault()

    const validationError = validateForm(form)
    if(validationError){
      setFormError(validationError)
      return
    }

    const normalizedLines = normalizeFormLines(form.lines)
    const now = new Date().toISOString()

    if(isEditing){
      const existingOrder = orders.find(order => order.id === editingOrderId)
      if(!existingOrder){
        setFormError('Düzenlenecek iş emri bulunamadı.')
        return
      }

      const historyEvents: ProductionWorkOrderHistoryEvent[] = [
        createHistoryEvent('Düzenlendi', 'İş emri bilgileri güncellendi.', actorName)
      ]
      if(normalizedLines.length > existingOrder.lines.length){
        historyEvents.push(createHistoryEvent('Ürün Eklendi', 'Ürün satırları artırıldı.', actorName))
      }
      if(normalizedLines.length < existingOrder.lines.length){
        historyEvents.push(createHistoryEvent('Ürün Silindi', 'Ürün satırları azaltıldı.', actorName))
      }

      const updatedOrder: ProductionWorkOrder = {
        ...existingOrder,
        requester: form.requester.trim(),
        branch: form.branch.trim(),
        deliveryDate: form.deliveryDate,
        priority: form.priority,
        description: form.description.trim(),
        notes: form.notes.trim(),
        lines: normalizedLines,
        estimatedMinutes: estimateDuration(normalizedLines),
        updatedAt: now,
        history: [...historyEvents, ...existingOrder.history]
      }

      commitOrders(prev => prev.map(order => order.id === updatedOrder.id ? updatedOrder : order))
      setSelectedOrderId(updatedOrder.id)
      setPanelMode('summary')
      setEditingOrderId('')
      setForm(createInitialForm(currentUser))
      setFormError('')
      showToast('İş emri güncellendi.')
      return
    }

    const newOrder: ProductionWorkOrder = {
      id: createId('pwo'),
      workOrderNo: getNextWorkOrderNo(orders),
      requester: form.requester.trim(),
      branch: form.branch.trim(),
      deliveryDate: form.deliveryDate,
      priority: form.priority,
      status: 'Taslak',
      description: form.description.trim(),
      notes: form.notes.trim(),
      lines: normalizedLines,
      history: [
        createHistoryEvent('Oluşturuldu', 'İş emri oluşturuldu.', actorName)
      ],
      estimatedMinutes: estimateDuration(normalizedLines),
      linkedShipmentNo: '',
      createdAt: now,
      updatedAt: now,
      createdByUserId: currentUser.id
    }

    commitOrders(prev => [newOrder, ...prev])
    setSelectedOrderId(newOrder.id)
    setPanelMode('summary')
    setForm(createInitialForm(currentUser))
    setFormError('')
    showToast('İş emri oluşturuldu.')
  }

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if(event.key === 'Escape'){
        if(pageMode !== 'list'){
          setPageMode('list')
          return
        }

        if(panelMode === 'form') cancelForm()
      }

      if((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('tr-TR') === 'n'){
        event.preventDefault()
        startNewOrder()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [panelMode, pageMode, startNewOrder])

  const renderStatusControls = (order: ProductionWorkOrder) => {
    const nextStatus = getNextStatus(order.status)

    return (
      <div className="production-work-order-status-actions">
        <select value={order.status} onChange={event => updateOrderStatus(order, event.target.value as ProductionWorkOrderStatus)}>
          {PRODUCTION_WORK_ORDER_STATUSES.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        {nextStatus && (
          <button className="btn primary" type="button" onClick={() => advanceStatus(order)}>
            {nextStatus} Yap
          </button>
        )}
        {order.status !== 'İptal' && (
          <button className="btn danger" type="button" onClick={() => updateOrderStatus(order, 'İptal')}>İptal</button>
        )}
      </div>
    )
  }

  const renderLineForm = () => (
    <div className="production-work-order-lines">
      <div className="section-header compact">
        <h3>Ürün Satırları</h3>
        <button className="btn" type="button" onClick={addLine}>Yeni Satır Ekle</button>
      </div>

      {form.lines.map((line, index) => (
        <div className="production-work-order-line" key={line.id}>
          <div className="production-work-order-line-title">
            <strong>Satır {index + 1}</strong>
            <div className="production-work-order-line-actions">
              <button className="btn" type="button" onClick={() => copyLine(line.id)}>Kopyala</button>
              <button className="btn danger" type="button" onClick={() => removeLine(line.id)}>Sil</button>
            </div>
          </div>
          <div className="form-field">
            <label>Ürün</label>
            <select value={line.productName} onChange={event => updateLine(line.id, { productName: event.target.value })}>
              {PRODUCTION_WORK_ORDER_PRODUCTS.map(product => (
                <option key={product} value={product}>{product}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Miktar</label>
              <input type="number" min="0" step="0.001" value={line.quantity} onChange={event => updateLine(line.id, { quantity: event.target.value })} />
            </div>
            <div className="form-field">
              <label>Birim</label>
              <select value={line.unit} onChange={event => updateLine(line.id, { unit: event.target.value as ProductionWorkOrderUnit })}>
                {PRODUCTION_WORK_ORDER_UNITS.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-field">
            <label>Not</label>
            <input value={line.note} onChange={event => updateLine(line.id, { note: event.target.value })} placeholder="Satır notu" />
          </div>
        </div>
      ))}

      {form.lines.length === 0 && (
        <div className="empty-state production-work-order-line-empty">
          En az 1 ürün satırı eklenmelidir.
          <button className="btn" type="button" onClick={addLine}>Yeni Satır Ekle</button>
        </div>
      )}
    </div>
  )

  const renderFormPanel = () => (
    <section className="card">
      <div className="section-header compact">
        <h3>{isEditing ? 'İş Emri Düzenle' : 'Yeni İş Emri'}</h3>
        <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
      </div>

      {formError && <div className="form-error">{formError}</div>}

      <form className="stacked-form production-work-order-form" onSubmit={submitForm}>
        <div className="form-field">
          <label>Talep Eden</label>
          <input value={form.requester} onChange={event => updateForm('requester', event.target.value)} />
        </div>

        <div className="form-field">
          <label>Şube</label>
          <select value={form.branch} onChange={event => updateForm('branch', event.target.value)}>
            {PRODUCTION_WORK_ORDER_BRANCHES.map(branch => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Teslim Tarihi</label>
            <input type="date" value={form.deliveryDate} onChange={event => updateForm('deliveryDate', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Öncelik</label>
            <select value={form.priority} onChange={event => updateForm('priority', event.target.value as ProductionWorkOrderPriority)}>
              {PRODUCTION_WORK_ORDER_PRIORITIES.map(priority => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label>Açıklama</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={event => updateForm('description', event.target.value)}
            placeholder="Üretim planı veya özel hazırlık notu"
          />
        </div>

        <div className="form-field">
          <label>Notlar</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={event => updateForm('notes', event.target.value)}
            placeholder="İş emrine ait operasyon notları"
          />
        </div>

        {renderLineForm()}

        <div className="form-actions">
          <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
          <button className="btn primary" type="submit">{isEditing ? 'Değişiklikleri Kaydet' : 'İş Emri Oluştur'}</button>
        </div>
      </form>
    </section>
  )

  const renderSummaryPanel = () => (
    <section className="card production-work-order-summary">
      {selectedOrder ? (
        <>
          <div className="section-header compact">
            <div>
              <h3>{selectedOrder.workOrderNo}</h3>
              <p className="muted">{selectedOrder.branch}</p>
            </div>
            <span className={`status-pill ${getStatusClass(selectedOrder.status)}`}>{selectedOrder.status}</span>
          </div>

          <div className="production-work-order-summary-grid">
            <div>
              <span>Toplam Satır</span>
              <strong>{selectedOrder.lines.length}</strong>
            </div>
            <div>
              <span>Toplam KG</span>
              <strong>{formatNumber(selectedTotals.kg)}</strong>
            </div>
            <div>
              <span>Toplam LT</span>
              <strong>{formatNumber(selectedTotals.lt)}</strong>
            </div>
            <div>
              <span>Toplam Adet</span>
              <strong>{formatNumber(selectedTotals.adet)}</strong>
            </div>
            <div>
              <span>Toplam Koli</span>
              <strong>{formatNumber(selectedTotals.koli)}</strong>
            </div>
            <div>
              <span>Tahmini Süre</span>
              <strong>{formatDuration(selectedOrder.estimatedMinutes)}</strong>
            </div>
            <div>
              <span>Bağlı Sevkiyat</span>
              <strong>{selectedOrder.linkedShipmentNo || 'Yok'}</strong>
            </div>
            <div>
              <span>Oluşturulma Tarihi</span>
              <strong>{formatDateTime(selectedOrder.createdAt)}</strong>
            </div>
          </div>

          <div className="production-work-order-status-block">
            <span className="small-label">Durum Geçişi</span>
            {renderStatusControls(selectedOrder)}
          </div>

          <div className="production-work-order-product-list">
            {selectedOrder.lines.map((line, index) => (
              <div key={line.id}>
                <i>{index + 1}</i>
                <span>
                  <strong>{line.productName}</strong>
                  {line.note && <small>{line.note}</small>}
                </span>
                <b>{formatNumber(line.quantity)} {line.unit}</b>
              </div>
            ))}
          </div>

          <div className="production-work-order-side-actions">
            <button className="btn primary" type="button" onClick={() => openDetail(selectedOrder.id)}>Detay</button>
            <button className="btn" type="button" onClick={() => setBarcodePreviewRequest(BarcodeIntegrationService.fromProductionOrder(selectedOrder))}>Barkod Önizle</button>
            <button className="btn" type="button" onClick={() => startEditOrder(selectedOrder)}>Düzenle</button>
            <button className="btn" type="button" onClick={() => showPlaceholder('Kopyala')}>Kopyala</button>
            <button className="btn" type="button" onClick={() => openPrintPreview(selectedOrder.id)}>Yazdır</button>
            <button className="btn danger" type="button" onClick={() => deleteOrder(selectedOrder)}>Sil</button>
          </div>
        </>
      ) : (
        <div className="empty-state">Özet için bir iş emri seçin.</div>
      )}
    </section>
  )

  const renderHistory = (order: ProductionWorkOrder) => (
    <div className="production-work-order-history">
      {order.history.length === 0 ? (
        <div className="empty-state">Hareket kaydı bulunmuyor.</div>
      ) : order.history.map(event => (
        <div key={event.id} className="production-work-order-history-item">
          <span className={`status-pill ${event.type === 'Ürün Silindi' ? 'danger-pill' : event.type === 'Durum Değişti' ? 'info-pill' : 'muted-pill'}`}>{event.type}</span>
          <div>
            <strong>{event.description}</strong>
            <small>{event.actorName} · {formatDateTime(event.createdAt)}</small>
          </div>
        </div>
      ))}
    </div>
  )

  if(pageMode === 'detail'){
    if(!selectedOrder){
      return (
        <div className="production-work-orders-page">
          <div className="empty-state">Detay için bir iş emri seçin.</div>
        </div>
      )
    }

    const totals = getQuantityTotals(selectedOrder.lines)

    return (
      <div className="production-work-orders-page production-work-order-detail-page">
        <div className="page-title">
          <div>
            <h2>İş Emri Detayı</h2>
            <p className="muted">{selectedOrder.workOrderNo} · {selectedOrder.branch}</p>
          </div>
          <div className="production-work-order-detail-actions">
            <button className="btn" type="button" onClick={returnToList}>Listeye Dön</button>
            <button className="btn" type="button" onClick={() => setBarcodePreviewRequest(BarcodeIntegrationService.fromProductionOrder(selectedOrder))}>Barkod Önizle</button>
            <button className="btn" type="button" onClick={() => startEditOrder(selectedOrder)}>Düzenle</button>
            <button className="btn primary" type="button" onClick={() => openPrintPreview(selectedOrder.id)}>İş Emri Yazdır</button>
          </div>
        </div>

        <section className="card production-work-order-detail-card">
          <div className="section-header compact">
            <div>
              <h3>Genel Bilgiler</h3>
              <p className="muted">{selectedOrder.description || 'Açıklama bulunmuyor.'}</p>
            </div>
            <span className={`status-pill ${getStatusClass(selectedOrder.status)}`}>{selectedOrder.status}</span>
          </div>

          <div className="production-work-order-detail-grid">
            <div><span>Talep Eden</span><strong>{selectedOrder.requester}</strong></div>
            <div><span>Şube</span><strong>{selectedOrder.branch}</strong></div>
            <div><span>Teslim Tarihi</span><strong>{formatDate(selectedOrder.deliveryDate)}</strong></div>
            <div><span>Öncelik</span><strong>{selectedOrder.priority}</strong></div>
            <div><span>Tahmini Süre</span><strong>{formatDuration(selectedOrder.estimatedMinutes)}</strong></div>
            <div><span>Bağlı Sevkiyat</span><strong>{selectedOrder.linkedShipmentNo || 'Yok'}</strong></div>
            <div><span>Oluşturan</span><strong>{getCreatedByName(selectedOrder)}</strong></div>
            <div><span>Son Güncelleyen</span><strong>{getLastUpdatedByName(selectedOrder)}</strong></div>
            <div><span>Oluşturulma Tarihi</span><strong>{formatDateTime(selectedOrder.createdAt)}</strong></div>
            <div><span>Son Güncelleme Tarihi</span><strong>{formatDateTime(getLastUpdatedAt(selectedOrder))}</strong></div>
          </div>

          <div className="production-work-order-status-block">
            <span className="small-label">Durum Geçişi</span>
            {renderStatusControls(selectedOrder)}
          </div>
        </section>

        <section className="card">
          <div className="section-header compact">
            <h3>Ürün Satırları</h3>
            <p className="muted">{selectedOrder.lines.length} satır · {formatTotalQuantity(selectedOrder.lines)}</p>
          </div>
          <div className="table-wrap">
            <table className="data-table production-work-order-detail-table">
              <thead>
                <tr>
                  <th>Sıra</th>
                  <th>Ürün</th>
                  <th>Miktar</th>
                  <th>Birim</th>
                  <th>Not</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.lines.map((line, index) => (
                  <tr key={line.id}>
                    <td>{index + 1}</td>
                    <td><strong>{line.productName}</strong></td>
                    <td>{formatNumber(line.quantity)}</td>
                    <td>{line.unit}</td>
                    <td>{line.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="production-work-order-print-totals">
            <div><span>Toplam KG</span><strong>{formatNumber(totals.kg)}</strong></div>
            <div><span>Toplam LT</span><strong>{formatNumber(totals.lt)}</strong></div>
            <div><span>Toplam Adet</span><strong>{formatNumber(totals.adet)}</strong></div>
            <div><span>Toplam Koli</span><strong>{formatNumber(totals.koli)}</strong></div>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact">
            <h3>Notlar</h3>
          </div>
          <p className="production-work-order-notes">{selectedOrder.notes || 'Bu iş emri için ek not bulunmuyor.'}</p>
        </section>

        <section className="card">
          <div className="section-header compact">
            <h3>Geçmiş Hareketler</h3>
          </div>
          {renderHistory(selectedOrder)}
        </section>
        <BarcodePreviewModal
          request={barcodePreviewRequest}
          bulkRequests={visibleOrders.map(order => BarcodeIntegrationService.fromProductionOrder(order))}
          userName={actorName}
          onClose={() => setBarcodePreviewRequest(null)}
        />
      </div>
    )
  }

  if(pageMode === 'print'){
    if(!selectedOrder){
      return (
        <div className="production-work-orders-page">
          <div className="empty-state">Yazdırma önizlemesi için bir iş emri seçin.</div>
        </div>
      )
    }

    const totals = getQuantityTotals(selectedOrder.lines)

    return (
      <div className="production-work-orders-page production-work-order-print-page">
        <div className="page-title no-print">
          <div>
            <h2>Yazdırılabilir Önizleme</h2>
            <p className="muted">{selectedOrder.workOrderNo}</p>
          </div>
          <div className="production-work-order-detail-actions">
            <button className="btn" type="button" onClick={returnToList}>Listeye Dön</button>
            <button className="btn primary" type="button" onClick={() => window.print()}>Tarayıcıdan Yazdır</button>
          </div>
        </div>

        <section className="card production-work-order-print-sheet">
          <div className="production-work-order-print-header">
            <div>
              <span>Üretim İş Emri</span>
              <h2>{selectedOrder.workOrderNo}</h2>
            </div>
            <strong>{selectedOrder.status}</strong>
          </div>

          <div className="production-work-order-print-meta">
            <div><span>Firma</span><strong>MIYOP Endüstriyel Mutfak</strong></div>
            <div><span>Şube</span><strong>{selectedOrder.branch}</strong></div>
            <div><span>Teslim Tarihi</span><strong>{formatDate(selectedOrder.deliveryDate)}</strong></div>
            <div><span>Talep Eden</span><strong>{selectedOrder.requester}</strong></div>
          </div>

          <h3>Ürün Listesi</h3>
          <table className="data-table production-work-order-print-table">
            <thead>
              <tr>
                <th>Sıra</th>
                <th>Ürün</th>
                <th>Miktar</th>
                <th>Birim</th>
                <th>Not</th>
              </tr>
            </thead>
            <tbody>
              {selectedOrder.lines.map((line, index) => (
                <tr key={line.id}>
                  <td>{index + 1}</td>
                  <td>{line.productName}</td>
                  <td>{formatNumber(line.quantity)}</td>
                  <td>{line.unit}</td>
                  <td>{line.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Toplamlar</h3>
          <div className="production-work-order-print-totals">
            <div><span>Toplam Satır</span><strong>{selectedOrder.lines.length}</strong></div>
            <div><span>Toplam KG</span><strong>{formatNumber(totals.kg)}</strong></div>
            <div><span>Toplam LT</span><strong>{formatNumber(totals.lt)}</strong></div>
            <div><span>Toplam Adet</span><strong>{formatNumber(totals.adet)}</strong></div>
            <div><span>Toplam Koli</span><strong>{formatNumber(totals.koli)}</strong></div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="production-work-orders-page">
      <div className="page-title">
        <div>
          <h2>Üretim Emirleri</h2>
          <p className="muted">Endüstriyel mutfak üretim planlama sürecini iş emri, ürün satırı ve durum modeliyle takip edin.</p>
        </div>
      </div>

      {toast && (
        <div className={`production-work-order-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Toplam İş Emri</span>
          <strong>{totalOrders}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Bekleyen / Üretimde</span>
          <strong>{waitingOrders}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Sevkiyata Hazır</span>
          <strong>{readyOrders}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam KG</span>
          <strong>{formatNumber(totalKg)}</strong>
        </div>
      </div>

      <div className="product-layout production-work-order-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>İş Emri Listesi</h3>
              <p className="muted">{visibleOrders.length} iş emri gösteriliyor.</p>
            </div>
            <div className="production-work-order-toolbar">
              <button className="btn primary" type="button" onClick={startNewOrder}>Yeni İş Emri</button>
              <input
                type="search"
                placeholder="İş emri, talep eden, şube veya ürün ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm durumlar</option>
                {PRODUCTION_WORK_ORDER_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <input
                type="date"
                value={dateFilter}
                onChange={event => setDateFilter(event.target.value)}
                aria-label="Teslim tarihi filtresi"
              />
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table production-work-order-table">
              <colgroup>
                <col className="pwo-col-no" />
                <col className="pwo-col-requester" />
                <col className="pwo-col-branch" />
                <col className="pwo-col-date" />
                <col className="pwo-col-priority" />
                <col className="pwo-col-status" />
                <col className="pwo-col-count" />
                <col className="pwo-col-total" />
              </colgroup>
              <thead>
                <tr>
                  <th><button type="button" onClick={() => changeSort('workOrderNo')}>{getSortableHeaderLabel('İş Emri No', 'workOrderNo', sortKey, sortDirection)}</button></th>
                  <th><button type="button" onClick={() => changeSort('requester')}>{getSortableHeaderLabel('Talep Eden', 'requester', sortKey, sortDirection)}</button></th>
                  <th><button type="button" onClick={() => changeSort('branch')}>{getSortableHeaderLabel('Şube', 'branch', sortKey, sortDirection)}</button></th>
                  <th><button type="button" onClick={() => changeSort('deliveryDate')}>{getSortableHeaderLabel('Teslim Tarihi', 'deliveryDate', sortKey, sortDirection)}</button></th>
                  <th><button type="button" onClick={() => changeSort('priority')}>{getSortableHeaderLabel('Öncelik', 'priority', sortKey, sortDirection)}</button></th>
                  <th><button type="button" onClick={() => changeSort('status')}>{getSortableHeaderLabel('Durum', 'status', sortKey, sortDirection)}</button></th>
                  <th><button type="button" onClick={() => changeSort('lineCount')}>{getSortableHeaderLabel('Satır Sayısı', 'lineCount', sortKey, sortDirection)}</button></th>
                  <th><button type="button" onClick={() => changeSort('totalQuantity')}>{getSortableHeaderLabel('Toplam Miktar', 'totalQuantity', sortKey, sortDirection)}</button></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      <div className="production-work-order-empty-list">
                        <strong>Henüz üretim iş emri bulunmuyor.</strong>
                        <span>İlk iş emrini oluşturmak için "Yeni İş Emri" butonunu kullanabilirsiniz.</span>
                        <button className="btn primary" type="button" onClick={startNewOrder}>Yeni İş Emri</button>
                      </div>
                    </td>
                  </tr>
                )}
                {orders.length > 0 && visibleOrders.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Filtrelere uygun üretim iş emri bulunamadı.</td></tr>
                )}
                {visibleOrders.map(order => (
                  <tr
                    key={order.id}
                    className={order.id === selectedOrderId ? 'selected-row' : ''}
                    onClick={() => {
                      setSelectedOrderId(order.id)
                      setPanelMode('summary')
                    }}
                    onDoubleClick={() => openDetail(order.id)}
                  >
                    <td>
                      <strong>{order.workOrderNo}</strong>
                      {order.description && <div className="muted small-text">{order.description}</div>}
                    </td>
                    <td>{order.requester}</td>
                    <td>{order.branch}</td>
                    <td>{formatDate(order.deliveryDate)}</td>
                    <td><span className={`status-pill ${getPriorityClass(order.priority)}`}>{order.priority}</span></td>
                    <td><span className={`status-pill ${getStatusClass(order.status)}`}>{order.status}</span></td>
                    <td>{order.lines.length}</td>
                    <td>{formatTotalQuantity(order.lines)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side production-work-order-side">
          {panelMode === 'form' ? renderFormPanel() : renderSummaryPanel()}
        </aside>
      </div>
      <BarcodePreviewModal
        request={barcodePreviewRequest}
        bulkRequests={visibleOrders.map(order => BarcodeIntegrationService.fromProductionOrder(order))}
        userName={actorName}
        onClose={() => setBarcodePreviewRequest(null)}
      />
    </div>
  )
}
