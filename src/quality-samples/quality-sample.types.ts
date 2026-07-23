export type QualitySampleType =
  | 'RAW_MATERIAL'
  | 'SEMI_PRODUCT'
  | 'FINISHED_PRODUCT'
  | 'PACKAGING'
  | 'OTHER'

export type QualitySampleStatus =
  | 'COLLECTED'
  | 'STORED'
  | 'UNDER_REVIEW'
  | 'RELEASED'
  | 'DISCARDED'

export type QualitySample = {
  id: string
  sampleNo: string
  inventoryLotId: string
  sampleType: QualitySampleType
  sampleDate: string
  expiryDate: string
  status: QualitySampleStatus
  takenBy: string
  storageLocation: string
  notes: string
  createdAt: string
  updatedAt: string
}
