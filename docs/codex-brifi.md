# Codex denetim brifi · MİYOP

> Bu dosya Codex'e yapıştırılmak üzere yazıldı. Her denetim turunda
> güncellenir. Son güncelleme: 20.10.2026, **MIYOP-043'ün 1. adımından**
> sonra. Dal: `production-foundation`

---

Merhaba. MİYOP adlı bir endüstriyel mutfak ERP'sini denetleyeceksin.

**Depo:** `C:\Users\90544\Documents\restaurant-adisyon`

## 1 · ÖNCE BUNLARI OKU

Bu projede alışılmadık görünen çoğu kararın yazılı bir gerekçesi vardır —
ve o gerekçe genellikle kararın alındığı dosyanın başlık yorumundadır.
Dışarıdan gelen biri bu gerekçeyi görmeden "hata" diyebilir. Bir şeyi
hata saymadan önce gerekçesini ara. Okuma sırası:

1. `docs/kararlar/kararlar-ve-tuzaklar.md` — **en önemlisi.** Değişmez
   kurallar, veri tasarımı kararları ve numaralı tuzak listesi (38–**97**).
   Her tuzak gerçekten düşülmüş bir hatadır.
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

## 4 · BU TURDA BAKILACAK

**Önceki turun sonucu: haklıydın, kapıyı gereğinden fazla açmıştım.**
0090 dokuz kapıyı 0089 öncesine döndürdü; muaf yüzey 11 rutinden 6'ya
indi. MIYOP-044, 046 ve 048 de kapandı — her biri senin tarif ettiğin
şekilde. MIYOP-045'i de doğru kapsamla yeniden kurdum: 0089'un taraması
hem çok genişti (`%degismez%` tabloları iş izni kapısı değil) hem çok
dardı (`trigger` dönenleri ve `service_role`u eliyordu).

Bu turda tek bir dosya diğerlerinden önemli: **yeni yazdığım giriş
fonksiyonu.** Henüz CANLIYA DAĞITILMADI — yani kaynak hâlâ değişebilir ve
senin bulduğun her şey ucuza düzelir. Dağıtımdan sonra pahalanır.

### 4.1 · `giris-yap` Edge Function · bu turun ana işi

`supabase/functions/giris-yap/index.ts` (yeni) ·
`src/auth/sunucu-girisi.ts` (yeni) · `src/storage.ts` (`authenticateUser`)

**Ne yaptım:** MIYOP-043 için adres çözümünü ve parola doğrulamasını
tarayıcıdan alıp sunucuya taşıdım. Tarayıcı artık giriş adını, işletme
kodunu ve parolayı fonksiyona gönderiyor; adres orada `service_role` ile
çözülüyor, parola orada doğrulanıyor, dışarı yalnız oturum ya da **tek
genel hata** çıkıyor.

**Senden istediğim — saldırgan gözüyle, satır satır:**

1. **Cevaplar gerçekten tekleşmiş mi?** Olmayan kullanıcı ile yanlış
   parola; HTTP durumu, gövde, başlıklar ve **cevap süresi** aynı mı?
   Özellikle: girdi gerçek e-posta biçimindeyse RPC'ye hiç gitmiyorum,
   değilse gidiyorum. Bu **zamanlama farkı** bir enumerasyon kanalı mı?
2. **Boş parola / boş giriş** dalı adres çözümünden ÖNCE dönüyor. Bu da
   ayırt edilebilir bir fark mı?
3. **CORS `*`** ve `verify_jwt` · fonksiyon `anon` anahtarıyla
   çağrılıyor. Kötüye kullanım yüzeyi ne? Oran sınırı yok — kaba kuvvet
   denemesi için bu fonksiyon, Supabase'in kendi giriş uç noktasından
   daha mı kolay hedef?
4. **Parola sızıntısı** · `sifre` değişkeni hiçbir günlüğe, cevaba ya da
   hata nesnesine giriyor mu? `console.error` çağrılarının gövdesini tek
   tek bak.
5. **`setSession` ile kurulan oturum** · tarayıcıya `access_token` ve
   `refresh_token` dönüyorum. Supabase'in kendi `signInWithPassword`
   akışına göre eksik ya da fazla bir şey var mı?
6. **Yedek yol** · `src/storage.ts` içinde `GEÇİCİ YEDEK YOL` diye
   işaretli dal duruyor (fonksiyon dağıtılmadan eskisini kaldırmak
   herkesi kapıda bırakırdı). `reddedildi` ile `ulasilamadi` ayrımı
   doğru kurulmuş mu? **Gerçek bir reddi "ulaşılamadı" sanıp eski
   sızdıran yola düşürdüğüm bir durum var mı?** Varsa 043 hiç kapanmaz.

### 4.2 · 0091 ne kıracak · önceden bul

Sıradaki göç `giris_adresi_bul`un `anon` hakkını alacak VE yedek yolu
silecek. **Senden, uygulamadan ÖNCE bunu kırabilecek her şeyi bulmanı
istiyorum.** Özellikle:

- `giris_adresi_bul`u çağıran başka bir yer var mı? (ekran, servis, test,
  Edge Function, prova)
- `anon` hakkı alınınca hangi test/prova kırılır? Önceki turda dört
  doğrulama saymıştın (`giris-adresi.test.ts`, `authenticateUser.test.ts`,
  `prova-0077`, `prova-0078`) — liste tam mı?
- Vardiya kilidi ve oturum yenileme bu değişiklikten etkilenir mi?
- `public.personel_giris_adresi` ayrı bir RPC; onun ACL'si ne durumda?

### 4.3 · Giriş testleri artık gerçek yolu sınıyor mu

`src/auth/authenticateUser.test.ts`

⚠️ Kendi bulduğum bir kusur: mock supabase'de `functions` yoktu, `invoke`
çağrısı `TypeError` atıyor, yakalanıp "ulaşılamadı" sayılıyor ve **14
testin hepsi yedek yola düşüyordu.** Yani testler dağıtımdan sonra
çalışacak yolu hiç sınamıyordu — yeşildi ama yanlış sebeple.

Mock'ları ekledim ve beş test yazdım. **Sor:** bu beş test gerçekten
sızıntının kapandığını mı kanıtlıyor, yoksa yalnız çağrıların yapıldığını
mı? Eksik olan kabul kriteri ne?

### 4.4 · Hâlâ açık, tekrar raporlamana gerek yok

**MIYOP-003** · **MIYOP-004** · **MIYOP-005** · **MIYOP-006** ·
**MIYOP-017** · **MIYOP-018** · **MIYOP-040** · **MIYOP-045** (kapsam
düzeltildi, kapanmadı) · **MIYOP-047** (0033/0034/0038 imza dirilmesi) ·
bayat prova listesi (11 dosya) · 13 kör prova.

Sıradaki büyük işim **B başlığı**: `docs/BITMIS-URUN-EKSIKLERI.md`
içindeki "yarım işler" — altı ekranın tarayıcıya yazması (3.1–3.5), şube
seçiminin sorgulara geçmemesi (MIYOP-008), etiket ekranında veri
karışması (MIYOP-010). Bunlarla ilgili yeni bir ayrıntın varsa öne al.

## 5 · ÇIKTI BİÇİMİ

```
## Özet
<üç cümle: durum ne, en kritik ne, bir önceki denetime göre ne değişti>

## 4.1 · giris-yap denetimi (EN ÖNEMLİ BÖLÜM)
<altı sorunun her biri için: bulgu VAR/YOK + satır + somut senaryo>

## 4.2 · 0091 neyi kırar
<her çağıran/test/prova için: kırılır mı, nasıl, önce ne yapılmalı>

## 4.3 · Giriş testleri yeterli mi
<eksik kabul kriterleri>

## Yeni bulgular
<MIYOP-031'den devam numaralandır>

## Kapandığını doğruladığım eski bulgular
<numara + kanıt>
```
