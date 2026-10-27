// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — FİNANS KAPILARI YERİNDE, HAM HESAP KAPININ İÇİNDE DEĞİL
//
// ── NEDEN VAR (MIYOP-078 · P0 · 27.10.2026) ──────────────────────────────
// 0065 `app.isletme_gostergeleri` ve `app.fire_dokumu` fonksiyonlarını yazdı.
// **0071 ikisini de ikiye ayırdı:** ham hesap `..._ham` adına, asıl ad bir
// `finance.read` İZİN KAPISI oldu. 0095'i yazarken gövdeyi 0065'ten
// kopyalayıp **asıl ada** yazdım ve otuz göç sonra o kapıyı ezdim. Açık
// canlıya gitti: finans izni olmayan depo/üretim/kalite/gıda mühendisi fire
// tutarını ve stok maliyetini doğrudan RPC'den okuyabildi.
//
// ⚠️ Bunu bir ÇALIŞMA ZAMANI kontrolüyle önlemeye üç kez çalıştım ve üçünde
// de paketi rehin aldı: göç 0095, kapıyı onaran 0099'dan ÖNCE çalışıyor ve
// canlıdaki bozuk geçmişi görüp patlıyordu. Bir göçün doğrulaması yalnız
// KENDİ YAZDIĞINI ölçebilir, ortamın geçmişini değil (tuzak 133).
//
// ⚠️ Doğru yer burası: ölçülen şey DOSYANIN METNİ. Hangi göçün hangi ada ne
// yazdığı, veritabanının o anki hâlinden bağımsızdır ve her koşuda ölçülür.
//
// ── 27.10 · İKİNCİ YER DE EZİLMİŞTİ ──────────────────────────────────────
// Canlı teşhiste `app.fire_dokumu` kapısı da YOKTU. Bu testin eski hâli onu
// yakalayamazdı, çünkü yalnız ÜÇ dosyayı (0071/0095/0099) okuyordu ve kapıyı
// ezen şeyi "0095 fire_dokumu'ya yazmasın" diye tek tek sayıyordu.
// ⚠️ Tek tek saymak, bir sonraki göçü hiç ölçmez. Kural artık DOSYA
// LİSTESİNDEN BAĞIMSIZ: 0071'den SONRAKİ HİÇBİR göç bu iki ada ham hesap
// yazamaz; yazdığı her gövde bir KAPI olmak zorundadır.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'

const KOK = projeKokunuBul()
const GOC_KLASORU = join(KOK, 'db/migrations')
const oku = (ad: string) => readFileSync(join(GOC_KLASORU, ad), 'utf8') as string

/** Ayrımı kuran göç. Ondan ÖNCEKİ göçlerde kapı diye bir şey yoktu. */
const AYRIM_NUMARASI = 71

/** Kapıya dönüştürülmüş iki ad ve `_ham`'ında beklenen hesap izi. */
const KAPILAR = [
  { ad: 'isletme_gostergeleri', ham_iz: /from public\.stock_movement|stock_usable_balance/ },
  { ad: 'fire_dokumu',          ham_iz: /from public\.stock_movement/ },
] as const

const gocDosyalari = () =>
  readdirSync(GOC_KLASORU).filter((d) => /^\d{4}_.*\.sql$/.test(d)).sort()

const numarasi = (dosya: string) => Number(dosya.slice(0, 4))

/** `create or replace function app.<ad>(` ... `$$;` arasını döndürür. */
function govdeler(sql: string, ad: string): string[] {
  const kalip = new RegExp(`create or replace function app\\.${ad}\\s*\\(`, 'g')
  const cikti: string[] = []
  let e: RegExpExecArray | null
  while ((e = kalip.exec(sql)) !== null) {
    const son = sql.indexOf('$$;', e.index)
    cikti.push(sql.slice(e.index, son < 0 ? sql.length : son + 3))
  }
  return cikti
}

const GOC_0071 = oku('0071_analiz_yetkisi_sunucuda.sql')

describe('finans kapıları · ham hesap kapının adına yazılmıyor', () => {
  it('sağlama: göç klasörü okunuyor ve 0071 yerinde', () => {
    const dosyalar = gocDosyalari()
    expect(dosyalar.length, 'göç klasörü boş okundu').toBeGreaterThan(90)
    expect(dosyalar.some((d) => numarasi(d) === AYRIM_NUMARASI), '0071 yok').toBe(true)
    expect(GOC_0071.length).toBeGreaterThan(500)
  })

  it("0071 ayrımı KURMUŞ: iki adın ham hesabı _ham'a taşınmış", () => {
    for (const { ad } of KAPILAR) {
      expect(GOC_0071, `0071 ${ad} ham hesabını taşımıyor`)
        .toMatch(new RegExp(`rename to ${ad}_ham`))
      const g = govdeler(GOC_0071, ad)
      expect(g.length, `0071 ${ad} kapısını yazmıyor`).toBeGreaterThan(0)
      expect(g[g.length - 1], `0071 ${ad} kapısı finance.read sormuyor`)
        .toMatch(/finance\.read/)
    }
  })

  // ⚠️ BU TESTİN KALBİ. Dosya adı saymıyor; klasörde ne varsa ölçüyor.
  // Yarın 0102 yazılır ve kapıya ham hesap yazarsa, burada kırmızı verir.
  it("0071'den SONRAKİ hiçbir göç kapıya HAM HESAP yazmıyor", () => {
    const suclular: string[] = []
    for (const dosya of gocDosyalari()) {
      if (numarasi(dosya) <= AYRIM_NUMARASI) continue
      const sql = oku(dosya)
      for (const { ad } of KAPILAR) {
        for (const govde of govdeler(sql, ad)) {
          const kapiMi = /finance\.read/.test(govde) && new RegExp(`${ad}_ham`).test(govde)
          const hamMi = /from public\.stock_movement|from public\.stock_item/.test(govde)
          if (!kapiMi || hamMi) {
            suclular.push(
              `${dosya} → app.${ad} gövdesi kapı değil`
              + ` (finance.read: ${/finance\.read/.test(govde)},`
              + ` _ham çağrısı: ${new RegExp(`${ad}_ham`).test(govde)},`
              + ` ham hesap: ${hamMi})`,
            )
          }
        }
      }
    }
    expect(
      suclular,
      'Bu adlar 0071 ile İZİN KAPISI oldu. Ham hesap `_ham` adına yazılır '
      + '(MIYOP-078). Suçlular:\n' + suclular.join('\n'),
    ).toEqual([])
  })

  it('kapılar `security definer` YAPILMIYOR', () => {
    // 0071'in kararı: definer olsaydı izin kontrolünü geçen bir çağrı RLS'i
    // de aşar ve BÜTÜN kiracıları okurdu.
    for (const dosya of gocDosyalari()) {
      const sql = oku(dosya)
      for (const { ad } of KAPILAR) {
        for (const govde of govdeler(sql, ad)) {
          if (!/finance\.read/.test(govde)) continue
          expect(govde, `${dosya} → app.${ad} kapısını security definer yapıyor`)
            .not.toMatch(/security definer/)
        }
      }
    }
  })

  it('onarım göçleri kapıyı GERİ KOYUYOR (0099 göstergeler, 0101 fire)', () => {
    const onarimlar = [
      { dosya: '0099_finans_kapisi_geri.sql', ad: 'isletme_gostergeleri' },
      { dosya: '0101_fire_kapisi_geri.sql',   ad: 'fire_dokumu' },
    ] as const
    for (const { dosya, ad } of onarimlar) {
      const sql = oku(dosya)
      const g = govdeler(sql, ad)
      expect(g.length, `${dosya} ${ad} kapısını yazmıyor`).toBeGreaterThan(0)
      expect(g[g.length - 1], `${dosya} kapısı finance.read sormuyor`)
        .toMatch(/finance\.read/)
      // ⚠️ Onarım göçü HEM `_ham`'ı HEM kapıyı yazıyor; kapının gövdesinde
      // ham hesap OLMAMALI — yoksa onarım kendi onardığı şeyi bozar.
      expect(g[g.length - 1], `${dosya} kapısının gövdesinde ham hesap var`)
        .not.toMatch(/from public\.stock_movement|from public\.stock_item/)
      const ham = govdeler(sql, `${ad}_ham`)
      expect(ham.length, `${dosya} ${ad}_ham'ı yazmıyor`).toBeGreaterThan(0)
      expect(ham[ham.length - 1], `${dosya} _ham'a kapı yazıyor`)
        .not.toMatch(/finance\.read/)
    }
  })
})
