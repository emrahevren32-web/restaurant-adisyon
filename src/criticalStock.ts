import { StockItem } from './types'

export const isCriticalStock = (item: StockItem) => {
  return item.active && item.currentQty <= item.minQty
}

export const isOutOfStock = (item: StockItem) => {
  return item.active && item.currentQty <= 0
}

export const getCriticalShortage = (item: StockItem) => {
  if(!isCriticalStock(item)) return 0
  return Math.max(0, item.minQty - item.currentQty)
}

export const getCriticalRiskRatio = (item: StockItem) => {
  if(!isCriticalStock(item)) return 0
  if(item.minQty <= 0) return item.currentQty <= 0 ? 1 : 0
  return Math.max(0, Math.min(1, (item.minQty - item.currentQty) / item.minQty))
}

export const sortCriticalStockFirst = (items: StockItem[]) => {
  return [...items].sort((a, b) => {
    const aCritical = isCriticalStock(a)
    const bCritical = isCriticalStock(b)
    if(aCritical !== bCritical) return aCritical ? -1 : 1

    const riskDiff = getCriticalRiskRatio(b) - getCriticalRiskRatio(a)
    if(riskDiff !== 0) return riskDiff

    return a.name.localeCompare(b.name, 'tr-TR')
  })
}

export const formatStockQuantity = (value: number, unit: StockItem['unit']) => {
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
}
