import React from 'react'
import { CashTransfer, User } from '../types'
import { addActionLog, loadCashTransfers, loadUsers, saveCashTransfers } from '../storage'
import { formatCurrency } from '../billing'

type Props = { currentUser: User }

type TransferFormValues = {
  date: string
  fromUser: string
  toUser: string
  transferredAmount: string
  note: string
}

const createId = (prefix: string) => `${prefix}_${Date.now()}`

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const roundMoney = (value: number) => Math.round(value * 100) / 100
const getUserName = (user: User) => user.fullName || user.username

const toFormDefaults = (currentUser: User): TransferFormValues => ({
  date: getLocalDateKey(new Date()),
  fromUser: getUserName(currentUser),
  toUser: '',
  transferredAmount: '',
  note: ''
})

const getTransferNumberValue = (transferNo: string) => {
  const match = transferNo.match(/(\d+)$/)
  return match ? Number(match[1]) : 0
}

const getNextTransferNo = (transfers: CashTransfer[]) => {
  const nextNumber = transfers.reduce((max, transfer) => {
    return Math.max(max, getTransferNumberValue(transfer.transferNo))
  }, 0) + 1

  return `DEVIR-${String(nextNumber).padStart(4, '0')}`
}

const sortTransfers = (transfers: CashTransfer[]) => {
  return [...transfers].sort((first, second) => {
    const dateDiff = new Date(second.date).getTime() - new Date(first.date).getTime()
    if(dateDiff !== 0) return dateDiff
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  })
}

export default function CashTransfers({ currentUser }: Props){
  const [users] = React.useState<User[]>(() => loadUsers())
  const [transfers, setTransfers] = React.useState<CashTransfer[]>(() => loadCashTransfers())
  const [values, setValues] = React.useState<TransferFormValues>(() => toFormDefaults(currentUser))
  const [formError, setFormError] = React.useState('')
  const [detailTransfer, setDetailTransfer] = React.useState<CashTransfer | null>(null)

  React.useEffect(() => {
    saveCashTransfers(transfers)
  }, [transfers])

  const sortedTransfers = React.useMemo(() => sortTransfers(transfers), [transfers])
  const nextTransferNo = React.useMemo(() => getNextTransferNo(transfers), [transfers])
  const today = getLocalDateKey(new Date())
  const totalTransferCount = transfers.length
  const todayTransferCount = transfers.filter(transfer => transfer.date === today).length
  const totalTransferAmount = roundMoney(transfers.reduce((sum, transfer) => sum + transfer.transferredAmount, 0))
  const lastTransferAmount = sortedTransfers[0]?.transferredAmount || 0
  const lastOpeningBalance = sortedTransfers[0]?.transferredAmount || 0
  const userOptions = React.useMemo(() => {
    const names = users.map(user => getUserName(user)).filter(Boolean)
    return Array.from(new Set([...names, 'Kasiyer']))
  }, [users])

  const updateField = <K extends keyof TransferFormValues>(key: K, value: TransferFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
    setFormError('')
  }

  const saveTransfer = (event: React.FormEvent) => {
    event.preventDefault()

    const fromUser = values.fromUser.trim()
    const toUser = values.toUser.trim()
    const amount = Number(values.transferredAmount)

    if(!values.date){
      setFormError('Devir tarihi zorunludur.')
      return
    }

    if(!fromUser){
      setFormError('Teslim eden zorunludur.')
      return
    }

    if(!toUser){
      setFormError('Teslim alan zorunludur.')
      return
    }

    if(fromUser.toLocaleLowerCase('tr-TR') === toUser.toLocaleLowerCase('tr-TR')){
      setFormError('Teslim eden ve teslim alan aynı kişi olamaz.')
      return
    }

    if(!Number.isFinite(amount) || amount <= 0){
      setFormError('Devir tutarı sıfırdan büyük olmalıdır.')
      return
    }

    const now = new Date().toISOString()
    const transfer: CashTransfer = {
      id: createId('cash_transfer'),
      date: values.date,
      transferNo: nextTransferNo,
      fromUser,
      toUser,
      openingBalance: roundMoney(lastOpeningBalance),
      transferredAmount: roundMoney(amount),
      note: values.note.trim(),
      createdAt: now
    }

    setTransfers(prev => [transfer, ...prev])
    setValues(toFormDefaults(currentUser))
    setFormError('')
    addActionLog({
      operationType: 'Kasa devri oluşturuldu',
      user: currentUser,
      description: `${transfer.transferNo} kasa devri oluşturuldu. Teslim eden: ${transfer.fromUser}. Teslim alan: ${transfer.toUser}. Tutar: ${formatCurrency(transfer.transferredAmount)}.`
    })
  }

  const deleteTransfer = (transfer: CashTransfer) => {
    if(!confirm(`${transfer.transferNo} kasa devri silinecek. Emin misiniz?`)) return

    setTransfers(prev => prev.filter(item => item.id !== transfer.id))
    if(detailTransfer?.id === transfer.id) setDetailTransfer(null)
    addActionLog({
      operationType: 'Kasa devri silindi',
      user: currentUser,
      description: `${transfer.transferNo} kasa devri silindi. Teslim eden: ${transfer.fromUser}. Teslim alan: ${transfer.toUser}. Tutar: ${formatCurrency(transfer.transferredAmount)}.`
    })
  }

  return (
    <div className="cash-transfers-page">
      <div className="page-title">
        <div>
          <h2>Kasa Devir İşlemleri</h2>
          <p className="muted">Kasa teslim ve devir kayıtlarını yönetin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Devir</span>
          <strong>{totalTransferCount}</strong>
        </div>
        <div className="metric-card">
          <span>Bugünkü Devir</span>
          <strong>{todayTransferCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Devir Tutarı</span>
          <strong>{formatCurrency(totalTransferAmount)}</strong>
        </div>
        <div className="metric-card">
          <span>Son Devir Tutarı</span>
          <strong>{formatCurrency(lastTransferAmount)}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Geçmiş Devirler</h3>
              <p className="muted">{sortedTransfers.length} devir kaydı gösteriliyor.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table cash-transfer-table">
              <thead>
                <tr>
                  <th>Devir No</th>
                  <th>Tarih</th>
                  <th>Teslim Eden</th>
                  <th>Teslim Alan</th>
                  <th>Tutar</th>
                  <th>Açıklama</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {sortedTransfers.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Henüz kasa devri bulunmuyor.</td></tr>
                )}
                {sortedTransfers.map(transfer => (
                  <tr key={transfer.id}>
                    <td><strong>{transfer.transferNo}</strong></td>
                    <td>{transfer.date}</td>
                    <td>{transfer.fromUser}</td>
                    <td>{transfer.toUser}</td>
                    <td><strong>{formatCurrency(transfer.transferredAmount)}</strong></td>
                    <td>{transfer.note || '-'}</td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => setDetailTransfer(transfer)}>Görüntüle</button>
                      <button className="btn" type="button" onClick={() => deleteTransfer(transfer)}>Sil</button>
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
                <h3>Yeni Devir Formu</h3>
                <p className="muted">Sıradaki devir no: <strong>{nextTransferNo}</strong></p>
              </div>
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <form className="stacked-form" onSubmit={saveTransfer}>
              <div className="cash-transfer-preview">
                <div>
                  <span>Transfer No</span>
                  <strong>{nextTransferNo}</strong>
                </div>
                <div>
                  <span>Açılış Bakiyesi</span>
                  <strong>{formatCurrency(lastOpeningBalance)}</strong>
                </div>
              </div>
              <div className="form-field">
                <label>Devir Tarihi</label>
                <input type="date" value={values.date} onChange={event => updateField('date', event.target.value)} required />
              </div>
              <div className="form-field">
                <label>Teslim Eden</label>
                <input
                  list="cash-transfer-users"
                  value={values.fromUser}
                  onChange={event => updateField('fromUser', event.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label>Teslim Alan</label>
                <input
                  list="cash-transfer-users"
                  value={values.toUser}
                  onChange={event => updateField('toUser', event.target.value)}
                  required
                />
              </div>
              <datalist id="cash-transfer-users">
                {userOptions.map(userName => <option key={userName} value={userName} />)}
              </datalist>
              <div className="form-field">
                <label>Devir Tutarı</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.transferredAmount}
                  onChange={event => updateField('transferredAmount', event.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label>Açıklama</label>
                <textarea rows={4} value={values.note} onChange={event => updateField('note', event.target.value)} />
              </div>
              <div className="form-actions">
                <button className="btn primary" type="submit">Kaydet</button>
              </div>
            </form>
          </section>
        </aside>
      </div>

      {detailTransfer && (
        <CashTransferDetail
          transfer={detailTransfer}
          onClose={() => setDetailTransfer(null)}
        />
      )}
    </div>
  )
}

function CashTransferDetail({
  transfer,
  onClose
}: {
  transfer: CashTransfer
  onClose: () => void
}){
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Kasa devri detayı">
      <div className="credit-payment-modal">
        <div className="section-header compact">
          <div>
            <h3>Kasa Devri Detayı</h3>
            <p className="muted">{transfer.transferNo}</p>
          </div>
          <button className="btn" type="button" onClick={onClose}>Kapat</button>
        </div>

        <div className="supplier-payment-detail-grid">
          <div>
            <span>Tarih</span>
            <strong>{transfer.date}</strong>
          </div>
          <div>
            <span>Devir No</span>
            <strong>{transfer.transferNo}</strong>
          </div>
          <div>
            <span>Teslim Eden</span>
            <strong>{transfer.fromUser}</strong>
          </div>
          <div>
            <span>Teslim Alan</span>
            <strong>{transfer.toUser}</strong>
          </div>
          <div>
            <span>Açılış Bakiyesi</span>
            <strong>{formatCurrency(transfer.openingBalance)}</strong>
          </div>
          <div>
            <span>Devir Tutarı</span>
            <strong>{formatCurrency(transfer.transferredAmount)}</strong>
          </div>
        </div>

        <div className="form-field">
          <label>Açıklama</label>
          <p className="muted">{transfer.note || '-'}</p>
        </div>
      </div>
    </div>
  )
}
