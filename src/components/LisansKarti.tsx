// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Lisans kartı — müşteri kendi lisansını görür
//
// A4D madde 3'ün ekran tarafı. Kayıt veritabanında (0042); burası onu
// okuyup gösteriyor, başka hiçbir şey yapmıyor: müşteri lisansını
// değiştiremez, uzatamaz.
//
// ⚠️ Lisans okunamıyorsa UYDURULMAZ. "Görünmüyor" demek "yok" demektir ve
// ekranda öyle yazar. Sahte bir "Aktif" rozeti, çalışmayan bir katmanı
// çalışıyor göstermenin tam örneğidir.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import {
  lisansiOku, lisansUyarisi, bekleyenTalep, ekSureTalepEt,
  type Lisans, type EkSureTalebi,
} from '../billing/license.repository'
import { getBusinessWorkspaceModuleByLicenseKey } from '../modules/business-workspace.registry'
import type { LicenseModuleKey } from '../types'

const tarih = (deger: string) => {
  const d = new Date(`${deger}T00:00:00`)
  return Number.isNaN(d.getTime()) ? deger : d.toLocaleDateString('tr-TR')
}

const modulAdi = (anahtar: string) =>
  getBusinessWorkspaceModuleByLicenseKey(anahtar as LicenseModuleKey)?.name ?? anahtar

type Props = { currentUser?: User }

/**
 * ⚠️ PLATFORMUN LİSANSI YOKTUR (Emrah, 2026-09-23: "adminin lisans süresi
 * olduğu nerede görülmüş?"). Lisans müşteri içindir. Platform kullanıcısına
 * bu kart HİÇ gösterilmiyor — boş ya da hatalı bir kart göstermek de olmaz.
 */
const platformKullanicisi = (user?: User) =>
  Boolean(user?.permissions?.includes('platform.manage'))

export default function LisansKarti({ currentUser }: Props){
  const [lisans, setLisans] = React.useState<Lisans | null>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [talep, setTalep] = React.useState<EkSureTalebi | null>(null)
  const [gerekce, setGerekce] = React.useState('')
  const [formAcik, setFormAcik] = React.useState(false)
  const [gonderiliyor, setGonderiliyor] = React.useState(false)
  const [talepHatasi, setTalepHatasi] = React.useState('')

  const platform = platformKullanicisi(currentUser)

  React.useEffect(() => {
    let iptal = false
    if(platform){ setYukleniyor(false); return }
    if(!isSupabaseConfigured()){ setYukleniyor(false); return }

    ;(async () => {
      try {
        const okunan = await lisansiOku(getSupabase())
        if(!iptal) setLisans(okunan)
        const acik = await bekleyenTalep(getSupabase())
        if(!iptal) setTalep(acik)
      } catch(e){
        if(!iptal) setHata(e instanceof Error ? e.message : 'Lisans okunamadı.')
      } finally {
        if(!iptal) setYukleniyor(false)
      }
    })()

    return () => { iptal = true }
  }, [platform])

  if(platform) return null

  if(yukleniyor){
    return (
      <section className="card">
        <div className="section-header compact"><h3>Lisans</h3></div>
        <p className="muted">Yükleniyor…</p>
      </section>
    )
  }

  if(hata || !lisans){
    return (
      <section className="card">
        <div className="section-header compact"><h3>Lisans</h3></div>
        <p className="form-error">
          {hata || 'Bu çalışma alanı için lisans kaydı görünmüyor.'}
        </p>
        <p className="muted small-text">MİYOP ile iletişime geçin.</p>
      </section>
    )
  }

  const uyari = lisansUyarisi(lisans)
  const talepEdilebilir = uyari.seviye !== 'iyi' && talep?.durum !== 'Bekliyor'

  const talebiGonder = async (olay: React.FormEvent) => {
    olay.preventDefault()
    if(gonderiliyor) return
    setGonderiliyor(true)
    setTalepHatasi('')
    try {
      await ekSureTalepEt(getSupabase(), gerekce)
      setTalep(await bekleyenTalep(getSupabase()))
      setFormAcik(false)
      setGerekce('')
    } catch(e){
      setTalepHatasi(e instanceof Error ? e.message : 'Talep iletilemedi.')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <section className="card">
      <div className="section-header compact">
        <h3>Lisans</h3>
        <span className={`status-pill ${uyari.seviye === 'iyi' ? 'success' : uyari.seviye === 'uyari' ? 'warning-pill' : 'danger-pill'}`}>
          {lisans.deneme ? 'Deneme' : lisans.durum}
        </span>
      </div>

      <div className="karar-ozet">
        <div className="karar-ozet-satir"><span>Paket</span><strong>{lisans.paketAdi}</strong></div>
        <div className="karar-ozet-satir"><span>Başlangıç</span><strong>{tarih(lisans.baslangic)}</strong></div>
        <div className="karar-ozet-satir"><span>Bitiş</span><strong>{tarih(lisans.bitis)}</strong></div>
        <div className="karar-ozet-satir"><span>Durum</span><strong>{uyari.mesaj}</strong></div>
      </div>

      {lisans.moduller.length > 0 && (
        <>
          <p className="muted small-text">Paketinizdeki modüller</p>
          <ul className="lisans-modul-listesi">
            {lisans.moduller.map(m => <li key={m}>{modulAdi(m)}</li>)}
          </ul>
        </>
      )}

      {/* ── EK SÜRE TALEBİ ──────────────────────────────────────────────
          Talep hiçbir şeyi uzatmaz; yalnız MİYOP'a iletir. Süreyi MİYOP
          uzatır. Müşteriye de bu cümleyle söyleniyor ki bastıktan sonra
          "uzadı mı" diye beklemesin. */}
      {talep?.durum === 'Bekliyor' && (
        <p className="muted small-text">
          Ek süre talebiniz MİYOP'a iletildi. Onaylandığında lisansınız
          buradan güncellenecek.
        </p>
      )}

      {talepEdilebilir && !formAcik && (
        <div className="form-actions">
          <button className="btn" type="button" onClick={() => setFormAcik(true)}>
            Ek süre talep et
          </button>
        </div>
      )}

      {formAcik && (
        <form onSubmit={talebiGonder}>
          <div className="form-field">
            <label htmlFor="lisans-gerekce">Talebinizin sebebi (isteğe bağlı)</label>
            <textarea
              id="lisans-gerekce"
              rows={2}
              value={gerekce}
              disabled={gonderiliyor}
              onChange={e => setGerekce(e.target.value)}
              placeholder="Örnek: Kurulumumuz sürüyor, iki hafta daha gerekiyor."
            />
          </div>
          {talepHatasi && <p className="form-error">{talepHatasi}</p>}
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={gonderiliyor}>
              {gonderiliyor ? 'İletiliyor…' : 'Talebi ilet'}
            </button>
            <button className="btn" type="button" disabled={gonderiliyor}
                    onClick={() => { setFormAcik(false); setTalepHatasi('') }}>
              Vazgeç
            </button>
          </div>
          <p className="muted small-text">
            Talep süreyi kendiliğinden uzatmaz; MİYOP onayıyla uzar.
          </p>
        </form>
      )}

      <p className="muted small-text">
        Lisans numarası: <code>{lisans.anahtar}</code> · Lisans bilgileri MİYOP
        tarafından belirlenir; bu ekrandan değiştirilemez.
      </p>
    </section>
  )
}
