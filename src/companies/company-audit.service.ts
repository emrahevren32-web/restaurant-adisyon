import type { Company } from '../types'

const KEY_COMPANY_AUDIT_EVENTS = 'miyop_company_audit_events'

export type CompanyAuditEventType =
  | 'COMPANY_CREATED'
  | 'COMPANY_UPDATED'
  | 'COMPANY_ACTIVATED'
  | 'COMPANY_DEACTIVATED'
  | 'COMPANY_APPROVED'
  | 'COMPANY_ARCHIVED'

export type CompanyAuditEvent = {
  id: string
  companyId: string
  companyCode: string
  tenantId: string
  workspaceId: string
  eventType: CompanyAuditEventType
  title: string
  description: string
  actorUserId: string
  actorName: string
  createdAt: string
}

export type RecordCompanyAuditEventInput = {
  company: Company
  eventType: CompanyAuditEventType
  title?: string
  description?: string
  actorUserId?: string
  actorName?: string
}

const readEvents = (): CompanyAuditEvent[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY_COMPANY_AUDIT_EVENTS) || '[]')
    return Array.isArray(parsed) ? parsed.filter(item => item?.id && item?.companyId) : []
  } catch {
    return []
  }
}

const saveEvents = (items: CompanyAuditEvent[]) => {
  localStorage.setItem(KEY_COMPANY_AUDIT_EVENTS, JSON.stringify(items))
}

const defaultEventTitles: Record<CompanyAuditEventType, string> = {
  COMPANY_CREATED: 'Company Created',
  COMPANY_UPDATED: 'Company Updated',
  COMPANY_ACTIVATED: 'Company Activated',
  COMPANY_DEACTIVATED: 'Company Deactivated',
  COMPANY_APPROVED: 'Company Approved',
  COMPANY_ARCHIVED: 'Company Archived'
}

export const recordCompanyAuditEvent = ({
  company,
  eventType,
  title,
  description,
  actorUserId = '',
  actorName = 'System'
}: RecordCompanyAuditEventInput) => {
  const event: CompanyAuditEvent = {
    id: `company_audit_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    companyId: company.id,
    companyCode: company.companyCode,
    tenantId: company.tenantId,
    workspaceId: company.workspaceId,
    eventType,
    title: title || defaultEventTitles[eventType],
    description: description || `${company.companyName} kaydı için ${defaultEventTitles[eventType]} olayı oluşturuldu.`,
    actorUserId,
    actorName,
    createdAt: new Date().toISOString()
  }

  saveEvents([event, ...readEvents()])
  return event
}

export const loadCompanyAuditEvents = (companyId?: string) => {
  const events = readEvents()
  return companyId ? events.filter(event => event.companyId === companyId) : events
}
