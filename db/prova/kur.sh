#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# MİYOP · prova veritabanını kur
#
# Temiz bir PostgreSQL 16 veritabanı yaratır, Supabase'in taklidini kurar
# (auth şeması, anon/authenticated/service_role rolleri), sonra
# db/migrations altındaki bütün göçleri SIRAYLA uygular.
#
# Kullanım (PostgreSQL 16 kurulu bir Linux'ta, root olarak):
#     bash db/prova/kur.sh
#
# Sonra bir prova koş:
#     su postgres -c "psql -v ON_ERROR_STOP=1 -d miyop -f db/prova/prova-0088.sql"
#
# ⚠️ Her prova `begin` ile başlar `rollback` ile biter — veritabanını
# kirletmez, arka arkaya koşturulabilir.
# ═══════════════════════════════════════════════════════════════════════════
set -e

KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROVA="$KOK/db/prova"
GOC="$KOK/db/migrations"

if [ ! -d "$GOC" ]; then
  echo "❌ Göç klasörü bulunamadı: $GOC"; exit 1
fi

su postgres -c "dropdb --if-exists miyop"
su postgres -c "createdb miyop"
su postgres -c "psql -q -v ON_ERROR_STOP=1 -d miyop -f $PROVA/00_supabase_taklit.sql" >/dev/null 2>&1

# ⚠️ YALNIZ numaralı göçler. `g7_rls_kapat.sql` gibi dosyalar RLS'i KAPATIR
# ve prova veritabanını anlamsızlaştırır — desene uymadığı için alınmıyor.
# ⚠️ MIYOP-048 (Codex) · İLK SÜRÜM, HATAYI GÖSTERMEK İÇİN GÖÇÜ İKİNCİ KEZ
# ÇALIŞTIRIYORDU. İkinci koşu, birincinin kalıcı olmuş değişikliklerinin
# ÜSTÜNE biniyordu ve gösterilen hata ilk hatadan farklı olabiliyordu.
# Yani arıza raporunun kendisi arızayı değiştiriyordu. Artık ilk çağrının
# çıktısı saklanıyor ve o gösteriliyor; dosya bir kez çalışır.
# ⚠️ MIYOP-054 (Codex) · YUKARIDAKİ DÜZELTMENİN KENDİ KUSURU.
# İlk onarım `CIKTI=$(...)` ataması yapıp ardından `$?`ye bakıyordu. Ama
# dosyanın başında `set -e` var: BAŞARISIZ BİR ATAMA betiği oracıkta
# sonlandırıyor ve hata gösterimine HİÇ GELİNMİYOR. Yani "hatayı göster"
# diye yazdığım satırlar, hata olduğunda çalışmıyordu.
# Doğrusu: çağrıyı `if`in KOŞULUNA almak — `set -e` bir koşulda
# değerlendirilen komutu sonlandırmaz.
SAYI=0
for f in $(ls "$GOC"/00[0-9][0-9]_*.sql | sort); do
  if CIKTI=$(su postgres -c "psql -v ON_ERROR_STOP=1 -d miyop -f $f" 2>&1); then
    SAYI=$((SAYI+1))
  else
    echo "❌ $(basename "$f")"
    echo "$CIKTI" | grep -E 'ERROR|FATAL' | head -3
    exit 1
  fi
done
echo "✅ $SAYI göç uygulandı"
