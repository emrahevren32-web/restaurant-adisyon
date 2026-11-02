-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0104 · DENETİM DEFTERİ DOĞRU SATIRI YAZIYOR MU?
--
-- Soru: `id` kolonu olmayan bir tabloda bir alan değişince, defterde
-- **hangi satırın** değiştiği yazıyor mu?
--
-- ⚠️ Bu provanın asıl ölçümü YAPISAL DEĞİL DAVRANIŞSALDIR: gerçekten yazıp
-- `audit_log`a bakıyoruz. Göçün kendi doğrulaması fonksiyonun varlığını
-- ölçüyor; bu dosya SONUCU ölçüyor. 0103'te yapısal ölçümlerin hepsi yeşilken
-- denetim kaydını GERÇEKTEN arayan ölçüm kırmızı vermişti (tuzak 149).
--
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
declare
  v_t uuid; v_f uuid; v_b uuid := gen_random_uuid();
  v_urun uuid := gen_random_uuid();
  v_auth uuid := gen_random_uuid(); v_app uuid := gen_random_uuid();
begin
  -- ⚠️ MIYOP-090 (Codex, 01.11) · DENETİM DEFTERİ APPEND-ONLY'DİR.
  -- Buradaki iddialar `audit_log`un TAMAMINA bakıyordu. Gerçek bir
  -- veritabanında 0104 ÖNCESİNDEN kalma `row_id = '?'` satırları DURUYOR ve
  -- hiçbir zaman silinmeyecek — o yüzden *"hiçbir '?' kalmadı"* iddiası,
  -- onarım mükemmel çalışsa bile kırmızı verir. ÖLÇÜLDÜ (02.11): dört eski
  -- '?' satırı eklenince prova, önceki yedi ölçümün hepsi yeşilken bu
  -- satırda kırıldı.
  -- Çözüm: provanın BAŞLADIĞI andaki en büyük `id` bir su seviyesi olarak
  -- saklanıyor; bütün defter iddiaları yalnız ONDAN SONRAKİ satırlara
  -- bakıyor. Yani "bu prova sırasında yazılanlar" ölçülüyor, "tarihin
  -- tamamı" değil.
  perform set_config('prova.denetim_basi',
    coalesce((select max(id) from public.audit_log), 0)::text, false);

  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;

  insert into public.branch (id, tenant_id, company_id, code, name)
  values (v_b, v_t, v_f, 'P104', 'Prova Şube');

  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_urun, v_t, v_b, 'P104-URUN', 'p104urun', 'Prova Ürünü', 'kg');

  insert into auth.users (id, email) values (v_auth, 'p104@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_app, v_t, v_f, v_auth, 'p104kisi', 'p104kisi', 'Prova Kişi',
          'isletme_sahibi', true);

  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.f', v_f::text, false);
  perform set_config('prova.b', v_b::text, false);
  perform set_config('prova.urun', v_urun::text, false);
  perform set_config('prova.app', v_app::text, false);
  raise notice 'KURULUM TAMAM';
end $$;

-- ── 1 · YAPI ──────────────────────────────────────────────────────────────
do $$
begin
  raise notice '── 1 · YAPI';
  perform prova_bak('satır kimliği fonksiyonu var',
    to_regprocedure('app.denetim_satir_kimligi(oid, jsonb)') is not null);
  perform prova_bak('⚠️ denetim_yaz artık onu kullanıyor',
    (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app' and p.proname = 'denetim_yaz')
      like '%denetim_satir_kimligi(tg_relid%');
  perform prova_bak('company zaman damgası BEFORE UPDATE',
    exists (select 1 from pg_trigger
             where tgrelid = 'public.company'::regclass and not tgisinternal
               and tgname = 'company_zaman_damgasi'
               and tgtype & 2 = 2 and tgtype & 16 = 16));
  perform prova_bak('⚠️ `id` kolonu olmayan denetimli tablo sayısı hâlâ DÖRT',
    (select count(*) from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and exists (select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
                     where t.tgrelid = c.oid and not t.tgisinternal
                       and p.proname = 'denetim_yaz')
        and not exists (select 1 from pg_attribute a
                         where a.attrelid = c.oid and a.attname = 'id'
                           and a.attnum > 0 and not a.attisdropped)) = 4);
end $$;

-- ── 2 · BESİN DEĞERİ · MIYOP-083'ÜN EN KÖTÜ HÂLİ ──────────────────────────
-- ⚠️ Codex'in notu: yalnız yağ miktarı değişirse `stock_item_id` FARKA DA
-- girmiyor. Yani eskiden defterde ne satır kimliği vardı, ne de ürün.
do $$
declare v_urun uuid := current_setting('prova.urun')::uuid;
        v_t uuid := current_setting('prova.t')::uuid;
        v_satir text; v_fark jsonb;
begin
  raise notice '── 2 · BESİN DEĞERİ (yalnız yağ değişiyor)';

  insert into public.stock_item_nutrition (tenant_id, stock_item_id, fat)
  values (v_t, v_urun, 10);

  update public.stock_item_nutrition set fat = 12 where stock_item_id = v_urun;

  select row_id, changes into v_satir, v_fark from public.audit_log
   where table_name = 'stock_item_nutrition' and action = 'UPDATE'
     and id > current_setting('prova.denetim_basi')::bigint
   order by id desc limit 1;

  perform prova_bak('güncelleme denetime düştü', v_satir is not null);
  perform prova_bak('⚠️ satır kimliği ''?'' DEĞİL (gelen: ' || coalesce(v_satir,'null') || ')',
    v_satir is distinct from '?');
  perform prova_bak('⚠️ ve kimlik ÜRÜN KARTINI taşıyor',
    v_satir like '%stock_item_id=' || v_urun::text || '%');
  -- Codex'in asıl noktası: fark yalnız yağı içeriyor, ürünü içermiyor.
  perform prova_bak('fark yalnız değişen alanı taşıyor (ürünü DEĞİL)',
    v_fark ? 'fat' and not (v_fark ? 'stock_item_id'));
  perform prova_bak('⚠️ yani ürün bilgisi SADECE satır kimliğinden geliyor',
    v_satir like '%' || v_urun::text || '%');
end $$;

-- ── 3 · ÖTEKİ ÜÇ TABLO ────────────────────────────────────────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid;
        v_urun uuid := current_setting('prova.urun')::uuid;
        v_app uuid := current_setting('prova.app')::uuid;
        v_b uuid := current_setting('prova.b')::uuid;
        v_satir text;
begin
  raise notice '── 3 · ALERJEN · ŞUBE ERİŞİMİ · EK ROL';

  insert into public.stock_item_allergen (tenant_id, stock_item_id, allergen_code)
  values (v_t, v_urun, 'GLUTEN');
  select row_id into v_satir from public.audit_log
   where table_name = 'stock_item_allergen'
     and id > current_setting('prova.denetim_basi')::bigint
   order by id desc limit 1;
  perform prova_bak('alerjen: kimlik ürün + alerjen taşıyor (' || coalesce(v_satir,'null') || ')',
    v_satir like '%stock_item_id=%' and v_satir like '%allergen_code=GLUTEN%');

  insert into public.user_branch_access (tenant_id, user_id, branch_id)
  values (v_t, v_app, v_b);
  select row_id into v_satir from public.audit_log
   where table_name = 'user_branch_access'
     and id > current_setting('prova.denetim_basi')::bigint
   order by id desc limit 1;
  perform prova_bak('şube erişimi: kimlik kullanıcı + şube taşıyor',
    v_satir like '%user_id=%' and v_satir like '%branch_id=%');

  insert into public.user_role (tenant_id, user_id, role_code)
  values (v_t, v_app, 'depo_sorumlusu');
  select row_id into v_satir from public.audit_log
   where table_name = 'user_role'
     and id > current_setting('prova.denetim_basi')::bigint
   order by id desc limit 1;
  perform prova_bak('ek rol: kimlik kullanıcı + rol taşıyor',
    v_satir like '%user_id=%' and v_satir like '%role_code=depo_sorumlusu%');

  -- ⚠️ YALNIZ BU PROVA SIRASINDA yazılanlara bakılıyor (MIYOP-090).
  -- Defter append-only: 0104 öncesinden kalma '?' satırları silinmez ve
  -- onları saymak, onarımı bozuk göstermekten başka işe yaramaz.
  perform prova_bak('⚠️ bu prova sırasında HİÇBİR ''?'' satırı yazılmadı',
    not exists (select 1 from public.audit_log
                 where row_id = '?'
                   and id > current_setting('prova.denetim_basi')::bigint));
end $$;

-- ── 4 · GERİLEME YOK · `id` olan tablo ESKİSİ GİBİ ────────────────────────
-- ⚠️ Onarım, çalışan şeyi bozmamalı: `id` varsa kimlik hâlâ o `id`dir,
-- birincil anahtar dizgesi DEĞİL.
do $$
declare v_t uuid := current_setting('prova.t')::uuid;
        v_urun uuid := current_setting('prova.urun')::uuid; v_satir text;
begin
  raise notice '── 4 · GERİLEME YOK';
  update public.stock_item set name = 'Prova Ürünü 2' where id = v_urun;
  select row_id into v_satir from public.audit_log
   where table_name = 'stock_item' and action = 'UPDATE'
     and id > current_setting('prova.denetim_basi')::bigint
   order by id desc limit 1;
  perform prova_bak('`id` olan tabloda kimlik hâlâ ''id''nin kendisi',
    v_satir = v_urun::text);
  perform prova_bak('kimlik birincil anahtar dizgesine DÖNMEDİ',
    v_satir not like '%=%');
end $$;

-- ── 5 · MIYOP-085 · "SON KAYIT" İSTEMCİDEN GELEMEZ ────────────────────────
do $$
declare v_f uuid := current_setting('prova.f')::uuid; v_zaman timestamptz;
begin
  raise notice '── 5 · company.updated_at SUNUCUDA';

  -- İstemci bile bile yalan söylüyor.
  update public.company
     set company_name = 'Prova Firma', updated_at = timestamptz '2020-01-01 00:00:00+00'
   where id = v_f;

  select updated_at into v_zaman from public.company where id = v_f;
  perform prova_bak('⚠️ istemcinin yazdığı 2020 tarihi YOK SAYILDI (' || v_zaman || ')',
    v_zaman > now() - interval '1 minute');
end $$;

rollback;
