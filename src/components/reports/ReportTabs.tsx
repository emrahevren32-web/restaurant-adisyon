export type ReportTabId =
  | 'stock-status'
  | 'stock-movements'
  | 'critical-stock'
  | 'expiry-near'
  | 'expiry-expired'
  | 'lot-movements'
  | 'waste-report'
  | 'waste-cost'
  | 'recipe-consumption'
  | 'daily-summary'

export type ReportTab = {
  id: ReportTabId
  label: string
}

export const reportTabs: ReportTab[] = [
  { id: 'stock-status', label: 'Stok Durum' },
  { id: 'stock-movements', label: 'Stok Hareketleri' },
  { id: 'critical-stock', label: 'Kritik Stok' },
  { id: 'expiry-near', label: 'SKT Yaklaşan' },
  { id: 'expiry-expired', label: 'SKT Geçmiş' },
  { id: 'lot-movements', label: 'Lot Hareketleri' },
  { id: 'waste-report', label: 'Fire Raporu' },
  { id: 'waste-cost', label: 'Fire Maliyet' },
  { id: 'recipe-consumption', label: 'Reçete Tüketim' },
  { id: 'daily-summary', label: 'Günlük Özet' }
]

type Props = {
  activeTab: ReportTabId
  onChange: (tab: ReportTabId) => void
}

export default function ReportTabs({ activeTab, onChange }: Props){
  return (
    <div className="report-tab-list" role="tablist" aria-label="Rapor türleri">
      {reportTabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`report-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
