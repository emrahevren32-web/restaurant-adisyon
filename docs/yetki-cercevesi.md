# MİYOP · Yetki Çerçevesi

> **Bu doküman ne işe yarar:** "Kim neyi yapabilir?" sorusunun tek cevabı burasıdır.
> Yeni bir personel eklerken hangi rolü vereceğini, bir rolün neyi açıp neyi
> kapattığını buradan görürsün.
>
> **Kaynak:** `db/migrations/0015_departman_rolleri.sql`. Bu doküman o migration'ın
> insan tarafıdır; ikisi ayrışırsa **migration doğrudur**, doküman güncellenmelidir.
>
> Son güncelleme: 2026-08-27

---

## 1. Nasıl çalışıyor — üç cümlede

1. **İzin** en küçük birimdir (`stock.write` gibi). 32 tane var.
2. **Rol** bir izin demetidir (`depo_sorumlusu` gibi). 12 tane var.
3. **Kullanıcı** bir birincil rol + istediğin kadar ek rol taşır. Etkin yetkisi
   hepsinin **birleşimidir** — bir kişi hem depo hem satın alma sorumlusu olabilir.

Küçük bir işletmede bir kişi birden çok şapka takar. Çerçeve buna göre kuruldu:
rol seçmek "ya o ya bu" değil, **tikleme** işidir.

---

## 2. Roller — kim ne yapar

Aşağıdaki tablo bir bakışta özet. Ayrıntı için §4'teki matrise bak.

| Rol | Kim için | Tek cümlede |
|---|---|---|
| **Platform Sahibi** (`admin`) | Emrah | Her şey, platform yönetimi dahil. |
| **Platform Yöneticisi** (`super_admin`) | Platform ekibi | Her şey. Tenant'lar bu rolü kimseye veremez. |
| **İşletme Sahibi** (`isletme_sahibi`) | Müşteri firma sahibi | Kendi işletmesinde her şey. **Platform yönetimi hariç.** |
| **İşletme Müdürü** (`isletme_muduru`) | Genel müdür / işletme müdürü | Tüm operasyon. Kullanıcı, rol, ayar ve firma yönetimi hariç. |
| **Depo Sorumlusu** (`depo_sorumlusu`) | Depo şefi | Stok ve sevkiyat yürütür. Ne alındığını, ne üretileceğini görür. |
| **Satın Alma Sorumlusu** (`satinalma_sorumlusu`) | Satın almacı | Talep, sipariş, tedarikçi yürütür. Stoğu görür. |
| **Üretim Sorumlusu** (`uretim_sorumlusu`) | Üretim şefi | İş emri ve reçete yürütür, stok düşer. Kaliteyi görür. |
| **Kalite Sorumlusu** (`kalite_sorumlusu`) | Kalite/gıda mühendisi | Kalite ve izlenebilirlik yürütür. Üretimi **görür, değiştiremez.** |
| **Sevkiyat Sorumlusu** (`sevkiyat_sorumlusu`) | Sevkiyat şefi | İrsaliye keser, mal çıkışı yazar. |
| **Muhasebe** (`muhasebe`) | Muhasebeci / mali müşavir | Parayı yönetir, **malı yönetmez.** |
| **Operasyon Personeli** (`personel`) | Mutfak/depo personeli | Mal kabul girer, üretim tüketimi düşer. Fiyat ve tedarikçi görmez. |
| **Görüntüleyici** (`izleyici`) | Denetçi, danışman, müşavir | Her şeyi görür, **hiçbir şeyi değiştiremez.** |

---

## 3. Tasarımın üç kuralı

Bu üç kural rollerin neden böyle kurulduğunu açıklar. Yeni bir rol eklerken
bunlara uy.

### Kural 1 · Denetleyen, denetlediğini değiştiremez

**Kalite Sorumlusu'nda `production.write` ve `stock.write` YOKTUR.** Bu bir eksik
değil, kasıtlı bir sınırdır: kalite kontrol eden kişi, kontrol ettiği üretim
kaydını da düzeltebiliyorsa denetim anlamını yitirir. Kalite kendi kaydını yazar
(`quality.write`), başkasının işini yazamaz. Karşılığında `audit.read` alır —
kimin ne yaptığını görebilmesi gerekir.

Aynı sebeple **Muhasebe'de `stock.write` yoktur.** Muhasebeci maliyeti görür ama
stok miktarını düzeltemez; düzeltebilseydi mali tabloyu sayımdan bağımsız
"düzeltebilirdi".

### Kural 2 · Yürüten, yönetemez

**İşletme Müdürü** tüm operasyonu yürütür ama `users.manage`, `roles.manage`,
`settings.manage` ve `company.manage` alamaz. Müdür işi yürütür; kimin neye
erişeceğine ve işletmenin kimliğine sahip karar verir. Müdür değiştiğinde
işletmenin yetki yapısı onunla birlikte değişmemelidir.

### Kural 3 · İşletme sahibi kendi evinde kraldır, komşuya karışamaz

Talebin aynen şuydu: *"Firma sahibi ise firması kapsamında benim işimi
bozamayacak derecede herşeyi yapabilmeli."* Karşılığı üç katmanda kuruldu:

1. **İzin katmanı:** `isletme_sahibi` rolü `platform.read` / `platform.manage`
   **almaz.** Diğer 30 iznin hepsini alır.
2. **Rol atama katmanı:** İşletme sahibi kendi personeline rol atayabilir, ama
   `assign_user_roles` RPC'si ona `super_admin` **veya** `admin` rolü
   atatmaz — hata verir.
3. **Veritabanı katmanı:** `0012` zaten `tenant.status`, `tenant.code` ve
   `app_user.role_code` sütunlarına doğrudan yazmayı kapatmıştı. Yani sahip,
   kendi tenant'ını "askıdan çıkaramaz" veya kendini `admin` yapamaz.

Bu üçü birbirinin yedeğidir. Biri atlansa diğer ikisi tutar.

---

## 4. Tam yetki matrisi

`●` = var · boş = yok

| İzin | süper | admin | sahibi | müdür | depo | satınalma | üretim | kalite | sevkiyat | muhasebe | personel | izleyici |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `dashboard.read` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `stock.read` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `stock.write` | ● | ● | ● | ● | ● | | ● | | ● | | ● | |
| `purchase.read` | ● | ● | ● | ● | ● | ● | | | | ● | | ● |
| `purchase.write` | ● | ● | ● | ● | | ● | | | | | | |
| `production.read` | ● | ● | ● | ● | ● | | ● | ● | | | ● | ● |
| `production.write` | ● | ● | ● | ● | | | ● | | | | ● | |
| `recipe.read` | ● | ● | ● | ● | ● | | ● | ● | | | ● | ● |
| `recipe.write` | ● | ● | ● | ● | | | ● | | | | | |
| `quality.read` | ● | ● | ● | ● | ● | | ● | ● | ● | | | ● |
| `quality.write` | ● | ● | ● | ● | | | | ● | | | | |
| `logistics.read` | ● | ● | ● | ● | ● | | | ● | ● | | | ● |
| `logistics.write` | ● | ● | ● | ● | ● | | | | ● | | | |
| `products.read` | ● | ● | ● | ● | ● | ● | ● | | ● | | ● | ● |
| `products.write` | ● | ● | ● | ● | | | | | | | | |
| `finance.read` | ● | ● | ● | ● | | ● | | | | ● | | ● |
| `finance.write` | ● | ● | ● | ● | | | | | | ● | | |
| `branch.read` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | | ● |
| `branch.manage` | ● | ● | ● | ● | | | | | | | | |
| `audit.read` | ● | ● | ● | ● | | | | ● | | ● | | ● |
| `company.read` | ● | ● | ● | ● | | | | | | ● | | ● |
| `company.manage` | ● | ● | ● | | | | | | | | | |
| `users.read` | ● | ● | ● | ● | | | | | | | | ● |
| `users.manage` | ● | ● | ● | | | | | | | | | |
| `roles.manage` | ● | ● | ● | | | | | | | | | |
| `settings.manage` | ● | ● | ● | | | | | | | | | |
| `personnel.read` | ● | ● | ● | ● | | | | | | | | ● |
| `personnel.manage` | ● | ● | ● | ● | | | | | | | | |
| `operations.read` | ● | ● | ● | ● | | | | | | | | ● |
| `operations.write` | ● | ● | ● | ● | | | | | | | | |
| `platform.read` | ● | ● | | | | | | | | | | |
| `platform.manage` | ● | ● | | | | | | | | | | |

> **Not:** `operations.*`, `personnel.*`, `products.write` ve `finance.*` izinleri
> bugün çoğunlukla **dondurulmuş** modüllere (ADR-002) bağlı. Menüde karşılıkları
> görünmüyor. Kapsam açıldıkça anlam kazanacaklar; şimdiden doğru rollere
> bağlandılar ki o gün geldiğinde yeniden düşünmek gerekmesin.

---

## 5. Hangi ekran hangi izinle açılır

Menüdeki her çekirdek modül tek bir izne bağlıdır. Bir kullanıcı o izne sahip
değilse **menüde ögeyi görmez ve rotayı elle yazsa bile ekran açılmaz.**

| Menü / modül | Açan izin |
|---|---|
| Kontrol Paneli | `dashboard.read` |
| Stok (Kartlar, Hareketler, Kritik Stok, Lot, Mal Kabul…) | `stock.read` |
| Satın Alma (Talepler, Siparişler, Tedarikçiler) | `purchase.read` |
| Üretim İş Emirleri | `production.read` |
| Reçete Yönetimi | `recipe.read` |
| Kalite (Lot Sistemi, Geri Çağırma, Ürün Geçmişi) | `quality.read` |
| Sevkiyat / İrsaliye | `logistics.read` |
| Şube Yönetimi | `branch.read` |
| İşlem Geçmişi (Audit) | `audit.read` |
| Kullanıcılar | `users.manage` |
| Roller | `roles.manage` |
| Sistem Ayarları | `settings.manage` |

**İzne bağlı olmayanlar:** Profilim, Firma Profili, Modül Mağazası, Entegrasyon
Merkezi, Karşılama ekranı. Bunların kendi kapıları var (mağaza ve lisans
ekranları ayrıca platform yöneticisi ister).

---

## 6. Personele rol verme

### Ekrandan (önerilen)

**Kullanıcılar** menüsüne gir (Roller menüsü de aynı ekrana çıkar). Sayfanın
altındaki **Rol Atama** bölümünde veritabanındaki gerçek kullanıcılar listelenir.

1. Kullanıcının satırındaki **Rolleri Düzenle**'ye bas.
2. Vermek istediğin rolleri **tikle**. Bir kişiye istediğin kadar rol
   verebilirsin; etkin yetkisi hepsinin toplamıdır.
3. **Rolleri Kaydet**.

Kullanıcı yeni yetkileriyle **bir sonraki girişinde** çalışmaya başlar — izinler
giriş anında okunur.

> Bu bölüm için `users.manage` veya `roles.manage` iznin olması gerekir. İşletme
> sahibiysen `admin` ve `super_admin` rolleri listede **hiç görünmez** (§3, Kural 3).

### SQL ile (aynı işi yapar)

**Tek kullanıcıya rol atamak** — Supabase SQL Editor:

```sql
-- Ali'yi hem depo hem satın alma sorumlusu yap.
-- Dikkat: liste TAM DEĞİŞİMDİR, gönderilmeyen roller silinir.
select public.assign_user_roles(
  (select id from app_user where username_key = 'ali'),
  array['depo_sorumlusu','satinalma_sorumlusu']
);
```

**Kimin hangi rollere sahip olduğunu görmek:**

```sql
select u.username, u.role_code as birincil_rol,
       coalesce(string_agg(ur.role_code, ', ' order by ur.role_code), '—') as ek_roller
from app_user u
left join user_role ur on ur.user_id = u.id
group by u.username, u.role_code
order by u.username;
```

**Bir rolün tam olarak neyi açtığını görmek:**

```sql
select permission_code from role_permission
where role_code = 'kalite_sorumlusu' order by permission_code;
```

`assign_user_roles` yetki kontrollüdür: yalnızca aktif bir işletmenin
`super_admin` / `admin` / `isletme_sahibi` kullanıcısı çağırabilir, hedef kullanıcı
çağıranın işletmesinde olmak zorundadır ve işletme sahibi `admin` veya
`super_admin` rolü atayamaz (§3, Kural 3).

---

## 7. Yeni bir rol eklemek

1. Gerekiyorsa yeni izinleri `permission` tablosuna ekle **ve** kod tarafındaki
   iki yere yaz: `src/authorization/permission.types.ts` (tip) ve
   `permission.service.ts` (katalog). İkisi ayrışırsa
   `permission-enforcement.test.ts` kırılır — bu bilerek konmuş bir bekçidir.
2. `role` tablosuna rolü ekle, `role_permission`'a izinlerini yaz.
3. §3'teki üç kurala uyduğunu kontrol et.
4. Bu dokümandaki §2 ve §4 tablolarını güncelle.

Yeni bir **ekranı** izne bağlamak için, modülün `permissions` dizisindeki **ilk**
elemanı değiştirmen yeterli (`src/modules/business-workspace.registry.ts`) —
menü ögeleri kendi `requiredPermission`'ı yoksa oraya düşer.

---

## 8. Rol atama ekranının sınırı

Rol atama paneli **veritabanındaki gerçek kullanıcıları** (`app_user`) listeler.
Aynı sayfanın üst kısmındaki kullanıcı tablosu ise hâlâ tarayıcı deposundan
(localStorage) besleniyor — Dilim 1'de gerçek veriye bağlanacak. İki liste geçici
olarak yan yana duruyor; panel bunu başlığında saklamıyor.

Yeni kullanıcı **oluşturma** da hâlâ localStorage tarafındadır. Yani bugün rol
atayabileceğin kullanıcılar, veritabanında zaten var olan kullanıcılardır.
Gerçek kullanıcı oluşturma akışı (Supabase Auth hesabı + `app_user` kaydı) Dilim 1
işidir.

## 9. Bunun sınırı — dürüst not

Bu dokümandaki her şey **menü ve ekran görünürlüğünü** yönetir. Gerçek veri
koruması burada değil, veritabanındadır:

- **RLS** her tabloda açık ve `force` (ADR-004) — kullanıcı başka işletmenin
  satırını hiçbir yoldan göremez.
- **Kolon seviyesi GRANT'ler** (`0012`) — kimse kendi `role_code`'unu veya
  işletmenin negatif stok politikasını doğrudan değiştiremez.
- **Tetikleyiciler** (`0003`, `0011`) — defter append-only, negatif bakiye
  politikaya göre engelli.

Tarayıcıdaki izin listesi düzenlense bile bu üçü tutar. Menü süzmesi güvenliğin
kendisi değil, onun üstündeki kullanılabilirlik katmanıdır: kullanıcıya
çalışmayacak kapılar göstermemek için var.

**Henüz kanıtlanmamış olan:** iki farklı işletmenin verisinin gerçekten
birbirinden yalıtıldığı, canlı bir testle **doğrulanmadı**. Bu, yol haritasındaki
G7 maddesidir ve Dilim 0'ı kapatacak son iştir.
