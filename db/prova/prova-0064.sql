-- 0064 · araç ve şoför davranış provası.
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_t2 uuid; v_c uuid; v_b uuid; v_m uuid; v_k uuid;
  v_arac uuid; v_sofor uuid; v_yabanci_arac uuid; v_b2 uuid; v_c2 uuid;
  v_sevk uuid; v_ccp uuid; v_olcum uuid;
  v_gecen int := 0; v_kalan int := 0;
begin
  select id into v_t from tenant where code='MIYOP';
  select id into v_b from branch where tenant_id=v_t limit 1;
  insert into customer (tenant_id,code,code_key,name) values (v_t,'A64','a64','Migros')
    returning id into v_m;
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'A64-CRB','a64-crb','Çorba','koli') returning id into v_k;

  -- Başka kiracı
  insert into tenant (code,name) values ('A64B','Baska') returning id into v_t2;
  insert into company (tenant_id,company_code,company_name)
    values (v_t2,'A64B','Baska A.Ş.') returning id into v_c2;
  insert into branch (tenant_id,company_id,code,name,branch_type,is_head_office)
    values (v_t2,v_c2,'MRK','Merkez','merkez',true) returning id into v_b2;

  -- ── 1 · Araç kartı · plaka tekilliği anahtara göre ──────────────────────
  insert into vehicle (tenant_id,plate,plate_key,name,capacity_kg,is_refrigerated,
                       min_temp_c,max_temp_c)
    values (v_t,'34 ABC 123','34ABC123','Frigo 1',3500,true,-20,4)
    returning id into v_arac;
  begin
    -- "34abc123" aynı araçtır.
    insert into vehicle (tenant_id,plate,plate_key,name)
      values (v_t,'34abc123','34ABC123','Kopya');
    v_kalan := v_kalan + 1; raise notice '❌ 1 · aynı plaka iki kez yazıldı';
  exception when unique_violation then v_gecen := v_gecen + 1;
  end;

  -- ── 2 · Soğutmasız araca sıcaklık aralığı yazılamıyor ───────────────────
  -- Yazılabilseydi ekran onu bir yetenek sanıp soğuk zincir ürünü yükletirdi.
  begin
    insert into vehicle (tenant_id,plate,plate_key,is_refrigerated,min_temp_c,max_temp_c)
      values (v_t,'34 XYZ 1','34XYZ1',false,-18,0);
    v_kalan := v_kalan + 1; raise notice '❌ 2 · soğutmasız araca aralık yazıldı';
  exception when check_violation then v_gecen := v_gecen + 1;
  end;

  -- ── 3 · Ters aralık reddediliyor ───────────────────────────────────────
  begin
    insert into vehicle (tenant_id,plate,plate_key,is_refrigerated,min_temp_c,max_temp_c)
      values (v_t,'34 TRS 1','34TRS1',true,4,-20);
    v_kalan := v_kalan + 1; raise notice '❌ 3 · min > max kabul edildi';
  exception when check_violation then v_gecen := v_gecen + 1;
  end;

  -- ── 4 · Şoför kartı ────────────────────────────────────────────────────
  insert into driver (tenant_id,full_name,phone,licence_class)
    values (v_t,'Hasan Yıldız','0555','E') returning id into v_sofor;
  if (select full_name from driver where id=v_sofor) = 'Hasan Yıldız'
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 4 · şoför yazılmadı';
  end if;

  -- ── 5 · Sevkiyat araçsız da açılabiliyor ───────────────────────────────
  -- Kendi aracı olmayan, kargoyla gönderen işletme sisteme girebilmeli.
  insert into shipment (tenant_id,branch_id,shipment_no,customer_name,customer_id,status)
    values (v_t,v_b,'SHP-A64-1','Migros',v_m,'DRAFT') returning id into v_sevk;
  v_gecen := v_gecen + 1;

  -- ── 6 · Araç ve şoför bağlanıyor ───────────────────────────────────────
  update shipment set vehicle_id=v_arac, driver_id=v_sofor where id=v_sevk;
  if (select vehicle_id from shipment where id=v_sevk) = v_arac
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 6 · araç bağlanmadı';
  end if;

  -- ── 7 · BAŞKA KİRACININ ARACI bağlanamıyor (MI424) ─────────────────────
  insert into vehicle (tenant_id,plate,plate_key) values (v_t2,'06 YBN 1','06YBN1')
    returning id into v_yabanci_arac;
  begin
    update shipment set vehicle_id=v_yabanci_arac where id=v_sevk;
    v_kalan := v_kalan + 1; raise notice '❌ 7 · BAŞKA KİRACININ ARACI BAĞLANDI';
  exception when sqlstate 'MI424' then v_gecen := v_gecen + 1;
  end;

  -- ── 8 · CCP-8 ölçümü sevkiyata bağlanabiliyor ──────────────────────────
  -- Yeni kolon açmadık; 0024'ün defteri zaten bunu kabul ediyor.
  select id into v_ccp from haccp_ccp where tenant_id=v_t and code='CCP-8';
  if v_ccp is null then
    raise notice '⚠️ CCP-8 yok, 8 ve 9 atlandı';
  else
    insert into haccp_measurement
      (tenant_id,branch_id,ccp_id,measured_value,uom,result,limit_snapshot,
       source_type,source_id)
      values (v_t,v_b,v_ccp,2.5,'°C','PASS','En çok 4 °C','shipment',v_sevk)
      returning id into v_olcum;
    -- Ölçümden araca ulaşılabiliyor mu? Göçün asıl sorusu buydu.
    if (select v.plate from haccp_measurement m
          join shipment s on s.id = m.source_id and m.source_type='shipment'
          join vehicle v on v.id = s.vehicle_id
         where m.id = v_olcum) = '34 ABC 123'
    then v_gecen := v_gecen + 1;
    else v_kalan := v_kalan + 1;
      raise notice '❌ 8 · ölçümden araca ulaşılamıyor';
    end if;
  end if;

  -- ── 9 · SEVK EDİLDİKTEN SONRA ARAÇ DEĞİŞMİYOR (MI434) ──────────────────
  -- Müşterinin elindeki kâğıtta yazan plaka ile defterdeki ayrışamaz.
  insert into shipment_line (tenant_id,shipment_id,line_no,stock_item_id,qty,uom)
    values (v_t,v_sevk,1,v_k,5,'koli');
  update shipment set status='SHIPPED', shipped_on=current_date where id=v_sevk;

  insert into vehicle (tenant_id,plate,plate_key) values (v_t,'34 YNI 1','34YNI1');
  begin
    update shipment set vehicle_id=(select id from vehicle where plate_key='34YNI1')
     where id=v_sevk;
    v_kalan := v_kalan + 1; raise notice '❌ 9 · SEVK EDİLMİŞ BELGENİN ARACI DEĞİŞTİ';
  exception when sqlstate 'MI434' then v_gecen := v_gecen + 1;
  end;

  -- ── 10 · Sevk sonrası BAŞKA alanlar değişebiliyor ──────────────────────
  -- Kural yalnız araç/şoföre; notu kilitlemek gereksiz olurdu.
  update shipment set note='teslim edildi' where id=v_sevk;
  v_gecen := v_gecen + 1;

  -- ── 11 · Araç SİLİNEMİYOR, pasife alınıyor ─────────────────────────────
  update vehicle set is_active=false where id=v_arac;
  if (select is_active from vehicle where id=v_arac) = false
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 11 · pasife alınamadı';
  end if;

  -- ── 12 · Kullanılan araç silinemiyor (yabancı anahtar) ─────────────────
  begin
    delete from vehicle where id=v_arac;
    v_kalan := v_kalan + 1; raise notice '❌ 12 · sevkiyatı olan araç silindi';
  exception when foreign_key_violation then v_gecen := v_gecen + 1;
  end;

  raise notice '──────── 0064 provası: % geçti, % kaldı', v_gecen, v_kalan;
  if v_kalan > 0 then raise exception '0064 provası KALDI (% hata)', v_kalan; end if;
end $$;
rollback;
