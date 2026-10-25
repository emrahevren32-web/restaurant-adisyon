# MİYOP · Hedefler

**Son güncelleme:** 20.10.2026 · MIYOP-043 1. adımı yazıldı (0090 uygulandı)

⚠️ **YAYINDAKİ UYGULAMA v0.2.0 YAPISINDA, VERİTABANI 0090 GÖÇÜNDE.**
Arayüz değişiklikleri (zil yönlendirmesi, giriş ekranı) henüz canlıda
değil. Sürüm defteri: `docs/MIYOP-Surum-Defteri.xlsx`.

⚠️ **Bu dosya TEK iş listesidir.** `docs/BITMIS-URUN-EKSIKLERI.md` neyin
neden eksik olduğunu ANLATIR; buradaki maddeler onu KARŞILAR. O dosyadaki
her başlığın burada karşılığı vardır — A→1 ve 2, B→3, C.1 ve C.2→**8**,
C.3→4, C.4→5, D→6. Biri eklenirse diğerine de eklenir.

**Emrah'ın kararı (17.10.2026):** hedef **1 · Satılabilir**. Fatura,
e-fatura, cari hesap ve operasyon genişlemeleri **ilk müşteriden sonra**
(bölüm 8). *"Satılabildiğini görürsek yaparız."*
**Kural:** Bir hedefi yaparken altından yeni bir iş çıkarsa, ana hedefin
altına alt madde olarak eklenir. Tamamlanan madde silinmez, ✅ işaretlenir —
neyin neden yapıldığı kaybolmasın.

**Durum işaretleri:** ✅ bitti · 🔄 devam · ⬜ sırada · ⏸️ bekliyor

---

## 0.A · DEMO ÖNCESİ · EN FAZLA 2 HAFTA (Emrah, 20.10)

İsmet hasta; iyileşene kadar şunlar **bitmiş olacak.** Emrah'ın sözleri:
*"yarım ekranlar bariz itibar düşürücü.. katiyyen olmasın."*

| # | İş | Neden demo öncesi |
|---|---|---|
| **A1** | **B başlığı · yarım ekranlar** · **1/3 bitti** | Kaydet'e basınca veri tarayıcıda kalıyor. Demoda ilk fark edilecek şey bu. **Sıra: ~~Profilim~~ ✅ (20.10) → Firma Profili → İşletme Ayarları → Karşılama**. ⚠️ **25.10:** Şubeler ve Şube Yetkileri **kapsam dışına çıktı** (tek merkez kararı), düzeltilmedi — 5'ten 3'e indi. |
| **A2** | **MIYOP-008** · şube bağlamı kesin değil · **küçüldü** | Tek merkez kararıyla "yanlış şubeye yazma" riski pratikte kalktı. ⚠️ Kapanmadı: kod hâlâ "tercih yoksa ilk şube" diyor — tek şubede doğru sonucu **tesadüfen** veriyor. Başlıktaki şube seçici kaldırılacak, liste sorgularına şube kapsamı yazılacak. |
| **A3** | **MIYOP-010** · etiket ekranında ürünler karışıyor · **MIYOP-064 ile birlikte 6 ekran** | Etiket, demonun en gösterişli parçası; yanlış ürünün alerjeni basılırsa itibar biter. ⚠️ Codex 21.10'da aynı kusuru Depo, Siparişler, Müşteriler, İş Emirleri ve Sevkiyatlar'da da buldu — tek ekrana yama atmak aileyi kapatmıyor (3.7). |
| **A4** | **Sahte veri üreticileri** (3.8, 3.10) · **4 tanesi P0** | Önce `kaldirilan-moduller.md`, sonra silme. ⚠️ İş büyüdü: mesele dosya adı `*.mock.ts` olanlar değil, **27 `createDemo*` üreticisi.** Dördü açık ekrana, biri **müşterinin gördüğü portala** ulaşıyor (MIYOP-058/059/060/061). |
| **A5** | **Şahit numune** (3.9.1) · **veritabanı BİTTİ, ekran kaldı** | İsmet cevapladı (25.10): *"üretim her ürettiği parti üründen şahit numune alıyor."* Göç **0093** yazıldı, prova **21/21**. Kalan: ekran + etiketin saklama koşulunu ürün kartından okuması (3.9.3). |
| **A6** | MIYOP-043 son adımı (0091) + dağıtım | Güvenlik borcu kapanmış olsun. |

⚠️ **Bu listede OLMAYANLAR demo öncesi YAPILMAYACAK:** MIYOP-049/050
(zamanlama, istek sınırı), MIYOP-003/004/005/006, prestij başlığı,
EVREN360'ın kilitli menüleri. Hepsi hedefte duruyor, sırası sonra.

---

## 0 · ŞİMDİ · Yarım kalan iş

- ✅ **0.1** Canlıya dağıtım yapıldı (Yayın 2 · 17.10.2026)
- ✅ **0.2** Codex 0084/0085 denetimi · iki kırık akış buldu (MIYOP-031, -032)
- ✅ **0.3** Göç **0087** uygulandı (MIYOP-002)
- ✅ **0.4** Göç **0088** uygulandı · 27 tablo + MIYOP-035. Prova 42/42.
- ✅ **0.5** Codex 0086/0087/0088 denetimi yaptı · **iki kırık akış buldu**
- 🔄 **0.6** Göç **0089** uygulanacak · MIYOP-038 + MIYOP-039 onarımı.
  Yerel prova **17/17**, 0089 çıkarılınca kırmızıya döndüğü doğrulandı.
  - ✅ **0.6.1** ⚠️ İlk sürüm **tekrar çalıştırılamıyordu**: ikinci koşuda
    kendi başarısını hata sanıp patlıyordu. Onarıldı, üç kez üst üste
    koşturuldu. Aynı kusur 0084'te de vardı, o da onarıldı. → 6.18
- ⬜ **0.7** Dağıtım · 0089 uygulandıktan sonra tek seferde
- ✅ **0.8** Codex 0089 denetimi yaptı · **haklı çıktı: kapıyı gereğinden
  fazla gevşetmiştim.** 11 fonksiyonun üçü kendi yetki kontrolünü yapmıyor.
- ✅ **0.9** Göç **0090** uygulandı · prova 20/20.
- 🔄 **0.11** **MIYOP-043 · 1. adım** · `giris-yap` Edge Function yazıldı.
  ⚠️ **Dağıtılmadan 2. adım yapılamaz** — sıra aşağıda 1.8'de.
- ⬜ **0.10** Dağıtım · 0090 uygulandıktan ve MIYOP-043 bittikten sonra
  tek seferde (arayüzde zil yönlendirmesi de bu dağıtımla gider)
- ✅ **0.12** **Göç 0092 · SKT kapısı · CANLIDA** (25.10)
- ✅ **0.13** **Göç 0093 · şahit numune · CANLIDA** (25.10)
  Yerel prova **21/21**, göç dört kez üst üste koşturuldu, iki olumsuz
  deneme yapıldı.
  ⚠️ **Numara notu:** giriş ACL göçü için 0092 ayrılmıştı; numara yazılma
  sırasına göre verildiği için SKT kapısı **0092**, şahit numune **0093**
  oldu. Giriş ACL'si **0094** olacak.

---

## 1 · GÜVENLİK SINIRI · "Ekranda gizlemek koruma değildir"

Codex denetimi (17.10.2026) gösterdi ki tarayıcıdaki izin kontrolü bir
güvenlik sınırı değil. Gerçek sınır veritabanında olmalı.

- ✅ **1.1** Yazma kapıları veritabanına — birinci tur (göç 0081)
  Reçete, reçete satırı, sevkiyat, sevkiyat satırı, HACCP ölçümü,
  düzeltici faaliyet, ambalaj beyanı. 7 tetik. Prova 29/29.
- ✅ **1.2** Faaliyet kapısının dört deliği (göç 0082)
  Codex'in bulduğu: OPEN→CANCELLED, kapanmış kaydı düzenleme, geri açma,
  ölçüm taşıma. Prova 21/21.
- ✅ **1.3** Yazma kapıları — ikinci tur, MIYOP-001 (göç 0085)
  Stok defteri, stok kartı, lot, şecere, firma, şube, kullanıcı,
  şube erişimi, kiracı. 9 tetik. Prova **39/39**, gerçek PostgreSQL'de
  `authenticated` rolüne geçerek.
  - ✅ **1.3.1** Stok defteri kapısı `reason`a bakıyor — tek izin yazmak
    mal kabulü (satın almacı) ya da üretimi kırardı.
  - ✅ **1.3.2** `app.izin_gerek()` sertleşti; `anon` artık geçemiyor.
    0081'de "oturum yoksa serbest" yazıyordu ve `anon` da oturumsuzdur.
  - ✅ **1.3.3** `user_branch_access` kapandı — kullanıcı kendine şube
    erişimi veremiyor (MIYOP-007'nin yazma yarısı).
  - ✅ **1.3.4** Kendi profilini düzenleme açık bırakıldı: `users.manage`
    ya da KENDİ satırı.
- ✅ **1.3.5** **0085 İKİ AKIŞI KIRDI — 0086 onardı.** Codex buldu.
  - MIYOP-031 · kalite rolü etiket beyanını yazamıyordu
    (`stock_item` kapısı `stock.write` istiyordu, kalitede o izin yok)
  - MIYOP-032 · satın almacı lot açamıyordu → **yarım kalmış mal kabul**
    (hareket geçiyor, lot düşüyor)
  - Ders → tuzak 88: bir akışın izni TEK tabloya bakılarak belirlenemez.
  - Prova 31/31. Stok kartı kapısı kolon saymıyor, JSON farkı kullanıyor.
- ✅ **1.3.6** **MIYOP-001'İN KALANI KAPANDI** (göç **0088**, prova **42/42**)
  Codex ikinci turda kapısı olmayan **26 tabloyu** satır satır listeledi.
  En ağırı: `izleyici` kendi kiracısındaki **HACCP kritik kontrol noktası
  limitlerini** değiştirebiliyordu.
  - ✅ **1.3.6.1** `app.izin_gerek_coklu()` · tetik argümanlarından biri
    yeterli. Argümansız kurulursa **patlıyor**, sessizce geçirmiyor.
    Argüman kontrolü bakım bağlamından ÖNCE.
  - ✅ **1.3.6.2** Eşleme, tabloya değil **EKRANIN kapısına** bakılarak
    yapıldı (tuzak 88'in dersi): Suppliers/PurchaseFlow → `purchase.write`,
    WorkOrders → `production.write`, Sayımlar → `stock.write`,
    Müşteriler/Siparişler → `operations.write`, Sevkiyatlar →
    `logistics.write`, HACCP planı/KKN → `quality.record.manage`.
  - ✅ **1.3.6.3** Mal kabul ve tedarikçi iadesi **iki izni birlikte**
    kabul ediyor (`purchase.write` VEYA `stock.write`): belgeyi satın almacı
    açar, malı depocu alır. Provada ikisi de ayrı ayrı denendi.
  - ✅ **1.3.6.4** HACCP planı/KKN `quality.record.manage` istiyor,
    `quality.write` değil. Ölçüm girmek ile LİMİTİ değiştirmek aynı şey
    değil (0081'in ikiye ayırma kararının devamı).
  - ✅ **1.3.6.5** Eşleme bayatlarsa göç patlıyor: tablo yoksa ya da
    27 tetik kurulmadıysa durur.
  - ✅ **1.3.6.6** **27. TABLO · kendi ölçümüm, Codex listesinde yoktu.**
    Kapıları taktıktan sonra "kapısız yazılabilir tablo kaldı mı" diye
    veritabanını ölçtüm: `stock_item_nutrition`. 0072 alerjen beyanının
    doğrudan yazılmasını kapatmış, **besin değeri tablosunu atlamış** —
    ve o tablo gıda etiketine basılıyor. Hakkı tamamen geri almak ekranı
    kırardı (besin değeri için yazma RPC'si yok), onun için kapı kondu:
    `quality.declaration` · `products.write` · `stock.write`.
  - ✅ **1.3.6.7** Göç artık **kapı saymıyor, kapısız yüzey ölçüyor.**
    0085'te "kapandı" demem, taktığım kapıları saymamdan geldi. Doğru
    soru: `authenticated` rolüne yazma hakkı olup kapısı olmayan tablo
    kaldı mı? **Cevap: 0.** Göç bu sayı 0 değilse durur.
- ✅ **1.3.7** **MIYOP-035** · Sahte alerjen damgası kapandı (göç 0088)
  0072'nin koruması yalnız UPDATE'teydi. Yeni kart AÇARKEN
  `allergen_reviewed_at` doldurulabiliyordu: depo rolü, beyan RPC'si hiç
  çağrılmadan "alerjeni incelendi" kartı oluşturuyor, etiket servisi bunu
  "incelendi · alerjen yok" diye basıyordu. Artık MI436 ile duruyor.
- ✅ **1.3.8** "MIYOP-001 tamamen kapandı" demem **yanlıştı**; Codex haklıydı.
  0085 yarısını kapatmıştı, 0088 kalanını kapattı. Ders: kapı sayısı değil
  **kapısız yüzey** ölçülür.
- ✅ **1.3.9** **0088 İKİ AKIŞI KIRDI — 0089 onardı.** Codex buldu, ben
  yerel PostgreSQL'de ürettim. 0085'in aynı hatası, daha büyük yüzeyde.
  - **MIYOP-039 · MÜŞTERİ PORTALI ÇALIŞMIYORDU.** `portal_siparis_ver`
    dört kapılı tabloya yazıyor. Portal müşterisinin `app_user` kaydı
    YOKTUR — rolü, izni yoktur. **Portaldan sipariş verilemiyordu.**
  - **MIYOP-038 · SEVKİYAT SEVK EDİLEMİYORDU.** Sevkiyat SHIPPED olunca
    sistem siparişin durumunu ilerletir. Sevkiyatçıda `logistics.write`
    var, `operations.write` yok. Zincirin ikinci halkası kapıda duruyordu.
  - ✅ **1.3.9.1** Kök neden: kapı "bu satırı yazan kişinin izni var mı"
    diye soruyor. Ama bazı yazımları KİŞİ değil **SİSTEM** yapar —
    kişinin zaten izinli olduğu başka bir işlemin sonucu olarak.
  - ✅ **1.3.9.2** Çözüm: `current_user in ('anon','authenticated')` ise
    yazım istemciden DOĞRUDAN geliyor, kapı sorulur. Değilse bizim
    `security definer` rutinimizin içindeyiz; yetkiyi o rutin kontrol
    eder. On kapı aynı soruya bağlandı.
  - ✅ **1.3.9.3** ⚠️ **Bedeli sayıldı ve donduruldu.** `authenticated`a
    açık, kapılı tabloya yazan **11** `security definer` fonksiyon artık
    kapının dışında. Göç bu kümeyi adlarıyla donduruyor; 12.'si çıkarsa
    göç ve mimari test KIRMIZI olur.
  - ✅ **1.3.9.4** Olumsuz deneme yapıldı: 0089 çıkarılınca prova
    kırmızıya dönüyor (MI403). Yeşil prova, çalışan prova demek değil.
- ✅ **1.3.11** **0089 GEREĞİNDEN FAZLA AÇMIŞTI — 0090 daralttı.**
  Codex: *"038 ve 039'u onarmak için gereken muaf yazımların tamamı
  `izin_gerek_coklu()` üzerinden geçiyor. Diğer dokuz kapıyı topluca
  gevşetmek bu iki onarımın zorunlu parçası değildi."* Ölçtüm, haklı.
  - ⚠️ İki somut zarar vermişim: **MIYOP-035'in sahte alerjen damgası
    koruması** (`MI436`) ve **0087'nin onay imzası** her `security
    definer` rutinin içinde atlanabilir hâle gelmişti. Gıda etiketine
    basılan bir iddianın korumasını, iki ilgisiz akışı onarmak için
    gevşetmek kabul edilemez.
  - ✅ **1.3.11.1** Dokuz kapı 0089 öncesine döndü; yalnız
    `izin_gerek_coklu` gevşek kaldı. O hâl biliniyordu ve çalışıyordu.
  - ✅ **1.3.11.2** Gevşek kapının ardındaki yüzey **11 rutinden 6'ya**
    indi ve adlarıyla donduruldu.
  - ✅ **1.3.11.3** Prova 20/20; portal **güncelleme** RPC'si de artık
    sınanıyor (0089 provası yalnız sipariş vermeyi kapsıyordu), ve portal
    oturumu artık `tenant_id` claim'ini **koymuyor** — gerçekte de yok.
  - → tuzak 96.
- ✅ **1.3.12** **MIYOP-044 · P1 · üç iç yardımcıya SQL'den ulaşılabiliyordu**
  `app.basvuruyu_onayla`, `app.lisansi_uzat`, `app.lisans_olayi_yaz` kendi
  yetki kontrolünü yapmıyor — yetkiyi dış `public` kabuğa bırakıyor. Ama
  0035 yalnız `anon, authenticated`tan hak aldı; PostgreSQL'de varsayılan
  **PUBLIC EXECUTE**tir ve o kalkmamıştı (tuzak 67, bir kez daha).
  0090 tam imzalarla kapattı; prova: üçü de `42501` veriyor, dış kabuklar
  çalışmaya devam ediyor.
  ⚠️ 0089'un yorumu bu üçü için "kendi yetkisini doğrular" diyordu.
  **Yanlış belge, olmayan belgeden kötüdür** — yorumlar da düzeltildi.
- ✅ **1.3.13** **MIYOP-046 · P0 · 0042 tekrar koşunca lisans kararını
  bozabiliyordu.** Toplu lisans açılışı `status in ('Deneme','Aktif')`
  yokluğuna bakıyordu; bu göç ikinci kez çalıştırılsa **askıya alınmış,
  iptal edilmiş ya da süresi dolmuş** bir kiracıya yeni "Deneme" açardı —
  yani platform sahibinin kapatma kararını sessizce geri alırdı. Koşul
  **hiç lisans satırı olmayan** kiracıya daraltıldı; ölçüldü: tekrar
  koşuda 0 satır açılıyor.
- ✅ **1.3.10** **Provaların kör noktası ortaya çıktı.** 0089'dan sonra
  bir prova `set local role authenticated` yapmadıkça kapının DIŞINDA
  koşuyor: bütün yazımlar sessizce geçiyor. `prova-0081` ve `prova-0082`
  tam olarak böyle körleşmiş; 0089 uygulanınca kırmızıya döndüler ve
  onarıldılar. Codex aynı kusuru portal provalarında bağımsız olarak
  buldu (**MIYOP-042**). Kalan 13 kör prova donduruldu (6.12.6).
  → tuzak 93.
- ✅ **1.4** **MIYOP-002** · Sipariş onayı başkası adına verilemiyor
  (göç **0087**, prova 16/16)
  - ✅ **1.4.1** `decided_by` ve `decided_at`i SUNUCU yazıyor; istemcinin
    gönderdiği kimlik ve tarih yok sayılıyor (0081 `completed_by` deseni)
  - ✅ **1.4.2** Adımın izni `order_approval_step.permission_code`dan
    OKUNUYOR, sabit yazılmıyor — işletme zincirini değiştirirse kapı da değişir
  - ✅ **1.4.3** Uydurma adım koduyla onay yazılamıyor
  - ✅ **1.4.4** Zorunlu adımı etkisizleştirmek `settings.manage` istiyor
- ⬜ **1.5** **MIYOP-003** · Çapraz kiracı referansı + denetim sızıntısı
  Lot/hareket içindeki tenant/şube/kalem/lot referanslarının aynı sahibe
  ait olması zorlanmıyor. Denetim özeti `SECURITY DEFINER` ile kalem adını
  tenant koşulu olmadan okuyor.
- ⬜ **1.6** **MIYOP-017** · Çıkış Supabase oturumunu kapatmıyor
- ⬜ **1.7** **MIYOP-018** · Zorunlu parola değişimi tek RPC ile atlanabiliyor
- 🔄 **1.8** **MIYOP-043 · P1 · Giriş adresi çözümü kullanıcıyı ele veriyor**
  (Codex, 18.10.2026) `0078`in anonim RPC'si bulunamayan kullanıcıya
  `@bulunamadi.miyop.local`, **bulunana gerçek Auth e-postasını** dönüyor
  ve RPC `anon` rolüne açık. Parola bilmeden kullanıcı/firma eşleşmesi ve
  işletme sahibinin gerçek e-postası öğrenilebiliyor.
  ⚠️ Bu 0088/0089 gerilemesi DEĞİL, baştan beri var.
  ⚠️ **ÜÇ ADIMLI VE SIRASI ÖNEMLİ.** `giris-yap` dağıtılmadan
  `giris_adresi_bul`un `anon` hakkını almak **herkesi kapıda bırakır.**
  - ✅ **1.8.1** `supabase/functions/giris-yap/index.ts` yazıldı: adres
    `service_role` ile çözülüyor, parola orada doğrulanıyor, dışarı
    yalnız oturum ya da **tek genel hata** çıkıyor. Adres cevaba
    KONMUYOR. Supabase'in kendi hata metni dışarı verilmiyor.
  - ✅ **1.8.2** Tarayıcı artık önce sunucudan deniyor
    (`src/auth/sunucu-girisi.ts`). `reddedildi` ile `ulasilamadi` ayrı
    tutuluyor — birleştirmek ya herkesi kapıda bırakır ya da gerçek reddi
    ağ arızası sanıp eski sızdıran yola düşürürdü.
  - ✅ **1.8.2a** ⚠️ **Testler yeşildi ama YANLIŞ SEBEPLE.** Mock
    supabase'de `functions` yoktu; `invoke` çağrısı `TypeError` atıyor,
    yakalanıp "ulaşılamadı" sayılıyor ve 14 testin hepsi YEDEK yola
    düşüyordu — yani dağıtımdan sonra çalışacak yol hiç sınanmıyordu.
    Mock'lar eklendi, beş yeni test yazıldı: sunucu yolu çalışınca
    **tarayıcı adresi hiç sormuyor** (sızıntının kapandığının kanıtı) ve
    401 gelince **yedek yola düşülmüyor**. → tuzak 98.
  - ⬜ **1.8.3** **Emrah fonksiyonu DAĞITIR ve girişin çalıştığını
    doğrular.** (`supabase functions deploy giris-yap`)
  - ⬜ **1.8.4** Göç **0091**: `giris_adresi_bul`un `anon` **VE
    `authenticated`** hakkı alınır, **VE** `storage.ts`teki geçici yedek
    yol SİLİNİR.
    ⚠️ **KAPSAM DÜZELTMESİ (Codex, 20.10):** 0078 bu fonksiyonu
    `anon, authenticated, service_role`e birlikte veriyor. Yalnız
    `anon`dan almak **oturum açmış birinin başka işletmenin kullanıcı
    adını sorgulayıp gerçek Auth adresini almasını ENGELLEMEZ** — ve
    fonksiyonun içinde kiracı kapısı yok. Ben 0091'i yalnız `anon` için
    planlamıştım; o hâliyle **yarım bir onarım** olurdu.
    ⚠️ Fonksiyon KALDIRILMAZ: Edge Function onu `service_role` ile
    kullanıyor. `public.personel_giris_adresi` ayrı tutulur —
    `authenticated` hakkını topluca almak personel açmayı kırar.
    ⚠️ Bu madde bitene kadar MIYOP-043 **KAPANMIŞ SAYILMAZ**; sızıntı
    hâlâ açıktır, yalnız olağan giriş akışı artık sızdırmıyor.
  - ⬜ **1.8.5** `prova-0077` bulunan hesabı bulunmayanla karşılaştırmıyor;
    0091'in provası bu ayrımı sınayacak
  - ✅ **1.8.7a** ⚠️ **MIYOP-051'İN İLK ONARIMI YARIM KALMIŞTI.** Edge
    Function kotayı ayırıyordu, istemci `gecici` diye işaretliyordu — ama
    `storage.ts` `null` döndüğü için mesaj **ekrana hiç ulaşmıyordu** ve
    parolası DOĞRU olan kişi yine "şifre hatalı" görüyordu. Codex yakaladı.
    Mesaj artık `authenticateUser → authenticateCredentials → Login`
    zincirinden geçip ekranda görünüyor.
  - ✅ **1.8.13** **MIYOP-056** · ⚠️ **AYNI AİLEDEN ÜÇÜNCÜSÜ.** Parola
    doğrulanmış, oturum kurulmuş, sonra **izin sorgusu düşmüş**:
    `setCurrentUser(null)` yalnız uygulamanın kendi kaydını siliyor, Auth
    oturumuna dokunmuyordu. "Giriş başarısız" diyen ekranın arkasında
    geçerli oturum kalıyordu — ve sebep parola değilken genel kimlik
    hatası gösteriliyordu. `scope: 'local'` çıkış + geçici arıza mesajı.
    (052 → `getUser`, 055 → kapsam, 056 → izin okuma. Üçü de "başarısız
    giriş" dalında temizlik eksikliği.)
  - ✅ **1.8.12** **MIYOP-055** · ⚠️ **MIYOP-052'yi onarırken yenisini
    yaptım.** `supabase.auth.signOut()` varsayılan kapsamı `global`:
    kullanıcı başka cihazda çalışırken buradaki geçici bir okuma hatası
    ONUN refresh token'ını da iptal ediyordu. `scope: 'local'` kondu.
    - ⚠️ Aynı kusurun ikinci yüzü de vardı (benim değil, eski kod):
      `app_user` okuma hatasında da kapsamsız çıkış yapılıyordu. Ayrıldı:
      **okuma hatası → `local`** (arıza, başka cihazı düşürmek için sebep
      değil), **hesap yok/pasif → `global`** (karar; o hesap nerede açıksa
      kapanmalı). → tuzak 102.
  - ✅ **1.8.7** **MIYOP-051** · Auth kota (429) ve geçici arıza (5xx)
    "giriş adı veya şifre hatalı" diye dönüyordu. Parolası DOĞRU olan kişi
    şifresini boş yere değiştirmeye kalkardı, arıza da gizlenirdi. Üç
    durum ayrıldı (401/429/503); geçici hata **yedek yola düşmüyor** —
    bir kota arızasını eski sızdıran yola yönlendirmek olurdu.
  - ✅ **1.8.8** **MIYOP-052** · `setSession` başarılıyken `getUser`
    düşerse `null` dönülüp çıkılıyordu: "giriş başarısız" diyen ekranın
    arkasında **açık bir Auth oturumu** kalıyordu. Artık `signOut()`.
  - ✅ **1.8.9** **MIYOP-053** · Gövde `null` ya da alan türü yanlışsa
    (`{"giris":{"toString":null}}`) yakalanmamış hata atıyor ve kontrollü
    cevap sözleşmesi (CORS başlıkları dâhil) bozuluyordu. Alanlar
    okunmadan önce tür doğrulanıyor; hatalı şekil SQL/Auth'a hiç gitmeden
    400 dönüyor.
  - ⬜ **1.8.10** **MIYOP-049 · P1 · zamanlama** · Bulunmayan hesapta
    `0078` ikinci sorguyu atlıyor ve Supabase Auth bulunamayan hesabı
    parola doğrulamasından ÖNCE reddediyor. Yani sahte adresle Auth'a
    gitmek maliyeti eşitlemiyor; aynı biçimdeki iki kullanıcı adının
    yanlış parola denemesi farklı süre dağılımı verebilir.
    ⚠️ Codex uzaktan sömürülebilirliği **doğrulamadı**; ben de ölçmedim.
    Kabul kriteri: yalıtılmış ortamda tekrarlı süre ölçümü hesap
    varlığını ayırt ettirmemeli.
  - ⬜ **1.8.11** **MIYOP-050 · P1 · istek sınırı yok** · Ayrıcalıklı
    adres RPC'si Auth denemesinden ÖNCE çalışıyor; Auth kotası dolsa bile
    her yeni çağrı o SQL işini yaptırıyor. Ayrıca son kullanıcı IP'si
    Auth'a aktarılmıyor, sunucu çıkışını paylaşanların kotası
    ortaklaşabilir. Çözüm: RPC'den önce atomik istek sınırı.
    ⚠️ "Auth limiti tamamen atlanıyor" DEĞİL — son parola denemesi yine
    Auth'a gidiyor.
  - ⬜ **1.8.6** `public.basvuru_gonder` bekleyen başvuru varlığını `MI409`
    ile ayırt ettiriyor (Codex). Gerçek e-postayı sızdırmıyor, tekrar
    başvuruyu önlemek bilinçli karar — ama dış yanıt tekleştirilebilir.
- ⏸️ **1.9** PUBLIC EXECUTE temizliği · 7 fonksiyon
  ⚠️ `app.yetkim_var`dan ASLA alınmayacak — bütün kapılar ona bağlı.
  ⚠️ `app.kapi_disi_baglam`dan da alınmayacak (0089): alınırsa kapılar
  MI403 yerine 42501 verir ve yazımlar YANLIŞ SEBEPLE reddedilir.
- ⬜ **1.10** **DENETİM VE KOLON YETKİSİ · kalan ölçüm**
  - ⬜ **1.10.2** **Denetlenmeyen 26 kiracı tablosu ayrıştırılacak.**
    `0091` yetki tablolarını kapattı; notice 26 tablo daha listeledi.
    Bunların bir kısmı **ekle-sadece** defter ve kendi yazar kolonunu
    taşıyor (denetim tetiği gereksiz olabilir), bir kısmı gerçek boşluk.
    Sayarak değil **tek tek okuyarak** ayrılacak; gerekçesi yazılacak.
  - ⬜ **1.10.3** **`company` ve `branch`ta kolon yetkisi var mı?**
    Ölçüm (21.10): `0006` `authenticated` rolüne `tenant, company, branch,
    app_user, …` üzerinde **tablo seviyesinde** `select, insert, update`
    verdi. `0012` bunu **yalnız `tenant` ve `app_user`** için kaldırıp
    kolon yetkisine indirdi; **`company` ve `branch` dokunulmadı.**
    Bugün kapı tetikte (`company.manage` / `branch.manage`, `0085`) ve
    RLS satırı kiracıya bağlıyor — yani **sunucu tarafı kapı VAR.**
    Soru şu: `company.manage` izni olan bir işletme sahibi `company.status`
    alanını kendi satırında `'Aktif'` yapabilir mi? Eğer platform bir
    müşteriyi **bu alanla** pasife alıyorsa, müşteri kendi askısını
    kaldırabilir. ⚠️ **İDDİA ETMİYORUM, ÖLÇÜLECEK:** "pasife al" düğmesi
    hangi alana yazıyor (`company.status` mı, `tenant.status` mı, lisans
    mı)? `tenant.status` `0012` ile korunuyor; `company.status` korunmuyor.
    Emrah'ın kuralı: *"ödemeyen müşteri tek düğmeyle pasife alınabilmeli"* —
    o düğmenin geri alınamaz olması gerekir.

---

## 2 · VERİ BÜTÜNLÜĞÜ · "Yarım kalan iş kalmasın"

- ⬜ **2.1** **MIYOP-004** · Sahte ters kayıt negatif stok kontrolünü aşıyor
  `reverses_movement_id` dolu olan her kayıt kontrolden muaf; ters kaydın
  gerçekten tam ters olduğu doğrulanmıyor.
- ⬜ **2.2** **MIYOP-005** · Satır güncellemesinde veri kaybı
  Reçete/plan/sevk satırlarında önce `delete()` sonra `insert()`.
  İkincisi düşerse satırlar kalıcı olarak gidiyor.
- ⬜ **2.3** **MIYOP-006** · İşlemler atomik ve tekrar denenebilir değil
  Lot, hareket, belge bağlantısı ve durum geçişi bağımsız yazımlar.
- ⬜ **2.4** **MIYOP-011** · Eşzamanlı çıkışlar aynı lotu negatife düşürüyor
- ⬜ **2.5** **MIYOP-013** · Tedarikçi iadesi yanlış lottan düşebiliyor
- ⬜ **2.6** **MIYOP-014** · HACCP kararı istemciden geliyor
- ⬜ **2.7** **MIYOP-015** · Sevk iptalinde sipariş durumu geri hesaplanmıyor
- ⬜ **2.8** **MIYOP-016** · Üretim maliyeti sonraki alışlardan etkileniyor
- ⬜ **2.10** **ÇIKIŞIN DAYANAĞI HER YOLDA ZORUNLU DEĞİL** (MIYOP-069'dan
  çıktı, 25.10). `stock_movement.reason` ve `source_type` **zorunlu**;
  ama `source_id` boş kalabiliyor ve **elle çıkış formu onu hiç
  göndermiyor** (`stock.postgres.ts` `null` yazıyor). Yani "bu çıkış şu
  siparişe/iş emrine dayanıyor" bağı her yolda yok.
  - ⬜ **2.10.1** Hangi `reason` değerlerinde `source_id` **zorunlu**
    olmalı, hangilerinde meşru şekilde boş kalır (sayım farkı, açılış
    bakiyesi, elle düzeltme)? Liste yazılacak, sonra kısıt konacak.
  - ⬜ **2.10.2** Elle çıkış formuna **dayanak alanı** eklenecek
    (gerekçe + varsa belge). ⚠️ Zorunlu kılmadan önce meşru elle çıkış
    yollarının kapanmadığından emin olunacak — kapanırsa kullanıcı sahte
    belge uydurur, kayıt daha da kötüleşir.
- ✅ **2.9** **SKT KAPISI KURULDU · göç 0092 (25.10)**
  Süresi geçmiş parti artık **üretime giremiyor** ve **sevk edilemiyor.**
  Prova **12/12**; göç üç kez üst üste koşturuldu (idempotent); olumsuz
  deneme yapıldı — kapı kaldırılınca prova ilk sınamada kırmızı döndü.
  - ✅ **2.9.A** **Reddedilen iki sebep:** `PRODUCTION_CONSUME`,
    `SHIPMENT_OUT`. Ret kodu **MI437**; prova bunun 42501/23502 gibi başka
    bir sebeple olmadığını **ayrıca** sınıyor — yanlış sebeple ret, kapı
    çalışıyor sanılır.
  - ✅ **2.9.B** **Reddedilmeyenler ve gerekçeleri** göçün başlığında tek
    tek yazılı: **imha** (`EXPIRY_WRITE_OFF`) — süresi geçmiş malın çıkış
    yolu zaten burası, kapatmak malı sistemde sonsuza kadar tutmak olurdu;
    **fire**; **tedarikçi iadesi** — süresi geçmiş malı geri vermek istenen
    davranış; **sayım farkı** — sayım gerçeği yazar, kural koymaz;
    **transfer**; **ters kayıt** — geçmişi düzeltmeyi engellemek yanlış
    kaydı kalıcı yapardı.
  - ✅ **2.9.C** **SKT'si BUGÜN olan parti REDDEDİLMİYOR.**
    `expires_on < current_date` yazıldı, `<=` yazılmadı: son kullanma
    tarihi ürünün son kullanılabileceği gündür; `<=` bir günlük malı çöpe
    atardı. Prova bunu dün/bugün/yarın/tarihsiz dört partiyle ölçüyor.
  - ✅ **2.9.D** **SKT'si olmayan parti reddedilmiyor** — kuru bakliyat
    gibi tarih taşımayan kalemler var. "Bilinmiyor" ile "geçmiş" aynı şey
    değil.
  - ✅ **2.9.4** **İstemci tarafı da onarıldı** (Codex'in bulduğu).
    `warehouse.service.ts` FEFO sıralaması süresi geçmiş partileri
    **elemeden** sıralıyordu — tarihi en eski olan o olduğu için FEFO'da
    **en başa** geliyor ve otomatik seçiliyordu. Artık FEFO dağıtımı ve
    **elle lot seçimi** ikisi de süresi geçmiş partiyi reddediyor.
    ⚠️ Bu bir kolaylık değil: kapı sunucuda, burası onun ekrandaki yüzü.
    Olmasa kullanıcı reddedilen bir işlemi tekrar tekrar dener ve sebebini
    anlamaz.
  - ✅ **2.9.5** **İki yerdeki liste donduruldu.**
    `src/warehouse/skt-kapisi.arch.test.ts` göçteki sebep listesini
    **SQL'den okuyup** servisteki listeyle karşılaştırıyor; biri değişip
    diğeri kalırsa test kırılıyor. Ayrıca imha yolunun kapatılmadığını,
    ters kayıt muafiyetinin durduğunu, `<=` yazılmadığını ve servisin
    dün/bugün/yarın/tarihsiz kararını aynı verdiğini de ölçüyor.
  - ⬜ **2.9.2** **FEFO uyarısı** (hâlâ açık): daha eski açık parti varken
    yenisi seçilirse **uyar** — engelleme değil, meşru istisnalar var.
    ⚠️ SKT kapısından farklı bir iş: kapı *"geçmiş olanı engelle"*, uyarı
    *"sırayı atlıyorsun"* diyor.
  - ✅ **2.9.8** **MIYOP-074 · PLANLAMA EKRANLARI DA DOĞRU SAYIYOR**
    (Codex, 25.10 — ve bu benim kapımın yan etkisiydi).
    SKT kapısı yazmadan önce "fiziksel bakiye" ile "kullanılabilir bakiye"
    aynı şeydi. Kapıdan sonra ayrıştılar, ama planlama ekranları hâlâ
    **fiziksel** toplamı okuyordu. Somut senaryo: dün biten 10 kg + geçerli
    10 kg, ihtiyaç 15 kg → **İş Emirleri** ve **Sevkiyatlar** ekranında
    eksik miktar `—` görünüyor, **Başlat** ve **Sevk Et** açık kalıyor;
    **Üretim provası** *"Stok yeterli"* diyor. Tıklayınca kapı reddediyor.
    ⚠️ Yani ekran önce *"yapabilirsin"* deyip sonra *"yapamazsın"* diyordu.
    Bu, kapının kendisinden daha kötü: kapı doğru, **ekran yalan söylüyor.**
    Yapılan: `DepoKalemi` artık üç sayı taşıyor — `miktar` (fiziksel),
    `suresiGecmis`, `kullanilabilir`. Üç planlama ekranı da
    **kullanılabilir** olanı okuyor.
    ⚠️ **Kritik stok eşiği de kullanılabilire bağlandı:** kritik uyarısının
    amacı sipariş verdirmek, süresi geçmiş mal o ihtiyacı karşılamıyor.
    100 kilo süresi geçmiş mal, 5 kiloluk eşiği kapatmamalı.
  - ✅ **2.9.7** **"Yetersiz stok" yalanı önlendi.** SKT süzgeci eklenince
    şu ortaya çıktı: süresi geçmiş partiler elendiği için kalan miktar
    yetmiyor ve kullanıcı *"Yetersiz stok: 45 istendi, defterde 30 var"*
    mesajını alıyor. **Bu mesaj YANLIŞ** — depoda 45 kilo VAR, 15 kilosunun
    süresi geçmiş. Kullanıcı deposuna bakıp malı görüyor, sistem "yok"
    diyor. Doğru olmayan bir hata mesajı da bir tür *mış gibi*.
    Ayrı bir hata yazıldı (`SuresiGecmisStokError`): *"Yetersiz
    kullanılabilir stok: 45 istendi, kullanılabilir 30. Depoda ayrıca 15
    birim SÜRESİ GEÇMİŞ parti var; bunlar üretime giremez ve sevk edilemez.
    İmha kaydı açılmalı."* → tuzak 115
  - ⬜ **2.9.6** **Ekranda gerekçe gösterimi.** Ret `MI437` ile geliyor;
    arayüz bunu *"Bu partinin son kullanma tarihi geçmiş"* diye gösterip
    **imha kaydı aç** düğmesine yönlendirmeli. Bugün kullanıcı ham hata
    metnini görmüyor ama yönlendirme de yok.

---

## 3 · EKRAN BORCU · "Kaydettim ama gitmemiş"

Açık 25 kiracı rotasının 6'sı `storage.ts` (tarayıcı hafızası) okuyor/yazıyor
idi; **20.10'da Profilim çıktı, 5 kaldı.**
Kullanıcı Kaydet'e basıyor, ekran kaydedildi diyor, veri tarayıcıda kalıyor.
`src/modules/kiraci-ekrani-veri-kaynagi.arch.test.ts` bunları dondurdu —
liste yalnız KISALABİLİR (çıcır sayısı 6 → 5).

⚠️ **21.10'da öğrenilen (tuzak 108):** kalan ekranlar **aynı iki
fonksiyondan** besleniyor — `loadBranches()` ve `loadCompanies()`. İkisi de
depo boşken **demo satır üretiyor**. Yani ekranları tek tek onarmak sırayı
kısaltıyor ama kaynağı temizlemiyor. **Firma Profili'nden önce kaynak
onarılacak** (3.10.1), yoksa her yeni ekran aynı sahte satırları
devralıyor.

⚠️ **25.10 · TEK MERKEZ KARARI · liste 5'ten 3'e indi.**
Emrah: *"Şube olayı zaten şu an olmasın. Şu anki seviye müşterinin genel
merkezi gibi davransın işte."* **Şubeler (3.5)** ve **Şube Yetkileri
(3.3)** ekranlarının menü ögeleri donduruldu; artık açık rota değiller.
⚠️ **Bu bir DÜZELTME DEĞİL, kapsam değişikliği** (tuzak 111): iki ekranın
kodu hâlâ depoda ve hâlâ tarayıcıya yazıyor. Şube geri geldiğinde borç da
geri gelir. Karar belgesi: `docs/kararlar/tek-merkez-karari.md`
Kalan üç: **Firma Profili (3.1), İşletme Ayarları (3.4), Karşılama (3.11)**.

Emrah'ın onayladığı sıra:

- 🔄 **3.1** Firma Profili (`company-profile`) — **sıradaki ekran**
  - ✅ **3.1.1** **KİM DEĞİŞTİREBİLİR · KARAR VERİLDİ** (Emrah, 21.10):
    **yalnız işletme sahibi.** Müdür değiştiremez.
    ⚠️ Bu karar **zaten veritabanında yazılıydı:** göç `0015`
    `isletme_muduru` rolüne `company.manage` iznini vermiyor
    (`code not in ('users.manage','roles.manage','settings.manage','company.manage')`)
    ve gerekçesi göçün içinde: *"müdür işi yürütür, işletmenin kimliğini ve
    kimin neye erişeceğini değiştirmez. O yetki sahiptedir."*
    Vergi numarası için **ayrı izin açılmadı**; firma kimliği bir bütün
    olarak `company.manage` ile korunuyor.
  - ✅ **3.1.2** **YAZMA SÖZLEŞMESİ ÖLÇÜLDÜ** (21.10). Profilim'de olduğu
    gibi önce kapıyı ölçtüm:
    · `authenticated` rolü `company` tablosunda **tablo seviyesinde**
      `select, insert, update` hakkına sahip (`0006`). Profilim'deki gibi
      kolon kısıtı **YOK** — orada `0012` tablo hakkını kaldırıp dört kolon
      vermişti, `company` için aynı şey yapılmadı.
    · Asıl kapı tetikte: `0085` → `izin_company` tetiği
      `app.izin_gerek('company.manage')`. Yani izinsiz UPDATE **sunucuda**
      reddediliyor; ekranı atlayıp REST'e gitmek işe yaramıyor.
    · RLS `company_tenant_isolation` satırı kiracıya bağlıyor (`0001`),
      yani başka firmanın satırı görünmüyor/yazılmıyor.
    · `0091` ile `company` **denetime** düşüyor: kim neyi değiştirdi yazılı.
    **Sonuç: ekran `company` tablosuna doğrudan yazabilir, RPC gerekmiyor.**
    ⚠️ Ama `0012` desenini burada da kurmak gerekip gerekmediği ayrı bir
    soru → 1.10.3.
  - ⬜ **3.1.3** **Ekranı gerçek veriye bağla.** Formdaki alanların
    **tamamı** `company` tablosunda mevcut (`0001`: `short_name`,
    `legal_name`, `tax_office`, `tax_number`, `phone`, `email`, `website`,
    `address`, `city`, `district`, `postal_code`, `logo_url`,
    `authorized_person`, `authorized_title`, `authorized_phone`,
    `authorized_email`, `primary_sector_id`). **Yeni alan göçü GEREKMİYOR** —
    eksik olan okuma/yazma katmanı.
  - ⬜ **3.1.4** **MIYOP-060 · boş alan uydurularak doldurulmuyor.**
    Bugün `normalizeCompany` (storage.ts:2841–2857) şunu yapıyor:
    `legalName: item.legalName || companyName`,
    `authorizedPerson: item.authorizedPerson || ownerName || companyName`,
    `authorizedPhone: item.authorizedPhone || phone`. Yani ticari unvan boş
    olsa ekran **firma adını** unvan gibi gösteriyor; kullanıcı alanı
    boşaltsa normalizasyon geri dolduruyor.
    ⚠️ **Bu tam olarak göç `0084`ün veritabanı tarafında ONARDIĞI yalan.**
    Düzeltilmiş bir kusurun ikinci katmanda yaşaması → **tuzak 106.**
    Kabul: DB'de boş olan yetkili/unvan ekranda boş görünecek; boşaltılan
    alan tekrar firma adı olmayacak.
  - ⬜ **3.1.5** **MIYOP-062 · kayıtta alan düşmesi.** `normalizeCompany`
    dönüş nesnesinde `shortName`, `website`, `postalCode`,
    `authorizedTitle` **yok** — tipte var (`types.ts:827–832`), kayıtta yok.
    Kaydet `JSON.stringify(items.map(normalizeCompany))` yazdığı için bu
    dört alan **sessizce siliniyor.** Kabul: her alana farklı değer gir →
    kaydet → ekranı kapat/aç → yenile → hepsi yerinde olacak.
  - ⬜ **3.1.7** ⚠️ **063 YALNIZ Firma Profili ile sınırlı değil** (Codex,
    22.10): `assignHeadOffice` içindeki **"Merkez Yap"** yolu da süzülmüş
    firma listesini ortak koleksiyona yazıyor. İki yolun da diğer firmanın
    yerel verisini koruması gerekiyor — biri onarılıp öteki bırakılırsa
    kusur ayakta kalır (tuzak 104'ün aynısı).
  - ⬜ **3.1.6** **MIYOP-063 · bir firmayı kaydetmek diğerini düşürüyor.**
    `saveCompanyProfile` (branch-directory.service.ts:126) **süzülmüş**
    `loadCompanies()` sonucunu `saveCompanies()`e veriyor; `saveCompanies`
    (storage.ts:4412) ortak koleksiyonu bununla **değiştiriyor** ve yalnız
    `deletedAt` dolu olanları koruyor. Yani B firmasını kaydetmek A'nın
    yerel kaydını siliyor. ⚠️ Veritabanında silme OLMUYOR — bu tarayıcı
    katmanının kusuru; ekran DB'ye bağlanınca kendiliğinden kapanıyor.
- ✅ **3.2** Profilim (`my-profile`) — **BİTTİ (20.10).** Artık veritabanını
  okuyup yazıyor; tarayıcı hafızasıyla ilgisi kalmadı
  - ✅ **3.2.1** **KÖK NEDEN BULUNDU.** Ekran `loadUsers()` ile
    **localStorage'ı** okuyor; giriş yapan kullanıcı ise Supabase'deki
    `app_user` satırından geliyor ve localStorage listesine **hiç
    yazılmıyor.** `users.findIndex(u => u.id === currentUser.id)` bu yüzden
    hep `-1` dönüyor → "Kullanıcı kaydı bulunamadı". Yani ekran, kullanıcının
    giriş yaptığı dünyadan BAŞKA bir dünyayı okuyor (tuzak 82).
  - ✅ **3.2.2** **Yazma sözleşmesi ölçüldü.** `app_user` üzerinde
    `authenticated` rolünün **tablo seviyesinde UPDATE hakkı YOK**; yalnız
    `full_name, phone, profile_photo_url, updated_at` kolonlarında var
    (0012). Yani ekranın yazacağı iki alan serbest, `role_code`,
    `is_active` ve `username` **veritabanı tarafından** kapalı. Ekranda
    "kapalı" göstermek yeterli değildi; asıl kapı burada ve duruyor.
  - ✅ **3.2.3** **Ekran gerçek veriye bağlandı.**
    `src/users/profil.repository.ts` yazıldı: `profilimiOku()` oturumdaki
    `auth.uid()` ile `app_user` satırını okuyor, firma adını ve şube
    adlarını **ayrı** okuyor (biri düşerse profil yine görünüyor),
    okunamayan alan `—` kalıyor — uydurulmuyor.
    `profilimiYaz()` **yalnız** `full_name`, `phone`, `updated_at` yazıyor;
    boş telefon `''` değil `null`. `sifremiDegistir()` şifreyi yalnız
    Supabase Auth'a iletiyor, ardından `sifremi_belirledim` ile geçici şifre
    bayrağını düşürüyor; şifre hiçbir günlüğe ve bizim veritabanımıza
    girmiyor.
    `src/pages/UserProfile.tsx` baştan yazıldı: `../storage` ve
    `branch-directory.service` içe aktarması **sıfır**; kaydettikten sonra
    ekran veritabanından **yeniden okuyor** ("kaydedildi" deyip eski değeri
    ekranda bırakmak bu ekranın eski kusuruydu); sahte `addActionLog`
    denetim kaydı kaldırıldı — gerçek denetim göç 0091'in tetiğinde.
    Kullanıcı adı, giriş adresi ve rol salt okunur; fotoğraf yok.
  - ✅ **3.2.4** **Yazılan kolon kümesi donduruldu.**
    `src/users/profil.repository.test.ts` (13 test) içindeki merkezî test
    `update()`e giden nesnenin anahtarlarını tam olarak
    `['full_name','phone','updated_at']` olarak ölçüyor ve yedi yasak
    kolonun (`role_code`, `username`, `username_key`, `is_active`,
    `tenant_id`, `company_id`, `auth_user_id`) **yokluğunu** ayrıca
    doğruluyor. Yani ileride biri bu nesneye bir alan eklerse test kırılır.
  - ✅ **3.2.6** **MIYOP-066 · "bitti" dediğim iş yarım kalmıştı.**
    Codex buldu (21.10): ekran kaydettikten sonra `onProfileChange` çağırıyor
    ama `BusinessWorkspaceRouteHost` bu prop'u **geçirmiyordu.** Sonuç:
    veritabanı ve Profilim ekranı yeni adı gösteriyor, **yan menü ve kilit
    ekranı eski adı** gösteriyordu. Zincirin üç halkası doğru, dördüncüsü
    yok — **tuzak 103'ün dördüncü örneği** ve bu kez kusur bendeydi:
    yazdığım geri çağrının bağlanıp bağlanmadığını ölçmemiştim.
    Onarıldı: `App.handleProfileChange` kabuğu ve `ra_auth` önbelleğini
    güncelliyor (yalnız ad + telefon; rol/izin/kiracı `currentUser`dan
    geliyor), RouteHost prop'u geçiriyor, ekran **formdaki değeri değil
    veritabanından geri okunanı** taşıyor.
    Donduran test: `src/modules/public-yol-ve-kabuk.arch.test.ts` —
    prop geri alınırsa, App geri çağrıyı vermezse ya da kabuk güncellemesine
    rol/izin yazılırsa kırmızı olur (üç olumsuz deneme yapıldı).
  - ✅ **3.2.7** **MIYOP-066'nın KALAN YARISI + MIYOP-068** (Codex, 22.10).
    *"066 kapandı"* demem **yine erken olmuştu** — iki dal eksikti:
    **(a)** Kabuğa bildirim yalnız `kaydet` içindeydi. Yazma **başarılı**
    olup geri okuma **düşerse**, kullanıcı "Tekrar dene"ye basıp profilini
    görüyor ama yan menü eski adı göstermeye devam ediyordu. Doğrusu:
    bildirimi kaydetme akışına değil **her başarılı okumaya** bağlamak.
    Artık `yukle` bildiriyor, `kaydet` ayrıca bildirmiyor.
    **(b)** **MIYOP-068** · `handleProfileChange` kimlik
    karşılaştırması yapmıyordu. Sıra: A kaydeder → geri okuması gecikir →
    A çıkar, aynı sekmede B girer → A'nın cevabı gelir → **B'nin kabuğuna
    A'nın adı yazılır** ve `ra_auth`a kaydedilir. (B'nin veritabanı kaydı,
    rolü ve izinleri değişmiyordu.) İki bağımsız kapı kondu.
    **(c)** ⚠️ **Kendi onarımımın yarattığı riski buldum:** (a) ile
    `yukle` artık `currentUser`a bağlı; geri çağrı her seferinde yeni
    nesne üretirse okuma → haber → yeni kimlik → okuma **sonsuz döngüsü**
    olurdu. Kapı: ad ve telefon aynıysa `onceki` nesnesinin kendisi
    dönüyor. Teslimden önce yakalandı.
    Dört olumsuz deneme yapıldı, dördü de kırmızı verdi.
  - ⬜ **3.2.8** ⚠️ **TESTİN KAPSAMI DÜRÜSTÇE:** `public-yol-ve-kabuk`
    testi **metin** ölçüyor — hangi kapının kaynakta durduğunu. **Davranış
    ölçmüyor.** Gerçek senaryo sınaması (A'nın okuması bekletilir, B giriş
    yapar, A'nın cevabı gelir; B'nin adı değişmemeli) tarayıcı testi
    ister. Codex bunu doğru söyledi. **Demo sonrasına** — ama kapsamın
    yazılı olması şart, yoksa test iddiadan fazlasını kanıtlıyor sanılır
    (tuzak 107).
  - ✅ **3.2.5** Çıcır testi güncellendi: `my-profile` `BILINEN_BORC`
    listesinden çıkarıldı, üst sınır 6 → 5 indirildi. ⚠️ Bu test, listedeki
    her ekranın GERÇEKTEN tarayıcıya bağlı olduğunu da doğruluyor; yani
    satırı silmek zorunluydu, seçenek değildi.
- ⏸️ **3.3** Şube Yetkileri (`branch-permissions`) — **KAPSAM DIŞI (25.10)**
  Menü ögesi donduruldu, ekran kapandı. ✅ **MIYOP-061 kapandı** —
  başka kiracının önbellek verisini gösteren tek açık ekran buydu.
  ⚠️ Aşağıdaki maddeler **çözülmedi**, şube geri geldiğinde geçerli.
  - ⬜ **3.3.1** **MIYOP-058 · P0 · dört demo şube ekranda.**
    `BranchPermissions.tsx:65` ham `loadBranches()` çağırıyor;
    `readBranchesFromStorage` (storage.ts:478) depo boşken
    `createDemoBranches()` döndürüyor: **Merkez/İstanbul/Ankara/İzmir**,
    uydurma telefon-adres, "Emrah Evren / Ayşe / Mehmet / Selin" müdür
    adları. Üstelik `company-bridge.ts:89` gerçek şubeleri aynalarken bu
    listeyi okuyup **demo satırları koruyarak** geri kaydediyor — sahte
    veri KALICI hâle geliyor. Şube süzgeci ve şube sayacı bunları sayıyor.
  - ⬜ **3.3.2** **MIYOP-061 · P0 · başka kiracının verisi görünebiliyor.**
    `loadBranches()` ve `loadBranchPermissions()` (storage.ts:4322, 4330)
    **hiçbir kiracı süzgeci uygulamıyor** — `loadCompanies()`in aksine.
    A hesabıyla girip çıkıp B hesabıyla girildiğinde A'nın aynalanmış
    şubeleri/erişimleri B'nin listesine düşebiliyor. ⚠️ Veritabanında yetki
    yükseltmesi YOK (RLS + `izin_user_branch_access` duruyor); bu bir
    **yerel veri ifşası.** Emrah'ın kuralı: *"müşterinin görmemesi gereken
    hiçbir şey müşteri ekranında olmasın."*
  - ⬜ **3.3.3** **Form, veritabanıyla bire bir eşleşmiyor.**
    `user_branch_access` sadece **üyelik** tutuyor (kim hangi şubeye
    erişiyor). Formdaki `canCreate/canEdit/canDelete` kolonları orada
    **YOK** — gerçek yazma yetkisi rol/izinden geliyor. Yani ekran
    taşınmadan **önce** neyi yönettiğine karar verilmeli: üyelik mi,
    yoksa şube bazlı izin mi? İkincisi yeni göç ister. → İsmet **B2**
- ⬜ **3.4** İşletme Ayarları (`settings`)
  - ⬜ **3.4.1** **MIYOP-060b · sorulmamış soruya cevap.**
    `DEFAULT_SETTINGS` (storage.ts:306) `vatRate: 10` yazıyor ve form bunu
    **işletmenin KDV oranı** gibi gösteriyor. Kimse %10 demedi.
    Belirlenmemiş değer boş görünmeli ya da alan kaldırılmalı.
  - ⬜ **3.4.2** **Karşılığı olmayan alan.** Ad/logo için
    `company.company_name` / `logo_url` var; **kiracı genelinde para birimi
    ve KDV** için göçlerde karşılık YOK. (Sipariş/stok satırındaki
    `vat_rate` işletme ayarı değil, satırın vergisi.) Bu iki ayar
    korunacaksa **yeni şema** ister; korunmayacaksa alan kaldırılır.
    ⚠️ Karar verilmeden ekran taşınmayacak.
  - ⬜ **3.4.3** KDV ve para birimi ayrıca **ortak** `ra_settings` içine
    yazılıyor; bir kiracının değeri diğerinin varsayılanına taşınabiliyor.
    3.4.2 kararıyla birlikte kapanır.
- ⏸️ **3.5** Şubeler (`branches`) — **KAPSAM DIŞI (25.10)**
  ⚠️ Aşağıdaki maddeler **çözülmedi**, şube geri geldiğinde geçerli.
  - ⬜ **3.5.1** **MIYOP-062b · kayıtta alan düşmesi.** `normalizeBranch`
    (storage.ts:2496) dönüşünde `branchType`, `postalCode`, `isHeadOffice`
    **yok** — tipte var (`types.ts:1029–1043`). Kaydet bunları siliyor.
  - ⬜ **3.5.2** Merkez şube iki yerde: `company.default_branch_id`
    **yetkili kaynak**, `branch.is_head_office` **ayna** (ADR-002). Ekran
    taşınırken ikisi **tek işlemde** güncellenmeli, yoksa ayrışır.
  - ⬜ **3.5.3** Şube yazma kapısı `branch.manage` (`0085`) — müdürde VAR,
    firma yönetiminden farklı. Bu bilinçli: müdür şube açar, firma
    kimliğine dokunmaz.
- ⬜ **3.9** **"Bu modülleri yapmıyor muyuz?" — ölçülmüş cevap** (Emrah
  sordu, 20.10). Veritabanı tablolarına bakarak:
  - ✅ **ŞOKLAMA YAPIYORUZ.** `BLAST_CHILLING` gerçek bir HACCP aşaması
    (0024) ve **CCP-6 · "Hızlı soğutma · 2 saatte 10 °C"** her yeni
    kiracıya otomatik kuruluyor (0079). Ölçümler `haccp_measurement`
    tablosuna gidiyor. `blast-chiller/` mock modülü **aynı konunun ikinci,
    sahte kopyasıydı** — asıl iş HACCP ekranında.
  - ❌ **ŞAHİT NUMUNE ve KALİTE NUMUNESİ YAPMIYORUZ.** `%sample%` /
    `%numune%` deseninde **hiç tablo yok**. Bu ekranlar yalnız uydurma
    veriyle vardı; "mock veri asla olmayacak" kuralı gelince donduruldu.
    Yani bırakmadık — **hiç başlamamıştık.**
  - ✅ **3.9.2** **GÖÇ 0093 YAZILDI (25.10) · prova 21/21**
    İsmet'in cevabı beklediğim **asıl** soruyu kapattı: numune **sevkiyata
    değil, ÜRETİM PARTİSİNE** bağlı. Aynı partiden beş müşteriye gidiyorsa
    **bir** numune var.
    Veritabanında zorlanan kurallar: numune partiye bağlı; saklama sonu
    partinin SKT'sinden **türetiliyor** (ekranın yazdığı yok sayılıyor);
    SKT'siz partiden numune alınamıyor; saklama koşulu **ürün kartından
    kopyalanıyor**; koşulu tanımsız üründen numune alınamıyor; imza
    sunucuda; numune **silinemiyor ve değiştirilemiyor** (durum olay
    defterinden türetiliyor); açılış ve imha **gerekçe istiyor**; olay
    kaydı değişmez (iki savunma hattı); aynı partide tek açık numune ama
    imhadan sonra yeniden alınabiliyor; her şey denetime düşüyor.
    Kapı: `quality.record.manage` **veya** `production.write` (Emrah:
    *"her ikisine de bağla, ortak bir iş"*). ⚠️ Depocu "kontrolünde" —
    bu fiziksel sorumluluk, sistem izni değil; prova depo sorumlusunun
    numune ALAMADIĞINI ayrıca sınıyor.
    İki olumsuz deneme: türetme tetiği düşürülünce prova 4. sınamada,
    yetki kapısı düşürülünce 3. sınamada kırmızı döndü.
  - ⬜ **3.9.3** ⚠️ **ETİKET EKRANI SAKLAMA KOŞULUNU ÜRÜN KARTINDAN
    OKUMALI.** Bu göçün ortaya çıkardığı eksik: saklama koşulu hiçbir yerde
    **saklanmıyordu** — etiket ekranında her baskıda **elle yazılan**
    serbest bir metin alanıydı (yer tutucu `0–4 °C`). Yani aynı ürün iki
    baskıda iki farklı koşul taşıyabiliyordu. Koşul artık ürün kartında
    (`stock_item.storage_condition`); **etiket de oradan okumalı**, yoksa
    iki ayrı doğru olur ve *"numune müşteriye söylenenin aynısında durur"*
    kuralı yine çöker.
  - ✅ **3.9.5** **Yedek defterine eklendi.** `tenant-export.arch.test.ts`
    her kiracı tablosunun ya yedekte ya **gerekçeli** dışarıda olmasını
    zorunlu kılıyor; iki yeni tablo yazılmayınca test kırmızı verdi ve
    **doğru yakaladı.** `witness_sample` ve `witness_sample_event` yedeğe
    eklendi — numune partiden SONRA, olay defteri numuneden SONRA (geri
    yüklemede ebeveyn önce gelmeli).
  - ⬜ **3.9.4** **Şahit numune EKRANI** · numune alma, listeleme (süresi
    yaklaşanlar), açılış kaydı, imha kaydı. Veritabanı hazır.
  - 🔄 **3.9.1** **Şahit numune** · Emrah anlattı (20.10), tasarım kararı
    `docs/kararlar/sahit-numune.md`'ye yazıldı. Çıkan üç kural:
    **(1)** Saklama süresi sabit DEĞİL — kapalı üründe **SKT**, açılmışta
    **açık kalma süresi**. "72 saat" gibi tek sayı yazılmaz.
    **(2)** Saklama koşulu **müşteriye bildirilenin birebir aynısı**
    (-18/+4) ve **aynı alandan** gelir; ayrı tutulursa bir gün ayrışır.
    **(3)** Numunenin amacı bir tartışmayı çözmek → **lota ve sevkiyata**
    bağlı olmalı, ürün adına değil.
    ⚠️ Beş açık soru var → `docs/kararlar/ismete-sorulacaklar.md` **A1–A5**.
    **Cevaplar gelmeden göç yazılmayacak** — yazılırsa yine "mış gibi" olur.
- ⬜ **3.8** **MOCK DOSYALARI SİLİNECEK · 36 dosya** (Emrah, 20.10:
  *"tüm mock verileri yok etmiş olduğuna emin ol"* ve *"asla ve asla
  yapamadığımız bir modülü, fonksiyonu MİYOP'ta tutmayalım"*)
  Bugünkü durum dürüstçe: `mock-rota-sizintisi.arch.test.ts` **açık kiracı
  rotalarından hiçbirinin** mock'a ulaşmadığını kanıtlıyor — ama dosyalar
  **duruyor** ve `foundationScope: 'frozen'` ile kapatılmış modüller de
  duruyor. "Erişilemez" ile "yok" aynı şey değildir.
  - ⬜ **3.8.1** 36 mock dosyasını tek tek tara: kim import ediyor?
  - ⬜ **3.8.2** Yalnız donmuş modüllerin kullandıkları → dosyalarıyla
    birlikte SİL (modül kaydı, rota, sayfa, tip, mock)
  - ⬜ **3.8.3** Çalışan bir ekranın kullandığı mock varsa → o ekran ya
    gerçek veriye bağlanır ya kaldırılır; mock'la yaşamaz
  - ⬜ **3.8.4** Silme sonrası `npm test` + `npm run build` yeşil olmalı
  - ⬜ **3.8.6** Emrah'ın kararı (20.10): *"sil ama ne işe yaradığını bil
    ve sonradan yapılacağını unutma."* → Silmeden ÖNCE
    `docs/kararlar/kaldirilan-moduller.md` yazılır: her modülün ne işe
    yaradığı, neden kaldırıldığı, gerçekten yapılacaksa hangi hedefe
    bağlandığı. **Kod gider, karar kalır.**
  - ✅ **3.8.5** **Codex taradı (21.10) ve korktuğum çıktı.** Soru şuydu:
    *"depoda mock/uydurma veri üreten başka ne var — adı `.mock`
    olmayanlar dâhil?"* Cevap: **27 tane `createDemo*` üreticisi**, hiçbiri
    `.mock` adında değil. Dökümü ve ölçümü 3.10'da.
  - ⬜ **3.8.7** **Mevcut testin kapsamı iddiadan DAR.**
    `mock-rota-sizintisi.arch.test.ts:114` yalnız iki imzayı suç sayıyor:
    `*.mock.ts(x)` dosyası ve `SEED…COUNT` + `localStorage.setItem` deseni.
    `createDemo*` üreticileri bu imzaya uymuyor, portal da kiracı rota
    taramasının dışında. Yani test *"depoda mock dosyası yok"* diyebilir,
    *"uydurma veri yok"* **diyemez** — ama biz ikincisini anlamıştık.
    ⚠️ Tuzak 107. Yapılacak: testin kapsamını `createDemo*` üreticilerini
    ve portalı içine alacak şekilde genişlet; genişletmeden önce
    **olumsuz deneme** yap (bir üreticiyi açık bir ekrana bağla, test
    kırmızı olsun).
- ⬜ **3.10** **SAHTE VERİ ÜRETİCİ YÜZEYİ · ÖLÇÜLDÜ (21.10)**
  Codex'in bulgusunu **doğruladım** (dosya-satır okuyarak, iddiaya
  güvenmeden) ve sonra yüzeyin tamamını saydım:
  **27 `createDemo*` üreticisi** var. Çoğu "depo boşsa demo üret" dalından
  geçiyor. Hangi ekrana ulaştığı ÖNEMLİ olan:
  - ✅ **3.10.1** **KAYNAK TEMİZLENDİ (25.10) · dört üretici silindi**
    · `createDemoBranches` — dört uydurma şube (Merkez/İstanbul/Ankara/
      İzmir, uydurma telefon-adres-müdür adı). **SİLİNDİ.**
    · `createDemoCompanies` — üç uydurma firma (ABC Cafe · Ahmet Kaya,
      Örnek İşletme · Mehmet Demir, Kahve Durağı · Ayşe Yılmaz) uydurma
      vergi numarası ve adresle. **SİLİNDİ.**
    · `createDemoData` — **117 satır.** Depodaki en büyük sahte veri
      kaynağı: "Adana Kebap", "Tavuk Şiş", "Kola", "Çay", "Baklava", altı
      masa ve **24 üreticinin tamamını** `localStorage`a yazıyordu.
      ⚠️ Ölçüm: `src` içinde bu fonksiyonu **çağıran tek bir yer yoktu** —
      ölü koddu ama `export` olduğu için her an çağrılabilirdi. **SİLİNDİ.**
    · `createDemoAnnouncements` — 25.10'da zaten silinmişti (3.10.2).
    **Okuyucular:** `readBranchesFromStorage` ve `loadCompanies` artık boş
    veriyi **boş bırakıyor.**
    **Köprü de onarıldı:** `company-bridge` eskiden yerel listenin tamamını
    koruyup üstüne veritabanı satırlarını yazıyordu — yani veritabanında
    karşılığı olmayan demo şubeleri **her girişte geri kaydediyordu.**
    Artık bu firmanın şubeleri için **yetkili kaynak veritabanı**: eski demo
    kalıntıları ilk girişte kendiliğinden temizleniyor, ayrı temizlik
    betiği gerekmiyor. ⚠️ Başka firmaların yerel satırlarına dokunulmuyor —
    dokunmak MIYOP-063'ü burada tekrarlamak olurdu.
    **Donduran test:** `src/modules/sahte-veri-ureticisi.arch.test.ts` ·
    üretici sayısını 23'te donduruyor, silinen dördünün geri gelmesini ve
    okuyucuların demo dalına düşmesini yasaklıyor. Olumsuz deneme yapıldı.
  - ✅ **3.10.9** **MIYOP-058 · ÜÇÜNCÜ YARI · arşivlenmiş demo firma**
    (Codex, 25.10). Temizlik `saveCompanies` üzerinden gidiyordu; o
    fonksiyon **arşivlenmiş** kayıtları (`deletedAt` dolu olanları)
    bilerek koruyor — gerçek bir firma silinse de geçmişi kaybolmasın
    diye. Doğru bir kural ama burada **ters etki** yapıyordu: arşivlenmiş
    bir demo firma her temizlikte **geri geliyordu.**
    Yapılan: `kimligeGoreFirmaSil()` — yalnız kimliği verilen kayıtları
    silen, arşiv korumasını **bilerek** aşan ayrı bir fonksiyon.
    ⚠️ Desene göre silmiyor; çağıran hangi kayıtları sildiğini tek tek
    bilmek zorunda.
    ⚠️ Ders: *bir temizlik, kendi kullandığı yazma fonksiyonunun
    kurallarına tâbidir.* "Sildim" demeden önce yazanın ne yaptığını oku.
  - ✅ **3.10.7** **ESKİ DEMO KALINTILARI TEMİZLENİYOR (MIYOP-058 · ikinci
    yarı).** ⚠️ **İlk onarımım yetmedi, Codex haklıydı:** üreticileri
    silmek yalnız YENİ üretimi durdurdu; Emrah'ın ve demo kurulumların
    tarayıcısında o satırlar **zaten yazılıydı.** Köprüye koyduğum "bu
    firmaya ait olmayan şubeleri koru" kuralı onları **koruyordu**, çünkü
    demo şubelerin firma kimliği uydurma bir demo firmaydı — yani "başka
    firma" sayılıyorlardı.
    Yapılan: **kimliği bilinen** demo kayıtları (`branch_merkez`,
    `branch_istanbul`, `branch_ankara`, `branch_izmir` ve üç demo firma)
    her girişte siliniyor. ⚠️ Liste **kapalı ve sabit**; desene göre silmek
    (`_demo` ile bitenler) tehlikeli olurdu — gerçek bir firma kendi
    kaydına o adı verebilir.
    Ayrıca köprü, veritabanı bu firma için **boş cevap** verdiğinde erken
    dönüp temizliği atlıyordu; o da düzeltildi (Codex).
  - ✅ **3.10.8** **MIYOP-073 · çıcır testi `export const`u kaçırıyordu**
    (Codex). Desen yalnız `^const createDemo…` arıyordu; silinen en büyük
    üretici ise `export const createDemoData` biçimindeydi — yani "geri
    gelmemiş" kontrolü, geri gelen **en tehlikeli** fonksiyonu
    yakalayamazdı. Desen düzeltildi ve yasak ad kontrolü **sayımdan
    bağımsız** hâle getirildi: iki ölçüm birbirine dayanırsa, birinin kör
    noktası ötekinin de kör noktası olur.
  - ⬜ **3.10.4** **Kalan 23 üretici** · personel, cari, finans, başvuru,
    lisans ve platform üreticileri. ⚠️ `createDemoData` silindiği için
    hiçbiri artık toplu tohumlamaya girmiyor; her biri yalnız kendi
    okuyucusundan erişilebilir. Hangisinin AÇIK bir ekrana ulaştığı
    3.10.3'te **izlenerek** ayrılacak.
  - 🗑️ **3.10.1-eski** (aşağıdaki not tarihsel kayıt olarak kalıyor)
    ⚠️ **25.10 notu (tuzak 111):** şube ekranları kapandı ama
    **üretici DURUYOR.** `company-bridge` demo şubeleri hâlâ
    kalıcılaştırıyor ve `loadCompanies()` hâlâ demo firma üretiyor —
    Firma Profili ekranı onu okuyor. Yüzey kapanışı, kaynak kapanışı
    değildir. Bu madde **açık.**
    Dört açık ekran bu ikisinden besleniyor. `readBranchesFromStorage`
    (storage.ts:478) demo şube üretiyor; `loadCompanies` (storage.ts:4393)
    demo firma üretiyor. ⚠️ **Firma Profili'nden ÖNCE bu iki fonksiyon
    temizlenecek** (tuzak 108): boş veri **boş kalacak.**
    Ayrıca `company-bridge.ts:89` demo satırları koruyarak geri kaydettiği
    için geçmişte yazılmış `branch_merkez/istanbul/ankara/izmir`
    kayıtlarını **kimliğiyle** temizleyen bir adım gerekiyor.
    Kabul: temiz tarayıcı + tek gerçek şube → listede yalnız o şube;
    boş DB → sıfır şube; açılıştan sonra demo kimlikleri **üretilmeyecek.**
  - ✅ **3.10.5** **MIYOP-071 · KAPANDI · kendi kırdığım tip hatası.**
    `loadSystemAnnouncements`in imzasını değiştirdim (bağlam parametresi
    gereksiz kaldı) ve kalan bir çağrıyı kaçırdım:
    `mobile-integration/mobile-integration.service.ts:604`. Codex yakaladı.
    ⚠️ **Sebebi öğretici:** çağrı yerlerini aradığımda **depoda değil, benim
    yerel kopyamda** aradım — ve o kopya eksikti (241 dosya; gerçek `src`
    çok daha büyük, `mobile-integration` klasörü kopyada hiç yoktu).
    Yani "başka çağrı yok" sonucuna **eksik bir evrende** vardım (tuzak 112).
  - ✅ **3.10.6** **MIYOP-072 · KAPANDI · bir mutlak cümleyi başka bir
    mutlak cümleyle değiştirmişim.** Vitrindeki uydurma vaatleri silerken
    yerine şunları yazmıştım: *"aynı hesapla her cihazdan aynı kayda
    ulaşırsınız"* ve *"her değişiklik denetim kaydına düşer"*. İkisi de
    **operasyon kayıtları için doğru**, ama Firma Profili ve İşletme
    Ayarları ekranları bugün hâlâ tarayıcıya yazıyor — onların verisi
    cihazda kalıyor ve hiçbir denetim kaydına girmiyor. Cümleler
    daraltıldı: hangi kayıtların sunucuda durduğu ve hangi değişikliklerin
    iz bıraktığı **sayılarak** yazıldı. Ayrıca portal tanıtım cümlesinden
    *"duyuru"* kelimesi çıkarıldı — bölüm kaldırıldı, yetenek sayılamaz.
    ⚠️ Tuzak 113: *bir yalanı düzeltirken yerine koyduğun cümleyi de ölç.*
  - ✅ **3.10.2** **MIYOP-059 · KAPANDI (25.10).**
    `notification.service.ts:235` kayıt yokken `createDemoAnnouncements()`
    döndürüyor: *"Planlı bakım bildirimi · Pazar gecesi kısa süreli bakım
    penceresi"* (başlangıç = bugün+2) ve *"Lisans yenileme hatırlatması"*.
    `Login.tsx:136` bunu alıyor, **436** Duyurular bölümünde başlık/içerik/
    tarihle basıyor. Tarihler her açılışta yeniden üretiliyor.
    ⚠️ Bu, **müşterinin gördüğü ilk ekranda**, bizim vermediğimiz bir
    bakım taahhüdü. Emrah'ın kuralı burada en keskin hâliyle geçerli.
    **Yapılan:** `createDemoAnnouncements` **silindi**; vitrindeki
    Duyurular bölümü **tamamen kaldırıldı**. Bölümü boş bırakmadım çünkü
    duyuru yazma ekranı (`evren360-system-announcements`) platform
    panelinde `veriKaynagi: 'hazirlaniyor'` ile kapalı ve duyurular yalnız
    tarayıcıya yazılıyor — yani Emrah bir duyuru yazsa **hiçbir müşteriye
    ulaşmazdı.** Kalıcı boş bir bölüm de "burada bir şey olacak" demektir.
    **Yan kazanç (küçük değil):** duyuru bağlamı giriş ekranından
    `loadCompanies()` ve `loadLicensePackages()` çağırıyordu — yani
    müşterinin gördüğü ilk ekran, depo boşken **demo firma ve demo lisans
    paketi üreten** iki fonksiyonu tetikliyordu. Giriş ekranı artık
    `../storage`a **hiç dokunmuyor**; testle donduruldu.
    Geri gelmesi için: `system_announcement` tablosu + yayınlama akışı.
    → `docs/kararlar/kaldirilan-moduller.md` bölüm 2
  - ⬜ **3.10.3** **Kalan 24 üretici · sınıflandırılacak.** Personel, cari,
    finans, başvuru, lisans ve platform üreticileri donmuş modüllerde
    duruyor gibi görünüyor — **"gibi görünüyor" yetmez.** Her üretici için
    tek satır yazılacak: hangi okuyucudan geçiyor, o okuyucu hangi
    rotadan çağrılıyor, o rota AÇIK mı. Açık olan her biri 3.10.1'in
    kuralına girer. ⚠️ Donmuş modülün üreticisi bile raporlardan
    okunabiliyor olabilir; sayarak değil **izleyerek** karar verilecek.
- ⬜ **3.11** **Karşılama ekranı (`workspace-welcome`) · MIYOP-065**
  "Kaydet"i yok, o yüzden *"kaydedildi deyip tarayıcıya yazan"* ekran
  değil — ama başka bir *mış gibi* var: `WorkspaceWelcome.tsx:67`
  **"İlk stok kartı tamamlandı"** rozetini `hasBusinessModules` ile
  ölçüyor. Bir modül kaydının varlığı, stok kartı olduğunu kanıtlamaz.
  Ayrıca rehberdeki bazı düğmeler **donmuş** rotalara (`recipes`,
  `products`) ve artık olmayan "widget ekle" adımına gidiyor.
  Yapılacak: tamamlanma **gerçek stok sorgusundan** ölçülecek ya da rozet
  kaldırılacak; her görünür düğme yetkili kullanıcıyı **çalışan** ekrana
  götürecek.
- ✅ **3.12** **MIYOP-067 · DONMUŞ MODÜL PUBLIC YOLDAN AÇILIYORDU · kapatıldı**
  Codex buldu (21.10) ve doğruladım: `App.tsx` `/qr/<id>` yolunu yakalayıp
  `QRMenu` ekranını **doğrudan** döndürüyordu. `business-qr-menu` modülü
  `foundationScope: 'frozen'` (registry:820) olmasına rağmen sayfa
  açılıyordu — çünkü donmuş rota kapısı `BusinessWorkspaceRouteHost`ta ve
  bu dönüş **o kapının dışındaydı.** Üstelik ekran
  *"Görevli çağrınız iletildi"* ve *"Talebiniz görevli onayına gönderildi"*
  diyordu; yazım yalnız `localStorage`a gidiyordu, sunucuya hiçbir şey
  iletilmiyordu. Emrah'ın kuralı burada çifte ihlâl: hem *mış gibi*, hem de
  *"yapamadığımız bir modülü MİYOP'ta tutmayalım."*
  ⚠️ Ben daha önce *"donmuş modüller rota kesmesiyle kapalı"* demiştim —
  **eksikti:** public yolları saymamıştım. Codex kendi değerlendirmesini de
  düzeltti; ikimiz de aynı kör noktada durmuşuz (tuzak 109).
  Yapıldı: yol kaldırıldı, `QRMenu` içe aktarması silindi, gerekçe dosyanın
  içine yazıldı. Donduran test **yüzeyi ölçüyor**, tek örneği değil:
  `App.tsx`teki her `pathname.match` eşleşmesi `BILINEN_PUBLIC_YOLLAR`
  listesinde olmak zorunda (bugün ikisi: başvuru formu ve müşteri portalı).
  Yeni bir public yol eklemek serbest, **sessizce** eklemek değil.
  ⚠️ `src/pages/QRMenu.tsx` **diskte duruyor** — silme işi 3.8'de,
  `kaldirilan-moduller.md` yazıldıktan sonra.
- ⬜ **3.6** **MIYOP-008** · Başlıkta seçilen şube gerçek sorgulara
  aktarılmıyor. B şubesi seçiliyken kayıt A'ya yazılabiliyor.
  - ⬜ **3.6.1** **Kapsam ölçüldü (Codex, 21.10): iki bağımsız şube
    kaynağı var.** Başlık `ra_active_branch` (tarayıcı) okuyor;
    iş ekranları `branch` tablosunu okuyor ve tercih verilmezse
    (`warehouse.context.ts:131`) **ilk şubeye** düşüyor.
    `depoBaglamiKur` fonksiyonunu **17 sayfa** tercih edilen şubeyi
    VERMEDEN çağırıyor (Depo, Etiketler, Satın Alma, Siparişler, Üretim,
    Sevkiyat, Sayım, HACCP ve raporlar). Yazımlar `branch_id: ctx.branchId`
    kullanıyor — yani yanlış bağlam **yanlış şubeye kayıt** demek.
    `App.tsx:1189` şube değişince ekranı yeniden kuruyor ama yeniden
    kurulan ekran yine tercihsiz bağlam yapıyor; o yüzden yetmiyor.
  - ⬜ **3.6.3** **⚠️ BAĞLAMI DÜZELTMEK YETMEZ** (Codex, 21.10 ikinci tur):
    bazı liste sorguları bağlamı **alıp kullanmıyor** —
    `async hepsi(_ctx: TenantCtx)` imzası `branch_id` süzgeci olmadan
    sorgu atıyor. Yerleri: `production/work-order.repository.ts:186`,
    `production/shipment.repository.ts:259`,
    `warehouse/stock-count.repository.ts:191`,
    `sales/sales-order.repository.ts:399` ve satın alma talep/sipariş
    listeleri. Yani şube seçimi bağlama geçirilse bile bu listeler **tüm
    şubeleri** döndürmeye devam eder. Düzeltme iki parçalı: (a) seçimi
    bağlama geçir, (b) **belge listelerinde şube kapsamını açıkça uygula**
    — ya da ekranda "tüm şubeler" olduğunu **yaz.**
  - ⬜ **3.6.2** Kabul kriterleri (Codex'in önerisi, kabul edildi):
    **17 ekranın tamamında** başlık seçimi = okuma bağlamı = yazılan
    `branch_id`; geçersiz/pasif/erişilemeyen seçimde **sessizce** başka
    şubeye yazılmayacak; B'ye geçildiğinde A'nın bekleyen isteği B
    ekranına sonuç/mesaj bırakmayacak; **ters stok hareketi** gibi tarihî
    belgeye bağlı işlemler kendi özgün şubesini koruyacak
    (`original.branchId` körlemesine aktif şubeye çevrilmeyecek);
    sevkiyatın **hedef şubesi** gibi belge alanları işlemin kaynak
    şubesiyle karıştırılmayacak.
- ⬜ **3.7** **MIYOP-010** · Etiket ekranında ürünler arası veri karışması
  - ⬜ **3.7.1** **MIYOP-064 · aynı kusur beş ekran daha** (Codex, 21.10):
    Depo, Siparişler, Müşteriler, İş Emirleri, Sevkiyatlar. Desen aynı:
    seçim **hemen** değişiyor, ayrıntılar isteklerin tamamı dönünce
    yazılıyor, istek düşerse **eski kaydın ayrıntısı ekranda kalıyor** ve
    yeni kaydın kimliğiyle kaydedilebiliyor/yazdırılabiliyor.
    ⚠️ Yalnız Etiketler'e yama atmak bu aileyi kapatmaz (tuzak 104'ün
    kardeşi). Çözüm ortak: ayrıntıyı **seçili kayıt kimliği + istek
    sürümü** ile tut, seçimde eskisini temizle, ayrıntı hazır olmadan
    yazma/yazdırma düğmelerini kapat.
  - ⬜ **3.7.2** `Traceability.tsx:153–193` eski ayrıntıyı temizliyor ama
    **geç gelen cevap** koruması yok. Hızlı A→B seçimi sınanacak.

---

## 4 · PLATFORM PANELİ (EVREN360)

- ✅ **4.1** Menü ayrıldı · platform sahibi kiracı menülerini görmüyor
- ✅ **4.2** Panel 19 düz ögeden 3 gruba indi; 11 eş menü gizlendi
- ✅ **4.3** Veritabanı okumayan ekranlar görünür ama kilitli, gerekçeli
- ✅ **4.4** Platform okuma kapıları (göç 0083) · 5 fonksiyon, prova 90/90
- ✅ **4.5** Müşteri Listesi gerçek veriyle · arama + 5 süzgeç
- ✅ **4.6** Müşteri Detayı · 20 maddelik liste, cevapsızlar gerekçeli
- ✅ **4.7** Müşteri kartından lisans uzatma
- ⬜ **4.8** **Ödeme takibi ve pasife alma** (Emrah kararı 17.10.2026)
  - Sistem ödemeyeni **asla otomatik kapatmaz.** 3 ay kullanmaya devam
    edebilir — hem samimiyet hem veri birikimi hem bağlılık.
  - ⬜ **4.8.1** Ödemeyeni/geciktireni görme ekranı
  - ⬜ **4.8.2** Tek düğmeyle pasife alma (platform sahibi kararıyla)
  - ⬜ **4.8.3** Taahhüt alanı: ay süresi + bitiş tarihi. Cayma bedeli
    YOK (Emrah: "önce bir ilk müşteriyi bulalım").
  - ⬜ **4.8.4** Ödeme planı ve borç tablosu (5.2, 5.3 sorularının deposu)
  - ⬜ **4.8.5** Şirkete özel yönetici notu (5.4)
- ✅ **4.8.6** **Zildeki lisans satırı artık bir yere götürüyor.**
  Emrah: *"önceden bildirim gelince tıklardım, ilgili sayfaya
  yönlendirirdi; şimdi öyle olmuyor."* Sebep: yönlendirme yalnız
  `business_application` türünü ele alıyordu; zildeki satırların çoğu
  `license_expiry` ve onlar sessizce hiçbir şey yapmıyordu. Tıklanabilir
  görünüp hiçbir şey yapmayan satır **"mış gibi yapan" bir şeydir.**
  Lisans satırının `targetId`si kiracı kimliği → Müşteri Detayı ekranı.
  `src/notifications/zil-yonlendirme.arch.test.ts` bunu donduruyor.
  - ⬜ **4.8.7** `support_request` satırının gideceği ekran (Destek
    Talepleri) hâlâ kilitli. Uydurma rota KOYMADIM; ekran açılınca
    yönlendirme de eklenecek.
- ⬜ **4.9** Kontrol Paneli gerçek sayaçlarla
- ⬜ **4.10** **MIYOP-028** · Pasif lisansın gerçek durumu görünmüyor
  `lisansiOku` yalnız Deneme/Aktif getiriyor; Süresi Doldu/Askıda/İptal
  için `null` dönüyor ve ekran "kayıt görünmüyor" diyor.

---

## 5 · PRESTİJ · "En iyi şekilde karşılarına çıkalım"

Emrah: *"Demoya çok takılma, işleri bitir, prestiji sağla, hazırım de
gidelim yapalım demomuzu."* Demo ileri tarihe atılabilir.

⚠️ Bu başlık **1 ve 2 bittikten sonra** başlar. Salt okunur bir kullanıcının
deftere yazabildiği bir sistemin üstüne sohbet penceresi koymak yüzeyi
büyütür, değeri büyütmez.

- ⬜ **5.1** **Yardım Merkezi** (SSS)
  ⚠️ Satış dilinde "yapay zeka" DENMEYECEK. Teknik başlık: kural motoru.
  - ⬜ **5.1.1** Uygulama içinde SSS bölümü
  - ⬜ **5.1.2** Soru-cevap penceresi — müşteri her şeyde aramasın
- ⬜ **5.2** **Geri bildirim düğmesi** (Microsoft modeli)
  Övgü · Sorun bildir · Öneride bulun
  - ⬜ **5.2.1** Yalnız en yetkili kullanıcı gönderebilsin
  - ⬜ **5.2.2** Geri bildirim verene küçük bir karşılık (ör. lisansa
    birkaç gün). Yapılamazsa düğme yine konur.
- ⬜ **5.3** **Sohbet modülü** · herkes okur, müdürün yetkilendirdiği yazar
  - ⬜ **5.3.1** Yeni izin: `chat.write`
- ⬜ **5.4** **MİYOP ana sayfası** · SSS + "ne olduğumuzu anlatan" metin
  - ⬜ **5.4.1** Alt bilgi (footer) bilgilendirme sayfaları
- ⬜ **5.5** **Toplu duyuru** · platform sahibinden müşterilere
  Tipler ve hedef seçenekleri zaten tanımlı (`notification.types.ts`) ama
  depo tarayıcıda ve kiracı tarafında zil hiç çalışmıyor.
  (Emrah: "demodan sonra, acelesi yok")

---

## 6 · İŞLETME · Altyapı ve süreç

- ✅ **6.1** Hetzner sunucu + alan adı + SSL · `miyop.emrahevren.com`
- ✅ **6.2** Dağıtım betiği · test kırmızıysa yayın yok
- ✅ **6.3** Yedek betiği + sürüm defteri
- ✅ **6.4** Lisans uyarısı Kontrol Paneli'nde (7 günde kritik)
- ⬜ **6.5** **Supabase Pro** · ilk müşteri anlaşmasından sonra (25 $/ay)
  ⚠️ Şu an ücretsiz planda **hiç veritabanı yedeği yok.** Emrah bunu
  bilerek kabul etti: *"kalsın, müşteri görsün uyarıyı verdiğimizi."*
- ⬜ **6.6** **MIYOP-020** · Geri yükleme provası hatayı başarısızlık saymıyor
- ⬜ **6.7** **MIYOP-026** · Yayın kapısı veritabanı davranışını sınamıyor
- ⬜ **6.8** **MIYOP-030** · README güncel mimariyi anlatmıyor
- ⬜ **6.9** Oturum kilidi 45 → 30 dakika
- ⬜ **6.10** Etiket yazdırma · 58 mm ve 100×150 mm seçeneği
- ⬜ **6.12** **Provalar depoya girdi, 14'ü kırık**
  - ✅ **6.12.1** ⚠️ **Provalar depoda değildi.** 0083–0088 dışındaki 30
    dosya yalnız Claude'un çalışma ortamındaydı: kanıt vardı ama kimse
    göremiyordu, sürümler arasında karşılaştırılamıyordu, Codex
    denetleyemiyordu. Codex sorunca ortaya çıktı. Hepsi `db/prova/`
    altına kondu + `kur.sh`, `hepsini-kosturt.sh`, `README.md`.
    → tuzak 91.
  - ✅ **6.12.2** ⚠️ **"11 / 50" demiştim; doğrusu 14 / 36.** Hem payda
    hem pay yanlıştı. Pay yanlıştı çünkü ilk sayaç betiğim yalnız
    `✗`/`ERROR` arıyordu; eski provalar başarısızlığı
    `raise notice '❌ ...'` ile bildirir — NOTICE'tır, ERROR değildir.
    Betik ayrıca PostgreSQL kapalıyken 36 dosyanın hepsini YEŞİL
    saymıştı. → tuzak 92.
  - ✅ **6.12.3** Codex 14 kırmızıyı kaynaktan ayırdı: **10'u bayat
    kurulum/beklenti, 3'ü çalıştırıcının yanlış kırmızısı, 1'i
    tamamlanmamış negatif prova.** Hiçbirinden ürün gerilemesi çıkmadı.
  - ✅ **6.12.6** **MIYOP-041** · çalıştırıcı `✅`/"TAMAM"/"GEÇTİ" basan
    provaları "sessiz" sayıp haksız yere kırmızı veriyordu. Düzeltildi.
    Güncel ölçüm: **37 dosya · 26 yeşil · 11 kırmızı**, 11'inin hepsi
    Codex'in bayat dediği dosyalar. ⚠️ Ölçüm aracının yanlış kırmızısı,
    yanlış yeşili kadar zarar verir: insan ona bakmayı bırakır.
  - ✅ **6.12.7** **MIYOP-042** · 13 prova oturum kuruyor ama istemci
    rolünü takmıyor → 0089'dan sonra kapının dışında koşuyorlar.
    Liste `yazma-kapilari-tamam.arch.test.ts` içinde DONDURULDU; yalnız
    kısalabilir. Portal provaları (0054, 0063) bu yüzden MIYOP-039'u
    yakalayamamıştı.
  - ⬜ **6.12.8** 13 kör provaya gerçek rol taktır (önce portal: 0054, 0063)
  - ✅ **6.12.10** **MIYOP-054** · ⚠️ **MIYOP-048'i onarırken yenisini
    yaptım.** Betiğin başında `set -e` var; `CIKTI=$(...)` ataması
    başarısız olunca betik oracıkta sonlanıyor ve **"hatayı göster" diye
    yazdığım satırlara hiç gelinmiyordu.** Çağrı `if`in koşuluna alındı
    (`set -e` koşulda değerlendirilen komutu sonlandırmaz). Bilerek bozuk
    bir göçle denendi: hata artık görünüyor ve betik duruyor.
  - ✅ **6.12.9** **MIYOP-048** · `kur.sh` hatayı göstermek için göçü
    İKİNCİ KEZ çalıştırıyordu; ikinci koşu birincinin kalıcı
    değişikliklerinin üstüne biniyor ve gösterilen hata ilk hatadan
    farklı olabiliyordu. **Arıza raporunun kendisi arızayı değiştiriyordu.**
    Artık ilk çağrının çıktısı saklanıp gösteriliyor.
  - ⬜ **6.12.4** 11 bayat dosyayı güncelle (Codex'in satır satır gerekçesi
    `docs/kararlar/codex-denetimi-ekim-2026.md` içinde)
  - ⬜ **6.12.5** `hepsini-kosturt.sh`i **yayın kapısına** ekle (6.7 ile
    birlikte). Bu bitene kadar doğru cümle şudur: *"provaları elle
    koşturdum, 22'si geçiyor"* — *"provalar geçiyor"* değil.
- ⬜ **6.18** **Göçlerin tekrar çalıştırılabilirliği ÖLÇÜLMEMİŞTİ**
  Teslim kontrol listesi 2026 boyunca *"göçü İKİ KEZ çalıştır"* diyordu
  ama bunu hiç ölçmemiştim. Ölçtüm: **90 göçün 9'u ikinci koşuda
  patlıyor** — 0004, 0033, 0034, 0038, 0042, 0043, 0051, 0054, 0082.
  (0084 ve 0089 da patlıyordu; ikisi onarıldı.) → tuzak 95.
  ⚠️ Temiz kurulumda sorun YOK (her göç bir kez koşar). Risk, canlıda
  yarıda kalan bir göçü tekrar denemek gerektiğinde ortaya çıkar.
  - ✅ **6.18.1a** **0042'nin tehlikeli kısmı kapandı** (MIYOP-046, yukarıda
    1.3.13). Kalan hatası zararsız: "function is not unique".
  - ⬜ **6.18.1** **MIYOP-047 · P1** · 0033/0034/0038 hata vermeden ÖNCE
    kaldırılmış imzaları geri oluşturuyor (imzasız `COMMENT` patlıyor, ama
    `create or replace` çoktan işlemiş olabiliyor). Eski başvuru yolu
    ticari unvan kuralını zorlamaz. Çözüm: `COMMENT`lerde tam imza.
  - ⬜ **6.18.1b** Kalan 6 göç (0043, 0051, 0054, 0082, 0004 ve 0033/34/38
    sonrası) tekrar çalıştırılabilir yapılacak · Codex'in risk sırası:
    0043 > 0033 > 0038 > 0034 > 0082 > 0054 > 0051 > 0004
  - ⬜ **6.18.2** `kur.sh`e "her göçü iki kez koştur" seçeneği ekle ki
    iddia ölçülmeden kalmasın
- ⬜ **6.13** **Hacim ölçümü** · stok bakiyesi defterden TÜRETİLİYOR.
  On binlerce satırda ekranlar yavaşlar. Çözüm biliniyor (özet tablo +
  indeks) ama **önce ölçülecek.** (BİTMİŞ-ÜRÜN · D1)
- ⬜ **6.14** **Eşzamanlılık ölçümü** · iki kullanıcı aynı lota/siparişe
  aynı anda. Idempotency anahtarı var, çok kullanıcılı sınama yok. (D2)
- ⬜ **6.15** **Tablet ve telefon** · ekranlar masaüstü odaklı; depoda
  insanlar masa başında değil. Mal kabul ve sayım elde yapılır. (D3)
- ⬜ **6.16** **Gerçek yazıcı** · etiket (58 mm, 100×150 mm) ve irsaliye
  hiç termal/lazer yazıcıda denenmedi. Donanım gerekiyor. (D4 · 6.10)
- ⬜ **6.17** **Canlıda göç prosedürü yazılı değil** · yedek → göç →
  doğrula → geri dönüş planı. Müşteri çalışırken göç çalıştırma. (D5)
- ⬜ **6.11** `g7_rls_kapat.sql` · RLS'i kapatan dosya `db/migrations` içinde
  duruyor; yanlışlıkla çalıştırılabilir

---

## 7 · ÇALIŞMA DÜZENİ

- ✅ **7.1** Codex = denetçi, Claude = uygulayıcı. **Aynı anda değil, sırayla.**
  Emrah: *"Senin token bitince ona, onun token bitince sana."*
  Ayrıntı: `claude/codex-ile-calisma-duzeni.md`
- ✅ **7.2** Codex brifi hazır · `docs/codex-brifi.md`
  Karar dosyalarını okutuyor ki bilinçli kararları "hata" sanmasın.
- ✅ **7.7** **İsmet'e sorulacaklar tek listede** (Emrah, 20.10:
  *"ben sana İsmet'leyim dediğimde sen hepsini tek tek getir benim
  önüme."*) → `docs/kararlar/ismete-sorulacaklar.md`.
  ⚠️ Kural: bir ekran/göç yazarken *"bunu bilmiyorum, uydurursam mış gibi
  olur"* dediğim her şey oraya yazılır. Cevap gelince madde silinmez,
  cevabıyla işaretlenir — kararın nereden geldiği kaybolmasın.
  Şu an **16 açık soru** var: 5 şahit numune, 3 yarım ekran, 2 sevkiyat,
  3 etiket/baskı, 3 ölçüm.
- ✅ **7.6** **Sürüm defteri güncel tutuluyor** (Emrah'ın isteği, 20.10).
  `docs/MIYOP-Surum-Defteri.xlsx` · her yayına çıkış bir satır.
  - Yeni durum: **"Veritabanında"** = göç canlı Supabase'e uygulandı ama
    uygulama yeniden dağıtılmadı. Bu fark defterin başında kırmızı uyarı
    olarak duruyor; **defterin varlık sebebi tam olarak bunu yakalamak.**
  - v0.2.1 (0087-0088), v0.2.2 (0089-0090), v0.2.3 (MIYOP-043 1. adım)
    satırları eklendi; bekleyenler listesi 13 maddeye güncellendi.
  - ⚠️ Kural: **her dağıtımdan sonra Claude defteri günceller.** Bir
    yayına çıkış deftere yazılmadıysa, olmamış sayılır.
- ✅ **7.5** **Her turun komutu tek satır oldu.** Çok satırlı PowerShell
  blokları yapıştırılırken yarıda kalıyor, Emrah fazladan Enter'a basmak
  zorunda kalıyordu. Artık: `.\araclar\kaydet.ps1` — testi koşturur,
  kırmızıysa commit yapmaz, mesajı `araclar/commit-mesaji.txt`ten okur,
  panoya kopyalanacak dosyayı `araclar/pano.txt`ten alır.
  - ✅ **7.5.1** ⚠️ İlk sürüm **hiç çalışmadı**: Türkçe harfler ve kutu
    çizgileri içeriyordu, Windows PowerShell 5.1 BOM'suz UTF-8'i ANSI
    sanıp çözüyor ve dosya `Missing closing '}'` ile parse edilemiyordu.
    Betik **sadece ASCII**e çevrildi; Türkçe açıklamalar `docs/` altında.
    → tuzak 99.
- ✅ **7.4** **MIYOP-037** · Provanın kendisi denetlendi.
  `prova-0086.sql` içinde bir blok `exception when others` kullanıyordu ve
  **iddianın kendi hatasını da yutuyordu**: başarısızlık yeşile dönüyordu.
  Düzeltildi (yalnız SQLSTATE toplanıyor, iddia bloğun DIŞINDA).
  Bütün prova dosyaları aynı desen için tarandı — başka örnek yok, ve
  `yazma-kapilari-tamam.arch.test.ts` deseni artık kalıcı olarak yasaklıyor.
  → tuzak 89.
- ✅ **7.3** Alt hedef kuralı: bir işin altından yeni iş çıkarsa ana
  hedefin altına numaralı alt madde açılır (bu dosyanın kendi kuralı).

---

## 8 · İLK MÜŞTERİDEN SONRA · park edildi, unutulmadı

**Emrah'ın kararı (17.10.2026):** *"Evet, ilk müşteriden sonra.
Satılabildiğini görürsek yaparız."*

⚠️ Bu başlık **ertelendi, iptal edilmedi.** `BITMIS-URUN-EKSIKLERI.md`
C.1 ve C.2'nin tamamı buradadır. Bir müşteri anlaşması olduğu gün bu
bölüm 1. sıraya çıkar.

### 8.1 · Para tarafı (C.1) — en büyük boşluk

- ⏸️ **8.1.1** **Fatura kesme paneli** (hiç yok)
- ⏸️ **8.1.2** **Özel entegratör bağlantısı** · e-Fatura / e-Arşiv /
  e-İrsaliye. ⚠️ Devlet portalı değil, entegratör API'si — işin boyutunu
  "proje"den "entegrasyon"a indirir (`claude/muhasebe-ve-e-donusum.md`)
- ⏸️ **8.1.3** **Cari hesap** · müşteri borç/alacak, tahsilat, vade
- ⏸️ **8.1.4** **Muhasebe programına aktarım dosyası**
- ⏸️ **8.1.5** Mali mühür + KEP kurulumu (teknik iş değil, bağımlılık)
- ✅ **8.1.6** **Veri alanları ŞİMDİDEN açıldı** — bilinçli "ucuz sigorta":
  VKN/TCKN, vergi dairesi, resmî unvan, KEP, kalem bazında KDV. Entegrasyon
  ertelenebilir, **veri alanları ertelenemez**: bir yıl canlı veriden
  sonra "müşterilerin vergi numarası yok" demek o yılı elle düzeltmektir.

### 8.2 · Operasyon genişlemesi (C.2)

- ⏸️ **8.2.0** **"NEREYE NE KADAR ÜRÜN GİTTİ?" · teslim noktası raporu**
  Emrah'ın isteği (25.10): *"şube yerine demodan sonra şöyle bir istek
  gelebilir; nereye ne kadar ürün göndermişiz? Belki de adamların bir yemek
  fabrikası var, beş lokantası var. Hangi lokantaya ne kadar ürün gitmiş?
  Hangi ürünler gitmiş, ne zaman?"*
  - ⚠️ **BU ŞUBE DEĞİL, MÜŞTERİ/TESLİM NOKTASI.** Ayrımı yazılı tutuyorum
    çünkü karıştırılırsa tek merkez kararı boşa gider: beş lokanta **bizim
    şubemiz değil**, müşterinin teslim noktaları. Veri modeli de zaten
    böyle duruyor.
  - ✅ **Veri HAZIR, rapor yok.** Ölçüm (25.10): `customer` müşteri
    kartını (0047), `delivery_point` teslim noktalarını, `shipment` +
    `shipment_line` hangi ürünün hangi sevkiyatla gittiğini — ve `shipment`
    **hem `customer_id` hem `delivery_point_id`** taşıyor (0049) —,
    `sales_order` siparişi, `stock_movement.lot_id` hangi partinin
    gittiğini tutuyor. Yani *"hangi lokantaya, ne zaman, hangi ürün, ne
    kadar, hangi parti"* sorusunun cevabı **bugün veritabanında var.**
    Eksik olan okuma ve ekran; **yeni tablo gerekmiyor.**
  - ⏸️ **8.2.0.1** Teslim noktası bazlı sevkiyat özeti: nokta × ürün ×
    dönem. Toplam miktar, sevkiyat sayısı, son teslim tarihi.
  - ⏸️ **8.2.0.2** Ürün bazlı dağılım: bu ürün hangi noktalara gitti.
  - ⏸️ **8.2.0.3** İzlenebilirlik köprüsü: bir parti hangi noktalara gitti
    (geri çağırma senaryosu — ekran var, rapora bağlanacak).
  - ⚠️ Demo öncesi DEĞİL. Emrah *"demodan sonra gelebilir"* dedi; hazır
    olduğunu bilmek yeterli.

- ⏸️ **8.2.1** **Personel / vardiya / puantaj**
- ⏸️ **8.2.2** **Depo raf adresi** · lokasyon yönetimi
- ⏸️ **8.2.3** **PARTİ KAREKODU (QR)** · Emrah'ın fikri, 21.10
  *"mal kabulde ürünün üstüne QR yapıştırılsın, çıkarken aynı QR
  okutulsun... sistemde kaçağı önler diye düşünüyorum."*
  Tasarım kararı yazıldı: **`docs/kararlar/parti-karekodu.md`**
  - ⚠️ **Bu, dondurulmuş `business-qr-menu` modülü DEĞİL.** O masa servisi
    içindi ve 21.10'da public yolu kapatıldı (MIYOP-067). Bu iş depodaki
    fiziksel malın kimliği; sıfırdan ve kendi adıyla yazılır.
  - ⚠️ **"Kaçağı önler" cümlesini düzelttim:** karekod hırsızlığı
    önlemez — malı izinsiz alan okutmaz. Yaptığı şey kayıtsız çıkışı
    **sayımda görünür ve kişiye bağlı bir farka** dönüştürmek, ve
    **yanlış kaydı** önlemek. Kaçağı asıl önleyen üçlü (her çıkışın
    belgesi + düzenli sayım + denetim kaydı) bizde zaten var; karekod
    onları hızlandırır ve doğrular.
  - ⏸️ **8.2.3.1** **A seviyesi · parti karekodu — seçilen yol.**
    `stock_lot` (`id`, `lot_code`, `expires_on`) ve
    `stock_movement.lot_id` **hazır** (0003); kabul partiyi zaten
    oluşturuyor (0019); etiket ekranı duruyor. **Yeni tablo gerekmiyor.**
    İş: kabulde etikete karekod + çıkış ekranlarında okutma + sunucuda
    parti kapısı.
  - ⏸️ **8.2.3.2** **B seviyesi · taşıma birimi karekodu.** Her
    çuval/kasa/palet kendi kimliğini taşır; **gerçek kaçak kontrolü bu**
    ama `handling_unit` tablosu, kısmi tüketim kuralı, sayımın bu
    birimlere taşınması ve **depoda 20 kat etiket/okutma iş yükü**
    demek. Ancak İsmet'in gerçek hacmi gerektiriyorsa yazılır.
    A'nın verisi B'ye temiz göç eder.
  - ⏸️ **8.2.3.3** C seviyesi (kalem karekodu) **elendi**: parti ve SKT
    taşımadığı için ne izlenebilirlik ne FIFO sağlar.
  - ⏸️ **8.2.3.4** Cihaz/etiket/alışkanlık soruları →
    `ismete-sorulacaklar.md` **F1–F5**. ⚠️ Yeni ve atlanması kolay olan:
    **-18 °C'de ve ıslak yüzeyde duran etiket malzemesi.** Normal termal
    etiket donmuş çuvalda düşer.
  - ⏸️ **8.2.3.5** El terminali okuma (mal kabul ve sayım elde) — aynı
    ailenin donanım tarafı.
- ⏸️ **8.2.4** **Makine bakım takibi**
- ⏸️ **8.2.5** Üretim planlamayı gerçek deftere bağla (servisler var,
  veri bağı zayıf)

---

## Güncel dokümanlar · nereye bakılır

Proje notları Claude Projesi içinde kalıyor (taşımak maliyetli). Aşağıdaki
liste **güncel ve geçerli** olanları gösterir; adı geçmeyen eski not
arşiv sayılır.

| Doküman | Ne için |
|---|---|
| `docs/HEDEFLER.md` | **Tek doğru iş listesi.** Sıra buradan okunur. |
| `docs/BITMIS-URUN-EKSIKLERI.md` | Bitmiş ürün için ne eksik, NEDEN eksik |
| `docs/kararlar/ismete-sorulacaklar.md` | **İsmet'e sorulacak her şey, tek liste** |
| `docs/kararlar/sahit-numune.md` | Şahit numune tasarım kararı |
| `db/prova/README.md` | Provalar nasıl koşturulur, hangisi kırık |
| `docs/codex-brifi.md` | Codex'e yapıştırılan denetim brifi |
| `docs/kararlar/kararlar-ve-tuzaklar.md` | Tuzaklar 1–89, bilinçli kararlar |
| `docs/kararlar/codex-denetimi-ekim-2026.md` | Codex bulgu defteri (MIYOP-xxx) |
| `docs/kararlar/calisma-duzeni.md` | Codex–Claude sırayla çalışma düzeni |
| `docs/MIYOP-Surum-Defteri.xlsx` | Yayın defteri · yapılan / bekleyen |
| `claude/musteri-profili-gercek-veri.md` | Gerçek müşteri profili |
| `claude/endustriyel-mutfak-kapsam.md` | Kapsam kararı |
| `claude/fiyat-modeli-karari.md` | Fiyatlandırma (fiyat henüz belirlenmedi) |
| `claude/satis-oyun-plani.md` | Satış planı |
| `claude/yetki-cercevesi.md` + `claude/rol-ekran-matrisi.md` | Rol/izin haritası |
| `claude/muhasebe-ve-e-donusum.md` | e-Fatura/e-İrsaliye kapsamı |
| `claude/siparis-defteri-tasarimi.md` | Sipariş defteri tasarımı |
| `claude/portal-tasarimi.md` | Müşteri portalı tasarımı |
| `claude/demo-senaryosu.md` | Demo akışı |

⚠️ `db/migrations/g7_rls_kapat.sql` **kullanılmaz** — RLS'i kapatıyor,
yanlışlıkla çalıştırılma riski var (6.11).

---

## Sayılar (21.10.2026)

| | |
|---|---|
| Test | 78 dosya · 1432 test · 0 hata |
| Göç | 0000–**0093** · 94 dosya · hepsi canlıda · (giriş ACL'si **0094** olacak) |
| Açık çekirdek rota | 25 (37'den indi) |
| Tarayıcıya bağlı açık ekran | **3** (6 → 5 Profilim bitti → 3 şube ekranları kapsam dışı) |
| Sahte veri üreticisi | **23 `createDemo*`** (27 → 23 · duyuru, şube, firma ve `createDemoData` silindi) · çıcır testiyle donduruldu |
| Veritabanı yazma kapısı | **45 tetikleyici** (18 → +27 tablo) |
| Codex bulgusu | **64** · (**21'i kapandı**: 001, 002, 031, 032, 035, 038, 039, 041, 044, 046, 048, 057, 059, 061, 066, 067, 068, 070, **058**, **069**, **071**) · 21–25.10'da **15 yeni**: 058–072 |
| Kapısız yazma yüzeyi | **0 tablo** (ölçüldü, sayılmadı) |
| Kapı dışı `security definer` | **6 rutin** (0089'da 11 idi) · donduruldu |
| Prova dosyası | **38 · 27 yeşil / 11 kırmızı** (11'i de bayat · 6.12) |
| Mock dosya | 36 · hiçbiri açık kiracı rotasından erişilemiyor |
| Public yol | **2** · başvuru formu + müşteri portalı (ölçülüp donduruldu) |
| Giriş vitrini | dondurulmuş **20 modül adının** hiçbiri geçmiyor (ölçüldü, donduruldu) |
| Tuzak | **113** (25.10: 112, 113 eklendi) |

⚠️ "Mock dosya" satırı **yanıltıcıydı:** doğru olan ama yetmeyen bir ölçüm.
Asıl tehlike adı mock olmayan üreticilerdi; üstteki satır onu gösteriyor.
