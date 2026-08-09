import { PRINT_RADIUS_VALUES } from '../design-system/BorderRadiusTheme'
import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import {
  IMPROVEMENT_AREA_LABELS,
  IMPROVEMENT_PRIORITY_LABELS,
  IMPROVEMENT_REPORT_STATUS_LABELS,
  IMPROVEMENT_RISK_LABELS
} from './continuous-improvement.constants'
import type {
  ImprovementPrintMode,
  ImprovementReport
} from './continuous-improvement.types'

const escapeHtml = (value: string | number | boolean) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

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

export const createImprovementPrintHtml = (
  report: ImprovementReport,
  mode: ImprovementPrintMode = 'A4'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.reportNo)} Continuous Improvement</title>
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
    ul { margin:${PRINT_SPACING_VALUES.space8} 0 0; padding-left:${PRINT_SPACING_VALUES.space16}; }
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
        <span class="muted">Continuous Improvement</span>
        <h1>${escapeHtml(report.reportNo)}</h1>
        <div class="muted">${escapeHtml(formatDate(report.startDate))} - ${escapeHtml(formatDate(report.endDate))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazirlik' : IMPROVEMENT_REPORT_STATUS_LABELS[report.status])}</span>
    </div>
    <div class="grid">
      <div class="box"><span>Rapor Tarihi</span><strong>${escapeHtml(formatDate(report.reportDate))}</strong></div>
      <div class="box"><span>Alan</span><strong>${escapeHtml(report.area === 'all' ? 'Tum Alanlar' : IMPROVEMENT_AREA_LABELS[report.area])}</strong></div>
      <div class="box"><span>Hat</span><strong>${escapeHtml(report.productionLineName)}</strong></div>
      <div class="box"><span>Sorumlu</span><strong>${escapeHtml(report.responsiblePerson)}</strong></div>
      <div class="box"><span>Toplam Firsat</span><strong>${escapeHtml(report.opportunities.length)}</strong></div>
      <div class="box"><span>Kritik</span><strong>${escapeHtml(report.opportunities.filter(item => item.riskLevel === 'CRITICAL').length)}</strong></div>
      <div class="box"><span>Beklenen Kazanc</span><strong>${escapeHtml(formatNumber(report.opportunities.reduce((total, item) => total + item.expectedGainMinutes, 0), 0))} dk</strong></div>
      <div class="box"><span>Acil Oneri</span><strong>${escapeHtml(report.opportunities.filter(item => item.priority === 'URGENT').length)}</strong></div>
    </div>
    <h2>Iyilestirme Firsatlari</h2>
    <table>
      <thead>
        <tr>
          <th>Alan</th>
          <th>Varlik</th>
          <th>Hat / Makine</th>
          <th>Bekleme</th>
          <th>Setup / Temizlik</th>
          <th>Kazanc</th>
          <th>Risk / Oncelik</th>
          <th>Oneri</th>
        </tr>
      </thead>
      <tbody>
        ${report.opportunities.map(item => ` 
          <tr>
            <td>${escapeHtml(IMPROVEMENT_AREA_LABELS[item.area])}</td>
            <td><strong>${escapeHtml(item.entityName)}</strong><br><span class="muted">${escapeHtml(item.entityCode)}</span></td>
            <td>${escapeHtml(item.productionLineName || '-')}<br><span class="muted">${escapeHtml(item.machineCode || '-')}</span></td>
            <td>${escapeHtml(formatNumber(item.waitingMinutes, 0))} dk</td>
            <td>${escapeHtml(formatNumber(item.setupMinutes, 0))} / ${escapeHtml(formatNumber(item.cleaningMinutes, 0))} dk</td>
            <td>${escapeHtml(formatNumber(item.expectedGainMinutes, 0))} dk (${escapeHtml(formatNumber(item.expectedGainPercent, 1))}%)</td>
            <td>${escapeHtml(IMPROVEMENT_RISK_LABELS[item.riskLevel])} / ${escapeHtml(IMPROVEMENT_PRIORITY_LABELS[item.priority])}</td>
            <td>${escapeHtml(item.summary)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h2>Oneriler</h2>
    <ul>
      ${report.recommendations.length > 0
        ? report.recommendations.map(item => `<li><strong>${escapeHtml(item.title)}:</strong> ${escapeHtml(item.action)}</li>`).join('')
        : '<li>Oneri bulunmuyor.</li>'}
    </ul>
  </div>
  <script>
    window.addEventListener('load', () => window.print())
  </script>
</body>
</html>`

export const openImprovementPrintWindow = (
  report: ImprovementReport,
  mode: ImprovementPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'width=1120,height=820')
  if(!printWindow) throw new Error('Cikti penceresi acilamadi.')
  printWindow.document.open()
  printWindow.document.write(createImprovementPrintHtml(report, mode))
  printWindow.document.close()
}

export const ImprovementPrintService = {
  createHtml: createImprovementPrintHtml,
  openPrintWindow: openImprovementPrintWindow
}
