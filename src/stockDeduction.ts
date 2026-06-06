import {
  Order,
  OrderRecipeSnapshot,
  Product,
  Recipe,
  RecipeItem,
  StockDeductionAuditEventType,
  StockDeductionBatch,
  StockDeductionLine,
  StockDeductionSourceType,
  StockDeductionStatus,
  StockItem,
  StockUnit,
  User
} from './types'
import {
  addActionLog,
  addStockDeductionAuditEvent,
  addStockDeductionBatch,
  applyStockMovement,
  loadRecipes,
  loadStockDeductionBatches,
  loadStockItems,
  saveStockDeductionBatches
} from './storage'

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
const getUserName = (user: User) => user.fullName || user.username

const formatQty = (value: number, unit: StockUnit) => {
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
}

const roundStockQty = (value: number) => {
  return Math.round((value + Number.EPSILON) * 1000000) / 1000000
}

const convertQuantity = (qty: number, fromUnit: StockUnit, toUnit: StockUnit) => {
  if(fromUnit === toUnit) return qty
  if(fromUnit === 'gr' && toUnit === 'kg') return qty / 1000
  if(fromUnit === 'kg' && toUnit === 'gr') return qty * 1000
  if(fromUnit === 'ml' && toUnit === 'lt') return qty / 1000
  if(fromUnit === 'lt' && toUnit === 'ml') return qty * 1000
  return null
}

const getRecipeSnapshotKey = (snapshot?: OrderRecipeSnapshot) => {
  return snapshot ? `${snapshot.recipeId}_${snapshot.recipeVersion}` : 'no_recipe'
}

export const captureActiveRecipeSnapshot = (productId: string): OrderRecipeSnapshot | undefined => {
  const recipe = loadRecipes().find(item => item.productId === productId && item.active && !item.deletedAt)
  if(!recipe) return undefined

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeVersion: recipe.recipeVersion,
    productId: recipe.productId,
    productName: recipe.productName,
    items: recipe.items.map(item => ({ ...item })),
    capturedAt: new Date().toISOString()
  }
}

export const orderMatchesRecipeSnapshot = (
  order: Order,
  productId: string,
  unitPrice: number,
  isGift: boolean,
  recipeSnapshot?: OrderRecipeSnapshot
) => {
  return order.productId === productId
    && (order.unitPrice ?? unitPrice) === unitPrice
    && Boolean(order.isGift) === isGift
    && getRecipeSnapshotKey(order.recipeSnapshot) === getRecipeSnapshotKey(recipeSnapshot)
}

const appendOrderDeductionData = (
  order: Order,
  batch: StockDeductionBatch,
  recipeSnapshot: OrderRecipeSnapshot | undefined,
  deductedQty: number
): Order => {
  const warnings = [...(order.stockDeductionWarnings || []), ...batch.warnings, ...batch.errors]

  return {
    ...order,
    recipeId: recipeSnapshot?.recipeId || order.recipeId,
    recipeVersion: recipeSnapshot?.recipeVersion || order.recipeVersion,
    recipeSnapshot: recipeSnapshot || order.recipeSnapshot,
    stockDeductionStatus: batch.status,
    stockDeductionBatchIds: [...(order.stockDeductionBatchIds || []), batch.id],
    stockDeductedQty: roundStockQty((order.stockDeductedQty || 0) + deductedQty),
    stockDeductionWarnings: warnings
  }
}

const addDeductionAudit = (
  batch: StockDeductionBatch,
  eventType: StockDeductionAuditEventType,
  user: User,
  before: unknown,
  after: unknown,
  note: string
) => {
  addStockDeductionAuditEvent({
    id: createId('stock_deduction_audit'),
    batchId: batch.id,
    orderId: batch.orderId,
    productId: batch.productId,
    eventType,
    userId: user.id,
    userName: getUserName(user),
    tableId: batch.tableId,
    tableName: batch.tableName,
    timestamp: new Date().toISOString(),
    before,
    after,
    note
  })
}

const getDeductionLogType = (status: StockDeductionStatus) => {
  if(status === 'failed') return 'Otomatik stok düşümü başarısız' as const
  if(status === 'warning' || status === 'missing_recipe') return 'Otomatik stok düşümü uyarısı' as const
  return 'Otomatik stok düşümü yapıldı' as const
}

const buildSkippedBatch = ({
  order,
  product,
  tableId,
  tableName,
  qty,
  sourceType,
  user,
  warning
}: {
  order: Order
  product: Product
  tableId: string
  tableName: string
  qty: number
  sourceType: StockDeductionSourceType
  user: User
  warning: string
}): StockDeductionBatch => ({
  id: createId('stock_deduction'),
  orderId: order.id,
  tableId,
  tableName,
  productId: product.id,
  productName: product.name,
  qty,
  remainingQty: 0,
  sourceType,
  status: 'missing_recipe',
  movementIds: [],
  lines: [],
  warnings: [warning],
  errors: [],
  createdAt: new Date().toISOString(),
  createdByUserId: user.id,
  createdByFullName: getUserName(user)
})

export const deductStockForOrder = ({
  order,
  product,
  tableId,
  tableName,
  qty,
  user,
  sourceType,
  recipeSnapshot
}: {
  order: Order
  product: Product
  tableId: string
  tableName: string
  qty: number
  user: User
  sourceType: StockDeductionSourceType
  recipeSnapshot?: OrderRecipeSnapshot
}) => {
  const normalizedQty = Math.max(0, Number(qty) || 0)
  const snapshot = recipeSnapshot ?? order.recipeSnapshot ?? captureActiveRecipeSnapshot(product.id)

  if(normalizedQty <= 0){
    return { order, batch: undefined, warnings: [] as string[], errors: [] as string[] }
  }

  if(!snapshot){
    const warning = `${product.name} için aktif reçete bulunamadı. Stok düşümü yapılmadı.`
    const batch = buildSkippedBatch({ order, product, tableId, tableName, qty: normalizedQty, sourceType, user, warning })

    addStockDeductionBatch(batch)
    addDeductionAudit(batch, 'skipped', user, undefined, batch, warning)
    addActionLog({
      operationType: 'Otomatik stok düşümü uyarısı',
      user,
      tableId,
      tableName,
      description: `${tableName} üzerinde ${product.name} x${normalizedQty} için aktif reçete bulunamadı. Siparişe izin verildi, stok düşümü atlandı.`
    })

    return {
      order: appendOrderDeductionData(order, batch, undefined, 0),
      batch,
      warnings: [warning],
      errors: [] as string[]
    }
  }

  const stockItems = loadStockItems()
  const lines: StockDeductionLine[] = []
  const movementIds: string[] = []
  const warnings: string[] = []
  const errors: string[] = []
  const batchId = createId('stock_deduction')
  const now = new Date().toISOString()

  snapshot.items.forEach((recipeItem: RecipeItem) => {
    const stockItem = stockItems.find(item => item.id === recipeItem.stockItemId)
    const recipeQtyWithWaste = recipeItem.qty * (1 + Math.max(0, recipeItem.wastePercent || 0) / 100)
    const requestedQty = recipeQtyWithWaste * normalizedQty

    if(!stockItem){
      const error = `${recipeItem.stockItemName} stok kartı bulunamadı.`
      errors.push(error)
      lines.push({
        id: createId('stock_deduction_line'),
        stockItemId: recipeItem.stockItemId,
        stockItemName: recipeItem.stockItemName,
        qty: 0,
        unit: recipeItem.unit,
        recipeQty: recipeItem.qty,
        recipeUnit: recipeItem.unit,
        wastePercent: recipeItem.wastePercent,
        error
      })
      return
    }

    const convertedQty = convertQuantity(requestedQty, recipeItem.unit, stockItem.unit)
    if(convertedQty === null){
      const error = `${recipeItem.stockItemName} için ${recipeItem.unit} -> ${stockItem.unit} birim dönüşümü yapılamadı.`
      errors.push(error)
      lines.push({
        id: createId('stock_deduction_line'),
        stockItemId: stockItem.id,
        stockItemName: stockItem.name,
        qty: 0,
        unit: stockItem.unit,
        recipeQty: recipeItem.qty,
        recipeUnit: recipeItem.unit,
        wastePercent: recipeItem.wastePercent,
        error
      })
      return
    }

    const stockQty = roundStockQty(convertedQty)
    const warning = stockItem.currentQty < stockQty
      ? `${stockItem.name} stoğu yetersiz: mevcut ${formatQty(stockItem.currentQty, stockItem.unit)}, ihtiyaç ${formatQty(stockQty, stockItem.unit)}. Negatif stokla devam edildi.`
      : undefined

    if(warning) warnings.push(warning)

    try {
      const movement = applyStockMovement({
        stockItemId: stockItem.id,
        type: 'Çıkış',
        source: 'Adisyon',
        reason: 'Kullanım',
        qty: stockQty,
        description: `${tableName} ${product.name} x${normalizedQty} otomatik stok düşümü. Reçete: ${snapshot.recipeName} v${snapshot.recipeVersion}.`,
        user,
        allowNegativeStock: true,
        sourceEntityType: sourceType,
        sourceEntityId: order.id,
        tableId,
        tableName,
        orderId: order.id,
        recipeId: snapshot.recipeId,
        recipeVersion: snapshot.recipeVersion,
        deductionBatchId: batchId
      })

      if(movement.criticalStockEvent?.eventType === 'entered'){
        warnings.push(`${stockItem.name} kritik stok seviyesine düştü: mevcut ${formatQty(movement.criticalStockEvent.nextQty, stockItem.unit)}, kritik seviye ${formatQty(movement.criticalStockEvent.minQty, stockItem.unit)}.`)
      }

      movementIds.push(movement.id)
      lines.push({
        id: createId('stock_deduction_line'),
        stockItemId: stockItem.id,
        stockItemName: stockItem.name,
        qty: stockQty,
        unit: stockItem.unit,
        recipeQty: recipeItem.qty,
        recipeUnit: recipeItem.unit,
        wastePercent: recipeItem.wastePercent,
        movementId: movement.id,
        warning
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stok düşümü oluşturulamadı.'
      errors.push(`${stockItem.name}: ${message}`)
      lines.push({
        id: createId('stock_deduction_line'),
        stockItemId: stockItem.id,
        stockItemName: stockItem.name,
        qty: stockQty,
        unit: stockItem.unit,
        recipeQty: recipeItem.qty,
        recipeUnit: recipeItem.unit,
        wastePercent: recipeItem.wastePercent,
        error: message
      })
    }
  })

  const status: StockDeductionStatus = movementIds.length === 0
    ? 'failed'
    : warnings.length > 0 || errors.length > 0
      ? 'warning'
      : 'deducted'
  const batch: StockDeductionBatch = {
    id: batchId,
    orderId: order.id,
    tableId,
    tableName,
    productId: product.id,
    productName: product.name,
    qty: normalizedQty,
    remainingQty: movementIds.length > 0 ? normalizedQty : 0,
    sourceType,
    status,
    recipeId: snapshot.recipeId,
    recipeVersion: snapshot.recipeVersion,
    recipeSnapshot: snapshot,
    movementIds,
    lines,
    warnings,
    errors,
    createdAt: now,
    createdByUserId: user.id,
    createdByFullName: getUserName(user)
  }
  const auditType: StockDeductionAuditEventType = status === 'failed' ? 'failed' : status === 'warning' ? 'warning' : 'deducted'

  addStockDeductionBatch(batch)
  addDeductionAudit(batch, auditType, user, undefined, batch, `${product.name} x${normalizedQty} için otomatik stok düşümü ${status === 'failed' ? 'başarısız oldu' : 'oluşturuldu'}.`)
  addActionLog({
    operationType: getDeductionLogType(status),
    user,
    tableId,
    tableName,
    description: `${tableName} üzerinde ${product.name} x${normalizedQty} için otomatik stok düşümü ${status === 'failed' ? 'başarısız oldu' : 'oluşturuldu'}. Reçete: ${snapshot.recipeName} v${snapshot.recipeVersion}.${warnings.length > 0 ? ` Uyarı: ${warnings.join(' | ')}.` : ''}${errors.length > 0 ? ` Hata: ${errors.join(' | ')}.` : ''}`
  })

  return {
    order: appendOrderDeductionData(order, batch, snapshot, movementIds.length > 0 ? normalizedQty : 0),
    batch,
    warnings,
    errors
  }
}

export const reverseStockDeductionForOrderQty = ({
  order,
  tableId,
  tableName,
  qty,
  user,
  sourceType
}: {
  order: Order
  tableId: string
  tableName: string
  qty: number
  user: User
  sourceType: StockDeductionSourceType
}) => {
  const normalizedQty = Math.max(0, Number(qty) || 0)
  const deductedQty = Math.max(0, order.stockDeductedQty || 0)
  let remainingToReverse = Math.min(normalizedQty, deductedQty)
  const warnings: string[] = []
  const reverseMovementIds: string[] = []

  if(remainingToReverse <= 0){
    return { order, reversedQty: 0, warnings: [] as string[] }
  }

  const batches = loadStockDeductionBatches()
  const batchIds = [...(order.stockDeductionBatchIds || [])].reverse()
  const nextBatches = [...batches]

  batchIds.forEach(batchId => {
    if(remainingToReverse <= 0) return

    const batchIndex = nextBatches.findIndex(batch => batch.id === batchId)
    const batch = batchIndex >= 0 ? nextBatches[batchIndex] : undefined
    if(!batch || batch.remainingQty <= 0 || batch.movementIds.length === 0) return

    const reverseProductQty = roundStockQty(Math.min(remainingToReverse, batch.remainingQty))
    const ratio = batch.qty > 0 ? reverseProductQty / batch.qty : 0
    const before = batch
    const updatedLines = batch.lines.map(line => {
      if(!line.movementId || line.qty <= 0 || ratio <= 0) return line

      const reverseQty = roundStockQty(line.qty * ratio)
      if(reverseQty <= 0) return line

      try {
        const movement = applyStockMovement({
          stockItemId: line.stockItemId,
          type: 'Giriş',
          source: 'Adisyon',
          reason: 'Ters Hareket',
          qty: reverseQty,
          description: `${tableName} ${batch.productName} ${sourceType} nedeniyle otomatik stok iadesi. Orijinal batch: ${batch.id}.`,
          user,
          sourceEntityType: sourceType,
          sourceEntityId: order.id,
          tableId,
          tableName,
          orderId: order.id,
          recipeId: batch.recipeId,
          recipeVersion: batch.recipeVersion,
          reverseOfBatchId: batch.id,
          reverseMode: reverseProductQty >= batch.remainingQty ? 'full' : 'partial'
        })

        reverseMovementIds.push(movement.id)
        return {
          ...line,
          reverseMovementIds: [...(line.reverseMovementIds || []), movement.id]
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Ters stok hareketi oluşturulamadı.'
        warnings.push(`${line.stockItemName}: ${message}`)
        return line
      }
    })

    const nextRemainingQty = roundStockQty(Math.max(0, batch.remainingQty - reverseProductQty))
    const nextBatch: StockDeductionBatch = {
      ...batch,
      remainingQty: nextRemainingQty,
      status: nextRemainingQty === 0 ? 'reversed' : 'partial_reversed',
      lines: updatedLines,
      updatedAt: new Date().toISOString()
    }

    nextBatches[batchIndex] = nextBatch
    remainingToReverse = roundStockQty(Math.max(0, remainingToReverse - reverseProductQty))
    addDeductionAudit(nextBatch, 'reversed', user, before, nextBatch, `${batch.productName} için ${formatQty(reverseProductQty, 'adet')} ürün karşılığı stok iadesi oluşturuldu.`)
  })

  saveStockDeductionBatches(nextBatches)

  const reversedQty = roundStockQty(Math.min(normalizedQty, deductedQty) - remainingToReverse)
  if(reversedQty > 0){
    addActionLog({
      operationType: 'Otomatik stok düşümü terslendi',
      user,
      tableId,
      tableName,
      description: `${tableName} üzerinde ${order.productName || 'Ürün'} için ${reversedQty.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} adetlik otomatik stok düşümü terslendi.${warnings.length > 0 ? ` Uyarı: ${warnings.join(' | ')}.` : ''}`
    })
  }

  if(remainingToReverse > 0){
    warnings.push(`${order.productName || 'Ürün'} için ${remainingToReverse.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} adetlik stok düşümü terslenemedi.`)
  }

  const nextDeductedQty = roundStockQty(Math.max(0, deductedQty - reversedQty))
  const nextOrder: Order = {
    ...order,
    stockDeductedQty: nextDeductedQty,
    stockDeductionStatus: nextDeductedQty === 0 ? 'reversed' : 'partial_reversed',
    stockDeductionWarnings: [...(order.stockDeductionWarnings || []), ...warnings]
  }

  return { order: nextOrder, reversedQty, warnings, reverseMovementIds }
}
