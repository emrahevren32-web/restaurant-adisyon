import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import type { StockItem, StockUnit } from '../types'
import type { InventoryLot, InventoryLotStatus } from './inventory-lot.types'

export const INVENTORY_LOT_STORAGE_KEY = 'ra_inventory_lots'

export const INVENTORY_LOT_STATUSES: InventoryLotStatus[] = [
  'ACTIVE',
  'QUARANTINE',
  'BLOCKED',
  'EXPIRED',
  'CONSUMED'
]

export const INVENTORY_LOT_STATUS_LABELS: Record<InventoryLotStatus, string> = {
  ACTIVE: 'Aktif',
  QUARANTINE: 'Karantina',
  BLOCKED: 'Blokeli',
  EXPIRED: 'SKT Geçmiş',
  CONSUMED: 'Tükendi'
}

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
  if(remainingQuantity <= 0) return 'CONSUMED'
  if(getInventoryLotExpirySignal({ expiryDate }) === 'EXPIRED') return 'EXPIRED'
  return status === 'EXPIRED' || status === 'CONSUMED' ? 'ACTIVE' : status
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
      stockItemId: input.stockItemId,
      goodsReceiptId: receipt.id,
      supplierId: receipt.supplierId,
      warehouseId: receipt.warehouseId,
      productionDate: input.productionDate,
      expiryDate: input.expiryDate,
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

  return {
    id,
    lotNo,
    stockItemId: item.stockItemId,
    goodsReceiptId: receipt.id,
    supplierId: receipt.supplierId,
    warehouseId: receipt.warehouseId,
    productionDate,
    expiryDate,
    receivedQuantity: roundQuantity(quantity),
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

const normalizeInventoryLot = (item: RawInventoryLotRecord, index: number): InventoryLot => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const receivedQuantity = normalizeNonNegativeNumber(item.receivedQuantity)
  const remainingQuantity = Math.min(receivedQuantity, normalizeNonNegativeNumber(item.remainingQuantity))
  const expiryDate = normalizeText(item.expiryDate)
  const status = resolveInventoryLotStatus(normalizeStatus(item.status), remainingQuantity, expiryDate)

  return {
    id: normalizeText(item.id) || `inventory_lot_${Date.now()}_${index}`,
    lotNo: normalizeText(item.lotNo) || `LOT-${String(index + 1).padStart(6, '0')}`,
    stockItemId: normalizeText(item.stockItemId),
    goodsReceiptId: normalizeText(item.goodsReceiptId),
    supplierId: normalizeText(item.supplierId),
    warehouseId: normalizeText(item.warehouseId),
    productionDate: normalizeText(item.productionDate),
    expiryDate,
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
