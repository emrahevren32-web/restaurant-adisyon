// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Lisans uyarı şeridi — müşteri lisansının bittiğini GÖRSÜN
//
// ── NEDEN VAR (Emrah, 16.10.2026) ────────────────────────────────────────
// Uyarı zaten vardı: `LisansKarti`, bitişe 30 gün kala uyarı, 7 gün kala
// kritik diyor. Ama o kart yalnız AYARLAR sayfasında duruyor. İşletme
// oraya girmezse lisansının bittiğini ancak yazma kapısı kapanınca
// (0046) öğreniyor — yani iş üstünde.
//
// Bu şerit Kontrol Paneli'nin en üstünde. Müşteri her girişte görüyor.
//
// ── NE DEĞİL ─────────────────────────────────────────────────────────────
// Bu, lisans kartının kopyası DEĞİL. Modül listesi, ek süre formu, geçmiş
// yok. Tek işi "haberin olsun" demek ve kartın olduğu yere yol göstermek.
// Aynı bilgiyi iki yerde iki ayrı şekilde hesaplamak, iki ayrı gerçeklik
// demek olurdu: eşik tek yerde — `lisansUyarisi()` (license.repository.ts).
//
// ⚠️ Lisans okunamazsa ŞERİT HİÇ ÇIKMAZ. Kırmızı bir "lisans yok" uyarısı
// basmak, ağ hatasını lisans sorunu gibi göstermek olurdu. Hata konsola
// yazılıyor; müşteri ekranı yalan söylemiyor.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { lisansiOku, lisansUyarisi, type Lisans } from '../billing/license.repository'

type Props = {
  currentUser?: User
  /** Ayarlar sayfasına götürür; orada tam lisans kartı var. */
  onAyarlaraGit?: () => void
}

/** Platformun lisansı yoktur (Emrah, 23.09.2026). Şerit ona hiç gösterilmez. */
const platformKullanicisi = (user?: User) =>
  Boolean(user?.permissions?.includes('platform.manage'))

const tarih = (deger: string) => {
  const d = new Date(`${deger}T00:00:00`)
  return Number.isNaN(d.getTime()) ? deger : d.toLocaleDateString('tr-TR')
}

export default function LisansUyariSeridi({ currentUser, onAyarlaraGit }: Props){
  const [lisans, setLisans] = React.useState<Lisans | null>(null)

  React.useEffect(() => {
    let iptal = false
    if(platformKullanicisi(currentUser) || !isSupabaseConfigured()) return

    void (async () => {
      try {
        const okunan = await lisansiOku(getSupabase())
        if(!iptal) setLisans(okunan)
      } catch(e){
        // Sessiz değil: konsola yazıyoruz. Ama ekrana uyarı BASMIYORUZ.
        console.error('[MİYOP] Lisans uyarı şeridi okunamadı:', e)
      }
    })()

    return () => { iptal = true }
  }, [currentUser])

  if(!lisans || platformKullanicisi(currentUser)) return null

  const uyari = lisansUyarisi(lisans)
  if(uyari.seviye === 'iyi') return null

  return (
    <section
      className={`lisans-serit ${uyari.seviye === 'kritik' ? 'kritik' : 'uyari'}`}
      role="status"
    >
      <div className="lisans-serit-metin">
        <strong>
          {uyari.seviye === 'kritik' ? 'Lisans dikkat gerektiriyor' : 'Lisans süresi yaklaşıyor'}
        </strong>
        <div>{uyari.mesaj}</div>
        <div className="muted small-text">
          {lisans.paketAdi} · bitiş {tarih(lisans.bitis)}
        </div>
      </div>
      {onAyarlaraGit && (
        <button className="btn" type="button" onClick={onAyarlaraGit}>
          Lisans ayrıntısı
        </button>
      )}
    </section>
  )
}
