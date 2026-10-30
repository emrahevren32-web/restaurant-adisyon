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
  // ⚠️ `isletme_muduru` 30.10.2026'da EKLENDİ — ve eklenme sebebi bir
  // DELİKTİ, bir istek değil.
  //
  // Bu dosya 13 roldeki yetki çerçevesini sınadığını söylüyordu ama tabloda
  // 10 rol vardı. Eksik üçü: `super_admin`, `admin` (ikisi platform tarafı,
  // 35 izinle neredeyse her şeyi görüyor) ve `isletme_muduru` — ki o
  // MÜŞTERİNİN ROLÜ ve menüsü `isletme_sahibi`nden FARKLI.
  //
  // MIYOP-084'ü de tam burada kaçırdık: müdürün açamadığı bir ekranın
  // salt okunur modunu yazdım, hiçbir sınama bunu söylemedi çünkü müdür
  // hiç sınanmıyordu.
  //
  // İzinler canlı `role_permission` tablosundan okundu (30.10.2026, 29 satır).
  // Sahibinde olup müdürde OLMAYAN dördü: `company.manage`, `roles.manage`,
  // `settings.manage`, `users.manage` — yani müdür işletmeyi İŞLETİR,
  // kurallarını DEĞİŞTİRMEZ.
  isletme_muduru: [
    'audit.read', 'branch.manage', 'branch.read', 'company.read',
    'dashboard.read', 'finance.read', 'finance.write', 'logistics.read',
    'logistics.write', 'operations.approve', 'operations.read',
    'operations.write', 'personnel.manage', 'personnel.read',
    'production.read', 'production.write', 'products.read', 'products.write',
    'purchase.read', 'purchase.write', 'quality.declaration', 'quality.read',
    'quality.record.manage', 'quality.write', 'recipe.read', 'recipe.write',
    'stock.read', 'stock.write', 'users.read',
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
 *
 * ── 26.10.2026 · YEDİ SAYI BİRER ARTTI · ŞAHİT NUMUNE EKRANI ─────────────
 * Kalite modülüne üçüncü CANLI ekran eklendi (**Şahit Numune**,
 * `requiredPermission: 'quality.read'`). Test yedi rolde kırmızı verdi ve
 * **doğru yakaladı**: menü gerçekten büyüdü.
 *
 * ⚠️ SAYILARI TAHMİN ETMEDİM, KIRMIZININ KENDİSİ KANITLADI. Ögenin izni
 * `quality.read`; dolayısıyla yalnız o izni TAŞIYAN roller +1 almalı.
 * Ölçüm tam bunu gösterdi:
 *
 *   +1 alanlar (quality.read VAR)   : işletme sahibi, depo sorumlusu,
 *      üretim sorumlusu, kalite sorumlusu, sevkiyat sorumlusu, izleyici,
 *      gıda mühendisi  → yedisi de kırmızı verdi
 *   değişmeyenler (quality.read YOK): satın alma, muhasebe, personel
 *      → üçü de yeşil kaldı
 *
 * Yedi kırmızı + üç yeşil, kapının doğru izne bağlandığının kanıtı. Eğer
 * satın alma ya da muhasebe da kırmızı verseydi, izin yanlış seçilmiş
 * olurdu ve sayıyı güncellemek hatayı dondurmak olurdu (tuzak 114).
 *
 * ⚠️ Depo sorumlusunun ve sevkiyat sorumlusunun bu ekranı GÖRMESİ
 * bilinçli: İsmet numune akışını *"gıda teknikeri ve depocu kontrolünde"*
 * diye anlattı, sevkiyat da müşteri itirazının geldiği yer. İkisi de
 * YAZAMIYOR — yazma kapısı `quality.record.manage` veya `production.write`
 * ve ikisinde de yok (`src/quality/numune-kapisi.arch.test.ts`).
 */
/**
 * ── 30.10.2026 · İKİ SAYI BİRER ARTTI · MIYOP-084 ───────────────────────
 * "Şirket Ayarları" ögesinin açılma izni `settings.manage`ten
 * `company.read`e indi (gerekçe: business-workspace.registry.ts, ögenin
 * başındaki not). Yazma izni DEĞİŞMEDİ.
 *
 * ⚠️ BU SAYILAR ÖLÇÜM DEĞİL, ÖNGÖRÜ — ve bilerek öyle bırakıldı.
 * Burada `vitest` koşturamadığım bir ortamda yazıldılar. Öngörünün mantığı:
 * `company.read` ALTI rolde var (admin, isletme_muduru, isletme_sahibi,
 * izleyici, muhasebe, super_admin); bunlardan `settings.manage`i OLMAYAN
 * iki tanesi tabloda — `izleyici` ve `muhasebe` — yani yalnız o ikisi +1
 * almalı. `isletme_sahibi` ikisine de sahip, DEĞİŞMEMELİ (20 kalmalı).
 *
 * Testin işi öngörüyü onaylamak değil, YANLIŞSA SÖYLEMEK. Başka bir rolün
 * sayısı da değiştiyse kapı düşündüğümden geniş açılmış demektir ve
 * yapılacak şey sayıyı güncellemek DEĞİL, izni geri almaktır (tuzak 114).
 */
const BEKLENEN_EKRAN_SAYISI: Record<string, number> = {
  isletme_sahibi: 20,      // 19 + Şahit Numune
  depo_sorumlusu: 13,      // 12 + Şahit Numune
  satinalma_sorumlusu: 7,  // değişmedi: quality.read yok
  uretim_sorumlusu: 10,    // 9 + Şahit Numune
  kalite_sorumlusu: 12,    // 11 + Şahit Numune
  sevkiyat_sorumlusu: 9,   // 8 + Şahit Numune
  muhasebe: 9,             // ⚠️ 8 + Şirket Ayarları (MIYOP-084, aşağıya bak)
  personel: 6,             // değişmedi: quality.read yok
  izleyici: 18,            // ⚠️ 17 + Şirket Ayarları (MIYOP-084, aşağıya bak)
  gida_muhendisi: 12,      // 11 + Şahit Numune
}

/**
 * ⚠️ ŞAHİT NUMUNE EKRANINI GÖRMESİ GEREKEN VE GÖRMEMESİ GEREKEN ROLLER.
 *
 * Yukarıdaki sayı tablosu "kaç ekran" diyor, bu liste "HANGİ ekran" diyor.
 * Sayı doğru kalıp yanlış ekranın eklenmesi mümkün olduğu için ikisi ayrı
 * ölçülüyor: biri toplamı, diğeri kimliği sınıyor.
 */
const NUMUNEYI_GORENLER = [
  'isletme_sahibi', 'depo_sorumlusu', 'uretim_sorumlusu', 'kalite_sorumlusu',
  'sevkiyat_sorumlusu', 'izleyici', 'gida_muhendisi',
] as const

const NUMUNEYI_GORMEYENLER = [
  'satinalma_sorumlusu', 'muhasebe', 'personel',
] as const

/**
 * ⚠️ ETİKET KAYITTAN OKUNUYOR, ELLE YAZILMIYOR.
 *
 * `menuEkranlari()` **ROTA değil ETİKET** döndürüyor (`out.push(x.label)`).
 * Bu sınamaları ilk yazışımda rotayı (`'sahit-numune'`) bekledim ve yedi
 * tanesi kırmızı verdi. ⚠️ Ekran menüde VARDI — sayı sınamaları zaten +1
 * ile geçiyordu; yanlış olan benim beklentimin BİÇİMİYDİ. Yani test
 * ölçtüğünü sandığı şeyi ölçmüyordu (tuzak 72 ailesi).
 *
 * Etiketi elle yazmak aynı hatayı başka bir biçimde tekrarlamak olurdu:
 * etiket bir gün değişirse test yine yanlış sebeple kırılırdı. Değer
 * KAYITTAN okunuyor; öge kalkarsa dosya yüklenirken patlıyor — sessizce
 * yeşile dönmüyor.
 */
const NUMUNE_ETIKETI = (() => {
  const kalite = BUSINESS_WORKSPACE_MODULE_REGISTRY
    .find(m => m.id === 'business-quality')
  const oge = kalite?.menuItems.find(i => i.route === 'sahit-numune')
  if(!oge?.label){
    throw new Error(
      'Kalite modülünde `sahit-numune` rotalı menü ögesi yok — '
      + 'ekran menüden kalkmış olabilir.',
    )
  }
  return oge.label
})()

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

// ── 0.A · ŞAHİT NUMUNE EKRANI DOĞRU ROLLERDE (26.10) ─────────────────────
describe('Şahit Numune ekranı doğru rollerde görünüyor', () => {
  it('sağlama: menü listesi ETİKET taşıyor, rota değil', () => {
    // ⚠️ Bu sınamanın tek işi, ALTTAKİ sınamaların doğru biçimi
    // beklediğini doğrulamak. Olmasaydı `menuEkranlari()` bir gün rotaya
    // dönse yedi sınama birden "ekran menüde yok" diye kırılır ve ben
    // yine ekranı aramaya giderdim.
    const liste = menuEkranlari(ROL_IZINLERI.isletme_sahibi)
    expect(liste, 'liste etiket taşımıyor').toContain('Kontrol Paneli')
    expect(liste, 'liste ROTA taşıyor — beklenti biçimi değişmiş')
      .not.toContain('summary')
  })

  NUMUNEYI_GORENLER.forEach(rol => {
    it(`${rol} Şahit Numune'yi GÖRÜYOR`, () => {
      expect(
        menuEkranlari(ROL_IZINLERI[rol]),
        `${rol} şahit numune ekranını görmüyor — İsmet'in anlattığı akışın içinde`,
      ).toContain(NUMUNE_ETIKETI)
    })
  })

  NUMUNEYI_GORMEYENLER.forEach(rol => {
    it(`${rol} Şahit Numune'yi GÖRMÜYOR`, () => {
      // ⚠️ Olumsuz kontrol. Yalnız "görüyor"u sınamak, ögeyi herkese
      // açtığımızda da yeşil kalırdı.
      expect(
        menuEkranlari(ROL_IZINLERI[rol]),
        `${rol} şahit numune ekranını görüyor — kapı gevşemiş olabilir`,
      ).not.toContain(NUMUNE_ETIKETI)
    })
  })
})

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

// ── 1.A · MIYOP-084 · MÜDÜR AYARLARI GÖRÜR, DEĞİŞTİREMEZ ─────────────────
// ⚠️ Bu dört sınama bir ÖLÜ KODUN mezar taşıdır.
//
// `src/pages/Settings.tsx` müdür için salt okunur çalışacak biçimde yazıldı
// ("Müdür ayarları GÖREBİLMELİ, yalnız değiştiremez"). Ama ekranın kapısı
// `settings.manage` istiyordu ve müdürde o izin YOK — yani yazdığım salt
// okunur mod hiç çalışmıyordu, kimse de fark etmemişti.
//
// Sayı tablosu bunu yakalayamazdı: müdür o tabloda hiç yoktu. Bu yüzden
// ölçü sayı değil, KİMLİK: hangi rota açılıyor, hangisi açılmıyor.
describe('⚠️ MIYOP-084 · müdür Şirket Ayarları ekranını AÇABİLİYOR', () => {
  const MUDUR = ROL_IZINLERI.isletme_muduru

  it('müdür `settings` rotasını açabiliyor', () => {
    expect(
      isWorkspaceRouteAllowed('settings' as never, MUDUR),
      'müdür ayarları açamıyor — ekranın salt okunur modu yine ölü kod',
    ).toBe(true)
  })

  it('müdür menüsünde Şirket Ayarları GÖRÜNÜYOR', () => {
    // Rota açık olup menüde görünmemesi de bir kopukluktur: kişi ekranın
    // varlığını bilmez.
    expect(menuEkranlari(MUDUR)).toContain('Şirket Ayarları')
  })

  it('⚠️ müdür `veri-yedegi` rotasını AÇAMIYOR — kapı genişlemedi', () => {
    // Olumsuz kontrol. `company.read`i açarken bütün Yönetim bölümünü
    // açmadığımızın kanıtı: veri ihracı `company.manage` istiyor ve
    // müdürde o izin yok.
    expect(
      isWorkspaceRouteAllowed('veri-yedegi' as never, MUDUR),
      'müdür tüm veritabanını indirebiliyor — kapı gevşemiş',
    ).toBe(false)
  })

  it('⚠️ müdürün menüsü sahibinin menüsünün ALT KÜMESİ ve ondan KÜÇÜK', () => {
    // Bu sınamanın sayı tablosuna ihtiyacı yok: iki menüyü birbirine
    // ölçüyor. Müdüre sahipte olmayan bir ekran açılırsa kırmızı verir.
    const sahip = new Set(menuEkranlari(ROL_IZINLERI.isletme_sahibi))
    const mudur = menuEkranlari(MUDUR)
    expect(mudur.filter(e => !sahip.has(e)), 'müdür sahibin görmediği ekranı görüyor')
      .toEqual([])
    expect(mudur.length, 'müdürün menüsü sahibinkiyle aynı — dört eksik izin işlemiyor')
      .toBeLessThan(sahip.size)
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
  // ⚠️ `isletme_muduru` 30.10.2026'da eklendi: `finance.read` izni VAR
  // (canlı ölçüm), yani maliyeti görmesi gerekiyor.
  const GORUR = ['isletme_sahibi', 'isletme_muduru', 'satinalma_sorumlusu', 'muhasebe']
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
