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

**133 · BİR GÖÇÜN DOĞRULAMASI YALNIZ *KENDİ YAZDIĞINI* ÖLÇEBİLİR, ORTAMIN
GEÇMİŞİNİ DEĞİL.** (27.10 · aynı hatayı ÜÇ KEZ yaptım)
0095'in kapıyı bir daha ezmemesini garanti etmek için doğrulamasına bir
kontrol koydum. Üç turda üç kez paketi rehin aldı:
1. *"Kapı yerinde mi (`finance.read` var mı)"* → canlıda patladı: kapıyı
   **0099** onarıyor, kontrol **0095**'te, yani onarımdan önce.
2. *"Ham hesap kapının adına yazılmış mı"* → yine patladı: canlıda kapının
   adında DÜN bu göçün eski hâlinin yazdığı ham hesap duruyordu.
3. Her seferinde Supabase bütün paketi tek işlemde geri aldı ve **onarım hiç
   uygulanamadı** — yani P0 açık kaldı, üç tur boyunca.
⚠️ Asıl hata şuydu: `app.isletme_gostergeleri` fonksiyonunun içeriği artık
bu göçün yazdığı bir şey DEĞİL (göç `_ham` adına yazıyor). Onun içeriğini
ölçmek, kendi işini değil **GEÇMİŞİ** yargılamaktı; geçmiş bozuksa onarımdan
önce patlıyordu. Bir göç ancak *"ben ne yazdım"* diye sorabilir.
⚠️ **Garanti kontrolde değil KODDA olmalı:** 0095 artık
`create or replace function app.isletme_gostergeleri_ham(` yazıyor; kapıyı
ezmesi imkânsız. Dosyanın öyle kaldığını ölçmek bir MİMARİ TESTİN işi —
`src/reporting/gosterge-kapisi.arch.test.ts` göç dosyalarının METNİNİ
ölçüyor, veritabanının o anki hâlini değil. Metin ölçümü ortamın geçmişinden
bağımsızdır ve her test koşusunda çalışır.
⚠️ Genel kalıp: **"bir daha olmasın" güvencesini çalışma zamanına değil,
koda ve mimari teste koy.** Çalışma zamanındaki kontrol yalnız o anın durumunu
görür; hangi göçün neyi yazdığını göremez.

**134 · BOZUK DURUMU TAKLİT ETMEK YETMEZ — *DOĞRU* BOZUK DURUMU KUR.**
(27.10) Tuzak 131'i yazıp `paket-bozuk-durumdan.sh` betiğini kurduğum turda,
aynı tuzağa betiğin İÇİNDE yeniden düştüm. Kapıyı ezerken ham hesap olarak
`stock_balance` kullandım; **canlıdaki ezik fonksiyon 0095'in eski hâliydi,
yani içinde `stock_usable_balance` VARDI.** Benim kurduğum bozuk durumda o
yoktu, dolayısıyla 0095'in kontrolü yerelde hiç tetiklenmedi ve prova yeşil
geçti — canlıda ise patladı.
⚠️ Kural: bozuk durumu taklit ederken **bozukluğu ÜRETEN kodun ta kendisini**
kullan (burada: 0095'in eski gövdesi), yaklaşık bir benzerini değil.
⚠️ Ölçütü de yaz: taklit doğruysa, **onarımdan ÖNCEKİ paketle prova KIRMIZI
vermeli.** Bu turda tam bunu yaptım — taklit düzeltilince betik Emrah'ın
canlıda gördüğü hatayı birebir yeniden üretti. Bir olumsuz kontrolün
doğruluğu, hatayı canlandırabilmesiyle ölçülür.

**135 · TEK TEK SAYMAK, BİR SONRAKİNİ HİÇ ÖLÇMEZ.**
(27.10) MIYOP-078'den sonra yazdığım mimari test üç dosyayı okuyordu
(0071/0095/0099) ve *"0095 `fire_dokumu` kapısına yazmasın"* diye tek tek
sayıyordu. Aynı gün canlı teşhis **`app.fire_dokumu` kapısının da YOK**
olduğunu gösterdi; testim bunu yakalayamazdı, çünkü o adı ezen şey listede
olmayan bir şeydi.
⚠️ Kural: bir yasak koyuyorsan **yasağı dosya listesinden bağımsız yaz.**
Test artık `db/migrations` klasörünü okuyor ve *"0071'den SONRAKİ HİÇBİR göç
bu iki ada ham hesap yazamaz; yazdığı her gövde bir KAPI olmak zorundadır"*
diyor. Yarın yazılacak 0102'yi de ölçer.
⚠️ Ölçütü: yeni bir dosya eklediğinde testin kapsamı **kendiliğinden**
büyüyor mu? Büyümüyorsa yasak değil, bir tutanak yazmışsın.

**136 · GÜVENLİK ONARIMI, VERİYE BAĞLI BİR GÖÇLE AYNI PAKETTE GİTMEZ.**
(27.10 · tuzak 129'un bedeli ikinci kez) Supabase yapıştırılan betiğin
TAMAMINI tek işlemde çalıştırıyor. 0099 (finans kapısı onarımı) ile 0100
(eski satırlar yeni bir `check`'i ihlal ediyorsa DÜŞEN göç) aynı pakette
gitti. 0100 düşse, onarım da geri alınacaktı — yani kapı açık kalacak ve
"Success" yazmadığı için kimse nedenini aramayacaktı.
⚠️ Kural: paket sırası **ONARIM → RUN → SONUÇ GÖRÜLDÜ → sonra veriye bağlı
göç.** Veriye bağlı göç, onarımı rehin alamaz.
⚠️ `araclar/goc-bekleyen.sql` başlığına bu kural yazıldı.

**137 · `pg_get_function_identity_arguments` ARGÜMAN *ADLARINI* DA DÖNDÜRÜR.**
(27.10) 0101'in doğrulamasında fonksiyonu
`pg_get_function_identity_arguments(p.oid) = 'uuid, date, date'` ile aradım.
Hiç bulamadı: o fonksiyon `'p_sube uuid, p_bas date, p_bit date'` döndürüyor.
Yani doğrulamam *"fonksiyon yok"* diye patlıyordu, oysa fonksiyon duruyordu.
⚠️ Fonksiyonu **tipine göre** ara: `to_regprocedure('app.ad(uuid, date, date)')`.
⚠️ Bunu **bozuk durum provası yerelde yakaladı.** Canlıda patlasaydı Supabase
bütün paketi geri alır ve kapı yine açık kalırdı — yani prova bu turda
doğrudan bir P0'ın tekrarını önledi.

**138 · PROVA, PAKETİN BUGÜNKÜ İÇERİĞİNİ BEKLEMELİ.**
(27.10) `paket-bozuk-durumdan.sh`'in tek bir beklentisi vardı: *"paket bu
bozukluğu onarır."* Paketi tek göce (0101) indirdiğim an, *"göstergeler
ezilmiş"* senaryosu haklı olarak kırmızı verdi — çünkü onu **0099** onarıyor
ve 0099 canlıda ZATEN uygulanmıştı. Prova yanlış şeyi bekliyordu.
⚠️ İki beklenti ayrıldı: **ONARIR** (paket bunu giderecek) ve **DAYANIR**
(paket bunu gidermeyecek ama o durumda DÜŞMEYECEK). İkincisi tuzak 129/136'nın
tam ölçümüdür: ilgisiz bir bozukluk yüzünden düşen paket, kendi onarımını da
geri alır.
⚠️ Betiğin iki kabuk kusuru da aynı turda ölçüldü (Codex): `set -o pipefail`
yoktu (`kur.sh | tail -1` boru hattında kurulum düşse bile devam ediyordu) ve
`--single-transaction` yoktu (Supabase'in davranışını taklit etmiyordu, yani
prova canlıdan DAHA HOŞGÖRÜLÜYDÜ).
⚠️ Üçüncü kusur kendi elimden: `mktemp -d` 0700 açıyor ve sahibi root;
betikler `su postgres -c psql -f` ile okunuyor, postgres o klasörü göremiyor
ve psql "No such file" diyor. Betik bunu *"taklit yanlış"* diye YANLIŞ bir
sebeple bildirdi. Bir hata mesajı, hatayı **olduğu gibi** basmalı
(`grep ERROR` boş dönerse `tail` bas) — yoksa yanlış yere bakarsın.


**139 · YAZILI KURAL UYARMAZ, ÖLÇEN TEST UYARIR.**
(27.10) Prova 0101'i yazdım, JWT koydum, `set local role authenticated`
koymayı UNUTTUM. O satır olmadan prova tablo sahibi olarak koşar ve **RLS
atlanır**: izin kontrolü JWT'ye baktığı için MI403 yine gelir, ama olumlu
ayak (*"izni olan okuyabiliyor"*) **yanlış sebeple** yeşil olur — RLS'siz
okunan bir rapor, kapıyı değil sahipliği ölçer.
⚠️ Bu kuralı aylar önce kendim yazmıştım: **kontrol listesi 15.** Yazılı
olması beni uyarmadı. Uyaran şey MIYOP-042 için kurduğum
`yazma-kapilari-tamam.arch.test.ts` oldu — donmuş bir liste tutuyor ve
listeye GİRMEYE çalışan her yeni provayı kırmızı veriyor
(*"YENİ kör prova: prova-0101.sql"*).
⚠️ Genel kalıp: bir kuralı **belgeye** yazmak hatırlatma, **teste** yazmak
engellemedir. Üçüncü kez aynı sınıftan bir ders: tuzak 133 (garanti koda),
tuzak 135 (yasak dosya listesinden bağımsız), ve bu.


**140 · YANLIS ALARM VEREN KONTROL, HIC KONTROL ETMEMEKTEN DE KOTUDUR.**
(27.10 akşam) Dağıtım betiğinin `/assets/` kontrolü **tam 403** bekliyordu;
nginx **404** döndürdü ve betik *"DOĞRULANAMADI (2/3)"* dedi. Site
çalışıyordu, dizin listesi de kapalıydı — 404 da en az 403 kadar kapalıdır
(`autoindex off`, dizin index dosyası olmadan servis edilmiyor). Kontrol
doğru şeyi ölçtü; **beklenti yanlıştı.**
⚠️ Bedeli ölçümün kendisinden büyük: bir betik her koşuda uyarı veriyorsa,
bir sonraki sefer GERÇEK bir arıza da *"her zamanki uyarı"* diye geçilir.
Dün tuzak 132'de "ölçemedim"i "kaldı"dan ayırmıştım; bu onun ikizi — **"kaldı"
da "beklentim dardı"dan ayrılmalı.** Beklenen artık bir liste.
⚠️ Aynı turda asıl eksik de görüldü: üç kontrol *"bir site ayakta"* diyordu,
*"BU DAĞITIM yayında"* demiyordu. Betik artık `dist/index.html` içinden bu
derlemenin JS dosyasının adresini okuyup sunucudan istiyor; adında içerik
özeti olduğu için eski sürüm duruyorsa 404 döner. **Bir doğrulama, neyi
doğruladığını söyleyebilmeli.**


**141 · "TESTLER YEŞİL" İLE "KOD DERLENİYOR" AYRI İKİ İDDİADIR.**
(28.10 · canlıda çöken ekran) Şahit Numune ekranı canlıda *"Bu ekran
açılamadı"* veriyordu. Sebep tek bir satır: `NUMUNE_SAYFA` sabiti kullanılmış
ama **import edilmemişti.** Tarayıcı `ReferenceError` fırlatıyor, React ağacı
sökülüyor.
⚠️ **Bu hatayı `tsc` ilk saniyede yakalardı. Hiç koşmuyordu:**
`npm test` (vitest) tip DENETLEMEZ, `vite build` (esbuild) tip DENETLEMEZ,
ve `typecheck` betiği `package.json`'da **duruyordu ama hiçbir yerden
çağrılmıyordu.** Yani *"1584 test yeşil"* ve *"derleme başarılı"* cümlelerinin
ikisi de doğruydu ve ekran çalışmıyordu.
⚠️ Dahası: ekranı **26.10'da bitti ilan ettim** ve *"canlıda"* dedim. Canlıda
hiç açılmamıştı; ben yalnız yerelde, verisi olan kiracıda görmüştüm. Bir
ekranı "bitti" saymak için **o ekranın canlıda AÇILDIĞINI** görmek gerekir.
⚠️ Kapı kondu: `kaydet.ps1` ve `miyop-yukle.ps1` artık testlerden ÖNCE
`npm run typecheck` koşuyor, kırmızıysa commit/dağıtım yok.
⚠️ Kapının düşmesini `src/core/derleme-kapisi.arch.test.ts` engelliyor —
betiklerin metnini ölçüyor (tuzak 139'un üçüncü uygulaması).
⚠️ O testi yazarken aynı turda **kendi ölçümüm yanlış şeyi ölçtü:** sıra
kontrolü `indexOf('npm test')` ile yapılıyordu ve betiklere yazdığım
AÇIKLAMA satırları o ifadeyi geçiriyordu. Yorum kod değildir; ölçümden önce
yorum satırları ayıklanıyor.

⚠️ **KAPI AÇILIR AÇILMAZ 30 HATA ÇIKTI · 9 dosya.** İkisi aynı sınıftan
**ikinci bir canlı çökmeydi**: `WorkOrders.tsx` içinde maliyet bölümü
`paraGorur` okuyor ama o değişken ana bileşende tanımlı, alt bileşene hiç
geçirilmemiş. Boş kiracıda maliyet oluşmadığı için görünmüyordu; **veri
girildiği an İş Emirleri ekranı çökerdi.** Yani kapıyı açmak, daha patlamamış
bir mayını da buldu.
Geri kalanı: altı sahte katalogda 27.10'da arayüze eklediğim
`kalemBeyaniniGuncelle` yok (benim borcum), `warehouse.catalog.ts`te
supabase-js dönüş tipi, ve `authenticateUser.test.ts`te daraltılmış sahte
cevap tipleri.
⚠️ **Ders: bir kapıyı açmadan önce arkasında ne biriktiğini bilmiyorsun.**
30 hatanın hiçbiri yeni değildi; hepsi bugüne kadar oradaydı ve hiçbiri
görünmüyordu.

**142 · BOŞ KİRACIYI CANLIDA DENEMEDEN "BİTTİ" DEME.**
(28.10) Ürünü hep verisi olan kiracıda deniyoruz; müşteri ise **boş**
kiracıda karşılıyor. 28.10'da gerçek bir davet akışı denendi ve iki şey aynı
anda çıktı: bir ekran çöküyordu ve yeni müşterinin gördüğü ilk metinler
Türkçesizdi (`Kurulum basariyla tamamlandi`). İkisi de "dolu kiracıda bakmak"
yüzünden görülmemişti.
⚠️ Kural: bir ekran bitmiş sayılmadan önce **sıfırdan açılmış bir kiracıda,
canlıda** açılır. Boş liste testi bunun yerine geçmez: test sahte depodan
besleniyor, canlı kiracı gerçek sorgudan.

**143 · PROVA VERİTABANI 0099'DA DONMUŞTU VE HİÇBİR ŞEY KIRMIZI YANMADI.**
(29.10) `db/prova/kur.sh` göçleri `00[0-9][0-9]_*.sql` deseniyle arıyordu.
O desen 0000–0099 arasını tutar; **0100'den sonrasını sessizce atlar.** Yani
prova veritabanı 0100 ve 0101 olmadan kuruluyordu ve üzerinde koşan her prova
"yeşil" diyordu — ölçtüğü şey hiç uygulanmamış olduğu hâlde.
⚠️ Hiçbir hata çıkmıyordu. Tek belirti, en sondaki `✅ 98 göç uygulandı`
satırındaki **sayıydı** — ve o sayıyı kimse okumuyordu. Bir betiğin
"başarılı" demesi, doğru işi yaptığı anlamına gelmez.
Onarım iki parçalı: desen `[0-9][0-9][0-9][0-9]_*.sql` oldu **ve** uygulanan
sayı klasördeki dosya sayısıyla **karşılaştırılıyor** — eşit değilse betik
durur. Yani bir dahaki sefere sayıyı insan değil betik okur.

**144 · PANELDE VARSAYILAN KALAN KUTU, SESSİZCE YANLIŞ BİR ŞEY KURAR.**
(29.10) Edge Function panelden (Via Editor) dağıtıldı. Kod doğru, yapıştırma
doğru, panel *"Successfully deployed edge function"* dedi — ama sağ alttaki
**Function name** kutusu varsayılan `rapid-function` olarak kalmıştı.
Tarayıcı `giris-yap` çağırdığı için fonksiyon **hiç bulunmuyordu**; istek
404 alıyor, istemci "ulaşılamadı" sayıp eski yola düşüyordu. Giriş çalışmaya
devam ettiği için **hiçbir belirti yoktu**.
⚠️ Panelde adı değiştirmek de kurtarmıyor: *"Your slug and endpoint URL will
remain the same"*. Silip yeniden kurmak gerekti.
⚠️ Kural: bir dağıtımın "oldu" demesi yetmez; **çağıran taraftan** ölçülür.
Burada ölçü Invocations sekmesindeki `POST 200` satırıdır — o satır yoksa
dağıtım olmamıştır, panel ne derse desin.

**145 · `Get-Content -Raw` DOSYAYI ESKİ ALFABEYLE OKUYOR.**
(29.10) Kodu panoya kopyalamak için verdiğim komut `Get-Content -Raw`
kullanıyordu. Windows PowerShell 5.1 BOM'suz bir UTF-8 dosyayı sistemin eski
alfabesiyle okur: Türkçe harfler `Ã§`, `Ä±`, `âš ï¸` diye panoya gider ve
öyle yapışır. Bozulan şey yalnız yorum satırları değildi — **müşterinin
göreceği hata mesajları** da (`'Çok fazla deneme yapıldı'`) bozuluyordu.
⚠️ Doğrusu: `[IO.File]::ReadAllText($yol, [Text.Encoding]::UTF8)`.
⚠️ Ve komut kendi çıktısını **ölçmeli**: panoda `ş` var mı, bozuk `Ã` var
mı. "Kopyaladım" demek yetmez; kopyanın sağlam olduğu gösterilir.

**160 · "VERİ VAR" İLE "VERİ GERİ GELİR" AYRI İKİ İDDİADIR.** (31.10)
İlk gerçek veri yedeği alındı ve betiğin doğrulaması yeşil verdi: şema
500 KB, veri 322 KB, 66 `COPY` satırı, `audit_log` ve `stock_movement`
dökümde. Hepsi doğruydu. Ama pg_dump'ın **kendi uyarısı** şunu diyordu:
*"dairesel foreign-key kısıtlamaları bulunmaktadır: company, branch …
`--disable-triggers` kullanmadan yedeği geri yükleyemeyebilirsiniz."*
`company` ile `branch` birbirine bakıyor; `--data-only` bir dökümde hangisi
önce yazılırsa öteki kısıtı patlatır.
⚠️ Yani doğrulamam **içeriği** ölçüyordu, **geri yüklenebilirliği** değil.
Tuzak 157'nin bir üst katı: orada "dosya var ≠ veri var" idi, burada
"veri var ≠ veri geri gelir".
Çözüm pg_dump'ın kendi tavsiyesi: özel biçimde (`-Fc`) tek dosyalık tam
döküm (`tam.dump`); `pg_restore` sıralamayı kendi çözer. Betik artık o
dosyayı `pg_restore --list` ile **açıp içindeki nesneleri sayıyor**.
⚠️ `--disable-triggers` çözüm DEĞİL: superuser ister, Supabase'de yok.

**159 · BİR ARACIN GEREKSİNİMİNİ BELGEDE OKUYUP SÖYLEMEMEK.** (30.10)
`yedek-al.ps1`i yazarken Supabase belgesindeki şu cümleyi okudum:
*"Runs `pg_dump` **in a container** with additional flags..."* — ve Emrah'a
söylemedim. O da dört adım attı (`npm install` → `login` → `link` → koş) ve
*"docker: command not found"* duvarına çarptı. Bilgi elimdeydi, aktarmadım.
⚠️ Ders: bir aracı **önermeden önce** çalışma şartlarını say. Betik artık
`pg_dump` ve `docker`ı **önce ölçüyor**, hangisi varsa onu kullanıyor,
hiçbiri yoksa ikisini de açıklayıp duruyor.
⚠️ İkinci ders aynı aileden: kurulum **PATH'e eklemeyebilir**. "Kurdum ama
bulmuyor" demesin diye betik `C:\Program Files\PostgreSQL\*\bin` altına
da bakıyor ve birden fazla sürüm varsa en yenisini seçiyor.

**158 · YEREL KOMUTUN `stderr`'İ HATA DEMEK DEĞİLDİR.** (30.10)
`tam-yedek.ps1` yedeği aldı (1.537 dosya, 68,8 MB), git paketini üretti,
`git bundle verify` **"is okay"** dedi — ve betik tam o anda patladı.
Sebep: `git bundle verify` **başarı** mesajını bile `stderr`'e yazıyor, ve
`$ErrorActionPreference = 'Stop'` açıkken PowerShell yerel bir komutun
`stderr`'e yazdığı her satırı `NativeCommandError`a çeviriyor.
⚠️ Yani başarılı bir doğrulama, başarısızlık gibi göründü. Karar **çıkış
koduna** göre verilir, çıktının hangi akıştan geldiğine göre değil.
`GitCalistir` yardımcısı bunu tek yerde çözüyor: `stderr`'i metne çeviriyor,
kararı `$LASTEXITCODE` veriyor.
⚠️ Aynı aileden bir başkası da aynı betikte vardı ve yakalandı:
**robocopy'nin çıkış kodu 0-7 arası BAŞARIDIR** (bit maskesi). `-ne 0`
yazmak "dosya kopyalandı"yı hata sayardı.

**157 · YEDEĞİN VARLIĞI, İÇİNDE VERİ OLDUĞU ANLAMINA GELMEZ.** (30.10)
Supabase'in `db dump` komutu **varsayılan hâliyle veriyi almaz** — belgenin
kendi cümlesi: *"The default dump does not contain any data or custom roles."*
Yani "yedek al" diye tek komut yazsaydık, elimizde tablo tanımları olur,
içlerinde **tek satır veri olmazdı**. Ve dosya oluştuğu için her şey yolunda
görünürdü.
⚠️ Bu, 13.09.2026'da menüden kaldırılan eski "Yedekleme" düğmesinin yaptığı
şeyin ta kendisi: o da tarayıcı hafızasını yedekliyordu, iş verisini değil.
Aynı hata iki yıl arayla iki farklı yerden geliyor, çünkü ortak kök şu:
**yedeğin başarısı dosyanın varlığıyla değil, İÇİNDEKİYLE ölçülür.**
`araclar/yedek-al.ps1` bu yüzden kendi çıktısını denetliyor: veri dosyasında
en az bir `COPY`/`INSERT INTO` satırı yoksa "alındı" DEMİYOR.

**156 · "BİRKAÇ YÜZ MB" DEDİM, ÖLÇMEDEN.** (30.10) Emrah'a sunucudaki yedek
sayısını üçten yediye çıkarmayı önerirken maliyetini *"birkaç yüz MB"* diye
yazdım. İki hata birden: (a) MB bir para birimi değil, "maliyet" demek
yanlıştı; (b) **sayıyı ölçmedim.** Gerçek, aynı akşamın derleme çıktısında
yazıyordu: **31 dosya, 8.51 MB.** Yani tahminim ~30 kat yüksekti.
⚠️ Emrah yakaladı: *"disk maliyeti nasıl birkaç yüz MB olabilir? MB ile
maliyet ne alaka?"* Bu dönemin **altıncı** ölçmeden konuşma hatası
(147, 150, 151, Hetzner IP iddiası, 153, bu). Desen hep aynı: **küçük,
önemsiz görünen bir sayıyı ölçmeye değmez sanmak.** Ölçmeye değmeyen sayı
yoksa, söylemeye değmeyen sayı da yoktur — bilmiyorsam "ölçmedim" denir.

**155 · KAPSAM ÖLÇEN TEST, ANLAMI ÖLÇMEZ.** (30.10) `audit-coverage.arch.test.ts`
bir aydır yeşildi ve şunu ölçüyordu: hangi tablolar denetleniyor, her birinin
Türkçe etiketi var mı, yedekle tutarlı mı. Hepsi doğruydu. Ama defterin
dört tablodaki satırları **okunamıyordu**: `row_id` alanına `'?'` düşüyordu
(tuzak 149'un aynısı, bu kez dört tabloda birden). Kapsam testi *"bu tablo
denetleniyor mu"* diye sorar; kimse *"yazdığı şey bir şey anlatıyor mu"*
diye sormuyordu.
⚠️ Ders: bir kaydın VARLIĞINI ölçen testin yanına, o kaydın **İŞE YARAR
OLDUĞUNU** ölçen bir test gerekir. Yeni dosya:
`src/audit/denetim-satir-kimligi.arch.test.ts`.

**154 · SÖZ DİZİMİ ARAYAN TARAYICI, SÖZ DİZİMİ DEĞİŞİNCE SESSİZCE ZAYIFLAR.**
(30.10) `denetimIzlenenTablolar()` göçlerde yalnız **bir** kalıbı arıyordu:
`izlenecek text[] := array[...]`. Oysa denetim tetikleyicisi göçlerde üç
biçimde kuruluyor (başka adlı dizi değişkeniyle döngü — 0091'de
`v_tablolar`; ve düpedüz `create trigger` — 0042, 0093, 0103).
**Ölçüm:** canlıda `app.denetim_yaz`a bağlı **29** tetikleyici var, tarayıcı
**19** görüyordu. Görmediği on tablo arasında `app_user`, `company`,
`branch`, `user_role` da vardı — yani personel ve firma değişiklikleri
Değişiklik Kaydı ekranında **ham İngilizce adıyla** görünüyordu ve hiçbir
test bunu söylemedi, çünkü testin gözünde o tablolar denetlenmiyordu.
⚠️ Ders: bir tarayıcı **kalıp** değil **sonuç** aramalı; aradığı şeyin
kaç tanesini bulduğu da sınanmalı. Üç biçimin üçü için birer tanık sınama
eklendi, böylece aynı körlük sessizce geri gelemez.

**153 · TÜRKÇE METNİ KÜÇÜK HARFE ÇEVİRMEK DİZGİNİN UZUNLUĞUNU DEĞİŞTİRİR.**
(30.10) 0104'ün doğrulamalarını ölçerken `metin.lower().find(...)` ile
konum arayıp o konumdan dilim aldım ve "fonksiyon `now()` yazmıyor" sonucuna
vardım. Yazıyordu. Sebep: `'İ'.lower()` **iki** kod birimi üretir (i + birleşen
nokta), yani küçültülen metnin konumları orijinalinden **kayar**.
Yanlış konumdan alınan dilim, doğru olan bir şeyi bozuk gösterdi.
⚠️ Ders: bu dönemin beşinci **ölçüm aracı hatası** (147, 150, 151, Hetzner
IP iddiası, bu). Arama büyük/küçük harf duyarsız **kalıpla** yapılır
(`re.I`, `/.../i`), metni dönüştürüp konum alınmaz. Testin içindeki okuyucu
kendi doğruluğunu da sınıyor artık ("Sağlama" bölümü): okuduğu ifadenin
**yorum satırı olmadığını** ölçüyor — çünkü 0104 eski ifadeyi yorumda
saklıyor ve yorumları atmayan okuyucu düzeltilmiş kodu bozuk gösteriyordu.

**152 · KIRMIZI VEREN HAT, KODU DEĞİL KENDİNİ GÖSTERİYORDU.**
(29–30.10) Testler üç kez üst üste kırmızı verdi: 23, sonra 28, sonra yine 28
paket "düştü". Bir gün kaybettik ve **kodda hiçbir şey yoktu.**

⚠️ **AYIRT EDEN İKİ ÖLÇÜM ŞUYDU:**
  1. **Tek bir iddia hatası yoktu.** Hiçbir yerde *"beklenen X, gelen Y"*
     yazmıyordu; hepsi `[vitest-worker]: Timeout calling "fetch"` idi — yani
     vitest'in KENDİ dosya okuması zaman aşımına uğruyordu. Düşen paketler
     **(0)** test topluyordu: hiç başlamamışlardı.
  2. **Düşen dosyalar her koşuda DEĞİŞİYORDU.** Bir koşuda geçen dosya
     ötekinde düşüyordu. ⚠️ **Gerçek bir hata hep aynı yerden çıkar.**
     Gezinen bir kırmızı, koddan değil hattan gelir.

Ölçüm (aynı kod, aynı makine, arka arkaya):
  · paralel havuz → **429 sn**, 28 paket hiç başlamadan düştü, 0 iddia hatası
  · tek işçi      → **8 sn**, 95 paketin 95'i, 1643 testin 1643'ü yeşil
**53 kat.** Her işçi kendi Vite dönüştürme hattını ve kendi jsdom ortamını
kuruyor; 95 dosya × N işçi bu makinede diski kilitliyor.

⚠️ **Bu kapıyı gevşetmek değildir:** hangi testin koştuğu, neyi ölçtüğü ve
kaç tane olduğu birebir aynı; değişen tek şey sıraya dizilişleri.
⚠️ **Ve asıl ders bu:** bir kapının HIZI, güvenilirliğinin parçasıdır.
429 saniye süren ve rastgele kırmızı veren bir kapı er geç atlanır
("yine takıldı herhalde"). 8 saniyelik kapı her seferinde koşturulur.
Bedeli yazılı: tek süreçte bütün dosyalar global durumu paylaşır. Bir gün
bir test TEK BAŞINA geçip BÜTÜN takımda düşerse ilk şüpheli odur.

**151 · AYNA DEPO DEĞİLDİR — ÜÇÜNCÜ KEZ.**
(29.10) `src/billing.ts`i *"hiçbir yerden içe aktarılmıyor"* diye sildim.
Tip denetimi **38 dosyada 45 hata** verdi: dosya adisyon, masa, kasa, QR
menü, cari, personel ve eski raporlardan çağrılıyormuş.
⚠️ Taramayı kendi çalışma alanımdaki kopyada yaptım. Orada deponun yalnız
**benim o oturumda aldığım dosyaları** var. `grep -r src/` bir depoya
benziyor ve "eşleşme yok" diye **kendinden emin** cevap veriyor. Yokluğu
kanıt sandım; oysa dosyanın orada olmaması, kodda olmaması demek değil.
⚠️ **Aynı kök, üçüncü kez:** 147 (yanlış kopyadan ölçtüm), 150 (ölçümü
`head` ile kestim), 151 (ayna eksik). Üçünde de ölçüm YAPILDI ve üçünde de
"ölçtüm" demek güven verdi. Uyarı yazmak işe yaramıyor — bunu üç kez yazdım.
⚠️ **MEKANİZMA (kural değil, sıra):** bir dosyayı ya da bir `export`u
kaldırmak İKİ ADIMDIR.
  1. Kaldır, **tip denetimini koştur**, çıkan listeyi oku.
  2. Kararı O LİSTEDEN ver.
"Kimse kullanmıyor" cümlesi 1. adımdan ÖNCE kurulmaz. `tsc`, bu kod
tabanının elimdeki tek EKSİKSİZ dizinidir; tarama değil o ölçer.

**150 · ÖLÇÜMÜ `head` İLE KESİP "HEPSİ BU" DEMEK.**
(29.10) `SystemSettings` tipinden `vatRate` ve `currency`yi kaldırmadan önce
"kim okuyor" diye taradım ve *"ikisini de başka okuyan yok"* dedim. Tarama
`| head -20` ile bitiyordu ve eşleşmeler yirmiden fazlaydı. `billing.ts` ile
`onboarding.service.ts` o kesilen kuyrukta kaldı; tip denetimi ikisini de
gösterdi.
⚠️ Tuzak 147'nin kardeşi: orada **yanlış kopyadan** ölçmüştüm, burada
**eksik ölçtüm**. İkisinde de ölçüm YAPILDI ve ikisinde de sonuç "ölçtüm"
diye güven verdi.
⚠️ İkinci yarısı aynı gün çıktı: bu sefer `grep | wc -l` ile SAYIYA baktım,
*"3 dosya billing'i içe aktarıyor"* sandım ve doğru olan bir kararı neredeyse
geri alıyordum. Üçü de `'billing'` kelimesinin metin içinde geçtiği
satırlardı. **Bir sayı ölçüm değildir; satırlar ölçümdür.**
⚠️ Kural: bir şeyi silmeden önceki "kim kullanıyor" taraması KESİLMEZ
(`head` yok) ve SATIRLARIYLA okunur. Kuyruğu görmüyorsan ölçmedin.

**149 · `id` KOLONU OLMAYAN TABLO, DENETİME '?' YAZIYOR.**
(29.10) `tenant_settings` tablosunun ilk hâlinde birincil anahtar doğrudan
`tenant_id` idi: *"kiracı başına tek satır, ayrı bir kimliğe ne gerek var"*.
Mantıklı görünüyordu. Ama `app.denetim_yaz()` satır kimliğini
`coalesce(new ->> 'id', old ->> 'id', '?')` ile okuyor — `id` kolonu olmayan
tabloda denetim kaydı YAZILIYOR ama `row_id` alanına **'?'** düşüyor.
⚠️ Yani *"bunu kim değiştirdi"* cevaplanıyor, *"NEYİ değiştirdi"*
cevaplanmıyordu. Hiçbir hata çıkmıyordu; denetim defterinde '?' satırları
birikecekti ve bunu aylar sonra, bir tartışmanın ortasında fark ederdik.
⚠️ **Provanın yakaladığı bir kusurdu, derlemenin değil.** Yapısal ölçümler
(tablo var mı, RLS açık mı) yeşildi; kırmızı veren şey denetim kaydını
GERÇEKTEN arayan ölçümdü.
⚠️ Kural: denetime düşen her tablonun `id` kolonu olur. Kiracı başına tek
satır zorunluluğu `tenant_id`de **unique** ile kurulur; birincil anahtarı
oraya taşıyarak değil.

**148 · MÜŞTERİYE BİZİM DİLİMİZLE KONUŞAN EKRAN.**
(29.10) Karşılama ekranı — müşterinin şifresini belirledikten sonra gördüğü
**ilk ekran** — şunları yazıyordu: *"Workspace henuz bos"*, *"Ilk Widget
Ekle"*, *"Dashboarda Git"*, *"Premium onboarding deneyimi aktif"*, ve
*"Product tour, quick tips, getting started kartlari ve empty state sistemi
birlikte calisir."*
⚠️ Sonuncusu müşteriye değil, BİZE söylenmiş bir cümleydi. Kimse müşteriden
"widget" ya da "empty state" bilmesini bekleyemez; dahası bu kelimeler
ürünün kendisine değil, onu yapan ekibin iç konuşmasına ait.
⚠️ Kural: bir ekranın metni, o ekranı GÖRECEK kişinin kelimeleriyle yazılır.
Geliştirici kelimeleri (workspace, widget, dashboard, empty state, onboarding)
müşteri ekranında geçmez. Ve bir özelliğin kendi kendini övdüğü kart —
*"premium deneyim aktif"* — müşteriye bir şey söylemez, yalnız yer kaplar.

**147 · BİR DOSYAYI SİLERKEN İÇİNDEKİ SAF KARARI DA SİLDİM.**
(29.10) `giris-adresi.ts` kaldırılırken içindeki `kesinEpostaMi` de gitti —
oysa o, hiçbir şey sormayan saf bir kuraldı ve `Login.tsx` onu şifre
sıfırlamada kullanıyordu. Derleme kırıldı.
⚠️ **ASIL KUSUR, SİLMEK DEĞİL, ÖLÇÜMÜN YANLIŞ KOPYADAN YAPILMASIYDI.**
Silmeden önce "kim kullanıyor" diye taradım ve "kimse" cevabını aldım; ama
taradığım şey, Emrah'ın makinesindeki depoya ait **eski bir kopyaydı** —
o kopyada `Login.tsx` bu alıntıyı henüz içermiyordu. Yani ölçüm yapıldı ve
**yanlış kaynaktan** yapıldı; sonuç "ölçtüm" diye güven verdi.
⚠️ Kural: bir dosyayı silmeden önce "kim kullanıyor" taraması **o anki
gerçek depoda** yapılır. Ve asıl güvence derleme kapısıdır: tip denetimi
bunu ilk saniyede yakaladı (tuzak 141'in kapısı işe yaradı).
⚠️ İkinci ders: kaldırılan bir dosyanın **saf** parçaları taşınır, silinmez
— ve kopyalanmaz: `kesinEpostaMi` yeni bir dosyaya (`giris-adi-bicimi.ts`)
kendi testiyle taşındı, `Login.tsx`e kopyalanmadı.

**146 · BORCU "YAZILI DURUYOR" DİYE DONDURAN TEST, BORÇ KAPANINCA TERSİNE
ÇEVRİLİR — SİLİNMEZ.** (29.10) `giris-sunucuda.arch.test.ts` içinde bilerek
*"GEÇİŞ DÖNEMİ: yedek yol hâlâ duruyor ve bu YAZILI"* diyen bir blok vardı.
Borç kapanınca o bloğu silmek kolaydı; ama o zaman geriye **hiçbir şey**
kalmazdı ve yedek yol bir gün sessizce geri gelebilirdi.
Blok **tersine çevrildi**: artık o yolun geri GELMEDİĞİNİ ölçüyor — hem
`storage.ts`te, hem **bütün tarayıcı kaynağında** (tek dosyaya bakmak
yetmez: başka bir ekran aynı RPC'yi çağırarak sızıntıyı geri açabilirdi).


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
46. Bir göçün doğrulaması **yalnız kendi yazdığını** ölçsün (tuzak 133).
    "Bir daha olmasın" güvencesi çalışma zamanına değil **koda ve mimari
    teste** konur.
47. Bozuk durumu taklit ederken **bozukluğu üreten kodun kendisini** kullan
    ve taklidin doğruluğunu **hatayı canlandırarak** ölç (tuzak 134).
48. Bir yasak koyuyorsan **dosya listesinden bağımsız** yaz: klasörü tara,
    kuralı her yeni dosyaya kendiliğinden uygulat (tuzak 135).
49. **Güvenlik onarımı, veriye bağlı bir göçle aynı pakette gitmez**
    (tuzak 136). Önce onarım, Run, sonuç görülür; sonra gerisi.
50. Bir fonksiyonu `pg_catalog`'da ararken **tipine göre** ara
    (`to_regprocedure`), `identity_arguments` metnine göre değil (tuzak 137).
51. Provanın beklentisi **paketin bugünkü içeriğine** göre ayarlanır: hangi
    bozukluğu ONARIR, hangisinden sadece DAYANIR (tuzak 138). Kabuk
    betiklerinde `set -o pipefail` ve `--single-transaction` şart.
52. Bir kontrolün beklentisini **dar tutma**: kabul edilebilir her sonucu
    say (tuzak 140). Her koşuda uyarı veren betiğin uyarısı okunmaz olur.
53. Bir dağıtım doğrulaması **"bu dağıtım yayında"** diyebilmeli: içerik
    özetli dosya adını derlemeden okuyup sunucudan iste (tuzak 140).
54. **Tip denetimi hattın içinde olmalı** (tuzak 141). "Testler yeşil" ile
    "kod derleniyor" ayrı iki iddiadır; vitest ve esbuild tip denetlemez.
55. Bir ekranı "bitti" saymadan önce **sıfırdan açılmış bir kiracıda,
    canlıda** aç (tuzak 142). Boş liste testi bunun yerine geçmez.
56. Bir dosya listesini **desenle** tarayan betik, desenin kapsadığı aralığı
    da **ölçsün**: kaç dosya bulundu, kaçı işlendi (tuzak 143). "Başarılı"
    demek, doğru işi yaptı demek değildir.
57. Bir dağıtımı **çağıran taraftan** doğrula (tuzak 144). Panelin
    "Successfully deployed" demesi değil, isteğin gerçekten o fonksiyona
    ulaştığını gösteren kayıt (Invocations · `POST 200`) kanıttır.
58. Windows'ta dosya okurken **alfabeyi açıkça yaz**
    (`[IO.File]::ReadAllText(..., UTF8)`), ve kopyanın sağlamlığını
    **ölç** (tuzak 145).
59. Bir borcu donduran test, borç kapanınca **tersine çevrilir, silinmez**
    (tuzak 146). Silinirse geri dönüşü hiçbir şey engellemez.
60. Bir yasağı **tek dosyada** değil, **bütün kaynakta** ölç (tuzak 146):
    silinen bir yol başka bir ekrandan geri gelebilir.
61. Bir dosyayı silmeden önce "kim kullanıyor" taramasını **o anki gerçek
    depoda** yap (tuzak 147). Eski bir kopyadan yapılan ölçüm, ölçüm
    olmadığı hâlde güven verir.
62. Kaldırılan bir dosyanın **saf** parçaları **taşınır** — silinmez, ve
    çağıran dosyaya kopyalanmaz (tuzak 147).
63. Müşteri ekranının metnini **müşterinin kelimeleriyle** yaz (tuzak 148).
    "workspace", "widget", "dashboard", "empty state", "onboarding" bizim
    kelimelerimiz. Bir özelliğin kendini övdüğü kart da müşteriye bir şey
    söylemez.
64. Bir **rozet** ya gerçek bir sorgudan ölçülür ya da hiç konmaz
    (MIYOP-065). "Tamamlandı" yazan bir rozet, tamamlandığını KANITLAYAN
    bir şeyden beslenmiyorsa *mış gibi*dir.
81. Bir yedeğin ölçüsü **içeriği değil, GERİ YÜKLENEBİLİRLİĞİDİR**
    (tuzak 160). Dairesel yabancı anahtar varsa `--data-only` dökümü geri
    yüklenmeyebilir; geri yükleme dosyası ayrı tutulur ve açılıp okunur.
82. Bir aracın **kendi uyarılarını** oku. pg_dump sorunu da çözümü de
    yazmıştı; yeşil doğrulamaya bakıp geçmek, uyarıyı yok saymaktı.
79. Yerel bir komutun başarısına **çıkış koduyla** karar ver, çıktısının
    hangi akıştan geldiğine göre değil (tuzak 158). `git` ve `robocopy`
    başarıyı da `stderr`'e yazar; robocopy'de 0-7 arası başarıdır.
80. Bir aracı önermeden önce **çalışma şartlarını say** (tuzak 159):
    kapsayıcı mı istiyor, hangi sürüm, PATH'e ekleniyor mu.
77. Bir yedeğin başarısı **dosyanın varlığıyla değil, İÇİNDEKİYLE** ölçülür
    (tuzak 157). Yedek alan betik kendi çıktısını denetler; denetlemiyorsa
    "yedeğim var" sanmanın aracıdır.
78. Küçük görünen bir sayıyı da **ölçmeden söyleme** (tuzak 156). "Birkaç
    yüz MB", "birkaç saniye", "iki üç dosya" — hepsi iddiadır. Bilmiyorsan
    "ölçmedim" de.
73. Bir kaydın **varlığını** ölçen testin yanına, o kaydın **anlamlı**
    olduğunu ölçen bir test koy (tuzak 155). "Denetleniyor mu" ile "ne
    yazdığı okunuyor mu" ayrı iki sorudur.
74. Göç tarayıcısı **kalıp** değil **sonuç** arar ve **kaç tane bulduğunu**
    da sınar (tuzak 154). Tek söz dizimine bağlı tarayıcı, ikinci bir
    biçim ortaya çıktığı gün sessizce yarısını ölçmeye başlar.
75. Türkçe metinde arama **büyük/küçük harf duyarsız kalıpla** yapılır;
    metni `lower()` ile dönüştürüp **konum alınmaz** (tuzak 153).
76. Bir göç dosyasını okuyan test, önce **`--` yorumlarını atar**
    (tuzak 153). Göçler eski kararı yorumda saklar; yorumu okuyan ölçüm,
    düzeltilmiş kodu bozuk gösterir.
71. Bir kırmızıyı koda yormadan önce **iki şeyi ölç** (tuzak 152):
    (a) tek bir **iddia hatası** var mı — yoksa hata koddan gelmiyor olabilir;
    (b) düşen dosyalar koşudan koşuya **değişiyor mu** — değişiyorsa hattan
    gelir, çünkü gerçek bir hata hep aynı yerden çıkar.
72. Bir kapının **hızı, güvenilirliğinin parçasıdır** (tuzak 152). Dakikalarca
    süren ve ara sıra sahte kırmızı veren bir kapı atlanmaya başlar.
69. Bir dosyayı ya da `export`u kaldırmak **iki adımdır** (tuzak 151):
    önce kaldır + **tip denetimini koştur**, sonra kararı çıkan listeden
    ver. "Kimse kullanmıyor" cümlesi tip denetiminden ÖNCE kurulmaz.
70. Çalışma alanındaki depo kopyası **eksiktir** (tuzak 147, 151): yalnız
    bu oturumda alınan dosyaları taşır. Orada "eşleşme yok" bulmak,
    **kodda yok** demek DEĞİLDİR.
68. Bir şeyi silmeden önceki "kim kullanıyor" taraması **kesilmez**
    (`head` yok) ve **satırlarıyla** okunur (tuzak 150). `wc -l` sayısı
    ölçüm değildir: kelime başka bağlamda da geçebilir.
66. **Denetime düşen her tablonun `id` kolonu olur** (tuzak 149).
    `app.denetim_yaz()` satır kimliğini `new ->> 'id'` ile okur; yoksa
    `row_id` alanına '?' yazar ve "neyi değiştirdi" cevapsız kalır.
    Kiracı başına tek satır kuralı `unique (tenant_id)` ile kurulur.
67. Bir ayarın **varsayılanı varsa, o varsayılan bir CEVAPTIR.** Kimsenin
    vermediği bir cevabı varsayılan diye koymak (`vatRate: 10`) *mış gibi*
    yapmaktır; "belirlenmemiş" (`null`) geçerli ve gösterilebilir bir
    değerdir (MIYOP-060b).
65. Bir sayım düşerse `null` döndür, **`0` değil**. "Sayamadım" ile "hiç
    yok" aynı şey değil; ikincisini göstermek kullanıcıya yanlış iş
    yaptırır (kontrol listesi 45'in ekran tarafı).
