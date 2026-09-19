# =========================================================================
# MIYOP - Geri yukleme provasi
#
# "Denenmemis yedek, yedek degildir." Bu betik en son .dump dosyasini
# AYRI BIR PROVA VERITABANINA geri yukler ve alti kontrol yapar:
#   1. Veri geldi mi           (yedi tablonun hicbiri bos olmamali)
#   2. Tetikleyiciler geldi mi (sayim kilidi + denetim kaydi calisir mi)
#   3. RLS geldi mi            (kiraci izolasyonu duruyor mu)
#   4. Politikalar geldi mi    (izolasyonun kurallari duruyor mu)
#   5. GRANT'lar geldi mi      (RLS ve GRANT AYRI kapilardir)
#   6. app fonksiyonlari       (tetikleyicilerin dayandigi kod)
#
# Veri geri gelip de tetikleyiciler gelmezse, sayim kilidi ve denetim kaydi
# CALISMAYAN bir sistem geri kurmus olursun - ve bunu aylar sonra fark
# edersin. Provanin asil sebebi bu.
#
# ---- KURULUM (bir kez) --------------------------------------------------
#   1. Supabase'de IKINCI bir ucretsiz proje ac. Adi: miyop-prova
#   2. O projenin Session pooler adresini al (Connect dugmesi).
#   3. F:\MIYOP_BACKUP\ altina iki dosya:
#        prova-baglanti.txt -> prova projesinin adresi, PAROLASIZ
#        prova-parola.txt   -> prova projesinin parolasi, tek satir
#      (Parolayi adrese gomme. Bkz. yedek-al.ps1 basligi.)
#
# ---- GUVENLIK KILIDI ----------------------------------------------------
#   Betik --clean kullanir, yani yuklemeden once var olani siler. Bu yuzden
#   ilk is olarak prova adresinin proje kimligini canli baglanti.txt ile
#   karsilastirir. Ayniysa HICBIR SEY YAPMADAN durur. Kimlik okunamazsa da
#   durur - sessizce devam etmez.
#
# ---- ENCODING NOTU (onemli) ---------------------------------------------
#   Bu dosya UTF-8 BOM ile kaydedilmelidir ve metin ("...") iceren
#   satirlarda yalnizca ASCII karakter kullanilir. Windows PowerShell 5.1
#   BOM'suz UTF-8 dosyayi yanlis cozer; ozel bir tire veya Turkce harf
#   tirnak isaretine donusup betigi parcalar.
# =========================================================================

$ErrorActionPreference = 'Stop'

$kok = Split-Path -Parent $MyInvocation.MyCommand.Path
$canliDosyasi = Join-Path $kok 'baglanti.txt'
$provaDosyasi = Join-Path $kok 'prova-baglanti.txt'
$provaParola  = Join-Path $kok 'prova-parola.txt'
$gunluk       = Join-Path $kok 'prova-gunlugu.txt'

function Yaz($mesaj) {
  $satir = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $mesaj
  Write-Host $satir
  Add-Content -Path $gunluk -Value $satir -Encoding UTF8
}

function Oku($yol) {
  if (-not (Test-Path $yol)) { return $null }
  $m = ((Get-Content $yol -Raw) -replace "^\uFEFF", '') -replace "[\r\n]", ''
  return $m.Trim().Trim('"').Trim("'")
}

# Adresten proje kimligini cikar
function ProjeKimligi($adres) {
  if ($adres -match 'postgres\.([a-z0-9]{16,})') { return $Matches[1] }
  if ($adres -match 'db\.([a-z0-9]{16,})\.supabase\.co') { return $Matches[1] }
  return ''
}

# ---- 1 - Adresler -------------------------------------------------------
$prova = Oku $provaDosyasi
if ([string]::IsNullOrWhiteSpace($prova)) {
  Yaz "HATA: prova-baglanti.txt yok ya da bos. Betigin basindaki KURULUM'a bak."
  exit 1
}
if ($prova -notmatch '^postgres(ql)?://') {
  Yaz "HATA: prova-baglanti.txt 'postgresql://' ile baslamiyor."
  exit 1
}
$parola = Oku $provaParola
if ([string]::IsNullOrWhiteSpace($parola)) {
  Yaz "HATA: prova-parola.txt yok ya da bos."
  exit 1
}
# Adreste parola varsa sok (son @ isaretine kadar); parolayi ayri kanaldan ver.
$prova = $prova -replace '^(postgres(?:ql)?://[^:/@]+):.*@', '$1@'

# ---- 2 - GUVENLIK KILIDI ------------------------------------------------
$provaRef = ProjeKimligi $prova
if ([string]::IsNullOrWhiteSpace($provaRef)) {
  Yaz "HATA: prova adresinden proje kimligi okunamadi. Guvenlik kilidi calismadigi icin duruyorum."
  exit 1
}
$canli = Oku $canliDosyasi
if (-not [string]::IsNullOrWhiteSpace($canli)) {
  $canliRef = ProjeKimligi $canli
  if ($canliRef -eq $provaRef) {
    Yaz "DUR. Prova adresi CANLI projeyle ayni ($provaRef). Hicbir sey yapilmadi."
    Yaz "Prova AYRI bir Supabase projesinde yapilir. Canliya --clean ile dokunmayiz."
    exit 1
  }
  Yaz "Guvenlik kilidi tamam. Canli: $canliRef  |  Prova: $provaRef"
} else {
  Yaz "UYARI: baglanti.txt okunamadi, canli/prova karsilastirmasi yapilamadi. Prova: $provaRef"
}

# ---- 3 - En son yedek ---------------------------------------------------
$dump = Get-ChildItem (Join-Path $kok '*.dump') -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime | Select-Object -Last 1
if (-not $dump) { Yaz "HATA: $kok altinda .dump dosyasi yok."; exit 1 }
$mb = [math]::Round($dump.Length / 1MB, 1)
Yaz "Yedek: $($dump.Name)  ($mb MB, $($dump.LastWriteTime))"

# Buradan sonra harici komutlar (pg_restore, psql) calisiyor. Onlar ilerleme
# satirlarini HATA KANALINA yazar; ErrorActionPreference 'Stop' iken PowerShell
# bunu gercek hata sayip ilk satirda duruyor. Bundan sonra cikis KODUNA bakiyoruz.
$ErrorActionPreference = 'Continue'

$env:PGPASSWORD = $parola
try {
  # ---- 4 - Geri yukleme -------------------------------------------------
  # Yalniz BIZIM semalarimiz: public + app. auth/storage/realtime
  # Supabase'in kendi semalari; prova projesinde zaten varlar.
  $ciktiDosyasi = Join-Path $kok 'prova-pg_restore-cikti.txt'

  # ONEMLI: "app" semasini ELLE yaratiyoruz.
  # pg_restore --schema=app dedigimizde, semanin KENDISINI yaratan TOC satiri
  # o secime girmez (pg_dump o satirin semasini bos birakir). Yaratmazsak
  # app icindeki butun fonksiyonlar ve onlara bagli 43 tetikleyici
  # "sema yok" diyerek duser - ve prova sessizce yarim kalir.
  Yaz "app semasi hazirlaniyor."
  & psql --dbname=$prova -q -c "create schema if not exists app;" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Yaz "HATA: app semasi yaratilamadi. Prova durduruldu."; exit 1 }

  Yaz "Geri yukleniyor -> prova projesi ($provaRef). Birkac dakika surebilir."
  # --no-privileges KULLANILMIYOR: GRANT'lar da yedegin parcasi.
  # RLS ve GRANT ayri kapilardir; GRANT'siz geri yuklenen veritabaninda
  # politikalar dogru olsa bile kimse hicbir sey okuyamaz.
  & pg_restore --dbname=$prova --schema=public --schema=app `
    --no-owner --clean --if-exists `
    --verbose $dump.FullName 2>&1 | Out-File -Encoding utf8 $ciktiDosyasi
  $kod = $LASTEXITCODE

  # pg_restore Turkce konusabilir: hem "error" hem "hata" araniyor.
  $hataSayisi = (Select-String -Path $ciktiDosyasi -Pattern '(?i)^pg_restore:\s*(error|hata)' -ErrorAction SilentlyContinue).Count
  Yaz "pg_restore cikis kodu: $kod  |  hata satiri: $hataSayisi  (ayrinti: prova-pg_restore-cikti.txt)"
  $ciktiBoyut = if (Test-Path $ciktiDosyasi) { (Get-Item $ciktiDosyasi).Length } else { 0 }
  if ($ciktiBoyut -eq 0) {
    Yaz "UYARI: pg_restore hic cikti yazmadi. Baglanti kurulamamis olabilir."
  }

  # ---- 5 - Alti kontrol -------------------------------------------------
  function Sor($sql) {
    $d = & psql --dbname=$prova -t -A -c $sql 2>&1
    if ($LASTEXITCODE -ne 0) { return $null }
    return ($d | Out-String).Trim()
  }

  Write-Host ""
  Write-Host "--- 1. VERI GELDI MI ---"
  $tablolar = @('stock_item','stock_lot','stock_movement','stock_count',
                'stock_count_line','shipment','haccp_measurement','audit_log')
  $veriTamam = $true
  foreach ($t in $tablolar) {
    $n = Sor "select count(*) from public.$t;"
    if ($null -eq $n -or $n -notmatch '^\d+$') {
      Write-Host ("  {0,-20} SORULAMADI (tablo gelmemis olabilir)" -f $t)
      $veriTamam = $false
    } elseif ([int]$n -eq 0) {
      Write-Host ("  {0,-20} 0  BOS" -f $t)
      $veriTamam = $false
    } else {
      Write-Host ("  {0,-20} {1}" -f $t, $n)
    }
  }

  $tetik = Sor "select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname = 'public';"
  $rls   = Sor "select count(*) from pg_tables where schemaname = 'public' and rowsecurity and tablename in ('stock_movement','stock_item','audit_log','stock_count');"
  $pol   = Sor "select count(*) from pg_policies where schemaname = 'public';"
  $grant = Sor "select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated','service_role');"
  $appFn = Sor "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app';"

  # ---- Kontrol 7 - ANONIM FAZLA YETKI (2026-09-19'da eklendi) -----------
  # Neden: 5. kontrol "GRANT sayisi >= 20" diyordu ve her zaman TAMAM
  # veriyordu. Ama yedek `--no-privileges` ile alindigi icin o GRANT'lar
  # BIZIM dokumumuzden degil, Supabase'in yeni tablolara kendi verdigi
  # varsayilan yetkilerden geliyordu. Yani kontrol gecti, yedek ise
  # `anon`dan aldigimiz yetkileri (0007) geri getirmiyordu.
  #
  # Sayi saymak yetmez; YANLIS OLANI aramak gerekir. Bu sorgu, anonim
  # kullanicinin OKUMAMASI gereken tablolarda SELECT yetkisi olup olmadigina
  # bakar. 0007'de `anon`a yalnizca bes referans tablosu birakildi.
  # Beklenen sonuc: 0. Sifirdan buyuk her sayi, geri yuklenen kopyada
  # musteri verisinin anonim olarak okunabilecegi anlamina gelir.
  $anonFazla = Sor @"
select count(*) from information_schema.role_table_grants
 where table_schema = 'public' and grantee = 'anon'
   and privilege_type = 'SELECT'
   and table_name not in ('uom','uom_conversion','permission','role','role_permission');
"@
  $anonOrnek = Sor @"
select coalesce(string_agg(distinct table_name, ', '), '-')
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee = 'anon'
   and privilege_type = 'SELECT'
   and table_name not in ('uom','uom_conversion','permission','role','role_permission');
"@

  Write-Host ""
  Write-Host "================ PROVA SONUCU ================"
  Write-Host ("1. Veri                    {0}" -f $(if ($veriTamam) { "TAMAM" } else { "KALDI  (yukaridaki BOS/SORULAMADI satirlarina bak)" }))
  $gecti = $veriTamam

  $kontroller = @(
    @{ ad = "2. Tetikleyici"; deger = $tetik; esik = 10; ek = "sayim kilidi + denetim kaydi" },
    @{ ad = "3. RLS acik tablo"; deger = $rls; esik = 4; ek = "dordunun dordu de acik olmali" },
    @{ ad = "4. Yetki politikasi"; deger = $pol; esik = 20; ek = "izolasyon kurallari" },
    @{ ad = "5. GRANT (okuma izni)"; deger = $grant; esik = 20; ek = "RLS ve GRANT ayri kapilardir" },
    @{ ad = "6. app fonksiyonu"; deger = $appFn; esik = 10; ek = "tetikleyicilerin dayandigi kod" }
  )
  # Bu kontrol TERSTIR: buyuk sayi iyi degil, SIFIR iyidir.
  foreach ($k in $kontroller) {
    $d = $k.deger
    if ($null -eq $d -or $d -notmatch '^\d+$') {
      Write-Host ("{0,-26} SORULAMADI   ({1})" -f $k.ad, $k.ek)
      $gecti = $false
    } elseif ([int]$d -lt $k.esik) {
      Write-Host ("{0,-26} {1,-6} KALDI  (en az {2} bekleniyordu, {3})" -f $k.ad, $d, $k.esik, $k.ek)
      $gecti = $false
    } else {
      Write-Host ("{0,-26} {1,-6} TAMAM  ({2})" -f $k.ad, $d, $k.ek)
    }
  }

  # 7. kontrol ayri, cunku olcut ters: en az degil, EN FAZLA sifir.
  if ($null -eq $anonFazla -or $anonFazla -notmatch '^\d+$') {
    Write-Host ("{0,-26} SORULAMADI   ({1})" -f "7. Anonim fazla yetki", "sorgu calismadi")
    $gecti = $false
  } elseif ([int]$anonFazla -gt 0) {
    Write-Host ("{0,-26} {1,-6} KALDI  (0 olmali; anonim bu tablolari okuyabiliyor)" -f "7. Anonim fazla yetki", $anonFazla)
    Write-Host ("                           -> {0}" -f $anonOrnek)
    $gecti = $false
  } else {
    Write-Host ("{0,-26} {1,-6} TAMAM  (anonim yalnizca referans tablolarini okuyor)" -f "7. Anonim fazla yetki", 0)
  }

  Write-Host "=============================================="

  if ($gecti) {
    Yaz "PROVA BASARILI. Yedi kontrolun yedisi de gecti. Yedek geri yuklenebilir."
  } else {
    Yaz "PROVA BASARISIZ. Yukaridaki KALDI satirlarina bak. Bu yedege guvenilmez."
  }

  Write-Host ""
  Write-Host "Prova bitince: Supabase panelinden miyop-prova projesini sil."
  Write-Host "Ayrinti: docs/YEDEKLEME.md bolum 3."
}
finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  Yaz "Bitti."
}
