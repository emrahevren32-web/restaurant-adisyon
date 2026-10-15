// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C2 — Siparişler ekranı
//
// Emrah'ın cümlesi: "Sonradan kimse 'ben bunu istiyordum, eksik hazırlanmış,
// fazla gelmiş' diyemesin."
//
// Bu ekranın kalbi sol taraftaki liste değil, sağdaki DEĞİŞİKLİK GEÇMİŞİ:
// "200 kg → 150 kg", kim, ne zaman, hangi kaynaktan. O panel olmasa bu ekran
// sıradan bir sipariş formu olurdu.
//
// ⚠️ Kuralları bu ekran UYGULAMIYOR. Uygulayan 0050'nin tetikleri; servis
// iyi mesaj veriyor; ekran yalnız gösteriyor ve hangi düğmenin görüneceğini
// biliyor. Sunucudan gelen MI403/MI422/MI425 savunmanın çalıştığının
// kanıtıdır, ekranın hatası değil.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { yazabilirMi } from '../authorization/yazma-yetkisi'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { createStockRepository, resolveStockRepositoryMode } from '../core/stock/index'
import { InMemoryStockItemLookup } from '../core/stock/stock-item-lookup'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import {
  PostgresStokKatalogu, type Birim, type KatalogKalemi, type KatalogLotu,
} from '../warehouse/warehouse.catalog'
import { DepoServisi } from '../warehouse/warehouse.service'
import {
  PostgresMusteriDeposu, type Musteri, type TeslimNoktasi,
} from '../customers/customer.repository'
import {
  PostgresSiparisDeposu,
  type Fark, type FarkAdimi, type FarkKarari, type FarkTuru,
  type Onay, type OnayAdimi, type OnayKarari,
  type Revizyon, type RevizyonKaynagi, type Siparis, type SiparisDurumu,
  type SiparisSatiri, type YeniFark, type YeniRevizyon, type YeniSatir,
  type YeniSiparis,
} from '../sales/sales-order.repository'
import {
  IZINLI_GECISLER, SEVK_SONRASI, SiparisServisi,
  farkiYaz, onayDurumu, onayOzeti, onayTamamMi, revizyonFarki,
  siparisNoCakistiMi, siparisleriSuz, sonrakiSiparisNo, sozGecikmesi,
  type AdimDurumu,
} from '../sales/sales-order.service'
import {
  TURETILEBILIR_DURUMLAR, sevkOzeti, sevkToplami, sevkiyatTuret,
  type KalemSevkDurumu,
} from '../sales/sales-order-shipment'
import { PostgresSevkiyatDeposu, type Sevkiyat } from '../production/shipment.repository'
import { SevkiyatServisi, sonrakiSevkiyatNo } from '../production/shipment.service'
import { irsaliyeHtml } from '../production/shipment-documents'
import { belgeYazdir } from '../core/print/print'
import {
  irsaliyeBelgeBasligi, irsaliyeOzeti, irsaliyeUyarisi, siparisIrsaliyeleri,
  type SiparisIrsaliyesi,
} from '../sales/sales-order-waybill'
import {
  isEmirleriTuret, karsilamaOzeti, karsilamaToplami, type KarsilamaSatiri,
} from '../sales/sales-order-production'
import {
  teslimCumlesi,
  teslimOzeti,
  teslimSatirlari,
  uretimCumlesi,
  type TeslimFarkiSatiri,
} from '../sales/sales-order-delivery'
import { sayiOku, sayiYazarken } from '../core/sayi-girisi'
import { PostgresIsEmriDeposu } from '../production/work-order.repository'
import { PostgresReceteDeposu, type Recete } from '../production/recipe.repository'

type Props = { currentUser: User }

const hataMetni = (h: unknown) =>
  h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.'

const bugun = () => new Date().toLocaleDateString('sv-SE')
const tarih = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('tr-TR') : '—')
const zaman = (d: string) => new Date(d).toLocaleString('tr-TR')
const sayiYaz = (n: number) => n.toLocaleString('tr-TR')

/**
 * Kalem adı yoksa ham kimlik basmak yerine NE OLDUĞUNU söylüyoruz.
 *
 * 04.10.2026: Sevk durumu sekmesi "8a8a4988-fa77-46f9-a9ea-28b4cbc22d5c"
 * basıyordu — ekranı okuyan için hiçbir şey ifade etmeyen 36 karakter.
 * Sebebi `siparis_sevk_durumu`nun ad döndürmemesiydi; 0062 ile düzeldi.
 *
 * Ad yine de gelmeyebilir: kalem kartı SİLİNMİŞSE. O zaman "bulunamadı"
 * demek, uuid basmaktan dürüst — ve kimliğin baş harfleri destek için
 * yeterli.
 */
const kalemYaz = (ad: string | undefined, id: string) =>
  ad ?? `Kalem kaydı bulunamadı (${id.slice(0, 8)}…)`

const KAYNAKLAR: RevizyonKaynagi[] =
  ['Telefon', 'Portal', 'E-posta', 'WhatsApp', 'Yüz Yüze', 'Sistem']
const FARK_TURLERI: FarkTuru[] = ['Eksik', 'Fazla', 'Hasarlı', 'Yanlış ürün']
const FARK_ADIMLARI: FarkAdimi[] =
  ['Üretim', 'Paketleme', 'Yükleme', 'Yolda', 'Teslimde', 'Müşteri bildirdi', 'Sayımda']
const ONAY_KARARLARI: OnayKarari[] = ['Olumlu', 'Şartlı', 'Olumsuz']
const KARARLAR: FarkKarari[] = ['Tamamlanacak', 'Sorumlu Bulundu', 'Müşteri Hatası', 'Diğer']

const DURUM_ROZETI: Record<SiparisDurumu, string> = {
  'Taslak': 'muted-pill', 'Onay Bekliyor': 'warning-pill',
  'Onaylandı': 'r-bilgi', 'Hazırlanıyor': 'r-bilgi',
  'Hazır': 'success-pill', 'Kısmi Sevk': 'warning-pill', 'Sevk Edildi': 'success-pill',
  'Teslim Edildi': 'success-pill', 'İptal': 'muted-pill',
}

type SatirTaslagi = { kalemId: string; miktar: string; birim: string; fiyat: string }

const bosSatir = (): SatirTaslagi => ({ kalemId: '', miktar: '', birim: '', fiyat: '' })

// ⚠️ Ekrandaki metin Türkçe biçimdedir ("12.450,75"). Okuma işi
// `core/sayi-girisi.ts`e devredildi: noktayı ondalık sanan bir okuyucu
// 12.450'yi on iki buçuk diye kaydeder ve belgeyi bin kat küçültür.
const sayiya = (d: string): number => sayiOku(d) ?? 0

const taslaktanSatir = (t: SatirTaslagi): YeniSatir => ({
  kalemId: t.kalemId,
  miktar: sayiya(t.miktar),
  birim: t.birim,
  // Boş fiyat 0 DEĞİL: sıfır "bedava" demektir, boşluk "yazılmadı".
  birimFiyat: sayiOku(t.fiyat),
})

export default function Siparisler({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  // ⚠️ 14.10 · FAIL-OPEN KALDIRILDI. Önceki hâl şuydu:
  //     !currentUser.permissions || currentUser.permissions.includes(...)
  // Yani izin listesi YÜKLENMEMİŞSE kullanıcı yazabiliyordu. 12.10'da
  // `normalizeUser`ın listeyi düşürdüğü hata tam buraya bağlanıyordu
  // (tuzak 71): liste kaybolunca kapı açılıyordu. Kapının bilmediği
  // durumda AÇIK kalması, kapı olmaması demektir.
  const yazabilir = yazabilirMi(currentUser, 'operations.write')

  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [siparisler, setSiparisler] = React.useState<Siparis[]>([])
  const [musteriler, setMusteriler] = React.useState<Musteri[]>([])
  const [noktalar, setNoktalar] = React.useState<TeslimNoktasi[]>([])
  const [kalemler, setKalemler] = React.useState<KatalogKalemi[]>([])
  const [birimler, setBirimler] = React.useState<Birim[]>([])
  const [arama, setArama] = React.useState('')
  const [durumSuzgeci, setDurumSuzgeci] = React.useState<SiparisDurumu | 'hepsi'>('hepsi')
  const [secili, setSecili] = React.useState<Siparis | null>(null)
  const [satirlar, setSatirlar] = React.useState<SiparisSatiri[]>([])
  const [revizyonlar, setRevizyonlar] = React.useState<Revizyon[]>([])
  const [farklar, setFarklar] = React.useState<Fark[]>([])
  const [sekme, setSekme] = React.useState<
    'satirlar' | 'onay' | 'karsilama' | 'sevk' | 'teslim' | 'gecmis' | 'farklar'>('satirlar')
  const [teslim, setTeslim] = React.useState<TeslimFarkiSatiri[]>([])
  // Bu siparişin sevkiyat BELGELERİ (0051'deki `shipment.order_id` bağı).
  // İrsaliye bu listeden basılıyor.
  const [sevkiyatlar, setSevkiyatlar] = React.useState<Sevkiyat[]>([])
  // Hangi sevkiyatın irsaliyesi hazırlanıyor — düğme iki kez basılmasın.
  const [irsaliyeBasiliyor, setIrsaliyeBasiliyor] = React.useState('')
  const [karsilama, setKarsilama] = React.useState<KarsilamaSatiri[]>([])
  const [adimlar, setAdimlar] = React.useState<OnayAdimi[]>([])
  const [onaylar, setOnaylar] = React.useState<Onay[]>([])
  const [sevkDurumu, setSevkDurumu] = React.useState<KalemSevkDurumu[]>([])
  const [islem, setIslem] = React.useState<'yeni' | 'revizyon' | 'fark' | null>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const servis = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new SiparisServisi(new PostgresSiparisDeposu(getSupabase()))
  }, [mod])

  const musteriDeposu = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new PostgresMusteriDeposu(getSupabase())
  }, [mod])

  const sevkiyatDeposu = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new PostgresSevkiyatDeposu(getSupabase())
  }, [mod])

  /**
   * İrsaliyeyi basabilmek için sevkiyatın DEFTERDEKİ hareketleri gerekiyor:
   * hangi partiden ne kadar gittiği yalnızca orada yazılı (belgede yazmaz,
   * çünkü FEFO bir çıkışı bölebilir). `SevkiyatServisi.hareketleri` o işi
   * yapıyor; ekran kendi başına defter okumuyor.
   */
  const sevkiyatServisi = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    const client = getSupabase()
    return new SevkiyatServisi(
      new PostgresSevkiyatDeposu(client),
      new DepoServisi(
        createStockRepository(new InMemoryStockItemLookup([])),
        new PostgresStokKatalogu(client),
      ),
    )
  }, [mod])

  const uretimDepolari = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    const c = getSupabase()
    return { isEmri: new PostgresIsEmriDeposu(c), recete: new PostgresReceteDeposu(c) }
  }, [mod])

  const ayrintiYukle = React.useCallback(async (s: Siparis, b: DepoBaglami) => {
    if(!servis) return
    const [r, f, sd, on, kp, tf, sv] = await Promise.all([
      servis.revizyonlar(b.ctx, s.id),
      servis.farklar(b.ctx, s.id),
      servis.sevkDurumu(b.ctx, s.id),
      servis.onaylar(b.ctx, s.id),
      servis.karsilamaPlani(b.ctx, s.id),
      servis.teslimFarki(b.ctx, s.id),
      // ⚠️ Süzme BURADA değil `siparisIrsaliyeleri`de: kuralı ekranın içine
      // gömseydik test edemezdik. Depo hepsini veriyor, saf işlev süzüyor.
      sevkiyatDeposu ? sevkiyatDeposu.hepsi(b.ctx) : Promise.resolve([]),
    ])
    setSevkiyatlar(sv)
    setRevizyonlar(r)
    setFarklar(f)
    setSevkDurumu(sd)
    setOnaylar(on)
    setKarsilama(kp)
    setTeslim(tf)
    // Güncel satırlar = en son SATIRLI revizyon. Kuralı burada yeniden
    // yazmıyoruz: servis okunan revizyonlardan seçiyor.
    const satirli = r.filter(x => x.satirlar.length > 0)
    setSatirlar(satirli.length === 0 ? [] : satirli[satirli.length - 1].satirlar)
  }, [servis, sevkiyatDeposu])

  React.useEffect(() => {
    let iptal = false
    if(!servis || !musteriDeposu){ setYukleniyor(false); return }

    ;(async () => {
      try{
        const kurulan = await depoBaglamiKur(getSupabase())
        if(iptal) return
        setBaglam(kurulan)
        const katalog = new PostgresStokKatalogu(getSupabase())
        const [sp, ms, ns, kl, ad, br] = await Promise.all([
          servis.hepsi(kurulan.ctx),
          musteriDeposu.hepsi(kurulan.ctx),
          musteriDeposu.noktalar(kurulan.ctx),
          katalog.kalemler(kurulan.ctx),
          servis.onayAdimlari(kurulan.ctx),
          // ⚠️ Birim listesi KATALOGDAN geliyor, ekranda sabit yazılmıyor.
          // Sabit yazsaydık 0059'da eklenen palet/çuval burada görünmezdi ve
          // iki liste sessizce ayrışırdı.
          katalog.birimler(),
        ])
        if(iptal) return
        setAdimlar(ad)
        setSiparisler(sp)
        setMusteriler(ms.filter(m => m.aktif))
        setNoktalar(ns.filter(n => n.aktif))
        setKalemler(kl.filter(k => k.aktif))
        setBirimler(br)
      } catch (e) {
        if(!iptal) setHata(hataMetni(e))
      } finally {
        if(!iptal) setYukleniyor(false)
      }
    })()

    return () => { iptal = true }
  }, [servis, musteriDeposu])

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Siparişler</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>Sipariş bir defterdir; veritabanı bağlantısı olmadan açılmaz.</p>
        </section>
      </div>
    )
  }

  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Siparişler</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }

  if(!baglam){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Siparişler</h2></div></div>
        <section className="card empty-state">{hata || 'Çalışma alanı çözülemedi.'}</section>
      </div>
    )
  }

  const gorunen = siparisleriSuz(siparisler, arama, durumSuzgeci)
  const acikFark = farklar.filter(f => f.durum !== 'Karara Bağlandı')

  const yenile = async (seciliId?: string) => {
    if(!servis) return
    const liste = await servis.hepsi(baglam.ctx)
    setSiparisler(liste)
    const hedef = liste.find(s => s.id === (seciliId ?? secili?.id)) ?? null
    setSecili(hedef)
    if(hedef) await ayrintiYukle(hedef, baglam)
  }

  const sec = async (s: Siparis) => {
    setSecili(s); setIslem(null); setHata(''); setSekme('satirlar')
    try { await ayrintiYukle(s, baglam) } catch (e) { setHata(hataMetni(e)) }
  }

  /**
   * Sipariş açma. Numara sistem üretiyor; çakışırsa BİR KEZ yeniden
   * hesaplayıp deniyoruz (iki kişi aynı anda açtıysa). İkinci kez de
   * çakışırsa tahmin etmek yerine kullanıcıya söylüyoruz.
   */
  const siparisAc = async (girdi: YeniSiparis) => {
    try{
      let yeni: Siparis
      try {
        yeni = await servis!.ekle(baglam.ctx, girdi)
      } catch (e) {
        if(!siparisNoCakistiMi(e)) throw e
        const guncel = await servis!.hepsi(baglam.ctx)
        yeni = await servis!.ekle(baglam.ctx, {
          ...girdi, siparisNo: sonrakiSiparisNo(guncel.map(s => s.siparisNo)),
        })
      }
      setBilgi(`${yeni.siparisNo} açıldı. Taslak durumunda — onaylayınca hazırlığa girer.`)
      setHata(''); setIslem(null)
      await yenile(yeni.id)
    } catch (e) { setHata(hataMetni(e)) }
  }

  const durumDegistir = async (yeni: SiparisDurumu) => {
    if(!secili) return
    try{
      await servis!.durumDegistir(baglam.ctx, secili, yeni)
      setBilgi(`${secili.siparisNo} → ${yeni}`)
      setHata('')
      await yenile()
    } catch (e) { setHata(hataMetni(e)) }
  }

  const revizyonAc = async (girdi: YeniRevizyon) => {
    if(!secili) return
    try{
      await servis!.revizyonEkle(baglam.ctx, secili, girdi)
      setBilgi('Revizyon deftere yazıldı. Eski hâli geçmişte duruyor.')
      setHata(''); setIslem(null); setSekme('gecmis')
      await yenile()
    } catch (e) { setHata(hataMetni(e)) }
  }

  const farkAc = async (girdi: YeniFark) => {
    try{
      await servis!.farkAc(baglam.ctx, girdi)
      setBilgi('Fark kaydı açıldı. İncelenip karara bağlanması gerekiyor.')
      setHata(''); setIslem(null); setSekme('farklar')
      await yenile()
    } catch (e) { setHata(hataMetni(e)) }
  }

  const kararVer = async (farkId: string, karar: FarkKarari, not: string, sorumluId?: string) => {
    try{
      await servis!.farkiKararaBagla(baglam.ctx, farkId, { karar, kararNotu: not, sorumluId })
      setBilgi('Fark karara bağlandı.')
      setHata('')
      await yenile()
    } catch (e) { setHata(hataMetni(e)) }
  }

  /**
   * Onay zincirine bir karar yazar.
   *
   * ⚠️ Kararı VEREN kişi formdan gelmiyor, oturumdan geliyor. Farkta olduğu
   * gibi: bir isim alanı koysaydık herkes herkesin adına onay verebilirdi ve
   * zincirin hiçbir anlamı kalmazdı.
   */
  const onayVer = async (adimKodu: string, karar: OnayKarari, not: string, sozTarihi: string) => {
    if(!secili || !servis || !baglam) return
    try{
      await servis.onayVer(baglam.ctx, {
        siparisId: secili.id,
        // ⚠️ GÜNCEL revizyon. 200 koliyi onaylamak, 350 koliyi onaylamak
        // değildir; karar hangi revizyonu onayladığını taşımak zorunda.
        revizyonNo: secili.guncelRevizyon,
        adimKodu, karar,
        ...(not.trim() ? { not: not.trim() } : {}),
        ...(sozTarihi ? { sozTarihi } : {}),
      })
      setHata(''); setBilgi('Karar kaydedildi.')
      await yenile(secili.id)
    } catch (e) { setBilgi(''); setHata(hataMetni(e)) }
  }

  /**
   * Üretilmesi gereken kalemler için iş emri TASLAKLARI çıkarır.
   *
   * ⚠️ Taslak, üretim DEĞİL. Malzeme yeterliliği ve başlatma Üretim
   * ekranında; oradaki kontrolü atlarsak olmayan malzemeyle üretim
   * başlatmış oluruz.
   */
  const isEmriCikar = async () => {
    if(!secili || !uretimDepolari || !baglam) return
    try{
      // Reçeteleri ÖNCE okuyoruz: biri okunamazsa hiç iş emri açmıyoruz.
      // Yarısı açılmış bir plan, hiç açılmamıştan kötüdür.
      const gerekli = [...new Set(
        karsilama.filter(k => (k.uretilecek ?? 0) > 0 && k.uretilebilir && k.receteId)
          .map(k => k.receteId as string),
      )]
      const okunan = await Promise.all(
        gerekli.map(id => uretimDepolari.recete.tekil(baglam.ctx, id)),
      )
      const receteler = new Map<string, Recete>(okunan.map(r => [r.id, r]))

      const mevcut = await uretimDepolari.isEmri.hepsi(baglam.ctx)
      const turetilen = isEmirleriTuret(
        secili, karsilama, receteler, mevcut.map(x => x.isEmriNo),
      )
      for(const t of turetilen){
        await uretimDepolari.isEmri.ekle(baglam.ctx, t.girdi)
      }
      setHata('')
      setBilgi(
        `${turetilen.length} iş emri taslağı oluşturuldu ve bu siparişe bağlandı: `
        + turetilen.map(t => `${t.girdi.isEmriNo} (${t.kalemAdi})`).join(', ')
        + '. Üretim ekranından başlatın.',
      )
      await yenile(secili.id)
    } catch (e) { setBilgi(''); setHata(hataMetni(e)) }
  }

  /**
   * Bu siparişin bir sevkiyatının İRSALİYESİNİ basar.
   *
   * ⚠️ Belgeyi bu ekran ÜRETMİYOR: `irsaliyeHtml` üretiyor, Sevkiyatlar
   * ekranındaki ile AYNI işlev. İkinci bir kopya yazsaydık biri düzeltilip
   * öteki unutulurdu; aynı siparişin iki farklı kâğıdı çıkardı.
   *
   * ⚠️ Partiler DEFTERDEN geliyor, belgeden değil. Sevkiyat belgesinde parti
   * yazmaz — FEFO bir çıkışı iki partiye bölebildiği için orada tek bir doğru
   * cevap yoktur. Hangi partiden ne kadar gittiği yalnız hareketlerde yazılı.
   */
  const irsaliyeYazdir = async (irsaliye: SiparisIrsaliyesi) => {
    if(!sevkiyatServisi || !baglam || !secili) return
    const belge = sevkiyatlar.find(x => x.id === irsaliye.sevkiyatId)
    if(!belge) return

    setIrsaliyeBasiliyor(irsaliye.sevkiyatId)
    setHata(''); setBilgi('')
    try{
      const hareketler = await sevkiyatServisi.hareketleri(baglam.ctx, belge)

      // Hareket yalnız lot KİMLİĞİNİ taşıyor; kâğıda basılacak parti KODU
      // katalogdan okunuyor. Kod yerine kimlik basmak, müşteriye hiçbir şey
      // ifade etmeyen bir uuid vermek olurdu.
      const katalog = new PostgresStokKatalogu(getSupabase())
      const kalemIdleri = [...new Set<string>(belge.satirlar.map(x => x.stokKalemiId))]
      const listeler = await Promise.all(
        kalemIdleri.map(id => katalog.lotlar(baglam.ctx, id)),
      )
      const lotlar: KatalogLotu[] = listeler.flat()

      belgeYazdir(
        irsaliyeBelgeBasligi(secili.siparisNo, belge.sevkiyatNo),
        irsaliyeHtml(belge, hareketler, {
          kalemAdi: id => kalemler.find(k => k.id === id)?.ad ?? id,
          temelBirim: id => kalemler.find(k => k.id === id)?.temelBirim ?? '',
          lotKodu: lotId => (lotId ? (lotlar.find(l => l.id === lotId)?.kod ?? '—') : '—'),
          firmaAdi: baglam.subeler.find(sb => sb.id === baglam.ctx.branchId)?.ad,
        }),
      )
    } catch (e) { setHata(hataMetni(e)) }
    finally { setIrsaliyeBasiliyor('') }
  }

  /**
   * Siparişin KALANINDAN bir sevkiyat TASLAĞI çıkarır.
   *
   * ⚠️ Taslak, sevk DEĞİL. Malın deftere çıkış yazılması ve stok yeterliliği
   * Sevkiyatlar ekranında; oradaki kontrolü atlarsak olmayan malı sevk
   * etmiş oluruz. Buradaki iş yalnızca "ne kadar kaldı" sorusunu elle
   * yazdırmamak.
   */
  const sevkiyataCikar = async () => {
    if(!secili || !sevkiyatDeposu || !baglam) return
    try{
      const mevcut = await sevkiyatDeposu.hepsi(baglam.ctx)
      const girdi = sevkiyatTuret(
        secili, sevkDurumu, sonrakiSevkiyatNo(mevcut.map(x => x.sevkiyatNo)),
      )
      const olusan = await sevkiyatDeposu.ekle(baglam.ctx, girdi)
      setHata('')
      setBilgi(
        `${olusan.sevkiyatNo} sevkiyat taslağı oluşturuldu ve bu siparişe `
        + 'bağlandı. Sevkiyatlar ekranından sevk edin — sipariş durumu o an '
        + 'kendiliğinden ilerleyecek.',
      )
      await yenile(secili.id)
    } catch (e) { setBilgi(''); setHata(hataMetni(e)) }
  }

  // Zincirin durumu iki yerde lazım: onay paneli ve "Onaylandı" düğmesi.
  // İki kez hesaplamak, iki farklı cevap üretme riskidir.
  const zincirDurumu = secili
    ? onayDurumu(adimlar, onaylar, secili.guncelRevizyon)
    : []
  const zincirTamam = onayTamamMi(zincirDurumu)

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Siparişler</h2>
          <p className="muted">
            Aşama 4C · Sipariş bir defterdir: değişiklik üstüne yazılmaz, yeni
            revizyon olur
          </p>
        </div>
        {yazabilir && (
          <div className="form-actions">
            <button
              className="btn primary" type="button"
              onClick={() => { setIslem('yeni'); setHata('') }}
            >
              Yeni Sipariş
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
              type="search" value={arama}
              placeholder="Sipariş no, müşteri veya teslim noktası"
              aria-label="Sipariş ara"
              onChange={e => setArama(e.target.value)}
            />
            <select
              value={durumSuzgeci}
              aria-label="Durum süzgeci"
              onChange={e => setDurumSuzgeci(e.target.value as SiparisDurumu | 'hepsi')}
            >
              <option value="hepsi">Bütün durumlar</option>
              {(Object.keys(IZINLI_GECISLER) as SiparisDurumu[]).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Sipariş No</th><th>Müşteri</th><th>Teslim noktası</th>
                  <th>Sevk</th><th>Durum</th><th className="num">Rev</th><th />
                </tr>
              </thead>
              <tbody>
                {gorunen.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      {siparisler.length === 0
                        ? 'Henüz sipariş yok. İlk siparişi açarak başlayın.'
                        : 'Süzgece uyan sipariş yok.'}
                    </td>
                  </tr>
                )}
                {gorunen.map(s => (
                  <tr key={s.id} className={secili?.id === s.id ? 'is-selected' : ''}>
                    <td><strong>{s.siparisNo}</strong></td>
                    <td>{s.musteriAdi ?? '—'}</td>
                    <td className="muted">{s.noktaAdi ?? '—'}</td>
                    <td className="muted">{tarih(s.sevkTarihi)}</td>
                    <td>
                      <span className={`status-pill ${DURUM_ROZETI[s.durum]}`}>{s.durum}</span>
                    </td>
                    <td className="num muted">{s.guncelRevizyon}</td>
                    <td className="row-actions">
                      <button className="btn" type="button" onClick={() => { void sec(s) }}>
                        Aç ›
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="warehouse-side">
          {/*
            ⚠️ ÖN KOŞUL EKRANDA SÖYLENİYOR. Müşteri kartı yoksa formdaki
            "Müşteri *" listesi BOŞ açılıyordu ve tarayıcı yalnızca "lütfen
            listeden bir öğe seçin" diyordu — seçilecek bir şey yokken.
            Kullanıcı kendi hatası sanıp formu kurcalıyor. Boş bir zorunlu
            liste, hata mesajı olmayan bir çıkmaz sokaktır.
          */}
          {islem === 'yeni' && (musteriler.length === 0 || kalemler.length === 0) && (
            <section className="card">
              <div className="section-header compact"><h3>Yeni Sipariş</h3></div>
              <div className="form-error">
                <strong>Sipariş açmak için önce şunlar gerekiyor:</strong>
              </div>
              <ul className="muted">
                {musteriler.length === 0 && (
                  <li>
                    <strong>Müşteri kartı yok.</strong> Soldaki menüden
                    <strong> Üretim → Müşteriler</strong> ekranını açıp bir
                    müşteri kaydedin. Sipariş bir müşteriye verilir; adı elle
                    yazılmaz, karttan seçilir.
                  </li>
                )}
                {kalemler.length === 0 && (
                  <li>
                    <strong>Stok kartı yok.</strong>
                    <strong> Depo → Stok Durumu</strong> ekranından ürün
                    kartlarını açın. Sipariş satırı bir stok kartına bağlanır.
                  </li>
                )}
              </ul>
              <div className="form-actions">
                <button className="btn" type="button" onClick={() => setIslem(null)}>
                  Kapat
                </button>
              </div>
            </section>
          )}

          {islem === 'yeni' && musteriler.length > 0 && kalemler.length > 0 && (
            <section className="card">
              <div className="section-header compact"><h3>Yeni Sipariş</h3></div>
              <SiparisFormu
                onerilenNo={sonrakiSiparisNo(siparisler.map(s => s.siparisNo))}
                musteriler={musteriler}
                noktalar={noktalar}
                kalemler={kalemler}
                birimler={birimler}
                fiyatOku={(noktaId, kalemId) =>
                  musteriDeposu!.gecerliFiyat(baglam.ctx, noktaId, kalemId)}
                onIptal={() => setIslem(null)}
                onKaydet={siparisAc}
              />
            </section>
          )}

          {!islem && !secili && (
            <section className="card empty-state">
              Sipariş bir defterdir. Satır asla üstüne yazılmaz; her değişiklik
              yeni bir revizyon olur ve eski hâli okunabilir kalır. Bir siparişi
              açıp <strong>Değişiklik geçmişi</strong> sekmesine bakın — bu
              ürünün sattığı şey orada.
            </section>
          )}

          {secili && (
            <section className="card">
              <div className="section-header compact">
                <h3>{secili.siparisNo}</h3>
                <span className={`status-pill ${DURUM_ROZETI[secili.durum]}`}>{secili.durum}</span>
              </div>

              <div className="karar-ozet">
                <div className="karar-ozet-satir">
                  <span>Müşteri</span><strong>{secili.musteriAdi ?? '—'}</strong>
                </div>
                <div className="karar-ozet-satir">
                  <span>Teslim noktası</span><strong>{secili.noktaAdi ?? '—'}</strong>
                </div>
                <div className="karar-ozet-satir">
                  <span>Sevk / teslim</span>
                  <strong>{tarih(secili.sevkTarihi)} → {tarih(secili.teslimTarihi)}</strong>
                </div>
                <div className="karar-ozet-satir">
                  <span>Revizyon</span><strong>{secili.guncelRevizyon}</strong>
                </div>
              </div>

              {acikFark.length > 0 && (
                <p className="muted detail-hint">
                  <span className="onem-rozeti kritik">{acikFark.length} açık fark</span>{' '}
                  Bu sipariş, farkı karara bağlanmadan tamamlanmış sayılmaz.
                </p>
              )}

              {yazabilir && (
                <div className="form-actions">
                  {IZINLI_GECISLER[secili.durum].map(d => {
                    // "Onaylandı" düğmesi, zincir tamamlanmadan ÇALIŞMAZ
                    // (0053, MI429). Basılabilir bırakıp sunucuya patlatmak,
                    // kullanıcıya neyi eksik yaptığını bulduran bir tasarım
                    // olurdu; sebebi burada yazıyor.
                    const kapali = d === 'Onaylandı' && !zincirTamam
                    return (
                      <button
                        key={d} className="btn" type="button" disabled={kapali}
                        title={kapali ? onayOzeti(zincirDurumu) : undefined}
                        onClick={() => { void durumDegistir(d) }}
                      >
                        {d}
                      </button>
                    )
                  })}
                  {!zincirTamam && IZINLI_GECISLER[secili.durum].includes('Onaylandı') && (
                    <span className="muted">{onayOzeti(zincirDurumu)}</span>
                  )}
                </div>
              )}

              {yazabilir && !islem && secili.durum !== 'İptal' && (
                <div className="form-actions">
                  <button className="btn" type="button" onClick={() => { setIslem('revizyon'); setHata('') }}>
                    + Revizyon
                  </button>
                  <button className="btn" type="button" onClick={() => { setIslem('fark'); setHata('') }}>
                    Fark bildir
                  </button>
                </div>
              )}

              {islem === 'revizyon' && (
                <RevizyonFormu
                  siparis={secili}
                  guncelSatirlar={satirlar}
                  kalemler={kalemler}
                  birimler={birimler}
                  noktalar={noktalar.filter(n => n.musteriId === secili.musteriId)}
                  farklar={farklar}
                  onIptal={() => setIslem(null)}
                  onKaydet={revizyonAc}
                />
              )}

              {islem === 'fark' && (
                <FarkFormu
                  siparis={secili}
                  kalemler={kalemler}
                  onIptal={() => setIslem(null)}
                  onKaydet={farkAc}
                />
              )}

              <div className="form-actions">
                <button
                  className={`btn ${sekme === 'satirlar' ? 'primary' : ''}`}
                  type="button" onClick={() => setSekme('satirlar')}
                >
                  Satırlar ({satirlar.length})
                </button>
                <button
                  className={`btn ${sekme === 'onay' ? 'primary' : ''}`}
                  type="button" onClick={() => setSekme('onay')}
                >
                  Onay zinciri
                </button>
                <button
                  className={`btn ${sekme === 'karsilama' ? 'primary' : ''}`}
                  type="button" onClick={() => setSekme('karsilama')}
                >
                  Karşılama
                </button>
                <button
                  className={`btn ${sekme === 'sevk' ? 'primary' : ''}`}
                  type="button" onClick={() => setSekme('sevk')}
                >
                  Sevk durumu
                </button>
                <button
                  className={`btn ${sekme === 'teslim' ? 'primary' : ''}`}
                  type="button" onClick={() => setSekme('teslim')}
                >
                  Teslim farkı
                </button>
                <button
                  className={`btn ${sekme === 'gecmis' ? 'primary' : ''}`}
                  type="button" onClick={() => setSekme('gecmis')}
                >
                  Değişiklik geçmişi ({revizyonlar.length})
                </button>
                <button
                  className={`btn ${sekme === 'farklar' ? 'primary' : ''}`}
                  type="button" onClick={() => setSekme('farklar')}
                >
                  Farklar ({farklar.length})
                </button>
              </div>

              {sekme === 'satirlar' && (
                <div className="table-wrap">
                  <table className="data-table compact">
                    <thead>
                      <tr><th>Ürün</th><th className="num">Miktar</th><th>Birim</th><th className="num">Fiyat</th></tr>
                    </thead>
                    <tbody>
                      {satirlar.length === 0 && (
                        <tr><td colSpan={4} className="muted">Satır yok.</td></tr>
                      )}
                      {satirlar.map(s => (
                        <tr key={s.id}>
                          <td>{s.kalemAdi ?? '—'}</td>
                          <td className="num">{sayiYaz(s.miktar)}</td>
                          <td className="muted">{s.birim}</td>
                          <td className="num muted">
                            {s.birimFiyat === undefined
                              ? '—'
                              : `${s.birimFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${s.paraBirimi ?? ''}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {sekme === 'onay' && (
                <OnayPaneli
                  siparis={secili}
                  durumlar={zincirDurumu}
                  izinler={currentUser.permissions}
                  onKarar={onayVer}
                />
              )}

              {sekme === 'karsilama' && (
                <KarsilamaPaneli
                  siparis={secili}
                  plan={karsilama}
                  yazabilir={yazabilir}
                  onIsEmri={isEmriCikar}
                />
              )}

              {sekme === 'sevk' && (
                <SevkPaneli
                  siparis={secili}
                  irsaliyeler={siparisIrsaliyeleri(secili.id, sevkiyatlar)}
                  basilan={irsaliyeBasiliyor}
                  onIrsaliye={irsaliyeYazdir}
                  durumlar={sevkDurumu}
                  yazabilir={yazabilir}
                  onCikar={sevkiyataCikar}
                />
              )}

              {sekme === 'teslim' && (
                <TeslimPaneli satirlar={teslim} farklar={farklar} />
              )}

              {sekme === 'gecmis' && <GecmisPaneli revizyonlar={revizyonlar} />}

              {sekme === 'farklar' && (
                <FarkListesi
                  farklar={farklar}
                  yazabilir={yazabilir}
                  onKarar={kararVer}
                />
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

// ── Onay zinciri ───────────────────────────────────────────────────────────
/**
 * Emrah'ın cümlesi: "Satıştan sorumlu kimse onun önüne düşer; o da depodan
 * (yeterli hammadde var mı), aşçıdan (yoğunluğun nedir) aldığı bilgilerle
 * onayı verir, müşterinin istediği tarihe yetişir mi onu cevaplayabilir
 * veya 'şu tarihe kadar hazır olur' der."
 *
 * Bu panel o cümlenin ekranıdır. GÖRÜŞ adımları bloklamaz ama görünür;
 * ONAY adımı olmadan sipariş onaylanamaz.
 */
function OnayPaneli({
  siparis, durumlar, izinler, onKarar,
}: {
  siparis: Siparis
  durumlar: AdimDurumu[]
  izinler?: string[]
  onKarar: (adimKodu: string, karar: OnayKarari, not: string, sozTarihi: string) => void
}){
  const tamam = onayTamamMi(durumlar)
  const gecikme = sozGecikmesi(siparis)
  const [acik, setAcik] = React.useState<string | null>(null)
  const [karar, setKarar] = React.useState<OnayKarari>('Olumlu')
  const [not, setNot] = React.useState('')
  const [soz, setSoz] = React.useState('')

  const yetkili = (a: OnayAdimi) => !izinler || izinler.includes(a.izinKodu)

  return (
    <div>
      <p className={tamam ? 'muted' : 'form-error'}>{onayOzeti(durumlar)}</p>

      {/* Onaylar GÜNCEL revizyona bağlı. Revizyon geldiyse eski kararlar
          burada görünmez ve zincir yeniden işler — bu, panelin en kolay
          yanlış anlaşılan davranışı, o yüzden yazıyoruz. */}
      <p className="muted">
        Revizyon {siparis.guncelRevizyon} için kararlar. Sipariş revize
        edilirse onaylar yeniden alınır.
      </p>

      {gecikme !== undefined && gecikme !== 0 && (
        <div className={gecikme > 0 ? 'form-error' : 'form-info'}>
          Müşteri {tarih(siparis.teslimTarihi)} istedi, söz verilen tarih{' '}
          {tarih(siparis.sozVerilenTarih)} —{' '}
          <strong>{gecikme > 0 ? `${gecikme} gün geç` : `${-gecikme} gün erken`}</strong>.
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table compact">
          <thead>
            <tr><th>Adım</th><th>Tür</th><th>Son karar</th><th>Söz</th><th>Kim</th><th></th></tr>
          </thead>
          <tbody>
            {durumlar.length === 0 && (
              <tr><td colSpan={6} className="muted">Onay zinciri kurulmamış.</td></tr>
            )}
            {durumlar.map(d => (
              <tr key={d.adim.kod}>
                <td>{d.adim.ad}</td>
                <td className="muted">{d.adim.bloklar ? 'onay' : 'görüş'}</td>
                <td>
                  {d.sonKarar
                    ? <span className={d.sonKarar.karar === 'Olumsuz' ? 'onem-rozeti r-kritik' : ''}>
                        {d.sonKarar.karar}
                      </span>
                    : <span className="muted">{d.bekliyor ? 'bekliyor' : '—'}</span>}
                  {d.sonKarar?.not && <div className="muted">{d.sonKarar.not}</div>}
                </td>
                <td className="muted">{d.sonKarar?.sozTarihi ? tarih(d.sonKarar.sozTarihi) : '—'}</td>
                <td className="muted">{d.sonKarar?.karariVerenAd ?? '—'}</td>
                <td>
                  {yetkili(d.adim) ? (
                    <button
                      className="btn ac" type="button"
                      onClick={() => {
                        setAcik(acik === d.adim.kod ? null : d.adim.kod)
                        setKarar('Olumlu'); setNot(''); setSoz('')
                      }}
                    >
                      {acik === d.adim.kod ? 'Kapat' : 'Karar ver'}
                    </button>
                  ) : (
                    <span className="muted">yetki yok</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {acik && (
        <form
          className="stacked-form"
          onSubmit={e => { e.preventDefault(); onKarar(acik, karar, not, soz); setAcik(null) }}
        >
          <label>Karar
            <select value={karar} onChange={e => setKarar(e.target.value as OnayKarari)}>
              {ONAY_KARARLARI.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          {karar === 'Şartlı' && (
            <label>Şu tarihe kadar hazır olur *
              <input type="date" value={soz} onChange={e => setSoz(e.target.value)} />
            </label>
          )}
          <label>
            {karar === 'Olumsuz' ? 'Gerekçe *' : 'Not'}
            <textarea
              rows={2} value={not} onChange={e => setNot(e.target.value)}
              placeholder={karar === 'Olumsuz'
                ? 'Neden olmuyor — müşteriye söylenecek cümle'
                : 'Hammadde durumu, yoğunluk, tarih…'}
            />
          </label>
          <div className="form-actions">
            <button className="btn primary" type="submit">Kaydet</button>
            <button className="btn" type="button" onClick={() => setAcik(null)}>Vazgeç</button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Karşılama ──────────────────────────────────────────────────────────────
/**
 * "Depoda olan depodan, olmayan üretimden karşılanıyor."
 *
 * ⚠️ Müsait miktar, ham bakiye DEĞİL: başka açık siparişlere söz verilmiş
 * miktar düşülmüş hâli. Düşmeseydik aynı malı iki siparişe vaat eder ve
 * ikisini de eksik gönderirdik.
 */
function KarsilamaPaneli({
  siparis, plan, yazabilir, onIsEmri,
}: {
  siparis: Siparis
  plan: KarsilamaSatiri[]
  yazabilir: boolean
  onIsEmri: () => void
}){
  const t = karsilamaToplami(plan)
  // Üretim planı ancak sipariş ONAYLANDIYSA anlamlı: onaylanmamış miktar
  // için üretime başlamak, zincirin engellemek için var olduğu şeydir.
  const planlanabilir = ['Onaylandı', 'Hazırlanıyor', 'Hazır'].includes(siparis.durum)

  return (
    <div>
      <p className="muted">
        {t.kalemSayisi} kalem · {t.tamamenDepodan} tamamı depodan
        {t.uretimGereken > 0 && <> · <strong>{t.uretimGereken} üretim gerekiyor</strong></>}
        {t.uretilemeyen > 0 && <> · <strong>{t.uretilemeyen} satın alınmalı</strong></>}
        {t.hesaplanamayan > 0 && <> · {t.hesaplanamayan} hesaplanamıyor</>}
      </p>

      {t.uretilemeyen > 0 && (
        <div className="form-error">
          Reçetesi olmayan kalem var: üretilemez, <strong>satın alınmalı</strong>.
          İş emri çıkarmak bu kalemleri karşılamaz.
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Ürün</th><th className="num">Sipariş</th><th className="num">Depoda</th>
              <th className="num">Müsait</th><th className="num">Depodan</th>
              <th className="num">Üretim</th><th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {plan.length === 0 && (
              <tr><td colSpan={7} className="muted">Kalem yok.</td></tr>
            )}
            {plan.map(k => (
              <tr key={k.kalemId}>
                <td>{k.kalemAdi}</td>
                <td className="num">{sayiYaz(k.siparisMiktar)} {k.birim}</td>
                <td className="num muted">{sayiYaz(k.depoBakiye)}</td>
                {/* Müsait ≠ depoda: rezerve düşülmüş hâli. */}
                <td className="num">{k.musait === undefined ? '—' : sayiYaz(k.musait)}</td>
                <td className="num">{k.depodan === undefined ? '—' : sayiYaz(k.depodan)}</td>
                <td className="num">
                  {k.uretilecek === undefined ? '—' : sayiYaz(k.uretilecek)}
                </td>
                <td className="muted">{karsilamaOzeti(k)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {yazabilir && planlanabilir && t.uretimGereken > 0 && (
        <div className="form-actions">
          <button className="btn primary" type="button" onClick={onIsEmri}>
            Üretilecekler için iş emri çıkar
          </button>
          <span className="muted">
            Taslak olarak açılır; malzeme yeterliliği Üretim ekranında.
          </span>
        </div>
      )}
      {yazabilir && !planlanabilir && (
        <p className="muted">
          Üretim planı için sipariş <strong>onaylanmış</strong> olmalı.
        </p>
      )}
    </div>
  )
}

// ── Sevk durumu ────────────────────────────────────────────────────────────
/**
 * "Bu siparişin ne kadarı gitti?" — tek bakışta.
 *
 * Sayılar 0051'deki `app.siparis_sevk_durumu()`den geliyor; tarayıcıda
 * toplasaydık iki çağrı arasında yazılan bir sevkiyat sessizce kaçardı.
 */
/**
 * TESLİM FARKI — "ne istendi, ne hazırlandı, ne gitti" (0058).
 *
 * Bu ekranın bütün değeri ÜÇ SAYIYI YAN YANA koymasında. Üç ayrı sekmede
 * duran üç sayı kimseye bir şey anlatmıyordu; yan yana durunca aradaki
 * boşluk kendiliğinden görünüyor.
 *
 * ⚠️ "Hazırlandı" sütunu iş emri OLMAYAN kalemde "Depodan" yazar, 0 yazmaz.
 * Sıfır yazmak, depodan karşılanan bir kalemi eksik üretim gibi gösterirdi.
 *
 * ⚠️ Hesaplanamayan hücrede TİRE var, sayı yok. Birim uyuşmazlığında
 * veritabanı bilerek çıkarma yapmıyor; ekranın uydurma hakkı yok.
 */
function TeslimPaneli({
  satirlar, farklar,
}: {
  satirlar: TeslimFarkiSatiri[]
  farklar: Fark[]
}){
  const { satirlar: liste, kalemsizFarklar } = teslimSatirlari(satirlar, farklar)
  const ozet = teslimOzeti(liste, kalemsizFarklar)
  const cumle = teslimCumlesi(ozet)
  const temiz = cumle === 'Sipariş tamamen teslim edildi.'

  return (
    <div>
      <p className={temiz ? 'muted' : ''}>
        {temiz ? cumle : <strong>{cumle}</strong>}
      </p>

      <div className="table-wrap">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Ürün</th>
              <th className="num">İstendi</th>
              <th>Hazırlandı</th>
              <th className="num">Gitti</th>
              <th className="num">Kalan</th>
              <th>Açık fark</th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 && (
              <tr><td colSpan={6} className="muted">Kalem yok.</td></tr>
            )}
            {liste.map(t => (
              <tr key={t.kalemId} className={t.siparisDisi ? 'is-passive' : ''}>
                <td>
                  {kalemYaz(t.kalemAdi, t.kalemId)}
                  {t.siparisDisi && <> <span className="muted">· sipariş dışı</span></>}
                </td>
                <td className="num">
                  {t.istendi === undefined
                    ? '—'
                    : `${sayiYaz(t.istendi)} ${t.istendiBirim ?? ''}`}
                </td>
                <td className="muted">{uretimCumlesi(t)}</td>
                <td className="num">{sayiYaz(t.gitti)}</td>
                <td className="num">
                  {t.kalan === undefined ? '—' : sayiYaz(t.kalan)}
                </td>
                <td>
                  {t.acikFarklar.length === 0
                    ? <span className="muted">—</span>
                    : t.acikFarklar.map(f => (
                      <span key={f.id} className="onem-rozeti kritik">
                        {f.tur}{f.miktar !== undefined ? ` ${sayiYaz(f.miktar)} ${f.birim ?? ''}` : ''}
                      </span>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {kalemsizFarklar.length > 0 && (
        <div className="form-error">
          <strong>Kaleme bağlı olmayan {kalemsizFarklar.length} açık fark kaydı var.</strong>
          {' '}Sevkiyatın tamamına dair açılmış bu kayıtlar yukarıdaki tabloda
          görünmez; <strong>Farklar</strong> sekmesinde duruyorlar.
        </div>
      )}

      {ozet.olculemeyen > 0 && (
        <p className="muted">
          {ozet.olculemeyen} kalemde sipariş birimi ile sevkiyat birimi farklı.
          Bu satırlarda çıkarma <strong>yapılmadı</strong>: 100 kg siparişten
          5 koli düşüp bir sayı yazmak, yanlış olduğu belli olmayan bir sayı
          üretmek olurdu.
        </p>
      )}

      {ozet.acikIsEmri > 0 && (
        <p className="muted">
          {ozet.acikIsEmri} iş emri hâlâ açık — "hazırlandı" sütunu yalnızca
          deftere <strong>yazılmış</strong> mamul girişini sayıyor, planlananı
          değil.
        </p>
      )}
    </div>
  )
}

function SevkPaneli({
  siparis, durumlar, yazabilir, onCikar, irsaliyeler, basilan, onIrsaliye,
}: {
  siparis: Siparis
  durumlar: KalemSevkDurumu[]
  yazabilir: boolean
  onCikar: () => void
  irsaliyeler: SiparisIrsaliyesi[]
  /** Hazırlanmakta olan irsaliyenin sevkiyat kimliği; yoksa boş. */
  basilan: string
  onIrsaliye: (irsaliye: SiparisIrsaliyesi) => void
}){
  const toplam = sevkToplami(durumlar)
  const turetilebilir = TURETILEBILIR_DURUMLAR.includes(siparis.durum)
  const kalanVar = durumlar.some(d => !d.siparisDisi && !d.birimUyusmuyor && (d.kalan ?? 0) > 0)

  return (
    <div>
      <p className="muted">
        {toplam.kalemSayisi} kalem · {toplam.tamamlanan} tamamlandı
        {toplam.bekleyen > 0 && <> · <strong>{toplam.bekleyen} bekliyor</strong></>}
        {toplam.fazlaGiden > 0 && <> · <strong>{toplam.fazlaGiden} fazla gitti</strong></>}
        {toplam.hesaplanamayan > 0 && <> · {toplam.hesaplanamayan} hesaplanamıyor</>}
        {toplam.siparisDisiKalem > 0 && <> · {toplam.siparisDisiKalem} sipariş dışı</>}
      </p>

      {(toplam.fazlaGiden > 0 || toplam.siparisDisiKalem > 0) && (
        <div className="form-error">
          Sipariş dışına çıkılmış: fazla ya da siparişte olmayan kalem gitmiş.
          Bu bir <strong>fark kaydı</strong> konusudur, revizyon değil.
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table compact">
          <thead>
            <tr><th>Ürün</th><th className="num">Sipariş</th><th className="num">Giden</th><th className="num">Kalan</th><th>Durum</th></tr>
          </thead>
          <tbody>
            {durumlar.length === 0 && (
              <tr><td colSpan={5} className="muted">Kalem yok.</td></tr>
            )}
            {durumlar.map(d => (
              <tr key={d.kalemId}>
                <td>{kalemYaz(d.kalemAdi, d.kalemId)}</td>
                <td className="num">
                  {d.siparisMiktar === undefined
                    ? '—'
                    : `${sayiYaz(d.siparisMiktar)} ${d.siparisBirim ?? ''}`}
                </td>
                <td className="num">{sayiYaz(d.sevkMiktar)}</td>
                <td className="num">
                  {/* ⚠️ Birim uyuşmuyorsa sayı YAZILMIYOR. Uydurulmuş bir
                      sayı, boş bir hücreden daha tehlikelidir. */}
                  {d.kalan === undefined ? '—' : sayiYaz(d.kalan)}
                </td>
                <td className="muted">{sevkOzeti(d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── İRSALİYELER ────────────────────────────────────────────────────
          Yol haritası: "İrsaliye yazdırmayı siparişe bağlama."

          Bağ veritabanında zaten vardı (`shipment.order_id`, 0051); eksik
          olan ekrandı. Önce bir siparişi açan kişi, irsaliyeye ulaşmak için
          Sevkiyatlar listesinde doğru belgeyi aramak zorundaydı — üç
          sevkiyatı olan bir siparişte hangisinin hangisi olduğu belli
          değildi. */}
      <h4>İrsaliyeler</h4>
      <p className="muted">{irsaliyeOzeti(irsaliyeler)}</p>

      {irsaliyeler.length > 0 && (
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr><th>Sevkiyat</th><th>Tarih</th><th>Durum</th><th className="num">Kalem</th><th></th></tr>
            </thead>
            <tbody>
              {irsaliyeler.map(i => {
                const uyari = irsaliyeUyarisi(i)
                return (
                  <tr key={i.sevkiyatId}>
                    <td><strong>{i.sevkiyatNo}</strong></td>
                    <td className="muted">{i.tarih ? tarih(i.tarih.slice(0, 10)) : '—'}</td>
                    <td>
                      {i.resmiMi
                        ? i.durumEtiketi
                        : <span className="onem-rozeti uyari">{i.durumEtiketi}</span>}
                      {/* ⚠️ Uyarı BASMADAN ÖNCE burada; aynısı kâğıdın başına
                          da basılıyor. Tekrar değil: biri basan kişiyi,
                          diğeri kâğıdı eline alanı uyarıyor. */}
                      {uyari && <div className="muted">{uyari}</div>}
                    </td>
                    <td className="num">{i.kalemSayisi}</td>
                    <td className="row-actions">
                      <button
                        className="btn" type="button"
                        disabled={basilan !== ''}
                        onClick={() => onIrsaliye(i)}
                      >
                        {basilan === i.sevkiyatId ? 'Hazırlanıyor…' : 'İrsaliye yazdır'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {yazabilir && turetilebilir && kalanVar && (
        <div className="form-actions">
          <button className="btn primary" type="button" onClick={onCikar}>
            Kalanı sevkiyata çıkar
          </button>
        </div>
      )}
      {yazabilir && turetilebilir && !kalanVar && durumlar.length > 0 && (
        <p className="muted">Sevk edilmemiş kalem kalmadı.</p>
      )}
      {yazabilir && !turetilebilir && (
        <p className="muted">
          Sevkiyat çıkarmak için sipariş <strong>Hazır</strong> olmalı.
        </p>
      )}
    </div>
  )
}

// ── Değişiklik geçmişi ─────────────────────────────────────────────────────
/**
 * Bu panel bu ekranın var olma sebebi.
 *
 * Ham iki liste göstermek, kullanıcıya farkı kendisinin bulmasını söylemek
 * olurdu. O yüzden her revizyonda NE DEĞİŞTİĞİ yazıyor: "200 kg → 150 kg".
 */
function GecmisPaneli({ revizyonlar }: { revizyonlar: Revizyon[] }){
  if(revizyonlar.length === 0){
    return <p className="muted detail-hint">Revizyon yok.</p>
  }

  // Karşılaştırma yalnız SATIRLI revizyonlar arasında: lojistik revizyonu
  // satır taşımıyor, onu miktar değişikliği gibi göstermek yanlış olurdu.
  const satirli = revizyonlar.filter(r => r.satirlar.length > 0)

  return (
    <>
      <p className="muted detail-hint">
        Hiçbir satır üstüne yazılmadı. Aşağıdaki her kayıt defterde duruyor ve
        silinemez.
      </p>
      {[...revizyonlar].reverse().map(r => {
        const sira = satirli.findIndex(x => x.id === r.id)
        const onceki = sira > 0 ? satirli[sira - 1].satirlar : []
        const farklar = r.satirlar.length > 0 ? revizyonFarki(onceki, r.satirlar) : []
        return (
          <div key={r.id} className="karar-ozet">
            <div className="karar-ozet-satir">
              <span>
                <strong>Rev {r.revizyonNo}</strong>{' '}
                <span className={`onem-rozeti ${r.tur === 'LOJISTIK' ? 'bilgi' : 'uyari'}`}>
                  {r.tur === 'LOJISTIK' ? 'Lojistik' : 'Miktar'}
                </span>
              </span>
              <span className="muted">{zaman(r.olusturmaZamani)}</span>
            </div>
            <div className="karar-ozet-satir">
              <span>Kaynak</span><strong>{r.kaynak}</strong>
            </div>
            <div className="karar-ozet-satir">
              <span>Gerekçe</span><strong>{r.gerekce}</strong>
            </div>
            {r.farkId && (
              <div className="karar-ozet-satir">
                <span>Bağlı fark kaydı</span>
                <strong>var — sevk sonrası miktar değişikliği</strong>
              </div>
            )}
            {sira === 0 && r.satirlar.length > 0 && (
              <div className="karar-ozet-satir">
                <span>İlk hâli</span>
                <strong>
                  {r.satirlar.map(s => `${s.kalemAdi ?? '—'} ${sayiYaz(s.miktar)} ${s.birim}`).join(' · ')}
                </strong>
              </div>
            )}
            {farklar.map(f => (
              <div className="karar-ozet-satir" key={f.kalemId}>
                <span>{f.kalemAdi ?? '—'}</span>
                <strong className={f.tur === 'çıkarıldı' ? 'is-critical' : undefined}>
                  {farkiYaz(f)}
                </strong>
              </div>
            ))}
            {r.tur === 'MIKTAR' && sira > 0 && farklar.length === 0 && (
              <div className="karar-ozet-satir">
                <span>Satırlar</span><strong className="muted">değişmedi</strong>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

// ── Fark listesi ───────────────────────────────────────────────────────────
function FarkListesi({
  farklar, yazabilir, onKarar,
}: {
  farklar: Fark[]
  yazabilir: boolean
  onKarar: (farkId: string, karar: FarkKarari, not: string, sorumluId?: string) => Promise<void>
}){
  const [acik, setAcik] = React.useState<string | null>(null)
  const [karar, setKarar] = React.useState<FarkKarari>('Tamamlanacak')
  const [not, setNot] = React.useState('')

  if(farklar.length === 0){
    return (
      <p className="muted detail-hint">
        Fark kaydı yok. Bir eksik, fazla ya da hasar fark eden kişi
        <strong> Fark bildir</strong> ile bayrağı kaldırır.
      </p>
    )
  }

  return (
    <>
      {farklar.map(f => (
        <div key={f.id} className="karar-ozet">
          <div className="karar-ozet-satir">
            <span>
              <span className={`onem-rozeti ${f.durum === 'Karara Bağlandı' ? 'bilgi' : 'kritik'}`}>
                {f.tur}
              </span>{' '}
              <strong>{f.miktar !== undefined ? `${sayiYaz(f.miktar)} ${f.birim ?? ''}` : ''}</strong>
            </span>
            <span className="muted">{f.adim}</span>
          </div>
          {f.kalemAdi && (
            <div className="karar-ozet-satir"><span>Ürün</span><strong>{f.kalemAdi}</strong></div>
          )}
          <div className="karar-ozet-satir">
            <span>Bildiren</span>
            <strong>{f.bildirenAdi ?? 'kullanıcı'} · {zaman(f.bildirimZamani)}</strong>
          </div>
          <div className="karar-ozet-satir"><span>Açıklama</span><strong>{f.aciklama}</strong></div>
          <div className="karar-ozet-satir">
            <span>Durum</span><strong>{f.durum}</strong>
          </div>
          {f.karar && (
            <div className="karar-ozet-satir">
              <span>Karar</span><strong>{f.karar} — {f.kararNotu ?? ''}</strong>
            </div>
          )}

          {yazabilir && f.durum !== 'Karara Bağlandı' && acik !== f.id && (
            <div className="form-actions">
              <button className="btn" type="button" onClick={() => { setAcik(f.id); setNot('') }}>
                Karara bağla
              </button>
            </div>
          )}

          {acik === f.id && (
            <form
              className="stacked-form"
              onSubmit={e => {
                e.preventDefault()
                void onKarar(f.id, karar, not).then(() => setAcik(null))
              }}
            >
              <label>Karar
                <select value={karar} onChange={e => setKarar(e.target.value as FarkKarari)}>
                  {KARARLAR.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <small className="muted">
                  Tamamlanacak: aynı siparişe ikinci sevkiyat çıkar.
                  Müşteri Hatası: sipariş bu kayda bağlı olarak revize edilir.
                </small>
              </label>
              <label>Karar notu *
                <textarea
                  rows={2} value={not} required
                  placeholder="Ne oldu, nasıl çözüldü"
                  onChange={e => setNot(e.target.value)}
                />
              </label>
              {karar === 'Sorumlu Bulundu' && (
                <p className="muted detail-hint">
                  Sorumlu kişi seçimi bu sürümde henüz yok; karar notuna yazın.
                  Kişi bazlı sorumluluk, personel modülü bağlanınca gelecek.
                </p>
              )}
              <div className="form-actions">
                <button className="btn" type="button" onClick={() => setAcik(null)}>İptal</button>
                <button className="btn primary" type="submit">Kaydet</button>
              </div>
            </form>
          )}
        </div>
      ))}
    </>
  )
}

// ── Sipariş formu ──────────────────────────────────────────────────────────
function SiparisFormu({
  onerilenNo, musteriler, noktalar, kalemler, birimler, fiyatOku, onIptal, onKaydet,
}: {
  onerilenNo: string
  musteriler: Musteri[]
  noktalar: TeslimNoktasi[]
  kalemler: KatalogKalemi[]
  birimler: Birim[]
  fiyatOku: (noktaId: string, kalemId: string) => Promise<number | undefined>
  onIptal: () => void
  onKaydet: (girdi: YeniSiparis) => Promise<void>
}){
  const [musteriId, setMusteriId] = React.useState('')
  const [noktaId, setNoktaId] = React.useState('')
  const [sevk, setSevk] = React.useState(bugun())
  const [teslim, setTeslim] = React.useState('')
  const [not, setNot] = React.useState('')
  const [satirlar, setSatirlar] = React.useState<SatirTaslagi[]>([bosSatir()])
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  const musteriNoktalari = noktalar.filter(n => n.musteriId === musteriId)

  const guncelle = (i: number, yama: Partial<SatirTaslagi>) =>
    setSatirlar(o => o.map((s, j) => (j === i ? { ...s, ...yama } : s)))

  /**
   * Ürün seçilince birim ve FİYAT kendiliğinden doluyor.
   * Fiyat 0047'nin defterinden okunuyor (nokta > müşteri, en yeni tarih) —
   * burada yeniden hesaplanmıyor. Kullanıcı üzerine yazabilir: o günkü
   * anlaşma farklı olabilir ve belge o günü yazar.
   */
  const kalemSec = async (i: number, kalemId: string) => {
    const kalem = kalemler.find(k => k.id === kalemId)
    guncelle(i, { kalemId, birim: kalem?.temelBirim ?? '' })
    if(!noktaId || !kalemId) return
    try {
      const fiyat = await fiyatOku(noktaId, kalemId)
      // Defterden okunan fiyat da ekranın biçimiyle yazılıyor; iki ayrı
      // görünüm (12450 ile 12.450) aynı formda yan yana durmasın.
      if(fiyat !== undefined) guncelle(i, { fiyat: sayiYazarken(String(fiyat), 2) })
    } catch { /* fiyat okunamazsa form çalışmaya devam eder */ }
  }

  return (
    <form
      className="stacked-form"
      onSubmit={async e => {
        e.preventDefault()
        setGonderiliyor(true)
        try{
          await onKaydet({
            siparisNo: onerilenNo,
            musteriId,
            noktaId: noktaId || undefined,
            sevkTarihi: sevk || undefined,
            teslimTarihi: teslim || undefined,
            not: not.trim() || undefined,
            satirlar: satirlar
              .filter(s => s.kalemId !== '' && sayiya(s.miktar) > 0)
              .map(taslaktanSatir),
          })
        } finally { setGonderiliyor(false) }
      }}
    >
      <label>Sipariş No
        <input value={onerilenNo} readOnly />
        <small className="muted">
          Sistem üretiyor. Elle yazılan numaralar birbirine karışır ve aynı
          sipariş iki kez sayılır.
        </small>
      </label>

      <label>Müşteri *
        <select
          value={musteriId} required
          onChange={e => { setMusteriId(e.target.value); setNoktaId('') }}
        >
          <option value="">Seçin…</option>
          {musteriler.map(m => <option key={m.id} value={m.id}>{m.kod} · {m.ad}</option>)}
        </select>
      </label>

      <label>Teslim noktası
        <select value={noktaId} disabled={!musteriId} onChange={e => setNoktaId(e.target.value)}>
          <option value="">{musteriId ? 'Seçin…' : 'Önce müşteri seçin'}</option>
          {musteriNoktalari.map(n => <option key={n.id} value={n.id}>{n.ad}</option>)}
        </select>
        {/*
          ⚠️ BOŞ LİSTE SEBEBİNİ SÖYLÜYOR. Müşterinin hiç noktası yoksa liste
          boş açılıyor ve kullanıcı kendi hatası sanıyordu. Nokta ZORUNLU
          değil (sipariş noktasız da açılır) ama fiyat defteri ve irsaliye
          noktadan okunuyor; eksikliği sessiz geçmek pahalıya patlar.
        */}
        {musteriId && musteriNoktalari.length === 0
          ? (
            <small className="is-critical">
              Bu müşterinin teslim noktası yok. <strong>Üretim → Müşteriler</strong>
              {' '}ekranında kartı açıp <strong>+ Teslim noktası</strong> ekleyin —
              tek adresli müşteride buna "Merkez" demek yeterli. Noktasız sipariş
              açılabilir ama irsaliyeye adres yazılmaz ve noktaya özel fiyat
              okunamaz.
            </small>
          )
          : (
            <small className="muted">
              İrsaliye buraya çıkar. Fiyat da buradan okunuyor: aynı müşterinin
              farklı noktalarına farklı fiyat olabilir.
            </small>
          )}
      </label>

      <div className="form-row">
        <label>Sevk tarihi
          <input type="date" value={sevk} onChange={e => setSevk(e.target.value)} />
        </label>
        <label>Teslim tarihi
          <input type="date" value={teslim} onChange={e => setTeslim(e.target.value)} />
        </label>
      </div>

      <SatirDuzenleyici
        satirlar={satirlar} kalemler={kalemler} birimler={birimler}
        onKalemSec={(i, id) => { void kalemSec(i, id) }}
        onGuncelle={guncelle}
        onEkle={() => setSatirlar(o => [...o, bosSatir()])}
        onSil={i => setSatirlar(o => o.filter((_, j) => j !== i))}
      />

      <label>Not
        <textarea rows={2} value={not} onChange={e => setNot(e.target.value)} />
      </label>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Açılıyor…' : 'Siparişi aç'}
        </button>
      </div>
    </form>
  )
}

// ── Revizyon formu ─────────────────────────────────────────────────────────
function RevizyonFormu({
  siparis, guncelSatirlar, kalemler, birimler, noktalar, farklar, onIptal, onKaydet,
}: {
  siparis: Siparis
  guncelSatirlar: SiparisSatiri[]
  kalemler: KatalogKalemi[]
  birimler: Birim[]
  noktalar: TeslimNoktasi[]
  farklar: Fark[]
  onIptal: () => void
  onKaydet: (girdi: YeniRevizyon) => Promise<void>
}){
  const sevkSonrasi = SEVK_SONRASI.includes(siparis.durum)
  const [tur, setTur] = React.useState<'MIKTAR' | 'LOJISTIK'>(sevkSonrasi ? 'LOJISTIK' : 'MIKTAR')
  const [kaynak, setKaynak] = React.useState<RevizyonKaynagi>('Telefon')
  const [gerekce, setGerekce] = React.useState('')
  const [farkId, setFarkId] = React.useState('')
  const [noktaId, setNoktaId] = React.useState(siparis.noktaId ?? '')
  const [sevk, setSevk] = React.useState(siparis.sevkTarihi ?? '')
  const [teslim, setTeslim] = React.useState(siparis.teslimTarihi ?? '')
  const [satirlar, setSatirlar] = React.useState<SatirTaslagi[]>(
    guncelSatirlar.length > 0
      // Mevcut satırlar da ekranın biçimiyle doluyor; kullanıcı aynı formda
      // iki ayrı yazım görmesin (12450 ile 12.450).
      ? guncelSatirlar.map(s => ({
          kalemId: s.kalemId,
          miktar: sayiYazarken(String(s.miktar), 3),
          birim: s.birim,
          fiyat: s.birimFiyat === undefined ? '' : sayiYazarken(String(s.birimFiyat), 2),
        }))
      : [bosSatir()],
  )
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  // Karara bağlanmış farklar revizyona bağlanabilir: inceleme bitmeden
  // miktarı değiştirmek, incelemeyi atlamak olurdu.
  const bagliFarklar = farklar.filter(f => f.durum === 'Karara Bağlandı')

  const guncelle = (i: number, yama: Partial<SatirTaslagi>) =>
    setSatirlar(o => o.map((s, j) => (j === i ? { ...s, ...yama } : s)))

  return (
    <form
      className="stacked-form"
      onSubmit={async e => {
        e.preventDefault()
        setGonderiliyor(true)
        try{
          await onKaydet(tur === 'MIKTAR'
            ? {
                siparisId: siparis.id, tur, kaynak, gerekce,
                farkId: farkId || undefined,
                satirlar: satirlar
                  .filter(s => s.kalemId !== '' && sayiya(s.miktar) > 0)
                  .map(taslaktanSatir),
              }
            : {
                siparisId: siparis.id, tur, kaynak, gerekce,
                noktaId, sevkTarihi: sevk, teslimTarihi: teslim,
              })
        } finally { setGonderiliyor(false) }
      }}
    >
      <h4>Yeni revizyon</h4>

      <label>Tür
        <select value={tur} onChange={e => setTur(e.target.value as 'MIKTAR' | 'LOJISTIK')}>
          <option value="MIKTAR">Miktar — satırlar değişiyor</option>
          <option value="LOJISTIK">Lojistik — teslim noktası ya da tarih</option>
        </select>
      </label>

      {sevkSonrasi && tur === 'MIKTAR' && (
        <p className="muted detail-hint">
          <span className="onem-rozeti kritik">Dikkat</span> Bu sipariş sevk
          edildi. İstenen mal zaten üretilip yola çıktı, o yüzden miktar
          <strong> yalnızca karara bağlanmış bir fark kaydına dayanarak</strong>
          değişebilir. Teslim noktası ya da tarih değişecekse Lojistik türünü
          seçin.
        </p>
      )}

      {sevkSonrasi && tur === 'MIKTAR' && (
        <label>Bağlı fark kaydı *
          <select value={farkId} required onChange={e => setFarkId(e.target.value)}>
            <option value="">Seçin…</option>
            {bagliFarklar.map(f => (
              <option key={f.id} value={f.id}>
                {f.tur} · {f.adim} · {f.karar ?? ''}
              </option>
            ))}
          </select>
          {bagliFarklar.length === 0 && (
            <small className="muted">
              Karara bağlanmış fark kaydı yok. Önce farkı bildirin, incelensin
              ve karara bağlanın.
            </small>
          )}
        </label>
      )}

      <label>Kaynak *
        <select value={kaynak} onChange={e => setKaynak(e.target.value as RevizyonKaynagi)}>
          {KAYNAKLAR.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <small className="muted">
          Kaynağı olmayan değişiklik, sonradan sahibi olmayan değişikliktir.
        </small>
      </label>

      <label>Gerekçe *
        <textarea
          rows={2} value={gerekce} required
          placeholder="Müşteri telefonla 150'ye düşürdü"
          onChange={e => setGerekce(e.target.value)}
        />
      </label>

      {tur === 'LOJISTIK' && (
        <>
          <label>Teslim noktası
            <select value={noktaId} onChange={e => setNoktaId(e.target.value)}>
              <option value="">—</option>
              {noktalar.map(n => <option key={n.id} value={n.id}>{n.ad}</option>)}
            </select>
          </label>
          <div className="form-row">
            <label>Sevk tarihi
              <input type="date" value={sevk} onChange={e => setSevk(e.target.value)} />
            </label>
            <label>Teslim tarihi
              <input type="date" value={teslim} onChange={e => setTeslim(e.target.value)} />
            </label>
          </div>
        </>
      )}

      {tur === 'MIKTAR' && (
        <SatirDuzenleyici
          satirlar={satirlar} kalemler={kalemler} birimler={birimler}
          onKalemSec={(i, id) => {
            const kalem = kalemler.find(k => k.id === id)
            guncelle(i, { kalemId: id, birim: kalem?.temelBirim ?? '' })
          }}
          onGuncelle={guncelle}
          onEkle={() => setSatirlar(o => [...o, bosSatir()])}
          onSil={i => setSatirlar(o => o.filter((_, j) => j !== i))}
        />
      )}

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Yazılıyor…' : 'Deftere yaz'}
        </button>
      </div>
    </form>
  )
}

// ── Fark formu ─────────────────────────────────────────────────────────────
function FarkFormu({
  siparis, kalemler, onIptal, onKaydet,
}: {
  siparis: Siparis
  kalemler: KatalogKalemi[]
  onIptal: () => void
  onKaydet: (girdi: YeniFark) => Promise<void>
}){
  const [tur, setTur] = React.useState<FarkTuru>('Eksik')
  const [adim, setAdim] = React.useState<FarkAdimi>('Teslimde')
  const [kalemId, setKalemId] = React.useState('')
  const [miktar, setMiktar] = React.useState('')
  const [birim, setBirim] = React.useState('')
  const [aciklama, setAciklama] = React.useState('')
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  return (
    <form
      className="stacked-form"
      onSubmit={async e => {
        e.preventDefault()
        setGonderiliyor(true)
        try{
          await onKaydet({
            siparisId: siparis.id,
            tur, adim,
            kalemId: kalemId || undefined,
            miktar: miktar.trim() === '' ? undefined : sayiya(miktar),
            birim: birim.trim() || undefined,
            aciklama,
          })
        } finally { setGonderiliyor(false) }
      }}
    >
      <h4>Fark bildir</h4>
      <p className="muted detail-hint">
        Farkı ilk fark eden bayrağı kaldırır. Kaydı <strong>siz</strong>
        açıyorsunuz — oturumunuz kaydediliyor, forma isim yazılmıyor.
      </p>

      <div className="form-row">
        <label>Tür
          <select value={tur} onChange={e => setTur(e.target.value as FarkTuru)}>
            {FARK_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Nerede fark ettiniz
          <select value={adim} onChange={e => setAdim(e.target.value as FarkAdimi)}>
            {FARK_ADIMLARI.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>

      <label>Ürün
        <select
          value={kalemId}
          onChange={e => {
            setKalemId(e.target.value)
            const k = kalemler.find(x => x.id === e.target.value)
            if(k && birim.trim() === '') setBirim(k.temelBirim)
          }}
        >
          <option value="">— bütün sipariş</option>
          {kalemler.map(k => <option key={k.id} value={k.id}>{k.kod} · {k.ad}</option>)}
        </select>
      </label>

      <div className="form-row">
        <label>Miktar
          <input value={miktar} onChange={e => setMiktar(e.target.value)} placeholder="2" />
        </label>
        <label>Birim
          <input value={birim} onChange={e => setBirim(e.target.value)} placeholder="koli" />
        </label>
      </div>

      <label>Ne fark ettiniz *
        <textarea
          rows={2} value={aciklama} required
          placeholder="Müşteri 2 koli eksik geldi dedi"
          onChange={e => setAciklama(e.target.value)}
        />
      </label>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Kaydediliyor…' : 'Bayrağı kaldır'}
        </button>
      </div>
    </form>
  )
}

// ── Satır düzenleyici ──────────────────────────────────────────────────────
/**
 * Sipariş satırları.
 *
 * ⚠️ BİRİM ARTIK SERBEST METİN DEĞİL. 03.10'da alana "dasdasd" yazılabildi ve
 * sipariş kaydedildi; sonra Karşılama ve Teslim farkı o satırı "birimler
 * uyuşmuyor" diye hesaplayamadı. Hesap doğru davrandı, GİRİŞ yanlıştı.
 * Liste `uom` tablosundan geliyor (0002 + 0059).
 *
 * ⚠️ BİRİM KİLİTLENMEDİ, SINIRLANDI. Sipariş birimi, stok kartının defter
 * biriminden FARKLI olabilir — müşteri kendi belgesinde "2 palet" yazar,
 * deftersе kg tutulur (0050'nin kuralı). Kilitleseydik müşterinin belgesini
 * yazamazdık. Ama fark varsa ekran bunu SÖYLÜYOR, çünkü o satırda sevk ve
 * karşılama hesapları yapılamayacak.
 *
 * ⚠️ MİKTAR ve FİYAT Türkçe biçimde yazılıyor (12.450,75). Biçim yalnızca
 * ekrandadır; deftere giden sayı `sayiOku` ile çözülür.
 */
function SatirDuzenleyici({
  satirlar, kalemler, birimler, onKalemSec, onGuncelle, onEkle, onSil,
}: {
  satirlar: SatirTaslagi[]
  kalemler: KatalogKalemi[]
  birimler: Birim[]
  onKalemSec: (i: number, kalemId: string) => void
  onGuncelle: (i: number, yama: Partial<SatirTaslagi>) => void
  onEkle: () => void
  onSil: (i: number) => void
}){
  return (
    <>
      <p className="muted detail-hint">
        <strong>Satırlar.</strong> Miktar, firmanın kendi belgesindeki birimle
        giriliyor: palet, koli, kg. Çeviri stok tarafının işi.
      </p>
      {satirlar.map((s, i) => {
        const kalem = kalemler.find(k => k.id === s.kalemId)
        const birimAyri = kalem !== undefined && s.birim !== '' && s.birim !== kalem.temelBirim
        return (
        <div className="purchase-line" key={i}>
          <div className="form-row">
            <label>Ürün
              <select value={s.kalemId} onChange={e => onKalemSec(i, e.target.value)}>
                <option value="">Seçin…</option>
                {kalemler.map(k => <option key={k.id} value={k.id}>{k.kod} · {k.ad}</option>)}
              </select>
            </label>
            <label className="narrow">Miktar
              <input
                value={s.miktar} inputMode="decimal"
                onChange={e => onGuncelle(i, { miktar: sayiYazarken(e.target.value, 3) })}
              />
            </label>
            <label className="narrow">Birim
              <select
                value={s.birim}
                disabled={!s.kalemId}
                onChange={e => onGuncelle(i, { birim: e.target.value })}
              >
                <option value="">{s.kalemId ? 'Seçin…' : 'Önce ürün seçin'}</option>
                {birimler.map(b => (
                  <option key={b.kod} value={b.kod}>
                    {b.ad}{kalem && b.kod === kalem.temelBirim ? ' · stok birimi' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="narrow">Fiyat
              <input
                value={s.fiyat} inputMode="decimal"
                onChange={e => onGuncelle(i, { fiyat: sayiYazarken(e.target.value, 2) })}
              />
            </label>
          </div>
          {birimAyri && (
            <small className="is-critical">
              Bu satır <strong>{s.birim}</strong> ile yazıldı; stok kartının
              defter birimi <strong>{kalem!.temelBirim}</strong>. Sipariş böyle
              açılabilir, ama <strong>Karşılama</strong> ve{' '}
              <strong>Teslim farkı</strong> bu satırda sayı üretmez: iki birim
              arasında evrensel bir çevrim yoktur ve program tahmin etmez.
            </small>
          )}
          {satirlar.length > 1 && (
            <button className="btn" type="button" onClick={() => onSil(i)}>Satırı çıkar</button>
          )}
        </div>
        )
      })}
      <button className="btn" type="button" onClick={onEkle}>+ Satır</button>
    </>
  )
}
