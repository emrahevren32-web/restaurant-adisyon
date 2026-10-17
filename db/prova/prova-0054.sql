-- 0054 DAVRANIŞ PROVASI — en önemlisi YALITIM (yalnız yerel)
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;

-- Kurulum: iki müşteri, noktalar, fiyatlar, portal kullanıcıları
do $$
declare
  v_t uuid; v_b uuid;
  v_mig uuid; v_car uuid;
  v_ata uuid; v_kad uuid; v_car_n uuid;
  v_k1 uuid; v_k2 uuid;
  v_pu_merkez uuid; v_pu_sube uuid; v_pu_car uuid;
begin
  select id into v_t from tenant where code='MIYOP';
  select id into v_b from branch where tenant_id=v_t limit 1;

  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom, vat_rate)
    values (v_t,v_b,'P-CRB','p-crb','Mercimek çorbası','koli',1) returning id into v_k1;
  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom, vat_rate)
    values (v_t,v_b,'P-PLV','p-plv','Pilav','koli',1) returning id into v_k2;

  insert into customer (tenant_id, code, code_key, name, tax_number)
    values (v_t,'MGR','mgr','Migros','1234567890') returning id into v_mig;
  insert into customer (tenant_id, code, code_key, name, tax_number)
    values (v_t,'CRF','crf','Carrefour','1234567891') returning id into v_car;

  -- Migros: iki nokta. Ataşehir kesim 10:00, ertesi gün teslim.
  insert into delivery_point (tenant_id, customer_id, code, code_key, name, order_cutoff_time, delivery_lead_days)
    values (v_t,v_mig,'ATA','ata','Ataşehir','10:00',1) returning id into v_ata;
  insert into delivery_point (tenant_id, customer_id, code, code_key, name, order_cutoff_time, delivery_lead_days)
    values (v_t,v_mig,'KAD','kad','Kadıköy','23:59',0) returning id into v_kad;
  insert into delivery_point (tenant_id, customer_id, code, code_key, name)
    values (v_t,v_car,'CR1','cr1','Carrefour Maltepe') returning id into v_car_n;

  -- Fiyat defteri: Migros'un yalnız ÇORBA sözleşmesi var.
  insert into customer_price (tenant_id, customer_id, stock_item_id, unit_price, uom_code)
    values (v_t,v_mig,v_k1,120,'koli');
  insert into customer_price (tenant_id, customer_id, stock_item_id, unit_price, uom_code)
    values (v_t,v_car,v_k1,125,'koli');

  -- Portal kullanıcıları
  insert into portal_user (tenant_id, customer_id, email, full_name)
    values (v_t,v_mig,'merkez@migros.test','Migros Merkez') returning id into v_pu_merkez;
  insert into portal_user (tenant_id, customer_id, email, full_name)
    values (v_t,v_mig,'atasehir@migros.test','Ataşehir Şube') returning id into v_pu_sube;
  insert into portal_user (tenant_id, customer_id, email, full_name)
    values (v_t,v_car,'satinalma@carrefour.test','Carrefour') returning id into v_pu_car;

  -- Şube kullanıcısı YALNIZ Ataşehir'e yazabilir. Merkez kullanıcısının
  -- kısıt satırı YOK → bütün noktalar.
  insert into portal_user_point (portal_user_id, delivery_point_id, tenant_id)
    values (v_pu_sube, v_ata, v_t);

  raise notice 'kurulum tamam';
end $$;

-- ── Oturum taklidi: JWT'de yalnız e-posta var, tenant iddiası YOK ──────────
do $$
declare v_say int; v_nokta uuid; v_kalem uuid; v_no text; v_erken date; v_durum text;
begin
  perform set_config('request.jwt.claims', '{"email":"merkez@migros.test"}', true);

  raise notice '--- 1) MERKEZ kullanıcısı müşterinin BÜTÜN noktalarını görüyor';
  select count(*) into v_say from public.portal_noktalarim();
  if v_say <> 2 then raise exception 'BAŞARISIZ: % nokta (2 bekleniyordu).', v_say; end if;
  raise notice '   ✅ 2 nokta (Ataşehir + Kadıköy)';

  raise notice '--- 2) BAŞKA müşterinin noktası GÖRÜNMÜYOR';
  if exists (select 1 from public.portal_noktalarim() where nokta_adi like 'Carrefour%') then
    raise exception 'BAŞARISIZ: Carrefour noktası Migros kullanıcısına görünüyor.';
  end if;
  raise notice '   ✅ Carrefour görünmüyor';

  raise notice '--- 3) ŞUBE kullanıcısı YALNIZ kendi noktasını görüyor';
  perform set_config('request.jwt.claims', '{"email":"atasehir@migros.test"}', true);
  select count(*) into v_say from public.portal_noktalarim();
  if v_say <> 1 then raise exception 'BAŞARISIZ: % nokta (1 bekleniyordu).', v_say; end if;
  if not exists (select 1 from public.portal_noktalarim() where nokta_adi='Ataşehir') then
    raise exception 'BAŞARISIZ: yanlış nokta görünüyor.';
  end if;
  raise notice '   ✅ yalnız Ataşehir — "duruma göre şubede, merkezde" çalışıyor';

  raise notice '--- 4) Katalog FİYAT DEFTERİNDEN süzülüyor, fiyat DÖNMÜYOR';
  select nokta_id into v_nokta from public.portal_noktalarim() limit 1;
  select count(*) into v_say from public.portal_urunlerim(v_nokta);
  if v_say <> 1 then raise exception 'BAŞARISIZ: % ürün (yalnız sözleşmeli çorba bekleniyordu).', v_say; end if;
  raise notice '   ✅ 1 ürün (sözleşmesi olmayan pilav listede yok)';

  raise notice '--- 5) Kesim saatini geçmişse en erken sevk YARINA kayıyor';
  -- Ataşehir: kesim 10:00, teslim +1 gün.
  select public.portal_en_erken_sevk(v_nokta) into v_erken;
  if current_time::time > time '10:00' then
    if v_erken <> current_date + 2 then
      raise exception 'BAŞARISIZ: kesim geçti, en erken % (bugün+2 bekleniyordu).', v_erken;
    end if;
    raise notice '   ✅ kesim geçti → % (bugün+2: yarına kaydı + 1 gün teslim)', v_erken;
  else
    if v_erken <> current_date + 1 then
      raise exception 'BAŞARISIZ: kesim geçmedi, en erken %.', v_erken;
    end if;
    raise notice '   ✅ kesim geçmedi → % (bugün + 1 gün teslim)', v_erken;
  end if;

  raise notice '--- 6) En erkenden ÖNCEKİ tarih reddediliyor';
  select kalem_id into v_kalem from public.portal_urunlerim(v_nokta);
  begin
    perform public.portal_siparis_ver(v_nokta,
      jsonb_build_array(jsonb_build_object('kalem_id',v_kalem,'miktar',10,'birim','koli')),
      current_date);
    raise exception 'BAŞARISIZ: bugüne teslim kabul edildi.';
  exception when sqlstate 'MI432' then raise notice '   ✅ MI432: %', sqlerrm;
  end;

  raise notice '--- 7) Sözleşmesi OLMAYAN ürün reddediliyor';
  begin
    perform public.portal_siparis_ver(v_nokta,
      jsonb_build_array(jsonb_build_object(
        'kalem_id',(select id from public.stock_item where code_key='p-plv'),
        'miktar',5,'birim','koli')));
    raise exception 'BAŞARISIZ: sözleşmesiz ürün sipariş edildi.';
  exception when sqlstate 'MI431' then raise notice '   ✅ MI431: %', sqlerrm;
  end;

  raise notice '--- 8) YETKİSİZ noktaya sipariş reddediliyor';
  begin
    perform public.portal_siparis_ver(
      (select id from public.delivery_point where code_key='kad'),
      jsonb_build_array(jsonb_build_object('kalem_id',v_kalem,'miktar',10,'birim','koli')));
    raise exception 'BAŞARISIZ: şube kullanıcısı Kadıköy''e sipariş yazdı.';
  exception when sqlstate 'MI431' then raise notice '   ✅ MI431: şube kendi noktası dışına yazamıyor';
  end;

  raise notice '--- 9) Geçerli sipariş ONAY BEKLİYOR olarak doğuyor';
  v_no := public.portal_siparis_ver(v_nokta,
    jsonb_build_array(jsonb_build_object('kalem_id',v_kalem,'miktar',30,'birim','koli')),
    null, 'Portal denemesi');
  select status into v_durum from public.sales_order where order_no = v_no;
  if v_durum <> 'Onay Bekliyor' then raise exception 'BAŞARISIZ: durum %.', v_durum; end if;
  if not exists (select 1 from public.sales_order_revision r
                  join public.sales_order o on o.id = r.order_id
                 where o.order_no = v_no and r.source = 'Portal') then
    raise exception 'BAŞARISIZ: revizyon kaynağı Portal değil.';
  end if;
  raise notice '   ✅ % · Onay Bekliyor · kaynak Portal', v_no;

  raise notice '--- 10) Portal KENDİ siparişini görüyor, BAŞKASININ değil';
  if not exists (select 1 from public.portal_siparislerim() where siparis_no = v_no) then
    raise exception 'BAŞARISIZ: kendi siparişini görmüyor.';
  end if;
  perform set_config('request.jwt.claims', '{"email":"satinalma@carrefour.test"}', true);
  if exists (select 1 from public.portal_siparislerim() where siparis_no = v_no) then
    raise exception 'BAŞARISIZ: Carrefour, Migros''un siparişini GÖRÜYOR.';
  end if;
  raise notice '   ✅ Carrefour, Migros''un siparişini görmüyor — İKİNCİ YALITIM EKSENİ çalışıyor';

  raise notice '--- 11) Satır dökümünde FİYAT KOLONU YOK';
  perform set_config('request.jwt.claims', '{"email":"atasehir@migros.test"}', true);
  select count(*) into v_say from public.portal_siparis_satirlarim(v_no);
  if v_say <> 1 then raise exception 'BAŞARISIZ: % satır.', v_say; end if;
  if exists (select 1 from information_schema.routines r
              join information_schema.parameters p on p.specific_name = r.specific_name
             where r.routine_name = 'portal_siparis_satirlarim'
               and p.parameter_name in ('birim_fiyat','unit_price','fiyat')) then
    raise exception 'BAŞARISIZ: satır dökümünde fiyat kolonu var.';
  end if;
  raise notice '   ✅ satır var, fiyat yok';

  raise notice '--- 12) Erişimi KAPATILAN kullanıcı giremiyor';
  update public.portal_user set is_active = false where email='atasehir@migros.test';
  begin
    perform public.portal_siparis_ver(v_nokta,
      jsonb_build_array(jsonb_build_object('kalem_id',v_kalem,'miktar',10,'birim','koli')));
    raise exception 'BAŞARISIZ: kapatılmış kullanıcı sipariş verdi.';
  exception when sqlstate 'MI431' then raise notice '   ✅ MI431: erişim kapandı';
  end;

  raise notice '--- 13) Portal siparişi de ONAY ZİNCİRİNDEN geçiyor';
  begin
    update public.sales_order set status='Onaylandı' where order_no = v_no;
    raise exception 'BAŞARISIZ: portal siparişi zinciri atladı.';
  exception when sqlstate 'MI429' then raise notice '   ✅ MI429: ayrı bir yol açılmadı';
  end;

  raise notice '════ 0054 PROVASI TAMAM ════';
end $$;
rollback;
