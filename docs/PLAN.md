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
| **0** | Çekirdek şema · Auth · Tenant · RBAC · RLS · repository sınırı · test altyapısı | 🟡 Sürüyor | 17 ✅ · 12 şema ✅ |
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
| G4 | Kimlik doğrulama | 🟡 Bağlantı kuruldu, oturum açma kaldı |
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
- Migration'lar: `db/migrations/0000`–`0007`, hepsi tekrar çalıştırılabilir
- `anon` rolü müşteri verisinin hiçbirine erişemiyor; yalnızca beş referans tablosu açık

**G4'te bulunan iki açık:**

1. **Görünümler RLS'i deliyordu.** PostgreSQL'de görünümler varsayılan olarak sahibinin
   yetkileriyle çalışır. `stock_balance` görünümünü sorgulayan bir kullanıcı altındaki
   `stock_movement` tablosunun RLS politikasını atlayıp **tüm tenant'ların stoklarını**
   görürdü. Tenant izolasyonunu tabloda kurmuştuk ama stok miktarını okuduğumuz asıl yer
   o görünümdü. `security_invoker = on` ile kapatıldı (`0006`). RLS kurulmuş sistemlerde
   en sık gözden kaçan açık budur.

2. **`anon` rolünün her tabloda GRANT'i vardı.** Supabase'in public şemasındaki varsayılan
   izinlerinden geliyordu. Veri sızmıyordu — RLS süzüyordu — ama koruma tek katmana
   inmişti. Politikadaki tek bir yazım hatası doğrudan sızıntıya dönerdi. `0007` ile
   `anon` müşteri verisinden tamamen çıkarıldı; iki bağımsız savunma hattı geri geldi.

> Bu iki açığı da **test yakalamadı** — yetki tablosuna bakıldığı için görüldü. Testler
> "çalışıyor mu" diye sorar, "fazla yetki var mı" diye sormaz. G7'deki iki-tenant
> kontrolü bu boşluğu kapatacak.

## 8. Sonraki adım

G4'ün kalan yarısı — **oturum açma**. Bağlantı kuruldu ve güvenlik sıkılaştırıldı;
sırada `storage.ts:5064`'teki düz metin parola karşılaştırmasının silinip yerine
Supabase Auth'un gelmesi var.

Ön koşul: ilk yönetici hesabının Supabase Authentication tarafında oluşturulması
ve `app_user` tablosuyla eşleştirilmesi.

Görev listesi: `docs/dilim-0-gorevler.md`
