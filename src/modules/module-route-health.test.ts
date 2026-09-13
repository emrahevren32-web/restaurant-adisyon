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
    'depo', 'tedarikciler', 'satinalma',
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

  it('hepsi AÇIK bir modülün altında (kapalı modül menüde hiç üretilmez)', () => {
    // `shouldIncludeModule`: modül `isModuleEnabled` ile kapalıysa altındaki
    // hiçbir öge üretilmez. Bu kiracıda Kalite ve Lojistik modülleri kapalı;
    // ekranlarımız o modüllerin altına konulmamalı.
    const kapaliModuller = new Set(['business-quality', 'business-logistics'])
    const yanlisYerdekiler = canliOgeler()
      .filter(x => x.oge.route && olmasiGerekenler.includes(x.oge.route as BusinessWorkspaceRoute))
      .filter(x => kapaliModuller.has(x.modul))
      .map(x => `${x.oge.route} → ${x.modul}`)

    expect(yanlisYerdekiler, 'ekran kapalı bir modülün altında').toEqual([])
  })
})
