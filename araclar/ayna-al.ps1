# ===========================================================================
# MIYOP . CLAUDE ICIN TAM AYNA PAKETI
#
# Kullanim:
#     .\araclar\ayna-al.ps1
#
# ---------------------------------------------------------------------------
# NEDEN BU BETIK VAR . 01.11.2026 . TUZAK 164
# ---------------------------------------------------------------------------
# Claude depoyu kendi tarafina "sahneleyerek" (stage) okuyor. O kopya tek tek
# dosya istenerek buyuyor ve ZAMANLA EKSIK KALIYOR. 01.11.2026'da OLCULDU:
#
#     gercek  src\  : 913 dosya      sahnelenmis kopya: 104 dosya  (%11)
#     gercek  docs\ : (coklu klasor) sahnelenmis kopya:   7 dosya
#
# Eksik bir kopya uzerinde yapilan arama, OLCUM DEGIL TAHMINDIR:
#   * "src icinde hicbir yerde X yok" cumlesi, dosyanin %89'u orada
#     olmadigi icin otomatik olarak dogru cikar.
#   * grep bos donunce "temiz" sanilir. Tuzak 153/162 tam bu sinifdandi:
#     yanlis yerden okunan bir deger, dogru gibi raporlandi.
#
# Bu yuzden cozum "daha dikkatli ol" degil, ARACI DEGISTIRMEK: tek komutla
# TAKIP EDILEN butun dosyalardan olusan bir zip uretilir, Claude onu bir
# parcada alir ve acar. Eksiklik imkansiz hale gelir, cunku dosya listesini
# Claude degil GIT belirler.
#
# ---------------------------------------------------------------------------
# NE GIRER . NE GIRMEZ
# ---------------------------------------------------------------------------
# Girer   : `git ls-files` ne diyorsa. Yani depoda TAKIP EDILEN her dosya.
# Girmez  : node_modules, dist, .env* ve .gitignore'daki her sey . cunku
#           onlar takip edilmiyor. Ayri bir "haric tut" listesi TUTULMUYOR;
#           iki liste zamanla birbirinden ayrilir ve biri yalan soyler.
#
# !! .env.local BU PAKETE GIRMEZ (takip edilmiyor). Anahtarlar paketin
#    icinde tasinmaz. Betik ciktisinda bunu ayrica DOGRULAR ve sayar.
#
# ---------------------------------------------------------------------------
# PAKETIN ICINDEKI AYNA.txt
# ---------------------------------------------------------------------------
# Pakette bir kunye dosyasi vardir: hangi commit, hangi dal, kac dosya, hangi
# tarih. Claude once onu okur. Boylece "elimdeki kopya guncel mi" sorusu
# tahminle degil TEK SATIR OKUYARAK cevaplanir.
# ===========================================================================

param(
  [switch]$Ayrinti
)

$ErrorActionPreference = 'Stop'

function Bilgi($m){ Write-Host ""; Write-Host "> $m" -ForegroundColor Cyan }
function Tamam($m){ Write-Host "  [OK] $m" -ForegroundColor Green }
function Uyari($m){ Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Hata($m){ Write-Host ""; Write-Host "  [X]  $m" -ForegroundColor Red; Write-Host ""; exit 1 }

# ---------------------------------------------------------------------------
# !! TUZAK 158 . yerel komutun stderr'i hata demek DEGILDIR.
# `git` basari mesajlarini da stderr'e yazar. $ErrorActionPreference='Stop'
# ile birlesince betik BASARIDA oluyordu. Karar CIKIS KODUYLA verilir.
# ---------------------------------------------------------------------------
function GitCalistir {
  param([string[]]$Arguman)
  $eski = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $cikti = & git @Arguman 2>&1
  $kod = $LASTEXITCODE
  $ErrorActionPreference = $eski
  if($kod -ne 0){
    Hata ("git " + ($Arguman -join ' ') + " basarisiz (cikis kodu $kod): " + ($cikti -join ' '))
  }
  return $cikti
}

# --- 1 . depo kokune gec ----------------------------------------------------
$kok = Split-Path -Parent $PSScriptRoot
Set-Location $kok
if(-not (Test-Path (Join-Path $kok '.git'))){ Hata "Burada bir git deposu yok: $kok" }
Bilgi "Depo: $kok"

# --- 2 . takip edilen dosyalar ----------------------------------------------
$dosyalar = @(GitCalistir @('ls-files') | Where-Object { $_ -ne '' })
if($dosyalar.Count -eq 0){ Hata "git ls-files hic dosya dondurmedi." }
Tamam "$($dosyalar.Count) takip edilen dosya bulundu"

# !! Gizli dosya denetimi: takip listesinde .env benzeri bir sey varsa
#    paketi uretmeden DURURUZ. Parola/anahtar bir pakette dolasmaz.
# !! 01.11.2026 . ILK CALISTIRMADA BU KAPI YANLIS YERDE KAPANDI.
#    `.env.example` takip EDILIYOR ve EDILMELI: icinde anahtar degil
#    yer tutucu var, yeni makinede kurulum onsuz yapilamaz. Kapi onu da
#    gizli sayip paketi uretmedi. Dogru kural "adinda .env gecen her sey"
#    degil, "GERCEK degerleri tasiyan dosya"dir:
#       yasak  : .env  .env.local  .env.production  *.pem
#       serbest: .env.example  .env.sample  .env.template
#    Serbest birakilanlar SESSIZCE gecmez, ekrana adlariyla yazilir.
$sablonDeseni = '\.(example|sample|template)$'
$envBenzeri = @($dosyalar | Where-Object { $_ -match '(^|/)\.env($|\.)' -or $_ -match '\.pem$' })
$sablon     = @($envBenzeri | Where-Object { $_ -match $sablonDeseni })
$gizli      = @($envBenzeri | Where-Object { $_ -notmatch $sablonDeseni })
if($gizli.Count -gt 0){
  Hata ("Takip edilen dosyalar arasinda gizli dosya var, paket URETILMEDI: " + ($gizli -join ', '))
}
Tamam "Gercek anahtar dosyasi yok (.env / .env.local / *.pem takip edilmiyor)"
if($sablon.Count -gt 0){
  Uyari ("Sablon olarak pakete GIRIYOR: " + ($sablon -join ', '))
}

# --- 3 . kunye --------------------------------------------------------------
$head = (GitCalistir @('rev-parse','HEAD')) -join ''
$dal  = (GitCalistir @('rev-parse','--abbrev-ref','HEAD')) -join ''
$kirli = @(GitCalistir @('status','--porcelain') | Where-Object { $_ -ne '' })
$zaman = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

$klasorSayim = $dosyalar | ForEach-Object {
  if($_ -match '/'){ ($_ -split '/')[0] } else { '(kok)' }
} | Group-Object | Sort-Object Count -Descending

# --- 4 . gecici klasore kopyala ---------------------------------------------
$hedefKlasor = Join-Path $kok 'araclar\ayna'
$gecici      = Join-Path $hedefKlasor '_icerik'
if(Test-Path $gecici){ Remove-Item $gecici -Recurse -Force }
New-Item -ItemType Directory -Path $gecici -Force | Out-Null

$i = 0
$atlanan = @()
foreach($d in $dosyalar){
  $i++
  if($Ayrinti -and ($i % 200 -eq 0)){ Write-Host "     $i / $($dosyalar.Count)" }
  $kaynak = Join-Path $kok ($d -replace '/','\')
  if(-not (Test-Path -LiteralPath $kaynak)){ $atlanan += $d; continue }
  $varis = Join-Path $gecici ($d -replace '/','\')
  $varisKlasor = Split-Path -Parent $varis
  if(-not (Test-Path -LiteralPath $varisKlasor)){ New-Item -ItemType Directory -Path $varisKlasor -Force | Out-Null }
  Copy-Item -LiteralPath $kaynak -Destination $varis -Force
}
$kopyalanan = $dosyalar.Count - $atlanan.Count
Tamam "$kopyalanan dosya kopyalandi"
if($atlanan.Count -gt 0){
  # Takip ediliyor ama diskte yok . silinmis ama commit edilmemis demektir.
  Uyari "$($atlanan.Count) dosya diskte bulunamadi (takipte ama silinmis): $($atlanan -join ', ')"
}

# --- 5 . kunye dosyasini yaz ------------------------------------------------
$kunyeSatirlari = @(
  "MIYOP . AYNA PAKETI KUNYESI",
  "",
  "Uretildi      : $zaman",
  "Dal           : $dal",
  "HEAD          : $head",
  "Takip edilen  : $($dosyalar.Count) dosya",
  "Pakete giren  : $kopyalanan dosya",
  "Commit'siz degisiklik: $($kirli.Count) dosya",
  "",
  "Klasor dagilimi:"
)
foreach($g in $klasorSayim){ $kunyeSatirlari += ("  {0,-28} {1}" -f $g.Name, $g.Count) }
if($kirli.Count -gt 0){
  $kunyeSatirlari += @("", "!! Commit'lenmemis degisiklikler (git status --porcelain):")
  foreach($s in $kirli){ $kunyeSatirlari += "  $s" }
}
$kunyeSatirlari += @(
  "",
  "NOT . Bu paket git ls-files ile uretilmistir: icinde depoda TAKIP",
  "EDILEN her dosya vardir, takip edilmeyen hicbir dosya yoktur.",
  ".env* ve *.pem paketlenmeden ONCE denetlenir; bulunursa paket uretilmez."
)
$kunye = Join-Path $gecici 'AYNA.txt'
[System.IO.File]::WriteAllLines($kunye, $kunyeSatirlari, (New-Object System.Text.UTF8Encoding $false))
Tamam "AYNA.txt yazildi"

# --- 6 . zip ----------------------------------------------------------------
$zip = Join-Path $hedefKlasor 'ayna.zip'
if(Test-Path $zip){ Remove-Item $zip -Force }
Bilgi "Paketleniyor..."
# !! Compress-Archive DEGIL: PowerShell 5.1'de 1500 kucuk dosyada dakikalar
#    suruyor. .NET ayni isi saniyelerde yapar ve klasor yapisini korur.
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $gecici, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
if(-not (Test-Path $zip)){ Hata "Zip uretilemedi." }

# --- 7 . DOGRULAMA . paket gercekten acilir mi ve kac dosya var -------------
$arsiv = [System.IO.Compression.ZipFile]::OpenRead($zip)
$icerik = $arsiv.Entries.Count
$arsiv.Dispose()
if($icerik -lt $kopyalanan){
  Hata "Zip icinde $icerik girdi var, beklenen en az $kopyalanan. Paket GUVENILMEZ."
}
$mb = [math]::Round((Get-Item $zip).Length / 1MB, 2)

Remove-Item $gecici -Recurse -Force

Write-Host ""
Write-Host "  ===========================================================" -ForegroundColor Green
Write-Host "   AYNA PAKETI HAZIR" -ForegroundColor Green
Write-Host "  ===========================================================" -ForegroundColor Green
Write-Host "   Dosya   : $zip"
Write-Host "   Boyut   : $mb MB"
Write-Host "   Icerik  : $icerik girdi (acilip SAYILDI)"
Write-Host "   HEAD    : $head"
Write-Host "   Dal     : $dal"
if($kirli.Count -gt 0){
  Write-Host "   !! Commit'siz degisiklik: $($kirli.Count) dosya (pakete GUNCEL hali girdi)" -ForegroundColor Yellow
}
Write-Host ""
