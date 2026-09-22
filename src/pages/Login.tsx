import React from 'react'
import { authenticateCredentials, AuthenticationState } from '../auth/authentication.service'
import { loadCompanies, loadLicensePackages } from '../storage'
import { loadSystemAnnouncements } from '../notifications/notification.service'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'

type Props = { onLogin: (state: AuthenticationState) => void }

type PortalUpdate = {
  type: string
  title: string
  description: string
}

type ReferenceCustomer = {
  initials: string
  companyName: string
  workspaceProfile: string
}

type WhyItem = {
  title: string
  description: string
}

const portalUpdates: PortalUpdate[] = [
  {
    type: 'Yeni Modül',
    title: 'EVREN360 SaaS Yönetim Merkezi',
    description: 'Müşteri, tenant, lisans, abonelik ve finans operasyonları tek platform yönetim merkezinde toplandı.'
  },
  {
    type: 'Yeni Özellik',
    title: 'Unified Identity Foundation',
    description: 'SUPER_ADMIN, COMPANY_ADMIN ve COMPANY_USER ayrımı merkezi giriş mimarisiyle hazırlandı.'
  },
  {
    type: 'Performans Güncellemesi',
    title: 'Operasyon ekranları sadeleşti',
    description: 'İşletme yönetimi, stok, finans ve raporlama akışları daha hızlı taranabilir hale getirildi.'
  },
  {
    type: 'Güvenlik Güncellemesi',
    title: 'Security Gateway hazırlığı',
    description: 'Tüm uygulamalar için ortak güvenlik karar modeli ve erişim değerlendirme katmanı oluşturuldu.'
  }
]

const referenceCustomers: ReferenceCustomer[] = [
  { initials: 'AW', companyName: 'Aster Workspace', workspaceProfile: 'Çok şubeli işletme' },
  { initials: 'NG', companyName: 'Nova Grup', workspaceProfile: 'Finans ve operasyon odaklı çalışma alanı' },
  { initials: 'OM', companyName: 'Orion Merkez', workspaceProfile: 'Modül tabanlı yönetim yapısı' }
]

const whyItems: WhyItem[] = [
  {
    title: 'Bulut Tabanlı',
    description: 'Şube, kullanıcı ve operasyon verileri merkezi platform deneyimiyle yönetilir.'
  },
  {
    title: 'Modüler Yapı',
    description: 'İşlem Yönetimi, Dijital Katalog, stok, cari, finans ve personel modülleri ihtiyaca göre aktif edilir.'
  },
  {
    title: 'Çoklu Şube',
    description: 'Şube, kullanıcı ve raporlama altyapısı büyüyen işletmeler için hazırdır.'
  },
  {
    title: 'Yapay Zeka Destekli',
    description: 'Analitik, uyarı merkezi ve karar destek katmanları için genişletilebilir mimari sunar.'
  },
  {
    title: 'Güvenli Altyapı',
    description: 'Identity, Security Gateway, tenant ve yetkilendirme katmanları merkezi tasarlanır.'
  },
  {
    title: 'Ölçeklenebilir Mimari',
    description: 'İşletme çalışma alanı bugün modül tabanlı çalışır; yeni uygulama modülleri eklenebilir.'
  }
]

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('tr-TR')
}

const buildAnnouncementContext = () => ({
  companies: loadCompanies().map(company => ({
    id: company.id,
    label: company.companyName
  })),
  packages: loadLicensePackages().map(packageItem => ({
    id: packageItem.id,
    label: packageItem.name
  }))
})

export default function Login({ onLogin }: Props){
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const loginPanelRef = React.useRef<HTMLElement | null>(null)

  const announcements = React.useMemo(() => {
    return loadSystemAnnouncements(buildAnnouncementContext())
      .filter(announcement => announcement.status === 'Yayında' || announcement.status === 'Planlandı')
      .slice(0, 3)
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setNotice('')
    setError('')
    setSubmitting(true)
    try {
      const result = await authenticateCredentials(email, password, {
        requestedPath: window.location.pathname
      })
      if(result.success) onLogin(result.state)
      else setError('Geçersiz e-posta veya şifre ya da kullanıcı pasif.')
    } catch {
      setError('Giriş yapılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.')
    } finally {
      setSubmitting(false)
    }
  }

  const scrollToLogin = () => {
    loginPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const openApplication = () => {
    window.location.href = '/apply'
  }

  /**
   * Şifremi unuttum.
   *
   * ── NEDEN ŞİMDİ BAĞLANDI ────────────────────────────────────────────────
   * Burada şu yazıyordu: "Şifre sıfırlama akışı sonraki servis fazı için
   * hazırlanacaktır." Yani düğme vardı, işi yoktu. O gün geldi: şifre
   * belirleme ekranı hazır (`SifreBelirle`, A4D madde 6) ve aynı bağlantıyı
   * karşılıyor (`type=recovery`).
   *
   * ⚠️ HESABIN VAR OLUP OLMADIĞINI SÖYLEMİYORUZ. Cevap her iki durumda da
   * aynı: "bağlantı gönderildi". Aksi hâlde bu ekran, hangi e-postaların
   * sistemde kayıtlı olduğunu isteyen herkese söyleyen bir araca dönerdi.
   */
  const [sifreGonderiliyor, setSifreGonderiliyor] = React.useState(false)

  const forgotPassword = async () => {
    setError('')
    setNotice('')

    const adres = email.trim().toLowerCase()
    if(!adres){
      setError('Şifre bağlantısı için e-posta adresinizi yazın.')
      return
    }
    if(!isSupabaseConfigured()){
      setError('Sunucu bağlantısı yapılandırılmamış. Platform yöneticinize bildirin.')
      return
    }

    setSifreGonderiliyor(true)
    try {
      const { error: hata } = await getSupabase().auth.resetPasswordForEmail(adres, {
        redirectTo: `${window.location.origin}/`,
      })
      if(hata){
        // Hız sınırı gerçek ve sık: ham İngilizce metin yerine ne yapması
        // gerektiğini söylüyoruz.
        //
        // ⚠️ 2026-09-21: "Şifre bağlantısı gönderilemedi: Error sending
        // recovery email" müşteriye olduğu gibi gösteriliyordu. Bu metin
        // bizim tarafımızdaki bir arızadır (e-posta sunucusu ayarı) ve
        // müşteriye hiçbir şey anlatmaz. Müşteri ne yapacağını görür; ham
        // metin yalnızca konsola düşer (oturum açılmadan hata defterine
        // yazılamıyor — anon'a yazma yetkisi bilerek verilmedi).
        console.warn('[MİYOP] Şifre bağlantısı gönderilemedi:', hata.message)
        setError(/rate limit|too many/i.test(hata.message)
          ? 'Çok sık denendi. Birkaç dakika sonra tekrar deneyin.'
          : 'Şifre bağlantısı şu an gönderilemedi. Lütfen birkaç dakika sonra '
            + 'tekrar deneyin; sorun sürerse MİYOP destek ekibine yazın.')
        return
      }
      setNotice(
        `${adres} adresine şifre belirleme bağlantısı gönderildi. `
        + 'Gelen kutunuzda yoksa gereksiz/spam klasörüne bakın. '
        + 'Bağlantı kısa ömürlüdür.',
      )
    } catch(e){
      console.warn('[MİYOP] Şifre bağlantısı gönderilemedi:', e)
      setError('Şifre bağlantısı şu an gönderilemedi. Lütfen birkaç dakika sonra tekrar deneyin.')
    } finally {
      setSifreGonderiliyor(false)
    }
  }

  return (
    <div className="unified-login-portal">
      <header className="unified-login-header">
        <a className="unified-login-brand" href="#portal-top" aria-label="MIYOP ana sayfa">
          <span className="unified-login-logo">M</span>
          <span>
            <strong>MIYOP</strong>
            <small>EVREN360 Platformu</small>
          </span>
        </a>
        <nav className="unified-login-nav" aria-label="Portal">
          <a href="#updates">Güncellemeler</a>
          <a href="#announcements">Duyurular</a>
          <a href="#why-miyop">Neden MIYOP?</a>
        </nav>
        <button className="btn unified-login-header-action" type="button" onClick={openApplication}>İşletme Başvurusu</button>
      </header>

      <main id="portal-top">
        <section className="unified-login-hero">
          <div className="unified-login-hero-media" aria-hidden="true" />
          <div className="unified-login-hero-content">
            <div className="unified-login-hero-copy">
              <span className="unified-login-eyebrow">Unified Login Portal</span>
              <h1>MIYOP</h1>
              <p className="unified-login-slogan">İşletme operasyonlarından SaaS platform yönetimine uzanan tek merkez.</p>
              <p className="unified-login-description">
                EVREN360, işletme çalışma alanı ve gelecek modüler uygulamalar için ortak giriş, duyuru, başvuru ve platform vitrinini tek portalda birleştirir.
              </p>
              <div className="unified-login-hero-actions">
                <button className="btn primary" type="button" onClick={scrollToLogin}>Hemen Giriş Yap</button>
                <button className="btn" type="button" onClick={openApplication}>İşletme Başvurusu</button>
              </div>
            </div>

            <section className="unified-login-panel" ref={loginPanelRef} aria-label="Kullanıcı girişi">
              <div className="unified-login-panel-header">
                <span>Giriş Merkezi</span>
                <h2>Hesabınıza giriş yapın</h2>
              </div>
              <form onSubmit={submit}>
                <label>
                  <span>E-posta</span>
                  <input
                    autoComplete="email"
                    type="email"
                    placeholder="ornek@firma.com"
                    value={email}
                    onChange={event => {
                      setEmail(event.target.value)
                      setError('')
                    }}
                  />
                </label>
                <label>
                  <span>Şifre</span>
                  <input
                    autoComplete="current-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={event => {
                      setPassword(event.target.value)
                      setError('')
                    }}
                  />
                </label>
                {error && <div className="unified-login-message error">{error}</div>}
                {notice && <div className="unified-login-message">{notice}</div>}
                <button className="btn primary unified-login-submit" type="submit" disabled={submitting}>
                  {submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
                </button>
                <div className="unified-login-secondary-actions">
                  <button type="button" onClick={() => void forgotPassword()} disabled={sifreGonderiliyor}>
                    {sifreGonderiliyor ? 'Gönderiliyor…' : 'Şifremi Unuttum'}
                  </button>
                  <button type="button" onClick={openApplication}>İşletme Başvurusu</button>
                </div>
              </form>
            </section>
          </div>
        </section>

        <section className="unified-login-section unified-login-platform">
          <div>
            <span className="unified-login-section-label">Platform</span>
            <h2>Tek portal, çoklu uygulama mimarisi</h2>
          </div>
          <div className="unified-login-platform-grid">
            <article>
              <strong>EVREN360</strong>
              <span>Super Admin yönetim merkezi</span>
            </article>
            <article>
              <strong>İşletme Çalışma Alanı</strong>
              <span>Modül tabanlı işletme çalışma alanı</span>
            </article>
            <article>
              <strong>Başvuru Merkezi</strong>
              <span>Yeni işletme kabul noktası</span>
            </article>
          </div>
        </section>

        <section className="unified-login-section" id="updates">
          <div className="unified-login-section-heading">
            <span className="unified-login-section-label">Son Güncellemeler</span>
            <h2>Platform yenilikleri</h2>
          </div>
          <div className="unified-login-card-grid">
            {portalUpdates.map(update => (
              <article className="unified-login-card" key={update.title}>
                <span>{update.type}</span>
                <h3>{update.title}</h3>
                <p>{update.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="unified-login-section" id="announcements">
          <div className="unified-login-section-heading">
            <span className="unified-login-section-label">Sistem Duyuruları</span>
            <h2>Platformdan haberler</h2>
          </div>
          <div className="unified-login-announcement-list">
            {announcements.map(announcement => (
              <article className="unified-login-announcement" key={announcement.id}>
                <div>
                  <span>{announcement.type}</span>
                  <h3>{announcement.title}</h3>
                  <p>{announcement.content}</p>
                </div>
                <time>{formatDate(announcement.startAt)}</time>
              </article>
            ))}
            {announcements.length === 0 && (
              <article className="unified-login-announcement">
                <div>
                  <span>Bilgilendirme</span>
                  <h3>Aktif duyuru bulunmuyor</h3>
                  <p>Platform duyuru alanı Notification Foundation ile uyumlu şekilde hazırdır.</p>
                </div>
              </article>
            )}
          </div>
        </section>

        <section className="unified-login-section">
          <div className="unified-login-section-heading">
            <span className="unified-login-section-label">Referans Müşteriler</span>
            <h2>İlk işletmeler</h2>
          </div>
          <div className="unified-login-reference-grid">
            {referenceCustomers.map(customer => (
              <article className="unified-login-reference" key={customer.companyName}>
                <span>{customer.initials}</span>
                <div>
                  <h3>{customer.companyName}</h3>
                  <p>{customer.workspaceProfile}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="unified-login-section" id="why-miyop">
          <div className="unified-login-section-heading">
            <span className="unified-login-section-label">Neden MIYOP?</span>
            <h2>Platformun güçlü tarafları</h2>
          </div>
          <div className="unified-login-why-grid">
            {whyItems.map(item => (
              <article className="unified-login-why-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="unified-login-footer">
        <strong>MIYOP</strong>
        <span>EVREN360 ve işletme çalışma alanı için birleşik platform giriş deneyimi.</span>
      </footer>
    </div>
  )
}
