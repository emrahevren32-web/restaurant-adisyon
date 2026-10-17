-- 0062 · sevk durumunda ürün adı — davranış provası.
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_c uuid; v_b uuid; v_m uuid;
  v_corba uuid; v_pilav uuid; v_pasif uuid;
  v_sip uuid; v_rev uuid; v_sevk uuid; v_u uuid;
  r record; v_gecen int := 0; v_kalan int := 0;
begin
  insert into tenant (code,name) values ('P62','Prova 62') returning id into v_t;
  insert into company (tenant_id,company_code,company_name)
    values (v_t,'P62','Prova 62 A.Ş.') returning id into v_c;
  insert into branch (tenant_id,company_id,code,name,branch_type,is_head_office)
    values (v_t,v_c,'MRK','Merkez','merkez',true) returning id into v_b;
  insert into customer (tenant_id,code,code_key,name) values (v_t,'MGR62','mgr62','Migros')
    returning id into v_m;

  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'Q62-CRB','q62-crb','Mercimek Çorbası','koli') returning id into v_corba;
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'Q62-PLV','q62-plv','Pirinç Pilavı','koli') returning id into v_pilav;
  -- ⚠️ PASİF kalem: ekranın elindeki katalog bunu süzüyor. Adı tarayıcıda
  -- arasaydık bu satır yine uuid görünürdü — göçün asıl sebebi bu.
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom,is_active)
    values (v_t,v_b,'Q62-ESK','q62-esk','Eski Ürün (pasif)','koli',false)
    returning id into v_pasif;

  insert into sales_order (tenant_id,branch_id,order_no,customer_id)
    values (v_t,v_b,'SIP-Q62-1',v_m) returning id into v_sip;
  insert into sales_order_revision (tenant_id,order_id,revision_no,kind,source,reason)
    values (v_t,v_sip,1,'MIKTAR','Telefon','İlk') returning id into v_rev;
  insert into sales_order_line (tenant_id,order_id,revision_id,line_no,stock_item_id,qty,uom_code)
    values (v_t,v_sip,v_rev,1,v_corba,40,'koli'),
           (v_t,v_sip,v_rev,2,v_pilav,25,'koli');

  -- ⚠️ Sipariş 0053'teki onay zincirinden GEÇMEDEN "Hazır" olamaz ve
  -- "Hazır" olmadan sevkiyat bağlanamaz. Prova bu yolu ATLAMIYOR, çünkü
  -- gerçek hayatta da atlanamıyor.
  insert into app_user (tenant_id,username,username_key,full_name,role_code)
    values (v_t,'p62','p62','Prova 62','isletme_sahibi') returning id into v_u;
  insert into order_approval (tenant_id,order_id,revision_no,step_code,decision,decided_by)
    values (v_t,v_sip,1,'SATIS','Olumlu',v_u);
  update sales_order set status='Onay Bekliyor' where id=v_sip;
  update sales_order set status='Onaylandı'    where id=v_sip;
  update sales_order set status='Hazırlanıyor' where id=v_sip;
  update sales_order set status='Hazır'        where id=v_sip;

  -- Sevkiyat: çorbadan 10 koli gitti + SİPARİŞTE OLMAYAN pasif kalemden 3 koli.
  insert into shipment (tenant_id,branch_id,shipment_no,customer_name,customer_id,
                        order_id,status,shipped_on)
    values (v_t,v_b,'SHP-Q62-1','Migros',v_m,v_sip,'SHIPPED',current_date)
    returning id into v_sevk;
  insert into shipment_line (tenant_id,shipment_id,line_no,stock_item_id,qty,uom)
    values (v_t,v_sevk,1,v_corba,10,'koli'),
           (v_t,v_sevk,2,v_pasif,3,'koli');

  -- ── 1 · Sipariş kalemleri ADIYLA dönüyor ───────────────────────────────
  select * into r from public.siparis_sevk_durumu(v_sip) where kalem_id = v_corba;
  if r.kalem_adi = 'Mercimek Çorbası' and r.siparis_miktar = 40 and r.sevk_miktar = 10
     and r.kalan = 30
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1;
    raise notice '❌ 1 · çorba satırı: ad=% kalan=%', r.kalem_adi, r.kalan;
  end if;

  -- ── 2 · Hiç sevk edilmemiş kalem de adıyla dönüyor ─────────────────────
  select * into r from public.siparis_sevk_durumu(v_sip) where kalem_id = v_pilav;
  if r.kalem_adi = 'Pirinç Pilavı' and r.sevk_miktar = 0 and r.kalan = 25
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 2 · pilav satırı: ad=%', r.kalem_adi;
  end if;

  -- ── 3 · SİPARİŞ DIŞI ve PASİF kalem de ADIYLA dönüyor ──────────────────
  -- Göçün asıl sebebi: ekranın katalogu pasif kalemleri süzüyor.
  select * into r from public.siparis_sevk_durumu(v_sip) where kalem_id = v_pasif;
  if r.kalem_adi = 'Eski Ürün (pasif)' and r.siparis_disi
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1;
    raise notice '❌ 3 · sipariş dışı pasif kalem: ad=% disi=%', r.kalem_adi, r.siparis_disi;
  end if;

  -- ── 4 · Satır sayısı değişmedi (left join kimseyi düşürmedi) ───────────
  if (select count(*) from public.siparis_sevk_durumu(v_sip)) = 3
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1;
    raise notice '❌ 4 · satır sayısı %', (select count(*) from public.siparis_sevk_durumu(v_sip));
  end if;

  -- ── 5 · Teslim farkı da ad veriyor (kardeş fonksiyon bozulmadı) ────────
  if exists (select 1 from public.siparis_teslim_farki(v_sip)
              where kalem_adi = 'Mercimek Çorbası')
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 5 · teslim farkı ad vermiyor';
  end if;

  raise notice '──────── 0062 provası: % geçti, % kaldı', v_gecen, v_kalan;
  if v_kalan > 0 then raise exception '0062 provası KALDI (% hata)', v_kalan; end if;
end $$;
rollback;
