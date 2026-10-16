# İzin kapıları doğrulaması — 13 Ekim 2026

Proje: `C:\Users\90544\Documents\restaurant-adisyon`  
Dal: `production-foundation`  
Temel rapor: `docs/menu-ekran-izin-denetimi-2026-10-12.md` (bulgu 1 ve 6).

**Sonuç:** Rota eşlemesinde yeni bir korumasız iş rotası bulunmadı; iki rota bilinçli olarak açık. Ancak eksik izin listesi 50 izinli rotayı hâlâ geçiriyor. Bulgu 6’daki altı personel ve üç eski lojistik ekranında yazma kapıları eksik. `normalizeUser` düzelmiş; mevcut kullanıcı kaydını yeniden kurarken yetki alanlarını kaybettiren başka bir yer hâlâ var.

## Kapsam ve yöntem

Önce belirtilen dört dosyanın güncel gövdeleri/değişiklikleri ve önceki rapor okundu. İnceleme mevcut çalışma ağacı üzerinde yapıldı; kullanıcıya ait değişiklikler korunmuştur. Kaynak, test, yapılandırma, veritabanı, çalışan oturum ve localStorage değiştirilmedi. Yalnız istenen bu Markdown raporu yazıldı.

- TypeScript AST ile hosttaki **136 rota dalı** ve `src/pages/` altındaki **169 TSX ekranı** çıkarıldı. Tam envanterler Ek A ve B’de.
- `User` yeniden kurulumları için testler hariç `src` altında **753 dosya ve 9.104 nesne literal’i**, TypeScript AST/typechecker ve çağrı akışlarıyla tarandı.
- Gerçek registry ve rota izin fonksiyonları bellekte yürütüldü. Host JSX çocukları stub’lanarak rol/izin render sonuçları doğrulandı. Bu, sayfaların tamamını tarayıcıda çalıştıran bir test değildir.
- `normalizeUser` ve `syncSystemUser` gerçek gövdeleri bellekte yürütüldü; depolama yalnız bellek mock’larıyla temsil edildi. Test/kaynak dosyası oluşturulmadı.
- Canlı Supabase/RLS politikaları veya bir işletmenin gerçek oturumu sınanmadı. Aşağıdaki UI açılımları, sunucunun yetkisiz yazmayı kabul ettiğinin kanıtı olarak değerlendirilmemiştir.

Bugünkü değişiklikler doğrulandı: menü izni `src/navigation/workspace-navigation.registry.ts:96` üzerinden hesaplanıyor; `adminOnly` dönen düğüme artık aktarılmıyor (`src/navigation/workspace-navigation.registry.ts:124`, `src/navigation/workspace-navigation.registry.ts:157`). Hosttaki genel Admin engeli kaldırılmış; kalan yönetici muafları `src/modules/BusinessWorkspaceRouteHost.tsx:254` ve `src/modules/BusinessWorkspaceRouteHost.tsx:257` ile uygulanıyor. Beş daraltılmış izin de gerçek eşlemede bulundu: reçete `recipe.read` (`src/modules/business-workspace.registry.ts:2045`), müşteri `operations.read` (`:2074`), sipariş `operations.read` (`:2079`), sevkiyat `logistics.read` (`:2087`), şube yetkilendirme `branch.manage` (`:2624`).

## 1. Her render rotası korunuyor mu?

**Yüklü izin listesiyle:** 50 iş rotasının tamamı izin eşlemesiyle korunuyor; üç yönetim muafı Admin koşuluyla korunuyor. Eşlemesiz ve muaf listesinde bulunmayan aktif iş rotası **yok**. Sorudaki iki korumadan hiçbirini istemeyen rotalar, bilinçli açık `workspace-welcome` ve `my-profile` rotalarıdır. Ayrıca 81 dal dondurulmuş olduğu için hiç render edilmiyor.

| Sınıf | Sayı | Uygulanan kural ve kanıt |
| --- | ---: | --- |
| Dondurulmuş | 81 | Her render dalından önce `src/modules/BusinessWorkspaceRouteHost.tsx:232` reddeder. Core rota listesi `src/modules/business-workspace.registry.ts:2783`; muaflar da listeye eklenir (`:2803`). |
| İzin eşlemeli aktif iş rotası | 50 | Ortak kontrol `src/modules/BusinessWorkspaceRouteHost.tsx:239`. Registry’deki `item.requiredPermission ?? module.permissions[0]` eşlemesi `src/authorization/route-permission.ts:63`; geçerli izinlerden herhangi birinin bulunması `:132`. Her rota/izin kaynağı Ek A’da. |
| Admin isteyen muaf | 3 | `marketplace`, `integration-center`, `company-profile`: `src/modules/BusinessWorkspaceRouteHost.tsx:254`, `:255`, `:257`. Render dalları `:335`, `:343`, `:506`. Alan izni aranmaz; eski `role === 'Admin'` aranır (`:241`). |
| Bilerek açık muaf | 2 | `workspace-welcome` (`src/modules/BusinessWorkspaceRouteHost.tsx:259`) ve `my-profile` (`:507`). Yönetici kümesinin dışında bırakılmıştır (`:251`); `NON_NAV_CORE_ROUTES` içinde (`src/modules/business-workspace.registry.ts:2764`), izin kontrolünden muaf (`src/authorization/route-permission.ts:89`, `:117`). |

**Eksik izin listesiyle bütün rotalar izin açısından korunmuş sayılmaz.** `src/authorization/route-permission.ts:116`, `permissions === undefined || permissions === null` için koşulsuz `true` döndürür. Böylece Ek A’daki 50 izinli aktif rotanın **tamamı**, Personel rolündeki eksik izinli oturum için host kapısını geçer. Bu durum sayfa içi veri/yazma kontrolleriyle ayrıca sınırlandırılabilir; host katmanında ret yoktur. İzin eşlemesi bulunmadığında da `:126` erişime izin verir; güncel aktif rotalarda bu son yola düşen beklenmedik rota bulunmadı.

Bellek doğrulaması:

| Kullanıcı durumu | Hostta render elemanı üreten dallar |
| --- | --- |
| Personel + `[]` | Yalnız karşılama ve kendi profili: 2 |
| Admin + `[]` | Bu ikisi ve üç Admin muafı: 5 |
| Personel + `undefined/null` | 50 izinli rota ve iki açık muaf: 52 |
| Personel + alakasız tek izin | İlgili 50 rota ayrı ayrı reddedildi |
| Personel + rotanın eşlemesindeki izin | 50 rotanın tamamı ayrı ayrı kabul edildi |
| Her rol/izin durumu + dondurulmuş rota | 81 dalın tamamı reddedildi |

Dolayısıyla genel Admin engelinin kalkması izinli Personel’in boş ekran sorununu gideriyor; **ekran içi yazma izinlerini kendiliğinden düzeltmiyor** (`src/modules/BusinessWorkspaceRouteHost.tsx:485`, `:403`).

## 2. Ekran içinde izinsiz veri veya düzenleme düğmesi kaldı mı?

**Evet. Bulgu 6 kapanmadı.** Yalnız `personnel.read` olan Personel, aşağıdaki altı ekranın rota kapısını geçer (`src/modules/business-workspace.registry.ts:2498`, `:2564`). Sayfalarda `personnel.manage` kontrolü olmadan ekleme/değiştirme/silme düğmeleri ve yerel kayıt yazımı vardır. Aynı durum `logistics.read` ile açılan üç eski lojistik ekranında `logistics.write` için geçerlidir (`src/modules/business-workspace.registry.ts:2130`, `:2292`, `:2294`, `:2297`).

| Ekran | İzinsiz açılan işlem/UI kanıtı | Handler / kalıcı kayıt kanıtı |
| --- | --- | --- |
| Personel kartları | Düzenle/sil: `src/pages/EmployeeCards.tsx:317`, `:321` | Kaydet `:120`, sil `:214`, `saveEmployees` `:84` |
| Vardiya | Düzenle/durum/sil: `src/pages/ShiftManagement.tsx:369`, `:382`, `:386` | Kaydet `:168`, durum `:253`, sil `:272`, `saveShifts` `:142` |
| Puantaj | Düzenle/sil: `src/pages/AttendanceTracking.tsx:415`, `:416` | Kaydet `:203`, sil `:300`, `saveAttendances` `:173` |
| Personel performansı | Düzenle/sil: `src/pages/EmployeePerformanceTracking.tsx:317`, `:318` | Kaydet `:128`, sil `:210`, kayıt `:96` |
| Prim | Durum/düzenle/sil: `src/pages/EmployeeBonusSystem.tsx:404`, `:412`, `:416` | Kaydet `:178`, durum `:247`, sil `:272`, kayıt `:142` |
| Disiplin | Düzenle/sil: `src/pages/EmployeeAuditRecords.tsx:332`, `:333` | Kaydet `:132`, sil `:203`, kayıt `:95` |
| Sevkiyat operasyonu | Oluşturma `src/pages/ShipmentExecutions.tsx:464`; sevk/teslim/iptal `:603`, `:609`, `:618` | Oluşturma `:314`, sevk `:350`, teslim `:372`; executions/shipments/lots yazımı `:262`, `:267`, `:272` |
| İrsaliye süreci | Yeni `src/pages/ShipmentWaybills.tsx:650`, düzenle `:1009`, durum `:1017` | Form/kayıt `:582`, `:608`; durum `:616`, `:638`; depolama `:460` |
| İrsaliyeler | Oluştur `src/pages/DeliveryNotes.tsx:230`, durum düğmeleri `:375`, `:378` | Oluştur `:161`, `:168`; durum `:176`, `:179`; yerel depolama `src/delivery-notes/delivery-note.service.ts:607`, `:695`, `:729` |

Bu dokuz sayfanın tamamında `currentUser.permissions` ile yazma kapısı yoktur; işlem/veri doğrulamaları yetki kontrolü değildir. Eski modeldeki kayıtlar mock/localStorage kaynaklıdır; bu bulgu canlı Supabase yazma kabulü iddiası değildir. Tam sayfa envanterinde bu dokuz ekran ayrıca işaretlenmiştir.

### Diğer aktif ekranlarda kalan veri ve eylem sorunları

| Yer | Kalan sorun ve kanıt |
| --- | --- |
| Şube yönetimi | Rota `branch.read VEYA company.manage` kabul ediyor (Ek A). `branch.manage` kontrolü olmadan yerel yazma: `src/pages/BranchManagement.tsx:188`, `:132`; düzenle/durum/merkez/arşiv düğmeleri `:418`, `:420`, `:429`, `:435`. Şube yetkilendirme rotası ise bugün `branch.manage` ile daraltılmış; yalnız `branch.read` ile artık açılmaz (`src/modules/business-workspace.registry.ts:2624`). |
| Şirket profili | Yalnız `role === 'Admin'` (`src/pages/CompanyProfile.tsx:69`). `company.manage` izni olmayan Admin için submit `:95`, kayıt `:110`, Kaydet düğmesi `:277` açıktır. Host da yalnız Admin arar (`src/modules/BusinessWorkspaceRouteHost.tsx:257`); yerel şirket yazımı `src/companies/branch-directory.service.ts:125`, `:132`. |
| Stok / fire / iş emirleri | `finance.read` ayrımı olmadan parasal veri: `src/pages/Warehouse.tsx:694`, `:702`, `:706`, `:713`; `src/pages/ZayiImha.tsx:321`, `:335`, `:362`; `src/pages/WorkOrders.tsx:655`, `:660`, `:663`. Rota izinleri sırasıyla `stock.read`, `stock.read`, `production.read` (Ek A). |
| Personel takibi | `personnel.read` ile gelir/indirim/ikram tutarları açılır; finans süzmesi yok: `src/pages/StaffTracking.tsx:186`, `:187`, `:188`. |
| 17 eski rapor/karar ekranı | `dashboard.read` devralır (`src/modules/business-workspace.registry.ts:1225`, `:1369`) ve sayfa içinde alan/finans/personel izniyle içerik süzmez. Örnekler: maliyet `src/pages/CostAnalytics.tsx:992`; optimize maliyet `src/pages/CostOptimization.tsx:496`; tedarikçi fiyatı `src/pages/PurchaseRecommendations.tsx:743`; personel/sicil/fazla mesai/devamsızlık `src/pages/PersonnelPerformanceAnalytics.tsx:1240`, `:1250`. Tam 17 rota Ek A’da `dashboard.read` satırlarında bulunur (genel `summary` hariç). Bunlar eski mock/yerel/IndexedDB içeriktir; canlı veritabanı sızıntısı kanıtlanmadı. |
| Reçeteler | Menü bugün `recipe.read`, yazma hâlâ `production.write`: `src/pages/ProductionRecipes.tsx:52`; Yeni Reçete `:198`, `:201`. `recipe.write` olmadan düğme açılabilir. |
| HACCP | `quality.write VEYA stock.write` yazma kapısı: `src/pages/Haccp.tsx:77`, `:79`; ölçüm formu `:463`, `:474`; faaliyet kapatma `:337`, `:339`. Yalnız stok yazma, kalite eylemini açabilir. |
| Gerçek sevkiyat | Yazma kapısı `logistics.write` yerine `stock.write`: `src/pages/Sevkiyatlar.tsx:91`; yeni `:387`, düzenleme `:928`, durum `:933`. |
| Etiket/beyan | `quality.declaration` yerine `quality.write VEYA products.write`: `src/pages/Etiketler.tsx:64`, `:65`, `:66`; beyan Kaydet `:345`, `:347`; besin Kaydet `:388`, `:390`. UI yanlış eylemi açar; sunucunun bu eylemi kabul ettiği sonucuna varılmadı. |
| Veri ve yedekleme | Dışa aktarma yetkilisi için `audit.read` hâlâ kabul edilir: `src/pages/VeriYedegi.tsx:54`, `:57`. Denetim okuma izni, bu sayfada dışa aktarma eylemini de açar; önceki rapordaki kapsam ayrımı giderilmemiştir. |
| Eksik izin listesi | Örneğin `src/pages/ProductionRecipes.tsx:52`, `src/pages/Sevkiyatlar.tsx:91`, `src/pages/Warehouse.tsx:271` doğrudan `!currentUser.permissions` ile yazmaya izin verir. Hostun eksik listeyi geçirmesiyle birleşince bu ekran içi kapılar da varsayılan ret sağlamaz. |

### Eski rol kontrolleri ve kapısız sayfaların kapsamı

169 ekranın taranması şu sonucu verdi. “Sayfa içi kapı yok” tek başına erişim açığı demek değildir; host veya `App` kapısı ve ekranın gösterdiği işlem ayrıca değerlendirilmiştir.

| Kapsam | İzin koşulu | Yalnız rol koşulu | Sayfa içi yetki kapısı yok | Toplam |
| --- | ---: | ---: | ---: | ---: |
| Aktif host ekranı | 17 | 2 | 36 | 55 |
| Dondurulmuş host ekranı | 0 | 5 | 76 | 81 |
| Bu hostta render edilmeyen ekran | 1 | 0 | 32 | 33 |
| Toplam | 18 | 7 | 144 | 169 |

- Aktif eski rol kapıları: `CompanyProfile` yukarıdaki yazma sorununu taşır; `Settings` ise ters yönde daraltır. `settings.manage` verilmiş Personel hosttan geçse de `src/pages/Settings.tsx:57`, `:61`, `:62` yüzünden reddedilir. Bu, yetkisiz yazma açığı değil, izinli kullanıcıyı engelleyen uyumsuzluktur.
- Dondurulmuş eski rol kapıları: `src/pages/Products.tsx:42`, `src/pages/StockCards.tsx:192`, `src/pages/StockMovements.tsx:107`, `src/pages/TableManagement.tsx:204`; ayrıca `src/pages/QROrders.tsx:332` mevcut iki rolü de kabul eder. Bu beş ekran host `src/modules/BusinessWorkspaceRouteHost.tsx:232` nedeniyle bugün render olmaz.
- `src/pages/UserProfile.tsx:131`, `:211` ve `src/pages/DailySummary.tsx:616` içindeki Admin karşılaştırmaları rol etiketi üretir; bir erişim kapısı değildir. `src/pages/KullanicilarVeYetkiler.tsx:249` rol gruplama varsayılanıdır; gerçek kapı `:207` üzerindedir.
- Aktif 36 kapısız sayfanın tümü Ek B’de listelenmiştir. Kendi profilini düzenleme, `src/pages/UserProfile.tsx:92`, `:99`, `:107` ile kendi kimlikli kayda yönelir. Karşılama bilinçli açıktır; marketplace/entegrasyon host Admin kapısı arkasındadır. Bu ekranların kapısızlığı yukarıdaki dokuz yazma açığıyla aynı şekilde değerlendirilmemiştir.
- Host dışı 32 kapısız sayfa da Ek B’de açıkça ayrılmıştır. Örneğin `UserSubscriptionManagement` üst katmanda Admin ve platform yöneticisi ister (`src/App.tsx:980`, `:981`). `DailySummary` hostta artık kullanılmaz (`src/modules/BusinessWorkspaceRouteHost.tsx:280`); `kpi-dashboard` eski `KPIDashboard` yerine `Analiz` render eder (`:437`).
- Ek kapı uyumsuzluğu: rota `quality.read` ile açılan izlenebilirlik, sayfada `stock.read` ister (`src/pages/Traceability.tsx:94`, `:210`). Bu da izinli kişiye veri açılmasını engeller; yetkisiz veri açılması bulgusu değildir.

## 3. Başka bir User kopyalama yeri yetki alanlarını düşürüyor mu?

**Evet: mevcut `User` kaydını değiştirirken alan kaybettiren bir yeniden kurulum bulundu: `src/pages/UserSubscriptionManagement.tsx:275` içindeki `syncSystemUser`.**

`src/pages/UserSubscriptionManagement.tsx:277` mevcut sistem kullanıcısını bulur. `:278` üzerindeki `nextUser: User` nesnesi yalnız `id`, `companyId`, `fullName`, `username`, `password`, `role`, `active` alanlarını kurar. Eski kayıttan yalnız parola alınır (`:283`); `permissions` ve `roleCode` aktarılmaz. `:288`, `:289` aynı kimlikli mevcut kaydı bu nesneyle değiştirerek `saveUsers` çağırır.

Çağıran yollar: kullanıcı kaydetme `src/pages/UserSubscriptionManagement.tsx:364`, durum değiştirme `:380`, parola sıfırlama `:408`. Normal ekran girişi Admin/platform yöneticisi kapılıdır (`src/App.tsx:980`, `:981`); sıradan Personel’in bu ekranı açabildiği ileri sürülmemektedir.

Kayıp **yerel kullanıcı listesine (`ra_users`)** yazılır; bu fonksiyon **canlı `ra_auth` oturumunu doğrudan değiştirmez**. Yetki alanlarına ek olarak mevcut `mustChangePassword`, `email`, `phone`, `profilePhotoUrl`, `tenantId` de bu kopyadan aktarılmaz. `saveUsers` içindeki yeni normalleştirici artık kaybolmuş alanları geri üretemez (`src/storage.ts:4318`, `:4300`, `:4303`, `:4304`).

Bellek doğrulamasında izinli mevcut kullanıcı, `normalizeUser` sonrasında aynı izin/rol kodunu korudu; `syncSystemUser` ve kayıt normalleştirmesi sonrasında `permissions` ve `roleCode` `undefined`, `mustChangePassword` `false` oldu. Bu kanıt canlı kayıtları değiştirmeden elde edildi.

### Taranan User üretme/kopyalama noktaları

| Yer | Sonuç |
| --- | --- |
| `src/storage.ts:4285` | `normalizeUser` artık `roleCode` (`:4300`), `permissions` (`:4303`), `email` (`:4293`), `mustChangePassword` (`:4304`) korur. İzin dizisi kopyalanır; `[]` boş kalır, eksik alan eksik kalır. |
| `src/pages/UserSubscriptionManagement.tsx:278` | **Mevcut User değiştirilirken permissions/roleCode düşüren yeniden kurulum.** |
| `src/storage.ts:5218` | DB satırından yeni giriş kullanıcısıdır; mevcut User kopyası değildir. `roleCode` `:5236` ile korunur. İzinler `src/auth/authentication.service.ts:98` ile yüklenip `:109` üzerinden spread ile eklenir; sorgu başarısızsa giriş reddedilir (`:104`). |
| `src/storage.ts:5951` | Eski kurulum akışında yeni Admin nesnesi; kimlik `:5892` üretilir. İzin/rol kodu başlangıçtan verilmemiştir; mevcut User’dan alan düşürme değildir. |
| `src/storage.ts:6409` | Eski başvuru akışında yeni owner nesnesi; kimlik `:6332` üretilir. İzin/rol kodu başlangıçtan verilmemiştir. |
| `src/storage.ts:6066` | Başvuru işlemindeki sentetik aktör; mevcut oturumun kopyası değildir. |
| `src/pages/QRMenu.tsx:31` | Sentetik QR müşteri aktörü; mevcut oturum kopyası değildir. |
| `src/onboarding/onboarding.service.ts:330` | `...state.currentUser` tüm yetki alanlarını korur. Yerel liste yazımı `:389`, oturum yazımı `:428`. |
| `src/pages/UserProfile.tsx:99` | `...users[index]` kaynak cache kaydının alanlarını korur. Cache’te eksik olan alanları mevcut oturumdan tamamlamaz. `:111` callback isteğe bağlıdır; host `src/modules/BusinessWorkspaceRouteHost.tsx:507` callback vermez. Burada doğrudan React oturum kaybı kanıtlanmadı. |
| `src/pages/SaasManagementCenter.tsx:428` | `...user` ile tenant/şirket eklenir; yetki alanları korunur. |
| `src/auth/authentication.service.ts:109` | `...user` ve yüklenen izinler; rol kodu korunur. |
| `src/storage.ts:5154`, `:5160` | Oturum tam nesne olarak JSON’a yazılıp okunur; alan projeksiyonu yoktur. |
| `src/storage.ts:5249`, `:5257` | `updateUser` / `addUser` verilen nesneyi doğrudan listeye kaydeder; kendisi alan alan daraltmaz. |

Şu alan alan kopyalar `User` kaydını yeniden kurmaz: profil form modeli (`src/pages/UserProfile.tsx:28`), şirket kullanıcı form modeli (`src/pages/UserSubscriptionManagement.tsx:112`), ayrı `CompanyUser` kurulumu (`:346`), `CompanyUser` normalleştirmesi (`src/storage.ts:3027`), SaaS `CompanyUser` kaydı (`src/pages/SaasManagementCenter.tsx:486`). Yönetim modeli `TenantUser` DB’den üretilir (`src/authorization/role-assignment.repository.ts:169`) ve rol kodu `primaryRoleCode` adıyla korunur (`:173`). `Pick<User,...>` kullanımı (`src/storage.ts:440`) yalnız TypeScript okuma tipidir; JSON nesnesini çalışma anında alan alan daraltmaz.

### Bulgu 1’in kapanma durumu

**Normalleştiricideki kayıp giderilmiş, bulgu 1’in bütün akışları kapanmamıştır.**

Geçerli oturumla normal yeni onboarding zinciri artık yetki alanlarını korur: `src/onboarding/onboarding.service.ts:331` spread’i, `:389` liste yazımı, `:428` oturum yazımı; düzeltilmiş `src/storage.ts:4300`, `:4303`; ardından `src/App.tsx:718`, `:723` yenilemesi. Bellek örneğinde `permissions=['quality.read']` ile `depo` erişimi normalleştirmeden önce ve sonra **false** kaldı; önceki rapordaki normalleştirme kaynaklı izin açılması bu gövdede tekrarlanmadı.

Ancak eski/önceden alan kaybetmiş oturum `src/storage.ts:5160` ve `src/auth/authentication.service.ts:48`, `:51` üzerinden izinler sunucudan yenilenmeden geri yüklenir. Eksik izin listesini `normalizeUser` tamamlamaz (`src/storage.ts:4303`); rota kontrolü bunu geçirir (`src/authorization/route-permission.ts:116`), menü süzgeci de verilmez (`src/App.tsx:227`, `:229`). Yeni giriş izinleri yeniden doldurur (`src/auth/authentication.service.ts:98`, `:109`, `:112`).

Ayrıca `src/App.tsx:717`, `:718`, `:723` yerel listede bulduğu kullanıcıyı mevcut React kullanıcısıyla alan birleştirmeden yerine alır. Normal wizard servisi listeyi önce geçerli oturum spread’iyle güncellediğinden bu normal yeni zincirde ayrı bir kayıp kanıtlanmadı; eksik eski/cache kayıtların varlığı otomatik olarak onarılmıyor.

## Ek A — Hosttaki 136 rota dalının tamamı

İzinli satırların ortak kapısı `src/modules/BusinessWorkspaceRouteHost.tsx:239`; izin hesaplama kuralı `src/authorization/route-permission.ts:63` ve `:132`. Her satırda render dalı, izinli satırlarda ayrıca izin kaynağı gösterilmiştir. “Dondurulmuş” satırları :232’de kapanır; iki açık muaf izin/rol istemez. `undefined/null` istisnası 50 izinli satırın tümüne uygulanır (`src/authorization/route-permission.ts:116`).

| Rota | Durum / kapı | Kanıt |
| --- | --- | --- |
| `workspace-welcome` | Bilerek açık; izin ve Admin şartı yok | `src/modules/BusinessWorkspaceRouteHost.tsx:259` |
| `tables` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:269` |
| `products` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:278` |
| `summary` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:279`; `src/modules/business-workspace.registry.ts:268` |
| `history` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:294` |
| `kitchen` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:295` |
| `qr-orders` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:297` |
| `marketplace` | Muaf; host :257’de `Admin` aranır | `src/modules/BusinessWorkspaceRouteHost.tsx:335` |
| `integration-center` | Muaf; host :257’de `Admin` aranır | `src/modules/BusinessWorkspaceRouteHost.tsx:343` |
| `excel-center` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:344` |
| `notifications` | `company.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:345`; `src/modules/business-workspace.registry.ts:538` |
| `depo` | `stock.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:347`; `src/modules/business-workspace.registry.ts:854` |
| `tedarikciler` | `purchase.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:348`; `src/modules/business-workspace.registry.ts:1102` |
| `musteriler` | `operations.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:349`; `src/modules/business-workspace.registry.ts:2074` |
| `siparisler` | `operations.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:350`; `src/modules/business-workspace.registry.ts:2079` |
| `etiketler` | `quality.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:351`; `src/modules/business-workspace.registry.ts:2061` |
| `satinalma` | `purchase.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:352`; `src/modules/business-workspace.registry.ts:1102` |
| `receteler` | `recipe.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:356`; `src/modules/business-workspace.registry.ts:2045` |
| `uretim-emirleri` | `production.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:359`; `src/modules/business-workspace.registry.ts:1799` |
| `izlenebilirlik` | `quality.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:361`; `src/modules/business-workspace.registry.ts:1770` |
| `sevkiyatlar` | `logistics.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:365`; `src/modules/business-workspace.registry.ts:2087` |
| `haccp-kayitlari` | `quality.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:368`; `src/modules/business-workspace.registry.ts:1769` |
| `sayimlar` | `stock.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:369`; `src/modules/business-workspace.registry.ts:854` |
| `zayi-imha` | `stock.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:370`; `src/modules/business-workspace.registry.ts:854` |
| `islem-gecmisi` | `audit.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:371`; `src/modules/business-workspace.registry.ts:667` |
| `veri-yedegi` | `audit.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:372`; `src/modules/business-workspace.registry.ts:664` |
| `stock-cards` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:374` |
| `stock-movements` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:383` |
| `inventory-lots` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:392` |
| `chemical-products` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:393` |
| `shipment-work-orders` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:394` |
| `shipment-pallets` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:395` |
| `shipment-vehicles` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:396` |
| `shipment-plans` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:397` |
| `shipment-forms` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:398` |
| `delivery-notes` | `logistics.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:399`; `src/modules/business-workspace.registry.ts:2130` |
| `shipment-returns` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:400` |
| `shipment-waybills` | `logistics.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:401`; `src/modules/business-workspace.registry.ts:2130` |
| `shipments` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:402` |
| `shipment-executions` | `logistics.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:403`; `src/modules/business-workspace.registry.ts:2130` |
| `transfer-receipts` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:404` |
| `production-work-orders` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:405` |
| `production-planning` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:406` |
| `capacity-planning` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:407` |
| `machine-scheduling` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:408` |
| `workforce-planning` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:409` |
| `bottleneck-analysis` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:410` |
| `continuous-improvement` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:411` |
| `production-lines` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:412` |
| `intermediate-products` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:413` |
| `final-products` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:414` |
| `blast-chiller-processes` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:415` |
| `packaging-processes` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:416` |
| `labeling-processes` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:417` |
| `dispatch-processes` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:418` |
| `recipes` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:419` |
| `fire-analysis` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:420` |
| `cost-engine` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:421` |
| `purchase-requests` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:422` |
| `request-for-quotations` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:423` |
| `purchase-approvals` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:424` |
| `purchase-orders` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:425` |
| `goods-receipts` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:426` |
| `supplier-performances` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:427` |
| `procurement-analytics` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:428` |
| `kpi-dashboard` | `finance.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:437`; `src/modules/business-workspace.registry.ts:309` |
| `daily-production-analytics` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:438`; `src/modules/business-workspace.registry.ts:1225` |
| `weekly-production-analytics` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:439`; `src/modules/business-workspace.registry.ts:1225` |
| `shipment-analytics` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:440`; `src/modules/business-workspace.registry.ts:1225` |
| `waste-analytics` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:441`; `src/modules/business-workspace.registry.ts:1225` |
| `cost-analytics` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:442`; `src/modules/business-workspace.registry.ts:1225` |
| `warehouse-performance-analytics` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:443`; `src/modules/business-workspace.registry.ts:1225` |
| `personnel-performance-analytics` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:444`; `src/modules/business-workspace.registry.ts:1225` |
| `decision-support` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:445`; `src/modules/business-workspace.registry.ts:1369` |
| `critical-alerts` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:446`; `src/modules/business-workspace.registry.ts:1369` |
| `forecasting` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:447`; `src/modules/business-workspace.registry.ts:1369` |
| `recommendation-engine` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:448`; `src/modules/business-workspace.registry.ts:1369` |
| `ai-analysis` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:449`; `src/modules/business-workspace.registry.ts:1369` |
| `cost-optimization` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:450`; `src/modules/business-workspace.registry.ts:1369` |
| `purchase-recommendations` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:451`; `src/modules/business-workspace.registry.ts:1369` |
| `production-planning-recommendations` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:452`; `src/modules/business-workspace.registry.ts:1369` |
| `waste-predictions` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:453`; `src/modules/business-workspace.registry.ts:1369` |
| `shipment-optimization` | `dashboard.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:454`; `src/modules/business-workspace.registry.ts:1369` |
| `label-management` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:455` |
| `operation-checklists` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:456` |
| `lot-system` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:457` |
| `sample-tracking` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:458` |
| `witness-samples` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:459` |
| `product-recalls` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:460` |
| `product-history` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:461` |
| `haccp-management` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:462` |
| `quality-controls` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:463` |
| `quality-control-forms` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:464` |
| `waste-management` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:465` |
| `return-processes` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:466` |
| `supplier-returns` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:467` |
| `suppliers` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:468` |
| `supplier-debts` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:469` |
| `supplier-payments` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:470` |
| `cash-transactions` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:471` |
| `income-expense` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:472` |
| `cash-closing` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:473` |
| `financial-reports` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:474` |
| `cash-transfers` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:475` |
| `business-summary` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:476` |
| `sales-revenue-analysis` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:477` |
| `product-performance-analysis` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:478` |
| `stock-risk-center` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:479` |
| `current-finance-center` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:480` |
| `personnel-performance-center` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:481` |
| `manager-alert-center` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:482` |
| `qr-codes` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:483` |
| `actions` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:484` |
| `employee-cards` | `personnel.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:485`; `src/modules/business-workspace.registry.ts:2498` |
| `shift-management` | `personnel.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:486`; `src/modules/business-workspace.registry.ts:2498` |
| `attendance-tracking` | `personnel.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:487`; `src/modules/business-workspace.registry.ts:2498` |
| `employee-performance` | `personnel.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:488`; `src/modules/business-workspace.registry.ts:2498` |
| `employee-bonus` | `personnel.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:489`; `src/modules/business-workspace.registry.ts:2498` |
| `employee-audit` | `personnel.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:490`; `src/modules/business-workspace.registry.ts:2498` |
| `employee-reports` | `personnel.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:491`; `src/modules/business-workspace.registry.ts:2498` |
| `staff` | `personnel.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:492`; `src/modules/business-workspace.registry.ts:2498` |
| `current-report` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:493` |
| `risky-current` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:494` |
| `branches` | `company.manage` **VEYA** `branch.read` | `src/modules/BusinessWorkspaceRouteHost.tsx:495`; `src/modules/business-workspace.registry.ts:511`, `src/modules/business-workspace.registry.ts:2593` |
| `branch-permissions` | `branch.manage` | `src/modules/BusinessWorkspaceRouteHost.tsx:496`; `src/modules/business-workspace.registry.ts:2624` |
| `branch-reporting` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:497` |
| `branch-stock-transfers` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:498` |
| `head-office-management` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:499` |
| `users` | `users.manage` **VEYA** `roles.manage` | `src/modules/BusinessWorkspaceRouteHost.tsx:500`; `src/modules/business-workspace.registry.ts:461`, `src/modules/business-workspace.registry.ts:484` |
| `current-accounts` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:501` |
| `credit-transactions` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:502` |
| `collection-transactions` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:503` |
| `current-account-movements` | Dondurulmuş; host :232’de reddedilir | `src/modules/BusinessWorkspaceRouteHost.tsx:504` |
| `settings` | `settings.manage` | `src/modules/BusinessWorkspaceRouteHost.tsx:505`; `src/modules/business-workspace.registry.ts:643` |
| `company-profile` | Muaf; host :257’de `Admin` aranır | `src/modules/BusinessWorkspaceRouteHost.tsx:506` |
| `my-profile` | Bilerek açık; izin ve Admin şartı yok | `src/modules/BusinessWorkspaceRouteHost.tsx:507` |

## Ek B — src/pages altındaki 169 ekranın tamamı

“İzin koşulu” ekran açma, içerik veya işlem için en az bir izin koşulu bulunduğunu belirtir; bütün ekranı ya da bütün işlemleri doğru koruduğu anlamına gelmez. “Yalnız rol” eski Admin/Personel karşılaştırmasıyla işlem veya ekran kapısını belirtir. Rol etiketi ve formdaki rol seçimi kapı sayılmamıştır. Kapısız satırlarda kaynak konumu bileşenin başlangıcıdır; yokluk sonucu bileşenin tamamının AST/metin ve işlem akışı taramasına dayanır. Host dışı satırlar bu hostun render dallarında bulunmaz; bu sınıf üst katmanda başka bir kapının bulunmadığını iddia etmez.

| Sayfa kanıtı | Host kapsamı / rota | Sayfa içindeki kapı |
| --- | --- | --- |
| `src/pages/AIAnalysis.tsx:252` | Aktif · `ai-analysis` | Sayfa içi yetki kapısı yok |
| `src/pages/ActionHistory.tsx:207` | Dondurulmuş · `actions` | Sayfa içi yetki kapısı yok |
| `src/pages/Analiz.tsx:84` | Aktif · `kpi-dashboard` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/AnalyticsDashboard.tsx:272` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/AttendanceTracking.tsx:162` | Aktif · `attendance-tracking` | Sayfa içi yetki kapısı yok |
| `src/pages/BillHistory.tsx:45` | Dondurulmuş · `history` | Sayfa içi yetki kapısı yok |
| `src/pages/BillingManagement.tsx:82` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/BlastChillerProcesses.tsx:154` | Dondurulmuş · `blast-chiller-processes` | Sayfa içi yetki kapısı yok |
| `src/pages/BottleneckAnalysis.tsx:129` | Dondurulmuş · `bottleneck-analysis` | Sayfa içi yetki kapısı yok |
| `src/pages/BranchManagement.tsx:109` | Aktif · `branches` | Sayfa içi yetki kapısı yok |
| `src/pages/BranchPermissions.tsx:63` | Aktif · `branch-permissions` | Sayfa içi yetki kapısı yok |
| `src/pages/BranchReporting.tsx:247` | Dondurulmuş · `branch-reporting` | Sayfa içi yetki kapısı yok |
| `src/pages/BranchStockTransfers.tsx:111` | Dondurulmuş · `branch-stock-transfers` | Sayfa içi yetki kapısı yok |
| `src/pages/BusinessApplicationPublicForm.tsx:69` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/BusinessApplicationSystem.tsx:61` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/BusinessRegistrationSystem.tsx:92` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/BusinessSummary.tsx:1325` | Dondurulmuş · `business-summary` | Sayfa içi yetki kapısı yok |
| `src/pages/BusinessUsageStats.tsx:143` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/CapacityPlanning.tsx:127` | Dondurulmuş · `capacity-planning` | Sayfa içi yetki kapısı yok |
| `src/pages/CashClosing.tsx:99` | Dondurulmuş · `cash-closing` | Sayfa içi yetki kapısı yok |
| `src/pages/CashTransactions.tsx:130` | Dondurulmuş · `cash-transactions` | Sayfa içi yetki kapısı yok |
| `src/pages/CashTransfers.tsx:55` | Dondurulmuş · `cash-transfers` | Sayfa içi yetki kapısı yok |
| `src/pages/ChemicalProducts.tsx:197` | Dondurulmuş · `chemical-products` | Sayfa içi yetki kapısı yok |
| `src/pages/CollectionTransactions.tsx:57` | Dondurulmuş · `collection-transactions` | Sayfa içi yetki kapısı yok |
| `src/pages/CompanyManagement.tsx:155` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/CompanyProfile.tsx:69` | Aktif · `company-profile` | Yalnız eski rol koşulu |
| `src/pages/CompanySetupWizard.tsx:86` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/ContinuousImprovement.tsx:140` | Dondurulmuş · `continuous-improvement` | Sayfa içi yetki kapısı yok |
| `src/pages/CostAnalytics.tsx:1315` | Aktif · `cost-analytics` | Sayfa içi yetki kapısı yok |
| `src/pages/CostEngine.tsx:80` | Dondurulmuş · `cost-engine` | Sayfa içi yetki kapısı yok |
| `src/pages/CostOptimization.tsx:112` | Aktif · `cost-optimization` | Sayfa içi yetki kapısı yok |
| `src/pages/CreditTransactions.tsx:55` | Dondurulmuş · `credit-transactions` | Sayfa içi yetki kapısı yok |
| `src/pages/CriticalAlerts.tsx:105` | Aktif · `critical-alerts` | Sayfa içi yetki kapısı yok |
| `src/pages/CurrentAccountMovements.tsx:69` | Dondurulmuş · `current-account-movements` | Sayfa içi yetki kapısı yok |
| `src/pages/CurrentAccounts.tsx:73` | Dondurulmuş · `current-accounts` | Sayfa içi yetki kapısı yok |
| `src/pages/CurrentFinanceCenter.tsx:387` | Dondurulmuş · `current-finance-center` | Sayfa içi yetki kapısı yok |
| `src/pages/CurrentReport.tsx:97` | Dondurulmuş · `current-report` | Sayfa içi yetki kapısı yok |
| `src/pages/CustomerDetail.tsx:165` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/CustomerList.tsx:104` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/CustomerStatistics.tsx:142` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/DailyProductionAnalytics.tsx:1164` | Aktif · `daily-production-analytics` | Sayfa içi yetki kapısı yok |
| `src/pages/DailySummary.tsx:513` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/DecisionSupport.tsx:237` | Aktif · `decision-support` | Sayfa içi yetki kapısı yok |
| `src/pages/DeliveryNotes.tsx:113` | Aktif · `delivery-notes` | Sayfa içi yetki kapısı yok |
| `src/pages/DispatchProcesses.tsx:163` | Dondurulmuş · `dispatch-processes` | Sayfa içi yetki kapısı yok |
| `src/pages/EmployeeAuditRecords.tsx:84` | Aktif · `employee-audit` | Sayfa içi yetki kapısı yok |
| `src/pages/EmployeeBonusSystem.tsx:130` | Aktif · `employee-bonus` | Sayfa içi yetki kapısı yok |
| `src/pages/EmployeeCards.tsx:75` | Aktif · `employee-cards` | Sayfa içi yetki kapısı yok |
| `src/pages/EmployeePerformanceTracking.tsx:87` | Aktif · `employee-performance` | Sayfa içi yetki kapısı yok |
| `src/pages/EmployeeReports.tsx:185` | Aktif · `employee-reports` | Sayfa içi yetki kapısı yok |
| `src/pages/Etiketler.tsx:64` | Aktif · `etiketler` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/ExcelCenter.tsx:64` | Dondurulmuş · `excel-center` | Sayfa içi yetki kapısı yok |
| `src/pages/FinalProducts.tsx:126` | Dondurulmuş · `final-products` | Sayfa içi yetki kapısı yok |
| `src/pages/FinancialReports.tsx:210` | Dondurulmuş · `financial-reports` | Sayfa içi yetki kapısı yok |
| `src/pages/FireImpactAnalysis.tsx:67` | Dondurulmuş · `fire-analysis` | Sayfa içi yetki kapısı yok |
| `src/pages/FirstLoginWizard.tsx:181` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/Forecasting.tsx:115` | Aktif · `forecasting` | Sayfa içi yetki kapısı yok |
| `src/pages/GoodsReceipts.tsx:150` | Dondurulmuş · `goods-receipts` | Sayfa içi yetki kapısı yok |
| `src/pages/HACCPManagement.tsx:262` | Dondurulmuş · `haccp-management` | Sayfa içi yetki kapısı yok |
| `src/pages/Haccp.tsx:77` | Aktif · `haccp-kayitlari` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/HeadOfficeManagement.tsx:224` | Dondurulmuş · `head-office-management` | Sayfa içi yetki kapısı yok |
| `src/pages/IncomeExpenseManagement.tsx:63` | Dondurulmuş · `income-expense` | Sayfa içi yetki kapısı yok |
| `src/pages/IntegrationCenter.tsx:51` | Aktif · `integration-center` | Sayfa içi yetki kapısı yok |
| `src/pages/IntermediateProducts.tsx:125` | Dondurulmuş · `intermediate-products` | Sayfa içi yetki kapısı yok |
| `src/pages/InventoryLots.tsx:144` | Dondurulmuş · `inventory-lots` | Sayfa içi yetki kapısı yok |
| `src/pages/IslemGecmisi.tsx:49` | Aktif · `islem-gecmisi` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/KPIDashboard.tsx:372` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/Kitchen.tsx:119` | Dondurulmuş · `kitchen` | Sayfa içi yetki kapısı yok |
| `src/pages/KontrolPaneli.tsx:98` | Aktif · `summary` | Sayfa içi yetki kapısı yok |
| `src/pages/KullanicilarVeYetkiler.tsx:207` | Aktif · `users` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/LabelManagement.tsx:91` | Dondurulmuş · `label-management` | Sayfa içi yetki kapısı yok |
| `src/pages/LabelingProcesses.tsx:134` | Dondurulmuş · `labeling-processes` | Sayfa içi yetki kapısı yok |
| `src/pages/LisansYonetimi.tsx:47` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/Login.tsx:102` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/LotSystem.tsx:230` | Dondurulmuş · `lot-system` | Sayfa içi yetki kapısı yok |
| `src/pages/MachineScheduling.tsx:137` | Dondurulmuş · `machine-scheduling` | Sayfa içi yetki kapısı yok |
| `src/pages/ManagerAlertCenter.tsx:662` | Dondurulmuş · `manager-alert-center` | Sayfa içi yetki kapısı yok |
| `src/pages/ModuleActivationSystem.tsx:117` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/ModuleMarketplace.tsx:296` | Aktif · `marketplace` | Sayfa içi yetki kapısı yok |
| `src/pages/ModuleUsageAnalysis.tsx:150` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/Musteriler.tsx:86` | Aktif · `musteriler` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/NotificationCenter.tsx:81` | Aktif · `notifications` | Sayfa içi yetki kapısı yok |
| `src/pages/OperationChecklists.tsx:133` | Dondurulmuş · `operation-checklists` | Sayfa içi yetki kapısı yok |
| `src/pages/PackageLicenseManagement.tsx:235` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/PackagingProcesses.tsx:140` | Dondurulmuş · `packaging-processes` | Sayfa içi yetki kapısı yok |
| `src/pages/PendingApplications.tsx:188` | Host dışında | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/PersonnelPerformanceAnalytics.tsx:1091` | Aktif · `personnel-performance-analytics` | Sayfa içi yetki kapısı yok |
| `src/pages/PersonnelPerformanceCenter.tsx:328` | Dondurulmuş · `personnel-performance-center` | Sayfa içi yetki kapısı yok |
| `src/pages/Portal.tsx:65` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/ProcurementAnalytics.tsx:89` | Dondurulmuş · `procurement-analytics` | Sayfa içi yetki kapısı yok |
| `src/pages/ProductHistory.tsx:235` | Dondurulmuş · `product-history` | Sayfa içi yetki kapısı yok |
| `src/pages/ProductPerformanceAnalysis.tsx:415` | Dondurulmuş · `product-performance-analysis` | Sayfa içi yetki kapısı yok |
| `src/pages/ProductRecalls.tsx:638` | Dondurulmuş · `product-recalls` | Sayfa içi yetki kapısı yok |
| `src/pages/ProductionLines.tsx:105` | Dondurulmuş · `production-lines` | Sayfa içi yetki kapısı yok |
| `src/pages/ProductionPlanning.tsx:139` | Dondurulmuş · `production-planning` | Sayfa içi yetki kapısı yok |
| `src/pages/ProductionPlanningRecommendations.tsx:259` | Aktif · `production-planning-recommendations` | Sayfa içi yetki kapısı yok |
| `src/pages/ProductionRecipes.tsx:52` | Aktif · `receteler` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/ProductionWorkOrders.tsx:286` | Dondurulmuş · `production-work-orders` | Sayfa içi yetki kapısı yok |
| `src/pages/Products.tsx:42` | Dondurulmuş · `products` | Yalnız eski rol koşulu |
| `src/pages/PurchaseApprovals.tsx:188` | Dondurulmuş · `purchase-approvals` | Sayfa içi yetki kapısı yok |
| `src/pages/PurchaseFlow.tsx:111` | Aktif · `satinalma` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/PurchaseOrders.tsx:259` | Dondurulmuş · `purchase-orders` | Sayfa içi yetki kapısı yok |
| `src/pages/PurchaseRecommendations.tsx:236` | Aktif · `purchase-recommendations` | Sayfa içi yetki kapısı yok |
| `src/pages/PurchaseRequests.tsx:309` | Dondurulmuş · `purchase-requests` | Sayfa içi yetki kapısı yok |
| `src/pages/QRCodes.tsx:14` | Dondurulmuş · `qr-codes` | Sayfa içi yetki kapısı yok |
| `src/pages/QRMenu.tsx:44` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/QROrders.tsx:332` | Dondurulmuş · `qr-orders` | Yalnız eski rol koşulu |
| `src/pages/QualityControlForms.tsx:145` | Dondurulmuş · `quality-control-forms` | Sayfa içi yetki kapısı yok |
| `src/pages/QualityControls.tsx:256` | Dondurulmuş · `quality-controls` | Sayfa içi yetki kapısı yok |
| `src/pages/Recipes.tsx:719` | Dondurulmuş · `recipes` | Sayfa içi yetki kapısı yok |
| `src/pages/RecommendationEngine.tsx:115` | Aktif · `recommendation-engine` | Sayfa içi yetki kapısı yok |
| `src/pages/Reports.tsx:115` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/RequestForQuotations.tsx:352` | Dondurulmuş · `request-for-quotations` | Sayfa içi yetki kapısı yok |
| `src/pages/ReturnProcesses.tsx:281` | Dondurulmuş · `return-processes` | Sayfa içi yetki kapısı yok |
| `src/pages/RiskyCurrentAccounts.tsx:142` | Dondurulmuş · `risky-current` | Sayfa içi yetki kapısı yok |
| `src/pages/SaasManagementCenter.tsx:286` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/SalesRevenueAnalysis.tsx:428` | Dondurulmuş · `sales-revenue-analysis` | Sayfa içi yetki kapısı yok |
| `src/pages/SampleTracking.tsx:224` | Dondurulmuş · `sample-tracking` | Sayfa içi yetki kapısı yok |
| `src/pages/Sayimlar.tsx:62` | Aktif · `sayimlar` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/SectorManagementCenter.tsx:317` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/Settings.tsx:57` | Aktif · `settings` | Yalnız eski rol koşulu |
| `src/pages/Sevkiyatlar.tsx:91` | Aktif · `sevkiyatlar` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/ShiftManagement.tsx:131` | Aktif · `shift-management` | Sayfa içi yetki kapısı yok |
| `src/pages/ShipmentAnalytics.tsx:1229` | Aktif · `shipment-analytics` | Sayfa içi yetki kapısı yok |
| `src/pages/ShipmentExecutions.tsx:179` | Aktif · `shipment-executions` | Sayfa içi yetki kapısı yok |
| `src/pages/ShipmentForms.tsx:120` | Dondurulmuş · `shipment-forms` | Sayfa içi yetki kapısı yok |
| `src/pages/ShipmentOptimization.tsx:262` | Aktif · `shipment-optimization` | Sayfa içi yetki kapısı yok |
| `src/pages/ShipmentPallets.tsx:290` | Dondurulmuş · `shipment-pallets` | Sayfa içi yetki kapısı yok |
| `src/pages/ShipmentPlans.tsx:329` | Dondurulmuş · `shipment-plans` | Sayfa içi yetki kapısı yok |
| `src/pages/ShipmentReturns.tsx:385` | Dondurulmuş · `shipment-returns` | Sayfa içi yetki kapısı yok |
| `src/pages/ShipmentVehicles.tsx:263` | Dondurulmuş · `shipment-vehicles` | Sayfa içi yetki kapısı yok |
| `src/pages/ShipmentWaybills.tsx:378` | Aktif · `shipment-waybills` | Sayfa içi yetki kapısı yok |
| `src/pages/ShipmentWorkOrders.tsx:344` | Dondurulmuş · `shipment-work-orders` | Sayfa içi yetki kapısı yok |
| `src/pages/Shipments.tsx:297` | Dondurulmuş · `shipments` | Sayfa içi yetki kapısı yok |
| `src/pages/SifreBelirle.tsx:51` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/Siparisler.tsx:128` | Aktif · `siparisler` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/StaffTracking.tsx:71` | Aktif · `staff` | Sayfa içi yetki kapısı yok |
| `src/pages/StockCards.tsx:192` | Dondurulmuş · `stock-cards` | Yalnız eski rol koşulu |
| `src/pages/StockMovements.tsx:107` | Dondurulmuş · `stock-movements` | Yalnız eski rol koşulu |
| `src/pages/StockRiskCenter.tsx:400` | Dondurulmuş · `stock-risk-center` | Sayfa içi yetki kapısı yok |
| `src/pages/SupplierDebts.tsx:57` | Dondurulmuş · `supplier-debts` | Sayfa içi yetki kapısı yok |
| `src/pages/SupplierManagement.tsx:405` | Dondurulmuş · `suppliers` | Sayfa içi yetki kapısı yok |
| `src/pages/SupplierPayments.tsx:74` | Dondurulmuş · `supplier-payments` | Sayfa içi yetki kapısı yok |
| `src/pages/SupplierPerformances.tsx:148` | Dondurulmuş · `supplier-performances` | Sayfa içi yetki kapısı yok |
| `src/pages/SupplierReturns.tsx:254` | Dondurulmuş · `supplier-returns` | Sayfa içi yetki kapısı yok |
| `src/pages/Suppliers.tsx:49` | Aktif · `tedarikciler` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/SystemAnnouncements.tsx:103` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/SystemHealthTelemetry.tsx:243` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/SystemUsageLogs.tsx:131` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/TableManagement.tsx:204` | Dondurulmuş · `tables` | Yalnız eski rol koşulu |
| `src/pages/TenantManagement.tsx:126` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/Traceability.tsx:94` | Aktif · `izlenebilirlik` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/TransferReceipts.tsx:200` | Dondurulmuş · `transfer-receipts` | Sayfa içi yetki kapısı yok |
| `src/pages/UsagePerformanceAnalysis.tsx:301` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/UserActivityTracking.tsx:136` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/UserProfile.tsx:44` | Aktif · `my-profile` | Sayfa içi yetki kapısı yok |
| `src/pages/UserSubscriptionManagement.tsx:132` | Host dışında | Sayfa içi yetki kapısı yok |
| `src/pages/VeriYedegi.tsx:54` | Aktif · `veri-yedegi` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/Warehouse.tsx:271` | Aktif · `depo` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/WarehousePerformanceAnalytics.tsx:1054` | Aktif · `warehouse-performance-analytics` | Sayfa içi yetki kapısı yok |
| `src/pages/WasteAnalytics.tsx:1178` | Aktif · `waste-analytics` | Sayfa içi yetki kapısı yok |
| `src/pages/WasteManagement.tsx:129` | Dondurulmuş · `waste-management` | Sayfa içi yetki kapısı yok |
| `src/pages/WastePrediction.tsx:262` | Aktif · `waste-predictions` | Sayfa içi yetki kapısı yok |
| `src/pages/WeeklyProductionAnalytics.tsx:1173` | Aktif · `weekly-production-analytics` | Sayfa içi yetki kapısı yok |
| `src/pages/WitnessSamples.tsx:228` | Dondurulmuş · `witness-samples` | Sayfa içi yetki kapısı yok |
| `src/pages/WorkOrders.tsx:102` | Aktif · `uretim-emirleri` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |
| `src/pages/WorkforcePlanning.tsx:130` | Dondurulmuş · `workforce-planning` | Sayfa içi yetki kapısı yok |
| `src/pages/WorkspaceWelcome.tsx:33` | Aktif · `workspace-welcome` | Sayfa içi yetki kapısı yok |
| `src/pages/ZayiImha.tsx:54` | Aktif · `zayi-imha` | İzin koşulu var; doğru kapsam/eksik liste ayrıca incelenmeli |

