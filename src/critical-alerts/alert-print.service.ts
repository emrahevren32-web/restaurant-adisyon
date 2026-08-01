import {
  ALERT_CATEGORY_LABELS,
  ALERT_LEVEL_LABELS,
  ALERT_PRIORITY_LABELS,
  ALERT_STATUS_LABELS
} from './critical-alert.constants'
import type {
  AlertPrintMode,
  CriticalAlert
} from './critical-alert.types'

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

export const createAlertPrintHtml = (
  alert: CriticalAlert,
  mode: AlertPrintMode = 'A4'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(alert.alertNo)} Kritik Alarm</title>
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:24px; color:#111827; font-family:Inter, Arial, sans-serif; background:#f8fafc; }
    .sheet { max-width:980px; margin:0 auto; padding:24px; border:1px solid #d1d5db; border-radius:8px; background:#fff; }
    .header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; border-bottom:2px solid #111827; padding-bottom:16px; margin-bottom:18px; }
    h1 { margin:0; font-size:22px; line-height:1.2; }
    h2 { margin:22px 0 10px; font-size:16px; }
    .muted { color:#64748b; font-size:12px; font-weight:700; }
    .pill { display:inline-block; border:1px solid #d1d5db; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:800; }
    .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; }
    .box { min-width:0; border:1px solid #e5e7eb; border-radius:6px; padding:9px 10px; background:#f9fafb; }
    .box span { display:block; color:#64748b; font-size:11px; font-weight:800; }
    .box strong { display:block; margin-top:4px; color:#111827; font-size:13px; overflow-wrap:anywhere; }
    p { line-height:1.55; }
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
        <span class="muted">Kritik Alarm Motoru</span>
        <h1>${escapeHtml(alert.alertNo)} - ${escapeHtml(alert.title)}</h1>
        <div class="muted">${escapeHtml(formatDateTime(alert.createdAt))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazirlik' : ALERT_LEVEL_LABELS[alert.level])}</span>
    </div>
    <div class="grid">
      <div class="box"><span>Kategori</span><strong>${escapeHtml(ALERT_CATEGORY_LABELS[alert.category])}</strong></div>
      <div class="box"><span>Seviye</span><strong>${escapeHtml(ALERT_LEVEL_LABELS[alert.level])}</strong></div>
      <div class="box"><span>Durum</span><strong>${escapeHtml(ALERT_STATUS_LABELS[alert.status])}</strong></div>
      <div class="box"><span>Oncelik</span><strong>${escapeHtml(ALERT_PRIORITY_LABELS[alert.priority])}</strong></div>
      <div class="box"><span>Risk Skoru</span><strong>${escapeHtml(formatNumber(alert.riskScore, 1))}</strong></div>
      <div class="box"><span>Tekrar</span><strong>${escapeHtml(alert.repeatCount)}</strong></div>
      <div class="box"><span>Kaynak Modul</span><strong>${escapeHtml(alert.sourceModule)}</strong></div>
      <div class="box"><span>Kaynak No</span><strong>${escapeHtml(alert.sourceNo)}</strong></div>
      <div class="box"><span>Ilgili Varlik</span><strong>${escapeHtml(alert.relatedEntityName)}</strong></div>
    </div>
    <h2>Alarm Nedeni</h2>
    <p>${escapeHtml(alert.reason)}</p>
    <h2>Onerilen Aksiyon</h2>
    <p>${escapeHtml(alert.recommendedAction)}</p>
    <h2>Beklenen Etki</h2>
    <p>${escapeHtml(alert.expectedImpact)}</p>
    <h2>History</h2>
    <table>
      <thead><tr><th>Aksiyon</th><th>Kullanici</th><th>Tarih</th><th>Aciklama</th></tr></thead>
      <tbody>
        ${alert.history.map(history => `
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

export const openAlertPrintWindow = (
  alert: CriticalAlert,
  mode: AlertPrintMode = 'A4'
) => {
  if(typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'width=980,height=820')
  if(!printWindow) throw new Error('Cikti penceresi acilamadi.')
  printWindow.document.open()
  printWindow.document.write(createAlertPrintHtml(alert, mode))
  printWindow.document.close()
}

export const AlertPrintService = {
  createHtml: createAlertPrintHtml,
  openPrintWindow: openAlertPrintWindow
}
