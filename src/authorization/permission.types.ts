export type PermissionName =
  | 'dashboard.read'
  | 'products.read'
  | 'products.write'
  | 'stock.read'
  | 'stock.write'
  | 'finance.read'
  | 'finance.write'
  | 'personnel.read'
  | 'personnel.manage'
  | 'operations.read'
  | 'operations.write'
  | 'company.read'
  | 'company.manage'
  | 'platform.read'
  | 'platform.manage'

export type PermissionModel = {
  name: PermissionName
  description: string
  module: string
}

export type PermissionResolution = {
  permissions: PermissionName[]
  source: 'role' | 'identity' | 'public'
}
