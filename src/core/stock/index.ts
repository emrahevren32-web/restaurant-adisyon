// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Dilim 0 / G6.6 — Uygulama seçici
//
// Ekranlar/servisler `new LocalStorageStockRepository(...)` ya da
// `new PostgresStockRepository(...)` YAZMAZ — ADR-005'in "tek nokta" kuralı
// StockRepository için de geçerli: hangi uygulamanın kullanılacağı burada,
// tek yerde kararlaştırılır. Çağıran taraf yalnızca `createStockRepository()`
// çağırır.
//
// Seçim `VITE_STOCK_REPOSITORY_MODE` ortam değişkeniyle yapılır:
//   - "local"    → LocalStorageStockRepository (varsayılan — güvenli taraf)
//   - "postgres" → PostgresStockRepository
//
// Varsayılan "local"dır: değişken tanımsızsa ya da tanınmayan bir değer
// taşıyorsa uygulama SESSİZCE postgres'e geçip RLS/JWT önkoşulu eksikken
// üretimde "sıfır satır" görmek yerine, bilinen/test edilmiş yola düşer.
//
// ⚠️ "postgres" modunun ÜRETİME AÇILMA DURUMU (2026-08-26 güncellemesi):
//
//   ✅ JWT `tenant_id` claim'i — KAPANDI. 0009 çalıştırıldı ve Supabase
//      Dashboard'da hook etkinleştirildi; `app.current_tenant_id()` artık
//      gerçek bir değer okuyor. (Bu, daha önce buraya yazılmış olan
//      "her sorguda boş sonuç döner" engeliydi.)
//   ✅ I12'nin veritabanı zorlaması — KAPANDI. 0011 tetikleyicisi negatif
//      bakiyeyi veritabanı seviyesinde reddediyor ve TOCTOU yarışını
//      advisory lock ile kapatıyor.
//   ✅ Yetki yükseltmesi — KAPANDI. 0012 tenant/app_user üzerindeki geniş
//      UPDATE yetkisini sütun seviyesine indirdi.
//   ❌ CANLI Postgres'e karşı sözleşme testi — HENÜZ YOK. `stock.contract.test.ts`
//      bugüne kadar yalnızca LocalStorage uygulamasına ve mock'lara karşı
//      koştu. G7 ile birlikte yapılacak.
//
// Son madde kapanmadan varsayılanın "local" kalması bilinçli bir tercihtir:
// "kurulu" ile "kanıtlanmış" aynı şey değildir. G6.6'nın burada var olma
// amacı, kanıt geldiğinde tek bir ortam değişkeniyle geçiş yapabilmektir.
// ═══════════════════════════════════════════════════════════════════════════

import type { StockRepository } from './stock.repository'
import { LocalStorageStockRepository } from './stock.localstorage'
import { PostgresStockRepository } from './stock.postgres'
import type { StockItemLookup } from './stock-item-lookup'
import type { TenantPolicyLookup } from './tenant-policy-lookup'
import { isSupabaseConfigured, getSupabase } from '../supabase'

export type StockRepositoryMode = 'local' | 'postgres'

const KNOWN_MODES: StockRepositoryMode[] = ['local', 'postgres']

/**
 * `VITE_STOCK_REPOSITORY_MODE`'u okur. Tanımsız/boş/tanınmayan bir değer
 * varsa "local"a düşer — bkz. dosya başı not.
 */
export function resolveStockRepositoryMode(): StockRepositoryMode {
  const raw = (import.meta.env.VITE_STOCK_REPOSITORY_MODE ?? '').trim().toLowerCase()
  return (KNOWN_MODES as string[]).includes(raw) ? (raw as StockRepositoryMode) : 'local'
}

/**
 * Aktif moda göre bir StockRepository örneği kurar.
 *
 * `localItemLookup` yalnızca "local" modda kullanılır (Postgres uygulaması
 * buna ihtiyaç duymaz — bkz. stock-item-lookup.ts'teki not, aynı kontrolü
 * veritabanı tetikleyicisi yapar). Dilim 1'de gerçek bir StockItemLookup
 * uygulaması (stok kartı deposuna bağlı) gelene kadar çağıran taraf
 * `InMemoryStockItemLookup` veya kendi sahte'sini geçebilir.
 *
 * `localTenantPolicy` da yalnızca "local" modda kullanılır — I12'nin negatif
 * bakiye politikasını (allow/warn/block) nereden okuyacağını söyler. Postgres
 * modunda politika `tenant.negative_stock_policy` sütunundan okunur ve
 * asıl zorlama veritabanı tetikleyicisindedir (0011).
 *
 * ⚠️ 2026-08-26 DÜZELTMESİ (Codex bulgusu): bu ikinci parametre önceden YOKTU.
 * Sonuç sessiz ama ciddiydi: `createStockRepository()` üzerinden kurulan her
 * local repository, `LocalStorageStockRepository`'nin varsayılanına düşüp
 * politikayı HER tenant için sabit `block` kabul ediyordu. Yani I12'nin
 * `warn` ve `allow` dalları testlerde geçiyor (testler repository'yi doğrudan
 * kuruyor) ama gerçek uygulamada ölü koddu. Verilmezse davranış eskisi gibi
 * `block`'tur — güvenli taraf değişmedi, artık sadece BAĞLANABİLİYOR.
 */
export function createStockRepository(
  localItemLookup: StockItemLookup,
  localTenantPolicy?: TenantPolicyLookup,
): StockRepository {
  const mode = resolveStockRepositoryMode()

  if (mode === 'local') {
    return new LocalStorageStockRepository(localItemLookup, localTenantPolicy)
  }

  // mode === 'postgres'
  if (!isSupabaseConfigured()) {
    throw new Error(
      'VITE_STOCK_REPOSITORY_MODE=postgres seçili ama Supabase yapılandırılmamış. '
      + '.env.local dosyasında VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlayın '
      + '(bkz. .env.example) ya da VITE_STOCK_REPOSITORY_MODE=local kullanın.',
    )
  }
  return new PostgresStockRepository(getSupabase())
}
