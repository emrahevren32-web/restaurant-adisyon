import React from 'react'
import { PremiumSpinner } from './PremiumLoading'
import { BarcodeIntegrationService } from '../barcode-engine/barcode-integration.service'
import type {
  BarcodeGenerateInput,
  BarcodePreviewResult,
  BarcodeReadResult,
  BarcodeType
} from '../barcode-engine/barcode.types'

type BarcodePreviewModalProps = {
  request: BarcodeGenerateInput | null
  bulkRequests?: BarcodeGenerateInput[]
  userName: string
  onClose: () => void
}

const BARCODE_TYPE_LABELS: Record<BarcodeType, string> = {
  CODE128: 'Code128',
  CODE39: 'Code39',
  EAN13: 'EAN13',
  QR: 'QR Referans'
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
}

export default function BarcodePreviewModal({
  bulkRequests = [],
  onClose,
  request,
  userName
}: BarcodePreviewModalProps){
  const [barcodeType, setBarcodeType] = React.useState<BarcodeType>(request?.barcodeType || 'CODE128')
  const [preview, setPreview] = React.useState<BarcodePreviewResult | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [quantity, setQuantity] = React.useState(2)
  const [scanValue, setScanValue] = React.useState('')
  const [readResult, setReadResult] = React.useState<BarcodeReadResult | null>(null)

  React.useEffect(() => {
    setBarcodeType(request?.barcodeType || 'CODE128')
    setPreview(null)
    setMessage('')
    setScanValue('')
    setReadResult(null)
  }, [request])

  React.useEffect(() => {
    let cancelled = false

    const createPreview = async () => {
      if(!request) return
      setLoading(true)
      setMessage('')
      try{
        const result = await BarcodeIntegrationService.createPreview({
          ...request,
          barcodeType
        }, userName)
        if(!cancelled) setPreview(result)
      } catch (error) {
        if(!cancelled) setMessage(error instanceof Error ? error.message : 'Barkod onizleme olusturulamadi.')
      } finally {
        if(!cancelled) setLoading(false)
      }
    }

    createPreview()
    return () => {
      cancelled = true
    }
  }, [barcodeType, request, userName])

  if(!request) return null

  const print = async (mode: 'SINGLE' | 'MULTIPLE' | 'BULK') => {
    if(!preview) return
    const targets = mode === 'BULK' && bulkRequests.length > 0
      ? bulkRequests.map(item => ({ ...item, barcodeType }))
      : [preview.record]

    try{
      await BarcodeIntegrationService.openPrintWindow({
        records: targets,
        mode,
        quantity,
        userName
      })
      setMessage(mode === 'BULK' ? 'Toplu barkod yazdirma penceresi acildi.' : 'Barkod yazdirma penceresi acildi.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Barkod yazdirilamadi.')
    }
  }

  const readBarcode = () => {
    const result = BarcodeIntegrationService.read(scanValue || preview?.record.barcodeValue || '', userName)
    setReadResult(result)
  }

  return (
    <div className="modal-backdrop barcode-preview-backdrop" role="presentation">
      <section className="barcode-preview-modal" role="dialog" aria-modal="true" aria-label="Barkod Önizleme">
        <div className="section-header compact barcode-preview-header">
          <div>
            <h3>Barkod Önizleme</h3>
            <p className="muted">{request.title || request.code} · {BarcodeIntegrationService.entityLabels[request.entityType]}</p>
          </div>
          <button className="btn" type="button" onClick={onClose}>Kapat</button>
        </div>

        <div className="barcode-preview-toolbar">
          <label className="form-field">
            <span>Barkod Tipi</span>
            <select value={barcodeType} onChange={event => setBarcodeType(event.target.value as BarcodeType)}>
              {BarcodeIntegrationService.supportedTypes.map(type => (
                <option key={type} value={type}>{BARCODE_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Çoklu Adet</span>
            <input type="number" min={1} max={500} value={quantity} onChange={event => setQuantity(Number(event.target.value))} />
          </label>
        </div>

        {message && <div className="settings-message error">{message}</div>}

        {loading ? (
          <>
            <PremiumSpinner size="medium" label="Barkod hazirlaniyor" showLabel />
          <div className="empty-state">Barkod hazırlanıyor.</div>
          </>
        ) : preview ? (
          <div className="barcode-preview-grid">
            <div className="barcode-preview-card">
              <strong>{preview.record.title}</strong>
              <span>{preview.record.moduleLabel} / {preview.record.entityLabel}</span>
              <img className="barcode-preview-image" src={preview.imageDataUrl} alt={preview.record.barcodeType} />
              <img className="barcode-preview-qr" src={preview.qrDataUrl} alt="QR Referans" />
            </div>

            <div className="barcode-preview-meta">
              <div><span>Entity Type</span><strong>{preview.record.entityType}</strong></div>
              <div><span>Entity Id</span><strong>{preview.record.entityId}</strong></div>
              <div><span>Kod</span><strong>{preview.record.code}</strong></div>
              <div><span>Lot</span><strong>{preview.record.lot || '-'}</strong></div>
              <div><span>Tarih</span><strong>{preview.record.date}</strong></div>
              <div><span>Barkod</span><strong>{preview.record.barcodeValue}</strong></div>
              <div><span>Immutable</span><strong>{preview.record.immutable ? 'Evet' : 'Hayır'}</strong></div>
              <div><span>Log</span><strong>{formatDateTime(preview.record.createdAt)} / {preview.record.createdBy}</strong></div>
            </div>
          </div>
        ) : null}

        {preview?.validation.errors.length ? (
          <div className="settings-message error">{preview.validation.errors.join(' ')}</div>
        ) : null}

        <div className="barcode-print-actions">
          <button className="btn primary" type="button" disabled={!preview} onClick={() => print('SINGLE')}>Tekli Yazdır</button>
          <button className="btn" type="button" disabled={!preview} onClick={() => print('MULTIPLE')}>Çoklu Yazdır</button>
          <button className="btn" type="button" disabled={!preview || bulkRequests.length === 0} onClick={() => print('BULK')}>Toplu Yazdır</button>
        </div>

        <div className="barcode-read-panel">
          <label className="form-field">
            <span>Barkod Okuma / Doğrulama</span>
            <input value={scanValue} onChange={event => setScanValue(event.target.value)} placeholder="Okunan barkod değerini yapıştırın" />
          </label>
          <button className="btn" type="button" onClick={readBarcode}>Oku</button>
          {readResult && (
            <div className={`barcode-read-result ${readResult.valid ? 'success' : 'error'}`}>
              {readResult.valid && readResult.parsed
                ? `Okundu: ${readResult.parsed.entityType} / ${readResult.parsed.code}`
                : readResult.errors.join(' ')}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
