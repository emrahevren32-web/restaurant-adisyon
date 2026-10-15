import { describe, expect, it } from 'vitest'
import { createBusinessWorkspaceNavGroups } from '../modules/business-workspace.navigation'
import {
  BUSINESS_WORKSPACE_MODULE_REGISTRY,
  isBusinessWorkspaceModuleAvailableForSector,
} from '../modules/business-workspace.registry'
import { cekirdekModulGorunur } from '../navigation/core-module-visibility'
import { isWorkspaceRouteAllowed } from './route-permission'
import { maliyetGorebilir } from './maliyet-gorunurlugu'
import { getDefaultModules } from '../sector/sector-template.service'
import type { User } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// ROL → EKRAN MATRİSİ · 14.10.2026
//
// Emrah sordu: *"her rol için birer personel oluştursam, hepsi kendi
// rollerinde sayfaları görecek diğerlerini göremeyecek, doğru mu anladım?"*
//
// Cevap: evet. Bu dosya o cevabı KİLİTLİYOR.
//
// ── NE SINANIYOR ─────────────────────────────────────────────────────────
// Her rol için ÜÇ KAPI birlikte:
//   1. Menü      — hangi ekranlar ÜRETİLİYOR
//   2. Rota      — menüde görünen her ekran AÇILABİLİYOR mu
//   3. Maliyet   — parasal bilgi görünüyor mu
// Üçü farklı ölçüt kullanırsa "menüde var, tıklayınca boş" doğar (tuzak 70).
//
// ── ⚠️ İZİN LİSTELERİ NEREDEN GELDİ ──────────────────────────────────────
// Aşağıdaki listeler 14.10.2026'da CANLI veritabanındaki `role_permission`
// satırlarından okundu. Veritabanı tek kaynaktır; bu dosya onun o günkü
// hâlinin ANLAŞILAN TASARIM olarak dondurulmuş kaydıdır.
//
// Bu bilinçli bir ikilik ve sebebi şu: rolleri değiştirmek bir İŞ KARARIDIR.
// Biri bir role izin eklediğinde bu test kırmızıya döner ve kararın
// görünmesini sağlar. Sessizce geçmesi, bir rolün kapsamının kimsenin
// fark etmediği bir anda genişlemesi demektir.
//
// Test kırılırsa yapılacak: önce "bu izin bilerek mi verildi" diye SOR;
// cevap evetse listeyi güncelle ve `claude/rol-ekran-matrisi.md`yi de
// güncelle. Testi susturmak için listeyi değiştirmek yanlıştır.
// ═══════════════════════════════════════════════════════════════════════════

const SEKTOR = 'sector_industrial_kitchen'

/** 'Admin' | 'Personel' kaba ayrımı — firma kapsamında tam yetkili roller. */
const FIRMA_GENELI = ['super_admin', 'admin', 'isletme_sahibi', 'isletme_muduru']

const ROL_IZINLERI: Record<string, string[]> = {
  isletme_sahibi: [
    'audit.read', 'branch.manage', 'branch.read', 'company.manage',
    'company.read', 'dashboard.read', 'finance.read', 'finance.write',
    'logistics.read', 'logistics.write', 'operations.approve',
    'operations.read', 'operations.write', 'personnel.manage',
    'personnel.read', 'production.read', 'production.write', 'products.read',
    'products.write', 'purchase.read', 'purchase.write',
    'quality.declaration', 'quality.read', 'quality.record.manage',
    'quality.write', 'recipe.read',
    'recipe.write', 'roles.manage', 'settings.manage', 'stock.read',
    'stock.write', 'users.manage', 'users.read',
  ],
  depo_sorumlusu: [
    'branch.read', 'dashboard.read', 'logistics.read', 'logistics.write',
    'production.read', 'products.read', 'purchase.read', 'quality.read',
    'recipe.read', 'stock.read', 'stock.write',
  ],
  satinalma_sorumlusu: [
    'branch.read', 'dashboard.read', 'finance.read', 'products.read',
    'purchase.read', 'purchase.write', 'stock.read',
  ],
  uretim_sorumlusu: [
    'branch.read', 'dashboard.read', 'production.read', 'production.write',
    'products.read', 'quality.read', 'quality.write', 'recipe.read',
    'recipe.write', 'stock.read', 'stock.write',
  ],
  kalite_sorumlusu: [
    'audit.read', 'branch.read', 'dashboard.read', 'logistics.read',
    'production.read', 'quality.declaration', 'quality.read',
    'quality.record.manage', 'quality.write',
    'recipe.read', 'stock.read',
  ],
  sevkiyat_sorumlusu: [
    'branch.read', 'dashboard.read', 'logistics.read', 'logistics.write',
    'products.read', 'quality.read', 'quality.write', 'stock.read',
    'stock.write',
  ],
  muhasebe: [
    'audit.read', 'branch.read', 'company.read', 'dashboard.read',
    'finance.read', 'finance.write', 'purchase.read', 'stock.read',
  ],
  personel: [
    'dashboard.read', 'production.read', 'production.write', 'products.read',
    'recipe.read', 'stock.read', 'stock.write',
  ],
  izleyici: [
    'audit.read', 'branch.read', 'company.read', 'dashboard.read',
    'finance.read', 'logistics.read', 'operations.read', 'personnel.read',
    'production.read', 'products.read', 'purchase.read', 'quality.read',
    'recipe.read', 'stock.read', 'users.read',
  ],
  gida_muhendisi: [
    'audit.read', 'branch.read', 'dashboard.read', 'logistics.read',
    'production.read', 'products.read', 'quality.declaration', 'quality.read',
    'quality.record.manage', 'quality.write', 'recipe.read', 'stock.read',
  ],
}

/**
 * ⚠️ BEKLENEN EKRAN SAYILARI — canlı ölçümle kıyaslanmış.
 *
 * Yukarıdaki izin listelerini İLK YAZIŞIMDA İKİSİNİ TAHMİN ETTİM
 * (üretim ve sevkiyat) ve ikisi de yanlıştı: 10 ekran hesapladım,
 * veritabanı 9 ve 8 veriyordu. Yakalayan şey bu sayı tablosuydu.
 *
 * Yani bu tablo süs değil: izin listesi gerçekten veritabanındaki gibi mi
 * sorusunun tek kanıtı. Biri listeyi değiştirip sayıyı güncellemezse test
 * kırılır — kırılması gerekir.
 */
const BEKLENEN_EKRAN_SAYISI: Record<string, number> = {
  isletme_sahibi: 19,
  depo_sorumlusu: 12,
  satinalma_sorumlusu: 7,
  uretim_sorumlusu: 9,
  kalite_sorumlusu: 11,
  sevkiyat_sorumlusu: 8,
  muhasebe: 8,
  personel: 6,
  izleyici: 16,
  gida_muhendisi: 11,
}

/** O rolün menüsünde ÜRETİLEN ekranlar (etiketleriyle). */
const menuEkranlari = (izinler: string[]): string[] => {
  const kullanici = kisi(izinler, 'personel')
  const gruplar = createBusinessWorkspaceNavGroups({
    hasPermission: izin => !izin || izinler.includes(izin),
    isCoreModuleVisible: modul => cekirdekModulGorunur(modul.code, {
      kurulumTamam: true, entegrasyonVar: false,
    }),
    isModuleEnabled: modul => {
      if(!isBusinessWorkspaceModuleAvailableForSector(modul, SEKTOR)) return false
      if((getDefaultModules(SEKTOR) as readonly string[]).includes(modul.code)) return true
      if(modul.isCoreModule || modul.isAlwaysActive) return true
      if(modul.isBusinessModule || modul.isIntegrationModule) return false
      return modul.isEnabled && modul.isVisible
    },
  })
  void kullanici
  const out: string[] = []
  const gez = (d: ReadonlyArray<{ label?: string; route?: string; children?: unknown }>) =>
    d.forEach(x => {
      if(x.route && x.label) out.push(x.label)
      const c = (x as { children?: ReadonlyArray<{ label?: string }> }).children
      if(c) gez(c as never)
    })
  gruplar.forEach(g => gez(g.items as never))
  return out
}

const menuRotalari = (izinler: string[]): string[] => {
  const gruplar = createBusinessWorkspaceNavGroups({
    hasPermission: izin => !izin || izinler.includes(izin),
    isCoreModuleVisible: modul => cekirdekModulGorunur(modul.code, {
      kurulumTamam: true, entegrasyonVar: false,
    }),
  })
  const out: string[] = []
  const gez = (d: ReadonlyArray<{ route?: string; children?: unknown }>) =>
    d.forEach(x => {
      if(x.route) out.push(x.route)
      const c = (x as { children?: ReadonlyArray<{ route?: string }> }).children
      if(c) gez(c as never)
    })
  gruplar.forEach(g => gez(g.items as never))
  return out
}

const kisi = (izinler: string[], rolKodu: string): User => ({
  id: 'u', fullName: 'T', username: 't',
  role: FIRMA_GENELI.includes(rolKodu) ? 'Admin' : 'Personel',
  roleCode: rolKodu, active: true, permissions: izinler,
}) as User

// ── 0 · İZİN LİSTELERİ VERİTABANIYLA AYNI MI ─────────────────────────────
describe('⚠️ İzin listeleri canlı veritabanıyla aynı menüyü üretiyor', () => {
  Object.entries(BEKLENEN_EKRAN_SAYISI).forEach(([rol, sayi]) => {
    it(`${rol} → ${sayi} ekran`, () => {
      expect(menuEkranlari(ROL_IZINLERI[rol]),
        'izin listesi veritabanından sapmış olabilir').toHaveLength(sayi)
    })
  })
})

// ── 1 · MENÜDE GÖRÜNEN HER EKRAN AÇILABİLİYOR ────────────────────────────
describe('Her rol: menüde görünen her ekran AÇILABİLİYOR', () => {
  Object.entries(ROL_IZINLERI).forEach(([rol, izinler]) => {
    it(`${rol} — menü ile rota kapısı aynı cevabı veriyor`, () => {
      const kopuk = menuRotalari(izinler)
        .filter(r => !isWorkspaceRouteAllowed(r as never, izinler))
      expect(kopuk, 'menüde görünüyor ama ekran açılmıyor').toEqual([])
    })
  })
})

// ── 2 · HER ROL KENDİ ALANINI GÖRÜYOR ────────────────────────────────────
describe('Her rol kendi alanını görüyor', () => {
  const gorur = (rol: string, ekran: string) =>
    expect(menuEkranlari(ROL_IZINLERI[rol])).toContain(ekran)

  it('depo sorumlusu: stok, sayım, fire, sevkiyat', () => {
    gorur('depo_sorumlusu', 'Stok Durumu')
    gorur('depo_sorumlusu', 'Stok Sayımları')
    gorur('depo_sorumlusu', 'Fire ve Kayıplar')
    gorur('depo_sorumlusu', 'Sevkiyatlar')
  })

  it('kalite sorumlusu: HACCP ve izlenebilirlik', () => {
    gorur('kalite_sorumlusu', 'HACCP Kontrolleri')
    gorur('kalite_sorumlusu', 'Ürün İzlenebilirliği')
  })

  it('⚠️ gıda mühendisi: HACCP, izlenebilirlik, etiket — demoda gösterilecek üçü', () => {
    gorur('gida_muhendisi', 'HACCP Kontrolleri')
    gorur('gida_muhendisi', 'Ürün İzlenebilirliği')
    gorur('gida_muhendisi', 'Etiket ve Alerjen')
  })

  it('satın alma sorumlusu: tedarikçi ve sipariş', () => {
    gorur('satinalma_sorumlusu', 'Tedarikçiler')
    gorur('satinalma_sorumlusu', 'Satın Alma Siparişleri')
  })

  it('üretim sorumlusu: reçete ve iş emri', () => {
    gorur('uretim_sorumlusu', 'Reçeteler')
    gorur('uretim_sorumlusu', 'İş Emirleri')
  })
})

// ── 3 · HER ROL BAŞKASININ ALANINI GÖRMÜYOR ──────────────────────────────
describe('⚠️ Her rol BAŞKASININ alanını görmüyor', () => {
  const gormez = (rol: string, ekran: string) =>
    expect(menuEkranlari(ROL_IZINLERI[rol])).not.toContain(ekran)

  it('YÖNETİM yalnız işletme sahibinde', () => {
    // `users.manage` tek bu rolde; müdür bile kullanıcı açamaz
    // (karar: yetki dağıtımı işletme sahibinde kalır).
    gormez('depo_sorumlusu', 'Kullanıcılar')
    gormez('kalite_sorumlusu', 'Kullanıcılar')
    gormez('uretim_sorumlusu', 'Şirket Ayarları')
    gormez('muhasebe', 'Kullanıcılar')
    gormez('gida_muhendisi', 'Kullanıcılar')
    expect(menuEkranlari(ROL_IZINLERI.isletme_sahibi)).toContain('Kullanıcılar')
  })

  it('⚠️ Analiz (finans) yalnız parasal yetkililerde', () => {
    gormez('depo_sorumlusu', 'Analiz')
    gormez('uretim_sorumlusu', 'Analiz')
    gormez('kalite_sorumlusu', 'Analiz')
    gormez('sevkiyat_sorumlusu', 'Analiz')
    gormez('gida_muhendisi', 'Analiz')
    gormez('personel', 'Analiz')
    expect(menuEkranlari(ROL_IZINLERI.muhasebe)).toContain('Analiz')
    expect(menuEkranlari(ROL_IZINLERI.satinalma_sorumlusu)).toContain('Analiz')
  })

  it('⚠️ müşteri ve sipariş defteri operasyon iznine bağlı', () => {
    // Codex denetimi 12.10: bunlar `production.read` ile açılıyordu.
    gormez('depo_sorumlusu', 'Müşteriler')
    gormez('depo_sorumlusu', 'Siparişler')
    gormez('uretim_sorumlusu', 'Müşteriler')
    gormez('kalite_sorumlusu', 'Siparişler')
  })

  it('⚠️ Veri ve Yedekleme yalnız işletme yönetiminde (14.10)', () => {
    // Bu ekran işletmenin BÜTÜN verisini dışarı çıkarabiliyor. Önce
    // `audit.read` ile açılıyordu ve o izin muhasebeci, kalite sorumlusu ve
    // GÖRÜNTÜLEYİCİDE de var — yani dışarıdan gelen bir danışman tüm
    // veritabanını indirebiliyordu. Kapı artık `company.manage`.
    gormez('muhasebe', 'Veri ve Yedekleme')
    gormez('kalite_sorumlusu', 'Veri ve Yedekleme')
    gormez('izleyici', 'Veri ve Yedekleme')
    gormez('gida_muhendisi', 'Veri ve Yedekleme')
    expect(menuEkranlari(ROL_IZINLERI.isletme_sahibi)).toContain('Veri ve Yedekleme')
  })

  it('⚠️ Değişiklik Kaydı DURUYOR — denetim okuma ayrı bir şey', () => {
    // Kalite sorumlusunun açıklamasında "denetim kaydını okur" yazıyor.
    // Veri ihracını kapatırken bunu da kapatmadığımızı sınıyoruz.
    expect(menuEkranlari(ROL_IZINLERI.kalite_sorumlusu)).toContain('Değişiklik Kaydı')
    expect(menuEkranlari(ROL_IZINLERI.muhasebe)).toContain('Değişiklik Kaydı')
  })

  it('⚠️ MOCK veriyle çalışan yedi analiz ekranı HİÇBİR rolde yok (14.10)', () => {
    // Emrah: "Mock veri asla ama asla olmayacak."
    const mockEkranlar = ['Günlük Üretim Analizi', 'Haftalık Üretim Analizi',
      'Sevkiyat Analizi', 'Fire Analizi', 'Maliyet Analizi',
      'Depo Performansı', 'Personel Performansı']
    Object.keys(ROL_IZINLERI).forEach(rol => {
      const ekranlar = menuEkranlari(ROL_IZINLERI[rol])
      mockEkranlar.forEach(e => expect(ekranlar, `${rol} mock ekran görüyor`).not.toContain(e))
    })
  })

  it('satın alma sorumlusu üretim ve kaliteye karışmıyor', () => {
    gormez('satinalma_sorumlusu', 'İş Emirleri')
    gormez('satinalma_sorumlusu', 'HACCP Kontrolleri')
    gormez('satinalma_sorumlusu', 'Sevkiyatlar')
  })

  it('operasyon personeli tedarikçi ve sevkiyat görmüyor', () => {
    gormez('personel', 'Tedarikçiler')
    gormez('personel', 'Sevkiyatlar')
    gormez('personel', 'Müşteriler')
  })
})

// ── 4 · PARASAL BİLGİ ────────────────────────────────────────────────────
describe('⚠️ Parasal bilgi — ekranda yazan söz', () => {
  const GORUR = ['isletme_sahibi', 'satinalma_sorumlusu', 'muhasebe']
  const GORMEZ = ['depo_sorumlusu', 'uretim_sorumlusu', 'kalite_sorumlusu',
    'sevkiyat_sorumlusu', 'personel', 'gida_muhendisi']

  GORUR.forEach(rol => {
    it(`${rol} maliyeti GÖRÜR`, () => {
      expect(maliyetGorebilir(kisi(ROL_IZINLERI[rol], rol))).toBe(true)
    })
  })

  GORMEZ.forEach(rol => {
    it(`⚠️ ${rol} maliyeti GÖRMEZ — rol açıklamasında yazan bu`, () => {
      expect(maliyetGorebilir(kisi(ROL_IZINLERI[rol], rol))).toBe(false)
    })
  })
})

// ── 5 · KAYIT DEFTERİ BÜTÜN ROLLERİ TANIYOR ──────────────────────────────
describe('Matris eksiksiz', () => {
  it('⚠️ her modülün izin listesi BOŞ DEĞİL', () => {
    // Boş kalsa `item.requiredPermission ?? module.permissions[0]` undefined
    // olur ve o modülün ekranları HERKESE açılır.
    const izinsiz = BUSINESS_WORKSPACE_MODULE_REGISTRY
      .filter(m => !m.permissions || m.permissions.length === 0)
      .map(m => m.code)
    expect(izinsiz, 'izin listesi boş modül = herkese açık ekran').toEqual([])
  })

  it('izni olmayan kişi hiçbir ekran görmüyor (varsayılan REDDET)', () => {
    expect(menuEkranlari([])).toEqual([])
  })
})
