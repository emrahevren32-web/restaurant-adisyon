// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 / Depo çekirdeği — Tedarikçiler ekranı
//
// Yol haritası maddesi: "Tedarikçi kayıtları"
//                       Bitti sayılır ki: "Ekle, düzenle, pasife al çalışıyor"
//
// Depo ekranıyla aynı kural: gerçek veritabanına konuşur. Eski
// `SupplierManagement` ekranı hâlâ localStorage üzerinde çalışıyor ve ona
// dokunulmadı — ADR-003'ün dikey dilim yaklaşımı: yeni çekirdek yanına
// kurulur, eskisi geçiş bitene kadar yerinde kalır.
//
// ── SİLME DÜĞMESİ NEDEN YOK ──────────────────────────────────────────────
// Tedarikçi silinirse ondan alınmış partilerin geçmişi kopar. Geri çağırma
// ("bu partiyi kimden aldık, başka nereye gitti") tam olarak o geçmişe
// dayanıyor — ürünün asıl sattığı şey bu. Pasife alınan tedarikçi yeni
// siparişlerde seçilemez, geçmişte görünmeye devam eder.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { resolveStockRepositoryMode } from '../core/stock/index'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import {
  PostgresTedarikciDeposu,
  type Tedarikci,
  type TedarikciGirdisi,
} from '../purchasing/supplier.repository'
import { TedarikciServisi, tedarikcileriSuz } from '../purchasing/supplier.service'
import { satirlariYaz } from '../core/import/sheet'
import {
  TEDARIKCI_SUTUNLARI,
  tedarikcileriCozumle,
  type TedarikciOnizlemesi,
} from '../purchasing/supplier-import'
import { SheetImport } from '../components/SheetImport'

type Props = { currentUser: User }

const hataMetni = (hata: unknown) =>
  hata instanceof Error ? hata.message : 'Beklenmeyen bir hata oluştu.'

const BOS_GIRDI: TedarikciGirdisi = {
  kod: '', ad: '', vergiNo: '', yetkili: '', telefon: '', eposta: '', adres: '', not: '',
}

export default function Suppliers({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  const yazabilir = !currentUser.permissions || currentUser.permissions.includes('purchase.write')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [kayitlar, setKayitlar] = React.useState<Tedarikci[]>([])
  const [arama, setArama] = React.useState('')
  const [pasifleriGoster, setPasifleriGoster] = React.useState(false)
  const [duzenlenen, setDuzenlenen] = React.useState<Tedarikci | 'yeni' | null>(null)
  const [iceAktar, setIceAktar] = React.useState(false)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const servis = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new TedarikciServisi(new PostgresTedarikciDeposu(getSupabase()))
  }, [mod])

  const yenile = React.useCallback(async (aktifBaglam: DepoBaglami) => {
    if(!servis) return
    setKayitlar(await servis.hepsi(aktifBaglam.ctx))
  }, [servis])

  React.useEffect(() => {
    let iptal = false
    if(!servis){ setYukleniyor(false); return }

    ;(async () => {
      try{
        const kurulan = await depoBaglamiKur(getSupabase())
        if(iptal) return
        setBaglam(kurulan)
        const liste = await servis.hepsi(kurulan.ctx)
        if(!iptal) setKayitlar(liste)
      } catch (e) {
        if(!iptal) setHata(hataMetni(e))
      } finally {
        if(!iptal) setYukleniyor(false)
      }
    })()

    return () => { iptal = true }
  }, [servis])

  const gorunen = tedarikcileriSuz(kayitlar, arama, pasifleriGoster)
  const pasifSayisi = kayitlar.filter(t => !t.aktif).length

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Tedarikçiler</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>
            Tedarikçi kayıtları, satın alma ve mal kabul zincirinin başlangıcıdır;
            veritabanı bağlantısı olmadan açılmaz.
          </p>
        </section>
      </div>
    )
  }

  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Tedarikçiler</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }

  if(!baglam){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Tedarikçiler</h2></div></div>
        <section className="card empty-state">{hata || 'Çalışma alanı çözülemedi.'}</section>
      </div>
    )
  }

  const kaydet = async (girdi: TedarikciGirdisi) => {
    try{
      if(duzenlenen === 'yeni'){
        await servis!.ekle(baglam.ctx, girdi)
        setBilgi(`"${girdi.ad.trim()}" eklendi.`)
      } else if(duzenlenen){
        await servis!.guncelle(baglam.ctx, duzenlenen.id, girdi)
        setBilgi(`"${girdi.ad.trim()}" güncellendi.`)
      }
      setHata('')
      setDuzenlenen(null)
      await yenile(baglam)
    } catch (e) {
      setHata(hataMetni(e))
    }
  }

  const aktiflikDegistir = async (kayit: Tedarikci) => {
    try{
      await servis!.aktiflikDegistir(baglam.ctx, kayit.id, !kayit.aktif)
      setBilgi(kayit.aktif
        ? `"${kayit.ad}" pasife alındı. Yeni siparişlerde seçilemez; geçmiş kayıtlar duruyor.`
        : `"${kayit.ad}" yeniden aktif.`)
      setHata('')
      await yenile(baglam)
    } catch (e) {
      setHata(hataMetni(e))
    }
  }

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Tedarikçiler</h2>
          <p className="muted">
            Aşama 2 · Satın alma ve mal kabul zincirinin başlangıcı
          </p>
        </div>
        {yazabilir && (
          <div className="form-actions">
            <button
              className="btn"
              onClick={() => { setIceAktar(true); setDuzenlenen(null); setHata(''); setBilgi('') }}
            >
              Excel’den Aktar
            </button>
            <button
              className="btn primary"
              onClick={() => { setDuzenlenen('yeni'); setIceAktar(false); setHata('') }}
            >
              Yeni Tedarikçi
            </button>
          </div>
        )}
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-info">{bilgi}</div>}

      <div className="warehouse-layout">
        <section className="card warehouse-main">
          <div className="supplier-toolbar">
            <input
              type="search"
              value={arama}
              placeholder="Kod, ad, yetkili veya vergi no ile ara"
              aria-label="Tedarikçi ara"
              onChange={event => setArama(event.target.value)}
            />
            {pasifSayisi > 0 && (
              <label className="supplier-toggle">
                <input
                  type="checkbox"
                  checked={pasifleriGoster}
                  onChange={event => setPasifleriGoster(event.target.checked)}
                />
                Pasifleri göster ({pasifSayisi})
              </label>
            )}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kod</th><th>Ad</th><th>Yetkili</th><th>Telefon</th><th>Durum</th><th />
                </tr>
              </thead>
              <tbody>
                {gorunen.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      {kayitlar.length === 0
                        ? 'Henüz tedarikçi yok. İlk kaydı ekleyerek başlayın.'
                        : 'Aramanıza uyan tedarikçi yok.'}
                    </td>
                  </tr>
                )}
                {gorunen.map(kayit => (
                  <tr key={kayit.id} className={kayit.aktif ? '' : 'is-passive'}>
                    <td>{kayit.kod}</td>
                    <td>{kayit.ad}</td>
                    <td className="muted">{kayit.yetkili ?? '—'}</td>
                    <td className="muted">{kayit.telefon ?? '—'}</td>
                    <td>
                      <span className={`status-pill ${kayit.aktif ? 'success-pill' : 'muted-pill'}`}>
                        {kayit.aktif ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="row-actions">
                      {yazabilir && (
                        <>
                          <button className="btn" type="button" onClick={() => { setDuzenlenen(kayit); setIceAktar(false); setHata('') }}>
                            Düzenle
                          </button>
                          <button
                            className="btn"
                            type="button"
                            title={kayit.aktif
                              ? 'Yeni siparişlerde seçilemez olur; geçmiş kayıtlar korunur.'
                              : 'Yeniden seçilebilir hâle gelir.'}
                            onClick={() => { void aktiflikDegistir(kayit) }}
                          >
                            {kayit.aktif ? 'Pasife al' : 'Aktif et'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="warehouse-side">
          {!duzenlenen && (
            <section className="card empty-state">
              Tedarikçi, satın alma zincirinin ilk halkasıdır. Bir parti mal geldiğinde
              “kimden geldi” sorusunun cevabı burada durur; geri çağırma o cevaba dayanır.
            </section>
          )}

          {iceAktar && (
            <section className="card">
              <div className="section-header compact"><h3>Excel’den Tedarikçi Aktar</h3></div>
              <SheetImport<TedarikciGirdisi>
                varlikAdi="Tedarikçiler"
                sutunlar={TEDARIKCI_SUTUNLARI}
                sablonDosyaAdi="tedarikci-sablon.xlsx"
                cozumle={satirlar => tedarikcileriCozumle(satirlar, kayitlar)}
                // Tedarikçide güncelleme VAR: kodu tutan kayıt üzerine yazılır.
                // Stok kartında yok — bkz. Depo ekranındaki aynı panel.
                guncellemeDestekli
                yaz={(onizleme: TedarikciOnizlemesi) => satirlariYaz(
                  onizleme,
                  girdi => servis!.ekle(baglam.ctx, girdi),
                  (id, girdi) => servis!.guncelle(baglam.ctx, id, girdi),
                )}
                onBitti={() => yenile(baglam)}
                onIptal={() => setIceAktar(false)}
              />
            </section>
          )}

          {duzenlenen && (
            <section className="card">
              <div className="section-header compact">
                <h3>{duzenlenen === 'yeni' ? 'Yeni Tedarikçi' : duzenlenen.ad}</h3>
              </div>
              <TedarikciFormu
                baslangic={duzenlenen === 'yeni' ? BOS_GIRDI : girdiyeCevir(duzenlenen)}
                onIptal={() => setDuzenlenen(null)}
                onKaydet={kaydet}
              />
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

const girdiyeCevir = (kayit: Tedarikci): TedarikciGirdisi => ({
  kod: kayit.kod,
  ad: kayit.ad,
  vergiNo: kayit.vergiNo ?? '',
  yetkili: kayit.yetkili ?? '',
  telefon: kayit.telefon ?? '',
  eposta: kayit.eposta ?? '',
  adres: kayit.adres ?? '',
  not: kayit.not ?? '',
})

function TedarikciFormu({
  baslangic,
  onIptal,
  onKaydet,
}: {
  baslangic: TedarikciGirdisi
  onIptal: () => void
  onKaydet: (girdi: TedarikciGirdisi) => Promise<void>
}){
  const [girdi, setGirdi] = React.useState<TedarikciGirdisi>(baslangic)
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  // Listeden başka bir tedarikçiye tıklanınca form o kayda dönmeli. `key`
  // vermeden bunu yapmanın yolu budur; yoksa form ilk açtığı kaydı gösterir
  // ve kullanıcı yanlış kaydı düzenlediğini fark etmez.
  React.useEffect(() => { setGirdi(baslangic) }, [baslangic])

  const alan = (ad: keyof TedarikciGirdisi) => ({
    value: girdi[ad] ?? '',
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setGirdi(onceki => ({ ...onceki, [ad]: event.target.value })),
  })

  return (
    <form
      className="stacked-form"
      onSubmit={async event => {
        event.preventDefault()
        setGonderiliyor(true)
        try { await onKaydet(girdi) } finally { setGonderiliyor(false) }
      }}
    >
      <label>
        Kod *
        <input {...alan('kod')} required placeholder="ET-01" />
        <small className="muted">Tekildir. Büyük/küçük harf ve boşluk farkı aynı kod sayılır.</small>
      </label>
      <label>
        Ad *
        <input {...alan('ad')} required placeholder="Et Tedarik A.Ş." />
      </label>
      <label>
        Yetkili
        <input {...alan('yetkili')} placeholder="Mehmet Bey" />
        <small className="muted">Bir sorun çıktığında aranacak kişi.</small>
      </label>
      <label>
        Telefon
        <input {...alan('telefon')} placeholder="0212 000 00 00" />
      </label>
      <label>
        E-posta
        <input {...alan('eposta')} type="text" placeholder="mehmet@firma.com" />
      </label>
      <label>
        Vergi No
        <input {...alan('vergiNo')} />
      </label>
      <label>
        Adres
        <textarea
          value={girdi.adres ?? ''}
          rows={2}
          onChange={event => setGirdi(onceki => ({ ...onceki, adres: event.target.value }))}
        />
      </label>
      <label>
        Not
        <textarea
          value={girdi.not ?? ''}
          rows={2}
          onChange={event => setGirdi(onceki => ({ ...onceki, not: event.target.value }))}
        />
      </label>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}
