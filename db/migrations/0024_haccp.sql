-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 3.5 / Endüstriyel mutfak kapsamı
-- 0024 — HACCP: kritik kontrol noktaları, ölçüm kayıtları, düzeltici faaliyet
--
-- ── NEDEN BU TABLOLAR, MOCK'TAKİ MODEL VARKEN ────────────────────────────
-- Kod tabanında zaten iyi bir HACCP modeli duruyor (`src/haccp/haccp.types.ts`:
-- plan → CCP → tehlike → izleme kaydı → düzeltici faaliyet → doğrulama).
-- Bu göç onu SIFIRDAN TASARLAMIYOR; gerçek deftere BAĞLIYOR ve tek bir yerde
-- düzeltiyor:
--
--   Mock'ta kritik limit bir METİNDİ: criticalLimit: "≤ 4°C"
--
-- Metinden PASS/FAIL hesaplanamaz. İnsan "4,5 yazdım, uygun mu?" diye sorar ve
-- cevabı yine insan verir — yani kayıt tutulur ama KONTROL edilmez. HACCP'in
-- bütün anlamı otomatik kontrolde. Burada limit ÜÇ KOLON:
--   limit_type ('MAX' | 'MIN' | 'RANGE') + limit_min + limit_max + uom
-- Görüntülenecek metin ayrıca duruyor (limit_text) ama karar sayıdan çıkıyor.
--
-- ── İKİNCİ FARK: ÖLÇÜM ZİNCİRE BAĞLI ─────────────────────────────────────
-- `haccp_measurement.source_type/source_id` bir mal kabul belgesine, bir iş
-- emrine ya da bir soğuk odaya bağlanır; `lot_id` ise partiye. Böylece
-- "limit aşılmış bir ölçüm hangi partide, o parti kime gitti" sorusu
-- İzlenebilirlik ekranından cevaplanabilir. Mock bunu asla yapamaz: sahte
-- kayıt gerçek partiye bağlanamaz.
--
-- ── ÜÇÜNCÜ FARK: ÖLÇÜM SİLİNMEZ ──────────────────────────────────────────
-- HACCP kaydı yasal kayıttır. Stok defteriyle aynı kural (ADR-001):
-- append-only. Yanlış ölçüm ÜSTÜNE YAZILMAZ; iptal edilir ve gerekçesi
-- kalır. Denetimde "bu kaydı sonradan düzelttiniz mi" sorusunun cevabı
-- veritabanı seviyesinde garanti.
--
-- ── KAPSAM KARARI ────────────────────────────────────────────────────────
-- Tehlike (hazard) ayrı tablo YAPILMADI: mutfakta CCP başına tehlike pratikte
-- birdir, ayrı tablo boş kalırdı. CCP üstünde iki kolon olarak duruyor.
-- Doğrulama (verification) da düzeltici faaliyetin üstünde iki kolon;
-- ayrı bir doğrulama defteri Aşama 4 işi. Boş bir tablo, olmayan bir
-- tablodan kötüdür.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Plan ──────────────────────────────────────────────────────────────────
create table if not exists haccp_plan (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant(id) on delete restrict,
  code        text not null,
  name        text not null check (btrim(name) <> ''),
  description text,
  status      text not null default 'ACTIVE'
                check (status in ('DRAFT','ACTIVE','UNDER_REVIEW','ARCHIVED')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint haccp_plan_code_unique unique (tenant_id, code)
);

-- ── Kritik kontrol noktası ────────────────────────────────────────────────
create table if not exists haccp_ccp (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant(id) on delete restrict,
  plan_id     uuid not null references haccp_plan(id) on delete cascade,
  code        text not null,
  name        text not null check (btrim(name) <> ''),

  -- Üretim akışındaki yeri. Ölçüm formu bu alana göre doğru ekranda çıkıyor.
  stage       text not null check (stage in (
                'RECEIVING','STORAGE','PREPARATION','COOKING',
                'BLAST_CHILLING','HOT_HOLDING','PACKAGING','LABELING','DISPATCH')),

  -- ⚠️ KARAR SAYIDAN ÇIKAR. Metin yalnızca gösterim/çıktı içindir.
  limit_type  text not null check (limit_type in ('MAX','MIN','RANGE')),
  limit_min   numeric(12,3),
  limit_max   numeric(12,3),
  uom         text not null default '°C',
  limit_text  text,

  -- MAX limitte üst sınır, MIN limitte alt sınır zorunlu; RANGE'de ikisi de.
  constraint haccp_ccp_limit_dolu check (
    (limit_type = 'MAX'   and limit_max is not null) or
    (limit_type = 'MIN'   and limit_min is not null) or
    (limit_type = 'RANGE' and limit_min is not null and limit_max is not null
                          and limit_min <= limit_max)
  ),

  monitoring_method    text,
  monitoring_frequency text,
  responsible_role     text,

  -- Tehlike, ayrı tablo değil iki kolon (yukarıdaki kapsam kararı).
  hazard_type text check (hazard_type in ('BIOLOGICAL','CHEMICAL','PHYSICAL','ALLERGEN')),
  hazard_note text,

  -- Limit aşılınca ne yapılacağı. Denetçinin ilk sorduğu şey budur.
  corrective_instruction text,

  status      text not null default 'ACTIVE'
                check (status in ('ACTIVE','PASSIVE','SUSPENDED')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint haccp_ccp_code_unique unique (tenant_id, code)
);

create index if not exists haccp_ccp_plan_ix  on haccp_ccp (tenant_id, plan_id, status);
create index if not exists haccp_ccp_stage_ix on haccp_ccp (tenant_id, stage, status);

-- ── Ölçüm kaydı (append-only) ─────────────────────────────────────────────
create table if not exists haccp_measurement (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenant(id) on delete restrict,
  branch_id    uuid not null references branch(id) on delete restrict,
  ccp_id       uuid not null references haccp_ccp(id) on delete restrict,

  measured_value numeric(12,3) not null,
  uom            text not null,

  -- PASS/FAIL, YAZMA anında limitten hesaplanıp DONDURULUYOR. Limit yarın
  -- değişirse dünkü kayıt dünkü limite göre kalır — denetimde doğru olan bu.
  result         text not null check (result in ('PASS','FAIL')),
  limit_snapshot text not null,

  -- Zincire bağ. Bunlar olmadan ölçüm bir kâğıt parçasıdır.
  source_type  text not null check (source_type in
                 ('goods_receipt','work_order','cold_room','shipment','manual')),
  source_id    uuid,
  lot_id       uuid references stock_lot(id) on delete restrict,
  stock_item_id uuid references stock_item(id) on delete restrict,

  measured_at  timestamptz not null default now(),
  measured_by  uuid references app_user(id) on delete set null,
  note         text,

  -- İptal: kayıt SİLİNMEZ, iptal işaretlenir ve gerekçesi durur.
  cancelled_at   timestamptz,
  cancel_reason  text,
  constraint haccp_measurement_iptal_gerekce check (
    cancelled_at is null or btrim(coalesce(cancel_reason,'')) <> ''
  ),

  created_at   timestamptz not null default now()
);

create index if not exists haccp_measurement_ccp_ix    on haccp_measurement (tenant_id, ccp_id, measured_at desc);
create index if not exists haccp_measurement_kaynak_ix on haccp_measurement (source_type, source_id);
create index if not exists haccp_measurement_lot_ix    on haccp_measurement (lot_id);
create index if not exists haccp_measurement_fail_ix   on haccp_measurement (tenant_id, result, measured_at desc);

-- ── Düzeltici faaliyet ────────────────────────────────────────────────────
-- FAIL bir ölçüm, KENDİLİĞİNDEN bir düzeltici faaliyet açar (servis yazar).
-- Açık kalan faaliyet sayısı kontrol panelindeki gerçek rakamdır.
create table if not exists haccp_corrective_action (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  measurement_id uuid not null references haccp_measurement(id) on delete restrict,
  description    text not null check (btrim(description) <> ''),
  assigned_role  text,
  status         text not null default 'OPEN'
                   check (status in ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED')),
  action_taken   text,
  completed_at   timestamptz,

  -- Doğrulama, ayrı tablo değil iki kolon (kapsam kararı).
  verified_by    uuid references app_user(id) on delete set null,
  verified_at    timestamptz,
  verification_note text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Kapanmış bir faaliyet ne yapıldığını SÖYLEMEK ZORUNDA.
  constraint haccp_action_kapanis check (
    status <> 'COMPLETED'
    or (completed_at is not null and btrim(coalesce(action_taken,'')) <> '')
  ),
  -- Bir ölçüme bir faaliyet: ikinci kez FAIL yazılırsa yeni ölçüm, yeni faaliyet.
  constraint haccp_action_olcum_unique unique (measurement_id)
);

create index if not exists haccp_action_acik_ix on haccp_corrective_action (tenant_id, status);

-- ── Append-only zorlaması ─────────────────────────────────────────────────
-- Uygulama katmanına güvenilmez (ADR-001 ile aynı gerekçe). Ölçümün
-- yalnızca iptal kolonları güncellenebilir; ölçülen değer ve sonuç ASLA.
create or replace function app.haccp_measurement_is_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'HACCP ölçüm kaydı silinemez. Yanlış kayıt İPTAL edilir.';
  end if;

  if new.measured_value is distinct from old.measured_value
     or new.result       is distinct from old.result
     or new.ccp_id       is distinct from old.ccp_id
     or new.measured_at  is distinct from old.measured_at
     or new.limit_snapshot is distinct from old.limit_snapshot
     or new.source_type  is distinct from old.source_type
     or new.source_id    is distinct from old.source_id
     or new.lot_id       is distinct from old.lot_id then
    raise exception 'HACCP ölçümü değiştirilemez. Düzeltme = iptal + yeni ölçüm.';
  end if;

  return new;
end $$;

drop trigger if exists haccp_measurement_immutable on haccp_measurement;
create trigger haccp_measurement_immutable
  before update or delete on haccp_measurement
  for each row execute function app.haccp_measurement_is_immutable();

drop trigger if exists haccp_plan_touch on haccp_plan;
create trigger haccp_plan_touch before update on haccp_plan
  for each row execute function app.touch_updated_at();

drop trigger if exists haccp_ccp_touch on haccp_ccp;
create trigger haccp_ccp_touch before update on haccp_ccp
  for each row execute function app.touch_updated_at();

drop trigger if exists haccp_action_touch on haccp_corrective_action;
create trigger haccp_action_touch before update on haccp_corrective_action
  for each row execute function app.touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['haccp_plan','haccp_ccp','haccp_measurement','haccp_corrective_action'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    execute format('drop policy if exists %I on %I', t || '_tenant_isolation', t);
    execute format(
      'create policy %I on %I using (tenant_id = app.current_tenant_id()) '
      'with check (tenant_id = app.current_tenant_id())',
      t || '_tenant_isolation', t);
  end loop;
end $$;

-- ── İzinler ───────────────────────────────────────────────────────────────
-- ⚠️ RLS ve GRANT AYRI KAPILARDIR. Politika yazmak tabloya erişim vermez.
grant select, insert, update on haccp_plan             to authenticated;
grant select, insert, update on haccp_ccp              to authenticated;
-- Ölçümde DELETE YOK ve UPDATE yalnızca iptal için (trigger sınırlıyor).
grant select, insert, update on haccp_measurement      to authenticated;
grant select, insert, update on haccp_corrective_action to authenticated;
revoke all privileges on haccp_plan, haccp_ccp, haccp_measurement,
                         haccp_corrective_action from anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- STANDART CCP SETİ — her kiracı için
--
-- Boş bir HACCP ekranı, olmayan bir HACCP ekranından biraz daha iyidir.
-- Bu yüzden endüstriyel mutfağın gerçek kritik noktaları hazır geliyor;
-- işletme kendi limitini değiştirebilir ama sıfırdan kurmak zorunda değil.
-- Limitler Türkiye'de yaygın gıda güvenliği uygulamasına göre.
-- ═══════════════════════════════════════════════════════════════════════════
insert into haccp_plan (tenant_id, code, name, description, status)
select t.id, 'HP-01', 'Endüstriyel Mutfak HACCP Planı',
       'Mal kabulden sevkiyata kadar kritik kontrol noktaları.', 'ACTIVE'
from tenant t
on conflict (tenant_id, code) do nothing;

insert into haccp_ccp (
  tenant_id, plan_id, code, name, stage,
  limit_type, limit_min, limit_max, uom, limit_text,
  monitoring_method, monitoring_frequency, responsible_role,
  hazard_type, hazard_note, corrective_instruction)
select p.tenant_id, p.id, v.code, v.name, v.stage,
       v.limit_type, v.limit_min, v.limit_max, v.uom, v.limit_text,
       v.method, v.freq, v.role, v.hazard, v.hazard_note, v.corrective
from haccp_plan p
cross join (values
  ('CCP-1','Soğuk zincir · mal kabul','RECEIVING','MAX',null,4.0,'°C','En çok 4 °C',
   'Prob termometre, ürün merkezinden','Her teslimatta','Depo sorumlusu','BIOLOGICAL',
   'Soğuk zincir kırılması patojen üremesine yol açar',
   'Malı KABUL ETME. Tedarikçiye iade et, gerekçeyi belgeye yaz.'),
  ('CCP-2','Donmuş ürün · mal kabul','RECEIVING','MAX',null,-18.0,'°C','En çok -18 °C',
   'Prob termometre','Her teslimatta','Depo sorumlusu','BIOLOGICAL',
   'Kısmi çözünme ve yeniden donma',
   'Malı kabul etme; çözünme izi varsa kesinlikle iade.'),
  ('CCP-3','Soğuk oda sıcaklığı','STORAGE','RANGE',0.0,4.0,'°C','0 – 4 °C',
   'Oda termometresi','Günde 2 kez','Depo sorumlusu','BIOLOGICAL',
   'Depolama sıcaklığının yükselmesi',
   'Ürünleri başka odaya al, tekniğe haber ver, etkilenen partileri blokla.'),
  ('CCP-4','Derin donduruculu depo','STORAGE','MAX',null,-18.0,'°C','En çok -18 °C',
   'Oda termometresi','Günde 2 kez','Depo sorumlusu','BIOLOGICAL',
   'Çözünme',
   'Ürünleri başka dondurucuya al; çözünmüş ürünü imhaya ayır.'),
  ('CCP-5','Pişirme merkez sıcaklığı','COOKING','MIN',75.0,null,'°C','En az 75 °C',
   'Prob termometre, en kalın noktadan','Her kazanda','Üretim sorumlusu','BIOLOGICAL',
   'Patojenlerin canlı kalması',
   'Pişirmeye devam et, 75 °C sağlanana kadar ürünü çıkarma.'),
  ('CCP-6','Hızlı soğutma · 2 saatte 10 °C','BLAST_CHILLING','MAX',null,10.0,'°C',
   'En çok 10 °C (2 saat içinde)',
   'Prob termometre, şoklama çıkışında','Her partide','Üretim sorumlusu','BIOLOGICAL',
   'Tehlikeli sıcaklık aralığında geçirilen süre',
   'Soğutmaya devam et; 2 saat aşıldıysa ürünü imhaya ayır.'),
  ('CCP-7','Sıcak servis bekletme','HOT_HOLDING','MIN',65.0,null,'°C','En az 65 °C',
   'Prob termometre','Saat başı','Mutfak sorumlusu','BIOLOGICAL',
   'Bekletmede patojen üremesi',
   'Yeniden 75 °C''ye ısıt; 2 saatten uzun süre 65 °C altındaysa imha.'),
  ('CCP-8','Sevkiyat aracı sıcaklığı','DISPATCH','MAX',null,4.0,'°C','En çok 4 °C',
   'Araç termometresi, yükleme öncesi','Her seferde','Sevkiyat sorumlusu','BIOLOGICAL',
   'Dağıtımda soğuk zincir kırılması',
   'Aracı yükleme, soğutmayı çalıştır; kırılma olduysa sevkiyatı durdur.')
) as v(code, name, stage, limit_type, limit_min, limit_max, uom, limit_text,
       method, freq, role, hazard, hazard_note, corrective)
where p.code = 'HP-01'
on conflict (tenant_id, code) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- DOĞRULAMA
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) RLS açık, zorlanıyor, politikası var mı?
select c.relname as tablo,
       case when c.relrowsecurity      then 'açık' else 'KAPALI' end as rls,
       case when c.relforcerowsecurity then 'evet' else 'hayır'  end as force,
       (select count(*) from pg_policies p where p.tablename = c.relname) as politika
from pg_class c
where c.relname in ('haccp_plan','haccp_ccp','haccp_measurement','haccp_corrective_action')
order by c.relname;

-- 2) İzinler — boş dönerse ekran "permission denied" verir.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as izinler
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('haccp_plan','haccp_ccp','haccp_measurement','haccp_corrective_action')
  and grantee in ('authenticated','anon')
group by table_name, grantee
order by table_name, grantee;

-- 3) Standart CCP seti yüklendi mi? 8 satır dönmeli.
select code, name, stage, limit_type, limit_min, limit_max, uom, limit_text
from haccp_ccp
order by code;
