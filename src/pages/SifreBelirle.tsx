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
//
// ── ÜÇÜNCÜ KULLANIM: ZORUNLU DEĞİŞİM (0076) ──────────────────────────────
// Ekran üç yolda açılıyor:
//   'invite'   → davet bağlantısı (işletme sahibi, e-postayla)
//   'recovery' → şifremi unuttum bağlantısı
//   'zorunlu'  → personelin İLK GİRİŞİ
//
// Üçüncüsü farklıdır ve farkı önemli: BAĞLANTIDAN GELMİYOR, OTURUM ZATEN
// AÇIK. Yönetici personel hesabını geçici bir şifreyle açtı; kişi o şifreyle
// girdi. Şifreyi yönetici biliyor, dolayısıyla hesap hâlâ yöneticinin
// elinde. Bayrak (`must_change_password`) kalkana kadar uygulamaya
// girilemez; bayrağı düşüren tek şey kişinin kendi eliyle şifre
// belirlemesidir (`sifremi_belirledim`).
//
// ⚠️ 'zorunlu' yolunda JETON YOK ve `setSession` ÇAĞRILMAZ. Çağırsaydık var
// olan oturumu boş jetonla ezer, kişiyi kapı dışına atardık.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import {
  adresiTemizle, sifreDogrula, SIFRE_EN_AZ, SIFRE_ESLESMIYOR, type DavetTuru,
} from '../auth/davet'

/** Bağlantıdan gelen iki yol + oturumu açık olan kişinin zorunlu değişimi. */
export type SifreBelirlemeTuru = DavetTuru | 'zorunlu'

type Props = {
  tur: SifreBelirlemeTuru
  /** 'zorunlu' yolunda jeton YOK — oturum zaten açık. */
  erisimJetonu?: string
  yenilemeJetonu?: string
  /** Şifre belirlendi; uygulama normal giriş ekranına dönsün. */
  onTamamlandi: () => void
  /** Kullanıcı vazgeçti ya da bağlantı işlemedi. 'zorunlu' yolunda: çıkış. */
  onVazgec: () => void
}

export default function SifreBelirle({
  tur, erisimJetonu, yenilemeJetonu, onTamamlandi, onVazgec,
}: Props){
  const zorunlu = tur === 'zorunlu'
  const [sifre, setSifre] = React.useState('')
  const [tekrar, setTekrar] = React.useState('')
  const [goster, setGoster] = React.useState(false)
  const [hatalar, setHatalar] = React.useState<string[]>([])
  const [calisiyor, setCalisiyor] = React.useState(false)
  const [eposta, setEposta] = React.useState('')
  const [oturumHatasi, setOturumHatasi] = React.useState('')
  const [bitti, setBitti] = React.useState(false)
  const [bayrakUyarisi, setBayrakUyarisi] = React.useState('')
  // Alan "dokunulmuş" sayılmadan uyarı çıkmaz. Yoksa ekran açılır açılmaz
  // "şifre en az 8 karakter olmalı" diye bağırır; kullanıcı daha hiçbir şey
  // yazmamıştır ve karşılandığı ilk şey bir hata listesi olur.
  const [sifreyeDokunuldu, setSifreyeDokunuldu] = React.useState(false)
  const [tekraraDokunuldu, setTekraraDokunuldu] = React.useState(false)

  // ── CANLI DENETİM ───────────────────────────────────────────────────────
  // ⚠️ Eskiden bütün denetim yalnızca "Şifreyi kaydet"e basınca çalışıyordu.
  // Kullanıcı iki alana FARKLI şifre yazıp hiçbir uyarı görmeden düğmeye
  // gidiyor, orada reddediliyordu. İki alanı da dikkatle doldurmuş biri için
  // bu, yazarken görülebilecek bir hatanın en geç anda söylenmesi demek.
  // Artık yazarken söyleniyor; kaydetme denetimi aynen yerinde duruyor
  // (ikinci savunma hattı — ekran değişse de kural değişmez).
  const tumHatalar = sifreDogrula(sifre, tekrar)
  const kuralHatalari = sifreyeDokunuldu && sifre.length > 0
    ? tumHatalar.filter(h => h !== SIFRE_ESLESMIYOR)
    : []
  const eslesmiyor = tekraraDokunuldu && tekrar.length > 0 && sifre !== tekrar
  const hazir = tumHatalar.length === 0

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
        // ⚠️ 'zorunlu' yolunda oturum ZATEN AÇIK; yalnız kimin olduğunu
        // okuyoruz. `setSession` burada çağrılsaydı açık oturumu boş
        // jetonla ezer ve kişiyi kapı dışına atardı.
        if(zorunlu){
          const { data: oturum } = await getSupabase().auth.getUser()
          if(iptal) return
          if(!oturum?.user){
            setOturumHatasi('Oturumunuz düşmüş görünüyor. Lütfen yeniden giriş yapın.')
            return
          }
          setEposta(oturum.user.email ?? '')
          return
        }
        const { data, error } = await getSupabase().auth.setSession({
          access_token: erisimJetonu ?? '',
          refresh_token: yenilemeJetonu ?? '',
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
        // ('zorunlu' yolunda adreste jeton yok; temizlik zararsız.)
        adresiTemizle()
      }
    }

    void kur()
    return () => { iptal = true }
  }, [erisimJetonu, yenilemeJetonu, zorunlu])

  const kaydet = async (olay: React.FormEvent) => {
    olay.preventDefault()
    if(calisiyor) return

    // ⚠️ Kural hataları ARTIK burada listelenmiyor; alanların altında zaten
    // canlı duruyorlar. Burada yalnızca iki alanı "dokunuldu" sayıyoruz ki
    // hiç yazmadan düğmeye basan biri de uyarıları görsün. Kural denetiminin
    // kendisi duruyor — ekran değişse bile zayıf şifre buradan geçemez.
    setSifreyeDokunuldu(true)
    setTekraraDokunuldu(true)
    if(sifreDogrula(sifre, tekrar).length > 0) return

    setHatalar([])
    setCalisiyor(true)
    try {
      const { error } = await getSupabase().auth.updateUser({ password: sifre })
      if(error) throw new Error(error.message)

      // ⚠️ BAYRAĞI ŞİFRE DEĞİŞTİKTEN SONRA, OTURUM KAPANMADAN ÖNCE
      // DÜŞÜRÜYORUZ. Sırası önemli: önce düşürüp sonra şifre değişimi
      // başarısız olsa, kişi eski geçici şifresiyle kalır ama kapı açılmış
      // olurdu — yöneticinin bildiği şifreyle erişilen bir hesap.
      if(zorunlu){
        const { error: bayrakHatasi } = await getSupabase().rpc('sifremi_belirledim')
        if(bayrakHatasi){
          // ⚠️ ŞİFRE DEĞİŞTİ ama bayrak kalktı kaldı. Yalan söylemiyoruz:
          // şifre gerçekten yeni, yalnız bir sonraki girişte bu ekran bir
          // kez daha çıkacak. Zararsız tarafta kalan arıza budur.
          console.warn('[MİYOP] Şifre bayrağı düşürülemedi:', bayrakHatasi.message)
          setBayrakUyarisi(
            'Yeni şifreniz kaydedildi. Ancak sistem kaydı güncellenemediği için '
            + 'bir sonraki girişinizde bu ekran bir kez daha çıkabilir — '
            + 'yeni şifrenizle girip aynı şifreyi tekrar belirlemeniz yeterli.',
          )
        }
      }

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
            {zorunlu && ' Bu şifreyi artık yalnızca siz biliyorsunuz.'}
          </p>
          {bayrakUyarisi && <p className="form-error">{bayrakUyarisi}</p>}
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
        <h2>
          {tur === 'invite' ? 'Hoş geldiniz'
            : zorunlu ? 'Kendinize bir şifre belirleyin'
            : 'Şifrenizi yenileyin'}
        </h2>
        <p className="muted">
          {tur === 'invite'
            ? 'İşletmeniz açıldı. Devam etmek için kendinize bir şifre belirleyin.'
            : zorunlu
              // ⚠️ SEBEBİ SÖYLENİYOR. "Şifrenizi değiştirin" deyip sebebi
              // söylememek, kişiye zorunluluğu keyfî gösterir. Sebep gerçek:
              // şu anki şifreyi yöneticisi biliyor.
              ? 'Hesabınız yöneticiniz tarafından geçici bir şifreyle açıldı ve '
                + 'o şifreyi yöneticiniz biliyor. Devam etmek için yalnızca sizin '
                + 'bileceğiniz bir şifre belirlemeniz gerekiyor.'
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
              aria-invalid={kuralHatalari.length > 0}
              onChange={e => { setSifreyeDokunuldu(true); setSifre(e.target.value) }}
            />
            {kuralHatalari.length > 0 && (
              <ul className="form-error" aria-live="polite">
                {kuralHatalari.map(h => <li key={h}>{h}</li>)}
              </ul>
            )}
          </div>
          <div className="form-field">
            <label htmlFor="miyop-sifre-tekrar">Şifrenizi tekrar yazın</label>
            <input
              id="miyop-sifre-tekrar"
              type={goster ? 'text' : 'password'}
              autoComplete="new-password"
              value={tekrar}
              disabled={calisiyor}
              aria-invalid={eslesmiyor}
              onChange={e => { setTekraraDokunuldu(true); setTekrar(e.target.value) }}
            />
            {/* Uyarı YAZARKEN çıkar, kaydete basınca değil. */}
            {eslesmiyor && (
              <p className="form-error" aria-live="polite">{SIFRE_ESLESMIYOR}</p>
            )}
            {!eslesmiyor && tekraraDokunuldu && tekrar.length > 0 && hazir && (
              <p className="form-success small-text" aria-live="polite">
                İki şifre aynı.
              </p>
            )}
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
            {/* ⚠️ 'zorunlu' yolunda "Vazgeç" YANLIŞ bir söz olurdu: vazgeçip
                uygulamaya giremez, yalnız çıkabilir. Düğme ne yapıyorsa onu
                yazıyor. */}
            <button className="btn" type="button" onClick={onVazgec} disabled={calisiyor}>
              {zorunlu ? 'Çıkış yap' : 'Vazgeç'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
