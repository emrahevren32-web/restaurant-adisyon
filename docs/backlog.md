# MİYOP · Backlog

> Buraya yazılan hiçbir şey reddedilmiş değildir — **sırası gelmemiştir.**
>
> Kural: Production Foundation sürerken bu listeden hiçbir madde alınıp yapılmaz.
> Yeni fikir çıktığında tartışılmaz, buraya yazılır ve konu kapanır.
> Bu liste "hayır" demeyi kolaylaştırmak için var.

**Serbest bırakma koşulu:** Dilim 7 bitip pilot en az bir işletmede 4 hafta sorunsuz
çalıştıktan sonra bu liste yeniden önceliklendirilir.

---

## Sıradaki (çekirdek bitince ilk açılacaklar)

| Öğe | Neden bekliyor | Ön koşul |
|-----|----------------|----------|
| **HACCP yönetimi** | İzlenebilirlik altyapısı olmadan form doldurma ekranından ibaret kalır. Defter hazır olduğunda gerçek değer üretir. | Dilim 5 |
| **Kalite kontrol + numune takibi** | Aynı gerekçe; lot bağı olmadan anlamsız. | Dilim 5 |
| **Etiket yönetimi** | Lot kodu ve SKT gerçek olmadan basılacak etiket yok. | Dilim 1, 5 |
| **Satın alma onay akışı** | Sipariş zinciri gerçek çalıştıktan sonra üstüne kurulur. | Dilim 2 |
| **Fire yönetimi ekranı** | Fire hareketi Dilim 6'da deftere giriyor; ekran ondan sonra. | Dilim 6 |

---

## Analitik ve raporlama

Hepsi aynı gerekçeyle bekliyor: **gerçek veri olmadan yazılan analitik, uydurma analitiktir.**
Defter dolduğunda bunların çoğu birer SQL sorgusuna iner.

- KPI Dashboard
- Günlük / Haftalık Üretim Analizi
- Sevkiyat Analizi
- Fire Analizi
- Maliyet Analizi · Cost Engine
- Depo Performansı
- Personel Performansı
- Procurement Analytics
- Executive Dashboard

## Karar destek ve yapay zekâ

- Karar Destek Merkezi
- Tahminleme
- Otomatik Öneriler · Öneri Motoru
- Yapay Zekâ Analizi
- Maliyet Optimizasyonu
- Satın Alma Önerileri
- Üretim Planlama Önerileri
- Fire Tahmini
- Sevkiyat Optimizasyonu
- Kritik Alarmlar · Yönetici Alarmları

## Üretim planlama

- Üretim Planlama
- Kapasite Planlama
- Makine Çizelgeleme
- Darboğaz Analizi
- Ara Ürünler
- Üretim Hatları

## Lojistik

- Sevkiyat Planlama
- Araç Planlama
- Palet Yönetimi
- Sevkiyat İade
- Sevkiyat İş Emirleri

## Finans ve personel

- Cari hesaplar
- Veresiye
- Kasa · Gelir-Gider · Kasa Kapanış
- Personel · Vardiya · Puantaj · Performans · Prim

## Platform (çok kiracılı self-servis)

- Modül Mağazası
- Entegrasyon Merkezi
- Lisans paketleri · Abonelik
- Destek talepleri
- AI Merkezi
- Excel Merkezi
- Karşılama / onboarding akışı
- Bildirim merkezi

## Restoran POS tarafı

Ayrı bir üründür. Endüstriyel mutfak çekirdeği satılabilir hâle geldikten sonra
"bunu ayrı ürün olarak mı konumlandıralım" sorusu ayrıca ele alınır.

- Adisyon · Masa yönetimi · Hazırlık ekranı
- QR menü · Dijital talepler · Görevli çağrıları

---

## Sonradan eklenen fikirler

> Yeni fikirler buraya, tarihle birlikte. Tartışma yok, kayıt var.

| Tarih | Fikir | Kimden |
|-------|-------|--------|
| 2026-08-24 | **Dondurulmuş modüllerdeki tanımlayıcı karşılaştırması.** `UserSubscriptionManagement.tsx` (satır 295, 303, 307) hâlâ `toLocaleLowerCase('tr-TR')` ile kullanıcı adı karşılaştırıyor. Modül dondurulduğu için ürün yüzeyinde değil; geri açılırken `core/identifier.ts`'e bağlanacak. | Codex incelemesi |
| 2026-08-24 | **Lot numarası karşılaştırması.** `inventory-lot.mock.ts` (satır 103, 226, 238, 246) aynı hatayı taşıyor. Dosya bir mock ve Dilim 1'de gerçek servisle değiştirilecek; yama yapmak yerine yeni serviste doğru yazılacak. İzlenebilirliğin temeli olduğu için Dilim 1'in bitti tanımına dahil. | Codex incelemesi |
| 2026-08-24 | **Sol menü tipografisi.** Supabase'in kenar çubuğundaki yazılar daha ince ve daha okunaklı; MİYOP'unki hâlâ kalın ve iri duruyor. Menü ögesi ağırlığı, punto ve satır aralığı yeniden ele alınmalı. Dilim 4'te Kontrol Paneli yeniden yazılırken kabuk tipografisiyle birlikte yapılacak — şimdi yapılmaz, kapsam dışı. | Emrah |
