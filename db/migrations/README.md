# Veritabanı migration'ları

Sıra önemlidir. Her dosyanın **içeriğini** Supabase → SQL Editor'e yapıştırıp çalıştır.
Dosya adını değil, içindekini.

| # | Dosya | Ne yapar |
|---|-------|----------|
| 0 | `0000_durum.sql` | Durum kontrolü. Hiçbir şey değiştirmez, ne kurulduğunu listeler. |
| 1 | `0001_kimlik_ve_tenant.sql` | Tenant, firma, şube, kullanıcı, rol, izin + RLS |
| 2 | `0002_birimler.sql` | Ölçü birimleri, dönüşüm tablosu ve dönüşüm fonksiyonu |
| 3 | `0003_stok_defteri.sql` | Stok kartı, lot, hareket defteri, lot soyağacı + RLS |
| 4 | `0004_dogrulama.sql` | Şemayı sınar, sonuçları tablo olarak döndürür. **Veri bırakmaz.** |
| 5 | `0005_referans_tablolari.sql` | Referans tablolarına okuma politikası |

Hepsi tekrar çalıştırılabilir. `0000` ve `0004`'ü istediğin zaman koşabilirsin.

## Politikasız RLS tuzağı

Supabase projesinde **Enable automatic RLS** açık. Bu iyi bir varsayılan: public
şemasında açılan her tabloda RLS otomatik etkinleşiyor, yani kimse yanlışlıkla
korumasız tablo bırakamıyor.

Ama şu tuzağı beraberinde getiriyor: **politikası olmayan RLS, herkese kapalı
demektir.** `0005` bu yüzden var — `permission`, `role`, `role_permission`,
`uom`, `uom_conversion` tenant'a ait olmadığı için tenant politikası almamıştı
ve politikasız kalmışlardı. Uygulama bağlandığında yetki listesini okuyamaz,
kg'ı grama çeviremezdi.

**Kural:** `0000` çıktısında `politika` sütunu **0** olan hiçbir satır kalmamalı.

## Bilinen sınır

Supabase SQL Editor `postgres` süper kullanıcısı olarak çalışır ve süper kullanıcılar
**RLS'i atlar**. Yani `0004` RLS'i sınayamaz; sınadığı şeyler append-only,
idempotency, ters kayıt, lot zorunluluğu, birim dönüşümü ve merkez şube tekilliğidir.

RLS'in gerçekten çalıştığı, Dilim 0 / G7'de ayrı bir rolle ve uygulamanın kendi
bağlantısıyla doğrulanacaktır — ADR-004'teki "negatif kontrol" maddesi budur.
Şu an "RLS kuruldu" diyoruz, "RLS kanıtlandı" demiyoruz.
