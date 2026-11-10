# Codex denetim brifi · Kasım 2026 · **4. tur**

⚠️ **Sıra kuralı geçerli:** Claude yaptı, **Codex denetler**. Aynı anda
yazılmaz (`claude/codex-ile-calisma-duzeni.md`). Bu brif Codex'e
yapıştırılır; Codex **hiçbir dosyayı değiştirmez.**

---

## Bu tur ne denetlenecek

3. turun **sekiz bulgusu da kapandı** (MIYOP-100…107) ve üstüne
**mevzuat kütüphanesi** yazıldı (göç 0113 + 0114, iki ekran). Bu tur
**o işi** denetliyor — yani benim yazdığım şeyi.

| | |
|---|---|
| Depo | `C:\Users\90544\Documents\restaurant-adisyon` |
| Dal | `production-foundation` · son commit **`31182ac`** · GitHub'da |
| Canlı | `https://miyop.emrahevren.com` · paket `index-F-l6yfvy.js` (10.11) |
| Veritabanı | göç **0114** canlıda · bekleyen göç **YOK** |
| Göç sayısı | **115** (`0000` + `0001…0114`) |
| Prova sayısı | **67** (`db/prova/prova-*.sql`) |
| Prova durumu | **67 yeşil / 0 kırmızı** · temiz PostgreSQL 16 · `db/prova/son-kosu.json` |
| Sınamalar | **116 dosya / 2017 yeşil** · `tsc --noEmit` temiz (Emrah'ın makinesi, 10.11 22:12) |

**Önce şu iki dosya okunacak:**
```
docs/kararlar/codex-bulgulari-kasim-2026-3tur.md  ← 3. turun her bulgusunun kanıtı
claude/nerede-kaldik.md                            ← son iki turda değişen dosyaların listesi
docs/kararlar/mevzuat-akisi-tasarim.md             ← 0113 + 0114 tasarım kararı
```

⚠️ **ÖNCEKİ BRİFTE YAZAN BİR ŞEY ARTIK DOĞRU DEĞİL, DÜZELTİYORUM.**
O brif *"`tsc` ve `npm test` KOŞTURULAMADI"* diyordu ve bunu turun en
önemli maddesi olarak işaretlemişti. **Koştu:** Emrah'ın makinesinde
`tsc --noEmit` temiz, `npm test` **116 dosya / 2017 sınama yeşil**.
O maddeyi kaldırdım; yerine aşağıdaki 1. madde geçti.

---

## ÖNCE OKU (bunlar bilinçli kararlar, "hata" sanma)

```
docs/kararlar/kararlar-ve-tuzaklar.md     ← 200 tuzak + 153 maddelik kontrol listesi
docs/HEDEFLER.md                          ← açık/kapalı her madde, gerekçesiyle
docs/kararlar/rol-yetki-matrisi.md        ← 13 rol × ekran × izin, istisnalarla
docs/kararlar/mevzuat-akisi-tasarim.md
claude/yetki-cercevesi.md
claude/kaldirilan-moduller.md             ← bilerek SİLİNEN modüller
db/migrations/README.md · db/prova/README.md
```

⚠️ **Her göç dosyasının BAŞLIK YORUMU okunmadan o göç hakkında bulgu
yazılmaz.** 0109, 0110, 0111 ve 0114'ün başlıklarında ölçüm çıktıları
ve bilerek verilmiş kararlar var.

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

### 1 · P1 adayı · **İKİ GÖÇ, TEK YÜZEY** — hangi dünyayı ölçüyoruz?

`db/migrations/0113_mevzuat_akisi.sql` tabloyu ve ilk kapıları KURDU.
`db/migrations/0114_mevzuat_kutuphanesi.sql` okuma ve yazma
fonksiyonlarını **düşürüp yeniden yazdı**. Yani **yürürlükteki gövdeler
0114'te.**

⚠️ Bu tam olarak **tuzak 190**'ın zemini: 0113'e bakan bir iddia,
0114'ten sonra **var olmayan bir kuralı** ölçer ve yeşil yanar.

`src/platform/mevzuat-kapisi.arch.test.ts` bu yüzden iki göç metnini
ayrı ayrı okuyor (`GOC` ve `GOC_0114`). **Sorular:**
- 0113'e bakan iddialardan hangileri artık **ölü**? (Örnek: 0113'teki
  `mevzuat_akisi_oku` gövdesinin `YAYINDA` süzgeci — o fonksiyon artık
  yok, 0114'teki var.) Ölü bir iddia yanlış güven verir.
- 0114 bloğundaki iddiaların hepsi gerçekten 0114'ü mü ölçüyor, yoksa
  biri yanlışlıkla `GOC` değişkenine mi bakıyor?
- Bir sonraki göç (`0115`) bu fonksiyonlardan birini tekrar yazarsa,
  **bu test dosyası sessizce bayatlar mı?** Bayatlamayı ÖNLEYEN bir
  mekanizma var mı, olmalı mı?

### 2 · P1 adayı · 0114 · düşürülen fonksiyonun YETKİLERİ
`db/migrations/0114_mevzuat_kutuphanesi.sql`

`drop function` GRANT'ları da siler (**tuzak 67**, bu depoda daha önce
MIYOP-044'te yaşandı). 0114 üç fonksiyonu düşürüp yeniden yazıyor ve
hepsinin yetkisini yeniden veriyor.

**Sorular:**
- Yeniden verilen yetki kümesi, 0113'ün verdiğiyle **birebir aynı mı**,
  yoksa fazladan bir hak mı açıldı? Özellikle: `anon` yalnız
  `mevzuat_akisi_oku`yu çağırabilmeli; `mevzuat_listesi`,
  `mevzuat_yaz`, `mevzuat_sil` ona KAPALI olmalı.
- **PUBLIC EXECUTE** alındı mı? PostgreSQL'de yeni fonksiyon varsayılan
  olarak PUBLIC'e açıktır; MIYOP-044 tam olarak buydu.
- `app.*` sürümleri (iç yardımcılar) dışarıdan çağrılabiliyor mu?
- `prova-0114.sql`in yetki bloğu bunların **hepsini** ölçüyor mu, yoksa
  bir kapı ölçümsüz mü kaldı?

### 3 · P1 adayı · 0114 · parametre sırası ve konumlu çağrılar
`app.mevzuat_yaz` / `public.mevzuat_yaz`

0114 `p_tur` parametresini **varsayılanı olan `p_durum`dan ÖNCE** koydu
(tür zorunlu olmalıydı; PostgreSQL'de zorunlu parametre varsayılanlıdan
sonra gelemez). Sonuç: eski **yedi argümanlı** çağrıların son argümanı
yeni yuvaya kaydı. Bu sefer patladı (`'YAYINDA'` geçerli bir tür değil);
**uyumlu bir değer olsaydı sessizce yanlış çalışırdı.** → tuzak 199.

**Sorular:**
- Depoda `mevzuat_yaz`ı çağıran **başka bir yer** kaldı mı (başka bir
  prova, bir betik, bir belge örneği) ve o çağrı yedi argümanlı mı?
- `src/platform/mevzuat.repository.ts` **adlı** parametrelerle çağırıyor
  (`p_tur: …`). Bu doğru korunma mı, yoksa başka bir risk mi taşıyor?
- Canlı veritabanında eski imzadan **artakalan ikinci bir fonksiyon**
  var mı? (Göç düşürüyor, ama ölçülsün.)

### 4 · P2 adayı · vitrin sırası · iki yerde iki gerçek riski
`db/migrations/0114…` (`order by case r.kind`) ·
`src/platform/mevzuat.service.ts` (`MEVZUAT_TURLERI`, `mevzuatiGruplara`)

Sıra **sunucuda** sabit: kanun → yönetmelik → tebliğ → haber.
`mevzuatiGruplara()` bilerek **sıralama yapmıyor**, yalnız gelen sırayı
koruyor; mimari test `.sort(` yazılmasını yasaklıyor ve göçteki `case`
numaralarını `MEVZUAT_TURLERI` sırasıyla karşılaştırıyor.

**Sorular:**
- Bu bağ gerçekten kuruluyor mu, yoksa test yalnız metin eşleşmesi mi
  yapıyor (yanlış yeşil)? `case` bloğunun kesimi (`indexOf('end,')`)
  doğru yeri mi kesiyor — tuzak 195?
- `BellekMevzuatDefteri.vitriniOku()` sunucunun sırasını **taklit
  ediyor**. Bu ikinci bir gerçek mi? (Kararım: hayır, çünkü o sınıf
  hiçbir ekranda kullanılmıyor ve taklit etmezse sınamalar sunucudan
  başka bir dünyayı ölçer.) Katılmıyorsan gerekçeni yaz.
- Tanınmayan bir tür istemcide `HABER`e düşüyor, **atılmıyor**
  (`tureCevir`). Doğru karar mı?

### 5 · P2 adayı · vitrin ne söylüyor, ne vadediyor
`src/pages/MevzuatVitrin.tsx` · `src/pages/Login.tsx` · `src/styles.css`

Bu köşede daha önce **MIYOP-059'un uydurma duyuruları** vardı.

**Sorular:**
- Kutu bir **söz** veriyor mu? ("güncel tutulur", "her gün yenilenir"
  gibi.) Bugünkü cümle: *"Bağlantılar mevzuatın kendi kaynağına gider;
  MİYOP burada yalnız yolu gösterir."* — bu cümle arkasında çalışan bir
  iş OLMADAN doğru mu?
- `status` ya da imza alanı herhangi bir yoldan ekrana düşebilir mi?
- Dış bağlantılar `rel="noopener noreferrer"` taşıyor mu, **hepsi**?
- Kayıt yokken bölüm gerçekten **hiç çizilmiyor** mu — ve kütüphane
  türünde kayıt yokken sadece *Son değişiklikler* başlığının görünmesi
  kabul edilebilir mi? (Bugün canlıda durum tam olarak bu: tek kayıt
  var ve türü `HABER`.)
- `.mevzuat-vitrin-*` CSS'i yeniden yazıldı; **ölü kural** kaldı mı?

### 6 · 0109 · olay zamanı damgası bir şeyi KIRDI mı
`db/migrations/0109_numune_olay_zamani_sunucudan.sql`

`occurred_at` artık **koşulsuz** `now()` ile yazılıyor. Sorular:
- `witness_sample_event`e yazan **başka bir yol** var mı ve o yol
  `occurred_at` gönderiyor mu? Gönderiyorsa artık sessizce yok sayılıyor.
- Geçmişe dönük kayıt girmenin **meşru** bir ihtiyacı var mı?
⚠️ `taken_at` için aynı kusur vardı ve **0112** ile kapatıldı.

### 7 · 0110 · kilit ve indeks gerçekten yeterli mi
`db/migrations/0110_geri_arama_es_zaman_kapisi.sql`

- `pg_advisory_xact_lock(110, hashtext(telefon))` — `110` ad alanı başka
  bir yerde kullanılıyor mu? `hashtext` çakışması ölçülsün.
- Kilit **doğrulamalardan sonra** alınıyor. Doğru sıra mı?
- Kısmi indeks yalnız `NEW` satırları kapsıyor. Bir talep CLOSED'dan
  NEW'a geri alınabiliyor mu? Alınıyorsa indeks o yolda devreye giriyor
  ve hata mesajı anlamlı mı?
- 24 saat / 3 talep sınırı **CLOSED kayıtları da sayıyor** (kararım:
  doğru — sınır "kaç talep bıraktı" sorusudur). Katılıyor musun?

### 8 · 0111 · kısıtlar ürünü kilitliyor mu
`db/migrations/0111_numune_metin_esikleri.sql`

- Ekranın eşikleri (`witness-sample.service.ts`) ile kısıtlar **birebir**
  mi? Üçüncü bir yerde numune kodu/gerekçe yazan yol var mı?
- `ALINDI` muafiyeti ve `IMHA`nın sonuç muafiyeti doğru mu?
- Canlıda eski kayıt ihlali varsa göç duruyor — doğru karar mı?

### 9 · Ölü CSS'in kalanı · **hâlâ açık**
`src/styles.css` — `.unified-login-announcement*` kaldırıldı.
⚠️ `.unified-login-reference*` kuralları kullanılmış görünmüyor ama
**depo genelinde aranamadı** ve silinmedi (kontrol listesi 69: *"kimse
kullanmıyor" cümlesi tip denetiminden önce kurulmaz*).
Codex ölçebilir: bu sınıfları kullanan bir `.tsx` var mı? Başka ölü
`unified-login-*` sınıfı var mı?

### 10 · Mimari testler gerçekten ölçüyor mu
Son iki turda eklenen iddialar **metin** ölçüyor. Her biri için soru:
**bu iddia yanlış yeşil verebilir mi?**
```
src/platform/mevzuat-kapisi.arch.test.ts           ← 44 iddia (0113 + 0114)
src/platform/mevzuat.test.ts                       ← 35 iddia
src/onboarding/geri-arama-kapisi.arch.test.ts      ← 0110 bloğu
src/quality/numune-kapisi.arch.test.ts             ← 0109 + 0111 blokları
src/pages/giris-vitrini-dogru-soyler.arch.test.ts  ← ölü CSS nöbeti
```
⚠️ Özellikle:
- Sabit karakter sayısıyla kesilen bir metin parçası var mı (tuzak 195)?
- Bir iddia **kendi açıklamasına** takılabilir mi (tuzak 194)? Göçler
  yasakladıkları metni hata mesajlarında da taşıyor.
- `prova-0114-ters.sql` gerçekten kusuru **üretiyor** mu, yoksa sahneyi
  kapının dışında mı kuruyor (tuzak 197)?

### 11 · `kaydet.ps1`e push eklendi (10.11)
`araclar/kaydet.ps1`

Betikte **`git push` hiç yoktu**; iki tur üst üste commit yalnız
Emrah'ın diskinde kaldı. Eklendi; push düşerse betik durmuyor ama
kırmızı yazıyor.
**Sorular:** `$LASTEXITCODE` kontrolü doğru yerde mi? Dosya hâlâ
yalnız ASCII mi (`src/core/powershell-kacis.arch.test.ts` bunu ölçüyor)?
Push'u betiğe koymak **yanlış bir şeyi de** otomatikleştiriyor mu?

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

⚠️ **Mevzuat kütüphanesinin İÇERİĞİ bu turun konusu değil.** Emrah
(10.11): *"bu konuyu burada demo sonrasına bırak."* Kütüphaneye hangi
bağlantıların konacağı park edildi; **kodun doğruluğu** denetlenecek.
