// ═══════════════════════════════════════════════════════════════════════════
// Modül/menü sağlığı — SESSİZ menü hatalarını yakalar
//
// Bu dosya üç gerçek hatanın ardından yazıldı; üçü de "kod doğru, ekran yok"
// biçiminde ortaya çıktı ve hiçbir test yakalamıyordu:
//
//   1. Sevkiyat menü ögesi Lojistik modülüne konuldu — o modül bu kiracıda
//      kapalı, öge menüde HİÇ görünmedi.
//   2. HACCP ögesi Kalite modülüne konuldu — aynı sebeple görünmedi.
//   3. Eski ekranlar donduruldu ama modüllerin AÇILIŞ ROTASI hâlâ onları
//      gösteriyordu: modül kendi kendine kapalı bir rotayı işaret ediyordu.
//
// Üçü de derlemeden geçer, testlerden geçer, ekranda yoktur.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { BUSINESS_WORKSPACE_MODULE_REGISTRY } from './business-workspace.registry'
import type { BusinessWorkspaceModule } from './business-workspace.registry'
import type { BusinessWorkspaceRoute } from '../navigation/app-navigation.types'
import { createBusinessWorkspaceNavGroups } from './business-workspace.navigation'
import { cekirdekModulGorunur } from '../navigation/core-module-visibility'
import { isWorkspaceRouteAllowed } from '../authorization/route-permission'

const MODULLER: BusinessWorkspaceModule[] = BUSINESS_WORKSPACE_MODULE_REGISTRY

type Oge = { key: string; label: string; route?: string; foundationScope?: string; children?: Oge[] }

const tumOgeler = (): Array<{ modul: string; oge: Oge }> => {
  const out: Array<{ modul: string; oge: Oge }> = []
  const gez = (modul: string, ogeler: readonly Oge[]) => ogeler.forEach(o => {
    out.push({ modul, oge: o })
    if(o.children) gez(modul, o.children)
  })
  MODULLER.forEach((m: BusinessWorkspaceModule) => gez(m.id, (m.menuItems ?? []) as unknown as Oge[]))
  return out
}

const canliOgeler = () => tumOgeler().filter(x => x.oge.foundationScope !== 'frozen')

describe('Modül açılış rotaları', () => {
  it('hiçbir modül DONDURULMUŞ bir ekranı açılış rotası yapmıyor', () => {
    // Dondurulmuş rotalar: yalnızca frozen ögelerde geçen rotalar.
    const donduruleeek = new Set(
      tumOgeler().filter(x => x.oge.foundationScope === 'frozen' && x.oge.route)
        .map(x => x.oge.route!),
    )
    const canliRotalar = new Set(canliOgeler().filter(x => x.oge.route).map(x => x.oge.route!))
    // Bir rota hem frozen hem canlı ögede geçiyorsa sorun yok.
    const gercektenKapali = [...donduruleeek].filter(r => !canliRotalar.has(r))

    const hatalilar = MODULLER
      // Dondurulmuş modül menüde hiç üretilmiyor; rotası da önemsiz.
      .filter((m: BusinessWorkspaceModule) => m.foundationScope !== 'frozen')
      .filter((m: BusinessWorkspaceModule) => !!m.route && gercektenKapali.includes(m.route as string))
      .map((m: BusinessWorkspaceModule) => `${m.id} → ${m.route}`)

    expect(hatalilar, 'modül kapalı bir rotayı gösteriyor').toEqual([])
  })
})

describe('Menüde ikiz yok', () => {
  it('aynı etiket iki canlı menü ögesinde geçmiyor', () => {
    // "Sevkiyatlar" iki kez görününce kullanıcı hangisinin gerçek olduğunu
    // bilemez. Etiketin tekilliği ekranın tekilliği kadar önemli.
    const sayim = new Map<string, string[]>()
    canliOgeler().forEach(({ modul, oge }) => {
      const ad = oge.label.trim()
      sayim.set(ad, [...(sayim.get(ad) ?? []), `${modul}/${oge.key}`])
    })
    // Alt başlıklarda tekrar eden genel adlar (Kartlar, Hareketler, Raporlar)
    // farklı modüllerde meşrudur: "Stok → Kartlar" ile "Cari → Kartlar".
    const bagisik = new Set(['Kartlar', 'Hareketler', 'Raporlar', 'İşlemler', 'Takip'])
    const ikizler = [...sayim.entries()]
      .filter(([ad, yerler]) => yerler.length > 1 && !bagisik.has(ad))
      .map(([ad, yerler]) => `${ad}: ${yerler.join(', ')}`)

    expect(ikizler, 'aynı isim menüde iki kez').toEqual([])
  })
})

describe('Aşama 2–4 ekranları menüde CANLI', () => {
  // Bu ekranlar gerçek veritabanına konuşuyor ve demonun kendisi.
  // Biri kazara dondurulursa ya da menüden düşerse burada kırmızı olur.
  const olmasiGerekenler: BusinessWorkspaceRoute[] = [
    'depo', 'tedarikciler', 'musteriler', 'siparisler', 'satinalma',
    'receteler', 'uretim-emirleri', 'sevkiyatlar', 'izlenebilirlik',
    'haccp-kayitlari',
    'sayimlar',
    'zayi-imha',
    'islem-gecmisi',
    'veri-yedegi',
  ]

  it.each(olmasiGerekenler)('%s menüde canlı bir ögede duruyor', rota => {
    const bulunan = canliOgeler().filter(x => x.oge.route === rota)
    expect(bulunan.length, `${rota} canlı menüde yok`).toBe(1)
  })

  // ── EN ÖNEMLİ TEST ────────────────────────────────────────────────────
  // Yukarıdaki testler KAYIT DOSYASINA bakıyor. Ama menüyü kayıt dosyası
  // değil `createBusinessWorkspaceNavGroups` üretiyor ve arada üç ayrı
  // eleme var:
  //   1. `isModuleEnabled`  → kapalı modül (Sevkiyat, Lojistik'e konmuştu)
  //   2. `hasPermission`    → izinsiz öge (HACCP, Kalite'ye konmuştu)
  //   3. `CORE_WORKSPACE_MODULE_CODES` → SABİT BEYAZ LİSTE; WORKSPACE
  //      bölümünde yalnız altı kod var. "Audit" modülü bu listede olmadığı
  //      için altına konan İşlem Geçmişi hiç görünmedi.
  //
  // Üçü de kayıt dosyasında DOĞRU görünüyordu. Bu yüzden asıl sınama,
  // gerçekten üretilen menü ağacında aramak olmalı.
  it('hepsi GERÇEKTEN ÜRETİLEN menüde var (kayıt dosyasında olmak yetmez)', () => {
    // ⚠️ SEÇENEKLER GERÇEK UYGULAMADAKİ GİBİ VERİLİYOR.
    //
    // Önce seçeneksiz çağrılıyordu ve o hâlde bütün çekirdek modüller
    // görünür sayılıyordu. Sonuç: test "Ayarlar menüde" diyordu, ekranda
    // yoktu. Bir testin yeşil olup ekranın boş kalması, testin hiç
    // olmamasından kötüdür — yanlış bir güven verir.
    //
    // `cekirdekModulGorunur` App.tsx'in kullandığı işlevin ta kendisi.
    const gruplar = createBusinessWorkspaceNavGroups({
      isCoreModuleVisible: modul => cekirdekModulGorunur(modul.code, {
        kurulumTamam: true,
        entegrasyonVar: false,
      }),
    })

    const rotalar = new Set<string>()
    const gez = (dugumler: ReadonlyArray<{ route?: string; children?: unknown }>) =>
      dugumler.forEach(d => {
        if(d.route) rotalar.add(d.route)
        const cocuklar = (d as { children?: ReadonlyArray<{ route?: string }> }).children
        if(cocuklar) gez(cocuklar)
      })
    gruplar.forEach(g => gez(g.items as ReadonlyArray<{ route?: string }>))

    const eksikler = olmasiGerekenler.filter(r => !rotalar.has(r))
    expect(eksikler, 'ekran menü ağacında hiç üretilmiyor').toEqual([])
  })

  // Ayarlar `olmasiGerekenler` listesinde DEĞİL çünkü orada her rotanın
  // TEK bir ögede geçmesi bekleniyor; 'settings' rotası birkaç ögede
  // paylaşılıyor (Abonelik, Ayarlar…) ve bu meşru. Ama menüde bulunması
  // şart: Veri Yedeği onun altında duruyor ve iki kapıdan da geçmesi
  // gerekiyordu (beyaz liste + görünürlük kuralı).
  it('AYARLAR menüde üretiliyor — Veri Yedeği onun altında', () => {
    const gruplar = createBusinessWorkspaceNavGroups({
      isCoreModuleVisible: modul => cekirdekModulGorunur(modul.code, {
        kurulumTamam: true,
        entegrasyonVar: false,
      }),
    })
    const rotalar = new Set<string>()
    const gez = (dugumler: ReadonlyArray<{ route?: string; children?: unknown }>) =>
      dugumler.forEach(d => {
        if(d.route) rotalar.add(d.route)
        const cocuklar = (d as { children?: ReadonlyArray<{ route?: string }> }).children
        if(cocuklar) gez(cocuklar)
      })
    gruplar.forEach(g => gez(g.items as ReadonlyArray<{ route?: string }>))

    expect(rotalar.has('settings'), 'Ayarlar menüde yok').toBe(true)
    expect(rotalar.has('veri-yedegi'), 'Veri Yedeği menüde yok').toBe(true)
  })

  it('hiçbir canlı ekran DONDURULMUŞ bir modülün altında değil', () => {
    // `shouldIncludeModule` dondurulmuş modülü HER ZAMAN eler — kiracı ne
    // yaparsa yapsın. Canlı bir ekranı oraya koymak, ekranı yok etmektir.
    // Cari (business-current) 2026-09-13'te donduruldu; yarın biri oraya
    // gerçek bir ekran koyarsa bu test kırmızı olur.
    //
    // ⚠️ Bu test eskiden 'business-quality' ve 'business-logistics'i SABİT
    // olarak "kapalı" varsayıyordu. business-quality 2026-09-13'te
    // `isAlwaysActive` oldu (gıda üretiminde kalite eklenti değildir) ve test
    // yanlış bir gerçeği savunur hâle geldi. Sabit liste yerine kuralın
    // kendisi sınanıyor.
    const modulSahibi = new Map<string, BusinessWorkspaceModule>()
    MODULLER.forEach(m =>
      ((m.menuItems ?? []) as unknown as Oge[]).forEach(o => {
        if(o.route) modulSahibi.set(o.route, m)
        o.children?.forEach(c => { if(c.route) modulSahibi.set(c.route, m) })
      }))

    const riskliler = olmasiGerekenler
      .map(rota => ({ rota, modul: modulSahibi.get(rota) }))
      .filter(x => x.modul?.foundationScope === 'frozen')
      .map(x => `${x.rota} → ${x.modul!.id}`)

    expect(riskliler, 'canlı ekran DONDURULMUŞ bir modülün altında').toEqual([])
  })
})

describe('`isAlwaysActive` normalleştiricide EZİLMİYOR (2026-10-11)', () => {
  // ⚠️ Bu test bir ay süren sessiz bir hatayı kapatıyor.
  //
  // `defineModuleRegistry` içindeki normalleştirici `...module` yayılmasından
  // SONRA `isAlwaysActive: isCoreSystem` yazıyordu. Yani bir iş modülü
  // `isAlwaysActive: true` dese bile değer çöpe gidiyordu. Giriş tipi alanı
  // kabul ediyor, normalleştirici yok sayıyordu.
  //
  // Sonuç: Kalite modülü 09.13'ten beri "her zaman açık" yazdığı hâlde
  // kiracıda hiç görünmedi; HACCP ve izlenebilirlik Üretim'in altına
  // misafir kondu. Hata görünmez, çünkü kimse "neden yok" sorusunu
  // normalleştiriciye sormaz.
  it('bir iş modülü isAlwaysActive: true diyebiliyor', () => {
    const kalite = BUSINESS_WORKSPACE_MODULE_REGISTRY.find(m => m.id === 'business-quality')
    expect(kalite, 'Kalite modülü kayıttan kalkmış').toBeDefined()
    expect(kalite!.isAlwaysActive, 'Kalite her zaman açık olmalı — HACCP yasal zorunluluk').toBe(true)
  })

  it('çekirdek modüller her koşulda her zaman açık', () => {
    // Bir çekirdek modül `isAlwaysActive: false` yazarak kendini kapatamaz.
    BUSINESS_WORKSPACE_MODULE_REGISTRY
      .filter(m => m.isCoreModule)
      .forEach(m => expect(m.isAlwaysActive, `${m.id} çekirdek ama her zaman açık değil`).toBe(true))
  })

  it('Kalite grubu CANLI üç ekranla üretiliyor', () => {
    // Grup, görünür çocuğu olmadan üretilmiyor (visible: children.length > 0).
    // Donmuş 13 ögenin yanında gerçek ekranlar DURMALI.
    //
    // ⚠️ 26.10.2026 · İKİ → ÜÇ. **Şahit Numune** eklendi: defter 0093'te
    // kurulmuştu, ekran yoktu (Emrah: *"Şahit numune ekranı yok"*). Bu test
    // kırmızı verdi ve doğru yakaladı — grup gerçekten büyüdü.
    //
    // ⚠️ Liste kapalı tutuluyor (`toEqual`, `toContain` değil): donmuş bir
    // ögenin sessizce canlanması da bu testi kırmalı. Kalite grubundaki 13
    // donmuş ekranın hepsi uydurma veriyle çalışıyor; biri menüye çıkarsa
    // müşteri sahte satır görür.
    const kalite = BUSINESS_WORKSPACE_MODULE_REGISTRY.find(m => m.id === 'business-quality')!
    const canli = kalite.menuItems.filter(i => i.foundationScope !== 'frozen').map(i => i.key)
    expect(canli.sort()).toEqual(['haccp-kayitlari', 'izlenebilirlik', 'sahit-numune'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PERSONEL MENÜSÜ · `adminOnly` yetki çerçevesini EZMİYOR (2026-10-12)
//
// ── NE OLMUŞTU ────────────────────────────────────────────────────────────
// İşletmenin ilk personeli (depo sorumlusu) giriş yaptı ve MENÜSÜ TAMAMEN
// BOŞ geldi. Ölçüldü: 152 menü ögesinin 146'sı `adminOnly: true` taşıyordu
// ve AppShell onları `role !== 'Admin'` olan herkesten gizliyordu. `role`
// alanı yalnız 'Admin' | 'Personel' taşır; 13 rolün 9'u 'Personel'e düşer.
// Yani 13 rol ve 34 izinlik çerçeve menüde hiç işlemiyordu.
//
// Aşağıdaki testler o durumun geri gelmesini engelliyor. Hiçbiri "menü
// dolu mu" diye bakmıyor — "DOĞRU KİŞİYE doğru ekranlar mı" diye bakıyor.
// ═══════════════════════════════════════════════════════════════════════════
describe('Personel menüsü · izin kapısı (2026-10-12)', () => {
  const menu = (izinler: string[]) => {
    const gruplar = createBusinessWorkspaceNavGroups({
      hasPermission: izin => !izin || izinler.includes(izin),
      isCoreModuleVisible: modul => cekirdekModulGorunur(modul.code, {
        kurulumTamam: true,
        entegrasyonVar: false,
      }),
    })
    const etiketler: string[] = []
    const bayraklar: boolean[] = []
    const gez = (dugumler: ReadonlyArray<{ label?: string; route?: string; adminOnly?: boolean; children?: unknown }>) =>
      dugumler.forEach(d => {
        if(d.route && d.label) etiketler.push(d.label)
        bayraklar.push(Boolean(d.adminOnly))
        const cocuklar = (d as { children?: ReadonlyArray<{ label?: string }> }).children
        if(cocuklar) gez(cocuklar as never)
      })
    gruplar.forEach(g => gez(g.items as never))
    return { etiketler, adminOnlyTasiyan: bayraklar.filter(Boolean).length }
  }

  // Depo sorumlusunun GERÇEK izinleri (veritabanından okundu, 12.10.2026).
  const DEPO = [
    'dashboard.read', 'stock.read', 'stock.write', 'logistics.read',
    'logistics.write', 'purchase.read', 'production.read', 'quality.read',
    'recipe.read', 'branch.read', 'products.read',
  ]

  it('⚠️ üretilen menüde HİÇBİR öge `adminOnly` taşımıyor', () => {
    // Bayrak taşınırsa AppShell onu gizler ve kapı yeniden izinden değil
    // eski `Admin|Personel` ayrımından geçmeye başlar.
    expect(menu(DEPO).adminOnlyTasiyan).toBe(0)
  })

  it('⚠️ depo sorumlusunun menüsü BOŞ DEĞİL', () => {
    // Asıl hata tam buydu: giriş yapan personel bomboş bir ekran görüyordu.
    expect(menu(DEPO).etiketler.length).toBeGreaterThan(5)
  })

  it('depo sorumlusu kendi ekranlarını görüyor', () => {
    const e = menu(DEPO).etiketler
    expect(e).toContain('Kontrol Paneli')
    expect(e).toContain('Stok Durumu')
    expect(e).toContain('Fire ve Kayıplar')
  })

  it('⚠️ depo sorumlusu YÖNETİM ekranlarını GÖRMÜYOR', () => {
    // Bayrak kalktı diye kapı açılmadı: kapı artık izinde.
    const e = menu(DEPO).etiketler
    expect(e).not.toContain('Kullanıcılar')
    expect(e).not.toContain('Şirket Ayarları')
    expect(e).not.toContain('Analiz')      // finance.read gerekiyor
  })

  it('izni olmayan bir kişi hiçbir şey görmüyor (varsayılan REDDET)', () => {
    expect(menu([]).etiketler).toEqual([])
  })

  it('tek izinli kişi yalnız o alanı görüyor', () => {
    const e = menu(['quality.read']).etiketler
    expect(e).toContain('HACCP Kontrolleri')
    expect(e).not.toContain('Stok Durumu')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// MENÜ İLE EKRAN AYNI KAPIDAN GEÇER (2026-10-12)
//
// Menü kapısı düzeltildikten sonra personelin menüsü doldu ama ekranlar BOŞ
// geldi: `BusinessWorkspaceRouteHost` içinde `if(!isAdmin) return null` vardı
// ve altındaki ~120 rotayı Personel için null'a düşürüyordu.
//
// Buradaki test, menüde ÜRETİLEN her rotanın aynı kullanıcı için rota
// kapısından da GEÇTİĞİNİ sınar. İki kapı ayrı ölçüt kullanırsa "menüde var,
// tıklayınca boş" yeniden doğar.
// ═══════════════════════════════════════════════════════════════════════════
describe('Menüde görünen her ekran AÇILABİLİYOR (2026-10-12)', () => {
  const ROLLER: Record<string, string[]> = {
    depo_sorumlusu: [
      'dashboard.read', 'stock.read', 'stock.write', 'logistics.read',
      'logistics.write', 'purchase.read', 'production.read', 'quality.read',
      'recipe.read', 'branch.read', 'products.read',
    ],
    kalite_sorumlusu: ['dashboard.read', 'quality.read', 'quality.write', 'stock.read'],
    muhasebe: ['dashboard.read', 'finance.read', 'finance.write', 'purchase.read'],
  }

  const menuRotalari = (izinler: string[]) => {
    const gruplar = createBusinessWorkspaceNavGroups({
      hasPermission: izin => !izin || izinler.includes(izin),
      isCoreModuleVisible: modul => cekirdekModulGorunur(modul.code, {
        kurulumTamam: true, entegrasyonVar: false,
      }),
    })
    const rotalar: string[] = []
    const gez = (d: ReadonlyArray<{ route?: string; children?: unknown }>) =>
      d.forEach(x => {
        if(x.route) rotalar.push(x.route)
        const c = (x as { children?: ReadonlyArray<{ route?: string }> }).children
        if(c) gez(c)
      })
    gruplar.forEach(g => gez(g.items as never))
    return rotalar
  }

  Object.entries(ROLLER).forEach(([rol, izinler]) => {
    it(`${rol}: menüdeki her rota rota kapısından da geçiyor`, () => {
      const kapanan = menuRotalari(izinler)
        .filter(r => !isWorkspaceRouteAllowed(r as never, izinler))
      expect(kapanan, 'menüde görünüyor ama ekran açılmıyor').toEqual([])
    })
  })

  it('⚠️ izni olmayan rota menüde de yok, kapıdan da geçmiyor', () => {
    // Depo sorumlusunun finans izni yok; Analiz ekranı iki kapıda da kapalı.
    expect(menuRotalari(ROLLER.depo_sorumlusu)).not.toContain('kpi-dashboard')
    expect(isWorkspaceRouteAllowed('kpi-dashboard' as never, ROLLER.depo_sorumlusu)).toBe(false)
  })

  it('⚠️ Codex 12.10: Müşteriler/Siparişler üretim iznine bağlı DEĞİL', () => {
    // Depo sorumlusunda `production.read` var ama `operations.read` yok;
    // müşteri ve sipariş defterini görmemeli.
    const r = menuRotalari(ROLLER.depo_sorumlusu)
    expect(r).not.toContain('musteriler')
    expect(r).not.toContain('siparisler')
    // Sevkiyat kendi izniyle açık kalıyor — depocu sevkiyat hazırlar.
    expect(r).toContain('sevkiyatlar')
    // Reçete de kendi izniyle.
    expect(r).toContain('receteler')
  })
})
