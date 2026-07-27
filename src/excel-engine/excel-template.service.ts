import type {
  ExcelColumnDefinition,
  ExcelModuleKey,
  ExcelTemplate
} from './excel-engine.types'

export const EXCEL_MODULE_LABELS: Record<ExcelModuleKey, string> = {
  products: 'Urunler',
  recipes: 'Receteler',
  'raw-materials': 'Hammaddeler',
  suppliers: 'Supplier',
  'purchase-requests': 'Purchase Request',
  'purchase-orders': 'Purchase Order',
  'goods-receipts': 'Mal Kabul',
  stock: 'Stok',
  lots: 'Lot',
  waste: 'Fire',
  'production-orders': 'Uretim Emirleri',
  quality: 'Kalite',
  shipments: 'Sevkiyat',
  'delivery-notes': 'Irsaliyeler',
  labels: 'Etiket Yonetimi',
  kpi: 'KPI',
  'cost-engine': 'Cost Engine'
}

export const EXCEL_EXPORT_MODULES: ExcelModuleKey[] = [
  'products',
  'recipes',
  'raw-materials',
  'suppliers',
  'purchase-requests',
  'purchase-orders',
  'goods-receipts',
  'stock',
  'lots',
  'waste',
  'production-orders',
  'quality',
  'shipments',
  'delivery-notes',
  'labels',
  'kpi',
  'cost-engine'
]

export const EXCEL_IMPORT_MODULES: ExcelModuleKey[] = [
  'products',
  'raw-materials',
  'suppliers',
  'recipes',
  'stock',
  'purchase-requests'
]

const column = (
  key: string,
  header: string,
  type: ExcelColumnDefinition['type'],
  required = false,
  example?: ExcelColumnDefinition['example'],
  allowNegative = false
): ExcelColumnDefinition => ({
  key,
  header,
  type,
  required,
  example,
  allowNegative
})

const TEMPLATE_COLUMNS: Record<ExcelModuleKey, ExcelColumnDefinition[]> = {
  products: [
    column('name', 'Urun Adi', 'string', true, 'Mercimek Corbasi'),
    column('price', 'Fiyat', 'number', true, 120),
    column('categoryName', 'Kategori', 'string', true, 'Corba'),
    column('branchName', 'Sube', 'string', false, 'Merkez'),
    column('active', 'Aktif', 'boolean', false, true),
    column('calories', 'Kalori', 'number', false, 320),
    column('description', 'Aciklama', 'string', false, 'Toplu yemek urunu')
  ],
  recipes: [
    column('recipeCode', 'Recete Kodu', 'string', true, 'RC-100'),
    column('recipeName', 'Recete Adi', 'string', true, 'Mercimek Corbasi Standart'),
    column('recipeType', 'Recete Tipi', 'string', true, 'Ana Urun'),
    column('productName', 'Urun Adi', 'string', true, 'Mercimek Corbasi'),
    column('portions', 'Porsiyon', 'number', true, 100),
    column('firePercent', 'Fire %', 'number', false, 3),
    column('ingredientName', 'Malzeme Adi', 'string', true, 'Kirmizi Mercimek'),
    column('quantity', 'Miktar', 'number', true, 12),
    column('unit', 'Birim', 'string', true, 'kg'),
    column('unitCost', 'Birim Maliyet', 'number', false, 0.08)
  ],
  'raw-materials': [
    column('name', 'Hammadde Adi', 'string', true, 'Dana Eti'),
    column('categoryName', 'Kategori', 'string', true, 'Hammadde'),
    column('unit', 'Birim', 'string', true, 'kg'),
    column('currentQty', 'Mevcut Miktar', 'number', false, 120),
    column('minQty', 'Minimum Miktar', 'number', false, 30),
    column('averageCost', 'Ortalama Maliyet', 'number', false, 180),
    column('lastPurchasePrice', 'Son Alis Fiyati', 'number', false, 190),
    column('supplierName', 'Supplier', 'string', false, 'Et Tedarik')
  ],
  suppliers: [
    column('supplierCode', 'Supplier Kodu', 'string', false, 'TD-100'),
    column('name', 'Supplier Adi', 'string', true, 'Et Tedarik'),
    column('tradeName', 'Ticari Unvan', 'string', false, 'Et Tedarik AS'),
    column('type', 'Tip', 'string', true, 'RAW_MATERIAL'),
    column('companyType', 'Firma Tipi', 'string', false, 'LOCAL_SUPPLIER'),
    column('contactName', 'Yetkili', 'string', false, 'Ayse Yilmaz'),
    column('contactPhone', 'Telefon', 'string', false, '02120000000'),
    column('contactEmail', 'E-posta', 'string', false, 'info@example.com'),
    column('city', 'Sehir', 'string', false, 'Istanbul'),
    column('leadTimeDays', 'Termin Gun', 'number', false, 3),
    column('paymentTermDays', 'Odeme Gun', 'number', false, 30)
  ],
  'purchase-requests': [
    column('requestNo', 'Talep No', 'string', false, 'PR-100'),
    column('title', 'Baslik', 'string', true, 'Kritik stok tamamlamasi'),
    column('requester', 'Talep Eden', 'string', true, 'Operasyon'),
    column('branchName', 'Sube', 'string', false, 'Merkez'),
    column('warehouseName', 'Depo', 'string', false, 'Merkez'),
    column('department', 'Departman', 'string', true, 'PRODUCTION'),
    column('priority', 'Oncelik', 'string', false, 'NORMAL'),
    column('requiredDate', 'Gerekli Tarih', 'date', false, '2026-07-30'),
    column('stockItemName', 'Stok Adi', 'string', true, 'Dana Eti'),
    column('quantity', 'Miktar', 'number', true, 50),
    column('estimatedUnitPrice', 'Tahmini Birim Fiyat', 'number', false, 180),
    column('notes', 'Not', 'string', false, 'Excel import')
  ],
  'purchase-orders': [
    column('orderNo', 'Order No', 'string', true, 'PO-100'),
    column('supplierName', 'Supplier', 'string', false, 'Et Tedarik'),
    column('orderDate', 'Order Date', 'date', false, '2026-07-26'),
    column('status', 'Status', 'string', false, 'CONFIRMED'),
    column('grandTotal', 'Grand Total', 'number', false, 25000)
  ],
  'goods-receipts': [
    column('receiptNo', 'Mal Kabul No', 'string', true, 'GR-2026-000001'),
    column('receiptDate', 'Tarih', 'date', false, '2026-07-27'),
    column('purchaseOrderNo', 'Purchase Order', 'string', false, 'PO-000001'),
    column('supplierName', 'Supplier', 'string', false, 'Et Tedarik'),
    column('warehouseName', 'Depo', 'string', false, 'Merkez Depo'),
    column('vehiclePlate', 'Arac', 'string', false, '34 GR 001'),
    column('deliveredBy', 'Teslim Eden', 'string', false, 'Et Tedarik'),
    column('receivedByName', 'Teslim Alan', 'string', false, 'Mal Kabul Ekibi'),
    column('status', 'Durum', 'string', false, 'Kabul Edildi'),
    column('productName', 'Urun', 'string', false, 'Dana Eti'),
    column('lotNo', 'Lot', 'string', true, 'LOT-20260727-0001'),
    column('batchNo', 'Batch', 'string', false, 'BATCH-001'),
    column('receivedQuantity', 'Miktar', 'number', false, 100),
    column('acceptedQuantity', 'Kabul', 'number', false, 95),
    column('rejectedQuantity', 'Red', 'number', false, 5),
    column('unit', 'Birim', 'string', false, 'kg'),
    column('packageType', 'Ambalaj', 'string', false, 'Koli'),
    column('netWeight', 'Net', 'number', false, 95),
    column('grossWeight', 'Brut', 'number', false, 98),
    column('temperatureC', 'Sicaklik C', 'number', false, 4),
    column('inspectionResult', 'Kontrol Sonucu', 'string', false, 'PASS'),
    column('correctiveActionNote', 'Duzeltici Faaliyet', 'string', false, 'Not yok'),
    column('totalCost', 'Toplam Maliyet', 'number', false, 18000)
  ],
  stock: [
    column('name', 'Stok Adi', 'string', true, 'Dana Eti'),
    column('categoryName', 'Kategori', 'string', true, 'Hammadde'),
    column('unit', 'Birim', 'string', true, 'kg'),
    column('currentQty', 'Mevcut Miktar', 'number', false, 120),
    column('minQty', 'Minimum Miktar', 'number', false, 30),
    column('sku', 'SKU', 'string', false, 'STK-100'),
    column('barcode', 'Barkod', 'string', false, '8680000000000'),
    column('unitPurchasePrice', 'Birim Alis Fiyati', 'number', false, 180),
    column('active', 'Aktif', 'boolean', false, true)
  ],
  lots: [
    column('lotNo', 'Lot No', 'string', true, 'LOT-100'),
    column('productName', 'Urun', 'string', false, 'Dana Eti'),
    column('warehouseId', 'Depo', 'string', false, 'branch_merkez'),
    column('quantity', 'Miktar', 'number', false, 100),
    column('remainingQuantity', 'Kalan', 'number', false, 80),
    column('expiryDate', 'SKT', 'date', false, '2026-08-15')
  ],
  waste: [
    column('wasteNo', 'Fire No', 'string', true, 'WS-2026-000001'),
    column('date', 'Tarih', 'date', false, '2026-07-27'),
    column('status', 'Durum', 'string', false, 'Onaylandi'),
    column('wasteType', 'Fire Turu', 'string', true, 'Uretim Firesi'),
    column('wasteReason', 'Fire Nedeni', 'string', true, 'Uretim Hatasi'),
    column('productName', 'Urun', 'string', true, 'Dana Eti'),
    column('lotNo', 'Lot', 'string', true, 'LOT-20260727-0001'),
    column('batchNo', 'Batch', 'string', false, 'BATCH-001'),
    column('quantity', 'Fire Miktari', 'number', true, 2),
    column('unit', 'Birim', 'string', false, 'kg'),
    column('warehouseName', 'Depo', 'string', false, 'Merkez Depo'),
    column('branchName', 'Sube', 'string', false, 'Merkez'),
    column('productionOrderNo', 'Uretim Emri', 'string', false, 'WO-100'),
    column('recipeName', 'Recete', 'string', false, 'Standart Recete'),
    column('supplierName', 'Supplier', 'string', false, 'Et Tedarik'),
    column('qualityDecision', 'Kalite Karari', 'string', false, 'REJECTED'),
    column('haccpReference', 'HACCP Referansi', 'string', false, 'Soguk Zincir / PASS'),
    column('correctiveAction', 'Duzeltici Faaliyet', 'string', false, 'Kok neden analizi'),
    column('totalCost', 'Toplam Maliyet', 'number', false, 360)
  ],
  'production-orders': [
    column('workOrderNo', 'Is Emri No', 'string', true, 'WO-100'),
    column('branch', 'Sube', 'string', false, 'Merkez'),
    column('status', 'Status', 'string', false, 'Bekliyor'),
    column('productName', 'Urun', 'string', false, 'Mercimek Corbasi'),
    column('quantity', 'Miktar', 'number', false, 100)
  ],
  quality: [
    column('recordNo', 'Kayit No', 'string', true, 'QLT-100'),
    column('module', 'Modul', 'string', false, 'Quality'),
    column('status', 'Status', 'string', false, 'PASS'),
    column('date', 'Tarih', 'date', false, '2026-07-26'),
    column('productName', 'Urun', 'string', false, 'Mercimek Corbasi')
  ],
  shipments: [
    column('shipmentNo', 'Sevkiyat No', 'string', true, 'SHP-100'),
    column('shipmentDate', 'Sevkiyat Tarihi', 'date', false, '2026-07-26'),
    column('status', 'Status', 'string', false, 'PLANNED'),
    column('quantity', 'Miktar', 'number', false, 40)
  ],
  'delivery-notes': [
    column('deliveryNoteNo', 'Irsaliye No', 'string', true, 'DN-2026-000001'),
    column('date', 'Tarih', 'date', false, '2026-07-27'),
    column('customerName', 'Musteri', 'string', false, 'Merkez Sube'),
    column('branchName', 'Sube', 'string', false, 'Merkez'),
    column('warehouseName', 'Depo', 'string', false, 'Merkez Depo'),
    column('vehicleNo', 'Arac', 'string', false, 'VH-000001'),
    column('driverName', 'Sofor', 'string', false, 'Murat Kaya'),
    column('shipmentPlanNo', 'Sevkiyat Plani', 'string', false, 'SP-000001'),
    column('status', 'Durum', 'string', false, 'READY'),
    column('productName', 'Urun', 'string', false, 'Mercimek Corbasi'),
    column('lotNo', 'Lot', 'string', false, 'LOT-20260727-0001'),
    column('quantity', 'Miktar', 'number', false, 40),
    column('unit', 'Birim', 'string', false, 'kg'),
    column('boxCount', 'Koli', 'number', false, 4),
    column('palletCount', 'Palet', 'number', false, 1),
    column('netWeight', 'Net', 'number', false, 40),
    column('grossWeight', 'Brut', 'number', false, 44),
    column('totalCost', 'Toplam Maliyet', 'number', false, 2500)
  ],
  labels: [
    column('labelNo', 'Etiket No', 'string', true, 'LBL-2026-000001'),
    column('labelType', 'Etiket Turu', 'string', true, 'LOT'),
    column('templateName', 'Sablon', 'string', false, '70x50 Koli'),
    column('productName', 'Urun Adi', 'string', true, 'Mercimek Corbasi'),
    column('productCode', 'Urun Kodu', 'string', false, 'SKU-100'),
    column('lotNo', 'Lot No', 'string', true, 'LOT-20260727-0001'),
    column('batchNo', 'Batch No', 'string', false, 'LOT-20260727-0001'),
    column('productionDate', 'Uretim Tarihi', 'date', false, '2026-07-27'),
    column('expiryDate', 'SKT', 'date', false, '2026-07-30'),
    column('netWeight', 'Net Agirlik', 'number', false, 40),
    column('grossWeight', 'Brut Agirlik', 'number', false, 42),
    column('warehouseName', 'Depo', 'string', false, 'Merkez Depo'),
    column('branchName', 'Sube', 'string', false, 'Merkez'),
    column('productionOrderNo', 'Uretim Emri', 'string', false, 'WO-100'),
    column('recipeName', 'Recete', 'string', false, 'Standart'),
    column('barcodeValue', 'Code-128', 'string', false, 'LBL-2026-000001|LOT-20260727-0001|SKU-100'),
    column('qrPayload', 'QR Payload', 'string', false, 'lot/product/erpId')
  ],
  kpi: [
    column('area', 'Alan', 'string', true, 'Production'),
    column('metric', 'Metrik', 'string', true, 'Toplam Uretim'),
    column('value', 'Deger', 'string', true, '120'),
    column('detail', 'Detay', 'string', false, 'Aylik')
  ],
  'cost-engine': [
    column('productName', 'Urun', 'string', true, 'Mercimek Corbasi'),
    column('recipeName', 'Recete', 'string', false, 'Standart'),
    column('totalCost', 'Toplam Maliyet', 'number', false, 2500),
    column('costPerKg', 'Maliyet / kg', 'number', false, 40),
    column('fireImpact', 'Fire Etkisi', 'number', false, 100),
    column('purchaseImpact', 'Satin Alma Etkisi', 'number', false, 120)
  ]
}

export const getExcelTemplate = (
  moduleKey: ExcelModuleKey
): ExcelTemplate => ({
  id: `excel-template-${moduleKey}`,
  moduleKey,
  moduleLabel: EXCEL_MODULE_LABELS[moduleKey],
  name: `Bos ${EXCEL_MODULE_LABELS[moduleKey]} Sablonu`,
  description: `${EXCEL_MODULE_LABELS[moduleKey]} icin standart Excel kolon seti.`,
  columns: TEMPLATE_COLUMNS[moduleKey],
  importable: EXCEL_IMPORT_MODULES.includes(moduleKey),
  exportable: EXCEL_EXPORT_MODULES.includes(moduleKey)
})

export const getExcelTemplates = () => (
  EXCEL_EXPORT_MODULES.map(getExcelTemplate)
)

export const getImportTemplates = () => (
  EXCEL_IMPORT_MODULES.map(getExcelTemplate)
)

export const getRequiredHeaders = (moduleKey: ExcelModuleKey) => (
  getExcelTemplate(moduleKey).columns.filter(item => item.required).map(item => item.header)
)

export const ExcelTemplateService = {
  listTemplates: getExcelTemplates,
  listImportTemplates: getImportTemplates,
  getTemplate: getExcelTemplate,
  getRequiredHeaders
}
