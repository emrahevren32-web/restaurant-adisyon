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
10. Yetki provasında **gerçek rolü tak** (`set local role authenticated`)
    ve reddin **DOĞRU SEBEPLE** olduğunu sına: 42501 ile MI403 aynı şey
    değildir. Yanlış sebeple reddedilen bir yazım, kapı çalışıyor sanılır.
