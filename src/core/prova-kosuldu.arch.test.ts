// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — YENİ GÖÇ VARSA PROVALAR DA KOŞMUŞ OLMALI
//                        (HEDEFLER 4.11.9 · tuzak 190)
//
// ── NEDEN VAR ─────────────────────────────────────────────────────────────
// 07.11.2026'da bütün provalar ilk kez bir arada koşturuldu: **54 provanın
// 13'ü kırmızıydı** ve aylardır kimse bilmiyordu. Hiçbiri o günün kodundan
// gelmiyordu; her biri aradan geçen bir göçün BİLEREK değiştirdiği kuralı
// savunuyordu. Sebep tek cümleyle şuydu:
//
//     Provaları bir arada koşturmak BİR ADIMA BAĞLI DEĞİLDİ,
//     yani kimsenin görevi değildi.
//
// `db/prova/hepsini-kosturt.sh` vardı. Yazılı uyarı da vardı. İkisi de
// yetmedi — kontrol listesi 130'un aynı dersi: **yazılı bir uyarı, bir
// adıma bağlanmadığı sürece hatırlatmaz.**
//
// ── BAĞ NEDEN TERSİNDEN KURULDU ──────────────────────────────────────────
// Doğal yer `kaydet.ps1` olurdu ama olamaz: provalar yerel bir
// **PostgreSQL 16** istiyor, Emrah'ın makinesinde yok ve kurulması
// istenmiyor. O yüzden:
//   1. `hepsini-kosturt.sh` YEŞİL bitince `db/prova/son-kosu.json` yazar
//      (kırmızı bitince varsa SİLER — kırmızı koşu kayıt bırakmaz).
//   2. Bu sınama o kaydı depodaki göçlerle karşılaştırır.
// Yeni bir göç yazılıp provalar koşturulmazsa `npm test` KIRMIZI yanar ve
// `kaydet.ps1` commit atmaz. Adım artık bağlı.
//
// ⚠️ BU BİR GÜVENLİK DENETİMİ DEĞİL, BİR HATIRLATICIDIR. `son-kosu.json`
// elle de yazılabilir. Amaç kötü niyeti durdurmak değil, UNUTMAYI
// durdurmak — ki 07.11'de kaybedilen tam olarak oydu.
// ═══════════════════════════════════════════════════════════════════════════

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const KOK = process.cwd()
const GOC_KLASORU = join(KOK, 'db', 'migrations')
const PROVA_KLASORU = join(KOK, 'db', 'prova')
const KAYIT_YOLU = join(PROVA_KLASORU, 'son-kosu.json')

/** ⚠️ Desen 0099'da donmamalı (tuzak 143): dört basamak, aralık yok. */
const GOC_DESENI = /^[0-9]{4}_.+\.sql$/
const PROVA_DESENI = /^prova-.+\.sql$/

const goclar = () => readdirSync(GOC_KLASORU).filter(a => GOC_DESENI.test(a)).sort()
const provalar = () => readdirSync(PROVA_KLASORU).filter(a => PROVA_DESENI.test(a)).sort()

const NASIL = [
  'PostgreSQL 16 kurulu bir Linux\'ta:',
  '  bash db/prova/kur.sh',
  '  bash db/prova/hepsini-kosturt.sh',
  'Yeşil biterse kayıt kendiliğinden yazılır.',
].join('\n')

type SonKosu = {
  tarih?: string
  en_yeni_goc?: string
  goc_sayisi?: number
  prova_sayisi?: number
  yesil?: number
  kirmizi?: number
}

describe('provalar bu göçlerle koşturulmuş mu (4.11.9)', () => {
  it('sağlama: göç ve prova klasörleri okunuyor', () => {
    expect(goclar().length).toBeGreaterThan(100)
    expect(provalar().length).toBeGreaterThan(50)
  })

  it('⚠️ son koşu kaydı VAR (kırmızı koşu kayıt bırakmaz)', () => {
    expect(existsSync(KAYIT_YOLU),
      `db/prova/son-kosu.json yok. Ya provalar hiç koşmadı ya da son koşu KIRMIZI bitti.\n${NASIL}`)
      .toBe(true)
  })

  const kayit: SonKosu = existsSync(KAYIT_YOLU)
    ? JSON.parse(readFileSync(KAYIT_YOLU, 'utf8'))
    : {}

  it('kayıt okunabiliyor ve tarihli', () => {
    expect(kayit.tarih).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  // ⚠️ ASIL KONTROL BU. Yeni bir göç yazıldıysa ve provalar onunla birlikte
  // koşmadıysa, kayıttaki "en yeni göç" geride kalır.
  it('⚠️ EN YENİ GÖÇ provalarla birlikte koşturulmuş', () => {
    const enYeni = goclar().at(-1)
    expect(kayit.en_yeni_goc,
      `Depodaki en yeni göç "${enYeni}", ama provalar en son "${kayit.en_yeni_goc}" ile koştu.\n`
      + 'Yeni göç yazıldı ve provalar onunla birlikte koşturulmadı.\n' + NASIL)
      .toBe(enYeni)
  })

  it('göç SAYISI da tutuyor (araya eklenen göç yakalanır)', () => {
    expect(kayit.goc_sayisi,
      `Depoda ${goclar().length} göç var, kayıtta ${kayit.goc_sayisi}.\n${NASIL}`)
      .toBe(goclar().length)
  })

  // ⚠️ Yeni bir PROVA eklenip koşturulmamış olabilir: o da ölçülmemiş bir
  // kuraldır. Sayı buradan da tutuluyor.
  it('prova SAYISI tutuyor (yeni prova eklenip koşturulmamış olmasın)', () => {
    expect(kayit.prova_sayisi,
      `Depoda ${provalar().length} prova var, kayıtta ${kayit.prova_sayisi}.\n${NASIL}`)
      .toBe(provalar().length)
  })

  it('⚠️ son koşuda KIRMIZI YOK ve hepsi koştu', () => {
    expect(kayit.kirmizi, 'Son koşuda kırmızı prova var.').toBe(0)
    expect(kayit.yesil,
      `Son koşuda ${kayit.yesil} prova yeşil ama depoda ${provalar().length} prova var.`)
      .toBe(provalar().length)
  })
})
