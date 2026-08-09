import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import {
  PURCHASE_RECOMMENDATION_PRIORITY_LABELS,
  PURCHASE_RECOMMENDATION_RISK_LABELS,
  PURCHASE_RECOMMENDATION_STATUS_LABELS,
  PURCHASE_RECOMMENDATION_TYPE_LABELS
} from './purchase-recommendation.constants'
import type {
  PurchaseRecommendationItem,
  PurchaseRecommendationPrintMode,
  PurchaseRecommendationReport
} from './purchase-recommendation.types'

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

const formatCurrency = (value: number) => (
  value.toLocaleString('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0
  })
)

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

const getSupplierText = (item: PurchaseRecommendationItem) => (
  item.supplierName
  || item.alternativeSupplierName
  || item.alternativeSuppliers.map(option => option.supplierName).join(', ')
  || '-'
)

export const createPurchaseRecommendationPrintHtml = (
  report: PurchaseRecommendationReport,
  mode: PurchaseRecommendationPrintMode = 'A4'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.reportNo)} Satın Alma Önerileri</title>
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:${PRINT_SPACING_VALUES.space24}; color:#111827; font-family:Inter, Arial, sans-serif; background:#f8fafc; }
    .sheet { max-width:1220px; margin:0 auto; padding:${PRINT_SPACING_VALUES.space24}; border:1px solid #d1d5db; border-radius:8px; background:#fff; }
    .header { display:flex; justify-content:space-between; gap:${PRINT_SPACING_VALUES.space16}; align-items:flex-start; border-bottom:2px solid #111827; padding-bottom:${PRINT_SPACING_VALUES.space16}; margin-bottom:${PRINT_SPACING_VALUES.space16}; }
    h1 { margin:0; font-size:22px; line-height:1.2; }
    h2 { margin:${PRINT_SPACING_VALUES.space20} 0 ${PRINT_SPACING_VALUES.space8}; font-size:16px; }
    .muted { color:#64748b; font-size:12px; font-weight:700; }
    .pill { display:inline-block; border:1px solid #d1d5db; border-radius:999px; padding:${PRINT_SPACING_VALUES.space4} ${PRINT_SPACING_VALUES.space8}; font-size:12px; font-weight:800; }
    .grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:${PRINT_SPACING_VALUES.space8}; }
    .box { min-width:0; border:1px solid #e5e7eb; border-radius:6px; padding:${PRINT_SPACING_VALUES.space8} ${PRINT_SPACING_VALUES.space8}; background:#f9fafb; }
    .box span { display:block; color:#64748b; font-size:11px; font-weight:800; }
    .box strong { display:block; margin-top:${PRINT_SPACING_VALUES.space4}; color:#111827; font-size:13px; overflow-wrap:anywhere; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th, td { border:1px solid #e5e7eb; padding:${PRINT_SPACING_VALUES.space8}; text-align:left; vertical-align:top; }
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
        <span class="muted">Satın Alma Öneri Motoru</span>
        <h1>${escapeHtml(report.reportNo)} - Satın Alma Önerileri</h1>
        <div class="muted">${escapeHtml(formatDate(report.reportDate))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazırlık' : PURCHASE_RECOMMENDATION_STATUS_LABELS[report.status])}</span>
    </div>
    <div class="grid">
      <div class="box"><span>Rapor Tarihi</span><strong>${escapeHtml(formatDate(report.reportDate))}</strong></div>
      <div class="box"><span>Kapsam</span><strong>${escapeHtml(report.scope === 'all' ? 'Tüm Öneriler' : PURCHASE_RECOMMENDATION_TYPE_LABELS[report.scope])}</strong></div>
      <div class="box"><span>Öneri Sayısı</span><strong>${escapeHtml(report.items.length)}</strong></div>
      <div class="box"><span>Sorumlu</span><strong>${escapeHtml(report.responsiblePerson)}</strong></div>
    </div>
    <p class="note">Bu çıktı yalnızca karar desteği sağlar; satın alma talebi, satın alma siparişi, stok hareketi veya muhasebe kaydı oluşturmaz.</p>
    <h2>Öneri Listesi</h2>
    <table>
      <thead>
        <tr><th>Öneri No</th><th>Tür</th><th>Ürün</th><th>Depo</th><th>Şube</th><th>Tedarikçi</th><th>Miktar</th><th>Risk</th><th>Öncelik</th><th>Confidence</th><th>Tasarruf</th><th>Tarih</th></tr>
      </thead>
      <tbody>
        ${report.items.slice(0, 120).map(item => `
          <tr>
            <td>${escapeHtml(item.recommendationNo)}</td>
            <td>${escapeHtml(PURCHASE_RECOMMENDATION_TYPE_LABELS[item.recommendationType])}</td>
            <td>${escapeHtml(item.stockItemName || item.productName || item.relatedEntityName)}</td>
            <td>${escapeHtml(item.warehouseName || '-')}</td>
            <td>${escapeHtml(item.branchName || '-')}</td>
            <td>${escapeHtml(getSupplierText(item))}</td>
            <td>${escapeHtml(formatNumber(item.recommendedOrderQuantity, 2))}</td>
            <td>${escapeHtml(PURCHASE_RECOMMENDATION_RISK_LABELS[item.risk])}</td>
            <td>${escapeHtml(PURCHASE_RECOMMENDATION_PRIORITY_LABELS[item.priority])}</td>
            <td>${escapeHtml(formatNumber(item.confidenceScore, 1))}</td>
            <td>${escapeHtml(formatCurrency(item.expectedSaving))}</td>
            <td>${escapeHtml(formatDateTime(item.createdAt))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h2>Analiz Detayları</h2>
    <table>
      <thead><tr><th>Öneri No</th><th>Gerekçe</th><th>Analiz Sonucu</th><th>Risk Açıklaması</th><th>Etkilenen Üretim / Reçete</th><th>Alternatif Tedarikçiler</th></tr></thead>
      <tbody>
        ${report.items.slice(0, 36).map(item => `
          <tr>
            <td>${escapeHtml(item.recommendationNo)}</td>
            <td>${escapeHtml(item.reason)}</td>
            <td>${escapeHtml(item.analysisResult || item.action)}</td>
            <td>${escapeHtml(item.riskExplanation || item.lotRiskSummary || '-')}</td>
            <td>${escapeHtml([joinNames(item.affectedProductionOrders), joinNames(item.affectedRecipes)].filter(Boolean).join(' / ') || '-')}</td>
            <td>${escapeHtml(item.alternativeSuppliers.map(option => `${option.supplierName} ${formatNumber(option.savingPercent, 1)}%`).join(', ') || item.alternativeSupplierName || '-')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h2>İşlem Geçmişi</h2>
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

export const openPurchaseRecommendationPrintWindow = (
  report: PurchaseRecommendationReport,
  mode: PurchaseRecommendationPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'width=1220,height=840')
  if(!printWindow) throw new Error('Çıktı penceresi açılamadı.')
  printWindow.document.open()
  printWindow.document.write(createPurchaseRecommendationPrintHtml(report, mode))
  printWindow.document.close()
}

export const PurchaseRecommendationPrintService = {
  createHtml: createPurchaseRecommendationPrintHtml,
  openPrintWindow: openPurchaseRecommendationPrintWindow
}
