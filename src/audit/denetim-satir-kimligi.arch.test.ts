// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · DENETİM DEFTERİ HANGİ SATIRI ANLATIYOR (mimari testi)
//
// ── NEDEN BU DOSYA VAR ────────────────────────────────────────────────────
// `audit-coverage.arch.test.ts` denetimin KAPSAMINI ölçüyor: hangi tablolar
// izleniyor, her birinin Türkçe etiketi var mı, yedekle tutarlı mı. Hepsi
// yeşildi. Ve yine de defterin bir bölümü OKUNAMAZ hâldeydi.
//
// Codex'in bulgusu (MIYOP-083, 30.10.2026): `app.denetim_yaz()` satır
// kimliğini `coalesce(v_yeni ->> 'id', v_eski ->> 'id', '?')` ile üretiyordu.
// `id` kolonu OLMAYAN dört tabloda (`stock_item_allergen`,
// `stock_item_nutrition`, `user_branch_access`, `user_role`) `row_id` alanına
// '?' düşüyordu. Kayıt yazılıyordu, tarih vardı, kişi vardı — ama HANGİ
// SATIR olduğu yoktu. Besin değeri güncellemesinde fark yalnız değişen
// alanı taşıdığı için ürün bilgisi de yoktu: defterde "biri bir şeyin
// yağ oranını 10'dan 12'ye çekti" yazıyordu.
//
// ⚠️ KAPSAM ÖLÇMEK YETMEZ, ANLAM DA ÖLÇÜLMELİ. Kapsam testi "bu tablo
// denetleniyor mu" diye sorar; bu dosya "yazdığı şey bir şey anlatıyor mu"
// diye sorar. İkisi farklı sorulardır ve birincisi yeşilken ikincisi
// kırmızıydı.
//
// Düzeltme göç 0104'te: `id` yoksa BİRİNCİL ANAHTARDAN kimlik üretiliyor
// (`app.denetim_satir_kimligi`). Davranış provada ölçüldü
// (db/prova/prova-0104.sql) ve TERS PROVA ile de ölçüldü
// (db/prova/prova-0104-ters.sql: 0104 geri alınınca '?' geri geliyor).
// Bu dosya o kararın KODDA kalıcı olmasını sağlıyor.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  denetimIzlenenTablolar,
  gocMetni,
  tabloGovdeleri,
} from '../core/test-support/goc-tarama'

const sql = gocMetni()
const izlenen = denetimIzlenenTablolar(sql)
const govdeler = tabloGovdeleri(sql)

/** `--` satır yorumlarını atar. */
const yorumsuz = (metin: string): string => metin
  .split('\n')
  .map(satir => satir.replace(/--.*$/, ''))
  .join('\n')

/**
 * `app.denetim_yaz()`ın SON tanımının gövdesi.
 *
 * ⚠️ ÜÇ TUZAK BİRDEN, ve üçünü de bu okuyucuyu yazarken yaşadım:
 *
 *   1. `CREATE OR REPLACE` büyük harfle de yazılıyor (0104, canlı tanımdan
 *      kopyalandığı için). Büyük/küçük harfe duyarlı arama 0104'ü HİÇ
 *      bulamadı ve "düzeltme yok" dedi.
 *   2. Gövde etiketi her yerde `$$` değil: 0104'te `$function$`. Sabit `$$`
 *      aramak gövdeyi yanlış yerden keser.
 *   3. 0104 eski ifadeyi YORUM OLARAK saklıyor ("burası eskiden şöyleydi").
 *      Yorumları atmayan okuyucu o yorumu okudu ve "ifade hâlâ eski" dedi —
 *      yani test, düzeltilmiş bir şeyi bozuk gösteriyordu.
 *
 * Üçü de aynı aileden: ÖLÇEN ARACIN KENDİSİ YANLIŞ ÖLÇÜYOR. Okuyucu bu
 * yüzden kendi doğruluğunu da sınıyor (aşağıdaki "sağlama" bölümü).
 */
const denetimYazGovdesi = (): string => {
  const yerler = [...sql.matchAll(
    /create or replace function app\.denetim_yaz\s*\(\s*\)/gi,
  )].map(m => m.index ?? -1).filter(i => i >= 0)

  if(yerler.length === 0) throw new Error(
    'Göçlerde `app.denetim_yaz()` tanımı bulunamadı. Fonksiyon taşındıysa ' +
    'bu okuyucu da güncellenmeli — yoksa test sessizce zayıflar.',
  )

  const son = yerler[yerler.length - 1]
  const etiket = /\$([a-z_]*)\$/.exec(sql.slice(son))
  if(!etiket) throw new Error('`app.denetim_yaz()` gövde etiketi bulunamadı.')

  const bas = son + (etiket.index ?? 0) + etiket[0].length
  const bitis = sql.indexOf(etiket[0], bas)
  if(bitis < 0) throw new Error('`app.denetim_yaz()` gövdesi kapanmıyor.')

  return sql.slice(bas, bitis)
}

/** Son tanımdaki `v_satir := ...;` ifadesi, tek satıra indirilmiş. */
const satirKimligiIfadesi = (): string => {
  const govde = yorumsuz(denetimYazGovdesi())
  const m = /v_satir\s*:=([\s\S]*?);/.exec(govde)
  if(!m) throw new Error(
    '`v_satir` ataması bulunamadı. Değişken adı değiştiyse bu okuyucu da ' +
    'güncellenmeli.',
  )
  return m[1].split(/\s+/).join(' ').trim()
}

const IFADE = satirKimligiIfadesi()

// ── SAĞLAMA · OKUYUCU DOĞRU ŞEYE BAKIYOR MU ──────────────────────────────
describe('Sağlama: okuyucu doğru tanımı okuyor', () => {
  it('⚠️ üç tanım var ve okunan EN SONUNCUSU', () => {
    const sayi = [...sql.matchAll(
      /create or replace function app\.denetim_yaz\s*\(\s*\)/gi,
    )].length
    expect(sayi, 'tanım sayısı düştü — bir göç silinmiş olabilir')
      .toBeGreaterThanOrEqual(3)
  })

  it('⚠️ okunan ifade bir YORUM DEĞİL', () => {
    // 0104 eski ifadeyi yorumda saklıyor. Okuyucu yorumları atmazsa onu
    // okur ve düzeltilmiş kodu bozuk gösterir.
    expect(IFADE.startsWith('--'), 'okuyucu yorum satırını okudu').toBe(false)
    expect(IFADE, 'ifade boş').not.toEqual('')
  })

  it('okuyucu büyük harfli tanımı da buluyor', () => {
    // 0104 `CREATE OR REPLACE` yazıyor. Duyarlı arama onu atlar.
    expect(/CREATE OR REPLACE FUNCTION app\.denetim_yaz/.test(sql)).toBe(true)
  })
})

// ── 1 · DEFTER SATIRI ADIYLA YAZILIYOR ───────────────────────────────────
describe('⚠️ `row_id` anlamlı: defter hangi satırı anlattığını söylüyor', () => {
  it('`id` yoksa BİRİNCİL ANAHTARDAN kimlik üretiliyor', () => {
    expect(
      IFADE,
      'satır kimliği `id`de bitiyor — `id` kolonu olmayan tabloda '
      + "`row_id` yine '?' olur (MIYOP-083)",
    ).toContain('app.denetim_satir_kimligi')
  })

  it("⚠️ '?' SON ÇARE — kimlik üretiminden SONRA geliyor", () => {
    const kimlikYeri = IFADE.indexOf('app.denetim_satir_kimligi')
    const soruYeri = IFADE.indexOf("'?'")
    expect(soruYeri, "'?' ifadeden kalkmış — yerine null yazılıyor olabilir")
      .toBeGreaterThan(-1)
    expect(
      kimlikYeri,
      "'?' kimlik üretiminden ÖNCE geliyor — coalesce ilkini alır, "
      + 'yani kimlik hiç çalışmaz',
    ).toBeLessThan(soruYeri)
  })

  it('kimlik, `id` kolonundan SONRA deneniyor — gerileme yok', () => {
    // `id` olan tabloda kimlik hâlâ `id`nin kendisi olmalı. Birincil anahtar
    // dizgesine dönmek ("id=...") eski kayıtlarla eşleşmeyi bozardı:
    // `audit_log_satir_idx` (table_name, row_id) üzerinden arama yapılıyor.
    const idYeri = IFADE.indexOf("v_yeni ->> 'id'")
    const kimlikYeri = IFADE.indexOf('app.denetim_satir_kimligi')
    expect(idYeri).toBeGreaterThan(-1)
    expect(idYeri, '`id` kimlikten sonra deneniyor — eski satır kimlikleri değişir')
      .toBeLessThan(kimlikYeri)
  })
})

// ── 2 · KİMLİK ÜRETİCİSİ KATALOĞU OKUYOR, LİSTE TUTMUYOR ─────────────────
describe('⚠️ Kimlik üreticisi elle tutulan listeye bağlı DEĞİL', () => {
  it('`app.denetim_satir_kimligi` tanımlı', () => {
    expect(/create or replace function app\.denetim_satir_kimligi/i.test(sql))
      .toBe(true)
  })

  it('birincil anahtarı KATALOĞDAN okuyor', () => {
    // ⚠️ Bu, dördü tek tek düzeltmekle bütün sınıfı düzeltmek arasındaki
    // fark. Elle liste tutsaydık BEŞİNCİ tablo eklendiğinde yine '?' olurdu
    // ve yine kimse fark etmezdi. Yazıcı düzeltildiği için gelecekteki
    // tablolar da kapsanıyor.
    const bas = sql.search(/create or replace function app\.denetim_satir_kimligi/i)
    const govde = sql.slice(bas, bas + 2000)
    expect(govde, 'birincil anahtar katalogdan okunmuyor').toContain('pg_constraint')
    expect(govde, "contype = 'p' süzgeci yok — başka kısıt tipleri de gelir")
      .toMatch(/contype\s*=\s*'p'/)
  })

  it('⚠️ tablo adı GEÇMİYOR — yani dört tabloya özel yazılmamış', () => {
    const bas = sql.search(/create or replace function app\.denetim_satir_kimligi/i)
    const govde = sql.slice(bas, bas + 2000)
    const ozelAdlar = ['stock_item_allergen', 'stock_item_nutrition',
      'user_branch_access', 'user_role']
    const gecenler = ozelAdlar.filter(t => govde.includes(t))
    expect(gecenler, 'kimlik üreticisi tablo adı tanıyor — sınıf değil örnek düzeltilmiş')
      .toEqual([])
  })
})

// ── 3 · HER DENETİMLİ TABLO KİMLİK ÜRETEBİLİYOR ──────────────────────────
describe('⚠️ Denetlenen her tablonun söyleyebileceği bir kimliği var', () => {
  it('her denetimli tablo ya `id` taşıyor ya BİRİNCİL ANAHTAR beyan ediyor', () => {
    // Kimlik üreticisi birincil anahtardan okuyor. Birincil anahtarı da
    // olmayan bir denetimli tablo eklenirse `row_id` yine '?' olur —
    // 0104 onu kurtarmaz. Bu sınama o günü yakalar.
    const kimliksiz = izlenen.filter(t => {
      const govde = govdeler.get(t)
      if(!govde) return false
      const idVar = /^\s*id\s+(uuid|bigint|serial|bigserial|int)/m.test(govde)
      const pkVar = /primary key/i.test(govde)
      return !idVar && !pkVar
    })
    expect(
      kimliksiz,
      'bu tablolar denetleniyor ama satırını adlandıramaz — `row_id` ' + "'?' olur",
    ).toEqual([])
  })

  it('⚠️ `id` kolonu OLMAYAN denetimli tablolar hâlâ var ve kapsanıyor', () => {
    // Olumsuz kontrol değil, VARLIK kontrolü: yukarıdaki sınama hepsi
    // `id` taşıyorsa da yeşil kalır ve hiçbir şey ölçmemiş olur.
    // 30.10.2026 ölçümü (prova veritabanı): dört tablo `id`siz.
    const idsiz = izlenen.filter(t => {
      const govde = govdeler.get(t)
      return govde ? !/^\s*id\s+(uuid|bigint|serial|bigserial|int)/m.test(govde) : false
    })
    expect(idsiz.length, '`id`siz denetimli tablo kalmamış — bu sınama artık boş ölçüyor')
      .toBeGreaterThanOrEqual(1)
    idsiz.forEach(t => {
      expect(/primary key/i.test(govdeler.get(t) ?? ''),
        `${t} ne \`id\` taşıyor ne birincil anahtar beyan ediyor`).toBe(true)
    })
  })
})

// ── 4 · "SON KAYIT" İSTEMCİDEN GELMİYOR (MIYOP-085) ──────────────────────
describe('⚠️ MIYOP-085 · `company.updated_at` sunucuda yazılıyor', () => {
  it('`company` tablosunda zaman damgası tetikleyicisi var', () => {
    // Ekran "Son kayıt: ..." yazıyor. O değer istemciden geliyorsa yazan
    // taraf tarihi uydurabilir — ekranda yazan söz yalan olur.
    expect(
      /create trigger company_zaman_damgasi/i.test(sql),
      '`company.updated_at` istemciye bırakılmış',
    ).toBe(true)
  })

  it('tetikleyici BEFORE UPDATE — yazmadan önce düzeltiyor', () => {
    const m = /create trigger company_zaman_damgasi([\s\S]{0,200}?);/i.exec(sql)
    expect(m, 'tetikleyici tanımı okunamadı').not.toBeNull()
    expect(
      (m?.[1] ?? '').toLowerCase(),
      'AFTER tetikleyici satırı değiştiremez, yalnız seyreder',
    ).toContain('before update')
  })

  it('fonksiyon `now()` yazıyor ve `created_at`i KORUYOR', () => {
    const bas = sql.search(/create or replace function app\.company_zaman_damgasi/i)
    expect(bas, 'fonksiyon bulunamadı').toBeGreaterThan(-1)
    const govde = sql.slice(bas, bas + 1500)
    expect(govde).toMatch(/new\.updated_at\s*:=\s*now\(\)/)
    expect(govde, '`created_at` korunmuyor — istemci doğum tarihini değiştirebilir')
      .toMatch(/new\.created_at\s*:=\s*old\.created_at/)
  })
})
