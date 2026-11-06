// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · ANA EKRAN · "SİZİ ARAYALIM" FORMU
//
// ── NEDEN VAR (Emrah, 06.11.2026) ────────────────────────────────────────
// *"Bilgi isteyenleri arayabileceğimiz bir form doldursunlar."*
//
// Ana ekranda bugüne kadar tek kapı vardı: **İşletme Başvurusu**. O form 14
// alan istiyor ve anlamı *"almaya karar verdim"*dir. İlk temas ise çoğu
// zaman şudur: *"bu ne, kaça, bize uyar mı?"* — o kişi 14 alan doldurmaz.
// Bu form beş alan: ad, telefon, işletme, uygun saat, kısa not.
//
// ── ÜÇ KURAL ─────────────────────────────────────────────────────────────
// 1. **AYRI SAYFA DEĞİL.** Başvuru `/apply`e gidiyor; bu form aynı sayfada
//    duruyor. Bilgi isteyen birini başka bir sayfaya göndermek, en zayıf
//    anında bir tıklama daha istemektir.
// 2. **TARAYICI HAFIZASINA DÜŞMÜYOR.** Başvuru formu Supabase kapalıyken
//    `localStorage`a düşüyor (eski yolu var). Burada düşülecek eski yol
//    YOK; uydurmak "...mış gibi yapmak" olurdu. Bağlantı yoksa form
//    bunu AÇIKÇA söylüyor ve göndermiyor.
// 3. **ONAY OLMADAN GÖNDERİM YOK.** Ad ve telefon kişisel veri. Kutu
//    işaretlenmezse form gitmiyor; sunucuda da `consent_at` NOT NULL.
//
// ⚠️ `../storage` BURAYA GİREMEZ. O dosyadaki okuyucular depo boşken demo
// satır üretiyor (HEDEFLER 3.10) ve bu ekran müşterinin gördüğü İLK ekran.
// Donduran test: `src/onboarding/geri-arama-kapisi.arch.test.ts` ve
// `src/pages/giris-vitrini-dogru-soyler.arch.test.ts`.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import {
  KVKK_AYDINLATMA_METNI,
  KVKK_ONAY_CUMLESI,
  UYGUN_SAATLER,
  UYGUN_SAAT_ETIKETLERI,
  bosGeriAramaTalebi,
  geriAramaDogrula,
  telefonuGoster,
  type GeriAramaTalebi,
  type UygunSaat,
} from '../onboarding/geri-arama.service'
import { PostgresGeriAramaDefteri } from '../onboarding/geri-arama.repository'

export default function GeriAramaFormu(){
  const [form, setForm] = React.useState<GeriAramaTalebi>(() => bosGeriAramaTalebi())
  const [eksikler, setEksikler] = React.useState<string[]>([])
  const [gonderiliyor, setGonderiliyor] = React.useState(false)
  const [referans, setReferans] = React.useState('')
  const [metinAcik, setMetinAcik] = React.useState(false)
  /** Yazılmışsa gösterilecek telefon. Yazılmamışsa `null` → hiç görünmez. */
  const [bizimTelefon, setBizimTelefon] = React.useState<string | null>(null)

  const yapilandirildi = isSupabaseConfigured()

  // ⚠️ BAYRAK YOK, VERİ VAR: numara boşsa bölüm hiç çizilmiyor. Emrah
  // panelden yazdığı an görünüyor. "Göster/gizle" düğmesi ikinci bir
  // gerçeklik yaratırdı.
  React.useEffect(() => {
    if(!yapilandirildi) return
    let iptal = false
    void (async () => {
      const defter = new PostgresGeriAramaDefteri(getSupabase())
      const numara = await defter.anaEkranTelefonu()
      if(!iptal) setBizimTelefon(numara)
    })()
    return () => { iptal = true }
  }, [yapilandirildi])

  const alanYaz = <K extends keyof GeriAramaTalebi>(anahtar: K, deger: GeriAramaTalebi[K]) => {
    setForm(onceki => ({ ...onceki, [anahtar]: deger }))
  }

  const gonder = async (olay: React.FormEvent) => {
    olay.preventDefault()
    if(gonderiliyor) return

    const bulunanlar = geriAramaDogrula(form)
    if(bulunanlar.length > 0){ setEksikler(bulunanlar); return }

    // ⚠️ "Kaydettim" demeden önce kaydın gidebileceğinden emin olmak
    // gerekiyor. Bağlantı yoksa SÖYLÜYORUZ; sessizce bir yere yazıp
    // "aldık" demek bu depoda yasak olan şeyin tam tanımı.
    if(!yapilandirildi){
      setEksikler([
        'Şu an talebinizi kaydedemiyoruz; sunucu bağlantısı yapılandırılmamış. '
        + 'Lütfen biraz sonra tekrar deneyin.',
      ])
      return
    }

    setEksikler([])
    setGonderiliyor(true)
    try {
      const defter = new PostgresGeriAramaDefteri(getSupabase())
      const numara = await defter.gonder(form)
      setReferans(numara)
      setForm(bosGeriAramaTalebi())
    } catch(e){
      setEksikler([e instanceof Error ? e.message : 'Talebiniz gönderilemedi.'])
    } finally {
      setGonderiliyor(false)
    }
  }

  const yeniTalep = () => {
    setReferans('')
    setEksikler([])
    setForm(bosGeriAramaTalebi())
  }

  return (
    <section className="unified-login-section" id="geri-arama">
      <div className="unified-login-section-heading">
        <span className="unified-login-section-label">Bilgi Alın</span>
        <h2>Sizi arayalım</h2>
      </div>

      <div className="unified-login-panel">
        {referans ? (
          <div aria-live="polite">
            <h3>Talebinizi aldık.</h3>
            <div className="public-application-reference">
              <span>Talep Numarası</span>
              <strong>{referans}</strong>
            </div>
            <p>
              Verdiğiniz numaradan sizi arayacağız. Bize yazarsanız ya da
              telefonda konuşursak, talebinizi bu numarayla buluruz.
            </p>
            {/* ⚠️ "24 saat içinde arayacağız" YAZMIYOR. Böyle bir taahhüdü
                tutacak bir düzen (nöbet, vardiya) yok; olmayan bir sözü
                vermek, hiç söz vermemekten kötüdür. */}
            <div className="form-actions">
              <button className="btn" type="button" onClick={yeniTalep}>
                Yeni talep bırak
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="muted">
              MİYOP hakkında bilgi almak için numaranızı bırakın; size biz
              dönelim. İşletme başvurusu yapmanız gerekmiyor.
            </p>

            {eksikler.length > 0 && (
              <div className="form-error" role="alert">
                {eksikler.length === 1 ? (
                  <p>{eksikler[0]}</p>
                ) : (
                  <>
                    <p><strong>Formda {eksikler.length} eksik var:</strong></p>
                    <ul>{eksikler.map(e => <li key={e}>{e}</li>)}</ul>
                  </>
                )}
              </div>
            )}

            <form onSubmit={gonder}>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="ga-ad">Ad Soyad</label>
                  <input
                    id="ga-ad"
                    type="text"
                    autoComplete="name"
                    value={form.adSoyad}
                    onChange={olay => alanYaz('adSoyad', olay.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="ga-tel">Telefon</label>
                  <input
                    id="ga-tel"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0532 123 45 67"
                    value={form.telefon}
                    onChange={olay => alanYaz('telefon', olay.target.value)}
                  />
                  <span className="muted small-text">
                    Sabit hat da olur; sizi bu numaradan arayacağız.
                  </span>
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="ga-firma">İşletme Adı</label>
                  <input
                    id="ga-firma"
                    type="text"
                    autoComplete="organization"
                    value={form.isletmeAdi}
                    onChange={olay => alanYaz('isletmeAdi', olay.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="ga-saat">Uygun Arama Saati</label>
                  <select
                    id="ga-saat"
                    value={form.uygunSaat}
                    onChange={olay => alanYaz('uygunSaat', olay.target.value as UygunSaat)}
                  >
                    {UYGUN_SAATLER.map(saat => (
                      <option key={saat} value={saat}>{UYGUN_SAAT_ETIKETLERI[saat]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="ga-eposta">
                  E-Posta <span className="muted small-text">· isteğe bağlı</span>
                </label>
                <input
                  id="ga-eposta"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.eposta}
                  onChange={olay => alanYaz('eposta', olay.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="ga-konu">
                  Ne hakkında bilgi istiyorsunuz?{' '}
                  <span className="muted small-text">· isteğe bağlı</span>
                </label>
                <textarea
                  id="ga-konu"
                  rows={3}
                  maxLength={600}
                  placeholder="Örnek: fiyat, kurulum süresi, HACCP kayıtları, kaç kullanıcı…"
                  value={form.konu}
                  onChange={olay => alanYaz('konu', olay.target.value)}
                />
              </div>

              {/* ── KVKK ──────────────────────────────────────────────────
                  ⚠️ Metin GİZLİ DEĞİL, KATLI. Tamamını sayfaya yaymak
                  formu uzatıyor; hiç göstermemek ise onayı anlamsız
                  kılardı. Tek tıklamayla açılıyor ve açılmasa da onay
                  cümlesi neye evet dendiğini söylüyor. */}
              <div className="form-field">
                <label htmlFor="ga-onay" className="checkbox-row">
                  <input
                    id="ga-onay"
                    type="checkbox"
                    checked={form.onay}
                    onChange={olay => alanYaz('onay', olay.target.checked)}
                  />
                  <span>{KVKK_ONAY_CUMLESI}</span>
                </label>
                <button
                  type="button"
                  className="unified-login-hint-toggle"
                  aria-expanded={metinAcik}
                  onClick={() => setMetinAcik(acik => !acik)}
                >
                  {metinAcik ? 'Bilgilendirmeyi kapat' : 'Bilgileriniz ne için kullanılıyor?'}
                </button>
                {metinAcik && (
                  <div className="unified-login-hint-panel">
                    <p>{KVKK_AYDINLATMA_METNI}</p>
                  </div>
                )}
              </div>

              {/* Bağlantı yoksa kullanıcı bunu GÖNDERMEYE ÇALIŞMADAN önce
                  bilsin. Düğmeyi kilitlemiyoruz — kilitli bir düğme sebebini
                  söylemez. */}
              {!yapilandirildi && (
                <p className="form-error">
                  Şu an talep kaydedemiyoruz; sunucu bağlantısı yapılandırılmamış.
                </p>
              )}

              <div className="form-actions">
                <button className="btn primary" type="submit" disabled={gonderiliyor}>
                  {gonderiliyor ? 'Gönderiliyor…' : 'Beni Arayın'}
                </button>
              </div>
            </form>

            {/* ⚠️ Numara YAZILMIŞSA görünür. Emrah'ın kararı (06.11): şimdilik
                yazılmayacak, ama panelde yazabileceği bir yer olacak. */}
            {bizimTelefon && (
              <p className="muted small-text">
                Beklemek istemiyorsanız bizi arayın:{' '}
                <a href={`tel:+90${bizimTelefon}`}>{telefonuGoster(bizimTelefon)}</a>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
