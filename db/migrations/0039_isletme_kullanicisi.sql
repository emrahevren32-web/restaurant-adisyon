-- ═══════════════════════════════════════════════════════════════════════════
-- 0039 — Onaylanan işletmeye GİRİŞ HESABI (A4D madde 4-6)
--
-- ── BUGÜNE KADAR NEREDEYDİK ──────────────────────────────────────────────
-- 0035 onayı: kiracı + firma + merkez şube açıyor, GİRİŞ HESABI AÇMIYOR.
-- Onay kartında bunu açıkça yazıyorduk: "Müşteri şu an giriş yapamaz."
-- Bu göç o cümleyi kaldırılabilir hâle getiriyor.
--
-- ── NEDEN İKİ PARÇA ──────────────────────────────────────────────────────
-- Supabase Auth'ta kullanıcı yaratmak `service_role` anahtarı ister. O
-- anahtar TARAYICIYA ASLA İNMEZ — inseydi, sayfanın kaynağını görebilen
-- herkes veritabanının tamamına sahip olurdu. Bu yüzden iş ikiye bölündü:
--
--   1. Edge Function (`isletme-hesabi-ac`) — Supabase sunucusunda çalışır,
--      anahtarı orada durur. Yaptığı tek şey: çağıranın yetkisini sorar,
--      Auth'ta davet açar, dönen kimliği aşağıdaki fonksiyona verir.
--   2. Bu göçteki `app.isletme_kullanicisi_ac` — kalan HER ŞEYİ tek
--      işlemde yapar: app_user, rol, şube erişimi, başvuru damgası.
--
-- Bölünme keyfi değil: veritabanı işini SQL'de tutmak, onu provada
-- sınayabilmemi sağlıyor. Edge Function'ın içinde kalsaydı, ilk kez
-- canlıda çalışırdı.
--
-- ── E-POSTA KONUSUNDA DÜRÜST SINIR ───────────────────────────────────────
-- Davet e-postasını Supabase'in yerleşik servisi gönderir. Free planda bu
-- servis SAATTE BİRKAÇ E-POSTAYLA SINIRLIDIR ve gönderen adres Supabase'e
-- aittir. Prova için yeter; gerçek müşteriye toplu davet için yetmez.
-- Kendi SMTP'mize geçmek A5'in (Hetzner) işi. Bu göç o günü beklemiyor:
-- hesap açılır, davet gönderilemezse bile hesap ve bağlantı kurulur, ekran
-- durumu söyler.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · İzin sorusu tarayıcıdan da sorulabilsin ──────────────────────────
-- PostgREST yalnız `public` şemasını yayınlar. Edge Function, çağıranın
-- yetkisini onun JWT'siyle sormak zorunda; o yüzden kabuk gerekiyor.
create or replace function public.yetkim_var(p_izin text)
returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select app.yetkim_var(p_izin);
$$;

comment on function public.yetkim_var(text) is
  'app.yetkim_var''ın dışa açık kabuğu. Oturumdaki kullanıcının verilen '
  'izni var mı? Yalnız OKUR, hiçbir şey değiştirmez.';

revoke all on function public.yetkim_var(text) from public, anon;
grant execute on function public.yetkim_var(text) to authenticated, service_role;

-- ── 2 · Başvuruda davetin izi ────────────────────────────────────────────
alter table business_application add column if not exists invited_at    timestamptz;
alter table business_application add column if not exists owner_user_id uuid references app_user(id) on delete set null;

comment on column business_application.invited_at is
  'Giriş hesabı açılıp davet gönderildiği an. Boşsa hesap henüz yok.';
comment on column business_application.owner_user_id is
  'Onay sonrası açılan işletme sahibi hesabı. Ekran "kime gönderildi"yi buradan okur.';

-- Platform yetkilisi bu iki kolonu da güncelleyebilmeli (0032 dar GRANT verdi).
grant update (invited_at, owner_user_id) on business_application to authenticated;

-- ── 3 · Kullanıcı adını e-postadan türet ─────────────────────────────────
-- 'turgut@tavukcu.com' → 'turgut'. Çakışırsa 'turgut2', 'turgut3'...
-- Kiracı içinde tekil olmak zorunda (app_user_username_unique).
create or replace function app.kullanici_adi_uret(p_kiraci uuid, p_eposta text)
returns text
language plpgsql stable set search_path = public, app as $$
declare
  v_kok text;
  v_aday text;
  i int := 1;
begin
  -- @ öncesi, ASCII küçük harf ve rakam dışındaki her şey atılır.
  v_kok := lower(split_part(btrim(p_eposta), '@', 1));
  v_kok := translate(v_kok, 'çğıöşüÇĞİÖŞÜ', 'cgiosucgiosu');
  v_kok := regexp_replace(v_kok, '[^a-z0-9]', '', 'g');
  if length(v_kok) < 2 then v_kok := 'kullanici'; end if;
  v_kok := left(v_kok, 40);

  v_aday := v_kok;
  while exists (select 1 from app_user u
                 where u.tenant_id = p_kiraci and u.username_key = v_aday) loop
    i := i + 1;
    v_aday := v_kok || i::text;
    if i > 999 then
      raise exception 'Kullanici adi uretilemedi: % icin 999 deneme yetmedi.', p_eposta
        using errcode = 'MI500';
    end if;
  end loop;

  return v_aday;
end $$;

-- ── 4 · Hesabı kur ───────────────────────────────────────────────────────
-- Auth tarafındaki kimlik (p_auth_user_id) DIŞARIDAN gelir; onu Edge
-- Function yaratır. Buradan sonrası tek işlem: ya hepsi olur, ya hiçbiri.
create or replace function app.isletme_kullanicisi_ac(
  p_basvuru_id   uuid,
  p_auth_user_id uuid
)
returns table (
  kullanici_id uuid,
  kullanici_adi text,
  eposta text,
  kiraci_kodu text
)
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_b      record;
  v_sube   uuid;
  v_ad     text;
  v_kid    uuid;
begin
  select a.id, a.status, a.tenant_id, a.email, a.owner_name, a.owner_user_id,
         t.code as kiraci_kodu, c.id as firma_id
    into v_b
    from business_application a
    join tenant  t on t.id = a.tenant_id
    join company c on c.tenant_id = a.tenant_id
   where a.id = p_basvuru_id;

  if v_b.id is null then
    raise exception 'Başvuru bulunamadı.' using errcode = 'MI404';
  end if;
  if v_b.status <> 'APPROVED' then
    raise exception 'Giriş hesabı yalnız onaylanmış başvuru için açılır (şu an: %).',
      v_b.status using errcode = 'MI400';
  end if;
  -- ⚠️ İKİNCİ ÇAĞRI YENİ HESAP AÇMAZ. Edge Function ağ hatasında yeniden
  -- denenebilir; o yüzden bu fonksiyon tekrar edilebilir olmak zorunda.
  if v_b.owner_user_id is not null then
    raise exception 'Bu işletmenin giriş hesabı zaten açılmış.' using errcode = 'MI409';
  end if;
  if p_auth_user_id is null then
    raise exception 'Auth kimliği gelmedi.' using errcode = 'MI400';
  end if;

  -- Aynı Auth kimliği başka bir app_user'a bağlıysa dur: bir kişi iki
  -- işletmenin sahibi olarak yazılırsa hangi kiracıya gireceği belirsizleşir.
  if exists (select 1 from app_user where auth_user_id = p_auth_user_id) then
    raise exception 'Bu e-posta başka bir hesaba bağlı. Önce o hesaba bakın.'
      using errcode = 'MI409';
  end if;

  select b.id into v_sube
    from branch b
   where b.tenant_id = v_b.tenant_id and b.is_head_office
   order by b.created_at
   limit 1;
  if v_sube is null then
    raise exception 'Merkez şube bulunamadı; işletme eksik kurulmuş.' using errcode = 'MI500';
  end if;

  v_ad := app.kullanici_adi_uret(v_b.tenant_id, v_b.email);

  insert into app_user (
    tenant_id, company_id, auth_user_id,
    username, username_key, full_name, role_code, is_active
  ) values (
    v_b.tenant_id, v_b.firma_id, p_auth_user_id,
    v_ad, v_ad, v_b.owner_name, 'isletme_sahibi', true
  ) returning id into v_kid;

  -- ⚠️ İKİ YER: `app_user.role_code` birincil rol, `user_role` ek roller.
  -- 0036'nın dersi: etkin izin ikisinin BİRLEŞİMİ. Aynı rolü ikisine de
  -- yazıyoruz ki rol ekranı da bu kullanıcıyı doğru göstersin.
  insert into user_role (tenant_id, user_id, role_code)
  values (v_b.tenant_id, v_kid, 'isletme_sahibi')
  on conflict (user_id, role_code) do nothing;

  insert into user_branch_access (tenant_id, user_id, branch_id)
  values (v_b.tenant_id, v_kid, v_sube)
  on conflict (user_id, branch_id) do nothing;

  update business_application
     set owner_user_id = v_kid,
         invited_at    = now(),
         updated_at    = now()
   where id = p_basvuru_id;

  return query select v_kid, v_ad, v_b.email, v_b.kiraci_kodu;
end $$;

comment on function app.isletme_kullanicisi_ac(uuid, uuid) is
  'Onaylanmış başvuruya giriş hesabı bağlar: app_user + user_role + '
  'şube erişimi + başvuru damgası, tek işlemde. Supabase Auth kullanıcısını '
  'YARATMAZ — onu Edge Function yaratır ve kimliğini buraya verir.';

-- ── 5 · Dışa açık kabuk ──────────────────────────────────────────────────
-- ⚠️ DÖRDÜNCÜ KEZ AYNI TUZAK. PostgREST YALNIZ `public` şemasını yayınlar;
-- Supabase'in varsayılan ayarı `public, graphql_public`. Edge Function
-- `app` şemasını çağırsaydı şunu alırdı:
--     "The schema must be one of the following: public, graphql_public"
-- 0012→0016, 0033→0034 ve 0038 aynı dersin tekrarıydı. Kabuk bu kez
-- fonksiyonla AYNI GÖÇTE yazılıyor.
create or replace function public.isletme_kullanicisi_ac(
  p_basvuru_id   uuid,
  p_auth_user_id uuid
)
returns table (
  kullanici_id uuid,
  kullanici_adi text,
  eposta text,
  kiraci_kodu text
)
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  return query select * from app.isletme_kullanicisi_ac(p_basvuru_id, p_auth_user_id);
end $$;

comment on function public.isletme_kullanicisi_ac(uuid, uuid) is
  'Edge Function''ın çağırdığı kapı. YALNIZ service_role çağırabilir: '
  'Auth kimliği dışarıdan geldiği için, tarayıcıya açık olsaydı yetkisiz '
  'biri uydurduğu bir kimliği işletmeye bağlayabilirdi.';

-- Yalnız `service_role`, yani yalnız Edge Function.
revoke all on function app.isletme_kullanicisi_ac(uuid, uuid) from public, anon, authenticated;
grant execute on function app.isletme_kullanicisi_ac(uuid, uuid) to service_role;

revoke all on function public.isletme_kullanicisi_ac(uuid, uuid) from public, anon, authenticated;
grant execute on function public.isletme_kullanicisi_ac(uuid, uuid) to service_role;

notify pgrst, 'reload schema';

-- ── Doğrulama ────────────────────────────────────────────────────────────
do $$
declare
  v_kok text;
begin
  -- Kullanıcı adı türetimi
  if app.kullanici_adi_uret(gen_random_uuid(), 'Turgut.Özer+etiket@tavukcu.com') <> 'turgutozeretiket' then
    raise exception 'Kullanici adi uretimi beklenmedik: %',
      app.kullanici_adi_uret(gen_random_uuid(), 'Turgut.Özer+etiket@tavukcu.com');
  end if;
  if app.kullanici_adi_uret(gen_random_uuid(), '__@x.com') <> 'kullanici' then
    raise exception 'Bos koke dusen e-postada varsayilan ad uretilmedi.';
  end if;
  raise notice 'Kullanici adi uretimi calisiyor.';
end $$;

-- Onaylanmamış başvuruda hesap açılmamalı.
do $$
declare
  v_id  uuid;
  v_red boolean := false;
begin
  select id into v_id from business_application where status <> 'APPROVED' limit 1;
  if v_id is null then
    raise notice 'Onaysiz basvuru yok; bu kontrol atlandi.';
  else
    begin
      perform app.isletme_kullanicisi_ac(v_id, gen_random_uuid());
    exception when others then v_red := true;
    end;
    if not v_red then
      raise exception 'Onaysiz basvuruya giris hesabi acildi. Kapi acik kalmis.';
    end if;
    raise notice 'Onaysiz basvuru reddedildi.';
  end if;
end $$;

-- Kapılar doğru yerde mi?
select p.proname as fonksiyon,
       pg_get_userbyid(a.grantee) as yetkili
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
 where n.nspname = 'app' and p.proname = 'isletme_kullanicisi_ac'
 order by 2;

-- Kapı `public` şemasında mı? (Boş dönerse Edge Function'dan çağrılamaz.)
select n.nspname as sema, p.proname as fonksiyon,
       pg_get_function_identity_arguments(p.oid) as imza
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.proname in ('isletme_kullanicisi_ac', 'yetkim_var')
 order by p.proname, n.nspname;

-- Hangi işletmenin hesabı var, hangisinin yok?
select reference as numara, company_name as firma, status as durum,
       case when owner_user_id is null then 'YOK' else 'VAR' end as giris_hesabi,
       invited_at as davet_zamani
from business_application
order by created_at;
