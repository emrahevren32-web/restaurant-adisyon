# ADR-004 · Tenant izolasyonu veritabanında zorlanır

- **Durum:** Kabul edildi (Claude · GPT · Emrah, 2026-08-23)
- **İlgili:** ADR-001 (şemadaki RLS politikaları)

---

## Bağlam

Bugün izolasyon uygulama katmanında: `tenant.ts` içindeki `filterByTenant`,
`withTenantId`, `assertTenantAccess`, `recordBelongsToTenant`.

Fikir doğru, katman yanlış. Kod tabanında **234 servis dosyası** var. Bu fonksiyonlardan
birini çağırmayı unutan **tek bir sorgu**, bir müşterinin verisini başka bir müşteriye
gösterir. Ve bu tür bir sızıntı ürünü bitirir — teknik olarak değil, ticari olarak.

Uygulama katmanı izolasyonu, en dikkatsiz satırı kadar güçlüdür.

---

## Karar

**Tenant izolasyonu PostgreSQL Row Level Security ile zorlanır.**
Uygulama katmanı kontrolleri kalır, ancak **son savunma hattı değildir.**

Dört katman, her biri bağımsız:

```
UI yetkisi  →  API authorization  →  service/domain kontrolü  →  PostgreSQL RLS
```

Bir katmanın hatası başka müşterinin verisini açığa çıkarmamalıdır.

---

## Uygulama

Her tabloda, istisnasız:

```sql
alter table <tablo> enable row level security;
alter table <tablo> force row level security;

create policy tenant_isolation on <tablo>
  using      (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

**`force row level security` satırı zorunludur.** Onsuz politika tablo sahibi için
çalışmaz — RLS'in en sık atlanan detayı budur.

`app.tenant_id`, oturum doğrulandıktan sonra bağlantı düzeyinde set edilir. Uygulama
kodu bu değeri **hiçbir zaman** istemciden gelen bir veriden almaz; yalnızca doğrulanmış
oturumdan.

### Kural

- Yeni tablo açılıyorsa **RLS ile birlikte** açılır, sonradan eklenmez.
- RLS'siz tablo migration'ı CI'da reddedilir (kontrol scripti G3.7'de yazılır).
- Şube seviyesi erişim (`user_branch_access`) ikinci bir politika olarak eklenir;
  tenant politikasının yerini almaz.

---

## Doğrulama

RLS'in gerçekten çalıştığı, yalnızca "test geçiyor" ile kanıtlanmaz. İki ek kontrol:

1. **Ham SQL testi.** Uygulama katmanını tamamen atlayarak, B tenant'ının oturumuyla
   doğrudan veritabanına A'nın verisi sorulur. Boş dönmelidir.
2. **Negatif kontrol.** RLS politikası geçici olarak kapatıldığında izolasyon testleri
   **kırmızıya dönmelidir.** Dönmüyorsa test izolasyonu ölçmüyor demektir.

İkinci madde önemli: yeşil bir test, ölçtüğünü sandığın şeyi ölçmüyor olabilir.

---

## Sonuçlar

**Kazanç:** Tek bir unutulmuş `where` sızıntıya yol açmaz. Veri sızıntısı riski
uygulama disiplininden veritabanı garantisine taşınır.

**Bedel:** Her sorgu bağlantı ayarına bağımlı hâle gelir; arka plan işleri ve migration'lar
`app.tenant_id`'yi bilinçli olarak set etmek zorundadır. Platform yöneticisi (tüm
tenant'ları gören) için ayrı bir rol ve politika gerekir.

---

## Reddedilen alternatifler

| Alternatif | Neden reddedildi |
|-----------|------------------|
| Yalnızca uygulama katmanı (bugünkü hâl) | 234 servis × insan hatası. Tek satır yeter. |
| Tenant başına ayrı şema | Migration ve bakım maliyeti tenant sayısıyla çarpılır. |
| Tenant başına ayrı veritabanı | Tek kişilik ekip için operasyonel olarak taşınamaz. |
| Repository katmanında zorlama | Doğru ama yetersiz — ham SQL ve gelecekteki yeni erişim yolları kapsam dışı kalır. |
