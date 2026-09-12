# ADR-007 · Stok maliyet yöntemi

**Durum:** Kabul edildi (geçici) · **Tarih:** 2026-09-03
**Karar veren:** Ürün sahibi · **Gözden geçirme:** Demo sonrası, gerçek kullanıma geçmeden ÖNCE

## Bağlam

Aynı mal farklı tarihlerde farklı fiyatlardan alınır. 100 kg mercimeği 40
TL'den, iki hafta sonra 100 kg'ı 50 TL'den aldıysak, depodaki 200 kg'ın birim
maliyeti kaçtır? Üretimde 50 kg kullanıldığında reçetenin maliyetine kaç TL
yazılır?

Bu sorunun tek bir doğru cevabı yoktur; muhasebe yöntemi seçilir. Yaygın üç
yöntem:

| Yöntem | Yukarıdaki örnekte | Karakteri |
|---|---|---|
| Ağırlıklı ortalama | 45 TL | Dalgalanmayı yumuşatır. Gıdada en yaygın. |
| FIFO (ilk giren ilk çıkar) | 40 TL | Fiziksel gerçeğe en yakın. Lotlar zaten FEFO ile çekiliyor. |
| Son alış fiyatı | 50 TL | "Bugün yerine koysam ne öderim." |

## Karar

Yürürlükteki yöntem **ağırlıklı ortalama**.

Ama karar demo öncesinde, **müşterinin muhasebecisiyle konuşulmadan** verildi.
Bu yüzden karar tek bir sabite bağlandı ve **üç yöntem de yazıldı**:

```ts
// src/warehouse/stock-cost.ts
export const VARSAYILAN_MALIYET_YONTEMI: MaliyetYontemi = 'ORTALAMA'
```

Yöntemi değiştirmek bu satırı değiştirmektir. Ekranlar, raporlar ve (Aşama
3'te) üretim maliyeti bu sabiti okur; hiçbiri kendi yöntemini seçmez.

## Sonuçları

**İyi olan:** Demo sonrası "biz FIFO kullanıyoruz" cevabı gelirse, değişiklik
bir satır ve testlerin yeniden çalıştırılmasıdır. Üç yöntemin de testi var;
aynı defterden farklı rakamlar ürettikleri testle sabitlenmiş durumda.

**Dikkat edilecek olan:** Maliyet hiçbir yerde SAKLANMIYOR — her okumada
defterden yeniden hesaplanıyor (ADR-001 ile aynı gerekçe). Bunun bedeli şudur:

> **Yöntem değişirse geçmiş maliyetler de değişir.**

Geçen ayın üretim maliyeti raporu, yöntem değiştikten sonra farklı bir rakam
gösterir. Bu yüzden karar **gerçek kullanıma geçmeden önce** netleşmelidir.
Kullanım başladıktan sonra yöntem değiştirmek isteniyorsa, o noktada dönem
kapanışı ve maliyet dondurma mekanizması gerekir — bu ADR o mekanizmayı
kapsamıyor.

**Kapsam dışı bırakılan:** Kiracı başına yöntem ayarı. Şimdilik tek kurulum,
tek yöntem. Kiracı başına gerekirse, o ayarı okuyan tek fonksiyon yine
`stock-cost.ts` içinde olur — ekranlar değişmez.

## Uygulama notu — en ince nokta

`unitCost`, kullanıcının **yazdığı** birimin fiyatıdır (`uomEntered`), temel
birimin değil. Mercimek temel birimi "g" iken sipariş "kg" üzerinden 95
TL'den verilirse defterde `quantityEntered = 57 kg`, `unitCost = 95`,
`quantityBase = 57.000 g` durur.

Değer `quantityBase × unitCost` diye hesaplansaydı 5.415 TL yerine 5.415.000
TL çıkardı — bin kat hata, hiçbir uyarı vermeden. Doğrusu:

```
satır değeri  = |quantityEntered| × unitCost
birim maliyet = değer / quantityBase        ← temel birim başına
```

Bu üç yöntemin üçünde de aynı şekilde uygulanır ve ayrı ayrı test edilir.

## Alternatifler ve neden seçilmediler

**Yöntemi koda gömmek.** En kısa yol olurdu. Ama karar bir uzmanla
konuşulmadan verildiği için, "sonra değiştiririz" sözünün tutulabilir olması
gerekiyordu. Gömülü bir yöntemde o söz, hesabın yeniden yazılması anlamına
gelirdi.

**Maliyeti stok kartında saklamak.** Okuması hızlı olurdu. Ama saklanan bir
toplam, güncellemeyi unutan tek bir kod yoluyla sessizce yanlış hâle gelir ve
aylar sonra fark edilir (ADR-001'in tam olarak reddettiği şey). Ayrıca yöntem
değişikliğinde tüm geçmişin yeniden yazılması gerekirdi.
