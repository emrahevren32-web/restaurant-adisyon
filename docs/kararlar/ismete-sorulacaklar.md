# İsmet'e sorulacaklar · tek liste

Emrah, 20.10.2026: *"ben sana İsmet'leyim dediğimde sen hepsini tek tek
getir benim önüme."*

⚠️ **Bu dosyanın kuralı:** bir ekran ya da göç yazarken "bunu bilmiyorum,
uydurursam mış gibi olur" dediğim her şey buraya yazılır. Emrah "İsmet'leyim"
dediğinde liste olduğu gibi önüne gelir. Cevap gelince madde **silinmez**,
cevabıyla birlikte işaretlenir — kararın nereden geldiği kaybolmasın.

**Durum:** ⬜ cevap bekliyor · ✅ cevaplandı

---

## A · ŞAHİT NUMUNE (demo öncesi · HEDEFLER A5)

Ayrıntılı tasarım: `docs/kararlar/sahit-numune.md`. Emrah 20.10'da süreyi
ve saklama koşulunu anlattı; aşağıdakiler kalan beş soru.

- ⬜ **A1 · Numune nerede saklanıyor?** Ayrı bir dolap mı, aynı depoda
  ayrılmış bir raf mı? (Raf adresi hedefiyle kesişiyor — 8.2.2.)
- ⬜ **A2 · Numuneyi kim alıyor?** Üretim mi, kalite mi? Buna göre izin
  belirlenecek: `quality.record.manage` mı, `production.write` mı?
- ⬜ **A3 · Her sevkiyattan mı numune alınıyor, her üretim partisinden mi?**
  Bu, kaydın neye bağlanacağını belirliyor (sevkiyat mı, lot mu).
- ⬜ **A4 · Süre dolunca imhayı kim onaylıyor?** Kayıt tutuluyor mu,
  tutuluyorsa nasıl (tutanak, imza)?
- ⬜ **A5 · Müşteri itirazı gelince numune açılıyor mu?** Açılan numunenin
  kendisi ayrı bir kayda giriyor mu (kim açtı, ne bulundu)?

## B · YARIM EKRANLAR (demo öncesi · HEDEFLER A1)

- ✅ **B1 · CEVAPLANDI** (Emrah, 21.10 · aşağıda "Cevaplananlar"). İsmet'e
  yine sorulabilir ama iş bekletilmiyor.
- ⬜ **B2 · Şube Yetkileri ekranında** bir kullanıcının birden çok şubeye
  erişimi normal mi, istisna mı? Mutfakta kaç kişi iki şubede birden
  çalışıyor?
- ⬜ **B3 · İşletme Ayarları'nda** bugün elle takip edilen hangi ayarlar
  var? (çalışma saatleri, sipariş kesim saati, varsayılan teslim süresi…)

## C · SEVKİYAT VE TESLİMAT

- ⬜ **C1 · Aynı müşterinin birden çok teslim noktası varsa** her nokta
  ayrı mı sipariş veriyor, yoksa tek kişi hepsini mi yönetiyor?
  (`portal-tasarimi.md` 4. soru — portalın davranışını belirliyor.)
- ⬜ **C2 · Araç ve şoför** her sevkiyatta yazılıyor mu, yoksa sabit bir
  araç/şoför mü var? İrsaliyede plaka zorunlu.

## D · ETİKET VE BASKI (demo öncesi · HEDEFLER 6.16)

- ⬜ **D1 · Bugün hangi yazıcı kullanılıyor?** Termal mi, lazer mi, marka
  ve model? Etiket hiç gerçek yazıcıda denenmedi.
- ⬜ **D2 · Etiket boyutu** 58 mm mi, 100×150 mm mi, ikisi de mi?
- ⬜ **D3 · Etikette bugün elle yazılan bir şey var mı?** (parti no,
  tarih…) Varsa o alan bizde de olmalı.

## E · ÖLÇÜM VE DAYANIKLILIK (demo sonrası · HEDEFLER 6.13–6.15)

- ⬜ **E1 · Günde kaç kalem hareket oluyor?** (mal kabul satırı, üretim,
  sevk) Hacim ölçümünü buna göre kuracağım; tahminle ölçüm yapılmaz.
- ⬜ **E2 · Aynı anda kaç kişi sisteme giriyor?** Eşzamanlılık sınaması
  için gerçek sayı lazım.
- ⬜ **E3 · Depoda tablet/telefon kullanılıyor mu, kullanılacak mı?**
  Mal kabul ve sayım elde yapılıyorsa ekranlar ona göre düzenlenecek.

---

## Cevaplananlar

- ✅ **B1 · Firma Profili'ni kim değiştirebilir** (Emrah, 21.10) —
  **yalnız işletme sahibi.** Müdür değiştiremez.
  ⚠️ Bu karar aslında **zaten veritabanında yazılıydı:** göç `0015`
  `isletme_muduru` rolüne `company.manage` iznini **vermiyor** ve gerekçesi
  göçün içinde duruyor: *"müdür işi yürütür, işletmenin kimliğini ve kimin
  neye erişeceğini değiştirmez. O yetki sahiptedir."* Göç `0085` de
  `company` tablosuna `app.izin_gerek('company.manage')` kapısını koymuş.
  Yani Emrah'ın sezgisi ile haftalar önce yazılmış kural aynı yere çıktı;
  benim işim bunu ekranda **bozmamak.**
  Vergi numarası için ayrı bir izin **açılmadı:** firma kimliği bir bütün
  olarak `company.manage` ile korunuyor. Müdürün telefon/adres gibi
  alanları düzeltmesi istenirse o **yeni bir izin** olur, yeni göç ister;
  bugün gerek yok. → İsmet'e: *"müdürün firma bilgisinde düzeltmesi gereken
  bir alan oluyor mu?"*

- ✅ **Numunenin saklama süresi ve koşulu** (Emrah, 20.10) — kapalı üründe
  SKT'ye kadar, açılmışta açık kalma süresi kadar; saklama koşulu
  müşteriye bildirilenin birebir aynısı. → `sahit-numune.md`
- ✅ **Şoklama yapılıyor mu** (ölçüm, 20.10) — evet, CCP-6 olarak HACCP
  içinde. Mock modül aynı konunun sahte kopyasıydı. → HEDEFLER 3.9
