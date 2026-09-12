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
  { name: 'operations.read', description: 'Business Workspace operasyon ekranlarini goruntuleme izni.', module: 'business-workspace' },
  { name: 'operations.write', description: 'Business Workspace operasyon verilerini yonetme izni.', module: 'business-workspace' },
  { name: 'company.read', description: 'Firma bilgilerini goruntuleme izni.', module: 'company' },
  { name: 'company.manage', description: 'Firma yonetim islemlerini yapma izni.', module: 'company' },
  { name: 'platform.read', description: 'EVREN360 platform bilgilerini goruntuleme izni.', module: 'platform' },
  { name: 'platform.manage', description: 'EVREN360 platform yonetim islemlerini yapma izni.', module: 'platform' },
  // 2026-08-27 eki — bu iki izin `0001_kimlik_ve_tenant.sql` ile VERİTABANINDA
  // zaten vardı ama kod kataloğunda yoktu. `permission.repository.ts` tanımadığı
  // izinleri elediği için, eklenmeselerdi yöneticinin kullanıcı yönetimi izni
  // sessizce düşerdi. Katalog böylece 15 → 17 oldu ve iki taraf birebir eşitlendi
  // (bkz. 0014_izin_katalogu.sql doğrulama sorgusu).
  { name: 'users.read', description: 'Kullanicilari goruntuleme izni.', module: 'users' },
  { name: 'users.manage', description: 'Kullanici ve yetki yonetimi izni.', module: 'users' },
  // ── Departman izinleri (2026-08-27, 0015) ────────────────────────────────
  // Her cekirdek modul kendi departman iznini tasir; boylece "kalite sorumlusu
  // uretimi gormesin" gibi ayrimlar kurulabilir. Bkz. docs/yetki-cercevesi.md
  { name: 'purchase.read', description: 'Satin alma taleplerini ve siparislerini goruntuleme.', module: 'purchase' },
  { name: 'purchase.write', description: 'Satin alma talebi/siparisi olusturma ve tedarikci yonetimi.', module: 'purchase' },
  { name: 'production.read', description: 'Uretim is emirlerini goruntuleme.', module: 'production' },
  { name: 'production.write', description: 'Uretim is emri acma, yurutme ve tuketim yazma.', module: 'production' },
  { name: 'recipe.read', description: 'Receteleri goruntuleme.', module: 'recipe' },
  { name: 'recipe.write', description: 'Recete olusturma ve guncelleme.', module: 'recipe' },
  { name: 'quality.read', description: 'Kalite kayitlarini, lot ve izlenebilirligi goruntuleme.', module: 'quality' },
  { name: 'quality.write', description: 'Kalite kaydi girme, geri cagirma baslatma.', module: 'quality' },
  { name: 'logistics.read', description: 'Sevkiyat ve irsaliyeleri goruntuleme.', module: 'logistics' },
  { name: 'logistics.write', description: 'Sevkiyat yurutme ve irsaliye kesme.', module: 'logistics' },
  { name: 'branch.read', description: 'Sube listesini ve bilgilerini goruntuleme.', module: 'branch' },
  { name: 'branch.manage', description: 'Sube olusturma, guncelleme ve yetkilendirme.', module: 'branch' },
  { name: 'roles.manage', description: 'Rol tanimlarini ve rol-izin eslemesini yonetme.', module: 'roles' },
  { name: 'settings.manage', description: 'Isletme genel ayarlarini degistirme.', module: 'settings' },
  { name: 'audit.read', description: 'Islem gecmisini (audit) goruntuleme.', module: 'audit' }
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
