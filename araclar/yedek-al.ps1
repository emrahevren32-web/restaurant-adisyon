# ===========================================================================
# MIYOP . VERITABANI YEDEGI ALIR
#
# Kullanim:
#     .\araclar\yedek-al.ps1
#
# ---------------------------------------------------------------------------
# NEDEN BU BETIK VAR
# ---------------------------------------------------------------------------
# Supabase FREE planinda OTOMATIK VERITABANI YEDEGI YOKTUR. Supabase'in kendi
# belgesi aynen soyle diyor:
#   "Automatic backups - Not included in free"
#   "We recommend that free tier plan projects regularly export their data
#    using the Supabase CLI db dump command and maintain off-site backups."
# Kaynak: https://supabase.com/docs/guides/platform/backups  (30.10.2026)
#
# Karar (Emrah, 30.10.2026): Pro plan ($25/ay) ILK MUSTERIDEN SONRA.
#   "pro icin erken, ilk musteri ile anlasalim o zaman yedekler konusunda
#    bakariz. 25 dolar az degil simdi."
# Yani bu betik gecici bir cozum degil, SU ANKI TEK yedegimizdir.
#
# ---------------------------------------------------------------------------
# !! UC AYRI DOSYA ALINIYOR VE SEBEBI SUDUR
# ---------------------------------------------------------------------------
# `supabase db dump` VARSAYILAN HALIYLE VERIYI ALMAZ. Belgenin kendi cumlesi:
#   "The default dump does not contain any data or custom roles."
# Yani tek basina calistirilsaydi elimizde SEMA dosyasi olurdu: tablolarin
# tanimi, ama iclerinde TEK SATIR VERI OLMADAN. O dosyaya bakip "yedegim var"
# demek, tam olarak 13.09.2026'da menuden kaldirilan eski "Yedekleme"
# dugmesinin yaptigi seydir (tarayici hafizasini yedekliyordu, is verisini
# degil). Yedegi oldugunu sanip olmamak, hic yedek almamaktan tehlikelidir.
#
#   1. sema   : tablolar, kisitlar, tetikleyiciler, fonksiyonlar
#   2. VERI   : --data-only . stok, siparis, HACCP, denetim defteri
#   3. roller : --role-only . veritabani rolleri
#
# ---------------------------------------------------------------------------
# !! BU YEDEGIN KAPSAMADIGI SEYLER . OKUMADAN GECME
# ---------------------------------------------------------------------------
# * GIRIS HESAPLARI YOK. Supabase belgesi: "The ignored schemas include auth,
#   storage, and those created by extensions." Yani `auth.users` tablosu, yani
#   kimin hangi e-posta/sifreyle girdigi BU DOSYALARDA DEGIL. Geri yuklemede
#   is verisi doner, kullanicilarin yeniden davet edilmesi gerekir.
# * DOSYALAR (Storage) YOK. Belge: veritabani yedegi Storage nesnelerini
#   icermez, yalniz ustverisini icerir.
# * Bu bir FELAKET KURTARMA plani degildir; disari alinmis bir kopyadir.
#   Geri yukleme ELLE ve KAYIT ALTINDA yapilir (docs/YEDEKLEME.md).
# ===========================================================================

param(
  [string]$Klasor   = '',
  [string]$ProjeRef = ''
)

$ErrorActionPreference = 'Stop'

function Bilgi($m){ Write-Host ""; Write-Host "> $m" -ForegroundColor Cyan }
function Tamam($m){ Write-Host "  [OK] $m" -ForegroundColor Green }
function Uyari($m){ Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Hata($m){ Write-Host ""; Write-Host "  [X]  $m" -ForegroundColor Red; Write-Host ""; exit 1 }

# -- 0 . On kontroller ------------------------------------------------------
Bilgi '0/5 - On kontroller'

if(-not (Test-Path 'package.json')){
  Hata 'Proje klasorunde degilsin. Once: cd C:\Users\90544\Documents\restaurant-adisyon'
}
Tamam 'Proje klasorundeyiz'

# Node 20+ sarti Supabase CLI'nin kendi belgesinde yaziyor.
try { $nodeSurum = (node --version) } catch { $nodeSurum = '' }
if(-not $nodeSurum){ Hata 'node bulunamadi.' }
$nodeBuyuk = [int]($nodeSurum -replace '^v(\d+)\..*$','$1')
if($nodeBuyuk -lt 20){
  Hata "Supabase CLI Node 20 veya ustunu istiyor; sende $nodeSurum var."
}
Tamam "node $nodeSurum"

# -- 1 . CLI var mi ---------------------------------------------------------
Bilgi '1/5 - Supabase CLI'

$cliSurum = ''
try { $cliSurum = (npx --no-install supabase --version 2>$null) } catch { $cliSurum = '' }

if(-not $cliSurum){
  Write-Host ""
  Write-Host "  Supabase CLI bu projede kurulu degil." -ForegroundColor Yellow
  Write-Host "  Resmi yol (belgenin kendi komutu, projeye ozel kurulum):" -ForegroundColor Gray
  Write-Host ""
  Write-Host "      npm install supabase --save-dev" -ForegroundColor White
  Write-Host ""
  Write-Host "  Sonra bu betigi tekrar calistir." -ForegroundColor Gray
  Hata 'CLI yok; yedek ALINAMADI.'
}
Tamam "supabase CLI $cliSurum"

# -- 2 . Proje baglantisi ---------------------------------------------------
Bilgi '2/5 - Proje baglantisi'

if(-not $ProjeRef){
  if(Test-Path '.env.local'){
    # !! YALNIZ URL satiri okunuyor. Anon anahtar OKUNMUYOR, YAZILMIYOR.
    $satir = Select-String -Path '.env.local' -Pattern '^\s*VITE_SUPABASE_URL\s*=' |
             Select-Object -First 1
    if($satir){
      $deger = ($satir.Line -split '=',2)[1].Trim()
      if($deger -match 'https://([a-z0-9]+)\.supabase\.co'){ $ProjeRef = $Matches[1] }
    }
  }
}
if(-not $ProjeRef){
  Hata 'Proje referansi bulunamadi. .env.local icinde VITE_SUPABASE_URL yok. Elle ver: .\araclar\yedek-al.ps1 -ProjeRef xxxx'
}
Tamam "proje referansi: $ProjeRef"

if(-not (Test-Path 'supabase\.temp\project-ref')){
  Write-Host ""
  Write-Host "  Proje HENUZ BAGLANMAMIS. Bunlar BIR KEZ calistirilir:" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "      npx supabase login" -ForegroundColor White
  Write-Host "      npx supabase link --project-ref $ProjeRef" -ForegroundColor White
  Write-Host ""
  Write-Host "  !! `link` veritabani parolasini SORAR. Parolayi sen yazarsin;" -ForegroundColor Gray
  Write-Host "     bu betik parolayi ne ister ne saklar." -ForegroundColor Gray
  Write-Host ""
  Hata 'Baglanti yok; yedek ALINAMADI.'
}
Tamam 'proje bagli'

# -- 3 . Hedef klasor -------------------------------------------------------
Bilgi '3/5 - Hedef klasor'

if(-not $Klasor){
  if(Test-Path 'F:\'){ $Klasor = 'F:\MIYOP_BACKUP\veritabani' }
  else { $Klasor = Join-Path $env:USERPROFILE 'MIYOP-Yedek' }
}
# !! YEDEK DEPOYA YAZILMAZ. Icinde musteri verisi var; git'e girmemeli.
$tam = (Resolve-Path -LiteralPath '.').Path
if($Klasor.StartsWith($tam, [StringComparison]::OrdinalIgnoreCase)){
  Hata "Hedef klasor proje klasorunun ICINDE ($Klasor). Yedek dosyasinda musteri verisi var; depoya girmemeli."
}
New-Item -ItemType Directory -Force -Path $Klasor | Out-Null
$damga  = Get-Date -Format 'yyyyMMdd-HHmmss'
$kok    = Join-Path $Klasor $damga
New-Item -ItemType Directory -Force -Path $kok | Out-Null
Tamam "hedef: $kok"

# -- 4 . Uc dokum -----------------------------------------------------------
Bilgi '4/5 - Dokum aliniyor (parola SORULABILIR; onu sen yazarsin)'

$semaDosya  = Join-Path $kok 'sema.sql'
$veriDosya  = Join-Path $kok 'veri.sql'
$rolDosya   = Join-Path $kok 'roller.sql'

Write-Host "  1/3 sema..." -ForegroundColor Gray
npx supabase db dump --linked -f "$semaDosya"
if($LASTEXITCODE -ne 0){ Hata 'Sema dokumu basarisiz. Yedek ALINAMADI.' }

Write-Host "  2/3 VERI..." -ForegroundColor Gray
npx supabase db dump --linked --data-only --use-copy -f "$veriDosya"
if($LASTEXITCODE -ne 0){ Hata 'VERI dokumu basarisiz. Yedek ALINAMADI (sema tek basina yedek degildir).' }

Write-Host "  3/3 roller..." -ForegroundColor Gray
npx supabase db dump --linked --role-only -f "$rolDosya"
if($LASTEXITCODE -ne 0){ Uyari 'Rol dokumu basarisiz. Sema ve veri alindi; roller EKSIK.' }

# -- 5 . Dogrulama . "aldim" demeden ONCE olcuyoruz -------------------------
Bilgi '5/5 - Dogrulama'

# !! BU BOLUM BETIGIN EN ONEMLI KISMI.
# Dosyanin olusmasi, icinde veri oldugu anlamina gelmez. Bos ya da yalniz
# baslik satirlari tasiyan bir "veri.sql", yedegi oldugunu sanmanin ta
# kendisidir. Bu yuzden dosyanin ICINE bakiyoruz.
function Olc($yol, $ad){
  if(-not (Test-Path $yol)){ return $null }
  $b = (Get-Item $yol).Length
  Write-Host ("  {0,-8} {1,10:N0} bayt" -f $ad, $b)
  return $b
}
$semaBayt = Olc $semaDosya 'sema'
$veriBayt = Olc $veriDosya 'veri'
$rolBayt  = Olc $rolDosya  'roller'

if(-not $semaBayt -or $semaBayt -lt 1000){
  Hata 'Sema dosyasi yok ya da sasirtici kadar kucuk. BU BIR YEDEK DEGILDIR.'
}

$veriSatir = 0
if($veriBayt){
  $veriSatir = (Select-String -Path $veriDosya -Pattern '^(COPY |INSERT INTO )' -AllMatches |
                Measure-Object).Count
}
Write-Host "  veri dosyasindaki COPY/INSERT satiri: $veriSatir" -ForegroundColor Gray

if($veriSatir -lt 1){
  Write-Host ""
  Write-Host "  VERI DOSYASINDA TEK BIR KAYIT YOK." -ForegroundColor Red
  Write-Host "  Veritabani gercekten bossa bu dogrudur. Degilse dokum" -ForegroundColor Red
  Write-Host "  calismamistir ve bu dosyalar YEDEK DEGILDIR." -ForegroundColor Red
  Hata 'Dogrulama gecmedi.'
}

# Denetim defteri burada mi? Canliya cikmis bir sistemde orasi hep doludur;
# yoksa dokum yanlis semayi almistir.
$denetimVar = (Select-String -Path $veriDosya -Pattern 'audit_log' -List) -ne $null
if($denetimVar){ Tamam 'denetim defteri (audit_log) dokumde gorunuyor' }
else { Uyari 'audit_log dokumde GORUNMUYOR . dokumun kapsamini kontrol et' }

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host " YEDEK ALINDI ve DOGRULANDI" -ForegroundColor Green
Write-Host " $kok"
Write-Host ""
Write-Host " ICINDE OLMAYANLAR (bilerek):" -ForegroundColor Yellow
Write-Host "   - giris hesaplari (auth semasi dokume girmez)"
Write-Host "   - yuklenen dosyalar (Storage)"
Write-Host " Geri yukleme: docs/YEDEKLEME.md" -ForegroundColor Gray
Write-Host "===========================================================" -ForegroundColor Green
