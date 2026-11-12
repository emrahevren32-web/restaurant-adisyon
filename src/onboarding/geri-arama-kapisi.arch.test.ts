// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — GERİ ARAMA FORMU SÖZÜNÜ TUTUYOR MU (0106)
//
// ── NE ÖLÇÜYOR ───────────────────────────────────────────────────────────
// Ana ekrandaki form üç şey iddia ediyor:
//   1. "Bilgileriniz kaydedildi"  → kayıt gerçekten veritabanına gidiyor,
//                                    tarayıcı hafızasına DEĞİL.
//   2. "Onayınız olmadan işlemiyoruz" → onay bir kutu değil, NOT NULL kolon.
//   3. "Onay verdiğiniz metin bu"  → damgalanan sürüm, GÖSTERİLEN metnin
//                                    özetiyle bağlı; ayrışamıyor.
// Bu dosya üçünü de göç metnine ve kaynak dosyalara BAKARAK ölçüyor.
//
// ⚠️ ÜÇ KATMAN, ÜÇ AYRI SINAMA — hiçbiri ötekinin yerine geçmez:
//   · `geri-arama.test.ts`        → kural (saf fonksiyonlar, bellek defteri)
//   · bu dosya                    → sözleşme (göç metni ↔ kod sabitleri)
//   · `db/prova/prova-0106.sql`   → KAPI (gerçek PostgreSQL, gerçek roller)
// ⚠️ Bu dosya tek başına "kapı çalışıyor" DEMEZ. Metin okur, davranış
// ölçmez. Kapının kilitlediğini yalnız prova gösterir.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gocMetni, projeKokunuBul, tabloGovdeleri } from '../core/test-support/goc-tarama'
// ⚠️ Soyucu TEK KOPYA (MIYOP-089): ikizi yazılmaz, buradan alınır.
import { yorumsuzKod } from '../core/test-support/kaynak-soyma'
import {
  GERI_ARAMA_DURUMLARI,
  KVKK_AYDINLATMA_METNI,
  KVKK_METIN_SURUMU,
  UYGUN_SAATLER,
} from './geri-arama.service'

const KOK = projeKokunuBul()
const SQL = gocMetni()

const dosya = (yol: string): string => readFileSync(join(KOK, yol), 'utf8') as string

/**
 * Kaynak dosyanın YORUMSUZ hâli.
 *
 * ⚠️ BU SATIR BİR HATANIN BEDELİ (06.11.2026). Aşağıdaki iki iddia ham
 * metne bakıyordu ve **kendi açıklama yorumlarıma takıldı**: defterin
 * başlığında *"`.from('callback_request')` yazan biri 42501 alır"* yazıyor,
 * formun başlığında *"başvuru formu Supabase kapalıyken `localStorage`a
 * düşüyor"* yazıyor. İkisi de **yasağı ANLATAN** cümleler; test onları
 * yasağın İHLALİ saydı.
 *
 * Bu depoda yorumlar kaldırılan kodu bilerek kelime kelime alıntılıyor —
 * yoksa bir sonraki kişi aynı şeyi geri yazar. Dolayısıyla kaynağı metin
 * olarak ölçen her iddia yorumsuz metne bakmak ZORUNDA (tuzak 181 ·
 * MIYOP-098 · kontrol listesi 76'nın kod tarafı).
 */
const kod = (yol: string): string => yorumsuzKod(dosya(yol))

/**
 * İki çapa ARASINI keser.
 *
 * ⚠️ Bu da bir hatanın bedeli: `slice(i, i + 600)` yazmıştım ve 600
 * karakter, bir sonraki bloğa taşıyordu. O blokta `geri_arama_listesi`
 * MEŞRU olarak geçiyor (oturumlu kapılar listesi), test onu anon'a açılmış
 * sandı. Sabit uzunluk bir kesim değil, bir TAHMİNDİR; çapa ile kesmek
 * ölçtüğü sınırı kendisi söyler.
 */
const arasi = (bas: string, son: string): string => {
  const i = SQL.indexOf(bas)
  const j = SQL.indexOf(son, i + bas.length)
  expect(i, `çapa bulunamadı: ${bas}`).toBeGreaterThan(-1)
  expect(j, `bitiş çapası bulunamadı: ${son}`).toBeGreaterThan(i)
  return SQL.slice(i, j)
}

describe('sağlama · ölçüm gerçekten çalışıyor', () => {
  it('göç metni okundu ve 0106 içinde', () => {
    expect(SQL.length).toBeGreaterThan(50_000)
    expect(SQL).toContain('0106')
    expect(SQL).toContain('create table if not exists public.callback_request')
  })

  it('0106 göç dosyası diskte', () => {
    expect(existsSync(join(KOK, 'db/migrations/0106_geri_arama_talebi.sql'))).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 1 · KVKK · ONAY VERİLEN METİN İLE GÖSTERİLEN METİN AYRIŞAMAZ
// ═══════════════════════════════════════════════════════════════════════════
describe('KVKK · sürüm metne bağlı', () => {
  it('⚠️ sürümün sonu, GÖSTERİLEN metnin md5 özetinin ilk 8 hanesi', () => {
    const ozet = createHash('md5').update(KVKK_AYDINLATMA_METNI, 'utf8').digest('hex')
    const beklenen = ozet.slice(0, 8)
    expect(
      KVKK_METIN_SURUMU.endsWith(beklenen),
      'Aydınlatma metni değişmiş ama sürüm değişmemiş. Veritabanı her kayda '
      + '"hangi metne onay verildi" diye bu sürümü damgalıyor; sürüm metinden '
      + 'ayrışırsa kayıt, kişinin HİÇ GÖRMEDİĞİ bir metne onay verdiğini '
      + `söyler.\nYeni sürüm şu olmalı: 2026-11-06-${beklenen}\n`
      + '(aynı değeri `app.kvkk_metin_surumu()` içine de yaz).',
    ).toBe(true)
  })

  it('⚠️ veritabanındaki sürüm ile koddaki sürüm AYNI', () => {
    expect(
      SQL,
      'Damgayı sunucu atıyor. İki taraf ayrışırsa, ekranda gösterilen metin '
      + 'ile kayda yazılan sürüm farklı şeyleri anlatır.',
    ).toContain(`select '${KVKK_METIN_SURUMU}'::text`)
  })

  it('⚠️ sürümü İSTEMCİ GÖNDERMİYOR — parametresi bile yok', () => {
    // Gönderebilseydi kayıt, kişinin görmediği bir metne onay verdiğini
    // söyleyebilirdi.
    const imza = /create or replace function app\.geri_arama_gonder\(([\s\S]*?)\)\s*\nreturns/
      .exec(SQL)?.[1] ?? ''
    expect(imza, 'app.geri_arama_gonder imzası bulunamadı').not.toEqual('')
    expect(imza).not.toMatch(/consent_version|p_consent_version|p_surum/)
    // Onay BOOLEAN olarak var, sürüm yok.
    expect(imza).toMatch(/p_consent\s+boolean/)
  })

  it('⚠️ onay metni saklama SÜRESİ vaat etmiyor', () => {
    // Kendiliğinden silen bir iş (cron) kurulu değil. Süre yazmak,
    // tutulmayacak bir söz olurdu — ve göç bunu gerekçesiyle yazıyor.
    expect(KVKK_AYDINLATMA_METNI).not.toMatch(/\d+\s*(ay|yıl|gün)/i)
    expect(SQL).toContain('OTOMATİK SAKLAMA SÜRESİ YOK')
  })

  it('⚠️ silme hakkının KARŞILIĞI var (metin boş bir söz değil)', () => {
    expect(KVKK_AYDINLATMA_METNI).toMatch(/sil/i)
    expect(SQL).toContain('create or replace function app.geri_arama_sil(')
    expect(SQL).toContain('create or replace function public.geri_arama_sil(')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2 · ONAY BİR KUTU DEĞİL, BİR KOLON
// ═══════════════════════════════════════════════════════════════════════════
describe('onay · kayıt onaysız oluşamaz', () => {
  it('⚠️ consent_at NOT NULL', () => {
    const govde = tabloGovdeleri(SQL).get('callback_request') ?? ''
    expect(govde, 'callback_request gövdesi bulunamadı').not.toEqual('')
    expect(
      govde.replace(/\s+/g, ' '),
      'Onay kolonu boş geçilebilirse "onay olmadan işlemiyoruz" cümlesi '
      + 'yalnızca ekranın iddiası olur. Kutu atlanabilir, kolon atlanamaz.',
    ).toMatch(/consent_at\s+timestamptz not null/)
  })

  it('onay sürümü de NOT NULL', () => {
    const govde = (tabloGovdeleri(SQL).get('callback_request') ?? '').replace(/\s+/g, ' ')
    expect(govde).toMatch(/consent_version\s+text not null/)
  })

  it('⚠️ onay İLK kontrol — doğrulama bile ondan sonra', () => {
    const govde = SQL.slice(SQL.indexOf('create or replace function app.geri_arama_gonder('))
      .slice(0, 3000)
    const onayYeri = govde.indexOf('p_consent, false) is not true')
    const telefonYeri = govde.indexOf('app.telefon_sadelestir(p_phone)')
    expect(onayYeri).toBeGreaterThan(-1)
    expect(telefonYeri).toBeGreaterThan(-1)
    expect(
      onayYeri,
      'Onay kontrolü telefon doğrulamasından SONRA geliyor. Doğrulama da bir '
      + 'işlemedir: onay yoksa hiçbir kişisel veriye dokunulmamalı.',
    ).toBeLessThan(telefonYeri)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3 · TABLOYA DOĞRUDAN YOL YOK
// ═══════════════════════════════════════════════════════════════════════════
describe('kapı · tek yol fonksiyon', () => {
  it('⚠️ iki tabloda da anon/authenticated yetkisi REVOKE edilmiş', () => {
    expect(SQL).toMatch(/revoke all on public\.callback_request from anon, authenticated;/)
    expect(SQL).toMatch(/revoke all on public\.platform_contact from anon, authenticated;/)
  })

  it('⚠️ göçte tabloya GRANT verilmemiş', () => {
    // Bir gün biri "ekran okuyamıyor" diye GRANT eklemeye kalkarsa burası
    // kırılır ve doğru çözümü söyler: fonksiyon eklenir, yetki değil.
    const grantlar = [...SQL.matchAll(/grant\s+[a-z, ]+\s+on\s+(?:table\s+)?public\.(callback_request|platform_contact)/gi)]
    expect(
      grantlar.map(m => m[0]),
      'Tabloya doğrudan yetki verilmiş. Doğru yol yeni bir `security definer` '
      + 'fonksiyon açmaktır; yetki vermek RLS politikası olmadığı için tek '
      + 'savunma hattını da kaldırır.',
    ).toEqual([])
  })

  it('RLS açık VE zorunlu (iki satır, ikisi de şart)', () => {
    for(const tablo of ['callback_request', 'platform_contact']){
      expect(SQL).toContain(`alter table public.${tablo} enable row level security`)
      expect(SQL).toContain(`alter table public.${tablo} force  row level security`)
    }
  })

  it('⚠️ RLS politikası YOK — ve bu kararın kendisi', () => {
    // Politika yoksa hiçbir satır geçmez. Biri "okunamıyor" diye politika
    // eklerse tablo bir anda `authenticated`a açılır.
    expect(SQL).not.toMatch(/create policy\s+\w*callback_request/)
    expect(SQL).not.toMatch(/create policy\s+\w*platform_contact/)
  })

  it('oturumsuz çağrılabilen İKİ kapı var, yalnız ikisi', () => {
    const anonBloku = arasi(
      '-- `public` tarafı · OTURUMSUZ çağrılabilen iki kapı.',
      '-- `public` tarafı · yalnız OTURUMLU',
    )
    expect(anonBloku).toContain('public.geri_arama_gonder')
    expect(anonBloku).toContain('public.platform_iletisim_oku')
    expect(anonBloku).toContain('to anon, authenticated, service_role')
    // Liste UZAMASIN: anon'a açılan her kapı ayrı bir karardır.
    expect(anonBloku).not.toContain('geri_arama_listesi')
    expect(anonBloku).not.toContain('geri_arama_sil')
    expect(anonBloku).not.toContain('platform_iletisim_yaz')
  })

  it('platform kapıları `platform.manage` soruyor', () => {
    for(const fn of ['geri_arama_durumu_yaz', 'geri_arama_sil', 'platform_iletisim_yaz']){
      const govde = SQL.slice(SQL.indexOf(`create or replace function app.${fn}(`)).slice(0, 1800)
      expect(govde, `${fn} izni sormuyor`).toContain("app.yetkim_var('platform.manage')")
    }
    // Okuma ortak kapıdan geçiyor (0083).
    const liste = SQL.slice(SQL.indexOf('create or replace function app.geri_arama_listesi()'))
      .slice(0, 1200)
    expect(liste).toContain('perform app.platform_kapisi()')
  })

  it('⚠️ okuma kapısı gövdenin İLK satırında, WHERE içinde değil', () => {
    // WHERE'e konsaydı, hiç satır yokken izinsiz çağrı hata almadan boş
    // liste alır ve "yetkim var" sanırdı (0083'ün dersi).
    const liste = SQL.slice(SQL.indexOf('create or replace function app.geri_arama_listesi()'))
      .slice(0, 1600)
    expect(liste.indexOf('perform app.platform_kapisi()'))
      .toBeLessThan(liste.indexOf('return query'))
  })

  it('⚠️ `app` sürümleri dışarıya KAPATILMIŞ (tuzak 67)', () => {
    const blok = arasi(
      '-- `app` tarafı: dışarıdan hiç çağrılmaz.',
      '-- `public` tarafı · OTURUMSUZ çağrılabilen iki kapı.',
    )
    expect(blok).toContain("revoke all on function %s from public")
    expect(blok).toContain("revoke all on function %s from anon")
    expect(blok).toContain("revoke all on function %s from authenticated")
    for(const fn of ['app.geri_arama_gonder', 'app.geri_arama_listesi',
      'app.geri_arama_durumu_yaz', 'app.geri_arama_sil', 'app.platform_iletisim_yaz']){
      expect(blok, `${fn} kapatma listesinde yok`).toContain(fn)
    }
  })
})

/**
 * `app.geri_arama_durumu_yaz` fonksiyonunun YÜRÜRLÜKTEKİ (son yazılan) hâli.
 *
 * ⚠️ BU SATIR TUZAK 190'IN BEDELİ (12.11.2026). Aşağıdaki iddialar
 * `SQL.indexOf(...)` ile İLK tanımı (0106) buluyordu. 0116 fonksiyonu
 * yeniden yazınca testler yeşil kaldı — ama artık YÜRÜRLÜKTE OLMAYAN
 * gövdeyi ölçüyorlardı: 0116 imzayı ya da not birikimini düşürseydi
 * kimse fark etmezdi. Ölçüm son tanıma bakmak zorunda.
 *
 * ⚠️ Kesim sabit uzunlukla değil ÇAPAYLA: gövde `end $$;` ile biter.
 */
const DURUM_YAZ_BASI = 'create or replace function app.geri_arama_durumu_yaz('
const etkinDurumYaz = (): { imza: string; govde: string } => {
  const bas = SQL.lastIndexOf(DURUM_YAZ_BASI)
  const son = SQL.indexOf('end $$;', bas)
  expect(bas, 'durum yazma fonksiyonu bulunamadı').toBeGreaterThan(-1)
  expect(son, 'durum yazma gövdesinin sonu bulunamadı').toBeGreaterThan(bas)
  const govde = SQL.slice(bas, son)
  const imza = /\(([\s\S]*?)\)\s*\nreturns/.exec(govde)?.[1] ?? ''
  return { imza, govde }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · İMZAYI SUNUCU ATIYOR
// ═══════════════════════════════════════════════════════════════════════════
describe('imza · "kim aradı" istemciden gelmiyor', () => {
  it('⚠️ durum yazma fonksiyonunda KİŞİ parametresi YOK', () => {
    const { imza } = etkinDurumYaz()
    expect(imza, 'imza bulunamadı').not.toEqual('')
    expect(
      imza,
      'Kimin aradığı parametre olarak gelirse imza, veritabanının kaydı '
      + 'olmaktan çıkıp istemcinin iddiasına döner (0087).',
    ).not.toMatch(/by|kullanici|user|kisi/i)
    expect(imza.split(',')).toHaveLength(3)
  })

  it('imzayı `app.aktif_kullanici_id()` veriyor', () => {
    const { govde } = etkinDurumYaz()
    expect(govde).toContain('app.aktif_kullanici_id()')
    expect(govde).toContain('updated_by   = v_ben')
  })

  it('⚠️ ilk aramanın imzası bir daha DEĞİŞMİYOR', () => {
    const { govde } = etkinDurumYaz()
    expect(govde).toMatch(/contacted_at = case when contacted_at is null/)
    expect(govde).toMatch(/contacted_by = case when contacted_by is null/)
  })

  it('⚠️ not BİRİKİYOR, üstüne yazılmıyor', () => {
    const { govde } = etkinDurumYaz()
    expect(
      govde,
      'Not üstüne yazılırsa geçmiş kaybolur ve olay tablosu da yok.',
    ).toContain("coalesce(contact_note || E'\\n', '') || v_satirim")
  })

  it('kapanış GEREKÇE istiyor', () => {
    const { govde } = etkinDurumYaz()
    expect(govde).toMatch(/v_durum = 'CLOSED' and v_not is null/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5 · KOD İLE VERİTABANI AYNI ŞEYİ SÖYLÜYOR
// ═══════════════════════════════════════════════════════════════════════════
describe('sözleşme · listeler ayrışmıyor', () => {
  it('durum kodları kısıtla birebir', () => {
    const govde = (tabloGovdeleri(SQL).get('callback_request') ?? '').replace(/\s+/g, ' ')
    const beklenen = GERI_ARAMA_DURUMLARI.map(d => `'${d}'`).join(',')
    expect(govde.replace(/\s/g, '')).toContain(`status in (${beklenen})`.replace(/\s/g, ''))
  })

  it('uygun saat kodları kısıtla birebir', () => {
    const govde = (tabloGovdeleri(SQL).get('callback_request') ?? '').replace(/\s+/g, ' ')
    const beklenen = UYGUN_SAATLER.map(d => `'${d}'`).join(',')
    expect(govde.replace(/\s/g, '')).toContain(`best_time in (${beklenen})`.replace(/\s/g, ''))
  })

  it('⚠️ telefon kuralı iki tarafta AYNI', () => {
    // Ayrışırsa ekran kabul ettiğini sunucu reddeder (ya da tersi) ve
    // kullanıcı "neden olmuyor" diye bakar.
    const govde = SQL.slice(SQL.indexOf('create or replace function app.telefon_sadelestir('))
      .slice(0, 1500)
    expect(govde).toContain("('2','3','4','5')")
    expect(govde).toContain('length(v_rakam) <> 10')
    const kod = dosya('src/onboarding/geri-arama.service.ts')
    expect(kod).toContain("['2', '3', '4', '5']")
    expect(kod).toContain("rakam.length !== 10")
  })

  it('telefon kısıtı sadeleşmiş hâli zorluyor', () => {
    const govde = (tabloGovdeleri(SQL).get('callback_request') ?? '').replace(/\s+/g, ' ')
    expect(govde).toContain("phone ~ '^[2-5][0-9]{9}$'")
  })

  it('uzunluk sınırları iki tarafta aynı', () => {
    const govde = (tabloGovdeleri(SQL).get('callback_request') ?? '').replace(/\s+/g, ' ')
    expect(govde).toContain('between 2 and 120')   // ad soyad
    expect(govde).toContain('between 2 and 160')   // işletme adı
    expect(govde).toContain('length(topic) <= 600')
    const kod = dosya('src/onboarding/geri-arama.service.ts')
    expect(kod).toContain('ad.length > 120')
    expect(kod).toContain('firma.length > 160')
    expect(kod).toContain('talep.konu.trim().length > 600')
  })

  it('⚠️ iki numara üretecinin alfabesi AYNI (tekrar ayrışmasın)', () => {
    // 0106 alfabeyi bilerek tekrar yazdı (0033'ü değiştirmemek için).
    // Tekrarın tek bedeli ayrışma olurdu; bu sınama onu engelliyor.
    const alfabe = (fn: string): string =>
      /v_alfabe text := '([^']+)'/.exec(
        SQL.slice(SQL.indexOf(`create or replace function app.${fn}()`)).slice(0, 900),
      )?.[1] ?? ''
    expect(alfabe('basvuru_referansi')).not.toEqual('')
    expect(alfabe('geri_arama_referansi')).toEqual(alfabe('basvuru_referansi'))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6 · EKRANLAR UYDURMA KAYNAK OKUMUYOR
// ═══════════════════════════════════════════════════════════════════════════
describe('ekranlar · tek veri kaynağı veritabanı', () => {
  const EKRANLAR = [
    'src/pages/GeriAramaFormu.tsx',
    'src/pages/GeriAramaTalepleri.tsx',
    'src/onboarding/geri-arama.repository.ts',
  ]

  it('üç dosya da diskte (sağlama)', () => {
    for(const yol of EKRANLAR){
      expect(existsSync(join(KOK, yol)), `${yol} yok`).toBe(true)
    }
  })

  it('sağlama: yorum soyucu gerçekten iş yapıyor ve kodu silmiyor', () => {
    // ⚠️ Soyucunun kendisi ölçülmeden, ona dayanan üç iddia da ölçülmemiş
    // olur (tuzak 170: sağlama, ölçümle AYNI nesneyi kullanır).
    const ham = dosya('src/onboarding/geri-arama.repository.ts')
    const soyulmus = kod('src/onboarding/geri-arama.repository.ts')
    expect(soyulmus.length).toBeLessThan(ham.length)
    expect(soyulmus).toContain('export class PostgresGeriAramaDefteri')
    // Yasağı anlatan yorum gitti, kod kaldı.
    expect(ham).toContain("`.from('callback_request')` yazan biri")
    expect(soyulmus).not.toContain("`.from('callback_request')` yazan biri")
  })

  it('⚠️ hiçbiri `../storage` okumuyor', () => {
    // `storage.ts` içindeki okuyucular depo boşken DEMO SATIR üretiyor
    // (HEDEFLER 3.10). Giriş ekranında bir demo müşteri adayı görünmesi,
    // 25.10'da kaldırılan uydurma referanslarla aynı aile olurdu.
    for(const yol of EKRANLAR){
      expect(kod(yol), `${yol} depo okuyor`).not.toMatch(/from '\.\.?\/storage'/)
    }
  })

  it('⚠️ hiçbiri `.mock` okumuyor', () => {
    for(const yol of EKRANLAR){
      expect(kod(yol), `${yol} mock okuyor`).not.toMatch(/from '[^']*\.mock/)
    }
  })

  it('⚠️ ekranlar tabloya DOĞRUDAN gitmiyor (ADR-005)', () => {
    for(const yol of EKRANLAR){
      expect(kod(yol), `${yol} doğrudan tabloya gidiyor`)
        .not.toMatch(/\.from\(\s*['"`](callback_request|platform_contact)/)
    }
  })

  it('form, Supabase yapılandırılmamışken "kaydettim" DEMİYOR', () => {
    const form = kod('src/pages/GeriAramaFormu.tsx')
    expect(form).toContain('isSupabaseConfigured')
    // ⚠️ Başvuru formunun localStorage'a düşen yolu BURADA YOK ve olmayacak:
    // düşülecek eski bir yol yok, uydurmak "...mış gibi yapmak" olurdu.
    expect(form).not.toMatch(/localStorage|sessionStorage/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 7 · DAVRANIŞ PROVASI VAR VE KÖR DEĞİL
// ═══════════════════════════════════════════════════════════════════════════
describe('prova · kapının içinde koşuyor', () => {
  const PROVA = 'db/prova/prova-0106.sql'

  it('prova dosyası var', () => {
    expect(existsSync(join(KOK, PROVA))).toBe(true)
  })

  it('⚠️ prova İSTEMCİ ROLLERİNE giriyor (MIYOP-042)', () => {
    // Rol takmayan prova kapının DIŞINDA koşar: her yazım sessizce geçer
    // ve prova yeşil görünür.
    const metin = dosya(PROVA)
    expect(metin).toContain('set local role anon')
    expect(metin).toContain('set local role authenticated')
  })

  it('⚠️ prova OLUMSUZ kontroller içeriyor', () => {
    // İzinli çağrının geçtiğini görmek kapının yarısıdır; asıl kanıt
    // izinsiz çağrının reddedilmesi.
    const metin = dosya(PROVA)
    for(const kod of ['MI403', 'MI409', 'MI422', 'MI429', 'MI404']){
      expect(metin, `prova ${kod} durumunu sınamıyor`).toContain(kod)
    }
  })

  it('prova veritabanını kirletmiyor', () => {
    const metin = dosya(PROVA)
    expect(metin.trimEnd().endsWith('rollback;')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 0110 · MIYOP-102 · SPAM KAPISI EŞZAMANLI YAZIMA KARŞI
//
// ⚠️ Bu blok DAVRANIŞ ÖLÇMÜYOR, metin ölçüyor: göçte kilidin ve indeksin
// yazılı olduğunu söylüyor. Kilidin gerçekten beklettiğini iki oturumla
// yapılan ölçüm gösterdi (çıktısı 0110'un başlığında); indeksin gerçekten
// reddettiğini `db/prova/prova-0110.sql` gösteriyor. Hiçbiri ötekinin
// yerine geçmiyor.
// ═══════════════════════════════════════════════════════════════════════════
describe('0110 · spam kapısı eşzamanlı yazıma kapalı (MIYOP-102)', () => {
  const GOC = 'db/migrations/0110_geri_arama_es_zaman_kapisi.sql'

  /**
   * SQL'in YORUMSUZ hâli.
   *
   * ⚠️ TUZAK 181 (bu depoda beşinci kez): bu dosyadaki ölçümler göç
   * metnine bakıyor ve göçler kaldırılan kodu bilerek kelime kelime
   * alıntılıyor. 0110'un başlığında `coalesce`lı eski hâl ve kilidin
   * ADI yorum olarak geçiyor; ham metne bakan bir iddia kendi
   * açıklamasına takılır.
   */
  const sqlKod = (metin: string): string => metin.replace(/--[^\n]*/g, '')

  it('göç dosyası var', () => {
    expect(existsSync(join(KOK, GOC))).toBe(true)
  })

  it('⚠️ telefon başına işlem kilidi var', () => {
    // Kilit olmadan iki kapı da etkisiz: eşzamanlı iki çağrı birbirinin
    // henüz COMMIT edilmemiş satırını görmez, ikisi de "yok" okur.
    expect(sqlKod(dosya(GOC))).toContain('pg_advisory_xact_lock')
  })

  it('⚠️ kilit kapı okumasından ÖNCE alınıyor', () => {
    // Sonra alınan kilit hiçbir şey korumaz: okuma zaten yapılmış olur.
    const k = sqlKod(dosya(GOC))
    const kilit = k.indexOf('pg_advisory_xact_lock')
    const okuma = k.indexOf("and status = 'NEW'")
    expect(kilit).toBeGreaterThan(-1)
    expect(okuma).toBeGreaterThan(-1)
    expect(kilit).toBeLessThan(okuma)
  })

  it('kısmi tekillik indeksi kuruluyor (fiziksel emniyet)', () => {
    const k = sqlKod(dosya(GOC))
    expect(k).toContain('callback_request_acik_talep_tekil')
    expect(k).toMatch(/create unique index[\s\S]*?callback_request[\s\S]*?where status = 'NEW'/)
  })

  it('⚠️ çakışan kısıt ayırt ediliyor — kullanıcı yanlış sebep görmüyor', () => {
    // 0106'nın döngüsü her `unique_violation`ı "numara çakıştı" sanıp beş
    // kez deniyor, sonra "Talep numarası üretilemedi" diyordu. Yeni indeks
    // devreye girdiğinde kullanıcı o YANLIŞ sebebi görürdü.
    const k = sqlKod(dosya(GOC))
    expect(k).toContain('constraint_name')
    expect(k).toContain('MI409')
  })

  it('⚠️ var olan kayıtlar SİLİNMİYOR, kapatılıyor', () => {
    // İndeks çift açık talep varken oluşamaz. Çözüm kaydı silmek olsaydı
    // gerçek bir müşteri talebi yok edilirdi.
    const k = sqlKod(dosya(GOC))
    expect(k).toContain("set status       = 'CLOSED'")
    expect(k).not.toMatch(/delete\s+from\s+public\.callback_request/i)
  })

  it('24 saat sınırı hâlâ gövdede (indeks onu kapsamıyor)', () => {
    // Sayma kuralını hiçbir tekillik indeksi ifade edemez; onu eşzamanlı
    // yazıma karşı koruyan tek şey kilit.
    const k = sqlKod(dosya(GOC))
    expect(k).toContain("interval '24 hours'")
    expect(k).toContain('MI429')
  })

  it('prova dosyaları var, rol takıyor ve veritabanını kirletmiyor', () => {
    for(const p of ['db/prova/prova-0110.sql', 'db/prova/prova-0110-ters.sql']){
      expect(existsSync(join(KOK, p)), `${p} yok`).toBe(true)
      const metin = dosya(p)
      expect(metin.trimEnd().endsWith('rollback;'), `${p} rollback ile bitmiyor`).toBe(true)
    }
    // ⚠️ MIYOP-042: rol takmayan prova kapının DIŞINDA koşar.
    expect(dosya('db/prova/prova-0110.sql')).toContain('set local role anon')
  })

  it('⚠️ ters prova var: emniyet kaldırılınca kusur geri geliyor', () => {
    // Emniyet olmasaydı da yeşil yanan bir prova hiçbir şey ölçmüyordur.
    const ters = dosya('db/prova/prova-0110-ters.sql')
    expect(ters).toContain('drop index if exists public.callback_request_acik_talep_tekil')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 0116 · MIYOP-109 · YENİDEN BEKLEMEYE ALMA ÇAKIŞMASI
//
// Aynı numaranın eski bir KAPALI talebi ile yeni bir AÇIK talebi varken
// "Tekrar beklemeye al" eski kaydı NEW yapmaya çalışıyor; 0110'un tekillik
// indeksi reddediyor. Veri doğruydu, CEVAP yanlıştı: ekrana ham indeks adı
// (`callback_request_acik_talep_tekil`) çıkıyordu.
//
// ⚠️ 0110'un provası indeksi ham INSERT ile ölçüyordu; kullanıcının
// GERÇEKTEN bastığı yol (durum güncelleme) ölçülmemişti. Davranışı
// `db/prova/prova-0116.sql` `authenticated` rolüyle, gerçek kabuktan
// çağırarak ölçüyor; bu blok yalnız metni ölçer.
// ═══════════════════════════════════════════════════════════════════════════
describe('0116 · yeniden beklemeye alma çakışması anlaşılır (MIYOP-109)', () => {
  /** SQL yorumları ölçümden ÖNCE siliniyor (tuzak 181). */
  const sqlKod = (metin: string): string => metin.replace(/--[^\n]*/g, '')

  it('sağlama · yürürlükteki gövde 0116\'dan geliyor', () => {
    const goc = dosya('db/migrations/0116_geri_arama_yeniden_acma.sql')
    expect(goc).toContain(DURUM_YAZ_BASI)
    // Yürürlükteki gövde, 0116'nın içindeki gövdeyle AYNI metin.
    const { govde } = etkinDurumYaz()
    expect(goc).toContain(govde)
    expect(govde.length).toBeGreaterThan(1_500)
  })

  it('⚠️ çakışma YAZMADAN ÖNCE aranıyor ve `MI409` veriyor', () => {
    const { govde } = etkinDurumYaz()
    const k = sqlKod(govde)
    const onKontrol = k.indexOf("if v_durum = 'NEW' and v_satir.status <> 'NEW' then")
    const yazma = k.indexOf('update public.callback_request')
    expect(onKontrol, 'ön kontrol bulunamadı').toBeGreaterThan(-1)
    expect(yazma, 'UPDATE bulunamadı').toBeGreaterThan(onKontrol)
    const blok = k.slice(onKontrol, yazma)
    expect(blok).toContain("status = 'NEW'")
    expect(blok).toContain('id <> v_satir.id')
    expect(blok).toContain("using errcode = 'MI409'")
  })

  it('⚠️ ön kontrol 0110 ile AYNI kilidi alıyor (iki yeniden açma yarışamaz)', () => {
    const k = sqlKod(etkinDurumYaz().govde)
    expect(k).toContain('pg_advisory_xact_lock(110, hashtext(v_satir.phone))')
    // Kilit, öteki talebi ARAMADAN önce.
    expect(k.indexOf('pg_advisory_xact_lock(110'))
      .toBeLessThan(k.indexOf('select reference into v_diger'))
  })

  it('⚠️ ikinci kat · UPDATE yine de indekse çarparsa aynı cevaba çevriliyor', () => {
    const k = sqlKod(etkinDurumYaz().govde)
    const yakala = k.indexOf('exception when unique_violation then')
    expect(yakala, 'unique_violation yakalanmıyor').toBeGreaterThan(-1)
    const blok = k.slice(yakala)
    // ⚠️ YALNIZ bu indeks çevriliyor; başka bir tekillik hatası yutulmuyor.
    expect(blok).toContain("v_kisit = 'callback_request_acik_talep_tekil'")
    expect(blok).toContain("using errcode = 'MI409'")
    expect(blok, 'tanınmayan tekillik hatası yutuluyor').toMatch(/end if;\s*raise;/)
  })

  it('⚠️ kullanıcıya giden cümlede indeks adı YOK', () => {
    const k = sqlKod(etkinDurumYaz().govde)
    const cumleler = [...k.matchAll(/raise exception\s+'([^']*)'/g)].map(m => m[1] as string)
    expect(cumleler.length).toBeGreaterThan(2)
    for(const c of cumleler){
      expect(c).not.toContain('callback_request')
      expect(c).not.toContain('duplicate key')
    }
  })

  it('imza DEĞİŞMEDİ (yetkiler `create or replace` ile korunuyor · tuzak 67)', () => {
    const goc = sqlKod(dosya('db/migrations/0116_geri_arama_yeniden_acma.sql'))
    expect(etkinDurumYaz().imza.split(',')).toHaveLength(3)
    // İmza değişmediği için fonksiyon DÜŞÜRÜLMÜYOR; düşürülseydi GRANT'lar
    // da giderdi ve göç onları geri vermek zorunda kalırdı.
    expect(goc).not.toMatch(/drop function/)
  })

  it('ekran `MI409` cümlesini olduğu gibi gösteriyor', () => {
    const depo = kod('src/onboarding/geri-arama.repository.ts')
    expect(depo).toContain("'MI409'")
  })

  it('prova ve ters prova var, rol takıyor, veritabanını kirletmiyor', () => {
    for(const p of ['db/prova/prova-0116.sql', 'db/prova/prova-0116-ters.sql']){
      expect(existsSync(join(KOK, p)), `${p} yok`).toBe(true)
      const metin = dosya(p)
      expect(metin, `${p} rol takmıyor (MIYOP-042)`).toContain('set local role authenticated')
      expect(metin.trimEnd().endsWith('rollback;'), `${p} rollback ile bitmiyor`).toBe(true)
    }
    // ⚠️ Ölçülen yol GERÇEK kabuk: ham UPDATE değil.
    expect(dosya('db/prova/prova-0116.sql')).toContain('public.geri_arama_durumu_yaz(')
    // Ters prova eski gövdeyi geri koyup ham hatayı gösteriyor.
    expect(dosya('db/prova/prova-0116-ters.sql')).toContain("v_kod = '23505'")
  })
})
