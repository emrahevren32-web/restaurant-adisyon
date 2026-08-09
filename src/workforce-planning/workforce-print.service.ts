import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import {
  WORKFORCE_PLAN_ITEM_STATUS_LABELS,
  WORKFORCE_PLAN_STATUS_LABELS
} from './workforce-planning.constants'
import type {
  WorkforcePlan,
  WorkforcePrintMode
} from './workforce-planning.types'

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

const formatTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

const totalWorkingMinutes = (
  plan: WorkforcePlan
) => plan.items.reduce((total, item) => total + item.workingMinutes, 0)

const conflictCount = (
  plan: WorkforcePlan
) => plan.items.filter(item => item.conflict).length

export const createWorkforcePrintHtml = (
  plan: WorkforcePlan,
  mode: WorkforcePrintMode = 'A4'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(plan.planNo)} Workforce Planning</title>
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:${PRINT_SPACING_VALUES.space24}; color:#111827; font-family:Inter, Arial, sans-serif; background:#f8fafc; }
    .sheet { max-width:1120px; margin:0 auto; padding:${PRINT_SPACING_VALUES.space24}; border:1px solid #d1d5db; border-radius:8px; background:#fff; }
    .header { display:flex; justify-content:space-between; gap:${PRINT_SPACING_VALUES.space16}; align-items:flex-start; border-bottom:2px solid #111827; padding-bottom:${PRINT_SPACING_VALUES.space16}; margin-bottom:${PRINT_SPACING_VALUES.space16}; }
    h1 { margin:0; font-size:22px; line-height:1.2; }
    h2 { margin:${PRINT_SPACING_VALUES.space20} 0 ${PRINT_SPACING_VALUES.space8}; font-size:16px; }
    .muted { color:#64748b; font-size:12px; font-weight:700; }
    .pill { display:inline-block; border:1px solid #d1d5db; border-radius:999px; padding:${PRINT_SPACING_VALUES.space4} ${PRINT_SPACING_VALUES.space8}; font-size:12px; font-weight:800; }
    .grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:${PRINT_SPACING_VALUES.space8}; }
    .box { min-width:0; border:1px solid #e5e7eb; border-radius:6px; padding:${PRINT_SPACING_VALUES.space8} ${PRINT_SPACING_VALUES.space8}; background:#f9fafb; }
    .box span { display:block; color:#64748b; font-size:11px; font-weight:800; }
    .box strong { display:block; margin-top:${PRINT_SPACING_VALUES.space4}; color:#111827; font-size:13px; overflow-wrap:anywhere; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th, td { border:1px solid #e5e7eb; padding:${PRINT_SPACING_VALUES.space8}; text-align:left; vertical-align:top; }
    th { background:#f3f4f6; font-weight:900; }
    ul { margin:${PRINT_SPACING_VALUES.space8} 0 0; padding-left:${PRINT_SPACING_VALUES.space16}; }
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
        <span class="muted">Workforce Planning</span>
        <h1>${escapeHtml(plan.planNo)}</h1>
        <div class="muted">${escapeHtml(plan.shiftName)} / ${escapeHtml(plan.department)}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazirlik' : WORKFORCE_PLAN_STATUS_LABELS[plan.status])}</span>
    </div>
    <div class="grid">
      <div class="box"><span>Tarih</span><strong>${escapeHtml(formatDate(plan.planDate))}</strong></div>
      <div class="box"><span>Aralik</span><strong>${escapeHtml(formatDate(plan.startDate))} - ${escapeHtml(formatDate(plan.endDate))}</strong></div>
      <div class="box"><span>Personel</span><strong>${escapeHtml(plan.employeeName)}</strong></div>
      <div class="box"><span>Sorumlu</span><strong>${escapeHtml(plan.responsiblePerson)}</strong></div>
      <div class="box"><span>Gorev</span><strong>${escapeHtml(plan.items.length)}</strong></div>
      <div class="box"><span>Atanan</span><strong>${escapeHtml(plan.employeeAssignments.filter(item => item.assignmentCount > 0).length)}</strong></div>
      <div class="box"><span>Calisma</span><strong>${escapeHtml(formatNumber(totalWorkingMinutes(plan), 0))} dk</strong></div>
      <div class="box"><span>Cakisma</span><strong>${escapeHtml(conflictCount(plan))}</strong></div>
    </div>
    <h2>Personel Plani</h2>
    <table>
      <thead>
        <tr>
          <th>Personel</th>
          <th>Departman / Vardiya</th>
          <th>Makine / Hat</th>
          <th>Gorev</th>
          <th>Baslangic</th>
          <th>Bitis</th>
          <th>Sure</th>
          <th>Durum</th>
        </tr>
      </thead>
      <tbody>
        ${plan.items.map(item => `
          <tr>
            <td><strong>${escapeHtml(item.employeeName)}</strong><br><span class="muted">${escapeHtml(item.employeeCode)}</span></td>
            <td>${escapeHtml(item.department)}<br><span class="muted">${escapeHtml(item.shiftName)}</span></td>
            <td><strong>${escapeHtml(item.machineCode)}</strong><br><span class="muted">${escapeHtml(item.productionLineName)}</span></td>
            <td>${escapeHtml(item.taskName)}</td>
            <td>${escapeHtml(formatTime(item.startAt))}</td>
            <td>${escapeHtml(formatTime(item.endAt))}</td>
            <td>${escapeHtml(formatNumber(item.workingMinutes, 0))} dk</td>
            <td>${escapeHtml(WORKFORCE_PLAN_ITEM_STATUS_LABELS[item.status])}</td>
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

export const openWorkforcePrintWindow = (
  plan: WorkforcePlan,
  mode: WorkforcePrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'width=1120,height=820')
  if(!printWindow) throw new Error('Cikti penceresi acilamadi.')
  printWindow.document.open()
  printWindow.document.write(createWorkforcePrintHtml(plan, mode))
  printWindow.document.close()
}

export const WorkforcePrintService = {
  createHtml: createWorkforcePrintHtml,
  openPrintWindow: openWorkforcePrintWindow
}
