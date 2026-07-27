import {
  QUALITY_FORM_STATUS_LABELS,
  QUALITY_FORM_TYPE_LABELS,
  QUALITY_INSPECTION_RESULT_LABELS,
  QUALITY_STATUS_LABELS
} from './quality-form.service'
import type {
  QualityForm,
  QualityFormPrintMode
} from './quality-form.types'

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export const createQualityFormPrintHtml = (
  form: QualityForm,
  mode: QualityFormPrintMode = 'A4'
) => {
  const title = mode === 'PDF' ? 'Quality Form PDF' : 'Quality Form A4'

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(form.formNo)} - ${title}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
    .header { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: start; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 14px; }
    h1 { margin: 0; font-size: 24px; line-height: 1.15; letter-spacing: 0; }
    h2 { margin: 0 0 8px; font-size: 14px; }
    .muted { color: #6b7280; }
    .badge { display: inline-block; border: 1px solid #111827; border-radius: 4px; padding: 5px 8px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
    .box { border: 1px solid #d1d5db; border-radius: 4px; padding: 8px; min-height: 54px; }
    .box span { display: block; color: #6b7280; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .box strong { display: block; margin-top: 4px; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; }
    .signature { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 28px; }
    .signature div { min-height: 72px; border-top: 1px solid #111827; padding-top: 6px; text-align: center; font-weight: 700; }
    @media print { .no-print { display: none; } body { print-color-adjust: exact; } }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="position:fixed;right:16px;top:16px;padding:8px 12px;font-weight:700;">Yazdir</button>
  <main>
    <section class="header">
      <div>
        <h1>KALITE FORMU</h1>
        <p class="muted">Industrial Kitchen ERP Quality Forms</p>
      </div>
      <div><span class="badge">${escapeHtml(form.formNo)}</span></div>
    </section>

    <section class="grid">
      <div class="box"><span>Form Turu</span><strong>${escapeHtml(QUALITY_FORM_TYPE_LABELS[form.formType])}</strong></div>
      <div class="box"><span>Durum</span><strong>${escapeHtml(QUALITY_FORM_STATUS_LABELS[form.status])}</strong></div>
      <div class="box"><span>Sonuc</span><strong>${escapeHtml(QUALITY_INSPECTION_RESULT_LABELS[form.result])}</strong></div>
      <div class="box"><span>Urun</span><strong>${escapeHtml(form.productName || form.stockItemName)}</strong></div>
      <div class="box"><span>Lot / Batch</span><strong>${escapeHtml(form.lotNo)} / ${escapeHtml(form.batchNo || '-')}</strong></div>
      <div class="box"><span>Supplier</span><strong>${escapeHtml(form.supplierName || '-')}</strong></div>
      <div class="box"><span>Depo / Sube</span><strong>${escapeHtml(form.warehouseName)} / ${escapeHtml(form.branchName)}</strong></div>
      <div class="box"><span>Kontrol Tarihi</span><strong>${escapeHtml(formatDate(form.inspectionDate))}</strong></div>
      <div class="box"><span>Kontrol Personeli</span><strong>${escapeHtml(form.inspector)}</strong></div>
    </section>

    <section>
      <h2>Kontrol Kriterleri</h2>
      <table>
        <thead>
          <tr>
            <th>Kriter</th>
            <th>Limit</th>
            <th>Deger</th>
            <th>Durum</th>
            <th>Not</th>
          </tr>
        </thead>
        <tbody>
          ${form.inspections.map(inspection => `
            <tr>
              <td>${escapeHtml(inspection.label)}</td>
              <td>${escapeHtml(inspection.unit || '-')}</td>
              <td>${escapeHtml(inspection.value || '-')}</td>
              <td>${escapeHtml(QUALITY_STATUS_LABELS[inspection.status])}</td>
              <td>${escapeHtml(inspection.notes || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    <section class="grid" style="margin-top:12px;">
      <div class="box"><span>Recipe</span><strong>${escapeHtml(form.recipeName || '-')}</strong></div>
      <div class="box"><span>HACCP</span><strong>${escapeHtml(form.haccpReference || '-')}</strong></div>
      <div class="box"><span>Skor</span><strong>${escapeHtml(form.score)}</strong></div>
    </section>

    <section class="box" style="margin-top:12px;">
      <span>Decision</span>
      <strong>${escapeHtml(form.decision.summary)}</strong>
    </section>

    <section class="signature">
      <div>Kontrol Eden</div>
      <div>Kalite Onay</div>
      <div>Operasyon</div>
    </section>
  </main>
</body>
</html>`
}

export const openQualityFormPrintWindow = (
  form: QualityForm,
  mode: QualityFormPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return false
  const printWindow = window.open('', '_blank', 'width=920,height=1200')
  if(!printWindow) return false
  printWindow.document.open()
  printWindow.document.write(createQualityFormPrintHtml(form, mode))
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => printWindow.print(), 350)
  return true
}

export const QualityFormPrintService = {
  createHtml: createQualityFormPrintHtml,
  openPrintWindow: openQualityFormPrintWindow
}
