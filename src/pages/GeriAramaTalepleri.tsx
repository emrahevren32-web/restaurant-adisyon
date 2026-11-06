// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · EVREN360 · GERİ ARAMA TALEPLERİ
//
// Ana ekrandaki "Sizi Arayalım" formunun karşılığı. Ekranın tek bir işi
// var ve adı bu: **kimi aramalıyım.** Bu yüzden bekleyen talepler en üstte
// ve sayfanın ilk gördüğün şeyi bekleyen sayısı.
//
// ── ÜÇ KURAL ─────────────────────────────────────────────────────────────
// 1. **SAYILAR EKRANDA HESAPLANMIYOR.** Liste veritabanından geliyor
//    (`public.geri_arama_listesi`); süzgeç sayıları gelen satırlardan
//    sayılıyor, uydurulmuyor.
// 2. **"KİM ARADI" YAZILMIYOR, YAZILIYOR.** İmzayı sunucu atıyor; bu ekran
//    kimlik göndermiyor, parametresi bile yok (0106 · 0087).
// 3. **KAPATMAK GEREKÇE İSTER.** Not boşsa sunucu reddediyor. Boş kapanış,
//    kapanmamış bir talepten kötüdür: liste temiz görünür, yapılan iş
//    kayıtsız kalır.
//
// ── ANA EKRAN TELEFONU DA BURADA ─────────────────────────────────────────
// Emrah'ın isteği (06.11): *"şimdilik yazmasın ama admin panelimde orası
// için telefon numarası girebileceğim yer olsun."* Ayrı bir ekran açmak
// yerine buraya kondu: ikisi de aynı işin parçası (bilgi isteyen biri ya
// formu doldurur ya telefonu arar).
// ⚠️ Alan BOŞSA ana ekranda hiçbir şey görünmez. Bayrak yok, veri var.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import {
  DURUM_ETIKETLERI,
  UYGUN_SAAT_ETIKETLERI,
  telefonuGoster,
  type GeriAramaDurumu,
  type UygunSaat,
} from '../onboarding/geri-arama.service'
import {
  PostgresGeriAramaDefteri,
  type GeriAramaSatiri,
} from '../onboarding/geri-arama.repository'

type Suzgec = 'hepsi' | GeriAramaDurumu

const DURUM_ROZETI: Record<GeriAramaDurumu, string> = {
  NEW: 'warning-pill',
  CONTACTED: 'info-pill',
  CLOSED: 'muted-pill',
}

/** "3 saat önce", "2 gün önce". Boş gelirse tire. */
const neZaman = (iso: string | null): string => {
  if(!iso) return '—'
  const fark = Date.now() - new Date(iso).getTime()
  if(Number.isNaN(fark)) return '—'
  const dakika = Math.floor(fark / 60000)
  if(dakika < 1) return 'şimdi'
  if(dakika < 60) return `${dakika} dakika önce`
  const saat = Math.floor(dakika / 60)
  if(saat < 24) return `${saat} saat önce`
  const gun = Math.floor(saat / 24)
  return `${gun} gün önce`
}

const tamTarih = (iso: string | null): string => {
  if(!iso) return ''
  const t = new Date(iso)
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleString('tr-TR')
}

export default function GeriAramaTalepleri(){
  const [satirlar, setSatirlar] = React.useState<GeriAramaSatiri[]>([])
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [suzgec, setSuzgec] = React.useState<Suzgec>('hepsi')
  const [arama, setArama] = React.useState('')
  const [acikSatir, setAcikSatir] = React.useState('')
  const [notMetni, setNotMetni] = React.useState('')
  const [islemde, setIslemde] = React.useState('')

  // Ana ekran telefonu
  const [telefonAlani, setTelefonAlani] = React.useState('')
  const [kayitliTelefon, setKayitliTelefon] = React.useState<string | null>(null)
  const [telefonMesaji, setTelefonMesaji] = React.useState('')
  const [telefonHatasi, setTelefonHatasi] = React.useState('')

  const defter = React.useMemo(
    () => (isSupabaseConfigured() ? new PostgresGeriAramaDefteri(getSupabase()) : null),
    [],
  )

  const yenile = React.useCallback(async () => {
    if(!defter){
      setHata('Veritabanı bağlantısı yapılandırılmamış.')
      setYukleniyor(false)
      return
    }
    try {
      const [liste, numara] = await Promise.all([
        defter.listele(),
        defter.anaEkranTelefonu(),
      ])
      setSatirlar(liste)
      setKayitliTelefon(numara)
      setTelefonAlani(numara ? telefonuGoster(numara) : '')
      setHata('')
    } catch(e){
      setHata(e instanceof Error ? e.message : 'Geri arama listesi okunamadı.')
    } finally {
      setYukleniyor(false)
    }
  }, [defter])

  React.useEffect(() => { void yenile() }, [yenile])

  const durumYaz = async (referans: string, durum: GeriAramaDurumu) => {
    if(!defter) return
    setIslemde(referans)
    setHata('')
    try {
      await defter.durumuYaz(referans, durum, notMetni)
      setNotMetni('')
      setAcikSatir('')
      await yenile()
    } catch(e){
      setHata(e instanceof Error ? e.message : 'Durum kaydedilemedi.')
    } finally {
      setIslemde('')
    }
  }

  const sil = async (referans: string) => {
    if(!defter) return
    setIslemde(referans)
    setHata('')
    try {
      await defter.sil(referans)
      setAcikSatir('')
      await yenile()
    } catch(e){
      setHata(e instanceof Error ? e.message : 'Kayıt silinemedi.')
    } finally {
      setIslemde('')
    }
  }

  const telefonKaydet = async () => {
    if(!defter) return
    setTelefonHatasi('')
    setTelefonMesaji('')
    try {
      const sonuc = await defter.telefonuYaz(telefonAlani)
      setKayitliTelefon(sonuc)
      setTelefonAlani(sonuc ? telefonuGoster(sonuc) : '')
      setTelefonMesaji(sonuc
        ? 'Kaydedildi. Ana ekranda bu numara görünüyor.'
        : 'Numara kaldırıldı. Ana ekranda artık telefon görünmüyor.')
    } catch(e){
      setTelefonHatasi(e instanceof Error ? e.message : 'Telefon kaydedilemedi.')
    }
  }

  const aranan = arama.trim().toLocaleLowerCase('tr-TR')

  const gorunen = satirlar.filter(satir => {
    if(suzgec !== 'hepsi' && satir.durum !== suzgec) return false
    if(aranan){
      const havuz = [satir.adSoyad, satir.isletmeAdi, satir.telefon,
        satir.eposta ?? '', satir.konu ?? '', satir.referans]
        .join(' ').toLocaleLowerCase('tr-TR')
      if(!havuz.includes(aranan)) return false
    }
    return true
  })

  const sayac = {
    hepsi: satirlar.length,
    NEW: satirlar.filter(s => s.durum === 'NEW').length,
    CONTACTED: satirlar.filter(s => s.durum === 'CONTACTED').length,
    CLOSED: satirlar.filter(s => s.durum === 'CLOSED').length,
  }

  const suzgecler: Array<{ anahtar: Suzgec; etiket: string }> = [
    { anahtar: 'hepsi', etiket: 'Hepsi' },
    { anahtar: 'NEW', etiket: 'Bekliyor' },
    { anahtar: 'CONTACTED', etiket: 'Arandı' },
    { anahtar: 'CLOSED', etiket: 'Kapandı' },
  ]

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Geri Arama Talepleri</h2>
          <p className="muted">
            Ana ekrandaki “Sizi arayalım” formundan gelen bilgi talepleri.
            Bekleyenler en üstte. Kim aradı ve ne zaman aradı bilgisini
            sistem kendisi yazar.
          </p>
        </div>
      </div>

      {hata && <div className="form-error">{hata}</div>}

      {/* ── Ana ekran telefonu ─────────────────────────────────────────── */}
      <section className="card">
        <div className="section-header compact">
          <h3>Ana ekranda görünecek telefon</h3>
          <span className={`status-pill ${kayitliTelefon ? 'info-pill' : 'muted-pill'}`}>
            {kayitliTelefon ? telefonuGoster(kayitliTelefon) : 'Yazılmadı — görünmüyor'}
          </span>
        </div>
        <p className="muted small-text">
          Buraya bir numara yazarsanız ana ekrandaki formun altında
          “Beklemek istemiyorsanız bizi arayın” satırı çıkar. Boş bırakırsanız
          o satır <strong>hiç görünmez</strong> — ayrı bir göster/gizle
          düğmesi yok, numaranın kendisi belirleyici.
        </p>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="ga-ana-telefon">Telefon</label>
            <input
              id="ga-ana-telefon"
              type="tel"
              inputMode="tel"
              placeholder="0232 123 45 67"
              value={telefonAlani}
              onChange={olay => {
                setTelefonAlani(olay.target.value)
                setTelefonMesaji('')
                setTelefonHatasi('')
              }}
            />
            <span className="muted small-text">
              Kaldırmak için alanı boşaltıp kaydedin.
            </span>
          </div>
          <div className="form-field">
            <label>&nbsp;</label>
            <button className="btn primary" type="button" onClick={() => void telefonKaydet()}>
              Kaydet
            </button>
          </div>
        </div>
        {telefonHatasi && <div className="form-error">{telefonHatasi}</div>}
        {telefonMesaji && <p className="muted small-text">{telefonMesaji}</p>}
      </section>

      {/* ── Liste ──────────────────────────────────────────────────────── */}
      <section className="card">
        <div className="section-header compact">
          <h3>Talepler</h3>
          {!yukleniyor && (
            <span className={`status-pill ${sayac.NEW > 0 ? 'warning-pill' : 'muted-pill'}`}>
              {sayac.NEW > 0 ? `${sayac.NEW} talep bekliyor` : 'Bekleyen talep yok'}
            </span>
          )}
        </div>

        <div className="musteri-suzgec">
          <input
            type="search"
            placeholder="Ad, işletme, telefon, numara…"
            value={arama}
            onChange={olay => setArama(olay.target.value)}
          />
          {suzgecler.map(s => (
            <button
              key={s.anahtar}
              type="button"
              className={`btn ${suzgec === s.anahtar ? 'primary' : ''}`}
              onClick={() => setSuzgec(s.anahtar)}
            >
              {s.etiket} ({sayac[s.anahtar]})
            </button>
          ))}
          <button className="btn" type="button" onClick={() => void yenile()}>Yenile</button>
        </div>

        {yukleniyor ? <p className="muted">Yükleniyor…</p>
         : satirlar.length === 0 ? (
            <p className="muted">
              Henüz geri arama talebi yok. Ana ekrandaki “Sizi arayalım”
              formundan gelen talepler burada görünür.
            </p>
         ) : gorunen.length === 0 ? <p className="muted">Bu süzgece uyan talep yok.</p>
         : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kim</th>
                  <th>Telefon</th>
                  <th>İşletme</th>
                  <th>Ne sordu</th>
                  <th>Uygun saat</th>
                  <th>Geldi</th>
                  <th>Durum</th>
                  <th>Arayan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gorunen.map(satir => (
                  <React.Fragment key={satir.referans}>
                    <tr>
                      <td>
                        <strong>{satir.adSoyad}</strong>
                        <div className="muted small-text">{satir.referans}</div>
                        {satir.eposta && (
                          <div className="muted small-text">{satir.eposta}</div>
                        )}
                      </td>
                      <td>
                        <a href={`tel:+90${satir.telefon}`}>{telefonuGoster(satir.telefon)}</a>
                      </td>
                      <td>{satir.isletmeAdi}</td>
                      <td>{satir.konu || <span className="muted">—</span>}</td>
                      <td>
                        {UYGUN_SAAT_ETIKETLERI[satir.uygunSaat as UygunSaat]
                          ?? satir.uygunSaat}
                      </td>
                      <td title={tamTarih(satir.olusturma)}>{neZaman(satir.olusturma)}</td>
                      <td>
                        <span className={`status-pill ${DURUM_ROZETI[satir.durum]}`}>
                          {DURUM_ETIKETLERI[satir.durum]}
                        </span>
                      </td>
                      <td>
                        {satir.arayan
                          ? <>
                              {satir.arayan}
                              <div className="muted small-text" title={tamTarih(satir.arandi)}>
                                {neZaman(satir.arandi)}
                              </div>
                            </>
                          : <span className="muted">—</span>}
                      </td>
                      <td>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => {
                            setAcikSatir(acikSatir === satir.referans ? '' : satir.referans)
                            setNotMetni('')
                          }}
                        >
                          {acikSatir === satir.referans ? 'Kapat' : 'İşlem'}
                        </button>
                      </td>
                    </tr>

                    {acikSatir === satir.referans && (
                      <tr>
                        <td colSpan={9}>
                          <div className="form-field">
                            <label htmlFor={`not-${satir.referans}`}>
                              Not — ne konuşuldu?
                            </label>
                            <textarea
                              id={`not-${satir.referans}`}
                              rows={2}
                              value={notMetni}
                              onChange={olay => setNotMetni(olay.target.value)}
                            />
                            <span className="muted small-text">
                              Kapatırken not <strong>zorunlu</strong>. Notlar
                              birikir; eskisi silinmez.
                            </span>
                          </div>

                          <div className="form-actions">
                            <button
                              className="btn primary"
                              type="button"
                              disabled={islemde === satir.referans}
                              onClick={() => void durumYaz(satir.referans, 'CONTACTED')}
                            >
                              Aradım
                            </button>
                            <button
                              className="btn"
                              type="button"
                              disabled={islemde === satir.referans}
                              onClick={() => void durumYaz(satir.referans, 'CLOSED')}
                            >
                              Kapat
                            </button>
                            <button
                              className="btn"
                              type="button"
                              disabled={islemde === satir.referans}
                              onClick={() => void durumYaz(satir.referans, 'NEW')}
                            >
                              Tekrar beklemeye al
                            </button>
                            {/* ⚠️ KVKK silme hakkının karşılığı. Aydınlatma
                                metni "silmemizi istediğinizde siliyoruz"
                                diyor; bu düğme o cümleyi tutulabilir yapan
                                şey. Geri dönüşü YOK. */}
                            <button
                              className="btn"
                              type="button"
                              disabled={islemde === satir.referans}
                              onClick={() => void sil(satir.referans)}
                            >
                              Kaydı sil (KVKK)
                            </button>
                          </div>

                          {satir.notDefteri && (
                            <>
                              <p className="muted small-text"><strong>Not defteri</strong></p>
                              <pre className="muted small-text">{satir.notDefteri}</pre>
                            </>
                          )}

                          <p className="muted small-text">
                            Onay: {tamTarih(satir.onayZamani)} · metin sürümü{' '}
                            {satir.onaySurumu}
                          </p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!yukleniyor && satirlar.length > 0 && (
          <p className="muted small-text">
            Bekleyen talepler en üstte, sonra arananlar, en altta kapananlar.
            Sıralamayı veritabanı yapıyor.
          </p>
        )}
      </section>
    </div>
  )
}
