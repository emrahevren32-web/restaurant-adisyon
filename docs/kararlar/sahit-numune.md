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
4. 🔄 **İmhayı kim onaylıyor** — hâlâ açık. Kayıt tutuluyor (zorunlu),
   onay adımı eklenebilir. İsmet'e sorulacak.
5. ✅ **Müşteri itirazında açılıyor**, müşteri önünde, ispatlı. Açılış
   kaydı zorunlu; gerekçe ve sonuç yazılıyor.

⚠️ Kalan tek soru (4) **ekranı engellemiyor**: bugün kaydı YAPAN yazılıyor,
onay sonradan eklenince eski kayıtlar bozulmuyor.

## Durum

HEDEFLER **A5** (demo öncesi) ve **3.9.1**.
- ✅ **Veritabanı tarafı BİTTİ** — göç 0093, prova 21/21.
- ⬜ **Ekran yazılmadı.** Numune alma, listeleme, açılış ve imha kaydı.
- ⬜ **Etiket ekranı saklama koşulunu ürün kartından okumalı** (3.9.3).
- 🔄 İmha onayı sorusu İsmet'ten bekleniyor (ekranı engellemiyor).
