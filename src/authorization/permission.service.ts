import { PermissionModel, PermissionName, PermissionResolution } from './permission.types'

export const PERMISSION_CATALOG: PermissionModel[] = [
  { name: 'dashboard.read', description: 'Dashboard ekranlarini goruntuleme izni.', module: 'dashboard' },
  { name: 'products.read', description: 'Urunleri goruntuleme izni.', module: 'products' },
  { name: 'products.write', description: 'Urun olusturma ve guncelleme izni.', module: 'products' },
  { name: 'stock.read', description: 'Stok bilgilerini goruntuleme izni.', module: 'stock' },
  { name: 'stock.write', description: 'Stok hareketi ve kartlarini yonetme izni.', module: 'stock' },
  { name: 'finance.read', description: 'Finans verilerini goruntuleme izni.', module: 'finance' },
  { name: 'finance.write', description: 'Finans islemlerini yonetme izni.', module: 'finance' },
  { name: 'personnel.read', description: 'Personel verilerini goruntuleme izni.', module: 'personnel' },
  { name: 'personnel.manage', description: 'Personel sureclerini yonetme izni.', module: 'personnel' },
  { name: 'restaurant.read', description: 'Business Workspace operasyon ekranlarini goruntuleme izni.', module: 'business-workspace' },
  { name: 'restaurant.write', description: 'Business Workspace operasyon verilerini yonetme izni.', module: 'business-workspace' },
  { name: 'company.read', description: 'Firma bilgilerini goruntuleme izni.', module: 'company' },
  { name: 'company.manage', description: 'Firma yonetim islemlerini yapma izni.', module: 'company' },
  { name: 'platform.read', description: 'EVREN360 platform bilgilerini goruntuleme izni.', module: 'platform' },
  { name: 'platform.manage', description: 'EVREN360 platform yonetim islemlerini yapma izni.', module: 'platform' }
]

const PERMISSION_NAMES = new Set(PERMISSION_CATALOG.map(permission => permission.name))

export const getPermissionCatalog = (): PermissionModel[] => {
  return [...PERMISSION_CATALOG]
}

export const normalizePermissions = (permissions: string[]): PermissionName[] => {
  return Array.from(new Set(
    permissions.filter((permission): permission is PermissionName => {
      return PERMISSION_NAMES.has(permission as PermissionName)
    })
  ))
}

export const resolvePermissions = (
  permissions: string[],
  source: PermissionResolution['source'] = 'role'
): PermissionResolution => ({
  permissions: normalizePermissions(permissions),
  source
})

export const hasPermission = (
  permissions: string[],
  permission: string
) => {
  return normalizePermissions(permissions).includes(permission as PermissionName)
}
