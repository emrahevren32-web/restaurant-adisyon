#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# MİYOP · SUNUCU KURULUMU — BİR KEZ ÇALIŞTIRILIR
#
#   Hedef : miyop.emrahevren.com  (Ubuntu 24.04 + Nginx + Let's Encrypt)
#   Yapar : web kökünü açar, Nginx site ayarını yazar, sınar, yeniden yükler
#   YAPMAZ: sertifika almaz (zaten var), Node kurmaz, Docker kurmaz,
#           ters vekil kurmaz — gerek yok
#
# ── NEDEN TERS VEKİL YOK ──────────────────────────────────────────────────
# MİYOP arka planda çalışan bir sunucu programı DEĞİL. Vite ile statik
# dosyalara derleniyor; veritabanı Supabase'de. Nginx'in tek işi o dosyaları
# yayınlamak. Arkada süreç yok demek, çökecek şey yok demek.
#
# ── EN KRİTİK SATIR ───────────────────────────────────────────────────────
# `try_files $uri $uri/ /index.html;`
# Tek sayfa uygulaması olduğu için /depo, /receteler gibi adresler sunucuda
# DOSYA OLARAK YOK. Bu satır olmazsa kullanıcı sayfayı yenilediğinde 404
# alır. Kurulumlarda en sık atlanan şey budur.
#
# ⚠️ Bu betik mevcut ayarı SİLMEZ, yedekler. Geri dönüş yolu sonda yazılı.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ALAN="miyop.emrahevren.com"
KOK="/var/www/miyop"
SITE="/etc/nginx/sites-available/${ALAN}"
BAGLANTI="/etc/nginx/sites-enabled/${ALAN}"
DAMGA="$(date +%Y%m%d-%H%M%S)"
YEDEK="/root/miyop-nginx-yedek-${DAMGA}"

bilgi(){ printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
tamam(){ printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
uyari(){ printf '  \033[1;33m!\033[0m %s\n' "$*"; }
hata(){  printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || hata "root olarak çalıştır (sudo -i)."

# ── 1 · ÖN KONTROLLER ─────────────────────────────────────────────────────
bilgi "1/6 · Ön kontroller"

command -v nginx >/dev/null || hata "Nginx kurulu değil."
NGX_SURUM="$(nginx -v 2>&1 | sed 's|.*/||')"
tamam "Nginx var: ${NGX_SURUM}"

# ⚠️ `http2 on;` YÖNERGESİ 1.25.1'DE GELDİ. Ubuntu 24.04 nginx 1.24 ile
#    geliyor ve o sürümde bu satır "unknown directive" hatası verir.
#    Eski sürümde doğru yazım: `listen 443 ssl http2;`
NGX_ANA="${NGX_SURUM%%.*}"
NGX_ORTA="$(echo "$NGX_SURUM" | cut -d. -f2)"
if [ "$NGX_ANA" -gt 1 ] || { [ "$NGX_ANA" -eq 1 ] && [ "$NGX_ORTA" -ge 25 ]; }; then
  DINLE_443=$'    listen 443 ssl;\n    listen [::]:443 ssl;\n    http2 on;'
  tamam "HTTP/2 yeni yazımla (http2 on;)"
else
  DINLE_443=$'    listen 443 ssl http2;\n    listen [::]:443 ssl http2;'
  tamam "HTTP/2 eski yazımla (listen ... http2) — nginx < 1.25"
fi

SERT="/etc/letsencrypt/live/${ALAN}/fullchain.pem"
ANAHTAR="/etc/letsencrypt/live/${ALAN}/privkey.pem"
[ -f "$SERT" ]    || hata "Sertifika yok: $SERT"
[ -f "$ANAHTAR" ] || hata "Özel anahtar yok: $ANAHTAR"
BITIS="$(openssl x509 -enddate -noout -in "$SERT" | cut -d= -f2)"
tamam "Sertifika geçerli · bitiş: ${BITIS}"

# Certbot'un kendi SSL ayar dosyaları var mı? Varsa dahil edeceğiz.
SSL_EK=""
if [ -f /etc/letsencrypt/options-ssl-nginx.conf ]; then
  SSL_EK="    include /etc/letsencrypt/options-ssl-nginx.conf;"
  tamam "Certbot SSL ayar dosyası bulundu, dahil edilecek"
else
  uyari "options-ssl-nginx.conf yok — temel TLS ayarı yazılacak"
  SSL_EK=$'    ssl_protocols TLSv1.2 TLSv1.3;\n    ssl_prefer_server_ciphers off;\n    ssl_session_cache shared:SSL:10m;\n    ssl_session_timeout 1d;'
fi
if [ -f /etc/letsencrypt/ssl-dhparams.pem ]; then
  SSL_EK="${SSL_EK}"$'\n'"    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"
fi

# ── 2 · MEVCUT AYARI YEDEKLE ──────────────────────────────────────────────
bilgi "2/6 · Mevcut Nginx ayarı yedekleniyor"
mkdir -p "$YEDEK"
cp -a /etc/nginx/sites-available "$YEDEK/" 2>/dev/null || true
cp -a /etc/nginx/sites-enabled   "$YEDEK/" 2>/dev/null || true
tamam "Yedek: $YEDEK"

echo "  Şu an etkin siteler:"
ls -1 /etc/nginx/sites-enabled/ 2>/dev/null | sed 's/^/    · /' || echo "    (yok)"

# ── 3 · WEB KÖKÜ ──────────────────────────────────────────────────────────
bilgi "3/6 · Web kökü hazırlanıyor"
if [ -d "$KOK" ] && [ -n "$(ls -A "$KOK" 2>/dev/null)" ]; then
  mv "$KOK" "${KOK}.onceki-${DAMGA}"
  uyari "Eski içerik taşındı: ${KOK}.onceki-${DAMGA}"
fi
mkdir -p "$KOK"
chown -R www-data:www-data "$KOK"
chmod 755 "$KOK"

# Dosyalar yüklenene kadar görünecek geçici sayfa.
cat > "${KOK}/index.html" <<'GECICI'
<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MİYOP</title>
<style>body{background:#0f172a;color:#e2e8f0;font:16px/1.6 system-ui,sans-serif;
display:grid;place-items:center;min-height:100vh;margin:0;text-align:center}
h1{color:#38bdf8;letter-spacing:.2em;margin:0 0 .5rem}</style></head>
<body><div><h1>MİYOP</h1><p>Uygulama dosyaları henüz yüklenmedi.</p></div></body></html>
GECICI
chown www-data:www-data "${KOK}/index.html"
tamam "Web kökü hazır: $KOK"

# ── 4 · SİTE AYARI ────────────────────────────────────────────────────────
bilgi "4/6 · Nginx site ayarı yazılıyor"

mkdir -p /etc/nginx/snippets
cat > /etc/nginx/snippets/miyop-guvenlik.conf <<'GUVENLIK'
# MİYOP güvenlik başlıkları — hem server hem her add_header'lı location
# bloğunda dahil edilir (nginx add_header kalıtımı yoktur).
add_header X-Content-Type-Options  "nosniff"                              always;
add_header X-Frame-Options         "DENY"                                 always;
add_header Referrer-Policy         "strict-origin-when-cross-origin"      always;
add_header Permissions-Policy      "geolocation=(), microphone=(), camera=()" always;
# HSTS · tarayıcıya "bu alan adına hep https ile gel" der.
# ⚠️ Bir yıl boyunca geri alınamaz; alan adından emin olduğumuz için açık.
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
GUVENLIK
tamam "Güvenlik başlıkları: /etc/nginx/snippets/miyop-guvenlik.conf"
cat > "$SITE" <<NGINX
# MİYOP · ${ALAN}
# Üreten: miyop-sunucu-kurulum.sh (${DAMGA})
# Statik tek sayfa uygulaması. Arka planda süreç YOK, ters vekil YOK.

server {
    listen 80;
    listen [::]:80;
    server_name ${ALAN};

    # Let's Encrypt yenilemesi bu yolu kullanır — yönlendirmeden ÖNCE gelmeli.
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    location / { return 301 https://\$host\$request_uri; }
}

server {
${DINLE_443}
    server_name ${ALAN};

    ssl_certificate     ${SERT};
    ssl_certificate_key ${ANAHTAR};
${SSL_EK}

    root ${KOK};
    index index.html;

    # ── Güvenlik başlıkları ──────────────────────────────────────────────
    # ⚠️ NGINX TUZAĞI: bir "location" bloğunda "add_header" kullanırsan, üst
    #    bloktaki BÜTÜN add_header'lar O LOCATION İÇİN DÜŞER. Aşağıda iki
    #    location kendi önbellek başlığını yazıyor; o yüzden güvenlik
    #    başlıkları ayrı bir dosyaya kondu ve ÜÇ YERDE de dahil ediliyor.
    include /etc/nginx/snippets/miyop-guvenlik.conf;

    # Sunucu sürümünü gizle
    server_tokens off;

    # ── Sıkıştırma ───────────────────────────────────────────────────────
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript
               application/json image/svg+xml font/woff2;

    # Yüklenen dosya boyutu (Excel içe aktarma vb. için)
    client_max_body_size 25m;

    # ── Vite'ın parmak izli dosyaları: bir yıl önbellek ──────────────────
    # Dosya adında özet (hash) var; içerik değişince ad da değişir.
    location /assets/ {
        try_files \$uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable" always;
        include /etc/nginx/snippets/miyop-guvenlik.conf;
    }

    # ── index.html ASLA önbelleğe alınmaz ────────────────────────────────
    # Güncelleme yapıldığında kullanıcı yeni sürümü hemen görsün diye.
    location = /index.html {
        add_header Cache-Control "no-store, must-revalidate" always;
        include /etc/nginx/snippets/miyop-guvenlik.conf;
    }

    # ── TEK SAYFA UYGULAMASI · EN KRİTİK SATIR ───────────────────────────
    # /depo, /receteler gibi adresler sunucuda dosya olarak YOK.
    # Bu satır olmazsa sayfa yenilendiğinde 404 gelir.
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Gizli dosyalara erişim yok
    location ~ /\\. { deny all; }
}
NGINX
tamam "Yazıldı: $SITE"

# ── 5 · ETKİNLEŞTİR VE SINA ───────────────────────────────────────────────
bilgi "5/6 · Ayar sınanıyor"
ln -sfn "$SITE" "$BAGLANTI"

# Ubuntu'nun varsayılan sitesi 80/443'ü kapabiliyor.
if [ -L /etc/nginx/sites-enabled/default ]; then
  rm -f /etc/nginx/sites-enabled/default
  uyari "Varsayılan site devre dışı bırakıldı (yedekte duruyor)"
fi

if ! nginx -t 2>/tmp/nginx-test.log; then
  cat /tmp/nginx-test.log >&2
  uyari "Ayar HATALI. Yedek geri yükleniyor…"
  rm -f "$BAGLANTI"
  cp -a "$YEDEK/sites-enabled/." /etc/nginx/sites-enabled/ 2>/dev/null || true
  nginx -t && systemctl reload nginx || true
  hata "Nginx ayarı sınamayı geçemedi. Yukarıdaki hatayı bana gönder."
fi
tamam "nginx -t geçti"

systemctl reload nginx
tamam "Nginx yeniden yüklendi"

# ── 6 · DOĞRULAMA ─────────────────────────────────────────────────────────
bilgi "6/6 · Doğrulama"

HTTPS_KOD="$(curl -s -o /dev/null -w '%{http_code}' "https://${ALAN}/" || echo 000)"
HTTP_KOD="$(curl -s -o /dev/null -w '%{http_code}' "http://${ALAN}/" || echo 000)"
SPA_KOD="$(curl -s -o /dev/null -w '%{http_code}' "https://${ALAN}/depo" || echo 000)"

[ "$HTTPS_KOD" = "200" ] && tamam "https://${ALAN}/ → 200" \
  || uyari "https://${ALAN}/ → ${HTTPS_KOD}"
[ "$HTTP_KOD" = "301" ] && tamam "http:// → 301 (https'e yönlendiriyor)" \
  || uyari "http:// → ${HTTP_KOD} (301 bekleniyordu)"
[ "$SPA_KOD" = "200" ] && tamam "https://${ALAN}/depo → 200 (TEK SAYFA YÖNLENDİRMESİ ÇALIŞIYOR)" \
  || uyari "https://${ALAN}/depo → ${SPA_KOD} — try_files çalışmıyor, bana söyle"

cat <<SON

═══════════════════════════════════════════════════════════════════════
 SUNUCU HAZIR.

 Sıradaki adım, uygulama dosyalarını yüklemek. Kendi bilgisayarında
 PowerShell'de, proje klasöründe:

   npm run build
   scp -i "\$env:USERPROFILE\\.ssh\\miyop_hetzner" -r dist/* root@${ALAN}:${KOK}/

 Yükledikten sonra sunucuda tek satır:

   chown -R www-data:www-data ${KOK}

 ── GERİ DÖNÜŞ ────────────────────────────────────────────────────────
 Bir şey ters giderse:

   rm -f ${BAGLANTI}
   cp -a ${YEDEK}/sites-enabled/. /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx

 Eski web içeriği (varsa): ${KOK}.onceki-${DAMGA}
═══════════════════════════════════════════════════════════════════════
SON
