import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Test yapılandırması — Production Foundation, Dilim 0 / G1.
 *
 * jsdom kullanılıyor çünkü domain servisleri localStorage üzerinden okuyor.
 * Backend'e geçildiğinde çoğu test node ortamına dönecek; o zamana kadar jsdom,
 * mevcut kodu değiştirmeden test edebilmenin en kısa yolu.
 *
 * ⚠️ `*.live.test.ts` dosyaları BU YAPILANDIRMANIN DIŞINDA (bkz. exclude).
 * Onlar gerçek bir Supabase projesine bağlanır, ağ ister ve her koşumda sınama
 * projesine veri yazar (defter append-only, silinemez). `npm test`'in hızlı ve
 * yan etkisiz kalması için ayrıldılar: `npm run test:live` ile çalışırlar.
 * Bkz. vitest.live.config.ts ve docs/g7-kurulum.md
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['**/node_modules/**', 'src/**/*.live.test.ts'],
    clearMocks: true,
    restoreMocks: true
  }
})
