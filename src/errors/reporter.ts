// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 — Uygulamanın tek hata bildiricisi
//
// Neden tek (singleton): susturma hafızası paylaşılmalı. İki ayrı bildirici
// olsa, aynı hata ikisinden de birer kez yazılırdı ve "aynı hata bir kez"
// kuralı sessizce bozulurdu.
//
// Neden tembel kurulum: Supabase ayarı uygulama açılışında okunuyor. Modül
// yüklenirken istemciyi istemek, ayar gelmeden çağırmak olurdu.
// ═══════════════════════════════════════════════════════════════════════════

import {
  BellekHataDefteri, HataBildirici, type HataDefteri,
} from './error-report'
import { PostgresHataDefteri } from './error-report.repository'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'

let bildirici: HataBildirici | null = null

/**
 * Uygulamanın hata bildiricisi.
 *
 * Supabase ayarlı değilse bellekte tutan deftere düşer. Bu, "bir şey
 * yapıyormuş gibi" değil bilinçli bir seçim: ayar yoksa yazacak bir yer de
 * yok, ama konsol yine çalışıyor ve uygulama bildirim çağrılarında çökmüyor.
 */
export const hataBildirici = (): HataBildirici => {
  if(bildirici) return bildirici
  let defter: HataDefteri
  try {
    defter = isSupabaseConfigured()
      ? new PostgresHataDefteri(getSupabase())
      : new BellekHataDefteri()
  } catch {
    // Kural 1: bildiriciyi KURARKEN bile çökmeyiz.
    defter = new BellekHataDefteri()
  }
  bildirici = new HataBildirici(defter, {
    konsol: (mesaj, ayrinti) => console.error(mesaj, ayrinti ?? ''),
  })
  return bildirici
}

/** Testler için. Üretimde çağrılmaz. */
export const bildiriciyiDegistir = (yeni: HataBildirici | null): void => {
  bildirici = yeni
}

/** Şu anki ekranın adresi. Hash yönlendirme kullanılıyor. */
export const suAnkiYol = (pencere: Window): string =>
  `${pencere.location.pathname}${pencere.location.hash}`

/**
 * Kimsenin yakalamadığı hataları bildirir.
 *
 * İki olay var ve ikisi de gerekli:
 *   `error`              → senkron kod fırlattı, kimse tutmadı
 *   `unhandledrejection` → bir Promise reddedildi, kimse `catch` yazmadı
 *
 * İkincisi daha sinsi: hiçbir şey görünmez, ekran öyle kalır. Bu uygulamada
 * veri okumaların hepsi Promise; `catch`'i unutulan bir tanesi kullanıcıya
 * boş bir liste gösterir ve "veri yok" sanılır.
 *
 * Geri döndürdüğü işlev dinlemeyi bırakır (testler için).
 */
export const pencereHatalariniYakala = (pencere: Window): (() => void) => {
  const hataOlayi = (olay: ErrorEvent): void => {
    void hataBildirici().bildir(olay.error ?? olay.message, {
      tur: 'unhandled',
      yol: suAnkiYol(pencere),
      tarayici: pencere.navigator?.userAgent,
    })
  }
  const redOlayi = (olay: PromiseRejectionEvent): void => {
    void hataBildirici().bildir(olay.reason, {
      tur: 'unhandled',
      yol: suAnkiYol(pencere),
      tarayici: pencere.navigator?.userAgent,
      ek: { kaynak: 'promise' },
    })
  }
  pencere.addEventListener('error', hataOlayi)
  pencere.addEventListener('unhandledrejection', redOlayi)
  return () => {
    pencere.removeEventListener('error', hataOlayi)
    pencere.removeEventListener('unhandledrejection', redOlayi)
  }
}
