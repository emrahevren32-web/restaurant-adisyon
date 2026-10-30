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
 *
 * ── ⚠️ TEK İŞÇİ · 30.10.2026 · ÖLÇÜLDÜ ───────────────────────────────────
 * Testler 29–30 Ekim'de üç kez üst üste KIRMIZI verdi ve hiçbirinde tek bir
 * iddia hatası yoktu: hepsi `[vitest-worker]: Timeout calling "fetch"`.
 * Düşen dosyalar her koşuda DEĞİŞİYORDU — gerçek bir hata hep aynı yerden
 * çıkar, bu çıkmıyordu.
 *
 * Ölçüm (aynı kod, aynı makine, arka arkaya):
 *   · paralel havuz → 429 sn, 28 paket "düştü" (hiç başlamadan), 0 iddia hatası
 *   · tek işçi      →   8 sn, 95 paketin 95'i, 1643 testin 1643'ü YEŞİL
 * Yani 53 kat hızlı. Sebep: her işçi kendi Vite dönüştürme hattını ve kendi
 * jsdom ortamını kuruyor; 95 dosya × N işçi bu makinede diski ve belleği
 * kilitliyor, işçiler ana süreçten dosya isterken zaman aşımına uğruyor ve
 * paket HİÇ BAŞLAMADAN "düştü" sayılıyor.
 *
 * ⚠️ BU KAPIYI GEVŞETMEK DEĞİLDİR: hangi testin koştuğu, neyi ölçtüğü ve
 * kaç tane olduğu BİREBİR AYNI. Değişen tek şey sıraya dizilişleri. Üstelik
 * hat 53 kat hızlandığı için kapı daha SIK çalıştırılabiliyor.
 *
 * ⚠️ BEDELİ ŞUDUR ve yazılı dursun: tek süreçte bütün dosyalar aynı global
 * durumu paylaşır. Bugün sızıntı YOK (1643/1643 tek süreçte geçti), ama bir
 * gün bir test TEK BAŞINA geçip BÜTÜN takımda düşerse ilk şüpheli paylaşılan
 * durumdur — o zaman `clearMocks`/`restoreMocks` yetmiyor demektir.
 * (Tek süreçte `Multiple GoTrueClient instances` uyarısı çıkıyor: birden çok
 * dosya aynı süreçte Supabase istemcisi kuruyor. Uyarı, hata değil.)
 *
 * ⚠️ `src/core/derleme-kapisi.arch.test.ts` bu ayarın dosyadan DÜŞMESİNİ
 * engelliyor — kuralı belgeye yazmak hatırlatma, teste yazmak engellemedir.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['**/node_modules/**', 'src/**/*.live.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    // ⚠️ Bkz. dosya başı "TEK İŞÇİ": 429 sn + 28 sahte kırmızı → 8 sn + 0.
    poolOptions: { threads: { singleThread: true } }
  }
})
