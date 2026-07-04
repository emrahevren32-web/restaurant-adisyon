import type { User } from '../types'
import {
  activateCompany,
  approveCompany,
  archiveCompany,
  createCompany,
  deactivateCompany,
  getCompanyById,
  listCompanies,
  updateCompany,
  type CompanyApprovalInput,
  type CompanyCreateInput,
  type CompanyListOptions,
  type CompanyUpdateInput
} from './company.service'

export const COMPANY_API_ENDPOINTS = {
  list: 'GET /companies',
  detail: 'GET /companies/:id',
  create: 'POST /companies',
  update: 'PUT /companies/:id',
  activate: 'PATCH /companies/:id/activate',
  deactivate: 'PATCH /companies/:id/deactivate',
  approve: 'PATCH /companies/:id/approve',
  archive: 'DELETE /companies/:id'
} as const

export type CompanyApiRequest =
  | { method: 'GET'; path: '/companies'; query?: CompanyListOptions; user?: User | null }
  | { method: 'GET'; path: `/companies/${string}`; user?: User | null }
  | { method: 'POST'; path: '/companies'; body: CompanyCreateInput; user?: User | null }
  | { method: 'PUT'; path: `/companies/${string}`; body: CompanyUpdateInput; user?: User | null }
  | { method: 'PATCH'; path: `/companies/${string}/activate`; user?: User | null }
  | { method: 'PATCH'; path: `/companies/${string}/deactivate`; user?: User | null }
  | { method: 'PATCH'; path: `/companies/${string}/approve`; body?: CompanyApprovalInput; user?: User | null }
  | { method: 'DELETE'; path: `/companies/${string}`; user?: User | null }

const getCompanyIdFromPath = (path: string, suffix = '') => {
  const pattern = suffix
    ? new RegExp(`^/companies/([^/]+)/${suffix}$`)
    : /^\/companies\/([^/]+)$/
  return path.match(pattern)?.[1] || ''
}

export const handleCompanyApiRequest = (request: CompanyApiRequest) => {
  if(request.method === 'GET' && request.path === '/companies'){
    return listCompanies(request.query || {})
  }

  if(request.method === 'POST' && request.path === '/companies'){
    return createCompany(request.body, { user: request.user })
  }

  if(request.method === 'GET'){
    const companyId = getCompanyIdFromPath(request.path)
    const company = companyId ? getCompanyById(companyId, { allTenants: true }) : null
    if(!company) throw new Error('Company bulunamadı.')
    return company
  }

  if(request.method === 'PUT'){
    const companyId = getCompanyIdFromPath(request.path)
    if(!companyId) throw new Error('Company endpoint geçersiz.')
    return updateCompany(companyId, request.body, { user: request.user })
  }

  if(request.method === 'PATCH'){
    const activateId = getCompanyIdFromPath(request.path, 'activate')
    if(activateId) return activateCompany(activateId, { user: request.user })

    const deactivateId = getCompanyIdFromPath(request.path, 'deactivate')
    if(deactivateId) return deactivateCompany(deactivateId, { user: request.user })

    const approveId = getCompanyIdFromPath(request.path, 'approve')
    if(approveId){
      const body = 'body' in request ? request.body || {} : {}
      return approveCompany(approveId, body, { user: request.user })
    }
  }

  if(request.method === 'DELETE'){
    const companyId = getCompanyIdFromPath(request.path)
    if(companyId) return archiveCompany(companyId, { user: request.user })
  }

  throw new Error('Company endpoint desteklenmiyor.')
}
