import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import type { ProductionWorkOrder, ProductionWorkOrderLine } from '../production-work-orders/production-work-order.types'
import type { Branch, StockUnit } from '../types'
import type { InventoryLot, InventoryLotStatus } from './inventory-lot.types'

export const INVENTORY_LOT_STORAGE_KEY = 'ra_inventory_lots'

export const LOT_SYSTEM_STATUSES: InventoryLotStatus[] = [
  'PLANNED',
  'ACTIVE',
  'QUARANTINE',
  'RELEASED',
  'CONSUMED',
  'EXPIRED',
  'DISPOSED'
]

export const INVENTORY_LOT_STATUSES: InventoryLotStatus[] = [
  ...LOT_SYSTEM_STATUSES,
  'BLOCKED',
  'RETURNED'
]

export const INVENTORY_LOT_STATUS_LABELS: Record<InventoryLotStatus, string> = {
  PLANNED: 'Planlandı',
  ACTIVE: 'Aktif',
  QUARANTINE: 'Karantina',
  RELEASED: 'Serbest',
  CONSUMED: 'Tükendi',
  EXPIRED: 'SKT Geçmiş',
  DISPOSED: 'İmha Edildi',
  BLOCKED: 'Blokeli',
  RETURNED: 'İade Edildi'
}

const PRODUCTION_LOT_STATUS_ROTATION: InventoryLotStatus[] = [
  'PLANNED',
  'ACTIVE',
  'QUARANTINE',
  'RELEASED',
  'CONSUMED',
  'EXPIRED',
  'DISPOSED',
  'ACTIVE'
]

export type InventoryLotExpirySignal =
  | 'EXPIRED'
  | 'NEAR_7'
  | 'NEAR_30'
  | 'OK'
  | 'NO_EXPIRY'

export type InventoryLotCreateInput = {
  lotNo: string
  goodsReceiptItemId: string
  stockItemId: string
  productionDate: string
  expiryDate: string
  quantity: number
  unit: StockUnit
  notes: string
}

export type InventoryLotProductReference = {
  id: string
  name: string
  unit: StockUnit
  stockItemId?: string
}

export type InventoryLotManagementInput = {
  lotNo: string
  productionOrderId: string
  productId: string
  warehouseId: string
  productionDate: string
  expiryDate: string
  quantity: number
  unit: StockUnit
  status: InventoryLotStatus
  notes: string
}

type RawInventoryLotRecord = Partial<Record<keyof InventoryLot, unknown>> & Record<string, unknown>

const DEFAULT_STATUS: InventoryLotStatus = 'ACTIVE'
const DEFAULT_UNIT: StockUnit = 'adet'
const QUANTITY_ROUNDING_FACTOR = 1000
const EXPIRY_NEAR_DAYS = 7
const EXPIRY_INFO_DAYS = 30

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawInventoryLotRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchKey = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const normalizeStatus = (value: unknown): InventoryLotStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return INVENTORY_LOT_STATUSES.includes(normalized as InventoryLotStatus)
    ? normalized as InventoryLotStatus
    : DEFAULT_STATUS
}

const normalizeUnit = (value: unknown): StockUnit => {
  const normalized = normalizeText(value)
  const units: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
  return units.includes(normalized as StockUnit) ? normalized as StockUnit : DEFAULT_UNIT
}

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const getLotDateKey = (dateValue: string) => {
  const normalizedDate = normalizeText(dateValue) || getTodayKey()
  const parsedDate = new Date(`${normalizedDate}T00:00:00`)
  const safeDate = Number.isNaN(parsedDate.getTime())
    ? getTodayKey()
    : parsedDate.toLocaleDateString('sv-SE')

  return safeDate.replace(/-/g, '')
}

const getDayDiff = (dateValue: string, today = getTodayKey()) => {
  const targetDate = new Date(`${dateValue}T00:00:00`)
  const todayDate = new Date(`${today}T00:00:00`)
  if(Number.isNaN(targetDate.getTime()) || Number.isNaN(todayDate.getTime())) return Number.NaN
  return Math.ceil((targetDate.getTime() - todayDate.getTime()) / 86400000)
}

export const getNextInventoryLotNo = (records: InventoryLot[], offset = 0) => {
  const maxNo = records.reduce((max, lot) => {
    const match = lot.lotNo.match(/LOT-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `LOT-${String(maxNo + 1 + offset).padStart(6, '0')}`
}

export const getNextLotSystemNo = (
  records: InventoryLot[],
  productionDate = getTodayKey(),
  offset = 0
) => {
  const dateKey = getLotDateKey(productionDate)
  const pattern = new RegExp(`^LOT-${dateKey}-(\\d{4})$`)
  const maxNo = records.reduce((max, lot) => {
    const match = lot.lotNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `LOT-${dateKey}-${String(maxNo + 1 + offset).padStart(4, '0')}`
}

export const getInventoryLotExpirySignal = (
  lot: Pick<InventoryLot, 'expiryDate'>
): InventoryLotExpirySignal => {
  if(!lot.expiryDate) return 'NO_EXPIRY'
  const dayDiff = getDayDiff(lot.expiryDate)
  if(Number.isNaN(dayDiff)) return 'NO_EXPIRY'
  if(dayDiff < 0) return 'EXPIRED'
  if(dayDiff <= EXPIRY_NEAR_DAYS) return 'NEAR_7'
  if(dayDiff <= EXPIRY_INFO_DAYS) return 'NEAR_30'
  return 'OK'
}

export const getInventoryLotExpiryLabel = (signal: InventoryLotExpirySignal) => {
  if(signal === 'EXPIRED') return 'SKT geçti'
  if(signal === 'NEAR_7') return 'Yaklaşıyor'
  if(signal === 'NEAR_30') return 'Bilgilendirme'
  if(signal === 'NO_EXPIRY') return 'SKT yok'
  return 'Uygun'
}

export const resolveInventoryLotStatus = (
  status: InventoryLotStatus,
  remainingQuantity: number,
  expiryDate: string
): InventoryLotStatus => {
  if(status === 'RETURNED') return remainingQuantity <= 0 ? 'RETURNED' : 'ACTIVE'
  if(status === 'DISPOSED') return 'DISPOSED'
  if(remainingQuantity <= 0) return 'CONSUMED'
  if(getInventoryLotExpirySignal({ expiryDate }) === 'EXPIRED') return 'EXPIRED'
  return status === 'EXPIRED' || status === 'CONSUMED' ? 'ACTIVE' : status
}

export const validateInventoryLotManagementInput = (
  input: InventoryLotManagementInput,
  existingLots: InventoryLot[],
  currentLotId = ''
) => {
  if(!input.productionOrderId.trim()) return 'Production Order zorunludur.'
  if(!input.productId.trim()) return 'Product zorunludur.'
  if(!input.warehouseId.trim()) return 'Warehouse zorunludur.'
  if(!input.productionDate.trim()) return 'Production Date zorunludur.'
  if(!input.expiryDate.trim()) return 'Expiry Date zorunludur.'
  if(!Number.isFinite(input.quantity)) return 'Quantity geçerli sayı olmalıdır.'
  if(input.quantity <= 0) return 'Quantity 0’dan büyük olmalıdır.'
  if(!input.lotNo.trim()) return 'Lot No zorunludur.'
  if(input.productionDate && input.expiryDate && input.productionDate > input.expiryDate){
    return 'Production Date, Expiry Date değerinden büyük olamaz.'
  }

  const normalizedLotNo = normalizeSearchKey(input.lotNo)
  const duplicateLot = existingLots.find(lot => (
    lot.id !== currentLotId && normalizeSearchKey(lot.lotNo) === normalizedLotNo
  ))

  return duplicateLot ? 'Lot No benzersiz olmalıdır.' : ''
}

export const validateInventoryLotCreateInputs = (
  inputs: InventoryLotCreateInput[],
  existingLots: InventoryLot[]
) => {
  const existingLotNos = new Set(existingLots.map(lot => lot.lotNo.trim().toLocaleLowerCase('tr-TR')))
  const nextLotNos = new Set<string>()

  for(const input of inputs){
    if(!Number.isFinite(input.quantity)) return 'Lot miktarı geçerli sayı olmalıdır.'
    if(input.quantity <= 0) return 'Lot miktarı 0’dan büyük olmalıdır.'
    if(!input.lotNo.trim()) return 'Lot No zorunludur.'

    const normalizedLotNo = input.lotNo.trim().toLocaleLowerCase('tr-TR')
    if(existingLotNos.has(normalizedLotNo) || nextLotNos.has(normalizedLotNo)){
      return 'Lot No benzersiz olmalıdır.'
    }
    nextLotNos.add(normalizedLotNo)

    if(input.productionDate && input.expiryDate && input.expiryDate < input.productionDate){
      return 'Expiry Date, Production Date’den önce olamaz.'
    }
  }

  return ''
}

export const createInventoryLotsFromGoodsReceipt = (
  receipt: GoodsReceiptRecord,
  inputs: InventoryLotCreateInput[],
  existingLots: InventoryLot[]
): InventoryLot[] => {
  const createdAt = new Date().toISOString()

  return inputs.map((input, index) => {
    const quantity = roundQuantity(input.quantity)
    const status = resolveInventoryLotStatus('ACTIVE', quantity, input.expiryDate)

    return {
      id: `inventory_lot_${Date.now()}_${index}`,
      lotNo: input.lotNo.trim() || getNextInventoryLotNo(existingLots, index),
      productionOrderId: '',
      productId: input.stockItemId,
      stockItemId: input.stockItemId,
      goodsReceiptId: receipt.id,
      supplierId: receipt.supplierId,
      warehouseId: receipt.warehouseId,
      productionDate: input.productionDate,
      expiryDate: input.expiryDate,
      quantity,
      receivedQuantity: quantity,
      remainingQuantity: quantity,
      unit: input.unit,
      status,
      notes: input.notes.trim(),
      createdAt,
      updatedAt: createdAt
    }
  })
}

const createSeedLot = (
  id: string,
  lotNo: string,
  receipt: GoodsReceiptRecord,
  item: GoodsReceiptRecord['items'][number],
  quantity: number,
  productionDate: string,
  expiryDate: string,
  status: InventoryLotStatus,
  notes: string,
  createdAt: string
): InventoryLot => {
  const remainingQuantity = status === 'CONSUMED' ? 0 : roundQuantity(quantity)
  const lotQuantity = roundQuantity(quantity)

  return {
    id,
    lotNo,
    productionOrderId: '',
    productId: item.stockItemId,
    stockItemId: item.stockItemId,
    goodsReceiptId: receipt.id,
    supplierId: receipt.supplierId,
    warehouseId: receipt.warehouseId,
    productionDate,
    expiryDate,
    quantity: lotQuantity,
    receivedQuantity: lotQuantity,
    remainingQuantity,
    unit: item.unit,
    status: resolveInventoryLotStatus(status, remainingQuantity, expiryDate),
    notes,
    createdAt,
    updatedAt: createdAt
  }
}

export const createInventoryLotMockData = (
  goodsReceipts: GoodsReceiptRecord[]
): InventoryLot[] => {
  const acceptedItems = goodsReceipts.flatMap(receipt => (
    receipt.items
      .filter(item => item.acceptedQuantity > 0)
      .map(item => ({ receipt, item }))
  ))

  const statuses: InventoryLotStatus[] = [
    'ACTIVE',
    'ACTIVE',
    'QUARANTINE',
    'BLOCKED',
    'EXPIRED',
    'ACTIVE',
    'QUARANTINE',
    'BLOCKED'
  ]

  const lots: InventoryLot[] = []
  acceptedItems.some(({ receipt, item }, sourceIndex) => {
    const status = statuses[sourceIndex % statuses.length]
    const splitCount = sourceIndex % 4 === 0 && item.acceptedQuantity > 1 ? 2 : 1

    Array.from({ length: splitCount }).forEach((_, splitIndex) => {
      if(lots.length >= 20) return

      const quantity = splitCount === 1
        ? item.acceptedQuantity
        : splitIndex === 0
          ? roundQuantity(item.acceptedQuantity * 0.6)
          : roundQuantity(item.acceptedQuantity * 0.4)
      const receiptDate = receipt.receiptDate || getTodayKey()
      const productionDate = addDays(receiptDate, -2 - (sourceIndex % 5))
      const expiryDate = status === 'EXPIRED'
        ? addDays(getTodayKey(), -1 - sourceIndex)
        : addDays(getTodayKey(), sourceIndex % 3 === 0 ? 5 : sourceIndex % 3 === 1 ? 18 : 65)
      const createdAt = `${receiptDate}T13:${String((sourceIndex + splitIndex) * 3).padStart(2, '0')}:00.000Z`

      lots.push(createSeedLot(
        `inventory_lot_${String(lots.length + 1).padStart(3, '0')}`,
        `LOT-${String(lots.length + 1).padStart(6, '0')}`,
        receipt,
        item,
        quantity,
        productionDate,
        expiryDate,
        status,
        splitCount > 1 ? 'Aynı mal kabul satırı iki lota bölündü.' : 'Goods Receipt üzerinden oluşturulan örnek lot.',
        createdAt
      ))
    })

    return lots.length >= 20
  })

  return lots
}

const getLineProductReference = (
  line: ProductionWorkOrderLine,
  products: InventoryLotProductReference[]
) => (
  products.find(product => normalizeSearchKey(product.name) === normalizeSearchKey(line.productName)) || null
)

export const getProductionOrderLineProductId = (
  line: ProductionWorkOrderLine,
  products: InventoryLotProductReference[]
) => (
  getLineProductReference(line, products)?.id || line.id
)

const getProductionOrderLineStockItemId = (
  line: ProductionWorkOrderLine,
  products: InventoryLotProductReference[]
) => {
  const product = getLineProductReference(line, products)
  return product?.stockItemId || product?.id || line.id
}

export const getProductionOrderLineLotUnit = (
  line: ProductionWorkOrderLine,
  products: InventoryLotProductReference[]
) => (
  normalizeUnit(getLineProductReference(line, products)?.unit || line.unit)
)

const getWarehouseForProductionOrder = (
  order: ProductionWorkOrder,
  branches: Branch[],
  index: number
) => (
  branches.find(branch => normalizeSearchKey(branch.name) === normalizeSearchKey(order.branch))
  || branches[index % Math.max(branches.length, 1)]
  || null
)

export const isProductionInventoryLot = (lot: InventoryLot) => (
  Boolean(lot.productionOrderId && lot.productId)
)

export const createProductionInventoryLotRecord = (
  input: InventoryLotManagementInput,
  productRefs: InventoryLotProductReference[],
  existingLot?: InventoryLot
): InventoryLot => {
  const now = new Date().toISOString()
  const quantity = roundQuantity(input.quantity)
  const matchingProduct = productRefs.find(product => product.id === input.productId) || null
  const stockItemId = matchingProduct?.stockItemId || existingLot?.stockItemId || input.productId
  const remainingQuantity = input.status === 'CONSUMED' || input.status === 'DISPOSED' ? 0 : quantity
  const status = resolveInventoryLotStatus(input.status, remainingQuantity, input.expiryDate)
  const createdAt = existingLot?.createdAt || now

  return {
    id: existingLot?.id || `inventory_lot_production_${Date.now()}`,
    lotNo: input.lotNo.trim(),
    productionOrderId: input.productionOrderId,
    productId: input.productId,
    stockItemId,
    goodsReceiptId: existingLot?.goodsReceiptId || '',
    supplierId: existingLot?.supplierId || '',
    warehouseId: input.warehouseId,
    productionDate: input.productionDate,
    expiryDate: input.expiryDate,
    quantity,
    receivedQuantity: quantity,
    remainingQuantity,
    unit: input.unit,
    status,
    notes: input.notes.trim(),
    createdAt,
    updatedAt: now
  }
}

export const createProductionInventoryLotMockData = (
  productionOrders: ProductionWorkOrder[],
  branches: Branch[],
  products: InventoryLotProductReference[],
  existingLots: InventoryLot[] = []
): InventoryLot[] => {
  const lotNos = new Set(existingLots.map(lot => normalizeSearchKey(lot.lotNo)))
  const lotIds = new Set(existingLots.map(lot => lot.id))
  const lots: InventoryLot[] = []

  productionOrders.some((order, orderIndex) => {
    const warehouse = getWarehouseForProductionOrder(order, branches, orderIndex)
    if(!warehouse) return false

    order.lines.forEach((line, lineIndex) => {
      if(lots.length >= 20) return

      const status = PRODUCTION_LOT_STATUS_ROTATION[(lots.length + orderIndex) % PRODUCTION_LOT_STATUS_ROTATION.length]
      const productionDate = addDays(order.deliveryDate || getTodayKey(), -1 - (lineIndex % 3))
      const expiryDate = status === 'EXPIRED'
        ? addDays(getTodayKey(), -1 - lots.length)
        : addDays(productionDate, 7 + ((lots.length + lineIndex) % 6) * 8)
      const quantity = roundQuantity(line.quantity * (lineIndex % 3 === 0 ? 0.55 : lineIndex % 3 === 1 ? 0.75 : 1))
      const remainingQuantity = status === 'CONSUMED' || status === 'DISPOSED' ? 0 : quantity
      const dateKey = getLotDateKey(productionDate)
      let sequence = lots.length + 1
      let lotNo = `LOT-${dateKey}-${String(sequence).padStart(4, '0')}`

      while(lotNos.has(normalizeSearchKey(lotNo))){
        sequence += 1
        lotNo = `LOT-${dateKey}-${String(sequence).padStart(4, '0')}`
      }
      lotNos.add(normalizeSearchKey(lotNo))

      const createdAt = `${productionDate}T${String(8 + (lots.length % 8)).padStart(2, '0')}:${String((lineIndex + orderIndex) * 5).padStart(2, '0')}:00.000Z`
      let idSequence = lots.length + 1
      let lotId = `inventory_lot_production_${String(idSequence).padStart(3, '0')}`

      while(lotIds.has(lotId)){
        idSequence += 1
        lotId = `inventory_lot_production_${String(idSequence).padStart(3, '0')}`
      }
      lotIds.add(lotId)

      lots.push({
        id: lotId,
        lotNo,
        productionOrderId: order.id,
        productId: getProductionOrderLineProductId(line, products),
        stockItemId: getProductionOrderLineStockItemId(line, products),
        goodsReceiptId: '',
        supplierId: '',
        warehouseId: warehouse.id,
        productionDate,
        expiryDate,
        quantity,
        receivedQuantity: quantity,
        remainingQuantity,
        unit: getProductionOrderLineLotUnit(line, products),
        status: resolveInventoryLotStatus(status, remainingQuantity, expiryDate),
        notes: 'Üretim emri üzerinden oluşturulan izlenebilirlik lotu.',
        createdAt,
        updatedAt: createdAt
      })
    })

    return lots.length >= 20
  })

  return lots
}

const ensureProductionInventoryLotSeeds = (
  records: InventoryLot[],
  productionOrders: ProductionWorkOrder[],
  branches: Branch[],
  products: InventoryLotProductReference[]
) => {
  const productionLotCount = records.filter(isProductionInventoryLot).length
  if(productionLotCount >= 20) return records

  const requiredCount = 20 - productionLotCount
  const seedLots = createProductionInventoryLotMockData(productionOrders, branches, products, records)
    .slice(0, requiredCount)

  return seedLots.length > 0 ? [...seedLots, ...records] : records
}

const normalizeInventoryLot = (item: RawInventoryLotRecord, index: number): InventoryLot => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const rawQuantity = normalizeNonNegativeNumber(item.quantity)
  const rawReceivedQuantity = normalizeNonNegativeNumber(item.receivedQuantity)
  const quantity = roundQuantity(rawQuantity || rawReceivedQuantity || normalizeNonNegativeNumber(item.remainingQuantity))
  const receivedQuantity = roundQuantity(rawReceivedQuantity || quantity)
  const hasRemainingQuantity = item.remainingQuantity !== undefined && item.remainingQuantity !== null && item.remainingQuantity !== ''
  const remainingQuantity = Math.min(receivedQuantity, roundQuantity(
    hasRemainingQuantity ? normalizeNonNegativeNumber(item.remainingQuantity) : quantity
  ))
  const expiryDate = normalizeText(item.expiryDate)
  const status = resolveInventoryLotStatus(normalizeStatus(item.status), remainingQuantity, expiryDate)
  const productId = normalizeText(item.productId) || normalizeText(item.stockItemId)
  const stockItemId = normalizeText(item.stockItemId) || productId

  return {
    id: normalizeText(item.id) || `inventory_lot_${Date.now()}_${index}`,
    lotNo: normalizeText(item.lotNo) || `LOT-${String(index + 1).padStart(6, '0')}`,
    productionOrderId: normalizeText(item.productionOrderId),
    productId,
    stockItemId,
    goodsReceiptId: normalizeText(item.goodsReceiptId),
    supplierId: normalizeText(item.supplierId),
    warehouseId: normalizeText(item.warehouseId),
    productionDate: normalizeText(item.productionDate),
    expiryDate,
    quantity,
    receivedQuantity,
    remainingQuantity,
    unit: normalizeUnit(item.unit),
    status,
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

export const saveInventoryLotRecords = (records: InventoryLot[]) => {
  if(!isBrowserStorageAvailable()) return
  const normalizedRecords = records.map((record, index) => normalizeInventoryLot(record, index))
  localStorage.setItem(INVENTORY_LOT_STORAGE_KEY, JSON.stringify(normalizedRecords))
}

export const loadInventoryLotRecords = (goodsReceipts: GoodsReceiptRecord[]) => {
  const seedRecords = createInventoryLotMockData(goodsReceipts)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(INVENTORY_LOT_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveInventoryLotRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map(normalizeInventoryLot)

      saveInventoryLotRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveInventoryLotRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveInventoryLotRecords(seedRecords)
  return seedRecords
}

export const loadLotSystemInventoryLotRecords = (
  goodsReceipts: GoodsReceiptRecord[],
  productionOrders: ProductionWorkOrder[],
  branches: Branch[],
  products: InventoryLotProductReference[]
) => {
  const records = loadInventoryLotRecords(goodsReceipts)
  const migratedRecords = ensureProductionInventoryLotSeeds(records, productionOrders, branches, products)

  if(migratedRecords !== records) saveInventoryLotRecords(migratedRecords)
  return migratedRecords
}
