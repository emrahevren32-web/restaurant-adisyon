// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 / Güven katmanı — Kiracı verisinin dışa aktarılması
//
// Yol haritası maddeleri:
//   "Tenant dışa aktarma"   → İşletme kendi verisini tek dosyada alabiliyor
//   "Otomatik günlük yedek" → Bu dosyanın kendisi yedeğin ta kendisi
//
// ── NEDEN KENDİ DIŞA AKTARMAMIZI YAZIYORUZ ───────────────────────────────
// Supabase'in ÜCRETSİZ planında otomatik yedek YOKTUR (2026-09 itibarıyla
// doğrulandı; Supabase'in kendi belgesi ücretsiz projelere "düzenli olarak
// `db dump` alın" diyor). Günlük yedek Pro planla geliyor, PITR ayrı bir ek.
//
// Ama asıl sebep plan değil: A5'te Hetzner'e taşınıyoruz (ADR-006). Orada
// Supabase'in yedek düğmesi diye bir şey OLMAYACAK. Yedeği kendimiz
// alabiliyor olmalıyız — yoksa taşınmanın ilk günü yedeksiz kalırız.
//
// ── BU DOSYA YEDEĞİN TAMAMI DEĞİLDİR ─────────────────────────────────────
// Dürüst olalım: bu, KİRACININ İŞ VERİSİNİ çıkarır. Veritabanının kendisini
// (şema, tetikleyiciler, RLS politikaları, Auth hesapları) çıkarmaz. Onun
// yolu `pg_dump`'tır ve `docs/YEDEKLEME.md`'de anlatılıyor.
//
// İkisi farklı soruların cevabı:
//   Bu dosya   → "Müşteri verisini istedi" · "Kiracıyı başka kuruluma taşı"
//   pg_dump    → "Sunucu yandı, her şeyi geri kur"
//
// Birini ötekinin yerine koymak, yedeği olduğunu sanıp olmamak demektir.
//
// ── NEDEN SAYFA SAYFA OKUNUYOR ───────────────────────────────────────────
// PostgREST tek sorguda varsayılan olarak 1000 satır döner. Bir fabrikanın
// stok defteri kısa sürede bunu aşar. Sayfalamasaydık dışa aktarma SESSİZCE
// eksik dosya üretirdi — yedek diye saklanan ama içinde verinin olmadığı bir
// dosyadan daha kötüsü yoktur.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'

/**
 * Dışa aktarılan tablolar.
 *
 * Sıra ÖNEMLİ: üst kayıtlar önce. Geri yüklemede yabancı anahtarlar bu
 * sırayla sağlanır (önce stok kalemi, sonra lot, sonra hareket).
 *
 * ── Listede OLMAYANLAR ve neden ──────────────────────────────────────────
 *   uom, uom_conversion, permission, role, role_permission
 *     → Kiracıya ait değil, ÜRÜNÜN kendi referans verisi. Göçlerle gelir.
 *       Yedeğe koymak, geri yüklerken ürünün güncel tanımlarını eski
 *       hâline döndürme riski yaratır.
 *   auth.users
 *     → Supabase Auth'un kendi şeması; buradan okunamaz ve okunmamalı.
 *       Parola özetleri iş verisi değildir.
 */
export const DISA_AKTARILAN_TABLOLAR = [
  // Kimlik ve yapı
  'tenant', 'company', 'branch', 'app_user', 'user_role', 'user_branch_access',
  // Stok çekirdeği
  'stock_item', 'stock_lot', 'stock_movement',
  // Satın alma
  'supplier',
  'purchase_request', 'purchase_request_line',
  'purchase_order', 'purchase_order_line',
  'goods_receipt', 'goods_receipt_line',
  'supplier_return', 'supplier_return_line',
  // Üretim
  'recipe', 'recipe_line', 'work_order', 'work_order_line', 'lot_genealogy',
  // Sevkiyat
  'shipment', 'shipment_line',
  // Kalite
  'haccp_plan', 'haccp_ccp', 'haccp_measurement', 'haccp_corrective_action',
  // Sayım
  'stock_count', 'stock_count_line',
  // Denetim
  'audit_log',
] as const

export type DisaAktarilanTablo = (typeof DISA_AKTARILAN_TABLOLAR)[number]

/**
 * Kiracıya ait olduğu hâlde yedeğe BİLEREK alınmayan tablolar.
 *
 * Bu liste bir muafiyet değil, bir GEREKÇE listesidir. `tenant-export.arch.test.ts`
 * her `tenant_id` taşıyan tablonun ya yukarıdaki listede ya burada olmasını
 * zorunlu kılar. Yeni bir kiracı tablosu eklenip ikisine de yazılmazsa test
 * kırmızıya döner.
 *
 * Bu koruma olmadan neye çarptığımız: satın alma talepleri ve siparişleri
 * yedeğe giriyordu ama KALEMLERİ girmiyordu. Yedek dosyası "eksiksiz"
 * damgası alıyordu, çünkü kendi listesine göre eksiksizdi. Listenin kendisi
 * eksikti ve bunu hiçbir şey söylemiyordu. `user_branch_access` de yoktu —
 * geri yüklenince kullanıcılar şube yetkilerini kaybederdi.
 */
export const YEDEK_DISI_TABLOLAR: Record<string, string> = {
  client_error:
    'Teknik hata kaydı, işletme verisi değil. Müşteriye okuma yetkisi de yok ' +
    '(0030): yığın izi müşteri ekranına ait değil, yedeğine de ait değil.',
  tenant_backup_log:
    'Yedek alma geçmişi, KURULUMA ait bir üstveri. Başka bir kuruluma ' +
    'taşınırken eski kurulumun yedek geçmişi anlam taşımaz.',
  tenant_license:
    'Lisans, işletmenin verisi değil MİYOP ile arasındaki TİCARİ ilişkidir ' +
    '(0042). Eski bir yedekten geri yüklenmesi, süresi dolmuş ya da ' +
    'değiştirilmiş bir lisansı geri getirirdi. Müşteriye yazma yetkisi de ' +
    'yok; kendi dosyasından kendi lisansını taşıyabilmesi doğru olmazdı.',
  license_event:
    'Lisansın hayat defteri (0043): ne zaman açıldı, kim uzattı, ücretli mi ' +
    'ücretsiz mi. Bu MİYOP ile aradaki TİCARİ geçmiştir, işletmenin iş ' +
    'verisi değil. Eski bir yedekten geri yüklenmesi, bugünkü ticari ' +
    'gerçekle çelişen bir geçmiş yaratırdı.',
  license_extension_request:
    'Lisans süre talebi, MİYOP ile aradaki ticari yazışmadır (0042); ' +
    'işletmenin iş verisi değil.',
  business_application:
    'Başvuru PLATFORMA ait, işletmeye değil (0032). İçindeki tenant_id bir ' +
    'SAHİPLİK kolonu değil, SONUÇ BAĞI: başvurunun hangi işletmeye ' +
    'dönüştüğünü gösterir. Bir işletmenin veri dosyasında, o işletmeyi ' +
    'değerlendirirken MİYOP personelinin yazdığı karar notlarının bulunması ' +
    'yanlış olurdu.',
}

export type TabloSonucu = {
  tablo: string
  /** Okunan satır sayısı. */
  satir: number
  /** Tablo bu kurulumda yoksa ya da okunamadıysa sebebi. */
  atlandi?: string
}

export type DisaAktarmaKunyesi = {
  /** Dosyanın ne olduğu — açan kişi tahmin etmek zorunda kalmasın. */
  aciklama: string
  bicimSurumu: number
  olusturmaZamani: string
  kiracıId: string
  subeId?: string
  tablolar: TabloSonucu[]
  toplamSatir: number
  /** Eksik kalan tablo varsa dosya EKSİKTİR; künyede açıkça yazar. */
  eksikTablolar: string[]
  uyari?: string
}

export type DisaAktarmaSonucu = {
  kunye: DisaAktarmaKunyesi
  veri: Record<string, unknown[]>
}

/** PostgREST'in tek seferde döndürdüğü en fazla satır. */
const SAYFA = 1000

/** Tablo yok hatası — kurulumlar arasında tablo farkı olabilir. */
const TABLO_YOK = new Set(['42P01', 'PGRST205'])

export type IlerlemeBildirimi = (tablo: string, sira: number, toplam: number) => void

/**
 * Bir kiracının iş verisini okur.
 *
 * ⚠️ Kiracı süzmesi YOK — RLS'in işi (ADR-004). Oturum hangi kiracıya aitse
 * yalnızca onun satırları döner. Buraya `eq('tenant_id', …)` yazsaydık RLS
 * kapalı olsa bile dosya doğru görünür, açık fark edilmezdi. Dahası: bu
 * dışa aktarma, RLS'in çalıştığının canlı bir SINAMASIDIR — başka kiracının
 * satırı dosyaya düşerse izolasyon delinmiş demektir.
 */
export const kiraciyiDisaAktar = async (
  client: SupabaseClient,
  ctx: TenantCtx,
  ilerleme?: IlerlemeBildirimi,
): Promise<DisaAktarmaSonucu> => {
  const veri: Record<string, unknown[]> = {}
  const tablolar: TabloSonucu[] = []
  const eksik: string[] = []

  for(const [i, tablo] of DISA_AKTARILAN_TABLOLAR.entries()){
    ilerleme?.(tablo, i + 1, DISA_AKTARILAN_TABLOLAR.length)

    const satirlar: unknown[] = []
    let basla = 0
    let atlandi: string | undefined

    // Sayfa sayfa: 1000'lik dilimler, dönen dilim 1000'den azalınca biter.
    for(;;){
      const { data, error } = await client
        .from(tablo)
        .select('*')
        .range(basla, basla + SAYFA - 1)

      if(error){
        if(TABLO_YOK.has(error.code ?? '')){
          atlandi = 'Bu kurulumda tablo yok'
        } else {
          // Okunamayan tablo SESSİZCE geçilmez: künyeye yazılır ve dosya
          // "eksik" damgası alır.
          atlandi = error.message
          eksik.push(tablo)
        }
        break
      }

      const dilim = (data as unknown[] | null) ?? []
      satirlar.push(...dilim)
      if(dilim.length < SAYFA) break
      basla += SAYFA
    }

    if(!atlandi) veri[tablo] = satirlar
    tablolar.push({ tablo, satir: atlandi ? 0 : satirlar.length, atlandi })
  }

  const toplam = tablolar.reduce((acc, t) => acc + t.satir, 0)

  return {
    kunye: {
      aciklama:
        'MİYOP kiracı veri dışa aktarımı. İŞ VERİSİDİR; veritabanı şeması, '
        + 'tetikleyiciler, RLS politikaları ve Auth hesapları BU DOSYADA YOKTUR. '
        + 'Tam sunucu yedeği için pg_dump kullanın (docs/YEDEKLEME.md).',
      bicimSurumu: 1,
      olusturmaZamani: new Date().toISOString(),
      kiracıId: ctx.tenantId,
      subeId: ctx.branchId,
      tablolar,
      toplamSatir: toplam,
      eksikTablolar: eksik,
      uyari: eksik.length > 0
        ? `${eksik.length} tablo okunamadı. BU DOSYA EKSİKTİR, yedek olarak kullanmayın.`
        : undefined,
    },
    veri,
  }
}

/** Dosya adı — tarih ve saat içerir ki üst üste yazmasın. */
export const dosyaAdi = (kiracıId: string, zaman: Date = new Date()): string => {
  const t = zaman.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `miyop-yedek-${kiracıId.slice(0, 8)}-${t}.json`
}

/**
 * Kabaca dosya boyutu (bayt). Kullanıcıya indirmeden önce söylenir:
 * 200 MB'lık bir dosyayı beklemeden başlatmak hoş değil.
 */
export const boyutOku = (metin: string): string => {
  const bayt = new Blob([metin]).size
  if(bayt < 1024) return `${bayt} B`
  if(bayt < 1024 * 1024) return `${(bayt / 1024).toFixed(1)} KB`
  return `${(bayt / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Künyenin insan okuyabilir özeti — dosyanın yanında ekranda gösterilir.
 * Kullanıcı "ne aldım" sorusunu dosyayı açmadan cevaplayabilmeli.
 */
export const kunyeOzeti = (kunye: DisaAktarmaKunyesi): string[] => {
  const dolu = kunye.tablolar.filter(t => t.satir > 0)
  const bos = kunye.tablolar.filter(t => t.satir === 0 && !t.atlandi)
  const yok = kunye.tablolar.filter(t => t.atlandi)
  return [
    `${kunye.toplamSatir} satır · ${dolu.length} dolu tablo`,
    `${bos.length} tablo boş`,
    yok.length > 0 ? `${yok.length} tablo atlandı` : '',
  ].filter(Boolean)
}
