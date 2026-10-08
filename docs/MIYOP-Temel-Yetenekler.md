# MİYOP · TEMEL YETENEKLER — NEREDEYİZ (08.10.2026)

Beş sorunun cevabı. Hepsini **kodda kontrol ettim**, ezberden yazmadım.

**Önce bir düzeltme:** sana geçen tur *"HACCP ekranı hâlâ örnek veride"*
demiştim. **Yanlıştı.** Eski `src/haccp/haccp.mock.ts` katmanına bakmışım;
oysa `src/quality/` altında **gerçek Postgres katmanı var ve çalışıyor.**
Ayrıntı aşağıda.

---

# 1 · İZLENEBİLİRLİK — **GÜÇLÜ** ✅

> *"Hammadde olarak giren ürünü müşteri yedi içti sıçtı'ya kadar takip
> edebiliyor muyuz?"*

**Evet, iki yönde de.** Ve bu ürünün en sağlam yeri.

**Geriye (bu mamulde ne var):**
```
Sevkiyat → hangi partiler çıktı → o partiyi hangi iş emri üretti
        → o iş emri hangi partileri tüketti → o partiler hangi mal kabulden
        → hangi tedarikçiden, hangi tedarikçi partisinden
```

**İleriye (geri çağırma):**
```
Bozuk hammadde partisi → hangi iş emirlerine girdi → hangi mamul partileri
                       → hangi sevkiyatlarla gitti → HANGİ MÜŞTERİYE,
                         adı ve TELEFONUYLA
```

Çıktı yazdırılabilir bir **aranacak müşteriler listesi**.

**Neden sağlam:** ayrı bir "soyağacı tablosu" tutmuyoruz. Şemada
`lot_genealogy` diye bir tablo var ve **bilerek boş**. Zincir **defterden
türetiliyor**. Ayrı tablo tutsaydık defterle senkron kalması gereken ikinci
bir gerçek doğardı; bir hareket unutulduğu gün geri çağırma listesi eksik
çıkar ve **kimse fark etmezdi**, çünkü tablo dolu görünürdü. Türetilen
zincir yanlış olamaz: defter neyse zincir odur.

Döngü koruması ve derinlik sınırı var (hamur → ekmek → galeta unu → köfte
gibi uzun zincirler ve veri hatasıyla kendine dönen zincirler için).

**Belgesi okunamayan sevkiyat listeden DÜŞMÜYOR** — "belge bulunamadı"
yazıyor. Sessizce atsaydık geri çağırma eksik kalırdı.

### ⚠️ Zincirin TEK ZAYIF HALKASI

**Etiketteki parti numarası elle yazılıyor.** Zincirin tamamı defterde
sağlam, ama müşterinin eline geçen kâğıtta yazan lot hâlâ klavyeden
giriliyor. Yani senin sorduğun *"müşteri yedi"* kısmının son bir metresi
insan eline bağlı.

Bu yüzden A4B-6 kutusunu işaretleme dedim. **Demoda en çok övüneceğin
özelliğin tam da o noktada kopuyor.** Öncelik listesinde yukarı almalıyız.

---

# 2 · DEPO VE STOK — **GÜÇLÜ** ✅

> *"Depoda FIFO - FEFO vs?"*

**FEFO otomatik ve mecburi.** Her çıkışta (üretim tüketimi, sevkiyat)
sistem lotu **kendisi seçiyor** — kullanıcı seçmiyor, seçtirmiyoruz. Son
kullanma tarihi en yakın olan önce çıkıyor.

**SKT'si geçmiş lot FEFO'ya GİRMİYOR.** Bu bir zamanlar bir hataydı ve
düzeltilmiş: sıralama doğru çalıştıkça tarihi geçmiş lotu **önce**
seçiyordu. Bir gıda işletmesinde bunun bedeli para değil, insan sağlığı.
Şimdi süzülüyor — ve stok yetmezse **sebebini söylüyor**: *"SKT'si geçmiş
şu kadar mal var, o yüzden yetmiyor"*. Sadece "yetersiz stok" deseydi
kullanıcı depoya bakar, malı görür, sistemin bozuk olduğunu sanırdı.

**Bir çıkış iki partiye bölünebiliyor** ve ikisi de ayrı hareket olarak
defterde duruyor — geri çağırmada ikisi de bulunuyor.

**Maliyet üç yöntemle:** FIFO · hareketli ortalama · son alış. Geçmişe
dönük değişmiyor.

**Defter EKLEMELİ.** `UPDATE` ve `DELETE` veritabanı seviyesinde yasak.
Düzeltme = ters kayıt. Uygulamaya güvenilmiyor, kural veritabanında.

**Negatif bakiye politikası** işletme bazında: engelle / uyar.

### Eksikler

| Ne | Durum |
|---|---|
| Şube / depo kapsamı | **YOK** — kullanıcı bütün şubeleri görüyor (A4B-8) |
| Raf ve depo yeri adresi | **YOK** — demo sonrası |
| Palet biriminde sevkiyat | **YARIM** — sipariş girebiliyor, sevkiyat giremiyor (A4B-9) |

---

# 3 · ANALİZLER — **KISMEN** ⚠️

> *"En çok satılan, en az satılan, en hızlı bozulan, SKT yaklaşan, en karlı
> ve en az karlı ürünler?"*

**Dün itibarıyla VAR olanlar** (Analiz ekranı, 0065):

- ✅ **SKT'si yaklaşan** — 30 gün içinde dolacak partiler, değeriyle
- ✅ **SKT'si geçmiş ve hâlâ depoda** — en kritik gösterge
- ✅ **En çok fire veren ürünler** — tutara göre sıralı, sebebiyle
- ✅ **Firenin yüzde kaçı kaç kalemden geliyor** — nereye bakılacağını söyler
- ✅ Kritik seviyenin altındaki kalemler
- ✅ Eksi bakiyeli kalemler (defter tutarsızlığı)
- ✅ Geciken sipariş · onay bekleyen · teslimde fark çıkan

**HENÜZ YOK ama VERİSİ VAR — yapılabilir:**

| İstediğin | Neden yapılabilir |
|---|---|
| **En çok / en az satılan** | Sipariş satırları ve sevkiyat çıkışları defterde |
| **En karlı / en az karlı** | Sözleşme fiyatı `customer_price`'ta, maliyet `stock-cost`'ta. **İkisi henüz birleştirilmedi** — tek bir SQL fonksiyonu |
| **En hızlı bozulan** | Kalem başına fire ÷ tüketim. İki sayı da elde |
| **Stok devir hızı** | Dönem tüketimi ÷ ortalama stok |
| **Tedarikçi performansı** | Mal kabul tarihleri ile sipariş tarihleri |

Yani bunların hiçbiri yeni veri toplamayı gerektirmiyor. **Defter zaten
dolu, sadece doğru soruyu sormuyoruz.** Sıradaki iş bu.

---

# 4 · AKILLI TAVSİYELER — **TEMELİ VAR, AI DEĞİL** ⚠️

Analiz ekranında **"Ne yapmalı"** bölümü var ve rakamlardan **önce**
duruyor. Her bulgunun üç parçası var: ne olduğu (rakamla), önem derecesi,
ve **ne yapılacağı**. Yapılacak bir şey söylemeyen bulgu üretilmiyor.

Örnek:
> **ACİL · Son kullanma tarihi geçmiş mal depoda**
> 2 partide 1.840,00 ₺ değerinde mal tarihini geçmiş ve hâlâ stokta.
> *Bu partileri imha kaydıyla düşün. Düşülmezse bakiye yanlış kalır ve
> FEFO bu partileri üretime vermeye devam eder.*

Karşılaştırma **işletmenin kendi geçmişiyle**: *"Önceki döneme göre arttı
(%2 → %10)"*. Sektör ortalaması kullanmıyoruz çünkü elimizde öyle bir veri
yok ve uydurmuyoruz.

### Bu AI değil — ve sana AI diye satmam

Bu bir **kural motoru**: deterministik, açıklanabilir, her sayı defterden
izlenebilir. Sattığın şey bu olmalı, çünkü müşteri rakamı sorduğunda
cevabın var.

**Ama AI'nın oturacağı zemin tam olarak bu.** Bir model bu fonksiyonların
çıktısını okuyup *"geçen ay firenin %70'i tek üründen geldi ve hep aynı
tedarikçinin partilerinde; o tedarikçinin teslimat sıcaklığına bakın"*
diye yorum yazabilir.

⚠️ **Sıralama şöyle olmalı, tersi değil:** doğru sayı olmadan konuşan bir
model **kendinden emin saçmalar** — ve müşteri o saçmalığı bir yıl sonra
sana sorar. Sayılar artık doğru; AI katmanı bundan sonra güvenli.

---

# 5 · HACCP — **ORTA** ⚠️ (düzeltme)

**Geçen tur yanlış söyledim.** Gerçek durum:

### Var olan — ve iyi kurulmuş

`src/quality/haccp.repository.ts` **gerçek Postgres katmanı.**

- **Kritik limit METİN DEĞİL, ÜÇ KOLON:** tip (MAX/MIN/ARALIK) + alt + üst.
  Eski tasarımda limit `"≤ 4°C"` diye bir yazıydı; o zaman "bu ölçüm limiti
  aştı mı" sorusunun cevabını yine insan verirdi. Yani kayıt tutulur ama
  **kontrol edilmezdi.** HACCP'in bütün anlamı otomatik kontrolde.
- **GEÇTİ/KALDI yazma anında hesaplanıp DONDURULUYOR.** Limit yarın
  değişirse dünkü kayıt dünkü limite göre kalır — denetimde doğru olan bu.
- **Ölçüm bir partiye ve bir belgeye bağlanıyor** (`source_type`): mal
  kabul, iş emri, soğuk oda, **sevkiyat**, elle. Yani *"limiti aşmış bir
  ölçüm hangi partide, o parti kime gitti"* sorusu cevaplanabiliyor.
- **Düzeltici faaliyet tablosu** var.
- Kayıt **ekleme-yapılır**: yasal kayıt, üstüne yazılmaz.

### Eksik olan — ve bu ciddi

**1 · Ölçüm girecek EKRAN YOK.** Altyapı kurulmuş, kapı açılmamış. Yalnız
Kontrol Paneli özetini okuyor. Yani bugün bir sıcaklık ölçümü sisteme
**giremiyorsun**.

**2 · Sapma hiçbir şeyi ENGELLEMİYOR** (Codex #8). Limit aşan bir ölçüm
kaydediliyor ama o parti üretime ve sevkiyata gitmeye devam ediyor.
Karantina ve serbest bırakma kararı operasyona bağlı değil.

**3 · Yükleme sıcaklığı yok** (A4B-3) — ama `source_type='shipment'` zaten
destekleniyor, yani **bu sandığımdan çok daha küçük bir iş.**

---

# ÖZET — SATIŞ GÜCÜN NEREDE

| Konu | Düzey | Demoda söyleyebileceğin |
|---|---|---|
| **İzlenebilirlik** | **Güçlü** | *"Bir şikâyet geldiğinde, o partinin hangi tedarikçiden geldiğini ve aynı partiden kime daha mal gittiğini iki dakikada listeler, telefonlarıyla."* ⚠️ Etiketteki lot elle yazıldığı sürece bu cümlenin son adımı insana bağlı |
| **Depo / stok** | **Güçlü** | *"Lotu sistem seçiyor, kullanıcı değil. Tarihi geçmiş mal üretime giremiyor — sistem bırakmıyor."* |
| **HACCP** | **Orta** | Altyapı sağlam, giriş ekranı yok. Bugünkü hâliyle demoda **gösterilecek bir ekran yok** |
| **Analiz** | **Orta** | Fire, SKT ve sipariş tarafı gerçek ve iyi. Satış/kârlılık tarafı henüz yok |
| **AI** | **Zemin hazır** | Kural motoru çalışıyor; model katmanı sonraki adım |

---

# SIRAYI BUNA GÖRE DEĞİŞTİRİYORUM

Üç temel konundan **ikisi güçlü, biri ekransız.** Ve izlenebilirlik
zincirinin tek zayıf halkası etikette. Yeni sıra:

1. **HACCP ölçüm ekranı** — altyapı hazır, kapı yok. Yükleme sıcaklığı da
   buradan gelir (A4B-3 + A4B-4 birlikte kapanır).
2. **Sapma operasyonu engellesin** — bloke parti üretime ve sevkiyata
   gitmesin (Codex #8). HACCP'i "kayıt tutan" olmaktan "koruyan" yapan şey.
3. **Etiketi üretilen partiye bağla** — izlenebilirlik zincirinin son
   metresi. A4B-6 böylece işaretlenebilir.
4. **Satış ve kârlılık analizi** — en çok/az satılan, en karlı/az karlı,
   en hızlı bozulan, stok devir hızı. Veri hazır.
5. Raporlama'nın kalan ekranları · Codex C listesi · A4C-14 bildirim ·
   A4B-9 palet.

**Gerekçe:** ilk üçü senin "en önemli satış gücümüz" dediğin iki konuyu
tam yapıyor. Raporlama ekranları önemli ama **ikinci sırada** — kimse
rapor ekranı için ERP almaz, izlenebilirlik ve HACCP için alır.
