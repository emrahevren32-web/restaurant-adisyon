# ═══════════════════════════════════════════════════════════════════════════
# MİYOP · Günlük veritabanı yedeği
#
# Bu betik `pg_dump` ile Supabase veritabanının TAM dökümünü alır: şema,
# veri, tetikleyiciler, RLS politikaları. Uygulama içindeki "Veri Yedeği"
# ekranından farkı budur — o yalnızca iş verisini çıkarır.
#
# ── KURULUM (bir kez) ─────────────────────────────────────────────────────
#   1. Bu dosyayı F:\MIYOP_BACKUP\ altına kopyalayın.
#   2. Yanına iki dosya açın:
#        `baglanti.txt` → Supabase bağlantı adresi (üstteki Connect
#                         düğmesi → Session pooler). Parola kısmı kalabilir,
#                         parola.txt varsa yok sayılır.
#        `parola.txt`   → yalnızca veritabanı parolası, tek satır.
#      Parolanın ayrı durması şart değil ama ÖNERİLİR: içinde @ : / ? # %
#      gibi bir karakter varsa adres satırı bozulur ve hata "parola yanlış"
#      der — oysa parola doğrudur.
#   3. Zamanlanmış görevi kurun (KURULUM.md ya da YEDEKLEME.md §2.4).
#
# ⚠️ `baglanti.txt` ve `parola.txt` PAROLA İÇERİR.
#    · Git deposuna KONULMAZ. F:\ sürücüsünde durur, orası depo değil.
#    · Kimseye gönderilmez — Claude'a da.
#    · Yedek klasörünü buluta yüklerken bu dosyayı hariç tutun.
#
# ── NEDEN AYRI DOSYADAN OKUYOR ───────────────────────────────────────────
# Parolayı betiğin içine yazsaydık, betiği paylaşmak parolayı paylaşmak
# olurdu. Ayrı dosya, betiğin serbestçe kopyalanabilmesini sağlıyor.
# ═══════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'

# Betiğin bulunduğu klasör — yedekler ve baglanti.txt buranın yanında.
$kok = Split-Path -Parent $MyInvocation.MyCommand.Path
$baglantiDosyasi = Join-Path $kok 'baglanti.txt'
$parolaDosyasi   = Join-Path $kok 'parola.txt'
$gunluk = Join-Path $kok 'yedek-gunlugu.txt'

function Yaz($mesaj) {
  $satir = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $mesaj
  Write-Host $satir
  Add-Content -Path $gunluk -Value $satir -Encoding UTF8
}

# ── 1 · Bağlantı adresi ───────────────────────────────────────────────────
if (-not (Test-Path $baglantiDosyasi)) {
  Yaz "HATA: baglanti.txt bulunamadi ($baglantiDosyasi). Kurulum adim 2."
  exit 1
}
$baglanti = (Get-Content $baglantiDosyasi -Raw)

# ⚠️ GÖRÜNMEZ KARAKTER TEMİZLİĞİ.
#
# Notepad UTF-8 kaydederken dosyanın başına BOM (byte order mark) koyar.
# Gözle görünmez ama satırın ilk karakteridir ve `pg_dump` o yüzden satırı
# bağlantı adresi olarak TANIMAZ — sessizce localhost'a bağlanmaya çalışır
# ve "role ... does not exist" der. Hata mesajı sebebi hiç söylemez.
#
# Aynı şekilde kullanıcı adresi tırnak içinde yapıştırmış olabilir.
$baglanti = $baglanti -replace "^\uFEFF", ''      # BOM
$baglanti = $baglanti -replace "[\r\n]", ''       # satır sonları
$baglanti = $baglanti.Trim().Trim('"').Trim("'").Trim()

if ([string]::IsNullOrWhiteSpace($baglanti)) {
  Yaz "HATA: baglanti.txt bos."
  exit 1
}

# Adres gerçekten bir bağlantı adresi mi. Değilse pg_dump onu VERİTABANI ADI
# sanar, localhost'a bağlanır ve anlaşılmaz bir hata verir. Burada erken ve
# anlaşılır patlıyoruz.
if ($baglanti -notmatch '^postgres(ql)?://') {
  Yaz "HATA: baglanti.txt 'postgresql://' ile baslamiyor."
  Yaz "      Ilk 20 karakter: '$($baglanti.Substring(0, [Math]::Min(20, $baglanti.Length)))'"
  Yaz "      Supabase panelinde ust taraftaki Connect dugmesinden"
  Yaz "      Session pooler adresini kopyalayin."
  exit 1
}

# ── PAROLA ADRESTEN AYRI ──────────────────────────────────────────────────
# `parola.txt` varsa parola ORADAN okunur ve adresteki parola atılır.
#
# Neden: adres satırı bir URI'dir ve parolada `@ : / ? # %` gibi bir karakter
# varsa satırı bozar. Kullanıcıdan yüzde kodlaması ("%40" yaz) beklemek
# gerçekçi değil; hata da anlaşılmaz oluyor ("password authentication failed"
# der ama parola doğrudur, satır yanlış ayrışmıştır).
#
# `PGPASSWORD` ortam değişkeni URI ayrıştırmasına girmez — içinde ne varsa
# olduğu gibi gider.
if (Test-Path $parolaDosyasi) {
  $parola = ((Get-Content $parolaDosyasi -Raw) -replace "^\uFEFF", '') -replace "[\r\n]", ''
  $parola = $parola.Trim().Trim('"').Trim("'")
  if ([string]::IsNullOrWhiteSpace($parola)) { Yaz "HATA: parola.txt bos."; exit 1 }

  # Adresteki parolayı sök: postgresql://kullanici:parola@sunucu → ...kullanici@sunucu
  # .*@ acgozlu: parolanin icinde @ olsa bile SON @ isaretine kadar siler.
  $baglanti = $baglanti -replace '^(postgres(?:ql)?://[^:/@]+):.*@', '$1@'
  $env:PGPASSWORD = $parola
  Yaz "Parola parola.txt'ten okundu."
}

# Parolayı GİZLEYEREK neye bağlandığımızı yaz. Hangi sunucuya gittiğini
# görmeden hata ayıklamak körlemesine deneme yanılma olur.
$maskeli = $baglanti -replace '(//[^:]+:)[^@]*(@)', '$1***$2'
Yaz "Baglanti: $maskeli"

# ── 2 · pg_dump yerinde mi ────────────────────────────────────────────────
$pgDump = 'pg_dump'
if (-not (Get-Command $pgDump -ErrorAction SilentlyContinue)) {
  # PATH'te yoksa bilinen kurulum yolunu dene. Zamanlanmış görev bazen
  # kullanıcı PATH'ini almadan çalışır; bu yüzden yedek yol gerekli.
  $aday = 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe'
  if (Test-Path $aday) { $pgDump = $aday }
  else { Yaz "HATA: pg_dump bulunamadi."; exit 1 }
}

# ── 3 · Yedeği al ─────────────────────────────────────────────────────────
$damga = Get-Date -Format 'yyyy-MM-dd-HHmm'
$hedef = Join-Path $kok "miyop-$damga.dump"

Yaz "Yedek basliyor -> $hedef"
try {
  # ── `--no-privileges` KALDIRILDI (2026-09-19) · ÖNEMLİ ──────────────────
  # Eskiden burada `--no-privileges` vardı. Gerekçesi yanlıştı: o seçenek
  # SAHİPLİK değil YETKİ taşır. `--no-owner` sahiplik sorununu zaten çözüyor;
  # `--no-privileges` ise GRANT ve REVOKE satırlarının tamamını dökümden
  # ÇIKARIYORDU.
  #
  # Sonucu şuydu: bu yedek geri yüklendiğinde `anon`dan aldığımız bütün
  # yetkiler (0007) geri gelmiyordu. Supabase yeni tablolara `anon` ve
  # `authenticated` için varsayılan yetkiyi KENDİ verdiği için, geri yüklenen
  # kopyada anonim kullanıcı tabloları OKUYABİLİR hâle geliyordu. Yani yedek
  # "geri geldi" ama kapılar açık geri geldi.
  #
  # Geri yükleme provasının "5. GRANT ... TAMAM" satırı da bu yüzden YANLIŞ
  # GÜVEN veriyordu: saydığı GRANT'lar bizim dökümden değil, Supabase'in
  # varsayılanlarından geliyordu. O kontrol de düzeltildi
  # (yedek-geri-yukle-provasi.ps1, kontrol 7).
  #
  # `anon`, `authenticated`, `service_role` her Supabase projesinde vardır;
  # bu yüzden GRANT satırları hedefte "role does not exist" vermez.
  #
  # `--dbname=` ile AÇIKÇA geçiriliyor. Konumsal argüman olarak verilseydi
  # ve adres tanınmasaydı, pg_dump onu veritabanı adı sayardı — sessiz
  # yanlış davranış yerine açık hata istiyoruz.
  & $pgDump "--dbname=$baglanti" --format=custom --no-owner --file $hedef
  if ($LASTEXITCODE -ne 0) { throw "pg_dump cikis kodu $LASTEXITCODE" }
} catch {
  Yaz "HATA: $($_.Exception.Message)"
  # Yarim kalmis dosyayi birakmiyoruz: yedek sanilan bozuk dosya, hic
  # yedek olmamasindan tehlikelidir.
  if (Test-Path $hedef) { Remove-Item $hedef -Force }
  exit 1
}

# ── 4 · Dosya gercekten olustu mu ─────────────────────────────────────────
# "Komut hatasiz bitti" ile "dosya var ve dolu" ayni sey degildir.
if (-not (Test-Path $hedef)) { Yaz "HATA: dosya olusmadi."; exit 1 }
$boyut = (Get-Item $hedef).Length
if ($boyut -lt 10KB) {
  Yaz "HATA: dosya suphesiz kucuk ($boyut bayt). Silindi."
  Remove-Item $hedef -Force
  exit 1
}
Yaz ("Tamam. {0:N1} MB" -f ($boyut / 1MB))

# ── 5 · Eskileri temizle ──────────────────────────────────────────────────
# Son 7 gunluk yedek + her ayin 1'i kalir.
#
# Neden ayin 1'i saklaniyor: bozulmayi ayni gun fark etmezsiniz. Bir hafta
# once silinen bir kayit, yalnizca 7 gun saklanan yedekle geri gelmez.
$sinir = (Get-Date).AddDays(-7)
Get-ChildItem -Path $kok -Filter 'miyop-*.dump' | ForEach-Object {
  if ($_.LastWriteTime -lt $sinir -and $_.LastWriteTime.Day -ne 1) {
    Remove-Item $_.FullName -Force
    Yaz "Eski yedek silindi: $($_.Name)"
  }
}

# Parolayı oturumda bırakmıyoruz.
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Yaz "Bitti."
