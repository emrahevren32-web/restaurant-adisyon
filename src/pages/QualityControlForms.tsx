import React from 'react'
import {
  QUALITY_CONTROL_FORM_RESULTS,
  QUALITY_CONTROL_FORM_RESULT_LABELS,
  calculateQualityControlOverallScore,
  formatQualityControlScore,
  getQualityControlFormDisplayNo,
  loadQualityControlFormRecords,
  loadQualityControlTemplateRecords,
  saveQualityControlFormRecords,
  saveQualityControlTemplateRecords
} from '../quality-controls/quality-control-form.mock'
import type {
  QualityControlFormItem,
  QualityControlFormRecord,
  QualityControlFormResult,
  QualityControlTemplateRecord
} from '../quality-controls/quality-control-form.types'
import { loadQualityControlRecords } from '../quality-controls/quality-control.mock'
import type { QualityControl } from '../quality-controls/quality-control.types'
import { loadInventoryLotRecords } from '../inventory-lots/inventory-lot.mock'
import { loadGoodsReceiptRecords } from '../goods-receipts/goods-receipt.mock'
import { loadPurchaseOrderRecords } from '../purchase-orders/purchase-order.mock'
import { loadPurchaseApprovalRecords } from '../purchase-approvals/purchase-approval.mock'
import { loadRequestForQuotationRecords } from '../request-for-quotations/request-for-quotation.mock'
import { loadPurchaseRequestRecords } from '../purchase-requests/purchase-request.mock'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import { loadBranches, loadStockItems } from '../storage'

type FilterValue = 'all'
type ResultFilter = QualityControlFormResult | FilterValue
type PanelMode = 'detail' | 'form' | 'template'

type QualityControlFormsInitialData = {
  qualityControls: QualityControl[]
  templates: QualityControlTemplateRecord[]
  forms: QualityControlFormRecord[]
}

type FormBuilderItem = {
  templateItemId: string
  title: string
  description: string
  isRequired: boolean
  result: QualityControlFormResult | ''
  notes: string
}

type FormBuilderState = {
  qualityControlId: string
  templateId: string
  notes: string
  items: FormBuilderItem[]
}

type TemplateBuilderItem = {
  id: string
  title: string
  description: string
  isRequired: boolean
}

type TemplateBuilderState = {
  name: string
  description: string
  isActive: boolean
  items: TemplateBuilderItem[]
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getTodayIso = () => new Date().toISOString()

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const getResultClass = (result: QualityControlFormResult) => {
  if(result === 'PASS') return 'success'
  if(result === 'FAIL') return 'danger-pill'
  return 'muted-pill'
}

const getScoreClass = (score: number) => {
  if(score >= 90) return 'success'
  if(score >= 70) return 'warning-pill'
  return 'danger-pill'
}

const getQualityControlLabel = (
  qualityControlId: string,
  qualityControlMap: Map<string, QualityControl>
) => {
  const qualityControl = qualityControlMap.get(qualityControlId)
  return qualityControl ? qualityControl.qcNo : 'QC bulunamadı'
}

const getTemplateLabel = (
  templateId: string,
  templateMap: Map<string, QualityControlTemplateRecord>
) => {
  const template = templateMap.get(templateId)
  return template ? template.name : 'Template bulunamadı'
}

const loadInitialData = (): QualityControlFormsInitialData => {
  const branches = loadBranches()
  const stockItems = loadStockItems()
  const suppliers = loadSupplierManagementRecords()
  const supplierProducts = loadSupplierProductRecords(suppliers, stockItems)
  const purchaseRequests = loadPurchaseRequestRecords(stockItems, branches)
  const rfqRecords = loadRequestForQuotationRecords(purchaseRequests, suppliers, supplierProducts, branches)
  const approvalRecords = loadPurchaseApprovalRecords(rfqRecords)
  const purchaseOrders = loadPurchaseOrderRecords(approvalRecords, rfqRecords)
  const goodsReceipts = loadGoodsReceiptRecords(purchaseOrders, rfqRecords, purchaseRequests)
  const inventoryLots = loadInventoryLotRecords(goodsReceipts)
  const qualityControls = loadQualityControlRecords(inventoryLots)
  const templates = loadQualityControlTemplateRecords()
  const forms = loadQualityControlFormRecords(qualityControls, templates)

  return {
    qualityControls,
    templates,
    forms
  }
}

const createFormBuilderItems = (
  template: QualityControlTemplateRecord | null
): FormBuilderItem[] => (
  template
    ? template.items.map(item => ({
      templateItemId: item.id,
      title: item.title,
      description: item.description,
      isRequired: item.isRequired,
      result: '',
      notes: ''
    }))
    : []
)

const createEmptyFormBuilder = (
  qualityControls: QualityControl[],
  templates: QualityControlTemplateRecord[],
  forms: QualityControlFormRecord[]
): FormBuilderState => {
  const usedQualityControlIds = new Set(forms.map(form => form.qualityControlId))
  const qualityControl = qualityControls.find(record => !usedQualityControlIds.has(record.id)) || null
  const template = templates.find(item => item.isActive) || null

  return {
    qualityControlId: qualityControl?.id || '',
    templateId: template?.id || '',
    notes: '',
    items: createFormBuilderItems(template)
  }
}

const createEmptyTemplateBuilder = (): TemplateBuilderState => ({
  name: '',
  description: '',
  isActive: true,
  items: [
    {
      id: createId('quality_template_item_draft'),
      title: '',
      description: '',
      isRequired: true
    }
  ]
})

const validateTemplateBuilder = (template: TemplateBuilderState) => {
  if(!template.name.trim()) return 'Template adı zorunludur.'
  if(template.items.length === 0) return 'En az bir kontrol maddesi eklenmelidir.'
  if(template.items.some(item => !item.title.trim())) return 'Kontrol maddesi başlığı zorunludur.'

  return ''
}

const validateFormBuilder = (
  form: FormBuilderState,
  qualityControls: QualityControl[],
  templates: QualityControlTemplateRecord[],
  forms: QualityControlFormRecord[]
) => {
  const qualityControl = qualityControls.find(record => record.id === form.qualityControlId)
  if(!qualityControl) return 'Quality Control zorunludur.'

  const template = templates.find(record => record.id === form.templateId)
  if(!template) return 'Template zorunludur.'

  if(forms.some(record => record.qualityControlId === qualityControl.id)){
    return 'Bu Quality Control kaydı için daha önce form oluşturulmuş.'
  }

  const requiredTemplateItemIds = new Set(template.items.filter(item => item.isRequired).map(item => item.id))
  const missingRequiredItem = form.items.some(item => (
    requiredTemplateItemIds.has(item.templateItemId) && !item.result
  ))
  if(missingRequiredItem) return 'Required kontrol maddeleri boş bırakılamaz.'

  return ''
}

const getFormBuilderScore = (items: FormBuilderItem[]) => (
  calculateQualityControlOverallScore(items
    .filter(item => item.result)
    .map(item => ({
      result: item.result as QualityControlFormResult
    })))
)

export default function QualityControlForms(){
  const initialData = React.useMemo(loadInitialData, [])
  const [qualityControls] = React.useState<QualityControl[]>(initialData.qualityControls)
  const [templates, setTemplates] = React.useState<QualityControlTemplateRecord[]>(initialData.templates)
  const [forms, setForms] = React.useState<QualityControlFormRecord[]>(initialData.forms)
  const [selectedFormId, setSelectedFormId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [formBuilder, setFormBuilder] = React.useState<FormBuilderState>(() => createEmptyFormBuilder(
    initialData.qualityControls,
    initialData.templates,
    initialData.forms
  ))
  const [templateBuilder, setTemplateBuilder] = React.useState<TemplateBuilderState>(createEmptyTemplateBuilder)
  const [formError, setFormError] = React.useState('')
  const [templateError, setTemplateError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [templateFilter, setTemplateFilter] = React.useState('all')
  const [resultFilter, setResultFilter] = React.useState<ResultFilter>('all')

  const qualityControlMap = React.useMemo(() => (
    new Map(qualityControls.map(record => [record.id, record]))
  ), [qualityControls])

  const templateMap = React.useMemo(() => (
    new Map(templates.map(template => [template.id, template]))
  ), [templates])

  const selectedForm = React.useMemo(() => (
    forms.find(form => form.id === selectedFormId) || forms[0] || null
  ), [forms, selectedFormId])

  const formNoMap = React.useMemo(() => (
    new Map(forms.map(form => [form.id, getQualityControlFormDisplayNo(forms, form.id)]))
  ), [forms])

  React.useEffect(() => {
    if(selectedFormId && forms.some(form => form.id === selectedFormId)) return
    setSelectedFormId(forms[0]?.id || '')
  }, [forms, selectedFormId])

  const commitForms = React.useCallback((nextForms: QualityControlFormRecord[]) => {
    setForms(nextForms)
    saveQualityControlFormRecords(nextForms)
  }, [])

  const commitTemplates = React.useCallback((nextTemplates: QualityControlTemplateRecord[]) => {
    setTemplates(nextTemplates)
    saveQualityControlTemplateRecords(nextTemplates)
  }, [])

  const visibleForms = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return forms.filter(form => {
      const qualityControl = qualityControlMap.get(form.qualityControlId)
      const template = templateMap.get(form.templateId)
      const searchFields = [
        qualityControl?.qcNo || '',
        template?.name || ''
      ]

      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesTemplate = templateFilter === 'all' || form.templateId === templateFilter
      const matchesResult = resultFilter === 'all' || form.items.some(item => item.result === resultFilter)

      return matchesSearch && matchesTemplate && matchesResult
    })
  }, [forms, qualityControlMap, resultFilter, search, templateFilter, templateMap])

  const averageScore = forms.length === 0
    ? 0
    : forms.reduce((total, form) => total + form.overallScore, 0) / forms.length
  const failFormCount = forms.filter(form => form.items.some(item => item.result === 'FAIL')).length
  const unusedQualityControlCount = qualityControls.filter(qualityControl => (
    !forms.some(form => form.qualityControlId === qualityControl.id)
  )).length

  const startCreateForm = () => {
    setFormBuilder(createEmptyFormBuilder(qualityControls, templates, forms))
    setFormError('')
    setPanelMode('form')
  }

  const startCreateTemplate = () => {
    setTemplateBuilder(createEmptyTemplateBuilder())
    setTemplateError('')
    setPanelMode('template')
  }

  const cancelPanel = () => {
    setFormError('')
    setTemplateError('')
    setPanelMode('detail')
  }

  const updateFormTemplate = (templateId: string) => {
    const template = templateMap.get(templateId) || null
    setFormBuilder(current => ({
      ...current,
      templateId,
      items: createFormBuilderItems(template)
    }))
  }

  const updateFormItem = (
    templateItemId: string,
    changes: Partial<Pick<FormBuilderItem, 'result' | 'notes'>>
  ) => {
    setFormBuilder(current => ({
      ...current,
      items: current.items.map(item => (
        item.templateItemId === templateItemId ? { ...item, ...changes } : item
      ))
    }))
  }

  const addTemplateItem = () => {
    setTemplateBuilder(current => ({
      ...current,
      items: [
        ...current.items,
        {
          id: createId('quality_template_item_draft'),
          title: '',
          description: '',
          isRequired: true
        }
      ]
    }))
  }

  const updateTemplateItem = (
    itemId: string,
    changes: Partial<Pick<TemplateBuilderItem, 'title' | 'description' | 'isRequired'>>
  ) => {
    setTemplateBuilder(current => ({
      ...current,
      items: current.items.map(item => item.id === itemId ? { ...item, ...changes } : item)
    }))
  }

  const removeTemplateItem = (itemId: string) => {
    setTemplateBuilder(current => ({
      ...current,
      items: current.items.filter(item => item.id !== itemId)
    }))
  }

  const submitTemplate = () => {
    const validationError = validateTemplateBuilder(templateBuilder)
    if(validationError){
      setTemplateError(validationError)
      return
    }

    const now = getTodayIso()
    const templateId = createId('quality_control_template')
    const payload: QualityControlTemplateRecord = {
      id: templateId,
      name: templateBuilder.name.trim(),
      description: templateBuilder.description.trim(),
      isActive: templateBuilder.isActive,
      createdAt: now,
      updatedAt: now,
      items: templateBuilder.items.map((item, index) => ({
        id: createId('quality_control_template_item'),
        templateId,
        title: item.title.trim(),
        description: item.description.trim(),
        displayOrder: index + 1,
        isRequired: item.isRequired
      }))
    }

    const nextTemplates = [...templates, payload]
    commitTemplates(nextTemplates)
    setTemplateBuilder(createEmptyTemplateBuilder())
    setTemplateError('')
    setFormBuilder(createEmptyFormBuilder(qualityControls, nextTemplates, forms))
    setPanelMode('detail')
  }

  const submitForm = () => {
    const validationError = validateFormBuilder(formBuilder, qualityControls, templates, forms)
    if(validationError){
      setFormError(validationError)
      return
    }

    const now = getTodayIso()
    const formId = createId('quality_control_form')
    const items: QualityControlFormItem[] = formBuilder.items.map(item => ({
      id: createId('quality_control_form_item'),
      formId,
      templateItemId: item.templateItemId,
      result: item.result || 'NOT_APPLICABLE',
      notes: item.notes.trim()
    }))
    const payload: QualityControlFormRecord = {
      id: formId,
      qualityControlId: formBuilder.qualityControlId,
      templateId: formBuilder.templateId,
      overallScore: calculateQualityControlOverallScore(items),
      notes: formBuilder.notes.trim(),
      createdAt: now,
      updatedAt: now,
      items
    }

    const nextForms = [payload, ...forms]
    commitForms(nextForms)
    setSelectedFormId(payload.id)
    setFormBuilder(createEmptyFormBuilder(qualityControls, templates, nextForms))
    setFormError('')
    setPanelMode('detail')
  }

  return (
    <div className="quality-form-page">
      <div className="page-header">
        <div>
          <h2>Kalite Kontrol Formları</h2>
          <p className="muted">Quality Control kayıtlarını standart checklist şablonlarıyla değerlendirin.</p>
        </div>
        <div className="quality-form-header-actions">
          <button className="btn" type="button" onClick={startCreateTemplate}>Şablon Oluştur</button>
          <button className="btn primary" type="button" onClick={startCreateForm}>Form Oluştur</button>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Template</span>
          <strong>{templates.length}</strong>
        </div>
        <div className="metric-card">
          <span>Form</span>
          <strong>{forms.length}</strong>
        </div>
        <div className="metric-card">
          <span>Ortalama Puan</span>
          <strong>{formatQualityControlScore(averageScore)}</strong>
        </div>
        <div className="metric-card">
          <span>Formsuz QC</span>
          <strong>{unusedQualityControlCount}</strong>
        </div>
      </div>

      <div className="product-layout quality-form-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Form Listesi</h3>
              <p className="muted">{visibleForms.length} kayıt gösteriliyor. FAIL içeren form sayısı: {failFormCount}</p>
            </div>
          </div>

          <div className="quality-form-toolbar">
            <input
              type="search"
              placeholder="QC No veya Template ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={templateFilter} onChange={event => setTemplateFilter(event.target.value)}>
              <option value="all">Tüm Template</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <select value={resultFilter} onChange={event => setResultFilter(event.target.value as ResultFilter)}>
              <option value="all">Tüm Sonuçlar</option>
              {QUALITY_CONTROL_FORM_RESULTS.map(result => (
                <option key={result} value={result}>{QUALITY_CONTROL_FORM_RESULT_LABELS[result]}</option>
              ))}
            </select>
          </div>

          <div className="table-wrap quality-form-table-wrap">
            <table className="data-table quality-form-table">
              <thead>
                <tr>
                  <th>Form No</th>
                  <th>QC No</th>
                  <th>Template</th>
                  <th>Overall Score</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {visibleForms.length === 0 && (
                  <tr><td colSpan={5} className="empty-cell">Bu filtrelere uygun kalite kontrol formu bulunamadı.</td></tr>
                )}
                {visibleForms.map(form => (
                  <tr
                    key={form.id}
                    className={selectedForm?.id === form.id ? 'selected' : ''}
                    tabIndex={0}
                    onClick={() => {
                      setSelectedFormId(form.id)
                      setPanelMode('detail')
                    }}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setSelectedFormId(form.id)
                      setPanelMode('detail')
                    }}
                  >
                    <td data-label="Form No"><strong>{formNoMap.get(form.id)}</strong></td>
                    <td data-label="QC No">{getQualityControlLabel(form.qualityControlId, qualityControlMap)}</td>
                    <td data-label="Template">{getTemplateLabel(form.templateId, templateMap)}</td>
                    <td data-label="Overall Score">
                      <span className={`status-pill ${getScoreClass(form.overallScore)}`}>
                        {formatQualityControlScore(form.overallScore)}
                      </span>
                    </td>
                    <td data-label="Created Date">{formatDate(form.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side quality-form-side">
          {panelMode === 'form' && (
            <section className="card">
              <div className="section-header compact">
                <div>
                  <h3>Form Oluştur</h3>
                  <p className="muted">Quality Control kaydına tek checklist formu bağlanır.</p>
                </div>
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <QualityControlFormEditor
                form={formBuilder}
                qualityControls={qualityControls}
                templates={templates}
                forms={forms}
                qualityControlMap={qualityControlMap}
                onChange={setFormBuilder}
                onTemplateChange={updateFormTemplate}
                onItemChange={updateFormItem}
                onSubmit={submitForm}
                onCancel={cancelPanel}
              />
            </section>
          )}

          {panelMode === 'template' && (
            <section className="card">
              <div className="section-header compact">
                <div>
                  <h3>Şablon Oluştur</h3>
                  <p className="muted">Kontrol maddelerini standartlaştırın.</p>
                </div>
              </div>
              {templateError && <div className="form-error">{templateError}</div>}
              <QualityControlTemplateEditor
                template={templateBuilder}
                onChange={setTemplateBuilder}
                onItemChange={updateTemplateItem}
                onAddItem={addTemplateItem}
                onRemoveItem={removeTemplateItem}
                onSubmit={submitTemplate}
                onCancel={cancelPanel}
              />
            </section>
          )}

          {panelMode === 'detail' && (
            <QualityControlFormDetailPanel
              form={selectedForm}
              forms={forms}
              templates={templates}
              formNoMap={formNoMap}
              qualityControlMap={qualityControlMap}
              templateMap={templateMap}
              onCreateForm={startCreateForm}
              onCreateTemplate={startCreateTemplate}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function QualityControlFormEditor({
  form,
  qualityControls,
  templates,
  forms,
  qualityControlMap,
  onChange,
  onTemplateChange,
  onItemChange,
  onSubmit,
  onCancel
}: {
  form: FormBuilderState
  qualityControls: QualityControl[]
  templates: QualityControlTemplateRecord[]
  forms: QualityControlFormRecord[]
  qualityControlMap: Map<string, QualityControl>
  onChange: (form: FormBuilderState) => void
  onTemplateChange: (templateId: string) => void
  onItemChange: (templateItemId: string, changes: Partial<Pick<FormBuilderItem, 'result' | 'notes'>>) => void
  onSubmit: () => void
  onCancel: () => void
}){
  const usedQualityControlIds = new Set(forms.map(record => record.qualityControlId))
  const activeTemplates = templates.filter(template => template.isActive)
  const previewScore = getFormBuilderScore(form.items)

  return (
    <form className="stacked-form quality-form-editor" onSubmit={event => event.preventDefault()}>
      <div className="quality-form-section">
        <h4>Genel Bilgiler</h4>
        <div className="quality-form-editor-grid">
          <div className="form-field">
            <label>Quality Control</label>
            <select value={form.qualityControlId} onChange={event => onChange({ ...form, qualityControlId: event.target.value })} required>
              <option value="">QC seçin</option>
              {qualityControls.map(qualityControl => {
                const disabled = usedQualityControlIds.has(qualityControl.id)

                return (
                  <option key={qualityControl.id} value={qualityControl.id} disabled={disabled}>
                    {qualityControl.qcNo}{disabled ? ' · Form var' : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="form-field">
            <label>Template</label>
            <select value={form.templateId} onChange={event => onTemplateChange(event.target.value)} required>
              <option value="">Template seçin</option>
              {activeTemplates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>QC No</label>
            <input value={form.qualityControlId ? getQualityControlLabel(form.qualityControlId, qualityControlMap) : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Overall Score</label>
            <input value={formatQualityControlScore(previewScore)} readOnly />
          </div>
        </div>
      </div>

      <div className="quality-form-section">
        <div className="section-header compact">
          <h4>Kontrol Maddeleri</h4>
          <span className="status-pill muted-pill">{form.items.length} madde</span>
        </div>
        <div className="quality-form-checklist">
          {form.items.length === 0 && <p className="muted">Template seçildiğinde kontrol maddeleri burada görünür.</p>}
          {form.items.map(item => (
            <div className="quality-form-checklist-item" key={item.templateItemId}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.description || '-'}</span>
                {item.isRequired && <small>Required</small>}
              </div>
              <label>
                <span>Sonuç</span>
                <select value={item.result} onChange={event => onItemChange(item.templateItemId, { result: event.target.value as QualityControlFormResult | '' })}>
                  <option value="">Sonuç seçin</option>
                  {QUALITY_CONTROL_FORM_RESULTS.map(result => (
                    <option key={result} value={result}>{QUALITY_CONTROL_FORM_RESULT_LABELS[result]}</option>
                  ))}
                </select>
              </label>
              <label className="quality-form-item-notes">
                <span>Not</span>
                <input value={item.notes} onChange={event => onItemChange(item.templateItemId, { notes: event.target.value })} />
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="quality-form-section">
        <h4>Notlar</h4>
        <div className="form-field">
          <label>Form Notu</label>
          <textarea rows={4} value={form.notes} onChange={event => onChange({ ...form, notes: event.target.value })} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn primary" type="button" onClick={onSubmit}>Form Kaydet</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}

function QualityControlTemplateEditor({
  template,
  onChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onSubmit,
  onCancel
}: {
  template: TemplateBuilderState
  onChange: (template: TemplateBuilderState) => void
  onItemChange: (itemId: string, changes: Partial<Pick<TemplateBuilderItem, 'title' | 'description' | 'isRequired'>>) => void
  onAddItem: () => void
  onRemoveItem: (itemId: string) => void
  onSubmit: () => void
  onCancel: () => void
}){
  return (
    <form className="stacked-form quality-template-editor" onSubmit={event => event.preventDefault()}>
      <div className="quality-form-section">
        <h4>Template Bilgileri</h4>
        <div className="quality-form-editor-grid">
          <div className="form-field">
            <label>Template Adı</label>
            <input value={template.name} onChange={event => onChange({ ...template, name: event.target.value })} required />
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={template.isActive}
              onChange={event => onChange({ ...template, isActive: event.target.checked })}
            />
            <span>Aktif</span>
          </label>
          <div className="form-field quality-form-wide">
            <label>Açıklama</label>
            <textarea rows={3} value={template.description} onChange={event => onChange({ ...template, description: event.target.value })} />
          </div>
        </div>
      </div>

      <div className="quality-form-section">
        <div className="section-header compact">
          <h4>Checklist Yönetimi</h4>
          <button className="btn" type="button" onClick={onAddItem}>Madde Ekle</button>
        </div>
        <div className="quality-template-item-list">
          {template.items.map((item, index) => (
            <div className="quality-template-item-editor" key={item.id}>
              <div className="quality-template-item-order">{index + 1}</div>
              <div className="form-field">
                <label>Başlık</label>
                <input value={item.title} onChange={event => onItemChange(item.id, { title: event.target.value })} />
              </div>
              <div className="form-field">
                <label>Açıklama</label>
                <input value={item.description} onChange={event => onItemChange(item.id, { description: event.target.value })} />
              </div>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={item.isRequired}
                  onChange={event => onItemChange(item.id, { isRequired: event.target.checked })}
                />
                <span>Required</span>
              </label>
              <button className="btn" type="button" onClick={() => onRemoveItem(item.id)} disabled={template.items.length === 1}>Sil</button>
            </div>
          ))}
        </div>
      </div>

      <div className="form-actions">
        <button className="btn primary" type="button" onClick={onSubmit}>Template Kaydet</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}

function QualityControlFormDetailPanel({
  form,
  forms,
  templates,
  formNoMap,
  qualityControlMap,
  templateMap,
  onCreateForm,
  onCreateTemplate
}: {
  form: QualityControlFormRecord | null
  forms: QualityControlFormRecord[]
  templates: QualityControlTemplateRecord[]
  formNoMap: Map<string, string>
  qualityControlMap: Map<string, QualityControl>
  templateMap: Map<string, QualityControlTemplateRecord>
  onCreateForm: () => void
  onCreateTemplate: () => void
}){
  const template = form ? templateMap.get(form.templateId) || null : null
  const templateItemMap = React.useMemo(() => (
    new Map(templates.flatMap(record => record.items.map(item => [item.id, item])))
  ), [templates])

  return (
    <>
      <section className="card quality-form-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{form ? formNoMap.get(form.id) : 'Form Detayı'}</h3>
            <p className="muted">{form ? getQualityControlLabel(form.qualityControlId, qualityControlMap) : 'Bir form kaydı seçin.'}</p>
          </div>
          {form && (
            <span className={`status-pill ${getScoreClass(form.overallScore)}`}>
              {formatQualityControlScore(form.overallScore)}
            </span>
          )}
        </div>
        <div className="quality-form-side-actions">
          <button className="btn" type="button" onClick={onCreateTemplate}>Şablon Oluştur</button>
          <button className="btn primary" type="button" onClick={onCreateForm}>Form Oluştur</button>
        </div>
      </section>

      {form && (
        <>
          <section className="card quality-form-detail-card">
            <h3>Detay</h3>
            <div className="quality-form-detail-grid">
              <div><span>Kalite Kontrol</span><strong>{getQualityControlLabel(form.qualityControlId, qualityControlMap)}</strong></div>
              <div><span>Template</span><strong>{template?.name || 'Template bulunamadı'}</strong></div>
              <div><span>Kontrol Maddesi</span><strong>{form.items.length}</strong></div>
              <div><span>Genel Puan</span><strong>{formatQualityControlScore(form.overallScore)}</strong></div>
              <div><span>Created Date</span><strong>{formatDate(form.createdAt)}</strong></div>
              <div><span>Updated Date</span><strong>{formatDate(form.updatedAt)}</strong></div>
            </div>
          </section>

          <section className="card quality-form-detail-card">
            <h3>Kontrol Maddeleri</h3>
            <div className="quality-form-result-list">
              {form.items.map(item => {
                const templateItem = templateItemMap.get(item.templateItemId)

                return (
                  <div className="quality-form-result-row" key={item.id}>
                    <div>
                      <strong>{templateItem?.title || 'Kontrol maddesi bulunamadı'}</strong>
                      <span>{templateItem?.description || '-'}</span>
                      {item.notes && <p>{item.notes}</p>}
                    </div>
                    <span className={`status-pill ${getResultClass(item.result)}`}>
                      {QUALITY_CONTROL_FORM_RESULT_LABELS[item.result]}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="card quality-form-detail-card">
            <h3>Notlar</h3>
            <p className="quality-form-notes">{form.notes || '-'}</p>
          </section>
        </>
      )}

      <section className="card quality-form-detail-card">
        <h3>Template Kütüphanesi</h3>
        <div className="quality-template-library">
          {templates.map(templateRecord => {
            const usageCount = forms.filter(record => record.templateId === templateRecord.id).length

            return (
              <div className="quality-template-library-row" key={templateRecord.id}>
                <div>
                  <strong>{templateRecord.name}</strong>
                  <span>{templateRecord.items.length} madde · {usageCount} form</span>
                </div>
                <span className={`status-pill ${templateRecord.isActive ? 'success' : 'muted-pill'}`}>
                  {templateRecord.isActive ? 'Aktif' : 'Pasif'}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
