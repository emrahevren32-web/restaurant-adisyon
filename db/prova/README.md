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

## Bugünkü durum (18.10.2026, göç 0089)

**37 dosya · 26 YEŞİL · 11 KIRMIZI**

Codex 14 kırmızıyı kaynaktan ayırdı (17.10.2026) ve **hiçbirinden ürün
gerilemesi çıkmadı**: 10'u bayat kurulum/beklenti, 3'ü çalıştırıcının
yanlış kırmızısı (MIYOP-041, düzeltildi), 1'i tamamlanmamış negatif prova.

Kalan 11 kırmızı: `prova-0051, 0056, 0057, 0065, 0070, 0071b, 0071c,
0073, 0076, 0077, 0083`.

| Dosya | Codex'in teşhisi |
|---|---|
| `0051` | Siparişi doğrudan Taslak → Onaylandı yapıyor; güncel zincir önce onay istiyor |
| `0056` | Oluşturmadığı `ABC` kiracısını varsayıyor |
| `0057` | Aynı `ABC` varsayımı + doğrudan alerjen damgası artık bilinçli yasak |
| `0065` | Rapor çağırıyor ama kullanıcı/JWT kurmuyor; `finance.read` kapısı reddediyor |
| `0070` | Aynı finans kapısı |
| `0071b` | Ham fonksiyon sayısını ikiyle sınırlıyor; 0074 iki meşru ham rapor daha ekledi |
| `0071c` | Fonksiyonları kendisi kaldırıp hata bekliyor; **prova tasarım hatası** |
| `0073` | İzin sayısını 34 bekliyor; 35. izin `quality.record.manage`, **0081**'de eklendi |
| `0076` | `Depo Cu → depocu` bekliyor; 0078'in bilinçli kuralı `depo.cu` |
| `0077` | Aynı normalleşme; ⚠️ ayrıca gerçek bir güvenlik açığını sınamıyor (MIYOP-043) |
| `0083` | 0084'ün bilinçli kaldırdığı `platform_populer_urunler`i çağırıyor |

## ⚠️ KÖR PROVALAR · rol takmayanlar

0089'dan sonra bir prova `set local role authenticated` yapmadıkça
kapıların **DIŞINDA** koşar: bütün yazımlar sessizce geçer ve prova yeşil
görünür. 13 dosya hâlâ böyle; liste
`src/authorization/yazma-kapilari-tamam.arch.test.ts` içinde
**dondurulmuştur** ve yalnız kısalabilir.

`prova-0081` ve `prova-0082` bu yüzden körleşmişti; 0089 uygulanınca
kırmızıya döndüler ve onarıldılar. Portal provaları (`0054`, `0063`)
aynı sebeple MIYOP-039'u yakalayamamıştı (Codex · MIYOP-042).

## Sırada ne var (6.12)

1. ✅ 14 dosya ayrıldı (Codex): hepsi bayat / ölçüm hatası, gerileme yok
2. ⬜ 11 bayat dosyayı güncelle
3. ⬜ 13 kör provaya gerçek rol taktır (önce portal: `0054`, `0063`)
4. ⬜ `hepsini-kosturt.sh`i **yayın kapısına** ekle (şu an elle koşuyor)

Dördüncüsü bitene kadar şu doğru değildir: *"provalar geçiyor."*
Doğrusu: *"provaları elle koşturdum ve şu an 26'sı geçiyor."*
