// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Karşılama ölçümü testleri · MIYOP-065
//
// Karşılama ekranı "İlk stok kartı tamamlandı" rozetini bir MODÜL kaydının
// varlığıyla ölçüyordu. Yeni müşteri hiçbir şey yapmadan "tamamlandı"
// görüyordu — bir *mış gibi*.
//
// ⚠️ Buradaki en önemli test: sorgu DÜŞERSE `null` döndüğünü ölçen test.
// `0` dönseydi ekran "işiniz bitmemiş" derdi; oysa doğru cevap "sayamadım".
// Bir kontrolün üç sonucu vardır: geçti, kaldı, ÖLÇEMEDİM (kontrol listesi 45).
// ═══════════════════════════════════════════════════════════════════════════

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Hata = { message: string } | null

const firmaCevabi = vi.fn(
  async (): Promise<{ data: Record<string, unknown>[] | null; error: Hata }> =>
    ({ data: [{ company_name: 'Yamaklar', tax_number: null }], error: null }),
)
const sayimCevabi = vi.fn(
  async (_tablo: string): Promise<{ count: number | null; error: Hata }> =>
    ({ count: 0, error: null }),
)
const secimCagrisi = vi.fn()

const from = vi.fn((tablo: string) => ({
  select: (sutunlar: string, ayar?: { count?: string; head?: boolean }) => {
    secimCagrisi(tablo, sutunlar, ayar)
    return ayar?.head ? sayimCevabi(tablo) : firmaCevabi()
  },
}))

vi.mock('../core/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({ from }),
}))

const { karsilamaDurumunuOku } = await import('./karsilama.repository')

describe('karsilamaDurumunuOku', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    firmaCevabi.mockResolvedValue({
      data: [{ company_name: 'Yamaklar', tax_number: null }], error: null,
    })
    sayimCevabi.mockResolvedValue({ count: 0, error: null })
  })

  it('⚠️ rozet MODÜL kaydından değil, GERÇEK sorgudan ölçülüyor', async () => {
    sayimCevabi.mockImplementation(async (tablo: string) => ({
      count: tablo === 'stock_item' ? 7 : 1, error: null,
    }))

    const durum = await karsilamaDurumunuOku()

    expect(from).toHaveBeenCalledWith('stock_item')
    expect(from).toHaveBeenCalledWith('app_user')
    expect(durum.urunKartiSayisi).toBe(7)
    expect(durum.kullaniciSayisi).toBe(1)
  })

  it('satır saymak için VERİ GETİRİLMİYOR (head sorgusu)', async () => {
    await karsilamaDurumunuOku()

    const sayimlar = secimCagrisi.mock.calls.filter(c => c[0] !== 'company')
    expect(sayimlar.length).toBe(2)
    for(const [, , ayar] of sayimlar){
      expect(ayar).toEqual({ count: 'exact', head: true })
    }
  })

  it('⚠️ SORGU DÜŞERSE `null` döner — `0` DEĞİL', async () => {
    sayimCevabi.mockResolvedValue({ count: null, error: { message: 'network' } })

    const durum = await karsilamaDurumunuOku()

    // `0` "hiç yok" demek, `null` "sayamadım" demek. Birleştirmek, bir okuma
    // arızasını "işiniz bitmemiş" diye göstermek olurdu.
    expect(durum.urunKartiSayisi).toBeNull()
    expect(durum.kullaniciSayisi).toBeNull()
  })

  it('bir sayım düşse öteki yine geliyor (hepsi ayrı çağrı)', async () => {
    sayimCevabi.mockImplementation(async (tablo: string) => (
      tablo === 'stock_item'
        ? { count: null, error: { message: 'network' } }
        : { count: 4, error: null }
    ))

    const durum = await karsilamaDurumunuOku()

    expect(durum.urunKartiSayisi).toBeNull()
    expect(durum.kullaniciSayisi).toBe(4)
  })

  it('vergi numarası boşken `false`, doluyken `true`', async () => {
    expect((await karsilamaDurumunuOku()).vergiNumarasiVar).toBe(false)

    firmaCevabi.mockResolvedValue({
      data: [{ company_name: 'Yamaklar', tax_number: '1234567890' }], error: null,
    })
    expect((await karsilamaDurumunuOku()).vergiNumarasiVar).toBe(true)
  })

  it('⚠️ sadece boşluk içeren vergi numarası DOLU sayılmıyor', async () => {
    firmaCevabi.mockResolvedValue({
      data: [{ company_name: 'Yamaklar', tax_number: '   ' }], error: null,
    })
    expect((await karsilamaDurumunuOku()).vergiNumarasiVar).toBe(false)
  })

  it('⚠️ birden çok firma satırında TAHMİN EDİLMİYOR', async () => {
    firmaCevabi.mockResolvedValue({
      data: [
        { company_name: 'A', tax_number: '1' },
        { company_name: 'B', tax_number: '2' },
      ],
      error: null,
    })

    const durum = await karsilamaDurumunuOku()

    expect(durum.firmaAdi).toBeNull()
    expect(durum.vergiNumarasiVar).toBeNull()
  })

  it('⚠️ kiracı süzmesi sorguya ELLE eklenmiyor — RLS yapar', async () => {
    await karsilamaDurumunuOku()

    const firma = secimCagrisi.mock.calls.find(c => c[0] === 'company') as [string, string]
    expect(firma[1]).not.toContain('tenant_id')
  })
})
