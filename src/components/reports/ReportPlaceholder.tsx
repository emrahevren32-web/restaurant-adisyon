import { ReportTabId, reportTabs } from './ReportTabs'

type Props = {
  activeTab: ReportTabId
}

const reportDescriptions: Record<ReportTabId, string> = {
  'executive-dashboard': 'Yönetici özeti ve kritik işletme göstergeleri burada listelenecek.',
  'stock-status': 'Stok kartları, mevcut miktarlar ve stok değeri detayları burada listelenecek.',
  'stock-movements': 'Giriş, çıkış, sayım, kayıp ve ters hareket kayıtları burada listelenecek.',
  'critical-stock': 'Kritik stok durumları ve kritik olay geçmişi burada listelenecek.',
  'expiry-near': 'Yaklaşan geçerlilik lotları ve uyarı günleri burada listelenecek.',
  'expiry-expired': 'Tarihi geçmiş ve kalan miktarı olan lotlar burada listelenecek.',
  'lot-movements': 'Lot oluşturma, tüketim, kayıp, iade ve geçerlilik olayları burada listelenecek.',
  'waste-report': 'Kayıp kayıtları neden, personel, ürün ve lot kırılımlarıyla burada listelenecek.',
  'waste-cost': 'Kayıp maliyeti ve maliyet kırılımları burada listelenecek.',
  'recipe-consumption': 'Üretim tanımı bazlı bileşen tüketimi ve otomatik stok düşümü detayları burada listelenecek.',
  'product-profitability': 'Ürün / hizmet geliri, üretim tanımı maliyeti ve brüt kar kırılımı burada listelenecek.',
  'sales-revenue': 'İşlem adedi, gelir ve işlem kırılımları burada listelenecek.',
  'stock-turnover': 'Stok devir hızı, tüketim maliyeti ve yavaş dönen ürün analizi burada listelenecek.',
  'top-selling-products': 'En çok işlem gören ürün / hizmetler, gelir ve işlem payı kırılımı burada listelenecek.',
  'low-selling-products': 'Az satan, satılmayan ve riskli ürünler burada listelenecek.',
  'sales-trend': 'İşlem trendleri ve zaman analizi burada listelenecek.',
  'daily-summary': 'Günlük stok giriş, çıkış, kayıp ve sayım özeti burada listelenecek.'
}

export default function ReportPlaceholder({ activeTab }: Props){
  const selectedReport = reportTabs.find(tab => tab.id === activeTab)

  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>{selectedReport?.label || 'Rapor'}</h3>
          <p className="muted">{reportDescriptions[activeTab]}</p>
        </div>
        <span className="status-pill muted-pill">Faz 12.8.x</span>
      </div>

      <div className="table-wrap">
        <table className="data-table report-table report-placeholder-table">
          <thead>
            <tr>
              <th>Rapor</th>
              <th>Durum</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{selectedReport?.label || '-'}</td>
              <td><span className="status-pill warning-pill">Planlandı</span></td>
              <td>Bu rapor Faz 12.8.x aşamasında geliştirilecektir.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
