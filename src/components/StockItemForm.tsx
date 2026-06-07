import React from 'react'
import { StockCategory, StockItem, StockUnit } from '../types'

export type StockItemFormValues = {
  name: string
  categoryId: string
  unit: StockUnit
  minQty: number
  unitPurchasePrice?: number
  currency: string
  tracksExpiry: boolean
  expiryWarningDays: number
  sku: string
  barcode: string
  description: string
  active: boolean
}

type Props = {
  categories: StockCategory[]
  item?: StockItem | null
  onSave: (values: StockItemFormValues) => void
  onCancel?: () => void
}

const unitOptions: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
const currencyOptions = [
  { value: 'TRY', label: 'TL' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' }
]

export default function StockItemForm({ categories, item, onSave, onCancel }: Props){
  const [name, setName] = React.useState('')
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id || '')
  const [unit, setUnit] = React.useState<StockUnit>('adet')
  const [minQty, setMinQty] = React.useState('0')
  const [unitPurchasePrice, setUnitPurchasePrice] = React.useState('')
  const [currency, setCurrency] = React.useState('TRY')
  const [tracksExpiry, setTracksExpiry] = React.useState(false)
  const [expiryWarningDays, setExpiryWarningDays] = React.useState('7')
  const [sku, setSku] = React.useState('')
  const [barcode, setBarcode] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [active, setActive] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    setName(item?.name || '')
    setCategoryId(item?.categoryId || categories[0]?.id || '')
    setUnit(item?.unit || 'adet')
    setMinQty(String(item?.minQty ?? 0))
    setUnitPurchasePrice(item?.unitPurchasePrice !== undefined ? String(item.unitPurchasePrice) : '')
    setCurrency(item?.currency || 'TRY')
    setTracksExpiry(item?.tracksExpiry ?? false)
    setExpiryWarningDays(String(item?.expiryWarningDays ?? 7))
    setSku(item?.sku || '')
    setBarcode(item?.barcode || '')
    setDescription(item?.description || '')
    setActive(item?.active ?? true)
    setError('')
  }, [item, categories])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()

    const parsedMinQty = Number(minQty)
    const parsedUnitPurchasePrice = unitPurchasePrice === '' ? undefined : Number(unitPurchasePrice)
    const parsedExpiryWarningDays = Number(expiryWarningDays)

    if(!name.trim()){
      setError('Stok kartı adı zorunludur.')
      return
    }

    if(!categoryId){
      setError('Kategori seçimi zorunludur.')
      return
    }

    if(!Number.isFinite(parsedMinQty) || parsedMinQty < 0){
      setError('Kritik stok seviyesi 0 veya daha büyük olmalıdır.')
      return
    }

    if(parsedUnitPurchasePrice !== undefined && (!Number.isFinite(parsedUnitPurchasePrice) || parsedUnitPurchasePrice < 0)){
      setError('Birim alış fiyatı 0 veya daha büyük olmalıdır.')
      return
    }

    if(!Number.isFinite(parsedExpiryWarningDays) || parsedExpiryWarningDays < 0){
      setError('SKT uyarı günü 0 veya daha büyük olmalıdır.')
      return
    }

    onSave({
      name: name.trim(),
      categoryId,
      unit,
      minQty: parsedMinQty,
      unitPurchasePrice: parsedUnitPurchasePrice,
      currency,
      tracksExpiry,
      expiryWarningDays: Math.floor(parsedExpiryWarningDays),
      sku: sku.trim(),
      barcode: barcode.trim(),
      description: description.trim(),
      active
    })

    if(!item){
      setName('')
      setCategoryId(categories[0]?.id || '')
      setUnit('adet')
      setMinQty('0')
      setUnitPurchasePrice('')
      setCurrency('TRY')
      setTracksExpiry(false)
      setExpiryWarningDays('7')
      setSku('')
      setBarcode('')
      setDescription('')
      setActive(true)
    }

    setError('')
  }

  return (
    <form onSubmit={submit} className="stacked-form">
      <p className="muted small-text">Stok miktarı ve SKT girişleri Stok Hareketleri ekranından yapılır.</p>

      <div className="form-field">
        <label>Stok kartı adı</label>
        <input placeholder="Örn. Dana kıyma" value={name} onChange={event => setName(event.target.value)} />
      </div>

      <div className="form-row">
        <div className="form-field">
          <label>Kategori</label>
          <select value={categoryId} onChange={event => setCategoryId(event.target.value)}>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}{category.active ? '' : ' (Pasif)'}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Birim</label>
          <select value={unit} onChange={event => setUnit(event.target.value as StockUnit)}>
            {unitOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </div>

      <div className="form-field">
        <label>Kritik seviye</label>
        <input type="number" min="0" step="0.001" value={minQty} onChange={event => setMinQty(event.target.value)} />
      </div>

      <div className="form-row">
        <div className="form-field">
          <label>Birim alış fiyatı</label>
          <input type="number" min="0" step="0.01" value={unitPurchasePrice} onChange={event => setUnitPurchasePrice(event.target.value)} placeholder="Opsiyonel" />
        </div>
        <div className="form-field">
          <label>Para birimi</label>
          <select value={currency} onChange={event => setCurrency(event.target.value)}>
            {currencyOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-check-field">
          <label className="check-row">
            <input type="checkbox" checked={tracksExpiry} onChange={event => setTracksExpiry(event.target.checked)} />
            SKT takibi aktif
          </label>
          <p className="muted small-text">Son kullanma tarihleri lot bazında Stok Hareketleri ekranından girilir.</p>
        </div>
        <div className="form-field">
          <label>SKT uyarı günü</label>
          <input type="number" min="0" step="1" value={expiryWarningDays} onChange={event => setExpiryWarningDays(event.target.value)} disabled={!tracksExpiry} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label>Stok kodu</label>
          <input placeholder="Opsiyonel" value={sku} onChange={event => setSku(event.target.value)} />
        </div>
        <div className="form-field">
          <label>Barkod</label>
          <input placeholder="Opsiyonel" value={barcode} onChange={event => setBarcode(event.target.value)} />
        </div>
      </div>

      <div className="form-field">
        <label>Açıklama</label>
        <textarea placeholder="Depo, marka veya satın alma notu" value={description} onChange={event => setDescription(event.target.value)} rows={3} />
      </div>

      <label className="check-row">
        <input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />
        Stok kartı aktif
      </label>

      {error && <div className="form-error">{error}</div>}

      <div className="form-actions">
        <button className="btn primary" type="submit">{item ? 'Güncelle' : 'Stok Kartı Ekle'}</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>Vazgeç</button>}
      </div>
    </form>
  )
}
