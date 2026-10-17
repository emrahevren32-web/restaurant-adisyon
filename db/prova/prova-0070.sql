-- 0070 · iptal edilmiş alışın değerlemeye girmemesi.
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_b uuid; v_k uuid; v_pahali uuid;
  d numeric;
  v_gecen int := 0; v_kalan int := 0;
begin
  select id into v_t from tenant where code='MIYOP';
  select id into v_b from branch where tenant_id=v_t limit 1;
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

  select deger into d from app.isletme_gostergeleri(v_b, current_date-30, current_date)
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
