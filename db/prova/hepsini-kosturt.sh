#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# MİYOP · bütün provaları koşturur, YEŞİL/KIRMIZI özetini basar
#
# Kullanım:
#     bash db/prova/kur.sh            # önce temiz veritabanı
#     bash db/prova/hepsini-kosturt.sh
#
# ⚠️ TUZAK 89'un kardeşi · bu betiğin İLK hâli yalnız çıktıda `✗`/`ERROR`
# arıyordu ve iki ayrı yanlış yeşil veriyordu:
#   1. PostgreSQL kapalıyken psql "connection refused" basar; o metinde
#      `ERROR` geçmez ve 36 dosyanın hepsi YEŞİL sayılırdı.
#   2. Eski provalar başarısızlığı `raise notice '❌ ...'` ile bildirir —
#      bu bir NOTICE'tır, ERROR değildir; grep görmezdi.
# Doğrusu aşağıda: çıkış kodu + `✗`/`❌`/ERROR + "N kaldı" sayacı,
# VE en az bir olumlu işaret görmüş olmak. Sessiz dosya kanıt değildir.
#
# İKİ PROVA ÜSLUBU VAR (ikisi de geçerli):
#   yeni · `prova_bak()` → her doğrulama `✓` ya da `✗`
#   eski · sonda özet    → "──── 00XX provası: N geçti, M kaldı"
#   eski · satır satır   → `✅` / `❌`, ya da büyük harfli "GEÇTİ"/"TAMAM"
#
# ⚠️ MIYOP-041 (Codex): ilk sürüm yalnız `✓|geçti` arıyordu; `✅`, "TAMAM"
# ve büyük harfli "GEÇTİ" basan 0052/0055/0058 "sessiz" sayılıp haksız
# yere KIRMIZI oluyordu. Bir ölçüm aracının yanlış kırmızısı, yanlış
# yeşili kadar zarar verir: insan ona bakmayı bırakır.
# ═══════════════════════════════════════════════════════════════════════════
set -u
PROVA="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
YESIL=0; KIRMIZI=0; KIRIKLAR=""

if ! su postgres -c "psql -q -d miyop -c 'select 1'" >/dev/null 2>&1; then
  echo "❌ miyop veritabanına bağlanılamıyor. Önce: bash db/prova/kur.sh"
  exit 1
fi

for f in $(ls "$PROVA"/prova-*.sql | sort); do
  ad=$(basename "$f")
  cikti=$(su postgres -c "psql -q -v ON_ERROR_STOP=1 -d miyop -f $f" 2>&1)
  kod=$?

  # Eski üslubun özet satırı: "N geçti, M kaldı"
  kalan=$(echo "$cikti" | grep -oE '[0-9]+ kaldı' | grep -oE '[0-9]+' | paste -sd+ | bc 2>/dev/null)
  kalan=${kalan:-0}
  olumlu=$(echo "$cikti" | grep -icE '✓|✅|geçti|GEÇTİ|TAMAM')

  if [ $kod -ne 0 ] || echo "$cikti" | grep -qE '✗|❌|ERROR|FATAL' || [ "$kalan" -gt 0 ]; then
    KIRMIZI=$((KIRMIZI+1)); KIRIKLAR="$KIRIKLAR $ad"
    echo "❌ $ad — $(echo "$cikti" | grep -E '✗|❌|ERROR|FATAL' | head -1 | cut -c1-130)"
  elif [ "$olumlu" -eq 0 ]; then
    KIRMIZI=$((KIRMIZI+1)); KIRIKLAR="$KIRIKLAR $ad(sessiz)"
    echo "❌ $ad — hiç doğrulama basmadı; sessiz prova kanıt değildir"
  else
    YESIL=$((YESIL+1))
    echo "✅ $ad"
  fi
done

echo ""
echo "YEŞİL: $YESIL   KIRMIZI: $KIRMIZI   (toplam $((YESIL+KIRMIZI)) dosya)"
[ -n "$KIRIKLAR" ] && echo "Kırık:$KIRIKLAR"

# ═══════════════════════════════════════════════════════════════════════════
# SON KOŞU KAYDI · HEDEFLER 4.11.9
#
# ⚠️ NEDEN VAR: 07.11.2026'da 54 provanın 13'ü aylardır kırmızıydı ve kimse
# bilmiyordu — çünkü hepsini bir arada koşturmak BİR ADIMA BAĞLI DEĞİLDİ,
# yani kimsenin görevi değildi. Göçler yazıldıkça provalar sessizce yanlışa
# düştü (tuzak 190).
#
# `kaydet.ps1`e eklenemez: provalar yerel bir PostgreSQL 16 istiyor,
# Emrah'ın makinesinde yok. O yüzden bağ TERSİNDEN kuruluyor: bu betik
# yeşil bitince son koşuyu kaydediyor, `src/core/prova-kosuldu.arch.test.ts`
# ise kaydı depodaki göçlerle karşılaştırıyor. Kayıtta olmayan bir göç
# varsa `npm test` KIRMIZI yanıyor ve commit atılamıyor.
#
# ⚠️ KIRMIZI KOŞU KAYIT BIRAKMAZ, VARSA SİLER. "Koştum" demek yetmez;
# yeşil koştuğunu göstermek gerekir. Kayıt yoksa mimari sınama da kırmızı
# yanar — yani sessiz kalmak bir çıkış yolu değil.
#
# ⚠️ BU BİR GÜVENLİK DENETİMİ DEĞİL, BİR HATIRLATICIDIR. Dosya elle de
# yazılabilir; amaç kötü niyeti durdurmak değil, UNUTMAYI durdurmak.
# ═══════════════════════════════════════════════════════════════════════════
KAYIT="$PROVA/son-kosu.json"
GOCLER="$(cd "$PROVA/../migrations" && pwd)"
EN_YENI=$(basename "$(ls "$GOCLER"/[0-9][0-9][0-9][0-9]_*.sql | sort | tail -1)")
GOC_SAYISI=$(ls "$GOCLER"/[0-9][0-9][0-9][0-9]_*.sql | wc -l | tr -d ' ')
PROVA_SAYISI=$(ls "$PROVA"/prova-*.sql | wc -l | tr -d ' ')

if [ $KIRMIZI -gt 0 ]; then
  rm -f "$KAYIT"
  echo "Son koşu kaydı SİLİNDİ: kırmızı koşu kayıt bırakmaz."
  exit 1
fi

cat > "$KAYIT" <<KAYITSONU
{
  "aciklama": "Butun provalarin temiz bir veritabaninda kostugu SON tam kosu. Bu dosyayi hepsini-kosturt.sh yazar; elle duzenlenmez. Karsilastiran sinama: src/core/prova-kosuldu.arch.test.ts (HEDEFLER 4.11.9).",
  "tarih": "$(date -u +%Y-%m-%d)",
  "en_yeni_goc": "$EN_YENI",
  "goc_sayisi": $GOC_SAYISI,
  "prova_sayisi": $PROVA_SAYISI,
  "yesil": $YESIL,
  "kirmizi": $KIRMIZI,
  "ortam": "PostgreSQL 16 - temiz veritabani - kur.sh + hepsini-kosturt.sh"
}
KAYITSONU
echo "Son koşu kaydedildi: $KAYIT ($EN_YENI, $GOC_SAYISI göç, $PROVA_SAYISI prova)"
exit 0
