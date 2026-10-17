\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_b uuid; v_c uuid; v_m uuid; v_u uuid;
  v_corba uuid; v_pilav uuid; v_tatli uuid; v_sut uuid;
  v_sip uuid; v_rev uuid; v_we1 uuid; v_we2 uuid;
  v_sevk uuid; v_hareket uuid; v_fark uuid;
  r record;
begin
  -- Prova kendi kiracısını kuruyor: temiz veritabanında yalnız MİYOP var.
  select id into v_t from tenant where code='ABC';
  if v_t is null then
    insert into tenant (code,name) values ('ABC','ABC Endüstriyel Mutfak') returning id into v_t;
  end if;
  select id into v_b from branch where tenant_id=v_t limit 1;
  if v_b is null then
    insert into company (tenant_id,company_code,company_name)
      values (v_t,'ABC','ABC Endüstriyel Mutfak A.Ş.') returning id into v_c;
    insert into branch (tenant_id,company_id,code,name,branch_type,is_head_office)
      values (v_t,v_c,'MRK','Merkez Depo','merkez',true) returning id into v_b;
  end if;
  insert into app_user (tenant_id, username, username_key, full_name, role_code)
    values (v_t,'prova58','prova58','Prova 58',
            (select role_code from app_user where role_code is not null limit 1))
    returning id into v_u;

  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'Q-CRB','q-crb','Çorba','koli') returning id into v_corba;
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'Q-PLV','q-plv','Pilav','koli') returning id into v_pilav;
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'Q-TAT','q-tat','Tatlı (depodan)','koli') returning id into v_tatli;
  -- Birimi sipariş biriminden FARKLI olan kalem: defter kg, sipariş koli.
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'Q-SUT','q-sut','Süt','kg') returning id into v_sut;

  insert into customer (tenant_id,code,code_key,name) values (v_t,'MGR58','mgr58','Migros')
    returning id into v_m;

  insert into sales_order (tenant_id,branch_id,order_no,customer_id)
    values (v_t,v_b,'SIP-Q-1',v_m) returning id into v_sip;
  insert into sales_order_revision (tenant_id,order_id,revision_no,kind,source,reason)
    values (v_t,v_sip,1,'MIKTAR','Telefon','İlk') returning id into v_rev;
  insert into sales_order_line (tenant_id,order_id,revision_id,line_no,stock_item_id,qty,uom_code)
    values (v_t,v_sip,v_rev,1,v_corba,40,'koli'),
           (v_t,v_sip,v_rev,2,v_pilav,25,'koli'),
           (v_t,v_sip,v_rev,3,v_tatli,4,'koli'),
           (v_t,v_sip,v_rev,4,v_sut,10,'koli');

  -- ── İş emirleri: çorba 10 koli (tamamlandı), pilav 25 koli (açık)
  insert into work_order (tenant_id,branch_id,order_no,output_item_id,planned_qty,
                          output_uom,status,order_id)
    values (v_t,v_b,'IE-Q-1',v_corba,10,'koli','COMPLETED',v_sip) returning id into v_we1;
  insert into work_order (tenant_id,branch_id,order_no,output_item_id,planned_qty,
                          output_uom,status,order_id)
    values (v_t,v_b,'IE-Q-2',v_pilav,25,'koli','STARTED',v_sip) returning id into v_we2;

  -- Çorbadan 12 koli üretildi (plan 10'du — fazla üretim de gerçektir).
  insert into stock_movement (tenant_id,branch_id,stock_item_id,quantity_base,
                              quantity_entered,uom_entered,reason,source_type,source_id,
                              idempotency_key,occurred_at)
    values (v_t,v_b,v_corba,12,12,'koli','PRODUCTION_OUTPUT','work_order',v_we1,'q58-u1',now());

  raise notice '--- 1) NE İSTENDİ / NE HAZIRLANDI / NE GİTTİ';
  for r in select * from app.siparis_teslim_farki(v_sip) loop
    raise notice '   % · istendi % % · hazırlandı % % (ölçülebilir %) · gitti % · kalan % · iş emri %/% açık',
      r.kalem_adi, r.istendi, r.istendi_birim, r.hazirlandi, r.hazirlandi_birim,
      r.uretim_olculebilir, r.gitti, r.kalan, r.acik_is_emri, r.is_emri_sayisi;
  end loop;

  select * into r from app.siparis_teslim_farki(v_sip) where kalem_id=v_corba;
  if r.istendi <> 40 or r.hazirlandi <> 12 or r.gitti <> 0 or r.kalan <> 40 then
    raise exception 'BAŞARISIZ: çorba istendi % hazırlandı % gitti % kalan % (40/12/0/40).',
      r.istendi, r.hazirlandi, r.gitti, r.kalan;
  end if;
  if not r.uretim_olculebilir then raise exception 'BAŞARISIZ: koli=koli ölçülebilir olmalıydı.'; end if;
  if r.is_emri_sayisi <> 1 or r.acik_is_emri <> 0 then
    raise exception 'BAŞARISIZ: çorba iş emri %/% açık.', r.acik_is_emri, r.is_emri_sayisi;
  end if;
  raise notice '   ✅ çorba 40 istendi · 12 hazırlandı · 0 gitti';

  raise notice '--- 2) AÇIK iş emri sayılıyor ama ÜRETİM yazılmadıysa hazırlandı 0';
  select * into r from app.siparis_teslim_farki(v_sip) where kalem_id=v_pilav;
  if r.hazirlandi <> 0 then raise exception 'BAŞARISIZ: pilav hazırlandı %.', r.hazirlandi; end if;
  if r.acik_is_emri <> 1 then raise exception 'BAŞARISIZ: pilav açık iş emri %.', r.acik_is_emri; end if;
  raise notice '   ✅ pilav: iş emri açık, defterde giriş yok → hazırlandı 0';

  raise notice '--- 3) DEPODAN karşılanan kalemin üretimi 0''dır, bu EKSİKLİK DEĞİL';
  select * into r from app.siparis_teslim_farki(v_sip) where kalem_id=v_tatli;
  if r.hazirlandi <> 0 or r.is_emri_sayisi <> 0 then
    raise exception 'BAŞARISIZ: tatlı hazırlandı % iş emri %.', r.hazirlandi, r.is_emri_sayisi;
  end if;
  raise notice '   ✅ tatlı: iş emri yok, üretim 0';

  raise notice '--- 4) BİRİM UYUŞMUYORSA kıyas yapılmıyor';
  select * into r from app.siparis_teslim_farki(v_sip) where kalem_id=v_sut;
  if r.uretim_olculebilir then
    raise exception 'BAŞARISIZ: sipariş koli / defter kg iken ölçülebilir denildi.';
  end if;
  if r.hazirlandi_birim <> 'kg' then
    raise exception 'BAŞARISIZ: hazırlandı birimi % (kg bekleniyordu).', r.hazirlandi_birim;
  end if;
  raise notice '   ✅ süt: sipariş koli, defter kg → kıyas yok, birim yazılı';

  raise notice '--- 5) SEVKİYAT yazılınca GİTTİ ve KALAN değişiyor';
  -- Sipariş 0053'teki zincirden geçmeden "Hazır" olamaz; rapor provası bu
  -- yolu ATLAMIYOR, çünkü gerçek hayatta da atlanamıyor.
  insert into order_approval (tenant_id,order_id,revision_no,step_code,decision,decided_by)
    values (v_t,v_sip,1,'SATIS','Olumlu',v_u);
  update sales_order set status='Onay Bekliyor' where id=v_sip;
  update sales_order set status='Onaylandı'    where id=v_sip;
  update sales_order set status='Hazırlanıyor' where id=v_sip;
  update sales_order set status='Hazır'        where id=v_sip;

  insert into shipment (tenant_id,branch_id,shipment_no,customer_name,customer_id,
                        status,order_id)
    values (v_t,v_b,'SVK-Q-1','Migros',v_m,'DRAFT',v_sip) returning id into v_sevk;
  insert into shipment_line (tenant_id,shipment_id,line_no,stock_item_id,qty,uom)
    values (v_t,v_sevk,1,v_corba,15,'koli');
  update shipment set status='SHIPPED', shipped_on=current_date where id=v_sevk;

  select * into r from app.siparis_teslim_farki(v_sip) where kalem_id=v_corba;
  if r.gitti <> 15 or r.kalan <> 25 then
    raise exception 'BAŞARISIZ: çorba gitti % kalan % (15/25).', r.gitti, r.kalan;
  end if;
  raise notice '   ✅ çorba gitti 15 · kalan 25 · hazırlandı hâlâ %', r.hazirlandi;

  raise notice '--- 6) GERİ ALINAN ÜRETİM hazırlandı toplamından DÜŞÜYOR';
  select id into v_hareket from stock_movement
    where source_id=v_we1 and reason='PRODUCTION_OUTPUT' limit 1;
  insert into stock_movement (tenant_id,branch_id,stock_item_id,quantity_base,
                              quantity_entered,uom_entered,reason,source_type,source_id,
                              idempotency_key,occurred_at,reverses_movement_id)
    values (v_t,v_b,v_corba,-12,12,'koli','REVERSAL','work_order',v_we1,'q58-u1-ters',now(),v_hareket);

  select * into r from app.siparis_teslim_farki(v_sip) where kalem_id=v_corba;
  if r.hazirlandi <> 0 then
    raise exception 'BAŞARISIZ: ters kayıttan sonra hazırlandı % (0 bekleniyordu).', r.hazirlandi;
  end if;
  raise notice '   ✅ üretim iptal edildi → hazırlandı 0, rapor yalan söylemiyor';

  raise notice '--- 7) BAŞKA siparişin iş emri bu rapora KARIŞMIYOR';
  insert into work_order (tenant_id,branch_id,order_no,output_item_id,planned_qty,
                          output_uom,status)
    values (v_t,v_b,'IE-Q-3',v_corba,99,'koli','COMPLETED') returning id into v_we2;
  insert into stock_movement (tenant_id,branch_id,stock_item_id,quantity_base,
                              quantity_entered,uom_entered,reason,source_type,source_id,
                              idempotency_key,occurred_at)
    values (v_t,v_b,v_corba,99,99,'koli','PRODUCTION_OUTPUT','work_order',v_we2,'q58-u2',now());

  select * into r from app.siparis_teslim_farki(v_sip) where kalem_id=v_corba;
  if r.hazirlandi <> 0 then
    raise exception 'BAŞARISIZ: siparişsiz iş emrinin üretimi rapora sızdı (%).', r.hazirlandi;
  end if;
  raise notice '   ✅ siparişe bağlı olmayan üretim raporda yok';

  raise notice '--- 8) REVİZYON sonrası İSTENDİ güncel miktarı gösteriyor';
  -- Sevk edilmiş siparişin miktarı ancak bir FARK KAYDINA bağlı değişir
  -- (0050 · MI425). Prova bu kuralı da yolun içinden geçerek sınıyor.
  insert into order_discrepancy (tenant_id,order_id,shipment_id,stock_item_id,kind,qty,
                                 uom_code,noticed_step,noticed_by,description)
    values (v_t,v_sip,v_sevk,v_corba,'Eksik',5,'koli','Teslimde',v_u,
            'Müşteri 5 koli eksik teslim aldığını bildirdi.')
    returning id into v_fark;
  insert into sales_order_revision (tenant_id,order_id,revision_no,kind,source,reason,
                                    discrepancy_id)
    values (v_t,v_sip,2,'MIKTAR','Telefon','Fark kaydına bağlı düzeltme',v_fark)
    returning id into v_rev;
  insert into sales_order_line (tenant_id,order_id,revision_id,line_no,stock_item_id,qty,uom_code)
    values (v_t,v_sip,v_rev,1,v_corba,20,'koli');

  select * into r from app.siparis_teslim_farki(v_sip) where kalem_id=v_corba;
  if r.istendi <> 20 then
    raise exception 'BAŞARISIZ: revizyondan sonra istendi % (20 bekleniyordu).', r.istendi;
  end if;
  if r.kalan <> 5 then
    raise exception 'BAŞARISIZ: revizyondan sonra kalan % (20-15=5 bekleniyordu).', r.kalan;
  end if;
  raise notice '   ✅ istendi 20 · gitti 15 · kalan 5';

  raise notice '';
  raise notice '════ 0058 PROVASI: 8/8 GEÇTİ ════';
end;
$$;
rollback;
