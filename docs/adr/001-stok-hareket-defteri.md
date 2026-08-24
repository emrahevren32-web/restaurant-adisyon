# ADR-001 · Stok hareket defteri tek gerçektir

- **Durum:** Kabul edildi (Claude · GPT · Emrah, 2026-08-23)
- **Etkilediği dilimler:** 1, 2, 3, 4, 5, 6
- **Bunu değiştirmek şemayı değiştirir.** Değiştirmek isteyen yeni ADR açar.

---

## Bağlam

Bugünkü kodda `StockItem.currentQty` gerçeğin kendisidir. `StockMovement` ise
`previousQty` / `nextQty` alanlarıyla o değişimi **sonradan yansıtan** bir günlüktür.

Bunun üç somut sonucu var:

1. **Rakam açıklanamıyor.** "Bu 428 kg neden 428 kg?" sorusunun cevabı bir alandır, gerekçe değil.
2. **Yazan yalnızca bir yer var.** `shipment-execution.service.ts` dışında hiçbir modül
   stoka yazmıyor. Mal kabul yazmıyor, üretim yazmıyor. `deductStockForOrder`
   (`stockDeduction.ts:181`) tanımlı ama hiçbir yerden çağrılmıyor.
3. **İzlenebilirlik kurulamıyor.** Lot bazlı ileri/geri izleme, hareket defteri gerçek
   olmadan yazılamaz. Bu gıda üretiminde yasal bir gerekliliktir ve aynı zamanda
   ürünün en güçlü satış argümanıdır.

---

## Karar

**`stock_movement` append-only bir defterdir ve tek gerçektir. Mevcut miktar bu defterden
türetilir, saklanmaz.**

```
YANLIŞ                                  DOĞRU
StockItem.currentQty = gerçek           stock_movement = gerçek
StockMovement = geçmiş kaydı            currentQty = SUM(quantity_base)
```

Bağlı üç alt karar:

- **Düzeltme yoktur, ters kayıt vardır.** Satır `UPDATE`/`DELETE` edilmez.
- **Her post idempotenttir.** Aynı iş iki kez gönderilirse stok iki kez değişmez.
- **Stok yazan tek kapı `postMovement()`'tır.** Başka hiçbir kod yolu stoka yazmaz.

---

## Şema

Aşağıdaki DDL sözleşmedir; Drizzle tanımı buna birebir karşılık gelmelidir.

### Birim

```sql
create table uom (
  code          text primary key,              -- 'kg','g','lt','ml','adet'
  dimension     text not null                  -- 'MASS','VOLUME','COUNT'
);

create table uom_conversion (
  from_uom      text not null references uom(code),
  to_uom        text not null references uom(code),
  factor        numeric(18,8) not null check (factor > 0),
  primary key (from_uom, to_uom)
);
```

> Dönüşüm tenant'a bağlı değildir; kg→g her yerde 1000'dir. Reçeteye özgü verim
> (`yield`) burada değil, iş emrinde tutulur.

### Stok kartı

```sql
create table stock_item (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id),
  branch_id     uuid not null references branch(id),
  code          text not null,
  name          text not null,
  base_uom      text not null references uom(code),   -- defterin birimi
  tracks_lot    boolean not null default false,
  tracks_expiry boolean not null default false,
  min_qty       numeric(18,6) not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (tenant_id, branch_id, code)
);
```

`current_qty` kolonu **yoktur ve eklenmeyecektir.**

### Lot

```sql
create table stock_lot (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id),
  branch_id     uuid not null references branch(id),
  stock_item_id uuid not null references stock_item(id),
  lot_code      text not null,
  expires_on    date,
  origin_type   text not null check (origin_type in ('RECEIPT','PRODUCTION','OPENING')),
  origin_id     uuid,
  created_at    timestamptz not null default now(),
  unique (tenant_id, stock_item_id, lot_code)
);
```

### Hareket defteri

```sql
create table stock_movement (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenant(id),
  branch_id             uuid not null references branch(id),
  stock_item_id         uuid not null references stock_item(id),
  lot_id                uuid references stock_lot(id),

  -- defter birimi, işaretli: + giriş, − çıkış
  quantity_base         numeric(18,6) not null check (quantity_base <> 0),

  -- kullanıcının girdiği hâli (denetim ve ekran için korunur)
  quantity_entered      numeric(18,6) not null,
  uom_entered           text not null references uom(code),

  reason                text not null,   -- aşağıdaki listeden
  source_type           text not null,   -- 'goods_receipt','work_order','shipment','count','manual'
  source_id             uuid,

  unit_cost             numeric(18,6),
  currency              char(3),

  reverses_movement_id  uuid references stock_movement(id),
  idempotency_key       text not null,

  occurred_at           timestamptz not null,                 -- iş zamanı
  recorded_at           timestamptz not null default now(),   -- sistem zamanı
  created_by            uuid not null references app_user(id),

  unique (tenant_id, idempotency_key)
);

-- bir hareket yalnızca bir kez ters çevrilebilir
create unique index stock_movement_reversal_once
  on stock_movement (reverses_movement_id)
  where reverses_movement_id is not null;

create index stock_movement_balance_ix
  on stock_movement (tenant_id, branch_id, stock_item_id, occurred_at);
```

**`reason` değerleri** — kapalı liste, yeni değer ADR ile eklenir:

```
PURCHASE_RECEIPT      mal kabul girişi
PURCHASE_RETURN       tedarikçiye iade
PRODUCTION_CONSUME    üretim tüketimi
PRODUCTION_OUTPUT     mamul girişi
PRODUCTION_WASTE      üretim firesi
SHIPMENT_OUT          sevkiyat çıkışı
SHIPMENT_RETURN       müşteri iadesi
COUNT_SURPLUS         sayım fazlası
COUNT_SHORTAGE        sayım eksiği
EXPIRY_WRITE_OFF      SKT nedeniyle imha
WASTE                 fire / zayi
TRANSFER_IN           şubeler arası giriş
TRANSFER_OUT          şubeler arası çıkış
OPENING_BALANCE       açılış bakiyesi (yalnızca migrasyonda)
REVERSAL              ters kayıt
```

### Append-only zorlaması

Uygulama katmanına güvenilmez; veritabanı reddeder:

```sql
create or replace function stock_movement_is_immutable() returns trigger as $$
begin
  raise exception 'stock_movement append-only: UPDATE/DELETE yasak (id=%)',
    coalesce(old.id, new.id);
end $$ language plpgsql;

create trigger stock_movement_no_update before update on stock_movement
  for each row execute function stock_movement_is_immutable();
create trigger stock_movement_no_delete before delete on stock_movement
  for each row execute function stock_movement_is_immutable();

revoke update, delete on stock_movement from public;
```

### Türetilmiş miktar

```sql
create view stock_balance as
select tenant_id, branch_id, stock_item_id,
       sum(quantity_base) as qty
from stock_movement
group by tenant_id, branch_id, stock_item_id;

create view stock_lot_balance as
select tenant_id, branch_id, stock_item_id, lot_id,
       sum(quantity_base) as qty
from stock_movement
where lot_id is not null
group by tenant_id, branch_id, stock_item_id, lot_id;
```

Performans gerektiğinde `stock_balance_snapshot` materialized view eklenir.
**Snapshot hiçbir zaman gerçek değildir**; defterle farkı çıkarsa hatalı olan snapshot'tır
ve test bunu yakalar.

### Lot soyağacı

```sql
create table lot_genealogy (
  parent_lot_id  uuid not null references stock_lot(id),
  child_lot_id   uuid not null references stock_lot(id),
  work_order_id  uuid not null,
  quantity_base  numeric(18,6) not null,
  primary key (parent_lot_id, child_lot_id, work_order_id),
  check (parent_lot_id <> child_lot_id)
);
```

**Geri çağırma sorgusu** — Dilim 5'in tamamı bu tek sorgudur:

```sql
with recursive etkilenen as (
  select id from stock_lot where lot_code = $1 and tenant_id = $2
  union
  select g.child_lot_id from lot_genealogy g join etkilenen e on g.parent_lot_id = e.id
)
select distinct m.source_id as sevkiyat_id
from stock_movement m
where m.lot_id in (select id from etkilenen)
  and m.reason = 'SHIPMENT_OUT';
```

### RLS

Her tabloda, istisnasız:

```sql
alter table stock_movement enable row level security;
alter table stock_movement force row level security;   -- tablo sahibi de muaf değil

create policy tenant_isolation on stock_movement
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

`force` satırı atlanırsa politika tablo sahibi için çalışmaz. Bu, RLS'in en sık
atlanan detayıdır.

---

## Değişmezler (invariants)

Bunlar Dilim 1'in test listesidir. Her biri bir test dosyasına karşılık gelir.

| # | Değişmez |
|---|----------|
| I1 | Bir kalemin miktarı, hareketlerinin `quantity_base` toplamına **her zaman** eşittir |
| I2 | Aynı `(tenant_id, idempotency_key)` ikinci kez yazılamaz |
| I3 | Ters kayıt bakiyeyi tam olarak eski değerine döndürür |
| I4 | Bir hareket yalnızca bir kez ters çevrilebilir |
| I5 | `stock_movement` satırı `UPDATE`/`DELETE` edilemez — veritabanı reddeder |
| I6 | `quantity_base` asla 0 olamaz |
| I7 | Birim dönüşümü kayıpsızdır: kg→g→kg aynı değeri verir |
| I8 | Lot izleyen bir kalemin hareketi `lot_id` olmadan yazılamaz |
| I9 | Farklı tenant'ın hareketi hiçbir sorguyla okunamaz (RLS kapatılırsa test kırmızıya döner) |
| I10 | Snapshot ile defter toplamı her zaman aynıdır |
| I11 | `occurred_at` geçmişe dönük olabilir; `recorded_at` her zaman gerçek yazma anıdır |
| I12 | Negatif bakiye politikası (`allow` / `warn` / `block`) tenant ayarına göre davranır |

---

## Uygulama arayüzü

```ts
export type TenantCtx = {
  tenantId: string
  branchId: string
  userId:   string
}

export type NewMovement = {
  stockItemId: string
  lotId?:      string
  quantity:    number      // işaretli, kullanıcı biriminde
  uom:         string
  reason:      MovementReason
  sourceType:  SourceType
  sourceId?:   string
  unitCost?:   number
  currency?:   string
  occurredAt?: Date        // verilmezse now()
}

export interface StockRepository {
  postMovement(ctx: TenantCtx, m: NewMovement, idempotencyKey: string): Promise<Movement>
  reverseMovement(ctx: TenantCtx, movementId: string, idempotencyKey: string): Promise<Movement>
  quantityOf(ctx: TenantCtx, stockItemId: string, at?: Date): Promise<number>
  ledgerOf(ctx: TenantCtx, stockItemId: string, range?: DateRange): Promise<Movement[]>
  lotBalances(ctx: TenantCtx, stockItemId: string): Promise<LotBalance[]>
  lotGenealogy(ctx: TenantCtx, lotCode: string): Promise<LotNode[]>
}
```

**`idempotencyKey` çağıran tarafından üretilir**, sunucu tarafından değil. Mal kabul için
örneğin `receipt:{receiptId}:line:{lineId}`. Böylece aynı satır kaç kez gönderilirse
gönderilsin tek hareket oluşur.

---

## Mevcut veriden geçiş

Bugünkü `ra_stock_movements` kayıtları **geçmiş olarak taşınmaz.** Gerekçe: yalnızca
sevkiyat servisi bu günlüğü doldurmuş; mal kabul ve üretim hiç yazmamış. Yani mevcut
günlük eksiktir ve eksik bir geçmişi gerçek gibi taşımak, yanlış rakamları
"denetlenmiş" göstermek olur.

Bunun yerine:

1. Her `(branch, stock_item)` için bugünkü `currentQty` değerinden **tek bir
   `OPENING_BALANCE` hareketi** yazılır. `occurred_at` = geçiş tarihi.
2. Eski `ra_stock_movements` içeriği `legacy_stock_movement_archive` tablosuna
   olduğu gibi kopyalanır — referans amaçlı, hiçbir hesaba girmez.
3. Geçiş tarihinden sonraki her şey gerçek defterdir.

Bu, "geçmişi uydurmaktansa geçmişin bittiği yeri işaretle" kararıdır ve pilot
müşteriye de aynen böyle anlatılır.

---

## Sonuçlar

**Kazandıklarımız**

- Her rakamın altında onu oluşturan hareket listesi açılabilir.
- Geri çağırma tek sorguya iner.
- Eşzamanlı yazımlar birbirini sessizce ezmez.
- Düzeltmeler denetlenebilir — kim, ne zaman, neyi ters çevirdi.

**Bedeli**

- Okuma maliyeti artar. Kalem sayısı büyüdüğünde snapshot gerekir.
- Silme yok; hatalı kayıt ters kayıtla düzeltilir. Kullanıcıya bu açıklanmalı,
  arayüzde "Sil" değil **"Ters Kayıt Oluştur"** yazar.
- Migrasyonda geçmiş taşınmaz.

---

## Reddedilen alternatifler

| Alternatif | Neden reddedildi |
|-----------|------------------|
| `currentQty` gerçek kalsın, defter yanında dursun | Bugünkü durum. Rakam açıklanamıyor, iki kaynak eninde sonunda ayrışıyor. |
| Tüm domain'i event sourcing yapalım | Tek kişilik ekip için aşırı. Yalnızca stokta defter tutmak faydanın %90'ını, maliyetin %15'ini veriyor. |
| Snapshot gerçek olsun, defter periyodik mutabakatla düzeltilsin | Mutabakat her zaman kayar ve kayma fark edildiğinde hangisinin doğru olduğu bilinemez. |
| Ters kayıt yerine `is_deleted` alanı | Silinmiş kaydın bakiyeye etkisi belirsizleşir; denetim izi kaybolur. |
