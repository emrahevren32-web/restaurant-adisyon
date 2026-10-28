# MİYOP · Davet e-postası · ölçüm ve karar (28.10.2026)

## Deneme sonucu

Emrah 28.10'da **gerçek bir davet akışını uçtan uca denedi** ve akış
**çalıştı**:

1. Başvuru formu dolduruldu → `MIY-8G2P9` numarası verildi.
2. EVREN360'a **bildirim düştü**, bildirimden ilgili sayfaya gidildi.
3. İncele → İncelemeye Al → **gerekçeli** Onayla → işletme açıldı (`YAM002`,
   kiracı + firma + merkez şube).
4. *"Giriş hesabı aç ve davet gönder"* → **e-posta gitti.**
5. Müşteri bağlantıya tıkladı, **kendi şifresini belirledi**, panele girdi.

Yani *"davet e-postası hiç denenmedi"* riski **kapandı**. Akışın kendisi
sağlam.

## ⚠️ Üç kusur çıktı

### 1 · E-posta JUNK klasörüne düştü (Outlook/Hotmail)

Demoyu durdurabilir: müşteri e-postayı bulamazsa giriş yapamaz.

Sebep tek bir şey değil, ama bilinen sebepler şunlar ve **sırayla
ölçülmeli**:

- **Gönderici alan adı doğrulanmamış.** `emrah@emrahevren.com` adresinden
  gönderiliyor ama `emrahevren.com` için **SPF / DKIM / DMARC** kayıtları
  yoksa Outlook mektubu doğrulayamaz ve çöp kutusuna atar. Kayıtlar
  GoDaddy'deki DNS'e yazılır.
- **Supabase'in varsayılan SMTP'si kullanılıyorsa** gönderen sunucu
  Supabase'indir, adres ise `@emrahevren.com`'dur — bu ikisi
  uyuşmadığı için mektup *"adına konuşuyor"* görünür. Varsayılan SMTP
  zaten "yalnız geliştirme için" diye işaretlidir ve günlük sınırı vardır.
- **Düzeltme yolu:** kendi SMTP'ni tanımla (Resend, Brevo, Postmark gibi),
  o servisin verdiği SPF/DKIM kayıtlarını GoDaddy'ye gir, DMARC ekle.
  Sonra aynı denemeyi tekrarla ve e-postanın **gelen kutusuna** düştüğünü
  gör. ⚠️ Doğrulamadan "düzeldi" denmez.

⚠️ Bu madde **kod işi değil**, kurulum işi. Ama demo kapsamındadır.

### 2 · E-posta İNGİLİZCE ve MİYOP'a ait değil

Gelen mektup Supabase'in **varsayılan şablonuydu**:

> **You've been invited** — You've been invited to create an account.
> Follow the link below to accept. · *Accept invitation*

Müşteri Türkçe bir ürün satın alıyor ve ilk teması İngilizce, markasız bir
mektup oluyor. Şablon Supabase panelinden değiştirilir:
**Authentication → Email Templates → Invite user**.

Aşağıdaki şablon oraya yapıştırılacak:

```html
<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">
  <p style="font-size:13px;letter-spacing:.08em;color:#0d9488;margin:0 0 4px">MİYOP</p>
  <h2 style="margin:0 0 16px;font-size:20px">İşletmeniz açıldı</h2>
  <p style="line-height:1.6;margin:0 0 16px">
    MİYOP üzerinde işletme kaydınız oluşturuldu. Devam etmek için kendinize
    bir şifre belirlemeniz gerekiyor.
  </p>
  <p style="margin:0 0 24px">
    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
      Şifremi belirle
    </a>
  </p>
  <p style="line-height:1.6;margin:0 0 8px;font-size:14px;color:#444">
    Düğme çalışmazsa bu adresi tarayıcınıza yapıştırın:<br>
    <span style="word-break:break-all">{{ .ConfirmationURL }}</span>
  </p>
  <p style="line-height:1.6;margin:16px 0 0;font-size:13px;color:#666">
    Bu bağlantı yalnız size özeldir ve bir süre sonra geçersiz olur.
    Şifrenizi yalnız siz bilirsiniz; MİYOP göremez.
  </p>
  <p style="line-height:1.6;margin:16px 0 0;font-size:13px;color:#666">
    Bu daveti beklemiyorsanız bu mektubu yok sayabilirsiniz.
  </p>
</div>
```

**Konu satırı:** `MİYOP · işletmeniz açıldı, şifrenizi belirleyin`

⚠️ *"Hesabınız oluşturuldu"* demiyoruz; **işletmeniz açıldı** diyoruz.
Müşteri bir yazılım hesabı değil, bir işletme kaydı satın aldı.

### 3 · Karşılama turu TÜRKÇE KARAKTERSİZ yazılmıştı

Müşteri şifresini belirledikten sonra **ilk gördüğü ekran** tanıtım
turuydu ve şöyle yazıyordu:

> *Kurulum basariyla tamamlandi · Isletmeniz artik kullanima hazir. Simdi
> birlikte sistemi taniyalim. · Rehberi Baslat*

Türkçesiz bir karşılama, ürünün tamamı hakkında ilk izlenimi verir.
`src/components/OnboardingExperience.tsx` ve `ProductTour.tsx` metinleri
28.10'da düzeltildi; aynı turda **içerik olarak da** yenilendi:
*"Sidebar"*, *"Global Arama"*, *"Widget Alani"* gibi başlıklar
kullanıcının değil geliştiricinin diliydi.

⚠️ **Kalan:** `src/pages/WorkspaceWelcome.tsx` de baştan sona Türkçesiz ve
içinde *"Workspace"*, *"Widget"*, *"Dashboarda Git"* geçiyor. Oraya yalnız
şapka takmak **yarım iş** olurdu; o ekran HEDEFLER **3.11 (Karşılama ·
MIYOP-065)** maddesinde baştan yazılacak.

## Başvuru numarası (MIY-8G2P9) ne işe yarar

Başvurunun **kalıcı kimliğidir**. Müşteri telefonda *"MIY-8G2P9 numaralı
başvurumu onaylar mısın"* derse, EVREN360 → Onay Bekleyen İşletmeler →
**Arama** kutusuna o numara yazılarak bulunur.

Ölçüldü (`PendingApplications.tsx:273`): arama alanı
`referans + firma adı + yetkili + e-posta + telefon` üzerinden geçiyor,
yani numara **gerçekten aranıyor** — ve arama Türkçe duyarlı
(`aramaAnahtari`, işaretsiz eşleşme).

⚠️ **Tuzak:** *Başvuru Durumu* süzgeci varsayılan olarak
**"Karar bekleyenler"**. Onaylanmış bir başvuruyu numarayla ararken
bulamazsan süzgeci **"Tümü"** yap.
