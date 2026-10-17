-- 0061 · operations.approve davranış provası.
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_izin text; v_gecen int := 0; v_kalan int := 0;
begin
  -- ── 1 · YENİ kiracının zinciri yeni izinle kuruluyor ────────────────────
  -- Tetikleyici (0053) kiracı eklenince zinciri kendiliğinden kuruyor.
  insert into tenant (code,name) values ('P61','Prova 61') returning id into v_t;

  select permission_code into v_izin
    from order_approval_step where tenant_id=v_t and code='SATIS';

  if v_izin = 'operations.approve' then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1;
    raise notice '❌ 1 · yeni kiracının SATIS adımı "%" izninde', coalesce(v_izin,'YOK');
  end if;

  -- ── 2 · GÖRÜŞ adımları değişmedi ────────────────────────────────────────
  -- Depo ve üretim görüşünü okuma izniyle veriyor; bu göç onlara dokunmamalı.
  if (select permission_code from order_approval_step where tenant_id=v_t and code='DEPO')
       = 'stock.read'
   and (select permission_code from order_approval_step where tenant_id=v_t and code='URETIM')
       = 'production.read'
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 2 · görüş adımlarının izni değişmiş';
  end if;

  -- ── 3 · Hiçbir kiracıda eski izne bağlı adım kalmadı ────────────────────
  if not exists (select 1 from order_approval_step where permission_code='operations.write')
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 3 · eski izne bağlı adım kaldı';
  end if;

  -- ── 4 · Sipariş AÇMA ile ONAYLAMA artık iki ayrı hak ────────────────────
  -- Bugün aynı rollerde duruyorlar ama ayrılabilir olmaları bu göçün amacı:
  -- bir rolden onay iznini alınca sipariş açma hakkı DURMALI.
  delete from role_permission
   where role_code='isletme_muduru' and permission_code='operations.approve';

  if exists (select 1 from role_permission
              where role_code='isletme_muduru' and permission_code='operations.write')
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1;
    raise notice '❌ 4 · onay izni alınınca sipariş açma hakkı da gitti';
  end if;

  -- ── 5 · İzin kataloğunda tanımlı (yabancı anahtar kapısı) ───────────────
  -- `order_approval_step.permission_code` → `permission(code)`. Katalogda
  -- olmayan bir izne bağlanamaz; yanlış yazılan kod sessizce "kimse" değil,
  -- HATA olmalı (0053'ün kuralı).
  begin
    insert into order_approval_step (tenant_id,code,name,sort_order,required,permission_code)
    values (v_t,'UYDURMA','Uydurma adım',9,false,'operations.onaylasin');
    v_kalan := v_kalan + 1; raise notice '❌ 5 · tanımsız izin kodu kabul edildi';
  exception when foreign_key_violation then v_gecen := v_gecen + 1;
  end;

  raise notice '──────── 0061 provası: % geçti, % kaldı', v_gecen, v_kalan;
  if v_kalan > 0 then raise exception '0061 provası KALDI (% hata)', v_kalan; end if;
end $$;
rollback;
