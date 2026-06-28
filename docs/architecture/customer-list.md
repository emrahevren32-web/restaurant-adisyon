# Faz 20.7.1 - EVREN360 Müşteri Listesi

## Sayfa Amacı

EVREN360 Müşteri Listesi, platform yöneticisinin tüm müşteri firmaları merkezi olarak görüntülemesi için oluşturulan okuma odaklı yönetim ekranıdır.

Bu fazda müşteri düzenleme, detay yönetimi ve lisans değiştirme akışları aktif edilmemiştir. Satır aksiyonları sonraki fazlarda gerçek işlemlere bağlanmak üzere placeholder olarak hazırlanmıştır.

## Veri Modeli

Sayfa yeni bir kalıcı veri modeli eklemez. Mevcut SaaS veri kaynaklarını birleştirerek müşteri satırı üretir:

- `Company`: Firma adı, yetkili, iletişim bilgileri, durum ve kayıt tarihi.
- `CompanyLicense`: Firmanın mevcut veya son lisans durumu.
- `LicensePackage`: Lisans paket adı.
- `Branch`: Firma bazlı şube sayısı.
- `CompanySetup`: Otomatik kurulumdan gelen şube referansları.
- `CompanyUser`: Firma bazlı kullanıcı sayısı.

Silinmiş firma kayıtları liste dışı bırakılır.

## Kolonlar

Tablo aşağıdaki kolonlardan oluşur:

- Firma Adı
- Yetkili
- E-posta
- Telefon
- Paket
- Durum
- Şube Sayısı
- Kullanıcı Sayısı
- Kayıt Tarihi
- İşlemler

Durum alanı `Aktif`, `Pasif`, `Deneme` ve `Askıda` rozetleri ile gösterilir.

## Arama

Arama istemci tarafında çalışır ve şu alanları kapsar:

- Firma adı
- Yetkili adı
- E-posta

Arama değeri Türkçe karakterlere toleranslı normalize edilir.

## Filtreleme

İlk sürümde istemci tarafı filtreleme kullanılır:

- Paket filtresi
- Durum filtresi

Paket seçenekleri listelenen müşteri kayıtlarından otomatik üretilir.

## Sıralama

Tablo aşağıdaki alanlarda sıralama destekler:

- Firma Adı
- Kayıt Tarihi
- Paket

Sıralama yönü `Artan` ve `Azalan` olarak seçilebilir.

## Dashboard Kartları

Sayfa üstünde demo ve mevcut kayıtlar üzerinden hesaplanan özet kartlar bulunur:

- Toplam Müşteri
- Aktif Müşteri
- Deneme Hesabı
- Askıda Hesap

## Menü ve Router

Sayfa EVREN360 Yönetici Paneli menüsüne `Müşteri Listesi` olarak eklenmiştir.

Route anahtarı:

```text
evren360-customer-list
```

Erişim mevcut EVREN360 platform admin ayrımı üzerinden korunur. RestaurantOS kullanıcıları bu sayfayı menüde görmez ve sayfa render noktasında `PlatformAccessDenied` ile engellenir.

## Sonraki Faz Hazırlığı

Faz 20.7.2 - Onay Bekleyen İşletmeler için müşteri liste altyapısı hazırdır. Bu ekrandaki birleşik müşteri satırı yapısı ileride detay, düzenleme, lisans ve başvuru yaşam döngüsü bağlantılarına genişletilebilir.
