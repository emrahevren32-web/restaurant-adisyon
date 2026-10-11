// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Kontrol Paneli
//
// Yol haritası (A4): "Kontrol paneli yeniden yazıldı"
//         Bitti sayılır ki: "Yalnızca defterden okuyan gerçek rakamlar var"
//
// ── BU EKRAN NEDEN YENİDEN YAZILDI ───────────────────────────────────────
// Eskisi (`pages/DailySummary.tsx`) otuza yakın mock dosyasından besleniyordu:
// `SHP-000001` geciken sevkiyat, `RCL-000021` aktif recall, "%75 HACCP
// uygunluk", "15 uygunsuz ölçüm" — hiçbiri gerçek defterden gelmiyordu.
//
// Bu, demoda en tehlikeli ekrandı: müşterinin GÖRDÜĞÜ İLK EKRAN. Kendi
// dolaşan bir müşteri ilk olarak buradaki bir rakamı sorar, ve cevap
// "orası örnek veri" olmak zorunda kalırdı. Word'ün kendi prensibi bunu
// yasaklıyor: "Menüde gördüğünüz her şey çalışıyor."
//
// ── KURAL ────────────────────────────────────────────────────────────────
// Bu dosyada HİÇBİR mock import'u yok ve olmayacak. Her sayı bir sorgudan
// geliyor; sorgusu olmayan bir kutu bu ekrana KONULMAZ. Gösterilecek veri
// yoksa "yok" yazılır — uydurulmaz.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import type { User } from '../types'
import type { BusinessWorkspaceNavKey, BusinessWorkspaceRoute } from '../navigation/app-navigation.types'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import {
  PostgresYedekGunlugu, yedekDurumu, type YedekKaydi,
} from '../tenant-export/backup-log'
import { createStockRepository, resolveStockRepositoryMode } from '../core/stock/index'
import { InMemoryStockItemLookup } from '../core/stock/stock-item-lookup'
import { depoBaglamiKur, type DepoBaglami } from '../warehouse/warehouse.context'
import { PostgresStokKatalogu, type KatalogKalemi } from '../warehouse/warehouse.catalog'
import {
  DepoServisi, type DepoKalemi, type DepoUyarilari,
} from '../warehouse/warehouse.service'
import {
  IS_EMRI_DURUM_ETIKETLERI, PostgresIsEmriDeposu, type IsEmri,
} from '../production/work-order.repository'
import { IsEmriServisi } from '../production/work-order.service'
import { PostgresSevkiyatDeposu, type Sevkiyat } from '../production/shipment.repository'
import { SevkiyatServisi } from '../production/shipment.service'
import { PostgresHaccpDeposu, type DuzelticiFaaliyet, type Olcum } from '../quality/haccp.repository'
import {
  PostgresSiparisDeposu, type DikkatSiparisi,
} from '../sales/sales-order.repository'
import { HaccpServisi, haccpOzeti } from '../quality/haccp.service'

type Props = {
  currentUser: User
  onOpenMarketplace: () => void
  onOpenWorkspaceSettings?: () => void
  onOpenWorkspaceRoute?: (route: BusinessWorkspaceRoute, navKey: BusinessWorkspaceNavKey) => void
}

const sayiBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 })
const bicimle = (d: number) => sayiBicimi.format(d)
const hataMetni = (h: unknown) => (h instanceof Error ? h.message : 'Beklenmeyen bir hata oluştu.')

/**
 * Bekleme süresi — İNSAN GİBİ. "0,3 saat" kimseye bir şey anlatmaz.
 *
 * ⚠️ Bir saatin altı "yeni" diye yazılıyor: dakika göstermek paneli
 * saniye saniye değişen bir sayaca çevirirdi ve kimse okumazdı.
 */
const beklemeYaz = (saat: number): string => {
  if(saat < 1) return 'yeni'
  if(saat < 24) return `${Math.floor(saat)} saattir`
  const gun = Math.floor(saat / 24)
  return `${gun} gündür`
}
const bugunAnahtari = () => new Date().toLocaleDateString('sv-SE')

/** Panelin bir satırı: ne olduğu, ne kadar acil, nereye götürdüğü. */
type DikkatSatiri = {
  id: string
  aciliyet: 'kritik' | 'uyari'
  baslik: string
  ayrinti: string
  rota?: BusinessWorkspaceRoute
  navKey?: BusinessWorkspaceNavKey
}

type PanelVerisi = {
  kalemler: DepoKalemi[]
  uyarilar: DepoUyarilari
  isEmirleri: IsEmri[]
  sevkiyatlar: Sevkiyat[]
  olcumler: Olcum[]
  faaliyetler: DuzelticiFaaliyet[]
  katalog: KatalogKalemi[]
  /** Yedek günlüğü. Tablo henüz kurulmadıysa boş kalır, panel yine çalışır. */
  yedekler: YedekKaydi[]
  /** Onay bekleyen siparişler, son revizyonunun kaynağıyla (A4C-14). */
  dikkatSiparisleri: DikkatSiparisi[]
}

export default function KontrolPaneli({
  currentUser, onOpenMarketplace, onOpenWorkspaceSettings, onOpenWorkspaceRoute,
}: Props){
  const mod = resolveStockRepositoryMode()
  const [baglam, setBaglam] = React.useState<DepoBaglami | null>(null)
  const [veri, setVeri] = React.useState<PanelVerisi | null>(null)
  const [yukleniyor, setYukleniyor] = React.useState(true)
  const [hata, setHata] = React.useState('')

  const hazir = mod === 'postgres' && isSupabaseConfigured()

  React.useEffect(() => {
    let iptal = false
    if(!hazir){ setYukleniyor(false); return }

    ;(async () => {
      try{
        const client = getSupabase()
        const kurulan = await depoBaglamiKur(client)
        if(iptal) return
        setBaglam(kurulan)

        const katalogServisi = new PostgresStokKatalogu(client)
        const depoServisi = new DepoServisi(
          createStockRepository(new InMemoryStockItemLookup([])),
          katalogServisi,
        )
        const haccpServisi = new HaccpServisi(new PostgresHaccpDeposu(client))

        const [kalemler, uyarilar, isEmirleri, sevkiyatlar, olcumler, faaliyetler, katalog,
               dikkatSip] =
          await Promise.all([
            depoServisi.kalemler(kurulan.ctx),
            depoServisi.uyarilar(kurulan.ctx),
            new IsEmriServisi(new PostgresIsEmriDeposu(client), depoServisi).hepsi(kurulan.ctx),
            new SevkiyatServisi(new PostgresSevkiyatDeposu(client), depoServisi).hepsi(kurulan.ctx),
            haccpServisi.olcumler(kurulan.ctx, 200),
            haccpServisi.faaliyetler(kurulan.ctx),
            katalogServisi.kalemler(kurulan.ctx),
            // A4C-14 · "Sipariş güncellendiğinde firma ANINDA görüyor".
            // ⚠️ Okunamazsa panel ÇALIŞMAYA DEVAM ETMELİ: 0069 henüz
            // uygulanmamış olabilir ve bir ek bilgi yüzünden bütün panelin
            // kapanması kabul edilemez.
            new PostgresSiparisDeposu(client).dikkatSiparisleri(kurulan.ctx)
              .catch(() => [] as DikkatSiparisi[]),
          ])

        // Yedek günlüğü ayrı ve HATA YUTARAK okunuyor: 0029 göçü henüz
        // çalıştırılmamışsa tablo yoktur ve bu, kontrol panelinin tamamının
        // açılmamasına sebep olmamalı. Yedek uyarısı bir ek; panelin kendisi
        // ondan önemli.
        let yedekler: YedekKaydi[] = []
        try { yedekler = await new PostgresYedekGunlugu(client).son(kurulan.ctx, 5) }
        catch { yedekler = [] }

        if(iptal) return
        setVeri({
          kalemler, uyarilar, isEmirleri, sevkiyatlar, olcumler, faaliyetler,
          katalog, yedekler, dikkatSiparisleri: dikkatSip,
        })
      } catch (e) {
        if(!iptal) setHata(hataMetni(e))
      } finally {
        if(!iptal) setYukleniyor(false)
      }
    })()

    return () => { iptal = true }
  }, [hazir])

  const git = (rota?: BusinessWorkspaceRoute, navKey?: BusinessWorkspaceNavKey) => {
    if(rota && navKey && onOpenWorkspaceRoute) onOpenWorkspaceRoute(rota, navKey)
  }

  const baslik = (
    <div className="page-title">
      <div>
        <p className="muted">
          {currentUser.fullName} · bütün rakamlar stok defterinden okunuyor
        </p>
      </div>
      <div>
        {/* ⚠️ 2026-10-11 · "Modül Mağazası" düğmesi KALDIRILDI.
            Mağaza menüden de kaldırıldı; düğmeyi bırakmak onu demoda geri
            getirirdi, çünkü rota hâlâ açılabiliyor. Gerekçe:
            claude/modul-magazasi-denetimi.md */}
        {onOpenWorkspaceSettings && (
          <button className="btn" type="button" onClick={onOpenWorkspaceSettings}>
            Çalışma Alanı
          </button>
        )}
      </div>
    </div>
  )

  if(!hazir){
    return (
      <div className="warehouse-page">
        {baslik}
        <section className="card empty-state">
          <p><strong>Bu panel gerçek veritabanı ile çalışır.</strong></p>
          <p>
            Rakamlar stok defterinden türetiliyor; defter veritabanında durur.
            Örnek veri göstermeyi bilerek bırakıyoruz.
          </p>
        </section>
      </div>
    )
  }

  if(yukleniyor){
    return (
      <div className="warehouse-page">
        {baslik}
        <section className="card empty-state">Defter okunuyor…</section>
      </div>
    )
  }

  if(!veri || !baglam){
    return (
      <div className="warehouse-page">
        {baslik}
        <section className="card empty-state">{hata || 'Çalışma alanı çözülemedi.'}</section>
      </div>
    )
  }

  const {
    kalemler, uyarilar, isEmirleri, sevkiyatlar, olcumler, faaliyetler, katalog, yedekler,
  } = veri

  // ⚠️ BİR EK VERİ YÜZÜNDEN PANEL ÇÖKMEZ (09.10, canlı hata `1v8ytws`).
  //
  // `veri.dikkatSiparisleri.filter(...)` doğrudan yazılmıştı; alan
  // `undefined` gelince bütün kontrol paneli React hata sınırına düştü:
  // "Bu ekran açılamadı". Sebebi önemsiz (sayfa açıkken kod yenilendi,
  // eski state'te alan yoktu) ama SONUCU önemli — kullanıcı paneli komple
  // kaybetti.
  //
  // `yedekler` için bu korumayı en baştan koymuştum, buna koymamışım.
  // Panel onlarca kaynaktan besleniyor ve hiçbiri panelin tamamını
  // götürebilecek kadar önemli değil.
  const dikkatSiparisleri = veri.dikkatSiparisleri ?? []
  const bugun = bugunAnahtari()

  const acikIsEmirleri = isEmirleri.filter(i => i.durum === 'DRAFT' || i.durum === 'STARTED')
  const bekleyenSevkiyatlar = sevkiyatlar.filter(s => s.durum === 'DRAFT')
  const ozet = haccpOzeti(olcumler, faaliyetler, bugun)

  // Yetersiz stokla başlatılamayacak iş emirleri — panelde görünmesi,
  // kullanıcının o ekrana girip tek tek denemesine gerek bırakmıyor.
  const bakiyeHaritasi = new Map(kalemler.map(k => [k.id, k.miktar]))
  const isEmriServisi = new IsEmriServisi(
    new PostgresIsEmriDeposu(getSupabase()),
    new DepoServisi(
      createStockRepository(new InMemoryStockItemLookup([])),
      new PostgresStokKatalogu(getSupabase()),
    ),
  )
  const baslatilamayanlar = isEmirleri
    .filter(i => i.durum === 'DRAFT' && i.satirlar.length > 0)
    .map(i => ({
      isEmri: i,
      eksikler: isEmriServisi.yeterlilik(i, bakiyeHaritasi, katalog).filter(y => !y.yeterli),
    }))
    .filter(x => x.eksikler.length > 0)

  const uygunsuzOlcumler = olcumler.filter(o => o.sonuc === 'FAIL' && !o.iptalZamani)
  const acikFaaliyetler = faaliyetler.filter(f => f.durum === 'OPEN' || f.durum === 'IN_PROGRESS')

  // ── DİKKAT GEREKTİREN KONULAR ─────────────────────────────────────────
  // Sıra ACİLİYETE göre: gıda güvenliği önce, sonra para, sonra plan.
  const dikkat: DikkatSatiri[] = [
    ...acikFaaliyetler.map((f, i) => ({
      id: `faaliyet-${f.id}-${i}`,
      aciliyet: 'kritik' as const,
      baslik: 'Açık düzeltici faaliyet',
      ayrinti: f.aciklama,
      rota: 'haccp-kayitlari' as BusinessWorkspaceRoute,
      navKey: 'haccp-kayitlari' as BusinessWorkspaceNavKey,
    })),
    // ── PORTALDAN GELEN SİPARİŞ (A4C-14) ─────────────────────────────
    // ⚠️ GIDA GÜVENLİĞİNDEN SONRA, ÖTEKİ HER ŞEYDEN ÖNCE. Müşteri sabah
    // miktarı yarıya indirdiyse ve kimse bakmadıysa mutfak eski miktarı
    // üretir — ve bunu teslimde öğrenir.
    //
    // ⚠️ Yalnız PORTAL kaynaklı olan kritik. Telefonla alınan siparişi
    // zaten biri almış ve biliyor; portaldan gelen sessizce düşüyor.
    ...dikkatSiparisleri
      .filter(d => d.kaynak === 'Portal')
      .map(d => ({
        id: `portal-siparis-${d.id}`,
        aciliyet: 'kritik' as const,
        baslik: d.revizyonNo > 1
          ? 'Müşteri siparişini DEĞİŞTİRDİ'
          : 'Portaldan yeni sipariş',
        ayrinti: `${d.siparisNo} · ${d.musteriAdi ?? 'müşteri kartı yok'}`
          + ` · ${d.satirSayisi} kalem · rev ${d.revizyonNo}`
          + ` · ${beklemeYaz(d.beklemeSaati)} onay bekliyor`,
        rota: 'siparisler' as BusinessWorkspaceRoute,
        navKey: 'siparisler' as BusinessWorkspaceNavKey,
      })),
    // Telefonla/elden alınanlar da panelde ama UYARI düzeyinde: onları
    // alan kişi zaten biliyor.
    ...dikkatSiparisleri
      .filter(d => d.kaynak !== 'Portal')
      .map(d => ({
        id: `siparis-onay-${d.id}`,
        aciliyet: 'uyari' as const,
        baslik: 'Onay bekleyen sipariş',
        ayrinti: `${d.siparisNo} · ${d.musteriAdi ?? 'müşteri kartı yok'}`
          + ` · ${d.kaynak} · ${beklemeYaz(d.beklemeSaati)} bekliyor`,
        rota: 'siparisler' as BusinessWorkspaceRoute,
        navKey: 'siparisler' as BusinessWorkspaceNavKey,
      })),
    ...uyarilar.suresiGecmis.map(u => ({
      id: `skt-gecmis-${u.lotId}`,
      aciliyet: 'kritik' as const,
      baslik: 'Son kullanma tarihi geçmiş parti',
      ayrinti: `${u.kalemAd} · ${u.lotKodu} · ${bicimle(u.miktar)} ${u.birim}`
        + ` · ${Math.abs(u.kalanGun)} gün geçmiş`,
      rota: 'depo' as BusinessWorkspaceRoute,
      navKey: 'depo' as BusinessWorkspaceNavKey,
    })),
    ...uyarilar.kritikKalemler.map(k => ({
      id: `kritik-${k.id}`,
      aciliyet: 'uyari' as const,
      baslik: 'Kritik stok',
      ayrinti: `${k.ad} · ${bicimle(k.miktar)} ${k.temelBirim}`
        + (k.minMiktar > 0 ? ` (en az ${bicimle(k.minMiktar)})` : ''),
      rota: 'satinalma' as BusinessWorkspaceRoute,
      navKey: 'satinalma' as BusinessWorkspaceNavKey,
    })),
    // Yedek uyarısı. Gıda güvenliğinden sonra ama stoktan ÖNCE geliyor:
    // kritik stok siparişle çözülür, kaybolan veri çözülmez.
    ...(() => {
      const d = yedekDurumu(yedekler)
      return d.uyari ? [{
        id: 'yedek-uyarisi',
        aciliyet: 'kritik' as const,
        baslik: 'Veri yedeği',
        ayrinti: d.mesaj,
        rota: 'veri-yedegi' as BusinessWorkspaceRoute,
        navKey: 'veri-yedegi' as BusinessWorkspaceNavKey,
      }] : []
    })(),
    ...baslatilamayanlar.map(x => ({
      id: `yetersiz-${x.isEmri.id}`,
      aciliyet: 'uyari' as const,
      baslik: 'İş emri başlatılamıyor',
      ayrinti: `${x.isEmri.isEmriNo} · eksik: `
        + x.eksikler
            .map(e => `${e.satir.stokKalemiAd ?? 'malzeme'} ${bicimle(e.eksik)} ${e.birim}`)
            .join(', '),
      rota: 'uretim-emirleri' as BusinessWorkspaceRoute,
      navKey: 'uretim-emirleri' as BusinessWorkspaceNavKey,
    })),
    ...uyarilar.yaklasan.map(u => ({
      id: `skt-yaklasan-${u.lotId}`,
      aciliyet: 'uyari' as const,
      baslik: 'Son kullanma tarihi yaklaşıyor',
      ayrinti: `${u.kalemAd} · ${u.lotKodu} · ${u.kalanGun} gün kaldı`,
      rota: 'depo' as BusinessWorkspaceRoute,
      navKey: 'depo' as BusinessWorkspaceNavKey,
    })),
  ]

  // Sıralama listenin kurulma sırasına bırakılamaz: "veri yedeği" kritik
  // olmasına rağmen listeye kritik stoktan SONRA ekleniyor. Ekranda önce
  // kritikler görünmeli — yöneticinin gözü ilk satırdan başlar.
  const ACILIYET_SIRASI: Record<DikkatSatiri['aciliyet'], number> = { kritik: 0, uyari: 1 }
  const dikkatSirali = [...dikkat].sort(
    (a, b) => ACILIYET_SIRASI[a.aciliyet] - ACILIYET_SIRASI[b.aciliyet],
  )

  const kritikSayisi = dikkat.filter(d => d.aciliyet === 'kritik').length

  // ── BUGÜN ─────────────────────────────────────────────────────────────
  const bugunSevkEdilen = sevkiyatlar.filter(
    s => s.sevkZamani && s.sevkZamani.slice(0, 10) === bugun,
  )
  const bugunBaslayan = isEmirleri.filter(
    i => i.baslamaZamani && i.baslamaZamani.slice(0, 10) === bugun,
  )
  const bugunBiten = isEmirleri.filter(
    i => i.bitisZamani && i.bitisZamani.slice(0, 10) === bugun,
  )

  return (
    <div className="warehouse-page">
      {baslik}

      {hata && <div className="form-error">{hata}</div>}

      {/* ── SAYILAR ─────────────────────────────────────────────────────── */}
      <div className="metric-grid">
        <SayiKarti
          baslik="Depodaki kalem" sayi={kalemler.length}
          vurgu={uyarilar.kritikKalemler.length > 0 ? 'danger' : undefined}
          altKritik={uyarilar.kritikKalemler.length > 0}
          alt={uyarilar.kritikKalemler.length > 0
            ? `${uyarilar.kritikKalemler.length} kalem kritik seviyede`
            : 'kritik seviyede kalem yok'}
          rota="depo" navKey="depo" onGit={git} erisim={!!onOpenWorkspaceRoute}
        />
        <SayiKarti
          baslik="Açık iş emri" sayi={acikIsEmirleri.length}
          vurgu={baslatilamayanlar.length > 0 ? 'warning' : undefined}
          altKritik={baslatilamayanlar.length > 0}
          alt={baslatilamayanlar.length > 0
            ? `${baslatilamayanlar.length} tanesi stok yetersizliğinden başlatılamıyor`
            : `${isEmirleri.length} iş emrinin tamamı`}
          rota="uretim-emirleri" navKey="uretim-emirleri" onGit={git}
          erisim={!!onOpenWorkspaceRoute}
        />
        <SayiKarti
          baslik="Sevk bekleyen" sayi={bekleyenSevkiyatlar.length}
          vurgu={bekleyenSevkiyatlar.length > 0 ? 'warning' : undefined}
          alt={bugunSevkEdilen.length > 0
            ? `bugün ${bugunSevkEdilen.length} sevkiyat çıktı`
            : 'bugün sevkiyat çıkmadı'}
          rota="sevkiyatlar" navKey="sevkiyatlar" onGit={git}
          erisim={!!onOpenWorkspaceRoute}
        />
        <SayiKarti
          baslik="HACCP · bugün" sayi={ozet.bugunOlcum}
          vurgu={ozet.bugunUygunsuz > 0
            ? 'danger'
            : ozet.bugunOlcum > 0 ? 'success' : undefined}
          sayiKritik={ozet.bugunUygunsuz > 0}
          altKritik={ozet.bugunUygunsuz > 0}
          alt={ozet.bugunOlcum === 0
            ? 'bugün ölçüm girilmedi'
            : ozet.bugunUygunsuz > 0
              ? `${ozet.bugunUygunsuz} ölçüm kritik limiti aştı`
              : `%${ozet.uygunlukYuzdesi} uygunluk`}
          rota="haccp-kayitlari" navKey="haccp-kayitlari" onGit={git}
          erisim={!!onOpenWorkspaceRoute}
        />
      </div>

      {/* ── DİKKAT GEREKTİREN KONULAR ───────────────────────────────────── */}
      <section className="card">
        <div className="section-header compact">
          <h3>Dikkat gerektiren konular</h3>
          <div>
            {kritikSayisi > 0 && (
              <span className="onem-rozeti kritik">{kritikSayisi} kritik</span>
            )}
            <span className="muted">{dikkat.length} konu</span>
          </div>
        </div>

        {dikkat.length === 0
          ? (
            <p className="muted detail-hint">
              <strong>Bekleyen bir şey yok.</strong> Kritik stok altına düşen kalem,
              süresi geçmiş parti, başlatılamayan iş emri ve açık düzeltici
              faaliyet bulunmuyor. Bu satırların hepsi defterden okunuyor —
              boş olması “henüz bağlanmadı” demek değil, gerçekten boş demek.
            </p>
          )
          : (
            <div className="table-wrap">
              <table className="data-table compact">
                <thead>
                  <tr><th>Önem</th><th>Konu</th><th>Ayrıntı</th><th></th></tr>
                </thead>
                <tbody>
                  {dikkatSirali.map(d => (
                    <tr key={d.id}>
                      {/* Rozet hem renkli hem YAZILI: rengi ayırt edemeyen
                          bir kullanıcı da hangisinin kritik olduğunu görür. */}
                      <td>
                        <span className={`onem-rozeti ${d.aciliyet}`}>
                          {d.aciliyet === 'kritik' ? 'Kritik' : 'Uyarı'}
                        </span>
                      </td>
                      <td><strong>{d.baslik}</strong></td>
                      <td className="muted">{d.ayrinti}</td>
                      <td className="actions-cell">
                        {d.rota && onOpenWorkspaceRoute && (
                          <button className="btn" type="button"
                            onClick={() => git(d.rota, d.navKey)}>
                            Aç ›
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      <div className="warehouse-layout">
        {/* ── BUGÜN ─────────────────────────────────────────────────────── */}
        <section className="card warehouse-main">
          <div className="section-header compact">
            <h3>Bugün deftere ne yazıldı</h3>
            <span className="muted">{new Date().toLocaleDateString('tr-TR')}</span>
          </div>
          <dl className="detail-grid">
            <dt>Üretime başlanan</dt>
            <dd>
              {bugunBaslayan.length === 0
                ? <span className="muted">yok</span>
                : bugunBaslayan.map(i => i.isEmriNo).join(', ')}
            </dd>
            <dt>Üretimi tamamlanan</dt>
            <dd>
              {bugunBiten.length === 0
                ? <span className="muted">yok</span>
                : bugunBiten.map(i => `${i.isEmriNo} (${i.ciktiKalemiAd ?? ''})`).join(', ')}
            </dd>
            <dt>Sevk edilen</dt>
            <dd>
              {bugunSevkEdilen.length === 0
                ? <span className="muted">yok</span>
                : bugunSevkEdilen.map(s => `${s.sevkiyatNo} · ${s.musteriAd}`).join(', ')}
            </dd>
            <dt>HACCP ölçümü</dt>
            <dd>
              {ozet.bugunOlcum === 0
                ? <span className="muted">yok</span>
                : <>
                    {ozet.bugunOlcum} ölçüm
                    {ozet.bugunUygunsuz > 0 && (
                      <span className="is-critical"> · {ozet.bugunUygunsuz} uygunsuz</span>
                    )}
                  </>}
            </dd>
          </dl>
          <p className="muted detail-hint">
            Bu satırlar bir özet tablosundan değil, <strong>belgelerin
            kendisinden</strong> okunuyor. Ayrı bir günlük özet tutsaydık,
            defterle senkron kalmadığı gün panel yanlış rakam gösterir ve bunu
            kimse fark etmezdi.
          </p>
        </section>

        {/* ── ZİNCİRİN DURUMU ──────────────────────────────────────────── */}
        <aside className="warehouse-side">
          <section className="card">
            <div className="section-header compact"><h3>Zincirin durumu</h3></div>
            <div className="table-wrap">
              <table className="data-table compact">
                <tbody>
                  <ZincirSatiri
                    ad="Stok kalemi" sayi={kalemler.length}
                    rota="depo" navKey="depo" onGit={git} erisim={!!onOpenWorkspaceRoute}
                  />
                  <ZincirSatiri
                    ad="İş emri" sayi={isEmirleri.length}
                    rota="uretim-emirleri" navKey="uretim-emirleri" onGit={git}
                    erisim={!!onOpenWorkspaceRoute}
                  />
                  <ZincirSatiri
                    ad="Sevkiyat" sayi={sevkiyatlar.length}
                    rota="sevkiyatlar" navKey="sevkiyatlar" onGit={git}
                    erisim={!!onOpenWorkspaceRoute}
                  />
                  <ZincirSatiri
                    ad="HACCP ölçümü" sayi={olcumler.length}
                    rota="haccp-kayitlari" navKey="haccp-kayitlari" onGit={git}
                    erisim={!!onOpenWorkspaceRoute}
                  />
                  {uygunsuzOlcumler.length > 0 && (
                    <tr>
                      <td className="is-critical"><strong>Uygunsuz ölçüm</strong></td>
                      <td className="num is-critical">{uygunsuzOlcumler.length}</td>
                      <td className="actions-cell">
                        {onOpenWorkspaceRoute && (
                          <button className="btn" type="button"
                            onClick={() => git('izlenebilirlik', 'izlenebilirlik')}>
                            İzle
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="muted detail-hint">
              Bir sorun çıktığında aranacak liste <strong>İzlenebilirlik</strong>
              ekranından çıkıyor: parti numarası yazılır, o partinin içindekiler
              ve gittiği müşteriler iki saniyede listelenir.
            </p>
          </section>

          {isEmirleri.length === 0 && kalemler.length === 0 && (
            <section className="card empty-state">
              <p><strong>Defter henüz boş.</strong></p>
              <p>
                Stok kartı ve tedarikçi ekleyip bir mal kabul yapıldığında bu
                panel kendiliğinden dolmaya başlar.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PANEL KUTUCUĞU · tıklanınca ilgili bölüme götürür
// ---------------------------------------------------------------------------
// Emrah, 10.10: *"O kutucuklara tıklayınca ilgili bölüme gitse nasıl olur?
// sadece soruyorum."* — İyi fikir: panel zaten "nereye bakmalıyım" ekranı;
// cevabı görüp oraya gitmek için menüyü yeniden taramak gereksiz.
//
// ⚠️ `div` DEĞİL `button`. Tıklanabilir div klavyeyle kullanılamaz ve ekran
// okuyucu onu düğme olarak okumaz.
// ⚠️ Rota verilmemişse veya erişim yoksa DÜĞME OLMUYOR, düz div kalıyor.
// Tıklanıp "yetkiniz yok" duvarına çarpılan bir kutucuk, çalışmayan bir
// kutucuktan daha kötüdür.
// ═══════════════════════════════════════════════════════════════════════════
function SayiKarti({
  baslik, sayi, alt, vurgu, sayiKritik, altKritik, rota, navKey, onGit, erisim,
}: {
  baslik: string
  sayi: number
  alt: string
  vurgu?: 'danger' | 'warning' | 'success'
  sayiKritik?: boolean
  altKritik?: boolean
  rota: BusinessWorkspaceRoute
  navKey: BusinessWorkspaceNavKey
  onGit: (r?: BusinessWorkspaceRoute, n?: BusinessWorkspaceNavKey) => void
  erisim: boolean
}){
  const sinif = `metric-card${vurgu ? ` ${vurgu}` : ''}`
  const icerik = (
    <>
      <span>{baslik}</span>
      <strong className={sayiKritik ? 'is-critical' : undefined}>{sayi}</strong>
      <p className={altKritik ? 'is-critical' : 'muted'}>{alt}</p>
    </>
  )

  if(!erisim) return <div className={sinif}>{icerik}</div>

  return (
    <button
      className={sinif} type="button"
      onClick={() => onGit(rota, navKey)}
      title={`${baslik} · ayrıntısına git`}
    >
      {icerik}
      <span className="metric-card-git" aria-hidden="true">Aç ›</span>
    </button>
  )
}

function ZincirSatiri({
  ad, sayi, rota, navKey, onGit, erisim,
}: {
  ad: string
  sayi: number
  rota: BusinessWorkspaceRoute
  navKey: BusinessWorkspaceNavKey
  onGit: (r?: BusinessWorkspaceRoute, n?: BusinessWorkspaceNavKey) => void
  erisim: boolean
}){
  return (
    <tr>
      <td>{ad}</td>
      <td className={`num ${sayi === 0 ? 'muted' : ''}`}>{sayi}</td>
      <td className="actions-cell">
        {erisim && (
          <button className="btn" type="button" onClick={() => onGit(rota, navKey)}>Aç</button>
        )}
      </td>
    </tr>
  )
}
