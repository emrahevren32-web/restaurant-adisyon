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
| **Tam proje yedeği** | Harici disk (`F:\MIYOP_BACKUP`) | `araclar\tam-yedek.ps1` | Kod + **bütün git geçmişi** + dokümanlar |

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

### ⚠️ 30.10.2026 · İLK DENEME DOCKER'DA TAKILDI

`supabase db dump` `pg_dump`'ı **kapsayıcı içinde** çalıştırıyor — belgenin
kendi cümlesi: *"Runs `pg_dump` in a container with additional flags to
exclude Supabase managed schemas."* Emrah'ın makinesinde Docker yok, komut
şunu verdi:

```
docker: command not found (podman also not found)
```

⚠️ **Bu cümleyi belgede okumuştum ve söylemedim.** Betik artık önce ölçüyor
ve iki yoldan hangisi varsa onu kullanıyor:

| Yol | Gereken | Not |
|---|---|---|
| **A · `pg_dump`** | PostgreSQL **17+** istemci araçları | Docker gerekmez · **önerilen** |
| **B · supabase CLI** | Docker Desktop ya da Podman | `pg_dump`'ı kapsayıcıda çalıştırır |

⚠️ **Sürüm şartı ölçüldü:** sunucu **PostgreSQL 17.6** (`supabase link`'in
diske yazdığı `supabase/.temp/postgres-version` dosyasından okundu, tahmin
edilmedi). Eski bir `pg_dump` yeni sunucudan **dökum alamaz**, hata verir.
Betik bunu da kontrol ediyor.

A yolunda yalnız **`public` ve `app`** şemaları alınıyor. Ölçüldü: göçler
`app` dışında şema yaratmıyor (`create schema if not exists app`), yani
Supabase'in kendi şemaları zaten dışarıda kalıyor.

⚠️ **Arada ne yapılır:** araç kurulana kadar uygulamadaki
**Ayarlar → Veri ve Yedekleme** ekranı iş verisini Excel olarak indiriyor.
O **geri yüklenebilir bir yedek DEĞİLDİR** ama veriyi dışarı alır.

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

### ⚠️ 31.10.2026 · İLK GERÇEK YEDEK ALINDI — ve bir şey öğretti

```
sema.sql  500.236 bayt
veri.sql  322.544 bayt   (66 COPY satırı)
tam.dump  (özel biçim)
```

`audit_log` ve `stock_movement` dökümde görünüyor. Ama pg_dump şunu uyardı:

> *"DİKKAT: Bu tablolar arasında **dairesel foreign-key** kısıtlamaları
> bulunmaktadır: `company`, `branch` … `stock_movement`. `--disable-triggers`
> kullanmadan … yedeği geri **yükleyemeyebilirsiniz**. Bu sorunla
> karşılaşmamak için `--data-only` yedek yerine **tam yedek** almayı
> düşünün."*

⚠️ **Bu, "veri var" ile "veri geri gelir" arasındaki farktır.** `company`
ile `branch` birbirine bakıyor; hangisini önce yazarsan öteki kısıtı
patlatır. `--disable-triggers` çözüm değil: superuser ister, Supabase'de
bizde yok.

Çözüm pg_dump'ın kendi tavsiyesi: **özel biçimde tek dosyalık tam döküm**
(`-Fc` → `tam.dump`). `pg_restore` sıralamayı kendisi çözer.

| Dosya | Ne işe yarar |
|---|---|
| **`tam.dump`** | ⬅ **GERİ YÜKLENECEK DOSYA** |
| `sema.sql` | Okunabilirlik: göz atmak, metinde aramak |
| `veri.sql` | Okunabilirlik: hangi tabloda ne var |

Doğru geri yükleme komutu:

```
pg_restore --no-owner --no-privileges -d <hedef-veritabani> tam.dump
```

⚠️ Betik `tam.dump`'ı **baştan sona SQL'e çeviriyor** ve çıkan metindeki
gerçek kayıt satırlarını sayıyor.

⚠️ **Neden `--list` yetmiyor (MIYOP-088, Codex · 01.11.2026):** Codex ölçtü —
50 girdili bir arşivin sağlam sürümü 16.912, **veri blokları kesilmiş**
sürümü 15.971 bayttı. İkisi de `pg_restore --list` ile **çıkış kodu 0 ve
aynı 50 girdi** verdi; SQL'e açmada sağlam sürüm geçti, kesilmiş sürüm
`could not find block ID 1` ile düştü. Yani **içerik listesi, veri
bloklarının sağlamlığı değildir.** Çevirme ise her bloğu gerçekten okutur.

⚠️ **Parola üç kez sorulur** (her `pg_dump` çağrısında bir kez). Betik
parolayı saklamıyor — üç kez yazmak, parolanın bir ortam değişkeninde
dolaşmasından iyidir.

### Betik kendi çıktısını DENETLER

Dosyanın oluşması, içinde veri olduğu anlamına gelmez. `yedek-al.ps1`
bitmeden önce şunları ölçer ve **geçmezse "alındı" DEMEZ**:

- Şema dosyası var ve beklenenden küçük değil
- Veri dosyasında **en az bir gerçek kayıt satırı** var
  ⚠️ 01.11'e kadar `COPY` **başlıkları** sayılıyordu. Boş bir tablo da
  `COPY` başlığı taşır: yirmi boş tablo *"20 satır veri"* gibi görünürdü.
  Artık `COPY` bloğunun **içindeki** satırlar sayılıyor (MIYOP-088).
- Denetim defteri (`audit_log`) dökümde görünüyor
- `tam.dump` **baştan sona SQL'e çevriliyor** ve içinden en az bir kayıt
  satırı çıkıyor — bozuk veya yarım arşiv burada düşer
- ⚠️ **CLI yolunda `tam.dump` ÜRETİLMEZ** (MIYOP-087). O yol artık
  *"alındı ve doğrulandı"* demiyor: ekranda **SINIRLI YEDEK** yazıyor ve
  not, olmayan bir dosyaya değil elle sıralı yükleme yöntemine
  yönlendiriyor.

---

## 3.B · Tam proje yedeği (kod + geçmiş)

```powershell
.\araclar\tam-yedek.ps1
.\araclar\tam-yedek.ps1 -IkinciHedef 'G:\'
```

`F:\MIYOP_BACKUP\miyop-<tarih-saat>\` altına üç şey yazar:

| Ne | İçinde |
|---|---|
| `depo\` | Çalışma kopyasının tamamı (kaynak, göçler, provalar, dokümanlar, Edge Function'lar) |
| `miyop.gitbundle` | **Bütün git geçmişi tek dosyada** |
| `SURUM.txt` | Tarih, commit, dosya sayısı, boyut, commit edilmemiş değişiklikler |

⚠️ `miyop.gitbundle` bir kopya değil, **klonlanabilir bir depodur**:

```
git clone miyop.gitbundle miyop-geri
```

Yani yalnız bugünkü hâli değil, **her commit** geri gelir. Betik `git bundle
verify` ile dosyayı gerçekten açıp doğruluyor — oluşması yetmez (tuzak 157).

**Kapsamadıkları:** `node_modules` ve `dist` bilerek yok (ikisi de üretilen
şeyler; `npm install` + `npm run build` geri üretir). **Veritabanı da yok** —
o §3'teki yedek.

⚠️ `.env.local` bu yedeğin **içindedir** (uygulamanın çalışması için gerekli).
İçinde Supabase proje adresi ve **anon** anahtarı var; anon anahtarı gizli
değildir (tarayıcıya gitmek üzere tasarlanmıştır, koruma RLS'ten gelir).
`service_role` anahtarı bu projede hiçbir yerde yazılı değil. Yine de yedek
diskini **fiziksel olarak** güvende tut.

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

⚠️ Sunucu **son yedi** sürümü tutar (31.10'da üçten yediye çıkarıldı).
Bir sürüm **8.49 MB** (31.10 derlemesi: 31 dosya), yani yedi sürüm ~59 MB.
Sebep: üç dönüş noktasının ikisi aynı güne aitti; kötü bir dağıtım ertesi
gün fark edilirse dönülecek sağlam sürüm kalmıyordu.

### 6.2 Veritabanı (elle ve kayıt altında)
**Karar (Emrah, 13.09.2026): ekrana geri yükleme düğmesi KONULMAYACAK.**
> *Yanlış yapılmış bir geri yükleme veri kaybından kötüdür.*

Talep MİYOP'a gelir, elle ve kayıt altında yapılır. Kaba sıra:

1. **Önce bugünün yedeğini al** — geri yükleme de bir değişikliktir.
2. Hangi ana dönüleceğine karar ver, o klasörü seç.
3. **`tam.dump` ile geri yükle. Tek yol budur.**

   ```
   pg_restore --no-owner --no-privileges -d <hedef> tam.dump
   ```

   ⚠️ **ÇIKIŞ KODU 1 GELECEK VE BU BAŞARISIZLIK DEĞİL.** Ölçüldü
   (02.11.2026): boş bir veritabanına yapılan **kusursuz** bir geri yükleme
   şu tek hatayı veriyor —
   `ERROR: schema "public" already exists` — çünkü PostgreSQL yeni
   veritabanını zaten `public` şemasıyla açıyor, döküm ise onu yaratmaya
   çalışıyor. `pg_restore` bu yüzden **1** dönüyor.
   ➜ **Çıkış koduna bakıp "olmadı" deme.** Doğruluk 4. adımda SAYARAK
   ölçülür.

4. **SAYARAK doğrula** — çıkış koduyla değil:

   ```sql
   select 'tablo',    count(*) from information_schema.tables
     where table_schema='public' and table_type='BASE TABLE'
   union all select 'app fonksiyonu', count(*) from pg_proc p
     join pg_namespace n on n.oid=p.pronamespace where n.nspname='app'
   union all select 'tetik',     count(*) from pg_trigger where not tgisinternal
   union all select 'RLS kuralı', count(*) from pg_policies where schemaname='public'
   union all select 'kiracı',    count(*) from public.tenant
   union all select 'stok kartı',count(*) from public.stock_item
   union all select 'denetim',   count(*) from public.audit_log;
   ```

   Sayılar kaynakla **birebir** tutmalı. (02.11 provasında tuttu:
   66 tablo · 147 fonksiyon · 204 tetik · 78 RLS kuralı · bütün satırlar.)

5. Kullanıcıların Auth kayıtlarını yeniden aç (§4.1).

## ⚠️ 6.2.1 · `sema.sql` + `veri.sql` ile geri yükleme ÇALIŞMIYOR

**Ölçüldü (02.11.2026 · PostgreSQL 16.15 · 106 göçlük gerçek şema.)**
Daha önce bu yol için *"daha zayıf, patlayabilir"* yazıyordu. Ölçüm daha
kötüsünü gösterdi: **patlamıyor — sessizce kaybediyor.**

| | `pg_restore` + `tam.dump` | `psql` + `sema.sql` → `veri.sql` |
|---|---|---|
| Çıkış kodu | **1** (zararsız hata) | **0** |
| Gelen veri | **birebir tam** | ⚠️ **kiracı 0 · denetim 0** |
| Hata | 1 (public şeması) | **11 foreign key hatası, akışı durdurmadan** |

`psql`, `ON_ERROR_STOP` verilmediğinde hatalı satırı atlayıp **0 ile
çıkıyor**. Yani ekranda başarısızlık görünmüyor, felaket kurtarmanın tam
ortasında *"geri yükledim"* sanılıyor ve iş verisi gelmemiş oluyor.

⚠️ İkisi de yalan söylüyor ama **ters yönlere**: `pg_restore` *"başarısız"*
diyor ve mükemmel çalışıyor; `psql` *"başarılı"* diyor ve her şeyi
kaybediyor. Bu yüzden doğrulama **sayarak** yapılır.

Sebep dairesel yabancı anahtar: `company` ↔ `branch` (ve
`order_approval_step`, `app_user`, `audit_log` zinciri). Düz SQL sırayla
yüklüyor; `pg_dump` dökümü alırken bunu zaten uyarıyor:
*"You might not be able to restore the dump without using
--disable-triggers or temporarily dropping the constraints."*

➜ `--disable-triggers` **superuser ister**; Supabase'de `postgres` rolü
gerçek superuser değil. Yani o çıkış yolu da kapalı.
➜ **Kural:** `sema.sql` ve `veri.sql` **okumak içindir**, geri yüklemek
için değil. `tam.dump` üretmeyen bir yedek, geri yüklenebilir bir yedek
değildir.

⚠️ **Bu prova GERÇEK CANLI DÖKÜMLE değil, aynı şemaya sahip bir prova
veritabanıyla yapıldı.** Kanıtlanan şey **yöntem**; Emrah'ın
`F:\MIYOP_BACKUP` altındaki dosyasının geri geleceği hâlâ ayrıca
ölçülmeli. Ama yöntem artık tahmin değil.

## 6.2.3 · ✅ GERÇEK YEDEK GERİ GELDİ · 02.11.2026 · İLK KEZ

`F:\MIYOP_BACKUP\veritabani\20261031-215057\tam.dump` (744,8 KB · 1.246
nesne) Emrah'ın bilgisayarındaki PostgreSQL 18'e geri yüklendi.

| Ölçüm | Geri gelen | Beklenen | |
|---|---|---|---|
| tablo | 66 | 66 | ✅ |
| `app` fonksiyonu | 146 | 146 | ✅ |
| tetik | 203 | 203 | ✅ |
| RLS kuralı | 76 | 78 | ⚠️ **2 eksik** |
| kiracı | **8** | — | ✅ |
| firma | **8** | — | ✅ |
| stok kartı | 4 · stok hareketi 34 · sipariş 2 | — | ✅ |
| denetim kaydı | **123** | — | ✅ |

⚠️ **146/203 bir kayıp DEĞİL:** döküm 31.10'da, yani **göç 0105'ten önce**
alındı. 0105 bir fonksiyon ve bir tetik ekliyor; 146+1 = 147, 203+1 = 204.
Sayılar birebir tutuyor.

### ⚠️ Eksik çıkan 2 RLS kuralı — sebebi ÖLÇÜLDÜ

`pg_restore` iki kez şunu dedi:
`ERROR: role "supabase_auth_admin" does not exist`.

Ölçüldü: prova veritabanında `public` şemasındaki **tam 2** politika bu
role bağlı. Sebebi `g7_1_sema.sql`te yazılı — giriş kancası **yalnız
Supabase'in kendi auth sunucusuna** açılıyor.

➜ Yani eksiklik **yedekte değil, prova ortamında**: o rol Supabase'de
vardır, yalın bir yerel PostgreSQL'de yoktur.
➜ `geri-yukle-provasi.ps1` artık geri yüklemeden önce `anon`,
`authenticated`, `service_role` ve `supabase_auth_admin` rollerini açıyor
(hepsi `nologin` — yalnızca politikaların işaret edeceği bir ad).
Bir sonraki provada **78** beklenir.

⚠️ **Hâlâ kanıtlanmamış olan:** bu iki politikanın **gerçek bir Supabase
projesine** geri yüklendiği. Rol orada var, yani çok olası — ama *olası*
ile *ölçüldü* aynı şey değil.

⚠️ **Dökümde olmayanlar (bilerek):** giriş hesapları (`auth` şeması) ve
yüklenen dosyalar (Storage). Geri yüklemede iş verisi döner,
**kullanıcıların yeniden açılması gerekir** (§4.1).

## 6.2.2 · Provayı KENDİ dosyanla koştur · tek komut

```powershell
.\araclar\geri-yukle-provasi.ps1
```

`F:\MIYOP_BACKUP` altındaki **en yeni** `tam.dump`'ı bulur, **kendi
bilgisayarındaki** PostgreSQL'de geçici bir veritabanı açar, oraya geri
yükler, **sayar** ve veritabanını siler.

- ⚠️ **Supabase'e hiç bağlanmaz.** Canlıya giden tek satır yok.
- ⚠️ **Çıkış koduna bakmaz** (tuzak 176); yargıyı satır sayıları verir.
  `kiracı = 0` görürse açıkça *"bu yedek güvenilmez"* der.
- Yerel PostgreSQL parolasını **sen** yazarsın; betik saklamaz.
- Başka bir dosyayı denemek için: `-Dosya "F:\...\tam.dump"`.
  Veritabanını incelemek için bırakmak: `-Birak`.

Çıktıdaki sayıları **canlıyla karşılaştır**: aynı sorguyu Supabase SQL
Editor'e yapıştır. Döküm alındıktan sonra yazılan kayıtlar yüzünden canlı
sayılar **daha büyük** olabilir — **daha küçük olmamalı.**

---

## 7 · Açık borçlar

| # | Borç |
|---|---|
| 1 | Yedek alma **otomatik değil** (elle çalıştırılıyor) |
| 2 | ✅ **Kapandı (02.11):** gerçek döküm geri yüklendi, iş verisi geldi (§6.2.3). ⬜ Kalan: boş bir **Supabase** projesine geri yükleme |
| 3 | `auth.users` yedekte yok (§4.1) |
| 4 | Supabase **Pro** alınmadı: otomatik yedek ve duraklamama yok (§2) |
| ~~5~~ | ✅ **Kapandı (31.10):** sunucu artık **yedi** sürüm tutuyor (~59 MB) |
| ~~6~~ | ✅ **Kapandı (31.10):** PostgreSQL 18.6 istemci araçları kuruldu; ilk veri yedeği alındı |
| 7 | Tam proje yedeği **otomatik değil**, elle çalıştırılıyor |
