// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — SKT KAPISI İKİ YERDE AYNI
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────
// Son kullanma tarihi kapısı İKİ yerde duruyor ve bu bilinçli:
//   · `db/migrations/0092_skt_kapisi.sql` — asıl kapı. Ekranı atlayıp
//     doğrudan istek gönderen de reddedilir.
//   · `src/warehouse/warehouse.service.ts` — o kapının ekrandaki yüzü.
//     FEFO süresi geçmiş partiyi SEÇMEMELİ; yoksa kullanıcı reddedilen
//     bir işlemi tekrar tekrar dener ve sebebini anlamaz.
//
// ⚠️ İKİ YERDE AYNI LİSTE OLMAK TEHLİKELİ. Biri değişip diğeri kalırsa
// ortaya iki ayrı davranış çıkar: sunucu reddeder ama ekran seçmeye devam
// eder, ya da ekran engeller ama sunucu geçirir. Bu test ikisinin aynı
// kaldığını ÖLÇÜYOR — "ikisini birlikte değiştirmeyi unutmayın" diye not
// bırakmak yetmez (tuzak 103 ailesi: katmanda doğru, ekranda yanlış).
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'
import { SKT_KAPALI_NEDENLER, sktGecmisMi } from './warehouse.service'

const KOK = projeKokunuBul()
const GOC = readFileSync(join(KOK, 'db/migrations/0092_skt_kapisi.sql'), 'utf8') as string

const gununMetni = (kaydirma: number) => {
  const t = new Date()
  t.setDate(t.getDate() + kaydirma)
  return [t.getFullYear(), String(t.getMonth() + 1).padStart(2, '0'),
    String(t.getDate()).padStart(2, '0')].join('-')
}

describe('SKT kapısı · göç ile servis aynı şeyi söylüyor', () => {
  it('sağlama: göç dosyası okundu', () => {
    expect(GOC.length).toBeGreaterThan(500)
  })

  it('kapalı sebepler göçte de AYNEN yazılı', () => {
    // Göçteki kontrol satırı: reason not in ('PRODUCTION_CONSUME', 'SHIPMENT_OUT')
    const satir = /new\.reason not in \(([^)]*)\)/.exec(GOC)?.[1] ?? ''
    expect(satir, 'göçte sebep listesi bulunamadı').not.toBe('')

    const gocteki = [...satir.matchAll(/'([A-Z_]+)'/g)].map(m => m[1] as string).sort()
    const serviste = [...SKT_KAPALI_NEDENLER].sort()

    expect(
      gocteki,
      'Göç ile servis farklı sebep listesi taşıyor.\n'
      + `göç     : ${gocteki.join(', ')}\n`
      + `servis  : ${serviste.join(', ')}\n`
      + 'İkisi birlikte değiştirilmeli; yoksa sunucu reddettiği hâlde ekran '
      + 'o partiyi seçmeye devam eder.'
    ).toEqual(serviste)
  })

  it('göç imha yolunu KAPATMIYOR', () => {
    // ⚠️ Süresi geçmiş malın çıkış yolu imha kaydıdır. Oraya kapı konursa
    // mal sistemde sonsuza kadar kalır.
    const satir = /new\.reason not in \(([^)]*)\)/.exec(GOC)?.[1] ?? ''
    for(const mesru of ['EXPIRY_WRITE_OFF', 'WASTE', 'PURCHASE_RETURN',
      'COUNT_SHORTAGE', 'COUNT_SURPLUS', 'REVERSAL']){
      expect(satir, `${mesru} kapatılmış — meşru çıkış yolu engellenemez`)
        .not.toContain(mesru)
    }
  })

  it('göç ters kaydı her zaman geçiriyor', () => {
    expect(
      GOC,
      'ters kayıt muafiyeti yok — bugünün kuralıyla dünün kaydını geri almak '
      + 'engellenirse yanlış kayıt kalıcı olur'
    ).toMatch(/reverses_movement_id is not null/)
  })

  it('göç SKT GÜNÜNÜ kabul ediyor (< değil <= yazılmamış)', () => {
    // SKT, ürünün son kullanılabileceği gündür. `<=` bir günlük malı
    // çöpe atardı. Bu bir karar, kazara değil.
    expect(GOC).toMatch(/v_skt < current_date/)
    expect(GOC, '<= yazılmış: SKT günü reddedilir, bu karara aykırı')
      .not.toMatch(/v_skt <= current_date/)
  })

  it('servis tarafı aynı kararı veriyor: dün geçmiş, bugün ve yarın geçerli', () => {
    expect(sktGecmisMi(gununMetni(-1)), 'dün biten parti geçmiş sayılmıyor').toBe(true)
    expect(sktGecmisMi(gununMetni(0)), 'BUGÜN biten parti geçmiş sayılıyor').toBe(false)
    expect(sktGecmisMi(gununMetni(1)), 'yarın biten parti geçmiş sayılıyor').toBe(false)
    expect(sktGecmisMi(undefined), 'tarihsiz parti geçmiş sayılıyor').toBe(false)
    expect(sktGecmisMi(''), 'boş tarih geçmiş sayılıyor').toBe(false)
  })

  it('zaman damgalı tarih de doğru okunuyor', () => {
    // Veritabanı `date` döndürüyor ama katmanlar arasında bazen
    // `2026-10-24T00:00:00Z` biçiminde geliyor; ilk 10 karakter kesiliyor.
    expect(sktGecmisMi(`${gununMetni(-1)}T23:59:59Z`)).toBe(true)
    expect(sktGecmisMi(`${gununMetni(0)}T00:00:00Z`)).toBe(false)
  })
})
