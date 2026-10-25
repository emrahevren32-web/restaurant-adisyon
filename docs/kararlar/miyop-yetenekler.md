# MİYOP · Yemek fabrikası için ne işe yarıyor · ve demo öncesi durum

**Ölçüm tarihi:** 22.10.2026 · **Kaynak:** modül kaydı (`business-workspace.registry.ts`),
göçler 0001–0091, HEDEFLER 0.A.
⚠️ Bu liste **kaynak koddan ölçüldü**, tahmin değil. Ama *"ekran açılıyor"*
ile *"gerçek veriyle çalışıyor"* ayrı tutuldu.

---

## 1 · YEMEK FABRİKASINA FAYDALI YÖNLER · açık ve gerçek veriye bağlı

### 1.1 · Stok defteri — ürünün omurgası
- **Çift yönlü hareket defteri** · her giriş/çıkış işaretli kayıt; sıfır
  hareket yazılamaz, kayıt silinemez (göç 0003). "Kim ne zaman ne yaptı"
  geri alınmaz.
- **Parti (lot) takibi** · her parti kendi kodu, SKT'si, tedarikçisi ve
  kaynağıyla duruyor (`stock_lot`). Üretimden çıkan parti, girdi
  partilerine bağlanıyor (`lot_genealogy`).
- **Negatif stok politikası** · kiracı bazında; izinsiz eksiye düşmeyi
  veritabanı reddediyor (0010, 0011).
- **Birimler ve çevrimler** · kg/g/ton/lt/ml/adet/koli/tepsi +
  palet/çuval/kasa/paket (0002, 0059). ⚠️ Palet→kg gibi uydurma katsayı
  **yok**: çevrim kalem kartındaki net miktardan yapılıyor.
- **Sayım ve fire/imha** · fark `COUNT_SURPLUS`/`COUNT_SHORTAGE` olarak
  deftere düşüyor, zayi gerekçe istiyor (0025, 0026).

### 1.2 · Satın alma ve mal kabul
- **Tedarikçi kartı**, satın alma siparişi, **mal kabul** (kabul edilen /
  reddedilen miktar + red gerekçesi + tedarikçi irsaliye no) ve
  **tedarikçi iadesi** (0017–0020).
- Siparişsiz kabul **meşru** sayılıyor (acil alım, numune, iade dönüşü) —
  zorunlu kılmak sahte sipariş doğururdu.
- Mal kabul partiyi **kabulde** oluşturuyor; SKT o anda yazılıyor.

### 1.3 · Üretim
- **Reçete** ve **iş emri** (0021, 0022); üretim tüketimi ve çıktısı
  deftere hareket yazıyor — "üretildi ama stok düşmedi" olamıyor.
- **Üretilen partiler** ve parti soyağacı (0067): bir son üründen geriye
  hangi hammadde partilerinin girdiği çıkarılabiliyor.
- **Üretim maliyeti** hesaplanıyor (0074). ⚠️ Bilinen eksik: sonraki
  alışlardan etkilenebiliyor (MIYOP-016).

### 1.4 · Kalite ve gıda güvenliği — bu sektörün ayırt edici kısmı
- **HACCP planı, CCP'ler, ölçümler, düzeltici faaliyet** (0024). Her yeni
  işletmeye CCP seti **otomatik** kuruluyor (0079) — **şoklama dahil**
  (CCP-6 · hızlı soğutma, 2 saatte 10 °C).
- **Ölçümü ölçen girsin** kuralı (0068): başkası adına ölçüm yazılamıyor.
- **Alerjen ve besin değeri beyanı** (0057, 0072) · beyan **atomik**
  yazılıyor; sahte alerjen damgası veritabanı tarafından reddediliyor
  (MIYOP-035, göç 0088).
- **Etiket ve alerjen ekranı** · etiket basımı açık.
- **Ürün izlenebilirliği** ekranı açık: partiden sevkiyata, sevkiyattan
  partiye.

### 1.5 · Sipariş, sevkiyat, müşteri
- **Müşteri kartı** (0047) · teslim noktaları, fiyat listesi.
- **Sipariş defteri** (0050) · onay zinciri (0053), revizyon onayı
  düşürüyor (0055), siparişten iş emri (0056) ve siparişten sevkiyat
  (0051) türetme.
- **Sevkiyat ve irsaliye** (0023) · araç ve şoför/plaka (0064).
- **Teslim farkı** kayıt altında (0058) — "gönderdim/gelmedi" tartışması
  belgeye bağlanıyor.
- **Müşteri portalı** · kiracının kendi sitesine gömdüğü sipariş
  bağlantısı; müşteri sipariş veriyor, güncelleyebiliyor (0054, 0063).

### 1.6 · Yetki, denetim, çok şubelilik
- **13 rol** · İşletme Sahibi, İşletme Müdürü, Depo/Satın Alma/Üretim/
  Kalite/Sevkiyat Sorumlusu, Gıda Mühendisi, Muhasebe, Personel,
  Görüntüleyici + platform rolleri (0015, 0073).
- ⚠️ **Yetki ekranda değil VERİTABANINDA.** 45 yazma kapısı (tetikleyici);
  ekranı atlayıp doğrudan istek göndermek **reddediliyor**. Kapısız yazma
  yüzeyi **0 tablo** (ölçüldü, sayılmadı).
- **Kiracı yalıtımı** · her tablo satır düzeyinde kendi işletmesine kilitli
  (RLS). Başka firmanın verisi sunucudan hiç gelmiyor.
- **Denetim kaydı** (0027, 0028, 0091) · değişmez; yetki tabloları dahil
  (kim kimi yönetici yaptı, kim şube açtı, kim hesabı pasife aldı).
- **Çok şube** · şube yönetimi, şube yetkilendirme, merkez şube işaretçisi.
- **Kullanıcı adıyla giriş** (0077) ve firma kodlu giriş (0078) —
  e-posta olmayan depo personeli için.
- **Geçici şifre** · bizim veritabanımıza hiç yazılmıyor, ilk girişte
  değiştirmek zorunlu (0076).

### 1.7 · İşletme yönetimi
- Kontrol paneli ve **Analiz** (işletme göstergeleri · 0065, 0071 ·
  yetki sunucuda).
- **Satış ve kârlılık** (0074, 0075 · fiyatsız satış zarar sayılmıyor).
- **Lisans ve deneme süresi** (0042–0046) · 3 ay deneme, uzatma talebi,
  yazma kilidi. ⚠️ Ödemeyen müşteri **otomatik kapatılmıyor**.
- **Veri ve yedekleme** ekranı, **değişiklik kaydı** ekranı,
  **modül mağazası**.
- **Başvuru akışı** (0032–0039) · dışarıdan işletme başvurusu, onay,
  kiracı ve ilk yöneticinin kurulması.

---

## 2 · DEMO ÖNCESİ (0.A) · NE TAM OLDU, NE YARIM, NE HİÇ OLMADI

### ✅ TAM OLDU
| | İş | Durum |
|---|---|---|
| **A6** | MIYOP-043 güvenlik borcu · göç 0091 | Uygulandı, prova 15/15. Yetki tabloları denetime girdi. |
| — | Göç 0087, 0088, 0089, 0090, 0091 | Hepsi canlıda. Kapısız yazma yüzeyi 0. |
| — | **Profilim** ekranı (A1'in 1/5'i) | Gerçek veriye bağlı. 066/068 dahil dört turda tam kapandı. |
| — | **MIYOP-067** · donmuş QR modülü public yoldan açılıyordu | Yol kapatıldı, public yol yüzeyi ölçülüp donduruldu. |

### 🔄 YARIM — başlandı, bitmedi
| | İş | Nerede kaldı |
|---|---|---|
| **A1** | Yarım ekranlar · **1/5** | Profilim bitti. **Firma Profili, Şubeler, Şube Yetkileri, İşletme Ayarları** hâlâ tarayıcıya yazıyor: "Kaydet" diyor, veri başka cihazda yok. Kararı ve yazma sözleşmesi **ölçüldü** (B1: yalnız işletme sahibi), ekran yazılmadı. |
| **A5** | Şahit numune | Tasarım kararı yazıldı. **İsmet'in 5 cevabı beklenmekte** — cevap gelmeden göç yazılmayacak. |
| **A4** | Sahte veri temizliği | **İş büyüdü.** Mesele 36 mock dosyası değil, **27 `createDemo*` üreticisi**. Dördü açık ekranda, biri portalda. Henüz hiçbiri silinmedi. |

### ⬜ HİÇ OLMADI
| | İş | Neden önemli |
|---|---|---|
| **A2** | **MIYOP-008** · şube seçimi sorgulara geçmiyor | B şubesi seçiliyken kayıt A'ya yazılabiliyor. **17 ekran** etkilenmiş; ayrıca bazı liste sorguları şube süzgeci hiç uygulamıyor. Demoda şube değiştirilirse görünür. |
| **A3** | **MIYOP-010 + 064** · ekranlar arası veri karışması | Etiket, Depo, Siparişler, Müşteriler, İş Emirleri, Sevkiyatlar. Yanlış ürünün alerjeni basılabilir — bu işin en pahalı hatası. |

### ⚠️ DEMO ÖNCESİ LİSTEDE OLMAYAN AMA AÇIK OLAN RİSKLER
- **MIYOP-058/059/060/061 · P0** · dört demo şube açık ekranda; portalda
  **uydurma bakım ve lisans duyurusu** (müşterinin gördüğü ilk ekran);
  boş firma bilgisi firma adıyla doldurularak gösteriliyor; Şube
  Yetkileri başka kiracının önbellek verisini gösterebiliyor.
- **SKT kapısı yok** (HEDEFLER 2.9) · `expires_on` kolonu var ama çıkışta
  zorunlu kılan kapı yok: **süresi geçmiş parti üretime girebilir ya da
  sevk edilebilir.** Karekoddan bağımsız, bugün yazılabilir.
- **Yedek yok** · Supabase Pro'ya ilk müşteri anlaşmasından sonra
  geçilecek; bu bilinçli kabul.

---

## 3 · DEMO ÖNCESİ KAPSAMDA OLMAYANLAR (bilinçli)
Fatura / e-Fatura / cari hesap / muhasebe aktarımı · personel-vardiya ·
raf adresi · makine bakımı · parti karekodu · MIYOP-049/050 (zamanlama,
istek sınırı) · MIYOP-003/004/005/006 · prestij başlığı.
Hepsi HEDEFLER'de duruyor; sırası **ilk müşteriden sonra**.
