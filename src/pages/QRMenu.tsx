import React from 'react'
import { Product, QRRequestItem, TableState, User } from '../types'
import {
  addActionLog,
  loadCategories,
  loadProducts,
  loadQRRequests,
  loadSettings,
  loadTables,
  loadWaiterCalls,
  saveQRRequests,
  saveWaiterCalls
} from '../storage'
import { formatCurrency, roundCurrency } from '../billing'

type Props = {
  tableId: string
}

type CartItem = QRRequestItem
type Message = { type: 'success' | 'error'; text: string } | null

const qrCustomerUser: User = {
  id: 'qr_customer',
  fullName: 'QR Müşteri',
  username: 'qr_customer',
  password: '',
  role: 'Garson',
  active: true
}

const cartTotal = (items: CartItem[]) => {
  return roundCurrency(items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0))
}

export default function QRMenu({ tableId }: Props){
  const [products] = React.useState<Product[]>(() => loadProducts())
  const [categories] = React.useState(() => loadCategories())
  const [tables] = React.useState<TableState[]>(() => loadTables())
  const [settings] = React.useState(() => loadSettings())
  const [selectedCategory, setSelectedCategory] = React.useState('all')
  const [cart, setCart] = React.useState<Record<string, CartItem>>({})
  const [message, setMessage] = React.useState<Message>(null)

  const decodedTableId = React.useMemo(() => decodeURIComponent(tableId), [tableId])
  const table = React.useMemo(() => tables.find(item => item.id === decodedTableId), [decodedTableId, tables])
  const tableName = table?.name || 'Masa bulunamadı'

  const activeCategoryIds = React.useMemo(() => {
    return new Set(categories.filter(category => category.active).map(category => category.id))
  }, [categories])

  const activeProducts = React.useMemo(() => {
    return products.filter(product => product.active && activeCategoryIds.has(product.categoryId))
  }, [activeCategoryIds, products])

  const visibleCategories = React.useMemo(() => {
    return categories.filter(category => {
      return category.active && activeProducts.some(product => product.categoryId === category.id)
    })
  }, [activeProducts, categories])

  const visibleProducts = React.useMemo(() => {
    if(selectedCategory === 'all') return activeProducts
    return activeProducts.filter(product => product.categoryId === selectedCategory)
  }, [activeProducts, selectedCategory])

  const categoryNameById = React.useMemo(() => {
    return new Map(categories.map(category => [category.id, category.name]))
  }, [categories])

  const cartItems = React.useMemo(() => Object.values(cart), [cart])
  const total = cartTotal(cartItems)

  React.useEffect(() => {
    if(selectedCategory === 'all') return
    if(visibleCategories.some(category => category.id === selectedCategory)) return
    setSelectedCategory('all')
  }, [selectedCategory, visibleCategories])

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev[product.id]
      return {
        ...prev,
        [product.id]: {
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          qty: existing ? existing.qty + 1 : 1
        }
      }
    })
    setMessage(null)
  }

  const updateQty = (productId: string, qty: number) => {
    setCart(prev => {
      const existing = prev[productId]
      if(!existing) return prev

      if(qty <= 0){
        const next = { ...prev }
        delete next[productId]
        return next
      }

      return {
        ...prev,
        [productId]: { ...existing, qty }
      }
    })
  }

  const removeFromCart = (productId: string) => updateQty(productId, 0)

  const callWaiter = () => {
    if(!table){
      setMessage({ type: 'error', text: 'Bu QR kod kayıtlı bir masaya bağlı değil.' })
      return
    }

    const now = new Date().toISOString()
    saveWaiterCalls([{
      id: `call_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      tableId: table.id,
      tableName: table.name,
      status: 'Bekliyor',
      createdAt: now
    }, ...loadWaiterCalls()])

    addActionLog({
      operationType: 'Garson çağrıldı',
      user: qrCustomerUser,
      tableId: table.id,
      tableName: table.name,
      description: `${table.name} garson çağırdı.`
    })
    setMessage({ type: 'success', text: 'Garson çağrınız iletildi.' })
  }

  const sendOrderRequest = () => {
    if(!table){
      setMessage({ type: 'error', text: 'Bu QR kod kayıtlı bir masaya bağlı değil.' })
      return
    }

    if(cartItems.length === 0){
      setMessage({ type: 'error', text: 'Sipariş göndermek için sepete ürün ekleyin.' })
      return
    }

    const request = {
      id: `qr_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      tableId: table.id,
      tableName: table.name,
      items: cartItems,
      status: 'Garson Onayı Bekliyor' as const,
      createdAt: new Date().toISOString()
    }

    saveQRRequests([request, ...loadQRRequests()])
    setCart({})
    setMessage({ type: 'success', text: 'Sipariş talebiniz garson onayına gönderildi.' })
  }

  return (
    <div className="qr-menu-page">
      <header className="qr-menu-header">
        <div className="qr-menu-brand">
          {settings.logoUrl && <img src={settings.logoUrl} alt={`${settings.restaurantName} logosu`} />}
          <div>
            <strong>{settings.restaurantName}</strong>
            <span>QR Menü</span>
          </div>
        </div>
        <h1>{tableName}</h1>
        <p>Menüyü inceleyin, ürünleri sepete ekleyin ve garson onayı için talep gönderin.</p>
      </header>

      {message && <div className={`qr-message ${message.type}`}>{message.text}</div>}

      {!table && (
        <section className="card qr-invalid-card">
          <h2>Masa bulunamadı</h2>
          <p className="muted">Bu QR bağlantısı geçerli bir masa ID değerine bağlı değil. Lütfen işletme personelinden güncel QR kodu isteyin.</p>
        </section>
      )}

      {table && (
      <div className="qr-menu-layout">
        <main className="qr-menu-main">
          <div className="qr-category-tabs" aria-label="Kategoriler">
            <button
              className={`btn ${selectedCategory === 'all' ? 'primary' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              Tümü
            </button>
            {visibleCategories.map(category => (
              <button
                className={`btn ${selectedCategory === category.id ? 'primary' : ''}`}
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="qr-product-list">
            {visibleProducts.length === 0 && (
              <div className="empty-state">Aktif menü ürünü bulunamadı.</div>
            )}
            {visibleProducts.map(product => (
              <article className="qr-product-card" key={product.id}>
                <div>
                  <span className="small-text">{categoryNameById.get(product.categoryId) || 'Genel'}</span>
                  <h2>{product.name}</h2>
                  {product.description && <p>{product.description}</p>}
                </div>
                <div className="qr-product-actions">
                  <strong>{formatCurrency(product.price)}</strong>
                  <button className="btn primary" onClick={() => addToCart(product)}>Ekle</button>
                </div>
              </article>
            ))}
          </div>
        </main>

        <aside className="qr-cart-panel">
          <section className="card">
            <div className="section-header compact">
              <h2>Sepet</h2>
              <span className="status-pill">{cartItems.length} ürün</span>
            </div>

            {cartItems.length === 0 ? (
              <p className="muted">Sepetiniz boş.</p>
            ) : (
              <div className="qr-cart-list">
                {cartItems.map(item => (
                  <div className="qr-cart-row" key={item.productId}>
                    <div>
                      <strong>{item.productName}</strong>
                      <span>{formatCurrency(item.unitPrice)} x {item.qty}</span>
                    </div>
                    <div className="qr-cart-controls">
                      <button className="btn icon-btn" onClick={() => updateQty(item.productId, item.qty - 1)}>-</button>
                      <span>{item.qty}</span>
                      <button className="btn icon-btn" onClick={() => updateQty(item.productId, item.qty + 1)}>+</button>
                      <button className="btn" onClick={() => removeFromCart(item.productId)}>Sil</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="qr-cart-total">
              <span>Toplam</span>
              <strong>{formatCurrency(total)}</strong>
            </div>

            <div className="qr-sticky-actions">
              <button className="btn" onClick={callWaiter}>Garson Çağır</button>
              <button className="btn primary" disabled={cartItems.length === 0} onClick={sendOrderRequest}>Sipariş Gönder</button>
            </div>
          </section>
        </aside>
      </div>
      )}
    </div>
  )
}
