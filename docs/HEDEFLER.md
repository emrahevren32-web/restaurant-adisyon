# MİYOP · Hedefler

**Son güncelleme:** 17.10.2026 · göç 0088 yazıldı ve prova edildi (0087 uygulandı)
**Kural:** Bir hedefi yaparken altından yeni bir iş çıkarsa, ana hedefin
altına alt madde olarak eklenir. Tamamlanan madde silinmez, ✅ işaretlenir —
neyin neden yapıldığı kaybolmasın.

**Durum işaretleri:** ✅ bitti · 🔄 devam · ⬜ sırada · ⏸️ bekliyor

---

## 0 · ŞİMDİ · Yarım kalan iş

- ✅ **0.1** Canlıya dağıtım yapıldı (Yayın 2 · 17.10.2026)
- ✅ **0.2** Codex 0084/0085 denetimi · iki kırık akış buldu (MIYOP-031, -032)
- ✅ **0.3** Göç **0087** uygulandı (MIYOP-002)
- 🔄 **0.4** Göç **0088** uygulanacak · MIYOP-001'in kalan **27** tablosu +
  MIYOP-035. Yerel PostgreSQL'de prova **42/42**.
- ⬜ **0.5** Codex'e 0086/0087/0088 denetimi · brif: `docs/codex-brifi.md`

---

## 1 · GÜVENLİK SINIRI · "Ekranda gizlemek koruma değildir"

Codex denetimi (17.10.2026) gösterdi ki tarayıcıdaki izin kontrolü bir
güvenlik sınırı değil. Gerçek sınır veritabanında olmalı.

- ✅ **1.1** Yazma kapıları veritabanına — birinci tur (göç 0081)
  Reçete, reçete satırı, sevkiyat, sevkiyat satırı, HACCP ölçümü,
  düzeltici faaliyet, ambalaj beyanı. 7 tetik. Prova 29/29.
- ✅ **1.2** Faaliyet kapısının dört deliği (göç 0082)
  Codex'in bulduğu: OPEN→CANCELLED, kapanmış kaydı düzenleme, geri açma,
  ölçüm taşıma. Prova 21/21.
- ✅ **1.3** Yazma kapıları — ikinci tur, MIYOP-001 (göç 0085)
  Stok defteri, stok kartı, lot, şecere, firma, şube, kullanıcı,
  şube erişimi, kiracı. 9 tetik. Prova **39/39**, gerçek PostgreSQL'de
  `authenticated` rolüne geçerek.
  - ✅ **1.3.1** Stok defteri kapısı `reason`a bakıyor — tek izin yazmak
    mal kabulü (satın almacı) ya da üretimi kırardı.
  - ✅ **1.3.2** `app.izin_gerek()` sertleşti; `anon` artık geçemiyor.
    0081'de "oturum yoksa serbest" yazıyordu ve `anon` da oturumsuzdur.
  - ✅ **1.3.3** `user_branch_access` kapandı — kullanıcı kendine şube
    erişimi veremiyor (MIYOP-007'nin yazma yarısı).
  - ✅ **1.3.4** Kendi profilini düzenleme açık bırakıldı: `users.manage`
    ya da KENDİ satırı.
- ✅ **1.3.5** **0085 İKİ AKIŞI KIRDI — 0086 onardı.** Codex buldu.
  - MIYOP-031 · kalite rolü etiket beyanını yazamıyordu
    (`stock_item` kapısı `stock.write` istiyordu, kalitede o izin yok)
  - MIYOP-032 · satın almacı lot açamıyordu → **yarım kalmış mal kabul**
    (hareket geçiyor, lot düşüyor)
  - Ders → tuzak 88: bir akışın izni TEK tabloya bakılarak belirlenemez.
  - Prova 31/31. Stok kartı kapısı kolon saymıyor, JSON farkı kullanıyor.
- ✅ **1.3.6** **MIYOP-001'İN KALANI KAPANDI** (göç **0088**, prova **42/42**)
  Codex ikinci turda kapısı olmayan **26 tabloyu** satır satır listeledi.
  En ağırı: `izleyici` kendi kiracısındaki **HACCP kritik kontrol noktası
  limitlerini** değiştirebiliyordu.
  - ✅ **1.3.6.1** `app.izin_gerek_coklu()` · tetik argümanlarından biri
    yeterli. Argümansız kurulursa **patlıyor**, sessizce geçirmiyor.
    Argüman kontrolü bakım bağlamından ÖNCE.
  - ✅ **1.3.6.2** Eşleme, tabloya değil **EKRANIN kapısına** bakılarak
    yapıldı (tuzak 88'in dersi): Suppliers/PurchaseFlow → `purchase.write`,
    WorkOrders → `production.write`, Sayımlar → `stock.write`,
    Müşteriler/Siparişler → `operations.write`, Sevkiyatlar →
    `logistics.write`, HACCP planı/KKN → `quality.record.manage`.
  - ✅ **1.3.6.3** Mal kabul ve tedarikçi iadesi **iki izni birlikte**
    kabul ediyor (`purchase.write` VEYA `stock.write`): belgeyi satın almacı
    açar, malı depocu alır. Provada ikisi de ayrı ayrı denendi.
  - ✅ **1.3.6.4** HACCP planı/KKN `quality.record.manage` istiyor,
    `quality.write` değil. Ölçüm girmek ile LİMİTİ değiştirmek aynı şey
    değil (0081'in ikiye ayırma kararının devamı).
  - ✅ **1.3.6.5** Eşleme bayatlarsa göç patlıyor: tablo yoksa ya da
    27 tetik kurulmadıysa durur.
  - ✅ **1.3.6.6** **27. TABLO · kendi ölçümüm, Codex listesinde yoktu.**
    Kapıları taktıktan sonra "kapısız yazılabilir tablo kaldı mı" diye
    veritabanını ölçtüm: `stock_item_nutrition`. 0072 alerjen beyanının
    doğrudan yazılmasını kapatmış, **besin değeri tablosunu atlamış** —
    ve o tablo gıda etiketine basılıyor. Hakkı tamamen geri almak ekranı
    kırardı (besin değeri için yazma RPC'si yok), onun için kapı kondu:
    `quality.declaration` · `products.write` · `stock.write`.
  - ✅ **1.3.6.7** Göç artık **kapı saymıyor, kapısız yüzey ölçüyor.**
    0085'te "kapandı" demem, taktığım kapıları saymamdan geldi. Doğru
    soru: `authenticated` rolüne yazma hakkı olup kapısı olmayan tablo
    kaldı mı? **Cevap: 0.** Göç bu sayı 0 değilse durur.
- ✅ **1.3.7** **MIYOP-035** · Sahte alerjen damgası kapandı (göç 0088)
  0072'nin koruması yalnız UPDATE'teydi. Yeni kart AÇARKEN
  `allergen_reviewed_at` doldurulabiliyordu: depo rolü, beyan RPC'si hiç
  çağrılmadan "alerjeni incelendi" kartı oluşturuyor, etiket servisi bunu
  "incelendi · alerjen yok" diye basıyordu. Artık MI436 ile duruyor.
- ✅ **1.3.8** "MIYOP-001 tamamen kapandı" demem **yanlıştı**; Codex haklıydı.
  0085 yarısını kapatmıştı, 0088 kalanını kapattı. Ders: kapı sayısı değil
  **kapısız yüzey** ölçülür.
- ✅ **1.4** **MIYOP-002** · Sipariş onayı başkası adına verilemiyor
  (göç **0087**, prova 16/16)
  - ✅ **1.4.1** `decided_by` ve `decided_at`i SUNUCU yazıyor; istemcinin
    gönderdiği kimlik ve tarih yok sayılıyor (0081 `completed_by` deseni)
  - ✅ **1.4.2** Adımın izni `order_approval_step.permission_code`dan
    OKUNUYOR, sabit yazılmıyor — işletme zincirini değiştirirse kapı da değişir
  - ✅ **1.4.3** Uydurma adım koduyla onay yazılamıyor
  - ✅ **1.4.4** Zorunlu adımı etkisizleştirmek `settings.manage` istiyor
- ⬜ **1.5** **MIYOP-003** · Çapraz kiracı referansı + denetim sızıntısı
  Lot/hareket içindeki tenant/şube/kalem/lot referanslarının aynı sahibe
  ait olması zorlanmıyor. Denetim özeti `SECURITY DEFINER` ile kalem adını
  tenant koşulu olmadan okuyor.
- ⬜ **1.6** **MIYOP-017** · Çıkış Supabase oturumunu kapatmıyor
- ⬜ **1.7** **MIYOP-018** · Zorunlu parola değişimi tek RPC ile atlanabiliyor
- ⏸️ **1.8** PUBLIC EXECUTE temizliği · 7 fonksiyon
  ⚠️ `app.yetkim_var`dan ASLA alınmayacak — bütün kapılar ona bağlı.

---

## 2 · VERİ BÜTÜNLÜĞÜ · "Yarım kalan iş kalmasın"

- ⬜ **2.1** **MIYOP-004** · Sahte ters kayıt negatif stok kontrolünü aşıyor
  `reverses_movement_id` dolu olan her kayıt kontrolden muaf; ters kaydın
  gerçekten tam ters olduğu doğrulanmıyor.
- ⬜ **2.2** **MIYOP-005** · Satır güncellemesinde veri kaybı
  Reçete/plan/sevk satırlarında önce `delete()` sonra `insert()`.
  İkincisi düşerse satırlar kalıcı olarak gidiyor.
- ⬜ **2.3** **MIYOP-006** · İşlemler atomik ve tekrar denenebilir değil
  Lot, hareket, belge bağlantısı ve durum geçişi bağımsız yazımlar.
- ⬜ **2.4** **MIYOP-011** · Eşzamanlı çıkışlar aynı lotu negatife düşürüyor
- ⬜ **2.5** **MIYOP-013** · Tedarikçi iadesi yanlış lottan düşebiliyor
- ⬜ **2.6** **MIYOP-014** · HACCP kararı istemciden geliyor
- ⬜ **2.7** **MIYOP-015** · Sevk iptalinde sipariş durumu geri hesaplanmıyor
- ⬜ **2.8** **MIYOP-016** · Üretim maliyeti sonraki alışlardan etkileniyor

---

## 3 · EKRAN BORCU · "Kaydettim ama gitmemiş"

Açık 25 kiracı rotasının 6'sı `storage.ts` (tarayıcı hafızası) okuyor/yazıyor.
Kullanıcı Kaydet'e basıyor, ekran kaydedildi diyor, veri tarayıcıda kalıyor.
`src/modules/kiraci-ekrani-veri-kaynagi.arch.test.ts` bunları dondurdu —
liste yalnız KISALABİLİR.

Emrah'ın onayladığı sıra:

- ⬜ **3.1** Firma Profili (`company-profile`)
  - ⬜ **3.1.1** Kim değiştirebilsin? Vergi numarası fatura kesmeyi
    etkiliyor. (Emrah'a sorulacak)
- ⬜ **3.2** Profilim (`my-profile`) — şu an "Kullanıcı kaydı bulunamadı"
  hatası veriyor, hiç çalışmıyor
- ⬜ **3.3** Şube Yetkileri (`branch-permissions`)
- ⬜ **3.4** İşletme Ayarları (`settings`)
- ⬜ **3.5** Şubeler (`branches`)
- ⬜ **3.6** **MIYOP-008** · Başlıkta seçilen şube gerçek sorgulara
  aktarılmıyor. B şubesi seçiliyken kayıt A'ya yazılabiliyor.
- ⬜ **3.7** **MIYOP-010** · Etiket ekranında ürünler arası veri karışması

---

## 4 · PLATFORM PANELİ (EVREN360)

- ✅ **4.1** Menü ayrıldı · platform sahibi kiracı menülerini görmüyor
- ✅ **4.2** Panel 19 düz ögeden 3 gruba indi; 11 eş menü gizlendi
- ✅ **4.3** Veritabanı okumayan ekranlar görünür ama kilitli, gerekçeli
- ✅ **4.4** Platform okuma kapıları (göç 0083) · 5 fonksiyon, prova 90/90
- ✅ **4.5** Müşteri Listesi gerçek veriyle · arama + 5 süzgeç
- ✅ **4.6** Müşteri Detayı · 20 maddelik liste, cevapsızlar gerekçeli
- ✅ **4.7** Müşteri kartından lisans uzatma
- ⬜ **4.8** **Ödeme takibi ve pasife alma** (Emrah kararı 17.10.2026)
  - Sistem ödemeyeni **asla otomatik kapatmaz.** 3 ay kullanmaya devam
    edebilir — hem samimiyet hem veri birikimi hem bağlılık.
  - ⬜ **4.8.1** Ödemeyeni/geciktireni görme ekranı
  - ⬜ **4.8.2** Tek düğmeyle pasife alma (platform sahibi kararıyla)
  - ⬜ **4.8.3** Taahhüt alanı: ay süresi + bitiş tarihi. Cayma bedeli
    YOK (Emrah: "önce bir ilk müşteriyi bulalım").
  - ⬜ **4.8.4** Ödeme planı ve borç tablosu (5.2, 5.3 sorularının deposu)
  - ⬜ **4.8.5** Şirkete özel yönetici notu (5.4)
- ⬜ **4.9** Kontrol Paneli gerçek sayaçlarla
- ⬜ **4.10** **MIYOP-028** · Pasif lisansın gerçek durumu görünmüyor
  `lisansiOku` yalnız Deneme/Aktif getiriyor; Süresi Doldu/Askıda/İptal
  için `null` dönüyor ve ekran "kayıt görünmüyor" diyor.

---

## 5 · PRESTİJ · "En iyi şekilde karşılarına çıkalım"

Emrah: *"Demoya çok takılma, işleri bitir, prestiji sağla, hazırım de
gidelim yapalım demomuzu."* Demo ileri tarihe atılabilir.

⚠️ Bu başlık **1 ve 2 bittikten sonra** başlar. Salt okunur bir kullanıcının
deftere yazabildiği bir sistemin üstüne sohbet penceresi koymak yüzeyi
büyütür, değeri büyütmez.

- ⬜ **5.1** **Yardım Merkezi** (SSS)
  ⚠️ Satış dilinde "yapay zeka" DENMEYECEK. Teknik başlık: kural motoru.
  - ⬜ **5.1.1** Uygulama içinde SSS bölümü
  - ⬜ **5.1.2** Soru-cevap penceresi — müşteri her şeyde aramasın
- ⬜ **5.2** **Geri bildirim düğmesi** (Microsoft modeli)
  Övgü · Sorun bildir · Öneride bulun
  - ⬜ **5.2.1** Yalnız en yetkili kullanıcı gönderebilsin
  - ⬜ **5.2.2** Geri bildirim verene küçük bir karşılık (ör. lisansa
    birkaç gün). Yapılamazsa düğme yine konur.
- ⬜ **5.3** **Sohbet modülü** · herkes okur, müdürün yetkilendirdiği yazar
  - ⬜ **5.3.1** Yeni izin: `chat.write`
- ⬜ **5.4** **MİYOP ana sayfası** · SSS + "ne olduğumuzu anlatan" metin
  - ⬜ **5.4.1** Alt bilgi (footer) bilgilendirme sayfaları
- ⬜ **5.5** **Toplu duyuru** · platform sahibinden müşterilere
  Tipler ve hedef seçenekleri zaten tanımlı (`notification.types.ts`) ama
  depo tarayıcıda ve kiracı tarafında zil hiç çalışmıyor.
  (Emrah: "demodan sonra, acelesi yok")

---

## 6 · İŞLETME · Altyapı ve süreç

- ✅ **6.1** Hetzner sunucu + alan adı + SSL · `miyop.emrahevren.com`
- ✅ **6.2** Dağıtım betiği · test kırmızıysa yayın yok
- ✅ **6.3** Yedek betiği + sürüm defteri
- ✅ **6.4** Lisans uyarısı Kontrol Paneli'nde (7 günde kritik)
- ⬜ **6.5** **Supabase Pro** · ilk müşteri anlaşmasından sonra (25 $/ay)
  ⚠️ Şu an ücretsiz planda **hiç veritabanı yedeği yok.** Emrah bunu
  bilerek kabul etti: *"kalsın, müşteri görsün uyarıyı verdiğimizi."*
- ⬜ **6.6** **MIYOP-020** · Geri yükleme provası hatayı başarısızlık saymıyor
- ⬜ **6.7** **MIYOP-026** · Yayın kapısı veritabanı davranışını sınamıyor
- ⬜ **6.8** **MIYOP-030** · README güncel mimariyi anlatmıyor
- ⬜ **6.9** Oturum kilidi 45 → 30 dakika
- ⬜ **6.10** Etiket yazdırma · 58 mm ve 100×150 mm seçeneği
- ⬜ **6.12** **Provalar depoya girdi, 14'ü kırık**
  - ✅ **6.12.1** ⚠️ **Provalar depoda değildi.** 0083–0088 dışındaki 30
    dosya yalnız Claude'un çalışma ortamındaydı: kanıt vardı ama kimse
    göremiyordu, sürümler arasında karşılaştırılamıyordu, Codex
    denetleyemiyordu. Codex sorunca ortaya çıktı. Hepsi `db/prova/`
    altına kondu + `kur.sh`, `hepsini-kosturt.sh`, `README.md`.
    → tuzak 91.
  - ✅ **6.12.2** ⚠️ **"11 / 50" demiştim; doğrusu 14 / 36.** Hem payda
    hem pay yanlıştı. Pay yanlıştı çünkü ilk sayaç betiğim yalnız
    `✗`/`ERROR` arıyordu; eski provalar başarısızlığı
    `raise notice '❌ ...'` ile bildirir — NOTICE'tır, ERROR değildir.
    Betik ayrıca PostgreSQL kapalıyken 36 dosyanın hepsini YEŞİL
    saymıştı. → tuzak 92.
  - ⬜ **6.12.3** 14 kırık dosyayı tek tek ayır: **bayat** mı, **gerçek
    gerileme** mi? (Codex'ten de bu isteniyor.)
  - ⬜ **6.12.4** Bayatları güncelle, gerçek gerilemeleri onar
  - ⬜ **6.12.5** `hepsini-kosturt.sh`i **yayın kapısına** ekle (6.7 ile
    birlikte). Bu bitene kadar doğru cümle şudur: *"provaları elle
    koşturdum, 22'si geçiyor"* — *"provalar geçiyor"* değil.
- ⬜ **6.11** `g7_rls_kapat.sql` · RLS'i kapatan dosya `db/migrations` içinde
  duruyor; yanlışlıkla çalıştırılabilir

---

## 7 · ÇALIŞMA DÜZENİ

- ✅ **7.1** Codex = denetçi, Claude = uygulayıcı. **Aynı anda değil, sırayla.**
  Emrah: *"Senin token bitince ona, onun token bitince sana."*
  Ayrıntı: `claude/codex-ile-calisma-duzeni.md`
- ✅ **7.2** Codex brifi hazır · `docs/codex-brifi.md`
  Karar dosyalarını okutuyor ki bilinçli kararları "hata" sanmasın.
- ✅ **7.4** **MIYOP-037** · Provanın kendisi denetlendi.
  `prova-0086.sql` içinde bir blok `exception when others` kullanıyordu ve
  **iddianın kendi hatasını da yutuyordu**: başarısızlık yeşile dönüyordu.
  Düzeltildi (yalnız SQLSTATE toplanıyor, iddia bloğun DIŞINDA).
  Bütün prova dosyaları aynı desen için tarandı — başka örnek yok, ve
  `yazma-kapilari-tamam.arch.test.ts` deseni artık kalıcı olarak yasaklıyor.
  → tuzak 89.
- ✅ **7.3** Alt hedef kuralı: bir işin altından yeni iş çıkarsa ana
  hedefin altına numaralı alt madde açılır (bu dosyanın kendi kuralı).

---

## Güncel dokümanlar · nereye bakılır

Proje notları Claude Projesi içinde kalıyor (taşımak maliyetli). Aşağıdaki
liste **güncel ve geçerli** olanları gösterir; adı geçmeyen eski not
arşiv sayılır.

| Doküman | Ne için |
|---|---|
| `docs/HEDEFLER.md` | **Tek doğru iş listesi.** Sıra buradan okunur. |
| `docs/codex-brifi.md` | Codex'e yapıştırılan denetim brifi |
| `docs/kararlar/kararlar-ve-tuzaklar.md` | Tuzaklar 1–89, bilinçli kararlar |
| `docs/kararlar/codex-denetimi-ekim-2026.md` | Codex bulgu defteri (MIYOP-xxx) |
| `docs/kararlar/calisma-duzeni.md` | Codex–Claude sırayla çalışma düzeni |
| `docs/MIYOP-Surum-Defteri.xlsx` | Yayın defteri · yapılan / bekleyen |
| `claude/musteri-profili-gercek-veri.md` | Gerçek müşteri profili |
| `claude/endustriyel-mutfak-kapsam.md` | Kapsam kararı |
| `claude/fiyat-modeli-karari.md` | Fiyatlandırma (fiyat henüz belirlenmedi) |
| `claude/satis-oyun-plani.md` | Satış planı |
| `claude/yetki-cercevesi.md` + `claude/rol-ekran-matrisi.md` | Rol/izin haritası |
| `claude/muhasebe-ve-e-donusum.md` | e-Fatura/e-İrsaliye kapsamı |
| `claude/siparis-defteri-tasarimi.md` | Sipariş defteri tasarımı |
| `claude/portal-tasarimi.md` | Müşteri portalı tasarımı |
| `claude/demo-senaryosu.md` | Demo akışı |

⚠️ `db/migrations/g7_rls_kapat.sql` **kullanılmaz** — RLS'i kapatıyor,
yanlışlıkla çalıştırılma riski var (6.11).

---

## Sayılar (17.10.2026)

| | |
|---|---|
| Test | 78 dosya · 1432 test · 0 hata |
| Göç | 0000–0088 · 89 dosya |
| Açık çekirdek rota | 25 (37'den indi) |
| Veritabanı yazma kapısı | **45 tetikleyici** (18 → +27 tablo) |
| Codex bulgusu | 37 · 8 P0 (**4'ü kapandı**: 001 tam, 002, 031/032, 035) |
| Kapısız yazma yüzeyi | **0 tablo** (ölçüldü, sayılmadı) |
| Prova dosyası | 36 · **22 yeşil / 14 kırmızı** (hiçbiri 0088'den değil · 6.12) |
| Mock dosya | 36 · hiçbiri açık kiracı rotasından erişilemiyor |
