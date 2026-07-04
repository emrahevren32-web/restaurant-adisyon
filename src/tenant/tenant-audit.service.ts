import type { Tenant } from '../types'

const KEY_TENANT_AUDIT_EVENTS = 'miyop_tenant_audit_events'

export type TenantAuditEventType =
  | 'TENANT_CREATED'
  | 'TENANT_UPDATED'
  | 'TENANT_ACTIVATED'
  | 'TENANT_DEACTIVATED'
  | 'TENANT_ARCHIVED'

export type TenantAuditEvent = {
  id: string
  tenantId: string
  tenantCode: string
  tenantName: string
  ownerCompanyId: string
  eventType: TenantAuditEventType
  title: string
  description: string
  actorUserId: string
  actorName: string
  createdAt: string
}

export type RecordTenantAuditEventInput = {
  tenant: Tenant
  eventType: TenantAuditEventType
  title?: string
  description?: string
  actorUserId?: string
  actorName?: string
}

const readEvents = (): TenantAuditEvent[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY_TENANT_AUDIT_EVENTS) || '[]')
    return Array.isArray(parsed) ? parsed.filter(item => item?.id && item?.tenantId) : []
  } catch {
    return []
  }
}

const saveEvents = (items: TenantAuditEvent[]) => {
  localStorage.setItem(KEY_TENANT_AUDIT_EVENTS, JSON.stringify(items))
}

const defaultEventTitles: Record<TenantAuditEventType, string> = {
  TENANT_CREATED: 'Tenant Created',
  TENANT_UPDATED: 'Tenant Updated',
  TENANT_ACTIVATED: 'Tenant Activated',
  TENANT_DEACTIVATED: 'Tenant Deactivated',
  TENANT_ARCHIVED: 'Tenant Archived'
}

export const recordTenantAuditEvent = ({
  tenant,
  eventType,
  title,
  description,
  actorUserId = '',
  actorName = 'System'
}: RecordTenantAuditEventInput) => {
  const event: TenantAuditEvent = {
    id: `tenant_audit_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    tenantId: tenant.id,
    tenantCode: tenant.tenantCode,
    tenantName: tenant.tenantName,
    ownerCompanyId: tenant.ownerCompanyId,
    eventType,
    title: title || defaultEventTitles[eventType],
    description: description || `${tenant.tenantName} için ${defaultEventTitles[eventType]} olayı oluşturuldu.`,
    actorUserId,
    actorName,
    createdAt: new Date().toISOString()
  }

  saveEvents([event, ...readEvents()])
  return event
}

export const loadTenantAuditEvents = (tenantId?: string) => {
  const events = readEvents()
  return tenantId ? events.filter(event => event.tenantId === tenantId) : events
}
