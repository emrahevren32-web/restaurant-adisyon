import React from 'react'
import { Product, ProductCategory } from '../types'

export type ProductFormValues = {
  name: string
  price: number
  categoryId: string
  description: string
  active: boolean
}

type Props = {
  categories: ProductCategory[]
  product?: Product | null
  onSave: (values: ProductFormValues) => void
  onCancel?: () => void
}

export default function ProductForm({ categories, product, onSave, onCancel }: Props){
  const [name, setName] = React.useState('')
  const [price, setPrice] = React.useState('0')
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id || '')
  const [description, setDescription] = React.useState('')
  const [active, setActive] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    setName(product?.name || '')
    setPrice(String(product?.price ?? 0))
    setCategoryId(product?.categoryId || categories[0]?.id || '')
    setDescription(product?.description || '')
    setActive(product?.active ?? true)
    setError('')
  }, [product, categories])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedPrice = Number(price)

    if(!name.trim()){
      setError('Ürün adı zorunludur.')
      return
    }

    if(!categoryId){
      setError('Kategori seçimi zorunludur.')
      return
    }

    if(!Number.isFinite(parsedPrice) || parsedPrice <= 0){
      setError('Fiyat 0’dan büyük olmalıdır.')
      return
    }

    onSave({
      name: name.trim(),
      price: parsedPrice,
      categoryId,
      description: description.trim(),
      active
    })

    if(!product){
      setName('')
      setPrice('0')
      setCategoryId(categories[0]?.id || '')
      setDescription('')
      setActive(true)
    }

    setError('')
  }

  return (
    <form onSubmit={submit} className="stacked-form">
      <div className="form-field">
        <label>Ürün adı</label>
        <input placeholder="Örn. Izgara Köfte" value={name} onChange={e=>setName(e.target.value)} />
      </div>
      <div className="form-row">
        <div className="form-field">
          <label>Kategori</label>
          <select value={categoryId} onChange={e=>setCategoryId(e.target.value)}>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}{category.active ? '' : ' (Pasif)'}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Fiyat</label>
          <input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} />
        </div>
      </div>
      <div className="form-field">
        <label>Açıklama</label>
        <textarea placeholder="İsteğe bağlı ürün notu" value={description} onChange={e=>setDescription(e.target.value)} rows={3} />
      </div>
      <label className="check-row">
        <input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} />
        Ürün satışta aktif
      </label>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <button className="btn primary" type="submit">{product ? 'Güncelle' : 'Ürün Ekle'}</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>Vazgeç</button>}
      </div>
    </form>
  )
}
