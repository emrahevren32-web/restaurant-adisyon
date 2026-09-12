import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * CANLI test yapılandırması — G7.
 *
 * Yalnızca `*.live.test.ts` dosyalarını koşar. Bunlar gerçek bir Supabase
 * projesine bağlanır; `.env.test.local` yoksa kendileri atlanır.
 *
 * ⛔ Bağlandıkları proje ÜRETİM OLMAMALIDIR. `test-support/live-client.ts`
 * sınama URL'i uygulamanın kendi URL'iyle aynıysa bilerek hata verir —
 * `stock_movement` append-only olduğu için oraya yazılan sınama verisi
 * bir daha silinemezdi.
 *
 * Kurulum: docs/g7-kurulum.md
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.live.test.ts'],
    // Canlı koşum uzun sürdüğü için varsayılan raporlayıcı ilerlemeyi
    // saniyede birçok kez yeniden çiziyor ve terminal binlerce satırlık
    // tekrarla doluyor. 'basic' yalnızca sonucu ve hataları yazar.
    reporters: ['basic'],
    // Dosyalar SIRAYLA koşar. İki canlı dosya aynı anda başlayınca dördü birden
    // (A ve B oturumları × iki dosya) aynı saniyede giriş yapıyor ve saat
    // kaymasına denk gelme olasılığı artıyor. Ayrıca ikisi de aynı sınama
    // tenant'ının negatif stok politikasını değiştiriyor — paralel koşarlarsa
    // biri diğerinin ayarını altından çekebilir.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    clearMocks: true,
    restoreMocks: true
  }
})
