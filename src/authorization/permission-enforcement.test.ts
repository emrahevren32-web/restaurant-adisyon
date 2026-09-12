// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 1 — İzin zorlaması testleri
//
// Yol haritası: "PERMISSION_CATALOG (15 izin) tablolara taşındı /
//                Yetkisiz uç yok, varsayılan reddet"
//
// İki savunma hattının ikisini de sınar:
//   1. Menü:  izni olmayan öge ÜRETİLMEZ (workspace-navigation.registry.ts)
//   2. Rota:  izni olmayan rota AÇILMAZ  (authorization/route-permission.ts)
//
// Ayrıca kod kataloğu ile veritabanı kataloğunun eşitliğini ve
// `permission.repository.ts`'in "okuyamadım ≠ izni yok" ayrımını sınar.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { PERMISSION_CATALOG, normalizePermissions } from './permission.service'
import { isWorkspaceRouteAllowed, getWorkspaceRoutePermissions } from './route-permission'
import { createWorkspaceNavigationRegistry } from '../navigation/workspace-navigation.registry'
import type { BusinessWorkspaceRoute } from '../navigation/app-navigation.types'

// 0014_izin_katalogu.sql'in veritabanına yazdığı katalogun birebir aynısı.
// Bu dizi ile PERMISSION_CATALOG ayrışırsa test kırılır — kod ile migration'ın
// sessizce birbirinden uzaklaşmasını engelleyen tek bekçi budur.
const VERITABANI_KATALOGU = [
  // 0014
  'dashboard.read', 'stock.read', 'stock.write', 'operations.read', 'operations.write',
  'company.read', 'company.manage', 'users.read', 'users.manage', 'products.read',
  'products.write', 'finance.read', 'finance.write', 'personnel.read', 'personnel.manage',
  'platform.read', 'platform.manage',
  // 0015 — departman izinleri
  'purchase.read', 'purchase.write', 'production.read', 'production.write',
  'recipe.read', 'recipe.write', 'quality.read', 'quality.write',
  'logistics.read', 'logistics.write', 'branch.read', 'branch.manage',
  'roles.manage', 'settings.manage', 'audit.read'
]

describe('İzin kataloğu · kod ile veritabanı aynı', () => {
  it('kod kataloğu 32 izin içeriyor', () => {
    expect(PERMISSION_CATALOG).toHaveLength(32)
  })

  it('kod kataloğu ile 0014+0015 kataloğu birebir aynı kümedir', () => {
    const kod = [...PERMISSION_CATALOG.map(p => p.name)].sort()
    const veritabani = [...VERITABANI_KATALOGU].sort()
    expect(kod).toEqual(veritabani)
  })

  it('tanınmayan bir izin adı sessizce elenir (varsayılan reddet)', () => {
    // permission.repository.ts veritabanından gelen kodları bundan geçirir:
    // kodun bilmediği bir yetkiyi geçerli saymak varsayılan reddete aykırı olurdu.
    expect(normalizePermissions(['stock.read', 'uydurma.izin'])).toEqual(['stock.read'])
  })
})

describe('Rota koruması · ikinci savunma hattı', () => {
  // Rota adı SABİT YAZILMIYOR, haritadan türetiliyor. Böylece registry'de bir
  // rota yeniden adlandırılsa bile test, var olmayan bir rotayı sınayıp
  // sessizce "geçti" demek yerine gerçek bir rotayı sınamayı sürdürür.
  const harita = getWorkspaceRoutePermissions()
  const [ornekRota, ornekIzinler] = ([...harita.entries()][0] ?? []) as
    [BusinessWorkspaceRoute | undefined, Set<string> | undefined]

  it('eşleme gerçekten kuruldu (en az bir rota izne bağlı)', () => {
    expect(harita.size).toBeGreaterThan(0)
    expect(ornekRota).toBeTruthy()
    expect(ornekIzinler!.size).toBeGreaterThan(0)
  })

  it('izni olan kullanıcı rotayı açabilir', () => {
    expect(isWorkspaceRouteAllowed(ornekRota!, [...ornekIzinler!])).toBe(true)
  })

  it('izni OLMAYAN kullanıcı rotayı açamaz — menüde gizlemek yetmez', () => {
    // Asıl mesele bu: menüyü süzmek, adres çubuğuna rotayı yazan kullanıcıyı
    // durdurmaz. "Yetkisiz uç yok" ancak bu kontrolle sağlanır.
    // Karşılaştırma izni, bu rotanın gerektirmediklerinden seçiliyor.
    const alakasiz = ['dashboard.read', 'finance.read', 'personnel.manage', 'platform.manage']
      .filter(p => !ornekIzinler!.has(p))
    expect(alakasiz.length, 'karşılaştırma için alakasız bir izin bulunmalı').toBeGreaterThan(0)
    expect(isWorkspaceRouteAllowed(ornekRota!, alakasiz)).toBe(false)
  })

  it('boş izin listesi = hiçbir izin yok → kapalı', () => {
    expect(isWorkspaceRouteAllowed(ornekRota!, [])).toBe(false)
  })

  it('izinler HENÜZ YÜKLENMEDİYSE (undefined) süzme yapılmaz', () => {
    // Bilinçli taviz: bu katman güvenlik sınırı değil (currentUser tarayıcıda
    // duruyor, düzenlenebilir). undefined'da reddetmek saldırganı durdurmaz,
    // yalnızca eski oturumu olan gerçek kullanıcıyı kilitler. Asıl koruma
    // veritabanındadır (RLS + kolon GRANT'leri).
    expect(isWorkspaceRouteAllowed(ornekRota!, undefined)).toBe(true)
  })

  it('izne bağlı olmayan rotalar (profil, mağaza) her zaman açık', () => {
    expect(isWorkspaceRouteAllowed('my-profile' as BusinessWorkspaceRoute, [])).toBe(true)
    expect(isWorkspaceRouteAllowed('marketplace' as BusinessWorkspaceRoute, [])).toBe(true)
  })
})

describe('Menü süzmesi · birinci savunma hattı', () => {
  const tumDugumler = (registry: ReturnType<typeof createWorkspaceNavigationRegistry>) => {
    const out: { route?: string; requiredPermission?: string }[] = []
    const walk = (nodes: any[]) => nodes.forEach(n => {
      out.push({ route: n.route, requiredPermission: n.requiredPermission })
      if(n.children) walk(n.children)
    })
    walk([...registry.systemModules, ...registry.businessModules, ...registry.integrationModules])
    return out
  }

  it('hasPermission verilmezse davranış DEĞİŞMEZ (geriye dönük uyumluluk)', () => {
    const suzulmemis = tumDugumler(createWorkspaceNavigationRegistry({}))
    expect(suzulmemis.length).toBeGreaterThan(0)
  })

  it('hiçbir izni olmayan kullanıcıya izin gerektiren öge gösterilmez', () => {
    const hicbiri = createWorkspaceNavigationRegistry({ hasPermission: () => false })
    const dugumler = tumDugumler(hicbiri)
    // İzin gerektiren tek bir öge bile kalmamalı.
    expect(dugumler.filter(d => d.requiredPermission)).toHaveLength(0)
  })

  it('yalnızca stock.read olan kullanıcı finans ögelerini görmez', () => {
    const sadeceStok = createWorkspaceNavigationRegistry({
      hasPermission: permission => permission === 'stock.read'
    })
    const dugumler = tumDugumler(sadeceStok)

    expect(dugumler.some(d => d.requiredPermission === 'stock.read')).toBe(true)
    expect(dugumler.some(d => d.requiredPermission === 'finance.read')).toBe(false)
    expect(dugumler.some(d => d.requiredPermission === 'personnel.manage')).toBe(false)
  })

  it('tüm izinleri olan kullanıcı, süzme yokmuş gibi aynı menüyü görür', () => {
    // Regresyon bekçisi: Emrah `admin` ve 0014/0015 admin'e 32 iznin hepsini
    // veriyor. Bu test kırılırsa, izin süzmesi yöneticinin kendi menüsünü
    // daraltmış demektir.
    const suzulmemis = tumDugumler(createWorkspaceNavigationRegistry({}))
    const tamYetkili = tumDugumler(createWorkspaceNavigationRegistry({ hasPermission: () => true }))
    expect(tamYetkili).toEqual(suzulmemis)
  })
})

describe('Departman ayrımı · 0015 bunun için var', () => {
  // 0015 ÖNCESİ Reçete + Üretim + Kalite modüllerinin ÜÇÜ BİRDEN
  // `operations.read` iznine bağlıydı; Satın Alma ise `finance.read`'e.
  // Yani "kalite sorumlusu üretimi görmesin" kurulamıyordu. Bu blok, ayrımın
  // gerçekten kurulduğunu ve ileride kazara geri alınmadığını sınar.
  const izinleriOlanRotalar = (izinler: string[]) => {
    const reg = createWorkspaceNavigationRegistry({
      hasPermission: p => !p || izinler.includes(p as string)
    })
    const out: string[] = []
    const walk = (ns: any[]) => ns.forEach(n => {
      if(n.route) out.push(n.route)
      if(n.children) walk(n.children)
    })
    walk([...reg.systemModules, ...reg.businessModules, ...reg.integrationModules])
    return out
  }

  it('her departman izni ayrı bir menü kümesi açar', () => {
    const kalite  = izinleriOlanRotalar(['quality.read'])
    const uretim  = izinleriOlanRotalar(['production.read'])
    const satinal = izinleriOlanRotalar(['purchase.read'])

    expect(kalite.length).toBeGreaterThan(0)
    expect(uretim.length).toBeGreaterThan(0)
    expect(satinal.length).toBeGreaterThan(0)

    // Üç departmanın açtığı ekranlar birbirinden farklı olmalı. Aynı çıkıyorsa
    // izinler yine ortak bir kovaya bağlanmış demektir — 0015 boşa gitmiştir.
    expect(new Set(kalite)).not.toEqual(new Set(uretim))
    expect(new Set(uretim)).not.toEqual(new Set(satinal))
  })

  it('kalite sorumlusu üretim iş emri ekranlarını GÖRMEZ', () => {
    const kaliteRotalari = izinleriOlanRotalar(['quality.read'])
    const uretimRotalari = izinleriOlanRotalar(['production.read'])
    const kesisim = uretimRotalari.filter(r => kaliteRotalari.includes(r))
    expect(kesisim, 'üretim ekranları kaliteye sızmış').toHaveLength(0)
  })

  it('satın alma artık finance.read ile DEĞİL, purchase.read ile açılıyor', () => {
    const finansla = izinleriOlanRotalar(['finance.read'])
    const satinalmayla = izinleriOlanRotalar(['purchase.read'])
    expect(satinalmayla.length).toBeGreaterThan(0)
    // Muhasebecinin (finance.read) satın alma ekranlarını açmaması gerekir.
    const kesisim = satinalmayla.filter(r => finansla.includes(r))
    expect(kesisim, 'satın alma hâlâ finance.read ile açılıyor').toHaveLength(0)
  })
})
