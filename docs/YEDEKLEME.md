# MİYOP · YEDEKLEME

> ⚠️ Bu dosya **30.10.2026'da yazıldı** ve yazılma sebebi bir eksikti:
> kod üç ayrı yerden (`src/pages/Settings.tsx`, `src/tenant-export/tenant-export.ts`
> iki yerde) *"ayrıntısı `docs/YEDEKLEME.md`'de"* diyordu — **ve o dosya yoktu.**
> Kodun "orada yazıyor" dediği şey yazmıyordu.

---

## 1 · Üç ayrı şey var, üçü karıştırılmasın

| Ne | Nerede | Kim alır | Ne işe yarar |
|---|---|---|---|
| **Veritabanı yedeği** | Supabase (Postgres) → senin diskine | `araclar\yedek-al.ps1` | İş verisinin tek gerçek yedeği |
| **Arayüz yedeği** | Sunucuda `/var/www/miyop.yedek-*` | `miyop-yukle.ps1` kendisi | Kötü dağıtımdan **hızlı** dönüş |
| **Müşterinin kendi dışa aktarımı** | Ayarlar → Veri ve Yedekleme | Müşteri | Müşteri kendi verisini Excel olarak indirir |

Üçü **birbirinin yerine geçmez.** Sunucudaki klasörlerde tek satır iş verisi
yoktur; müşterinin Excel dosyası da geri yüklenebilir bir yedek değildir.

---

## 2 · ⚠️ Supabase FREE planında otomatik yedek YOK

Ölçüldü (30.10.2026, Supabase'in kendi belgesi):

- *"Automatic backups — **Not included in free**"* · zamanda geri alma (PITR) de yok.
- Supabase'in tavsiyesi: *"We recommend that free tier plan projects regularly
  export their data using the Supabase CLI `db dump` command and maintain
  **off-site** backups."*
- **Pro: $25/ay** → günlük yedek, 7 gün saklanır.
- Ve: *"Free projects are **paused after 1 week of inactivity**."*

**Karar (Emrah, 30.10.2026):** Pro **ilk müşteriden sonra.**
> *"pro için erken, ilk müşteri ile anlaşalım o zaman yedekler konusunda
> bakarız. 25 dolar az değil şimdi.. bizde asgari ücretli adamız, yatırım
> için önce alıcı bulmak, pazarı bilmek gerek."*

Bu karar **yedeksiz kalmak demek değil** — `yedek-al.ps1` o yüzden var.
Ama ücretli planın verdiği iki şeyi vermiyor: **otomatik** olması ve
**duraklamama** garantisi. İkisi de yazılı borçtur.

---

## 3 · Yedek nasıl alınır

Bir kerelik kurulum:

```powershell
npm install supabase --save-dev
npx supabase login
npx supabase link --project-ref <proje-referansı>
```

⚠️ `link` komutu **veritabanı parolasını sorar.** Parolayı **sen** yazarsın.
Ne bu doküman, ne `yedek-al.ps1`, ne de başka bir betik parolayı ister,
yazar veya saklar.

Sonra her seferinde:

```powershell
cd C:\Users\90544\Documents\restaurant-adisyon
.\araclar\yedek-al.ps1
```

Dosyalar `F:\MIYOP_BACKUP\veritabani\<tarih-saat>\` altına yazılır
(F: yoksa `%USERPROFILE%\MIYOP-Yedek\`).

### Neden ÜÇ dosya

`supabase db dump` **varsayılan hâliyle veriyi almaz.** Belgenin kendi
cümlesi: *"The default dump does not contain any data or custom roles."*

| Dosya | Komut | İçinde |
|---|---|---|
| `sema.sql` | `db dump --linked` | Tablolar, kısıtlar, tetikleyiciler, fonksiyonlar |
| `veri.sql` | `--data-only --use-copy` | **Stok, sipariş, HACCP, denetim defteri** |
| `roller.sql` | `--role-only` | Veritabanı rolleri |

⚠️ Yalnız birincisi alınsaydı elimizde **tablo tanımları olur, içlerinde tek
satır veri olmazdı.** O dosyaya bakıp "yedeğim var" demek, 13.09.2026'da
menüden kaldırılan eski "Yedekleme" düğmesinin yaptığı şeyin aynısıdır:
o da tarayıcı hafızasını yedekliyordu, iş verisini değil.

### Betik kendi çıktısını DENETLER

Dosyanın oluşması, içinde veri olduğu anlamına gelmez. `yedek-al.ps1`
bitmeden önce şunları ölçer ve **geçmezse "alındı" DEMEZ**:

- Şema dosyası var ve beklenenden küçük değil
- Veri dosyasında **en az bir `COPY` / `INSERT INTO` satırı** var
- Denetim defteri (`audit_log`) dökümde görünüyor

---

## 4 · ⚠️ Bu yedeğin KAPSAMADIKLARI

### 4.1 Giriş hesapları YOK
Supabase belgesi: *"The ignored schemas include `auth`, `storage`, and those
created by extensions."* Yani `auth.users` — kimin hangi e-posta/kullanıcı
adıyla girdiği — **bu dosyalarda değil.** Geri yüklemede iş verisi döner,
**kullanıcıların yeniden açılması/davet edilmesi gerekir.**
`public.app_user` satırları döner ama onların bağlı olduğu Auth kayıtları dönmez.

### 4.2 Yüklenen dosyalar (Storage) YOK
Veritabanı dökümü Storage nesnelerini içermez, yalnız üstverisini içerir.

### 4.3 Sunucu yapılandırması YOK
nginx, sertifika, Edge Function'lar bu dökümde değil. Edge Function'ların
kaynağı **git'te** (`supabase/functions/`), panele elle dağıtılıyor.

### 4.4 Bu bir felaket kurtarma planı DEĞİL
Dışarı alınmış bir kopyadır. Kaç saatlik veri kaybını göze aldığımız
(RPO) yazılı bir karar değil — **yedek ne sıklıkta alınırsa o kadar.**

---

## 5 · Ne sıklıkta

| Ne zaman | Neden |
|---|---|
| **Her göç öncesi** | Göç veriyi dönüştürüyorsa geri dönülecek nokta |
| **Demodan önce** | Demo verisi hazırlandıktan sonra |
| **İlk müşteri girdikten sonra: haftada bir** | Asgari |

⚠️ Şu an **otomatik değil**: elle çalıştırılır. Unutulursa yedek yoktur.
Otomatik hâle getirmek (Görev Zamanlayıcı) yazılı bir borçtur.

---

## 6 · Geri yükleme

### 6.1 Arayüz (hızlı, risksiz)
`miyop-yukle.ps1` her dağıtımın sonunda tek satırlık dönüş komutunu yazar:

```
rm -rf /var/www/miyop && mv /var/www/miyop.yedek-<damga> /var/www/miyop && systemctl reload nginx
```

⚠️ Sunucu **son üç** sürümü tutar (`miyop-yukle.ps1` satır 97); bir sürüm
**8.5 MB** (30.10.2026 derlemesi: 31 dosya, 8.51 MB).

### 6.2 Veritabanı (elle ve kayıt altında)
**Karar (Emrah, 13.09.2026): ekrana geri yükleme düğmesi KONULMAYACAK.**
> *Yanlış yapılmış bir geri yükleme veri kaybından kötüdür.*

Talep MİYOP'a gelir, elle ve kayıt altında yapılır. Kaba sıra:

1. **Önce bugünün yedeğini al** — geri yükleme de bir değişikliktir.
2. Hangi ana dönüleceğine karar ver, o klasörü seç.
3. `psql` ile sırayla: `roller.sql` → `sema.sql` → `veri.sql`.
4. Sonra **doğrula**: kiracı sayısı, stok kartı sayısı, `audit_log`'un son
   kaydının tarihi.
5. Kullanıcıların Auth kayıtlarını yeniden aç (§4.1).

⚠️ Bu adımlar **canlıda hiç denenmedi.** Denenmemiş bir geri yükleme planı
bir plan değil, bir niyettir. Demo sonrası boş bir Supabase projesinde
prova edilecek — o provaya kadar bu bölüm **test edilmemiş** sayılır.

---

## 7 · Açık borçlar

| # | Borç |
|---|---|
| 1 | Yedek alma **otomatik değil** (elle çalıştırılıyor) |
| 2 | **Geri yükleme hiç denenmedi** (§6.2) |
| 3 | `auth.users` yedekte yok (§4.1) |
| 4 | Supabase **Pro** alınmadı: otomatik yedek ve duraklamama yok (§2) |
| 5 | Sunucu **üç** sürüm tutuyor; yediye çıkarmak ~35 MB (ikinci derece) |
