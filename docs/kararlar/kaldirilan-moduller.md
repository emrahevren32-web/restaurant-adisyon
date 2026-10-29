# Kaldırılan modüller ve özellikler · kod gider, karar kalır

**Emrah'ın kuralı (20.10.2026):** *"sil ama ne işe yaradığını bil ve
sonradan yapılacağını unutma."*

Bu dosya, MİYOP'tan **kullanıcı yüzeyinden kaldırılan** her şeyin kaydı.
Her satırda dört şey var: ne işe yarıyordu, neden kaldırıldı, geri gelmesi
için ne gerekiyor, hangi hedefe bağlı.

⚠️ **Kaldırmak ile silmek farklı.** Buradaki çoğu şey hâlâ depoda duruyor;
kapatılan şey kullanıcının ulaşabildiği yüzey. Dosya silindiğinde satırın
sonuna yazılıyor.

---

## 1 · Dijital Katalog / QR Menü · `business-qr-menu`

**Ne işe yarıyordu:** Masa servisi için düşünülmüştü. Müşteri masadaki
karekodu okutur, dijital katalogdan sipariş verir, görevli çağırır.

**Neden kaldırıldı (25.10.2026 · MIYOP-067):** Modül zaten donmuştu ama
`App.tsx` içinde `/qr/<id>` yolunu yakalayıp sayfayı **doğrudan** açan bir
dal vardı — donmuş rota kapısının dışından. Ekran *"Görevli çağrınız
iletildi"* ve *"Talebiniz görevli onayına gönderildi"* diyordu; yazım
yalnız `localStorage`a gidiyordu, **sunucuya hiçbir şey iletilmiyordu.**

**Geri gelmesi için:** masa, talep ve çağrı tabloları + RLS + gerçek
servis. Yani sıfırdan.

**Durum:** public yol kaldırıldı (25.10). `src/pages/QRMenu.tsx` **diskte
duruyor.** Donduran test: `src/modules/public-yol-ve-kabuk.arch.test.ts`.

⚠️ **Emrah'ın depo karekodu fikriyle KARIŞTIRILMASIN.** O ayrı bir iş ve
ayrı belgesi var: `parti-karekodu.md`. Bu kaldırılan şey masa servisiydi.

---

## 2 · Sistem Duyuruları · giriş vitrinindeki bölüm

**Ne işe yarıyordu:** Platform sahibinin (Emrah) müşterilere duyuru
yayınlaması: bakım penceresi, lisans hatırlatması, kampanya.

**Neden kaldırıldı (25.10.2026 · MIYOP-059):** İki ayrı sebep, ikisi de
yeterli.
1. Kayıt yokken `createDemoAnnouncements()` **uydurma duyuru üretiyordu**:
   *"Planlı bakım bildirimi · Pazar gecesi kısa süreli bakım penceresi
   uygulanacaktır"* ve *"Lisans yenileme hatırlatması"*. Tarihler her
   açılışta yeniden hesaplanıyordu, yani her gün "iki gün sonra bakım"
   diyordu. **Müşterinin gördüğü ilk ekranda, bizim vermediğimiz bir
   taahhüt.**
2. Özellik **çalışmıyordu zaten**: duyuru yazma ekranı
   (`evren360-system-announcements`) platform panelinde
   `veriKaynagi: 'hazirlaniyor'` ile kapalı — gerekçesi kayıtta yazılı:
   *"Duyuru tablosu veritabanında yok."* Duyurular yalnız tarayıcı
   hafızasına yazılıyor. Emrah bir duyuru yazsa **hiçbir müşteriye
   ulaşmazdı.**

Üreticiyi silip bölümü bırakmak yetmezdi: kalıcı olarak boş bir bölüm de
"burada bir şey olacak" demektir.

**Geri gelmesi için:** `system_announcement` tablosu + yayınlama akışı +
hedef kitle süzmesi (tüm müşteriler / aktif / deneme / belirli paket —
bunların tipleri yazılı, tablosu yok).

**Durum:** `createDemoAnnouncements` **SİLİNDİ**. Vitrindeki bölüm
kaldırıldı. `notification.service.ts` ve `SystemAnnouncements.tsx`
duruyor; platform ekranı kapalı. Donduran test:
`src/pages/giris-vitrini-dogru-soyler.arch.test.ts`.

---

## 3 · Modül Mağazası · `system-marketplace`

**Ne işe yarıyordu:** 14 modül kartı; müşteri kendi modüllerini
"kurabiliyordu".

**Neden kaldırıldı:** Denetim (`claude/modul-magazasi-denetimi.md`) şunu
buldu: 14 kartın hepsinde basılabilir "Kur" düğmesi var, ilerleme çubuğu
**sahte** (`await wait(280 + i*55)`), kurulum yalnız `localStorage`a
yazıyor — Postgres'e değil, altı modülde kurulumdan sonra menüde hiçbir
şey değişmiyor, kurulunca gelen ekranların çoğu `*.mock` dosyalarından
besleniyor.

**Geri gelmesi için:** modül kurulumunun veritabanında gerçekleşmesi +
kurulan modülün gerçekten menüye gelmesi. Yerine demo sonrası **düğmesiz
bir "Yol Haritası" ekranı** düşünülüyor: ne var, ne yolda, ne yok.

**Durum:** menü kaydı boşaltıldı, rota açık kümede değil → ekran
ulaşılamaz. ⚠️ 25.10'da düzeltildi: kayıttaki yorum *"rota duruyor,
geri almak tek satır"* diyordu, **yanlıştı** (MIYOP-070) —
`marketplace` `NON_NAV_CORE_ROUTES` listesinde değil. Geri açmak iki satır.

---

## 4 · Çoklu Şube · `business-multi-branch` + Şubeler ekranı

**Ne işe yarıyordu:** Şube yönetimi, şube yetkilendirme, şubeler arası
raporlama ve stok transferi.

**Neden kaldırıldı (25.10.2026):** Emrah'ın kararı — *"şube olayı zaten şu
an olmasın, şu anki seviye müşterinin genel merkezi gibi davransın."*
Ayrıca iki açık ekranı da yarımdı: tarayıcıya yazıyorlardı, Şube
Yetkilendirme başka kiracının önbellek verisini gösterebiliyordu
(MIYOP-061) ve dört uydurma demo şube listeliyordu (MIYOP-058).

**Geri gelmesi için:** `foundationScope: 'frozen'` satırlarını silmek +
iki ekranı gerçek veriye bağlamak. Veritabanı tarafı **hazır ve duruyor**:
`branch`, `branch_id`, `user_branch_access`, `branch.manage`, RLS.

**Durum:** modül ve menü ögesi donduruldu. Kod diskte.
Karar belgesi: `tek-merkez-karari.md`.

---

## 5 · Giriş vitrinindeki uydurma vaatler (modül değil, cümle)

**Kaldırılanlar (25.10.2026):**
- **"Referans müşteriler"** bölümü (daha önce) · *Aster Workspace, Nova
  Grup, Orion Merkez* diye üç şirket yazıyordu. **Böyle müşteriler yok.**
- **Dört "son güncelleme" kartı** · *"EVREN360 SaaS Yönetim Merkezi"*,
  *"Unified Identity Foundation"*, *"Operasyon ekranları sadeleşti"*,
  *"Security Gateway hazırlığı"*. **"Security Gateway" diye bir şey yok**;
  "finans operasyonları tek merkezde toplandı" diyordu ama Finans modülü
  donmuş. Yerine gerçekten çalışan dört şey yazıldı (HACCP kurulu geliyor,
  parti izlenebilirliği, alerjen beyanı, sunucu tarafı yetki).
- **"Modüler Yapı"** kartı · *"İşlem Yönetimi, Dijital Katalog, stok,
  cari, finans ve personel modülleri ihtiyaca göre aktif edilir"* — altı
  addan **dördü dondurulmuş modül.**
- **"Çoklu Şube"** kartı · tek merkez kararı.
- **"Güvenli Altyapı"** kartındaki *"Security Gateway"* · yerine gerçek
  olan yazıldı: kiracı yalıtımı, sunucu tarafı yetki, denetim izi.

**Durum:** hepsi silindi. Donduran test dondurulmuş modül adlarını
**kayıttan okuyor** ve vitrinde geçmelerini yasaklıyor — yani yeni bir
modül dondurulduğunda adı vitrinde kalmışsa test onu kendiliğinden yakalar.

---

## 6 · `src/auth/giris-adresi.ts` · tarayıcıdaki adres çözümü (29.10.2026)

**Ne işe yarıyordu:** kişi giriş ekranına `depocu@ABCGIDA` yazdığında,
giriş yapmadan ÖNCE sunucuya *"bu adın giriş adresi nedir?"* diye soruyordu
(`public.giris_adresi_bul`, göç 0077/0078), dönen gerçek adresle Supabase
Auth girişini yapıyordu. Personelin e-postası olmadığı için bu çeviri
zorunluydu; adres **uydurulmuyordu**, çünkü işletme sahibinin giriş adresi
kendi gerçek e-postası ve kurala uymuyor.

**Neden kaldırıldı:** o RPC `anon` rolüne açıktı ve cevabın **biçimi** iki
hâli ayırt ettiriyordu — bulunan kullanıcı için **gerçek Auth e-postası**,
bulunamayan için `...@bulunamadi.miyop.local`. Yani parola bilmeden
"bu kullanıcı var mı" sorusu cevaplanabiliyor, işletme sahibinin gerçek
adresi dışarı sızıyordu (MIYOP-043, Codex 18.10.2026).

**Nereye taşındı:** aynı çeviri `supabase/functions/giris-yap/index.ts`
içinde, `service_role` ile yapılıyor. Tarayıcı adresi HİÇ görmüyor; dışarı
yalnız oturum ya da **tek genel hata** çıkıyor.

**Sonradan yapılacak bir şey YOK** — bu bir erteleme değil, bir taşıma.
Silinen dosyalar: `src/auth/giris-adresi.ts`, `src/auth/giris-adresi.test.ts`.
`storage.ts`teki geçici yedek yol da aynı gün silindi.

⚠️ **DOSYANIN İÇİNDEKİ HER ŞEY SIZINTI DEĞİLDİ.** `kesinEpostaMi` — *"bu
girdi kesinlikle bir e-posta mı?"* — hiçbir şey sormayan, hiçbir yere
gitmeyen **saf** bir karardı ve `Login.tsx` onu şifre sıfırlamada
kullanıyordu (`ad.soyad@ABCGIDA` de @ taşır ama oraya posta gitmez).
Dosyayla birlikte silinince tip denetimi anında kırmızı verdi. Kural
`src/auth/giris-adi-bicimi.ts`e **taşındı** (kendi testiyle); `Login.tsx`e
kopyalanmadı, çünkü "ayırmayı TEK YERDE yap" kararı duruyor. → tuzak 147

⚠️ **Geri gelmemesi ölçülüyor:** `src/auth/giris-sunucuda.arch.test.ts`
**bütün tarayıcı kaynağını** tarıyor ve `'giris_adresi_bul'` adının hiçbir
ekranda geçmemesini şart koşuyor. Göç **0102** da RPC'nin `anon` ve
`authenticated` haklarını aldı: geri gelse bile `42501` alır.
