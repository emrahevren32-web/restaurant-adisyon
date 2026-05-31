import React from 'react'
import { Product, QRRequestItem, TableState, User } from '../types'
import {
  addActionLog,
  loadCategories,
  loadProducts,
  loadQRRequests,
  loadTables,
  saveQRRequests
} from '../storage'
import { formatCurrency, roundCurrency } from '../billing'

type Props = {
  slug: string
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

const slugify = (value: string) => {
  const normalized = value
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const titleFromSlug = (value: string) => {
  return value
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(part => part.charAt(0).toLocaleUpperCase('tr-TR') + part.slice(1))
    .join(' ') || 'Masa'
}

const findTableBySlug = (tables: TableState[], slug: string) => {
  const normalizedSlug = slugify(slug)
  return tables.find(table => {
    return slug === table.id
      || normalizedSlug === slugify(table.id)
      || normalizedSlug === slugify(table.name)
      || normalizedSlug === `masa-${slugify(table.id)}`
  })
}

const cartTotal = (items: CartItem[]) => {
  return roundCurrency(items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0))
}

export default function QRMenu({ slug }: Props){
  const [products] = React.useState<Product[]>(() => loadProducts())
  const [categories] = React.useState(() => loadCategories())
  const [tables] = React.useState<TableState[]>(() => loadTables())
  const [selectedCategory, setSelectedCategory] = React.useState('all')
  const [cart, setCart] = React.useState<Record<string, CartItem>>({})
  const [message, setMessage] = React.useState<Message>(null)

  const decodedSlug = React.useMemo(() => decodeURIComponent(slug), [slug])
  const table = React.useMemo(() => findTableBySlug(tables, decodedSlug), [decodedSlug, tables])
  const tableName = table?.name || titleFromSlug(decodedSlug)

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
    addActionLog({
      operationType: 'Garson çağrıldı',
      user: qrCustomerUser,
      tableId: table?.id,
      tableName,
      description: `${tableName} garson çağırdı.`
    })
    setMessage({ type: 'success', text: 'Garson çağrınız iletildi.' })
  }

  const sendOrderRequest = () => {
    if(cartItems.length === 0){
      setMessage({ type: 'error', text: 'Sipariş göndermek için sepete ürün ekleyin.' })
      return
    }

    const request = {
      id: `qr_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      tableId: table?.id,
      tableName,
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
        <span className="status-pill">QR Menü</span>
        <h1>{tableName}</h1>
        <p>Menüyü inceleyin, ürünleri sepete ekleyin ve garson onayı için talep gönderin.</p>
      </header>

      {message && <div className={`qr-message ${message.type}`}>{message.text}</div>}

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
    </div>
  )
}
