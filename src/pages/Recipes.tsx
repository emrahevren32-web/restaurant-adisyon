import React from 'react'
import { Product, Recipe, RecipeAuditEvent, User } from '../types'
import {
  addActionLog,
  addRecipeAuditEvent,
  loadProducts,
  loadRecipeAuditEvents,
  loadRecipes,
  loadStockItems,
  saveRecipes
} from '../storage'
import RecipeForm, { RecipeFormValues, calculateRecipeCost } from '../components/RecipeForm'
import { formatCurrency } from '../billing'

type Props = { currentUser: User }
type StatusFilter = 'all' | 'active' | 'inactive' | 'deleted'

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

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

const getUserName = (user: User) => user.fullName || user.username

const getNextRecipeVersion = (recipes: Recipe[], productId: string) => {
  const maxVersion = recipes
    .filter(recipe => recipe.productId === productId)
    .reduce((max, recipe) => Math.max(max, recipe.recipeVersion || recipe.version || 1), 0)

  return maxVersion + 1
}

const getAuditLabel = (event: RecipeAuditEvent) => {
  if(event.eventType === 'updated') return 'Güncellendi'
  if(event.eventType === 'deleted') return 'Silindi'
  if(event.eventType === 'copied') return 'Kopyalandı'
  if(event.eventType === 'activated') return 'Aktif yapıldı'
  if(event.eventType === 'deactivated') return 'Pasif yapıldı'
  return 'Oluşturuldu'
}

export default function Recipes({ currentUser }: Props){
  const [products, setProducts] = React.useState<Product[]>(() => loadProducts())
  const [stockItems, setStockItems] = React.useState(() => loadStockItems())
  const [recipes, setRecipes] = React.useState<Recipe[]>(() => loadRecipes())
  const [auditEvents, setAuditEvents] = React.useState<RecipeAuditEvent[]>(() => loadRecipeAuditEvents())
  const [editingRecipe, setEditingRecipe] = React.useState<Recipe | null>(null)
  const [search, setSearch] = React.useState('')
  const [productFilter, setProductFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const canManageRecipes = currentUser.role === 'Admin'

  const refreshData = React.useCallback(() => {
    setProducts(loadProducts())
    setStockItems(loadStockItems())
    setRecipes(loadRecipes())
    setAuditEvents(loadRecipeAuditEvents())
  }, [])

  React.useEffect(() => {
    refreshData()
    window.addEventListener('storage', refreshData)
    return () => window.removeEventListener('storage', refreshData)
  }, [refreshData])

  const activeProducts = React.useMemo(() => products.filter(product => product.active), [products])
  const formProducts = React.useMemo(() => {
    const selectableProducts = products.filter(product => product.active || product.id === editingRecipe?.productId)
    return selectableProducts.length > 0 ? selectableProducts : products
  }, [editingRecipe, products])
  const formStockItems = React.useMemo(() => {
    const recipeStockIds = new Set(editingRecipe?.items.map(item => item.stockItemId) || [])
    return stockItems.filter(item => item.active || recipeStockIds.has(item.id))
  }, [editingRecipe, stockItems])

  const auditByRecipe = React.useMemo(() => {
    return auditEvents.reduce<Record<string, RecipeAuditEvent[]>>((acc, event) => {
      acc[event.recipeId] = acc[event.recipeId] || []
      acc[event.recipeId].push(event)
      return acc
    }, {})
  }, [auditEvents])

  const activeRecipeProductIds = React.useMemo(() => {
    return new Set(recipes.filter(recipe => recipe.active && !recipe.deletedAt).map(recipe => recipe.productId))
  }, [recipes])

  const visibleRecipes = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return [...recipes]
      .filter(recipe => {
        const matchesSearch = !normalizedSearch
          || recipe.name.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
          || recipe.productName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
          || recipe.items.some(item => item.stockItemName.toLocaleLowerCase('tr-TR').includes(normalizedSearch))
          || (recipe.note || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)

        const matchesProduct = productFilter === 'all' || recipe.productId === productFilter
        const matchesStatus = statusFilter === 'all'
          || (statusFilter === 'active' && recipe.active && !recipe.deletedAt)
          || (statusFilter === 'inactive' && !recipe.active && !recipe.deletedAt)
          || (statusFilter === 'deleted' && Boolean(recipe.deletedAt))

        return matchesSearch && matchesProduct && matchesStatus
      })
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
  }, [productFilter, recipes, search, statusFilter])

  const liveRecipes = recipes.filter(recipe => !recipe.deletedAt)
  const activeRecipeCount = liveRecipes.filter(recipe => recipe.active).length
  const missingCostCount = liveRecipes.filter(recipe => (recipe.costSnapshot?.missingCostItemCount || 0) > 0).length
  const productsWithoutActiveRecipeCount = activeProducts.filter(product => !activeRecipeProductIds.has(product.id)).length

  const createAuditEvent = (
    recipeId: string,
    eventType: RecipeAuditEvent['eventType'],
    before: unknown,
    after: unknown,
    note: string
  ) => {
    addRecipeAuditEvent({
      id: createId('recipe_audit'),
      recipeId,
      eventType,
      userId: currentUser.id,
      userName: getUserName(currentUser),
      timestamp: new Date().toISOString(),
      before,
      after,
      note
    })
  }

  const saveRecipeList = (
    nextRecipes: Recipe[],
    auditEntries: Array<{
      recipeId: string
      eventType: RecipeAuditEvent['eventType']
      before: unknown
      after: unknown
      note: string
    }>
  ) => {
    saveRecipes(nextRecipes)
    auditEntries.forEach(entry => createAuditEvent(entry.recipeId, entry.eventType, entry.before, entry.after, entry.note))
    refreshData()
  }

  const applySingleActiveRule = (draftRecipe: Recipe, sourceRecipes: Recipe[], now: string) => {
    const auditEntries: Array<{
      recipeId: string
      eventType: RecipeAuditEvent['eventType']
      before: Recipe
      after: Recipe
      note: string
    }> = []

    const nextRecipes = sourceRecipes.map(recipe => {
      if(recipe.id === draftRecipe.id) return draftRecipe

      if(draftRecipe.active && recipe.productId === draftRecipe.productId && recipe.active && !recipe.deletedAt){
        const nextRecipe: Recipe = {
          ...recipe,
          active: false,
          updatedAt: now,
          updatedByUserId: currentUser.id,
          updatedByFullName: getUserName(currentUser)
        }

        auditEntries.push({
          recipeId: recipe.id,
          eventType: 'deactivated',
          before: recipe,
          after: nextRecipe,
          note: `${draftRecipe.productName} için tek aktif reçete kuralı gereği pasif yapıldı.`
        })

        return nextRecipe
      }

      return recipe
    })

    return { nextRecipes, auditEntries }
  }

  const saveRecipe = (values: RecipeFormValues) => {
    if(!canManageRecipes){
      setMessage({ type: 'error', text: 'Bu işlem için Admin yetkisi gereklidir.' })
      return
    }

    const product = products.find(item => item.id === values.productId)
    if(!product){
      setMessage({ type: 'error', text: 'Seçilen ürün bulunamadı.' })
      return
    }

    const now = new Date().toISOString()
    const costCalculation = calculateRecipeCost(values.items, stockItems)
    const costSnapshot = {
      totalCost: costCalculation.totalCost,
      missingCostItemCount: costCalculation.missingCostItemCount,
      calculatedAt: costCalculation.calculatedAt
    }

    if(editingRecipe){
      const nextVersion = Math.max(editingRecipe.recipeVersion || 1, editingRecipe.version || 1) + 1
      const updatedRecipe: Recipe = {
        ...editingRecipe,
        productId: product.id,
        productName: product.name,
        name: values.name,
        active: values.active && !editingRecipe.deletedAt,
        items: values.items,
        note: values.note,
        costSnapshot,
        version: nextVersion,
        recipeVersion: nextVersion,
        updatedAt: now,
        updatedByUserId: currentUser.id,
        updatedByFullName: getUserName(currentUser)
      }

      const { nextRecipes, auditEntries } = applySingleActiveRule(updatedRecipe, recipes, now)
      saveRecipeList(nextRecipes, [
        {
          recipeId: updatedRecipe.id,
          eventType: 'updated',
          before: editingRecipe,
          after: updatedRecipe,
          note: `${updatedRecipe.productName} reçetesi güncellendi. Versiyon: ${updatedRecipe.recipeVersion}.`
        },
        ...auditEntries
      ])
      addActionLog({
        operationType: 'Reçete güncellendi',
        user: currentUser,
        description: `${getUserName(currentUser)} ${updatedRecipe.productName} için ${updatedRecipe.name} reçetesini güncelledi. Versiyon: ${updatedRecipe.recipeVersion}. Maliyet: ${formatCurrency(updatedRecipe.costSnapshot?.totalCost || 0)}.`
      })
      setEditingRecipe(null)
      setMessage({ type: 'success', text: `${updatedRecipe.productName} reçetesi güncellendi.` })
      return
    }

    const nextVersion = getNextRecipeVersion(recipes, product.id)
    const recipe: Recipe = {
      id: createId('recipe'),
      productId: product.id,
      productName: product.name,
      name: values.name,
      version: nextVersion,
      recipeVersion: nextVersion,
      active: values.active,
      items: values.items,
      note: values.note,
      costSnapshot,
      createdAt: now,
      updatedAt: now,
      createdByUserId: currentUser.id,
      createdByFullName: getUserName(currentUser),
      updatedByUserId: currentUser.id,
      updatedByFullName: getUserName(currentUser)
    }
    const { nextRecipes, auditEntries } = applySingleActiveRule(recipe, [recipe, ...recipes], now)

    saveRecipeList(nextRecipes, [
      {
        recipeId: recipe.id,
        eventType: 'created',
        before: undefined,
        after: recipe,
        note: `${recipe.productName} için ${recipe.name} reçetesi oluşturuldu.`
      },
      ...auditEntries
    ])
    addActionLog({
      operationType: 'Reçete oluşturuldu',
      user: currentUser,
      description: `${getUserName(currentUser)} ${recipe.productName} için ${recipe.name} reçetesini oluşturdu. Versiyon: ${recipe.recipeVersion}. Maliyet: ${formatCurrency(recipe.costSnapshot?.totalCost || 0)}.`
    })
    setMessage({ type: 'success', text: `${recipe.productName} reçetesi oluşturuldu.` })
  }

  const copyRecipe = (recipe: Recipe) => {
    if(!canManageRecipes) return

    const now = new Date().toISOString()
    const copiedVersion = getNextRecipeVersion(recipes, recipe.productId)
    const costCalculation = calculateRecipeCost(recipe.items, stockItems)
    const copiedRecipe: Recipe = {
      ...recipe,
      id: createId('recipe'),
      name: `${recipe.name} Kopya`,
      active: false,
      version: copiedVersion,
      recipeVersion: copiedVersion,
      items: recipe.items.map(item => ({ ...item, id: createId('recipe_item') })),
      costSnapshot: {
        totalCost: costCalculation.totalCost,
        missingCostItemCount: costCalculation.missingCostItemCount,
        calculatedAt: now
      },
      createdAt: now,
      updatedAt: now,
      createdByUserId: currentUser.id,
      createdByFullName: getUserName(currentUser),
      updatedByUserId: currentUser.id,
      updatedByFullName: getUserName(currentUser),
      copiedFromRecipeId: recipe.id,
      deletedAt: undefined,
      deletedByUserId: undefined,
      deletedByFullName: undefined
    }

    saveRecipeList([copiedRecipe, ...recipes], [
      {
        recipeId: copiedRecipe.id,
        eventType: 'copied',
        before: recipe,
        after: copiedRecipe,
        note: `${recipe.name} reçetesinden kopya oluşturuldu.`
      }
    ])
    addActionLog({
      operationType: 'Reçete kopyalandı',
      user: currentUser,
      description: `${getUserName(currentUser)} ${recipe.productName} için ${recipe.name} reçetesini kopyaladı. Yeni versiyon: ${copiedRecipe.recipeVersion}.`
    })
    setMessage({ type: 'success', text: `${copiedRecipe.productName} reçetesi kopyalandı.` })
  }

  const toggleRecipeStatus = (recipe: Recipe) => {
    if(!canManageRecipes || recipe.deletedAt) return

    const now = new Date().toISOString()
    const nextRecipe: Recipe = {
      ...recipe,
      active: !recipe.active,
      updatedAt: now,
      updatedByUserId: currentUser.id,
      updatedByFullName: getUserName(currentUser)
    }

    const { nextRecipes, auditEntries } = applySingleActiveRule(nextRecipe, recipes, now)
    const eventType: RecipeAuditEvent['eventType'] = nextRecipe.active ? 'activated' : 'deactivated'

    saveRecipeList(nextRecipes, [
      {
        recipeId: recipe.id,
        eventType,
        before: recipe,
        after: nextRecipe,
        note: `${recipe.productName} reçetesi ${nextRecipe.active ? 'aktif' : 'pasif'} yapıldı.`
      },
      ...auditEntries
    ])
    addActionLog({
      operationType: nextRecipe.active ? 'Reçete aktif yapıldı' : 'Reçete pasif yapıldı',
      user: currentUser,
      description: `${getUserName(currentUser)} ${recipe.productName} için ${recipe.name} reçetesini ${nextRecipe.active ? 'aktif' : 'pasif'} yaptı.`
    })
    setMessage({ type: 'success', text: `${recipe.productName} reçetesi ${nextRecipe.active ? 'aktif' : 'pasif'} yapıldı.` })
  }

  const deleteRecipe = (recipe: Recipe) => {
    if(!canManageRecipes || recipe.deletedAt) return
    if(!confirm(`${recipe.productName} için ${recipe.name} reçetesi silinecek. Geçmiş kayıtlar korunacak. Devam etmek istiyor musunuz?`)) return

    const now = new Date().toISOString()
    const deletedRecipe: Recipe = {
      ...recipe,
      active: false,
      deletedAt: now,
      deletedByUserId: currentUser.id,
      deletedByFullName: getUserName(currentUser),
      updatedAt: now,
      updatedByUserId: currentUser.id,
      updatedByFullName: getUserName(currentUser)
    }
    const nextRecipes = recipes.map(item => item.id === recipe.id ? deletedRecipe : item)

    saveRecipeList(nextRecipes, [
      {
        recipeId: recipe.id,
        eventType: 'deleted',
        before: recipe,
        after: deletedRecipe,
        note: `${recipe.productName} reçetesi soft-delete olarak işaretlendi.`
      }
    ])
    addActionLog({
      operationType: 'Reçete silindi',
      user: currentUser,
      description: `${getUserName(currentUser)} ${recipe.productName} için ${recipe.name} reçetesini sildi. Geçmiş korundu.`
    })
    if(editingRecipe?.id === recipe.id) setEditingRecipe(null)
    setMessage({ type: 'success', text: `${recipe.productName} reçetesi silindi.` })
  }

  if(!canManageRecipes){
    return (
      <div className="recipes-page">
        <section className="card">
          <h2>Yetkisiz Erişim</h2>
          <p className="muted">Reçete yönetimi ekranını sadece Yönetici rolündeki kullanıcılar görebilir.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="recipes-page">
      <div className="page-title">
        <div>
          <h2>Reçete Yönetimi</h2>
          <p className="muted">Ürünlerin hangi hammaddelerden oluştuğunu, fire oranını, reçete maliyetini ve versiyon geçmişini yönetin.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Reçete</span>
          <strong>{liveRecipes.length}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Reçete</span>
          <strong>{activeRecipeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Reçetesiz Ürün</span>
          <strong>{productsWithoutActiveRecipeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Maliyet Uyarısı</span>
          <strong>{missingCostCount}</strong>
        </div>
      </div>

      <div className="product-layout recipe-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Reçete Listesi</h3>
              <p className="muted">{visibleRecipes.length} reçete gösteriliyor.</p>
            </div>
            <div className="recipe-filters">
              <input
                type="search"
                placeholder="Ürün, reçete veya hammadde ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={productFilter} onChange={event => setProductFilter(event.target.value)}>
                <option value="all">Tüm ürünler</option>
                {products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm durumlar</option>
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
                <option value="deleted">Silinenler</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table recipe-table">
              <thead>
                <tr>
                  <th>Ürün / Reçete</th>
                  <th>Versiyon</th>
                  <th>Durum</th>
                  <th>Hammaddeler</th>
                  <th>Maliyet</th>
                  <th>Kullanıcı</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleRecipes.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Filtrelere uygun reçete bulunamadı.</td></tr>
                )}
                {visibleRecipes.map(recipe => {
                  const history = auditByRecipe[recipe.id] || []
                  const missingCost = recipe.costSnapshot?.missingCostItemCount || 0

                  return (
                    <tr key={recipe.id}>
                      <td>
                        <strong>{recipe.productName}</strong>
                        <div className="muted small-text">{recipe.name}</div>
                        {recipe.note && <div className="muted small-text">{recipe.note}</div>}
                        {history.length > 0 && (
                          <details className="recipe-history-details">
                            <summary>Geçmiş ({history.length})</summary>
                            <ul className="qr-audit-list">
                              {history.slice(0, 5).map(event => (
                                <li key={event.id}>
                                  <strong>{getAuditLabel(event)}</strong>
                                  <span>{event.userName} · {formatDateTime(event.timestamp)}</span>
                                  {event.note && <small>{event.note}</small>}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                      <td>
                        <strong>v{recipe.recipeVersion}</strong>
                        <div className="muted small-text">Kayıt: v{recipe.version}</div>
                      </td>
                      <td>
                        {recipe.deletedAt ? (
                          <span className="status-pill danger-pill">Silindi</span>
                        ) : recipe.active ? (
                          <span className="status-pill success">Aktif</span>
                        ) : (
                          <span className="status-pill muted-pill">Pasif</span>
                        )}
                      </td>
                      <td>
                        <strong>{recipe.items.length} satır</strong>
                        <div className="muted small-text">
                          {recipe.items.slice(0, 3).map(item => `${item.stockItemName}: ${item.qty.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${item.unit}${item.wastePercent ? ` +%${item.wastePercent} fire` : ''}`).join(' · ') || '-'}
                        </div>
                      </td>
                      <td>
                        <strong>{formatCurrency(recipe.costSnapshot?.totalCost || 0)}</strong>
                        {missingCost > 0 && <div className="muted small-text recipe-cost-warning">{missingCost} satır hesaplanamadı</div>}
                      </td>
                      <td>
                        <strong>{recipe.updatedByFullName || recipe.createdByFullName}</strong>
                        <div className="muted small-text">{formatDateTime(recipe.updatedAt || recipe.createdAt)}</div>
                      </td>
                      <td className="actions-cell">
                        {!recipe.deletedAt && <button className="btn" onClick={() => setEditingRecipe(recipe)}>Düzenle</button>}
                        {!recipe.deletedAt && <button className="btn" onClick={() => copyRecipe(recipe)}>Kopyala</button>}
                        {!recipe.deletedAt && (
                          <button className="btn" onClick={() => toggleRecipeStatus(recipe)}>
                            {recipe.active ? 'Pasif Yap' : 'Aktif Yap'}
                          </button>
                        )}
                        {!recipe.deletedAt && <button className="btn" onClick={() => deleteRecipe(recipe)}>Sil</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side">
          <section className="card">
            <div className="section-header compact">
              <h3>{editingRecipe ? 'Reçete Düzenle' : 'Yeni Reçete'}</h3>
              {editingRecipe && <span className="status-pill">v{editingRecipe.recipeVersion}</span>}
            </div>
            <RecipeForm
              products={formProducts}
              stockItems={formStockItems}
              recipe={editingRecipe}
              onSave={saveRecipe}
              onCancel={editingRecipe ? () => setEditingRecipe(null) : undefined}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}
