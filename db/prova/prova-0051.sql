-- 0051 DAVRANIŞ PROVASI (yalnız yerel; göç DEĞİL)
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;

do $$
declare
  v_t uuid; v_b uuid; v_m uuid; v_n uuid; v_n2 uuid;
  v_k1 uuid; v_k2 uuid;
  v_sip uuid; v_rev uuid;
  v_sv1 uuid; v_sv2 uuid;
  v_durum text; v_kalan numeric; v_uy boolean; v_disi boolean;
begin
  select id into v_t from tenant where code = 'MIYOP';
  select id into v_b from branch where tenant_id = v_t limit 1;

  -- Kalemler
  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (v_t, v_b, 'P-CRB', 'p-crb', 'Mercimek çorbası 5 kg', 'koli') returning id into v_k1;
  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (v_t, v_b, 'P-PLV', 'p-plv', 'Pilav 5 kg', 'koli') returning id into v_k2;

  -- Müşteri kartı ve iki nokta
  insert into customer (tenant_id, code, code_key, name) values (v_t, 'MGR', 'mgr', 'Migros') returning id into v_m;
  insert into delivery_point (tenant_id, customer_id, code, code_key, name) values (v_t, v_m, 'ATA', 'ata', 'Ataşehir') returning id into v_n;
  insert into delivery_point (tenant_id, customer_id, code, code_key, name) values (v_t, v_m, 'KAD', 'kad', 'Kadıköy')  returning id into v_n2;

  -- Sipariş: 40 koli çorba + 25 koli pilav
  insert into sales_order (tenant_id, branch_id, order_no, customer_id, delivery_point_id, status)
    values (v_t, v_b, 'SIP-2026-0001', v_m, v_n, 'Taslak') returning id into v_sip;
  insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason)
    values (v_t, v_sip, 1, 'MIKTAR', 'Telefon', 'İlk kayıt') returning id into v_rev;
  insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
    values (v_t, v_sip, v_rev, 1, v_k1, 40, 'koli'),
           (v_t, v_sip, v_rev, 2, v_k2, 25, 'koli');

  raise notice '--- 1) Taslak siparişe sevkiyat bağlanamamalı';
  begin
    insert into shipment (tenant_id, branch_id, shipment_no, customer_name, customer_id, delivery_point_id, order_id)
      values (v_t, v_b, 'SVK-X', 'Migros', v_m, v_n, v_sip);
    raise exception 'BAŞARISIZ: taslak siparişe sevkiyat bağlandı.';
  exception when sqlstate 'MI427' then raise notice '   ✅ MI427: %', sqlerrm;
  end;

  -- Siparişi Hazır'a getir
  -- !! 0061 ARAYA BİR DURAK KOYDU: Taslak artık doğrudan Onaylandı'ya
  -- geçmiyor, önce 'Onay Bekliyor' oluyor. Bu prova 0061'den ÖNCE yazıldığı
  -- için doğrudan geçiyordu ve o gün doğruydu. Kural değişti, ölçüm değişti.
  update sales_order set status = 'Onay Bekliyor' where id = v_sip;
  -- !! 0061 AYNI ZAMANDA ONAY ADIMI ZORUNLU KILDI: zorunlu adımın olumlu
  -- kararı yoksa `Onaylandı` MI429 ile reddediliyor. Onay burada VERİLİYOR,
  -- kapı gevşetilmiyor: gevşetmek, korunan şeyi ölçmeyi bırakmak olurdu.
  insert into order_approval (tenant_id, order_id, revision_no, step_code, decision)
    select v_t, v_sip, so.current_revision, s.code, 'Olumlu'
      from sales_order so
      join order_approval_step s
        on s.tenant_id = v_t and s.is_active and s.required
     where so.id = v_sip;
  update sales_order set status = 'Onaylandı'    where id = v_sip;
  update sales_order set status = 'Hazırlanıyor' where id = v_sip;

  raise notice '--- 2) Hazır olmayan siparişin sevkiyatı SHIPPED olamamalı';
  insert into shipment (tenant_id, branch_id, shipment_no, customer_name, customer_id, delivery_point_id, order_id)
    values (v_t, v_b, 'SVK-2026-0001', 'Migros', v_m, v_n, v_sip) returning id into v_sv1;
  insert into shipment_line (tenant_id, shipment_id, line_no, stock_item_id, qty, uom)
    values (v_t, v_sv1, 1, v_k1, 15, 'koli');
  begin
    update shipment set status = 'SHIPPED' where id = v_sv1;
    raise exception 'BAŞARISIZ: Hazırlanıyor durumundaki sipariş sevk edildi.';
  exception when sqlstate 'MI428' then raise notice '   ✅ MI428: %', sqlerrm;
  end;

  update sales_order set status = 'Hazır' where id = v_sip;

  raise notice '--- 3) Başka müşterinin noktası reddedilmeli';
  begin
    update shipment set delivery_point_id = v_n2 where id = v_sv1;
    raise exception 'BAŞARISIZ: siparişin noktası olmayan nokta kabul edildi.';
  exception when sqlstate 'MI426' then raise notice '   ✅ MI426: %', sqlerrm;
  end;

  raise notice '--- 4) Kısmi sevk: 15/40 çorba gitti';
  update shipment set status = 'SHIPPED' where id = v_sv1;
  select status into v_durum from sales_order where id = v_sip;
  if v_durum <> 'Kısmi Sevk' then raise exception 'BAŞARISIZ: durum % (Kısmi Sevk bekleniyordu).', v_durum; end if;
  raise notice '   ✅ sipariş durumu kendiliğinden: %', v_durum;

  select kalan into v_kalan from app.siparis_sevk_durumu(v_sip) where kalem_id = v_k1;
  if v_kalan <> 25 then raise exception 'BAŞARISIZ: çorba kalan % (25 bekleniyordu).', v_kalan; end if;
  select kalan into v_kalan from app.siparis_sevk_durumu(v_sip) where kalem_id = v_k2;
  if v_kalan <> 25 then raise exception 'BAŞARISIZ: pilav kalan % (25 bekleniyordu).', v_kalan; end if;
  raise notice '   ✅ kalan doğru: çorba 25, pilav 25';

  raise notice '--- 5) Kalanı sevk et → Sevk Edildi';
  insert into shipment (tenant_id, branch_id, shipment_no, customer_name, customer_id, delivery_point_id, order_id)
    values (v_t, v_b, 'SVK-2026-0002', 'Migros', v_m, v_n, v_sip) returning id into v_sv2;
  insert into shipment_line (tenant_id, shipment_id, line_no, stock_item_id, qty, uom)
    values (v_t, v_sv2, 1, v_k1, 25, 'koli'),
           (v_t, v_sv2, 2, v_k2, 25, 'koli');
  update shipment set status = 'SHIPPED' where id = v_sv2;
  select status into v_durum from sales_order where id = v_sip;
  if v_durum <> 'Sevk Edildi' then raise exception 'BAŞARISIZ: durum % (Sevk Edildi bekleniyordu).', v_durum; end if;
  raise notice '   ✅ sipariş durumu: %', v_durum;

  raise notice '--- 6) DRAFT sevkiyat sayılmamalı';
  -- Hazırlanan ama HENÜZ YOLA ÇIKMAMIŞ bir sevkiyat, sevk edilmiş sayılamaz.
  declare v_draft uuid;
  begin
    insert into shipment (tenant_id, branch_id, shipment_no, customer_name, customer_id, delivery_point_id, order_id)
      values (v_t, v_b, 'SVK-2026-0003', 'Migros', v_m, v_n, v_sip) returning id into v_draft;
    insert into shipment_line (tenant_id, shipment_id, line_no, stock_item_id, qty, uom)
      values (v_t, v_draft, 1, v_k1, 99, 'koli');
  end;
  select sevk_miktar into v_kalan from app.siparis_sevk_durumu(v_sip) where kalem_id = v_k1;
  if v_kalan <> 40 then raise exception 'BAŞARISIZ: sevk toplamı % (40 bekleniyordu; DRAFT sayılmış olabilir).', v_kalan; end if;
  raise notice '   ✅ DRAFT 99 koli sayılmadı, sevk toplamı 40';

  raise notice '--- 7) Birim uyuşmazlığı: kalan NULL olmalı, sayı UYDURULMAMALI';
  insert into shipment_line (tenant_id, shipment_id, line_no, stock_item_id, qty, uom)
    values (v_t, v_sv2, 3, v_k1, 3, 'kg');
  select kalan, birim_uyusmuyor into v_kalan, v_uy
    from app.siparis_sevk_durumu(v_sip) where kalem_id = v_k1;
  if v_kalan is not null or v_uy is not true then
    raise exception 'BAŞARISIZ: birim uyuşmazlığında kalan=% uyusmuyor=%', v_kalan, v_uy;
  end if;
  raise notice '   ✅ kalan NULL, birim_uyusmuyor doğru';

  raise notice '--- 8) Siparişte olmayan kalem gönderilirse GÖRÜNMELİ';
  insert into shipment_line (tenant_id, shipment_id, line_no, stock_item_id, qty, uom)
    values (v_t, v_sv2, 4, (select id from stock_item where code='P-PLV'), 1, 'koli');
  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (v_t, v_b, 'P-EKS', 'p-eks', 'Ekstra ürün', 'koli');
  insert into shipment_line (tenant_id, shipment_id, line_no, stock_item_id, qty, uom)
    values (v_t, v_sv2, 5, (select id from stock_item where code='P-EKS'), 2, 'koli');
  select siparis_disi into v_disi from app.siparis_sevk_durumu(v_sip)
   where kalem_id = (select id from stock_item where code='P-EKS');
  if v_disi is not true then raise exception 'BAŞARISIZ: sipariş dışı kalem görünmedi.'; end if;
  raise notice '   ✅ sipariş dışı kalem raporda görünüyor';

  raise notice '════ 0051 PROVASI TAMAM ════';
end $$;
rollback;
