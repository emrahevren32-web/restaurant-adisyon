-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0085 · YARIM KALAN YAZMA KAPILARI KAPANIYOR (Codex MIYOP-001, -007)
--
-- ── NE OLDU ──────────────────────────────────────────────────────────────
-- 0081 "yazma kapıları artık veritabanında" dedi ve YEDİ tetikleyici kurdu:
-- reçete, reçete satırı, sevkiyat, sevkiyat satırı, HACCP ölçümü, düzeltici
-- faaliyet, ambalaj beyanı. O kadar.
--
-- 17.10.2026 · Codex denetimi geri kalanı buldu (MIYOP-001). `0006:30` ve
-- `0006:41` şunu veriyor:
--
--   grant select, insert, update on
--     tenant, company, branch, app_user, user_branch_access,
--     stock_item, stock_lot, lot_genealogy to authenticated;
--   grant select, insert on stock_movement to authenticated;
--
-- Bu tabloların RLS'i YALNIZCA `tenant_id = app.current_tenant_id()` diyor.
-- İŞ İZNİ SORULMUYOR. Yani uygulamada `izleyici` rolündeki — ekranda tek bir
-- yazma düğmesi göremeyen — kullanıcı, doğrudan REST çağrısıyla stok
-- hareketi yazabiliyor. Tarayıcıdaki `yazabilirMi()` bir güvenlik sınırı
-- değil; hiçbir zaman olmadı.
--
-- `izleyici` rolünün izinleri (ölçüldü): hepsi `.read`. Tek bir `.write`
-- izni yok. Buna rağmen defterin kapısı ona açıktı.
--
-- ── ÜÇ DÜZELTME ──────────────────────────────────────────────────────────
-- 1. `app.izin_gerek()` SERTLEŞTİ. "Oturum yoksa serbest" diyordu; `anon`
--    da oturumsuzdur. 0082 bunun için `app.bakim_baglami()` yazmıştı ama
--    yalnız HACCP tetiğine uygulamıştı. Artık genel kapı da onu kullanıyor.
-- 2. `stock_movement` için SEBEBE BAKAN kapı. Tek bir izin yazamazdım:
--    mal kabul `purchase.write`, üretim `production.write`, sevk
--    `logistics.write` rolleriyle yapılıyor. Tek izin yazmak meşru akışları
--    kırardı. Kapı `reason` sütununa bakıp o akışın iznini soruyor.
-- 3. Kalan tablolara `izin_gerek` tetikleri.
--
-- ⚠️ `app_user` GÜNCELLEMESİ BİLEREK DAR TUTULDU. Sütun yetkileri zaten
-- yalnız `full_name, phone, profile_photo_url, updated_at` veriyor — yani
-- kendi profilini düzenleme alanları. Buraya `users.manage` koysaydım
-- kullanıcı kendi telefonunu değiştiremezdi. Kapı: "ya `users.manage` var,
-- ya da KENDİ satırı".
--
-- Bu göç HİÇBİR GRANT'I değiştirmiyor. Grant'ları daraltmak, uygulamanın
-- bütün yazma yollarını RPC'ye taşımak demekti — ayrı ve büyük bir iş.
-- Buradaki kapı, grant'ın açtığı kapının ARKASINDA duruyor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · GENEL KAPI SERTLEŞİYOR ────────────────────────────────────────────
create or replace function app.izin_gerek()
returns trigger
language plpgsql
as $$
declare v_izin text;
begin
  v_izin := tg_argv[0];

  -- ⚠️ 0085: eskiden "auth.uid() null ise serbest" idi. `anon` da null'dur.
  -- Bakım bağlamı artık ADIYLA soruluyor: oturum YOK **ve** çağıran rol
  -- kullanıcı rollerinden biri DEĞİL (göç, yedek geri yükleme, service_role).
  if app.bakim_baglami() then
    return coalesce(new, old);
  end if;

  if not app.yetkim_var(v_izin) then
    raise exception 'Bu islem icin `%` izni gerekiyor; hesabinizda yok.', v_izin
      using errcode = 'MI403';
  end if;

  return coalesce(new, old);
end $$;

comment on function app.izin_gerek() is
  'Genel yazma kapisi. Tetik argumani izin kodudur. 0085: bakim baglami '
  'app.bakim_baglami() ile belirleniyor; `anon` artik gecemiyor.';


-- ── 2 · STOK DEFTERİ · SEBEBE BAKAN KAPI ──────────────────────────────────
-- Defter tek tablo ama BEŞ ayrı iş onu yazıyor. Her işin kendi izni var.
-- Kapı "şu izinlerden BİRİ" diyor; daha dar yazmak meşru akışı kırardı.
--
--   PURCHASE_*    → purchase.write   | stock.write
--   PRODUCTION_*  → production.write | stock.write
--   SHIPMENT_*    → logistics.write  | stock.write
--   diğer hepsi   → stock.write
--
-- `izleyici` bu izinlerin HİÇBİRİNE sahip değil (ölçüldü, 17.10.2026).
create or replace function app.stok_hareketi_izni()
returns trigger
language plpgsql
set search_path = public, app
as $$
declare
  v_izinler text[];
  v_izin    text;
begin
  if app.bakim_baglami() then
    return new;
  end if;

  v_izinler := case
    when new.reason like 'PURCHASE\_%'   then array['purchase.write',   'stock.write']
    when new.reason like 'PRODUCTION\_%' then array['production.write', 'stock.write']
    when new.reason like 'SHIPMENT\_%'   then array['logistics.write',  'stock.write']
    else array['stock.write']
  end;

  foreach v_izin in array v_izinler loop
    if app.yetkim_var(v_izin) then
      return new;
    end if;
  end loop;

  raise exception
    'Stok hareketi yazmak icin su izinlerden biri gerekiyor: %. Hesabinizda yok. (sebep: %)',
    array_to_string(v_izinler, ', '), new.reason
    using errcode = 'MI403';
end $$;

comment on function app.stok_hareketi_izni() is
  'Stok defterinin yazma kapisi. Hareketin `reason` sutununa bakip o akisin '
  'iznini sorar. Salt okunur rol (izleyici) hicbirine sahip degil.';

drop trigger if exists izin_stock_movement on public.stock_movement;
create trigger izin_stock_movement
  before insert on public.stock_movement
  for each row execute function app.stok_hareketi_izni();


-- ── 3 · KENDİ SATIRI YA DA users.manage ───────────────────────────────────
create or replace function app.kullanici_satiri_izni()
returns trigger
language plpgsql
set search_path = public, app
as $$
declare v_auth uuid;
begin
  if app.bakim_baglami() then
    return coalesce(new, old);
  end if;

  if app.yetkim_var('users.manage') then
    return coalesce(new, old);
  end if;

  -- Kendi satırı mı? Sütun yetkileri zaten yalnız ad/telefon/foto veriyor.
  begin
    v_auth := auth.uid();
  exception when others then v_auth := null;
  end;

  if tg_op = 'UPDATE' and v_auth is not null and old.auth_user_id = v_auth then
    return new;
  end if;

  raise exception 'Kullanici kaydi icin `users.manage` izni gerekiyor; hesabinizda yok.'
    using errcode = 'MI403';
end $$;

comment on function app.kullanici_satiri_izni() is
  'app_user kapisi. `users.manage` ya da KENDI satiri. Kendi profilini '
  'duzenlemeyi kapatmamak icin ikinci kosul var (0085).';

drop trigger if exists izin_app_user on public.app_user;
create trigger izin_app_user
  before insert or update on public.app_user
  for each row execute function app.kullanici_satiri_izni();


-- ── 4 · KALAN TABLOLAR ────────────────────────────────────────────────────
-- ⚠️ `lot_genealogy` ve `stock_lot` üretim ve mal kabul tarafından da
-- yazılıyor; `stock.write` bu rollerin hepsinde var (depo, üretim, sevkiyat,
-- personel, müdür, sahip). `satinalma_sorumlusu`nda YOK — mal kabulü depo
-- yapar. Bu bilinçli: satın almacı sipariş açar, depocu malı alır.
drop trigger if exists izin_stock_item on public.stock_item;
create trigger izin_stock_item
  before insert or update on public.stock_item
  for each row execute function app.izin_gerek('stock.write');

drop trigger if exists izin_stock_lot on public.stock_lot;
create trigger izin_stock_lot
  before insert or update on public.stock_lot
  for each row execute function app.izin_gerek('stock.write');

drop trigger if exists izin_lot_genealogy on public.lot_genealogy;
create trigger izin_lot_genealogy
  before insert or update on public.lot_genealogy
  for each row execute function app.izin_gerek('stock.write');

drop trigger if exists izin_company on public.company;
create trigger izin_company
  before insert or update on public.company
  for each row execute function app.izin_gerek('company.manage');

drop trigger if exists izin_branch on public.branch;
create trigger izin_branch
  before insert or update on public.branch
  for each row execute function app.izin_gerek('branch.manage');

-- MIYOP-007'nin yazma yarısı: kullanıcı KENDİNE şube erişimi veremesin.
drop trigger if exists izin_user_branch_access on public.user_branch_access;
create trigger izin_user_branch_access
  before insert or update on public.user_branch_access
  for each row execute function app.izin_gerek('users.manage');

-- `tenant` UPDATE sütun yetkisi yalnız `name` veriyor (işletme adını
-- değiştirme). Yine de izinsiz olmasın.
drop trigger if exists izin_tenant on public.tenant;
create trigger izin_tenant
  before insert or update on public.tenant
  for each row execute function app.izin_gerek('company.manage');


-- ⚠️ TUZAK 67: fonksiyon varsayilani PUBLIC EXECUTE. Tetik fonksiyonlari
-- dogrudan cagrilamamali.
revoke all on function app.stok_hareketi_izni()   from public;
revoke all on function app.stok_hareketi_izni()   from anon;
revoke all on function app.kullanici_satiri_izni() from public;
revoke all on function app.kullanici_satiri_izni() from anon;


-- ── 5 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare
  v_ad   text;
  v_tetik text;
  v_eksik text[] := array[]::text[];
begin
  foreach v_tetik in array array[
    'izin_stock_movement',  'izin_stock_item',   'izin_stock_lot',
    'izin_lot_genealogy',   'izin_company',      'izin_branch',
    'izin_user_branch_access', 'izin_tenant',    'izin_app_user'
  ] loop
    if not exists (
      select 1 from pg_trigger t
       where t.tgname = v_tetik and not t.tgisinternal
    ) then
      v_eksik := v_eksik || v_tetik;
    end if;
  end loop;

  if array_length(v_eksik, 1) is not null then
    raise exception '0085: su tetikler olusmadi: %', array_to_string(v_eksik, ', ');
  end if;

  -- 0081'in yedi tetigi YERINDE durmali.
  foreach v_tetik in array array[
    'izin_recipe', 'izin_recipe_line', 'izin_shipment', 'izin_shipment_line',
    'izin_haccp_measurement', 'izin_haccp_corrective_action',
    'izin_stock_item_ambalaj'
  ] loop
    if not exists (
      select 1 from pg_trigger t where t.tgname = v_tetik and not t.tgisinternal
    ) then
      raise exception '0085: 0081 tetigi % kayboldu.', v_tetik;
    end if;
  end loop;

  -- `izleyici` rolunun hicbir yazma izni OLMAMALI; kapinin anlami buna bagli.
  if exists (
    select 1 from role_permission
     where role_code = 'izleyici'
       and permission_code in ('stock.write','purchase.write',
                               'production.write','logistics.write')
  ) then
    raise exception '0085: izleyici rolune yazma izni verilmis — kapi anlamsizlasir.';
  end if;

  -- Yeni fonksiyonlarin PUBLIC kapisi kapali mi (tuzak 67 + 80)?
  foreach v_ad in array array[
    'app.stok_hareketi_izni()',
    'app.kullanici_satiri_izni()'
  ] loop
    if exists (
      select 1 from pg_proc p,
        lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       where p.oid = to_regprocedure(v_ad)
         and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception '0085: % uzerinde PUBLIC EXECUTE acik.', v_ad;
    end if;
  end loop;

  raise notice '0085 tamam: dokuz yazma kapisi daha veritabaninda.';
end $$;
