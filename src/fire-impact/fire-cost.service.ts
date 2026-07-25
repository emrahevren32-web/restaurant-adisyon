import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { roundKpi } from '../kpi-reporting/kpi.utils'
import type { StockWasteRecord } from '../types'
import type { FireCost } from './fire-impact.types'

const DEFAULT_CURRENCY = 'TRY'

export const calculateFireCost = (
  record: StockWasteRecord,
  sourceData: KpiSourceData
): FireCost => {
  const movement = sourceData.stockMovements.find(item => item.id === record.stockMovementId)
  const stockItem = sourceData.stockItems.find(item => item.id === record.stockItemId)
  const currency = record.estimatedTotalCost
    ? stockItem?.currency || movement?.currency || DEFAULT_CURRENCY
    : movement?.currency || stockItem?.currency || DEFAULT_CURRENCY

  if(Number.isFinite(record.estimatedTotalCost) && (record.estimatedTotalCost || 0) > 0){
    return {
      unitCost: roundKpi((record.estimatedTotalCost || 0) / Math.max(record.qty, 1)),
      totalCost: roundKpi(record.estimatedTotalCost || 0),
      currency,
      source: 'WasteRecord'
    }
  }

  if(Number.isFinite(record.estimatedUnitCost) && (record.estimatedUnitCost || 0) > 0){
    const unitCost = record.estimatedUnitCost || 0
    return {
      unitCost: roundKpi(unitCost),
      totalCost: roundKpi(unitCost * record.qty),
      currency,
      source: 'WasteRecord'
    }
  }

  if(Number.isFinite(movement?.unitCost) && (movement?.unitCost || 0) > 0){
    const unitCost = movement?.unitCost || 0
    return {
      unitCost: roundKpi(unitCost),
      totalCost: roundKpi(unitCost * record.qty),
      currency,
      source: 'StockMovement'
    }
  }

  const stockItemUnitCost = stockItem?.averageCost
    || stockItem?.lastPurchasePrice
    || stockItem?.unitPurchasePrice
    || 0

  if(stockItemUnitCost > 0){
    return {
      unitCost: roundKpi(stockItemUnitCost),
      totalCost: roundKpi(stockItemUnitCost * record.qty),
      currency,
      source: 'StockItem'
    }
  }

  return {
    unitCost: 0,
    totalCost: 0,
    currency,
    source: 'Estimated'
  }
}
