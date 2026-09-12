# ADR-008 · AI'ın ticari modeli ve veri sınırı

- **Durum:** Kabul edildi
- **Tarih:** 2026-09-11
- **Karar veren:** Emrah (ticari), teknik sınır bu belgede

---

## Bağlam

Yol haritasında "fiyat modeli" kararı açık duruyordu. Ayrıca Kalite modülünün
sektör şablonunda **opsiyonel** olması, HACCP ekranının müşteri menüsünde hiç
görünmemesine yol açtı — yani modül paketleme kararı doğrudan ürünün
çalışmasını etkiliyor.

## Karar

### 1. İşleyen her modül müşteriye açık

> "Müşteri için lazım olan, gerekli olan, faydalı olabilecek her türlü modül
> müşterinin hizmetine sunulacak."

Modüller artık satış kaleme ayrılmıyor. Bunun iki sonucu var:

- **Kalite (HACCP) sektör şablonunda varsayılan kapsama alınır.** HACCP
  endüstriyel mutfakta yasal zorunluluktur; opsiyonel bir eklenti değil.
- **Modül Mağazası bir ödeme duvarı değil, bir açma/kapama yeridir.**
  İşletme kullanmadığı modülü kapatabilir; parası olmadığı için kapalı
  kalan modül yoktur.

⚠️ Bu karar **ADR-002'yi geçersiz kılmaz.** "Açık" olan, *çalışan* modüldür.
Yarım bir modül ücretsiz diye açılmaz — menüde görünen her şey çalışır.
Bir modül hazır olduğunda varsayılana girer, hazır olmadan girmez.

### 2. AI iki ayrı ürün, aralarında VERİ SINIRI var

| | **Yardım AI** (ücretsiz) | **Danışman AI** (kredili) |
|---|---|---|
| Ne yapar | MİYOP'u anlatır: "bu ekran ne işe yarar", "mal kabul nasıl yapılır", "FEFO nedir" | İşletmenin verisine bakıp yorumlar: öneri, tahmin, fikir, uyarı |
| Neye erişir | **Yalnızca ürün belgeleri.** İşletme verisine ERİŞMEZ. | Stok defteri, üretim, sevkiyat, HACCP kayıtları |
| Ücret | Ücretsiz, sınırsız | Kredi düşer |
| Karşılığı | Akıllı bir "sık sorulan sorular" | Bu sohbetin yaptığı işin ürün içindeki hâli |

**Sınır neden teknik bir karar, ticari bir tercih değil:**

1. **Maliyet.** Ücretsiz ve sınırsız bir uç, işletme verisini okuyup uzun
   cevaplar üretirse fatura öngörülemez olur. Ücretsiz katmanın kısa ve
   sabit bir bağlamı olması, ücretsiz kalmasının şartıdır.
2. **Gizlilik.** İşletme verisine erişen her yol denetlenebilir olmalı
   (kim, ne zaman, hangi veriyi sordu). Kredi kaydı aynı zamanda bu denetim
   izidir. Ücretsiz katman veriye hiç dokunmadığı için o ize ihtiyaç duymaz.
3. **Dürüstlük.** "Ücretsiz AI" ile "kredili AI" arasındaki fark müşteriye
   tek cümlede anlatılabilir olmalı: *"Biri ürünü anlatır, öteki sizin
   verinize bakar."* Fark "kelime sayısı" olsaydı satılamazdı.

Bu sınır kod seviyesinde tutulur: ücretsiz yardım ucu `TenantCtx` almaz.
Alan bir uç, kredili uçtur.

### 3. Fiyatlama: başta neredeyse ücretsiz

> "Müşteriler ücretsize yakın bu uygulamayı kullansın, görsün, geri dönüş
> yapsın, geliştireyim daha da iyi duruma getireyim — işte o zaman fiyat
> konuşulur."

Erken dönemde gelir hedefi değil **geri bildirim** hedefi var. Bunun ürün
tarafındaki gereği: kredi motoru **ölçmeye baştan başlamalı**, ücretlendirme
sonra açılabilir. Ölçmeyen bir sistemde fiyat sonradan konulamaz — kimin ne
tükettiği bilinmez.

## Kredi motorunun asgari tasarımı (henüz yazılmadı)

Stok defteriyle **aynı kalıp**, ve bu tesadüf değil:

```
credit_ledger (append-only)
  tenant_id · user_id · operation · credit_delta · balance_after
  request_id (idempotency) · model · token_in · token_out · occurred_at
```

- **Append-only.** Kullanım kaydı silinmez, düzeltme ters kayıtla yapılır.
- **Bakiye saklanmaz, toplanarak bulunur** (ADR-001 ile aynı gerekçe).
- **Çağrıdan ÖNCE kontrol, SONRA kayıt.** Kredi yetmiyorsa çağrı yapılmaz.
- **`request_id` ile idempotency.** Aynı soru iki kez gönderilirse iki kez
  düşmez.
- Paket başına aylık kredi hakkı; devretme kuralı ticari karardır.

Aşama: **A6** (yayın sonrası). Demoda kredi motoru gösterilmez;
"AI danışman kredili çalışır" cümlesi kurulur ve ölçüm altyapısı arkada
başlar.

## Sonuçlar

**Olumlu**
- Modül paketleme kaynaklı görünmeme hataları ortadan kalkar.
- Müşteri ürünün tamamını görür; satış argümanı "eksiksiz sistem" olur.
- Tek ücretli kalem net ve anlatılabilir.

**Bedeli**
- Modül başına gelir yok; gelir tek bir kaleme bağlı.
- Ücretsiz yardım AI'ın kendi maliyeti var (düşük ama sıfır değil);
  bağlamı kısa tutmak bir kural, tercih değil.
- Kredi motoru yazılana kadar Danışman AI satılamaz.

## İlgili

- ADR-002 · Migrasyon kapsamı (core/frozen) — bu karar onu geçersiz kılmaz
- ADR-001 · Append-only defter — kredi defteri aynı kalıbı kullanır
- ADR-006 · Veri konumu — Danışman AI işletme verisini okuduğu için
  veri konumu kararı onu da kapsar
