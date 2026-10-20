# ===========================================================================
# MIYOP . kaydet.ps1 - testi kostur, gecerse kaydet
#
# NEDEN VAR: Claude her turda cok satirli bir PowerShell blogu veriyordu ve
# PowerShell o bloklari yapistirirken yarida kaliyordu. Artik her turun
# komutu TEK SATIR:
#
#     .\araclar\kaydet.ps1
#
# Commit mesaji araclar/commit-mesaji.txt dosyasindan okunur; Claude o
# dosyayi her turda yeniler. Panoya kopyalanacak dosya varsa yolu
# araclar/pano.txt icinde durur (yoksa pano islemi atlanir).
#
# !! TEST KIRMIZIYSA COMMIT YOK. Bu kural betigin varlik sebebidir.
#
# !! BU DOSYA BILEREK SADECE ASCII. Ilk surumu Turkce harfler ve kutu
# cizgileri iceriyordu; Windows PowerShell 5.1 BOM'suz UTF-8'i ANSI
# sanip cozuyor, cok baytli karakterler bozuluyor ve dosya
# "Missing closing '}'" ile parse edilemiyordu. Turkce aciklamalar
# bu betige DEGIL, docs/ altina yazilir.
# ===========================================================================
param(
  # Testi atlamak icin: .\araclar\kaydet.ps1 -TestiAtla
  # !! Yalniz testin az once yesil kostugunu BILDIGIN durumda kullan.
  [switch]$TestiAtla
)

$ErrorActionPreference = 'Stop'
$kok = Split-Path -Parent $PSScriptRoot
Set-Location $kok

if (-not $TestiAtla) {
  Write-Host "-- Testler kosuyor..." -ForegroundColor Cyan
  npm test
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "TESTLER KIRMIZI - commit YAPILMADI." -ForegroundColor Red
    exit 1
  }
}

$mesajYolu = Join-Path $PSScriptRoot 'commit-mesaji.txt'
if (-not (Test-Path $mesajYolu)) {
  Write-Host "araclar/commit-mesaji.txt yok - commit YAPILMADI." -ForegroundColor Red
  exit 1
}

$degisiklik = git status --porcelain
if ([string]::IsNullOrWhiteSpace($degisiklik)) {
  Write-Host "Kaydedilecek degisiklik yok." -ForegroundColor Yellow
} else {
  git add -A
  git commit -F $mesajYolu
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit basarisiz." -ForegroundColor Red
    exit 1
  }
}

Write-Host ""
git log --oneline -1

$panoYolu = Join-Path $PSScriptRoot 'pano.txt'
if (Test-Path $panoYolu) {
  $hedef = (Get-Content $panoYolu -Raw).Trim()
  if ($hedef -and (Test-Path (Join-Path $kok $hedef))) {
    Get-Content (Join-Path $kok $hedef) -Raw | Set-Clipboard
    Write-Host ""
    Write-Host "Panoya kopyalandi: $hedef" -ForegroundColor Green
  }
}
