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
| **A1** | ✅ **BİTTİ (29.10)** · **B başlığı · yarım ekranlar** · 4/4 | Kaydet'e basınca veri tarayıcıda kalıyor. Demoda ilk fark edilecek şey bu. **Sıra: ~~Profilim~~ ✅ (20.10) → ~~Firma Profili~~ ✅ (29.10) → ~~Karşılama~~ ✅ (29.10) → ~~İşletme Ayarları~~ ✅ (29.10, göç 0103)**. ⚠️ **İDDİA DÜZELTİLDİ (30.10, Codex):** doğru cümle şu — *açık kiracı ekranlarının iş verisinin kalıcı kaynağı veritabanıdır; veritabanından üretilen oturum ve görünüm önbellekleri bunun dışındadır.* Eski cümlem (*"hiçbiri tarayıcıya yazmıyor"*) fazla genişti: Profilim kaydı `onProfileChange` → `App.tsx` → `storage.ts` yoluyla `ra_auth` oturum önbelleğini hâlâ tazeliyor. O bir **önbellek**, kaynak değil — ama "hiçbiri yazmıyor" demek yanlıştı. `kiraci-ekrani-veri-kaynagi.arch.test.ts` çıcırı **6 → 0**. ⚠️ **25.10:** Şubeler ve Şube Yetkileri **kapsam dışına çıktı** (tek merkez kararı), düzeltilmedi — 5'ten 3'e indi. |
| **A2** | ⛔ **KAPSAM DIŞI (Emrah, 31.10)** · MIYOP-008 · şube bağlamı | ⛔ **KARAR (Emrah, 31.10.2026):** *"Şube olayına şimdi girmeyeceğiz hatta demodan sonra da girmeyebiliriz."* Yani bu madde ertelenmedi, **kapsam dışına çıktı** — demo öncesi listesinden düşürüldü. ⚠️ **Bilinen durum yazılı kalsın:** kod hâlâ *"tercih yoksa ilk şube"* diyor ve tek şubede doğru sonucu **tesadüfen** veriyor. İkinci bir şube açıldığı gün bu bir hataya döner. Tek merkez kararı (25.10) o günü uzaklaştırdı ama ortadan kaldırmadı. Şube gerçekten gündeme gelirse yapılacaklar: başlıktaki şube seçici kalkar, liste sorgularına şube kapsamı yazılır. |
| **A3** | ✅ **BİTTİ (29.10)** · MIYOP-010 + MIYOP-064 · **7/7 ekran** | Ortak çözüm `src/core/secim/ayrinti-kapisi.ts`: React'sız, isteksiz, **saf** bir karar birimi; kimlik sürüm numarası sayılıyor. Yedi ekranın yedisinde de takılı ve her birinde ÜÇ yere birden: düğme kapalı, eylemin **gövdesinde** erken dönüş, ve ekranda **sebep yazılı**. Ayrıntı 3.7'de. ⚠️ **BU SATIR 01.11'E KADAR AÇIK GÖRÜNÜYORDU** — iş 29.10'da bitmiş, üstteki tablo güncellenmemişti. Bayat bir liste yalan söyler: üç gün boyunca demo listesinde bitmiş bir iş duruyordu. |
| **A4** | ✅ **BİTTİ (31.10)** · sahte veri üreticileri · **23 → 0** | `storage.ts` içinde tek bir `createDemo*` kalmadı; **851 satır** uydurma veri silindi. İki turda: (1) kiracı tarafı 13 üretici + **"depo boşsa uydur" mekanizmasının kendisi** (`loadBranchScopedItemsWithDemo` ve ikizi) — 408 satır; (2) platform/EVREN360 8 üretici — 443 satır. ⚠️ **Ölçüldü:** silinen 13'ün hiçbiri o gün açık bir kiracı ekranına ulaşmıyordu (dört modül de `frozen`) — yangın söndürme değil **mayın temizliği**: dondurulmuş bir kapı açıldığında uydurma veri sessizce geri gelecekti. ⚠️ **İki fonksiyon silinmedi, ADI DEĞİŞTİ:** `varsayilanLisansPaketleri` ve `varsayilanLisansModulleri` — uydurma kayıt değil **ürün kataloğu** (`defaultPackageSpecs`ten türüyorlar). Ad değiştirip sayımdan çıkmak saklamak olurdu; çıcıra ayrı sınama kondu. ⚠️ **Karar (Emrah, 31.10):** *"Boşalt, gerçeğe bağlanana kadar boş kalsın — panel bugün yalan söylemez ama birkaç ekran boş görünür."* Çıcır **kapandı** (üst sınır 0) ve sağlama sınaması yeniden yazıldı: artık "sonuç dolu mu" değil "ölçüm aracı hâlâ çalışıyor mu" diye soruyor. Ayrıntı: `docs/kararlar/kaldirilan-moduller.md` §8 ve §9. |
| **A5** | **Şahit numune** 🔄 ⚠️ **28.10'da YENİDEN AÇILDI** | Göç **0093** defteri kurdu, **0094** Codex'in bulduğu P0'ı ve iki P1'i kapattı, **0096** saklama koşulunu kalite departmanının da yazabileceği beyan alanı yaptı, **0097** Emrah'ın imha onayı kararını zorladı. Ekran **Kalite → Şahit Numune**. Prova: 21+18+9+13 = **61 sınama yeşil**. ✅ **27.10:** etiket saklama koşulunu artık ürün kartından okuyor (3.9.3). ⚠️ **28.10 · EKRAN CANLIDA HİÇ AÇILMAMIŞ.** Emrah sıfırdan açılan bir kiracıda denedi: *"Bu ekran açılamadı"*. `client_error` kaydı sebebi yazdı — `ReferenceError: NUMUNE_SAYFA is not defined`: sabit kullanılmış, import edilmemiş. **26.10'da "bitti, canlıda" dedim; yalnız yerelde görmüştüm.** Düzeltildi; asıl kusur hatta tip denetiminin hiç koşmamasıydı (tuzak 141). Kalan: sayfalama borcu (3.9.9) + boş kiracıda canlı doğrulama. |
| **A6** | ✅ **BİTTİ (29.10)** · MIYOP-043 · Edge Function canlıda + göç 0102 + yedek yol silindi | Güvenlik borcu kapandı. |

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
- ✅ **0.11** **MIYOP-043 · ÜÇ ADIM DA BİTTİ (29.10.2026)** · `giris-yap`
  Edge Function yazıldı → **canlıya alındı ve POST 200 ile doğrulandı** →
  göç **0102** `giris_adresi_bul`un `anon`/`authenticated` haklarını aldı →
  tarayıcıdaki geçici yedek yol **silindi**. Ayrıntı 1.8'de.
- 🔄 **0.14** **Codex denetimi (30.10) · ÜÇ BULGU · göç 0104 + MIYOP-084**
  - ✅ **MIYOP-083 · denetim defteri HANGİ SATIR olduğunu yazamıyordu.**
    `app.denetim_yaz()` satır kimliğini `coalesce(new->>'id', old->>'id', '?')`
    ile üretiyordu; `id` kolonu olmayan **dört** tabloda `row_id` alanına
    `'?'` düşüyordu (`stock_item_allergen`, `stock_item_nutrition`,
    `user_branch_access`, `user_role`). Besin değerinde fark yalnız değişen
    alanı taşıdığı için ürün bilgisi de yoktu: defterde *"biri bir şeyin yağ
    oranını 10'dan 12'ye çekti"* yazıyordu.
    ⚠️ Onarım **dört tabloyu yamamak değil**, defteri YAZAN fonksiyonu
    düzeltmek: `id` yoksa birincil anahtardan kimlik üretiliyor
    (`app.denetim_satir_kimligi`, kataloğu okuyor, tablo adı tanımıyor).
    Beşinci tablo eklendiğinde de çalışır. Göç **0104**.
  - ✅ **MIYOP-085 · `company.updated_at` istemciden geliyordu.** Firma
    Profili ekranı *"Son kayıt: ..."* yazıyor ve o tarihi yazan taraf
    gönderiyordu. Artık `before update` tetiğiyle sunucuda yazılıyor,
    `created_at` korunuyor. Aynı göç.
    ⚠️ `updated_by` BİLEREK eklenmedi: "kim" sorusunun yeri `audit_log`.
  - ✅ **MIYOP-084 · müdürün açamadığı ekranın salt okunur modunu yazmıştım.**
    İşletme Ayarları ekranı *"Müdür ayarları GÖREBİLMELİ, yalnız
    değiştiremez"* diye yazılmıştı — ama ekranın açılma kapısı
    `settings.manage` istiyordu ve **o izin müdürde yok** (canlı ölçüm: üç
    rolde var — admin, isletme_sahibi, super_admin). Yazdığım salt okunur
    mod **ölü koddu**. Açılma izni `company.read` oldu; yazma kapısı
    DEĞİŞMEDİ (ekran + depo + veritabanı tetiği, üçü de yerinde).
    ⚠️ **Asıl delik:** `rol-ekran-matrisi.test.ts` 13 rolü sınadığını
    söylüyor ama tabloda **10 rol** vardı — `isletme_muduru` hiç
    sınanmıyordu. Eklendi (29 izin, canlıdan okundu) + dört yeni sınama:
    müdür `settings`i açabiliyor, menüde görüyor, `veri-yedegi`yi
    açamıyor, menüsü sahibininkinin **alt kümesi ve ondan küçük**.
  - ✅ **KENDİ BULDUĞUM DÖRDÜNCÜ BULGU · denetim tarayıcısı on tabloyu
    görmüyordu.** `denetimIzlenenTablolar()` göçlerde tek söz dizimi
    arıyordu; canlıda **29** denetim tetikleyicisi varken **19** görüyordu.
    Görmediği on tablo arasında `app_user`, `company`, `branch`, `user_role`
    da vardı ve bunlar Değişiklik Kaydı ekranında **ham İngilizce adıyla**
    görünüyordu. Tarayıcı üç biçimi birlikte okuyor artık; **on etiket**
    eklendi (19 → 29). Tuzak 154.
  - ✅ **`audit-coverage.arch.test.ts` kapsamı ölçüyordu, ANLAMI ölçmüyordu.**
    Yeni dosya: `src/audit/denetim-satir-kimligi.arch.test.ts` — defterin
    yazdığı kimliğin anlamlı olduğunu, `'?'`nin son çare olduğunu ve her
    denetimli tablonun kimlik üretebildiğini ölçüyor. Tuzak 155.
  - ✅ **Prova + TERS PROVA.** `db/prova/prova-0104.sql` (5 bölüm yeşil) ve
    `db/prova/prova-0104-ters.sql`: 0104 metinden geri alınınca `'?'`
    **geri geliyor** (dört tablonun dördü de kör, `company` 2020 tarihini
    kabul ediyor). Ters prova olmadan "düzelttim" demek iddiadır.
  - ⬜ **0104 canlıya uygulanacak** (`araclar/goc-bekleyen.sql`).
- ✅ **0.15** **v0.4.2 YAYINDA (30.10)** · göç 0104 canlıda, arayüz 4/4
  doğrulandı · `index-COlU8vfq.js` · yedek `/var/www/miyop.yedek-20261030-195859`
  · 1667 test yeşil · derleme 31 dosya / **8.51 MB**.
- 🔄 **0.16** ⚠️ **VERİTABANININ HİÇ YEDEĞİ YOKMUŞ (30.10) · ölçüldü**
  Emrah sunucudaki yedek klasörlerini sorunca ortaya çıktı: o klasörler
  sitenin **derlenmiş hâli**, içlerinde **tek satır iş verisi yok**. İş
  verisi Supabase'deki Postgres'te ve ölçüm şu (Supabase'in kendi belgesi,
  30.10.2026):
  - FREE planda **otomatik yedek YOK**: *"Automatic backups — Not included
    in free"*; zamanda geri alma (PITR) de yok.
  - Supabase'in tavsiyesi: free projeler `supabase db dump` ile düzenli
    olarak **saha dışına** yedek alsın.
  - **Pro $25/ay** → günlük yedek, 7 gün saklanıyor.
  - ⚠️ *"Free projects are **paused after 1 week of inactivity**."*
  - **KARAR (Emrah, 30.10):** Pro **ilk müşteriden sonra.** *"pro için erken,
    ilk müşteri ile anlaşalım... 25 dolar az değil şimdi.. bizde asgari
    ücretli adamız, yatırım için önce alıcı bulmak, pazarı bilmek gerek."*
  - ✅ **Yapıldı:** `araclar/yedek-al.ps1` (üç dökümü birlikte alır: şema,
    **veri**, roller) + eksik olan `docs/YEDEKLEME.md` yazıldı.
    ⚠️ `supabase db dump` **varsayılan hâliyle veriyi almaz** — tek komutla
    alınan "yedek" tablo tanımlarından ibaret olurdu (tuzak 157). Betik
    kendi çıktısını denetliyor: veri dosyasında `COPY`/`INSERT` satırı yoksa
    "alındı" demiyor.
    ⚠️ **Kapsamadıkları yazılı:** `auth.users` (giriş hesapları) ve Storage
    dökümde YOK; geri yükleme **hiç denenmedi**; alma **otomatik değil**.
  - ⬜ Kalan: boş bir projede **geri yükleme provası**, otomatik zamanlama.
  ⚠️ `docs/YEDEKLEME.md` kod içinde **üç yerden** atıf alıyordu ve dosya
  YOKTU. Kodun "orada yazıyor" dediği şey yazmıyordu.
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
  ✅ **ASIL SIZINTI 29.10.2026'DA KAPANDI** (1.8.1–1.8.5). Madde açık
  duruyor çünkü aynı aileden **üç ikincil kusur** hâlâ bekliyor: zamanlama
  (1.8.10), istek sınırı (1.8.11), başvuru ayrımı (1.8.6). ⚠️ Bunlar
  "adres sızıyor" kusuru değil; kapı artık kapalı.
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
  - ✅ **1.8.3** **Fonksiyon CANLIDA · 29.10.2026.** Panelden (Via Editor)
    dağıtıldı. ⚠️ İlk denemede iki kusur çıktı ve ikisi de ölçümle
    yakalandı: (a) **Function name kutusu varsayılan `rapid-function`
    olarak kalmış** — panel *"Successfully deployed"* dedi ama tarayıcı
    `giris-yap` çağırdığı için fonksiyon hiç bulunmuyordu; (b) kodu panoya
    kopyalayan komut `Get-Content -Raw` kullanıyordu, Windows dosyayı eski
    alfabeyle okudu ve **Türkçe harfler bozuk yapıştı** (`Ã§`, `Ä±`) —
    müşterinin göreceği hata mesajları dâhil. → tuzaklar 144, 145.
    **Doğrulama (ölçüm, varsayım değil):** Edge Functions → giris-yap →
    Invocations `POST 200` (05:02:08), Overview *"7 invocations since last
    deploy and no errors"*, 4XX ve 5XX oranı %0.
  - ✅ **1.8.4** Göç **0102** (0091 DEĞİL — o numara yetki denetimine
    gitmişti): `giris_adresi_bul`un `anon` **VE `authenticated`** hakkı
    alındı, **VE** `storage.ts`teki geçici yedek yol SİLİNDİ.
    Canlıda çalıştırıldı: *"Success. No rows returned."*
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
  - ✅ **1.8.5** `prova-0102` bulunan hesabı bulunmayanla **karşılaştırıyor.**
    `prova-0077` yalnız bulunan hesabı sınıyordu; oysa sızıntının kendisi
    "iki hâlin FARKLI cevap vermesi" idi, yani ölçülmesi gereken şey tam
    olarak o FARKtı. 19 ölçüm, hepsi yerel provada yeşil: `anon` var olan
    adı da olmayan adı da soramıyor ve **ikisi birebir aynı** (`42501`);
    oturum açmış kullanıcı da soramıyor (işletme sahibinin gerçek
    e-postası dâhil); `service_role` hâlâ çözebiliyor (giriş kırılmadı);
    `personel_giris_adresi` dokunulmadı.
    ⚠️ **TERS PROVA da yapıldı:** yetki geri verilince sızıntı aynen
    çıkıyor — `abc.bey@gercek-eposta.com` / `...@bulunamadi.miyop.local`.
    Yani prova boşluğu değil, gerçekten kapatılan şeyi ölçüyor.
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
  - ✅ **2.9.9** **MIYOP-074'ÜN KALAN ÜÇ AYAĞI KAPANDI (26.10) · göç 0095**
    25.10'da üç planlama ekranı düzeltilmişti; **üç yer daha** aynı hatayı
    taşıyordu ve bunu ancak ölçünce gördüm:
    **(1) KONTROL PANELİ atlanmıştı** ve bu en kötüsüydü, çünkü müşterinin
    GÖRDÜĞÜ İLK EKRAN. `bakiyeHaritasi` hâlâ `k.miktar` okuyordu: panel
    *"bu iş emri başlatılabilir"* derken ekrana girip denendiğinde kapı
    reddediyordu. Kritik stok satırı da kendi kendini yalanlıyordu:
    *"Kritik stok · Tavuk · 100 kg (en az 5)"*. Artık kullanılabilir
    yazıyor ve fark varsa **ikisi de** yazıyor (*"0 kg kullanılabilir
    (100 var, 100 SKT geçmiş)"*) — sayıyı tek başına küçültmek "depodaki
    mal nereye gitti" sorusunu cevapsız bırakırdı.
    **(2) SERVİS SÜZMESİ SUNUCUDAN DAHA DARDI.** `warehouse.service.ts`
    süresi geçmiş miktarı `kart.sktTakipli && kart.lotTakipli` olan
    kalemlerde arıyordu. Ama göç 0092'nin kapısı `stock_item.tracks_expiry`
    bayrağına **HİÇ BAKMIYOR**; yalnız `stock_lot.expires_on` soruyor.
    Yani lot takipli ama "SKT takipsiz" işaretlenmiş bir kalemin partisine
    tarih yazılmışsa sunucu çıkışı REDDEDERKEN ekran malı "kullanılabilir"
    sayıyordu. ⚠️ **Bayrak bir beyandır, tarih bir olgudur.** Koşul lot
    takibine indirildi. Hem davranış testi (`warehouse.service.test.ts`)
    hem çıcır (`skt-kapisi.arch.test.ts` → "göç `tracks_expiry` bayrağına
    bakmıyor") eklendi.
    **(3) ANALİZ EKRANI BAŞKA BİR CEVAP VERİYORDU.**
    `app.isletme_gostergeleri` (0065) kritik kalemi **fiziksel** bakiyeden
    ve `<` ile sayıyordu; Depo ekranı **kullanılabilir** bakiyeden ve `<=`
    ile. İki fark, iki ekranın aynı soruya iki cevabı. Olumsuz kontrol
    yapıldı: eski fonksiyonla kritik sayısı **0**, yenisiyle **2** —
    gerçekten 2 kritik kalem varken.
    Göç **0095** `stock_usable_balance` görünümünü kurdu (fiziksel, süresi
    geçmiş, kullanılabilir — üçü bir arada) ve göstergeler onu okuyor.
    ⚠️ Kuralı her sorgunun kendi içinde tekrar yazmak, aynı hatayı üçüncü
    kez yapmanın en kolay yolu olurdu. ⚠️ `security_invoker = on` şart,
    yoksa görünüm RLS'i atlar ve iki kiracı birbirinin bakiyesini görür —
    göçün doğrulaması bunu ölçüyor. Prova 0095: **12/12**.
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

- ✅ **3.1** Firma Profili (`company-profile`) — **BİTTİ (29.10).** Artık
  `company` tablosunu okuyup yazıyor; tarayıcı hafızasıyla ilgisi kalmadı.
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
  - ✅ **3.1.3** **Ekran gerçek veriye bağlandı (29.10).**
    `src/companies/firma-profili.repository.ts` · 17 alanın hepsi `company`
    tablosundan okunuyor ve oraya yazılıyor. Yeni alan göçü gerekmedi.
    ⚠️ **Yazılan kolon kümesi DONDURULDU** (test): `company_code`,
    `tenant_id`, `primary_sector_id`, `status`, `default_branch_id` bu
    nesneye bir gün eklenirse, bir ekran kiracının kimliğini
    değiştirebiliyor olur — ve bu sessizce olur.
    ⚠️ Kaydettikten sonra **geri okunuyor**: ekranda görünen şey,
    veritabanının yazdığı şey. Formdaki değeri "başarılı" diye bırakmak,
    veritabanının başka bir şey yazmış olma ihtimalini gizler.
    ⚠️ Göstergelerden **şube olanlar kaldırıldı** (tarayıcıdan besleniyordu
    ve şube bu seviyede yok); yerine firma kodu ve **son kayıt zamanı**
    kondu — "kaydedildi" iddiasının tek kanıtı odur.
  - ✅ **3.1.4** **MIYOP-060 · BİTTİ (29.10).** Ekran artık `company`
    tablosundan okuyor; boş alan boş görünüyor. Üstüne `normalizeCompany`
    (storage.ts) içindeki uydurma da **kaldırıldı** — düzeltilmiş bir
    kusurun ikinci katmanda yaşamasına son verildi (tuzak 106):
    `legalName ← companyName`, `authorizedPerson ← companyName`,
    `authorizedPhone ← phone`, `authorizedEmail ← email` fallback'leri
    silindi. ⚠️ `ownerName` fallback'i KALDI: o uydurma değil, başvuru
    formunda kişinin kendi yazdığı ad. ⚠️ İki kurulum yolu
    (`businessRegistration`, `businessApplication`) da artık ticari unvanı
    firma adından TÜRETMİYOR — başvuruda o soru sorulmuyor.
  - ✅ **3.1.8** **VERGİ NUMARASI BİÇİM KONTROLÜ** (Emrah: *"koy gitsin"*,
    29.10). Girildiyse **10 hane (VKN)** ya da **11 hane (TC Kimlik No)**
    olmalı ve yalnız rakam içermeli; **boş serbest** (yeni açılmış işletme
    henüz girmemiş olabilir, onu kapıda bırakmayız). Aradaki boşluklar
    temizlenerek yazılıyor (`1234 567 890` → `1234567890`), ama harf ya da
    tire **sessizce atılmıyor** — kullanıcı bir şey yazmıştır, biz onu
    "düzeltip" kaydedersek neyin kaydedildiğini bilmez.
    ⚠️ Biçim yanlışsa veritabanına **hiç gidilmiyor**: yanlış numarayı
    kaydedip aylar sonra e-fatura tarafında öğrenmektense burada söylemek
    ucuzdur.
  - ✅ **3.1.5** **MIYOP-062 · BİTTİ (29.10).** Dört alan
    (`shortName`, `website`, `postalCode`, `authorizedTitle`)
    `normalizeCompany` dönüş nesnesine eklendi. Ekran zaten veritabanına
    yazdığı için bu düşme ekranı artık etkilemiyor; ama normalizasyon
    aynasını da sessizce kırpıyordu.
  - ⏸️ **3.1.7** ⚠️ **063'ün İKİNCİ YARISI · ŞUBE TARAFINDA, KAPSAM DIŞI**
    (Codex, 22.10): `assignHeadOffice` içindeki **"Merkez Yap"** yolu da
    süzülmüş firma listesini ortak koleksiyona yazıyor.
    ⚠️ **29.10 durumu:** Firma Profili yarısı kapandı (`saveCompanyProfile`
    kaldırıldı), bu yarı DURUYOR — ama **düzeltildiği için değil**, şube
    ekranları tek merkez kararıyla kapsam dışına çıktığı için. O düğme
    bugün hiçbir açık ekranda yok. Şube geri gelirse bu madde de geri gelir.
    ⚠️ Bu ayrım önemli: "kapandı" ile "kapsam dışı" karıştırılmasın
    (tuzak 104'ün dersi).
  - ✅ **3.1.6** **MIYOP-063 · BİTTİ (29.10).** Kusurun kaynağı olan
    `saveCompanyProfile` **kaldırıldı** (`branch-directory.service.ts`);
    yerine gerekçesi yazıldı. Ekran `company` tablosuna tek satır yazıyor,
    ortak koleksiyonu değiştirmiyor — yani başka firmanın kaydını
    düşürecek bir yol kalmadı.
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
- ✅ **3.4** İşletme Ayarları (`settings`) — **BİTTİ (29.10).** Artık
  `tenant_settings` tablosunu okuyup yazıyor.
  - ✅ **3.4.0** **KARAR (Emrah, 29.10):** *"Kiracı ayarları tablosu yap.
    Herkes kendi KDV oranını ve para birimini kendi seçsin."* → İki ayar da
    **kalıyor**; göç **0103** onların yeri.
  - ✅ **3.4.2a** **Göç 0103 yazıldı · prova 30/30** (yerel PostgreSQL 16,
    104 göç). `public.tenant_settings`: kiracı başına tek satır,
    `currency_code` (varsayılan `TRY`, biçim `^[A-Z]{3}$`), `vat_rate`
    (**varsayılanı YOK**, 0–100 aralığı).
    ⚠️ **KDV'nin varsayılanı BİLEREK YOK** ve göç bunu kendi doğrulamasında
    ÖLÇÜYOR: bu göçün varlık sebebi `vatRate: 10`'un kimsenin vermediği bir
    cevap olmasıydı; buraya `default 10` koymak aynı yalanı bir katman
    aşağıya taşımak olurdu. Ters prova da yapıldı: varsayılan konunca ölçüm
    yakalıyor.
    ⚠️ Kapılar: RLS (force) + `izin_settings` → `settings.manage`
    (`isletme_muduru`da YOK — provada MI403 ile ölçüldü) + `denetim_yaz`.
    ⚠️ `updated_at`/`updated_by` **sunucuda** yazılıyor; provada istemci
    bile bile 2020 tarihi ve başkasının kimliğini gönderdi, ikisi de yok
    sayıldı.
    ⚠️ Satır **ekran değil veritabanı** açıyor (`tenant` tablosuna AFTER
    INSERT tetiği + geriye dönük doldurma). Ekranın satır açabilmesi, hangi
    kiracı adına açtığının ekranın elinde olması demekti.
    ⚠️ **Tuzak 149 burada çıktı:** ilk hâlinde `id` kolonu yoktu ve denetim
    kaydı `row_id` alanına '?' yazıyordu. Prova yakaladı.
  - ✅ **3.4.4** **Ekran 0103'e bağlandı (29.10).** Göç canlıya uygulandı
    (*"Success. No rows returned."*), ardından ekran yazıldı:
    `src/workspace/isletme-ayarlari.repository.ts`.
    ⚠️ `SystemSettings` tipinden **`vatRate` ve `currency` kaldırıldı**;
    `DEFAULT_SETTINGS.vatRate = 10` silindi. Ölçüldü: ikisini de o tipten
    BAŞKA okuyan yoktu — stok kartının para birimi ayrı bir alan
    (`stock_item.currency`), sipariş satırının vergisi ayrı (`vat_rate`).
    ⚠️ **Belirlenmemiş KDV boş görünüyor** ve `null` kalıyor; `0`a dönmüyor.
    Test bunu ayrıca ölçüyor çünkü `Number(null)` sıfırdır ve kusur sessizce
    geri gelebilir — kaldırdığımız yalanın aynısı olurdu, sadece 10 yerine 0.
    Kutu `type="number"` DEĞİL: sayı kutusu boş değeri bazı tarayıcılarda
    0'a çeviriyor ve 0 ile "boş" aynı şey değil.
    ⚠️ **Firma adı ve logo artık buradan DEĞİŞMİYOR**, salt okunur
    gösteriliyor. İkisi de `company` tablosunda ve sahibi Firma Profili
    ekranı; iki ekranın aynı kolona yazması "orada değiştirdim burada
    değişti" karışıklığının ta kendisi — üstelik kapıları farklı
    (`company.manage` ≠ `settings.manage`).
    ⚠️ *"Yetkisiz Erişim"* ekranı kaldırıldı: eski hâli `role === 'Admin'`
    değilse hiçbir şey göstermiyordu. **Müdür ayarları görebilmeli**, yalnız
    değiştiremez.
  - ✅ **3.4.7** **KAPANDI (02.11)** · göç **0105** · İşletme geneli KDV
    oranı artık yeni ürün kartına varsayılan olarak geçiyor.
    Ölçülmüştü (01.11): `tenant_settings.vat_rate` yalnız **İşletme
    Ayarları** ekranınca yazılıp okunuyordu, başka hiçbir kod yolu onu
    okumuyordu. Ekran yalan söylemiyordu ama **verilmemiş bir sözün
    beklentisini** doğuruyordu: kullanıcı oran giriyor, hiçbir şey olmuyor.
    **Karar (Emrah, 01.11):** *"KDV oranını firmanın şirket profili içinde
    kullanıcının belirlemesini isteyelim."* Alan zaten oradaydı; eksik olan
    **kullanılmasıydı**.
    **Yapılan:** `stock_item.vat_rate` boş bırakılırsa, kayıt yazılırken
    işletme oranı KOPYALANIR.
    ⚠️ **Kopyadır, bağ değildir:** işletme oranı sonradan değişirse eski
    ürünler DEĞİŞMEZ. Bir ürünün vergisi kaydedildiği günün cevabıdır;
    geçmişe dönük oran değişimi faturayı bozar. Ekran bu sınırı da yazıyor.
    ⚠️ **Zincirin üçüncü halkası.** 0052 zaten *sipariş satırı ← ürün kartı*
    kopyalamasını yapıyordu; başına *ürün kartı ← işletme ayarı* eklendi.
    Kural yeni değil, zincir tamamlandı.
    ⚠️ **Ekranda değil veritabanında**, çünkü ürün Excel'den toplu da
    yükleniyor ve ileride API'den de yazılabilir (MIYOP-081: *"gerekçe ekran
    kuralı değil servis kuralıdır"*). Ekranın işi kuralı uygulamak değil
    **açıklamak**.
    ⚠️ **Uydurma varsayılan değil** (MIYOP-060b): kopyalanan değer
    kullanıcının kendi girdiği oran. İşletme oranı boşsa ürünün oranı da
    **boş kalır** — `0` ya da `10` yazmak *mış gibi* olurdu.
    ⚠️ **Yalnız INSERT.** Kullanıcı var olan bir ürünün oranını bilerek
    silebilir; UPDATE'te de doldursaydık o silmeyi sessizce geri alırdık.
    ⚠️ **`security definer` ve sebebi — 05.11'de DÜZELTİLDİ (Codex).**
    Burada önce *"`company.read` izni olmayan bir depo sorumlusu satırı
    göremez"* yazıyordu. **Yanlıştı**; 0103 ölçüldü:
    `grant select … on public.tenant_settings to authenticated` ve politika
    yalnız `tenant_id = app.current_tenant_id()`. Yani hak `authenticated`
    rolünün tamamında ve hiçbir izin adı sorulmuyor — depo sorumlusu kendi
    kiracısının ayar satırını okuyabilir. `definer` bu sebeple **gerekli
    değil**; duruyor çünkü o grant/politika bir gün daraltılırsa tetik
    sessizce oranı boş bırakmaya başlardı. Sessiz kısmî kural,
    kuralsızlıktan kötüdür. (tuzak 185)
    **Prova:** `prova-0105.sql` **13 ölçüm** ve `prova-0105-ters.sql`
    **4 ölçüm** — biri tetik dururken doğruluyor, **ikisi** tetik
    kaldırılınca kırılan davranışı gösteriyor (ürün oranı boş kalıyor,
    zincir kopuyor), biri de tetikten bağımsız olanı. ⚠️ Burada önce
    *"dördü de kırılıyor"* yazıyordu; sayıldı, öyle değil.
    Göç iki kez çalıştırıldı. Çıcır: `isletme-kdv-orani.arch.test.ts`.
  - ✅ **3.4.6** **KAPANDI (01.11)** · Fiyat biçimlendirmesi artık para
    birimini işletmeden alıyor.
    `billing.ts` içinde `const PARA_BIRIMI = 'TRY'` yazıyordu ve bu dosyayı
    **38 ekran** kullanıyor: müşteri EUR seçse bile hepsi ₺ basıyordu.
    ⚠️ **Doğrudan veritabanı okuması EKLENMEDİ** ve eklenemezdi:
    `formatCurrency` eşzamanlı ve **çizim sırasında** çağrılıyor — içine
    sorgu koymak her fiyat yazımında ağ isteği demekti.
    **Çözüm tek besleme noktası:** değer bir kez okunur, biçimlendiriciye
    verilir. Besleme `isletme-ayarlari.repository → isletmeAyarlariniOku`
    içinde, çünkü para biriminin veritabanından okunduğu **tek yer** orası:
    hem giriş sonrası okuma hem kaydetme sonrası geri okuma oradan geçiyor.
    Yani *"kaydettim ama ekranda eski para birimi duruyor"* hâli oluşmuyor.
    ⚠️ **"Okunmadı" ile "TRY" ayrı iki durum.** İçerideki değer `null`
    başlıyor; o sırada ₺ basılıyor çünkü 0103'ün tetiği her kiracıyı zaten
    `TRY` ile açıyor — yani en olası doğru cevap o. Uydurma varsayılan değil.
    ⚠️ **Değer giriş SONRASI geliyor**, o ana kadar çizilmiş fiyatlar eski
    kalırdı; bu yüzden bir **dinleyici** var ve değer gelince ekran yeniden
    çiziliyor. Onsuz çözüm yarım olurdu.
    ⚠️ **Çıkışta sıfırlanıyor** (`App.tsx`): aynı tarayıcıda başka bir
    işletmeye giriş yapılırsa öncekinin para birimi ekranda kalırdı.
    ⚠️ Yan kazanç ölçüldü: `formatCurrency` **her çağrıda** yeni bir
    `Intl.NumberFormat` kuruyordu — bir listede yüzlerce fiyat varsa
    yüzlerce kez. Biçimlendirici artık önbellekli, para birimi değişince
    düşüyor.
    Sınama: `src/billing.para-birimi.test.ts` (8 sınama).
  - ✅ **3.4.5** **KAPANDI (01.11)** · İlk giriş sihirbazı artık veritabanına yazıyor.
    `onboarding.service.ts` (~365) `saveTenantSettings` ile `localStorage`a
    bir `currency` koyuyor ve `FirstLoginWizard` onu okuyor. Göç 0103'ten
    sonra bu **ikinci bir kaynak**: sihirbazda seçilen para birimi ile
    İşletme Ayarları'nda görünen ayrışabilir.
    ⚠️ Çıcır testi bunu YAKALAMIYOR çünkü `first-login` açık bir kiracı
    rotası değil (sihirbaz giriş akışının içinde). Yani test yeşil, kusur
    duruyor — bu yüzden madde buraya yazıldı.
    **Yapıldı (01.11):** `FirstLoginWizard → finishSetup` artık
    `isletmeAyarlariniYaz` ile **veritabanına** yazıyor; `onboarding.service`
    içindeki tarayıcı yazımından `currency` kalktı.
    ⚠️ **Yazım düşerse kurulum DURDURULMUYOR** ve bu bilinçli: işletme o
    noktada zaten açıldı, kullanıcı şifresini belirledi. Geri dönüşü olmayan
    bir akışın sonunda "olmadı" deyip kullanıcıyı ortada bırakmak, para
    biriminin yanlış kalmasından kötüdür. Sebep yazılıyor ve nereden
    düzelteceği söyleniyor.
    ⚠️ **İkinci bir ayrışma daha kapandı:** sihirbazın para birimi listesi
    elle `['TRY','USD','EUR']` yazılıydı, İşletme Ayarları'nınkinde **GBP de
    vardı**. Sihirbazda seçilemeyen bir para birimi ayarlarda seçilebiliyordu.
    Liste artık tek kaynaktan: `PARA_BIRIMLERI`.
    ⚠️ `timezone`, `language`, `dateFormat`, `theme` hâlâ tarayıcıda — onların
    veritabanında karşılığı YOK. Yazılı borç, saklanmış değil.
  - ✅ **3.4.1** **KAPANDI (29.10)** · MIYOP-060b · sorulmamış soruya cevap.
    `DEFAULT_SETTINGS` (storage.ts:306) `vatRate: 10` yazıyor ve form bunu
    **işletmenin KDV oranı** gibi gösteriyor. Kimse %10 demedi.
    Belirlenmemiş değer boş görünmeli ya da alan kaldırılmalı.
  - ✅ **3.4.2** **KAPANDI (29.10, göç 0103)** · Karşılığı olmayan alan. Ad/logo için
    `company.company_name` / `logo_url` var; **kiracı genelinde para birimi
    ve KDV** için göçlerde karşılık YOK. (Sipariş/stok satırındaki
    `vat_rate` işletme ayarı değil, satırın vergisi.) Bu iki ayar
    korunacaksa **yeni şema** ister; korunmayacaksa alan kaldırılır.
    ⚠️ Karar verilmeden ekran taşınmayacak.
  - ✅ **3.4.3** **KAPANDI (29.10)** · KDV ve para birimi ayrıca **ortak** `ra_settings` içine
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
  - ✅ **3.9.2.1** ⚠️ **GÖÇ 0094 · KENDİ YAZDIĞIM GÖÇTE BİR P0 VARDI
    (Codex, 26.10) · prova 18/18**
    `app.numune_olayi()` `security definer`dı, yani
    RLS'i atlıyordu, ve numuneyi **yalnız `sample_id` ile** buluyordu.
    Olay satırının kendi `tenant_id`si saldırganın kiracısını gösterdiği
    için RLS de geçiyordu. Sonuç: **A kiracısındaki bir üretim sorumlusu,
    B kiracısının numunesini IMHA'ya çevirebiliyordu** (MIYOP-075).
    ⚠️ Prova ile **canlandırıldı**, tahmin değil: onarımdan önce B'nin
    numunesi gerçekten IMHA oldu.
    ⚠️ **AYNI KUSUR `numune_turet()`TE DE VARDI ve Codex'in raporunda
    yoktu.** Parti, şube ve iş emri kimlikleri kiracı doğrulanmadan
    okunuyordu: A kiracısı B'nin **partisinden** numune alabiliyordu —
    hem B'nin SKT'sini ve saklama koşulunu okuyarak, hem kendi defterine
    B'nin partisine referans yazarak. Gösterilen yeri onarıp aynı desenin
    diğer yerlerine bakmamak, onarımı yarım bırakmak olurdu.
    Diğer iki kusur: **MIYOP-077** durum okuması kilitsizdi (`for update`
    eklendi — eşzamanlı ACILDI bir IMHA'nın üstüne binebilirdi) ve
    **MIYOP-076** `opened_shelf_life_days` **hiç kullanılmıyordu**: 0093
    kolonu yarattı, hiçbir yerde okumadı. Yazılı kural *"açılmış ise açık
    kalmaya uygun olduğu gün kadar"* diyordu ama numune açıldıktan sonra
    da saklama sonu partinin SKT'si kalıyordu — ekranda bir alan vardı,
    hiçbir şey yapmıyordu. Artık açılışta saklama sonu `least(SKT, açılış
    günü + açık raf ömrü)` ile **KISALIYOR**; `least` olduğu için asla
    uzamıyor (Emrah'ın kuralı: *"süre dolunca verilmiş SKT süresi de
    dolmuş demektir"*).
    ⚠️ **Ölçüm bir dördüncüsünü buldu:** `sample_code_key` NOT NULL'du ama
    hiçbir yerde türetilmiyordu — tekillik indeksi o kolonda olduğu için,
    aynı kodu farklı bir anahtarla gönderen istemci indeksi **atlayabilir**
    ve "N-1" ile "n-1" iki ayrı numune olurdu. Anahtar artık sunucuda,
    `app.kimlik_anahtari()` ile ve kural uygulamadaki
    `core/identifier.ts > normalizeIdentifier()` ile **birebir aynı**
    (göçün doğrulaması bunu kendi içinde ölçüyor).
  - ✅ **3.9.7** **İMHA ONAYI KARARI VERİLDİ VE ZORLANDI (26.10) · göç 0097**
    Emrah: *"Müdür onaylar ama müdür yoksa gıda mühendisi veya kalitecide
    onaylayabilir."* Bu, 25.10'dan beri açık duran tek soruydu.
    ⚠️ 0093 üç olayı da (ALINDI, ACILDI, IMHA) aynı kapıya bağlamıştı —
    yani **üretim sorumlusu numuneyi imha edebiliyordu.** Numune almak ve
    açmak bir İŞ, imha etmek bir KARAR: şahit numune bir tartışmada
    işletmenin tek kanıtı ve onu alan kişinin kendi başına yok edebilmesi
    defteri anlamsız kılar. HACCP'te 0081'de verilen kararın aynısı
    (ölçüm girmek geniş, ölçüm iptali dar).
    İmha artık `quality.record.manage` istiyor. Bu izin **ölçüldü**:
    `isletme_muduru`, `gida_muhendisi`, `kalite_sorumlusu` ve
    `isletme_sahibi`de var; `uretim_sorumlusu` ve `depo_sorumlusu`da YOK —
    kararın istediği tam bu. Göçün doğrulaması üç rolü tek tek sayıyor ve
    üretim sorumlusunun DIŞARIDA kaldığını ayrıca ölçüyor.
    ⚠️ **"MÜDÜR YOKSA" KOŞULU KODA YAZILMADI.** Sistem müdürün o gün işte
    olup olmadığını bilemez; bilmediği bir şeyi kural gibi yazmak "mış
    gibi" yapmak olurdu. Üçü de onaylayabiliyor, sıralama ekranda yazılı.
    ⚠️ **AYRI BİR "ONAYLAYAN" KOLONU AÇILMADI.** İmha kaydını ancak
    onaylayabilen biri yazabildiği için `actor_user_id` zaten onaylayandır;
    ikinci bir kolon doldurulmayan ya da ilkiyle çelişen bir alan olurdu.
    ⚠️ **ESKİ GEVŞEK TETİK DÜŞÜRÜLDÜ.** İki kapı bir tabloda birlikte
    dururken istek EN GEVŞEK kapıdan geçer; yeni kapıyı eklemek yetmez.
    Hem göçün doğrulaması hem prova bunu ayrıca ölçüyor (tuzak 122).
    Ekran tarafı: İmha düğmesi yalnız onaylayana görünüyor, numune alabilen
    ama onaylayamayan kişiye **sebebi yazılı** olarak söyleniyor.
    ⚠️ **26.10 akşam · bir eksik daha kapandı.** Emrah ekranı açtı ve
    *"numune alamıyorum"* dedi — haklıydı. Parti listesi doluydu ama hepsi
    seçilemez durumdaydı (ürün kartlarında saklama koşulu yok) ve sebebi
    **yalnız seçilen parti için** yazıyordu; kullanıcı seçemediği için
    sebebi hiç görmedi. Artık hiçbiri seçilemiyorsa sebep TOPLUCA yazılıyor
    (kaç partide saklama koşulu eksik, kaçının zaten numunesi var, nereden
    düzeltilir) ve kısmen seçilebiliyorsa kaç tanesinin alınabildiği
    söyleniyor (tuzak 126).
    Prova 0097: **13/13** — içinde "reddedilen imha durumu DEĞİŞTİRMEDİ"
    ve "üretim numune almaya/açmaya DEVAM EDİYOR" sınamaları.
  - ✅ **3.9.8** ⚠️ **0090'IN DONDURDUĞU YÜZEY 0093'TE SESSİZCE BÜYÜMÜŞ
    (26.10) · göç 0098**
    0097'yi yazdıktan sonra kapı yüzeyini ölçen eski göçleri (0085, 0089,
    0090, 0091) **güncel** veritabanında yeniden çalıştırdım. 0090 kırmızı
    verdi: *"gevsek kapinin ardinda LISTEDE OLMAYAN rutin(ler):
    app.numune_olayi."*
    0090 şu soruyu donduruyor: gevşek kapıya (`izin_gerek_coklu`) bağlı bir
    tabloya yazan kaç `security definer` rutin var? `security definer` bir
    rutin RLS'i ve tablo kapılarını atlar, o yüzden listesi gerekçeyle
    tutulur. 0093 `witness_sample`ı gevşek kapıya bağladı ve
    `app.numune_olayi()` o tabloya UPDATE yazıyor — yani yüzey 6'dan 7'ye
    çıktı. ⚠️ **Ama 0090 zincirde 0093'ten ÖNCE çalıştığı için bunu hiç
    görmedi.** Dondurduğum yüzey, dondurduktan sonra büyüdü (tuzak 124).
    ⚠️ Bu, Codex'in bulduğu MIYOP-075'in yaşadığı yerin ta kendisi. 0094
    rutini onardı; 0098 onu **adıyla listeye alıyor** ki bir dahaki
    denetimde gözden kaçmasın.
    ⚠️ **GEREKÇE CÜMLE OLARAK BIRAKILMADI.** "Bu rutin korumalı çünkü
    yalnız kapıdan geçmiş bir INSERT'in sonucu olarak çalışır" iddiası üç
    şart içeriyor; 0098 üçünü de ÖLÇÜYOR: kapı bağlı mı, rutin doğrudan
    çağrılabiliyor mu, kiracıyı doğrulayıp satırı kilitliyor mu. Biri
    yanlışsa göç patlıyor (tuzak 76).
    Olumsuz deneme: `witness_sample`a yazan sahte bir `security definer`
    fonksiyon eklendi, 0098 onu adıyla yakaladı.
    ⚠️ **0090 ARTIK TEK BAŞINA YENİDEN ÇALIŞTIRILAMAZ** — listesi eski.
    Sıfırdan zincir sorunsuz (0090, 0093'ten önce koşuyor); yüzey ölçümü
    gerektiğinde **0098** çalıştırılır. 0090 dosyasına DOKUNULMADI: uygulanmış
    bir göçü sonradan düzenlemek, canlıda koşan metinle depodaki metni
    ayırmak olurdu.
  - ✅ **3.9.9** ⚠️ **CODEX BEŞ BULGU DAHA GETİRDİ (27.10) · BİRİ CANLIDA
    AÇIK BİR P0'DI · göç 0099 + 0100**
    **MIYOP-078 · P0 · 0095 FİNANS KAPISINI YOK ETMİŞ.** 0065 gösterge
    fonksiyonunu yazdı, **0071 onu ikiye ayırdı**: ham hesap `..._ham`,
    asıl ad bir `finance.read` İZİN KAPISI. 0095'i yazarken gövdeyi
    0065'ten kopyalayıp asıl ada yazdım — kapıyı ezdim. Sonuç canlıya
    gitti: finans izni olmayan depo/üretim/kalite/gıda mühendisi, fire
    tutarını ve stok maliyeti göstergelerini doğrudan RPC'den okuyabildi.
    ⚠️ **Kendi doğrulamam hatayı GEREKTİRİYORDU:** *"`isletme_gostergeleri`
    gövdesinde `stock_usable_balance` var mı"* diye soruyordu ve ham gövdeyi
    oraya yazdığım için geçiyordu — doğru yere yazsaydım kırmızı verecekti.
    ⚠️ **Provam da kaçırdı:** göstergeleri yalnız `isletme_sahibi` oturumunda
    çağırıyordu ve onda izin VAR; kapının kalkması hiçbir fark yaratmıyordu.
    **Olumsuz kontrolü olmayan sınama, kapının yokluğunu da onaylar.**
    0099 kapıyı geri koydu, düzeltilmiş hesabı `_ham`'a yazdı, prova-0095'e
    olumsuz kontrol eklendi (15/15).
    ⚠️ **0099 İLK DENEMEDE CANLIDA PATLADI VE P0'I REHİN ALDI.** Doğrulamasına
    *"benzeri de kırıldı mı"* diye `fire_dokumu` kapısını da eklemiştim
    (tuzak 117'yi uygulayayım diye). O kontrol kırmızı verdi ve **Supabase
    bütün betiği tek işlemde çalıştırdığı için kapı onarımı da geri alındı** —
    yani fazladan koyduğum iyi niyetli bir kontrol yüzünden açık kapalı
    kalmadı. Kontrol kaldırıldı; `fire_dokumu` ayrı bir soru ve
    `araclar/teshis-canli-durum.sql` ile ölçülüyor (TABLO döndürüyor, çünkü
    Supabase `NOTICE` göstermiyor). Tuzak 129: bir göç ya ONARIR ya TEŞHİS
    EDER; kritik onarım ikincil bir kontrole bağlanmaz. **0095 dosyası da düzeltildi** —
    eski hâli yeniden çalıştırılsa *"Success"* der ve kapıyı sessizce
    düşürürdü; depoda böyle bir mayın bırakmak kuralı yorumda tutmak olurdu.
    Tuzak 127.
    **MIYOP-079 · KÖK SEBEP BULUNDU (27.10 akşam) · pano metni bozuyormuş.**
    Önce "Codex'e yapıştırırken bozulmuş, depo dosyası temiz" demiştim —
    **eksik teşhisti.** Emrah göç paketini Supabase'e yapıştırdığında
    Türkçe harflerin hepsi bozuk gitti (ekran görüntüsüyle doğrulandı).
    Sebep: `araclar/kaydet.ps1` panoya kopyalarken `Get-Content -Raw`
    kullanıyordu ve **Windows PowerShell 5.1 BOM'suz UTF-8 dosyayı ANSI
    (CP1254) sanıp çözüyor** — `İ`nin iki baytı `Ä°` oluyor. Kanıtlandı:
    `'İSTANBUL'.encode('utf-8').decode('cp1254')` = `Ä°STANBUL`, ekrandaki
    metnin aynısı.
    ⚠️ Kozmetik değildi: `app.kimlik_anahtari()` gerçek `İ`/`ı` yerine
    bozulmuş karakterleri aramaya başladı — numune kodu tekilliği zayıfladı.
    Hata mesajları da okunamaz hâle geldi ve müşteri onları görecekti.
    ⚠️ **Betiğin kendi başındaki not tam bu tuzağı yazıyordu** ama o uyarı
    betiğin KENDİ kodlaması içindi, okuduğu dosyalar için değil. Yazılı bir
    uyarı, uygulanmadığı yerde uyarmaz. `-Encoding UTF8` eklendi (tuzak 130).
    0099 ayrıca CANLIDA ölçüyor: dört i varyantı tek harfe katlanıyor mu.
    **MIYOP-081 · açılış sonucu sunucuda zorunlu değildi.** Ekran istiyordu,
    veritabanı istemiyordu — `write-off.service.ts`te yazdığım kuralın
    ihlali (*"gerekçe ekran kuralı değil servis kuralıdır"*). Göç 0100 bir
    `check` kısıtı ekledi. Prova 0100 (10/10) reddedilen açılışın **durumu
    ve saklama sonunu değiştirmediğini** de ölçüyor: tetik BEFORE INSERT'te
    güncelleme yapıyor, kısıt sonradan denetleniyor.
    **MIYOP-080 · liste ve sayı sessizce kesiliyordu.** Defter 500, parti
    300 satırla kesiliyor ve ekran **toplamları o kesilmiş listeden**
    hesaplıyordu: 500'üncüden sonraki eski bir açık kayıt hem listeden hem
    "İmha bekleyen" sayısından düşüyordu. Sayılar artık sunucuda sayılıyor
    (`ozet()`), kesilme ekranda yazıyor, ve **"yalnız imha bekleyenler"**
    süzgeci sunucuda çalıştığı için eski kritik kayıtlar erişilebilir.
    ⚠️ `numuneOzeti()` yardımcısı SİLİNDİ: duran bir yardımcıyı bir gün biri
    yeniden çağırır ve aynı hatayı geri getirir.
    ⚠️ **Gerçek sayfalama hâlâ YOK ve bu bir borç.** 500'üncüden sonraki,
    süresi DOLMAMIŞ eski bir numune hâlâ listelenmiyor. Bugünkü dürüst
    davranış kesildiğini söylemek; sayfalama demo sonrası.
    **MIYOP-082 · seçilemeyen partinin sebebi erişilemiyordu** — 26.10
    akşamı Emrah'ın bildirmesiyle zaten kapanmıştı (tuzak 126). Codex'in
    önerisi daha iyiydi ve uygulandı: parti artık `disabled` değil,
    **seçilebiliyor**, sebep yazılıyor ve kaydı düğme engelliyor.
    ⚠️ **ALTYAPI ONARIMI:** `db/prova/kur.sh` göçleri `00[0-9][0-9]_*.sql`
    deseniyle tarıyordu. **0100 bu desene uymadı** ve betik *"100 göç
    uygulandı"* diyerek sessizce geçti; prova-0100 kırmızı değil BOŞ döndü.
    Desen genişletildi **ve sağlama eklendi**: uygulanan sayı ile klasördeki
    dosya sayısı eşit olmalı (tuzak 128).
  - ✅ **3.12.1** ⚠️ **DAĞITIM BETİĞİNİN DOĞRULAMA ADIMI YALAN SÖYLÜYORDU
    (27.10)** · Emrah 26.10 yayınında üç kontrolün de `0` döndüğünü, altında
    ise **"YAYINDA"** yazdığını gösterdi. Ölçüldü: site gerçekten çalışıyor
    (Emrah tarayıcıda doğruladı, Şahit Numune ekranı canlıda).
    İki kusur: **(1)** Çağrı `-SkipHttpErrorCheck` kullanıyordu — o
    **PowerShell 7+** parametresi, 5.1'de YOK; `Invoke-WebRequest` hata
    atıyor ve `catch` onu yutuyordu. Kontrol hiçbir zaman çalışmamış.
    **(2)** `catch { $k = 0 }` **"kontrol edemedim" ile "çalışmıyor"u aynı
    şeye indiriyordu** ve betik yine de "YAYINDA" diyordu.
    Düzeltildi: PS 5.1 uyumlu çağrı, TLS 1.2, hata yutulmuyor (sebep
    yazılıyor), ve geçen/toplam sayılıyor — hepsi geçmezse betik
    *"DOSYALAR YAYINA ALINDI AMA DOĞRULANAMADI"* diyor. Tuzak 132:
    bir kontrolün üç sonucu vardır — geçti, kaldı, **ölçemedim**.
    - ✅ **3.12.1.1 ⚠️ AYNI ADIM BU SEFER YANLIŞ ALARM VERDİ (27.10 akşam).**
      Dağıtım geçti, site çalışıyor (Emrah ekranı doğruladı), ama betik
      *"DOĞRULANAMADI (2/3)"* dedi. Sebep: `/assets/` kontrolü **tam 403**
      bekliyordu, nginx **404** döndürdü. Oysa 404 da en az 403 kadar
      kapalıdır — `autoindex off` ve dizin, index dosyası olmadan servis
      edilmiyor. Yani kontrol doğru şeyi ölçtü, **benim beklentim yanlıştı.**
      ⚠️ **Yanlış alarm veren bir kontrol, hiç kontrol etmemekten de
      kötüdür:** bir sonraki sefer GERÇEK bir arıza da *"her zamanki uyarı"*
      diye geçilir. Beklenen artık bir **liste** (`@(403, 404)`).
      ⚠️ **Üstüne asıl eksik kontrol eklendi:** eski üç kontrol *"bir site
      ayakta"* diyordu, *"BU DAĞITIM yayında"* demiyordu. Betik artık
      `dist/index.html` içinden **bu derlemenin JS dosyasının adresini**
      (`index-XXXXXXXX.js` — adında içerik özeti var) okuyup sunucudan
      istiyor. Eski sürüm duruyorsa o adres 404 döner ve yalan söylenemez.
      ⚠️ Çıktıdaki kutu çizgileri (`═`) konsolda bozuk görünüyordu
      (`â•â•â•`); ASCII `=` yapıldı. Kullanıcının okuduğu metin okunaksızsa
      okunmaz.
  - ✅ **3.9.10** ⚠️ **FİRE DÖKÜMÜ KAPISI DA YOKMUŞ — CANLIDA · göç 0101**
    (27.10 · teşhis tablosu 8 satırın 7'si OK, biri değil)
    `araclar/teshis-canli-durum.sql` canlıda ölçtü:
    **`app.fire_dokumu` · finans kapısı → KAPI YOK.** Fire dökümü TUTAR
    taşıyor ve göstergelerden daha ayrıntılı (hangi ürün, ne kadar, kaç TL);
    kapısı olmayan bir fire dökümü, maliyeti herkese tek tek gösterir.
    ⚠️ **Teşhis tablosu olmasaydı bunu kimse görmezdi.** 0099'a koyduğum
    `fire_dokumu` kontrolü P0'ı rehin alıp kaldırılmıştı (tuzak 129); yerine
    koyduğum teşhis sorgusu bir gün sonra asıl işini yaptı. Kaldırılan bir
    kontrolün yerine ÖLÇÜM koymak, kontrolü kaldırmaktan farklıdır.
    **Ölçüm, sebep hakkında:** depoda `app.fire_dokumu` adına yalnız iki göç
    yazıyor — 0065 (ham hesap) ve 0071 (kapı). Teşhis tablosunun *"kaç tane
    ve nerede"* satırı canlıda **`app.fire_dokumu_ham`'ın VAR olduğunu**
    gösterdi; yani **0071 canlıda koşmuş** (ad değişikliğini o yapıyor) ve
    kapının üstüne SONRADAN 0065'in gövdesi yazılmış. ⚠️ **Ne zaman ve neyle
    yazıldığını bilmiyorum** — 0065'in yeniden yapıştırılması en olası yol
    ama bunu ölçmedim, söylemiyorum. 0101 yine de İKİ DURUMU DA onarıyor ve
    hangisinden geldiğini `notice` ile söylüyor; onarımı sebebi bilmeye
    bağlamak, açık bir kapıyı merak yüzünden açık tutmak olurdu.
    0101: ham hesabı `_ham`'a (gövde 0065'ten birebir; yerelde ölçtüm, canlı
    `_ham` gövdesi 0065'in metniyle BİREBİR aynı), kapıyı asıl ada,
    `security definer` DEĞİL. Doğrulaması yalnız kendi yazdığını ölçüyor
    (tuzak 133) + **en önemlisi: dış yüzeyin (`public.fire_dokumu`) KAPIYI
    çağırdığını** — `_ham`'ı atlayan bir dış yüzey, onarımı anlamsız kılar.
    Prova 0101 (**17/17**) yapısal kontrolle yetinmiyor: `depo_sorumlusu`
    oturumunda **MI403**, `isletme_sahibi` oturumunda **4 kg fire** okunuyor.
    İkisi de ölçüm; rolün izni olup olmadığı bile varsayılmıyor, ölçülüyor.
    ⚠️ **PROVA 0101 İLK HÂLİYLE KÖR PROVAYDI ve MIYOP-042'nin donmuş listesi
    onu yakaladı.** `yazma-kapilari-tamam.arch.test.ts` kırmızı verdi:
    *"YENİ kör prova: prova-0101.sql"*. JWT koymuştum ama
    `set local role authenticated` yapmamıştım; o satır olmadan prova tablo
    sahibi olarak koşar, **RLS atlanır.** MI403 yine gelirdi (izin kontrolü
    JWT'ye bakıyor) ama 6b ve 7 **yanlış sebeple** yeşil olurdu: RLS'siz
    okunan bir rapor, kapıyı değil sahipliği ölçer. Rol takıldı, 17/17 yine
    yeşil — ama artık doğru sebeple. ⚠️ Not: bu kuralı aylar önce yazmıştım
    (kontrol listesi 15) ve **kendi yeni provamda yine unuttum.** Yazılı kural
    uyarmadı; ÖLÇEN test uyardı. Kuralı koda bağlamanın karşılığı tam bu.
    ⚠️ **Mimari test genelleştirildi (tuzak 135):** eski hâli üç dosyayı
    okuyup *"0095 fire_dokumu'ya yazmasın"* diyordu — listede olmayan bir
    göç bunu yapsa göremezdi. Artık `db/migrations` klasörünü tarıyor:
    *"0071'den SONRAKİ hiçbir göç bu iki ada ham hesap yazamaz."* Yarın
    yazılacak göçü de ölçer.
    ⚠️ **0101'in doğrulaması ilk yazışımda yanlış ölçüyordu** ve bozuk durum
    provası bunu yerelde yakaladı: `pg_get_function_identity_arguments`
    argüman ADLARINI da döndürüyor (`'p_sube uuid, …'`), ben tip listesi
    bekliyordum, fonksiyon "yok" sayılıyordu. Canlıda patlasaydı Supabase
    paketi geri alır ve kapı yine açık kalırdı (tuzak 137).
    ⚠️ **Paket kuralı yazıldı (tuzak 136):** güvenlik onarımı, veriye bağlı
    bir göçle AYNI PAKETTE gitmez. 0099 ile 0100 aynı pakette gitmişti;
    0100 düşse onarım da geri alınacaktı. `araclar/goc-bekleyen.sql` artık
    yalnız 0101'i taşıyor ve başlığında bu kural yazılı.
    ⚠️ **`paket-bozuk-durumdan.sh` onarıldı (Codex'in üç bulgusu + biri
    benden):** `set -o pipefail` yoktu, `--single-transaction` yoktu (yani
    prova Supabase'den DAHA HOŞGÖRÜLÜYDÜ), tek beklenti türü vardı
    (artık **ONARIR / DAYANIR** ayrı), ve `mktemp -d` 0700 açtığı için
    postgres taklit dosyalarını okuyamıyor, betik bunu *"taklit yanlış"*
    diye yanlış sebeple bildiriyordu. Dört senaryo da yeşil (tuzak 138).
  - ✅ **3.9.3** ⚠️ **ETİKET SAKLAMA KOŞULUNU ARTIK ÜRÜN KARTINDAN OKUYOR
    (27.10) · şahit numunenin SON maddesi.** Eksik şuydu: saklama koşulu
    hiçbir yerde **saklanmıyordu** — etiket ekranında her baskıda **elle
    yazılan** serbest bir metin alanıydı (yer tutucu `0–4 °C`). Aynı ürün iki
    baskıda iki farklı koşul taşıyabiliyordu; üstelik aynı lotun şahit
    numunesi koşulu **karttan** kopyalıyor (0093/0094), yani tek ürünün iki
    "kayıtlı" saklama koşulu olabiliyordu — biri numune defterinde, biri
    ambalajın üstünde. Hangisi doğru? Kimse bilemezdi.
    **Ne yapıldı:** `label.repository.ts` kalem sorgusu artık
    `storage_condition, tracks_lot, tracks_expiry` sütunlarını da okuyor;
    `EtiketKalemi` saklamayı ve iki takip bayrağını taşıyor.
    ⚠️ **KAYNAK SIRASI: ÜRÜN KARTI ÖNCE.** Kart doluysa ekranda yazılan değer
    **yok sayılıyor** — ekran kartla çelişen bir etiket basabilseydi "kartta
    ne yazıyorsa o basılır" güvencesi biterdi.
    ⚠️ **Emrah'ın kararı (c):** koşul **lot ya da SKT takipli** üründe zorunlu,
    ötekinde sessiz. Türk Gıda Kodeksi *"gerektiğinde"* diyor; kuru bakliyatta
    aranmaz, soğuk zincirde şarttır. Ayırt edici ölçüt takip: takip edilen
    ürün bozulabilen üründür. Zorunlu üründe koşul boşsa etiket **TASLAK**
    basılıyor ve eksik cümlesi **nereye yazılacağını** söylüyor (Depo →
    Saklama Beyanı). Takipsiz üründe satır sessizce basılmıyor — zorunlu
    tutsaydık kural değil kilit olurdu.
    ⚠️ **Elle yazılan kutu KALDI** (Emrah'ın ikinci kararı) ama dürüstleşti:
    kart doluyken **salt okunur** ve "ürün kartından geliyor" yazıyor; kart
    boşken yazılabiliyor ama "**bu değer karta kaydedilmedi, sonraki baskıda
    yeniden yazman gerekir**" deniyor. Kullanıcı etikette gördüğü değerin
    nereden geldiğini biliyor, yanlışsa nereyi düzelteceğini de.
    **Ölçüm:** 9 yeni servis sınaması + 7 belge sınaması + yeni mimari test
    `src/production/etiket-saklama-kaynagi.arch.test.ts` (7 sınama).
    ⚠️ Mimari test **dosyanın metnini** ölçüyor, çünkü arıza bir sütunun
    `select` listesinde OLMAMASIYDI — sahte depolu bir davranış testi gerçek
    sorguyu hiç görmez. Kuralı 0093'ün **sütun yorumuna** yazmıştım
    (*"Etiket de buradan okumalı"*); o yorum bir yıl uyarmadı (tuzak 139).
  - ✅ **3.9.5** **Yedek defterine eklendi.** `tenant-export.arch.test.ts`
    her kiracı tablosunun ya yedekte ya **gerekçeli** dışarıda olmasını
    zorunlu kılıyor; iki yeni tablo yazılmayınca test kırmızı verdi ve
    **doğru yakaladı.** `witness_sample` ve `witness_sample_event` yedeğe
    eklendi — numune partiden SONRA, olay defteri numuneden SONRA (geri
    yüklemede ebeveyn önce gelmeli).
  - ✅ **3.9.4** **ŞAHİT NUMUNE EKRANI AÇILDI (26.10).**
    Emrah 26.10'da haklı olarak yazdı: *"miyop.emrahevren.com'dan baktım,
    Şahit numune ekranı yok."* Defter 0093'te kurulmuştu ama ekran yoktu —
    **kullanıcı için YOK demekti.**
    `src/pages/SahitNumune.tsx` + `src/quality/witness-sample.repository.ts`
    + `witness-sample.service.ts`. Üç kapı da yazıldı: rota tipi
    (`sahit-numune`), rota barındırıcı, menü ögesi (**Kalite → Şahit
    Numune**, 3. sırada).
    Ekranın dört işi: **numune al** (üretilmiş partiden), **izle** (ne
    saklıyoruz, hangisinin süresi doldu), **aç** (müşteri önünde; gerekçe
    VE sonuç zorunlu), **imha** (gerekçe zorunlu).
    ⚠️ **Ekran hiçbir şey hesaplamıyor.** Saklama koşulu, saklama sonu,
    açık raf ömrü ve imza sunucudan geliyor. Ekranda hesaplanan tek şey
    "bugün o günü geçti mi" GÖSTERİMİ. Süreyi ekranda hesaplamak en kolay
    yol olurdu ve en tehlikelisi: bir gün sunucudan ayrışır, ekran
    *"3 gün kaldı"* derken sunucu numuneyi süresi dolmuş sayar.
    ⚠️ **Görme izni ÖLÇÜLDÜ, tahmin edilmedi:** `role_permission`
    tablosunda `quality.read` kalite sorumlusu, gıda mühendisi, üretim
    sorumlusu, **depo sorumlusu**, müdür ve sahipte var — altısı da bu
    akışın içinde (İsmet: *"gıda teknikeri ve DEPOCU kontrolünde"*).
    Yazma kapısı ayrı ve daha dar: `quality.record.manage` **veya**
    `production.write`. Yani depocu defteri görür, kayıt açamaz.
    ⚠️ **Eski donmuş "Şahit Numune" ögesi yerinde duruyor ve menüye
    ÇIKMIYOR.** O öge `pages/WitnessSamples.tsx`e bakıyor, tamamı
    `witness-samples/witness-sample.mock.ts`ten besleniyor. Menüde iki
    "Şahit Numune" birden durmaz.
    Yeni çıcır: `src/quality/numune-kapisi.arch.test.ts` — göçteki
    `izin_gerek_coklu(...)` listesini AYRIŞTIRIP ekrandaki
    `NUMUNE_IZINLERI` ile karşılaştırıyor; ikisi ayrışırsa kırılıyor.
  - ✅ **3.9.6** **ÜRÜN KARTINA SAKLAMA BEYANI YAZILABİLİYOR (26.10) ·
    göç 0096 + Depo ekranı**
    ⚠️ Bu olmadan ekran **kullanılamazdı** ve fark etmemiştim: saklama
    koşulu kartta duruyordu ama kartı güncelleyen **hiçbir yol yoktu**
    (`StokKatalogu` yalnız `kalemEkle` taşıyordu, "Stok Kartları" ekranı
    donmuş). Yani var olan ürünlerin koşulu hiçbir zaman yazılamaz, o
    ürünlerden numune hiçbir zaman alınamazdı.
    Yapılan: `kalemBeyaniniGuncelle` (yalnız iki beyan alanı; kod ve temel
    birim sonradan değişemez), Depo ekranında **"Saklama Beyanı"** düğmesi,
    yeni kalem formunda iki alan, ve seçili kalemde **her zaman görünen**
    bir satır: *"Saklama koşulu: belirlenmedi — müşteriye bildirilen koşul
    yazılı olmadan bu üründen şahit numune alınamaz."*
    ⚠️ **GÖÇ 0096 · SAKLAMA KOŞULU BİR BEYANDIR.** Kartın kapısı
    (`app.stok_karti_izni`) bu iki alanı sıradan kart alanı sayıyor ve
    `stock.write` istiyordu. `stock.write` **kalite sorumlusunda ve gıda
    mühendisinde YOK.** Yani numunenin kuralını kalite uyguluyor, o
    kuralın girdisini kalite yazamıyordu. İki alan artık `net_qty` ve
    alerjen damgası gibi **beyan** sayılıyor: `quality.declaration` de
    yetiyor. ⚠️ `stock.write` KALDIRILMADI — depocu ve üretim de yazmaya
    devam ediyor. Prova 0096: **9/9**, içinde "kalite kartın ADINI
    değiştiremiyor" ve "reddedilen işlem satırı DEĞİŞTİRMEDİ" sınamaları.
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
- ✅ **3.11** **Karşılama ekranı (`workspace-welcome`) · MIYOP-065 · BİTTİ (29.10)**
  ⚠️ **Müşterinin gördüğü İLK ekran budur** — şifresini belirledikten hemen
  sonra buraya düşüyor. Dört şey düzeltildi:
  - **Dil.** Ekran Türkçe karaktersiz yazılmıştı *ve* geliştiricinin
    dilindeydi: *"Workspace henuz bos"*, *"Ilk Widget Ekle"*,
    *"Dashboarda Git"*, *"Premium onboarding deneyimi aktif"*,
    *"Product tour, quick tips, getting started kartlari ve empty state
    sistemi birlikte calisir."* Sonuncusu müşteriye değil, bize söylenmiş
    bir cümleydi. Hepsi yeniden yazıldı.
  - **Sahte rozet.** *"İlk stok kartı tamamlandı"* `hasBusinessModules` ile
    ölçülüyordu — bir MODÜL kaydının varlığıyla. Yeni müşteri hiçbir şey
    yapmadan "tamamlandı" görüyordu. Artık üç adımın üçü de veritabanından
    **sayılıyor** (`src/workspace/karsilama.repository.ts`).
    ⚠️ Sorgu düşerse `null` dönüyor, `0` değil: "sayamadım" ile "hiç yok"
    aynı şey değil, ve ikincisini göstermek müşteriye yanlış iş yaptırır.
  - **Çalışmayan düğmeler.** *"Reçetelere Git"* ve *"Ürünlere Git"* donmuş
    rotalara gidiyordu. Kaldırıldı. Altı adım üçe indi ve üçü de çalışıyor:
    firma bilgileri → ilk ürün kartı → ekip.
  - **Tarayıcı bağımlılığı.** Firma adını `localStorage`dan okuyordu;
    artık veritabanından okuyor. `kiraci-ekrani-veri-kaynagi.arch.test.ts`
    çıcırı **3 → 1**'e indi.
  ⚠️ *"İşletme Ayarları"* düğmesi BİLEREK konmadı: o ekran hâlâ tarayıcıya
  yazıyor (3.4), yeni müşteriyi ilk dakikasında oraya yollamak onu
  "kaydedildi" deyip kaybeden bir ekrana yollamak olur.
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
- ✅ **3.7** **MIYOP-010 + MIYOP-064 · KAPANDI (29.10) · 7/7 ekran**
  · **A3 BİTTİ**
  ⚠️ Kusur ölçüldü, tahmin edilmedi. `Etiketler.tsx`:
  `sec()` içinde `setSecili(k)` HEMEN, `await ayrintiYukle(k)` SONRA. Arada
  ekranda **B'nin adı, A'nın alerjenleri** duruyordu ve Kaydet'e basılırsa
  A'nın beyanı B'nin kartına yazılabiliyordu. İkinci kusur: `sec()` içinde
  iptal koruması YOKTU — hızlı A→B'de A'nın cevabı B'ninkinden sonra dönerse
  B'nin ayrıntısını eziyordu, hiçbir hata çıkmadan.
  **Ortak çözüm:** `src/core/secim/ayrinti-kapisi.ts` — React'sız, isteksiz,
  zamansız **saf** bir karar birimi. İki soruyu cevaplıyor: *"gelen cevabı
  yazayım mı"* ve *"yazma düğmesi açık mı"*. Kimlik SÜRÜM NUMARASI sayılıyor;
  ayrı bir sayaç yok. 15 birim sınaması (hepsi gerçek kodla koşturularak
  ölçüldü).
  ⚠️ Kapı ekranda ÜÇ yere birden takılıyor: düğme `disabled`, eylemin
  **gövdesinde** erken dönüş, ve ekranda **sebep yazılı** (tuzak 126).
  Yazdırma da yazma sayılıyor: kâğıt ambalaja yapışır, geri alınamaz.
  ⚠️ `ayrinti-kapisi.arch.test.ts` kalan altı ekranı **adlarıyla
  dondurdu** — liste yalnız kısalır. Bir ekrana kapı takılınca test kırmızı
  verir ve listeden çıkarılmaya zorlar; kalan iş sayılabilir kalıyor.
  **Liste 6 → 5 → 4 → 3 → 2 → 0 diye kısaldı ve 29.10'da BOŞALDI.**
  - ✅ **3.7.3** **YEDİ EKRANIN YEDİSİ DE TAKILDI (29.10 gecesi).**
    Her ekranda altı şey ölçülüyor: kapı içeri alınmış, seçimde `secildi()`
    çağrılıyor, geç gelen cevap atılıyor, düğmeler `ayrintiHazir` ile
    kapanıyor, kapı eylemin **gövdesinde** de duruyor, ve **sebep ekranda
    yazılı**.
    **Her ekranın kendi bedeli yazıldı:**
    · **Etiketler** — B'nin başlığı altında A'nın alerjeni; Kaydet A'nın
      beyanını B'nin kartına yazabiliyordu.
    · **Depo** — Çıkış formu A'nın lotlarını B için listeliyor, Sayım yanlış
      bakiyeyle karşılaştırıyor, maliyet A'nınkini gösteriyordu.
    · **Siparişler** — `isEmriCikar` ekrandaki satırlardan üretim başlatıyor,
      `irsaliyeYazdir` kâğıt basıyor, revizyon formu ekrandaki satırları
      başlangıç değeri alıyordu. Sekiz liste birden eziliyordu.
    · **Sevkiyatlar** — ⚠️ **kısmen zaten korunuyordu:** 09.10'da ölçümler
      için `olcumSevkiyatId` konmuştu ("A'nın sıcaklığı B'nin irsaliyesine
      basılır" tuzağı). Ama koruma **yalnız o alandaydı**; hareket, lot ve
      içerik eskisini tutuyordu. **Alan alan koruma, bir alanı unutmaya
      açıktır.**
    · **Müşteriler** — bedeli FİYAT: "fiyat deftere yazılır, değiştirilemez".
      Üstelik "+ Nokta" düğmesi yeni kodu **ekrandaki** nokta listesinden
      türetiyordu: yanlış listeyle B müşterisine A'nın sırasından kod
      verilirdi.
    · **İş Emirleri** — Başlat hammaddeyi deftere düşürüyor, Tamamla mamul
      girişi yazıp yeni lot açıyor; ikisi de geri alınamaz.
    · **İzlenebilirlik** — eski zinciri zaten temizliyordu ama **geç gelen
      cevap koruması yoktu**. Yazma eylemi yok; buna karşılık bedeli en ağır
      olan ekran bu: çıkan kâğıt GERİ ÇAĞIRMA listesi.
    ⚠️ **AYNI TUZAK BEŞ EKRANDA TEKRARLANDI ve beşinde de yakalandı:** yeni
    kayıt eklendiğinde ya da işlem sonrası yenilemede `setSecili`/`setSeciliId`
    çağrılıyor ama **ref güncellenmiyordu**; o hâlde kapı kaydın KENDİ
    cevabını "geç gelen" sanıp atacak ve ekran boş kalacaktı.
    ⚠️ **Mimari test kuralı ölçüyor, YAZIMI değil:** geç cevap koruması hem
    erken dönüşle (`!==`) hem korumalı yazımla (`===`) yapılabiliyor;
    düğme kapısı hem `!ayrintiHazir(secim)` hem alt bileşene geçirilen
    `!ayrintiHazirMi` ile. Tek bir yazımı dayatmak doğru çözümü reddetmek
    olurdu.
    ⚠️ Kapının **saf kaldığı** da ölçülüyor: içine React ya da istek sızarsa
    test kırmızı verir — karar yedi ekranın ortak malı, biri onu kendi
    içinde yeniden yorumlayamaz.
  - ✅ **3.7.1** **KAPANDI (29.10, 3.7.3 ile birlikte)** · MIYOP-064 · beş ekran daha (Codex, 21.10):
    Depo, Siparişler, Müşteriler, İş Emirleri, Sevkiyatlar. Desen aynı:
    seçim **hemen** değişiyor, ayrıntılar isteklerin tamamı dönünce
    yazılıyor, istek düşerse **eski kaydın ayrıntısı ekranda kalıyor** ve
    yeni kaydın kimliğiyle kaydedilebiliyor/yazdırılabiliyor.
    ⚠️ Yalnız Etiketler'e yama atmak bu aileyi kapatmaz (tuzak 104'ün
    kardeşi). Çözüm ortak: ayrıntıyı **seçili kayıt kimliği + istek
    sürümü** ile tut, seçimde eskisini temizle, ayrıntı hazır olmadan
    yazma/yazdırma düğmelerini kapat.
  - ✅ **3.7.2** **KAPANDI (29.10)** · `Traceability.tsx` eski ayrıntıyı zaten
    temizliyordu ama **geç gelen cevap** koruması yoktu; ayrıntı kapısı ona da
    takıldı (3.7.3'teki yedinci ekran). ⚠️ Bu madde 01.11'e kadar ⬜ duruyordu.

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
- ✅ **4.11** **GERİ ARAMA TALEPLERİ** · ana ekrandaki "Sizi arayalım"
  formunun karşılığı (göç 0106, 06.11.2026).
  Emrah: *"Bilgi isteyenleri arayabileceğimiz bir form doldursunlar."*
  - Ana ekranda tek kapı vardı: **İşletme Başvurusu** — 14 alan ve anlamı
    *"almaya karar verdim"*. İlk temas ise *"bu ne, kaça, bize uyar mı"*
    diye başlar; o kişi 14 alan doldurmaz. Yeni form **beş alan**.
  - ⚠️ Tarayıcı hafızasına düşen yol **YOK**: bağlantı yoksa form
    "kaydettim" demiyor, açıkça söylüyor. (Başvuru formunun eski
    `localStorage` yolu var; burada uydurulmadı.)
  - ⚠️ KVKK onayı **kutu değil kolon**: `consent_at` NOT NULL, onaysız
    kayıt fiziken oluşamıyor. Aydınlatma metni **taslak** — hukukçuya
    gösterilecek. Metin saklama süresi vaat etmiyor (kendiliğinden silen
    iş yok); vaat ettiği silme hakkının karşılığı var (`geri_arama_sil`
    + ekrandaki düğme).
  - ⚠️ Spam kapısı sunucuda: aynı numaradan açık talep varsa ikincisi
    reddediliyor, 24 saatte en çok üç talep. **IP sınırı yok** ve bu
    yazılı — söylenmeyen sınır, yanlış sanılan sınırdan iyidir.
  - Kanıt: `db/prova/prova-0106.sql` · **69 doğrulama**, gerçek
    PostgreSQL, `anon` ve `authenticated` rollerine girilerek.
  - ⬜ **4.11.1** Yeni talep gelince **zil/bildirim yok.** Panelde
    görünüyor, ama Emrah ekranı açmadıkça haberi olmuyor.
    `basvuru_bildirimi` deseni var; aynısı buraya da kurulabilir.
  - ⬜ **4.11.2** **Otomatik saklama süresi (KVKK) yok.** Kapanmış bir
    talep elle silinene kadar duruyor. Aydınlatma metni bu yüzden süre
    vaat etmiyor; süre vaat edecekse önce silen iş kurulur.
  - ✅ **4.11.3** **ÖLÇÜM SIRASINDA ÇIKTI · `prova-0077` bayatlamış.**
    0106'nın provasını koştururken yerel takımda iki dosya kırmızıydı ve
    **ikisi de 0106'dan önce de kırmızıydı** — ben bozmadım. 0077'de iki
    iddia eski kuralı savunuyordu:
    · `'  Depo Cu  '` için `depocu` bekliyordu; **0078** boşluğu bilerek
      NOKTAYA çeviriyor (`Alaattin Kocatepe` → `alaattin.kocatepe`), yani
      doğru cevap `depo.cu@bulunamadi.miyop.local`.
    · *"anon sarmalayıcıyı çağırabiliyor"* diyordu; **0102** o kapıyı
      bilerek kapattı. ⚠️ Yani kırmızı, kapının ÇALIŞTIĞINI gösteriyordu
      ve "düzeltmenin" en kolay yolu geri alınmış bir kararı geri
      getirmekti. Bölüm tersine çevrildi + `service_role` ile davranış
      ölçümü ve `anon` için olumsuz kontrol eklendi. **27 doğrulama yeşil.**
  - ✅ **4.11.4** **ÖLÇÜM SIRASINDA ÇIKTI · `prova-0093` bayatlamış.**
    Kırmızısı `✗ <NULL>` diyordu — hangi iddia olduğunu söylemiyordu.
    Sebep: iddia metni ölçülen değeri içine katıyor, değer NULL olunca
    metnin tamamı NULL oluyordu. ⚠️ Ölçümün başarısızlığı, ölçümün ADINI
    da siliyordu; `prova_bak` artık `coalesce` ile bunu söylüyor.
    Altındaki üç iddia da eski kuralı savunuyordu:
    · `sample_code_key = 'num-1'` arıyordu; **0094** anahtarı
      `app.kimlik_anahtari()`den türetiyor ve BÜYÜK HARFE çeviriyor
      (`num-1` ile `NUM-1` aynı numune — tekilliğin istediği şey). Arama
      artık sabit yazılmıyor, fonksiyondan alınıyor.
    · İmhayı ÜRETİM sorumlusu yazıyordu; **0097** imhayı onay işine
      çevirdi (müdür, gıda mühendisi ya da kalite). Eski iddia silinmedi,
      **olumsuz kontrole** çevrildi. **22 doğrulama yeşil.**
  - ✅ **4.11.5** **BÜTÜN PROVALAR KOŞTURULDU — 13'Ü KIRMIZIYDI, HEPSİ
    ONARILDI** (07.11, Emrah: *"kesin koştur"*). Temiz PostgreSQL 16'ya
    **107 göçün hepsi** uygulandı, `db/prova` altındaki **54 dosyanın
    tamamı** koşturuldu. İlk ölçüm: **41 yeşil, 13 kırmızı.**
    ⚠️ Kırmızıların **hiçbiri** o günün kodundan gelmiyordu; on üçü de
    bayatlamıştı — her biri bir zamanlar doğru olan bir cümleyi
    savunuyordu (tam tablo: tuzak 190).
    - `0051` ← 0061 araya "Onay Bekliyor" + zorunlu onay adımı koydu
    - `0056`, `0057` ← `ABC` kiracısı temiz kurulumda yok (0058 bu
      onarımı almıştı, bu ikisi unutulmuştu)
    - `0057` ← 0072 alerjen damgasını elden aldı
    - `0065`, `0070` ← 0071 `finance.read` kapısını koydu
    - `0065` ← 0092 SKT kapısını koydu
    - `0071b` ← 0074 ve 0085 iki `_ham` fonksiyon daha ekledi
    - `0071c` ← **başka makinenin mutlak yolunu** çağırıyordu ve **hiç
      doğrulama basmıyordu**; `\ir` ile ve altı `prova_bak` ile yeniden
      yazıldı
    - `0073` ← 0081 `quality.record.manage` iznini ekledi (34 → 35)
    - `0076` ← 0078 boşluğu noktaya çevirdi (`depocu` → `depo.cu`)
    - `0078` ← 0102 `anon`un giriş-adı çevirme hakkını kapattı
    - `0083` ← 0084 `platform_populer_urunler`i bilerek düşürdü; ayrıca
      "09:00 diliminde 5 işlem" iddiası **saate bağlıydı** ve 06:xx
      UTC'de koşunca sahte kırmızı veriyordu
    - `0088` ← 0093 `witness_sample`ı kapıya aldı (27 → 28)
    - `0090` ← 0093 `app.numune_olayi`yı getirdi (6 → 7)
    ⚠️ **Hiçbir kapı gevşetilmedi:** eksik oturum kuruldu, eksik onay
    verildi, damga gerçek yoldan attırıldı; düşürülmüş fonksiyonun
    iddiası silinmedi, **tersine çevrildi**. Son ölçüm: **54 yeşil,
    0 kırmızı**, üst üste üç koşuda aynı.
    ⚠️ **Asıl bulgu:** bu provalar tek tek koşturuluyordu. Bir arada
    koşmak bir adıma bağlı değildi — yani kimsenin görevi değildi.
    → kontrol listesi 131
    ⚠️ **ONARIMIN KENDİSİ DÖRT KÖR PROVA ÜRETTİ ve bunu bir test
    yakaladı.** `0057`, `0065`, `0070`, `0071c`ye JWT kondu ama
    `set local role authenticated` konmadı — yani kapının **dışında**
    koşuyorlardı (MIYOP-042). `yazma-kapilari-tamam.arch.test.ts`
    kırmızı yandı. Donmuş listeye ad **eklenmedi** (eklemek, listenin
    koruduğu şeyi kaldırmaktı); dördünde de rol **takıldı**: okumalar
    `prova_gosterge()`/`prova_fire()` sarmalayıcısına, beyan çağrıları
    rolün içine alındı. → kontrol listesi 135, 136
  - 🔄 **4.11.6** **ANA EKRAN, BAKANA GÖRE DEĞİŞİYOR** (06.11, Emrah'ın
    ekran görüntüleri). Aynı kod, iki farklı görüntü: `localhost`'ta form
    kutuları beyaz ve düğme mavi; `miyop.emrahevren.com`'da kutular koyu,
    etiketler sönük, düğme turkuaz. **Okunabilirlik bozuluyor.**
    ⚠️ **Mekanizma bulundu** (`src/components/ThemeProvider.tsx`): tema
    `localStorage`'da saklanıyor (`miyop-theme`, `miyop-theme-accent`) ve
    `<html>` üzerine HER SAYFADA yazılıyor — **giriş vitrini dahil**.
    Depo her alan adı için ayrı; Emrah prod'da uygulamayı kullandığı için
    orada bir tema kayıtlı, localhost'ta yok. Varsayılan `light` +
    `miyopBlue`; prod'daki turkuaz düğme başka bir vurgu renginin seçili
    olduğunu söylüyor.
    ⚠️ **AMA PROD GÖRÜNTÜSÜ BİREBİR TEKRAR ÜRETİLEMEDİ.** Gerçek
    `styles.css` ile, `data-theme=dark` + `data-theme-engine=premium` +
    `data-theme-accent` + `color-scheme:dark` kurulup Playwright'la
    ölçüldü: kutular yine **beyaz** çıktı. Yani sebep bu dörtlüden
    ibaret değil. Canlı siteye bu ortamdan erişim kapalı (egress 403),
    bu yüzden **körlemesine düzeltme yazılmadı** — hangi değerin etkili
    olduğu Emrah'tan ölçülecek.
    - ✅ **4.11.6a** Ölçüldü (Emrah, 06.11): **gizli pencerede kutular
      BEYAZ, düğme MAVİ** — yani localhost'la aynı. Sebep kesinleşti:
      **tarayıcıda kayıtlı tema**, dağıtım değil. Ziyaretçi doğru
      görüntüyü görüyor; bozuk görüntüyü yalnız daha önce giriş yapmış
      olan (Emrah) görüyor.
    - ✅ **4.11.6b/c** **VİTRİN TEMADAN BAĞIMSIZ** (06.11). Giriş vitrini
      ve herkese açık başvuru sayfası artık tek görünüme sabit.
      ⚠️ Tema motoru DEĞİŞTİRİLMEDİ; uygulamanın geri kalanı temayı aynen
      kullanıyor. Yapılan, iki herkese açık sayfayı onun dışına almak.
      ⚠️ Hedef renkler **uydurulmadı, bugünkü ziyaretçi görünümünden
      ölçüldü**. İlk yazımda kendi seçtiğim renkleri koydum; ölçüm
      varsayılan temadaki yedi alanın altısının değiştiğini gösterdi —
      yani bozuk hâli düzeltirken sağlam hâli de değiştiriyordum.
      ⚠️ Ölçüm: Playwright, gerçek `styles.css`, **yedi tema/vurgu
      birleşimi → hesaplanan renkler birebir aynı**; varsayılan temada
      değişen tek alan birincil düğmenin YAZI rengi (mavi zemin üzerinde
      koyu yazı okunabilirlik sınırındaydı, beyaza sabitlendi).
      ⚠️ Sınıf adı seçicide **iki kez** yazılı: tek yazımla özgüllük tema
      kuralıyla berabere kalıyor ve yalnızca dosya sırası sayesinde
      kazanıyordu — sıraya dayanan kural bir sonraki eklemede sessizce
      kaybeder.
      Donduran sınama: `src/pages/vitrin-temadan-bagimsiz.arch.test.ts`.
      ⬜ **Emrah'ın gözüyle doğrulanacak:** ölçüm hesaplanan RENKLERİ
      karşılaştırıyor, sayfanın yerleşimini değil.
  - ✅ **4.11.7** **ZİL ÇALIŞIYOR — CANLIDA, EMRAH'IN TARAYICISINDA
    ÖLÇÜLDÜ** (07.11, 10:59). Kusur **kodda değildi.**

    ⚠️ **ÖNCE NE OLMUŞTU:** 06.11 akşamı madde ✅ işaretlendi — **ürüne
    bakılmadan.** Emrah baktı, "rozet yok" dedi; madde 🔴 yapıldı — yine
    **ürün ölçülmeden**, sebep tahmin edilerek ("zilin tamamı susmuş
    olabilir"). İki işaret de yanlıştı ve ikisinde de eksik olan aynı
    adımdı: **çalışan ürüne bakmak.** → tuzak 191

    **ÖLÇÜM** (canlı site, Emrah'ın Chrome'u, `index-BQ8FN3LM.js`):
    - Zil paneli **8 satır** gösteriyor; ikisi geri arama talebi
      (`GER-2R432`, `GER-5XPUW`), üçü lisans, üçü "giriş hesabı açılmadı".
    - Satırların hepsinin sınıfı `notification-item warning **read**`.
      Rozet yok çünkü **rozet yalnız OKUNMAMIŞLARI sayıyor.**
    - `localStorage` → `evren360_bildirim_okundu` sebebi kesinleştirdi:

          geri_arama_GER-35G7T_NEW : 2026-11-06T19:38:06Z
          geri_arama_GER-2R432_NEW : 2026-11-06T19:38:34Z
          geri_arama_GER-5XPUW_NEW : 2026-11-06T19:38:49Z

      Bu kimlikleri **yalnız yeni kod üretir** ve bu damgalar ancak
      zildeki satır **tıklanınca** düşer. Yani üç talep zilde göründü ve
      Emrah üçünü de 28 ve 15 saniye arayla tek tek tıkladı (toplu
      "okundu yap" olsa damgalar aynı salise olurdu). Altı eski
      başvuru/lisans satırı da aynı yoldan okunmuş (17 Eki – 1 Kas) —
      **"6 rozet → 0"ın sebebi budur.**
    - Zil ile panel **birebir tutarlı**: panel *"2 talep bekliyor ·
      Hepsi (3) · Bekliyor (2) · Arandı (1)"* diyor, zil tam o iki
      bekleyeni gösteriyor. Üçüncüsü arandı, zilden doğru şekilde düştü.

    **KARAR (Emrah, 07.11):** *"zil okunmamışları saysın, okununca bir
    daha bildirim vermesin ama okunan bildirim yine aynı yerde dursun."*
    → **Bugünkü davranış tam olarak budur; kod değişmedi.** Rozet
    okunmamışı sayar; okunan satır listede aynı yerinde, "Okundu"
    etiketiyle durur.
    Aşağıdaki tasarım notları duruyor (kod yazıldı, davranış açık): (Emrah 06.11: *"bildirim zili kurulsun
    şimdi, sonradan uğraşmayalım."*) Zilin **üçüncü kaynağı** eklendi:
    başvurular, lisans, **geri arama**.
    - **Bildirim saklanmıyor, TÜRETİLİYOR** — başvurudaki desenin aynısı
      ve aynı gerekçe: saklasaydık iki gerçek olurdu (talebin durumu ve
      bildirimin durumu) ve ayrışırlardı. Liste neyse zil odur.
    - ⚠️ **Yalnız BEKLEYEN talep zile düşüyor.** Arandı/kapandı olan bir
      talep iş değil kayıttır; zilde durursa asıl bekleyeni gizler.
    - ⚠️ **Uyarı eşiği 4 saat** — başvurudaki 3 günün aksine. Başvuru
      yapan karar vermiştir, bekleyebilir; bilgi isteyen beklemez.
      **Bu bir taahhüt DEĞİL**, yalnız zilin rengi; ekranda hiçbir yerde
      "4 saatte ararız" yazmıyor.
    - Zildeki satır **numarayı** (GER-XXXXX) taşıyor ve tıklanınca Geri
      Arama Talepleri ekranını açıp arama kutusunu o numarayla dolduruyor.
      ⚠️ İç kimlik (uuid) taşınmadı: ekran onu hiçbir yerde göstermiyor,
      yani tıklanan satırı bulmaya yaramazdı.
    - Satırda **uygun arama saati** de yazıyor: *"şimdi mi arayayım, akşam
      mı"* sorusunun cevabı ekranı açmadan görünsün diye.
    - Çıtır: `src/notifications/geri-arama-bildirimleri.test.ts` (22) ve
      `zil-yonlendirme.arch.test.ts` (yeni üç sınama).
    - ⚠️ **Zil kendiliğinden ÇALMIYOR**, sayfa tazelendiğinde/panel
      açıldığında okunuyor. Anlık itme (push/realtime) yok ve yazılı.
      → 4.11.8
  - ⬜ **4.11.8** **Zil TAZELENİYOR ama SESSİZ.**
    ⚠️ **BU MADDENİN İLK YAZIMI YANLIŞTI.** *"Bildirimler sayfa
    tazelendiğinde ya da panel açıldığında okunuyor… bir yoklama
    (polling) gerekiyor"* diyordu. Yoklama **zaten vardı** ve canlıda
    çalışıyor — madde ölçülmeden yazılmış. (tuzak 191'in aynısı, üçüncü
    kez: bir eksiği de ölçmeden yazmışım.)

    **ÖLÇÜM** (07.11, canlı site, Emrah'ın Chrome'u, ağ isteği kaydı):
    sekme 75 saniye açık bırakıldı; üç kaynağın üçü de **iki kez**
    okundu, hepsi `200`:

        rpc/sure_talepleri      · rpc/lisans_ozeti · rpc/geri_arama_listesi
        rpc/sure_talepleri      · rpc/lisans_ozeti · rpc/geri_arama_listesi

    Yayındaki paket (`index-BQ8FN3LM.js`) içinde **60 saniyelik yoklama**
    ve **sekmeye dönünce tazeleme** var. Yani zil kendi kendine
    tazeleniyor; yeni bir talep en geç **bir dakika** içinde zile düşüyor.

    **GERÇEK EKSİK — zil SESSİZ:** aynı pakette **ses yok**, **masaüstü
    bildirimi yok** (`Notification` API hiç kullanılmıyor), **sekme
    başlığında sayı yok**. Rozet sessizce beliriyor; Emrah zil ikonuna
    bakmıyorsa fark etmiyor. Tam olarak 06.11'de yaşanan şey bu.

    **SIRADAKİ SEÇENEKLER** (karar Emrah'ın, yapılmadı):
    - **Sekme başlığında sayı** — `(2) EVREN360`. İzin istemez, arka
      plandaki sekmede de görünür, sunucu tarafı değişmez. **En ucuzu ve
      en çok işe yarayanı.**
    - **Masaüstü bildirimi** — tarayıcı izni ister; tarayıcı kapalıyken
      yine çalışmaz.
    - **Anlık itme (realtime)** — ⚠️ `callback_request` üzerinde
      `authenticated` için **hiç okuma yetkisi yok** (0106 kararı:
      RLS açık, politika yok). Supabase'in `postgres_changes` aboneliği
      satırı okuyabilmeyi gerektirir; yani bunu açmak 0106'nın kapısını
      delmek olur. Yolu "veritabanından broadcast" (`realtime.send()`)
      olurdu — ayrı ve büyük bir iş.
  - ⬜ **4.11.9** **PROVALARIN BİR ARADA KOŞMASI BİR ADIMA BAĞLI DEĞİL.**
    07.11'de ortaya çıktı (4.11.5): 54 provanın 13'ü aylardır kırmızıydı
    ve kimse bilmiyordu, çünkü hepsini koşturmak **kimsenin görevi
    değildi**. ⚠️ `kaydet.ps1`e eklenemez: provalar yerel bir
    **PostgreSQL 16** istiyor, Emrah'ın makinesinde yok ve kurulması
    istenmiyor. Yani bu adım Claude'un tarafında: **her göç turunun
    sonunda** bütün provalar temiz bir veritabanına kurulup koşturulur ve
    sonucu commit mesajına yazılır. Yazılı bir uyarı, bir adıma
    bağlanmadığı sürece hatırlatmaz (kontrol listesi 130'un aynısı,
    bu sefer prova tarafı).
- ✅ **4.12** **Ana ekranda görünecek telefon** · aynı ekrandan yazılıyor
  (`platform_contact`, göç 0106). ⚠️ Bayrak değil veri: alan boşsa ana
  ekranda **hiçbir şey görünmez**; yazıldığı an görünür.
  Emrah'ın kararı (06.11): *"şimdilik yazmasın ama admin panelimde orası
  için telefon numarası girebileceğim yer olsun."* → alan **boş** bırakıldı.
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
- ⬜ **7.8** **SÜRÜM DEFTERİ BOZUK VE GERİDE** (06.11.2026 · yükleme
  hazırlığında çıktı). `araclar/surum-gecmisi.txt` iki ayrı sorun taşıyor:
  - **Metin bozulmuş.** Satırlar `do─şru sat─▒r─▒` gibi okunuyor; dosya
    UTF-8 metni yanlış kod sayfasıyla yazılmış (tuzak 99 / MIYOP-079'un
    aynı ailesi — bu depoda ÜÇÜNCÜ kez).
  - **Altı commit eksik.** Son satır **30.10**; 01.11–06.11 arasındaki
    commit'ler (`854efed`, `b3a81f2` dahil) hiç yazılmamış.
  ⚠️ Dosyanın biçimi zaten `tarih | kısa-hash | başlık`, yani
  `git log --date=short --pretty` çıktısının birebir aynısı. Elle
  sürdürülen bir kopyanın bayatlaması kaçınılmazdı; **doğrusu dosyayı
  git'ten ÜRETMEK.**
  ✅ Emrah onayladı (06.11) → `araclar/surum-defteri-uret.ps1` yazıldı.
  ⚠️ Betik kendi çıktısını **ölçüyor**: satır sayısı git'inkiyle aynı mı,
  içinde çözülemeyen karakter (U+FFFD) var mı, eski bozulmanın kutu
  çizgisi deseni geri gelmiş mi. Doğrulamasız bir üretici, düzelttiği
  bozukluğu sessizce geri getirebilirdi.
  ⚠️ Bozulma **yazarken değil OKURKEN** oluyordu: PowerShell 5.1 harici
  program çıktısını konsol kod sayfasıyla çözüyor. Betik `git log`u
  okumadan önce `[Console]::OutputEncoding`i UTF-8 yapıyor, sonra geri
  koyuyor.
  ⬜ Betik henüz **koşulmadı** — bir sonraki turda.
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

### 8.3 · EVREN360 · kullanım istatistikleri (Emrah, 01.11.2026)

> *"Kendi yönetim panelimden hangi firma günde hangi saat giriş yapmış,
> hangi saatte kullanım bırakılmış, en aktif saatler hangi saatler, hangi
> rolün en çok kullandığı gibi soruları bilmek iyi olabilir. Demo
> sonrasında en son bunu yapabiliriz."*

- ⏸️ **8.3.1** Oturum olayları: giriş saati, son etkinlik, oturum süresi.
- ⏸️ **8.3.2** Kiracı × saat yoğunluk tablosu — "en aktif saatler".
- ⏸️ **8.3.3** Rol kırılımı: hangi rol kaç oturum, kaç ekran açılışı.
- ⏸️ **8.3.4** EVREN360 panelinde tek ekran; kiracı seçilebilir.

⚠️ **SINIR ÇİZİLİ: ÜSTVERİ EVET, İÇERİK HAYIR.** Bu başlık *ne zaman ve ne
kadar kullanıldığını* ölçer; **ne yazıldığını, hangi kaydın ne olduğunu
DEĞİL.** Firmanın iş verisi (stok, reçete, HACCP, denetim defteri) bu
ekrana girmez — girerse aşağıdaki kararla çelişir ve müşteriye verdiğimiz
sözü bozar.

⚠️ **Sözleşmede ve aydınlatma metninde YAZILI olacak.** Ölçtüğümüzü
söylemeden ölçmek, "görünür olmak" ilkesinin tam tersidir. Satış tarafında
zaten bir faydası var: *"hizmeti ne kadar kullandığınızı biz de görüyoruz,
destek ve kapasite buna göre planlanıyor."*

⚠️ **Teknik not:** `audit_log` BU İŞ İÇİN KULLANILMAZ. O defter kiracının
kendi verisidir ve RLS ile kiracıya kapalıdır; platform tarafından
okunması tam da kaçındığımız şeydir. Oturum üstverisi **ayrı** bir
platform tablosuna yazılır (kiracı kimliği, rol kodu, zaman — kayıt
içeriği yok).

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

## Sayılar (26.10.2026)

| | |
|---|---|
| Test | **87 dosya · 1541 test** (Emrah'ın 26.10 koşusu) · ⚠️ o koşuda **8 kırmızı** vardı ve ÜÇÜ DE DOĞRU YAKALAMIŞTI: şahit numune ekranı menüyü büyüttü, iki çıcır eski sayıyı tutuyordu. Sayılar güncellendi, gerekçesi testin içinde yazılı. |
| Göç | 0000–**0101** · 102 dosya · 0094–0098 **26.10'da canlıya alındı**; **0099 + 0100 27.10'da canlıya alındı** (teşhis tablosu doğruladı); **0101 (fire kapısı) yazıldı, Supabase'de BEKLİYOR** · giriş ACL'si artık **0102** olacak |
| Açık çekirdek rota | 25 (37'den indi) |
| Tarayıcıya bağlı açık ekran | **3** (6 → 5 Profilim bitti → 3 şube ekranları kapsam dışı) |
| Sahte veri üreticisi | **23 `createDemo*`** (27 → 23 · duyuru, şube, firma ve `createDemoData` silindi) · çıcır testiyle donduruldu |
| Veritabanı yazma kapısı | **45 tetikleyici** (18 → +27 tablo) |
| Codex bulgusu | **72** · (**30'u kapandı**: önceki 25 + **078**, **079**, **080**, **081**, **082**) · 27.10'da 078–082 geldi ve **aynı gün kapandı**. ⚠️ **078 bir P0'dı ve CANLIYA GİTMİŞTİ**: 0095, 0071'in `finance.read` kapısını ezmişti |
| Kapısız yazma yüzeyi | **0 tablo** (ölçüldü, sayılmadı) |
| Gevşek kapı ardındaki `security definer` | **7 rutin** (0090'da 6 idi) · 0098'de yeniden donduruldu · ⚠️ 0090 tek başına yeniden çalıştırılamaz |
| Prova dosyası | **42 · 31 yeşil / 11 kırmızı** (11'i de bayat · 6.12) · 26.10: prova-0094 (18), prova-0095 (12), prova-0096 (9), prova-0097 (13) eklendi |
| Şahit numune | 0093 defter · 0094 kiracı sınırı/kilit/açık raf ömrü · 0096 saklama beyanı izni · 0097 imha onayı · 0100 açılış sonucu · ekran 26.10 · toplam **71 prova sınaması** · **açık soru kalmadı** · ⬜ sayfalama borcu |
| Mock dosya | 36 · hiçbiri açık kiracı rotasından erişilemiyor |
| Public yol | **2** · başvuru formu + müşteri portalı (ölçülüp donduruldu) |
| Giriş vitrini | dondurulmuş **20 modül adının** hiçbiri geçmiyor (ölçüldü, donduruldu) |
| Tuzak | **134** (26–27.10: 116–134 eklendi) |

⚠️ "Mock dosya" satırı **yanıltıcıydı:** doğru olan ama yetmeyen bir ölçüm.
Asıl tehlike adı mock olmayan üreticilerdi; üstteki satır onu gösteriyor.
