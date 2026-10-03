-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0053 — SİPARİŞ ONAY ZİNCİRİ
-- ═══════════════════════════════════════════════════════════════════════════
-- Emrah 29.09:
--   "Kesinlikle sipariş onay zincirine tabi olmalı. Müdürden veya satış
--    sorumlusundan tut, depocuya, oradan aşçıya kadar bir zincir olsa ürünün
--    çıkarılabilmesi konusunda anında bir fizibilite yapılmış olunur.
--    Veya bu zincir çok uzun olursa, satıştan sorumlu kimse onun önüne düşer;
--    o da depodan (yeterli hammadde var mı), aşçıdan (yoğunluğun nedir)
--    aldığı bilgilerle onayı verir, müşterinin istediği tarihe yetişir mi
--    onu cevaplayabilir veya 'şu tarihe kadar hazır olur' der."
--
-- ── İKİ CÜMLE, TEK ŞEMA ───────────────────────────────────────────────────
-- Uzun zincir de kısa zincir de AYNI yapıyla kuruluyor: adımlar bir tabloda
-- duruyor ve her adım ya ONAY (bloklar) ya GÖRÜŞ (bloklamaz) oluyor.
--   · Kısa zincir  = SATIŞ onaylar, depo ve üretim görüş bildirir.
--   · Uzun zincir  = üçü de ONAY yapılır, tek satır değişir.
-- Kodda "if uzunZincir" yok; kural VERİDE.
--
-- ── EN ÖNEMLİ ALAN: SÖZ VERİLEN TARİH ─────────────────────────────────────
-- Emrah'ın cümlesindeki asıl değer "şu tarihe kadar hazır olur"dur. Müşteri
-- 2 Ekim istiyor, mutfak 5 Ekim diyebilir. Bunu bir NOTA yazmak, sonradan
-- kimsenin bulamayacağı bir yere yazmaktır. O yüzden `promised_on` ayrı bir
-- ALAN ve onay tamamlanınca siparişin üstüne işleniyor.
--
-- ── ONAY, REVİZYONA BAĞLIDIR ──────────────────────────────────────────────
-- 200 koliyi onaylamak, 350 koliyi onaylamak değildir. Onay kaydı hangi
-- REVİZYONU onayladığını yazıyor; sipariş revize edilince onaylar
-- kendiliğinden düşüyor ve zincir yeniden işliyor. Bu tek satırlık kural,
-- bu göçün en kolay atlanacak ve en pahalıya patlayacak yeridir.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · YENİ DURUM: ONAY BEKLİYOR ─────────────────────────────────────────
-- Taslak → Onaylandı doğrudan geçişi KAPANIYOR. Emrah: "Kesinlikle onay
-- zincirine tabi olmalı." Bir istisna bırakırsak zincir, acelesi olan
-- herkesin atladığı bir süs olur.
alter table sales_order drop constraint if exists sales_order_status_check;
alter table sales_order add constraint sales_order_status_check
  check (status in ('Taslak','Onay Bekliyor','Onaylandı','Hazırlanıyor','Hazır',
                    'Kısmi Sevk','Sevk Edildi','Teslim Edildi','İptal'));

-- Müşteriye söz verilen tarih. `requested_delivery_date` müşterinin İSTEDİĞİ,
-- bu ise mutfağın SÖZ VERDİĞİ tarihtir. İkisini tek alanda tutmak, sözün
-- tutulup tutulmadığını ölçülemez hâle getirirdi.
alter table sales_order
  add column if not exists promised_delivery_date date;

comment on column sales_order.promised_delivery_date is
  'Onay zincirinin söz verdiği teslim tarihi (0053). `requested_delivery_date` '
  'müşterinin istediği tarihtir; bu, mutfağın taahhüdüdür.';

-- ── 2 · ZİNCİRİN ADIMLARI (kiracı başına ayar) ────────────────────────────
create table if not exists order_approval_step (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete restrict,
  code            text not null,
  name            text not null,
  sort_order      smallint not null default 1,
  -- true  = ONAY: olumlu karar gelmeden sipariş onaylanamaz.
  -- false = GÖRÜŞ: bilgi verir, bloklamaz. ("depodan, aşçıdan aldığı bilgiler")
  required        boolean not null default false,
  -- Bu adımda kim karar verebilir. İzin kataloğuna (0014) bağlı: yanlış
  -- yazılmış bir izin kodu sessizce "kimse" değil, HATA olsun.
  permission_code text not null references permission(code) on delete restrict,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint order_approval_step_code_unique unique (tenant_id, code),
  constraint order_approval_step_code_not_blank check (btrim(code) <> ''),
  constraint order_approval_step_name_not_blank check (btrim(name) <> '')
);

create index if not exists order_approval_step_ix
  on order_approval_step (tenant_id, sort_order);

alter table order_approval_step enable row level security;
alter table order_approval_step force  row level security;
drop policy if exists order_approval_step_tenant_isolation on order_approval_step;
create policy order_approval_step_tenant_isolation on order_approval_step
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- ── 3 · ONAY DEFTERİ (EKLEMELİ) ───────────────────────────────────────────
-- Fikir değişebilir; kayıt değişemez. Yeni bir satır yazılır, SON satır
-- geçerlidir. ADR-001'le aynı kalıp — altıncı kez.
create table if not exists order_approval (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenant(id) on delete restrict,
  order_id     uuid not null references sales_order(id) on delete cascade,
  -- ⚠️ HANGİ REVİZYON onaylandı. Bu kolon olmadan, onaydan sonra miktarı
  -- değiştiren biri onaylı bir sipariş elde ederdi.
  revision_no  integer not null,
  step_code    text not null,
  decision     text not null check (decision in ('Olumlu','Olumsuz','Şartlı')),
  note         text,
  -- "Şu tarihe kadar hazır olur."
  promised_on  date,
  decided_by   uuid references app_user(id) on delete set null,
  decided_at   timestamptz not null default now(),

  -- Olumsuz karar GEREKÇESİZ olamaz: gerekçesiz bir ret, satışçının müşteriye
  -- söyleyecek sözü olmaması demektir.
  constraint order_approval_ret_gerekceli
    check (decision <> 'Olumsuz' or btrim(coalesce(note,'')) <> ''),
  -- Şartlı onay, ŞARTI olmayan bir onaydır — tarih zorunlu.
  constraint order_approval_sartli_tarihli
    check (decision <> 'Şartlı' or promised_on is not null)
);

create index if not exists order_approval_ix
  on order_approval (order_id, revision_no, step_code, decided_at desc);

alter table order_approval enable row level security;
alter table order_approval force  row level security;
drop policy if exists order_approval_tenant_isolation on order_approval;
create policy order_approval_tenant_isolation on order_approval
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop trigger if exists order_approval_degismez on order_approval;
create trigger order_approval_degismez
  before update or delete on order_approval
  for each statement execute function app.siparis_defteri_degismez();

-- ── 4 · KARARI VEREN KİŞİ KİRACIYA AİT OLMALI ─────────────────────────────
-- Yabancı anahtar "böyle bir kullanıcı var mı" der, "BİZİM kullanıcımız mı"
-- demez. Bu sınıf bu projede beşinci kez karşımıza çıkıyor (MI424).
create or replace function app.onay_kullanicisi_tutarli()
returns trigger
language plpgsql
as $$
begin
  if new.decided_by is not null
     and not exists (select 1 from public.app_user
                      where id = new.decided_by and tenant_id = new.tenant_id)
  then
    raise exception 'Kararı veren kullanıcı bu işletmeye ait değil.'
      using errcode = 'MI424';
  end if;

  if not exists (select 1 from public.sales_order
                  where id = new.order_id and tenant_id = new.tenant_id) then
    raise exception 'Onay kaydı başka bir işletmenin siparişine yazılamaz.'
      using errcode = 'MI424';
  end if;

  -- Adım, kiracının zincirinde TANIMLI olmalı. Serbest metin bırakırsak
  -- "DEPOO" yazan bir kayıt hiçbir zaman sayılmaz ve kimse fark etmez.
  if not exists (select 1 from public.order_approval_step
                  where tenant_id = new.tenant_id and code = new.step_code) then
    raise exception '"%" diye bir onay adımı tanımlı değil.', new.step_code
      using errcode = 'MI430';
  end if;

  return new;
end;
$$;

drop trigger if exists order_approval_tutarli on order_approval;
create trigger order_approval_tutarli
  before insert on order_approval
  for each row execute function app.onay_kullanicisi_tutarli();

-- ── 5 · ZİNCİR TAMAM MI ───────────────────────────────────────────────────
-- Bir adımın SON kararı geçerlidir (eklemeli defter). Bloklayan adımların
-- hepsi Olumlu ya da Şartlı ise zincir tamamdır.
--
-- ⚠️ "Şartlı" GEÇİRİR. Şartlı, "hayır" değil "evet ama şu tarihte"dir; şartı
-- da `promised_on` taşıyor ve siparişin üstüne işleniyor. Geçirmeseydik
-- mutfağın en sık vereceği cevap sistemde karşılıksız kalırdı.
create or replace function app.siparis_onayi_tam(p_siparis uuid)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1
      from public.order_approval_step s
      join public.sales_order o on o.id = p_siparis
     where s.tenant_id = o.tenant_id
       and s.is_active
       and s.required
       and coalesce((
             select a.decision
               from public.order_approval a
              where a.order_id  = p_siparis
                and a.step_code = s.code
                and a.revision_no = o.current_revision
              order by a.decided_at desc, a.id desc
              limit 1
           ), 'Yok') not in ('Olumlu','Şartlı')
  );
$$;

comment on function app.siparis_onayi_tam(uuid) is
  'Bloklayan bütün onay adımları, siparişin GÜNCEL revizyonu için olumlu mu. '
  'Her adımın SON kararı geçerlidir. "Şartlı" geçirir, şartı promised_on '
  'taşır. Hiç bloklayan adım yoksa sonuç doğrudur (zincir kurulmamış).';

-- Dış kapı: PostgREST yalnız `public` şemasını yayımlar.
create or replace function public.siparis_onayi_tam(p_siparis uuid)
returns boolean
language sql
stable
as $$ select app.siparis_onayi_tam(p_siparis); $$;

revoke all on function public.siparis_onayi_tam(uuid) from public;
revoke all on function public.siparis_onayi_tam(uuid) from anon;
grant execute on function public.siparis_onayi_tam(uuid) to authenticated, service_role;

-- ── 6 · KAPI: ONAY TAMAMLANMADAN ONAYLANDI OLMAZ ──────────────────────────
create or replace function app.siparis_onay_kapisi()
returns trigger
language plpgsql
as $$
declare
  v_eksik text;
  v_tarih date;
begin
  if new.status = 'Onaylandı' and old.status is distinct from 'Onaylandı' then
    if not app.siparis_onayi_tam(new.id) then
      select string_agg(s.name, ', ' order by s.sort_order) into v_eksik
        from public.order_approval_step s
       where s.tenant_id = new.tenant_id and s.is_active and s.required
         and coalesce((
               select a.decision from public.order_approval a
                where a.order_id = new.id and a.step_code = s.code
                  and a.revision_no = new.current_revision
                order by a.decided_at desc, a.id desc limit 1
             ), 'Yok') not in ('Olumlu','Şartlı');
      raise exception
        'Sipariş onaylanamaz: şu adımların onayı eksik → %. '
        'Sipariş revize edildiyse onaylar yeniden alınır — onaylanan miktar '
        'ile gönderilecek miktar aynı olmak zorunda.', v_eksik
        using errcode = 'MI429';
    end if;

    -- Söz verilen tarih: bu revizyonun kararlarındaki EN GEÇ tarih.
    -- En erkeni almak, sözü tutamayacağımız bir tarihi müşteriye söylemek
    -- olurdu.
    select max(a.promised_on) into v_tarih
      from public.order_approval a
     where a.order_id = new.id and a.revision_no = new.current_revision;
    if v_tarih is not null then new.promised_delivery_date := v_tarih; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sales_order_onay_kapisi on sales_order;
create trigger sales_order_onay_kapisi
  before update of status on sales_order
  for each row execute function app.siparis_onay_kapisi();

-- ── 7 · DURUM AKIŞI YENİLENİYOR ───────────────────────────────────────────
-- ⚠️ Bu tablo TS tarafında `IZINLI_GECISLER` olarak da duruyor ve bir test
-- onu BURADAN okuyup karşılaştırıyor. İkisi ayrışırsa test kırmızıya döner.
create or replace function app.siparis_durumu_gecerli()
returns trigger
language plpgsql
as $$
declare
  v_izinli text[];
begin
  if new.status is distinct from old.status then
    v_izinli := case old.status
      when 'Taslak'        then array['Onay Bekliyor','İptal']
      -- Geri çekme serbest: onay sırasında müşteri fikrini değiştirebilir ve
      -- siparişi düzeltmek, iptal edip yenisini açmaktan dürüsttür.
      when 'Onay Bekliyor' then array['Onaylandı','Taslak','İptal']
      when 'Onaylandı'     then array['Hazırlanıyor','İptal']
      when 'Hazırlanıyor'  then array['Hazır','İptal']
      when 'Hazır'         then array['Kısmi Sevk','Sevk Edildi','İptal']
      when 'Kısmi Sevk'    then array['Sevk Edildi','Teslim Edildi']
      when 'Sevk Edildi'   then array['Kısmi Sevk','Teslim Edildi']
      -- Teslim Edildi ve İptal son duraktır. İptalden geri dönüş yeni
      -- SİPARİŞLE olur, durumu geri çevirerek değil: iptalin izi kalsın.
      else array[]::text[]
    end;

    if not (new.status = any (v_izinli)) then
      raise exception 'Sipariş durumu % → % yapılamaz.', old.status, new.status
        using errcode = 'MI422';
    end if;
  end if;
  return new;
end;
$$;

-- ── 8 · OLAY DEFTERİNE ONAY TÜRÜ ──────────────────────────────────────────
alter table sales_order_event drop constraint if exists sales_order_event_kind_check;
alter table sales_order_event add constraint sales_order_event_kind_check
  check (kind in ('AÇILDI','DURUM','REVİZYON','FARK','FARK KARARI','ONAY'));

-- ⚠️ AFTER tetiği: başka tabloya (olay defteri) YAZIYOR. BEFORE olsaydı
-- onay satırı henüz yazılmamış olurdu (0032 tuzağı).
create or replace function app.onay_olayi_yaz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ad text;
begin
  select name into v_ad from public.order_approval_step
   where tenant_id = new.tenant_id and code = new.step_code;

  insert into public.sales_order_event
    (tenant_id, order_id, kind, detail, actor_id)
  values (
    new.tenant_id, new.order_id, 'ONAY',
    coalesce(v_ad, new.step_code) || ': ' || new.decision
      || ' (rev ' || new.revision_no || ')'
      || case when new.promised_on is not null
              then ' · söz: ' || to_char(new.promised_on, 'DD.MM.YYYY') else '' end
      || case when coalesce(new.note,'') <> '' then ' · ' || new.note else '' end,
    new.decided_by
  );
  return null;
end;
$$;

drop trigger if exists order_approval_olay on order_approval;
create trigger order_approval_olay
  after insert on order_approval
  for each row execute function app.onay_olayi_yaz();

-- ── 9 · VARSAYILAN ZİNCİR ─────────────────────────────────────────────────
-- Emrah'ın KISA zinciri: satış onaylar, depo ve üretim görüş bildirir.
-- Uzun zincir isteyen `required` alanını true yapar; kod değişmez.
create or replace function app.onay_zincirini_kur(p_tenant uuid)
returns integer
language plpgsql
as $$
declare
  v_sayac int := 0;
begin
  insert into public.order_approval_step
    (tenant_id, code, name, sort_order, required, permission_code)
  values
    (p_tenant, 'DEPO',   'Depo — hammadde yeterli mi',  1, false, 'stock.read'),
    (p_tenant, 'URETIM', 'Üretim — yoğunluk ve tarih',  2, false, 'production.read'),
    (p_tenant, 'SATIS',  'Satış sorumlusu — onay',      3, true,  'operations.write')
  on conflict (tenant_id, code) do nothing;
  get diagnostics v_sayac = row_count;
  return v_sayac;
end;
$$;

comment on function app.onay_zincirini_kur(uuid) is
  'Bir kiracıya varsayılan onay zincirini kurar: depo ve üretim GÖRÜŞ, satış '
  'ONAY. Var olan adımlara dokunmaz.';

-- Var olan kiracılar
do $$
declare v_t record; v_toplam int := 0;
begin
  for v_t in select id, code from tenant loop
    v_toplam := v_toplam + app.onay_zincirini_kur(v_t.id);
  end loop;
  raise notice '0053: % onay adımı kuruldu.', v_toplam;
end;
$$;

-- Yeni kiracılar — zincir KENDİLİĞİNDEN kurulsun. Elle kurmaya bırakırsak
-- ilk unutulan kiracıda onay zinciri olmayan bir işletme doğar ve bunu
-- kimse fark etmez.
create or replace function app.yeni_kiracinin_onay_zinciri()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.onay_zincirini_kur(new.id);
  return null;
end;
$$;

drop trigger if exists tenant_onay_zinciri on tenant;
create trigger tenant_onay_zinciri
  after insert on tenant
  for each row execute function app.yeni_kiracinin_onay_zinciri();

-- ── 10 · ERİŞİM ───────────────────────────────────────────────────────────
-- ⚠️ RLS ve GRANT AYRI KAPILARDIR (0006).
grant select, insert, update on order_approval_step to authenticated;
grant select, insert         on order_approval      to authenticated;
revoke update, delete on order_approval from authenticated;

-- ── 10B · DENETİM ─────────────────────────────────────────────────────────
-- Zincirin AYARI denetlenir: "SATIS artık bloklamıyor" diye bir değişiklik,
-- onay mekanizmasını sessizce kapatır. Onay KARARLARI denetim listesine
-- girmiyor çünkü zaten eklemeli ve her biri olay defterine düşüyor.
do $$
declare
  t text;
  izlenecek text[] := array[
    'order_approval_step'
  ];
begin
  foreach t in array izlenecek loop
    if to_regclass('public.' || t) is null then
      raise notice 'Denetim atlandı, tablo yok: %', t;
      continue;
    end if;
    execute format('drop trigger if exists %I on public.%I', 'denetim_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function app.denetim_yaz()',
      'denetim_' || t, t
    );
  end loop;
end $$;

-- ── 11 · YAZMA KİLİDİ ─────────────────────────────────────────────────────
do $$
declare v_eksik text;
begin
  perform app.lisans_kilidini_tak();
  select string_agg(a, ', ') into v_eksik
    from unnest(array['order_approval_step','order_approval']) as a
   where not exists (
     select 1 from pg_trigger t
      where t.tgrelid = ('public.' || a)::regclass
        and t.tgname = 'trg_lisans_kilidi_' || a and not t.tgisinternal);
  if v_eksik is not null then
    raise exception '0053: lisans kilidi takılmayan tablo: %', v_eksik;
  end if;
end;
$$;

-- ── 12 · DOĞRULAMA ────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.order_approval') is null
     or to_regclass('public.order_approval_step') is null then
    raise exception '0053: tablolar kurulmadı.';
  end if;

  -- Taslak → Onaylandı KAPALI olmalı.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname='app' and p.proname='siparis_durumu_gecerli'
                and pg_get_functiondef(p.oid) like '%''Taslak''        then array[''Onay Bekliyor''%')
  then null; else
    raise exception '0053: durum akışında Taslak → Onay Bekliyor yok.';
  end if;

  if has_function_privilege('anon','public.siparis_onayi_tam(uuid)','execute') then
    raise exception '0053: anon onay kapısını çağırabiliyor.';
  end if;

  if not exists (select 1 from pg_trigger
      where tgrelid='public.sales_order'::regclass
        and tgname='sales_order_onay_kapisi' and not tgisinternal) then
    raise exception '0053: onay kapısı tetiği takılmadı.';
  end if;

  raise notice '0053 TAMAM · onay zinciri kuruldu · söz verilen tarih siparişe işleniyor · onay revizyona bağlı';
end;
$$;
