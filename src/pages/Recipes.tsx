import React from 'react'
import {
  RECIPE_INGREDIENT_UNITS,
  RECIPE_MANAGEMENT_STATUSES,
  RECIPE_MANAGEMENT_TYPES,
  RECIPE_PRODUCT_OPTIONS,
  loadRecipeManagementRecords,
  saveRecipeManagementRecords
} from '../recipe-management/recipe-management.mock'
import type {
  RecipeIngredient,
  RecipeIngredientUnit,
  RecipeManagementRecord,
  RecipeManagementStatus,
  RecipeManagementType
} from '../recipe-management/recipe-management.types'

type StatusFilter = RecipeManagementStatus | 'all'
type PanelMode = 'summary' | 'form'
type ViewMode = 'list' | 'detail'
type ToastTone = 'success' | 'info'

type RecipeFormState = {
  code: string
  recipeName: string
  recipeType: RecipeManagementType
  productName: string
  portions: string
  status: RecipeManagementStatus
  description: string
}

type IngredientFormState = {
  materialName: string
  quantity: string
  unit: RecipeIngredientUnit
}

type ToastState = {
  id: string
  text: string
  tone: ToastTone
}

const MAX_INGREDIENT_QUANTITY = 100000

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const formatNumber = (value: number) => value.toLocaleString('tr-TR', {
  maximumFractionDigits: 3
})

const calculateTotalGrams = (ingredients: RecipeIngredient[]) => (
  ingredients.reduce((sum, ingredient) => {
    if(ingredient.unit === 'gr') return sum + ingredient.quantity
    if(ingredient.unit === 'kg') return sum + (ingredient.quantity * 1000)
    return sum
  }, 0)
)

const formatDateTime = (value?: string) => {
  if(!value) return '-'
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

const getStatusClass = (status: RecipeManagementStatus) => (
  status === 'Aktif' ? 'success' : 'muted-pill'
)

const getNextRecipeCode = (records: RecipeManagementRecord[]) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.code.match(/(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `RC-${String(maxNo + 1).padStart(3, '0')}`
}

const createInitialRecipeForm = (records: RecipeManagementRecord[]): RecipeFormState => ({
  code: getNextRecipeCode(records),
  recipeName: '',
  recipeType: 'Ana Ürün',
  productName: '',
  portions: '1',
  status: 'Aktif',
  description: ''
})

const createRecipeFormFromRecord = (record: RecipeManagementRecord): RecipeFormState => ({
  code: record.code,
  recipeName: record.recipeName,
  recipeType: record.recipeType,
  productName: record.productName,
  portions: String(record.portions),
  status: record.status,
  description: record.description
})

const createInitialIngredientForm = (): IngredientFormState => ({
  materialName: '',
  quantity: '1',
  unit: 'gr'
})

const createIngredientFormFromRecord = (ingredient: RecipeIngredient): IngredientFormState => ({
  materialName: ingredient.materialName,
  quantity: String(ingredient.quantity),
  unit: ingredient.unit
})

const validateRecipeForm = (
  form: RecipeFormState,
  ingredients: RecipeIngredient[],
  records: RecipeManagementRecord[],
  editingRecipeId: string
) => {
  if(!form.code.trim()) return 'Kod zorunludur.'
  if(!form.recipeName.trim()) return 'Reçete adı zorunludur.'
  if(!form.productName.trim()) return 'Ürün zorunludur.'
  if(!form.recipeType.trim()) return 'Reçete türü zorunludur.'

  const portions = Number(form.portions)
  if(!form.portions.trim()) return 'Porsiyon boş bırakılamaz.'
  if(!Number.isFinite(portions)) return 'Porsiyon için geçerli bir sayı girilmelidir.'
  if(portions <= 0) return 'Porsiyon 0 veya negatif olamaz.'
  if(portions > 100000) return 'Porsiyon 100000 üzerinde olamaz.'
  if(ingredients.length === 0) return 'En az 1 malzeme eklenmelidir.'
  if(ingredients.some(ingredient => (
    !ingredient.materialName.trim()
    || ingredient.quantity <= 0
    || ingredient.quantity > MAX_INGREDIENT_QUANTITY
    || !RECIPE_INGREDIENT_UNITS.includes(ingredient.unit)
  ))){
    return 'Tüm malzemelerde hammadde, miktar ve birim geçerli olmalıdır.'
  }

  const normalizedCode = form.code.trim().toLocaleLowerCase('tr-TR')
  const duplicateCode = records.some(record => (
    record.id !== editingRecipeId
    && record.code.trim().toLocaleLowerCase('tr-TR') === normalizedCode
  ))
  if(duplicateCode) return 'Bu kod zaten kullanılıyor.'

  return ''
}

const validateIngredientForm = (form: IngredientFormState) => {
  if(!form.materialName.trim()) return 'Malzeme adı zorunludur.'

  const quantity = Number(form.quantity)
  if(!form.quantity.trim()) return 'Miktar boş bırakılamaz.'
  if(!Number.isFinite(quantity)) return 'Miktar için geçerli bir sayı girilmelidir.'
  if(quantity <= 0) return 'Miktar 0 veya negatif olamaz.'
  if(quantity > MAX_INGREDIENT_QUANTITY) return 'Miktar 100000 değerini geçemez.'
  if(!RECIPE_INGREDIENT_UNITS.includes(form.unit)) return 'Birim zorunludur.'

  return ''
}

export default function Recipes(){
  const [records, setRecords] = React.useState<RecipeManagementRecord[]>(() => loadRecipeManagementRecords())
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [selectedRecordId, setSelectedRecordId] = React.useState('recipe_mgmt_001')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('summary')
  const [viewMode, setViewMode] = React.useState<ViewMode>('list')
  const [editingRecipeId, setEditingRecipeId] = React.useState('')
  const [recipeForm, setRecipeForm] = React.useState<RecipeFormState>(() => createInitialRecipeForm(loadRecipeManagementRecords()))
  const [recipeFormError, setRecipeFormError] = React.useState('')
  const [recipeFormIngredients, setRecipeFormIngredients] = React.useState<RecipeIngredient[]>([])
  const [recipeIngredientForm, setRecipeIngredientForm] = React.useState<IngredientFormState>(() => createInitialIngredientForm())
  const [recipeIngredientEditingId, setRecipeIngredientEditingId] = React.useState('')
  const [recipeIngredientError, setRecipeIngredientError] = React.useState('')
  const [ingredientForm, setIngredientForm] = React.useState<IngredientFormState>(() => createInitialIngredientForm())
  const [ingredientFormVisible, setIngredientFormVisible] = React.useState(false)
  const [editingIngredientId, setEditingIngredientId] = React.useState('')
  const [ingredientFormError, setIngredientFormError] = React.useState('')
  const [toast, setToast] = React.useState<ToastState | null>(null)

  const commitRecords = React.useCallback((updater: React.SetStateAction<RecipeManagementRecord[]>) => {
    setRecords(prev => {
      const nextRecords = typeof updater === 'function'
        ? (updater as (current: RecipeManagementRecord[]) => RecipeManagementRecord[])(prev)
        : updater
      saveRecipeManagementRecords(nextRecords)
      return nextRecords
    })
  }, [])

  const showToast = React.useCallback((text: string, tone: ToastTone = 'success') => {
    setToast({
      id: createId('recipe_toast'),
      text,
      tone
    })
  }, [])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return records.filter(record => {
      const matchesSearch = !normalizedSearch
        || record.code.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || record.recipeName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || record.productName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [records, search, statusFilter])

  React.useEffect(() => {
    if(panelMode === 'form' || viewMode === 'detail') return
    if(visibleRecords.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(visibleRecords[0]?.id || '')
  }, [panelMode, selectedRecordId, viewMode, visibleRecords])

  React.useEffect(() => {
    if(!toast) return undefined

    const timeoutId = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const selectedRecord = records.find(record => record.id === selectedRecordId) || null
  const isEditingRecipe = Boolean(editingRecipeId)
  const totalRecipes = records.length
  const activeRecipes = records.filter(record => record.status === 'Aktif').length
  const totalIngredients = records.reduce((sum, record) => sum + record.ingredients.length, 0)
  const totalPortions = records.reduce((sum, record) => sum + record.portions, 0)
  const productOptions = React.useMemo(() => {
    const options = new Set<string>(RECIPE_PRODUCT_OPTIONS)
    records.forEach(record => {
      if(record.productName.trim()) options.add(record.productName.trim())
    })
    if(recipeForm.productName.trim()) options.add(recipeForm.productName.trim())
    return Array.from(options)
  }, [records, recipeForm.productName])

  const startNewRecipe = () => {
    setViewMode('list')
    setPanelMode('form')
    setEditingRecipeId('')
    setRecipeForm(createInitialRecipeForm(records))
    setRecipeFormIngredients([])
    setRecipeIngredientForm(createInitialIngredientForm())
    setRecipeIngredientEditingId('')
    setRecipeIngredientError('')
    setRecipeFormError('')
    setToast(null)
  }

  const startEditRecipe = (record: RecipeManagementRecord) => {
    setViewMode('list')
    setSelectedRecordId(record.id)
    setPanelMode('form')
    setEditingRecipeId(record.id)
    setRecipeForm(createRecipeFormFromRecord(record))
    setRecipeFormIngredients(record.ingredients)
    setRecipeIngredientForm(createInitialIngredientForm())
    setRecipeIngredientEditingId('')
    setRecipeIngredientError('')
    setRecipeFormError('')
    setToast(null)
  }

  const cancelRecipeForm = () => {
    setPanelMode('summary')
    setEditingRecipeId('')
    setRecipeForm(createInitialRecipeForm(records))
    setRecipeFormIngredients([])
    setRecipeIngredientForm(createInitialIngredientForm())
    setRecipeIngredientEditingId('')
    setRecipeIngredientError('')
    setRecipeFormError('')
  }

  const updateRecipeForm = <TKey extends keyof RecipeFormState>(
    key: TKey,
    value: RecipeFormState[TKey]
  ) => {
    setRecipeForm(prev => ({ ...prev, [key]: value }))
  }

  const updateIngredientForm = <TKey extends keyof IngredientFormState>(
    key: TKey,
    value: IngredientFormState[TKey]
  ) => {
    setIngredientForm(prev => ({ ...prev, [key]: value }))
  }

  const updateRecipeIngredientForm = <TKey extends keyof IngredientFormState>(
    key: TKey,
    value: IngredientFormState[TKey]
  ) => {
    setRecipeIngredientForm(prev => ({ ...prev, [key]: value }))
  }

  const resetRecipeIngredientForm = () => {
    setRecipeIngredientForm(createInitialIngredientForm())
    setRecipeIngredientEditingId('')
    setRecipeIngredientError('')
  }

  const startEditRecipeFormIngredient = (ingredient: RecipeIngredient) => {
    setRecipeIngredientForm(createIngredientFormFromRecord(ingredient))
    setRecipeIngredientEditingId(ingredient.id)
    setRecipeIngredientError('')
  }

  const saveRecipeFormIngredient = () => {
    const validationError = validateIngredientForm(recipeIngredientForm)
    if(validationError){
      setRecipeIngredientError(validationError)
      return
    }

    const nextIngredient: RecipeIngredient = {
      id: recipeIngredientEditingId || createId('recipe_ing'),
      materialName: recipeIngredientForm.materialName.trim(),
      quantity: Number(recipeIngredientForm.quantity),
      unit: recipeIngredientForm.unit
    }

    setRecipeFormIngredients(prev => (
      recipeIngredientEditingId
        ? prev.map(ingredient => ingredient.id === recipeIngredientEditingId ? nextIngredient : ingredient)
        : [...prev, nextIngredient]
    ))
    resetRecipeIngredientForm()
    setRecipeFormError('')
  }

  const deleteRecipeFormIngredient = (ingredient: RecipeIngredient) => {
    setRecipeFormIngredients(prev => prev.filter(item => item.id !== ingredient.id))
    if(recipeIngredientEditingId === ingredient.id) resetRecipeIngredientForm()
  }

  const openDetail = (record: RecipeManagementRecord) => {
    setSelectedRecordId(record.id)
    setViewMode('detail')
    setPanelMode('summary')
    setIngredientFormVisible(false)
    setEditingIngredientId('')
    setIngredientFormError('')
  }

  const backToList = () => {
    setViewMode('list')
    setIngredientFormVisible(false)
    setEditingIngredientId('')
    setIngredientFormError('')
  }

  const deleteRecipe = (record: RecipeManagementRecord) => {
    if(!window.confirm('Bu reçeteyi silmek istediğinize emin misiniz?')) return

    const nextRecords = records.filter(item => item.id !== record.id)
    commitRecords(nextRecords)
    setSelectedRecordId(nextRecords[0]?.id || '')
    setViewMode('list')
    setPanelMode('summary')

    if(editingRecipeId === record.id){
      setEditingRecipeId('')
      setRecipeForm(createInitialRecipeForm(nextRecords))
      setRecipeFormIngredients([])
      resetRecipeIngredientForm()
      setRecipeFormError('')
    }

    showToast('Reçete silindi.')
  }

  const submitRecipeForm = (event: React.FormEvent) => {
    event.preventDefault()

    const validationError = validateRecipeForm(recipeForm, recipeFormIngredients, records, editingRecipeId)
    if(validationError){
      setRecipeFormError(validationError)
      return
    }

    const now = new Date().toISOString()
    const portions = Number(recipeForm.portions)
    const normalizedCode = recipeForm.code.trim().toLocaleUpperCase('tr-TR')

    if(isEditingRecipe){
      const existingRecord = records.find(record => record.id === editingRecipeId)
      if(!existingRecord){
        setRecipeFormError('Düzenlenecek reçete bulunamadı.')
        return
      }

      const updatedRecord: RecipeManagementRecord = {
        ...existingRecord,
        code: normalizedCode,
        recipeName: recipeForm.recipeName.trim(),
        recipeType: recipeForm.recipeType,
        productName: recipeForm.productName.trim(),
        portions,
        status: recipeForm.status,
        description: recipeForm.description.trim(),
        ingredients: recipeFormIngredients,
        updatedAt: now
      }

      commitRecords(prev => prev.map(record => record.id === updatedRecord.id ? updatedRecord : record))
      setSelectedRecordId(updatedRecord.id)
      setPanelMode('summary')
      setEditingRecipeId('')
      setRecipeForm(createInitialRecipeForm(records))
      setRecipeFormIngredients([])
      resetRecipeIngredientForm()
      setRecipeFormError('')
      showToast('Reçete güncellendi.')
      return
    }

    const newRecord: RecipeManagementRecord = {
      id: createId('recipe_mgmt'),
      code: normalizedCode,
      recipeName: recipeForm.recipeName.trim(),
      recipeType: recipeForm.recipeType,
      productName: recipeForm.productName.trim(),
      portions,
      status: recipeForm.status,
      description: recipeForm.description.trim(),
      ingredients: recipeFormIngredients,
      createdAt: now,
      updatedAt: now
    }

    commitRecords(prev => [newRecord, ...prev])
    setSelectedRecordId(newRecord.id)
    setPanelMode('summary')
    setRecipeForm(createInitialRecipeForm([newRecord, ...records]))
    setRecipeFormIngredients([])
    resetRecipeIngredientForm()
    setRecipeFormError('')
    showToast('Reçete oluşturuldu.')
  }

  const startAddIngredient = () => {
    setIngredientFormVisible(true)
    setEditingIngredientId('')
    setIngredientForm(createInitialIngredientForm())
    setIngredientFormError('')
  }

  const startEditIngredient = (ingredient: RecipeIngredient) => {
    setIngredientFormVisible(true)
    setEditingIngredientId(ingredient.id)
    setIngredientForm(createIngredientFormFromRecord(ingredient))
    setIngredientFormError('')
  }

  const cancelIngredientForm = () => {
    setIngredientFormVisible(false)
    setEditingIngredientId('')
    setIngredientForm(createInitialIngredientForm())
    setIngredientFormError('')
  }

  const submitIngredientForm = (event: React.FormEvent) => {
    event.preventDefault()
    if(!selectedRecord) return

    const validationError = validateIngredientForm(ingredientForm)
    if(validationError){
      setIngredientFormError(validationError)
      return
    }

    const now = new Date().toISOString()
    const quantity = Number(ingredientForm.quantity)

    const nextIngredient: RecipeIngredient = {
      id: editingIngredientId || createId('recipe_ing'),
      materialName: ingredientForm.materialName.trim(),
      quantity,
      unit: ingredientForm.unit
    }

    const recipeId = selectedRecord.id
    const editedIngredientId = editingIngredientId

    commitRecords(prev => prev.map(record => {
      if(record.id !== recipeId) return record

      return {
        ...record,
        ingredients: editedIngredientId
          ? record.ingredients.map(ingredient => ingredient.id === editedIngredientId ? nextIngredient : ingredient)
          : [...record.ingredients, nextIngredient],
        updatedAt: now
      }
    }))
    setIngredientFormVisible(false)
    setEditingIngredientId('')
    setIngredientForm(createInitialIngredientForm())
    setIngredientFormError('')
    showToast(editingIngredientId ? 'Malzeme güncellendi.' : 'Malzeme eklendi.')
  }

  const deleteIngredient = (ingredient: RecipeIngredient) => {
    if(!selectedRecord) return
    if(!window.confirm('Bu malzemeyi silmek istediğinize emin misiniz?')) return
    if(selectedRecord.ingredients.length <= 1){
      showToast('Reçetede en az 1 malzeme kalmalıdır.', 'info')
      return
    }

    const recipeId = selectedRecord.id
    const now = new Date().toISOString()

    commitRecords(prev => prev.map(record => (
      record.id === recipeId
        ? {
            ...record,
            ingredients: record.ingredients.filter(item => item.id !== ingredient.id),
            updatedAt: now
          }
        : record
    )))
    showToast('Malzeme silindi.')
  }

  const renderRecipeFormPanel = () => (
    <section className="card">
      <div className="section-header compact">
        <h3>{isEditingRecipe ? 'Reçete Düzenle' : 'Yeni Reçete'}</h3>
        <button className="btn" type="button" onClick={cancelRecipeForm}>Vazgeç</button>
      </div>

      {recipeFormError && <div className="form-error">{recipeFormError}</div>}

      <form className="stacked-form recipe-management-form" onSubmit={submitRecipeForm}>
        <div className="form-row">
          <div className="form-field">
            <label>Kod</label>
            <input value={recipeForm.code} onChange={event => updateRecipeForm('code', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Reçete Türü</label>
            <select value={recipeForm.recipeType} onChange={event => updateRecipeForm('recipeType', event.target.value as RecipeManagementType)}>
              {RECIPE_MANAGEMENT_TYPES.map(recipeType => (
                <option key={recipeType} value={recipeType}>{recipeType}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label>Reçete Adı</label>
          <input value={recipeForm.recipeName} onChange={event => updateRecipeForm('recipeName', event.target.value)} />
        </div>

        <div className="form-field">
          <label>Ürün</label>
          <select
            value={recipeForm.productName}
            onChange={event => updateRecipeForm('productName', event.target.value)}
          >
            <option value="">Ürün seçin</option>
            {productOptions.map(product => (
              <option key={product} value={product}>{product}</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Porsiyon</label>
            <input
              type="number"
              min="0"
              step="1"
              value={recipeForm.portions}
              onChange={event => updateRecipeForm('portions', event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Durum</label>
            <select value={recipeForm.status} onChange={event => updateRecipeForm('status', event.target.value as RecipeManagementStatus)}>
              {RECIPE_MANAGEMENT_STATUSES.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label>Açıklama</label>
          <textarea
            rows={4}
            value={recipeForm.description}
            onChange={event => updateRecipeForm('description', event.target.value)}
            placeholder="Reçete kartı notu"
          />
        </div>

        <div className="recipe-form-ingredients">
          <div className="section-header compact">
            <div>
              <h3>Reçete Malzemeleri</h3>
              <p className="muted">{recipeFormIngredients.length} malzeme eklendi.</p>
            </div>
          </div>

          <div className="recipe-form-ingredient-list">
            {recipeFormIngredients.length === 0 && (
              <div className="recipe-form-ingredient-empty">En az 1 malzeme eklenmelidir.</div>
            )}
            {recipeFormIngredients.map(ingredient => (
              <div key={ingredient.id} className="recipe-form-ingredient-row">
                <div>
                  <strong>{ingredient.materialName}</strong>
                  <span>{formatNumber(ingredient.quantity)} {ingredient.unit}</span>
                </div>
                <div>
                  <button className="btn" type="button" onClick={() => startEditRecipeFormIngredient(ingredient)}>Düzenle</button>
                  <button className="btn danger" type="button" onClick={() => deleteRecipeFormIngredient(ingredient)}>Sil</button>
                </div>
              </div>
            ))}
          </div>

          <div className="recipe-inline-ingredient-form">
            <div className="form-field">
              <label>Hammadde</label>
              <input value={recipeIngredientForm.materialName} onChange={event => updateRecipeIngredientForm('materialName', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Miktar</label>
              <input
                type="number"
                min="0"
                max={MAX_INGREDIENT_QUANTITY}
                step="0.001"
                value={recipeIngredientForm.quantity}
                onChange={event => updateRecipeIngredientForm('quantity', event.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Birim</label>
              <select value={recipeIngredientForm.unit} onChange={event => updateRecipeIngredientForm('unit', event.target.value as RecipeIngredientUnit)}>
                {RECIPE_INGREDIENT_UNITS.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
            <div className="recipe-inline-ingredient-actions">
              {recipeIngredientEditingId && <button className="btn" type="button" onClick={resetRecipeIngredientForm}>Vazgeç</button>}
              <button className="btn primary" type="button" onClick={saveRecipeFormIngredient}>{recipeIngredientEditingId ? 'Malzemeyi Kaydet' : 'Malzeme Ekle'}</button>
            </div>
            {recipeIngredientError && <div className="form-error recipe-ingredient-error">{recipeIngredientError}</div>}
          </div>
        </div>

        <div className="form-actions">
          <button className="btn" type="button" onClick={cancelRecipeForm}>Vazgeç</button>
          <button className="btn primary" type="submit">{isEditingRecipe ? 'Değişiklikleri Kaydet' : 'Reçete Oluştur'}</button>
        </div>
      </form>
    </section>
  )

  const renderSummaryPanel = () => {
    if(!selectedRecord){
      return (
        <section className="card">
          <div className="empty-state">Detay için bir reçete seçin.</div>
        </section>
      )
    }

    return (
      <section className="card recipe-management-summary">
        <div className="section-header compact">
          <div>
            <h3>{selectedRecord.code}</h3>
            <p className="muted">{selectedRecord.recipeName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>{selectedRecord.status}</span>
        </div>

        <div className="recipe-summary-grid">
          <div><span>Kod</span><strong>{selectedRecord.code}</strong></div>
          <div><span>Reçete Adı</span><strong>{selectedRecord.recipeName}</strong></div>
          <div><span>Reçete Türü</span><strong>{selectedRecord.recipeType}</strong></div>
          <div><span>Ürün</span><strong>{selectedRecord.productName}</strong></div>
          <div><span>Porsiyon</span><strong>{formatNumber(selectedRecord.portions)}</strong></div>
          <div><span>Malzeme Sayısı</span><strong>{selectedRecord.ingredients.length}</strong></div>
          <div><span>Toplam Gramaj</span><strong>{formatNumber(calculateTotalGrams(selectedRecord.ingredients))} gr</strong></div>
          <div><span>Tahmini Toplam Maliyet</span><strong>Hesaplanmadı</strong></div>
          <div><span>Son Güncelleme</span><strong>{formatDateTime(selectedRecord.updatedAt || selectedRecord.createdAt)}</strong></div>
          <div><span>Açıklama</span><strong>{selectedRecord.description || '-'}</strong></div>
        </div>

        <div className="recipe-side-actions">
          <button className="btn primary" type="button" onClick={() => openDetail(selectedRecord)}>Detay</button>
          <button className="btn" type="button" onClick={() => startEditRecipe(selectedRecord)}>Düzenle</button>
          <button className="btn danger" type="button" onClick={() => deleteRecipe(selectedRecord)}>Sil</button>
        </div>
      </section>
    )
  }

  const renderIngredientForm = () => (
    <form className="recipe-ingredient-form" onSubmit={submitIngredientForm}>
      <div className="form-field">
        <label>Hammadde</label>
        <input value={ingredientForm.materialName} onChange={event => updateIngredientForm('materialName', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Miktar</label>
        <input
          type="number"
          min="0"
          max={MAX_INGREDIENT_QUANTITY}
          step="0.001"
          value={ingredientForm.quantity}
          onChange={event => updateIngredientForm('quantity', event.target.value)}
        />
      </div>
      <div className="form-field">
        <label>Birim</label>
        <select value={ingredientForm.unit} onChange={event => updateIngredientForm('unit', event.target.value as RecipeIngredientUnit)}>
          {RECIPE_INGREDIENT_UNITS.map(unit => (
            <option key={unit} value={unit}>{unit}</option>
          ))}
        </select>
      </div>
      <div className="recipe-ingredient-form-actions">
        <button className="btn" type="button" onClick={cancelIngredientForm}>Vazgeç</button>
        <button className="btn primary" type="submit">{editingIngredientId ? 'Kaydet' : 'Malzeme Ekle'}</button>
      </div>
      {ingredientFormError && <div className="form-error recipe-ingredient-error">{ingredientFormError}</div>}
    </form>
  )

  const renderDetailScreen = () => {
    if(!selectedRecord){
      return (
        <div className="recipes-page">
          <section className="card">
            <div className="empty-state">Detay için bir reçete seçin.</div>
            <button className="btn" type="button" onClick={backToList}>Listeye Dön</button>
          </section>
        </div>
      )
    }

    return (
      <div className="recipes-page recipe-detail-page">
        <div className="page-title recipe-detail-title">
          <div>
            <h2>{selectedRecord.recipeName}</h2>
            <p className="muted">{selectedRecord.code} · {selectedRecord.recipeType} · {selectedRecord.productName}</p>
          </div>
          <div className="recipe-detail-actions">
            <button className="btn" type="button" onClick={backToList}>Listeye Dön</button>
            <button className="btn" type="button" onClick={() => startEditRecipe(selectedRecord)}>Reçete Düzenle</button>
          </div>
        </div>

        {toast && (
          <div className={`recipe-toast ${toast.tone}`} role="status" aria-live="polite">
            {toast.text}
          </div>
        )}

        <div className="recipe-detail-grid">
          <section className="card">
            <div className="section-header">
              <div>
                <h3>Malzemeler</h3>
                <p className="muted">{selectedRecord.ingredients.length} malzeme satırı gösteriliyor.</p>
              </div>
              <button className="btn primary" type="button" onClick={startAddIngredient}>+ Malzeme Ekle</button>
            </div>

            <div className="table-wrap">
              <table className="data-table recipe-ingredient-table">
                <thead>
                  <tr>
                    <th>Hammadde</th>
                    <th>Miktar</th>
                    <th>Birim</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRecord.ingredients.length === 0 && (
                    <tr><td colSpan={4} className="empty-cell">Henüz malzeme bulunmuyor.</td></tr>
                  )}
                  {selectedRecord.ingredients.map(ingredient => (
                    <tr key={ingredient.id}>
                      <td><strong>{ingredient.materialName}</strong></td>
                      <td>{formatNumber(ingredient.quantity)}</td>
                      <td>{ingredient.unit}</td>
                      <td className="actions-cell">
                        <button className="btn" type="button" onClick={() => startEditIngredient(ingredient)}>Düzenle</button>
                        <button className="btn danger" type="button" onClick={() => deleteIngredient(ingredient)}>Sil</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {ingredientFormVisible ? renderIngredientForm() : (
              <div className="recipe-ingredient-add-row">
                <button className="btn primary" type="button" onClick={startAddIngredient}>+ Malzeme Ekle</button>
              </div>
            )}
          </section>

          <aside className="card recipe-detail-summary">
            <div className="section-header compact">
              <h3>Reçete Kartı</h3>
              <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>{selectedRecord.status}</span>
            </div>
            <div className="recipe-summary-grid">
              <div><span>Kod</span><strong>{selectedRecord.code}</strong></div>
              <div><span>Reçete Adı</span><strong>{selectedRecord.recipeName}</strong></div>
              <div><span>Reçete Türü</span><strong>{selectedRecord.recipeType}</strong></div>
              <div><span>Ürün</span><strong>{selectedRecord.productName}</strong></div>
              <div><span>Porsiyon</span><strong>{formatNumber(selectedRecord.portions)}</strong></div>
              <div><span>Malzeme Sayısı</span><strong>{selectedRecord.ingredients.length}</strong></div>
              <div><span>Toplam Gramaj</span><strong>{formatNumber(calculateTotalGrams(selectedRecord.ingredients))} gr</strong></div>
              <div><span>Tahmini Toplam Maliyet</span><strong>Hesaplanmadı</strong></div>
              <div><span>Son Güncelleme</span><strong>{formatDateTime(selectedRecord.updatedAt || selectedRecord.createdAt)}</strong></div>
              <div><span>Açıklama</span><strong>{selectedRecord.description || '-'}</strong></div>
            </div>
          </aside>
        </div>
      </div>
    )
  }

  if(viewMode === 'detail'){
    return renderDetailScreen()
  }

  return (
    <div className="recipes-page">
      <div className="page-title">
        <div>
          <h2>Reçete Yönetimi</h2>
          <p className="muted">Endüstriyel mutfak standart reçete kartlarını ve reçete malzemelerini yönetin.</p>
        </div>
      </div>

      {toast && (
        <div className={`recipe-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Toplam Reçete</span>
          <strong>{totalRecipes}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Aktif Reçete</span>
          <strong>{activeRecipes}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Malzeme</span>
          <strong>{totalIngredients}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Porsiyon</span>
          <strong>{formatNumber(totalPortions)}</strong>
        </div>
      </div>

      <div className="product-layout recipe-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Reçete Listesi</h3>
              <p className="muted">{visibleRecords.length} reçete gösteriliyor.</p>
            </div>
            <div className="recipe-filters">
              <button className="btn primary" type="button" onClick={startNewRecipe}>Yeni Reçete</button>
              <input
                type="search"
                placeholder="Kod, reçete veya ürün ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm Durumlar</option>
                {RECIPE_MANAGEMENT_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table recipe-table">
              <colgroup>
                <col className="recipe-col-code" />
                <col className="recipe-col-name" />
                <col className="recipe-col-type" />
                <col className="recipe-col-product" />
                <col className="recipe-col-portion" />
                <col className="recipe-col-ingredients" />
                <col className="recipe-col-status" />
                <col className="recipe-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Reçete Adı</th>
                  <th>Reçete Türü</th>
                  <th>Ürün</th>
                  <th>Porsiyon</th>
                  <th>Malzeme Sayısı</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      <div className="recipe-empty-list">
                        <strong>Henüz reçete bulunmuyor.</strong>
                        <span>İlk reçeteyi oluşturmak için "Yeni Reçete" butonunu kullanabilirsiniz.</span>
                        <button className="btn primary" type="button" onClick={startNewRecipe}>Yeni Reçete</button>
                      </div>
                    </td>
                  </tr>
                )}
                {records.length > 0 && visibleRecords.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Filtrelere uygun reçete bulunamadı.</td></tr>
                )}
                {visibleRecords.map(record => (
                  <tr
                    key={record.id}
                    className={record.id === selectedRecordId ? 'selected-row' : ''}
                    onClick={() => {
                      setSelectedRecordId(record.id)
                      setPanelMode('summary')
                    }}
                    onDoubleClick={() => openDetail(record)}
                  >
                    <td><strong>{record.code}</strong></td>
                    <td>
                      <strong>{record.recipeName}</strong>
                      {record.description && <div className="muted small-text">{record.description}</div>}
                    </td>
                    <td>{record.recipeType}</td>
                    <td>{record.productName}</td>
                    <td>{formatNumber(record.portions)}</td>
                    <td>{record.ingredients.length}</td>
                    <td><span className={`status-pill ${getStatusClass(record.status)}`}>{record.status}</span></td>
                    <td className="actions-cell">
                      <button
                        className="btn"
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          openDetail(record)
                        }}
                      >
                        Detay
                      </button>
                      <button
                        className="btn"
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          startEditRecipe(record)
                        }}
                      >
                        Düzenle
                      </button>
                      <button
                        className="btn danger"
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          deleteRecipe(record)
                        }}
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side recipe-side">
          {panelMode === 'form' ? renderRecipeFormPanel() : renderSummaryPanel()}
        </aside>
      </div>
    </div>
  )
}
