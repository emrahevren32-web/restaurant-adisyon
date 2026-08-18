import React from 'react'
import { AppIcon, type AppIconProps } from '../design-system/IconSystem'
import { PremiumEmptyState } from './PremiumEmptyState'
import { PremiumSkeleton, PremiumSpinner } from './PremiumLoading'
import { ResponsiveTable } from './ResponsiveTable'

export type PremiumTableSortDirection = 'asc' | 'desc' | 'none'
export type PremiumTableAlign = 'left' | 'center' | 'right'
export type PremiumTableDensity = 'comfortable' | 'compact'

export type PremiumTableColumn<T> = {
  key: string
  header: React.ReactNode
  dataLabel?: string
  accessor?: keyof T
  cell?: (row: T, index: number) => React.ReactNode
  align?: PremiumTableAlign
  width?: string
  className?: string
  sortable?: boolean
  sortDirection?: PremiumTableSortDirection
  filterActive?: boolean
  onSort?: () => void
}

export type PremiumTableProps<T> = {
  columns: PremiumTableColumn<T>[]
  rows: T[]
  getRowKey: (row: T, index: number) => React.Key
  caption?: React.ReactNode
  toolbar?: React.ReactNode
  pagination?: React.ReactNode
  emptyState?: React.ReactNode
  loading?: boolean
  loadingRowCount?: number
  stickyHeader?: boolean
  zebra?: boolean
  density?: PremiumTableDensity
  selectedRowKeys?: React.Key[]
  activeRowKey?: React.Key
  className?: string
  tableClassName?: string
  rowClassName?: (row: T, index: number) => string
  onRowClick?: (row: T, index: number) => void
}

export type PremiumTableToolbarAction = {
  key: string
  label: string
  icon?: AppIconProps['name']
  tone?: 'primary' | 'default'
  disabled?: boolean
  onClick: () => void
}

export type PremiumTableToolbarProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  searchValue?: string
  searchPlaceholder?: string
  onSearchChange?: (value: string) => void
  filters?: React.ReactNode
  actions?: PremiumTableToolbarAction[]
  bulkActions?: React.ReactNode
  resultLabel?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

export type PremiumPaginationProps = {
  page: number
  pageSize: number
  total: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  className?: string
}

export type PremiumEmptyTableProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: AppIconProps['name']
  loading?: boolean
  action?: React.ReactNode
  colSpan?: number
}

const getCellContent = <T,>(column: PremiumTableColumn<T>, row: T, index: number) => {
  if(column.cell) return column.cell(row, index)
  if(column.accessor) return row[column.accessor] as React.ReactNode
  return null
}

const getAriaSort = (direction?: PremiumTableSortDirection): React.AriaAttributes['aria-sort'] => {
  if(direction === 'asc') return 'ascending'
  if(direction === 'desc') return 'descending'
  return 'none'
}

const getPageCount = (total: number, pageSize: number) => Math.max(1, Math.ceil(total / Math.max(1, pageSize)))

export const PremiumTableToolbar = ({
  title,
  description,
  searchValue,
  searchPlaceholder = 'Tabloda ara',
  onSearchChange,
  filters,
  actions = [],
  bulkActions,
  resultLabel,
  className = '',
  children
}: PremiumTableToolbarProps) => (
  <div className={['premium-table-toolbar', className].filter(Boolean).join(' ')}>
    {(title || description || resultLabel) && (
      <div className="premium-table-toolbar-copy">
        {title && <h3>{title}</h3>}
        {description && <p>{description}</p>}
        {resultLabel && <span>{resultLabel}</span>}
      </div>
    )}
    <div className="premium-table-toolbar-controls">
      {onSearchChange && (
        <label className="premium-table-search">
          <AppIcon name="search" size="SM" />
          <input
            type="search"
            value={searchValue || ''}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            onChange={event => onSearchChange(event.target.value)}
          />
        </label>
      )}
      {filters && <div className="premium-table-filters">{filters}</div>}
      {bulkActions && <div className="premium-table-bulk-actions">{bulkActions}</div>}
      {actions.length > 0 && (
        <div className="premium-table-actions">
          {actions.map(action => (
            <button
              className={['btn', action.tone === 'primary' ? 'primary' : '', 'premium-table-action'].filter(Boolean).join(' ')}
              type="button"
              key={action.key}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.icon && <AppIcon name={action.icon} size="SM" />}
              {action.label}
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  </div>
)

export const PremiumEmptyTable = ({
  title = 'Kayıt bulunamadı',
  description = 'Seçili filtrelere uygun tablo kaydı yok.',
  icon = 'empty',
  loading = false,
  action,
  colSpan
}: PremiumEmptyTableProps) => (
  <tr className={loading ? 'premium-table-loading-row' : 'premium-table-empty-row'}>
    <td colSpan={colSpan} className="empty-cell premium-table-empty-cell">
      {loading ? (
        <div className="premium-table-loading-state" aria-live="polite">
          <PremiumSpinner size="medium" tone="info" label="Tablo hazirlaniyor" />
          <strong>Tablo hazırlanıyor</strong>
          <small>Veriler yüklenirken tablo düzeni korunuyor.</small>
        </div>
      ) : (
        <PremiumEmptyState
          title={title}
          description={description}
          icon={icon}
          size="compact"
          className="premium-table-empty-state"
        >
          {action && <div className="premium-table-empty-action">{action}</div>}
        </PremiumEmptyState>
      )}
    </td>
  </tr>
)

export const PremiumPagination = ({
  page,
  pageSize,
  total,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  className = ''
}: PremiumPaginationProps) => {
  const pageCount = getPageCount(total, pageSize)
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = total === 0 ? 0 : ((safePage - 1) * pageSize) + 1
  const end = Math.min(total, safePage * pageSize)

  return (
    <nav className={['premium-pagination', className].filter(Boolean).join(' ')} aria-label="Tablo sayfalama">
      <span className="premium-pagination-summary">{start}-{end} / {total}</span>
      {onPageSizeChange && (
        <label className="premium-pagination-size">
          <span>Satır</span>
          <select value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))}>
            {pageSizeOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      )}
      <div className="premium-pagination-actions">
        <button className="btn icon-btn" type="button" aria-label="Önceki sayfa" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
          <AppIcon name="chevronLeft" size="SM" />
        </button>
        <span>{safePage} / {pageCount}</span>
        <button className="btn icon-btn" type="button" aria-label="Sonraki sayfa" disabled={safePage >= pageCount} onClick={() => onPageChange(safePage + 1)}>
          <AppIcon name="chevronRight" size="SM" />
        </button>
      </div>
    </nav>
  )
}

export function PremiumTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  toolbar,
  pagination,
  emptyState,
  loading = false,
  loadingRowCount = 5,
  stickyHeader = true,
  zebra = true,
  density = 'comfortable',
  selectedRowKeys = [],
  activeRowKey,
  className = '',
  tableClassName = '',
  rowClassName,
  onRowClick
}: PremiumTableProps<T>){
  const selectedKeys = React.useMemo(() => new Set(selectedRowKeys.map(key => String(key))), [selectedRowKeys])
  const activeKey = activeRowKey === undefined ? undefined : String(activeRowKey)
  const columnCount = Math.max(1, columns.length)
  const tableRegionLabel = typeof caption === 'string' ? `${caption} tablosu` : 'Veri tablosu'

  return (
    <section
      className={['premium-table-shell', density, stickyHeader ? 'sticky-header' : '', zebra ? 'zebra' : '', className].filter(Boolean).join(' ')}
      aria-busy={loading || undefined}
    >
      {toolbar}
      <ResponsiveTable className="table-wrap premium-table-wrap" mode="hybrid" aria-label={tableRegionLabel}>
        <table className={['data-table', 'premium-table', tableClassName].filter(Boolean).join(' ')}>
          {caption && <caption>{caption}</caption>}
          <thead>
            <tr>
              {columns.map(column => (
                <th
                  key={column.key}
                  className={[column.align ? `align-${column.align}` : '', column.filterActive ? 'filter-active' : '', column.className || ''].filter(Boolean).join(' ')}
                  style={column.width ? { width: column.width } : undefined}
                  aria-sort={column.sortable ? getAriaSort(column.sortDirection) : undefined}
                  scope="col"
                >
                  {column.sortable || column.onSort ? (
                    <button className="premium-table-sort-button" type="button" onClick={column.onSort} disabled={!column.onSort}>
                      <span>{column.header}</span>
                      <AppIcon name="chevronDown" size="XS" className={['premium-table-sort-icon', column.sortDirection || 'none'].join(' ')} />
                    </button>
                  ) : (
                    <span className="premium-table-header-label">{column.header}</span>
                  )}
                  {column.filterActive && <AppIcon name="filter" size="XS" className="premium-table-filter-icon" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: loadingRowCount }).map((_, rowIndex) => (
              <tr className="premium-table-skeleton-row" key={`loading-${rowIndex}`}>
                {columns.map(column => (
                  <td key={column.key} className={column.align ? `align-${column.align}` : undefined}>
                    <PremiumSkeleton variant="line" className="premium-table-skeleton-line" />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && rows.length === 0 && (emptyState || <PremiumEmptyTable colSpan={columnCount} />)}
            {!loading && rows.map((row, index) => {
              const rowKey = getRowKey(row, index)
              const rowKeyText = String(rowKey)
              const selected = selectedKeys.has(rowKeyText)
              const active = activeKey === rowKeyText

              return (
                <tr
                  key={rowKey}
                  className={[selected ? 'selected' : '', active ? 'active' : '', onRowClick ? 'clickable' : '', rowClassName?.(row, index) || ''].filter(Boolean).join(' ')}
                  aria-selected={selected || undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                  onKeyDown={onRowClick ? event => {
                    if(event.key === 'Enter' || event.key === ' '){
                      event.preventDefault()
                      onRowClick(row, index)
                    }
                  } : undefined}
                >
                  {columns.map(column => (
                    <td
                      key={column.key}
                      className={[column.align ? `align-${column.align}` : '', column.className || ''].filter(Boolean).join(' ')}
                      data-label={column.dataLabel || (typeof column.header === 'string' ? column.header : undefined)}
                    >
                      {getCellContent(column, row, index)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </ResponsiveTable>
      {pagination}
    </section>
  )
}

export default PremiumTable
