import React from 'react'
import { StockItem, StockWasteReasonCategory, User } from '../types'
import { formatCurrency } from '../billing'
import { HIGH_COST_FIRE_APPROVAL_THRESHOLD, STOCK_WASTE_REASONS } from '../storage'

export type StockWasteFormValues = {
  stockItemId: string
  qty: number
  reasonCategory: StockWasteReasonCategory
  reasonNote: string
  responsibleUserId?: string
  responsibleFullName?: string
  occurredAt: string
}

type Props = {
  stockItems: StockItem[]
  users: User[]
  onSave: (values: StockWasteFormValues) => boolean | void
}

const toDateTimeLocalValue = (date = new Date()) => {
  const offsetMs = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

const toIsoDate = (value: string) => {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

const formatQty = (value: number, unit: StockItem['unit']) => {
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
}

export default function StockWasteForm({ stockItems, users, onSave }: Props){
  const [stockItemId, setStockItemId] = React.useState(stockItems[0]?.id || '')
  const [qty, setQty] = React.useState('1')
  const [reasonCategory, setReasonCategory] = React.useState<StockWasteReasonCategory>('Bozulma')
  const [responsibleUserId, setResponsibleUserId] = React.useState('')
  const [reasonNote, setReasonNote] = React.useState('')
  const [occurredAt, setOccurredAt] = React.useState(() => toDateTimeLocalValue())
  const [error, setError] = React.useState('')
  const [pendingApproval, setPendingApproval] = React.useState<StockWasteFormValues | null>(null)

  React.useEffect(() => {
    if(stockItems.length === 0){
      setStockItemId('')
      return
    }

    if(!stockItems.find(item => item.id === stockItemId)){
      setStockItemId(stockItems[0].id)
    }
  }, [stockItemId, stockItems])

  const selectedItem = stockItems.find(item => item.id === stockItemId)
  const responsibleUser = users.find(user => user.id === responsibleUserId)
  const parsedQty = Number(qty)
  const estimatedTotal = selectedItem?.lastPurchasePrice !== undefined && Number.isFinite(parsedQty)
    ? selectedItem.lastPurchasePrice * Math.max(0, parsedQty)
    : undefined

  const resetForm = () => {
    setQty('1')
    setReasonCategory('Bozulma')
    setResponsibleUserId('')
    setReasonNote('')
    setOccurredAt(toDateTimeLocalValue())
    setError('')
    setPendingApproval(null)
  }

  const buildValues = () => {
    if(!selectedItem){
      setError('Stok kartı seçimi zorunludur.')
      return null
    }

    if(!Number.isFinite(parsedQty) || parsedQty <= 0){
      setError('Fire miktarı 0’dan büyük olmalıdır.')
      return null
    }

    if(parsedQty > selectedItem.currentQty){
      setError('Fire miktarı mevcut stoktan büyük olamaz.')
      return null
    }

    return {
      stockItemId,
      qty: parsedQty,
      reasonCategory,
      reasonNote: reasonNote.trim(),
      responsibleUserId: responsibleUser?.id,
      responsibleFullName: responsibleUser ? responsibleUser.fullName || responsibleUser.username : '',
      occurredAt: toIsoDate(occurredAt)
    }
  }

  const submitValues = (values: StockWasteFormValues) => {
    const result = onSave(values)
    if(result !== false) resetForm()
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const values = buildValues()
    if(!values) return

    if((estimatedTotal || 0) >= HIGH_COST_FIRE_APPROVAL_THRESHOLD){
      setPendingApproval(values)
      setError('')
      return
    }

    submitValues(values)
  }

  return (
    <form onSubmit={submit} className="stacked-form stock-waste-form">
      <div className="form-field">
        <label>Stok kartı</label>
        <select value={stockItemId} onChange={event => setStockItemId(event.target.value)} disabled={stockItems.length === 0}>
          {stockItems.length === 0 && <option value="">Aktif stok kartı yok</option>}
          {stockItems.map(item => (
            <option key={item.id} value={item.id}>
              {item.name} - mevcut {formatQty(item.currentQty, item.unit)}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row stock-movement-type-row">
        <div className="form-field">
          <label>Fire miktarı</label>
          <input type="number" min="0" step="0.001" value={qty} onChange={event => setQty(event.target.value)} />
        </div>
        <div className="form-field">
          <label>Fire nedeni</label>
          <select value={reasonCategory} onChange={event => setReasonCategory(event.target.value as StockWasteReasonCategory)}>
            {STOCK_WASTE_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
          </select>
        </div>
      </div>

      {selectedItem && (
        <div className="stock-current-hint">
          <span>Mevcut stok</span>
          <strong>{formatQty(selectedItem.currentQty, selectedItem.unit)}</strong>
          {selectedItem.tracksExpiry && <em>{reasonCategory === 'SKT Geçmesi' ? 'Tarihi geçmiş lotlardan düşer' : 'FEFO lot düşümü yapılır'}</em>}
        </div>
      )}

      <div className="form-row stock-movement-type-row">
        <div className="form-field">
          <label>Sorumlu personel</label>
          <select value={responsibleUserId} onChange={event => setResponsibleUserId(event.target.value)}>
            <option value="">Sorumlu seçilmedi</option>
            {users.filter(user => user.active).map(user => <option key={user.id} value={user.id}>{user.fullName || user.username}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Fire tarihi</label>
          <input type="datetime-local" value={occurredAt} onChange={event => setOccurredAt(event.target.value)} />
        </div>
      </div>

      <div className="form-field">
        <label>Açıklama</label>
        <textarea rows={3} value={reasonNote} onChange={event => setReasonNote(event.target.value)} placeholder="Fire açıklaması" />
      </div>

      <div className="stock-current-hint waste-cost-hint">
        <span>Tahmini fire maliyeti</span>
        <strong>{estimatedTotal !== undefined ? formatCurrency(estimatedTotal) : '-'}</strong>
        <em>Birim maliyet son alış fiyatından hesaplanır</em>
      </div>

      {pendingApproval && (
        <div className="approval-panel">
          <strong>Yüksek maliyetli fire onayı</strong>
          <span>{selectedItem?.name} için tahmini fire maliyeti {formatCurrency(estimatedTotal || 0)}.</span>
          <div className="form-actions">
            <button className="btn danger" type="button" onClick={() => submitValues(pendingApproval)}>Onayla</button>
            <button className="btn" type="button" onClick={() => setPendingApproval(null)}>Vazgeç</button>
          </div>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      <div className="form-actions">
        <button className="btn primary" type="submit" disabled={stockItems.length === 0}>Fire Kaydı Oluştur</button>
      </div>
    </form>
  )
}
