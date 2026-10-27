// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — GÖSTERGE KAPISI YERİNDE, HAM HESAP KAPININ İÇİNDE DEĞİL
//
// ── NEDEN VAR (MIYOP-078 · P0 · 27.10.2026) ──────────────────────────────
// 0065 `app.isletme_gostergeleri` fonksiyonunu yazdı. **0071 onu ikiye
// ayırdı:** ham hesap `..._ham` adına, asıl ad bir `finance.read` İZİN
// KAPISI oldu. 0095'i yazarken gövdeyi 0065'ten kopyalayıp **asıl ada**
// yazdım ve otuz göç sonra o kapıyı ezdim. Açık canlıya gitti: finans izni
// olmayan depo/üretim/kalite/gıda mühendisi fire tutarını ve stok maliyetini
// doğrudan RPC'den okuyabildi.
//
// ⚠️ Bunu bir ÇALIŞMA ZAMANI kontrolüyle önlemeye üç kez çalıştım ve üçünde
// de paketi rehin aldı: göç 0095, kapıyı onaran 0099'dan ÖNCE çalışıyor ve
// canlıdaki bozuk geçmişi görüp patlıyordu. Bir göçün doğrulaması yalnız
// KENDİ YAZDIĞINI ölçebilir, ortamın geçmişini değil (tuzak 133).
//
// ⚠️ Doğru yer burası: ölçülen şey DOSYANIN METNİ. Hangi göçün hangi ada
// yazdığı, veritabanının o anki hâlinden bağımsızdır ve her test koşusunda
// ölçülür.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'

const KOK = projeKokunuBul()
const oku = (ad: string) => readFileSync(join(KOK, 'db/migrations', ad), 'utf8') as string

const GOC_0071 = oku('0071_analiz_yetkisi_sunucuda.sql')
const GOC_0095 = oku('0095_kullanilabilir_bakiye.sql')
const GOC_0099 = oku('0099_finans_kapisi_geri.sql')

/** `create or replace function app.<ad>(` geçiyor mu? */
const yaziyorMu = (sql: string, ad: string) =>
  new RegExp(`create or replace function app\\.${ad}\\s*\\(`).test(sql)

describe('gösterge kapısı · ham hesap kapının adına yazılmıyor', () => {
  it('sağlama: üç göç de okundu', () => {
    for(const [ad, metin] of [['0071', GOC_0071], ['0095', GOC_0095], ['0099', GOC_0099]] as const){
      expect(metin.length, `${ad} okunamadı`).toBeGreaterThan(500)
    }
  })

  it('0071 ayrımı kurmuş: _ham ham hesap, asıl ad izin kapısı', () => {
    expect(GOC_0071, '0071 ham hesabı _ham adına taşımıyor')
      .toMatch(/rename to isletme_gostergeleri_ham/)
    expect(yaziyorMu(GOC_0071, 'isletme_gostergeleri'), '0071 kapıyı yazmıyor').toBe(true)
    expect(GOC_0071, '0071 kapısı finance.read sormuyor').toMatch(/finance\.read/)
  })

  it('⚠️ 0095 İZİN KAPISININ ADINA YAZMIYOR', () => {
    // MIYOP-078'in ta kendisi. Bu satır kırmızı verirse kapı yine ezilmiş
    // demektir — ve bu sefer canlıya gitmeden önce yakalanır.
    expect(
      yaziyorMu(GOC_0095, 'isletme_gostergeleri'),
      '0095 `app.isletme_gostergeleri` adına yazıyor — bu ad 0071 ile bir '
      + 'IZIN KAPISIDIR, ham hesap `_ham` adına yazılmalı (MIYOP-078).',
    ).toBe(false)
    expect(yaziyorMu(GOC_0095, 'isletme_gostergeleri_ham'), "0095 _ham'a yazmıyor")
      .toBe(true)
  })

  it('0099 kapıyı geri koyuyor ve ham hesap içine yazmıyor', () => {
    expect(yaziyorMu(GOC_0099, 'isletme_gostergeleri'), '0099 kapıyı yazmıyor').toBe(true)
    expect(GOC_0099, '0099 kapısı finance.read sormuyor').toMatch(/finance\.read/)

    // ⚠️ 0099 HEM `_ham`'ı HEM kapıyı yazıyor; kapının gövdesinde ham hesap
    // OLMAMALI. Dosyayı kapı tanımından itibaren kesip ölçüyoruz.
    const kapiBasi = GOC_0099.search(/create or replace function app\.isletme_gostergeleri\s*\(/)
    expect(kapiBasi, "0099'da kapı tanımı bulunamadı").toBeGreaterThan(-1)
    const kapiGovdesi = GOC_0099.slice(kapiBasi, GOC_0099.indexOf('$$;', kapiBasi) + 3)
    expect(kapiGovdesi, 'kapının gövdesinde ham hesap var')
      .not.toMatch(/stock_usable_balance|from public\.stock_movement/)
    expect(kapiGovdesi, 'kapı ham fonksiyonu çağırmıyor')
      .toMatch(/isletme_gostergeleri_ham/)
  })

  it('kapı `security definer` YAPILMIYOR', () => {
    // 0071'in kararı: definer olsaydı izin kontrolünü geçen bir çağrı RLS'i
    // de aşar ve BÜTÜN kiracıları okurdu.
    for(const [ad, metin] of [['0071', GOC_0071], ['0099', GOC_0099]] as const){
      const yer = metin.search(/create or replace function app\.isletme_gostergeleri\s*\(/)
      if(yer < 0) continue
      const govde = metin.slice(yer, metin.indexOf('$$;', yer) + 3)
      expect(govde, `${ad} kapıyı security definer yapıyor`)
        .not.toMatch(/security definer/)
    }
  })

  it('fire_dokumu ayrımı da duruyor (aynı desen, ikinci yer)', () => {
    expect(GOC_0071).toMatch(/rename to fire_dokumu_ham/)
    // Hiçbir göç `app.fire_dokumu` adına ham hesap yazmamalı.
    for(const [ad, metin] of [['0095', GOC_0095], ['0099', GOC_0099]] as const){
      expect(yaziyorMu(metin, 'fire_dokumu'), `${ad} fire_dokumu kapısına yazıyor`)
        .toBe(false)
    }
  })
})
