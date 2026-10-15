import { describe, expect, it } from 'vitest'
import {
  KALITE_KAYIT_DUZELTME, KAPATMA_YETKISI_YOK, yazabilirMi, YAZMA_YETKISI_YOK,
} from './yazma-yetkisi'
import type { User } from '../types'

/**
 * Bu testler Emrah'ın tamamlanma ölçütünü koruyor:
 * *"herkes kendine verilen yetkiler çerçevesinde HAREKET edebiliyorsa."*
 *
 * İzin listeleri 14.10.2026'da canlı veritabanından okundu.
 */
const kisi = (izinler?: string[]): User => ({
  id: 'u', fullName: 'T', username: 't', role: 'Personel', active: true,
  ...(izinler === undefined ? {} : { permissions: izinler }),
}) as User

const R: Record<string, string[]> = {
  isletme_sahibi: ['audit.read','branch.manage','branch.read','company.manage',
    'company.read','dashboard.read','finance.read','finance.write','logistics.read',
    'logistics.write','operations.approve','operations.read','operations.write',
    'personnel.manage','personnel.read','production.read','production.write',
    'products.read','products.write','purchase.read','purchase.write',
    'quality.declaration','quality.read','quality.record.manage','quality.write',
    'recipe.read',
    'recipe.write','roles.manage','settings.manage','stock.read','stock.write',
    'users.manage','users.read'],
  depo_sorumlusu: ['branch.read','dashboard.read','logistics.read','logistics.write',
    'production.read','products.read','purchase.read','quality.read','recipe.read',
    'stock.read','stock.write'],
  uretim_sorumlusu: ['branch.read','dashboard.read','production.read','production.write',
    'products.read','quality.read','quality.write','recipe.read','recipe.write',
    'stock.read','stock.write'],
  kalite_sorumlusu: ['audit.read','branch.read','dashboard.read','logistics.read',
    'production.read','quality.declaration','quality.read','quality.record.manage',
    'quality.write','recipe.read','stock.read'],
  sevkiyat_sorumlusu: ['branch.read','dashboard.read','logistics.read','logistics.write',
    'products.read','quality.read','quality.write','stock.read','stock.write'],
  personel: ['dashboard.read','production.read','production.write','products.read',
    'recipe.read','stock.read','stock.write'],
  gida_muhendisi: ['audit.read','branch.read','dashboard.read','logistics.read',
    'production.read','products.read','quality.declaration','quality.read',
    'quality.record.manage','quality.write','recipe.read','stock.read'],
  izleyici: ['audit.read','branch.read','company.read','dashboard.read','finance.read',
    'logistics.read','operations.read','personnel.read','production.read',
    'products.read','purchase.read','quality.read','recipe.read','stock.read',
    'users.read'],
}

describe('yazabilirMi — temel davranış', () => {
  it('⚠️ izin listesi YOKSA yazamaz (eski kalıbın tersi)', () => {
    // Eski kod `!permissions || ...` diyordu: listesi kaybolan kullanıcı
    // HER ŞEYİ yazabiliyordu. `normalizeUser`ın listeyi düşürdüğü hata
    // (12.10) tam buraya bağlanıyordu.
    expect(yazabilirMi(kisi(undefined), 'stock.write')).toBe(false)
    expect(yazabilirMi(null, 'stock.write')).toBe(false)
  })

  it('boş liste de yazamaz', () => {
    expect(yazabilirMi(kisi([]), 'stock.write')).toBe(false)
  })

  it('izni olan yazar', () => {
    expect(yazabilirMi(kisi(['stock.write']), 'stock.write')).toBe(true)
  })

  it('düğme sessizce gizlenmiyor, sebebi yazılıyor', () => {
    expect(YAZMA_YETKISI_YOK).toContain('yetkiniz yok')
  })
})

describe('⚠️ REÇETE yazma — `recipe.write` (Codex 14.10)', () => {
  it('üretim sorumlusu ve işletme sahibi reçete yazar', () => {
    expect(yazabilirMi(kisi(R.uretim_sorumlusu), 'recipe.write')).toBe(true)
    expect(yazabilirMi(kisi(R.isletme_sahibi), 'recipe.write')).toBe(true)
  })
  it('⚠️ kalite ve gıda mühendisi reçeteyi DEĞİŞTİREMEZ — rol açıklamasında yazan bu', () => {
    expect(yazabilirMi(kisi(R.kalite_sorumlusu), 'recipe.write')).toBe(false)
    expect(yazabilirMi(kisi(R.gida_muhendisi), 'recipe.write')).toBe(false)
  })
  it('⚠️ `production.write` tek başına reçete açmıyor', () => {
    // Eski kapı buydu; operasyon personelinde `production.write` var.
    expect(R.personel).toContain('production.write')
    expect(yazabilirMi(kisi(R.personel), 'recipe.write')).toBe(false)
  })
})

describe('⚠️ HACCP yazma — `quality.write` (Codex 14.10)', () => {
  it('kalite sorumlusu ve gıda mühendisi ölçüm girer', () => {
    expect(yazabilirMi(kisi(R.kalite_sorumlusu), 'quality.write')).toBe(true)
    expect(yazabilirMi(kisi(R.gida_muhendisi), 'quality.write')).toBe(true)
  })
  it('⚠️ DEPO SORUMLUSU HACCP ölçümü GİREMEZ — en tehlikeli sapma buydu', () => {
    // Eski kapı `stock.write`i de kabul ediyordu; depo sorumlusunda o izin
    // var. Yani kalite imzasını depo atabiliyordu.
    expect(R.depo_sorumlusu).toContain('stock.write')
    expect(yazabilirMi(kisi(R.depo_sorumlusu), 'quality.write')).toBe(false)
  })
  it('operasyon personeli de giremez', () => {
    expect(yazabilirMi(kisi(R.personel), 'quality.write')).toBe(false)
  })
})

describe('⚠️ SEVKİYAT yazma — `logistics.write` (Codex 14.10)', () => {
  it('sevkiyat ve depo sorumlusu sevk eder', () => {
    expect(yazabilirMi(kisi(R.sevkiyat_sorumlusu), 'logistics.write')).toBe(true)
    expect(yazabilirMi(kisi(R.depo_sorumlusu), 'logistics.write')).toBe(true)
  })
  it('⚠️ operasyon personeli sevkiyat ÇIKARAMAZ', () => {
    expect(R.personel).toContain('stock.write')   // eski kapı buydu
    expect(yazabilirMi(kisi(R.personel), 'logistics.write')).toBe(false)
  })
  it('kalite sevkiyatı görür ama sevk etmez', () => {
    expect(R.kalite_sorumlusu).toContain('logistics.read')
    expect(yazabilirMi(kisi(R.kalite_sorumlusu), 'logistics.write')).toBe(false)
  })
})

describe('⚠️ ETİKET/BEYAN yazma — `quality.declaration` (Codex 14.10)', () => {
  it('kalite, gıda mühendisi ve üretim beyan yazar', () => {
    expect(yazabilirMi(kisi(R.kalite_sorumlusu), 'quality.declaration')).toBe(true)
    expect(yazabilirMi(kisi(R.gida_muhendisi), 'quality.declaration')).toBe(true)
    expect(yazabilirMi(kisi(R.isletme_sahibi), 'quality.declaration')).toBe(true)
  })
  it('⚠️ sevkiyat sorumlusu etiketi GÖRÜR ama BEYAN YAZAMAZ', () => {
    // `quality.write` var ama `quality.declaration` yok. Eski kapı
    // `quality.write`i kabul ettiği için beyan yazabiliyordu.
    expect(R.sevkiyat_sorumlusu).toContain('quality.write')
    expect(yazabilirMi(kisi(R.sevkiyat_sorumlusu), 'quality.declaration')).toBe(false)
  })
  it('depo ve operasyon personeli beyan yazamaz', () => {
    expect(yazabilirMi(kisi(R.depo_sorumlusu), 'quality.declaration')).toBe(false)
    expect(yazabilirMi(kisi(R.personel), 'quality.declaration')).toBe(false)
  })
})

describe('⚠️ GÖRÜNTÜLEYİCİ hiçbir şey yazamaz', () => {
  // Açıklaması: "Her şeyi görür, hiçbir şeyi değiştiremez."
  const yazmaIzinleri = ['stock.write', 'production.write', 'quality.write',
    'quality.declaration', 'quality.record.manage',
    'recipe.write', 'logistics.write', 'finance.write',
    'purchase.write', 'products.write', 'operations.write', 'users.manage',
    'settings.manage', 'company.manage']
  yazmaIzinleri.forEach(izin => {
    it(`izleyici ${izin} taşımıyor`, () => {
      expect(yazabilirMi(kisi(R.izleyici), izin)).toBe(false)
    })
  })
})

describe('⚠️ KALİTE KAYDINI DÜZELTME — `quality.record.manage` (0081)', () => {
  // ── Bu bloğun sebebi bir EKRAN GÖRÜNTÜSÜ ──────────────────────────────
  // 14.10.2026, Ümit Burak Boz (sevkiyat sorumlusu) HACCP ekranında
  // CCP-1'in — bir MAL KABUL uygunsuzluğunun, sorumlusu "Depo sorumlusu"
  // yazan satırın — yanında "Kapat" düğmesi görüyordu.
  //
  // Sebep tek izindi: `quality.write` hem ölçüm girmeyi hem kapatmayı
  // açıyordu ve 0068 o izni (DOĞRU bir kararla) üretim ve sevkiyata
  // vermişti — ölçümü ölçen girsin diye.
  //
  // 0081 ayırdı: girmek takdir işi değil, kapatmak takdir işidir.

  it('kalite sorumlusu ve gıda mühendisi kapatabilir', () => {
    expect(yazabilirMi(kisi(R.kalite_sorumlusu), 'quality.record.manage')).toBe(true)
    expect(yazabilirMi(kisi(R.gida_muhendisi), 'quality.record.manage')).toBe(true)
    expect(yazabilirMi(kisi(R.isletme_sahibi), 'quality.record.manage')).toBe(true)
  })

  it('⚠️ SEVKİYAT SORUMLUSU KAPATAMAZ — ekran görüntüsündeki tam hata', () => {
    expect(R.sevkiyat_sorumlusu).toContain('quality.write')
    expect(yazabilirMi(kisi(R.sevkiyat_sorumlusu), 'quality.record.manage')).toBe(false)
  })

  it('⚠️ ÜRETİM SORUMLUSU DA KAPATAMAZ', () => {
    expect(R.uretim_sorumlusu).toContain('quality.write')
    expect(yazabilirMi(kisi(R.uretim_sorumlusu), 'quality.record.manage')).toBe(false)
  })

  it('⚠️ 0068 BOZULMADI: üretim ve sevkiyat ÖLÇÜM GİRMEYE devam ediyor', () => {
    // Ayrımın bütün inceliği bu. Ölçümü zorlaştırsaydık kayıt kâğıda
    // yazılır, akşam toplu girilirdi — ve HACCP'in anlamı biterdi.
    expect(yazabilirMi(kisi(R.uretim_sorumlusu), 'quality.write')).toBe(true)
    expect(yazabilirMi(kisi(R.sevkiyat_sorumlusu), 'quality.write')).toBe(true)
  })

  it('depo sorumlusu ne girer ne kapatır', () => {
    expect(yazabilirMi(kisi(R.depo_sorumlusu), 'quality.write')).toBe(false)
    expect(yazabilirMi(kisi(R.depo_sorumlusu), 'quality.record.manage')).toBe(false)
  })

  it('kapatamayan kişiye SEBEBİ söyleniyor', () => {
    expect(KAPATMA_YETKISI_YOK).toContain('kalite')
    expect(KAPATMA_YETKISI_YOK).toContain('Ölçümü siz girebilirsiniz')
  })

  it('izin sabiti kodla aynı', () => {
    expect(KALITE_KAYIT_DUZELTME).toBe('quality.record.manage')
  })
})
