import React from 'react'
import { Order, PaymentMethod, Product, ProductCategory, TableState } from '../types'

type Props = {
  table: TableState
  products: Product[]
  allProducts: Product[]
  categories: ProductCategory[]
  onAddOrder: (tableId: string, productId: string, qty: number) => void
  onUpdateOrderQty: (tableId: string, orderId: string, qty: number) => void
  onRemoveOrder: (tableId: string, orderId: string) => void
  onOpenTable: (tableId: string) => void
  onCloseTable: (tableId: string, paymentMethod: PaymentMethod) => void
}

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY'
})

const formatCurrency = (value: number) => currencyFormatter.format(value)

const getOrderUnitPrice = (order: Order, products: Product[]) => {
  const product = products.find(item => item.id === order.productId)
  return order.unitPrice ?? product?.price ?? 0
}

export default function TableCard({
  table,
  products,
  allProducts,
  categories,
  onAddOrder,
  onUpdateOrderQty,
  onRemoveOrder,
  onOpenTable,
  onCloseTable
}: Props) {
  const [qty, setQty] = React.useState<number>(1)
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState('all')
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('Nakit')

  const categoryMap = React.useMemo(() => new Map(categories.map(category => [category.id, category])), [categories])
  const visibleProducts = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return products.filter(product => {
      const category = categoryMap.get(product.categoryId)
      const matchesSearch = !normalizedSearch
        || product.name.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (category?.name || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
      const matchesCategory = categoryFilter === 'all' || product.categoryId === categoryFilter

      return matchesSearch && matchesCategory
    })
  }, [categoryFilter, categoryMap, products, search])

  const total = table.orders.reduce((sum, order) => sum + getOrderUnitPrice(order, allProducts) * order.qty, 0)
  const itemCount = table.orders.reduce((sum, order) => sum + order.qty, 0)

  return (
    <div className="card table-detail">
      <div className="section-header">
        <div>
          <h3>{table.name}</h3>
          <p className="muted">{table.open ? 'Açık adisyon' : 'Kapalı masa'}</p>
        </div>
        <span className={`status-pill ${table.open ? 'success' : 'muted-pill'}`}>{table.open ? 'Açık' : 'Kapalı'}</span>
      </div>

      {!table.open ? (
        <div className="closed-table-panel">
          <strong>Bu masa şu anda kapalı.</strong>
          <p className="muted">Sipariş eklemek için önce masayı açın.</p>
          <button className="btn primary" onClick={()=>onOpenTable(table.id)}>Masayı Aç</button>
        </div>
      ) : (
        <>
          <div className="order-summary">
            <div>
              <span>Kalem</span>
              <strong>{table.orders.length}</strong>
            </div>
            <div>
              <span>Ürün Adedi</span>
              <strong>{itemCount}</strong>
            </div>
            <div>
              <span>Toplam</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
          </div>

          <div className="order-layout">
            <section>
              <div className="section-header compact">
                <h3>Siparişler</h3>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Ürün</th><th>Adet</th><th>Tutar</th><th></th></tr>
                  </thead>
                  <tbody>
                    {table.orders.length === 0 && (
                      <tr><td colSpan={4} className="empty-cell">Bu adisyonda henüz ürün yok.</td></tr>
                    )}
                    {table.orders.map(order => {
                      const unitPrice = getOrderUnitPrice(order, allProducts)
                      const product = allProducts.find(item => item.id === order.productId)

                      return (
                        <tr key={order.id}>
                          <td>
                            <strong>{order.productName || product?.name || 'Bilinmiyor'}</strong>
                            <div className="muted small-text">{formatCurrency(unitPrice)} birim fiyat</div>
                          </td>
                          <td>
                            <div className="qty-controls">
                              <button className="btn icon-btn" onClick={()=>onUpdateOrderQty(table.id, order.id, order.qty - 1)}>-</button>
                              <span>{order.qty}</span>
                              <button className="btn icon-btn" onClick={()=>onUpdateOrderQty(table.id, order.id, order.qty + 1)}>+</button>
                            </div>
                          </td>
                          <td>{formatCurrency(unitPrice * order.qty)}</td>
                          <td className="actions-cell">
                            <button className="btn" onClick={() => onRemoveOrder(table.id, order.id)}>Kaldır</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="product-picker">
              <div className="section-header compact">
                <h3>Ürün Ekle</h3>
              </div>
              <div className="picker-controls">
                <input type="search" placeholder="Ürün veya kategori ara" value={search} onChange={e=>setSearch(e.target.value)} />
                <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>
                  <option value="all">Tüm kategoriler</option>
                  {categories.filter(category => category.active).map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                <input type="number" min={1} value={qty} onChange={e=>setQty(Number(e.target.value))} />
              </div>

              <div className="product-picker-list">
                {visibleProducts.length === 0 && <div className="empty-state">Aktif ürün bulunamadı.</div>}
                {visibleProducts.map(product => (
                  <button className="product-pick-button" key={product.id} onClick={()=>onAddOrder(table.id, product.id, qty)} type="button">
                    <span>
                      <strong>{product.name}</strong>
                      <small>{categoryMap.get(product.categoryId)?.name || 'Kategori yok'}</small>
                    </span>
                    <b>{formatCurrency(product.price)}</b>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="checkout-panel">
            <div>
              <span className="muted small-text">Hesap Toplamı</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
            <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value as PaymentMethod)}>
              <option value="Nakit">Nakit</option>
              <option value="Kart">Kart</option>
              <option value="Diğer">Diğer</option>
            </select>
            <button className="btn primary" onClick={()=>onCloseTable(table.id, paymentMethod)}>Hesabı Kapat</button>
          </div>
        </>
      )}
    </div>
  )
}
