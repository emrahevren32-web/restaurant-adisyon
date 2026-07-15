export type LabelingStatus =
  | 'Bekliyor'
  | 'Yazdırıldı'
  | 'İptal'

export type LabelingRecord = {
  id: string
  labelNo: string
  productName: string
  lotNo: string
  barcode: string
  productionDate: string
  expiryDate: string
  status: LabelingStatus
  operatorName: string
  description: string
  linkedPackaging: string
  linkedShipment: string
  createdAt: string
  updatedAt?: string
}
