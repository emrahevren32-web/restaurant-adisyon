\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

create or replace function prova_oturum(p_auth uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', current_setting('prova.t'))::text, false);
  perform set_config('app.tenant_id', current_setting('prova.t'), false);
end; $$;

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid; v_f uuid; v_b uuid;
  v_rol text; v_auth uuid; v_app uuid;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.f', v_f::text, false);
  perform set_config('prova.b', v_b::text, false);

  foreach v_rol in array array['isletme_sahibi','depo_sorumlusu'] loop
    v_auth := gen_random_uuid(); v_app := gen_random_uuid();
    insert into auth.users (id, email) values (v_auth, 'p91.'||v_rol||'@o.local');
    insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                                 username_key, full_name, role_code, is_active)
    values (v_app, v_t, v_f, v_auth, 'p91'||left(md5(v_rol),6),
            'p91'||left(md5(v_rol),6), v_rol, v_rol, true);
    perform set_config('prova.auth.'||v_rol, v_auth::text, false);
    perform set_config('prova.app.'||v_rol,  v_app::text,  false);
  end loop;
  raise notice 'KURULUM TAMAM';
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid) to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;

-- ── 1 · KENDİ PROFİLİNİ DÜZENLEME · PROFİLİM EKRANININ DAYANDIĞI KURAL ───
select prova_oturum(current_setting('prova.auth.depo_sorumlusu')::uuid);

do $$
declare v_kod text; v_app uuid := current_setting('prova.app.depo_sorumlusu')::uuid;
begin
  raise notice '── 1 · KENDİ PROFİLİ (depo sorumlusu, users.manage YOK)';

  -- Ad ve telefon: Profilim ekranının yazdığı iki alan
  update public.app_user set full_name = 'Yeni Ad', phone = '5551112233'
   where id = v_app;
  perform prova_bak('kendi adini ve telefonunu yazabiliyor', true);

  -- ⚠️ ROLÜNÜ YÜKSELTEMEZ. Kapı "kendi satırı" diyor; kolonu KORUYAN
  -- şey kapı değil, KOLON YETKİSİ (0012). İkisi birlikte çalışmazsa
  -- herkes kendini admin yapardı.
  begin
    update public.app_user set role_code = 'admin' where id = v_app;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('KENDINI ADMIN YAPAMIYOR (gelen: '||v_kod||')', v_kod <> '00000');

  begin
    update public.app_user set is_active = false where id = v_app;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('kendi hesabini pasife alamiyor (gelen: '||v_kod||')',
    v_kod <> '00000');

  begin
    update public.app_user set username = 'kacak' where id = v_app;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('kullanici adini degistiremiyor (gelen: '||v_kod||')',
    v_kod <> '00000');

  -- BAŞKASININ satırına dokunamaz
  begin
    update public.app_user set full_name = 'Kaçak'
     where id = current_setting('prova.app.isletme_sahibi')::uuid;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('BASKASININ adini degistiremiyor (gelen: '||v_kod||')',
    v_kod <> '00000');
end $$;

-- ── 2 · "BUNU KİM YAPTI" ARTIK CEVAPLANIYOR ──────────────────────────────
do $$
declare v_say int; v_app uuid := current_setting('prova.app.depo_sorumlusu')::uuid;
begin
  raise notice '── 2 · DENETİM KAYDI';

  select count(*) into v_say from public.audit_log
   where table_name = 'app_user' and row_id = v_app::text;
  perform prova_bak('profil degisikligi denetime dustu (satir: '||v_say||')',
    v_say >= 1);

  -- Aktör kim? "Kim yaptı" sorusunun cevabı dolu olmalı.
  perform prova_bak('denetim kaydinda aktor yazili',
    exists (select 1 from public.audit_log
             where table_name = 'app_user' and row_id = v_app::text
               and actor_user_id is not null));
end $$;

reset role;

-- ── 3 · ENVANTER ─────────────────────────────────────────────────────────
do $$
declare v_tablo text; v_eksik text[] := '{}';
begin
  raise notice '── 3 · ENVANTER';
  perform set_config('request.jwt.claims', '{}', false);
  perform set_config('request.jwt.claim.sub', '', false);

  foreach v_tablo in array array[
    'app_user','user_role','user_branch_access','company','branch'
  ] loop
    if not exists (
      select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
        join pg_proc p on p.oid = t.tgfoid
       where c.relname = v_tablo and not t.tgisinternal
         and p.proname = 'denetim_yaz'
    ) then
      v_eksik := v_eksik || v_tablo;
    end if;
  end loop;
  perform prova_bak('bes yetki tablosu da denetleniyor'
    || case when v_eksik = '{}' then '' else ' — EKSIK: '
            || array_to_string(v_eksik, ', ') end, v_eksik = '{}');

  -- Kolon yetkileri Profilim'in dayandığı sözleşme (0012). Bozulursa
  -- ekran "kaydedildi" der ve rol yükseltmesi mümkün olur.
  perform prova_bak('full_name yazilabilir',
    has_column_privilege('authenticated','public.app_user','full_name','UPDATE'));
  perform prova_bak('phone yazilabilir',
    has_column_privilege('authenticated','public.app_user','phone','UPDATE'));
  perform prova_bak('role_code YAZILAMAZ',
    not has_column_privilege('authenticated','public.app_user','role_code','UPDATE'));
  perform prova_bak('is_active YAZILAMAZ',
    not has_column_privilege('authenticated','public.app_user','is_active','UPDATE'));
  perform prova_bak('username YAZILAMAZ',
    not has_column_privilege('authenticated','public.app_user','username','UPDATE'));
  perform prova_bak('tablo seviyesinde UPDATE YOK (yalniz kolonlar)',
    not has_table_privilege('authenticated','public.app_user','UPDATE'));

  perform prova_bak('denetim defteri hala degismez',
    exists (select 1 from pg_trigger where tgname = 'audit_log_degismez'
             and not tgisinternal));
end $$;

rollback;
