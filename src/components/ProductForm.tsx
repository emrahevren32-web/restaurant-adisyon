import React from 'react'
import { Product } from '../types'

type Props = {
  onAdd: (p: Product) => void
}

export default function ProductForm({ onAdd }: Props){
  const [name, setName] = React.useState('')
  const [price, setPrice] = React.useState<number>(0)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if(!name) return
    onAdd({ id: Date.now().toString(), name, price })
    setName('')
    setPrice(0)
  }

  return (
    <form onSubmit={submit} className="card">
      <h3>Ürün Ekle</h3>
      <div>
        <input placeholder="Ürün adı" value={name} onChange={e=>setName(e.target.value)} />
      </div>
      <div>
        <input type="number" step="0.01" value={price} onChange={e=>setPrice(Number(e.target.value))} />
      </div>
      <div style={{marginTop:8}}>
        <button className="btn" type="submit">Ekle</button>
      </div>
    </form>
  )
}
