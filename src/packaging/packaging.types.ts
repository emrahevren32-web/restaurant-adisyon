export type PackagingStatus =
  | 'Bekliyor'
  | 'Paketleniyor'
  | 'Tamamlandı'
  | 'İptal'

export type PackagingUnit =
  | 'kg'
  | 'lt'
  | 'adet'
  | 'koli'
  | 'tepsi'

export type PackageType =
  | 'Vakum'
  | 'Termobox'
  | 'GN Küvet'
  | 'Plastik Kap'
  | 'Koli'
  | 'Tepsi'
  | 'Poşet'

export type PackagingProcess = {
  id: string
  packagingNo: string
  productName: string
  packageType: PackageType
  quantity: number
  unit: PackagingUnit
  startedAt: string
  operatorName: string
  status: PackagingStatus
  description: string
  linkedBlastChiller: string
  linkedShipment: string
  createdAt: string
  updatedAt?: string
}
