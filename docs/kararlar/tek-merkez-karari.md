# Tek merkez kararı · şube şimdilik yok

**Emrah (25.10.2026):** *"Şube olayı zaten şu an olmasın. Şu anki seviye
müşterinin genel merkezi gibi davransın işte."*

---

## 1 · KARAR

MİYOP bugün **tek bir yerin** sistemi: müşterinin genel merkezi. Şube
kavramı **kullanıcı yüzeyinden kaldırıldı.**

⚠️ **Veritabanından KALDIRILMADI.** `branch` tablosu, bütün tablolardaki
`branch_id` kolonu, `branch.manage` izni, `user_branch_access` ve RLS
politikaları **olduğu gibi duruyor.** Sebep: şube ileride geri gelecek ve
o gün geriye dönük veri düzeltmek, bugün kolona dokunmamaktan kat kat
pahalı. Her kayıt bugün de kendi şubesini taşıyor — o şube tek ve genel
merkez.

## 2 · NE KAPANDI

| Kapanan | Nasıl | Neden |
|---|---|---|
| **Şubeler** ekranı (`branches`) | `system-branches` menü ögesi donduruldu | Ekran yarımdı (tarayıcıya yazıyordu) ve tek merkezde kimsenin işine yaramıyor |
| **Şube Yetkilendirme** (`branch-permissions`) | `business-multi-branch` modülü donduruldu | Aynı sebep + MIYOP-061 (başka kiracının önbellek verisini gösterebiliyordu) + MIYOP-058 (dört uydurma demo şube listeliyordu) |
| Giriş vitrinindeki **"Çoklu Şube"** kartı | Silindi | Müşteriye söz verilmiyor |

**Geri açmak:** `foundationScope: 'frozen'` satırlarını silmek. Kod,
tablo ve izin yerinde.

## 3 · BU KARARIN NEYİ ÇÖZDÜĞÜ · dürüst muhasebe

Bu karar **iş azalttı**, iş bitirmedi. İkisi farklı şey:

**Gerçekten çözülen:**
- Demo öncesi yarım ekran sayısı **5 → 3** (Firma Profili, İşletme
  Ayarları, Karşılama kaldı). İki ekranı onarmak gerekmiyor artık.
- **MIYOP-061 kapandı** · başka kiracının şube/erişim önbelleğini gösteren
  tek ekran kapandı. (Kaynaktaki süzgeçsiz okuma hâlâ duruyor ama artık
  hiçbir açık ekrana ulaşmıyor.)
- **MIYOP-058'in görünen yüzü kapandı** · dört demo şubeyi listeleyen ekran
  kapandı. ⚠️ **Üreticinin kendisi hâlâ duruyor** (`createDemoBranches`,
  `storage.ts:478`) ve `company-bridge` onu hâlâ kalıcılaştırıyor →
  HEDEFLER 3.10.1'de açık kalıyor. **Ekran kapatmak, üretici silmek
  değildir.**
- **MIYOP-008 küçüldü** · şube seçimi sorunu "17 ekranda yanlış şubeye
  yazma" olmaktan çıkıp "bağlam tek merkezi KESİN bulsun"a indi.
  ⚠️ Kapanmadı: kod hâlâ *"tercih yoksa ilk şube"* diyor. Tek şubede bu
  doğru sonucu verir ama **tesadüfen** doğrudur; kesinlik değil. Ayrıca
  bazı liste sorguları `branch_id` süzgeci hiç uygulamıyor.

**Çözülmeyen, kapsam dışına çıkan:**
- `BranchManagement.tsx` ve `BranchPermissions.tsx` **hâlâ depoda ve hâlâ
  tarayıcıya yazıyor.** Borç kapanmadı, sıradan çıktı.
- Çıcır testindeki `BILINEN_BORC` listesinden çıkmaları bir **düzeltme
  değil**, kapsam değişikliği — testin içine bu not yazıldı ki ileride
  "düzeltilmiş" sanılmasın.

## 4 · AÇIK SORULAR (bugün cevap gerektirmiyor)

1. **Genel merkezin adı ve adresi nerede düzenlenecek?** Bugün `branch`
   satırının adı/adresi var ve ekranı kapattık. Firma Profili firmanın
   adını/adresini tutuyor; şube satırı ayrı. Tek merkezde ikisi aynı şey
   olmalı. → Firma Profili ekranı yazılırken karara bağlanacak
   (HEDEFLER 3.1).
2. **Başlıktaki şube seçici** ne olacak? Tek şube varken seçici bir şey
   seçtirmiyor. Kaldırılması MIYOP-008 işinin parçası.
3. Şube geri geldiğinde **şube bazlı izin mi, üyelik mi?** Bugünkü
   `user_branch_access` yalnız üyelik tutuyor; eski ekranın formu
   oluştur/düzenle/sil bayrakları istiyordu ve o kolonlar yok.
   → `ismete-sorulacaklar.md` **B2**
