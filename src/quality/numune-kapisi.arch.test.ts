// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — NUMUNE KAPISI İKİ YERDE AYNI
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────
// Şahit numune kapısı İKİ yerde duruyor ve bu bilinçli:
//   · `db/migrations/0093_sahit_numune.sql` — asıl kapı
//     (`app.izin_gerek_coklu('quality.record.manage', 'production.write')`).
//     Ekranı atlayıp doğrudan istek gönderen de MI403 alır.
//   · `src/authorization/yazma-yetkisi.ts > NUMUNE_IZINLERI` — o kapının
//     ekrandaki yüzü. Yetkisi olmayana çalışmayacak düğme gösterilmiyor.
//
// ⚠️ İki yerde duran bir liste bir gün ayrışır. Ayrıştığında ortaya iki
// davranıştan biri çıkar: ekran düğmeyi gösterir ama sunucu reddeder
// (kullanıcı sebebini anlamaz), ya da ekran düğmeyi gizler ama yetkili kişi
// işini yapamaz. Bu test ikisinin AYNI kaldığını ÖLÇÜYOR; "ikisini birlikte
// değiştirmeyi unutmayın" diye not bırakmak yetmez (tuzak 103 ailesi).
//
// ⚠️ SAYMAK DEĞİL ÖLÇMEK: liste göç dosyasından AYRIŞTIRILIYOR, elle
// kopyalanmıyor. Elle kopyalanan bir beklenti, ölçtüğünü sandığı şeyi
// ölçmez — kendisini ölçer.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'
import { NUMUNE_IZINLERI } from '../authorization/yazma-yetkisi'
import { gerekceYeterliMi, numuneKoduYeterliMi } from './witness-sample.service'
import { readFileSync as oku } from 'node:fs'

const KOK = projeKokunuBul()
const GOC_0093 = readFileSync(
  join(KOK, 'db/migrations/0093_sahit_numune.sql'), 'utf8') as string
const GOC_0094 = readFileSync(
  join(KOK, 'db/migrations/0094_numune_kiraci_siniri.sql'), 'utf8') as string
const GOC_0097 = readFileSync(
  join(KOK, 'db/migrations/0097_numune_imhasi_onaydir.sql'), 'utf8') as string

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ 08.11.2026 · ÖLÇÜM TEK BİR GÖÇ DOSYASINA BAKMIYOR ARTIK.
// İlk hâli `GOC_0093`e bakıyordu. 0108 kapıyı değiştirince o ölçüm, ARTIK
// GEÇERLİ OLMAYAN bir göçün hâlini savunmaya başlardı — tuzak 190'ın ta
// kendisi (54 provanın 13'ü tam böyle bayatlamıştı). Artık bütün göçler
// SIRAYLA taranıyor ve SONUNCU tanım alınıyor: kapı hangi göçte
// değişirse değişsin, ölçüm onu bulur.
// ═══════════════════════════════════════════════════════════════════════════
const GOC_KLASORU = join(KOK, 'db/migrations')

const gocDosyalari = (): string[] =>
  readdirSync(GOC_KLASORU).filter(a => /^[0-9]{4}_.+\.sql$/.test(a)).sort()

/** Bir tetiğin EN SON kurulduğu göçteki `izin_gerek_coklu` izinleri. */
const etkinTetikIzinleri = (tablo: string): { izinler: string[]; goc: string } => {
  let sonuc = { izinler: [] as string[], goc: '' }
  for(const ad of gocDosyalari()){
    const sql = readFileSync(join(GOC_KLASORU, ad), 'utf8') as string
    const yer = sql.indexOf(`create trigger izin_${tablo}`)
    if(yer < 0) continue
    const parca = sql.slice(yer, yer + 600)
    const cagri = /izin_gerek_coklu\(([^)]*)\)/.exec(parca)?.[1] ?? ''
    const izinler = [...cagri.matchAll(/'([a-z_.]+)'/g)].map(m => m[1] as string).sort()
    if(izinler.length > 0) sonuc = { izinler, goc: ad }
  }
  return sonuc
}

/** Bir `app` fonksiyonunun EN SON yazıldığı göç dosyasının metni. */
const etkinFonksiyon = (ad: string): { metin: string; goc: string } => {
  let sonuc = { metin: '', goc: '' }
  for(const dosya of gocDosyalari()){
    const sql = readFileSync(join(GOC_KLASORU, dosya), 'utf8') as string
    if(sql.includes(`create or replace function app.${ad}()`)) sonuc = { metin: sql, goc: dosya }
  }
  return sonuc
}

// ═══════════════════════════════════════════════════════════════════════════
// MIYOP-080 · SAYIM SINIRI İKİ YERDE AYNI OLMALI
//
// "Süresi dolmuş" kararı ÜÇ yerde veriliyor ve üçü aynı günü kastetmek
// zorunda:
//   · `witness-sample.service.ts > suresiDolduMu()` → `bugun > saklamaSonu`
//   · depo: numune listesi süzgeci                  → `.lt('keep_until', …)`
//   · depo: imha bekleyen SAYIMI                    → `.lt('keep_until', …)`
//
// ⚠️ Biri `lte`ye dönerse saklama sonu GÜNÜNDEKİ numune "süresi dolmuş"
// sayılır — SKT kapısının (0092) kararına da aykırı olur. Üçünü birlikte
// tutmanın yolu not değil ölçüm.
// ═══════════════════════════════════════════════════════════════════════════
describe('numune sayım sınırı · saklama sonu GÜNÜ hâlâ süre içinde', () => {
  const DEPO = oku(join(KOK, 'src/quality/witness-sample.repository.ts'), 'utf8') as string

  it('depo `lt` kullanıyor, `lte` DEĞİL', () => {
    const ltSayisi = (DEPO.match(/\.lt\('keep_until'/g) ?? []).length
    expect(ltSayisi, 'keep_until süzgeci bulunamadı').toBeGreaterThanOrEqual(2)
    expect(DEPO, '`lte` kullanılmış: saklama sonu günü süresi dolmuş sayılır')
      .not.toMatch(/\.lte\('keep_until'/)
  })

  it('liste süzgeci ile SAYIM süzgeci aynı', () => {
    // ⚠️ İkisi ayrışırsa sayı ile liste birbirini tutmaz ve hangisinin
    // doğru olduğu söylenemez.
    const desen = /neq\('status', 'IMHA'\)\s*\.lt\('keep_until', bugun/g
    const dusuk = /neq\('status', 'IMHA'\)\.lt\('keep_until', bugununGunu\(\)\)/g
    const toplam = (DEPO.match(desen) ?? []).length + (DEPO.match(dusuk) ?? []).length
    expect(toplam, 'liste ve sayım süzgeçleri aynı ifadeyi kullanmıyor')
      .toBeGreaterThanOrEqual(2)
  })

  it('sayfa sınırları ADIYLA duruyor (gömülü sayı değil)', () => {
    expect(DEPO).toMatch(/export const NUMUNE_SAYFA = \d+/)
    expect(DEPO).toMatch(/export const PARTI_SAYFA = \d+/)
  })
})

describe('numune kapısı · göç ile ekran aynı izinleri istiyor', () => {
  it('sağlama: göç dosyaları okundu', () => {
    expect(GOC_0093.length).toBeGreaterThan(1000)
    expect(GOC_0094.length).toBeGreaterThan(1000)
    expect(GOC_0097.length).toBeGreaterThan(1000)
  })

  it('sağlama: ETKİN tanım gerçekten bulunuyor (ölçüm boşlukta yeşil yanmıyor)', () => {
    const tetik = etkinTetikIzinleri('witness_sample')
    expect(tetik.izinler.length, 'etkin tetik izinleri boş').toBeGreaterThan(0)
    const fn = etkinFonksiyon('numune_olayi_izni')
    expect(fn.metin.length, 'etkin olay kapısı bulunamadı').toBeGreaterThan(1000)
    // ⚠️ Etkin tanım 0093/0097'den SONRAKİ bir göçte olabilir; olması da
    // gerekir çünkü kapı 0108'de değişti. Ölçümün hangi göçe baktığı
    // kırmızıda görünsün diye adı da iddiada.
    expect(tetik.goc >= '0093', `tetik etkin göcü: ${tetik.goc}`).toBe(true)
    expect(fn.goc >= '0097', `olay kapısı etkin göcü: ${fn.goc}`).toBe(true)
  })

  it('numune tablosunun kapısı ekrandaki listeyle aynı (ETKİN göçten)', () => {
    const { izinler: gocteki, goc } = etkinTetikIzinleri('witness_sample')
    expect(gocteki, 'hiçbir göçte izin_witness_sample tetiği bulunamadı').not.toEqual([])
    expect(goc, 'etkin göç adı okunamadı').toMatch(/^[0-9]{4}_/)
    expect(
      gocteki,
      'Göç ile ekran farklı izin listesi taşıyor.\n'
      + `göç   : ${gocteki.join(', ')}\n`
      + `ekran : ${[...NUMUNE_IZINLERI].sort().join(', ')}`,
    ).toEqual([...NUMUNE_IZINLERI].sort())
  })

  it("olay defterinin KAPISI 0097'de OLAY TİPİNE GÖRE ayrıştı", () => {
    // ⚠️ 26.10.2026 · BU SINAMA "olay defteri de aynı listede" DİYORDU ve
    // 0097'den sonra artık doğru değil. Emrah'ın kararıyla imha bir ONAY
    // işi oldu: `app.numune_olayi_izni()` olay tipine bakıyor ve 0093'ün
    // gevşek tetiği (`izin_witness_sample_event`) DÜŞÜRÜLDÜ.
    //
    // ⚠️ İki kapı birlikte dururken istek EN GEVŞEK kapıdan geçer; bu
    // yüzden eskisinin gittiğini de ölçüyoruz, yenisinin geldiğini de.
    expect(GOC_0097, 'eski gevşek tetik düşürülmemiş')
      .toMatch(/drop trigger if exists izin_witness_sample_event/)
    expect(GOC_0097, 'yeni kapı bağlanmamış')
      .toMatch(/create trigger izin_numune_olayi/)
    expect(GOC_0097, 'kapı olay tipine göre ayrışmıyor')
      .toMatch(/new\.event_type = 'IMHA'/)
  })

  it('İMHA dar kapıda: yalnız quality.record.manage', () => {
    // ⚠️ Göçün gövdesinden ÖLÇÜLÜYOR, elle kopyalanmıyor. İmha bloğunda
    // `production.write` geçerse üretim sorumlusu yine imha edebilir demek
    // olurdu — kararın tersi.
    // ⚠️ DAL'ın TAMAMI alınıyor, ilk `end if;`e kadar DEĞİL. İçteki
    // `if ... then return new; end if;` yüzünden lazy bir eşleşme dalın
    // yalnız ilk satırını yakalar; sıralama değişse fark edilmezdi
    // (tuzak 80: bulamadığı için sessiz kalan kontrol).
    const ETKIN = etkinFonksiyon('numune_olayi_izni').metin
    const imhaBasi = ETKIN.indexOf("if new.event_type = 'IMHA' then")
    const ortakIs = ETKIN.indexOf('ALINDI ve ACILDI · ORTAK İŞ')
    expect(imhaBasi, 'etkin göçte imha dalı bulunamadı').toBeGreaterThan(-1)
    expect(ortakIs, 'etkin göçte ortak iş bloğu bulunamadı').toBeGreaterThan(imhaBasi)
    const imhaBlogu = ETKIN.slice(imhaBasi, ortakIs)
    expect(imhaBlogu, 'imha kapısı quality.record.manage istemiyor')
      .toMatch(/quality\.record\.manage/)
    expect(
      imhaBlogu,
      'imha kapısında production.write var — üretim sorumlusu numuneyi '
      + "imha edebilir demek olur, Emrah'ın kararı bunu dışlıyordu",
    ).not.toMatch(/production\.write/)
  })

  it('ALINDI ve ACILDI hâlâ ORTAK İŞ — ekrandaki listeyle aynı', () => {
    // ⚠️ İmhayı daraltırken numune ALMAYI da daraltmak, üretimi akıştan
    // çıkarmak olurdu (İsmet: "üretim her ürettiği partiden numune alıyor").
    // Dar kapıdan SONRAKİ blok iki izni de taşımalı.
    // ⚠️ Başlık yorumunda da "ALINDI ve ACILDI" geçiyor; ölçüm GÖVDEDEKİ
    // bloğa bakmalı, yorumun kendisine değil.
    const ETKIN = etkinFonksiyon('numune_olayi_izni').metin
    const ortakIs = ETKIN.indexOf('ALINDI ve ACILDI · ORTAK İŞ')
    expect(ortakIs, 'ortak iş bloğu bulunamadı').toBeGreaterThan(-1)
    const sonrasi = ETKIN.slice(ortakIs, ETKIN.indexOf('revoke all on function'))
    for(const izin of NUMUNE_IZINLERI){
      expect(sonrasi, `${izin} ortak iş kapısında yok`).toContain(izin)
    }
  })

  it("numune ALMA kapısı 0093'te açıldı, 0108'de DARALDI", () => {
    // ⚠️ 08.11 · BU SINAMA "0093'te DEĞİŞMEDEN duruyor" DİYORDU ve artık
    // doğru değil: 0108 `production.write`ı çıkarıp `quality.write`
    // koydu (Emrah kararı · `personel` numuneye karışmasın).
    // Bir sınama, geçersiz bir göcün hâlini savunmaya başladığı anda
    // ölçüm olmaktan çıkar (tuzak 190).
    //
    // Ölçüm artık ETKİN tanıma bakıyor: 0093 kapıyı AÇTI, 0108 DARALTTI.
    const { izinler, goc } = etkinTetikIzinleri('witness_sample')
    expect(izinler, `etkin göç: ${goc}`).toEqual([...NUMUNE_IZINLERI].sort())
    expect(GOC_0093, "0093 kapıyı ilk kuran göç olmalı")
      .toMatch(/create trigger izin_witness_sample/)
  })

  it("⚠️ `production.write` numune kapısından ÇIKTI (0108 · Emrah kararı)", () => {
    // Gerekçe: 0107 okuma kapısını ekranla eşitleyince `production.write`
    // taşıyıp `quality.read` taşımayan tek rolün `personel` olduğu
    // ölçüldü — yazabiliyor ama yazdığını göremiyordu.
    // ⚠️ Doğrudan silinmedi: silmek üretim sorumlusunu da dışarıda
    // bırakırdı. `quality.write` üretimi içeriyor, personeli içermiyor.
    expect([...NUMUNE_IZINLERI], 'ekran listesinde production.write kalmış')
      .not.toContain('production.write')
    expect([...NUMUNE_IZINLERI], 'ekran listesinde quality.write yok')
      .toContain('quality.write')
    const { izinler } = etkinTetikIzinleri('witness_sample')
    expect(izinler, 'veritabanı kapısında production.write kalmış')
      .not.toContain('production.write')
  })

  it('depocu bu listede YOK', () => {
    // İsmet "depocu kontrolünde" dedi; kontrol fiziksel sorumluluktur.
    // `stock.write` eklenmesi, depocunun tek başına numune açması olurdu.
    expect([...NUMUNE_IZINLERI]).not.toContain('stock.write')
  })

  it('0094 kiracı sınırını ve satır kilidini gerçekten yazıyor', () => {
    // ⚠️ Bu dört satır bir P0'ın (MIYOP-075) kapandığının ölçüsü. Göç
    // gövdesinden silinirse test kırılır; yorum olarak kalması yetmez.
    expect(GOC_0094, 'numune_olayi kiracıyı sunucudan okumuyor')
      .toMatch(/s\.tenant_id = v_kiraci/)
    expect(GOC_0094, 'durum okumasında satır kilidi yok (MIYOP-077)')
      .toMatch(/for update/i)
    expect(GOC_0094, 'parti kiracısı doğrulanmıyor')
      .toMatch(/v_lot_kiraci is distinct from v_kiraci/)
    expect(GOC_0094, 'açılışta saklama sonu least() ile kısaltılmıyor')
      .toMatch(/least\(s\.keep_until/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ SQL YORUMLARI ÖLÇÜMDEN ÖNCE SİLİNİYOR (TUZAK 181 · bu depoda 5. kez).
// Göçler kaldırılan kodu bilerek kelime kelime alıntılıyor: 0109'un
// başlığında eski `coalesce(new.occurred_at, now())` satırı YORUM olarak
// duruyor. Ham metne bakan bir iddia kendi açıklamasına takılır.
// ═══════════════════════════════════════════════════════════════════════════
const sqlKod = (metin: string): string => metin.replace(/--[^\n]*/g, '')

/**
 * Bir `app` fonksiyonunun YALNIZ GÖVDESİ, göç dosyasının geri kalanı değil.
 *
 * ⚠️ BU SATIR BİR HATANIN BEDELİ (08.11.2026). İlk hâlinde bu blok göç
 * dosyasının TAMAMINA bakıyordu ve "`coalesce(new.occurred_at …)` kalmadı"
 * iddiası KIRMIZI yanıyordu — çünkü 0109'un kendi DOĞRULAMA bloğundaki
 * HATA MESAJI o metni kelimesi kelimesine içeriyor:
 *     '0109 DOGRULAMA: coalesce(new.occurred_at, ...) hala duruyor; …'
 * Yorumları silmek yetmiyor: yasağı ANLATAN bir dize de yasağın ihlali
 * sayılıyordu. Tuzak 181'in kardeşi — ölçüm, ölçtüğü SINIRI kendisi
 * söylemek zorunda.
 */
const etkinFonksiyonGovdesi = (ad: string): { govde: string; goc: string } => {
  const f = etkinFonksiyon(ad)
  if(f.metin === '') return { govde: '', goc: '' }
  const bas = f.metin.lastIndexOf(`create or replace function app.${ad}()`)
  const son = f.metin.indexOf('end $$;', bas)
  if(bas < 0 || son < 0) return { govde: '', goc: f.goc }
  return { govde: sqlKod(f.metin.slice(bas, son + 'end $$;'.length)), goc: f.goc }
}

/**
 * Bir kısıtın EN SON yazıldığı tanım metni.
 *
 * ⚠️ Tek göçe bakmak tuzak 190: kısıt 0093'te doğdu, 0100 ve 0111 onu
 * yeniden yazdı. Ölçüm son tanımı bulmak zorunda; yoksa artık geçerli
 * olmayan bir hâli savunur.
 */
const etkinKisit = (ad: string): { tanim: string; goc: string } => {
  let sonuc = { tanim: '', goc: '' }
  for(const dosya of gocDosyalari()){
    const sql = sqlKod(readFileSync(join(GOC_KLASORU, dosya), 'utf8') as string)
    const re = new RegExp(`add constraint ${ad} check \\(([\\s\\S]*?)\\);`, 'g')
    let m: RegExpExecArray | null
    let son = ''
    while((m = re.exec(sql)) !== null) son = m[1] as string
    if(son !== '') sonuc = { tanim: son, goc: dosya }
  }
  return sonuc
}

// ═══════════════════════════════════════════════════════════════════════════
// MIYOP-101 · OLAY ZAMANI İSTEMCİDEN GELMEZ
//
// 0094 saklama sonunu `coalesce(new.occurred_at, now())` ile hesaplıyordu.
// `occurred_at` istemciden yazılabilen bir kolon olduğu için gelecek bir
// tarih gönderen istemci için `least()` eski değeri seçiyor ve açılmış
// numunenin saklama sonu HİÇ KISALMIYORDU (0109 ile onarıldı; ölçüm
// çıktısı o göçün başlığında).
// ═══════════════════════════════════════════════════════════════════════════
describe('numune olay zamanı · sunucu damgası (MIYOP-101)', () => {
  const OLAY = etkinFonksiyonGovdesi('numune_olayi')

  it('sağlama · ölçüm gerçekten bir göç ve bir gövde buldu', () => {
    expect(OLAY.goc, 'app.numune_olayi() hiçbir göçte bulunamadı').not.toBe('')
    expect(OLAY.govde.length, 'gövde kesilemedi').toBeGreaterThan(200)
    // Kesimin doğru yeri: gövde kendi `create` satırıyla başlıyor.
    expect(OLAY.govde.startsWith('create or replace function app.numune_olayi()')).toBe(true)
  })

  it('⚠️ olay zamanı KOŞULSUZ damgalanıyor', () => {
    expect(OLAY.govde).toMatch(/new\.occurred_at\s*:=\s*now\(\)/)
  })

  it('⚠️ `coalesce(new.occurred_at, …)` kalmadı — kusurun ta kendisi', () => {
    // Kolon NOT NULL olduğu için `coalesce` istemcinin gönderdiği değeri
    // SEÇER. Yani yazılmış ama çalışmayan bir korumaydı.
    expect(OLAY.govde).not.toMatch(/coalesce\s*\(\s*new\.occurred_at/)
  })

  it('0094’ün kapıları hâlâ yerinde (onarırken düşmemiş)', () => {
    const k = OLAY.govde
    expect(k, 'kiracı sınırı düştü (MIYOP-075)').toContain('app.current_tenant_id()')
    expect(k, 'satır kilidi düştü (MIYOP-077)').toMatch(/for\s+update/i)
    expect(k, 'least() düştü · saklama sonu uzayabilir').toContain('least')
    expect(k, 'açık raf ömrü okunmuyor (MIYOP-076)').toContain('opened_shelf_life_days')
  })

  it('⚠️ depo olay yazarken `occurred_at` GÖNDERMİYOR', () => {
    // Sunucu damgası bir alanı yok sayıyorsa, o alanı gönderen kod
    // okuyucuyu yanıltır: gönderildiği sanılır.
    //
    // ⚠️ ÇAPA `async olayYaz`, sadece `olayYaz` DEĞİL. İlk hâli
    // `indexOf('olayYaz')` ile ARAYÜZ BİLDİRİMİNİ buluyordu (satır 160)
    // ve oradan 900 karakter, gerçek `insert`e (satır 421) HİÇ ulaşmıyordu:
    // test yeşil yanıyor ama hiçbir şey ölçmüyordu. Yanlış yeşil, yanlış
    // kırmızı kadar zarar verir.
    const depo = oku(join(KOK, 'src/quality/witness-sample.repository.ts'), 'utf8') as string
    const yer = depo.indexOf('async olayYaz')
    expect(yer, 'olayYaz gerçekleştirimi bulunamadı').toBeGreaterThan(-1)
    const govde = depo.slice(yer, yer + 900)
    // Sağlama: kesim gerçekten yazma çağrısını kapsıyor.
    expect(govde, 'kesim insert çağrısını kapsamıyor').toContain('.insert(')
    expect(govde).not.toContain('occurred_at')
  })

  it('prova ve ters prova var, rol takıyor, veritabanını kirletmiyor', () => {
    for(const p of ['db/prova/prova-0109.sql', 'db/prova/prova-0109-ters.sql']){
      const metin = oku(join(KOK, p), 'utf8') as string
      expect(metin, `${p} rol takmıyor (MIYOP-042)`).toContain('set local role authenticated')
      expect(metin.trimEnd().endsWith('rollback;'), `${p} rollback ile bitmiyor`).toBe(true)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// MIYOP-105 · METİN EŞİKLERİ EKRAN İLE VERİTABANINDA AYNI OLMALI
//
// Ekran gerekçeyi 3, numune kodunu 2 karakterden kısa kabul etmiyor ve bu
// kuralı gerçekten uyguluyor (`SahitNumune.tsx`). Veritabanı ise yalnız
// "boş olmasın" diyordu: API'den yazan biri gerekçe yerine `.` koyup
// geçebiliyordu. 0111 iki tarafı eşitledi.
//
// ⚠️ EŞİK SAYISI ELLE YAZILMIYOR: ekranın kendi fonksiyonundan ÖLÇÜLÜYOR.
// Elle yazılan bir beklenti, ölçtüğünü sandığı şeyi değil kendisini ölçer.
// ═══════════════════════════════════════════════════════════════════════════
describe('numune metin eşikleri · ekran ile veritabanı aynı (MIYOP-105)', () => {
  /** Fonksiyonun kabul ettiği EN KISA uzunluk — davranışla ölçülüyor. */
  const enKisaKabul = (yeterliMi: (m: string | undefined) => boolean): number => {
    for(let n = 1; n <= 10; n++){
      if(yeterliMi('a'.repeat(n))) return n
    }
    return 0
  }

  const KOD_ESIGI = enKisaKabul(numuneKoduYeterliMi)
  const GEREKCE_ESIGI = enKisaKabul(gerekceYeterliMi)

  it('sağlama · eşikler gerçekten ölçüldü', () => {
    expect(KOD_ESIGI, 'numune kodu eşiği ölçülemedi').toBeGreaterThan(0)
    expect(GEREKCE_ESIGI, 'gerekçe eşiği ölçülemedi').toBeGreaterThan(0)
    // Boşluk eşiği geçmemeli: `trim` olmadan ölçüm anlamsız olurdu.
    expect(numuneKoduYeterliMi('  ')).toBe(false)
    expect(gerekceYeterliMi('   ')).toBe(false)
  })

  it('⚠️ numune kodu kısıtı ekranın eşiğiyle aynı', () => {
    const k = etkinKisit('witness_sample_code_not_blank')
    expect(k.goc, 'kısıt hiçbir göçte bulunamadı').not.toBe('')
    expect(k.tanim).toContain(`>= ${KOD_ESIGI}`)
  })

  it('⚠️ gerekçe kısıtı ekranın eşiğiyle aynı', () => {
    const k = etkinKisit('witness_sample_event_reason_required')
    expect(k.goc, 'kısıt hiçbir göçte bulunamadı').not.toBe('')
    expect(k.tanim).toContain(`>= ${GEREKCE_ESIGI}`)
    // `ALINDI` muafiyeti: numune almanın gerekçesi yoktur.
    expect(k.tanim).toContain('ALINDI')
  })

  it('⚠️ açılış sonucu kısıtı ekranın eşiğiyle aynı', () => {
    // Ekran sonuç için de `gerekceYeterliMi` kullanıyor (SahitNumune.tsx).
    const k = etkinKisit('witness_sample_event_result_required')
    expect(k.goc, 'kısıt hiçbir göçte bulunamadı').not.toBe('')
    expect(k.tanim).toContain(`>= ${GEREKCE_ESIGI}`)
    // Yalnız `ACILDI` için: `IMHA`nın sonucu gerekçesinin içinde.
    expect(k.tanim).toContain('ACILDI')
  })

  it('prova var, rol takıyor, veritabanını kirletmiyor', () => {
    const metin = oku(join(KOK, 'db/prova/prova-0111.sql'), 'utf8') as string
    expect(metin).toContain('set local role authenticated')
    expect(metin.trimEnd().endsWith('rollback;')).toBe(true)
  })
})
