// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — EVREN360 PANELİ YALAN SÖYLEMEZ
//
// 2026-10-16'da ölçüldü: panelin 19 menü ögesinden yalnız 2'si veritabanını
// okuyordu. Kalan 17'si `storage.ts` (tarayıcının localStorage'ı) ya da bir
// `.mock` dosyası okuyordu. Son 10 menü ögesi aslında TEK bileşendi
// (`SaasManagementCenter`, `view` prop'u değişiyordu).
//
// Emrah'ın sorusu buydu: "benim bu konuda bir veri'm yok ki." Veri vardı;
// ekranlar ona bakmıyordu.
//
// Bu test üç şeyi birden kilitler:
//
//   1. Kayıt defterindeki `veriKaynagi` etiketi DOĞRU mu? Test, ekranın
//      kaynak dosyasını AÇIP okur. 'veritabani' yazıp localStorage okumak
//      testi kırar — yani bu etiket bir temenni değil, ölçülen bir olgu.
//   2. Üç kapı (menü kilidi · tıklama · rota) aynı şeyi mi söylüyor?
//   3. Platform sahibi kiracı menülerini görmüyor mu?
//
// ⚠️ EN KÖTÜ SONUÇ "HİÇ DOSYA BULAMADIM" DEYİP YEŞİL GEÇMEKTİR (tuzak 58).
// Dosya sayısı ve rota sayısı için alt sınır sağlamaları aşağıda.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'
import type { PlatformRoute } from '../navigation/app-navigation.types'
import {
  PLATFORM_HAZIR_ROTALAR,
  PLATFORM_MODULE_REGISTRY,
  PLATFORM_NAV_GROUPS,
  createPlatformNavGroups,
  getIlkHazirPlatformRotasi,
  getPlatformRegistry
} from './platform.registry'

const KOK = projeKokunuBul()
const SRC = join(KOK, 'src')
const APP_TSX = readFileSync(join(SRC, 'App.tsx'), 'utf8') as string

/** Bir dosya tarayıcı hafızasından ya da mock'tan mı besleniyor? */
const uydurmaKaynakOkuyor = (icerik: string) => (
  /from '\.\.?\/storage'/.test(icerik)
  || /from '[^']*\.mock(-repository)?'/.test(icerik)
)

/** Bir dosya Supabase'i okuyor mu? */
const veritabaniOkuyor = (icerik: string) => /from '[^']*core\/supabase'/.test(icerik)

const kayitIcerigi = (kaynakDosya: string) => {
  const tam = join(SRC, kaynakDosya)
  expect(existsSync(tam), `${kaynakDosya} diskte yok`).toBe(true)
  return readFileSync(tam, 'utf8') as string
}

describe('EVREN360 paneli · kayıt defteri gerçeği söylüyor', () => {
  it('sağlama: kayıt defteri boş değil', () => {
    expect(PLATFORM_MODULE_REGISTRY.length).toBeGreaterThanOrEqual(19)
    expect(PLATFORM_HAZIR_ROTALAR.size).toBeGreaterThanOrEqual(1)
  })

  it('her ögenin kaynak dosyası diskte var', () => {
    for(const item of PLATFORM_MODULE_REGISTRY){
      expect(existsSync(join(SRC, item.kaynakDosya)), `${item.name} → ${item.kaynakDosya}`).toBe(true)
    }
  })

  it("'veritabani' etiketli ekran GERÇEKTEN Supabase okuyor", () => {
    const hazir = PLATFORM_MODULE_REGISTRY.filter(item => item.veriKaynagi === 'veritabani')
    expect(hazir.length).toBeGreaterThanOrEqual(1)

    for(const item of hazir){
      const icerik = kayitIcerigi(item.kaynakDosya)
      expect(veritabaniOkuyor(icerik), `${item.name} Supabase okumuyor`).toBe(true)
      expect(uydurmaKaynakOkuyor(icerik), `${item.name} hâlâ localStorage/mock okuyor`).toBe(false)
    }
  })

  it("'hazirlaniyor' etiketi gerçekten uydurma kaynak okuyan ekranlara konmuş", () => {
    // Ters yön de önemli: çalışan bir ekranı boşuna kilitli tutmayalım.
    for(const item of PLATFORM_MODULE_REGISTRY.filter(x => x.veriKaynagi === 'hazirlaniyor')){
      const icerik = kayitIcerigi(item.kaynakDosya)
      expect(
        uydurmaKaynakOkuyor(icerik),
        `${item.name} aslında uydurma kaynak okumuyor — kilidi kaldırmayı düşün`
      ).toBe(true)
    }
  })

  it("her 'hazirlaniyor' ögesinin bir gerekçesi yazılı", () => {
    for(const item of PLATFORM_MODULE_REGISTRY.filter(x => x.veriKaynagi === 'hazirlaniyor')){
      expect((item.bekleyenIs ?? '').trim().length, `${item.name} için bekleyenIs boş`).toBeGreaterThan(5)
    }
  })

  it('rota ve menü anahtarları tekil', () => {
    const rotalar = PLATFORM_MODULE_REGISTRY.map(x => x.route)
    const anahtarlar = PLATFORM_MODULE_REGISTRY.map(x => x.navKey)
    const kimlikler = PLATFORM_MODULE_REGISTRY.map(x => x.id)
    expect(new Set(rotalar).size).toBe(rotalar.length)
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length)
    expect(new Set(kimlikler).size).toBe(kimlikler.length)
  })

  it('her ögenin grubu tanımlı gruplardan biri', () => {
    const gruplar = new Set(PLATFORM_NAV_GROUPS.map(g => g.key))
    for(const item of PLATFORM_MODULE_REGISTRY){
      expect(gruplar.has(item.groupKey), `${item.name} → ${item.groupKey}`).toBe(true)
    }
  })
})

describe('EVREN360 paneli · üç kapı aynı şeyi söylüyor', () => {
  it('1. kapı · menüdeki kilit, hazır rota listesiyle birebir', () => {
    const ogeler = createPlatformNavGroups().flatMap(group => group.items)
    expect(ogeler.length).toBeGreaterThanOrEqual(19)

    for(const oge of ogeler){
      const beklenenKilit = !PLATFORM_HAZIR_ROTALAR.has(oge.route as PlatformRoute)
      expect(Boolean(oge.locked), `${oge.label} kilidi yanlış`).toBe(beklenenKilit)
      if(beklenenKilit){
        expect((oge.disabledReason ?? '').length, `${oge.label} gerekçesiz kilitli`).toBeGreaterThan(10)
      } else {
        expect(oge.disabledReason).toBeUndefined()
      }
    }
  })

  it('2. kapı · App.tsx tıklamada item.locked kontrolü yapıyor', () => {
    expect(APP_TSX).toContain('if(item.locked){')
    expect(APP_TSX).toContain('item.disabledReason || LICENSE_ACCESS_DENIED_MESSAGE')
  })

  it('3. kapı · her platform rota bloğu hazırlık kapısından geçiyor', () => {
    const bloklar = APP_TSX.match(/\{route === '[a-z0-9-]+' && currentUser\.role === 'Admin'[^(]*\(/g) ?? []
    expect(bloklar.length).toBeGreaterThanOrEqual(15)

    for(const blok of bloklar){
      expect(blok, `kapısız platform rota bloğu: ${blok}`).toContain('!platformEkraniHazirDegil')
    }

    // `SaasManagementCenter` tek blokta on rota barındırıyor; o da geçmeli.
    expect(APP_TSX).toContain('{evren360View && !platformEkraniHazirDegil && (')
    // Kayıt defterinde olmayan `evren360-packages` rotası da kapsanıyor.
    expect(APP_TSX).toContain("(platformRouteSet.has(route) || Boolean(evren360View))")
  })

  it('hazır olmayan rota, eski ekran yerine gerekçe panelini açıyor', () => {
    expect(APP_TSX).toContain('<PlatformEkranHazirDegil route={route} />')
  })

  it('panele giriş hazır bir ekranla başlıyor', () => {
    const ilk = getIlkHazirPlatformRotasi()
    expect(PLATFORM_HAZIR_ROTALAR.has(ilk)).toBe(true)
    const kayit = getPlatformRegistry().find(item => item.route === ilk)
    expect(kayit?.hidden).not.toBe(true)
  })
})

describe('EVREN360 paneli · platform sahibi kiracı menüsü görmüyor', () => {
  it('menü kapsamı yalnız platform gruplarını veriyor', () => {
    expect(APP_TSX).toContain('const scopedGroups = isPlatformAdmin\n      ? platformNavGroups')
    // Eski "iki yüzeyi birden göster" kuralı geri gelmesin.
    expect(APP_TSX).not.toContain('...createWorkspaceNavGroupsForUser(currentUser), ...platformNavGroups')
  })

  it('panel grupları yalnız EVREN360 grupları', () => {
    const anahtarlar = createPlatformNavGroups().map(group => group.key)
    expect(anahtarlar.length).toBeGreaterThanOrEqual(1)
    for(const anahtar of anahtarlar){
      expect(String(anahtar).startsWith('evren360-'), `${anahtar} EVREN360 grubu değil`).toBe(true)
    }
  })

  it('panelin her ögesi platformAdminOnly ve adminOnly', () => {
    for(const oge of createPlatformNavGroups().flatMap(group => group.items)){
      expect(oge.platformAdminOnly, `${oge.label}`).toBe(true)
      expect(oge.adminOnly, `${oge.label}`).toBe(true)
    }
  })
})

// ── Çalışan ekranların BÜTÜN zinciri temiz mi ──────────────────────────────
// Sayfanın kendisi Supabase okuyor olabilir ama üçüncü basamakta bir `.mock`
// modülüne bağlanıyorsa ekran yine uydurma veri gösterir. Karar Destek'in
// on ekranı tam böyleydi (bkz. modules/mock-rota-sizintisi.arch.test.ts).
// ⚠️ Çözülemeyen bir içe aktarma SESSİZ GEÇMEZ, patlar (tuzak 58).

const KODDISI = /\.(css|scss|sass|less|json|svg|png|jpe?g|gif|webp|woff2?|ttf|md|txt)$/

const coz = (kaynak: string, spec: string): string | null | undefined => {
  if(!spec.startsWith('.')) return null
  const temel = join(dirname(kaynak), spec)
  if(KODDISI.test(spec)) return null
  for(const aday of [
    `${temel}.ts`, `${temel}.tsx`,
    join(temel, 'index.ts'), join(temel, 'index.tsx'),
    temel
  ]){
    if(existsSync(aday) && !aday.endsWith('/')) return aday
  }
  return undefined
}

const iceAktarmalar = (icerik: string) => (
  [...icerik.matchAll(/from\s+'([^']+)'/g)].map(m => m[1] as string)
)

describe('EVREN360 paneli · çalışan ekranların zinciri temiz', () => {
  it("'veritabani' ekranlarının hiçbir basamağı mock okumuyor", () => {
    const hazir = PLATFORM_MODULE_REGISTRY.filter(item => item.veriKaynagi === 'veritabani')
    expect(hazir.length).toBeGreaterThanOrEqual(1)

    let gezilen = 0
    for(const item of hazir){
      const bas = join(SRC, item.kaynakDosya)
      const gorulen = new Set<string>()
      const kuyruk = [bas]

      while(kuyruk.length){
        const dosya = kuyruk.pop() as string
        if(gorulen.has(dosya)) continue
        gorulen.add(dosya)
        gezilen += 1

        const icerik = readFileSync(dosya, 'utf8') as string
        expect(
          /from '[^']*\.mock(-repository)?'/.test(icerik),
          `${item.name} zincirinde mock: ${dosya}`
        ).toBe(false)
        expect(
          /from '\.\.?\/storage'/.test(icerik),
          `${item.name} zincirinde localStorage deposu: ${dosya}`
        ).toBe(false)

        for(const spec of iceAktarmalar(icerik)){
          const hedef = coz(dosya, spec)
          // null → paket ya da kod değil; undefined → ÇÖZÜLEMEDİ
          expect(hedef, `${dosya} içindeki '${spec}' çözülemedi`).not.toBeUndefined()
          if(hedef) kuyruk.push(hedef)
        }
      }
    }

    // Sağlama: zincir gerçekten yürüdü mü?
    expect(gezilen).toBeGreaterThanOrEqual(hazir.length * 2)
  })
})
