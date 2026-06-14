import React from 'react'
import { SystemSettings, User } from '../types'
import {
  createDemoData,
  createSystemBackup,
  loadSettings,
  restoreSystemBackup,
  saveSettings
} from '../storage'

type Props = {
  currentUser: User
  onSettingsChange?: () => void
}

type Message = {
  type: 'success' | 'error'
  text: string
} | null

const currencyOptions = [
  { value: 'TRY', label: 'Türk Lirası (TRY)' },
  { value: 'USD', label: 'Dolar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'Sterlin (GBP)' }
]

const createBackupFileName = () => {
  const date = new Date().toLocaleDateString('sv-SE')
  return `restaurant-adisyon-yedek-${date}.json`
}

export default function Settings({ currentUser, onSettingsChange }: Props){
  const [settings, setSettings] = React.useState<SystemSettings>(() => loadSettings())
  const [restoreFile, setRestoreFile] = React.useState<File | null>(null)
  const [message, setMessage] = React.useState<Message>(null)

  if(currentUser.role !== 'Admin'){
    return (
      <div className="settings-page">
        <section className="card">
          <h2>Yetkisiz Erişim</h2>
          <p className="muted">Ayarlar ekranını sadece Yönetici rolündeki kullanıcılar görebilir.</p>
        </section>
      </div>
    )
  }

  const updateField = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const saveGeneralSettings = (event: React.FormEvent) => {
    event.preventDefault()
    saveSettings(settings)
    setSettings(loadSettings())
    onSettingsChange?.()
    setMessage({ type: 'success', text: 'Genel ayarlar kaydedildi.' })
  }

  const downloadBackup = () => {
    const backup = createSystemBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = createBackupFileName()
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setMessage({ type: 'success', text: 'Sistem yedeği JSON dosyası olarak hazırlandı.' })
  }

  const restoreBackup = async () => {
    if(!restoreFile){
      setMessage({ type: 'error', text: 'Geri yüklemek için bir JSON dosyası seçin.' })
      return
    }

    try {
      const text = await restoreFile.text()
      const backup = JSON.parse(text)
      const restoredCount = restoreSystemBackup(backup)
      setSettings(loadSettings())
      onSettingsChange?.()
      setRestoreFile(null)
      setMessage({
        type: 'success',
        text: `Geri yükleme tamamlandı. ${restoredCount} veri alanı içe aktarıldı. Güncel veriler için ekranları yeniden açabilirsiniz.`
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Yedek dosyası geri yüklenemedi.'
      })
    }
  }

  const generateDemoData = () => {
    const confirmed = window.confirm('Demo veri oluşturmak mevcut masa, ürün, kategori, mutfak ve QR talep verilerini demo setiyle yeniler. Devam etmek istiyor musunuz?')
    if(!confirmed) return

    const demo = createDemoData()
    setMessage({
      type: 'success',
      text: `Demo veri oluşturuldu: ${demo.tables.length} masa, ${demo.categories.length} kategori, ${demo.products.length} ürün, ${demo.employees.length} personel, ${demo.shifts.length} vardiya, ${demo.attendances.length} puantaj, ${demo.employeePerformances.length} performans kaydı, ${demo.currentAccounts.length} cari, ${demo.creditTransactions.length} veresiye kaydı, ${demo.collectionTransactions.length} tahsilat, ${demo.supplierDebts.length} tedarikçi borcu, ${demo.supplierPayments.length} tedarikçi ödemesi, ${demo.cashTransactions.length} manuel kasa hareketi, ${demo.incomeExpenses.length} gelir gider kaydı, ${demo.cashClosings.length} gün sonu kapanışı, ${demo.cashTransfers.length} kasa devri.`
    })
  }

  return (
    <div className="settings-page">
      <div className="page-title">
        <div>
          <h2>Ayarlar</h2>
          <p className="muted">Restoran bilgileri, yedekleme, geri yükleme ve demo veri işlemlerini yönetin.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="settings-layout">
        <section className="card">
          <div className="section-header compact">
            <h3>Genel Ayarlar</h3>
          </div>

          <form className="settings-form" onSubmit={saveGeneralSettings}>
            <div className="form-field">
              <label>Restoran adı</label>
              <input
                value={settings.restaurantName}
                onChange={event => updateField('restaurantName', event.target.value)}
                placeholder="Restoran adı"
              />
            </div>

            <div className="form-field">
              <label>Logo URL</label>
              <input
                value={settings.logoUrl}
                onChange={event => updateField('logoUrl', event.target.value)}
                placeholder="https://..."
              />
            </div>

            {settings.logoUrl && (
              <div className="logo-preview">
                <span>Logo Önizleme</span>
                <img src={settings.logoUrl} alt="Restoran logosu" />
              </div>
            )}

            <div className="settings-form-grid">
              <div className="form-field">
                <label>KDV oranı (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={settings.vatRate}
                  onChange={event => updateField('vatRate', Number(event.target.value))}
                />
                <p className="muted small-text">KDV oranı gelecekte fiş ve raporlama sistemi için kullanılacaktır.</p>
              </div>

              <div className="form-field">
                <label>Para birimi</label>
                <select
                  value={settings.currency}
                  onChange={event => updateField('currency', event.target.value)}
                >
                  {currencyOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn primary" type="submit">Kaydet</button>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="section-header compact">
            <h3>Yedekleme</h3>
          </div>
          <p className="muted">Tüm sistem verilerini tek bir JSON dosyası olarak dışa aktarın.</p>
          <div className="settings-action-box">
            <button className="btn primary" onClick={downloadBackup} type="button">Yedek Al</button>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact">
            <h3>Geri Yükleme</h3>
          </div>
          <p className="muted">Daha önce alınmış JSON yedeğini seçerek sistemi geri yükleyin.</p>
          <div className="settings-action-box">
            <input
              type="file"
              accept="application/json,.json"
              onChange={event => setRestoreFile(event.target.files?.[0] || null)}
            />
            <button className="btn primary" disabled={!restoreFile} onClick={restoreBackup} type="button">Yükle</button>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact">
            <h3>Sistem</h3>
          </div>
          <p className="muted">Demo masa, kategori ve ürün setini yeniden oluşturun.</p>
          <div className="settings-action-box">
            <button className="btn" onClick={generateDemoData} type="button">Demo Veri Oluştur</button>
          </div>
        </section>
      </div>
    </div>
  )
}
