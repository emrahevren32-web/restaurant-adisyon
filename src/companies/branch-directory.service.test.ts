import { describe, expect, it } from 'vitest'
import {
  canDeactivateBranch,
  canDeleteBranch,
  findDuplicateCode,
  resolveHeadOfficeId
} from './branch-directory.service'
import type { Branch, Company } from '../types'

/**
 * Merkez şube çözümleme — Production Foundation, Dilim 0 / G1.4.
 *
 * Bu kural ADR-002'nin değil ürünün kuralı: bir firmanın her zaman tam olarak bir
 * ulaşılabilir merkez şubesi olmalı. Öncelik sırası:
 *   1. Company.defaultBranchId (yetkili kaynak)
 *   2. Branch.isHeadOffice (ayna bayrak)
 *   3. en eski aktif şube (eski verinin kurtarma yolu)
 */

const branch = (overrides: Partial<Branch> & Pick<Branch, 'id'>): Branch => ({
  code: overrides.id.toUpperCase(),
  name: `Şube ${overrides.id}`,
  phone: '',
  email: '',
  address: '',
  city: '',
  managerName: '',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides
})

const company = (overrides: Partial<Company> = {}): Company => ({
  id: 'c1',
  companyCode: 'C1',
  companyName: 'Test Firma',
  legalName: '',
  taxOffice: '',
  taxNumber: '',
  phone: '',
  email: '',
  city: '',
  district: '',
  address: '',
  authorizedPerson: '',
  authorizedPhone: '',
  authorizedEmail: '',
  status: 'Aktif',
  isApproved: true,
  primarySectorId: '',
  approvedAt: '',
  approvedBy: '',
  workspaceId: '',
  defaultBranchId: '',
  tenantId: 't1',
  subscriptionId: '',
  licenseStart: '',
  licenseEnd: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: '',
  ownerName: '',
  ...overrides
})

describe('resolveHeadOfficeId', () => {
  it('firma işaretçisi varsa onu kullanır — ayna bayrak başka şubeyi gösterse bile', () => {
    const branches = [
      branch({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }),
      branch({ id: 'b', isHeadOffice: true, createdAt: '2026-02-01T00:00:00.000Z' })
    ]

    expect(resolveHeadOfficeId(branches, company({ defaultBranchId: 'a' }))).toBe('a')
  })

  it('firma işaretçisi silinmiş bir şubeyi gösteriyorsa ayna bayrağa düşer', () => {
    const branches = [
      branch({ id: 'a' }),
      branch({ id: 'b', isHeadOffice: true })
    ]

    expect(resolveHeadOfficeId(branches, company({ defaultBranchId: 'silinmis-id' }))).toBe('b')
  })

  it('hiçbir işaret yoksa en eski aktif şubeye düşer', () => {
    const branches = [
      branch({ id: 'yeni', createdAt: '2026-05-01T00:00:00.000Z' }),
      branch({ id: 'eski', createdAt: '2026-01-01T00:00:00.000Z' }),
      branch({ id: 'daha-eski-ama-pasif', createdAt: '2025-01-01T00:00:00.000Z', isActive: false })
    ]

    expect(resolveHeadOfficeId(branches, company())).toBe('eski')
  })

  it('şube yoksa boş döner, patlamaz', () => {
    expect(resolveHeadOfficeId([], company())).toBe('')
  })
})

describe('merkez şube korumaları', () => {
  it('merkez şube pasife alınamaz', () => {
    const head = branch({ id: 'merkez' })

    expect(canDeactivateBranch(head, 'merkez').allowed).toBe(false)
    expect(canDeactivateBranch(branch({ id: 'diger' }), 'merkez').allowed).toBe(true)
  })

  it('merkez şube silinemez', () => {
    expect(canDeleteBranch(branch({ id: 'merkez' }), 'merkez').allowed).toBe(false)
    expect(canDeleteBranch(branch({ id: 'diger' }), 'merkez').allowed).toBe(true)
  })
})

describe('findDuplicateCode', () => {
  it('şube kodunu büyük/küçük harf farkını yok sayarak karşılaştırır', () => {
    const branches = [branch({ id: 'a', code: 'ISTANBUL' })]

    expect(findDuplicateCode(branches, 'istanbul')).toBe(true)
    expect(findDuplicateCode(branches, 'ANKARA')).toBe(false)
  })

  // Regresyon: Türkçe yerel ayarıyla küçültme kullanıldığında 'ISTANBUL' → 'ıstanbul'
  // oluyor ve 'istanbul' ile eşleşmiyordu; sistem aynı kodla ikinci şube açtırıyordu.
  it('Türkçe noktalı/noktasız i varyantlarını aynı kod sayar', () => {
    const branches = [branch({ id: 'a', code: 'İSTANBUL' })]

    expect(findDuplicateCode(branches, 'istanbul')).toBe(true)
    expect(findDuplicateCode(branches, 'ıstanbul')).toBe(true)
  })

  it('şubenin kendi kodunu çakışma saymaz', () => {
    const branches = [branch({ id: 'a', code: 'ISTANBUL' })]

    expect(findDuplicateCode(branches, 'ISTANBUL', 'a')).toBe(false)
  })
})
