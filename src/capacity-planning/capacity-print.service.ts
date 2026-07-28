import {
  CAPACITY_PLAN_STATUS_LABELS,
  CAPACITY_RISK_LABELS
} from './capacity-planning.constants'
import type {
  CapacityPlan,
  CapacityPrintMode
} from './capacity-planning.types'

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

const formatPercent = (value: number) => `${formatNumber(value, 1)}%`

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const totalLoad = (plan: CapacityPlan) => plan.productionCapacities.reduce((total, item) => total + item.totalLoadMinutes, 0)
const totalAvailable = (plan: CapacityPlan) => plan.productionCapacities.reduce((total, item) => total + item.availableMinutes, 0)
const bottlenecks = (plan: CapacityPlan) => plan.productionCapacities.filter(item => item.bottleneck).length

export const createCapacityPrintHtml = (
  plan: CapacityPlan,
  mode: CapacityPrintMode = 'A4'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(plan.capacityPlanNo)} Capacity Planning</title>
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
        <span class="muted">Capacity Planning</span>
        <h1>${escapeHtml(plan.capacityPlanNo)}</h1>
        <div class="muted">${escapeHtml(plan.productionLineName)} / ${escapeHtml(plan.workCenterName)}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazirlik' : CAPACITY_PLAN_STATUS_LABELS[plan.status])}</span>
    </div>
    <div class="grid">
      <div class="box"><span>Plan Tarihi</span><strong>${escapeHtml(formatDate(plan.planDate))}</strong></div>
      <div class="box"><span>Baslangic / Bitis</span><strong>${escapeHtml(formatDate(plan.startDate))} - ${escapeHtml(formatDate(plan.endDate))}</strong></div>
      <div class="box"><span>Vardiya</span><strong>${escapeHtml(plan.shift)}</strong></div>
      <div class="box"><span>Sorumlu</span><strong>${escapeHtml(plan.responsiblePerson)}</strong></div>
      <div class="box"><span>Kullanilabilir</span><strong>${escapeHtml(formatNumber(totalAvailable(plan), 0))} dk</strong></div>
      <div class="box"><span>Toplam Yuk</span><strong>${escapeHtml(formatNumber(totalLoad(plan), 0))} dk</strong></div>
      <div class="box"><span>Doluluk</span><strong>${escapeHtml(formatPercent(totalAvailable(plan) > 0 ? totalLoad(plan) / totalAvailable(plan) * 100 : 0))}</strong></div>
      <div class="box"><span>Darbogaz</span><strong>${escapeHtml(bottlenecks(plan))}</strong></div>
    </div>
    <h2>Hat Analizi</h2>
    <table>
      <thead>
        <tr>
          <th>Hat</th>
          <th>Work Center</th>
          <th>Makine</th>
          <th>Kullanilabilir</th>
          <th>Yuk</th>
          <th>Bos / Asiri</th>
          <th>Doluluk</th>
          <th>Risk</th>
        </tr>
      </thead>
      <tbody>
        ${plan.productionCapacities.map(capacity => `
          <tr>
            <td><strong>${escapeHtml(capacity.productionLineName)}</strong><br><span class="muted">${escapeHtml(capacity.lineStatus)}</span></td>
            <td>${escapeHtml(capacity.workCenterName)}</td>
            <td>${escapeHtml(capacity.machineCount)}</td>
            <td>${escapeHtml(formatNumber(capacity.availableMinutes, 0))} dk</td>
            <td>${escapeHtml(formatNumber(capacity.totalLoadMinutes, 0))} dk</td>
            <td>${escapeHtml(formatNumber(capacity.idleMinutes, 0))} / ${escapeHtml(formatNumber(capacity.overloadMinutes, 0))} dk</td>
            <td>${escapeHtml(formatPercent(capacity.utilizationPercent))}</td>
            <td>${escapeHtml(CAPACITY_RISK_LABELS[capacity.riskLevel])}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h2>Oneriler</h2>
    <ul>
      ${plan.recommendations.length > 0
        ? plan.recommendations.map(item => `<li>${escapeHtml(item)}</li>`).join('')
        : '<li>Oneri bulunmuyor.</li>'}
    </ul>
  </div>
  <script>
    window.addEventListener('load', () => window.print())
  </script>
</body>
</html>`

export const openCapacityPrintWindow = (
  plan: CapacityPlan,
  mode: CapacityPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'width=1120,height=820')
  if(!printWindow) throw new Error('Cikti penceresi acilamadi.')
  printWindow.document.open()
  printWindow.document.write(createCapacityPrintHtml(plan, mode))
  printWindow.document.close()
}

export const CapacityPrintService = {
  createHtml: createCapacityPrintHtml,
  openPrintWindow: openCapacityPrintWindow
}
