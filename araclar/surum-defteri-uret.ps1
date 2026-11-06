# ===========================================================================
# MIYOP . surum-defteri-uret.ps1 - surum gecmisini git'ten URETIR
#
#   .\araclar\surum-defteri-uret.ps1
#
# NEDEN VAR (06.11.2026):
# araclar/surum-gecmisi.txt ELLE surduruluyordu ve iki yonden bozulmustu:
#   1. METIN BOZUK. Satirlar "do-sru sat-r-" gibi okunuyordu: dosya UTF-8
#      metni yanlis kod sayfasiyla yazilmis. Bu depoda UCUNCU kez ayni
#      aile (tuzak 99 / MIYOP-079).
#   2. ALTI COMMIT EKSIK. Son satir 30.10 idi; 01.11-06.11 arasi hic
#      yazilmamisti.
#
# Dosyanin bicimi zaten "tarih | kisa-hash | baslik", yani git log
# ciktisinin birebir aynisi. Elle surdurulen bir kopyanin bayatlamasi
# kacinilmazdi; dogrusu onu URETMEK.
#
# !! BU DOSYA BILEREK SADECE ASCII (tuzak 99). Windows PowerShell 5.1
# BOM'suz UTF-8'i ANSI sanip cozuyor ve cok baytli karakterler bozuluyor.
# Turkce aciklamalar bu betige DEGIL, docs/ altina yazilir.
#
# !! YAZMA ISI .NET ILE YAPILIYOR, Out-File/Set-Content ILE DEGIL.
# Sorunu yaratan sey tam olarak PowerShell'in varsayilan kodlamasiydi;
# ayni araci ayni varsayilanla tekrar kullanmak hatayi geri getirirdi.
# ===========================================================================
$ErrorActionPreference = 'Stop'
$kok = Split-Path -Parent $PSScriptRoot
Set-Location $kok

$hedef = Join-Path $PSScriptRoot 'surum-gecmisi.txt'

# !! git'in kendi ciktisini UTF-8 olarak OKUMAK zorundayiz. PowerShell
# 5.1 harici program ciktisini konsol kod sayfasiyla cozer (Turkce'de
# CP857/CP1254) ve commit basliklarindaki Turkce harfler orada bozulur.
# Bozulma dosyaya yazarken degil, OKURKEN oluyordu.
$oncekiKodlama = [Console]::OutputEncoding
try {
  [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
  $satirlar = & git log --date=short --pretty=format:'%ad | %h | %s'
} finally {
  [Console]::OutputEncoding = $oncekiKodlama
}

if ($LASTEXITCODE -ne 0) { Write-Host 'git log calismadi.' -ForegroundColor Red; exit 1 }
if (-not $satirlar) { Write-Host 'git log bos dondu.' -ForegroundColor Red; exit 1 }

$metin = ($satirlar -join "`n") + "`n"
[IO.File]::WriteAllText($hedef, $metin, [Text.UTF8Encoding]::new($false))

# ---- DOGRULAMA ------------------------------------------------------------
# !! Yazdim demek yetmez; yazdigim seyin saglam oldugunu GOSTERMEM gerekiyor.
# Bu betigin varlik sebebi bozuk bir dosyaydi; dogrulamasiz bir uretici
# ayni bozuklugu sessizce geri getirebilirdi.
$geri = [IO.File]::ReadAllText($hedef, [Text.UTF8Encoding]::new($false))
$geriSatir = ($geri -split "`n" | Where-Object { $_ -ne '' }).Count
$beklenen = $satirlar.Count

if ($geriSatir -ne $beklenen) {
  Write-Host "DOGRULAMA BASARISIZ: $beklenen satir bekleniyordu, $geriSatir yazildi." -ForegroundColor Red
  exit 1
}

# ---- Bozulma imzasi 1: U+FFFD (degistirme karakteri) ----
# !! KOD NOKTASI SAYIYLA YAZILIYOR. Ters tirnak + u soz dizimi PowerShell
# 6 ile geldi; 5.1'de o gecerli bir kacis DEGIL ve dizge sessizce duz
# metne donusurdu - yani kontrol hic calismazdi. Calismayan bir kontrol,
# olmayan bir kontrolden kotudur: yesil gorunur.
if ($geri.IndexOf([char]0xFFFD) -ge 0) {
  Write-Host 'DOGRULAMA BASARISIZ: dosyada cozulemeyen karakter var.' -ForegroundColor Red
  exit 1
}

# ---- Bozulma imzasi 2: kutu cizgi karakterleri (U+2500-U+259F) ----
# Eski bozuk dosyada Turkce harfler kutu cizgisi + isaret ciftlerine
# donusmustu. Bir commit basliginda kutu cizgisi ASLA bulunmaz, yani bu
# aralik gorunuyorsa kodlama yine bozulmus demektir.
# !! Desen ASCII olarak yaziliyor: bozuk karakterleri betigin ICINE
# ornek diye koymak, betigin kendisini ASCII olmaktan cikarirdi (tuzak 99)
# - yani kontrolun kendisi, kontrol ettigi hatayi tasirdi.
$bozuk = $geri.ToCharArray() | Where-Object { [int]$_ -ge 0x2500 -and [int]$_ -le 0x259F }
if ($bozuk) {
  Write-Host 'DOGRULAMA BASARISIZ: eski bozulma deseni hala var.' -ForegroundColor Red
  exit 1
}

Write-Host "Surum defteri uretildi: $beklenen satir" -ForegroundColor Green
Write-Host "En yeni: $($satirlar[0])" -ForegroundColor DarkGray
Write-Host "En eski: $($satirlar[$satirlar.Count - 1])" -ForegroundColor DarkGray

# Turkce harf gercekten saglam mi: iceren bir satir varsa goster.
$ornek = $satirlar | Where-Object { $_ -match '[^\x00-\x7F]' } | Select-Object -First 1
if ($ornek) {
  Write-Host "Turkce ornek satir: $ornek" -ForegroundColor DarkGray
} else {
  Write-Host 'Uyari: Turkce karakter iceren satir bulunamadi; kontrol edilemedi.' -ForegroundColor Yellow
}
