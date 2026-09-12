# MİYOP · Demo Senaryoları

> Bu belge iki işe yarar:
> 1. **Zincir** — sistemin halkalarını ve her halkanın hangi soruyu cevapladığını gösterir.
> 2. **Senaryolar** — o zinciri baştan sona canlı sergileyen, adım adım yazılmış demolar.
>
> Demoda ekran gezdirilmez, **hikâye anlatılır**. Sıra önemlidir: her adım bir
> öncekinin doğal cevabıdır.

---

## 1 · Zincir

Kağıtla çalışan bir işletmede bu bilgilerin hepsi vardır — ama **insanların
kafasında** ve dağınık defterlerde. MİYOP'un sattığı şey ekran değil, bu zincirin
kendisi: her halka bir öncekine bağlı ve hiçbiri kopmuyor.

| # | Halka | Cevapladığı soru | Ekran | Durum |
|---|---|---|---|---|
| 1 | **Stok kalemi** | Neyi takip ediyoruz? Birimi ne, lot izliyor mu, en az kaç olmalı? | Depo | ✅ |
| 2 | **Uyarı** | Bugün neye bakmam gerekiyor? Ne bitiyor, neyin SKT'si yaklaşıyor? | Depo | ✅ |
| 3 | **Tedarikçi** | Kimden alıyoruz? Sorun çıkarsa kimi arayacağız? | Tedarikçiler | ✅ |
| 4 | **Talep** | Kim, neye, ne zamana ihtiyaç duyuyor? | Talep ve Sipariş | ✅ |
| 5 | **Onay** | Bu harcamayı kim onayladı? Reddedildiyse neden? | Talep ve Sipariş | ✅ |
| 6 | **Sipariş** | Kimden, kaça, ne zaman geleceğine söz verildi? | Talep ve Sipariş | ✅ |
| 7 | **Mal kabul** | Ne zaman, hangi irsaliyeyle, ne kadarı geldi? Ne reddedildi, neden? | Talep ve Sipariş | ✅ |
| 8 | **Lot / parti** | Bu mal hangi partiden? SKT'si ne? | Depo | ✅ |
| 9 | **Stok hareketi** | Bugünkü rakam nereden geldi? Her artış ve azalış nereye bağlı? | Depo | ✅ |
| 10 | Üretim tüketimi | Bu parti hangi üretime girdi? | — | Aşama 3 |
| 11 | Mamul lotu | Üretilen mamulün içinde hangi partiler var? | — | Aşama 3 |
| 12 | Sevkiyat | Bu parti hangi müşteriye gitti? | — | Aşama 3 |
| 13 | **Geri çağırma** | Bir sorun çıktı: hangi partiler, kime gitti? | — | Aşama 3 |

**Bugün 1–9 arası ayakta.** Demo bu dokuz halkayı uçtan uca gösterebiliyor.
10–13 Aşama 3'te gelecek ve zinciri kapatacak.

### "Mal zaten depoya kendi düştü" — hayır, düşmedi

Demoda **kesin gelecek** bir soru bu, o yüzden cevabı burada duruyor.

**Sipariş vermek ≠ mal gelmek.** Sipariş, tedarikçiye verilen bir söz: "200 lahana
göndereceksin." Sistem o an hiçbir stok yazmaz — çünkü depoda henüz lahana yoktur.
Mal kabul, kapıda birinin **fiilen ne geldiğini** onayladığı andır.

Aradaki fark her gün yaşanan şeydir:

| Sipariş diyor ki | Kapıda gerçekte olan | Sistem hangisini yazmalı? |
|---|---|---|
| 200 lahana | 180 geldi, 20'si çürük | **180** |
| 200 lahana | Hiç gelmedi, kamyon bozuldu | **0** |
| 200 lahana | 200 geldi ama SKT'si 3 gün | 200 — ve SKT uyarısı |

Mal kabul adımı olmasaydı sistem 200 yazardı ve **depoda olmayan 20 lahanayı
varmış gibi gösterirdi.** Üretim planı ona göre yapılır, gün ortasında mal biter.

Mal kabulün kaydettiği ve başka hiçbir yerde bulunmayan dört bilgi:

1. **Ne zaman geldi** — sipariş tarihi değil, teslim tarihi
2. **Hangi irsaliyeyle** — bir uyuşmazlıkta aranacak ilk belge
3. **Hangi parti (lot) ve SKT** — geri çağırma bu bağa dayanır
4. **Ne reddedildi ve neden** — tedarikçiyle konuşurken elindeki tek şey

### İki giriş yolu, iki ayrı iş

Depo ekranındaki **Elle Giriş** ile Satın Alma'daki **Mal Kabul** aynı şey değildir:

| | Satın Alma → **Mal Kabul** | Depo → **Elle Giriş** |
|---|---|---|
| Arkasında sipariş | **Var** | Yok |
| Tedarikçi ve irsaliye | Kayıtlı | Yok |
| Siparişin kalanını düşürür | **Evet** | Hayır |
| Ne zaman kullanılır | Sipariş verilmiş mal geldiğinde | Açılış devri, numune, acil alım |

Günlük iş **her zaman** Satın Alma tarafından yürür. Elle Giriş, sisteme ilk kez
geçerken eldeki stoğu girmek gibi istisnalar içindir.

> Bu ayrım ekranda da yapıldı: Depo'daki düğme önceden "Mal Kabul" adını
> taşıyordu ve ikisi karışıyordu. Aynı ada sahip iki yol, kullanıcıya "hangisini
> kullanacağım" sorusunu sordurur — ve yanlış seçilen yol siparişi açık bırakır.

### Zincirin tek kuralı

Ekranda gördüğünüz **hiçbir miktar saklanmıyor.** Depo ekranındaki "180 adet"
bir alanda yazmıyor; onu oluşturan hareketlerin toplamı. Bu yüzden:

- Yanlış olması için birinin **hareket girmesi** gerekir — unutması yetmez.
- "Nereden geldi" sorusunun cevabı her zaman bir tık uzakta.
- Uyarılar da aynı yerden doğuyor: mal girince kendiliğinden kayboluyorlar.

Kağıttan gelen bir müşteriye anlatılacak cümle budur:
**"Bu ürün size ekran satmıyor, hafıza satıyor."**

---

## 2 · Senaryo 1 — "Lahana bitiyor"

**Süre:** ~6 dakika · **Kapsam:** zincirin 1–9 arası halkaları
**Anlattığı şey:** bir uyarıdan başlayıp, malın depoya girmesi ve uyarının
kendiliğinden kaybolmasıyla biten tam bir tur.

> **Demo öncesi hazırlık:** Lahana kaleminin bakiyesi 0, en az seviyesi 55 olmalı;
> yani ekran açıldığında uyarı zaten görünüyor olmalı. En az bir aktif tedarikçi
> bulunmalı.

### Adım adım

| # | Ne yapılır | Ekranda ne olmalı | Söylenecek cümle |
|---|---|---|---|
| 1 | **Depo** ekranı açılır | Tepede mavi uyarı: *"2 kalem en az seviyenin altında"* · lahana · 0 adet (en az 55) | "Sabah ekranı açtığınızda size 'her şey' listelenmiyor. Bugün ne yapmanız gerektiği yazıyor." |
| 2 | Uyarıdaki **lahana** yazısına tıklanır | Kalem seçilir; sağda *"Bu kalemin defterinde henüz hareket yok, bu yüzden bakiye 0"* | "Sıfır olduğunu söylemiyor sadece — neden sıfır olduğunu da söylüyor." |
| 3 | **Satın Alma → Talep ve Sipariş** · Yeni Talep | Talep no kendiliğinden gelir (SAT-…). Lahana seçilir, **200 adet**, gereken tarih girilir | "Mutfak 'lahana lazım' diyor. Tedarikçi ve fiyat sormuyoruz — mutfak bunları bilmez." |
| 4 | **Onaya gönder** | Durum: *Onay bekliyor* | "Taslak talep kimseye görünmez. Onaya gönderildiği an yöneticinin listesine düşer." |
| 5 | **Reddet** denenir, gerekçe boş bırakılır | Reddedilmez: *"Reddetme gerekçesi zorunludur."* | "Gerekçesiz ret, aynı talebin bir hafta sonra aynı şekilde tekrar açılması demektir." |
| 6 | **Onayla** | Durum: *Onaylandı*, "Siparişe dönüştür" düğmesi çıkar | "Onay bir imzadır. Kimin attığı ve ne zaman attığı kayıtlı." |
| 7 | **Siparişe dönüştür** | Kalem ve miktar **kilitli** gelir. Tedarikçi seçilir, birim fiyat girilir, toplam anında hesaplanır | "Burada değiştirilebilir olsaydı onay anlamını yitirirdi: yönetici 200 onaylar, sipariş 2000 giderdi." |
| 8 | Fiyat **boş bırakılıp** "Tedarikçiye gönder" denenir | Engellenir: *"Fiyatı girilmemiş kalem var."* | "Fiyatsız alım, o malın maliyetini sıfır gösterir. Sonra 'bu yemeğin maliyeti ne' sorusu yanlış cevaplanır." |
| 9 | Fiyat girilir, **Tedarikçiye gönder** | Durum: *Gönderildi* | "Artık bir taahhüt var. Sistem malı bekliyor." |
| 10 | Sipariş açılır → **Mal Kabul Yap** | Form, **kalan miktarla** dolu gelir (200) | "Sipariş miktarıyla dolsaydı, ikinci sevkiyatta fazladan kabule giden en kısa yol olurdu." |
| 11 | **180 kabul, 20 ret** yazılır; ret gerekçesi: *"Dış yaprakları çürük"*. Lot no ve SKT girilir. İrsaliye no yazılır | Kaydedilir; *"MK-… işlendi"* | "Kapıda tartıldı. 180'i alındı, 20'si geri çevrildi — ve neden çevrildiği yazılı." |
| 12 | **Mal Kabul** sekmesindeki kayıt açılır | Satırda *Deftere: **yazıldı*** rozeti | "Bu belge stok değil. Stoğun kendisi defterde; bu rozet ikisinin bağlı olduğunu söylüyor." |
| 13 | **Siparişler** sekmesi | Durum: **Kısmen teslim** · satırda Gelen 180, Kalan 20 | "Sipariş kapanmadı çünkü mal tam gelmedi. Bunu kimse elle seçmedi — hesap böyle söyledi." |
| 14 | **Depo** ekranına dönülür | ① Lahana **180 adet** ② Kritik uyarısından **lahana çıktı** ③ Lot listesinde yeni lot ve SKT | "Kimse hiçbir yeri güncellemedi. Rakam da uyarı da aynı defterden okunuyor." |
| 15 | Lahana miktarına (**180**) tıklanır | Hareket listesi açılır: *+180 · Mal kabul · MK-… · İrsaliye … · Sipariş …* | "İşte cevap. 'Bu 180 nereden geldi?' — bir tık." |

### Bu senaryonun kapattığı satış itirazları

| Müşteri der ki | Senaryonun cevabı |
|---|---|
| "Bizde zaten Excel var" | Excel'de 15. adım yok. Rakamın nereden geldiğini kimse bilmiyor. |
| "Personel girmeyi unutur" | Uyarı listesi unutulanı gösteriyor; rakam da uyarı da aynı yerden doğuyor. |
| "Bir sorun çıkarsa ne olacak" | Lot, tedarikçi, irsaliye ve tarih tek satırda bağlı. (Tam cevap Aşama 3'te.) |
| "Fazla mal alıyoruz / az kalıyor" | En az seviye ve kalan miktar ekranda; talep de oradan doğuyor. |

---

## 3 · Sıradaki senaryolar (taslak)

| # | Senaryo | Anlattığı şey | Gerektirdiği aşama |
|---|---|---|---|
| 2 | **"SKT'si yaklaşan mal"** | FEFO: en yakın SKT'li parti önce tüketilir; uyarı, çıkış, uyarının susması | Bugün yapılabilir |
| 3 | **"İki sevkiyatta gelen sipariş"** | Kısmi teslim, kalan miktarın takibi, siparişin ikinci kabulle kapanması | Bugün yapılabilir |
| 4 | **"Kağıttan sisteme 20 dakikada"** | Excel'den stok kartı ve tedarikçi içe aktarma | Aşama 2 · Excel maddesi |
| 5 | **"Bu mamulün içinde ne var"** | Üretim tüketimi, mamul lotu, lot soyağacı | Aşama 3 |
| 6 | **"Geri çağırma"** | Rastgele bir lot numarasından etkilenen tüm sevkiyatlar ve müşteriler | Aşama 3 · en güçlü senaryo |

---

## 4 · Demo kuralları

1. **Boş ekran gösterme.** Her senaryo, verinin hazır olduğu bir noktadan başlar.
2. **Hata ekranını KORKMADAN göster.** 5. ve 8. adımlar bilinçli olarak
   senaryodadır: ürünün neyi engellediğini görmek, neyi yaptığını görmekten daha
   ikna edicidir.
3. **Rakama tıkla.** Her fırsatta. Ürünün tek büyük iddiası orada.
4. **"Yakında gelecek" deme.** Menüde görünen her şey çalışıyor olmalı; çalışmayan
   varsa demo hesabında menüden kaldırılır.
5. **Birimlere dikkat.** Demo verisinde "34 g mercimek" gibi satırlar tuhaf durur.
   Gerçekçi miktarlar kullan.
