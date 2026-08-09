import { ExcelDataSourceService } from './excel-data-source.service'
import type {
  ExcelAdHocExportInput,
  ExcelCellValue,
  ExcelColumnDefinition,
  ExcelDataSet,
  ExcelExportOptions,
  ExcelExportResult,
  ExcelHistoryFilters,
  ExcelImportResult,
  ExcelModuleKey,
  ExcelModuleViewExportInput,
  ExcelRow,
  ExcelRowsExportInput,
  ExcelWorkbookExportInput,
  ExcelWorkbookSheetInput
} from './excel-engine.types'
import { ExcelExportService } from './excel-export.service'
import { ExcelHistoryService } from './excel-history.service'
import { ExcelImportService } from './excel-import.service'
import {
  EXCEL_EXPORT_MODULES,
  EXCEL_IMPORT_MODULES,
  EXCEL_MODULE_LABELS,
  ExcelTemplateService
} from './excel-template.service'
import type { User } from '../types'

const DEFAULT_USER_NAME = 'Sistem'

const toCellValue = (value: unknown): ExcelCellValue => {
  if(typeof value === 'boolean') return value
  if(typeof value === 'number') return Number.isFinite(value) ? value : ''
  if(value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  return String(value ?? '')
}

const toColumnDefinition = (
  column: { key: string; header: string; type?: ExcelColumnDefinition['type'] }
): ExcelColumnDefinition => ({
  key: column.key,
  header: column.header,
  required: false,
  type: column.type || 'string'
})

const getUserName = (user: User | string | undefined) => {
  if(!user) return DEFAULT_USER_NAME
  if(typeof user === 'string') return user || DEFAULT_USER_NAME
  return user.fullName || user.username || DEFAULT_USER_NAME
}

const createVisibleDataSet = <TRow, >(
  input: ExcelModuleViewExportInput<TRow>
): ExcelDataSet => {
  const visibleColumns = input.columns.filter(column => column.visible !== false)
  const rows = input.rows.map(row => (
    visibleColumns.reduce<ExcelRow>((excelRow, column) => {
      const sourceRow = row as Record<string, unknown>
      const value = column.value ? column.value(row) : sourceRow[column.key]
      excelRow[column.key] = toCellValue(value)
      return excelRow
    }, {})
  ))

  return {
    moduleKey: input.moduleKey,
    moduleLabel: input.sheetName || input.moduleLabel || EXCEL_MODULE_LABELS[input.moduleKey],
    columns: visibleColumns.map(toColumnDefinition),
    rows
  }
}

const createMatrixDataSet = (
  input: ExcelAdHocExportInput
): ExcelDataSet => {
  const columns = input.headers.map((header, index) => toColumnDefinition({
    key: `column_${index + 1}`,
    header
  }))

  return {
    moduleKey: input.moduleKey,
    moduleLabel: input.sheetName || input.moduleLabel || EXCEL_MODULE_LABELS[input.moduleKey],
    columns,
    rows: input.rows.map(row => row.reduce<ExcelRow>((excelRow, value, index) => {
      excelRow[`column_${index + 1}`] = toCellValue(value)
      return excelRow
    }, {}))
  }
}

const getSheetHeaders = (rows: Array<Record<string, unknown>>) => {
  const headers = rows.reduce<string[]>((keys, row) => {
    Object.keys(row).forEach(key => {
      if(!keys.includes(key)) keys.push(key)
    })
    return keys
  }, [])

  return headers.length > 0 ? headers : ['Bilgi']
}

const createSheetDataSet = (
  input: ExcelWorkbookSheetInput,
  fallbackModuleKey: ExcelModuleKey
): ExcelDataSet => {
  const fallbackMessage = input.emptyMessage || 'Kayit bulunamadi'
  const sourceRows = input.rows.length > 0 ? input.rows : [{ Bilgi: fallbackMessage }]
  const headers = getSheetHeaders(sourceRows)
  const columns = headers.map(header => toColumnDefinition({
    key: header,
    header
  }))

  return {
    moduleKey: fallbackModuleKey,
    moduleLabel: input.sheetName,
    columns,
    rows: sourceRows.map(row => headers.reduce<ExcelRow>((excelRow, header) => {
      excelRow[header] = toCellValue(row[header])
      return excelRow
    }, {}))
  }
}

export const ExcelIntegrationService = {
  defaultUserName: DEFAULT_USER_NAME,
  exportModules: (options: ExcelExportOptions) => ExcelExportService.exportModules(options),
  exportModuleView: <TRow, >(input: ExcelModuleViewExportInput<TRow>): ExcelExportResult => {
    const dataSet = createVisibleDataSet(input)
    return ExcelExportService.exportDataSets([dataSet], {
      moduleKeys: [input.moduleKey],
      moduleLabel: dataSet.moduleLabel,
      fileNamePrefix: input.fileNamePrefix || `excel-export-${input.moduleKey}`,
      fileName: input.fileName,
      userName: input.userName || DEFAULT_USER_NAME,
      message: `${dataSet.rows.length} satir, gorunen kolonlar ile export edildi.`
    })
  },
  exportMatrix: (input: ExcelAdHocExportInput): ExcelExportResult => {
    const dataSet = createMatrixDataSet(input)
    return ExcelExportService.exportDataSets([dataSet], {
      moduleKeys: [input.moduleKey],
      moduleLabel: dataSet.moduleLabel,
      fileNamePrefix: input.fileNamePrefix,
      fileName: input.fileName,
      userName: input.userName || DEFAULT_USER_NAME,
      message: `${dataSet.rows.length} satir ozel Excel ciktisi uretildi.`
    })
  },
  exportWorkbook: (input: ExcelWorkbookExportInput): ExcelExportResult => {
    const dataSets = input.sheets.map(sheet => createSheetDataSet(sheet, input.moduleKeys[0]))
    return ExcelExportService.exportDataSets(dataSets, {
      moduleKeys: input.moduleKeys,
      moduleLabel: input.moduleLabel,
      fileNamePrefix: input.fileNamePrefix,
      fileName: input.fileName,
      userName: input.userName || DEFAULT_USER_NAME,
      message: input.message || `${dataSets.length} sheet ortak Excel servisi ile export edildi.`
    })
  },
  exportRows: (input: ExcelRowsExportInput): ExcelExportResult => (
    ExcelIntegrationService.exportWorkbook({
      moduleKeys: [input.moduleKey],
      moduleLabel: input.moduleLabel || EXCEL_MODULE_LABELS[input.moduleKey],
      fileNamePrefix: input.fileNamePrefix,
      fileName: input.fileName,
      userName: input.userName || DEFAULT_USER_NAME,
      message: input.message,
      sheets: [{
        sheetName: input.sheetName,
        rows: input.rows
      }]
    })
  ),
  downloadTemplate: (moduleKey: ExcelModuleKey, user: User | string | undefined) => (
    ExcelExportService.exportTemplate(moduleKey, getUserName(user))
  ),
  previewImport: (file: File, moduleKey: ExcelModuleKey, user: User | string | undefined): Promise<ExcelImportResult> => (
    ExcelImportService.parseFile(file, moduleKey, getUserName(user))
  ),
  commitImport: (result: ExcelImportResult, user: User) => ExcelImportService.commitImport(result, user),
  getDataSet: ExcelDataSourceService.getDataSet,
  summarizeRows: ExcelDataSourceService.summarizeRows,
  listExportModules: () => EXCEL_EXPORT_MODULES,
  listImportModules: () => EXCEL_IMPORT_MODULES,
  listTemplates: ExcelTemplateService.listTemplates,
  listImportTemplates: ExcelTemplateService.listImportTemplates,
  getTemplate: ExcelTemplateService.getTemplate,
  getModuleLabel: (moduleKey: ExcelModuleKey) => EXCEL_MODULE_LABELS[moduleKey],
  isImportEnabled: (moduleKey: ExcelModuleKey) => EXCEL_IMPORT_MODULES.includes(moduleKey),
  history: {
    list: ExcelHistoryService.list,
    filter: (filters: ExcelHistoryFilters) => ExcelHistoryService.filter(filters),
    statistics: ExcelHistoryService.statistics
  }
}
