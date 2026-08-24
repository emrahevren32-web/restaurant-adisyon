# ADR-005 · Teknoloji yığını

- **Durum:** Kabul edildi (Claude · GPT · Emrah, 2026-08-23)
- **Bağlam:** Tek geliştirici + AI desteği. Öncelik: **en kısa sürede güvenli hâle gelmek.**

---

## Karar

| Katman | Seçim | Not |
|--------|-------|-----|
| Veritabanı | **PostgreSQL** | RLS yerel olarak destekleniyor (ADR-004) |
| Barındırma | **Supabase** | Auth + RLS + depolama + realtime tek pakette |
| Şema / migration | **Drizzle** | TypeScript; `types.ts` ile tip paylaşımı |
| Doğrulama | **Zod** | Sınır doğrulaması — her giren nesne şemadan geçer |
| Test | **Vitest** | Vite zaten var, sıfır yapılandırma |
| Parola | **argon2id** | Tartışmaya kapalı |
| Arayüz | **mevcut React + Vite** | Değişmiyor |

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
