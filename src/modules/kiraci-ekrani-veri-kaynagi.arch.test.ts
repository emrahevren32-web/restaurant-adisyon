// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — AÇIK KİRACI EKRANI TARAYICIYA KAYDETMEZ
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────
// `mock-rota-sizintisi.arch.test.ts` `*.mock.ts` dosyalarını arıyor. Ama
// ikinci bir uydurma kaynak daha var ve o testin kör noktası: `storage.ts`.
// O dosya `localStorage` okur/yazar. Bir ekran oraya KAYDEDERSE kullanıcı
// "Kaydet"e basar, ekran "kaydedildi" der, veri tarayıcıda kalır — başka
// cihazdan girince yoktur, sunucuda hiç olmamıştır.
//
// 16.10.2026'da ölçüldüğünde AÇIK yirmi beş kiracı rotasının altısı böyleydi:
// Firma Profili, Profilim, İşletme Ayarları, Şubeler, Şube Yetkileri ve
// Karşılama ekranı. İkisi (Firma Profili, Profilim) kullanıcının GİRDİĞİ
// veriyi tarayıcıya yazıyor.
//
// ── BU TEST BİR CIRCIR (ratchet) ─────────────────────────────────────────
// Listeyi SIFIRLAMIYOR, DONDURUYOR. Kural:
//   · listedeki bir ekran düzeltilirse test "listeden çıkar" diyerek kırılır
//   · listede olmayan YENİ bir ekran storage'a bağlanırsa test kırılır
// Yani sayı yalnız AŞAĞI gidebilir. Düzelttikçe liste kısalır.
//
// ⚠️ EN KÖTÜ SONUÇ "HİÇ ROTA BULAMADIM" DEYİP YEŞİL GEÇMEKTİR (tuzak 58).
// Yirmi beş rotanın HEPSİ bir dosyaya eşlenmek zorunda; eşlenmezse patlar.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'
import { getCoreWorkspaceRoutes } from './business-workspace.registry'

const KOK = projeKokunuBul()
const SRC = join(KOK, 'src')
const HOST_HAM = readFileSync(join(SRC, 'modules/BusinessWorkspaceRouteHost.tsx'), 'utf8') as string

/**
 * ⚠️ Yorumlar ÇIKARILIYOR. Rota bloklarının arasında uzun gerekçe yorumları
 * var ve bir tanesi `pages/DailySummary.tsx` gibi dosya adları içeriyor.
 * Yorumlu metinde arama yapmak yanlış bileşeni bulmaya ya da hiç bulamamaya
 * yol açıyor — nitekim `summary` rotası ilk yazımda tam bundan eşleşmedi.
 */
const HOST = HOST_HAM
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')

/**
 * `storage.ts`e DAYANAN ortak servisler. Ekran doğrudan `../storage`
 * yazmasa da bunlardan birini çağırıyorsa veri yine tarayıcıya gidiyor.
 * Liste elle tutuluyor çünkü sayısı az ve her biri bilinçli bir borç.
 */
const DEPO_SERVISLERI = [
  'companies/branch-directory.service'
]

/**
 * ⚠️ DÜZELTİLDİKÇE BU LİSTEDEN SİLİN. Eklemeyin.
 * Her satır: açık bir rota ve o rotanın tarayıcıya bağlı ekranı.
 */
const BILINEN_BORC: Record<string, string> = {
  'company-profile':    'pages/CompanyProfile.tsx',
  'my-profile':         'pages/UserProfile.tsx',
  'settings':           'pages/Settings.tsx',
  'branches':           'pages/BranchManagement.tsx',
  'branch-permissions': 'pages/BranchPermissions.tsx',
  'workspace-welcome':  'pages/WorkspaceWelcome.tsx'
}

/** Rota barındırıcıdaki `import`ları ad → yol olarak çıkarır. */
const iceAktarmaHaritasi = (() => {
  const harita = new Map<string, string>()
  const duz = /import\s+(?:\{[^}]*\}|([A-Za-z0-9_]+))[^'\n]*from\s+'([^']+)'/g
  for(const m of HOST_HAM.matchAll(duz)){
    if(m[1]) harita.set(m[1], m[2] as string)
  }
  const tembel = /const\s+([A-Za-z0-9_]+)\s*=\s*React\.lazy\(\s*\(\)\s*=>\s*import\('([^']+)'\)/g
  for(const m of HOST_HAM.matchAll(tembel)){
    harita.set(m[1] as string, m[2] as string)
  }
  return harita
})()

/** `kpi-dashboard` bir çerçevenin içinden açılıyor; hedefi elle yazılı. */
const CERCEVE_HEDEFI: Record<string, string> = {
  'kpi-dashboard': 'pages/Analiz.tsx'
}

const rotaDosyasi = (rota: string): string | undefined => {
  if(CERCEVE_HEDEFI[rota]) return CERCEVE_HEDEFI[rota]

  const yer = HOST.indexOf(`route === '${rota}'`)
  if(yer < 0) return undefined

  const bilesen = /<([A-Z][A-Za-z0-9_]*)/.exec(HOST.slice(yer, yer + 600))?.[1]
  if(!bilesen) return undefined

  const yol = iceAktarmaHaritasi.get(bilesen)
  if(!yol) return undefined

  return `${yol.replace(/^\.\.\//, '')}.tsx`
}

const tarayiciyaBagli = (gorecelidosya: string) => {
  const tam = join(SRC, gorecelidosya)
  if(!existsSync(tam)) return undefined
  const icerik = readFileSync(tam, 'utf8') as string

  if(/from '\.\.?\/storage'/.test(icerik)) return 'doğrudan ../storage'
  for(const servis of DEPO_SERVISLERI){
    const ad = servis.split('/').pop() as string
    if(new RegExp(`from '[^']*${ad}'`).test(icerik)) return `${servis} üzerinden`
  }
  return ''
}

describe('açık kiracı rotaları · tarayıcı deposu çıcırı', () => {
  const rotalar = [...getCoreWorkspaceRoutes()].sort()

  it('sağlama: açık rota sayısı makul', () => {
    expect(rotalar.length).toBeGreaterThanOrEqual(20)
  })

  it('her açık rota bir ekran dosyasına eşleniyor', () => {
    for(const rota of rotalar){
      const dosya = rotaDosyasi(rota)
      expect(dosya, `${rota} bir ekrana eşlenemedi`).toBeTruthy()
      expect(
        existsSync(join(SRC, dosya as string)),
        `${rota} → ${dosya} diskte yok`
      ).toBe(true)
    }
  })

  it('listedeki her ekran GERÇEKTEN tarayıcıya bağlı (liste bayatlamasın)', () => {
    for(const [rota, dosya] of Object.entries(BILINEN_BORC)){
      expect(rotalar, `${rota} artık açık bir rota değil — listeden çıkarın`).toContain(rota)
      expect(rotaDosyasi(rota), `${rota} eşlemesi değişmiş`).toBe(dosya)
      const sebep = tarayiciyaBagli(dosya)
      expect(
        sebep,
        `${dosya} artık tarayıcıya bağlı DEĞİL — düzeltilmiş, BILINEN_BORC listesinden silin`
      ).toBeTruthy()
    }
  })

  it('listede olmayan hiçbir açık ekran tarayıcıya bağlanmıyor', () => {
    const yeniler: string[] = []
    for(const rota of rotalar){
      if(BILINEN_BORC[rota]) continue
      const dosya = rotaDosyasi(rota) as string
      const sebep = tarayiciyaBagli(dosya)
      if(sebep) yeniler.push(`${rota} → ${dosya} (${sebep})`)
    }
    expect(
      yeniler,
      `Yeni ekran tarayıcıya bağlandı. Bu veri sunucuya GİTMEZ:\n${yeniler.join('\n')}`
    ).toEqual([])
  })

  it('borç yalnız AZALABİLİR', () => {
    // Bugünkü sayı 6. Bu sayı büyürse biri listeye ekleme yapmış demektir.
    expect(Object.keys(BILINEN_BORC).length).toBeLessThanOrEqual(6)
  })
})
