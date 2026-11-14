\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- TERS PROVA 0117 · KUSUR GERÇEK MİYDİ
--
-- 0117'nin yazdığı kapı 0053'teki ESKİ gövdesine geri çevriliyor ve sipariş
-- AÇABİLEN ama ne müdür ne sahip olan bir kullanıcının zinciri tamam
-- siparişe SON ONAYI verebildiği gösteriliyor. Sonunda `rollback`.
--
-- ⚠️ Eski gövde bu dosyaya 0053'ten HARFİ HARFİNE alındı; "eskisi böyleydi"
-- diye yeniden yazılmadı.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
declare v_ad text := coalesce(p_ad, '(iddia metni NULL uretti)');
begin
  if p_kosul then raise notice '  ✓ %', v_ad;
  else raise exception '  ✗ %', v_ad; end if;
end; $$;

create or replace function prova_oturum(p_auth uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', current_setting('prova.t'))::text, false);
  perform set_config('app.tenant_id', current_setting('prova.t'), false);
end; $$;

-- ── SAHNE ─────────────────────────────────────────────────────────────────
-- Üç kullanıcı: müdür (BAŞTA PASİF — "işletmede müdür yok" sahnesi için),
-- sahip, yönetici (`admin`: sipariş açabilir ama ne müdür ne sahip).
-- 3 sipariş: zinciri tamam olanlar ve sonuncusu zinciri EKSİK.
do $$
declare
  v_t uuid; v_f uuid; v_b uuid; v_mus uuid; v_adim record; v_sip uuid; v_i int;
  v_mudur uuid := gen_random_uuid();  v_mudur_app uuid := gen_random_uuid();
  v_sahip uuid := gen_random_uuid();  v_sahip_app uuid := gen_random_uuid();
  v_yon   uuid := gen_random_uuid();  v_yon_app   uuid := gen_random_uuid();
begin
  select t.id into v_t from public.tenant t where not t.is_platform limit 1;
  if v_t is null then select t.id into v_t from public.tenant t limit 1; end if;
  if v_t is null then raise exception 'KURULUM: kiraci yok'; end if;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;

  insert into auth.users (id, email) values
    (v_mudur,'p117T.mudur@o.local'), (v_sahip,'p117T.sahip@o.local'),
    (v_yon,'p117T.yonetici@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_mudur_app, v_t, v_f, v_mudur, 'p117Tmd', 'p117Tmd', 'Prova Müdür', 'isletme_muduru', false),
         (v_sahip_app, v_t, v_f, v_sahip, 'p117Tsh', 'p117Tsh', 'Prova Sahip', 'isletme_sahibi', true),
         (v_yon_app,   v_t, v_f, v_yon,   'p117Tyn', 'p117Tyn', 'Prova Yönetici', 'admin', true);

  insert into public.customer (tenant_id, code, code_key, name)
  values (v_t, 'P117T-MUS', 'petiket-mus', 'Prova Müşterisi 117T') returning id into v_mus;

  for v_i in 1..3 loop
    v_sip := gen_random_uuid();
    insert into public.sales_order (id, tenant_id, branch_id, order_no, customer_id)
    values (v_sip, v_t, v_b, 'P117T-SIP-' || v_i, v_mus);
    update public.sales_order set status = 'Onay Bekliyor' where id = v_sip;
    if v_i < 3 then
      for v_adim in select s.code from public.order_approval_step s
                     where s.tenant_id = v_t and s.is_active loop
        insert into public.order_approval
          (tenant_id, order_id, revision_no, step_code, decision, note, decided_by)
        select v_t, v_sip, o.current_revision, v_adim.code, 'Olumlu', 'prova', v_sahip_app
          from public.sales_order o where o.id = v_sip;
      end loop;
    end if;
    perform set_config('prova.sip' || v_i, v_sip::text, false);
  end loop;

  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.mudur', v_mudur::text, false);
  perform set_config('prova.mudur_app', v_mudur_app::text, false);
  perform set_config('prova.sahip', v_sahip::text, false);
  perform set_config('prova.sahip_app', v_sahip_app::text, false);
  perform set_config('prova.yon', v_yon::text, false);

  -- ⚠️ SAĞLAMA: sahne "müdürsüz işletme" ile başlamak zorunda. İşletmede
  -- başka bir aktif müdür varsa aşağıdaki ilk bölüm yanlış şeyi ölçer.
  if exists (select 1 from public.app_user u
              where u.tenant_id = v_t and u.is_active
                and (u.role_code = 'isletme_muduru'
                     or exists (select 1 from public.user_role ur
                                 where ur.user_id = u.id
                                   and ur.role_code = 'isletme_muduru'))) then
    raise exception 'KURULUM: sahne isletmesinde zaten aktif bir mudur var';
  end if;
  raise notice 'KURULUM TAMAM';
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid) to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- ── ÖNCE · 0117 yerindeyken ──────────────────────────────────────────────
set local role authenticated;
select prova_oturum(current_setting('prova.yon')::uuid);
do $$
declare v_kod text;
begin
  perform prova_bak('sağlama: yöneticide operations.write VAR',
    app.yetkim_var('operations.write'));
  begin
    update public.sales_order set status = 'Onaylandı'
     where id = current_setting('prova.sip1')::uuid;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('0117 yerindeyken yetkili olmayan REDDEDİLİYOR ('||v_kod||')', v_kod = 'MI403');
end $$;
reset role;
select set_config('request.jwt.claims', '{}', false);
select set_config('request.jwt.claim.sub', '', false);

-- ── KURAL GERİ ÇEVRİLİYOR · 0053'ün gövdesi ──────────────────────────────
create or replace function app.siparis_onay_kapisi()
returns trigger
language plpgsql
as $$
declare
  v_eksik text;
  v_tarih date;
begin
  if new.status = 'Onaylandı' and old.status is distinct from 'Onaylandı' then
    if not app.siparis_onayi_tam(new.id) then
      select string_agg(s.name, ', ' order by s.sort_order) into v_eksik
        from public.order_approval_step s
       where s.tenant_id = new.tenant_id and s.is_active and s.required
         and coalesce((
               select a.decision from public.order_approval a
                where a.order_id = new.id and a.step_code = s.code
                  and a.revision_no = new.current_revision
                order by a.decided_at desc, a.id desc limit 1
             ), 'Yok') not in ('Olumlu','Şartlı');
      raise exception
        'Sipariş onaylanamaz: şu adımların onayı eksik → %. '
        'Sipariş revize edildiyse onaylar yeniden alınır — onaylanan miktar '
        'ile gönderilecek miktar aynı olmak zorunda.', v_eksik
        using errcode = 'MI429';
    end if;

    -- Söz verilen tarih: bu revizyonun kararlarındaki EN GEÇ tarih.
    -- En erkeni almak, sözü tutamayacağımız bir tarihi müşteriye söylemek
    -- olurdu.
    select max(a.promised_on) into v_tarih
      from public.order_approval a
     where a.order_id = new.id and a.revision_no = new.current_revision;
    if v_tarih is not null then new.promised_delivery_date := v_tarih; end if;
  end if;
  return new;
end;
$$;

-- ── SONRA · eski gövdeyle ────────────────────────────────────────────────
set local role authenticated;
select prova_oturum(current_setting('prova.yon')::uuid);
do $$
declare v_durum text; v_kod text;
begin
  update public.sales_order set status = 'Onaylandı'
   where id = current_setting('prova.sip1')::uuid;
  select status into v_durum from public.sales_order
   where id = current_setting('prova.sip1')::uuid;
  -- ⚠️ BU SATIRIN YEŞİL YANMASI, KUSURUN GERÇEK OLDUĞUNUN KANITIDIR.
  perform prova_bak('⚠️ ESKİ GÖVDEYLE sipariş açabilen HERKES son onayı verebiliyordu — bulunan: '||v_durum,
    v_durum = 'Onaylandı');

  -- Zincir kapısı eski gövdede de vardı; ters prova onu bozmadı.
  begin
    update public.sales_order set status = 'Onaylandı'
     where id = current_setting('prova.sip3')::uuid;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('zincir kapısı eski gövdede de duruyordu ('||v_kod||')', v_kod = 'MI429');
end $$;
reset role;

do $$ begin raise notice '──── 0117 ters provası: TAMAM'; end $$;
rollback;
