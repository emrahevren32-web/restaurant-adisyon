import {
  WASTE_REASON_LABELS,
  WASTE_STATUS_LABELS,
  WASTE_TYPE_LABELS
} from './waste.service'
import type {
  WastePrintMode,
  WasteRecord
} from './waste.types'

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const formatNumber = (value: number) => value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })

const formatMoney = (value: number, currency = 'TRY') => value.toLocaleString('tr-TR', {
  style: 'currency',
  currency,
  maximumFractionDigits: 2
})

const formatDate = (value: string) => {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export const createWastePrintHtml = (
  record: WasteRecord,
  mode: WastePrintMode = 'A4'
) => {
  const title = mode === 'PDF' ? 'Waste PDF' : 'Waste A4'

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(record.wasteNo)} - ${title}</title>
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
    td.num, th.num { text-align: right; }
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
        <h1>FIRE YONETIMI</h1>
        <p class="muted">Industrial Kitchen ERP Waste Management</p>
      </div>
      <div><span class="badge">${escapeHtml(record.wasteNo)}</span></div>
    </section>

    <section class="grid">
      <div class="box"><span>Tarih</span><strong>${escapeHtml(formatDate(record.date))}</strong></div>
      <div class="box"><span>Durum</span><strong>${escapeHtml(WASTE_STATUS_LABELS[record.status])}</strong></div>
      <div class="box"><span>Fire Turu</span><strong>${escapeHtml(WASTE_TYPE_LABELS[record.wasteType])}</strong></div>
      <div class="box"><span>Neden</span><strong>${escapeHtml(WASTE_REASON_LABELS[record.wasteReason])}</strong></div>
      <div class="box"><span>Urun</span><strong>${escapeHtml(record.productName || record.stockItemName)}</strong></div>
      <div class="box"><span>Lot</span><strong>${escapeHtml(record.lotNo)}</strong></div>
      <div class="box"><span>Depo</span><strong>${escapeHtml(record.warehouseName)}</strong></div>
      <div class="box"><span>Sube</span><strong>${escapeHtml(record.branchName)}</strong></div>
      <div class="box"><span>Uretim Emri</span><strong>${escapeHtml(record.productionOrderNo || '-')}</strong></div>
    </section>

    <section>
      <h2>Kalemler</h2>
      <table>
        <thead>
          <tr>
            <th>Urun</th>
            <th>Lot / Batch</th>
            <th class="num">Miktar</th>
            <th>Birim</th>
            <th class="num">Birim Cost</th>
            <th class="num">Toplam Cost</th>
          </tr>
        </thead>
        <tbody>
          ${record.items.map(item => `
            <tr>
              <td>${escapeHtml(item.productName || item.stockItemName)}</td>
              <td>${escapeHtml(item.lotNo)}<br><span class="muted">${escapeHtml(item.batchNo || '-')}</span></td>
              <td class="num">${escapeHtml(formatNumber(item.quantity))}</td>
              <td>${escapeHtml(item.unit)}</td>
              <td class="num">${escapeHtml(formatMoney(item.unitCost, record.currency))}</td>
              <td class="num">${escapeHtml(formatMoney(item.totalCost, record.currency))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    <section class="grid" style="margin-top:12px;">
      <div class="box"><span>Kalite Karari</span><strong>${escapeHtml(record.qualityDecision || '-')}</strong></div>
      <div class="box"><span>HACCP</span><strong>${escapeHtml(record.haccpReference || '-')}</strong></div>
      <div class="box"><span>Duzeltici Faaliyet</span><strong>${escapeHtml(record.correctiveAction || '-')}</strong></div>
    </section>

    <section class="box" style="margin-top:12px;">
      <span>Aciklama</span>
      <strong>${escapeHtml(record.description || '-')}</strong>
    </section>

    <section class="signature">
      <div>Kaydi Olusturan</div>
      <div>Kalite</div>
      <div>Operasyon</div>
    </section>
  </main>
</body>
</html>`
}

export const openWastePrintWindow = (
  record: WasteRecord,
  mode: WastePrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return false
  const printWindow = window.open('', '_blank', 'width=920,height=1200')
  if(!printWindow) return false
  printWindow.document.open()
  printWindow.document.write(createWastePrintHtml(record, mode))
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => printWindow.print(), 350)
  return true
}

export const WastePrintService = {
  createHtml: createWastePrintHtml,
  openPrintWindow: openWastePrintWindow
}
