# Faz 20.7.5 - EVREN360 Müşteri İstatistikleri

## Sayfa Amacı

Müşteri İstatistikleri ekranı, EVREN360 platform yöneticisinin müşteri büyümesini, kullanım oranlarını, paket dağılımını ve gelir metriklerini merkezi olarak analiz etmesi için oluşturulmuştur.

Bu faz yalnızca analitik yönetim ekranıdır. Gerçek zamanlı BI, veri ambarı ve canlı raporlama altyapısı sonraki fazlara bırakılmıştır.

## Dashboard Yapısı

Sayfa şu bölümlerden oluşur:

- EVREN360 başlık alanı
- Tarih, paket ve durum filtreleri
- KPI kartları
- Müşteri büyümesi grafiği
- Paket dağılımı grafiği
- Müşteri durumu grafiği
- Modül kullanımı listesi
- En büyük işletmeler tablosu
- Son eklenen işletmeler kartı

## KPI Kartları

Üst bölümde gösterilen metrikler:

- Toplam Müşteri
- Aktif Müşteri
- Pasif Müşteri
- Deneme Hesabı
- Toplam Şube
- Toplam Kullanıcı
- MRR

MRR ilk sürümde mevcut paketlerin `monthlyPrice` alanı üzerinden hesaplanır. Pasif ve askıdaki müşteriler MRR toplamına dahil edilmez.

## Grafikler

### Müşteri Büyümesi

Mevcut yılın ayları üzerinden yeni müşteri kazanımı gösterilir. Kaynak alan `Company.createdAt` değeridir.

### Paket Dağılımı

Müşterilerin lisans paketleri üzerinden dağılım hesaplanır. Kaynak modeller:

- `CompanyLicense`
- `LicensePackage`

### Müşteri Durumu

Dağılım şu durumlarla hesaplanır:

- Aktif
- Pasif
- Askıda
- Deneme

Deneme durumu lisansın `isTrial` veya `Deneme` statüsünden türetilir.

### Modül Kullanımı

Ana modüllerin kullanım sayıları lisans paketi modülleri üzerinden hesaplanır:

- RestaurantOS
- QR Menü
- Stok
- Cari
- Finans
- Personel

Kaynak model `LicenseModule` kayıtlarıdır.

## Tablolar

### En Büyük İşletmeler

En fazla şubeye sahip ilk 10 firma listelenir.

Kolonlar:

- Firma
- Şube Sayısı
- Kullanıcı Sayısı
- Paket

### Son Eklenen İşletmeler

En yeni müşteri kayıtları `Company.createdAt` alanına göre listelenir.

Gösterilen alanlar:

- Firma
- Kayıt Tarihi
- Paket

## Veri Modeli

Ekran yeni veri modeli eklemez. Mevcut storage servislerini kullanır:

- `loadCompanies`
- `loadBranches`
- `loadCompanyLicenses`
- `loadCompanyUsers`
- `loadLicensePackages`
- `loadLicenseModules`

## Filtreleme

Filtreler istemci tarafında çalışır:

- Tarih Aralığı
- Paket
- Durum

Filtreler dashboard kartları, grafikler ve tabloların tamamına uygulanır.

## Sonraki Faz Hazırlığı

Faz 20.7.6 - İşletme Yönetimi için müşteri segmentleri, paket durumu, lisans durumu, şube/kullanıcı sayıları ve MRR hesaplama altyapısı hazırdır.
