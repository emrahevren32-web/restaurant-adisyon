-- 0060 · set_primary_role davranış provası.
-- Her şey bir işlem içinde; sonunda geri alınıyor.
\set ON_ERROR_STOP on
set client_min_messages = notice;
begin;
do $$
declare
  v_t uuid; v_t2 uuid; v_c uuid; v_b uuid;
  v_auth_sahip uuid; v_auth_sahip2 uuid; v_auth_personel uuid;
  v_sahip uuid; v_sahip2 uuid; v_personel uuid; v_hasan uuid; v_yabanci uuid;
  v_sonuc text; v_gecen int := 0; v_kalan int := 0;

  procedure_ad text;
begin
  -- ── Kurulum ─────────────────────────────────────────────────────────────
  insert into tenant (code,name) values ('P60','Prova 60') returning id into v_t;
  insert into company (tenant_id,company_code,company_name)
    values (v_t,'P60','Prova 60 A.Ş.') returning id into v_c;
  insert into branch (tenant_id,company_id,code,name,branch_type,is_head_office)
    values (v_t,v_c,'MRK','Merkez','merkez',true) returning id into v_b;

  insert into tenant (code,name) values ('P60B','Prova 60 Baska') returning id into v_t2;

  insert into auth.users default values returning id into v_auth_sahip;
  insert into auth.users default values returning id into v_auth_sahip2;
  insert into auth.users default values returning id into v_auth_personel;

  insert into app_user (tenant_id,auth_user_id,username,username_key,full_name,role_code)
    values (v_t,v_auth_sahip,'p60sahip','p60sahip','Sahip','isletme_sahibi')
    returning id into v_sahip;
  insert into app_user (tenant_id,auth_user_id,username,username_key,full_name,role_code)
    values (v_t,v_auth_personel,'p60per','p60per','Personel','personel')
    returning id into v_personel;
  insert into app_user (tenant_id,username,username_key,full_name,role_code)
    values (v_t,'p60hasan','p60hasan','Hasan','depo_sorumlusu')
    returning id into v_hasan;
  insert into app_user (tenant_id,username,username_key,full_name,role_code)
    values (v_t2,'p60yab','p60yab','Yabancı','personel')
    returning id into v_yabanci;

  -- ── 1 · Oturum yokken reddediyor ────────────────────────────────────────
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.set_primary_role(v_hasan,'sevkiyat_sorumlusu');
    v_kalan := v_kalan + 1; raise notice '❌ 1 · oturumsuz çağrı geçti';
  exception when sqlstate 'MI403' then v_gecen := v_gecen + 1;
  end;

  -- ── 2 · Yetkisiz kullanıcı (personel) reddediliyor ──────────────────────
  perform set_config('request.jwt.claim.sub', v_auth_personel::text, true);
  begin
    perform public.set_primary_role(v_hasan,'sevkiyat_sorumlusu');
    v_kalan := v_kalan + 1; raise notice '❌ 2 · personel rol değiştirebildi';
  exception when sqlstate 'MI403' then v_gecen := v_gecen + 1;
  end;

  -- Bundan sonrası işletme sahibi oturumu.
  perform set_config('request.jwt.claim.sub', v_auth_sahip::text, true);

  -- ── 3 · MUTLU YOL: Hasan depodan sevkiyata geçiyor ──────────────────────
  v_sonuc := public.set_primary_role(v_hasan,'sevkiyat_sorumlusu');
  if v_sonuc = 'sevkiyat_sorumlusu'
     and (select role_code from app_user where id=v_hasan) = 'sevkiyat_sorumlusu'
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 3 · ana görev değişmedi';
  end if;

  -- ── 4 · EK ROLLERE DOKUNMUYOR ───────────────────────────────────────────
  -- Hasan'a ek olarak depo rolü verilmişse, ana görevi değişince depo
  -- yetkileri DEVAM ETMELİ. Sessiz silme en tehlikeli davranış olurdu.
  insert into user_role (tenant_id,user_id,role_code) values (v_t,v_hasan,'depo_sorumlusu')
    on conflict do nothing;
  perform public.set_primary_role(v_hasan,'uretim_sorumlusu');
  if exists (select 1 from user_role where user_id=v_hasan and role_code='depo_sorumlusu')
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 4 · ek rol sessizce silindi';
  end if;

  -- ── 5 · Tanımsız rol reddediliyor ───────────────────────────────────────
  begin
    perform public.set_primary_role(v_hasan,'depocu_abi');
    v_kalan := v_kalan + 1; raise notice '❌ 5 · tanımsız rol kabul edildi';
  exception when sqlstate 'MI400' then v_gecen := v_gecen + 1;
  end;

  -- ── 6 · Başka işletmenin kullanıcısına dokunamıyor ──────────────────────
  begin
    perform public.set_primary_role(v_yabanci,'depo_sorumlusu');
    v_kalan := v_kalan + 1; raise notice '❌ 6 · başka kiracının kullanıcısı değişti';
  exception when sqlstate 'MI403' then v_gecen := v_gecen + 1;
  end;

  -- ── 7 · İşletme sahibi platform rolü VEREMEZ ────────────────────────────
  begin
    perform public.set_primary_role(v_hasan,'admin');
    v_kalan := v_kalan + 1; raise notice '❌ 7 · işletme sahibi admin verdi';
  exception when sqlstate 'MI403' then v_gecen := v_gecen + 1;
  end;
  begin
    perform public.set_primary_role(v_hasan,'super_admin');
    v_kalan := v_kalan + 1; raise notice '❌ 7b · işletme sahibi super_admin verdi';
  exception when sqlstate 'MI403' then v_gecen := v_gecen + 1;
  end;

  -- ── 8 · KENDİ ana görevini değiştiremiyor ───────────────────────────────
  begin
    perform public.set_primary_role(v_sahip,'depo_sorumlusu');
    v_kalan := v_kalan + 1; raise notice '❌ 8 · kendini yetkisiz bıraktı';
  exception when sqlstate 'MI403' then v_gecen := v_gecen + 1;
  end;

  -- ── 9 · SON işletme sahibi görevden alınamıyor ──────────────────────────
  -- İkinci bir sahip yaratıp onun oturumundan ilk sahibi indirmeye çalışıyoruz.
  insert into app_user (tenant_id,auth_user_id,username,username_key,full_name,role_code)
    values (v_t,v_auth_sahip2,'p60sahip2','p60sahip2','Sahip 2','personel')
    returning id into v_sahip2;
  perform public.set_primary_role(v_sahip2,'isletme_sahibi');   -- artık iki sahip var
  perform set_config('request.jwt.claim.sub', v_auth_sahip2::text, true);

  -- İki sahip varken indirme SERBEST
  perform public.set_primary_role(v_sahip,'personel');
  if (select role_code from app_user where id=v_sahip) = 'personel'
  then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 9 · iki sahip varken indirme çalışmadı';
  end if;

  -- Artık tek sahip kaldı (v_sahip2) ve kendini indiremez zaten (kural 8).
  -- Üçüncü bir yöneticiden deneyelim: admin rolü verip onun oturumuyla.
  perform set_config('request.jwt.claim.sub', v_auth_sahip::text, true);
  update app_user set role_code='admin' where id=v_sahip;   -- doğrudan: prova kurulumu
  begin
    perform public.set_primary_role(v_sahip2,'personel');
    v_kalan := v_kalan + 1; raise notice '❌ 10 · SON işletme sahibi görevden alındı';
  exception when sqlstate 'MI403' then v_gecen := v_gecen + 1;
  end;

  -- ── 11 · Aynı rol tekrar yazılınca sessizce geçiyor ─────────────────────
  v_sonuc := public.set_primary_role(v_sahip2,'isletme_sahibi');
  if v_sonuc = 'isletme_sahibi' then v_gecen := v_gecen + 1;
  else v_kalan := v_kalan + 1; raise notice '❌ 11 · aynı rol reddedildi';
  end if;

  raise notice '──────── 0060 provası: % geçti, % kaldı', v_gecen, v_kalan;
  if v_kalan > 0 then raise exception '0060 provası KALDI (% hata)', v_kalan; end if;
end $$;
rollback;
