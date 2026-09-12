-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Dilim 0 / G6 — I12'nin GERÇEK zorlaması
-- 0011 — Negatif bakiye tetikleyicisi + kesin hata kodları
--
-- ⚠️ NEDEN BU MIGRATION VAR (Codex incelemesi, 2026-08-26 — iki bulgu):
--
--   BULGU 1 (kritik): 0010'un notu "zorlama uygulama katmanındadır" diyordu.
--   Ama `0006_yetkiler.sql` her `authenticated` kullanıcıya `stock_movement`
--   üzerinde doğrudan INSERT veriyor. Yani I12, repository'ye hiç uğramayan
--   bir REST çağrısıyla, eski bir istemciyle veya hatalı bir kodla TAMAMEN
--   atlanabiliyordu. Uygulama katmanında "zorlanan" bir şey invariant değildir;
--   yalnızca bir öneridir.
--
--   BULGU 2 (yüksek): Uygulama katmanındaki kontrol `quantityOf()` okuması ile
--   `insert` arasında TOCTOU yarışına açıktı. Bakiye 10 iken iki terminal aynı
--   anda -6 yazarsa ikisi de "sonuç 4" hesaplar, defter -2'ye düşerdi. Endüstriyel
--   mutfakta aynı hammaddenin iki istasyondan eşzamanlı düşülmesi olağandır.
--
-- ÇÖZÜM: kontrol veritabanına iniyor. 0010'daki "warn/allow'u korumak için
-- veritabanına konamaz" gerekçesi YANLIŞTI — bir `check` kısıtı gerçekten
-- politikayı okuyamaz, ama bir TETİKLEYİCİ okuyabilir. Tetikleyici politikayı
-- satırdan okur ve YALNIZCA 'block' için reddeder; 'warn'/'allow' etkilenmez.
--
-- TOCTOU aynı tetikleyicide `pg_advisory_xact_lock` ile kapanır: aynı
-- (tenant, şube, kalem) üçlüsüne yazan iki işlem sıraya girer, ikincisi
-- birincinin commit'ini gördükten sonra toplar. Kilit transaction sonunda
-- kendiliğinden bırakılır.
--
-- Tekrar çalıştırılabilir (idempotent): yalnızca `create or replace` ve
-- `drop trigger if exists` kullanır, veri değiştirmez.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Negatif bakiye tetikleyicisi (I12) ─────────────────────────────────
create or replace function app.stock_movement_negative_guard()
returns trigger
language plpgsql
as $$
declare
  v_policy      text;
  v_lock_key    bigint;
  v_current_qty numeric(18,6);
  v_result_qty  numeric(18,6);
begin
  -- I3 > I12: ters kayıt bu kontrolden BİLİNÇLİ olarak muaftır. "Ters kayıt
  -- bakiyeyi tam olarak eski değerine döndürür" invariant'ı daha önceliklidir;
  -- bir ters kaydın reddedilmesi asıl hareketi düzeltilemez bırakırdı.
  -- (Uygulama katmanındaki muafiyetle birebir aynı karar.)
  if new.reverses_movement_id is not null then
    return new;
  end if;

  -- Bakiyeyi ARTIRAN hareket negatife düşüremez. Ucuz erken çıkış: sağlıklı
  -- girişlerde ne politika sorgusu ne kilit maliyeti var.
  if new.quantity_base > 0 then
    return new;
  end if;

  -- Politika tenant satırından okunur. Satır yoksa (olmamalı) en güvenli
  -- tarafa düşülür: 'block'.
  select coalesce(t.negative_stock_policy, 'block')
    into v_policy
  from public.tenant t
  where t.id = new.tenant_id;

  v_policy := coalesce(v_policy, 'block');

  -- 'warn' ve 'allow' veritabanı tarafında ENGELLEMEZ. Kullanıcıya gösterilen
  -- uyarı metnini repository üretir (Movement.warning); veritabanının burada
  -- söyleyecek bir sözü yok. Bu erken çıkış, 0010'un "warn/allow imkansız
  -- olurdu" endişesinin neden yersiz olduğunu gösterir.
  if v_policy <> 'block' then
    return new;
  end if;

  -- ── TOCTOU kapanışı ──
  -- Aynı (tenant, şube, kalem) üçlüsüne yazan işlemleri sıraya sokar. Kilit
  -- transaction'a bağlı: commit/rollback ile kendiliğinden bırakılır, ayrıca
  -- serbest bırakma çağrısı gerekmez. Farklı kalemler birbirini beklemez.
  v_lock_key := hashtextextended(
    new.tenant_id::text || '/' || new.branch_id::text || '/' || new.stock_item_id::text,
    0
  );
  perform pg_advisory_xact_lock(v_lock_key);

  -- Toplam AÇIKÇA süzülür (RLS'e güvenilmez): SQL Editor'den süper kullanıcı
  -- olarak çalışıldığında RLS atlanır ve süzülmemiş bir toplam tüm tenant'ları
  -- kapsardı. Açık `where`, hangi rolle çalışıldığından bağımsız doğru sonucu verir.
  select coalesce(sum(m.quantity_base), 0)
    into v_current_qty
  from public.stock_movement m
  where m.tenant_id     = new.tenant_id
    and m.branch_id     = new.branch_id
    and m.stock_item_id = new.stock_item_id;

  v_result_qty := v_current_qty + new.quantity_base;

  if v_result_qty < 0 then
    raise exception
      'Negatif bakiye engellendi (I12): bu hareket bakiyeyi %s yapardı. Tenant politikası: block. (stock_item_id=%)',
      v_result_qty, new.stock_item_id
      using errcode = 'MI012';
  end if;

  return new;
end $$;

comment on function app.stock_movement_negative_guard() is
  'ADR-001 I12 — negatif bakiye politikası zorlaması. Yalnızca ''block'' politikasında '
  've yalnızca bakiyeyi azaltan, ters kayıt OLMAYAN hareketlerde devreye girer. '
  'pg_advisory_xact_lock ile TOCTOU yarışını kapatır. Hata kodu: MI012.';

drop trigger if exists stock_movement_negative_guard on stock_movement;
create trigger stock_movement_negative_guard
  before insert on stock_movement
  for each row execute function app.stock_movement_negative_guard();

-- ── 2. Lot tetikleyicisinin hata kodu kesinleştiriliyor ───────────────────
-- 0003 bu tetikleyiciyi `errcode = 'not_null_violation'` (23502) ile yazmıştı.
-- 23502 GENEL bir koddur: şemadaki herhangi bir not-null ihlali de aynı kodu
-- döndürür. İstemci "23502 gördüm → demek ki lot eksik" diye çevirdiğinde
-- alakasız hataları LotRequiredError olarak yanlış adlandırıyordu (Codex
-- bulgusu). Kendi koduna çekiliyor: MI008.
create or replace function app.stock_movement_requires_lot()
returns trigger
language plpgsql
as $$
declare
  v_tracks_lot boolean;
begin
  select tracks_lot into v_tracks_lot from stock_item where id = new.stock_item_id;

  if v_tracks_lot and new.lot_id is null then
    raise exception 'Bu stok kalemi lot takipli; lot_id olmadan hareket yazılamaz. (stock_item_id=%)',
      new.stock_item_id using errcode = 'MI008';
  end if;

  return new;
end $$;

comment on function app.stock_movement_requires_lot() is
  'ADR-001 I8 — lot takipli kalem lotsuz hareket alamaz. Hata kodu: MI008 '
  '(0003''teki genel 23502 yerine; bkz. 0011 başlığı).';

-- Tetikleyici sırası ADLARINA göredir (PostgreSQL BEFORE tetikleyicileri
-- alfabetik çalıştırır): lot_guard < negative_guard, yani lot kontrolü önce
-- çalışır. İstenen sıra budur — eksik lot, bakiye hesabından önce yakalanmalı.

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- İki tetikleyici de stock_movement üzerinde kurulu ve BEFORE INSERT olmalı.
select
  t.tgname                                   as tetikleyici,
  case t.tgtype::integer & 2 when 2 then 'BEFORE' else 'AFTER' end as zaman,
  case t.tgtype::integer & 4 when 4 then 'INSERT' else 'diğer' end as olay,
  t.tgenabled = 'O'                          as etkin_mi
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where c.relname = 'stock_movement'
  and not t.tgisinternal
order by t.tgname;
