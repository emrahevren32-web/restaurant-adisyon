# ADR-005 · Teknoloji yığını

- **Durum:** Kabul edildi (Claude · GPT · Emrah, 2026-08-23) — **2026-08-25'te iki satır
  revize edildi**, aşağıdaki "2026-08-25 revizyonu" bölümüne bakın.
- **Bağlam:** Tek geliştirici + AI desteği. Öncelik: **en kısa sürede güvenli hâle gelmek.**

---

## Karar

| Katman | Seçim | Not |
|--------|-------|-----|
| Veritabanı | **PostgreSQL** | RLS yerel olarak destekleniyor (ADR-004) |
| Barındırma | **Supabase** | Auth + RLS + depolama + realtime tek pakette |
| Şema / migration | ~~Drizzle~~ → **düz SQL migration dosyaları** | Bkz. revizyon notu |
| Doğrulama | ~~Zod~~ → **henüz yok, gerektiğinde eklenir** | Bkz. revizyon notu |
| Test | **Vitest** | Vite zaten var, sıfır yapılandırma |
| Parola | ~~argon2id (kendi hash sistemimiz)~~ → **Supabase Auth** | Bkz. revizyon notu |
| Arayüz | **mevcut React + Vite** | Değişmiyor |

---

## 2026-08-25 revizyonu

G3 ve G4 uygulanırken iki karar fiilen değişti; bu bölüm bunu resmîleştiriyor.

**1 · Drizzle ve Zod kullanılmadı.** Migration'lar `db/migrations/*.sql` altında düz,
tekrar çalıştırılabilir SQL dosyaları olarak yazıldı ve Supabase SQL Editor'e elle
yapıştırılıp çalıştırıldı. Uygulama tarafı doğrudan `supabase-js` istemcisiyle
konuşuyor (`core/supabase.ts`). Gerekçe: tek geliştiricili bir ekipte RLS ağırlıklı
bir şemada düz SQL, Drizzle'ın soyutlama katmanından daha az sürtünmeli çıktı —
RLS politikaları, trigger'lar ve view'lar zaten SQL'de düşünülüyor, ekstra bir ORM
katmanı bunu iki kere yazmak anlamına geliyordu. Zod hiç gerekmedi çünkü sınır
doğrulaması henüz kurulmadı (API katmanı G5/G6'da geliyor); o noktada tekrar
değerlendirilebilir, bu ADR'yi bağlamıyor.

**2 · Kendi parola hash/sıfırlama sistemimiz yazılmayacak, Supabase Auth'un hazırı
kullanılacak.** Bu satır zaten "Karar" tablosunda **argon2id** olarak yazılıydı, ama
"Barındırma: Supabase" seçimiyle **çelişiyordu** — Supabase zaten kendi Auth'unda
parolayı güvenli hashliyor ve hazır bir parola sıfırlama e-postası sunuyor; bunun
üzerine ayrıca kendi argon2id + sıfırlama akışımızı yazmak, ADR'nin kendi gerekçesini
("kendi auth'unu yazmak en olası güvenlik açığı kaynağıdır") ihlal ederdi. `storage.ts`
`authenticateUser()` artık `supabase.auth.signInWithPassword()` kullanıyor (2026-08-25,
bkz. PLAN.md §7). `docs/dilim-0-gorevler.md` G4.1 ve G4.3 bu karara göre kapatıldı.

Bu iki değişiklik ADR-005'in ana kararını (Supabase + PostgreSQL + Vitest) etkilemiyor,
yalnızca "Drizzle/Zod/argon2id" ayrıntı satırlarını gerçek uygulamaya uydurdu.

---

## Gerekçe

Değerlendirilen iki seçenek:

**A · Supabase.** Kimlik doğrulama, oturum, parola sıfırlama, RLS altyapısı ve dosya
depolama hazır gelir. Tek kişilik bir ekipte bu **iki-üç aylık iş** demektir.
Bedeli: satıcı bağımlılığı ve RLS politikalarını doğru yazma sorumluluğu (politikalar
yine senin).

**B · Neon/PostgreSQL + Hono + Drizzle + kendi auth'un.** Tam kontrol, tam taşınabilirlik.
Bedeli: kimlik doğrulama, oturum yönetimi, parola sıfırlama, oran sınırlama, denetim
kaydı — hepsini sen yazar ve güvence altına alırsın. Gerçekçi olarak **+2–3 ay**.

**A seçildi.** Gerekçe hız değil, **risk**: kendi auth'unu yazmak, güvenlik açığı
üretmenin en olası yoludur ve bu üründe bir açık ticari olarak ölümcüldür.

---

## Bu kararı geri alınabilir kılan şey

ADR-003'teki repository sınırı sayesinde bu seçim **kilitleyici değildir.**
İleride B'ye geçmek, `PostgresStockRepository` yerine yeni bir uygulama yazıp
aynı sözleşme testlerini geçirmek demektir.

Bunu korumak için tek kural:

> **Supabase'e özgü hiçbir çağrı, repository katmanının dışına sızmaz.**
> Ekranlar `supabase.from(...)` yazmaz. Yalnızca repository arayüzünü tanır.

Bu kural ihlal edilirse ADR-005 geri alınamaz hâle gelir — bu yüzden kod incelemesinde
ilk bakılan şeydir.

---

## Sonuçlar

**Kazanç:** Auth ve RLS altyapısı hazır · yönetilen yedekleme · Dilim 7'nin yarısı
platform tarafından geliyor.

**Bedel:** Satıcı bağımlılığı · maliyet tenant sayısıyla artar · özelleştirme sınırları
Supabase'in izin verdiği kadar.

---

## Reddedilen alternatifler

| Alternatif | Neden reddedildi |
|-----------|------------------|
| Kendi backend'ini yaz (Seçenek B) | +2–3 ay ve kendi auth'unu yazma riski. İleride hâlâ mümkün. |
| Firebase / Firestore | İlişkisel değil. Stok defteri, lot soyağacı ve recursive geri çağırma sorgusu SQL istiyor. |
| MongoDB | Aynı gerekçe + transaction bütünlüğü zayıf. |
| Prisma (Drizzle yerine) | Drizzle SQL'e daha yakın; RLS ve view'larla çalışmak daha az sürtünmeli. |
| Jest (Vitest yerine) | Vite zaten kurulu; ek yapılandırma yükü gereksiz. |
