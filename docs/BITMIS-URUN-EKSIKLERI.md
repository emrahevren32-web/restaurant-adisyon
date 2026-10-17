# MİYOP · Bitmiş ürün için teknik eksikler

**Tarih:** 17.10.2026 · commit `fc342a2` · göç 0000–0088
**Kapsam:** YALNIZ uygulama/teknik eksikler. Müşteri denemesi, pilot,
demo, satış, yayın ve destek süreçleri bu listede YOK — Emrah'ın isteği.

> Ölçü birimi "tur": bir Claude oturumunda bitirilebilen iş. Tur sayıları
> tahmin; kesin değil ve iş açıldıkça artar. Bugüne kadarki hız: göç
> 0081–0088 arası 8 göç ≈ 6 tur.

---

## A · KAPANMASI ZORUNLU · güvenlik ve veri bütünlüğü

Bir ERP'de bu başlık bitmeden "bitmiş ürün" denmez, çünkü buradaki her
madde **yanlış veriyi doğru gibi gösterme** riskidir.

| # | Ne | Durum |
|---|---|---|
| MIYOP-003 | Çapraz kiracı referansı + denetim özeti sızıntısı | açık, **sıradaki işim** |
| MIYOP-033 | Onaylanmış revizyona satır eklenebiliyor | açık, P0 |
| MIYOP-034 | `current_revision` geri alınıp eski onay yeniden kullanılabiliyor | açık, P0 |
| MIYOP-004 | Sahte ters kayıt negatif stok kontrolünü aşıyor | açık, P0 |
| MIYOP-005 | Satır güncellemesinde `delete`+`insert` → veri kaybı | açık, P0 |
| MIYOP-006 | İşlemler atomik ve tekrar denenebilir değil | açık, P1 |
| MIYOP-011 | Eşzamanlı çıkışlar aynı lotu negatife düşürüyor | açık, P1 |
| MIYOP-013 | Tedarikçi iadesi yanlış lottan düşebiliyor | açık, P1 |
| MIYOP-014 | HACCP kararı (PASS/FAIL) istemciden geliyor | açık, P1 |
| MIYOP-015 | Sevk iptalinde sipariş durumu geri hesaplanmıyor | açık, P1 |
| MIYOP-016 | Üretim maliyeti sonraki alışlardan etkileniyor | açık, P1 |
| MIYOP-017 | Çıkış Supabase oturumunu kapatmıyor | açık |
| MIYOP-018 | Zorunlu parola değişimi tek RPC ile atlanabiliyor | açık |
| MIYOP-036 | Var olmayan revizyon numarasına onay yazılabiliyor | açık, P1 |
| — | PUBLIC EXECUTE temizliği · 7 fonksiyon | açık |
| — | `db/migrations/g7_rls_kapat.sql` dosyası duruyor | açık |

**Tahmin: 10–14 tur.**

---

## B · YARIM İŞLER · ekranda var, arkasında yok

Kullanıcı Kaydet'e basıyor, ekran "kaydedildi" diyor, veri tarayıcıda
kalıyor. Bu, eksik özellikten daha kötüdür: **yokluk dürüsttür, yarım
olan yalan söyler.**

- 6 kiracı ekranı `storage.ts` (tarayıcı hafızası) kullanıyor:
  Firma Profili · Profilim · Şube Yetkileri · İşletme Ayarları · Şubeler
  (Profilim şu an hiç çalışmıyor: "Kullanıcı kaydı bulunamadı")
- MIYOP-008 · başlıkta seçilen şube gerçek sorgulara aktarılmıyor
  (B şubesi seçiliyken kayıt A'ya yazılabiliyor)
- MIYOP-010 · etiket ekranında ürünler arası veri karışması
- MIYOP-028 · pasif lisansın gerçek durumu görünmüyor
- Bildirim zili kiracı tarafında hiç çalışmıyor; depo tarayıcıda
- EVREN360 panelinde 11 ekran hâlâ kilitli (veritabanı okumuyor)
- Depoda **36 mock dosyası** duruyor; hiçbiri açık rotadan erişilemiyor
  ama silinmeleri gerekiyor
- `db/prova` altındaki 50 dosyanın **11'i geçmiyor** ve provalar yayın
  kapısında değil — "prova var" demek "prova geçiyor" demek değil

**Tahmin: 8–11 tur.**

---

## C · HİÇ YAZILMAMIŞ ÖZELLİKLER

Bunlar yokluk; kodu yok. Bir endüstriyel mutfak müşterisinin "bu iş
bitti" demesi için gerekenler:

### C.1 · Para tarafı — en büyük boşluk
- **Fatura kesme paneli** (yok)
- **e-Fatura / e-Arşiv / e-İrsaliye** · özel entegratör API bağlantısı
  (yok; veri alanları hazır — VKN, vergi dairesi, KEP, kalem bazında KDV)
- **Cari hesap** · müşteri borç/alacak, tahsilat, vade takibi (yok)
- **Muhasebe programına aktarım dosyası** (yok)
- Mali mühür + KEP kurulumu (teknik iş değil ama bağımlılık)

### C.2 · Operasyon
- **Personel / vardiya / puantaj** (yok)
- **Depo raf adresi** · lokasyon yönetimi (yok)
- **Makine bakım takibi** (yok)
- **Barkod / el terminali okuma** (yok — mal kabul ve sayım elde yapılır)
- Üretim planlama gerçek defterden (servisler var, veri bağı zayıf)

### C.3 · Platform (EVREN360) · 7 menü hâlâ kilitli
Kontrol Paneli (gerçek sayaçlar) · Tenant Yönetimi · Fatura ve Tahsilat ·
Sektör Yönetimi · Sistem Duyuruları · Destek Talepleri · Sistem Ayarları
+ ödeme takibi ve tek düğmeyle pasife alma (4.8)

### C.4 · Kullanıcıya dokunan prestij işleri
Yardım Merkezi (SSS) · geri bildirim düğmesi · sohbet modülü ·
MİYOP ana sayfası + alt bilgi sayfaları · toplu duyuru

**Tahmin: C.1 6–10 tur (entegratör sözleşmesi gerekli) ·
C.2 10–14 tur · C.3 6–8 tur · C.4 4–6 tur.**

---

## D · ÖLÇÜLMEMİŞ DAYANIKLILIK

Bunlar "yazılacak kod" değil, **ölçülecek davranış.** Ölçmeden "bitti"
demek dürüst olmaz.

1. **Hacim.** Stok bakiyesi defterden TÜRETİLİYOR. Defter on binlerce
   satıra çıkınca ekranlar yavaşlar. Çözümü biliniyor (özet tablo +
   indeks) ama önce ölçmek gerekir.
2. **Eşzamanlılık.** İki kullanıcı aynı lota/siparişe aynı anda
   dokunduğunda. Idempotency anahtarı var, çok kullanıcılı sınama yok.
3. **Tablet ve telefon.** Ekranlar masaüstü odaklı; depoda insanlar masa
   başında değil.
4. **Gerçek yazıcı.** Etiket (58 mm, 100×150 mm) ve irsaliye hiç
   termal/lazer yazıcıda denenmedi.
5. **Sürüm yükseltme disiplini.** Müşteri canlıda çalışırken göç
   çalıştırma prosedürü yazılı değil (yedek → göç → doğrula → geri dönüş).
6. **Yedek.** Supabase ücretsiz planda **veritabanı yedeği yok.**
   Pro'ya geçiş ilk müşteri anlaşmasından sonra (bilinçli karar).
   MIYOP-020: geri yükleme provası hatayı başarısızlık saymıyor.

**Tahmin: 6–9 tur + donanım gerekiyor (termal yazıcı, tablet).**

---

## Toplam

| Başlık | Tur |
|---|---|
| A · Güvenlik ve bütünlük | 10–14 |
| B · Yarım işler | 8–11 |
| C · Yazılmamış özellikler | 26–38 |
| D · Dayanıklılık | 6–9 |
| **Toplam** | **50–72 tur** |

## Bunu nasıl okumalı

**"Bitmiş ürün" tek bir çizgi değil, üç ayrı çizgi.** Hangisini
hedeflediğimizi seçmek lazım:

1. **Satılabilir** (A + B + C.3 + C.4 kısmı ≈ **28–38 tur**)
   Mutfağın operasyonu eksiksiz çalışır: satın alma, mal kabul, üretim,
   izlenebilirlik, HACCP, sevkiyat, sipariş. Para tarafı yok — müşteri
   faturasını bugünkü programıyla keser, MİYOP operasyonu yönetir.
   **Benim önerim bu.** Çünkü bir müşteri olmadan C.1'e para harcamak
   (entegratör, mali mühür) ters sırada iş yapmaktır.

2. **Tam ERP** (hepsi ≈ **50–72 tur**)
   Fatura da MİYOP'tan kesilir, cari hesap MİYOP'ta durur, muhasebeye
   dosya gider.

3. **Rakiplerle eşit** (2 + barkod + tablet + raf adresi + personel)
   Buraya **D maddesindeki ölçümler olmadan gidilmez** — hacim ve
   eşzamanlılık ölçülmemiş bir sistemde özellik eklemek borç biriktirir.

⚠️ **Dürüst kayıt:** bu tahminler bugünkü bilgiye dayanıyor. 0085'te
"MIYOP-001 kapandı" dedim, Codex 26 tablo daha buldu, ben 27. buldum.
Her denetim turu listeyi uzatıyor. Tur sayıları **alt sınır** sayılmalı.
