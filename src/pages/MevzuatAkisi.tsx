// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · EVREN360 · MEVZUAT AKIŞI
//
// Giriş vitrinindeki mevzuat kutusunun yönetimi. Ekranın tek işi var:
// **vitrinde ne görünecek.**
//
// ── ÜÇ KURAL ─────────────────────────────────────────────────────────────
// 1. **KAYNAK ZORUNLU.** Emrah'ın isteğinin çekirdeği bu: "kaynak
//    gösterilerek". Kaynaksız bir mevzuat cümlesi, MIYOP-059'un uydurma
//    duyurusundan farksızdır. Hem bu ekran hem veritabanı istiyor.
// 2. **YAYINA ALMAK AYRI BİR ADIM.** Yeni kayıt `TASLAK` açılıyor. Yazmak
//    ile yayınlamak aynı tuş olsaydı, yarım yazılmış bir cümle müşterinin
//    gördüğü ilk ekrana düşerdi.
// 3. **İMZA YAZILMIYOR, YAZILIYOR.** Kimin yazdığını sunucu damgalıyor;
//    bu ekran kimlik göndermiyor, parametresi bile yok (0113 · 0087).
//
// ⚠️ Ekranda gösterilen her sayı ve satır VERİTABANINDAN geliyor
// (`public.mevzuat_listesi`). Burada hiçbir şey uydurulmuyor, hiçbir şey
// tarayıcıda saklanmıyor.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import {
  BASLIK_EN_COK,
  KAYNAK_EN_COK,
  MEVZUAT_DURUMLARI,
  MEVZUAT_DURUM_ETIKETI,
  OZET_EN_COK,
  VITRIN_SATIR_SINIRI,
  mevzuatDogrula,
  tarihiGoster,
  type MevzuatDurumu,
  type MevzuatGirdisi,
} from '../platform/mevzuat.service'
import { PostgresMevzuatDefteri, type MevzuatSatiri } from '../platform/mevzuat.repository'

const bosForm = (): MevzuatGirdisi => ({
  baslik: '',
  ozet: '',
  kaynakAdi: '',
  kaynakAdresi: '',
  yayimTarihi: new Date().toISOString().slice(0, 10),
  durum: 'TASLAK',
})

const formaCevir = (satir: MevzuatSatiri): MevzuatGirdisi => ({
  baslik: satir.baslik,
  ozet: satir.ozet ?? '',
  kaynakAdi: satir.kaynakAdi,
  kaynakAdresi: satir.kaynakAdresi,
  yayimTarihi: satir.yayimTarihi.slice(0, 10),
  durum: satir.durum,
})

export default function MevzuatAkisi(){
  const [satirlar, setSatirlar] = React.useState<MevzuatSatiri[]>([])
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')
  const [eksikler, setEksikler] = React.useState<string[]>([])
  const [form, setForm] = React.useState<MevzuatGirdisi>(() => bosForm())
  const [duzenlenen, setDuzenlenen] = React.useState('')
  const [kaydediliyor, setKaydediliyor] = React.useState(false)
  const [islemde, setIslemde] = React.useState('')
  const [silinecek, setSilinecek] = React.useState('')

  const defter = React.useMemo(
    () => (isSupabaseConfigured() ? new PostgresMevzuatDefteri(getSupabase()) : null),
    [],
  )

  const yenile = React.useCallback(async () => {
    if(!defter){
      setHata('Veritabanı bağlantısı yapılandırılmamış.')
      setYukleniyor(false)
      return
    }
    try {
      setSatirlar(await defter.listele())
      setHata('')
    } catch(e){
      setHata(e instanceof Error ? e.message : 'Mevzuat listesi okunamadı.')
    } finally {
      setYukleniyor(false)
    }
  }, [defter])

  React.useEffect(() => { void yenile() }, [yenile])

  const alanYaz = <K extends keyof MevzuatGirdisi>(anahtar: K, deger: MevzuatGirdisi[K]) => {
    setForm(onceki => ({ ...onceki, [anahtar]: deger }))
    setBilgi('')
  }

  const formuSifirla = () => {
    setForm(bosForm())
    setDuzenlenen('')
    setEksikler([])
  }

  const kaydet = async (olay: React.FormEvent) => {
    olay.preventDefault()
    if(!defter || kaydediliyor) return

    // ⚠️ Asıl kapı sunucuda (0113). Buradaki kontrol kullanıcıya SEBEBİNİ
    // erken söylemek için; tarayıcıdaki kontrol güvenlik sınırı değildir.
    const bulunanlar = mevzuatDogrula(form)
    if(bulunanlar.length > 0){ setEksikler(bulunanlar); return }

    setEksikler([])
    setKaydediliyor(true)
    setHata('')
    try {
      await defter.yaz(duzenlenen || null, form)
      // ⚠️ Ekranda gösterilen şey, VERİTABANINDAN GERİ OKUNAN şey.
      await yenile()
      setBilgi(duzenlenen ? 'Kayıt güncellendi.' : 'Kayıt eklendi.')
      formuSifirla()
    } catch(e){
      setHata(e instanceof Error ? e.message : 'Kayıt yazılamadı.')
    } finally {
      setKaydediliyor(false)
    }
  }

  const durumYaz = async (satir: MevzuatSatiri, durum: MevzuatDurumu) => {
    if(!defter) return
    setIslemde(satir.kimlik)
    setHata('')
    try {
      await defter.yaz(satir.kimlik, { ...formaCevir(satir), durum })
      await yenile()
    } catch(e){
      setHata(e instanceof Error ? e.message : 'Durum değiştirilemedi.')
    } finally {
      setIslemde('')
    }
  }

  const sil = async (kimlik: string) => {
    if(!defter) return
    setIslemde(kimlik)
    setHata('')
    try {
      await defter.sil(kimlik)
      setSilinecek('')
      if(duzenlenen === kimlik) formuSifirla()
      await yenile()
    } catch(e){
      setHata(e instanceof Error ? e.message : 'Kayıt silinemedi.')
    } finally {
      setIslemde('')
    }
  }

  const duzenle = (satir: MevzuatSatiri) => {
    setForm(formaCevir(satir))
    setDuzenlenen(satir.kimlik)
    setEksikler([])
    setBilgi('')
  }

  const yayindaSayisi = satirlar.filter(s => s.durum === 'YAYINDA').length

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Mevzuat Akışı</h2>
          <p className="muted">
            Giriş ekranının köşesinde görünen mevzuat kutusu buradan
            yönetiliyor. Yalnız <strong>yayında</strong> olan kayıtlar
            görünür; hiç yayında kayıt yoksa kutu <strong>hiç çizilmez</strong>.
          </p>
        </div>
      </div>

      {hata && <div className="form-error">{hata}</div>}

      <section className="card">
        <div className="section-header compact">
          <h3>{duzenlenen ? 'Kaydı düzenle' : 'Yeni kayıt'}</h3>
          <span className={`status-pill ${yayindaSayisi > 0 ? 'info-pill' : 'muted-pill'}`}>
            {yayindaSayisi > 0
              ? `${yayindaSayisi} kayıt yayında · vitrinde en çok ${VITRIN_SATIR_SINIRI} tanesi`
              : 'Yayında kayıt yok — vitrinde kutu görünmüyor'}
          </span>
        </div>

        {eksikler.length > 0 && (
          <div className="form-error" role="alert">
            <ul>{eksikler.map(e => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
        {bilgi && <p className="muted small-text">{bilgi}</p>}

        <form onSubmit={e => void kaydet(e)}>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="mv-baslik">Başlık</label>
              <input
                id="mv-baslik"
                value={form.baslik}
                maxLength={BASLIK_EN_COK}
                placeholder="Gıda Hijyeni Yönetmeliğinde değişiklik"
                onChange={e => alanYaz('baslik', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="mv-tarih">Yayım tarihi</label>
              <input
                id="mv-tarih"
                type="date"
                value={form.yayimTarihi}
                onChange={e => alanYaz('yayimTarihi', e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="mv-ozet">Özet (isteğe bağlı)</label>
            <textarea
              id="mv-ozet"
              rows={3}
              value={form.ozet}
              maxLength={OZET_EN_COK}
              placeholder="Bir iki cümle. Boş bırakırsanız vitrinde yalnız başlık görünür."
              onChange={e => alanYaz('ozet', e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="mv-kaynak">Kaynak adı</label>
              <input
                id="mv-kaynak"
                value={form.kaynakAdi}
                maxLength={KAYNAK_EN_COK}
                placeholder="Resmî Gazete"
                onChange={e => alanYaz('kaynakAdi', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="mv-adres">Kaynak adresi</label>
              <input
                id="mv-adres"
                value={form.kaynakAdresi}
                placeholder="https://www.resmigazete.gov.tr/..."
                onChange={e => alanYaz('kaynakAdresi', e.target.value)}
              />
              <span className="muted small-text">
                {/* ⚠️ Bu bir biçim tercihi değil: bağlantı giriş ekranında
                    tıklanabilir çiziliyor. Kapı veritabanında (0113). */}
                <code>https://</code> ile başlamalı. Bu bağlantı giriş
                ekranında tıklanabilir olarak gösteriliyor.
              </span>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="mv-durum">Durum</label>
            <select
              id="mv-durum"
              value={form.durum}
              onChange={e => alanYaz('durum', e.target.value as MevzuatDurumu)}
            >
              {MEVZUAT_DURUMLARI.map(d => (
                <option key={d} value={d}>{MEVZUAT_DURUM_ETIKETI[d]}</option>
              ))}
            </select>
            <span className="muted small-text">
              Yeni kayıtlar <strong>taslak</strong> başlar. Yayına almadan
              giriş ekranında görünmez.
            </span>
          </div>

          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={kaydediliyor || !defter}>
              {kaydediliyor ? 'Kaydediliyor…' : (duzenlenen ? 'Güncelle' : 'Ekle')}
            </button>
            {duzenlenen && (
              <button className="btn" type="button" onClick={formuSifirla}>Vazgeç</button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-header compact">
          <h3>Kayıtlar</h3>
          <span className="status-pill muted-pill">{satirlar.length} kayıt</span>
        </div>

        {yukleniyor && <p className="muted">Yükleniyor…</p>}

        {!yukleniyor && satirlar.length === 0 && (
          // ⚠️ Uydurma örnek satır YOK. Boş liste boş görünür.
          <p className="muted">
            Henüz kayıt yok. Yukarıdaki formla ilk mevzuat haberini ekleyebilirsiniz.
          </p>
        )}

        {satirlar.map(satir => (
          <article className="card" key={satir.kimlik}>
            <div className="section-header compact">
              <h3>{satir.baslik}</h3>
              <span className={`status-pill ${satir.durum === 'YAYINDA' ? 'info-pill' : 'muted-pill'}`}>
                {MEVZUAT_DURUM_ETIKETI[satir.durum]}
              </span>
            </div>
            <p className="muted small-text">
              {tarihiGoster(satir.yayimTarihi)} · {satir.kaynakAdi}
              {satir.yazan ? ` · ekleyen: ${satir.yazan}` : ''}
            </p>
            {satir.ozet && <p>{satir.ozet}</p>}
            <p className="muted small-text">
              <a href={satir.kaynakAdresi} target="_blank" rel="noopener noreferrer">
                {satir.kaynakAdresi}
              </a>
            </p>

            <div className="form-actions">
              <button
                className="btn"
                type="button"
                disabled={islemde === satir.kimlik}
                onClick={() => duzenle(satir)}
              >
                Düzenle
              </button>
              {satir.durum !== 'YAYINDA' && (
                <button
                  className="btn primary"
                  type="button"
                  disabled={islemde === satir.kimlik}
                  onClick={() => void durumYaz(satir, 'YAYINDA')}
                >
                  Yayına al
                </button>
              )}
              {satir.durum === 'YAYINDA' && (
                <button
                  className="btn"
                  type="button"
                  disabled={islemde === satir.kimlik}
                  onClick={() => void durumYaz(satir, 'ARSIV')}
                >
                  Vitrinden kaldır
                </button>
              )}
              {/* ⚠️ İKİ ADIMDA SİLME. Tek tıkla silinen bir satırın geri
                  dönüşü yok; onay penceresi yerine düğmenin kendisi soruyor
                  (tarayıcı penceresi açmıyoruz). */}
              {silinecek === satir.kimlik ? (
                <>
                  <button
                    className="btn"
                    type="button"
                    disabled={islemde === satir.kimlik}
                    onClick={() => void sil(satir.kimlik)}
                  >
                    Silmeyi onayla
                  </button>
                  <button className="btn" type="button" onClick={() => setSilinecek('')}>
                    Vazgeç
                  </button>
                </>
              ) : (
                <button
                  className="btn"
                  type="button"
                  disabled={islemde === satir.kimlik}
                  onClick={() => setSilinecek(satir.kimlik)}
                >
                  Sil
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
