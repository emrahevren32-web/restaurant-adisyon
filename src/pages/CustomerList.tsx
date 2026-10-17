// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · EVREN360 · Müşteri Listesi
//
// ── 2026-10-16'DA NE DEĞİŞTİ ─────────────────────────────────────────────
// Bu ekran `storage.ts` okuyordu — yani tarayıcının kendi hafızasını.
// Sunucuda o hafıza boş olduğu için Emrah'a "0 müşteri" diyordu; oysa
// beş müşterisi vardı. Artık veritabanını okuyor (0083 ·
// `platform_musteri_listesi`).
//
// ⚠️ Satır sayısı ekranda HESAPLANMIYOR. Kullanıcı sayısı, son giriş ve son
// hareket veritabanından geliyor. Ekranda hesaplanan sayı ikinci bir
// gerçeklik yaratır.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import {
  musteriListesiniOku,
  type MusteriSatiri
} from '../platform/platform-musteri.repository'
import { sektorAdi } from '../platform/platform-musteri.bicim'
import {
  bosDegilse, gunFarkiMetni, kisaTarih, zamanAraligi
} from '../platform/platform-musteri.bicim'

type Props = {
  onOpenCustomerDetail: (kiraciId: string) => void
}

type Suzgec = 'hepsi' | 'aktif' | 'deneme' | 'bitiyor' | 'sessiz'

const lisansRozeti = (satir: MusteriSatiri) => {
  if(!satir.lisansDurumu) return { sinif: 'muted-pill', metin: 'Lisans yok' }
  if(satir.kalanGun !== null && satir.kalanGun < 0) return { sinif: 'danger-pill', metin: 'Süresi doldu' }
  if(satir.lisansDurumu === 'Deneme') return { sinif: 'warning-pill', metin: 'Deneme' }
  if(satir.lisansDurumu === 'Aktif') return { sinif: 'success', metin: 'Aktif' }
  return { sinif: 'info-pill', metin: satir.lisansDurumu }
}

/** "Sessiz" = 14 gündür hiç hareket yok. Hiç hareketi olmayan da sessizdir. */
const sessizMi = (satir: MusteriSatiri) => {
  if(!satir.sonHareket) return true
  const fark = Date.now() - new Date(satir.sonHareket).getTime()
  return Number.isNaN(fark) ? true : fark > 14 * 24 * 60 * 60 * 1000
}

export default function CustomerList({ onOpenCustomerDetail }: Props){
  const [satirlar, setSatirlar] = React.useState<MusteriSatiri[]>([])
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [arama, setArama] = React.useState('')
  const [suzgec, setSuzgec] = React.useState<Suzgec>('hepsi')

  React.useEffect(() => {
    let iptal = false
    void (async () => {
      if(!isSupabaseConfigured()){
        setHata('Veritabanı bağlantısı yapılandırılmamış.')
        setYukleniyor(false)
        return
      }
      try {
        const veri = await musteriListesiniOku(getSupabase())
        if(iptal) return
        setSatirlar(veri)
        setHata('')
      } catch(e){
        if(!iptal) setHata(e instanceof Error ? e.message : 'Müşteri listesi okunamadı.')
      } finally {
        if(!iptal) setYukleniyor(false)
      }
    })()
    return () => { iptal = true }
  }, [])

  const aranan = arama.trim().toLocaleLowerCase('tr-TR')

  const gorunen = satirlar.filter(satir => {
    if(aranan){
      const havuz = [
        satir.firmaAdi, satir.kiraciAdi, satir.kiraciKodu, satir.il, satir.ilce
      ].join(' ').toLocaleLowerCase('tr-TR')
      if(!havuz.includes(aranan)) return false
    }
    if(suzgec === 'aktif')   return satir.lisansDurumu === 'Aktif'
    if(suzgec === 'deneme')  return satir.lisansDurumu === 'Deneme'
    if(suzgec === 'bitiyor') return satir.kalanGun !== null && satir.kalanGun <= 15
    if(suzgec === 'sessiz')  return sessizMi(satir)
    return true
  })

  const sayac = {
    hepsi: satirlar.length,
    aktif: satirlar.filter(s => s.lisansDurumu === 'Aktif').length,
    deneme: satirlar.filter(s => s.lisansDurumu === 'Deneme').length,
    bitiyor: satirlar.filter(s => s.kalanGun !== null && s.kalanGun <= 15).length,
    sessiz: satirlar.filter(sessizMi).length
  }

  const suzgecler: Array<{ anahtar: Suzgec; etiket: string }> = [
    { anahtar: 'hepsi',   etiket: 'Hepsi' },
    { anahtar: 'aktif',   etiket: 'Aktif' },
    { anahtar: 'deneme',  etiket: 'Deneme' },
    { anahtar: 'bitiyor', etiket: '15 günden az kaldı' },
    { anahtar: 'sessiz',  etiket: '14 gündür sessiz' }
  ]

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Müşteri Listesi</h2>
          <p className="muted">
            MİYOP'u kullanan bütün işletmeler. Sayılar veritabanından geliyor;
            MİYOP'un kendi kaydı listede yoktur.
          </p>
        </div>
      </div>

      {hata && <div className="form-error">{hata}</div>}

      <section className="card">
        <div className="section-header compact">
          <h3>Müşteriler</h3>
          {!yukleniyor && (
            <span className="status-pill info-pill">{sayac.hepsi} işletme</span>
          )}
        </div>

        <div className="musteri-suzgec">
          <input
            type="search"
            placeholder="İşletme adı, kod, il…"
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
        </div>

        {yukleniyor ? <p className="muted">Yükleniyor…</p>
         : satirlar.length === 0 ? (
            <p className="muted">
              Henüz müşteri yok. Yeni işletmeler Onay Bekleyen İşletmeler
              ekranından onaylandığında burada görünür.
            </p>
         ) : gorunen.length === 0 ? <p className="muted">Bu süzgece uyan işletme yok.</p>
         : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>İşletme</th>
                  <th>Yer</th>
                  <th>Sektör</th>
                  <th>Paket</th>
                  <th>Lisans</th>
                  <th>Kalan</th>
                  <th>Kullanıcı</th>
                  <th>Son giriş</th>
                  <th>Son hareket</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gorunen.map(satir => {
                  const rozet = lisansRozeti(satir)
                  return (
                    <tr key={satir.kiraciId}>
                      <td>
                        <strong>{bosDegilse(satir.firmaAdi || satir.kiraciAdi)}</strong>
                        <div className="muted small-text">{satir.kiraciKodu}</div>
                      </td>
                      <td>
                        {satir.il || satir.ilce
                          ? `${satir.il}${satir.ilce ? ` / ${satir.ilce}` : ''}`
                          : <span className="muted">—</span>}
                      </td>
                      <td>{sektorAdi(satir.sektor)}</td>
                      <td>{bosDegilse(satir.paketAdi)}</td>
                      <td><span className={`status-pill ${rozet.sinif}`}>{rozet.metin}</span></td>
                      <td>{gunFarkiMetni(satir.kalanGun)}</td>
                      <td>{satir.kullaniciSayisi}</td>
                      <td>{zamanAraligi(satir.sonGiris)}</td>
                      <td className={sessizMi(satir) ? 'muted' : undefined}>
                        {zamanAraligi(satir.sonHareket)}
                      </td>
                      <td>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => onOpenCustomerDetail(satir.kiraciId)}
                        >
                          Detay
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!yukleniyor && satirlar.length > 0 && (
          <p className="muted small-text">
            Kayıt tarihine göre yeniden eskiye sıralı. İlk kayıt:{' '}
            {kisaTarih(satirlar[satirlar.length - 1]?.kayitTarihi ?? '')}.
          </p>
        )}
      </section>
    </div>
  )
}
