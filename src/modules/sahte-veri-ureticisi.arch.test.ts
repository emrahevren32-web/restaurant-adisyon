// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — SAHTE VERİ ÜRETİCİSİ ÇIÇIRI
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────
// Emrah'ın değişmez kuralı: *"yeni kurulmuş bir işletme varsayalım,
// ekranlarında asla mock veri olmayacak."*
//
// `mock-rota-sizintisi.arch.test.ts` yalnız iki imzayı suç sayıyor:
// `*.mock.ts(x)` dosyaları ve `SEED…COUNT` + `localStorage.setItem` deseni.
// 21.10'da Codex taraması gösterdi ki asıl tehlike adı mock OLMAYAN
// üreticilerdi: `storage.ts` içinde **27 tane `createDemo*`** ve hepsi
// "depo boşsa demo üret" dalından geçiyor (tuzak 107).
//
// ── BU TEST BİR ÇIÇIR ────────────────────────────────────────────────────
// Üretici sayısını DONDURUYOR. Kural: sayı yalnız AŞAĞI gidebilir.
// Yeni bir `createDemo*` yazılırsa test kırılır; bir tanesi silinirse
// sınır da indirilir. Böylece temizlik geri alınamaz.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'

const SRC = join(projeKokunuBul(), 'src')
const DEPO = readFileSync(join(SRC, 'storage.ts'), 'utf8') as string

/**
 * ⚠️ Yorumları çıkarır. Silinen üreticilerin GEREKÇESİ yorum olarak
 * dosyada duruyor ve o yorumlar `createDemoBranches` gibi adları
 * İÇERİYOR — içermeli, yoksa bir sonraki kişi aynı şeyi geri yazar.
 * Ama yorumlu metinde arama yapmak testi kendi notumuza takılarak
 * kırıyordu; bu desen daha önce de başımıza geldi.
 */
const yorumsuz = (metin: string) => metin
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')

/**
 * ⚠️ 31.10.2026 · 23 → **0**. A4 bitti; `storage.ts` içinde tek bir
 * `createDemo*` kalmadı. Toplam **851 satır** uydurma veri silindi.
 *
 * İki turda yapıldı:
 *   1. kiracı tarafı · 13 üretici + mekanizma (408 satır)
 *   2. platform (EVREN360) · 8 üretici (443 satır)
 *
 * ⚠️ İKİ FONKSİYON SİLİNMEDİ, ADI DEĞİŞTİ: `varsayilanLisansPaketleri` ve
 * `varsayilanLisansModulleri`. Uydurma kayıt değil, ÜRÜN KATALOĞU
 * (`defaultPackageSpecs`ten türüyorlar). Ad değiştirip sayımdan çıkmak
 * saklamak olurdu; aşağıda ayrı bir sınama onu dürüst tutuyor.
 *
 * ⚠️ 31.10.2026 · birinci tur: 23 → **10** (on üç üretici, 408 satır).
 * Silinenler: personel altısı (employees, shifts, attendances, performances,
 * bonuses, audits) ve finans yedisi (currentAccounts, creditTransactions,
 * supplierDebts, supplierPayments, collectionTransactions, cashTransfers,
 * incomeExpenses).
 *
 * ⚠️ ASIL İŞ ÜRETİCİLERİ SİLMEK DEĞİL, MEKANİZMAYI KALDIRMAKTI:
 * `loadBranchScopedItemsWithDemo` ve `loadAllBranchScopedItemsWithDemo`
 * da silindi. O ikisinin kalbi `localStorage.getItem(key) === null ?
 * createDemoItems() : ...` idi — "depo boşsa uydur". Yükleyici dururken
 * üreticiyi silmek, yarın yeni bir üreticiyle geri gelmesine izin verirdi.
 *
 * ⚠️ Silinen on üçün hiçbiri o gün AÇIK bir ekrana ulaşmıyordu (dört modül
 * de `frozen`). Yani yangın söndürme değil, mayın temizliğiydi: dondurulmuş
 * bir kapı açıldığında uydurma veri sessizce geri gelecekti. Personel modülü
 * 29.08'de bir kez açılmış, 14.10'da yeniden dondurulmuştu.
 *
 * ⚠️ 25.10.2026'da 27'den 23'e indi:
 * · `createDemoAnnouncements` — portaldaki uydurma bakım/lisans duyurusu
 * · `createDemoBranches` — dört uydurma şube (Merkez/İstanbul/Ankara/İzmir)
 * · `createDemoCompanies` — üç uydurma firma (ABC Cafe, Örnek İşletme…)
 * · `createDemoData` — 117 satırlık tohumlama; Adana Kebap, Kola, altı masa
 *   ve 24 üreticinin tamamını localStorage'a yazıyordu
 * (`createDemoAnnouncements` bu dosyada değildi, `notification.service`
 *  içindeydi; sayım yalnız `storage.ts`i kapsıyor.)
 */
const UST_SINIR = 0

describe('sahte veri üreticisi çıcırı', () => {
  // ⚠️ MIYOP-073 (Codex, 25.10) · `export const` KAÇIYORDU.
  // İlk sürüm yalnız `^const createDemo…` arıyordu. Silinen en büyük
  // üretici ise `export const createDemoData = () => {` biçimindeydi —
  // yani "silinenler geri gelmemiş" kontrolü, geri gelen EN TEHLİKELİ
  // fonksiyonu yakalayamazdı. Desen artık `export` önekini de kapsıyor.
  // ⚠️ Yorumlar çıkarılıyor: silinen üreticilerin gerekçesi yorum olarak
  // dosyada duruyor ve o yorumlar adları içeriyor.
  const ureticiler = [...yorumsuz(DEPO).matchAll(/^\s*(?:export\s+)?const (createDemo[A-Za-z]+)\s*=/gm)]
    .map(m => m[1] as string)

  // ⚠️ 31.10.2026 · BU SAĞLAMA YENİDEN YAZILDI VE SEBEBİ ÖNEMLİ.
  // Eskiden "en az bir üretici bulmalıyım" diyordu, çünkü o gün sıfır
  // bulmak ancak ölçümün bozulmasıyla mümkündü (tuzak 58).
  // Bugün sıfır DOĞRU CEVAP: hepsi silindi. O hâlde sağlamanın işi değişti —
  // artık "ölçüm aracı hâlâ çalışıyor mu" sorusunu sormalı, "sonuç dolu mu"
  // değil. Yoksa dosya bir gün boşalsa ya da desen bozulsa test yine yeşil
  // kalır ve çıcır sessizce ölür.
  it('sağlama: dosya okundu ve ARAÇ hâlâ çalışıyor', () => {
    expect(DEPO.length, 'storage.ts okunamadı ya da sasirtici kadar kucuk')
      .toBeGreaterThan(100000)
    const ornek = 'const createDemoSeyler = () => []\nexport const createDemoBaska = () => []'
    const bulunan = [...ornek.matchAll(/^\s*(?:export\s+)?const (createDemo[A-Za-z]+)\s*=/gm)]
    expect(bulunan.length, 'tarama deseni bozulmuş — artık hiçbir şey bulamaz').toBe(2)
  })

  it('üretici sayısı yalnız AZALABİLİR', () => {
    expect(
      ureticiler.length,
      `storage.ts içinde ${ureticiler.length} sahte veri üreticisi var, `
      + `sınır ${UST_SINIR}. Yeni üretici eklenmiş olabilir:\n`
      + ureticiler.join('\n')
    ).toBeLessThanOrEqual(UST_SINIR)
  })

  it('silinen ON DOKUZU geri gelmemiş · sayımdan BAĞIMSIZ ölçüm', () => {
    // ⚠️ Bu kontrol artık `ureticiler` listesine BAĞLI DEĞİL (MIYOP-073).
    // Eskiden öyleydi; sayım bir biçimi kaçırırsa yasak ad kontrolü de
    // sessizce kaçırıyordu. İki ölçüm birbirine dayanırsa, birinin kör
    // noktası ötekinin de kör noktası olur.
    const SILINENLER = [
      // 25.10.2026
      'createDemoBranches', 'createDemoCompanies', 'createDemoData',
      // 31.10.2026 · personel
      'createDemoEmployees', 'createDemoShifts', 'createDemoAttendances',
      'createDemoEmployeePerformances', 'createDemoEmployeeBonuses',
      'createDemoEmployeeAudits',
      // 31.10.2026 · finans
      'createDemoCurrentAccounts', 'createDemoCreditTransactions',
      'createDemoSupplierDebts', 'createDemoSupplierPayments',
      'createDemoCollectionTransactions', 'createDemoCashTransfers',
      'createDemoIncomeExpenses',
      // 31.10.2026 · platform (EVREN360)
      'createDemoBusinessApplications', 'createDemoApplicationNotes',
      'createDemoBusinessRegistrations', 'createDemoCompanySetups',
      'createDemoCompanyLicenses', 'createDemoCompanyUsers',
      'createDemoUserSubscriptions', 'createDemoPlatformSupportTickets',
    ]
    for(const silinen of SILINENLER){
      expect(
        new RegExp(`(?:export\\s+)?const ${silinen}\\s*=`).test(yorumsuz(DEPO)),
        `${silinen} geri gelmiş. Gerekçesi docs/kararlar/kaldirilan-moduller.md'de.`
      ).toBe(false)
    }
  })

  it('⚠️ "depo boşsa uydur" MEKANİZMASI geri gelmemiş', () => {
    // 31.10.2026 · Asıl düzeltme buydu. Üreticiyi silmek yetmez; onu çağıran
    // yükleyici dururken yarın yeni bir üreticiyle geri gelir.
    for(const yasak of ['loadBranchScopedItemsWithDemo', 'loadAllBranchScopedItemsWithDemo']){
      expect(
        new RegExp(`\\b${yasak}\\b`).test(yorumsuz(DEPO)),
        `${yasak} geri gelmiş. "Depo boşsa uydur" deseni budur.`,
      ).toBe(false)
    }
  })

  it('⚠️ "anahtar yoksa demo üret" deseni HİÇ KALMADI · çıcır kapandı', () => {
    // ⚠️ BU SINAMA 31.10'da ÜÇ HÂL DEĞİŞTİRDİ ve üçü de kayıtlı:
    //   1. "sıfır olmalı" diye yazıldı → KIRMIZI verdi, doğru verdi:
    //      desen gitmemiş, kiracı tarafından PLATFORM tarafına taşınmıştı.
    //   2. sekizde dondurulmuş bir ÇIÇIRA çevrildi (borç yazılı dursun).
    //   3. Emrah'ın kararıyla sekizi de boşaltıldı → çıcır KAPANDI.
    // Karar (31.10): "Boşalt, gerçeğe bağlanana kadar boş kalsın."
    const DESEN = /getItem\([^)]*\)\s*===\s*null\s*\?\s*createDemo[A-Za-z]+/g
    const kalan = [...yorumsuz(DEPO).matchAll(DESEN)].map(m => m[0].replace(/\s+/g, ' '))
    expect(kalan, `"anahtar yoksa demo üret" geri gelmiş:\n${kalan.join('\n')}`)
      .toEqual([])
  })

  it('⚠️ lisans KATALOĞU ad değiştirerek sayımdan kaçmadı', () => {
    // ⚠️ İki fonksiyon silinmedi, ADI DEĞİŞTİ:
    //   createDemoLicensePackages → varsayilanLisansPaketleri
    //   createDemoLicenseModules  → varsayilanLisansModulleri
    // Sebep: ikisi de uydurma KAYIT değil, ÜRÜN KATALOĞU — `defaultPackageSpecs`
    // sabitinden türüyorlar, yani MİYOP'un gerçekten sattığı planlar.
    //
    // ⚠️ Ama ad değiştirip sayımdan çıkmak, SAKLAMAK olabilirdi. Bu sınama
    // onu dürüst tutuyor: ikisi hâlâ DURMALI (silinmediler) ve `createDemo`
    // önekiyle GERİ GELMEMELİ (sayımdan kaçan üçüncü bir üretici olmasın).
    const kod = yorumsuz(DEPO)
    for(const ad of ['varsayilanLisansPaketleri', 'varsayilanLisansModulleri']){
      expect(new RegExp(`const ${ad}\\s*=`).test(kod), `${ad} kaybolmuş`).toBe(true)
    }
    for(const yasak of ['createDemoLicensePackages', 'createDemoLicenseModules']){
      expect(new RegExp(`const ${yasak}\\s*=`).test(kod), `${yasak} geri gelmiş`).toBe(false)
    }
  })


  it('⚠️ storage.ts DIŞINDAKİ üreticiler de sayılıyor', () => {
    // ⚠️ 31.10.2026 · BU TEST BİR AYDIR YALNIZ `storage.ts`e BAKIYORDU.
    // `tenant.ts` içindeki `createDemoTenants` hiç sayılmamıştı — yani
    // çıcırın kör noktasıydı. Aynı aile: denetim tarayıcısı da on tabloyu
    // görmüyordu (tuzak 154).
    const KIRACI = readFileSync(join(SRC, 'tenant.ts'), 'utf8') as string
    const disaridakiler = [...yorumsuz(KIRACI)
      .matchAll(/^\s*(?:export\s+)?const (createDemo[A-Za-z]+)\s*=/gm)].map(m => m[1])
    expect(
      disaridakiler,
      'tenant.ts içindeki üretici listesi değişti — bilerek mi?',
    ).toEqual(['createDemoTenants'])
  })

  it('şube ve firma okuyucuları demo üretimine DÜŞMÜYOR', () => {
    // ⚠️ Üreticiyi silmek yetmez, okuyucunun boş veriyi boş bırakması lazım.
    const subeOkuyucu = /const readBranchesFromStorage = \(\) => \{[\s\S]*?\n\}/.exec(DEPO)?.[0] ?? ''
    expect(subeOkuyucu, 'readBranchesFromStorage bulunamadı').not.toBe('')
    expect(yorumsuz(subeOkuyucu), 'şube okuyucu demo üretiyor').not.toMatch(/createDemo/)

    const firmaOkuyucu = /export const loadCompanies = [\s\S]*?\n\}/.exec(DEPO)?.[0] ?? ''
    expect(firmaOkuyucu, 'loadCompanies bulunamadı').not.toBe('')
    expect(yorumsuz(firmaOkuyucu), 'firma okuyucu demo üretiyor').not.toMatch(/createDemo/)
  })

  it('şube köprüsü veritabanında olmayan yerel şubeyi KORUMUYOR', () => {
    // ⚠️ MIYOP-058'in ikinci yarısı: üretici silinse de köprü eski demo
    // satırlarını her girişte geri kaydediyordu.
    const kopru = readFileSync(join(SRC, 'companies/company-bridge.ts'), 'utf8') as string
    expect(
      kopru,
      'company-bridge bu firmanın şubelerini veritabanından KESİN almıyor — '
      + 'eski demo şubeler yerel depoda yaşamaya devam eder'
    ).toMatch(/digerFirmalar/)
    expect(
      kopru,
      'köprü başka firmaların yerel satırlarını koruyor mu? (MIYOP-063 ailesi)'
    ).toMatch(/sube\.companyId !== firmaId/)
  })
})
