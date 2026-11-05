// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — DEVRALINAN İZİN: MENÜNÜN GÖRÜNMEZ KAPISI
//
// ── NEDEN VAR (05.11.2026) ───────────────────────────────────────────────
// `src/navigation/workspace-navigation.registry.ts` içinde tek bir satır
// var ve menünün yarısının kapısı o satır:
//
//     const requiredPermission = item.requiredPermission ?? module.permissions[0]
//
// **Kendi `requiredPermission`ı olmayan bir menü ögesi, modülünün İLK
// iznini devralır.** Kayıt defterinde o ögelerin yanında hiçbir izin
// yazmaz; kapı, başka bir dosyadaki dizinin SIRASINDAN gelir.
//
// ⚠️ ÖLÇÜLDÜ: canlı menü ögelerinin çoğu bu devralmayla kapılı. Yani bir
// modülün `permissions` dizisini **yeniden sıralamak**, kimin hangi ekranı
// gördüğünü sessizce değiştirir. Örnek: `system-users.permissions`
// `['users.manage', 'users.read', …]` yerine `['users.read', …]` olsaydı,
// **İşletme Müdürü "Kullanıcılar" ekranını görmeye başlardı** — yetki
// dağıtımı ekranı, hiçbir izin satırı değişmeden.
//
// ⚠️ BU TUZAĞA BEN DÜŞTÜM. `isletme_muduru` için beklenen ekran sayısını
// türetirken yalnız ögelerin KENDİ izinlerine baktım, 19 dedim. Test 18
// dedi ve farkın `['Kullanıcılar', 'Veri ve Yedekleme']` olduğunu yazdı.
// "Kullanıcılar"ın kapısı görünmüyordu çünkü devralınmıştı.
//
// ── NE ÖLÇÜYOR ───────────────────────────────────────────────────────────
//   1. Devralma satırı hâlâ yerinde (yoksa aşağıdaki donma anlamsız olur),
//   2. Devralan canlı ögesi olan HER modülün `permissions[0]`ı donmuş,
//   3. Yeni bir modül devralmaya başlarsa tabloda yoksa KIRMIZI.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'
import { BUSINESS_WORKSPACE_MODULE_REGISTRY } from '../modules/business-workspace.registry'

const KOK = projeKokunuBul()
const NAV = readFileSync(
  join(KOK, 'src/navigation/workspace-navigation.registry.ts'), 'utf8') as string

/**
 * Devralan CANLI ögesi olan modüller → o modülün `permissions[0]`ı.
 *
 * ⚠️ Bu tablo bir KARAR kaydıdır, bir kopya değil. Bir satır değişirse
 * "izin dizisinin sırası mı değişti, yoksa öge mi kendi iznini aldı" diye
 * sorulur. Sessizce güncellenmez.
 */
const DEVRALINAN_IZIN: Record<string, string> = {
  'system-workspace-welcome': 'company.read',
  'system-dashboard': 'dashboard.read',
  'system-workspace': 'company.read',
  'system-integration-center': 'company.read',
  'system-tools': 'company.read',
  'system-executive-center': 'dashboard.read',
  'system-users': 'users.manage',
  'system-roles': 'roles.manage',
  'system-notifications': 'company.read',
  'system-license': 'company.read',
  'system-subscription': 'company.read',
  'system-support': 'company.read',
  'system-ai-center': 'dashboard.read',
  'business-adisyon': 'operations.read',
  'business-qr-menu': 'operations.read',
  'business-stock': 'stock.read',
  'business-purchase': 'purchase.read',
  'business-decision-support-workspace': 'dashboard.read',
  'business-production-work-orders': 'production.read',
  'business-current': 'finance.read',
  'business-credit': 'finance.read',
  'business-finance': 'finance.read',
  'business-personnel': 'personnel.read',
  'business-multi-branch': 'branch.read',
  'business-manager-alerts': 'dashboard.read',
}

type Oge = { requiredPermission?: string; foundationScope?: string; children?: Oge[] }

/** Bir modülün CANLI (donmamış) ögeleri, çocuklar dâhil. */
const canliOgeler = (ogeler: readonly Oge[]): Oge[] => {
  const cikti: Oge[] = []
  const gez = (liste: readonly Oge[]) => liste.forEach(oge => {
    if(oge.foundationScope === 'frozen') return
    cikti.push(oge)
    if(oge.children) gez(oge.children)
  })
  gez(ogeler)
  return cikti
}

/** Kendi izni olmayan — yani devralan — canlı ögesi olan modüller. */
const devralanModuller = (): string[] => BUSINESS_WORKSPACE_MODULE_REGISTRY
  .filter(modul => canliOgeler(modul.menuItems as unknown as Oge[])
    .some(oge => !oge.requiredPermission))
  .map(modul => modul.id)
  .sort()

describe('devralınan izin · menünün görünmez kapısı', () => {
  it('⚠️ devralma satırı HÂLÂ YERİNDE', () => {
    // Bu satır giderse aşağıdaki donma hiçbir şey ölçmez: ögeler kapısız
    // kalır ya da başka bir kurala geçer. İkisi de sessizce olmamalı.
    expect(
      NAV.replace(/\s+/g, ' '),
      'Menü ögesi artık modülün ilk iznini devralmıyor olabilir. '
      + 'Bu dosyadaki donmuş tablo o kurala dayanıyor.',
    ).toContain('item.requiredPermission ?? module.permissions[0]')
  })

  it('sağlama · kayıt defterinde gerçekten devralan ögeler var', () => {
    // Yoksa test boş kümeyi ölçüp yeşil kalırdı.
    expect(devralanModuller().length).toBeGreaterThan(10)
  })

  it('⚠️ devralan her modülün `permissions[0]`ı DONMUŞ', () => {
    const sapan: string[] = []
    for(const [modulId, beklenen] of Object.entries(DEVRALINAN_IZIN)){
      const modul = BUSINESS_WORKSPACE_MODULE_REGISTRY.find(m => m.id === modulId)
      if(!modul){ sapan.push(`${modulId}: modül kayıtta YOK`); continue }
      const ilk = modul.permissions[0]
      if(ilk !== beklenen) sapan.push(`${modulId}: ${beklenen} → ${ilk}`)
    }
    expect(
      sapan,
      'Bir modülün izin dizisinin SIRASI değişmiş. Bu, hiçbir izin satırı '
      + 'değişmeden kimin hangi ekranı gördüğünü değiştirir.',
    ).toEqual([])
  })

  it('⚠️ devralmaya yeni başlayan modül tabloda YOKSA kırmızı', () => {
    const tablosuz = devralanModuller().filter(id => !(id in DEVRALINAN_IZIN))
    expect(
      tablosuz,
      'Bu modüllerin canlı bir menü ögesi kendi iznini söylemiyor, yani '
      + 'modülün ilk iznini devralıyor — ama hangi izni devraldığı donmuş '
      + 'değil.',
    ).toEqual([])
  })

  it('tabloda olup artık devralmayan modül kalmamış', () => {
    const fazla = Object.keys(DEVRALINAN_IZIN).filter(id => !devralanModuller().includes(id))
    expect(fazla, 'ölçüm boşa koşuyor: bu modüller artık devralmıyor').toEqual([])
  })

  it('⚠️ iki somut kapı · müdür ve kalite sorumlusu', () => {
    // Bu iki satır, soyut kuralın ne anlama geldiğini gösteriyor.
    // `users.manage` müdürde YOK → "Kullanıcılar" ögesi ona üretilmiyor.
    expect(DEVRALINAN_IZIN['system-users']).toBe('users.manage')
    // `purchase.read` kalite sorumlusunda YOK → "Tedarikçiler" görünmüyor.
    expect(DEVRALINAN_IZIN['business-purchase']).toBe('purchase.read')
  })
})
