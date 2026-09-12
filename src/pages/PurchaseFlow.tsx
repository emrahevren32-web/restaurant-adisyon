// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 / Depo çekirdeği — Satın alma ekranı
//
// Yol haritası maddesi: "Satın alma talebi ve siparişi"
//                       Bitti sayılır ki: "Talep → sipariş akışı uçtan uca"
//
// ── NEDEN TEK EKRAN, İKİ SEKME ───────────────────────────────────────────
// Talep ve sipariş ayrı kayıtlardır (bkz. 0018) ama tek bir HİKÂYENİN iki
// adımıdır: "buna ihtiyacım var" → "bunu şundan aldım". Ayrı menü ögelerine
// bölmek, kullanıcıyı akışın ortasında başka bir ekrana gönderirdi ve
// "talebim ne oldu" sorusu iki tık uzağa düşerdi.
//
// Eski `purchase-requests` / `purchase-orders` ekranları hâlâ localStorage
// üzerinde çalışıyor ve onlara dokunulmadı — ADR-003'ün dikey dilim
// yaklaşımı: yeni çekirdek yanına kurulur, eskisi geçiş bitene kadar durur.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { resolveStockRepositoryMode } from '../core/stock/index'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import { PostgresStokKatalogu, type Birim, type KatalogKalemi } from '../warehouse/warehouse.catalog'
import { cevrilebilirBirimler, DepoServisi } from '../warehouse/warehouse.service'
import { createStockRepository } from '../core/stock/index'
import { InMemoryStockItemLookup } from '../core/stock/stock-item-lookup'
import { PostgresMalKabulDeposu, type Kabul, type YeniKabul } from '../purchasing/goods-receipt.repository'
import {
  MalKabulServisi,
  kabulSatiriOner,
  siparisDurumu,
  siparisTeslimDurumu,
  type SiparisSatirDurumu,
} from '../purchasing/goods-receipt.service'
import { PostgresTedarikciDeposu, type Tedarikci } from '../purchasing/supplier.repository'
import {
  PostgresTedarikciIadeDeposu,
  TedarikciIadeServisi,
  kabulIadeDurumu,
  type Iade,
  type KabulSatirIadeDurumu,
  type YeniIade,
} from '../purchasing/supplier-return'
import { PostgresSatinAlmaDeposu } from '../purchasing/purchase.repository'
import { SatinAlmaServisi, sonrakiBelgeNo } from '../purchasing/purchase.service'
import {
  SIPARIS_DURUM_ETIKETLERI,
  SIPARIS_GECISLERI,
  TALEP_DURUM_ETIKETLERI,
  TALEP_GECISLERI,
  siparisToplami,
  type Siparis,
  type SiparisDurumu,
  type Talep,
  type TalepDurumu,
} from '../purchasing/purchase.types'

type Props = { currentUser: User }
type Sekme = 'talepler' | 'siparisler' | 'kabuller' | 'iadeler'

const sayiBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 })
const paraBicimi = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })
const bicimle = (deger: number) => sayiBicimi.format(deger)

const tarihBicimle = (deger?: string) => {
  if(!deger) return '—'
  const t = new Date(deger)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleDateString('tr-TR')
}

const hataMetni = (hata: unknown) =>
  hata instanceof Error ? hata.message : 'Beklenmeyen bir hata oluştu.'

/**
 * Tarih alanları için üst sınır.
 *
 * ── NEDEN GEREKLİ ────────────────────────────────────────────────────────
 * HTML tarih alanı yıl hanesini SINIRLAMAZ: kullanıcı bir tuşa fazla basınca
 * "23.02.32027" yazılabiliyor ve kayıt sessizce oluşuyor. Testte tam olarak
 * bu oldu. Beş haneli yıl bir yazım hatasıdır, bir tercih değil; ama ekran
 * onu tercih gibi kabul ederse hata veriye girer ve raporlarda sıralamayı
 * bozar.
 *
 * Alt sınır KOYMUYORUZ: geriye dönük kayıt meşrudur (mal dün geldi, bugün
 * giriliyor). Sınırlanması gereken tek yön ileriye doğru olan.
 */
const enGecTarih = (() => {
  const t = new Date()
  return `${t.getFullYear() + 10}-12-31`
})()

/** Durum rozetinin rengi. Bekleyen iş sarı, biten yeşil, kapanan gri. */
const durumSinifi = (durum: TalepDurumu | SiparisDurumu): string => {
  if(durum === 'APPROVED' || durum === 'RECEIVED') return 'success-pill'
  if(durum === 'SUBMITTED' || durum === 'SENT' || durum === 'PARTIAL') return 'warning-pill'
  if(durum === 'REJECTED' || durum === 'CANCELLED') return 'muted-pill'
  return 'info-pill'
}

type SatirTaslagi = {
  stokKalemiId: string
  miktar: string
  birim: string
  birimFiyat: string
}

const BOS_SATIR: SatirTaslagi = { stokKalemiId: '', miktar: '', birim: '', birimFiyat: '' }

export default function PurchaseFlow({ currentUser }: Props){
  const mod = resolveStockRepositoryMode()
  const yazabilir = !currentUser.permissions || currentUser.permissions.includes('purchase.write')

  const [sekme, setSekme] = React.useState<Sekme>('talepler')
  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [kalemler, setKalemler] = React.useState<KatalogKalemi[]>([])
  const [birimler, setBirimler] = React.useState<Birim[]>([])
  const [tedarikciler, setTedarikciler] = React.useState<Tedarikci[]>([])
  const [talepler, setTalepler] = React.useState<Talep[]>([])
  const [siparisler, setSiparisler] = React.useState<Siparis[]>([])
  const [kabuller, setKabuller] = React.useState<Kabul[]>([])
  const [iadeler, setIadeler] = React.useState<Iade[]>([])
  const [seciliTalepId, setSeciliTalepId] = React.useState<string | null>(null)
  const [seciliSiparisId, setSeciliSiparisId] = React.useState<string | null>(null)
  const [seciliKabulId, setSeciliKabulId] = React.useState<string | null>(null)
  const [seciliIadeId, setSeciliIadeId] = React.useState<string | null>(null)
  const [yeniForm, setYeniForm] = React.useState<Sekme | 'siparise-cevir' | 'mal-kabul' | 'iade' | null>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')

  const servis = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    return new SatinAlmaServisi(new PostgresSatinAlmaDeposu(getSupabase()))
  }, [mod])

  /**
   * Mal kabul servisi, stok defterine `DepoServisi` üzerinden yazar — bu ekran
   * deftere DOĞRUDAN dokunmaz. `InMemoryStockItemLookup([])` yalnızca "local"
   * modda anlamlıdır; postgres modunda aynı kontrolü veritabanı tetikleyicisi
   * yapar (bkz. core/stock/index.ts ve Depo ekranındaki aynı kurulum).
   */
  const kabulServisi = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    const client = getSupabase()
    return new MalKabulServisi(
      new PostgresMalKabulDeposu(client),
      new DepoServisi(
        createStockRepository(new InMemoryStockItemLookup([])),
        new PostgresStokKatalogu(client),
      ),
    )
  }, [mod])

  /**
   * İade servisi mal kabul servisiyle AYNI depo servisini kullanır — çünkü
   * ikisi de aynı deftere yazar. İade çıkış, kabul giriş; kapı tek.
   */
  const iadeServisi = React.useMemo(() => {
    if(mod !== 'postgres' || !isSupabaseConfigured()) return null
    const client = getSupabase()
    return new TedarikciIadeServisi(
      new PostgresTedarikciIadeDeposu(client),
      new DepoServisi(
        createStockRepository(new InMemoryStockItemLookup([])),
        new PostgresStokKatalogu(client),
      ),
    )
  }, [mod])

  const yenile = React.useCallback(async (aktif: DepoBaglami) => {
    if(!servis || !kabulServisi || !iadeServisi) return
    const [t, s, k, i] = await Promise.all([
      servis.talepler(aktif.ctx),
      servis.siparisler(aktif.ctx),
      kabulServisi.hepsi(aktif.ctx),
      iadeServisi.hepsi(aktif.ctx),
    ])
    setTalepler(t)
    setSiparisler(s)
    setKabuller(k)
    setIadeler(i)
  }, [servis, kabulServisi, iadeServisi])

  React.useEffect(() => {
    let iptal = false
    if(!servis){ setYukleniyor(false); return }

    ;(async () => {
      try{
        const kurulan = await depoBaglamiKur(getSupabase())
        if(iptal) return
        setBaglam(kurulan)

        const katalog = new PostgresStokKatalogu(getSupabase())
        const [kalemListesi, birimListesi, tedarikciListesi, t, s, k, i] = await Promise.all([
          katalog.kalemler(kurulan.ctx),
          katalog.birimler(),
          new PostgresTedarikciDeposu(getSupabase()).hepsi(kurulan.ctx),
          servis.talepler(kurulan.ctx),
          servis.siparisler(kurulan.ctx),
          kabulServisi!.hepsi(kurulan.ctx),
          iadeServisi!.hepsi(kurulan.ctx),
        ])
        if(iptal) return
        setKalemler(kalemListesi.filter(k => k.aktif))
        setBirimler(birimListesi)
        setTedarikciler(tedarikciListesi)
        setTalepler(t)
        setSiparisler(s)
        setKabuller(k)
        setIadeler(i)
      } catch (e) {
        if(!iptal) setHata(hataMetni(e))
      } finally {
        if(!iptal) setYukleniyor(false)
      }
    })()

    return () => { iptal = true }
  }, [servis, kabulServisi, iadeServisi])

  const seciliTalep = talepler.find(t => t.id === seciliTalepId) ?? null
  const seciliSiparis = siparisler.find(s => s.id === seciliSiparisId) ?? null
  const seciliKabul = kabuller.find(k => k.id === seciliKabulId) ?? null
  const seciliIade = iadeler.find(i => i.id === seciliIadeId) ?? null
  const aktifTedarikciler = tedarikciler.filter(t => t.aktif)

  if(mod !== 'postgres' || !isSupabaseConfigured()){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Satın Alma</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekran gerçek veritabanı ile çalışır.</strong></p>
          <p>Talep ve sipariş kayıtları, mal kabulde stok defterine bağlanacak.</p>
        </section>
      </div>
    )
  }

  if(yukleniyor){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Satın Alma</h2></div></div>
        <section className="card empty-state">Yükleniyor…</section>
      </div>
    )
  }

  if(!baglam){
    return (
      <div className="warehouse-page">
        <div className="page-title"><div><h2>Satın Alma</h2></div></div>
        <section className="card empty-state">{hata || 'Çalışma alanı çözülemedi.'}</section>
      </div>
    )
  }

  const sonrasi = async (mesaj: string) => {
    setBilgi(mesaj)
    setHata('')
    setYeniForm(null)
    await yenile(baglam)
  }

  const talepDurum = async (talep: Talep, durum: TalepDurumu) => {
    try{
      let kararNotu: string | undefined
      if(durum === 'REJECTED'){
        // Gerekçesiz ret, aynı talebin bir hafta sonra aynı şekilde tekrar
        // açılması demektir. Servis de bunu zorunlu tutuyor.
        const girilen = window.prompt('Reddetme gerekçesi:')
        if(girilen === null) return
        kararNotu = girilen
      }
      const guncel = await servis!.talepDurumDegistir(baglam.ctx, talep, durum, kararNotu)
      await sonrasi(`${talep.talepNo}: ${TALEP_DURUM_ETIKETLERI[guncel.durum]}.`)
    } catch (e) { setHata(hataMetni(e)) }
  }

  /**
   * Mal kabulü yapar ve siparişin teslim durumunu GÜNCELLER.
   *
   * Sıra önemlidir: önce defter, sonra sipariş. Ters sırada olsaydı, defter
   * yazması düştüğünde sipariş "teslim alındı" görünürdü — depoda olmayan bir
   * mal için.
   */
  const malKabulYap = async (girdi: YeniKabul) => {
    if(!seciliSiparis) return
    try{
      const kabul = await kabulServisi!.kabulEt(
        baglam.ctx,
        girdi,
        id => kalemler.find(k => k.id === id)?.lotTakipli ?? false,
        id => kalemler.find(k => k.id === id)?.sktTakipli ?? false,
      )

      // Defter yazıldı. Şimdi siparişin ne kadarının geldiğini yeniden hesapla.
      const guncelKabuller = await kabulServisi!.hepsi(baglam.ctx)
      const teslim = siparisTeslimDurumu(siparisDurumu(seciliSiparis, guncelKabuller))
      if(teslim) await servis!.teslimDurumunuGuncelle(baglam.ctx, seciliSiparis, teslim)

      setSekme('kabuller')
      setSeciliKabulId(kabul.id)
      await sonrasi(
        `${kabul.kabulNo} işlendi. Kabul edilen miktar stok defterine yazıldı; `
        + 'Depo ekranındaki bakiye şimdiden güncel.',
      )
    } catch (e) { setHata(hataMetni(e)) }
  }

  const kabulTekrarDene = async (kabul: Kabul) => {
    try{
      const guncel = await kabulServisi!.tekrarDene(baglam.ctx, kabul)
      await sonrasi(`${guncel.kabulNo} tamamlandı.`)
    } catch (e) { setHata(hataMetni(e)) }
  }

  /**
   * İadeyi işler.
   *
   * Mal kabulün AYNASI: kabul deftere giriş yazar, iade çıkış. Aradaki tek
   * fark yön; belge, idempotency ve yarım kalma davranışı aynı.
   */
  const iadeYap = async (girdi: YeniIade) => {
    if(!seciliKabul) return
    try{
      const iade = await iadeServisi!.iadeEt(baglam.ctx, girdi, seciliKabul, iadeler)
      setSekme('iadeler')
      setSeciliIadeId(iade.id)
      await sonrasi(
        `${iade.iadeNo} işlendi. İade edilen miktar stok defterinden ÇIKIŞ olarak `
        + 'düşüldü; Depo ekranındaki bakiye azaldı.',
      )
    } catch (e) { setHata(hataMetni(e)) }
  }

  const iadeTekrarDene = async (iade: Iade) => {
    try{
      const guncel = await iadeServisi!.tekrarDene(baglam.ctx, iade)
      await sonrasi(`${guncel.iadeNo} tamamlandı.`)
    } catch (e) { setHata(hataMetni(e)) }
  }

  const siparisDurum = async (siparis: Siparis, durum: SiparisDurumu) => {
    try{
      const guncel = await servis!.siparisDurumDegistir(baglam.ctx, siparis, durum)
      await sonrasi(`${siparis.siparisNo}: ${SIPARIS_DURUM_ETIKETLERI[guncel.durum]}.`)
    } catch (e) { setHata(hataMetni(e)) }
  }

  return (
    <div className="warehouse-page">
      <div className="page-title">
        <div>
          <h2>Satın Alma</h2>
          <p className="muted">Aşama 2 · Talep → onay → sipariş</p>
        </div>
        {yazabilir && (sekme === 'talepler' || sekme === 'siparisler') && (
          <button
            className="btn primary"
            onClick={() => { setYeniForm(sekme); setHata(''); setBilgi('') }}
          >
            {sekme === 'talepler' ? 'Yeni Talep' : 'Yeni Sipariş'}
          </button>
        )}
      </div>

      <div className="purchase-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={sekme === 'talepler'}
          className={sekme === 'talepler' ? 'is-active' : ''}
          onClick={() => { setSekme('talepler'); setYeniForm(null) }}
        >
          Talepler <span className="purchase-tab-count">{talepler.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={sekme === 'siparisler'}
          className={sekme === 'siparisler' ? 'is-active' : ''}
          onClick={() => { setSekme('siparisler'); setYeniForm(null) }}
        >
          Siparişler <span className="purchase-tab-count">{siparisler.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={sekme === 'kabuller'}
          className={sekme === 'kabuller' ? 'is-active' : ''}
          onClick={() => { setSekme('kabuller'); setYeniForm(null) }}
        >
          Mal Kabul <span className="purchase-tab-count">{kabuller.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={sekme === 'iadeler'}
          className={sekme === 'iadeler' ? 'is-active' : ''}
          onClick={() => { setSekme('iadeler'); setYeniForm(null) }}
        >
          İadeler <span className="purchase-tab-count">{iadeler.length}</span>
        </button>
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-info">{bilgi}</div>}

      <div className="warehouse-layout">
        <section className="card warehouse-main">
          {sekme === 'talepler' && (
            <TalepListesi
              talepler={talepler}
              seciliId={seciliTalepId}
              onSec={id => { setSeciliTalepId(id); setYeniForm(null) }}
            />
          )}
          {sekme === 'siparisler' && (
            <SiparisListesi
              siparisler={siparisler}
              seciliId={seciliSiparisId}
              onSec={id => { setSeciliSiparisId(id); setYeniForm(null) }}
            />
          )}
          {sekme === 'kabuller' && (
            <KabulListesi
              kabuller={kabuller}
              seciliId={seciliKabulId}
              onSec={id => { setSeciliKabulId(id); setYeniForm(null) }}
            />
          )}
          {sekme === 'iadeler' && (
            <IadeListesi
              iadeler={iadeler}
              seciliId={seciliIadeId}
              onSec={id => { setSeciliIadeId(id); setYeniForm(null) }}
            />
          )}
        </section>

        <aside className="warehouse-side">
          {yeniForm === 'talepler' && (
            <section className="card">
              <div className="section-header compact"><h3>Yeni Talep</h3></div>
              <TalepFormu
                kalemler={kalemler}
                birimler={birimler}
                onerilenNo={sonrakiBelgeNo('SAT', talepler.map(t => t.talepNo))}
                onIptal={() => setYeniForm(null)}
                onKaydet={async girdi => {
                  try{
                    const yeni = await servis!.talepAc(baglam.ctx, girdi)
                    setSeciliTalepId(yeni.id)
                    await sonrasi(`${yeni.talepNo} açıldı. Onaya göndermeye hazır.`)
                  } catch (e) { setHata(hataMetni(e)) }
                }}
              />
            </section>
          )}

          {yeniForm === 'siparisler' && (
            <section className="card">
              <div className="section-header compact"><h3>Yeni Sipariş</h3></div>
              <SiparisFormu
                kalemler={kalemler}
                birimler={birimler}
                tedarikciler={aktifTedarikciler}
                onerilenNo={sonrakiBelgeNo('SIP', siparisler.map(s => s.siparisNo))}
                onIptal={() => setYeniForm(null)}
                onKaydet={async girdi => {
                  try{
                    const yeni = await servis!.siparisAc(baglam.ctx, girdi)
                    setSekme('siparisler')
                    setSeciliSiparisId(yeni.id)
                    await sonrasi(`${yeni.siparisNo} açıldı.`)
                  } catch (e) { setHata(hataMetni(e)) }
                }}
              />
            </section>
          )}

          {yeniForm === 'siparise-cevir' && seciliTalep && (
            <section className="card">
              <div className="section-header compact"><h3>{seciliTalep.talepNo} → Sipariş</h3></div>
              <SipariseCevirFormu
                talep={seciliTalep}
                tedarikciler={aktifTedarikciler}
                onerilenNo={sonrakiBelgeNo('SIP', siparisler.map(s => s.siparisNo))}
                onIptal={() => setYeniForm(null)}
                onKaydet={async (bilgiler, fiyatlar) => {
                  try{
                    const yeni = await servis!.talepteSiparisOlustur(baglam.ctx, seciliTalep, {
                      ...bilgiler, fiyatlar,
                    })
                    setSekme('siparisler')
                    setSeciliSiparisId(yeni.id)
                    await sonrasi(`${yeni.siparisNo} oluşturuldu.`)
                  } catch (e) { setHata(hataMetni(e)) }
                }}
              />
            </section>
          )}

          {!yeniForm && sekme === 'talepler' && seciliTalep && (
            <TalepDetayi
              talep={seciliTalep}
              yazabilir={yazabilir}
              onDurum={durum => { void talepDurum(seciliTalep, durum) }}
              onSipariseCevir={() => { setYeniForm('siparise-cevir'); setHata('') }}
            />
          )}

          {!yeniForm && sekme === 'siparisler' && seciliSiparis && (
            <SiparisDetayi
              siparis={seciliSiparis}
              durumlar={siparisDurumu(seciliSiparis, kabuller)}
              yazabilir={yazabilir}
              onDurum={durum => { void siparisDurum(seciliSiparis, durum) }}
              onMalKabul={() => { setYeniForm('mal-kabul'); setHata(''); setBilgi('') }}
            />
          )}

          {yeniForm === 'mal-kabul' && seciliSiparis && (
            <section className="card">
              <div className="section-header compact"><h3>{seciliSiparis.siparisNo} · Mal Kabul</h3></div>
              <MalKabulFormu
                siparis={seciliSiparis}
                durumlar={siparisDurumu(seciliSiparis, kabuller)}
                kalemler={kalemler}
                onerilenNo={sonrakiBelgeNo('MK', kabuller.map(k => k.kabulNo))}
                onIptal={() => setYeniForm(null)}
                onKaydet={malKabulYap}
              />
            </section>
          )}

          {!yeniForm && sekme === 'kabuller' && seciliKabul && (
            <KabulDetayi
              kabul={seciliKabul}
              iadeDurumlari={kabulIadeDurumu(seciliKabul, iadeler)}
              yazabilir={yazabilir}
              onTekrarDene={() => { void kabulTekrarDene(seciliKabul) }}
              onIade={() => { setYeniForm('iade'); setHata(''); setBilgi('') }}
            />
          )}

          {yeniForm === 'iade' && seciliKabul && (
            <section className="card">
              <div className="section-header compact"><h3>{seciliKabul.kabulNo} · Tedarikçiye İade</h3></div>
              <IadeFormu
                kabul={seciliKabul}
                durumlar={kabulIadeDurumu(seciliKabul, iadeler)}
                onerilenNo={sonrakiBelgeNo('IAD', iadeler.map(i => i.iadeNo))}
                onIptal={() => setYeniForm(null)}
                onKaydet={iadeYap}
              />
            </section>
          )}

          {!yeniForm && sekme === 'iadeler' && seciliIade && (
            <IadeDetayi
              iade={seciliIade}
              yazabilir={yazabilir}
              onTekrarDene={() => { void iadeTekrarDene(seciliIade) }}
            />
          )}

          {!yeniForm && (
            (sekme === 'talepler' && !seciliTalep)
            || (sekme === 'siparisler' && !seciliSiparis)
            || (sekme === 'kabuller' && !seciliKabul)
            || (sekme === 'iadeler' && !seciliIade)
          ) && (
            <section className="card empty-state">
              {sekme === 'talepler' && 'Talep, "buna ihtiyacım var" demektir: tedarikçi ve fiyat içermez. Onaylandıktan sonra siparişe dönüşür.'}
              {sekme === 'siparisler' && 'Sipariş bir taahhüttür: tedarikçi ve fiyat bellidir. Mal geldiğinde bu siparişten kabul yapılır.'}
              {sekme === 'kabuller' && 'Mal kabul, zincirin depoya indiği yerdir: kabul edilen miktar stok defterine yazılır, lot ve son kullanma tarihi orada kayıt altına alınır.'}
              {sekme === 'iadeler' && 'İade, kapıda reddetmekten farklıdır: mal zaten depoya girmişti, şimdi geri gidiyor. Bu yüzden deftere ÇIKIŞ olarak yazılır. İade başlatmak için Mal Kabul sekmesinden ilgili kabul belgesini açın.'}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Listeler
// ═══════════════════════════════════════════════════════════════════════════

function TalepListesi({
  talepler, seciliId, onSec,
}: {
  talepler: Talep[]
  seciliId: string | null
  onSec: (id: string) => void
}){
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr><th>Talep No</th><th>Durum</th><th className="num">Kalem</th><th>Gereken</th><th>Açılış</th></tr>
        </thead>
        <tbody>
          {talepler.length === 0 && (
            <tr><td colSpan={5} className="muted">Henüz talep yok. İlk talebi açarak başlayın.</td></tr>
          )}
          {talepler.map(talep => (
            <tr
              key={talep.id}
              className={talep.id === seciliId ? 'is-selected' : ''}
              onClick={() => onSec(talep.id)}
            >
              <td>{talep.talepNo}</td>
              <td><span className={`status-pill ${durumSinifi(talep.durum)}`}>{TALEP_DURUM_ETIKETLERI[talep.durum]}</span></td>
              <td className="num">{talep.satirlar.length}</td>
              <td className="muted">{tarihBicimle(talep.gerekenTarih)}</td>
              <td className="muted">{tarihBicimle(talep.olusturmaTarihi)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SiparisListesi({
  siparisler, seciliId, onSec,
}: {
  siparisler: Siparis[]
  seciliId: string | null
  onSec: (id: string) => void
}){
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Sipariş No</th><th>Tedarikçi</th><th>Durum</th>
            <th className="num">Kalem</th><th className="num">Tutar</th><th>Beklenen</th>
          </tr>
        </thead>
        <tbody>
          {siparisler.length === 0 && (
            <tr><td colSpan={6} className="muted">Henüz sipariş yok.</td></tr>
          )}
          {siparisler.map(siparis => (
            <tr
              key={siparis.id}
              className={siparis.id === seciliId ? 'is-selected' : ''}
              onClick={() => onSec(siparis.id)}
            >
              <td>{siparis.siparisNo}</td>
              <td>{siparis.tedarikciAd ?? '—'}</td>
              <td><span className={`status-pill ${durumSinifi(siparis.durum)}`}>{SIPARIS_DURUM_ETIKETLERI[siparis.durum]}</span></td>
              <td className="num">{siparis.satirlar.length}</td>
              <td className="num">{paraBicimi.format(siparisToplami(siparis.satirlar))}</td>
              <td className="muted">{tarihBicimle(siparis.beklenenTarih)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Detaylar
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Düğmeler `TALEP_GECISLERI` tablosundan üretiliyor — elle yazılmıyor.
 *
 * Elle yazılsaydı, kural değiştiğinde ekranı güncellemeyi unutmak mümkün
 * olurdu: kullanıcı bir düğme görür, basar, servis reddeder. Aynı tablodan
 * okuyarak ekran ile kuralın ayrışması imkânsız hâle geliyor.
 */
const TALEP_EYLEM_ETIKETLERI: Record<TalepDurumu, string> = {
  DRAFT: 'Taslağa al',
  SUBMITTED: 'Onaya gönder',
  APPROVED: 'Onayla',
  REJECTED: 'Reddet',
  CANCELLED: 'İptal et',
}

const SIPARIS_EYLEM_ETIKETLERI: Record<SiparisDurumu, string> = {
  DRAFT: 'Taslağa al',
  SENT: 'Tedarikçiye gönder',
  PARTIAL: 'Kısmen teslim',
  RECEIVED: 'Teslim alındı',
  CANCELLED: 'İptal et',
}

function TalepDetayi({
  talep, yazabilir, onDurum, onSipariseCevir,
}: {
  talep: Talep
  yazabilir: boolean
  onDurum: (durum: TalepDurumu) => void
  onSipariseCevir: () => void
}){
  return (
    <>
      <section className="card">
        <div className="section-header compact">
          <h3>{talep.talepNo}</h3>
          <span className={`status-pill ${durumSinifi(talep.durum)}`}>{TALEP_DURUM_ETIKETLERI[talep.durum]}</span>
        </div>

        <dl className="detail-grid">
          <dt>Gereken tarih</dt><dd>{tarihBicimle(talep.gerekenTarih)}</dd>
          <dt>Açılış</dt><dd>{tarihBicimle(talep.olusturmaTarihi)}</dd>
          {talep.not && (<><dt>Not</dt><dd>{talep.not}</dd></>)}
          {talep.kararNotu && (<><dt>Karar notu</dt><dd>{talep.kararNotu}</dd></>)}
        </dl>

        <div className="table-wrap">
          <table className="data-table compact">
            <thead><tr><th>Kalem</th><th className="num">Miktar</th><th>Birim</th></tr></thead>
            <tbody>
              {talep.satirlar.map(satir => (
                <tr key={satir.id}>
                  <td>{satir.stokKalemiAd ?? satir.stokKalemiId}</td>
                  <td className="num">{bicimle(satir.miktar)}</td>
                  <td className="muted">{satir.birim}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {yazabilir && (
          <div className="form-actions wrap">
            {TALEP_GECISLERI[talep.durum].map(durum => (
              <button
                key={durum}
                type="button"
                className={durum === 'APPROVED' ? 'btn primary' : 'btn'}
                onClick={() => onDurum(durum)}
              >
                {TALEP_EYLEM_ETIKETLERI[durum]}
              </button>
            ))}
            {talep.durum === 'APPROVED' && (
              <button type="button" className="btn primary" onClick={onSipariseCevir}>
                Siparişe dönüştür
              </button>
            )}
          </div>
        )}

        {talep.durum === 'DRAFT' && (
          <p className="muted detail-hint">
            Taslak talep kimseye görünmez. Onaya gönderdiğinizde yöneticinin listesine düşer.
          </p>
        )}
      </section>
    </>
  )
}

function SiparisDetayi({
  siparis, durumlar, yazabilir, onDurum, onMalKabul,
}: {
  siparis: Siparis
  durumlar: SiparisSatirDurumu[]
  yazabilir: boolean
  onDurum: (durum: SiparisDurumu) => void
  onMalKabul: () => void
}){
  const toplam = siparisToplami(siparis.satirlar)
  const fiyatsizVar = siparis.satirlar.some(s => s.birimFiyat <= 0)
  const teslimBasladi = durumlar.some(d => d.kabulEdilen > 0 || d.reddedilen > 0)
  const malBekleniyor = siparis.durum === 'SENT' || siparis.durum === 'PARTIAL'

  return (
    <section className="card">
      <div className="section-header compact">
        <h3>{siparis.siparisNo}</h3>
        <span className={`status-pill ${durumSinifi(siparis.durum)}`}>{SIPARIS_DURUM_ETIKETLERI[siparis.durum]}</span>
      </div>

      <dl className="detail-grid">
        <dt>Tedarikçi</dt><dd>{siparis.tedarikciAd ?? '—'}</dd>
        <dt>Beklenen tarih</dt><dd>{tarihBicimle(siparis.beklenenTarih)}</dd>
        {siparis.talepId && (<><dt>Kaynak</dt><dd className="muted">Bir talepten oluşturuldu</dd></>)}
        {siparis.gonderimTarihi && (<><dt>Gönderildi</dt><dd>{tarihBicimle(siparis.gonderimTarihi)}</dd></>)}
        {siparis.not && (<><dt>Not</dt><dd>{siparis.not}</dd></>)}
      </dl>

      <div className="table-wrap">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Kalem</th><th className="num">Sipariş</th>
              {teslimBasladi && <><th className="num">Gelen</th><th className="num">Kalan</th></>}
              <th>Birim</th><th className="num">Birim Fiyat</th><th className="num">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {siparis.satirlar.map((satir, i) => {
              const durum = durumlar[i]
              return (
                <tr key={satir.id}>
                  <td>{satir.stokKalemiAd ?? satir.stokKalemiId}</td>
                  <td className="num">{bicimle(satir.miktar)}</td>
                  {teslimBasladi && (
                    <>
                      <td className="num">{bicimle(durum?.kabulEdilen ?? 0)}</td>
                      <td className={`num ${durum && !durum.tamamlandi ? 'is-critical' : ''}`}>
                        {bicimle(durum?.kalan ?? 0)}
                      </td>
                    </>
                  )}
                  <td className="muted">{satir.birim}</td>
                  <td className={`num ${satir.birimFiyat <= 0 ? 'is-critical' : ''}`}>
                    {satir.birimFiyat > 0 ? paraBicimi.format(satir.birimFiyat) : '—'}
                  </td>
                  <td className="num">{paraBicimi.format(satir.miktar * satir.birimFiyat)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={teslimBasladi ? 6 : 4}>Toplam</td>
              <td className="num"><strong>{paraBicimi.format(toplam)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {fiyatsizVar && siparis.durum === 'DRAFT' && (
        <p className="muted detail-hint">
          Fiyatı girilmemiş kalem var. Sipariş gönderilemez: fiyatsız alım, malın
          maliyetini sıfır gösterir.
        </p>
      )}

      {yazabilir && (malBekleniyor || SIPARIS_GECISLERI[siparis.durum].length > 0) && (
        <div className="form-actions wrap">
          {yazabilir && malBekleniyor && (
            <button type="button" className="btn primary" onClick={onMalKabul}>
              Mal Kabul Yap
            </button>
          )}
          {SIPARIS_GECISLERI[siparis.durum].map(durum => (
            <button
              key={durum}
              type="button"
              className={durum === 'SENT' ? 'btn primary' : 'btn'}
              onClick={() => onDurum(durum)}
            >
              {SIPARIS_EYLEM_ETIKETLERI[durum]}
            </button>
          ))}
        </div>
      )}

      {(siparis.durum === 'SENT' || siparis.durum === 'PARTIAL') && (
        <p className="muted detail-hint">
          Teslim durumu buradan seçilmez; mal kabul yapıldığında kendiliğinden değişir.
        </p>
      )}
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Formlar
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Kalem satırları düzenleyicisi — talep ve sipariş formu ortak kullanıyor.
 *
 * Birim listesi kalemin TEMEL birimine çevrilebilenlerle sınırlı. Kullanıcıya
 * seçemeyeceği bir birim göstermek (adet ile ölçülen bir kaleme "kg" sunmak),
 * hatayı forma değil kaydet düğmesine ertelemek olurdu.
 */
function SatirDuzenleyici({
  satirlar, kalemler, birimler, fiyatVar, onDegis,
}: {
  satirlar: SatirTaslagi[]
  kalemler: KatalogKalemi[]
  birimler: Birim[]
  fiyatVar: boolean
  onDegis: (satirlar: SatirTaslagi[]) => void
}){
  const birimKodlari = React.useMemo(() => birimler.map(b => b.kod), [birimler])

  const guncelle = (sira: number, yama: Partial<SatirTaslagi>) => {
    onDegis(satirlar.map((satir, i) => (i === sira ? { ...satir, ...yama } : satir)))
  }

  return (
    <div className="purchase-lines">
      {satirlar.map((satir, sira) => {
        const kalem = kalemler.find(k => k.id === satir.stokKalemiId)
        const secilebilirBirimler = kalem
          ? cevrilebilirBirimler(kalem.temelBirim, birimKodlari)
          : birimKodlari

        return (
          <div className="purchase-line" key={sira}>
            <label>
              Kalem
              <select
                value={satir.stokKalemiId}
                onChange={event => {
                  const yeni = kalemler.find(k => k.id === event.target.value)
                  guncelle(sira, {
                    stokKalemiId: event.target.value,
                    // Birim, kalem seçilince temel birime düşer: en sık doğru olan
                    // seçim budur ve kullanıcı isterse değiştirir.
                    birim: yeni?.temelBirim ?? '',
                  })
                }}
              >
                <option value="">Seçin…</option>
                {kalemler.map(k => (
                  <option key={k.id} value={k.id}>{k.kod} · {k.ad}</option>
                ))}
              </select>
            </label>

            <label className="narrow">
              Miktar
              <input
                type="number"
                min="0"
                step="any"
                value={satir.miktar}
                onChange={event => guncelle(sira, { miktar: event.target.value })}
              />
            </label>

            <label className="narrow">
              Birim
              <select value={satir.birim} onChange={event => guncelle(sira, { birim: event.target.value })}>
                <option value="">—</option>
                {secilebilirBirimler.map(kod => <option key={kod} value={kod}>{kod}</option>)}
              </select>
            </label>

            {fiyatVar && (
              <label className="narrow">
                Birim Fiyat
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={satir.birimFiyat}
                  onChange={event => guncelle(sira, { birimFiyat: event.target.value })}
                />
              </label>
            )}

            <button
              type="button"
              className="btn ghost purchase-line-remove"
              aria-label={`${sira + 1}. kalemi çıkar`}
              disabled={satirlar.length === 1}
              onClick={() => onDegis(satirlar.filter((_, i) => i !== sira))}
            >
              ✕
            </button>
          </div>
        )
      })}

      <button
        type="button"
        className="btn"
        onClick={() => onDegis([...satirlar, { ...BOS_SATIR }])}
      >
        + Kalem ekle
      </button>
    </div>
  )
}

const sayiyaCevir = (deger: string): number => {
  const n = Number(String(deger).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function TalepFormu({
  kalemler, birimler, onerilenNo, onIptal, onKaydet,
}: {
  kalemler: KatalogKalemi[]
  birimler: Birim[]
  onerilenNo: string
  onIptal: () => void
  onKaydet: (girdi: {
    talepNo: string; gerekenTarih?: string; not?: string
    satirlar: Array<{ stokKalemiId: string; miktar: number; birim: string }>
  }) => Promise<void>
}){
  const [talepNo, setTalepNo] = React.useState(onerilenNo)
  const [gerekenTarih, setGerekenTarih] = React.useState('')
  const [not, setNot] = React.useState('')
  const [satirlar, setSatirlar] = React.useState<SatirTaslagi[]>([{ ...BOS_SATIR }])
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  return (
    <form
      className="stacked-form"
      onSubmit={async event => {
        event.preventDefault()
        setGonderiliyor(true)
        try{
          await onKaydet({
            talepNo,
            gerekenTarih: gerekenTarih || undefined,
            not: not.trim() || undefined,
            satirlar: satirlar.map(s => ({
              stokKalemiId: s.stokKalemiId,
              miktar: sayiyaCevir(s.miktar),
              birim: s.birim,
            })),
          })
        } finally { setGonderiliyor(false) }
      }}
    >
      <label>
        Talep No *
        <input value={talepNo} onChange={e => setTalepNo(e.target.value)} required />
      </label>
      <label>
        Gereken tarih
        <input type="date" max={enGecTarih} value={gerekenTarih} onChange={e => setGerekenTarih(e.target.value)} />
        <small className="muted">Ne zamana kadar lazım? Onaylayan buna bakar.</small>
      </label>

      <SatirDuzenleyici
        satirlar={satirlar}
        kalemler={kalemler}
        birimler={birimler}
        fiyatVar={false}
        onDegis={setSatirlar}
      />

      <label>
        Not
        <textarea rows={2} value={not} onChange={e => setNot(e.target.value)} />
      </label>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Kaydediliyor…' : 'Talebi Aç'}
        </button>
      </div>
    </form>
  )
}

function SiparisFormu({
  kalemler, birimler, tedarikciler, onerilenNo, onIptal, onKaydet,
}: {
  kalemler: KatalogKalemi[]
  birimler: Birim[]
  tedarikciler: Tedarikci[]
  onerilenNo: string
  onIptal: () => void
  onKaydet: (girdi: {
    siparisNo: string; tedarikciId: string; beklenenTarih?: string; not?: string
    satirlar: Array<{ stokKalemiId: string; miktar: number; birim: string; birimFiyat: number }>
  }) => Promise<void>
}){
  const [siparisNo, setSiparisNo] = React.useState(onerilenNo)
  const [tedarikciId, setTedarikciId] = React.useState('')
  const [beklenenTarih, setBeklenenTarih] = React.useState('')
  const [not, setNot] = React.useState('')
  const [satirlar, setSatirlar] = React.useState<SatirTaslagi[]>([{ ...BOS_SATIR }])
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  if(tedarikciler.length === 0){
    return (
      <div className="empty-state">
        <p><strong>Önce tedarikçi eklemelisiniz.</strong></p>
        <p>Sipariş bir taahhüttür; kimden alındığı belli olmadan açılamaz.</p>
        <div className="form-actions"><button className="btn" type="button" onClick={onIptal}>Kapat</button></div>
      </div>
    )
  }

  return (
    <form
      className="stacked-form"
      onSubmit={async event => {
        event.preventDefault()
        setGonderiliyor(true)
        try{
          await onKaydet({
            siparisNo,
            tedarikciId,
            beklenenTarih: beklenenTarih || undefined,
            not: not.trim() || undefined,
            satirlar: satirlar.map(s => ({
              stokKalemiId: s.stokKalemiId,
              miktar: sayiyaCevir(s.miktar),
              birim: s.birim,
              birimFiyat: sayiyaCevir(s.birimFiyat),
            })),
          })
        } finally { setGonderiliyor(false) }
      }}
    >
      <label>
        Sipariş No *
        <input value={siparisNo} onChange={e => setSiparisNo(e.target.value)} required />
      </label>
      <label>
        Tedarikçi *
        <select value={tedarikciId} onChange={e => setTedarikciId(e.target.value)} required>
          <option value="">Seçin…</option>
          {tedarikciler.map(t => <option key={t.id} value={t.id}>{t.kod} · {t.ad}</option>)}
        </select>
      </label>
      <label>
        Beklenen tarih
        <input type="date" max={enGecTarih} value={beklenenTarih} onChange={e => setBeklenenTarih(e.target.value)} />
      </label>

      <SatirDuzenleyici
        satirlar={satirlar}
        kalemler={kalemler}
        birimler={birimler}
        fiyatVar
        onDegis={setSatirlar}
      />

      <label>
        Not
        <textarea rows={2} value={not} onChange={e => setNot(e.target.value)} />
      </label>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Kaydediliyor…' : 'Siparişi Aç'}
        </button>
      </div>
    </form>
  )
}

/**
 * Onaylı talebi siparişe çevirir.
 *
 * Kalemler ve miktarlar DEĞİŞTİRİLEMEZ — onaylanan buydu. Değiştirilebilir
 * olsaydı onay imzası anlamını yitirirdi: yönetici 40 kg onaylar, sipariş
 * 400 kg gider. Burada eklenen tek şey satın almanın bildiği bilgi:
 * tedarikçi ve fiyat.
 */
function SipariseCevirFormu({
  talep, tedarikciler, onerilenNo, onIptal, onKaydet,
}: {
  talep: Talep
  tedarikciler: Tedarikci[]
  onerilenNo: string
  onIptal: () => void
  onKaydet: (
    bilgiler: { siparisNo: string; tedarikciId: string; beklenenTarih?: string; not?: string },
    fiyatlar: Record<string, number>,
  ) => Promise<void>
}){
  const [siparisNo, setSiparisNo] = React.useState(onerilenNo)
  const [tedarikciId, setTedarikciId] = React.useState('')
  const [beklenenTarih, setBeklenenTarih] = React.useState(talep.gerekenTarih ?? '')
  const [fiyatlar, setFiyatlar] = React.useState<Record<string, string>>({})
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  const toplam = talep.satirlar.reduce(
    (t, satir) => t + satir.miktar * sayiyaCevir(fiyatlar[satir.stokKalemiId] ?? ''), 0,
  )

  if(tedarikciler.length === 0){
    return (
      <div className="empty-state">
        <p><strong>Önce tedarikçi eklemelisiniz.</strong></p>
        <div className="form-actions"><button className="btn" type="button" onClick={onIptal}>Kapat</button></div>
      </div>
    )
  }

  return (
    <form
      className="stacked-form"
      onSubmit={async event => {
        event.preventDefault()
        setGonderiliyor(true)
        try{
          await onKaydet(
            {
              siparisNo,
              tedarikciId,
              beklenenTarih: beklenenTarih || undefined,
              not: `${talep.talepNo} talebinden oluşturuldu.`,
            },
            Object.fromEntries(
              talep.satirlar.map(s => [s.stokKalemiId, sayiyaCevir(fiyatlar[s.stokKalemiId] ?? '')]),
            ),
          )
        } finally { setGonderiliyor(false) }
      }}
    >
      <label>
        Sipariş No *
        <input value={siparisNo} onChange={e => setSiparisNo(e.target.value)} required />
      </label>
      <label>
        Tedarikçi *
        <select value={tedarikciId} onChange={e => setTedarikciId(e.target.value)} required>
          <option value="">Seçin…</option>
          {tedarikciler.map(t => <option key={t.id} value={t.id}>{t.kod} · {t.ad}</option>)}
        </select>
      </label>
      <label>
        Beklenen tarih
        <input type="date" max={enGecTarih} value={beklenenTarih} onChange={e => setBeklenenTarih(e.target.value)} />
      </label>

      <div className="table-wrap">
        <table className="data-table compact">
          <thead>
            <tr><th>Kalem</th><th className="num">Miktar</th><th className="num">Birim Fiyat</th></tr>
          </thead>
          <tbody>
            {talep.satirlar.map(satir => (
              <tr key={satir.id}>
                <td>{satir.stokKalemiAd ?? satir.stokKalemiId}</td>
                <td className="num">{bicimle(satir.miktar)} {satir.birim}</td>
                <td className="num">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="purchase-price-input"
                    aria-label={`${satir.stokKalemiAd ?? 'Kalem'} birim fiyatı`}
                    value={fiyatlar[satir.stokKalemiId] ?? ''}
                    onChange={e => setFiyatlar(o => ({ ...o, [satir.stokKalemiId]: e.target.value }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={2}>Toplam</td><td className="num"><strong>{paraBicimi.format(toplam)}</strong></td></tr>
          </tfoot>
        </table>
      </div>

      <p className="muted detail-hint">
        Kalemler ve miktarlar değiştirilemez — onaylanan buydu. Burada eklenen
        tek şey tedarikçi ve fiyat.
      </p>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Oluşturuluyor…' : 'Siparişi Oluştur'}
        </button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Mal kabul
// ═══════════════════════════════════════════════════════════════════════════

const KABUL_DURUM_ETIKETLERI: Record<Kabul['durum'], string> = {
  DRAFT: 'Yarım kaldı',
  POSTED: 'İşlendi',
  CANCELLED: 'İptal',
}

function KabulListesi({
  kabuller, seciliId, onSec,
}: {
  kabuller: Kabul[]
  seciliId: string | null
  onSec: (id: string) => void
}){
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Kabul No</th><th>Tedarikçi</th><th>Sipariş</th>
            <th>İrsaliye</th><th>Durum</th><th>Tarih</th>
          </tr>
        </thead>
        <tbody>
          {kabuller.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                Henüz mal kabul yok. Gönderilmiş bir siparişi açıp “Mal Kabul Yap” deyin.
              </td>
            </tr>
          )}
          {kabuller.map(kabul => (
            <tr
              key={kabul.id}
              className={kabul.id === seciliId ? 'is-selected' : ''}
              onClick={() => onSec(kabul.id)}
            >
              <td>{kabul.kabulNo}</td>
              <td>{kabul.tedarikciAd ?? '—'}</td>
              <td className="muted">{kabul.siparisNo ?? '—'}</td>
              <td className="muted">{kabul.irsaliyeNo ?? '—'}</td>
              <td>
                <span className={`status-pill ${kabul.durum === 'POSTED' ? 'success-pill' : kabul.durum === 'DRAFT' ? 'warning-pill' : 'muted-pill'}`}>
                  {KABUL_DURUM_ETIKETLERI[kabul.durum]}
                </span>
              </td>
              <td className="muted">{tarihBicimle(kabul.kabulTarihi)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function KabulDetayi({
  kabul, iadeDurumlari, yazabilir, onTekrarDene, onIade,
}: {
  kabul: Kabul
  iadeDurumlari: KabulSatirIadeDurumu[]
  yazabilir: boolean
  onTekrarDene: () => void
  onIade: () => void
}){
  const islenmemisVar = kabul.satirlar.some(s => s.kabulMiktari > 0 && !s.hareketId)
  const iadeEdilebilir = iadeDurumlari.some(d => d.kalan > 0)
  const iadeEdilenVar = iadeDurumlari.some(d => d.iadeEdilen > 0)

  return (
    <section className="card">
      <div className="section-header compact">
        <h3>{kabul.kabulNo}</h3>
        <span className={`status-pill ${kabul.durum === 'POSTED' ? 'success-pill' : 'warning-pill'}`}>
          {KABUL_DURUM_ETIKETLERI[kabul.durum]}
        </span>
      </div>

      <dl className="detail-grid">
        <dt>Tedarikçi</dt><dd>{kabul.tedarikciAd ?? '—'}</dd>
        <dt>Kabul tarihi</dt><dd>{tarihBicimle(kabul.kabulTarihi)}</dd>
        {kabul.siparisNo && (<><dt>Sipariş</dt><dd>{kabul.siparisNo}</dd></>)}
        {kabul.irsaliyeNo && (<><dt>İrsaliye</dt><dd>{kabul.irsaliyeNo}</dd></>)}
        {kabul.not && (<><dt>Not</dt><dd>{kabul.not}</dd></>)}
      </dl>

      <div className="table-wrap">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Kalem</th><th className="num">Kabul</th><th className="num">Ret</th>
              <th className="num">İade</th>
              <th>Birim</th><th>Lot</th><th>SKT</th><th>Deftere</th>
            </tr>
          </thead>
          <tbody>
            {kabul.satirlar.map(satir => (
              <tr key={satir.id}>
                <td>{satir.stokKalemiAd ?? satir.stokKalemiId}</td>
                <td className="num">{bicimle(satir.kabulMiktari)}</td>
                <td className={`num ${satir.redMiktari > 0 ? 'is-critical' : 'muted'}`}>
                  {satir.redMiktari > 0 ? bicimle(satir.redMiktari) : '—'}
                </td>
                <td className="num muted">
                  {(() => {
                    const d = iadeDurumlari.find(x => x.satir.id === satir.id)
                    return d && d.iadeEdilen > 0 ? bicimle(d.iadeEdilen) : '—'
                  })()}
                </td>
                <td className="muted">{satir.birim}</td>
                <td className="muted">{satir.lotKodu ?? '—'}</td>
                <td className="muted">{satir.sonKullanma ? tarihBicimle(satir.sonKullanma) : '—'}</td>
                <td>
                  {satir.kabulMiktari <= 0
                    ? <span className="muted">yazılmaz</span>
                    : satir.hareketId
                      ? <span className="status-pill success-pill">yazıldı</span>
                      : <span className="status-pill warning-pill">bekliyor</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {kabul.satirlar.some(s => s.redMiktari > 0) && (
        <dl className="detail-grid">
          {kabul.satirlar.filter(s => s.redMiktari > 0).map(satir => (
            <React.Fragment key={satir.id}>
              <dt>Ret gerekçesi</dt>
              <dd>{satir.stokKalemiAd}: {satir.redNedeni}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}

      {islenmemisVar ? (
        <>
          <p className="muted detail-hint">
            Bu kabulün bazı kalemleri deftere yazılamamış. Tekrar denemek güvenlidir:
            zaten yazılmış kalemler atlanır, stok iki katına çıkmaz.
          </p>
          {yazabilir && (
            <div className="form-actions">
              <button className="btn primary" type="button" onClick={onTekrarDene}>
                Tekrar Dene
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="muted detail-hint">
            Kabul edilen miktarlar stok defterine yazıldı. Depo ekranındaki bakiye ve
            lot bilgisi bu hareketlerden türetiliyor — ayrıca saklanmıyor.
          </p>
          {iadeEdilenVar && (
            <p className="muted detail-hint">
              Bu kabulden iade yapılmış. İade belgeleri “İadeler” sekmesinde.
            </p>
          )}
          {yazabilir && iadeEdilebilir && (
            <div className="form-actions">
              <button className="btn" type="button" onClick={onIade}>
                Tedarikçiye İade
              </button>
            </div>
          )}
          {yazabilir && !iadeEdilebilir && iadeEdilenVar && (
            <p className="muted detail-hint">
              Bu kabulün tamamı iade edilmiş; iade edilecek başka miktar kalmadı.
            </p>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Mal kabul formu.
 *
 * ── VARSAYILAN NEDEN "KALAN" ─────────────────────────────────────────────
 * Her satır, siparişin o kaleminden HENÜZ GELMEMİŞ miktarla dolu geliyor.
 * Sipariş miktarıyla doldurmak, ikinci sevkiyatta kullanıcıyı fazladan kabule
 * götüren en kısa yoldur: 100 kg siparişin 60'ı gelmişken form yine 100
 * gösterirse, kullanıcı düşünmeden kaydeder ve depoda 160 kg görünür.
 *
 * Tamamı gelmiş kalemler listeye HİÇ girmez: gösterip 0 yazmak, ekranı
 * kalabalıklaştırıp asıl işi gizlerdi.
 */
function MalKabulFormu({
  siparis, durumlar, kalemler, onerilenNo, onIptal, onKaydet,
}: {
  siparis: Siparis
  durumlar: SiparisSatirDurumu[]
  kalemler: KatalogKalemi[]
  onerilenNo: string
  onIptal: () => void
  onKaydet: (girdi: {
    kabulNo: string; siparisId: string; tedarikciId: string
    kabulTarihi?: string; irsaliyeNo?: string
    satirlar: Array<{
      siparisSatirId?: string; stokKalemiId: string
      kabulMiktari: number; redMiktari: number; redNedeni?: string
      birim: string; birimFiyat: number; lotKodu?: string; sonKullanma?: string
    }>
  }) => Promise<void>
}){
  const bekleyenler = React.useMemo(() => durumlar.filter(d => !d.tamamlandi), [durumlar])

  const [kabulNo, setKabulNo] = React.useState(onerilenNo)
  const [irsaliyeNo, setIrsaliyeNo] = React.useState('')
  const [kabulTarihi, setKabulTarihi] = React.useState(new Date().toISOString().slice(0, 10))
  const [satirlar, setSatirlar] = React.useState(() => bekleyenler.map(durum => {
    const oneri = kabulSatiriOner(durum)
    return {
      siparisSatirId: oneri.siparisSatirId,
      stokKalemiId: oneri.stokKalemiId,
      kabul: String(oneri.kabulMiktari),
      red: '',
      redNedeni: '',
      lotKodu: '',
      sonKullanma: '',
      birim: oneri.birim,
      birimFiyat: oneri.birimFiyat,
    }
  }))
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  const guncelle = (sira: number, yama: Partial<(typeof satirlar)[number]>) => {
    setSatirlar(o => o.map((s, i) => (i === sira ? { ...s, ...yama } : s)))
  }

  if(bekleyenler.length === 0){
    return (
      <div className="empty-state">
        <p><strong>Bu siparişin tamamı teslim alınmış.</strong></p>
        <p>Kabul edilecek kalan kalem yok.</p>
        <div className="form-actions"><button className="btn" type="button" onClick={onIptal}>Kapat</button></div>
      </div>
    )
  }

  return (
    <form
      className="stacked-form"
      onSubmit={async event => {
        event.preventDefault()
        setGonderiliyor(true)
        try{
          await onKaydet({
            kabulNo,
            siparisId: siparis.id,
            tedarikciId: siparis.tedarikciId,
            kabulTarihi,
            irsaliyeNo: irsaliyeNo.trim() || undefined,
            satirlar: satirlar
              // Ne kabul ne ret girilmiş satır gönderilmez: kullanıcı o kalemi
              // bu sevkiyatta hiç almamış demektir.
              .filter(s => sayiyaCevir(s.kabul) > 0 || sayiyaCevir(s.red) > 0)
              .map(s => ({
                siparisSatirId: s.siparisSatirId,
                stokKalemiId: s.stokKalemiId,
                kabulMiktari: sayiyaCevir(s.kabul),
                redMiktari: sayiyaCevir(s.red),
                redNedeni: s.redNedeni.trim() || undefined,
                birim: s.birim,
                birimFiyat: s.birimFiyat,
                lotKodu: s.lotKodu.trim() || undefined,
                sonKullanma: s.sonKullanma || undefined,
              })),
          })
        } finally { setGonderiliyor(false) }
      }}
    >
      <label>
        Kabul No *
        <input value={kabulNo} onChange={e => setKabulNo(e.target.value)} required />
      </label>
      <label>
        İrsaliye No
        <input value={irsaliyeNo} onChange={e => setIrsaliyeNo(e.target.value)} placeholder="IRS-000123" />
        <small className="muted">Bir uyuşmazlıkta aranacak ilk belge budur.</small>
      </label>
      <label>
        Kabul tarihi
        <input type="date" max={enGecTarih} value={kabulTarihi} onChange={e => setKabulTarihi(e.target.value)} />
      </label>

      <div className="purchase-lines">
        {satirlar.map((satir, sira) => {
          const kalem = kalemler.find(k => k.id === satir.stokKalemiId)
          const bekleyen = bekleyenler[sira]

          return (
            <div className="receipt-line" key={satir.siparisSatirId ?? sira}>
              <div className="receipt-line-head">
                <strong>{kalem?.ad ?? satir.stokKalemiId}</strong>
                <span className="muted">
                  Sipariş {bicimle(bekleyen.satir.miktar)} {satir.birim}
                  {bekleyen.kabulEdilen > 0 && ` · Gelen ${bicimle(bekleyen.kabulEdilen)}`}
                  {' · '}Kalan {bicimle(bekleyen.kalan)}
                </span>
              </div>

              <div className="receipt-line-grid">
                <label className="narrow">
                  Kabul
                  <input type="number" min="0" step="any" value={satir.kabul}
                    onChange={e => guncelle(sira, { kabul: e.target.value })} />
                </label>
                <label className="narrow">
                  Ret
                  <input type="number" min="0" step="any" value={satir.red}
                    onChange={e => guncelle(sira, { red: e.target.value })} />
                </label>
                {kalem?.lotTakipli && (
                  <label>
                    Lot / Parti No *
                    <input value={satir.lotKodu} placeholder="TVK-2609-A"
                      onChange={e => guncelle(sira, { lotKodu: e.target.value })} />
                  </label>
                )}
                {kalem?.sktTakipli && (
                  <label className="narrow">
                    Son Kullanma *
                    <input type="date" max={enGecTarih} value={satir.sonKullanma}
                      onChange={e => guncelle(sira, { sonKullanma: e.target.value })} />
                  </label>
                )}
              </div>

              {sayiyaCevir(satir.red) > 0 && (
                <label>
                  Ret gerekçesi *
                  <input value={satir.redNedeni} placeholder="Çuval yırtık, nem almış"
                    onChange={e => guncelle(sira, { redNedeni: e.target.value })} />
                  <small className="muted">
                    Gerekçesiz ret, tedarikçiyle konuşurken elinizde hiçbir şey olmaması demektir.
                  </small>
                </label>
              )}
            </div>
          )
        })}
      </div>

      <p className="muted detail-hint">
        Kabul edilen miktar stok defterine yazılır ve depo bakiyesi anında artar.
        Reddedilen miktar deftere <strong>hiç</strong> yazılmaz — depoya girmemiş mal stok değildir.
      </p>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Deftere işleniyor…' : 'Mal Kabulü Yap'}
        </button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// İade
//
// ── NEDEN İADE MAL KABULDEN AYRI BİR BELGE ───────────────────────────────
// Ret ile iade birbirine benzer görünür ama defterde taban tabana zıttır:
//   RET   — mal kapıda kaldı, depoya HİÇ girmedi. Deftere hareket yazılmaz;
//           iz yalnızca kabul belgesindeki `redMiktari` alanında durur.
//   İADE  — mal kabul edildi, depoya girdi, bakiye arttı. Sonradan geri
//           gönderiliyor. Bakiyenin geri inmesi için deftere ÇIKIŞ yazılır.
//
// İkisini tek alanda toplasaydık, "geçen ay 20 kg reddettik" ile "geçen ay
// 20 kg iade ettik" aynı satıra düşerdi; ama birincisinde depo hiç görmemiş,
// ikincisinde bir hafta boyunca depoda durmuştur. Tedarikçi performansı da,
// stok maliyeti de bu ikisini ayırmayı gerektirir.
// ═══════════════════════════════════════════════════════════════════════════

const IADE_DURUM_ETIKETLERI: Record<Iade['durum'], string> = {
  DRAFT: 'Yarım kaldı',
  POSTED: 'Deftere işlendi',
  CANCELLED: 'İptal',
}

function IadeListesi({
  iadeler, seciliId, onSec,
}: {
  iadeler: Iade[]
  seciliId: string | null
  onSec: (id: string) => void
}){
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>İade No</th><th>Tedarikçi</th><th>Kabul</th>
            <th>Gerekçe</th><th>Durum</th><th>Tarih</th>
          </tr>
        </thead>
        <tbody>
          {iadeler.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                Henüz iade yok. İade, “Mal Kabul” sekmesinde işlenmiş bir kabul
                belgesi açılıp “Tedarikçiye İade” denerek başlatılır.
              </td>
            </tr>
          )}
          {iadeler.map(iade => (
            <tr
              key={iade.id}
              className={iade.id === seciliId ? 'is-selected' : ''}
              onClick={() => onSec(iade.id)}
            >
              <td>{iade.iadeNo}</td>
              <td>{iade.tedarikciAd ?? '—'}</td>
              <td className="muted">{iade.kabulNo ?? '—'}</td>
              <td className="muted">{iade.neden}</td>
              <td>
                <span className={`status-pill ${iade.durum === 'POSTED' ? 'success-pill' : iade.durum === 'DRAFT' ? 'warning-pill' : 'muted-pill'}`}>
                  {IADE_DURUM_ETIKETLERI[iade.durum]}
                </span>
              </td>
              <td className="muted">{tarihBicimle(iade.iadeTarihi)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IadeDetayi({
  iade, yazabilir, onTekrarDene,
}: {
  iade: Iade
  yazabilir: boolean
  onTekrarDene: () => void
}){
  const islenmemisVar = iade.satirlar.some(s => !s.hareketId)

  return (
    <section className="card">
      <div className="section-header compact">
        <h3>{iade.iadeNo}</h3>
        <span className={`status-pill ${iade.durum === 'POSTED' ? 'success-pill' : 'warning-pill'}`}>
          {IADE_DURUM_ETIKETLERI[iade.durum]}
        </span>
      </div>

      <dl className="detail-grid">
        <dt>Tedarikçi</dt><dd>{iade.tedarikciAd ?? '—'}</dd>
        <dt>İade tarihi</dt><dd>{tarihBicimle(iade.iadeTarihi)}</dd>
        {iade.kabulNo && (<><dt>Kabul belgesi</dt><dd>{iade.kabulNo}</dd></>)}
        <dt>Gerekçe</dt><dd>{iade.neden}</dd>
        {iade.not && (<><dt>Not</dt><dd>{iade.not}</dd></>)}
      </dl>

      <div className="table-wrap">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Kalem</th><th className="num">Miktar</th>
              <th>Birim</th><th>Lot</th><th>Deftere</th>
            </tr>
          </thead>
          <tbody>
            {iade.satirlar.map(satir => (
              <tr key={satir.id}>
                <td>{satir.stokKalemiAd ?? satir.stokKalemiId}</td>
                <td className="num">{bicimle(satir.miktar)}</td>
                <td className="muted">{satir.birim}</td>
                <td className="muted">{satir.lotKodu ?? '—'}</td>
                <td>
                  {satir.hareketId
                    ? <span className="status-pill success-pill">çıkış yazıldı</span>
                    : <span className="status-pill warning-pill">bekliyor</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {islenmemisVar ? (
        <>
          <p className="muted detail-hint">
            Bu iadenin bazı kalemleri deftere yazılamamış. Tekrar denemek güvenlidir:
            zaten yazılmış kalemler atlanır, stok iki kez düşmez.
          </p>
          {yazabilir && (
            <div className="form-actions">
              <button className="btn primary" type="button" onClick={onTekrarDene}>
                Tekrar Dene
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="muted detail-hint">
          İade edilen miktarlar stok defterinden çıkış olarak düşüldü. Kabul belgesi
          silinmedi — depoya girdiği de, geri gittiği de defterde yan yana duruyor.
        </p>
      )}
    </section>
  )
}

/**
 * İade formu.
 *
 * ── VARSAYILAN NEDEN 0 ───────────────────────────────────────────────────
 * Mal kabul formunda satırlar "kalan miktar" ile dolu gelir, çünkü orada
 * beklenen davranış "geleni kaydet"tir. Burada tersi: iade istisnadır. Formu
 * dolu açmak, tek bir kaleme dokunmak isteyen kullanıcının diğer üç kalemi
 * yanlışlıkla iade etmesine yol açardı. Kullanıcı ne iade ediyorsa onu yazar.
 */
function IadeFormu({
  kabul, durumlar, onerilenNo, onIptal, onKaydet,
}: {
  kabul: Kabul
  durumlar: KabulSatirIadeDurumu[]
  onerilenNo: string
  onIptal: () => void
  onKaydet: (girdi: YeniIade) => Promise<void>
}){
  const iadeEdilebilirler = React.useMemo(
    () => durumlar.filter(d => d.kalan > 0),
    [durumlar],
  )

  const [iadeNo, setIadeNo] = React.useState(onerilenNo)
  const [iadeTarihi, setIadeTarihi] = React.useState(new Date().toISOString().slice(0, 10))
  const [neden, setNeden] = React.useState('')
  const [not, setNot] = React.useState('')
  const [miktarlar, setMiktarlar] = React.useState<Record<string, string>>({})
  const [gonderiliyor, setGonderiliyor] = React.useState(false)

  if(iadeEdilebilirler.length === 0){
    return (
      <div className="empty-state">
        <p><strong>İade edilecek kalem yok.</strong></p>
        <p>Bu kabulün kabul edilen miktarının tamamı zaten iade edilmiş.</p>
        <div className="form-actions"><button className="btn" type="button" onClick={onIptal}>Kapat</button></div>
      </div>
    )
  }

  const seciliSatirlar = iadeEdilebilirler
    .map(durum => ({ durum, miktar: sayiyaCevir(miktarlar[durum.satir.id] ?? '') }))
    .filter(x => x.miktar > 0)

  return (
    <form
      className="stacked-form"
      onSubmit={async event => {
        event.preventDefault()
        setGonderiliyor(true)
        try{
          await onKaydet({
            iadeNo,
            kabulId: kabul.id,
            tedarikciId: kabul.tedarikciId,
            iadeTarihi,
            neden: neden.trim(),
            not: not.trim() || undefined,
            satirlar: seciliSatirlar.map(({ durum, miktar }) => ({
              kabulSatirId: durum.satir.id,
              stokKalemiId: durum.satir.stokKalemiId,
              miktar,
              birim: durum.satir.birim,
              lotKodu: durum.satir.lotKodu,
            })),
          })
        } finally { setGonderiliyor(false) }
      }}
    >
      <div className="form-row">
        <label>
          İade No *
          <input value={iadeNo} onChange={e => setIadeNo(e.target.value)} required />
        </label>
        <label className="narrow">
          İade Tarihi
          <input type="date" max={enGecTarih} value={iadeTarihi}
            onChange={e => setIadeTarihi(e.target.value)} />
        </label>
      </div>

      <label>
        Gerekçe *
        <input value={neden} required placeholder="Nem almış, ambalaj hasarlı"
          onChange={e => setNeden(e.target.value)} />
        <small className="muted">
          Gerekçesiz iade, tedarikçiyle konuşurken elinizde hiçbir şey olmaması demektir.
          Tedarikçi performansı da bu gerekçelerden doğacak.
        </small>
      </label>

      <div className="receipt-lines">
        {iadeEdilebilirler.map(durum => (
          <div className="receipt-line" key={durum.satir.id}>
            <div className="receipt-line-head">
              <strong>{durum.satir.stokKalemiAd ?? durum.satir.stokKalemiId}</strong>
              <span className="muted">
                Kabul {bicimle(durum.satir.kabulMiktari)} {durum.satir.birim}
                {durum.iadeEdilen > 0 && ` · daha önce iade ${bicimle(durum.iadeEdilen)}`}
                {' · iade edilebilir '}<strong>{bicimle(durum.kalan)}</strong>
              </span>
            </div>
            <div className="form-row">
              <label className="narrow">
                İade miktarı
                <input
                  type="number" min="0" max={durum.kalan} step="0.001"
                  value={miktarlar[durum.satir.id] ?? ''}
                  placeholder="0"
                  onChange={e => setMiktarlar(o => ({ ...o, [durum.satir.id]: e.target.value }))}
                />
              </label>
              {durum.satir.lotKodu && (
                <label className="narrow">
                  Lot
                  <input value={durum.satir.lotKodu} readOnly />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      <label>
        Not
        <textarea rows={2} value={not} onChange={e => setNot(e.target.value)} />
      </label>

      <p className="muted detail-hint">
        İade edilen miktar stok defterine <strong>çıkış</strong> olarak yazılır ve depo
        bakiyesi düşer. Kapıda reddetmekten farkı budur: reddedilen mal depoya hiç
        girmemişti, iade edilen mal girmişti ve geri gidiyor.
      </p>

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>İptal</button>
        <button className="btn primary" type="submit" disabled={gonderiliyor || seciliSatirlar.length === 0}>
          {gonderiliyor ? 'Deftere işleniyor…' : 'İadeyi İşle'}
        </button>
      </div>
    </form>
  )
}
