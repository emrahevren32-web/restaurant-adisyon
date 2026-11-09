# Codex denetim brifi · Kasım 2026 · **4. tur**

⚠️ **Sıra kuralı geçerli:** Claude yaptı, **Codex denetler**. Aynı anda
yazılmaz (`claude/codex-ile-calisma-duzeni.md`). Bu brif Codex'e
yapıştırılır; Codex **hiçbir dosyayı değiştirmez.**

---

## Bu tur ne denetlenecek

3. turun **sekiz bulgusu da kapandı** (MIYOP-100…107). Bu tur **o
onarımları** denetliyor — yani benim yazdığım şeyi.

| | |
|---|---|
| Depo | `C:\Users\90544\Documents\restaurant-adisyon` |
| Dal | `production-foundation` |
| Canlı | `https://miyop.emrahevren.com` |
| Göç sayısı | **113** (`0000` + `0001…0112`) |
| Prova sayısı | **63** (`db/prova/prova-*.sql`) |
| Prova durumu | **63 yeşil / 0 kırmızı** · temiz PostgreSQL 16 · `db/prova/son-kosu.json` |

**Önce şu iki dosya okunacak:**
```
docs/kararlar/codex-bulgulari-kasim-2026-3tur.md  ← her bulgunun kanıtı
claude/nerede-kaldik.md                            ← gece turunda değişen dosyaların listesi
```

⚠️ **AÇIKÇA SÖYLÜYORUM — BU TURUN EN ÖNEMLİ MADDESİ:**
Gece turunda **`tsc` ve `npm test` KOŞTURULAMADI** (çalışma ortamında
`node_modules` yok). TypeScript tarafı yalnız **sözdizimi** açısından
denetlendi. Yani aşağıdaki altı dosyada **tip hatası, kanca (hook)
kuralı ihlali ya da kullanılmayan import** olabilir ve bunu kimse
ölçmedi.

---

## ÖNCE OKU (bunlar bilinçli kararlar, "hata" sanma)

```
docs/kararlar/kararlar-ve-tuzaklar.md     ← 196 tuzak + 149 maddelik kontrol listesi
docs/HEDEFLER.md                          ← açık/kapalı her madde, gerekçesiyle
docs/kararlar/rol-yetki-matrisi.md         ← 13 rol × ekran × izin, istisnalarla
claude/yetki-cercevesi.md
claude/kaldirilan-moduller.md             ← bilerek SİLİNEN modüller
db/migrations/README.md · db/prova/README.md
```

⚠️ **Her göç dosyasının BAŞLIK YORUMU okunmadan o göç hakkında bulgu
yazılmaz.** 0109, 0110 ve 0111'in başlıklarında ölçüm çıktıları da var.

---

## KURALLAR

- **Salt okunur denetle. Dosya DEĞİŞTİRME.**
- Her bulguda: **dosya + satır**, somut kanıt, etki, kabul kriteri.
- **Mock veri asla olmayacak.** Uydurma/örnek veri bulursan **P0**.
- **Müşterinin görmemesi gereken hiçbir şey müşteri ekranında olmasın.**
- Tarayıcıdaki izin kontrolü **güvenlik sınırı değildir**; sınır
  veritabanındadır (üç kapı: menü kaydı, rota kapısı, DB kapısı).
- Satış dilinde **"yapay zeka" denmiyor**; teknik başlık **kural motoru**.
- Bir şey eksik görünüyorsa önce `HEDEFLER.md`e bak.

---

## BU TURDA BAK

### 1 · P1 adayı · TypeScript tarafı hiç derlenmedi
```
src/App.tsx                                   ← yeni durum + yeni etki (useEffect)
src/components/AppShell.tsx                   ← useRef sayaç, refreshNotifications içinde kapı
src/pages/CompanyProfile.tsx                  ← kaydettikten sonra olay yayımı
src/companies/firma-vitrini.ts                ← yeni dosya
src/notifications/tazeleme-sirasi.ts          ← yeni dosya
src/onboarding/geri-arama.service.ts          ← tek satır değişti
db/migrations/0112_numune_alinma_zamani_sunucudan.sql  ← yeni (taken_at damgası)
```
Sorular: tip hatası var mı? `App.tsx`teki yeni `useEffect`in bağımlılık
listesi doğru mu (`currentUser`, `isPlatformAdmin`, `onboardingRefreshKey`)
ve **temizleme** fonksiyonu sızıntı bırakıyor mu? `useRef(0)` nesnesi
`SiraSayaci` tipine gerçekten uyuyor mu? Kullanılmayan import kaldı mı?

### 2 · 0109 · olay zamanı damgası bir şeyi KIRDI mı
`db/migrations/0109_numune_olay_zamani_sunucudan.sql`

`occurred_at` artık **koşulsuz** `now()` ile yazılıyor. Sorular:
- `witness_sample_event`e yazan **başka bir yol** var mı (başka bir
  fonksiyon, başka bir ekran, bir içe aktarma) ve o yol `occurred_at`
  gönderiyor mu? Gönderiyorsa artık sessizce yok sayılıyor.
- Geçmişe dönük bir kayıt girmenin **meşru** bir ihtiyacı var mı?
  (Numune dün alındı, bugün yazılıyor gibi.) Varsa bu bir bulgudur:
  o zaman ayrı ve yetkiye bağlı bir yol gerekir.
⚠️ `taken_at` için aynı kusur **vardı ve 0112 ile kapatıldı** (Codex
bulgusu değil, kendi gördüğüm komşu kusur). Ona da bak: damga doğru yerde
mi, ve geriye tarih atmanın MEŞRU bir ihtiyacı çıkarsa yolu ne olmalı?

### 3 · 0110 · kilit ve indeks gerçekten yeterli mi
`db/migrations/0110_geri_arama_es_zaman_kapisi.sql`

- `pg_advisory_xact_lock(110, hashtext(telefon))` — `110` ad alanı başka
  bir yerde kullanılıyor mu? `hashtext` çakışması bir numarayı başka bir
  numaranın kilidinde bekletir mi (zararsız ama ölçülsün).
- Kilit **doğrulamalardan sonra** alınıyor. Geçersiz formlar kilidi
  tutmasın diye böyle. Bu doğru sıra mı?
- Kısmi indeks yalnız `NEW` satırları kapsıyor. `geri_arama_durumu_yaz`
  bir talebi CLOSED'dan NEW'a geri alabiliyor mu? Alabiliyorsa indeks o
  yolda da devreye giriyor mu ve hata mesajı anlamlı mı?
- 24 saat / 3 talep sınırı **CLOSED kayıtları da sayıyor**. Doğru mu?
  (Kararım: evet — sınır "kaç talep bıraktı" sorusudur.)
- Göçün var olan çift kayıtları CLOSED'a çekme adımı: `contact_note`
  birikimli yazımı bozuyor mu?

### 4 · 0111 · kısıtlar ürünü kilitliyor mu
`db/migrations/0111_numune_metin_esikleri.sql`

- Ekranın eşikleri (`witness-sample.service.ts`) ile kısıtlar **birebir**
  mi? Üçüncü bir yerde (başka bir ekran, bir içe aktarma, bir rapor)
  numune kodu ya da gerekçe yazan bir yol var mı ve o yol 2/3 karakter
  eşiğini biliyor mu?
- `ALINDI` muafiyeti ve `IMHA`nın sonuç muafiyeti doğru mu?
- Canlıda eski kayıt ihlali varsa göç duruyor. Bu doğru karar mı, yoksa
  `not valid` ile yalnız yeni kayıtlara uygulamak mı gerekir?

### 5 · MIYOP-104'ün onarımı yeterli mi
`src/notifications/tazeleme-sirasi.ts` + `AppShell.tsx`

"Son istek kazanır" kuralı **yazma sırasını** düzeltiyor. Sorular:
- Sayaç `refreshNotifications`ın **en başında** artıyor. `isPlatformAdmin`
  false dalında `setNotifications([])` sayaç kapısından GEÇMİYOR —
  bu bir boşluk mu?
- "Okundu" işareti bir olay yayımlıyor ve o olay yeni bir tazeleme
  başlatıyor. Olay yayımlanmayan bir okundu yolu var mı?
- İki sekme aynı anda açıkken `storage` olayı ne yapıyor?

### 6 · MIYOP-103'ün onarımı yeterli mi
`src/companies/firma-vitrini.ts` + `App.tsx` + `CompanyProfile.tsx`

- Kabuk artık defterden okuyor; **platform yöneticisi** için vitrin yok
  (`EVREN360` görmeli). Bu doğru uygulanmış mı?
- `firmaProfiliniOku(firmaId)` id eşleşmezse **tek satır varsa onu**
  döndürüyor. Çok şubeli/çok firmalı bir kiracıda yanlış firmayı
  gösterebilir mi?
- Olay yayımlanıyor ama **ikinci sekme** güncellenmiyor (bilinçli).
  Kabul edilebilir mi?

### 7 · Ölü CSS'in kalanı
`src/styles.css` — `.unified-login-announcement*` kuralları kaldırıldı.
⚠️ `.unified-login-reference*` kuralları da kullanılmış görünmüyor ama
**depo genelinde aranamadı** ve silinmedi. Codex ölçebilir: bu sınıfları
kullanan bir `.tsx` var mı? Yoksa başka ölü `unified-login-*` sınıfı var mı?

### 8 · Mimari testler gerçekten ölçüyor mu
Gece turunda eklenen iddialar metin ölçüyor. Her biri için soru:
**bu iddia yanlış yeşil verebilir mi?**
```
src/onboarding/geri-arama-kapisi.arch.test.ts      ← 0110 bloğu
src/quality/numune-kapisi.arch.test.ts             ← 0109 + 0111 blokları
src/pages/giris-vitrini-dogru-soyler.arch.test.ts  ← ölü CSS nöbeti
src/companies/firma-vitrini.test.ts
src/notifications/tazeleme-sirasi.test.ts
```
⚠️ Özellikle: sabit karakter sayısıyla kesilen bir metin parçası var mı
(tuzak 195)? Bir iddia kendi açıklamasına takılabilir mi (tuzak 194)?

---

## RAPOR BİÇİMİ

```
MIYOP-xxx · <başlık>
Önem      : P0 / P1 / P2
Dosya     : <yol>:<satır>
Kanıt     : <kod parçası ya da ölçüm>
Etki      : <kullanıcı ne yaşar>
Kabul     : <bu bulgu ne olursa kapanmış sayılır>
```

⚠️ Bulgu **sayısı** değil, **kanıtı** önemli. Kanıtsız bulgu yazma;
emin değilsen "şüpheli, doğrulanmalı" diye işaretle.

⚠️ Koşturmadığın bir ölçümü koşturmuş gibi sunma. 3. turda
*"önceki 54 yeşil ölçümünü yeni ölçüm gibi sunmuyorum"* demiştin —
o dürüstlük bulguların kanıt değerini artırıyor, aynısını bekliyorum.
