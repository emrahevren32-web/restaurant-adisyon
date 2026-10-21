import React from 'react'
import {
  profilimiOku,
  profilimiYaz,
  sifremiDegistir,
  type Profilim
} from '../users/profil.repository'
import type { User } from '../types'

type Props = {
  currentUser: User
  onProfileChange?: (user: User) => void
}

/**
 * Profilim — giriş yapan kişinin kendi hesabı.
 *
 * ── BU EKRAN NEDEN YENİDEN YAZILDI ───────────────────────────────────────
 * Eski hâli "Kullanıcı kaydı bulunamadı" diyordu ve HİÇ çalışmıyordu.
 * Sebep: `loadUsers()` ile **localStorage**'ı okuyordu; giriş yapan
 * kullanıcı ise Supabase'deki `app_user` satırından geliyor ve o listeye
 * hiç yazılmıyor. `findIndex` hep `-1` dönüyordu. Ekran, kullanıcının
 * giriş yaptığı dünyadan başka bir dünyayı okuyordu (tuzak 82).
 *
 * Eski hâli ayrıca `addActionLog` ile tarayıcıya "denetim" kaydı yazıyordu
 * — yani "kim yaptı" bilgisi de sahteydi. Gerçek denetim artık
 * veritabanında (göç 0091).
 *
 * ── NE DEĞİŞTİRİLEBİLİR ──────────────────────────────────────────────────
 * Ad soyad, telefon, şifre. Kullanıcı adı ve rol SALT OKUNUR.
 * ⚠️ Bu sınır ekranın nezaketi değil: `app_user` üzerinde `authenticated`
 * rolünün tablo seviyesinde UPDATE hakkı yoktur, yalnız dört kolonda
 * vardır (göç 0012). Ekranı atlayıp REST'e `role_code` göndermek `42501`
 * alır. Prova: `db/prova/prova-0091.sql`.
 */

/** Rol kodunu okunur ada çevirir. Tanımadığını OLDUĞU GİBİ gösterir. */
const ROL_ADLARI: Record<string, string> = {
  super_admin: 'Platform Yöneticisi',
  admin: 'Yönetici',
  isletme_sahibi: 'İşletme Sahibi',
  isletme_muduru: 'İşletme Müdürü',
  depo_sorumlusu: 'Depo Sorumlusu',
  satinalma_sorumlusu: 'Satın Alma Sorumlusu',
  uretim_sorumlusu: 'Üretim Sorumlusu',
  sevkiyat_sorumlusu: 'Sevkiyat Sorumlusu',
  kalite_sorumlusu: 'Kalite Sorumlusu',
  gida_muhendisi: 'Gıda Mühendisi',
  muhasebe: 'Muhasebe',
  personel: 'Personel',
  izleyici: 'İzleyici',
}

const BOS = '—'

const rolAdi = (kod: string | null) => (kod ? ROL_ADLARI[kod] || kod : BOS)

const basHarfleri = (ad: string) => (
  ad
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(parca => parca.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('') || 'U'
)

export default function UserProfile({ currentUser, onProfileChange }: Props){
  const [profil, setProfil] = React.useState<Profilim | null>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [okumaHatasi, setOkumaHatasi] = React.useState('')

  const [adSoyad, setAdSoyad] = React.useState('')
  const [telefon, setTelefon] = React.useState('')
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')
  const [kaydediyor, setKaydediyor] = React.useState(false)

  const [yeniSifre, setYeniSifre] = React.useState('')
  const [sifreTekrar, setSifreTekrar] = React.useState('')
  const [sifreHatasi, setSifreHatasi] = React.useState('')
  const [sifreBilgisi, setSifreBilgisi] = React.useState('')
  const [sifreDegisiyor, setSifreDegisiyor] = React.useState(false)

  const yukle = React.useCallback(async () => {
    setYukleniyor(true)
    setOkumaHatasi('')
    const gelen = await profilimiOku()
    if(!gelen){
      // ⚠️ "Kullanıcı kaydı bulunamadı" DEMİYORUZ. O cümle eski ekranın
      // hatasıydı ve kişiye kendi hesabı yokmuş gibi hissettiriyordu.
      // Burada olan şey okumanın başarısız olması.
      setOkumaHatasi('Profil bilgileriniz okunamadı. Bağlantınızı kontrol '
        + 'edip tekrar deneyin.')
      setProfil(null)
      setYukleniyor(false)
      return
    }
    setProfil(gelen)
    setAdSoyad(gelen.adSoyad)
    setTelefon(gelen.telefon ?? '')
    setYukleniyor(false)
  }, [])

  React.useEffect(() => { void yukle() }, [yukle])

  const kaydet = async (olay: React.FormEvent) => {
    olay.preventDefault()
    if(!profil) return
    setHata('')
    setBilgi('')

    if(!adSoyad.trim()){
      setHata('Ad soyad zorunludur.')
      return
    }

    setKaydediyor(true)
    const sonuc = await profilimiYaz(profil.id, { adSoyad, telefon })
    setKaydediyor(false)

    if(sonuc.durum === 'hata'){
      setHata(sonuc.mesaj)
      return
    }

    setBilgi('Profil bilgileriniz kaydedildi.')
    // ⚠️ Kaydedileni EKRANDAN değil, veritabanından geri okuyoruz:
    // "kaydedildi" yazıp ekranda eski değeri bırakmak, tam da bu ekranın
    // eski kusuruydu.
    await yukle()
    onProfileChange?.({ ...currentUser, fullName: adSoyad.trim(),
      phone: telefon.trim() || undefined })
  }

  const sifreDegistir = async (olay: React.FormEvent) => {
    olay.preventDefault()
    setSifreHatasi('')
    setSifreBilgisi('')

    if(yeniSifre !== sifreTekrar){
      setSifreHatasi('İki şifre aynı değil.')
      return
    }

    setSifreDegisiyor(true)
    const sonuc = await sifremiDegistir(yeniSifre)
    setSifreDegisiyor(false)

    if(sonuc.durum === 'hata'){
      setSifreHatasi(sonuc.mesaj)
      return
    }

    // ⚠️ Şifre hiçbir yerde tutulmuyor; alanlar hemen boşaltılıyor.
    setYeniSifre('')
    setSifreTekrar('')
    setSifreBilgisi('Şifreniz değiştirildi.')
  }

  if(yukleniyor){
    return (
      <div className="user-profile-page">
        <section className="card"><p className="muted">Profil yükleniyor…</p></section>
      </div>
    )
  }

  if(!profil){
    return (
      <div className="user-profile-page">
        <section className="card">
          <div className="form-error">{okumaHatasi}</div>
          <div className="form-actions">
            <button className="btn" type="button" onClick={() => void yukle()}>
              Tekrar dene
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="user-profile-page">
      <section className="card">
        <div className="user-profile-identity">
          <span className="user-profile-avatar" aria-hidden="true">
            {basHarfleri(profil.adSoyad || profil.kullaniciAdi)}
          </span>
          <div>
            <h3>{profil.adSoyad || profil.kullaniciAdi}</h3>
            <p className="muted">
              {rolAdi(profil.rolKodu)}
              {profil.firmaAdi ? ` · ${profil.firmaAdi}` : ''}
            </p>
          </div>
        </div>
      </section>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && !hata && <div className="form-success">{bilgi}</div>}

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header compact">
            <div>
              <h3>Hesap Bilgileri</h3>
              <p className="muted">Ad soyad ve telefonunuzu buradan değiştirebilirsiniz.</p>
            </div>
          </div>

          <form className="form-grid" onSubmit={kaydet}>
            <div className="form-field">
              <label htmlFor="profil-ad">Ad Soyad</label>
              <input id="profil-ad" value={adSoyad} required
                onChange={olay => { setAdSoyad(olay.target.value); setBilgi('') }} />
            </div>

            <div className="form-field">
              <label htmlFor="profil-kullanici">Kullanıcı Adı</label>
              <input id="profil-kullanici" value={profil.kullaniciAdi} readOnly
                aria-describedby="profil-kullanici-aciklama" />
              <small id="profil-kullanici-aciklama" className="muted">
                Giriş adınızın parçası. Değiştirilmesi yöneticinin işi —
                değişirse giriş adresiniz de değişir.
              </small>
            </div>

            <div className="form-field">
              <label htmlFor="profil-eposta">E-posta (giriş adresi)</label>
              <input id="profil-eposta" value={profil.girisAdresi ?? ''} readOnly
                placeholder={BOS} aria-describedby="profil-eposta-aciklama" />
              <small id="profil-eposta-aciklama" className="muted">
                {profil.girisAdresi
                  ? 'Giriş ekranına yazdığınız adres. Buradan değiştirilemez.'
                  : 'Bu oturum e-posta bilgisinden önce açılmış. Çıkıp yeniden girince görünür.'}
              </small>
            </div>

            <div className="form-field">
              <label htmlFor="profil-telefon">Telefon</label>
              <input id="profil-telefon" value={telefon}
                onChange={olay => { setTelefon(olay.target.value); setBilgi('') }} />
            </div>

            <div className="form-actions form-field-wide">
              <button className="btn primary" type="submit" disabled={kaydediyor}>
                {kaydediyor ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              <button className="btn" type="button" disabled={kaydediyor}
                onClick={() => {
                  setAdSoyad(profil.adSoyad)
                  setTelefon(profil.telefon ?? '')
                  setHata('')
                  setBilgi('')
                }}>
                Geri Al
              </button>
            </div>
          </form>
        </section>

        <aside className="product-side">
          <section className="card">
            <div className="section-header compact">
              <h3>Şifre Değiştir</h3>
            </div>
            {sifreHatasi && <div className="form-error">{sifreHatasi}</div>}
            {sifreBilgisi && !sifreHatasi
              && <div className="form-success">{sifreBilgisi}</div>}

            <form className="form-grid" onSubmit={sifreDegistir}>
              <div className="form-field form-field-wide">
                <label htmlFor="profil-sifre">Yeni şifre</label>
                <input id="profil-sifre" type="password" value={yeniSifre}
                  autoComplete="new-password" minLength={8} required
                  onChange={olay => { setYeniSifre(olay.target.value); setSifreBilgisi('') }} />
                <small className="muted">En az 8 karakter.</small>
              </div>
              <div className="form-field form-field-wide">
                <label htmlFor="profil-sifre-tekrar">Yeni şifre (tekrar)</label>
                <input id="profil-sifre-tekrar" type="password" value={sifreTekrar}
                  autoComplete="new-password" minLength={8} required
                  onChange={olay => { setSifreTekrar(olay.target.value); setSifreBilgisi('') }} />
              </div>
              <div className="form-actions form-field-wide">
                <button className="btn" type="submit" disabled={sifreDegisiyor}>
                  {sifreDegisiyor ? 'Değiştiriliyor…' : 'Şifreyi Değiştir'}
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <div className="section-header compact">
              <h3>Yetki ve Erişim</h3>
            </div>
            <p className="muted small-text">
              Bu alanlar yetkilendirme tarafından belirlenir ve buradan
              değiştirilemez.
            </p>

            <div className="user-profile-facts">
              <div>
                <span>Rol</span>
                <strong>{rolAdi(profil.rolKodu)}</strong>
              </div>
              <div>
                <span>Bağlı Firma</span>
                <strong>{profil.firmaAdi ?? BOS}</strong>
              </div>
              <div>
                <span>Şube Erişimi</span>
                <strong>
                  {profil.subeler.length > 0 ? profil.subeler.join(', ') : BOS}
                </strong>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
