# Faz 20.7.6 - EVREN360 İşletme Yönetimi

## Sayfa Amacı

İşletme Yönetimi ekranı, EVREN360 platform yöneticisinin seçilen işletmeyi tek merkezden görüntüleyebilmesi ve operasyonel yönetim aksiyonlarına hazırlanabilmesi için oluşturulmuştur.

Bu fazda gerçek lisans servisi, ödeme altyapısı, modül aktivasyon servisi veya kullanıcı/şube CRUD işlemi uygulanmamıştır. Aksiyonlar placeholder olarak hazırlanmıştır.

## Sayfa Yapısı

Sayfa şu bölümlerden oluşur:

- EVREN360 başlık alanı
- İşletme seçimi
- Hızlı işlemler
- Dashboard kartları
- İşletme genel bilgileri
- Lisans yönetimi
- Tenant bilgileri
- Modül yönetimi
- Şube yönetimi
- Kullanıcı yönetimi

## İşletme Bilgileri

`Company` ve `Tenant` kayıtları üzerinden şu bilgiler gösterilir:

- Firma Adı
- Yetkili
- Telefon
- E-Posta
- Tenant
- Oluşturulma Tarihi
- Son Güncelleme

İşletme durumu `Aktif`, `Askıda`, `Pasif` veya `Deneme` olarak badge ile gösterilir. Deneme durumu lisansın trial bilgisinden türetilir.

## Yönetim Kartları

Dashboard kartları:

- Şube Sayısı
- Kullanıcı Sayısı
- Aktif Modül
- Lisans Durumu

Bu kartlar seçili işletmenin şube, kullanıcı, lisans ve modül kayıtlarından hesaplanır.

## Lisans Yönetimi

Lisans kartı mevcut `CompanyLicense` ve `LicensePackage` kayıtlarını kullanır.

Gösterilen bilgiler:

- Paket
- Başlangıç Tarihi
- Bitiş Tarihi
- Kalan Gün
- Durum

Hazırlanan placeholder işlemler:

- Lisans Uzat
- Paket Değiştir
- Lisansı Askıya Al

## Tenant Yönetimi

Tenant kartı mevcut `Tenant` kayıtlarını kullanır.

Gösterilen bilgiler:

- Tenant ID
- Oluşturulma Tarihi
- Durum

Tenant oluşturma, değiştirme veya izolasyon mantığı bu fazda değiştirilmemiştir.

## Modül Yönetimi

Modül yönetimi kartı mevcut lisans paketi modüllerini gösterir.

Ana modüller:

- RestaurantOS
- QR Menü
- Stok
- Cari
- Finans
- Personel

Her modül için aktif/pasif badge ve `Aç` / `Kapat` placeholder aksiyonları bulunur. Gerçek aktivasyon yapılmaz.

## Şube Yönetimi

`Branch` kayıtları seçili işletmeye göre listelenir.

Kolonlar:

- Şube Adı
- Durum
- Kullanıcı Sayısı
- İşlemler

Hazırlanan placeholder işlemler:

- Görüntüle
- Düzenle

## Kullanıcı Yönetimi

`CompanyUser` kayıtları seçili işletmeye göre listelenir.

Kolonlar:

- Ad Soyad
- Rol
- Durum
- Son Giriş
- İşlemler

Hazırlanan placeholder işlemler:

- Düzenle
- Devre Dışı Bırak
- Şifre Sıfırla

## Hızlı İşlemler

Sayfa üstünde operasyon kısayolları hazırlanmıştır:

- Lisans Uzat
- Modül Ekle
- Modül Kaldır
- Kullanıcı Oluştur
- Şube Oluştur
- İşletmeyi Askıya Al

Bu işlemler bu fazda veri değiştirmez.

## Kullanılan Servisler

Sayfa mevcut storage servislerini kullanır:

- `loadCompanies`
- `loadTenants`
- `loadBranches`
- `loadBranchPermissions`
- `loadUsers`
- `loadCompanyUsers`
- `loadCompanyLicenses`
- `loadLicensePackages`
- `loadLicenseModules`

Authentication, Tenant Context, Role & Permission Engine ve Login Architecture değiştirilmemiştir.

## Sonraki Faz Hazırlığı

Faz 20.7.7 - Fatura ve Tahsilat Takibi için işletme seçimi, lisans bilgisi, paket bilgisi, tenant bilgisi ve operasyon paneli altyapısı hazırdır. Fatura ve tahsilat kartları bu işletme yönetimi bağlamına bağlanabilir.
