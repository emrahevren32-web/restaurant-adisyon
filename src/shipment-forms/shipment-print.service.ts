import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import {
  SHIPMENT_CHECKLIST_STATUS_LABELS,
  SHIPMENT_FORM_STATUS_LABELS,
  SHIPMENT_FORM_TYPE_LABELS
} from './shipment-form.service'
import { SHIPMENT_TEMPERATURE_STAGE_LABELS } from './shipment-checklist.service'
import type {
  ShipmentForm,
  ShipmentFormPrintMode
} from './shipment-form.types'

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const formatNumber = (value: number) => value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export const createShipmentFormPrintHtml = (
  form: ShipmentForm,
  mode: ShipmentFormPrintMode = 'A4'
) => {
  const title = mode === 'PDF' ? 'Shipment Form PDF' : 'Shipment Form A4'

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(form.formNo)} - ${title}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
    .header { display: grid; grid-template-columns: 1fr auto; gap: ${PRINT_SPACING_VALUES.space16}; align-items: start; border-bottom: 2px solid #111827; padding-bottom: ${PRINT_SPACING_VALUES.space12}; margin-bottom: ${PRINT_SPACING_VALUES.space12}; }
    h1 { margin: 0; font-size: 24px; line-height: 1.15; letter-spacing: 0; }
    h2 { margin: 0 0 ${PRINT_SPACING_VALUES.space8}; font-size: 14px; }
    .muted { color: #6b7280; }
    .badge { display: inline-block; border: 1px solid #111827; border-radius: 4px; padding: ${PRINT_SPACING_VALUES.space4} ${PRINT_SPACING_VALUES.space8}; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: ${PRINT_SPACING_VALUES.space8}; margin-bottom: ${PRINT_SPACING_VALUES.space12}; }
    .box { border: 1px solid #d1d5db; border-radius: 4px; padding: ${PRINT_SPACING_VALUES.space8}; min-height: 54px; }
    .box span { display: block; color: #6b7280; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .box strong { display: block; margin-top: ${PRINT_SPACING_VALUES.space4}; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; margin-top: ${PRINT_SPACING_VALUES.space8}; }
    th, td { border: 1px solid #d1d5db; padding: ${PRINT_SPACING_VALUES.space4}; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; }
    td.num, th.num { text-align: right; }
    .signature { display: grid; grid-template-columns: repeat(3, 1fr); gap: ${PRINT_SPACING_VALUES.space16}; margin-top: ${PRINT_SPACING_VALUES.space24}; }
    .signature div { min-height: 72px; border-top: 1px solid #111827; padding-top: ${PRINT_SPACING_VALUES.space4}; text-align: center; font-weight: 700; }
    @media print { .no-print { display: none; } body { print-color-adjust: exact; } }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="position:fixed;right:16px;top:16px;padding:${PRINT_SPACING_VALUES.space8} ${PRINT_SPACING_VALUES.space12};font-weight:700;">Yazdir</button>
  <main>
    <section class="header">
      <div>
        <h1>SEVKIYAT FORMU</h1>
        <p class="muted">Industrial Kitchen ERP Shipment Forms</p>
      </div>
      <div><span class="badge">${escapeHtml(form.formNo)}</span></div>
    </section>

    <section class="grid">
      <div class="box"><span>Form Turu</span><strong>${escapeHtml(SHIPMENT_FORM_TYPE_LABELS[form.formType])}</strong></div>
      <div class="box"><span>Durum</span><strong>${escapeHtml(SHIPMENT_FORM_STATUS_LABELS[form.status])}</strong></div>
      <div class="box"><span>Sevkiyat / Irsaliye</span><strong>${escapeHtml(form.shipmentNo || '-')} / ${escapeHtml(form.deliveryNoteNo || '-')}</strong></div>
      <div class="box"><span>Arac</span><strong>${escapeHtml(`${form.vehicleNo} ${form.vehiclePlate}`.trim())}</strong></div>
      <div class="box"><span>Sofor</span><strong>${escapeHtml(form.driverName)}</strong></div>
      <div class="box"><span>Musteri</span><strong>${escapeHtml(form.customerName || '-')}</strong></div>
      <div class="box"><span>Depo / Sube</span><strong>${escapeHtml(form.warehouseName)} / ${escapeHtml(form.branchName)}</strong></div>
      <div class="box"><span>Yukleme</span><strong>${escapeHtml(formatDate(form.loadingDate))}</strong></div>
      <div class="box"><span>Teslim</span><strong>${escapeHtml(formatDate(form.deliveryDate))}</strong></div>
    </section>

    <section>
      <h2>Urunler</h2>
      <table>
        <thead>
          <tr>
            <th>Urun</th>
            <th>Lot / Etiket</th>
            <th class="num">Miktar</th>
            <th>Birim</th>
            <th class="num">Koli</th>
            <th class="num">Palet</th>
          </tr>
        </thead>
        <tbody>
          ${form.items.map(item => `
            <tr>
              <td>${escapeHtml(item.productName || item.stockItemName)}</td>
              <td>${escapeHtml(item.lotNo)}<br><span class="muted">${escapeHtml(item.labelNo || '-')}</span></td>
              <td class="num">${escapeHtml(formatNumber(item.quantity))}</td>
              <td>${escapeHtml(item.unit)}</td>
              <td class="num">${escapeHtml(formatNumber(item.boxCount))}</td>
              <td class="num">${escapeHtml(formatNumber(item.palletCount))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    <section>
      <h2 style="margin-top:${PRINT_SPACING_VALUES.space12};">Checklist</h2>
      <table>
        <thead><tr><th>Kriter</th><th>Durum</th><th>Not</th></tr></thead>
        <tbody>
          ${form.checklist.map(item => `
            <tr>
              <td>${escapeHtml(item.label)}</td>
              <td>${escapeHtml(SHIPMENT_CHECKLIST_STATUS_LABELS[item.status])}</td>
              <td>${escapeHtml(item.notes || item.description)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    <section>
      <h2 style="margin-top:${PRINT_SPACING_VALUES.space12};">Sicaklik Kayitlari</h2>
      <table>
        <thead><tr><th>Asama</th><th class="num">Sicaklik C</th><th>Durum</th><th>Not</th></tr></thead>
        <tbody>
          ${form.temperatureLogs.map(log => `
            <tr>
              <td>${escapeHtml(SHIPMENT_TEMPERATURE_STAGE_LABELS[log.stage])}</td>
              <td class="num">${escapeHtml(formatNumber(log.temperatureC))}</td>
              <td>${escapeHtml(SHIPMENT_CHECKLIST_STATUS_LABELS[log.result])}</td>
              <td>${escapeHtml(log.notes)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    <section class="box" style="margin-top:${PRINT_SPACING_VALUES.space12};">
      <span>Aciklama</span>
      <strong>${escapeHtml(form.description || '-')}</strong>
    </section>

    <section class="signature">
      <div>Sevkiyat</div>
      <div>Sofor</div>
      <div>Teslim Alan</div>
    </section>
  </main>
</body>
</html>`
}

export const openShipmentFormPrintWindow = (
  form: ShipmentForm,
  mode: ShipmentFormPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return false
  const printWindow = window.open('', '_blank', 'width=920,height=1200')
  if(!printWindow) return false
  printWindow.document.open()
  printWindow.document.write(createShipmentFormPrintHtml(form, mode))
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => printWindow.print(), 350)
  return true
}

export const ShipmentPrintService = {
  createHtml: createShipmentFormPrintHtml,
  openPrintWindow: openShipmentFormPrintWindow
}
