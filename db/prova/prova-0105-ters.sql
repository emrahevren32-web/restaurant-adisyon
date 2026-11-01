-- ═══════════════════════════════════════════════════════════════════════════
-- TERS PROVA 0105 · GÖÇ GERİ ALINIRSA ESKİ DAVRANIŞ GERİ GELİYOR MU?
--
-- ── NEDEN VAR ─────────────────────────────────────────────────────────────
-- İleri prova "düzeldi" diyor. Ama bir sınama, ölçtüğü kuralın YOKLUĞUNDA
-- da yeşil veriyorsa hiçbir şey ölçmüyordur (27.10 · prova-0095 dersi:
-- *"olumsuz kontrolü olmayan sınama, kapının yokluğunu da onaylar"*).
-- Bu dosya tetiği KALDIRIP aynı şeyleri ölçüyor ve hepsinin KIRILMASINI
-- bekliyor. Kırılmazsa ileri prova da bir şey kanıtlamıyordu.
--
-- ⚠️ Her şey `begin ... rollback` içinde. Tetik gerçekten düşmez.
-- ⚠️ Bu dosya göç DEĞİL. `db/migrations` altına ASLA konmaz.
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare v_t uuid; v_f uuid; v_b uuid := gen_random_uuid(); v_mus uuid;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  insert into public.branch (id, tenant_id, company_id, code, name)
  values (v_b, v_t, v_f, 'T105', 'Ters Prova Şube');
  update public.tenant_settings set vat_rate = 18 where tenant_id = v_t;
  insert into public.customer (tenant_id, code, code_key, name)
  values (v_t, 'T105MUS', 't105mus', 'Ters Prova Müşteri') returning id into v_mus;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);
  perform set_config('prova.mus', v_mus::text, false);
  raise notice 'KURULUM TAMAM · işletme oranı %%18';
end $$;

-- ── 1 · ÖNCE BUGÜNKÜ HÂLİ DOĞRULA ─────────────────────────────────────────
-- ⚠️ Bu adım şart: tetiği kaldırmadan önce ÇALIŞTIĞINI görmezsek, sonraki
-- adımdaki `null` "tetik kalktığı için" değil "zaten hiç çalışmıyordu" da
-- olabilirdi. İki açıklamayı ayıran ölçüm budur.
do $$
declare v_t uuid := current_setting('prova.t')::uuid;
        v_b uuid := current_setting('prova.b')::uuid;
        v_oran numeric;
begin
  raise notice '── 1 · TETİK DURURKEN';
  insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_t, v_b, 'T105-VAR', 't105var', 'Tetik varken', 'kg');
  select vat_rate into v_oran from public.stock_item
   where tenant_id = v_t and code = 'T105-VAR';
  perform prova_bak('tetik dururken oran işletmeden geliyor (%18)', v_oran = 18);
end $$;

-- ── 2 · GÖÇÜ GERİ AL ──────────────────────────────────────────────────────
drop trigger stock_item_kdv on public.stock_item;

-- ── 3 · ESKİ DAVRANIŞ GERİ GELDİ Mİ ───────────────────────────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid;
        v_b uuid := current_setting('prova.b')::uuid;
        v_mus uuid := current_setting('prova.mus')::uuid;
        v_urun uuid; v_sip uuid; v_rev uuid; v_oran numeric;
begin
  raise notice '── 3 · TETİK YOKKEN';

  insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_t, v_b, 'T105-YOK', 't105yok', 'Tetik yokken', 'kg')
  returning id into v_urun;
  select vat_rate into v_oran from public.stock_item where id = v_urun;
  perform prova_bak('⚠️ tetik yokken ürün oranı BOŞ kalıyor (eski davranış)',
    v_oran is null);

  -- Zincir de kopmalı: ürünün oranı boşsa sipariş satırına kopyalanacak
  -- bir şey yok. 0052'nin tetiği duruyor ama kopyalayacağı değer yok.
  insert into public.sales_order (tenant_id, branch_id, order_no, customer_id)
  values (v_t, v_b, 'T105-SIP-1', v_mus) returning id into v_sip;
  insert into public.sales_order_revision (tenant_id, order_id, revision_no, source, reason)
  values (v_t, v_sip, 1, 'Sistem', 'ters-prova-0105') returning id into v_rev;
  insert into public.sales_order_line
    (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
  values (v_t, v_sip, v_rev, 1, v_urun, 5, 'kg');
  select vat_rate into v_oran from public.sales_order_line
   where order_id = v_sip and line_no = 1;
  perform prova_bak('⚠️ ZİNCİR KOPTU: sipariş satırının oranı da BOŞ',
    v_oran is null);

  -- ⚠️ Açıkça yazılan oran tetiğe BAĞLI DEĞİLDİ ve olmamalı da:
  -- bu satır kırmızı verirse, ileri provadaki "ezilmedi" ölçümü aslında
  -- tetiği değil başka bir şeyi ölçüyordu.
  insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom, vat_rate)
  values (v_t, v_b, 'T105-ACIK', 't105acik', 'Açık oran', 'kg', 8)
  returning id into v_urun;
  select vat_rate into v_oran from public.stock_item where id = v_urun;
  perform prova_bak('açıkça yazılan oran tetikten BAĞIMSIZ (%8)', v_oran = 8);
end $$;

rollback;
