// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Şifre belirleme — davet bağlantısının indiği ekran (A4D madde 6)
//
// ── BURASI MÜŞTERİNİN MİYOP'LA İLK TEMASI ────────────────────────────────
// Onaydan sonra işletme sahibine bir davet e-postası gidiyor. Bağlantıya
// tıkladığında ilk gördüğü ekran bu. Burada takılan bir müşteri geri
// dönmez; e-posta bir kez gelir.
//
// ⚠️ MİYOP ŞİFRE ÜRETMEZ, GÖRMEZ, GÖSTERMEZ.
// Eskiden onay ekranında "geçici şifre" yazan bir kart vardı ve o şifre
// ÇALIŞMIYORDU. Şifreyi burada kullanıcının kendisi belirliyor; biz
// hiçbir aşamada bilmiyoruz.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { adresiTemizle, sifreDogrula, SIFRE_EN_AZ, type DavetTuru } from '../auth/davet'

type Props = {
  tur: DavetTuru
  erisimJetonu: string
  yenilemeJetonu: string
  /** Şifre belirlendi; uygulama normal giriş ekranına dönsün. */
  onTamamlandi: () => void
  /** Kullanıcı vazgeçti ya da bağlantı işlemedi. */
  onVazgec: () => void
}

export default function SifreBelirle({
  tur, erisimJetonu, yenilemeJetonu, onTamamlandi, onVazgec,
}: Props){
  const [sifre, setSifre] = React.useState('')
  const [tekrar, setTekrar] = React.useState('')
  const [goster, setGoster] = React.useState(false)
  const [hatalar, setHatalar] = React.useState<string[]>([])
  const [calisiyor, setCalisiyor] = React.useState(false)
  const [eposta, setEposta] = React.useState('')
  const [oturumHatasi, setOturumHatasi] = React.useState('')
  const [bitti, setBitti] = React.useState(false)

  // ── Jetonu oturuma çevir ────────────────────────────────────────────────
  // Bağlantıdaki jeton tek başına şifre değiştirmeye yetmez; önce oturum
  // kurulmalı. Kurulur kurulmaz adres çubuğu temizleniyor.
  React.useEffect(() => {
    let iptal = false

    const kur = async () => {
      if(!isSupabaseConfigured()){
        setOturumHatasi('Sunucu bağlantısı yapılandırılmamış. Yöneticinize bildirin.')
        return
      }
      try {
        const { data, error } = await getSupabase().auth.setSession({
          access_token: erisimJetonu,
          refresh_token: yenilemeJetonu,
        })
        if(iptal) return
        if(error){
          setOturumHatasi(
            'Davet bağlantısı kabul edilmedi. Büyük olasılıkla süresi dolmuş. '
            + 'Yeni bir davet isteyin.',
          )
          return
        }
        setEposta(data.user?.email ?? '')
      } catch {
        if(!iptal) setOturumHatasi('Davet bağlantısı işlenemedi. Yeni bir davet isteyin.')
      } finally {
        // ⚠️ Başarılı da olsa olmasa da adresteki jeton silinir.
        adresiTemizle()
      }
    }

    void kur()
    return () => { iptal = true }
  }, [erisimJetonu, yenilemeJetonu])

  const kaydet = async (olay: React.FormEvent) => {
    olay.preventDefault()
    if(calisiyor) return

    const bulunanlar = sifreDogrula(sifre, tekrar)
    if(bulunanlar.length > 0){ setHatalar(bulunanlar); return }

    setHatalar([])
    setCalisiyor(true)
    try {
      const { error } = await getSupabase().auth.updateUser({ password: sifre })
      if(error) throw new Error(error.message)

      // ⚠️ Şifre kurulduktan sonra oturum KAPATILIYOR. Sebep: kullanıcı
      // yeni şifresiyle bir kez giriş yapsın ki gerçekten çalıştığını
      // görsün. "Kurdum ama bir daha giremiyorum" en kötü ilk deneyimdir.
      await getSupabase().auth.signOut()
      setBitti(true)
    } catch(e){
      setHatalar([e instanceof Error ? e.message : 'Şifre kaydedilemedi.'])
    } finally {
      setCalisiyor(false)
    }
  }

  if(oturumHatasi){
    return (
      <div className="auth-screen">
        <section className="card auth-card">
          <h2>Bağlantı çalışmadı</h2>
          <p className="form-error">{oturumHatasi}</p>
          <p className="muted">
            Davet bağlantıları güvenlik gereği kısa ömürlüdür. MİYOP ekibinden
            yeni bir davet istemeniz yeterli.
          </p>
          <div className="form-actions">
            <button className="btn" type="button" onClick={onVazgec}>Giriş ekranına dön</button>
          </div>
        </section>
      </div>
    )
  }

  if(bitti){
    return (
      <div className="auth-screen">
        <section className="card auth-card">
          <h2>Şifreniz belirlendi</h2>
          <p className="muted">
            {eposta ? <><strong>{eposta}</strong> için şifreniz kaydedildi. </> : null}
            Şimdi yeni şifrenizle giriş yapabilirsiniz.
          </p>
          <div className="form-actions">
            <button className="btn primary" type="button" onClick={onTamamlandi}>
              Giriş yap
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <section className="card auth-card">
        <span className="muted small-text">MİYOP</span>
        <h2>{tur === 'invite' ? 'Hoş geldiniz' : 'Şifrenizi yenileyin'}</h2>
        <p className="muted">
          {tur === 'invite'
            ? 'İşletmeniz açıldı. Devam etmek için kendinize bir şifre belirleyin.'
            : 'Hesabınız için yeni bir şifre belirleyin.'}
        </p>

        {eposta && (
          <div className="karar-ozet">
            <div className="karar-ozet-satir">
              <span>Hesap</span><strong>{eposta}</strong>
            </div>
          </div>
        )}

        <form onSubmit={kaydet}>
          <div className="form-field">
            <label htmlFor="miyop-sifre">Yeni şifre</label>
            <input
              id="miyop-sifre"
              type={goster ? 'text' : 'password'}
              autoComplete="new-password"
              value={sifre}
              disabled={calisiyor}
              onChange={e => setSifre(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="miyop-sifre-tekrar">Şifrenizi tekrar yazın</label>
            <input
              id="miyop-sifre-tekrar"
              type={goster ? 'text' : 'password'}
              autoComplete="new-password"
              value={tekrar}
              disabled={calisiyor}
              onChange={e => setTekrar(e.target.value)}
            />
          </div>

          <label className="form-check">
            <input
              type="checkbox"
              checked={goster}
              onChange={e => setGoster(e.target.checked)}
            />
            <span>Şifreyi göster</span>
          </label>

          <p className="muted small-text">
            En az {SIFRE_EN_AZ} karakter, en az bir harf ve bir rakam.
            Şifrenizi yalnızca siz bilirsiniz; MİYOP göremez.
          </p>

          {hatalar.length > 0 && (
            <ul className="form-error">
              {hatalar.map(h => <li key={h}>{h}</li>)}
            </ul>
          )}

          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={calisiyor}>
              {calisiyor ? 'Kaydediliyor…' : 'Şifreyi kaydet'}
            </button>
            <button className="btn" type="button" onClick={onVazgec} disabled={calisiyor}>
              Vazgeç
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
