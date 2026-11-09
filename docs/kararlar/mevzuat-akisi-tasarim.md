# Mevzuat akışı · tasarım kararı (09.11.2026)

Emrah'ın isteği:

> *"MİYOP'un hitap ettiği tüm müşterilere özel bir bilgi ekranı yapmak
> istiyorum birde EVREN360 panelinde. (MİYOP'un ilk oturum açma
> ekranında..) bir kutucuk gibi ekranın bir köşesinde kibarca olsun ve
> orada gıda yönetmeliklerinde yapılan son haberler, kanunlar,
> bildirimler vs kaynak gösterilerek akış halinde yer alsın."*

---

## ⚠️ BU EKRANIN BİR GEÇMİŞİ VAR — ÖNCE ONU OKU

Giriş vitrininde **daha önce bir duyuru bölümü vardı ve kaldırıldı**:
**MIYOP-059.** Kayıt yokken `createDemoAnnouncements()` uyduruyordu —
*"Planlı bakım bildirimi · Pazar gecesi kısa süreli bakım penceresi
uygulanacaktır"* ve *"Lisans yenileme hatırlatması"*. Tarihler her
açılışta yeniden hesaplanıyordu. Yani **her gün "iki gün sonra bakım"
diyen, bizim vermediğimiz bir taahhüt.**

Bugün onu koruyan iki şey var:
- `src/pages/giris-vitrini-dogru-soyler.arch.test.ts` — vitrin yalnız
  olanı söyler;
- 09.11'de o bölümün **ölü CSS'i de silindi** (MIYOP-107) ve sınıfın geri
  gelmediğini ölçen bir nöbet kondu.

**Yani aynı köşeye ikinci kez bir "duyuru kutusu" koyuyoruz.** Bu sefer
farkı tek cümleyle: **içindeki her satır gerçek, kaynaklı ve elle
yazılmış olacak; kayıt yoksa kutu HİÇ ÇİZİLMEYECEK.**

---

## Karar · içerik NEREDEN geliyor

**Kaynak: Emrah'ın kendisi, EVREN360 panelinden.** Her satırda kaynak
adı ve bağlantısı zorunlu (Resmî Gazete, Tarım ve Orman Bakanlığı, TGK
tebliği…).

### Neden otomatik çekmiyoruz (şimdilik)

Resmî Gazete'den ya da Bakanlık sitesinden otomatik çekmek şunları
ister: sunucu tarafında zamanlanmış bir iş (FREE planda yok), sayfa
yapısı değişince sessizce bozulan bir ayrıştırıcı, ve **yanlış
özetlenmiş bir mevzuat maddesinin müşteri ekranında durması** riski.

⚠️ Bir gıda işletmesine *"şu yönetmelik değişti"* demek hafif bir cümle
değil. Yanlışsa müşteri ona göre iş yapar. Bu yüzden ilk sürümde
**arada bir insan var**: Emrah okur, kendi cümlesiyle özetler, kaynağı
ekler, yayına alır.

Otomatik besleme ileride eklenebilir — ama o zaman da **taslak olarak**
düşmeli, Emrah onaylamadan yayına çıkmamalı. Bu yüzden tablo baştan
`TASLAK / YAYINDA / ARSIV` durumuyla kuruluyor: otomatik besleme
eklendiğinde tabloyu değiştirmek gerekmesin.

---

## Veri modeli · `public.regulation_news`

⚠️ **Kiracıya bağlı DEĞİL.** Bu MİYOP'un kendi içeriği, bir işletmenin
verisi değil — `callback_request` ve `platform_contact` ile aynı sınıf.
Dolayısıyla `tenant_id` kolonu YOK, kiracı yedeğine GİRMEZ.

| Kolon | Kural |
|---|---|
| `title` | zorunlu, 5–200 karakter |
| `summary` | isteğe bağlı, en çok 600 karakter |
| `source_name` | **zorunlu** (ör. "Resmî Gazete") |
| `source_url` | **zorunlu**, `https://` ile başlamak ZORUNDA |
| `published_on` | zorunlu, mevzuatın yayım tarihi |
| `status` | `TASLAK` / `YAYINDA` / `ARSIV`, varsayılan `TASLAK` |
| `created_at/by`, `updated_at/by` | **sunucu damgası** (0087 deseni) |

⚠️ **`source_url` neden `https://` zorunlu:** bu bağlantı herkese açık
bir sayfada tıklanabilir olarak çizilecek. `javascript:` ile başlayan bir
değer yazılabilseydi, panele erişen birinin ziyaretçinin tarayıcısında
kod çalıştırması mümkün olurdu. Kapı tarayıcıda değil **veritabanında**
— bu depodaki temel kural.

⚠️ **`published_on` istemciden gelir ve bu DOĞRU.** 0109/0112'de
`occurred_at` ve `taken_at` sunucuya damgalandı; bu farklı: o ikisi
**imza** (sistemde ne zaman oldu), bu ise **beyan** (mevzuat ne zaman
yayımlandı). Beyanı sunucunun bilmesi mümkün değil. Ama yine de
sınırlanıyor: 2000'den eski ve yarından sonraki tarih reddediliyor.

### Üç kapı

1. **Okuma · herkese açık** — `public.mevzuat_akisi_oku(p_limit)`.
   `security definer`, yalnız `YAYINDA` satırları, yalnız gösterilecek
   alanlar. `status`, `created_by`, `updated_by` **dışarı çıkmaz**.
   ⚠️ `p_limit` sunucuda tavanlanıyor; istemci "hepsini ver" diyemiyor.
2. **Yönetim · yalnız platform** — listeleme, yazma, silme. Gövdenin ilk
   satırı `app.platform_kapisi()` (0083).
3. **Tabloya doğrudan DML yetkisi HİÇ verilmiyor** (0033'ün dersi).
   RLS açık + zorunlu, politika YOK.

⚠️ **Yeni izin AÇILMIYOR.** Yönetim `platform.manage` ile korunuyor.
İzin kataloğuna ekleme yapmak bir mimari testi kırar (tuzak 52) ve
burada yeni bir izne gerek yok: bu ekran zaten yalnız platform sahibinin.

---

## Ekranda nasıl görünecek

- **Giriş vitrini:** sağ köşede sade bir kutu. Başlık + tarih + kaynak
  adı; tıklayınca kaynağa gider (`target="_blank" rel="noopener"`).
  En çok **5 satır**.
- ⚠️ **KAYIT YOKSA KUTU HİÇ ÇİZİLMEZ.** Boş bir "Mevzuat" başlığı,
  "burada bir şey olmalıydı" der. `platform_iletisim_oku`da aynı karar
  verildi: numara boşsa ekran hiçbir şey göstermiyor.
- ⚠️ **Yükleniyor diye iskelet gösterilmez.** Okuma düşerse kutu yoktur;
  giriş ekranı bir hata mesajı göstermez — oraya giren kişi giriş yapmaya
  gelmiştir.
- **EVREN360 paneli:** liste + ekle/düzenle/yayına al/arşivle/sil.

---

## Bu tasarımın ölçüleceği yerler

- `db/prova/prova-0113.sql` — üç kapı, `anon` ne okuyabiliyor ne
  yazabiliyor; `javascript:` bağlantı reddediliyor; `TASLAK` satır
  herkese açık okumada GÖRÜNMÜYOR.
- `db/prova/prova-0113-ters.sql` — kapı kaldırılınca gerçekten sızıyor.
- Vitrin mimari testi: kayıt yokken bölüm çizilmiyor, ve bileşen kendi
  verisini **defterden** okuyor (uydurma yok).

---

## Açık kalan (Emrah'a sorulacak, cevap beklemiyor)

- Kutu giriş ekranının neresinde dursun — kahraman bölümün sağında mı,
  en altta "Sizi Arayalım"ın yanında mı?
- Satır sayısı 5 yeterli mi?
- Müşteri giriş yaptıktan SONRA da görsün mü (kontrol panelinde),
  yoksa yalnız giriş ekranında mı kalsın?
