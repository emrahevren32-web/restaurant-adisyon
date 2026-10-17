\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

create or replace function prova_oturum(p_auth uuid, p_eposta text default null)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'email', p_eposta,
                      'tenant_id', current_setting('prova.t'))::text, false);
  perform set_config('app.tenant_id', current_setting('prova.t'), false);
end; $$;

create or replace function prova_dene(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return '00000';
exception when others then
  perform set_config('prova.son_hata', sqlerrm, false);
  return sqlstate;
end; $$;

create or replace function prova_son_hata() returns text
language sql as $$ select current_setting('prova.son_hata', true) $$;

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid; v_f uuid; v_b uuid;
  v_urun uuid := gen_random_uuid();
  v_mus  uuid := gen_random_uuid();
  v_nokta uuid := gen_random_uuid();
  v_sip  uuid := gen_random_uuid();
  v_rev  uuid := gen_random_uuid();
  v_sevk uuid := gen_random_uuid();
  v_pauth uuid := gen_random_uuid();
  v_rol text; v_auth uuid; v_app uuid;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);

  foreach v_rol in array array['izleyici','sevkiyat_sorumlusu','isletme_muduru'] loop
    v_auth := gen_random_uuid(); v_app := gen_random_uuid();
    insert into auth.users (id, email) values (v_auth, 'p89.'||v_rol||'@o.local');
    insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                                 username_key, full_name, role_code, is_active)
    values (v_app, v_t, v_f, v_auth, 'p89'||left(md5(v_rol),6),
            'p89'||left(md5(v_rol),6), v_rol, v_rol, true);
    perform set_config('prova.auth.'||v_rol, v_auth::text, false);
  end loop;

  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_urun, v_t, v_b, 'P89-URN', 'p89-urn', 'Prova Ürünü', 'kg');

  insert into public.customer (id, tenant_id, code, code_key, name)
  values (v_mus, v_t, 'P89-MUS', 'p89-mus', 'Portal Müşterisi');
  insert into public.delivery_point (id, tenant_id, customer_id, code, code_key, name)
  values (v_nokta, v_t, v_mus, 'P89-NKT', 'p89-nkt', 'Portal Noktası');
  insert into public.customer_price (tenant_id, customer_id, stock_item_id, unit_price, uom_code)
  values (v_t, v_mus, v_urun, 50, 'kg');

  -- Portal kullanıcısı: GERÇEK auth kullanıcısı + e-posta (MIYOP-042'nin dersi)
  insert into auth.users (id, email) values (v_pauth, 'p89.portal@musteri.local');
  insert into public.portal_user (tenant_id, customer_id, email)
  values (v_t, v_mus, 'p89.portal@musteri.local');

  -- Sevk edilecek sipariş: "Hazır" durumunda
  insert into public.sales_order (id, tenant_id, branch_id, order_no, customer_id,
                                  delivery_point_id, status)
  values (v_sip, v_t, v_b, 'P89-SIP-1', v_mus, v_nokta, 'Hazır');
  insert into public.sales_order_revision (id, tenant_id, order_id, revision_no,
                                           kind, source, reason)
  values (v_rev, v_t, v_sip, 1, 'MIKTAR', 'Telefon', 'Kurulum');
  insert into public.sales_order_line (tenant_id, order_id, revision_id, line_no,
                                       stock_item_id, qty, uom_code)
  values (v_t, v_sip, v_rev, 1, v_urun, 10, 'kg');

  -- ⚠️ Satır/revizyon yazımı siparişi "Onay Bekliyor"a düşürüyor (0055)
  -- ve durum zinciri atlanamıyor: Onay Bekliyor → Onaylandı →
  -- Hazırlanıyor → Hazır. Onaylandı için ZORUNLU adımların kararı
  -- yazılmış olmalı (0053). Kurulumda bakım bağlamındayız; adımları
  -- defterden OKUYUP yazıyoruz, uydurmuyoruz.
  insert into public.order_approval
    (tenant_id, order_id, revision_no, step_code, decision, note)
  select v_t, v_sip, 1, s.code, 'Olumlu', 'kurulum'
    from public.order_approval_step s
   where s.tenant_id = v_t and s.required and s.is_active;

  update public.sales_order set status = 'Onaylandı'   where id = v_sip;
  update public.sales_order set status = 'Hazırlanıyor' where id = v_sip;
  update public.sales_order set status = 'Hazır'        where id = v_sip;

  insert into public.shipment (id, tenant_id, branch_id, shipment_no, customer_name,
                               customer_id, order_id, status)
  values (v_sevk, v_t, v_b, 'P89-SEVK-1', 'Portal Müşterisi', v_mus, v_sip, 'DRAFT');

  perform set_config('prova.urun',  v_urun::text,  false);
  perform set_config('prova.mus',   v_mus::text,   false);
  perform set_config('prova.nokta', v_nokta::text, false);
  perform set_config('prova.sip',   v_sip::text,   false);
  perform set_config('prova.sevk',  v_sevk::text,  false);
  perform set_config('prova.pauth', v_pauth::text, false);
  raise notice 'KURULUM TAMAM';
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid,text),
  prova_dene(text), prova_son_hata() to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;

-- ── 1 · MIYOP-039 · MÜŞTERİ PORTALI ──────────────────────────────────────
select prova_oturum(current_setting('prova.pauth')::uuid, 'p89.portal@musteri.local');

do $$
declare v_no text; v_kod text;
begin
  raise notice '── 1 · PORTAL MÜŞTERİSİ (app_user kaydı YOK, operations.write YOK)';

  -- Bakım bağlamı KAPALI olmalı; açıksa prova yalan söyler (MIYOP-042)
  perform prova_bak('portal oturumunda auth.uid() dolu', auth.uid() is not null);
  perform prova_bak('portal oturumunda bakim baglami KAPALI',
    app.bakim_baglami() = false);
  -- app.portal_kullanicisi() `authenticated`a kapali (dogru); portalin
  -- kendi okuma RPC'sinden dogruluyoruz.
  perform prova_bak('portal kullanicisi cozuluyor (noktalarim doluyor)',
    exists (select 1 from public.portal_noktalarim()));
  perform prova_bak('portal kullanicisinin operations.write izni YOK',
    app.yetkim_var('operations.write') = false);

  -- ⚠️ ASIL SINAV: portaldan sipariş verilebiliyor mu?
  begin
    v_no := public.portal_siparis_ver(
      current_setting('prova.nokta')::uuid,
      jsonb_build_array(jsonb_build_object(
        'kalem_id', current_setting('prova.urun'), 'miktar', 5, 'birim', 'kg')));
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('MIYOP-039 · portaldan siparis VERILEBILIYOR (gelen: '||v_kod||')',
    v_kod = '00000');

  -- ⚠️ AMA defterin kendisine DOKUNAMAZ: RPC dışından yazamaz
  perform prova_bak('portal kullanicisi sales_order tablosuna DOGRUDAN yazamiyor',
    prova_dene(format(
      'insert into public.sales_order (tenant_id, branch_id, order_no, customer_id, status)
       values (%L, %L, ''P89-KACAK'', %L, ''Onaylandı'')',
      current_setting('prova.t'), current_setting('prova.b'),
      current_setting('prova.mus'))) = 'MI403');

  v_kod := prova_dene(format(
    'insert into public.customer (tenant_id, code, code_key, name)
     values (%L, ''P89-K2'', ''p89-k2'', ''Kaçak'')',
    current_setting('prova.t')));
  perform prova_bak('portal kullanicisi musteri karti ACAMIYOR — DOGRU SEBEPLE '
    '(MI403, gelen: '||v_kod||')', v_kod = 'MI403');

  v_kod := prova_dene(format(
    'insert into public.stock_count (tenant_id, branch_id, count_no)
     values (%L, %L, ''P89-SAY'')',
    current_setting('prova.t'), current_setting('prova.b')));
  perform prova_bak('portal kullanicisi stok sayimi ACAMIYOR — DOGRU SEBEPLE '
    '(MI403, gelen: '||v_kod||')', v_kod = 'MI403');
end $$;

-- ── 2 · MIYOP-038 · SEVKİYAT SİPARİŞİ İLERLETİYOR ────────────────────────
select prova_oturum(current_setting('prova.auth.sevkiyat_sorumlusu')::uuid);

do $$
declare v_kod text; v_durum text;
begin
  raise notice '── 2 · SEVKİYAT SORUMLUSU (logistics.write VAR, operations.write YOK)';
  perform prova_bak('sevkiyatcinin operations.write izni YOK',
    app.yetkim_var('operations.write') = false);
  perform prova_bak('sevkiyatcinin logistics.write izni VAR',
    app.yetkim_var('logistics.write'));

  v_kod := prova_dene(format(
    'update public.shipment set status = ''SHIPPED'' where id = %L',
    current_setting('prova.sevk')));
  perform prova_bak('MIYOP-038 · sevkiyat SEVK EDILEBILIYOR (gelen: '||v_kod||
    case when v_kod = '00000' then '' else ' — '||coalesce(prova_son_hata(),'') end||')',
    v_kod = '00000');

  select status into v_durum from public.sales_order
   where id = current_setting('prova.sip')::uuid;
  perform prova_bak('siparis durumu SISTEM tarafindan ilerledi: '||coalesce(v_durum,'(yok)'),
    v_durum in ('Kısmi Sevk', 'Sevk Edildi'));

  -- Zincirden geçebiliyor olmak, kapıyı açtı anlamına GELMEMELİ
  perform prova_bak('sevkiyatci siparise DOGRUDAN dokunamiyor',
    prova_dene(format(
      'update public.sales_order set note = ''kurcalandi'' where id = %L',
      current_setting('prova.sip'))) = 'MI403');
  perform prova_bak('sevkiyatci musteri karti acamiyor',
    prova_dene(format(
      'insert into public.customer (tenant_id, code, code_key, name)
       values (%L, ''P89-K3'', ''p89-k3'', ''Kaçak'')',
      current_setting('prova.t'))) = 'MI403');
end $$;

-- ── 3 · İZLEYİCİ HÂLÂ DIŞARIDA ───────────────────────────────────────────
select prova_oturum(current_setting('prova.auth.izleyici')::uuid);

do $$
begin
  raise notice '── 3 · İZLEYİCİ';
  perform prova_bak('izleyici siparis acamiyor',
    prova_dene(format(
      'insert into public.sales_order (tenant_id, branch_id, order_no, customer_id)
       values (%L, %L, ''P89-IZL'', %L)',
      current_setting('prova.t'), current_setting('prova.b'),
      current_setting('prova.mus'))) = 'MI403');
  perform prova_bak('izleyici sevkiyati sevk edemiyor',
    prova_dene(format(
      'update public.shipment set status = ''SHIPPED'' where id = %L',
      current_setting('prova.sevk'))) = 'MI403');
  perform prova_bak('izleyici haccp plani acamiyor',
    prova_dene(format(
      'insert into public.haccp_plan (tenant_id, code, name)
       values (%L, ''P89-HP'', ''Kaçak'')',
      current_setting('prova.t'))) = 'MI403');
end $$;

reset role;
rollback;
