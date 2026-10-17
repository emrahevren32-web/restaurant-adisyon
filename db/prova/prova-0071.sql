-- 0071 · analiz yetkisinin veritabanında denetlenmesi.
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_b uuid; v_k uuid; v_u uuid; v_eski text;
  v_auth1 uuid := gen_random_uuid(); v_auth2 uuid := gen_random_uuid();
  v_say int;
  v_gecen int := 0; v_kalan int := 0;
begin
  select id into v_t from tenant where code='MIYOP';
  select id into v_b from branch where tenant_id=v_t limit 1;
  insert into stock_item (tenant_id,branch_id,code,code_key,name,base_uom)
    values (v_t,v_b,'Y71','y71','Un','kg') returning id into v_k;

  -- ── 1 · YETKİSİ OLAN OKUYABİLİYOR ────────────────────────────────────
  -- ⚠️ Kapı VARSAYILAN OLARAK REDDEDİYOR: oturum yoksa `yetkim_var` false
  -- döner ve `postgres` bile geçemez. Doğru davranış — provayı gerçek bir
  -- yetkili kullanıcıyla kuruyoruz, kuralı gevşeterek değil.
  -- ⚠️ `yetkim_var` auth.uid()'yi `app_user.auth_user_id` ile eşleştiriyor;
  -- `app_user.id` ile DEĞİL. İkisini karıştırmak testi sessizce yanlış
  -- yapardı: kapı reddeder, biz "kapı çalışıyor" sanırdık.
  insert into app_user (tenant_id, username, username_key, full_name, role_code,
                        is_active, auth_user_id)
    values (v_t,'y71sahip','y71sahip','Sahip','isletme_sahibi',true,v_auth1)
    returning id into v_u;

  v_eski := current_setting('request.jwt.claims', true);
  -- ⚠️ YEREL TAKLİT `request.jwt.claim.sub` OKUYOR (tekil, noktalı);
  -- Supabase'de `request.jwt.claims` JSON'u da var. İkisi de ayarlanıyor
  -- ki prova hem burada hem canlıda aynı yolu sınasın.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_auth1::text, 'tenant_id', v_t::text)::text, true);
  perform set_config('request.jwt.claim.sub', v_auth1::text, true);

  select count(*) into v_say
    from app.isletme_gostergeleri(v_b, current_date-30, current_date);
  if v_say > 0 then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 1 · yetkili okuyamadı'; end if;

  -- ── 2 · HAM HESAP DURUYOR VE AYNI SONUCU VERİYOR ─────────────────────
  -- Kapı hesabı değiştirmemeli, yalnız önüne geçmeli.
  if (select count(*) from app.isletme_gostergeleri_ham(v_b, current_date-30, current_date))
     = v_say
  then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 2 · kapı hesabı değiştirmiş'; end if;

  -- ── 3 · YETKİSİZ OTURUM REDDEDİLİYOR ─────────────────────────────────
  -- `finance.read`'i OLMAYAN bir kullanıcı: depo sorumlusu.
  insert into app_user (tenant_id, username, username_key, full_name, role_code,
                        is_active, auth_user_id)
    values (v_t,'y71depo','y71depo','Depocu','depo_sorumlusu',true,v_auth2)
    returning id into v_u;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_auth2::text, 'tenant_id', v_t::text)::text, true);
  perform set_config('request.jwt.claim.sub', v_auth2::text, true);

  begin
    perform * from app.isletme_gostergeleri(v_b, current_date-30, current_date);
    v_kalan := v_kalan+1;
    raise notice '❌ 3 · yetkisiz kullanıcı göstergeleri okudu';
  exception
    when sqlstate 'MI403' then v_gecen := v_gecen+1;
    when insufficient_privilege then v_gecen := v_gecen+1;
  end;

  -- ── 4 · FİRE DÖKÜMÜ DE KAPALI ────────────────────────────────────────
  -- Birini kapatıp ötekini açık bırakmak kapıyı hiç kapatmamaktır.
  begin
    perform * from app.fire_dokumu(v_b, current_date-30, current_date);
    v_kalan := v_kalan+1;
    raise notice '❌ 4 · yetkisiz kullanıcı fire dökümünü okudu';
  exception
    when sqlstate 'MI403' then v_gecen := v_gecen+1;
    when insufficient_privilege then v_gecen := v_gecen+1;
  end;

  perform set_config('request.jwt.claims', coalesce(v_eski,''), true);
  perform set_config('request.jwt.claim.sub', '', true);

  -- ── 5 · HATA MESAJI HANGİ İZİN OLDUĞUNU SÖYLÜYOR ─────────────────────
  -- "Yetkiniz yok" diyen ama hangi yetki olduğunu söylemeyen mesaj,
  -- kullanıcıyı da yöneticiyi de çaresiz bırakır.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='app' and p.proname='isletme_gostergeleri'
       and p.prosrc like '%finance.read%'
  ) then v_gecen := v_gecen+1;
  else v_kalan := v_kalan+1; raise notice '❌ 5 · mesaj izni söylemiyor'; end if;

  raise notice '──────────── 0071 PROVA: % geçti, % kaldı ────────────', v_gecen, v_kalan;
  if v_kalan > 0 then raise exception '0071 provası düştü'; end if;
end;
$$;
rollback;
