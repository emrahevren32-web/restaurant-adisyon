import type {
  GoodsReceiptPrintMode,
  GoodsReceiptRecord
} from './goods-receipt.types'

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const formatNumber = (value: number) => value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })

const formatMoney = (value: number) => value.toLocaleString('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2
})

const formatDate = (value: string) => {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export const createGoodsReceiptPrintHtml = (
  record: GoodsReceiptRecord,
  mode: GoodsReceiptPrintMode = 'A4'
) => {
  const totalQuantity = record.items.reduce((total, item) => total + item.receivedQuantity, 0)
  const totalAccepted = record.items.reduce((total, item) => total + item.acceptedQuantity, 0)
  const totalRejected = record.items.reduce((total, item) => total + item.rejectedQuantity, 0)
  const totalNet = record.items.reduce((total, item) => total + (item.netWeight || 0), 0)
  const totalGross = record.items.reduce((total, item) => total + (item.grossWeight || 0), 0)
  const totalCost = record.items.reduce((total, item) => total + (item.totalCost || 0), 0)
  const title = mode === 'PDF' ? 'Goods Receipt PDF' : 'Goods Receipt A4'

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(record.receiptNo)} - ${title}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
    .sheet { width: 100%; min-height: 267mm; }
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
    .summary { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-top: 12px; }
    .signature { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 28px; }
    .signature div { min-height: 72px; border-top: 1px solid #111827; padding-top: 6px; text-align: center; font-weight: 700; }
    @media print { .no-print { display: none; } body { print-color-adjust: exact; } }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="position:fixed;right:16px;top:16px;padding:8px 12px;font-weight:700;">Yazdir</button>
  <main class="sheet">
    <section class="header">
      <div>
        <h1>MAL KABUL</h1>
        <p class="muted">Industrial Kitchen ERP Goods Receipt</p>
      </div>
      <div><span class="badge">${escapeHtml(record.receiptNo)}</span></div>
    </section>

    <section class="grid">
      <div class="box"><span>Tarih</span><strong>${escapeHtml(formatDate(record.receiptDate))}</strong></div>
      <div class="box"><span>Durum</span><strong>${escapeHtml(record.status)}</strong></div>
      <div class="box"><span>Purchase Order</span><strong>${escapeHtml(record.purchaseOrderNo || record.purchaseOrderId)}</strong></div>
      <div class="box"><span>Supplier</span><strong>${escapeHtml(record.supplierName || record.supplierId)}</strong></div>
      <div class="box"><span>Depo</span><strong>${escapeHtml(record.warehouseName || record.warehouseId)}</strong></div>
      <div class="box"><span>Arac</span><strong>${escapeHtml(record.vehiclePlate || '-')}</strong></div>
      <div class="box"><span>Teslim Eden</span><strong>${escapeHtml(record.deliveredBy || '-')}</strong></div>
      <div class="box"><span>Teslim Alan</span><strong>${escapeHtml(record.receivedByName || record.receivedBy)}</strong></div>
      <div class="box"><span>HACCP</span><strong>${escapeHtml(record.inspection?.haccpTemperatureRecord || '-')}</strong></div>
    </section>

    <section>
      <h2>Urunler</h2>
      <table>
        <thead>
          <tr>
            <th>Urun</th>
            <th>Lot / Batch</th>
            <th class="num">Miktar</th>
            <th>Birim</th>
            <th class="num">Kabul</th>
            <th class="num">Red</th>
            <th class="num">Net</th>
            <th class="num">Brut</th>
            <th class="num">Cost</th>
          </tr>
        </thead>
        <tbody>
          ${record.items.map(item => `
            <tr>
              <td>${escapeHtml(item.productName || item.stockItemName || item.stockItemId)}<br><span class="muted">${escapeHtml(item.packageType || '-')}</span></td>
              <td>${escapeHtml(item.lotNo || item.lotId || '-')}<br><span class="muted">${escapeHtml(item.batchNo || '-')}</span></td>
              <td class="num">${escapeHtml(formatNumber(item.receivedQuantity))}</td>
              <td>${escapeHtml(item.unit)}</td>
              <td class="num">${escapeHtml(formatNumber(item.acceptedQuantity))}</td>
              <td class="num">${escapeHtml(formatNumber(item.rejectedQuantity))}</td>
              <td class="num">${escapeHtml(formatNumber(item.netWeight || 0))} kg</td>
              <td class="num">${escapeHtml(formatNumber(item.grossWeight || 0))} kg</td>
              <td class="num">${escapeHtml(formatMoney(item.totalCost || 0))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    <section class="summary">
      <div class="box"><span>Miktar</span><strong>${escapeHtml(formatNumber(totalQuantity))}</strong></div>
      <div class="box"><span>Kabul</span><strong>${escapeHtml(formatNumber(totalAccepted))}</strong></div>
      <div class="box"><span>Red</span><strong>${escapeHtml(formatNumber(totalRejected))}</strong></div>
      <div class="box"><span>Net</span><strong>${escapeHtml(formatNumber(totalNet))} kg</strong></div>
      <div class="box"><span>Brut</span><strong>${escapeHtml(formatNumber(totalGross))} kg</strong></div>
      <div class="box"><span>Cost Engine</span><strong>${escapeHtml(formatMoney(totalCost))}</strong></div>
    </section>

    <section class="box" style="margin-top:12px;">
      <span>Inspection</span>
      <strong>${escapeHtml(record.inspection?.result || '-')} - ${escapeHtml(record.inspection?.correctiveActionNote || record.inspection?.notes || '-')}</strong>
    </section>

    <section class="signature">
      <div>Teslim Eden</div>
      <div>Mal Kabul</div>
      <div>Kalite</div>
    </section>
  </main>
</body>
</html>`
}

export const openGoodsReceiptPrintWindow = (
  record: GoodsReceiptRecord,
  mode: GoodsReceiptPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return false
  const printWindow = window.open('', '_blank', 'width=920,height=1200')
  if(!printWindow) return false
  printWindow.document.open()
  printWindow.document.write(createGoodsReceiptPrintHtml(record, mode))
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => printWindow.print(), 350)
  return true
}

export const GoodsReceiptPrintService = {
  createHtml: createGoodsReceiptPrintHtml,
  openPrintWindow: openGoodsReceiptPrintWindow
}
