// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — YAZMA KAPILARI ARTIK TAM (0085)
//
// 0081 "yazma kapıları veritabanında" dedi ve YEDİ tetik kurdu. Codex
// denetimi (17.10.2026, MIYOP-001) geri kalanı buldu: stok defteri, stok
// kartı, lot, şecere, firma, şube, kullanıcı, şube erişimi ve kiracı
// tablolarına `authenticated` rolü doğrudan yazabiliyordu ve RLS yalnız
// "aynı işletme mi" diye soruyordu — İŞ İZNİ SORULMUYORDU.
//
// Yani ekranda hiçbir yazma düğmesi göremeyen `izleyici`, doğrudan REST
// çağrısıyla stok hareketi yazabiliyordu. Tarayıcıdaki `yazabilirMi()`
// bir güvenlik sınırı değildi; hiçbir zaman olmadı.
//
// Bu test o kapıların GERİ AÇILMAMASINI sağlıyor. Göç dosyalarını okuyor:
// bir tetik silinirse ya da izin gevşetilirse kırılıyor.
//
// ⚠️ Bu test SQL METNİNE bakar, davranışa değil. Davranış provası
// `db/prova/prova-0085.sql` içinde ve GERÇEK PostgreSQL üzerinde
// `authenticated` rolüne geçerek 39 doğrulama yapıyor. İkisi birlikte
// anlamlı; tek başına bu test "kapı çalışıyor" demez.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { gocMetni } from '../core/test-support/goc-tarama'

/** `db/prova/prova-*.sql` dosyalarının tam yolları. */
function provaDosyalari(): string[] {
  const kok = join(process.cwd(), 'db', 'prova')
  return readdirSync(kok)
    .filter(d => d.startsWith('prova-') && d.endsWith('.sql'))
    .map(d => join(kok, d))
}

const GOC = gocMetni()

/** 0085'in kurduğu tetikler: tablo → beklenen izin ya da özel fonksiyon. */
const YENI_KAPILAR: Array<{ tetik: string; tablo: string; kapi: string }> = [
  { tetik: 'izin_stock_movement',     tablo: 'stock_movement',     kapi: 'app.stok_hareketi_izni()' },
  { tetik: 'izin_app_user',           tablo: 'app_user',           kapi: 'app.kullanici_satiri_izni()' },
  // ⚠️ 0086: bu üçü 0085'te `izin_gerek('stock.write')` idi ve İKİ MEŞRU
  // AKIŞI KIRDI (Codex MIYOP-031, MIYOP-032). Artık kendi kapıları var.
  { tetik: 'izin_stock_item',         tablo: 'stock_item',         kapi: 'app.stok_karti_izni()' },
  { tetik: 'izin_stock_lot',          tablo: 'stock_lot',          kapi: 'app.lot_izni()' },
  { tetik: 'izin_lot_genealogy',      tablo: 'lot_genealogy',      kapi: 'app.lot_izni()' },
  { tetik: 'izin_company',            tablo: 'company',            kapi: "app.izin_gerek('company.manage')" },
  { tetik: 'izin_branch',             tablo: 'branch',             kapi: "app.izin_gerek('branch.manage')" },
  { tetik: 'izin_user_branch_access', tablo: 'user_branch_access', kapi: "app.izin_gerek('users.manage')" },
  { tetik: 'izin_tenant',             tablo: 'tenant',             kapi: "app.izin_gerek('company.manage')" }
]

/** 0081'in yedi kapısı. Silinmemeli. */
const ESKI_KAPILAR = [
  'izin_recipe', 'izin_recipe_line', 'izin_shipment', 'izin_shipment_line',
  'izin_haccp_measurement', 'izin_haccp_corrective_action', 'izin_stock_item_ambalaj',
  // 0087 · onay defteri append-only kalmalı
  'order_approval_degismez'
]

describe('0085 · yazma kapıları tam', () => {
  it('sağlama: göç metni okundu', () => {
    expect(GOC.length).toBeGreaterThan(50_000)
    expect(GOC).toContain('0085')
  })

  it('dokuz yeni tetik kurulmuş', () => {
    for(const { tetik, tablo, kapi } of YENI_KAPILAR){
      expect(GOC, `${tetik} tetiği yok`).toContain(`create trigger ${tetik}`)
      expect(GOC, `${tetik} yanlış tabloda`).toMatch(
        new RegExp(`create trigger ${tetik}[\\s\\S]{0,200}on public\\.${tablo}\\b`)
      )
      expect(GOC, `${tetik} yanlış kapıya bağlı`).toMatch(
        new RegExp(`create trigger ${tetik}[\\s\\S]{0,260}${kapi.replace(/[.()']/g, m => '\\' + m)}`)
      )
    }
  })

  it("0081'in yedi kapısı duruyor", () => {
    for(const tetik of ESKI_KAPILAR){
      expect(GOC, `${tetik} kayboldu`).toContain(`create trigger ${tetik}`)
    }
  })

  it('stok defteri kapısı SEBEBE bakıyor, tek izne değil', () => {
    // Tek izin yazmak meşru akışları kırardı: mal kabulü satın almacı da
    // yapabilir (`purchase.write`), üretim çıkışını üretimci
    // (`production.write`), sevki sevkiyatçı (`logistics.write`).
    expect(GOC).toContain('app.stok_hareketi_izni()')
    for(const parca of [
      "'PURCHASE\\_%'", "'PRODUCTION\\_%'", "'SHIPMENT\\_%'",
      "'purchase.write'", "'production.write'", "'logistics.write'", "'stock.write'"
    ]){
      expect(GOC, `stok kapısında ${parca} yok`).toContain(parca)
    }
  })

  it('genel kapı `anon`u artık geçirmiyor', () => {
    // 0081'de "auth.uid() null ise serbest" vardı; `anon` da null'dur.
    // 0082 `bakim_baglami()` yazdı ama yalnız HACCP tetiğine uyguladı.
    const govde = GOC.slice(GOC.indexOf('-- ── 1 · GENEL KAPI SERTLEŞİYOR'))
    expect(govde).toContain('if app.bakim_baglami() then')
    expect(govde.slice(0, 1200)).not.toContain('v_auth := auth.uid()')
  })

  it('kendi profilini düzenleme kapatılmamış', () => {
    expect(GOC).toContain("app.yetkim_var('users.manage')")
    expect(GOC).toContain("old.auth_user_id = v_auth")
  })

  it('tetik fonksiyonlarının PUBLIC kapısı elle kapatılmış (tuzak 67)', () => {
    for(const fn of ['stok_hareketi_izni', 'kullanici_satiri_izni']){
      // Hizalama boşlukları değişebilir; kalıp boşluğa duyarsız.
      const kalip = (hedef: string) =>
        new RegExp(`revoke all on function app\\.${fn}\\(\\)\\s+from ${hedef};`)
      expect(kalip('public').test(GOC), `${fn}: PUBLIC revoke yok`).toBe(true)
      expect(kalip('anon').test(GOC), `${fn}: anon revoke yok`).toBe(true)
    }
  })

  it('0086 · kalite beyanı ve lotlu mal kabulü kırılmamış', () => {
    // 0085 iki akışı kırdı; 0086 onardı. Testin işi ONARIMIN GERİ
    // ALINMAMASINI sağlamak.
    expect(GOC).toContain('app.stok_karti_izni()')
    expect(GOC).toContain('app.lot_izni()')

    // Stok kartı: beyan kolonları `quality.declaration` ile açılıyor,
    // kolon SAYILARAK değil JSON farkıyla (tuzak 79).
    expect(GOC).toContain("app.yetkim_var('quality.declaration')")
    expect(GOC).toContain('(to_jsonb(new) - v_beyan) = (to_jsonb(old) - v_beyan)')

    // Lot kapısı dört izinden birini kabul ediyor; mal kabulü yarıda kalmasın.
    const lotKapisi = GOC.slice(GOC.indexOf('create or replace function app.lot_izni()'))
      .slice(0, 1400)
    for(const izin of ['stock.write', 'purchase.write', 'production.write', 'logistics.write']){
      expect(lotKapisi, `lot kapısında ${izin} yok`).toContain(`'${izin}'`)
    }

    // 0081'in ambalaj tetiği HÂLÂ yerinde: iki kapı birlikte çalışıyor.
    expect(GOC).toContain('create trigger izin_stock_item_ambalaj')
  })

  it('0086 · kalite rollerine stok yetkisi verilmesi engelleniyor', () => {
    // "Kolay çözüm" diye kalite rolüne `stock.write` vermek, beyan
    // kapısının anlamını yok eder. Göç bunu doğrulama bloğunda sınıyor.
    expect(GOC).toContain("role_code = v_rol and permission_code = 'stock.write'")
    expect(GOC).toContain('dogru cozum beyani ayri yetkilendirmektir')
  })

  it('0087 · sipariş onayı başkası adına verilemiyor (MIYOP-002)', () => {
    expect(GOC).toContain('create trigger izin_order_approval')
    expect(GOC).toContain('app.onay_karari_izni()')

    // İmzayı SUNUCU atıyor; istemcinin gönderdiği kimlik ve tarih yok
    // sayılıyor (0081'in `completed_by` deseni).
    expect(GOC).toContain('new.decided_by := v_ben')
    expect(GOC).toContain('new.decided_at := now()')

    // Adımın izni `order_approval_step`ten OKUNUYOR, sabit yazılmıyor.
    expect(GOC).toContain('s.permission_code')
    expect(GOC).toContain('app.yetkim_var(v_adim.permission_code)')

    // Uydurma adım koduyla onay yazılamıyor.
    expect(GOC).toContain('Uydurma adim koduyla onay yazilamaz')

    // Zincirin AYARI yönetim işi: zorunlu adım kapatılamasın.
    expect(GOC).toMatch(
      /create trigger izin_order_approval_step[\s\S]{0,200}app\.izin_gerek\('settings\.manage'\)/
    )
  })

  it('doğrulama bloğu izleyici rolünü ayrıca sınıyor', () => {
    // Kapının anlamı "salt okunur rolün yazma izni yok" varsayımına bağlı.
    // Biri izleyiciye `stock.write` verirse kapı sessizce anlamsızlaşır.
    expect(GOC).toContain("role_code = 'izleyici'")
    expect(GOC).toContain('kapi anlamsizlasir')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 0088 · MIYOP-001'İN KALANI: 27 TABLO
//
// 0088'in tetikleri `do $$ ... execute format(...)` ile KURULUYOR, çünkü
// 26 tane elle yazmak 26 kopyala-yapıştır hatası fırsatı demek. Bunun
// bedeli: dosyada `create trigger izin_supplier` diye bir satır YOK.
// Dolayısıyla bu test TETİK METNİNE değil, EŞLEME TABLOSUNA bakıyor.
//
// Göçün kendi doğrulama bloğu (26 tetik sayılıyor, argümansız tetik
// aranıyor, izinler katalogda mı diye bakılıyor) gerçek veritabanında
// çalışıyor; davranış provası `db/prova/prova-0088.sql`, 40 doğrulama.
// ═══════════════════════════════════════════════════════════════════════════

/** 0088'in eşlemesi: tablo → kabul edilen izinler. Prova ile aynı liste. */
const YIRMI_YEDI: Array<[string, string[]]> = [
  ['supplier',              ['purchase.write']],
  ['purchase_request',      ['purchase.write']],
  ['purchase_request_line', ['purchase.write']],
  ['purchase_order',        ['purchase.write']],
  ['purchase_order_line',   ['purchase.write']],
  // Mal kabul ve iade iki rolün işi (tuzak 88)
  ['goods_receipt',         ['purchase.write', 'stock.write']],
  ['goods_receipt_line',    ['purchase.write', 'stock.write']],
  ['supplier_return',       ['purchase.write', 'stock.write']],
  ['supplier_return_line',  ['purchase.write', 'stock.write']],
  ['work_order',            ['production.write']],
  ['work_order_line',       ['production.write']],
  // Limit değiştirmek ölçüm girmek değildir
  ['haccp_plan',            ['quality.record.manage']],
  ['haccp_ccp',             ['quality.record.manage']],
  ['stock_count',           ['stock.write']],
  ['stock_count_line',      ['stock.write']],
  ['customer',              ['operations.write']],
  ['delivery_point',        ['operations.write']],
  ['customer_price',        ['operations.write']],
  ['sales_order',           ['operations.write']],
  ['sales_order_revision',  ['operations.write']],
  ['sales_order_line',      ['operations.write']],
  ['order_discrepancy',     ['operations.write']],
  ['portal_user',           ['operations.write']],
  ['portal_user_point',     ['operations.write']],
  ['vehicle',               ['logistics.write']],
  ['driver',                ['logistics.write']],
  // 27. tablo · Codex listesinde yoktu; "kapısız yüzey" ölçümü buldu.
  // 0072 alerjen beyanını kapatırken besin değeri tablosunu atlamış.
  ['stock_item_nutrition',  ['quality.declaration', 'products.write', 'stock.write']]
]

describe('0088 · kalan 27 tablonun kapısı', () => {
  it('sağlama: 27 satır, tekrar yok', () => {
    expect(YIRMI_YEDI).toHaveLength(27)
    expect(new Set(YIRMI_YEDI.map(([t]) => t)).size).toBe(27)
  })

  it('çoklu izin kapısı var ve argümansız kurulursa patlıyor', () => {
    expect(GOC).toContain('create or replace function app.izin_gerek_coklu()')
    expect(GOC).toContain('if tg_nargs = 0 then')
    expect(GOC).toContain('foreach v_izin in array tg_argv loop')

    // ⚠️ Argüman kontrolü BAKIM BAĞLAMINDAN ÖNCE olmalı. Sonra olursa
    // argümansız bir tetik göç sırasında sessizce geçer.
    const govde = GOC.slice(GOC.indexOf('create or replace function app.izin_gerek_coklu()'))
      .slice(0, 1600)
    expect(govde.indexOf('tg_nargs = 0'))
      .toBeLessThan(govde.indexOf('app.bakim_baglami()'))
  })

  it('her tablo eşlemede ve doğru izinlerle', () => {
    const esleme = GOC.slice(GOC.indexOf("v_eslesme jsonb := jsonb_build_object"))
    const kes = esleme.slice(0, esleme.indexOf('  );') + 4)
    for(const [tablo, izinler] of YIRMI_YEDI){
      const satir = new RegExp(
        `'${tablo}',\\s*'\\[${izinler.map(i => `"${i}"`).join(',')}\\]'`
      )
      expect(satir.test(kes), `${tablo} eşlemede yok ya da izni değişmiş`).toBe(true)
    }
  })

  it('göç KAPI SAYMIYOR, KAPISIZ YÜZEY ölçüyor', () => {
    // 0085'te "MIYOP-001 kapandı" dedim çünkü taktığım kapıları saydım.
    // Yanlıştı. 0088 bunun yerine `authenticated` rolüne yazma hakkı
    // olup kapısı olmayan tablo KALDI MI diye soruyor ve 0 bekliyor.
    expect(GOC).toContain("a.grantee = 'authenticated'::regrole")
    expect(GOC).toContain('rolune acik ama kapisiz % tablo kaldi')
  })

  it('eşleme bayatlarsa göç SESSİZCE GEÇMİYOR', () => {
    // Tablo silinirse / adı değişirse tetik kurulamaz; göç patlamalı.
    expect(GOC).toContain('tablosu yok. Esleme bayatlamis.')
    expect(GOC).toContain('27 tetik bekleniyordu')
  })

  it('MIYOP-035 · yeni kart sahte alerjen damgasıyla açılamıyor', () => {
    // 0072'nin koruması yalnız UPDATE'teydi; INSERT açık kalmıştı.
    // ⚠️ SON sürüme bakılıyor: 0086 kapıyı kurdu, 0088 üstüne INSERT
    // kontrolü ekledi. `lastIndexOf` ile son tanımı buluyoruz; bloğu
    // `$$;` ile kapatıyoruz ki göçün doğrulama bölümü karışmasın.
    const bas = GOC.lastIndexOf('create or replace function app.stok_karti_izni()')
    expect(bas).toBeGreaterThan(-1)
    const sonSurum = GOC.slice(bas, GOC.indexOf('$$;', bas) + 3)
    expect(sonSurum).toContain("tg_op = 'INSERT'")
    expect(sonSurum).toContain('new.allergen_reviewed_at is not null')
    expect(sonSurum).toContain('new.allergen_reviewed_by is not null')
    expect(sonSurum).toContain("errcode = 'MI436'")

    // 0086'nın beyan kapısı korunuyor (tuzak 79 deseni duruyor).
    expect(sonSurum).toContain('(to_jsonb(new) - v_beyan) = (to_jsonb(old) - v_beyan)')
  })

  it('çoklu kapının PUBLIC hakkı elle kapatılmış (tuzak 67)', () => {
    expect(/revoke all on function app\.izin_gerek_coklu\(\)\s+from public;/.test(GOC)).toBe(true)
    expect(/revoke all on function app\.izin_gerek_coklu\(\)\s+from anon;/.test(GOC)).toBe(true)
  })

  it('göçün PUBLIC taraması `proacl` NULL iken de görüyor (tuzak 80)', () => {
    expect(GOC).toContain("aclexplode(coalesce(p.proacl, acldefault('f', p.proowner)))")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// MIYOP-037 · PROVANIN KENDİSİ YALAN SÖYLEMESİN
//
// `prova-0086.sql` içinde bir blok `exception when others` kullanıyordu ve
// iddianın KENDİ hatasını yutuyordu: başarısızlık yeşile dönüyordu. Bu
// test aynı desenin provalara geri sızmasını engelliyor.
// ═══════════════════════════════════════════════════════════════════════════
describe('provalar yanlış yeşil vermiyor', () => {
  it('hiçbir provada `when others` iddiayı yutmuyor', () => {
    const kalip = /begin\s*\n((?:(?!\bbegin\b)[\s\S])*?)exception\s+when\s+others\s+then\s*\n?([\s\S]*?)\n\s*end;/g
    const suclular: string[] = []
    for(const dosya of provaDosyalari()){
      const metin = readFileSync(dosya, 'utf8')
      for(const m of metin.matchAll(kalip)){
        if(m[1].includes('false)') && m[2].includes('true)')){
          suclular.push(basename(dosya))
        }
      }
    }
    expect(suclular, `yanlış yeşil riski: ${suclular.join(', ')}`).toEqual([])
  })
})
