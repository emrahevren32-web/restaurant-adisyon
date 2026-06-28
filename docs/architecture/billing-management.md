# Faz 20.7.7 - EVREN360 Fatura ve Tahsilat Takibi

## Finans Ekranı

Fatura ve Tahsilat Takibi ekranı, EVREN360 platform yöneticisinin SaaS müşterilerinin abonelik, fatura, tahsilat, lisans bitişi ve ödeme riski bilgilerini tek merkezden izlemesi için oluşturulmuştur.

Bu fazda gerçek ödeme sağlayıcı entegrasyonu, otomatik fatura kesimi veya tahsilat mutabakatı yapılmaz. Ekran mevcut şirket, lisans, paket ve abonelik verilerinden türetilen Billing Foundation snapshot'ı ile çalışır.

## Sayfa Yapısı

Sayfa şu bölümlerden oluşur:

- Finans KPI kartları
- Tarih, paket, fatura durumu ve tahsilat durumu filtreleri
- Fatura listesi
- Tahsilat takibi
- Yaklaşan lisans bitişleri
- Riskli müşteriler
- Gelir analizi grafikleri
- Billing Foundation servis hazırlığı

EVREN360 menüsünde `Fatura ve Tahsilat Takibi` route'u yalnızca platform yöneticisi tarafından görüntülenebilir.

## Fatura Modeli

Foundation katmanında standart fatura modeli hazırlanmıştır:

- Firma
- Fatura No
- Paket
- Tutar
- Kesim Tarihi
- Son Ödeme Tarihi
- Durum
- Ödeme kanalı

Desteklenen fatura durumları:

- Bekliyor
- Ödendi
- Gecikti
- İptal

Bu model ileride Invoice Service ile gerçek backend kaydına dönüştürülebilecek şekilde ayrıştırılmıştır.

## Tahsilat Modeli

Tahsilat takip modeli firma bazında özet üretir:

- Tahsil edilen tutar
- Bekleyen tutar
- Son tahsilat tarihi
- Sonraki ödeme tarihi
- Tahsilat durumu

Desteklenen tahsilat durumları:

- Tahsil Edildi
- Bekliyor
- Gecikti

Bu yapı ileride Collection Service ve Payment Service ile gerçek tahsilat hareketlerine bağlanabilir.

## Lisans İlişkisi

Finans ekranı mevcut `CompanyLicense` ve `LicensePackage` kayıtlarını kullanır.

Kullanılan ilişkiler:

- Firma lisansı aktif abonelik kaynağıdır.
- Paket fiyatı MRR hesabında kullanılır.
- Lisans bitiş tarihi yaklaşan lisanslar listesine kaynak olur.
- Geciken fatura bulunan firma riskli müşteri olarak işaretlenir.

Tenant, Authentication, Login Architecture ve Role & Permission katmanları değiştirilmemiştir.

## Gelir Analizi

Gelir analizi bölümü şu görünümleri hazırlar:

- Aylık Gelir (MRR)
- Paket Bazlı Gelir
- Tahsilat Durumu
- Ödeme Dağılımı

Bu fazda grafikler demo snapshot verisi üzerinden hesaplanır. İleride BI veya gerçek zamanlı raporlama altyapısı aynı görünüme bağlanabilir.

## Billing Foundation

Yeni foundation yapısı şu servisleri destekleyecek şekilde hazırlandı:

- Billing Engine
- Subscription Engine
- Invoice Service
- Payment Service
- Collection Service

Foundation dosyaları:

- `src/platform-billing/billing-foundation.types.ts`
- `src/platform-billing/billing-foundation.service.ts`

Bu servisler şu anda yalnızca okunabilir snapshot üretir; gerçek tahsilat, ödeme sağlayıcı veya fatura mutasyonu yapmaz.

## Sonraki Faz Hazırlığı

Faz 20.7 SaaS Yönetim Merkezi, müşteri listesi, başvuru operasyonları, müşteri detayları, sistem duyuruları, müşteri istatistikleri, işletme yönetimi ve fatura/tahsilat yönetimi ekranlarıyla operasyonel kapsamını tamamlamış durumdadır.

Sonraki finans fazlarında bu ekran şu altyapılara bağlanabilir:

- Gerçek Invoice Service
- Ödeme sağlayıcı entegrasyonları
- Otomatik tahsilat geçmişi
- Lisans yenileme akışı
- Müşteri borç ve mutabakat raporları
