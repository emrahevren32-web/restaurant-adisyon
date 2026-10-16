# ═══════════════════════════════════════════════════════════════════════════
# MİYOP · SÜRÜM YEDEĞİ
#
#   Kullanım (proje klasöründe, PowerShell):
#       .\miyop-yedek.ps1                      → klasör adını sorar
#       .\miyop-yedek.ps1 -Etiket "ilk-demo"   → doğrudan
#
#   Ne yapar: kaynak kodu + yayındaki derlemeyi F:\MIYOP_BACKUP\<etiket>
#   altına iki ayrı zip olarak koyar, yanına bir bilgi dosyası yazar ve
#   zipleri AÇARAK doğrular.
#
# ⚠️ NEYİ KAPSAMAZ: veritabanını. MİYOP'un verisi Supabase'de duruyor,
#    bu bilgisayarda değil. Supabase kendi yedeğini alıyor; işletme verisi
#    ayrıca uygulamadaki "Veri ve Yedekleme" ekranından dışa aktarılabilir.
#    Bu betik YAZILIMI yedekler, VERİYİ değil. İkisi ayrı şeydir.
#
# ⚠️ Zip içinde `.env.local` VAR — Supabase anahtarların orada. Yedek kendi
#    diskinde kalsın, kimseye göndermeyin. (Anahtarsız yedek geri yüklenemez,
#    o yüzden bilerek dahil ediliyor.)
# ═══════════════════════════════════════════════════════════════════════════
param(
  [string]$Etiket = '',
  [string]$YedekKoku = 'F:\MIYOP_BACKUP'
)

$ErrorActionPreference = 'Stop'

function Bilgi($m){ Write-Host "`n> $m" -ForegroundColor Cyan }
function Tamam($m){ Write-Host "  [OK] $m" -ForegroundColor Green }
function Uyari($m){ Write-Host "  [!] $m" -ForegroundColor Yellow }
function Hata($m){ Write-Host "`n[HATA] $m" -ForegroundColor Red; exit 1 }

# ── 0 · Ön kontroller ─────────────────────────────────────────────────────
Bilgi '0/5 - On kontroller'

if(-not (Test-Path '.\package.json')){
  Hata 'Proje klasorunde degilsin. Once: cd C:\Users\90544\Documents\restaurant-adisyon'
}
Tamam 'Proje klasorundeyiz'

if(-not $Etiket){
  $Etiket = Read-Host 'Yedek klasoru adi (ornek: ilk-demo)'
}
if(-not $Etiket){ Hata 'Klasor adi bos olamaz.' }
# Dosya adinda sorun cikaracak karakterleri temizle
$Etiket = ($Etiket -replace '[^\w\.\-]', '-').Trim('-')

$Surucu = Split-Path -Qualifier $YedekKoku
if(-not (Test-Path $Surucu)){ Hata "$Surucu surucusu bulunamadi. Disk takili mi?" }
Tamam "$Surucu surucusu erisilebilir"

$Hedef = Join-Path $YedekKoku $Etiket
if(Test-Path $Hedef){
  $devam = Read-Host "`n  '$Hedef' zaten var. Icine yeni zip eklensin mi? (e/h)"
  if($devam -ne 'e'){ Hata 'Vazgecildi.' }
} else {
  New-Item -ItemType Directory -Path $Hedef -Force | Out-Null
}
Tamam "Hedef: $Hedef"

$Damga = Get-Date -Format 'yyyyMMdd-HHmm'

# ── 1 · Sürüm bilgisi topla ───────────────────────────────────────────────
Bilgi '1/5 - Surum bilgisi toplaniyor'

$Commit = ''; $Dal = ''; $KirliDosya = 0
try{
  $Commit     = (git rev-parse --short HEAD 2>$null)
  $Dal        = (git rev-parse --abbrev-ref HEAD 2>$null)
  $KirliDosya = @(git status --porcelain 2>$null).Count
} catch { Uyari 'git bilgisi okunamadi' }

if($Commit){ Tamam "Commit: $Commit  ·  Dal: $Dal" }
if($KirliDosya -gt 0){
  Uyari "$KirliDosya dosya commit EDILMEMIS. Yedek bu haliyle aliniyor."
}

$GocSayisi = @(Get-ChildItem -Path '.\db\migrations' -Filter '0*.sql' -ErrorAction SilentlyContinue).Count
$SonGoc    = (Get-ChildItem -Path '.\db\migrations' -Filter '0*.sql' -ErrorAction SilentlyContinue |
              Sort-Object Name | Select-Object -Last 1).Name
Tamam "Goc: $GocSayisi dosya, son: $SonGoc"

# ── 2 · Kaynak kodu hazırla ───────────────────────────────────────────────
# ⚠️ Dogrudan zip'lemek yerine once temiz bir kopya cikariyoruz. Boylece
#    node_modules gibi devasa ve yeniden uretilebilir klasorler disarida
#    kalir ve zip boyutu makul olur.
Bilgi '2/5 - Kaynak kodu hazirlaniyor'

$Gecici = Join-Path $env:TEMP "miyop-yedek-$Damga"
if(Test-Path $Gecici){ Remove-Item -Recurse -Force $Gecici }
New-Item -ItemType Directory -Path $Gecici -Force | Out-Null

# /E alt klasorler dahil · /XD disarida birakilacak klasorler
# .git DAHIL EDILIYOR: gecmis olmadan "o gunku hale don" yapilamaz.
$null = robocopy '.' $Gecici /E `
  /XD node_modules dist .tmp test-results verification-screenshots screenshots `
  /XF '*.log' `
  /NFL /NDL /NJH /NJS /NP
if($LASTEXITCODE -ge 8){ Hata "robocopy basarisiz (kod $LASTEXITCODE)" }

$KaynakAdet = @(Get-ChildItem -Recurse -File $Gecici).Count
Tamam "$KaynakAdet dosya kopyalandi (node_modules haric)"

# ── 3 · Zip'le ────────────────────────────────────────────────────────────
Bilgi '3/5 - Arsivleniyor'

$KaynakZip = Join-Path $Hedef "miyop-kaynak-$Damga.zip"
Compress-Archive -Path (Join-Path $Gecici '*') -DestinationPath $KaynakZip -Force
$KaynakMB = [math]::Round((Get-Item $KaynakZip).Length / 1MB, 2)
Tamam "Kaynak: $(Split-Path -Leaf $KaynakZip)  ($KaynakMB MB)"

$DagitimZip = ''
if(Test-Path '.\dist\index.html'){
  $DagitimZip = Join-Path $Hedef "miyop-dagitim-$Damga.zip"
  Compress-Archive -Path '.\dist\*' -DestinationPath $DagitimZip -Force
  $DagitimMB = [math]::Round((Get-Item $DagitimZip).Length / 1MB, 2)
  Tamam "Dagitim: $(Split-Path -Leaf $DagitimZip)  ($DagitimMB MB)"
} else {
  Uyari 'dist klasoru yok — yayindaki derleme yedeklenmedi. Once: npm run build'
}

Remove-Item -Recurse -Force $Gecici

# ── 4 · Bilgi dosyası ─────────────────────────────────────────────────────
Bilgi '4/5 - Bilgi dosyasi yaziliyor'

$Bilgi = @"
MIYOP - SURUM YEDEGI
====================================================================
Etiket          : $Etiket
Alindigi an     : $(Get-Date -Format 'dd.MM.yyyy HH:mm')
Alan bilgisayar : $env:COMPUTERNAME

KAYNAK KOD
--------------------------------------------------------------------
Git commit      : $Commit
Git dal         : $Dal
Commitlenmemis  : $KirliDosya dosya
Dosya sayisi    : $KaynakAdet
Arsiv           : $(Split-Path -Leaf $KaynakZip)  ($KaynakMB MB)

VERITABANI YAPISI
--------------------------------------------------------------------
Goc dosyasi     : $GocSayisi
Son goc         : $SonGoc
(Gocler kaynak arsivinin icinde: db/migrations)

YAYIN
--------------------------------------------------------------------
Adres           : https://miyop.emrahevren.com
Sunucu          : Hetzner, Ubuntu 24.04, Nginx + Let's Encrypt
Dagitim arsivi  : $(if($DagitimZip){ Split-Path -Leaf $DagitimZip } else { 'YOK - dist klasoru bulunamadi' })

BU YEDEK NEYI KAPSAMIYOR
--------------------------------------------------------------------
* VERITABANI. MIYOP'un verisi Supabase'de; bu bilgisayarda degil.
  Supabase kendi yedegini tutuyor. Isletme verisi ayrica uygulamadaki
  "Veri ve Yedekleme" ekranindan disa aktarilabilir.
* node_modules. Geri yuklerken: npm install
* Sunucu ayarlari. Nginx ayari sunucuda /etc/nginx/sites-available
  altinda; kurulum betigi kaynak arsivinde (miyop-sunucu-kurulum.sh).

!! DIKKAT: Kaynak arsivinin icinde .env.local var ve Supabase
   anahtarlarini tasiyor. Bu yedegi paylasma.

GERI YUKLEME
--------------------------------------------------------------------
1. Kaynak arsivini bos bir klasore ac
2. npm install
3. npm test        (beklenen: hepsi yesil)
4. npm run build
====================================================================
"@

$BilgiYolu = Join-Path $Hedef "SURUM-BILGISI-$Damga.txt"
$Bilgi | Out-File -FilePath $BilgiYolu -Encoding UTF8
Tamam "Bilgi dosyasi: $(Split-Path -Leaf $BilgiYolu)"

# ── 5 · DOĞRULAMA ─────────────────────────────────────────────────────────
# ⚠️ Acilmayan bir zip, yedek degildir. Her arsiv burada gercekten aciliyor.
Bilgi '5/5 - Arsivler dogrulaniyor'

Add-Type -AssemblyName System.IO.Compression.FileSystem

function ZipDogrula($yol, $ad){
  try{
    $z = [System.IO.Compression.ZipFile]::OpenRead($yol)
    $n = $z.Entries.Count
    $z.Dispose()
    if($n -gt 0){ Tamam "$ad acilabiliyor - $n kayit"; return $true }
    Uyari "$ad BOS"; return $false
  } catch {
    Uyari "$ad ACILAMIYOR: $($_.Exception.Message)"; return $false
  }
}

$ok = ZipDogrula $KaynakZip 'Kaynak arsivi'
if($DagitimZip){ $null = ZipDogrula $DagitimZip 'Dagitim arsivi' }

Write-Host ''
Write-Host '===========================================================' -ForegroundColor DarkGray
if($ok){
  Write-Host " YEDEK HAZIR: $Hedef" -ForegroundColor Green
} else {
  Write-Host ' YEDEK SUPHELI - yukaridaki uyariya bak' -ForegroundColor Red
}
Write-Host ''
Write-Host ' Simdi Surum Defteri.xlsx dosyasina bir satir ekle:' -ForegroundColor DarkGray
Write-Host "   Yedek klasoru = $Hedef" -ForegroundColor DarkGray
Write-Host "   Commit        = $Commit" -ForegroundColor DarkGray
Write-Host '===========================================================' -ForegroundColor DarkGray
