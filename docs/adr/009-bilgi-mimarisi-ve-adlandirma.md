# ADR-009 · Menü bilgi mimarisi ve adlandırma standardı

**Tarih:** 2026-09-13
**Durum:** Kabul edildi
**Karar veren:** Emrah

---

## Bağlam

Menü, geliştirme sırasında özellik geldikçe uygun görünen yere eklenerek
büyüdü. Görsel olarak düzenliydi ama bilgi mimarisi yoktu:

- `WORKSPACE` / `OPERATIONS` / `BUSINESS` başlıkları **İngilizce**, altındaki
  ögeler Türkçe. Yarım kalmış bir yerelleştirme izlenimi.
- Üst başlıklar **birbirini dışlamıyordu**. Stok neden `BUSINESS`, Satın Alma
  neden `OPERATIONS`? Stok da bir operasyondur. Kullanıcı "aradığımı nerede
  bulurum" sorusunu cevaplayamıyordu.
- Aynı seviyede **farklı soyutlamalar** vardı. Üretim altında: Reçeteler
  (kayıt), İş Emirleri (belge), Sevkiyatlar (belge), İzlenebilirlik
  (yetenek), HACCP (metodoloji).
- Adlar muğlaktı: "Talep ve Sipariş" (hangisi?), "İşlem Geçmişi" (neyin?).
- Tekil/çoğul tutarsızdı: "Depo" ama "Reçeteler".

MİYOP 10 ekranlık bir uygulama değil; 30–50 modüle büyüyecek. Bugünkü menü
o büyüklükte çöker.

---

## Karar

### 1 · Tek dil

Menünün tamamı **Türkçe**. Aynı navigasyon seviyesinde iki dil kullanılmaz.

| Eski | Yeni |
|---|---|
| WORKSPACE | GENEL |
| OPERATIONS | OPERASYON |
| BUSINESS | İŞLETME |
| REPORTS | RAPORLAR |
| SYSTEM | ENTEGRASYONLAR |
| — | YÖNETİM *(yeni)* |

### 2 · Üç seviye, her seviyede kavramsal eşdeğerlik

```
1. seviye · BÖLÜM      → kullanıcının zihnindeki büyük ayrım
2. seviye · DEPARTMAN  → işletmedeki bir birim
3. seviye · EKRAN      → tek bir iş yüzeyi
```

Bir seviyedeki bütün ögeler **aynı türden** olmalı. İkinci seviyede bir
departmanın yanına bir ekran konmaz.

```
GENEL
  Kontrol Paneli
  Modül Mağazası

OPERASYON
  Satın Alma      Tedarikçiler · Satın Alma Siparişleri
  Depo            Stok Durumu · Stok Sayımları · Fire ve Kayıplar
  Üretim          Reçeteler · İş Emirleri · Sevkiyatlar
  Kalite          HACCP Kontrolleri · Ürün İzlenebilirliği

YÖNETİM
  Şirket Ayarları
  Veri ve Yedekleme
  Değişiklik Kaydı
```

**Bölümlerin ayrımı:** GENEL = her sabah açılan yer. OPERASYON = günlük iş.
YÖNETİM = sistemin ve verinin yönetimi. Üçü birbirini dışlıyor.

**Departman sırası malzemenin yolu:** satın al → depola → üret → denetle.
Alfabetik değil; kullanıcının kafasındaki sıra bu.

### 3 · Adlandırma standardı

| Seviye | Kural | Örnek |
|---|---|---|
| Bölüm | BÜYÜK HARF, tekil kavram | OPERASYON |
| Departman | Birim adı, **tekil** | Depo, Üretim, Kalite |
| Ekran (liste) | **Çoğul** | Tedarikçiler, Reçeteler, Stok Sayımları |
| Ekran (tek yüzey) | Tekil, ne olduğunu söyler | Stok Durumu, Kontrol Paneli |

**Ad, ekranın ne yaptığını söylemeli.** Bir metodolojinin ("HACCP") ya da bir
kavramın ("İzlenebilirlik") adı tek başına ekran adı olamaz.

Yapılan değişiklikler:

| Eski | Yeni | Neden |
|---|---|---|
| Talep ve Sipariş | Satın Alma Siparişleri | Hangisi olduğu belirsizdi |
| Depo *(ekran)* | Stok Durumu | Departmanla aynı addı |
| Sayım | Stok Sayımları | Neyin sayımı + çoğul |
| Fire ve Zayi | Fire ve Kayıplar | Hedef kitlenin dili |
| İşlem Geçmişi | Değişiklik Kaydı | "Neyin geçmişi?" cevapsızdı |
| HACCP | HACCP Kontrolleri | Metodoloji ≠ ekran |
| İzlenebilirlik | Ürün İzlenebilirliği | Neyin izlenebilirliği |
| Veri Yedeği | Veri ve Yedekleme | Ekran ikisini de yapıyor |
| Ayarlar | Şirket Ayarları | Profilim ile sınır |

### 4 · Kalite kendi departmanı

HACCP ve İzlenebilirlik Üretim'in altındaydı — çünkü Kalite modülü kiracıda
kapalıydı ve kapalı modüle konan öge menüde hiç üretilmiyor.

Ögeyi taşımak yerine **modül gerçekten açıldı** (`isAlwaysActive`).
Gerekçe: gıda üretiminde kalite isteğe bağlı bir eklenti değildir; HACCP
yasal zorunluluktur. "Kalite modülünü satın almamış gıda fabrikası" olamaz.

İzin ayrımı korunuyor: ögeleri yalnızca `quality.read` izni olan görür
(0015 departman rolleri).

### 5 · Profilim ↔ Şirket Ayarları sahiplik sınırı

Bir ayarın sahibi **kullanıcıysa Profilim**, **şirket/çalışma alanıysa
Şirket Ayarları**. Aynı ayar iki yerde görünmez.

| Profilim | Şirket Ayarları |
|---|---|
| Ad soyad, fotoğraf | Şirket ünvanı, vergi no |
| E-posta, telefon | Çalışma alanı adı, logo |
| Dil tercihi | KDV oranı, para birimi |
| Kişisel bildirim tercihi | Genel bildirim politikası |
| Şifre ve oturum | Kullanıcı ve rol yönetimi |
| — | Numaralandırma / belge ayarları |

Rol ve şube bilgisi Profilim'de **gösterilir ama değiştirilemez** —
sahibi yetkilendirmedir.

### 6 · YÖNETİM bir çöplük değildir

ERP'lerde klasik çöküş: yeri bilinmeyen her özellik "Ayarlar"a atılır.

**Kural:** YÖNETİM'e yalnızca sistemin davranışını değiştiren ya da
işletmenin verisini yöneten ekranlar girer. Yeri bulunamayan bir ekran
buraya atılmaz — doğru yeri bulunana kadar **menüye hiç konmaz**.

Bu yüzden Veri ve Yedekleme, Şirket Ayarları'nın *içinde* değil, *yanında*
duruyor: ayrı bir sorumluluk.

---

## Sonuçlar

**İyi:** Kullanıcı aradığını nerede bulacağını biliyor. Yeni modül geldiğinde
nereye konacağı belli. Adlar ne olduğunu söylüyor.

**Bedel:** Mevcut kullanıcılar alıştıkları adları yeniden öğrenecek. Demo
öncesi yapıldığı için maliyeti düşük.

**Sınır:** Sevkiyatlar bugün Üretim altında. A4B'de araç, şoför ve sefer
gelince **Lojistik** kendi departmanı olacak ve Sevkiyatlar oraya taşınacak.
Bugün tek ekranlık bir departman açmak boş bir başlık üretirdi.

---

## Menü tuzakları — bir öge eklerken

Bir menü ögesinin görünmesi için **dört kapıdan** geçmesi gerekiyor.
Dördü de sessiz: geçemeyen öge hata vermez, sadece yoktur.

1. **Modül dondurulmamış** (`foundationScope !== 'frozen'`)
2. **Modül üretiliyor** — çekirdek, her zaman açık, ya da kiracıda etkin
3. **Çekirdek modülse beyaz listede** (`CORE_WORKSPACE_MODULE_CODES`)
4. **Çekirdek modülse görünürlük kuralından geçiyor**
   (`core-module-visibility.ts`)

Ve bir rota, ancak **menü ögesiyse** var sayılır
(`getCoreWorkspaceRoutes`) — menüden çıkarılan bir ekran açılmaz olur.

`module-route-health.test.ts` bunların hepsini **gerçek menü ağacı
üzerinden** sınıyor. Kayıt dosyasına bakmak yetmiyor: dört kapı da
kayıt dosyasının dışında.
