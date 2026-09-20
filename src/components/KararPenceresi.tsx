// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Karar penceresi — gerekçe isteyen onay diyaloğu
//
// ── NEDEN `window.prompt` DEĞİL ──────────────────────────────────────────
// Başvuru onayı, "Onayla" düğmesine basınca tarayıcının kendi `prompt`
// penceresini açıyordu. Dört ayrı sorun:
//   1. Tarayıcı diyaloğu SAYFAYI KİLİTLER. JavaScript durur; arkadaki
//      hiçbir şey çizilemez, bir isteği iptal etmek bile mümkün olmaz.
//   2. NE KARAR VERDİĞİNİ GÖSTERMEZ. Tek satır bir kutu; hangi firmayı
//      onayladığını, hangi e-postaya hesap açılacağını görmezsin.
//   3. KURAL UYGULATMAZ. Gerekçe zorunluluğu (en az 3 harf) `prompt`
//      içinde söylenemez; boş geçilir, sonra veritabanı reddeder ve
//      kullanıcı ham hata görür.
//   4. BİÇİMLENDİRİLEMEZ. Uzun not yazılamaz, mobilde kullanılamaz,
//      tarayıcıya göre "localhost:5173 web sitesinin mesajı" gibi bir
//      başlıkla çıkar — bir ürüne yakışmaz.
//
// Bu bileşen dördünü de çözüyor: sayfa canlı kalır, karar verilen şey
// özet olarak gösterilir, gerekçe eşiği düğmeyi kapalı tutar, metin alanı
// çok satırlıdır.
//
// Geri dönüşü olmayan bir işi onaylatan HER yerde bu kullanılır.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'

export type KararPenceresiProps = {
  baslik: string
  /** Ne olacağını bir cümleyle anlatır. Kullanıcı sonucu bilmeli. */
  aciklama?: string
  /** Karar verilen şeyin özeti: firma adı, e-posta, tutar… */
  ozet?: React.ReactNode
  notEtiketi: string
  notIpucu?: string
  /** Gerekçe zorunlu mu ve en az kaç karakter. 0 = zorunlu değil. */
  enAzKarakter?: number
  eylemEtiketi: string
  /** `tehlikeli` kırmızı düğme yapar: ret, iptal, silme. */
  tur?: 'olumlu' | 'tehlikeli'
  onIptal: () => void
  onOnayla: (not: string) => void | Promise<void>
}

export const NOT_SINIRI = 1000

export default function KararPenceresi({
  baslik, aciklama, ozet, notEtiketi, notIpucu,
  enAzKarakter = 0, eylemEtiketi, tur = 'olumlu', onIptal, onOnayla,
}: KararPenceresiProps){
  const [not, setNot] = React.useState('')
  const [hata, setHata] = React.useState('')
  const [calisiyor, setCalisiyor] = React.useState(false)
  const alanRef = React.useRef<HTMLTextAreaElement | null>(null)

  // Açılınca imleç nota gitsin: kullanıcı fareye uzanmak zorunda kalmasın.
  //
  // ⚠️ `preventScroll: true` ŞART. Düz `focus()` çağrısı tarayıcıya "bu
  // alanı görünür yap" der; tarayıcı da bunu EN YAKIN KAYDIRILABİLİR ATAYI
  // kaydırarak yapar — o da pencerenin zemini. Sonuç: pencere ekranın
  // altına kayıyor, düğmelere ulaşmak için sayfayı küçültmek gerekiyordu.
  // Pencere zaten ortalanmış; kaydırmaya ihtiyacı yok.
  React.useEffect(() => { alanRef.current?.focus({ preventScroll: true }) }, [])

  // Esc ile kapanmak beklenen davranış. ⚠️ İşlem sürerken kapanmaz —
  // yarıda kesilen bir karar, kararsız bir kayıt bırakabilir.
  React.useEffect(() => {
    const tus = (olay: KeyboardEvent) => {
      if(olay.key === 'Escape' && !calisiyor) onIptal()
    }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [calisiyor, onIptal])

  const temiz = not.trim()
  const yeterli = temiz.length >= enAzKarakter
  const kapali = calisiyor || !yeterli

  const onayla = async () => {
    if(kapali) return
    setHata('')
    setCalisiyor(true)
    try {
      await onOnayla(temiz)
    } catch(e){
      // Hata penceresi KAPATMAZ: kullanıcı yazdığı notu kaybetmesin.
      setHata(e instanceof Error ? e.message : 'İşlem tamamlanamadı.')
      setCalisiyor(false)
    }
  }

  return (
    <div
      className="modal-backdrop karar-backdrop"
      role="presentation"
      onMouseDown={olay => {
        // Yalnız zemine basınca kapat; panelin içindeki tıklama kapatmasın.
        if(olay.target === olay.currentTarget && !calisiyor) onIptal()
      }}
    >
      <section
        className="card karar-penceresi"
        role="dialog"
        aria-modal="true"
        aria-label={baslik}
      >
        <div className="section-header compact">
          <div>
            <h3>{baslik}</h3>
            {aciklama && <p className="muted">{aciklama}</p>}
          </div>
        </div>

        {ozet && <div className="karar-ozet">{ozet}</div>}

        <label className="form-field">
          <span>
            {notEtiketi}
            {enAzKarakter > 0 && <strong className="karar-zorunlu"> · zorunlu</strong>}
          </span>
          <textarea
            ref={alanRef}
            rows={4}
            maxLength={NOT_SINIRI}
            value={not}
            placeholder={notIpucu}
            disabled={calisiyor}
            onChange={olay => setNot(olay.target.value)}
          />
        </label>

        {enAzKarakter > 0 && !yeterli && (
          <p className="muted karar-esik">
            Gerekçe en az {enAzKarakter} karakter olmalı. Bu not kalıcı kayda
            geçiyor; ileride "neden böyle karar verilmiş" sorusunun cevabı bu.
          </p>
        )}

        {hata && <div className="settings-message error">{hata}</div>}

        <div className="form-actions">
          <button className="btn" type="button" onClick={onIptal} disabled={calisiyor}>
            Vazgeç
          </button>
          <button
            className={tur === 'tehlikeli' ? 'btn danger' : 'btn primary'}
            type="button"
            onClick={onayla}
            disabled={kapali}
          >
            {calisiyor ? 'İşleniyor…' : eylemEtiketi}
          </button>
        </div>
      </section>
    </div>
  )
}
