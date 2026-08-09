import React from 'react'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import {
  APPROVED_ALTERNATIVE_MATERIAL_STATUS_LABELS,
  ApprovedAlternativeMaterialService
} from '../approved-alternative-materials/approved-alternative-material.service'
import { StockCategory, StockExpiryEvent, StockExpiryLot, StockItem, StockUnit, User } from '../types'
import {
  addActionLog,
  getActiveBranchId,
  loadCriticalStockEvents,
  loadStockCategories,
  loadStockExpiryEvents,
  loadStockExpiryLots,
  loadStockItems,
  loadStockMovements,
  recordCriticalStockTransition,
  saveStockCategories,
  saveStockItems
} from '../storage'
import StockItemForm, { StockItemFormValues } from '../components/StockItemForm'
import {
  formatStockQuantity,
  getCriticalShortage,
  isCriticalStock,
  isOutOfStock,
  sortCriticalStockFirst
} from '../criticalStock'
import {
  formatExpiryDate,
  formatExpiryQuantity,
  formatExpiryStatusLabel,
  getExpiryStatus,
  getExpiryStatusClass,
  getExpiryWarningDays,
  isExpiryTracked,
  sortLotsFefo
} from '../expiryStock'
import {
  formatStockMoney,
  getStockAverageCost,
  getStockCurrency,
  getStockLastPurchasePrice,
  getStockValueByAverageCost
} from '../stockCost'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import type {
  ApprovedAlternativeMaterialActiveFilter,
  ApprovedAlternativeMaterialApprovalStatus
} from '../approved-alternative-materials/approved-alternative-material.types'

export type StockCardsFocus = 'cards' | 'critical' | 'expiry'
type Props = { currentUser: User; focus?: StockCardsFocus }
type StatusFilter = 'all' | 'active' | 'inactive' | 'critical' | 'out' | 'healthy' | 'expiry' | 'expiry-risk' | 'expired' | 'expiry-risk-or-expired'
type UnitFilter = 'all' | StockUnit
type AlternativeApprovalFilter = ApprovedAlternativeMaterialApprovalStatus | 'all'

const DEFAULT_STOCK_CATEGORY_ID = 'stock_cat_general'
const stockUnits: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
const createId = (prefix: string) => `${prefix}_${Date.now()}`

const getDefaultStatusFilter = (focus: StockCardsFocus): StatusFilter => {
  if(focus === 'critical') return 'critical'
  if(focus === 'expiry') return 'expiry-risk-or-expired'
  return 'all'
}

const formatQuantity = formatStockQuantity

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
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

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const printTableRows = (
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  mode: 'PDF' | 'PRINT'
) => {
  const printWindow = window.open('', '_blank')
  if(!printWindow) return

  const bodyRows = rows.map(row => (
    `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
  )).join('')

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body{font-family:Arial,sans-serif;margin:24px;color:#111827}
          h1{font-size:20px;margin:0 0 12px}
          table{width:100%;border-collapse:collapse;font-size:11px}
          th,td{border:1px solid #d1d5db;padding:7px;text-align:left;vertical-align:top}
          th{background:#f3f4f6}
        </style>
      </head>
      <body>
        <h1>${escapeHtml(mode === 'PDF' ? `${title} PDF` : title)}</h1>
        <table>
          <thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
          <tbody>${bodyRows || `<tr><td colspan="${headers.length}">Kayıt bulunamadı.</td></tr>`}</tbody>
        </table>
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

const getAlternativeApprovalStatusClass = (
  status: ApprovedAlternativeMaterialApprovalStatus
) => {
  if(status === 'APPROVED') return 'success'
  if(status === 'REJECTED') return 'danger-pill'
  return 'warning-pill'
}

const formatLotEventType = (event: StockExpiryEvent) => {
  if(event.eventType === 'lot_created') return 'Oluşturuldu'
  if(event.eventType === 'lot_consumed') return 'Tüketildi'
  if(event.eventType === 'lot_wasted') return 'Kayıp düşüldü'
  if(event.eventType === 'lot_returned') return 'Ters hareketle iade edildi'
  if(event.eventType === 'expired') return 'Tarihi geçti'
  if(event.eventType === 'near_expiry') return 'Geçerlilik yaklaşan uyarısı'
  if(event.eventType === 'allocation_missing') return 'Lot eşleşmesi yok'
  return 'Lot güncellendi'
}

const getConsumptionPercent = (lot: Pick<StockExpiryLot, 'initialQty' | 'remainingQty'>) => {
  if(lot.initialQty <= 0) return 0

  const consumedQty = Math.max(0, lot.initialQty - lot.remainingQty)
  return Math.min(100, Math.round((consumedQty / lot.initialQty) * 100))
}

export default function StockCards({ currentUser, focus = 'cards' }: Props){
  const [items, setItems] = React.useState<StockItem[]>(() => loadStockItems())
  const [categories, setCategories] = React.useState<StockCategory[]>(() => loadStockCategories())
  const [editingItem, setEditingItem] = React.useState<StockItem | null>(null)
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>(() => getDefaultStatusFilter(focus))
  const [unitFilter, setUnitFilter] = React.useState<UnitFilter>('all')
  const [newCategoryName, setNewCategoryName] = React.useState('')
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = React.useState('')
  const [categoryError, setCategoryError] = React.useState('')
  const [permissionError, setPermissionError] = React.useState('')
  const [stockNotice, setStockNotice] = React.useState<{ type: 'success' | 'warning'; text: string } | null>(null)
  const [criticalEvents, setCriticalEvents] = React.useState(() => loadCriticalStockEvents())
  const [expiryLots, setExpiryLots] = React.useState(() => loadStockExpiryLots())
  const [expiryEvents, setExpiryEvents] = React.useState(() => loadStockExpiryEvents())
  const [lotPanelItem, setLotPanelItem] = React.useState<StockItem | null>(null)
  const [alternativePanelItem, setAlternativePanelItem] = React.useState<StockItem | null>(null)
  const [alternativeSearch, setAlternativeSearch] = React.useState('')
  const [alternativeApprovalFilter, setAlternativeApprovalFilter] = React.useState<AlternativeApprovalFilter>('all')
  const [alternativeActiveFilter, setAlternativeActiveFilter] = React.useState<ApprovedAlternativeMaterialActiveFilter>('all')
  const [alternativeSupplierFilter, setAlternativeSupplierFilter] = React.useState('all')
  const previousFocusRef = React.useRef<StockCardsFocus>(focus)

  const canManageStock = currentUser.role === 'Admin'

  React.useEffect(() => {
    if(canManageStock) saveStockItems(items)
  }, [canManageStock, items])

  React.useEffect(() => {
    if(canManageStock) saveStockCategories(categories)
  }, [canManageStock, categories])

  const refreshCriticalEvents = React.useCallback(() => {
    setCriticalEvents(loadCriticalStockEvents())
  }, [])

  const refreshExpiryData = React.useCallback(() => {
    setExpiryLots(loadStockExpiryLots())
    setExpiryEvents(loadStockExpiryEvents())
  }, [])

  const showCriticalNotice = (event?: ReturnType<typeof recordCriticalStockTransition>) => {
    refreshCriticalEvents()
    if(!event){
      setStockNotice(null)
      return
    }

    setStockNotice({
      type: event.eventType === 'entered' ? 'warning' : 'success',
      text: event.eventType === 'entered'
        ? `${event.stockItemName} kritik stok seviyesine düştü.`
        : `${event.stockItemName} kritik stoktan çıktı.`
    })
  }

  React.useEffect(() => {
    if(canManageStock) return
    setEditingItem(null)
    setEditingCategoryId(null)
    setEditingCategoryName('')
  }, [canManageStock])

  React.useEffect(() => {
    if(previousFocusRef.current === focus) return

    previousFocusRef.current = focus
    setSearch('')
    setCategoryFilter('all')
    setStatusFilter(getDefaultStatusFilter(focus))
    setUnitFilter('all')
    setLotPanelItem(null)
    setAlternativePanelItem(null)
    setAlternativeSearch('')
    setAlternativeApprovalFilter('all')
    setAlternativeActiveFilter('all')
    setAlternativeSupplierFilter('all')
  }, [focus])

  const categoryMap = React.useMemo(() => {
    return new Map(categories.map(category => [category.id, category]))
  }, [categories])

  const allExpiryLotsByStockId = React.useMemo(() => {
    return expiryLots.reduce<Record<string, typeof expiryLots>>((acc, lot) => {
      acc[lot.stockItemId] = [...(acc[lot.stockItemId] || []), lot]
      return acc
    }, {})
  }, [expiryLots])

  const expiryLotsByStockId = React.useMemo(() => {
    return expiryLots.reduce<Record<string, typeof expiryLots>>((acc, lot) => {
      if(lot.remainingQty <= 0) return acc
      acc[lot.stockItemId] = [...(acc[lot.stockItemId] || []), lot]
      return acc
    }, {})
  }, [expiryLots])

  const getItemExpirySummary = React.useCallback((item: StockItem) => {
    if(!isExpiryTracked(item)){
      return { tracked: false, status: null as ReturnType<typeof getExpiryStatus> | null, nextLot: null as typeof expiryLots[number] | null, activeLots: [] as typeof expiryLots }
    }

    const activeLots = sortLotsFefo(expiryLotsByStockId[item.id] || [])
    const warningDays = getExpiryWarningDays(item)
    const expiredLot = activeLots.find(lot => getExpiryStatus(lot, warningDays) === 'expired')
    const nearLot = activeLots.find(lot => getExpiryStatus(lot, warningDays) === 'near_expiry')
    const unknownLot = activeLots.find(lot => getExpiryStatus(lot, warningDays) === 'unknown')
    const nextLot = expiredLot || nearLot || activeLots[0] || null
    const status = expiredLot
      ? 'expired'
      : nearLot
        ? 'near_expiry'
        : unknownLot && activeLots.length === 1
          ? 'unknown'
          : activeLots.length > 0
            ? getExpiryStatus(nextLot || activeLots[0], warningDays)
            : 'unknown'

    return { tracked: true, status, nextLot, activeLots }
  }, [expiryLots, expiryLotsByStockId])

  const selectedLotRows = React.useMemo(() => {
    if(!lotPanelItem) return []

    return sortLotsFefo(allExpiryLotsByStockId[lotPanelItem.id] || []).map(lot => ({
      lot,
      status: getExpiryStatus(lot, getExpiryWarningDays(lotPanelItem)),
      events: expiryEvents
        .filter(event => event.lotId === lot.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    }))
  }, [allExpiryLotsByStockId, expiryEvents, lotPanelItem])

  const selectedFefoLots = React.useMemo(() => {
    if(!lotPanelItem) return []

    const warningDays = getExpiryWarningDays(lotPanelItem)
    return sortLotsFefo(selectedLotRows
      .filter(row => {
        if(row.lot.remainingQty <= 0) return false

        const status = getExpiryStatus(row.lot, warningDays)
        return status === 'valid' || status === 'near_expiry' || status === 'unknown'
      })
      .map(row => row.lot))
  }, [lotPanelItem, selectedLotRows])

  const itemCountsByCategory = React.useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item.categoryId] = (acc[item.categoryId] || 0) + 1
      return acc
    }, {})
  }, [items])

  const activeCategories = React.useMemo(() => categories.filter(category => category.active), [categories])

  const selectableCategories = React.useMemo(() => {
    if(!editingItem) return activeCategories

    const currentCategory = categoryMap.get(editingItem.categoryId)
    if(!currentCategory || currentCategory.active) return activeCategories
    return [...activeCategories, currentCategory]
  }, [activeCategories, categoryMap, editingItem])

  const visibleItems = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return items.filter(item => {
      const category = categoryMap.get(item.categoryId)
      const matchesSearch = !normalizedSearch
        || item.name.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (item.description || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (item.sku || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (item.barcode || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (category?.name || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)

      const matchesCategory = categoryFilter === 'all' || item.categoryId === categoryFilter
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && item.active)
        || (statusFilter === 'inactive' && !item.active)
        || (statusFilter === 'critical' && isCriticalStock(item))
        || (statusFilter === 'out' && isOutOfStock(item))
        || (statusFilter === 'healthy' && item.active && !isCriticalStock(item))
        || (statusFilter === 'expiry' && isExpiryTracked(item))
        || (statusFilter === 'expiry-risk' && getItemExpirySummary(item).status === 'near_expiry')
        || (statusFilter === 'expired' && getItemExpirySummary(item).status === 'expired')
        || (statusFilter === 'expiry-risk-or-expired' && ['near_expiry', 'expired'].includes(getItemExpirySummary(item).status || ''))
      const matchesUnit = unitFilter === 'all' || item.unit === unitFilter

      return matchesSearch && matchesCategory && matchesStatus && matchesUnit
    })
  }, [categoryFilter, categoryMap, getItemExpirySummary, items, search, statusFilter, unitFilter])
  const sortedVisibleItems = React.useMemo(() => sortCriticalStockFirst(visibleItems), [visibleItems])

  const activeItemCount = items.filter(item => item.active).length
  const inactiveItemCount = items.length - activeItemCount
  const criticalItemCount = items.filter(isCriticalStock).length
  const outOfStockCount = items.filter(isOutOfStock).length
  const healthyItemCount = items.filter(item => item.active && !isCriticalStock(item)).length
  const expiryTrackedItemCount = items.filter(isExpiryTracked).length
  const today = getLocalDateKey(new Date())
  const todayCriticalEnteredCount = criticalEvents.filter(event => event.eventType === 'entered' && getLocalDateKey(event.timestamp) === today).length
  const todayCriticalResolvedCount = criticalEvents.filter(event => event.eventType === 'resolved' && getLocalDateKey(event.timestamp) === today).length
  const criticalShortageTotal = items.filter(isCriticalStock).reduce((sum, item) => sum + getCriticalShortage(item), 0)
  const criticalAlmostOutCount = items.filter(item => item.active && isCriticalStock(item) && !isOutOfStock(item)).length
  const stockItemById = React.useMemo(() => new Map(items.map(item => [item.id, item])), [items])
  const supplierRecords = React.useMemo(() => loadSupplierManagementRecords(), [])
  const supplierProductRecords = React.useMemo(() => (
    loadSupplierProductRecords(supplierRecords, items)
  ), [items, supplierRecords])
  const approvedAlternativeMaterialContext = React.useMemo(() => ({
    stockItems: items,
    suppliers: supplierRecords,
    supplierProducts: supplierProductRecords
  }), [items, supplierProductRecords, supplierRecords])
  const approvedAlternativeMaterialRecords = React.useMemo(() => (
    ApprovedAlternativeMaterialService.load(approvedAlternativeMaterialContext)
  ), [approvedAlternativeMaterialContext])
  const approvedAlternativeMaterialViews = React.useMemo(() => (
    ApprovedAlternativeMaterialService.buildViews(approvedAlternativeMaterialRecords, approvedAlternativeMaterialContext)
  ), [approvedAlternativeMaterialContext, approvedAlternativeMaterialRecords])
  const alternativeCountByMaterialId = React.useMemo(() => (
    approvedAlternativeMaterialViews.reduce<Record<string, { total: number; usable: number }>>((acc, record) => {
      const current = acc[record.materialId] || { total: 0, usable: 0 }
      acc[record.materialId] = {
        total: current.total + 1,
        usable: current.usable + (record.usable ? 1 : 0)
      }
      return acc
    }, {})
  ), [approvedAlternativeMaterialViews])
  const selectedAlternativeViews = React.useMemo(() => (
    alternativePanelItem
      ? ApprovedAlternativeMaterialService.getForMaterial(
          alternativePanelItem.id,
          approvedAlternativeMaterialRecords,
          approvedAlternativeMaterialContext
        )
      : []
  ), [alternativePanelItem, approvedAlternativeMaterialContext, approvedAlternativeMaterialRecords])
  const alternativeSupplierOptions = React.useMemo(() => {
    const options = new Map<string, string>()
    selectedAlternativeViews.forEach(record => {
      if(!record.preferredSupplierId) return
      options.set(record.preferredSupplierId, record.preferredSupplierName)
    })
    return Array.from(options.entries()).sort((first, second) => first[1].localeCompare(second[1], 'tr-TR'))
  }, [selectedAlternativeViews])
  const filteredAlternativeViews = React.useMemo(() => (
    ApprovedAlternativeMaterialService.filterViews(selectedAlternativeViews, {
      materialId: alternativePanelItem?.id || 'all',
      alternativeMaterialId: 'all',
      approvalStatus: alternativeApprovalFilter,
      active: alternativeActiveFilter,
      supplierId: alternativeSupplierFilter,
      search: alternativeSearch
    })
  ), [
    alternativeActiveFilter,
    alternativeApprovalFilter,
    alternativePanelItem?.id,
    alternativeSearch,
    alternativeSupplierFilter,
    selectedAlternativeViews
  ])
  const activeExpiryLotStatusCounts = React.useMemo(() => {
    return expiryLots.reduce(
      (acc, lot) => {
        if(lot.remainingQty <= 0) return acc

        const item = stockItemById.get(lot.stockItemId)
        if(!item) return acc

        const status = getExpiryStatus(lot, getExpiryWarningDays(item))
        if(status === 'near_expiry'){
          acc.near += 1
          acc.risky += 1
        } else if(status === 'expired'){
          acc.expired += 1
          acc.risky += 1
        } else if(status === 'valid'){
          acc.healthy += 1
        }

        return acc
      },
      { near: 0, expired: 0, risky: 0, healthy: 0 }
    )
  }, [expiryLots, stockItemById])
  const focusMeta = React.useMemo(() => {
    if(focus === 'critical'){
      return {
        title: 'Kritik Stok',
        description: 'Kritik seviyeye inen stok kartlarını takip edin ve eksik miktarları önceliklendirin.',
        listTitle: 'Kritik Stok Listesi',
        emptyText: 'Kritik seviyede stok kartı bulunamadı.'
      }
    }

    if(focus === 'expiry'){
      return {
        title: 'Geçerlilik Yönetimi',
        description: 'Yaklaşan ve geçmiş geçerlilik riski taşıyan lotları stok kartları üzerinden izleyin.',
        listTitle: 'Geçerlilik Risk Listesi',
        emptyText: 'Yaklaşan veya geçmiş geçerlilik riski bulunan lot/stok kartı bulunamadı.'
      }
    }

    return {
      title: 'Stok Kartları',
      description: 'Tüm stok kartlarını oluşturun ve temel stok bilgilerini yönetin.',
      listTitle: 'Stok Listesi',
      emptyText: 'Bu filtrelere uygun stok kartı bulunamadı.'
    }
  }, [focus])

  const exportVisibleStockItems = () => {
    ExcelIntegrationService.exportModuleView({
      moduleKey: 'raw-materials',
      rows: sortedVisibleItems,
      userName: currentUser.fullName || currentUser.username,
      fileNamePrefix: 'hammadde-listesi',
      filterText: search,
      sortLabel: 'Kritik stok oncelikli',
      columns: [
        { key: 'name', header: 'Hammadde', value: item => item.name },
        { key: 'sku', header: 'Stok Kodu', value: item => item.sku || '' },
        { key: 'categoryName', header: 'Kategori', value: item => categoryMap.get(item.categoryId)?.name || '-' },
        { key: 'unit', header: 'Birim', value: item => item.unit },
        { key: 'currentQty', header: 'Mevcut Miktar', type: 'number', value: item => item.currentQty },
        { key: 'minQty', header: 'Kritik Seviye', type: 'number', value: item => item.minQty },
        { key: 'shortage', header: 'Eksik Miktar', type: 'number', value: item => getCriticalShortage(item) },
        { key: 'expiryStatus', header: 'Gecerlilik', value: item => {
          const expirySummary = getItemExpirySummary(item)
          return expirySummary.tracked && expirySummary.status
            ? formatExpiryStatusLabel(expirySummary.status)
            : 'Takip yok'
        } },
        { key: 'alternativeCount', header: 'Onayli Muadil', type: 'number', value: item => alternativeCountByMaterialId[item.id]?.usable || 0 },
        { key: 'status', header: 'Durum', value: item => item.active ? (isCriticalStock(item) ? 'Kritik' : 'Aktif') : 'Pasif' },
        { key: 'stockValue', header: 'Stok Degeri', value: item => formatStockMoney(getStockValueByAverageCost(item), getStockCurrency(item)) }
      ]
    })
  }

  const metricCards = React.useMemo(() => {
    if(focus === 'critical'){
      return [
        { label: 'Kritik Ürün', value: criticalItemCount, detail: `${outOfStockCount} stokta yok` },
        { label: 'Eksik Miktar', value: criticalShortageTotal.toLocaleString('tr-TR', { maximumFractionDigits: 3 }), detail: 'Birim karma toplam' },
        { label: 'Tükenmek Üzere', value: criticalAlmostOutCount, detail: 'Kritik ama stokta var' },
        { label: 'Bugünkü Kritik Sayısı', value: todayCriticalEnteredCount, detail: `${todayCriticalResolvedCount} bugün çözüldü` }
      ]
    }

    if(focus === 'expiry'){
      return [
        { label: 'Yaklaşan Geçerlilik', value: activeExpiryLotStatusCounts.near, detail: 'Uyarı aralığında' },
        { label: 'Geçmiş Geçerlilik', value: activeExpiryLotStatusCounts.expired, detail: 'Müdahale bekler' },
        { label: 'Riskli Lot', value: activeExpiryLotStatusCounts.risky, detail: 'Yaklaşan veya geçmiş' },
        { label: 'Sağlıklı Lot', value: activeExpiryLotStatusCounts.healthy, detail: 'Aktif geçerli lot' }
      ]
    }

    return [
      { label: 'Toplam Kart', value: items.length, detail: `${inactiveItemCount} pasif kart` },
      { label: 'Aktif Kart', value: activeItemCount, detail: `${healthyItemCount} sağlıklı stok` },
      { label: 'Geçerlilik Takibi', value: expiryTrackedItemCount, detail: 'Lot bazlı izlenir' },
      { label: 'Stok Riski', value: criticalItemCount, detail: `${outOfStockCount} stokta yok` },
      {
        label: 'Onaylı Muadil',
        value: approvedAlternativeMaterialViews.filter(record => record.usable).length,
        detail: `${approvedAlternativeMaterialViews.length} eşleşme`
      }
    ]
  }, [
    activeExpiryLotStatusCounts,
    activeItemCount,
    approvedAlternativeMaterialViews,
    criticalAlmostOutCount,
    criticalItemCount,
    criticalShortageTotal,
    expiryTrackedItemCount,
    focus,
    healthyItemCount,
    inactiveItemCount,
    items.length,
    outOfStockCount,
    todayCriticalEnteredCount,
    todayCriticalResolvedCount
  ])

  const assertCanManageStock = () => {
    if(canManageStock){
      setPermissionError('')
      return true
    }

    setPermissionError('Bu işlem için Admin yetkisi gereklidir.')
    return false
  }

  const saveItem = (values: StockItemFormValues) => {
    if(!assertCanManageStock()) return

    const now = new Date().toISOString()

    if(editingItem){
      const costChanged = editingItem.unitPurchasePrice !== values.unitPurchasePrice || getStockCurrency(editingItem) !== values.currency
      const updatedItem = {
        ...editingItem,
        ...values,
        currentQty: editingItem.currentQty,
        lastCostUpdatedAt: costChanged ? now : editingItem.lastCostUpdatedAt,
        updatedAt: now
      }
      const nextItems = items.map(item => item.id === editingItem.id ? updatedItem : item)
      saveStockItems(nextItems)
      setItems(nextItems)
      const criticalEvent = recordCriticalStockTransition({
        before: editingItem,
        after: updatedItem,
        user: currentUser,
        trigger: 'Stok Kartı Güncelleme',
        note: 'Stok kartı bilgileri güncellendi.'
      })

      addActionLog({
        operationType: 'Stok kartı güncellendi',
        user: currentUser,
        description: `${editingItem.name} stok kartı güncellendi. Yeni ad: ${values.name}.`
      })
      if(costChanged){
        addActionLog({
          operationType: 'Maliyet güncellendi',
          user: currentUser,
          description: `${updatedItem.name} stok kartı maliyet bilgisi güncellendi. Birim alış fiyatı: ${formatStockMoney(values.unitPurchasePrice || 0, values.currency)}. Para birimi: ${values.currency}.`
        })
      }
      setEditingItem(null)
      showCriticalNotice(criticalEvent)
      return
    }

    const item: StockItem = {
      id: createId('stock'),
      branchId: getActiveBranchId(),
      ...values,
      currentQty: 0,
      lastCostUpdatedAt: values.unitPurchasePrice !== undefined ? now : undefined,
      createdAt: now,
      updatedAt: now
    }

    const nextItems = [item, ...items]
    saveStockItems(nextItems)

    recordCriticalStockTransition({
      after: item,
      user: currentUser,
      trigger: 'Stok Kartı Oluşturma',
      note: 'Stok kartı oluşturuldu.'
    })

    setItems(nextItems)
    refreshExpiryData()
    addActionLog({
      operationType: 'Stok kartı oluşturuldu',
      user: currentUser,
      description: `${item.name} stok kartı oluşturuldu. Kritik seviye: ${formatQuantity(item.minQty, item.unit)}. Stok miktarı ve geçerlilik girişleri Stok Hareketleri ekranından yapılır.`
    })
    if(item.unitPurchasePrice !== undefined){
      addActionLog({
        operationType: 'Maliyet güncellendi',
        user: currentUser,
        description: `${item.name} stok kartı için birim alış fiyatı ${formatStockMoney(item.unitPurchasePrice, item.currency)} olarak tanımlandı.`
      })
    }
    refreshCriticalEvents()
    setStockNotice({
      type: 'success',
      text: 'Stok kartı oluşturuldu. İlk stok girişinizi Stok Hareketleri ekranından yapabilirsiniz.'
    })
  }

  const startEditItem = (item: StockItem) => {
    if(!assertCanManageStock()) return
    setEditingItem(item)
  }

  const deleteItem = (itemId: string) => {
    if(!assertCanManageStock()) return

    const item = items.find(stockItem => stockItem.id === itemId)
    if(!item) return

    if(loadStockMovements().some(movement => movement.stockItemId === itemId)){
      setPermissionError('Hareket geçmişi olan stok kartı silinemez. Kartı pasif yapabilirsiniz.')
      return
    }

    if(!confirm(`${item.name} stok kartı silinecek. Emin misiniz?`)) return

    setItems(prev => prev.filter(stockItem => stockItem.id !== itemId))
    if(editingItem?.id === itemId) setEditingItem(null)
    addActionLog({
      operationType: 'Stok kartı silindi',
      user: currentUser,
      description: `${item.name} stok kartı silindi.`
    })
  }

  const toggleItemStatus = (itemId: string) => {
    if(!assertCanManageStock()) return

    const item = items.find(stockItem => stockItem.id === itemId)
    if(!item) return

    const nextItem = { ...item, active: !item.active, updatedAt: new Date().toISOString() }
    setItems(prev => prev.map(stockItem => stockItem.id === itemId ? nextItem : stockItem))

    addActionLog({
      operationType: item.active ? 'Stok kartı pasif yapıldı' : 'Stok kartı aktif yapıldı',
      user: currentUser,
      description: `${item.name} stok kartı ${item.active ? 'pasif' : 'aktif'} yapıldı.`
    })
    showCriticalNotice(recordCriticalStockTransition({
      before: item,
      after: nextItem,
      user: currentUser,
      trigger: item.active ? 'Stok Kartı Pasifleştirme' : 'Stok Kartı Aktifleştirme',
      note: `${item.name} stok kartı ${item.active ? 'pasif' : 'aktif'} yapıldı.`
    }))
  }

  const addCategory = (event: React.FormEvent) => {
    event.preventDefault()

    if(!assertCanManageStock()) return

    const name = newCategoryName.trim()

    if(!name){
      setCategoryError('Kategori adı zorunludur.')
      return
    }

    if(categories.some(category => category.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))){
      setCategoryError('Bu kategori zaten mevcut.')
      return
    }

    const category: StockCategory = {
      id: createId('stock_cat'),
      name,
      active: true,
      createdAt: new Date().toISOString()
    }

    setCategories(prev => [category, ...prev])
    setNewCategoryName('')
    setCategoryError('')
    addActionLog({
      operationType: 'Stok kategorisi oluşturuldu',
      user: currentUser,
      description: `${category.name} stok kategorisi oluşturuldu.`
    })
  }

  const startEditCategory = (category: StockCategory) => {
    if(!assertCanManageStock()) return

    setEditingCategoryId(category.id)
    setEditingCategoryName(category.name)
    setCategoryError('')
  }

  const saveCategoryName = (event: React.FormEvent) => {
    event.preventDefault()

    if(!assertCanManageStock()) return

    const name = editingCategoryName.trim()

    if(!editingCategoryId || !name){
      setCategoryError('Kategori adı zorunludur.')
      return
    }

    if(categories.some(category =>
      category.id !== editingCategoryId
      && category.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR')
    )){
      setCategoryError('Bu kategori zaten mevcut.')
      return
    }

    const oldCategory = categories.find(category => category.id === editingCategoryId)
    setCategories(prev => prev.map(category => category.id === editingCategoryId
      ? { ...category, name, updatedAt: new Date().toISOString() }
      : category
    ))
    setEditingCategoryId(null)
    setEditingCategoryName('')
    setCategoryError('')

    if(oldCategory){
      addActionLog({
        operationType: 'Stok kategorisi güncellendi',
        user: currentUser,
        description: `${oldCategory.name} stok kategorisi ${name} olarak güncellendi.`
      })
    }
  }

  const toggleCategory = (categoryId: string) => {
    if(!assertCanManageStock()) return
    if(categoryId === DEFAULT_STOCK_CATEGORY_ID) return

    const category = categories.find(item => item.id === categoryId)
    setCategories(prev => prev.map(item => item.id === categoryId
      ? { ...item, active: !item.active, updatedAt: new Date().toISOString() }
      : item
    ))

    if(category){
      addActionLog({
        operationType: category.active ? 'Stok kategorisi pasif yapıldı' : 'Stok kategorisi aktif yapıldı',
        user: currentUser,
        description: `${category.name} stok kategorisi ${category.active ? 'pasif' : 'aktif'} yapıldı.`
      })
    }
  }

  const resetAlternativeFilters = () => {
    setAlternativeSearch('')
    setAlternativeApprovalFilter('all')
    setAlternativeActiveFilter('all')
    setAlternativeSupplierFilter('all')
  }

  const closeAlternativePanel = () => {
    setAlternativePanelItem(null)
    resetAlternativeFilters()
  }

  const exportApprovedAlternativeExcel = () => {
    if(!alternativePanelItem) return

    const rows = ApprovedAlternativeMaterialService.getRows(filteredAlternativeViews)
    ExcelIntegrationService.exportMatrix({
      moduleKey: 'raw-materials',
      sheetName: 'Onayli Muadiller',
      fileNamePrefix: `${alternativePanelItem.name}-onayli-muadiller`,
      headers: ApprovedAlternativeMaterialService.exportHeaders,
      rows,
      userName: currentUser.fullName || currentUser.username
    })
  }

  const printApprovedAlternativeRows = (mode: 'PDF' | 'PRINT') => {
    if(!alternativePanelItem) return

    printTableRows(
      `${alternativePanelItem.name} Onaylı Muadil Ürünler`,
      ApprovedAlternativeMaterialService.exportHeaders,
      ApprovedAlternativeMaterialService.getRows(filteredAlternativeViews),
      mode
    )
  }

  if(!canManageStock){
    return (
      <div className="stock-page">
        <section className="card">
          <h2>Yetkisiz Erişim</h2>
          <p className="muted">Stok kartları ekranını sadece Yönetici rolündeki kullanıcılar görebilir.</p>
        </section>
      </div>
    )
  }

  return (
    <div className={`stock-page stock-cards-page ${focus}-focus`}>
      <div className="page-title">
        <div>
          <h2>{focusMeta.title}</h2>
          <p className="muted">{focusMeta.description}</p>
        </div>
      </div>

      {permissionError && <div className="form-error">{permissionError}</div>}
      {stockNotice && <div className={`settings-message ${stockNotice.type}`}>{stockNotice.text}</div>}

      <div className="metric-grid">
        {metricCards.map(card => (
          <div className="metric-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            {card.detail && <p className="muted">{card.detail}</p>}
          </div>
        ))}
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>{focusMeta.listTitle}</h3>
              <p className="muted">{visibleItems.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls stock-toolbar-controls">
              <button className="btn" type="button" onClick={exportVisibleStockItems}>Excel'e Aktar</button>
              <input
                type="search"
                placeholder="Stok adı, kod, barkod veya kategori ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
                <option value="all">Tüm kategoriler</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="active">Aktif kartlar</option>
                <option value="critical">Kritik stok</option>
                <option value="out">Stokta yok</option>
                <option value="healthy">Sağlıklı stok</option>
                <option value="expiry">Geçerlilik takipli</option>
                <option value="expiry-risk">Geçerlilik yaklaşan</option>
                <option value="expired">Geçerlilik tarihi geçmiş</option>
                <option value="expiry-risk-or-expired">Yaklaşan veya geçmiş geçerlilik</option>
                <option value="inactive">Pasif kartlar</option>
                <option value="all">Tüm durumlar</option>
              </select>
              <select value={unitFilter} onChange={event => setUnitFilter(event.target.value as UnitFilter)}>
                <option value="all">Tüm birimler</option>
                {stockUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table stock-cards-table">
              <thead>
                <tr>
                  <th>Stok Kartı</th>
                  <th>Kategori</th>
                  <th>Birim</th>
                  <th>Kritik</th>
                  <th>Eksik</th>
                  <th>Geçerlilik</th>
                  <th>Durum</th>
                  <th>Muadil</th>
                  <th>Maliyet Bilgileri</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 && (
                  <tr>
                    <td colSpan={10} className="empty-cell">{focusMeta.emptyText}</td>
                  </tr>
                )}
                {sortedVisibleItems.map(item => {
                  const category = categoryMap.get(item.categoryId)
                  const critical = isCriticalStock(item)
                  const shortage = getCriticalShortage(item)
                  const expirySummary = getItemExpirySummary(item)
                  const alternativeCounts = alternativeCountByMaterialId[item.id] || { total: 0, usable: 0 }

                  return (
                    <tr key={item.id} className={critical ? 'critical-stock-table-row' : undefined}>
                      <td>
                        <strong>{item.name}</strong>
                        {(item.sku || item.barcode || item.description) && (
                          <div className="muted small-text">
                            {[item.sku && `Kod: ${item.sku}`, item.barcode && `Barkod: ${item.barcode}`, item.description]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}
                      </td>
                      <td>{category?.name || 'Kategori yok'}</td>
                      <td>{item.unit}</td>
                      <td>{formatQuantity(item.minQty, item.unit)}</td>
                      <td>{shortage > 0 ? formatQuantity(shortage, item.unit) : critical ? 'Eşik seviyesinde' : '-'}</td>
                      <td>
                        {!expirySummary.tracked ? (
                          <span className="status-pill muted-pill">Kapalı</span>
                        ) : (
                          <>
                            <span className={`status-pill ${getExpiryStatusClass(expirySummary.status || 'unknown')}`}>
                              {formatExpiryStatusLabel(expirySummary.status || 'unknown')}
                            </span>
                            <div className="muted small-text">
                              {expirySummary.nextLot
                                ? `${formatExpiryDate(expirySummary.nextLot.expiryDate)} · ${formatQuantity(expirySummary.nextLot.remainingQty, item.unit)}`
                                : 'Lot kaydı yok'}
                            </div>
                          </>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${alternativeCounts.usable > 0 ? 'success' : alternativeCounts.total > 0 ? 'warning-pill' : 'muted-pill'}`}>
                          {alternativeCounts.usable > 0 ? `${alternativeCounts.usable} onaylı` : alternativeCounts.total > 0 ? `${alternativeCounts.total} kayıt` : 'Yok'}
                        </span>
                        {alternativeCounts.total > alternativeCounts.usable && (
                          <div className="muted small-text">{alternativeCounts.total - alternativeCounts.usable} önerilemez</div>
                        )}
                      </td>
                      <td>
                        {!item.active ? (
                          <span className="status-pill muted-pill">Pasif</span>
                        ) : critical ? (
                          <span className="status-pill danger-pill">Kritik</span>
                        ) : (
                          <span className="status-pill success">Aktif</span>
                        )}
                      </td>
                      <td>
                        <div className="stock-cost-summary">
                          <span>Son alış: {formatStockMoney(getStockLastPurchasePrice(item), getStockCurrency(item))}</span>
                          <span>Ortalama: {formatStockMoney(getStockAverageCost(item), getStockCurrency(item))}</span>
                          <strong>Stok değeri: {formatStockMoney(getStockValueByAverageCost(item), getStockCurrency(item))}</strong>
                        </div>
                      </td>
                      <td className="actions-cell">
                        <button className="btn" onClick={() => setAlternativePanelItem(item)}>Muadiller</button>
                        <button className={`btn ${item.tracksExpiry ? 'lot-view-btn' : ''}`} onClick={() => setLotPanelItem(item)}>Lotları Gör</button>
                        <button className="btn" onClick={() => startEditItem(item)}>Düzenle</button>
                        <button className="btn" onClick={() => toggleItemStatus(item.id)}>
                          {item.active ? 'Pasif Yap' : 'Aktif Yap'}
                        </button>
                        <button className="btn" onClick={() => deleteItem(item.id)}>Sil</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side">
          <section className="card">
            <div className="section-header compact">
              <h3>{editingItem ? 'Stok Kartı Düzenle' : 'Yeni Stok Kartı'}</h3>
              {editingItem && <span className="status-pill">Düzenleme</span>}
            </div>
            <StockItemForm
              categories={selectableCategories}
              item={editingItem}
              onSave={saveItem}
              onCancel={editingItem ? () => setEditingItem(null) : undefined}
            />
          </section>

          <section className="card">
            <div className="section-header compact">
              <h3>Stok Kategorileri</h3>
            </div>
            <form onSubmit={addCategory} className="inline-form">
              <input
                placeholder="Yeni kategori adı"
                value={newCategoryName}
                onChange={event => setNewCategoryName(event.target.value)}
              />
              <button className="btn primary" type="submit">Ekle</button>
            </form>
            {categoryError && <div className="form-error">{categoryError}</div>}

            <div className="category-list">
              {categories.map(category => (
                <div className="category-row" key={category.id}>
                  {editingCategoryId === category.id ? (
                    <form onSubmit={saveCategoryName} className="category-edit-form">
                      <input value={editingCategoryName} onChange={event => setEditingCategoryName(event.target.value)} />
                      <button className="btn primary" type="submit">Kaydet</button>
                      <button className="btn" type="button" onClick={() => setEditingCategoryId(null)}>İptal</button>
                    </form>
                  ) : (
                    <>
                      <div>
                        <strong>{category.name}</strong>
                        <div className="muted small-text">{itemCountsByCategory[category.id] || 0} stok kartı</div>
                      </div>
                      <span className={`status-pill ${category.active ? 'success' : 'muted-pill'}`}>
                        {category.active ? 'Aktif' : 'Pasif'}
                      </span>
                      <div className="row-actions">
                        <button className="btn" onClick={() => startEditCategory(category)}>Düzenle</button>
                        <button className="btn" disabled={category.id === DEFAULT_STOCK_CATEGORY_ID} onClick={() => toggleCategory(category.id)}>
                          {category.active ? 'Pasif Yap' : 'Aktif Yap'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {lotPanelItem && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${lotPanelItem.name} lotları`}>
          <div className="stock-lot-modal">
            <div className="section-header">
              <div>
                <h3>{lotPanelItem.name} Lotları</h3>
                <p className="muted">
                  FEFO tüketim önceliği, kalan miktarlar ve lot bazlı işlem geçmişi.
                </p>
              </div>
              <button className="btn" type="button" onClick={() => setLotPanelItem(null)}>Kapat</button>
            </div>

            <div className="metric-grid report-metric-grid">
              <div className="metric-card">
                <span>Toplam Lot</span>
                <strong>{selectedLotRows.length}</strong>
                <p className="muted">{lotPanelItem.tracksExpiry ? 'Geçerlilik takibi aktif' : 'Geçerlilik takibi kapalı'}</p>
              </div>
              <div className="metric-card">
                <span>FEFO Adayı</span>
                <strong>{selectedFefoLots.length}</strong>
                <p className="muted">Tüketilebilir kalan lot</p>
              </div>
              <div className="metric-card">
                <span>Toplam Kalan</span>
                <strong>{formatExpiryQuantity(selectedLotRows.reduce((sum, row) => sum + row.lot.remainingQty, 0), lotPanelItem.unit)}</strong>
                <p className="muted">Lot bakiyeleri toplamı</p>
              </div>
            </div>

            <section className="lot-panel-section">
              <div className="section-header compact">
                <h4>FEFO Tüketim Önceliği</h4>
                <span className="status-pill">En yakın geçerlilik önce</span>
              </div>
              <div className="lot-priority-list">
                {selectedFefoLots.length === 0 && <div className="empty-state">Tüketilebilir FEFO lotu bulunmuyor.</div>}
                {selectedFefoLots.map((lot, index) => (
                  <div className="lot-priority-row" key={lot.id}>
                    <div>
                      <strong>{index + 1}. Öncelikli Lot</strong>
                      <span>{lot.lotCode}</span>
                    </div>
                    <div>
                      <span>Geçerlilik</span>
                      <strong>{formatExpiryDate(lot.expiryDate)}</strong>
                    </div>
                    <div>
                      <span>Kalan</span>
                      <strong>{formatExpiryQuantity(lot.remainingQty, lot.unit)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="lot-panel-section">
              <div className="section-header compact">
                <h4>Lot Listesi</h4>
                <span className="status-pill">{selectedLotRows.length} lot</span>
              </div>
              <div className="table-wrap">
                <table className="data-table report-table">
                  <thead>
                    <tr>
                      <th>Lot No</th>
                      <th>Geçerlilik</th>
                      <th>Oluşturulma Tarihi</th>
                      <th>İlk Giriş Miktarı</th>
                      <th>Kalan Miktar</th>
                      <th>Tüketim</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLotRows.length === 0 && <tr><td colSpan={7} className="empty-cell">Bu stok kartı için lot kaydı yok.</td></tr>}
                    {selectedLotRows.map(({ lot, status }) => (
                      <tr key={lot.id}>
                        <td>
                          <strong>{lot.lotCode}</strong>
                          {(lot.supplierName || lot.invoiceNo) && (
                            <div className="muted small-text">
                              {[lot.supplierName && `Tedarikçi: ${lot.supplierName}`, lot.invoiceNo && `Fatura: ${lot.invoiceNo}`].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </td>
                        <td>{formatExpiryDate(lot.expiryDate)}</td>
                        <td>{formatDateTime(lot.createdAt)}</td>
                        <td>{formatExpiryQuantity(lot.initialQty, lot.unit)}</td>
                        <td>{formatExpiryQuantity(lot.remainingQty, lot.unit)}</td>
                        <td>
                          <strong>%{getConsumptionPercent(lot)}</strong>
                          <div className="lot-consumption-bar" aria-label="Tüketim yüzdesi">
                            <span style={{ width: `${getConsumptionPercent(lot)}%` }} />
                          </div>
                        </td>
                        <td><span className={`status-pill ${getExpiryStatusClass(status)}`}>{formatExpiryStatusLabel(status)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="lot-panel-section">
              <div className="section-header compact">
                <h4>Lot Hareket Geçmişi</h4>
              </div>
              <div className="lot-event-list">
                {selectedLotRows.length === 0 && <div className="empty-state">Lot hareket geçmişi yok.</div>}
                {selectedLotRows.map(({ lot, events }) => (
                  <details className="history-card lot-history-card" key={lot.id}>
                    <summary>
                      <span>
                        <strong>{lot.lotCode}</strong>
                        <small>{formatExpiryDate(lot.expiryDate)} · Kalan {formatExpiryQuantity(lot.remainingQty, lot.unit)}</small>
                      </span>
                      <span className="history-summary-values">
                        <strong>{events.length}</strong>
                        <small>olay</small>
                      </span>
                    </summary>
                    <div className="lot-event-rows">
                      {events.length === 0 && <div className="empty-state">Bu lot için olay kaydı yok.</div>}
                      {events.map(event => (
                        <div className="lot-event-row" key={event.id}>
                          <div>
                            <strong>{formatLotEventType(event)}</strong>
                            <span>{formatDateTime(event.timestamp)} · {event.trigger}</span>
                          </div>
                          <div>
                            <strong>{event.qty !== undefined ? formatExpiryQuantity(event.qty, event.unit) : '-'}</strong>
                            {event.note && <span>{event.note}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
      {alternativePanelItem && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${alternativePanelItem.name} onaylı muadil ürünleri`}>
          <div className="stock-lot-modal approved-alternative-modal">
            <div className="section-header">
              <div>
                <h3>{alternativePanelItem.name} Onaylı Muadil Ürünler</h3>
                <p className="muted">
                  Kalite onayı olmayan, pasif veya süresi dolmuş muadiller öneri listesine alınmaz.
                </p>
              </div>
              <button className="btn" type="button" onClick={closeAlternativePanel}>Kapat</button>
            </div>

            <div className="metric-grid report-metric-grid">
              <div className="metric-card">
                <span>Toplam Muadil</span>
                <strong>{selectedAlternativeViews.length}</strong>
                <p className="muted">Master data eşleşmesi</p>
              </div>
              <div className="metric-card">
                <span>Önerilebilir</span>
                <strong>{selectedAlternativeViews.filter(record => record.usable).length}</strong>
                <p className="muted">Aktif, onaylı ve geçerli</p>
              </div>
              <div className="metric-card">
                <span>Kalite Onayı Bekleyen</span>
                <strong>{selectedAlternativeViews.filter(record => record.approvalStatus === 'PENDING').length}</strong>
                <p className="muted">Otomatik önerilmez</p>
              </div>
              <div className="metric-card">
                <span>Süresi Dolan</span>
                <strong>{selectedAlternativeViews.filter(record => record.expired).length}</strong>
                <p className="muted">Yeniden kalite onayı gerekir</p>
              </div>
            </div>

            <section className="lot-panel-section approved-alternative-section">
              <div className="section-header compact">
                <h4>Filtreler ve Çıktılar</h4>
                <span className="status-pill">{filteredAlternativeViews.length} kayıt</span>
              </div>
              <div className="approved-alternative-toolbar">
                <input
                  type="search"
                  placeholder="Muadil, tedarikçi, sebep veya not ara"
                  value={alternativeSearch}
                  onChange={event => setAlternativeSearch(event.target.value)}
                />
                <select value={alternativeApprovalFilter} onChange={event => setAlternativeApprovalFilter(event.target.value as AlternativeApprovalFilter)}>
                  <option value="all">Tüm onay durumları</option>
                  {ApprovedAlternativeMaterialService.statuses.map(status => (
                    <option key={status} value={status}>{APPROVED_ALTERNATIVE_MATERIAL_STATUS_LABELS[status]}</option>
                  ))}
                </select>
                <select value={alternativeActiveFilter} onChange={event => setAlternativeActiveFilter(event.target.value as ApprovedAlternativeMaterialActiveFilter)}>
                  <option value="all">Aktif/Pasif</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Pasif</option>
                </select>
                <select value={alternativeSupplierFilter} onChange={event => setAlternativeSupplierFilter(event.target.value)}>
                  <option value="all">Tüm tedarikçiler</option>
                  {alternativeSupplierOptions.map(([supplierId, supplierName]) => (
                    <option key={supplierId} value={supplierId}>{supplierName}</option>
                  ))}
                </select>
                <button className="btn" type="button" onClick={resetAlternativeFilters}>Reset</button>
                <button className="btn" type="button" onClick={exportApprovedAlternativeExcel}>Excel</button>
                <button className="btn" type="button" onClick={() => printApprovedAlternativeRows('PDF')}>PDF</button>
                <button className="btn" type="button" onClick={() => printApprovedAlternativeRows('PRINT')}>Yazdır</button>
              </div>
            </section>

            <section className="lot-panel-section">
              <div className="table-wrap approved-alternative-table-wrap">
                <table className="data-table approved-alternative-table">
                  <thead>
                    <tr>
                      <th>Muadil Ürün</th>
                      <th>Öncelik</th>
                      <th>Onay Durumu</th>
                      <th>Kalite Onayı</th>
                      <th>Son Kullanım</th>
                      <th>Tedarikçi</th>
                      <th>Fiyat</th>
                      <th>Öneri Durumu</th>
                      <th>Notlar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlternativeViews.length === 0 && (
                      <tr><td colSpan={9} className="empty-cell">Bu filtrelere uygun muadil ürün bulunamadı.</td></tr>
                    )}
                    {filteredAlternativeViews.map(record => (
                      <tr key={record.id}>
                        <td>
                          <strong>{record.alternativeMaterialName}</strong>
                          <span className="muted small-text">{record.alternativeMaterialCode}</span>
                        </td>
                        <td>{record.priority}</td>
                        <td>
                          <span className={`status-pill ${getAlternativeApprovalStatusClass(record.approvalStatus)}`}>
                            {APPROVED_ALTERNATIVE_MATERIAL_STATUS_LABELS[record.approvalStatus]}
                          </span>
                        </td>
                        <td>
                          <strong>{record.qualityApprovedBy || '-'}</strong>
                          <span className="muted small-text">{ApprovedAlternativeMaterialService.formatDate(record.approvalDate)}</span>
                        </td>
                        <td>
                          <strong>{ApprovedAlternativeMaterialService.formatDate(record.expireDate)}</strong>
                          {record.expired && <span className="status-pill danger-pill">Süresi Doldu</span>}
                        </td>
                        <td>
                          <strong>{record.preferredSupplierName}</strong>
                          <span className="muted small-text">Son alım {ApprovedAlternativeMaterialService.formatDate(record.lastPurchaseDate)}</span>
                        </td>
                        <td>
                          <strong>{ApprovedAlternativeMaterialService.formatCurrency(record.lastPrice, record.currency)}</strong>
                          <span className="muted small-text">Ort. {ApprovedAlternativeMaterialService.formatCurrency(record.averagePrice, record.currency)}</span>
                        </td>
                        <td>
                          <span className={`status-pill ${record.usable ? 'success' : 'muted-pill'}`}>
                            {record.usable ? 'Önerilebilir' : record.unusableReason}
                          </span>
                        </td>
                        <td>
                          <strong>{record.reason}</strong>
                          <span className="muted small-text">{record.notes || '-'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
