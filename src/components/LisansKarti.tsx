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
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { lisansiOku, lisansUyarisi, type Lisans } from '../billing/license.repository'
import { getBusinessWorkspaceModuleByLicenseKey } from '../modules/business-workspace.registry'
import type { LicenseModuleKey } from '../types'

const tarih = (deger: string) => {
  const d = new Date(`${deger}T00:00:00`)
  return Number.isNaN(d.getTime()) ? deger : d.toLocaleDateString('tr-TR')
}

const modulAdi = (anahtar: string) =>
  getBusinessWorkspaceModuleByLicenseKey(anahtar as LicenseModuleKey)?.name ?? anahtar

export default function LisansKarti(){
  const [lisans, setLisans] = React.useState<Lisans | null>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')

  React.useEffect(() => {
    let iptal = false
    if(!isSupabaseConfigured()){ setYukleniyor(false); return }

    ;(async () => {
      try {
        const okunan = await lisansiOku(getSupabase())
        if(!iptal) setLisans(okunan)
      } catch(e){
        if(!iptal) setHata(e instanceof Error ? e.message : 'Lisans okunamadı.')
      } finally {
        if(!iptal) setYukleniyor(false)
      }
    })()

    return () => { iptal = true }
  }, [])

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

      <p className="muted small-text">
        Lisans numarası: <code>{lisans.anahtar}</code> · Lisans bilgileri MİYOP
        tarafından belirlenir; bu ekrandan değiştirilemez.
      </p>
    </section>
  )
}
