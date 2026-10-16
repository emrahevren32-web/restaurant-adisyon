// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Vardiya kilidi perdesi
//
// Kural ve gerekçesi `src/auth/oturum-kilidi.ts` başında. Burası yalnız
// perde: uygulamanın ÜSTÜNE iniyor, arkadaki ekran SÖKÜLMÜYOR.
//
// ⚠️ ARKADAKİ EKRAN NEDEN SÖKÜLMÜYOR: yarım kalan bir sayım, yazılmakta
// olan bir düzeltici faaliyet kaybolmasın diye. Oturumu kapatıp giriş
// ekranına atsaydık, kilit bir güvenlik önlemi değil bir veri kaybı
// sebebi olurdu — ve insanlar ondan kaçınmak için tableti kurcalardı.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import {
  KILIT_BASKA_KULLANICI, KILIT_BASLIK, KILIT_SIFRE_HATALI,
  kilitAciklamasi, kilitDevamEtiketi,
} from '../auth/oturum-kilidi'

type Props = {
  adSoyad: string
  /** Supabase Auth adresi — kullanıcı adı DEĞİL. */
  girisAdresi: string
  onCozuldu: () => void
  onCikis: () => void
}

export default function VardiyaKilidi({
  adSoyad, girisAdresi, onCozuldu, onCikis,
}: Props){
  const [sifre, setSifre] = React.useState('')
  const [hata, setHata] = React.useState('')
  const [calisiyor, setCalisiyor] = React.useState(false)
  const alanRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => { alanRef.current?.focus() }, [])

  const coz = async (olay: React.FormEvent) => {
    olay.preventDefault()
    if(calisiyor) return
    setHata('')

    if(!sifre){
      setHata('Şifrenizi girin.')
      return
    }
    if(!isSupabaseConfigured() || !girisAdresi){
      // Şifre doğrulanamıyorsa perde AÇILMAZ. Açsaydık kilit, bağlantı
      // koptuğunda kendiliğinden devre dışı kalan bir süs olurdu.
      setHata('Bağlantı kurulamadı; şifre doğrulanamıyor. Tekrar deneyin.')
      return
    }

    setCalisiyor(true)
    try{
      // ⚠️ `signInWithPassword` oturumu TAZELER, kapatmaz. Arkadaki ekran
      // mount'ta kaldığı için yarım kalan iş yerinde duruyor.
      const { error } = await getSupabase().auth.signInWithPassword({
        email: girisAdresi, password: sifre,
      })
      if(error){
        setHata(KILIT_SIFRE_HATALI)
        setSifre('')
        alanRef.current?.focus()
        return
      }
      setSifre('')
      onCozuldu()
    } catch {
      setHata('Şifre doğrulanamadı; bağlantıyı kontrol edin.')
    } finally {
      setCalisiyor(false)
    }
  }

  return (
    <div className="vardiya-kilidi" role="dialog" aria-modal="true"
         aria-labelledby="vardiya-kilidi-baslik">
      <div className="vardiya-kilidi-kart">
        <div className="vardiya-kilidi-rozet" aria-hidden="true">🔒</div>
        <h2 id="vardiya-kilidi-baslik">{KILIT_BASLIK}</h2>
        <p className="muted">{kilitAciklamasi(adSoyad)}</p>

        <form onSubmit={coz} className="vardiya-kilidi-form">
          <label htmlFor="vardiya-kilidi-sifre">{kilitDevamEtiketi(adSoyad)}</label>
          <input
            id="vardiya-kilidi-sifre"
            ref={alanRef}
            type="password"
            autoComplete="current-password"
            value={sifre}
            disabled={calisiyor}
            onChange={e => { setSifre(e.target.value); setHata('') }}
            placeholder="Şifreniz"
          />
          {hata && <div className="form-error">{hata}</div>}
          <button className="btn primary" type="submit" disabled={calisiyor}>
            {calisiyor ? 'Doğrulanıyor…' : 'Devam et'}
          </button>
        </form>

        {/* ⚠️ Vardiya değişiminde gelen kişi için. Yalnız şifre kutusu
            gösterseydik, kendi şifresini yazar, açılmaz, "bozuk" der ve
            çoğu zaman ESKİ OTURUMU kullanmaya devam ederdi. */}
        <div className="vardiya-kilidi-alt">
          <p className="muted">{KILIT_BASKA_KULLANICI}</p>
          <button className="btn" type="button" onClick={onCikis} disabled={calisiyor}>
            Çıkış yap, başka hesapla gir
          </button>
        </div>
      </div>
    </div>
  )
}
