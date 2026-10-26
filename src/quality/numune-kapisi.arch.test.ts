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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'
import { NUMUNE_IZINLERI } from '../authorization/yazma-yetkisi'

const KOK = projeKokunuBul()
const GOC_0093 = readFileSync(
  join(KOK, 'db/migrations/0093_sahit_numune.sql'), 'utf8') as string
const GOC_0094 = readFileSync(
  join(KOK, 'db/migrations/0094_numune_kiraci_siniri.sql'), 'utf8') as string
const GOC_0097 = readFileSync(
  join(KOK, 'db/migrations/0097_numune_imhasi_onaydir.sql'), 'utf8') as string

/** Göçteki `izin_gerek_coklu('a', 'b')` çağrılarından izin adlarını çıkarır. */
const gocIzinleri = (sql: string, tablo: string): string[] => {
  const yer = sql.indexOf(`izin_${tablo} on public.${tablo}`)
  if(yer < 0) return []
  const parca = sql.slice(yer, yer + 600)
  const cagri = /izin_gerek_coklu\(([^)]*)\)/.exec(parca)?.[1] ?? ''
  return [...cagri.matchAll(/'([a-z_.]+)'/g)].map(m => m[1] as string).sort()
}

describe('numune kapısı · göç ile ekran aynı izinleri istiyor', () => {
  it('sağlama: göç dosyaları okundu', () => {
    expect(GOC_0093.length).toBeGreaterThan(1000)
    expect(GOC_0094.length).toBeGreaterThan(1000)
    expect(GOC_0097.length).toBeGreaterThan(1000)
  })

  it('numune tablosunun kapısı ekrandaki listeyle aynı', () => {
    const gocteki = gocIzinleri(GOC_0093, 'witness_sample')
    expect(gocteki, 'göçte izin_witness_sample tetiği bulunamadı').not.toEqual([])
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
    const imhaBasi = GOC_0097.indexOf("if new.event_type = 'IMHA' then")
    const ortakIs = GOC_0097.indexOf('ALINDI ve ACILDI · ORTAK İŞ')
    expect(imhaBasi, "0097'de imha dalı bulunamadı").toBeGreaterThan(-1)
    expect(ortakIs, "0097'de ortak iş bloğu bulunamadı").toBeGreaterThan(imhaBasi)
    const imhaBlogu = GOC_0097.slice(imhaBasi, ortakIs)
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
    const ortakIs = GOC_0097.indexOf('ALINDI ve ACILDI · ORTAK İŞ')
    expect(ortakIs, 'ortak iş bloğu bulunamadı').toBeGreaterThan(-1)
    const sonrasi = GOC_0097.slice(ortakIs, GOC_0097.indexOf('revoke all on function'))
    for(const izin of NUMUNE_IZINLERI){
      expect(sonrasi, `${izin} ortak iş kapısında yok`).toContain(izin)
    }
  })

  it("numune ALMA kapısı 0093'te DEĞİŞMEDEN duruyor", () => {
    // Numune almak hâlâ ortak iş: `witness_sample` tablosunun tetiği
    // 0097'de ele alınmadı ve alınmaması doğru.
    expect(gocIzinleri(GOC_0093, 'witness_sample'))
      .toEqual([...NUMUNE_IZINLERI].sort())
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
