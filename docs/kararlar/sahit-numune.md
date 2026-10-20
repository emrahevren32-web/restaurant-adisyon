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

## Açık sorular — İsmet iyileşince sorulacak

1. Numune **nerede** saklanıyor: ayrı bir dolap mı, aynı depoda ayrılmış
   raf mı? (Raf adresi hedefi 8.2.2 ile kesişiyor.)
2. Numuneyi **kim** alıyor — üretim mi, kalite mi? Hangi izin olmalı:
   `quality.record.manage` mı, `production.write` mı?
3. Her sevkiyattan mı numune alınıyor, yoksa her **üretim partisinden** mi?
4. Süre dolunca imha **kim** onaylıyor, kayıt tutuluyor mu?
5. Müşteri itirazı geldiğinde numune **açılıyor** mu, açılan numunenin
   kendisi kayda giriyor mu?

⚠️ 1–5 cevaplanmadan ekran yazılmaz. Yazılırsa "mış gibi" bir ekran olur ve
bu dokümanın varlık sebebi tam olarak onu engellemek.

## Durum

HEDEFLER **A5** (demo öncesi) ve **3.9.1**. Emrah 20.10'da *"demo öncesine
al"* dedi; veri modeli yukarıda, ama **açık sorular cevaplanmadan göç
yazılmayacak.** Cevaplar gelince bu doküman güncellenip göç yazılır.
