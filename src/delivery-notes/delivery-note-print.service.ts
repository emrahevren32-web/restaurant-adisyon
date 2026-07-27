import type {
  DeliveryNote,
  DeliveryNotePrintMode
} from './delivery-note.types'

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

export const createDeliveryNotePrintHtml = (
  record: DeliveryNote,
  mode: DeliveryNotePrintMode = 'A4'
) => {
  const totalQuantity = record.items.reduce((total, item) => total + item.quantity, 0)
  const totalBoxes = record.items.reduce((total, item) => total + item.boxCount, 0)
  const totalPallets = record.items.reduce((total, item) => total + item.palletCount, 0)
  const totalNet = record.items.reduce((total, item) => total + item.netWeight, 0)
  const totalGross = record.items.reduce((total, item) => total + item.grossWeight, 0)
  const totalCost = record.items.reduce((total, item) => total + item.totalCost, 0)
  const title = mode === 'PDF' ? 'Delivery Note PDF' : 'Delivery Note A4'

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(record.deliveryNoteNo)} - ${title}</title>
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
        <h1>IRSALIYE</h1>
        <p class="muted">Industrial Kitchen ERP Delivery Note</p>
      </div>
      <div>
        <span class="badge">${escapeHtml(record.deliveryNoteNo)}</span>
      </div>
    </section>

    <section class="grid">
      <div class="box"><span>Tarih</span><strong>${escapeHtml(formatDate(record.date))}</strong></div>
      <div class="box"><span>Durum</span><strong>${escapeHtml(record.status)}</strong></div>
      <div class="box"><span>Sevkiyat Plani</span><strong>${escapeHtml(record.shipmentPlanNo)}</strong></div>
      <div class="box"><span>Sube</span><strong>${escapeHtml(record.branchName)}</strong></div>
      <div class="box"><span>Depo</span><strong>${escapeHtml(record.warehouseName)}</strong></div>
      <div class="box"><span>Musteri</span><strong>${escapeHtml(record.customerName)}</strong></div>
      <div class="box"><span>Arac</span><strong>${escapeHtml(`${record.vehicleNo} ${record.vehiclePlate}`.trim())}</strong></div>
      <div class="box"><span>Sofor</span><strong>${escapeHtml(record.driverName)}</strong></div>
      <div class="box"><span>Sevkiyat</span><strong>${escapeHtml(record.shipmentNo || '-')}</strong></div>
    </section>

    <section>
      <h2>Urunler</h2>
      <table>
        <thead>
          <tr>
            <th>Urun</th>
            <th>Lot</th>
            <th class="num">Miktar</th>
            <th>Birim</th>
            <th class="num">Koli</th>
            <th class="num">Palet</th>
            <th class="num">Net</th>
            <th class="num">Brut</th>
            <th class="num">Maliyet</th>
          </tr>
        </thead>
        <tbody>
          ${record.items.map(item => `
            <tr>
              <td>${escapeHtml(item.productName || item.stockItemName)}<br><span class="muted">${escapeHtml(item.productionOrderNo || item.palletNo)}</span></td>
              <td>${escapeHtml(item.lotNo)}</td>
              <td class="num">${escapeHtml(formatNumber(item.quantity))}</td>
              <td>${escapeHtml(item.unit)}</td>
              <td class="num">${escapeHtml(formatNumber(item.boxCount))}</td>
              <td class="num">${escapeHtml(formatNumber(item.palletCount))}</td>
              <td class="num">${escapeHtml(formatNumber(item.netWeight))} kg</td>
              <td class="num">${escapeHtml(formatNumber(item.grossWeight))} kg</td>
              <td class="num">${escapeHtml(formatMoney(item.totalCost))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    <section class="summary">
      <div class="box"><span>Toplam Miktar</span><strong>${escapeHtml(formatNumber(totalQuantity))}</strong></div>
      <div class="box"><span>Koli</span><strong>${escapeHtml(formatNumber(totalBoxes))}</strong></div>
      <div class="box"><span>Palet</span><strong>${escapeHtml(formatNumber(totalPallets))}</strong></div>
      <div class="box"><span>Net</span><strong>${escapeHtml(formatNumber(totalNet))} kg</strong></div>
      <div class="box"><span>Brut</span><strong>${escapeHtml(formatNumber(totalGross))} kg</strong></div>
      <div class="box"><span>Cost Engine</span><strong>${escapeHtml(formatMoney(totalCost))}</strong></div>
    </section>

    <section class="box" style="margin-top:12px;">
      <span>Aciklama</span>
      <strong>${escapeHtml(record.description || '-')}</strong>
    </section>

    <section class="signature">
      <div>Hazirlayan</div>
      <div>Sofor</div>
      <div>Teslim Alan</div>
    </section>
  </main>
</body>
</html>`
}

export const openDeliveryNotePrintWindow = (
  record: DeliveryNote,
  mode: DeliveryNotePrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return false
  const printWindow = window.open('', '_blank', 'width=920,height=1200')
  if(!printWindow) return false
  printWindow.document.open()
  printWindow.document.write(createDeliveryNotePrintHtml(record, mode))
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => printWindow.print(), 350)
  return true
}

export const DeliveryNotePrintService = {
  createHtml: createDeliveryNotePrintHtml,
  openPrintWindow: openDeliveryNotePrintWindow
}
