# Geri arama formu · ana ekrandaki satış kapısı

> **Karar:** Emrah, 06.11.2026 —
> *"MİYOP ana ekranında 'Geri arama talebi formu' olmalı. Bilgi isteyenleri
> arayabileceğimiz bir form doldursunlar."*
>
> Göç: `db/migrations/0106_geri_arama_talebi.sql`
> Prova: `db/prova/prova-0106.sql` · **69 doğrulama, gerçek PostgreSQL**

---

## 1 · Neden

Ana ekranda bugüne kadar **tek kapı** vardı: *İşletme Başvurusu*.

O form 14 alan istiyor — vergi dairesi, adres, şube sayısı, personel
sayısı — ve anlamı şudur: **"ben MİYOP'u almaya karar verdim."**

Oysa ilk temas çoğu zaman şöyle başlar: *"bu ne, kaça, bize uyar mı?"*
O kişi 14 alan doldurmaz. Sayfayı kapatır ve bir daha gelmez.

Yeni form **beş alan**: ad soyad · telefon · işletme adı · uygun arama
saati · kısa not. Dördüncüsü seçmeli, beşincisi isteğe bağlı.

## 2 · Emrah'ın verdiği üç cevap

| Soru | Cevap |
|---|---|
| Alanlar yeterli mi? | *"tam iyi"* |
| KVKK metni? | *"kısa bir taslak yaz"* (hukukçuya gösterilecek) |
| Formun yanında telefon görünsün mü? | *"şimdilik yazmasın ama admin panelimde orası için telefon numarası girebileceğim yer olsun"* |

Üçüncüsü **bayrakla değil veriyle** kuruldu: `platform_contact.public_phone`
boşsa ana ekranda hiçbir şey görünmüyor; yazıldığı an görünüyor. Ayrı bir
"göster/gizle" düğmesi ikinci bir gerçeklik yaratırdı.

## 3 · Nerede duruyor

| Katman | Yer |
|---|---|
| Form (müşterinin gördüğü) | `src/pages/GeriAramaFormu.tsx` → ana ekranın içinde, `#geri-arama` |
| Kurallar | `src/onboarding/geri-arama.service.ts` |
| Veritabanı erişimi | `src/onboarding/geri-arama.repository.ts` |
| Panel ekranı | `src/pages/GeriAramaTalepleri.tsx` → EVREN360 · Müşteriler |
| Tablolar ve kapılar | göç `0106` |

**Ayrı sayfa DEĞİL.** Başvuru `/apply`e gidiyor; bu form aynı sayfada
duruyor. Bilgi isteyen birini, en kararsız anında, bir tıklama daha uzağa
göndermek onu kaybetmektir. Üst menüdeki *Sizi Arayalım* bağlantısı ve
kahramandaki düğme sayfayı o bölüme kaydırıyor.

## 4 · Kapılar

```
ziyaretçi (oturum YOK)
   └── public.geri_arama_gonder(...)      ← anon çağırabilir
   └── public.platform_iletisim_oku()     ← anon çağırabilir (numara görünsün)

platform yöneticisi (platform.manage)
   ├── public.geri_arama_listesi()
   ├── public.geri_arama_durumu_yaz(...)
   ├── public.geri_arama_sil(...)         ← KVKK silme hakkı
   └── public.platform_iletisim_yaz(...)
```

⚠️ **Tabloya doğrudan yetki YOK.** `anon` ve `authenticated` rollerine
`callback_request` ve `platform_contact` üzerinde hiçbir DML yetkisi
verilmedi, RLS açık ve **hiç politika yok** — yani hiçbir satır geçmiyor.
Erişimin tek yolu yukarıdaki fonksiyonlar. Bu, 0033'ün dersinin tekrarı:
fonksiyon, yazılmaması gereken alanı **parametre olarak bile** almıyor.

⚠️ `app.izin_gerek(...)` tetiği **yok ve olmamalı**: tetik açık bir yazma
yüzeyini kapatmak içindir, burada kapatılacak yüzey yok. (0088'in ölçüsü
*"role açık ama kapısız tablo"* idi; bu tablolar role hiç açık değil.)

## 5 · KVKK

**Metin taslaktır ve hukukçuya gösterilmelidir.** Yazılı hâli
`src/onboarding/geri-arama.service.ts` → `KVKK_AYDINLATMA_METNI`.

Üç karar:

1. **Onay bir kutu değil, bir kolon.** `consent_at` **NOT NULL** — onaysız
   kayıt fiziken oluşamıyor. Ekrandaki kutu atlanabilir, kolon atlanamaz.
   Onay kontrolü sunucudaki fonksiyonun **ilk satırı**: doğrulama da bir
   işlemedir, onay yoksa hiçbir kişisel veriye dokunulmuyor.

2. **Metin saklama süresi vaat ETMİYOR.** *"12 ay sonra silinir"* demek
   için kendiliğinden silen bir iş (cron) kurulu olmalı; **kurulu değil.**
   Tutulmayacak bir söz yerine **tutulan** söz yazıldı: *"silmemizi ya da
   düzeltmemizi istediğinizde bunu yapıyoruz."*
   Karşılığı var: `public.geri_arama_sil(...)` ve panelde **Kaydı sil
   (KVKK)** düğmesi. Söz bir fonksiyona bağlı, bir niyete değil.

3. **Onay verilen metin ile gösterilen metin ayrışamaz.** Sürümün sonundaki
   sekiz hane, gösterilen metnin md5 özeti. Metin değişip sürüm değişmezse
   `geri-arama-kapisi.arch.test.ts` kırılıyor ve yeni sürümü adıyla
   söylüyor. Sürümü **istemci göndermiyor** — parametresi bile yok;
   damgayı sunucu atıyor. Göndermiş olsaydı kayıt, kişinin hiç görmediği
   bir metne onay verdiğini söyleyebilirdi.

## 6 · Spam · ne var, ne YOK

**Var (sunucuda):**
- Aynı numaradan **açık (NEW) talep** varsa ikincisi reddediliyor (MI409).
- Aynı numaradan **24 saatte en çok üç** talep (MI429).
- Telefon **veritabanında** sadeleşiyor (`0532 123 45 67`, `+90 532
  1234567`, `5321234567` → `5321234567`). ⚠️ Bu, yukarıdaki iki kapının
  **ön koşulu**: sadeleşme olmasa aynı numaranın üç yazımı üç ayrı numara
  sayılır ve kapılar kâğıt üstünde kalır.

**YOK ve yazılı:**
- **IP sınırı yok.** PostgREST başlıkları okunabiliyor ama
  `x-forwarded-for` sahtedir; ona güvenmek bir koruma **sanılırdı**.
  Söylenmeyen sınır, yanlış sanılan sınırdan iyidir.
- **CAPTCHA yok.**

## 7 · İz · "kim aradı" yazılmıyor, yazılıyor

İmzayı **sunucu** atıyor (0087'nin kuralı): `geri_arama_durumu_yaz`
fonksiyonunun **kişi parametresi yok**. Kim aradığı
`app.aktif_kullanici_id()`den geliyor; ilk aramanın imzası bir daha
değişmiyor.

Not **birikiyor**: her durum değişikliği `contact_note`a bir satır ekliyor,
üstüne yazmıyor. Olay tablosu açmadan geçmişi tutmanın yolu bu.

**Kapatmak gerekçe istiyor.** Not boşsa sunucu reddediyor — boş kapanış,
kapanmamış bir talepten kötüdür: liste temiz görünür, yapılan iş kayıtsız
kalır.

## 8 · Bu tablo kiracıya ait DEĞİL

Talebi bırakan kişinin henüz bir kiracısı yok. Sonuçları:

- `tenant_id` kolonu **yok**; RLS kiracıya göre süzmüyor.
- **Kiracı yedeğine girmiyor** (`tenant-export`): işletmenin verisi değil,
  MİYOP'un satış verisi.
- **`audit_log`a (Değişiklik Kaydı) girmiyor** — o defter kiracıya bağlı
  (`audit_log.tenant_id`) ve kiracısız bir satır oraya yazılamaz.
  ⚠️ Bu bir ihmal değil, ölçülmüş bir karar. İz tablonun kendi içinde:
  `contacted_at`, `contacted_by`, biriken `contact_note`, `updated_*`.

## 9 · Bilinen eksikler (yazılı, gizli değil)

| Eksik | Neden şimdi yok |
|---|---|
| **Yeni talep gelince zil/bildirim yok** | Panelde görünüyor ama Emrah ekranı açmadıkça haberi olmuyor. `basvuru_bildirimi` deseni var; aynısı kurulabilir → HEDEFLER 4.11.1 |
| **Otomatik KVKK silme yok** | Kapanmış talep elle silinene kadar duruyor. Metin bu yüzden süre vaat etmiyor → HEDEFLER 4.11.2 |
| **"24 saat içinde ararız" sözü yok** | Böyle bir taahhüdü tutacak bir düzen (nöbet/vardiya) yok. Olmayan bir sözü vermek, hiç söz vermemekten kötüdür. |
| **Yeni CSS yazılmadı** | `styles.css` 1,4 MB; form var olan sınıfları (`unified-login-*`, `form-field`, `card`, `table-wrap`) kullanıyor. Görüntü Emrah'ta bakılıp gerekirse ayrı turda rötuş yapılacak. |

## 10 · Üç katman, üç ayrı kanıt

| Dosya | Ne kanıtlıyor |
|---|---|
| `src/onboarding/geri-arama.test.ts` | Kuralların davranışı (saf fonksiyonlar + bellek defteri) |
| `src/onboarding/geri-arama-kapisi.arch.test.ts` | Sözleşme: göç metni ↔ kod sabitleri ayrışmıyor |
| `db/prova/prova-0106.sql` | **Kapı**: gerçek PostgreSQL, `anon` ve `authenticated` rollerine girilerek, 69 doğrulama |

Hiçbiri ötekinin yerine geçmiyor. İlk ikisi **metin okur**, davranış
ölçmez; kapının kilitlediğini yalnız prova gösterir.

⚠️ **Tuzak 189 bu turda doğdu:** prova ilk hâlinde iki yerde kırmızı verdi
ve kırmızı, kapının **çalıştığını** gösteriyordu — iddialar bilerek kapalı
bir fonksiyonu ve tabloyu, istemci rolünü takmışken okumaya çalışıyordu.
"Provayı yeşile çevirmek" için yapılacak en kolay şey, tam da korumaya
çalışılan yetkiyi açmaktı. Kapılara dokunulmadı; iddialar rolün dışına
taşındı.
