# ===========================================================================
# MİYOP · SUNUCUYA YÜKLEME — HER GÜNCELLEMEDE ÇALIŞTIRILIR
#
#   Kendi bilgisayarında, PowerShell'de, PROJE KLASÖRÜNDE çalıştır:
#       .\miyop-yukle.ps1
#
#   Yapar: testleri koşar → derler → sunucuya kopyalar → doğrular
#
# ⚠️ Kaynak kod sunucuya GİTMEZ. Yalnız derlenmiş statik dosyalar gider.
#    Sunucuda Node, npm, git, Docker YOK — olmasına gerek de yok.
# ===========================================================================

$ErrorActionPreference = 'Stop'

$Alan    = 'miyop.emrahevren.com'
$Kok     = '/var/www/miyop'
$Anahtar = "$env:USERPROFILE\.ssh\miyop_hetzner"
$Hedef   = "root@$Alan"

function Bilgi($m){ Write-Host "`n> $m" -ForegroundColor Cyan }
function Tamam($m){ Write-Host "  [OK] $m" -ForegroundColor Green }
function Uyari($m){ Write-Host "  [!] $m" -ForegroundColor Yellow }
function Hata($m){ Write-Host "`n[HATA] $m" -ForegroundColor Red; exit 1 }

# ── 0 · Ön kontroller ─────────────────────────────────────────────────────
Bilgi '0/5 - On kontroller'

if(-not (Test-Path '.\package.json')){
  Hata 'package.json yok. Proje klasorunde degilsin. Once: cd C:\Users\90544\Documents\restaurant-adisyon'
}
Tamam 'Proje klasorundeyiz'

if(-not (Test-Path $Anahtar)){ Hata "SSH anahtari bulunamadi: $Anahtar" }
Tamam 'SSH anahtari var'

foreach($arac in @('ssh','scp')){
  if(-not (Get-Command $arac -ErrorAction SilentlyContinue)){
    Hata "$arac bulunamadi. Windows'ta OpenSSH istemcisi kurulu olmali (Ayarlar > Uygulamalar > Istege bagli ozellikler)."
  }
}
Tamam 'ssh ve scp hazir'

# ── 1 · Tip denetimi ve testler ───────────────────────────────────────────
# Kirmizi testle yayina cikilmaz. Bu adim bilerek atlanabilir degil.
#
# !! 28.10.2026 - TIP DENETIMI EKLENDI. Oncesinde bu hatta HIC KOSMUYORDU ve
# bedeli canliya gitti: Sahit Numune ekrani "Bu ekran acilamadi" veriyordu,
# sebep "ReferenceError: NUMUNE_SAYFA is not defined" - kullanilmis ama import
# edilmemis bir sabit. tsc bunu ilk derlemede yakalar; `npm test` (vitest) ve
# `vite build` (esbuild) IKISI DE tip denetlemez. Yani "1584 test yesil" ve
# "derleme basarili" cumlelerinin ikisi de dogruydu, kod ise CALISMIYORDU.
Bilgi '1/5 - Tip denetimi ve testler (1-2 dakika)'
npm run typecheck
if($LASTEXITCODE -ne 0){ Hata 'Tip denetimi kirmizi. Yayina cikilmiyor.' }
npm test
if($LASTEXITCODE -ne 0){ Hata 'Testler kirmizi. Yayina cikilmiyor.' }
Tamam 'Tip denetimi ve testler yesil'

# ── 2 · Derleme ───────────────────────────────────────────────────────────
Bilgi '2/5 - Uygulama derleniyor'
if(Test-Path '.\dist'){ Remove-Item -Recurse -Force '.\dist' }
npm run build
if($LASTEXITCODE -ne 0){ Hata 'Derleme basarisiz.' }
if(-not (Test-Path '.\dist\index.html')){ Hata 'dist\index.html olusmadi.' }

$Boyut = [math]::Round((Get-ChildItem -Recurse .\dist | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
$Adet  = (Get-ChildItem -Recurse -File .\dist).Count
Tamam "Derlendi: $Adet dosya, $Boyut MB"

# ── 3 · Yukleme ───────────────────────────────────────────────────────────
# Once GECICI bir klasore atiyoruz, sonra sunucuda tek hamlede yer
# degistiriyoruz. Boylece yukleme suresince site yarim kalmiyor.
Bilgi '3/5 - Sunucuya yukleniyor'

$Gecici = "/tmp/miyop-yeni-$(Get-Date -Format yyyyMMdd-HHmmss)"
ssh -i $Anahtar $Hedef "rm -rf $Gecici && mkdir -p $Gecici"
if($LASTEXITCODE -ne 0){ Hata 'Sunucuya baglanilamadi.' }

scp -i $Anahtar -q -r .\dist\* "${Hedef}:${Gecici}/"
if($LASTEXITCODE -ne 0){ Hata 'Dosyalar kopyalanamadi.' }
Tamam 'Dosyalar sunucuda (gecici klasorde)'

# ── 4 · Yerine koyma ──────────────────────────────────────────────────────
Bilgi '4/5 - Yayina aliniyor'

$Komut = @"
set -e
YEDEK="${Kok}.yedek-`$(date +%Y%m%d-%H%M%S)"
if [ -d "${Kok}" ]; then mv "${Kok}" "`$YEDEK"; fi
mv "${Gecici}" "${Kok}"
chown -R www-data:www-data "${Kok}"
find "${Kok}" -type d -exec chmod 755 {} +
find "${Kok}" -type f -exec chmod 644 {} +
nginx -t >/dev/null && systemctl reload nginx
echo "YEDEK=`$YEDEK"
# En eski yedekleri temizle, son YEDI tanesi kalsin.
# !! 31.10.2026 · UC'TEN YEDIYE CIKARILDI. Sebep: uc donus noktasinin ikisi
# ayni gune aitti; kotu bir dagitim bir gun sonra fark edilirse donulecek
# saglam surum kalmiyordu. Maliyeti OLCULDU: bir surum 8.49 MB (31 dosya),
# yani dort fazladan yedek ~34 MB. (Once "birkac yuz MB" demistim, olcmeden:
# tuzak 156.)
ls -1dt ${Kok}.yedek-* 2>/dev/null | tail -n +8 | xargs -r rm -rf
"@

$Cikti = ssh -i $Anahtar $Hedef $Komut
if($LASTEXITCODE -ne 0){ Hata 'Yerine koyma basarisiz. Site eski halinde kalmis olabilir.' }
$Yedek = ($Cikti | Select-String '^YEDEK=').ToString().Replace('YEDEK=','')
Tamam "Yayinda. Onceki surum: $Yedek"

# ── 5 · Dogrulama ─────────────────────────────────────────────────────────
Bilgi '5/5 - Dogrulama'

# !! 27.10.2026 - BU ADIM YALAN SOYLUYORDU.
# Eski hali `-SkipHttpErrorCheck` kullaniyordu; o parametre PowerShell 7+
# parametresidir ve Windows PowerShell 5.1'de YOKTUR. Invoke-WebRequest
# "boyle bir parametre yok" diye hata atiyor, catch onu yutup $k = 0
# yapiyordu. Yani uc kontrol de HER ZAMAN 0 donuyordu - site calissin ya da
# calismasin.
#
# !! Daha kotusu: catch "KONTROL EDEMEDIM" ile "SITE CALISMIYOR" arasindaki
# farki siliyordu. Ikisi de 0 goruluyordu ve betik hemen altinda "YAYINDA"
# yaziyordu. Kontrol edemeyen ama "yayinda" diyen bir betik, hic kontrol
# etmeyenden kotudur: ilkine guvenilir.
#
# Uc duzeltme:
#   1. PS 5.1 uyumlu cagri (-UseBasicParsing, SkipHttpErrorCheck YOK).
#      4xx/5xx'te Invoke-WebRequest istisna atar; durum kodu istisnanin
#      icinden okunur.
#   2. TLS 1.2 aciliyor. PS 5.1 varsayilani eski TLS surumleri olabiliyor ve
#      nginx onlari reddeder - bu da "baglanamadim" gibi gorunur.
#   3. HATA YUTULMUYOR: sebep yaziliyor ve sonuc SAYILIYOR. Dogrulama
#      gecmezse betik "YAYINDA" DEMIYOR.
[Net.ServicePointManager]::SecurityProtocol =
  [Net.SecurityProtocolType]::Tls12 -bor [Net.ServicePointManager]::SecurityProtocol

$script:DogrulamaGecen = 0
$script:DogrulamaToplam = 0

# !! 27.10.2026 - IKINCI DUZELTME: `$beklenen` TEK bir sayiydi ve assets
# kontrolu icin 403 istiyordu. nginx 404 dondurdu ve betik "DOGRULANAMADI"
# dedi - oysa dizin listesi KAPALIYDI; 404 da en az 403 kadar kapalidir
# (autoindex off, dizin index dosyasi olmadan servis edilmiyor).
# Yanlis alarm veren bir kontrol, hic kontrol etmemekten de kotudur: bir
# sonraki sefer GERCEK bir ariza da "her zamanki uyari" diye gecilir.
# Beklenen artik bir LISTE.
function Dene($yol, $beklenenler, $aciklama){
  $script:DogrulamaToplam++
  $k = $null
  $sebep = ''
  try{
    $y = Invoke-WebRequest -Uri "https://$Alan$yol" -MaximumRedirection 0 `
         -UseBasicParsing -TimeoutSec 20
    $k = [int]$y.StatusCode
  } catch {
    # 4xx/5xx burada gelir ve BU NORMALDIR (assets icin 403/404 bekliyoruz).
    $yanit = $_.Exception.Response
    if($yanit -and $yanit.StatusCode){
      $k = [int]$yanit.StatusCode
    } else {
      $sebep = $_.Exception.Message
    }
  }

  if($null -ne $k -and ($beklenenler -contains $k)){
    $script:DogrulamaGecen++
    Tamam "$aciklama ($k)"
  } elseif($null -eq $k){
    # !! "Kontrol edemedim" ayri bir sonuctur, 0 degil.
    Uyari "$aciklama -> KONTROL EDILEMEDI: $sebep"
  } else {
    Uyari "$aciklama -> $k (beklenen: $($beklenenler -join ' ya da '))"
  }
}

Dene '/'            @(200) 'Ana sayfa'
# Tek sayfa yonlendirmesi: bu adres sunucuda DOSYA olarak yok.
Dene '/depo'        @(200) 'Ic sayfa (tek sayfa yonlendirmesi)'
Dene '/assets/'     @(403, 404) 'assets dizin listesi kapali'

# !! EN ONEMLI KONTROL BURASI: YENI derlemenin kendi JS dosyasi sunucuda mi?
# Ust uc kontrol "bir site ayakta" der; bu kontrol "BU DAGITIM yayinda" der.
# Dosya adinda icerik ozeti var (index-XXXXXXXX.js), yani eski surum
# duruyorsa bu adres 404 doner ve yalan soylenemez.
# Betigin geri kalani gibi GORECELI yol: 0/5 adimi zaten proje klasorunde
# oldugumuzu dogruluyor.
if(Test-Path '.\dist\index.html'){
  # !! `-Encoding UTF8`: tuzak 130. Bu dosyayi yanlis cozersek adres de bozulur.
  $html = Get-Content '.\dist\index.html' -Raw -Encoding UTF8
  $e = [regex]::Match($html, '/assets/index-[A-Za-z0-9_-]+\.js')
  if($e.Success){
    Dene $e.Value @(200) "Yeni derlemenin JS dosyasi ($($e.Value))"
  } else {
    $script:DogrulamaToplam++
    Uyari "Yeni derlemenin JS dosyasi -> KONTROL EDILEMEDI: dist/index.html icinde adres bulunamadi"
  }
} else {
  $script:DogrulamaToplam++
  Uyari 'Yeni derlemenin JS dosyasi -> KONTROL EDILEMEDI: dist/index.html yok'
}

Write-Host ''
Write-Host '===========================================================' -ForegroundColor DarkGray
if($script:DogrulamaGecen -eq $script:DogrulamaToplam){
  Write-Host " YAYINDA ve DOGRULANDI ($script:DogrulamaGecen/$script:DogrulamaToplam): https://$Alan" -ForegroundColor Green
} else {
  # !! "Yayina alindi" ile "calisiyor" ayri iki iddia. Ikincisini
  # olcemediysek birincisini soyleyip susmak zorundayiz.
  Write-Host " DOSYALAR YAYINA ALINDI AMA DOGRULANAMADI ($script:DogrulamaGecen/$script:DogrulamaToplam)" -ForegroundColor Yellow
  Write-Host " Adresi tarayicidan KENDIN ac ve bak: https://$Alan" -ForegroundColor Yellow
  Write-Host " Yukaridaki satirlar neyin kontrol edilemedigini yaziyor." -ForegroundColor Yellow
}
Write-Host ''
Write-Host ' Bir sorun olursa onceki surume donus (sunucuda):' -ForegroundColor DarkGray
Write-Host "   rm -rf $Kok && mv $Yedek $Kok && systemctl reload nginx" -ForegroundColor DarkGray
Write-Host '===========================================================' -ForegroundColor DarkGray
