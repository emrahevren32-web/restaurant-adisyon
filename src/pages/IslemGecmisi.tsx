// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 / Güven katmanı — İşlem Geçmişi
//
// Yol haritası maddesi: "İşlem geçmişi / denetim kaydı ekranı"
//
// ── EKRANIN CEVAPLADIĞI SORULAR ──────────────────────────────────────────
//   "Bu sayımı kim iptal etti?"
//   "Bu stok kartının en az miktarını kim düşürdü?"
//   "Bu HACCP ölçümünü kim değiştirdi, eski değer neydi?"
//
// ── EKRAN NE YAPMAZ ──────────────────────────────────────────────────────
// Hiçbir şey yazmaz, düzeltmez, silmez. Kaydı yazan veritabanı tetikleyicisi
// (0027); burada yalnız okunur. "Denetim kaydını düzenle" düğmesi olan bir
// ekran, denetim kaydını anlamsız kılardı.
//
// ── STOK HAREKETLERİ NEDEN BURADA YOK ────────────────────────────────────
// Bilerek. Stok defteri zaten append-only ve zaten kendi denetim kaydı; her
// hareket Depo ekranında kimin, ne zaman, hangi belgeyle yazdığıyla duruyor.
// Buraya kopyalamak aynı bilgiyi iki yerde göstermek olurdu. Bu ekran
// defterin sessiz kaldığı yeri anlatıyor: BELGELER ve KARTLAR.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { resolveStockRepositoryMode } from '../core/stock/index'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import {
  ISLEM_ETIKETLERI, PostgresDenetimDefteri, TABLO_ETIKETLERI, alanAdi, tabloAdi,
  type DenetimIslemi, type DenetimKaydi,
} from '../audit/audit.repository'
import {
  alanDegeriniYaz, baslik, denetimOzeti, gunOnce, islemAdi, kisaOzet,
} from '../audit/audit.service'

type Props = { currentUser: User }

const hataMetni = (h: unknown) => (h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.')
const zamanBicimle = (d: string) => {
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleString('tr-TR')
}

const islemSinifi = (islem: DenetimIslemi) =>
  islem === 'DELETE' ? 'danger-pill' : islem === 'INSERT' ? 'success-pill' : 'info-pill'

export default function IslemGecmisi({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  const gorebilir = !currentUser.permissions
    || currentUser.permissions.includes('audit.read')
    || currentUser.permissions.includes('platform.manage')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [kayitlar, setKayitlar] = React.useState<DenetimKaydi[]>([])
  // Kullanıcı kimliği → ad. `opened_by`, `applied_by` gibi alanların değeri
  // ham kimlik; ekranda ada çevriliyor.
  const [kullanicilar, setKullanicilar] = React.useState<Record<string, string>>({})
  const [acik, setAcik] = React.useState<number | null>(null)
  const [baslangic, setBaslangic] = React.useState(() => gunOnce(7))
  const [bitis, setBitis] = React.useState(() => gunOnce(0))
  const [tablo, setTablo] = React.useState('')
  const [islem, setIslem] = React.useState<'' | DenetimIslemi>('')
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [calisiyor, setCalisiyor] = React.useState(false)
  const [hata, setHata] = React.useState('')

  const defter = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new PostgresDenetimDefteri(getSupabase())
  }, [mod])

  const yenile = React.useCallback(async (aktif: DepoBaglami) => {
    if(!defter) return
    const [k, adlar] = await Promise.all([
      defter.kayitlar(aktif.ctx, {
        baslangic, bitis,
        tablo: tablo || undefined,
        islem: islem || undefined,
      }),
      defter.kullaniciAdlari(aktif.ctx),
    ])
    setKayitlar(k)
    setKullanicilar(adlar)
  }, [defter, baslangic, bitis, tablo, islem])

  React.useEffect(() => {
    let iptal = false
    if(!defter){ setYukleniyor(false); return }
    ;(async () => {
      try{
        const kurulan = await depoBaglamiKur(getSupabase())
        if(iptal) return
        setBaglam(kurulan)
        await yenile(kurulan)
      } catch(e){ if(!iptal) setHata(hataMetni(e)) }
      finally { if(!iptal) setYukleniyor(false) }
    })()
    return () => { iptal = true }
    // Süzgeç değişince otomatik yenilemiyoruz: tarih kutusunu yazarken her
    // tuşta sorgu atmak hem yavaş hem gürültülü olurdu. "Getir" düğmesi var.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defter])

  if(!gorebilir){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>İşlem Geçmişi</h2></div></div>
        <section className="card empty-state">
          Bu ekranı görmek için denetim yetkisi gerekir.
        </section>
      </div>
    )
  }
  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>İşlem Geçmişi</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>Denetim kaydını veritabanı tetikleyicisi yazar; tarayıcı hafızasında denetim izi olmaz.</p>
        </section>
      </div>
    )
  }
  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>İşlem Geçmişi</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }
  if(!baglam || !defter){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>İşlem Geçmişi</h2></div></div>
        <section className="card empty-state">{hata || 'Çalışma alanı çözülemedi.'}</section>
      </div>
    )
  }

  const aktif = baglam
  const ozet = denetimOzeti(kayitlar)

  const getir = async () => {
    setCalisiyor(true)
    try{ await yenile(aktif); setHata('') }
    catch(e){ setHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>İşlem Geçmişi</h2>
          <p className="muted">Aşama 4 · Kim, ne zaman, neyi değiştirdi</p>
        </div>
      </div>

      {hata && <div className="form-error">{hata}</div>}

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Kayıtlar</h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Bu kaydı veritabanının kendisi yazar; hiçbir ekran, servis ya da
              SQL komutu atlayamaz. Yazılan satır <strong>değiştirilemez ve
              silinemez</strong>.
            </p>
          </div>
          <div className="zayi-filtreler">
            <label>Başlangıç
              <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)} />
            </label>
            <label>Bitiş
              <input type="date" value={bitis} onChange={e => setBitis(e.target.value)} />
            </label>
            <label>Kayıt türü
              <select value={tablo} onChange={e => setTablo(e.target.value)}>
                <option value="">Hepsi</option>
                {Object.entries(TABLO_ETIKETLERI).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label>İşlem
              <select value={islem} onChange={e => setIslem(e.target.value as '' | DenetimIslemi)}>
                <option value="">Hepsi</option>
                {Object.entries(ISLEM_ETIKETLERI).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <button className="btn" type="button" disabled={calisiyor}
              onClick={() => void getir()}>Getir</button>
          </div>
        </div>

        <p className="muted detail-hint" style={{ marginTop: 0 }}>
          <strong>{ozet.toplam}</strong> kayıt · {ozet.olusturma} oluşturma,
          {' '}{ozet.degisiklik} değişiklik, {ozet.silme} silme ·
          {' '}<strong>{ozet.kisi}</strong> kişi
          {ozet.aktorsuz > 0 && (
            <span className="is-critical">
              {' '}· {ozet.aktorsuz} kaydın kimin yaptığı çözülemedi
              (veritabanına doğrudan yazılmış olabilir)
            </span>
          )}
        </p>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Zaman</th><th>Kayıt</th><th>İşlem</th><th>Kim</th><th>Ne oldu</th>
              </tr>
            </thead>
            <tbody>
              {kayitlar.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    Seçilen aralıkta kayıt yok. Denetim kaydı 0027 göçünden
                    <strong> sonra</strong> yapılan işlemleri tutar; daha
                    öncesi için kayıt yoktur.
                  </td>
                </tr>
              )}
              {kayitlar.map(k => (
                <React.Fragment key={k.id}>
                  <tr
                    className={acik === k.id ? 'is-selected' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setAcik(acik === k.id ? null : k.id)}
                  >
                    <td className="muted">{zamanBicimle(k.tarih)}</td>
                    <td>
                      {tabloAdi(k.tablo)}
                      <div className="muted">{k.ozet ?? k.satirId}</div>
                    </td>
                    <td>
                      <span className={`status-pill ${islemSinifi(k.islem)}`}>
                        {islemAdi(k)}
                      </span>
                    </td>
                    <td>{k.aktorAd ?? <span className="muted">bilinmiyor</span>}</td>
                    <td className="muted">{kisaOzet(k, kullanicilar)}</td>
                  </tr>
                  {acik === k.id && (
                    <tr>
                      <td colSpan={5}>
                        <KayitAyrintisi kayit={k} kullanicilar={kullanicilar} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <p className="muted detail-hint">
          <strong>Stok hareketleri burada yok</strong> — ve bu bilinçli. Stok
          defteri zaten üzerine yazılamayan bir kayıttır; her hareketi Depo
          ekranında kimin, ne zaman, hangi belgeyle yazdığıyla görürsünüz.
          Aynı bilgiyi iki yerde göstermek, ikisine de güveni azaltır.
        </p>
      </section>

    </div>
  )
}

/**
 * Satırın ayrıntısı: alan alan eski → yeni.
 *
 * Oluşturma ve silmede satırın TAMAMI gösteriliyor; orada "değişen alan"
 * diye bir şey yok, kaydın kendisi olayın ta kendisi.
 */
function KayitAyrintisi({
  kayit, kullanicilar,
}: { kayit: DenetimKaydi; kullanicilar: Record<string, string> }){
  const gizli = new Set(['tenant_id', 'branch_id', 'id'])

  if(kayit.kayit){
    const alanlar = Object.entries(kayit.kayit).filter(([a]) => !gizli.has(a))
    return (
      <div className="stacked-form" style={{ padding: '4px 0' }}>
        <div className="muted" style={{ marginBottom: 8 }}>
          <strong>{baslik(kayit)}</strong> · {islemAdi(kayit)} ·
          {' '}{kayit.aktorAd ?? 'kim olduğu bilinmiyor'}
        </div>
        <div className="table-wrap">
          <table className="data-table compact">
            <thead><tr><th>Alan</th><th>Değer</th></tr></thead>
            <tbody>
              {alanlar.map(([alan, deger]) => (
                <tr key={alan}>
                  <td>{alanAdi(alan)}</td>
                  <td>{alanDegeriniYaz(alan, deger, kullanicilar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="stacked-form" style={{ padding: '4px 0' }}>
      <div className="muted" style={{ marginBottom: 8 }}>
        <strong>{baslik(kayit)}</strong> · {kayit.aktorAd ?? 'kim olduğu bilinmiyor'}
      </div>
      <div className="table-wrap">
        <table className="data-table compact">
          <thead><tr><th>Alan</th><th>Eski</th><th>Yeni</th></tr></thead>
          <tbody>
            {kayit.degisimler.length === 0 && (
              <tr><td colSpan={3} className="muted">Değişiklik ayrıntısı yok.</td></tr>
            )}
            {kayit.degisimler.map(d => (
              <tr key={d.alan}>
                <td>{alanAdi(d.alan)}</td>
                <td className="muted">{alanDegeriniYaz(d.alan, d.eski, kullanicilar)}</td>
                <td><strong>{alanDegeriniYaz(d.alan, d.yeni, kullanicilar)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted detail-hint" style={{ margin: 0 }}>
        Kayıt kimliği: <code>{kayit.satirId}</code>
      </p>
    </div>
  )
}
