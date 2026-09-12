// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 1 — Rota ↔ izin eşlemesi (ikinci savunma hattı)
//
// Yol haritası: "Yetkisiz uç yok, varsayılan reddet"
//
// ── SORUN ─────────────────────────────────────────────────────────────────
// `business-workspace.registry.ts` içindeki menü ögelerinin neredeyse hepsinde
// bir `requiredPermission` alanı var (`stock.read`, `finance.read`, ...) ve
// `workspace-navigation.registry.ts` bunu her menü düğümüne kopyalıyordu.
// Ama HİÇBİR YERDE OKUNMUYORDU: `App.tsx` içinde tek bir izin kontrolü yok,
// rota koruması yalnızca `currentUser.role === 'Admin'` string karşılaştırması.
// Yani alan doldurulmuş ama hiç kullanılmamış bir süstü.
//
// ── ÇÖZÜM: ADR-002'nin İKİ SAVUNMA HATTI KALIBI ──────────────────────────
// Dondurulmuş modüller için zaten kurulmuş olan desen birebir tekrarlanıyor:
//
//   1. hat — menü:  izni olmayan öge hiç ÜRETİLMEZ
//                   (`workspace-navigation.registry.ts` → `createMenuNode`)
//   2. hat — rota:  rota elle çağrılsa bile AÇILMAZ
//                   (`BusinessWorkspaceRouteHost` → bu dosyadaki kontrol)
//
// Tek başına menüyü gizlemek yeterli değildir: adres çubuğuna rotayı yazan
// kullanıcı ekranı yine açardı. "Yetkisiz uç yok" ancak ikinci hatla sağlanır.
//
// ── NEDEN "EN AZ BİR" İZİN ────────────────────────────────────────────────
// Rotalar paylaşılıyor: aynı rotaya işaret eden birden çok menü ögesi olabilir
// ve bunların gerektirdiği izinler farklı olabilir. Bu yüzden eşleme
// rota → İZİN KÜMESİ şeklinde ve kullanıcının bunlardan EN AZ BİRİNE sahip
// olması yetiyor — meşru bir giriş noktasından erişebiliyorsa, rota açıktır.
// (`getCoreWorkspaceRoutes()` içindeki beyaz liste mantığının aynısı.)
// ═══════════════════════════════════════════════════════════════════════════

import {
  BUSINESS_WORKSPACE_MODULE_REGISTRY,
  NON_NAV_CORE_ROUTES,
  type BusinessWorkspaceModule
} from '../modules/business-workspace.registry'
import type { BusinessWorkspaceRoute } from '../navigation/app-navigation.types'

/**
 * Kapsam içi (core) her rota için, o rotayı açan izinlerin kümesi.
 *
 * Dondurulmuş (frozen) ögeler hiç dolaşılmaz — onlar zaten rota seviyesinde
 * kapalı (ADR-002), izin kontrolüne kadar gelmezler.
 */
export const getWorkspaceRoutePermissions = (): Map<BusinessWorkspaceRoute, Set<string>> => {
  const map = new Map<BusinessWorkspaceRoute, Set<string>>()

  const add = (route: BusinessWorkspaceRoute, permission?: string) => {
    if (!permission) return
    const existing = map.get(route)
    if (existing) existing.add(permission)
    else map.set(route, new Set([permission]))
  }

  const walk = (module: BusinessWorkspaceModule, items: BusinessWorkspaceModule['menuItems']) => {
    items.forEach(item => {
      if (item.foundationScope === 'frozen') return
      if (item.route) {
        // Menü düğümü üretilirken kullanılan ifadenin AYNISI
        // (`workspace-navigation.registry.ts` → `createMenuNode`). İki yer
        // farklı bir izin hesaplarsa menü ile rota birbirini tutmaz.
        add(item.route, item.requiredPermission ?? module.permissions[0])
      }
      if (item.children) walk(module, item.children)
    })
  }

  BUSINESS_WORKSPACE_MODULE_REGISTRY.forEach(module => {
    if (module.foundationScope === 'frozen') return
    walk(module, module.menuItems)
  })

  return map
}

const ROUTE_PERMISSIONS = getWorkspaceRoutePermissions()

/**
 * Navigasyon dışından açılan, izne bağlanmayan rotalar.
 *
 * Bunlar `getCoreWorkspaceRoutes()`'un `NON_NAV_CORE_ROUTES` listesiyle aynı:
 * karşılama ekranı, profil sayfaları, mağaza ve entegrasyon merkezi. Hiçbiri
 * bir menü ögesinden gelmediği için `requiredPermission` taşımıyorlar; kendi
 * kapıları var (ör. mağaza ve lisans ekranları `isPlatformAdmin` istiyor).
 * Bunları izin kontrolüne sokmak, kurulumunu bitirmemiş kullanıcının giriş
 * akışını kırardı.
 */
const PERMISSION_EXEMPT_ROUTES = new Set<string>(NON_NAV_CORE_ROUTES)

/**
 * Kullanıcı bu rotayı açabilir mi?
 *
 * ── `undefined` ile `[]` ARASINDAKİ FARK ─────────────────────────────────
 *   `[]`         → "hiçbir izni yok"     → izin gerektiren her rota KAPALI.
 *   `undefined`  → "henüz yüklenmedi"    → süzme YAPILMAZ, rota açık.
 *
 * İkincisi bilinçli bir taviz ve gerekçesi şu: bu dosya bir GÜVENLİK SINIRI
 * DEĞİLDİR. `currentUser` tarayıcıda, localStorage'da duruyor; kullanıcı onu
 * istediği gibi düzenleyip kendine izin yazabilir. Yani `undefined` gördüğünde
 * reddetmek gerçek bir saldırganı durdurmaz — yalnızca bu değişiklikten ÖNCE
 * açılmış oturumları olan gerçek kullanıcıları uygulamadan kilitler.
 *
 * Asıl koruma veritabanındadır ve orada varsayılan gerçekten reddettir:
 * RLS her tabloda `enable` + `force` (ADR-004), politikasız tablo herkese
 * kapalıdır, yazma yetkisi sütun seviyesine indirilmiştir (0012). İzin
 * listesini tarayıcıda değiştiren biri, erişemediği veriyi yine göremez.
 *
 * Buradaki süzme onun ÜSTÜNE binen ikinci kat: kullanıcıya çalışmayacak
 * kapılar göstermemek ve yanlışlıkla açılan bir rotayı kapatmak için.
 */
export const isWorkspaceRouteAllowed = (
  route: BusinessWorkspaceRoute,
  permissions: readonly string[] | undefined | null
): boolean => {
  if (permissions === undefined || permissions === null) return true
  if (PERMISSION_EXEMPT_ROUTES.has(route)) return true

  const required = ROUTE_PERMISSIONS.get(route)

  // Eşlemede hiç yoksa: bu rota bir core menü ögesinden gelmiyor demektir.
  // Buraya düşen rotalar ya `NON_NAV_CORE_ROUTES` (yukarıda muaf) ya da zaten
  // `isFrozenWorkspaceRoute()` tarafından kapatılmış olanlardır. İzin bilgisi
  // olmayan bir rotayı izin YOKMUŞ gibi kapatmak, kapsam kararı olmayan bir
  // yeri sessizce erişilemez yapardı; kapsam kararını ADR-002 verir, bu dosya değil.
  if (!required || required.size === 0) return true

  // Buraya geldiyse izinler YÜKLENMİŞ demektir (yukarıdaki undefined kontrolü
  // geçildi). Boş liste "hiçbir izni yok" anlamına gelir ve reddedilir.
  if (permissions.length === 0) return false

  return permissions.some(permission => required.has(permission))
}
