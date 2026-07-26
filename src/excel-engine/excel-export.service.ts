import * as XLSX from 'xlsx'
import type {
  ExcelDataSet,
  ExcelExportOptions,
  ExcelExportResult,
  ExcelModuleKey,
  ExcelRow
} from './excel-engine.types'
import { ExcelDataSourceService } from './excel-data-source.service'
import { createExcelJob, ExcelHistoryService } from './excel-history.service'
import { EXCEL_MODULE_LABELS, getExcelTemplate } from './excel-template.service'

const toSheetRows = (dataSet: ExcelDataSet) => dataSet.rows.map(row => (
  dataSet.columns.reduce<Record<string, string | number | boolean>>((sheetRow, column) => {
    sheetRow[column.header] = row[column.key] ?? ''
    return sheetRow
  }, {})
))

const appendDataSet = (
  workbook: XLSX.WorkBook,
  dataSet: ExcelDataSet
) => {
  const sheetRows = toSheetRows(dataSet)
  const header = dataSet.columns.map(column => column.header)
  const worksheet = XLSX.utils.json_to_sheet(sheetRows.length > 0 ? sheetRows : [header.reduce<Record<string, string>>((row, key) => {
    row[key] = ''
    return row
  }, {})], { header })
  XLSX.utils.book_append_sheet(workbook, worksheet, dataSet.moduleLabel.slice(0, 31))
}

const createFileName = (
  prefix: string,
  moduleKeys: ExcelModuleKey[]
) => {
  const modulePart = moduleKeys.length === 1 ? moduleKeys[0] : 'multi-module'
  const datePart = new Date().toLocaleDateString('sv-SE')
  return `${prefix}-${modulePart}-${datePart}.xlsx`
}

export const ExcelExportService = {
  exportModules: (options: ExcelExportOptions): ExcelExportResult => {
    const workbook = XLSX.utils.book_new()
    const dataSets = ExcelDataSourceService.getDataSets(options)
    dataSets.forEach(dataSet => appendDataSet(workbook, dataSet))
    const recordCount = dataSets.reduce((total, dataSet) => total + dataSet.rows.length, 0)
    const fileName = createFileName('excel-export', options.moduleKeys)

    XLSX.writeFile(workbook, fileName)

    const job = ExcelHistoryService.add(createExcelJob({
      operationType: 'EXPORT',
      status: 'SUCCESS',
      moduleKeys: options.moduleKeys,
      moduleLabel: options.moduleKeys.map(moduleKey => EXCEL_MODULE_LABELS[moduleKey]).join(', '),
      fileName,
      userName: options.userName,
      recordCount,
      successCount: recordCount,
      failedCount: 0,
      message: `${dataSets.length} sheet export edildi.`
    }))

    return {
      job,
      moduleKeys: options.moduleKeys,
      fileName,
      sheetCount: dataSets.length,
      recordCount
    }
  },

  exportTemplate: (moduleKey: ExcelModuleKey, userName: string): ExcelExportResult => {
    const workbook = XLSX.utils.book_new()
    const template = getExcelTemplate(moduleKey)
    const emptyRow = template.columns.reduce<ExcelRow>((row, column) => {
      row[column.key] = column.example ?? ''
      return row
    }, {})
    appendDataSet(workbook, {
      moduleKey,
      moduleLabel: template.moduleLabel,
      columns: template.columns,
      rows: [emptyRow]
    })
    const fileName = createFileName('excel-template', [moduleKey])

    XLSX.writeFile(workbook, fileName)

    const job = ExcelHistoryService.add(createExcelJob({
      operationType: 'TEMPLATE',
      status: 'SUCCESS',
      moduleKeys: [moduleKey],
      moduleLabel: EXCEL_MODULE_LABELS[moduleKey],
      fileName,
      userName,
      recordCount: 1,
      successCount: 1,
      failedCount: 0,
      message: `${EXCEL_MODULE_LABELS[moduleKey]} sablonu uretildi.`
    }))

    return {
      job,
      moduleKeys: [moduleKey],
      fileName,
      sheetCount: 1,
      recordCount: 1
    }
  }
}
