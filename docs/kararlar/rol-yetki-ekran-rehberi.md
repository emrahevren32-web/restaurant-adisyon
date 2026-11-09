# MİYOP · Kim neyi görür, kim neyi yapar — tam liste

> **Satış görüşmesinde açılacak tek belge budur.** *"Depocu fiyatı görür
> mü?"*, *"Müdür kullanıcı açabilir mi?"*, *"Şahit numuneyi kim imha
> eder?"* — hepsinin cevabı burada.

## Bu belgedeki her sayı nereden geliyor

| Bölüm | Kaynak | Ne zaman |
|---|---|---|
| Roller, izinler, yazma/okuma kapıları | `db/prova/rol-yetki-raporu.sql` — **prova veritabanından ölçüldü** | 08.11.2026 · göç 0108 |
| Ekran sayıları | `src/authorization/rol-ekran-matrisi.test.ts` — **68 test, yeşil**; sayıları uygulamanın kendi menü fonksiyonu hesaplıyor | 08.11.2026 |
| Ekran listeleri | Aynı testin ölçümünden türetildi | 05.11 + sonraki farklar |

⚠️ **Elle yazılmış hiçbir sayı yok.** Elle sürdürülen bir yetki belgesi bir
hafta içinde bayatlar ve bayat bir yetki belgesi **olmayan bir güvenlik
duygusu** verir (tuzak 186). Bu belge 05.11'de tam olarak bunu yaşadı:
beş sayı üç hafta boyunca yanlıştı.

**Yeniden üretmek için:**
```bash
bash db/prova/kur.sh
su postgres -c "psql -q -d miyop -f db/prova/rol-yetki-raporu.sql"
npm test -- rol-ekran-matrisi
```

---

## Önce şu soru: "Bunu kim engelliyor?"

Müşteri *"yani personel fiyatı göremiyor, öyle mi?"* diye sorarsa cevap
şudur: **üç ayrı yerde engelleniyor.**

| Kapı | Nerede | Ne yapar |
|---|---|---|
| Menü | Uygulamanın menü kaydı | Çalışmayacak düğmeyi hiç göstermez |
| Rota | Adres kapısı | Adresi elle yazarak girmeyi engeller |
| **Veritabanı** | Tetik + satır güvenliği (RLS) | **ASIL SINIR.** Ekranı atlayıp doğrudan istek gönderen de reddedilir |

⚠️ İlk ikisi tarayıcıda çalışır, yani tek başına **güvenlik değildir**.
Satışta söylenecek cümle: *"Ekranda gizlemek koruma değildir; bizde kapı
veritabanında."* Bu, rakiplerin çoğunda olmayan şeydir ve
`db/prova/` altındaki **57 prova** bunu gerçek bir PostgreSQL üzerinde,
kullanıcı rolüne girerek kanıtlıyor.

---

## Özet tablo

| Rol | İzin | Ekran | Maliyet/fiyat |
|---|---:|---:|---|
| Platform Yöneticisi (`super_admin`) | 35 | 19 | görür |
| Platform Sahibi (`admin`) | 35 | 19 | görür |
| **İşletme Sahibi** | 33 | **20** | görür |
| **İşletme Müdürü** | 29 | **18** | görür |
| Görüntüleyici | 15 | 18 | görür |
| Gıda Mühendisi | 12 | 12 | **görmez** |
| Depo Sorumlusu | 11 | 13 | **görmez** |
| Kalite Sorumlusu | 11 | 12 | **görmez** |
| Üretim Sorumlusu | 11 | 10 | **görmez** |
| Sevkiyat Sorumlusu | 9 | 9 | **görmez** |
| Muhasebe | 8 | 9 | görür |
| Operasyon Personeli | 7 | 6 | **görmez** |
| Satın Alma Sorumlusu | 7 | 7 | görür |

**Menüde görünüp açılmayan ekran: her rol için 0.** Menü ile rota aynı
cevabı veriyor.

---

## Rol rol — ne görür, ne yapar, ne YAPAMAZ

### İşletme Sahibi · 20 ekran · 33 izin
Kendi işletmesinde her şey. Kullanıcı açar, rol dağıtır, fiyat ve maliyet
görür, yedek alır.
**Göremediği:** başka işletmelerin verisi, platform ayarları.
⚠️ Müşteri firmasının sahibine verilecek rol **budur** — `admin` değil.

### İşletme Müdürü · 18 ekran · 29 izin
Operasyonun tamamını yürütür, maliyeti görür, sipariş onaylar.
**Sahibinden tam olarak iki ekran eksik:**
- **Kullanıcılar** (`users.manage` yok)
- **Veri ve Yedekleme** (`company.manage` yok)

Şirket Ayarları'nı **görür** ama oradaki yazma ayrı bir kapıdır.
⚠️ **Karar:** yetki dağıtımı ve yedek alma işletme sahibinde kalır.
Bu fark testte **ad ad** donmuş: üçüncü bir ekran eksilirse test kırılır
ve hangi ekran olduğunu adıyla söyler.

### Görüntüleyici · 18 ekran · 15 izin
**Her şeyi görür, hiçbir şeyi değiştiremez.** 15 iznin tamamı okuma.
Denetçi, danışman ve mali müşavir için. ⚠️ **Fiyat ve maliyet dahil** —
mali müşavirin maliyeti görmemesi anlamsız olurdu.

### Depo Sorumlusu · 13 ekran · 11 izin
Kontrol Paneli · Tedarikçiler · Satın Alma Siparişleri · Stok Durumu ·
Stok Sayımları · Fire ve Kayıplar · Reçeteler · İş Emirleri · Etiket ve
Alerjen · Sevkiyatlar · HACCP Kontrolleri · Ürün İzlenebilirliği ·
**Şahit Numune**

Mal kabul eder, sayım yapar, depodan mal çıkarır, sevkiyat yürütür.
**Yapamaz:** fiyat/maliyet görmek, reçete ve etiket beyanı yazmak.
⚠️ **Şahit numuneyi görür ama yazamaz** — numune "depocu kontrolünde"
tutuluyor ama kontrol **fiziksel bir sorumluluktur**, kayıt yetkisi değil.

### Kalite Sorumlusu · 12 ekran · 11 izin
Kontrol Paneli · Stok Durumu · Stok Sayımları · Fire ve Kayıplar ·
Reçeteler · İş Emirleri · Etiket ve Alerjen · Sevkiyatlar · HACCP
Kontrolleri · Ürün İzlenebilirliği · **Şahit Numune** · Değişiklik Kaydı

Kalite kaydı ve HACCP ölçümü girer, geri çağırma başlatır, etiket
beyanını yazar, denetim kaydını okur.
⚠️ **Üretimi ve stoğu yalnız GÖRÜR** — denetleyen, denetlediği veriyi
düzeltemez.

### Gıda Mühendisi · 12 ekran · 12 izin
Kalite Sorumlusu ile aynı ekranlar.
Etiket beyanını (alerjen, besin değeri) ve kalite kaydını yazar.
⚠️ **Reçeteyi DEĞİŞTİREMEZ** (`recipe.write` yok) ve bu en çok sorulan
istisnalardan biri: alerjen reçeteden türetiliyor; beyanı yazan kişi
reçeteye de dokunabilseydi **beyan kendi kendini doğrulardı.**

### Üretim Sorumlusu · 10 ekran · 11 izin
Kontrol Paneli · Stok Durumu · Stok Sayımları · Fire ve Kayıplar ·
Reçeteler · İş Emirleri · Etiket ve Alerjen · HACCP Kontrolleri · Ürün
İzlenebilirliği · **Şahit Numune**

İş emri açar, üretimi yürütür, hammadde düşer, mamul girer, reçete yazar.
**Yapamaz:** etiket beyanı yazmak, satın alma ve finansa erişmek, fiyat
görmek. ⚠️ **Şahit numune alır ve açar, ama imha edemez.**

### Sevkiyat Sorumlusu · 9 ekran · 9 izin
Kontrol Paneli · Stok Durumu · Stok Sayımları · Fire ve Kayıplar · Etiket
ve Alerjen · Sevkiyatlar · HACCP Kontrolleri · Ürün İzlenebilirliği ·
**Şahit Numune**

Sevkiyat yürütür, irsaliye keser, yükleme ölçümü girer, mal çıkışı yazar.
⚠️ **Etiket ve alerjen bilgisini GÖRÜR** — yanlış etiketli mal
yüklenmesin diye. Fiyat görmez.
⚠️ **İSTİSNA (Emrah, 08.11):** şahit numune de **alabilir**. *"Normalde
iş onun olmaz ama alabilsin."* Gerekçe: numune çoğu işletmede sevk
anında alınıyor.

### Muhasebe · 9 ekran · 8 izin
Kontrol Paneli · Analiz · Tedarikçiler · Satın Alma Siparişleri · Stok
Durumu · Stok Sayımları · Fire ve Kayıplar · Şirket Ayarları ·
Değişiklik Kaydı

Kasa, cari, gelir-gider, tedarikçi ödemesi.
⚠️ **Satın almayı ve stoğu GÖRÜR ama mala dokunmaz** — stok hareketi
yazamaz.

### Satın Alma Sorumlusu · 7 ekran · 7 izin
Kontrol Paneli · Analiz · Tedarikçiler · Satın Alma Siparişleri · Stok
Durumu · Stok Sayımları · Fire ve Kayıplar

Talep ve sipariş açar, tedarikçi yönetir, **alış fiyatını görür**.
⚠️ **Depoya mal GİRMEZ** (onu mal kabul yapar) ve üretime karışmaz.

### Operasyon Personeli · 6 ekran · 7 izin
Kontrol Paneli · Stok Durumu · Stok Sayımları · Fire ve Kayıplar ·
Reçeteler · İş Emirleri

Mutfak/depo personeli. Üretim tüketimini düşer, sayım yapar, fire
kaydeder, reçeteye bakar.
⚠️ **MAL KABUL ETMEZ** — o depo sorumlusunun işidir.
**Görmez:** fiyat, tedarikçi, kullanıcı, ayarlar. Sipariş onaylayamaz.
⚠️ **08.11'den beri şahit numuneye de karışmıyor** (göç 0108).

### Platform Sahibi (`admin`) ve Platform Yöneticisi (`super_admin`) · 19 ekran · 35 izin
EVREN360 platformunun tamamı: bütün işletmeler, lisanslar, başvurular.
⚠️ **Bu roller yalnız bizde olur.** Müşteri firmalarının sahiplerine
**verilmez.**

---

## İstisnalar — "neden böyle?" sorusunun cevapları

Hepsi tartışılıp verilmiş karardır, kaza değil.

1. **Şahit numune üç ayrı kapıdır.**
   | İşlem | İzin | Kim |
   |---|---|---|
   | Görmek | `quality.read` | kalite, gıda müh., üretim, **depo**, sevkiyat, müdür, sahip, izleyici |
   | Almak / açmak | `quality.record.manage` **veya** `quality.write` | kalite, gıda müh., üretim, **sevkiyat**, müdür, sahip |
   | **İmha etmek** | yalnız `quality.record.manage` | kalite, gıda müh., müdür, sahip |

   ⚠️ *"Numuneyi siz alabilir ve açabilirsiniz, ama imhayı onlar yazar."*
   Numuneyi alan kişinin onu yok edebilmesi, şahit numunenin anlamını
   bitirirdi.

2. **Gıda mühendisi reçeteye dokunamaz** — beyan kendi kendini
   doğrulamasın diye.

3. **Kalite sorumlusu üretimi ve stoğu yalnız görür** — denetleyen,
   denetlediği veriyi düzeltemez.

4. **Maliyet kapısı raporların da önünde.** `finance.read` olmadan
   işletme göstergeleri ve fire dökümü **sunucudan** reddedilir — ekran
   gizlemekle kalmıyor.

5. **Sipariş açmak ile onaylamak ayrı iki haktır** (`operations.write`
   ve `operations.approve`). Bugün aynı rollerde duruyorlar ama
   ayrılabilir olmaları bilinçli.

6. **Mal kabul personelde değil**, depo sorumlusunda.

7. **Müdür kullanıcı açamaz, rol dağıtamaz.** Operasyonun tamamını
   yürütür; "kim neye yetkili" kararı sahipte kalır.

8. **İzleyici fiyat dahil her şeyi görür, hiçbir şeyi değiştiremez.**

9. **Müşteri sahibine `admin` verilmez** — `isletme_sahibi` alır.

---

## Rol başına tam izin listesi

| Rol | İzinler |
|---|---|
| `admin` / `super_admin` | audit.read, branch.manage, branch.read, company.manage, company.read, dashboard.read, finance.read, finance.write, logistics.read, logistics.write, operations.approve, operations.read, operations.write, personnel.manage, personnel.read, **platform.manage, platform.read**, production.read, production.write, products.read, products.write, purchase.read, purchase.write, quality.declaration, quality.read, quality.record.manage, quality.write, recipe.read, recipe.write, roles.manage, settings.manage, stock.read, stock.write, users.manage, users.read |
| `isletme_sahibi` | Yukarıdakinin aynısı, **`platform.manage` ve `platform.read` HARİÇ** |
| `isletme_muduru` | audit.read, branch.manage, branch.read, company.read, dashboard.read, finance.read, finance.write, logistics.read, logistics.write, operations.approve, operations.read, operations.write, personnel.manage, personnel.read, production.read, production.write, products.read, products.write, purchase.read, purchase.write, quality.declaration, quality.read, quality.record.manage, quality.write, recipe.read, recipe.write, stock.read, stock.write, users.read |
| `izleyici` | audit.read, branch.read, company.read, dashboard.read, finance.read, logistics.read, operations.read, personnel.read, production.read, products.read, purchase.read, quality.read, recipe.read, stock.read, users.read |
| `gida_muhendisi` | audit.read, branch.read, dashboard.read, logistics.read, production.read, products.read, quality.declaration, quality.read, quality.record.manage, quality.write, recipe.read, stock.read |
| `depo_sorumlusu` | branch.read, dashboard.read, logistics.read, logistics.write, production.read, products.read, purchase.read, quality.read, recipe.read, stock.read, stock.write |
| `kalite_sorumlusu` | audit.read, branch.read, dashboard.read, logistics.read, production.read, quality.declaration, quality.read, quality.record.manage, quality.write, recipe.read, stock.read |
| `uretim_sorumlusu` | branch.read, dashboard.read, production.read, production.write, products.read, quality.read, quality.write, recipe.read, recipe.write, stock.read, stock.write |
| `sevkiyat_sorumlusu` | branch.read, dashboard.read, logistics.read, logistics.write, products.read, quality.read, quality.write, stock.read, stock.write |
| `muhasebe` | audit.read, branch.read, company.read, dashboard.read, finance.read, finance.write, purchase.read, stock.read |
| `personel` | dashboard.read, production.read, production.write, products.read, recipe.read, stock.read, stock.write |
| `satinalma_sorumlusu` | branch.read, dashboard.read, finance.read, products.read, purchase.read, purchase.write, stock.read |

---

## Veritabanı yazma kapıları (28 tablo)

Listedeki izinlerden **herhangi biri** yeterlidir.

| Tablo | Gerekli izinlerden biri |
|---|---|
| `customer`, `customer_price`, `delivery_point`, `order_discrepancy`, `portal_user`, `portal_user_point`, `sales_order`, `sales_order_line`, `sales_order_revision` | `operations.write` |
| `driver`, `vehicle` | `logistics.write` |
| `goods_receipt`, `goods_receipt_line`, `supplier_return`, `supplier_return_line` | `purchase.write` · `stock.write` |
| `purchase_order`, `purchase_order_line`, `purchase_request`, `purchase_request_line`, `supplier` | `purchase.write` |
| `haccp_ccp`, `haccp_plan` | `quality.record.manage` |
| `stock_count`, `stock_count_line` | `stock.write` |
| `stock_item_nutrition` | `quality.declaration` · `products.write` · `stock.write` |
| `witness_sample` | `quality.record.manage` · `quality.write` |
| `work_order`, `work_order_line` | `production.write` |

## Okuma kapısı olan tablolar

Çoğu tabloda okuma sınırı **yalnız kiracı duvarıdır** (bir işletme
diğerinin verisini hiçbir koşulda göremez). Aşağıdakilerde okuma ayrıca
**izin** de ister:

| Tablo | Koşul |
|---|---|
| `branch`, `company`, `tenant`, `business_application`, `business_application_event` | `platform.manage` |
| `witness_sample`, `witness_sample_event` | kiracı **VE** `quality.read` |

---

## Satışta söylenebilecek iki cümle

> *"Yetkiler ekranda gizlenmiyor, veritabanında kapatılıyor. Ekranı
> atlayıp doğrudan sisteme istek gönderen biri de aynı cevabı alır."*

> *"Bunu iddia etmiyoruz, ölçüyoruz: 57 ayrı prova gerçek bir veritabanı
> üzerinde, o rolün kimliğine girerek 'bunu yapabiliyor mu' diye soruyor.
> Hepsi her sürümde yeniden koşuyor."*

⚠️ **Söylenmeyecek:** "yapay zeka". Teknik başlık **kural motoru**.

---

# Müşteri şunu sorarsa

Her cevabın altında **neden böyle** yazıyor; satışta asıl ikna eden o.

### "Personelim her şeyi görsün istiyorum, kapatabilir misiniz?"
**Evet, açabiliriz — ama önce şunu konuşalım.** Roller sabit değil;
izinler tablodan yönetiliyor ve bir role izin eklemek bir satırlık iş.
Ancak iki şeyi bilerek kapattık: **maliyet/fiyat** ve **kullanıcı
yönetimi**. Birincisi personelin işine yaramıyor ama ayrıldığında
rakibinize gidiyor; ikincisi de kendine yetki verebilmesi demek.
*"Hangi ekranı göremiyor?"* diye soralım — çoğu zaman tek bir ekran
isteniyor ve onu açmak dakikalar sürüyor.

### "Benim işletmemde depocu da numune alıyor, sizde alamıyor."
**Alabilir, tek satır.** Bu bizim uydurduğumuz bir kural değil,
İsmet'in anlattığı akıştan geldi: numuneyi üretim alıyor, depo
kontrolünde tutuyor. Sizde farklıysa rolün izni değişir.
⚠️ Aynı şeyi **sevkiyat sorumlusu** için zaten yaptık: normalde onun
işi değil ama sevk anında numune alındığı için açtık.

### "Yetkiler gerçekten çalışıyor mu, yoksa sadece menü mü gizleniyor?"
**İşte asıl fark burada.** Çoğu sistemde menü gizlenir, ama adresi
elle yazan ya da sisteme doğrudan istek gönderen geçer. Bizde kapı
**veritabanında**: yetkisi olmayan bir istek, ekran ne derse desin
reddedilir.
Kanıtı: **57 ayrı prova** gerçek bir veritabanında o rolün kimliğine
girerek *"bunu yapabiliyor mu"* diye soruyor ve her sürümde yeniden
koşuyor.

### "Bir müşterinin verisini diğeri görebilir mi?"
**Hayır, ve bu bir ayar değil.** Her tablo satır bazında işletmeye
bağlı; başka işletmenin satırı sorguya **hiç gelmiyor**. Yetkili bir
kullanıcı bile başka işletmenin verisini göremiyor — bu da provalarla
ölçülüyor.

### "Biri bir şeyi sildi/değiştirdi, kim yaptı görebilir miyim?"
**Evet.** Değişiklik Kaydı ekranı var: ne değişti, kim yaptı, ne zaman.
⚠️ **İmza sunucuda atılıyor**, ekranın gönderdiği bilgiyle değil. Yani
"ben yapmadım" diyen biri, kaydı değiştiremez.

### "Şahit numuneyi yanlışlıkla silerse ne olur?"
**Silinemez.** Numune defteri yalnızca eklenebilir; satır silmek ya da
geçmişi değiştirmek kapalı. İmha bile bir **kayıt** olarak yazılıyor ve
imhayı yalnız kalite/müdür onaylayabiliyor — numuneyi alan kişi kendi
numunesini yok edemiyor.

### "Müdürüm kullanıcı açabilsin istiyorum."
**Açılabilir ama düşünün.** Bugün yetki dağıtımı işletme sahibinde;
müdür operasyonun tamamını yürütüyor ama "kim neye yetkili" kararını
veremiyor. Bu, müdür değiştiğinde yetkilerin kontrolsüz dağılmasını
önlüyor. İsterseniz açarız.

### "Mali müşavirim/denetçim girsin ama hiçbir şeyi bozmasın."
**Tam olarak bunun için bir rol var: Görüntüleyici.** 18 ekranı görür,
maliyet ve fiyat dahil her şeyi okur, **hiçbir şeyi değiştiremez** —
15 iznin tamamı okuma.

### "Kaç kullanıcı açabilirim?"
Teknik bir sınır yok; **lisans planı** belirliyor. Rol sayısında sınır
yok — bir kişiye birden fazla rol de verilebilir, yetkiler **birleşir**.

### "Özel bir rol istiyorum, bizim işimize özel."
Roller ve izinler tabloda duruyor; yeni rol tanımlamak mümkün.
⚠️ Bizim önerimiz **önce var olan 13 rolden birini denemek**: çoğu
işletme ihtiyacını bunlarla karşılıyor ve her yeni rol, bakımı gereken
yeni bir kapı demek.

### "Yetkiyi değiştirince ne kadar sürede etkili olur?"
Kullanıcı bir sonraki girişinde. ⚠️ Açık oturum **anında kapanmıyor** —
kritik bir durumda kullanıcıyı pasife almak gerekir.

### "Bir şeyi yapmaya çalışınca ne görüyor?"
**Sebebini söyleyen bir mesaj**, "yetkiniz yok" değil. Örnek:
*"Şahit numune imhası bir ONAY işidir. İşletme müdürü onaylar; müdür
yoksa gıda mühendisi ya da kalite sorumlusu onaylayabilir."*
⚠️ Bu bir tercih: hangi yetkinin eksik olduğunu söylemeyen bir mesaj,
kullanıcıyı da yöneticiyi de çaresiz bırakır.

---

⚠️ **Satışta söylenmeyecek:** "yapay zeka". Teknik başlık **kural
motoru**.

⚠️ **Söz verilmeyecek:** bu belgede olmayan bir yetki davranışı.
Emin değilsen *"bakıp kesin cevabı vereyim"* de — yanlış söz, sonradan
özür gerektirir.
