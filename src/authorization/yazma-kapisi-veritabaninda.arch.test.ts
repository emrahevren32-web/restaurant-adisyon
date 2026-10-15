// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — YAZMA KAPISI VERİTABANINDA DA VAR MI (0081)
//
// ── NEDEN ─────────────────────────────────────────────────────────────────
// 14.10.2026'da Codex denetimi şunu gösterdi: dört yazma kapısının üçü
// YALNIZCA React'teki bir `if` idi. RLS politikaları kiracı eşitliğine
// bakıyordu, izne değil; `authenticated` rolünün tablolara INSERT/UPDATE
// yetkisi vardı. Yani tarayıcı konsolundan repository'yi çağıran biri
// yazabiliyordu.
//
// Daha kötüsü: `yazma-yetkisi.ts` içindeki yorum "gerçek sınır
// veritabanındadır" diye YAZIYORDU. Yorum yanlıştı ve kimse fark etmedi.
//
// ⚠️ DERS: bir güvenlik iddiası yorumda duramaz. Yorum okunmaz, test
// çalışır.
//
// Bu test göç dosyalarını okuyarak her kapının GERÇEKTEN kurulduğunu
// doğrular. Bir tetik silinirse ya da adı değişirse kırılır.
//
// ⚠️ Bu test tetiğin VARLIĞINI kanıtlar, DAVRANIŞINI değil. Davranış
// `is/prova/prova-0081.sql` içinde, gerçek PostgreSQL üzerinde, geri
// alınan bir işlemde sınanıyor (29 kontrol). İkisi birlikte anlamlı:
// biri "kapı takılı mı", diğeri "kapı kilitliyor mu".
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { gocMetni } from '../core/test-support/goc-tarama'

const SQL = gocMetni()

/** Göçlerde kurulan tetikler: ad → tablo. */
const tetikler = (): Map<string, string> => {
  const bulunan = new Map<string, string>()
  const re = /create trigger\s+(\w+)\s+(?:before|after)[\s\S]{0,120}?on\s+(?:public\.)?(\w+)/gi
  let m: RegExpExecArray | null
  while((m = re.exec(SQL)) !== null) bulunan.set(m[1], m[2])
  return bulunan
}

const KAPILAR: { tetik: string; tablo: string; neden: string }[] = [
  { tetik: 'izin_recipe', tablo: 'recipe',
    neden: 'Reçeteyi yalnız `recipe.write` olan yazar' },
  { tetik: 'izin_recipe_line', tablo: 'recipe_line',
    neden: 'Başlığı kapatıp satırları açık bırakmak kapıyı yarım takmaktır' },
  { tetik: 'izin_shipment', tablo: 'shipment',
    neden: 'Sevkiyatı yalnız `logistics.write` olan açar' },
  { tetik: 'izin_shipment_line', tablo: 'shipment_line',
    neden: 'Sevkiyat satırı da aynı kapıdan geçer' },
  { tetik: 'izin_haccp_measurement', tablo: 'haccp_measurement',
    neden: 'Ölçüm girme `quality.write`, iptal `quality.record.manage`' },
  { tetik: 'izin_haccp_corrective_action', tablo: 'haccp_corrective_action',
    neden: 'Faaliyeti kapatmak `quality.record.manage` ister' },
  { tetik: 'izin_stock_item_ambalaj', tablo: 'stock_item',
    neden: 'Ambalaj miktarı etiket beyanının parçası (`quality.declaration`)' },
]

describe('yazma kapıları veritabanında', () => {
  it('tarama çalıştı — göçlerde tetik bulundu', () => {
    // ⚠️ Sağlama. Kalıp bozulursa harita boşalır ve aşağıdaki testler
    // "hiçbir kapı yok" diye değil, sessizce yanlış kırılırdı.
    expect(tetikler().size).toBeGreaterThan(20)
  })

  KAPILAR.forEach(({ tetik, tablo, neden }) => {
    it(`${tablo} · ${neden}`, () => {
      expect(tetikler().get(tetik),
        `\`${tetik}\` tetiği göçlerde kurulmuyor. Bu kapı kalkarsa yazma ` +
        'kuralı yalnızca React\'teki `if`e kalır — yani kapı yoktur.',
      ).toBe(tablo)
    })
  })

  it('tetik fonksiyonu izni GERÇEKTEN soruyor (yorum değil, kod)', () => {
    expect(SQL).toMatch(/create or replace function app\.izin_gerek\(\)/)
    expect(SQL).toMatch(/if not app\.yetkim_var\(v_izin\) then/)
  })

  it('oturumsuz bağlam serbest — göç ve yedek geri yükleme kilitlenmiyor', () => {
    // Bu olmadan göçün kendisi kendi kapısına takılırdı.
    const govde = /create or replace function app\.izin_gerek\(\)[\s\S]*?\$\$;/.exec(SQL)
    expect(govde?.[0]).toMatch(/if v_auth is null then\s*\n\s*return coalesce/)
  })

  it('`quality.write` İKİYE AYRILDI ve yeni izin katalogda', () => {
    expect(SQL).toMatch(/'quality\.record\.manage'/)
    expect(SQL).toMatch(/insert into permission \(code, module_code, description\) values\s*\n\s*\('quality\.record\.manage'/)
  })

  it('⚠️ 0068 BOZULMADI — üretim ve sevkiyat ölçüm girmeye devam ediyor', () => {
    // 0081'in bütün inceliği bu: ölçümü zorlaştırmadan kapatmayı daraltmak.
    // 0081'in doğrulama bloğu bunu göçün kendi içinde de iddia ediyor.
    expect(SQL).toContain('0081: uretim/sevkiyat olcum girme yetkisini kaybetti')
  })

  it('kapatanın imzasını VERİTABANI atıyor, istemci değil', () => {
    expect(SQL).toMatch(/new\.completed_by\s*:=\s*app\.aktif_kullanici_id\(\)/)
  })

  it('yeni izin üretim/sevkiyat/depo rollerine VERİLMEDİ', () => {
    expect(SQL).toContain("'0081: su rollerde quality.record.manage OLMAMALI")
  })
})

describe('0082 · faaliyet kapısının dört deliği', () => {
  // ── NEDEN BU BLOK ──────────────────────────────────────────────────────
  // 0081 kapıyı taktı, Codex denetimi (15.10) yanından dolaşan dört yol
  // buldu. Dördü de "kapıyı kolon kolon düşünmenin" bedeliydi: hangi
  // kolonun değiştiğine bakıyordum, oysa doğru soru SATIRIN DURUMU idi.

  const govde = () => {
    const m = /create or replace function app\.haccp_faaliyet_izni\(\)[\s\S]*?\$\$;/g
    const hepsi = [...SQL.matchAll(m)]
    // Son tanım geçerlidir: 0082, 0081'in üstüne yazıyor.
    return hepsi[hepsi.length - 1]?.[0] ?? ''
  }

  it('DELİK 1 · iptal de kapanıştır — `CANCELLED` dar izin istiyor', () => {
    expect(govde()).toMatch(/in \('COMPLETED', 'CANCELLED'\)/)
  })

  it('DELİK 2+3 · kapanmış bir satıra DOKUNMAK dar izin istiyor', () => {
    // Kolon saymak yerine durumu temel almak: yarın eklenen kolon
    // kendiliğinden kapsanıyor.
    expect(govde()).toMatch(/or \(old\.status in \('COMPLETED', 'CANCELLED'\)\)/)
  })

  it('DELİK 2 · imza HER AN korunuyor, yalnız kapanışta değil', () => {
    // 0081 yalnız `v_kapanis` anında yazıyordu; sonrası serbestti ve
    // `completed_by = null` geçiyordu.
    expect(govde()).toMatch(/elsif tg_op = 'UPDATE' then\s*\n\s*new\.completed_by := old\.completed_by/)
  })

  it('DELİK 4 · ölçüm bağı İZİNLE BİLE değiştirilemiyor', () => {
    expect(govde()).toMatch(/measurement_id is distinct from old\.measurement_id/)
    expect(govde()).toMatch(/MI425/)
  })

  it('oturumsuz serbestlik artık `anon`u DIŞLIYOR', () => {
    // 0081'in yorumu "PostgREST'ten gelen her çağrının oturumu vardır"
    // diyordu. Yanlıştı. Artık rol de sınanıyor.
    expect(SQL).toMatch(/create or replace function app\.bakim_baglami\(\)/)
    expect(SQL).toMatch(/current_user not in \('anon', 'authenticated'\)/)
    expect(govde()).toMatch(/app\.bakim_baglami\(\)/)
  })

  it('⚠️ ACL KONTROLÜ ARTIK ÇALIŞIYOR — `acldefault` olmadan kördü', () => {
    // 0081: `aclexplode(p.proacl)`. `proacl` NULL olduğunda — ki VARSAYILAN
    // budur, yani yakalanması gereken hâl — hiç satır dönmüyor ve kontrol
    // "temiz" diyordu. Kontrolün kendisi aradığı şeyi göremiyordu.
    expect(SQL).toMatch(/acldefault\('f', p\.proowner\)/)
  })

  it('dört tetik fonksiyonunda da PUBLIC EXECUTE kapatıldı', () => {
    expect(SQL).toMatch(/revoke all on function %s from public/)
    expect(SQL).toContain("'app.izin_gerek()', 'app.haccp_olcum_izni()'")
  })
})
