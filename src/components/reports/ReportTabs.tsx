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
  { id: 'executive-dashboard', label: 'Yönetici Özeti', description: 'Ciro, kârlılık ve operasyon uyarıları.' },
  { id: 'stock-status', label: 'Stok Durum', description: 'Miktar, değer ve stok sağlığını gösterir.' },
  { id: 'stock-movements', label: 'Stok Hareketleri', description: 'Giriş, çıkış, fire ve sayım hareketleri.' },
  { id: 'critical-stock', label: 'Kritik Stok', description: 'Kritik seviyeye düşen ürünler.' },
  { id: 'expiry-near', label: 'SKT Yaklaşan', description: 'Yakında son kullanma tarihi dolacak lotlar.' },
  { id: 'expiry-expired', label: 'SKT Geçmiş', description: 'Son kullanma tarihi geçmiş lotlar.' },
  { id: 'waste-cost', label: 'Fire ve Kayıp', description: 'Fire kaynaklı miktar ve maliyet kayıpları.' },
  { id: 'recipe-consumption', label: 'Reçete Tüketim', description: 'Satış kaynaklı hammadde tüketim maliyeti.' },
  { id: 'product-profitability', label: 'Ürün Karlılık', description: 'Satış geliri, reçete maliyeti ve brüt kar.' },
  { id: 'sales-revenue', label: 'Satış ve Ciro', description: 'Adisyon, satış adedi ve ciro performansı.' },
  { id: 'stock-turnover', label: 'Stok Devir Hızı', description: 'Hızlı ve yavaş dönen stokların tüketim analizi.' },
  { id: 'top-selling-products', label: 'En Çok Satan', description: 'Ürün satış adedi, ciro ve satış payı analizi.' },
  { id: 'low-selling-products', label: 'En Az Satan', description: 'Az satan, satılmayan ve riskli ürün analizi.' },
  { id: 'sales-trend', label: 'Satış Trendleri', description: 'Saat, gün ve dönem bazlı satış yoğunluğu.' }
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
          <strong>{tab.label}</strong>
          <span>{tab.description}</span>
        </button>
      ))}
    </div>
  )
}
