// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · G7 — Sözleşme testleri · CANLI Postgres uygulaması
//
// Yol haritası maddesi: "PostgreSQL uygulaması, aynı testler"
//                       Bitti sayılır ki: "İki uygulamada da aynı suite geçiyor"
//
// Testlerin gövdesi burada DEĞİL — `stock.contract.suite.ts` içinde, yani
// LocalStorage'ın koştuğu gövdenin BİREBİR AYNISI. Bu dosya yalnızca o gövdeye
// canlı bir Postgres zemini sağlar.
//
// ⚠️ Yapılandırma yoksa ATLANIR; `npm test` her makinede yeşil kalır.
//    Kurulum: docs/g7-kurulum.md
//
// ── DEFTER SİLİNEMEZ, BU YÜZDEN HER TEST KENDİ KALEMİNİ ALIR ──────────────
// `stock_movement` append-only (0003): yazılan hareket geri alınamaz, temizlik
// diye bir şey yok. Bu yüzden "temiz zemin" burada silmekle değil, HER TESTE
// TAZE BİR STOK KALEMİ vererek sağlanıyor — bakiyesi kaçınılmaz olarak 0'dan
// başlar. Idempotency anahtarları da koşuma özgü benzersiz bir önek taşır;
// aksi hâlde ikinci koşum I2'ye takılır ve testler yanlış sebepten kırılırdı.
//
// Bunun bedeli: her koşum sınama projesinde birkaç düzine kalem ve hareket
// bırakır. Kabul edilebilir — o proje bunun için var ve geçici.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from './context'
import type { NegativeStockPolicy } from './stock/stock.repository'
import { PostgresStockRepository } from './stock/stock.postgres'
import { sozlesmeTestleriniKos, type ContractZemin } from './stock/stock.contract.suite'
import { liveTestConfig, signedInClient, tenantClaimOf } from './test-support/live-client'

const config = liveTestConfig()

if (config) {
  let aIstemci: SupabaseClient
  let bIstemci: SupabaseClient
  let aCtx: TenantCtx
  let bCtx: TenantCtx
  let ikinciSubeCtx: TenantCtx
  const kosumId = `g7-${Date.now().toString(36)}`
  let sayac = 0

  beforeAll(async () => {
    aIstemci = await signedInClient(config, config.tenantA)
    bIstemci = await signedInClient(config, config.tenantB)

    const aTenant = await tenantClaimOf(aIstemci)
    const bTenant = await tenantClaimOf(bIstemci)
    if (!aTenant || !bTenant) {
      throw new Error(
        'JWT tenant_id claim\'i yok. Sınama projesinde Auth Hook etkin mi? ' +
        'Bkz. docs/g7-kurulum.md ADIM 4.'
      )
    }

    const { data: aSube, error: aSubeHata } = await aIstemci
      .from('branch').select('id').eq('is_head_office', true).maybeSingle()
    if (aSubeHata || !aSube) throw new Error(`A merkez şubesi okunamadı: ${aSubeHata?.message}`)

    const { data: bSube, error: bSubeHata } = await bIstemci
      .from('branch').select('id').eq('is_head_office', true).maybeSingle()
    if (bSubeHata || !bSube) throw new Error(`B merkez şubesi okunamadı: ${bSubeHata?.message}`)

    // ⚠️ `ctx.userId` GERÇEK bir `app_user.id` olmalı: `postMovement` onu
    // `stock_movement.created_by` sütununa yazıyor ve orası app_user'a bağlı
    // bir uuid. İlk denemede buraya 'g7-test' gibi bir metin konmuştu ve
    // 19 test birden "invalid input syntax for type uuid" ile düştü.
    //
    // LocalStorage uygulaması bunu yakalayamazdı — orada `created_by` yalnızca
    // bir JSON alanı, tip denetimi yok. Yani bu, ancak canlı Postgres'e karşı
    // koşarak görülebilecek bir hataydı: "aynı suite iki uygulamada da geçsin"
    // maddesinin neden gerçek bir değeri olduğunun somut örneği.
    const kullaniciId = async (istemci: SupabaseClient, kimIcin: string) => {
      const { data, error } = await istemci.from('app_user').select('id').limit(1).maybeSingle()
      if (error || !data) throw new Error(`${kimIcin} app_user kaydı okunamadı: ${error?.message}`)
      return data.id as string
    }

    aCtx = { tenantId: aTenant, branchId: aSube.id as string, userId: await kullaniciId(aIstemci, 'A') }
    bCtx = { tenantId: bTenant, branchId: bSube.id as string, userId: await kullaniciId(bIstemci, 'B') }

    // "Başka şube" testi için A'nın ikinci bir şubesi gerekiyor. Fixture'da yok;
    // burada bir kez oluşturuluyor ki Emrah'ın elle SQL çalıştırması gerekmesin.
    const { data: firma } = await aIstemci.from('company').select('id').limit(1).maybeSingle()
    const { data: mevcut } = await aIstemci
      .from('branch').select('id').eq('code', 'IKINCI').maybeSingle()

    let ikinciSubeId = mevcut?.id as string | undefined
    if (!ikinciSubeId) {
      const { data: yeni, error } = await aIstemci.from('branch').insert({
        tenant_id: aTenant,
        company_id: firma!.id,
        code: 'IKINCI',
        name: 'A İkinci Şube',
        branch_type: 'depo',
      }).select('id').single()
      if (error) throw new Error(`İkinci şube oluşturulamadı: ${error.message}`)
      ikinciSubeId = yeni.id as string
    }
    ikinciSubeCtx = { tenantId: aTenant, branchId: ikinciSubeId, userId: aCtx.userId }
  }, 60_000)

  afterAll(async () => {
    // Politikayı güvenli varsayılana geri al: testler onu 'warn'/'allow'
    // bırakabilir ve sonraki koşum yanlış zeminden başlardı.
    await aIstemci?.rpc('set_negative_stock_policy', { p_policy: 'block' })
    await aIstemci?.auth.signOut()
    await bIstemci?.auth.signOut()
  })

  sozlesmeTestleriniKos({
    ad: 'Postgres (canlı)',
    // Uzak veritabanı: her test birkaç gidiş-geliş yapıyor.
    zamanAsimi: 30_000,
    async hazirla(policy?: NegativeStockPolicy): Promise<ContractZemin> {
      sayac += 1
      const onek = `${kosumId}-${sayac}`

      // Politika tenant seviyesinde; RPC yetki kontrollü (0016).
      const { error: politikaHatasi } = await aIstemci.rpc('set_negative_stock_policy', {
        p_policy: policy ?? 'block',
      })
      if (politikaHatasi) {
        throw new Error(
          `Politika ayarlanamadı: ${politikaHatasi.message}. ` +
          '0016_politika_rpc_erisimi.sql sınama projesinde çalıştırıldı mı?'
        )
      }

      // TAZE kalemler — defter silinemediği için "temiz zemin" böyle sağlanıyor.
      const kalemYaz = async (kod: string, lotTakibi: boolean) => {
        const { data, error } = await aIstemci.from('stock_item').insert({
          tenant_id: aCtx.tenantId,
          branch_id: aCtx.branchId,
          code: kod,
          code_key: kod.toLowerCase(),
          name: kod,
          base_uom: 'kg',
          tracks_lot: lotTakibi,
        }).select('id').single()
        if (error) throw new Error(`Sınama kalemi oluşturulamadı (${kod}): ${error.message}`)
        return data.id as string
      }

      const lotsuzKalem = await kalemYaz(`${onek}-LOTSUZ`, false)
      const lotluKalem = await kalemYaz(`${onek}-LOTLU`, true)

      const { data: lot, error: lotHatasi } = await aIstemci.from('stock_lot').insert({
        tenant_id: aCtx.tenantId,
        branch_id: aCtx.branchId,
        stock_item_id: lotluKalem,
        lot_code: `${onek}-LOT`,
        lot_code_key: `${onek}-lot`.toLowerCase(),
        origin_type: 'RECEIPT',
      }).select('id').single()
      if (lotHatasi) throw new Error(`Sınama lotu oluşturulamadı: ${lotHatasi.message}`)

      return {
        repo: new PostgresStockRepository(aIstemci),
        ctx: aCtx,
        baskaSubeCtx: ikinciSubeCtx,
        // Postgres'te "başka tenant" AYRI BİR OTURUMDUR: tenant süzmesini ctx
        // değil, JWT üzerinden RLS yapıyor. Yalnızca ctx değiştirmek burada
        // hiçbir şey kanıtlamazdı.
        baskaTenant: { repo: new PostgresStockRepository(bIstemci), ctx: bCtx },
        lotsuzKalem,
        lotluKalem,
        lotId: lot.id as string,
        anahtar: (ek: string) => `${onek}:${ek}`,
      }
    },
  })
} else {
  // Yapılandırma yoksa görünür bir iz bırak: testlerin "geçtiğini" sanıp
  // aslında hiç çalışmadığını fark etmemek en kötü sonuç olurdu.
  describe('G7 · canlı sözleşme testleri ATLANDI', () => {
    it('`.env.test.local` yok — PostgresStockRepository sözleşmesi SINANMADI', () => {
      expect(config).toBeNull()
    })
  })
}
