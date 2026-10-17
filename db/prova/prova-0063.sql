-- 0063 · portaldan sipariş güncelleme — davranış provası.
-- En önemlisi: BAŞKA müşterinin siparişi numarası bilinse bile güncellenemesin.
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_b uuid; v_mig uuid; v_car uuid;
  v_ata uuid; v_kad uuid; v_car_n uuid;
  v_k1 uuid; v_k2 uuid; v_u uuid;
  v_pu_merkez uuid; v_pu_sube uuid; v_pu_car uuid;
  v_no text; v_car_no text; v_rev int; v_durum text;
  v_gecen int := 0; v_kalan int := 0;
begin
  -- ── Kurulum ─────────────────────────────────────────────────────────────
  select id into v_t from tenant where code='MIYOP';
  select id into v_b from branch where tenant_id=v_t limit 1;

  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'G63-CRB','g63-crb','Mercimek Çorbası','koli') returning id into v_k1;
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'G63-PLV','g63-plv','Pirinç Pilavı','koli') returning id into v_k2;

  insert into customer (tenant_id,code,code_key,name) values (v_t,'G63M','g63m','Migros')
    returning id into v_mig;
  insert into customer (tenant_id,code,code_key,name) values (v_t,'G63C','g63c','Carrefour')
    returning id into v_car;

  insert into delivery_point (tenant_id,customer_id,code,code_key,name)
    values (v_t,v_mig,'G63A','g63a','Ataşehir') returning id into v_ata;
  insert into delivery_point (tenant_id,customer_id,code,code_key,name)
    values (v_t,v_mig,'G63K','g63k','Kadıköy') returning id into v_kad;
  insert into delivery_point (tenant_id,customer_id,code,code_key,name)
    values (v_t,v_car,'G63C1','g63c1','Maltepe') returning id into v_car_n;

  -- Fiyat defteri: Migros'un YALNIZ çorba sözleşmesi var (pilav yok).
  insert into customer_price (tenant_id,customer_id,stock_item_id,unit_price,uom_code)
    values (v_t,v_mig,v_k1,120,'koli');
  insert into customer_price (tenant_id,customer_id,stock_item_id,unit_price,uom_code)
    values (v_t,v_car,v_k1,125,'koli');

  insert into portal_user (tenant_id,customer_id,email,full_name)
    values (v_t,v_mig,'g63-merkez@migros.test','Migros Merkez') returning id into v_pu_merkez;
  insert into portal_user (tenant_id,customer_id,email,full_name)
    values (v_t,v_mig,'g63-ata@migros.test','Ataşehir Şube') returning id into v_pu_sube;
  insert into portal_user (tenant_id,customer_id,email,full_name)
    values (v_t,v_car,'g63-sa@carrefour.test','Carrefour') returning id into v_pu_car;
  -- Şube kullanıcısı YALNIZ Ataşehir'e yetkili.
  insert into portal_user_point (portal_user_id,delivery_point_id,tenant_id)
    values (v_pu_sube,v_ata,v_t);

  -- ── Migros merkez bir sipariş veriyor (Kadıköy'e) ───────────────────────
  perform set_config('request.jwt.claims','{"email":"g63-merkez@migros.test"}',true);
  v_no := public.portal_siparis_ver(
    v_kad, jsonb_build_array(jsonb_build_object('kalem_id',v_k1,'miktar',40,'birim','koli')));

  -- ── 1 · MUTLU YOL: miktar güncelleniyor, YENİ REVİZYON doğuyor ──────────
  v_rev := public.portal_siparis_guncelle(
    v_no, jsonb_build_array(jsonb_build_object('kalem_id',v_k1,'miktar',25,'birim','koli')),
    'Okul tatili, az gerekiyor');

  if v_rev = 2
     and (select count(*) from sales_order_revision r
           join sales_order o on o.id=r.order_id where o.order_no=v_no) = 2
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 1 · revizyon numarası %', v_rev;
  end if;

  -- ── 2 · ESKİ SATIR ÜSTÜNE YAZILMADI ────────────────────────────────────
  -- Ekranın var olma sebebi bu: "ben 40 demiştim" tartışması bitsin.
  if (select count(*) from sales_order_line l
       join sales_order o on o.id=l.order_id
      where o.order_no=v_no) = 2
     and exists (select 1 from sales_order_line l
                  join sales_order o on o.id=l.order_id
                 where o.order_no=v_no and l.qty=40)
     and exists (select 1 from sales_order_line l
                  join sales_order o on o.id=l.order_id
                 where o.order_no=v_no and l.qty=25)
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 2 · eski satır kaybolmuş';
  end if;

  -- ── 3 · GÜNCEL SATIR = SON revizyon ────────────────────────────────────
  if (select l.qty from app.siparis_guncel_satirlari(
        (select id from sales_order where order_no=v_no)) l) = 25
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 3 · güncel satır yanlış';
  end if;

  -- ── 4 · KAYNAK "Portal" yazılı ─────────────────────────────────────────
  if (select r.source from sales_order_revision r
       join sales_order o on o.id=r.order_id
      where o.order_no=v_no and r.revision_no=2) = 'Portal'
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 4 · kaynak Portal değil';
  end if;

  -- ── 5 · ONAYLI SİPARİŞ "Onay Bekliyor"a DÖNÜYOR (0055) ─────────────────
  -- Mutfak onaylamadığı bir miktarı hazırlamaya devam edemesin.
  insert into app_user (tenant_id,username,username_key,full_name,role_code)
    values (v_t,'g63u','g63u','Prova 63','isletme_sahibi') returning id into v_u;
  insert into order_approval (tenant_id,order_id,revision_no,step_code,decision,decided_by)
    values (v_t,(select id from sales_order where order_no=v_no),2,'SATIS','Olumlu',v_u);
  update sales_order set status='Onaylandı' where order_no=v_no;

  perform set_config('request.jwt.claims','{"email":"g63-merkez@migros.test"}',true);
  perform public.portal_siparis_guncelle(
    v_no, jsonb_build_array(jsonb_build_object('kalem_id',v_k1,'miktar',30,'birim','koli')));

  select status into v_durum from sales_order where order_no=v_no;
  if v_durum = 'Onay Bekliyor'
     and (select promised_delivery_date from sales_order where order_no=v_no) is null
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 5 · durum % (söz silinmedi mi)', v_durum;
  end if;

  -- ── 6 · BAŞKA MÜŞTERİNİN SİPARİŞİ: numara bilinse bile HAYIR ───────────
  -- Provanın en önemli satırı. Portal ikinci bir yalıtım ekseni getiriyor.
  perform set_config('request.jwt.claims','{"email":"g63-sa@carrefour.test"}',true);
  v_car_no := public.portal_siparis_ver(
    v_car_n, jsonb_build_array(jsonb_build_object('kalem_id',v_k1,'miktar',5,'birim','koli')));

  perform set_config('request.jwt.claims','{"email":"g63-merkez@migros.test"}',true);
  begin
    perform public.portal_siparis_guncelle(
      v_car_no, jsonb_build_array(jsonb_build_object('kalem_id',v_k1,'miktar',999,'birim','koli')));
    v_kalan := v_kalan + 1; raise notice '❌ 6 · BAŞKA MÜŞTERİNİN SİPARİŞİ DEĞİŞTİ';
  exception when sqlstate 'MI431' then v_gecen := v_gecen + 1;
  end;

  -- ── 7 · İZİNSİZ NOKTA: şube kullanıcısı Kadıköy siparişine dokunamıyor ─
  perform set_config('request.jwt.claims','{"email":"g63-ata@migros.test"}',true);
  begin
    perform public.portal_siparis_guncelle(
      v_no, jsonb_build_array(jsonb_build_object('kalem_id',v_k1,'miktar',1,'birim','koli')));
    v_kalan := v_kalan + 1; raise notice '❌ 7 · izinsiz noktanın siparişi değişti';
  exception when sqlstate 'MI431' then v_gecen := v_gecen + 1;
  end;

  -- ── 8 · SÖZLEŞMESİZ ÜRÜN araya sokulamıyor ─────────────────────────────
  -- Migros'un pilav sözleşmesi yok; katalogda görmediği kimliği elle yazsa da.
  perform set_config('request.jwt.claims','{"email":"g63-merkez@migros.test"}',true);
  begin
    perform public.portal_siparis_guncelle(
      v_no, jsonb_build_array(jsonb_build_object('kalem_id',v_k2,'miktar',10,'birim','koli')));
    v_kalan := v_kalan + 1; raise notice '❌ 8 · sözleşmesiz ürün eklendi';
  exception when sqlstate 'MI431' then v_gecen := v_gecen + 1;
  end;

  -- ── 9 · BOŞ LİSTE iptal SAYILMIYOR ─────────────────────────────────────
  begin
    perform public.portal_siparis_guncelle(v_no, '[]'::jsonb);
    v_kalan := v_kalan + 1; raise notice '❌ 9 · boş liste kabul edildi';
  exception when sqlstate 'MI431' then v_gecen := v_gecen + 1;
  end;

  -- ── 10 · SEVK BAŞLAMIŞ SİPARİŞ: müşterinin anlayacağı dille RED ────────
  -- ⚠️ Sipariş GÜNCEL revizyonu için yeniden onaylanmadan ilerleyemiyor —
  -- bu göçün kapattığı deliğin kanıtı. Prova o yolu atlamıyor.
  insert into order_approval (tenant_id,order_id,revision_no,step_code,decision,decided_by)
    values (v_t,(select id from sales_order where order_no=v_no),
            (select current_revision from sales_order where order_no=v_no),
            'SATIS','Olumlu',v_u);
  update sales_order set status='Onaylandı'    where order_no=v_no;
  update sales_order set status='Hazırlanıyor' where order_no=v_no;
  update sales_order set status='Hazır'        where order_no=v_no;
  update sales_order set status='Kısmi Sevk'   where order_no=v_no;
  begin
    perform public.portal_siparis_guncelle(
      v_no, jsonb_build_array(jsonb_build_object('kalem_id',v_k1,'miktar',99,'birim','koli')));
    v_kalan := v_kalan + 1; raise notice '❌ 10 · sevk edilmiş sipariş değişti';
  exception when sqlstate 'MI433' then v_gecen := v_gecen + 1;
  end;

  -- ── 11 · HAZIR sipariş DEĞİŞTİRİLEBİLİYOR ──────────────────────────────
  -- Engellersek müşteri telefonu açar ve değişiklik sistem DIŞINDA olur.
  update sales_order set status='Sevk Edildi'  where order_no=v_no;
  update sales_order set status='Teslim Edildi' where order_no=v_no;

  perform set_config('request.jwt.claims','{"email":"g63-sa@carrefour.test"}',true);
  insert into order_approval (tenant_id,order_id,revision_no,step_code,decision,decided_by)
    values (v_t,(select id from sales_order where order_no=v_car_no),
            (select current_revision from sales_order where order_no=v_car_no),
            'SATIS','Olumlu',v_u);
  update sales_order set status='Onaylandı'     where order_no=v_car_no;
  update sales_order set status='Hazırlanıyor'  where order_no=v_car_no;
  update sales_order set status='Hazır'         where order_no=v_car_no;
  v_rev := public.portal_siparis_guncelle(
    v_car_no, jsonb_build_array(jsonb_build_object('kalem_id',v_k1,'miktar',7,'birim','koli')));
  if v_rev = 2
     and (select status from sales_order where order_no=v_car_no) = 'Onay Bekliyor'
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 11 · hazır sipariş güncellenemedi';
  end if;

  -- ── 12 · OLMAYAN NUMARA sızdırmıyor ────────────────────────────────────
  begin
    perform public.portal_siparis_guncelle(
      'SIP-9999-9999', jsonb_build_array(jsonb_build_object('kalem_id',v_k1,'miktar',1,'birim','koli')));
    v_kalan := v_kalan + 1; raise notice '❌ 12 · olmayan numara kabul edildi';
  exception when sqlstate 'MI431' then v_gecen := v_gecen + 1;
  end;

  -- ── 13 · DELİĞİN KAPANDIĞININ KANITI ──────────────────────────────────
  -- Müşteri güncelleyince ESKİ onay yeni miktara geçerli SAYILMAMALI.
  -- `current_revision` ilerlemeseydi bu blok sessizce geçerdi.
  perform set_config('request.jwt.claims','{"email":"g63-sa@carrefour.test"}',true);
  perform public.portal_siparis_guncelle(
    v_car_no, jsonb_build_array(jsonb_build_object('kalem_id',v_k1,'miktar',11,'birim','koli')));
  begin
    update sales_order set status='Onaylandı' where order_no=v_car_no;
    v_kalan := v_kalan + 1;
    raise notice '❌ 13 · ESKİ ONAY YENİ MİKTARA GEÇERLİ SAYILDI';
  exception when sqlstate 'MI429' then v_gecen := v_gecen + 1;
  end;

  raise notice '──────── 0063 provası: % geçti, % kaldı', v_gecen, v_kalan;
  if v_kalan > 0 then raise exception '0063 provası KALDI (% hata)', v_kalan; end if;
end $$;
rollback;
