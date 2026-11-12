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
  # !! 28.10.2026 - TIP DENETIMI BURAYA EKLENDI. Oncesinde HIC KOSMUYORDU.
  # Sahit Numune ekrani canlida "Bu ekran acilamadi" veriyordu; sebep
  # "ReferenceError: NUMUNE_SAYFA is not defined" idi - bir sabit kullanilmis
  # ama import edilmemisti. tsc bunu ilk derlemede yakalar; ama `npm test`
  # (vitest) ve `vite build` (esbuild) IKISI DE tip denetlemez. package.json
  # icindeki `typecheck` betigi duruyordu ve hicbir yerden cagrilmiyordu.
  # "Testler yesil" ile "kod derleniyor" AYRI IKI IDDIADIR.
  Write-Host "-- Tip denetimi kosuyor..." -ForegroundColor Cyan
  npm run typecheck
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "TIP DENETIMI KIRMIZI - commit YAPILMADI." -ForegroundColor Red
    Write-Host "Yukaridaki satirlar hangi dosyada ne eksik oldugunu yaziyor." -ForegroundColor Red
    exit 1
  }

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

# !! 12.11.2026 - MIYOP-110 (Codex 4. tur) - KAYDA NE GIRDIGI ARTIK GORULUYOR.
# Bu betik "git add -A" ile HER SEYI aliyor ve 10.11'den beri push da
# ediyor. Calisma agacinda makineye ozel bir dosya takipsiz duruyordu
# (.claude/settings.local.json); .gitignore onu kapsamiyordu ve bir sonraki
# kayitta GitHub'a gidecekti. Kimse kayda neyin girdigine bakmiyordu,
# cunku betik gostermiyordu.
#
# Uc kat:
#  1. .gitignore artik o dosyayi kapsiyor (asil onlem).
#  2. Dosya ONCEDEN takibe girmisse takipten cikariliyor. Diskten
#     SILINMEZ; yalniz depo onu izlemeyi birakir. (--ignore-unmatch:
#     takipte degilse hicbir sey yapmaz.)
#  3. Kayda girecek dosyalar LISTELENIYOR; makineye ozel ya da gizli
#     olabilecek bir ad gorulurse commit YAPILMIYOR.
#
# !! SINIRI: 2. adim dosyayi GECMIS commit'lerden silmez. Daha once push
# edildiyse orada durur; bunu bu betik duzeltemez.
git rm -r -q --cached --ignore-unmatch -- .claude/settings.local.json

$degisiklik = git status --porcelain
if ([string]::IsNullOrWhiteSpace($degisiklik)) {
  Write-Host "Kaydedilecek degisiklik yok." -ForegroundColor Yellow
} else {
  git add -A

  $adaylar = @(git diff --cached --name-only)
  # !! --diff-filter=d : SILINENLER yasak listesine girmez. Yukaridaki
  # "git rm --cached" o dosyayi takipten CIKARIYOR ve bu bir silme olarak
  # gorunur; onu da yasak saysaydik betik kendi duzeltmesini durdururdu
  # (12.11 olcumunde tam bu oldu).
  $eklenenler = @(git diff --cached --name-only --diff-filter=d)
  $yasaklar = @($eklenenler | Where-Object {
    $_ -match '(^|/)\.claude/.*\.local\.' -or
    $_ -match '(^|/)\.env$' -or
    $_ -match '(^|/)\.env\..*local$' -or
    $_ -match '\.pem$'
  })
  if ($yasaklar.Count -gt 0) {
    # Sahneyi geri al: hicbir sey commit edilmesin. Dosyalara DOKUNMAZ.
    git reset -q
    Write-Host ""
    Write-Host "KAYIT DURDURULDU - makineye ozel ya da gizli olabilecek dosya kayda giriyordu:" -ForegroundColor Red
    $yasaklar | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
    Write-Host "Hicbir sey commit EDILMEDI; dosyalar diskte duruyor." -ForegroundColor Red
    exit 1
  }

  Write-Host ""
  Write-Host ("-- Kayda giren dosyalar (" + $adaylar.Count + "):") -ForegroundColor Cyan
  git diff --cached --name-status

  git commit -F $mesajYolu
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit basarisiz." -ForegroundColor Red
    exit 1
  }
}

# !! 10.11.2026 - PUSH BURAYA EKLENDI. Oncesinde YOKTU.
# Iki tur ust uste commit alindi (60e6988, 74bee99) ve IKISI DE yalniz bu
# makinede kaldi. Betigin adi "kaydet" ama kaydettigi yer tek bir disk idi;
# o disk giderse is gider. Ayrica Codex depoyu GitHub uzerinden okuyor:
# push edilmemis bir commit, denetlenemeyen bir commit demek.
#
# !! Push basarisiz olursa betik DURMUYOR, sadece soyluyor. Commit zaten
# alindi; push bir aga bagli ve agin kopmasi commit'i gecersiz kilmaz.
# Ama SESSIZ gecmiyor - sessiz gecerse yine fark edilmez.
git push
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "PUSH BASARISIZ - commit YEREL kaldi." -ForegroundColor Red
  Write-Host "Sebebi yukarida yaziyor. El ile denemek icin: git push" -ForegroundColor Red
} else {
  Write-Host ""
  Write-Host "Push tamam - is GitHub'da." -ForegroundColor Green
}

Write-Host ""
git log --oneline -1
git status -sb

$panoYolu = Join-Path $PSScriptRoot 'pano.txt'
if (Test-Path $panoYolu) {
  $hedef = (Get-Content $panoYolu -Raw -Encoding UTF8).Trim()
  if ($hedef -and (Test-Path (Join-Path $kok $hedef))) {
    # !! -Encoding UTF8 SART. Windows PowerShell 5.1'de Get-Content, BOM'suz
    # bir UTF-8 dosyayi VARSAYILAN ANSI kod sayfasiyla (Turkce icin CP1254)
    # okur. Depodaki goc dosyalari BOM'suz UTF-8; sonuc olarak 'I' harfinin
    # iki bayti (C4 B0) 'A' ve derece isareti olarak cozuluyor ve panoya
    # BOZUK metin gidiyordu.
    #
    # 27.10.2026'da bu gercekten oldu: Emrah panodaki goc paketini Supabase'e
    # yapistirdi, butun Turkce karakterler bozuk gitti ve
    # app.kimlik_anahtari fonksiyonu YANLIS harfleri aramaya basladi (gercek
    # I/i yerine bozulmus iki karakteri). Hata mesajlari da okunamaz hale
    # geldi. Codex bunu MIYOP-079 olarak isaret etmisti; kok sebep buymus.
    #
    # !! Bu betigin en basindaki not ("PS 5.1 BOM'suz UTF-8'i ANSI sanip
    # cozuyor") tam bu tuzagi yaziyordu - ama uyari betigin KENDI
    # kodlamasi icin yazilmisti, OKUDUGU dosyalar icin degil. Yazili bir
    # uyari, uygulanmadigi yerde uyarmaz.
    Get-Content (Join-Path $kok $hedef) -Raw -Encoding UTF8 | Set-Clipboard
    Write-Host ""
    Write-Host "Panoya kopyalandi: $hedef" -ForegroundColor Green
  }
}
