# ADR-003 · Dikey dilim ve her dilimde test

- **Durum:** Kabul edildi (Claude · GPT · Emrah, 2026-08-23)
- **Yerini aldığı yaklaşım:** katman katman migrasyon (`storage.ts` → PostgreSQL → Auth → zincir)

---

## Bağlam

İki yaklaşım tartışıldı.

**Katman katman:** Önce `storage.ts` domain sınırlarına ayrıştırılır, sonra PostgreSQL
kurulur, sonra auth yazılır, sonra stok motoru, sonra zincir, en sonda testler.

**Dikey dilim:** En dar uçtan uca yol seçilir ve yeni yığının **tamamından** geçirilir
(şema → API → yetki → arayüz → test). Yayına alınır. Sonra bir sonraki dilime geçilir.

---

## Karar

**Dikey dilim.** Ve **test bir faz değildir** — her dilimin tamamlanma koşuludur.

---

## Gerekçe

Katman katman yaklaşımın iki somut sakıncası var:

1. **Birazdan yerine koyacağın kodu refactor edersin.** `storage.ts`'i (8021 satır,
   60 koleksiyon) domain sınırlarına ayırmak haftalar alır ve o kodun büyük kısmı
   PostgreSQL geldiğinde silinecektir.
2. **Mimarinin yanlış olduğunu geç öğrenirsin.** Auth, tenant izolasyonu ve transaction
   bütünlüğü tasarımındaki bir hata, ancak gerçek bir operasyon zincirini uçtan uca
   çalıştırdığında ortaya çıkar. Katman katman gidersen bu 4–5. ayda olur; dikey dilimde
   3. haftada.

Ek olarak: dikey dilimde uygulama **hiç durmaz**. Sistem aylarca ameliyat masasında
kalmaz; her dilim sonunda çalışan bir ürün vardır.

### Test neden sona bırakılamaz

Sona konan test eforu her projede kesilir — takvim sıkıştığında feda edilen ilk şey odur.
Dahası: testsiz yazılan bir stok motorunun doğru olduğunu, test yazıldığında değil,
müşteri yanlış rakam gördüğünde öğrenirsin.

**"Çalışıyor" demek build geçiyor demek değildir.** Bir dilim, iş kuralları otomatik
olarak doğrulandığında biter.

---

## Uygulama kuralları

1. Her dilim ADR'sinde bir **"bitti tanımı"** vardır ve bu tanım gözlemlenebilir bir
   davranıştır — "kod yazıldı" değil, "şu yapıldığında şu olur".
2. Bir dilim, testleri geçmeden ✅ işaretlenmez. Yarım dilim yoktur.
3. Dilimler arasında geriye dönülmez: Dilim 2 açıkken Dilim 1'in şeması değiştirilecekse
   yeni bir ADR açılır.
4. Bir dilim tıkanırsa **kapsamı daraltılır**, süresi uzatılmaz.

---

## Sonuçlar

**Kazanç:** Sürekli çalışan ürün · erken mimari geri bildirim · Dilim 2'de başlayabilen pilot ·
her adımda güvenlik ağı.

**Bedel:** Bazı işler iki kez dokunulur (önce dilim için minimum, sonra genelleştirme).
Bu bilinçli bir takas — erken doğrulama, tekrar dokunmanın maliyetinden değerli.

---

## Reddedilen alternatifler

| Alternatif | Neden reddedildi |
|-----------|------------------|
| Katman katman (big-bang) | Yukarıdaki iki sakınca. GPT önerdi, tartışma sonucu geri çekildi. |
| Önce tüm testleri yaz (TDD-first, tüm domain) | Henüz var olmayan bir mimariye test yazmak. |
| Testleri Dilim 7'de topluca yaz | Kesilmeye en açık plan. Her projede kesilir. |
