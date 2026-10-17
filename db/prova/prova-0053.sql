-- 0053 DAVRANIŞ PROVASI (yalnız yerel)
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_b uuid; v_m uuid; v_k uuid; v_sip uuid; v_rev uuid; v_rev2 uuid;
  v_u uuid; v_durum text; v_soz date; v_say int;
begin
  select id into v_t from tenant where code='MIYOP';
  select id into v_b from branch where tenant_id=v_t limit 1;
  select id into v_u from app_user where tenant_id=v_t limit 1;

  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom, vat_rate)
    values (v_t,v_b,'P-CRB','p-crb','Mercimek çorbası','koli',1) returning id into v_k;
  insert into customer (tenant_id, code, code_key, name, tax_number)
    values (v_t,'MGR','mgr','Migros','1234567890') returning id into v_m;
  insert into sales_order (tenant_id, branch_id, order_no, customer_id, requested_delivery_date)
    values (v_t,v_b,'SIP-ONAY-1',v_m,'2026-10-02') returning id into v_sip;
  insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason)
    values (v_t,v_sip,1,'MIKTAR','Telefon','İlk kayıt') returning id into v_rev;
  insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
    values (v_t,v_sip,v_rev,1,v_k,200,'koli');

  raise notice '--- 1) Varsayılan zincir kuruldu mu';
  select count(*) into v_say from order_approval_step where tenant_id=v_t and is_active;
  if v_say <> 3 then raise exception 'BAŞARISIZ: % adım (3 bekleniyordu).', v_say; end if;
  raise notice '   ✅ 3 adım: depo(görüş) · üretim(görüş) · satış(ONAY)';

  raise notice '--- 2) Taslak → Onaylandı DOĞRUDAN geçilememeli';
  begin
    update sales_order set status='Onaylandı' where id=v_sip;
    raise exception 'BAŞARISIZ: onay zinciri atlandı.';
  exception when sqlstate 'MI422' then raise notice '   ✅ MI422: zincir atlanamıyor';
  end;

  update sales_order set status='Onay Bekliyor' where id=v_sip;

  raise notice '--- 3) Görüşler tek başına yetmemeli';
  insert into order_approval (tenant_id, order_id, revision_no, step_code, decision, decided_by, note)
    values (v_t,v_sip,1,'DEPO','Olumlu',v_u,'Hammadde yeterli');
  insert into order_approval (tenant_id, order_id, revision_no, step_code, decision, decided_by, note)
    values (v_t,v_sip,1,'URETIM','Olumlu',v_u,'Bant müsait');
  begin
    update sales_order set status='Onaylandı' where id=v_sip;
    raise exception 'BAŞARISIZ: satış onayı olmadan onaylandı.';
  exception when sqlstate 'MI429' then raise notice '   ✅ MI429: %', sqlerrm;
  end;

  raise notice '--- 4) Gerekçesiz RET yazılamamalı';
  begin
    insert into order_approval (tenant_id, order_id, revision_no, step_code, decision, decided_by)
      values (v_t,v_sip,1,'SATIS','Olumsuz',v_u);
    raise exception 'BAŞARISIZ: gerekçesiz ret yazıldı.';
  exception when check_violation then raise notice '   ✅ reddedildi';
  end;

  raise notice '--- 5) ŞARTLI onay TARİHSİZ olamamalı';
  begin
    insert into order_approval (tenant_id, order_id, revision_no, step_code, decision, decided_by, note)
      values (v_t,v_sip,1,'SATIS','Şartlı',v_u,'Yetişmez');
    raise exception 'BAŞARISIZ: tarihsiz şartlı onay yazıldı.';
  exception when check_violation then raise notice '   ✅ reddedildi';
  end;

  raise notice '--- 6) Şartlı onay GEÇİRMELİ ve SÖZ VERİLEN TARİH siparişe işlenmeli';
  insert into order_approval (tenant_id, order_id, revision_no, step_code, decision, decided_by, note, promised_on)
    values (v_t,v_sip,1,'SATIS','Şartlı',v_u,'2 Ekim''e yetişmez','2026-10-05');
  update sales_order set status='Onaylandı' where id=v_sip;
  select status, promised_delivery_date into v_durum, v_soz from sales_order where id=v_sip;
  if v_durum <> 'Onaylandı' then raise exception 'BAŞARISIZ: durum %.', v_durum; end if;
  if v_soz <> date '2026-10-05' then raise exception 'BAŞARISIZ: söz verilen tarih %.', v_soz; end if;
  raise notice '   ✅ onaylandı · müşteri 02.10 istedi, mutfak 05.10 sözü verdi';

  raise notice '--- 7) Tanımsız adıma karar yazılamamalı';
  begin
    insert into order_approval (tenant_id, order_id, revision_no, step_code, decision, decided_by)
      values (v_t,v_sip,1,'DEPOO','Olumlu',v_u);
    raise exception 'BAŞARISIZ: tanımsız adım kabul edildi.';
  exception when sqlstate 'MI430' then raise notice '   ✅ MI430: yazım hatası sessizce yutulmuyor';
  end;

end $$;

-- 8'in devamı: onay BEKLERKEN revizyon geldiğinde onaylar düşmeli
do $$
declare
  v_t uuid; v_b uuid; v_m uuid; v_k uuid; v_sip uuid; v_rev uuid; v_u uuid;
begin
  select id into v_t from tenant where code='MIYOP';
  select id into v_b from branch where tenant_id=v_t limit 1;
  select id into v_u from app_user where tenant_id=v_t limit 1;
  select id into v_k from stock_item where code_key='p-crb' and tenant_id=v_t;
  select id into v_m from customer where code_key='mgr' and tenant_id=v_t;

  insert into sales_order (tenant_id, branch_id, order_no, customer_id)
    values (v_t,v_b,'SIP-ONAY-2',v_m) returning id into v_sip;
  insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason)
    values (v_t,v_sip,1,'MIKTAR','Telefon','İlk kayıt') returning id into v_rev;
  insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
    values (v_t,v_sip,v_rev,1,v_k,200,'koli');
  update sales_order set status='Onay Bekliyor' where id=v_sip;

  insert into order_approval (tenant_id, order_id, revision_no, step_code, decision, decided_by)
    values (v_t,v_sip,1,'SATIS','Olumlu',v_u);

  raise notice '--- 8) Revizyon gelince ESKİ onay DÜŞMELİ';
  insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason)
    values (v_t,v_sip,2,'MIKTAR','Telefon','Müşteri 350 istedi') returning id into v_rev;
  insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
    values (v_t,v_sip,v_rev,1,v_k,350,'koli');
  update sales_order set current_revision = 2 where id = v_sip;

  begin
    update sales_order set status='Onaylandı' where id=v_sip;
    raise exception 'BAŞARISIZ: 200 koli onayıyla 350 koli onaylandı.';
  exception when sqlstate 'MI429' then
    raise notice '   ✅ MI429: 200 koliyi onaylamak 350 koliyi onaylamak değil';
  end;

  insert into order_approval (tenant_id, order_id, revision_no, step_code, decision, decided_by)
    values (v_t,v_sip,2,'SATIS','Olumlu',v_u);
  update sales_order set status='Onaylandı' where id=v_sip;
  raise notice '   ✅ yeni revizyon onaylanınca geçti';

  raise notice '--- 9) Onay defteri EKLEMELİ: güncellenemez';
  begin
    update order_approval set decision='Olumsuz' where order_id=v_sip;
    raise exception 'BAŞARISIZ: onay kaydı güncellendi.';
  exception when sqlstate 'MI403' then raise notice '   ✅ MI403: onay kaydı değişmez';
  end;

  raise notice '--- 10) Onaylar OLAY defterine düşmeli';
  if not exists (select 1 from sales_order_event where order_id=v_sip and kind='ONAY') then
    raise exception 'BAŞARISIZ: onay olayı yazılmadı.';
  end if;
  raise notice '   ✅ olay defterinde görünüyor';

  raise notice '════ 0053 PROVASI TAMAM ════';
end $$;
rollback;
