// Alerjen verisi yanlış girilirse etiket yanlış basılır ve bu insan sağlığına
// dokunur. Bu testler girişin kendisini koruyor.

import { describe, it, expect } from 'vitest'
import type { TenantCtx } from '../core/context'
import type {
  Alerjen, BesinDegeri, EksikKalem, EtiketDeposu, EtiketKalemi, KalemAlerjeni,
  UretilenParti,
  FirmaBilgisi, TuretilmisAlerjen,
} from './label.repository'
import {
  EtiketDogrulamaError, EtiketServisi, alerjenDurumu, alerjenleriDogrula,
  besinDogrula, etiketVerisiKur,
} from './label.service'
import { etiketKesilebilir } from './label-documents'

const CTX: TenantCtx = { tenantId: 'k1', branchId: 's1', userId: 'u1' }

class BellekDeposu implements EtiketDeposu {
  sonAlerjenler?: readonly KalemAlerjeni[]
  sonBesin?: BesinDegeri
  sonAmbalaj?: { miktar?: number; birim?: string }
  damgalanan?: string
  async firmaBilgisi(): Promise<FirmaBilgisi> { return { ad: 'ABC Gıda A.Ş.' } }
  async alerjenKatalogu(): Promise<Alerjen[]> { return [] }
  async kalemler(): Promise<EtiketKalemi[]> { return [] }
  async kalemAlerjenleri(): Promise<KalemAlerjeni[]> { return [] }
  // ⚠️ 0072: İKİ metot TEK metoda indi (tuzak 48 — PORT değişti, uygulayan
  // her sınıf değişmek zorunda). Taklit depo artık satırları ve damgayı
  // BİRLİKTE yazıyor; gerçek hayatta ikisini ayıran şey kalmadı.
  // `patlat` dolu ise çağrı düşer ve HİÇBİR ŞEY yazılmaz — atomikliği
  // sınayabilmek için.
  patlat?: string
  damga?: string
  async beyaniKaydet(
    _c: TenantCtx, i: string, s: readonly KalemAlerjeni[],
  ): Promise<string> {
    if(this.patlat) throw new Error(this.patlat)
    this.sonAlerjenler = s
    this.damgalanan = i
    this.damga = '2026-10-10T09:00:00.000Z'
    return this.damga
  }
  async ambalajYaz(_c: TenantCtx, _i: string, miktar?: number, birim?: string): Promise<void> {
    this.sonAmbalaj = { miktar, birim }
  }
  async besinDegeri(): Promise<BesinDegeri | undefined> { return undefined }
  async besinYaz(_c: TenantCtx, _i: string, g: BesinDegeri): Promise<void> { this.sonBesin = g }
  async mamulAlerjenleri(): Promise<TuretilmisAlerjen[]> { return [] }
  async mamulAlerjenEksikleri(): Promise<EksikKalem[]> { return [] }
  async mamulBesinDegeri(): Promise<BesinDegeri | undefined> { return undefined }
  async mamulBesinEksikleri(): Promise<EksikKalem[]> { return [] }
  // ⚠️ PORT'a 0067'de metot eklendi; uygulayan HER sınıf değişmek
  // zorunda (tuzak 48). Bunu `vitest` değil, yalnız `tsc` yakalar.
  async uretilenPartiler(): Promise<UretilenParti[]> { return this.partiler }
  partiler: UretilenParti[] = []
}

const kur = () => {
  const depo = new BellekDeposu()
  return { depo, servis: new EtiketServisi(depo) }
}

const kalem = (y: Partial<EtiketKalemi> = {}): EtiketKalemi => ({
  id: 'k1', kod: 'P-CRB', ad: 'Mercimek çorbası', temelBirim: 'koli', aktif: true, ...y,
})

describe('alerjenleriDogrula', () => {
  it('aynı alerjen İKİ KEZ işaretlenemiyor', () => {
    // Hem "içerir" hem "iz" çelişir; hangisinin basılacağı belirsiz kalır.
    expect(() => alerjenleriDogrula([
      { kod: 'SUT', tur: 'İÇERİR' }, { kod: 'SUT', tur: 'İZ' },
    ])).toThrow(/iki kez/)
  })

  it('boş liste geçerli — ama "alerjen yok" demek DEĞİL', () => {
    // Boş liste ile incelenmemiş kalem, ayrı bir damgayla ayrılıyor.
    expect(alerjenleriDogrula([])).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// BEYAN TEK PARÇADA KAYDEDİLİYOR (0072)
// ---------------------------------------------------------------------------
// Codex'in bulduğu hata: beyan İKİ çağrıyla yazılıyordu (önce satırlar, sonra
// "incelendi" damgası). Birincisi tutup ikincisi düşerse — ya da birincinin
// silme adımı tutup ekleme adımı düşerse — geriye SIFIR alerjen satırı ve
// ESKİ bir damga kalıyordu. O kalemin etiketi şunu yazıyordu:
//
//     "Bilinen alerjen içermez."
//
// Glüten ve süt içeren bir üründe. Bu testler o iki çağrının bir daha
// ayrılmamasını koruyor.
// ═══════════════════════════════════════════════════════════════════════════
describe('beyaniKaydet', () => {
  it('satırları ve "incelendi" damgasını BİRLİKTE yazıyor', async () => {
    const { depo, servis } = kur()
    const damga = await servis.beyaniKaydet(CTX, 'k1', [
      { kod: 'GLUTEN', tur: 'İÇERİR' }, { kod: 'SUT', tur: 'İZ' },
    ])
    expect(depo.sonAlerjenler).toHaveLength(2)
    expect(depo.damgalanan).toBe('k1')
    expect(damga).toBe('2026-10-10T09:00:00.000Z')
  })

  it('boş liste de bir beyandır — damga yine atılıyor', async () => {
    // "Baktım, bu üründe alerjen yok" demenin tek yolu bu. Damga atılmazsa
    // kalem sonsuza kadar "incelenmemiş" görünür ve etiket taslak kalır.
    const { depo, servis } = kur()
    await servis.beyaniKaydet(CTX, 'k1', [])
    expect(depo.sonAlerjenler).toEqual([])
    expect(depo.damgalanan).toBe('k1')
  })

  it('doğrulama düşerse HİÇBİR ŞEY yazılmıyor — damga da atılmıyor', async () => {
    const { depo, servis } = kur()
    await expect(servis.beyaniKaydet(CTX, 'k1', [
      { kod: 'SUT', tur: 'İÇERİR' }, { kod: 'SUT', tur: 'İZ' },
    ])).rejects.toThrow(/iki kez/)
    expect(depo.sonAlerjenler).toBeUndefined()
    expect(depo.damgalanan).toBeUndefined()
  })

  it('kayıt düşerse damga ESKİ HÂLİNDE kalıyor', async () => {
    // Tehlikeli olan hal şuydu: satırlar gitti, damga kaldı. Tek çağrıda
    // ikisi birden ya olur ya olmaz.
    const { depo, servis } = kur()
    depo.patlat = 'Alerjen beyanı kaydedilemedi: bağlantı koptu'
    await expect(servis.beyaniKaydet(CTX, 'k1', [{ kod: 'GLUTEN', tur: 'İÇERİR' }]))
      .rejects.toThrow(/bağlantı koptu/)
    expect(depo.sonAlerjenler).toBeUndefined()
    expect(depo.damgalanan).toBeUndefined()
  })

  it('servis ayrı bir "damgala" yolu BIRAKMIYOR', () => {
    // ⚠️ Bu test bir API sözleşmesini koruyor: damgayı beyandan ayrı atan
    // bir metot geri eklenirse hata yeniden doğar.
    const { servis } = kur()
    expect((servis as unknown as Record<string, unknown>).incelendiIsaretle)
      .toBeUndefined()
    expect((servis as unknown as Record<string, unknown>).alerjenleriYaz)
      .toBeUndefined()
  })
})

describe('besinDogrula', () => {
  const b = (y: Partial<BesinDegeri> = {}): BesinDegeri =>
    ({ temel: '100g', kaynak: 'Tedarikçi spesifikasyonu', ...y })

  it('KAYNAK zorunlu', () => {
    // Kaynağı yazılmayan bir besin değeri denetimde savunulamaz.
    expect(() => besinDogrula({ temel: '100g' })).toThrow(/kaynağı zorunlu/)
  })

  it('doymuş yağ toplam yağdan büyük olamaz', () => {
    expect(() => besinDogrula(b({ yag: 2, doymusYag: 3 }))).toThrow(/Doymuş yağ/)
  })

  it('şeker karbonhidrattan büyük olamaz', () => {
    expect(() => besinDogrula(b({ karbonhidrat: 10, seker: 12 }))).toThrow(/Şeker/)
  })

  it('eksi değer kabul edilmiyor', () => {
    expect(() => besinDogrula(b({ protein: -1 }))).toThrow(EtiketDogrulamaError)
  })

  it('geçerli değer kaynağı kırpılmış dönüyor', () => {
    expect(besinDogrula(b({ kaynak: '  Analiz raporu  ' })).kaynak).toBe('Analiz raporu')
  })
})

describe('EtiketServisi · ambalaj', () => {
  it('miktar ve birim BİRLİKTE girilmeli', () => {
    // "5" neyin 5'i? Yarım bir ambalaj bilgisi hiç bilgi değildir.
    const { servis } = kur()
    expect(servis.ambalajYaz(CTX, 'k1', 5)).rejects.toThrow(/BİRLİKTE/)
    expect(servis.ambalajYaz(CTX, 'k1', undefined, 'kg')).rejects.toThrow(/BİRLİKTE/)
  })

  it('ikisi birden boş bırakılabiliyor', async () => {
    const { servis, depo } = kur()
    await servis.ambalajYaz(CTX, 'k1')
    expect(depo.sonAmbalaj).toEqual({ miktar: undefined, birim: undefined })
  })

  it('sıfır ambalaj reddediliyor', () => {
    const { servis } = kur()
    expect(servis.ambalajYaz(CTX, 'k1', 0, 'kg')).rejects.toThrow(EtiketDogrulamaError)
  })
})

describe('etiketVerisiKur', () => {
  const temel = {
    kalem: kalem({ netMiktar: 5, netBirim: 'kg' }),
    firmaAdi: 'ABC Gıda A.Ş.',
    bilesenler: [{ ad: 'Su', alerjenMi: false }],
    alerjenler: [] as TuretilmisAlerjen[],
    alerjenEksikleri: [] as EksikKalem[],
    besinEksikleri: [] as EksikKalem[],
  }

  it('gramajı okunur metne çeviriyor', () => {
    expect(etiketVerisiKur(temel).netMiktar).toBe('5 kg')
  })

  it('ambalaj yarımsa gramaj YAZILMIYOR', () => {
    const v = etiketVerisiKur({ ...temel, kalem: kalem({ netMiktar: 5 }) })
    expect(v.netMiktar).toBeUndefined()
  })

  it('EKSİKLERİ GİZLEMİYOR — etiket taslak kalıyor', () => {
    // Bu, bu modülün var olma sebebi. Temizleseydik eksik veriyle "temiz"
    // görünen bir etiket basılırdı.
    const v = etiketVerisiKur({
      ...temel,
      alerjenEksikleri: [{ kalemId: 'b1', kalemAdi: 'Baharat karışımı' }],
    })
    expect(v.alerjeniIncelenmemis).toEqual(['Baharat karışımı'])
    expect(etiketKesilebilir(v)).toBe(false)
  })

  it('veri tamken etiket kesilebiliyor', () => {
    const v = etiketVerisiKur({
      ...temel,
      lotKodu: 'LOT-1', uretimTarihi: '2026-10-01', sonKullanma: '2026-10-08',
      besin: { temel: '100g', enerjiKcal: 21, protein: 1.6 },
    })
    expect(etiketKesilebilir(v)).toBe(true)
  })
})

describe('alerjenDurumu', () => {
  it('incelenmemişi açıkça söylüyor', () => {
    expect(alerjenDurumu(kalem(), 0)).toBe('alerjeni incelenmedi')
  })

  it('incelenmiş ve alerjensizi AYIRIYOR', () => {
    // İki hâl aynı cümleyle gösterilseydi, kullanıcı hangisinin hangisi
    // olduğunu bilemezdi.
    const k = kalem({ incelemeZamani: '2026-10-01T10:00:00Z' })
    expect(alerjenDurumu(k, 0)).toBe('incelendi · alerjen yok')
    expect(alerjenDurumu(k, 2)).toBe('incelendi · 2 alerjen')
  })
})
