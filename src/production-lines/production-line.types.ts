export type ProductionLineType =
  | 'Çorba'
  | 'Et'
  | 'Sebze'
  | 'Marine'
  | 'Paketleme'
  | 'Genel'

export type ProductionLineStatus =
  | 'Aktif'
  | 'Bakımda'
  | 'Pasif'
  | 'Yoğun'

export type ProductionLine = {
  id: string
  code: string
  name: string
  type: ProductionLineType
  status: ProductionLineStatus
  capacity: number
  capacityUnit: string
  activeWorkOrderCount: number
  responsible: string
  activeOperator: string
  todayWorkOrderCount: number
  estimatedUtilization: number
  linkedWorkOrders: string[]
  description: string
  createdAt: string
  updatedAt?: string
}
