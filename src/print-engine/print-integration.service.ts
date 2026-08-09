import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import { BarcodeIntegrationService } from '../barcode-engine/barcode-integration.service'
import { QRIntegrationService } from '../qr-engine/qr-integration.service'
import type {
  PrintDocumentInput,
  PrintJob,
  PrintModuleKey,
  PrintOrientation,
  PrintOutputType,
  PrintPreviewResult,
  PrintPrinter,
  PrintRequest,
  PrintTemplate,
  PrintValidationResult
} from './print.types'

const PRINT_JOB_STORAGE_KEY = 'ra_print_integration_jobs'
const DEFAULT_USER_NAME = 'Sistem'

const PRINT_MODULE_LABELS: Record<PrintModuleKey, string> = {
  recipes: 'Receteler',
  'production-orders': 'Uretim Emirleri',
  'purchase-requests': 'Satin Alma Talepleri',
  'goods-receipts': 'Mal Kabul',
  shipments: 'Sevkiyat',
  lots: 'Lot Listesi',
  samples: 'Numune Takibi',
  waste: 'Fire Kayitlari'
}

const OUTPUT_LABELS: Record<PrintOutputType, string> = {
  A4: 'A4',
  A5: 'A5',
  LABEL: 'Etiket',
  BARCODE_LABEL: 'Barkod Etiketi',
  QR_LABEL: 'QR Etiketi'
}

const SUPPORTED_OUTPUTS: PrintOutputType[] = ['A4', 'A5', 'LABEL', 'BARCODE_LABEL', 'QR_LABEL']

const DEFAULT_PRINTERS: PrintPrinter[] = [
  { id: 'default-office-printer', name: 'Varsayilan Ofis Yazicisi', outputTypes: ['A4', 'A5'], isDefault: true },
  { id: 'kitchen-a4-printer', name: 'Uretim A4 Yazicisi', outputTypes: ['A4', 'A5'], isDefault: false },
  { id: 'label-printer', name: 'Etiket Yazicisi', outputTypes: ['LABEL', 'BARCODE_LABEL', 'QR_LABEL'], isDefault: false },
  { id: 'barcode-printer', name: 'Barkod Etiket Yazicisi', outputTypes: ['BARCODE_LABEL', 'QR_LABEL'], isDefault: false }
]

const createTemplate = (
  moduleKey: PrintModuleKey,
  outputType: PrintOutputType,
  name: string,
  description: string
): PrintTemplate => ({
  id: `${moduleKey}-${outputType.toLocaleLowerCase('tr-TR')}-template`,
  moduleKey,
  moduleLabel: PRINT_MODULE_LABELS[moduleKey],
  outputType,
  name,
  description,
  active: true
})

const PRINT_TEMPLATES: PrintTemplate[] = Object.keys(PRINT_MODULE_LABELS).flatMap(moduleKey => {
  const key = moduleKey as PrintModuleKey
  return [
    createTemplate(key, 'A4', `${PRINT_MODULE_LABELS[key]} A4`, `${PRINT_MODULE_LABELS[key]} icin kurumsal A4 cikti sablonu.`),
    createTemplate(key, 'A5', `${PRINT_MODULE_LABELS[key]} A5`, `${PRINT_MODULE_LABELS[key]} icin kompakt A5 cikti sablonu.`),
    createTemplate(key, 'LABEL', `${PRINT_MODULE_LABELS[key]} Etiket`, `${PRINT_MODULE_LABELS[key]} icin etiket cikti sablonu.`),
    createTemplate(key, 'BARCODE_LABEL', `${PRINT_MODULE_LABELS[key]} Barkod Etiketi`, `${PRINT_MODULE_LABELS[key]} icin barkod etiket sablonu.`),
    createTemplate(key, 'QR_LABEL', `${PRINT_MODULE_LABELS[key]} QR Etiketi`, `${PRINT_MODULE_LABELS[key]} icin QR referans etiket sablonu.`)
  ]
})

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const normalizeText = (value: unknown) => String(value ?? '').trim()

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getDefaultPrinter = (outputType: PrintOutputType) => (
  DEFAULT_PRINTERS.find(printer => printer.isDefault && printer.outputTypes.includes(outputType))
  || DEFAULT_PRINTERS.find(printer => printer.outputTypes.includes(outputType))
  || DEFAULT_PRINTERS[0]
)

const getTemplate = (
  moduleKey: PrintModuleKey,
  outputType: PrintOutputType,
  templateId?: string
) => (
  PRINT_TEMPLATES.find(template => template.id === templateId && template.moduleKey === moduleKey)
  || PRINT_TEMPLATES.find(template => template.moduleKey === moduleKey && template.outputType === outputType && template.active)
  || null
)

const getPrinter = (
  outputType: PrintOutputType,
  printerId?: string
) => (
  DEFAULT_PRINTERS.find(printer => printer.id === printerId && printer.outputTypes.includes(outputType))
  || getDefaultPrinter(outputType)
)

const normalizeCopies = (copies?: number) => {
  const parsed = Number(copies || 1)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(50, Math.floor(parsed))) : 1
}

const normalizeOrientation = (orientation?: PrintOrientation): PrintOrientation => (
  orientation === 'LANDSCAPE' ? 'LANDSCAPE' : 'PORTRAIT'
)

const normalizeOutputType = (outputType?: PrintOutputType): PrintOutputType => (
  outputType && SUPPORTED_OUTPUTS.includes(outputType) ? outputType : 'A4'
)

const createValidationResult = (errors: string[]): PrintValidationResult => ({
  valid: errors.length === 0,
  errors
})

const validateRequest = (
  request: PrintRequest,
  template: PrintTemplate | null,
  printer: PrintPrinter | null,
  outputType: PrintOutputType
) => {
  const errors: string[] = []
  if(request.documents.length === 0) errors.push('Yazdirilacak kayit bulunamadi.')
  if(!template) errors.push('Yazdirma sablonu bulunamadi.')
  if(!printer) errors.push('Yazici secilmedi.')
  if(!SUPPORTED_OUTPUTS.includes(outputType)) errors.push('Desteklenmeyen cikti tipi.')
  if(printer && !printer.outputTypes.includes(outputType)) errors.push('Secilen yazici bu cikti tipini desteklemiyor.')
  return createValidationResult(errors)
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
}

const normalizeJob = (value: Partial<PrintJob>): PrintJob => {
  const moduleKey = (Object.keys(PRINT_MODULE_LABELS).includes(normalizeText(value.moduleKey)) ? value.moduleKey : 'recipes') as PrintModuleKey
  const outputType = normalizeOutputType(value.outputType)
  const printer = getPrinter(outputType, value.printerId)
  const template = getTemplate(moduleKey, outputType, value.templateId)

  return {
    id: normalizeText(value.id) || createId('print_job'),
    status: normalizeText(value.status).toUpperCase() === 'FAILED' ? 'FAILED' : 'SUCCESS',
    moduleKey,
    moduleLabel: PRINT_MODULE_LABELS[moduleKey],
    templateId: normalizeText(value.templateId) || template?.id || '',
    templateName: normalizeText(value.templateName) || template?.name || '',
    outputType,
    printerId: normalizeText(value.printerId) || printer.id,
    printerName: normalizeText(value.printerName) || printer.name,
    copies: normalizeCopies(value.copies),
    orientation: normalizeOrientation(value.orientation),
    documentCount: Number(value.documentCount) || 0,
    userName: normalizeText(value.userName) || DEFAULT_USER_NAME,
    createdAt: normalizeText(value.createdAt) || new Date().toISOString(),
    message: normalizeText(value.message)
  }
}

const loadJobs = () => {
  if(!isBrowserStorageAvailable()) return []
  const stored = localStorage.getItem(PRINT_JOB_STORAGE_KEY)
  if(!stored) return []

  try{
    const parsed = JSON.parse(stored)
    if(Array.isArray(parsed)) return parsed
      .filter(item => item && typeof item === 'object')
      .map(item => normalizeJob(item as Partial<PrintJob>))
  } catch {
    return []
  }

  return []
}

const saveJobs = (jobs: PrintJob[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(PRINT_JOB_STORAGE_KEY, JSON.stringify(jobs.map(normalizeJob)))
}

const addJob = (job: PrintJob) => {
  const jobs = [job, ...loadJobs()]
  saveJobs(jobs)
  return job
}

const createJob = (
  request: PrintRequest,
  status: PrintJob['status'],
  template: PrintTemplate,
  printer: PrintPrinter,
  outputType: PrintOutputType,
  message: string
): PrintJob => ({
  id: createId('print_job'),
  status,
  moduleKey: request.moduleKey,
  moduleLabel: PRINT_MODULE_LABELS[request.moduleKey],
  templateId: template.id,
  templateName: template.name,
  outputType,
  printerId: printer.id,
  printerName: printer.name,
  copies: normalizeCopies(request.copies),
  orientation: normalizeOrientation(request.orientation),
  documentCount: request.documents.length,
  userName: request.userName || DEFAULT_USER_NAME,
  createdAt: new Date().toISOString(),
  message
})

const pageSizeCss = (
  outputType: PrintOutputType,
  orientation: PrintOrientation
) => {
  if(outputType === 'A5') return `A5 ${orientation === 'LANDSCAPE' ? 'landscape' : 'portrait'}`
  if(outputType === 'LABEL' || outputType === 'BARCODE_LABEL' || outputType === 'QR_LABEL') return '80mm 50mm'
  return `A4 ${orientation === 'LANDSCAPE' ? 'landscape' : 'portrait'}`
}

const createFieldGridHtml = (fields: PrintDocumentInput['fields']) => fields.map(field => `
  <div class="print-field">
    <span>${escapeHtml(field.label)}</span>
    <strong>${escapeHtml(field.value)}</strong>
  </div>
`).join('')

const createTableHtml = (section: NonNullable<PrintDocumentInput['tables']>[number]) => `
  <section class="print-section">
    <h2>${escapeHtml(section.title)}</h2>
    <table>
      <thead>
        <tr>${section.columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${section.rows.length > 0 ? section.rows.map(row => `
          <tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>
        `).join('') : `<tr><td colspan="${section.columns.length}">Kayit bulunamadi.</td></tr>`}
      </tbody>
    </table>
  </section>
`

const createLabelDocumentHtml = async (
  document: PrintDocumentInput,
  outputType: PrintOutputType
) => {
  const barcodeImage = outputType === 'BARCODE_LABEL'
    ? BarcodeIntegrationService.createBarcodeDataUrl(document.barcodeValue || document.entityCode, 'CODE128', 300, 74)
    : ''
  const qrImage = outputType === 'QR_LABEL'
    ? await QRIntegrationService.createDataUrl(document.qrPayload || JSON.stringify({
      entityId: document.entityId,
      code: document.entityCode,
      module: document.moduleKey
    }))
    : ''

  return `
    <article class="print-label-card">
      <header>
        <strong>${escapeHtml(document.title)}</strong>
        <span>${escapeHtml(document.entityCode)}</span>
      </header>
      ${barcodeImage ? `<img class="print-label-barcode" src="${barcodeImage}" alt="Barkod" />` : ''}
      ${qrImage ? `<img class="print-label-qr" src="${qrImage}" alt="QR" />` : ''}
      <div class="print-label-fields">${createFieldGridHtml(document.fields.slice(0, 4))}</div>
    </article>
  `
}

const createDocumentHtml = async (
  document: PrintDocumentInput,
  outputType: PrintOutputType
) => {
  if(outputType === 'LABEL' || outputType === 'BARCODE_LABEL' || outputType === 'QR_LABEL'){
    return createLabelDocumentHtml(document, outputType)
  }

  return `
    <article class="print-document">
      <header class="print-header">
        <div>
          <h1>${escapeHtml(document.title)}</h1>
          <p>${escapeHtml(document.subtitle || PRINT_MODULE_LABELS[document.moduleKey])}</p>
        </div>
        <strong>${escapeHtml(document.entityCode)}</strong>
      </header>
      <section class="print-field-grid">${createFieldGridHtml(document.fields)}</section>
      ${(document.tables || []).map(createTableHtml).join('')}
      ${document.notes ? `<section class="print-notes"><span>Notlar</span><p>${escapeHtml(document.notes)}</p></section>` : ''}
      <footer class="print-footer">
        <span>Industrial Kitchen ERP</span>
        <span>${escapeHtml(formatDateTime(new Date().toISOString()))}</span>
      </footer>
    </article>
  `
}

const createHtml = async (
  request: PrintRequest,
  template: PrintTemplate,
  printer: PrintPrinter,
  outputType: PrintOutputType
) => {
  const copies = normalizeCopies(request.copies)
  const orientation = normalizeOrientation(request.orientation)
  const copiedDocuments = request.documents.flatMap(document => (
    Array.from({ length: copies }, () => document)
  ))
  const documentsHtml = await Promise.all(copiedDocuments.map(document => createDocumentHtml(document, outputType)))

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(template.name)}</title>
  <style>
    @page { size: ${pageSizeCss(outputType, orientation)}; margin: ${outputType === 'A4' ? '14mm' : outputType === 'A5' ? '10mm' : '0'}; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
    .toolbar { position: fixed; right: 16px; top: 16px; z-index: 2; display:flex; gap:${PRINT_SPACING_VALUES.space8}; align-items:center; }
    .toolbar button { padding: ${PRINT_SPACING_VALUES.space8} ${PRINT_SPACING_VALUES.space12}; font-weight: 700; }
    .print-root { display: grid; gap: ${outputType === 'A4' ? '12mm' : '6mm'}; }
    .print-document { min-height: ${outputType === 'A4' ? '260mm' : '185mm'}; page-break-after: always; }
    .print-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: ${PRINT_SPACING_VALUES.space16}; align-items: start; border-bottom: 2px solid #111827; padding-bottom: ${PRINT_SPACING_VALUES.space12}; margin-bottom: ${PRINT_SPACING_VALUES.space12}; }
    .print-header h1 { margin: 0; font-size: ${outputType === 'A4' ? '24px' : '19px'}; line-height: 1.15; letter-spacing: 0; }
    .print-header p { margin: ${PRINT_SPACING_VALUES.space4} 0 0; color: #6b7280; }
    .print-header strong { border: 1px solid #111827; border-radius: 4px; padding: ${PRINT_SPACING_VALUES.space4} ${PRINT_SPACING_VALUES.space8}; overflow-wrap: anywhere; }
    .print-field-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: ${PRINT_SPACING_VALUES.space8}; margin-bottom: ${PRINT_SPACING_VALUES.space12}; }
    .print-field { border: 1px solid #d1d5db; border-radius: 4px; padding: ${PRINT_SPACING_VALUES.space8}; min-height: 50px; }
    .print-field span, .print-notes span { display: block; color: #6b7280; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .print-field strong { display: block; margin-top: ${PRINT_SPACING_VALUES.space4}; overflow-wrap: anywhere; }
    .print-section { margin-top: ${PRINT_SPACING_VALUES.space12}; }
    .print-section h2 { margin: 0 0 ${PRINT_SPACING_VALUES.space8}; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: ${PRINT_SPACING_VALUES.space4}; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; }
    .print-notes { border: 1px solid #d1d5db; border-radius: 4px; padding: ${PRINT_SPACING_VALUES.space8}; margin-top: ${PRINT_SPACING_VALUES.space12}; }
    .print-notes p { margin: ${PRINT_SPACING_VALUES.space4} 0 0; white-space: pre-wrap; }
    .print-footer { display:flex; justify-content:space-between; gap:${PRINT_SPACING_VALUES.space12}; color:#6b7280; border-top:1px solid #d1d5db; margin-top:${PRINT_SPACING_VALUES.space16}; padding-top:${PRINT_SPACING_VALUES.space8}; }
    .print-label-card { width: 80mm; height: 50mm; padding: 4mm; border: 1px solid #111827; page-break-after: always; overflow: hidden; }
    .print-label-card header { display:grid; gap:${PRINT_SPACING_VALUES.space2}; border-bottom:1px solid #d1d5db; padding-bottom:${PRINT_SPACING_VALUES.space2}; margin-bottom:${PRINT_SPACING_VALUES.space4}; }
    .print-label-card header strong { font-size:12px; overflow-wrap:anywhere; }
    .print-label-card header span { font-size:9px; color:#6b7280; overflow-wrap:anywhere; }
    .print-label-barcode { width:100%; height:15mm; object-fit:fill; }
    .print-label-qr { width:22mm; height:22mm; }
    .print-label-fields { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:${PRINT_SPACING_VALUES.space2}; margin-top:${PRINT_SPACING_VALUES.space2}; }
    .print-label-fields .print-field { padding:${PRINT_SPACING_VALUES.space2}; min-height:0; border-radius:2px; }
    .print-label-fields .print-field span { font-size:6px; }
    .print-label-fields .print-field strong { font-size:8px; margin-top:${PRINT_SPACING_VALUES.space2}; }
    @media print { .toolbar { display: none; } body { print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <span>${escapeHtml(printer.name)} / ${escapeHtml(OUTPUT_LABELS[outputType])}</span>
    <button onclick="window.print()">Yazdir</button>
  </div>
  <main class="print-root">
    ${documentsHtml.join('')}
  </main>
</body>
</html>`
}

const buildPreview = async (request: PrintRequest): Promise<PrintPreviewResult> => {
  const outputType = normalizeOutputType(request.outputType)
  const template = getTemplate(request.moduleKey, outputType, request.templateId)
  const printer = getPrinter(outputType, request.printerId)
  const validation = validateRequest(request, template, printer, outputType)

  return {
    html: template && printer ? await createHtml(request, template, printer, outputType) : '',
    validation,
    template: template || createTemplate(request.moduleKey, outputType, 'Eksik Sablon', 'Sablon bulunamadi.'),
    printer
  }
}

export const PrintIntegrationService = {
  defaultUserName: DEFAULT_USER_NAME,
  moduleLabels: PRINT_MODULE_LABELS,
  outputLabels: OUTPUT_LABELS,
  supportedOutputs: SUPPORTED_OUTPUTS,
  listPrinters: () => DEFAULT_PRINTERS,
  listTemplates: (moduleKey?: PrintModuleKey) => (
    moduleKey ? PRINT_TEMPLATES.filter(template => template.moduleKey === moduleKey) : PRINT_TEMPLATES
  ),
  getDefaultPrinter,
  preview: buildPreview,
  validate: async (request: PrintRequest) => (await buildPreview(request)).validation,
  openPrintWindow: async (request: PrintRequest) => {
    const preview = await buildPreview(request)
    if(!preview.validation.valid){
      addJob(createJob(request, 'FAILED', preview.template, preview.printer, normalizeOutputType(request.outputType), preview.validation.errors.join(' ')))
      throw new Error(preview.validation.errors[0] || 'Yazdirma dogrulamasi basarisiz.')
    }
    if(typeof window === 'undefined') return false
    const printWindow = window.open('', '_blank', 'width=980,height=1200')
    if(!printWindow) return false
    printWindow.document.open()
    printWindow.document.write(preview.html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 350)
    addJob(createJob(request, 'SUCCESS', preview.template, preview.printer, normalizeOutputType(request.outputType), `${request.documents.length} dokuman yazdirma penceresi acildi.`))
    return true
  },
  createDocument: (input: PrintDocumentInput) => input,
  history: {
    list: loadJobs,
    add: addJob
  }
}
