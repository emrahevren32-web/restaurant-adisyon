import {
  PRODUCTION_PLANNING_RECOMMENDATION_PRIORITY_LABELS,
  PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS,
  PRODUCTION_PLANNING_RECOMMENDATION_STATUS_LABELS,
  PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS
} from './production-planning-recommendation.constants'
import type {
  ProductionPlanningRecommendationItem,
  ProductionPlanningRecommendationPrintMode,
  ProductionPlanningRecommendationReport
} from './production-planning-recommendation.types'

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

const joinNames = (
  items: Array<{ no?: string; name?: string }>
) => items.map(item => item.no || item.name).filter(Boolean).join(', ')

const getMachineText = (item: ProductionPlanningRecommendationItem) => (
  [item.machineCode, item.machineName].filter(Boolean).join(' / ') || '-'
)

export const createProductionPlanningRecommendationPrintHtml = (
  report: ProductionPlanningRecommendationReport,
  mode: ProductionPlanningRecommendationPrintMode = 'A4'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.reportNo)} Üretim Planlama Önerileri</title>
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:24px; color:#111827; font-family:Inter, Arial, sans-serif; background:#f8fafc; }
    .sheet { max-width:1280px; margin:0 auto; padding:24px; border:1px solid #d1d5db; border-radius:8px; background:#fff; }
    .header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; border-bottom:2px solid #111827; padding-bottom:16px; margin-bottom:18px; }
    h1 { margin:0; font-size:22px; line-height:1.2; }
    h2 { margin:22px 0 10px; font-size:16px; }
    .muted { color:#64748b; font-size:12px; font-weight:700; }
    .pill { display:inline-block; border:1px solid #d1d5db; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:800; }
    .grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; }
    .box { min-width:0; border:1px solid #e5e7eb; border-radius:6px; padding:9px 10px; background:#f9fafb; }
    .box span { display:block; color:#64748b; font-size:11px; font-weight:800; }
    .box strong { display:block; margin-top:4px; color:#111827; font-size:13px; overflow-wrap:anywhere; }
    table { width:100%; border-collapse:collapse; font-size:10.5px; }
    th, td { border:1px solid #e5e7eb; padding:7px; text-align:left; vertical-align:top; }
    th { background:#f3f4f6; font-weight:900; }
    .note { color:#334155; font-size:12px; line-height:1.45; }
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
        <span class="muted">Karar Destek Motoru</span>
        <h1>${escapeHtml(report.reportNo)} - Üretim Planlama Önerileri</h1>
        <div class="muted">${escapeHtml(formatDate(report.reportDate))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazırlık' : PRODUCTION_PLANNING_RECOMMENDATION_STATUS_LABELS[report.status])}</span>
    </div>
    <div class="grid">
      <div class="box"><span>Rapor Tarihi</span><strong>${escapeHtml(formatDate(report.reportDate))}</strong></div>
      <div class="box"><span>Kapsam</span><strong>${escapeHtml(report.scope === 'all' ? 'Tüm Öneriler' : PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS[report.scope])}</strong></div>
      <div class="box"><span>Öneri Sayısı</span><strong>${escapeHtml(report.items.length)}</strong></div>
      <div class="box"><span>Sorumlu</span><strong>${escapeHtml(report.responsiblePerson)}</strong></div>
    </div>
    <p class="note">Bu çıktı yalnızca karar desteği sağlar; üretim emri oluşturmaz, üretim planını, vardiyayı, makine planını, stok hareketini veya muhasebe kaydını değiştirmez.</p>
    <h2>Filtrelenmiş Liste</h2>
    <table>
      <thead>
        <tr><th>Öneri No</th><th>Tür</th><th>Üretim Emri</th><th>Ürün</th><th>Reçete</th><th>Hat</th><th>Makine</th><th>Şube</th><th>Başlangıç</th><th>Bitiş</th><th>Risk</th><th>Öncelik</th><th>Confidence</th><th>Kazanç</th><th>Süre</th><th>Etkilenen Emirler</th><th>Tarih</th></tr>
      </thead>
      <tbody>
        ${report.items.slice(0, 160).map(item => `
          <tr>
            <td>${escapeHtml(item.recommendationNo)}</td>
            <td>${escapeHtml(PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS[item.recommendationType])}</td>
            <td>${escapeHtml(item.workOrderNo || '-')}</td>
            <td>${escapeHtml(item.productName || '-')}</td>
            <td>${escapeHtml(item.recipeName || '-')}</td>
            <td>${escapeHtml(item.productionLineName || '-')}</td>
            <td>${escapeHtml(getMachineText(item))}</td>
            <td>${escapeHtml(item.branchName || '-')}</td>
            <td>${escapeHtml(formatDateTime(item.plannedStartAt))}</td>
            <td>${escapeHtml(formatDateTime(item.plannedEndAt))}</td>
            <td>${escapeHtml(PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS[item.risk])}</td>
            <td>${escapeHtml(PRODUCTION_PLANNING_RECOMMENDATION_PRIORITY_LABELS[item.priority])}</td>
            <td>${escapeHtml(formatNumber(item.confidenceScore, 1))}</td>
            <td>${escapeHtml(item.expectedGain)}</td>
            <td>${escapeHtml(`${formatNumber(item.expectedTimeGainMinutes, 0)} dk`)}</td>
            <td>${escapeHtml(joinNames(item.affectedWorkOrders) || '-')}</td>
            <td>${escapeHtml(formatDateTime(item.createdAt))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h2>Analiz Detayları</h2>
    <table>
      <thead><tr><th>Öneri No</th><th>Gerekçe</th><th>Analiz Sonucu</th><th>Risk Açıklaması</th><th>Etkilenen Makineler</th><th>Etkilenen Personel</th><th>Alternatifler</th></tr></thead>
      <tbody>
        ${report.items.slice(0, 42).map(item => `
          <tr>
            <td>${escapeHtml(item.recommendationNo)}</td>
            <td>${escapeHtml(item.reason)}</td>
            <td>${escapeHtml(item.analysisResult || item.action)}</td>
            <td>${escapeHtml(item.riskExplanation || '-')}</td>
            <td>${escapeHtml(joinNames(item.affectedMachines) || '-')}</td>
            <td>${escapeHtml(joinNames(item.affectedPersonnel) || '-')}</td>
            <td>${escapeHtml([
              item.alternativeLines.map(option => option.name).join(', '),
              item.alternativeMachines.map(option => option.name).join(', ')
            ].filter(Boolean).join(' / ') || '-')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  <script>window.addEventListener('load', () => window.print())</script>
</body>
</html>`

export const openProductionPlanningRecommendationPrintWindow = (
  report: ProductionPlanningRecommendationReport,
  mode: ProductionPlanningRecommendationPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'width=1280,height=860')
  if(!printWindow) throw new Error('Çıktı penceresi açılamadı.')
  printWindow.document.open()
  printWindow.document.write(createProductionPlanningRecommendationPrintHtml(report, mode))
  printWindow.document.close()
}

export const ProductionPlanningRecommendationPrintService = {
  createHtml: createProductionPlanningRecommendationPrintHtml,
  openPrintWindow: openProductionPlanningRecommendationPrintWindow
}
