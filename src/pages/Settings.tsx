import React from 'react'
import { SystemSettings, User } from '../types'
import LisansKarti from '../components/LisansKarti'
import {
  getCompanyIdForUser,
  loadCompanies,
  loadSettings,
  loadTenantSettings,
  saveCompanies,
  saveSettings,
  saveTenantSettings
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

const getScopedSettings = (user: User): SystemSettings => {
  const baseSettings = loadSettings()
  const companyId = getCompanyIdForUser(user)
  const company = companyId
    ? loadCompanies({ allTenants: true }).find(item => item.id === companyId) || null
    : null
  const tenantSettings = company?.tenantId
    ? loadTenantSettings().find(item => item.tenantId === company.tenantId) || null
    : null

  return {
    ...baseSettings,
    restaurantName: company?.companyName || baseSettings.restaurantName,
    logoUrl: company?.logoUrl || baseSettings.logoUrl,
    currency: tenantSettings?.currency || baseSettings.currency
  }
}

export default function Settings({ currentUser, onSettingsChange }: Props){
  const [settings, setSettings] = React.useState<SystemSettings>(() => getScopedSettings(currentUser))
  const [message, setMessage] = React.useState<Message>(null)

  React.useEffect(() => {
    setSettings(getScopedSettings(currentUser))
  }, [currentUser])

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
    const companyId = getCompanyIdForUser(currentUser)
    if(companyId){
      const now = new Date().toISOString()
      const companies = loadCompanies({ allTenants: true })
      const currentCompany = companies.find(company => company.id === companyId) || null

      saveCompanies(companies.map(company => company.id === companyId
        ? {
          ...company,
          companyName: settings.restaurantName.trim() || company.companyName,
          logoUrl: settings.logoUrl.trim(),
          updatedAt: now
        }
        : company))

      const tenantId = currentCompany?.tenantId || currentUser.tenantId
      if(tenantId){
        const tenantSettings = loadTenantSettings()
        const existingTenantSettings = tenantSettings.find(item => item.tenantId === tenantId)
        saveTenantSettings([
          {
            id: existingTenantSettings?.id || `tenant_settings_${tenantId}`,
            tenantId,
            timezone: existingTenantSettings?.timezone || 'Europe/Istanbul',
            currency: settings.currency,
            language: existingTenantSettings?.language || 'tr-TR',
            dateFormat: existingTenantSettings?.dateFormat || 'DD.MM.YYYY',
            theme: existingTenantSettings?.theme || 'Varsayılan',
            createdAt: existingTenantSettings?.createdAt || now,
            updatedAt: now
          },
          ...tenantSettings.filter(item => item.tenantId !== tenantId)
        ])
      }
    }

    const baseSettings = loadSettings()
    saveSettings({
      ...baseSettings,
      vatRate: settings.vatRate,
      currency: settings.currency
    })
    setSettings(getScopedSettings(currentUser))
    onSettingsChange?.()
    setMessage({ type: 'success', text: 'Genel ayarlar kaydedildi.' })
  }


  return (
    <div className="settings-page">
      <div className="page-title">
        <div>
          <h2>Ayarlar</h2>
          <p className="muted">
            Çalışma alanı bilgileri. Veri yedeği için soldaki
            <strong> Veri Yedeği</strong> ekranını kullanın.
          </p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="settings-layout">
        {/* Lisans EN ÜSTTE: müşterinin "ne zamana kadar kullanabilirim"
            sorusu, yazı tipi ve para birimi ayarlarından önce gelir. */}
        <LisansKarti />

        <section className="card">
          <div className="section-header compact">
            <h3>Genel Ayarlar</h3>
          </div>

          <form className="settings-form" onSubmit={saveGeneralSettings}>
            <div className="form-field">
              <label>Çalışma alanı adı</label>
              <input
                value={settings.restaurantName}
                onChange={event => updateField('restaurantName', event.target.value)}
                placeholder="Çalışma alanı adı"
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
                <img src={settings.logoUrl} alt="Çalışma alanı logosu" />
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

        {/* ⚠️ BURADA "Yedekleme" ve "Geri Yükleme" BÖLÜMLERİ VARDI. KALDIRILDI.
            (2026-09-13)

            İkisi de TARAYICI HAFIZASINI (localStorage) yedekliyor ve geri
            yüklüyordu. Gerçek iş verisi Postgres'te; o düğmeye basan bir
            müşteri "yedeğim var" sanıyor ama elindeki dosyada stok defteri,
            sayım, sevkiyat, HACCP kaydı YOK.

            Yedeği olduğunu sanıp olmamak, hiç yedek almamaktan tehlikelidir.
            Bu yüzden düğmeyi düzeltmedik, KALDIRDIK.

            Gerçek yedek: Ayarlar → Veri Yedeği (src/pages/VeriYedegi.tsx).
            Kiracının bütün iş verisini Postgres'ten okur, doğrulaması var,
            her alış günlüğe yazılır.

            "Geri Yükleme" düğmesi ise BİLEREK YENİDEN YAPILMADI. Yanlış
            yapılmış bir geri yükleme veri kaybından kötüdür: iki dönemin
            verisi karışır ve hangisinin doğru olduğu bir daha bilinemez.
            Karar (Emrah, 2026-09-13): geri yükleme talebi MİYOP'a gelir,
            elle ve kayıt altında yapılır. Bkz. docs/YEDEKLEME.md §4.6 */}
      </div>
    </div>
  )
}
