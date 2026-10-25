// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — PUBLIC YOL YÜZEYİ ve PROFİL → KABUK ZİNCİRİ
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────
// İki kusuru donduruyor. İkisi de "kapı var ama o kapıdan geçmeyen bir yol
// da var" ailesinden.
//
// MIYOP-067 · `App.tsx` içinde `/qr/<id>` yolunu yakalayıp `QRMenu`
// ekranını DOĞRUDAN döndüren bir dal vardı. `business-qr-menu` modülü
// `foundationScope: 'frozen'` olmasına rağmen sayfa açılıyordu, çünkü
// donmuş rota kapısı `BusinessWorkspaceRouteHost`ta ve bu dönüş o kapının
// DIŞINDAYDI. Üstelik ekran "Görevli çağrınız iletildi" diyordu; yazım
// yalnız `localStorage`a gidiyordu.
//
// MIYOP-066 · `UserProfile` kaydettikten sonra `onProfileChange` çağırıyor,
// ama `BusinessWorkspaceRouteHost` bu prop'u GEÇİRMİYORDU. Veritabanı ve
// ekran yeni adı gösteriyor, yan menü ile kilit ekranı ESKİ adı
// gösteriyordu. Zincirin üç halkası doğru, dördüncüsü yok (tuzak 103).
//
// ── NE ÖLÇÜYOR ───────────────────────────────────────────────────────────
// ⚠️ "QRMenu import edilmesin" diye yazmıyorum — o, tek bir örneği
// kovalamak olurdu. Ölçtüğüm şey YÜZEY: `App.tsx` içinde kaç tane public
// yol eşleşmesi var ve hepsi BİLİNEREK mi açık (tuzak 90).
// Yeni bir public yol eklemek serbest; sessizce eklemek değil.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'

const SRC = join(projeKokunuBul(), 'src')
const oku = (yol: string) => readFileSync(join(SRC, yol), 'utf8') as string

const APP = oku('App.tsx')
const HOST = oku('modules/BusinessWorkspaceRouteHost.tsx')
const PROFIL = oku('pages/UserProfile.tsx')

/**
 * Giriş yapmadan ulaşılabilen yollar. ⚠️ Her satır bir KARAR:
 * · başvuru formu — dışarıdan başvuran işletmenin doldurduğu form
 * · müşteri portalı — kiracının kendi sitesine gömdüğü sipariş bağlantısı
 * Bu listeye bir şey eklemek, "oturumsuz biri bunu görebilir" demektir.
 */
const BILINEN_PUBLIC_YOLLAR = [
  '/^\\/(?:basvuru|apply)\\/?$/',
  '/^\\/(?:portal|siparis)\\/?$/'
]

describe('public yol yüzeyi · App.tsx', () => {
  const eslesmeler = [...APP.matchAll(/window\.location\.pathname\.match\((\/[^\n]*?\/)\)/g)]
    .map(m => m[1] as string)

  it('sağlama: ölçüm gerçekten bir şey buldu', () => {
    // ⚠️ "Hiç yol bulamadım" deyip yeşil geçmek EN KÖTÜ sonuç (tuzak 58).
    expect(eslesmeler.length).toBeGreaterThan(0)
  })

  it('her public yol BİLİNEN listede', () => {
    for(const desen of eslesmeler){
      expect(
        BILINEN_PUBLIC_YOLLAR,
        `Yeni bir public yol eklenmiş: ${desen}\n`
        + 'Oturumsuz biri bu yolu açabilir. Bilinçliyse listeye ekleyin ve '
        + 'neden açık olduğunu yazın; değilse yolu kaldırın.'
      ).toContain(desen)
    }
  })

  it('donmuş QR yolu geri gelmemiş (MIYOP-067)', () => {
    expect(APP).not.toMatch(/pathname\.match\(\/\^\\\/qr/)
    expect(APP, 'QRMenu yeniden App.tsx\'e bağlanmış').not.toMatch(/<QRMenu/)
  })
})

describe('profil değişikliği kabuğa taşınıyor (MIYOP-066)', () => {
  it('UserProfile kaydettikten sonra geri çağrıyı çağırıyor', () => {
    expect(PROFIL).toMatch(/onProfileChange\?\.\(/)
  })

  it('RouteHost prop\'u UserProfile\'a GEÇİRİYOR', () => {
    // ⚠️ Kusur tam buradaydı: çağrı yazılıydı, prop geçirilmiyordu.
    expect(
      HOST,
      'BusinessWorkspaceRouteHost onProfileChange prop\'unu UserProfile\'a '
      + 'geçirmiyor — ekran veritabanına yazar, yan menü eski adı gösterir'
    ).toMatch(/<UserProfile[\s\S]{0,200}onProfileChange=\{onProfileChange\}/)
  })

  it('App RouteHost\'a geri çağrıyı veriyor', () => {
    expect(APP).toMatch(/onProfileChange=\{handleProfileChange\}/)
  })

  it('kabuğa bildirim KAYDETME akışına değil, OKUMAYA bağlı (066 kalan yarısı)', () => {
    // ⚠️ İlk onarımda bildirim yalnız `kaydet` içindeydi. Yazma başarılı
    // olup geri okuma düşerse "Tekrar dene" profili yeniliyor ama kabuğu
    // yenilemiyordu (Codex, 22.10). Artık `yukle` bildiriyor.
    expect(
      PROFIL,
      'kabuğa bildirim `yukle` içinden yapılmalı; yoksa "tekrar dene" dalı '
      + 'kabuğu eski adla bırakır'
    ).toMatch(/kabugaBildir\(gelen\)/)
    const kaydetBloku = /const kaydet = async[\s\S]*?\n  \}/.exec(PROFIL)?.[0] ?? ''
    expect(kaydetBloku, 'kaydet bloğu bulunamadı').not.toBe('')
    expect(
      kaydetBloku.includes('onProfileChange'),
      'kaydet bloğu kabuğa AYRICA bildiriyor — iki yer iki kural olur, '
      + 'bildirim tek yerde (yukle) kalmalı'
    ).toBe(false)
  })

  it('geç gelen cevap BAŞKA hesabın üstüne yazamıyor (MIYOP-068)', () => {
    // A kaydeder → cevabı gecikir → A çıkar, B girer → A'nın cevabı gelir.
    // Kimlik kapısı yoksa B'nin kabuğuna A'nın adı yazılır.
    const blok = /const handleProfileChange[\s\S]*?\n  \}, \[\]\)/.exec(APP)?.[0] ?? ''
    expect(blok, 'handleProfileChange bulunamadı').not.toBe('')
    expect(
      blok,
      'handleProfileChange kimlik karşılaştırması yapmıyor — geç gelen '
      + 'cevap başka hesabın yerel kopyasını bozabilir (MIYOP-068)'
    ).toMatch(/taze\.id\s*!==\s*onceki\.id/)
    expect(
      PROFIL,
      'UserProfile kabuğa bildirmeden önce kimliği doğrulamıyor'
    ).toMatch(/gelen\.id\s*!==\s*currentUser\.id/)
  })

  it('değişen yoksa aynı nesne dönüyor (sonsuz okuma kapısı)', () => {
    // ⚠️ Profilim her başarılı okumada kabuğa haber veriyor ve `yukle`
    // `currentUser`a bağlı. Burada her çağrıda yeni nesne üretilirse
    // okuma → haber → yeni kimlik → okuma zinciri hiç durmaz.
    const blok = /const handleProfileChange[\s\S]*?\n  \}, \[\]\)/.exec(APP)?.[0] ?? ''
    expect(
      blok,
      'handleProfileChange eşitlikte `onceki` döndürmüyor — Profilim '
      + 'ekranı sonsuz okumaya girebilir'
    ).toMatch(/onceki\.fullName === taze\.fullName[\s\S]{0,80}return onceki/)
  })

  it('kabuk güncellemesi YALNIZ ad ve telefon taşıyor', () => {
    // ⚠️ Buraya rol/izin/kiracı yazılırsa yetki yükseltmesinin arka kapısı
    // olur. Veritabanı reddeder (0012) ama arayüz de denemeyecek.
    const blok = /const handleProfileChange[\s\S]*?\n  \}, \[\]\)/.exec(APP)?.[0] ?? ''
    expect(blok, 'handleProfileChange bulunamadı').not.toBe('')
    for(const yasak of ['role', 'permissions', 'tenantId', 'companyId', 'username']){
      expect(
        new RegExp(`${yasak}\\s*:`).test(blok),
        `handleProfileChange ${yasak} alanını yazıyor — yalnız ad ve telefon taşınmalı`
      ).toBe(false)
    }
  })
})
