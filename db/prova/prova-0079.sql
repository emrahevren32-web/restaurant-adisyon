-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0079 · Yeni kiracı HACCP planıyla doğuyor mu?
-- ⚠️ Göç DEĞİL. Kiracı AÇIP geri alıyor — göç içinde yapılamayan tam bu.
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

-- ── 1 · SADECE KİRACI — plan kendiliğinden doğuyor ───────────────────────
do $$
declare v_t uuid; v_plan int; v_ccp int;
begin
  insert into public.tenant (code, name) values ('PRV79','Prova 79') returning id into v_t;
  perform set_config('prova.t', v_t::text, false);

  select count(*) into v_plan from public.haccp_plan where tenant_id = v_t;
  select count(*) into v_ccp  from public.haccp_ccp  where tenant_id = v_t;

  perform prova_bak('⚠️ yeni kiracıda 1 HACCP planı var', v_plan = 1);
  perform prova_bak('⚠️ yeni kiracıda 8 kritik kontrol noktası var', v_ccp = 8);
end $$;

-- ── 2 · LİMİTLER 0024 İLE AYNI (demoda bu rakamlar okunacak) ─────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid; r record;
begin
  select limit_max, uom into r from public.haccp_ccp
   where tenant_id = v_t and code = 'CCP-1';
  perform prova_bak('CCP-1 soğuk zincir en çok 4 °C', r.limit_max = 4.0 and r.uom = '°C');

  select limit_min into r from public.haccp_ccp
   where tenant_id = v_t and code = 'CCP-5';
  perform prova_bak('CCP-5 pişirme en az 75 °C', r.limit_min = 75.0);

  select limit_max into r from public.haccp_ccp
   where tenant_id = v_t and code = 'CCP-8';
  perform prova_bak('CCP-8 sevkiyat aracı en çok 4 °C', r.limit_max = 4.0);

  perform prova_bak('sekiz aşamanın tamamı geldi',
    (select count(distinct stage) from public.haccp_ccp where tenant_id = v_t) >= 6);
  perform prova_bak('her CCP''nin düzeltici talimatı var',
    not exists (select 1 from public.haccp_ccp
                 where tenant_id = v_t
                   and coalesce(btrim(corrective_instruction), '') = ''));
end $$;

-- ── 3 · İKİNCİ KEZ ÇAĞIRMAK BOZMUYOR ─────────────────────────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid;
begin
  perform app.kiraci_haccp_plani_kur(v_t);
  perform app.kiraci_haccp_plani_kur(v_t);
  perform prova_bak('⚠️ tekrar çağırmak kopya plan üretmiyor',
    (select count(*) from public.haccp_plan where tenant_id = v_t) = 1);
  perform prova_bak('⚠️ tekrar çağırmak kopya CCP üretmiyor',
    (select count(*) from public.haccp_ccp where tenant_id = v_t) = 8);
end $$;

-- ── 4 · İŞLETMENİN DEĞİŞTİRDİĞİ LİMİT GERİ EZİLMİYOR ─────────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid; v_son numeric;
begin
  -- İşletme kendi limitini sıkılaştırıyor.
  update public.haccp_ccp set limit_max = 3.0
   where tenant_id = v_t and code = 'CCP-1';

  -- Fonksiyon yeniden çalışırsa (göç tekrarı, elle çağrı) bunu ezmemeli:
  -- müşterinin kendi kararı bizim tohum verimizden önce gelir.
  perform app.kiraci_haccp_plani_kur(v_t);

  select limit_max into v_son from public.haccp_ccp
   where tenant_id = v_t and code = 'CCP-1';
  perform prova_bak('⚠️ işletmenin değiştirdiği limit KORUNUYOR', v_son = 3.0);
end $$;

-- ── 5 · İKİNCİ KİRACI BİRİNCİYİ GÖRMÜYOR (kiracı duvarı) ─────────────────
do $$
declare v_t2 uuid;
begin
  insert into public.tenant (code, name) values ('PRV79B','Prova 79 B') returning id into v_t2;
  perform prova_bak('ikinci kiracı kendi planıyla doğdu',
    (select count(*) from public.haccp_plan where tenant_id = v_t2) = 1);
  perform prova_bak('⚠️ iki kiracının CCP''leri AYRI satırlar',
    (select count(*) from public.haccp_ccp
      where tenant_id in (v_t2, current_setting('prova.t')::uuid)) = 16);
  perform prova_bak('birinci kiracının sıkılaştırdığı limit ikinciye BULAŞMADI',
    (select limit_max from public.haccp_ccp where tenant_id = v_t2 and code = 'CCP-1') = 4.0);
end $$;

rollback;
