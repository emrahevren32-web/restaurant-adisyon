\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0092 · SON KULLANMA TARİHİ KAPISI
--
-- Sorular:
--   1 · Süresi geçmiş parti ÜRETİME girebiliyor mu?         → GİRMEMELİ
--   2 · Süresi geçmiş parti SEVK edilebiliyor mu?           → EDİLMEMELİ
--   3 · SKT'si BUGÜN olan parti reddediliyor mu?            → REDDEDİLMEMELİ
--   4 · SKT'si YARIN olan parti reddediliyor mu?            → REDDEDİLMEMELİ
--   5 · SKT'si OLMAYAN parti reddediliyor mu?               → REDDEDİLMEMELİ
--   6 · İMHA kaydı geçiyor mu?                              → GEÇMELİ
--   7 · Fire/zayi geçiyor mu?                               → GEÇMELİ
--   8 · Tedarikçi iadesi geçiyor mu?                        → GEÇMELİ
--   9 · Sayım farkı geçiyor mu?                             → GEÇMELİ
--  10 · Ters kayıt geçiyor mu?                              → GEÇMELİ
--  11 · Ret DOĞRU SEBEPLE mi? (MI437, başka hata değil)
--
-- ⚠️ Her şey rollback ile bitiyor; veritabanını kirletmiyor.
-- ⚠️ `set local role authenticated` ile GERÇEK rol takılıyor (tuzak 94).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

create or replace function prova_oturum(p_auth uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', current_setting('prova.t'))::text, false);
  perform set_config('app.tenant_id', current_setting('prova.t'), false);
end; $$;

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid; v_f uuid; v_b uuid; v_auth uuid; v_app uuid; v_kalem uuid;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);

  -- Depo sorumlusu: stock.write var, üretim ve sevkiyat hareketini yazabilir
  v_auth := gen_random_uuid(); v_app := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p92.depo@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_app, v_t, v_f, v_auth, 'p92depo', 'p92depo', 'Depo', 'isletme_sahibi', true);
  perform set_config('prova.auth', v_auth::text, false);

  -- Stok kalemi
  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active)
  values (v_kalem, v_t, v_b, 'P92-UN', 'p92-un', 'Prova Unu', 'kg', true, true, true);
  perform set_config('prova.kalem', v_kalem::text, false);

  -- DÖRT PARTİ: dün biten, bugün biten, yarın biten, tarihsiz
  insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id, lot_code,
                                lot_code_key, expires_on, origin_type)
  values
    (gen_random_uuid(), v_t, v_b, v_kalem, 'P92-DUN',     'p92-dun',
      current_date - 1, 'RECEIPT'),
    (gen_random_uuid(), v_t, v_b, v_kalem, 'P92-BUGUN',   'p92-bugun',
      current_date,     'RECEIPT'),
    (gen_random_uuid(), v_t, v_b, v_kalem, 'P92-YARIN',   'p92-yarin',
      current_date + 1, 'RECEIPT'),
    (gen_random_uuid(), v_t, v_b, v_kalem, 'P92-TARIHSIZ','p92-tarihsiz',
      null,             'RECEIPT');

  perform set_config('prova.lot.dun',
    (select id::text from public.stock_lot where lot_code_key = 'p92-dun'), false);
  perform set_config('prova.lot.bugun',
    (select id::text from public.stock_lot where lot_code_key = 'p92-bugun'), false);
  perform set_config('prova.lot.yarin',
    (select id::text from public.stock_lot where lot_code_key = 'p92-yarin'), false);
  perform set_config('prova.lot.tarihsiz',
    (select id::text from public.stock_lot where lot_code_key = 'p92-tarihsiz'), false);

  -- ⚠️ Her partiye GİRİŞ hareketi yazılıyor. Yoksa tüketim denemesi
  -- SKT kapısına gelmeden negatif bakiye kuralına (MI012, göç 0011)
  -- takılıyor ve prova yanlış sebeple kırmızı oluyordu — "yanlış sebeple
  -- ret" tam da kaçınmamız gereken şey.
  -- ⚠️ Mal kabul, süresi geçmiş partide de MEŞRUDUR: parti depoda dururken
  -- süresi geçer. Kapı girişi engellemiyor, çıkışı engelliyor.
  insert into public.stock_movement (tenant_id, branch_id, stock_item_id, lot_id,
    quantity_base, quantity_entered, uom_entered, reason, source_type,
    idempotency_key, occurred_at)
  select v_t, v_b, v_kalem, l.id, 100, 100, 'kg', 'PURCHASE_RECEIPT', 'prova',
         'p92:giris:'||l.lot_code_key, now()
    from public.stock_lot l
   where l.lot_code_key like 'p92-%';

  raise notice 'KURULUM TAMAM (dört parti + giriş hareketleri hazır)';
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid) to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;
select prova_oturum(current_setting('prova.auth')::uuid);

-- ── SINAMALAR ─────────────────────────────────────────────────────────────
do $$
declare
  v_kod text;
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_k uuid := current_setting('prova.kalem')::uuid;
  v_n integer := 0;

begin
  raise notice '── SÜRESİ GEÇMİŞ PARTİ (dün bitti)';

  -- 1 · ÜRETİME GİREMEZ
  begin
    insert into public.stock_movement (tenant_id, branch_id, stock_item_id, lot_id,
      quantity_base, quantity_entered, uom_entered, reason, source_type,
      idempotency_key, occurred_at)
    values (v_t, v_b, v_k, current_setting('prova.lot.dun')::uuid,
      -5, 5, 'kg', 'PRODUCTION_CONSUME', 'prova', 'p92:1', now());
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('1 · SURESI GECMIS PARTI URETIME GIREMIYOR (gelen: '||v_kod||')',
    v_kod = 'MI437');

  -- 2 · SEVK EDİLEMEZ
  begin
    insert into public.stock_movement (tenant_id, branch_id, stock_item_id, lot_id,
      quantity_base, quantity_entered, uom_entered, reason, source_type,
      idempotency_key, occurred_at)
    values (v_t, v_b, v_k, current_setting('prova.lot.dun')::uuid,
      -5, 5, 'kg', 'SHIPMENT_OUT', 'prova', 'p92:2', now());
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('2 · SURESI GECMIS PARTI SEVK EDILEMIYOR (gelen: '||v_kod||')',
    v_kod = 'MI437');

  raise notice '── SÜRESİ GEÇMEMİŞ PARTİLER';

  -- 3 · BUGÜN biten geçer (SKT günü DAHİL kullanılabilir)
  begin
    insert into public.stock_movement (tenant_id, branch_id, stock_item_id, lot_id,
      quantity_base, quantity_entered, uom_entered, reason, source_type,
      idempotency_key, occurred_at)
    values (v_t, v_b, v_k, current_setting('prova.lot.bugun')::uuid,
      -1, 1, 'kg', 'PRODUCTION_CONSUME', 'prova', 'p92:3', now());
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('3 · SKT''si BUGUN olan parti GECIYOR (gelen: '||v_kod||')',
    v_kod = '00000');

  -- 4 · YARIN biten geçer
  begin
    insert into public.stock_movement (tenant_id, branch_id, stock_item_id, lot_id,
      quantity_base, quantity_entered, uom_entered, reason, source_type,
      idempotency_key, occurred_at)
    values (v_t, v_b, v_k, current_setting('prova.lot.yarin')::uuid,
      -1, 1, 'kg', 'SHIPMENT_OUT', 'prova', 'p92:4', now());
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('4 · SKT''si YARIN olan parti GECIYOR (gelen: '||v_kod||')',
    v_kod = '00000');

  -- 5 · TARİHSİZ parti geçer ("bilinmiyor" ile "geçmiş" aynı değil)
  begin
    insert into public.stock_movement (tenant_id, branch_id, stock_item_id, lot_id,
      quantity_base, quantity_entered, uom_entered, reason, source_type,
      idempotency_key, occurred_at)
    values (v_t, v_b, v_k, current_setting('prova.lot.tarihsiz')::uuid,
      -1, 1, 'kg', 'PRODUCTION_CONSUME', 'prova', 'p92:5', now());
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('5 · SKT''si OLMAYAN parti GECIYOR (gelen: '||v_kod||')',
    v_kod = '00000');

  raise notice '── MEŞRU ÇIKIŞ YOLLARI · SÜRESİ GEÇMİŞ PARTİYLE';

  -- 6 · İMHA geçer — süresi geçmiş malın çıkış yolu BURASI
  begin
    insert into public.stock_movement (tenant_id, branch_id, stock_item_id, lot_id,
      quantity_base, quantity_entered, uom_entered, reason, source_type,
      idempotency_key, occurred_at, note)
    values (v_t, v_b, v_k, current_setting('prova.lot.dun')::uuid,
      -2, 2, 'kg', 'EXPIRY_WRITE_OFF', 'prova', 'p92:6', now(), 'SKT gecti, imha');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('6 · IMHA kaydi GECIYOR (gelen: '||v_kod||')', v_kod = '00000');

  -- 7 · Fire/zayi geçer
  begin
    insert into public.stock_movement (tenant_id, branch_id, stock_item_id, lot_id,
      quantity_base, quantity_entered, uom_entered, reason, source_type,
      idempotency_key, occurred_at, note)
    values (v_t, v_b, v_k, current_setting('prova.lot.dun')::uuid,
      -1, 1, 'kg', 'WASTE', 'prova', 'p92:7', now(), 'fire kaydi');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('7 · FIRE kaydi GECIYOR (gelen: '||v_kod||')', v_kod = '00000');

  -- 8 · Tedarikçi iadesi geçer — süresi geçmiş malı geri VERMEK istenen şey
  begin
    insert into public.stock_movement (tenant_id, branch_id, stock_item_id, lot_id,
      quantity_base, quantity_entered, uom_entered, reason, source_type,
      idempotency_key, occurred_at)
    values (v_t, v_b, v_k, current_setting('prova.lot.dun')::uuid,
      -1, 1, 'kg', 'PURCHASE_RETURN', 'prova', 'p92:8', now());
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('8 · TEDARIKCI IADESI GECIYOR (gelen: '||v_kod||')', v_kod = '00000');

  -- 9 · Sayım farkı geçer — sayım gerçeği yazar
  begin
    insert into public.stock_movement (tenant_id, branch_id, stock_item_id, lot_id,
      quantity_base, quantity_entered, uom_entered, reason, source_type,
      idempotency_key, occurred_at)
    values (v_t, v_b, v_k, current_setting('prova.lot.dun')::uuid,
      -1, 1, 'kg', 'COUNT_SHORTAGE', 'prova', 'p92:9', now());
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('9 · SAYIM FARKI GECIYOR (gelen: '||v_kod||')', v_kod = '00000');

  -- 10 · Ters kayıt geçer — geçmişi düzeltmeyi engellemiyoruz
  begin
    insert into public.stock_movement (tenant_id, branch_id, stock_item_id, lot_id,
      quantity_base, quantity_entered, uom_entered, reason, source_type,
      idempotency_key, occurred_at, reverses_movement_id)
    values (v_t, v_b, v_k, current_setting('prova.lot.dun')::uuid,
      1, 1, 'kg', 'PRODUCTION_CONSUME', 'prova', 'p92:10', now(),
      (select id from public.stock_movement where idempotency_key = 'p92:6'));
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('10 · TERS KAYIT GECIYOR (gelen: '||v_kod||')', v_kod = '00000');

  -- 11 · Ret DOĞRU SEBEPLE mi? MI437 dışında bir kod, kapının yanlış
  --      sebeple reddettiği anlamına gelir (tuzak: yanlış sebeple ret,
  --      kapı çalışıyor sanılır).
  begin
    insert into public.stock_movement (tenant_id, branch_id, stock_item_id, lot_id,
      quantity_base, quantity_entered, uom_entered, reason, source_type,
      idempotency_key, occurred_at)
    values (v_t, v_b, v_k, current_setting('prova.lot.dun')::uuid,
      -1, 1, 'kg', 'SHIPMENT_OUT', 'prova', 'p92:11', now());
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('11 · RET KODU MI437 (42501/23502 degil) · gelen: '||v_kod,
    v_kod = 'MI437');

  -- ⚠️ `like 'p92:%'` YAZMIYORUZ: kurulumdaki dört giriş hareketi de o
  -- desene uyuyor ve sayıyı 12 gösteriyordu. Sayılması gereken şey yalnız
  -- SINAMALARIN yazdığı hareketler.
  select count(*) into v_n from public.stock_movement
   where idempotency_key ~ '^p92:[0-9]+$';
  perform prova_bak('12 · gecmesi gereken 8 hareket yazildi, 4 ret (gelen: '||v_n||')',
    v_n = 8);
end $$;

rollback;
