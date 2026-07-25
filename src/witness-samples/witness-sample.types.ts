export type WitnessSampleStatus =
  | 'STORED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'DISPOSED'

export type WitnessSample = {
  id: string
  witnessNo: string
  qualitySampleId: string
  storageLocation: string
  storageStartDate: string
  storageEndDate: string
  status: WitnessSampleStatus
  responsiblePerson: string
  notes: string
  createdAt: string
  updatedAt: string
}
