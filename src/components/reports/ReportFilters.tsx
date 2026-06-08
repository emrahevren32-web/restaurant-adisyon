import { User } from '../../types'

export type ReportMovementTypeFilter = 'all' | 'entry' | 'exit' | 'waste' | 'count' | 'reverse'
export type ReportCriticalStatusFilter = 'all' | 'critical' | 'very-critical' | 'out'
export type ReportExpiryStatusFilter = 'all' | 'urgent' | 'approaching' | 'watch'
export type ReportExpiredStatusFilter = 'all' | 'newly-expired' | 'critical' | 'dispose'
export type ReportWasteReasonFilter = 'all' | 'spoilage' | 'breakage' | 'wrong-production' | 'expiry' | 'count-difference' | 'other'

export type ReportFiltersValue = {
  search: string
  startDate: string
  endDate: string
  categoryId: string
  stockItemId: string
  personnelId: string
  movementType: ReportMovementTypeFilter
  criticalStatus: ReportCriticalStatusFilter
  expiryStatus: ReportExpiryStatusFilter
  expiredStatus: ReportExpiredStatusFilter
  wasteReason: ReportWasteReasonFilter
}

type Props = {
  filters: ReportFiltersValue
  categories: { id: string; name: string }[]
  stockItems: { id: string; name: string }[]
  users: User[]
  onChange: (filters: ReportFiltersValue) => void
  showMovementTypeFilter?: boolean
  showCriticalStatusFilter?: boolean
  showExpiryStatusFilter?: boolean
  showExpiredStatusFilter?: boolean
  showWasteReasonFilter?: boolean
  showDateFilters?: boolean
  showPersonnelFilter?: boolean
  stockItemFilterLabel?: string
  stockItemAllLabel?: string
  searchPlaceholderOverride?: string
}

export const defaultReportFilters: ReportFiltersValue = {
  search: '',
  startDate: '',
  endDate: '',
  categoryId: 'all',
  stockItemId: 'all',
  personnelId: 'all',
  movementType: 'all',
  criticalStatus: 'all',
  expiryStatus: 'all',
  expiredStatus: 'all',
  wasteReason: 'all'
}

export const reportMovementTypeOptions: { value: ReportMovementTypeFilter; label: string }[] = [
  { value: 'all', label: 'Tüm işlem tipleri' },
  { value: 'entry', label: 'Giriş' },
  { value: 'exit', label: 'Çıkış' },
  { value: 'waste', label: 'Fire' },
  { value: 'count', label: 'Sayım Düzeltme' },
  { value: 'reverse', label: 'Ters Hareket' }
]

export const reportCriticalStatusOptions: { value: ReportCriticalStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tüm durumlar' },
  { value: 'critical', label: 'Kritik' },
  { value: 'very-critical', label: 'Çok Kritik' },
  { value: 'out', label: 'Stok Yok' }
]

export const reportExpiryStatusOptions: { value: ReportExpiryStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tüm durumlar' },
  { value: 'urgent', label: 'Acil' },
  { value: 'approaching', label: 'Yaklaşıyor' },
  { value: 'watch', label: 'Takip Et' }
]

export const reportExpiredStatusOptions: { value: ReportExpiredStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tüm durumlar' },
  { value: 'newly-expired', label: 'Yeni Geçmiş' },
  { value: 'critical', label: 'Kritik' },
  { value: 'dispose', label: 'İmha Edilmeli' }
]

export const reportWasteReasonOptions: { value: ReportWasteReasonFilter; label: string }[] = [
  { value: 'all', label: 'Tüm fire sebepleri' },
  { value: 'spoilage', label: 'Bozulma' },
  { value: 'breakage', label: 'Kırılma' },
  { value: 'wrong-production', label: 'Yanlış Üretim' },
  { value: 'expiry', label: 'Son Kullanma Tarihi' },
  { value: 'count-difference', label: 'Sayım Farkı' },
  { value: 'other', label: 'Diğer' }
]

export default function ReportFilters({
  filters,
  categories,
  stockItems,
  users,
  onChange,
  showMovementTypeFilter = false,
  showCriticalStatusFilter = false,
  showExpiryStatusFilter = false,
  showExpiredStatusFilter = false,
  showWasteReasonFilter = false,
  showDateFilters = true,
  showPersonnelFilter = true,
  stockItemFilterLabel = 'Ürün',
  stockItemAllLabel = 'Tüm ürünler',
  searchPlaceholderOverride
}: Props){
  const updateFilter = <K extends keyof ReportFiltersValue>(key: K, value: ReportFiltersValue[K]) => {
    onChange({ ...filters, [key]: value })
  }

  const gridClassName = [
    'report-filter-grid',
    showMovementTypeFilter ? 'with-movement-type' : '',
    showCriticalStatusFilter ? 'with-critical-status' : '',
    showExpiryStatusFilter ? 'with-expiry-status' : '',
    showExpiredStatusFilter ? 'with-expired-status' : '',
    showWasteReasonFilter ? 'with-waste-reason' : ''
  ].filter(Boolean).join(' ')

  const searchPlaceholder = searchPlaceholderOverride || (showMovementTypeFilter
    ? 'Ürün, açıklama, kaynak veya kullanıcı'
    : showCriticalStatusFilter
      ? 'Ürün adı veya kategori'
      : showExpiryStatusFilter
        ? 'Ürün adı, lot numarası veya kategori'
        : showExpiredStatusFilter
          ? 'Ürün adı, lot numarası veya kategori'
          : showWasteReasonFilter
            ? 'Ürün adı, fire sebebi veya kullanıcı'
            : 'Ürün adı, kategori veya kod')

  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>Ortak Filtreler</h3>
          <p className="muted">Filtreler seçili raporun verilerine uygulanır.</p>
        </div>
        <button className="btn" type="button" onClick={() => onChange(defaultReportFilters)}>Temizle</button>
      </div>

      <div className={gridClassName}>
        <div className="form-field">
          <label>Arama</label>
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={filters.search}
            onChange={event => updateFilter('search', event.target.value)}
          />
        </div>
        {showDateFilters && (
          <>
            <div className="form-field">
              <label>Başlangıç tarihi</label>
              <input type="date" value={filters.startDate} onChange={event => updateFilter('startDate', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Bitiş tarihi</label>
              <input type="date" value={filters.endDate} onChange={event => updateFilter('endDate', event.target.value)} />
            </div>
          </>
        )}
        <div className="form-field">
          <label>Kategori</label>
          <select value={filters.categoryId} onChange={event => updateFilter('categoryId', event.target.value)}>
            <option value="all">Tüm kategoriler</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>{stockItemFilterLabel}</label>
          <select value={filters.stockItemId} onChange={event => updateFilter('stockItemId', event.target.value)}>
            <option value="all">{stockItemAllLabel}</option>
            {stockItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        {showPersonnelFilter && (
          <div className="form-field">
            <label>Personel</label>
            <select value={filters.personnelId} onChange={event => updateFilter('personnelId', event.target.value)}>
              <option value="all">Tüm personel</option>
              {users.map(user => <option key={user.id} value={user.id}>{user.fullName || user.username}</option>)}
            </select>
          </div>
        )}
        {showWasteReasonFilter && (
          <div className="form-field">
            <label>Fire Sebebi</label>
            <select value={filters.wasteReason} onChange={event => updateFilter('wasteReason', event.target.value as ReportWasteReasonFilter)}>
              {reportWasteReasonOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        )}
        {showMovementTypeFilter && (
          <div className="form-field">
            <label>İşlem Tipi</label>
            <select value={filters.movementType} onChange={event => updateFilter('movementType', event.target.value as ReportMovementTypeFilter)}>
              {reportMovementTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        )}
        {showCriticalStatusFilter && (
          <div className="form-field">
            <label>Durum</label>
            <select value={filters.criticalStatus} onChange={event => updateFilter('criticalStatus', event.target.value as ReportCriticalStatusFilter)}>
              {reportCriticalStatusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        )}
        {showExpiryStatusFilter && (
          <div className="form-field">
            <label>Durum</label>
            <select value={filters.expiryStatus} onChange={event => updateFilter('expiryStatus', event.target.value as ReportExpiryStatusFilter)}>
              {reportExpiryStatusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        )}
        {showExpiredStatusFilter && (
          <div className="form-field">
            <label>Durum</label>
            <select value={filters.expiredStatus} onChange={event => updateFilter('expiredStatus', event.target.value as ReportExpiredStatusFilter)}>
              {reportExpiredStatusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        )}
      </div>
    </section>
  )
}
