import type {
  ExcelDashboardStatistics,
  ExcelHistory,
  ExcelHistoryFilters,
  ExcelJob
} from './excel-engine.types'
import { EXCEL_MODULE_LABELS } from './excel-template.service'

const EXCEL_HISTORY_STORAGE_KEY = 'ra_excel_history'

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const getDateKey = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toLocaleDateString('sv-SE')
}

const readHistory = (): ExcelHistory[] => {
  if(!isBrowserStorageAvailable()) return []

  try {
    const parsed = JSON.parse(localStorage.getItem(EXCEL_HISTORY_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed as ExcelHistory[] : []
  } catch {
    return []
  }
}

const saveHistory = (history: ExcelHistory[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(EXCEL_HISTORY_STORAGE_KEY, JSON.stringify(history))
}

export const createExcelJob = (
  input: Omit<ExcelJob, 'id' | 'createdAt' | 'completedAt'>
): ExcelJob => {
  const now = new Date().toISOString()

  return {
    id: `excel_job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    completedAt: now,
    ...input
  }
}

export const ExcelHistoryService = {
  list: () => readHistory(),

  add: (job: ExcelJob) => {
    const history = [job, ...readHistory()].slice(0, 100)
    saveHistory(history)
    return job
  },

  filter: (filters: ExcelHistoryFilters) => readHistory().filter(job => (
    (filters.moduleKey === 'all' || job.moduleKeys.includes(filters.moduleKey))
    && (!filters.userName || job.userName.toLocaleLowerCase('tr-TR').includes(filters.userName.toLocaleLowerCase('tr-TR')))
    && (!filters.date || getDateKey(job.createdAt) === filters.date)
    && (filters.operationType === 'all' || job.operationType === filters.operationType)
    && (filters.status === 'all' || job.status === filters.status)
  )),

  statistics: (): ExcelDashboardStatistics => {
    const history = readHistory()
    const today = new Date().toLocaleDateString('sv-SE')
    const todayJobs = history.filter(job => getDateKey(job.createdAt) === today)
    const exportBuckets = history
      .filter(job => job.operationType === 'EXPORT')
      .reduce<Map<string, number>>((map, job) => {
        job.moduleKeys.forEach(moduleKey => map.set(moduleKey, (map.get(moduleKey) || 0) + 1))
        return map
      }, new Map())
    const mostExported = Array.from(exportBuckets.entries()).sort((first, second) => second[1] - first[1])[0]

    return {
      todayImports: todayJobs.filter(job => job.operationType === 'IMPORT').length,
      todayExports: todayJobs.filter(job => job.operationType === 'EXPORT').length,
      totalJobs: history.length,
      failedJobs: history.filter(job => job.status === 'FAILED').length,
      mostExportedModule: mostExported ? EXCEL_MODULE_LABELS[mostExported[0] as keyof typeof EXCEL_MODULE_LABELS] : '-'
    }
  }
}
