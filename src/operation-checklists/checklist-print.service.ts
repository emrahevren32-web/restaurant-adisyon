import {
  CHECKLIST_ITEM_STATUS_LABELS,
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_TYPE_LABELS
} from './checklist.service'
import type {
  Checklist,
  ChecklistPrintMode
} from './operation-checklist.types'

const escapeHtml = (value: string | number) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

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

export const createChecklistPrintHtml = (
  checklist: Checklist,
  mode: ChecklistPrintMode = 'A4'
) => `
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(checklist.checklistNo)} Operations Checklist</title>
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:24px; color:#111827; font-family:Inter, Arial, sans-serif; background:#f8fafc; }
    .sheet { max-width:960px; margin:0 auto; padding:24px; border:1px solid #d1d5db; border-radius:8px; background:#fff; }
    .header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; border-bottom:2px solid #111827; padding-bottom:16px; margin-bottom:18px; }
    h1 { margin:0; font-size:22px; line-height:1.2; }
    h2 { margin:22px 0 10px; font-size:16px; }
    .muted { color:#64748b; font-size:12px; font-weight:700; }
    .pill { display:inline-block; border:1px solid #d1d5db; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:800; }
    .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; }
    .box { min-width:0; border:1px solid #e5e7eb; border-radius:6px; padding:9px 10px; background:#f9fafb; }
    .box span { display:block; color:#64748b; font-size:11px; font-weight:800; }
    .box strong { display:block; margin-top:4px; color:#111827; font-size:13px; overflow-wrap:anywhere; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th, td { border:1px solid #e5e7eb; padding:8px; text-align:left; vertical-align:top; }
    th { background:#f3f4f6; font-weight:900; }
    .history { display:grid; gap:8px; }
    .history div { border:1px solid #e5e7eb; border-radius:6px; padding:8px; background:#f9fafb; }
    @media print {
      body { background:#fff; padding:0; }
      .sheet { border:0; border-radius:0; max-width:none; }
      .no-print { display:none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <span class="muted">Operations Checklist</span>
        <h1>${escapeHtml(checklist.checklistNo)}</h1>
        <div class="muted">${escapeHtml(CHECKLIST_TYPE_LABELS[checklist.checklistType])} / ${escapeHtml(checklist.templateVersion)}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazirlik' : CHECKLIST_STATUS_LABELS[checklist.status])}</span>
    </div>
    <div class="grid">
      <div class="box"><span>Sube</span><strong>${escapeHtml(checklist.branchName)}</strong></div>
      <div class="box"><span>Depo</span><strong>${escapeHtml(checklist.warehouseName)}</strong></div>
      <div class="box"><span>Departman</span><strong>${escapeHtml(checklist.department)}</strong></div>
      <div class="box"><span>Vardiya</span><strong>${escapeHtml(checklist.shift)}</strong></div>
      <div class="box"><span>Sorumlu</span><strong>${escapeHtml(checklist.responsiblePerson)}</strong></div>
      <div class="box"><span>Kaynak</span><strong>${escapeHtml(checklist.sourceType)} / ${escapeHtml(checklist.sourceNo)}</strong></div>
      <div class="box"><span>Baslangic</span><strong>${escapeHtml(formatDateTime(checklist.startAt))}</strong></div>
      <div class="box"><span>Bitis</span><strong>${escapeHtml(formatDateTime(checklist.endAt))}</strong></div>
      <div class="box"><span>HACCP</span><strong>${escapeHtml(checklist.haccpReference || '-')}</strong></div>
    </div>
    <h2>Checklist Maddeleri</h2>
    <table>
      <thead>
        <tr>
          <th>Kontrol Basligi</th>
          <th>Sonuc</th>
          <th>Not</th>
          <th>Foto Alani</th>
          <th>Duzeltici Faaliyet</th>
        </tr>
      </thead>
      <tbody>
        ${checklist.items.map(item => `
          <tr>
            <td><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${escapeHtml(item.description)}</span></td>
            <td>${escapeHtml(CHECKLIST_ITEM_STATUS_LABELS[item.status])}</td>
            <td>${escapeHtml(item.note || '-')}</td>
            <td>${escapeHtml(item.photoPlaceholder || 'Hazirlik')}</td>
            <td>${escapeHtml(item.correctiveAction || '-')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h2>History</h2>
    <div class="history">
      ${checklist.history.map(history => `
        <div>
          <strong>${escapeHtml(history.action)} - ${escapeHtml(history.actorName)}</strong>
          <span class="muted">${escapeHtml(formatDateTime(history.createdAt))} / Rev ${escapeHtml(history.revisionNo)}</span>
          <p>${escapeHtml(history.description)}</p>
        </div>
      `).join('')}
    </div>
  </div>
  <script>
    window.addEventListener('load', () => window.print())
  </script>
</body>
</html>`

export const openChecklistPrintWindow = (
  checklist: Checklist,
  mode: ChecklistPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'width=1024,height=768')
  if(!printWindow) throw new Error('Cikti penceresi acilamadi.')
  printWindow.document.open()
  printWindow.document.write(createChecklistPrintHtml(checklist, mode))
  printWindow.document.close()
}

export const ChecklistPrintService = {
  createHtml: createChecklistPrintHtml,
  openPrintWindow: openChecklistPrintWindow
}
