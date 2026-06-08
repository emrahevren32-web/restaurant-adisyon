import { ReportTabId, reportTabs } from './ReportTabs'

type Props = {
  activeTab: ReportTabId
}

const reportDescriptions: Record<ReportTabId, string> = {
  'stock-status': 'Stok kartları, mevcut miktarlar ve stok değeri detayları burada listelenecek.',
  'stock-movements': 'Giriş, çıkış, sayım, fire ve ters hareket kayıtları burada listelenecek.',
  'critical-stock': 'Kritik stok durumları ve kritik olay geçmişi burada listelenecek.',
  'expiry-near': 'Yaklaşan SKT lotları ve uyarı günleri burada listelenecek.',
  'expiry-expired': 'Tarihi geçmiş ve kalan miktarı olan lotlar burada listelenecek.',
  'lot-movements': 'Lot oluşturma, tüketim, fire, iade ve SKT olayları burada listelenecek.',
  'waste-report': 'Fire kayıtları neden, personel, ürün ve lot kırılımlarıyla burada listelenecek.',
  'waste-cost': 'Fire maliyeti ve maliyet kırılımları burada listelenecek.',
  'recipe-consumption': 'Reçete bazlı hammadde tüketimi ve otomatik stok düşümü detayları burada listelenecek.',
  'product-profitability': 'Ürün satış geliri, reçete maliyeti ve brüt kar kırılımı burada listelenecek.',
  'sales-revenue': 'Satış adedi, ciro ve adisyon kırılımları burada listelenecek.',
  'stock-turnover': 'Stok devir hızı, tüketim maliyeti ve yavaş dönen ürün analizi burada listelenecek.',
  'daily-summary': 'Günlük stok giriş, çıkış, fire ve sayım özeti burada listelenecek.'
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
