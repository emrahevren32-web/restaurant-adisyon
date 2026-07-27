import type {
  DeliveryNote,
  DeliveryNoteStatistics
} from './delivery-note.types'

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const uniqueProductCount = (records: DeliveryNote[]) => (
  new Set(records.flatMap(record => record.items.map(item => item.productId || item.stockItemId))).size
)

export const createDeliveryNoteStatistics = (
  records: DeliveryNote[]
): DeliveryNoteStatistics => {
  const totalNotes = records.length
  const deliveredNotes = records.filter(record => record.status === 'DELIVERED').length
  const cancelledNotes = records.filter(record => record.status === 'CANCELLED').length
  const pendingNotes = records.filter(record => !['DELIVERED', 'CANCELLED'].includes(record.status)).length

  return {
    todayNotes: records.filter(record => record.date === todayKey()).length,
    readyNotes: records.filter(record => record.status === 'READY').length,
    deliveredNotes,
    cancelledNotes,
    pendingNotes,
    totalNotes,
    totalProducts: uniqueProductCount(records),
    totalBoxes: records.reduce((total, record) => total + record.items.reduce((sum, item) => sum + item.boxCount, 0), 0),
    totalPallets: records.reduce((total, record) => total + record.items.reduce((sum, item) => sum + item.palletCount, 0), 0),
    totalNetWeight: records.reduce((total, record) => total + record.items.reduce((sum, item) => sum + item.netWeight, 0), 0),
    totalGrossWeight: records.reduce((total, record) => total + record.items.reduce((sum, item) => sum + item.grossWeight, 0), 0),
    totalCost: records.reduce((total, record) => total + record.items.reduce((sum, item) => sum + item.totalCost, 0), 0),
    deliveryRate: totalNotes - cancelledNotes > 0
      ? (deliveredNotes / (totalNotes - cancelledNotes)) * 100
      : 0
  }
}

export const DeliveryNoteStatisticsService = {
  create: createDeliveryNoteStatistics
}
