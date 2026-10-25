# Parti karekodu (QR) · tasarım kararı

**Emrah'ın fikri (21.10.2026):** *"mal kabulde ürünün kabulü olduğunda
üstüne bir QR barkod yapıştırılsın ve ürün tekrar çıkartılırken aynı QR
okutulsun böylece doğru ürünü girip doğru ürünün çıktığını netleştirmiş
oluruz. almaması gereken malzemeyi kimse depodan alamaz ve bunun farklı
faydaları da olur... sistemde kaçağı önler diye düşünüyorum."*

**Cevabım: fikir doğru, ama "kaçağı önler" cümlesini düzeltmem lazım.**
Aşağıda neyi gerçekten çözdüğünü, neyi çözmediğini ve hangi sürümün ne
kadar iş olduğunu yazıyorum.

---

## 1 · BU, DONDURULMUŞ "QR MENÜ" MODÜLÜ DEĞİL

⚠️ İsim karışmasın. Depoda duran `business-qr-menu` modülü
(`foundationScope: 'frozen'`) **masa servisi** içindi: müşteri masadaki
karekodu okutur, dijital katalogdan sipariş verir, garson çağırır.
21.10'da public `/qr/<id>` yolunu kapattım (MIYOP-067) çünkü o ekran
"iletildi" diyip hiçbir şey iletmiyordu.

Emrah'ın anlattığı şey **tamamen başka bir iş**: depodaki fiziksel malın
kimliği. Belgede adı **parti karekodu**. O donmuş modül geri açılmıyor;
bu iş sıfırdan ve kendi adıyla yazılır.

---

## 2 · NEYİ ÇÖZER, NEYİ ÇÖZMEZ · dürüst ayrım

### Çözer

1. **Yanlış kalem/parti seçimini.** Bugün depo görevlisi ekrandan listeden
   seçiyor. Benzer isimli iki kalem (iki farklı yağ, iki farklı un) ya da
   aynı kalemin iki partisi karışabiliyor. Karekod okutulduğunda seçim
   **eldeki fiziksel maldan** gelir, hafızadan değil.
2. **SKT ve FIFO'yu ZORLAMAYI.** Çıkış anında okutulan parti belli
   olduğundan sunucu *"bu partinin SKT'si geçmiş, çıkaramazsın"* ya da
   *"daha eski açık bir parti var, önce onu kullan"* diyebilir. Bugün bu
   kontrol **yok**: `stock_lot.expires_on` kolonu var, çıkışta onu zorunlu
   kılan bir kapı yok.
3. **Alerjen doğrulamasını.** Üretim emrinin beyanı ile çıkarılan partinin
   alerjeni (0057/0072) çıkış anında karşılaştırılabilir. Etikete yanlış
   alerjen basılması, bu işin en pahalı hatası.
4. **Geri çağırmayı ve şahit numuneyi.** Bir müşteri *"ürün bozuk"*
   dediğinde hangi partinin hangi sevkiyata gittiği **okutmayla** kesin
   olur. Şahit numune kararının (`sahit-numune.md`) lota bağlanma şartı
   tam bunun için.
5. **Kayıt hızını.** Bu küçük görünür ama en belirleyici olan: kayıt
   yavaşsa kimse kaydetmez. Okutmak, listeden aramaktan hızlıdır.

### ÇÖZMEZ

⚠️ **Karekod hırsızlığı önlemez.** Malı izinsiz alan kişi okutmaz.
Karekodun yaptığı şey, *kayıtsız çıkışı* **sayımda görünür ve kime ait
olduğu belli bir farka** dönüştürmektir. Fiziksel engel değildir; kapıyı
kilitlemez.

Kaçağı asıl önleyen üç şey, karekoddan bağımsız:
- her çıkışın bir **belgesi** olması (talep / sipariş / iş emri)
- **sayımın düzenli** yapılması ve farkın gerekçelendirilmesi — bizde var
  (0025, `COUNT_SURPLUS` / `COUNT_SHORTAGE`)
- farkın **kişiye bağlanması**

⚠️ **25.10.2026 · İKİ İDDİA DÜZELTİLDİ (MIYOP-069 · Codex buldu, haklı).**
İlk sürümde bu üç maddeyi *"bu bizde var"* diye yazmıştım. Kayıtların
taşıyabileceğinden güçlü bir cümleydi:

- **Belge bağı zorunlu değil.** `stock_movement.reason` ve `source_type`
  **zorunlu** (`not null`) — yani hareketin *sebebi* ve *süreci* her zaman
  kayıtlı. Ama `source_id` **boş olabilir** (kısıt yok) ve elle çıkış
  formu onu **hiç göndermiyor** (`stock.postgres.ts` `null` yazıyor).
  Yani "bu çıkış şu siparişe dayanıyor" bağı her yolda yok.
- **Denetim kaydı, malı alanı değil KAYDEDENİ gösterir.**
  `audit_log.actor_user_id` ve sayımın kullanıcı alanları işlemi **yapan**
  kişiyi tutuyor. Kayıtsız malı fiziksel olarak kimin aldığını hiçbir
  kayıt kendiliğinden söylemez. ⚠️ Bu ayrım önemli: karıştırılırsa, farkı
  dürüstçe kaydeden çalışan kaybın sorumlusu sanılabilir.

**Doğru cümle şu:** *Hareketin sebebi, süreci ve kaydı yapan kişi
izlenebilir. Kaynak belge bağı bütün çıkış yollarında zorunlu değildir.
Sayım, hangi lotta fark bulunduğunu ve farkı kimin kaydettiğini gösterir;
kayıtsız malı kimin aldığını kendiliğinden belirlemez.*

⚠️ Buradan **yeni bir iş** çıktı: `source_id`'nin zorunlu olduğu çıkış
yolları belirlenmeli ve elle çıkış formuna bir dayanak alanı eklenmeli.
→ HEDEFLER 2.10

Karekod bu üçünü **hızlandırır ve doğrular**, yerini almaz.
Emrah'a söylenecek dürüst cümle: *"kaçağı önlemez, kaçağı görünür kılar
ve yanlış kaydı önler."*

---

## 3 · ÜÇ SEVİYE · hangisi ne kadar iş

Karekodun **ne taşıdığı** her şeyi belirliyor. Üç seçenek var ve
aralarındaki fark küçük değil.

| | Karekod neyi gösterir | Yeni tablo | Etiket sayısı | Kaçak kontrolü |
|---|---|---|---|---|
| **A** | **Parti** (`stock_lot`) | **YOK** | kabul edilen her parti için 1 | orta |
| **B** | **Taşıma birimi** (çuval, kasa, palet — her biri ayrı) | **1 yeni tablo** | her fiziksel paket için 1 | yüksek |
| **C** | Kalem (`stock_item`) | YOK | kalem başına 1 (sabit) | **yok** |

**C elenir.** "Bu undur" bilgisini göz de veriyor; parti ve SKT taşımadığı
için ne izlenebilirlik ne FIFO sağlar. Karekodu olsun diye karekod olur.

**A · PARTİ KAREKODU — önerim bu.**
Hazır olan: `stock_lot` tablosu `id`, `lot_code`, `expires_on`,
`origin_type`, `supplier_name` taşıyor (0003). `stock_movement.lot_id`
zaten partiye bağlı. Mal kabul satırı (`goods_receipt_line.lot_code`,
`expires_on`) partiyi kabulde oluşturuyor (0019). Etiket basma ekranı
duruyor.
Yani **veritabanı tarafında yeni tablo gerekmiyor.** Yapılacak iş:
kabulde etikete karekod eklemek + çıkış ekranlarında okutma girişi +
sunucu tarafında parti kapısı (SKT/FIFO/alerjen).

**B · TAŞIMA BİRİMİ KAREKODU — gerçek kaçak kontrolü bu, ama pahalı.**
Her çuval/kasa/palet kendi kimliğini taşır: 20 çuval unun 20 ayrı
karekodu olur. O zaman *"çıkan 3 çuval"* değil *"çıkan şu üç çuval"*
bilinir ve eksik çuval **bir okutma ya da sayım yapıldığında** belli olur.
⚠️ "Hemen belli olur" demiyorum (MIYOP-069): kimse okutmazsa hiçbir şey
belli olmaz. Belli olmasını sağlayan şey karekod değil, **karşılaştırma**.
Gerekli yeni iş: bir `handling_unit` (taşıma birimi) tablosu —
`id, lot_id, qty, uom, durum(depoda/tüketildi/sevk edildi), branch_id`
+ hareket defterine bağlanması + **kısmi tüketim kuralı** (yarım çuval
kullanıldığında birim ne olur?) + sayımın bu birimler üzerinden yapılması.
⚠️ Ayrıca depodaki **iş yükünü artırır**: 20 etiket basılır, 20 okutma
yapılır. Hız kazanmak için yapılan şey hıza zarar verirse terk edilir.

**Karar: A ile başlanır. B, ancak İsmet'in gerçek hacmi ve kaçak şüphesi
bunu gerektiriyorsa yazılır.** A'nın verisi B'ye temiz göç eder: taşıma
birimi tablosu partiye bağlanır, A'da basılmış etiketler geçersiz olmaz.

---

## 4 · BUGÜN OLMAYAN VE GEREKEN ŞEYLER

Bunlar "yazılım işi" değil, karar ve donanım işi. ⚠️ Cevapsız yazılırsa
*"mış gibi"* bir ekran olur.

1. **Okutacak cihaz.** Karekod kamera ister. Depoda telefon/tablet var mı,
   olacak mı? → `ismete-sorulacaklar.md` **E3** (zaten açık)
2. **Etiket ve yazıcı.** Hangi yazıcı, hangi boy? → **D1, D2** (açık)
   ⚠️ Yeni soru: **-18 °C'de ve ıslak yüzeyde duran etiket** gerekiyor.
   Normal termal etiket donmuş çuvalda düşer. Bu bir malzeme kararı.
3. **Kim okutacak?** Mal kabulde etiketi basan kişi ile depodan çıkaran
   kişi aynı mı? Yetki `stock.write` ile mi sınırlı kalacak?
4. **Kısmi çıkış.** Bir çuvalın yarısı kullanıldığında ne olur? A
   seviyesinde sorun yok (parti miktarı azalır); B'de bu bir kural ister.
5. **Okutulamayan etiket.** Etiket yırtıldı/ıslandı. **Elle devam yolu
   olmak zorunda** — yoksa iş durur. Ama elle devam **gerekçe ister** ve
   denetime düşer, yoksa karekod kuralı ilk gün esner ve biter.

→ Bu beşi `ismete-sorulacaklar.md` **F** başlığına yazıldı.

---

## 5 · KAPSAM KARARI

⚠️ **Demo öncesine ALINMIYOR.** Gerekçe Emrah'ın kendi kuralı: demo
öncesi en fazla 2 hafta ve *"yarım ekranlar bariz itibar düşürücü."*
Parti karekodu, cihaz + etiket malzemesi + depo alışkanlığı isteyen bir
iş; iki hafta içine sıkıştırılırsa tam olarak yarım kalır.

HEDEFLER'de **ilk müşteriden sonra** (bölüm 8) duruyor. Ama iki parçası
**ucuz** ve sırası gelince önce onlar yapılır:
- **8.x.1** Etikete parti karekodu eklemek (etiket ekranı hazır,
  `stock_lot.id` hazır) — okutma olmadan da izlenebilirlik kazandırır.
- **8.x.2** Çıkışta **SKT kapısı** (karekoddan bağımsız!): süresi geçmiş
  parti çıkarılamaz. Bu bugün bile yazılabilir ve karekod beklemez.
  ⚠️ Bunu ayrı tutuyorum çünkü değeri karekoda bağlı değil.
