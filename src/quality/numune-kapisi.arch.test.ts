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
