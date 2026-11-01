# ===========================================================================
# MIYOP . VERITABANI YEDEGI ALIR
#
# Kullanim:
#     .\araclar\yedek-al.ps1
#
# ---------------------------------------------------------------------------
# NEDEN BU BETIK VAR
# ---------------------------------------------------------------------------
# Supabase FREE planinda OTOMATIK VERITABANI YEDEGI YOKTUR:
#   "Automatic backups - Not included in free"
#   "We recommend that free tier plan projects regularly export their data
#    using the Supabase CLI db dump command and maintain off-site backups."
# Kaynak: https://supabase.com/docs/guides/platform/backups  (30.10.2026)
#
# Karar (Emrah, 30.10.2026): Pro plan ($25/ay) ILK MUSTERIDEN SONRA.
# Yani bu betik gecici bir cozum degil, SU ANKI TEK veri yedegimizdir.
#
# ---------------------------------------------------------------------------
# !! UC AYRI DOSYA ALINIYOR VE SEBEBI SUDUR
# ---------------------------------------------------------------------------
# `supabase db dump` VARSAYILAN HALIYLE VERIYI ALMAZ. Belgenin cumlesi:
#   "The default dump does not contain any data or custom roles."
# Tek basina calistirilsaydi elimizde SEMA dosyasi olurdu: tablolarin tanimi,
# iclerinde TEK SATIR VERI OLMADAN. O dosyaya bakip "yedegim var" demek,
# 13.09.2026'da menuden kaldirilan eski "Yedekleme" dugmesinin yaptigi seyin
# aynisidir (tarayici hafizasini yedekliyordu, is verisini degil).
#
#   1. sema   : tablolar, kisitlar, tetikleyiciler, fonksiyonlar
#   2. VERI   : stok, siparis, HACCP, denetim defteri
#   3. roller : veritabani rolleri (yalniz CLI yolunda)
#
# ---------------------------------------------------------------------------
# IKI YOL VAR . betik hangisi varsa onu kullanir
# ---------------------------------------------------------------------------
#   A) pg_dump (yerel)  . Docker GEREKMEZ. Sunucu PostgreSQL 17.6 oldugu icin
#                         pg_dump da 17 ya da ustu olmali (eski pg_dump yeni
#                         sunucudan dokum ALMAZ, hata verir).
#   B) supabase CLI     . pg_dump'i KAPSAYICI icinde calistirir, yani
#                         Docker Desktop ya da Podman ister.
#
# !! 30.10.2026 . ilk denemede B yolu "docker: command not found" verdi.
#    Belge bunu zaten yaziyordu ("Runs pg_dump in a container") ama ben
#    okudugum halde Emrah'a soylemedim. Betik artik ONCE olcuyor.
#
# ---------------------------------------------------------------------------
# !! BU YEDEGIN KAPSAMADIGI SEYLER . OKUMADAN GECME
# ---------------------------------------------------------------------------
# * GIRIS HESAPLARI YOK. `auth` semasi dokume girmez: kimin hangi
#   e-posta/sifreyle girdigi BU DOSYALARDA DEGIL. Geri yuklemede is verisi
#   doner, kullanicilarin yeniden acilmasi gerekir.
# * DOSYALAR (Storage) YOK.
# * Bu bir FELAKET KURTARMA plani degildir; disari alinmis bir kopyadir.
#   Geri yukleme ELLE ve KAYIT ALTINDA yapilir (docs/YEDEKLEME.md).
# ===========================================================================

param(
  [string]$Klasor   = '',
  [string]$ProjeRef = '',
  [ValidateSet('otomatik','pgdump','cli')]
  [string]$Yol      = 'otomatik'
)

$ErrorActionPreference = 'Stop'

function Bilgi($m){ Write-Host ""; Write-Host "> $m" -ForegroundColor Cyan }
function Tamam($m){ Write-Host "  [OK] $m" -ForegroundColor Green }
function Uyari($m){ Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Hata($m){ Write-Host ""; Write-Host "  [X]  $m" -ForegroundColor Red; Write-Host ""; exit 1 }
function Var($ad){ return [bool](Get-Command $ad -ErrorAction SilentlyContinue) }

# Sunucunun surumu . `supabase link` bunu diske yaziyor, tahmin etmiyoruz.
$SUNUCU_SURUM = ''
if(Test-Path 'supabase\.temp\postgres-version'){
  $SUNUCU_SURUM = (Get-Content 'supabase\.temp\postgres-version' -Raw).Trim()
}

# -- 0 . On kontroller ------------------------------------------------------
Bilgi '0/6 - On kontroller'

if(-not (Test-Path 'package.json')){
  Hata 'Proje klasorunde degilsin. Once: cd C:\Users\90544\Documents\restaurant-adisyon'
}
Tamam 'Proje klasorundeyiz'

if(-not $ProjeRef){
  if(Test-Path 'supabase\.temp\project-ref'){
    $ProjeRef = (Get-Content 'supabase\.temp\project-ref' -Raw).Trim()
  }
}
if(-not $ProjeRef -and (Test-Path '.env.local')){
  # !! YALNIZ URL satiri okunuyor. Anon anahtar OKUNMUYOR, YAZILMIYOR.
  $satir = Select-String -Path '.env.local' -Pattern '^\s*VITE_SUPABASE_URL\s*=' | Select-Object -First 1
  if($satir){
    $deger = ($satir.Line -split '=',2)[1].Trim()
    if($deger -match 'https://([a-z0-9]+)\.supabase\.co'){ $ProjeRef = $Matches[1] }
  }
}
if(-not $ProjeRef){ Hata 'Proje referansi bulunamadi. Elle ver: -ProjeRef xxxx' }
Tamam "proje referansi: $ProjeRef"
if($SUNUCU_SURUM){ Tamam "sunucu PostgreSQL $SUNUCU_SURUM" }

# -- 1 . Hangi yol -----------------------------------------------------------
Bilgi '1/6 - Hangi yolla dokum alinacak'

# !! pg_dump YALNIZ PATH'TE ARANMAZ.
# PostgreSQL'in Windows yukleyicisi `bin` klasorunu PATH'e EKLEMEYEBILIR.
# "kurdum ama betik bulmuyor" tam bu yuzden olur. Once PATH, sonra
# standart kurulum yeri; birden fazla surum varsa EN YENISI secilir.
$pgYol   = ''
$pgBuyuk = 0
$pgSurum = ''

$bulunan = Get-Command 'pg_dump' -ErrorAction SilentlyContinue
if($bulunan){ $pgYol = $bulunan.Source }

if(-not $pgYol){
  $adaylar = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -ErrorAction SilentlyContinue
  if($adaylar){
    $pgYol = ($adaylar | Sort-Object { [int]($_.Directory.Parent.Name) } -Descending |
              Select-Object -First 1).FullName
  }
}

if($pgYol){
  $pgSurum = (& $pgYol --version) 2>$null
  if($pgSurum -match '(\d+)\.'){ $pgBuyuk = [int]$Matches[1] }
  Tamam "pg_dump bulundu: $pgSurum"
  Write-Host "  ($pgYol)" -ForegroundColor DarkGray
} else {
  Write-Host "  pg_dump yok (PATH'te de, C:\Program Files\PostgreSQL altinda da)" -ForegroundColor DarkGray
}
$pgVar = [bool]$pgYol

$dockerVar = (Var 'docker') -or (Var 'podman')
if($dockerVar){ Tamam 'docker/podman bulundu' } else { Write-Host "  docker/podman yok" -ForegroundColor DarkGray }

# Sunucu 17 ise pg_dump da 17+ olmali.
$sunucuBuyuk = 0
if($SUNUCU_SURUM -match '^(\d+)\.'){ $sunucuBuyuk = [int]$Matches[1] }
$pgUygun = ($pgBuyuk -gt 0 -and $pgBuyuk -ge $sunucuBuyuk)
# !! YON ONEMLI, OLCULDU (PostgreSQL 18 belgesi, app-pgdump):
#   "pg_dump can also dump from PostgreSQL servers older than its own
#    version. (Currently, servers back to version 9.2 are supported.)
#    However, pg_dump cannot dump from PostgreSQL servers newer than its
#    own major version; it will refuse to even try."
# Yani pg_dump SUNUCUDAN YENI olabilir (18 > 17 sorun degil), ESKI olamaz.
if($pgVar -and -not $pgUygun){
  Uyari "pg_dump $pgBuyuk, sunucu $sunucuBuyuk . ESKI pg_dump YENI sunucudan dokum ALAMAZ (denemeyi bile reddeder)."
}

$secilen = ''
switch($Yol){
  'pgdump' { $secilen = 'pgdump' }
  'cli'    { $secilen = 'cli' }
  default  {
    if($pgUygun){ $secilen = 'pgdump' }
    elseif($dockerVar){ $secilen = 'cli' }
  }
}

if(-not $secilen){
  Write-Host ""
  Write-Host "  YEDEK ALINAMIYOR . iki yoldan biri gerekli:" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  A) pg_dump $sunucuBuyuk ya da ustu (Docker GEREKMEZ, onerilen)" -ForegroundColor White
  Write-Host "     https://www.postgresql.org/download/windows/ . yukleyiciyi indir." -ForegroundColor Gray
  Write-Host "     Bilesen ekraninda YALNIZ 'Command Line Tools' isaretli kalsin:" -ForegroundColor Gray
  Write-Host "     PostgreSQL Server, pgAdmin ve Stack Builder'in isaretini KALDIR." -ForegroundColor Gray
  Write-Host "     Sunucu kurmuyoruz; yalniz dokum araci lazim." -ForegroundColor Gray
  Write-Host "     PATH'e eklemesen de olur: betik C:\Program Files\PostgreSQL" -ForegroundColor Gray
  Write-Host "     altina da bakiyor." -ForegroundColor Gray
  Write-Host ""
  Write-Host "  B) Docker Desktop ya da Podman" -ForegroundColor White
  Write-Host "     supabase CLI pg_dump'i kapsayici icinde calistiriyor." -ForegroundColor Gray
  Write-Host ""
  Write-Host "  !! ARADA NE YAPILIR: uygulamadaki Ayarlar > Veri ve Yedekleme" -ForegroundColor Yellow
  Write-Host "     ekrani is verisini Excel olarak indiriyor. O bir GERI" -ForegroundColor Gray
  Write-Host "     YUKLENEBILIR yedek DEGILDIR ama veriyi disari alir." -ForegroundColor Gray
  Write-Host ""
  Hata 'Arac yok; yedek ALINAMADI.'
}
Tamam "secilen yol: $secilen"

# -- 2 . CLI yolu icin baglanti ----------------------------------------------
if($secilen -eq 'cli'){
  Bilgi '2/6 - Proje baglantisi (CLI yolu)'
  $cliSurum = ''
  try { $cliSurum = (npx --no-install supabase --version 2>$null) } catch { $cliSurum = '' }
  if(-not $cliSurum){
    Hata 'supabase CLI bu projede kurulu degil. Once: npm install supabase --save-dev'
  }
  Tamam "supabase CLI $cliSurum"
  if(-not (Test-Path 'supabase\.temp\project-ref')){
    Write-Host ""
    Write-Host "  Proje HENUZ BAGLANMAMIS. Bunlar BIR KEZ calistirilir:" -ForegroundColor Yellow
    Write-Host "      npx supabase login" -ForegroundColor White
    Write-Host "      npx supabase link --project-ref $ProjeRef" -ForegroundColor White
    Write-Host ""
    Hata 'Baglanti yok; yedek ALINAMADI.'
  }
  Tamam 'proje bagli'
} else {
  Bilgi '2/6 - Baglanti bilgisi (pg_dump yolu)'
  Tamam 'pg_dump dogrudan baglanacak . parolayi SEN yazacaksin'
}

# -- 3 . Hedef klasor -------------------------------------------------------
Bilgi '3/6 - Hedef klasor'

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
$damga = Get-Date -Format 'yyyyMMdd-HHmmss'
$kok   = Join-Path $Klasor $damga
New-Item -ItemType Directory -Force -Path $kok | Out-Null
Tamam "hedef: $kok"

$semaDosya = Join-Path $kok 'sema.sql'
$veriDosya = Join-Path $kok 'veri.sql'
$rolDosya  = Join-Path $kok 'roller.sql'
$tamDosya  = Join-Path $kok 'tam.dump'

# -- 4 . Dokum --------------------------------------------------------------
Bilgi '4/6 - Dokum aliniyor (PAROLA SORULACAK; onu sen yazarsin)'

if($secilen -eq 'pgdump'){
  # Havuz (pooler) uzerinden baglanti. Kullanici adi havuzda
  # `postgres.<proje-ref>` bicimindedir.
  $sunucu = 'aws-0-eu-central-1.pooler.supabase.com'
  if(Test-Path 'supabase\.temp\pooler-url'){
    $ham = (Get-Content 'supabase\.temp\pooler-url' -Raw)
    if($ham -match '@([a-z0-9.\-]+):\d+'){ $sunucu = $Matches[1] }
  }
  $kullanici = "postgres.$ProjeRef"
  Write-Host "  sunucu: $sunucu . kullanici: $kullanici" -ForegroundColor DarkGray
  Write-Host "  !! Parola istenecek. Betik parolayi ne saklar ne gosterir." -ForegroundColor DarkGray

  # Yalniz BIZIM semalarimiz: public + app. Supabase'in kendi semalari
  # (auth, storage, extensions...) zaten disarida kaliyor.
  # Olculdu: gocler `app` disinda sema yaratmiyor.
  # !! `--quote-all-identifiers` . PostgreSQL belgesinin kendi tavsiyesi:
  # "This option is recommended when dumping a database from a server whose
  #  PostgreSQL major version is different from pg_dump's."
  # Bizde tam o durum var: sunucu 17, elimizdeki pg_dump 18. Surumler arasi
  # ayrilmis kelime listeleri farkli; tirnaksiz bir tablo adi bir surumde
  # gecerliyken otekinde ayrilmis kelime olabilir.
  # ── !! GERI YUKLENECEK DOSYA BU: tam.dump ────────────────────────────
  # 31.10.2026 . ilk gercek yedekte pg_dump SU UYARIYI verdi:
  #   "DIKKAT: Bu tablolar arasinda dairesel (circular) foreign-key
  #    kisitlamalari bulunmaktadir: company, branch ... stock_movement.
  #    --disable-triggers kullanmadan ... yedegi geri YUKLEYEMEYEBILIRSINIZ.
  #    Bu sorunla karsilasmamak icin --data-only yedek yerine TAM YEDEK
  #    almayi dusunun."
  #
  # Yani elimizdeki sema.sql + veri.sql ikilisi, veriyi TASIYOR ama geri
  # YUKLENEBILIR olmayabilir: `company` ile `branch` birbirine bakiyor,
  # hangisini once yazarsan oteki kisiti patlatir.
  # `--disable-triggers` cozum degil: superuser ister, Supabase'de yok.
  #
  # Cozum pg_dump'in kendi tavsiyesi: ozel bicimde (-Fc) TEK dosyalik tam
  # dokum. `pg_restore` siralama sorununu kendisi cozer.
  # sema.sql ve veri.sql OKUNABILIRLIK icin kaliyor (insan gozuyle bakmak,
  # metinde aramak icin); GERI YUKLEME tam.dump'tan yapilir.
  Write-Host "  1/3 TAM DOKUM (geri yuklenecek dosya)..." -ForegroundColor Gray
  & $pgYol -h $sunucu -p 5432 -U $kullanici -d postgres -Fc --no-owner --no-privileges --quote-all-identifiers --schema=public --schema=app -f "$tamDosya"
  if($LASTEXITCODE -ne 0){ Hata 'TAM dokum basarisiz. Yedek ALINAMADI.' }

  Write-Host "  2/3 sema (okunabilir)..." -ForegroundColor Gray
  & $pgYol -h $sunucu -p 5432 -U $kullanici -d postgres --schema-only --no-owner --no-privileges --quote-all-identifiers --schema=public --schema=app -f "$semaDosya"
  if($LASTEXITCODE -ne 0){ Hata 'Sema dokumu basarisiz. Yedek ALINAMADI.' }

  Write-Host "  3/3 VERI (okunabilir)..." -ForegroundColor Gray
  & $pgYol -h $sunucu -p 5432 -U $kullanici -d postgres --data-only --no-owner --no-privileges --quote-all-identifiers --schema=public --schema=app -f "$veriDosya"
  if($LASTEXITCODE -ne 0){ Hata 'VERI dokumu basarisiz. Yedek ALINAMADI (sema tek basina yedek degildir).' }

  Uyari 'Roller bu yolda alinmiyor (pg_dumpall gerekir). Roller gocler icinde yazili.'
} else {
  Write-Host "  1/3 sema..." -ForegroundColor Gray
  npx supabase db dump --linked -f "$semaDosya"
  if($LASTEXITCODE -ne 0){ Hata 'Sema dokumu basarisiz. Yedek ALINAMADI.' }

  Write-Host "  2/3 VERI..." -ForegroundColor Gray
  npx supabase db dump --linked --data-only --use-copy -f "$veriDosya"
  if($LASTEXITCODE -ne 0){ Hata 'VERI dokumu basarisiz. Yedek ALINAMADI (sema tek basina yedek degildir).' }

  Write-Host "  3/3 roller..." -ForegroundColor Gray
  npx supabase db dump --linked --role-only -f "$rolDosya"
  if($LASTEXITCODE -ne 0){ Uyari 'Rol dokumu basarisiz. Sema ve veri alindi; roller EKSIK.' }
}

# -- 5 . Dogrulama . "aldim" demeden ONCE olcuyoruz -------------------------
Bilgi '5/6 - Dogrulama'

# !! BU BOLUM BETIGIN EN ONEMLI KISMI (tuzak 157).
# Dosyanin olusmasi, icinde veri oldugu anlamina gelmez.
function Olc($yol, $ad){
  if(-not (Test-Path $yol)){ return 0 }
  $b = (Get-Item $yol).Length
  Write-Host ("  {0,-8} {1,12:N0} bayt" -f $ad, $b)
  return $b
}
$semaBayt = Olc $semaDosya 'sema'
$veriBayt = Olc $veriDosya 'veri'
$rolBayt  = Olc $rolDosya  'roller'

if($semaBayt -lt 1000){
  Hata 'Sema dosyasi yok ya da sasirtici kadar kucuk. BU BIR YEDEK DEGILDIR.'
}

# !! 01.11.2026 . MIYOP-088 (Codex) . COPY BASLIGI SAYMAK VERI SAYMAK DEGIL.
# Eski olcum `^COPY |^INSERT INTO` satirlarini sayiyordu. Bos bir tablo da
# COPY basligi tasir: yirmi bos tablo "20 satir veri" gibi gorunuyordu.
# Artik COPY blogunun ICINDEKI satirlar sayiliyor.
function VeriSatiriSay($yol){
  if(-not (Test-Path $yol)){ return 0 }
  $icinde = $false
  $say = 0
  foreach($satir in [IO.File]::ReadLines($yol)){
    if($icinde){
      if($satir -eq '\.'){ $icinde = $false; continue }
      $say++
      continue
    }
    if($satir -match '^COPY .* FROM stdin;'){ $icinde = $true; continue }
    if($satir -match '^INSERT INTO '){ $say++ }
  }
  return $say
}

$veriSatir = 0
if($veriBayt -gt 0){ $veriSatir = VeriSatiriSay $veriDosya }
Write-Host "  veri dosyasindaki GERCEK kayit satiri: $veriSatir" -ForegroundColor Gray

if($veriSatir -lt 1){
  Write-Host ""
  Write-Host "  VERI DOSYASINDA TEK BIR KAYIT YOK." -ForegroundColor Red
  Write-Host "  Veritabani gercekten bossa bu dogrudur. Degilse dokum" -ForegroundColor Red
  Write-Host "  calismamistir ve bu dosyalar YEDEK DEGILDIR." -ForegroundColor Red
  Hata 'Dogrulama gecmedi.'
}

if(Select-String -Path $veriDosya -Pattern 'audit_log' -List){
  Tamam 'denetim defteri (audit_log) dokumde gorunuyor'
} else {
  Uyari 'audit_log dokumde GORUNMUYOR . dokumun kapsamini kontrol et'
}
if(Select-String -Path $semaDosya -Pattern 'stock_movement' -List){
  Tamam 'stok defteri (stock_movement) semada gorunuyor'
} else {
  Uyari 'stock_movement semada GORUNMUYOR . kapsami kontrol et'
}

# !! TAM DOKUMUN ICI OKUNUYOR (tuzak 160 ve MIYOP-088).
#
# !! 01.11.2026 . `pg_restore --list` YETMIYOR. Codex olctu: 50 girdili bir
# arsivin saglam surumu 16.912, VERI BLOKLARI KESILMIS surumu 15.971 bayt
# idi. Ikisi de `--list` ile cikis kodu 0 ve 50 girdi verdi; SQL'e acmada
# saglam surum gecti, kesilmis surum `could not find block ID 1` ile dustu.
# Yani icerik LISTESI, veri bloklarinin saglamligi DEGILDIR . tam da tuzak
# 157'nin ("dosya var" = "veri var" degil) bir ust katmani.
#
# Artik arsiv BASTAN SONA SQL'e cevriliyor: bu, her veri blogunu gercekten
# okutur. Cevrilen dosya gecici; olculduktan sonra siliniyor.
$tamSatir = 0
if($secilen -eq 'pgdump'){
  $tamBayt = Olc $tamDosya 'tam.dump'
  if($tamBayt -lt 10000){ Hata 'tam.dump yok ya da sasirtici kadar kucuk. GERI YUKLENECEK DOSYA YOK.' }
  $pgRestore = Join-Path (Split-Path $pgYol) 'pg_restore.exe'
  if(-not (Test-Path $pgRestore)){
    Hata 'pg_restore bulunamadi . tam.dump OKUNAMADI, yani GERI GELECEGI KANITLANAMADI.'
  }

  $eskiEAP = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $liste = & $pgRestore --list "$tamDosya" 2>&1 | Out-String
  $kod = $LASTEXITCODE
  $ErrorActionPreference = $eskiEAP
  if($kod -ne 0){ Hata "tam.dump OKUNAMADI . pg_restore reddetti:`n$liste" }
  $girdi = ([regex]::Matches($liste, '(?m)^\d+;')).Count
  Write-Host "  tam.dump icindeki nesne sayisi: $girdi" -ForegroundColor Gray
  if($girdi -lt 50){ Hata "tam.dump icinde yalniz $girdi nesne var . BU BIR YEDEK DEGILDIR." }

  $gecici = Join-Path $env:TEMP ('miyop-dogrulama-' + [guid]::NewGuid().ToString('N') + '.sql')
  $eskiEAP = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $cevirme = & $pgRestore --no-owner --no-privileges -f "$gecici" "$tamDosya" 2>&1 | Out-String
  $kod = $LASTEXITCODE
  $ErrorActionPreference = $eskiEAP
  if($kod -ne 0){
    Remove-Item $gecici -Force -ErrorAction SilentlyContinue
    Hata ("tam.dump BASTAN SONA OKUNAMADI . arsiv bozuk ya da yarim:`n" + $cevirme)
  }
  $tamSatir = VeriSatiriSay $gecici
  Remove-Item $gecici -Force -ErrorAction SilentlyContinue
  Write-Host "  tam.dump icinden cikan GERCEK kayit satiri: $tamSatir" -ForegroundColor Gray
  if($tamSatir -lt 1){
    Hata 'tam.dump acildi ama icinden TEK BIR KAYIT SATIRI cikmadi. BU BIR YEDEK DEGILDIR.'
  }
  Tamam 'tam.dump bastan sona SQL e cevrildi (her veri blogu okundu) ve dolu'
} else {
  # !! 01.11.2026 . MIYOP-087 (Codex) . BU YOLDA `tam.dump` URETILMIYOR.
  # Eskiden notta ve ekranda yine "geri yuklenecek dosya tam.dump" yaziyordu;
  # yani kullanici OLMAYAN bir dosyaya yonlendiriliyordu. Dairesel foreign
  # key icin yapilan onarim da bu yolda YOK.
  Uyari 'CLI yolu . tam.dump URETILMEDI. Geri yukleme sema+veri ile ELLE yapilir.'
  Uyari 'Dairesel foreign key (company<->branch, stock_movement) bu yolda SORUN CIKARABILIR.'
}

# -- 6 . Not ----------------------------------------------------------------
Bilgi '6/6 - YEDEK-NOTU.txt'

# !! NOT YOLA GORE DEGISIR (MIYOP-087). Iki yol ayni dosyalari uretmiyor;
# tek bir metin yazmak, CLI yolunda OLMAYAN bir dosyaya yonlendirmekti.
if($secilen -eq 'pgdump'){
  $geriYuklemeNotu = @"
!! GERI YUKLENECEK DOSYA: tam.dump (ozel bicim). sema.sql ve veri.sql
   okunabilirlik icindir; semada DAIRESEL foreign key var (company<->branch,
   stock_movement) ve o ikisiyle sirali geri yukleme patlayabilir.
   Dogru komut:  pg_restore --no-owner --no-privileges -d <hedef> tam.dump
   Dogrulama   : arsiv bastan sona SQL e cevrildi, $tamSatir kayit satiri okundu.
"@
} else {
  $geriYuklemeNotu = @"
!! BU YEDEKTE tam.dump YOK. CLI yolu ozel bicim uretmiyor; elde yalniz
   sema.sql, veri.sql ve roller.sql var.
   Geri yukleme ELLE ve SIRALI yapilir:  roller.sql -> sema.sql -> veri.sql
!! DIKKAT: semada DAIRESEL foreign key var (company<->branch,
   stock_movement). Sirali yukleme bu yuzden PATLAYABILIR; kisitlari
   gecici olarak ertelemek gerekebilir. Bu yol DAHA ZAYIFTIR.
   Guclu yol icin PostgreSQL istemci araclarini kur ve betigi yeniden
   calistir (pg_dump yolu tam.dump uretir).
"@
}
@"
MIYOP . VERITABANI YEDEGI
=========================
Alindi    : $(Get-Date -Format 'dd.MM.yyyy HH:mm:ss')
Proje     : $ProjeRef
Sunucu    : PostgreSQL $SUNUCU_SURUM
Yol       : $secilen
Semalar   : public, app

$geriYuklemeNotu

Dosyalar  : sema.sql $('{0:N0}' -f $semaBayt) bayt
            veri.sql $('{0:N0}' -f $veriBayt) bayt ($veriSatir kayit satiri)
            roller.sql $('{0:N0}' -f $rolBayt) bayt

!! ICINDE OLMAYANLAR (bilerek)
   * giris hesaplari (auth semasi dokume girmez)
   * yuklenen dosyalar (Storage)
   * sunucu yapilandirmasi

Geri yukleme: docs/YEDEKLEME.md . CANLIDA HENUZ DENENMEDI.
"@ | Out-File -Encoding UTF8 (Join-Path $kok 'YEDEK-NOTU.txt')
Tamam 'not yazildi'

Write-Host ""
$afisRenk = if($secilen -eq 'pgdump'){ 'Green' } else { 'Yellow' }
$afisMetin = if($secilen -eq 'pgdump'){
  ' YEDEK ALINDI ve GERI GELECEGI OLCULDU'
} else {
  ' SINIRLI YEDEK ALINDI . tam.dump YOK, geri yukleme DENENMEDI'
}
Write-Host "===========================================================" -ForegroundColor $afisRenk
Write-Host $afisMetin -ForegroundColor $afisRenk
Write-Host " $kok"
Write-Host ""
Write-Host " ICINDE OLMAYANLAR (bilerek):" -ForegroundColor Yellow
Write-Host "   - giris hesaplari (auth semasi dokume girmez)"
Write-Host "   - yuklenen dosyalar (Storage)"
Write-Host " Geri yukleme: docs/YEDEKLEME.md" -ForegroundColor Gray
Write-Host "===========================================================" -ForegroundColor $afisRenk
