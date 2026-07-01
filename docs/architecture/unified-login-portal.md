# Faz 20.11 - Unified Login Portal

## Portal Mimarisi

Unified Login Portal, MIYOP Platformu'nun ortak giriş ve vitrin ekranı olarak oluşturulmuştur.

Bu faz yalnızca arayüz katmanını geliştirir. Authentication Service, Identity Resolver, Login Router, Security Gateway, JWT Foundation, Tenant Context ve Role & Permission Engine değiştirilmemiştir.

Portal mevcut `Login` bileşeni üzerinden çalışır ve başarılı girişte daha önce hazırlanmış Authentication Pipeline devreye girer.

## Bölümler

Portal aşağıdaki ana bölümlerden oluşur:

- Header
- Hero
- Login Paneli
- Platform Tanıtımı
- Son Güncellemeler
- Sistem Duyuruları
- Referans Müşteriler
- Neden MIYOP?
- Footer

Hero alanında proje içi bitmap asset kullanılır:

- `public/assets/miyop-login-portal-hero.png`

## Authentication Akışı

Login panelindeki form mevcut authentication servisini kullanır:

```ts
authenticateCredentials(username, password, {
  requestedPath: window.location.pathname
})
```

Başarılı girişte `onLogin(result.state)` çağrılır. Bu davranış önceki login akışıyla aynıdır.

Bu fazda yeni authentication servisi, JWT üretimi, session davranışı veya route guard eklenmemiştir.

## Identity Resolver İlişkisi

Authentication başarılı olduktan sonra mevcut Identity Resolver ve Login Router akışı korunur.

Beklenen yönlendirme kararları:

- `SUPER_ADMIN` -> EVREN360
- `COMPANY_ADMIN` -> RestaurantOS Admin
- `COMPANY_USER` -> RestaurantOS User
- `PUBLIC` -> Başvuru Sayfası

Portal bu kararları kendisi hesaplamaz; mevcut Authentication Pipeline sonucunu App seviyesine aktarır.

## Güncellemeler ve Duyurular

Son Güncellemeler alanı demo portal verisiyle çalışır.

Sistem Duyuruları alanı mevcut Notification Foundation ile uyumludur ve `loadSystemAnnouncements` üzerinden duyuru snapshot'ı okur. Bu fazda istemci bildirim dağıtımı veya read tracking yapılmaz.

## Referans Müşteriler

Referans müşteriler ilk demo işletmeleri temel alır:

- ABC Cafe
- Lezzet Restoran
- Kahve Durağı

Bu alan yalnızca vitrindir; müşteri yönetimi veya lisans işlemi içermez.

## Responsive Yapı

Portal üç ana kırılımda çalışır:

- Desktop: Hero metni ve login paneli yan yana
- Tablet: İçerik tek kolonlu akışa yaklaşır
- Mobil: Header, hero aksiyonları, login paneli ve kart grupları tek kolon olur

Responsive stiller `src/styles.css` içinde `unified-login-*` sınıflarıyla tanımlanmıştır.

## Sonraki Faz Hazırlığı

Faz 20.12 - First Login & Onboarding Wizard için portal hazırdır.

Hazır bırakılan bağlantı noktaları:

- İşletme başvurusu butonu `/apply` rotasına gider.
- Şifremi unuttum aksiyonu placeholder olarak konumlandırılmıştır.
- Sistem duyuruları Notification Foundation ile uyumludur.
- Login sonrası mevcut Identity Resolver ve Login Router devrededir.
