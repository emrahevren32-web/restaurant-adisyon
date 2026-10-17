\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_b uuid; v_m uuid; v_k uuid; v_u uuid;
  v_sip uuid; v_rev uuid; v_durum text; v_soz date;
begin
  select id into v_t from tenant where code='MIYOP';
  select id into v_b from branch where tenant_id=v_t limit 1;
  select id into v_u from app_user where tenant_id=v_t limit 1;
  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom, vat_rate)
    values (v_t,v_b,'P-CRB','p-crb','Çorba','koli',1) returning id into v_k;
  insert into customer (tenant_id, code, code_key, name, tax_number)
    values (v_t,'MGR','mgr','Migros','1234567890') returning id into v_m;

  insert into sales_order (tenant_id, branch_id, order_no, customer_id, requested_delivery_date)
    values (v_t,v_b,'SIP-R-1',v_m,'2026-10-02') returning id into v_sip;
  insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason)
    values (v_t,v_sip,1,'MIKTAR','Telefon','İlk kayıt') returning id into v_rev;
  insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
    values (v_t,v_sip,v_rev,1,v_k,200,'koli');

  raise notice '--- 1) Taslakken revizyon yazmak durumu BOZMAMALI';
  select status into v_durum from sales_order where id=v_sip;
  if v_durum <> 'Taslak' then raise exception 'BAŞARISIZ: durum %.', v_durum; end if;
  raise notice '   ✅ Taslak';

  update sales_order set status='Onay Bekliyor' where id=v_sip;
  insert into order_approval (tenant_id, order_id, revision_no, step_code, decision, decided_by, promised_on)
    values (v_t,v_sip,1,'SATIS','Şartlı',v_u,'2026-10-05');
  update sales_order set status='Onaylandı' where id=v_sip;
  update sales_order set status='Hazırlanıyor' where id=v_sip;
  select status, promised_delivery_date into v_durum, v_soz from sales_order where id=v_sip;
  raise notice '--- 2) Kurulum: % · söz %', v_durum, v_soz;
  if v_soz is null then raise exception 'BAŞARISIZ: söz verilen tarih yazılmadı.'; end if;

  raise notice '--- 3) MİKTAR revizyonu siparişi ONAYA GERİ ALMALI';
  update sales_order set current_revision = 2 where id = v_sip;
  insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason, created_by)
    values (v_t,v_sip,2,'MIKTAR','Telefon','Müşteri 350 istedi',v_u) returning id into v_rev;
  insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
    values (v_t,v_sip,v_rev,1,v_k,350,'koli');

  select status, promised_delivery_date into v_durum, v_soz from sales_order where id=v_sip;
  if v_durum <> 'Onay Bekliyor' then
    raise exception 'BAŞARISIZ: durum % (Onay Bekliyor bekleniyordu) — ÜRETİM ONAYSIZ MİKTARI HAZIRLARDI.', v_durum;
  end if;
  if v_soz is not null then
    raise exception 'BAŞARISIZ: eski söz (%) duruyor — eski miktara verilmişti.', v_soz;
  end if;
  raise notice '   ✅ Onay Bekliyor · söz silindi';

  raise notice '--- 4) Geri alınış OLAY defterine düşmeli';
  if not exists (select 1 from sales_order_event
                  where order_id=v_sip and to_status='Onay Bekliyor'
                    and detail like '%onaylar düştü%') then
    raise exception 'BAŞARISIZ: olay yazılmadı.';
  end if;
  raise notice '   ✅ olay defterinde';

  raise notice '--- 5) Eski onayla YENİDEN onaylanamamalı';
  begin
    update sales_order set status='Onaylandı' where id=v_sip;
    raise exception 'BAŞARISIZ: rev 1 onayıyla rev 2 onaylandı.';
  exception when sqlstate 'MI429' then raise notice '   ✅ MI429';
  end;

  raise notice '--- 6) LOJİSTİK revizyonu onayı DÜŞÜRMEMELİ';
  insert into order_approval (tenant_id, order_id, revision_no, step_code, decision, decided_by)
    values (v_t,v_sip,2,'SATIS','Olumlu',v_u);
  update sales_order set status='Onaylandı' where id=v_sip;
  update sales_order set current_revision = 3 where id = v_sip;
  insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason, created_by)
    values (v_t,v_sip,3,'LOJISTIK','Telefon','Teslim tarihi kaydı',v_u);
  select status into v_durum from sales_order where id=v_sip;
  -- ⚠️ Lojistik revizyonu durumu düşürmüyor AMA current_revision arttığı için
  -- onay kapısı bir daha geçilemez; bu bilinçli mi, sınayalım.
  if v_durum <> 'Onaylandı' then
    raise exception 'BAŞARISIZ: lojistik revizyonu siparişi onaya geri aldı (%).', v_durum;
  end if;
  raise notice '   ✅ Onaylandı kaldı — miktar değişmedi';

  raise notice '════ 0055 PROVASI TAMAM ════';
end $$;
rollback;
