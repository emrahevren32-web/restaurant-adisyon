import React from 'react'
import { Product } from '../types'
import { loadProducts, saveProducts } from '../storage'
import ProductForm from '../components/ProductForm'

export default function Products(){
  const [items, setItems] = React.useState<Product[]>(() => loadProducts())

  React.useEffect(()=> saveProducts(items), [items])

  const add = (p: Product) => setItems(prev => [p, ...prev])
  const remove = (id: string) => setItems(prev => prev.filter(x=>x.id !== id))
  const edit = (id: string) => {
    const name = prompt('Yeni ad')
    const price = Number(prompt('Yeni fiyat'))
    if(name) setItems(prev => prev.map(x=> x.id===id ? {...x, name, price} : x))
  }

  return (
    <div>
      <h2>Ürünler</h2>
      <div style={{display:'flex', gap:16}}>
        <div style={{flex:1}}>
          <ProductForm onAdd={add} />
        </div>
        <div style={{flex:2}}>
          <div className="card">
            <h3>Liste</h3>
            <table>
              <thead><tr><th>Ad</th><th>Fiyat</th><th></th></tr></thead>
              <tbody>
                {items.map(p=> (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.price.toFixed(2)}</td>
                    <td>
                      <button className="btn" onClick={()=>edit(p.id)}>Düzenle</button>
                      <button className="btn" onClick={()=>remove(p.id)}>Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
