import React from 'react'
import * as QRCode from 'qrcode'
import { TableState } from '../types'
import { loadSettings, loadTables } from '../storage'

type PrintMode = 'single' | 'all' | null

const QR_OPTIONS = {
  errorCorrectionLevel: 'M' as const,
  margin: 2,
  width: 240
}

const getQRPath = (table: TableState) => `/qr/${encodeURIComponent(table.id)}`

const sortTables = (tables: TableState[]) => {
  return [...tables].sort((a, b) => a.name.localeCompare(b.name, 'tr-TR', { numeric: true }))
}

export default function QRCodes(){
  const [settings] = React.useState(() => loadSettings())
  const [tables, setTables] = React.useState<TableState[]>(() => sortTables(loadTables()))
  const [qrImages, setQrImages] = React.useState<Record<string, string>>({})
  const [previewTableId, setPreviewTableId] = React.useState('')
  const [printTables, setPrintTables] = React.useState<TableState[]>([])
  const [printMode, setPrintMode] = React.useState<PrintMode>(null)
  const [error, setError] = React.useState('')

  const refreshTables = React.useCallback(() => {
    setTables(sortTables(loadTables()))
  }, [])

  React.useEffect(() => {
    refreshTables()
    const intervalId = window.setInterval(refreshTables, 3000)
    window.addEventListener('storage', refreshTables)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('storage', refreshTables)
    }
  }, [refreshTables])

  React.useEffect(() => {
    let cancelled = false

    const createCodes = async () => {
      try {
        const entries = await Promise.all(tables.map(async table => {
          const image = await QRCode.toDataURL(getQRPath(table), QR_OPTIONS)
          return [table.id, image] as const
        }))

        if(!cancelled){
          setQrImages(Object.fromEntries(entries))
          setError('')
        }
      } catch {
        if(!cancelled) setError('QR kodlar oluşturulamadı. Lütfen sayfayı yenileyin.')
      }
    }

    createCodes()
    return () => {
      cancelled = true
    }
  }, [tables])

  React.useEffect(() => {
    if(previewTableId && !tables.some(table => table.id === previewTableId)){
      setPreviewTableId('')
    }
  }, [previewTableId, tables])

  React.useEffect(() => {
    const clearPrintMode = () => {
      document.body.classList.remove('printing')
      setPrintMode(null)
      setPrintTables([])
    }

    window.addEventListener('afterprint', clearPrintMode)
    return () => {
      window.removeEventListener('afterprint', clearPrintMode)
      document.body.classList.remove('printing')
    }
  }, [])

  const previewTable = tables.find(table => table.id === previewTableId) || null
  const allQRCodesReady = tables.length > 0 && tables.every(table => qrImages[table.id])

  const startPrint = (items: TableState[], mode: Exclude<PrintMode, null>) => {
    if(items.length === 0) return

    setPrintTables(items)
    setPrintMode(mode)
    document.body.classList.add('printing')
    window.setTimeout(() => window.print(), 50)
  }

  return (
    <div className="qr-codes-page">
      <div className="page-title">
        <div>
          <h2>QR Kodlar</h2>
          <p className="muted">Masalara ait QR menü linklerini oluşturun, önizleyin ve yazdırın.</p>
        </div>
        <button className="btn primary" disabled={!allQRCodesReady} onClick={() => startPrint(tables, 'all')} type="button">
          Tüm QR Kodları Yazdır
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <section className="card">
        <div className="section-header compact">
          <div>
            <h3>QR Kod Listesi</h3>
            <p className="muted">{tables.length} masa listeleniyor. Liste otomatik yenilenir.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Masa adı</th>
                <th>QR linki</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tables.length === 0 && (
                <tr><td colSpan={3} className="empty-cell">Kayıtlı masa bulunmuyor.</td></tr>
              )}
              {tables.map(table => (
                <tr key={table.id}>
                  <td>
                    <strong>{table.name}</strong>
                    <div className="muted small-text">Masa ID: {table.id}</div>
                  </td>
                  <td>
                    <a className="qr-link" href={getQRPath(table)} target="_blank" rel="noreferrer">{getQRPath(table)}</a>
                  </td>
                  <td className="actions-cell">
                    <button className="btn" onClick={() => setPreviewTableId(table.id)} type="button">QR Gör</button>
                    <button className="btn" disabled={!qrImages[table.id]} onClick={() => startPrint([table], 'single')} type="button">Yazdır</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="section-header compact">
          <h3>QR Önizleme</h3>
        </div>

        {!previewTable ? (
          <div className="empty-state">Önizlemek için listeden bir masa seçin.</div>
        ) : (
          <div className="qr-code-preview">
            <div className="qr-print-card">
              <h3>{settings.restaurantName}</h3>
              <strong>{previewTable.name}</strong>
              {qrImages[previewTable.id] ? (
                <img src={qrImages[previewTable.id]} alt={`${previewTable.name} QR kodu`} />
              ) : (
                <div className="empty-state">QR hazırlanıyor.</div>
              )}
              <span>{getQRPath(previewTable)}</span>
            </div>
            <div className="qr-preview-actions">
              <button className="btn primary" disabled={!qrImages[previewTable.id]} onClick={() => startPrint([previewTable], 'single')} type="button">Bu QR Kodunu Yazdır</button>
              <a className="btn" href={getQRPath(previewTable)} target="_blank" rel="noreferrer">Menüyü Aç</a>
            </div>
          </div>
        )}
      </section>

      <div className={`print-only ${printMode ? 'print-active' : ''}`}>
        <div className={`qr-print-document ${printMode === 'all' ? 'all' : 'single'}`}>
          {printTables.map(table => (
            <div className="qr-print-card" key={table.id}>
              <h3>{settings.restaurantName}</h3>
              <strong>{table.name}</strong>
              {qrImages[table.id] && <img src={qrImages[table.id]} alt={`${table.name} QR kodu`} />}
              <span>{getQRPath(table)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
