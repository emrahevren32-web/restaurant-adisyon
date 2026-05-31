import React from 'react'
import { TableState, Product, Order } from '../types'

type Props = {
  table: TableState
  products: Product[]
  onAddOrder: (tableId: string, productId: string, qty: number) => void
  onRemoveOrder: (tableId: string, orderId: string) => void
  onToggleOpen: (tableId: string) => void
}

export default function TableCard({ table, products, onAddOrder, onRemoveOrder, onToggleOpen }: Props) {
  const [productId, setProductId] = React.useState<string>(products[0]?.id || '')
  const [qty, setQty] = React.useState<number>(1)

  const findProduct = (id: string) => products.find(p => p.id === id)

  const total = table.orders.reduce((s, o) => {
    const p = findProduct(o.productId)
    return s + (p ? p.price * o.qty : 0)
  }, 0)

  return (
    <div className="card">
      <h3>{table.name} {table.open ? '(Açık)' : '(Kapalı)'}</h3>
      <div>Orders:</div>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th></th></tr></thead>
        <tbody>
          {table.orders.map(o => {
            const p = findProduct(o.productId)
            return (
              <tr key={o.id}>
                <td>{p?.name || 'Bilinmiyor'}</td>
                <td>{o.qty}</td>
                <td>{(p ? p.price * o.qty : 0).toFixed(2)}</td>
                <td><button className="btn" onClick={() => onRemoveOrder(table.id, o.id)}>Kaldır</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{marginTop:8}}>Toplam: <strong>{total.toFixed(2)}</strong></div>

      <div style={{marginTop:8, display:'flex', gap:8}}>
        <select value={productId} onChange={e=>setProductId(e.target.value)}>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} - {p.price.toFixed(2)}</option>)}
        </select>
        <input type="number" value={qty} min={1} onChange={e=>setQty(Number(e.target.value))} style={{width:60}} />
        <button className="btn" onClick={() => onAddOrder(table.id, productId, qty)} disabled={!table.open}>Ekle</button>
        <button className="btn" onClick={()=>onToggleOpen(table.id)}>{table.open ? 'Kapat' : 'Aç'}</button>
      </div>
    </div>
  )
}
