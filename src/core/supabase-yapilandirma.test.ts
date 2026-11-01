// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Yer tutucu bekçisi — ŞABLONU DOSYADAN OKUYARAK ölçülür
//
// Bu sınamanın asıl işi `yapilandirmaGecerli`'nin dallarını saymak değil,
// İKİ DOSYAYI BİRBİRİNE BAĞLAMAK: `.env.example`'daki yer tutucu metin ile
// onu tanıması gereken kural ayrı dosyalarda duruyor ve 01.11.2026'da
// birbirinden ayrıldıkları ölçüldü (bekçi 'BURAYA' arıyordu, şablon
// 'buraya' yazıyordu). Şablonu buraya ELLE kopyalasaydım aynı ayrılma
// yeniden olurdu — o yüzden değerler DOSYADAN okunuyor.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from './test-support/goc-tarama'
import { EN_KISA_ANAHTAR, yapilandirmaGecerli } from './supabase-yapilandirma'

const KOK = projeKokunuBul()
const SABLON = readFileSync(join(KOK, '.env.example'), 'utf8') as string

/** `.env` biçiminden bir değeri okur. Satır sonları ve boşluklar temizlenir. */
const sablonDegeri = (ad: string): string => {
  const satir = SABLON.split(/\r?\n/).find(s => s.trim().startsWith(`${ad}=`))
  if(!satir) throw new Error(`.env.example içinde ${ad} yok`)
  return satir.slice(satir.indexOf('=') + 1).trim()
}

const SABLON_ADRES = sablonDegeri('VITE_SUPABASE_URL')
const SABLON_ANAHTAR = sablonDegeri('VITE_SUPABASE_ANON_KEY')

// Gerçek bir anon anahtarı JWT'dir: üç parça, `eyJ` ile başlar.
const GERCEKCI_ANAHTAR = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.imza'
// Gercek proje kimligi yazilmiyor: sinama uretim kimligini tasimasin.
const GERCEKCI_ADRES = 'https://abcdefghijklmnopqrst.supabase.co'

describe('Supabase yapılandırma bekçisi', () => {
  it('şablon dosyası iki değeri de hâlâ taşıyor', () => {
    expect(SABLON_ADRES.length, '.env.example içindeki adres boş').toBeGreaterThan(0)
    expect(SABLON_ANAHTAR.length, '.env.example içindeki anahtar boş').toBeGreaterThan(0)
  })

  it('⚠️ .env.example DOLDURULMAMIŞ hâliyle "yapılandırılmış" SAYILMAZ', () => {
    expect(
      yapilandirmaGecerli(SABLON_ADRES, SABLON_ANAHTAR),
      '.env.example kopyalanıp doldurulmadığında uygulama "bağlıyım" demeye '
      + 'başlar; ekranlar anlaşılmaz ağ hatalarıyla dolar. Şablonun yer '
      + 'tutucusu değiştiyse supabase-yapilandirma.ts da güncellenmeli.'
    ).toBe(false)
  })

  it('⚠️ 01.11 ÖNCESİ kural bu şablonu GEÇİRİYORDU — hata buydu', () => {
    // Eski kural birebir: büyük harfli 'BURAYA' aranıyordu.
    const eskiKural = (adres: string, anahtar: string) => (
      adres.startsWith('https://')
      && anahtar.length > 20
      && !anahtar.startsWith('BURAYA')
    )
    expect(
      eskiKural(SABLON_ADRES, SABLON_ANAHTAR),
      'Eski kural şablonu geçirmiyorsa bu sınamanın anlattığı hata '
      + 'gerçekleşmemiş demektir; o zaman sınama da yanlış yazılmıştır.'
    ).toBe(true)
  })

  it('gerçek görünümlü bir yapılandırma GEÇER', () => {
    expect(
      yapilandirmaGecerli(GERCEKCI_ADRES, GERCEKCI_ANAHTAR),
      'Yanlış "yapılandırılmamış" cevabı daha kötüdür: uygulama hiç açılmaz.'
    ).toBe(true)
  })

  it('eksik ya da bozuk değerler reddedilir', () => {
    expect(yapilandirmaGecerli('', '')).toBe(false)
    expect(yapilandirmaGecerli('', GERCEKCI_ANAHTAR)).toBe(false)
    expect(yapilandirmaGecerli(GERCEKCI_ADRES, '')).toBe(false)
    // https DEĞİL
    expect(yapilandirmaGecerli('http://x.supabase.co', GERCEKCI_ANAHTAR)).toBe(false)
    // sınırda: tam EN_KISA_ANAHTAR kadar olan anahtar yetmez
    expect(yapilandirmaGecerli(GERCEKCI_ADRES, 'a'.repeat(EN_KISA_ANAHTAR))).toBe(false)
    expect(yapilandirmaGecerli(GERCEKCI_ADRES, 'a'.repeat(EN_KISA_ANAHTAR + 1))).toBe(true)
  })

  it('büyük/küçük harf farkı bekçiyi atlatamaz', () => {
    expect(yapilandirmaGecerli(GERCEKCI_ADRES, 'buraya_anon_public_anahtari')).toBe(false)
    expect(yapilandirmaGecerli(GERCEKCI_ADRES, 'BURAYA_anon_public_anahtari')).toBe(false)
    expect(yapilandirmaGecerli(GERCEKCI_ADRES, 'Buraya_anon_public_anahtari')).toBe(false)
    expect(yapilandirmaGecerli('https://XXXXXXXXXXXX.SUPABASE.CO', GERCEKCI_ANAHTAR)).toBe(false)
  })

  it('baştaki/sondaki boşluk yüzünden şablon geçmez', () => {
    expect(yapilandirmaGecerli(`  ${SABLON_ADRES}  `, `  ${SABLON_ANAHTAR}  `)).toBe(false)
  })
})
