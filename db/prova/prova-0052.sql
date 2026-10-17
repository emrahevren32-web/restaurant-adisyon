-- 0052 DAVRANIŞ PROVASI (yalnız yerel)
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_b uuid; v_m uuid; v_m2 uuid; v_k uuid; v_sip uuid; v_rev uuid;
  v_oran numeric;
begin
  select id into v_t from tenant where code='MIYOP';
  select id into v_b from branch where tenant_id=v_t limit 1;

  raise notice '--- 1) Bozuk vergi numarası reddedilmeli';
  begin
    insert into customer (tenant_id, code, code_key, name, tax_number)
      values (v_t,'X1','x1','Bozuk','12345');
    raise exception 'BAŞARISIZ: 5 haneli vergi no kabul edildi.';
  exception when check_violation then raise notice '   ✅ reddedildi';
  end;

  raise notice '--- 2) Doğru VKN (10) ve TCKN (11) kabul edilmeli';
  insert into customer (tenant_id, code, code_key, name, tax_number, legal_name, kep_address)
    values (v_t,'MGR','mgr','Migros','1234567890','Migros Ticaret A.Ş.','migros@hs01.kep.tr')
    returning id into v_m;
  insert into customer (tenant_id, code, code_key, name, tax_number)
    values (v_t,'SHS','shs','Şahıs firma','12345678901') returning id into v_m2;
  raise notice '   ✅ ikisi de yazıldı';

  raise notice '--- 3) Aynı vergi numarası İKİNCİ karta yazılamamalı';
  begin
    insert into customer (tenant_id, code, code_key, name, tax_number)
      values (v_t,'MGR2','mgr2','Migros (kopya)','1234567890');
    raise exception 'BAŞARISIZ: aynı vergi no ikinci kez yazıldı.';
  exception when unique_violation then raise notice '   ✅ reddedildi — çift kart engellendi';
  end;

  raise notice '--- 4) Bozuk KEP adresi reddedilmeli';
  begin
    update customer set kep_address='migros.kep.tr' where id=v_m;
    raise exception 'BAŞARISIZ: @ içermeyen KEP kabul edildi.';
  exception when check_violation then raise notice '   ✅ reddedildi';
  end;

  raise notice '--- 5) KDV oranı sipariş satırına KENDİLİĞİNDEN kopyalanmalı';
  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom, vat_rate)
    values (v_t, v_b, 'P-EKM','p-ekm','Ekmek','koli', 1) returning id into v_k;
  insert into sales_order (tenant_id, branch_id, order_no, customer_id)
    values (v_t, v_b, 'SIP-KDV-1', v_m) returning id into v_sip;
  insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason)
    values (v_t, v_sip, 1, 'MIKTAR','Telefon','İlk kayıt') returning id into v_rev;
  insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
    values (v_t, v_sip, v_rev, 1, v_k, 10, 'koli');
  select vat_rate into v_oran from sales_order_line where revision_id=v_rev and line_no=1;
  if v_oran <> 1 then raise exception 'BAŞARISIZ: satıra kopyalanan oran % (1 bekleniyordu).', v_oran; end if;
  raise notice '   ✅ satıra %%1 kopyalandı';

  raise notice '--- 6) Kalemin oranı DEĞİŞSE bile ESKİ satır DEĞİŞMEMELİ';
  update stock_item set vat_rate = 20 where id = v_k;
  select vat_rate into v_oran from sales_order_line where revision_id=v_rev and line_no=1;
  if v_oran <> 1 then raise exception 'BAŞARISIZ: donmuş oran değişti (%).', v_oran; end if;
  raise notice '   ✅ eski satır hâlâ %%1 — belge donmuş';

  raise notice '--- 7) Açıkça verilen oran EZİLMEMELİ';
  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom, vat_rate)
    values (v_t, v_b, 'P-TAT','p-tat','Tatlı','koli', 1);
  insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code, vat_rate)
    values (v_t, v_sip, v_rev, 2, (select id from stock_item where code_key='p-tat'), 5, 'koli', 10);
  select vat_rate into v_oran from sales_order_line where revision_id=v_rev and line_no=2;
  if v_oran <> 10 then raise exception 'BAŞARISIZ: verilen oran ezildi (%).', v_oran; end if;
  raise notice '   ✅ elle verilen %%10 korundu';

  raise notice '--- 8) Geçersiz KDV oranı reddedilmeli';
  begin
    update stock_item set vat_rate = 150 where id = v_k;
    raise exception 'BAŞARISIZ: %%150 KDV kabul edildi.';
  exception when check_violation then raise notice '   ✅ reddedildi';
  end;

  raise notice '════ 0052 PROVASI TAMAM ════';
end $$;
rollback;
