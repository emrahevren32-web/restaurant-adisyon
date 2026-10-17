-- 0067 · üretilen parti listesi davranış provası.
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_b uuid; v_mamul uuid; v_ham uuid;
  v_ie uuid; v_lot1 uuid; v_lot2 uuid; v_satin uuid; v_recete uuid;
  r record; v_say int;
  v_gecen int := 0; v_kalan int := 0;
begin
  select id into v_t from tenant where code='MIYOP';
  select id into v_b from branch where tenant_id=v_t limit 1;

  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom,
                          tracks_lot,tracks_expiry)
    values (v_t,v_b,'L67-CRB','l67-crb','Mercimek Çorbası','kg',true,true)
    returning id into v_mamul;

  insert into recipe (tenant_id,code,code_key,name,output_item_id,
                      output_qty,output_uom)
    values (v_t,'R67','r67','Çorba reçetesi',v_mamul,100,'kg')
    returning id into v_recete;
  insert into work_order (tenant_id,branch_id,order_no,recipe_id,
                          output_item_id,planned_qty,output_uom,status)
    values (v_t,v_b,'IE-67-001',v_recete,v_mamul,100,'kg','DRAFT')
    returning id into v_ie;

  -- ── Üretilmiş parti: iş emrinden doğmuş, deftere mamul girişi yazılmış ──
  insert into stock_lot (tenant_id,branch_id,stock_item_id,lot_code,lot_code_key,
                         expires_on,origin_type,origin_id)
    values (v_t,v_b,v_mamul,'P-20261001','p-20261001',current_date+30,
            'PRODUCTION',v_ie)
    returning id into v_lot1;
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,source_id,
      idempotency_key,occurred_at)
    values (v_t,v_b,v_mamul,v_lot1,100,100,'kg','PRODUCTION_OUTPUT','work_order',v_ie,
            'l67-u1',(current_date - 5)::timestamptz);

  -- ── 1 · ÜRETİLEN PARTİ LİSTEDE ────────────────────────────────────────
  select count(*) into v_say from app.uretilen_partiler(v_mamul);
  if v_say = 1 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 1 · parti listede yok: %', v_say; end if;

  -- ── 2 · ÜRETİM TARİHİ DEFTERDEN, parti KAYDININ açıldığı andan değil ──
  -- Parti kaydı BUGÜN açıldı ama mamul 5 gün önce deftere girdi.
  select * into r from app.uretilen_partiler(v_mamul) limit 1;
  if r.uretim_tarihi = current_date - 5 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 2 · üretim tarihi yanlış: % (% olmalı)',
      r.uretim_tarihi, current_date - 5; end if;

  -- ── 3 · SON KULLANMA VE BAKİYE GELİYOR ───────────────────────────────
  if r.son_kullanma = current_date + 30 and r.bakiye = 100 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 3 · skt/bakiye yanlış: % / %', r.son_kullanma, r.bakiye; end if;

  -- ── 4 · İŞ EMRİ NUMARASI GELİYOR ─────────────────────────────────────
  -- Parti kodları birbirine benzer; kullanıcı partiyi iş emriyle tanır.
  if r.is_emri_no = 'IE-67-001' then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 4 · iş emri no gelmedi: %', r.is_emri_no; end if;

  -- ── 5 · SATIN ALINAN PARTİ LİSTEDE YOK ───────────────────────────────
  -- Mamul etiketi basılırken hammadde partisi seçilemez; seçilseydi
  -- etikette üretmediğimiz bir partinin numarası yazardı.
  insert into stock_lot (tenant_id,branch_id,stock_item_id,lot_code,lot_code_key,
                         origin_type)
    values (v_t,v_b,v_mamul,'P-SATIN','p-satin','RECEIPT')
    returning id into v_satin;
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,unit_cost,
      idempotency_key,occurred_at)
    values (v_t,v_b,v_mamul,v_satin,50,50,'kg','PURCHASE_RECEIPT','goods_receipt',10,
            'l67-s1',now());

  select count(*) into v_say from app.uretilen_partiler(v_mamul);
  if v_say = 1 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 5 · satın alınan parti listeye girdi: %', v_say; end if;

  -- ── 6 · EN YENİ PARTİ EN ÜSTTE ───────────────────────────────────────
  insert into stock_lot (tenant_id,branch_id,stock_item_id,lot_code,lot_code_key,
                         expires_on,origin_type,origin_id)
    values (v_t,v_b,v_mamul,'P-20261008','p-20261008',current_date+40,
            'PRODUCTION',v_ie)
    returning id into v_lot2;
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,source_id,
      idempotency_key,occurred_at)
    values (v_t,v_b,v_mamul,v_lot2,80,80,'kg','PRODUCTION_OUTPUT','work_order',v_ie,
            'l67-u2',now());

  if (select parti_kodu from app.uretilen_partiler(v_mamul) limit 1) = 'P-20261008'
  then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 6 · sıralama yanlış: %',
      (select parti_kodu from app.uretilen_partiler(v_mamul) limit 1); end if;

  -- ── 7 · TÜKENMİŞ PARTİ LİSTEDEN DÜŞMÜYOR ─────────────────────────────
  -- Etiket bazen yeniden basılır (yırtılan ambalaj). Düşürseydik kullanıcı
  -- elle yazmaya dönerdi ve bu göç boşa giderdi.
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,idempotency_key,occurred_at)
    values (v_t,v_b,v_mamul,v_lot1,-100,-100,'kg','SHIPMENT_OUT','shipment',
            'l67-c1',now());

  select bakiye into r.bakiye from app.uretilen_partiler(v_mamul)
   where parti_id = v_lot1;
  select count(*) into v_say from app.uretilen_partiler(v_mamul)
   where parti_id = v_lot1;
  if v_say = 1 and r.bakiye = 0 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 7 · tükenmiş parti düştü ya da bakiyesi yanlış: % / %',
      v_say, r.bakiye; end if;

  -- ── 8 · HİÇ ÜRETİLMEMİŞ KALEMDE LİSTE BOŞ ────────────────────────────
  -- Boş liste, ekranın "önce iş emrini tamamlayın" demesini sağlıyor.
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'L67-YENI','l67-yeni','Hiç Üretilmemiş','kg')
    returning id into v_ham;
  select count(*) into v_say from app.uretilen_partiler(v_ham);
  if v_say = 0 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 8 · boş olmalıydı: %', v_say; end if;

  raise notice '──────────── 0067 PROVA: % geçti, % kaldı ────────────', v_gecen, v_kalan;
  if v_kalan > 0 then raise exception '0067 provası düştü'; end if;
end;
$$;
rollback;
