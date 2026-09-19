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

## Doğrulama

Panelde fonksiyonun durumu **Active** görünmeli.

Sonra ekranda: onaylanmış bir işletmede **"Giriş hesabı aç ve davet gönder"**
düğmesine basın. Başarılıysa kart kullanıcı adını ve davetin gittiği adresi
yazar.

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
