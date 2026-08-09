import { PRINT_RADIUS_VALUES } from '../design-system/BorderRadiusTheme'
import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import {
  COST_OPTIMIZATION_CATEGORY_LABELS,
  COST_OPTIMIZATION_PRIORITY_LABELS,
  COST_OPTIMIZATION_RISK_LABELS,
  COST_OPTIMIZATION_STATUS_LABELS
} from './cost-optimization.constants'
import type {
  CostOptimizationReport,
  CostPrintMode
} from './cost-optimization.types'

const escapeHtml = (value: string | number | boolean) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const formatCurrency = (
  value: number
) => value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })

const formatNumber = (
  value: number,
  maximumFractionDigits = 1
) => value.toLocaleString('tr-TR', { maximumFractionDigits })

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
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

export const createCostPrintHtml = (
  report: CostOptimizationReport,
  mode: CostPrintMode = 'A4'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.reportNo)} Maliyet Optimizasyonu</title>
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:${PRINT_SPACING_VALUES.space24}; color:#111827; font-family:Inter, Arial, sans-serif; background:#f8fafc; }
    .sheet { max-width:1120px; margin:0 auto; padding:${PRINT_SPACING_VALUES.space24}; border:1px solid #d1d5db; border-radius:${PRINT_RADIUS_VALUES.card}; background:#fff; }
    .header { display:flex; justify-content:space-between; gap:${PRINT_SPACING_VALUES.space16}; align-items:flex-start; border-bottom:2px solid #111827; padding-bottom:${PRINT_SPACING_VALUES.space16}; margin-bottom:${PRINT_SPACING_VALUES.space16}; }
    h1 { margin:0; font-size:22px; line-height:1.2; }
    h2 { margin:${PRINT_SPACING_VALUES.space20} 0 ${PRINT_SPACING_VALUES.space8}; font-size:16px; }
    .muted { color:#64748b; font-size:12px; font-weight:700; }
    .pill { display:inline-block; border:1px solid #d1d5db; border-radius:${PRINT_RADIUS_VALUES.full}; padding:${PRINT_SPACING_VALUES.space4} ${PRINT_SPACING_VALUES.space8}; font-size:12px; font-weight:800; }
    .grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:${PRINT_SPACING_VALUES.space8}; }
    .box { min-width:0; border:1px solid #e5e7eb; border-radius:${PRINT_RADIUS_VALUES.box}; padding:${PRINT_SPACING_VALUES.space8} ${PRINT_SPACING_VALUES.space8}; background:#f9fafb; }
    .box span { display:block; color:#64748b; font-size:11px; font-weight:800; }
    .box strong { display:block; margin-top:${PRINT_SPACING_VALUES.space4}; color:#111827; font-size:13px; overflow-wrap:anywhere; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th, td { border:1px solid #e5e7eb; padding:${PRINT_SPACING_VALUES.space8}; text-align:left; vertical-align:top; }
    th { background:#f3f4f6; font-weight:900; }
    @media print {
      body { background:#fff; padding:0; }
      .sheet { border:0; border-radius:${PRINT_RADIUS_VALUES.none}; max-width:none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <span class="muted">Maliyet Optimizasyon Motoru</span>
        <h1>${escapeHtml(report.reportNo)} - Maliyet Optimizasyonu</h1>
        <div class="muted">${escapeHtml(formatDate(report.reportDate))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazirlik' : COST_OPTIMIZATION_STATUS_LABELS[report.status])}</span>
    </div>
    <div class="grid">
      <div class="box"><span>Rapor Tarihi</span><strong>${escapeHtml(formatDate(report.reportDate))}</strong></div>
      <div class="box"><span>Kapsam</span><strong>${escapeHtml(report.scope === 'all' ? 'Tum Kategoriler' : COST_OPTIMIZATION_CATEGORY_LABELS[report.scope])}</strong></div>
      <div class="box"><span>Firsat</span><strong>${escapeHtml(report.items.length)}</strong></div>
      <div class="box"><span>Tasarruf</span><strong>${escapeHtml(formatCurrency(report.items.reduce((total, item) => total + item.savingPotential, 0)))}</strong></div>
    </div>
    <h2>Optimizasyon Listesi</h2>
    <table>
      <thead><tr><th>Kategori</th><th>Firsat</th><th>Risk</th><th>Oncelik</th><th>Tasarruf</th><th>Aksiyon</th></tr></thead>
      <tbody>
        ${report.items.slice(0, 36).map(item => `
          <tr>
            <td>${escapeHtml(COST_OPTIMIZATION_CATEGORY_LABELS[item.category])}<br><span class="muted">${escapeHtml(item.sourceModule)}</span></td>
            <td>${escapeHtml(item.title)}<br><span class="muted">${escapeHtml(item.relatedEntityName)}</span></td>
            <td>${escapeHtml(COST_OPTIMIZATION_RISK_LABELS[item.risk])} / ${escapeHtml(formatNumber(item.riskScore, 1))}</td>
            <td>${escapeHtml(COST_OPTIMIZATION_PRIORITY_LABELS[item.priority])}</td>
            <td>${escapeHtml(formatCurrency(item.savingPotential))}</td>
            <td>${escapeHtml(item.action)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h2>History</h2>
    <table>
      <thead><tr><th>Aksiyon</th><th>Kullanici</th><th>Tarih</th><th>Aciklama</th></tr></thead>
      <tbody>
        ${report.history.map(history => `
          <tr>
            <td>${escapeHtml(history.action)}</td>
            <td>${escapeHtml(history.actorName)}</td>
            <td>${escapeHtml(formatDateTime(history.createdAt))}</td>
            <td>${escapeHtml(history.description)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  <script>
    window.addEventListener('load', () => window.print())
  </script>
</body>
</html>`

export const openCostPrintWindow = (
  report: CostOptimizationReport,
  mode: CostPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'width=1120,height=840')
  if(!printWindow) throw new Error('Cikti penceresi acilamadi.')
  printWindow.document.open()
  printWindow.document.write(createCostPrintHtml(report, mode))
  printWindow.document.close()
}

export const CostPrintService = {
  createHtml: createCostPrintHtml,
  openPrintWindow: openCostPrintWindow
}
