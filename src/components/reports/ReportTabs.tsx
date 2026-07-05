export type ReportTabId =
  | 'executive-dashboard'
  | 'stock-status'
  | 'stock-movements'
  | 'critical-stock'
  | 'expiry-near'
  | 'expiry-expired'
  | 'lot-movements'
  | 'waste-report'
  | 'waste-cost'
  | 'recipe-consumption'
  | 'product-profitability'
  | 'sales-revenue'
  | 'stock-turnover'
  | 'top-selling-products'
  | 'low-selling-products'
  | 'sales-trend'
  | 'daily-summary'

export type ReportTab = {
  id: ReportTabId
  label: string
  description: string
}

export const reportTabs: ReportTab[] = [
  { id: 'executive-dashboard', label: 'Yönetici Özeti', description: 'Gelir, kârlılık ve operasyon uyarıları.' },
  { id: 'stock-status', label: 'Stok Durum', description: 'Miktar, değer ve stok sağlığını gösterir.' },
  { id: 'stock-movements', label: 'Stok Hareketleri', description: 'Giriş, çıkış, kayıp ve sayım hareketleri.' },
  { id: 'critical-stock', label: 'Kritik Stok', description: 'Kritik seviyeye düşen ürünler.' },
  { id: 'expiry-near', label: 'Geçerlilik Yaklaşan', description: 'Yakında geçerlilik tarihi dolacak lotlar.' },
  { id: 'expiry-expired', label: 'Geçerlilik Geçmiş', description: 'Geçerlilik tarihi geçmiş lotlar.' },
  { id: 'waste-cost', label: 'Kayıp Analizi', description: 'Kayıp kaynaklı miktar ve maliyet etkileri.' },
  { id: 'recipe-consumption', label: 'Üretim Tanımı Tüketimi', description: 'İşlem kaynaklı bileşen tüketim maliyeti.' },
  { id: 'product-profitability', label: 'Ürün / Hizmet Karlılık', description: 'Gelir, üretim tanımı maliyeti ve brüt kar.' },
  { id: 'sales-revenue', label: 'Gelir Analizi', description: 'İşlem adedi ve gelir performansı.' },
  { id: 'stock-turnover', label: 'Stok Devir Hızı', description: 'Hızlı ve yavaş dönen stokların tüketim analizi.' },
  { id: 'top-selling-products', label: 'En Çok İşlem Gören', description: 'Ürün / hizmet işlem adedi, gelir ve işlem payı analizi.' },
  { id: 'low-selling-products', label: 'En Az Satan', description: 'Az satan, satılmayan ve riskli ürün analizi.' },
  { id: 'sales-trend', label: 'İşlem Trendleri', description: 'Saat, gün ve dönem bazlı işlem yoğunluğu.' }
]

type Props = {
  activeTab: ReportTabId
  onChange: (tab: ReportTabId) => void
}

type ReportTabCardProps = {
  tab: ReportTab
  active: boolean
  onSelect: (tab: ReportTabId) => void
}

function ReportTabCard({ tab, active, onSelect }: ReportTabCardProps){
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`report-tab-btn ${active ? 'active' : ''}`}
      onClick={() => onSelect(tab.id)}
    >
      <strong>{tab.label}</strong>
      <span>{tab.description}</span>
    </button>
  )
}

export default function ReportTabs({ activeTab, onChange }: Props){
  return (
    <div className="report-tab-list" role="tablist" aria-label="Rapor türleri">
      {reportTabs.map(tab => (
        <ReportTabCard
          key={tab.id}
          tab={tab}
          active={activeTab === tab.id}
          onSelect={onChange}
        />
      ))}
    </div>
  )
}
