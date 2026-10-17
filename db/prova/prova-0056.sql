\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_b uuid; v_m uuid; v_u uuid;
  v_corba uuid; v_pilav uuid; v_tatli uuid;
  v_sip uuid; v_sip2 uuid; v_rev uuid; v_rec uuid;
  r record;
begin
  select id into v_t from tenant where code='ABC';
  select id into v_b from branch where tenant_id=v_t limit 1;
  insert into app_user (tenant_id, username, username_key, full_name, role_code)
    values (v_t, 'prova56', 'prova56', 'Prova Kullanıcısı',
            (select role_code from app_user where role_code is not null limit 1))
    returning id into v_u;

  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (v_t,v_b,'P-CRB','p-crb','Çorba','koli') returning id into v_corba;
  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (v_t,v_b,'P-PLV','p-plv','Pilav','koli') returning id into v_pilav;
  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (v_t,v_b,'P-TAT','p-tat','Tatlı (satın alınan)','koli') returning id into v_tatli;

  -- Çorbanın reçetesi var, pilavın var, tatlının YOK (satın alınıyor).
  insert into recipe (tenant_id, code, code_key, name, output_item_id, output_qty, output_uom, status)
    values (v_t,'R-CRB','r-crb','Çorba reçetesi',v_corba,1,'koli','ACTIVE') returning id into v_rec;
  insert into recipe (tenant_id, code, code_key, name, output_item_id, output_qty, output_uom, status)
    values (v_t,'R-PLV','r-plv','Pilav reçetesi',v_pilav,1,'koli','ACTIVE');

  -- Depoda 30 koli çorba, 0 pilav, 10 tatlı var.
  insert into stock_movement (tenant_id, branch_id, stock_item_id, quantity_base,
                              quantity_entered, uom_entered, reason, source_type,
                              idempotency_key, occurred_at)
    values (v_t,v_b,v_corba,30,30,'koli','OPENING_BALANCE','opening','prv56-1',now()),
           (v_t,v_b,v_tatli,10,10,'koli','OPENING_BALANCE','opening','prv56-3',now());

  insert into customer (tenant_id, code, code_key, name) values (v_t,'MGR','mgr','Migros') returning id into v_m;

  -- Sipariş: 40 çorba · 25 pilav · 4 tatlı
  insert into sales_order (tenant_id, branch_id, order_no, customer_id)
    values (v_t,v_b,'SIP-P-1',v_m) returning id into v_sip;
  insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason)
    values (v_t,v_sip,1,'MIKTAR','Telefon','İlk') returning id into v_rev;
  insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
    values (v_t,v_sip,v_rev,1,v_corba,40,'koli'),
           (v_t,v_sip,v_rev,2,v_pilav,25,'koli'),
           (v_t,v_sip,v_rev,3,v_tatli,4,'koli');

  raise notice '--- 1) Depoda olan depodan, olmayan üretimden';
  for r in select * from app.siparis_karsilama_plani(v_sip) loop
    raise notice '   % · istenen % · bakiye % · rezerve % · depodan % · üretilecek % · üretilebilir %',
      r.kalem_adi, r.siparis_miktar, r.depo_bakiye, r.rezerve, r.depodan, r.uretilecek, r.uretilebilir;
  end loop;

  select * into r from app.siparis_karsilama_plani(v_sip) where kalem_id = v_corba;
  if r.depodan <> 30 or r.uretilecek <> 10 then
    raise exception 'BAŞARISIZ: çorba depodan %, üretilecek % (30/10 bekleniyordu).', r.depodan, r.uretilecek;
  end if;
  select * into r from app.siparis_karsilama_plani(v_sip) where kalem_id = v_pilav;
  if r.depodan <> 0 or r.uretilecek <> 25 then
    raise exception 'BAŞARISIZ: pilav depodan %, üretilecek %.', r.depodan, r.uretilecek;
  end if;
  raise notice '   ✅ çorba 30 depodan + 10 üretim · pilav tamamı üretim';

  raise notice '--- 2) REÇETESİ OLMAYAN kalem üretilemez diye işaretlenmeli';
  select * into r from app.siparis_karsilama_plani(v_sip) where kalem_id = v_tatli;
  if r.uretilebilir then raise exception 'BAŞARISIZ: reçetesiz kalem üretilebilir sayıldı.'; end if;
  if r.depodan <> 4 or r.uretilecek <> 0 then
    raise exception 'BAŞARISIZ: tatlı depodan %, üretilecek %.', r.depodan, r.uretilecek;
  end if;
  raise notice '   ✅ tatlı: 4 depodan karşılanıyor, üretim yok, reçete yok';

  raise notice '--- 3) BAŞKA AÇIK SİPARİŞ bakiyeyi azaltmalı';
  -- İkinci sipariş de 20 koli çorba istiyor ve ONAYLANDI.
  insert into sales_order (tenant_id, branch_id, order_no, customer_id, status)
    values (v_t,v_b,'SIP-P-2',v_m,'Taslak') returning id into v_sip2;
  insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason)
    values (v_t,v_sip2,1,'MIKTAR','Telefon','İlk') returning id into v_rev;
  insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
    values (v_t,v_sip2,v_rev,1,v_corba,20,'koli');
  update sales_order set status='Onay Bekliyor' where id=v_sip2;
  insert into order_approval (tenant_id, order_id, revision_no, step_code, decision, decided_by)
    values (v_t,v_sip2,1,'SATIS','Olumlu',v_u);
  update sales_order set status='Onaylandı' where id=v_sip2;

  select * into r from app.siparis_karsilama_plani(v_sip) where kalem_id = v_corba;
  if r.rezerve <> 20 then raise exception 'BAŞARISIZ: rezerve % (20 bekleniyordu).', r.rezerve; end if;
  if r.depodan <> 10 or r.uretilecek <> 30 then
    raise exception 'BAŞARISIZ: ikinci sipariş hesaba katılmadı — depodan %, üretilecek %.',
      r.depodan, r.uretilecek;
  end if;
  raise notice '   ✅ 20 koli başka siparişe ayrılmış · bu siparişe 10 depodan, 30 üretim';

  raise notice '--- 4) TASLAK sipariş rezerve SAYILMAMALI';
  -- Taslak bir taahhüt değildir.
  declare v_sip3 uuid; v_rez numeric;
  begin
    insert into sales_order (tenant_id, branch_id, order_no, customer_id)
      values (v_t,v_b,'SIP-P-3',v_m) returning id into v_sip3;
    insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason)
      values (v_t,v_sip3,1,'MIKTAR','Telefon','İlk') returning id into v_rev;
    insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
      values (v_t,v_sip3,v_rev,1,v_corba,99,'koli');
    select rezerve into v_rez from app.siparis_karsilama_plani(v_sip) where kalem_id = v_corba;
    if v_rez <> 20 then raise exception 'BAŞARISIZ: taslak sipariş rezerve sayıldı (%).', v_rez; end if;
  end;
  raise notice '   ✅ taslak sayılmıyor';

  raise notice '--- 5) BİRİM UYUŞMAZLIĞINDA hesap YAPILMAMALI';
  declare v_sip4 uuid;
  begin
    insert into sales_order (tenant_id, branch_id, order_no, customer_id)
      values (v_t,v_b,'SIP-P-4',v_m) returning id into v_sip4;
    insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason)
      values (v_t,v_sip4,1,'MIKTAR','Telefon','İlk') returning id into v_rev;
    insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
      values (v_t,v_sip4,v_rev,1,v_corba,100,'kg');
    select * into r from app.siparis_karsilama_plani(v_sip4) where kalem_id = v_corba;
    if not r.birim_uyusmuyor or r.depodan is not null or r.uretilecek is not null then
      raise exception 'BAŞARISIZ: kg/koli karışımında sayı uyduruldu (depodan %, üretilecek %).',
        r.depodan, r.uretilecek;
    end if;
  end;
  raise notice '   ✅ kalan NULL, birim_uyusmuyor doğru';

  raise notice '════ 0056 PROVASI TAMAM ════';
end $$;
rollback;
