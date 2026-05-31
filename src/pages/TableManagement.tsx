import React from 'react'
import { ClosedBill, Order, PaymentMethod, Product, ProductCategory, TableState, User } from '../types'
import { loadCategories, loadClosed, loadProducts, loadTables, saveClosed, saveTables } from '../storage'
import TableCard from '../components/TableCard'

type Props = { currentUser: User }

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY'
})

const formatCurrency = (value: number) => currencyFormatter.format(value)
const createId = (prefix: string) => `${prefix}_${Date.now()}`

const calculateOrderTotal = (order: Order, products: Product[]) => {
  const product = products.find(item => item.id === order.productId)
  const unitPrice = order.unitPrice ?? product?.price ?? 0
  return unitPrice * order.qty
}

const calculateTableTotal = (table: TableState, products: Product[]) => {
  return table.orders.reduce((sum, order) => sum + calculateOrderTotal(order, products), 0)
}

export default function TableManagement({ currentUser }: Props){
  const [tables, setTables] = React.useState<TableState[]>(() => {
    const storedTables = loadTables()
    if(storedTables.length===0){
      const generated = Array.from({length:6}).map((_,i)=>({
        id:String(i+1),
        name:`Masa ${i+1}`,
        open:false,
        orders:[] as Order[]
      } as TableState))
      saveTables(generated)
      return generated
    }
    return storedTables
  })

  const [products] = React.useState<Product[]>(() => loadProducts())
  const [categories] = React.useState<ProductCategory[]>(() => loadCategories())
  const [selectedTableId, setSelectedTableId] = React.useState(() => tables[0]?.id || '')
  const [newTableName, setNewTableName] = React.useState('')
  const [tableError, setTableError] = React.useState('')

  const canManageTables = currentUser.role === 'Admin'

  React.useEffect(()=> saveTables(tables), [tables])

  React.useEffect(() => {
    if(tables.length === 0){
      setSelectedTableId('')
      return
    }

    if(!tables.find(table => table.id === selectedTableId)){
      setSelectedTableId(tables[0].id)
    }
  }, [selectedTableId, tables])

  const selectedTable = tables.find(table => table.id === selectedTableId) || tables[0]
  const activeProducts = products.filter(product => product.active)
  const openTableCount = tables.filter(table => table.open).length
  const activeTotal = tables.reduce((sum, table) => sum + calculateTableTotal(table, products), 0)
  const closedCount = loadClosed().length

  const addTable = (e: React.FormEvent) => {
    e.preventDefault()
    if(!canManageTables){
      setTableError('Masa yönetimi için Admin yetkisi gereklidir.')
      return
    }

    const name = newTableName.trim()
    if(!name){
      setTableError('Masa adı zorunludur.')
      return
    }

    if(tables.some(table => table.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))){
      setTableError('Bu masa adı zaten mevcut.')
      return
    }

    const table: TableState = { id: createId('tbl'), name, open:false, orders:[] }
    setTables(prev => [...prev, table])
    setSelectedTableId(table.id)
    setNewTableName('')
    setTableError('')
  }

  const renameTable = (tableId: string) => {
    if(!canManageTables){
      setTableError('Masa yönetimi için Admin yetkisi gereklidir.')
      return
    }

    const table = tables.find(item => item.id === tableId)
    if(!table) return

    const nextName = prompt('Yeni masa adı', table.name)?.trim()
    if(!nextName) return

    if(tables.some(item => item.id !== tableId && item.name.toLocaleLowerCase('tr-TR') === nextName.toLocaleLowerCase('tr-TR'))){
      setTableError('Bu masa adı zaten mevcut.')
      return
    }

    setTables(prev => prev.map(item => item.id === tableId ? { ...item, name: nextName } : item))
    setTableError('')
  }

  const deleteTable = (tableId: string) => {
    if(!canManageTables){
      setTableError('Masa yönetimi için Admin yetkisi gereklidir.')
      return
    }

    const table = tables.find(item => item.id === tableId)
    if(!table) return

    if(table.open || table.orders.length > 0){
      setTableError('Açık adisyonu olan masa silinemez.')
      return
    }

    if(!confirm(`${table.name} silinecek. Emin misiniz?`)) return
    setTables(prev => prev.filter(item => item.id !== tableId))
    setTableError('')
  }

  const openTable = (tableId: string) => {
    setTables(prev => prev.map(table => table.id === tableId ? { ...table, open:true } : table))
  }

  const addOrder = (tableId: string, productId: string, qty: number) => {
    if(!productId || !Number.isFinite(qty) || qty < 1) return

    const product = products.find(item => item.id === productId)
    if(!product || !product.active) return

    setTables(prev => prev.map(table => {
      if(table.id !== tableId || !table.open) return table

      const existingOrder = table.orders.find(order => order.productId === productId && (order.unitPrice ?? product.price) === product.price)
      if(existingOrder){
        return {
          ...table,
          orders: table.orders.map(order => order.id === existingOrder.id ? { ...order, qty: order.qty + qty } : order)
        }
      }

      const order: Order = {
        id: createId('ord'),
        productId,
        productName: product.name,
        unitPrice: product.price,
        qty
      }
      return {...table, orders: [...table.orders, order]}
    }))
  }

  const updateOrderQty = (tableId: string, orderId: string, qty: number) => {
    setTables(prev => prev.map(table => {
      if(table.id !== tableId) return table
      if(qty < 1){
        return { ...table, orders: table.orders.filter(order => order.id !== orderId) }
      }
      return { ...table, orders: table.orders.map(order => order.id === orderId ? { ...order, qty } : order) }
    }))
  }

  const removeOrder = (tableId: string, orderId: string) => {
    setTables(prev => prev.map(table => table.id===tableId ? {...table, orders: table.orders.filter(order=>order.id!==orderId)} : table))
  }

  const closeTable = (tableId: string, paymentMethod: PaymentMethod) => {
    const table = tables.find(item => item.id === tableId)
    if(!table || !table.open) return

    const total = calculateTableTotal(table, products)
    if(table.orders.length > 0){
      const closed = loadClosed()
      const bill: ClosedBill = {
        id: createId('bill'),
        tableId: table.id,
        tableName: table.name,
        total,
        timestamp: new Date().toISOString(),
        orders: table.orders,
        paymentMethod,
        closedByUserId: currentUser.id,
        closedByFullName: currentUser.fullName
      }
      saveClosed([bill, ...closed])
    }

    setTables(prev => prev.map(item => item.id===tableId ? {...item, open:false, orders: []} : item))
  }

  return (
    <div className="tables-page">
      <div className="page-title">
        <div>
          <h2>Masalar</h2>
          <p className="muted">Açık adisyonları takip edin, ürün ekleyin ve hesabı ödeme yöntemiyle kapatın.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Masa</span>
          <strong>{tables.length}</strong>
        </div>
        <div className="metric-card">
          <span>Açık Masa</span>
          <strong>{openTableCount}</strong>
        </div>
        <div className="metric-card">
          <span>Açık Adisyon</span>
          <strong>{formatCurrency(activeTotal)}</strong>
        </div>
        <div className="metric-card">
          <span>Kapanmış Hesap</span>
          <strong>{closedCount}</strong>
        </div>
      </div>

      {tableError && <div className="form-error">{tableError}</div>}

      <div className="tables-layout">
        <section className="card">
          <div className="section-header compact">
            <h3>Masa Planı</h3>
            {canManageTables && <span className="status-pill">Admin</span>}
          </div>

          {canManageTables && (
            <form className="inline-form" onSubmit={addTable}>
              <input placeholder="Yeni masa adı" value={newTableName} onChange={e=>setNewTableName(e.target.value)} />
              <button className="btn primary" type="submit">Ekle</button>
            </form>
          )}

          <div className="table-grid">
            {tables.map(table => {
              const tableTotal = calculateTableTotal(table, products)
              const isSelected = table.id === selectedTable?.id
              return (
                <button
                  className={`table-tile ${table.open ? 'open' : ''} ${isSelected ? 'selected' : ''}`}
                  key={table.id}
                  onClick={()=>setSelectedTableId(table.id)}
                  type="button"
                >
                  <span>{table.name}</span>
                  <strong>{formatCurrency(tableTotal)}</strong>
                  <small>{table.open ? `${table.orders.length} kalem` : 'Kapalı'}</small>
                </button>
              )
            })}
          </div>

          {selectedTable && canManageTables && (
            <div className="table-admin-actions">
              <button className="btn" onClick={()=>renameTable(selectedTable.id)}>Masayı Düzenle</button>
              <button className="btn" onClick={()=>deleteTable(selectedTable.id)}>Masayı Sil</button>
            </div>
          )}
        </section>

        <section>
          {selectedTable ? (
            <TableCard
              table={selectedTable}
              products={activeProducts}
              allProducts={products}
              categories={categories}
              onAddOrder={addOrder}
              onUpdateOrderQty={updateOrderQty}
              onRemoveOrder={removeOrder}
              onOpenTable={openTable}
              onCloseTable={closeTable}
            />
          ) : (
            <div className="card empty-state">Henüz masa bulunmuyor.</div>
          )}
        </section>
      </div>
    </div>
  )
}
