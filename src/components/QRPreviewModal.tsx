import React from 'react'
import { QRIntegrationService } from '../qr-engine/qr-integration.service'
import type {
  QRDecodeResult,
  QRGenerateInput,
  QRPreviewResult,
  QRPrintMode
} from '../qr-engine/qr.types'

type QRPreviewModalProps = {
  request: QRGenerateInput | null
  bulkRequests?: QRGenerateInput[]
  userName: string
  onClose: () => void
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

export default function QRPreviewModal({
  bulkRequests = [],
  onClose,
  request,
  userName
}: QRPreviewModalProps){
  const [preview, setPreview] = React.useState<QRPreviewResult | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [quantity, setQuantity] = React.useState(2)
  const [decodeValue, setDecodeValue] = React.useState('')
  const [decodeResult, setDecodeResult] = React.useState<QRDecodeResult | null>(null)

  React.useEffect(() => {
    setPreview(null)
    setMessage('')
    setDecodeValue('')
    setDecodeResult(null)
  }, [request])

  React.useEffect(() => {
    let cancelled = false

    const createPreview = async () => {
      if(!request) return
      setLoading(true)
      setMessage('')
      try{
        const result = await QRIntegrationService.createPreview(request, userName)
        if(!cancelled){
          setPreview(result)
          setDecodeValue(result.record.payload)
          setDecodeResult(result.decode)
        }
      } catch (error) {
        if(!cancelled) setMessage(error instanceof Error ? error.message : 'QR onizleme olusturulamadi.')
      } finally {
        if(!cancelled) setLoading(false)
      }
    }

    createPreview()
    return () => {
      cancelled = true
    }
  }, [request, userName])

  if(!request) return null

  const print = async (mode: QRPrintMode) => {
    if(!preview) return
    const targets = mode === 'A4' && bulkRequests.length > 0
      ? bulkRequests
      : [preview.record]

    try{
      await QRIntegrationService.openPrintWindow({
        records: targets,
        mode,
        quantity,
        userName
      })
      setMessage(mode === 'A4' && bulkRequests.length > 0 ? 'Toplu QR yazdirma penceresi acildi.' : 'QR yazdirma penceresi acildi.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'QR yazdirilamadi.')
    }
  }

  const decode = () => {
    setDecodeResult(QRIntegrationService.decode(decodeValue || preview?.record.payload || '', userName))
  }

  return (
    <div className="modal-backdrop barcode-preview-backdrop qr-preview-backdrop" role="presentation">
      <section className="barcode-preview-modal qr-preview-modal" role="dialog" aria-modal="true" aria-label="QR Onizleme">
        <div className="section-header compact barcode-preview-header">
          <div>
            <h3>QR Önizleme</h3>
            <p className="muted">{request.title || request.code} · {QRIntegrationService.entityLabels[request.entityType]}</p>
          </div>
          <button className="btn" type="button" onClick={onClose}>Kapat</button>
        </div>

        <div className="barcode-preview-toolbar">
          <label className="form-field">
            <span>Çoklu Adet</span>
            <input type="number" min={1} max={500} value={quantity} onChange={event => setQuantity(Number(event.target.value))} />
          </label>
          <label className="form-field">
            <span>Modül</span>
            <input value={QRIntegrationService.moduleLabels[request.moduleKey]} readOnly />
          </label>
        </div>

        {message && <div className="settings-message error">{message}</div>}

        {loading ? (
          <div className="empty-state">QR hazırlanıyor.</div>
        ) : preview ? (
          <div className="barcode-preview-grid qr-preview-grid">
            <div className="barcode-preview-card qr-preview-card">
              <strong>{preview.record.title}</strong>
              <span>{preview.record.moduleLabel} / {preview.record.entityLabel}</span>
              <img className="barcode-preview-qr qr-preview-image" src={preview.imageDataUrl} alt="QR" />
            </div>

            <div className="barcode-preview-meta">
              <div><span>Entity Type</span><strong>{preview.record.entityType}</strong></div>
              <div><span>Entity Id</span><strong>{preview.record.entityId}</strong></div>
              <div><span>Kod</span><strong>{preview.record.code}</strong></div>
              <div><span>Lot No</span><strong>{preview.record.lotNo || '-'}</strong></div>
              <div><span>Batch</span><strong>{preview.record.batch || '-'}</strong></div>
              <div><span>Tarih</span><strong>{preview.record.date}</strong></div>
              <div><span>Versiyon</span><strong>{preview.record.version}</strong></div>
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
          <button className="btn" type="button" disabled={!preview} onClick={() => print('LABEL')}>Etiket</button>
          <button className="btn" type="button" disabled={!preview} onClick={() => print('A4')}>A4</button>
        </div>

        <div className="barcode-read-panel">
          <label className="form-field">
            <span>QR Decode</span>
            <input value={decodeValue} onChange={event => setDecodeValue(event.target.value)} placeholder="QR payload" />
          </label>
          <button className="btn" type="button" onClick={decode}>Decode</button>
          {decodeResult && (
            <div className={`barcode-read-result ${decodeResult.valid ? 'success' : 'error'}`}>
              {decodeResult.valid && decodeResult.metadata
                ? `${decodeResult.moduleLabel} / ${decodeResult.entityLabel} / ${decodeResult.metadata.code}`
                : decodeResult.errors.join(' ')}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
