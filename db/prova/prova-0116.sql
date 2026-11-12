\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0116 · GERİ ARAMA · YENİDEN BEKLEMEYE ALMA ÇAKIŞMASI (MIYOP-109)
--
-- Sorular (GERÇEK UPDATE YOLUYLA: `public.geri_arama_durumu_yaz`):
--   1 · Aynı numaranın başka AÇIK talebi varken eski talep yeniden
--       NEW yapılabiliyor mu?                       → HAYIR · `MI409`
--   2 · Cevap ham indeks adı mı, anlaşılır cümle mi? → CÜMLE + öteki
--       talebin numarası
--   3 · ⚠️ Çakışmada kayıt ve not defteri DEĞİŞTİ mi? → HAYIR
--   4 · Başka açık talep YOKKEN yeniden açma çalışıyor mu? → EVET
--   5 · Öteki talep sonuçlandırılınca eski talep açılabiliyor mu? → EVET
--   6 · Zaten NEW olan talebe NEW yazmak kendisiyle çakışıyor mu? → HAYIR
--   7 · Platform izni olmayan çağıramıyor, anon hiç çağıramıyor mu? → EVET
--
-- ⚠️ 0110'un provası indeksi ham INSERT ile ölçüyordu. Codex'in dediği tam
-- buydu: kullanıcının GERÇEKTEN bastığı yol (durum güncelleme) ölçülmemişti.
--
-- ⚠️ `set local role authenticated` ve `anon` TAKILIYOR (MIYOP-042).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
declare v_ad text := coalesce(p_ad, '(iddia metni NULL uretti)');
begin
  if p_kosul then raise notice '  ✓ %', v_ad;
  else raise exception '  ✗ %', v_ad; end if;
end; $$;

create or replace function prova_oturum(p_auth uuid, p_tenant uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', p_tenant)::text, false);
  perform set_config('app.tenant_id', p_tenant::text, false);
end; $$;

-- ── SAHNE ─────────────────────────────────────────────────────────────────
-- ⚠️ Talepler doğrudan tabloya yazılıyor: `callback_request` hiçbir istemci
-- rolüne açık değil (0106), sahneyi kurmanın başka yolu yok. ÖLÇÜLEN şey
-- sahne değil, durum yazma kapısı — o `authenticated` rolüyle çağrılıyor.
do $$
declare
  v_pt uuid; v_pf uuid; v_kt uuid; v_kf uuid; v_auth uuid;
begin
  select t.id into v_pt from public.tenant t where t.is_platform limit 1;
  if v_pt is null then raise exception 'KURULUM: is_platform kiraci yok'; end if;
  select c.id into v_pf from public.company c where c.tenant_id = v_pt limit 1;

  v_auth := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p116.platform@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (gen_random_uuid(), v_pt, v_pf, v_auth, 'p116platform', 'p116platform',
          'Prova 116 Platform', 'super_admin', true);
  perform set_config('prova.auth.platform', v_auth::text, false);
  perform set_config('prova.pt', v_pt::text, false);

  -- A numarası: eski KAPALI talep + yeni AÇIK talep (çakışma sahnesi)
  insert into public.callback_request
    (reference, full_name, phone, company_name, best_time, consent_at,
     consent_version, status, contact_note, created_at)
  values ('GER-P116-A1','Prova Eski','5321160001','Prova A Ltd','FARKETMEZ', now(),
          'prova','CLOSED','ilk not satiri', now() - interval '3 days');
  insert into public.callback_request
    (reference, full_name, phone, company_name, best_time, consent_at, consent_version)
  values ('GER-P116-A2','Prova Yeni','5321160001','Prova A Ltd','FARKETMEZ', now(), 'prova');

  -- B numarası: yalnız KAPALI talep (meşru yeniden açma)
  insert into public.callback_request
    (reference, full_name, phone, company_name, best_time, consent_at,
     consent_version, status, contact_note, created_at)
  values ('GER-P116-B1','Prova Tek','5321160002','Prova B Ltd','FARKETMEZ', now(),
          'prova','CLOSED','b ilk not', now() - interval '2 days');
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid)
  to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- ── 1-3 · ÇAKIŞMA ────────────────────────────────────────────────────────
set local role authenticated;
select prova_oturum(current_setting('prova.auth.platform')::uuid,
                    current_setting('prova.pt')::uuid);

do $$
declare v_kod text; v_metin text;
begin
  perform prova_bak('sağlama: çağıranın platform.manage izni VAR',
    app.yetkim_var('platform.manage'));
  begin
    perform public.geri_arama_durumu_yaz('GER-P116-A1', 'NEW', 'tekrar arayacagiz');
    v_kod := '00000'; v_metin := '';
  exception when others then v_kod := sqlstate; v_metin := sqlerrm;
  end;
  perform prova_bak('⚠️ başka açık talep varken yeniden beklemeye alma REDDEDİLDİ ('||v_kod||')',
    v_kod = 'MI409');
  perform prova_bak('⚠️ cevapta HAM İNDEKS ADI yok', v_metin !~ 'callback_request_acik_talep_tekil'
    and v_metin !~ 'duplicate key');
  perform prova_bak('cevap öteki talebin numarasını söylüyor: '||v_metin,
    v_metin ~ 'GER-P116-A2');
end $$;

reset role;

do $$
declare v_durum text; v_not text; v_durum2 text;
begin
  select status, contact_note into v_durum, v_not
    from public.callback_request where reference = 'GER-P116-A1';
  select status into v_durum2 from public.callback_request where reference = 'GER-P116-A2';
  perform prova_bak('⚠️ çakışmadan sonra eski talep hâlâ CLOSED — bulunan: '||v_durum,
    v_durum = 'CLOSED');
  perform prova_bak('⚠️ çakışmadan sonra not defteri DEĞİŞMEDİ — bulunan: '||v_not,
    v_not = 'ilk not satiri');
  perform prova_bak('öteki talep hâlâ NEW', v_durum2 = 'NEW');
end $$;

-- ── 4-6 · MEŞRU YOLLAR ───────────────────────────────────────────────────
set local role authenticated;
select prova_oturum(current_setting('prova.auth.platform')::uuid,
                    current_setting('prova.pt')::uuid);

do $$
begin
  perform public.geri_arama_durumu_yaz('GER-P116-B1', 'NEW', 'tekrar aranacak');
  perform public.geri_arama_durumu_yaz('GER-P116-B1', 'NEW', 'ikinci kez NEW');
  perform public.geri_arama_durumu_yaz('GER-P116-A2', 'CONTACTED', 'arandi');
  perform public.geri_arama_durumu_yaz('GER-P116-A1', 'NEW', 'simdi acilabilir');
end $$;

reset role;

do $$
declare v_b text; v_bnot text; v_a1 text; v_a2 text;
begin
  select status, contact_note into v_b, v_bnot
    from public.callback_request where reference = 'GER-P116-B1';
  select status into v_a1 from public.callback_request where reference = 'GER-P116-A1';
  select status into v_a2 from public.callback_request where reference = 'GER-P116-A2';
  perform prova_bak('başka açık talep YOKKEN yeniden açma ÇALIŞTI — B1: '||v_b, v_b = 'NEW');
  perform prova_bak('zaten NEW olan talebe NEW yazmak kendisiyle ÇAKIŞMADI '
    ||'(not üç satır: ilk + iki yeni)',
    array_length(string_to_array(v_bnot, E'\n'), 1) = 3);
  perform prova_bak('öteki talep sonuçlanınca (CONTACTED) eski talep AÇILDI — A1: '||v_a1,
    v_a1 = 'NEW' and v_a2 = 'CONTACTED');
  perform prova_bak('⚠️ veritabanında aynı numarada çift açık talep YOK',
    not exists (select 1 from public.callback_request where status = 'NEW'
                 group by phone having count(*) > 1));
end $$;

-- ── 7 · KAPI DÜŞMEDİ ─────────────────────────────────────────────────────
set local role anon;
do $$
declare v_kod text;
begin
  begin
    perform public.geri_arama_durumu_yaz('GER-P116-B1', 'CLOSED', 'ziyaretci');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ anon durum YAZAMIYOR ('||v_kod||')', v_kod = '42501');
end $$;
reset role;

do $$ begin raise notice '──── 0116 provası: TAMAM'; end $$;
rollback;
