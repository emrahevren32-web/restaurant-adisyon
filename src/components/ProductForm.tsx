import React from 'react'
import { Product, ProductAllergen, ProductCategory } from '../types'
import {
  NUTRITION_FIELD_CONFIG,
  NutritionFieldKey,
  PRODUCT_ALLERGENS,
  normalizeProductNutrition,
  normalizeServingSize
} from '../productNutrition'

export type ProductFormValues = {
  name: string
  price: number
  categoryId: string
  description: string
  calories: number
  protein: number
  carbohydrate: number
  fat: number
  fiber: number
  sugar: number
  salt: number
  servingSize: string
  allergens: ProductAllergen[]
  active: boolean
}

type ProductFormTab = 'basic' | 'nutrition' | 'allergens'

type Props = {
  categories: ProductCategory[]
  product?: Product | null
  onSave: (values: ProductFormValues) => void
  onCancel?: () => void
}

const createNutritionState = (product?: Product | null): Record<NutritionFieldKey, string> => {
  return NUTRITION_FIELD_CONFIG.reduce<Record<NutritionFieldKey, string>>((acc, field) => {
    acc[field.key] = String(product?.[field.key] ?? 0)
    return acc
  }, {
    calories: '0',
    protein: '0',
    carbohydrate: '0',
    fat: '0',
    fiber: '0',
    sugar: '0',
    salt: '0'
  })
}

export default function ProductForm({ categories, product, onSave, onCancel }: Props){
  const [activeTab, setActiveTab] = React.useState<ProductFormTab>('basic')
  const [name, setName] = React.useState('')
  const [price, setPrice] = React.useState('0')
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id || '')
  const [description, setDescription] = React.useState('')
  const [nutrition, setNutrition] = React.useState<Record<NutritionFieldKey, string>>(() => createNutritionState(product))
  const [servingSize, setServingSize] = React.useState('')
  const [allergens, setAllergens] = React.useState<ProductAllergen[]>([])
  const [active, setActive] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    setActiveTab('basic')
    setName(product?.name || '')
    setPrice(String(product?.price ?? 0))
    setCategoryId(product?.categoryId || categories[0]?.id || '')
    setDescription(product?.description || '')
    setNutrition(createNutritionState(product))
    setServingSize(product?.servingSize || '')
    setAllergens(product?.allergens || [])
    setActive(product?.active ?? true)
    setError('')
  }, [product, categories])

  const resetCreateForm = () => {
    setActiveTab('basic')
    setName('')
    setPrice('0')
    setCategoryId(categories[0]?.id || '')
    setDescription('')
    setNutrition(createNutritionState(null))
    setServingSize('')
    setAllergens([])
    setActive(true)
  }

  const setNutritionField = (field: NutritionFieldKey, value: string) => {
    setNutrition(prev => ({ ...prev, [field]: value }))
  }

  const toggleAllergen = (allergen: ProductAllergen) => {
    setAllergens(prev => prev.includes(allergen)
      ? prev.filter(item => item !== allergen)
      : [...prev, allergen]
    )
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedPrice = Number(price)
    const invalidNutritionField = NUTRITION_FIELD_CONFIG.find(field => {
      const value = nutrition[field.key].trim()
      if(value === '') return false
      const parsed = Number(value)
      return !Number.isFinite(parsed) || parsed < 0
    })

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

    if(invalidNutritionField){
      setError(`${invalidNutritionField.label} değeri 0 veya daha büyük olmalıdır.`)
      return
    }

    onSave({
      name: name.trim(),
      price: parsedPrice,
      categoryId,
      description: description.trim(),
      ...normalizeProductNutrition(nutrition),
      servingSize: normalizeServingSize(servingSize),
      allergens,
      active
    })

    if(!product){
      resetCreateForm()
    }

    setError('')
  }

  return (
    <form onSubmit={submit} className="stacked-form">
      <div className="form-tabs" role="tablist" aria-label="Ürün bilgi sekmeleri">
        <button type="button" className={`form-tab ${activeTab === 'basic' ? 'active' : ''}`} onClick={() => setActiveTab('basic')}>Temel Bilgiler</button>
        <button type="button" className={`form-tab ${activeTab === 'nutrition' ? 'active' : ''}`} onClick={() => setActiveTab('nutrition')}>Besin Bilgileri</button>
        <button type="button" className={`form-tab ${activeTab === 'allergens' ? 'active' : ''}`} onClick={() => setActiveTab('allergens')}>Alerjen Bilgileri</button>
      </div>

      {activeTab === 'basic' && <>
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
          Ürün / hizmet işlemde aktif
        </label>
      </>}

      {activeTab === 'nutrition' && (
        <div className="nutrition-form-grid">
          {NUTRITION_FIELD_CONFIG.map(field => (
            <div className="form-field" key={field.key}>
              <label>{field.label} ({field.unit})</label>
              <input
                type="number"
                min="0"
                step={field.step}
                value={nutrition[field.key]}
                onChange={e=>setNutritionField(field.key, e.target.value)}
              />
            </div>
          ))}
          <div className="form-field nutrition-serving-field">
            <label>Porsiyon</label>
            <input placeholder="Örn. 1 porsiyon / 250 g" value={servingSize} onChange={e=>setServingSize(e.target.value)} />
          </div>
        </div>
      )}

      {activeTab === 'allergens' && (
        <div className="allergen-form-panel">
          <label className="check-row allergen-free-row">
            <input type="checkbox" checked={allergens.length === 0} onChange={() => setAllergens([])} />
            Alerjen içermez
          </label>
          <div className="allergen-select-grid">
            {PRODUCT_ALLERGENS.map(allergen => (
              <label className={`allergen-option ${allergens.includes(allergen) ? 'selected' : ''}`} key={allergen}>
                <input
                  type="checkbox"
                  checked={allergens.includes(allergen)}
                  onChange={()=>toggleAllergen(allergen)}
                />
                <span>{allergen}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <button className="btn primary" type="submit">{product ? 'Güncelle' : 'Ürün Ekle'}</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>Vazgeç</button>}
      </div>
    </form>
  )
}
