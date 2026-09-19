// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Zil bildirimleri (başvuru defterinden türetilen)
//
// ── NEDEN BU TESTLER VAR ──────────────────────────────────────────────────
// Zil dört tur boyunca sessiz kaldı ve bunu her seferinde Emrah fark etti,
// ben değil. Sebep basitti: form Postgres'e yazmaya başlamıştı, zil hâlâ
// `localStorage` okuyordu. Hiçbir test bu boşluğu görmüyordu çünkü zilin
// kuralları hiç sınanmamıştı.
//
// Artık kurallar saf bir fonksiyonda ve burada sınanıyor.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'
import { basvurulariBildirimeCevir, GECIKME_ESIGI_GUN, BILDIRIM_SINIRI } from './basvuru-bildirimleri'
import type { Basvuru, BasvuruDurumu } from '../onboarding/application.repository'

const gunOnce = (gun: number) => {
  const t = new Date()
  t.setDate(t.getDate() - gun)
  return t.toISOString()
}

const kayit = (yama: Partial<Basvuru> = {}): Basvuru => ({
  id: yama.id ?? 'bsv-1',
  referans: 'MIY-A1B2C',
  olusturmaZamani: gunOnce(0),
  guncellemeZamani: gunOnce(0),
  durum: 'PENDING' as BasvuruDurumu,
  sektorKodu: 'industrial-kitchen',
  firmaAdi: 'Gümüş Tavukçuluk',
  yetkiliAdi: 'Turgut Özer',
  telefon: '05321234567',
  eposta: 'turgut@tavukcu.com',
  vergiNo: '1234567890',
  vergiDairesi: 'Bornova',
  il: 'İzmir',
  ilce: 'Bornova',
  adres: 'Adres',
  ...yama,
})

describe('Zil bildirimleri', () => {
  it('bekleyen başvuru bildirim üretir', () => {
    const [b] = basvurulariBildirimeCevir([kayit()])
    expect(b.title).toBe('Yeni işletme başvurusu')
    expect(b.description).toContain('Gümüş Tavukçuluk')
    expect(b.targetId).toBe('bsv-1')
    expect(b.readAt).toBe('')
  })

  it('karar verilmiş başvuru zili meşgul etmez', () => {
    // Reddedilen ya da iptal edilen başvuru bir iş değil, bir kayıttır.
    expect(basvurulariBildirimeCevir([kayit({ durum: 'REJECTED' })])).toEqual([])
    expect(basvurulariBildirimeCevir([kayit({ durum: 'CANCELLED' })])).toEqual([])
  })

  it('onaylanmış ama giriş hesabı açılmamış işletme UYARI verir', () => {
    // Bu, müşterinin giremediği bir işletme demek. Sessiz kalması en pahalı
    // hata türü: kimse fark etmez.
    const [b] = basvurulariBildirimeCevir([
      kayit({ durum: 'APPROVED', kararZamani: gunOnce(1) }),
    ])
    expect(b.title).toBe('Giriş hesabı açılmadı')
    expect(b.severity).toBe('warning')
  })

  it('hesabı açılmış onaylı işletme artık bildirim üretmez', () => {
    expect(basvurulariBildirimeCevir([
      kayit({ durum: 'APPROVED', kararZamani: gunOnce(1), davetZamani: gunOnce(1) }),
    ])).toEqual([])
  })

  it(`${GECIKME_ESIGI_GUN} gün ve fazlası bekleyen başvuru uyarıya döner`, () => {
    const [taze] = basvurulariBildirimeCevir([kayit({ olusturmaZamani: gunOnce(0) })])
    expect(taze.severity).toBe('info')

    const [gecikmis] = basvurulariBildirimeCevir([
      kayit({ olusturmaZamani: gunOnce(GECIKME_ESIGI_GUN) }),
    ])
    expect(gecikmis.severity).toBe('warning')
  })

  it('vergi bilgisi eksikse bildirimde yazıyor', () => {
    const [b] = basvurulariBildirimeCevir([kayit({ vergiNo: '', vergiDairesi: '' })])
    expect(b.description).toContain('Vergi bilgisi alınmamış')
  })

  it('okunan bildirim okundu kalır', () => {
    const okunanlar = { 'basvuru_bsv-1_PENDING': gunOnce(0) }
    const [b] = basvurulariBildirimeCevir([kayit()], okunanlar)
    expect(b.readAt).not.toBe('')
  })

  it('durum değişince bildirim YENİDEN okunmamış olur', () => {
    // ⚠️ Kuralın kalbi bu. Kimlik duruma bağlı olmasaydı, bir kez okunan
    // başvuru bir daha asla haber vermezdi — oysa duruma geçiş tam da
    // haber verilecek şey.
    const okunanlar = { 'basvuru_bsv-1_PENDING': gunOnce(0) }
    const [b] = basvurulariBildirimeCevir([kayit({ durum: 'IN_REVIEW' })], okunanlar)
    expect(b.id).toBe('basvuru_bsv-1_IN_REVIEW')
    expect(b.readAt).toBe('')
  })

  it('en yeni başvuru üstte', () => {
    const liste = basvurulariBildirimeCevir([
      kayit({ id: 'eski', olusturmaZamani: gunOnce(5) }),
      kayit({ id: 'yeni', olusturmaZamani: gunOnce(0) }),
    ])
    expect(liste.map(b => b.targetId)).toEqual(['yeni', 'eski'])
  })

  it(`en çok ${BILDIRIM_SINIRI} satır gösterilir`, () => {
    const cok = Array.from({ length: BILDIRIM_SINIRI + 15 }, (_, i) =>
      kayit({ id: `bsv-${i}`, olusturmaZamani: gunOnce(i % 10) }))
    expect(basvurulariBildirimeCevir(cok)).toHaveLength(BILDIRIM_SINIRI)
  })

  it('boş defter boş liste verir — uydurma satır yok', () => {
    // Eskiden burada iki "Placeholder: ..." satırı vardı.
    expect(basvurulariBildirimeCevir([])).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ZİLİN BAĞLI OLDUĞU YER (mimari testi)
//
// Yukarıdaki testler kuralları sınıyor ama ZİLİN DEFTERE BAĞLI OLDUĞUNU
// sınamıyor. Asıl hata tam oradaydı: kurallar doğru olsa bile zil başka bir
// kaynağı okuyordu. Kural doğru, kablo kopuk — ekranda hiçbir şey yok.
// ═══════════════════════════════════════════════════════════════════════════

describe('Zil gerçekten deftere bağlı mı', () => {
  const kabuk = readFileSync(
    join(projeKokunuBul(), 'src', 'components', 'AppShell.tsx'), 'utf8',
  ) as string

  it('AppShell başvuru defterinden okuyor', () => {
    expect(kabuk).toContain('basvuruBildirimleriniYukle')
    expect(kabuk).toContain('PostgresBasvuruDefteri')
  })

  it('AppShell sahte bildirim üretmiyor', () => {
    expect(kabuk).not.toContain('ensureEvren360NotificationPlaceholders')
  })

  it('sahte bildirim ÜRETEN kod hiç yok', () => {
    // ⚠️ Metinde "Placeholder" geçmesi sorun değil — bu dosyanın ve servisin
    // yorumları o hatayı ANLATIYOR. Aranması gereken şey, sahte bir satır
    // KURAN kod: bir bildirim nesnesine yazılmış "Placeholder:" açıklaması.
    const servis = readFileSync(
      join(projeKokunuBul(), 'src', 'notifications', 'evren360-notification.service.ts'),
      'utf8',
    ) as string
    expect(servis).not.toMatch(/description:\s*['"`]Placeholder:/)
    expect(servis).not.toMatch(/export const ensureEvren360NotificationPlaceholders/)
  })

  it('başka bir sekmeden gelen başvuru için yoklama var', () => {
    // Müşteri formu BAŞKA bir tarayıcıda dolduruyor; bu sekmede hiçbir olay
    // tetiklenmez. Yoklama olmazsa zil ancak sayfa yenilenince uyanır.
    expect(kabuk).toMatch(/setInterval\([\s\S]{0,120}refreshNotifications/)
    expect(kabuk).toContain(`addEventListener('focus'`)
  })
})
