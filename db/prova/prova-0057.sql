\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_b uuid;
  v_un uuid; v_sut uuid; v_su uuid; v_tuz uuid;
  v_sos uuid; v_corba uuid;
  v_r_sos uuid; v_r_corba uuid;
  v_say int; r record;
begin
  select id into v_t from tenant where code='ABC';
  select id into v_b from branch where tenant_id=v_t limit 1;

  -- Malzemeler
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'M-UN','m-un','Buğday unu','kg') returning id into v_un;
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'M-SUT','m-sut','Süt tozu','kg') returning id into v_sut;
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'M-SU','m-su','Su','lt') returning id into v_su;
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'M-TUZ','m-tuz','Tuz','kg') returning id into v_tuz;
  -- Yarı mamul ve mamul
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom,net_qty,net_uom)
    values (v_t,v_b,'Y-SOS','y-sos','Beyaz sos','kg',1,'kg') returning id into v_sos;
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom,net_qty,net_uom)
    values (v_t,v_b,'P-CRB','p-crb','Mercimek çorbası 5 kg','koli',5,'kg') returning id into v_corba;

  -- Alerjen beyanı: un GLUTEN, süt tozu SÜT. Su ve tuz incelendi, alerjensiz.
  insert into stock_item_allergen (tenant_id,stock_item_id,allergen_code)
    values (v_t,v_un,'GLUTEN'), (v_t,v_sut,'SUT');
  update stock_item set allergen_reviewed_at = now()
   where id in (v_un, v_sut, v_su, v_tuz);

  -- Besin değerleri (100 g)
  insert into stock_item_nutrition (stock_item_id,tenant_id,energy_kj,energy_kcal,fat,saturated_fat,carbohydrate,sugars,protein,salt,source)
    values (v_un, v_t,1450,342,1.0,0.2,72.0,0.4,10.0,0.01,'Tedarikçi spesifikasyonu'),
           (v_sut,v_t,1500,358,1.0,0.6,52.0,52.0,35.0,1.20,'Tedarikçi spesifikasyonu'),
           (v_su, v_t,0,0,0,0,0,0,0,0,'Tanım gereği'),
           (v_tuz,v_t,0,0,0,0,0,0,0,99.0,'Tanım gereği');

  -- Reçeteler: SOS = 0,1 kg un + 0,2 kg süt tozu + 0,7 kg su → 1 kg
  insert into recipe (tenant_id,code,code_key,name,output_item_id,output_qty,output_uom,status)
    values (v_t,'R-SOS','r-sos','Beyaz sos',v_sos,1,'kg','ACTIVE') returning id into v_r_sos;
  insert into recipe_line (tenant_id,recipe_id,line_no,stock_item_id,qty,uom)
    values (v_t,v_r_sos,1,v_un,0.1,'kg'),
           (v_t,v_r_sos,2,v_sut,0.2,'kg'),
           (v_t,v_r_sos,3,v_su,0.7,'kg');

  -- ÇORBA = 1 kg sos + 4 kg su → 1 koli (5 kg)
  insert into recipe (tenant_id,code,code_key,name,output_item_id,output_qty,output_uom,status)
    values (v_t,'R-CRB','r-crb','Mercimek çorbası',v_corba,1,'koli','ACTIVE') returning id into v_r_corba;
  insert into recipe_line (tenant_id,recipe_id,line_no,stock_item_id,qty,uom)
    values (v_t,v_r_corba,1,v_sos,1,'kg'),
           (v_t,v_r_corba,2,v_su,4,'kg');

  raise notice '--- 1) Alerjen İKİ SEVİYE derinden türetilmeli';
  -- Çorba → sos → un(GLUTEN) + süt tozu(SUT). Tek seviye bakan bir sorgu
  -- bunların İKİSİNİ DE kaçırırdı.
  select count(*) into v_say from app.mamul_alerjenleri(v_corba);
  if v_say <> 2 then raise exception 'BAŞARISIZ: % alerjen (2 bekleniyordu).', v_say; end if;
  for r in select * from app.mamul_alerjenleri(v_corba) loop
    raise notice '   % (%) · kaynak: %', r.ad, r.tur, array_to_string(r.kaynaklar,', ');
  end loop;
  raise notice '   ✅ gluten ve süt, sosun içinden bulundu';

  raise notice '--- 2) "İÇERİR" her zaman "İZ"i YENMELİ';
  insert into stock_item_allergen (tenant_id,stock_item_id,allergen_code,kind)
    values (v_t,v_su,'GLUTEN','İZ');
  select tur into r from app.mamul_alerjenleri(v_corba) where kod='GLUTEN';
  if r.tur <> 'İÇERİR' then
    raise exception 'BAŞARISIZ: gluten % oldu — gerçek risk küçük gösterildi.', r.tur;
  end if;
  raise notice '   ✅ İÇERİR korundu';

  raise notice '--- 3) İNCELENMEMİŞ malzeme ayrıca söylenmeli';
  -- "Alerjen yok" ile "bakılmamış" aynı şey değildir.
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'M-BAH','m-bah','Baharat karışımı','kg');
  insert into recipe_line (tenant_id,recipe_id,line_no,stock_item_id,qty,uom)
    select v_t,v_r_corba,3,id,0.05,'kg' from stock_item where code_key='m-bah';
  select count(*) into v_say from app.mamul_alerjen_eksikleri(v_corba);
  if v_say <> 1 then raise exception 'BAŞARISIZ: % incelenmemiş (1 bekleniyordu).', v_say; end if;
  raise notice '   ✅ "Baharat karışımı" incelenmemiş diye raporlanıyor';

  raise notice '--- 4) BESİN DEĞERİ eksik veriyle HESAPLANMAMALI';
  -- Baharatın besin değeri yok. Hiç sayı dönmemeli.
  select count(*) into v_say from app.mamul_besin_degeri(v_corba);
  if v_say <> 0 then
    raise exception 'BAŞARISIZ: eksik veriyle besin değeri hesaplandı — ETİKETTE YANLIŞ BEYAN.';
  end if;
  select count(*) into v_say from app.mamul_besin_eksikleri(v_corba);
  if v_say < 1 then raise exception 'BAŞARISIZ: eksikler raporlanmadı.'; end if;
  for r in select * from app.mamul_besin_eksikleri(v_corba) loop
    raise notice '   eksik: % → %', r.kalem_adi, r.sebep;
  end loop;
  raise notice '   ✅ sayı yok, eksiğin listesi var';

  raise notice '--- 5) Eksik TAMAMLANINCA hesap yapılmalı';
  insert into stock_item_nutrition (stock_item_id,tenant_id,energy_kj,energy_kcal,fat,saturated_fat,carbohydrate,sugars,protein,salt,source)
    select id,v_t,0,0,0,0,0,0,0,0,'Deneme' from stock_item where code_key='m-bah';
  select * into r from app.mamul_besin_degeri(v_corba);
  if r.energy_kcal is null then raise exception 'BAŞARISIZ: hâlâ hesaplanmıyor.'; end if;
  raise notice '   ✅ 100 g çorba: % kcal · yağ % · protein % · tuz %',
    r.energy_kcal, r.fat, r.protein, r.salt;

  raise notice '--- 6) HESAP ELLE DOĞRULANMALI';
  -- Sos 1 kg (1000 g) = 100 g un + 200 g süt tozu + 700 g su
  --   protein = 10*1,0 + 35*2,0 + 0 = 80 g → sos 100 g'da 8,0 g protein
  -- Çorba 1 koli (5000 g) = 1000 g sos + 4000 g su + 50 g baharat
  --   protein = 8,0*10 = 80 g → çorba 100 g'da 1,6 g protein
  select * into r from app.mamul_besin_degeri(v_sos);
  if r.protein <> 8.000 then
    raise exception 'BAŞARISIZ: sos proteini % (8,000 bekleniyordu).', r.protein;
  end if;
  select * into r from app.mamul_besin_degeri(v_corba);
  if r.protein <> 1.600 then
    raise exception 'BAŞARISIZ: çorba proteini % (1,600 bekleniyordu).', r.protein;
  end if;
  raise notice '   ✅ sos 8,000 g · çorba 1,600 g protein — iki seviye doğru';

  raise notice '--- 7) YARI MAMULÜN KENDİ besin değeri YAZILMIŞSA o geçerli';
  -- Tedarikçi analiz raporu varken hesap yapmak, raporu yok saymak olurdu.
  insert into stock_item_nutrition (stock_item_id,tenant_id,protein,source)
    values (v_sos, v_t, 99.0, 'Analiz raporu');
  select * into r from app.mamul_besin_degeri(v_sos);
  if r.protein <> 99.000 then
    raise exception 'BAŞARISIZ: yazılı değer yerine hesap kullanıldı (%).', r.protein;
  end if;
  raise notice '   ✅ kartta yazılı değer hesabı yendi';

  raise notice '════ 0057 PROVASI TAMAM ════';
end $$;
rollback;
