# Faz 20.7.4 - EVREN360 Sistem Duyuruları

## Sayfa Amacı

Sistem Duyuruları ekranı, EVREN360 platform yöneticisinin sistem duyurularını oluşturması, planlaması ve yönetmesi için geliştirilmiştir.

Bu faz yalnızca Platform Notification Center altyapısının yayıncı (Publisher) tarafını hazırlar. İstemci bildirimi, dağıtım, okundu takibi ve push notification mekanizmaları bu fazda uygulanmamıştır.

## Veri Modeli

Foundation modeli `src/notifications/notification.types.ts` içinde tanımlanır.

Temel model:

- `id`
- `title`
- `content`
- `type`
- `targetType`
- `targetId`
- `targetLabel`
- `startAt`
- `endAt`
- `status`
- `createdBy`
- `createdAt`
- `updatedAt`

Kayıtlar ilk sürümde `evren360_system_announcements` localStorage anahtarıyla tutulur. Önceki demo kayıtlardaki `publishAt`, `Aktif`, `Yayından Kaldırıldı` gibi eski alan/durumlar normalize edilerek yeni modele uyarlanır.

## Duyuru Tipleri

Desteklenen tipler:

- Bilgilendirme
- Güncelleme
- Bakım
- Güvenlik
- Kampanya
- Lisans

Her tip listede renkli badge ile gösterilir.

## Hedefleme

Desteklenen hedef tipleri:

- Tüm Kullanıcılar
- Tüm Firmalar
- Aktif Müşteriler
- Deneme Hesapları
- Belirli Firma
- Belirli Paket

Belirli firma hedefinde mevcut `Company`, belirli paket hedefinde mevcut `LicensePackage` verisi kullanılır. Hedef ön izlemesi için mevcut kullanıcı, firma ve lisans verilerinden sayım yapılır.

## Durumlar

Desteklenen durumlar:

- Taslak
- Planlandı
- Yayında
- Süresi Doldu

Durumlar başlangıç ve bitiş tarihine göre runtime olarak normalize edilir. Taslak durumundaki kayıtlar otomatik yayına alınmaz.

## Sayfa Yapısı

Sayfa şu bölümlerden oluşur:

- EVREN360 başlık alanı
- Dashboard kartları
- Duyuru oluşturma/düzenleme formu
- Notification Foundation kartları
- Seçili duyuru ön izlemesi
- Duyuru listesi

## Dashboard Kartları

Üst bölümde şu metrikler gösterilir:

- Toplam Duyuru
- Aktif Duyuru
- Planlanan Duyuru
- Taslak Duyuru

## Duyuru Oluşturma

Form alanları:

- Başlık
- İçerik
- Duyuru Tipi
- Hedef
- Başlangıç Tarihi
- Bitiş Tarihi
- Durum

Form yalnızca yönetim paneli kaydı oluşturur. Notification dağıtım mekanizması çalıştırmaz.

## Liste

Tablo kolonları:

- Başlık
- Tip
- Hedef
- Yayın Tarihi
- Durum
- Oluşturan
- İşlemler

Arama alanları:

- Başlık
- İçerik

Filtreler:

- Tip
- Durum
- Hedef

Satır işlemleri:

- Görüntüle
- Düzenle
- Yayınla
- Yayından Kaldır
- Sil

Sil işlemi bu fazda placeholder olarak bırakılmıştır. Yayından kaldırma işlemi kaydı `Taslak` durumuna döndürür.

## Notification Foundation

Foundation katmanı `src/notifications` altında oluşturulmuştur:

- `notification.types.ts`
- `notification.service.ts`

Platform Services uyumluluğu için hazırlanan başlıklar:

- Notification Center
- In-App Notifications
- Read Tracking
- Push Notifications
- Announcement Delivery

Bu yapı ileride gerçek dağıtım, kullanıcı bazlı teslimat, okundu bilgisi ve push kanalı entegrasyonuna genişletilebilir.

## Kullanılan Mevcut Servisler

Sayfa hedefleme ve ön izleme için mevcut storage servislerini kullanır:

- `loadCompanies`
- `loadCompanyLicenses`
- `loadCompanyUsers`
- `loadLicensePackages`
- `loadUsers`

Authentication, Tenant Context, Role & Permission Engine ve Login Architecture üzerinde değişiklik yapılmamıştır.

## Sonraki Faz Hazırlığı

Faz 20.7.5 - Müşteri İstatistikleri için müşteri segmentleri, paket hedefleme ve aktif/deneme müşteri ayrımı hazırdır. Bu segmentasyon müşteri istatistiklerinde tekrar kullanılabilir.
