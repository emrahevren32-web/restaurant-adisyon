# ===========================================================================
# MIYOP . GERI YUKLEME PROVASI . yedek GERCEKTEN geri geliyor mu
#
# Kullanim:
#     .\araclar\geri-yukle-provasi.ps1
#     .\araclar\geri-yukle-provasi.ps1 -Dosya "F:\MIYOP_BACKUP\veritabani\...\tam.dump"
#
# ---------------------------------------------------------------------------
# NEDEN BU BETIK VAR
# ---------------------------------------------------------------------------
# Yedek borcumuzun DORDUNCU katmani buydu ve tek kanitlanmamis olan oydu:
#   1. dosya var mi          . olculuyor
#   2. icinde veri var mi     . olculuyor
#   3. arsiv bastan sona okunabiliyor mu . olculuyor (yedek-al.ps1)
#   4. BOS BIR VERITABANINA GERCEKTEN GERI GELIYOR MU . iste bu
#
# 02.11.2026'da YONTEM prova veritabaninda kosturuldu ve calisti. Ama o
# prova SENIN DOSYANLA degil, ayni semaya sahip baska bir veritabaniyla
# yapildi. Bu betik seninkiyle yapiyor.
#
# ---------------------------------------------------------------------------
# !! BU BETIK CANLI VERITABANINA DOKUNMAZ
# ---------------------------------------------------------------------------
# Supabase'e hic baglanmaz. Yalniz SENIN BILGISAYARINDAKI PostgreSQL'e
# gecici bir veritabani acar, dokumu oraya yukler, sayar ve siler.
# Canliya giden tek satir yok.
#
# ---------------------------------------------------------------------------
# !! CIKIS KODUNA BAKMA . 02.11.2026 . TUZAK 176
# ---------------------------------------------------------------------------
# Olculdu: SAGLAM bir geri yukleme bile `pg_restore`u 1 ile dondurur, cunku
# PostgreSQL yeni veritabanini zaten `public` semasiyla acar ve dokum onu
# yaratmaya calisir:  ERROR: schema "public" already exists
# Ayni olcumde `psql` + sema.sql + veri.sql yolu ise 0 ile cikti ve
# ON ONE foreign key hatasini atlayip BUTUN IS VERISINI KAYBETTI
# (kiraci 0, denetim defteri 0).
# Yani iki yol da yalan soyluyor, ters yonlere. Dogruluk SAYILARAK olculur.
# Bu betik o yuzden cikis kodunu degil SATIR SAYILARINI rapor eder.
# ===========================================================================

param(
  [string]$Dosya = '',
  [string]$Veritabani = 'miyop_geri_provasi',
  [switch]$Birak
)

$ErrorActionPreference = 'Stop'

function Bilgi($m){ Write-Host ""; Write-Host "> $m" -ForegroundColor Cyan }
function Tamam($m){ Write-Host "  [OK] $m" -ForegroundColor Green }
function Uyari($m){ Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Hata($m){ Write-Host ""; Write-Host "  [X]  $m" -ForegroundColor Red; Write-Host ""; exit 1 }

# --- 1 . araclari bul --------------------------------------------------------
$pgKlasor = ''
foreach($surum in @('18','17','16')){
  $aday = "C:\Program Files\PostgreSQL\$surum\bin"
  if(Test-Path (Join-Path $aday 'pg_restore.exe')){ $pgKlasor = $aday; break }
}
if(-not $pgKlasor){
  Hata 'pg_restore bulunamadi. PostgreSQL istemci araclari kurulu degil (docs/YEDEKLEME.md).'
}
$pgRestore = Join-Path $pgKlasor 'pg_restore.exe'
$psql      = Join-Path $pgKlasor 'psql.exe'
$createdb  = Join-Path $pgKlasor 'createdb.exe'
$dropdb    = Join-Path $pgKlasor 'dropdb.exe'
Bilgi "Araclar: $pgKlasor"

# --- 2 . dokum dosyasini bul -------------------------------------------------
if(-not $Dosya){
  # En yeni tam.dump . yedek-al.ps1 tarih damgali klasorlere yaziyor.
  $aramaYollari = @('F:\MIYOP_BACKUP\veritabani', 'F:\MIYOP_BACKUP')
  foreach($yol in $aramaYollari){
    if(Test-Path $yol){
      $bulunan = Get-ChildItem -Path $yol -Filter 'tam.dump' -Recurse -ErrorAction SilentlyContinue |
                 Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if($bulunan){ $Dosya = $bulunan.FullName; break }
    }
  }
}
if(-not $Dosya -or -not (Test-Path $Dosya)){
  Hata "tam.dump bulunamadi. -Dosya ile yolunu ver. Aranan: F:\MIYOP_BACKUP\veritabani\**\tam.dump"
}
$boyut = [math]::Round((Get-Item $Dosya).Length / 1KB, 1)
$tarih = (Get-Item $Dosya).LastWriteTime.ToString('dd.MM.yyyy HH:mm')
Tamam "Dokum: $Dosya"
Write-Host "       $boyut KB . $tarih"

# --- 3 . icerik listesi ------------------------------------------------------
Bilgi '1/4 - Arsiv okunabiliyor mu'
$eski = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$liste = & $pgRestore --list "$Dosya" 2>&1 | Out-String
$kod = $LASTEXITCODE
$ErrorActionPreference = $eski
if($kod -ne 0){ Hata "Arsiv OKUNAMADI . pg_restore reddetti:`n$liste" }
$nesne = ([regex]::Matches($liste, '(?m)^\d+;')).Count
Tamam "$nesne nesne listelendi"

# --- 4 . gecici veritabani ---------------------------------------------------
Bilgi "2/4 - Gecici veritabani: $Veritabani"
Uyari 'Yerel PostgreSQL parolasi sorulabilir . sen yaziyorsun, betik saklamiyor.'
$eski = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
& $dropdb --if-exists -U postgres $Veritabani 2>&1 | Out-Null
& $createdb -U postgres $Veritabani 2>&1 | Out-Null
$kod = $LASTEXITCODE
$ErrorActionPreference = $eski
if($kod -ne 0){ Hata "Gecici veritabani ACILAMADI. Yerel PostgreSQL sunucusu calisiyor mu?" }
Tamam 'acildi'

# --- 4b . SUPABASE ROLLERI . 02.11.2026'da OLCULDU --------------------------
# !! ILK PROVADA 78 RLS kuralindan 2'si GELMEDI (76 cikti) ve sebebi suydu:
#       ERROR: role "supabase_auth_admin" does not exist
#    Goc `g7_1_sema.sql` giris kancasini YALNIZ Supabase'in kendi auth
#    sunucusuna aciyor; o role bagli IKI politika var. Supabase'de bu rol
#    vardir, senin yerel PostgreSQL'inde yoktur . yani eksiklik YEDEKTE
#    DEGIL, PROVA ORTAMINDA.
#    Prova ortamini gercege benzetmek icin roller aciliyor (nologin: hicbir
#    sey yapamazlar, yalniz politikalarin isaret edecegi bir ad olurlar).
# !! Roller KUME duzeyindedir, yani gecici veritabani silinince kalirlar.
#    Zararsiz ve bilerek: her provada yeniden yaratilmasinlar diye.
Bilgi '2b/4 - Supabase rolleri (prova ortamini gercege benzetmek icin)'
# !! TEK TIRNAKLI here-string (@' ... '@): PowerShell icinde HICBIR
# genisletme yapmaz. Cift tirnakli olsaydi `$$` PowerShell'in kendi
# otomatik degiskeni sanilirdi ve SQL bozulurdu.
$rolSql = @'
do $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin nologin noinherit; end if;
end
$$;
'@
$rolDosya = Join-Path $env:TEMP ('miyop-roller-' + [guid]::NewGuid().ToString('N') + '.sql')
[System.IO.File]::WriteAllText($rolDosya, $rolSql, (New-Object System.Text.UTF8Encoding $false))
$eski = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
& $psql -U postgres -d $Veritabani -v ON_ERROR_STOP=1 -f "$rolDosya" 2>&1 | Out-Null
$rolKod = $LASTEXITCODE
$ErrorActionPreference = $eski
Remove-Item $rolDosya -Force -ErrorAction SilentlyContinue
if($rolKod -ne 0){
  Uyari 'Roller acilamadi . supabase_auth_admin''e bagli IKI politika gelmeyebilir (RLS 78 yerine 76).'
} else {
  Tamam 'anon / authenticated / service_role / supabase_auth_admin hazir'
}

# --- 5 . GERI YUKLE ----------------------------------------------------------
Bilgi '3/4 - Geri yukleniyor'
$eski = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$cikti = & $pgRestore --no-owner --no-privileges -U postgres -d $Veritabani "$Dosya" 2>&1 | Out-String
$kod = $LASTEXITCODE
$ErrorActionPreference = $eski

# !! CIKIS KODU YARGI DEGIL . tuzak 176. Yalniz BILGI olarak yaziliyor.
$hataSatirlari = @($cikti -split "`n" | Where-Object { $_ -match 'error:' })
$sadecePublic = ($hataSatirlari.Count -le 1) -and ($cikti -match 'schema "public" already exists')
Write-Host "  pg_restore cikis kodu: $kod" -ForegroundColor Gray
if($sadecePublic){
  Uyari 'Tek hata: schema "public" already exists . BEKLENEN ve ZARARSIZ (tuzak 176).'
} elseif($hataSatirlari.Count -gt 0) {
  Uyari "$($hataSatirlari.Count) hata satiri var . asagidaki SAYILAR ne diyor, ona bak:"
  $hataSatirlari | Select-Object -First 8 | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkYellow }
}

# --- 6 . ASIL OLCUM . SAYARAK -------------------------------------------------
Bilgi '4/4 - SAYARAK dogrulama'
$sorgu = @"
select 'tablo' as ne, count(*)::text as kac from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE'
union all select 'app fonksiyonu', count(*)::text from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace where n.nspname='app'
union all select 'tetik', count(*)::text from pg_trigger where not tgisinternal
union all select 'RLS kurali', count(*)::text from pg_policies where schemaname='public'
union all select 'kiraci', count(*)::text from public.tenant
union all select 'firma', count(*)::text from public.company
union all select 'stok karti', count(*)::text from public.stock_item
union all select 'stok hareketi', count(*)::text from public.stock_movement
union all select 'siparis', count(*)::text from public.sales_order
union all select 'denetim kaydi', count(*)::text from public.audit_log;
"@
$sorguDosya = Join-Path $env:TEMP ('miyop-sayim-' + [guid]::NewGuid().ToString('N') + '.sql')
[System.IO.File]::WriteAllText($sorguDosya, $sorgu, (New-Object System.Text.UTF8Encoding $false))
$eski = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$sayim = & $psql -U postgres -d $Veritabani -v ON_ERROR_STOP=1 -f "$sorguDosya" 2>&1 | Out-String
$sayimKod = $LASTEXITCODE
$ErrorActionPreference = $eski
Remove-Item $sorguDosya -Force -ErrorAction SilentlyContinue
if($sayimKod -ne 0){ Hata "Sayim sorgusu kosturulamadi:`n$sayim" }
Write-Host $sayim

# Kiraci sifirsa is verisi GELMEMIS demektir . 02.11'de duz SQL yolu tam
# bunu yapiyordu ve cikis kodu 0 veriyordu.
if($sayim -match '(?m)^\s*kiraci\s*\|\s*0\s*$'){
  Hata 'KIRACI SAYISI SIFIR . is verisi GERI GELMEDI. Bu yedek GUVENILMEZ.'
}
Tamam 'Is verisi geri geldi (yukaridaki sayilar)'

# --- 7 . temizlik ------------------------------------------------------------
if($Birak){
  Uyari "Gecici veritabani BIRAKILDI: $Veritabani (incelemek icin). Silmek: dropdb -U postgres $Veritabani"
} else {
  $eski = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  & $dropdb --if-exists -U postgres $Veritabani 2>&1 | Out-Null
  $ErrorActionPreference = $eski
  Tamam 'gecici veritabani silindi'
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host " GERI YUKLEME PROVASI BITTI" -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Green
Write-Host " Dokum : $Dosya"
Write-Host " Nesne : $nesne"
Write-Host ""
Write-Host " !! RLS kurali 76 cikarsa: supabase_auth_admin rolune bagli IKI" -ForegroundColor Yellow
Write-Host "    politika gelmemis demektir (yedek kusuru DEGIL, rol eksikligi)."
Write-Host ""
Write-Host " SIRADAKI ADIM: yukaridaki sayilari CANLI ile karsilastir." -ForegroundColor Yellow
Write-Host " Supabase SQL Editor'e ayni sorguyu yapistir; sayilar tutmali."
Write-Host " (Dokum alindiktan SONRA yazilan kayitlar yuzunden canli SAYILAR"
Write-Host "  daha buyuk olabilir . kucuk olmamali.)"
Write-Host ""
Write-Host " !! ICINDE OLMAYANLAR (bilerek): giris hesaplari (auth semasi)," -ForegroundColor Yellow
Write-Host "    yuklenen dosyalar (Storage). docs/YEDEKLEME.md 4.1"
Write-Host "===========================================================" -ForegroundColor Green
