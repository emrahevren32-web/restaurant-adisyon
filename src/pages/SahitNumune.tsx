// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3.9 / Kalite — ŞAHİT NUMUNE
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────
// Göç 0093 defteri kurdu, 0094 kiracı sınırını, satır kilidini ve açık raf
// ömrünü ekledi. Ama Emrah 26.10'da haklı olarak şunu yazdı:
//   *"miyop.emrahevren.com'dan baktım, Şahit numune ekranı yok."*
// Defter olup ekranı olmayan bir özellik, kullanıcı için YOKTUR. Bu dosya o
// açığı kapatıyor.
//
// ⚠️ MENÜDEKİ ESKİ "Şahit Numune" ÖGESİ BU DEĞİL. O öge
// `pages/WitnessSamples.tsx`e bakıyordu ve tamamı
// `src/witness-samples/witness-sample.mock.ts`ten besleniyordu — uydurma
// satırlar. Donmuş olarak yerinde duruyor (ADR-003 dikey dilim), menüye
// çıkmıyor. Bu ekran onun yanına kuruldu, yerine değil.
//
// ── EKRANIN DÖRT İŞİ ─────────────────────────────────────────────────────
// 1. NUMUNE AL · üretilmiş bir partiden şahit numune açmak.
// 2. İZLEMEK   · ne saklıyoruz, hangisinin süresi doldu.
// 3. AÇMAK     · müşteri itirazında, müşteri önünde. Gerekçe ve sonuç şart.
// 4. İMHA      · süresi dolan numune kayıtla imha edilir.
//
// ── EKRAN HİÇBİR ŞEY HESAPLAMIYOR ────────────────────────────────────────
// Saklama koşulu, saklama sonu, açık raf ömrü ve imza SUNUCUDAN geliyor
// (0093/0094 tetikleri). Burada hesaplanan tek şey "bugün o günü geçti mi"
// gösterimi ve girdilerin boş geçilmemesi.
//
// ⚠️ Saklama süresini ekranda hesaplamak en kolay yol olurdu ve en
// tehlikelisi: bir gün sunucudan ayrışır, ekran "3 gün kaldı" derken
// sunucu numuneyi süresi dolmuş sayar ve hangisinin doğru olduğu bilinmez.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { resolveStockRepositoryMode } from '../core/stock/index'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import {
  numuneImhaOnaylayabilirMi, numuneYazabilirMi,
  NUMUNE_IMHA_YETKISI_YOK, NUMUNE_YETKISI_YOK,
} from '../authorization/yazma-yetkisi'
import {
  NUMUNE_DURUM_ETIKETLERI, NUMUNE_OLAY_ETIKETLERI,
  PostgresSahitNumuneDeposu,
  type NumuneAdayi, type NumuneDurumu, type NumuneOlayi, type SahitNumune,
} from '../quality/witness-sample.repository'
import {
  gerekceYeterliMi, kalanGun, numuneAlinamazSebebi, numuneKoduYeterliMi,
  numuneOzeti, numuneSirasi, suresiDolduMu,
} from '../quality/witness-sample.service'

type Props = { currentUser: User }

const hataMetni = (h: unknown) => (h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.')

const gunBicimle = (d: string | undefined) => {
  if(!d) return '—'
  const t = new Date(`${d.slice(0, 10)}T00:00:00`)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleDateString('tr-TR')
}
const zamanBicimle = (d: string) => {
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleString('tr-TR')
}

const durumSinifi = (durum: NumuneDurumu) =>
  durum === 'IMHA' ? 'muted-pill' : durum === 'ACILDI' ? 'warning-pill' : 'info-pill'

/** Saklama sonu sütununun metni: kaç gün kaldı ya da kaç gün geçti. */
const sureMetni = (numune: SahitNumune): string => {
  if(numune.durum === 'IMHA') return gunBicimle(numune.saklamaSonu)
  const kalan = kalanGun(numune.saklamaSonu)
  if(kalan < 0) return `${gunBicimle(numune.saklamaSonu)} · ${Math.abs(kalan)} gün geçti`
  if(kalan === 0) return `${gunBicimle(numune.saklamaSonu)} · bugün son gün`
  return `${gunBicimle(numune.saklamaSonu)} · ${kalan} gün`
}

export default function SahitNumune({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  // ⚠️ Kapı iki izinden BİRİNİ istiyor; aynı liste veritabanında da duruyor
  // ve ikisinin aynı kaldığı ölçülüyor (quality/numune-kapisi.arch.test.ts).
  const yazabilir = numuneYazabilirMi(currentUser)
  /**
   * ⚠️ İMHA AYRI BİR KAPI (göç 0097). Emrah'ın kararı: *"müdür onaylar ama
   * müdür yoksa gıda mühendisi veya kalitecide onaylayabilir."* Numune
   * almak ve açmak bir iş; imha etmek bir karar.
   * ⚠️ Üretim sorumlusu numune alır ve açar ama imha edemez — kendi aldığı
   * numuneyi kendi başına yok edememesi kararın asıl amacı.
   */
  const imhaOnaylayabilir = numuneImhaOnaylayabilirMi(currentUser)

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [numuneler, setNumuneler] = React.useState<SahitNumune[]>([])
  const [adaylar, setAdaylar] = React.useState<NumuneAdayi[]>([])
  const [olaylar, setOlaylar] = React.useState<NumuneOlayi[]>([])
  const [acikNumuneId, setAcikNumuneId] = React.useState<string | null>(null)

  const [secilenLot, setSecilenLot] = React.useState('')
  const [yeniKod, setYeniKod] = React.useState('')
  const [yeniNot, setYeniNot] = React.useState('')

  // Açılış/imha formu — hangi numune, hangi işlem.
  const [islem, setIslem] = React.useState<{ numuneId: string; tip: 'ACILDI' | 'IMHA' } | null>(null)
  const [gerekce, setGerekce] = React.useState('')
  const [sonuc, setSonuc] = React.useState('')

  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [calisiyor, setCalisiyor] = React.useState(false)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const depo = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new PostgresSahitNumuneDeposu(getSupabase())
  }, [mod])

  const yenile = React.useCallback(async (aktif: DepoBaglami) => {
    if(!depo) return
    const [kayitlar, partiler] = await Promise.all([
      depo.numuneler(aktif.ctx),
      depo.adaylar(aktif.ctx),
    ])
    setNumuneler(kayitlar)
    setAdaylar(partiler)
  }, [depo])

  React.useEffect(() => {
    let iptal = false
    if(!depo){ setYukleniyor(false); return }
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
  }, [depo, yenile])

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Şahit Numune</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>
            Numune defteri eklemelidir: kayıt silinmez, durum elle yazılmaz.
            Tarayıcı hafızasında denetim izi olmaz.
          </p>
        </section>
      </div>
    )
  }
  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Şahit Numune</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }
  if(!baglam || !depo){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Şahit Numune</h2></div></div>
        <section className="card empty-state">{hata || 'Çalışma alanı çözülemedi.'}</section>
      </div>
    )
  }

  const aktifBaglam = baglam
  const ozet = numuneOzeti(numuneler)
  const sirali = numuneSirasi(numuneler)
  const secili = adaylar.find(a => a.lotId === secilenLot)
  const seciliEngel = secili ? numuneAlinamazSebebi(secili) : undefined
  const alinabilir = yazabilir && !!secili && !seciliEngel && numuneKoduYeterliMi(yeniKod)

  const olaylariGoster = async (numuneId: string) => {
    if(acikNumuneId === numuneId){ setAcikNumuneId(null); setOlaylar([]); return }
    setCalisiyor(true)
    try{
      const kayitlar = await depo.olaylar(aktifBaglam.ctx, numuneId)
      setOlaylar(kayitlar)
      setAcikNumuneId(numuneId)
      setHata('')
    } catch(e){ setHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  const numuneAl = async () => {
    if(!secili) return
    setCalisiyor(true)
    try{
      await depo.numuneAl(aktifBaglam.ctx, {
        lotId: secili.lotId,
        kod: yeniKod.trim(),
        isEmriId: secili.isEmriId,
        not: yeniNot,
      })
      setSecilenLot(''); setYeniKod(''); setYeniNot('')
      setHata('')
      setBilgi(
        'Şahit numune deftere yazıldı. Saklama koşulu ürün kartından, saklama '
        + 'sonu partinin son kullanma tarihinden alındı.',
      )
      await yenile(aktifBaglam)
    } catch(e){ setHata(hataMetni(e)); setBilgi('') }
    finally { setCalisiyor(false) }
  }

  const olayYaz = async () => {
    if(!islem) return
    const acilis = islem.tip === 'ACILDI'
    if(!window.confirm(
      acilis
        ? 'Numune AÇILDI olarak yazılacak.\n\n'
          + 'Bu kayıt silinemez ve düzeltilemez. Müşteri itirazında numune '
          + 'müşteri önünde açılır; açılış sonucunu da yazın.'
        : 'Numune İMHA olarak yazılacak.\n\n'
          + 'İmhadan sonra bu numuneye yeni kayıt eklenemez; defter kapanır.',
    )) return

    setCalisiyor(true)
    try{
      await depo.olayYaz(aktifBaglam.ctx, {
        numuneId: islem.numuneId,
        tip: islem.tip,
        gerekce,
        sonuc: acilis ? sonuc : undefined,
      })
      setIslem(null); setGerekce(''); setSonuc('')
      setHata('')
      setBilgi(acilis
        ? 'Açılış deftere yazıldı. Açık raf ömrü tanımlıysa saklama sonu kısaldı.'
        : 'İmha deftere yazıldı.')
      await yenile(aktifBaglam)
      if(acikNumuneId === islem.numuneId){
        setOlaylar(await depo.olaylar(aktifBaglam.ctx, islem.numuneId))
      }
    } catch(e){ setHata(hataMetni(e)); setBilgi('') }
    finally { setCalisiyor(false) }
  }

  const islemHazir = islem !== null && gerekceYeterliMi(gerekce)
    && (islem.tip === 'IMHA' || gerekceYeterliMi(sonuc))

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Şahit Numune</h2>
          <p className="muted">
            Her üretim partisinden numune · saklama koşulu müşteriye bildirilenin
            aynısı · kayıt silinmez
          </p>
        </div>
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-info">{bilgi}</div>}
      {!yazabilir && <div className="form-info">{NUMUNE_YETKISI_YOK}</div>}
      {/* ⚠️ Düğmeyi sessizce gizlemek yerine SEBEBİNİ söylüyoruz: numune
          alabilen ama imha onaylayamayan kişi (üretim sorumlusu) düğmeyi
          arayıp "ekran bozuk" demesin. */}
      {yazabilir && !imhaOnaylayabilir && (
        <div className="form-info">{NUMUNE_IMHA_YETKISI_YOK}</div>
      )}

      {/* ── ÖZET ─────────────────────────────────────────────────────────── */}
      <section className="card">
        <div className="section-header"><div><h3>Durum</h3></div></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="num">Saklanan</th>
                <th className="num">Açılmış</th>
                <th className="num">İmha edilmiş</th>
                <th className="num">İmha bekleyen</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="num">{ozet.saklanan}</td>
                <td className="num">{ozet.acilan}</td>
                <td className="num">{ozet.imha}</td>
                <td className={`num ${ozet.imhaBekleyen > 0 ? 'is-critical' : ''}`}>
                  {ozet.imhaBekleyen}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted detail-hint" style={{ margin: '12px 0 0' }}>
          <strong>İmha bekleyen:</strong> saklama süresi dolmuş ama hâlâ imha
          kaydı yazılmamış numuneler. Süre dolduğunda ürünün SKT'si de
          dolmuştur — ama imha mutlaka kayda geçer ve <strong>onay
          ister</strong>: işletme müdürü onaylar, müdür yoksa gıda mühendisi
          ya da kalite sorumlusu.
        </p>
      </section>

      {/* ── 1 · NUMUNE AL ────────────────────────────────────────────────── */}
      {yazabilir && (
        <section className="card">
          <div className="section-header">
            <div>
              <h3>Numune Al</h3>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                Son kullanma tarihi yazılı partiler listelenir. Saklama koşulu
                ve saklama sonu buradan DEĞİL, ürün kartından ve partiden gelir.
              </p>
            </div>
          </div>

          {adaylar.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Son kullanma tarihi yazılı parti yok. Numune bir partiye bağlanmak
              zorunda; önce üretim partisi oluşsun ve partiye SKT yazılsın.
            </p>
          ) : (
            <div className="stacked-form">
              <div className="form-field">
                <label>Parti</label>
                <select value={secilenLot} onChange={e => setSecilenLot(e.target.value)}>
                  <option value="">Parti seçin…</option>
                  {adaylar.map(a => (
                    <option key={a.lotId} value={a.lotId}
                      disabled={numuneAlinamazSebebi(a) !== undefined}>
                      {a.lotKodu} · {a.kalemAd} · SKT {gunBicimle(a.skt)}
                      {a.uretimPartisiMi ? '' : ' · mal kabul'}
                      {numuneAlinamazSebebi(a) ? ' · seçilemez' : ''}
                    </option>
                  ))}
                </select>
                {/* ⚠️ Sebep YAZILI: "seçilemez" demek yetmez, eksik olanın
                    nerede düzeltileceğini söylemek gerekiyor. */}
                {seciliEngel && <small className="muted">{seciliEngel}</small>}
                {secili && !seciliEngel && (
                  <small className="muted">
                    Saklama koşulu: <strong>{secili.saklamaKosulu}</strong> ·
                    {' '}saklama sonu partinin SKT'si olacak: {gunBicimle(secili.skt)}
                    {secili.acikRafOmruGun
                      ? ` · açıldıktan sonra ${secili.acikRafOmruGun} gün uygun`
                      : ' · açık raf ömrü ürün kartında yazılı değil'}
                  </small>
                )}
              </div>

              <div className="form-field">
                <label>Numune kodu</label>
                <input value={yeniKod} onChange={e => setYeniKod(e.target.value)}
                  placeholder="örn. SN-2026-0001" />
                <small className="muted">
                  İşletmenin kendi defter numarası. Aynı kod iki kez
                  kullanılamaz — büyük/küçük harf farkı da aynı kod sayılır.
                </small>
              </div>

              <div className="form-field">
                <label>Not (isteğe bağlı)</label>
                <input value={yeniNot} onChange={e => setYeniNot(e.target.value)}
                  placeholder="Kim kontrol etti, nereye kondu" />
              </div>

              <div className="form-actions">
                <button className="btn primary" type="button"
                  disabled={!alinabilir || calisiyor} onClick={() => void numuneAl()}>
                  {calisiyor ? 'İşleniyor…' : 'Numune Al'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── 2 · DEFTER ───────────────────────────────────────────────────── */}
      <section className="card">
        <div className="section-header"><div><h3>Numune Defteri</h3></div></div>

        {sirali.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Henüz şahit numune kaydı yok.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kod</th><th>Ürün</th><th>Parti</th>
                  <th>Saklama koşulu</th><th>Saklama sonu</th>
                  <th>Durum</th><th>Alan</th><th></th>
                </tr>
              </thead>
              <tbody>
                {sirali.map(n => {
                  const doldu = n.durum !== 'IMHA' && suresiDolduMu(n.saklamaSonu)
                  return (
                    <React.Fragment key={n.id}>
                      {/* ⚠️ Satıra ayrı bir sınıf VERİLMİYOR: `styles.css`te
                          `is-critical-row` diye bir kural yok ve olmayan bir
                          sınıf yazmak, "vurguladım" sanıp hiçbir şey
                          vurgulamamak olurdu. Uyarı, var olan `is-critical`
                          ile saklama sonu hücresinde duruyor. */}
                      <tr>
                        <td>{n.kod}</td>
                        <td>{n.kalemAd}<br /><small className="muted">{n.kalemKodu}</small></td>
                        <td className="muted">{n.lotKodu}</td>
                        <td>{n.saklamaKosulu}</td>
                        <td className={doldu ? 'is-critical' : ''}>{sureMetni(n)}</td>
                        <td>
                          <span className={`status-pill ${durumSinifi(n.durum)}`}>
                            {NUMUNE_DURUM_ETIKETLERI[n.durum]}
                          </span>
                        </td>
                        <td className="muted">
                          {n.alanKisi ?? '—'}<br />
                          <small>{zamanBicimle(n.alinmaZamani)}</small>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className="btn" type="button" disabled={calisiyor}
                              onClick={() => void olaylariGoster(n.id)}>
                              {acikNumuneId === n.id ? 'Kapat' : 'Geçmiş'}
                            </button>
                            {yazabilir && n.durum === 'SAKLANIYOR' && (
                              <button className="btn" type="button"
                                onClick={() => {
                                  setIslem({ numuneId: n.id, tip: 'ACILDI' })
                                  setGerekce(''); setSonuc('')
                                }}>Aç</button>
                            )}
                            {/* ⚠️ İmha düğmesi yalnız ONAYLAYABİLENE
                                gösteriliyor. Herkese gösterip sunucuya
                                reddettirmek, kullanıcıya önce
                                "yapabilirsin" deyip sonra "yapamazsın"
                                demek olurdu. */}
                            {imhaOnaylayabilir && n.durum !== 'IMHA' && (
                              <button className="btn" type="button"
                                onClick={() => {
                                  setIslem({ numuneId: n.id, tip: 'IMHA' })
                                  setGerekce(''); setSonuc('')
                                }}>İmha</button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {islem?.numuneId === n.id && (
                        <tr>
                          <td colSpan={8}>
                            <div className="stacked-form">
                              <p className="muted" style={{ margin: 0 }}>
                                {islem.tip === 'ACILDI'
                                  ? 'Numune müşteri önünde açılır ve açılış kayda geçer. '
                                    + 'Gerekçe ve sonuç zorunlu.'
                                  : 'İmha bir ONAY işidir ve kayda geçer; imzayı '
                                    + 'sunucu sizin adınıza atıyor. Gerekçe zorunlu. '
                                    + 'İmhadan sonra bu numuneye yeni kayıt eklenemez.'}
                              </p>
                              <div className="form-field">
                                <label>Gerekçe</label>
                                <input value={gerekce} onChange={e => setGerekce(e.target.value)}
                                  placeholder={islem.tip === 'ACILDI'
                                    ? 'Müşteri itirazı, şikâyet numarası'
                                    : 'Saklama süresi doldu, imha tutanağı no'} />
                              </div>
                              {islem.tip === 'ACILDI' && (
                                <div className="form-field">
                                  <label>Açılış sonucu</label>
                                  <input value={sonuc} onChange={e => setSonuc(e.target.value)}
                                    placeholder="Ürün uygun / koku var / renk bozulmuş" />
                                  <small className="muted">
                                    Numunenin bütün amacı bu cümle. Sonuç yazılmazsa
                                    açılış bir şey kanıtlamaz.
                                  </small>
                                </div>
                              )}
                              <div className="form-actions">
                                <button className="btn primary" type="button"
                                  disabled={!islemHazir || calisiyor}
                                  onClick={() => void olayYaz()}>
                                  {calisiyor ? 'İşleniyor…'
                                    : islem.tip === 'ACILDI' ? 'Açılışı Yaz' : 'İmhayı Yaz'}
                                </button>
                                <button className="btn" type="button"
                                  onClick={() => { setIslem(null); setGerekce(''); setSonuc('') }}>
                                  Vazgeç
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {acikNumuneId === n.id && (
                        <tr>
                          <td colSpan={8}>
                            {olaylar.length === 0 ? (
                              <p className="muted" style={{ margin: 0 }}>Kayıt yok.</p>
                            ) : (
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Olay</th><th>Zaman</th><th>Yazan</th>
                                    <th>Gerekçe</th><th>Sonuç</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {olaylar.map(o => (
                                    <tr key={o.id}>
                                      <td>{NUMUNE_OLAY_ETIKETLERI[o.tip]}</td>
                                      <td>{zamanBicimle(o.zaman)}</td>
                                      <td className="muted">{o.yazanKisi ?? '—'}</td>
                                      <td>{o.gerekce ?? '—'}</td>
                                      <td>{o.sonuc ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
