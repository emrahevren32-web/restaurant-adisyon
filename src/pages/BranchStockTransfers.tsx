import React from 'react'
import { Branch, BranchStockTransfer, BranchStockTransferStatus, StockItem, User } from '../types'
import {
  addActionLog,
  approveBranchStockTransfer,
  cancelBranchStockTransfer,
  completeBranchStockTransfer,
  getActiveBranchId,
  loadAllStockItems,
  loadBranches,
  loadBranchStockTransfers,
  saveBranchStockTransfers
} from '../storage'
import { formatStockQuantity } from '../criticalStock'

type Props = {
  currentUser: User
}

type TransferFormValues = {
  sourceBranchId: string
  targetBranchId: string
  stockItemId: string
  quantity: string
  note: string
}

const createId = () => `branch_stock_transfer_${Date.now()}_${Math.random().toString(16).slice(2)}`

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  if(Number.isNaN(date.getTime())) return value || '-'

  return date.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const formatQuantity = (value: number, unit: StockItem['unit']) => {
  return formatStockQuantity(value, unit)
}

const getUserName = (user: User) => user.fullName || user.username

const getTransferNumberValue = (transferNo: string) => {
  const match = transferNo.match(/(\d+)$/)
  return match ? Number(match[1]) : 0
}

const getNextTransferNo = (transfers: BranchStockTransfer[]) => {
  const nextNumber = transfers.reduce((max, transfer) => {
    return Math.max(max, getTransferNumberValue(transfer.transferNo))
  }, 0) + 1

  return `TRF-${String(nextNumber).padStart(4, '0')}`
}

const getBranchName = (branches: Branch[], branchId: string) => {
  return branches.find(branch => branch.id === branchId)?.name || branchId
}

const sortTransfers = (transfers: BranchStockTransfer[]) => {
  return [...transfers].sort((first, second) => {
    const dateDiff = new Date(second.transferDate).getTime() - new Date(first.transferDate).getTime()
    if(dateDiff !== 0) return dateDiff
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  })
}

const sortBranches = (branches: Branch[]) => {
  return [...branches].sort((first, second) => {
    if(first.isActive !== second.isActive) return first.isActive ? -1 : 1
    return first.name.localeCompare(second.name, 'tr-TR')
  })
}

const sortStockItems = (items: StockItem[]) => {
  return [...items].sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))
}

const getStatusClass = (status: BranchStockTransferStatus) => {
  if(status === 'Tamamlandı') return 'success'
  if(status === 'Onaylandı') return 'info-pill'
  if(status === 'İptal Edildi') return 'muted-pill'
  return 'warning-pill'
}

const createInitialValues = (branches: Branch[], stockItems: StockItem[]): TransferFormValues => {
  const activeBranchId = getActiveBranchId()
  const activeBranches = branches.filter(branch => branch.isActive)
  const sourceBranch = activeBranches.find(branch => branch.id === activeBranchId) || activeBranches[0] || branches[0]
  const targetBranch = activeBranches.find(branch => branch.id !== sourceBranch?.id) || activeBranches[1] || branches.find(branch => branch.id !== sourceBranch?.id)
  const sourceStockItem = stockItems.find(item => item.branchId === sourceBranch?.id && item.active)

  return {
    sourceBranchId: sourceBranch?.id || '',
    targetBranchId: targetBranch?.id || '',
    stockItemId: sourceStockItem?.id || '',
    quantity: '',
    note: ''
  }
}

export default function BranchStockTransfers({ currentUser }: Props){
  const [branches, setBranches] = React.useState<Branch[]>(() => loadBranches())
  const [stockItems, setStockItems] = React.useState<StockItem[]>(() => loadAllStockItems())
  const [transfers, setTransfers] = React.useState<BranchStockTransfer[]>(() => loadBranchStockTransfers())
  const [values, setValues] = React.useState<TransferFormValues>(() => createInitialValues(loadBranches(), loadAllStockItems()))
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [formError, setFormError] = React.useState('')
  const [detailTransfer, setDetailTransfer] = React.useState<BranchStockTransfer | null>(null)

  const refreshData = React.useCallback(() => {
    const nextBranches = loadBranches()
    const nextStockItems = loadAllStockItems()
    const nextTransfers = loadBranchStockTransfers()

    setBranches(nextBranches)
    setStockItems(nextStockItems)
    setTransfers(nextTransfers)
    setDetailTransfer(current => current ? nextTransfers.find(item => item.id === current.id) || null : null)
  }, [])

  const branchOptions = React.useMemo(() => sortBranches(branches).filter(branch => branch.isActive), [branches])
  const sourceStockItems = React.useMemo(() => {
    return sortStockItems(stockItems.filter(item => item.branchId === values.sourceBranchId && item.active))
  }, [stockItems, values.sourceBranchId])
  const selectedStockItem = sourceStockItems.find(item => item.id === values.stockItemId)
  const sortedTransfers = React.useMemo(() => sortTransfers(transfers), [transfers])
  const nextTransferNo = React.useMemo(() => getNextTransferNo(transfers), [transfers])
  const monthKey = getLocalDateKey(new Date()).slice(0, 7)
  const totalTransferCount = transfers.length
  const pendingTransferCount = transfers.filter(transfer => transfer.status === 'Bekliyor').length
  const completedTransferCount = transfers.filter(transfer => transfer.status === 'Tamamlandı').length
  const thisMonthTransferCount = transfers.filter(transfer => transfer.transferDate.slice(0, 7) === monthKey).length

  React.useEffect(() => {
    if(!values.sourceBranchId && branchOptions[0]){
      setValues(prev => ({ ...prev, sourceBranchId: branchOptions[0].id }))
    }
  }, [branchOptions, values.sourceBranchId])

  React.useEffect(() => {
    if(values.sourceBranchId && values.targetBranchId === values.sourceBranchId){
      const nextTarget = branchOptions.find(branch => branch.id !== values.sourceBranchId)
      setValues(prev => ({ ...prev, targetBranchId: nextTarget?.id || '' }))
    }
  }, [branchOptions, values.sourceBranchId, values.targetBranchId])

  React.useEffect(() => {
    if(sourceStockItems.length === 0){
      if(values.stockItemId) setValues(prev => ({ ...prev, stockItemId: '' }))
      return
    }

    if(!sourceStockItems.some(item => item.id === values.stockItemId)){
      setValues(prev => ({ ...prev, stockItemId: sourceStockItems[0].id }))
    }
  }, [sourceStockItems, values.stockItemId])

  const updateField = <K extends keyof TransferFormValues>(key: K, value: TransferFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
    setFormError('')
    setMessage(null)
  }

  const saveTransfer = (event: React.FormEvent) => {
    event.preventDefault()

    const quantity = Number(values.quantity)
    const sourceBranch = branches.find(branch => branch.id === values.sourceBranchId)
    const targetBranch = branches.find(branch => branch.id === values.targetBranchId)
    const stockItem = stockItems.find(item => item.id === values.stockItemId && item.branchId === values.sourceBranchId)

    if(!sourceBranch){
      setFormError('Gönderen şube zorunludur.')
      return
    }

    if(!targetBranch){
      setFormError('Alan şube zorunludur.')
      return
    }

    if(sourceBranch.id === targetBranch.id){
      setFormError('Gönderen ve alan şube aynı olamaz.')
      return
    }

    if(!stockItem){
      setFormError('Ürün zorunludur.')
      return
    }

    if(!Number.isFinite(quantity) || quantity <= 0){
      setFormError('Transfer miktarı sıfırdan büyük olmalıdır.')
      return
    }

    if(quantity > stockItem.currentQty){
      setFormError(`Transfer miktarı mevcut stoktan fazla olamaz. Mevcut: ${formatQuantity(stockItem.currentQty, stockItem.unit)}.`)
      return
    }

    const now = new Date().toISOString()
    const transfer: BranchStockTransfer = {
      id: createId(),
      transferNo: nextTransferNo,
      sourceBranchId: sourceBranch.id,
      targetBranchId: targetBranch.id,
      transferDate: getLocalDateKey(new Date()),
      status: 'Bekliyor',
      note: values.note.trim(),
      createdBy: getUserName(currentUser),
      createdAt: now,
      updatedAt: now,
      items: [{
        stockItemId: stockItem.id,
        stockItemName: stockItem.name,
        quantity,
        unit: stockItem.unit
      }]
    }
    const nextTransfers = [transfer, ...transfers]

    saveBranchStockTransfers(nextTransfers)
    setTransfers(nextTransfers)
    setValues(prev => ({ ...prev, quantity: '', note: '' }))
    setFormError('')
    setMessage({ type: 'success', text: `${transfer.transferNo} transfer kaydı oluşturuldu.` })
    addActionLog({
      operationType: 'Transfer oluşturuldu',
      user: currentUser,
      description: `${transfer.transferNo} transferi oluşturuldu. ${sourceBranch.name} -> ${targetBranch.name}. ${stockItem.name}: ${formatQuantity(quantity, stockItem.unit)}.`
    })
  }

  const runTransferAction = (
    action: () => void,
    successMessage: string,
    confirmMessage?: string
  ) => {
    if(confirmMessage && !confirm(confirmMessage)) return

    try {
      action()
      refreshData()
      setMessage({ type: 'success', text: successMessage })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'İşlem tamamlanamadı.' })
    }
  }

  const approveTransfer = (transfer: BranchStockTransfer) => {
    runTransferAction(
      () => approveBranchStockTransfer(transfer.id, currentUser),
      `${transfer.transferNo} onaylandı.`
    )
  }

  const completeTransfer = (transfer: BranchStockTransfer) => {
    runTransferAction(
      () => completeBranchStockTransfer(transfer.id, currentUser),
      `${transfer.transferNo} tamamlandı ve stoklar güncellendi.`,
      `${transfer.transferNo} tamamlanacak ve stoklar güncellenecek. Devam etmek istiyor musunuz?`
    )
  }

  const cancelTransfer = (transfer: BranchStockTransfer) => {
    runTransferAction(
      () => cancelBranchStockTransfer(transfer.id, currentUser),
      `${transfer.transferNo} iptal edildi.`,
      `${transfer.transferNo} iptal edilecek. Emin misiniz?`
    )
  }

  return (
    <div className="branch-stock-transfer-page">
      <div className="page-title">
        <div>
          <h2>Şubeler Arası Stok Transferi</h2>
          <p className="muted">Şubeler arasında stok transferlerini yönetin.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Transfer</span>
          <strong>{totalTransferCount}</strong>
        </div>
        <div className="metric-card">
          <span>Bekleyen Transfer</span>
          <strong>{pendingTransferCount}</strong>
        </div>
        <div className="metric-card">
          <span>Tamamlanan Transfer</span>
          <strong>{completedTransferCount}</strong>
        </div>
        <div className="metric-card">
          <span>Bu Ay Transfer</span>
          <strong>{thisMonthTransferCount}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Transfer Geçmişi</h3>
              <p className="muted">{sortedTransfers.length} transfer kaydı gösteriliyor.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table branch-stock-transfer-table">
              <thead>
                <tr>
                  <th>Transfer No</th>
                  <th>Gönderen Şube</th>
                  <th>Alan Şube</th>
                  <th>Tarih</th>
                  <th>Durum</th>
                  <th>Ürün Sayısı</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {sortedTransfers.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Henüz transfer kaydı bulunmuyor.</td></tr>
                )}
                {sortedTransfers.map(transfer => (
                  <tr key={transfer.id}>
                    <td>
                      <strong>{transfer.transferNo}</strong>
                      <p className="muted small-text">{transfer.createdBy}</p>
                    </td>
                    <td>{getBranchName(branches, transfer.sourceBranchId)}</td>
                    <td>{getBranchName(branches, transfer.targetBranchId)}</td>
                    <td>{formatDate(transfer.transferDate)}</td>
                    <td><span className={`status-pill ${getStatusClass(transfer.status)}`}>{transfer.status}</span></td>
                    <td>{transfer.items.length}</td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => setDetailTransfer(transfer)}>Detay</button>
                      {transfer.status === 'Bekliyor' && <button className="btn" type="button" onClick={() => approveTransfer(transfer)}>Onayla</button>}
                      {transfer.status === 'Onaylandı' && <button className="btn primary" type="button" onClick={() => completeTransfer(transfer)}>Tamamla</button>}
                      {(transfer.status === 'Bekliyor' || transfer.status === 'Onaylandı') && <button className="btn" type="button" onClick={() => cancelTransfer(transfer)}>İptal Et</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side">
          <section className="card">
            <div className="section-header compact">
              <div>
                <h3>Yeni Transfer Formu</h3>
                <p className="muted">Sıradaki transfer no: <strong>{nextTransferNo}</strong></p>
              </div>
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <form className="stacked-form" onSubmit={saveTransfer}>
              <div className="form-field">
                <label>Gönderen Şube</label>
                <select value={values.sourceBranchId} onChange={event => updateField('sourceBranchId', event.target.value)} required>
                  {branchOptions.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Alan Şube</label>
                <select value={values.targetBranchId} onChange={event => updateField('targetBranchId', event.target.value)} required>
                  {branchOptions
                    .filter(branch => branch.id !== values.sourceBranchId)
                    .map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Ürün</label>
                <select value={values.stockItemId} onChange={event => updateField('stockItemId', event.target.value)} disabled={sourceStockItems.length === 0} required>
                  {sourceStockItems.length === 0 && <option value="">Stok kartı bulunmuyor</option>}
                  {sourceStockItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} - {formatQuantity(item.currentQty, item.unit)}
                    </option>
                  ))}
                </select>
              </div>
              {selectedStockItem && (
                <div className="stock-current-hint branch-transfer-stock-hint">
                  <span>Mevcut Stok</span>
                  <strong>{formatQuantity(selectedStockItem.currentQty, selectedStockItem.unit)}</strong>
                </div>
              )}
              <div className="form-field">
                <label>Miktar</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={values.quantity}
                  onChange={event => updateField('quantity', event.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label>Not</label>
                <textarea rows={4} value={values.note} onChange={event => updateField('note', event.target.value)} />
              </div>
              <div className="form-actions">
                <button className="btn primary" type="submit" disabled={sourceStockItems.length === 0 || branchOptions.length < 2}>Kaydet</button>
              </div>
            </form>
          </section>
        </aside>
      </div>

      {detailTransfer && (
        <TransferDetailModal
          transfer={detailTransfer}
          branches={branches}
          onClose={() => setDetailTransfer(null)}
        />
      )}
    </div>
  )
}

function TransferDetailModal({
  transfer,
  branches,
  onClose
}: {
  transfer: BranchStockTransfer
  branches: Branch[]
  onClose: () => void
}){
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Transfer detayı">
      <div className="credit-payment-modal">
        <div className="section-header compact">
          <div>
            <h3>Transfer Detayı</h3>
            <p className="muted">{transfer.transferNo}</p>
          </div>
          <button className="btn" type="button" onClick={onClose}>Kapat</button>
        </div>

        <div className="supplier-payment-detail-grid">
          <div>
            <span>Gönderen Şube</span>
            <strong>{getBranchName(branches, transfer.sourceBranchId)}</strong>
          </div>
          <div>
            <span>Alan Şube</span>
            <strong>{getBranchName(branches, transfer.targetBranchId)}</strong>
          </div>
          <div>
            <span>Tarih</span>
            <strong>{formatDate(transfer.transferDate)}</strong>
          </div>
          <div>
            <span>Durum</span>
            <strong>{transfer.status}</strong>
          </div>
          <div>
            <span>Oluşturan</span>
            <strong>{transfer.createdBy}</strong>
          </div>
          <div>
            <span>Ürün Sayısı</span>
            <strong>{transfer.items.length}</strong>
          </div>
        </div>

        <div className="table-wrap branch-transfer-detail-table-wrap">
          <table className="data-table branch-transfer-detail-table">
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Miktar</th>
                <th>Birim</th>
              </tr>
            </thead>
            <tbody>
              {transfer.items.map(item => (
                <tr key={`${item.stockItemId}_${item.unit}`}>
                  <td>{item.stockItemName}</td>
                  <td>{item.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 3 })}</td>
                  <td>{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="form-field">
          <label>Not</label>
          <p className="muted">{transfer.note || '-'}</p>
        </div>
      </div>
    </div>
  )
}
