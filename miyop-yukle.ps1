# ═══════════════════════════════════════════════════════════════════════════
# MİYOP · SUNUCUYA YÜKLEME — HER GÜNCELLEMEDE ÇALIŞTIRILIR
#
#   Kendi bilgisayarında, PowerShell'de, PROJE KLASÖRÜNDE çalıştır:
#       .\miyop-yukle.ps1
#
#   Yapar: testleri koşar → derler → sunucuya kopyalar → doğrular
#
# ⚠️ Kaynak kod sunucuya GİTMEZ. Yalnız derlenmiş statik dosyalar gider.
#    Sunucuda Node, npm, git, Docker YOK — olmasına gerek de yok.
# ═══════════════════════════════════════════════════════════════════════════

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

# ── 1 · Testler ───────────────────────────────────────────────────────────
# Kirmizi testle yayina cikilmaz. Bu adim bilerek atlanabilir degil.
Bilgi '1/5 - Testler kosuluyor (1-2 dakika)'
npm test
if($LASTEXITCODE -ne 0){ Hata 'Testler kirmizi. Yayina cikilmiyor.' }
Tamam 'Testler yesil'

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
# En eski yedekleri temizle, son uc tanesi kalsin.
ls -1dt ${Kok}.yedek-* 2>/dev/null | tail -n +4 | xargs -r rm -rf
"@

$Cikti = ssh -i $Anahtar $Hedef $Komut
if($LASTEXITCODE -ne 0){ Hata 'Yerine koyma basarisiz. Site eski halinde kalmis olabilir.' }
$Yedek = ($Cikti | Select-String '^YEDEK=').ToString().Replace('YEDEK=','')
Tamam "Yayinda. Onceki surum: $Yedek"

# ── 5 · Dogrulama ─────────────────────────────────────────────────────────
Bilgi '5/5 - Dogrulama'

function Dene($yol, $beklenen, $aciklama){
  try{
    $y = Invoke-WebRequest -Uri "https://$Alan$yol" -MaximumRedirection 0 -SkipHttpErrorCheck -TimeoutSec 20
    $k = [int]$y.StatusCode
  } catch { $k = 0 }
  if($k -eq $beklenen){ Tamam "$aciklama ($k)" } else { Uyari "$aciklama -> $k (beklenen $beklenen)" }
}

Dene '/'            200 'Ana sayfa'
# Tek sayfa yonlendirmesi: bu adres sunucuda DOSYA olarak yok.
Dene '/depo'        200 'Ic sayfa (tek sayfa yonlendirmesi)'
Dene '/assets/'     403 'assets dizin listesi kapali'

Write-Host ''
Write-Host '═══════════════════════════════════════════════════════════' -ForegroundColor DarkGray
Write-Host " YAYINDA: https://$Alan" -ForegroundColor Green
Write-Host ''
Write-Host ' Bir sorun olursa onceki surume donus (sunucuda):' -ForegroundColor DarkGray
Write-Host "   rm -rf $Kok && mv $Yedek $Kok && systemctl reload nginx" -ForegroundColor DarkGray
Write-Host '═══════════════════════════════════════════════════════════' -ForegroundColor DarkGray
