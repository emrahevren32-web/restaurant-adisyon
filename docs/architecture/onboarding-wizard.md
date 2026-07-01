# Faz 20.12 - First Login & Onboarding Wizard

## Amaç

First Login & Onboarding Wizard, işletme başvurusu onaylandıktan sonra oluşturulan ilk firma sahibinin RestaurantOS'a geçmeden önce temel kurulumu tamamlamasını sağlar. Bu katman Authentication, Identity Resolver, JWT, Tenant Context ve Role & Permission mimarisini değiştirmez.

## First Login Mantığı

Onboarding gereksinimi `src/onboarding/onboarding.service.ts` içinde hesaplanır.

- Kullanıcının `companyId` bilgisi mevcut storage helper üzerinden okunur.
- Kullanıcıya bağlı `CompanySetup` kaydı aranır.
- Setup kaydının `registrationId` değeri `business_application_` ile başlıyorsa bu kayıt Faz 20.8 işletme başvuru akışından gelmiş kabul edilir.
- Setup admin kullanıcısı giriş yapan kullanıcıyla aynıysa ve onboarding completion kaydı yoksa wizard zorunlu gösterilir.
- Tamamlanma bilgisi ayrı `ra_first_login_onboarding_completions` localStorage kaydında tutulur. Böylece mevcut `CompanySetup` davranışı değiştirilmez.

## Wizard Akışı

Wizard adımları:

1. Hoş Geldiniz
2. Firma Bilgileri
3. Logo
4. İlk Şube
5. İlk Kullanıcı Profili
6. Lisans Özeti
7. Kurulum Tamamlandı

Her adım `FirstLoginWizard` ekranında ilerleme göstergesiyle sunulur. Kurulum tamamlanmadan App normal RestaurantOS içeriklerini render etmez.

## Güncellenen Kayıtlar

Tamamlama sırasında aşağıdaki kayıtlar güncellenir:

- `Company`: firma adı, telefon, e-posta, vergi bilgileri, adres, şehir, ilçe ve demo logo.
- `Branch`: ilk şube adı, adres ve telefon.
- `User`: ad soyad, telefon ve opsiyonel profil fotoğrafı.
- `CompanyUser`: firma sahibi profil adı ve telefonu.
- `CompanySetup`: tamamlanma zamanı korunur/güncellenir.

Storage güncellemeleri `allTenants` okuma seçeneğiyle yapılır. Bu sayede firma kullanıcısı kendi kaydını güncellerken diğer tenant kayıtları localStorage üzerinden düşmez.

## Lisans Özeti

Lisans özeti mevcut paket/lisans verilerini gösterir:

- Paket adı
- Lisans başlangıç ve bitiş tarihi
- Durum
- Kalan gün
- Kullanıcı ve şube limitleri

Kodda gelecekteki lisans motoru için TODO bırakılmıştır:

- Module Based License
- User Limit
- Branch Limit
- AI Credits
- Storage
- Support Level

## Responsive Yapı

Wizard masaüstünde çok kolonlu, tablet ve mobilde tek kolonlu çalışacak şekilde `src/styles.css` içinde scoped sınıflarla tasarlanmıştır. Stepper, özet kartları, upload alanları ve lisans kartları dar ekranlarda tek kolona iner.

## Faz 21 Hazırlığı

Bu temel, Faz 21 ve sonraki platform servisleri için hazırdır:

- Gerçek medya yükleme servisi
- Module Based License Engine
- İlk giriş analytics/event kayıtları
- Onboarding durumunun backend session veya company setup modeliyle senkronizasyonu
- Müşteriye başvuru/inceleme süreci durum ekranı
