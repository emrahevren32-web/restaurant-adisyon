// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4B — ETİKET VE ALERJEN EKRANI
//
// Gıda mühendisinin çalışma masası. Üç şey burada buluşuyor:
//   1. Malzemenin alerjeni ve besin değeri GİRİLİYOR (veri tek yerde).
//   2. Mamulün alerjeni ve besin değeri reçeteden TÜRETİLİYOR, gösteriliyor.
//   3. Etiket basılıyor — veri eksikse TASLAK olarak.
//
// ⚠️ EKRANIN EN ÖNEMLİ DAVRANIŞI: "alerjen yok" ile "alerjeni incelenmedi"
// hiçbir yerde aynı görünmüyor. İkisi karışırsa, bakılmamış bir malzeme
// temiz sanılır ve etiket yanlış basılır.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { resolveStockRepositoryMode } from '../core/stock/index'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import {
  PostgresEtiketDeposu,
  type Alerjen, type AlerjenTuru, type BesinDegeri, type EksikKalem,
  type EtiketKalemi, type KalemAlerjeni, type TuretilmisAlerjen,
  type UretilenParti,
} from '../production/label.repository'
import { EtiketServisi, alerjenDurumu, etiketVerisiKur } from '../production/label.service'
import { etiketHtml, etiketKesilebilir } from '../production/label-documents'
import { belgeYazdir } from '../core/print/print'

type Props = { currentUser: User }

const hataMetni = (h: unknown) =>
  h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.'

const bugun = () => new Date().toLocaleDateString('sv-SE')

/** GG.AA.YYYY — kullanıcı tarihi böyle okur. */
const tarihYaz = (g: string): string => {
  const [y, a, d] = g.slice(0, 10).split('-')
  return d && a && y ? `${d}.${a}.${y}` : g
}

type BesinTaslagi = Record<string, string>

const BESIN_ALANLARI = [
  { anahtar: 'enerjiKj',     etiket: 'Enerji (kJ)' },
  { anahtar: 'enerjiKcal',   etiket: 'Enerji (kcal)' },
  { anahtar: 'yag',          etiket: 'Yağ (g)' },
  { anahtar: 'doymusYag',    etiket: '— doymuş yağ (g)' },
  { anahtar: 'karbonhidrat', etiket: 'Karbonhidrat (g)' },
  { anahtar: 'seker',        etiket: '— şeker (g)' },
  { anahtar: 'protein',      etiket: 'Protein (g)' },
  { anahtar: 'tuz',          etiket: 'Tuz (g)' },
] as const

const sayiya = (d: string): number | undefined => {
  const t = d.trim().replace(',', '.')
  if(t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

export default function Etiketler({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  const yazabilir = !currentUser.permissions
    || currentUser.permissions.includes('quality.write')
    || currentUser.permissions.includes('products.write')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [katalog, setKatalog] = React.useState<Alerjen[]>([])
  const [kalemler, setKalemler] = React.useState<EtiketKalemi[]>([])
  const [arama, setArama] = React.useState('')
  const [secili, setSecili] = React.useState<EtiketKalemi | null>(null)

  const [beyan, setBeyan] = React.useState<KalemAlerjeni[]>([])
  const [besin, setBesin] = React.useState<BesinTaslagi>({})
  const [besinKaynak, setBesinKaynak] = React.useState('')
  const [netMiktar, setNetMiktar] = React.useState('')
  const [netBirim, setNetBirim] = React.useState('')

  const [turetilen, setTuretilen] = React.useState<TuretilmisAlerjen[]>([])
  const [alerjenEksik, setAlerjenEksik] = React.useState<EksikKalem[]>([])
  const [turetilenBesin, setTuretilenBesin] = React.useState<BesinDegeri>()
  const [besinEksik, setBesinEksik] = React.useState<EksikKalem[]>([])

  // ── PARTİ ARTIK SEÇİLİYOR, YAZILMIYOR (0067) ───────────────────────────
  // ⚠️ `lot` hâlâ bir metin ama artık KULLANICI YAZMIYOR: seçilen partinin
  // kodu buraya kopyalanıyor. Etiket belgesi kod bekliyor, kimlik değil.
  const [lot, setLot] = React.useState('')
  const [partiler, setPartiler] = React.useState<UretilenParti[]>([])
  const [partiId, setPartiId] = React.useState('')
  const [uretim, setUretim] = React.useState(bugun())
  const [skt, setSkt] = React.useState('')
  const [saklama, setSaklama] = React.useState('')

  const [firma, setFirma] = React.useState('')
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const servis = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new EtiketServisi(new PostgresEtiketDeposu(getSupabase()))
  }, [mod])

  React.useEffect(() => {
    let iptal = false
    if(!servis){ setYukleniyor(false); return }
    ;(async () => {
      try{
        const kurulan = await depoBaglamiKur(getSupabase())
        if(iptal) return
        setBaglam(kurulan)
        const [a, k, f] = await Promise.all([
          servis.alerjenKatalogu(), servis.kalemler(kurulan.ctx),
          servis.firmaBilgisi(kurulan.ctx),
        ])
        if(iptal) return
        setFirma(f.ad)
        setKatalog(a)
        setKalemler(k.filter(x => x.aktif))
      } catch (e){ if(!iptal) setHata(hataMetni(e)) }
      finally { if(!iptal) setYukleniyor(false) }
    })()
    return () => { iptal = true }
  }, [servis])

  const ayrintiYukle = async (k: EtiketKalemi, b: DepoBaglami) => {
    if(!servis) return
    const [b1, b2, t, ae, tb, be, pl] = await Promise.all([
      servis.kalemAlerjenleri(b.ctx, k.id),
      servis.besinDegeri(b.ctx, k.id),
      servis.mamulAlerjenleri(b.ctx, k.id),
      servis.mamulAlerjenEksikleri(b.ctx, k.id),
      servis.mamulBesinDegeri(b.ctx, k.id),
      servis.mamulBesinEksikleri(b.ctx, k.id),
      servis.uretilenPartiler(b.ctx, k.id),
    ])

    // ── PARTİ SEÇİMİ SIFIRLANIYOR ───────────────────────────────────────
    // ⚠️ Başka bir ürüne geçildiğinde önceki ürünün partisi EKRANDA
    // KALMAMALI. Kalsaydı kullanıcı farkına varmadan A ürününün etiketine
    // B ürününün partisini basardı — ve bu, izlenebilirliği hiç
    // olmamasından kötü yapardı: kâğıt yanlış bir zinciri işaret ederdi.
    setPartiler(pl)
    setPartiId(''); setLot(''); setUretim(''); setSkt('')
    setBeyan(b1)
    setTuretilen(t); setAlerjenEksik(ae); setTuretilenBesin(tb); setBesinEksik(be)
    const taslak: BesinTaslagi = {}
    for(const a of BESIN_ALANLARI){
      const v = b2?.[a.anahtar as keyof BesinDegeri]
      taslak[a.anahtar] = typeof v === 'number' ? String(v) : ''
    }
    setBesin(taslak)
    setBesinKaynak(b2?.kaynak ?? '')
    setNetMiktar(k.netMiktar === undefined ? '' : String(k.netMiktar))
    setNetBirim(k.netBirim ?? '')
  }

  const sec = async (k: EtiketKalemi) => {
    setSecili(k); setHata(''); setBilgi('')
    if(!baglam) return
    try { await ayrintiYukle(k, baglam) } catch (e) { setHata(hataMetni(e)) }
  }

  const yenile = async () => {
    if(!servis || !baglam || !secili) return
    const liste = await servis.kalemler(baglam.ctx)
    setKalemler(liste.filter(x => x.aktif))
    const guncel = liste.find(x => x.id === secili.id) ?? null
    setSecili(guncel)
    if(guncel) await ayrintiYukle(guncel, baglam)
  }

  const alerjenDegistir = (kod: string, tur: AlerjenTuru | '') => {
    setBeyan(mevcut => {
      const kalan = mevcut.filter(b => b.kod !== kod)
      return tur === '' ? kalan : [...kalan, { kod, tur }]
    })
  }

  const beyanKaydet = async () => {
    if(!servis || !baglam || !secili) return
    try{
      await servis.alerjenleriYaz(baglam.ctx, secili.id, beyan)
      // ⚠️ Kaydetmek, İNCELENDİ demektir. Damga ayrı yazılıyor ki boş liste
      // ile hiç bakılmamış kalem ayrılabilsin.
      await servis.incelendiIsaretle(baglam.ctx, secili.id)
      setHata(''); setBilgi('Alerjen beyanı kaydedildi ve "incelendi" olarak damgalandı.')
      await yenile()
    } catch (e) { setBilgi(''); setHata(hataMetni(e)) }
  }

  const besinKaydet = async () => {
    if(!servis || !baglam || !secili) return
    try{
      const g: BesinDegeri = { temel: '100g', kaynak: besinKaynak }
      for(const a of BESIN_ALANLARI){
        const v = sayiya(besin[a.anahtar] ?? '')
        if(v !== undefined) (g as Record<string, unknown>)[a.anahtar] = v
      }
      await servis.besinYaz(baglam.ctx, secili.id, g)
      await servis.ambalajYaz(baglam.ctx, secili.id,
        sayiya(netMiktar), netBirim.trim() || undefined)
      setHata(''); setBilgi('Besin değeri ve ambalaj içeriği kaydedildi.')
      await yenile()
    } catch (e) { setBilgi(''); setHata(hataMetni(e)) }
  }

  const etiketVerisi = secili ? etiketVerisiKur({
    kalem: secili,
    // ⚠️ Firma adı KAYITTAN geliyor, elle yazılmıyor: etikette yanlış
    // üretici adı, yasal olarak yanlış beyandır.
    firmaAdi: firma,
    bilesenler: [],
    alerjenler: turetilen,
    ...(turetilenBesin ? { besin: turetilenBesin } : {}),
    alerjenEksikleri: alerjenEksik,
    besinEksikleri: besinEksik,
    ...(lot ? { lotKodu: lot } : {}),
    ...(uretim ? { uretimTarihi: uretim } : {}),
    ...(skt ? { sonKullanma: skt } : {}),
    ...(saklama ? { saklama } : {}),
  }) : null

  const etiketYazdir = () => {
    if(!etiketVerisi) return
    belgeYazdir(`Etiket · ${etiketVerisi.urunAdi}`, etiketHtml(etiketVerisi))
  }

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Etiket ve Alerjen</h2></div></div>
        <p className="muted">Bu ekran veritabanı bağlantısı gerektiriyor.</p>
      </div>
    )
  }
  if(yukleniyor) return <div className="warehouse-page"><p className="muted">Yükleniyor…</p></div>

  const q = arama.trim().toLocaleLowerCase('tr-TR')
  const suzulen = kalemler.filter(k =>
    !q || k.ad.toLocaleLowerCase('tr-TR').includes(q) || k.kod.toLocaleLowerCase('tr-TR').includes(q))
  const incelenmemis = kalemler.filter(k => !k.incelemeZamani).length

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Etiket ve Alerjen</h2>
          <p className="muted">
            Alerjen ve besin değeri malzemeye girilir; mamulünki reçeteden türetilir.
          </p>
        </div>
      </div>

      {incelenmemis > 0 && (
        <div className="form-error">
          <strong>{incelenmemis} kalemin alerjeni hiç incelenmedi.</strong>{' '}
          Alerjen satırı olmaması &quot;alerjen yok&quot; demek değildir; bu
          kalemleri içeren hiçbir mamulün etiketi kesilemez.
        </div>
      )}
      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-info">{bilgi}</div>}

      <div className="warehouse-layout">
        <section className="card warehouse-main">
          <div className="supplier-toolbar">
            <input
              type="search" value={arama} placeholder="Ürün adı veya kod"
              aria-label="Ürün ara" onChange={e => setArama(e.target.value)}
            />
          </div>
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr><th>Ürün</th><th>Kod</th><th>Alerjen durumu</th><th>Ambalaj</th><th></th></tr>
              </thead>
              <tbody>
                {suzulen.length === 0 && (
                  <tr><td colSpan={5} className="muted">Kalem yok.</td></tr>
                )}
                {suzulen.map(k => (
                  <tr key={k.id} className={secili?.id === k.id ? 'secili' : ''}>
                    <td>{k.ad}</td>
                    <td className="muted">{k.kod}</td>
                    <td className={k.incelemeZamani ? 'muted' : ''}>
                      {/* "incelenmedi" ile "alerjen yok" ASLA aynı görünmüyor. */}
                      {k.incelemeZamani
                        ? <span className="muted">{alerjenDurumu(k, 0).replace(' · alerjen yok','')}</span>
                        : <span className="onem-rozeti r-kritik">alerjeni incelenmedi</span>}
                    </td>
                    <td className="muted">
                      {k.netMiktar !== undefined && k.netBirim
                        ? `${k.netMiktar.toLocaleString('tr-TR')} ${k.netBirim}` : '—'}
                    </td>
                    <td>
                      <button className="btn ac" type="button" onClick={() => { void sec(k) }}>
                        {secili?.id === k.id ? 'Açık' : 'Aç ›'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="warehouse-side">
          {!secili && <section className="card"><p className="muted">Soldan bir ürün seçin.</p></section>}

          {secili && (
            <>
              <section className="card">
                <div className="section-header compact">
                  <h3>{secili.ad}</h3>
                  <span className="muted">{secili.kod}</span>
                </div>

                <h4>Alerjen beyanı</h4>
                <p className="muted detail-hint">
                  <strong>İçerir</strong> bileşendir; <strong>iz</strong> çapraz
                  bulaşma ihtimalidir. İkisi hukuken farklıdır.
                </p>
                {katalog.map(a => {
                  const mevcut = beyan.find(b => b.kod === a.kod)
                  return (
                    <div className="form-row" key={a.kod}>
                      <label>{a.ad}
                        <select
                          value={mevcut?.tur ?? ''} disabled={!yazabilir}
                          onChange={e => alerjenDegistir(a.kod, e.target.value as AlerjenTuru | '')}
                        >
                          <option value="">yok</option>
                          <option value="İÇERİR">içerir</option>
                          <option value="İZ">iz</option>
                        </select>
                      </label>
                      {a.not && <small className="muted">{a.not}</small>}
                    </div>
                  )
                })}
                {yazabilir && (
                  <div className="form-actions">
                    <button className="btn primary" type="button" onClick={() => { void beyanKaydet() }}>
                      Kaydet ve &quot;incelendi&quot; işaretle
                    </button>
                  </div>
                )}
              </section>

              <section className="card">
                <h4>Besin değeri <span className="muted">— 100 g için</span></h4>
                <div className="form-row">
                  <label>Ambalaj içeriği
                    <input
                      inputMode="decimal" value={netMiktar} disabled={!yazabilir}
                      placeholder="5" onChange={e => setNetMiktar(e.target.value)}
                    />
                  </label>
                  <label>Birim
                    <input
                      value={netBirim} disabled={!yazabilir} placeholder="kg"
                      onChange={e => setNetBirim(e.target.value)}
                    />
                  </label>
                </div>
                {BESIN_ALANLARI.map(a => (
                  <label key={a.anahtar}>{a.etiket}
                    <input
                      inputMode="decimal" value={besin[a.anahtar] ?? ''} disabled={!yazabilir}
                      onChange={e => setBesin({ ...besin, [a.anahtar]: e.target.value })}
                    />
                  </label>
                ))}
                <label>Kaynak *
                  <input
                    value={besinKaynak} disabled={!yazabilir}
                    placeholder="Tedarikçi spesifikasyonu / analiz raporu"
                    onChange={e => setBesinKaynak(e.target.value)}
                  />
                  <small className="muted">
                    Kaynağı yazılmayan bir besin değeri denetimde savunulamaz.
                  </small>
                </label>
                {yazabilir && (
                  <div className="form-actions">
                    <button className="btn primary" type="button" onClick={() => { void besinKaydet() }}>
                      Kaydet
                    </button>
                  </div>
                )}
              </section>

              <section className="card">
                <h4>Reçeteden türetilen</h4>
                <p className="muted detail-hint">
                  Bu ürün üretiliyorsa alerjenleri ve besin değeri reçete
                  ağacının tamamından türetilir — yarı mamuller dâhil.
                </p>

                {turetilen.length === 0 && alerjenEksik.length === 0 && (
                  <p className="muted">Türetilmiş alerjen yok.</p>
                )}
                {turetilen.map(a => (
                  <p key={a.kod}>
                    <strong>{a.ad}</strong> ({a.tur.toLocaleLowerCase('tr-TR')})
                    {a.kaynaklar.length > 0 && <span className="muted"> — {a.kaynaklar.join(', ')}</span>}
                  </p>
                ))}
                {alerjenEksik.length > 0 && (
                  <div className="form-error">
                    Alerjeni incelenmemiş malzeme:{' '}
                    {alerjenEksik.map(e => e.kalemAdi).join(', ')}
                  </div>
                )}

                {turetilenBesin && (
                  <p className="muted">
                    100 g: {turetilenBesin.enerjiKcal ?? '—'} kcal ·
                    yağ {turetilenBesin.yag ?? '—'} g ·
                    protein {turetilenBesin.protein ?? '—'} g ·
                    tuz {turetilenBesin.tuz ?? '—'} g
                  </p>
                )}
                {besinEksik.length > 0 && (
                  <div className="form-error">
                    Besin değeri türetilemiyor:{' '}
                    {besinEksik.map(e => `${e.kalemAdi}${e.sebep ? ` (${e.sebep})` : ''}`).join(' · ')}
                  </div>
                )}
              </section>

              <section className="card">
                <h4>Etiket</h4>
                {/* ── PARTİ SEÇİMİ (0067) ────────────────────────────────
                    ⚠️ Burada bir zamanlar SERBEST METİN kutusu vardı ve
                    izlenebilirlik zincirinin son metresi klavyeye bağlıydı.
                    Biri 20261007 yerine 20261006 yazdığı gün geri çağırma
                    yanlış paleti toplar ya da doğru paleti kaçırırdı — ve
                    hangisinin olduğu anlaşılmazdı, çünkü kâğıtla sistem
                    arasındaki tek bağ o numaraydı.

                    Parti, üretim tarihi ve son kullanma artık ÜÇÜ BİRDEN
                    kayıttan geliyor. Elle düzeltilemiyorlar: düzeltilebilse
                    seçim bir süslemeden ibaret olurdu. */}
                {partiler.length === 0 && (
                  <div className="form-error">
                    Bu ürünün sistemde <strong>üretilmiş partisi yok.</strong>{' '}
                    Önce Üretim ekranından iş emrini tamamlayın. Partisiz
                    etiket <strong>TASLAK</strong> basılır ve ambalaja
                    yapıştırılamaz.
                  </div>
                )}

                {partiler.length > 0 && (
                  <div className="form-row">
                    <label>Parti *
                      <select
                        value={partiId}
                        onChange={e => {
                          const p = partiler.find(x => x.id === e.target.value)
                          setPartiId(e.target.value)
                          // Üçü birden partiden geliyor. Kullanıcı birini
                          // değiştirip ötekini bırakamasın diye hepsi
                          // AYNI ANDA yazılıyor.
                          setLot(p?.kod ?? '')
                          setUretim(p?.uretimTarihi ?? '')
                          setSkt(p?.sonKullanma ?? '')
                        }}
                      >
                        <option value="">— parti seçin —</option>
                        {partiler.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.kod}
                            {p.isEmriNo ? ` · ${p.isEmriNo}` : ''}
                            {p.uretimTarihi ? ` · ${tarihYaz(p.uretimTarihi)}` : ''}
                            {/* Tükenmiş parti listede KALIYOR: etiket bazen
                                yeniden basılır (yırtılan ambalaj). Ama
                                tükenmiş olduğu YAZIYOR. */}
                            {p.bakiye <= 0 ? ' · (tükendi)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>Saklama
                      <input value={saklama} placeholder="0–4 °C"
                        onChange={e => setSaklama(e.target.value)} />
                    </label>
                  </div>
                )}

                {/* Seçilen partinin kayıttaki hâli — SALT OKUNUR. */}
                {partiId && (
                  <p className="muted" style={{ marginTop: 0 }}>
                    Üretim: <strong>{uretim ? tarihYaz(uretim) : 'kayıtta yok'}</strong>
                    {' · '}
                    Son kullanma: <strong>{skt ? tarihYaz(skt) : 'kayıtta yok'}</strong>
                    {' — '}bu iki tarih partinin kaydından geliyor, elle
                    değiştirilemez.
                  </p>
                )}
                {etiketVerisi && !etiketKesilebilir(etiketVerisi) && (
                  <div className="form-error">
                    Etiket <strong>TASLAK</strong> basılır — ambalaja yapıştırılamaz.
                    Eksikler kâğıdın üstünde yazılı olacak.
                  </div>
                )}
                <div className="form-actions">
                  <button className="btn primary" type="button" onClick={etiketYazdir}>
                    Etiketi yazdır
                  </button>
                </div>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
