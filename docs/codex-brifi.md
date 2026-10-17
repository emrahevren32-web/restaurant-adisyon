# Codex denetim brifi · MİYOP

> Bu dosya Codex'e yapıştırılmak üzere yazıldı. Her denetim turunda
> güncellenir. Son güncelleme: 17.10.2026, göç 0085 uygulandıktan sonra.

---

Merhaba. MİYOP adlı bir endüstriyel mutfak ERP'sini denetleyeceksin.

**Depo:** `C:\Users\90544\Documents\restaurant-adisyon`

## 1 · ÖNCE BUNLARI OKU

Bu projede alışılmadık görünen çoğu kararın yazılı bir gerekçesi vardır —
ve o gerekçe genellikle kararın alındığı dosyanın başlık yorumundadır.
Dışarıdan gelen biri bu gerekçeyi görmeden "hata" diyebilir. Bir şeyi
hata saymadan önce gerekçesini ara. Okuma sırası:

1. `docs/kararlar/kararlar-ve-tuzaklar.md` — **en önemlisi.** Değişmez
   kurallar, veri tasarımı kararları ve numaralı tuzak listesi (38–87).
   Her tuzak gerçekten düşülmüş bir hatadır.
2. `docs/kararlar/codex-denetimi-ekim-2026.md` — senin önceki denetiminin
   özeti, hangi bulgular kapandı, hangileri açık
3. `docs/kararlar/calisma-duzeni.md` — sen ve Claude nasıl sırayla çalışır
4. `docs/HEDEFLER.md` — ne yapılıyor, neden, hangi sırayla
5. `docs/yetki-cercevesi.md` — izin ve rol tasarımı
6. `db/migrations/README.md`
7. **Her göç dosyasının BAŞLIK YORUMU.** Kararın gerekçesi orada yazılı,
   bazen yüz satır. Göç numarası büyüdükçe karar yenidir. Bu, bu depodaki
   en zengin karar kaynağıdır.

## 2 · BİLMEN GEREKEN KURALLAR

Bunlar bilinçli kararlar. "Hata" diye raporlama:

- **Mock veri asla olmayacak.** Uydurma veri bulursan P0 say. Ama
  `foundationScope: 'frozen'` ile kapatılmış eski ekranlar kasıtlı
  kapatılmıştır; rotası kapalıysa bulgu değildir.
- **Tarayıcıdaki izin kontrolü güvenlik sınırı DEĞİLDİR.** Gerçek sınır
  veritabanındadır (RLS + GRANT + tetikleyici). Bir ekranın `if` ile
  düğme gizlemesi koruma sayılmaz — zaten öyle olduğunu biliyoruz.
- **Ücretsiz lisans uzatması lisansı "Deneme"de BIRAKIR**, "Aktif" yapmaz.
  Bu bilinçli (göç 0044 başlığında yazılı).
- **Silme yoktur, pasife alma vardır.** Hiçbir tabloda `DELETE` yetkisi
  verilmez; bu tasarım.
- **`NULL = sınırsız`** demektir lisans paketlerinde (kullanıcı/şube
  sayısı). Sayı yazmak teknik bir sınırımız varmış gibi gösterirdi.
- **Sorulmamış soruya varsayılan cevap yazılmaz.** Yeni kolonlar `NULL`
  kabul eder; `default` yazmak uydurma cevabı gerçek gibi kaydetmektir.
- **"Boş" ile "sıfır" ayrı şeylerdir.** Ekranda `—` gösteriliyorsa
  bilinmiyor demektir, 0 demek değildir.

## 3 · NASIL ÇALIŞ

- **Salt okunur denetle. HİÇBİR DOSYAYI DEĞİŞTİRME.** Düzeltmeyi Claude
  yapıyor; o gerçek bir PostgreSQL 16 üzerinde prova koşturabiliyor,
  sen koşturamıyorsun. İkimiz aynı anda yazarsak birbirimizi ezeriz.
- Her bulguda şunlar olsun: **dosya + satır**, somut kanıt (kod parçası),
  etki (ne olur), önerilen çözüm, **kabul kriteri** (düzeldiğini nasıl
  anlarız).
- Önceliklendir: P0 (güvenlik / veri kaybı) · P1 (iş bütünlüğü) ·
  P2 (kalite) · P3 (belge).
- Emin olmadığın şeyi "doğrulanmadı" diye işaretle. Uydurma kanıt üretme.
- Türkçe yaz.

## 4 · BU TURDA BAKILACAK

Önceki turda bulduğun **MIYOP-031** ve **MIYOP-032** doğrulandı ve
onarıldı. Ayrıca **MIYOP-002** kapatıldı. Üç yeni göç var: **0086, 0087**
(0085 önceki turdan).

### 4.1 · 0086 · kırılan iki akış onarıldı mı

`db/migrations/0086_kirilan_akislar_onarildi.sql`

- `app.stok_karti_izni()` — `stock.write` her şeyi açar; `quality.declaration`
  YALNIZ beyan kolonlarını (`net_qty`, `net_uom`, `allergen_reviewed_*`).
  Kolon listesi yerine `to_jsonb(new) - v_beyan` farkı kullanılıyor.
  **Soru:** bu karşılaştırma kaçırılabilir mi? Beyanın yanına kaçak bir
  kolon geçirmenin bir yolu var mı?
- `app.lot_izni()` — dört izinden biri yeterli.
  **Soru:** lot açan başka bir akış var mı ve o akışın rolü bu dörtten
  birine sahip mi?

### 4.2 · 0087 · MIYOP-002 kapandı mı

`db/migrations/0087_onay_imzasi_sunucuda.sql`

- `decided_by` ve `decided_at` artık SUNUCU tarafından yazılıyor
- adımın izni `order_approval_step.permission_code`dan okunuyor
- `order_approval_step` INSERT/UPDATE → `settings.manage`

**Sorular:** Onay kararını başka bir yoldan yazmak mümkün mü? Zorunlu bir
adımı etkisizleştirmenin başka yolu var mı (örn. `is_active`, satır
silme, yeni adım ekleyip eskisini gölgeleme)? Revizyon numarası (`revision_no`)
ile oynanabiliyor mu?

### 4.3 · ÜÇÜNCÜ BİR KIRIK AKIŞ VAR MI — en kritik soru

0085 iki akışı kırdı ve bunu sen buldun. **Aynı hatanın kalan kapılarda
olup olmadığına bak.** Her kapı için: o tabloya kim yazıyor, hangi
ekrandan, hangi rolle, o rolün gereken izni var mı?

Kapılar: `izin_stock_movement` · `izin_stock_item` · `izin_stock_lot` ·
`izin_lot_genealogy` · `izin_company` · `izin_branch` · `izin_app_user` ·
`izin_user_branch_access` · `izin_tenant` · `izin_order_approval` ·
`izin_order_approval_step`

Özellikle bak: yeni kiracı açılışı (0035, 0039, 0061, 0079), Edge
Function'lar (`isletme-hesabi-ac`, `personel-hesabi-ac`), ve
`app.onay_zincirini_kur`.

### 4.4 · MIYOP-001 ne kadar kapandı

Raporunda "kısmen" dedin, haklısın. **Hangi yetkisiz yazma yolları
kaldı?** Liste hâlinde, tablo adı + hangi rol + hangi yoldan.

### 4.5 · Hâlâ açık P0'lar

Tekrar raporlamana gerek yok, kapsamları değiştiyse söyle:
**MIYOP-003** (çapraz kiracı + audit sızıntısı) · **MIYOP-004** (sahte
ters kayıt) · **MIYOP-005** (satır güncellemesinde veri kaybı).

## 5 · ÇIKTI BİÇİMİ

```
## Özet
<üç cümle: durum ne, en kritik ne, bir önceki denetime göre ne değişti>

## 4.1 · 0085 MIYOP-001'i kapattı mı
<evet/hayır/kısmen + kanıt>

## 4.2 · Kırılan akış var mı
<her akış için: rol, gereken izin, sahip mi>

## Yeni bulgular
<MIYOP-031'den devam numaralandır>

## Kapandığını doğruladığım eski bulgular
<numara + kanıt>
```
