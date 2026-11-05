-- ═══════════════════════════════════════════════════════════════════════════
-- TERS PROVA · 0104 · "düzelttiğim şey gerçekten bozuk muydu?"
--
-- prova-0104.sql, 0104'ten SONRA defterin doğru satırı yazdığını ölçer.
-- Bu dosya ÖNCESİNİ ölçer: aynı dört tabloya aynı yazmalar yapılır, ama
-- `app.denetim_yaz()` 0104'ten önceki hâline geri çevrilir.
--
-- Geri çevirme uydurma DEĞİL: canlı tanımı `pg_get_functiondef` ile alıp
-- 0104'ün eklediği TEK satırı metinden çıkarıyoruz. Yani ölçtüğümüz şey
-- gerçekten "0104 olmasa ne olurdu".
--
-- `begin ... rollback` — veritabanı kirlenmez, fonksiyon geri döner.
-- ═══════════════════════════════════════════════════════════════════════════
begin;

set local role postgres;

create or replace function prova_bak(p_ad text, p_dogru boolean)
returns void language plpgsql as $$
begin
  if p_dogru then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

-- ── 0104'ü metinden geri al ───────────────────────────────────────────────
do $$
declare v_tanim text; v_yeni text;
begin
  v_tanim := pg_get_functiondef('app.denetim_yaz()'::regprocedure);

  if position('app.denetim_satir_kimligi' in v_tanim) = 0 then
    raise exception 'Bu veritabanında 0104 uygulanmamış — ters provanın ölçecek şeyi yok.';
  end if;

  -- 0104'ün eklediği satırı çıkar: kimlik çağrısı gider, coalesce '?' ile kalır.
  v_yeni := replace(
    v_tanim,
    'app.denetim_satir_kimligi(tg_relid, coalesce(v_yeni, v_eski)),',
    '');

  if v_yeni = v_tanim then
    raise exception 'Çıkarılacak satır metinde bulunamadı — ters prova güvenilmez.';
  end if;

  execute v_yeni;
  raise notice 'DENETİM YAZICISI 0104 ÖNCESİNE ÇEVRİLDİ';
end $$;

do $$
begin
  perform prova_bak('⚠️ geri çevirme tuttu (kimlik çağrısı artık yok)',
    position('app.denetim_satir_kimligi' in
      pg_get_functiondef('app.denetim_yaz()'::regprocedure)) = 0);
end $$;

-- ── kurulum: prova-0104.sql ile AYNI ──────────────────────────────────────
do $$
declare
  v_t uuid; v_f uuid; v_b uuid := gen_random_uuid();
  v_urun uuid := gen_random_uuid();
  v_auth uuid := gen_random_uuid(); v_app uuid := gen_random_uuid();
begin
  -- ⚠️ MIYOP-090 · SU SEVİYESİ. Defter append-only; bu provanın iddiaları
  -- yalnız BURADAN SONRA yazılan satırlara bakmalı (sebebi aşağıda, 3.
  -- bölümdeki sayımın yanında).
  perform set_config('prova.denetim_basi',
    coalesce((select max(id) from public.audit_log), 0)::text, false);

  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;

  insert into public.branch (id, tenant_id, company_id, code, name)
  values (v_b, v_t, v_f, 'T104', 'Ters Sube');

  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_urun, v_t, v_b, 'T104-URUN', 't104urun', 'Ters Urunu', 'kg');

  insert into auth.users (id, email) values (v_auth, 't104@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_app, v_t, v_f, v_auth, 't104kisi', 't104kisi', 'Ters Kisi',
          'isletme_sahibi', true);

  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.f', v_f::text, false);
  perform set_config('prova.b', v_b::text, false);
  perform set_config('prova.urun', v_urun::text, false);
  perform set_config('prova.app', v_app::text, false);
  raise notice 'KURULUM TAMAM';
end $$;

-- ── ÖLÇÜM: eski yazıcı ne yazıyordu ───────────────────────────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid;
        v_urun uuid := current_setting('prova.urun')::uuid;
        v_app uuid := current_setting('prova.app')::uuid;
        v_b uuid := current_setting('prova.b')::uuid;
        v_satir text; v_fark jsonb; v_soru int; v_tablo int;
begin
  raise notice '── 0104 ÖNCESİ · defter ne yazıyordu';

  insert into public.stock_item_nutrition (tenant_id, stock_item_id, fat)
  values (v_t, v_urun, 10);
  update public.stock_item_nutrition set fat = 12 where stock_item_id = v_urun;

  -- ⚠️ MIYOP-090 (Codex, 04.11.2026) · BU SELECT DE KAPSAMSIZDI. Defter
  -- append-only ve kiracılar aynı tabloyu paylaşıyor; su seviyesi ve kiracı
  -- süzgeci olmadan bu sorgu BAŞKA bir kiracının ya da 0104 öncesinden
  -- kalma bir satırını okuyup iddiayı onun üstüne kurabilirdi.
  select row_id, changes into v_satir, v_fark from public.audit_log
   where tenant_id = v_t
     and id > current_setting('prova.denetim_basi')::bigint
     and table_name = 'stock_item_nutrition' and action = 'UPDATE'
   order by id desc limit 1;

  perform prova_bak('güncelleme denetime düştü (defter çalışıyordu)', v_satir is not null);
  perform prova_bak('⚠️ ama satır kimliği ''?'' idi (gelen: ' || coalesce(v_satir,'null') || ')',
    v_satir = '?');
  perform prova_bak('⚠️ ve fark da ürünü taşımıyordu — kayıt kime ait, belli değil',
    not (v_fark ? 'stock_item_id'));

  insert into public.stock_item_allergen (tenant_id, stock_item_id, allergen_code)
  values (v_t, v_urun, 'GLUTEN');
  insert into public.user_branch_access (tenant_id, user_id, branch_id)
  values (v_t, v_app, v_b);
  insert into public.user_role (tenant_id, user_id, role_code)
  values (v_t, v_app, 'depo_sorumlusu');

  -- ⚠️ ÖLÇÜLDÜ · 30.10.2026 — burada önce "DÖRT satır" yazmıştım, yanlıştı:
  -- besin değeri tablosuna hem INSERT hem UPDATE düşüyor, yani satır sayısı
  -- BEŞ. Doğru ölçü satır değil TABLO sayısı: dört tablonun hepsi kör.
  --
  -- ⚠️ MIYOP-090 (Codex) · VE BURASI DAHA SİNSİYDİ. Sayım kiracının BÜTÜN
  -- geçmişine bakıyordu. Gerçek bir veritabanında 0104 öncesinden kalma
  -- '?' satırları duruyor ve ÖLÇÜLDÜ (02.11): dört eski satır eklendiğinde
  -- `count(distinct table_name)` daha prova hiçbir şey yazmadan **4**
  -- oluyor. Yani ters prova, 0104'ün geri alınması hiçbir şey yazmasa bile
  -- YANLIŞ YEŞİL verebilirdi — ileri provanın anlamlı olduğunu kanıtlaması
  -- gereken dosya, kendisi kanıtsız kalıyordu.
  select count(*), count(distinct table_name) into v_soru, v_tablo
    from public.audit_log
   where tenant_id = v_t and row_id = '?'
     and id > current_setting('prova.denetim_basi')::bigint;

  perform prova_bak('⚠️ ''?'' satırı yazan tablo sayısı DÖRT (satır: ' || v_soru
    || ' · tablo: ' || v_tablo || ')', v_tablo = 4);
  perform prova_bak('⚠️ dört tablonun HEPSİ kör — ikisi üçü değil',
    (select count(distinct table_name) from public.audit_log
      where tenant_id = v_t and row_id = '?'
        and id > current_setting('prova.denetim_basi')::bigint
        and table_name in ('stock_item_nutrition', 'stock_item_allergen',
                           'user_branch_access', 'user_role')) = 4);
end $$;

-- ── company.updated_at · 0104 öncesi ──────────────────────────────────────
do $$
declare v_f uuid := current_setting('prova.f')::uuid;
        v_var boolean; v_zaman timestamptz;
begin
  raise notice '── company zaman damgası · 0104 öncesi';
  -- 0104'ün tetikleyicisini kaldır, eski hâli ölç.
  drop trigger if exists company_zaman_damgasi on public.company;

  select exists (
    select 1 from pg_catalog.pg_trigger
     where tgrelid = 'public.company'::regclass
       and tgname = 'company_zaman_damgasi' and not tgisinternal)
    into v_var;
  perform prova_bak('tetikleyici kaldırıldı (eski hâl)', not v_var);

  update public.company
     set company_name = 'Ters Firma', updated_at = timestamptz '2020-01-01 00:00:00+00'
   where id = v_f;

  select updated_at into v_zaman from public.company where id = v_f;

  perform prova_bak('⚠️ istemcinin yazdığı 2020 tarihi DEFTERDE DURUYORDU (gelen: '
    || v_zaman || ')', v_zaman < timestamptz '2021-01-01 00:00:00+00');
end $$;

rollback;
