import React from 'react'
import { Discount, DiscountType, PaymentMethod, Product, ProductCategory, TableState } from '../types'
import {
  calculateDiscountTotal,
  calculateFinalTotal,
  calculateGiftTotal,
  calculateOrderOriginalTotal,
  calculateOrderPayableTotal,
  calculateSubtotal,
  formatCurrency,
  getOrderUnitPrice
} from '../billing'

type Props = {
  table: TableState
  tables: TableState[]
  products: Product[]
  allProducts: Product[]
  categories: ProductCategory[]
  onAddOrder: (tableId: string, productId: string, qty: number, isGift?: boolean) => void
  onUpdateOrderQty: (tableId: string, orderId: string, qty: number) => void
  onRemoveOrder: (tableId: string, orderId: string) => void
  onOpenTable: (tableId: string) => void
  onCloseTable: (tableId: string, paymentMethod: PaymentMethod) => void
  onUpdateNote: (tableId: string, note: string) => void
  onUpdateDiscount: (tableId: string, discount: Discount) => void
  onClearDiscount: (tableId: string) => void
  onTransferTable: (sourceTableId: string, targetTableId: string) => void
}

export default function TableCard({
  table,
  tables,
  products,
  allProducts,
  categories,
  onAddOrder,
  onUpdateOrderQty,
  onRemoveOrder,
  onOpenTable,
  onCloseTable,
  onUpdateNote,
  onUpdateDiscount,
  onClearDiscount,
  onTransferTable
}: Props) {
  const [qty, setQty] = React.useState<number>(1)
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState('all')
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('Nakit')
  const [transferTargetId, setTransferTargetId] = React.useState('')
  const [discountTypeInput, setDiscountTypeInput] = React.useState<DiscountType>(table.discount?.type || 'percent')

  const categoryMap = React.useMemo(() => new Map(categories.map(category => [category.id, category])), [categories])
  const transferTargets = React.useMemo(() => {
    return tables.filter(item => item.id !== table.id && !item.open && item.orders.length === 0)
  }, [table.id, tables])

  React.useEffect(() => {
    if(transferTargets.length === 0){
      setTransferTargetId('')
      return
    }

    if(!transferTargets.find(item => item.id === transferTargetId)){
      setTransferTargetId(transferTargets[0].id)
    }
  }, [transferTargetId, transferTargets])

  React.useEffect(() => {
    setDiscountTypeInput(table.discount?.type || 'percent')
  }, [table.discount?.type, table.id])

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

  const subtotal = calculateSubtotal(table.orders, allProducts)
  const discountTotal = calculateDiscountTotal(table.discount, subtotal)
  const finalTotal = calculateFinalTotal(table.orders, allProducts, table.discount)
  const giftTotal = calculateGiftTotal(table.orders, allProducts)
  const itemCount = table.orders.reduce((sum, order) => sum + order.qty, 0)
  const splitAmount = finalTotal / 2
  const discountType: DiscountType = table.discount?.type || discountTypeInput

  const updateDiscountValue = (rawValue: string) => {
    if(rawValue === ''){
      onClearDiscount(table.id)
      return
    }

    onUpdateDiscount(table.id, {
      type: discountType,
      value: Number(rawValue)
    })
  }

  const updateDiscountType = (type: DiscountType) => {
    setDiscountTypeInput(type)

    if(table.discount?.value){
      onUpdateDiscount(table.id, { type, value: table.discount.value })
    }
  }

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
              <strong>{formatCurrency(finalTotal)}</strong>
            </div>
          </div>

          <div className="adisyon-tools">
            <section className="tool-panel">
              <label>Adisyon Notu</label>
              <textarea
                rows={3}
                placeholder="Mutfak, servis veya müşteri notu"
                value={table.note || ''}
                onChange={e=>onUpdateNote(table.id, e.target.value)}
              />
            </section>

            <section className="tool-panel">
              <label>İndirim</label>
              <div className="discount-controls">
                <select value={discountType} onChange={e=>updateDiscountType(e.target.value as DiscountType)}>
                  <option value="percent">Yüzde (%)</option>
                  <option value="amount">Tutar</option>
                </select>
                <input
                  type="number"
                  min={0}
                  max={discountType === 'percent' ? 100 : undefined}
                  step="0.01"
                  placeholder={discountType === 'percent' ? '10' : '50'}
                  value={table.discount?.value ?? ''}
                  onChange={e=>updateDiscountValue(e.target.value)}
                />
                <button className="btn" type="button" onClick={()=>onClearDiscount(table.id)}>Temizle</button>
              </div>
              <p className="muted small-text">İndirim tutarı: {formatCurrency(discountTotal)}</p>
            </section>

            <section className="tool-panel">
              <label>Masa Taşıma</label>
              <div className="discount-controls">
                <select value={transferTargetId} onChange={e=>setTransferTargetId(e.target.value)} disabled={transferTargets.length === 0}>
                  {transferTargets.length === 0 && <option value="">Uygun masa yok</option>}
                  {transferTargets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <button className="btn" type="button" disabled={!transferTargetId} onClick={()=>onTransferTable(table.id, transferTargetId)}>Taşı</button>
              </div>
              <p className="muted small-text">Adisyon sadece kapalı ve boş masaya taşınır.</p>
            </section>
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
                      const originalTotal = calculateOrderOriginalTotal(order, allProducts)
                      const payableTotal = calculateOrderPayableTotal(order, allProducts)
                      const product = allProducts.find(item => item.id === order.productId)

                      return (
                        <tr key={order.id}>
                          <td>
                            <strong>{order.productName || product?.name || 'Bilinmiyor'}</strong>
                            <div className="muted small-text">
                              {formatCurrency(unitPrice)} birim fiyat
                              {order.isGift && <span className="gift-label">İkram</span>}
                            </div>
                          </td>
                          <td>
                            <div className="qty-controls">
                              <button className="btn icon-btn" onClick={()=>onUpdateOrderQty(table.id, order.id, order.qty - 1)}>-</button>
                              <span>{order.qty}</span>
                              <button className="btn icon-btn" onClick={()=>onUpdateOrderQty(table.id, order.id, order.qty + 1)}>+</button>
                            </div>
                          </td>
                          <td>
                            {formatCurrency(payableTotal)}
                            {order.isGift && <div className="muted small-text">Normal: {formatCurrency(originalTotal)}</div>}
                          </td>
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
                  <div className="product-pick-row" key={product.id}>
                    <button className="product-pick-main" onClick={()=>onAddOrder(table.id, product.id, qty)} type="button">
                      <span>
                        <strong>{product.name}</strong>
                        <small>{categoryMap.get(product.categoryId)?.name || 'Kategori yok'}</small>
                      </span>
                      <b>{formatCurrency(product.price)}</b>
                    </button>
                    <button className="btn" type="button" onClick={()=>onAddOrder(table.id, product.id, qty, true)}>İkram</button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="checkout-panel">
            <div>
              <span className="muted small-text">Ara Toplam</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <div>
              <span className="muted small-text">İkram</span>
              <strong>{formatCurrency(giftTotal)}</strong>
            </div>
            <div>
              <span className="muted small-text">Ödenecek</span>
              <strong>{formatCurrency(finalTotal)}</strong>
              <div className="muted small-text">2 kişi: {formatCurrency(splitAmount)} / kişi</div>
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
