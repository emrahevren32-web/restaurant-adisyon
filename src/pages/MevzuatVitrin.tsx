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
//
// ── 10.11.2026 · AKIŞ DEĞİL KÜTÜPHANE (göç 0114) ─────────────────────────
// Emrah ilk kaydı girdikten sonra `gidamo.org.tr/mevzuat/ilgili-mevzuat`
// sayfasını gösterdi: *"ben aslında bu adresteki gibi olsun istemiştim."*
// O sayfa bir haber akışı değil; üç kalıcı kapı — Kanunlar, Yönetmelikler,
// Tebliğler. Kutu artık türlere göre gruplanıyor.
//
// ⚠️ SIRA BURADA KURULMUYOR. Sunucu satırları kanun → yönetmelik → tebliğ
// → haber sırasında veriyor (0114); `mevzuatiGruplara` o sırayı yalnız
// KORUYOR. Burada bir sıralama yazılsaydı aynı kural iki yerde iki gerçek
// olurdu — ve biri değişip diğeri kaldığında kutu sessizce yanlış dizilirdi.
//
// ⚠️ OTOMATİK TOPLAMA YOK ve kutu bunu SÖYLEMİYOR da. Emrah *"sistem kendi
// bulsun"* dedi; ölçüldü, Resmî Gazete'nin resmî bir RSS/API ucu yok ve
// HTML ayrıştıran çözümler kaynak değişince sessizce boş döner. Karar:
// önce kütüphane, toplama demo sonrası. O gün gelene kadar bu ekran
// "güncel tutuluyor" gibi bir söz VERMİYOR.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { PostgresMevzuatDefteri, type MevzuatVitrinSatiri } from '../platform/mevzuat.repository'
import {
  VITRIN_SATIR_SINIRI,
  mevzuatiGruplara,
  tarihiGoster,
  vitrinGosterilsinMi,
} from '../platform/mevzuat.service'

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

  const gruplar = mevzuatiGruplara(satirlar)

  if(!vitrinGosterilsinMi(gruplar.length)) return null

  return (
    <section className="unified-login-section mevzuat-vitrin" id="mevzuat" aria-label="Mevzuat akışı">
      <div className="unified-login-section-heading">
        <span className="unified-login-section-label">Mevzuat</span>
        <h2>Gıda mevzuatı</h2>
      </div>

      {gruplar.map(grup => (
        <div className="mevzuat-vitrin-grup" key={grup.tur}>
          <h3 className="mevzuat-vitrin-grup-basligi">{grup.baslik}</h3>
          <ul className="mevzuat-vitrin-liste">
            {grup.satirlar.map(satir => (
              <li className="mevzuat-vitrin-satir" key={`${satir.tur}-${satir.baslik}`}>
                {/*
                  ⚠️ `rel="noopener noreferrer"` ŞART: `target="_blank"` açılan
                  sayfaya `window.opener` üzerinden bu sekmeye dokunma imkânı
                  verir. Adresin `https://` olması veritabanında zorunlu
                  (0113); bu da ikinci kat.
                */}
                <a href={satir.kaynakAdresi} target="_blank" rel="noopener noreferrer">
                  {satir.baslik}
                </a>
                {satir.ozet ? <p>{satir.ozet}</p> : null}
                <span className="muted small-text">
                  {/*
                    ⚠️ TARİH YALNIZ HABERDE. Kalıcı bir kanun bağlantısının
                    yanında tarih yazmak, o bağlantının O GÜN değiştiği
                    izlenimi verir — Emrah'ın 10.11'de ekranda yanlış bulduğu
                    şey tam buydu (2011 tarihli bir yönetmelik haber gibi
                    dizilmişti).
                  */}
                  {grup.tur === 'HABER'
                    ? `${tarihiGoster(satir.yayimTarihi)} · ${satir.kaynakAdi}`
                    : `Kaynak: ${satir.kaynakAdi}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/*
        ⚠️ BU CÜMLE BİR SÖZ VERMİYOR. "Her gün güncellenir" ya da "anlık
        takip" demek, arkasında çalışan bir iş olmadan verilmiş bir söz
        olurdu (0106'nın KVKK metninde aynı karar verilmişti: tutulmayacak
        söz yazılmaz). Burada yalnız kaynağın nereden geldiği söyleniyor.
      */}
      <p className="muted small-text">
        Bağlantılar mevzuatın kendi kaynağına gider; MİYOP burada yalnız yolu gösterir.
      </p>
    </section>
  )
}
