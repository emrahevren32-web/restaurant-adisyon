import {
  getCompanyIdForUser,
  getVisibleBranchesForUser,
  loadBranches,
  loadCompanies,
  saveBranches,
  saveCompanies
} from '../storage'
import { normalizeIdentifier } from '../core/identifier'
import type { Branch, Company, User } from '../types'

/**
 * Branch directory — the rules that sit above plain branch CRUD.
 *
 * Head office is not a free-text flag. `Company.defaultBranchId` is the
 * authoritative pointer (it already existed and other code reads it), and
 * `Branch.isHeadOffice` mirrors it so a single row can be judged without
 * loading the company. These two are kept in step here, in one place, rather
 * than at every call site.
 */

export type BranchSaveResult =
  | { ok: true; branch: Branch; branches: Branch[] }
  | { ok: false; error: string }

export type BranchGuardResult = { allowed: true } | { allowed: false; reason: string }

const now = () => new Date().toISOString()

export const getCompanyForUser = (user: User): Company | undefined => {
  const companyId = getCompanyIdForUser(user)
  if(!companyId) return undefined
  return loadCompanies().find(company => company.id === companyId)
}

/**
 * The head office for a company, resolved in priority order:
 *   1. the company's own pointer
 *   2. a branch that carries the mirror flag
 *   3. the oldest active branch — a company always has a head office in
 *      practice, and falling back keeps the guard meaningful on legacy data
 *      that predates the pointer.
 */
export const resolveHeadOfficeId = (branches: Branch[], company?: Company): string => {
  if(company?.defaultBranchId && branches.some(branch => branch.id === company.defaultBranchId)){
    return company.defaultBranchId
  }

  const flagged = branches.find(branch => branch.isHeadOffice)
  if(flagged) return flagged.id

  const oldestActive = [...branches]
    .filter(branch => branch.isActive)
    .sort((first, second) => (first.createdAt || '').localeCompare(second.createdAt || ''))[0]

  return oldestActive?.id || ''
}

export const isHeadOffice = (branch: Branch, headOfficeId: string) => branch.id === headOfficeId

/** A company must keep exactly one reachable head office. */
export const canDeactivateBranch = (branch: Branch, headOfficeId: string): BranchGuardResult => {
  if(isHeadOffice(branch, headOfficeId)){
    return {
      allowed: false,
      reason: 'Merkez şube pasife alınamaz. Önce başka bir şubeyi merkez olarak işaretleyin.'
    }
  }
  return { allowed: true }
}

export const canDeleteBranch = (branch: Branch, headOfficeId: string): BranchGuardResult => {
  if(isHeadOffice(branch, headOfficeId)){
    return { allowed: false, reason: 'Merkez şube silinemez.' }
  }
  return { allowed: true }
}

/**
 * Persist a company's branches without touching any other company's rows —
 * branches live in one shared collection, so the untouched remainder has to be
 * written back alongside.
 */
export const persistCompanyBranches = (user: User, companyBranches: Branch[]) => {
  const companyId = getCompanyIdForUser(user)
  const others = loadBranches().filter(branch => branch.companyId !== companyId)
  saveBranches([...companyBranches, ...others])
}

/**
 * Move the head office marker to a branch, keeping the company pointer and the
 * per-branch mirror consistent. Returns the updated branch list.
 */
export const assignHeadOffice = (user: User, branches: Branch[], branchId: string): Branch[] => {
  const stamp = now()
  const next = branches.map(branch => {
    const shouldFlag = branch.id === branchId
    if(Boolean(branch.isHeadOffice) === shouldFlag) return branch
    return { ...branch, isHeadOffice: shouldFlag, updatedAt: stamp }
  })

  const companyId = getCompanyIdForUser(user)
  if(companyId){
    const companies = loadCompanies()
    const index = companies.findIndex(company => company.id === companyId)
    if(index >= 0 && companies[index].defaultBranchId !== branchId){
      companies[index] = { ...companies[index], defaultBranchId: branchId, updatedAt: stamp }
      saveCompanies(companies)
    }
  }

  persistCompanyBranches(user, next)
  return next
}

export const loadCompanyBranches = (user: User) => getVisibleBranchesForUser(user)

export const findDuplicateCode = (branches: Branch[], code: string, ignoreId?: string) => (
  branches.some(branch => (
    normalizeIdentifier(branch.code) === normalizeIdentifier(code) && branch.id !== ignoreId
  ))
)

/** Corporate profile lives on the company record, never on a branch. */
export const saveCompanyProfile = (companyId: string, patch: Partial<Company>): Company | undefined => {
  const companies = loadCompanies()
  const index = companies.findIndex(company => company.id === companyId)
  if(index < 0) return undefined

  const updated: Company = { ...companies[index], ...patch, id: companies[index].id, updatedAt: now() }
  companies[index] = updated
  saveCompanies(companies)
  return updated
}
