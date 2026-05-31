import React from 'react'
import { TableState, Product, Order, ClosedBill } from '../types'
import { loadTables, saveTables, loadProducts, loadClosed, saveClosed } from '../storage'
import TableCard from '../components/TableCard'

export default function TableManagement(){
  const [tables, setTables] = React.useState<TableState[]>(() => {
    const t = loadTables()
    if(t.length===0){
      const generated = Array.from({length:6}).map((_,i)=>({id:String(i+1), name:`Masa ${i+1}`, open:false, orders:[] as Order[]} as TableState))
      saveTables(generated)
      return generated
    }
    return t
  })

  const [products] = React.useState<Product[]>(() => loadProducts())

  React.useEffect(()=> saveTables(tables), [tables])

  const onAddOrder = (tableId: string, productId: string, qty: number) => {
    if(!productId || !Number.isFinite(qty) || qty < 1) return

    const product = products.find(item => item.id === productId)
    if(!product || !product.active) return

    setTables(prev => prev.map(t=> {
      if(t.id !== tableId) return t
      const order: Order = {
        id: Date.now().toString(),
        productId,
        productName: product.name,
        unitPrice: product.price,
        qty
      }
      return {...t, orders: [...t.orders, order]}
    }))
  }

  const onRemoveOrder = (tableId: string, orderId: string) => {
    setTables(prev => prev.map(t=> t.id===tableId ? {...t, orders: t.orders.filter(o=>o.id!==orderId)} : t))
  }

  const toggleOpen = (tableId: string) => {
    const t = tables.find(x=>x.id===tableId)
    if(!t) return
    if(t.open){
      const closed = loadClosed()
      const total = t.orders.reduce((s,o)=>{
        const p = products.find(x=>x.id===o.productId)
        const unitPrice = o.unitPrice ?? p?.price ?? 0
        return s + unitPrice * o.qty
      }, 0)
      const bill: ClosedBill = { id: Date.now().toString(), tableId: t.id, tableName: t.name, total, timestamp: new Date().toISOString(), orders: t.orders }
      saveClosed([bill, ...closed])
      setTables(prev => prev.map(x=> x.id===tableId ? {...x, open:false, orders: []} : x))
    } else {
      setTables(prev => prev.map(x=> x.id===tableId ? {...x, open:true} : x))
    }
  }

  return (
    <div>
      <h2>Masalar</h2>
      <div className="container">
        <div className="column">
          {tables.map(t => (
            <TableCard key={t.id} table={t} products={products} onAddOrder={onAddOrder} onRemoveOrder={onRemoveOrder} onToggleOpen={toggleOpen} />
          ))}
        </div>
        <div className="column">
          <div className="card">
            <h3>Bilgiler</h3>
            <p>Ürün sayısı: {products.length}</p>
            <p>Aktif ürün sayısı: {products.filter(product => product.active).length}</p>
            <p>Kapanmış hesaplar: {loadClosed().length}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
