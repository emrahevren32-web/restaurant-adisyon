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

---

## 3 · EKRAN BORCU · "Kaydettim ama gitmemiş"

Açık 25 kiracı rotasının 6'sı `storage.ts` (tarayıcı hafızası) okuyor/yazıyor.
Kullanıcı Kaydet'e basıyor, ekran kaydedildi diyor, veri tarayıcıda kalıyor.
`src/modules/kiraci-ekrani-veri-kaynagi.arch.test.ts` bunları dondurdu —
liste yalnız KISALABİLİR.

Emrah'ın onayladığı sıra:

- ⬜ **3.1** Firma Profili (`company-profile`)
  - ⬜ **3.1.1** Kim değiştirebilsin? Vergi numarası fatura kesmeyi
    etkiliyor. (Emrah'a sorulacak)
- ⬜ **3.2** Profilim (`my-profile`) — şu an "Kullanıcı kaydı bulunamadı"
  hatası veriyor, hiç çalışmıyor
- ⬜ **3.3** Şube Yetkileri (`branch-permissions`)
- ⬜ **3.4** İşletme Ayarları (`settings`)
- ⬜ **3.5** Şubeler (`branches`)
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
  - ⬜ **3.9.1** Şahit numune gerçek bir gıda güvenliği gereği (numune
    saklama süresi, imha). Yapılacaklar listesine madde olarak girmeli —
    sahte ekran olarak değil.
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
  - ⬜ **3.8.5** Codex'e taratılacak: *"depoda mock/uydurma veri üreten
    başka ne var — adı `.mock` olmayanlar dâhil?"* ⚠️ Benim taramam ad
    desenine bakıyor; `storage.ts` örneği gösterdi ki asıl tehlike adı
    mock olmayanlardır (tuzak 86).
- ⬜ **3.6** **MIYOP-008** · Başlıkta seçilen şube gerçek sorgulara
  aktarılmıyor. B şubesi seçiliyken kayıt A'ya yazılabiliyor.
- ⬜ **3.7** **MIYOP-010** · Etiket ekranında ürünler arası veri karışması

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

- ⏸️ **8.2.1** **Personel / vardiya / puantaj**
- ⏸️ **8.2.2** **Depo raf adresi** · lokasyon yönetimi
- ⏸️ **8.2.3** **Barkod / el terminali okuma** (mal kabul ve sayım elde)
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

## Sayılar (17.10.2026)

| | |
|---|---|
| Test | 78 dosya · 1432 test · 0 hata |
| Göç | 0000–**0090** · 91 dosya · (0091 sırada) |
| Açık çekirdek rota | 25 (37'den indi) |
| Veritabanı yazma kapısı | **45 tetikleyici** (18 → +27 tablo) |
| Codex bulgusu | **48** · (**10'u kapandı**: 001, 002, 031, 032, 035, 038, 039, 041, 044, 046, 048) |
| Kapısız yazma yüzeyi | **0 tablo** (ölçüldü, sayılmadı) |
| Kapı dışı `security definer` | **6 rutin** (0089'da 11 idi) · donduruldu |
| Prova dosyası | **38 · 27 yeşil / 11 kırmızı** (11'i de bayat · 6.12) |
| Mock dosya | 36 · hiçbiri açık kiracı rotasından erişilemiyor |
