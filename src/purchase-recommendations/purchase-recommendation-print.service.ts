import {
  PURCHASE_RECOMMENDATION_PRIORITY_LABELS,
  PURCHASE_RECOMMENDATION_RISK_LABELS,
  PURCHASE_RECOMMENDATION_STATUS_LABELS,
  PURCHASE_RECOMMENDATION_TYPE_LABELS
} from './purchase-recommendation.constants'
import type {
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

export const createPurchaseRecommendationPrintHtml = (
  report: PurchaseRecommendationReport,
  mode: PurchaseRecommendationPrintMode = 'A4'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.reportNo)} Purchase Recommendation</title>
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
        <span class="muted">Purchase Recommendation Engine</span>
        <h1>${escapeHtml(report.reportNo)} - Satin Alma Onerileri</h1>
        <div class="muted">${escapeHtml(formatDate(report.reportDate))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazirlik' : PURCHASE_RECOMMENDATION_STATUS_LABELS[report.status])}</span>
    </div>
    <div class="grid">
      <div class="box"><span>Rapor Tarihi</span><strong>${escapeHtml(formatDate(report.reportDate))}</strong></div>
      <div class="box"><span>Kapsam</span><strong>${escapeHtml(report.scope === 'all' ? 'Tum Oneriler' : PURCHASE_RECOMMENDATION_TYPE_LABELS[report.scope])}</strong></div>
      <div class="box"><span>Oneri Sayisi</span><strong>${escapeHtml(report.items.length)}</strong></div>
      <div class="box"><span>Sorumlu</span><strong>${escapeHtml(report.responsiblePerson)}</strong></div>
    </div>
    <h2>Oneri Listesi</h2>
    <table>
      <thead><tr><th>Tur</th><th>Urun / Stok</th><th>Supplier</th><th>Miktar</th><th>Risk</th><th>Tasarruf</th><th>Aksiyon</th></tr></thead>
      <tbody>
        ${report.items.slice(0, 36).map(item => `
          <tr>
            <td>${escapeHtml(PURCHASE_RECOMMENDATION_TYPE_LABELS[item.recommendationType])}</td>
            <td>${escapeHtml(item.stockItemName || item.productName || item.relatedEntityName)}<br><span class="muted">${escapeHtml(item.categoryName)}</span></td>
            <td>${escapeHtml(item.supplierName || item.alternativeSupplierName || '-')}</td>
            <td>${escapeHtml(formatNumber(item.recommendedOrderQuantity, 2))}</td>
            <td>${escapeHtml(PURCHASE_RECOMMENDATION_RISK_LABELS[item.risk])} / ${escapeHtml(PURCHASE_RECOMMENDATION_PRIORITY_LABELS[item.priority])}</td>
            <td>${escapeHtml(formatCurrency(item.expectedSaving))}</td>
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

export const openPurchaseRecommendationPrintWindow = (
  report: PurchaseRecommendationReport,
  mode: PurchaseRecommendationPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'width=1120,height=840')
  if(!printWindow) throw new Error('Cikti penceresi acilamadi.')
  printWindow.document.open()
  printWindow.document.write(createPurchaseRecommendationPrintHtml(report, mode))
  printWindow.document.close()
}

export const PurchaseRecommendationPrintService = {
  createHtml: createPurchaseRecommendationPrintHtml,
  openPrintWindow: openPurchaseRecommendationPrintWindow
}
