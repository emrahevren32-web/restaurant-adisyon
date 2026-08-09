import type {
  ExcelColumnDefinition,
  ExcelModuleKey,
  ExcelRow,
  ExcelValidationError
} from './excel-engine.types'
import { getExcelTemplate } from './excel-template.service'
import { loadRecipeManagementRecords } from '../recipe-management/recipe-management.mock'
import { loadStockItems } from '../storage'
import { SupplierService } from '../supplier-management/supplier.service'

const BLANK_ROW = '__row__'

const DUPLICATE_KEYS: Partial<Record<ExcelModuleKey, string[]>> = {
  products: ['name'],
  recipes: ['recipeCode', 'ingredientName'],
  'raw-materials': ['name'],
  suppliers: ['supplierCode', 'name'],
  stock: ['name'],
  'purchase-requests': ['requestNo', 'title', 'stockItemName']
}

const CODE_UNIQUE_KEYS: Partial<Record<ExcelModuleKey, { codeKey: string; labelKey: string }>> = {
  recipes: { codeKey: 'recipeCode', labelKey: 'recipeName' },
  'raw-materials': { codeKey: 'sku', labelKey: 'name' },
  suppliers: { codeKey: 'supplierCode', labelKey: 'name' }
}

const normalizeHeader = (value: unknown) => (
  String(value || '').trim().toLocaleLowerCase('tr-TR')
)

const normalizeBoolean = (value: unknown) => {
  const text = normalizeHeader(value)
  if(['true', '1', 'evet', 'yes', 'aktif'].includes(text)) return true
  if(['false', '0', 'hayir', 'hayır', 'no', 'pasif'].includes(text)) return false
  return null
}

const isEmptyValue = (value: unknown) => (
  value === undefined || value === null || String(value).trim() === ''
)

const isBlankRow = (row: Record<string, unknown>) => (
  Object.values(row).every(isEmptyValue)
)

const getColumnValue = (
  rawRow: Record<string, unknown>,
  column: ExcelColumnDefinition
) => rawRow[column.header] ?? rawRow[column.key] ?? ''

export const normalizeExcelRows = (
  moduleKey: ExcelModuleKey,
  rawRows: Array<Record<string, unknown>>
): ExcelRow[] => {
  const template = getExcelTemplate(moduleKey)

  return rawRows
    .filter(row => !isBlankRow(row))
    .map(rawRow => template.columns.reduce<ExcelRow>((nextRow, column) => {
      const value = getColumnValue(rawRow, column)

      if(column.type === 'number'){
        const parsed = Number(String(value).replace(',', '.'))
        nextRow[column.key] = Number.isFinite(parsed) ? parsed : String(value || '')
        return nextRow
      }

      if(column.type === 'boolean'){
        const parsed = normalizeBoolean(value)
        nextRow[column.key] = parsed ?? String(value || '')
        return nextRow
      }

      nextRow[column.key] = String(value || '').trim()
      return nextRow
    }, {}))
}

const validateColumnPresence = (
  columns: ExcelColumnDefinition[],
  rawRows: Array<Record<string, unknown>>
): ExcelValidationError[] => {
  const headers = new Set(rawRows.flatMap(row => Object.keys(row).map(normalizeHeader)))

  return columns
    .filter(column => column.required && !headers.has(normalizeHeader(column.header)) && !headers.has(normalizeHeader(column.key)))
    .map(column => ({
      rowNumber: 0,
      columnKey: column.key,
      columnHeader: column.header,
      message: `Eksik zorunlu kolon: ${column.header}`
    }))
}

const validateRequired = (
  row: ExcelRow,
  column: ExcelColumnDefinition,
  rowNumber: number
): ExcelValidationError | null => {
  if(!column.required || !isEmptyValue(row[column.key])) return null

  return {
    rowNumber,
    columnKey: column.key,
    columnHeader: column.header,
    message: `${column.header} zorunludur.`
  }
}

const validateType = (
  row: ExcelRow,
  column: ExcelColumnDefinition,
  rowNumber: number
): ExcelValidationError | null => {
  const value = row[column.key]
  if(isEmptyValue(value)) return null

  if(column.type === 'number' && typeof value !== 'number'){
    return {
      rowNumber,
      columnKey: column.key,
      columnHeader: column.header,
      message: `${column.header} sayisal olmalidir.`
    }
  }

  if(column.type === 'boolean' && typeof value !== 'boolean'){
    return {
      rowNumber,
      columnKey: column.key,
      columnHeader: column.header,
      message: `${column.header} boolean olmalidir.`
    }
  }

  if(column.type === 'date'){
    const date = new Date(String(value))
    if(Number.isNaN(date.getTime())){
      return {
        rowNumber,
        columnKey: column.key,
        columnHeader: column.header,
        message: `${column.header} gecerli tarih olmalidir.`
      }
    }
  }

  return null
}

const validateNegative = (
  row: ExcelRow,
  column: ExcelColumnDefinition,
  rowNumber: number
): ExcelValidationError | null => {
  const value = row[column.key]
  if(column.type !== 'number' || column.allowNegative || typeof value !== 'number' || value >= 0) return null

  return {
    rowNumber,
    columnKey: column.key,
    columnHeader: column.header,
    message: `${column.header} negatif olamaz.`
  }
}

const validateDuplicates = (
  moduleKey: ExcelModuleKey,
  rows: ExcelRow[]
): ExcelValidationError[] => {
  const duplicateKeys = DUPLICATE_KEYS[moduleKey] || []
  if(duplicateKeys.length === 0) return []

  const seen = new Map<string, number>()
  const errors: ExcelValidationError[] = []

  rows.forEach((row, index) => {
    const duplicateKey = duplicateKeys.map(key => normalizeHeader(row[key])).join('|')
    if(!duplicateKey.replace(/\|/g, '')) return

    const firstRow = seen.get(duplicateKey)
    if(firstRow){
      errors.push({
        rowNumber: index + 2,
        columnKey: duplicateKeys.join(','),
        columnHeader: duplicateKeys.join(', '),
        message: `Tekrarlayan kayit: ilk tekrar satiri ${firstRow}.`
      })
      return
    }

    seen.set(duplicateKey, index + 2)
  })

  return errors
}

const getExistingCodeOwners = (
  moduleKey: ExcelModuleKey
) => {
  if(moduleKey === 'recipes'){
    return loadRecipeManagementRecords().reduce<Map<string, string>>((map, recipe) => {
      if(recipe.code) map.set(normalizeHeader(recipe.code), recipe.recipeName)
      return map
    }, new Map())
  }

  if(moduleKey === 'raw-materials'){
    return loadStockItems().reduce<Map<string, string>>((map, item) => {
      if(item.sku) map.set(normalizeHeader(item.sku), item.name)
      return map
    }, new Map())
  }

  if(moduleKey === 'suppliers'){
    return SupplierService.listSuppliers().reduce<Map<string, string>>((map, supplier) => {
      if(supplier.supplierCode) map.set(normalizeHeader(supplier.supplierCode), supplier.name)
      return map
    }, new Map())
  }

  return new Map<string, string>()
}

const validateCodeUniqueness = (
  moduleKey: ExcelModuleKey,
  rows: ExcelRow[]
): ExcelValidationError[] => {
  const uniqueConfig = CODE_UNIQUE_KEYS[moduleKey]
  if(!uniqueConfig) return []

  const template = getExcelTemplate(moduleKey)
  const codeColumn = template.columns.find(column => column.key === uniqueConfig.codeKey)
  if(!codeColumn) return []

  const existingOwners = getExistingCodeOwners(moduleKey)
  const seen = new Map<string, { rowNumber: number; owner: string }>()
  const errors: ExcelValidationError[] = []

  rows.forEach((row, index) => {
    const code = normalizeHeader(row[uniqueConfig.codeKey])
    if(!code) return

    const incomingOwner = normalizeHeader(row[uniqueConfig.labelKey])
    const firstRow = seen.get(code)
    if(firstRow && (moduleKey !== 'recipes' || firstRow.owner !== incomingOwner)){
      errors.push({
        rowNumber: index + 2,
        columnKey: uniqueConfig.codeKey,
        columnHeader: codeColumn.header,
        message: `${codeColumn.header} dosya icinde benzersiz olmalidir; ilk tekrar satiri ${firstRow.rowNumber}.`
      })
      return
    }

    if(!firstRow) seen.set(code, { rowNumber: index + 2, owner: incomingOwner })

    const existingOwner = existingOwners.get(code)
    if(existingOwner && incomingOwner && normalizeHeader(existingOwner) !== incomingOwner){
      errors.push({
        rowNumber: index + 2,
        columnKey: uniqueConfig.codeKey,
        columnHeader: codeColumn.header,
        message: `${codeColumn.header} sistemde ${existingOwner} kaydinda kullaniliyor.`
      })
    }
  })

  return errors
}

export const validateExcelRows = (
  moduleKey: ExcelModuleKey,
  rawRows: Array<Record<string, unknown>>
) => {
  const template = getExcelTemplate(moduleKey)
  const blankRowErrors = rawRows
    .map((row, index) => ({ row, index }))
    .filter(item => isBlankRow(item.row))
    .map(item => ({
      rowNumber: item.index + 2,
      columnKey: BLANK_ROW,
      columnHeader: 'Satir',
      message: 'Bos satir atlandi.'
    }))
  const normalizedRows = normalizeExcelRows(moduleKey, rawRows)
  const errors = [
    ...validateColumnPresence(template.columns, rawRows),
    ...blankRowErrors,
    ...normalizedRows.flatMap((row, index) => template.columns
      .flatMap(column => [
        validateRequired(row, column, index + 2),
        validateType(row, column, index + 2),
        validateNegative(row, column, index + 2)
      ])
      .filter(Boolean) as ExcelValidationError[]
    ),
    ...validateDuplicates(moduleKey, normalizedRows),
    ...validateCodeUniqueness(moduleKey, normalizedRows)
  ]
  const errorRows = new Set(errors.filter(error => error.rowNumber > 0 && error.columnKey !== BLANK_ROW).map(error => error.rowNumber))

  return {
    rows: normalizedRows,
    validRows: normalizedRows.filter((_, index) => !errorRows.has(index + 2)),
    invalidRows: normalizedRows.filter((_, index) => errorRows.has(index + 2)),
    errors
  }
}

export const ExcelValidationService = {
  normalizeRows: normalizeExcelRows,
  validateRows: validateExcelRows
}
