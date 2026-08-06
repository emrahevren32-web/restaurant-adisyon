import { getCompanyIdForUser } from '../storage'
import type { User } from '../types'
import { WorkspaceIndexedStorageService } from './workspace-indexed-storage.service'

export type WorkspaceAuditEventType =
  | 'MODULE_INSTALLED'
  | 'MODULE_CONFIGURED'
  | 'MODULE_ACTIVATED'
  | 'MODULE_SUSPENDED'
  | 'MODULE_REACTIVATED'
  | 'MODULE_DETACHED_FROM_WORKSPACE'
  | 'MODULE_SETUP_STARTED'
  | 'MODULE_SETUP_COMPLETED'

export type WorkspaceAuditEvent = {
  id: string
  companyId: string
  eventType: WorkspaceAuditEventType
  title: string
  description: string
  moduleId?: string
  moduleCode?: string
  moduleName?: string
  createdAt: string
  createdByUserId: string
}

export type WorkspaceAuditEventInput = {
  user: User
  eventType: WorkspaceAuditEventType
  title: string
  description: string
  moduleId?: string
  moduleCode?: string
  moduleName?: string
}

const STORAGE_KEY = 'miyop_workspace_audit_events'
export const WORKSPACE_AUDIT_EVENT = 'miyop-workspace-audit-events-updated'

const createAuditId = (companyId: string, eventType: WorkspaceAuditEventType, createdAt: string) => {
  const companyPart = companyId.replace(/[^a-z0-9]/gi, '').slice(-8) || 'workspace'
  const timePart = new Date(createdAt).getTime().toString(36)
  return `workspace_audit_${companyPart}_${eventType.toLowerCase()}_${timePart}`
}

const normalizeAuditEvent = (item: Partial<WorkspaceAuditEvent>): WorkspaceAuditEvent | null => {
  const companyId = String(item.companyId || '').trim()
  const eventType = item.eventType
  const title = String(item.title || '').trim()
  const createdByUserId = String(item.createdByUserId || '').trim()

  if(!companyId || !eventType || !title || !createdByUserId) return null

  const createdAt = String(item.createdAt || new Date().toISOString())

  return {
    id: String(item.id || createAuditId(companyId, eventType, createdAt)),
    companyId,
    eventType,
    title,
    description: String(item.description || title),
    moduleId: item.moduleId ? String(item.moduleId) : undefined,
    moduleCode: item.moduleCode ? String(item.moduleCode) : undefined,
    moduleName: item.moduleName ? String(item.moduleName) : undefined,
    createdAt,
    createdByUserId
  }
}

const readAuditEvents = (): WorkspaceAuditEvent[] => {
  const storedEvents = WorkspaceIndexedStorageService.get<Partial<WorkspaceAuditEvent>[]>(
    STORAGE_KEY,
    [],
    [WORKSPACE_AUDIT_EVENT]
  )
  return Array.isArray(storedEvents)
    ? storedEvents.map(normalizeAuditEvent).filter(Boolean) as WorkspaceAuditEvent[]
    : []
}

const saveAuditEvents = (items: WorkspaceAuditEvent[]) => {
  WorkspaceIndexedStorageService.set(
    STORAGE_KEY,
    items.map(normalizeAuditEvent).filter(Boolean),
    [WORKSPACE_AUDIT_EVENT]
  )
}

export const recordWorkspaceAuditEvent = (input: WorkspaceAuditEventInput) => {
  const companyId = getCompanyIdForUser(input.user)
  if(!companyId) return null

  const createdAt = new Date().toISOString()
  const event = normalizeAuditEvent({
    ...input,
    companyId,
    createdAt,
    createdByUserId: input.user.id
  })

  if(!event) return null

  saveAuditEvents([event, ...readAuditEvents()])
  return event
}

export const getWorkspaceAuditEvents = (companyId: string) => {
  return readAuditEvents()
    .filter(item => item.companyId === companyId)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
}

export const getWorkspaceAuditEventsForUser = (user: User | null | undefined) => {
  const companyId = getCompanyIdForUser(user)
  return companyId ? getWorkspaceAuditEvents(companyId) : []
}
