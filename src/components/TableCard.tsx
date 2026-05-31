import React from 'react'
import { Discount, DiscountType, PaymentMethod, PaymentPart, Product, ProductCategory, TableState } from '../types'
import {
  calculatePaymentsTotal,
  calculateDiscountTotal,
  calculateFinalTotal,
  calculateGiftTotal,
  calculateOrderOriginalTotal,
  calculateOrderPayableTotal,
  calculateProratedDiscountTotal,
  calculateSubtotal,
  formatCurrency,
  getOrderUnitPrice,
  normalizePayments,
  paymentsCoverTotal,
  roundCurrency
} from '../billing'
import { loadSettings } from '../storage'

type SplitSelection = Record<string, number>

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
  onCloseTable: (tableId: string, payments: PaymentPart[]) => void
  onPaySelectedOrders: (tableId: string, selectedQuantities: SplitSelection, payments: PaymentPart[]) => void
  onUpdateNote: (tableId: string, note: string) => void
  onUpdateDiscount: (tableId: string, discount: Discount) => void
  onClearDiscount: (tableId: string) => void
  onTransferTable: (sourceTableId: string, targetTableId: string) => void
  onMergeTables: (sourceTableId: string, targetTableId: string) => void
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
  onPaySelectedOrders,
  onUpdateNote,
  onUpdateDiscount,
  onClearDiscount,
  onTransferTable,
  onMergeTables
}: Props) {
  const [settings] = React.useState(() => loadSettings())
  const [qty, setQty] = React.useState<number>(1)
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState('all')
  const [selectedQuantities, setSelectedQuantities] = React.useState<SplitSelection>({})
  const [cashAmount, setCashAmount] = React.useState('')
  const [cardAmount, setCardAmount] = React.useState('')
  const [otherAmount, setOtherAmount] = React.useState('')
  const [transferTargetId, setTransferTargetId] = React.useState('')
  const [mergeTargetId, setMergeTargetId] = React.useState('')
  const [discountTypeInput, setDiscountTypeInput] = React.useState<DiscountType>(table.discount?.type || 'percent')
  const [receiptPrintedAt, setReceiptPrintedAt] = React.useState(() => new Date())
  const [isReceiptPrintActive, setIsReceiptPrintActive] = React.useState(false)

  const categoryMap = React.useMemo(() => new Map(categories.map(category => [category.id, category])), [categories])
  const transferTargets = React.useMemo(() => {
    return tables.filter(item => item.id !== table.id && !item.open && item.orders.length === 0)
  }, [table.id, tables])
  const mergeTargets = React.useMemo(() => {
    return tables.filter(item => item.id !== table.id && item.open)
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
    if(mergeTargets.length === 0){
      setMergeTargetId('')
      return
    }

    if(!mergeTargets.find(item => item.id === mergeTargetId)){
      setMergeTargetId((mergeTargets.find(item => item.orders.length > 0) || mergeTargets[0]).id)
    }
  }, [mergeTargetId, mergeTargets])

  React.useEffect(() => {
    setDiscountTypeInput(table.discount?.type || 'percent')
  }, [table.discount?.type, table.id])

  React.useEffect(() => {
    const clearPrintMode = () => {
      document.body.classList.remove('printing')
      setIsReceiptPrintActive(false)
    }

    window.addEventListener('afterprint', clearPrintMode)
    return () => {
      window.removeEventListener('afterprint', clearPrintMode)
      document.body.classList.remove('printing')
    }
  }, [])

  React.useEffect(() => {
    setSelectedQuantities({})
    setCashAmount('')
    setCardAmount('')
    setOtherAmount('')
  }, [table.id])

  React.useEffect(() => {
    setSelectedQuantities(prev => {
      const next: SplitSelection = {}

      table.orders.forEach(order => {
        const selectedQty = Math.floor(Number(prev[order.id]) || 0)
        if(selectedQty > 0){
          next[order.id] = Math.min(selectedQty, order.qty)
        }
      })

      const prevKeys = Object.keys(prev)
      const nextKeys = Object.keys(next)
      const changed = prevKeys.length !== nextKeys.length || nextKeys.some(key => next[key] !== prev[key])

      return changed ? next : prev
    })
  }, [table.orders])

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
  const discountType: DiscountType = table.discount?.type || discountTypeInput
  const selectedOrders = React.useMemo(() => {
    return table.orders.flatMap(order => {
      const selectedQty = Math.min(order.qty, Math.max(0, Math.floor(Number(selectedQuantities[order.id]) || 0)))
      return selectedQty > 0 ? [{ ...order, qty: selectedQty }] : []
    })
  }, [selectedQuantities, table.orders])
  const selectedItemCount = selectedOrders.reduce((sum, order) => sum + order.qty, 0)
  const hasSelection = selectedOrders.length > 0
  const selectedSubtotal = calculateSubtotal(selectedOrders, allProducts)
  const selectedDiscountTotal = calculateProratedDiscountTotal(table.discount, selectedSubtotal, subtotal)
  const selectedTotal = roundCurrency(Math.max(0, selectedSubtotal - selectedDiscountTotal))
  const paymentTarget = hasSelection ? selectedTotal : finalTotal
  const paymentParts = normalizePayments([
    { method: 'Nakit', amount: Number(cashAmount) },
    { method: 'Kart', amount: Number(cardAmount) },
    { method: 'Diğer', amount: Number(otherAmount) }
  ])
  const paymentTotal = calculatePaymentsTotal(paymentParts)
  const paymentDifference = roundCurrency(paymentTarget - paymentTotal)
  const isPaymentBalanced = paymentsCoverTotal(paymentParts, paymentTarget)
  const canTakePayment = table.orders.length > 0 && isPaymentBalanced
  const receiptDate = receiptPrintedAt.toLocaleDateString('tr-TR')
  const receiptTime = receiptPrintedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

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

  const toggleOrderSelection = (orderId: string, checked: boolean, maxQty: number) => {
    setSelectedQuantities(prev => {
      if(!checked){
        const next = { ...prev }
        delete next[orderId]
        return next
      }

      return { ...prev, [orderId]: Math.max(1, Math.min(maxQty, prev[orderId] || 1)) }
    })
  }

  const updateSelectedQty = (orderId: string, rawValue: string, maxQty: number) => {
    const nextQty = Math.min(maxQty, Math.max(1, Math.floor(Number(rawValue) || 1)))
    setSelectedQuantities(prev => ({ ...prev, [orderId]: nextQty }))
  }

  const clearSelection = () => {
    setSelectedQuantities({})
  }

  const clearPaymentInputs = () => {
    setCashAmount('')
    setCardAmount('')
    setOtherAmount('')
  }

  const fillSinglePayment = (method: PaymentMethod) => {
    const value = paymentTarget > 0 ? String(paymentTarget) : ''
    setCashAmount(method === 'Nakit' ? value : '')
    setCardAmount(method === 'Kart' ? value : '')
    setOtherAmount(method === 'Diğer' ? value : '')
  }

  const completeSelectedPayment = () => {
    if(!hasSelection || !canTakePayment) return
    onPaySelectedOrders(table.id, selectedQuantities, paymentParts)
    clearSelection()
    clearPaymentInputs()
  }

  const closeFullBill = () => {
    if(hasSelection || !canTakePayment) return
    onCloseTable(table.id, paymentParts)
    clearPaymentInputs()
  }

  const mergeTarget = mergeTargets.find(item => item.id === mergeTargetId)
  const canMergeTable = table.open && table.orders.length > 0 && Boolean(mergeTarget) && Boolean(mergeTarget?.open) && Boolean(mergeTarget?.orders.length)

  const mergeCurrentTable = () => {
    if(!mergeTarget) return

    if(!confirm(`${table.name} içerisindeki tüm siparişler ${mergeTarget.name}'e taşınacak. Devam etmek istiyor musunuz?`)) return
    onMergeTables(table.id, mergeTarget.id)
  }

  const printReceipt = () => {
    if(!table.open || table.orders.length === 0) return

    setReceiptPrintedAt(new Date())
    setIsReceiptPrintActive(true)
    document.body.classList.add('printing')
    window.setTimeout(() => window.print(), 50)
  }

  return (
    <div className="card table-detail">
      <div className="section-header">
        <div>
          <h3>{table.name}</h3>
          <p className="muted">{table.open ? 'Açık adisyon' : 'Kapalı masa'}</p>
        </div>
        <div className="table-header-actions">
          <button className="btn" type="button" disabled={!table.open || table.orders.length === 0} onClick={printReceipt}>Yazdır</button>
          <span className={`status-pill ${table.open ? 'success' : 'muted-pill'}`}>{table.open ? 'Açık' : 'Kapalı'}</span>
        </div>
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

            <section className="tool-panel">
              <label>Masa Birleştir</label>
              <div className="discount-controls">
                <select value={mergeTargetId} onChange={e=>setMergeTargetId(e.target.value)} disabled={mergeTargets.length === 0}>
                  {mergeTargets.length === 0 && <option value="">Açık hedef masa yok</option>}
                  {mergeTargets.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}{item.orders.length === 0 ? ' (boş)' : ` (${item.orders.length} kalem)`}
                    </option>
                  ))}
                </select>
                <button className="btn" type="button" disabled={!canMergeTable} onClick={mergeCurrentTable}>Birleştir</button>
              </div>
              <p className="muted small-text">Kaynak ve hedef masa açık, siparişli ve farklı olmalıdır. İşlem geri alınamaz.</p>
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
                    <tr><th>Seç</th><th>Ürün</th><th>Adet</th><th>Tutar</th><th></th></tr>
                  </thead>
                  <tbody>
                    {table.orders.length === 0 && (
                      <tr><td colSpan={5} className="empty-cell">Bu adisyonda henüz ürün yok.</td></tr>
                    )}
                    {table.orders.map(order => {
                      const unitPrice = getOrderUnitPrice(order, allProducts)
                      const originalTotal = calculateOrderOriginalTotal(order, allProducts)
                      const payableTotal = calculateOrderPayableTotal(order, allProducts)
                      const product = allProducts.find(item => item.id === order.productId)
                      const selectedQty = selectedQuantities[order.id] || 0

                      return (
                        <tr key={order.id}>
                          <td>
                            <div className="split-select-controls">
                              <label className="check-row">
                                <input
                                  type="checkbox"
                                  checked={selectedQty > 0}
                                  onChange={e=>toggleOrderSelection(order.id, e.target.checked, order.qty)}
                                />
                                Seç
                              </label>
                              {selectedQty > 0 && (
                                <input
                                  className="split-qty"
                                  type="number"
                                  min={1}
                                  max={order.qty}
                                  value={selectedQty}
                                  aria-label="Ödenecek adet"
                                  onChange={e=>updateSelectedQty(order.id, e.target.value, order.qty)}
                                />
                              )}
                            </div>
                          </td>
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
            <div className="checkout-total-grid">
              <div>
                <span className="muted small-text">Ara Toplam</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
              <div>
                <span className="muted small-text">İkram</span>
                <strong>{formatCurrency(giftTotal)}</strong>
              </div>
              <div>
                <span className="muted small-text">İndirim</span>
                <strong>{formatCurrency(discountTotal)}</strong>
              </div>
              <div>
                <span className="muted small-text">Hesap Toplamı</span>
                <strong>{formatCurrency(finalTotal)}</strong>
              </div>
              <div>
                <span className="muted small-text">Seçili Ürün</span>
                <strong>{selectedItemCount}</strong>
              </div>
              <div>
                <span className="muted small-text">Seçili Ödenecek</span>
                <strong>{hasSelection ? formatCurrency(selectedTotal) : '-'}</strong>
              </div>
            </div>

            <div className="payment-panel">
              <div className="section-header compact">
                <div>
                  <h3>{hasSelection ? 'Seçili Ürün Ödemesi' : 'Hesap Kapatma'}</h3>
                  <p className="muted small-text">
                    {hasSelection
                      ? 'Seçili ürünler ödendikten sonra kalan ürünler masada kalır.'
                      : 'Hesabın tamamını tek veya çoklu ödeme ile kapatın.'}
                  </p>
                </div>
                {hasSelection && <button className="btn" type="button" onClick={clearSelection}>Seçimi Temizle</button>}
              </div>

              <div className="payment-target">
                <span>Ödenecek</span>
                <strong>{formatCurrency(paymentTarget)}</strong>
              </div>

              <div className="payment-grid">
                <label className="payment-field">
                  <span>Nakit</span>
                  <input type="number" min={0} step="0.01" value={cashAmount} onChange={e=>setCashAmount(e.target.value)} />
                </label>
                <label className="payment-field">
                  <span>Kart</span>
                  <input type="number" min={0} step="0.01" value={cardAmount} onChange={e=>setCardAmount(e.target.value)} />
                </label>
                <label className="payment-field">
                  <span>Diğer</span>
                  <input type="number" min={0} step="0.01" value={otherAmount} onChange={e=>setOtherAmount(e.target.value)} />
                </label>
              </div>

              <div className={`payment-balance ${canTakePayment ? 'ok' : 'warning'}`}>
                <span>Girilen ödeme: {formatCurrency(paymentTotal)}</span>
                <strong>
                  {paymentTarget === 0
                    ? 'Ödeme gerekmez'
                    : canTakePayment
                      ? 'Ödeme tamam'
                      : `${paymentDifference > 0 ? 'Eksik' : 'Fazla'}: ${formatCurrency(Math.abs(paymentDifference))}`}
                </strong>
              </div>

              <div className="form-actions">
                <button className="btn" type="button" disabled={table.orders.length === 0} onClick={()=>fillSinglePayment('Nakit')}>Tamamı Nakit</button>
                <button className="btn" type="button" disabled={table.orders.length === 0} onClick={()=>fillSinglePayment('Kart')}>Tamamı Kart</button>
                <button className="btn" type="button" disabled={table.orders.length === 0} onClick={()=>fillSinglePayment('Diğer')}>Tamamı Diğer</button>
                {hasSelection ? (
                  <button className="btn primary" type="button" disabled={!canTakePayment} onClick={completeSelectedPayment}>Seçili Ürünleri Öde</button>
                ) : (
                  <button className="btn primary" type="button" disabled={!canTakePayment} onClick={closeFullBill}>Hesabı Kapat</button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      <div className={`print-only ${isReceiptPrintActive ? 'print-active' : ''}`}>
        <div className="print-document">
          <div className="print-header">
            <h2>{settings.restaurantName}</h2>
            <p>Adisyon Fişi</p>
          </div>
          <div className="print-meta">
            <span>Masa</span>
            <strong>{table.name}</strong>
          </div>
          <div className="print-meta-grid">
            <div>
              <span>Tarih</span>
              <strong>{receiptDate}</strong>
            </div>
            <div>
              <span>Saat</span>
              <strong>{receiptTime}</strong>
            </div>
          </div>
          <table className="print-table">
            <thead>
              <tr><th>Ürün</th><th>Adet</th><th>Tutar</th></tr>
            </thead>
            <tbody>
              {table.orders.map(order => {
                const product = allProducts.find(item => item.id === order.productId)
                const lineTotal = calculateOrderPayableTotal(order, allProducts)

                return (
                  <tr key={order.id}>
                    <td>
                      {order.productName || product?.name || 'Bilinmiyor'}
                      {order.isGift && <small>İkram</small>}
                    </td>
                    <td>{order.qty}</td>
                    <td>{formatCurrency(lineTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="print-totals">
            <div><span>Ara Toplam</span><strong>{formatCurrency(subtotal)}</strong></div>
            <div><span>İndirim</span><strong>{formatCurrency(discountTotal)}</strong></div>
            <div><span>İkram</span><strong>{formatCurrency(giftTotal)}</strong></div>
            <div className="grand-total"><span>Genel Toplam</span><strong>{formatCurrency(finalTotal)}</strong></div>
          </div>
        </div>
      </div>
    </div>
  )
}
