-- ═══════════════════════════════════════════════════════════════════════════
-- 0081 · YETKİ KAPILARI VERİTABANINDA + `quality.write` AYRIMI
-- ---------------------------------------------------------------------------
-- ── NEDEN ─────────────────────────────────────────────────────────────────
-- 14.10.2026'da Codex denetimi şunu kanıtladı: dört yazma kapısının üçü
-- YALNIZCA ARAYÜZDE duruyordu.
--
--   Reçeteler   (`recipe.write`)        → tek savunma React'teki `if`
--   HACCP       (`quality.write`)       → tek savunma React'teki `if`
--   Sevkiyatlar (`logistics.write`)     → tek savunma React'teki `if`
--   Etiketler   (`quality.declaration`) → alerjen ve besin KORUNUYOR (0072/0073)
--                                         ama AMBALAJ alanı açık kalmış
--
-- RLS yalnız KİRACI eşitliğine bakıyor; `authenticated` rolünün bu tablolara
-- INSERT/UPDATE yetkisi var. Yani izni olmayan bir kullanıcı, tarayıcı
-- konsolundan repository'yi doğrudan çağırarak yazabiliyordu.
--
-- ⚠️ ARAYÜZDEKİ KAPI BİR KAPI DEĞİL, BİR NEZAKETTİR. Düğmeyi gizlemek
-- kullanıcıya "bu senin işin değil" demektir; yazmayı ENGELLEMEK başka bir
-- şeydir. HACCP imzasının bütün anlamı, kaydı yazanın gerçekten o kişi
-- olmasıdır — bunu React'teki bir `if` taşıyamaz.
--
-- ── `quality.write` AYRIMI — karar ve gerekçesi ───────────────────────────
-- 0068 bu ayrımı erteleyerek açıkça şunu yazmıştı: *"İlerisi için doğrusu
-- `quality.write`'ı ikiye ayırmaktır (ölçüm girme / kayıt düzeltme). Bugün
-- yapmıyorum."* Bugün yapılıyor.
--
-- Ölçüm GİRMEK takdir gerektirmez: sayı limite göre sistem tarafından
-- değerlendiriliyor (0024). Fırının başındaki ve aracı yükleyen kişi
-- ölçmelidir — 0068 bunu doğru kurmuştu, DEĞİŞTİRİLMİYOR.
--
-- Ölçümü İPTAL ETMEK ve düzeltici faaliyeti KAPATMAK ise takdir işidir:
-- biri sapmayı kayıttan düşürür, diğeri "sorun çözüldü" beyanıdır. Sapmayı
-- üretenin onu kapatması, denetimdeki en temel ayrılığı (yapan ≠ onaylayan)
-- bozar.
--
--   `quality.write`          → ölçüm GİRME        (geniş, değişmedi)
--   `quality.record.manage`  → ölçüm İPTALİ +
--                              faaliyet KAPATMA   (YENİ, dar)
--
-- Yeni izin `quality.declaration` ile aynı rollerde: kalite sorumlusu, gıda
-- mühendisi, işletme müdürü, işletme sahibi (+ platform rolleri). Yani
-- "kalite ve yönetim". Üretim ve sevkiyat sorumlusu ölçmeye devam eder,
-- kapatamaz.
--
-- ── ATANAN ROL KURALI: BİLEREK YAPILMADI ──────────────────────────────────
-- Codex "faaliyeti ancak `assigned_role` kapatabilsin" önerdi. Yapmıyorum ve
-- gerekçesi şu: **faaliyet, İŞİ YAPACAK role atanır; kapatma ise ONAY
-- işidir.** CCP-1'in faaliyeti "Malı kabul etme, tedarikçiye iade et" —
-- bunu depo sorumlusu yapar. Ama "yapıldı, kapanabilir" demek kalite
-- kararıdır. Kapatmayı atanan role zorlamak, imzayı tam da yanlış kişiye
-- attırmak olurdu.
--
-- Ayrıca `assigned_role` serbest metin ve insan etiketi taşıyor ("Depo
-- sorumlusu", "Mutfak sorumlusu"); rol kodlarıyla karşılaştırılamaz. Bu
-- da ayrı bir normalleştirme işi — ve yukarıdaki gerekçeyle gereksiz.
--
-- Bunun yerine kaydın KENDİSİ kapatanı söylesin: `completed_by` kolonu
-- eklendi ve değerini İSTEMCİ DEĞİL VERİTABANI yazıyor (`auth.uid()`).
-- İstemcinin yalan söyleyebileceği bir imza, imza değildir.
--
-- ── OTURUMSUZ BAĞLAM SERBEST ──────────────────────────────────────────────
-- 0073'teki kalıbın aynısı: göç, arka plan işi ve yedek geri yükleme
-- `auth.uid()` olmadan çalışır; orada izin diye bir kavram yoktur.
-- PostgREST üzerinden gelen her çağrının oturumu VARDIR.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · YENİ İZİN ─────────────────────────────────────────────────────────
insert into permission (code, module_code, description) values
  ('quality.record.manage', 'quality',
   'Kalite kaydini DUZELTME: olcum iptali ve duzeltici faaliyet kapatma. '
   'Olcum GIRME yetkisi degildir (o quality.write).')
on conflict (code) do update set description = excluded.description;

-- ⚠️ `select code from permission` ile toplu dağıtım YAPILMIYOR: bugün
-- eklenen izin o satırlara girmez (0073'teki not). Roller tek tek yazılıyor.
insert into role_permission (role_code, permission_code)
select r, 'quality.record.manage'
  from unnest(array[
    'super_admin', 'admin',
    'isletme_sahibi', 'isletme_muduru',
    'kalite_sorumlusu', 'gida_muhendisi'
  ]) r
 where exists (select 1 from role where code = r)
on conflict (role_code, permission_code) do nothing;


-- ── 2 · KAPATANI VERİTABANI YAZSIN ────────────────────────────────────────
alter table public.haccp_corrective_action
  add column if not exists completed_by uuid references app_user(id) on delete set null;

comment on column public.haccp_corrective_action.completed_by is
  'Faaliyeti KAPATAN kullanici. Degerini istemci GONDEREMEZ; kapanis aninda '
  'tetik auth.uid() uzerinden yaziyor (0081). Denetimde "bu uygunsuzlugu kim '
  'kapatti" sorusunun cevabi budur.';


-- ── 3 · AKTİF KULLANICI ───────────────────────────────────────────────────
-- Oturumdaki `auth.uid()`'in bu veritabanındaki `app_user` karşılığı.
-- Oturum yoksa null. `security definer`: `app_user` kiracı duvarının
-- arkasında ve çağıran kendi satırını okuyamıyor olabilir.
create or replace function app.aktif_kullanici_id()
returns uuid
language plpgsql stable security definer set search_path = public, app as $$
declare v_auth uuid; v_id uuid;
begin
  begin
    v_auth := auth.uid();
  exception when others then v_auth := null;
  end;
  if v_auth is null then return null; end if;

  select u.id into v_id
    from app_user u
   where u.auth_user_id = v_auth
     and u.is_active
   limit 1;

  return v_id;
end $$;

comment on function app.aktif_kullanici_id() is
  'Oturumdaki auth.uid() icin app_user.id. Oturum yoksa null (0081).';

revoke all     on function app.aktif_kullanici_id() from public;
revoke all     on function app.aktif_kullanici_id() from anon;
grant  execute on function app.aktif_kullanici_id() to authenticated, service_role;


-- ── 4 · GENEL İZİN TETİĞİ ─────────────────────────────────────────────────
-- Tek fonksiyon, izin kodu tetik argümanından gelir. Her tablo için ayrı
-- fonksiyon yazmak, aynı kuralı altı yere kopyalamak olurdu — biri
-- güncellenmeyince sessizce ayrışırdı.
create or replace function app.izin_gerek()
returns trigger
language plpgsql
as $$
declare v_auth uuid; v_izin text;
begin
  v_izin := tg_argv[0];

  begin
    v_auth := auth.uid();
  exception when others then v_auth := null;
  end;
  -- Oturumsuz bağlam (göç, yedek geri yükleme) serbest.
  if v_auth is null then
    return coalesce(new, old);
  end if;

  if not app.yetkim_var(v_izin) then
    raise exception 'Bu islem icin `%` izni gerekiyor; hesabinizda yok.', v_izin
      using errcode = 'MI403';
  end if;

  return coalesce(new, old);
end $$;

comment on function app.izin_gerek() is
  'Genel yazma kapisi. Tetik argumani izin kodudur. Oturumsuz baglami '
  'serbest birakir; PostgREST uzerinden gelen her cagrinin oturumu vardir (0081).';


-- ── 5 · REÇETE KAPISI ─────────────────────────────────────────────────────
-- `ProductionRecipes.tsx` zaten `recipe.write` istiyordu; kapı artık burada.
drop trigger if exists izin_recipe on public.recipe;
create trigger izin_recipe
  before insert or update or delete on public.recipe
  for each row execute function app.izin_gerek('recipe.write');

drop trigger if exists izin_recipe_line on public.recipe_line;
create trigger izin_recipe_line
  before insert or update or delete on public.recipe_line
  for each row execute function app.izin_gerek('recipe.write');


-- ── 6 · SEVKİYAT KAPISI ───────────────────────────────────────────────────
-- ⚠️ Siparişten sevkiyat türetme de bu kapıdan geçer (`Siparisler.tsx`).
-- O ekranı kullanan roller (işletme sahibi/müdürü) `logistics.write`
-- taşıyor; kontrol edildi, kapı onları engellemiyor.
drop trigger if exists izin_shipment on public.shipment;
create trigger izin_shipment
  before insert or update or delete on public.shipment
  for each row execute function app.izin_gerek('logistics.write');

drop trigger if exists izin_shipment_line on public.shipment_line;
create trigger izin_shipment_line
  before insert or update or delete on public.shipment_line
  for each row execute function app.izin_gerek('logistics.write');


-- ── 7 · HACCP ÖLÇÜM KAPISI ────────────────────────────────────────────────
-- INSERT  → `quality.write`         (ölçüm girme, geniş)
-- UPDATE  → `quality.record.manage` (0024 zaten yalnız iptal kolonlarının
--            güncellenmesine izin veriyor; yani her UPDATE bir iptaldir)
-- DELETE  → 0024'ün append-only tetiği zaten reddediyor
create or replace function app.haccp_olcum_izni()
returns trigger
language plpgsql
as $$
declare v_auth uuid; v_izin text;
begin
  begin
    v_auth := auth.uid();
  exception when others then v_auth := null;
  end;
  if v_auth is null then return coalesce(new, old); end if;

  if tg_op = 'INSERT' then
    v_izin := 'quality.write';
  else
    v_izin := 'quality.record.manage';
  end if;

  if not app.yetkim_var(v_izin) then
    if tg_op = 'INSERT' then
      raise exception 'HACCP olcumu girmek icin `quality.write` izni gerekiyor.'
        using errcode = 'MI403';
    else
      raise exception 'Olcum kaydini degistirmek/iptal etmek icin '
        '`quality.record.manage` izni gerekiyor. Bu izin kalite sorumlusu, '
        'gida muhendisi, isletme muduru ve isletme sahibi rollerindedir. '
        'Olcum GIRME yetkiniz ayri ve duruyor.'
        using errcode = 'MI403';
    end if;
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists izin_haccp_measurement on public.haccp_measurement;
create trigger izin_haccp_measurement
  before insert or update or delete on public.haccp_measurement
  for each row execute function app.haccp_olcum_izni();


-- ── 8 · DÜZELTİCİ FAALİYET KAPISI ─────────────────────────────────────────
-- Faaliyet, FAIL bir ölçümün ardından KENDİLİĞİNDEN açılır (servis yazar) —
-- o yüzden açılış `quality.write` ile yetinir. Kapatmak ise onay işidir.
--
-- Kapsanan dört yol:
--   1. UPDATE ile COMPLETED'a geçiş          → quality.record.manage
--   2. Doğrudan COMPLETED olarak INSERT      → quality.record.manage
--      (aksi hâlde kapı, bir satır ekleyerek atlanırdı)
--   3. `assigned_role` değiştirme            → quality.record.manage
--      (kimin yapması gerektiğini yeniden yazmak da kayıt düzeltmedir)
--   4. DELETE                                → quality.record.manage
create or replace function app.haccp_faaliyet_izni()
returns trigger
language plpgsql
as $$
declare
  v_auth    uuid;
  v_kapanis boolean := false;
  v_dar     boolean := false;
begin
  begin
    v_auth := auth.uid();
  exception when others then v_auth := null;
  end;
  if v_auth is null then return coalesce(new, old); end if;

  if tg_op = 'DELETE' then
    v_dar := true;
  elsif tg_op = 'INSERT' then
    v_kapanis := (new.status = 'COMPLETED');
    v_dar     := v_kapanis;
  else
    v_kapanis := (new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED');
    v_dar     := v_kapanis
                 or (new.assigned_role is distinct from old.assigned_role);
  end if;

  if v_dar and not app.yetkim_var('quality.record.manage') then
    raise exception 'Duzeltici faaliyeti kapatmak (ya da atamasini '
      'degistirmek) icin `quality.record.manage` izni gerekiyor. Bu izin '
      'kalite sorumlusu, gida muhendisi, isletme muduru ve isletme sahibi '
      'rollerindedir.'
      using errcode = 'MI403';
  end if;

  if not v_dar and tg_op <> 'DELETE' and not app.yetkim_var('quality.write') then
    raise exception 'Duzeltici faaliyet kaydi icin `quality.write` izni gerekiyor.'
      using errcode = 'MI403';
  end if;

  -- ⚠️ İMZAYI VERİTABANI ATIYOR. İstemci `completed_by` gönderse bile
  -- üstüne yazılır; göndermese de doldurulur.
  if tg_op <> 'DELETE' and v_kapanis then
    new.completed_by := app.aktif_kullanici_id();
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists izin_haccp_corrective_action on public.haccp_corrective_action;
create trigger izin_haccp_corrective_action
  before insert or update or delete on public.haccp_corrective_action
  for each row execute function app.haccp_faaliyet_izni();


-- ── 9 · AMBALAJ DELİĞİ ────────────────────────────────────────────────────
-- Codex'in bulduğu açık: `label.repository.ts` → `ambalajYaz()` doğrudan
-- `stock_item.net_qty/net_uom` güncelliyor. Alerjen (0072/0073 RPC) ve besin
-- değeri (0073 tetiği) kapalıyken ambalaj açıktı — oysa üçü de aynı etikete
-- basılıyor. "500 g" yerine "5000 g" yazmak, beyanı değiştirmektir.
--
-- ⚠️ Yalnız bu iki kolon kapsanıyor. `stock_item`in geri kalanı (ad,
-- kategori, kritik seviye) stok işidir ve `stock.write` ile yazılır —
-- oraya `quality.declaration` koymak depo sorumlusunu kart açamaz hâle
-- getirirdi.
create or replace function app.ambalaj_beyani_izni()
returns trigger
language plpgsql
as $$
declare v_auth uuid; v_degisti boolean;
begin
  begin
    v_auth := auth.uid();
  exception when others then v_auth := null;
  end;
  if v_auth is null then return new; end if;

  if tg_op = 'INSERT' then
    v_degisti := (new.net_qty is not null or new.net_uom is not null);
  else
    v_degisti := (new.net_qty is distinct from old.net_qty)
                 or (new.net_uom is distinct from old.net_uom);
  end if;

  if v_degisti and not app.yetkim_var('quality.declaration') then
    raise exception 'Ambalaj miktari/birimi etiket beyaninin parcasidir; '
      'yazmak icin `quality.declaration` izni gerekiyor.'
      using errcode = 'MI403';
  end if;

  return new;
end $$;

drop trigger if exists izin_stock_item_ambalaj on public.stock_item;
create trigger izin_stock_item_ambalaj
  before insert or update on public.stock_item
  for each row execute function app.ambalaj_beyani_izni();


-- ── 10 · DOĞRULAMA ────────────────────────────────────────────────────────
do $$
declare
  v_say    int;
  v_eksik  text;
  v_beklenen text[] := array[
    'izin_recipe', 'izin_recipe_line',
    'izin_shipment', 'izin_shipment_line',
    'izin_haccp_measurement', 'izin_haccp_corrective_action',
    'izin_stock_item_ambalaj'
  ];
  t text;
begin
  -- 1 · İzin katalogda
  if not exists (select 1 from permission where code = 'quality.record.manage') then
    raise exception '0081: quality.record.manage izni katalogda yok.';
  end if;

  -- 2 · Doğru rollerde, yanlış rollerde DEĞİL
  select string_agg(r, ', ') into v_eksik
    from unnest(array['isletme_sahibi','isletme_muduru','kalite_sorumlusu','gida_muhendisi']) r
   where exists (select 1 from role where code = r)
     and not exists (select 1 from role_permission rp
                      where rp.role_code = r
                        and rp.permission_code = 'quality.record.manage');
  if v_eksik is not null then
    raise exception '0081: su rollerde quality.record.manage yok: %', v_eksik;
  end if;

  select string_agg(r, ', ') into v_eksik
    from unnest(array['uretim_sorumlusu','sevkiyat_sorumlusu','depo_sorumlusu','personel','izleyici']) r
   where exists (select 1 from role_permission rp
                  where rp.role_code = r
                    and rp.permission_code = 'quality.record.manage');
  if v_eksik is not null then
    raise exception '0081: su rollerde quality.record.manage OLMAMALI: %', v_eksik;
  end if;

  -- 3 · `quality.write` KORUNDU (0068 geri alinmadi)
  select count(*) into v_say
    from role_permission
   where permission_code = 'quality.write'
     and role_code in ('uretim_sorumlusu','sevkiyat_sorumlusu');
  if v_say <> 2 then
    raise exception '0081: uretim/sevkiyat olcum girme yetkisini kaybetti (0068 bozuldu).';
  end if;

  -- 4 · completed_by kolonu
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'haccp_corrective_action'
       and column_name = 'completed_by'
  ) then
    raise exception '0081: completed_by kolonu eklenmedi.';
  end if;

  -- 5 · Yedi tetik de VAR ve DEVRE DIŞI DEĞİL
  foreach t in array v_beklenen loop
    if not exists (
      select 1 from pg_trigger tg
       where tg.tgname = t and not tg.tgisinternal and tg.tgenabled <> 'D'
    ) then
      raise exception '0081: % tetigi yok ya da devre disi.', t;
    end if;
  end loop;

  -- 6 · Fonksiyonlar PUBLIC'e ACIK KALMASIN (tuzak 67)
  select string_agg(p.proname, ', ') into v_eksik
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app'
     and p.proname = 'aktif_kullanici_id'
     and exists (
       select 1 from aclexplode(p.proacl) a where a.grantee = 0
     );
  if v_eksik is not null then
    raise exception '0081: su fonksiyonlar PUBLIC EXECUTE acik: %', v_eksik;
  end if;

  select count(*) into v_say from permission;
  raise notice '0081 TAMAM · katalogda % izin · 7 yetki tetigi kuruldu · '
    'kapatan imzasi completed_by kolonunda', v_say;
end $$;

notify pgrst, 'reload schema';
