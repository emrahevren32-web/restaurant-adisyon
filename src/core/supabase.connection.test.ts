import { describe, expect, it } from 'vitest'
import { getSupabase, isSupabaseConfigured } from './supabase'

/**
 * Bağlantı kontrolü — Dilim 0 / G4'ün ilk adımı.
 *
 * İki şeyi birden kanıtlar:
 *   1. Uygulama Supabase'e gerçekten bağlanabiliyor
 *   2. `uom` tablosunun okuma politikası anon rol için çalışıyor
 *      (migration 0005 — politikasız RLS herkese kapalıdır)
 *
 * .env.local yoksa test ATLANIR. CI'da anahtar bulunmadığı için orada da atlanır;
 * bu bilinçli bir tercih — gizli anahtar CI'a taşınmıyor.
 */
const testIf = isSupabaseConfigured() ? it : it.skip

describe('Supabase bağlantısı', () => {
  testIf('uom tablosu okunabiliyor', async () => {
    const { data, error } = await getSupabase()
      .from('uom')
      .select('code, name, dimension')
      .order('code')

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(8)
    expect(data!.map(row => row.code)).toContain('kg')
  }, 20_000)

  testIf('birim dönüşüm tablosu okunabiliyor', async () => {
    const { data, error } = await getSupabase()
      .from('uom_conversion')
      .select('from_uom, to_uom, factor')
      .eq('from_uom', 'kg')
      .eq('to_uom', 'g')
      .single()

    expect(error).toBeNull()
    expect(Number(data!.factor)).toBe(1000)
  }, 20_000)

  testIf('tenant tablosu anon rol için KAPALI', async () => {
    // Oturum açmamış bir istemci müşteri verisinden hiçbir satır görmemeli.
    //
    // DÜRÜSTLÜK NOTU: bu test "kapalı"yı kanıtlar, "RLS sayesinde kapalı"yı
    // değil. `anon` rolüne bu tabloda GRANT verilmediği için istek zaten 42501
    // ile dönüyor; RLS'e sıra bile gelmiyor. İki savunma hattı da çalışıyor
    // ama hangisinin tuttuğunu buradan ayırt edemeyiz.
    //
    // RLS'in gerçekten satır süzdüğü, iki farklı tenant'ın oturum açmış
    // kullanıcılarıyla G7'de kanıtlanacak — ADR-004'teki negatif kontrol.
    const { data, error } = await getSupabase().from('tenant').select('id')

    expect(error === null || error.code === '42501').toBe(true)
    expect(data ?? []).toHaveLength(0)
  }, 20_000)
})
