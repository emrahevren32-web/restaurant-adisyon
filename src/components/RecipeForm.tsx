import React from 'react'
import { Product, Recipe, RecipeCostSnapshot, RecipeItem, StockItem, StockUnit } from '../types'
import { formatCurrency, roundCurrency } from '../billing'
import { getStockConsumptionUnitCost } from '../stockCost'

export type RecipeFormValues = {
  productId: string
  name: string
  active: boolean
  note: string
  items: RecipeItem[]
}

export type RecipeLineCost = {
  itemId: string
  stockItemName: string
  effectiveQty: number
  stockUnit?: StockUnit
  unitPrice?: number
  cost: number
  canCalculate: boolean
  message?: string
}

export type RecipeCostCalculation = RecipeCostSnapshot & {
  lines: RecipeLineCost[]
}

type Props = {
  products: Product[]
  stockItems: StockItem[]
  recipe?: Recipe | null
  onSave: (values: RecipeFormValues) => void
  onCancel?: () => void
}

const unitOptions: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const convertQuantity = (qty: number, fromUnit: StockUnit, toUnit: StockUnit) => {
  if(fromUnit === toUnit) return qty
  if(fromUnit === 'gr' && toUnit === 'kg') return qty / 1000
  if(fromUnit === 'kg' && toUnit === 'gr') return qty * 1000
  if(fromUnit === 'ml' && toUnit === 'lt') return qty / 1000
  if(fromUnit === 'lt' && toUnit === 'ml') return qty * 1000
  return null
}

export const calculateRecipeCost = (items: RecipeItem[], stockItems: StockItem[]): RecipeCostCalculation => {
  const lines = items.map(recipeItem => {
    const stockItem = stockItems.find(item => item.id === recipeItem.stockItemId)
    const effectiveQty = recipeItem.qty * (1 + Math.max(0, recipeItem.wastePercent || 0) / 100)

    if(!stockItem){
      return {
        itemId: recipeItem.id,
        stockItemName: recipeItem.stockItemName,
        effectiveQty,
        cost: 0,
        canCalculate: false,
        message: 'Stok kartı bulunamadı.'
      }
    }

    const convertedQty = convertQuantity(effectiveQty, recipeItem.unit, stockItem.unit)
    if(convertedQty === null){
      const unitCost = getStockConsumptionUnitCost(stockItem)
      return {
        itemId: recipeItem.id,
        stockItemName: stockItem.name,
        effectiveQty,
        stockUnit: stockItem.unit,
        unitPrice: unitCost,
        cost: 0,
        canCalculate: false,
        message: `${recipeItem.unit} birimi ${stockItem.unit} birimine çevrilemiyor.`
      }
    }

    const unitCost = getStockConsumptionUnitCost(stockItem)

    return {
      itemId: recipeItem.id,
      stockItemName: stockItem.name,
      effectiveQty: convertedQty,
      stockUnit: stockItem.unit,
      unitPrice: unitCost,
      cost: roundCurrency(convertedQty * unitCost),
      canCalculate: true
    }
  })

  return {
    totalCost: roundCurrency(lines.reduce((sum, line) => sum + line.cost, 0)),
    missingCostItemCount: lines.filter(line => !line.canCalculate).length,
    calculatedAt: new Date().toISOString(),
    lines
  }
}

const formatQty = (value: number, unit?: StockUnit) => {
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ''}`
}

export default function RecipeForm({ products, stockItems, recipe, onSave, onCancel }: Props){
  const [productId, setProductId] = React.useState(products[0]?.id || '')
  const [name, setName] = React.useState('')
  const [active, setActive] = React.useState(true)
  const [note, setNote] = React.useState('')
  const [items, setItems] = React.useState<RecipeItem[]>([])
  const [newStockItemId, setNewStockItemId] = React.useState(stockItems[0]?.id || '')
  const [newQty, setNewQty] = React.useState('1')
  const [newUnit, setNewUnit] = React.useState<StockUnit>(stockItems[0]?.unit || 'adet')
  const [newWastePercent, setNewWastePercent] = React.useState('0')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    const selectedProductId = recipe?.productId || products[0]?.id || ''
    setProductId(selectedProductId)
    setName(recipe?.name || '')
    setActive(recipe?.active ?? true)
    setNote(recipe?.note || '')
    setItems(recipe?.items || [])
    setError('')
  }, [products, recipe])

  React.useEffect(() => {
    if(stockItems.length === 0){
      setNewStockItemId('')
      return
    }

    if(!stockItems.find(item => item.id === newStockItemId)){
      setNewStockItemId(stockItems[0].id)
      setNewUnit(stockItems[0].unit)
    }
  }, [newStockItemId, stockItems])

  const selectedNewStockItem = stockItems.find(item => item.id === newStockItemId)
  const costCalculation = React.useMemo(() => calculateRecipeCost(items, stockItems), [items, stockItems])

  const addIngredient = () => {
    const stockItem = stockItems.find(item => item.id === newStockItemId)
    const qty = Number(newQty)
    const wastePercent = Number(newWastePercent)

    if(!stockItem){
      setError('Hammadde seçimi zorunludur.')
      return
    }

    if(items.some(item => item.stockItemId === stockItem.id)){
      setError('Aynı hammadde reçeteye ikinci kez eklenemez. Mevcut satırı düzenleyin.')
      return
    }

    if(!Number.isFinite(qty) || qty <= 0){
      setError('Hammadde miktarı 0’dan büyük olmalıdır.')
      return
    }

    if(!Number.isFinite(wastePercent) || wastePercent < 0){
      setError('Fire oranı 0 veya daha büyük olmalıdır.')
      return
    }

    setItems(prev => [
      ...prev,
      {
        id: createId('recipe_item'),
        stockItemId: stockItem.id,
        stockItemName: stockItem.name,
        qty,
        unit: newUnit,
        wastePercent,
        note: ''
      }
    ])
    setNewQty('1')
    setNewWastePercent('0')
    setError('')
  }

  const updateIngredient = (itemId: string, changes: Partial<RecipeItem>) => {
    setItems(prev => prev.map(item => {
      if(item.id !== itemId) return item
      const stockItem = changes.stockItemId ? stockItems.find(stock => stock.id === changes.stockItemId) : undefined
      return {
        ...item,
        ...changes,
        stockItemName: stockItem?.name || changes.stockItemName || item.stockItemName,
        unit: changes.stockItemId && stockItem ? stockItem.unit : changes.unit || item.unit
      }
    }))
  }

  const removeIngredient = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()

    if(!productId){
      setError('Ürün seçimi zorunludur.')
      return
    }

    if(!name.trim()){
      setError('Reçete adı zorunludur.')
      return
    }

    if(items.length === 0){
      setError('Reçetede en az bir hammadde olmalıdır.')
      return
    }

    const normalizedItems = items.map(item => {
      const stockItem = stockItems.find(stock => stock.id === item.stockItemId)
      return {
        ...item,
        stockItemName: stockItem?.name || item.stockItemName,
        qty: Math.max(0, Number(item.qty) || 0),
        wastePercent: Math.max(0, Number(item.wastePercent) || 0)
      }
    })

    if(normalizedItems.some(item => item.qty <= 0)){
      setError('Tüm hammadde miktarları 0’dan büyük olmalıdır.')
      return
    }

    onSave({
      productId,
      name: name.trim(),
      active,
      note: note.trim(),
      items: normalizedItems
    })
    setError('')
  }

  return (
    <form onSubmit={submit} className="stacked-form recipe-form">
      <div className="form-field">
        <label>Ürün</label>
        <select value={productId} onChange={event => setProductId(event.target.value)} disabled={Boolean(recipe)}>
          {products.length === 0 && <option value="">Aktif ürün yok</option>}
          {products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
      </div>

      <div className="form-field">
        <label>Reçete adı</label>
        <input value={name} onChange={event => setName(event.target.value)} placeholder="Örn. Adana Kebap standart reçetesi" />
      </div>

      <div className="recipe-add-panel">
        <div className="form-field">
          <label>Hammadde</label>
          <select value={newStockItemId} onChange={event => {
            const stockItem = stockItems.find(item => item.id === event.target.value)
            setNewStockItemId(event.target.value)
            if(stockItem) setNewUnit(stockItem.unit)
          }}>
            {stockItems.length === 0 && <option value="">Aktif stok kartı yok</option>}
            {stockItems.map(item => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}
          </select>
        </div>

        <div className="recipe-add-controls">
          <div className="form-field">
            <label>Miktar</label>
            <input type="number" min="0" step="0.001" value={newQty} onChange={event => setNewQty(event.target.value)} />
          </div>
          <div className="form-field">
            <label>Birim</label>
            <select value={newUnit} onChange={event => setNewUnit(event.target.value as StockUnit)}>
              {unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Fire</label>
            <input type="number" min="0" step="0.01" value={newWastePercent} onChange={event => setNewWastePercent(event.target.value)} />
          </div>
          <button className="btn primary recipe-add-button" type="button" onClick={addIngredient} disabled={!selectedNewStockItem}>Ekle</button>
        </div>
      </div>

      <div className="recipe-item-list">
        {items.length === 0 && <div className="empty-state">Henüz hammadde eklenmedi.</div>}
        {items.map(item => {
          const lineCost = costCalculation.lines.find(line => line.itemId === item.id)

          return (
            <div className="recipe-item-row" key={item.id}>
              <div className="form-field">
                <label>Hammadde</label>
                <select value={item.stockItemId} onChange={event => updateIngredient(item.id, { stockItemId: event.target.value })}>
                  {stockItems.map(stockItem => <option key={stockItem.id} value={stockItem.id}>{stockItem.name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Miktar</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={item.qty}
                  onChange={event => updateIngredient(item.id, { qty: Number(event.target.value) })}
                />
              </div>
              <div className="form-field">
                <label>Birim</label>
                <select value={item.unit} onChange={event => updateIngredient(item.id, { unit: event.target.value as StockUnit })}>
                  {unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Fire %</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.wastePercent}
                  onChange={event => updateIngredient(item.id, { wastePercent: Number(event.target.value) })}
                />
              </div>
              <div className="recipe-line-cost">
                <span>Maliyet</span>
                <strong>{lineCost?.canCalculate ? formatCurrency(lineCost.cost) : '-'}</strong>
                <small>{lineCost?.canCalculate ? `${formatQty(lineCost.effectiveQty, lineCost.stockUnit)} x ${formatCurrency(lineCost.unitPrice || 0)}` : lineCost?.message || 'Hesaplanamadı'}</small>
              </div>
              <button className="btn" type="button" onClick={() => removeIngredient(item.id)}>Sil</button>
              <input
                className="recipe-line-note"
                value={item.note || ''}
                onChange={event => updateIngredient(item.id, { note: event.target.value })}
                placeholder="Satır notu"
              />
            </div>
          )
        })}
      </div>

      <div className="recipe-cost-box">
        <div>
          <span>Reçete maliyeti</span>
          <strong>{formatCurrency(costCalculation.totalCost)}</strong>
        </div>
        <div>
          <span>Hesaplanamayan satır</span>
          <strong>{costCalculation.missingCostItemCount}</strong>
        </div>
      </div>

      <div className="form-field">
        <label>Açıklama</label>
        <textarea rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="Reçete hazırlık, porsiyon veya maliyet notu" />
      </div>

      <label className="check-row">
        <input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />
        Reçete aktif
      </label>

      {error && <div className="form-error">{error}</div>}

      <div className="form-actions">
        <button className="btn primary" type="submit">{recipe ? 'Reçeteyi Güncelle' : 'Reçete Ekle'}</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>Vazgeç</button>}
      </div>
    </form>
  )
}
