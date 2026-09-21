// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Sektöre ait modül, yalnızca o sektörde görünür
//
// ── NEDEN BU TEST VAR ────────────────────────────────────────────────────
// Emrah'ın kuralı: "her modül kendi sektörüne ait olacak". Bunun iki ayrı
// yarısı var ve ikisi de burada sınanıyor:
//
//   1. Sektörü bildirilmiş modül BAŞKA sektöre sızmamalı.
//   2. Sektörü bildirilmemiş modül herkese açıktır — bu bilinçli bir karar,
//      kaza değil. Finans ve Personel her sektörde aynıdır.
//
// Ayrıca sektörün İKİ YAZIMI var ('industrial-kitchen' ve
// 'sector_industrial_kitchen'); başvuru onayı birincisini, modül kaydı
// ikincisini kullanıyor. İkisi de eşleşmek zorunda, yoksa gerçek akıştan
// geçen müşterinin OPERASYON bölümü boş açılır.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  BUSINESS_WORKSPACE_MODULE_REGISTRY,
  getBusinessWorkspaceModuleById,
  isBusinessWorkspaceModuleAvailableForSector
} from './business-workspace.registry'
import { SECTOR_CODES, createSectorId } from '../sector/sector.registry'

const MUTFAK_KIMLIK = createSectorId(SECTOR_CODES.INDUSTRIAL_KITCHEN)
const MUTFAK_KOD = SECTOR_CODES.INDUSTRIAL_KITCHEN
const KUAFOR_KIMLIK = createSectorId(SECTOR_CODES.HAIRDRESSER)

const sektorluModuller = BUSINESS_WORKSPACE_MODULE_REGISTRY
  .filter(m => (m.supportedSectorIds?.length ?? 0) > 0)

describe('Sektör süzmesi', () => {
  it('sektörü bildirilmiş en az bir modül var (süzme gerçekten çalışıyor)', () => {
    // Bu satır olmasaydı, aşağıdaki testler boş listede dönüp yeşil kalırdı.
    expect(sektorluModuller.length).toBeGreaterThan(0)
  })

  it('endüstriyel mutfak modülü kuaförde GÖRÜNMEZ', () => {
    sektorluModuller.forEach(modul => {
      expect(
        isBusinessWorkspaceModuleAvailableForSector(modul, KUAFOR_KIMLIK),
        `${modul.id} kuaförde görünüyor`
      ).toBe(false)
    })
  })

  it('sektörü olmayan kullanıcıya sektörlü modül açılmaz', () => {
    sektorluModuller.forEach(modul => {
      expect(isBusinessWorkspaceModuleAvailableForSector(modul, '')).toBe(false)
      expect(isBusinessWorkspaceModuleAvailableForSector(modul, undefined)).toBe(false)
    })
  })

  it('sektörün İKİ yazımı da aynı cevabı verir', () => {
    // 'industrial-kitchen'  → başvuru onayının firmaya yazdığı değer
    // 'sector_industrial_kitchen' → modül kaydındaki değer
    sektorluModuller.forEach(modul => {
      expect(isBusinessWorkspaceModuleAvailableForSector(modul, MUTFAK_KIMLIK)).toBe(true)
      expect(
        isBusinessWorkspaceModuleAvailableForSector(modul, MUTFAK_KOD),
        `${modul.id} yalnızca kimlik yazımıyla eşleşiyor; başvurudan gelen kod yazımıyla eşleşmiyor`
      ).toBe(true)
    })
  })

  it('sektörü bildirilmemiş modül her sektörde açıktır', () => {
    // Finans her sektörde aynıdır; bunun sektöre bağlanması yanlış olurdu.
    const finans = getBusinessWorkspaceModuleById('business-finance')
    expect(finans).toBeTruthy()
    expect(finans?.supportedSectorIds ?? []).toHaveLength(0)
    expect(isBusinessWorkspaceModuleAvailableForSector(finans!, KUAFOR_KIMLIK)).toBe(true)
  })

  it('Üretim, Reçete, Satın Alma ve Kalite endüstriyel mutfağa bağlı', () => {
    // Emrah ekranda bu dördünü gördü ve "bunlar mutfak olduğu için mi
    // geliyor" diye sordu. Cevap kodda yazılı olsun.
    const beklenen = [
      'business-production-work-orders',
      'business-recipe',
      'business-purchase',
      'business-quality'
    ]
    beklenen.forEach(id => {
      const modul = getBusinessWorkspaceModuleById(id)
      expect(modul, `${id} kayıtta yok`).toBeTruthy()
      expect(modul?.supportedSectorIds, `${id} sektörsüz`).toContain(MUTFAK_KIMLIK)
    })
  })
})
