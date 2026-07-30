import {
  BOTTLENECK_REPORT_STATUS_LABELS,
  BOTTLENECK_RISK_LABELS,
  BOTTLENECK_TYPE_LABELS
} from './bottleneck-analysis.constants'
import type {
  BottleneckPrintMode,
  BottleneckReport
} from './bottleneck-analysis.types'

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

export const createBottleneckPrintHtml = (
  report: BottleneckReport,
  mode: BottleneckPrintMode = 'A4'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.reportNo)} Bottleneck Analysis</title>
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:24px; color:#111827; font-family:Inter, Arial, sans-serif; background:#f8fafc; }
    .sheet { max-width:1120px; margin:0 auto; padding:24px; border:1px solid #d1d5db; border-radius:8px; background:#fff; }
    .header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; border-bottom:2px solid #111827; padding-bottom:16px; margin-bottom:18px; }
    h1 { margin:0; font-size:22px; line-height:1.2; }
    h2 { margin:22px 0 10px; font-size:16px; }
    .muted { color:#64748b; font-size:12px; font-weight:700; }
    .pill { display:inline-block; border:1px solid #d1d5db; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:800; }
    .grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; }
    .box { min-width:0; border:1px solid #e5e7eb; border-radius:6px; padding:9px 10px; background:#f9fafb; }
    .box span { display:block; color:#64748b; font-size:11px; font-weight:800; }
    .box strong { display:block; margin-top:4px; color:#111827; font-size:13px; overflow-wrap:anywhere; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th, td { border:1px solid #e5e7eb; padding:8px; text-align:left; vertical-align:top; }
    th { background:#f3f4f6; font-weight:900; }
    ul { margin:8px 0 0; padding-left:18px; }
    @media print {
      body { background:#fff; padding:0; }
      .sheet { border:0; border-radius:0; max-width:none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <span class="muted">Bottleneck Analysis</span>
        <h1>${escapeHtml(report.reportNo)}</h1>
        <div class="muted">${escapeHtml(formatDate(report.startDate))} - ${escapeHtml(formatDate(report.endDate))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazirlik' : BOTTLENECK_REPORT_STATUS_LABELS[report.status])}</span>
    </div>
    <div class="grid">
      <div class="box"><span>Rapor Tarihi</span><strong>${escapeHtml(formatDate(report.reportDate))}</strong></div>
      <div class="box"><span>Hat</span><strong>${escapeHtml(report.productionLineName)}</strong></div>
      <div class="box"><span>Makine</span><strong>${escapeHtml(report.machineCode || report.machineName)}</strong></div>
      <div class="box"><span>Sorumlu</span><strong>${escapeHtml(report.responsiblePerson)}</strong></div>
      <div class="box"><span>Toplam</span><strong>${escapeHtml(report.items.length)}</strong></div>
      <div class="box"><span>Kritik</span><strong>${escapeHtml(report.items.filter(item => item.riskLevel === 'CRITICAL').length)}</strong></div>
      <div class="box"><span>Bekleme</span><strong>${escapeHtml(formatNumber(report.items.reduce((total, item) => total + item.waitingMinutes, 0), 0))} dk</strong></div>
      <div class="box"><span>Setup</span><strong>${escapeHtml(formatNumber(report.items.reduce((total, item) => total + item.setupMinutes, 0), 0))} dk</strong></div>
    </div>
    <h2>Darbogaz Listesi</h2>
    <table>
      <thead>
        <tr>
          <th>Tur</th>
          <th>Varlik</th>
          <th>Hat / Makine</th>
          <th>Doluluk</th>
          <th>Bekleme</th>
          <th>Setup / Temizlik</th>
          <th>Risk</th>
          <th>Oneri</th>
        </tr>
      </thead>
      <tbody>
        ${report.items.map(item => `
          <tr>
            <td>${escapeHtml(BOTTLENECK_TYPE_LABELS[item.bottleneckType])}</td>
            <td><strong>${escapeHtml(item.entityName)}</strong><br><span class="muted">${escapeHtml(item.entityCode)}</span></td>
            <td>${escapeHtml(item.productionLineName || '-')}<br><span class="muted">${escapeHtml(item.machineCode || '-')}</span></td>
            <td>${escapeHtml(formatNumber(item.utilizationPercent, 1))}%</td>
            <td>${escapeHtml(formatNumber(item.waitingMinutes, 0))} dk</td>
            <td>${escapeHtml(formatNumber(item.setupMinutes, 0))} / ${escapeHtml(formatNumber(item.cleaningMinutes, 0))} dk</td>
            <td>${escapeHtml(BOTTLENECK_RISK_LABELS[item.riskLevel])} (${escapeHtml(formatNumber(item.riskScore, 1))})</td>
            <td>${escapeHtml(item.recommendation)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h2>Oneriler</h2>
    <ul>
      ${report.recommendations.length > 0
        ? report.recommendations.map(item => `<li>${escapeHtml(item)}</li>`).join('')
        : '<li>Oneri bulunmuyor.</li>'}
    </ul>
  </div>
  <script>
    window.addEventListener('load', () => window.print())
  </script>
</body>
</html>`

export const openBottleneckPrintWindow = (
  report: BottleneckReport,
  mode: BottleneckPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'width=1120,height=820')
  if(!printWindow) throw new Error('Cikti penceresi acilamadi.')
  printWindow.document.open()
  printWindow.document.write(createBottleneckPrintHtml(report, mode))
  printWindow.document.close()
}

export const BottleneckPrintService = {
  createHtml: createBottleneckPrintHtml,
  openPrintWindow: openBottleneckPrintWindow
}
