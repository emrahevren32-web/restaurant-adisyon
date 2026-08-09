import React from 'react'
import { PrintIntegrationService } from '../print-engine/print-integration.service'
import type {
  PrintDocumentInput,
  PrintOrientation,
  PrintOutputType,
  PrintPreviewResult
} from '../print-engine/print.types'

type PrintPreviewModalProps = {
  moduleKey: PrintDocumentInput['moduleKey']
  documents: PrintDocumentInput[]
  userName: string
  onClose: () => void
}

export default function PrintPreviewModal({
  documents,
  moduleKey,
  onClose,
  userName
}: PrintPreviewModalProps){
  const templates = React.useMemo(() => PrintIntegrationService.listTemplates(moduleKey), [moduleKey])
  const [outputType, setOutputType] = React.useState<PrintOutputType>('A4')
  const [templateId, setTemplateId] = React.useState('')
  const [printerId, setPrinterId] = React.useState('')
  const [copies, setCopies] = React.useState(1)
  const [orientation, setOrientation] = React.useState<PrintOrientation>('PORTRAIT')
  const [selectedIds, setSelectedIds] = React.useState<string[]>(() => documents.map(document => document.entityId))
  const [preview, setPreview] = React.useState<PrintPreviewResult | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState('')

  React.useEffect(() => {
    setSelectedIds(documents.map(document => document.entityId))
    setTemplateId('')
    setPrinterId('')
    setMessage('')
  }, [documents])

  React.useEffect(() => {
    const matchingTemplate = templates.find(template => template.outputType === outputType)
    setTemplateId(prev => templates.some(template => template.id === prev && template.outputType === outputType)
      ? prev
      : matchingTemplate?.id || '')
    setPrinterId(prev => {
      const printers = PrintIntegrationService.listPrinters().filter(printer => printer.outputTypes.includes(outputType))
      return printers.some(printer => printer.id === prev)
        ? prev
        : PrintIntegrationService.getDefaultPrinter(outputType).id
    })
  }, [outputType, templates])

  const selectedDocuments = React.useMemo(() => {
    const selectedSet = new Set(selectedIds)
    return documents.filter(document => selectedSet.has(document.entityId))
  }, [documents, selectedIds])

  React.useEffect(() => {
    let cancelled = false

    const createPreview = async () => {
      if(selectedDocuments.length === 0){
        setPreview(null)
        return
      }
      setLoading(true)
      setMessage('')
      try{
        const result = await PrintIntegrationService.preview({
          moduleKey,
          documents: selectedDocuments,
          userName,
          templateId,
          outputType,
          printerId,
          copies,
          orientation
        })
        if(!cancelled) setPreview(result)
      } catch (error) {
        if(!cancelled) setMessage(error instanceof Error ? error.message : 'Print preview olusturulamadi.')
      } finally {
        if(!cancelled) setLoading(false)
      }
    }

    createPreview()
    return () => {
      cancelled = true
    }
  }, [copies, moduleKey, orientation, outputType, printerId, selectedDocuments, templateId, userName])

  if(documents.length === 0) return null

  const printers = PrintIntegrationService.listPrinters().filter(printer => printer.outputTypes.includes(outputType))
  const outputTemplates = templates.filter(template => template.outputType === outputType)

  const toggleDocument = (entityId: string) => {
    setSelectedIds(prev => prev.includes(entityId)
      ? prev.filter(id => id !== entityId)
      : [...prev, entityId])
  }

  const print = async () => {
    try{
      await PrintIntegrationService.openPrintWindow({
        moduleKey,
        documents: selectedDocuments,
        userName,
        templateId,
        outputType,
        printerId,
        copies,
        orientation
      })
      setMessage(`${selectedDocuments.length} dokuman yazdirma penceresi acildi.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Yazdirma basarisiz.')
    }
  }

  return (
    <div className="modal-backdrop print-preview-backdrop" role="presentation">
      <section className="print-preview-modal" role="dialog" aria-modal="true" aria-label="Print Preview">
        <div className="section-header compact">
          <div>
            <h3>Print Preview</h3>
            <p className="muted">{PrintIntegrationService.moduleLabels[moduleKey]} · {selectedDocuments.length} kayıt</p>
          </div>
          <button className="btn" type="button" onClick={onClose}>Kapat</button>
        </div>

        <div className="print-preview-toolbar">
          <label className="form-field">
            <span>Çıktı Tipi</span>
            <select value={outputType} onChange={event => setOutputType(event.target.value as PrintOutputType)}>
              {PrintIntegrationService.supportedOutputs.map(type => (
                <option key={type} value={type}>{PrintIntegrationService.outputLabels[type]}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Şablon</span>
            <select value={templateId} onChange={event => setTemplateId(event.target.value)}>
              {outputTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Yazıcı</span>
            <select value={printerId} onChange={event => setPrinterId(event.target.value)}>
              {printers.map(printer => <option key={printer.id} value={printer.id}>{printer.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Kopya</span>
            <input type="number" min={1} max={50} value={copies} onChange={event => setCopies(Number(event.target.value))} />
          </label>
          <label className="form-field">
            <span>Yön</span>
            <select value={orientation} onChange={event => setOrientation(event.target.value as PrintOrientation)}>
              <option value="PORTRAIT">Dikey</option>
              <option value="LANDSCAPE">Yatay</option>
            </select>
          </label>
        </div>

        {message && <div className="settings-message success">{message}</div>}
        {preview && !preview.validation.valid && <div className="settings-message error">{preview.validation.errors.join(' ')}</div>}

        <div className="print-preview-layout">
          <aside className="print-selection-panel">
            <div className="section-header compact">
              <h4>Toplu Seçim</h4>
              <button className="btn" type="button" onClick={() => setSelectedIds(documents.map(document => document.entityId))}>Tümünü Seç</button>
            </div>
            <div className="print-selection-list">
              {documents.map(document => (
                <label key={document.entityId}>
                  <input type="checkbox" checked={selectedIds.includes(document.entityId)} onChange={() => toggleDocument(document.entityId)} />
                  <span>
                    <strong>{document.entityCode}</strong>
                    <em>{document.title}</em>
                  </span>
                </label>
              ))}
            </div>
          </aside>

          <div className="print-preview-frame-wrap">
            {loading ? (
              <div className="empty-state">Önizleme hazırlanıyor.</div>
            ) : preview?.html ? (
              <iframe className="print-preview-frame" title="Print Preview" srcDoc={preview.html} />
            ) : (
              <div className="empty-state">Önizleme için kayıt seçin.</div>
            )}
          </div>
        </div>

        <div className="print-preview-actions">
          <button className="btn primary" type="button" disabled={selectedDocuments.length === 0 || !preview?.validation.valid} onClick={print}>Yazdır</button>
          <button className="btn" type="button" onClick={onClose}>Vazgeç</button>
        </div>
      </section>
    </div>
  )
}
