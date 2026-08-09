import { PRINT_RADIUS_VALUES } from '../design-system/BorderRadiusTheme'
import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import {
  AI_ANALYSIS_STATUS_LABELS,
  AI_ANALYSIS_TITLE_LABELS,
  AI_INSIGHT_TYPE_LABELS,
  AI_SEVERITY_LABELS
} from './ai-analysis.constants'
import type {
  AIAnalysisReport,
  AIPrintMode
} from './ai-analysis.types'

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

export const createAIPrintHtml = (
  report: AIAnalysisReport,
  mode: AIPrintMode = 'A4'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.reportNo)} Yapay Zeka Analizi</title>
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
        <span class="muted">Yapay Zeka Analiz Motoru</span>
        <h1>${escapeHtml(report.reportNo)} - Yapay Zeka Analizi</h1>
        <div class="muted">${escapeHtml(formatDate(report.reportDate))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazirlik' : AI_ANALYSIS_STATUS_LABELS[report.status])}</span>
    </div>
    <div class="grid">
      <div class="box"><span>Rapor Tarihi</span><strong>${escapeHtml(formatDate(report.reportDate))}</strong></div>
      <div class="box"><span>Kapsam</span><strong>${escapeHtml(report.scope === 'all' ? 'Tüm Başlıklar' : AI_ANALYSIS_TITLE_LABELS[report.scope])}</strong></div>
      <div class="box"><span>İçgörü</span><strong>${escapeHtml(report.insights.length)}</strong></div>
      <div class="box"><span>Sorumlu</span><strong>${escapeHtml(report.responsiblePerson)}</strong></div>
    </div>
    <h2>Yapay Zeka Bulguları</h2>
    <table>
      <thead><tr><th>Başlık</th><th>İçgörü</th><th>Seviye</th><th>Güven Skoru</th><th>Etki Skoru</th><th>Öneri</th></tr></thead>
      <tbody>
        ${report.insights.slice(0, 36).map(insight => `
          <tr>
            <td>${escapeHtml(AI_ANALYSIS_TITLE_LABELS[insight.analysisTitle])}<br><span class="muted">${escapeHtml(insight.sourceModule)}</span></td>
            <td>${escapeHtml(insight.title)}<br><span class="muted">${escapeHtml(AI_INSIGHT_TYPE_LABELS[insight.insightType])} / ${escapeHtml(insight.relatedEntityName)}</span></td>
            <td>${escapeHtml(AI_SEVERITY_LABELS[insight.severity])} / ${escapeHtml(formatNumber(insight.riskScore, 1))}</td>
            <td>${escapeHtml(formatNumber(insight.confidenceScore, 1))}</td>
            <td>${escapeHtml(formatNumber(insight.impactScore, 1))}</td>
            <td>${escapeHtml(insight.recommendedAction)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h2>Geçmiş</h2>
    <table>
      <thead><tr><th>Aksiyon</th><th>Kullanıcı</th><th>Tarih</th><th>Açıklama</th></tr></thead>
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

export const openAIPrintWindow = (
  report: AIAnalysisReport,
  mode: AIPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'width=1120,height=840')
  if(!printWindow) throw new Error('Cikti penceresi acilamadi.')
  printWindow.document.open()
  printWindow.document.write(createAIPrintHtml(report, mode))
  printWindow.document.close()
}

export const AIPrintService = {
  createHtml: createAIPrintHtml,
  openPrintWindow: openAIPrintWindow
}
