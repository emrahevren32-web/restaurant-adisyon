# Faz 20.7.2 - EVREN360 Onay Bekleyen İşletmeler

## Sayfa Amacı

Onay Bekleyen İşletmeler ekranı, EVREN360 yöneticisinin açık işletme başvurularını merkezi bir operasyon kuyruğu olarak yönetmesi için oluşturulmuştur.

Bu ekran başvuru oluşturma sistemi değildir. Başvuru oluşturma ve başvuru yaşam döngüsü Faz 20.8 altyapısı üzerinden çalışmaya devam eder.

## Liste Yapısı

Sayfa mevcut `BusinessApplication` modelini kullanır ve kalıcı veri modelinde değişiklik yapmaz.

Operasyon kuyruğunda yalnızca açık başvurular gösterilir:

- `Beklemede`
- `İnceleniyor`

Tablo kolonları:

- Firma Adı
- Yetkili
- E-posta
- Telefon
- Başvuru Tarihi
- Başvuru Durumu
- İşlemler

Onaylanan veya reddedilen başvurular işlem sonrası bu kuyruktan çıkar.

## Filtreleme

Filtreler istemci tarafında çalışır:

- Başvuru Durumu
- Başvuru Tarihi

Başvuru tarihi filtresi tek gün seçimi ile çalışır. Durum filtresi yalnızca açık kuyruk durumlarını kapsar.

## Arama

Arama alanı aşağıdaki alanlarda çalışır:

- Firma adı
- Yetkili adı
- E-posta

Arama değeri Türkçe karakterlere toleranslı normalize edilir.

## Dashboard Kartları

Üst özet kartları açık başvuru kuyruğu üzerinden hesaplanır:

- Bekleyen Başvuru
- Bugün Gelen
- Bu Hafta Gelen
- Ortalama Bekleme Süresi

Ortalama bekleme süresi başvurunun oluşturulma tarihi ile mevcut zaman arasındaki fark üzerinden hesaplanır.

## Satır İşlemleri

Satır aksiyonları yeni backend mantığı yazmadan Faz 20.8 servislerini kullanır:

- `İncele`: `markBusinessApplicationInReview`
- `Onayla`: `approveBusinessApplication`
- `Reddet`: `rejectBusinessApplication`
- `Notlar`: `addApplicationNote`
- `Geçmiş`: Sayfa içi geçmiş sekmesini açar.

Onay işlemi mevcut servis üzerinden firma, tenant, şube, lisans, abonelik ve ilk kullanıcı oluşturma akışını tetikler. Red işleminde red sebebi mevcut servis tarafından zorunlu tutulur.

## Menü ve Router

Sayfa EVREN360 Yönetici Paneli menüsüne `Onay Bekleyen İşletmeler` olarak eklenmiştir.

Route anahtarı:

```text
evren360-pending-applications
```

Erişim mevcut EVREN360 `platformAdminOnly` ayrımı ve render seviyesindeki `PlatformAccessDenied` koruması ile sağlanır. Authentication altyapısı değiştirilmemiştir.

## Sonraki Faz Hazırlığı

Faz 20.7.3 - Müşteri Detay Ekranı için açık başvuru kuyruğu, müşteri listesi ve mevcut onay yaşam döngüsü bağlantıları hazırdır. Onaylanan başvurular mevcut 20.8 servisleriyle müşteri/firma kayıtlarına dönüştüğü için detay ekranı bu kayıtlar üzerinden geliştirilebilir.
