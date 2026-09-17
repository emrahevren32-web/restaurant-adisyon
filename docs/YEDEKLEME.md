# MİYOP · Yedekleme ve Geri Yükleme

> **Bu belge ne işe yarar:** "Sunucu yandı, ne yapacağım" sorusunun cevabı.
> Sadece okunmak için değil, **provası yapılmak** için yazıldı.
>
> Son güncelleme: 2026-09-13

---

## 0. Önce acı gerçek

**Supabase ÜCRETSİZ planında otomatik yedek YOKTUR.** Supabase'in kendi
belgesi ücretsiz projelere şunu söylüyor: düzenli olarak kendiniz
`db dump` alın ve dışarıda saklayın.

| Plan | Ne var |
|---|---|
| **Free** *(şu anki plan)* | **Hiçbir otomatik yedek yok** |
| Pro | Günlük otomatik yedek, son 7 gün |
| Pro + PITR (ek ücret) | Dakika hassasiyetinde geri dönüş |

Yani bugün itibarıyla **MİYOP veritabanının yedeği yok.** Bu belgedeki
adımlar yapılana kadar durum böyle kalır.

**Ve bu, plan yükseltmekle de tam çözülmez:** A5'te Hetzner'e taşınıyoruz
(ADR-006). Orada Supabase'in yedek düğmesi diye bir şey olmayacak. Yedeği
kendimiz alabiliyor olmak, taşınmanın önkoşulu.

---

## 1. Üç ayrı yedek, üç ayrı soru

Bunlar birbirinin yerine geçmez. Karıştırmak, yedeği olduğunu sanıp
olmamak demektir.

| | Neyi kurtarır | Nasıl |
|---|---|---|
| **A · Uygulama içi dışa aktarma** | Bir işletmenin iş verisi | Stok → İşlem Geçmişi → **Yedeği İndir** |
| **B · Veritabanı dökümü** | **Her şey**: şema, veri, tetikleyiciler, RLS | `pg_dump` (aşağıda) |
| **C · Kod** | Uygulamanın kendisi | `git push` + `F:\MIYOP_BACKUP` |

**A**, müşteri "verimi ver" dediğinde ve bir kiracıyı başka kuruluma
taşırken kullanılır. Auth hesaplarını ve şemayı içermez.

**B**, felaket senaryosunun cevabıdır. Asıl yedek budur.

**C** zaten yapılıyor ama ⚠️ **kod haftalardır commit edilmedi.**

---

## 2. B · Veritabanı dökümü — kurulum

### 2.1 Gerekenler (bir kez)

PostgreSQL istemci araçları. **Bu makinede zaten kurulu:**

```
C:\Program Files\PostgreSQL\18\bin\pg_dump.exe
```

Ama `pg_dump --version` "tanınmıyor" diyor — çünkü klasör **PATH'te
değil.** Yani araç var, Windows nereye bakacağını bilmiyor.

**Kalıcı çözüm** (bir kez, PowerShell'i **yönetici olarak** aç):

```powershell
$yeni = "C:\Program Files\PostgreSQL\18\bin"
$mevcut = [Environment]::GetEnvironmentVariable("Path", "Machine")
if($mevcut -notlike "*$yeni*"){
  [Environment]::SetEnvironmentVariable("Path", "$mevcut;$yeni", "Machine")
  Write-Host "PATH'e eklendi. YENİ bir PowerShell penceresi aç."
} else {
  Write-Host "Zaten ekliymiş."
}
```

Sonra **yeni bir PowerShell penceresi** aç ve doğrula:

```powershell
pg_dump --version
```

Beklenen: `pg_dump (PostgreSQL) 18.x`

> Yönetici PowerShell istemiyorsan komutlarda tam yolu yazabilirsin:
> `& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" --version`
> Ama PATH'e eklemek daha rahat; aşağıdaki bütün komutlar kısa hâli
> kullanıyor.

⚠️ **Sürüm uyumu:** `pg_dump` 18, Supabase'in Postgres 15/16/17
sunucusundan yedek alabilir (yeni istemci eski sunucuyu okur). Tersi
çalışmaz. Sorun çıkarsa `pg_dump --version` çıktısını bana ilet.

### 2.2 Hazır betik

Elle komut yazmana gerek yok. Depoda hazır duruyor:

```
C:\Users\90544\Documents\restaurant-adisyon\scripts\yedek-al.ps1
```

Betik şunları yapıyor: dökümü alır · dosyanın gerçekten oluştuğunu ve
boş olmadığını doğrular · 7 günden eski yedekleri siler ama **her ayın
1'ini saklar** · her çalışmayı `yedek-gunlugu.txt`'ye yazar.

### 2.3 Kurulum — üç adım

**Adım 1 · Betiği yedek klasörüne kopyala**

```powershell
New-Item -ItemType Directory -Force -Path "F:\MIYOP_BACKUP" | Out-Null
Copy-Item "C:\Users\90544\Documents\restaurant-adisyon\scripts\yedek-al.ps1" `
  -Destination "F:\MIYOP_BACKUP\" -Force
Write-Host "Kopyalandi."
```

**Adım 2 · Bağlantı adresini kendi elinle yaz**

Supabase panelinde: **Project Settings → Database → Connection string →
URI**. Kopyala, sonra:

```powershell
notepad F:\MIYOP_BACKUP\baglanti.txt
```

Açılan boş dosyaya adresi **tek satır** yapıştır ve kaydet. Şuna benzer:

```
postgresql://postgres.xxxxx:PAROLA@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

⚠️ **Bu dosya parola içerir.** F:\ sürücüsünde durur, git deposuna asla
girmez, kimseye gönderilmez — bana da. Yedek klasörünü buluta yüklerken
bu dosyayı hariç tut.

**Adım 3 · Önce ELLE dene, sonra zamanla**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\MIYOP_BACKUP\yedek-al.ps1"
```

Beklenen çıktı:

```
2026-09-13 14:20:01  Yedek basliyor -> F:\MIYOP_BACKUP\miyop-2026-09-13-1420.dump
2026-09-13 14:20:14  Tamam. 3,2 MB
2026-09-13 14:20:14  Bitti.
```

**Çalıştığını gördükten sonra** her gece 03:00'e kur:

```powershell
$eylem = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument '-NoProfile -ExecutionPolicy Bypass -File "F:\MIYOP_BACKUP\yedek-al.ps1"'
$zaman = New-ScheduledTaskTrigger -Daily -At 03:00
$ayar  = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun
Register-ScheduledTask -TaskName "MIYOP gunluk yedek" `
  -Action $eylem -Trigger $zaman -Settings $ayar -Description "MIYOP veritabani gunluk dokumu"
```

`-StartWhenAvailable`: bilgisayar 03:00'te kapalıysa, açılınca kaçırılan
yedeği alır. Yoksa kapalı geçen her gece sessizce yedeksiz kalırdı.

**Kurulduğunu doğrula:**

```powershell
Get-ScheduledTask -TaskName "MIYOP gunluk yedek" | Select-Object TaskName, State
Get-ScheduledTaskInfo -TaskName "MIYOP gunluk yedek" | Select-Object LastRunTime, NextRunTime, LastTaskResult
```

`LastTaskResult` **0** olmalı. Başka bir sayı hatadır;
`F:\MIYOP_BACKUP\yedek-gunlugu.txt` sebebini yazar.

⚠️ **Bilgisayar tamamen kapalıysa yedek alınmaz.** Kalıcı çözüm A5'te:
Hetzner sunucusunda `cron`. Bu adım o güne kadarki köprüdür.

### 2.4 Kaç yedek saklanmalı

Betik bunu **kendisi yapıyor**: 7 günden eski yedekleri siler ama her
ayın 1'ini bırakır. Sebebi şu: bozulmayı aynı gün fark etmezsin. Bir hafta
önce silinen bir kayıt, üç gün saklanan yedekle geri gelmez.

⚠️ **Yedek aynı diskte olmazsa yedek değildir.** `F:` sürücüsü aynı
bilgisayardaysa, o bilgisayar giderse ikisi birden gider. Aylık kopyayı
harici diske ya da buluta al.

---

## 3. Geri yükleme provası — ASIL İŞ BU

> **Denenmemiş yedek, yedek değildir.** Bunu yılda en az iki kez, ve her
> büyük göç sonrası bir kez yap.

### 3.1 Neden ayrı bir proje

Provayı **canlı veritabanında yapmıyoruz.** Supabase'de ücretsiz ikinci
bir proje aç (`miyop-prova`), provayı orada yap, bitince sil.

### 3.2 Adımlar — `scripts\yedek-geri-yukle-provasi.ps1`

Provanın tamamı tek betikte. Elle `pg_restore` yazmıyoruz; çünkü provanın
asıl işi yüklemek değil, **yüklenenin doğru olduğunu kanıtlamak.**

**Kurulum (bir kez):**

1. Supabase'de **ikinci** bir ücretsiz proje aç. Adı: `miyop-prova`.
2. O projenin **Session pooler** adresini al (üstteki **Connect** düğmesi).
3. `F:\MIYOP_BACKUP\` altına iki dosya:
   - `prova-baglanti.txt` → prova projesinin adresi, **parolasız**
   - `prova-parola.txt` → prova projesinin parolası, tek satır
4. Betiği yanına kopyala: `scripts\yedek-geri-yukle-provasi.ps1` →
   `F:\MIYOP_BACKUP\`

**Çalıştırma:**

```powershell
powershell -ExecutionPolicy Bypass -File "F:\MIYOP_BACKUP\yedek-geri-yukle-provasi.ps1"
```

Betik en son `.dump` dosyasını kendisi bulur, prova projesine yükler ve
§3.3'teki **altı** kontrolü çalıştırıp **TAMAM / KALDI** olarak raporlar.

⚠️ **GÜVENLİK KİLİDİ.** Betik `--clean` kullanır — yani yüklemeden önce
var olanı siler. Bu, yanlış adrese çalıştırıldığında canlı veriyi silebilir.
Bu yüzden betik ilk iş olarak prova adresinin proje kimliğini canlı
`baglanti.txt`'teki kimlikle karşılaştırır. **Aynıysa hiçbir şey yapmadan
durur.** Kilit çalışmadıysa (kimlik okunamadıysa) da durur — sessizce
devam etmez.

⚠️ Yalnız **`public` ve `app`** şemaları yüklenir. `auth`, `storage`,
`realtime` Supabase'in kendi şemalarıdır; prova projesinde zaten varlar,
üzerlerine yazmayız.

⚠️⚠️ **`app` ŞEMASI ELLE YARATILIR — bu tuzağa bir kez düştük.**
`pg_restore --schema=app` dendiğinde, şemanın **kendisini yaratan** satır o
seçime **girmez** (`pg_dump` o satırın şemasını boş bırakır). Yaratmazsak
`app` içindeki 18 fonksiyon ve onlara dayanan **43 tetikleyicinin tamamı**
"böyle bir şema yok" diyerek düşer. Betik bu yüzden `pg_restore`'dan önce
`create schema if not exists app` çalıştırıyor ve başarısız olursa durur.

Bu tuzağın kötü tarafı: **veri sorunsuz gelir.** Tabloları açar, satırları
sayar, "yedek çalışıyor" dersin. Oysa geri kurduğun veritabanında sayım
kilidi yok, denetim kaydı yok. İlk provada tam olarak bu oldu:
veri TAMAM, tetikleyici **0**.

⚠️ **`--no-privileges` KULLANILMAZ.** GRANT'lar da yedeğin parçası.
RLS ve GRANT ayrı kapılardır (bkz. §1); GRANT'sız geri yüklenen bir
veritabanında politikalar doğru olsa bile kimse hiçbir şey okuyamaz.
İlk taslakta bu bayrak vardı, kaldırıldı.

**Prova bitince prova projesini Supabase panelinden sil.** Yedek dosyası
işletmenin tüm verisidir; ortada duran ikinci bir kopya risktir.

### 3.3 Prova başarılı sayılır Kİ

Betik bu altı kontrolü kendisi yapar ve hepsi geçmeden "başarılı" demez:

| # | Kontrol | Eşik | Neden |
|---|---|---|---|
| 1 | Sekiz tablonun satır sayısı | hiçbiri 0 | Veri geldi mi |
| 2 | `public` tetikleyicileri | ≥ 10 | Sayım kilidi + denetim kaydı |
| 3 | RLS açık kritik tablo | 4/4 | Kiracı izolasyonu |
| 4 | `public` yetki politikası | ≥ 20 | İzolasyonun kuralları |
| 5 | `anon`/`authenticated`/`service_role` GRANT'ı | ≥ 20 | Okuma izni |
| 6 | `app` şemasındaki fonksiyon | ≥ 10 | Tetikleyicilerin dayandığı kod |

**2026-09-17 provası (miyop-2026-09-14-0300.dump):** çıkış kodu 0, hata
satırı 0 · veri TAMAM · tetikleyici 31 · RLS 4 · politika **41 (canlıyla
birebir)** · GRANT 840 · `app` fonksiyonu 18. **BAŞARILI.**

Elle bakmak istersen prova projesinin SQL Editor'ünde şunu çalıştır:

```sql
-- Beklenen: her satırda gerçek bir sayı, hiçbiri 0 değil
select 'stok kalemi' as ne, count(*) from stock_item
union all select 'lot',        count(*) from stock_lot
union all select 'hareket',    count(*) from stock_movement
union all select 'sayım',      count(*) from stock_count
union all select 'sevkiyat',   count(*) from shipment
union all select 'HACCP ölçüm',count(*) from haccp_measurement
union all select 'denetim',    count(*) from audit_log;

-- Beklenen: 10 satır. Tetikleyiciler de geri gelmiş mi?
select event_object_table, trigger_name
from information_schema.triggers
where trigger_name like 'denetim\_%' or trigger_name like '%count_lock%'
order by 1;

-- Beklenen: her tabloda rowsecurity = true. RLS geri gelmiş mi?
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in
  ('stock_movement','stock_item','audit_log','stock_count')
order by 1;
```

**Üçü de geçmeden prova başarılı sayılmaz.** Veri geri gelip de
tetikleyiciler gelmediyse, sayım kilidi ve denetim kaydı çalışmayan bir
sistem geri kurmuşsun demektir — ve bunu ancak aylar sonra fark edersin.

### 3.4 Provada görülmesi gerekenler

| Kontrol | Neden |
|---|---|
| Satır sayıları canlıyla yakın | Veri geldi mi |
| `denetim_*` tetikleyicileri var | Denetim kaydı çalışacak mı |
| `stock_movement_count_lock` var | Sayım kilidi çalışacak mı |
| `rowsecurity = true` | Kiracı izolasyonu duruyor mu |
| Uygulamayı prova adresine bağla, giriş yap | Auth ayrı — hesaplar gelmez, bu **beklenen** |

⚠️ **Auth hesapları `pg_dump` ile gelmez.** `auth` şeması Supabase'in
yönetiminde. Yeni kuruluma taşınırken kullanıcılar yeniden davet edilir.
A4D'de kurulacak davet akışı bunun da cevabı olacak.

---

## 4. Ne zaman ne yapılır

| Durum | Yapılacak |
|---|---|
| Her gece 03:00 | Otomatik `pg_dump` (§2.3) |
| Her göç (`0029`, `0030`…) öncesi | Elle bir yedek al |
| Ayda bir | Harici diske kopya |
| 6 ayda bir | **Geri yükleme provası** (3) |
| Müşteri "verimi ver" derse | Uygulama içi dışa aktarma (A) |
| Bir kaydı yanlışlıkla sildim | Yedekten TEK TABLO geri al: `pg_restore --table=...` |

---

## 4.5 "Yedek müşterinin sorumluluğu mu?"

Kısmen. Sorumluluk **paylaşılır** ve sınırı net olmalı — sözleşmede de
böyle yazmalı:

| Kim | Neyin yedeğinden sorumlu |
|---|---|
| **MİYOP (sen)** | Sunucu ve veritabanı. Müşteri "verim gitti" derse muhatap sensin. |
| **Müşteri** | Kendi kopyası. İstediği an indirir; bu onun güvencesi, senin değil. |

Bunu tersine çevirmek satılabilir bir ürün bırakmaz: hiçbir fabrika
"verinizi siz yedekleyin, biz karışmayız" diyen bir ERP'yi almaz.

**Uygulama içi dışa aktarma müşterinin hakkı, senin yedeğin değil.**
Senin yedeğin §2'deki `pg_dump`.

### "Otomatik indirsin" fikri neden olmuyor

Tarayıcı zamanlanmış iş çalıştıramaz. Sekme kapalıyken hiçbir şey
çalışmaz; açıkken bile bilgisayar uykuya geçince durur. "Her gece
otomatik indirir" diyen bir düğme koymak, çalışmayan bir güvence
satmaktır.

**Yapılan şey:** her yedek alma günlüğe yazılıyor (`0029`), ve
7 günden eskiyse ekran uyarıyor: *"Son yedek 23 gün önce alındı."*

**Gerçek otomatiği A5'te geliyor:** Hetzner sunucusunda `cron` +
`pg_dump`. Orada tarayıcı yok, makine hep açık — ve o yedek zaten
senin sorumluluğundaki yedek.

---

## 4.6 Geri dönüş kimin işi — ve ücretli mi

**Karar (Emrah, 2026-09-13): geri yükleme müşteri tarafından YAPILMAZ.
Talep gelir, MİYOP yapar.**

Doğru karar, ve sebebi teknik: geri yükleme yanlış yapıldığında veri
kaybından **daha kötü** bir sonuç üretir — iki dönemin verisi birbirine
karışır ve hangisinin doğru olduğu bir daha bilinemez. Bu yüzden
uygulamada "İçeri Al" düğmesi **yok** ve olmayacak.

### Ücretlendirme — ikiye ayır

Bu ayrım sözleşmede net yazmalı, yoksa ilk olayda tartışma çıkar:

| Sebep | Ücret | Neden |
|---|---|---|
| **Sunucu arızası, göç hatası, MİYOP kaynaklı bir hata** | **Ücretsiz** | Kendi hatanı onarmak için para istemek satılabilir bir ilişki bırakmaz. Sözleşmede taahhüt edilmiş hizmetin parçası. |
| **Müşteri kaynaklı** — yanlış silme, "geçen haftaya dönelim", yanlış toplu içe aktarma | **Ücretli** | Gerçek bir uzman işi: veri kurtarma. Piyasada da böyle fiyatlanır. |

Sınırdaki durumlarda **müşteri lehine** karar ver. Bir geri yükleme
ücretinden kazanacağın para, kaybedeceğin güvenden azdır.

### Geri yükleme yapılırken uyulacaklar

1. **Yazılı talep.** Kim istedi, hangi tarihe dönülecek, neden. Sözlü
   talebe geri yükleme yapılmaz — sonradan "ben öyle demedim" denir.
2. **Önce mevcut durumun yedeği.** Geri yüklemeden ÖNCE `pg_dump` al.
   Dönülen nokta yanlışsa geri dönecek bir yer kalsın.
3. **Kiracı kimliği doğrulanır.** Dosyanın hangi işletmeye ait olduğu
   künyede yazar; uygulamadaki **Yedeği Doğrula** bunu tek bakışta
   söyler. Yanlış işletmenin dosyası ASLA yüklenmez.
4. **Kayıt tut.** Ne zaman, kim istedi, hangi dosyadan dönüldü, kaç satır.
   Denetimde ilk sorulacak budur.

### "İki müşteri birbirinin yedeğini çaldı" — cevap

Emrah'ın sorusu. Bugün ve yarın için cevap:

- **Bugün:** geri yükleme diye bir şey yok. Dosya bir çıktı, giriş kapısı
  değil. Çalınan dosyayla yapılabilecek tek şey onu okumaktır.
- **İçeri alma yazılırsa** (bugünkü karara göre yazılmayacak, ama
  yazılırsa): RLS `with check (tenant_id = app.current_tenant_id())`
  başka kiracının kimliğiyle satır yazılmasını **veritabanı seviyesinde**
  reddeder. Dosyadaki kimlikler kullanılmaz; satırlar oturumun kiracısına
  yazılır. Yani çalınan dosya, çalanın kendi verisine dönüşür — kurbanın
  verisine açılan bir pencere olmaz.
- **Asıl risk geri yükleme değil, dosyanın kendisi.** Sızarsa Not
  Defteri'yle okunur. Onun için dosya sunucuya hiç uğramıyor, yalnızca
  yetkili kullanıcı üretebiliyor, ve her üretim günlüğe yazılıyor (0029):
  kim, ne zaman, kaç satır.

---

## 5. Bu belgenin dürüst sınırı

Buradaki hiçbir adım **henüz yapılmadı**. Belge, yapılacakların
tarifidir; kutucuk ancak şu ikisi gerçekten olunca işaretlenir:

- [ ] Günlük yedek görevi kuruldu ve **en az bir dosya üretti**
- [ ] Geri yükleme provası yapıldı ve **§3.3'teki üç sorgu da geçti**

"Yedek alıyoruz" demek yetmez; **dosyanın var olduğunu ve geri
döndüğünü** görmek gerekir.
