import { PRINT_RADIUS_VALUES } from '../design-system/BorderRadiusTheme'
import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import {
  WASTE_PREDICTION_PRIORITY_LABELS,
  WASTE_PREDICTION_RISK_LABELS,
  WASTE_PREDICTION_STATUS_LABELS,
  WASTE_PREDICTION_TYPE_LABELS
} from './waste-prediction.constants'
import type {
  WastePredictionItem,
  WastePredictionPrintMode,
  WastePredictionReport
} from './waste-prediction.types'

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

const formatCurrency = (
  value: number
) => value.toLocaleString('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0
})

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

const getMachineText = (item: WastePredictionItem) => (
  [item.machineCode, item.machineName].filter(Boolean).join(' / ') || '-'
)

export const createWastePredictionPrintHtml = (
  report: WastePredictionReport,
  mode: WastePredictionPrintMode = 'A4'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.reportNo)} Fire Tahmini</title>
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:${PRINT_SPACING_VALUES.space24}; color:#111827; font-family:Inter, Arial, sans-serif; background:#f8fafc; }
    .sheet { max-width:1280px; margin:0 auto; padding:${PRINT_SPACING_VALUES.space24}; border:1px solid #d1d5db; border-radius:${PRINT_RADIUS_VALUES.card}; background:#fff; }
    .header { display:flex; justify-content:space-between; gap:${PRINT_SPACING_VALUES.space16}; align-items:flex-start; border-bottom:2px solid #111827; padding-bottom:${PRINT_SPACING_VALUES.space16}; margin-bottom:${PRINT_SPACING_VALUES.space16}; }
    h1 { margin:0; font-size:22px; line-height:1.2; }
    h2 { margin:${PRINT_SPACING_VALUES.space20} 0 ${PRINT_SPACING_VALUES.space8}; font-size:16px; }
    .muted { color:#64748b; font-size:12px; font-weight:700; }
    .pill { display:inline-block; border:1px solid #d1d5db; border-radius:${PRINT_RADIUS_VALUES.full}; padding:${PRINT_SPACING_VALUES.space4} ${PRINT_SPACING_VALUES.space8}; font-size:12px; font-weight:800; }
    .grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:${PRINT_SPACING_VALUES.space8}; }
    .box { min-width:0; border:1px solid #e5e7eb; border-radius:${PRINT_RADIUS_VALUES.box}; padding:${PRINT_SPACING_VALUES.space8} ${PRINT_SPACING_VALUES.space8}; background:#f9fafb; }
    .box span { display:block; color:#64748b; font-size:11px; font-weight:800; }
    .box strong { display:block; margin-top:${PRINT_SPACING_VALUES.space4}; color:#111827; font-size:13px; overflow-wrap:anywhere; }
    table { width:100%; border-collapse:collapse; font-size:10.5px; }
    th, td { border:1px solid #e5e7eb; padding:${PRINT_SPACING_VALUES.space8}; text-align:left; vertical-align:top; }
    th { background:#f3f4f6; font-weight:900; }
    .note { color:#334155; font-size:12px; line-height:1.45; }
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
        <span class="muted">Karar Destek Motoru</span>
        <h1>${escapeHtml(report.reportNo)} - Fire Tahmini</h1>
        <div class="muted">${escapeHtml(formatDate(report.reportDate))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazırlık' : WASTE_PREDICTION_STATUS_LABELS[report.status])}</span>
    </div>
    <div class="grid">
      <div class="box"><span>Rapor Tarihi</span><strong>${escapeHtml(formatDate(report.reportDate))}</strong></div>
      <div class="box"><span>Kapsam</span><strong>${escapeHtml(report.scope === 'all' ? 'Tüm Tahminler' : WASTE_PREDICTION_TYPE_LABELS[report.scope])}</strong></div>
      <div class="box"><span>Tahmin Sayısı</span><strong>${escapeHtml(report.items.length)}</strong></div>
      <div class="box"><span>Sorumlu</span><strong>${escapeHtml(report.responsiblePerson)}</strong></div>
    </div>
    <p class="note">Bu çıktı yalnızca tahmin, analiz ve karar desteği sağlar; gerçek fire kaydı, stok düşümü, üretim planı değişikliği, muhasebe kaydı veya kalite kaydı oluşturmaz.</p>
    <h2>Filtrelenmiş Liste</h2>
    <table>
      <thead>
        <tr><th>Öneri No</th><th>Öneri</th><th>Ürün</th><th>Reçete</th><th>Hat</th><th>Makine</th><th>Şube</th><th>Lot</th><th>Fire %</th><th>Fire Kg</th><th>Maliyet</th><th>Risk</th><th>Öncelik</th><th>Confidence</th><th>Risk Nedeni</th><th>Tasarruf</th><th>Tarih</th></tr>
      </thead>
      <tbody>
        ${report.items.slice(0, 180).map(item => `
          <tr>
            <td>${escapeHtml(item.predictionNo)}</td>
            <td>${escapeHtml(WASTE_PREDICTION_TYPE_LABELS[item.predictionType])}</td>
            <td>${escapeHtml(item.productName || '-')}</td>
            <td>${escapeHtml(item.recipeName || '-')}</td>
            <td>${escapeHtml(item.productionLineName || '-')}</td>
            <td>${escapeHtml(getMachineText(item))}</td>
            <td>${escapeHtml(item.branchName || '-')}</td>
            <td>${escapeHtml(item.lotNo || '-')}</td>
            <td>${escapeHtml(formatNumber(item.expectedWastePercent, 1))}</td>
            <td>${escapeHtml(formatNumber(item.expectedWasteKg, 1))}</td>
            <td>${escapeHtml(formatCurrency(item.expectedWasteCost))}</td>
            <td>${escapeHtml(WASTE_PREDICTION_RISK_LABELS[item.risk])}</td>
            <td>${escapeHtml(WASTE_PREDICTION_PRIORITY_LABELS[item.priority])}</td>
            <td>${escapeHtml(formatNumber(item.confidenceScore, 1))}</td>
            <td>${escapeHtml(item.riskReason)}</td>
            <td>${escapeHtml(formatCurrency(item.expectedSaving))}</td>
            <td>${escapeHtml(formatDateTime(item.createdAt))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h2>Analiz Detayları</h2>
    <table>
      <thead><tr><th>Öneri No</th><th>Tahmin Gerekçesi</th><th>Analiz Sonucu</th><th>Risk Açıklaması</th><th>Etkilenen Emirler</th><th>Etkilenen Lotlar</th><th>Alternatifler</th></tr></thead>
      <tbody>
        ${report.items.slice(0, 48).map(item => `
          <tr>
            <td>${escapeHtml(item.predictionNo)}</td>
            <td>${escapeHtml(item.forecastReason)}</td>
            <td>${escapeHtml(item.analysisResult || item.action)}</td>
            <td>${escapeHtml(item.riskExplanation || '-')}</td>
            <td>${escapeHtml(joinNames(item.affectedProductionOrders) || '-')}</td>
            <td>${escapeHtml(joinNames(item.affectedLots) || '-')}</td>
            <td>${escapeHtml([
              item.alternativeRecipes.map(option => option.name).join(', '),
              item.alternativeSuppliers.map(option => option.name).join(', ')
            ].filter(Boolean).join(' / ') || '-')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  <script>window.addEventListener('load', () => window.print())</script>
</body>
</html>`

export const openWastePredictionPrintWindow = (
  report: WastePredictionReport,
  mode: WastePredictionPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'width=1280,height=860')
  if(!printWindow) throw new Error('Çıktı penceresi açılamadı.')
  printWindow.document.open()
  printWindow.document.write(createWastePredictionPrintHtml(report, mode))
  printWindow.document.close()
}

export const WastePredictionPrintService = {
  createHtml: createWastePredictionPrintHtml,
  openPrintWindow: openWastePredictionPrintWindow
}
