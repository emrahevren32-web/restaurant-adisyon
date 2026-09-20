# Edge Function kurulumu — `isletme-hesabi-ac`

## Bu ne, neden var

Onaylanan bir işletmeye **giriş hesabı** açar ve davet e-postası gönderir.

Supabase Auth'ta kullanıcı yaratmak `service_role` anahtarı ister. O anahtar
**tarayıcıya asla inmez** — inseydi, sayfanın kaynağını görebilen herkes
veritabanının tamamına, yani bütün müşterilerin verisine sahip olurdu. Bu
yüzden iş Supabase'in kendi sunucusunda çalışan küçük bir programa taşındı.

Anahtarı **hiçbir yere yazmanız gerekmiyor.** Supabase onu Edge Function'lara
kendisi verir (`SUPABASE_SERVICE_ROLE_KEY`). Kimseye, Claude'a da, bir anahtar
göndermeyin.

## Kurulum — panelden, komut satırı gerekmez

1. Supabase panelinde soldan **Edge Functions**.
2. **Deploy a new function** → **Via Editor** (ya da "Create function").
3. İsim kutusuna tam olarak şunu yazın:

   ```
   isletme-hesabi-ac
   ```

   ⚠️ İsim birebir bu olmalı. Ekran fonksiyonu bu adla çağırıyor.

4. Açılan kod alanındaki örnek kodu **tamamen silin**, yerine
   `supabase/functions/isletme-hesabi-ac/index.ts` dosyasının içeriğini
   yapıştırın.
5. **Deploy** deyin. Bir dakika sürebilir.

## Supabase'de iki ayar (bir kez)

Davet e-postasındaki bağlantı, müşteriyi bizim uygulamamıza geri gönderir.
Supabase **yalnızca izin verilen adreslere** geri gönderir; liste boşsa
bağlantı çalışmaz.

Panelde **Authentication → URL Configuration**:

| Alan | Değer |
|---|---|
| Site URL | `http://localhost:5173` |
| Redirect URLs | `http://localhost:5173/**` |

A5'te (Hetzner + alan adı) bu iki satır gerçek adresle değişecek.

## Doğrulama

Panelde fonksiyonun durumu **Active** görünmeli.

### Uçtan uca prova — kendi e-postanızla

Davet gerçek bir e-posta adresine gider, o yüzden provayı **kendi
adresinizle** yapın. Adım adım:

1. **Tarayıcıyı gizli pencerede aç** (Ctrl+Shift+N). Sebebi: kendi
   yönetici oturumunuz açıkken davete tıklarsanız iki oturum çakışır.
2. Gizli pencerede `http://localhost:5173/basvuru` adresine gidin ve formu
   **kendi e-posta adresinizle** doldurun. (Aynı adresle bekleyen bir
   başvuru varsa sistem ikinciyi kabul etmez; farklı bir adres kullanın,
   ör. Gmail'de `adiniz+prova1@gmail.com` gibi.)
3. Normal pencerede (yönetici oturumunuz) **Onay Bekleyen İşletmeler** →
   yeni başvuru → **İncelemeye Al** → **Onayla ve işletmeyi aç**.
4. Açılan kartta **"Giriş hesabı aç ve davet gönder"**. Kart, kullanıcı
   adını ve davetin gittiği adresi yazmalı.
5. **E-postanızı kontrol edin.** Konu İngilizce olacak (Supabase'in
   şablonu), içinde bir bağlantı var. Gelen kutusunda yoksa **Spam**
   klasörüne bakın.
6. Bağlantıya **gizli pencerede** tıklayın. "Hoş geldiniz — kendinize bir
   şifre belirleyin" ekranı açılmalı.
7. Şifre belirleyin, sonra o şifreyle giriş yapın. İçeride kendi
   işletmenizi görmelisiniz — MİYOP'un platform menülerini DEĞİL.

7. adım aynı zamanda izolasyonun ilk kanıtı: davetli kullanıcı platform
   yöneticisi değildir, "EVREN360 Yönetici Paneli" menüsünü görmemelidir.

## Dürüst sınırlar

- **E-posta.** Davet, Supabase'in yerleşik e-posta servisinden gider. Ücretsiz
  planda bu servis **saatte birkaç e-postayla sınırlıdır** ve gönderen adres
  bize ait değildir. Prova için yeter; gerçek müşterilere toplu davet için
  yetmez. Kendi SMTP'mize geçmek **A5**'in (Hetzner) işi.
- **Şifre.** İlk şifreyi **müşteri kendisi belirler**, davet bağlantısından.
  MİYOP hiçbir zaman şifre görmez, üretmez, göstermez. Ekranda geçici şifre
  gösteren eski kart bu yüzden kaldırıldı — yazdığı şifre çalışmıyordu.
- **Yarım kalma.** Davet açılıp hesap bağlanamazsa fonksiyon bunu **açıkça
  söyler** ve ne yapmanız gerektiğini yazar (panelde bekleyen daveti silmek).
  Sessizce temizlemeye çalışmıyoruz: "sildim" deyip silememek daha kötüdür.

## Kod değişirse

`supabase/functions/isletme-hesabi-ac/index.ts` güncellenirse, yukarıdaki 4.
ve 5. adımları tekrarlayın: panelde fonksiyonu açın, kodu değiştirin, Deploy.
