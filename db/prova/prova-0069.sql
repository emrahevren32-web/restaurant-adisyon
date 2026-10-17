-- 0069 · dikkat siparişleri davranış provası.
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_b uuid; v_k uuid; v_m uuid; v_n uuid;
  v_s1 uuid; v_s2 uuid; v_s3 uuid; v_r uuid;
  r record; v_say int;
  v_gecen int := 0; v_kalan int := 0;
begin
  select id into v_t from tenant where code='MIYOP';
  select id into v_b from branch where tenant_id=v_t limit 1;
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'B69','b69','Çorba','kg') returning id into v_k;
  insert into customer (tenant_id,code,code_key,name) values (v_t,'B69','b69','Migros')
    returning id into v_m;
  insert into delivery_point (tenant_id,customer_id,code,code_key,name)
    values (v_t,v_m,'B69-1','b69-1','Şube') returning id into v_n;

  -- ── 1 · ONAY BEKLEYEN SİPARİŞ LİSTEDE, KAYNAĞIYLA ─────────────────────
  insert into sales_order (tenant_id,branch_id,customer_id,delivery_point_id,
      order_no,order_date,status)
    values (v_t,v_b,v_m,v_n,'SIP-B69-1',current_date,'Onay Bekliyor')
    returning id into v_s1;
  insert into sales_order_revision (tenant_id,order_id,revision_no,kind,source,reason)
    values (v_t,v_s1,1,'MIKTAR','Portal','Müşteri portaldan girdi')
    returning id into v_r;
  insert into sales_order_line (tenant_id,order_id,revision_id,line_no,
      stock_item_id,qty,uom_code)
    values (v_t,v_s1,v_r,1,v_k,100,'kg');

  select * into r from app.dikkat_siparisleri(v_b) where siparis_id = v_s1;
  if r.kaynak = 'Portal' and r.musteri_adi = 'Migros' and r.satir_sayisi = 1
  then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 1 · yanlış: % / % / %', r.kaynak, r.musteri_adi, r.satir_sayisi; end if;

  -- ── 2 · SON REVİZYON = EN BÜYÜK NUMARA ────────────────────────────────
  -- Telefonla açılıp portaldan güncellenen bir sipariş PORTAL görünmeli:
  -- kullanıcının bilmesi gereken, EN SON kimin dokunduğudur.
  insert into sales_order_revision (tenant_id,order_id,revision_no,kind,source,reason)
    values (v_t,v_s1,2,'MIKTAR','Portal','Müşteri miktarı düşürdü')
    returning id into v_r;
  insert into sales_order_line (tenant_id,order_id,revision_id,line_no,
      stock_item_id,qty,uom_code)
    values (v_t,v_s1,v_r,1,v_k,50,'kg');

  select * into r from app.dikkat_siparisleri(v_b) where siparis_id = v_s1;
  if r.revizyon_no = 2 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 2 · son revizyon yanlış: %', r.revizyon_no; end if;

  -- ── 3 · TELEFONLA GELEN DE LİSTEDE — ama kaynağı belli ───────────────
  -- Panelin işi portalı ayırmak, ötekini gizlemek değil.
  insert into sales_order (tenant_id,branch_id,customer_id,delivery_point_id,
      order_no,order_date,status)
    values (v_t,v_b,v_m,v_n,'SIP-B69-2',current_date,'Onay Bekliyor')
    returning id into v_s2;
  -- ⚠️ Zamanı YAZARKEN veriyoruz: defter EKLEMELİ, `created_at` sonradan
  -- güncellenemez (MI403). Kuralı atlamıyoruz, kurala uyuyoruz.
  insert into sales_order_revision (tenant_id,order_id,revision_no,kind,source,
      reason,created_at)
    values (v_t,v_s2,1,'MIKTAR','Telefon','Telefonla alındı',
            now() - interval '48 hours') returning id into v_r;
  insert into sales_order_line (tenant_id,order_id,revision_id,line_no,
      stock_item_id,qty,uom_code) values (v_t,v_s2,v_r,1,v_k,10,'kg');

  select kaynak into r.kaynak from app.dikkat_siparisleri(v_b) where siparis_id = v_s2;
  if r.kaynak = 'Telefon' then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 3 · telefon kaynağı yanlış: %', r.kaynak; end if;

  -- ── 4 · ONAY BEKLEMEYEN SİPARİŞ LİSTEDE YOK ──────────────────────────
  -- Panel "ne yapmam lazım" listesidir; kapanmış işi göstermez.
  --
  -- ⚠️ 'Onaylandı' durumu SERBEST ATANAMIYOR: 0053 onay zinciri kendi
  -- yazıyor. Provayı kuralın etrafından değil İÇİNDEN geçiriyoruz; filtreyi
  -- iptal durumuyla sınıyoruz, sonuç aynı şeyi kanıtlıyor.
  insert into sales_order (tenant_id,branch_id,customer_id,delivery_point_id,
      order_no,order_date)
    values (v_t,v_b,v_m,v_n,'SIP-B69-3',current_date)
    returning id into v_s3;
  insert into sales_order_revision (tenant_id,order_id,revision_no,kind,source,reason)
    values (v_t,v_s3,1,'MIKTAR','Portal','x') returning id into v_r;
  insert into sales_order_line (tenant_id,order_id,revision_id,line_no,
      stock_item_id,qty,uom_code) values (v_t,v_s3,v_r,1,v_k,5,'kg');
  update sales_order set status = 'İptal' where id = v_s3;

  select count(*) into v_say from app.dikkat_siparisleri(v_b) where siparis_id = v_s3;
  if v_say = 0 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 4 · onaylanmış sipariş listede'; end if;

  -- ── 5 · EN UZUN BEKLEYEN EN ÜSTTE ────────────────────────────────────
  if (select siparis_no from app.dikkat_siparisleri(v_b) limit 1) = 'SIP-B69-2'
  then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 5 · sıralama yanlış: %',
      (select siparis_no from app.dikkat_siparisleri(v_b) limit 1); end if;

  -- ── 6 · BEKLEME SÜRESİ REVİZYONDAN, SİPARİŞ AÇILIŞINDAN DEĞİL ────────
  -- Üç gün önce açılıp bu sabah güncellenen sipariş "3 gündür bekliyor"
  -- değildir; o rakam paneli yalancı çıkarır.
  select bekleme_saati into r.bekleme_saati from app.dikkat_siparisleri(v_b)
   where siparis_id = v_s2;
  if r.bekleme_saati between 47 and 49 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 6 · bekleme süresi yanlış: % (48 olmalı)', r.bekleme_saati; end if;

  -- ── 7 · BAŞKA ŞUBENİN SİPARİŞİ LİSTEDE YOK ──────────────────────────
  -- ⚠️ "Müşteri kartı silinmiş sipariş" diye bir durum YOK: `customer_id`
  -- NOT NULL ve müşteri kartı `on delete restrict`. Şema bunu zaten
  -- garantiliyor, test etmeye gerek kalmıyor. Yerine gerçek bir soruyu
  -- sınıyoruz: panel yalnız KENDİ şubesini görüyor mu.
  insert into branch (tenant_id,company_id,code,name,branch_type)
    select v_t, b.company_id, 'B69SB','İkinci Şube','sube'
      from branch b where b.id = v_b
    returning id into v_s3;

  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_s3,'B69X','b69x','Çorba','kg') returning id into v_k;
  insert into sales_order (tenant_id,branch_id,customer_id,delivery_point_id,
      order_no,order_date)
    values (v_t,v_s3,v_m,v_n,'SIP-B69-9',current_date) returning id into v_s1;
  insert into sales_order_revision (tenant_id,order_id,revision_no,kind,source,reason)
    values (v_t,v_s1,1,'MIKTAR','Portal','x') returning id into v_r;
  insert into sales_order_line (tenant_id,order_id,revision_id,line_no,
      stock_item_id,qty,uom_code) values (v_t,v_s1,v_r,1,v_k,1,'kg');

  select count(*) into v_say from app.dikkat_siparisleri(v_b)
   where siparis_no = 'SIP-B69-9';
  if v_say = 0 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 7 · başka şubenin siparişi listede'; end if;

  raise notice '──────────── 0069 PROVA: % geçti, % kaldı ────────────', v_gecen, v_kalan;
  if v_kalan > 0 then raise exception '0069 provası düştü'; end if;
end;
$$;
rollback;
