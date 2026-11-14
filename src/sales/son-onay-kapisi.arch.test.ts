// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — SON ONAY KURALI TEK YERDE (göç 0117)
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────
// Emrah'ın kararı (12.11.2026): siparişe son onayı tek bir yetkili verir —
// İşletme Müdürü; işletmede müdür yoksa işletme sahibi.
//
// Bu kural ÜÇ yerde görünüyor ve üçü aynı cevabı vermek zorunda:
//   · `app.siparis_onay_kapisi()`   — asıl kapı (tetik · MI403)
//   · `app.son_onay_yetkim_var()`   — kuralın YAZILDIĞI tek yer
//   · `Siparisler.tsx`              — düğmeyi kapatan ve sebebini yazan ekran
//
// ⚠️ Ekran kuralı YENİDEN HESAPLAMIYOR, sunucuya soruyor. Bu test onun
// öyle kaldığını ölçüyor: ekrana bir gün rol adı yazılırsa kırmızı yanar.
//
// ⚠️ SINIRI: bu blok METİN ölçer. Kapının gerçekten reddettiğini
// `db/prova/prova-0117.sql` (28 iddia, `authenticated` rolüyle, gerçek
// UPDATE) ve kusurun gerçek olduğunu `prova-0117-ters.sql` gösteriyor.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'
import { yorumsuzKod } from '../core/test-support/kaynak-soyma'
import { SON_ONAY_KURALI } from './son-onay'

const KOK = projeKokunuBul()
const GOC_KLASORU = join(KOK, 'db/migrations')
const dosya = (yol: string): string => readFileSync(join(KOK, yol), 'utf8') as string

/** SQL yorumları ölçümden ÖNCE siliniyor (tuzak 181). */
const sqlKod = (metin: string): string => metin.replace(/--[^\n]*/g, '')

const gocDosyalari = (): string[] =>
  (readdirSync(GOC_KLASORU) as string[]).filter(a => /^[0-9]{4}_.+\.sql$/.test(a)).sort()

/**
 * Bir fonksiyonun EN SON yazıldığı gövde (yorumsuz) ve hangi göçte olduğu.
 *
 * ⚠️ Tek göçe bakmak tuzak 190: kapı 0053'te doğdu, 0117 onu yeniden yazdı.
 * Bir sonraki göç yine yazarsa ölçüm onu bulur; 0117'yi savunmaya devam
 * etmez.
 */
const etkinGovde = (tamAd: string): { govde: string; goc: string } => {
  let sonuc = { govde: '', goc: '' }
  const basi = `create or replace function ${tamAd}(`
  for(const ad of gocDosyalari()){
    const sql = sqlKod(readFileSync(join(GOC_KLASORU, ad), 'utf8') as string)
    const bas = sql.lastIndexOf(basi)
    if(bas < 0) continue
    // Gövde `$$;` ile biter (plpgsql: `end $$;` ya da `end;\n$$;` · sql: `… $$;`).
    const ilk = sql.indexOf('$$', bas)
    const son = sql.indexOf('$$;', ilk + 2)
    if(ilk < 0 || son < 0) continue
    sonuc = { govde: sql.slice(bas, son + 3), goc: ad }
  }
  return sonuc
}

const KAPI = etkinGovde('app.siparis_onay_kapisi')
const KURAL = etkinGovde('app.son_onay_yetkim_var')
const MUDUR_VAR = etkinGovde('app.isletmemde_mudur_var')
const KABUK = etkinGovde('public.son_onay_yetkim_var')
const OLAY = etkinGovde('app.siparis_olayi_yaz')

describe('sağlama · ölçüm gerçekten gövde buldu', () => {
  it('beş fonksiyonun beşi de bulundu ve 0117 ya da sonrasında', () => {
    for(const [ad, f] of Object.entries({ KAPI, KURAL, MUDUR_VAR, KABUK, OLAY })){
      expect(f.goc, `${ad} hiçbir göçte bulunamadı`).not.toBe('')
      expect(f.goc.slice(0, 4) >= '0117', `${ad} etkin göcü: ${f.goc}`).toBe(true)
      expect(f.govde.length, `${ad} gövdesi kesilemedi`).toBeGreaterThan(80)
    }
  })

  it('kesim doğru yerde bitiyor (bir sonraki fonksiyona taşmıyor)', () => {
    expect(KURAL.govde).not.toContain('create or replace function app.siparis_onay_kapisi')
    expect(KAPI.govde).not.toContain('create or replace function app.siparis_olayi_yaz')
    expect(KAPI.govde.trimEnd().endsWith('$$;')).toBe(true)
  })
})

describe('kapı · "Onaylandı" yazılırken KİM bastığı ölçülüyor', () => {
  it('⚠️ kapı kuralı KENDİSİ yazmıyor, tek yere soruyor', () => {
    expect(KAPI.govde).toContain('app.son_onay_yetkim_var()')
    // Kapının içinde rol adı geçerse kural iki yerde durur.
    expect(KAPI.govde).not.toContain("'isletme_muduru'")
    expect(KAPI.govde).not.toContain("'isletme_sahibi'")
  })

  it('⚠️ yetki ZİNCİRDEN ÖNCE ölçülüyor', () => {
    // Yetkisi olmayan biri zincirin hangi adımının eksik olduğunu bu
    // kapıdan öğrenmesin; önce "sen değilsin" denir.
    const yetki = KAPI.govde.indexOf('app.son_onay_yetkim_var()')
    const zincir = KAPI.govde.indexOf('app.siparis_onayi_tam(new.id)')
    expect(yetki).toBeGreaterThan(-1)
    expect(zincir, 'zincir kapısı düşmüş').toBeGreaterThan(yetki)
  })

  it('yetkisiz çağrı MI403, eksik zincir MI429 (ikisi de duruyor)', () => {
    expect(KAPI.govde).toContain("using errcode = 'MI403'")
    expect(KAPI.govde).toContain("using errcode = 'MI429'")
  })

  it('⚠️ oturumsuz bakım yazımı kapıya takılmıyor (göç ve yedek çalışır)', () => {
    expect(KAPI.govde).toMatch(/if not app\.bakim_baglami\(\) and not app\.son_onay_yetkim_var\(\)/)
  })

  it('söz verilen tarih hesabı düşmedi (0053)', () => {
    expect(KAPI.govde).toContain('new.promised_delivery_date := v_tarih')
  })

  it('⚠️ kapı yalnız "Onaylandı"ya GEÇİŞTE çalışıyor (geri alma ve ilerletme serbest)', () => {
    expect(KAPI.govde).toContain(
      "if new.status = 'Onaylandı' and old.status is distinct from 'Onaylandı' then")
  })
})

describe('kural · müdür; müdür yoksa sahip', () => {
  it('⚠️ parametre YOK — kimlik ve işletme oturumdan okunuyor', () => {
    expect(KURAL.govde).toContain('create or replace function app.son_onay_yetkim_var()')
    expect(MUDUR_VAR.govde).toContain('create or replace function app.isletmemde_mudur_var()')
    expect(KURAL.govde).toContain('app.aktif_kullanici_id()')
    expect(MUDUR_VAR.govde).toContain('app.aktif_kullanici_id()')
  })

  it('⚠️ müdür dalı sahip dalından ÖNCE ve koşulsuz', () => {
    const mudur = KURAL.govde.indexOf('if coalesce(v_mudurum, false) then return true; end if;')
    const sahip = KURAL.govde.indexOf(
      'if coalesce(v_sahibim, false) and not app.isletmemde_mudur_var() then')
    expect(mudur, 'müdür dalı bulunamadı').toBeGreaterThan(-1)
    expect(sahip, 'sahip dalı "müdür yoksa" koşulunu taşımıyor').toBeGreaterThan(mudur)
  })

  it('⚠️ varsayılan cevap HAYIR', () => {
    // Dalların hiçbiri tutmazsa son satır `return false`.
    const sonDonus = KURAL.govde.lastIndexOf('return ')
    expect(KURAL.govde.slice(sonDonus)).toMatch(/^return false;/)
  })

  it('iki rol de birincil rolden VE ek rollerden okunuyor', () => {
    for(const rol of ['isletme_muduru', 'isletme_sahibi']){
      expect(KURAL.govde, `${rol} birincil rolden okunmuyor`)
        .toContain(`u.role_code = '${rol}'`)
      expect(KURAL.govde, `${rol} ek rollerden okunmuyor`)
        .toContain(`ur.role_code = '${rol}'`)
    }
  })

  it('⚠️ "müdür var mı" yalnız AKTİF kullanıcıları sayıyor', () => {
    // Pasife alınmış bir müdür işletmeyi kilitlemesin: o yokken sahip verir.
    expect(MUDUR_VAR.govde).toContain('m.is_active')
    expect(MUDUR_VAR.govde).toContain('m.tenant_id = v_kiraci')
  })

  it('⚠️ yeni İZİN açılmadı (kural bir izinle ifade edilemiyor)', () => {
    const goc = sqlKod(dosya(join('db/migrations', KURAL.goc)))
    expect(goc).not.toMatch(/insert into (public\.)?permission\b/)
    expect(goc).not.toMatch(/insert into (public\.)?role_permission\b/)
  })
})

describe('yetkiler · üç yeni fonksiyon', () => {
  const GOC = sqlKod(dosya(join('db/migrations', KURAL.goc)))

  for(const ad of ['app.isletmemde_mudur_var()', 'app.son_onay_yetkim_var()',
    'public.son_onay_yetkim_var()']){
    it(`⚠️ ${ad} · PUBLIC ve anon kapalı, authenticated açık`, () => {
      // Yeni fonksiyon varsayılan olarak PUBLIC'e açıktır (tuzak 67).
      expect(GOC).toMatch(new RegExp(
        `revoke all\\s+on function ${ad.replace(/[.()]/g, '\\$&')} from public;`))
      expect(GOC).toMatch(new RegExp(
        `revoke all\\s+on function ${ad.replace(/[.()]/g, '\\$&')} from anon;`))
      expect(GOC).toMatch(new RegExp(
        `grant\\s+execute on function ${ad.replace(/[.()]/g, '\\$&')} to authenticated, service_role;`))
    })
  }

  it('ekranın çağırdığı kabuk `public` şemasında ve yalnız kurala soruyor', () => {
    expect(KABUK.govde).toContain('select app.son_onay_yetkim_var();')
  })
})

describe('kayıt · kimin onayladığı deftere yazılıyor', () => {
  it('⚠️ DURUM olayı İMZALI ve imza sunucudan', () => {
    // 0050'de DURUM olayı imzasız yazılıyordu: bir siparişi kimin
    // onayladığı hiçbir yerde durmuyordu.
    expect(OLAY.govde).toContain(
      "values (new.tenant_id, new.id, 'DURUM', old.status, new.status, app.aktif_kullanici_id());")
  })

  it('olay yazıcısının öteki dalları düşmedi', () => {
    for(const tur of ["'AÇILDI'", "'REVİZYON'", "'FARK'", "'FARK KARARI'"]){
      expect(OLAY.govde, `${tur} dalı düşmüş`).toContain(tur)
    }
  })
})

describe('ekran · kuralı yeniden hesaplamıyor, sunucuya soruyor', () => {
  const SAYFA = yorumsuzKod(dosya('src/pages/Siparisler.tsx'))
  const MODUL = yorumsuzKod(dosya('src/sales/son-onay.ts'))

  it('⚠️ ekranda ve modülde ROL ADI yok', () => {
    for(const [ad, metin] of [['Siparisler.tsx', SAYFA], ['son-onay.ts', MODUL]] as const){
      expect(metin, `${ad} içinde rol adı var: kural ikinci kez yazılmış`)
        .not.toMatch(/isletme_muduru|isletme_sahibi/)
    }
  })

  it('modül sunucudaki kabuğu çağırıyor', () => {
    expect(MODUL).toContain(".rpc('son_onay_yetkim_var')")
  })

  it('⚠️ okuma düşerse cevap `null` — `false` DEĞİL', () => {
    // "Veremezsiniz" demek için bilmek gerekir.
    expect(MODUL).toMatch(/if\(error\)\{[\s\S]{0,160}return null/)
    expect(MODUL).toMatch(/catch \(e\) \{[\s\S]{0,160}return null/)
  })

  it('sayfa yetkiyi yüklüyor ve düğmeyi aynı cevapla kapatıyor', () => {
    expect(SAYFA).toContain('sonOnayYetkisiniOku()')
    expect(SAYFA).toContain('setSonOnay(so)')
    expect(SAYFA).toContain("const kapali = d === 'Onaylandı' && onaylandiKapaliSebebi !== undefined")
    // Düğmenin ipucu ve altındaki açıklama AYNI değişkenden.
    expect(SAYFA).toContain('title={kapali ? onaylandiKapaliSebebi : undefined}')
    expect(SAYFA).toContain('<span className="muted">{onaylandiKapaliSebebi}</span>')
  })

  it('⚠️ eski kural (yalnız zincire bakan) sayfada kalmadı', () => {
    expect(SAYFA).not.toContain("const kapali = d === 'Onaylandı' && !zincirTamam")
  })

  it('ekranın cümlesi ile veritabanının cümlesi aynı iki rolü söylüyor', () => {
    for(const kelime of ['İşletme Müdürü', 'işletme sahibi']){
      expect(SON_ONAY_KURALI).toContain(kelime)
      expect(KAPI.govde).toContain(kelime)
    }
  })
})

describe('prova · kapının içinde koşuyor', () => {
  it('prova ve ters prova var, rol takıyor, veritabanını kirletmiyor', () => {
    for(const p of ['db/prova/prova-0117.sql', 'db/prova/prova-0117-ters.sql']){
      expect(existsSync(join(KOK, p)), `${p} yok`).toBe(true)
      const metin = dosya(p)
      expect(metin, `${p} rol takmıyor (MIYOP-042)`).toContain('set local role authenticated')
      expect(metin.trimEnd().endsWith('rollback;'), `${p} rollback ile bitmiyor`).toBe(true)
    }
  })

  it('⚠️ prova GERÇEK yazma yolunu ölçüyor ve müdürsüz sahneyi kuruyor', () => {
    const p = dosya('db/prova/prova-0117.sql')
    expect(p).toContain("update public.sales_order set status = 'Onaylandı'")
    expect(p).toContain('public.son_onay_yetkim_var()')
    expect(p).toContain('KURULUM: sahne isletmesinde zaten aktif bir mudur var')
  })

  it('⚠️ ters prova eski gövdeyi geri koyup kusuru gösteriyor', () => {
    const t = dosya('db/prova/prova-0117-ters.sql')
    expect(t).toContain('create or replace function app.siparis_onay_kapisi()')
    expect(t).toContain('ESKİ GÖVDEYLE')
  })
})
