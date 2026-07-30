import {
  FORECAST_RISK_LABELS,
  FORECAST_STATUS_LABELS,
  FORECAST_TREND_LABELS,
  FORECAST_TYPE_LABELS
} from './forecasting.constants'
import type {
  ForecastPrintMode,
  ForecastReport
} from './forecasting.types'

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

export const createForecastPrintHtml = (
  report: ForecastReport,
  mode: ForecastPrintMode = 'A4'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.reportNo)} Forecasting Engine</title>
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
        <span class="muted">Forecasting Engine</span>
        <h1>${escapeHtml(report.reportNo)} - ${escapeHtml(report.scenarioName)}</h1>
        <div class="muted">${escapeHtml(formatDate(report.startDate))} - ${escapeHtml(formatDate(report.endDate))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazirlik' : FORECAST_STATUS_LABELS[report.status])}</span>
    </div>
    <div class="grid">
      <div class="box"><span>Rapor Tarihi</span><strong>${escapeHtml(formatDate(report.reportDate))}</strong></div>
      <div class="box"><span>Ufuk</span><strong>${escapeHtml(report.horizonDays)} gun</strong></div>
      <div class="box"><span>Analiz Penceresi</span><strong>${escapeHtml(report.analysisWindowDays)} gun</strong></div>
      <div class="box"><span>Tahmin Sayisi</span><strong>${escapeHtml(report.predictions.length)}</strong></div>
    </div>
    <h2>Tahmin Listesi</h2>
    <table>
      <thead><tr><th>Tur</th><th>Varlik</th><th>Beklenen</th><th>Buyume</th><th>Risk</th><th>Oneri</th></tr></thead>
      <tbody>
        ${report.predictions.slice(0, 32).map(prediction => `
          <tr>
            <td>${escapeHtml(FORECAST_TYPE_LABELS[prediction.forecastType])}</td>
            <td>${escapeHtml(prediction.entityName)}</td>
            <td>${escapeHtml(formatNumber(prediction.expectedValue, 2))} ${escapeHtml(prediction.unit)}</td>
            <td>${escapeHtml(formatNumber(prediction.growthPercent, 1))}% / ${escapeHtml(FORECAST_TREND_LABELS[prediction.trendDirection])}</td>
            <td>${escapeHtml(FORECAST_RISK_LABELS[prediction.riskLevel])} / ${escapeHtml(formatNumber(prediction.riskScore, 1))}</td>
            <td>${escapeHtml(prediction.recommendation)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h2>Senaryolar</h2>
    <table>
      <thead><tr><th>Senaryo</th><th>Talep</th><th>Fire</th><th>Kalite</th><th>Kapasite</th><th>Etki</th></tr></thead>
      <tbody>
        ${report.scenarios.map(scenario => `
          <tr>
            <td>${escapeHtml(scenario.name)}</td>
            <td>${escapeHtml(formatNumber(scenario.demandMultiplier, 2))}x</td>
            <td>${escapeHtml(formatNumber(scenario.wasteMultiplier, 2))}x</td>
            <td>${escapeHtml(formatNumber(scenario.qualityRiskMultiplier, 2))}x</td>
            <td>${escapeHtml(formatNumber(scenario.capacityMultiplier, 2))}x</td>
            <td>${escapeHtml(scenario.expectedImpact)}</td>
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

export const openForecastPrintWindow = (
  report: ForecastReport,
  mode: ForecastPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'width=1120,height=840')
  if(!printWindow) throw new Error('Cikti penceresi acilamadi.')
  printWindow.document.open()
  printWindow.document.write(createForecastPrintHtml(report, mode))
  printWindow.document.close()
}

export const ForecastPrintService = {
  createHtml: createForecastPrintHtml,
  openPrintWindow: openForecastPrintWindow
}
