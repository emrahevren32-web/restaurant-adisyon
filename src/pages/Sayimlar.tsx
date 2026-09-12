// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 / Güven katmanı — Sayım ekranı
//
// Yol haritası maddeleri:
//   "Fiziksel sayım → fark hareketi"  → Üstüne yazma yok, fark ayrı kayıt
//   "Sayım kilidi"                    → Sayım sırasında hareket girilemiyor
//
// ── EKRANIN İKİ İDDİASI ──────────────────────────────────────────────────
// 1. Deftere SAYILAN değil FARK yazılıyor. Ekran ikisini yan yana gösteriyor
//    ki kullanıcı ne olduğunu görsün: "defterde 100, saydım 97, fark −3".
// 2. Sayım açıkken o kalemlere hareket YAZILAMIYOR — ve bu bir ekran kuralı
//    değil, veritabanı kuralı. Ekran sadece haber veriyor; engelleyen defter.
//
// ── SAYILMAYAN SATIR ─────────────────────────────────────────────────────
// Boş bırakılmış bir satır "0 sayıldı" DEĞİLDİR. Ekran ikisini ayrı gösterir
// (biri boş, öteki 0) ve sayılmamış satır varken "Uygula" düğmesi kapalıdır.
// Bu, sayım yazılımının yapabileceği en pahalı hatanın önündeki tek engel.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { createStockRepository, resolveStockRepositoryMode } from '../core/stock/index'
import { InMemoryStockItemLookup } from '../core/stock/stock-item-lookup'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import { PostgresStokKatalogu, type KatalogKalemi } from '../warehouse/warehouse.catalog'
import { DepoServisi, type DepoKalemi, type DepoLotu } from '../warehouse/warehouse.service'
import {
  PostgresSayimDeposu, SAYIM_DURUM_ETIKETLERI, SAYIM_GECISLERI,
  type Sayim, type SayimDurumu, type SayimSatiri, type YeniSayimSatiri,
} from '../warehouse/stock-count.repository'
import {
  SayimServisi, satirFarki, sayimOzeti, sonrakiSayimNo, supheliFark,
} from '../warehouse/stock-count.service'

type Props = { currentUser: User }

const sayiBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 })
const bicimle = (d: number) => sayiBicimi.format(d)
const hataMetni = (h: unknown) => (h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.')
const zamanBicimle = (d?: string) => {
  if(!d) return '—'
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleString('tr-TR')
}
const sayiyaCevir = (d: string): number => Number(String(d).replace(',', '.'))

const durumSinifi = (durum: SayimDurumu) =>
  durum === 'APPLIED' ? 'success-pill'
    : durum === 'OPEN' ? 'warning-pill'
      : durum === 'CANCELLED' ? 'muted-pill' : 'info-pill'

const GECIS_ETIKETLERI: Record<SayimDurumu, string> = {
  DRAFT: 'Taslağa al',
  OPEN: 'Sayımı Başlat',
  APPLIED: 'Farkları Deftere Yaz',
  CANCELLED: 'İptal Et',
}

export default function Sayimlar({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  const yazabilir = !currentUser.permissions || currentUser.permissions.includes('stock.write')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [sayimlar, setSayimlar] = React.useState<Sayim[]>([])
  const [kalemler, setKalemler] = React.useState<KatalogKalemi[]>([])
  const [bakiyeler, setBakiyeler] = React.useState<DepoKalemi[]>([])
  const [seciliId, setSeciliId] = React.useState<string | null>(null)
  const [islem, setIslem] = React.useState<'yeni' | null>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [calisiyor, setCalisiyor] = React.useState(false)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const depoServisi = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    const client = getSupabase()
    return new DepoServisi(
      createStockRepository(new InMemoryStockItemLookup([])),
      new PostgresStokKatalogu(client),
    )
  }, [mod])

  const servis = React.useMemo(() => {
    if(!depoServisi) return null
    return new SayimServisi(new PostgresSayimDeposu(getSupabase()), depoServisi)
  }, [depoServisi])

  const yenile = React.useCallback(async (aktif: DepoBaglami) => {
    if(!servis || !depoServisi) return
    const [s, b] = await Promise.all([
      servis.hepsi(aktif.ctx), depoServisi.kalemler(aktif.ctx),
    ])
    setSayimlar(s)
    setBakiyeler(b)
  }, [servis, depoServisi])

  React.useEffect(() => {
    let iptal = false
    if(!servis || !depoServisi){ setYukleniyor(false); return }
    ;(async () => {
      try{
        const kurulan = await depoBaglamiKur(getSupabase())
        if(iptal) return
        setBaglam(kurulan)
        const katalog = new PostgresStokKatalogu(getSupabase())
        const [s, kl, b] = await Promise.all([
          servis.hepsi(kurulan.ctx),
          katalog.kalemler(kurulan.ctx),
          depoServisi.kalemler(kurulan.ctx),
        ])
        if(iptal) return
        setSayimlar(s); setKalemler(kl.filter(k => k.aktif)); setBakiyeler(b)
      } catch (e) { if(!iptal) setHata(hataMetni(e)) }
      finally { if(!iptal) setYukleniyor(false) }
    })()
    return () => { iptal = true }
  }, [servis, depoServisi])

  const secili = sayimlar.find(s => s.id === seciliId) ?? null

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Sayım</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>Sayım kilidi veritabanında duruyor; tarayıcı hafızasında kilit olmaz.</p>
        </section>
      </div>
    )
  }
  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Sayım</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }
  if(!baglam || !servis || !depoServisi){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Sayım</h2></div></div>
        <section className="card empty-state">{hata || 'Çalışma alanı çözülemedi.'}</section>
      </div>
    )
  }

  const sonrasi = async (mesaj: string) => {
    setBilgi(mesaj); setHata(''); setIslem(null)
    await yenile(baglam)
  }

  /**
   * Sayım başlatılırken defterden okunacaklar. İkisi de KİLİTTEN SONRA
   * çağrılır — servis bu sırayı garanti ediyor.
   */
  const baslatmaKaynagi = {
    /** Satırın güncel bakiyesi — lotluysa lottan, değilse kalemden. */
    async bakiye(satir: SayimSatiri): Promise<number> {
      if(satir.lotId){
        const lotlar = await depoServisi.lotBakiyeleri(baglam.ctx, satir.stokKalemiId)
        return lotlar.find(l => l.id === satir.lotId)?.miktar ?? 0
      }
      const kalem = (await depoServisi.kalemler(baglam.ctx))
        .find(k => k.id === satir.stokKalemiId)
      return kalem?.miktar ?? 0
    },
    /** Kalemin tüm lotları — belge hazırlanırken olmayan bir lot doğduysa. */
    async lotlar(stokKalemiId: string){
      const lotlar = await depoServisi.lotBakiyeleri(baglam.ctx, stokKalemiId)
      return lotlar.map(l => ({ lotId: l.id, miktar: l.miktar }))
    },
  }

  const olustur = async (satirlar: YeniSayimSatiri[], not: string) => {
    try{
      const yeni = await servis.ekle(baglam.ctx, {
        sayimNo: sonrakiSayimNo(sayimlar.map(s => s.sayimNo)),
        not: not.trim() || undefined,
        satirlar,
      })
      setSeciliId(yeni.id)
      await sonrasi(`${yeni.sayimNo} hazırlandı. "Sayımı Başlat" deyince kilit devreye girer.`)
    } catch (e) { setHata(hataMetni(e)) }
  }

  const baslat = async (sayim: Sayim) => {
    setCalisiyor(true)
    try{
      const acik = await servis.baslat(baglam.ctx, sayim, baslatmaKaynagi)
      const eklenen = acik.satirlar.length - sayim.satirlar.length
      await sonrasi(
        `${acik.sayimNo} başladı. Bu sayımdaki kalemlere artık hareket YAZILAMAZ; `
        + 'beklenen miktarlar defterden tazelendi.'
        + (eklenen > 0
          ? ` Belge hazırlandıktan sonra doğan ${eklenen} yeni lot listeye eklendi.`
          : ''),
      )
    } catch (e) { setHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  const sayilaniSil = async (sayim: Sayim, satirId: string) => {
    try{
      await servis.sayilaniSil(baglam.ctx, sayim, satirId)
      setHata('')
      await yenile(baglam)
    } catch (e) { setHata(hataMetni(e)) }
  }

  const sayilaniYaz = async (sayim: Sayim, satirId: string, sayilan: number) => {
    try{
      await servis.sayilaniYaz(baglam.ctx, sayim, satirId, sayilan)
      setHata('')
      await yenile(baglam)
    } catch (e) { setHata(hataMetni(e)) }
  }

  const uygula = async (sayim: Sayim) => {
    const ozet = sayimOzeti(sayim)
    if(!window.confirm(
      `${sayim.sayimNo} uygulanacak.\n\n`
      + `${ozet.farkli} satırda fark var (${ozet.fazla} fazla, ${ozet.eksik} eksik).\n`
      + (ozet.supheli > 0
        ? `\n⚠ ${ozet.supheli} satırda fark, defterdeki miktarın 10 katından büyük.\n`
          + 'Ondalık ayracı hatası olabilir (93,237 yerine 93237 gibi).\n'
          + 'Gerçekten böyleyse devam edin; değilse İptal deyip düzeltin.\n'
        : '')
      + '\nDeftere SAYILAN değil FARK yazılacak ve bu işlem geri alınamaz.\n'
      + 'Farkı olmayan satırlar için hareket yazılmaz.',
    )) return

    setCalisiyor(true)
    try{
      const { sayim: guncel, hareketler } = await servis.uygula(baglam.ctx, sayim)
      await sonrasi(
        hareketler.length === 0
          ? `${guncel.sayimNo} uygulandı. Hiç fark çıkmadı — deftere hareket yazılmadı.`
          : `${guncel.sayimNo} uygulandı. ${hareketler.length} fark hareketi deftere `
            + 'yazıldı ve kilit kalktı.',
      )
    } catch (e) { setHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  const iptalEt = async (sayim: Sayim) => {
    if(!window.confirm(
      `${sayim.sayimNo} iptal edilecek.\n\n`
      + 'Deftere HİÇBİR ŞEY yazılmaz ve kilit kalkar. Girilen sayım sonuçları '
      + 'belgede kalır.',
    )) return
    setCalisiyor(true)
    try{
      const guncel = await servis.iptalEt(baglam.ctx, sayim)
      await sonrasi(`${guncel.sayimNo} iptal edildi. Deftere hiçbir şey yazılmadı.`)
    } catch (e) { setHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  const durumIslemi = (sayim: Sayim, durum: SayimDurumu) => {
    if(durum === 'OPEN') return void baslat(sayim)
    if(durum === 'APPLIED') return void uygula(sayim)
    if(durum === 'CANCELLED') return void iptalEt(sayim)
  }

  const acikSayimlar = sayimlar.filter(s => s.durum === 'OPEN')

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Sayım</h2>
          <p className="muted">Aşama 4 · Deftere sayılan değil FARK yazılır</p>
        </div>
        {yazabilir && (
          <button className="btn primary"
            onClick={() => { setIslem('yeni'); setHata(''); setBilgi('') }}>
            Yeni Sayım
          </button>
        )}
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-info">{bilgi}</div>}

      {acikSayimlar.length > 0 && (
        <section className="card">
          <p className="detail-hint is-critical" style={{ margin: 0 }}>
            <strong>
              {acikSayimlar.map(s => s.sayimNo).join(', ')} açık — kilit devrede.
            </strong>{' '}
            Bu sayımlardaki kalemlere mal kabul, üretim ve sevkiyat dahil hiçbir
            hareket yazılamaz. Engelleyen ekran değil, veritabanının kendisi.
          </p>
        </section>
      )}

      <div className="warehouse-layout">
        <section className="card warehouse-main">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sayım</th><th className="num">Satır</th>
                  <th className="num">Fark</th><th>Durum</th><th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {sayimlar.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Henüz sayım yok. Sayım, depodaki fiziksel gerçekle defteri
                      karşılaştırdığınız belgedir: farkı deftere yazar, üstüne
                      yazmaz.
                    </td>
                  </tr>
                )}
                {sayimlar.map(s => {
                  const o = sayimOzeti(s)
                  return (
                    <tr key={s.id}
                      className={s.id === seciliId ? 'is-selected' : ''}
                      onClick={() => { setSeciliId(s.id); setIslem(null) }}>
                      <td>{s.sayimNo}</td>
                      <td className="num">{o.toplam}</td>
                      <td className={`num ${o.farkli > 0 ? 'is-critical' : 'muted'}`}>
                        {o.sayilan === 0 ? '—' : o.farkli}
                      </td>
                      <td>
                        <span className={`status-pill ${durumSinifi(s.durum)}`}>
                          {SAYIM_DURUM_ETIKETLERI[s.durum]}
                        </span>
                      </td>
                      <td className="muted">{zamanBicimle(s.acilisZamani ?? s.olusturmaTarihi)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="warehouse-side">
          {islem === 'yeni' && (
            <section className="card">
              <div className="section-header compact"><h3>Yeni Sayım</h3></div>
              <YeniSayimFormu
                kalemler={kalemler}
                bakiyeler={bakiyeler}
                ctx={baglam.ctx}
                depoServisi={depoServisi}
                onIptal={() => setIslem(null)}
                onKaydet={olustur}
              />
            </section>
          )}

          {!islem && secili && (
            <SayimDetayi
              sayim={secili}
              yazabilir={yazabilir}
              calisiyor={calisiyor}
              onSayilan={(satirId, deger) => { void sayilaniYaz(secili, satirId, deger) }}
              onSayilanSil={satirId => { void sayilaniSil(secili, satirId) }}
              onDurum={durum => durumIslemi(secili, durum)}
            />
          )}

          {!islem && !secili && (
            <section className="card empty-state">
              Bir sayım seçin: defterin ne dediğini, sizin ne saydığınızı ve
              aradaki farkı yan yana göreceksiniz.
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Detay
// ═══════════════════════════════════════════════════════════════════════════

function SayimDetayi({
  sayim, yazabilir, calisiyor, onSayilan, onSayilanSil, onDurum,
}: {
  sayim: Sayim
  yazabilir: boolean
  calisiyor: boolean
  onSayilan: (satirId: string, deger: number) => void
  onSayilanSil: (satirId: string) => void
  onDurum: (durum: SayimDurumu) => void
}){
  const ozet = sayimOzeti(sayim)
  const gecisler = SAYIM_GECISLERI[sayim.durum]
  const suruyor = sayim.durum === 'OPEN'

  return (
    <>
      <section className="card">
        <div className="section-header compact">
          <h3>{sayim.sayimNo}</h3>
          <span className={`status-pill ${durumSinifi(sayim.durum)}`}>
            {SAYIM_DURUM_ETIKETLERI[sayim.durum]}
          </span>
        </div>

        <dl className="detail-grid">
          <dt>Satır</dt>
          <dd>
            {ozet.sayilan} / {ozet.toplam} sayıldı
            {ozet.sayilmayan > 0 && (
              <span className="is-critical"> · {ozet.sayilmayan} satır bekliyor</span>
            )}
          </dd>
          <dt>Fark</dt>
          <dd>
            {ozet.sayilan === 0
              ? <span className="muted">henüz sayım girilmedi</span>
              : ozet.farkli === 0
                ? <span className="muted">fark yok — defter tutuyor</span>
                : <>
                    <strong className="is-critical">{ozet.farkli} satır</strong>
                    <span className="muted">
                      {' · '}{ozet.fazla} fazla, {ozet.eksik} eksik
                    </span>
                  </>}
          </dd>
          {ozet.supheli > 0 && (
            <>
              <dt>Dikkat</dt>
              <dd className="is-critical">
                <strong>{ozet.supheli} satırda</strong> fark, defterdekinin 10
                katından büyük. Ondalık ayracı hatası olabilir —
                <strong> 93,237</strong> yazılacak yere <strong>93237</strong>
                {' '}yazmak farkı bin katına çıkarır.
              </dd>
            </>
          )}
          {sayim.acilisZamani && (
            <><dt>Başladı</dt><dd>{zamanBicimle(sayim.acilisZamani)}</dd></>
          )}
          {sayim.uygulamaZamani && (
            <><dt>Uygulandı</dt><dd>{zamanBicimle(sayim.uygulamaZamani)}</dd></>
          )}
          {sayim.not && (<><dt>Not</dt><dd>{sayim.not}</dd></>)}
        </dl>

        {yazabilir && gecisler.length > 0 && (
          <div className="form-actions">
            {gecisler.map(durum => {
              const engelli = durum === 'APPLIED' && !ozet.tamam
              return (
                <button
                  key={durum}
                  className={durum === 'CANCELLED' ? 'btn' : 'btn primary'}
                  type="button"
                  disabled={calisiyor || engelli}
                  title={engelli
                    ? `${ozet.sayilmayan} satır henüz sayılmadı. Sayılmamış satır `
                      + 'sıfır kabul edilmez.'
                    : undefined}
                  onClick={() => onDurum(durum)}
                >
                  {calisiyor ? 'İşleniyor…' : GECIS_ETIKETLERI[durum]}
                </button>
              )
            })}
          </div>
        )}

        {sayim.durum === 'DRAFT' && (
          <p className="muted detail-hint">
            Henüz kilit yok. "Sayımı Başlat" deyince bu kalemlere hareket
            yazılamaz hale gelir ve beklenen miktarlar <strong>o an</strong>
            defterden tazelenir — taslak beklerken mal girip çıkmış olabilir.
          </p>
        )}
      </section>

      <section className="card">
        <div className="section-header compact">
          <h3>Satırlar</h3>
          <span className="muted">{sayim.satirlar.length} kalem</span>
        </div>
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Kalem</th><th className="num">Defterde</th>
                <th className="num">Sayılan</th><th className="num">Fark</th>
              </tr>
            </thead>
            <tbody>
              {sayim.satirlar.map(satir => (
                <tr key={satir.id}>
                  <td>
                    {satir.stokKalemiAd ?? satir.stokKalemiId}
                    {satir.lotKodu && <div className="muted">{satir.lotKodu}</div>}
                  </td>
                  <td className="num muted">
                    {bicimle(satir.beklenen)} {satir.birim}
                  </td>
                  {suruyor && yazabilir
                    ? <SayilanVeFark
                        satir={satir}
                        onKaydet={d => onSayilan(satir.id, d)}
                        onTemizle={() => onSayilanSil(satir.id)}
                      />
                    : <OkunurSayilanVeFark satir={satir} />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted detail-hint">
          <strong>Boş bir hücre "0 sayıldı" demek değildir.</strong> Sayılmamış
          satır varken sayım uygulanamaz — çünkü sayılmayanı sıfır saymak, o
          malın tamamını zayi yazmak olurdu. Gerçekten hiç bulunamadıysa
          <strong> 0 yazın</strong>; o ayrı bir bilgidir ve deftere geçer.
        </p>
      </section>
    </>
  )
}

/** Sayılmamış / okunur satırın sayılan + fark hücreleri. */
function OkunurSayilanVeFark({ satir }: { satir: SayimSatiri }){
  const fark = satirFarki(satir)
  return (
    <>
      <td className="num">
        {satir.sayilan === undefined
          ? <span className="muted">sayılmadı</span>
          : bicimle(satir.sayilan)}
      </td>
      <FarkHucresi fark={fark} supheli={supheliFark(satir)}
        satir={satir} yazilan={satir.sayilan} />
    </>
  )
}

/**
 * Fark hücresi.
 *
 * ── UYARI NEDEN BU KADAR AÇIK SÖZLÜ ──────────────────────────────────────
 * Türkçe biçimde NOKTA binlik, VİRGÜL ondalık ayracıdır — klavyeden yazılan
 * ham sayının tam tersi. Defterde "93,237 kg" (doksan üç kilo iki yüz otuz
 * yedi gram) yazarken kullanıcı virgülü atlayıp "93237" yazarsa doksan üç bin
 * kilo demiş olur. Ekranda iki değer tek karakterle ayrılır ve kimse fark
 * etmez.
 *
 * Bu yüzden uyarı "bir hata olabilir" demiyor; İKİ RAKAMI DA yan yana yazıp
 * hangi tuşun unutulduğunu söylüyor. Kullanıcının bir çeviri yapması
 * gerekmiyor.
 */
function FarkHucresi({
  fark, supheli, satir, yazilan,
}: {
  fark: number | null
  supheli: boolean
  satir: SayimSatiri
  yazilan?: number
}){
  const sinif = fark === null || fark === 0 ? 'muted' : 'is-critical'
  return (
    <td className={`num ${sinif}`}>
      {fark === null ? '—' : fark === 0 ? '0' : `${fark > 0 ? '+' : ''}${bicimle(fark)}`}
      {supheli && yazilan !== undefined && (
        <div className="is-critical"
          style={{ fontSize: '0.78em', fontWeight: 700, textAlign: 'right', marginTop: 4 }}>
          ⚠ <strong>{bicimle(yazilan)} {satir.birim}</strong> yazdınız.<br />
          Defterde <strong>{bicimle(satir.beklenen)} {satir.birim}</strong> var.
          {Number.isInteger(yazilan) && !Number.isInteger(satir.beklenen) && (
            <> Virgülü unutmuş olabilirsiniz.</>
          )}
        </div>
      )}
    </td>
  )
}

/**
 * Sayılan miktar kutusu + fark hücresi.
 *
 * ── NEDEN İKİSİ TEK BİLEŞENDE ────────────────────────────────────────────
 * Fark, yazılan rakamın ANINDA karşılığını göstermeli. Eskiden fark yalnızca
 * kaydedilmiş değerden hesaplanıyordu; kullanıcı yazarken fark sütunu eski
 * rakamı gösteriyordu ve ancak başka yere tıklayınca güncelleniyordu. Yazarken
 * yanlış bir fark görmek, doğru yazdığını sanmaya yol açar.
 *
 * ── NEDEN type="text" ────────────────────────────────────────────────────
 * Ekran Türkçe biçimle yazıyor: "93,237 kg". Kullanıcı bunu okuyup virgülle
 * yazmak ister — ama `type="number"` Türkçe olmayan yerelde virgülü reddeder
 * ve kullanıcı virgülsüz yazar: 93237. Bu, bin katı bir fark demektir.
 * `inputMode="decimal"` telefonda sayı klavyesini yine açar; ayracı biz
 * çözeriz, tarayıcının yereline bırakmayız.
 *
 * ── KUTUYU BOŞALTMAK ─────────────────────────────────────────────────────
 * Boş bırakmak açık bir işlemdir: sonuç silinir, satır "sayılmadı"ya döner.
 * Boş ≠ 0. 0 = "aradım, bulamadım" (deftere geçer); boş = "henüz saymadım"
 * (uygulamayı durdurur).
 */
function SayilanVeFark({
  satir, onKaydet, onTemizle,
}: { satir: SayimSatiri; onKaydet: (d: number) => void; onTemizle: () => void }){
  const kayitli = satir.sayilan
  const [metin, setMetin] = React.useState(kayitli === undefined ? '' : String(kayitli))
  React.useEffect(() => { setMetin(kayitli === undefined ? '' : String(kayitli)) }, [kayitli])

  const t = metin.trim()
  const yazilan = t === '' ? undefined : sayiyaCevir(t)
  const gecerli = yazilan !== undefined && Number.isFinite(yazilan) && yazilan >= 0
  // Fark YAZILANDAN hesaplanıyor, kayıtlıdan değil: ekran ile klavye aynı anı
  // göstersin.
  const canliSatir: SayimSatiri = gecerli ? { ...satir, sayilan: yazilan } : { ...satir, sayilan: undefined }
  const fark = satirFarki(canliSatir)

  return (
    <>
      <td className="num">
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
        <input
          type="text" inputMode="decimal"
          value={metin}
          // Boş kutunun ipucu, DEFTERDEKİ rakamın kendisi: kullanıcı hangi
          // yazımı beklediğimizi tahmin etmek zorunda kalmasın. "93,237"
          // gördüğü an virgülün oraya ait olduğunu anlar.
          placeholder={bicimle(satir.beklenen)}
          aria-label={`Sayılan miktar (${satir.birim})`}
          style={{ maxWidth: '110px', textAlign: 'right' }}
          onChange={e => setMetin(e.target.value)}
          onBlur={() => {
            if(t === ''){
              if(kayitli !== undefined) onTemizle()
              return
            }
            if(!gecerli){
              // Anlamsız metni sessizce kabul etmiyoruz; kutuyu son geçerli
              // değere döndürüyoruz ki ekran ile belge ayrışmasın.
              setMetin(kayitli === undefined ? '' : String(kayitli))
              return
            }
            if(yazilan !== kayitli) onKaydet(yazilan)
          }}
          onKeyDown={e => { if(e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        />
        {/* Birim kutunun yanında: "93237" ile "93237 kg" ekranda aynı şey
            değildir; birimi görmek büyüklük hatasını fark ettirir. */}
        <span className="muted" style={{ fontSize: '0.85em' }}>{satir.birim}</span>
        </span>
        {t !== '' && !gecerli && (
          <div className="is-critical" style={{ fontSize: '0.78em' }}>geçerli sayı değil</div>
        )}
      </td>
      <FarkHucresi fark={fark} supheli={gecerli && supheliFark(canliSatir)}
        satir={satir} yazilan={gecerli ? yazilan : undefined} />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Yeni sayım formu
// ═══════════════════════════════════════════════════════════════════════════

function YeniSayimFormu({
  kalemler, bakiyeler, ctx, depoServisi, onIptal, onKaydet,
}: {
  kalemler: KatalogKalemi[]
  bakiyeler: DepoKalemi[]
  ctx: DepoBaglami['ctx']
  depoServisi: DepoServisi
  onIptal: () => void
  onKaydet: (satirlar: YeniSayimSatiri[], not: string) => Promise<void>
}){
  const [secilenler, setSecilenler] = React.useState<Set<string>>(new Set())
  const [not, setNot] = React.useState('')
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  const degistir = (id: string) => setSecilenler(o => {
    const y = new Set(o)
    if(y.has(id)) y.delete(id); else y.add(id)
    return y
  })

  return (
    <form
      className="stacked-form"
      onSubmit={async e => {
        e.preventDefault()
        setGonderiliyor(true)
        try{
          // Lot takipli kalemde HER PARTİ ayrı satır. "Toplam 40 kg saydım"
          // yetmez: hangi partiden kaç kaldığı bilinmezse FEFO çalışamaz.
          const satirlar: YeniSayimSatiri[] = []
          for(const id of secilenler){
            const kalem = kalemler.find(k => k.id === id)
            if(!kalem) continue
            if(kalem.lotTakipli){
              const lotlar: DepoLotu[] = await depoServisi.lotBakiyeleri(ctx, id)
              // Bakiyesi sıfırlanmış lot sayılmaz — orada mal yok.
              lotlar.filter(l => l.miktar !== 0).forEach(l => satirlar.push({
                stokKalemiId: id, lotId: l.id,
                beklenen: l.miktar, birim: kalem.temelBirim,
              }))
            } else {
              satirlar.push({
                stokKalemiId: id,
                beklenen: bakiyeler.find(b => b.id === id)?.miktar ?? 0,
                birim: kalem.temelBirim,
              })
            }
          }
          await onKaydet(satirlar, not)
        } finally { setGonderiliyor(false) }
      }}
    >
      <div className="form-actions">
        <button className="btn" type="button"
          onClick={() => setSecilenler(new Set(kalemler.map(k => k.id)))}>
          Hepsini seç
        </button>
        <button className="btn" type="button" onClick={() => setSecilenler(new Set())}>
          Temizle
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table compact">
          <thead>
            <tr><th></th><th>Kalem</th><th className="num">Defterde</th></tr>
          </thead>
          <tbody>
            {kalemler.map(k => (
              <tr key={k.id}>
                <td>
                  <input type="checkbox" style={{ width: 'auto', minHeight: 0 }}
                    checked={secilenler.has(k.id)} onChange={() => degistir(k.id)} />
                </td>
                <td>
                  {k.ad}
                  {k.lotTakipli && <div className="muted">partiler ayrı sayılır</div>}
                </td>
                <td className="num muted">
                  {bicimle(bakiyeler.find(b => b.id === k.id)?.miktar ?? 0)} {k.temelBirim}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label>
        Not
        <input value={not} onChange={e => setNot(e.target.value)}
          placeholder="Dönem sonu sayımı, kim saydı…" />
      </label>

      <p className="muted detail-hint">
        Seçilen kalemler için satır açılır. <strong>Kilit henüz kurulmaz</strong> —
        sayımı başlatınca kurulur ve beklenen miktarlar o an tazelenir.
      </p>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>Vazgeç</button>
        <button className="btn primary" type="submit"
          disabled={gonderiliyor || secilenler.size === 0}>
          {gonderiliyor ? 'Hazırlanıyor…' : `Sayım Aç (${secilenler.size} kalem)`}
        </button>
      </div>
    </form>
  )
}
