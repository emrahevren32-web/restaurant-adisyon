-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · CANLIYA YAPIŞTIRILACAK GÖÇ PAKETİ · 29.10.2026
--
-- Supabase → SQL Editor → hepsini seç, yapıştır, Run.
-- Beklenen çıktı: "Success. No rows returned."
--
-- ⚠️ SUPABASE YAPIŞTIRILAN BETİĞİN TAMAMINI **TEK İŞLEMDE** ÇALIŞTIRIR.
-- Bir satır düşerse HİÇBİR ŞEY uygulanmaz.
--   KURAL (27.10, tuzak 129'un bedeli): **BİR GÜVENLİK ONARIMI, VERİYE
--   BAĞLI BİR GÖÇLE AYNI PAKETTE GİTMEZ.**
-- BU PAKETTE TEK GÖÇ VAR: 0103. Güvenlik onarımı değil, yeni bir tablo.
--
-- ── 0103 NEDEN GEREKLİ ────────────────────────────────────────────────────
-- İşletme Ayarları ekranı para birimi ve KDV oranını gösteriyor ama
-- ikisinin de veritabanında KARŞILIĞI YOK; ekran onları tarayıcıya yazıyor.
-- Üstüne `vatRate: 10` diye **kimsenin vermediği bir cevap** duruyor.
-- Emrah'ın kararı (29.10): *"Kiracı ayarları tablosu yap. Herkes kendi KDV
-- oranını ve para birimini kendi seçsin."*
--
-- ⚠️ EKRAN BU GÖÇTEN SONRA BAĞLANACAK. Sıra önemli değil (tablo yokken ekran
-- eski hâliyle çalışmaya devam ediyor), ama ekran bağlanmadan A1 kapanmaz.
--
-- Yerel prova: `db/prova/prova-0103.sql` · 30 ölçüm, hepsi yeşil
-- (PostgreSQL 16, 104 göç). Ters prova da yapıldı: KDV'ye varsayılan
-- konunca ölçüm yakalıyor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ══════════════ 0103_kiraci_ayarlari.sql ══════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Göç 0103 · KİRACI AYARLARI · MIYOP-060b (HEDEFLER 3.4.1–3.4.3)
--
-- ── SORUN ─────────────────────────────────────────────────────────────────
-- İşletme Ayarları ekranı iki ayar gösteriyor — **para birimi** ve **KDV
-- oranı** — ve ikisinin de göçlerde KARŞILIĞI YOK. Ekran onları
-- `localStorage`a yazıyor. Üç ayrı kusur:
--
--   · **MIYOP-060b · SORULMAMIŞ SORUYA CEVAP.** `DEFAULT_SETTINGS`
--     `vatRate: 10` yazıyor ve form bunu *"işletmenin KDV oranı"* gibi
--     gösteriyor. ⚠️ **Kimse %10 demedi.** Belirlenmemiş bir değeri
--     belirlenmiş gibi göstermek, bu projedeki *mış gibi* yasağının tam
--     ortasıdır.
--   · **Karşılığı olmayan alan.** Sipariş/stok satırındaki `vat_rate`
--     SATIRIN vergisidir, işletme ayarı değildir. İkisi karıştırılırsa
--     "işletmenin KDV'si" diye gösterilen şey aslında son satırın vergisi
--     olur.
--   · **Ortak anahtar sızıntısı.** İkisi de `ra_settings` içine yazılıyor;
--     bir kiracının değeri ötekinin varsayılanına taşınabiliyor.
--
-- ── KARAR (Emrah, 29.10.2026) ─────────────────────────────────────────────
-- *"Kiracı ayarları tablosu yap. Herkes kendi KDV oranını ve para birimini
-- kendi seçsin."* → İki ayar da KALIYOR ve bu tablo onların yeri oluyor.
--
-- ── BELİRLENMEMİŞ, BİR DEĞERDİR ───────────────────────────────────────────
-- ⚠️ `vat_rate` BİLEREK `null` olabiliyor ve varsayılanı YOK.
-- Bu göçün varlık sebebi tam olarak budur: `vatRate: 10` bir cevaptı ve o
-- cevabı kimse vermemişti. `null` = *"işletme henüz seçmedi"*; ekran bunu
-- boş gösterir ve sormaz-göstermez. Buraya bir `default 10` koymak, aynı
-- yalanı bir katman aşağıya taşımak olurdu.
--
-- ⚠️ `currency_code`un varsayılanı VAR (`TRY`) ve bu bir tahmin değil:
-- MİYOP Türkiye'de satılıyor, fatura TL kesiliyor. Yine de alan
-- değiştirilebilir — karar "herkes kendi seçsin" idi.
--
-- ── KAPILAR ───────────────────────────────────────────────────────────────
--   · RLS `tenant_settings_tenant_isolation` → satır kiracıya bağlı (force).
--   · Yazma kapısı `izin_settings` → `app.izin_gerek('settings.manage')`.
--     ⚠️ Ölçüldü: bu izin `admin`, `isletme_sahibi`, `super_admin`de var;
--     `isletme_muduru`da YOK. Müdür işi yürütür, işletmenin kimliğini ve
--     vergi düzenini değiştirmez — `company.manage` ile aynı aile (0015).
--   · Okuma herkese açık (kiracı içinde): fiyatı ekrana basan her ekranın
--     para birimini bilmesi gerekiyor.
--   · `denetim_tenant_settings` → kim neyi değiştirdi, yazılı (0091).
--
-- ⚠️ `updated_at` ve `updated_by` SUNUCUDA yazılıyor, istemciden gelen değer
-- YOK SAYILIYOR (0087'nin kuralı). "Ne zaman kaydedildi" ekranın iddiası
-- değil, veritabanının kaydı olmalı.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · TABLO ─────────────────────────────────────────────────────────────
create table if not exists public.tenant_settings (
  -- ⚠️ `id` KOLONU BİLEREK VAR, VE BUNU PROVA ÖĞRETTİ.
  -- İlk hâlinde birincil anahtar doğrudan `tenant_id` idi ("kiracı başına
  -- tek satır, ayrı kimliğe ne gerek var"). Mantıklı görünüyordu ama
  -- `app.denetim_yaz()` satır kimliğini `new ->> 'id'` ile okuyor: `id`
  -- olmayan tabloda denetim kaydı yazılıyor ama `row_id` alanına **'?'**
  -- düşüyor. Yani "bunu kim değiştirdi" sorusu cevaplanıyor, "NEYİ
  -- değiştirdi" sorusu cevaplanmıyordu. Prova yakaladı. → tuzak 149
  id            uuid primary key default gen_random_uuid(),

  -- Kiracı başına TEK satır: ikinci satır diye bir şey olmamalı.
  tenant_id     uuid not null unique references public.tenant(id) on delete cascade,

  currency_code text not null default 'TRY'
                  constraint tenant_settings_currency_bicim
                  check (currency_code ~ '^[A-Z]{3}$'),

  -- ⚠️ VARSAYILANI YOK. Bkz. dosya başı: `null` = "işletme henüz seçmedi".
  vat_rate      numeric(5,2)
                  constraint tenant_settings_vat_araligi
                  check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100)),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Kim değiştirdi. ⚠️ Sunucu yazar; istemci gönderemez.
  updated_by    uuid references public.app_user(id) on delete set null
);

comment on table public.tenant_settings is
  'Kiraci genelindeki ayarlar (para birimi, KDV orani). Satir basina vergi '
  'DEGIL -- o siparis/stok satirinin kendi vat_rate alanidir (0103).';
comment on column public.tenant_settings.vat_rate is
  'BELIRLENMEMIS olabilir (null). Varsayilan YOKTUR: eski ekran vatRate=10 '
  'diye sorulmamis bir soruya cevap veriyordu (MIYOP-060b).';

alter table public.tenant_settings enable row level security;
alter table public.tenant_settings force  row level security;
drop policy if exists tenant_settings_tenant_isolation on public.tenant_settings;
create policy tenant_settings_tenant_isolation on public.tenant_settings
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());


-- ── 2 · SUNUCU İMZASI ─────────────────────────────────────────────────────
-- ⚠️ İstemciden gelen `updated_at`/`updated_by` YOK SAYILIYOR. Ekranın
-- "şu an kaydedildi" demesi yetmez; kaydı veritabanı tutar.
create or replace function app.tenant_settings_imza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := app.aktif_kullanici_id();
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    -- Doğum tarihi değiştirilemez.
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists tenant_settings_imza on public.tenant_settings;
create trigger tenant_settings_imza
  before insert or update on public.tenant_settings
  for each row execute function app.tenant_settings_imza();


-- ── 3 · YAZMA KAPISI ──────────────────────────────────────────────────────
drop trigger if exists izin_tenant_settings on public.tenant_settings;
create trigger izin_tenant_settings
  before insert or update or delete on public.tenant_settings
  for each row execute function app.izin_gerek('settings.manage');


-- ── 4 · DENETİM ───────────────────────────────────────────────────────────
drop trigger if exists denetim_tenant_settings on public.tenant_settings;
create trigger denetim_tenant_settings
  after insert or update or delete on public.tenant_settings
  for each row execute function app.denetim_yaz();


-- ── 5 · HER KİRACININ BİR SATIRI OLSUN ────────────────────────────────────
-- ⚠️ Ekranın "satır yoksa oluştur" yapmasını İSTEMİYORUZ: o yol, ekranın
-- kiracı adına satır açabilmesi demek ve hangi kiracı adına açtığı
-- ekranın elinde olur. Satırı veritabanı açar.
create or replace function app.kiraci_ayarlarini_kur(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tenant is null then return; end if;
  insert into public.tenant_settings (tenant_id)
  values (p_tenant)
  on conflict (tenant_id) do nothing;
end;
$$;

create or replace function app.kiraci_dogunca_ayar_kur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.kiraci_ayarlarini_kur(new.id);
  return null;
end;
$$;

drop trigger if exists trg_kiraci_ayarlari on public.tenant;
create trigger trg_kiraci_ayarlari
  after insert on public.tenant
  for each row execute function app.kiraci_dogunca_ayar_kur();

-- Göçten önce doğmuş kiracılar da doldurulsun.
do $$
declare r record; v_say int := 0;
begin
  for r in select t.id from public.tenant t
            where not exists (select 1 from public.tenant_settings s
                               where s.tenant_id = t.id)
  loop
    perform app.kiraci_ayarlarini_kur(r.id);
    v_say := v_say + 1;
  end loop;
  if v_say > 0 then
    raise notice '0103: ayarı olmayan % kiracıya satır açıldı', v_say;
  end if;
end;
$$;


-- ── 6 · HAKLAR ────────────────────────────────────────────────────────────
-- ⚠️ PostgreSQL varsayılanı `PUBLIC EXECUTE` (tuzak 67).
revoke all on function app.tenant_settings_imza()      from public;
revoke all on function app.kiraci_ayarlarini_kur(uuid)  from public;
revoke all on function app.kiraci_dogunca_ayar_kur()    from public;
grant execute on function app.kiraci_ayarlarini_kur(uuid) to service_role;

-- Okuma kiracı içinde HERKESE açık: fiyat gösteren her ekran para birimini
-- bilmek zorunda. Yazma hakkı tabloda var ama kapı tetikte.
grant select, insert, update on public.tenant_settings to authenticated;
grant all on public.tenant_settings to service_role;
-- ⚠️ `delete` VERİLMİYOR: kiracının ayar satırı silinmez, değiştirilir.


-- ── 7 · DOĞRULAMA · YALNIZ BU GÖÇÜN YAZDIĞINI ÖLÇER ───────────────────────
do $$
declare v_say int;
begin
  if to_regclass('public.tenant_settings') is null then
    raise exception '0103: tablo oluşmadı.';
  end if;

  -- ⚠️ EN ÖNEMLİ ÖLÇÜM: KDV'nin varsayılanı OLMAMALI.
  if exists (
    select 1 from pg_attrdef d
    join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where d.adrelid = 'public.tenant_settings'::regclass and a.attname = 'vat_rate'
  ) then
    raise exception '0103: vat_rate''a varsayılan konmuş — MIYOP-060b geri geldi.';
  end if;

  -- ⚠️ Denetimin satırı adıyla yazabilmesi için `id` kolonu ŞART
  -- (`app.denetim_yaz` onu `new ->> 'id'` ile okuyor). Yoksa `row_id`
  -- alanına '?' düşer ve "neyi değiştirdi" cevapsız kalır.
  if not exists (
    select 1 from pg_attribute
     where attrelid = 'public.tenant_settings'::regclass
       and attname = 'id' and attnum > 0 and not attisdropped
  ) then
    raise exception '0103: `id` kolonu yok — denetim satırı adıyla yazamaz.';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.tenant_settings'::regclass
       and contype = 'u'
       and conkey = array[(select attnum from pg_attribute
                            where attrelid = 'public.tenant_settings'::regclass
                              and attname = 'tenant_id')]
  ) then
    raise exception '0103: tenant_id tekil değil — ikinci ayar satırı açılabilir.';
  end if;

  if (select count(*) from pg_policy
       where polrelid = 'public.tenant_settings'::regclass) = 0 then
    raise exception '0103: RLS politikası yok.';
  end if;
  if not (select relrowsecurity and relforcerowsecurity
            from pg_class where oid = 'public.tenant_settings'::regclass) then
    raise exception '0103: RLS açık/zorunlu değil.';
  end if;

  for v_say in
    select 1 where not exists (
      select 1 from pg_trigger
       where tgrelid = 'public.tenant_settings'::regclass
         and tgname = 'izin_tenant_settings' and not tgisinternal)
  loop
    raise exception '0103: yazma kapısı takılmamış.';
  end loop;

  if not exists (select 1 from pg_trigger
       where tgrelid = 'public.tenant_settings'::regclass
         and tgname = 'denetim_tenant_settings' and not tgisinternal) then
    raise exception '0103: denetim tetiği yok.';
  end if;
  if not exists (select 1 from pg_trigger
       where tgrelid = 'public.tenant_settings'::regclass
         and tgname = 'tenant_settings_imza' and not tgisinternal) then
    raise exception '0103: sunucu imzası tetiği yok.';
  end if;
  if not exists (select 1 from pg_trigger
       where tgrelid = 'public.tenant'::regclass
         and tgname = 'trg_kiraci_ayarlari' and not tgisinternal) then
    raise exception '0103: yeni kiracı tetiği yok.';
  end if;

  -- Geriye dönük doldurma tamam mı?
  select count(*) into v_say from public.tenant t
   where not exists (select 1 from public.tenant_settings s
                      where s.tenant_id = t.id);
  if v_say > 0 then
    raise exception '0103: % kiracının ayar satırı yok.', v_say;
  end if;

  -- `authenticated` silemiyor olmalı.
  if has_table_privilege('authenticated', 'public.tenant_settings', 'delete') then
    raise exception '0103: authenticated ayar satırını SİLEBİLİYOR.';
  end if;
  if not has_table_privilege('authenticated', 'public.tenant_settings', 'select') then
    raise exception '0103: authenticated ayarları okuyamıyor.';
  end if;

  raise notice '✅ 0103: tenant_settings kuruldu · KDV varsayılanı YOK · kapı settings.manage';
end;
$$;
