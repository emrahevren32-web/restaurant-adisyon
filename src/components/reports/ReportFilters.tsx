import { StockCategory, StockItem, User } from '../../types'

export type ReportFiltersValue = {
  startDate: string
  endDate: string
  categoryId: string
  stockItemId: string
  personnelId: string
}

type Props = {
  filters: ReportFiltersValue
  categories: StockCategory[]
  stockItems: StockItem[]
  users: User[]
  onChange: (filters: ReportFiltersValue) => void
}

export const defaultReportFilters: ReportFiltersValue = {
  startDate: '',
  endDate: '',
  categoryId: 'all',
  stockItemId: 'all',
  personnelId: 'all'
}

export default function ReportFilters({ filters, categories, stockItems, users, onChange }: Props){
  const updateFilter = <K extends keyof ReportFiltersValue>(key: K, value: ReportFiltersValue[K]) => {
    onChange({ ...filters, [key]: value })
  }

  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>Ortak Filtreler</h3>
          <p className="muted">Filtreler bu fazda arayüz altyapısı olarak hazırlanmıştır.</p>
        </div>
        <button className="btn" type="button" onClick={() => onChange(defaultReportFilters)}>Temizle</button>
      </div>

      <div className="report-filter-grid">
        <div className="form-field">
          <label>Başlangıç tarihi</label>
          <input type="date" value={filters.startDate} onChange={event => updateFilter('startDate', event.target.value)} />
        </div>
        <div className="form-field">
          <label>Bitiş tarihi</label>
          <input type="date" value={filters.endDate} onChange={event => updateFilter('endDate', event.target.value)} />
        </div>
        <div className="form-field">
          <label>Kategori</label>
          <select value={filters.categoryId} onChange={event => updateFilter('categoryId', event.target.value)}>
            <option value="all">Tüm kategoriler</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Ürün</label>
          <select value={filters.stockItemId} onChange={event => updateFilter('stockItemId', event.target.value)}>
            <option value="all">Tüm ürünler</option>
            {stockItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Personel</label>
          <select value={filters.personnelId} onChange={event => updateFilter('personnelId', event.target.value)}>
            <option value="all">Tüm personel</option>
            {users.map(user => <option key={user.id} value={user.id}>{user.fullName || user.username}</option>)}
          </select>
        </div>
      </div>
    </section>
  )
}
