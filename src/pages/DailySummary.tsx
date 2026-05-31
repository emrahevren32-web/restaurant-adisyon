import React from 'react'
import { loadClosed } from '../storage'

export default function DailySummary(){
  const [closed] = React.useState(() => loadClosed())
  const today = new Date().toISOString().slice(0,10)
  const todays = closed.filter(b => b.timestamp.slice(0,10) === today)
  const total = todays.reduce((s,b)=> s + b.total, 0)

  return (
    <div>
      <h2>Günlük Satışlar</h2>
      <div className="card">
        <h3>{today} Tarihli Satışlar</h3>
        <div>Toplam: <strong>{total.toFixed(2)}</strong></div>
        <table style={{marginTop:8}}>
          <thead><tr><th>Masa</th><th>Tutar</th><th>Saat</th></tr></thead>
          <tbody>
            {todays.map(b=> (
              <tr key={b.id}><td>{b.tableName}</td><td>{b.total.toFixed(2)}</td><td>{new Date(b.timestamp).toLocaleTimeString()}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
