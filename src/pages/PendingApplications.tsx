// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4D / KAPI — Onay Bekleyen İşletmeler
//
// Demonun 1. perdesinin ikinci yarısı. Müşteri başvurusunu gönderdi; bu
// ekran MİYOP'un ona baktığı yer.
//
// ── ÖNCEKİ HÂLİNİN ÜÇ SORUNU ─────────────────────────────────────────────
// 1. TARAYICI HAFIZASINI okuyordu (`storage.ts`). Başvuru veritabanına
//    yazılıyordu ama bu ekran oraya bakmıyordu: müşteri başvurdu, liste boş
//    kaldı. Aynı sebepten bildirim zili ve arama da göremiyordu.
// 2. `window.prompt` ile onay notu istiyordu. Tarayıcı diyaloğu sayfayı
//    kilitler, ne karar verdiğini göstermez, gerekçe kuralını uygulatamaz.
//    Yerine `KararPenceresi` geldi.
// 3. ONAY BİR YALANDI. Tarayıcıda firma/kullanıcı/geçici şifre üretip
//    "İlk Giriş Bilgileri" kartı basıyordu; o şifreyle giriş denenince
//    "Geçersiz e-posta veya şifre" alınıyordu. Kart kaldırıldı.
//
// ── ŞİMDİ NE YAPIYOR, NE YAPMIYOR ───────────────────────────────────────
// YAPIYOR : gerçek defteri okur; incelemeye alır, onaylar, reddeder, iptal
//           eder. Onay kiracı + firma + merkez şube açar (0035).
// YAPMIYOR: GİRİŞ HESABI. Ekran bunu saklamıyor, yazıyor.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import KararPenceresi from '../components/KararPenceresi'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { resolveStockRepositoryMode } from '../core/stock/index'
import {
  PostgresBasvuruDefteri,
  type Basvuru,
  type BasvuruDurumu,
  type BasvuruOlayi,
  type OnaySonucu,
} from '../onboarding/application.repository'
import {
  GEREKCE_EN_AZ, basvuruOzeti, beklemeGunu, durumEtiketi, gecisGecerliMi,
  vergiBilgisiEksik,
} from '../onboarding/application.service'

type Props = {
  currentUser: User
  initialApplicationId?: string
}

/** Kuyrukta görünen durumlar: karar bekleyenler. */
const ACIK_DURUMLAR: BasvuruDurumu[] = ['PENDING', 'IN_REVIEW']

type DurumSuzgeci = 'acik' | 'hepsi' | BasvuruDurumu

const sayi = (n: number) => n.toLocaleString('tr-TR')

const tarihSaat = (ham: string) => {
  const t = new Date(ham)
  if(Number.isNaN(t.getTime())) return '-'
  return `${t.toLocaleDateString('tr-TR')} ${t.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
}

const gunKey = (ham: string) => {
  const t = new Date(ham)
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('sv-SE')
}

const haftaBasi = () => {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const gun = t.getDay() || 7
  t.setDate(t.getDate() - gun + 1)
  return t
}

/** Türkçe duyarlı, işaretsiz arama anahtarı. */
const aramaAnahtari = (deger: string) => deger
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, '')

/**
 * Vergi bilgisi başvuruda isteğe bağlı (0038). Eksikliği GİZLEMİYORUZ:
 * boş bir kutu "yok mu, yüklenmedi mi" belirsizliği bırakır.
 */
const vergiMetni = (b: Basvuru): string => {
  const daire = (b.vergiDairesi ?? '').trim()
  const no = (b.vergiNo ?? '').trim()
  if(!daire && !no) return 'Henüz alınmadı — ön görüşmede sorun'
  if(daire && no) return `${daire} / ${no}`
  return daire || no
}

/** Eski başvurularda bu soru hiç sorulmadı; "0" yazmak uydurmak olurdu. */
const sayiMetni = (deger?: number): string =>
  typeof deger === 'number' ? String(deger) : 'Sorulmamış'

const durumSinifi = (durum: BasvuruDurumu) => {
  if(durum === 'APPROVED') return 'success'
  if(durum === 'REJECTED' || durum === 'CANCELLED') return 'danger'
  if(durum === 'IN_REVIEW') return 'info'
  return 'warning'
}

/** Açık başvuruların ortalama bekleme süresi. */
const ortalamaBekleme = (liste: Basvuru[]) => {
  const acik = liste.filter(b => ACIK_DURUMLAR.includes(b.durum))
  if(acik.length === 0) return '–'
  const saatler = acik.map(b => {
    const bas = new Date(b.olusturmaZamani).getTime()
    return Math.max(0, (Date.now() - bas) / 3_600_000)
  })
  const ort = saatler.reduce((a, b) => a + b, 0) / saatler.length
  if(ort < 1) return 'bir saatten az'
  if(ort < 48) return `${Math.round(ort)} saat`
  return `${Math.round(ort / 24)} gün`
}

type KararTuru = 'onay' | 'ret' | 'iptal'

const KARAR_METNI: Record<KararTuru, {
  baslik: string; aciklama: string; notEtiketi: string
  notIpucu: string; eylem: string; tur: 'olumlu' | 'tehlikeli'
  hedef: BasvuruDurumu
}> = {
  onay: {
    baslik: 'Başvuruyu onayla',
    aciklama: 'Onay işletmeyi açar: kiracı, firma ve merkez şube oluşturulur. Geri alınamaz.',
    notEtiketi: 'Onay gerekçesi',
    notIpucu: 'Örnek: belgeler tam, ilk ödemeyi 6. ay yapacak şekilde onaylandı.',
    eylem: 'Onayla ve işletmeyi aç',
    tur: 'olumlu',
    hedef: 'APPROVED',
  },
  ret: {
    baslik: 'Başvuruyu reddet',
    aciklama: 'Ret kalıcı kayda geçer. Müşteri eksiğini tamamlayıp yeniden başvurabilir.',
    notEtiketi: 'Ret gerekçesi',
    notIpucu: 'Örnek: vergi numarası doğrulanamadı.',
    eylem: 'Reddet',
    tur: 'tehlikeli',
    hedef: 'REJECTED',
  },
  iptal: {
    baslik: 'Başvuruyu iptal et',
    aciklama: 'İptal, başvurandan gelen vazgeçme ya da mükerrer kayıt için kullanılır.',
    notEtiketi: 'İptal gerekçesi',
    notIpucu: 'Örnek: başvuran telefonla vazgeçtiğini bildirdi.',
    eylem: 'İptal et',
    tur: 'tehlikeli',
    hedef: 'CANCELLED',
  },
}

export default function PendingApplications({ currentUser, initialApplicationId }: Props){
  const gercekVeritabani = resolveStockRepositoryMode() === 'postgres' && isSupabaseConfigured()
  const yetkili = !currentUser.permissions
    || currentUser.permissions.includes('platform.manage')

  const defter = React.useMemo(
    () => (gercekVeritabani ? new PostgresBasvuruDefteri(getSupabase()) : null),
    [gercekVeritabani],
  )

  const [liste, setListe] = React.useState<Basvuru[]>([])
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [mesaj, setMesaj] = React.useState('')
  const [arama, setArama] = React.useState('')
  const [durumSuzgeci, setDurumSuzgeci] = React.useState<DurumSuzgeci>('acik')
  const [tarihSuzgeci, setTarihSuzgeci] = React.useState('')
  const [secilenId, setSecilenId] = React.useState(initialApplicationId ?? '')
  const [olaylar, setOlaylar] = React.useState<BasvuruOlayi[]>([])
  const [karar, setKarar] = React.useState<{ tur: KararTuru; basvuru: Basvuru } | null>(null)
  const [onaySonucu, setOnaySonucu] =
    React.useState<
      (OnaySonucu & { firmaAdi: string; subeSayisi?: number; vergiEksik?: boolean }) | null
    >(null)

  const tazele = React.useCallback(async () => {
    if(!defter) { setYukleniyor(false); return }
    setYukleniyor(true)
    try {
      setListe(await defter.liste())
      setHata('')
    } catch(e){
      setHata(e instanceof Error ? e.message : 'Başvurular okunamadı.')
    } finally {
      setYukleniyor(false)
    }
  }, [defter])

  React.useEffect(() => { void tazele() }, [tazele])

  // Seçilen başvurunun geçmişi. Defter değişmeden okunmaz.
  React.useEffect(() => {
    if(!defter || !secilenId){ setOlaylar([]); return }
    let iptal = false
    void (async () => {
      try {
        const o = await defter.olaylar(secilenId)
        if(!iptal) setOlaylar(o)
      } catch { if(!iptal) setOlaylar([]) }
    })()
    return () => { iptal = true }
  }, [defter, secilenId])

  const gorunen = React.useMemo(() => {
    const anahtar = aramaAnahtari(arama)
    return liste.filter(b => {
      if(durumSuzgeci === 'acik' && !ACIK_DURUMLAR.includes(b.durum)) return false
      if(durumSuzgeci !== 'acik' && durumSuzgeci !== 'hepsi' && b.durum !== durumSuzgeci) return false
      if(tarihSuzgeci && gunKey(b.olusturmaZamani) !== tarihSuzgeci) return false
      if(anahtar){
        // ⚠️ BAŞVURU NUMARASI da aranıyor. Müşteri telefonda onu söylüyor;
        // aranamıyorsa numara vermenin anlamı kalmaz.
        const alan = aramaAnahtari(
          `${b.referans} ${b.firmaAdi} ${b.yetkiliAdi} ${b.eposta} ${b.telefon}`,
        )
        if(!alan.includes(anahtar)) return false
      }
      return true
    })
  }, [liste, arama, durumSuzgeci, tarihSuzgeci])

  const ozet = React.useMemo(() => basvuruOzeti(liste), [liste])
  const bugun = React.useMemo(() => {
    const k = new Date().toLocaleDateString('sv-SE')
    return liste.filter(b => gunKey(b.olusturmaZamani) === k).length
  }, [liste])
  const buHafta = React.useMemo(() => {
    const bas = haftaBasi().getTime()
    return liste.filter(b => new Date(b.olusturmaZamani).getTime() >= bas).length
  }, [liste])

  const secilen = gorunen.find(b => b.id === secilenId)
    ?? liste.find(b => b.id === secilenId)
    ?? null

  const kabuk = (icerik: React.ReactNode) => (
    <div className="pending-applications-page">
      <div className="evren360-hero">
        <div>
          <span>EVREN360</span>
          <h2>Onay Bekleyen İşletmeler</h2>
          <p>Başvuruları inceleyin, onaylayın ya da reddedin. Her karar gerekçesiyle kalıcı kayda geçer.</p>
        </div>
        <div className="evren360-hero-meta">
          <strong>{sayi(gorunen.length)} kayıt</strong>
          <span>Operasyon kuyruğu</span>
        </div>
      </div>
      {icerik}
    </div>
  )

  if(!gercekVeritabani){
    return kabuk(
      <section className="card empty-state">
        <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
        <p>
          Başvurular tarayıcı hafızasında tutulmaz; bu kurulumda okunacak bir
          defter yok.
        </p>
      </section>,
    )
  }

  if(!yetkili){
    return kabuk(
      <section className="card empty-state">
        <p><strong>Bu ekran platform yetkisi ister.</strong></p>
        <p>Başvuruları yalnızca MİYOP personeli görebilir.</p>
      </section>,
    )
  }

  const incelemeyeAl = async (basvuru: Basvuru) => {
    if(!defter) return
    setMesaj(''); setHata('')
    try {
      // İncelemeye almak bir KARAR değil; gerekçe istemiyor (0032).
      await defter.karar(basvuru.id, { durum: 'IN_REVIEW', gerekce: 'incelemeye alındı' })
      setMesaj(`${basvuru.firmaAdi} incelemeye alındı.`)
      setSecilenId(basvuru.id)
      await tazele()
    } catch(e){
      setHata(e instanceof Error ? e.message : 'İşlem tamamlanamadı.')
    }
  }

  const kararVer = async (not: string) => {
    if(!defter || !karar) return
    const { tur, basvuru } = karar
    if(tur === 'onay'){
      const sonuc = await defter.onayla(basvuru.id, not)
      setOnaySonucu({
        ...sonuc,
        firmaAdi: basvuru.firmaAdi,
        subeSayisi: basvuru.subeSayisi,
        vergiEksik: vergiBilgisiEksik(basvuru),
      })
      setMesaj('')
    } else {
      await defter.karar(basvuru.id, { durum: KARAR_METNI[tur].hedef, gerekce: not })
      setOnaySonucu(null)
      setMesaj(`${basvuru.firmaAdi} · ${durumEtiketi(KARAR_METNI[tur].hedef)}.`)
    }
    setKarar(null)
    setSecilenId(basvuru.id)
    await tazele()
  }

  return kabuk(
    <>
      {mesaj && <div className="evren360-feedback">{mesaj}</div>}
      {hata && <div className="evren360-feedback error">{hata}</div>}

      {onaySonucu && (
        <section className="card" role="status">
          <div className="section-header compact">
            <div>
              <h3>İşletme açıldı</h3>
              <p className="muted">{onaySonucu.firmaAdi}</p>
            </div>
            <button className="btn" type="button" onClick={() => setOnaySonucu(null)}>Kapat</button>
          </div>
          <div className="karar-ozet">
            <div className="karar-ozet-satir">
              <span>İşletme kodu</span><strong>{onaySonucu.kiraciKodu}</strong>
            </div>
            <div className="karar-ozet-satir">
              <span>Oluşturulanlar</span><strong>Kiracı · Firma · Merkez şube</strong>
            </div>
          </div>
          {/* ⚠️ Onay TEK şube açar. Başvuruda daha fazlası bildirildiyse
              bunu söylemek zorundayız; yoksa "kurulum tamam" sanılır ve
              eksik kurulmuş bir işletme müşteriye teslim edilir. */}
          {/* Fatura kesilmeden önce mutlaka tamamlanmalı. Onay anında
              söylemek, fatura gününde fark etmekten iyidir. */}
          {onaySonucu.vergiEksik && (
            <p className="muted">
              <strong>Vergi bilgisi eksik.</strong> Bu işletme başvuruda vergi dairesi /
              numarası vermedi. Fatura kesilmeden önce Firma Profili ekranından girilmeli.
            </p>
          )}
          {typeof onaySonucu.subeSayisi === 'number' && onaySonucu.subeSayisi > 1 && (
            <p className="muted">
              <strong>Bu işletme {onaySonucu.subeSayisi} şube bildirdi.</strong> Şu an yalnızca
              merkez şube açıldı — diğer {onaySonucu.subeSayisi - 1} şubeyi Şube Yönetimi'nden
              siz eklemelisiniz.
            </p>
          )}
          {/* ⚠️ Bu uyarı kaldırılmayacak. Eskiden burada geçici şifreli bir
              "İlk Giriş Bilgileri" kartı vardı ve o şifre ÇALIŞMIYORDU. */}
          <p className="muted">
            <strong>Giriş hesabı henüz açılmadı.</strong> Kullanıcı hesabı
            Supabase Auth tarafında oluşturulur; o adım (davet e-postası ve
            ilk şifre) henüz bağlanmadı. Müşteri şu an giriş yapamaz.
          </p>
        </section>
      )}

      <div className="evren360-kpi-grid">
        <div className="evren360-kpi warning">
          <span>İlgi Bekleyen</span>
          <strong>{sayi(ozet.ilgiBekleyen)}</strong>
          <p>Beklemede veya inceleniyor.</p>
        </div>
        <div className="evren360-kpi">
          <span>Bugün Gelen</span>
          <strong>{sayi(bugun)}</strong>
          <p>Bugün oluşturulan kayıtlar.</p>
        </div>
        <div className="evren360-kpi success">
          <span>Bu Hafta Gelen</span>
          <strong>{sayi(buHafta)}</strong>
          <p>Pazartesi başlangıçlı hafta.</p>
        </div>
        <div className="evren360-kpi">
          <span>Ortalama Bekleme</span>
          <strong>{ortalamaBekleme(liste)}</strong>
          <p>Açık başvurular üzerinden.</p>
        </div>
      </div>

      <section className="evren360-panel">
        <div className="section-header">
          <div>
            <h3>Başvuru Listesi</h3>
            <p className="muted">Toplam {sayi(liste.length)} başvuru · {sayi(ozet.onaylanan)} onaylı</p>
          </div>
          <button className="btn" type="button" onClick={() => void tazele()} disabled={yukleniyor}>
            {yukleniyor ? 'Yükleniyor…' : 'Yenile'}
          </button>
        </div>

        <div className="pending-applications-controls">
          <label>
            <span>Arama</span>
            <input
              value={arama}
              onChange={e => setArama(e.target.value)}
              placeholder="Numara, firma, yetkili, e-posta veya telefon"
            />
          </label>
          <label>
            <span>Başvuru Durumu</span>
            <select value={durumSuzgeci} onChange={e => setDurumSuzgeci(e.target.value as DurumSuzgeci)}>
              <option value="acik">Karar bekleyenler</option>
              <option value="hepsi">Tümü</option>
              <option value="PENDING">{durumEtiketi('PENDING')}</option>
              <option value="IN_REVIEW">{durumEtiketi('IN_REVIEW')}</option>
              <option value="APPROVED">{durumEtiketi('APPROVED')}</option>
              <option value="REJECTED">{durumEtiketi('REJECTED')}</option>
              <option value="CANCELLED">{durumEtiketi('CANCELLED')}</option>
            </select>
          </label>
          <label>
            <span>Başvuru Tarihi</span>
            <input type="date" value={tarihSuzgeci} onChange={e => setTarihSuzgeci(e.target.value)} />
          </label>
        </div>

        <div className="table-scroll">
          <table className="data-table pending-applications-table">
            <thead>
              <tr>
                <th>Numara</th>
                <th>Firma Adı</th>
                <th>Yetkili</th>
                <th>E-posta</th>
                <th>Başvuru Tarihi</th>
                <th>Bekleme</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {gorunen.map(b => (
                <tr key={b.id} className={secilenId === b.id ? 'selected-row' : ''}>
                  <td><strong>{b.referans}</strong></td>
                  <td>
                    <strong>{b.firmaAdi}</strong>
                    <span className="muted small-text">{b.il} / {b.ilce}</span>
                    {/* Vergi bilgisi başvuruda isteğe bağlı (0038). Eksikse
                        listede de görünsün — Emrah'ın bunu onaydan önce,
                        tek bakışta bilmesi gerekiyor. */}
                    {vergiBilgisiEksik(b) && (
                      <span className="muted small-text">· vergi bilgisi alınmadı</span>
                    )}
                  </td>
                  <td>{b.yetkiliAdi}</td>
                  <td>{b.eposta}</td>
                  <td>{tarihSaat(b.olusturmaZamani)}</td>
                  <td>{ACIK_DURUMLAR.includes(b.durum) ? `${beklemeGunu(b)} gün` : '–'}</td>
                  <td><span className={`status-pill ${durumSinifi(b.durum)}`}>{durumEtiketi(b.durum)}</span></td>
                  <td className="actions-cell">
                    <button className="btn" type="button" onClick={() => setSecilenId(b.id)}>İncele</button>
                    {/* ⚠️ Düğmeler geçiş tablosuna göre açılıyor. Yapılamayacak
                        bir işi sunan düğme, kullanıcıyı hataya gönderir.
                        AMA düğmeyi tamamen GİZLEMEK de yanlış: Emrah haklı
                        olarak "Onayla düğmesi nerede?" diye sordu. Bekleyen
                        bir başvuruda onay yok, çünkü önce incelenmesi
                        gerekiyor — ekran bunu söylemiyordu. Artık düğme
                        duruyor, pasif ve sebebini yazıyor. */}
                    {gecisGecerliMi(b.durum, 'IN_REVIEW') && (
                      <button className="btn" type="button" onClick={() => void incelemeyeAl(b)}>
                        İncelemeye Al
                      </button>
                    )}
                    {gecisGecerliMi(b.durum, 'APPROVED') ? (
                      <button className="btn primary" type="button" onClick={() => setKarar({ tur: 'onay', basvuru: b })}>
                        Onayla
                      </button>
                    ) : b.durum === 'PENDING' ? (
                      <button
                        className="btn"
                        type="button"
                        disabled
                        title="Onay, incelemeye alınmış başvurular için açılır. Önce “İncelemeye Al” deyin."
                      >
                        Onayla
                      </button>
                    ) : null}
                    {gecisGecerliMi(b.durum, 'REJECTED') && (
                      <button className="btn" type="button" onClick={() => setKarar({ tur: 'ret', basvuru: b })}>
                        Reddet
                      </button>
                    )}
                    {gecisGecerliMi(b.durum, 'CANCELLED') && (
                      <button className="btn" type="button" onClick={() => setKarar({ tur: 'iptal', basvuru: b })}>
                        İptal
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {gorunen.length === 0 && (
                <tr>
                  <td className="empty-cell" colSpan={8}>
                    {yukleniyor ? 'Yükleniyor…' : 'Bu süzgeçle başvuru bulunamadı.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Akış tek cümleyle yazılı duruyor. Sıra bilinmeden bakan biri
              "Onayla nerede?" diye sorar — bir kez soruldu. */}
          <p className="muted small-text">
            Sıra: <strong>İncele</strong> → <strong>İncelemeye Al</strong> → <strong>Onayla</strong>{' '}
            ya da <strong>Reddet</strong>. Onay yalnızca incelemeye alınmış başvurularda
            açılır; böylece hiçbir işletme okunmadan açılmaz. Her karar gerekçesiyle
            birlikte kalıcı kayda geçer.
          </p>
        </div>
      </section>

      {secilen && (
        <section className="evren360-panel pending-applications-detail">
          <div className="evren360-panel-header">
            <div>
              <h3>{secilen.firmaAdi}</h3>
              <p>{secilen.referans} · {secilen.sektorKodu}</p>
            </div>
            <span className={`status-pill ${durumSinifi(secilen.durum)}`}>{durumEtiketi(secilen.durum)}</span>
          </div>

          <div className="pending-applications-detail-grid">
            <div><span>Yetkili</span><strong>{secilen.yetkiliAdi}</strong></div>
            <div><span>E-posta</span><strong>{secilen.eposta}</strong></div>
            <div><span>Telefon</span><strong>{secilen.telefon}</strong></div>
            {/* 0038: vergi bilgisi başvuruda zorunlu değil. Eksikse ekran
                bunu AÇIKÇA söyler — boş bir kutu "bilinmiyor" demez. */}
            <div>
              <span>Vergi Bilgisi</span>
              <strong>{vergiMetni(secilen)}</strong>
            </div>
            {/* Şube sayısı kurulum kararıdır: onayda yalnız merkez açılıyor. */}
            <div><span>Şube Sayısı</span><strong>{sayiMetni(secilen.subeSayisi)}</strong></div>
            <div><span>Personel Sayısı</span><strong>{sayiMetni(secilen.personelSayisi)}</strong></div>
            <div><span>Adres</span><strong>{secilen.adres}, {secilen.il} / {secilen.ilce}</strong></div>
            {secilen.not && <div><span>Başvuru notu</span><strong>{secilen.not}</strong></div>}
            {secilen.kararNotu && <div><span>Karar gerekçesi</span><strong>{secilen.kararNotu}</strong></div>}
          </div>

          <div className="section-header compact">
            <div>
              <h3>Geçmiş</h3>
              <p className="muted">
                Kaydı veritabanı tutuyor, ekran değil — hiçbir adım atlanamaz.
              </p>
            </div>
          </div>
          <div className="business-application-history pending-applications-history">
            {olaylar.length === 0 && <p className="muted">Geçmiş okunamadı.</p>}
            {olaylar.map(o => (
              <div key={o.id}>
                <span>{tarihSaat(o.zaman)}</span>
                <strong>
                  {o.oncekiDurum
                    ? `${durumEtiketi(o.oncekiDurum)} → ${durumEtiketi(o.yeniDurum)}`
                    : durumEtiketi(o.yeniDurum)}
                  {o.aktorAd ? ` · ${o.aktorAd}` : ''}
                  {o.not ? ` · ${o.not}` : ''}
                </strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {karar && (
        <KararPenceresi
          baslik={KARAR_METNI[karar.tur].baslik}
          aciklama={KARAR_METNI[karar.tur].aciklama}
          ozet={
            <>
              <div className="karar-ozet-satir">
                <span>Başvuru</span><strong>{karar.basvuru.referans}</strong>
              </div>
              <div className="karar-ozet-satir">
                <span>Firma</span><strong>{karar.basvuru.firmaAdi}</strong>
              </div>
              <div className="karar-ozet-satir">
                <span>Yetkili</span><strong>{karar.basvuru.yetkiliAdi}</strong>
              </div>
              <div className="karar-ozet-satir">
                <span>E-posta</span><strong>{karar.basvuru.eposta}</strong>
              </div>
            </>
          }
          notEtiketi={KARAR_METNI[karar.tur].notEtiketi}
          notIpucu={KARAR_METNI[karar.tur].notIpucu}
          enAzKarakter={GEREKCE_EN_AZ}
          eylemEtiketi={KARAR_METNI[karar.tur].eylem}
          tur={KARAR_METNI[karar.tur].tur}
          onIptal={() => setKarar(null)}
          onOnayla={kararVer}
        />
      )}
    </>
  )
}
