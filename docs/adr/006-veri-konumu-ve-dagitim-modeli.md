# ADR-006 — Veri konumu ve dağıtım modeli

**Durum:** Kabul edildi
**Tarih:** 2026-09-02
**Karar veren:** Emrah (ürün sahibi)
**İlgili:** ADR-004 (kiracı yalıtımı), Yol haritası A5 (yayın), "Karar bekleyen üç konu"

---

## Karar

MİYOP **Almanya'da (Hetzner) barındırılan bulut sürümüyle** konumlanır.
Aynı ürün, **tek bir müşteri için kendi sunucusunda (on-premise) çalıştırılabilecek
şekilde hazır tutulur.**

Emrah'ın ifadesiyle: *"Şuan pozisyonumuzu Almanya'ya göre alalım. Gerekirse
on-premise çalışabilecek şekilde hazır olalım."*

## Bağlam

İki soru aynı anda soruldu ve cevapları birbirine bağlı:

1. **Veri nerede duracak?** Hetzner sunucuları Almanya ve Finlandiya'da. Türk
   müşterinin verisi yurt dışında tutulacak.
2. **Müşteri "kiralamam, satın alırım, kendi sunucumda çalışsın" derse?**
   Endüstriyel mutfak müşterisi kurumsallaştıkça bunu isteme ihtimali yüksek.

İkinci soru birincisini kolaylaştırıyor: veri konumu artık **tek ve nihai bir
seçim değil, müşteri başına bir kurulum kararı.** Bulutta Almanya, isteyen
müşteride kendi binası.

## Gerekçe

**Neden Almanya (bulut) varsayılan:**
- KVKK yurt dışına aktarımı yasaklamaz; **açık rıza ve aydınlatma** ile
  yapılabilir. Yükümlülük teknik değil, metinsel: aydınlatma metninde verinin
  nerede tutulduğu yazılı olmalı.
- Türkiye'de eşdeğer sunucu daha pahalı ve kurulumu yavaş. Demo hedefi için
  gecikme, kazanç sağlamayan bir maliyet.

**Neden on-premise kapıyı açık tutuyoruz:**
- Kapatmak, satın alma isteyen müşteriyi baştan kaybetmek demek.
- Ve maliyeti bugün çok düşük: yığın zaten taşınabilir. Bunu **sonradan**
  eklemek çok daha pahalı olurdu.

## Bunun bugünden getirdiği kısıt

On-premise hazır olmak bir söz değil, bir **mimari kısıt**. Bugün ihlal etmesi
kolay, sonradan geri alması pahalı:

| Kısıt | Sebep |
|---|---|
| Veri katmanı **düz PostgreSQL** kalır | Şema, RLS ve `app.*` fonksiyonları herhangi bir Postgres'te çalışır. Bugün böyle. |
| Sağlayıcıya özel veri özelliği kullanılmaz | Supabase'in Postgres olmayan hiçbir ürününe (Storage, Realtime, Vector) bağımlı olunmaz. |
| İş kuralları veritabanında ya da uygulamada durur | Barındırma katmanında değil. Append-only tetikleyici, negatif bakiye politikası ve I1–I12 böyle yazıldı. |
| Ekranlar arayüze konuşur, sağlayıcıya değil | `StockRepository`, `StokKatalogu`, `TedarikciDeposu` — hepsi port. ADR-003'ün dikey dilimi bunu zaten zorunlu kılıyor. |

## Bilinen tek yapışkan nokta

**Kimlik doğrulama.** Supabase Auth, Postgres'in bir parçası değil; ayrı bir
servis. On-premise kurulumda ya self-hosted Supabase ile gelir ya da
değiştirilmesi gerekir.

Bugün için taşıyabilir durumda: `app_user.auth_user_id` bir uuid; kimlik
sağlayıcısı değişirse yalnızca bu bağ yeniden kurulur, tüm iş verisi yerinde
kalır. Yine de bu, on-premise kurulumun **en çok iş çıkaracak tek parçası**
olacaktır ve öyle planlanmalıdır.

## Sonuçları

- **A5 (yayın)** Hetzner üzerinden ilerler; ayrı bir Türkiye araştırması yapılmaz.
- **Aydınlatma metni yazılmalı**: verinin Almanya'da tutulduğu açıkça belirtilir.
  Bu bir A5 maddesidir ve demoda sorulacaktır.
- **Fiyat modeli** (henüz açık olan diğer karar) artık iki satır içerecek:
  aylık bulut kiralaması ve tek seferlik yerinde kurulum. İkincisinin fiyatı
  kurulum + bakım emeğini kapsamalı.
- On-premise kurulum **bugün yapılmıyor**. Yalnızca yolu kapatmıyoruz.
