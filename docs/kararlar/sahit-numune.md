# Şahit numune · tasarım kararı

**Kaynak:** Emrah, 20.10.2026. İsmet'in mutfağında bugün nasıl yapıldığının
kendi ağzından anlatımı. ⚠️ Bu doküman **mevzuat metni değildir**; işletmenin
fiilî uygulamasıdır. Mevzuat haddi ve zorunlu süreler mali müşavire /
gıda mühendisine ayrıca sorulacak.

## Emrah'ın anlattığı (aynen, özetlenmeden)

> "Ürün raf ömrü ne kadarsa o kadar tutuluyor, SKT sonu gelene kadar.
> Açılmış ise açık kalmaya uygun olduğu gün kadar. Müşteriye saklaması
> gereken koşullar söylenir ve satılan ürün aynı şartlarda aynı koşullarda
> bizde de saklanır. -18 veya +4 fark etmez. Birebir aynısı, müşteri
> gibi. Müşteri arayıp ürün bozuldu vs derse bizdeki aynı koşullarda
> saklanana bakar; evet haklısın veya doğru ortamda tutmamışsın deriz."

## Bundan çıkan tasarım kuralları

**1 · Saklama süresi SABİT DEĞİL — üründen geliyor.**
"72 saat" gibi tek bir sayı YAZILMAZ. Numunenin saklama sonu:
- kapalı ürün → o ürünün **son kullanma tarihi**
- açılmış ürün → **açıldıktan sonra uygun olduğu gün sayısı** kadar
Yani numune kaydı ürüne/lota bağlanmak zorunda; süreyi oradan türetiyoruz.
⚠️ Ekrana elle "kaç gün" yazdırmak, bu kuralı ilk gün bozar.

**2 · Saklama koşulu, MÜŞTERİYE SÖYLENENİN BİREBİR AYNISI.**
-18 °C ya da +4 °C — hangisi müşteriye bildirildiyse numune de onda durur.
Yani numunenin saklama koşulu uydurulmaz; **sevk/etiket üzerinde müşteriye
bildirilen koşulla AYNI alandan gelir.** İkisi ayrı yerde tutulursa bir gün
biri değişir ve numune "yanlış ortamda" tutulmuş olur — tam da numunenin
çürüteceği iddianın kendisi gerçekleşir.

**3 · Numunenin AMACI bir tartışmayı çözmek.**
Müşteri "ürün bozuldu" dediğinde bakılan şey bu. Dolayısıyla kayıt şu
soruya cevap verebilmeli: *"bu sevkiyattaki bu ürünün numunesi, müşteriye
söylenen koşulda, SKT'sine kadar bizde duruyor muydu?"*
Cevap "evet" ise müşteri haklı; "hayır" ise müşteri doğru saklamamıştır.
⚠️ Bu yüzden numune **sevkiyata ve lota** bağlı olmalı — ürün adına değil.

## Veri modeli taslağı (henüz göç yazılmadı)

| Alan | Nereden gelir | Neden |
|---|---|---|
| lot / stok hareketi | bağ | Hangi partinin numunesi — ad yetmez |
| sevkiyat (varsa) | bağ | Hangi müşteriye gideni temsil ediyor |
| alınma tarihi | kayıt anı | — |
| saklama koşulu | **müşteriye bildirilen koşul** | Kural 2 · uydurulmaz |
| saklama sonu | **ürünün SKT'si** ya da açılmışsa uygun gün | Kural 1 · türetilir |
| açıldı mı | kayıt | Süreyi değiştiriyor |
| alan kişi | sunucu yazar | İmza istemciden gelmez (0081 deseni) |
| imha tarihi / gerekçe | kayıt | Süre dolunca ne olduğu |

⚠️ **İmha kaydı zorunlu:** "numune vardı ama artık yok" denemez. Append-only
defter deseni (stok, denetim, HACCP ölçümü) burada da geçerli.

## CEVAPLAR GELDİ (25.10.2026) — göç 0093 yazıldı

**İsmet (WhatsApp, 25.10):** *"Evet gıda teknikeri ve depocu kontrolünde
oluyor; üretim her ürettiği parti üründen şahit numune alıyor."*

Bu tek cümle beklediğim **asıl** soruyu kapattı: numune **sevkiyata değil,
ÜRETİM PARTİSİNE** bağlı. Aynı partiden beş müşteriye gidiyorsa **bir**
numune var. Veri modeli buna göre kuruldu: `witness_sample.lot_id` zorunlu.

**Emrah (25.10):** numuneyi kim alabilir → *"her ikisine de bağla, ortak
bir iş olabileceğini de belirt."* → Kapı `quality.record.manage` **veya**
`production.write`.
⚠️ Depocu "kontrolünde" — bu **fiziksel sorumluluk**, sistem izni değil.
Depocuya izin vermek, kendi başına numune kaydı AÇMASI demek olurdu ve
İsmet öyle demedi. (Prova bunu ayrıca sınıyor: depo sorumlusu numune
alamıyor.)

**Emrah (25.10):** imha → *"SKT bitince ispatlayacak bir şey kalmıyor ama
kaydı mutlaka tutulmalı."* → İmha bir **olay kaydı**; gerekçe zorunlu.
⚠️ İmhayı kimin ONAYLAYACAĞI hâlâ açık (müdür mü, gıda mühendisi mi,
kaliteci mi). Bugün kayıt **yapanı** yazıyor; onay adımı eklenebilir ve
eklenince eski kayıtlar bozulmaz.

**Emrah (25.10):** müşteri itirazı → *"kesinlikle kayıt tutulur, müşteri
önünde açılır, ispatı olacak şekilde."* → Açılış bir **olay kaydı**;
gerekçe zorunlu, sonuç alanı var. Açılan numune `ACILDI` durumuna geçiyor.

---

## NE YAPILDI · göç 0093

| Kural | Nerede zorlanıyor |
|---|---|
| Numune **partiye** bağlı | `lot_id` zorunlu, `stock_lot`a yabancı anahtar |
| Saklama sonu **partiden türetilir** | Tetik `keep_until = lot.expires_on` yazıyor; ekranın yazdığı **yok sayılıyor** |
| SKT'siz partiden numune **alınamaz** | `MI422` ile reddediliyor |
| Saklama koşulu **müşteriye söylenenin aynısı** | Yeni alan `stock_item.storage_condition`'dan **kopyalanıyor**; ekranınki yok sayılıyor |
| Koşulu tanımsız üründen numune **alınamaz** | `MI422` ile reddediliyor |
| İmza **sunucuda** | `taken_by` tetikte `app.aktif_kullanici_id()` ile yazılıyor |
| Numune **silinemez / değiştirilemez** | DELETE ve UPDATE yetkisi hiç verilmedi; durum olaydan türetiliyor |
| Açılış ve imha **gerekçe ister** | Kısıt: `ALINDI` dışındaki olaylarda gerekçe boş olamaz |
| Olay kaydı **değişmez** | Hem yetki yok hem değişmezlik tetiği (iki hat) |
| Aynı partide **tek açık numune** | Kısmi tekil indeks (`status <> 'IMHA'`) |
| İmhadan sonra **yeniden** numune alınabilir | Aynı indeksin dışında kalıyor |
| Her şey **denetime** düşüyor | `app.denetim_yaz()` iki tabloda da |

**Prova 21/21.** Göç dört kez üst üste koşturuldu. İki olumsuz deneme
yapıldı: türetme tetiği düşürülünce prova 4. sınamada, yetki kapısı
düşürülünce 3. sınamada kırmızı döndü.

---

## ⚠️ BU GÖÇÜN ORTAYA ÇIKARDIĞI EKSİK

**Saklama koşulu hiçbir yerde SAKLANMIYORDU.** Etiket ekranında her
baskıda **elle yazılan** serbest bir metin alanıydı (`Etiketler.tsx`,
yer tutucu `0–4 °C`). Yani aynı ürün iki baskıda iki farklı koşul
taşıyabiliyordu — ve numuneyi oradan beslemek, *"birebir aynısı"*
iddiasını ilk gün yalanlardı.

Koşul artık **ürün kartında** (`stock_item.storage_condition`).
⚠️ **Etiket ekranı da oradan okumalı** — yoksa iki ayrı doğru olur ve
kural 2 yine çöker. → HEDEFLER **3.9.3**

---

## Açık sorular — kalanlar

1. ✅ **Nerede saklanıyor** — Emrah cevapladı: *"müşteriye nasıl saklamasını
   söylediysek bizde öyle saklıyoruz, birebir aynı şartlarda."* Yani soru
   "hangi dolap" değil **"hangi koşul"**du ve cevabı tek kaynaktan geliyor.
   Ayrı bir "yer" alanı **tutulmadı**: tutsaydık doldurulmayan ya da
   uydurulan bir alan olurdu.
2. ✅ **Kim alıyor** — üretim alıyor, gıda teknikeri ve depocu kontrolünde.
   İzin: `quality.record.manage` **veya** `production.write`.
3. ✅ **Her üretim partisinden.** Sevkiyat başına değil.
4. ✅ **İmhayı kim onaylıyor** — **Emrah cevapladı (26.10):** *"Müdür
   onaylar ama müdür yoksa gıda mühendisi veya kalitecide onaylayabilir."*
   Göç **0097** ile zorlandı: imha olayı artık `quality.record.manage`
   istiyor. Bu izin işletme müdürü, gıda mühendisi, kalite sorumlusu ve
   işletme sahibinde var; **üretim sorumlusu ve depo sorumlusunda YOK.**
   ⚠️ 0093 üç olayı da aynı kapıya bağlamıştı, yani **üretim sorumlusu
   numuneyi imha edebiliyordu** — karar bunu kapattı. Numune almak ve açmak
   bir İŞ, imha etmek bir KARAR.
   ⚠️ *"Müdür yoksa"* koşulu **koda yazılmadı**: sistem müdürün o gün işte
   olup olmadığını bilemez. Üçü de onaylayabiliyor, sıralama ekranda yazılı.
   ⚠️ Ayrı bir "onaylayan" kolonu açılmadı: imha kaydını ancak onaylayabilen
   biri yazabildiği için `actor_user_id` zaten onaylayandır.
5. ✅ **Müşteri itirazında açılıyor**, müşteri önünde, ispatlı. Açılış
   kaydı zorunlu; gerekçe ve sonuç yazılıyor.

✅ **Açık soru kalmadı.**

## 26.10.2026 · ÜÇ GÖÇ DAHA VE EKRAN

### Göç 0094 · kiracı sınırı, satır kilidi, açık raf ömrü

Codex **kendi yazdığım 0093'te bir P0 buldu** (MIYOP-075):
`app.numune_olayi()` `security definer`dı, yani RLS'i atlıyordu, ve
numuneyi **yalnız `sample_id` ile** buluyordu. Olay satırının kendi
`tenant_id`si saldırganın kiracısını gösterdiği için RLS de geçiyordu.
**A kiracısındaki bir üretim sorumlusu, B kiracısının numunesini IMHA'ya
çevirebiliyordu.** Prova ile canlandırıldı: onarımdan önce B'nin numunesi
gerçekten IMHA oldu.

⚠️ **Aynı kusur `numune_turet()`te de vardı ve raporda yoktu.** Parti,
şube ve iş emri kimlikleri kiracı doğrulanmadan okunuyordu: A kiracısı
B'nin **partisinden** numune alabiliyordu. Gösterilen yeri onarıp aynı
desenin diğer yerlerine bakmamak, onarımı yarım bırakmak olurdu
(tuzak 117).

Diğer iki bulgu:
- **MIYOP-077** · durum okuması kilitsizdi. `for update` eklendi; eşzamanlı
  bir ACILDI artık bir IMHA'nın üstüne binemiyor.
- **MIYOP-076** · `opened_shelf_life_days` **hiç kullanılmıyordu.** Kural
  yazılıydı, kolon vardı, hiçbir yerde okunmuyordu — yani ekranda bir alan
  duruyor, hiçbir şey yapmıyordu (tuzak 118). Artık **açılışta** saklama
  sonu `least(partinin SKT'si, açılış günü + açık raf ömrü)` ile
  **KISALIYOR**. `least` olduğu için asla uzamıyor — Emrah'ın kuralı:
  *"süre dolunca aynı zamanda verilmiş SKT süresi de dolmuş demektir."*

Ölçüm bir dördüncüsünü buldu: `sample_code_key` NOT NULL'du ama hiçbir
yerde türetilmiyordu. Tekillik indeksi o kolonda olduğu için aynı kodu
farklı bir anahtarla gönderen istemci indeksi **atlayabilirdi** — "N-1"
ile "n-1" iki ayrı numune olurdu. Anahtar artık sunucuda
(`app.kimlik_anahtari()`), kural uygulamadaki `normalizeIdentifier()` ile
birebir aynı.

Prova 0094: **18/18**.

### Göç 0096 · saklama koşulu bir BEYANDIR

Ekran yazılırken ortaya çıktı: saklama koşulu kartta duruyordu ama kartı
**güncelleyen hiçbir yol yoktu** — `StokKatalogu` yalnız `kalemEkle`
taşıyordu ve eski "Stok Kartları" ekranı donmuş. Yani var olan ürünlerin
koşulu hiçbir zaman yazılamaz, o ürünlerden numune hiçbir zaman
alınamazdı (tuzak 121).

İkinci yarısı izin tarafındaydı: kartın kapısı `stock.write` istiyor ve
`stock.write` **kalite sorumlusunda ve gıda mühendisinde YOK.** Numunenin
kuralını uygulayan departman, o kuralın girdisini yazamıyordu.

Saklama koşulu bir stok özelliği değil, **müşteriye yapılan bir
beyandır** — etikete basılan, müşteriye söylenen ve numunenin uymak
zorunda olduğu cümle aynı cümle. Alerjen beyanı 0072/0073'te tam bu
sebeple `quality.declaration`a bağlanmıştı. Göç 0096 iki alanı o listeye
ekledi. ⚠️ `stock.write` **kaldırılmadı**: depocu ve üretim de yazmaya
devam ediyor.

Prova 0096: **9/9** — içinde *"kalite kartın ADINI değiştiremiyor"* ve
*"reddedilen işlem satırı DEĞİŞTİRMEDİ"* sınamaları.

### Göç 0097 · imha bir ONAY işidir

Emrah (26.10): *"Müdür onaylar ama müdür yoksa gıda mühendisi veya
kalitecide onaylayabilir."*

İmha olayı artık `quality.record.manage` istiyor; ALINDI ve ACILDI eski
ortak kapıda (`quality.record.manage` **veya** `production.write`).
Üretim numuneyi almaya ve müşteri önünde açmaya devam ediyor.

⚠️ **Eski gevşek tetik düşürüldü.** 0093'ün `izin_witness_sample_event`
tetiği aynı tabloda kalsaydı iki kapı birlikte çalışır ve istek **en
gevşeğinden** geçerdi — yeni dar kapı hiçbir şeyi engellemezdi. Hem göçün
doğrulaması, hem prova, hem çıcır testi bunu ayrıca ölçüyor (tuzak 122).

Prova 0097: **13/13** — içinde *"reddedilen imha durumu DEĞİŞTİRMEDİ"*
(hata kodu dönüp satırın yine değişmesi, "kapı var" demenin en kötü
biçimi olurdu) ve *"üretim numune almaya/açmaya DEVAM EDİYOR"* sınamaları.

### Ekran · Kalite → Şahit Numune

`src/pages/SahitNumune.tsx`. Dört işi var: **numune al**, **izle**,
**aç** (müşteri önünde; gerekçe VE sonuç zorunlu), **imha** (gerekçe
zorunlu). Ürün kartına saklama beyanı **Depo ekranından** yazılıyor.

⚠️ **Ekran hiçbir şey hesaplamıyor.** Saklama koşulu, saklama sonu, açık
raf ömrü ve imza sunucudan geliyor. Ekranda hesaplanan tek şey "bugün o
günü geçti mi" GÖSTERİMİ.

⚠️ **Hiçbir parti seçilemiyorsa sebep TOPLUCA yazılıyor** (26.10 akşam):
"listede parti var ama hepsi seçilemez" hâli, "liste boş" hâlinden ayrı bir
cümle ister — çünkü eksik olan şey düzeltilebilir ve nerede düzeltileceğini
söylemek bu ekranın işi (tuzak 126).

⚠️ **Görme izni `quality.read`** — ölçüldü, tahmin edilmedi: altı rolde
de var (kalite, gıda mühendisi, üretim, **depo**, müdür, sahip) ve altısı
da bu akışın içinde. Yazma kapısı daha dar: `quality.record.manage` veya
`production.write`. Depocu defteri görür, kayıt açamaz — İsmet "depocu
kontrolünde" dedi, kontrol fiziksel sorumluluktur.

---

## Durum

HEDEFLER **A5** (demo öncesi) ve **3.9.1/3.9.4/3.9.6**.
- ✅ **Veritabanı BİTTİ** — 0093 (defter) + 0094 (kiracı sınırı, kilit,
  açık raf ömrü, kod anahtarı) + 0096 (beyan izni) + 0097 (imha onayı).
  Prova **61 sınama**.
- ✅ **EKRAN AÇILDI** — Kalite → Şahit Numune (26.10).
- ✅ **Ürün kartına saklama beyanı yazılabiliyor** — Depo ekranı.
- ✅ **Etiket saklama koşulunu ürün kartından okuyor** (3.9.3 · 27.10).
  **Şahit numune tam bitti.**
- ✅ **İmha onayı kararı verildi ve zorlandı** — göç 0097, prova 13/13.
  Müdür onaylar; müdür yoksa gıda mühendisi ya da kalite sorumlusu.
  Üretim sorumlusu numune alır ve açar, **imha edemez.**


---

## Etiket saklama koşulu · kaynak kararı (27.10.2026)

Göç 0093 `stock_item.storage_condition` sütununu açarken yorumuna şunu
yazmıştı: *"Etiket de buradan okumalı."* **Okumuyordu.** Etiketteki Saklama
satırı ekranda her baskıda elle yazılan serbest bir metindi.

Bu bir yazım hatası değil, bir ÇELİŞKİ kaynağıydı: aynı lotun şahit numunesi
saklama koşulunu **karttan** kopyalıyor (0093/0094). Yani tek ürünün iki
"kayıtlı" saklama koşulu olabiliyordu — biri numune defterinde, biri
ambalajın üstünde. İkisi de kayıtlı görünür, hangisinin doğru olduğunu kimse
bilemez. Bu modülün bütün varlık sebebi *"numune, müşteriye söylenenin
aynısında durur"* iddiasıydı; o iddia bu çelişkiyle çöküyordu.

### Karar 1 · Kaynak: ÜRÜN KARTI ÖNCE

Kart doluysa ekranda yazılan değer **yok sayılır**. Ekran kartla çelişen bir
etiket basabilseydi, *"kartta ne yazıyorsa o basılır"* güvencesi biterdi.

### Karar 2 · Zorunluluk ölçütü: LOT ya da SKT TAKİBİ (Emrah, seçenek c)

Saklama koşulu **her üründe zorunlu değil.** Türk Gıda Kodeksi
*"gerektiğinde"* diyor: kuru bakliyatta aranmaz, soğuk zincirde şarttır.
Ayırt edici ölçüt **takip**: lot ya da SKT takibi açık olan ürün,
bozulabilen üründür.

- Takipli üründe koşul boşsa → etiket **TASLAK**, eksik cümlesi nereye
  yazılacağını söyler (Depo → Saklama Beyanı).
- Takipsiz üründe boşsa → satır sessizce basılmaz. Zorunlu tutsaydık kural
  değil **kilit** olurdu ve insanlar kuralı atlamanın yolunu arardı.

### Karar 3 · Elle yazılan kutu KALIYOR ama dürüstleşiyor (Emrah)

- Kart doluysa kutu **salt okunur**, altında *"ürün kartından geliyor ·
  değiştirmek için Depo → Saklama Beyanı"*.
- Kart boşsa yazılabilir, ama ekran *"bu değer karta kaydedilmedi, bir
  sonraki baskıda yeniden yazman gerekir"* der.

Kullanıcı etikette gördüğü değerin **nereden geldiğini** biliyor; yanlışsa
nereyi düzelteceğini de.

### Ölçüm

9 servis sınaması + 7 belge sınaması + `etiket-saklama-kaynagi.arch.test.ts`
(7 sınama). Emrah'ın koşusunda toplam **1584 test**. Mimari test **dosyanın metnini** ölçüyor: arıza bir sütunun
`select` listesinde olmamasıydı ve sahte depolu bir davranış testi gerçek
sorguyu hiç görmez. Kuralı 0093'ün sütun yorumuna yazmak **uyarmadı**
(tuzak 139: yorum hatırlatır, test engeller).
