#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# MİYOP · ONARIM PAKETİNİ **BOZUK DURUMDAN** SINA
#
# ── NEDEN VAR (27.10.2026) ────────────────────────────────────────────────
# `kur.sh` göçleri SIRAYLA, TEMİZ bir veritabanına uyguluyor. Bu doğru ama
# YETMİYOR: bir ONARIM göçü, onardığı BOZUK durumdan başlayarak sınanmalı.
#
# 27.10'da tam bunu kaçırdım. Göç 0099 canlıdaki bir P0'ı onarıyordu
# (0095'in ezdiği `finance.read` kapısı). Temiz zincirde kapı hiç ezilmiyor,
# dolayısıyla paketim yerelde sorunsuz geçiyordu. Ama CANLIDA kapı dün
# ezilmişti ve paket o durumdan başladı — 0095'e koyduğum bir kontrol
# 0099'dan ÖNCE çalışıp kırmızı verdi ve **Supabase bütün paketi geri aldı.**
# Yani onarım hiç uygulanamadı ve açık açık kaldı.
#
# ── ÜÇ DÜZELTME (27.10, Codex ölçümü) ─────────────────────────────────────
#  1) `set -o pipefail` YOKTU: `kur.sh | tail -1` boru hattında kur.sh
#     düşse bile betik devam ediyordu, yani KURULMAMIŞ bir veritabanında
#     "paket geçti" diyebilirdi.
#  2) `--single-transaction` YOKTU: Supabase yapıştırılan betiğin TAMAMINI
#     TEK İŞLEMDE çalıştırıyor. Onsuz koşan prova, canlıdan DAHA HOŞGÖRÜLÜ
#     olur: ortadaki bir hata öncesini geri almaz, onarım "yarım" uygulanmış
#     görünür ve kontrol yeşil geçer. Oysa canlıda hiçbir şey uygulanmaz.
#  3) Tek senaryo vardı. Artık her bozuk durum ayrı senaryo; her senaryo
#     TEMİZ zincirden başlar.
#
# Kullanım:
#     bash db/prova/paket-bozuk-durumdan.sh [paket.sql]
# ═══════════════════════════════════════════════════════════════════════════
set -e
set -o pipefail

KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PAKET="${1:-$KOK/araclar/goc-bekleyen.sql}"
GECICI="$(mktemp -d)"
trap 'rm -rf "$GECICI"' EXIT
# ⚠️ `mktemp -d` 0700 açıyor ve sahibi root. Betikler `su postgres -c psql -f`
# ile okunuyor; postgres kullanıcısı 0700 bir klasörün içini GÖREMEZ ve psql
# "No such file or directory" der. İlk koşuda tam bu oldu ve "taklit yanlış"
# diye yanlış bir sebep gösterdi.
chmod 755 "$GECICI"

if [ ! -f "$PAKET" ]; then
  echo "❌ Paket dosyası yok: $PAKET"; exit 1
fi

# ── BOZUK DURUM TAKLİTLERİ ─────────────────────────────────────────────────
# ⚠️ 27.10 · İLK YAZIŞIMDA 0095 taklidinde `stock_balance` KULLANDIM ve
# taklit CANLIDAN FARKLI OLDU: canlıdaki ezik fonksiyonun içinde
# `stock_usable_balance` VARDI. Benim kurduğum bozuk durumda o yoktu;
# 0095'in "ham hesap kapıya yazılmış mı" kontrolü yerelde tetiklenmedi ve
# prova yeşil geçti — canlıda patladı. Bozuk durumu kurmak yetmez, DOĞRU
# bozuk durumu kurmak gerekir (tuzak 134).

cat > "$GECICI/boz-gosterge.sql" <<'SQL'
-- 0095'in ESKİ (hatalı) hâlinin yaptığı şey: ham hesabı KAPININ adına yazmak.
create or replace function app.isletme_gostergeleri(
  p_sube uuid, p_bas date, p_bit date
)
returns table (anahtar text, deger numeric, ek numeric)
language sql stable set search_path = public, app, pg_temp
as $$
  select 'kritik_kalem'::text, count(*)::numeric, null::numeric
    from public.stock_item i
    left join public.stock_usable_balance b
           on b.stock_item_id = i.id and b.branch_id = p_sube
   where i.branch_id = p_sube and i.is_active and i.min_qty > 0
     and coalesce(b.usable_qty, 0) <= i.min_qty
$$;
SQL

cat > "$GECICI/boz-fire-ezik.sql" <<'SQL'
-- CANLIDAKİ DURUM (27.10 teşhis tablosu): `app.fire_dokumu` kapı DEĞİL,
-- içinde ham hesap var — yani 0065'in gövdesi 0071'in kapısının üstüne
-- yazılmış. `_ham` DURUYOR.
create or replace function app.fire_dokumu(p_sube uuid, p_bas date, p_bit date)
returns table (neden text, kalem_id uuid, kalem_adi text, miktar numeric,
               birim text, tutar numeric, fiyatsiz boolean)
language sql stable set search_path = public, app, pg_temp
as $$
  select d.reason, d.stock_item_id, k.name,
         sum(abs(d.quantity_base)), max(k.base_uom),
         sum(abs(d.quantity_base) * app.kalem_alis_fiyati(d.stock_item_id, d.occurred_at)),
         bool_or(app.kalem_alis_fiyati(d.stock_item_id, d.occurred_at) is null)
    from public.stock_movement d
    left join public.stock_item k on k.id = d.stock_item_id
   where d.branch_id = p_sube and d.quantity_base < 0
     and d.reason = any(app.fire_nedenleri())
   group by d.reason, d.stock_item_id, k.name
$$;
SQL

cat > "$GECICI/boz-fire-hamsiz.sql" <<'SQL'
-- ÖTEKİ OLASILIK: 0071 bu veritabanında HİÇ ÇALIŞMAMIŞ. O zaman `_ham`
-- yoktur ve hesap hâlâ `app.fire_dokumu` adında durur.
drop function if exists app.fire_dokumu(uuid, date, date);
alter function app.fire_dokumu_ham(uuid, date, date) rename to fire_dokumu;
create or replace function public.fire_dokumu(p_sube uuid, p_bas date, p_bit date)
returns table (neden text, kalem_id uuid, kalem_adi text, miktar numeric,
               birim text, tutar numeric, fiyatsiz boolean)
language sql stable set search_path = public, app, pg_temp
as $$ select * from app.fire_dokumu(p_sube, p_bas, p_bit) $$;
revoke execute on function public.fire_dokumu(uuid, date, date) from public;
revoke execute on function public.fire_dokumu(uuid, date, date) from anon;
grant  execute on function public.fire_dokumu(uuid, date, date) to authenticated;
SQL

# ── KONTROLLER ─────────────────────────────────────────────────────────────
# Her kontrol: `app.<ad>` kapı OLACAK, `app.<ad>_ham` hesabı TAŞIYACAK.
kapi_sorgusu() {
  cat <<SQL
select case when
     coalesce((select p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                where n.nspname='app' and p.proname='$1'), '') like '%finance.read%'
 and coalesce((select p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                where n.nspname='app' and p.proname='${1}_ham'), '') like '%$2%'
 and coalesce((select p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                where n.nspname='app' and p.proname='$1'), 'x') not like '%$2%'
  then 'TAMAM' else 'EKSIK' end
SQL
}

BOZUKKEN_PATLADI=""

# ── İKİ TÜR SENARYO ────────────────────────────────────────────────────────
# 27.10 · İlk yazışımda tek tür vardı: "paket bunu onaracak". Paketi tek göçe
# (0101) indirdiğim an senaryo 1 haklı olarak kırmızı verdi — çünkü 0101
# göstergeleri onarmıyor, onu 0099 onardı ve 0099 CANLIDA ZATEN UYGULANDI.
# Yani prova yanlış şeyi bekliyordu. İki beklenti ayrıldı:
#
#   ONARIR  → paket bu bozukluğu GİDERECEK.
#   DAYANIR → paket bu bozukluğu gidermeyecek (onun işi değil) ama o durumda
#             DÜŞMEYECEK. Tuzak 129 tam buydu: ilgisiz bir bozukluk yüzünden
#             düşen paket, Supabase'te kendi onarımını da geri alır.

senaryo() {
  local AD="$1" MOD="$2" KAPI="$3" IZ="$4"; shift 4
  echo ""
  echo "════ SENARYO · $AD   [$MOD]"

  echo "  1/4 temiz zincir"
  bash "$KOK/db/prova/kur.sh" > "$GECICI/kur.log" 2>&1 || {
    echo "  ❌ temiz zincir kurulamadı:"; tail -5 "$GECICI/kur.log"; exit 1; }

  echo "  2/4 bozuk durum kuruluyor"
  for F in "$@"; do
    chmod 644 "$F"
    su postgres -c "psql -q -v ON_ERROR_STOP=1 -d miyop -f $F" \
      > "$GECICI/boz.log" 2>&1 || {
        echo "  ❌ bozuk durum KURULAMADI (taklit yanlış):"
        tail -5 "$GECICI/boz.log"; exit 1; }
  done

  # ⚠️ TAKLİDİN DOĞRULUĞUNU ÖLÇ. Bozuk olduğunu SANMAK yetmez; bozuk
  # olmadığı hâlde "paket onardı" diyen bir prova hiçbir şey ölçmez.
  local ONCE
  ONCE=$(su postgres -c "psql -tA -d miyop -c \"$(kapi_sorgusu "$KAPI" "$IZ")\"")
  if [ "$ONCE" != "EKSIK" ]; then
    echo "  ❌ bozuk durum BOZUK DEĞİL — taklit tutmadı, prova bir şey ölçmez."
    exit 1
  fi
  echo "  ✓ bozuk (onarım öncesi: EKSIK)"

  # ⚠️ `--single-transaction` + `ON_ERROR_STOP`: Supabase'in davranışı.
  echo "  3/4 paket koşuyor (tek işlem)"
  if ! su postgres -c "psql -q -v ON_ERROR_STOP=1 --single-transaction -d miyop -f $PAKET" \
       > "$GECICI/paket.log" 2>&1; then
    echo "  ❌ PAKET BU DURUMDAN GEÇMEDİ (canlıda da geçmez, her şey geri alınır):"
    grep -E 'ERROR|HATA' "$GECICI/paket.log" | head -5 || tail -5 "$GECICI/paket.log"
    BOZUKKEN_PATLADI="evet"
    return 0
  fi

  echo "  4/4 sonuç"
  local SONRA
  SONRA=$(su postgres -c "psql -tA -d miyop -c \"$(kapi_sorgusu "$KAPI" "$IZ")\"")
  if [ "$MOD" = "ONARIR" ]; then
    if [ "$SONRA" != "TAMAM" ]; then
      echo "  ❌ Paket koştu ama ONARIM OLMADI."
      BOZUKKEN_PATLADI="evet"; return 0
    fi
    echo "  ✓ kapı geri geldi, hesap _ham'da"
  else
    echo "  ✓ paket düşmedi (bu bozukluk bu paketin işi değil: $KAPI hâlâ $SONRA)"
  fi
}

# ⚠️ Senaryolar PAKETE GÖRE ayarlanır. Paket değiştiğinde buraya bakın:
# bugünkü paket yalnız 0101'i taşıyor, yani yalnız fire dökümünü onarır.
senaryo "fire dökümü kapısı ezilmiş (canlının 27.10 hâli)" \
        ONARIR fire_dokumu stock_movement "$GECICI/boz-fire-ezik.sql"

senaryo "0071 hiç çalışmamış: fire _ham yok" \
        ONARIR fire_dokumu stock_movement "$GECICI/boz-fire-hamsiz.sql"

senaryo "göstergeler de ezik (26.10 hâli) — 0101 bunu onarmaz, DÜŞMEMELİ" \
        DAYANIR isletme_gostergeleri stock_usable_balance "$GECICI/boz-gosterge.sql"

senaryo "İKİSİ BİRDEN ezik — fire onarılır, paket düşmez" \
        ONARIR fire_dokumu stock_movement \
        "$GECICI/boz-gosterge.sql" "$GECICI/boz-fire-ezik.sql"

if [ -n "$BOZUKKEN_PATLADI" ]; then
  echo ""; echo "❌ EN AZ BİR SENARYO GEÇMEDİ"; exit 1
fi

echo ""
echo "✅ PAKET DÖRT BOZUK DURUMDAN DA GEÇİYOR VE ONARIYOR"
