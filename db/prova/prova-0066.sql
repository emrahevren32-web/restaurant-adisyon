-- 0066 · sevk anında plaka dondurma davranış provası.
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_b uuid; v_k uuid; v_arac uuid; v_sofor uuid;
  v_taslak uuid; v_sevk uuid; v_m uuid; v_n uuid;
  p text; a text; s text;
  v_gecen int := 0; v_kalan int := 0;
begin
  select id into v_t from tenant where code='MIYOP';
  select id into v_b from branch where tenant_id=v_t limit 1;
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'P66','p66','Çorba','kg') returning id into v_k;
  insert into vehicle (tenant_id,plate,plate_key,name)
    values (v_t,'34 ABC 123','34ABC123','Frigo 1') returning id into v_arac;
  insert into driver (tenant_id,full_name,phone)
    values (v_t,'Ahmet Yılmaz','0532 000 00 00') returning id into v_sofor;

  -- ⚠️ Sevkiyat müşteri KARTINA bağlı olmak zorunda (0049): elle yazılan
  -- isim aynı müşteriyi ikiye böler ve geri çağırmada hiçbiri toplanamaz.
  -- Provayı kuralın İÇİNDEN geçiriyoruz.
  insert into customer (tenant_id,code,code_key,name) values (v_t,'P66','p66','Migros')
    returning id into v_m;
  insert into delivery_point (tenant_id,customer_id,code,code_key,name)
    values (v_t,v_m,'P66-1','p66-1','Merkez') returning id into v_n;

  -- ── 1 · TASLAKTA DONMUYOR ──────────────────────────────────────────────
  -- Ortada henüz kesilmiş bir kâğıt yok; belge mal çıkınca doğar.
  insert into shipment (tenant_id,branch_id,shipment_no,customer_id,delivery_point_id,customer_name,
                        vehicle_id,driver_id,status)
    values (v_t,v_b,'SVK-P66-1',v_m,v_n,'Migros',v_arac,v_sofor,'DRAFT')
    returning id into v_taslak;

  select vehicle_plate_frozen into p from shipment where id=v_taslak;
  if p is null then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 1 · taslakta donmuş: %', p; end if;

  -- ── 2 · SEVK ANINDA DONUYOR ───────────────────────────────────────────
  update shipment set status='SHIPPED', shipped_on=current_date where id=v_taslak;

  select vehicle_plate_frozen, vehicle_name_frozen, driver_name_frozen
    into p, a, s from shipment where id=v_taslak;
  if p='34 ABC 123' and a='Frigo 1' and s='Ahmet Yılmaz' then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 2 · sevk anında donmadı: % / % / %', p, a, s; end if;

  -- ── 3 · KART DEĞİŞİNCE KESİLMİŞ BELGE DEĞİŞMİYOR ──────────────────────
  -- 0066'nın bütün sebebi bu: dün imzalatılan kâğıt bugün başka bir plaka
  -- basmamalı. Müşterideki kopya ile bizdeki tutmazsa, haklı çıkan kâğıdı
  -- elinde tutan taraf olur.
  update vehicle set plate='34 XYZ 999', plate_key='34XYZ999', name='Frigo 2'
   where id=v_arac;
  update driver set full_name='Mehmet Demir' where id=v_sofor;

  select vehicle_plate_frozen, driver_name_frozen into p, s
    from shipment where id=v_taslak;
  if p='34 ABC 123' and s='Ahmet Yılmaz' then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 3 · kart değişince belge değişti: % / %', p, s; end if;

  -- ── 4 · DONMUŞ ALAN ELLE DEĞİŞTİRİLEMİYOR (MI435) ────────────────────
  begin
    update shipment set vehicle_plate_frozen='06 AAA 111' where id=v_taslak;
    v_kalan := v_kalan+1; raise notice '❌ 4 · donmuş plaka değiştirildi';
  exception when sqlstate 'MI435' then v_gecen := v_gecen+1;
  end;

  begin
    update shipment set driver_name_frozen='Başkası' where id=v_taslak;
    v_kalan := v_kalan+1; raise notice '❌ 4b · donmuş şoför değiştirildi';
  exception when sqlstate 'MI435' then v_gecen := v_gecen+1;
  end;

  -- ── 5 · SEVK EDİLMİŞ SATIRIN BAŞKA ALANI GÜNCELLENEBİLİYOR ───────────
  -- Koruma, donmuş alanı korur; satırın tamamını kilitlemez. Not alanı
  -- kilitlenseydi "teslimde fark vardı" notu yazılamazdı.
  begin
    update shipment set note='Kapıda 10 dk bekledi' where id=v_taslak;
    v_gecen := v_gecen+1;
  exception when others then
    v_kalan := v_kalan+1; raise notice '❌ 5 · not yazılamadı: %', sqlerrm;
  end;

  select vehicle_plate_frozen into p from shipment where id=v_taslak;
  if p='34 ABC 123' then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 5b · not yazarken plaka bozuldu: %', p; end if;

  -- ── 6 · ARAÇSIZ SEVKİYATTA ALAN BOŞ KALIYOR ──────────────────────────
  -- Dışardan nakliyeci: plakayı bilmiyoruz. Uydurmuyoruz; kâğıtta elle
  -- doldurulacak satır olarak basılıyor.
  insert into shipment (tenant_id,branch_id,shipment_no,customer_id,delivery_point_id,customer_name,status,shipped_on)
    values (v_t,v_b,'SVK-P66-2',v_m,v_n,'Migros','SHIPPED',current_date)
    returning id into v_sevk;

  select vehicle_plate_frozen into p from shipment where id=v_sevk;
  if p is null then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 6 · araçsız sevkiyata plaka uyduruldu: %', p; end if;

  -- ── 7 · DOĞRUDAN SHIPPED AÇILAN SEVKİYATTA DA DONUYOR ────────────────
  insert into shipment (tenant_id,branch_id,shipment_no,customer_id,delivery_point_id,customer_name,
                        vehicle_id,status,shipped_on)
    values (v_t,v_b,'SVK-P66-3',v_m,v_n,'Migros',v_arac,'SHIPPED',current_date)
    returning id into v_sevk;

  select vehicle_plate_frozen into p from shipment where id=v_sevk;
  -- Kart bu arada değişmişti; YENİ plaka donmalı, çünkü bu belge BUGÜN doğdu.
  if p='34 XYZ 999' then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 7 · doğrudan sevk açılışında donmadı: %', p; end if;

  -- ── 8 · İPTAL EDİLEN SEVKİYATIN PLAKASI DA DURUYOR ───────────────────
  -- İptal, belgenin hiç olmadığı anlamına gelmez: kâğıt kesilmiş ve
  -- müşterinin elinde olabilir.
  update shipment set status='CANCELLED' where id=v_sevk;
  select vehicle_plate_frozen into p from shipment where id=v_sevk;
  if p='34 XYZ 999' then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 8 · iptalde plaka silindi: %', p; end if;

  raise notice '──────────── 0066 PROVA: % geçti, % kaldı ────────────', v_gecen, v_kalan;
  if v_kalan > 0 then raise exception '0066 provası düştü'; end if;
end;
$$;
rollback;
