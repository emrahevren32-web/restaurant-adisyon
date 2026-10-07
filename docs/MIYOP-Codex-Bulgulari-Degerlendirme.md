# CODEX BULGULARI — İLK DEĞERLENDİRME (07.10.2026)

Her bulguyu kodda ve göç dosyalarında kendim kontrol ettim. Üç gruba
ayırdım. **Doğrulanmayanı "doğrulandı" diye yazmadım**; hangisine daha
bakmadığımı da yazdım.

Özet: **Codex ciddi iş çıkarmış.** 19 maddeden şu ana kadar baktığım 11'inin
**7'si gerçek**, 2'si **abartılmış**, 2'si **bugün için geçersiz ama yarın
geçerli olacak**. En kötüsü 10 numara ve **onu düzelttim.**

---

# A · DOĞRULANDI — GERÇEK VE CİDDİ

## ⛔ #10 · İşlemi yapan kullanıcı YANLIŞ kaydediliyor — **DÜZELTİLDİ**

**En kötü bulgu bu ve Codex tam isabet etmiş.**

`warehouse.context.ts` şöyleydi:

```
.from('app_user').select('id').limit(1).maybeSingle()
```

Filtre yok. `app_user` politikası (0001) **kiracı** yalıtımı yapıyor,
**kişi** yalıtımı değil — aynı işletmedeki herkes birbirini görür ve
görmesi de gerekir, yetki ekranı o listeyi basıyor. Yani bu sorgu
**oturumu açan kişiyi değil, sırada ilk geleni** seçiyordu.

Giriş ekranı (`storage.ts`) doğru yapıyor — `auth_user_id` ile eşleştiriyor.
Sonra depo bağlamı o doğru kimliği **atıp rastgele birini alıyordu.**

**Etkisi:** her stok hareketinin, her belgenin, her denetim kaydının
"kim yaptı" alanı yanlış kişiyi gösterebiliyordu.

**Neden en kötüsü bu:** MİYOP'un sattığı şey tam olarak bu alan. *"Kim, ne
zaman, neyi yaptı duruyor"* cümlesi yanlışsa, ürünün vaadi yanlış. Üstelik
yanlış ad, hiç ad olmamasından **kötüdür**: biri suçlanır ve kayıt onu
doğruluyor görünür. Bir denetimde ya da bir fire tartışmasında bunun bedeli
ağırdır.

**Yaptığım düzeltme:** kimlik oturumdan çözülüyor (`auth.getUser()` →
`.eq('auth_user_id', …)`), **çözülemezse işlem yapılmıyor.** Yedeğe düşmek —
ilk kullanıcı, "bilinmeyen", boş kimlik — defteri kirletmenin kibar yoludur.
Ayrıca pasife alınmış kullanıcı için ek kapı koydum: jeton kendi ömrünü
doldurana kadar yaşar, o arada defter yazamasın.

Tek yerde düzeltmek yetti: bu bağlamı altı ekran da (Depo, Sevkiyatlar,
Müşteriler, Siparişler, Etiketler, Kontrol Paneli) aynı fonksiyondan alıyor.

---

## ⛔ #15 · Büyük veride BAKİYE SESSİZCE YANLIŞ

`stock.postgres.ts` → `quantityOf()`:

```
.from('stock_movement').select('quantity_base')...
→ sonra TARAYICIDA topluyor
```

Sayfalama yok. Supabase/PostgREST varsayılan satır sınırı **1000**. Bir
kalemin bir şubedeki hareketi 1000'i aşınca sorgu sessizce kesiliyor ve
**bakiye olduğundan AZ çıkıyor.** Hata yok, uyarı yok.

**Ne zaman vurur:** un gibi bir kalemde günde 3–5 hareket (giriş, üretim
tüketimi, sayım) olağan. 1000 ÷ 4 ≈ **250 gün.** Yani pilot ilk yılı
doldurmadan bakiye bozulur — ve **az** gösterdiği için gereksiz satın alma
tetikler. En kötü tarafı: demoda asla görünmez, çünkü demo verisi küçüktür.

**İyi haber:** doğru yol **zaten var ve kullanılmıyor.** 0003 satır 179'da
`stock_balance` görünümü duruyor. Toplamı veritabanı yapmalı, tarayıcı
değil. Ucuz düzeltme.

---

## ⛔ #5 · İptal edilen giriş maliyeti BOZUYOR

`stock-cost.ts`:

```
const HESABA_GIRMEZ = new Set(['REVERSAL'])
```

Yorumu şöyle: *"Ters kayıt hesaba girmez: kendi karşıt hareketiyle birlikte
okunuyor, ikinci kez saymak değeri iki katına çıkarırdı."*

**Bu akıl yürütme yanlış.** Süzgeç yalnız TERS KAYDI atıyor, **ters
çevirdiği asıl hareketi değil.** Sonuç:

```
100 kg giriş @ 10 TL  → hesap: 100 kg, ortalama 10 TL
İptal (REVERSAL −100) → süzülüp atılıyor
Gerçek stok: 0 kg     → hesap hâlâ: 100 kg @ 10 TL
```

Yorumun dediği doğru olsaydı **ikisinin de** atılması gerekirdi.

**Düzeltmesi temiz:** 0003'te `reverses_movement_id` kolonu zaten var
(satır 96) ve bir hareket yalnız bir kez ters çevrilebiliyor (satır 112).
Yani ters kaydın hangi hareketi iptal ettiği **belli**; ikisini birlikte
atmak yeterli.

⚠️ **Bir test bu yanlış kuralı koruyor.** Onu da değiştirmek gerekecek —
ve bu önemli bir ders: *yeşil test, doğru kural demek değil. Test yanlış
kuralı da ezberleyebilir.*

---

## ⛔ #16 · Kesilmiş irsaliye sonradan DEĞİŞEBİLİR — **benim kararım, yanlıştı**

Bu bulgu doğru ve **bilinçli bir seçimimdi.** 0064'te şöyle yazdım:

> *⚠️ Plaka DONDURULMUYOR (müşteri adının aksine): plaka BİZİM aracımızın
> kimliğidir, join'le okunuyor.*

Codex haklı, ben yanılmışım. Gerekçem şuydu: plaka bizim malımız, kart
değişirse güncel hâli görünsün. **Ama kesilmiş bir irsaliye bir belgedir, bir
ekran değil.** Plaka yanlış girilip sonra düzeltilirse, dün müşteriye
imzalatılan kâğıt bugün başka bir plaka basar. Müşterideki kopya ile bizdeki
kopya tutmaz — ve tartışmada haklı çıkan, kâğıdı elinde tutan taraf olur.

Zaten `musteriAd` için **doğru olanı yapmışız**: karttan kopyalanıp
donduruluyor. Aynı kural plakaya da uygulanmalı: sevk anında kopyala, dondur.

---

## ⛔ #1 · Şube kapsamı yok — **biliyorduk, ama Word'le çelişiyor**

`work_order` politikası (0022, satır 114) yalnız kiracıya bakıyor:

```
using (tenant_id = app.current_tenant_id())
```

Şube yok. Okuma sorgularında da `.eq('branch_id', …)` yok. Yani A şubesi
kullanıcısı B şubesinin iş emrini görür.

**Bunu zaten biliyorduk** — A4B-8 *"Şube / depo kapsamı"* yol haritasında
**boş kutu**. Codex'in asıl isabetli tespiti şu: **A1'de "yetkisiz uç yok"
kutusu İŞARETLİ** ve bu çelişiyor. O kutu tekrar bakılmalı.

---

# B · DOĞRU AMA CODEX'İN SÖYLEDİĞİ KADAR ACİL DEĞİL

## 🔸 #4 · Tekrar deneme güvenilir değil — **veri güvende, kullanıcı rahatsız**

Doğru: aynı anahtarla ikinci istekte `23505` yakalanıp
`DuplicateIdempotencyKeyError` fırlatılıyor; mevcut kayıt döndürülmüyor.

Ama Codex'in *"stok etkisini çoğaltmaz"* kabul ölçütü **zaten
sağlanıyor** — ikinci hareket yazılmıyor, veritabanı kısıtı tutuyor.
Eksik olan, kullanıcının **hata görmesi** yerine **"zaten yapılmış"**
cevabı alması. Bu bir veri bütünlüğü sorunu değil, bir kullanılabilirlik
sorunu. Demo için zararsız, pilot için düzeltilmeli.

## 🔸 #19 · admin platform izni alıyor — **bugün kimse admin değil**

Doğru: 0015 satır 88 `admin` rolüne bütün izinleri veriyor,
`platform.*` dahil. Satır 80'deki yorum bunun **bilinçli** olduğunu
söylüyor.

**Ama bugün sömürülebilir değil:** 0039'da yeni işletmenin kullanıcısı
`isletme_sahibi` rolüyle açılıyor, `admin` ile değil. `admin` yalnız
MİYOP'un kendi platform hesabı. Ayrıca 0015 satır 251 işletme sahibinin
`admin` rolü atamasını zaten engelliyor.

**Yine de:** o yorum *"bugün tek tenant var"* diyor ve bu artık doğru değil —
A4D çok kiracılı kapıyı açtı. Yorumun dayandığı varsayım çürümüş. Satış
öncesi sıkılaştırılmalı, ama **demo engeli değil.**

---

# C · HENÜZ BAKMADIM — dürüst olmak gerekirse

Bunlara bakmadım, dolayısıyla ne doğru ne yanlış diyebilirim:

| # | Konu | Neden önemli |
|---|---|---|
| 2 | İlişkili kayıtların lot/kalem/şube bütünlüğü | Yanlış lotla kayıt açılabiliyorsa izlenebilirlik kopar |
| 3 | Çok adımlı işlem yarım kalabiliyor | Mal kabulde yarım kalma stok ile belgeyi ayırır |
| 6 | Geçmiş üretim maliyeti sonradan değişiyor | Kârlılık raporu geçmişe dönük değişirse güvenilmez |
| 7 | SKT geçmiş lot FEFO'da seçilebiliyor | `fefoSirala` **sıralıyor, süzmüyor** — tüketim yolunu okumam lazım |
| 8 | Kalite kaydı operasyonu engellemiyor | A4B-3 ile aynı kök: HACCP hâlâ örnek veride |
| 9 | Lot seviyesinde eşzamanlı tüketim | 0011 kalem toplamını koruyor; lot toplamına bakmadım |
| 17 | Portal izolasyonu | Kabul testi **yazılı ama hiç koşulmadı** — en ucuz kanıt bu |
| 18 | Portalda lisans kontrolü atlanabilir | Tenant claim'i olmayan oturum lisans kilidinden muaf olabilir |

---

# D · AYRI BİR MESELE — #11, #12, #13

Bunlar **kod hatası değil, KAPSAM kararı.** Ve bence raporun en önemli
kısmı burası.

Codex şunu söylüyor: eski katmandaki ekranlar (KPI, AI analizi, bazı
yönetim ekranları) **localStorage ve örnek veri** kullanıyor; AI ekranları
sabit katsayılarla *"şu kadar tasarruf"* hesaplıyor ve bu **ölçülmüş bir
tasarruf değil.**

Bunu kod olarak düzeltmiyoruz — zaten dondurulmuş katman (ADR-002). Ama
demo vaadinle doğrudan çakışıyor:

> *"Menüde gördüğünüz her şey çalışıyor. Size 'bu kısım yakında gelecek'
> diyeceğim tek bir ekran yok."*

Bu cümleyi söyleyebilmek için **menüde görünen her yolun** gerçek defterden
beslendiğini doğrulamış olmak gerekir. Bugün bu doğru değil.

**İki seçenek var, üçüncüsü yok:**

- **(a) Menüyü demoya göre daralt.** Gerçek defterden beslenen ekranlar
  menüde kalır, ötekiler demo kiracısında kapalı gelir. Kod silinmez.
  Cümleyi söyleyebilirsin.
- **(b) Cümleyi değiştir.** *"Bu ekranlar çalışıyor, şunlar yol haritasında"*
  dersin. Dürüst ama zayıf — ve "yakında gelecek" demeyeceğim iddian gider.

⚠️ Özellikle **AI tasarruf rakamları**: müşteriye *"size yılda şu kadar
kazandırır"* diyen bir ekran, altındaki sayı uydurma katsayıysa, satışın
en kırılgan yeri olur. Pilot müşteri bir yıl sonra o rakamı sorar.
**Tavsiyem: o ekranlar demo kapsamında açılmasın.**

---

# E · SIRA ÖNERİM

**Şimdi, demo öncesi (hepsi ucuz):**

1. ~~#10 işlemi yapan kullanıcı~~ **BİTTİ**
2. **#15 bakiyeyi `stock_balance` görünümünden oku** — görünüm zaten var
3. **#5 ters kayıt + iptal ettiği hareket birlikte atılsın** — yanlış testi de düzelt
4. **#16 plaka ve şoförü sevk anında dondur** — `musteriAd` ile aynı kalıp
5. **#17 izolasyon kabul testini KOŞ** — yazılı, koşulmamış; en ucuz kanıt

**Sonra (daha büyük, hâlâ demo öncesi):**

6. **C listesini bitir** — 2, 3, 6, 7, 9, 18'e bak
7. **#12/#13 kapsam kararı** — menüde ne kalacak (**senin kararın**)

**Demo sonrası:** #1/A4B-8 şube kapsamı · #4 tekrar deneme · #19 admin izni

---

# F · BENİM ÇIKARDIĞIM DERS

Codex'in bulduğu 10 ve 5 numara **benim gözümden kaçmıştı** ve ikisi de
aynı türden: **testler yeşildi.** 5 numarada test yanlış kuralı
koruyordu; 10 numarada hiç test yoktu çünkü bağlam kurulumu "altyapı"
sayılıp sınanmamıştı.

İkinci göz gerçekten gerekliymiş. Rapor doğru okunmuş, abartı az, ve
en kritik iki maddeyi bulmuş.
