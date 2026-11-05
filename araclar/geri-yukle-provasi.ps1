# ===========================================================================
# MIYOP . GERI YUKLEME PROVASI . yedek GERCEKTEN geri geliyor mu
#
# Kullanim:
#     .\araclar\geri-yukle-provasi.ps1
#     .\araclar\geri-yukle-provasi.ps1 -Dosya "F:\MIYOP_BACKUP\veritabani\...\tam.dump"
#     .\araclar\geri-yukle-provasi.ps1 -Birak        (inceleyebilmek icin silmez)
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
# ---------------------------------------------------------------------------
# !! BU BETIK CANLI VERITABANINA DOKUNMAZ . VE ARTIK KANITLIYOR
# ---------------------------------------------------------------------------
# MIYOP-093 (Codex, 04.11.2026) . ILK SURUMDE SU VARDI:
#   . veritabani adi serbest parametreydi,
#   . ve ilk is olarak `dropdb --if-exists` kosturuyordu,
#   . host hicbir komutta belirtilmemisti.
# Yani -Veritabani ile var olan bir veritabaninin adi verilse O VERITABANI
# PROVA BASLAMADAN SILINIYORDU; ustune PGHOST / PGHOSTADDR / PGSERVICE
# ortam degiskenleri hedefi UZAK bir sunucuya cevirebiliyordu.
# Simdi:
#   . ad serbest degil, her kosusta YENI ve BENZERSIZ uretiliyor,
#   . o ad veritabaninda zaten varsa betik DOKUNMADAN DURUYOR,
#   . devralinan baglanti ortam degiskenleri temizleniyor,
#   . butun komutlar acikca -h/-p ile ayni hedefe baglaniyor,
#   . hedefin GERCEKTEN yerel oldugu sunucuya sorularak dogrulaniyor,
#   . ve yalniz BU KOSUNUN ACTIGI veritabani siliniyor.
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
#
# ---------------------------------------------------------------------------
# !! "KIRACI SIFIR DEGIL" YETERLI DEGILDI . MIYOP-095
# ---------------------------------------------------------------------------
# Eski surum yalniz `kiraci | 0` durumunu reddediyordu. Codex olctu: parti
# (lot), siparis satiri veya RLS politikalari HIC GELMESE de prova YESIL
# veriyordu, cunku kiraci tablosu doluydu.
# Simdi olcu dayatma degil KARSILASTIRMA:
#   . dokum duz SQL'e cevrilir, HER tablonun COPY blogundaki satir sayisi
#     sayilir, geri yuklenen veritabanindaki sayimla karsilastirilir;
#   . arsiv icerik listesindeki TABLE / FUNCTION / TRIGGER / POLICY kayitlari
#     sayilir, veritabanindaki sayimla karsilastirilir.
# Eksik olan tek bir tablo bile provayi KIRMIZI yapar. Elle yazilmis alt
# sinir yok; olcu dokumun kendisi.
# ===========================================================================

param(
  [string]$Dosya = '',
  [string]$Sunucu = 'localhost',
  [int]$Kapi = 5432,
  [switch]$Birak
)

$ErrorActionPreference = 'Stop'

$bizYarattik = $false
$Veritabani  = ''
$ortakBaglanti = @()
$sonKod = 0

function Bilgi($m){ Write-Host ""; Write-Host "> $m" -ForegroundColor Cyan }
function Tamam($m){ Write-Host "  [OK] $m" -ForegroundColor Green }
function Uyari($m){ Write-Host "  [!]  $m" -ForegroundColor Yellow }

# !! Temizlik Hata'dan da cagrilir: yarida kalan prova veritabanini
# arkada birakmak, bir sonraki kosuda "zaten var" diye durdurur.
function TemizlikYap(){
  if(-not $script:bizYarattik){ return }
  $baglanti = $script:ortakBaglanti
  $eski = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  & $script:dropdb @baglanti $script:Veritabani 2>&1 | Out-Null
  $ErrorActionPreference = $eski
  $script:bizYarattik = $false
  Write-Host "  [OK] gecici veritabani silindi: $($script:Veritabani)" -ForegroundColor Green
}

function Hata($m){
  Write-Host ""; Write-Host "  [X]  $m" -ForegroundColor Red
  if($script:bizYarattik){
    if($Birak){ Uyari "Gecici veritabani BIRAKILDI: $($script:Veritabani)" }
    else { TemizlikYap }
  }
  Write-Host ""
  exit 1
}

# --- 0 . BAGLANTI ORTAMINI TEMIZLE . MIYOP-093 ------------------------------
# !! Bu degiskenler varsa -h/-p verilse bile bazi komutlar hedefi
# devralabilir. Yalniz BU islemde temizlenir; senin oturumunu bozmaz.
foreach($ad in @('PGHOST','PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGDATABASE','PGPORT','PGOPTIONS')){
  if(Test-Path "env:$ad"){
    Uyari "Devralinan baglanti degiskeni temizlendi (yalniz bu betik icin): $ad"
    Remove-Item "env:$ad" -Force -ErrorAction SilentlyContinue
  }
}

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
$ortakBaglanti = @('-h', $Sunucu, '-p', "$Kapi", '-U', 'postgres')
Bilgi "Araclar: $pgKlasor"
Write-Host "       Hedef : ${Sunucu}:${Kapi} (kullanici postgres)"

# --- yardimci: tek deger donduren psql --------------------------------------
function PsqlDeger($vt, $sql){
  $dosya = Join-Path $env:TEMP ('miyop-sorgu-' + [guid]::NewGuid().ToString('N') + '.sql')
  [System.IO.File]::WriteAllText($dosya, $sql, (New-Object System.Text.UTF8Encoding $false))
  $baglanti = $script:ortakBaglanti
  $eski = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $cikti = & $script:psql @baglanti -d $vt -At -v ON_ERROR_STOP=1 -f "$dosya" 2>&1 | Out-String
  $script:sonKod = $LASTEXITCODE
  $ErrorActionPreference = $eski
  Remove-Item $dosya -Force -ErrorAction SilentlyContinue
  return $cikti.Trim()
}

# !! Parola istemi gibi kenar ciktilar karsilastirmayi bozmasin diye tek
# degerli sorgularda SON anlamli satira bakiyoruz.
function SonSatir($metin){
  $satirlar = @(($metin -split "`r?`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
  if($satirlar.Count -eq 0){ return '' }
  return $satirlar[$satirlar.Count - 1]
}

# --- 2 . HEDEF GERCEKTEN YEREL MI . MIYOP-093 -------------------------------
Bilgi 'Hedef dogrulamasi (prova canliya baglanmasin)'
Uyari 'Yerel PostgreSQL parolasi sorulabilir . sen yaziyorsun, betik saklamiyor.'
$adres = PsqlDeger 'postgres' "select coalesce(host(inet_server_addr()), 'yerel-soket');"
if($sonKod -ne 0){
  Hata "Yerel PostgreSQL'e baglanilamadi (${Sunucu}:${Kapi}). Sunucu calisiyor mu?`n$adres"
}
$adres = SonSatir $adres
if(@('yerel-soket','127.0.0.1','::1') -notcontains $adres){
  Hata "HEDEF YEREL DEGIL . sunucu kendi adresini '$adres' diye bildiriyor. Prova UZAK bir veritabanina baglanmis olabilir. HICBIR SEY YAPILMADI."
}
Tamam "Hedef yerel: $adres"

# --- 3 . dokum dosyasini bul -------------------------------------------------
if(-not $Dosya){
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

# --- 4 . icerik listesi ------------------------------------------------------
Bilgi '1/5 - Arsiv okunabiliyor mu'
$eski = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$liste = & $pgRestore --list "$Dosya" 2>&1 | Out-String
$kod = $LASTEXITCODE
$ErrorActionPreference = $eski
if($kod -ne 0){ Hata "Arsiv OKUNAMADI . pg_restore reddetti:`n$liste" }
$nesne = ([regex]::Matches($liste, '(?m)^\d+;')).Count
Tamam "$nesne nesne listelendi"

# !! ARSIV KUNYESI . MIYOP-095. Icerik listesindeki kayit tipleri sayiliyor;
# geri yukleme sonrasi veritabanindaki sayimlarla karsilastirilacak.
# "TABLE DATA public ..." satirlari "TABLE\s+public" desenine UYMAZ.
$arsiv = @{
  'tablo'          = ([regex]::Matches($liste, '(?m)^\d+;\s+\d+\s+\d+\s+TABLE\s+public\s+')).Count
  'app fonksiyonu' = ([regex]::Matches($liste, '(?m)^\d+;\s+\d+\s+\d+\s+FUNCTION\s+app\s+')).Count
  'tetik'          = ([regex]::Matches($liste, '(?m)^\d+;\s+\d+\s+\d+\s+TRIGGER\s+public\s+')).Count
  'RLS kurali'     = ([regex]::Matches($liste, '(?m)^\d+;\s+\d+\s+\d+\s+POLICY\s+public\s+')).Count
}
Write-Host ("       arsiv: tablo {0} . app fonksiyonu {1} . tetik {2} . RLS kurali {3}" -f `
  $arsiv['tablo'], $arsiv['app fonksiyonu'], $arsiv['tetik'], $arsiv['RLS kurali'])

# --- 5 . DOKUMDEKI SATIR SAYILARI . MIYOP-095 -------------------------------
# !! Olcu dokumun kendisi. Arsiv duz SQL'e cevrilir, her COPY blogunun
# GERCEK veri satirlari sayilir (COPY basligi ve kapanis `\.` sayilmaz).
Bilgi '2/5 - Dokumdeki satirlar sayiliyor'
$duzDosya = Join-Path $env:TEMP ('miyop-duz-' + [guid]::NewGuid().ToString('N') + '.sql')
$eski = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
& $pgRestore -f "$duzDosya" "$Dosya" 2>&1 | Out-Null
$ErrorActionPreference = $eski
if(-not (Test-Path $duzDosya)){ Hata 'Arsiv duz SQL e cevrilemedi . dokum bozuk olabilir.' }

$dokumSayim = @{}
$atlanan = @()
$acikTablo = ''
foreach($satir in [System.IO.File]::ReadLines($duzDosya)){
  if($acikTablo -eq ''){
    if($satir -match '^COPY\s+(\S+)\s*\(.*\)\s+FROM\s+stdin;\s*$'){
      # !! OLCULDU (05.11.2026): yedek-al.ps1 `--quote-all-identifiers` ile
      # dokum aliyor, yani satir soyle geliyor:
      #     COPY "public"."allergen" ("code", ...) FROM stdin;
      # Ilk surumde desen tirnaksiz ad bekliyordu; GERCEK dokumle HICBIR
      # tablo taninmayacak ve prova "dokumde hic veri yok" diye YANLIS
      # KIRMIZI verecekti. Tirnaklar soyuluyor.
      $ad = $Matches[1] -replace '"', ''
      if($ad -match '^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$'){
        $acikTablo = $ad
        if(-not $dokumSayim.ContainsKey($ad)){ $dokumSayim[$ad] = 0 }
      } else {
        $acikTablo = '?'
        if($atlanan -notcontains $ad){ $atlanan += $ad }
      }
    }
  } else {
    if($satir -eq '\.'){ $acikTablo = '' }
    elseif($acikTablo -ne '?'){ $dokumSayim[$acikTablo] = $dokumSayim[$acikTablo] + 1 }
  }
}
Remove-Item $duzDosya -Force -ErrorAction SilentlyContinue
$dolu = @($dokumSayim.Keys | Where-Object { $dokumSayim[$_] -gt 0 })
$toplamSatir = 0
foreach($t in $dolu){ $toplamSatir += $dokumSayim[$t] }
Tamam "$($dolu.Count) tabloda $toplamSatir veri satiri . bunlarin HEPSI geri gelmeli"
if($atlanan.Count -gt 0){
  Uyari "Adi cozulemeyen $($atlanan.Count) COPY blogu karsilastirmaya girmedi: $($atlanan -join ', ')"
}
if($dolu.Count -eq 0){
  Hata 'Dokumde HIC veri satiri yok . bu yedek bos. Karsilastirilacak bir sey yok.'
}

# --- 6 . gecici veritabani . BENZERSIZ AD, VAR OLANA DOKUNMA ----------------
$Veritabani = 'miyop_prova_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '_' +
              [guid]::NewGuid().ToString('N').Substring(0,6)
Bilgi "3/5 - Gecici veritabani: $Veritabani"
$zatenVar = PsqlDeger 'postgres' "select count(*) from pg_database where datname = '$Veritabani';"
if($sonKod -ne 0){ Hata "Veritabani listesi okunamadi:`n$zatenVar" }
if((SonSatir $zatenVar) -ne '0'){
  Hata "'$Veritabani' adinda bir veritabani ZATEN VAR. Prova var olan hicbir veritabanina dokunmaz . durduruldu."
}
$eski = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
& $createdb @ortakBaglanti $Veritabani 2>&1 | Out-Null
$kod = $LASTEXITCODE
$ErrorActionPreference = $eski
if($kod -ne 0){ Hata 'Gecici veritabani ACILAMADI. Yerel PostgreSQL sunucusu calisiyor mu?' }
$bizYarattik = $true
Tamam "acildi (bu kosu actigi icin sonunda yalniz bunu silecek)"

# --- 6b . SUPABASE ROLLERI . 02.11.2026'da OLCULDU --------------------------
# !! ILK PROVADA 78 RLS kuralindan 2'si GELMEDI (76 cikti) ve sebebi suydu:
#       ERROR: role "supabase_auth_admin" does not exist
#    Goc `g7_1_sema.sql` giris kancasini YALNIZ Supabase'in kendi auth
#    sunucusuna aciyor; o role bagli IKI politika var. Supabase'de bu rol
#    vardir, senin yerel PostgreSQL'inde yoktur . yani eksiklik YEDEKTE
#    DEGIL, PROVA ORTAMINDA.
# !! Roller KUME duzeyindedir, yani gecici veritabani silinince kalirlar.
#    Zararsiz ve bilerek: her provada yeniden yaratilmasinlar diye.
Bilgi '3b/5 - Supabase rolleri (prova ortamini gercege benzetmek icin)'
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
& $psql @ortakBaglanti -d $Veritabani -v ON_ERROR_STOP=1 -f "$rolDosya" 2>&1 | Out-Null
$rolKod = $LASTEXITCODE
$ErrorActionPreference = $eski
Remove-Item $rolDosya -Force -ErrorAction SilentlyContinue
if($rolKod -ne 0){
  Uyari 'Roller acilamadi . supabase_auth_admin''e bagli IKI politika gelmeyebilir (RLS 78 yerine 76).'
} else {
  Tamam 'anon / authenticated / service_role / supabase_auth_admin hazir'
}

# --- 7 . GERI YUKLE ----------------------------------------------------------
Bilgi '4/5 - Geri yukleniyor'
$eski = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$cikti = & $pgRestore --no-owner --no-privileges @ortakBaglanti -d $Veritabani "$Dosya" 2>&1 | Out-String
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

# --- 8 . ASIL OLCUM . KARSILASTIRARAK ---------------------------------------
Bilgi '5/5 - KARSILASTIRARAK dogrulama'

# 8a . yapi sayimlari
$yapiSorgu = @"
select 'tablo', count(*)::text from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE'
union all select 'app fonksiyonu', count(*)::text from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace where n.nspname='app'
union all select 'tetik', count(*)::text from pg_trigger where not tgisinternal
union all select 'RLS kurali', count(*)::text from pg_policies where schemaname='public';
"@
$yapiCikti = PsqlDeger $Veritabani $yapiSorgu
if($sonKod -ne 0){ Hata "Yapi sayimi kosturulamadi:`n$yapiCikti" }
$yapi = @{}
foreach($satir in ($yapiCikti -split "`n")){
  $p = $satir.Trim() -split '\|'
  if($p.Count -eq 2){ $yapi[$p[0]] = [int]$p[1] }
}
$eksikler = @()
Write-Host ""
Write-Host "  YAPI            arsiv  gelen" -ForegroundColor Gray
foreach($ne in @('tablo','app fonksiyonu','tetik','RLS kurali')){
  $bekleyen = [int]$arsiv[$ne]
  $gelen    = [int]$yapi[$ne]
  $isaret = if($gelen -ge $bekleyen){ 'OK ' } else { 'EKSIK' }
  $renk   = if($gelen -ge $bekleyen){ 'Green' } else { 'Red' }
  Write-Host ("  {0,-14} {1,6} {2,6}  {3}" -f $ne, $bekleyen, $gelen, $isaret) -ForegroundColor $renk
  if($gelen -lt $bekleyen){ $eksikler += "$ne : arsiv $bekleyen . gelen $gelen" }
}

# 8b . tablo tablo satir sayimlari . MIYOP-095
$ifadeler = @()
foreach($t in ($dolu | Sort-Object)){
  # !! Tabloyu TIRNAKLI yaziyoruz: dokum de tirnakli yaziyor, ve iki
  # PostgreSQL surumunun ayrilmis kelime listesi ayni degil (tuzak:
  # yedek-al.ps1 bu yuzden --quote-all-identifiers kullaniyor).
  # !! TIRNAK, STRING BIRLESTIRMEYLE KONUYOR . 05.11.2026, TUZAK 180.
  # Ilk yazimda `\"` kullandim; PowerShell'de cift tirnak icinde ters
  # bolu KACIS DEGILDIR (kacis karakteri ters tirnaktir). Betik
  # AYRISTIRILAMADI, yani hic calismadi. Birlestirme hic kacis istemez.
  $parca = $t -split '\.'
  $tirnakli = '"' + $parca[0] + '"."' + $parca[1] + '"'
  $ifadeler += "select '$t' as tablo, count(*)::text as kac from $tirnakli"
}
$satirCikti = PsqlDeger $Veritabani (($ifadeler -join "`nunion all ") + ';')
if($sonKod -ne 0){ Hata "Satir sayimi kosturulamadi (tablolar gelmemis olabilir):`n$satirCikti" }
$gelenSatir = @{}
foreach($satir in ($satirCikti -split "`n")){
  $p = $satir.Trim() -split '\|'
  if($p.Count -eq 2){ $gelenSatir[$p[0]] = [int]$p[1] }
}
Write-Host ""
Write-Host "  VERI (dolu tablolar)          dokum  gelen" -ForegroundColor Gray
foreach($t in ($dolu | Sort-Object)){
  $bekleyen = [int]$dokumSayim[$t]
  $gelen    = if($gelenSatir.ContainsKey($t)){ [int]$gelenSatir[$t] } else { -1 }
  $isaret = if($gelen -ge $bekleyen){ 'OK ' } elseif($gelen -lt 0){ 'YOK' } else { 'EKSIK' }
  $renk   = if($gelen -ge $bekleyen){ 'Green' } else { 'Red' }
  Write-Host ("  {0,-28} {1,6} {2,6}  {3}" -f $t, $bekleyen, $gelen, $isaret) -ForegroundColor $renk
  if($gelen -lt $bekleyen){ $eksikler += "$t : dokum $bekleyen . gelen $gelen" }
}
Write-Host ""

if($eksikler.Count -gt 0){
  Write-Host "  GELMEYENLER:" -ForegroundColor Red
  $eksikler | ForEach-Object { Write-Host "    . $_" -ForegroundColor Red }
  Hata "$($eksikler.Count) kalem dokumdekinden AZ geldi . BU YEDEK GUVENILMEZ."
}
Tamam "Dokumdeki butun tablolar ve butun yapi kayitlari geri geldi"

# --- 9 . temizlik ------------------------------------------------------------
if($Birak){
  Uyari "Gecici veritabani BIRAKILDI: $Veritabani (incelemek icin)."
  Write-Host "       Silmek: dropdb -h $Sunucu -p $Kapi -U postgres $Veritabani"
} else {
  TemizlikYap
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host " GERI YUKLEME PROVASI BITTI . YESIL" -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Green
Write-Host " Dokum  : $Dosya"
Write-Host " Nesne  : $nesne"
Write-Host " Olcu   : $($dolu.Count) tablo . $toplamSatir satir . tablo tablo karsilastirildi"
Write-Host ""
Write-Host " !! RLS kurali arsivdekinden AZ cikarsa once rol eksikligine bak" -ForegroundColor Yellow
Write-Host "    (supabase_auth_admin). Yedek kusuru olmayabilir."
Write-Host ""
Write-Host " SIRADAKI ADIM: bu sayilari CANLI ile karsilastir." -ForegroundColor Yellow
Write-Host " (Dokum alindiktan SONRA yazilan kayitlar yuzunden canli SAYILAR"
Write-Host "  daha buyuk olabilir . kucuk olmamali.)"
Write-Host ""
Write-Host " !! ICINDE OLMAYANLAR (bilerek): giris hesaplari (auth semasi)," -ForegroundColor Yellow
Write-Host "    yuklenen dosyalar (Storage). docs/YEDEKLEME.md 4.1"
Write-Host "===========================================================" -ForegroundColor Green
