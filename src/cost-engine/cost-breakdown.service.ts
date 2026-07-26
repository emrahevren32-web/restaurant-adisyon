import { percent, roundKpi, sumBy } from '../kpi-reporting/kpi.utils'
import type {
  CostBreakdown,
  CostComponent,
  CostComponentSource,
  CostComponentType
} from './cost-engine.types'

const roundCost = (value: number) => roundKpi(value)

export const createCostComponent = ({
  id,
  type,
  label,
  amount,
  source,
  sourceId,
  note
}: {
  id: string
  type: CostComponentType
  label: string
  amount: number
  source: CostComponentSource
  sourceId: string
  note: string
}): CostComponent => ({
  id,
  type,
  label,
  amount: roundCost(Math.max(0, amount)),
  percent: 0,
  source,
  sourceId,
  note
})

const sumComponentTypes = (
  components: CostComponent[],
  types: CostComponentType[]
) => sumBy(components.filter(component => types.includes(component.type)), component => component.amount)

export const createCostBreakdown = (
  components: CostComponent[]
): CostBreakdown => {
  const totalCost = sumBy(components, component => component.amount)
  const componentsWithPercent = components.map(component => ({
    ...component,
    percent: percent(component.amount, totalCost)
  }))

  return {
    totalCost,
    components: componentsWithPercent,
    rawMaterialPercent: percent(sumComponentTypes(componentsWithPercent, ['RAW_MATERIAL', 'INTERMEDIATE_PRODUCT', 'FINAL_PRODUCT']), totalCost),
    laborPercent: percent(sumComponentTypes(componentsWithPercent, ['LABOR']), totalCost),
    firePercent: percent(sumComponentTypes(componentsWithPercent, ['WASTE']), totalCost),
    packagingPercent: percent(sumComponentTypes(componentsWithPercent, ['PACKAGING']), totalCost),
    storagePercent: percent(sumComponentTypes(componentsWithPercent, ['STORAGE']), totalCost),
    shipmentPercent: percent(sumComponentTypes(componentsWithPercent, ['SHIPMENT']), totalCost),
    purchasePercent: percent(sumComponentTypes(componentsWithPercent, ['PURCHASING']), totalCost),
    blastChillingPercent: percent(sumComponentTypes(componentsWithPercent, ['BLAST_CHILLING']), totalCost),
    otherPercent: percent(sumComponentTypes(componentsWithPercent, ['OTHER']), totalCost)
  }
}
