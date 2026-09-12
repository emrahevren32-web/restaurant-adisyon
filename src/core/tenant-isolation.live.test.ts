// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · G7 — İki kiracı izolasyon KABUL TESTİ
//
// Yol haritası maddeleri:
//   "İki tenant izolasyon kabul testi + ham SQL kontrolü"
//        → B, A'nın verisini hiçbir yoldan göremiyor
//   "RLS kapatıldığında testler kırmızıya dönüyor mu?"
//        → Dönüyorsa test gerçekten izolasyonu ölçüyor
//
// ⚠️ CANLI TEST. Yapılandırma yoksa ATLANIR (bkz. core/test-support/live-client.ts).
// `npm test` yapılandırmasız makinede yeşil kalmaya devam eder; bu testlerin
// çalıştığını görmek için `.env.test.local` gerekir.
//
// ── BU TESTİN İDDİASI VE SINIRI ───────────────────────────────────────────
// İddia: A'nın oturumuyla bağlanan bir istemci, B'nin hiçbir satırını
// göremez — ne kalem, ne hareket, ne kullanıcı, ne işletme kaydı.
//
// Sınır: bu test yalnızca "A, B'yi göremiyor" der. Testin DOĞRU SEBEPTEN
// geçtiğini kanıtlayan şey testin kendisi değil, NEGATİF KONTROLDÜR:
// `g7_rls_kapat.sql` çalıştırıldığında bu dosyanın KIRMIZIYA dönmesi gerekir.
// Dönmüyorsa, burada ölçülen şey RLS değil başka bir şeydir.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { liveTestConfig, signedInClient, tenantClaimOf } from './test-support/live-client'

const config = liveTestConfig()

describe.skipIf(!config)('G7 · İki kiracı izolasyonu (CANLI)', () => {
  let a: SupabaseClient
  let b: SupabaseClient
  let tenantA: string | null
  let tenantB: string | null

  beforeAll(async () => {
    a = await signedInClient(config!, config!.tenantA)
    b = await signedInClient(config!, config!.tenantB)
    tenantA = await tenantClaimOf(a)
    tenantB = await tenantClaimOf(b)
  }, 30_000)

  afterAll(async () => {
    await a?.auth.signOut()
    await b?.auth.signOut()
  })

  // ── Ön koşul ────────────────────────────────────────────────────────────
  // Bu blok geçmezse aşağıdakilerin hiçbiri anlamlı değildir: JWT'de tenant_id
  // yoksa RLS herkesi "yabancı" sayar ve testler "izolasyon var" sanır —
  // oysa olan şey, hiç kimsenin hiçbir şey görememesidir.
  describe('Ön koşul · JWT tenant_id claim\'i', () => {
    it('her iki oturumda da tenant_id claim\'i var', () => {
      expect(tenantA, 'A oturumunda tenant_id claim\'i yok — 0009/0013 hook\'u etkin mi?').toBeTruthy()
      expect(tenantB, 'B oturumunda tenant_id claim\'i yok — 0009/0013 hook\'u etkin mi?').toBeTruthy()
    })

    it('iki kiracının tenant_id\'si FARKLI', () => {
      expect(tenantA).not.toEqual(tenantB)
    })

    it('her kiracı KENDİ verisini görebiliyor (test boş sonuçla yanılmıyor)', async () => {
      // Bu olmadan "B'yi göremiyor" iddiası değersizdir: her sorgu boş dönüyor
      // olabilir ve test yine geçerdi.
      const { data: aKalem } = await a.from('stock_item').select('code')
      const { data: bKalem } = await b.from('stock_item').select('code')

      expect(aKalem?.map(r => r.code)).toContain('A-UN')
      expect(bKalem?.map(r => r.code)).toContain('B-SEKER')
    })
  })

  // ── Asıl iddia ──────────────────────────────────────────────────────────
  describe('A, B\'nin verisini HİÇBİR YOLDAN göremiyor', () => {
    it('stok kalemleri: A yalnızca kendi kalemini görür', async () => {
      const { data, error } = await a.from('stock_item').select('code, tenant_id')
      expect(error).toBeNull()
      expect(data?.map(r => r.code)).not.toContain('B-SEKER')
      expect(data?.every(r => r.tenant_id === tenantA)).toBe(true)
    })

    it('kalemi ADIYLA aramak da işe yaramaz', async () => {
      // Filtre uygulamada değil veritabanında olmalı: B'nin kalemini doğrudan
      // kodla istemek bile boş dönmeli.
      const { data, error } = await a.from('stock_item').select('code').eq('code', 'B-SEKER')
      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('hareket defteri: A, B\'nin hareketlerini görmez', async () => {
      const { data, error } = await a.from('stock_movement').select('tenant_id, quantity_base')
      expect(error).toBeNull()
      expect(data?.every(r => r.tenant_id === tenantA)).toBe(true)
      // B'nin açılış miktarı 222; A'nın defterinde görünmemeli.
      expect(data?.map(r => Number(r.quantity_base))).not.toContain(222)
    })

    it('bakiye görünümü de sızdırmaz', async () => {
      // stock_balance görünümü security_invoker=on (0006) — çağıranın
      // yetkisiyle çalışır. Öyle olmasaydı görünüm RLS'i atlardı.
      const { data, error } = await a.from('stock_balance').select('tenant_id, qty')
      expect(error).toBeNull()
      expect(data?.every(r => r.tenant_id === tenantA)).toBe(true)
    })

    it('kullanıcılar: A, B\'nin personelini görmez', async () => {
      const { data, error } = await a.from('app_user').select('username, tenant_id')
      expect(error).toBeNull()
      expect(data?.map(r => r.username)).not.toContain('testb')
      expect(data?.every(r => r.tenant_id === tenantA)).toBe(true)
    })

    it('işletme kaydı: A yalnızca kendi tenant satırını görür', async () => {
      const { data, error } = await a.from('tenant').select('code')
      expect(error).toBeNull()
      expect(data?.map(r => r.code)).toEqual(['TESTA'])
    })

    it('firma ve şube kayıtları da sızmaz', async () => {
      const { data: firmalar } = await a.from('company').select('company_code')
      const { data: subeler } = await a.from('branch').select('name')
      expect(firmalar?.map(r => r.company_code)).not.toContain('TESTB')
      expect(subeler?.map(r => r.name)).not.toContain('B Merkez')
    })
  })

  // ── Simetri ─────────────────────────────────────────────────────────────
  describe('Aynısı ters yönde de geçerli', () => {
    it('B de A\'nın verisini göremiyor', async () => {
      const { data: kalemler } = await b.from('stock_item').select('code')
      const { data: hareketler } = await b.from('stock_movement').select('quantity_base')
      const { data: kiracilar } = await b.from('tenant').select('code')

      expect(kalemler?.map(r => r.code)).not.toContain('A-UN')
      expect(hareketler?.map(r => Number(r.quantity_base))).not.toContain(111)
      expect(kiracilar?.map(r => r.code)).toEqual(['TESTB'])
    })
  })

  // ── Yazma tarafı ────────────────────────────────────────────────────────
  describe('A, B\'nin adına YAZAMAZ', () => {
    // ⚠️ BU TESTİN İLK HÂLİ YANLIŞ POZİTİFTİ (2026-08-27 · negatif kontrol yakaladı).
    //
    // Önceki hâli `branch_id` olarak var olmayan bir kimlik ('00000000-…')
    // gönderiyordu. Yazma reddediliyordu ama RLS yüzünden DEĞİL, yabancı anahtar
    // kısıtı yüzünden. Sonuç: RLS tamamen KAPALIYKEN bile bu test yeşil kalıyordu
    // — yani ölçtüğünü iddia ettiği şeyi hiç ölçmüyordu.
    //
    // Bunu ortaya çıkaran şey testin kendisi değil, `g7_rls_kapat.sql` ile yapılan
    // NEGATİF KONTROLDÜ: 8 test kırmızıya döndü, bu yeşil kaldı ve tutarsızlık
    // görünür oldu. Negatif kontrolün varlık sebebi tam olarak budur.
    //
    // Düzeltilmiş hâli B'nin GERÇEK şubesini kullanır; geriye tek engel olarak
    // RLS'in `with check` koşulu kalır.
    it('B\'nin tenant_id\'si ve GERÇEK şubesiyle kalem eklemek reddedilir', async () => {
      // B'nin şubesini B'nin oturumundan okuyoruz — A onu zaten göremez.
      const { data: bSube, error: subeHatasi } = await b
        .from('branch').select('id').limit(1).maybeSingle()
      expect(subeHatasi).toBeNull()
      expect(bSube?.id, 'B işletmesinin şubesi yok — g7_2_veri.sql çalıştı mı?').toBeTruthy()

      // Kod her koşumda benzersiz: RLS kapalıyken yazma GERÇEKTEN başarılı olur ve
      // satır kalır. Sabit bir kod, ikinci koşumda tekillik kısıtına takılıp testi
      // yine yanlış sebepten "geçirirdi" — düzelttiğimiz kusurun aynısı.
      const benzersiz = `SIZINTI-${Date.now()}`

      const { error } = await a.from('stock_item').insert({
        tenant_id: tenantB,
        branch_id: bSube!.id,
        code: benzersiz,
        code_key: benzersiz.toLowerCase(),
        name: 'Olmamalı',
        base_uom: 'kg',
      })

      expect(error, 'A, B adına satır yazabildi — RLS with check çalışmıyor').not.toBeNull()
    })
  })
})

// Yapılandırma yoksa görünür bir iz bırak: testlerin "geçtiğini" sanıp
// aslında hiç çalışmadığını fark etmemek en kötü sonuç olurdu.
describe.skipIf(!!config)('G7 · canlı testler ATLANDI', () => {
  it('`.env.test.local` yok — bu testler ÇALIŞMADI', () => {
    expect(config).toBeNull()
  })
})
