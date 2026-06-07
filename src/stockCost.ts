import { StockItem } from './types'

export const DEFAULT_STOCK_CURRENCY = 'TRY'

export const normalizeCostValue = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export const roundCost = (value: number) => {
  return Math.round(value * 10000) / 10000
}

export const getStockCurrency = (item?: Pick<StockItem, 'currency'>) => {
  return item?.currency || DEFAULT_STOCK_CURRENCY
}

export const getStockUnitPurchasePrice = (item?: Pick<StockItem, 'unitPurchasePrice'>) => {
  return normalizeCostValue(item?.unitPurchasePrice) || 0
}

export const getStockLastPurchasePrice = (item?: Pick<StockItem, 'lastPurchasePrice'>) => {
  return normalizeCostValue(item?.lastPurchasePrice) || 0
}

export const getStockAverageCost = (item?: Pick<StockItem, 'averageCost'>) => {
  return normalizeCostValue(item?.averageCost) || 0
}

export const getStockConsumptionUnitCost = (
  item?: Pick<StockItem, 'averageCost' | 'lastPurchasePrice' | 'unitPurchasePrice'>
) => {
  const averageCost = getStockAverageCost(item)
  if(averageCost > 0) return averageCost

  const lastPurchasePrice = getStockLastPurchasePrice(item)
  if(lastPurchasePrice > 0) return lastPurchasePrice

  return getStockUnitPurchasePrice(item)
}

export const getStockValueByLastPurchasePrice = (
  item: Pick<StockItem, 'currentQty' | 'lastPurchasePrice'>
) => {
  return roundCost(Math.max(0, item.currentQty) * getStockLastPurchasePrice(item))
}

export const getStockValueByAverageCost = (
  item: Pick<StockItem, 'currentQty' | 'averageCost' | 'lastPurchasePrice' | 'unitPurchasePrice'>
) => {
  return roundCost(Math.max(0, item.currentQty) * getStockConsumptionUnitCost(item))
}

export const calculateWeightedAverageCost = ({
  previousQty,
  previousAverageCost,
  incomingQty,
  incomingUnitCost
}: {
  previousQty: number
  previousAverageCost: number
  incomingQty: number
  incomingUnitCost: number
}) => {
  const safePreviousQty = Math.max(0, Number.isFinite(previousQty) ? previousQty : 0)
  const safeIncomingQty = Math.max(0, Number.isFinite(incomingQty) ? incomingQty : 0)
  const totalQty = safePreviousQty + safeIncomingQty

  if(totalQty <= 0) return 0

  const previousValue = safePreviousQty * Math.max(0, previousAverageCost)
  const incomingValue = safeIncomingQty * Math.max(0, incomingUnitCost)
  return roundCost((previousValue + incomingValue) / totalQty)
}

export const formatStockMoney = (value: number, currency = DEFAULT_STOCK_CURRENCY) => {
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency || DEFAULT_STOCK_CURRENCY,
      maximumFractionDigits: 2
    }).format(value)
  } catch {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: DEFAULT_STOCK_CURRENCY,
      maximumFractionDigits: 2
    }).format(value)
  }
}
