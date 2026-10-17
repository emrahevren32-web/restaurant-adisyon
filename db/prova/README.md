# db/prova · göç provaları

Bu klasör MİYOP'un **veritabanı davranış provalarıdır.** `npm test`
TypeScript'i sınar; buradaki dosyalar **gerçek bir PostgreSQL 16 üzerinde**
`authenticated` rolüne geçerek "bu rol bunu yapabiliyor mu" diye sorar.
İkisi ayrı şeydir: bir ekranın düğmeyi gizlemesi koruma değildir, kapı
veritabanındadır — ve kapının çalıştığı ancak burada kanıtlanır.

> ⚠️ **Bu dosyalar 17.10.2026'ya kadar depoda değildi.** Claude'un çalışma
> ortamında duruyorlardı; yani kanıt vardı ama kimse göremiyordu ve
> sürümler arasında karşılaştırılamıyordu. Codex "bu dosyalar depoda yok"
> diye sorunca ortaya çıktı. → tuzak 91.

## Nasıl koşturulur

PostgreSQL 16 kurulu bir Linux'ta, root olarak:

```bash
bash db/prova/kur.sh              # temiz veritabanı + bütün göçler
bash db/prova/hepsini-kosturt.sh  # bütün provalar, YEŞİL/KIRMIZI özeti
```

Tek bir prova:

```bash
su postgres -c "psql -v ON_ERROR_STOP=1 -d miyop -f db/prova/prova-0088.sql"
```

Her prova `begin` ile başlar, `rollback` ile biter — veritabanını
kirletmez, arka arkaya koşturulabilir.

## İki prova üslubu

| Üslup | Nasıl anlaşılır | Dosyalar |
|---|---|---|
| **Yeni** | `prova_bak()` çağırır; her doğrulama `✓` ya da `✗` basar | 0072 ve sonrası |
| **Eski** | Sonda özet basar: `──── 00XX provası: N geçti, M kaldı` | 0051–0071 |

`hepsini-kosturt.sh` ikisini de anlar. Bir dosya **hiçbir olumlu işaret
basmıyorsa KIRMIZI sayılır** — sessiz prova kanıt değildir.

## Bugünkü durum (17.10.2026, göç 0088)

**36 dosya · 22 YEŞİL · 14 KIRMIZI**

Kırık olanların hiçbiri 0088'den kaynaklanmıyor: 0088 öncesi ve sonrası
taban çizgisi ayrı ayrı ölçüldü, aynı. Nedenleri üç başlıkta toplanıyor:

| Dosya | Belirti | Tahmin edilen neden |
|---|---|---|
| `prova-0051` | sipariş durumu Taslak → Onaylandı reddediliyor | sonraki göç onay zincirini zorunlu kıldı |
| `prova-0052` | hiç doğrulama basmıyor | sessiz; üslup eski, özet satırı yok |
| `prova-0055` | hiç doğrulama basmıyor | sessiz |
| `prova-0056` | `app_user.tenant_id` null | kurulum verisi sonraki göçte değişti |
| `prova-0057` | `stock_item.tenant_id` null | aynı |
| `prova-0058` | hiç doğrulama basmıyor | sessiz |
| `prova-0065` | `finance.read` izni gerekiyor | 0071 maliyet raporunu izne bağladı |
| `prova-0070` | `finance.read` izni gerekiyor | aynı |
| `prova-0071b` | ham hesaplar gövdeyi koruyor iddiası düştü | 0071 sonrası yapı değişti |
| `prova-0071c` | `app.isletme_gostergeleri` yok | göç sırası varsayımı bozuldu |
| `prova-0073` | "izin kataloğu 34 izin" | katalog **35**'e çıktı (0085 sonrası) |
| `prova-0076` | kullanıcı adı normalleşmesi | 0078 giriş adı kuralını değiştirdi |
| `prova-0077` | giriş adresi çözümü | aynı |
| `prova-0083` | `app.platform_populer_urunler` yok | 0084 o fonksiyonu **bilerek** kaldırdı |

⚠️ **Bu tablo tahmindir, teşhis değildir.** Her satırın gerçekten bayat mı
yoksa gerçek bir gerilemeyi mi gösterdiği tek tek bakılarak
belirlenecek — HEDEFLER.md madde **6.12**.

## Sırada ne var (6.12)

1. 14 dosyayı tek tek ayır: **bayat** mı, **gerçek gerileme** mi
2. Bayat olanları güncelle, gerçek gerilemeleri onar
3. `hepsini-kosturt.sh`i **yayın kapısına** ekle (şu an elle koşuyor)

Üçüncüsü bitene kadar şu doğru değildir: *"provalar geçiyor."*
Doğrusu: *"provaları elle koşturdum ve şu an 22'si geçiyor."*
