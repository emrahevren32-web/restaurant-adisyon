#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# MİYOP · Yerel doğrulama
#
# Emrah'ın makinesindeki `npm run typecheck ; npm test` komutunun buradaki
# karşılığı. Kurulumun ayrıntısı: /home/claude/miyop-work/KURULUM.md
#
# ⚠️ 2026-09-19'DA EKLENEN ÖZET SATIRI — NEDEN VAR
# Emrah'a sözdizimi hatası olan bir dosya gönderdim (TypeScript'te bitişik
# metinler `+` ile birleşir; SQL refleksiyle yazmışım). tsc bunu YAKALADI,
# ama ben çıktıyı `tail -8` ile kestiğim için TİP KONTROLÜ satırını hiç
# görmedim ve "temiz" sandım.
#
# Ders: doğrulamanın sonucu, çıktının NEREDEN kesildiğine bağlı olmamalı.
# Artık en son satır tek başına her şeyi söylüyor; kesilse bile son satır
# kalır. `SONUC: TEMIZ` görmeden hiçbir dosya gönderilmez.
# ═══════════════════════════════════════════════════════════════════════════
cd /tmp/repo || exit 1

tip_durum="TEMIZ"
echo "── TİP KONTROLÜ ──────────────────────────────────────────────"
timeout 240 /home/claude/.npm-global/bin/tsc -p tsconfig.kontrol.json > /tmp/tc-ham.txt 2>&1
tsc_kod=$?
grep "error TS" /tmp/tc-ham.txt | sort > /tmp/tc-now.txt

# ⚠️ tsc HİÇ ÇALIŞMADIYSA (timeout, çökme) çıktı boş olur ve eski hâlinde
# bu "temiz" sayılırdı — en tehlikeli yanlış. Çıkış kodu 0 ya da 2 değilse
# sonuç güvenilmezdir.
if [ "$tsc_kod" -ne 0 ] && [ "$tsc_kod" -ne 2 ]; then
  echo "  TSC ÇALIŞMADI (çıkış kodu $tsc_kod). Sonuç güvenilmez."
  tail -5 /tmp/tc-ham.txt | sed 's/^/    /'
  tip_durum="CALISMADI"
else
  yeni=$(comm -13 /tmp/tc-baseline.txt /tmp/tc-now.txt)
  if [ -z "$yeni" ]; then
    echo "  Temiz. (Taklit tiplerden gelen $(wc -l < /tmp/tc-baseline.txt) bilinen uyarı hariç.)"
  else
    echo "  YENİ HATALAR:"; echo "$yeni" | sed 's/^/    /'
    tip_durum="HATALI"
  fi
fi

echo
echo "── TESTLER ───────────────────────────────────────────────────"
test_durum="GECTI"
if ! /home/claude/miyop-work/derle.sh > /tmp/derleme.log 2>&1; then
  echo "  DERLEME BAŞARISIZ"; tail -5 /tmp/derleme.log
  test_durum="DERLENMEDI"
else
  timeout 500 /home/claude/miyop-work/test-kos.sh > /tmp/test.log 2>&1
  grep -E "✗|YÜKLENEMEDİ|ÇÖKTÜ" /tmp/test.log | sed 's/^/  /' | head -20
  tail -2 /tmp/test.log
  # Bilinen iki dosya hariç kırmızı varsa test durumu bozuktur.
  beklenmedik=$(grep -E "^\s*✗" /tmp/test.log \
    | grep -vE "authenticateUser\.test|role-assignment\.test" | wc -l)
  if [ "$beklenmedik" -gt 0 ]; then test_durum="KALDI"; fi
  if ! grep -q "Toplam:" /tmp/test.log; then test_durum="KOSMADI"; fi
fi

echo
echo "  Not: role-assignment ve authenticateUser testleri vi.mock (modül taklidi)"
echo "  kullanıyor; koşucumuz bunu desteklemiyor. Onlar Emrah'ın makinesinde geçiyor."
echo
# ⚠️ EN SON SATIR. Çıktı nereden kesilirse kesilsin bu görünür.
if [ "$tip_durum" = "TEMIZ" ] && [ "$test_durum" = "GECTI" ]; then
  echo "SONUC: TEMIZ · tip $tip_durum · test $test_durum"
else
  echo "SONUC: ################ BOZUK ################ · tip $tip_durum · test $test_durum"
fi
