# Faz 12.5 - Kritik Stok Test Senaryoları

## Kritik stok hesaplama

1. Aktif stok kartında mevcut miktar kritik seviyeden büyükse durum `Sağlıklı` görünür.
2. Aktif stok kartında mevcut miktar kritik seviyeye eşitse durum `Kritik` görünür.
3. Aktif stok kartında mevcut miktar kritik seviyeden küçükse durum `Kritik` görünür.
4. Pasif stok kartı mevcut miktarı kritik seviyede olsa bile kritik stok sayaçlarına girmez.
5. Mevcut miktar 0 veya negatif olan aktif kart `Stokta Yok` sayacına girer.

## Stok kartı ekranı

1. Kritik stok filtresi sadece aktif ve kritik stok kartlarını listeler.
2. Stokta yok filtresi sadece aktif ve mevcut miktarı 0 veya negatif kartları listeler.
3. Sağlıklı stok filtresi sadece aktif ve kritik olmayan kartları listeler.
4. Kategori, birim ve arama filtreleri kritik stok filtresiyle birlikte çalışır.
5. Kritik satırda durum rozeti, eksik miktar ve risk çubuğu görünür.

## Kritik stok logları

1. Sağlıklı kart manuel çıkış hareketiyle kritik seviyeye düşerse tek `Kritik stok uyarısı` işlem geçmişi kaydı oluşur.
2. Aynı kart kritikken tekrar çıkış hareketi yapılırsa yeni kritik stok uyarısı oluşmaz.
3. Kritik kart stok girişiyle kritik seviyenin üstüne çıkarsa tek `Kritik stoktan çıkıldı` kaydı oluşur.
4. Kritik stoktan çıkmış kart tekrar kritik seviyeye düşerse yeni bir kritik stok uyarısı oluşur.
5. Kritik seviye güncellemesi kartı kritik hale getirirse kritik stok uyarısı oluşur.
6. Kritik seviye güncellemesi kartı kritik durumdan çıkarırsa kritik stoktan çıkış kaydı oluşur.
7. Kritik kart pasif yapılırsa kritik stoktan çıkış kaydı oluşur.
8. Pasif kart aktif yapılınca mevcut miktarı kritik seviyedeyse kritik stok uyarısı oluşur.

## Otomatik stok düşümü entegrasyonu

1. Reçeteli sipariş stok kartını kritik seviyeye ilk kez düşürürse otomatik stok düşümü başarılı kalır ve kritik stok uyarısı oluşur.
2. Aynı kritik kart için sonraki reçeteli siparişlerde tekrar kritik stok uyarısı oluşmaz.
3. Otomatik stok düşümü stok miktarını negatife düşürürse mevcut Faz 12.4 davranışı korunur ve kritik stok durumu görünür kalır.
4. Sipariş azaltma veya silme ile otomatik stok iadesi kartı kritik seviyenin üstüne çıkarırsa kritik stoktan çıkış kaydı oluşur.

## Dashboard ve rapor

1. Admin kullanıcının günlük satış ekranında kritik stok özeti görünür.
2. Garson kullanıcının günlük satış ekranında kritik stok özeti görünmez.
3. Raporlama ekranında kritik stok, stokta yok, dönem kritik olayı ve dönem çıkış olayı sayaçları doğru hesaplanır.
4. Kritik stok raporu durum, kategori, birim ve arama filtrelerine göre güncellenir.
5. Kritik stok olayları tablosu dönem filtresine göre kritik olma ve kritik stoktan çıkış olaylarını listeler.
