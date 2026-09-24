// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Lisans Yönetimi (Evren360 · platform)
//
// Emrah'ın soruları ve karşılıkları:
//   "Kaç defa lisans uzatmışız?"        → Uzatma sütunu
//   "Toplam kaç gün lisans kullandılar?"→ Toplam gün sütunu
//   "Talebi nerede göreceğim?"          → Bekleyen talepler, en üstte
//
// Sayılar burada HESAPLANMIYOR; lisans defterinden (0043) geliyor. Ekranda
// hesaplanan bir sayı, ikinci bir gerçeklik yaratır.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import {
  lisansOzetiniOku, sureTalepleriniOku, lisansiUzat, talebiKararaBagla,
  type LisansOzeti, type SureTalebi,
} from '../billing/license-platform.repository'

const tarih = (deger: string) => {
  if(!deger) return '—'
  const d = new Date(`${deger.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? deger : d.toLocaleDateString('tr-TR')
}

const kalanMetni = (gun: number) =>
  gun < 0 ? `${Math.abs(gun)} gün geçti` : gun === 0 ? 'bugün bitiyor' : `${gun} gün`

export default function LisansYonetimi(){
  const [lisanslar, setLisanslar] = React.useState<LisansOzeti[]>([])
  const [talepler, setTalepler] = React.useState<SureTalebi[]>([])
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')
  const [islemde, setIslemde] = React.useState('')
  const [uzatilan, setUzatilan] = React.useState<LisansOzeti | null>(null)
  const [ay, setAy] = React.useState('1')
  const [yeniBitis, setYeniBitis] = React.useState('')
  const [not, setNot] = React.useState('')

  const yenile = React.useCallback(async () => {
    if(!isSupabaseConfigured()){ setYukleniyor(false); return }
    try {
      const [o, t] = await Promise.all([
        lisansOzetiniOku(getSupabase()),
        sureTalepleriniOku(getSupabase()),
      ])
      setLisanslar(o)
      setTalepler(t)
      setHata('')
    } catch(e){
      setHata(e instanceof Error ? e.message : 'Liste okunamadı.')
    } finally {
      setYukleniyor(false)
    }
  }, [])

  React.useEffect(() => { void yenile() }, [yenile])

  const uzat = async (olay: React.FormEvent) => {
    olay.preventDefault()
    if(!uzatilan || islemde) return
    setIslemde('uzatma')
    try {
      await lisansiUzat(getSupabase(), uzatilan.tenantId,
        yeniBitis
          ? { yeniBitis, not }
          : { ay: Number(ay) || 1, not })
      setBilgi(`${uzatilan.isletme} lisansı uzatıldı.`)
      setUzatilan(null); setNot(''); setYeniBitis(''); setAy('1')
      await yenile()
    } catch(e){
      setHata(e instanceof Error ? e.message : 'Uzatma yapılamadı.')
    } finally {
      setIslemde('')
    }
  }

  const karar = async (talep: SureTalebi, onay: boolean) => {
    if(islemde) return
    setIslemde(talep.id)
    try {
      await talebiKararaBagla(getSupabase(), talep.id, onay, 1, '')
      setBilgi(onay
        ? `${talep.isletme} talebi onaylandı, lisans 1 ay uzatıldı.`
        : `${talep.isletme} talebi reddedildi.`)
      await yenile()
    } catch(e){
      setHata(e instanceof Error ? e.message : 'Karar verilemedi.')
    } finally {
      setIslemde('')
    }
  }

  const bekleyenler = talepler.filter(t => t.durum === 'Bekliyor')

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Lisans Yönetimi</h2>
          <p className="muted">
            Müşteri lisansları, uzatma geçmişi ve ek süre talepleri.
            Platform kiracısının lisansı yoktur.
          </p>
        </div>
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-success">{bilgi}</div>}

      {/* ── BEKLEYEN TALEPLER · EN ÜSTTE ─────────────────────────────────
          Karar bekleyen iş, bilgi veren listeden önce gelir. */}
      <section className="card">
        <div className="section-header compact">
          <h3>Ek süre talepleri</h3>
          {bekleyenler.length > 0 && (
            <span className="status-pill warning-pill">{bekleyenler.length} bekliyor</span>
          )}
        </div>

        {yukleniyor ? <p className="muted">Yükleniyor…</p>
         : bekleyenler.length === 0 ? <p className="muted">Bekleyen talep yok.</p>
         : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>İşletme</th><th>Sebep</th><th>İstenme</th><th>Bitiş</th><th></th></tr>
              </thead>
              <tbody>
                {bekleyenler.map(t => (
                  <tr key={t.id}>
                    <td>{t.isletme}</td>
                    <td className="muted">{t.gerekce || '—'}</td>
                    <td>{tarih(t.istenme)}</td>
                    <td>{tarih(t.bitis)}</td>
                    <td>
                      <button className="btn primary" type="button"
                              disabled={islemde === t.id}
                              onClick={() => void karar(t, true)}>
                        Onayla · 1 ay
                      </button>
                      <button className="btn" type="button"
                              disabled={islemde === t.id}
                              onClick={() => void karar(t, false)}>
                        Reddet
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-header compact">
          <h3>Müşteri lisansları</h3>
        </div>

        {yukleniyor ? <p className="muted">Yükleniyor…</p>
         : lisanslar.length === 0 ? <p className="muted">Lisanslı müşteri yok.</p>
         : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>İşletme</th><th>Paket</th><th>Durum</th>
                  <th>Bitiş</th><th>Kalan</th><th>Uzatma</th><th>Toplam gün</th><th></th>
                </tr>
              </thead>
              <tbody>
                {lisanslar.map(l => (
                  <tr key={l.tenantId}>
                    <td>
                      <strong>{l.isletme}</strong>
                      <div className="muted small-text">{l.kiraciKodu}</div>
                    </td>
                    <td>{l.paket}</td>
                    <td>
                      <span className={`status-pill ${l.kalanGun < 0 ? 'danger-pill' : l.durum === 'Deneme' ? 'warning-pill' : 'success'}`}>
                        {l.durum}
                      </span>
                    </td>
                    <td>{tarih(l.bitis)}</td>
                    <td>{kalanMetni(l.kalanGun)}</td>
                    <td>{l.uzatmaSayisi} kez</td>
                    <td>{l.toplamGun} gün</td>
                    <td>
                      <button className="btn" type="button"
                              onClick={() => { setUzatilan(l); setYeniBitis(''); setAy('1') }}>
                        Uzat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {uzatilan && (
        <section className="card">
          <div className="section-header compact">
            <h3>{uzatilan.isletme} · lisansı uzat</h3>
          </div>
          <form onSubmit={uzat}>
            <div className="form-field">
              <label htmlFor="lisans-ay">Kaç ay eklensin?</label>
              <input id="lisans-ay" type="number" min={1} max={60} value={ay}
                     disabled={Boolean(yeniBitis)}
                     onChange={e => setAy(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="lisans-tarih">…ya da doğrudan bitiş tarihi</label>
              <input id="lisans-tarih" type="date" value={yeniBitis}
                     onChange={e => setYeniBitis(e.target.value)} />
              <p className="muted small-text">
                Tarih girilirse ay sayısı dikkate alınmaz. Süresi geçmiş lisansta
                ay ekleme BUGÜNDEN başlar.
              </p>
            </div>
            <div className="form-field">
              <label htmlFor="lisans-not">Not (isteğe bağlı)</label>
              <input id="lisans-not" value={not} onChange={e => setNot(e.target.value)} />
            </div>
            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={islemde === 'uzatma'}>
                {islemde === 'uzatma' ? 'Uzatılıyor…' : 'Uzat'}
              </button>
              <button className="btn" type="button" onClick={() => setUzatilan(null)}>
                Vazgeç
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
