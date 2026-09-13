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

### 2.2 Bağlantı adresi

Supabase panelinde: **Project Settings → Database → Connection string →
URI**. Şuna benzer:

```
postgresql://postgres.xxxxx:[PAROLA]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

⚠️ **Bu adres parola içerir. Bana gönderme.** Sadece kendi bilgisayarında
kullan.

### 2.3 Yedek alma

```powershell
$env:PGPASSWORD = "<veritabanı parolan>"
pg_dump "postgresql://postgres.xxxxx@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" `
  --format=custom `
  --no-owner --no-privileges `
  --file "F:\MIYOP_BACKUP\miyop-$(Get-Date -Format 'yyyy-MM-dd-HHmm').dump"
```

`--format=custom` seçili tablo geri yüklemeye izin verir; düz SQL'de
"sadece şu tabloyu geri al" diyemezsin.

`--no-owner --no-privileges`: Supabase'in kullanıcı adları başka bir
kuruluma taşınmaz. Bunları koymazsan geri yükleme yüzlerce "role does
not exist" hatası verir.

### 2.4 Günlük otomatik hâle getirme (Windows Görev Zamanlayıcı)

Yukarıdaki komutu `F:\MIYOP_BACKUP\yedek-al.ps1` olarak kaydet, sonra:

```powershell
$eylem = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File F:\MIYOP_BACKUP\yedek-al.ps1"
$zaman = New-ScheduledTaskTrigger -Daily -At 03:00
Register-ScheduledTask -TaskName "MIYOP gunluk yedek" -Action $eylem -Trigger $zaman
```

⚠️ **Bilgisayar kapalıysa yedek alınmaz.** Kalıcı çözüm A5'te: Hetzner
sunucusunda `cron`. Bu adım o güne kadarki köprüdür.

### 2.5 Kaç yedek saklanmalı

En az **7 günlük** + **her ayın 1'i** ayrı klasörde. Sebebi şu: bozulmayı
aynı gün fark etmezsin. Bir hafta önce silinen bir kayıt, üç gün saklanan
yedekle geri gelmez.

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

### 3.2 Adımlar

```powershell
# 1 · Prova projesinin bağlantı adresini al (Settings → Database → URI)

# 2 · Yedeği prova projesine yükle
pg_restore --dbname "postgresql://postgres.PROVA@...:5432/postgres" `
  --no-owner --no-privileges --clean --if-exists `
  "F:\MIYOP_BACKUP\miyop-2026-09-13-0300.dump"
```

### 3.3 Prova başarılı sayılır Kİ

Prova projesinin SQL Editor'ünde şunu çalıştır:

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
| Her gece 03:00 | Otomatik `pg_dump` (2.4) |
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
