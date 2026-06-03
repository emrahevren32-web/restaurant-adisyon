import React from 'react'
import { StockItem, StockMovement, StockMovementSource, StockMovementType, User } from '../types'
import {
  applyStockMovement,
  loadStockItems,
  loadStockMovements,
  reverseStockMovement
} from '../storage'
import StockMovementForm, { StockMovementFormValues } from '../components/StockMovementForm'

type Props = { currentUser: User }
type TypeFilter = 'all' | StockMovementType
type SourceFilter = 'all' | StockMovementSource

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

const getMovementDirectionClass = (movement: StockMovement) => {
  if(movement.type === 'Giriş') return 'success'
  if(movement.type === 'Çıkış') return 'danger-pill'
  return ''
}

export default function StockMovements({ currentUser }: Props){
  const [stockItems, setStockItems] = React.useState<StockItem[]>(() => loadStockItems())
  const [movements, setMovements] = React.useState<StockMovement[]>(() => loadStockMovements())
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [stockItemFilter, setStockItemFilter] = React.useState('all')
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all')
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>('all')
  const [search, setSearch] = React.useState('')
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const canManageStock = currentUser.role === 'Admin'

  const refreshData = React.useCallback(() => {
    setStockItems(loadStockItems())
    setMovements(loadStockMovements())
  }, [])

  React.useEffect(() => {
    refreshData()
    window.addEventListener('storage', refreshData)
    return () => window.removeEventListener('storage', refreshData)
  }, [refreshData])

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
      setMessage({ type: 'success', text: `${movement.stockItemName} için ${movement.type} fişi oluşturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Stok hareketi oluşturulamadı.' })
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
      setMessage({ type: 'success', text: `${movement.stockItemName} için ters hareket oluşturuldu: ${reversedMovement.type}.` })
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
    <div className="stock-page">
      <div className="page-title">
        <div>
          <h2>Stok Hareketleri</h2>
          <p className="muted">Stok giriş, çıkış ve sayım düzeltme fişlerini kullanıcı, tarih, kaynak ve gerekçe ile takip edin.</p>
        </div>
        <span className="status-pill success">Admin</span>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Bugünkü Giriş Fişi</span>
          <strong>{todayEntryCount}</strong>
        </div>
        <div className="metric-card">
          <span>Bugünkü Çıkış Fişi</span>
          <strong>{todayExitCount}</strong>
        </div>
        <div className="metric-card">
          <span>Sayım Düzeltme</span>
          <strong>{todayCountCorrectionCount}</strong>
        </div>
        <div className="metric-card">
          <span>Ters Hareket</span>
          <strong>{reversedMovementCount}</strong>
        </div>
      </div>

      <div className="stock-movement-layout">
        <section className="card stock-movement-main">
          <div className="section-header">
            <div>
              <h3>Hareket Geçmişi</h3>
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
              </select>
              <input type="search" placeholder="Stok, tedarikçi, fatura, kullanıcı ara" value={search} onChange={event => setSearch(event.target.value)} />
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
                  <tr><td colSpan={9} className="empty-cell">Filtrelere uygun stok hareketi bulunamadı.</td></tr>
                )}
                {filteredMovements.map(movement => (
                  <tr key={movement.id}>
                    <td>
                      <strong>{formatDateTime(movement.movementDate)}</strong>
                      <div className="muted small-text">Kayıt: {formatDateTime(movement.createdAt)}</div>
                    </td>
                    <td>
                      <strong>{movement.stockItemName}</strong>
                      <div className="muted small-text">{movement.reason}{movement.reversesMovementId ? ' · Ters kayıt' : ''}{movement.reversedByMovementId ? ' · Terslendi' : ''}</div>
                    </td>
                    <td><span className={`status-pill ${getMovementDirectionClass(movement)}`}>{movement.type}</span></td>
                    <td>{movement.source}</td>
                    <td>{formatQuantity(movement.qty, movement.unit)}</td>
                    <td>
                      <strong>{formatQuantity(movement.previousQty, movement.unit)} → {formatQuantity(movement.nextQty, movement.unit)}</strong>
                      {movement.purchasePrice !== undefined && <div className="muted small-text">Alış: {movement.purchasePrice.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</div>}
                    </td>
                    <td>
                      <strong>{movement.supplierName || '-'}</strong>
                      <div className="muted small-text">{movement.invoiceNo || 'Fatura yok'}</div>
                      {movement.description && <div className="muted small-text">{movement.description}</div>}
                    </td>
                    <td>{movement.createdByFullName}</td>
                    <td className="actions-cell">
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
              <h3>Yeni Stok Fişi</h3>
            </div>
            <StockMovementForm stockItems={activeStockItems} onSave={saveMovement} />
          </section>
        </aside>
      </div>
    </div>
  )
}
