# Codex denetimi · 17.10.2026 · özet ve durum

Codex bütün depoyu salt okunur denetledi: **30 bulgu · 5 P0 · 16 P1 ·
8 P2 · 1 P3.** Raporun kendi sınırı: hiçbir şey çalıştırılmadı, sonuçlar
kaynak kod incelemesine dayanıyor.

## Doğrulanan ve KAPATILAN

| # | Bulgu | Durum |
|---|---|---|
| **MIYOP-001** | `authenticated` rolü stok defterine ve 8 tabloya daha izin kontrolü OLMADAN yazabiliyordu. RLS yalnız kiracı eşitliğine bakıyordu. | ✅ **Göç 0085** · 9 tetikleyici · prova 39/39 |
| **MIYOP-007** (yazma yarısı) | Kullanıcı kendine şube erişimi verebiliyordu | ✅ 0085 · `izin_user_branch_access` |
| **MIYOP-009** | 6 açık kiracı ekranı tarayıcıya yazıyor | ⚠️ Bulgu doğrulandı, çırçır testiyle donduruldu, düzeltme sırada |

0085'in ayrıntısı: `db/migrations/0085_yazma_kapilari_tamamlandi.sql`
başlık yorumu. Davranış provası: `db/prova/prova-0085.sql`.

⚠️ **Stok defterinin kapısı `reason` sütununa bakıyor.** Tek izin yazmak
meşru akışları kırardı: mal kabulü satın almacı (`purchase.write`),
üretimi üretimci (`production.write`), sevki sevkiyatçı
(`logistics.write`) yapıyor.

## HÂLÂ AÇIK P0'lar

- **MIYOP-002** · Sipariş onayı başkası adına verilebiliyor.
  `order_approval` INSERT ve `order_approval_step` UPDATE `authenticated`a
  açık. Tetikleyici `decided_by`nin aynı kiracıdan olduğunu doğruluyor,
  ÇAĞIRANIN o kişi olduğunu doğrulamıyor. Zorunlu adımlar kapatılabiliyor.
- **MIYOP-003** · Çapraz kiracı referansı + denetim özeti sızıntısı.
- **MIYOP-004** · Sahte ters kayıt negatif stok kontrolünü aşıyor.
- **MIYOP-005** · Satır güncellemesinde veri kaybı (delete + insert).

## Raporun iyi bulduğu temeller (korunacak)

Append-only stok defteri · miktarın hareketlerden türetilmesi · benzersiz
işlem anahtarı · tek ters kayıt indeksi · kalem toplamında advisory lock ·
iş emrinin reçeteyi kopyalaması · sayımda "sıfır" ile "sayılmadı" ayrımı ·
atomik alerjen beyanı RPC'si · mimari testler · hazır olmayan platform
ekranlarının tek kaynaktan kilitlenmesi.

**Rapor sistemi yeniden yazma gereği görmüyor.**
