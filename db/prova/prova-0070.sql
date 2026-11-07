-- 0070 · iptal edilmiş alışın değerlemeye girmemesi.
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
-- ═══════════════════════════════════════════════════════════════════════
-- !! GÖSTERGE OKUMALARI `authenticated` ROLÜ TAKILARAK YAPILIYOR (MIYOP-042).
-- JWT koymak YETMEZ: rolü takmayan bir prova kapının DIŞINDA, süper
-- kullanıcı olarak koşar ve her yazım sessizce geçer — prova yeşil
-- görünür, hiçbir şey ölçmez. prova-0081/0082 tam böyle körleşmişti.
-- Kurulum yazımları süper kullanıcı olarak kalıyor (sahne kurmak ölçüm
-- değildir); ÖLÇÜLEN okuma rolün içinde yapılıyor.
-- ⚠️ `reset role` hata yolunda da çalışıyor: yarıda kalan bir rol,
-- provanın geri kalanını sessizce başka bir kimlikle ölçerdi.
-- ═══════════════════════════════════════════════════════════════════════
create or replace function prova_gosterge(p_sube uuid, p_bas date, p_bit date)
returns table (anahtar text, deger numeric, ek numeric)
language plpgsql as $prova$
begin
  execute 'set local role authenticated';
  begin
    return query select * from app.isletme_gostergeleri(p_sube, p_bas, p_bit);
  exception when others then
    execute 'reset role';
    raise;
  end;
  execute 'reset role';
end; $prova$;

create or replace function prova_fire(p_sube uuid, p_bas date, p_bit date)
returns table (neden text, kalem_id uuid, kalem_adi text, miktar numeric,
               birim text, tutar numeric, fiyatsiz boolean)
language plpgsql as $prova$
begin
  execute 'set local role authenticated';
  begin
    return query select * from app.fire_dokumu(p_sube, p_bas, p_bit);
  exception when others then
    execute 'reset role';
    raise;
  end;
  execute 'reset role';
end; $prova$;

do $$
declare
  v_t uuid; v_b uuid; v_auth uuid := gen_random_uuid(); v_k uuid; v_pahali uuid;
  d numeric;
  v_gecen int := 0; v_kalan int := 0;
begin
  select id into v_t from tenant where code='MIYOP';
  select id into v_b from branch where tenant_id=v_t limit 1;

  -- !! 0071 BU RAPORLARIN ÖNÜNE `finance.read` KAPISI KOYDU. Bu prova
  -- 0071'den ÖNCE yazıldı ve oturumsuz çağırıyordu; o gün doğruydu.
  -- Kapı GEVŞETİLMİYOR, prova yetkili bir kullanıcıyla ölçüyor — `_ham`
  -- fonksiyonu çağırmak kapıyı atlamak, yani gerçek yolu ölçmemek olurdu.
  insert into app_user (tenant_id, auth_user_id, username, username_key,
                        full_name, role_code, is_active)
    values (v_t, v_auth, 'prv70.patron', 'prv70.patron', 'Prova Patron', 'isletme_sahibi', true);
  perform set_config('request.jwt.claim.sub', v_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_auth, 'tenant_id', v_t)::text, false);
  perform set_config('app.tenant_id', v_t::text, false);
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'D70','d70','Un','kg') returning id into v_k;

  -- 20 gün önce doğru fiyattan alındı
  insert into stock_movement (tenant_id,branch_id,stock_item_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,unit_cost,idempotency_key,occurred_at)
    values (v_t,v_b,v_k,100,100,'kg','PURCHASE_RECEIPT','goods_receipt',10,'d70-1',
            now()-interval '20 days');

  -- 10 gün önce YANLIŞ fiyatla girildi ve İPTAL EDİLDİ
  insert into stock_movement (tenant_id,branch_id,stock_item_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,unit_cost,idempotency_key,occurred_at)
    values (v_t,v_b,v_k,100,100,'kg','PURCHASE_RECEIPT','goods_receipt',400,'d70-2',
            now()-interval '10 days')
    returning id into v_pahali;
  insert into stock_movement (tenant_id,branch_id,stock_item_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,reverses_movement_id,
      idempotency_key,occurred_at)
    values (v_t,v_b,v_k,-100,-100,'kg','REVERSAL','goods_receipt',v_pahali,'d70-2r',
            now()-interval '10 days');

  -- ── 1 · FİYAT, İPTAL EDİLMİŞ ALIŞTAN DEĞİL ÖNCEKİ GEÇERLİ ALIŞTAN ─────
  d := app.kalem_alis_fiyati(v_k, now());
  if d = 10 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 1 · iptal edilmiş alış fiyatı kullanıldı: % (10 olmalı)', d; end if;

  -- ── 2 · FİRE DE DOĞRU DEĞERLENİYOR ───────────────────────────────────
  -- 2 kg fire: 20 TL olmalı, 800 değil.
  insert into stock_movement (tenant_id,branch_id,stock_item_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,note,idempotency_key,occurred_at)
    values (v_t,v_b,v_k,-2,-2,'kg','WASTE','manual','Küflendi','d70-f1',
            now()-interval '5 days');

  select deger into d from prova_gosterge(v_b, current_date-30, current_date)
   where anahtar = 'fire_tutari';
  if d = 20 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 2 · fire yanlış değerlendi: % (20 olmalı)', d; end if;

  -- ── 3 · İPTAL EDİLMEMİŞ YENİ ALIŞ KULLANILIYOR ───────────────────────
  -- Kural "pahalıyı atla" değil, "iptal edileni atla".
  insert into stock_movement (tenant_id,branch_id,stock_item_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,unit_cost,idempotency_key,occurred_at)
    values (v_t,v_b,v_k,50,50,'kg','PURCHASE_RECEIPT','goods_receipt',25,'d70-3',
            now()-interval '2 days');

  d := app.kalem_alis_fiyati(v_k, now());
  if d = 25 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 3 · geçerli yeni alış kullanılmadı: % (25 olmalı)', d; end if;

  -- ── 4 · GEÇMİŞ AN SORULUNCA O ANIN FİYATI ────────────────────────────
  d := app.kalem_alis_fiyati(v_k, now()-interval '5 days');
  if d = 10 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 4 · geçmiş an fiyatı yanlış: % (10 olmalı)', d; end if;

  -- ── 5 · HİÇ GEÇERLİ ALIŞI OLMAYAN KALEMDE NULL ───────────────────────
  -- Sıfır DEĞİL: sıfır "bedava" demektir, NULL "bilinmiyor".
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'D70B','d70b','Hiç alınmamış','kg') returning id into v_k;
  if app.kalem_alis_fiyati(v_k, now()) is null then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 5 · NULL beklenirken değer döndü'; end if;

  raise notice '──────────── 0070 PROVA: % geçti, % kaldı ────────────', v_gecen, v_kalan;
  if v_kalan > 0 then raise exception '0070 provası düştü'; end if;
end;
$$;
rollback;
