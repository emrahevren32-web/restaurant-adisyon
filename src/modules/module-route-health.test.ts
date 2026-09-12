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

describe('Aşama 2–3.5 ekranları menüde CANLI', () => {
  // Bu ekranlar gerçek veritabanına konuşuyor ve demonun kendisi.
  // Biri kazara dondurulursa ya da menüden düşerse burada kırmızı olur.
  const olmasiGerekenler: BusinessWorkspaceRoute[] = [
    'depo', 'tedarikciler', 'satinalma',
    'receteler', 'uretim-emirleri', 'sevkiyatlar', 'izlenebilirlik',
    'haccp-kayitlari',
  ]

  it.each(olmasiGerekenler)('%s menüde canlı bir ögede duruyor', rota => {
    const bulunan = canliOgeler().filter(x => x.oge.route === rota)
    expect(bulunan.length, `${rota} canlı menüde yok`).toBe(1)
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
