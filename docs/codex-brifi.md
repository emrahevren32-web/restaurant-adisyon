# Codex denetim brifi · MİYOP

> Bu dosya Codex'e yapıştırılmak üzere yazıldı. Her denetim turunda
> güncellenir. Son güncelleme: **30.10.2026 · A1 + göç turu**.
> Dal: `production-foundation` · son commit: `c4ff2b5`

---

Merhaba. MİYOP adlı bir endüstriyel mutfak ERP'sini denetleyeceksin.

**Depo:** `C:\Users\90544\Documents\restaurant-adisyon`

## 1 · ÖNCE BUNLARI OKU

Bu projede alışılmadık görünen çoğu kararın yazılı bir gerekçesi vardır —
ve o gerekçe genellikle kararın alındığı dosyanın başlık yorumundadır.
Dışarıdan gelen biri bu gerekçeyi görmeden "hata" diyebilir. Bir şeyi
hata saymadan önce gerekçesini ara. Okuma sırası:

1. `docs/kararlar/kararlar-ve-tuzaklar.md` — **en önemlisi.** Değişmez
   kurallar, veri tasarımı kararları ve numaralı tuzak listesi (38–**152**).
   Her tuzak gerçekten düşülmüş bir hatadır.
   ⚠️ **147, 150, 151, 152'yi mutlaka oku** — dördü de son iki günde
   Claude'un kendi ÖLÇÜM hatalarıdır ve bu turda bakacağın kodun üretildiği
   günlere aittir.
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

## 4 · BU TURDA BAKILACAK · **İKİ GÖÇ, ÜÇ DEPO, BİR İDDİA**

Önceki tur (20.10) yarım ekranlardı ve o iş **bitti**: A1'in dört ekranı da
veritabanına bağlandı. Bu turda bakacağın şey **o işin kendisi.**

⚠️ **Bu turun en önemli sorusu bir iddiadır** ve iddiayı ben kurdum:

> *"Açık kiracı ekranlarının hiçbiri artık kullanıcının girdiği veriyi
> tarayıcıya yazmıyor."*

Bu iddiayı ölçen test de benim yazdığım test
(`src/modules/kiraci-ekrani-veri-kaynagi.arch.test.ts`, liste **6 → 0**).
⚠️ **Son iki günde kendi ölçümümle ÜÇ KEZ yanıldım** (tuzak 147, 150, 151).
O yüzden bu iddiaya dışarıdan bakılmasını istiyorum: **testin geçmesi,
iddianın doğru olduğunu kanıtlamıyor.**

### 4.1 · GÖÇ 0102 · giriş adresi kapısı (P0 ailesi · MIYOP-043)

Senin bulgundu. `public.giris_adresi_bul`un `anon` **ve** `authenticated`
hakkı alındı, `giris-yap` Edge Function canlıya alındı, tarayıcıdaki yedek
yol **silindi** (`src/auth/giris-adresi.ts` kaldırıldı).

**Sorular:**
1. Fonksiyon **silinmedi**, yalnız kapısı kapandı — çünkü Edge Function onu
   `service_role` ile çağırıyor. Bu doğru karar mı, yoksa fonksiyonun
   **içine** kiracı kapısı da mı konmalı? (İçinde yok; `service_role`
   çağırdığı için bugün sorun değil. Yarın başka bir şey onu çağırırsa?)
2. `public.personel_giris_adresi` bilerek **dokunulmadı** (`authenticated`
   hakkı duruyor, yoksa personel açmak kırılır). Bu yüzeyden benzer bir
   sızıntı var mı? Cevabın biçimi "bu kullanıcı var mı" sorusunu
   cevaplıyor mu?
3. Yedek yol silinince `ulasilamadi` dalı *"giriş olmadı"* demek oldu.
   **Fonksiyon bir gün düşerse herkes kapıda kalır.** Bunu kabul ettim ama
   senin görüşünü istiyorum: ölçülebilir bir risk mi, yoksa bir
   dayanıklılık yolu mu gerekiyor?
4. **MIYOP-049 (zamanlama) ve MIYOP-050 (istek sınırı) hâlâ açık.** Yedek
   yol silinince bunların yüzeyi **değişti mi**? Artık her giriş denemesi
   Edge Function'dan geçiyor.

### 4.2 · GÖÇ 0103 · `tenant_settings` (YENİ TABLO)

Emrah'ın kararı: *"Herkes kendi KDV oranını ve para birimini kendi seçsin."*
Prova: `db/prova/prova-0103.sql`, 30 ölçüm, yerelde yeşil.

**Sorular:**
1. **Kapılar:** RLS (force) + `izin_tenant_settings` → `settings.manage` +
   `denetim_tenant_settings` + `tenant_settings_imza` (sunucu `updated_at`
   ve `updated_by` yazıyor). **Eksik bir kapı var mı?** Özellikle: `insert`
   hakkı `authenticated`'a verildi (satırı tetik açıyor ama hak duruyor) —
   bu gereksiz bir yüzey mi?
2. **`vat_rate`in varsayılanı BİLEREK YOK** (`null` = "işletme seçmedi") ve
   göç bunu kendi doğrulamasında ölçüyor. Bu kararın **yan etkisi** var mı
   — `null` KDV'yi okuyup `0` gibi davranan bir yer kalmış mı?
3. ⚠️ **Tuzak 149 burada çıktı:** tablonun ilk hâlinde `id` kolonu yoktu ve
   `app.denetim_yaz()` satır kimliğini `new ->> 'id'` ile okuduğu için
   denetim defterine `'?'` yazıyordu. **Aynı kusur başka tablolarda var mı?**
   `audit-coverage.arch.test.ts` kapsamı ölçüyor ama **`row_id`in anlamlı
   olduğunu ölçmüyor.** Bu benim kör noktam olabilir.
4. Tablo yedeğe eklendi (`tenant-export.ts`, `app_user`dan sonra). Sıra
   doğru mu — `updated_by` ona atıf yapıyor.

### 4.3 · ÜÇ YENİ DEPO DOSYASI · kullanıcı verisi yazan yeni kod

- `src/companies/firma-profili.repository.ts` → `company` (17 alan)
- `src/workspace/isletme-ayarlari.repository.ts` → `tenant_settings`
- `src/workspace/karsilama.repository.ts` → salt okuma (sayım)

**Her biri için:**
1. **Yazılan kolon kümesi dondurulmuş** (test). Küme doğru mu — yazılmaması
   gereken bir şey var mı, ya da yazılması gereken bir şey eksik mi?
2. **Hata mesajları:** `42501`/`MI403` → *"yetkiniz yok"*, gerisi genel.
   Ham veritabanı metni sızıyor mu? Mesaj hesap/veri hakkında bir şey
   söylüyor mu?
3. **Yazımdan sonra geri okuma** yapılıyor (ekranda gösterilen şey,
   kaydedilmiş olan şey). Geri okuma düşerse *"kaydedildi"* **denmiyor**.
   Bu dalda bir tutarsızlık var mı?
4. `permissions === undefined` iken form **açık bırakılıyor** ve kararı
   veritabanı veriyor. Bu doğru mu, yoksa kapalı mı başlamalı?

### 4.4 · ⚠️ TEK İŞÇİ · TESTLERİN KENDİSİNE BAK (yeni ve riskli)

30.10'da `vitest.config.ts`e `poolOptions.threads.singleThread` kondu.
Gerekçe ölçüldü ve dosyada yazılı: paralel havuz bu makinede **429 sn + 28
sahte kırmızı** veriyordu, tek işçi **8 sn + 1644 yeşil**. Hangi testin
koştuğu değişmedi.

⚠️ **Ama bedeli şu:** artık **bütün test dosyaları tek süreçte** koşuyor ve
global durumu paylaşıyor. Senden istediğim:

**Bir test, BAŞKA bir dosyanın bıraktığı durum yüzünden geçiyor olabilir mi?**

- Modül seviyesinde durum tutan (`let`, singleton, `localStorage`, modül
  önbelleği) ve testler arasında sızabilecek yerleri ara.
- `vi.mock` ile değiştirilen modüllerin **dosya sınırını aşıp aşmadığına** bak.
- `clearMocks`/`restoreMocks` açık ama bunlar **modül durumunu** temizlemez.
- Özellikle `src/storage.ts` (tek büyük modül, `localStorage` yazıyor) ve
  Supabase istemcisi (tek süreçte `Multiple GoTrueClient instances` uyarısı
  çıkıyor — uyarı hata değil ama **paylaşım kanıtı**).

**Bulgun varsa kabul kriteri:** o test tek başına ve takım içinde AYNI
sonucu vermeli. Aksini gösterebiliyorsan bu P1'dir — yeşil ama yanlış
sebeple geçen bir test, hiç olmayan testten kötüdür.

### 4.5 · BİLEREK AÇIK · tekrar raporlamana gerek yok

Bunlar yazılı borçlardır, gerekçeleri HEDEFLER'de:

- **3.4.5** · ilk giriş sihirbazı hâlâ `localStorage`a para birimi yazıyor
  (`onboarding.service.ts` ~365) → 0103'ten sonra ikinci kaynak. Çıcır
  testi yakalamıyor çünkü `first-login` açık bir kiracı rotası değil.
- **3.4.6** · `src/billing.ts` para birimini sabit `'TRY'` okuyor (eski
  varsayılanın aynısı, davranış değişmedi). O dosyayı **38 ekran**
  kullanıyor; hangilerinin bugün AÇIK rota olduğu **ölçülmedi.**
  ⚠️ **Bunu ölçmeni istiyorum** — "kimse görmüyor" diyemiyorum.
- **MIYOP-049, 050** · bkz. 4.1.
- **MIYOP-003, 004, 005, 006, 017, 018, 040, 045, 047**
- **A2 (MIYOP-008 · şube bağlamı)** ve **A4 (sahte veri üreticileri)** —
  sıradaki işler, henüz yazılmadı.
- Şube ekranları (`branches`, `branch-permissions`) **kapsam dışı**, tek
  merkez kararı. Düzeltilmediler, kapsamdan çıktılar — ayrım önemli.

## 5 · ÇIKTI BİÇİMİ

```
## Özet
<üç cümle: durum ne, en kritik ne, bir önceki denetime göre ne değişti>

## 4.0 · İDDİA DOĞRU MU
<"açık kiracı ekranlarının hiçbiri tarayıcıya yazmıyor" — doğruladın mı,
 yoksa testin kaçırdığı bir yol mu buldun? Testin GEÇMESİ kanıt değildir.>

## 4.1 · Göç 0102
## 4.2 · Göç 0103
## 4.3 · Üç depo dosyası
## 4.4 · Tek işçi · testler arası durum sızıntısı (EN RİSKLİ BÖLÜM)
<bir test başka dosyanın durumu yüzünden mi geçiyor? Kanıtı nasıl
 gösterdin — tek başına vs takım içinde?>
## 4.5 · 3.4.6 ölçümü
<billing.ts'i kullanan 38 ekranın hangileri bugün AÇIK rota?>

## Yeni bulgular
<MIYOP-068'den devam numaralandır>

## Kapandığını doğruladığım eski bulgular
<numara + kanıt>
```

⚠️ **Son bir şey.** Bu turda bakacağın kod, Claude'un kendi ölçümüyle üç kez
yanıldığı iki gün içinde yazıldı (tuzak 147: yanlış kopyadan ölçtü;
150: ölçümü `head` ile kesti; 151: eksik aynada "yok" gördü). Üçünü de tip
denetimi kapısı yakaladı, canlıya hiçbiri gitmedi. **Ama aynı kör noktanın
bir dördüncüsü bu kodda duruyor olabilir ve onu ancak dışarıdan biri görür.**
Bir şeyin "ölçüldü" diye yazılmış olması, doğru ölçüldüğü anlamına gelmez —
ölçümün kendisine de bak.
