export type BlastChillerStatus =
  | 'Bekliyor'
  | 'Şoklanıyor'
  | 'Tamamlandı'
  | 'İptal'

export type BlastChillerUnit =
  | 'kg'
  | 'lt'
  | 'adet'
  | 'koli'
  | 'tepsi'

export type BlastChillerProcess = {
  id: string
  processNo: string
  productName: string
  batchNo: string
  quantity: number
  unit: BlastChillerUnit
  startedAt: string
  estimatedEndAt: string
  estimatedMinutes: number
  actualMinutes: number
  status: BlastChillerStatus
  description: string
  linkedFinalProduct: string
  linkedPackaging: string
  createdAt: string
  updatedAt?: string
}
