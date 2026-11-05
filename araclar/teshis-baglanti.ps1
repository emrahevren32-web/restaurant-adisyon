# ===========================================================================
# MIYOP . BAGLANTI TESHISI . "hangi Supabase projesi, gercekten cevap veriyor mu"
#
# Kullanim:
#     .\araclar\teshis-baglanti.ps1
#
# ---------------------------------------------------------------------------
# NEDEN BU BETIK VAR
# ---------------------------------------------------------------------------
# 05.11.2026: `npm test` icindeki `supabase.connection.test.ts` iki kosuda
# da 20 saniyede zaman asimina dustu ve commit'i engelledi. Yapilan iki
# olcum de SORUYU CEVAPLAMIYORDU:
#   . site (miyop.emrahevren.com) HTTP 200 . ama o DERLENMIS statik sayfa,
#     isteyi tarayici yapar; komut satirindan Supabase'e dokunulmadi;
#   . /auth/v1/health {"message":"No API key found"} dondu . yani GECIT
#     (Kong) ayakta, VERI API'si (rest/v1) hakkinda hicbir sey demiyor.
#
# ---------------------------------------------------------------------------
# !! VE BIR SEY DAHA: NPM TEST AYNI DOSYAYI OKUMUYOR
# ---------------------------------------------------------------------------
# Vite ortam dosyalarini KIPE gore yukler. `vitest` kipi `test`tir, yani
# okunan sira sudur:
#     .env  <  .env.local  <  .env.test  <  .env.test.local
# Sagdaki soldakini EZER. Bu depoda `.env.test.local` var (G7 canli
# testleri icin). Yani `npm test` sirasinda uygulamanin baglanacagi proje,
# `npm run dev` sirasinda baglanacagindan FARKLI olabilir.
# Bu betik o yuzden IKI dosyaya da bakar ve hangisinin hangi projeye
# isaret ettigini yazar.
#
# ---------------------------------------------------------------------------
# !! ANAHTAR SORULMAZ, YAZILMAZ, GOSTERILMEZ
# ---------------------------------------------------------------------------
# Degerler SENIN dosyalarindan okunur. Ekrana yalniz `_URL` ile biten
# degiskenlerin degeri yazilir; otekilerin yalniz KARAKTER SAYISI. Hicbir
# anahtar hicbir yere yazilmaz, yalniz kendi Supabase adresine gonderilir.
# ===========================================================================

$ErrorActionPreference = 'Continue'

function Bilgi($m){ Write-Host ""; Write-Host "> $m" -ForegroundColor Cyan }
function Tamam($m){ Write-Host "  [OK] $m" -ForegroundColor Green }
function Uyari($m){ Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Kotu($m){  Write-Host "  [X]  $m" -ForegroundColor Red }

$kokDizin = Split-Path -Parent $PSScriptRoot

# --- ortam dosyasini ADLARIYLA oku (deger gostermeden) ----------------------
function OrtamOku($dosyaAdi, $etiket){
  $yol = Join-Path $kokDizin $dosyaAdi
  Bilgi "$etiket  ($dosyaAdi)"
  if(-not (Test-Path $yol)){
    Uyari 'dosya yok'
    return @{}
  }
  $tablo = @{}
  $sira = 0
  foreach($satir in (Get-Content -LiteralPath $yol)){
    $sira += 1
    $kirpik = $satir.Trim()
    if($kirpik -eq '' -or $kirpik.StartsWith('#')){ continue }
    $yer = $kirpik.IndexOf('=')
    if($yer -lt 1){
      Uyari "satir $sira : icinde '=' yok, atlandi (uzunluk $($kirpik.Length))"
      continue
    }
    $ad = $kirpik.Substring(0, $yer).Trim()
    $deger = $kirpik.Substring($yer + 1).Trim()
    if($deger.StartsWith('"') -and $deger.EndsWith('"') -and $deger.Length -ge 2){
      $deger = $deger.Substring(1, $deger.Length - 2)
    }
    if($deger.StartsWith("'") -and $deger.EndsWith("'") -and $deger.Length -ge 2){
      $deger = $deger.Substring(1, $deger.Length - 2)
    }
    $tablo[$ad] = $deger
    if($ad.EndsWith('_URL')){
      Write-Host ("  {0,-32} {1}" -f $ad, $deger)
    } else {
      Write-Host ("  {0,-32} <{1} karakter . DEGER YAZILMIYOR>" -f $ad, $deger.Length)
    }
  }
  if($tablo.Count -eq 0){ Uyari 'icinde atama bulunamadi' }
  return $tablo
}

$yerel = OrtamOku '.env.local'      'UYGULAMA (npm run dev / derleme)'
$sinav = OrtamOku '.env.test.local' 'SINAMA (npm test BUNU oncelikli okur)'

# --- Vite'in npm test sirasinda gorecegi birlesim ---------------------------
$etkin = @{}
foreach($k in $yerel.Keys){ $etkin[$k] = $yerel[$k] }
foreach($k in $sinav.Keys){ $etkin[$k] = $sinav[$k] }

function ProjeKodu($adres){
  if($adres -match 'https://([a-z0-9]+)\.supabase\.co'){ return $Matches[1] }
  return '(cozulemedi)'
}

Bilgi 'NPM TEST sirasinda uygulama hangi projeye baglanir'
$testAdres   = ''
$testAnahtar = ''
if($etkin.ContainsKey('VITE_SUPABASE_URL')){ $testAdres = $etkin['VITE_SUPABASE_URL'] }
if($etkin.ContainsKey('VITE_SUPABASE_ANON_KEY')){ $testAnahtar = $etkin['VITE_SUPABASE_ANON_KEY'] }
if(-not $testAdres -or -not $testAnahtar){
  Kotu 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY birlesimde EKSIK'
  Write-Host '  Bu durumda isSupabaseConfigured() false olur ve testler ATLANIR.'
  Write-Host '  Ama senin kosumda testler atlanmadi, kosup zaman asimina dustu.'
  Write-Host '  Yani eksiklik bu betigin okumasinda; yukaridaki ad listesine bak.'
} else {
  Write-Host "  Proje : $(ProjeKodu $testAdres)   ($testAdres)"
  if($yerel.ContainsKey('VITE_SUPABASE_URL') -and $sinav.ContainsKey('VITE_SUPABASE_URL')){
    if($yerel['VITE_SUPABASE_URL'] -ne $sinav['VITE_SUPABASE_URL']){
      Uyari 'DIKKAT: npm test BASKA bir projeye baglaniyor (.env.test.local eziyor).'
    }
  }
}

# --- istek at ---------------------------------------------------------------
function Dene($ad, $adres, $anahtar, $yol){
  Bilgi $ad
  if(-not $adres){ Uyari 'adres yok, atlandi'; return }
  $kok = $adres.TrimEnd('/')
  $basliklar = @{}
  if($anahtar){ $basliklar = @{ apikey = $anahtar; Authorization = ('Bearer ' + $anahtar) } }
  $kronometre = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $cevap = Invoke-WebRequest -Uri ($kok + $yol) -Headers $basliklar -UseBasicParsing -TimeoutSec 25
    $kronometre.Stop()
    Tamam "HTTP $($cevap.StatusCode) . $([math]::Round($kronometre.Elapsed.TotalSeconds,1)) saniye"
    $govde = "$($cevap.Content)"
    if($govde.Length -gt 180){ $govde = $govde.Substring(0,180) + '...' }
    Write-Host "  Govde : $govde"
  } catch {
    $kronometre.Stop()
    $durum = ''
    if($_.Exception.Response){ $durum = "HTTP $([int]$_.Exception.Response.StatusCode) . " }
    Kotu "$durum$([math]::Round($kronometre.Elapsed.TotalSeconds,1)) saniye . $($_.Exception.Message)"
  }
}

$uygAdres = ''
$uygAnahtar = ''
if($yerel.ContainsKey('VITE_SUPABASE_URL')){ $uygAdres = $yerel['VITE_SUPABASE_URL'] }
if($yerel.ContainsKey('VITE_SUPABASE_ANON_KEY')){ $uygAnahtar = $yerel['VITE_SUPABASE_ANON_KEY'] }

Dene 'UYGULAMA projesi . uom okunuyor' $uygAdres $uygAnahtar '/rest/v1/uom?select=code&limit=1'
if($testAdres -and ($testAdres -ne $uygAdres)){
  Dene 'NPM TEST projesi . uom okunuyor' $testAdres $testAnahtar '/rest/v1/uom?select=code&limit=1'
} else {
  Bilgi 'NPM TEST projesi'
  Write-Host '  Uygulama projesiyle AYNI . ustteki olcum gecerli.'
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host " NASIL OKUNUR" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host " HTTP 200      : veri API'si CALISIYOR. Kirmizi testin sebebi ag ya"
Write-Host "                 da yerel kosum (vitest isci zaman asimlari . tuzak 152)."
Write-Host " HTTP 401/403  : anahtar gecerli degil . Supabase panelinde API Keys."
Write-Host " zaman asimi   : veri API'si cevap vermiyor . proje DURAKLATILMIS"
Write-Host "                 olabilir (ucretsiz projeler hareketsizlikte durur)."
Write-Host ""
Write-Host " !! Iki proje FARKLI cikarsa: npm test uygulamanin degil SINAMA" -ForegroundColor Yellow
Write-Host "    projesinin ayakta olmasini olcuyor demektir. O zaman kirmizi,"
Write-Host "    canli sistem hakkinda hicbir sey soylemiyor."
Write-Host "==========================================================="
