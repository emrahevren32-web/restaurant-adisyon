export type DispatchStatus =
  | 'Hazırlanıyor'
  | 'Yolda'
  | 'Teslim Edildi'
  | 'İptal'

export type DispatchProcess = {
  id: string
  dispatchNo: string
  customerName: string
  vehicle: string
  driverName: string
  departureDate: string
  estimatedDeliveryDate: string
  actualDeliveryDate: string
  totalProducts: number
  totalQuantity: number
  status: DispatchStatus
  description: string
  linkedLabeling: string
  linkedWaybill: string
  createdAt: string
  updatedAt?: string
}
