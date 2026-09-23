#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# MİYOP · Göç provası — göçleri Emrah'a GÖNDERMEDEN ÖNCE burada çalıştır
#
# Neden var: 0032'yi gönderdim, Supabase'de düştü (BEFORE INSERT
# tetikleyicisinde yabancı anahtar). O hatayı burada bulabilirdim. Emrah'ın
# zamanını yakmak yerine kendi makinemde yakalamak gerekir.
#
# ── NE YAPAR ─────────────────────────────────────────────────────────────
# Yerel PostgreSQL 16'da boş bir veritabanı kurar, Supabase'in sağladığı
# parçaların TAKLİTLERİNİ yaratır (roller, `auth` şeması, `auth.uid()`),
# sonra db/migrations altındaki bütün göçleri SIRAYLA çalıştırır. İlk
# hatada durur ve hatayı yazar.
#
# ── DÜRÜST SINIR ─────────────────────────────────────────────────────────
# Bu Supabase DEĞİL. Farklar:
#   · `auth.uid()` taklit — oturum yok, null döner
#   · PostgREST yok, yani kolon bazlı GRANT'ın API davranışı sınanmaz
#   · Supabase'in kendi şemaları (storage, realtime) yok
# Yani buradan geçen bir göç Supabase'de de geçer diye GARANTİ yok;
# ama SÖZDİZİMİ, tetikleyici sırası, kısıtlar ve doğrulama blokları
# burada sınanır. Son söz hâlâ canlıda.
#
# Kullanım:  /home/claude/miyop-work/goc-prova.sh  [son_goc_no]
# Örnek:     goc-prova.sh 0032    → yalnız 0032'ye kadar çalıştırır
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail

KOK=/tmp/pgprova
SOCK=$KOK/sock
PORT=5433
PSQL="psql -h $SOCK -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
REPO=/tmp/repo

# ── 1. Sunucu ayakta mı ───────────────────────────────────────────────────
if ! psql -h $SOCK -p $PORT -U postgres -c 'select 1' >/dev/null 2>&1; then
  echo "── Sunucu kuruluyor ──"
  rm -rf $KOK && mkdir -p $KOK/data $KOK/sock
  chown -R postgres:postgres $KOK
  su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $KOK/data -U postgres --auth=trust" >$KOK/init.log 2>&1 \
    || { echo "initdb başarısız:"; tail -5 $KOK/init.log; exit 1; }
  su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $KOK/data -o '-k $KOK/sock -p $PORT -c listen_addresses=' -l $KOK/pg.log start" >/dev/null 2>&1
  sleep 2
fi

# ── 2. Temiz veritabanı ───────────────────────────────────────────────────
psql -h $SOCK -p $PORT -U postgres -q -c "drop database if exists miyop_prova" >/dev/null
psql -h $SOCK -p $PORT -U postgres -q -c "create database miyop_prova" >/dev/null
PSQL="$PSQL -d miyop_prova"

# ── 3. Supabase taklitleri ────────────────────────────────────────────────
# Göçler bu parçaların var olduğunu varsayıyor. Supabase onları sağlıyor;
# burada elle yaratıyoruz. ⚠️ TAKLİT: `auth.uid()` null döner.
# ⚠️ BU BLOK BİR KEZ SESSİZCE DÜŞTÜ. İçindeki `foreach` bildirimsiz
# yazılmıştı; geçersiz plpgsql olduğu için heredoc hata verip durdu ve
# `auth` şeması HİÇ OLUŞMADI. 36 göç yine "geçti", çünkü hepsi
# `auth.uid()` çağrısını hata yakalayıcı içinde yapıyor. Yani prova eksik
# çalışıyordu ve bunu ancak akış provası yazarken gördüm.
# Ders: kurulum adımı da doğrulanmalı — aşağıda son satır onu yapıyor.
for r in anon authenticated service_role supabase_auth_admin supabase_admin dashboard_user authenticator; do
  psql -h $SOCK -p $PORT -U postgres -d miyop_prova -q \
    -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='$r') then create role $r nologin; end if; end \$\$;" >/dev/null 2>&1
done

$PSQL <<'SQL' >/dev/null
-- ⚠️ 2026-09-23: pgcrypto ARTIK `extensions` ŞEMASINA kuruluyor — Supabase de
-- öyle yapıyor. Eskiden `public` içine kuruluyordu ve bu, 0042'nin canlıda
-- düşen `gen_random_bytes` çağrısını provada GİZLEDİ. Prova, canlının kolay
-- tarafını taklit ederse prova değildir.
create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;
create schema if not exists auth;

-- TAKLİT: gerçek Supabase'de oturumun kullanıcı kimliğini döndürür.
-- Burada `prova.uid` ayarından okuyor; prova-akis.sql onu kurar.
create or replace function auth.uid() returns uuid
language sql stable as $fn$ select nullif(current_setting('prova.uid', true), '')::uuid $fn$;

create or replace function auth.jwt() returns jsonb
language sql stable as $fn$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$fn$;

grant usage on schema auth to anon, authenticated, service_role;
SQL

# Kurulumun GERÇEKTEN olduğunu doğrula. Yoksa sessizce eksik bir provayla
# "geçti" demiş oluruz — testin yeşil olup hiçbir şeyi korumaması gibi.
if ! psql -h $SOCK -p $PORT -U postgres -d miyop_prova -tAc "select auth.uid() is null" >/dev/null 2>&1; then
  echo "KURULUM BAŞARISIZ: auth.uid() taklidi oluşmadı. Prova güvenilmez, duruyorum."
  exit 1
fi

# ── 4. Göçler, sırayla ────────────────────────────────────────────────────
SON="${1:-9999}"
echo "── GÖÇLER ────────────────────────────────────────────────────"
gecen=0
for f in $(ls $REPO/db/migrations/[0-9]*.sql | sort); do
  ad=$(basename "$f")
  no=${ad:0:4}
  if [ "$no" \> "$SON" ]; then continue; fi
  cikti=$(psql -h $SOCK -p $PORT -U postgres -d miyop_prova -v ON_ERROR_STOP=1 -q -f "$f" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  ✗ $ad"
    echo "$cikti" | grep -E "^psql:|ERROR|HATA|DETAIL|CONTEXT" | head -12 | sed 's/^/      /'
    echo
    echo "  DURDU. Bu göç Supabase'de de düşer."
    exit 1
  fi
  gecen=$((gecen+1))
  echo "  ✓ $ad"
done
echo
echo "  $gecen göç geçti."
# ── 5. Uctan uca akis provasi (oturum taklidiyle) ─────────────────────────
# Gocler oturumsuz calisabilen kurallari sinar; onayin mutlu yolu oturum
# ister. O yuzden ayri dosya: miyop-work/prova-akis.sql
AKIS=/home/claude/miyop-work/prova-akis.sql
if [ -f "$AKIS" ] && [ "$SON" = "9999" ]; then
  echo
  echo "── UÇTAN UCA AKIŞ ────────────────────────────────────────────"
  cikti=$(psql -h $SOCK -p $PORT -U postgres -d miyop_prova -v ON_ERROR_STOP=1 -q -f "$AKIS" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  ✗ akis provasi"
    echo "$cikti" | grep -E "^psql:|ERROR|HATA|DETAIL|CONTEXT|NOTICE" | head -14 | sed 's/^/      /'
    exit 1
  fi
  echo "$cikti" | grep -E "NOTICE|GECTI|adet" | sed 's/^/  /' | head -12
  echo "  ✓ akis provasi"
fi

# ── 6. Izolasyon provasi (A4D madde 10) ───────────────────────────────────
# "Iki firma birbirini gormuyor" cumlesi bu urunde bir ozellik degil, var
# olma sarti. Inanilarak degil KANITLANARAK tasinir; kanit her kosuda
# tekrarlanir.
IZO=/home/claude/miyop-work/izolasyon-provasi.sql
if [ -f "$IZO" ] && [ "$SON" = "9999" ]; then
  echo
  echo "── İZOLASYON ─────────────────────────────────────────────────"
  cikti=$(psql -h $SOCK -p $PORT -U postgres -d miyop_prova -v ON_ERROR_STOP=1 -q -f "$IZO" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  ✗ izolasyon provasi"
    echo "$cikti" | grep -E "^psql:|ERROR|HATA|DETAIL|CONTEXT|NOTICE" | head -14 | sed 's/^/      /'
    exit 1
  fi
  echo "$cikti" | grep -E "NOTICE|GECTI" | sed 's/^/  /' | head -10
  echo "  ✓ izolasyon provasi"
fi

echo
echo "── SONUÇ ─────────────────────────────────────────────────────"
psql -h $SOCK -p $PORT -U postgres -d miyop_prova -q -c "
select
  (select count(*) from pg_tables where schemaname='public')                as tablo,
  (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid
     join pg_namespace n on n.oid=c.relnamespace
   where not t.tgisinternal and n.nspname='public')                         as tetikleyici,
  (select count(*) from pg_policies where schemaname='public')              as politika,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='app')                                                   as app_fonksiyonu;"
