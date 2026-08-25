# MİYOP · Production Foundation — Plan

> Bu dosya **mevcut durumu** anlatır. Kararların gerekçesi `docs/adr/` içindedir.
> Her dilim bittiğinde bu dosya güncellenir. Tek doğruluk kaynağı budur.

**Durum:** Dilim 0 — sürüyor (G0–G3 bitti, sırada G4 kimlik doğrulama)
**Son güncelleme:** 2026-08-25

---

## 1. Ürün prensibi

> **Yarım yamalak bir ürün olacağına, eksik olsun ama çalışan bir ürün olsun.**

Bu cümlenin operasyonel karşılığı üç kuraldır ve üçü de tartışmaya kapalıdır:

1. **Görünen her ekran gerçek veriye bağlıdır.** Mock veriye bağlı bir ekran menüde yer almaz.
   Yarım bağlı ekran yoktur — ya tamamen bağlıdır ya da görünmez.
2. **"Çalışıyor" demek, build geçiyor demek değildir.** Bir dilim, iş kuralları otomatik test
   ile doğrulandığında biter.
3. **Vaat ettiğimiz her özellik gerçekten çalışır.** Demoda gösterdiğimiz hiçbir şey
   "yakında" değildir. Menüde olan çalışır; çalışmayan menüde değildir.

---

## 2. Temel sözleşme

Claude, GPT ve Emrah arasında kapatılmış mimari kararlar. Bunlar yeniden tartışılmaz;
değiştirmek isteyen yeni bir ADR açar.

| # | Karar | ADR |
|---|-------|-----|
| 1 | **Dikey dilim** — katman katman değil, uçtan uca dar dilimler halinde ilerlenir | `003` |
| 2 | **Her dilim kendi testiyle biter** — test ayrı bir faz değildir | `003` |
| 3 | **`StockMovement` = tek gerçek**; `currentQty` hareketlerden türetilir | `001` |
| 4 | **Tenant izolasyonu PostgreSQL RLS ile zorlanır**; uygulama katmanı ikinci hattır | `004` |
| 5 | **Migrasyon kapsamı sınırlıdır** — kapsam dışı modüller dondurulur, silinmez | `002` |
| 6 | **Yeni modül geliştirilmez.** Her yeni fikir `docs/backlog.md`'ye yazılır | `002` |

---

## 3. Dilim panosu

| Dilim | Konu | Durum | Test |
|-------|------|-------|------|
| **0** | Çekirdek şema · Auth · Tenant · RBAC · RLS · repository sınırı · test altyapısı | 🟡 Sürüyor | 14 ✅ · 12 şema ✅ |
| **1** | Stok hareket defteri (append-only, reversal, idempotency, lot, türetilmiş miktar) | ⬜ | — |
| **2** | Satın Alma → Mal Kabul → Stok · **pilot burada başlar** | ⬜ | — |
| **3** | Reçete → Üretim İş Emri → Tüketim → Mamul | ⬜ | — |
| **4** | Sevkiyat → Stok çıkışı → İrsaliye | ⬜ | — |
| **5** | İzlenebilirlik / geri çağırma | ⬜ | — |
| **6** | Sayım · fire · düzeltme | ⬜ | — |
| **7** | Yedekleme · geri yükleme · dışa aktarma | ⬜ | — |

Bir dilim ancak şu üçü sağlandığında ✅ olur:
kod yazıldı **ve** dilimin testleri geçiyor **ve** ADR'de tanımlı "bitti tanımı" karşılandı.

---

## 4. Roller

| Kim | Ne yapar | Ne yapmaz |
|-----|----------|-----------|
| **Claude** | Mimari, şema, ADR, dilim planı, kod incelemesi | Repoya doğrudan yazmaz |
| **Codex** | Repo içinde uygulama, mekanik taşıma, test yazımı | Mimari karar vermez |
| **GPT** | İkinci görüş, planı zorlama, mimari kontrol | Uygulama sırası belirlemez |
| **Emrah** | Ürün kararı, öncelik, pilot müşteri, son söz | — |
| **Testler** | **Hakem.** Anlaşmazlık test sonucuyla kapanır | — |

Akış: `Claude ADR yazar → Codex uygular → Claude inceler → testler geçerse ADR kapanır.`

---

## 5. Değişmeyen kurallar

- Parola hiçbir yerde düz metin saklanmaz. İstisna yok.
- `stock_movement` satırı güncellenmez ve silinmez. Düzeltme = ters kayıt.
- Stok yazan tek kapı `postMovement()`'tır. Başka hiçbir yerden stok yazılmaz.
- Her repository çağrısının ilk parametresi `TenantCtx`'tir. Unutulması derleme hatasıdır.
- Yeni tablo açılıyorsa RLS ile birlikte açılır; sonradan eklenmez.
- Kapsam dışı modüle tek satır geliştirme yapılmaz.

---

## 6. Kapsam özeti

**İçeride (migre edilir):** kimlik/yetki/şube, stok kartları ve hareketleri, lot, mal kabul,
reçete, satın alma talebi/siparişi, tedarikçi, üretim iş emri, sevkiyat, izlenebilirlik,
sayım/fire, denetim kaydı, yedekleme.

**Dışarıda (dondurulur):** adisyon/masa/QR/garson, finans/cari/kasa, personel, KPI ve AI
analiz ekranları, platform/lisans/abonelik/destek, HACCP ve kalite form ekranlarının çoğu.

Tam liste: `docs/adr/002-migrasyon-kapsami.md`

---

## 7. Dilim 0 ilerlemesi

| Paket | Konu | Durum |
|---|---|---|
| G0 | Hazırlık — build, dal, docs | ✅ |
| G1 | Test altyapısı — Vitest, CI, ilk testler | ✅ 13 test |
| G2 | Kapsam daraltma — 138 → 24 menü ögesi | ✅ |
| G3 | Veritabanı ve şema | ✅ 14 tablo · 12 şema kontrolü |
| G4 | Kimlik doğrulama | ⬜ **sırada** |
| G5 | Yetkilendirme | ⬜ |
| G6 | Repository sınırı | ⬜ |
| G7 | Kabul | ⬜ |

**G1'de bulunan hata:** Şube kodu ve kullanıcı adı karşılaştırması Türkçe yerel ayarıyla
küçültme yapıyordu; `'ISTANBUL'` → `'ıstanbul'` olduğu için `'istanbul'` ile eşleşmiyor,
aynı kodla ikinci şube ve aynı adla ikinci kullanıcı açılabiliyordu. `core/identifier.ts`
ile düzeltildi, 4 regresyon testi yazıldı. Test altyapısı ilk gününde işini yaptı.

**G3'te bulunan tuzak:** Supabase'in "Enable automatic RLS" ayarı public şemasındaki
her tabloda RLS'i otomatik açıyor. İyi bir varsayılan, ama **politikası olmayan RLS
herkese kapalı** demektir. Tenant'a ait olmayan beş referans tablosu (`permission`,
`role`, `role_permission`, `uom`, `uom_conversion`) politikasız kalmıştı; uygulama
bağlandığında yetki listesini okuyamaz, birim dönüşümü yapamazdı. `0005` ile okuma
politikası eklendi. Kural: durum sorgusunda `politika` sütunu 0 olan satır kalmamalı.

### Veritabanı durumu

- **14 tablo**, hepsinde RLS açık + force + en az bir politika
- `stock_movement` append-only (UPDATE/DELETE tetikleyiciyle reddediliyor)
- Idempotency, ters kayıt tekilliği, lot zorunluluğu, birim dönüşümü şemada
- `stock_item` tablosunda `current_qty` kolonu **yok** — miktar `stock_balance`
  görünümünden türetiliyor
- Migration'lar: `db/migrations/0000`–`0005`, hepsi tekrar çalıştırılabilir

## 8. Sonraki adım

G4 — kimlik doğrulama. `storage.ts` içindeki düz metin parola karşılaştırması
silinip yerine Supabase Auth gelecek. Uygulamanın ilk kez bir sunucuyla
konuşacağı yer burası.

Görev listesi: `docs/dilim-0-gorevler.md`
