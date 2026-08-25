-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Dilim 0 / G3 — Şema doğrulama betiği
--
-- ADR-001'deki değişmezlerin gerçekten VERİTABANI tarafından zorlandığını
-- gösterir. Sonuçları tablo olarak döndürür; ekranda satır satır görürsün.
--
-- Veri bırakmaz: test verisi hem başta hem sonda temizlenir. İstediğin kadar
-- tekrar çalıştırabilirsin.
--
-- Beklenen: 11 satırın hepsinde DURUM = 'GEÇTİ'
-- ═══════════════════════════════════════════════════════════════════════════

create temp table if not exists _dogrulama (
  sira    int,
  kontrol text,
  beklenen text,
  durum   text
);
truncate _dogrulama;

-- ── Önceki koşumdan kalan test verisini temizle ────────────────────────────
create or replace function app.dogrulama_temizlik()
returns void
language plpgsql
as $$
declare
  v_tenant uuid;
begin
  select id into v_tenant from tenant where code = 'SEMA-TEST';
  if v_tenant is null then return; end if;

  -- Defter append-only; temizlik için tetikleyiciyi geçici olarak devre dışı bırakıyoruz.
  -- Bu YALNIZCA doğrulama verisi içindir, uygulama kodu bunu asla yapmaz.
  alter table stock_movement disable trigger stock_movement_no_delete;

  delete from stock_movement    where tenant_id = v_tenant;
  delete from lot_genealogy     where tenant_id = v_tenant;
  delete from stock_lot         where tenant_id = v_tenant;
  delete from stock_item        where tenant_id = v_tenant;
  delete from user_branch_access where tenant_id = v_tenant;
  delete from app_user          where tenant_id = v_tenant;
  update company set default_branch_id = null where tenant_id = v_tenant;
  delete from branch            where tenant_id = v_tenant;
  delete from company           where tenant_id = v_tenant;
  delete from tenant            where id = v_tenant;

  alter table stock_movement enable trigger stock_movement_no_delete;
end $$;

select app.dogrulama_temizlik();

-- ── Kontroller ─────────────────────────────────────────────────────────────
do $$
declare
  v_tenant uuid; v_company uuid; v_branch uuid;
  v_item uuid; v_lot uuid; v_mov uuid; v_qty numeric;
begin
  insert into tenant (code, name) values ('SEMA-TEST', 'Şema Doğrulama')
    returning id into v_tenant;
  perform set_config('app.tenant_id', v_tenant::text, true);

  insert into company (tenant_id, company_code, company_name)
    values (v_tenant, 'SEMATEST', 'Şema Test Firma') returning id into v_company;

  insert into branch (tenant_id, company_id, code, name, is_head_office)
    values (v_tenant, v_company, 'MERKEZ', 'Merkez Şube', true) returning id into v_branch;

  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom, tracks_lot)
    values (v_tenant, v_branch, 'UN-001', 'UN-001', 'Buğday Unu', 'kg', true)
    returning id into v_item;

  insert into stock_lot (tenant_id, branch_id, stock_item_id, lot_code, lot_code_key, origin_type)
    values (v_tenant, v_branch, v_item, 'LOT-2026-001', 'LOT-2026-001', 'RECEIPT')
    returning id into v_lot;

  insert into _dogrulama values
    (0, 'Kurulum', 'tenant, firma, şube, stok kartı, lot oluşur', 'GEÇTİ');

  -- I1 ───────────────────────────────────────────────────────────────────
  insert into stock_movement
    (tenant_id, branch_id, stock_item_id, lot_id, quantity_base,
     quantity_entered, uom_entered, reason, source_type, idempotency_key, occurred_at)
  values (v_tenant, v_branch, v_item, v_lot, 200, 200, 'kg',
          'PURCHASE_RECEIPT', 'goods_receipt', 'test:mal-kabul:1', now())
  returning id into v_mov;

  insert into stock_movement
    (tenant_id, branch_id, stock_item_id, lot_id, quantity_base,
     quantity_entered, uom_entered, reason, source_type, idempotency_key, occurred_at)
  values (v_tenant, v_branch, v_item, v_lot, -150, -150, 'kg',
          'PRODUCTION_CONSUME', 'work_order', 'test:uretim:1', now());

  select qty into v_qty from stock_balance where stock_item_id = v_item;
  insert into _dogrulama values (1, 'I1 · Miktar defterden türetilir',
    '200 − 150 = 50 kg',
    case when v_qty = 50 then 'GEÇTİ' else 'KALDI · gelen ' || v_qty end);

  -- I7 ───────────────────────────────────────────────────────────────────
  insert into _dogrulama values (2, 'I7 · Birim dönüşümü kayıpsız',
    'kg → g → kg aynı sayıyı verir',
    case when app.convert_uom(app.convert_uom(2.5,'kg','g'),'g','kg') = 2.5
         then 'GEÇTİ' else 'KALDI' end);

  begin
    perform app.convert_uom(1, 'kg', 'lt');
    insert into _dogrulama values (3, 'I7 · Tanımsız dönüşüm reddedilir',
      'kg → lt hata verir', 'KALDI · sessizce kabul edildi');
  exception when others then
    insert into _dogrulama values (3, 'I7 · Tanımsız dönüşüm reddedilir',
      'kg → lt hata verir', 'GEÇTİ');
  end;

  -- I2 ───────────────────────────────────────────────────────────────────
  begin
    insert into stock_movement
      (tenant_id, branch_id, stock_item_id, lot_id, quantity_base,
       quantity_entered, uom_entered, reason, source_type, idempotency_key, occurred_at)
    values (v_tenant, v_branch, v_item, v_lot, 200, 200, 'kg',
            'PURCHASE_RECEIPT', 'goods_receipt', 'test:mal-kabul:1', now());
    insert into _dogrulama values (4, 'I2 · Çift gönderim engellenir',
      'aynı anahtar ikinci kez yazılamaz', 'KALDI · stok iki katına çıktı');
  exception when unique_violation then
    insert into _dogrulama values (4, 'I2 · Çift gönderim engellenir',
      'aynı anahtar ikinci kez yazılamaz', 'GEÇTİ');
  end;

  -- I5 ───────────────────────────────────────────────────────────────────
  begin
    update stock_movement set quantity_base = 999 where id = v_mov;
    insert into _dogrulama values (5, 'I5 · Hareket güncellenemez',
      'UPDATE reddedilir', 'KALDI · defter değiştirilebiliyor');
  exception when others then
    insert into _dogrulama values (5, 'I5 · Hareket güncellenemez',
      'UPDATE reddedilir', 'GEÇTİ');
  end;

  begin
    delete from stock_movement where id = v_mov;
    insert into _dogrulama values (6, 'I5 · Hareket silinemez',
      'DELETE reddedilir', 'KALDI · defter silinebiliyor');
  exception when others then
    insert into _dogrulama values (6, 'I5 · Hareket silinemez',
      'DELETE reddedilir', 'GEÇTİ');
  end;

  -- I3 ───────────────────────────────────────────────────────────────────
  insert into stock_movement
    (tenant_id, branch_id, stock_item_id, lot_id, quantity_base,
     quantity_entered, uom_entered, reason, source_type,
     reverses_movement_id, idempotency_key, occurred_at)
  values (v_tenant, v_branch, v_item, v_lot, -200, -200, 'kg',
          'REVERSAL', 'goods_receipt', v_mov, 'test:ters:1', now());

  select qty into v_qty from stock_balance where stock_item_id = v_item;
  insert into _dogrulama values (7, 'I3 · Ters kayıt bakiyeyi geri alır',
    '50 − 200 = −150 kg',
    case when v_qty = -150 then 'GEÇTİ' else 'KALDI · gelen ' || v_qty end);

  -- I4 ───────────────────────────────────────────────────────────────────
  begin
    insert into stock_movement
      (tenant_id, branch_id, stock_item_id, lot_id, quantity_base,
       quantity_entered, uom_entered, reason, source_type,
       reverses_movement_id, idempotency_key, occurred_at)
    values (v_tenant, v_branch, v_item, v_lot, -200, -200, 'kg',
            'REVERSAL', 'goods_receipt', v_mov, 'test:ters:2', now());
    insert into _dogrulama values (8, 'I4 · Bir hareket tek kez ters çevrilir',
      'ikinci ters kayıt reddedilir', 'KALDI');
  exception when unique_violation then
    insert into _dogrulama values (8, 'I4 · Bir hareket tek kez ters çevrilir',
      'ikinci ters kayıt reddedilir', 'GEÇTİ');
  end;

  -- I6 ───────────────────────────────────────────────────────────────────
  begin
    insert into stock_movement
      (tenant_id, branch_id, stock_item_id, lot_id, quantity_base,
       quantity_entered, uom_entered, reason, source_type, idempotency_key, occurred_at)
    values (v_tenant, v_branch, v_item, v_lot, 0, 0, 'kg',
            'WASTE', 'manual', 'test:sifir:1', now());
    insert into _dogrulama values (9, 'I6 · Sıfır miktarlı hareket yazılamaz',
      'quantity_base <> 0', 'KALDI');
  exception when check_violation then
    insert into _dogrulama values (9, 'I6 · Sıfır miktarlı hareket yazılamaz',
      'quantity_base <> 0', 'GEÇTİ');
  end;

  -- I8 ───────────────────────────────────────────────────────────────────
  begin
    insert into stock_movement
      (tenant_id, branch_id, stock_item_id, quantity_base,
       quantity_entered, uom_entered, reason, source_type, idempotency_key, occurred_at)
    values (v_tenant, v_branch, v_item, 10, 10, 'kg',
            'PURCHASE_RECEIPT', 'goods_receipt', 'test:lotsuz:1', now());
    insert into _dogrulama values (10, 'I8 · Lot takipli kalem lotsuz hareket almaz',
      'lot_id zorunlu', 'KALDI');
  exception when not_null_violation then
    insert into _dogrulama values (10, 'I8 · Lot takipli kalem lotsuz hareket almaz',
      'lot_id zorunlu', 'GEÇTİ');
  end;

  -- Merkez şube tekilliği ────────────────────────────────────────────────
  begin
    insert into branch (tenant_id, company_id, code, name, is_head_office)
      values (v_tenant, v_company, 'IKINCI', 'İkinci Merkez', true);
    insert into _dogrulama values (11, 'Bir firmada tek merkez şube',
      'ikinci merkez reddedilir', 'KALDI');
  exception when unique_violation then
    insert into _dogrulama values (11, 'Bir firmada tek merkez şube',
      'ikinci merkez reddedilir', 'GEÇTİ');
  end;
end $$;

-- ── Test verisini temizle ──────────────────────────────────────────────────
select app.dogrulama_temizlik();

-- ── Sonuç ──────────────────────────────────────────────────────────────────
select sira as "#", kontrol as "KONTROL", beklenen as "BEKLENEN", durum as "DURUM"
from _dogrulama
order by sira;
