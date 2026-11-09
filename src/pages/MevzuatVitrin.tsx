// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · GİRİŞ VİTRİNİ · MEVZUAT AKIŞI
//
// ── NEDEN VAR (Emrah, 09.11.2026) ────────────────────────────────────────
// *"Gıda yönetmeliklerinde yapılan son haberler, kanunlar, bildirimler vs
// kaynak gösterilerek akış halinde yer alsın."*
//
// ── ⚠️ BU KÖŞENİN BİR GEÇMİŞİ VAR ───────────────────────────────────────
// Giriş vitrininde DAHA ÖNCE bir duyuru bölümü vardı ve KALDIRILDI
// (MIYOP-059): kayıt yokken `createDemoAnnouncements()` uyduruyordu —
// *"Pazar gecesi kısa süreli bakım penceresi uygulanacaktır"* — ve
// tarihler her açılışta yeniden hesaplanıyordu. Bizim vermediğimiz bir
// taahhüt, her gün yeniden. 09.11'de o bölümün ölü CSS'i de silindi
// (MIYOP-107).
//
// Bu bileşen aynı köşeye ikinci kez kutu koyuyor. Farkı üç kuralda:
//
// 1. **UYDURMA YOK.** Tek kaynak `public.mevzuat_akisi_oku()` (göç 0113).
//    `../storage` BURAYA GİREMEZ: o dosyadaki okuyucular depo boşken demo
//    satır üretiyordu (HEDEFLER 3.10) ve burası müşterinin gördüğü İLK
//    ekran. Donduran test: `platform/mevzuat-kapisi.arch.test.ts` ve
//    `pages/giris-vitrini-dogru-soyler.arch.test.ts`.
// 2. **KAYIT YOKSA KUTU HİÇ ÇİZİLMEZ.** Boş bir "Mevzuat" başlığı okuyana
//    "burada bir şey olmalıydı" der. `platform_iletisim_oku`da da aynı
//    karar verilmişti: numara boşsa ekran hiçbir şey göstermiyor.
// 3. **HATA GÖSTERİLMEZ.** Buraya gelen kişi giriş yapmaya gelmiştir.
//    Okuma düşerse kutu yoktur; giriş ekranında kırmızı bir kutu
//    göstermek, bizim sorunumuzu onun sorunu yapmaktır. (Depo zaten
//    düşen okumada boş dizi döndürüyor, fırlatmıyor.)
//
// ⚠️ YAYINDA OLMAYAN SATIR BURAYA DÜŞEMEZ ve bu istemcinin kararı değil:
// sunucu yalnız `YAYINDA` satırları döndürüyor, `status` alanı vitrine
// hiç ÇIKMIYOR. Yani bir istemci hatası bile taslağı ekrana getiremez.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { PostgresMevzuatDefteri, type MevzuatVitrinSatiri } from '../platform/mevzuat.repository'
import { VITRIN_SATIR_SINIRI, tarihiGoster, vitrinGosterilsinMi } from '../platform/mevzuat.service'

export default function MevzuatVitrin(){
  const [satirlar, setSatirlar] = React.useState<MevzuatVitrinSatiri[]>([])
  const yapilandirildi = isSupabaseConfigured()

  // ⚠️ BAYRAK YOK, VERİ VAR: kayıt yoksa bölüm hiç çizilmiyor. Emrah
  // panelden yayına aldığı an görünüyor. "Göster/gizle" düğmesi ikinci bir
  // gerçeklik yaratırdı.
  React.useEffect(() => {
    if(!yapilandirildi) return
    let iptal = false
    void (async () => {
      const defter = new PostgresMevzuatDefteri(getSupabase())
      const gelen = await defter.vitriniOku(VITRIN_SATIR_SINIRI)
      if(!iptal) setSatirlar(gelen)
    })()
    return () => { iptal = true }
  }, [yapilandirildi])

  if(!vitrinGosterilsinMi(satirlar.length)) return null

  return (
    <section className="unified-login-section mevzuat-vitrin" id="mevzuat" aria-label="Mevzuat akışı">
      <div className="unified-login-section-heading">
        <span className="unified-login-section-label">Mevzuat</span>
        <h2>Gıda mevzuatında son durum</h2>
      </div>

      <div className="mevzuat-vitrin-liste">
        {satirlar.map(satir => (
          <article className="mevzuat-vitrin-satir" key={`${satir.yayimTarihi}-${satir.baslik}`}>
            <time dateTime={satir.yayimTarihi.slice(0, 10)}>{tarihiGoster(satir.yayimTarihi)}</time>
            <div className="mevzuat-vitrin-govde">
              <h3>{satir.baslik}</h3>
              {satir.ozet ? <p>{satir.ozet}</p> : null}
              {/*
                ⚠️ `rel="noopener noreferrer"` ŞART: `target="_blank"` açılan
                sayfaya `window.opener` üzerinden bu sekmeye dokunma imkânı
                verir. Adresin `https://` olması veritabanında zorunlu
                (0113); bu da ikinci kat.
              */}
              <a href={satir.kaynakAdresi} target="_blank" rel="noopener noreferrer">
                Kaynak: {satir.kaynakAdi}
              </a>
            </div>
          </article>
        ))}
      </div>

      {/*
        ⚠️ BU CÜMLE BİR SÖZ VERMİYOR. "Her gün güncellenir" ya da "anlık
        takip" demek, arkasında çalışan bir iş olmadan verilmiş bir söz
        olurdu (0106'nın KVKK metninde aynı karar verilmişti: tutulmayacak
        söz yazılmaz). Burada yalnız kaynağın nereden geldiği söyleniyor.
      */}
      <p className="muted small-text">
        Kayıtlar MİYOP tarafından kaynağından okunup eklenir; her satırın bağlantısı kaynağa gider.
      </p>
    </section>
  )
}
