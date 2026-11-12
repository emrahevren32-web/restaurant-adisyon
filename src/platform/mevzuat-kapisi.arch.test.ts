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
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
// MIYOP-108 · YETKİ TABLOSU · FONKSİYON × İMZA × ROL AYRI AYRI ÖLÇÜLÜYOR
//
// ── NE YANLIŞTI (Codex 4. tur) ───────────────────────────────────────────
// İlk hâli "düşen fonksiyonların yetkileri geri veriliyor" diyordu ama
// ölçtüğü şey şuydu: üç yönetim fonksiyonunun ADI göçte geçiyor mu
// (`toContain(ad)`) ve göçün HERHANGİ bir yerinde `revoke … from anon` var
// mı. Fonksiyon adı zaten TANIMINDA geçer: GRANT satırı silinse de test
// yeşil kalırdı. İddia, ölçtüğünden büyüktü.
//
// ── ŞİMDİ NE ÖLÇÜLÜYOR ───────────────────────────────────────────────────
// 0114'ün yetki cümleleri AYRIŞTIRILIYOR (döngüler açılarak) ve her
// "fonksiyon(tam imza) → rol" çifti için SON SÖZ çıkarılıyor: grant mı,
// revoke mu. Beklenen tablo aşağıda AÇIK yazılı; fazlası da eksiği de
// kırmızı yanar.
//
// ⚠️ ÖLÇÜMÜN KENDİSİ DE ÖLÇÜLÜYOR: göç metninden yönetim GRANT satırı
// çıkarılıp tablo yeniden kuruluyor ve iddianın O ZAMAN bozulduğu
// gösteriliyor. Emniyet kaldırılınca da yeşil yanan bir test hiçbir şey
// ölçmüyordur (tuzak 197).
//
// ⚠️ SINIRI: bu blok göç METNİNİ okur. Yetkinin veritabanında GERÇEKTEN
// öyle olduğunu `db/prova/prova-0114.sql` canlı çağrıyla ölçüyor; ikisi
// birbirinin yerine geçmez.
// ═══════════════════════════════════════════════════════════════════════════
type YetkiSozu = 'grant' | 'revoke'

/** Göç metnindeki yetki cümlelerini SIRAYLA işleyip son sözü döndürür. */
const yetkiTablosu = (sql: string): Map<string, YetkiSozu> => {
  const tablo = new Map<string, YetkiSozu>()
  const isle = (ham: string): void => {
    const cumle = ham.replace(/\s+/g, ' ').trim()
    const ver = /^grant execute on function (.+?) to (.+)$/.exec(cumle)
    const al = /^revoke all on function (.+?) from (.+)$/.exec(cumle)
    const m = ver ?? al
    if(m === null) return
    const fonksiyon = (m[1] as string).trim()
    for(const rol of (m[2] as string).split(',').map(r => r.trim()).filter(r => r !== '')){
      tablo.set(`${fonksiyon} → ${rol}`, ver !== null ? 'grant' : 'revoke')
    }
  }
  // Üç biçim, METİNDEKİ SIRASIYLA:
  //   1 · foreach v_ad in array array['f1', 'f2'] loop
  //         execute format('… %s …', v_ad); … end loop;
  //   2 · execute '…' '…';            (parçalı düz cümle)
  //   3 · grant … ; / revoke … ;      (dinamik olmayan düz cümle)
  const desen = new RegExp(
    "foreach v_ad in array array\\[([\\s\\S]*?)\\]\\s*loop([\\s\\S]*?)end loop;"
    + "|execute((?:\\s*'[^']*')+)\\s*;"
    + "|(?:^|\\n)\\s*((?:grant execute|revoke all) on function [^;]+);", 'g')
  let m: RegExpExecArray | null
  while((m = desen.exec(sql)) !== null){
    if(m[1] !== undefined && m[2] !== undefined){
      const fonksiyonlar = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1] as string)
      const kaliplar = [...m[2].matchAll(/execute format\('([^']+)', v_ad\);/g)]
        .map(x => x[1] as string)
      for(const f of fonksiyonlar) for(const k of kaliplar) isle(k.replace('%s', f))
    } else if(m[3] !== undefined){
      isle([...m[3].matchAll(/'([^']*)'/g)].map(x => x[1] as string).join(''))
    } else if(m[4] !== undefined){
      isle(m[4])
    }
  }
  return tablo
}

const YAZ_IMZASI = '(uuid, text, text, text, text, date, text, text)'

/** Beklenen tablo: fonksiyon(tam imza) → rol → son söz. ELLE ve AÇIK. */
const BEKLENEN_YETKI: Record<string, Record<string, YetkiSozu>> = {
  // Vitrin: giriş ekranı oturumsuz okuyor.
  'public.mevzuat_akisi_oku(integer)': {
    public: 'revoke', anon: 'grant', authenticated: 'grant', service_role: 'grant' },
  // Yönetim kabukları: oturumlu çağırır, içerideki kapı platformu arar.
  'public.mevzuat_listesi()': {
    public: 'revoke', anon: 'revoke', authenticated: 'grant', service_role: 'grant' },
  [`public.mevzuat_yaz${YAZ_IMZASI}`]: {
    public: 'revoke', anon: 'revoke', authenticated: 'grant', service_role: 'grant' },
  'public.mevzuat_sil(uuid)': {
    public: 'revoke', anon: 'revoke', authenticated: 'grant', service_role: 'grant' },
  // `app` yardımcıları: istemci rollerinin HİÇBİRİNE açık değil.
  'app.mevzuat_listesi()': {
    public: 'revoke', anon: 'revoke', authenticated: 'revoke', service_role: 'grant' },
  [`app.mevzuat_yaz${YAZ_IMZASI}`]: {
    public: 'revoke', anon: 'revoke', authenticated: 'revoke', service_role: 'grant' },
  'app.mevzuat_sil(uuid)': {
    public: 'revoke', anon: 'revoke', authenticated: 'revoke', service_role: 'grant' },
}

describe('0114 · yetki tablosu · fonksiyon × imza × rol (MIYOP-108)', () => {
  const TABLO = yetkiTablosu(GOC_0114)
  const beklenenCiftler = Object.entries(BEKLENEN_YETKI)
    .flatMap(([f, roller]) => Object.keys(roller).map(rol => `${f} → ${rol}`))

  it('sağlama · ayrıştırıcı gerçekten cümle buldu', () => {
    expect(TABLO.size, 'yetki cümlesi ayrıştırılamadı').toBeGreaterThan(0)
    expect(beklenenCiftler).toHaveLength(28)
  })

  for(const [fonksiyon, roller] of Object.entries(BEKLENEN_YETKI)){
    it(`⚠️ ${fonksiyon} · her rolün son sözü beklendiği gibi`, () => {
      for(const [rol, soz] of Object.entries(roller)){
        expect(
          TABLO.get(`${fonksiyon} → ${rol}`),
          `${fonksiyon} için ${rol} rolünün son sözü "${soz}" olmalıydı. `
          + 'Göçte bu çift için AÇIK bir cümle yoksa `undefined` görünür: '
          + 'düşürülüp yeniden yazılan fonksiyon varsayılan olarak PUBLIC\'e '
          + 'açıktır (tuzak 67).',
        ).toBe(soz)
      }
    })
  }

  it('⚠️ tabloda BEKLENMEYEN çift yok (fazladan açılmış kapı)', () => {
    expect([...TABLO.keys()].sort()).toEqual([...beklenenCiftler].sort())
  })

  it('⚠️ yönetim kapılarının HİÇBİRİ anon\'a açık değil', () => {
    const acik = [...TABLO.entries()]
      .filter(([cift, soz]) => soz === 'grant' && cift.endsWith('→ anon'))
      .map(([cift]) => cift)
    expect(acik).toEqual(['public.mevzuat_akisi_oku(integer) → anon'])
  })

  it('⚠️ DÜŞÜRÜLEN her fonksiyonun yenisi tabloda (tuzak 67)', () => {
    // `drop function` GRANT'ları da siler. Düşürülen her adın yürürlükteki
    // imzası için en az bir AÇIK grant cümlesi olmak zorunda.
    const dusenler = [...GOC_0114.matchAll(
      /drop function if exists ((?:public|app)\.[a-z_]+)\(/g)].map(x => x[1] as string)
    expect(dusenler.length, 'düşürülen fonksiyon bulunamadı').toBeGreaterThanOrEqual(5)
    for(const ad of new Set(dusenler)){
      const verilen = [...TABLO.entries()]
        .filter(([cift, soz]) => soz === 'grant' && cift.startsWith(`${ad}(`))
      expect(verilen.length, `${ad} düşürüldü ama yetkisi geri verilmedi`)
        .toBeGreaterThan(0)
    }
  })

  it('⚠️ TERS ÖLÇÜM · yönetim GRANT satırı çıkarılınca iddia BOZULUYOR', () => {
    // Codex'in kabul ölçütü: "Yönetim GRANT'larından biri çıkarıldığında
    // ilgili iddia başarısız olmalı." Burada göç metni BELLEKTE bozuluyor.
    const satir = "execute format('grant execute on function %s to authenticated, service_role', v_ad);"
    expect(GOC_0114, 'yönetim GRANT satırı göçte bulunamadı').toContain(satir)
    const bozuk = yetkiTablosu(GOC_0114.replace(satir, ''))
    for(const f of ['public.mevzuat_listesi()', `public.mevzuat_yaz${YAZ_IMZASI}`,
      'public.mevzuat_sil(uuid)']){
      expect(TABLO.get(`${f} → authenticated`)).toBe('grant')
      expect(bozuk.get(`${f} → authenticated`), `${f}: ölçüm eksik GRANT'ı görmüyor`)
        .not.toBe('grant')
    }
    // Tek bir fonksiyon listeden çıkarılınca da görülüyor.
    const eksik = yetkiTablosu(GOC_0114.replace(
      `'public.mevzuat_yaz${YAZ_IMZASI}',`, ''))
    expect(eksik.get(`public.mevzuat_yaz${YAZ_IMZASI} → authenticated`))
      .toBeUndefined()
  })

  it('⚠️ 0114\'ten SONRAKİ hiçbir göç bu fonksiyonlara dokunmuyor', () => {
    // Dokunursa yürürlükteki tanım ve yetkiler ARTIK O GÖÇTEDİR ve bu blok
    // geçersiz bir göçü savunmaya başlar (tuzak 190). O gün bu blok yeni
    // göçe TAŞINMALI; test bunu sessizce geçmek yerine burada durduruyor.
    const klasor = join(KOK, 'db/migrations')
    const sonrakiler = (readdirSync(klasor) as string[])
      .filter(ad => /^[0-9]{4}_.+\.sql$/.test(ad) && ad.slice(0, 4) > '0114')
      .sort()
    const dokunan = sonrakiler.filter(ad =>
      /\b(?:public|app)\.mevzuat_(?:akisi_oku|listesi|yaz|sil)\b/
        .test(sqlKod(readFileSync(join(klasor, ad), 'utf8') as string)))
    expect(
      dokunan,
      'Bu göç(ler) mevzuat fonksiyonlarına dokunuyor; yetki tablosu ve '
      + 'gövde iddiaları o göçe taşınmalı: ' + dokunan.join(', '),
    ).toEqual([])
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

  it('⚠️ YÜRÜRLÜKTEKİ yönetim listesi de kapının ardında ve türü döndürüyor', () => {
    // Codex 4. tur: 0113'teki gövde ölçülüyordu; 0114 listeyi DÜŞÜRÜP
    // yeniden yazdı. Yürürlükteki gövde ayrıca ölçülmezse tuzak 190.
    const bas = GOC_0114.indexOf('create or replace function app.mevzuat_listesi()')
    expect(bas, 'yürürlükteki yönetim listesi bulunamadı').toBeGreaterThan(-1)
    const govde = GOC_0114.slice(bas, GOC_0114.indexOf('end $$;', bas))
    expect(govde, 'yönetim listesi kapısız').toContain('perform app.platform_kapisi();')
    // Kapı `return query`den ÖNCE (0083: WHERE içindeki kapı boş listede susar).
    expect(govde.indexOf('perform app.platform_kapisi();'))
      .toBeLessThan(govde.indexOf('return query'))
    expect(govde).toContain('r.kind')
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
