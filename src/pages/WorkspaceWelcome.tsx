import React from 'react'
import { GettingStartedCard } from '../components/GettingStartedCard'
import type {
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from '../navigation/app-navigation.types'
import { karsilamaDurumunuOku, type KarsilamaDurumu } from '../workspace/karsilama.repository'
import type { User } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Karşılama ekranı · MIYOP-065
//
// ⚠️ MÜŞTERİNİN GÖRDÜĞÜ İLK EKRAN BUDUR. Şifresini belirledikten hemen
// sonra buraya düşüyor. 29.10.2026'ya kadar burası şöyle yazıyordu:
//
//     "Hos geldiniz"  ·  "Workspace henuz bos"  ·  "Ilk Widget Ekle"
//     "Dashboarda Git"  ·  "Premium onboarding deneyimi aktif"
//     "Product tour, quick tips, getting started kartlari ve empty state
//      sistemi birlikte calisir."
//
// Yani Türkçe karaktersiz, ve GELİŞTİRİCİNİN dilinde. Müşteri "widget"
// kelimesini bilmek zorunda değil; "empty state sistemi" ise ona değil,
// bize söylenmiş bir cümle. Hepsi yeniden yazıldı.
//
// ── ÜÇ KUSUR DAHA VARDI ──────────────────────────────────────────────────
//  1. ⚠️ **"Tamamlandı" rozeti SAHTEYDİ.** `hasBusinessModules` ile
//     ölçülüyordu — yani bir MODÜL kaydının varlığıyla. Bir modülün kurulu
//     olması stok kartı açıldığını kanıtlamaz; yeni müşteri hiçbir şey
//     yapmadan "tamamlandı" görüyordu. Artık üç adımın üçü de
//     veritabanından SAYILIYOR (`workspace/karsilama.repository.ts`).
//  2. ⚠️ **Donmuş rotalara düğme vardı:** "Reçetelere Git" ve "Ürünlere
//     Git". O ekranlar kapalı; müşteri boşa tıklıyordu. Kaldırıldı.
//  3. ⚠️ Altı adım vardı ve ikisi ("Widget ekle", "Workspace Ayarları")
//     artık olmayan ya da hazır olmayan şeylere götürüyordu. Üç gerçek
//     adım kaldı: firma bilgileri, ilk ürün kartı, ekip.
//
// ⚠️ Bu ekran artık `localStorage` OKUMUYOR. Eskiden firma adını oradan
// alıyordu; `kiraci-ekrani-veri-kaynagi.arch.test.ts` bu yüzden onu borç
// listesinde tutuyordu.
// ═══════════════════════════════════════════════════════════════════════════

type Props = {
  currentUser: User
  /**
   * ⚠️ BİLEREK KULLANILMIYOR. İşletme Ayarları ekranı hâlâ veriyi
   * tarayıcıya yazıyor (HEDEFLER 3.4) — yeni bir müşteriyi ilk dakikasında
   * oraya yollamak, "kaydedildi" deyip kaybeden bir ekrana yollamak olur.
   * Prop çağıran taraf için duruyor; o ekran veritabanına bağlanınca
   * buradan bir düğme açılacak.
   */
  onOpenWorkspaceSettings: () => void
  onOpenWorkspaceRoute: (route: BusinessWorkspaceRoute, navKey: BusinessWorkspaceNavKey) => void
}

type Adim = {
  key: string
  baslik: string
  aciklama: string
  icon: 'stock' | 'user' | 'settings'
  dugme: string
  route: BusinessWorkspaceRoute
  navKey: BusinessWorkspaceNavKey
  /** `true` bitti, `false` bekliyor, `null` ÖLÇÜLEMEDİ. */
  bitti: boolean | null
  /** Rozetin altında görünen ölçüm. Boşsa yazılmaz. */
  olcum: string
}

/** ⚠️ `null` "sayamadım" demek; "0" diye göstermek yalan olur. */
const sayiMetni = (sayi: number | null, tekil: string): string => {
  if(sayi === null) return 'Ölçülemedi'
  return `${sayi} ${tekil}`
}

const adimlariKur = (durum: KarsilamaDurumu): Adim[] => [
  {
    key: 'firma-bilgileri',
    baslik: 'Firma bilgilerinizi tamamlayın',
    aciklama: 'Vergi dairesi, vergi numarası ve adres; irsaliye, etiket ve '
      + 'sözleşmelerde bu bilgiler kullanılıyor.',
    icon: 'settings',
    dugme: 'Firma Profilini Aç',
    route: 'company-profile',
    navKey: 'company-profile',
    bitti: durum.vergiNumarasiVar,
    olcum: durum.vergiNumarasiVar === null
      ? 'Ölçülemedi'
      : durum.vergiNumarasiVar ? 'Vergi numarası girilmiş' : 'Vergi numarası boş',
  },
  {
    key: 'ilk-urun-karti',
    baslik: 'İlk ürün kartınızı açın',
    aciklama: 'Hammadde ve mamul kartları işin temeli: reçete de, iş emri de, '
      + 'sevkiyat da bunların üstüne kuruluyor.',
    icon: 'stock',
    dugme: 'Depoyu Aç',
    route: 'depo',
    navKey: 'depo',
    bitti: durum.urunKartiSayisi === null ? null : durum.urunKartiSayisi > 0,
    olcum: sayiMetni(durum.urunKartiSayisi, 'kart'),
  },
  {
    key: 'ekip',
    baslik: 'Ekibinizi ekleyin',
    aciklama: 'Depo sorumlusu, üretim şefi, kalite… Herkes kendi adıyla girer '
      + 've yaptığı işin altında kendi imzası kalır.',
    icon: 'user',
    dugme: 'Kullanıcıları Aç',
    route: 'users',
    navKey: 'users',
    // Tek kullanıcı = yalnız işletme sahibi; ekip henüz eklenmemiş.
    bitti: durum.kullaniciSayisi === null ? null : durum.kullaniciSayisi > 1,
    olcum: sayiMetni(durum.kullaniciSayisi, 'kullanıcı'),
  },
]

export default function WorkspaceWelcome({ currentUser, onOpenWorkspaceRoute }: Props){
  const [durum, setDurum] = React.useState<KarsilamaDurumu | null>(null)

  React.useEffect(() => {
    let gecerli = true
    void karsilamaDurumunuOku().then(gelen => { if(gecerli) setDurum(gelen) })
    return () => { gecerli = false }
  }, [currentUser.id])

  const kisi = currentUser.fullName || currentUser.username
  const firmaAdi = durum?.firmaAdi
  const adimlar = durum ? adimlariKur(durum) : []
  const kalan = adimlar.filter(adim => adim.bitti === false).length
  const olculemeyen = adimlar.filter(adim => adim.bitti === null).length

  return (
    <div className="workspace-welcome-page">
      <section className="workspace-welcome-hero">
        <div>
          <span className="status-pill success">Kurulum tamamlandı</span>
          <h2>Hoş geldiniz, {kisi}</h2>
          <p>
            {firmaAdi
              ? `${firmaAdi} için MİYOP kullanıma hazır.`
              : 'MİYOP kullanıma hazır.'}
            {' '}
            Aşağıdaki üç adımı tamamladığınızda günlük işe geçebilirsiniz.
            İsterseniz doğrudan menüden de ilerleyebilirsiniz.
          </p>
        </div>
        <div className="workspace-welcome-mark">
          <span aria-hidden="true">Mİ</span>
        </div>
      </section>

      {durum === null && (
        <section className="card"><p className="muted">Kurulum durumu okunuyor…</p></section>
      )}

      {durum !== null && (
        <section className="getting-started-grid" aria-label="Başlangıç adımları">
          {adimlar.map(adim => (
            <GettingStartedCard
              key={adim.key}
              title={adim.baslik}
              description={adim.aciklama}
              icon={adim.icon}
              badge={adim.bitti === null ? 'Ölçülemedi' : adim.bitti ? 'Tamamlandı' : 'Bekliyor'}
              actionLabel={adim.dugme}
              steps={[
                // ⚠️ Tek adım, ve ölçülen adım. Eskiden burada "Ekranı aç" ve
                // "İlk aksiyonu tamamla" diye iki satır vardı; ikincisi HİÇBİR
                // ZAMAN işaretlenmiyordu, yani her kart hep yarım görünüyordu.
                { key: `${adim.key}:olcum`, label: adim.olcum, done: adim.bitti === true },
              ]}
              onAction={() => onOpenWorkspaceRoute(adim.route, adim.navKey)}
            />
          ))}
        </section>
      )}

      {durum !== null && (
        <section className="workspace-welcome-action">
          <div>
            <h3>Durum</h3>
            <p>
              {olculemeyen > 0
                ? `${olculemeyen} adım şu an ölçülemedi. Bağlantı döndüğünde `
                  + 'bu sayfayı yenileyin.'
                : kalan === 0
                  ? 'Üç adımın üçü de tamam. Artık günlük işe geçebilirsiniz.'
                  : `${kalan} adım bekliyor. Sırayla gitmek zorunda değilsiniz.`}
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
