\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0117 · SON ONAY · TEK YETKİLİ
--
-- Kural (Emrah kararı 12.11.2026 + gerekçesi 0117'nin başlığında):
--   İşletme Müdürü verir · işletmede aktif müdür YOKSA işletme sahibi verir.
--
-- Sorular (hepsi `authenticated` rolüyle, GERÇEK UPDATE yoluyla):
--   1 · Müdürsüz işletmede sahip onaylayabiliyor mu?              → EVET
--   2 · Müdürsüz işletmede sahip olmayan (admin) onaylayabiliyor mu? → HAYIR
--   3 · Müdür atanınca sahip HÂLÂ onaylayabiliyor mu?             → HAYIR
--   4 · Müdür onaylayabiliyor mu?                                 → EVET
--   5 · ⚠️ Zincir kapısı (MI429) hâlâ duruyor mu?                 → EVET
--   6 · ⚠️ Reddedilen sipariş DEĞİŞTİ mi?                         → HAYIR
--   7 · Kimin onayladığı deftere yazılıyor mu?                    → EVET
--   8 · Sahip kendine müdür rolü verince onaylayabiliyor mu?      → EVET
--   9 · Onaylanmış siparişi ilerletmek hâlâ sipariş yazma izni mi? → EVET
--  10 · Ekranın sorduğu kabuk kapıyla AYNI cevabı veriyor mu?     → EVET
--  11 · anon kabuğu çağırabiliyor mu?                             → HAYIR
--
-- ⚠️ `set local role authenticated` TAKILIYOR (MIYOP-042). Sahne kurulumu
-- ve müdürün aktifleştirilmesi oturumsuz (bakım bağlamı) yapılıyor; ölçülen
-- her yazım oturumlu.
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
-- 5 sipariş: zinciri tamam olanlar ve sonuncusu zinciri EKSİK.
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
    (v_mudur,'p117.mudur@o.local'), (v_sahip,'p117.sahip@o.local'),
    (v_yon,'p117.yonetici@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_mudur_app, v_t, v_f, v_mudur, 'p117md', 'p117md', 'Prova Müdür', 'isletme_muduru', false),
         (v_sahip_app, v_t, v_f, v_sahip, 'p117sh', 'p117sh', 'Prova Sahip', 'isletme_sahibi', true),
         (v_yon_app,   v_t, v_f, v_yon,   'p117yn', 'p117yn', 'Prova Yönetici', 'admin', true);

  insert into public.customer (tenant_id, code, code_key, name)
  values (v_t, 'P117-MUS', 'petiket-mus', 'Prova Müşterisi 117') returning id into v_mus;

  for v_i in 1..5 loop
    v_sip := gen_random_uuid();
    insert into public.sales_order (id, tenant_id, branch_id, order_no, customer_id)
    values (v_sip, v_t, v_b, 'P117-SIP-' || v_i, v_mus);
    update public.sales_order set status = 'Onay Bekliyor' where id = v_sip;
    if v_i < 5 then
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

-- ── 1 · MÜDÜRSÜZ İŞLETME · SAHİP ─────────────────────────────────────────
set local role authenticated;
select prova_oturum(current_setting('prova.sahip')::uuid);
do $$
declare v_kod text; v_durum text; v_kim uuid;
begin
  raise notice '── 1 · MÜDÜRSÜZ İŞLETME · SAHİP';
  perform prova_bak('sağlama: oturum bakım bağlamı DEĞİL (kapı çalışıyor)',
    not app.bakim_baglami());
  perform prova_bak('sağlama: sahipte operations.write VAR',
    app.yetkim_var('operations.write'));
  perform prova_bak('işletmede aktif müdür YOK', not app.isletmemde_mudur_var());
  perform prova_bak('⚠️ ekranın sorduğu kabuk: sahip son onayı VEREBİLİR',
    public.son_onay_yetkim_var());

  begin
    update public.sales_order set status = 'Onaylandı'
     where id = current_setting('prova.sip5')::uuid;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ zinciri EKSİK siparişi sahip de onaylayamıyor ('||v_kod||') — eski kapı duruyor',
    v_kod = 'MI429');

  update public.sales_order set status = 'Onaylandı'
   where id = current_setting('prova.sip1')::uuid;
  select status into v_durum from public.sales_order
   where id = current_setting('prova.sip1')::uuid;
  perform prova_bak('⚠️ müdürsüz işletmede sahip ONAYLADI — bulunan: '||v_durum,
    v_durum = 'Onaylandı');

  select e.actor_id into v_kim from public.sales_order_event e
   where e.order_id = current_setting('prova.sip1')::uuid
     and e.kind = 'DURUM' and e.to_status = 'Onaylandı'
   order by e.created_at desc, e.id desc limit 1;
  perform prova_bak('⚠️ kimin onayladığı deftere yazıldı: sahip',
    v_kim = current_setting('prova.sahip_app')::uuid);
end $$;

-- ── 2 · MÜDÜRSÜZ İŞLETME · NE MÜDÜR NE SAHİP ─────────────────────────────
select prova_oturum(current_setting('prova.yon')::uuid);
do $$
declare v_kod text; v_metin text; v_durum text;
begin
  raise notice '── 2 · MÜDÜRSÜZ İŞLETME · YÖNETİCİ (admin)';
  perform prova_bak('sağlama: yöneticide operations.write VAR (sipariş açabiliyor)',
    app.yetkim_var('operations.write'));
  perform prova_bak('⚠️ kabuk: yönetici son onayı VEREMEZ',
    not public.son_onay_yetkim_var());
  begin
    update public.sales_order set status = 'Onaylandı'
     where id = current_setting('prova.sip2')::uuid;
    v_kod := '00000'; v_metin := '';
  exception when others then v_kod := sqlstate; v_metin := sqlerrm;
  end;
  perform prova_bak('⚠️ sipariş açabilen ama yetkili olmayan ONAYLAYAMIYOR ('||v_kod||')',
    v_kod = 'MI403');
  perform prova_bak('cevap kuralı söylüyor: '||v_metin,
    v_metin ~ 'İşletme Müdürü' and v_metin ~ 'işletme sahibi');
  select status into v_durum from public.sales_order
   where id = current_setting('prova.sip2')::uuid;
  perform prova_bak('⚠️ reddedilen sipariş DEĞİŞMEDİ — bulunan: '||v_durum,
    v_durum = 'Onay Bekliyor');
end $$;

-- ── MÜDÜR ATANIYOR (oturumsuz: bakım bağlamı) ────────────────────────────
reset role;
select set_config('request.jwt.claims', '{}', false);
select set_config('request.jwt.claim.sub', '', false);
update public.app_user set is_active = true
 where id = current_setting('prova.mudur_app')::uuid;

-- ── 3 · MÜDÜRLÜ İŞLETME · SAHİP ARTIK VEREMEZ ────────────────────────────
set local role authenticated;
select prova_oturum(current_setting('prova.sahip')::uuid);
do $$
declare v_kod text; v_metin text; v_durum text;
begin
  raise notice '── 3 · MÜDÜRLÜ İŞLETME · SAHİP';
  perform prova_bak('işletmede aktif müdür VAR', app.isletmemde_mudur_var());
  perform prova_bak('⚠️ kabuk: müdür atanınca sahip son onayı VEREMEZ',
    not public.son_onay_yetkim_var());
  begin
    update public.sales_order set status = 'Onaylandı'
     where id = current_setting('prova.sip2')::uuid;
    v_kod := '00000'; v_metin := '';
  exception when others then v_kod := sqlstate; v_metin := sqlerrm;
  end;
  perform prova_bak('⚠️ müdürü olan işletmede SAHİP onaylayamıyor ('||v_kod||')',
    v_kod = 'MI403');
  perform prova_bak('cevap işi müdüre gönderiyor: '||v_metin,
    v_metin ~ 'Bu işletmede' and v_metin ~ 'İşletme Müdürü');
  select status into v_durum from public.sales_order
   where id = current_setting('prova.sip2')::uuid;
  perform prova_bak('⚠️ reddedilen sipariş DEĞİŞMEDİ — bulunan: '||v_durum,
    v_durum = 'Onay Bekliyor');

  -- Onaylanmış siparişi ilerletmek hâlâ sipariş yazma izni.
  update public.sales_order set status = 'Hazırlanıyor'
   where id = current_setting('prova.sip1')::uuid;
  select status into v_durum from public.sales_order
   where id = current_setting('prova.sip1')::uuid;
  perform prova_bak('sahip onaylanmış siparişi İLERLETEBİLİYOR — bulunan: '||v_durum,
    v_durum = 'Hazırlanıyor');
end $$;

-- ── 4 · MÜDÜR ────────────────────────────────────────────────────────────
select prova_oturum(current_setting('prova.mudur')::uuid);
do $$
declare v_kod text; v_durum text; v_kim uuid;
begin
  raise notice '── 4 · İŞLETME MÜDÜRÜ';
  perform prova_bak('⚠️ kabuk: müdür son onayı VEREBİLİR', public.son_onay_yetkim_var());
  begin
    update public.sales_order set status = 'Onaylandı'
     where id = current_setting('prova.sip5')::uuid;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ müdür de zinciri EKSİK siparişi onaylayamıyor ('||v_kod||')',
    v_kod = 'MI429');

  update public.sales_order set status = 'Onaylandı'
   where id = current_setting('prova.sip2')::uuid;
  select status into v_durum from public.sales_order
   where id = current_setting('prova.sip2')::uuid;
  perform prova_bak('⚠️ müdür zinciri TAMAM siparişi ONAYLADI — bulunan: '||v_durum,
    v_durum = 'Onaylandı');

  select e.actor_id into v_kim from public.sales_order_event e
   where e.order_id = current_setting('prova.sip2')::uuid
     and e.kind = 'DURUM' and e.to_status = 'Onaylandı'
   order by e.created_at desc, e.id desc limit 1;
  perform prova_bak('⚠️ kimin onayladığı deftere yazıldı: müdür',
    v_kim = current_setting('prova.mudur_app')::uuid);
end $$;

-- ── 5 · SAHİP KENDİNE MÜDÜR ROLÜ VERİYOR (gerçek kabuk) ──────────────────
select prova_oturum(current_setting('prova.sahip')::uuid);
do $$
declare v_durum text;
begin
  raise notice '── 5 · SAHİP + MÜDÜR ROLÜ';
  perform public.assign_user_roles(
    current_setting('prova.sahip_app')::uuid, array['isletme_muduru']);
  perform prova_bak('⚠️ ek rol olarak müdür olan sahip son onayı VEREBİLİR',
    public.son_onay_yetkim_var());
  update public.sales_order set status = 'Onaylandı'
   where id = current_setting('prova.sip3')::uuid;
  select status into v_durum from public.sales_order
   where id = current_setting('prova.sip3')::uuid;
  perform prova_bak('⚠️ ve ONAYLADI — bulunan: '||v_durum, v_durum = 'Onaylandı');
end $$;

-- ── 6 · anon ─────────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '{}', false);
select set_config('request.jwt.claim.sub', '', false);
set local role anon;
do $$
declare v_kod text;
begin
  raise notice '── 6 · anon';
  begin
    perform public.son_onay_yetkim_var();
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ anon kabuğu ÇAĞIRAMIYOR ('||v_kod||')', v_kod = '42501');
end $$;
reset role;

-- ── 7 · ENVANTER ─────────────────────────────────────────────────────────
do $$
begin
  raise notice '── 7 · ENVANTER';
  perform prova_bak('⚠️ yeni izin AÇILMADI (kural role bakıyor)',
    not exists (select 1 from public.permission where code = 'operations.final_approve'));
  perform prova_bak('tetik bağlı',
    exists (select 1 from pg_trigger t where t.tgrelid = 'public.sales_order'::regclass
              and t.tgname = 'sales_order_onay_kapisi' and not t.tgisinternal));
  perform prova_bak('zincirin ADIM izni değişmedi (operations.approve)',
    exists (select 1 from public.order_approval_step where permission_code = 'operations.approve'));
  perform prova_bak('⚠️ oturumsuz bakım yazımı kapıya TAKILMIYOR (göç ve yedek çalışır)',
    app.bakim_baglami());
end $$;

do $$ begin raise notice '──── 0117 provası: TAMAM'; end $$;
rollback;
