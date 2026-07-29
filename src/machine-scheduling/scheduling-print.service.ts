import {
  MACHINE_SCHEDULE_ITEM_STATUS_LABELS,
  MACHINE_SCHEDULE_STATUS_LABELS
} from './machine-scheduling.constants'
import type {
  MachineSchedule,
  SchedulingPrintMode
} from './machine-scheduling.types'

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
  schedule: MachineSchedule
) => schedule.items.reduce((total, item) => total + item.totalWorkingMinutes, 0)

const conflictCount = (
  schedule: MachineSchedule
) => schedule.items.filter(item => item.conflict).length

export const createMachineSchedulePrintHtml = (
  schedule: MachineSchedule,
  mode: SchedulingPrintMode = 'A4'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(schedule.scheduleNo)} Machine Scheduling</title>
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
        <span class="muted">Machine Scheduling</span>
        <h1>${escapeHtml(schedule.scheduleNo)}</h1>
        <div class="muted">${escapeHtml(schedule.machineName)} / ${escapeHtml(schedule.productionLineName)}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazirlik' : MACHINE_SCHEDULE_STATUS_LABELS[schedule.status])}</span>
    </div>
    <div class="grid">
      <div class="box"><span>Tarih</span><strong>${escapeHtml(formatDate(schedule.scheduleDate))}</strong></div>
      <div class="box"><span>Aralik</span><strong>${escapeHtml(formatDate(schedule.startDate))} - ${escapeHtml(formatDate(schedule.endDate))}</strong></div>
      <div class="box"><span>Vardiya</span><strong>${escapeHtml(schedule.shift)}</strong></div>
      <div class="box"><span>Sorumlu</span><strong>${escapeHtml(schedule.responsiblePerson)}</strong></div>
      <div class="box"><span>Makine</span><strong>${escapeHtml(schedule.machineCode || 'Tum Makineler')}</strong></div>
      <div class="box"><span>Gorev</span><strong>${escapeHtml(schedule.items.length)}</strong></div>
      <div class="box"><span>Calisma</span><strong>${escapeHtml(formatNumber(totalWorkingMinutes(schedule), 0))} dk</strong></div>
      <div class="box"><span>Cakisma</span><strong>${escapeHtml(conflictCount(schedule))}</strong></div>
    </div>
    <h2>Cizelge Satirlari</h2>
    <table>
      <thead>
        <tr>
          <th>Makine</th>
          <th>Hat / Work Center</th>
          <th>Urun</th>
          <th>Baslangic</th>
          <th>Bitis</th>
          <th>Sure</th>
          <th>Setup / Temizlik</th>
          <th>Durum</th>
        </tr>
      </thead>
      <tbody>
        ${schedule.items.map(item => `
          <tr>
            <td><strong>${escapeHtml(item.machineCode)}</strong><br><span class="muted">${escapeHtml(item.machineName)}</span></td>
            <td>${escapeHtml(item.productionLineName)}<br><span class="muted">${escapeHtml(item.workCenterName)}</span></td>
            <td><strong>${escapeHtml(item.productName)}</strong><br><span class="muted">${escapeHtml(item.recipeName)}</span></td>
            <td>${escapeHtml(formatTime(item.startAt))}</td>
            <td>${escapeHtml(formatTime(item.endAt))}</td>
            <td>${escapeHtml(formatNumber(item.estimatedMinutes, 0))} dk</td>
            <td>${escapeHtml(formatNumber(item.setupMinutes, 0))} / ${escapeHtml(formatNumber(item.cleaningMinutes, 0))} dk</td>
            <td>${escapeHtml(MACHINE_SCHEDULE_ITEM_STATUS_LABELS[item.status])}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h2>Oneriler</h2>
    <ul>
      ${schedule.recommendations.length > 0
        ? schedule.recommendations.map(item => `<li>${escapeHtml(item)}</li>`).join('')
        : '<li>Oneri bulunmuyor.</li>'}
    </ul>
  </div>
  <script>
    window.addEventListener('load', () => window.print())
  </script>
</body>
</html>`

export const openMachineSchedulePrintWindow = (
  schedule: MachineSchedule,
  mode: SchedulingPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'width=1120,height=820')
  if(!printWindow) throw new Error('Cikti penceresi acilamadi.')
  printWindow.document.open()
  printWindow.document.write(createMachineSchedulePrintHtml(schedule, mode))
  printWindow.document.close()
}

export const SchedulingPrintService = {
  createHtml: createMachineSchedulePrintHtml,
  openPrintWindow: openMachineSchedulePrintWindow
}
