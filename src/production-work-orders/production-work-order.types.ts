export type ProductionWorkOrderStatus =
  | 'Taslak'
  | 'Bekliyor'
  | 'Üretimde'
  | 'Tamamlandı'
  | 'Sevkiyata Hazır'
  | 'İptal'

export type ProductionWorkOrderPriority = 'Düşük' | 'Normal' | 'Yüksek' | 'Acil'

export type ProductionWorkOrderUnit = 'kg' | 'lt' | 'adet' | 'tepsi' | 'koli'

export type ProductionWorkOrderHistoryType =
  | 'Oluşturuldu'
  | 'Düzenlendi'
  | 'Durum Değişti'
  | 'Ürün Eklendi'
  | 'Ürün Silindi'

export type ProductionWorkOrderHistoryEvent = {
  id: string
  type: ProductionWorkOrderHistoryType
  description: string
  createdAt: string
  actorName: string
}

export type ProductionWorkOrderLine = {
  id: string
  productName: string
  quantity: number
  unit: ProductionWorkOrderUnit
  note: string
}

export type ProductionWorkOrder = {
  id: string
  workOrderNo: string
  requester: string
  branch: string
  deliveryDate: string
  priority: ProductionWorkOrderPriority
  status: ProductionWorkOrderStatus
  description: string
  notes: string
  lines: ProductionWorkOrderLine[]
  history: ProductionWorkOrderHistoryEvent[]
  estimatedMinutes: number
  linkedShipmentNo: string
  createdAt: string
  updatedAt?: string
  createdByUserId?: string
}
