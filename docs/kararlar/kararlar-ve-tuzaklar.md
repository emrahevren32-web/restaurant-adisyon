# MİYOP · Kararlar ve Tuzaklar

> Bu dosya kodu değil **KARARI** anlatır. Bir şey yanlış görünüyorsa
> cevabı büyük ihtimalle burada ya da ilgili göç dosyasının başlık
> yorumundadır. Göç numarası büyüdükçe karar yenidir.
>
> Son güncelleme: 17.10.2026

---

## 1 · DEĞİŞMEZ KURALLAR

**Mock veri asla olmayacak.** Emrah: *"asla ama asla olmayacak. Gerekirse
biz tek tek girer doldurur sonra o verilerle müşteriye gideriz."*
Uydurma veri bulunursa P0'dır.

**Ortaya koyduğumuz bir şey çalışsın, "…mış gibi" yapmasın.**
Emrah: *"Bir albay disipliniyle görevini bitirsin."*

**Müşterinin görmemesi gereken hiçbir şey müşteri ekranında olmasın.**

**Tarayıcıdaki izin kontrolü GÜVENLİK SINIRI DEĞİLDİR.** Gerçek sınır
veritabanındadır: RLS + GRANT + tetikleyici. Bir ekranın `if` ile düğme
gizlemesi koruma sayılmaz.

**Silme yoktur, pasife alma vardır.** Hiçbir tabloda `DELETE` yetkisi
verilmez. `app_user`a 33 yabancı anahtar var, 25'i `SET NULL` — kullanıcı
silmek geçmişi bozar.

**Satış dilinde "yapay zeka" DENMEYECEK.** Teknik başlık: **kural motoru**.

**Parola hiçbir zaman bizim veritabanımıza yazılmaz**, kayda geçmez, ilk
girişte değiştirilmek zorundadır.

---

## 2 · VERİ TASARIMI KARARLARI

**`NULL` = SINIRSIZ** (lisans paketlerinde kullanıcı/şube sayısı).
Emrah (23.09.2026): *"hepsini yapabilsin, müşteri yeteneğimizi görsün."*
Sayı yazmak, olmayan bir teknik sınır varmış gibi göstermek olurdu.

**Sorulmamış soruya varsayılan cevap yazılmaz.** Yeni kolonlar `NULL`
kabul eder. `default` yazmak, sorulmamış bir soruya bizim uydurduğumuz
cevabı gerçek gibi kaydetmektir (göç 0038 ve 0084 başlıkları).

**"Boş" ile "sıfır" ayrı şeylerdir.** Ekranda `—` görünüyorsa bilinmiyor
demektir, 0 demek değildir. Fiyat 0 iken "0 ₺" yazmak "bedava" demektir;
onun yerine "Fiyat henüz belirlenmedi" yazılır.

**Stok defteri APPEND-ONLY.** Miktar hareketlerden türetilir, saklanmaz.
Bir defteri "sadece bir kolonu doldurmak için" güncellemek, onu defter
olmaktan çıkarır (tuzak 38).

**Ücretsiz lisans uzatması lisansı "Deneme"de BIRAKIR**, "Aktif" yapmaz.
Yalnız ücretli uzatma `Aktif`e çevirir (göç 0044).

**Platformun lisansı yoktur.** Emrah (23.09.2026): *"adminin lisans
süresi olduğu nerede görülmüş?"* `is_platform` kiracısı müşteri
listelerine de girmez.

**Ödemeyen müşteri OTOMATİK KAPATILMAZ.** Emrah (17.10.2026): 3 ay
beklenebilir — hem samimiyet hem veri birikimi hem bağlılık. Ama
ödemeyen görünür olmalı ve tek düğmeyle pasife alınabilmeli.

**Düzeltici faaliyeti atanan rol kapatamaz.** Faaliyet İŞİ YAPACAK role
atanır; kapatma ise ONAY işidir. İkisini birleştirmek imzayı yanlış
kişiye attırırdı (0081 kararı, Codex önerisi reddedildi).

---

## 3 · İŞLETME KARARLARI

- **Veri konumu: Hetzner (Almanya).** Türkiye'de barındırma yok.
- **On-premise kurulum ürün yolu değil.** İstenirse tek tek ele alınır.
- **Supabase Pro'ya ilk müşteri anlaşmasından sonra geçilecek.**
  ⚠️ Şu an ücretsiz planda **hiç veritabanı yedeği yok** ve bu bilinçli
  kabul edildi: *"kalsın, müşteri görsün uyarıyı verdiğimizi."*
- **Fiyat henüz belirlenmedi.** Paket fiyatları veritabanında 0.
- **Taahhüt:** ay süresi + bitiş tarihi. **Cayma bedeli YOK** —
  *"önce bir ilk müşteriyi bulalım."*
- **Tek giriş kapısı.** Kariyer.net gibi "personel girişi / işveren
  girişi" ayrımı YAPILMAYACAK: MİYOP tek ürün, roller farklı. Giriş alanı
  `ad.soyad@FIRMAKODU` ile e-postayı kendi ayırt ediyor (göç 0078).

---

## 4 · TUZAKLAR

Her biri gerçekten düşülmüş bir hatadır.

**38 · "0 satırı güncelleyen" ifade sınanmış sayılmaz.** 0044 yerel
provada geçti çünkü o an güncellenecek satır yoktu; canlıda düştü.

**49 / 78 · Yazdığını "written" diye kabul etme, İÇERİĞİNDEN doğrula.**
Dosya yazma aracı "written" döndü, dosya diske yazılmamıştı. Boyut ve
içerik okunmadan yazma tamamlanmış sayılmaz. Birkaç saniye de bekle.

**52 · İzin kataloğuna ekleme yapmak bir mimari testi kırar.** Katalog
sayısı testte sabit.

**55 · Uygulamanın saydığı sayaç eskir.** Test toplamını daima
kullanıcının kendi çıktısından al.

**58 · YANLIŞ YEŞİL, KIRMIZIDAN KÖTÜDÜR.** Hiçbir şey bulamayan bir test
"temiz" der. Her tarayıcıya alt sınır sağlaması koy: hiç dosya/rota
bulamazsa PATLASIN.

**65 · Prova senin kurduğun dünyayı sınar; gerçek veri senin kurmadığın
dünyayı.** Yeni raporu gerçek veriyle de çalıştır.

**66 · Adresi/anahtarı KURALDAN üretme, KAYNAĞINDAN oku.** Bir değeri iki
yerde üretiyorsan biri yanlıştır.

**67 · `PUBLIC EXECUTE` PostgreSQL varsayılanıdır** ve `anon`un `app`
şeması üzerinde `usage` hakkı var. Her yeni fonksiyonun kapısı ELLE
kapatılmalı.

**68 · Testin kendisi yanlış olabilir.** Kelime arama DAVRANIŞ sınamaz.

**69 · Eski bayrağı miras bırakma.** `adminOnly` ebeveynden çocuğa
akıyordu; 152 menü satırının 146'sı sessizce yöneticiye kilitlenmişti.
Kalıtımla yayılan bir yetki bayrağı, tek tek yazılandan tehlikelidir —
kimse onu yazdığını hatırlamaz.

**70 · Aynı soruya üç yerde cevap veriliyorsa üçü de aynı ifadeyi
kullansın.** Menü, rota sunucusu ve kabuk ayrı ayrı yanıtlıyordu; ikisi
evet derken biri hayır dediği an kullanıcı menüde görünen ama açılmayan
ekranla karşılaşıyor.

**71 · Nesneyi yeniden kuran her yer alan düşürür.** `permissions`
`undefined` olunca yetki kontrolü fail-OPEN'a düşüyordu, çünkü
`undefined` "izin yok" değil "bilinmiyor" demekti. `undefined` ile `[]`
ayrı tutulmalı.

**72 · Testin GİRDİSİ de kaynaktan okunmalı.** Tahminle yazılan test
kendi varsayımını doğrular.

**73 · Görünmemek kapalı olmak değildir.** Menü GÖRÜNÜRLÜK kapısıdır,
rota ERİŞİM kapısı. Bir ekranın kapalı olduğunu menüye bakarak değil
`getCoreWorkspaceRoutes()`e bakarak söyle.

**74 · Bir kuralı yorumda tutamazsın.** Doğru teşhis dört gün kâğıt
üstünde kaldı ve risk gerçekleşti. Kuralı sınayan test yazılmadıysa
kural yok.

**75 · Sarmalayıcı bileşen tarayıcıyı kör eder.** Rota→sayfa eşlemesinde
ilk bileşen çerçeveyse o rota sessizce taramanın dışında kalır.
Bir tarayıcı "bulamadı" dediğinde, aradığı şeyin yokluğunu değil kendi
kalıbını sına.

**76 · Bir güvenlik iddiası yorumda duramaz.** Kodda "gerçek sınır
veritabanındadır" yazıyordu ve YANLIŞTI. Yorum okunmaz, test çalışır.

**77 · "Kapıyı taktım" demek için İKİ ayrı kanıt gerekir.** Tetiğin VAR
olması (mimari test, göç metninden) ile KİLİTLEMESİ (prova, gerçek
PostgreSQL'de) ayrı iki iddiadır. Yalnız birincisi olsaydı, hiçbir şeyi
reddetmeyen bir tetik de yeşil verirdi.

**79 · Kapıyı kolon kolon değil, SATIRIN DURUMUNA göre düşün.** 0081'de
"hangi kolon değişti" diye soruldu; dört delik kolon listesinin dışında
kaldı. Kolon sayan kural bir sonraki kolonda delinir.

**80 · Bir kontrol yazarken "hiçbir şey bulamazsa ne olur"u sına.**
`aclexplode(proacl)` `proacl` NULL iken — ki varsayılan budur — boş döner
ve kontrol YEŞİL verir. Doğrusu `coalesce(proacl, acldefault('f', proowner))`.
Bir kontrolün en tehlikeli hâli, bulamadığı için sessiz kalmasıdır.

**81 · İmza yalnız atıldığı anda korunmaz.** Sonradan silinebilen bir
imza, imza değildir.

**82 · `storage.ts` ile `core/stock/stock.repository.ts` İKİ AYRI
DÜNYA.** Birincisi localStorage'a, ikincisi Postgres'e yazar. Bir
dosyanın hangi dünyaya yazdığını, import ettiği fonksiyonun tanımına
inerek doğrula.

**83 · Mock sızıntı testinin kör noktası.** O test yalnız KİRACI
rotalarını tarıyordu; platform rotaları taranmıyordu.

**84 · Kapıyı WHERE'e koymak kapı değildir.** Hiç satır olmayan bir
sorguda PostgreSQL `where`deki fonksiyonu hiç çalıştırmaz; izinsiz çağrı
hata almadan boş liste alır. Kapı fonksiyon gövdesinin İLK SATIRINDA
olmalı.

**85 · `returns setof record` PostgREST'ten çağrılamaz.** Sarmalayıcının
sütunları açıkça yazılmalı.

**86 · Açık kiracı ekranları da tarayıcıya yazıyor olabilir.** `storage.ts`
bir mock dosyası değil — gerçek bir modül, ama yanlış yere yazıyor.
Kullanıcı Kaydet'e basıyor, ekran kaydedildi diyor, veri tarayıcıda
kalıyor. 25 açık rotanın 6'sı böyleydi.

**87 · İki ağır süreç aynı anda çalışmasın.** Codex depoyu tararken
`npm test` çalıştırıldı: test süresi 34 saniyeden 783 saniyeye çıktı ve
23 dosya `vitest-worker timeout` ile düştü. **Hiçbir test başarısız
olmadı** — çalışamadılar. Dağıtım betiği doğru davranıp yayını durdurdu,
ama sinyal yanlıştı.

**88 · Bir akışın izni TEK tabloya bakılarak belirlenemez.** 0085'te stok
kartına, lota ve şecereye `stock.write` kapısı koydum. İki meşru akış
kırıldı: kalite rolü etiket beyanını yazamaz oldu (o rolde `stock.write`
yok) ve satın almacı lot açamadı → **yarım kalmış mal kabul** (hareket
geçiyor, lot düşüyor). Mal kabulü üç tabloya yazar; üçünün de aynı izin
kümesini kabul etmesi gerekir. Kapı koymadan önce o akışı YAPAN EKRANIN
kapısı ölçülür.

**89 · Provada `exception when others` iddianın kendi hatasını da yutar.**
`prova-0086.sql` içinde başarısızlık yeşile dönüyordu: `prova_bak(..., false)`
kendi istisnasını atıyor, `when others` onu yakalıyor ve "geçti" diyordu.
**Kendi doğrulamamda yanlış yeşil.** Doğrusu: blok yalnız SQLSTATE
toplasın, iddia bloğun DIŞINDA kurulsun — ya da yalnız beklenen hata kodu
yakalansın. `yazma-kapilari-tamam.arch.test.ts` bu deseni artık yasaklıyor.

**90 · Kapı SAYMA, KAPISIZ YÜZEY ÖLÇ.** 0085'ten sonra "MIYOP-001 kapandı"
dedim; taktığım 9 kapıyı saymıştım. Codex 26 tablo daha buldu. 0088'de
doğru soruyu sordum: *`authenticated` rolüne yazma hakkı olup kapısı
olmayan tablo kaldı mı?* Cevap 26 değil **27**'ydi — Codex'in listesinde
olmayan `stock_item_nutrition` da çıktı (0072 alerjen beyanını kapatırken
besin değeri tablosunu atlamış, ve o tablo gıda etiketine basılıyor).
Artık göç bu sayıyı ölçüyor ve 0 değilse duruyor.

**91 · Depoda olmayan kanıt kanıt değildir.** Göç provalarını aylarca
koşturdum ve sonuçlarına dayanarak "kapı çalışıyor" dedim — ama dosyalar
yalnız benim çalışma ortamımdaydı. Depoda 36 dosyanın 6'sı vardı.
Sonuç: kimse doğrulayamıyordu, sürümler arasında karşılaştırılamıyordu,
Codex denetleyemiyordu, ve ben kendi sayımı yanlış hatırlıyordum. Codex
"bu dosyaların yolu nedir" diye sorunca ortaya çıktı. **Bir şeyin
çalıştığını söylüyorsan, onu kanıtlayan dosya depoda olmalı.**

**92 · Ölçen betiğin de kapısı olmalı.** Provaları sayan betiğin ilk hâli
iki ayrı yanlış yeşil veriyordu: (a) PostgreSQL kapalıyken psql
"connection refused" basar, o metinde `ERROR` geçmez — betik 36 dosyanın
hepsini YEŞİL saydı; (b) eski provalar başarısızlığı
`raise notice '❌ ...'` ile bildirir, bu bir NOTICE'tır, ERROR değildir —
grep görmedi. Bu yüzden "11 kırık" dedim, doğrusu **14**'tü. Doğrusu:
çıkış koduna bak, olumsuz işaretlerin HEPSİNİ ara, **ve en az bir olumlu
işaret görmüş ol.** Sessiz çıktı "geçti" demek değildir.

**93 · Kapı, kişiyi sorar; ama bazı yazımları SİSTEM yapar.** 0088'de 27
tabloya "bu satırı yazanın izni var mı" kapısı koydum ve iki akışı kırdım:
müşteri portalından sipariş verilemedi (portal müşterisinin `app_user`
kaydı YOKTUR), sevkiyat sevk edilemedi (sevkiyatçıda `operations.write`
yok ama sevk, siparişin durumunu ilerletir). Ders: bir yazım, kişinin
zaten izinli olduğu BAŞKA bir işlemin sonucu olabilir. 0089'un ayrımı:
`current_user in ('anon','authenticated')` ise istemci doğrudan yazıyor,
kapı sorulur; değilse bizim `security definer` rutinimizin içindeyiz ve
yetkiyi o rutin kontrol eder. **Bedeli ölçülür ve adlarıyla dondurulur.**

**94 · Rolü takmayan yetki provası kanıt değildir.** `set local role
authenticated` yapmadan, yalnız JWT ayarlayarak koşan bir prova
`postgres` rolündedir. 0089'dan sonra bu provalar kapının DIŞINDA kalır:
bütün yazımlar sessizce geçer, prova yeşil görünür. `prova-0081` ve
`prova-0082` tam olarak böyle körleşmişti; 0089 uygulanınca kırmızıya
döndüler — **iyi ki döndüler.** Codex aynı kusuru portal provalarında
bağımsız olarak buldu (MIYOP-042): e-postadan ibaret bir claim kuran
prova, gerçek müşteri JWT'siyle oluşan gerilemeyi göremez.

**95 · Göç kendi başarısını hata sanabilir.** `pg_get_functiondef` +
`replace` ile yama atan bir göç, ikinci koşusunda aradığı eski metni
bulamaz ve "elle değiştirilmiş" diye patlar. 0084 ve 0089 bu yüzden tekrar
çalıştırılamıyordu; 0089 canlıda tam bu hatayla durdu. Doğrusu üç hâli de
ele almak: **zaten yapılmış** (atla), **yapılmamış** (yap), **tanınmayan**
(patla). Daha büyük ders: teslim kontrol listesi 2026 boyunca *"göçü iki
kez çalıştır"* diyordu ama bunu hiç ÖLÇMEMİŞTİM. Ölçünce 90 göçün 9'unun
daha aynı kusurda olduğu çıktı. **Yazılı bir kural, uygulanmadığı sürece
yalnızca bir niyettir.**

**96 · Bir kapıyı açarken, açman GEREKEN kadarını aç.** 0089'da iki kırık
akışı onarmak için on kapıyı birden gevşettim. Oysa iki akışın yazdığı
tabloların hepsi TEK kapıya (`izin_gerek_coklu`) bağlıydı. Fazladan
gevşettiğim dokuz kapının ikisi veri bütünlüğü kuralıydı: sahte alerjen
damgası koruması (`MI436`) ve sunucunun attığı onay imzası. Yani iki
ilgisiz akışı onarmak için, gıda etiketine basılan bir iddianın korumasını
zayıflattım. Codex yakaladı. 0090 dokuzunu geri daralttı ve muaf yüzey
11 rutinden 6'ya indi. **Bir onarımın yan etkisi, onarımdan büyük olmamalı
— ve "ne kadarını açtım" ölçülebilir olmalı.**

**97 · Kimlik doğrulama yolunu TEK ADIMDA değiştirme.** MIYOP-043'ün
çözümü girişi sunucuya taşımak; ama `giris-yap` Edge Function'ı canlıya
dağıtılmadan `giris_adresi_bul`un `anon` hakkını almak **herkesi kapıda
bırakırdı** — açığı kapatmak uğruna ürünü kapatmak. Doğru sıra: önce yeni
yolu birincil yap ve eskisine yedek bırak, sonra dağıt ve ÇALIŞTIĞINI
DOĞRULA, en sonunda eski yolu ve yedeği birlikte kaldır. ⚠️ Ara adımda
açık HÂLÂ AÇIKTIR; "kapandı" demek ancak son adımdan sonra dürüsttür. Bu
yüzden yedek yol kodun içinde `GEÇİCİ YEDEK YOL · göç 0091 ile SİLİNECEK`
diye işaretli ve mimari test onun varlığını SAYIYOR: borç görünür kalsın.

**98 · Mock'ta olmayan şey, testin görmediği şeydir.** `authenticateUser`a
yeni bir çağrı ekledim (`functions.invoke`). Mock supabase'de `functions`
yoktu: çağrı `TypeError` attı, kodun kendi `try/catch`i onu yakalayıp
"ulaşılamadı" saydı ve **14 testin hepsi yedek yola düştü.** Testler yeşil
kaldı ama artık yanlış şeyi sınıyorlardı — dağıtımdan sonra çalışacak yolu
hiç görmüyorlardı. ⚠️ Bu, tuzak 89'un kardeşidir: orada iddianın hatası
yutuluyordu, burada **kodun kendi dayanıklılığı** testi kör ediyor.
Kural: bir çağrı eklediğinde mock'a da ekle; ve testin **hangi dalı**
koştuğunu iddiayla sabitle (`expect(signInWithPassword).not.toHaveBeenCalled()`
gibi). Yoksa kod sağlam, test kör olur.

**99 · Windows PowerShell betiğine Türkçe harf yazma.** `araclar/kaydet.ps1`
ilk sürümünde Türkçe açıklamalar ve `═` kutu çizgileri vardı. Windows
PowerShell 5.1, BOM'suz UTF-8 dosyayı ANSI sanıp çözüyor; çok baytlı
karakterler bozuluyor ve dosya `Missing closing '}'` ile hiç parse
edilemiyor. Hata mesajı 26. satırı gösteriyor ama sorun 1. satırdaki
yorumda. **`.ps1` dosyaları sadece ASCII yazılır**; Türkçe açıklama
`docs/` altına gider. (Alternatif BOM eklemektir, ama ASCII kurşun
geçirmezdir.)

**100 · `set -e` altında `DEGISKEN=$(komut)` betiği oracıkta öldürür.**
MIYOP-048'i onarırken çıktıyı saklayıp göstermek istedim:
`CIKTI=$(psql ...)` sonra `if [ $? -ne 0 ]`. Ama dosyanın başında `set -e`
var ve **başarısız bir atama errexit'i tetikler** — yani "hatayı göster"
diye yazdığım satırlara hiç gelinmiyordu. Hata mesajı da yoktu, betik
sessizce çıkıyordu. Doğrusu çağrıyı `if`in KOŞULUNA almak:
`if CIKTI=$(...); then ... else ... fi` — `set -e` bir koşulda
değerlendirilen komutu sonlandırmaz. ⚠️ Ders daha genel: **bir onarımı
yazdıktan sonra onu BİLEREK BOZ ve gerçekten çalıştığını gör.** Bu kez
bozuk bir göç uydurup denedim; Codex'in bulması gerekmemeliydi.

**101 · "anon'dan al" yetmez; hakkın KİME verildiğine bak.** MIYOP-043'ü
kapatmak için `giris_adresi_bul`un `anon` hakkını almayı planlamıştım.
0078 o fonksiyonu `anon, authenticated, service_role`e **birlikte**
veriyor ve fonksiyonun içinde kiracı kapısı yok. Yalnız `anon`dan almak,
oturum açmış herhangi birinin **başka işletmenin** kullanıcı adını
sorgulayıp gerçek Auth adresini almasını engellemezdi — yani onarım
yarım kalırdı ve ben "kapandı" diyecektim. Bir ACL'yi değiştirmeden önce
`proacl`i OKU; hangi rollerin yazılı olduğunu varsayma.

**102 · Varsayılanı okumadan API çağırma — `signOut()` bütün cihazları
kapatır.** MIYOP-052'yi (yarım oturum) onarmak için `auth.signOut()`
ekledim. Supabase'de o çağrının varsayılan kapsamı **`global`**: kullanıcı
başka bir cihazda çalışırken buradaki GEÇİCİ bir okuma hatası onun refresh
token'ını da iptal ediyor ve o cihaz sessizce düşüyor. Yani bir yarım
oturumu onarırken başka birinin oturumunu kırıyordum. Doğrusu
`{ scope: 'local' }`. ⚠️ Daha genel ders: bir onarım için yeni bir API
çağrısı eklediğinde **varsayılan davranışını oku** — "işe yarıyor"
görünmesi, doğru kapsamda çalıştığı anlamına gelmez. Ve kapsam bir
KARARDIR: hesap pasifse `global` doğru (nerede açıksa kapansın), okuma
hatasıysa `local` doğru (arıza, cezalandırma değil).

**103 · Bir onarımın EKRANA ULAŞTIĞINI doğrula.** MIYOP-051'i "kapattım"
dedim: Edge Function kotayı 429 ile ayırıyordu, istemci `gecici` diye
işaretliyordu, test de yedek yola düşmediğini kanıtlıyordu. Hepsi doğruydu
ve **kullanıcı yine "şifre hatalı" görüyordu** — çünkü `storage.ts` `null`
dönüyor ve mesaj orada ölüyordu. Zincirin üç halkası doğru, dördüncüsü
yoktu. Bir hata sınıflandırmasının değeri, kullanıcının gördüğü cümlede
ölçülür; katmanda değil.

**104 · "Başarısız giriş" dalları tek tek temizlenmez; HEPSİ sayılır.**
MIYOP-052'de `getUser` hatasında oturum açık kalıyordu — onardım.
MIYOP-055'te onarımın kapsamı yanlıştı — onardım. MIYOP-056'da aynı kusur
**izin okuma dalında** çıktı. Üç tur, aynı aile. Hata şuydu: her seferinde
Codex'in gösterdiği TEK dalı onardım, "başarılı kimlik doğrulamasından
sonra `null` dönen kaç dal var" diye SORMADIM. Doğrusu: bir temizlik
eksikliği bulduğunda, aynı fonksiyon zincirindeki bütün erken çıkışları
listele ve her birinde oturumun ne hâlde kaldığını yaz. ⚠️ Bu, tuzak 90'ın
("kapı sayma, kapısız yüzey ölç") kimlik doğrulama hâlidir.

**105 · Commit mesajı, OLMUŞ olanı anlatır; olması planlananı değil.**
Codex brifini B başlığına çevirdim, dosyayı göndermeye çalıştım, dosya bir
programda **açık olduğu için reddedildi** — ama commit mesajı *"Codex brifi
artık yarım ekranlara bakıyor"* diyordu ve o commit atıldı. Yani kayıt,
depoda olmayan bir şeyi anlatıyordu. Codex fark etti (MIYOP-057) ve haklı:
brif eski kapsamıyla duruyordu, Emrah da onu yapıştırdı. ⚠️ Kural: bir
dosya yazımı REDDEDİLDİYSE commit mesajı düzeltilir ya da commit o turda
atılmaz. Bir reddi "sonra hallederim" diye geçmek, geçmişi yanlış yazmaktır.

**106 · Bir katmanda düzelttiğin yalanı, başka katman geri söylüyor.**
Göç `0084` tam olarak şunu onardı: başvuru onayı `company.legal_name`
alanına `company_name`i KOPYALIYORDU, yani uydurma bir ticari unvan
yazıyordu. Veritabanı tarafı düzeldi. Ama `storage.ts`teki
`normalizeCompany` hâlâ aynı şeyi yapıyor:
`legalName: item.legalName || companyName` ve
`authorizedPerson: item.authorizedPerson || ownerName || companyName`.
Firma Profili ekranı veriyi oradan okuduğu için kullanıcı boş olması
gereken yasal unvanı **dolu** görüyor; alanı boşaltsa normalizasyon
yeniden dolduruyor. ⚠️ Kural: bir kusuru onardığında **aynı kusurun diğer
katmanda yaşayıp yaşamadığını ölç.** "Veritabanında onarıldı" cümlesi,
"ekranda onarıldı" demek değildir. Bu, tuzak 103'ün ("ekranda gördüğünü
doğrula") ters yönü: oradaki tehlike onarımın ekrana ulaşmaması, buradaki
tehlike ekranın kendi başına yalan üretmeye devam etmesi.

**107 · Sahte veri aramak için "mock" kelimesini aramak yetmez.**
`mock-rota-sizintisi.arch.test.ts` yalnız iki imzayı suç sayıyor:
`*.mock.ts(x)` dosyaları ve `SEED…COUNT` + `localStorage.setItem` deseni.
Codex'in 21.10 taraması gösterdi ki depoda **adı mock olmayan 27 tane
`createDemo*` üreticisi** var ve bunların çoğu "depo boşsa demo üret"
dalından geçiyor. Bunlardan dördü (4 demo şube) açık `branch-permissions`
ekranına, biri (bakım + lisans duyurusu) **müşterinin gördüğü portala**
ulaşıyor. ⚠️ Kural: kapsamı iddiadan dar olan bir test, iddiayı
güçlendirmez — **zayıflatır.** "Bakmadık" dürüsttür; "baktık, temiz"
yanlıştır. Bir testin kapsamını, savunduğu cümleyle birlikte yaz: bu test
"depoda mock dosyası yok" diyebilir, "uydurma veri yok" **diyemez.**

**108 · Bir ekranı onarmak, o ekranı besleyen ortak kaynağı onarmaz.**
Profilim'i gerçek veriye bağladım ve çıcır 6'dan 5'e indi — doğru iş. Ama
kalan dört ekranın hepsi **aynı iki fonksiyondan** besleniyor:
`loadBranches()` ve `loadCompanies()`. İkisi de depo boşken demo satır
üretiyor, üstelik `company-bridge` gerçek şubeleri aynalarken bu demo
satırları **koruyarak** geri kaydediyor — yani sahte veri kalıcı hâle
geliyor. Ekranları tek tek onarmak, kaynak sahte üretmeye devam ettiği
sürece sırayı kısaltmıyor. ⚠️ Kural: ekran borcu listesinde iki ekran aynı
kaynağı okuyorsa, **önce kaynağı** onar. Bu, tuzak 90'ın ("kapı sayma,
kapısız yüzey ölç") ekran hâlidir.

**109 · "Kapı var" demek, kapıya giden BÜTÜN yolları saydığın anlamına
gelmez.** 21.10'da *"donmuş modüller rota kesmesiyle kapalı"* dedim ve
üç kapı gösterdim: registry süzmesi, `App`in render ettiği rota kümesi,
`RouteHost`un ikinci reddi. Üçü de doğru. Ama `App.tsx` içinde `/qr/<id>`
yolunu yakalayıp donmuş modülün sayfasını **doğrudan** döndüren bir dal
vardı ve o dal üç kapının **hiçbirinden** geçmiyordu (MIYOP-067). Codex de
ilk turda aynı kör noktada durmuş, ikinci turda kendi değerlendirmesini
düzeltti. ⚠️ Kural: bir kapının yeterliliğini savunurken **o kapıya
girmeyen yolları ara** — public yollar, derin bağlantılar, hash yolları,
doğrudan render eden erken dönüşler. Kapıyı değil, **yüzeyi** say (tuzak
90) ve sonra o sayıyı bir testle dondur ki yeni yol sessizce eklenmesin.
⚠️ Bu tuzağın küçük kardeşi aynı gün bende de çıktı: Profilim'in kabuk
geri çağrısını **yazdım** ama prop'un geçirilip geçirilmediğini ölçmedim
(MIYOP-066). Yazılmış bir çağrı, bağlanmış bir çağrı değildir.

**110 · Kod yorumu bir ölçüm değildir; benim yazdığım özet de değil.**
25.10'da *"MİYOP neler yapıyor"* özetini yazdım ve içinde iki yanlış vardı
(MIYOP-070): MIYOP-043'ü **"tam oldu"** saydım — oysa biten şey göç
0091'di ve o **başka bir iş**; 043'ün son adımı (giriş ACL'si, göç 0092)
hâlâ açık ve Edge Function dağıtılmadı. Modül Mağazası'nı **"açık"**
saydım — oysa rota açık kümede değil. İkinci yanlışın sebebi öğreticiydi:
kayıttaki bir **yorum** *"rota duruyor (NON_NAV_CORE_ROUTES), geri almak
tek satır"* diyordu. Yorum eskimiş ve yanlıştı; ben koda değil yoruma
inandım. ⚠️ İki kural: **(1)** bir işin bitip bitmediği, tamamlanan göçün
numarasından değil **o işin kendi kabul ölçütünden** okunur — "bir göç
uygulandı" ile "iş kapandı" aynı şey değildir. **(2)** Bir durum iddiası
yazarken kaynağı **çalıştırılabilir** olmalı: "rota açık mı" sorusunun
cevabı `getCoreWorkspaceRoutes()`tür, yanındaki yorum değil. Yorum
yanlışsa yorumu da düzelt, yoksa bir sonraki kişiyi de yanıltır.

**111 · Bir ekranı kapatmak, onu besleyen üreticiyi silmez.**
Tek merkez kararıyla Şube Yetkileri ekranı kapandı ve MIYOP-061 (başka
kiracının önbellek verisi) gerçekten kapandı — ama `createDemoBranches`
hâlâ duruyor ve `company-bridge` onu hâlâ kalıcılaştırıyor. Dört uydurma
şube üretilmeye devam ediyor; sadece onları GÖSTEREN ekran yok. ⚠️ Kural:
bir kusuru "kapandı" yazarken kapanan şeyin **yüzey mi kaynak mı**
olduğunu söyle. Yüzey kapanışı meşru bir ilerlemedir; kaynak kapanışı
sanılırsa, yüzey bir gün geri açıldığında kusur onunla birlikte geri gelir.
Aynı ayrım kapsam için de geçerli: çıcır listesinden çıkan iki şube ekranı
**düzeltilmedi**, kapsam dışına çıktı — testin içine bu not yazıldı ki
ileride "düzeltilmiş" sanılmasın.

**112 · Arama yaptığın evren, depo olmak zorunda.**
`loadSystemAnnouncements`in imzasını değiştirdim, çağrı yerlerini aradım,
"üç yer" buldum, üçünü düzelttim ve teslim ettim. Dördüncü çağrı
`mobile-integration/mobile-integration.service.ts` içindeydi ve **tip
denetimini kıracaktı** (MIYOP-071, Codex yakaladı). Sebep basit ve
utandırıcı: aramayı **depoda değil, kendi yerel kopyamda** yaptım. O kopya
yalnız benim o güne kadar çektiğim dosyaları taşıyordu — 241 dosya, gerçek
`src` çok daha büyük ve `mobile-integration` klasörü kopyada **hiç yoktu.**
Yani "başka çağrı yok" sonucuna **eksik bir evrende** vardım ve sonucu tam
bir evrenmiş gibi sundum. ⚠️ Kural: paylaşılan bir imzayı değiştirirken
çağrı yüzeyini **deponun kendisinde** ara. Bu ortamdan yapamıyorsam iki yol
var ve ikisi de benim işim: (a) aramayı yapan bir **test** yaz — test
Emrah'ın makinesinde çalışır, orada bütün depo vardır; (b) işi Codex'e ver,
o depoyu okuyor. "Aradım, bulamadım" cümlesi, nerede aradığını söylemeden
bir kanıt değildir (tuzak 91'in arama hâli).

**113 · Bir yalanı düzeltirken yerine koyduğun cümleyi de ölç.**
Giriş vitrinindeki uydurma vaatleri sildim — doğru iş. Yerine yazdığım iki
cümle ise yine **mutlak** çıktı: *"aynı hesapla her cihazdan aynı kayda
ulaşırsınız"* ve *"her değişiklik denetim kaydına düşer"* (MIYOP-072).
İkisi de operasyon kayıtları için doğru; ama Firma Profili ve İşletme
Ayarları ekranları hâlâ tarayıcıya yazıyor, yani o veriler cihazda kalıyor
ve hiçbir denetim kaydına girmiyor. Üstelik yazdığım testler bunu
yakalayamazdı: test **kelime** arıyordu (dondurulmuş modül adları), **anlam**
ölçmüyordu. ⚠️ Kural: bir vaadi yazarken "hangi ekranlar bunu gerçekten
yapıyor" diye SAY ve cümleyi o sayıya göre kur. "Her", "tüm", "hepsi" gibi
mutlak kelimeler, ancak kapısız yüzeyi ölçtüysen yazılır (tuzak 90).
⚠️ Ve bir testin neyi kanıtlamadığını da yaz (tuzak 107): kelime taraması
anlam doğruluğu kanıtlamaz.

**114 · Gerçek saati okuyan kodu sabit tarihle sınamak, saatli bomba
kurmaktır — ve bomba patlayınca kuralı değil testi sorgula.**
Göç 0092'den sonra Emrah'ın makinesinde **20 test kırmızı** oldu. Sebep
kapı değildi: `warehouse`, `work-order` ve `shipment` testleri lotlara
`'2026-06-01'`, `'2026-10-01'` gibi **sabit** SKT'ler veriyordu. Yazıldıkları
gün ikisi de gelecekteydi; 25.10.2026'da geçmişe düşmüşlerdi. Testlerin
ölçtüğü şey **FEFO sırasıydı**, SKT'nin geçip geçmediği değil — yani
fixture, ölçtüğü şeyle ilgisi olmayan bir sebeple eskimişti. Üstelik aynı
dosyada `gunSonra()` diye göreli bir yardımcı **zaten vardı**, ama o da
`BUGUN = 15 Haziran 2026` sabitine bağlıydı.
⚠️ İki kural: **(1)** Bir fixture, test edilen kod gerçek saati okuyorsa
**gerçek bugüne göre** verilir. **(2)** Yeni bir kapı eski testleri
kırdığında ilk soru *"kapıyı gevşeteyim mi"* değil, **"bu test hangi
kuralı yazıyordu ve o kural hâlâ doğru mu"**dur. Burada eski test
*"süresi geçmiş lotu tüket"* diyordu; o davranış artık YANLIŞ, dolayısıyla
testin değişmesi doğruydu. Bu ayrımı yapmadan fixture düzeltmek, kendi
değişikliğini geçirmek için testi susturmaya benzer — farkı, kararı
yazılı bırakmak yaratır.

**115 · Bir kapı koyduğunda, o kapının ürettiği HATA MESAJINI da ölç.**
SKT süzgeci eklenince süresi geçmiş partiler elendi ve kalan miktar
yetmeyince kullanıcı *"Yetersiz stok: 45 istendi, defterde 30 var"*
mesajını almaya başladı. Mesaj teknik olarak doğru ama **gerçekte
yanlış**: depoda 45 kilo var, 15 kilosunun süresi geçmiş. Kullanıcı
deposuna bakıp malı görüyor, sistem "yok" diyor ve aradaki farkı kimse
açıklamıyor. ⚠️ Kural: bir süzgeç koyduğunda, süzgecin **elediği şey
yüzünden** oluşan hata yollarını da gez ve mesajı düzelt. Doğru olmayan
bir hata mesajı da bir tür *"mış gibi"*dir; kullanıcı sisteme değil
kendine güvenmeyi bırakır.

**116 · `security definer` bir rutin, KİRACIYI KENDİSİ DOĞRULAMAK
ZORUNDADIR.** (MIYOP-075 · Codex, 26.10 · **P0, kendi yazdığım göçte**)
`app.numune_olayi()` olay satırını yazarken numuneyi **yalnız
`new.sample_id`** ile buluyordu. Fonksiyon `security definer` olduğu için
RLS'i atlıyor; olay satırının **kendi** `tenant_id`si saldırganın kendi
kiracısını gösterdiği için RLS politikası da geçiyordu. Sonuç: A
kiracısındaki bir üretim sorumlusu, B kiracısının numunesini IMHA'ya
çevirebiliyordu. Prova ile canlandırıldı; onarımdan önce B'nin numunesi
gerçekten IMHA oldu.
⚠️ **Yanıltan şey şuydu:** tabloda RLS AÇIK ve FORCE, politika doğru
yazılmış, yetki tetiği bağlı. Üç kapı da yerindeydi — ama hiçbiri
*"yazdığın satırın İŞARET ETTİĞİ kayıt senin mi"* sorusunu sormuyordu.
RLS yazılan satırı denetler, o satırın **gösterdiğini** denetlemez.
⚠️ Kural: `security definer` bir rutin içinde başka bir satırı okuyor ya
da güncelliyorsan, kiracıyı `app.current_tenant_id()`den oku ve
**aramaya kiracıyı da kat** (`where id = … and tenant_id = v_kiraci`).
`new.tenant_id`e güvenmek, imzayı istemciden almakla aynı şeydir.
⚠️ İkinci kural: **"yok" ile "başkasının" AYNI mesajı vermeli.** Ayrı
mesaj vermek, denemeyle başka bir kiracıda o kimliğin var olduğunu
doğrulatır.

**117 · Bir kusur gösterildiğinde, AYNI DESENİN DİĞER YERLERİNE BAK.**
(26.10) Codex 075'i `numune_olayi()`de gösterdi. Aynı kusur
`numune_turet()`te de vardı ve raporda yoktu: parti, şube ve iş emri
kimlikleri kiracı doğrulanmadan okunuyordu, yani A kiracısı B'nin
**partisinden** numune alabiliyordu — hem B'nin SKT'sini ve saklama
koşulunu okuyarak, hem kendi defterine B'nin partisine referans yazarak.
⚠️ Kural: bir bulgu bir ADRES değil bir DESEN'dir. Gösterilen satırı
onarıp aynı göçün diğer rutinlerine bakmamak, onarımı yarım bırakmaktır —
ve ikinci yarı artık "bilinen bir kusur" olmadığı için daha uzun yaşar.

**118 · YAZDIĞIN AMA OKUMADIĞIN KOLON, OLMAYAN KOLONDAN KÖTÜDÜR.**
(MIYOP-076 · 26.10) Göç 0093 `opened_shelf_life_days` kolonunu yarattı,
ekranda alan açılabilirdi, dokümanda kural yazılıydı — ve **hiçbir yerde
okunmuyordu.** Numune açıldıktan sonra saklama sonu yine partinin SKT'si
kalıyordu. Yani *"açılmış ise açık kalmaya uygun olduğu gün kadar"*
cümlesi yazılıydı ve sistem onu yapmıyordu.
⚠️ Olmayan bir kolon dürüsttür: kimse ona güvenmez. Var olup işlemeyen
bir kolon **yalan söyler**: hem kullanıcı hem bir sonraki geliştirici
kuralın işlediğini sanır.
⚠️ Kural: bir kolon eklediğinde onu **okuyan** yolu aynı göçte yaz, ya da
göçün doğrulamasına *"bu kolon bir yerde okunuyor mu"* ölçümünü koy. 0094
tam bunu yapıyor: `v_olay !~ 'opened_shelf_life_days'` ise göç patlıyor.

**119 · BAYRAK BİR BEYANDIR, TARİH BİR OLGUDUR — KURAL OLGUYA BAKAR.**
(MIYOP-074'ün kalanı · 26.10) `warehouse.service.ts` süresi geçmiş miktarı
yalnız `kart.sktTakipli && kart.lotTakipli` olan kalemlerde arıyordu. Ama
göç 0092'nin kapısı `stock_item.tracks_expiry` bayrağına **hiç bakmıyor**;
yalnız `stock_lot.expires_on` soruyor. Lot takipli ama "SKT takipsiz"
işaretlenmiş bir kalemin partisine mal kabulde tarih yazılmışsa, sunucu o
partiden çıkışı REDDEDERKEN ekran malı "kullanılabilir" sayıyor, FEFO onu
seçiyor ve kullanıcı sebebini anlamadığı bir hata alıyordu.
⚠️ Kural: ekranın süzgeci sunucunun kapısından **daha dar** olamaz. Daha
geniş olması kullanıcıyı reddedilecek bir işleme sokar; **daha dar**
olması ise sunucunun reddettiği şeyi ekranın hiç bildirmemesi demektir —
ve uyarı sistemi en çok gereken yerde sessiz kalır.
⚠️ İki tarafı birlikte tutmanın yolu NOT değil ÖLÇÜM: `skt-kapisi.arch.test.ts`
artık *"göç `tracks_expiry` okumaya başlamış mı"* diye soruyor.

**120 · AYNI SORUYA İKİ EKRAN İKİ CEVAP VERİYORSA, İKİSİNE DE GÜVEN
BİTER.** (26.10 · göç 0095) "Kaç kritik kalemim var" sorusunu Depo ekranı
**kullanılabilir** bakiyeden ve `<=` ile, Analiz ekranı
(`app.isletme_gostergeleri`, 0065) **fiziksel** bakiyeden ve `<` ile
cevaplıyordu. İki ayrı fark, iki ayrı sayı. Olumsuz kontrol: eski
fonksiyonla kritik sayısı **0**, yenisiyle **2** — gerçekten 2 kritik
kalem varken.
⚠️ Kural: bir türetme kuralını (burada "kullanılabilir bakiye") ikinci bir
sorguda **tekrar yazmak** yerine, veritabanında **tek bir görünüme** koy ve
herkes onu okusun. Tekrar yazılan kural bir gün ayrışır ve hangisinin
doğru olduğu söylenemez.
⚠️ Görünüm kurarken `security_invoker = on` ŞART: onsuz görünüm SAHİBİNİN
haklarıyla çalışır, RLS'i atlar ve iki kiracı birbirinin bakiyesini görür.
Göçün doğrulaması bunu ölçüyor, yorumla geçmiyor.

**121 · BİR ALANI ZORUNLU YAPTIYSAN, O ALANI YAZABİLECEK BİR YOL
OLDUĞUNU ÖLÇ.** (26.10) Göç 0093 saklama koşulunu ürün kartına taşıdı ve
*"koşulu yazılmayan üründen numune alınamaz"* kuralını koydu. Ekran
yazıldığında ortaya çıktı: kartı **güncelleyen hiçbir yol yoktu**
(`StokKatalogu` yalnız `kalemEkle` taşıyordu, eski "Stok Kartları" ekranı
donmuş). Yani var olan ürünlerin koşulu hiçbir zaman yazılamaz, o
ürünlerden numune hiçbir zaman alınamazdı — kural teknik olarak doğru,
pratikte bir kilit.
⚠️ İkinci yarısı izin tarafında çıktı: kartın yazma kapısı `stock.write`
istiyordu ve `stock.write` **kalite sorumlusunda ve gıda mühendisinde
YOK**. Numunenin kuralını uygulayan departman, o kuralın girdisini
yazamıyordu. Göç 0096 iki alanı alerjen beyanı gibi **beyan** sayarak
`quality.declaration`a da açtı; `stock.write` kaldırılmadı.
⚠️ Kural: yeni bir zorunlu alan yazdıysan üç soruyu ölç — **(1)** bu alanı
yazan bir ekran var mı, **(2)** var olan kayıtlar için yazılabiliyor mu,
**(3)** yazması gereken ROLÜN izni var mı. Üçü de yoksa "kural koydum"
demek, "kilit koydum" demektir.

**122 · BİR TABLODA İKİ KAPI VARSA, İSTEK EN GEVŞEĞİNDEN GEÇER.**
(26.10 · göç 0097) Şahit numune imhasını daraltmak için olay defterine
yeni bir izin tetiği yazdım. 0093'ün gevşek tetiği
(`izin_witness_sample_event`, iki izinden birini yeterli sayan) **aynı
tabloda duruyordu.** İki BEFORE tetiği birlikte çalışır ve ikisi de
"geçti" derse istek geçer; yani yeni dar kapı hiçbir şeyi engellemezdi —
üretim sorumlusu eski kapıdan imhayı yine yazardı.
⚠️ Kural: bir kapıyı sıkılaştırırken **eskisini düşürdüğünü ÖLÇ.** 0097
hem göçün doğrulamasında (`eski gevşek izin tetiği hâlâ bağlı`) hem
provada (sınama 11b) hem çıcırda (`drop trigger if exists ...`) bunu
ayrıca sınıyor — üç yerde, çünkü sessizce geçmesi mümkün olan bir hatadır.
⚠️ Aynı şey kod tarafında da geçerli: bir ekrana ikinci bir yetki kontrolü
eklerken eskisi kalırsa gevşek olan kazanır.

**123 · YENİ BİR KURAL ESKİ PROVAYI KIRDIĞINDA, PROVAYI DOĞRU SEBEPLE
ONAR.** (26.10) 0097'den sonra `prova-0093.sql` beş sınamada kırmızı
döndü: imha adımları üretim sorumlusunun oturumunda yazılıyordu. İki
yanlış onarım yolu vardı — kapıyı gevşetmek (kuralı yok etmek) ya da
bütün provayı kalite rolüne çevirmek.
İkincisi daha sinsi: sınama 17 *"imha edilmiş defter kapandı"* kuralını
ölçüyor ve beklediği hata **MI409** (defter kapalı). Rolü kalitede
bıraksaydım yeşil kalırdı ama MI403 (izin yok) ile de yeşil kalabilirdi —
yani **yanlış sebeple yeşil**. Onarım adım adım yapıldı: imha adımı
onaylayabilen role geçti, sonraki adım üretime geri alındı.
⚠️ Kural: bir prova kırıldığında rolü/girdiyi değiştirmeden önce *"bu
sınama hangi kuralı ölçüyor ve beklediği hata kodu hangisi"* diye sor.
Yanlış sebeple yeşil, kırmızıdan kötüdür (tuzak 58'in izin hâli).

**124 · ZİNCİRİN BİR NOKTASINDA ÇALIŞAN ÖLÇÜM, O NOKTADAN SONRA EKLENENİ
ÖLÇMEZ.** (26.10 · göç 0098) 0090 "gevşek kapıya bağlı tablolara yazan
`security definer` rutinler" yüzeyini ADIYLA dondurdu ve o gün doğruydu.
0093 (şahit numune) üç göç sonra `witness_sample`ı o kapıya bağladı ve
`app.numune_olayi()` adlı `security definer` bir tetik o tabloya UPDATE
yazdı. **Yüzey 6'dan 7'ye çıktı ve hiçbir şey kırılmadı** — çünkü 0090
zincirde 0093'ten ÖNCE koşuyor ve bir daha hiç koşmuyor.
⚠️ Yani dondurduğum yüzey, dondurduktan sonra büyüdü. Ve büyüdüğü yer tam
olarak Codex'in MIYOP-075'i (P0, çapraz kiracı yazımı) bulduğu rutindi.
⚠️ Kural: bir göç ÖLÇÜM yapıyorsa (sayı dondurma, yüzey listesi, "başka
yok" iddiası), o ölçüm **tek seferlik bir fotoğraftır.** Kalıcı kılmak için
ya aynı ölçüm bir ÇİÇİR TESTİNE taşınır (her koşuda çalışır), ya da yeni
tablo/rutin ekleyen her göç o ölçümü kendi içinde tekrarlar.
⚠️ Pratik alışkanlık: güvenlik yüzeyini değiştiren bir göç yazdıktan sonra
**eski ölçüm göçlerini GÜNCEL veritabanında yeniden çalıştır** (0085, 0089,
0090, 0091). Bu turda 0098 tam böyle doğdu.

**125 · BİR YARDIMCI FONKSİYONUN NE DÖNDÜRDÜĞÜNÜ OKUMADAN ONA SINAMA
YAZMA.** (26.10) Şahit Numune ekranının hangi rollerde göründüğünü ölçen
yedi sınamayı `menuEkranlari()` üzerine yazdım ve **rota** bekledim
(`'sahit-numune'`). O fonksiyon **etiket** döndürüyor (`out.push(x.label)`).
Yedi sınama kırmızı verdi.
⚠️ Kırmızının söylediği şey yanlıştı: *"ekran menüde yok."* Ekran menüde
VARDI — aynı dosyadaki sayı sınamaları yedi rolde +1 ile zaten geçiyordu.
Yani test, ölçtüğünü sandığı şeyi ölçmüyordu; yanlış biçimde bir beklenti
yazmak, var olan bir şeyi yok göstermekle aynı şey.
⚠️ Beni yanıltan şey, fonksiyonu daha önce okumuş olduğumu sanmamdı. Aynı
dosyanın bir başka kesitini okumuş ve `out.push(x.route)` diye hatırlıyordum.
**Hatırladığım kaynak, kaynak değildir** (tuzak 112'nin tekrarı: aramayı
deponun kendisinde yap).
⚠️ İki katmanlı onarım: **(1)** beklenen değer artık KAYITTAN okunuyor,
elle yazılmıyor — etiket değişirse test yanlış sebeple kırılmasın.
**(2)** Üstüne bir *sağlama* sınaması eklendi: *"menü listesi ETİKET
taşıyor, rota değil"*, olumsuz kontrolle. Yani biçim varsayımının kendisi
de ölçülüyor; yardımcı bir gün rotaya dönerse tek bir sınama kırılıyor,
yedi tanesi birden *"ekran yok"* demiyor.

**126 · BİR ENGELİ YALNIZ SEÇİLİ ÖGE İÇİN GÖSTERMEK, SEÇEMEYEN KULLANICIYA
HİÇ GÖSTERMEMEKTİR.** (26.10) Şahit Numune ekranında parti listesi doluydu
ama hepsi "seçilemez" durumdaydı (ürün kartlarında saklama koşulu yazılı
değil). Sebebi yazmıştım — ama **yalnız SEÇİLEN parti için.** Kullanıcı
hiçbir şey seçemediği için sebebi hiç görmedi. Emrah ekranı açtı ve
*"numune alamıyorum"* dedi; ekran neden olmadığını söylemiyordu.
⚠️ İki durum AYRI ve ayrı cümle ister: **"liste boş"** (yapacak bir şey
yok) ile **"listede var ama hiçbiri seçilemez"** (eksik olan şey
DÜZELTİLEBİLİR). İkincisinde kaç tanesinin neden seçilemediğini ve nerede
düzeltileceğini söylemek gerekiyor.
⚠️ Genel kural: bir seçim kontrolünde ögeleri `disabled` yapıyorsan,
**hiçbirinin seçilemediği hâli ayrıca ele al.** O hâlde kullanıcı tek bir
tıklama bile yapamaz ve senin yazdığın bütün açıklamalar erişilemez olur.
Aynı tuzak boş liste + süzgeç kombinasyonlarında da geçerli: süzgecin
hepsini elediği durum, verinin hiç olmadığı durumdan farklıdır.

**127 · BİR FONKSİYONUN GÖVDESİNİ İLERİ TAŞIRKEN, O ADIN SONRADAN BAŞKA
BİR ŞEYE DÖNÜŞMÜŞ OLABİLECEĞİNİ SOR.** (MIYOP-078 · P0 · Codex, 27.10)
0095'i yazarken gösterge hesabını **0065'ten** kopyalayıp
`app.isletme_gostergeleri` adına yazdım. Ama **0071 o adı bir `finance.read`
İZİN KAPISINA çevirmiş**, ham hesabı `..._ham` adına taşımıştı. Yani 0095,
otuz göç sonra, bir güvenlik kapısını ham hesapla EZDİ.
⚠️ Sonuç canlıya gitti: finans izni olmayan depo/üretim/kalite/gıda
mühendisi, fire tutarını ve stok maliyetini doğrudan RPC'den okuyabildi.
⚠️ **KENDİ DOĞRULAMAM HATAYI GEREKTİRİYORDU.** 0095 şunu ölçüyordu:
*"`isletme_gostergeleri` gövdesinde `stock_usable_balance` geçiyor mu?"*
Ham gövdeyi oraya yazdığım için ölçüm GEÇTİ — **doğru yere yazsaydım kendi
doğrulamam kırmızı verecekti.** Yani doğrulama yanlış fonksiyonu ölçüyordu
ve hatayı yakalamak şöyle dursun, onu şart koşuyordu.
⚠️ Provam da kaçırdı: göstergeleri yalnız `isletme_sahibi` oturumunda
çağırıyordu ve onda `finance.read` VAR. **Olumsuz kontrolü olmayan bir
sınama, kapının varlığını değil yokluğunu da onaylar.**
⚠️ Üç kural: **(1)** `create or replace` yazmadan önce o adın BUGÜN ne
olduğuna `pg_get_functiondef` ile bak, en son hangi göçün yazdığını bul.
**(2)** Bir izin kapısı yazdığın/koruduğun her yerde İZNİ OLMAYAN bir
oturumla da sına. **(3)** Göçün doğrulaması, hesabın DOĞRU YERDE olduğunu
ve kapının YERİNDE kaldığını AYRI AYRI ölçsün.

**128 · DOSYA ADI DESENİ, ADLARIN BÜYÜMESİNİ HESABA KATMALI.** (27.10)
`db/prova/kur.sh` göçleri `00[0-9][0-9]_*.sql` deseniyle tarıyordu —
yani 0000–0099. Göç **0100** yazıldığında desen onu yakalamadı ve betik
*"✅ 100 göç uygulandı"* diyerek **sessizce geçti**; prova-0100 kırmızı
değil BOŞ döndü (sıfır sınama). Yani yeni göç provasız kaldı ve bunu
söyleyen hiçbir şey yoktu.
⚠️ Bu tuzak 80'in kardeşi: bulamadığı için sessiz kalan bir kontrol,
kontrol değildir. Desen genişletildi (`[0-9][0-9][0-9][0-9]_`) **ve bir
sağlama eklendi**: uygulanan göç sayısı ile klasördeki numaralı dosya
sayısı EŞİT olmalı, değilse betik patlıyor. Deseni düzeltmek yetmezdi —
bir sonraki sınır (05000?) yine sessizce gelirdi.

**129 · BİR ONARIM GÖÇÜNE, ONARIMLA İLGİSİ OLMAYAN KONTROL KOYMA — ONARIMI
REHİN ALIR.** (27.10) 0099'un işi bir P0'ı kapatmaktı: 0095'in ezdiği
`finance.read` kapısını geri koymak. Doğrulamasına bir de *"benzeri de
kırıldı mı"* diye `fire_dokumu` kapısını ekledim (tuzak 117'yi uygulayayım
diye). O kontrol canlıda kırmızı verdi — **ve Supabase bütün betiği tek
işlemde çalıştırdığı için yukarıdaki kapı onarımı da GERİ ALINDI.** Yani
fazladan koyduğum iyi niyetli bir kontrol yüzünden **P0 açık kaldı.**
⚠️ Kural: bir göç ya ONARIR ya TEŞHİS EDER. Onarım göçünün doğrulaması
yalnız *kendi* onarımını ölçsün; başka bir şüphe varsa ayrı bir teşhis
sorgusu yazılır. Teşhis sorgusu bir TABLO döndürmeli, çünkü Supabase SQL
editörü `NOTICE` satırlarını göstermiyor — yalnız sonuç tablosunu.
⚠️ Daha genel hâli: **tek işlemde çalışan bir betikte, en kritik iş en az
şeye bağlı olmalı.** Kritik onarımı ikincil bir kontrolle aynı işleme
koymak, onu o kontrolün doğruluğuna bağımlı kılar.

**130 · PANO DA BİR KANALDIR VE METNİ BOZABİLİR.** (MIYOP-079 · 27.10)
`araclar/kaydet.ps1` göç paketini panoya `Get-Content -Raw | Set-Clipboard`
ile kopyalıyordu. **Windows PowerShell 5.1'de `Get-Content`, BOM'suz bir
UTF-8 dosyayı varsayılan ANSI kod sayfasıyla (Türkçe'de CP1254) okur.**
Depodaki göçler BOM'suz UTF-8; sonuçta `İ` harfinin iki baytı (C4 B0) `Ä`
ve `°` olarak çözülüyor ve panoya **bozuk metin** gidiyordu.
⚠️ Bu kozmetik bir sorun değildi: `app.kimlik_anahtari()` gerçek `İ` ve `ı`
yerine bozulmuş iki karakteri aramaya başladı — yani numune kodu tekilliği
zayıfladı. Hata mesajları da okunamaz hâle geldi ve müşteri onları görecekti.
⚠️ **Betiğin kendi başındaki not tam bu tuzağı yazıyordu** ("PS 5.1 BOM'suz
UTF-8'i ANSI sanıp çözüyor") — ama o uyarı betiğin KENDİ kodlaması için
yazılmıştı, OKUDUĞU dosyalar için değil. Yazılı bir uyarı, uygulanmadığı
yerde uyarmaz (tuzak 74'ün akrabası).
⚠️ İki kural: **(1)** Dosya okuyan her PowerShell satırına `-Encoding UTF8`
yaz. **(2)** Canlıya giden bir metnin doğru gittiğini, **canlıda** ölç —
"depo dosyası doğru" ile "canlıdaki fonksiyon doğru" aynı şey değil. 0099
artık `app.kimlik_anahtari('İSTANBUL') = app.kimlik_anahtari('istanbul')`
diye soruyor; bozuk bir kurulum orada patlıyor.

**131 · BİR ONARIM GÖÇÜNÜ, ONARDIĞI *BOZUK* DURUMDAN BAŞLAYARAK SINA.**
(27.10) `kur.sh` göçleri sırayla TEMİZ bir veritabanına uyguluyor — doğru
ama yetmez. 0099 canlıdaki bir P0'ı onarıyordu: 0095'in ezdiği
`finance.read` kapısını. **Temiz zincirde kapı hiç ezilmiyor**, dolayısıyla
paketim yerelde sorunsuz geçti. Canlıda ise kapı dün ezilmişti ve paket o
durumdan başladı; 0095'e koyduğum bir kontrol 0099'dan ÖNCE çalışıp kırmızı
verdi ve Supabase bütün paketi geri aldı. Onarım hiç uygulanamadı.
⚠️ Yani provam, onarımın çalışması GEREKEN tek durumu hiç kurmuyordu.
"Temiz kurulumda çalışıyor" ile "bozuk kurulumu onarıyor" ayrı iddialar ve
bir onarım göçünün iddiası İKİNCİSİDİR.
⚠️ Çözüm bir betik oldu: `db/prova/paket-bozuk-durumdan.sh` — kapıyı ezer,
paketi çalıştırır, onarımın GERÇEKLEŞTİĞİNİ ölçer. `ON_ERROR_STOP` ile,
çünkü Supabase'in tek-işlem davranışını taklit etmeli; hatayı yutan bir
prova canlıdan daha hoşgörülü olur ve yanlış güven verir.

**132 · BİR KONTROL, "KONTROL EDEMEDİM" DİYEBİLMELİ.** (27.10)
`miyop-yukle.ps1`in son adımı siteyi sınıyordu:
`try { ... } catch { $k = 0 }`. Üç kontrol de her zaman **0** döndü ve
hemen altında betik **"YAYINDA"** yazdı.
İki ayrı kusur vardı:
**(1)** Çağrı `-SkipHttpErrorCheck` kullanıyordu — o **PowerShell 7+**
parametresi; Windows PowerShell 5.1'de yok. `Invoke-WebRequest` "böyle bir
parametre yok" diye hata atıyor, `catch` onu yutuyordu. Yani kontrol hiçbir
zaman çalışmadı.
**(2)** Daha kötüsü: `catch { $k = 0 }` **"kontrol edemedim" ile "site
çalışmıyor"u aynı şeye indiriyordu.** İkisi de 0 göründü, ikisi de yalnız
bir uyarı satırı üretti ve betik "YAYINDA" demeye devam etti.
⚠️ Kural: bir kontrolün üç sonucu vardır — **geçti, kaldı, ÖLÇEMEDİM.**
Üçüncüsünü ikincisiyle karıştırmak, ölçmediğin şeyi ölçtün sanmaktır.
⚠️ İkinci kural: **"yayına alındı" ile "çalışıyor" ayrı iki iddiadır.**
İkincisini ölçemediysen birincisini söyleyip susmalısın. Betik artık
geçen/toplam sayıyor ve hepsi geçmezse *"DOSYALAR YAYINA ALINDI AMA
DOĞRULANAMADI — adresi tarayıcıdan kendin aç"* yazıyor.

---

## 5 · TEST İŞBÖLÜMÜ VE TESLİM KONTROL LİSTESİ

**Claude'da:** göç provası (yerel PostgreSQL 16) · sözdizimi
(`bun build --no-bundle`) · saf mantık (`bun test`) · tip denetimi.

**Emrah'ın makinesinde:** `npm test`, `npm run build`, tarayıcı davranışı.
Son söz onun çıktısındadır.

**Teslimden önce:**
1. Sözdizimi denetimi
2. Tip denetimi
3. Göç provası — ve göçü **İKİ KEZ** çalıştır.
   ⚠️ Bunu gerçekten yap, yazdığın için yapılmış sayma (tuzak 95).
4. Arayüz değiştiyse tarayıcıda ÖLÇ
5. Yeni rapor varsa GERÇEK veriyle çalıştır
6. Dosyaları yazdıktan sonra BEKLE ve GERİ OKU
7. Kritik turdan sonra **commit hatırlat**
8. Yeni kapı/kural koyduysan **olumsuz deneme** yap: kuralı bilerek
   bozup provanın KIRMIZI olduğunu gör. Yeşil prova, çalışan prova
   demek değil (tuzak 89).
9. Kanıt dosyasını **depoya koy** (tuzak 91). Çalışma ortamında kalan
   prova, kanıt değil hatıradır.
10. Bir kapı gevşetiyorsan **ne kadarını gevşettiğini SAY** ve o sayıyı
    göçün içinde dondur (tuzak 96). "Gerekliydi" demek yetmez; gereğinden
    fazlasını açmadığını göstermek gerekir.
11. Bir dosya yazımı reddedildiyse (kilitli, salt okunur) **commit
    mesajını düzelt ya da commit'i o turda atma** (tuzak 105).
12. Bir hata sınıflandırması yaptıysan **ekranda gördüğünü doğrula**
    (tuzak 103). Katmanda doğru, ekranda yanlış olabilir.
13. Yeni bir API çağrısı eklediysen **varsayılan davranışını oku**
    (tuzak 102). Kapsam bir karardır, varsayılan değil.
14. Yeni bir dış çağrı eklediysen **mock'a da ekle** ve testin hangi dalı
    koştuğunu iddiayla sabitle (tuzak 98). `stderr`de yığın izi varken
    "testler yeşil" demek yetmez.
15. Yetki provasında **gerçek rolü tak** (`set local role authenticated`)
    ve reddin **DOĞRU SEBEPLE** olduğunu sına: 42501 ile MI403 aynı şey
    değildir. Yanlış sebeple reddedilen bir yazım, kapı çalışıyor sanılır.
16. Bir kusuru onardıysan **aynı kusurun diğer katmanda yaşayıp
    yaşamadığını ölç** (tuzak 106). Veritabanında onarılmış bir yalan,
    tarayıcı katmanında yaşamaya devam edebilir.
17. Bir test yazdıysan **kapsamını cümleyle birlikte yaz** (tuzak 107).
    Test neyi kanıtlamıyorsa onu da söyle; yoksa test, bakılmamış bir yeri
    "temiz" ilan eder.
18. Ekran borcu kapatıyorsan **ekranların ortak kaynağına bak** (tuzak
    108). İki ekran aynı fonksiyondan besleniyorsa önce o fonksiyon onarılır.
19. Bir kapının yeterli olduğunu söylüyorsan **o kapıya girmeyen yolları
    ara** (tuzak 109): public yollar, hash yolları, doğrudan render eden
    erken dönüşler. Sonra yüzeyi bir testle dondur.
20. Bir geri çağrı (callback) yazdıysan **bağlandığını ölç.** Yazılmış
    çağrı, bağlanmış çağrı değildir (MIYOP-066).
21. Bir durum özeti yazdıysan her satırın kaynağını **çalıştırılabilir**
    bir ölçüme bağla (tuzak 110). "Göç uygulandı" ile "iş kapandı" aynı
    şey değil; eski bir yorum ölçüm sayılmaz.
22. Bir kusur "kapandı" diyorsan **yüzey mi kaynak mı** kapandığını yaz
    (tuzak 111). Ekranı kapatmak üreticiyi silmez; kapsam dışına çıkarmak
    düzeltmek değildir.
23. Paylaşılan bir imzayı değiştirdiysen çağrı yüzeyini **deponun
    kendisinde** ara (tuzak 112). Yerel kopya eksik olabilir; eksikse
    aramayı yapan bir **test** yaz ya da işi Codex'e ver.
24. Bir vaat cümlesi yazdıysan **kaç ekranın onu gerçekten yaptığını say**
    (tuzak 113). "Her / tüm / hepsi" ancak ölçüm varsa yazılır.
25. Fixture'a tarih yazıyorsan **gerçek bugüne göre** yaz (tuzak 114).
    Sabit tarih bir gün sessizce geçmişe düşer.
26. Yeni bir kapı eski testleri kırdıysa önce **"bu test hangi kuralı
    yazıyordu"** diye sor (tuzak 114). Kuralı gevşetmek son çaredir.
27. Bir süzgeç koyduysan **süzgecin elediği şey yüzünden oluşan hata
    mesajlarını** da gez (tuzak 115). Doğru olmayan hata mesajı da yalandır.
28. `security definer` bir rutinde başka satırı okuyor/güncelliyorsan
    **aramaya kiracıyı kat** (tuzak 116). RLS yazdığın satırı denetler,
    o satırın GÖSTERDİĞİNİ denetlemez. "Yok" ile "başkasının" aynı mesajı
    vermeli.
29. Bir kusur gösterildiğinde **aynı desenin diğer yerlerine bak**
    (tuzak 117). Bulgu bir adres değil bir desendir.
30. Bir kolon eklediysen **onu okuyan yolu aynı göçte yaz** ya da göçün
    doğrulamasına "okunuyor mu" ölçümünü koy (tuzak 118). Yazılıp
    okunmayan kolon, olmayan kolondan kötüdür.
31. Ekranın süzgeci sunucunun kapısından **ne geniş ne dar** olmalı
    (tuzak 119). Bayrağa değil olguya bak; iki tarafı bir ÇIÇIRLA bağla.
32. Bir türetme kuralını ikinci bir sorguda tekrar yazmak yerine
    **veritabanında tek görünüme** koy (tuzak 120). Görünümde
    `security_invoker = on` şart.
33. Yeni bir zorunlu alan koyduysan üçünü ölç: **yazan ekran var mı, var
    olan kayıtlar için yazılabiliyor mu, yazması gereken rolün izni var
    mı** (tuzak 121). Yoksa kural değil kilit koymuş olursun.
34. Bir kapıyı sıkılaştırırken **eskisini düşürdüğünü ölç** (tuzak 122).
    Aynı tabloda iki kapı varsa istek en gevşeğinden geçer.
35. Yeni bir kural eski provayı kırdıysa, rolü/girdiyi değiştirmeden önce
    **"bu sınama hangi kuralı ölçüyor, beklediği hata kodu hangisi"** diye
    sor (tuzak 123). Yanlış sebeple yeşil, kırmızıdan kötüdür.
36. Güvenlik yüzeyini değiştiren bir göç yazdıysan **eski ölçüm göçlerini
    güncel veritabanında yeniden çalıştır** (0085, 0089, 0090, 0091) —
    tuzak 124. Göçteki bir ölçüm tek seferlik fotoğraftır.
37. Bir yardımcıya sınama yazıyorsan **ne döndürdüğünü dosyadan oku**, ne
    döndürdüğünü hatırladığını sanma (tuzak 125). Beklenen değeri
    kaynağından türet ve biçim varsayımını ayrı bir sağlamayla ölç.
38. Bir seçim kontrolünde öge `disabled` yapıyorsan **hiçbirinin
    seçilemediği hâli ayrıca ele al** (tuzak 126). Yoksa yazdığın bütün
    sebep açıklamaları erişilemez kalır.
39. `create or replace function` yazmadan önce **o adın BUGÜN ne olduğuna
    bak** (tuzak 127). Eski bir göçten gövde kopyalamak, aradaki
    sertleştirmeyi ezebilir. Bir izin kapısını izni OLMAYAN oturumla sına.
40. Bir listede ya da sayıda **kesilme (limit) varsa, toplamı listeden
    türetme** (MIYOP-080). Sayı sunucudan gelsin, kesildiğini ekran söylesin.
41. Dosya/ad deseni yazıyorsan **adların büyümesini hesaba kat** ve
    "kaç tane bulundu, kaç tane olmalıydı" sağlamasını ekle (tuzak 128).
42. Bir onarım göçünün doğrulaması **yalnız kendi onarımını** ölçsün
    (tuzak 129). Başka şüpheler ayrı bir TEŞHİS sorgusuna; Supabase
    `NOTICE` göstermiyor, sonuç tablosu gösteriyor.
43. Dosya okuyan her PowerShell satırına **`-Encoding UTF8`** yaz ve
    canlıya giden metnin doğru gittiğini **canlıda ölç** (tuzak 130).
44. Onarım paketini **bozuk durumdan başlatarak** da sına
    (`db/prova/paket-bozuk-durumdan.sh`) — tuzak 131. Temiz zincir,
    onarımın çalışması gereken durumu hiç kurmaz.
45. Bir kontrolün **üç** sonucu vardır: geçti, kaldı, **ölçemedim**
    (tuzak 132). `catch`te hatayı yutma; "yayına alındı" ile "çalışıyor"u
    ayrı söyle.
