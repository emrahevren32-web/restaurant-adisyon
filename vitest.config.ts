import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Test yapılandırması — Production Foundation, Dilim 0 / G1.
 *
 * jsdom kullanılıyor çünkü domain servisleri localStorage üzerinden okuyor.
 * Backend'e geçildiğinde (Dilim 0 / G3) çoğu test node ortamına dönecek; o zamana
 * kadar jsdom, mevcut kodu değiştirmeden test edebilmenin en kısa yolu.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    clearMocks: true,
    restoreMocks: true
  }
})
