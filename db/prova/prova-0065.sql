-- 0065 · işletme göstergeleri davranış provası.
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
-- ═══════════════════════════════════════════════════════════════════════
-- !! GÖSTERGE OKUMALARI `authenticated` ROLÜ TAKILARAK YAPILIYOR (MIYOP-042).
-- JWT koymak YETMEZ: rolü takmayan bir prova kapının DIŞINDA, süper
-- kullanıcı olarak koşar ve her yazım sessizce geçer — prova yeşil
-- görünür, hiçbir şey ölçmez. prova-0081/0082 tam böyle körleşmişti.
-- Kurulum yazımları süper kullanıcı olarak kalıyor (sahne kurmak ölçüm
-- değildir); ÖLÇÜLEN okuma rolün içinde yapılıyor.
-- ⚠️ `reset role` hata yolunda da çalışıyor: yarıda kalan bir rol,
-- provanın geri kalanını sessizce başka bir kimlikle ölçerdi.
-- ═══════════════════════════════════════════════════════════════════════
create or replace function prova_gosterge(p_sube uuid, p_bas date, p_bit date)
returns table (anahtar text, deger numeric, ek numeric)
language plpgsql as $prova$
begin
  execute 'set local role authenticated';
  begin
    return query select * from app.isletme_gostergeleri(p_sube, p_bas, p_bit);
  exception when others then
    execute 'reset role';
    raise;
  end;
  execute 'reset role';
end; $prova$;

create or replace function prova_fire(p_sube uuid, p_bas date, p_bit date)
returns table (neden text, kalem_id uuid, kalem_adi text, miktar numeric,
               birim text, tutar numeric, fiyatsiz boolean)
language plpgsql as $prova$
begin
  execute 'set local role authenticated';
  begin
    return query select * from app.fire_dokumu(p_sube, p_bas, p_bit);
  exception when others then
    execute 'reset role';
    raise;
  end;
  execute 'reset role';
end; $prova$;

do $$
declare
  v_t uuid; v_b uuid; v_auth uuid := gen_random_uuid(); v_k uuid; v_k2 uuid; v_kritik uuid;
  v_lot_eski uuid; v_lot_biten uuid; v_lot_yakin uuid; v_lot_temel uuid;
  v_hareket uuid; v_m uuid; v_n uuid; v_s uuid;
  v_bas date := current_date - 30; v_bit date := current_date;
  d numeric; e numeric;
  v_gecen int := 0; v_kalan int := 0;

begin
  select id into v_t from tenant where code='MIYOP';
  select id into v_b from branch where tenant_id=v_t limit 1;

  -- !! 0071 BU RAPORLARIN ÖNÜNE `finance.read` KAPISI KOYDU. Bu prova
  -- 0071'den ÖNCE yazıldı ve oturumsuz çağırıyordu; o gün doğruydu.
  -- Kapı GEVŞETİLMİYOR, prova yetkili bir kullanıcıyla ölçüyor — `_ham`
  -- fonksiyonu çağırmak kapıyı atlamak, yani gerçek yolu ölçmemek olurdu.
  insert into app_user (tenant_id, auth_user_id, username, username_key,
                        full_name, role_code, is_active)
    values (v_t, v_auth, 'prv65.patron', 'prv65.patron', 'Prova Patron', 'isletme_sahibi', true);
  perform set_config('request.jwt.claim.sub', v_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_auth, 'tenant_id', v_t)::text, false);
  perform set_config('app.tenant_id', v_t::text, false);

  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom,tracks_lot,tracks_expiry)
    values (v_t,v_b,'G65-UN','g65-un','Un',          'kg',true,true) returning id into v_k;
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'G65-YAG','g65-yag','Ayçiçek Yağı','lt')        returning id into v_k2;
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom,min_qty)
    values (v_t,v_b,'G65-TUZ','g65-tuz','Tuz','kg',100)             returning id into v_kritik;

  -- ⚠️ Un LOT TAKİPLİ: defter her hareketi bir partiye bağlamayı ZORUNLU
  -- tutuyor (0003). Provayı kuralın ETRAFINDAN değil, İÇİNDEN geçiriyoruz —
  -- kuralı atlayan bir prova, kuralın kalkmadığını kanıtlamaz.
  insert into stock_lot (tenant_id,branch_id,stock_item_id,lot_code,lot_code_key,origin_type)
    values (v_t,v_b,v_k,'L-TEMEL','l-temel','RECEIPT') returning id into v_lot_temel;

  -- ── 1 · FİRE, O ANKİ FİYATLA DEĞERLENİR — bugünküyle değil ─────────────
  -- 20 gün önce 10 TL'den alındı, 15 gün önce 5 kg fire verildi,
  -- 2 gün önce fiyat 100 TL'ye fırladı. Fire 50 TL olmalı, 500 değil.
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,unit_cost,idempotency_key,occurred_at)
    values (v_t,v_b,v_k,v_lot_temel,100,100,'kg','PURCHASE_RECEIPT','goods_receipt',10,'g65-a1',
            now()-interval '20 days');
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,note,idempotency_key,occurred_at)
    values (v_t,v_b,v_k,v_lot_temel,-5,-5,'kg','WASTE','manual','Küflendi','g65-f1',
            now()-interval '15 days');
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,unit_cost,idempotency_key,occurred_at)
    values (v_t,v_b,v_k,v_lot_temel,50,50,'kg','PURCHASE_RECEIPT','goods_receipt',100,'g65-a2',
            now()-interval '2 days');

  select deger into d from prova_gosterge(v_b,v_bas,v_bit) where anahtar='fire_tutari';
  if d = 50 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 1 · fire bugünkü fiyatla değerlenmiş: % (50 olmalı)', d; end if;

  -- ── 2 · SAYIMDA EKSİK ÇIKAN MAL DA FİREDİR ─────────────────────────────
  -- Saymasaydık "bizde fire yok" diyen bir rapor çıkar, asıl kayıp görünmezdi.
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,note,idempotency_key,occurred_at)
    values (v_t,v_b,v_k,v_lot_temel,-2,-2,'kg','COUNT_SHORTAGE','stock_count','Sayım farkı','g65-f2',
            now()-interval '10 days');

  select deger into d from prova_gosterge(v_b,v_bas,v_bit) where anahtar='fire_tutari';
  if d = 70 then v_gecen := v_gecen+1;   -- 5 kg + 2 kg, hepsi 10 TL
  else v_kalan := v_kalan+1;
    raise notice '❌ 2 · sayım eksiği fireye girmedi: % (70 olmalı)', d; end if;

  -- ── 3 · İPTAL EDİLEN FİRE SAYILMAZ ─────────────────────────────────────
  -- Olmamış bir fire, raporda da olmamalı.
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,note,idempotency_key,occurred_at)
    values (v_t,v_b,v_k,v_lot_temel,-9,-9,'kg','WASTE','manual','Yanlış girildi','g65-f3',
            now()-interval '8 days')
    returning id into v_hareket;
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,reverses_movement_id,
      idempotency_key,occurred_at)
    values (v_t,v_b,v_k,v_lot_temel,9,9,'kg','REVERSAL','manual',v_hareket,'g65-f3r',
            now()-interval '8 days');

  select deger into d from prova_gosterge(v_b,v_bas,v_bit) where anahtar='fire_tutari';
  if d = 70 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 3 · iptal edilen fire sayıldı: % (70 olmalı)', d; end if;

  -- ── 4 · FİYATI BİLİNMEYEN FİRE SAYILIYOR VE SÖYLENİYOR ────────────────
  -- Hiç alış fiyatı olmayan bir kalemin firesi değerlenemez. Sessizce düşük
  -- bir rakam göstermek, hiç göstermemekten kötüdür.
  -- ⚠️ AÇILIŞ BAKİYESİ fiyatsızdır: devreye girerken sayılan mal. Gerçek
  -- hayatta fiyatı bilinmeyen fire tam olarak böyle doğar.
  insert into stock_movement (tenant_id,branch_id,stock_item_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,idempotency_key,occurred_at)
    values (v_t,v_b,v_k2,10,10,'lt','OPENING_BALANCE','opening','g65-ac1',
            now()-interval '25 days');
  insert into stock_movement (tenant_id,branch_id,stock_item_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,note,idempotency_key,occurred_at)
    values (v_t,v_b,v_k2,-3,-3,'lt','WASTE','manual','Döküldü','g65-f4',
            now()-interval '5 days');

  select deger into d from prova_gosterge(v_b,v_bas,v_bit)
   where anahtar='fire_fiyatsiz_hareket';
  if d = 1 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 4 · fiyatsız fire bildirilmedi: % (1 olmalı)', d; end if;

  select deger into d from prova_gosterge(v_b,v_bas,v_bit) where anahtar='fire_tutari';
  if d = 70 then v_gecen := v_gecen+1;   -- fiyatsız olan tutara EKLENMEDİ
  else v_kalan := v_kalan+1;
    raise notice '❌ 4b · fiyatsız hareket tutara karıştı: % (70 olmalı)', d; end if;

  -- ── 5 · TÜKENMİŞ PARTİ RİSK DEĞİLDİR ───────────────────────────────────
  -- SKT'si geçmiş ama elde kalmamış bir parti kimseyi zehirlemez.
  insert into stock_lot (tenant_id,branch_id,stock_item_id,lot_code,lot_code_key,
                         expires_on,origin_type)
    values (v_t,v_b,v_k,'L-BITEN','l-biten',current_date+30,'RECEIPT')
    returning id into v_lot_biten;
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,unit_cost,idempotency_key,occurred_at)
    values (v_t,v_b,v_k,v_lot_biten,20,20,'kg','PURCHASE_RECEIPT','goods_receipt',10,
            'g65-lb1',now()-interval '12 days');
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,idempotency_key,occurred_at)
    values (v_t,v_b,v_k,v_lot_biten,-20,-20,'kg','SHIPMENT_OUT','shipment',
            'g65-lb2',now()-interval '11 days');
  -- !! 0092 SKT KAPISINI KOYDU ve kapı INSERT ANINDAKİ `current_date`e
  -- bakıyor, hareketin `occurred_at`ine değil (bilerek: eski satırları
  -- bugünün kuralıyla yargılamamak için). Bu provanın anlattığı hikâye
  -- "parti SKT'si GELMEDEN sevk edildi, sonra tarihi geçti" — zaman
  -- burada SIKIŞTIRILIYOR: sevk geçerliyken yazılıyor, SKT sonradan
  -- geriye çekiliyor. Kapı gevşetilmiyor; sahne gerçek sıraya konuyor.
  update stock_lot set expires_on = current_date - 5 where id = v_lot_biten;

  select deger, ek into d, e from prova_gosterge(v_b,v_bas,v_bit)
   where anahtar='skt_gecmis_deger';
  if coalesce(e,0) = 0 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 5 · tükenmiş parti risk sayıldı: % parti', e; end if;

  -- ── 6 · SKT'Sİ GEÇMİŞ VE ELDE DURAN PARTİ RİSKTİR ─────────────────────
  insert into stock_lot (tenant_id,branch_id,stock_item_id,lot_code,lot_code_key,
                         expires_on,origin_type)
    values (v_t,v_b,v_k,'L-ESKI','l-eski',current_date-3,'RECEIPT')
    returning id into v_lot_eski;
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,unit_cost,idempotency_key,occurred_at)
    values (v_t,v_b,v_k,v_lot_eski,8,8,'kg','PURCHASE_RECEIPT','goods_receipt',10,
            'g65-le1',now()-interval '9 days');

  select deger, ek into d, e from prova_gosterge(v_b,v_bas,v_bit)
   where anahtar='skt_gecmis_deger';
  -- ⚠️ Değer BUGÜNKÜ alış fiyatıyla: elde duran mal bugün ne ediyorsa o.
  if e = 1 and d = 8 * 100 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 6 · SKT geçmiş parti yanlış: % parti, % TL (1 parti / 800 olmalı)', e, d; end if;

  -- ── 7 · 30 GÜN İÇİNDE DOLACAK PARTİ AYRI SAYILIYOR ────────────────────
  insert into stock_lot (tenant_id,branch_id,stock_item_id,lot_code,lot_code_key,
                         expires_on,origin_type)
    values (v_t,v_b,v_k,'L-YAKIN','l-yakin',current_date+10,'RECEIPT')
    returning id into v_lot_yakin;
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,unit_cost,idempotency_key,occurred_at)
    values (v_t,v_b,v_k,v_lot_yakin,4,4,'kg','PURCHASE_RECEIPT','goods_receipt',10,
            'g65-ly1',now()-interval '1 day');

  select ek into e from prova_gosterge(v_b,v_bas,v_bit)
   where anahtar='skt_yaklasan_deger';
  if e = 1 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 7 · yaklaşan SKT yanlış: % (1 olmalı)', e; end if;

  -- ── 8 · KRİTİK SEVİYE ALTINDAKİ KALEM ─────────────────────────────────
  -- Tuz'un min_qty'si 100, hiç hareketi yok → bakiye 0 → kritik.
  select deger into d from prova_gosterge(v_b,v_bas,v_bit) where anahtar='kritik_kalem';
  if d >= 1 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 8 · kritik kalem görülmedi: %', d; end if;

  -- ── 9 · İPTAL EDİLEN SİPARİŞ "GECİKEN" DEĞİLDİR ───────────────────────
  insert into customer (tenant_id,code,code_key,name) values (v_t,'G65','g65','Migros')
    returning id into v_m;
  insert into delivery_point (tenant_id,customer_id,code,code_key,name)
    values (v_t,v_m,'G65-1','g65-1','Şube') returning id into v_n;

  insert into sales_order (tenant_id,branch_id,customer_id,delivery_point_id,order_no,
      order_date,requested_delivery_date,status)
    values (v_t,v_b,v_m,v_n,'SIP-G65-1',current_date-10,current_date-5,'İptal');
  insert into sales_order (tenant_id,branch_id,customer_id,delivery_point_id,order_no,
      order_date,requested_delivery_date,status)
    values (v_t,v_b,v_m,v_n,'SIP-G65-2',current_date-10,current_date-5,'Hazır');

  select deger into d from prova_gosterge(v_b,v_bas,v_bit) where anahtar='geciken_siparis';
  if d = 1 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 9 · iptal edilen sipariş geciken sayıldı: % (1 olmalı)', d; end if;

  -- ── 10 · FİRE DÖKÜMÜ TUTARA GÖRE BÜYÜKTEN KÜÇÜĞE ──────────────────────
  -- "Fire 70 TL" karar aldırmaz; "50 TL'si Un'dan, sebebi küf" aldırır.
  if (select kalem_adi from prova_fire(v_b,v_bas,v_bit) limit 1) = 'Un'
  then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 10 · döküm sıralaması yanlış: %',
      (select kalem_adi from prova_fire(v_b,v_bas,v_bit) limit 1); end if;

  -- ── 11 · FİYATSIZ SATIR DÖKÜMDE DE İŞARETLİ ───────────────────────────
  -- Tutarı boş bir satır "fire yok" sanılmasın.
  if (select fiyatsiz from prova_fire(v_b,v_bas,v_bit) where kalem_adi='Ayçiçek Yağı')
  then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 11 · fiyatsız satır işaretlenmemiş'; end if;

  -- ── 12 · DÖNEM DIŞI FİRE SAYILMIYOR ───────────────────────────────────
  insert into stock_movement (tenant_id,branch_id,stock_item_id,lot_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,note,idempotency_key,occurred_at)
    values (v_t,v_b,v_k,v_lot_temel,-50,-50,'kg','WASTE','manual','Çok eski','g65-f9',
            now()-interval '200 days');

  select deger into d from prova_gosterge(v_b,v_bas,v_bit) where anahtar='fire_tutari';
  if d = 70 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 12 · dönem dışı fire sayıldı: % (70 olmalı)', d; end if;

  -- ── 13 · NEGATİF BAKİYE BİR UYARIDIR, SAKLANMAZ ───────────────────────
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'G65-NEG','g65-neg','Eksiye Düşen','adet') returning id into v_s;
  -- ⚠️ Negatif bakiye ancak politika `warn` ise doğabilir. Kuralı
  -- atlamıyoruz — politikayı gerçekte olabilecek değere çekiyoruz, çünkü
  -- rapor bu durumdaki işletmeyi de okuyabilmeli.
  update tenant set negative_stock_policy = 'warn' where id = v_t;
  insert into stock_movement (tenant_id,branch_id,stock_item_id,quantity_base,
      quantity_entered,uom_entered,reason,source_type,idempotency_key,occurred_at)
    values (v_t,v_b,v_s,-7,-7,'adet','SHIPMENT_OUT','shipment','g65-n1',now()-interval '3 days');

  select deger into d from prova_gosterge(v_b,v_bas,v_bit)
   where anahtar='negatif_bakiyeli_kalem';
  if d >= 1 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1;
    raise notice '❌ 13 · negatif bakiye görülmedi: %', d; end if;

  raise notice '──────────── 0065 PROVA: % geçti, % kaldı ────────────', v_gecen, v_kalan;
  if v_kalan > 0 then raise exception '0065 provası düştü'; end if;
end;
$$;
rollback;
