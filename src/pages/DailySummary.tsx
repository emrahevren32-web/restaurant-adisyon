import React from 'react'
import {
  DashboardExperienceHeader
} from '../components/DashboardExperience'
import { AppIcon } from '../design-system/IconSystem'
import { Meter, Sparkline, TrendChart } from '../design-system/Charts'
import {
  addDashboardWidget,
  DASHBOARD_WIDGET_LAYOUT_EVENT,
  getDashboardWidgetContainer,
  removeDashboardWidget,
  setDashboardWidgetVisibility
} from '../dashboard/dashboard-widget.service'
import type {
  DashboardWidgetCatalogItem,
  DashboardWidgetContainer,
  DashboardWidgetViewModel
} from '../dashboard/dashboard-widget.types'
import {
  WORKSPACE_TEMPLATE_ACTION_TYPES,
  WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS,
  type WorkspaceTemplateEmptyState,
  type WorkspaceTemplateQuickAction
} from '../workspace-template/workspace-template.types'
import { WORKSPACE_PROVISIONING_EVENT } from '../workspace-provisioning/workspace-provisioning.service'
import {
  getManagedWorkspaceModulesForUser,
  WORKSPACE_MODULE_LIFECYCLE_EVENT
} from '../workspace/workspace-module-lifecycle.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { KpiSourceData, KpiTone } from '../kpi-reporting/kpi.types'
import { formatNumber, formatPercent, averageBy, percent } from '../kpi-reporting/kpi.utils'
import type { AppIconName } from '../design-system/AppIcons'
import type { User } from '../types'

type Props = {
  currentUser: User
  onOpenMarketplace: () => void
  onOpenWorkspaceSettings?: () => void
}

const DAY_MS = 24 * 60 * 60 * 1000

const normalizeSearchText = (value: unknown) => String(value || '').trim().toLocaleLowerCase('tr-TR')

const clampValue = (value: number, min = 0, max = Number.MAX_SAFE_INTEGER) => (
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))
)

const toDateKey = (value?: string | Date) => {
  if(!value) return ''
  if(typeof value === 'string'){
    const trimmed = value.trim()
    if(!trimmed) return ''
    if(/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  }
  const date = typeof value === 'string' ? new Date(value) : value
  if(Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('sv-SE')
}

const parseSafeDate = (value?: string | Date) => {
  if(!value) return null
  if(typeof value === 'string'){
    const trimmed = value.trim()
    if(!trimmed) return null
    const date = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? new Date(`${trimmed}T12:00:00`)
      : new Date(trimmed)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return Number.isNaN(value.getTime()) ? null : value
}

const formatDate = (value?: string | Date) => {
  const dateKey = toDateKey(value)
  if(!dateKey) return '-'
  const date = new Date(`${dateKey}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const formatTime = (value?: string | Date) => {
  const date = parseSafeDate(value)
  return date ? date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'
}

const getDaysUntil = (value: string | Date | undefined, todayKey: string) => {
  const dateKey = toDateKey(value)
  if(!dateKey) return Number.POSITIVE_INFINITY
  const date = new Date(`${dateKey}T12:00:00`)
  const today = new Date(`${todayKey}T12:00:00`)
  if(Number.isNaN(date.getTime()) || Number.isNaN(today.getTime())) return Number.POSITIVE_INFINITY
  return Math.round((date.getTime() - today.getTime()) / DAY_MS)
}

const isSameDateKey = (value: string | Date | undefined, dateKey: string) => toDateKey(value) === dateKey

const isProductionDone = (status: string) => {
  const text = normalizeSearchText(status)
  return text.includes('tamam') || text.includes('sevkiyata hazır') || text.includes('sevkiyata hazir')
}

const isProductionCancelled = (status: string) => normalizeSearchText(status).includes('iptal')

const isShipmentDone = (status: string) => status === 'DELIVERED' || status === 'SHIPPED'

const isShipmentCancelled = (status: string) => status === 'CANCELLED'

const isPurchaseClosed = (status: string) => (
  status === 'REJECTED' || status === 'CANCELLED' || status === 'PURCHASE_ORDER_CREATED'
)

const toGaugeTone = (value: number, warning: number, success: number): KpiTone => {
  if(value >= success) return 'success'
  if(value >= warning) return 'warning'
  return 'danger'
}

type SummaryKpi = {
  id: string
  label: string
  value: string
  detail: string
  tone: KpiTone
  icon: AppIconName
  /** 14-day daily counts — the sparkline in the tile. */
  trend?: number[]
}

type GaugeMetric = {
  id: string
  label: string
  value: number
  detail: string
  tone: KpiTone
}

type AttentionItem = {
  id: string
  category: string
  title: string
  detail: string
  severity: 'critical' | 'high' | 'medium'
}

type ActivityRow = {
  id: string
  time: string
  action: string
  module: string
  detail: string
  status: string
  tone: KpiTone
}

type DailySeries = {
  labels: string[]
  production: number[]
  shipment: number[]
  purchase: number[]
}

type OperationsOverview = {
  todayKey: string
  series: DailySeries
  kpis: SummaryKpi[]
  gauges: GaugeMetric[]
  attention: AttentionItem[]
  activity: ActivityRow[]
  production: {
    efficiency: number
    activeLineCount: number
    totalLineCount: number
    openOrders: Array<{ id: string; title: string; detail: string; date: string }>
  }
  stock: {
    criticalCount: number
    totalCount: number
    items: Array<{ id: string; name: string; detail: string }>
    openPurchaseCount: number
    urgentPurchaseCount: number
  }
}

const DAILY_SERIES_LENGTH = 14

/** Bucket records into the last N days by their own timestamp — no synthetic data. */
const buildDailyCounts = <T,>(
  records: T[],
  getDate: (record: T) => string | undefined,
  days = DAILY_SERIES_LENGTH
) => {
  const buckets = new Map<string, number>()
  const keys: string[] = []
  const today = new Date()

  for(let offset = days - 1; offset >= 0; offset -= 1){
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    const key = toDateKey(date)
    keys.push(key)
    buckets.set(key, 0)
  }

  records.forEach(record => {
    const key = toDateKey(getDate(record))
    if(!key || !buckets.has(key)) return
    buckets.set(key, (buckets.get(key) || 0) + 1)
  })

  return { keys, values: keys.map(key => buckets.get(key) || 0) }
}

const formatDayLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? dateKey
    : date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
}

const buildOperationsOverview = (sourceData: KpiSourceData): OperationsOverview => {
  const todayKey = toDateKey(new Date())

  const productionSeries = buildDailyCounts(
    sourceData.productionOrders,
    order => order.createdAt || order.updatedAt
  )
  const shipmentSeries = buildDailyCounts(
    sourceData.shipments,
    shipment => shipment.createdAt || shipment.shipmentDate || shipment.updatedAt
  )
  const purchaseSeries = buildDailyCounts(
    sourceData.purchaseRequests,
    request => request.createdAt || request.requestDate || request.updatedAt
  )
  const series: DailySeries = {
    labels: productionSeries.keys.map(formatDayLabel),
    production: productionSeries.values,
    shipment: shipmentSeries.values,
    purchase: purchaseSeries.values
  }

  const activeProductionOrders = sourceData.productionOrders.filter(order => !isProductionDone(order.status) && !isProductionCancelled(order.status))
  const overdueProductionOrders = activeProductionOrders.filter(order => getDaysUntil(order.deliveryDate, todayKey) < 0)
  const criticalStockItems = sourceData.stockItems.filter(item => item.active && clampValue(item.currentQty) <= clampValue(item.minQty))
  const openPurchaseRequests = sourceData.purchaseRequests.filter(request => !isPurchaseClosed(request.status))
  const urgentPurchaseRequests = openPurchaseRequests.filter(request => request.priority === 'URGENT' || request.priority === 'HIGH')
  const openShipments = sourceData.shipments.filter(shipment => !isShipmentDone(shipment.status) && !isShipmentCancelled(shipment.status))
  const overdueShipments = openShipments.filter(shipment => getDaysUntil(shipment.plannedDeliveryDate, todayKey) < 0)
  const todayShipments = sourceData.shipments.filter(shipment => isSameDateKey(shipment.shipmentDate || shipment.createdAt, todayKey))
  const activeRecalls = sourceData.productRecalls.filter(recall => recall.status !== 'COMPLETED' && recall.status !== 'CANCELLED')
  const haccpFailures = sourceData.haccpRecords.flatMap(plan => plan.monitoringRecords
    .filter(record => record.result === 'FAIL')
    .map(record => ({ plan, record })))
  const activeLines = sourceData.productionLines.filter(line => line.status !== 'Pasif')
  const efficiency = averageBy(activeLines, line => clampValue(line.estimatedUtilization, 0, 100))
  const stockHealth = clampValue(100 - percent(criticalStockItems.length, Math.max(sourceData.stockItems.length, 1)), 0, 100)
  const haccpMonitoringRecords = sourceData.haccpRecords.flatMap(plan => plan.monitoringRecords)
  const haccpPassRate = haccpMonitoringRecords.length > 0
    ? percent(haccpMonitoringRecords.filter(record => record.result === 'PASS').length, haccpMonitoringRecords.length)
    : 100

  const kpis: SummaryKpi[] = [
    {
      id: 'open-production',
      trend: productionSeries.values,
      label: 'Açık Üretim',
      value: formatNumber(activeProductionOrders.length),
      detail: `${formatNumber(sourceData.productionOrders.length)} toplam emir`,
      tone: overdueProductionOrders.length > 0 ? 'warning' : 'neutral',
      icon: 'production'
    },
    {
      id: 'critical-stock',
      label: 'Kritik Stok',
      value: formatNumber(criticalStockItems.length),
      detail: `${formatNumber(sourceData.stockItems.length)} kalem izleniyor`,
      tone: criticalStockItems.length > 0 ? 'danger' : 'success',
      icon: 'stock'
    },
    {
      id: 'open-purchase',
      trend: purchaseSeries.values,
      label: 'Satın Alma',
      value: formatNumber(openPurchaseRequests.length),
      detail: `${formatNumber(urgentPurchaseRequests.length)} yüksek öncelik`,
      tone: urgentPurchaseRequests.length > 0 ? 'warning' : 'neutral',
      icon: 'purchase'
    },
    {
      id: 'open-shipment',
      trend: shipmentSeries.values,
      label: 'Sevkiyat',
      value: formatNumber(openShipments.length),
      detail: `${formatNumber(todayShipments.length)} bugün planlı`,
      tone: overdueShipments.length > 0 ? 'warning' : 'neutral',
      icon: 'shipment'
    }
  ]

  const gauges: GaugeMetric[] = [
    {
      id: 'efficiency',
      label: 'Üretim Verimliliği',
      value: efficiency,
      detail: `${formatNumber(activeLines.length)} / ${formatNumber(sourceData.productionLines.length)} hat aktif`,
      tone: toGaugeTone(efficiency, 65, 82)
    },
    {
      id: 'stock-health',
      label: 'Stok Sağlığı',
      value: stockHealth,
      detail: `${formatNumber(criticalStockItems.length)} kritik kalem`,
      tone: toGaugeTone(stockHealth, 70, 88)
    },
    {
      id: 'haccp',
      label: 'HACCP Uygunluk',
      value: haccpPassRate,
      detail: `${formatNumber(haccpMonitoringRecords.filter(record => record.result === 'FAIL').length)} uygunsuz ölçüm`,
      tone: toGaugeTone(haccpPassRate, 86, 95)
    }
  ]

  const attention: AttentionItem[] = [
    ...criticalStockItems.slice(0, 4).map(item => ({
      id: `stock-${item.id}`,
      category: 'Kritik Stok',
      title: item.name,
      detail: `${formatNumber(item.currentQty, 1)} ${item.unit} / min ${formatNumber(item.minQty, 1)} ${item.unit}`,
      severity: item.currentQty <= item.minQty * 0.5 ? 'critical' as const : 'high' as const
    })),
    ...overdueProductionOrders.slice(0, 3).map(order => ({
      id: `production-${order.id}`,
      category: 'Geciken Üretim',
      title: order.workOrderNo,
      detail: `Teslim: ${formatDate(order.deliveryDate)} / ${order.lines.slice(0, 2).map(line => line.productName).join(', ')}`,
      severity: order.priority === 'Acil' ? 'critical' as const : 'high' as const
    })),
    ...overdueShipments.slice(0, 3).map(shipment => ({
      id: `shipment-${shipment.id}`,
      category: 'Geciken Sevkiyat',
      title: shipment.shipmentNo,
      detail: `Planlanan: ${formatDate(shipment.plannedDeliveryDate)}`,
      severity: shipment.priority === 'URGENT' ? 'critical' as const : 'high' as const
    })),
    ...haccpFailures.slice(0, 3).map(({ plan, record }) => ({
      id: `haccp-${record.id}`,
      category: 'HACCP Uygunsuzluk',
      title: plan.name,
      detail: record.criticalLimit,
      severity: 'critical' as const
    })),
    ...activeRecalls.slice(0, 2).map(recall => ({
      id: `recall-${recall.id}`,
      category: 'Aktif Recall',
      title: recall.recallNo,
      detail: `${formatNumber(recall.affectedCustomerCount)} müşteri etkilendi`,
      severity: recall.riskLevel === 'CRITICAL' ? 'critical' as const : 'high' as const
    }))
  ].slice(0, 10)

  const activityRows: ActivityRow[] = [
    ...sourceData.productionOrders.map(order => ({
      id: `activity-production-${order.id}`,
      time: order.updatedAt || order.createdAt || order.deliveryDate,
      action: order.workOrderNo,
      module: 'Üretim',
      detail: order.lines.slice(0, 2).map(line => line.productName).join(', ') || order.description || '-',
      status: order.status,
      tone: isProductionDone(order.status) ? 'success' as KpiTone : order.priority === 'Acil' ? 'danger' as KpiTone : 'neutral' as KpiTone
    })),
    ...sourceData.purchaseRequests.map(request => ({
      id: `activity-purchase-${request.id}`,
      time: request.updatedAt || request.createdAt || request.requestDate,
      action: request.requestNo,
      module: 'Satın Alma',
      detail: request.title || `${formatNumber(request.items.length)} kalem talep`,
      status: request.status,
      tone: request.priority === 'URGENT' ? 'danger' as KpiTone : 'neutral' as KpiTone
    })),
    ...sourceData.shipments.map(shipment => ({
      id: `activity-shipment-${shipment.id}`,
      time: shipment.updatedAt || shipment.createdAt || shipment.shipmentDate,
      action: shipment.shipmentNo,
      module: 'Sevkiyat',
      detail: `${formatNumber(shipment.items.length)} kalem`,
      status: shipment.status,
      tone: isShipmentDone(shipment.status) ? 'success' as KpiTone : 'neutral' as KpiTone
    }))
  ]
    .filter(row => isSameDateKey(row.time, todayKey))
    .sort((first, second) => (parseSafeDate(second.time)?.getTime() || 0) - (parseSafeDate(first.time)?.getTime() || 0))
    .slice(0, 12)

  const openProductionOrdersSorted = [...activeProductionOrders]
    .sort((first, second) => getDaysUntil(first.deliveryDate, todayKey) - getDaysUntil(second.deliveryDate, todayKey))
    .slice(0, 5)
    .map(order => ({
      id: order.id,
      title: order.workOrderNo,
      detail: order.lines.slice(0, 2).map(line => line.productName).join(', ') || order.description || '-',
      date: formatDate(order.deliveryDate)
    }))

  const criticalStockSorted = [...criticalStockItems]
    .sort((first, second) => (first.currentQty - first.minQty) - (second.currentQty - second.minQty))
    .slice(0, 5)
    .map(item => ({
      id: item.id,
      name: item.name,
      detail: `${formatNumber(item.currentQty, 1)} / min ${formatNumber(item.minQty, 1)} ${item.unit}`
    }))

  return {
    todayKey,
    series,
    kpis,
    gauges,
    attention,
    activity: activityRows,
    production: {
      efficiency,
      activeLineCount: activeLines.length,
      totalLineCount: sourceData.productionLines.length,
      openOrders: openProductionOrdersSorted
    },
    stock: {
      criticalCount: criticalStockItems.length,
      totalCount: sourceData.stockItems.length,
      items: criticalStockSorted,
      openPurchaseCount: openPurchaseRequests.length,
      urgentPurchaseCount: urgentPurchaseRequests.length
    }
  }
}

const getEmptyState = (
  container: DashboardWidgetContainer,
  key: WorkspaceTemplateEmptyState['key']
) => container.emptyStates.find(state => state.key === key)

const getCatalogActionLabel = (widget: DashboardWidgetCatalogItem) => {
  if(widget.added && widget.visibleInDashboard) return 'Eklendi'
  if(widget.added && !widget.visibleInDashboard) return 'Göster'
  return 'Ekle'
}

const hasManagedBusinessModules = (user: User) => (
  getManagedWorkspaceModulesForUser(user).some(module => module.isBusinessModule)
)

const WidgetCard = ({
  widget,
  onHide,
  onRemove
}: {
  widget: DashboardWidgetViewModel
  onHide: (widgetId: string) => void
  onRemove: (widgetId: string) => void
}) => (
  <article className={`dashboard-widget-card ${widget.size}`}>
    <span className="dashboard-widget-card-icon" aria-hidden="true">
      <AppIcon
        source={widget.definition.icon || widget.definition.moduleIcon}
        label={widget.definition.title}
        context={`${widget.definition.moduleCode} ${widget.definition.category} ${widget.definition.moduleName}`}
        size="LG"
      />
    </span>
    <div className="dashboard-widget-card-body">
      <div className="dashboard-widget-card-meta">
        <strong>{widget.definition.moduleName}</strong>
      </div>
      <h4>{widget.definition.title}</h4>
      <p>{widget.definition.description}</p>
      <div className="dashboard-widget-render-placeholder">
        <span>{widget.definition.emptyTitle || 'Henüz veri oluşmadı.'}</span>
        <small>{widget.definition.emptyDescription || 'Bu widget veri üretmeye başladığında burada gösterilecek.'}</small>
      </div>
    </div>
    <div className="dashboard-widget-card-actions">
      <button className="btn ghost" type="button" onClick={() => onHide(widget.id)}>
        <AppIcon name="hide" size="SM" />
        Gizle
      </button>
      <button className="btn danger" type="button" onClick={() => onRemove(widget.id)}>
        <AppIcon name="remove" size="SM" />
        Kaldır
      </button>
    </div>
  </article>
)

export default function DailySummary({ currentUser, onOpenMarketplace, onOpenWorkspaceSettings }: Props){
  const [widgetPanelOpen, setWidgetPanelOpen] = React.useState(false)
  const [widgetMessage, setWidgetMessage] = React.useState('')
  const [hasBusinessModules, setHasBusinessModules] = React.useState(() => (
    hasManagedBusinessModules(currentUser)
  ))
  const [container, setContainer] = React.useState<DashboardWidgetContainer>(() => (
    getDashboardWidgetContainer(currentUser)
  ))
  const [overview, setOverview] = React.useState<OperationsOverview>(() => buildOperationsOverview(loadKpiSourceData()))

  const refreshContainer = React.useCallback(() => {
    setContainer(getDashboardWidgetContainer(currentUser))
    setHasBusinessModules(hasManagedBusinessModules(currentUser))
    setOverview(buildOperationsOverview(loadKpiSourceData()))
  }, [currentUser])

  React.useEffect(() => {
    refreshContainer()
  }, [refreshContainer])

  React.useEffect(() => {
    const refresh = () => refreshContainer()

    window.addEventListener('storage', refresh)
    window.addEventListener(DASHBOARD_WIDGET_LAYOUT_EVENT, refresh)
    window.addEventListener(WORKSPACE_PROVISIONING_EVENT, refresh)
    window.addEventListener(WORKSPACE_MODULE_LIFECYCLE_EVENT, refresh)

    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(DASHBOARD_WIDGET_LAYOUT_EVENT, refresh)
      window.removeEventListener(WORKSPACE_PROVISIONING_EVENT, refresh)
      window.removeEventListener(WORKSPACE_MODULE_LIFECYCLE_EVENT, refresh)
    }
  }, [refreshContainer])

  React.useEffect(() => {
    if(!widgetPanelOpen) return undefined

    const closeOnEscape = (event: KeyboardEvent) => {
      if(event.key === 'Escape') setWidgetPanelOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [widgetPanelOpen])

  const handleAddWidget = (widget: DashboardWidgetCatalogItem) => {
    const nextContainer = widget.added
      ? setDashboardWidgetVisibility(currentUser, widget.instanceId || widget.id, true)
      : addDashboardWidget(currentUser, widget.id)

    setContainer(nextContainer)
    setWidgetMessage(widget.added
      ? `${widget.title} yeniden kontrol panelinde gösteriliyor.`
      : `${widget.title} kontrol paneline eklendi.`
    )
  }

  const handleHideWidget = (widgetId: string) => {
    const nextContainer = setDashboardWidgetVisibility(currentUser, widgetId, false)
    setContainer(nextContainer)
    setWidgetMessage('Widget gizlendi. Katalog üzerinden tekrar görünür hale getirebilirsiniz.')
  }

  const handleRemoveWidget = (widgetId: string) => {
    const nextContainer = removeDashboardWidget(currentUser, widgetId)
    setContainer(nextContainer)
    setWidgetMessage('Widget kontrol paneli yerleşiminden kaldırıldı.')
  }

  const widgetCatalogEmptyState = getEmptyState(container, WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS.WIDGET_CATALOG)

  const handleQuickAction = (action: WorkspaceTemplateQuickAction) => {
    setWidgetMessage('')

    if(action.actionType === WORKSPACE_TEMPLATE_ACTION_TYPES.OPEN_WIDGET_DRAWER){
      setWidgetPanelOpen(true)
      return
    }

    if(action.actionType === WORKSPACE_TEMPLATE_ACTION_TYPES.OPEN_MARKETPLACE){
      onOpenMarketplace()
      return
    }

    if(action.actionType === WORKSPACE_TEMPLATE_ACTION_TYPES.OPEN_WORKSPACE_SETTINGS){
      onOpenWorkspaceSettings?.()
    }
  }

  return (
    <div className="business-summary-page executive-dashboard-page dashboard-experience-page">
      <DashboardExperienceHeader
        eyebrow="Bugün"
        title={container.title}
        description={container.description}
        icon="dashboard"
        dataOnboardingTarget="control-panel"
        meta={[
          { key: 'live', label: 'Canlı', icon: 'success', tone: 'success' },
          { key: 'date', label: formatDate(new Date()), icon: 'report', tone: 'neutral' },
          { key: 'role', label: currentUser.role === 'Admin' ? 'Yönetici' : 'Kullanıcı', icon: 'user', tone: 'neutral' }
        ]}
      />

      {widgetMessage && <div className="form-success">{widgetMessage}</div>}

      <OperationalKpiRow kpis={overview.kpis} />

      <OperationsTrendPanel series={overview.series} />

      <GaugeRow gauges={overview.gauges} />

      <AttentionBar items={overview.attention} />

      <div className="op-main-grid">
        <div className="op-main-column">
          <ProductionStatusPanel production={overview.production} />
        </div>
        <div className="op-side-column">
          <StockProcurementPanel stock={overview.stock} />
        </div>
      </div>

      <TodayActivityTable rows={overview.activity} />

      <section className="operational-panel">
        <div className="operational-panel-header">
          <div>
            <h3>Kontrol Paneli Widget'ları</h3>
            <p className="muted">{container.isEmpty ? 'Henüz widget eklenmedi.' : `${container.visibleWidgets.length} widget gösteriliyor.`}</p>
          </div>
          <div className="op-widget-actions">
            {container.quickActions.map(action => (
              <button
                className="btn"
                type="button"
                key={action.id}
                title={action.description}
                onClick={() => handleQuickAction(action)}
              >
                <AppIcon source={action.icon} label={action.label} context={action.actionType} size="XS" />
                <span>{action.label}</span>
              </button>
            ))}
            {!hasBusinessModules && (
              <button className="btn ghost" type="button" onClick={onOpenMarketplace}>
                <AppIcon name="marketplace" size="SM" />
                Modül Mağazasına Git
              </button>
            )}
          </div>
        </div>

        {container.isEmpty ? (
          <p className="muted op-widget-empty-hint">
            Üretim, stok ve sevkiyat özetleri yukarıda gerçek operasyon verisiyle gösteriliyor. Bu alana ek modül widget'ları eklemek isterseniz "Widget Ekle" butonunu kullanabilirsiniz.
          </p>
        ) : (
          <div className="dashboard-widget-group-stack">
            {container.groupedWidgets.map(group => (
              <section className="dashboard-widget-group" key={group.category}>
                <div className="dashboard-widget-group-title">
                  <h3>{group.category}</h3>
                </div>
                <div className="dashboard-widget-grid">
                  {group.widgets.map(widget => (
                    <WidgetCard
                      key={widget.id}
                      widget={widget}
                      onHide={handleHideWidget}
                      onRemove={handleRemoveWidget}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      {widgetPanelOpen && (
        <div className="dashboard-widget-drawer-overlay" role="presentation" onClick={() => setWidgetPanelOpen(false)}>
          <aside
            className="dashboard-widget-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Widget ekle"
            onClick={event => event.stopPropagation()}
          >
            <div className="dashboard-widget-drawer-header">
              <div>
                <h3>Widget Ekle</h3>
                <p>Kategorilerden ihtiyacınız olan widgetları seçin.</p>
              </div>
              <button className="btn ghost" type="button" onClick={() => setWidgetPanelOpen(false)}>
                Kapat
              </button>
            </div>

            {container.catalogGroups.length > 0 ? (
              <div className="dashboard-widget-catalog-stack">
                {container.catalogGroups.map(group => (
                  <section className="dashboard-widget-catalog-group" key={group.category}>
                    <div className="dashboard-widget-group-title compact">
                      <h3>{group.category}</h3>
                      <span>{group.widgets.length} seçenek</span>
                    </div>
                    <div className="dashboard-widget-catalog-grid">
                      {group.widgets.map(widget => (
                        <article className="dashboard-widget-catalog-card compact" key={widget.id}>
                          <span className="dashboard-widget-card-icon" aria-hidden="true">
                            <AppIcon
                              source={widget.icon || widget.moduleIcon}
                              label={widget.title}
                              context={`${widget.moduleCode} ${widget.category} ${widget.moduleName}`}
                              size="MD"
                            />
                          </span>
                          <div>
                            <strong>{widget.moduleName}</strong>
                            <h4>{widget.title}</h4>
                            <p>{widget.description}</p>
                            <div className="dashboard-widget-catalog-meta">
                              <span>{widget.added ? (widget.visibleInDashboard ? 'Kontrol panelinde' : 'Gizli') : 'Eklenebilir'}</span>
                            </div>
                          </div>
                          <button
                            className={widget.added && widget.visibleInDashboard ? 'btn ghost' : 'btn primary'}
                            type="button"
                            disabled={widget.added && widget.visibleInDashboard}
                            onClick={() => handleAddWidget(widget)}
                          >
                            <AppIcon name={widget.added && widget.visibleInDashboard ? 'success' : 'plus'} size="SM" />
                            {getCatalogActionLabel(widget)}
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="dashboard-widget-placeholder">
                <strong>{widgetCatalogEmptyState?.title || 'Widget kataloğu boş.'}</strong>
                <span>{widgetCatalogEmptyState?.description || 'Modül mağazası üzerinden modül kurduğunuzda widget seçenekleri burada listelenecek.'}</span>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

function OperationalKpiRow({ kpis }: { kpis: SummaryKpi[] }){
  return (
    <section className="op-stat-row" aria-label="Günlük operasyon özeti">
      {kpis.map(kpi => (
        <article className={`op-stat-card tone-${kpi.tone}`} key={kpi.id}>
          <span className="op-stat-bar" aria-hidden="true" />
          <div className="op-stat-body">
            <span className="op-stat-label">{kpi.label}</span>
            <strong className="op-stat-value">{kpi.value}</strong>
            <span className="op-stat-detail">{kpi.detail}</span>
          </div>
          <div className="op-stat-aside">
            <span className="op-stat-icon" aria-hidden="true">
              <AppIcon name={kpi.icon} size="MD" />
            </span>
            {kpi.trend && kpi.trend.length > 1 && (
              <Sparkline points={kpi.trend} tone={kpi.tone === 'success' ? 'neutral' : kpi.tone} />
            )}
          </div>
        </article>
      ))}
    </section>
  )
}

function GaugeRow({ gauges }: { gauges: GaugeMetric[] }){
  return (
    <section className="chart-panel" aria-label="Operasyonel performans göstergeleri">
      <div className="chart-panel-head">
        <div>
          <h3>Operasyonel Performans</h3>
          <p>Üretim, stok ve HACCP tarafındaki mevcut uygunluk oranları.</p>
        </div>
      </div>
      <div className="chart-meter-grid">
        {gauges.map(gauge => (
          <Meter key={gauge.id} value={gauge.value} label={gauge.label} detail={gauge.detail} tone={gauge.tone} />
        ))}
      </div>
    </section>
  )
}

function OperationsTrendPanel({ series }: { series: DailySeries }){
  const total = series.production.reduce((sum, value) => sum + value, 0)
    + series.shipment.reduce((sum, value) => sum + value, 0)

  if(total === 0) return null

  return (
    <section className="chart-panel" aria-label="Son 14 gün operasyon hacmi">
      <div className="chart-panel-head">
        <div>
          <h3>Operasyon Hacmi</h3>
          <p>Son {series.labels.length} günde açılan üretim emri ve sevkiyat kaydı.</p>
        </div>
      </div>
      <TrendChart
        labels={series.labels}
        series={[
          { key: 'production', label: 'Üretim emri', points: series.production },
          { key: 'shipment', label: 'Sevkiyat', points: series.shipment }
        ]}
      />
    </section>
  )
}

function AttentionBar({ items }: { items: AttentionItem[] }){
  const criticalCount = items.filter(item => item.severity === 'critical').length
  const highCount = items.filter(item => item.severity === 'high').length
  const panelClassName = [
    'op-attention-panel',
    criticalCount > 0 ? 'has-critical' : highCount > 0 ? 'has-warning' : ''
  ].filter(Boolean).join(' ')

  return (
    <section className={panelClassName} aria-label="Dikkat gerektiren konular">
      <div className="op-attention-header">
        <h3>Dikkat Gerektiren Konular</h3>
        <span className="op-attention-count">
          {items.length === 0 ? 'Kritik risk sinyali yok' : `${formatNumber(criticalCount)} kritik / ${formatNumber(highCount)} yüksek`}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="op-attention-empty">Üretim, stok, sevkiyat ve HACCP tarafında kritik bir risk sinyali bulunmuyor.</p>
      ) : (
        <div className="op-attention-list">
          {items.map(item => (
            <div className={`op-attention-row ${item.severity}`} key={item.id}>
              <span className="op-attention-dot" aria-hidden="true" />
              <div className="op-attention-copy">
                <span>{item.category}</span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ProductionStatusPanel({ production }: { production: OperationsOverview['production'] }){
  return (
    <section className="operational-panel">
      <div className="operational-panel-header">
        <div>
          <h3>Üretim Durumu</h3>
          <p className="muted">{formatNumber(production.activeLineCount)} / {formatNumber(production.totalLineCount)} hat aktif · ortalama verimlilik {formatPercent(production.efficiency)}</p>
        </div>
      </div>
      <div className="op-decision-list">
        {production.openOrders.length === 0 && <div className="empty-cell">Açık üretim emri bulunmuyor.</div>}
        {production.openOrders.map(order => (
          <div className="op-decision-row" key={order.id}>
            <div className="op-decision-copy">
              <strong>{order.title}</strong>
              <small>{order.detail}</small>
            </div>
            <span className="op-upcoming-date">{order.date}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function StockProcurementPanel({ stock }: { stock: OperationsOverview['stock'] }){
  return (
    <section className="operational-panel">
      <div className="operational-panel-header">
        <div>
          <h3>Stok &amp; Tedarik</h3>
          <p className="muted">{formatNumber(stock.criticalCount)} kritik / {formatNumber(stock.totalCount)} stok kartı · {formatNumber(stock.openPurchaseCount)} açık talep</p>
        </div>
      </div>
      <div className="op-decision-list">
        {stock.items.length === 0 && <div className="empty-cell">Kritik stok kalemi bulunmuyor.</div>}
        {stock.items.map(item => (
          <div className="op-decision-row danger" key={item.id}>
            <div className="op-decision-copy">
              <strong>{item.name}</strong>
              <small>{item.detail}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function TodayActivityTable({ rows }: { rows: ActivityRow[] }){
  return (
    <section className="operational-panel">
      <div className="operational-panel-header">
        <div>
          <h3>Bugünkü Operasyon Akışı</h3>
          <p className="muted">{formatNumber(rows.length)} işlem</p>
        </div>
      </div>
      <div className="op-table-wrap">
        <table className="op-data-table">
          <thead>
            <tr>
              <th>Saat</th>
              <th>İşlem</th>
              <th>Bölüm</th>
              <th>Detay</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="op-table-empty" colSpan={5}>Bugün için henüz işlem kaydı yok.</td></tr>
            )}
            {rows.map(row => (
              <tr key={row.id}>
                <td className="numeric">{formatTime(row.time)}</td>
                <td className="op-table-title">{row.action}</td>
                <td>{row.module}</td>
                <td>{row.detail}</td>
                <td><span className={`status-pill ${row.tone}`}>{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
