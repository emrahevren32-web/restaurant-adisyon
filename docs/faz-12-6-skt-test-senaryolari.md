# Faz 12.6 - SKT Test Senaryoları

## Kapsam

- SKT takipli stok kartı
- Lot / parti oluşturma
- SKT alanlı stok girişleri
- FEFO stok çıkışı
- Otomatik stok düşümü entegrasyonu
- Ters hareket ve otomatik iade entegrasyonu
- Dashboard, rapor ve işlem geçmişi kayıtları
- Kritik stok sistemi regresyonu

## Senaryolar

1. SKT takipli stok kartı oluşturma
   - SKT takibi aktif ve uyarı günü 7 olan stok kartı oluştur.
   - Kart listesinde SKT rozeti görünmeli.
   - Eski kritik stok sayaçları değişmeden çalışmalı.

2. SKT alanlı stok girişi
   - SKT takipli karta son kullanma tarihi girerek stok girişi yap.
   - Lot kaydı oluşmalı.
   - Hareket geçmişinde SKT tarihi görünmeli.
   - İşlem geçmişinde `SKT lotu oluşturuldu` kaydı oluşmalı.

3. FEFO manuel çıkış
   - Aynı stok kartına farklı SKT tarihli iki lot gir.
   - Stok çıkışı yap.
   - En erken SKT tarihli lot önce düşmeli.
   - Hareket geçmişinde FEFO lot dağılımı görünmeli.
   - İşlem geçmişinde `SKT lotu tüketildi` kaydı oluşmalı.

4. Tarihi geçmiş lot tüketimde atlanır
   - Bir tarihi geçmiş lot ve bir geçerli lot oluştur.
   - Çıkış hareketi yap.
   - Varsayılan FEFO tüketimi tarihi geçmiş lotu atlayıp geçerli lotu düşmeli.
   - Yeterli geçerli lot yoksa harekette SKT eşleşme uyarısı oluşmalı.

5. Yaklaşan SKT uyarısı
   - Uyarı günü içinde kalan SKT tarihli lot oluştur.
   - Dashboard açıldığında SKT özeti uyarıyı göstermeli.
   - İşlem geçmişinde aynı lot için `SKT yaklaşan uyarısı oluştu` kaydı tekrar tekrar üretilmemeli.

6. Tarihi geçmiş ürün yönetimi
   - SKT tarihi geçmiş bir lot oluştur veya mevcut lot tarihini geçmiş güne denk getir.
   - Dashboard ve SKT raporunda `Tarihi geçti` rozeti görünmeli.
   - İşlem geçmişinde `SKT tarihi geçti` kaydı yalnızca durum değişiminde oluşmalı.

7. Otomatik stok düşümü FEFO
   - Reçeteye SKT takipli stok kartı bağla.
   - Masaya ürün ekleyerek otomatik stok düşümü oluştur.
   - Batch satırında FEFO allocation bilgisi saklanmalı.
   - Kritik stok uyarısı gerekiyorsa Faz 12.5 kayıtları yine oluşmalı.

8. Otomatik stok düşümü ters hareketi
   - Otomatik düşümü olan sipariş adedini azalt veya iptal et.
   - İade aynı SKT lotlarına dönmeli.
   - İşlem geçmişinde `SKT lotu iade edildi` kaydı oluşmalı.

9. Manuel ters hareket
   - SKT allocation içeren çıkış hareketini tersle.
   - Ters giriş aynı lotlara iade edilmeli.
   - Orijinal hareket tekrar terslenememeli.

10. Kritik stok çakışma regresyonu
   - SKT takipli stok kartını kritik seviyenin altına düşür.
   - `Kritik stok uyarısı oluştu` kaydı oluşmalı.
   - Stok girişiyle kritik seviyeden çıkar.
   - `Kritik stoktan çıkıldı` kaydı oluşmalı.

11. SKT raporu
   - Raporlama ekranında SKT Raporu bölümünü aç.
   - Uyarılar, tarihi geçmiş, yaklaşan, geçerli, SKT girilmemiş ve tükenmiş filtreleri doğru çalışmalı.
   - SKT olayları dönem filtresine göre listelenmeli.
