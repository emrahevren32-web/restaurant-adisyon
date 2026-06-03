import React from 'react'
import { StockItem, StockMovementReason, StockMovementSource, StockMovementType } from '../types'

export type StockMovementFormValues = {
  stockItemId: string
  type: StockMovementType
  source: StockMovementSource
  reason: StockMovementReason
  qty: number
  purchasePrice?: number
  supplierName: string
  invoiceNo: string
  description: string
  movementDate: string
}

type Props = {
  stockItems: StockItem[]
  onSave: (values: StockMovementFormValues) => void
}

const movementTypes: StockMovementType[] = ['Giriş', 'Çıkış', 'Sayım Düzeltme']
const movementSources: StockMovementSource[] = ['Manuel', 'Reçete', 'Adisyon', 'Sayım', 'İade']
const movementReasons: StockMovementReason[] = ['Satın Alma', 'İade', 'Fire', 'Kullanım', 'Sayım Fazlası', 'Sayım Eksiği', 'Diğer']

const toDateTimeLocalValue = (date = new Date()) => {
  const offsetMs = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

const toIsoDate = (value: string) => {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export default function StockMovementForm({ stockItems, onSave }: Props){
  const [stockItemId, setStockItemId] = React.useState(stockItems[0]?.id || '')
  const [type, setType] = React.useState<StockMovementType>('Giriş')
  const [source, setSource] = React.useState<StockMovementSource>('Manuel')
  const [reason, setReason] = React.useState<StockMovementReason>('Satın Alma')
  const [qty, setQty] = React.useState('1')
  const [purchasePrice, setPurchasePrice] = React.useState('')
  const [supplierName, setSupplierName] = React.useState('')
  const [invoiceNo, setInvoiceNo] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [movementDate, setMovementDate] = React.useState(() => toDateTimeLocalValue())
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if(stockItems.length === 0){
      setStockItemId('')
      return
    }

    if(!stockItems.find(item => item.id === stockItemId)){
      setStockItemId(stockItems[0].id)
    }
  }, [stockItemId, stockItems])

  React.useEffect(() => {
    if(type === 'Giriş'){
      setReason(source === 'İade' ? 'İade' : 'Satın Alma')
      return
    }

    if(type === 'Çıkış'){
      setReason('Kullanım')
      return
    }

    setSource('Sayım')
    setReason('Sayım Fazlası')
  }, [source, type])

  const selectedItem = stockItems.find(item => item.id === stockItemId)
  const qtyLabel = type === 'Sayım Düzeltme' ? 'Sayım sonucu miktar' : 'Miktar'

  const submit = (event: React.FormEvent) => {
    event.preventDefault()

    const parsedQty = Number(qty)
    const parsedPurchasePrice = purchasePrice === '' ? undefined : Number(purchasePrice)

    if(!stockItemId){
      setError('Stok kartı seçimi zorunludur.')
      return
    }

    if(!Number.isFinite(parsedQty) || parsedQty < 0 || (type !== 'Sayım Düzeltme' && parsedQty <= 0)){
      setError(type === 'Sayım Düzeltme' ? 'Sayım sonucu 0 veya daha büyük olmalıdır.' : 'Miktar 0’dan büyük olmalıdır.')
      return
    }

    if(parsedPurchasePrice !== undefined && (!Number.isFinite(parsedPurchasePrice) || parsedPurchasePrice < 0)){
      setError('Alış fiyatı 0 veya daha büyük olmalıdır.')
      return
    }

    onSave({
      stockItemId,
      type,
      source,
      reason,
      qty: parsedQty,
      purchasePrice: parsedPurchasePrice,
      supplierName: supplierName.trim(),
      invoiceNo: invoiceNo.trim(),
      description: description.trim(),
      movementDate: toIsoDate(movementDate)
    })

    setQty('1')
    setPurchasePrice('')
    setSupplierName('')
    setInvoiceNo('')
    setDescription('')
    setMovementDate(toDateTimeLocalValue())
    setError('')
  }

  return (
    <form onSubmit={submit} className="stacked-form">
      <div className="form-row stock-movement-type-row">
        <div className="form-field">
          <label>Hareket tipi</label>
          <select value={type} onChange={event => setType(event.target.value as StockMovementType)}>
            {movementTypes.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Hareket kaynağı</label>
          <select value={source} onChange={event => setSource(event.target.value as StockMovementSource)}>
            {movementSources.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>

      <div className="form-field">
        <label>Stok kartı</label>
        <select value={stockItemId} onChange={event => setStockItemId(event.target.value)} disabled={stockItems.length === 0}>
          {stockItems.length === 0 && <option value="">Aktif stok kartı yok</option>}
          {stockItems.map(item => (
            <option key={item.id} value={item.id}>
              {item.name} - mevcut {item.currentQty.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} {item.unit}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row stock-movement-type-row">
        <div className="form-field">
          <label>{qtyLabel}</label>
          <input type="number" min="0" step="0.001" value={qty} onChange={event => setQty(event.target.value)} />
        </div>
        <div className="form-field">
          <label>Sebep</label>
          <select value={reason} onChange={event => setReason(event.target.value as StockMovementReason)}>
            {movementReasons.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>

      {selectedItem && (
        <div className="stock-current-hint">
          <span>Mevcut stok</span>
          <strong>{selectedItem.currentQty.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} {selectedItem.unit}</strong>
        </div>
      )}

      <div className="form-row stock-movement-type-row">
        <div className="form-field">
          <label>Hareket tarihi</label>
          <input type="datetime-local" value={movementDate} onChange={event => setMovementDate(event.target.value)} />
        </div>
        <div className="form-field">
          <label>Alış fiyatı</label>
          <input type="number" min="0" step="0.01" value={purchasePrice} onChange={event => setPurchasePrice(event.target.value)} placeholder="Opsiyonel" />
        </div>
      </div>

      <div className="form-row stock-movement-type-row">
        <div className="form-field">
          <label>Tedarikçi</label>
          <input value={supplierName} onChange={event => setSupplierName(event.target.value)} placeholder="Opsiyonel" />
        </div>
        <div className="form-field">
          <label>Fatura no</label>
          <input value={invoiceNo} onChange={event => setInvoiceNo(event.target.value)} placeholder="Opsiyonel" />
        </div>
      </div>

      <div className="form-field">
        <label>Açıklama</label>
        <textarea rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="Hareket açıklaması" />
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="form-actions">
        <button className="btn primary" type="submit" disabled={stockItems.length === 0}>Fiş Oluştur</button>
      </div>
    </form>
  )
}
