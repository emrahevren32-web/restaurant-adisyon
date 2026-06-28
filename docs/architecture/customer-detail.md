# Faz 20.7.3 - EVREN360 Müşteri Detay Ekranı

## Sayfa Amacı

Müşteri Detay Ekranı, EVREN360 platform yöneticisinin seçilen bir müşteri firmasını tek ekranda izlemesi için oluşturulmuştur.

Bu fazda yeni veri modeli eklenmemiştir. Ekran mevcut SaaS kayıtlarını birleştirerek okuma ve yönetim görünümü sağlar. Müşteri düzenleme, lisans değiştirme, şube detayına gitme ve destek yönetimi sonraki fazlara bırakılmıştır.

## Router ve Geçiş

Yeni route anahtarı:

```text
evren360-customer-detail
```

`Müşteri Listesi` ekranındaki `Detay` butonu seçilen `companyId` değerini App state üzerinden taşır ve kullanıcıyı müşteri detay route'una geçirir.

Route EVREN360 güvenlik hedefi altında değerlendirilir ve mevcut `platformAdminOnly` / `PlatformAccessDenied` yaklaşımı korunur.

## Kart Yapısı

Sayfa şu ana bloklardan oluşur:

- Üst EVREN360 başlık alanı
- Geri dönüş aksiyonu ve müşteri durum rozeti
- Dashboard kartları
- İşletme bilgileri
- Lisans bilgileri
- Şubeler
- Kullanıcılar
- Modüller
- Giriş geçmişi
- Destek geçmişi

## Dashboard Kartları

Üst özet kartları seçili müşterinin ilişkili kayıtlarından hesaplanır:

- Şube Sayısı
- Kullanıcı Sayısı
- Aktif Modül
- Lisans Durumu

## Veri Modeli

Ekran aşağıdaki mevcut modelleri kullanır:

- `Company`
- `CompanyLicense`
- `LicensePackage`
- `LicenseModule`
- `Branch`
- `BranchPermission`
- `CompanyUser`
- `PlatformSupportTicket`
- `SystemUsageLog`
- `User`

Yeni tablo, yeni kalıcı alan veya tenant izolasyon değişikliği yapılmamıştır.

## Bölümler

### İşletme Bilgileri

`Company` üzerinden firma adı, yetkili, telefon, e-posta, adres, vergi bilgileri, kayıt tarihi ve son güncelleme gösterilir.

Durum, firma ve lisans verisi birlikte yorumlanarak `Aktif`, `Pasif`, `Deneme` veya `Askıda` olarak badge ile gösterilir.

### Lisans Bilgileri

`CompanyLicense` ve `LicensePackage` üzerinden paket, lisans başlangıcı, lisans bitişi, lisans durumu ve kalan gün hesaplanır.

### Şubeler

`Branch` kayıtları `companyId` ile filtrelenir. Şube kullanıcı sayısı için öncelikle `BranchPermission` kayıtları kullanılır. Şube yetki kaydı yoksa ilk şubede firma kullanıcı sayısı gösterilir.

### Kullanıcılar

`CompanyUser` kayıtları `companyId` ile filtrelenir. Silinmiş kullanıcılar liste dışı bırakılır.

### Modüller

Aktif lisansın paket modülleri `LicenseModule` kayıtları üzerinden okunur. Ana modüller kart halinde gösterilir:

- RestaurantOS
- QR Menü
- Stok
- Finans
- Cari
- Personel

### Giriş Geçmişi

Öncelikle `SystemUsageLog` içinde giriş aksiyonları aranır. Giriş logu yoksa mevcut kullanıcıların son giriş alanlarından demo uyumlu görünüm oluşturulur.

### Destek Geçmişi

`PlatformSupportTicket` kayıtları `companyId` ile filtrelenir. Destek sistemi sonraki fazlarda genişletilecektir.

## Kullanılan Servisler

Sayfa yalnızca mevcut storage servislerini çağırır:

- `loadCompanies`
- `loadCompanyLicenses`
- `loadLicensePackages`
- `loadLicenseModules`
- `loadBranches`
- `loadBranchPermissions`
- `loadCompanyUsers`
- `loadPlatformSupportTickets`
- `loadSystemUsageLogs`
- `loadUsers`

## Sonraki Faz Hazırlığı

Faz 20.7.4 - Sistem Duyuruları için EVREN360 altında gizli route, seçili müşteri state aktarımı ve detay ekranı yerleşimi hazırdır. Duyuru veya müşteri bazlı yönetim aksiyonları bu sayfaya yeni model değişikliği yapmadan bağlanabilir.
