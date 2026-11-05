// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — EKRAN, HANGİ EKRAN OLDUĞU KONUSUNDA YALAN SÖYLEMESİN
//
// ── NEDEN VAR (01.11.2026 · tuzak 168) ───────────────────────────────────
// Emrah'ın ekran görüntüsü: üst başlık ve kırıntı yolu **"Değişiklik
// Kaydı"** diyor, altında **Firma Bilgileri formu** duruyor, yan menüde
// hâlâ "Değişiklik Kaydı" seçili.
//
// Sebep: başlık da, kırıntı yolu da, yan menü vurgusu da tek bir değerden
// (`activeNavKey`) türüyor. Profil menüsünden açılan ekranlar ise yalnız
// `route`u değiştiriyordu; `activeNavKey` BİR ÖNCEKİ ekranda kalıyordu.
//
// ⚠️ Görünürden daha kötü yanı: aynı değer `RouteErrorBoundary`ye
// `routeLabel` olarak gidiyor. Firma Profili çökseydi `client_error`
// kaydında **"ekran: Değişiklik Kaydı"** yazacaktı ve yanlış ekranı
// ayıklamaya oturacaktık. 28.10'da canlıda çöken ekranı bize bu kayıt
// buldurmuştu — kaydın doğruluğu teşhisin tamamıdır.
//
// ── NE ÖLÇÜYOR ───────────────────────────────────────────────────────────
// Tek tek ekran saymıyor; ZİNCİRİ donduruyor:
//   1. menüsüz her rotanın bir adı VAR,
//   2. o adlar menüdeki hiçbir rotayı EZMİYOR,
//   3. `App.tsx` adı önce bu haritadan soruyor,
//   4. profil menüsü bağlantıları `activeNavKey`e de DOKUNUYOR.
// Dördü de tutmazsa başlık yeniden yalan söyleyebilir.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'
import {
  MENUSUZ_ROTA_ETIKETLERI,
  NON_NAV_CORE_ROUTES,
  getBusinessWorkspaceModules
} from '../modules/business-workspace.registry'

const KOK = projeKokunuBul()
const APP = readFileSync(join(KOK, 'src/App.tsx'), 'utf8') as string

/**
 * Yorumları atar — satır içi (iki eğik çizgi) ve blok yorumlar.
 *
 * ⚠️ MIYOP-098 (Codex, 04.11) · NEDEN ZORUNLU. Aşağıdaki iddialar düz
 * metne bakıyordu. `setActiveNavKey(hedef)` satırının başına `//` koymak
 * yedi sınamanın yedisini de YEŞİL bırakıyordu: regex yoruma alınmış
 * satırı da görüyordu. Yani MIYOP-091 için konulan bekçi, satır silinince
 * uyarıyor ama satır **susturulunca** susuyordu.
 * ÖLÇÜLDÜ (05.11): satır yoruma alındığında ham metinde yakalanmıyor,
 * soyulmuş metinde yakalanıyor. Negatif denetim aşağıda ayrı bir sınama.
 *
 * ⚠️ `https://` gibi dizgeler bozulmasın diye `//` yalnız iki nokta
 * üst üste gelmiyorsa atılıyor.
 */
export const yorumsuzKod = (metin: string): string => metin
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map(satir => satir.replace(/(^|[^:])\/\/.*$/, '$1'))
  .join('\n')

const KOD = yorumsuzKod(APP)

/** `menusuzRotaAc` yardımcısının gövdesi (yorumsuz metinden). */
const yardimciGovdesi = (kaynak: string): string => {
  const bas = kaynak.indexOf('const menusuzRotaAc = ')
  if(bas < 0) return ''
  return kaynak.slice(bas, kaynak.indexOf('\n  }', bas))
}

type Oge = { key: string; route?: string; foundationScope?: string; children?: Oge[] }

/**
 * Menüde GERÇEKTEN görünen ögeler.
 *
 * ⚠️ `getCoreWorkspaceRoutes()` BU İŞ İÇİN KULLANILMAZ ve bu satır bir
 * hatanın bedeli (01.11, tuzak 168b): o fonksiyon adının çağrıştırdığı
 * şeyi değil, "açık olmasına İZİN VERİLEN rotalar"ı döndürüyor ve
 * sonuna `NON_NAV_CORE_ROUTES`u da ekliyor. Onunla ölçünce menüsüz
 * rotaların hepsi "menüde var" çıkıyordu — yani sınama, ölçmek istediği
 * şeyin tam tersini ölçüyordu. Menü yüzeyi menü ögelerinden okunur.
 *
 * Donmuş ögeler atlanıyor: modül görünür olsa bile donmuş bir öge menüye
 * çizilmiyor (`getCoreWorkspaceRoutes` içindeki `walk` da böyle yapıyor).
 */
const menuOgeleri = (): Oge[] => {
  const hepsi: Oge[] = []
  const gez = (items: Oge[]) => {
    items.forEach(item => {
      if(item.foundationScope === 'frozen') return
      hepsi.push(item)
      if(item.children) gez(item.children)
    })
  }
  getBusinessWorkspaceModules().forEach(modul => gez(modul.menuItems as unknown as Oge[]))
  return hepsi
}

describe('Menüsüz rotaların ekran adı', () => {
  it('menüde olmayan HER rotanın bir adı var', () => {
    const adsiz = NON_NAV_CORE_ROUTES.filter(rota => !MENUSUZ_ROTA_ETIKETLERI[rota])
    expect(
      adsiz,
      'Menüde yer almayan bir rota eklendi ama ekran adı yazılmadı. Adsız '
      + 'kalırsa başlık bir ÖNCEKİ ekranın adını gösterir (tuzak 168).'
    ).toEqual([])
  })

  it('adların hiçbiri boş değil', () => {
    Object.entries(MENUSUZ_ROTA_ETIKETLERI).forEach(([rota, ad]) => {
      expect(ad.trim().length, `${rota} için ekran adı boş`).toBeGreaterThan(0)
    })
  })

  it('⚠️ bu adlar MENÜDEKİ bir rotayı ezmiyor', () => {
    // Harita `App.tsx`te menü aramasından ÖNCE sorulduğu için, menüdeki bir
    // rotanın buraya girmesi o menü ögesinin kendi etiketini susturur.
    const menuRotalari = new Set(
      menuOgeleri().map(oge => oge.route).filter((r): r is string => Boolean(r))
    )
    const cakisan = Object.keys(MENUSUZ_ROTA_ETIKETLERI)
      .filter(rota => menuRotalari.has(rota))
    expect(
      cakisan,
      'Bu rotaların menüde bir ögesi var; adı menü ögesinden gelmeli.'
    ).toEqual([])
  })

  it('App.tsx ekran adını ÖNCE menüsüz haritadan soruyor', () => {
    expect(
      KOD,
      'activeNavLabel menüsüz haritayı sormuyorsa profil ekranlarının '
      + 'başlığı yine bir önceki ekranın adı olur.'
    ).toMatch(/const activeNavLabel = MENUSUZ_ROTA_ETIKETLERI\[route\]/)
  })

  it('⚠️ profil menüsü bağlantıları activeNavKey\'e de dokunuyor', () => {
    // Çıplak `setRoute('company-profile')` yan menüdeki vurguyu eski ekranda
    // bırakıyordu. Bu iki kalıbın GERİ GELMEMESİ ölçülüyor.
    expect(KOD).not.toMatch(/\(\)\s*=>\s*setRoute\('company-profile'\)/)
    expect(KOD).not.toMatch(/\(\)\s*=>\s*setRoute\('my-profile'\)/)
    expect(KOD, 'menusuzRotaAc yardımcısı yok').toMatch(/const menusuzRotaAc = /)
    expect(KOD).toMatch(/menusuzRotaAc\('company-profile'\)/)
    expect(KOD).toMatch(/menusuzRotaAc\('my-profile'\)/)
  })

  it('⚠️ yardımcının GÖVDESİ iki durumu da değiştiriyor', () => {
    // ⚠️ MIYOP-091 · Codex ölçtü: üstteki sınama yardımcının ADINI ve
    // ÇAĞRILARINI arıyordu, GÖVDESİNİ değil. `setActiveNavKey(hedef)`
    // satırı silindiğinde altı sınamanın altısı da yeşil kalıyordu —
    // yani bekçi, koruduğunu sandığı satırı hiç görmüyordu.
    // (Tuzak 168b'nin kardeşi: ölçüm aracının kendisi ölçülmemişti.)
    // ⚠️ MIYOP-098: gövde YORUMSUZ metinden alınıyor. Ham metinde
    // `// setActiveNavKey(hedef)` de bu iddiayı geçiriyordu.
    const govde = yardimciGovdesi(KOD)
    expect(govde, 'menusuzRotaAc bulunamadı').not.toEqual('')
    expect(govde, 'yardımcı rotayı değiştirmiyor').toMatch(/setRoute\(hedef\)/)
    expect(
      govde,
      'yardımcı nav anahtarını değiştirmiyor: yan menüde ESKİ ekran seçili '
      + 'kalır ve başlık yine yalan söyler (MIYOP-091).'
    ).toMatch(/setActiveNavKey\(hedef\)/)
  })

  it('⚠️ MIYOP-098 · satır YORUMA ALINSA bekçi uyanıyor (negatif denetim)', () => {
    // Bekçinin ölçtüğünü kanıtlayan sınama. `App.tsx`in gerçek metninde
    // satır yoruma alınır ve iddianın KIRILDIĞI gösterilir.
    const bozuk = APP.replace('    setActiveNavKey(hedef)', '    // setActiveNavKey(hedef)')
    expect(bozuk, 'satır bulunamadı — negatif denetim anlamsız').not.toEqual(APP)

    // ham metin: yoruma alınmış satırı GÖRÜYOR (eski kusur)
    expect(yardimciGovdesi(bozuk)).toMatch(/setActiveNavKey\(hedef\)/)
    // yorumsuz metin: GÖRMÜYOR, yani bekçi artık uyarır
    expect(yardimciGovdesi(yorumsuzKod(bozuk))).not.toMatch(/setActiveNavKey\(hedef\)/)
  })

  it('yorum soyma gerçekten iş yapıyor ve kodu silmiyor (sağlama)', () => {
    expect(APP.length).toBeGreaterThan(KOD.length)
    expect(KOD).toContain('const menusuzRotaAc = ')
    expect(KOD).toContain('setActiveNavKey')
    // `https://` türü dizgeler soyulmadı
    if(APP.includes('https://')) expect(KOD).toContain('https://')
  })

  it('⚠️ menüsüz anahtar hiçbir menü ögesiyle çakışmıyor', () => {
    // `menusuzRotaAc` nav anahtarını rotanın kendisi yapıyor; aynı anahtara
    // sahip bir menü ögesi olsaydı vurgu kalkmaz, yanlış öge seçili kalırdı.
    const anahtarlar = new Set(menuOgeleri().map(oge => oge.key))
    const cakisan = Object.keys(MENUSUZ_ROTA_ETIKETLERI).filter(rota => anahtarlar.has(rota))
    expect(cakisan, 'Menüde aynı anahtarla bir öge var').toEqual([])
  })
})
