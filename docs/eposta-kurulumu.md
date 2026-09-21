# E-posta kurulumu — davet ve şifre bağlantıları

## Sorun tek cümleyle

Supabase'in **yerleşik** e-posta servisi ücretsiz planda yalnızca
**proje üyelerinin** adreslerine gönderir. Başka bir adrese "gönderildi"
der, mesaj hiç yola çıkmaz. Loglarda hata görünmemesinin sebebi bu:
Supabase kendi açısından hata yapmıyor, göndermeyi hiç denemiyor.

Bu yüzden `emrah-evren@hotmail.com` gibi bir müşteri adresine davet
gitmiyor.

## MİYOP'ta değiştirilecek bir şey YOK

Sık karışan nokta: `emrahevren32@gmail.com` adresi MİYOP'un veritabanında
**hiçbir yerde yazılı değil.** Yönetici hesabı Supabase Auth kimliğine
(`auth_user_id`, bir UUID) bağlıdır; e-posta o kimliğin Supabase
tarafındaki özelliğidir.

Sonuç: Supabase panelinden adresi değiştirmek MİYOP'u **bozmaz** — UUID
aynı kalır, bütün bağlantılar yerinde durur. Ama aşağıdaki tuzağa dikkat.

⚠️ **`emrah-evren@hotmail.com` artık serbest bir adres değil.** O adres
Evrenler Gıda'nın **işletme sahibi** hesabına bağlandı. Yönetici hesabına
taşınırsa o işletme sahipsiz kalır ve müşteri giriş yapamaz. Taşımak
gerekiyorsa önce `scripts/tani/hesap-geri-al.sql` ile o hesabı geri alın.

## Üç yol

### 1. Hızlı prova — adresi proje üyesi yap

Supabase panelinde **Organization settings → Team → Invite member** ile
`emrah-evren@hotmail.com`'u davet edin. Üye olduktan sonra yerleşik servis
o adrese de gönderir.

- ✅ Beş dakika, bedava
- ❌ Yalnız prova için. Her müşteriyi Supabase organizasyonuna üye
  yapamayız — o adresler projeye erişim kazanır.

### 2. Elden iletme — zaten hazır

Onay kartındaki **"E-posta gelmediyse: bağlantıyı elden iletin"**
bölümünü açın, bağlantıyı kopyalayıp müşteriye telefonla/mesajla
gönderin. Bağlantı müşteriyi doğrudan şifre belirleme ekranına götürür.

- ✅ Şimdi çalışıyor, hiçbir kuruluma ihtiyaç yok
- ❌ Elle iş. On müşteride sıkıntı olmaz, yüz müşteride olmaz.

### 3. Kendi SMTP'miz — asıl çözüm  ← SEÇİLEN YOL

**Durum (2026-09-20):** alan adı `emrahevren.com` GoDaddy'de, `emrah@emrahevren.com`
kutusu çalışıyor. Yani kendi adresimizden gönderebiliriz.

⚠️ **`miyop.emrahevren.com` alt alan adı ŞİMDİ GEREKMİYOR.** O, uygulamanın
yayınlanacağı adres — A5'in işi (Hetzner + SSL). Uygulama hâlâ
`localhost:5173`'te; şimdi alt alan adı eklemek boşa iş olur ve hiçbir
şeyi çözmez. E-posta göndermek için gereken şey SMTP, alan adı değil.

#### 3a. GoDaddy e-postası hangi altyapıda?

GoDaddy alan adını satar, e-postayı ayrı ürün olarak verir ve o ürün
Microsoft 365 tabanlıdır. Kontrol: GoDaddy hesabında **Email & Office**
bölümüne bakın.

| Gördüğünüz | SMTP sunucusu | Port |
|---|---|---|
| Microsoft 365 / Outlook arayüzü | `smtp.office365.com` | 587 |
| GoDaddy Workspace (eski) | `smtpout.secureserver.net` | 587 |

#### 3b. Supabase'e girilecek alanlar

**Project Settings → Authentication → SMTP Settings → Enable Custom SMTP**

| Alan | Değer |
|---|---|
| Host | yukarıdaki tablodan |
| Port | 587 |
| Username | `emrah@emrahevren.com` |
| Password | o kutunun şifresi (Microsoft 365'te uygulama şifresi gerekebilir) |
| Sender email | `emrah@emrahevren.com` |
| Sender name | `MİYOP` |

⚠️ Şifre yalnızca bu alana yazılır. Kimseye gönderilmez — Claude'a da.

#### 3c. Microsoft 365 tıkanırsa

Microsoft 365'te **SMTP AUTH varsayılan olarak kapalı** olabilir ve iki
adımlı doğrulama açıksa normal şifre çalışmaz; uygulama şifresi üretmek
gerekir. Bu duvara çarparsanız daha az dirençli yol:

1. **Brevo**'da ücretsiz hesap (günde 300 e-posta).
2. Brevo, `emrahevren.com` için iki DNS kaydı ister (SPF ve DKIM).
   Bunları **GoDaddy → Domains → DNS → Add record** ile eklersiniz;
   Brevo ekranda ne yazacağınızı aynen gösterir.
3. Brevo'nun verdiği SMTP bilgilerini yukarıdaki tabloya yazarsınız.

Bu yol bir adım uzun ama gönderim itibarı (SPF/DKIM) doğru kurulduğu için
e-postalar spam'e daha az düşer. Gerçek müşterilere gönderim başladığında
zaten buraya geleceğiz.

#### 3d. Eski bölüm (genel anlatım)

Supabase'e kendi e-posta sağlayıcımızı tanıtırız; o günden sonra **her
adrese** gider ve gönderen "MİYOP" olur.

Kurulum (panelden, kod yok):

1. Bir e-posta sağlayıcısında ücretsiz hesap açın. Şu an en az adımlı
   olan **Brevo** (eski adı Sendinblue): günde 300 e-posta, alan adı
   şart değil, gönderen adresini doğrulamak yeterli.
   Alternatif: Gmail SMTP (uygulama şifresiyle, günde ~500).
2. Sağlayıcının **SMTP** bilgilerini alın: sunucu adresi, port,
   kullanıcı adı, şifre.
3. Supabase panelinde **Project Settings → Authentication → SMTP
   Settings** → *Enable Custom SMTP* → bilgileri girin.
   - Sender email: gönderen adresi (doğruladığınız adres)
   - Sender name: `MİYOP`
4. Kaydedin. **Authentication → Emails** altından şablonları Türkçeye
   çevirebilirsiniz (konu ve gövde).

⚠️ **SMTP şifresi bir sırdır.** Yalnızca Supabase panelinin o alanına
yazılır. Kimseye gönderilmez — Claude'a da. Bu depoda da durmaz.

### Hangisi?

Bugün ilerlemek için **2**, bu hafta içinde **3**. Yol haritasında bu
madde A5'e (Hetzner + alan adı) yazılıydı; ama A4D'nin 5. maddesi
("davet e-postası gidiyor") SMTP olmadan kapanmıyor. Yani 3, sanıldığı
kadar ertelenebilir değil.

## Kurulumdan sonra doğrulama

1. Gizli pencerede `/basvuru` → formu **müşteri gibi**, MİYOP'la ilgisi
   olmayan bir adresle doldurun.
2. Onaylayın → "Giriş hesabı aç ve davet gönder".
3. E-posta o adrese **gerçekten** gelmeli. Gelmezse Supabase panelinde
   **Authentication → Logs** altında gönderim kaydı görünür; sağlayıcının
   kendi panelinde de gönderim listesi vardır.
