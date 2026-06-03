import React from 'react'
import { StockCategory, StockItem, StockUnit } from '../types'

export type StockItemFormValues = {
  name: string
  categoryId: string
  unit: StockUnit
  currentQty: number
  minQty: number
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

export default function StockItemForm({ categories, item, onSave, onCancel }: Props){
  const [name, setName] = React.useState('')
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id || '')
  const [unit, setUnit] = React.useState<StockUnit>('adet')
  const [currentQty, setCurrentQty] = React.useState('0')
  const [minQty, setMinQty] = React.useState('0')
  const [sku, setSku] = React.useState('')
  const [barcode, setBarcode] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [active, setActive] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    setName(item?.name || '')
    setCategoryId(item?.categoryId || categories[0]?.id || '')
    setUnit(item?.unit || 'adet')
    setCurrentQty(String(item?.currentQty ?? 0))
    setMinQty(String(item?.minQty ?? 0))
    setSku(item?.sku || '')
    setBarcode(item?.barcode || '')
    setDescription(item?.description || '')
    setActive(item?.active ?? true)
    setError('')
  }, [item, categories])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()

    const parsedCurrentQty = Number(currentQty)
    const parsedMinQty = Number(minQty)

    if(!name.trim()){
      setError('Stok kartı adı zorunludur.')
      return
    }

    if(!categoryId){
      setError('Kategori seçimi zorunludur.')
      return
    }

    if(!Number.isFinite(parsedCurrentQty) || parsedCurrentQty < 0){
      setError('Mevcut miktar 0 veya daha büyük olmalıdır.')
      return
    }

    if(!Number.isFinite(parsedMinQty) || parsedMinQty < 0){
      setError('Kritik stok seviyesi 0 veya daha büyük olmalıdır.')
      return
    }

    onSave({
      name: name.trim(),
      categoryId,
      unit,
      currentQty: parsedCurrentQty,
      minQty: parsedMinQty,
      sku: sku.trim(),
      barcode: barcode.trim(),
      description: description.trim(),
      active
    })

    if(!item){
      setName('')
      setCategoryId(categories[0]?.id || '')
      setUnit('adet')
      setCurrentQty('0')
      setMinQty('0')
      setSku('')
      setBarcode('')
      setDescription('')
      setActive(true)
    }

    setError('')
  }

  return (
    <form onSubmit={submit} className="stacked-form">
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

      <div className="form-row">
        <div className="form-field">
          <label>Mevcut miktar</label>
          <input type="number" min="0" step="0.001" value={currentQty} onChange={event => setCurrentQty(event.target.value)} />
        </div>
        <div className="form-field">
          <label>Kritik seviye</label>
          <input type="number" min="0" step="0.001" value={minQty} onChange={event => setMinQty(event.target.value)} />
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
