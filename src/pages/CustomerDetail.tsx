// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · EVREN360 · Müşteri Detayı
//
// Emrah'ın 16.10.2026'daki 20 maddelik listesi. Her başlık numarasıyla
// duruyor ki neyin cevaplandığı, neyin cevaplanmadığı görülsün.
//
// ── EN ÖNEMLİ KURAL ──────────────────────────────────────────────────────
// Cevabı olmayan soru BOŞ GÖSTERİLİR ve neden boş olduğu YAZILIR.
// Uydurma sayı koymak ("0 ₺ borç", "taahhüt yok") platform sahibini yanlış
// yönlendirir — ve bunu yapan bir ekran, doğru söylediği yerlerde de
// güvenilmez olur.
//
// ── NE BİLEREK YOK ───────────────────────────────────────────────────────
// 1.6 "en çok ürettiği ve sattığı ürünler": veritabanı fonksiyonu yazıldı
//     ama EKRANA KONMADI. Gerekçe (Emrah kararı, 16.10.2026): bu müşterinin
//     ticari bilgisidir; MİYOP'un onu görmesi müşteride haklı bir rahatsızlık
//     yaratır. Fonksiyon 0084 ile kaldırılacak.
// 2.4 taahhüt · 5.2 sonraki ödeme · 5.3 borç · 5.4 yönetici notu:
//     bunların tablosu henüz yok (0084'te açılacak).
//
// Veri kaynağı: 0083 · `platform_musteri_detayi`, `_kullanicilari`,
// `_kullanim_saatleri`. Hepsinin ilk satırı `platform.manage` kontrolü.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { lisansiUzat } from '../billing/license-platform.repository'
import { getBusinessWorkspaceModuleByLicenseKey } from '../modules/business-workspace.registry'
import type { LicenseModuleKey } from '../types'
import {
  kullanimSaatleriniOku,
  musteriDetayiniOku,
  musteriKullanicilariniOku,
  type KullanimSaati,
  type MusteriDetayi,
  type MusteriKullanicisi
} from '../platform/platform-musteri.repository'
import {
  BOS, bosDegilse, gunFarkiMetni, kisaTarih, paraVeyaBelirsiz,
  sektorAdi, tarihSaat, zamanAraligi
} from '../platform/platform-musteri.bicim'

type Props = {
  customerId: string
  onBack: () => void
}

/** Tek bir soru-cevap satırı. `not` alanı "neden boş" cevabını taşır. */
const Alan = ({ etiket, deger, not }: {
  etiket: string
  deger?: React.ReactNode
  not?: string
}) => (
  <div className="musteri-alan">
    <span className="muted small-text">{etiket}</span>
    <div>{deger ?? BOS}</div>
    {not && <div className="muted small-text">{not}</div>}
  </div>
)

/** Henüz deposu olmayan sorular için. Boş kutu değil, GEREKÇELİ kutu. */
const HenuzYok = ({ etiket, gerekce }: { etiket: string; gerekce: string }) => (
  <div className="musteri-alan">
    <span className="muted small-text">{etiket}</span>
    <div><span className="status-pill warning-pill">Takip edilmiyor</span></div>
    <div className="muted small-text">{gerekce}</div>
  </div>
)

const ROL_ADLARI: Record<string, string> = {
  super_admin: 'Süper Yönetici',
  admin: 'Yönetici',
  isletme_sahibi: 'İşletme Sahibi',
  isletme_muduru: 'İşletme Müdürü',
  kalite_sorumlusu: 'Kalite Sorumlusu',
  gida_muhendisi: 'Gıda Mühendisi',
  uretim_sorumlusu: 'Üretim Sorumlusu',
  depo_sorumlusu: 'Depo Sorumlusu',
  satin_alma_sorumlusu: 'Satın Alma Sorumlusu',
  personel: 'Personel'
}

const SAAT_PENCERESI = 90

/**
 * Modül kodunun Türkçesi.
 *
 * ⚠️ Emrah sordu (17.10.2026): "2.5 · Açık modüller: current multi-branch
 * purchase recipe stock — bunlar ne işe yarıyor?" Haklı: ekranda PAKETİN
 * AÇTIĞI MODÜLLERİN ham kodları yazıyordu. Kod, kayıt defterindeki adıyla
 * gösteriliyor artık. Eşleşme bulunamazsa ham kod kalıyor — sessizce
 * uydurma bir ad yazmak, bilmediğimizi biliyormuş gibi göstermek olur.
 */
const modulAdi = (anahtar: string) =>
  getBusinessWorkspaceModuleByLicenseKey(anahtar as LicenseModuleKey)?.name ?? anahtar

export default function CustomerDetail({ customerId, onBack }: Props){
  const [detay, setDetay] = React.useState<MusteriDetayi | null>(null)
  const [kullanicilar, setKullanicilar] = React.useState<MusteriKullanicisi[]>([])
  const [saatler, setSaatler] = React.useState<KullanimSaati[]>([])
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')
  const [uzatmaAcik, setUzatmaAcik] = React.useState(false)
  const [uzatmaAy, setUzatmaAy] = React.useState('1')
  const [uzatmaNotu, setUzatmaNotu] = React.useState('')
  const [uzatmaUcretli, setUzatmaUcretli] = React.useState(false)
  const [islemde, setIslemde] = React.useState(false)
  const [tazeleme, setTazeleme] = React.useState(0)

  React.useEffect(() => {
    let iptal = false
    setYukleniyor(true)

    void (async () => {
      if(!customerId){
        setHata('Müşteri seçilmedi.')
        setYukleniyor(false)
        return
      }
      if(!isSupabaseConfigured()){
        setHata('Veritabanı bağlantısı yapılandırılmamış.')
        setYukleniyor(false)
        return
      }
      try {
        const istemci = getSupabase()
        const [d, k, s] = await Promise.all([
          musteriDetayiniOku(istemci, customerId),
          musteriKullanicilariniOku(istemci, customerId),
          kullanimSaatleriniOku(istemci, customerId, SAAT_PENCERESI)
        ])
        if(iptal) return
        setDetay(d)
        setKullanicilar(k)
        setSaatler(s)
        setHata(d ? '' : 'Bu işletme bulunamadı.')
      } catch(e){
        if(!iptal) setHata(e instanceof Error ? e.message : 'Müşteri kartı okunamadı.')
      } finally {
        if(!iptal) setYukleniyor(false)
      }
    })()

    return () => { iptal = true }
  }, [customerId, tazeleme])

  /**
   * Lisansı buradan uzatmak.
   *
   * ⚠️ Lisans Yönetimi ekranındaki ile AYNI çağrı (`lisansi_uzat`, 0043).
   * İkinci bir uzatma yolu yazmıyoruz: ücretli/ücretsiz ayrımı, defter
   * kaydı ve tek-yürürlük kuralı hep o fonksiyonun içinde. Burada ikinci
   * bir mantık kurmak, iki ayrı gerçeklik demek olurdu.
   */
  const uzat = async (olay: React.FormEvent) => {
    olay.preventDefault()
    if(islemde || !detay) return
    setIslemde(true)
    setHata('')
    try {
      await lisansiUzat(getSupabase(), detay.kiraciId, {
        ay: Number(uzatmaAy) || 1,
        not: uzatmaNotu,
        ucretli: uzatmaUcretli
      })
      setBilgi(`${detay.firmaAdi || detay.kiraciAdi} lisansı ${uzatmaAy} ay `
        + `${uzatmaUcretli ? 'ÜCRETLİ' : 'ücretsiz'} uzatıldı.`)
      setUzatmaAcik(false)
      setUzatmaNotu('')
      setUzatmaUcretli(false)
      setUzatmaAy('1')
      setTazeleme(n => n + 1)
    } catch(e){
      setHata(e instanceof Error ? e.message : 'Lisans uzatılamadı.')
    } finally {
      setIslemde(false)
    }
  }

  // Saat dağılımının en yoğun üç dilimi — "en çok hangi saatlerde" (4.2)
  const enYogunSaatler = [...saatler]
    .sort((a, b) => b.islemSayisi - a.islemSayisi)
    .slice(0, 3)
  const enYuksek = saatler.reduce((u, s) => Math.max(u, s.islemSayisi), 0)
  const toplamIslem = saatler.reduce((t, s) => t + s.islemSayisi, 0)

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>{detay ? bosDegilse(detay.firmaAdi || detay.kiraciAdi) : 'Müşteri Detayı'}</h2>
          <p className="muted">
            {detay ? `${detay.kiraciKodu} · EVREN360 müşteri kartı` : 'Yükleniyor…'}
          </p>
        </div>
        <button className="btn" type="button" onClick={onBack}>Listeye dön</button>
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-success">{bilgi}</div>}
      {yukleniyor && <p className="muted">Yükleniyor…</p>}

      {detay && (
        <>
          {/* ── 1 · ŞİRKET BİLGİLERİ ───────────────────────────────── */}
          <section className="card">
            <div className="section-header compact">
              <h3>1 · Şirket Bilgileri</h3>
              <span className={`status-pill ${detay.kiraciDurumu === 'Aktif' ? 'success' : 'warning-pill'}`}>
                {detay.kiraciDurumu}
              </span>
            </div>
            <div className="musteri-grid">
              <Alan etiket="1.1 · Ad" deger={bosDegilse(detay.firmaAdi)} />
              <Alan
                etiket="1.1 · Tam ticari unvan"
                deger={bosDegilse(detay.ticariUnvan)}
                not={detay.ticariUnvan ? undefined : 'Başvuru formunda sorulmuyor. ⚠️ İşletmenin Firma Profili ekranı da bu alanı veritabanına YAZMIYOR (localStorage).'}
              />
              <Alan etiket="1.2 · Sektör" deger={sektorAdi(detay.sektor)} />
              <Alan etiket="1.3 · İl / ilçe"
                    deger={detay.il || detay.ilce ? `${detay.il}${detay.ilce ? ` / ${detay.ilce}` : ''}` : BOS} />
              <Alan etiket="1.3 · Adres" deger={bosDegilse(detay.adres)} />
              <Alan etiket="1.4 · Telefon" deger={bosDegilse(detay.telefon)} />
              <Alan etiket="1.4 · E-posta" deger={bosDegilse(detay.eposta)} />
              <Alan
                etiket="1.4 · Web sitesi"
                deger={bosDegilse(detay.webSitesi)}
                not={detay.webSitesi ? undefined : 'Hiçbir ekranda sorulmuyor; doldurulacak yolu yok.'}
              />
              <Alan etiket="Vergi dairesi / no"
                    deger={detay.vergiDairesi || detay.vergiNo
                      ? `${bosDegilse(detay.vergiDairesi)} · ${bosDegilse(detay.vergiNo)}`
                      : BOS} />
              <Alan
                etiket="1.5 · Çalışan sayısı"
                deger={detay.beyanCalisanSayisi ?? BOS}
                not="Başvuruda işletmenin kendi beyanı."
              />
              <Alan
                etiket="1.5 · Şube sayısı"
                deger={
                  <>
                    {detay.kayitliSubeSayisi} <span className="muted small-text">sistemde kayıtlı</span>
                    {detay.beyanSubeSayisi !== null && (
                      <div className="muted small-text">
                        Başvuruda beyan: {detay.beyanSubeSayisi}
                      </div>
                    )}
                  </>
                }
              />
            </div>
            {/* 1.6 bilerek yok — dosya başlığındaki gerekçeye bakınız. */}
          </section>

          {/* ── 2 · ÜYELİK VE LİSANS ───────────────────────────────── */}
          <section className="card">
            <div className="section-header compact">
              <h3>2 · Üyelik ve Lisans</h3>
              {detay.lisansDurumu && (
                <span className={`status-pill ${
                  detay.kalanGun !== null && detay.kalanGun < 0 ? 'danger-pill'
                  : detay.denemeMi ? 'warning-pill' : 'success'}`}>
                  {detay.lisansDurumu}
                </span>
              )}
            </div>
            <div className="musteri-grid">
              <Alan etiket="2.1 · Kayıt tarihi" deger={kisaTarih(detay.kayitTarihi)} />
              <Alan
                etiket="2.2 · Üyelik durumu"
                deger={`${detay.uyelikDurumu}${detay.lisansDurumu ? ` · lisans: ${detay.lisansDurumu}` : ''}`}
                not={detay.denemeMi ? 'Deneme sürümü kullanıyor.' : undefined}
              />
              <Alan etiket="2.3 · Lisans başlangıç" deger={kisaTarih(detay.lisansBaslangic)} />
              <Alan
                etiket="2.3 · Lisans bitiş"
                deger={kisaTarih(detay.lisansBitis)}
                not={detay.kalanGun !== null ? gunFarkiMetni(detay.kalanGun) : undefined}
              />
              <HenuzYok
                etiket="2.4 · Taahhüt"
                gerekce="Taahhüt süresi ve bitişi için veritabanında alan yok. Bir sonraki adımda açılacak."
              />
              <Alan etiket="2.5 · Paket" deger={bosDegilse(detay.paketAdi)} />
            </div>

            <div className="musteri-alan">
              <span className="muted small-text">
                2.5 · Açık modüller
                <span className="muted"> — paketin bu işletmeye açtığı bölümler</span>
              </span>
              {detay.moduller.length === 0
                ? <div className="muted">{BOS}</div>
                : (
                  <div className="musteri-rozet-dizisi">
                    {detay.moduller.map(modul => (
                      <span key={modul} className="status-pill info-pill" title={modul}>
                        {modulAdi(modul)}
                      </span>
                    ))}
                  </div>
                )}
            </div>

            {detay.lisansNotu && (
              <p className="muted small-text">Lisans notu: {detay.lisansNotu}</p>
            )}

            {detay.lisansDurumu ? (
              uzatmaAcik ? (
                <form className="musteri-uzatma" onSubmit={olay => void uzat(olay)}>
                  <label>
                    <span className="muted small-text">Kaç ay</span>
                    <select value={uzatmaAy} onChange={o => setUzatmaAy(o.target.value)}>
                      {['1', '3', '6', '12'].map(ay => (
                        <option key={ay} value={ay}>{ay} ay</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="muted small-text">Not (deftere yazılır)</span>
                    <input
                      value={uzatmaNotu}
                      onChange={o => setUzatmaNotu(o.target.value)}
                      placeholder="Neden uzatıldı?"
                    />
                  </label>
                  <label className="musteri-uzatma-kutu">
                    <input
                      type="checkbox"
                      checked={uzatmaUcretli}
                      onChange={o => setUzatmaUcretli(o.target.checked)}
                    />
                    <span>Ücretli uzatma</span>
                  </label>
                  <div className="musteri-uzatma-dugmeler">
                    <button className="btn primary" type="submit" disabled={islemde}>
                      {islemde ? 'Uzatılıyor…' : 'Uzat'}
                    </button>
                    <button className="btn" type="button" disabled={islemde}
                            onClick={() => setUzatmaAcik(false)}>
                      Vazgeç
                    </button>
                  </div>
                </form>
              ) : (
                <button className="btn primary" type="button"
                        onClick={() => { setBilgi(''); setUzatmaAcik(true) }}>
                  Lisansı uzat
                </button>
              )
            ) : (
              <p className="muted small-text">
                Bu işletmenin lisansı yok; uzatılacak bir şey bulunmuyor.
              </p>
            )}
          </section>

          {/* ── 3 · YETKİLİ VE KULLANICI ───────────────────────────── */}
          <section className="card">
            <div className="section-header compact">
              <h3>3 · Yetkili ve Kullanıcı</h3>
              <span className="status-pill info-pill">
                {detay.aktifKullanici} aktif / {detay.kullaniciSayisi} kayıtlı
              </span>
            </div>
            <div className="musteri-grid">
              <Alan etiket="3.1 · Yetkili" deger={bosDegilse(detay.yetkiliAd)} />
              <Alan etiket="3.1 · Unvanı" deger={bosDegilse(detay.yetkiliUnvan)} />
              <Alan etiket="3.1 · Telefon" deger={bosDegilse(detay.yetkiliTelefon)} />
              <Alan etiket="3.1 · E-posta" deger={bosDegilse(detay.yetkiliEposta)} />
              <Alan etiket="3.2 · Kayıtlı kullanıcı" deger={detay.kullaniciSayisi} />
              <Alan
                etiket="3.3 · Son giriş"
                deger={zamanAraligi(detay.sonGiris)}
                not={detay.sonGiris ? tarihSaat(detay.sonGiris) : 'Hiçbir kullanıcı henüz giriş yapmamış.'}
              />
            </div>

            {kullanicilar.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ad soyad</th><th>Kullanıcı adı</th><th>Rol</th>
                      <th>Durum</th><th>Son giriş</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kullanicilar.map(k => (
                      <tr key={k.kullaniciId}>
                        <td>{bosDegilse(k.adSoyad)}</td>
                        <td className="muted">{bosDegilse(k.kullaniciAdi)}</td>
                        <td>{ROL_ADLARI[k.rolKodu] ?? k.rolKodu}</td>
                        <td>
                          <span className={`status-pill ${k.aktif ? 'success' : 'muted-pill'}`}>
                            {k.aktif ? 'Aktif' : 'Kapalı'}
                          </span>
                        </td>
                        <td>
                          {zamanAraligi(k.sonGiris)}
                          {!k.sonGiris && (
                            <div className="muted small-text">hiç giriş yapmadı</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── 4 · KULLANIM ───────────────────────────────────────── */}
          <section className="card">
            <div className="section-header compact">
              <h3>4 · Kullanım</h3>
            </div>
            <div className="musteri-grid">
              <Alan
                etiket="4.1 · Aktif kullanıyor mu"
                deger={
                  detay.son30GunIslem > 0
                    ? <span className="status-pill success">Evet · son 30 günde {detay.son30GunIslem} işlem</span>
                    : <span className="status-pill warning-pill">Son 30 günde hiç işlem yok</span>
                }
                not={detay.sonHareket ? `Son hareket: ${tarihSaat(detay.sonHareket)}` : 'Hiç hareket kaydı yok.'}
              />
              <Alan
                etiket="4.2 · En çok hangi saatlerde"
                deger={
                  enYogunSaatler.length === 0
                    ? BOS
                    : enYogunSaatler
                        .map(s => `${String(s.saat).padStart(2, '0')}:00`)
                        .join(' · ')
                }
                not={
                  toplamIslem > 0
                    ? `Son ${SAAT_PENCERESI} gün içinde ${toplamIslem} işleme göre, Türkiye saatiyle.`
                    : 'Saat dağılımı için yeterli hareket yok.'
                }
              />
            </div>

            {saatler.length > 0 && (
              <figure className="musteri-saat-grafigi">
                <figcaption className="muted small-text">
                  Saat başına işlem yoğunluğu · son {SAAT_PENCERESI} gün · Türkiye saati
                </figcaption>
                <div className="musteri-saat-sira" role="img"
                     aria-label={`Saatlik yoğunluk: en yoğun ${enYogunSaatler
                       .map(s => `${String(s.saat).padStart(2, '0')}:00 (${s.islemSayisi} işlem)`)
                       .join(', ')}`}>
                  {Array.from({ length: 24 }, (_, saat) => {
                    const adet = saatler.find(s => s.saat === saat)?.islemSayisi ?? 0
                    const oran = enYuksek > 0 ? (adet / enYuksek) * 100 : 0
                    return (
                      <div
                        className="musteri-saat-sutun"
                        key={saat}
                        title={`${String(saat).padStart(2, '0')}:00 · ${adet} işlem`}
                      >
                        <div className="musteri-saat-yol">
                          <div
                            className="musteri-saat-dolgu"
                            style={{ height: `${oran}%` }}
                            data-bos={adet === 0 ? 'true' : undefined}
                          />
                        </div>
                        {/* Her saati yazmak dar ekranda üst üste biner;
                            dörtte bir aralıklarla yazılıyor. */}
                        <span className="musteri-saat-etiket muted small-text">
                          {saat % 6 === 0 ? String(saat).padStart(2, '0') : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </figure>
            )}

          </section>

          {/* ── 5 · ÖDEME VE YÖNETİM ───────────────────────────────── */}
          <section className="card">
            <div className="section-header compact">
              <h3>5 · Ödeme ve Yönetim</h3>
            </div>
            <div className="musteri-grid">
              <Alan
                etiket="5.1 · Aylık ücret"
                deger={paraVeyaBelirsiz(detay.aylikUcret, detay.fiyatBelirlendi)}
                not={detay.fiyatBelirlendi ? undefined : 'Paket fiyatı henüz kararlaştırılmadı.'}
              />
              <Alan
                etiket="5.1 · Yıllık ücret"
                deger={paraVeyaBelirsiz(detay.yillikUcret, detay.fiyatBelirlendi)}
              />
              <HenuzYok
                etiket="5.2 · Sonraki ödeme tarihi"
                gerekce="Ödeme planı tablosu henüz yok."
              />
              <HenuzYok
                etiket="5.3 · Ödenmemiş borç"
                gerekce="Fatura ve tahsilat tablosu henüz yok."
              />
              <HenuzYok
                etiket="5.4 · Özel yönetici notları"
                gerekce="Şirkete özel not alanı henüz yok."
              />
            </div>
            <p className="muted small-text">
              Bu dört alan boş görünüyor çünkü veritabanında karşılığı yok.
              Uydurma bir sayı göstermektense boş bırakıldı.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
