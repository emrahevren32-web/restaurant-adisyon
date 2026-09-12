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
  // 2026-08-27 — veritabanında (0001) baştan beri vardı, kod kataloğunda yoktu.
  // Bkz. permission.service.ts'teki aynı tarihli not ve 0014_izin_katalogu.sql.
  | 'users.read'
  | 'users.manage'
  // ── Departman izinleri (0015) ──────────────────────────────────────────
  // Eski katalog departman ayrımı için fazla kabaydı: Satın Alma `finance.read`'e,
  // Reçete + Üretim + Kalite'nin ÜÇÜ BİRDEN `operations.read`'e bağlıydı. Yani
  // "kalite sorumlusu üretim ekranlarını görmesin" gibi bir ayrım kurulamıyordu.
  // Her çekirdek modül artık kendi departman iznini taşıyor.
  | 'purchase.read'
  | 'purchase.write'
  | 'production.read'
  | 'production.write'
  | 'recipe.read'
  | 'recipe.write'
  | 'quality.read'
  | 'quality.write'
  | 'logistics.read'
  | 'logistics.write'
  | 'branch.read'
  | 'branch.manage'
  | 'roles.manage'
  | 'settings.manage'
  | 'audit.read'

export type PermissionModel = {
  name: PermissionName
  description: string
  module: string
}

export type PermissionResolution = {
  permissions: PermissionName[]
  source: 'role' | 'identity' | 'public'
}
