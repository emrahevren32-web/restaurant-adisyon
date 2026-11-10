// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — MEVZUAT AKIŞI KAPILARI VE EŞİKLERİ
//
// ── NE ÖLÇÜYOR ───────────────────────────────────────────────────────────
// Mevzuat kutusunun iddiası üç cümle:
//   1. "Vitrinde yalnız YAYINDA olan, kaynaklı satırlar görünür."
//   2. "Yönetim yalnız platform sahibinde."
//   3. "Ekranın istediği ile veritabanının istediği AYNI."
//
// Üçü de burada ölçülüyor — göç metnine ve kaynak dosyalara BAKARAK.
//
// ⚠️ Üçüncüsü özellikle önemli: **MIYOP-105 tam olarak bunun
// ayrışmasıydı.** Şahit numunede ekran 2-3 karakter istiyordu, veritabanı
// yalnız "boş olmasın" diyordu ve API'den yazan biri gerekçe yerine `.`
// koyup geçebiliyordu. Orada ayrışma AYLAR sonra Codex tarafından
// bulundu. Burada baştan bağlanıyor: eşik sayıları **elle yazılmıyor**,
// `mevzuat.service.ts`ten alınıp göç metninde ARANIYOR.
//
// ⚠️ Bu dosya tek başına "kapı çalışıyor" DEMEZ. Metin okur, davranış
// ölçmez. Kapının kilitlediğini yalnız `db/prova/prova-0113.sql` gösterir.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'
import { yorumsuzKod } from '../core/test-support/kaynak-soyma'
import {
  ADRES_EN_COK,
  BASLIK_EN_AZ,
  BASLIK_EN_COK,
  KAYNAK_EN_AZ,
  KAYNAK_EN_COK,
  MEVZUAT_TURLERI,
  OZET_EN_COK,
  VITRIN_HABER_SINIRI,
  VITRIN_SATIR_SINIRI,
} from './mevzuat.service'

const KOK = projeKokunuBul()
const GOC_YOLU = 'db/migrations/0113_mevzuat_akisi.sql'
const GOC_0114_YOLU = 'db/migrations/0114_mevzuat_kutuphanesi.sql'

const dosya = (yol: string): string => readFileSync(join(KOK, yol), 'utf8') as string

/**
 * SQL'in YORUMSUZ hâli.
 *
 * ⚠️ TUZAK 181/194: göçler kaldırılan kodu ve yasakladıkları metni
 * bilerek alıntılıyor — hem yorumda hem hata mesajında. Bu dosyadaki
 * iddialar yorumları silmek ZORUNDA, yoksa göçün kendi açıklamasına
 * takılırlar.
 */
const sqlKod = (metin: string): string => metin.replace(/--[^\n]*/g, '')

/** Kaynak dosyanın yorumsuz hâli (ikizi yazılmaz, tek kopyadan alınır). */
const kod = (yol: string): string => yorumsuzKod(dosya(yol))

const GOC = sqlKod(dosya(GOC_YOLU))

/**
 * ⚠️ İKİ GÖÇ VAR VE AYRIMI ÖNEMLİ.
 *
 * `GOC` (0113) tabloyu ve ilk kapıları KURDU. `GOC_0114` okuma ve yazma
 * fonksiyonlarını DÜŞÜRÜP YENİDEN YAZDI; yani **yürürlükteki** fonksiyon
 * gövdeleri 0114'tedir.
 *
 * ⚠️ TUZAK 190'IN AYNISI BURADA KAPIDA DURUYOR: bu dosyanın 0113'teki
 * `YAYINDA` süzgecini ölçmesi artık YETMEZ — 0114 o fonksiyonu yeniden
 * yazdı. Yürürlükteki gövdeye bakan iddialar aşağıda, `GOC_0114` üzerinden.
 */
const GOC_0114 = sqlKod(dosya(GOC_0114_YOLU))

describe('sağlama · ölçüm gerçekten çalışıyor', () => {
  it('göç dosyası var ve büyük', () => {
    // ⚠️ Tuzak 58 · hiçbir şey bulamayan bir test "temiz" der.
    expect(existsSync(join(KOK, GOC_YOLU))).toBe(true)
    expect(GOC.length).toBeGreaterThan(5_000)
  })

  it('yorum soyma iş yapıyor ama kuralı silmiyor', () => {
    expect(dosya(GOC_YOLU).length).toBeGreaterThan(GOC.length)
    expect(GOC).toContain('create table if not exists public.regulation_news')
  })
})

describe('tablo kapalı · erişim yalnız fonksiyondan', () => {
  it('⚠️ RLS açık VE zorunlu', () => {
    expect(GOC).toContain('alter table public.regulation_news enable row level security')
    expect(GOC).toContain('alter table public.regulation_news force  row level security')
  })

  it('⚠️ tabloya POLİTİKA yazılmamış (kapalı kapı)', () => {
    // 0106'nın kararı: politika yoksa hiçbir satır geçmez.
    expect(GOC).not.toMatch(/create policy[\s\S]{0,80}regulation_news/)
  })

  it('⚠️ anon/authenticated için tabloda yetki YOK', () => {
    expect(GOC).toContain('revoke all on public.regulation_news from anon, authenticated')
    expect(GOC).not.toMatch(/grant (select|insert|update|delete|all)[^\n]*regulation_news/)
  })

  it('⚠️ depo tabloya DOĞRUDAN dokunmuyor — her çağrı RPC', () => {
    // 0113 `anon`/`authenticated` rollerine yetki vermiyor; `.from(...)`
    // yazan biri 42501 alır. Bu, katman kuralının yanındaki ikinci güvence.
    const depo = kod('src/platform/mevzuat.repository.ts')
    expect(depo).not.toContain("from('regulation_news')")
    expect(depo).toContain("rpc('mevzuat_akisi_oku'")
  })
})

describe('vitrin · yalnız yayındakiler, kaynaklı', () => {
  it('⚠️ herkese açık okuma YALNIZ `YAYINDA` satırları döndürüyor', () => {
    const bas = GOC.indexOf('create or replace function public.mevzuat_akisi_oku')
    const son = GOC.indexOf('end $$;', bas)
    expect(bas).toBeGreaterThan(-1)
    const govde = GOC.slice(bas, son)
    // Sağlama: kesim gerçekten sorguyu kapsıyor.
    expect(govde).toContain('from public.regulation_news')
    expect(govde).toContain("where r.status = 'YAYINDA'")
  })

  it('⚠️ `status` ve imza alanları vitrine ÇIKMIYOR', () => {
    const bas = GOC.indexOf('create or replace function public.mevzuat_akisi_oku')
    const basliklarSonu = GOC.indexOf(')', GOC.indexOf('returns table (', bas))
    const donenAlanlar = GOC.slice(bas, basliklarSonu)
    for(const yasak of ['durum', 'created_by', 'updated_by', 'yazan']){
      expect(donenAlanlar, `${yasak} vitrine çıkıyor`).not.toContain(yasak)
    }
  })

  it('⚠️ satır sayısı tavanı SUNUCUDA', () => {
    // İstemci "hepsini ver" diyememeli.
    expect(GOC).toMatch(/least\(greatest\(coalesce\(p_limit/)
  })

  it('kaynak adı ve adresi ZORUNLU', () => {
    expect(GOC).toMatch(/source_name {2,}text not null/)
    expect(GOC).toMatch(/source_url {5,}text not null/)
  })

  it('⚠️ kaynak adresi `https://` olmak ZORUNDA (tıklanabilir bağlantı)', () => {
    // `javascript:` bir değer yazılabilseydi, panele erişen biri
    // ziyaretçinin tarayıcısında kod çalıştırabilirdi.
    expect(GOC).toContain("source_url ~ '^https://[^[:space:]]+$'")
  })

  it('⚠️ vitrin bileşeni `storage`dan BESLENMİYOR', () => {
    // O dosyadaki okuyucular depo boşken demo satır üretiyordu
    // (HEDEFLER 3.10) ve burası müşterinin gördüğü İLK ekran.
    const vitrin = kod('src/pages/MevzuatVitrin.tsx')
    expect(vitrin).not.toContain("from '../storage'")
    expect(vitrin).toContain('PostgresMevzuatDefteri')
  })

  it('⚠️ kayıt yoksa bölüm HİÇ çizilmiyor', () => {
    const vitrin = kod('src/pages/MevzuatVitrin.tsx')
    expect(vitrin).toContain('vitrinGosterilsinMi')
    expect(vitrin).toMatch(/if\(!vitrinGosterilsinMi\([^)]*\)\) return null/)
  })

  it('⚠️ dış bağlantı `rel="noopener noreferrer"` taşıyor', () => {
    const vitrin = kod('src/pages/MevzuatVitrin.tsx')
    expect(vitrin).toContain('rel="noopener noreferrer"')
  })

  it('vitrin giriş ekranına BAĞLI (bölüm kaybolmasın)', () => {
    // Bileşen ayrı dosyada; Login.tsx onu çizmiyorsa kimse göremez ve
    // kimse fark etmez — ekran yine açılır, yine düzgün görünür.
    expect(kod('src/pages/Login.tsx')).toContain('<MevzuatVitrin />')
  })
})

describe('yönetim · yalnız platform', () => {
  it('⚠️ yazma, listeleme ve silme `app.platform_kapisi()` ardında', () => {
    for(const ad of ['mevzuat_listesi', 'mevzuat_yaz', 'mevzuat_sil']){
      const bas = GOC.indexOf(`create or replace function app.${ad}`)
      expect(bas, `${ad} bulunamadı`).toBeGreaterThan(-1)
      const govde = GOC.slice(bas, GOC.indexOf('end $$;', bas))
      expect(govde, `${ad} kapısız`).toContain('app.platform_kapisi()')
    }
  })

  it('⚠️ `anon` yönetim kapılarını çağıramıyor, vitrini çağırabiliyor', () => {
    expect(GOC).toMatch(/grant execute on function public\.mevzuat_akisi_oku\(integer\) '?\s*\n?\s*'?to anon/)
    const kapaliBlok = GOC.slice(GOC.indexOf("'public.mevzuat_listesi()'"))
    expect(kapaliBlok).toContain('from anon')
  })

  it('⚠️ İMZA parametre olarak BİLE yok (0087)', () => {
    const bas = GOC.indexOf('create or replace function app.mevzuat_yaz')
    const imzaSonu = GOC.indexOf(')', GOC.indexOf('p_durum', bas))
    const parametreler = GOC.slice(bas, imzaSonu)
    for(const yasak of ['p_created_by', 'p_updated_by', 'p_created_at', 'p_updated_at']){
      expect(parametreler, `${yasak} parametreye girmiş`).not.toContain(yasak)
    }
  })

  it('yeni izin AÇILMAMIŞ — mevcut `platform.manage` kullanılıyor', () => {
    // İzin kataloğuna ekleme yapmak bir mimari testi kırar (tuzak 52) ve
    // burada yeni bir izne gerek yok.
    expect(GOC).not.toContain('insert into public.permission')
    expect(GOC).not.toContain('insert into permission')
  })

  it('EVREN360 kaydı var ve veritabanı okuduğunu söylüyor', () => {
    const kayit = kod('src/platform/platform.registry.ts')
    expect(kayit).toContain("route: 'evren360-mevzuat'")
    expect(kayit).toContain("kaynakDosya: 'pages/MevzuatAkisi.tsx'")
    const bas = kayit.indexOf("id: 'platform-mevzuat'")
    expect(bas).toBeGreaterThan(-1)
    expect(kayit.slice(bas, bas + 700)).toContain("veriKaynagi: 'veritabani'")
  })

  it('rota kapısı App.tsx içinde ve platform yöneticisine bağlı', () => {
    const uygulama = kod('src/App.tsx')
    const bas = uygulama.indexOf("route === 'evren360-mevzuat'")
    expect(bas).toBeGreaterThan(-1)
    const blok = uygulama.slice(bas, bas + 320)
    expect(blok).toContain('isPlatformAdmin')
    expect(blok).toContain('<MevzuatAkisi />')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// EKRAN İLE VERİTABANI AYNI ŞEYİ İSTİYOR MU · MIYOP-105'in dersi
//
// ⚠️ Sayılar ELLE YAZILMIYOR: `mevzuat.service.ts`ten alınıp göç metninde
// aranıyor. Biri değişip diğeri kalırsa bu blok kırmızı yanar.
// ═══════════════════════════════════════════════════════════════════════════
describe('eşikler ekranla veritabanında aynı (MIYOP-105)', () => {
  it('sağlama · eşikler gerçekten okunabildi', () => {
    for(const sayi of [BASLIK_EN_AZ, BASLIK_EN_COK, OZET_EN_COK,
                       KAYNAK_EN_AZ, KAYNAK_EN_COK, ADRES_EN_COK]){
      expect(Number.isFinite(sayi) && sayi > 0).toBe(true)
    }
  })

  it('⚠️ başlık eşiği aynı', () => {
    expect(GOC).toContain(`between ${BASLIK_EN_AZ} and ${BASLIK_EN_COK}`)
  })

  it('⚠️ özet eşiği aynı', () => {
    expect(GOC).toContain(`length(summary) <= ${OZET_EN_COK}`)
  })

  it('⚠️ kaynak adı eşiği aynı', () => {
    expect(GOC).toContain(`between ${KAYNAK_EN_AZ} and ${KAYNAK_EN_COK}`)
  })

  it('⚠️ kaynak adresi uzunluk eşiği aynı', () => {
    expect(GOC).toContain(`length(source_url) <= ${ADRES_EN_COK}`)
  })

  it('vitrin satır sınırı makul ve sunucu tavanının altında', () => {
    // ⚠️ Tavan 0114'te 20'den 30'a çıktı (kütüphane + akış bir arada).
    expect(VITRIN_SATIR_SINIRI).toBeGreaterThan(0)
    expect(VITRIN_SATIR_SINIRI).toBeLessThanOrEqual(30)
    expect(GOC_0114).toContain('least(greatest(coalesce(p_limit, 12), 1), 30)')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// GÖÇ 0114 · KÜTÜPHANE · YÜRÜRLÜKTEKİ GÖVDELER
//
// ⚠️ Yukarıdaki blok 0113'ün KURDUĞU dünyayı okuyor. Fonksiyonların
// bugünkü hâli 0114'te. Aşağıdaki iddialar oraya bakıyor.
// ═══════════════════════════════════════════════════════════════════════════
describe('0114 · kütüphane', () => {
  it('sağlama · göç dosyası var ve büyük', () => {
    expect(existsSync(join(KOK, GOC_0114_YOLU))).toBe(true)
    expect(GOC_0114.length).toBeGreaterThan(5_000)
    expect(dosya(GOC_0114_YOLU).length).toBeGreaterThan(GOC_0114.length)
  })

  it('⚠️ FONKSİYONLAR ÖNCE DÜŞÜRÜLÜYOR (yanına ikincisi konmuyor)', () => {
    // `create or replace` dönüş tipi ya da parametre sayısı değişince
    // eskisini DEĞİŞTİRMEZ, yanına ikincisini koyar; çağrılar belirsizleşir.
    expect(GOC_0114).toContain('drop function if exists public.mevzuat_akisi_oku(integer)')
    expect(GOC_0114).toMatch(
      /drop function if exists public\.mevzuat_yaz\(uuid, text, text, text, text, date, text\)/)
    expect(GOC_0114).toMatch(
      /drop function if exists app\.mevzuat_yaz\(uuid, text, text, text, text, date, text\)/)
  })

  it('⚠️ YÜRÜRLÜKTEKİ vitrin okuması yalnız `YAYINDA` döndürüyor', () => {
    const bas = GOC_0114.indexOf('create or replace function public.mevzuat_akisi_oku')
    expect(bas).toBeGreaterThan(-1)
    const govde = GOC_0114.slice(bas, GOC_0114.indexOf('end $$;', bas))
    expect(govde).toContain('from public.regulation_news')
    expect(govde).toContain("where r.status = 'YAYINDA'")
  })

  it('⚠️ YÜRÜRLÜKTEKİ vitrin `status` ve imza alanlarını DIŞARI VERMİYOR', () => {
    const bas = GOC_0114.indexOf('create or replace function public.mevzuat_akisi_oku')
    const basliklarSonu = GOC_0114.indexOf(')', GOC_0114.indexOf('returns table (', bas))
    const donenAlanlar = GOC_0114.slice(bas, basliklarSonu)
    expect(donenAlanlar).toContain('tur')
    for(const yasak of ['durum', 'created_by', 'updated_by', 'yazan']){
      expect(donenAlanlar, `${yasak} vitrine çıkıyor`).not.toContain(yasak)
    }
  })

  it('⚠️ SIRA SUNUCUDA ve istemcideki tür sırasıyla AYNI', () => {
    // Emrah'ın 10.11'de ekranda gördüğü kusur buydu: 2011 tarihli bir
    // yönetmelik bugünkü bir haberin ALTINA düşmüştü. Sıra artık sunucuda
    // sabit; `mevzuat.service.ts`teki `MEVZUAT_TURLERI` o sıranın kopyası
    // DEĞİL, aynı sıranın okunduğu yer — bu iddia ikisini bağlıyor.
    const bas = GOC_0114.indexOf('order by case r.kind')
    expect(bas).toBeGreaterThan(-1)
    const blok = GOC_0114.slice(bas, GOC_0114.indexOf('end,', bas))
    MEVZUAT_TURLERI.slice(0, 3).forEach((tur, i) => {
      expect(blok, `${tur} sırası ${i + 1} değil`)
        .toMatch(new RegExp(`when '${tur}'\\s+then ${i + 1}`))
    })
    // Son tür (`HABER`) `else` dalında: akış her zaman en altta.
    expect(MEVZUAT_TURLERI[3]).toBe('HABER')
    expect(blok).toMatch(/else 4/)
  })

  it('⚠️ TÜR ZORUNLU — ekranla veritabanı aynı cümleyi söylüyor', () => {
    const bas = GOC_0114.indexOf('create or replace function app.mevzuat_yaz')
    expect(bas).toBeGreaterThan(-1)
    const govde = GOC_0114.slice(bas, GOC_0114.indexOf('end $$;', bas))
    expect(govde).toContain('app.platform_kapisi()')
    expect(govde).toContain(
      'Tür seçilmedi (kanun, yönetmelik, tebliğ ya da haber).')
    expect(govde).toContain("using errcode = 'MI422'")
  })

  it('⚠️ istemcideki dört tür, veritabanının kısıtındaki dört tür', () => {
    const bas = GOC_0114.indexOf('regulation_news_tur_gecerli check')
    expect(bas).toBeGreaterThan(-1)
    const kisit = GOC_0114.slice(bas, bas + 200)
    for(const tur of MEVZUAT_TURLERI){
      expect(kisit, `${tur} kısıtta yok`).toContain(`'${tur}'`)
    }
  })

  it('⚠️ varsayılan HABER (var olan satırın türü sessizce değişmiyor)', () => {
    expect(GOC_0114).toContain("add column if not exists kind text not null default 'HABER'")
  })

  it('⚠️ DÜŞEN FONKSİYONLARIN YETKİLERİ GERİ VERİLİYOR (tuzak 67)', () => {
    // `drop function` GRANT'ları da siler. Verilmezse giriş ekranı
    // "permission denied" alır ve kutu SESSİZCE boş kalır.
    expect(GOC_0114).toMatch(
      /grant execute on function[\s\S]{0,80}public\.mevzuat_akisi_oku\(integer\)[\s\S]{0,40}to anon/)
    for(const ad of ['mevzuat_listesi', 'mevzuat_yaz', 'mevzuat_sil']){
      expect(GOC_0114, `${ad} yetkisi geri verilmemiş`).toContain(ad)
    }
    // Yönetim kapıları anon'a KAPALI kalıyor.
    expect(GOC_0114).toMatch(/revoke[\s\S]{0,200}from anon/)
  })

  it('⚠️ İKİNCİ TABLO AÇILMAMIŞ (iki yerde iki gerçek yok)', () => {
    expect(GOC_0114).not.toMatch(/create table[\s\S]{0,60}(mevzuat|regulation)/)
  })

  it('⚠️ ekran kendi SIRASINI kurmuyor, sunucunun sırasını koruyor', () => {
    const hizmet = kod('src/platform/mevzuat.service.ts')
    const bas = hizmet.indexOf('export const mevzuatiGruplara')
    expect(bas).toBeGreaterThan(-1)
    const govde = hizmet.slice(bas, bas + 1_200)
    // Gruplayıcıda sıralama YOK: `.sort(` yazılsaydı sunucudaki
    // `case r.kind` ile ikinci bir gerçek olurdu.
    expect(govde).not.toContain('.sort(')
    const vitrin = kod('src/pages/MevzuatVitrin.tsx')
    expect(vitrin).toContain('mevzuatiGruplara')
    expect(vitrin).not.toContain('.sort(')
  })

  it('haber kırpma sınırı makul', () => {
    expect(VITRIN_HABER_SINIRI).toBeGreaterThan(0)
    expect(VITRIN_HABER_SINIRI).toBeLessThanOrEqual(VITRIN_SATIR_SINIRI)
  })

  it('yönetim ekranı tür seçiciyi çiziyor ve boş başlıyor', () => {
    const ekran = kod('src/pages/MevzuatAkisi.tsx')
    expect(ekran).toContain('MEVZUAT_TURLERI.map')
    expect(ekran).toContain('htmlFor="mv-tur"')
    // ⚠️ Boş seçenek: varsayılan geçerli bir tür konsaydı "tür seçilmedi"
    // kuralı hiç çalışmaz ve bir kanun haber olarak yayına alınabilirdi.
    expect(ekran).toContain('<option value="">')
    expect(ekran).toMatch(/tur: '',/)
  })
})

describe('prova · kapının içinde koşuyor', () => {
  const PROVALAR = [
    'db/prova/prova-0113.sql', 'db/prova/prova-0113-ters.sql',
    'db/prova/prova-0114.sql', 'db/prova/prova-0114-ters.sql',
  ]

  it('prova dosyaları var', () => {
    for(const p of PROVALAR) expect(existsSync(join(KOK, p)), `${p} yok`).toBe(true)
  })

  it('⚠️ provalar İSTEMCİ ROLLERİNE giriyor (MIYOP-042)', () => {
    // Rol takmayan prova kapının DIŞINDA koşar: her yazım sessizce geçer
    // ve prova yeşil görünür. Ters provanın SAHNESİ de kapının içinde
    // kurulur (tuzak 197).
    for(const p of PROVALAR){
      expect(dosya(p), `${p} authenticated rolü takmıyor`)
        .toContain('set local role authenticated')
    }
    expect(dosya('db/prova/prova-0113.sql')).toContain('set local role anon')
    expect(dosya('db/prova/prova-0114.sql')).toContain('set local role anon')
  })

  it('⚠️ prova OLUMSUZ kontroller içeriyor', () => {
    // İzinli çağrının geçtiğini görmek kapının yarısıdır; asıl kanıt
    // izinsiz çağrının reddedilmesi.
    const metin = dosya('db/prova/prova-0113.sql')
    for(const kodu of ['MI403', 'MI422']){
      expect(metin, `prova ${kodu} durumunu sınamıyor`).toContain(kodu)
    }
    expect(metin).toContain('javascript:')
    // 0114'ün olumsuzu: tür yazılmadan ve uydurma türle yazım REDDEDİLİYOR.
    const yeni = dosya('db/prova/prova-0114.sql')
    expect(yeni).toContain('MI422')
    expect(yeni).toContain('DUYURU')
  })

  it('provalar veritabanını kirletmiyor', () => {
    for(const p of PROVALAR){
      expect(dosya(p).trimEnd().endsWith('rollback;'), `${p} rollback ile bitmiyor`).toBe(true)
    }
  })
})
