import React from 'react'
import { StockItem, StockMovement, StockMovementSource, StockMovementType, User } from '../types'
import {
  applyStockMovement,
  createStockWasteRecord,
  loadStockItems,
  loadStockMovements,
  loadStockWasteRecords,
  loadUsers,
  reverseStockMovement
} from '../storage'
import StockMovementForm, { StockMovementFormValues } from '../components/StockMovementForm'
import StockWasteForm, { StockWasteFormValues } from '../components/StockWasteForm'
import { formatExpiryDate } from '../expiryStock'
import { formatCurrency } from '../billing'
import { DEFAULT_STOCK_CURRENCY, formatStockMoney } from '../stockCost'

export type StockMovementFocus = 'movements' | 'waste'
type Props = { currentUser: User; focus?: StockMovementFocus }
type TypeFilter = 'all' | StockMovementType
type SourceFilter = 'all' | StockMovementSource

const getDefaultSourceFilter = (focus: StockMovementFocus): SourceFilter => {
  if(focus === 'waste') return 'Fire'
  return 'all'
}

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

const formatQuantity = (value: number, unit: string) => {
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
}

const formatCriticalStockMessage = (movement: ReturnType<typeof applyStockMovement>) => {
  const event = movement.criticalStockEvent
  if(!event) return ''

  if(event.eventType === 'entered'){
    return ` ${event.stockItemName} kritik stok seviyesine düştü.`
  }

  return ` ${event.stockItemName} kritik stoktan çıktı.`
}

const formatExpiryWarningMessage = (movement: ReturnType<typeof applyStockMovement>) => {
  if(!movement.expiryWarnings?.length) return ''
  return ` SKT uyarısı: ${movement.expiryWarnings.join(' | ')}`
}

const getMovementDirectionClass = (movement: StockMovement) => {
  if(movement.type === 'Giriş') return 'success'
  if(movement.type === 'Çıkış') return 'danger-pill'
  return ''
}

const getExpiryMovementText = (movement: StockMovement) => {
  const parts: string[] = []

  if(movement.expiryDate){
    parts.push(`SKT: ${formatExpiryDate(movement.expiryDate)}`)
  }

  if(movement.expiryAllocations?.length){
    parts.push(`FEFO: ${movement.expiryAllocations.map(allocation => {
      const expiry = allocation.expiryDate ? formatExpiryDate(allocation.expiryDate) : 'SKT yok'
      return `${allocation.lotCode} ${formatQuantity(allocation.qty, allocation.unit)} (${expiry})`
    }).join(' | ')}`)
  }

  if(movement.expiryUnallocatedQty && movement.expiryUnallocatedQty > 0){
    parts.push(`Eşleşmeyen: ${formatQuantity(movement.expiryUnallocatedQty, movement.unit)}`)
  }

  return parts.join(' · ')
}

export default function StockMovements({ currentUser, focus = 'movements' }: Props){
  const [stockItems, setStockItems] = React.useState<StockItem[]>(() => loadStockItems())
  const [movements, setMovements] = React.useState<StockMovement[]>(() => loadStockMovements())
  const [wasteRecords, setWasteRecords] = React.useState(() => loadStockWasteRecords())
  const [users] = React.useState<User[]>(() => loadUsers())
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [stockItemFilter, setStockItemFilter] = React.useState('all')
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all')
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>(() => getDefaultSourceFilter(focus))
  const [search, setSearch] = React.useState('')
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const previousFocusRef = React.useRef<StockMovementFocus>(focus)

  const canManageStock = currentUser.role === 'Admin'

  const refreshData = React.useCallback(() => {
    setStockItems(loadStockItems())
    setMovements(loadStockMovements())
    setWasteRecords(loadStockWasteRecords())
  }, [])

  React.useEffect(() => {
    refreshData()
    window.addEventListener('storage', refreshData)
    return () => window.removeEventListener('storage', refreshData)
  }, [refreshData])

  React.useEffect(() => {
    if(previousFocusRef.current === focus) return

    previousFocusRef.current = focus
    setStartDate('')
    setEndDate('')
    setStockItemFilter('all')
    setTypeFilter('all')
    setSourceFilter(getDefaultSourceFilter(focus))
    setSearch('')
  }, [focus])

  const activeStockItems = React.useMemo(() => stockItems.filter(item => item.active), [stockItems])
  const sortedMovements = React.useMemo(() => {
    return [...movements].sort((a, b) => new Date(b.movementDate).getTime() - new Date(a.movementDate).getTime())
  }, [movements])

  const filteredMovements = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return sortedMovements.filter(movement => {
      const dateKey = getLocalDateKey(movement.movementDate)
      const matchesStart = !startDate || dateKey >= startDate
      const matchesEnd = !endDate || dateKey <= endDate
      const matchesStockItem = stockItemFilter === 'all' || movement.stockItemId === stockItemFilter
      const matchesType = typeFilter === 'all' || movement.type === typeFilter
      const matchesSource = sourceFilter === 'all' || movement.source === sourceFilter
      const matchesSearch = !normalizedSearch
        || movement.stockItemName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || movement.reason.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (movement.supplierName || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (movement.invoiceNo || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (movement.description || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || movement.createdByFullName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)

      return matchesStart && matchesEnd && matchesStockItem && matchesType && matchesSource && matchesSearch
    })
  }, [endDate, search, sortedMovements, sourceFilter, startDate, stockItemFilter, typeFilter])

  const today = getLocalDateKey(new Date())
  const todaysMovements = movements.filter(movement => getLocalDateKey(movement.movementDate) === today)
  const todayEntryCount = todaysMovements.filter(movement => movement.type === 'Giriş').length
  const todayExitCount = todaysMovements.filter(movement => movement.type === 'Çıkış').length
  const todayCountCorrectionCount = todaysMovements.filter(movement => movement.type === 'Sayım Düzeltme').length
  const reversedMovementCount = movements.filter(movement => movement.reversedByMovementId).length
  const todaysWasteRecords = wasteRecords.filter(record => getLocalDateKey(record.occurredAt) === today && record.status === 'active')
  const todayWasteCost = todaysWasteRecords.reduce((sum, record) => sum + (record.estimatedTotalCost || 0), 0)
  const recentWasteRecords = React.useMemo(() => {
    return [...wasteRecords].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 5)
  }, [wasteRecords])
  const currentMonth = today.slice(0, 7)
  const activeWasteRecords = wasteRecords.filter(record => record.status === 'active')
  const thisMonthWasteRecords = activeWasteRecords.filter(record => getLocalDateKey(record.occurredAt).slice(0, 7) === currentMonth)
  const thisMonthWasteCost = thisMonthWasteRecords.reduce((sum, record) => sum + (record.estimatedTotalCost || 0), 0)
  const isWasteFocus = focus === 'waste'
  const pageMeta = React.useMemo(() => {
    if(isWasteFocus){
      return {
        title: 'Fire Yönetimi',
        description: 'Fire kayıtlarını, fire kaynaklı stok hareketlerini ve maliyet etkisini takip edin.',
        listTitle: 'Fire Hareketleri',
        emptyText: 'Filtrelere uygun fire hareketi bulunamadı.'
      }
    }

    return {
      title: 'Stok Hareketleri',
      description: 'Stok miktarı, SKT girişleri ve stok hareketleri bu ekran üzerinden yönetilir.',
      listTitle: 'Hareket Geçmişi',
      emptyText: 'Filtrelere uygun stok hareketi bulunamadı.'
    }
  }, [isWasteFocus])
  const metricCards = React.useMemo(() => {
    if(isWasteFocus){
      return [
        { label: 'Bugünkü Fire', value: todaysWasteRecords.length, detail: formatCurrency(todayWasteCost) },
        { label: 'Bu Ay Fire', value: thisMonthWasteRecords.length, detail: formatCurrency(thisMonthWasteCost) },
        { label: 'Fire Maliyeti', value: formatCurrency(thisMonthWasteCost), detail: 'Bu ay tahmini maliyet' },
        { label: 'Fire Adedi', value: activeWasteRecords.length, detail: 'Aktif fire kaydı' }
      ]
    }

    return [
      { label: 'Bugünkü Giriş Fişi', value: todayEntryCount },
      { label: 'Bugünkü Çıkış Fişi', value: todayExitCount },
      { label: 'Sayım Düzeltme', value: todayCountCorrectionCount },
      { label: 'Ters Hareket', value: reversedMovementCount },
      { label: 'Bugünkü Fire', value: todaysWasteRecords.length, detail: formatCurrency(todayWasteCost) }
    ]
  }, [
    activeWasteRecords.length,
    isWasteFocus,
    reversedMovementCount,
    thisMonthWasteCost,
    thisMonthWasteRecords.length,
    todayCountCorrectionCount,
    todayEntryCount,
    todayExitCount,
    todayWasteCost,
    todaysWasteRecords.length
  ])

  const saveMovement = (values: StockMovementFormValues) => {
    if(!canManageStock){
      setMessage({ type: 'error', text: 'Bu işlem için Admin yetkisi gereklidir.' })
      return
    }

    try {
      const movement = applyStockMovement({
        ...values,
        user: currentUser
      })
      refreshData()
      setMessage({
        type: movement.criticalStockEvent?.eventType === 'entered' ? 'error' : 'success',
        text: `${movement.stockItemName} için ${movement.type} fişi oluşturuldu.${formatCriticalStockMessage(movement)}${formatExpiryWarningMessage(movement)}`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Stok hareketi oluşturulamadı.' })
    }
  }

  const saveWasteRecord = (values: StockWasteFormValues) => {
    if(!canManageStock){
      setMessage({ type: 'error', text: 'Bu işlem için Admin yetkisi gereklidir.' })
      return false
    }

    try {
      const result = createStockWasteRecord({
        ...values,
        user: currentUser
      })
      refreshData()
      setMessage({
        type: result.movement.criticalStockEvent?.eventType === 'entered' ? 'error' : 'success',
        text: `${result.record.stockItemName} için fire kaydı oluşturuldu. Tahmini maliyet: ${formatCurrency(result.record.estimatedTotalCost || 0)}.${formatCriticalStockMessage(result.movement)}${formatExpiryWarningMessage(result.movement)}`
      })
      return true
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Fire kaydı oluşturulamadı.' })
      return false
    }
  }

  const reverseMovement = (movement: StockMovement) => {
    if(!canManageStock){
      setMessage({ type: 'error', text: 'Bu işlem için Admin yetkisi gereklidir.' })
      return
    }

    if(!confirm(`${movement.stockItemName} hareketi için ters hareket oluşturulacak. Devam etmek istiyor musunuz?`)) return

    try {
      const reversedMovement = reverseStockMovement(movement.id, currentUser)
      refreshData()
      setMessage({
        type: reversedMovement.criticalStockEvent?.eventType === 'entered' ? 'error' : 'success',
        text: `${movement.stockItemName} için ters hareket oluşturuldu: ${reversedMovement.type}.${formatCriticalStockMessage(reversedMovement)}${formatExpiryWarningMessage(reversedMovement)}`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Ters hareket oluşturulamadı.' })
    }
  }

  if(!canManageStock){
    return (
      <div className="stock-page">
        <section className="card">
          <h2>Yetkisiz Erişim</h2>
          <p className="muted">Stok hareketleri ekranını sadece Yönetici rolündeki kullanıcılar görebilir.</p>
        </section>
      </div>
    )
  }

  return (
    <div className={`stock-page stock-movements-page ${isWasteFocus ? 'waste-focus' : 'movements-focus'}`}>
      <div className="page-title">
        <div>
          <h2>{pageMeta.title}</h2>
          <p className="muted">{pageMeta.description}</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid">
        {metricCards.map(card => (
          <div className="metric-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            {card.detail && <p className="muted">{card.detail}</p>}
          </div>
        ))}
      </div>

      <div className={`stock-movement-layout ${isWasteFocus ? 'waste-focus' : 'movements-focus'}`}>
        <section className="card stock-movement-main">
          <div className="section-header">
            <div>
              <h3>{pageMeta.listTitle}</h3>
              <p className="muted">{filteredMovements.length} hareket gösteriliyor.</p>
            </div>
            <div className="stock-movement-filters">
              <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
              <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
              <select value={stockItemFilter} onChange={event => setStockItemFilter(event.target.value)}>
                <option value="all">Tüm stok kartları</option>
                {stockItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as TypeFilter)}>
                <option value="all">Tüm tipler</option>
                <option value="Giriş">Giriş</option>
                <option value="Çıkış">Çıkış</option>
                <option value="Sayım Düzeltme">Sayım Düzeltme</option>
              </select>
              <select value={sourceFilter} onChange={event => setSourceFilter(event.target.value as SourceFilter)}>
                <option value="all">Tüm kaynaklar</option>
                <option value="Manuel">Manuel</option>
                <option value="Reçete">Reçete</option>
                <option value="Adisyon">Adisyon</option>
                <option value="Sayım">Sayım</option>
                <option value="İade">İade</option>
                <option value="Fire">Fire</option>
              </select>
              <input type="search" placeholder="Stok, sebep, tedarikçi, fatura, kullanıcı ara" value={search} onChange={event => setSearch(event.target.value)} />
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table stock-movement-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Stok Kartı</th>
                  <th>Tip</th>
                  <th>Kaynak</th>
                  <th>Miktar</th>
                  <th>Stok</th>
                  <th>Tedarikçi / Fatura</th>
                  <th>Kullanıcı</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 && (
                  <tr><td colSpan={9} className="empty-cell">{pageMeta.emptyText}</td></tr>
                )}
                {filteredMovements.map(movement => (
                  <tr key={movement.id}>
                    <td>
                      <strong>{formatDateTime(movement.movementDate)}</strong>
                      <div className="muted small-text">Kayıt: {formatDateTime(movement.createdAt)}</div>
                    </td>
                    <td>
                      <strong>{movement.stockItemName}</strong>
                      <div className="muted small-text">
                        {movement.reason}{movement.source === 'Fire' ? ' · Fire kaydı' : ''}{movement.reversesMovementId ? ' · Ters kayıt' : ''}{movement.reversedByMovementId ? ' · Terslendi' : ''}
                      </div>
                      {getExpiryMovementText(movement) && <div className="muted small-text">{getExpiryMovementText(movement)}</div>}
                      {movement.expiryWarnings?.map(warning => <div className="small-text danger-text" key={warning}>{warning}</div>)}
                    </td>
                    <td><span className={`status-pill ${getMovementDirectionClass(movement)}`}>{movement.type}</span></td>
                    <td>
                      {movement.source === 'Fire' ? <span className="status-pill warning-pill">Fire</span> : movement.source}
                    </td>
                    <td>{formatQuantity(movement.qty, movement.unit)}</td>
                    <td>
                      <strong>{formatQuantity(movement.previousQty, movement.unit)} → {formatQuantity(movement.nextQty, movement.unit)}</strong>
                      {movement.purchasePrice !== undefined && <div className="muted small-text">Birim alış: {formatStockMoney(movement.purchasePrice, movement.currency || DEFAULT_STOCK_CURRENCY)}</div>}
                      <div className="muted small-text">
                        Ort. maliyet: {formatStockMoney(movement.nextAverageCost || 0, movement.currency || DEFAULT_STOCK_CURRENCY)}
                      </div>
                      <div className="muted small-text">
                        Stok değeri: {formatStockMoney(movement.previousStockValue || 0, movement.currency || DEFAULT_STOCK_CURRENCY)} → {formatStockMoney(movement.nextStockValue || 0, movement.currency || DEFAULT_STOCK_CURRENCY)}
                      </div>
                    </td>
                    <td>
                      <strong>{movement.supplierName || '-'}</strong>
                      <div className="muted small-text">{movement.invoiceNo || 'Fatura yok'}</div>
                      {movement.description && <div className="muted small-text">{movement.description}</div>}
                    </td>
                    <td>{movement.createdByFullName}</td>
                    <td className="stock-movement-action-cell">
                      <button className="btn" disabled={Boolean(movement.reversedByMovementId)} onClick={() => reverseMovement(movement)} type="button">
                        Ters Hareket
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="stock-movement-side">
          <section className="card">
            <div className="section-header compact">
              <h3>Fire Kaydı</h3>
            </div>
            <StockWasteForm stockItems={activeStockItems} users={users} onSave={saveWasteRecord} />
          </section>

          <section className="card">
            <div className="section-header compact">
              <h3>Son Fire Kayıtları</h3>
            </div>
            <div className="waste-mini-list">
              {recentWasteRecords.length === 0 && <div className="empty-state">Fire kaydı yok.</div>}
              {recentWasteRecords.map(record => (
                <div className="waste-mini-row" key={record.id}>
                  <div>
                    <strong>{record.stockItemName}</strong>
                    <span>{record.reasonCategory} · {formatQuantity(record.qty, record.unit)}</span>
                    <small>{record.responsibleFullName || 'Sorumlu yok'} · {formatDateTime(record.occurredAt)}</small>
                  </div>
                  <span className={`status-pill ${record.status === 'reversed' ? 'muted-pill' : 'warning-pill'}`}>
                    {record.status === 'reversed' ? 'Terslendi' : formatCurrency(record.estimatedTotalCost || 0)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-header compact">
              <h3>Yeni Stok Fişi</h3>
            </div>
            <StockMovementForm stockItems={activeStockItems} onSave={saveMovement} />
          </section>
        </aside>
      </div>
    </div>
  )
}
