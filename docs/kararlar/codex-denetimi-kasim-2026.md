# Codex genel tarama brifi · Kasım 2026 (3. tur)

Emrah'ın isteği (07.11.2026): *"codexe de tekrardan genel tarama
yaptır."*

⚠️ **Sıra kuralı geçerli:** Codex denetler, Claude düzeltir. Aynı anda
yazılmaz (`claude/codex-ile-calisma-duzeni.md`). Bu brif Codex'e
yapıştırılır; Codex **hiçbir dosyayı değiştirmez.**

---

## Depo bu turda nerede

| | |
|---|---|
| Depo | `C:\Users\90544\Documents\restaurant-adisyon` |
| Dal | `production-foundation` |
| Canlı | `https://miyop.emrahevren.com` |
| Göç sayısı | **107** (`db/migrations/0001…0106` + `0000`) |
| Prova sayısı | **54** (`db/prova/prova-*.sql`) |
| Sınama sayısı | **1874** (vitest) |
| Son büyük iş | Geri arama talebi formu (göç 0106), giriş vitrininin temadan ayrılması, sürüm defteri üreticisi |

**Son turda ölçülen ve ONARILAN şey (Codex bunu tekrar bulmasın diye
yazılıyor):** 54 provanın 13'ü bayatlamıştı; hepsi onarıldı, son ölçüm
**54 yeşil / 0 kırmızı**. Ayrıntı: `docs/kararlar/kararlar-ve-tuzaklar.md`
→ tuzak 190.

---

## ÖNCE OKU (bunlar bilinçli kararlar, "hata" sanma)

```
docs/kararlar/kararlar-ve-tuzaklar.md     ← 190 tuzak + 134 maddelik kontrol listesi
docs/HEDEFLER.md                          ← açık/kapalı her madde, gerekçesiyle
claude/nerede-kaldik.md
claude/yetki-cercevesi.md
claude/kaldirilan-moduller.md             ← bilerek SİLİNEN modüller
db/migrations/README.md
db/prova/README.md
```

⚠️ **Her göç dosyasının BAŞLIK YORUMU okunmadan o göç hakkında bulgu
yazılmaz.** Kararın gerekçesi orada. "Tuhaf" görünen şeylerin çoğunun
yazılı sebebi var.

---

## KURALLAR

- **Salt okunur denetle. Dosya DEĞİŞTİRME.**
- Her bulguda: **dosya + satır**, somut kanıt, etki, kabul kriteri.
- **Mock veri asla olmayacak.** Uydurma/örnek veri bulursan **P0**.
- **Müşterinin görmemesi gereken hiçbir şey müşteri ekranında olmasın.**
- Tarayıcıdaki izin kontrolü **güvenlik sınırı değildir**; sınır
  veritabanındadır (üç kapı: menü kaydı, rota kapısı, DB kapısı).
- Satış dilinde **"yapay zeka" denmiyor**; teknik başlık **kural motoru**.
- Bir şey eksik görünüyorsa önce `HEDEFLER.md`e bak: **bilerek açık
  bırakılmış** ve numarası olan bir madde olabilir.

---

## BU TURDA BAK

### 1 · P0 · Zil çalışmıyor — kod yeşil, ürün çalışmıyor
`HEDEFLER.md` 4.11.7 🔴. Canlıda zilde **rozet yok**, aynı anda panelde
"3 talep bekliyor" yazıyor. 1874 sınama yeşil. Zil daha önce 6 rozet
gösteriyordu, **şimdi 0** — yani yalnız yeni kaynak değil, **zilin
tamamı** susmuş olabilir.

Bakılacak yer:
```
src/components/AppShell.tsx                       ← üç bildirim kaynağı burada birleşiyor
src/notifications/evren360-notification.service.ts
src/notifications/geri-arama-bildirimleri.ts
src/notifications/basvuru-bildirimleri.ts
src/App.tsx                                       ← zil tıklaması yönlendirmesi
```
Sorular: üç kaynak gerçekten çağrılıyor mu? Biri `throw` edip diğerlerini
de düşürüyor olabilir mi (hepsi `catch` içinde mi)? Rozet sayısı hangi
alandan okunuyor ve o alan dolu mu? Okundu bilgisi (`localStorage`)
hepsini "okunmuş" sayıyor olabilir mi?

### 2 · Lisans kataloğu hâlâ eski adisyon ürünü
Bilinen borç. **8 sayfa dosyası** bu katalogdan besleniyor. Soru: bugün
müşteriye gösterilen bir ekranda eski ürünün adı/modülü **görünüyor mu**?
Görünüyorsa P0, görünmüyorsa P2 borç.

### 3 · Üç kapının üçü de duruyor mu
Son turlarda eklenen ekranlar: **geri arama talepleri**
(`evren360-callback-requests`), **şahit numune**. Her biri için:
menü kaydı izni = rota kapısı izni = DB kapısı izni mi? Üçü ayrışmışsa
bulgu.

### 4 · `anon` yüzeyi
0106 ile iki yeni **public** fonksiyon açıldı
(`geri_arama_gonder`, `platform_iletisim_oku`). Soru: `anon`un
çağırabildiği fonksiyonların **tam listesi** nedir ve her birinin orada
olmasının yazılı bir sebebi var mı? Tabloya doğrudan yetki verilmiş bir
yer kaldı mı?

### 5 · Ekranla veritabanı aynı şeyi mi söylüyor
Bir kural hem ekranda hem veritabanında varsa **ikisi aynı mı**? Farklı
olan her çift bulgudur (ekran gevşekse kullanıcı reddedilir ve sebebini
anlamaz; veritabanı gevşekse ekran atlanabilir).

### 6 · Ölü kod ve ölü CSS
`@media 980px` bloğunun ölü olduğu biliniyor. Başka ölü yüzey var mı?
⚠️ "Kimse kullanmıyor" cümlesi **tip denetiminden önce kurulmaz**
(kontrol listesi 69).

### 7 · Yeni kiracı gerçekten boş mu açılıyor
Yeni bir işletme açıldığında ona ait ekranlarda **başka kiracının verisi
ya da örnek veri** görünüyor mu? (Emrah'ın A5 maddesi bunun elle
sınaması; Codex kod tarafından baksın.)

---

## RAPOR BİÇİMİ

Her bulgu için:

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
