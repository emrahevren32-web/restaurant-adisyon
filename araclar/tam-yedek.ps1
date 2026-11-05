# ===========================================================================
# MIYOP . TAM PROJE YEDEGI (kod + gecmis + dokumanlar)
#
# Kullanim:
#     .\araclar\tam-yedek.ps1
#     .\araclar\tam-yedek.ps1 -Hedef 'F:\MIYOP_BACKUP' -IkinciHedef 'G:\'
#
# ---------------------------------------------------------------------------
# BU YEDEK NEYI KAPSIYOR
# ---------------------------------------------------------------------------
#   1. depo\            . calisma kopyasinin tamami (kaynak, gocler, provalar,
#                         dokumanlar, betikler, Edge Function'lar)
#   2. miyop.gitbundle  . BUTUN GIT GECMISI tek dosyada. Bu bir kopya degil,
#                         KLONLANABILIR bir depodur:
#                             git clone miyop.gitbundle miyop-geri
#                         Yani yalniz bugunku hali degil, her commit geri gelir.
#   3. SURUM.txt        . ne zaman alindi, hangi commit, kac dosya, kac bayt
#
# ---------------------------------------------------------------------------
# !! BU YEDEGIN KAPSAMADIGI . OKUMADAN GECME
# ---------------------------------------------------------------------------
# * VERITABANI YOK. Stok, siparis, HACCP kaydi, denetim defteri . hepsi
#   Supabase'deki Postgres'te ve BU KLASORDE DEGIL. Onun yedegi ayri:
#   araclar\yedek-al.ps1 (bkz. docs/YEDEKLEME.md).
#   Bu betik kodu ve gecmisi yedekler; VERIYI DEGIL.
# * node_modules ve dist YOK ve olmamali: ikisi de uretilen seyler.
#   `npm install` ve `npm run build` ikisini de geri uretir. Yuz binlerce
#   kucuk dosyayi kopyalamak yedegi saatlerce surdururdu.
# * Sunucu yapilandirmasi (nginx, sertifika) YOK.
#
# !! .env.local YEDEGE GIRER. Icinde Supabase proje adresi ve anon anahtari
#    var. Anon anahtari gizli degildir (tarayiciya gitmek uzere tasarlanmistir,
#    koruma RLS'ten gelir) ama yine de yedek diski FIZIKSEL olarak guvende
#    tutulmali. service_role anahtari bu projede HICBIR YERDE yazili degil.
# ===========================================================================

param(
  [string]$Hedef       = 'F:\MIYOP_BACKUP',
  [string]$IkinciHedef = ''
)

$ErrorActionPreference = 'Stop'

function Bilgi($m){ Write-Host ""; Write-Host "> $m" -ForegroundColor Cyan }
function Tamam($m){ Write-Host "  [OK] $m" -ForegroundColor Green }
function Uyari($m){ Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Hata($m){ Write-Host ""; Write-Host "  [X]  $m" -ForegroundColor Red; Write-Host ""; exit 1 }

# !! 30.10.2026 . BU YARDIMCI BIR HATANIN BEDELI.
# `git bundle verify` BASARI mesajini bile stderr'e yaziyor
# ("... is okay"). `$ErrorActionPreference = 'Stop'` acikken, yerel bir
# komutun stderr'e yazdigi HER SATIR olumcul hataya cevriliyor. Sonuc:
# yedek alinmis, paket dogrulanmis, betik yine de patlamisti.
# Ders: yerel komutun stderr'i HATA DEMEK DEGILDIR; karar CIKIS KODUNA gore
# verilir. (Tuzak 158)
$script:GitKod = 0
function GitCalistir([string[]]$Argumanlar){
  $eski = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $cikti = & git @Argumanlar 2>&1 | Out-String
  $script:GitKod = $LASTEXITCODE
  $ErrorActionPreference = $eski
  return $cikti
}

# -- 0 . On kontroller ------------------------------------------------------
Bilgi '0/5 - On kontroller'

if(-not (Test-Path 'package.json')){
  Hata 'Proje klasorunde degilsin. Once: cd C:\Users\90544\Documents\restaurant-adisyon'
}
if(-not (Test-Path '.git')){
  Hata '.git bulunamadi . gecmis yedeklenemez.'
}
Tamam 'proje klasorundeyiz'

$surucu = Split-Path -Qualifier $Hedef
if(-not (Test-Path $surucu)){
  Hata "Hedef surucu yok: $surucu . harici disk takili mi?"
}
Tamam "hedef surucu hazir: $surucu"

# -- 1 . Hedef klasor -------------------------------------------------------
Bilgi '1/5 - Hedef klasor'

$damga = Get-Date -Format 'yyyyMMdd-HHmmss'
$kok   = Join-Path $Hedef "miyop-$damga"
$depo  = Join-Path $kok 'depo'
New-Item -ItemType Directory -Force -Path $depo | Out-Null
Tamam "hedef: $kok"

# -- 2 . Calisma kopyasi ----------------------------------------------------
Bilgi '2/5 - Dosyalar kopyalaniyor'

# !! robocopy'nin CIKIS KODU 0-7 ARASI BASARIDIR (bit maskesi: 1=kopyalandi,
#    2=fazlalik, 4=uyumsuz). 8 ve ustu gercek hatadir. `-ne 0` yazmak
#    "dosya kopyalandi" durumunu HATA sanirdi.
$harici = @('node_modules','dist','build','.tmp')
# !! `@harici` DEGIL `$harici`: @ isareti cmdlet'lere parametre dagitmak
#    icindir; yerel komutlarda dizi `$harici` ile zaten ayri argumanlara
#    acilir. @ ile yazmak sessizce yanlis arguman uretebilirdi.
robocopy "." "$depo" /MIR /XD $harici "$Hedef" /XF "*.log" /R:1 /W:1 /NFL /NDL /NJH /NP | Out-Null
$rc = $LASTEXITCODE
if($rc -ge 8){ Hata "Kopyalama basarisiz (robocopy kodu $rc)." }

$dosyaSayisi = (Get-ChildItem -Path $depo -Recurse -File -Force | Measure-Object).Count
$bayt        = (Get-ChildItem -Path $depo -Recurse -File -Force | Measure-Object -Property Length -Sum).Sum
Tamam ("{0:N0} dosya, {1:N1} MB" -f $dosyaSayisi, ($bayt/1MB))

if($dosyaSayisi -lt 200){
  Hata "Yalniz $dosyaSayisi dosya kopyalandi . bu beklenenden az, yedek SUPHELI."
}

# -- 3 . Git gecmisi tek dosyada --------------------------------------------
Bilgi '3/5 - Git gecmisi (bundle)'

$bundle = Join-Path $kok 'miyop.gitbundle'
$ciktiCreate = GitCalistir @('bundle','create',"$bundle",'--all')
if($script:GitKod -ne 0 -or -not (Test-Path $bundle)){
  Hata "git bundle olusturulamadi . gecmis yedeklenemedi.`n$ciktiCreate"
}

# !! Dosyanin olusmasi, icinde gecmis oldugu anlamina gelmez (tuzak 157).
#    `git bundle verify` dosyayi GERCEKTEN acip kontrol eder.
$dogrulama = GitCalistir @('bundle','verify',"$bundle")
if($script:GitKod -ne 0){
  Hata "git bundle DOGRULANAMADI:`n$dogrulama"
}
$bundleBayt = (Get-Item $bundle).Length
Tamam ("gecmis dogrulandi . {0:N1} MB" -f ($bundleBayt/1MB))

$commit = (GitCalistir @('rev-parse','HEAD')).Trim()
$dal    = (GitCalistir @('rev-parse','--abbrev-ref','HEAD')).Trim()
$sayi   = (GitCalistir @('rev-list','--count','HEAD')).Trim()
$kirli  = (GitCalistir @('status','--porcelain')).Trim()
Tamam "dal: $dal . commit: $($commit.Substring(0,7)) . toplam $sayi commit"
if($kirli){ Uyari 'Calisma kopyasinda COMMIT EDILMEMIS degisiklik var (SURUM.txt icine yazildi).' }

# -- 4 . Surum notu ---------------------------------------------------------
Bilgi '4/5 - SURUM.txt'

$not = @"
MIYOP . TAM PROJE YEDEGI
========================

Alindi      : $(Get-Date -Format 'dd.MM.yyyy HH:mm:ss')
Bilgisayar  : $env:COMPUTERNAME
Kaynak      : $((Resolve-Path '.').Path)
Hedef       : $kok

GIT
---
Dal         : $dal
Commit      : $commit
Toplam      : $sayi commit
Bundle      : miyop.gitbundle ($([math]::Round($bundleBayt/1MB,1)) MB) . 'git bundle verify' GECTI

Commit edilmemis degisiklik:
$(if($kirli){ $kirli } else { '  (yok . calisma kopyasi temiz)' })

DOSYALAR
--------
depo\       : $('{0:N0}' -f $dosyaSayisi) dosya, $([math]::Round($bayt/1MB,1)) MB
Haric       : node_modules, dist, build, .tmp, *.log

GERI YUKLEME
------------
  1. Kodu geri getirmek (gecmisiyle birlikte):
         git clone miyop.gitbundle miyop-geri
     ya da dosyalari dogrudan kullanmak icin depo\ klasorunu kopyala.
  2. Bagimliliklar:
         npm install
  3. Ortam degiskenleri: depo\.env.local zaten iceride.
  4. Derleme:
         npm run build

!! BU YEDEKTE OLMAYANLAR
------------------------
  * VERITABANI YOK. Stok, siparis, HACCP, denetim defteri Supabase'de.
    Onun yedegi: araclar\yedek-al.ps1 . bkz. docs/YEDEKLEME.md
  * node_modules ve dist yok (uretilen seyler, geri uretilir).
  * Sunucu yapilandirmasi (nginx, sertifika) yok.
  * Supabase Edge Function'lar KAYNAK olarak var (supabase/functions/),
    ama panele dagitimi elle yapilir.

!! .env.local bu yedegin icindedir. Anon anahtari gizli degildir
   (tarayiciya gitmek uzere tasarlanmistir, koruma RLS'ten gelir) ama
   yedek diskini yine de fiziksel olarak guvende tut.
"@
$not | Out-File -Encoding UTF8 (Join-Path $kok 'SURUM.txt')
Tamam 'SURUM.txt yazildi'

# -- 5 . Ikinci kopya (istege bagli) ----------------------------------------
if($IkinciHedef){
  Bilgi '5/5 - Ikinci diske kopya'
  $s2 = Split-Path -Qualifier $IkinciHedef
  if(-not (Test-Path $s2)){
    Uyari "Ikinci surucu yok: $s2 . atlandi."
  } else {
    $kok2 = Join-Path $IkinciHedef "miyop-$damga"
    robocopy "$kok" "$kok2" /MIR /R:1 /W:1 /NFL /NDL /NJH /NP | Out-Null
    if($LASTEXITCODE -ge 8){ Uyari 'Ikinci kopya basarisiz.' }
    else {
      $d2 = (Get-ChildItem -Path $kok2 -Recurse -File -Force | Measure-Object).Count
      if($d2 -lt $dosyaSayisi){ Uyari "Ikinci kopyada $d2 dosya var, ilkinde $dosyaSayisi . EKSIK." }
      else { Tamam "ikinci kopya: $kok2 ($('{0:N0}' -f $d2) dosya)" }
    }
  }
} else {
  Bilgi '5/5 - Ikinci diske kopya'
  Write-Host "  (atlandi . ikinci disk icin: -IkinciHedef 'G:\')" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host " TAM PROJE YEDEGI ALINDI ve DOGRULANDI" -ForegroundColor Green
Write-Host " $kok"
Write-Host ""
Write-Host " !! VERITABANI BU YEDEKTE DEGIL." -ForegroundColor Yellow
Write-Host "    Stok, siparis, HACCP, denetim defteri Supabase'de duruyor."
Write-Host "    Onun yedegi: .\araclar\yedek-al.ps1  (docs/YEDEKLEME.md)"
Write-Host "===========================================================" -ForegroundColor Green
