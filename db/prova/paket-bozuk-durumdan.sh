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
# Bu betik canlının bozuk hâlini taklit ediyor: önce kapıyı EZİYOR, sonra
# paketi çalıştırıyor. Paket hatasız geçmeli ve kapı GERİ GELMELİ.
#
# Kullanım:
#     bash db/prova/paket-bozuk-durumdan.sh araclar/goc-bekleyen.sql
# ═══════════════════════════════════════════════════════════════════════════
set -e

KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PAKET="${1:-$KOK/araclar/goc-bekleyen.sql}"

if [ ! -f "$PAKET" ]; then
  echo "❌ Paket dosyası yok: $PAKET"; exit 1
fi

echo "── 1/4 · Temiz zincir kuruluyor"
bash "$KOK/db/prova/kur.sh" | tail -1

echo "── 2/4 · CANLININ BOZUK HÂLİ taklit ediliyor (finans kapısı eziliyor)"
su postgres -c "psql -q -v ON_ERROR_STOP=1 -d miyop" <<'SQL'
-- 0095'in ESKİ (hatalı) hâlinin yaptığı şey: ham hesabı kapının adına yazmak.
--
-- ⚠️ 27.10 · İLK YAZIŞIMDA BURADA `stock_balance` KULLANDIM ve taklit
-- CANLIDAN FARKLI OLDU. Canlıdaki ezik fonksiyon 0095'in eski hâliydi, yani
-- içinde `stock_usable_balance` VARDI. Benim kurduğum bozuk durumda o yoktu;
-- dolayısıyla 0095'in "ham hesap kapıya yazılmış mı" kontrolü yerelde
-- tetiklenmedi ve prova yeşil geçti — canlıda ise patladı.
-- Yani tuzak 131'i yazdığım turda, aynı tuzağa taklidin İÇİNDE yeniden
-- düştüm: bozuk durumu kurmak yetmez, DOĞRU bozuk durumu kurmak gerekir.
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

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'app' and p.proname = 'isletme_gostergeleri'
                and pg_get_functiondef(p.oid) ~ 'finance\.read') then
    raise exception 'Kapı ezilemedi; bozuk durum taklit edilemedi.';
  end if;
end $$;
SQL
echo "  ✓ kapı ezildi"

echo "── 3/4 · Paket çalıştırılıyor: $(basename "$PAKET")"
# ⚠️ `ON_ERROR_STOP` ŞART: Supabase bütün betiği tek işlemde çalıştırıyor ve
# bir hata her şeyi geri alıyor. Buradaki koşu o davranışı taklit etmeli;
# hatayı yutarsak prova canlıdan daha hoşgörülü olur.
if ! su postgres -c "psql -q -v ON_ERROR_STOP=1 -d miyop -f $PAKET" > /tmp/paket.log 2>&1; then
  echo "❌ PAKET BOZUK DURUMDAN GEÇMEDİ:"
  grep -E 'ERROR' /tmp/paket.log | head -5
  exit 1
fi
echo "  ✓ paket hatasız koştu"

echo "── 4/4 · Onarım gerçekleşti mi"
SONUC=$(su postgres -c "psql -tA -d miyop -c \"
  select case
    when (select pg_get_functiondef(p.oid) from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
           where n.nspname='app' and p.proname='isletme_gostergeleri') ~ 'finance\.read'
     and (select pg_get_functiondef(p.oid) from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
           where n.nspname='app' and p.proname='isletme_gostergeleri_ham') ~ 'stock_usable_balance'
    then 'TAMAM' else 'EKSIK' end\"")

if [ "$SONUC" != "TAMAM" ]; then
  echo "❌ Paket koştu ama onarım OLMADI: kapı geri gelmedi ya da hesap _ham'da değil."
  exit 1
fi
echo "  ✓ finans kapısı geri geldi, düzeltilmiş hesap _ham'da"
echo ""
echo "✅ PAKET BOZUK DURUMDAN DA GEÇİYOR VE ONARIYOR"
