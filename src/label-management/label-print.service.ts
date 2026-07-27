import * as QRCode from 'qrcode'
import type {
  Label,
  LabelPrintMode,
  LabelTemplate
} from './label.types'

const QR_OPTIONS = {
  errorCorrectionLevel: 'M' as const,
  margin: 1,
  width: 180
}

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
]

const START_CODE_B = 104
const STOP_CODE = 106

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const formatDate = (value: string) => {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })

const normalizeCode128Text = (value: string) => value
  .split('')
  .map(character => {
    const code = character.charCodeAt(0)
    return code >= 32 && code <= 127 ? character : '-'
  })
  .join('')
  .slice(0, 80)

const getCode128Values = (value: string) => {
  const normalizedValue = normalizeCode128Text(value)
  const dataValues = normalizedValue.split('').map(character => character.charCodeAt(0) - 32)
  const checksum = dataValues.reduce((total, code, index) => total + code * (index + 1), START_CODE_B) % 103
  return [START_CODE_B, ...dataValues, checksum, STOP_CODE]
}

export const createCode128Svg = (
  value: string,
  width = 320,
  height = 82
) => {
  const values = getCode128Values(value)
  const moduleCount = values.reduce((total, code) => (
    total + (CODE128_PATTERNS[code] || '').split('').reduce((sum, digit) => sum + Number(digit), 0)
  ), 0)
  const quietZone = 10
  const moduleWidth = (width - quietZone * 2) / moduleCount
  let x = quietZone
  const bars: string[] = []

  for(const code of values){
    const pattern = CODE128_PATTERNS[code] || ''
    for(const [index, digit] of pattern.split('').entries()){
      const barWidth = Number(digit) * moduleWidth
      if(index % 2 === 0){
        bars.push(`<rect x="${x.toFixed(2)}" y="6" width="${barWidth.toFixed(2)}" height="${height - 28}" fill="#111827" />`)
      }
      x += barWidth
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Code 128">
    <rect width="100%" height="100%" fill="#ffffff" />
    ${bars.join('')}
    <text x="${width / 2}" y="${height - 7}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#111827">${escapeHtml(value)}</text>
  </svg>`
}

export const createCode128DataUrl = (value: string) => (
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(createCode128Svg(value))}`
)

export const createLabelQrDataUrl = async (payload: string) => (
  QRCode.toDataURL(payload, QR_OPTIONS)
)

const createLabelCardHtml = (
  label: Label,
  qrImage: string,
  barcodeImage: string
) => `
  <article class="label-card">
    <header>
      <div>
        <h2>${escapeHtml(label.productName)}</h2>
        <span>${escapeHtml(label.labelNo)} / ${escapeHtml(label.lotNo)}</span>
      </div>
      <strong>${escapeHtml(label.productCode)}</strong>
    </header>
    <div class="label-body">
      <div class="label-meta">
        <div><span>Batch</span><strong>${escapeHtml(label.batchNo)}</strong></div>
        <div><span>Uretim</span><strong>${escapeHtml(formatDate(label.productionDate))}</strong></div>
        <div><span>SKT</span><strong>${escapeHtml(formatDate(label.expiryDate))}</strong></div>
        <div><span>Net / Brut</span><strong>${escapeHtml(formatNumber(label.netWeight))} / ${escapeHtml(formatNumber(label.grossWeight))} ${escapeHtml(label.unit)}</strong></div>
        <div><span>Depo</span><strong>${escapeHtml(label.warehouseName)}</strong></div>
        <div><span>Uretim Emri</span><strong>${escapeHtml(label.productionOrderNo || '-')}</strong></div>
        <div><span>Recete</span><strong>${escapeHtml(label.recipeName || '-')}</strong></div>
        <div><span>Sube</span><strong>${escapeHtml(label.branchName)}</strong></div>
      </div>
      <img class="label-qr" src="${qrImage}" alt="QR" />
    </div>
    <img class="label-barcode" src="${barcodeImage}" alt="Code 128" />
  </article>`

export const createLabelPrintHtml = async (
  labels: Label[],
  template: LabelTemplate,
  mode: LabelPrintMode
) => {
  const renderedLabels = await Promise.all(labels.map(async label => {
    const qrImage = await createLabelQrDataUrl(label.qrPayload)
    const barcodeImage = createCode128DataUrl(label.barcodeValue)
    return createLabelCardHtml(label, qrImage, barcodeImage)
  }))
  const isA4 = template.size === 'A4'
  const width = isA4 ? 'calc((210mm - 36mm) / 2)' : `${template.widthMm}mm`
  const height = isA4 ? '64mm' : `${template.heightMm}mm`

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Label Print - ${escapeHtml(template.name)}</title>
  <style>
    @page { size: ${isA4 ? 'A4' : `${template.widthMm}mm ${template.heightMm}mm`}; margin: ${isA4 ? '12mm' : '0'}; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    .toolbar { position: fixed; right: 16px; top: 16px; z-index: 2; }
    .toolbar button { padding: 8px 12px; font-weight: 700; }
    .sheet { display: grid; grid-template-columns: ${isA4 ? 'repeat(2, minmax(0, 1fr))' : '1fr'}; gap: ${isA4 ? '8mm' : '0'}; align-items: start; }
    .label-card { width: ${width}; min-height: ${height}; border: 1px solid #111827; padding: ${isA4 ? '5mm' : '3mm'}; page-break-inside: avoid; overflow: hidden; }
    .label-card header { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: start; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin-bottom: 5px; }
    .label-card h2 { margin: 0; font-size: ${isA4 ? '15px' : '10px'}; line-height: 1.15; letter-spacing: 0; }
    .label-card header span, .label-card header strong { display: block; font-size: ${isA4 ? '10px' : '7px'}; }
    .label-body { display: grid; grid-template-columns: 1fr ${isA4 ? '24mm' : '17mm'}; gap: 6px; align-items: start; }
    .label-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px 5px; }
    .label-meta span { display: block; color: #6b7280; font-size: ${isA4 ? '8px' : '6px'}; font-weight: 700; text-transform: uppercase; }
    .label-meta strong { display: block; font-size: ${isA4 ? '10px' : '7px'}; line-height: 1.15; overflow-wrap: anywhere; }
    .label-qr { width: 100%; height: auto; }
    .label-barcode { display: block; width: 100%; height: ${isA4 ? '18mm' : '10mm'}; object-fit: fill; margin-top: 4px; }
    @media print { .toolbar { display: none; } body { print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Yazdir</button></div>
  <main class="sheet" data-print-mode="${escapeHtml(mode)}">
    ${renderedLabels.join('')}
  </main>
</body>
</html>`
}

export const openLabelPrintWindow = async (
  labels: Label[],
  template: LabelTemplate,
  mode: LabelPrintMode
) => {
  if(typeof window === 'undefined') return false
  const html = await createLabelPrintHtml(labels, template, mode)
  const printWindow = window.open('', '_blank', 'width=960,height=1200')
  if(!printWindow) return false
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => printWindow.print(), 450)
  return true
}

export const LabelPrintService = {
  createQrDataUrl: createLabelQrDataUrl,
  createCode128Svg,
  createCode128DataUrl,
  createPrintHtml: createLabelPrintHtml,
  openPrintWindow: openLabelPrintWindow
}
