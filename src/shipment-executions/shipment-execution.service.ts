import {
  resolveInventoryLotStatus
} from '../inventory-lots/inventory-lot.mock'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { ShipmentRecord } from '../shipments/shipment.types'
import {
  addActionLog,
  applyStockMovement,
  loadAllStockItems,
  saveStockItems,
  withBranchScope
} from '../storage'
import type {
  StockItem,
  StockMovement,
  StockUnit,
  User
} from '../types'
import type {
  ShipmentDeliveryResult,
  ShipmentExecutionItem,
  ShipmentExecutionItemStatus,
  ShipmentExecutionRecord,
  ShipmentExecutionStatus
} from './shipment-execution.types'

type QuantityPatch = Record<string, number>

type StockEffectResult = {
  execution: ShipmentExecutionRecord
  inventoryLots: InventoryLot[]
  movements: StockMovement[]
  createdInventoryLots: InventoryLot[]
}

const QUANTITY_ROUNDING_FACTOR = 1000
const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const getUserName = (user: User) => user.fullName || user.username

const getStockUnitCost = (item: StockItem) => {
  const cost = Number(item.averageCost ?? item.unitPurchasePrice ?? item.lastPurchasePrice ?? 0)
  return Number.isFinite(cost) && cost >= 0 ? cost : 0
}

// ═══════════════════════════════════════════════════════════════════════════
// STOK YAZMALARI ARTIK KAPIDAN GEÇİYOR (2026-08-31)
//
// Buradaki `buildStockMovement()` ve `recordMovementAudit()` silindi. İkisi de
// `applyStockMovement()`in — stoka yazan tek kapının — işini elle taklit
// ediyordu: hareketi kuruyor, önceki/sonraki bakiyeyi kendi hesaplıyor,
// denetim kaydını kendi düşüyordu. Kapıdaki hiçbir kural (SKT lotu tüketimi,
// ortalama maliyet, kritik stok uyarısı, negatif bakiye engeli) bu yoldan
// geçen harekete uygulanmıyordu.
//
// Kapıyı atlamasının sebebi dikkatsizlik değildi: kapı ŞUBE KAPSAMLI, sevkiyat
// ise şubeler ARASI. Eksik olan kapının kendisiydi. `withBranchScope()` bu
// boşluğu kapatıyor (bkz. storage.ts).
//
// İki aşamalı akış — önce PLAN, sonra YAZ:
//   Kapı her çağrıda anında yazar; eskisi ise hepsini biriktirip sonda tek
//   seferde yazıyordu. Doğrudan çevirseydik üçüncü kalem hata verdiğinde ilk
//   ikisi yazılmış olurdu — yarım kalmış bir sevkiyat, defterde iz bırakarak.
//   Bu yüzden önce bütün kalemler doğrulanıyor; tek bir sorun varsa HİÇBİR
//   hareket yazılmıyor.
// ═══════════════════════════════════════════════════════════════════════════

const findTargetStockItem = (
  stockItems: StockItem[],
  sourceItem: StockItem,
  targetBranchId: string
) => stockItems.find(item => (
  item.branchId === targetBranchId
  && item.name.trim().toLocaleLowerCase('tr-TR') === sourceItem.name.trim().toLocaleLowerCase('tr-TR')
  && item.unit === sourceItem.unit
))

const createTargetStockItem = (
  sourceItem: StockItem,
  targetBranchId: string,
  now: string
): StockItem => ({
  ...sourceItem,
  id: createId('shipment_target_stock'),
  branchId: targetBranchId,
  currentQty: 0,
  active: true,
  createdAt: now,
  updatedAt: now
})

const getDestinationWarehouseId = (shipment: ShipmentRecord) => (
  shipment.destinationWarehouseId || shipment.destinationBranchId
)

const getShipmentItemMap = (shipment: ShipmentRecord) => (
  new Map(shipment.items.map(item => [item.id, item]))
)

const updateExecutionStatus = (
  execution: ShipmentExecutionRecord,
  patch: Partial<ShipmentExecutionRecord>
): ShipmentExecutionRecord => ({
  ...execution,
  ...patch,
  updatedAt: new Date().toISOString()
})

const validateQuantityChain = (item: ShipmentExecutionItem) => {
  if(item.pickedQuantity > item.plannedQuantity){
    throw new Error('Picked Quantity, Planned Quantity değerini geçemez.')
  }
  if(item.packedQuantity > item.pickedQuantity){
    throw new Error('Packed Quantity, Picked Quantity değerini geçemez.')
  }
  if(item.shippedQuantity > item.packedQuantity){
    throw new Error('Shipped Quantity, Packed Quantity değerini geçemez.')
  }
  if(item.deliveredQuantity > item.shippedQuantity){
    throw new Error('Delivered Quantity, Shipped Quantity değerini geçemez.')
  }
}

const getItemDeliveryStatus = (item: ShipmentExecutionItem): ShipmentExecutionItemStatus => {
  if(item.status === 'CANCELLED') return 'CANCELLED'
  if(item.deliveredQuantity > 0 && item.deliveredQuantity < item.shippedQuantity) return 'PARTIAL'
  if(item.shippedQuantity > 0 && item.deliveredQuantity >= item.shippedQuantity) return 'DELIVERED'
  if(item.shippedQuantity > 0) return 'SHIPPED'
  if(item.packedQuantity > 0) return 'PACKED'
  if(item.pickedQuantity > 0) return 'PICKED'
  return 'PENDING'
}

const normalizeExecutionItems = (items: ShipmentExecutionItem[]) => (
  items.map(item => {
    const nextItem = {
      ...item,
      plannedQuantity: roundQuantity(item.plannedQuantity),
      pickedQuantity: roundQuantity(item.pickedQuantity),
      packedQuantity: roundQuantity(item.packedQuantity),
      shippedQuantity: roundQuantity(item.shippedQuantity),
      deliveredQuantity: roundQuantity(item.deliveredQuantity),
      remainingQuantity: roundQuantity(Math.max(0, item.plannedQuantity - item.deliveredQuantity)),
      status: getItemDeliveryStatus(item)
    }

    validateQuantityChain(nextItem)
    return nextItem
  })
)

export const startShipmentPicking = (
  execution: ShipmentExecutionRecord,
  user: User
): ShipmentExecutionRecord => {
  if(execution.status !== 'PENDING') throw new Error('Picking yalnızca PENDING durumunda başlatılabilir.')
  const now = new Date().toISOString()

  return updateExecutionStatus(execution, {
    status: 'PICKING',
    pickedBy: getUserName(user),
    pickedAt: now
  })
}

export const completeShipmentPicking = (
  execution: ShipmentExecutionRecord,
  user: User,
  pickedQuantities: QuantityPatch = {}
): ShipmentExecutionRecord => {
  if(execution.status !== 'PICKING') throw new Error('Picking tamamlama yalnızca PICKING durumunda yapılabilir.')
  const now = new Date().toISOString()
  const items = normalizeExecutionItems(execution.items.map(item => {
    const nextPickedQuantity = pickedQuantities[item.id] ?? item.plannedQuantity

    return {
      ...item,
      pickedQuantity: roundQuantity(Math.min(nextPickedQuantity, item.plannedQuantity)),
      status: 'PICKED' as ShipmentExecutionItemStatus
    }
  }))

  return updateExecutionStatus(execution, {
    status: 'PICKING',
    pickedBy: getUserName(user),
    pickedAt: execution.pickedAt || now,
    items
  })
}

export const startShipmentPacking = (
  execution: ShipmentExecutionRecord,
  user: User
): ShipmentExecutionRecord => {
  if(execution.status !== 'PICKING' && execution.status !== 'PACKING'){
    throw new Error('Packing yalnızca PICKING veya PACKING durumunda başlatılabilir.')
  }
  if(execution.status === 'PICKING' && execution.items.some(item => item.pickedQuantity <= 0)){
    throw new Error('Packing başlatmadan önce picking tamamlanmalıdır.')
  }
  const now = new Date().toISOString()

  return updateExecutionStatus(execution, {
    status: 'PACKING',
    packedBy: getUserName(user),
    packedAt: execution.packedAt || now
  })
}

export const completeShipmentPacking = (
  execution: ShipmentExecutionRecord,
  user: User,
  packedQuantities: QuantityPatch = {}
): ShipmentExecutionRecord => {
  if(execution.status !== 'PACKING') throw new Error('Packing tamamlama yalnızca PACKING durumunda yapılabilir.')
  const now = new Date().toISOString()
  const items = normalizeExecutionItems(execution.items.map(item => {
    const nextPackedQuantity = packedQuantities[item.id] ?? item.pickedQuantity

    return {
      ...item,
      packedQuantity: roundQuantity(Math.min(nextPackedQuantity, item.pickedQuantity)),
      status: 'PACKED' as ShipmentExecutionItemStatus
    }
  }))

  return updateExecutionStatus(execution, {
    status: 'READY_TO_SHIP',
    packedBy: getUserName(user),
    packedAt: execution.packedAt || now,
    items
  })
}

export const cancelShipmentExecution = (
  execution: ShipmentExecutionRecord,
  user: User
): ShipmentExecutionRecord => {
  if(execution.status === 'SHIPPED' || execution.status === 'PARTIALLY_DELIVERED' || execution.status === 'DELIVERED'){
    throw new Error('Stok hareketi oluşmuş execution iptal edilemez.')
  }

  const items = execution.items.map(item => ({
    ...item,
    status: 'CANCELLED' as ShipmentExecutionItemStatus
  }))

  return updateExecutionStatus(execution, {
    status: 'CANCELLED',
    deliveryResult: 'FAILED',
    deliveredBy: getUserName(user),
    deliveredAt: new Date().toISOString(),
    items
  })
}

export const shipShipmentExecution = ({
  execution,
  shipment,
  inventoryLots,
  user,
  warehouseLabel
}: {
  execution: ShipmentExecutionRecord
  shipment: ShipmentRecord
  inventoryLots: InventoryLot[]
  user: User
  warehouseLabel: (warehouseId: string) => string
}): StockEffectResult => {
  if(execution.status !== 'READY_TO_SHIP'){
    throw new Error('Sevkiyat yalnızca READY_TO_SHIP durumunda başlatılabilir.')
  }

  const now = new Date().toISOString()
  const shipmentItemMap = getShipmentItemMap(shipment)
  const stockItems = loadAllStockItems()

  // ── 1. AŞAMA: PLAN — hiçbir şey yazılmaz, yalnızca doğrulanır ──────────
  type CikisPlani = {
    stokKalemi: StockItem
    kaynakLot: InventoryLot
    miktar: number
  }
  const plan: CikisPlani[] = []

  const items = normalizeExecutionItems(execution.items.map(item => {
    const shipmentItem = shipmentItemMap.get(item.shipmentItemId)
    if(!shipmentItem) throw new Error('Shipment Item bulunamadı.')

    const sourceLot = inventoryLots.find(lot => lot.id === shipmentItem.inventoryLotId)
    if(!sourceLot) throw new Error('Kaynak Inventory Lot bulunamadı.')

    const targetShippedQuantity = roundQuantity(item.packedQuantity)
    const delta = roundQuantity(targetShippedQuantity - item.shippedQuantity)

    if(delta < 0) throw new Error('Shipped Quantity azaltılamaz.')
    if(delta > sourceLot.remainingQuantity){
      throw new Error(`${sourceLot.lotNo} için negative stock oluşamaz.`)
    }

    if(delta > 0){
      const sourceItem = stockItems.find(stockItem => stockItem.id === shipmentItem.stockItemId)
      if(!sourceItem) throw new Error('Kaynak Stock Item bulunamadı.')

      // Kapı da aynı kontrolü yapar ve orada da hata fırlatır. Burada tekrar
      // ediyoruz çünkü PLAN aşamasında yakalamak, hiçbir hareket yazılmadan
      // durmak demektir — ve mesaj kalemin adını taşır.
      if(sourceItem.currentQty < delta){
        throw new Error(`${sourceItem.name} için stok kartı negative stock oluşturamaz.`)
      }

      plan.push({ stokKalemi: sourceItem, kaynakLot: sourceLot, miktar: delta })
    }

    return {
      ...item,
      shippedQuantity: targetShippedQuantity,
      status: 'SHIPPED' as ShipmentExecutionItemStatus
    }
  }))

  // ── 2. AŞAMA: YAZ — her hareket kapıdan geçer ──────────────────────────
  let nextInventoryLots = [...inventoryLots]
  const movements: StockMovement[] = []
  const counterpartyName = warehouseLabel(getDestinationWarehouseId(shipment))

  plan.forEach(({ stokKalemi, kaynakLot, miktar }) => {
    const movement = withBranchScope(kaynakLot.warehouseId, () => applyStockMovement({
      stockItemId: stokKalemi.id,
      type: 'Çıkış',
      source: 'Transfer',
      reason: 'Diğer',
      qty: miktar,
      invoiceNo: execution.executionNo,
      description: `${execution.executionNo} sevkiyat operasyonu. Karşı taraf: ${counterpartyName}.`,
      movementDate: now,
      user,
      sourceEntityType: 'ShipmentExecution',
      sourceEntityId: execution.id
    }))

    movements.push(movement)

    const kalanMiktar = roundQuantity(kaynakLot.remainingQuantity - miktar)
    const guncelLot: InventoryLot = {
      ...kaynakLot,
      remainingQuantity: kalanMiktar,
      status: resolveInventoryLotStatus(kaynakLot.status, kalanMiktar, kaynakLot.expiryDate),
      updatedAt: now
    }
    nextInventoryLots = nextInventoryLots.map(lot => lot.id === kaynakLot.id ? guncelLot : lot)
  })

  const nextExecution = updateExecutionStatus(execution, {
    status: 'SHIPPED',
    shippedBy: getUserName(user),
    shippedAt: execution.shippedAt || now,
    items
  })

  if(movements.length > 0){
    addActionLog({
      operationType: 'Transfer tamamlandı',
      user,
      description: `${execution.executionNo} sevkiyat çıkışı oluşturuldu. Shipment: ${shipment.shipmentNo}. Kalem: ${movements.length}.`
    })
  }

  return {
    execution: nextExecution,
    inventoryLots: nextInventoryLots,
    movements,
    createdInventoryLots: []
  }
}

const createDeliveredInventoryLot = ({
  sourceLot,
  targetStockItem,
  destinationWarehouseId,
  execution,
  quantity,
  unit,
  now,
  index
}: {
  sourceLot: InventoryLot
  targetStockItem: StockItem
  destinationWarehouseId: string
  execution: ShipmentExecutionRecord
  quantity: number
  unit: StockUnit
  now: string
  index: number
}): InventoryLot => ({
  id: createId('shipment_inventory_lot'),
  lotNo: `${execution.executionNo}-LOT-${String(index + 1).padStart(2, '0')}`,
  productionOrderId: sourceLot.productionOrderId,
  productId: sourceLot.productId || targetStockItem.id,
  stockItemId: targetStockItem.id,
  goodsReceiptId: '',
  supplierId: sourceLot.supplierId,
  warehouseId: destinationWarehouseId,
  productionDate: sourceLot.productionDate,
  expiryDate: sourceLot.expiryDate,
  quantity,
  receivedQuantity: quantity,
  remainingQuantity: quantity,
  unit,
  status: resolveInventoryLotStatus('ACTIVE', quantity, sourceLot.expiryDate),
  notes: `${execution.executionNo} sevkiyat tesliminden oluştu. Kaynak lot: ${sourceLot.lotNo}.`,
  createdAt: now,
  updatedAt: now
})

export const deliverShipmentExecution = ({
  execution,
  shipment,
  inventoryLots,
  deliveredQuantities,
  deliveryResult,
  deliveryNotes,
  user,
  warehouseLabel
}: {
  execution: ShipmentExecutionRecord
  shipment: ShipmentRecord
  inventoryLots: InventoryLot[]
  deliveredQuantities: QuantityPatch
  deliveryResult: ShipmentDeliveryResult
  deliveryNotes: string
  user: User
  warehouseLabel: (warehouseId: string) => string
}): StockEffectResult => {
  if(execution.status !== 'SHIPPED' && execution.status !== 'PARTIALLY_DELIVERED'){
    throw new Error('Teslim işlemi yalnızca SHIPPED veya PARTIALLY_DELIVERED durumunda yapılabilir.')
  }

  const destinationWarehouseId = getDestinationWarehouseId(shipment)
  if(!destinationWarehouseId) throw new Error('Hedef Warehouse veya Branch bulunamadı.')

  const now = new Date().toISOString()
  const shipmentItemMap = getShipmentItemMap(shipment)
  const stockItems = loadAllStockItems()

  // ── 1. AŞAMA: PLAN ─────────────────────────────────────────────────────
  type GirisPlani = {
    kaynakKalem: StockItem
    hedefKalem: StockItem
    hedefKalemYeni: boolean
    kaynakLot: InventoryLot
    miktar: number
    birim: StockUnit
    sira: number
  }
  const plan: GirisPlani[] = []

  // Hedef şubede aynı kalem birden fazla satırda geçebilir. İlk satırda
  // oluşturulan kartı ikinci satır da bulabilsin diye planlanan yeni kartları
  // burada tutuyoruz — yoksa aynı ürün için iki kart açılırdı.
  const planlananHedefler = new Map<string, StockItem>()

  const items = normalizeExecutionItems(execution.items.map((item, index) => {
    const shipmentItem = shipmentItemMap.get(item.shipmentItemId)
    if(!shipmentItem) throw new Error('Shipment Item bulunamadı.')

    const sourceLot = inventoryLots.find(lot => lot.id === shipmentItem.inventoryLotId)
    if(!sourceLot) throw new Error('Kaynak Inventory Lot bulunamadı.')

    const targetDeliveredQuantity = roundQuantity(deliveredQuantities[item.id] ?? item.shippedQuantity)
    if(targetDeliveredQuantity < item.deliveredQuantity) throw new Error('Delivered Quantity azaltılamaz.')
    if(targetDeliveredQuantity > item.shippedQuantity){
      throw new Error('Delivered Quantity, Shipped Quantity değerini geçemez.')
    }

    const delta = roundQuantity(targetDeliveredQuantity - item.deliveredQuantity)
    if(delta > 0){
      const sourceItem = stockItems.find(stockItem => stockItem.id === shipmentItem.stockItemId)
      if(!sourceItem) throw new Error('Kaynak Stock Item bulunamadı.')

      const anahtar = `${sourceItem.name.trim().toLocaleLowerCase('tr-TR')}|${sourceItem.unit}`
      const planlanan = planlananHedefler.get(anahtar)
      const matchedTargetItem = planlanan || findTargetStockItem(stockItems, sourceItem, destinationWarehouseId)
      const targetItem = matchedTargetItem || createTargetStockItem(sourceItem, destinationWarehouseId, now)
      if(!matchedTargetItem) planlananHedefler.set(anahtar, targetItem)

      plan.push({
        kaynakKalem: sourceItem,
        hedefKalem: targetItem,
        hedefKalemYeni: !matchedTargetItem,
        kaynakLot: sourceLot,
        miktar: delta,
        birim: shipmentItem.unit,
        sira: index
      })
    }

    return {
      ...item,
      deliveredQuantity: targetDeliveredQuantity,
      remainingQuantity: roundQuantity(Math.max(0, item.plannedQuantity - targetDeliveredQuantity))
    }
  }))

  // ── 2. AŞAMA: YAZ ──────────────────────────────────────────────────────
  const movements: StockMovement[] = []
  const createdInventoryLots: InventoryLot[] = []
  const counterpartyName = warehouseLabel(shipment.sourceWarehouseId)

  plan.forEach(({ kaynakKalem, hedefKalem, hedefKalemYeni, kaynakLot, miktar, birim, sira }) => {
    const movement = withBranchScope(destinationWarehouseId, () => {
      // Hedef şubede kart yoksa önce SIFIR miktarla açılır. Miktar buradan
      // YAZILMAZ — kartın işi ad, birim, kategori gibi bilgiyi taşımaktır;
      // bakiye her zaman bir hareketin sonucudur (ADR-001). Excel içe
      // aktarmada da aynı iki aşamalı düzen kullanılıyor.
      if(hedefKalemYeni){
        saveStockItems([hedefKalem, ...loadAllStockItems().filter(kalem => kalem.branchId === destinationWarehouseId)])
      }

      return applyStockMovement({
        stockItemId: hedefKalem.id,
        type: 'Giriş',
        source: 'Transfer',
        reason: 'Diğer',
        qty: miktar,
        // Maliyet kaynaktan taşınıyor. Eski kod bunu yapmıyordu: hedefteki
        // ortalama maliyet olduğu gibi kalıyor, yeni açılan kart ise sıfır
        // maliyetle başlıyordu. Transfer edilen mal bedava değildir.
        purchasePrice: getStockUnitCost(kaynakKalem),
        // SKT takipli kalemde kapı bunu ZORUNLU tutar; kaynak lottan taşıyoruz.
        expiryDate: kaynakLot.expiryDate,
        invoiceNo: execution.executionNo,
        description: `${execution.executionNo} sevkiyat operasyonu. Karşı taraf: ${counterpartyName}.`,
        movementDate: now,
        user,
        sourceEntityType: 'ShipmentExecution',
        sourceEntityId: execution.id
      })
    })

    movements.push(movement)
    createdInventoryLots.push(createDeliveredInventoryLot({
      sourceLot: kaynakLot,
      targetStockItem: hedefKalem,
      destinationWarehouseId,
      execution,
      quantity: miktar,
      unit: birim,
      now,
      index: sira
    }))
  })

  const isFullyDelivered = items.every(item => item.shippedQuantity > 0 && item.deliveredQuantity >= item.shippedQuantity)
  const nextStatus: ShipmentExecutionStatus = isFullyDelivered ? 'DELIVERED' : 'PARTIALLY_DELIVERED'
  const nextDeliveryResult: ShipmentDeliveryResult = isFullyDelivered ? 'SUCCESS' : deliveryResult
  const nextExecution = updateExecutionStatus(execution, {
    status: nextStatus,
    deliveredBy: getUserName(user),
    deliveredAt: now,
    deliveryResult: nextDeliveryResult,
    deliveryNotes: deliveryNotes.trim(),
    items
  })

  if(movements.length > 0){
    addActionLog({
      operationType: 'Transfer tamamlandı',
      user,
      description: `${execution.executionNo} sevkiyat teslim girişi oluşturuldu. Shipment: ${shipment.shipmentNo}. Kalem: ${movements.length}.`
    })
  }

  return {
    execution: nextExecution,
    inventoryLots: [...createdInventoryLots, ...inventoryLots],
    movements,
    createdInventoryLots
  }
}
