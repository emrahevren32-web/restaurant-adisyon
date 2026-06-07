# Faz 12.7 - Fire Yönetimi Test Senaryoları

Bu senaryolar Faz 12.1 - 12.6.1 stok, kritik stok, SKT/lot ve FEFO akışları korunarak doğrulanmalıdır.

## Senaryolar

1. Normal fire kaydı
   - Aktif bir stok kartında mevcut stoktan küçük bir fire miktarı gir.
   - Beklenen: `Çıkış / Fire` stok hareketi oluşur, `StockWasteRecord` aktif kaydedilir, stok azalır.
   - İşlem geçmişinde `Fire kaydı oluşturuldu` kaydı görünür.

2. FEFO lot bazlı fire
   - SKT takipli üründe iki geçerli lot oluştur.
   - Fire kaydı gir.
   - Beklenen: Fire en erken SKT'li lotlardan düşer ve fire kaydında `expiryAllocations` saklanır.
   - Lot geçmişinde `Fire düşüldü` olayı görünür.

3. SKT geçmesi kaynaklı fire
   - SKT takipli üründe tarihi geçmiş lot oluştur.
   - Fire nedeni `SKT Geçmesi` seçilerek fire gir.
   - Beklenen: Yalnızca tarihi geçmiş lotlardan düşüm yapılır.
   - İşlem geçmişinde `SKT nedeniyle fire oluşturuldu` kaydı oluşur.

4. SKT geçmiş lot yetersizliği
   - SKT takipli üründe tarihi geçmiş lot miktarından büyük `SKT Geçmesi` fire miktarı gir.
   - Beklenen: Fire kaydı oluşturulmaz, kullanıcıya tarihi geçmiş lot miktarı yetersiz uyarısı verilir.

5. Kritik stok entegrasyonu
   - Kritik seviyenin üstündeki stok için fire girerek mevcut miktarı kritik seviyeye düşür.
   - Beklenen: Fire kaydı oluşur ve yalnızca durum değişiminde `Kritik stok uyarısı oluştu` logu üretilir.

6. Fire ters hareketi
   - Oluşturulan fire hareketi için `Ters Hareket` çalıştır.
   - Beklenen: Stok geri eklenir, lot allocation iade edilir, fire kaydı silinmez ve `reversed` olur.
   - İşlem geçmişinde `Fire kaydı terslendi` kaydı görünür.

7. Yüksek maliyetli fire onayı
   - Son alış fiyatı olan stokta tahmini maliyeti eşik üstüne çıkaran fire miktarı gir.
   - Beklenen: Onay paneli görünür; onay verilmeden fire kaydı oluşmaz.

8. Dashboard ve rapor
   - Fire kaydı oluşturduktan sonra Günlük Özet ve Raporlama ekranlarını aç.
   - Beklenen: Fire özeti, maliyet toplamı, neden/personel kırılımları ve lot bilgileri görünür.
