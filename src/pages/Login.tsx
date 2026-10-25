import React from 'react'
import { authenticateCredentials, AuthenticationState } from '../auth/authentication.service'
import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { kesinEpostaMi } from '../auth/giris-adresi'

type Props = { onLogin: (state: AuthenticationState) => void }

type PortalUpdate = {
  type: string
  title: string
  description: string
}

type WhyItem = {
  title: string
  description: string
}

// ⚠️ 25.10.2026 · BU BÖLÜM BAŞTAN YAZILDI — ESKİSİ UYDURMAYDI.
//
// Burada dört "haber" kartı vardı: *"EVREN360 SaaS Yönetim Merkezi"*,
// *"Unified Identity Foundation"*, *"Operasyon ekranları sadeleşti"*,
// *"Security Gateway hazırlığı"*. Bunlardan **"Security Gateway" diye bir
// şey yok**; "Unified Identity Foundation" bir ürün değil, bizim iç
// adlandırmamız; "finans operasyonları tek merkezde toplandı" diyordu ama
// Finans modülü DONMUŞ. Yani müşterinin gördüğü ilk ekranda, kendi
// kendimize yazdığımız ve kimsenin yayınlamadığı bir sürüm notu duruyordu.
// Referans müşteri bölümü (aşağıdaki nota bakın) aynı sebeple kaldırılmıştı;
// bu kartlar da aynı aileydi.
//
// ⚠️ YENİ KURAL: bu listedeki her cümlenin arkasında ÇALIŞAN bir şey olmak
// zorunda. Dondurulmuş bir modülün adı buraya yazılamaz —
// `src/pages/giris-vitrini-dogru-soyler.arch.test.ts` bunu ölçüyor.
const portalUpdates: PortalUpdate[] = [
  {
    type: 'Gıda Güvenliği',
    title: 'HACCP kontrolleri hazır kurulu geliyor',
    description: 'Kritik kontrol noktaları, ölçüm ve düzeltici faaliyet '
      + 'kaydı her yeni işletmede kurulu başlar; hızlı soğutma dahil.'
  },
  {
    type: 'İzlenebilirlik',
    title: 'Parti bazlı izlenebilirlik',
    description: 'Hammadde partisinden son ürüne, son üründen sevkiyata: '
      + 'hangi partinin nereye gittiği kayıtla takip edilir.'
  },
  {
    type: 'Etiket',
    title: 'Alerjen ve besin değeri beyanı',
    description: 'Etiket beyanı tek işlemde yazılır; beyanı olmayan ürüne '
      + 'alerjen damgası basılması veritabanı tarafından engellenir.'
  },
  {
    type: 'Yetki',
    title: 'Yetki ekranda değil, sunucuda',
    // ⚠️ "Her değişiklik denetim kaydına düşer" yazıyordu — MUTLAK bir
    // cümleydi ve yanlıştı (MIYOP-072, Codex). Stok, sipariş, üretim,
    // kalite ve yetki değişiklikleri denetime düşüyor; ama bugün hâlâ
    // tarayıcıya yazan ekranlar var (Firma Profili, İşletme Ayarları) ve
    // onların değişikliği hiçbir denetim kaydına girmiyor. Cümle o
    // ekranlar bitince genişletilecek, şimdiden genişletilmeyecek.
    description: 'Yetkisiz bir kayıt denemesi, ekranı atlayıp doğrudan '
      + 'gönderilse bile reddedilir. Stok, sipariş, üretim, kalite ve '
      + 'yetki değişiklikleri iz bırakır: kim, ne zaman, neyi değiştirdi.'
  }
]

// ⚠️ "REFERANS MÜŞTERİLER" BÖLÜMÜ KALDIRILDI — UYDURMAYDI.
// Burada 'Aster Workspace', 'Nova Grup', 'Orion Merkez' diye üç şirket
// yazıyordu ve "İlk işletmeler" başlığı altında referans müşteri olarak
// gösteriliyordu. Böyle müşteriler YOK. Bu, giriş ekranındaki mock veriden
// de kötüsüydü: müşteriye söylenen bir yalandı. Gerçek referanslarımız
// olduğunda, adlarını kullanma izniyle birlikte geri gelir.

const whyItems: WhyItem[] = [
  {
    title: 'Bulut Tabanlı',
    // ⚠️ "aynı hesapla her cihazdan aynı kayda ulaşırsınız" yazıyordu —
    // yine MUTLAK ve yine yanlış (MIYOP-072). Operasyon kayıtları için
    // doğru; ama Firma Profili ve İşletme Ayarları ekranları bugün hâlâ
    // tarayıcıya yazıyor, yani onların verisi cihazda kalıyor. Söz,
    // gerçekten sunucuda duran şeylerle sınırlandı.
    description: 'Stok, sipariş, üretim, sevkiyat ve kalite kayıtlarınız '
      + 'sunucuda durur; aynı hesapla her cihazdan aynı kayda ulaşırsınız. '
      + 'Kurulum ya da yerel sunucu gerekmez.'
  },
  // ⚠️ "Modüler Yapı" kartı KALDIRILDI. *"İşlem Yönetimi, Dijital Katalog,
  // stok, cari, finans ve personel modülleri ihtiyaca göre aktif edilir"*
  // diyordu — altı addan DÖRDÜ dondurulmuş modül (İşlem Yönetimi, Dijital
  // Katalog, Cari, Finans, Personel). Yani müşteriye olmayan modülleri
  // sayıyorduk. Gerçek modül listesi menüde zaten görünüyor; vitrinde
  // olmayanı saymaya gerek yok.
  //
  // ⚠️ "Çoklu Şube" kartı KALDIRILDI. Emrah'ın kararı (25.10): şube
  // şimdilik olmayacak, sistem işletmenin genel merkezi gibi davranacak.
  // Veritabanı şubeyi taşımaya devam ediyor (ileride geri gelecek) ama
  // MÜŞTERİYE SÖZ VERİLMİYOR. → docs/kararlar/tek-merkez-karari.md
  {
    title: 'Stok Defteri',
    description: 'Her giriş ve çıkış silinemez bir kayıttır; parti, son '
      + 'kullanma tarihi ve tedarikçi kaydın içinde durur.'
  },
  {
    // ⚠️ "Yapay Zeka Destekli" yazıyordu. Satış kararı (11.10): yapay zeka
    // DENMEYECEK. Teknik başlık "kural motoru"; müşteriye verilen söz,
    // sistemin ne yapması gerektiğini söylemesi VE neden söylediğini
    // göstermesidir. Bu söz tutulabilir; "yapay zeka" tutulamaz.
    title: 'Kural Motoru',
    description: 'Sistem size ne yapmanız gerektiğini söyler; üstelik neden '
      + 'söylediğini de gösterir. Her uyarının arkasında okunabilir bir kural '
      + 've ona dayanak olan kayıtlar vardır.'
  },
  {
    // ⚠️ "Identity, Security Gateway" yazıyordu. "Security Gateway" diye bir
    // şey YOK. Ama anlatacak gerçek bir şey VAR ve eskisinden güçlü:
    // yetki kapıları veritabanında duruyor.
    title: 'Güvenli Altyapı',
    description: 'Her işletmenin verisi sunucu düzeyinde kendisine kilitli; '
      + 'başka bir işletmenin kaydı hiç gelmez. Yetki kontrolü ekranda '
      + 'değil veritabanında, ve her değişiklik iz bırakır.'
  },
  {
    title: 'Rol Ayrımı',
    description: 'Depo, satın alma, üretim, kalite, sevkiyat ve muhasebe '
      + 'için ayrı roller; kim neyi görür ve değiştirir, baştan tanımlı.'
  }
]

// ⚠️ 25.10.2026 · `formatDate` ve `buildAnnouncementContext` SİLİNDİ.
// Duyurular bölümüyle birlikte gereksiz kaldılar. Yan kazanç şu ve küçük
// değil: `buildAnnouncementContext` giriş ekranından `loadCompanies()` ve
// `loadLicensePackages()` çağırıyordu — yani **müşterinin gördüğü ilk
// ekran, depo boşken demo firma ve demo lisans paketi ÜRETEN** iki
// fonksiyonu tetikliyordu (HEDEFLER 3.10). Artık giriş ekranı
// `../storage`a hiç dokunmuyor; tek veri kaynağı Supabase oturumu.
// Donduran test: `src/pages/giris-vitrini-dogru-soyler.arch.test.ts`

export default function Login({ onLogin }: Props){
  /**
   * ⚠️ BU ALAN ARTIK "E-POSTA" DEĞİL, "KULLANICI ADI YA DA E-POSTA".
   *
   * İşletme sahibi gerçek e-postasıyla girer; personelin e-postası YOK,
   * kullanıcı adıyla girer (karar: docs/yetki-ekrani.md). Tek alan, iki
   * girdi: hangisi olduğuna `giris-adresi.ts` karar veriyor.
   *
   * ⚠️ `type="email"` KALDIRILDI. Kalsaydı tarayıcı "depocu" yazan kişiye
   * "lütfen geçerli bir e-posta girin" der ve kişi hiç giremezdi — hesabı
   * açılmış olsa bile. Alan artık `type="text"`.
   */
  const [kimlik, setKimlik] = React.useState('')
  /** Giriş adı ipucu paneli açık mı. Varsayılan KAPALI: bilen kişiyi
      yormasın, bilmeyen bir tıklamayla öğrensin. */
  const [ipucuAcik, setIpucuAcik] = React.useState(false)
  const [password, setPassword] = React.useState('')
  /**
   * ⚠️ AYRI BİR "İŞLETME KODU" KUTUSU YOK — VE BU BİLİNÇLİ.
   *
   * İlk tasarımda, giriş başarısız olunca beliren ikinci bir kutu vardı.
   * Emrah'ın itirazı yerindeydi: en acemi kullanıcıya, en kötü anda, hiç
   * duymadığı bir kavram öğretiyordu. Artık firma kodu giriş adının
   * PARÇASI (`alaattin.kocatepe@ABCGIDA`) — tek alan, tek şey ezberlemek.
   *
   * Kutu kalktı ama taşıma yolu duruyor (`authenticateCredentials`'ın
   * `isletmeKodu` seçeneği): A5'te her müşteriye alt alan adı verilince
   * kod ADRESTEN okunup oradan geçirilecek, kullanıcıya hiç sorulmayacak.
   */
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const loginPanelRef = React.useRef<HTMLElement | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setNotice('')
    setError('')
    setSubmitting(true)
    try {
      const result = await authenticateCredentials(kimlik, password, {
        requestedPath: window.location.pathname
      })
      if(result.success){ onLogin(result.state); return }

      // ⚠️ MIYOP-051 · KOTA VE ARIZA, YANLIŞ PAROLA DEĞİLDİR.
      // Bu mesaj hesap hakkında hiçbir şey söylemez — "çok fazla deneme"
      // ya da "şu an giriş yapılamıyor" demek, bir hesabın var olup
      // olmadığını açıklamaz. Ama parolası DOĞRU olan kişiye "şifreniz
      // hatalı" demek, onu şifresini boş yere değiştirmeye iter ve
      // arızayı da gizler.
      if(result.gecikmeMesaji){
        setError(result.gecikmeMesaji)
        return
      }

      // ⚠️ TEK CÜMLE, ÜÇ FARKLI SEBEP: ad yok, şifre yanlış, hesap kapalı.
      // Ayırmıyoruz — ayırmak, "bu kullanıcı adı var" bilgisini kapıdaki
      // herkese söylemek olurdu.
      //
      // Tek istisna, bilgi değil HATIRLATMA: firma kodunu yazmamış birine
      // giriş adının biçimini söylüyoruz. Bu cümle hesabın var olup
      // olmadığına dair hiçbir şey söylemiyor — adını yanlış yazana da,
      // hiç hesabı olmayana da aynı şekilde çıkıyor.
      setError(kimlik.includes('@')
        ? 'Giriş adı veya şifre hatalı ya da hesap kapalı.'
        : 'Giriş adı veya şifre hatalı ya da hesap kapalı. Personelseniz '
          + 'adınızı firma kodunuzla birlikte yazın: ornek.ad@FIRMAKODU')
    } catch {
      setError('Giriş yapılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.')
    } finally {
      setSubmitting(false)
    }
  }

  const scrollToLogin = () => {
    loginPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const openApplication = () => {
    window.location.href = '/apply'
  }

  /**
   * Şifremi unuttum.
   *
   * ── NEDEN ŞİMDİ BAĞLANDI ────────────────────────────────────────────────
   * Burada şu yazıyordu: "Şifre sıfırlama akışı sonraki servis fazı için
   * hazırlanacaktır." Yani düğme vardı, işi yoktu. O gün geldi: şifre
   * belirleme ekranı hazır (`SifreBelirle`, A4D madde 6) ve aynı bağlantıyı
   * karşılıyor (`type=recovery`).
   *
   * ⚠️ HESABIN VAR OLUP OLMADIĞINI SÖYLEMİYORUZ. Cevap her iki durumda da
   * aynı: "bağlantı gönderildi". Aksi hâlde bu ekran, hangi e-postaların
   * sistemde kayıtlı olduğunu isteyen herkese söyleyen bir araca dönerdi.
   */
  const [sifreGonderiliyor, setSifreGonderiliyor] = React.useState(false)

  const forgotPassword = async () => {
    setError('')
    setNotice('')

    const adres = kimlik.trim().toLowerCase()
    if(!adres){
      setError('Şifre bağlantısı için e-posta adresinizi yazın.')
      return
    }
    // ⚠️ KULLANICI ADIYLA ŞİFRE SIFIRLAMA YOK — ÇÜNKÜ GİDECEK ADRES YOK.
    // Personelin e-postası olmadığı için bağlantı yollanamaz. Burada
    // "gönderildi" demek, hiç gelmeyecek bir e-postayı beklettirmek olurdu.
    // Doğru yol yöneticisinden geçiyor: şifreyi o sıfırlar, kişi ilk
    // girişinde kendisi belirler.
    // ⚠️ `includes('@')` YETMEZ: `ad.soyad@ABCGIDA` de @ taşıyor ama bir
    // e-posta değil, oraya posta gitmez. Ayırmayı tek yerde yapan
    // `kesinEpostaMi` kullanılıyor (bkz. auth/giris-adresi.ts).
    if(!kesinEpostaMi(adres)){
      setError('Şifre sıfırlama bağlantısı yalnızca e-posta adresine '
        + 'gönderilebilir. Giriş adınız ad.soyad@FIRMAKODU biçimindeyse '
        + 'şifrenizi yöneticiniz sıfırlar; ilk girişinizde kendi şifrenizi '
        + 'belirlersiniz.')
      return
    }
    if(!isSupabaseConfigured()){
      setError('Sunucu bağlantısı yapılandırılmamış. Platform yöneticinize bildirin.')
      return
    }

    setSifreGonderiliyor(true)
    try {
      const { error: hata } = await getSupabase().auth.resetPasswordForEmail(adres, {
        redirectTo: `${window.location.origin}/`,
      })
      if(hata){
        // Hız sınırı gerçek ve sık: ham İngilizce metin yerine ne yapması
        // gerektiğini söylüyoruz.
        //
        // ⚠️ 2026-09-21: "Şifre bağlantısı gönderilemedi: Error sending
        // recovery email" müşteriye olduğu gibi gösteriliyordu. Bu metin
        // bizim tarafımızdaki bir arızadır (e-posta sunucusu ayarı) ve
        // müşteriye hiçbir şey anlatmaz. Müşteri ne yapacağını görür; ham
        // metin yalnızca konsola düşer (oturum açılmadan hata defterine
        // yazılamıyor — anon'a yazma yetkisi bilerek verilmedi).
        console.warn('[MİYOP] Şifre bağlantısı gönderilemedi:', hata.message)
        setError(/rate limit|too many/i.test(hata.message)
          ? 'Çok sık denendi. Birkaç dakika sonra tekrar deneyin.'
          : 'Şifre bağlantısı şu an gönderilemedi. Lütfen birkaç dakika sonra '
            + 'tekrar deneyin; sorun sürerse MİYOP destek ekibine yazın.')
        return
      }
      setNotice(
        `${adres} adresine şifre belirleme bağlantısı gönderildi. `
        + 'Gelen kutunuzda yoksa gereksiz/spam klasörüne bakın. '
        + 'Bağlantı kısa ömürlüdür.',
      )
    } catch(e){
      console.warn('[MİYOP] Şifre bağlantısı gönderilemedi:', e)
      setError('Şifre bağlantısı şu an gönderilemedi. Lütfen birkaç dakika sonra tekrar deneyin.')
    } finally {
      setSifreGonderiliyor(false)
    }
  }

  return (
    <div className="unified-login-portal">
      <header className="unified-login-header">
        <a className="unified-login-brand" href="#portal-top" aria-label="MIYOP ana sayfa">
          <span className="unified-login-logo">M</span>
          <span>
            <strong>MIYOP</strong>
            <small>EVREN360 Platformu</small>
          </span>
        </a>
        <nav className="unified-login-nav" aria-label="Portal">
          <a href="#updates">Güncellemeler</a>
          <a href="#why-miyop">Neden MIYOP?</a>
        </nav>
        <button className="btn unified-login-header-action" type="button" onClick={openApplication}>İşletme Başvurusu</button>
      </header>

      <main id="portal-top">
        <section className="unified-login-hero">
          <div className="unified-login-hero-media" aria-hidden="true" />
          <div className="unified-login-hero-content">
            <div className="unified-login-hero-copy">
              <span className="unified-login-eyebrow">Unified Login Portal</span>
              <h1>MIYOP</h1>
              <p className="unified-login-slogan">İşletme operasyonlarından SaaS platform yönetimine uzanan tek merkez.</p>
              <p className="unified-login-description">
                {/* ⚠️ "duyuru" kelimesi ÇIKARILDI (MIYOP-072): duyuru
                    bölümü kaldırıldı, hâlâ yetenek olarak sayılamaz. */}
                EVREN360, işletme çalışma alanı ve gelecek modüler uygulamalar için ortak giriş, başvuru ve platform vitrinini tek portalda birleştirir.
              </p>
              <div className="unified-login-hero-actions">
                <button className="btn primary" type="button" onClick={scrollToLogin}>Hemen Giriş Yap</button>
                <button className="btn" type="button" onClick={openApplication}>İşletme Başvurusu</button>
              </div>
            </div>

            <section className="unified-login-panel" ref={loginPanelRef} aria-label="Kullanıcı girişi">
              <div className="unified-login-panel-header">
                <span>Giriş Merkezi</span>
                <h2>Hesabınıza giriş yapın</h2>
              </div>
              <form onSubmit={submit}>
                <label>
                  <span>Giriş adı</span>
                  {/* ⚠️ Burada ÖNCEDEN gerçek bir müşterinin giriş adı
                      yazıyordu (`alaattin.kocatepe@ABCGIDA`). Bir kişinin
                      hesabını örnek diye herkese göstermek doğru değil;
                      üstelik "benim adım bu mu olacak" diye düşündürüyor.
                      Artık BİÇİM gösteriliyor, kişi değil — Google ve
                      Microsoft'un giriş ekranları da böyle yapıyor. */}
                  <input
                    autoComplete="username"
                    type="text"
                    placeholder="ad.soyad@FIRMAKODU  ·  ya da e-posta adresiniz"
                    value={kimlik}
                    onChange={event => {
                      setKimlik(event.target.value)
                      setError('')
                    }}
                  />
                  {/* Depocu `ad.soyad@FIRMAKODU` yazması gerektiğini bilmiyor.
                      İpucu tek satırda küçük yazıyordu; artık açılıp örnek
                      gösteriyor. Sayfayı ikiye bölmeden — iki ayrı giriş
                      kapısı, kullanıcıya daha yazmadan yanlış yapabileceği
                      bir seçim dayatırdı. */}
                  <small className="unified-login-hint">
                    <button
                      type="button"
                      className="unified-login-hint-toggle"
                      aria-expanded={ipucuAcik}
                      onClick={() => setIpucuAcik(acik => !acik)}
                    >
                      Giriş adımı bilmiyorum
                    </button>
                  </small>
                  {ipucuAcik && (
                    <div className="unified-login-hint-panel">
                      <p>
                        <strong>Personel iseniz</strong> işletmenizin size
                        verdiği giriş adını yazın: adınız, nokta, soyadınız,
                        “@” ve işletme kodunuz.
                        <br />
                        Örnek: <code>ahmet.demir@ORNEKGIDA</code>
                      </p>
                      <p>
                        <strong>İşletme sahibi iseniz</strong> başvuruda
                        verdiğiniz e-posta adresinizi yazın.
                      </p>
                      <p className="muted">
                        İşletme kodunuzu bilmiyorsanız işletmenizdeki
                        yöneticiye sorun; her işletmenin kendi kodu vardır.
                      </p>
                    </div>
                  )}
                </label>
                <label>
                  <span>Şifre</span>
                  <input
                    autoComplete="current-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={event => {
                      setPassword(event.target.value)
                      setError('')
                    }}
                  />
                </label>
                {error && <div className="unified-login-message error">{error}</div>}
                {notice && <div className="unified-login-message">{notice}</div>}
                <button className="btn primary unified-login-submit" type="submit" disabled={submitting}>
                  {submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
                </button>
                <div className="unified-login-secondary-actions">
                  <button type="button" onClick={() => void forgotPassword()} disabled={sifreGonderiliyor}>
                    {sifreGonderiliyor ? 'Gönderiliyor…' : 'Şifremi Unuttum'}
                  </button>
                  <button type="button" onClick={openApplication}>İşletme Başvurusu</button>
                </div>
              </form>
            </section>
          </div>
        </section>

        <section className="unified-login-section unified-login-platform">
          <div>
            <span className="unified-login-section-label">Platform</span>
            <h2>Tek portal, çoklu uygulama mimarisi</h2>
          </div>
          <div className="unified-login-platform-grid">
            <article>
              <strong>EVREN360</strong>
              <span>Super Admin yönetim merkezi</span>
            </article>
            <article>
              <strong>İşletme Çalışma Alanı</strong>
              <span>Modül tabanlı işletme çalışma alanı</span>
            </article>
            <article>
              <strong>Başvuru Merkezi</strong>
              <span>Yeni işletme kabul noktası</span>
            </article>
          </div>
        </section>

        <section className="unified-login-section" id="updates">
          <div className="unified-login-section-heading">
            <span className="unified-login-section-label">Son Güncellemeler</span>
            <h2>Platform yenilikleri</h2>
          </div>
          <div className="unified-login-card-grid">
            {portalUpdates.map(update => (
              <article className="unified-login-card" key={update.title}>
                <span>{update.type}</span>
                <h3>{update.title}</h3>
                <p>{update.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/*
          ⚠️ 25.10.2026 · "SİSTEM DUYURULARI" BÖLÜMÜ KALDIRILDI (MIYOP-059).
          Burada iki duyuru görünüyordu: *"Planlı bakım bildirimi — Pazar
          gecesi kısa süreli bakım penceresi uygulanacaktır"* ve *"Lisans
          yenileme hatırlatması"*. İKİSİ DE UYDURMAYDI: kayıt yokken
          `createDemoAnnouncements()` üretiyordu ve tarihler her açılışta
          yeniden hesaplanıyordu. Yani müşterinin gördüğü ilk ekranda,
          bizim vermediğimiz bir bakım taahhüdü duruyordu.

          Bölümü tamamen kaldırmamın sebebi: duyuru yazma ekranı
          (`system-notifications`) DONMUŞ ve duyurular yalnız tarayıcı
          hafızasına yazılıyor — yani Emrah bir duyuru yazsa bile hiçbir
          müşteriye ULAŞMAZDI. Üretici silinse bölüm kalıcı olarak boş
          kalırdı; boş bir bölüm de "burada bir şey olacak" demektir.

          ⚠️ Geri gelmesi için gereken: duyuruların sunucuda durduğu bir
          tablo + yayınlama akışı. → docs/kararlar/kaldirilan-moduller.md
        */}

        <section className="unified-login-section" id="why-miyop">
          <div className="unified-login-section-heading">
            <span className="unified-login-section-label">Neden MIYOP?</span>
            <h2>Platformun güçlü tarafları</h2>
          </div>
          <div className="unified-login-why-grid">
            {whyItems.map(item => (
              <article className="unified-login-why-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="unified-login-footer">
        <strong>MIYOP</strong>
        <span>EVREN360 ve işletme çalışma alanı için birleşik platform giriş deneyimi.</span>
      </footer>
    </div>
  )
}
