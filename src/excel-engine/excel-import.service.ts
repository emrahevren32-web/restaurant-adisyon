import * as XLSX from 'xlsx'
import {
  applyStockMovement,
  loadCategories,
  loadBranches,
  loadProducts,
  loadStockCategories,
  loadStockItems,
  reverseStockMovement,
  saveProducts,
  saveStockItems
} from '../storage'
import { getPurchaseRequestReadModelContext } from '../purchase-requests/purchase-request.service'
import {
  createPurchaseRequestRecordFromInput,
  loadPurchaseRequestServiceData,
  persistPurchaseRequestRecords,
  upsertPurchaseRequestRecord
} from '../purchase-requests/purchase-request.service'
import type {
  PurchaseRequestDepartment,
  PurchaseRequestPriority,
  PurchaseRequestSource
} from '../purchase-requests/purchase-request.types'
import {
  RECIPE_INGREDIENT_UNITS,
  RECIPE_MANAGEMENT_TYPES,
  saveRecipeManagementRecords,
  loadRecipeManagementRecords
} from '../recipe-management/recipe-management.mock'
import type {
  RecipeIngredient,
  RecipeIngredientUnit,
  RecipeManagementRecord,
  RecipeManagementRole,
  RecipeManagementStatus,
  RecipeManagementType
} from '../recipe-management/recipe-management.types'
import { convertToBaseUnit } from '../recipe-management/recipe-unit-converter'
import { SupplierService } from '../supplier-management/supplier.service'
import {
  SUPPLIER_APPROVAL_STATUSES,
  SUPPLIER_CATEGORIES,
  SUPPLIER_COMPANY_TYPES,
  SUPPLIER_CURRENCIES,
  SUPPLIER_STATUSES,
  SUPPLIER_TYPES,
  SUPPLIER_WORKING_STATUSES
} from '../supplier-management/supplier-management.mock'
import type {
  Supplier,
  SupplierApprovalStatus,
  SupplierCompanyType,
  SupplierStatus,
  SupplierType,
  SupplierWorkingStatus
} from '../supplier-management/supplier-management.types'
import type { Product, StockItem, StockUnit, User } from '../types'
import type {
  ExcelCellValue,
  ExcelImportResult,
  ExcelModuleKey,
  ExcelRow,
  ExcelValidationError
} from './excel-engine.types'
import { createExcelJob, ExcelHistoryService } from './excel-history.service'
import { EXCEL_IMPORT_MODULES, EXCEL_MODULE_LABELS } from './excel-template.service'
import { validateExcelRows } from './excel-validation.service'

const STOCK_UNITS: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
const PURCHASE_REQUEST_PRIORITIES: PurchaseRequestPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT']
const PURCHASE_REQUEST_DEPARTMENTS: PurchaseRequestDepartment[] = ['PRODUCTION', 'WAREHOUSE', 'QUALITY', 'PACKAGING', 'SHIPPING', 'ADMINISTRATION', 'PURCHASING']
const DEFAULT_SOURCE: PurchaseRequestSource = 'MANUAL'

const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeKey = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getString = (row: ExcelRow, key: string, fallback = '') => {
  const value = row[key]
  return normalizeText(value) || fallback
}

const getNumber = (row: ExcelRow, key: string, fallback = 0) => {
  const value = Number(row[key])
  return Number.isFinite(value) ? value : fallback
}

const getBoolean = (row: ExcelRow, key: string, fallback = true) => {
  const value = row[key]
  if(typeof value === 'boolean') return value
  const normalized = normalizeKey(value)
  if(['true', '1', 'evet', 'yes', 'aktif'].includes(normalized)) return true
  if(['false', '0', 'hayir', 'hayır', 'no', 'pasif'].includes(normalized)) return false
  return fallback
}

const getDateValue = (row: ExcelRow, key: string, fallback = new Date().toLocaleDateString('sv-SE')) => {
  const value = getString(row, key)
  if(!value) return fallback
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('sv-SE')
}

const getUserName = (user: User) => user.fullName || user.username

const cloneRecords = <TRecord, >(records: TRecord[]): TRecord[] => (
  JSON.parse(JSON.stringify(records)) as TRecord[]
)

const createRollback = (
  moduleKey: ExcelModuleKey
) => {
  if(moduleKey === 'products'){
    const products = cloneRecords(loadProducts())
    return () => saveProducts(products)
  }

  if(moduleKey === 'raw-materials' || moduleKey === 'stock'){
    const stockItems = cloneRecords(loadStockItems())
    return () => saveStockItems(stockItems)
  }

  if(moduleKey === 'suppliers'){
    const suppliers = cloneRecords(SupplierService.listSuppliers())
    return () => SupplierService.saveSuppliers(suppliers)
  }

  if(moduleKey === 'recipes'){
    const recipes = cloneRecords(loadRecipeManagementRecords())
    return () => saveRecipeManagementRecords(recipes)
  }

  if(moduleKey === 'purchase-requests'){
    const { records } = loadPurchaseRequestServiceData()
    const purchaseRequests = cloneRecords(records)
    return () => persistPurchaseRequestRecords(purchaseRequests)
  }

  return () => undefined
}

const resolveBranchId = (branchName: string) => {
  const branches = loadBranches()
  const normalizedBranchName = normalizeKey(branchName)
  return branches.find(branch => normalizeKey(branch.name) === normalizedBranchName || normalizeKey(branch.id) === normalizedBranchName)?.id
    || branches[0]?.id
    || ''
}

const resolveProductCategoryId = (categoryName: string) => {
  const categories = loadCategories()
  const normalizedCategoryName = normalizeKey(categoryName)
  return categories.find(category => normalizeKey(category.name) === normalizedCategoryName || normalizeKey(category.id) === normalizedCategoryName)?.id
    || categories[0]?.id
    || ''
}

const resolveStockCategoryId = (categoryName: string) => {
  const categories = loadStockCategories()
  const normalizedCategoryName = normalizeKey(categoryName)
  return categories.find(category => normalizeKey(category.name) === normalizedCategoryName || normalizeKey(category.id) === normalizedCategoryName)?.id
    || categories[0]?.id
    || ''
}

const normalizeStockUnit = (value: string): StockUnit => (
  STOCK_UNITS.includes(value as StockUnit) ? value as StockUnit : 'adet'
)

const normalizeSupplierType = (value: string): SupplierType => {
  const normalized = value.toUpperCase()
  return SUPPLIER_TYPES.includes(normalized as SupplierType) ? normalized as SupplierType : 'RAW_MATERIAL'
}

const normalizeSupplierStatus = (value: string): SupplierStatus => {
  const normalized = value.toUpperCase()
  return SUPPLIER_STATUSES.includes(normalized as SupplierStatus) ? normalized as SupplierStatus : 'ACTIVE'
}

const normalizeSupplierApprovalStatus = (value: string): SupplierApprovalStatus => {
  const normalized = value.toUpperCase()
  return SUPPLIER_APPROVAL_STATUSES.includes(normalized as SupplierApprovalStatus) ? normalized as SupplierApprovalStatus : 'APPROVED'
}

const normalizeSupplierWorkingStatus = (value: string): SupplierWorkingStatus => {
  const normalized = value.toUpperCase()
  return SUPPLIER_WORKING_STATUSES.includes(normalized as SupplierWorkingStatus) ? normalized as SupplierWorkingStatus : 'ACTIVE_WORKING'
}

const normalizeCompanyType = (value: string): SupplierCompanyType => {
  const normalized = value.toUpperCase()
  return SUPPLIER_COMPANY_TYPES.includes(normalized as SupplierCompanyType) ? normalized as SupplierCompanyType : 'LOCAL_SUPPLIER'
}

const normalizeRecipeType = (value: string): RecipeManagementType => {
  const normalized = normalizeKey(value)
  if(normalized.includes('ara')) return RECIPE_MANAGEMENT_TYPES[1]
  return RECIPE_MANAGEMENT_TYPES[0]
}

const normalizeRecipeUnit = (value: string): RecipeIngredientUnit => (
  RECIPE_INGREDIENT_UNITS.includes(value as RecipeIngredientUnit) ? value as RecipeIngredientUnit : 'gr'
)

const importProducts = (rows: ExcelRow[]) => {
  const existingProducts = loadProducts()
  const now = new Date().toISOString()
  let createdCount = 0
  let updatedCount = 0
  const nextProducts = rows.reduce<Product[]>((products, row) => {
    const name = getString(row, 'name')
    const existing = products.find(product => normalizeKey(product.name) === normalizeKey(name))
    const product: Product = {
      id: existing?.id || createId('product_excel'),
      branchId: existing?.branchId || resolveBranchId(getString(row, 'branchName')),
      name,
      price: getNumber(row, 'price'),
      categoryId: resolveProductCategoryId(getString(row, 'categoryName')),
      description: getString(row, 'description'),
      calories: getNumber(row, 'calories'),
      protein: existing?.protein || 0,
      carbohydrate: existing?.carbohydrate || 0,
      fat: existing?.fat || 0,
      fiber: existing?.fiber || 0,
      sugar: existing?.sugar || 0,
      salt: existing?.salt || 0,
      servingSize: existing?.servingSize || '',
      allergens: existing?.allergens || [],
      active: getBoolean(row, 'active', existing?.active ?? true),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    }

    if(existing){
      updatedCount += 1
      return products.map(item => item.id === existing.id ? product : item)
    }

    createdCount += 1
    return [product, ...products]
  }, existingProducts)

  saveProducts(nextProducts)
  return { createdCount, updatedCount }
}

type ImportSonucu = {
  createdCount: number
  updatedCount: number
  /** Kart yazıldı ama açılış miktarı deftere geçirilemedi — kullanıcıya gösterilir. */
  errors?: ExcelValidationError[]
}

/**
 * Excel'deki "Mevcut Miktar" sütunu ARTIK `currentQty` alanına yazılmıyor.
 *
 * ADR-001'in temel kuralı: miktar defterden türetilir, dışarıdan atanmaz. Eski
 * kod bu kuralı deliyordu — kart doğrudan yazıldığı için ortada hareketi olmayan
 * bir bakiye oluşuyor ve "bu rakam nereden geldi?" sorusunun cevabı kalmıyordu.
 *
 * Doğrusu: Excel'den gelen miktar bir AÇILIŞ SAYIMIDIR. Bu yüzden içe aktarma
 * iki aşamalı:
 *   1) Kart bilgisi yazılır (ad, birim, kategori, fiyat…) — miktara dokunulmaz.
 *   2) Miktar, `applyStockMovement()` kapısından bir "Sayım Düzeltme" hareketi
 *      olarak geçirilir. Bakiyeyi kapı hesaplar, biz değil.
 *
 * Kazanç: içe aktarılan her rakamın artık bir hareket kaydı, bir kullanıcısı ve
 * bir zamanı var. Kart üzerindeki sayının altına tıklayınca "Excel içe aktarma ·
 * açılış sayımı" satırı görünür.
 */
const importStockItems = (
  rows: ExcelRow[],
  user: User,
  // Hata mesajlarında doğru satır numarasını verebilmek için: `rows` yalnızca
  // GEÇERLİ satırları içerir, numaralandırma ise dosyanın tamamına göre yapılır.
  tumSatirlar: ExcelRow[] = rows
): ImportSonucu => {
  const now = new Date().toISOString()
  let createdCount = 0
  let updatedCount = 0

  // ── 1. AŞAMA · Kart bilgisi ─────────────────────────────────────────────
  const satirinKalemi = new Map<ExcelRow, string>()

  const nextItems = rows.reduce<StockItem[]>((items, row) => {
    const name = getString(row, 'name')
    const sku = getString(row, 'sku')
    const existing = items.find(item => (
      normalizeKey(item.name) === normalizeKey(name)
      || Boolean(sku && normalizeKey(item.sku) === normalizeKey(sku))
    ))
    const item: StockItem = {
      id: existing?.id || createId('stock_excel'),
      branchId: existing?.branchId || resolveBranchId(''),
      name,
      categoryId: resolveStockCategoryId(getString(row, 'categoryName')),
      unit: normalizeStockUnit(getString(row, 'unit', existing?.unit || 'adet')),
      // ⛔ Excel'den GELMİYOR. Yeni kart 0'dan başlar, mevcut kartın bakiyesi
      //    olduğu gibi korunur. Değişim yalnızca 2. aşamadaki hareketle olur.
      currentQty: existing?.currentQty ?? 0,
      minQty: getNumber(row, 'minQty', existing?.minQty || 0),
      tracksExpiry: getBoolean(row, 'tracksExpiry', existing?.tracksExpiry ?? true),
      expiryWarningDays: existing?.expiryWarningDays ?? 7,
      sku: sku || existing?.sku,
      barcode: getString(row, 'barcode', existing?.barcode || ''),
      description: getString(row, 'description', existing?.description || ''),
      active: getBoolean(row, 'active', existing?.active ?? true),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      unitPurchasePrice: getNumber(row, 'unitPurchasePrice', existing?.unitPurchasePrice || 0),
      currency: getString(row, 'currency', existing?.currency || 'TRY'),
      lastPurchasePrice: getNumber(row, 'lastPurchasePrice', existing?.lastPurchasePrice || 0),
      averageCost: getNumber(row, 'averageCost', existing?.averageCost || 0),
      lastCostUpdatedAt: now,
      lastSupplierName: getString(row, 'supplierName', existing?.lastSupplierName || '')
    }

    satirinKalemi.set(row, item.id)

    if(existing){
      updatedCount += 1
      return items.map(record => record.id === existing.id ? item : record)
    }

    createdCount += 1
    return [item, ...items]
  }, loadStockItems())

  saveStockItems(nextItems)

  // ── 2. AŞAMA · Açılış sayımı, kapıdan ───────────────────────────────────
  const errors: ExcelValidationError[] = []
  const yazilanHareketler: string[] = []

  // Aynı kalem dosyada iki kez geçebilir. Her seferinde diskten okumak yerine
  // bakiyeyi burada takip ediyoruz; ikinci satır birincinin sonucunu görsün.
  const guncelMiktar = new Map<string, number>(nextItems.map(item => [item.id, item.currentQty]))

  const satirNo = (row: ExcelRow) => {
    const sira = tumSatirlar.indexOf(row)
    return sira >= 0 ? sira + 2 : 0
  }

  try{
    for(const row of rows){
      // Sütun hiç doldurulmamışsa miktara KARIŞMIYORUZ.
      //
      // Burada `getNumber` kullanılamaz: o, boş hücreyi 0'a çevirir ve boş
      // bırakılan her satır "sayım sonucu 0" sayılıp mevcut stoğu silerdi.
      // `normalizeText` de kullanılamaz: `String(0 || '')` boş metin verir, yani
      // gerçek bir 0 ("stok bitti" sayımı) boş hücreyle karışırdı. Bu yüzden
      // ham değere doğrudan bakıyoruz.
      //
      // Tip, çalışma zamanında sözleşmesinden daha geniş olabilir (xlsx boş
      // hücre için undefined/null verebilir); bu yüzden açıkça genişletiliyor.
      const hamMiktar = row['currentQty'] as ExcelCellValue | null | undefined
      if(hamMiktar === undefined || hamMiktar === null) continue
      if(typeof hamMiktar === 'string' && hamMiktar.trim() === '') continue

      const kalemId = satirinKalemi.get(row)
      const kalem = kalemId ? nextItems.find(item => item.id === kalemId) : undefined
      if(!kalem) continue

      const sayilan = Number(hamMiktar)
      if(!Number.isFinite(sayilan) || sayilan < 0){
        errors.push({
          rowNumber: satirNo(row),
          columnKey: 'currentQty',
          columnHeader: 'Mevcut Miktar',
          message: `${kalem.name}: miktar sayı değil veya negatif. Kart yazıldı, miktar aktarılmadı.`
        })
        continue
      }

      const mevcut = guncelMiktar.get(kalem.id) ?? kalem.currentQty
      if(sayilan === mevcut) continue

      const skt = getString(row, 'expiryDate')
      if(kalem.tracksExpiry && sayilan > mevcut && !skt){
        // Sessizce geçmiyoruz. SKT takipli bir kalemin miktarını tarihsiz
        // artırmak, endüstriyel mutfakta izlenemeyen bir parti demektir.
        errors.push({
          rowNumber: satirNo(row),
          columnKey: 'expiryDate',
          columnHeader: 'SKT',
          message: `${kalem.name}: SKT takipli kalem. Miktarı aktarmak için "SKT" sütununu doldur ya da "SKT Takibi" sütununa hayır yaz. Kart yazıldı, miktar aktarılmadı.`
        })
        continue
      }

      const hareket = applyStockMovement({
        stockItemId: kalem.id,
        type: 'Sayım Düzeltme',
        source: 'Sayım',
        reason: sayilan > mevcut ? 'Sayım Fazlası' : 'Sayım Eksiği',
        // 'Sayım Düzeltme'de miktar FARK değil, sayılan MUTLAK değerdir.
        qty: sayilan,
        expiryDate: skt || undefined,
        purchasePrice: getNumber(row, 'unitPurchasePrice', 0) || undefined,
        supplierName: getString(row, 'supplierName') || undefined,
        description: 'Excel içe aktarma · açılış sayımı',
        user
      })

      yazilanHareketler.push(hareket.id)
      guncelMiktar.set(kalem.id, sayilan)
    }
  } catch (error) {
    // Defter silinmez (ADR-001). Yazılmış hareketler TERS KAYITLA kapatılır;
    // kartları ise dışarıdaki `rollback()` eski hâline döndürür. İkisi birlikte
    // tutarlı bir zemin bırakır: kart eski hâlinde, defterde ise net etkisi
    // sıfır olan bir hareket–ters hareket çifti.
    for(const id of [...yazilanHareketler].reverse()){
      try{
        reverseStockMovement(id, user)
      } catch {
        // Ters kayıt da başarısız olduysa yapılabilecek bir şey yok; asıl
        // hatayı yutmamak daha önemli.
      }
    }
    throw error
  }

  return {
    createdCount,
    updatedCount,
    errors: errors.length > 0 ? errors : undefined
  }
}

const importSuppliers = (rows: ExcelRow[]) => {
  const existingSuppliers = SupplierService.listSuppliers()
  const now = new Date().toISOString()
  let createdCount = 0
  let updatedCount = 0
  const nextSuppliers = rows.reduce<Supplier[]>((suppliers, row) => {
    const supplierCode = getString(row, 'supplierCode')
    const name = getString(row, 'name')
    const existing = suppliers.find(supplier => (
      Boolean(supplierCode && normalizeKey(supplier.supplierCode) === normalizeKey(supplierCode))
      || normalizeKey(supplier.name) === normalizeKey(name)
    ))
    const type = normalizeSupplierType(getString(row, 'type'))
    const supplier: Supplier = {
      id: existing?.id || SupplierService.createId(),
      supplierCode: supplierCode || existing?.supplierCode || SupplierService.getNextSupplierCode(suppliers),
      code: supplierCode || existing?.code,
      name,
      tradeName: getString(row, 'tradeName', existing?.tradeName || name),
      taxOffice: existing?.taxOffice || '',
      taxNumber: existing?.taxNumber || '',
      companyType: normalizeCompanyType(getString(row, 'companyType', existing?.companyType || 'LOCAL_SUPPLIER')),
      type,
      categoryIds: existing?.categoryIds || SUPPLIER_CATEGORIES.filter(category => category.type === type).map(category => category.id).slice(0, 1),
      status: normalizeSupplierStatus(getString(row, 'status', existing?.status || 'ACTIVE')),
      approvalStatus: normalizeSupplierApprovalStatus(getString(row, 'approvalStatus', existing?.approvalStatus || 'APPROVED')),
      workingStatus: normalizeSupplierWorkingStatus(getString(row, 'workingStatus', existing?.workingStatus || 'ACTIVE_WORKING')),
      defaultCurrency: SUPPLIER_CURRENCIES.includes(getString(row, 'defaultCurrency') as typeof SUPPLIER_CURRENCIES[number])
        ? getString(row, 'defaultCurrency')
        : existing?.defaultCurrency || 'TRY',
      paymentTermDays: getNumber(row, 'paymentTermDays', existing?.paymentTermDays || 30),
      leadTimeDays: getNumber(row, 'leadTimeDays', existing?.leadTimeDays || 3),
      minimumOrderAmount: existing?.minimumOrderAmount || 0,
      currentAccountCode: existing?.currentAccountCode || '',
      contactName: getString(row, 'contactName', existing?.contactName || ''),
      contactPhone: getString(row, 'contactPhone', existing?.contactPhone || ''),
      mobilePhone: existing?.mobilePhone || '',
      contactEmail: getString(row, 'contactEmail', existing?.contactEmail || ''),
      website: existing?.website || '',
      address: existing?.address || '',
      city: getString(row, 'city', existing?.city || ''),
      district: existing?.district || '',
      postalCode: existing?.postalCode || '',
      country: existing?.country || 'Turkiye',
      notes: getString(row, 'notes', existing?.notes || ''),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    }

    if(existing){
      updatedCount += 1
      return suppliers.map(item => item.id === existing.id ? supplier : item)
    }

    createdCount += 1
    return [supplier, ...suppliers]
  }, existingSuppliers)

  SupplierService.saveSuppliers(nextSuppliers)
  return { createdCount, updatedCount }
}

const importRecipes = (rows: ExcelRow[]) => {
  const existingRecipes = loadRecipeManagementRecords()
  const now = new Date().toISOString()
  const groupedRows = rows.reduce<Map<string, ExcelRow[]>>((map, row) => {
    const key = getString(row, 'recipeCode') || getString(row, 'recipeName')
    map.set(key, [...(map.get(key) || []), row])
    return map
  }, new Map())
  let createdCount = 0
  let updatedCount = 0
  let nextRecipes = [...existingRecipes]

  groupedRows.forEach((recipeRows, key) => {
    const firstRow = recipeRows[0]
    const existing = nextRecipes.find(recipe => normalizeKey(recipe.code) === normalizeKey(key) || normalizeKey(recipe.recipeName) === normalizeKey(getString(firstRow, 'recipeName')))
    const ingredients: RecipeIngredient[] = recipeRows.map((row, index) => {
      const quantity = getNumber(row, 'quantity')
      const unit = normalizeRecipeUnit(getString(row, 'unit'))

      return {
        id: `${existing?.id || key}_ing_${String(index + 1).padStart(2, '0')}`,
        materialName: getString(row, 'ingredientName'),
        quantity,
        unit,
        ...convertToBaseUnit(quantity, unit),
        unitCost: getNumber(row, 'unitCost')
      }
    })
    const recipe: RecipeManagementRecord = {
      id: existing?.id || createId('recipe_excel'),
      code: getString(firstRow, 'recipeCode', existing?.code || key),
      recipeName: getString(firstRow, 'recipeName', existing?.recipeName || key),
      recipeType: normalizeRecipeType(getString(firstRow, 'recipeType', existing?.recipeType)),
      recipeRole: (existing?.recipeRole || 'PRIMARY') as RecipeManagementRole,
      parentRecipeId: existing?.parentRecipeId,
      productName: getString(firstRow, 'productName', existing?.productName || getString(firstRow, 'recipeName')),
      portions: getNumber(firstRow, 'portions', existing?.portions || 1),
      firePercent: getNumber(firstRow, 'firePercent', existing?.firePercent || 0),
      status: (existing?.status || 'Aktif') as RecipeManagementStatus,
      description: existing?.description || '',
      ingredients,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    }

    if(existing){
      updatedCount += 1
      nextRecipes = nextRecipes.map(item => item.id === existing.id ? recipe : item)
      return
    }

    createdCount += 1
    nextRecipes = [recipe, ...nextRecipes]
  })

  saveRecipeManagementRecords(nextRecipes)
  return { createdCount, updatedCount }
}

const importPurchaseRequests = (rows: ExcelRow[], user: User) => {
  const { records } = loadPurchaseRequestServiceData()
  const context = getPurchaseRequestReadModelContext()
  const actorName = getUserName(user)
  const groupedRows = rows.reduce<Map<string, ExcelRow[]>>((map, row) => {
    const key = getString(row, 'requestNo') || getString(row, 'title')
    map.set(key, [...(map.get(key) || []), row])
    return map
  }, new Map())
  let nextRecords = [...records]
  let createdCount = 0
  let updatedCount = 0

  groupedRows.forEach((requestRows, key) => {
    const firstRow = requestRows[0]
    const existing = nextRecords.find(record => normalizeKey(record.requestNo) === normalizeKey(key))
    const branchId = resolveBranchId(getString(firstRow, 'branchName'))
    const warehouseId = resolveBranchId(getString(firstRow, 'warehouseName')) || branchId
    const departmentText = getString(firstRow, 'department').toUpperCase()
    const priorityText = getString(firstRow, 'priority', 'NORMAL').toUpperCase()
    const recordResult = createPurchaseRequestRecordFromInput({
      id: existing?.id,
      requestNo: getString(firstRow, 'requestNo', existing?.requestNo),
      title: getString(firstRow, 'title', existing?.title || key),
      description: getString(firstRow, 'description', existing?.description || ''),
      requestDate: getDateValue(firstRow, 'requestDate'),
      requiredDate: getDateValue(firstRow, 'requiredDate'),
      requester: getString(firstRow, 'requester', actorName),
      department: PURCHASE_REQUEST_DEPARTMENTS.includes(departmentText as PurchaseRequestDepartment)
        ? departmentText as PurchaseRequestDepartment
        : 'PRODUCTION',
      warehouseId,
      branchId,
      source: DEFAULT_SOURCE,
      priority: PURCHASE_REQUEST_PRIORITIES.includes(priorityText as PurchaseRequestPriority)
        ? priorityText as PurchaseRequestPriority
        : 'NORMAL',
      status: existing?.status || 'DRAFT',
      notes: getString(firstRow, 'notes', existing?.notes || ''),
      items: requestRows.map(row => {
        const stockName = getString(row, 'stockItemName')
        const stockItem = context.stockItems.find(item => normalizeKey(item.name) === normalizeKey(stockName) || normalizeKey(item.id) === normalizeKey(stockName))

        return {
          stockItemId: stockItem?.id || context.stockItems[0]?.id || '',
          requestedQuantity: getNumber(row, 'quantity'),
          estimatedUnitPrice: getNumber(row, 'estimatedUnitPrice'),
          notes: getString(row, 'notes')
        }
      })
    }, nextRecords, context, actorName, existing)

    nextRecords = upsertPurchaseRequestRecord(nextRecords, recordResult.record)
    if(existing) updatedCount += 1
    else createdCount += 1
  })

  persistPurchaseRequestRecords(nextRecords)
  return { createdCount, updatedCount }
}

const commitRows = (
  moduleKey: ExcelModuleKey,
  rows: ExcelRow[],
  user: User,
  // Yalnızca stok içe aktarma kullanıyor: satır numarasını dosyanın tamamına
  // göre verebilmek için (`rows` burada sadece geçerli satırlardır).
  tumSatirlar: ExcelRow[]
): ImportSonucu => {
  if(moduleKey === 'products') return importProducts(rows)
  if(moduleKey === 'raw-materials' || moduleKey === 'stock') return importStockItems(rows, user, tumSatirlar)
  if(moduleKey === 'suppliers') return importSuppliers(rows)
  if(moduleKey === 'recipes') return importRecipes(rows)
  if(moduleKey === 'purchase-requests') return importPurchaseRequests(rows, user)
  return { createdCount: 0, updatedCount: 0 }
}

const createImportResult = (
  moduleKey: ExcelModuleKey,
  fileName: string,
  userName: string,
  rows: ExcelRow[],
  validRows: ExcelRow[],
  invalidRows: ExcelRow[],
  errors: ExcelImportResult['errors'],
  committed = false,
  createdCount = 0,
  updatedCount = 0
): ExcelImportResult => {
  const blockingErrorCount = errors.filter(error => error.columnKey !== '__row__').length
  const status = committed || blockingErrorCount === 0 ? 'SUCCESS' : 'FAILED'
  const job = createExcelJob({
    operationType: 'IMPORT',
    status,
    moduleKeys: [moduleKey],
    moduleLabel: EXCEL_MODULE_LABELS[moduleKey],
    fileName,
    userName,
    recordCount: rows.length,
    successCount: validRows.length,
    failedCount: invalidRows.length,
    message: status === 'SUCCESS'
      ? committed
        ? `${createdCount} yeni, ${updatedCount} guncel kayit ice aktarildi; ${invalidRows.length} hatali satir atlandi.`
        : 'Dosya dogrulandi ve onizleme hazirlandi.'
      : `${blockingErrorCount} validation hatasi bulundu.`
  })

  return {
    job,
    moduleKey,
    fileName,
    rows,
    validRows,
    invalidRows,
    errors,
    createdCount,
    updatedCount,
    skippedCount: invalidRows.length,
    committed
  }
}

export const ExcelImportService = {
  parseFile: async (
    file: File,
    moduleKey: ExcelModuleKey,
    userName: string
  ): Promise<ExcelImportResult> => {
    if(!EXCEL_IMPORT_MODULES.includes(moduleKey)){
      const result = createImportResult(
        moduleKey,
        file.name,
        userName,
        [],
        [],
        [],
        [{
          rowNumber: 0,
          columnKey: '__module__',
          columnHeader: 'Modul',
          message: `${EXCEL_MODULE_LABELS[moduleKey]} import icin aktif degil.`
        }]
      )
      ExcelHistoryService.add(result.job)
      return result
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
    const validation = validateExcelRows(moduleKey, rawRows)
    const result = createImportResult(
      moduleKey,
      file.name,
      userName,
      validation.rows,
      validation.validRows,
      validation.invalidRows,
      validation.errors
    )

    if(result.job.status === 'FAILED'){
      ExcelHistoryService.add(result.job)
    }

    return result
  },

  commitImport: (
    result: ExcelImportResult,
    user: User
  ): ExcelImportResult => {
    if(result.validRows.length === 0){
      const failedResult = createImportResult(
        result.moduleKey,
        result.fileName,
        getUserName(user),
        result.rows,
        result.validRows,
        result.invalidRows,
        result.errors,
        false
      )
      ExcelHistoryService.add(failedResult.job)
      return failedResult
    }

    const rollback = createRollback(result.moduleKey)

    try{
      const importResult = commitRows(result.moduleKey, result.validRows, user, result.rows)
      const committedResult = createImportResult(
        result.moduleKey,
        result.fileName,
        getUserName(user),
        result.rows,
        result.validRows,
        result.invalidRows,
        // Kart yazıldı ama miktarı aktarılamayan satırlar burada görünür.
        // İş BAŞARILI sayılır (kartlar geldi), uyarı ise kaybolmaz.
        [...result.errors, ...(importResult.errors ?? [])],
        true,
        importResult.createdCount,
        importResult.updatedCount
      )

      ExcelHistoryService.add(committedResult.job)
      return committedResult
    } catch (error) {
      rollback()
      const failedResult = createImportResult(
        result.moduleKey,
        result.fileName,
        getUserName(user),
        result.rows,
        [],
        result.rows,
        [
          ...result.errors,
          {
            rowNumber: 0,
            columnKey: '__commit__',
            columnHeader: 'Commit',
            message: error instanceof Error
              ? `${error.message} Rollback uygulandi.`
              : 'Import commit basarisiz oldu. Rollback uygulandi.'
          }
        ],
        false
      )
      ExcelHistoryService.add(failedResult.job)
      return failedResult
    }
  }
}
