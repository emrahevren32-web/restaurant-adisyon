# G7 · İki kiracı izolasyon testi — kurulum

Bu, Dilim 0'ı ve yol haritasının Aşama 1'ini kapatan son iştir. Word'de **üç
kutucuğu** birden işaretler:

- PostgreSQL uygulaması, aynı testler
- İki tenant izolasyon kabul testi + ham SQL kontrolü
- RLS kapatıldığında testler kırmızıya dönüyor mu?

---

## Neden AYRI bir Supabase projesi gerekiyor

İki sebep var ve ikisi de pazarlık edilemez:

1. **`stock_movement` append-only bir defterdir** (`0003`). Silme tetikleyiciyle
   yasak. Üretim projesine yazılan bir sınama hareketi **bir daha silinemez** —
   gerçek defterinde sonsuza kadar sahte bir kayıt kalır.
2. **Negatif kontrol RLS'i kapatmayı gerektirir.** "Testler RLS kapalıyken
   kırmızıya dönüyor mu?" sorusunu üretimde denemek, tüm müşteri verisini
   birkaç dakikalığına birbirine açmak demektir.

Ücretsiz katman yeterli. Test bitince projeyi silebilirsin.

---

## Adımlar

### 1 · Yeni proje aç
supabase.com → **New project**. Adı fark etmez (ör. `miyop-g7-test`).
Ücretsiz katman yeterli.

### 2 · Şemayı kur
Yeni projenin **SQL Editor**'ünde `db/migrations/g7_1_sema.sql` dosyasının
**içeriğini** yapıştır ve çalıştır. (0001–0015'in birleştirilmiş hâli — tek
seferde kurar.)

### 3 · İki sınama hesabı oluştur
Yeni projede **Authentication → Users → Add user → Create new user**.
İki hesap aç. E-postaları ve şifreleri **sen belirle**; bana söyleme, gerek yok.

> `Auto Confirm User` seçeneğini işaretle, yoksa giriş yapamazlar.

### 4 · JWT hook'unu etkinleştir
Yeni projede **Authentication → Hooks → "Customize Access Token (JWT) Claims
hook" → Enable → Postgres Function → şema `app`, fonksiyon
`custom_access_token_hook` → Save.**

Üretimde bir kez yapmıştın; bu ayrı bir proje olduğu için burada tekrar gerekiyor.

### 5 · Sınama verisini kur
`db/migrations/g7_2_veri.sql` dosyasını aç, **başındaki iki e-posta satırını**
3. adımda oluşturduğun hesaplarla değiştir, sonra içeriğini SQL Editor'de
çalıştır.

Beklenen çıktı: TESTA 111 kg, TESTB 222 kg.

### 6 · `.env.test.local` dosyasını oluştur
Proje kökünde **`.env.test.local`** adında bir dosya aç (`.gitignore` zaten
dışlıyor, git'e girmez) ve şunu yapıştırıp doldur:

```
VITE_TEST_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_TEST_SUPABASE_ANON_KEY=sinama_projesinin_anon_anahtari

VITE_TEST_TENANT_A_EMAIL=5.adimda_yazdigin_A_epostasi
VITE_TEST_TENANT_A_PASSWORD=A_hesabinin_sifresi

VITE_TEST_TENANT_B_EMAIL=5.adimda_yazdigin_B_epostasi
VITE_TEST_TENANT_B_PASSWORD=B_hesabinin_sifresi
```

URL ve anon anahtarı: **yeni projenin** Project Settings → API bölümünden.

> ⛔ Buraya üretim projenin bilgilerini yazma. Yazarsan test bilerek hata verir —
> `live-client.ts` üretim URL'iyle aynı değeri reddediyor.

### 7 · Testi çalıştır
```
npm run test:live
```
**Yeşil olmalı.**

### 8 · Negatif kontrol — asıl kanıt burada
```
1. db/migrations/g7_rls_kapat.sql  → SQL Editor'de çalıştır
2. npm run test:live               → KIRMIZI olmalı  ← kanıt bu
3. db/migrations/g7_rls_ac.sql     → SQL Editor'de çalıştır
4. npm run test:live               → tekrar YEŞİL olmalı
```

2. adım kırmızıya dönmezse test izolasyonu ölçmüyor demektir ve bunu bilmemiz
gerekir. Geçen bir testin doğru sebepten geçtiğini anlamanın tek yolu, ölçtüğünü
iddia ettiği şeyi bozup kırıldığını görmektir.

---

## Çıktıları bana at

7. ve 8. adımların terminal çıktılarını gönder. Üçünü de gördükten sonra Word'de
üç kutucuğu işaretlerim — öncesinde değil.
