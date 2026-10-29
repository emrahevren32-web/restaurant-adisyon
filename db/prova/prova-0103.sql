-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0103 · KİRACI AYARLARI
--
-- Soru: işletme kendi KDV oranını ve para birimini seçebiliyor mu, ve bunu
-- SEÇMEMİŞ olmak "belirlenmemiş" diye durabiliyor mu?
--
-- ⚠️ KÖR PROVA DEĞİL (tuzak 139): yetki tablosuna bakmak yetmez. Her rolün
-- altına GİRİLİP gerçekten yazılmaya çalışılıyor.
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

create or replace function prova_oturum(p_auth uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', current_setting('prova.t'))::text, false);
  perform set_config('app.tenant_id', current_setting('prova.t'), false);
end; $$;

-- ── KURULUM: üç rol ───────────────────────────────────────────────────────
do $$
declare v_t uuid; v_f uuid; v_rol text; v_auth uuid; v_app uuid;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);

  foreach v_rol in array array['isletme_sahibi','isletme_muduru','depo_sorumlusu'] loop
    v_auth := gen_random_uuid(); v_app := gen_random_uuid();
    insert into auth.users (id, email) values (v_auth, 'p103.'||v_rol||'@o.local');
    insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                                 username_key, full_name, role_code, is_active)
    values (v_app, v_t, v_f, v_auth, 'p103'||left(md5(v_rol),6),
            'p103'||left(md5(v_rol),6), v_rol, v_rol, true);
    perform set_config('prova.auth.'||v_rol, v_auth::text, false);
    perform set_config('prova.app.'||v_rol,  v_app::text,  false);
  end loop;
  raise notice 'KURULUM TAMAM';
end $$;

-- ── 1 · YAPISAL ───────────────────────────────────────────────────────────
do $$
begin
  raise notice '── 1 · YAPI';
  perform prova_bak('tablo var', to_regclass('public.tenant_settings') is not null);
  perform prova_bak('RLS açık VE zorunlu',
    (select relrowsecurity and relforcerowsecurity
       from pg_class where oid = 'public.tenant_settings'::regclass));

  -- ⚠️ EN ÖNEMLİ ÖLÇÜM. Bu göçün varlık sebebi `vatRate: 10` idi: kimsenin
  -- vermediği bir cevap, verilmiş gibi duruyordu. Buraya bir varsayılan
  -- konursa aynı yalan bir katman aşağıya taşınmış olur.
  perform prova_bak('⚠️ KDV oranının VARSAYILANI YOK (MIYOP-060b)',
    not exists (
      select 1 from pg_attrdef d
      join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
      where d.adrelid = 'public.tenant_settings'::regclass
        and a.attname = 'vat_rate'));

  perform prova_bak('para biriminin varsayılanı VAR (TRY)',
    exists (
      select 1 from pg_attrdef d
      join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
      where d.adrelid = 'public.tenant_settings'::regclass
        and a.attname = 'currency_code'));

  perform prova_bak('her kiracının bir satırı var',
    not exists (select 1 from public.tenant t
                 where not exists (select 1 from public.tenant_settings s
                                    where s.tenant_id = t.id)));
  perform prova_bak('authenticated SİLEMİYOR',
    not has_table_privilege('authenticated', 'public.tenant_settings', 'delete'));
  perform prova_bak('authenticated OKUYABİLİYOR (fiyat gösteren her ekran lazım)',
    has_table_privilege('authenticated', 'public.tenant_settings', 'select'));
end $$;

-- ── 2 · YENİ KİRACI DOĞUNCA SATIR AÇILIYOR ────────────────────────────────
do $$
declare v_yeni uuid := gen_random_uuid();
begin
  raise notice '── 2 · YENİ KİRACI';
  insert into public.tenant (id, code, name)
  values (v_yeni, 'P103YENI', 'Prova Yeni Kiracı');

  perform prova_bak('⚠️ satırı EKRAN değil VERİTABANI açtı',
    exists (select 1 from public.tenant_settings where tenant_id = v_yeni));
  perform prova_bak('yeni kiracıda KDV BELİRLENMEMİŞ (null)',
    (select vat_rate is null from public.tenant_settings where tenant_id = v_yeni));
  perform prova_bak('yeni kiracıda para birimi TRY',
    (select currency_code from public.tenant_settings where tenant_id = v_yeni) = 'TRY');
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid) to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;

-- ── 3 · İŞLETME SAHİBİ SEÇEBİLİYOR ────────────────────────────────────────
select prova_oturum(current_setting('prova.auth.isletme_sahibi')::uuid);

do $$
declare v_kod text; v_t uuid := current_setting('prova.t')::uuid;
begin
  raise notice '── 3 · İŞLETME SAHİBİ (settings.manage VAR)';

  update public.tenant_settings
     set vat_rate = 20.00, currency_code = 'TRY'
   where tenant_id = v_t;
  perform prova_bak('KDV oranını yazabiliyor',
    (select vat_rate from public.tenant_settings where tenant_id = v_t) = 20.00);

  update public.tenant_settings set currency_code = 'EUR' where tenant_id = v_t;
  perform prova_bak('para birimini değiştirebiliyor',
    (select currency_code from public.tenant_settings where tenant_id = v_t) = 'EUR');

  -- ⚠️ Seçmemek de bir seçimdir: alanı geri boşaltabilmeli.
  update public.tenant_settings set vat_rate = null where tenant_id = v_t;
  perform prova_bak('⚠️ KDV''yi tekrar BOŞALTABİLİYOR (belirlenmemiş bir değerdir)',
    (select vat_rate is null from public.tenant_settings where tenant_id = v_t));

  -- Biçim kapıları
  begin
    update public.tenant_settings set currency_code = 'try' where tenant_id = v_t;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('küçük harfli para birimi REDDEDİLDİ ('||v_kod||')', v_kod <> '00000');

  begin
    update public.tenant_settings set vat_rate = 120 where tenant_id = v_t;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('%120 KDV REDDEDİLDİ ('||v_kod||')', v_kod <> '00000');

  begin
    update public.tenant_settings set vat_rate = -1 where tenant_id = v_t;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('negatif KDV REDDEDİLDİ ('||v_kod||')', v_kod <> '00000');

  -- Satır silinemez
  begin
    delete from public.tenant_settings where tenant_id = v_t;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('ayar satırı SİLİNEMİYOR ('||v_kod||')', v_kod <> '00000');
end $$;

-- ── 4 · SUNUCU İMZASI · İSTEMCİNİN YAZDIĞI YOK SAYILIYOR ──────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid;
        v_sahip uuid := current_setting('prova.app.isletme_sahibi')::uuid;
        v_zaman timestamptz;
begin
  raise notice '── 4 · SUNUCU İMZASI';

  -- İstemci bile bile yalan söylüyor: 2020'den bir tarih ve başkasının kimliği.
  update public.tenant_settings
     set vat_rate   = 10.00,
         updated_at = timestamptz '2020-01-01 00:00:00+00',
         updated_by = current_setting('prova.app.depo_sorumlusu')::uuid
   where tenant_id = v_t;

  select updated_at into v_zaman from public.tenant_settings where tenant_id = v_t;
  perform prova_bak('⚠️ istemcinin yazdığı TARİH yok sayıldı ('||v_zaman||')',
    v_zaman > now() - interval '1 minute');
  perform prova_bak('⚠️ istemcinin yazdığı KİŞİ yok sayıldı, gerçek aktör yazıldı',
    (select updated_by from public.tenant_settings where tenant_id = v_t) = v_sahip);
end $$;

-- ── 5 · MÜDÜR DEĞİŞTİREMEZ · KARARIN KENDİSİ ──────────────────────────────
-- ⚠️ "Müdür işi yürütür, işletmenin kimliğini ve vergi düzenini değiştirmez."
select prova_oturum(current_setting('prova.auth.isletme_muduru')::uuid);

do $$
declare v_kod text; v_t uuid := current_setting('prova.t')::uuid;
begin
  raise notice '── 5 · MÜDÜR (settings.manage YOK)';

  perform prova_bak('müdür ayarları OKUYABİLİYOR',
    exists (select 1 from public.tenant_settings where tenant_id = v_t));

  begin
    update public.tenant_settings set vat_rate = 1 where tenant_id = v_t;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ müdür KDV oranını DEĞİŞTİREMİYOR ('||v_kod||')',
    v_kod <> '00000');
end $$;

-- ── 6 · DEPO SORUMLUSU DA DEĞİŞTİREMEZ ────────────────────────────────────
select prova_oturum(current_setting('prova.auth.depo_sorumlusu')::uuid);

do $$
declare v_kod text; v_t uuid := current_setting('prova.t')::uuid;
begin
  raise notice '── 6 · DEPO SORUMLUSU';
  begin
    update public.tenant_settings set currency_code = 'USD' where tenant_id = v_t;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('depo sorumlusu para birimini değiştiremiyor ('||v_kod||')',
    v_kod <> '00000');
end $$;

reset role;

-- ── 7 · DENETİM ───────────────────────────────────────────────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid; v_say int; v_satir uuid;
begin
  raise notice '── 7 · DENETİM';
  -- ⚠️ PROVANIN İLK HÂLİ BURADA KIRMIZI VERDİ VE HAKLIYDI: tablonun `id`
  -- kolonu yoktu, `app.denetim_yaz()` satır kimliğini `new ->> 'id'` ile
  -- okuduğu için `row_id` alanına '?' düşüyordu. Kayıt vardı ama NEYİ
  -- değiştirdiği yazmıyordu. Tabloya `id` kondu. → tuzak 149
  select id into v_satir from public.tenant_settings where tenant_id = v_t;

  select count(*) into v_say from public.audit_log
   where table_name = 'tenant_settings' and row_id = v_satir::text;
  perform prova_bak('ayar değişikliği denetime düştü (satır: '||v_say||')', v_say >= 1);
  perform prova_bak('⚠️ denetim kaydı satırı ADIYLA yazdı ('''||'?'||''' değil)',
    not exists (select 1 from public.audit_log
                 where table_name = 'tenant_settings' and row_id = '?'));
  perform prova_bak('denetim kaydında aktör yazılı',
    exists (select 1 from public.audit_log
             where table_name = 'tenant_settings' and row_id = v_satir::text
               and actor_user_id is not null));
end $$;

rollback;
