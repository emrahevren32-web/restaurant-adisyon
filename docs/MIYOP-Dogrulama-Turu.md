# MİYOP · DOĞRULAMA TURU

**Amaç:** Kod yazılmış ama Word'de işaretlenmemiş maddeleri ekranda kendi gözünle
görüp işaretlemek. Hiçbir madde benim sözümle işaretlenmiyor — **ekranda görmezsen
işaretlemiyorsun.**

Ben kodu önce denetledim ki boşa test etmeyelim. Aşağıda iki liste var:

- **BÖLÜM A** — ekranda doğrulayıp işaretleyebileceğini düşündüğüm **19 madde**
- **BÖLÜM B** — yazılmamış ya da yarım kalmış maddeler ve **sebebi**

Hepsi geçerse yüzde **%56 → %69** olur (79/142 → 98/142).

---

## 0 · ÖNCE ŞUNU YAP (yoksa Tur 1 hata verir)

0064 göçü henüz Supabase'de yok. Araç ve şoför kartları onunla geliyor.

**Adım 1 — Supabase:** SQL Editor'da `db/migrations/0064_arac_ve_sofor.sql`
dosyasının içeriğini yapıştır ve çalıştır. Sonunda şunu görmen gerekiyor:

```
0064 TAMAM · vehicle · driver · shipment.vehicle_id/driver_id
```

**Adım 2 — Bilgisayarında tek komut:**

```
cd C:\Users\90544\Documents\restaurant-adisyon ; npm run typecheck ; npm test -- --run ; git add -A ; git commit -m "0064 arac ve sofor kartlari: sevkiyata ve irsaliyeye baglandi"
```

Beklenen: **1084 test, 61 dosya, hepsi yeşil.**

Sonra tarayıcıda **çıkış yap, yeniden gir** (yetkiler girişte okunuyor).

---

# BÖLÜM A — TEST ET VE İŞARETLE

## TUR 1 · Sevkiyatlar ekranı → 2 madde

Menü: **Üretim → Sevkiyatlar**

### A4B-1 · Araç ve şoför kartları
> *Bitti sayılır ki: Plaka, şoför, kapasite ve soğutma bilgisi kayıtlı*

1. Sayfanın **en altına** in. **"Filo — araç ve şoför kartları"** başlığını aç.
2. **Araç ekle:** plaka `34 ABC 123`, ad `Soğutmalı Kamyon 1`, kapasite `3500` kg,
   **"Soğutmalı"** kutusunu işaretle, min `-2`, max `4` °C. Kaydet.
3. **Şoför ekle:** ad `Ahmet Yılmaz`, telefon, ehliyet sınıfı `C`,
   ehliyet geçerlilik tarihi. Kaydet.
4. **Şunu dene:** ikinci bir araca aynı plakayı `34 abc 123` (küçük harf, boşluklu)
   yaz. **Reddetmesi gerekiyor** — aynı plaka iki kez girilemez.
5. **Şunu da dene:** "Soğutmalı" işaretli DEĞİLKEN sıcaklık aralığı yazmayı dene.
   **Reddetmesi gerekiyor.**

✅ **İşaretle** eğer: dört bilgi (plaka, şoför, kapasite, soğutma) kayıtlı
duruyor ve yeniden açınca hâlâ orada.

### A4B-2 · Sevkiyata sefer bağlanıyor
> *Bitti sayılır ki: Hangi mal, hangi plakayla, kimin götürdüğü defterde*

1. Yeni sevkiyat formunu aç. Artık **Araç** ve **Şoför** açılır listeleri var.
2. Az önce girdiğin aracı ve şoförü seç. Sevkiyatı kaydet.
3. **Sayfayı yenile (F5).** Sevkiyatı yeniden aç — plaka ve şoför **hâlâ orada**.
   (Yenilemeden görmek yetmez; tarayıcıda duran bir bilgi defterde durmaz.)
4. **Şunu dene:** sevkiyat **sevk edildikten sonra** aracı değiştirmeyi dene.
   **Reddetmesi gerekiyor** — gitmiş malın plakası değişmez.

✅ **İşaretle** eğer: F5'ten sonra plaka ve şoför duruyorsa.

---

## TUR 2 · Etiket ve Alerjen ekranı → 5 madde

Menü: **Üretim → Etiket ve Alerjen**

### A4B-14 · Malzemede besin değeri ve alerjen
> *Bitti sayılır ki: Veri TEK yerde: stok kartında*

1. Listeden bir **hammadde** seç (örn. un, yumurta, süt).
2. **Alerjen beyanı:** yasal listeden ilgili alerjeni seç, türünü belirt
   (*içerir / eser miktar / içermez*). Kaydet.
3. **Besin değeri:** 100 g için enerji, yağ, protein vb. gir. Kaydet.
4. **Sayfayı yenile.** Aynı malzemeyi tekrar seç — değerler orada.

✅ **İşaretle** eğer: bilgi malzeme kartında duruyorsa ve başka hiçbir ekranda
aynı bilgiyi ikinci kez girmen istenmiyorsa.

### A4B-5 · Reçetede alerjen beyanı
> *Bitti sayılır ki: Mamulün alerjenleri reçete satırlarından türetiliyor*

1. Listeden bir **mamul** seç (reçetesi olan bir ürün).
2. **"Türetilen alerjenler"** bölümüne bak. Reçetedeki malzemelerin alerjenleri
   **kendiliğinden** listelenmiş olmalı — sen hiçbir şey girmedin.
3. **Asıl test:** Reçetedeki bir malzemenin alerjenini TUR 2/A4B-14'teki gibi
   değiştir, sonra mamule geri dön. **Mamulün listesi de değişmiş olmalı.**
4. **Eksik uyarısı:** Reçetede alerjeni **hiç incelenmemiş** bir malzeme varsa ekran
   *"alerjeni incelenmedi"* diyor — *"alerjen yok"* demiyor. Bu ikisi aynı şey değil
   ve ekran farkı söylüyor.

✅ **İşaretle** eğer: mamulün alerjeni elle girilmiyor, reçeteden geliyorsa.

### A4B-15 · Mamulün besin değeri reçeteden türetiliyor
> *Bitti sayılır ki: Hiçbir yerde ikinci kez girilmiyor; reçete değişince tablo değişiyor*

1. Aynı mamulde **"Türetilen besin değeri"** tablosuna bak.
2. **Asıl test:** Reçeteler ekranına git, bu mamulün reçetesinde bir malzemenin
   **miktarını değiştir**. Etiket ekranına dön. **Tablo değişmiş olmalı.**

✅ **İşaretle** eğer: reçete değişince tablo değiştiyse.

### A4B-6 · Ürün etiketi çıktısı
> *Bitti sayılır ki: Etikette ürün, lot, üretim ve son kullanma tarihi, gramaj var*

1. Mamul seçili. **Parti (lot)**, **üretim tarihi**, **son kullanma tarihi** alanlarını
   doldur. **"Etiket yazdır"**a bas.
2. Çıkan kâğıtta **beş şeyin hepsini** ara: ürün adı · parti · üretim tarihi ·
   son kullanma tarihi · gramaj.
3. **Şunu dene:** son kullanma tarihini **boş bırak** ve yazdırmayı dene. Ekran
   **temiz etiket basmayı reddetmesi gerekiyor** — eksik bilgili bir etiket
   yasal olarak hatalı etikettir.

⚠️ **Senin kararın:** **parti numarasını şu an ELLE yazıyorsun.** Üretilen partiyle
otomatik bağlı değil. Madde metni "etikette lot var" diyor — var. Ama "doğru lot"
garantisi yok. Bunun *bitti* sayılıp sayılmayacağına **sen karar vereceksin.**
(Bağlamak demo sonrası listesinde duruyor.)

✅ **İşaretle** eğer: beş bilgi kâğıtta görünüyorsa ve yukarıdaki kararı verdiysen.

### A4B-7 · Etikette alerjen basılıyor
> *Bitti sayılır ki: Yasal alerjen listesi ambalajda görünüyor*

1. Aynı etiket çıktısında **alerjen satırını** ara.
2. *İçerir* ve *eser miktar* ayrı ayrı yazıyor mu kontrol et — ikisi yasal olarak
   farklı beyan.

✅ **İşaretle** eğer: alerjenler kâğıtta görünüyorsa.

---

## TUR 3 · Siparişler ekranı → 8 madde

Menü: **Üretim → Siparişler**

### A4C-2 · Sipariş belgesi (haftalık plan)
> *Bitti sayılır ki: Sevk tarihi ve teslim tarihi ayrı ayrı tutuluyor*

1. **Yeni sipariş**. Formda **Sevk tarihi** ve **Teslim tarihi** iki AYRI alan.
2. İkisini farklı gir (örn. sevk 10 Ekim, teslim 12 Ekim). Kaydet.
3. **Şunu dene:** teslim tarihini sevk tarihinden **ÖNCE** yaz. **Reddetmesi
   gerekiyor** — mal gitmeden teslim edilmiş olamaz.
4. Sipariş detayında **"10.10.2026 → 12.10.2026"** şeklinde ikisi birlikte görünüyor.

✅ **İşaretle** eğer: iki tarih ayrı ayrı duruyorsa.

### A4C-3 · Sipariş satırı palet / koli / kg birimiyle
> *Bitti sayılır ki: Firmanın kendi belgesindeki birimle giriliyor*

1. Sipariş satırında **Birim** açılır listesini aç.
2. İçinde şunların olması gerekiyor: **kg · g · ton · lt · ml · adet · koli ·
   tepsi · palet · çuval · kasa · paket**.
3. Bir satırı **palet** birimiyle gir (örn. `2 palet`). Kaydet.
4. **Şunu dene:** birim alanına elle `dasdasd` yazmayı dene — **yazamıyor olman
   gerekiyor** (03.10'da yazılabiliyordu, 0059 bunu kapattı).

✅ **İşaretle** eğer: 12 birim listede ve palet ile sipariş girilebiliyorsa.

### A4C-4 · Sipariş revizyonu append-only
> *Bitti sayılır ki: Değişiklik üstüne yazılmıyor; kim, ne zaman, neyi değiştirdi duruyor*

1. Kaydettiğin siparişte bir satırın **miktarını değiştir** (örn. 200 kg → 150 kg).
2. **Revizyonlar** sekmesine bak. **İKİ satır** olmalı: Rev 1 (200) ve Rev 2 (150).
   Rev 1 **silinmemiş** olmalı.
3. Her revizyonda şunlar yazılı: **kim · ne zaman · ne değişti · gerekçe**.
4. **Şunu dene:** Rev 1'i silmeye ya da düzeltmeye çalış. **Hiçbir yol
   bulamıyor olman gerekiyor** — defter eklemeli.

✅ **İşaretle** eğer: eski revizyon duruyorsa ve kim/ne zaman yazıyorsa.

### A4C-5 · Değişikliğin KAYNAĞI kayıtlı
> *Bitti sayılır ki: Telefon mu, portal mı — her satırda belli*

1. Revizyon formunda **Kaynak** açılır listesi: *Telefon · Portal · E-posta ·
   WhatsApp · Yüz Yüze · Sistem*.
2. Bir revizyonu **Telefon**, başkasını **WhatsApp** olarak gir.
3. Revizyon listesinde her satırda **Kaynak** sütunu doğru yazıyor.
4. **Asıl test:** TUR 4'te portaldan sipariş güncelleyeceksin. O revizyonun
   kaynağı **kendiliğinden "Portal"** yazmalı — kimse elle seçmedi.

✅ **İşaretle** eğer: her revizyon satırında kaynak yazıyorsa.

### A4C-6 · Sipariş durum akışı
> *Bitti sayılır ki: Onaya sunuldu → onaylandı → üretimde → hazır → sevk → teslim*

1. Siparişi **Onaya Sun**. Durum **"Onay Bekliyor"**.
2. **Onay** sekmesinde onay zinciri görünüyor. Onayla → **"Onaylandı"**.
3. Sırayla: **Hazırlanıyor → Hazır** yap.
4. **Şunu dene:** "Onay Bekliyor"dan doğrudan **"Sevk Edildi"**e atlamayı dene.
   **Bulamıyor olman gerekiyor** — adımlar atlanamaz.
5. **Şunu da dene:** onaylanmış bir siparişte **miktarı değiştir**. Durum
   **kendiliğinden "Onay Bekliyor"a geri düşmesi gerekiyor** — yeni miktarı
   kimse onaylamadı.

✅ **İşaretle** eğer: altı durum sırayla yürüyorsa ve atlanamıyorsa.

### A4C-7 · Siparişten iş emri türetme
> *Bitti sayılır ki: Depoda olan depodan, olmayan üretimden karşılanıyor*

1. **Onaylanmış** bir siparişte **Karşılama** sekmesini aç.
2. Tabloda her kalem için: **Sipariş · Depoda · Müsait · Depodan · Üretim · Durum**.
3. **Müsait ≠ Depoda** olduğuna dikkat et — başka siparişlere söz verilmiş miktar
   düşülmüş hâli. (Düşmezse aynı malı iki müşteriye vaat ederdin.)
4. Üretim gereken kalem varsa **"Üretilecekler için iş emri çıkar"**a bas.
5. **Üretim → İş Emirleri** ekranına git: **taslak** iş emirleri orada ve bu
   siparişe bağlı.
6. **Şunu dene:** reçetesi OLMAYAN bir kalem varsa ekran *"satın alınmalı"*
   diyor, iş emri açmıyor.

✅ **İşaretle** eğer: depo/üretim ayrımı tabloda duruyorsa ve iş emri çıktıysa.

### A4C-8 · Siparişten sevkiyat türetme
> *Bitti sayılır ki: Sipariş karşılandıkça sevkiyat hazırlanıyor*

1. Siparişi **Hazır** durumuna getir.
2. **Sevk durumu** sekmesinde **"Sevkiyat çıkar"**a bas.
3. **Üretim → Sevkiyatlar** ekranında sevkiyat var ve **bu siparişe bağlı**.
4. **Şunu dene:** sipariş **Hazır** değilken sevkiyat çıkarmayı dene. Ekran
   *"sipariş Hazır olmalı"* diyor.
5. Siparişin **İrsaliyeler** tablosunda bu sevkiyatın irsaliyesi listelenmiş.
   **Yazdır**a bas — kâğıtta plaka ve şoför var *(TUR 1'de girdiğin araç)*.

✅ **İşaretle** eğer: siparişten sevkiyat çıkıyorsa ve ikisi bağlıysa.

### A4C-9 · Sipariş–teslim farkı raporu
> *Bitti sayılır ki: "Ne istendi, ne hazırlandı, ne gitti" tek tabloda*

1. **Teslim farkı** sekmesini aç.
2. **Üç sayı yan yana:** İstendi · Hazırlandı · Gitti. Arasındaki boşluk
   kendiliğinden görünüyor.
3. **Şuna dikkat et:** birim uyuşmazlığı olan satırda **sayı yok, TİRE var.**
   Bu doğru davranış — veritabanı palet'ten kg çıkarmıyor, uydurmuyor.

✅ **İşaretle** eğer: üç sayı tek tabloda yan yanaysa.

---

## TUR 4 · Müşteri Portalı → 3 madde

Bunun için **bir müşteri kullanıcısı** gerekiyor: Müşteriler ekranından bir
müşteriye portal kullanıcısı davet et, gelen e-postadaki bağlantıyla **ayrı bir
tarayıcıda** (ya da gizli pencerede) gir.

### A4C-13 · Portaldan sipariş girme ve güncelleme
> *Bitti sayılır ki: Firma onayına düşüyor*

1. Portalda **yeni sipariş** gir. Kaydet.
2. **Firma tarafında** (normal pencere) Siparişler ekranını yenile: sipariş orada,
   durumu **"Onay Bekliyor"**.
3. Portalda aynı siparişi **güncelle** (miktar değiştir). Gerekçe yaz.
4. Firma tarafında: **yeni revizyon** var, **kaynağı "Portal"**, durum tekrar
   **"Onay Bekliyor"**.
5. **Şunu dene:** firma siparişi **Sevk Edildi** yaptıktan sonra portaldan
   güncellemeyi dene. **Reddetmesi gerekiyor** ve mesaj müşteri diliyle olmalı
   (*"siparişiniz yola çıktı, değiştirilemez"* gibi — *"MI433"* gibi değil).
6. **Şunu da dene:** portalda bütün satırları sil ve kaydet. **İptal olarak
   yorumlamamalı** — boş liste iptal demek değil.

✅ **İşaretle** eğer: portal siparişi firma onayına düşüyorsa.

### A4C-15 · Müşteri sipariş takip çizelgesi
> *Bitti sayılır ki: Sipariş anından teslime kadar müşteri de izliyor*

1. Portalda sipariş listesinde **Durum** sütununa bak.
2. Firma tarafında durumu ilerlet (**Onaylandı → Hazırlanıyor → Hazır → Sevk
   Edildi → Teslim Edildi**). Her adımdan sonra portalı yenile.
3. Müşteri **müşteri diliyle** görüyor: *İnceleniyor · Onaylandı · Hazırlanıyor ·
   Sevke hazır · Yolda · Teslim edildi.* **"Hazır"** değil, **"Sevke hazır"**.
4. **Tarihler** sütununda söz verilen tarih istenen tarihten farklıysa **ikisi
   birlikte** yazıyor — sessizce kendi tarihimizi göstermiyoruz.

⚠️ **Senin kararın:** bu bir **tablo**, zaman çizelgesi (timeline) değil. Madde
"müşteri de izliyor" diyor — izliyor. Görsel bir çizelge istiyorsan ayrı bir iş.

✅ **İşaretle** eğer: altı durumun hepsini portalda gördüysen.

### A4C-11 · Müşteri YALNIZCA kendi verisini görüyor
> *Bitti sayılır ki: Veritabanı seviyesinde; arayüzde gizlemek yetmez*

Bu maddeyi **TUR 5 geçmeden işaretleme.** Portalda kendi siparişini görmek
yetmez — başkasının siparişini görememesi gerekiyor ve bunun kanıtı arayüzde
değil veritabanında.

✅ **İşaretle** eğer: TUR 5 **GEÇTİ** dediyse.

---

## TUR 5 · Supabase SQL Editor → 1 madde

### A4C-12 · İki müşteri izolasyon kabul testi
> *Bitti sayılır ki: B müşterisi, A'nın siparişini hiçbir yoldan göremiyor*

1. `db/kabul/izolasyon-kabul.sql` dosyasının içeriğini Supabase SQL Editor'a
   yapıştır ve çalıştır.
2. Hazırlık gerekmiyor — test işletmeyi kendisi buluyor.

⚠️ **SONUNDA BİR HATA GÖRECEKSİN VE BU BEKLENEN DAVRANIŞTIR:**

```
KABUL TESTİ GEÇTİ ✅ — bu bir hata değildir.
```

Test kendi verisini yazıyor; sipariş defteri eklemeli olduğu için o veriyi
silemeyiz. Tek temiz çıkış yolu işlemi geri almak ve PostgreSQL'de bunun yolu
hata fırlatmak. **Mesaj "GEÇTİ" diyorsa yalıtım çalışıyor; "BAŞARISIZ" diyorsa
çalışmıyor.**

✅ **İşaretle** (A4C-12 **ve** A4C-11) eğer: mesaj **GEÇTİ** diyorsa.

---

# BÖLÜM B — BUNLAR BİTMEMİŞ, SEBEBİ ŞU

Bu maddeleri **işaretlemiyorsun.** Neden bitmediği aşağıda.

| Madde | Durum | Sebep |
|---|---|---|
| **A4B-9** Palet ve koli birimleri | **YARIM** | **Sipariş** palet'le girilebiliyor ✅ · **Sevkiyat** giremiyor ❌. Sevkiyat birim listesi kalemin temel birimine çevrilebilen birimleri gösteriyor; 0059 bilerek palet→kg çevrimi yazmadı (bir paletin ağırlığı ürüne göre değişir). Yani filtre **gerçek bir kısıtı koruyor**, hata değil. Dürüst çözüm: **kalem başına ambalaj çevrimi** (bu ürün için 1 palet = N koli = M kg). Bir göç + çevrim yolunun değişmesi. |
| **A4B-3** Yükleme sıcaklığı CCP-8'e bağlanıyor | **YOK** | HACCP ölçüm tabloları veritabanında var (0024, `source_type='shipment'` kabul ediyor) ama **ölçümü girecek ekran yok** — HACCP ekranı hâlâ donmuş örnek veride. Sevkiyat ekranından yükleme sıcaklığı girilip limit aşımında uyarı verilmesi gerekiyor. |
| **A4B-4** İrsaliyede araç ve şoför | **YARIM** | Kâğıtta **plaka ✅ şoför ✅** var. Madde ayrıca **"yükleme sıcaklığı yazıyor"** diyor — o yok, çünkü A4B-3 yok. **A4B-3 bitince bu da biter.** |
| **A4B-8** Şube / depo kapsamı | **YOK** | Kullanıcı bugün işletmenin bütün şubelerini görüyor. Şube bazlı yetki yazılmadı. |
| **A4B-10** Sıcaklık rejimi ürün kartında | **YOK** | Donuk / soğuk / kuru kolonu yok; sipariş ve sevkiyat rejime göre ayrışmıyor. |
| **A4B-11** Sefer: bir araç, çok duraklı | **YOK** | Bugün bir sevkiyat = bir araç. Birden çok sevkiyatı tek sefere toplayan tablo yok. |
| **A4B-12** Sefer maliyeti (km, otoban) | **YOK** | A4B-11 bitmeden yapılamaz — maliyet sefer başına hesaplanıyor, sefer yok. |
| **A4B-13** Palet varlık takibi (Epal iadesi) | **YOK** | Hangi müşteride kaç palet olduğunu tutan defter yok. |
| **A4C-10** Müşteri kullanıcısı ve davet | **TASARIM ÇELİŞKİSİ** | Davet ✅ çalışıyor. Ama madde *"şifresini kendisi belirliyor"* diyor; portal **şifresiz** tasarlandı (e-postaya gelen tek kullanımlık bağlantı). Onaylı tasarım şifresiz. **Aşağıdaki soruya bak.** |
| **A4C-14** Firmaya bildirim | **YOK** | Portaldan sipariş güncellenince firma tarafında **hiçbir uyarı çıkmıyor.** Siparişler ekranını açıp bakması gerekiyor. Madde *"anında görüyor"* diyor. **Küçük bir iş:** kontrol panelindeki "dikkat" listesine onay bekleyen portal siparişlerini eklemek. |
| **A4C-16** Müşteri kendi irsaliyesini görüyor | **YOK** | Portalda irsaliye indirme ve besin değeri tablosu yok. |
| **A4B-16 / A4C-17** Bu aşamanın testleri | **BEKLİYOR** | Aşama bitmeden işaretlenmez. |

---

# SIRADA NE VAR

Bölüm B'den **üç madde** birbirine bağlı ve birlikte yapılırsa **üç kutu** kapanıyor:

1. **A4B-3** Sevkiyat ekranına yükleme sıcaklığı girişi + limit aşımında uyarı
2. **A4B-4** O sıcaklığın irsaliyeye basılması *(1 bitince kendiliğinden)*
3. **A4C-14** Portal siparişi için firmaya bildirim *(küçük iş, kontrol paneli)*

Sonra **A4B-9** (kalem başına ambalaj çevrimi) — tek başına bir göç işi.

---

# SANA SORULARIM

**1 · Etikette parti numarası (A4B-6).** Parti şu an elle yazılıyor, üretilen
partiyle bağlı değil. Madde metni *"etikette lot var"* diyor ve var. Bunu
**bitti** sayıyor musun, yoksa parti bağlanana kadar bekleyecek mi?

**2 · Müşteri portalı şifresi (A4C-10).** Bunu altıncı kez soruyorum, çünkü
Word'deki ölçüt ile onayladığın tasarım çelişiyor. Word diyor: *"müşteri
e-postayla davet ediliyor, **şifresini kendisi belirliyor**"*. Portal ise şifresiz:
her girişte e-postaya tek kullanımlık bağlantı gidiyor. İki seçenek var:
- **(a)** Word'ün ölçüt metnini *"müşteri e-postadaki bağlantıyla giriyor, şifre
  tutulmuyor"* diye düzeltmek ve maddeyi işaretlemek *(tavsiyem bu — şifre
  tutmamak daha güvenli ve zaten çalışıyor)*
- **(b)** Portala şifre eklemek *(yeni iş, ve müşteri parolası saklamak demek)*

**3 · Müşteri takip çizelgesi (A4C-15).** Bugün bir **tablo** var (durum sütunu).
Görsel bir **zaman çizelgesi** (adımların üzerinde yürüyen çizgi) ister misin,
yoksa tablo yeterli mi?

**4 · Departman rollerine `operations.read`.** (Geçen turdan kalan soru.)
Departman rolleri onay zincirinde görüş soruluyor ama Siparişler ekranını
açamıyor. Sipariş defterinde **birim fiyat** görünüyor — bu yüzden ticari bir
karar. Açalım mı?
