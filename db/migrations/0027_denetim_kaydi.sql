-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 4 / Güven katmanı
-- 0027 — Denetim kaydı (kim, ne zaman, neyi değiştirdi)
--
-- Yol haritası maddesi:
--   "İşlem geçmişi / denetim kaydı ekranı"
--
-- ── SORU ─────────────────────────────────────────────────────────────────
-- "Bu sayımı kim iptal etti?" · "Bu stok kartının minimum seviyesini kim
-- düşürdü?" · "Bu sevkiyatın müşterisi neden değişti?" · "Bu HACCP ölçümünü
-- kim sildi?"
--
-- Bugün hiçbirinin cevabı yok. Stok defteri kendi hikâyesini anlatıyor ama
-- BELGELERİN hikâyesini kimse tutmuyor.
--
-- ── NEDEN VERİTABANI TETİKLEYİCİSİ ───────────────────────────────────────
-- Uygulamanın "her kaydetmede bir de log yaz" demesi denetim kaydı DEĞİLDİR:
-- yarın yazılacak bir servis, bir toplu iş ya da SQL konsolundan yapılan tek
-- bir UPDATE o satırı hiç görmez. Denetimde işe yarayan kayıt, ATLANMASI
-- MÜMKÜN OLMAYAN kayıttır. Bu yüzden tetikleyici, verinin yazıldığı yerde
-- duruyor — sayım kilidiyle (0025) ve gerekçe kısıtıyla (0026) aynı gerekçe.
--
-- ── NEDEN stock_movement İZLENMİYOR ──────────────────────────────────────
-- Bilerek. Stok defteri ZATEN append-only ve zaten denetim kaydının kendisi:
-- her hareket kimin, ne zaman, hangi belge için, hangi sebeple yazdığını
-- taşıyor ve hiçbir satırı değişmiyor. Onu bir de buraya kopyalamak yazma
-- hacmini iki katına çıkarır ve TEK BİR YENİ BİLGİ vermez. Denetim kaydı
-- defterin olmadığı yeri doldurur: belgeler ve kartlar.
--
-- ── NEDEN TAM SATIR DEĞİL, YALNIZCA DEĞİŞEN ALANLAR ──────────────────────
-- Her güncellemede satırın tamamını saklamak kaydı kısa sürede okunamaz hale
-- getirir: 40 alanın 39'u aynıyken gözle fark bulmak imkânsızdır. Burada
-- yalnızca DEĞİŞEN alanlar, eski ve yeni değeriyle duruyor. "Ne değişti"
-- sorusunun cevabı tek bakışta görünür.
--
-- ── KAYIT DA SİLİNEMEZ ───────────────────────────────────────────────────
-- Silinebilen denetim kaydı, denetim kaydı değildir. Hem GRANT verilmiyor hem
-- de tetikleyici UPDATE/DELETE'i reddediyor — birincisi istemciyi, ikincisi
-- her yolu kapatır.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Tablo ─────────────────────────────────────────────────────────────
create table if not exists audit_log (
  id            bigserial primary key,
  tenant_id     uuid not null references tenant(id),
  branch_id     uuid references branch(id),

  -- Hangi tablo, hangi satır.
  table_name    text not null,
  row_id        text not null,

  -- INSERT · UPDATE · DELETE
  action        text not null check (action in ('INSERT','UPDATE','DELETE')),

  -- Kim. `auth.uid()` Supabase Auth kullanıcısı; `app_user` karşılığı da
  -- yazılıyor çünkü Auth hesabı silinse bile kaydın "kim" cevabı durmalı.
  actor_auth_id uuid,
  actor_user_id uuid references app_user(id),
  actor_name    text,

  occurred_at   timestamptz not null default now(),

  -- Değişen alanlar: { "alan": { "eski": ..., "yeni": ... } }
  -- INSERT'te yalnızca "yeni", DELETE'te yalnızca "eski" dolu olur.
  changes       jsonb not null default '{}'::jsonb,

  -- İnsan diliyle tek satır — ekranda listelenecek olan bu.
  summary       text
);

comment on table audit_log is
  'Belgelerin ve kartların değişim kaydı. Tetikleyiciyle yazılır, elle yazılamaz, '
  'değiştirilemez, silinemez. stock_movement bilerek DIŞARIDA: o zaten append-only defterdir.';

create index if not exists audit_log_tenant_zaman_idx
  on audit_log (tenant_id, occurred_at desc);
create index if not exists audit_log_satir_idx
  on audit_log (table_name, row_id, occurred_at desc);
create index if not exists audit_log_aktor_idx
  on audit_log (actor_user_id, occurred_at desc);

-- ── 2 · Kaydın kendisi değişmez ───────────────────────────────────────────
create or replace function app.denetim_kaydi_degismez()
returns trigger language plpgsql as $$
begin
  raise exception 'Denetim kaydı değiştirilemez ve silinemez.'
    using hint = 'Yanlış bir kayıt varsa düzeltilmez; yanında doğrusu durur.',
          errcode = 'MI403';
end $$;

drop trigger if exists audit_log_degismez on audit_log;
create trigger audit_log_degismez
  before update or delete on audit_log
  for each row execute function app.denetim_kaydi_degismez();

-- ── 3 · Kim yazıyor ───────────────────────────────────────────────────────
-- `security definer`: `app_user` üzerinde FORCE ROW LEVEL SECURITY var
-- (bkz. 0001) ve tetikleyici içinden okuma RLS'e takılabilir. Aktörü
-- bulamamak kaydı yazmamak için sebep DEĞİLDİR — o yüzden hata durumunda
-- da boş dönüp devam ediyoruz.
--
-- Ad NEDEN kopyalanıyor: kullanıcı silinir ya da adı değişirse, kaydın
-- "kim" cevabı O GÜNKÜ hâliyle durmalı. Denetim kaydı geçmişi anlatır,
-- bugünü değil.
create or replace function app.denetim_aktoru()
returns table (auth_id uuid, user_id uuid, ad text)
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_auth uuid;
  v_id   uuid;
  v_ad   text;
begin
  begin
    v_auth := auth.uid();
  exception when others then v_auth := null;
  end;

  if v_auth is not null then
    begin
      select u.id, nullif(btrim(u.full_name), '')
        into v_id, v_ad
      from public.app_user u
      where u.auth_user_id = v_auth
      limit 1;

      if v_ad is null and v_id is not null then
        select u.username into v_ad from public.app_user u where u.id = v_id;
      end if;
    exception when others then
      v_id := null; v_ad := null;
    end;
  end if;

  auth_id := v_auth; user_id := v_id; ad := v_ad;
  return next;
end $$;

-- ── 4 · Değişen alanları çıkar ────────────────────────────────────────────
-- Gürültü alanları dışarıda: `updated_at` her güncellemede değişir ve hiçbir
-- şey anlatmaz; onu da yazsaydık her kayıtta en az bir "değişiklik" görünür,
-- "hiçbir şey değişmemiş" durumu ayırt edilemezdi.
create or replace function app.denetim_farki(eski jsonb, yeni jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(
           anahtar,
           jsonb_build_object('eski', eski -> anahtar, 'yeni', yeni -> anahtar)
         ), '{}'::jsonb)
  from (
    select key as anahtar
    from jsonb_each(coalesce(yeni, '{}'::jsonb))
    where key not in ('updated_at', 'created_at')
      and (eski -> key) is distinct from (yeni -> key)
    union
    select key
    from jsonb_each(coalesce(eski, '{}'::jsonb))
    where key not in ('updated_at', 'created_at')
      and (eski -> key) is distinct from (yeni -> key)
  ) d
$$;

-- ── 5 · Genel tetikleyici ─────────────────────────────────────────────────
create or replace function app.denetim_yaz()
returns trigger language plpgsql security definer set search_path = public, app as $$
declare
  v_eski     jsonb;
  v_yeni     jsonb;
  v_fark     jsonb;
  v_tenant   uuid;
  v_branch   uuid;
  v_satir    text;
  v_auth     uuid;
  v_user     uuid;
  v_ad       text;
  v_ozet     text;
begin
  v_eski := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_yeni := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_fark := app.denetim_farki(v_eski, v_yeni);

  -- Hiçbir alan değişmediyse kayıt yazmıyoruz. "Kaydet"e basıp hiçbir şey
  -- değiştirmemek bir olay değildir; yazsaydık kayıt boş satırlarla dolar,
  -- gerçek değişiklikler arasında kaybolurdu.
  if tg_op = 'UPDATE' and v_fark = '{}'::jsonb then
    return null;
  end if;

  v_tenant := coalesce(v_yeni ->> 'tenant_id', v_eski ->> 'tenant_id')::uuid;
  -- Tenant'ı olmayan bir satır bu tabloların hiçbirinde olmamalı; olursa
  -- kaydı yazamayız (yabancı anahtar) ama ASIL İŞLEMİ de engellemeyiz.
  if v_tenant is null then return null; end if;

  begin
    v_branch := coalesce(v_yeni ->> 'branch_id', v_eski ->> 'branch_id')::uuid;
  exception when others then v_branch := null;
  end;

  v_satir := coalesce(v_yeni ->> 'id', v_eski ->> 'id', '?');

  select auth_id, user_id, ad into v_auth, v_user, v_ad from app.denetim_aktoru();

  -- Belgeyi tanıyan kısa ad: numarası varsa numarası, yoksa adı, yoksa kodu.
  v_ozet := coalesce(
    v_yeni ->> 'count_no', v_eski ->> 'count_no',
    v_yeni ->> 'shipment_no', v_eski ->> 'shipment_no',
    v_yeni ->> 'name', v_eski ->> 'name',
    v_yeni ->> 'code', v_eski ->> 'code',
    v_yeni ->> 'lot_code', v_eski ->> 'lot_code',
    v_satir
  );

  insert into audit_log (
    tenant_id, branch_id, table_name, row_id, action,
    actor_auth_id, actor_user_id, actor_name, changes, summary
  ) values (
    v_tenant, v_branch, tg_table_name, v_satir, tg_op,
    v_auth, v_user, v_ad,
    case
      when tg_op = 'INSERT' then jsonb_build_object('_kayit', v_yeni)
      when tg_op = 'DELETE' then jsonb_build_object('_kayit', v_eski)
      else v_fark
    end,
    v_ozet
  );

  return null;
end $$;

comment on function app.denetim_yaz() is
  'Genel denetim tetikleyicisi. AFTER olarak bağlanır: asıl işlem başarısız olursa '
  'kayıt da yazılmaz. Değişiklik yoksa satır açmaz.';

-- ── 6 · İzlenen tablolar ──────────────────────────────────────────────────
-- Seçim ölçütü: "bu satır sessizce değişirse birileri zarar görür mü?"
--   Belgeler → sayım, sevkiyat, HACCP ölçüm ve düzeltici işlem
--   Kartlar  → stok kalemi, lot
-- stock_movement YOK (yukarıdaki gerekçe). Referans tabloları (uom, permission)
-- da yok: onlar göçle değişir, kullanıcı eliyle değil.
do $$
declare
  t text;
  izlenecek text[] := array[
    'stock_count', 'stock_count_line',
    'shipment', 'shipment_line',
    'haccp_measurement', 'haccp_corrective_action', 'haccp_ccp', 'haccp_plan',
    'stock_item', 'stock_lot'
  ];
begin
  foreach t in array izlenecek loop
    -- Tablo yoksa atla: göçler farklı sıralarda uygulanmış olabilir.
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

-- ── 7 · Erişim ────────────────────────────────────────────────────────────
-- ⚠️ RLS ve GRANT AYRI KAPILARDIR (bkz. 0006). İkisi de gerekli.
alter table audit_log enable row level security;

drop policy if exists audit_log_okuma on audit_log;
create policy audit_log_okuma on audit_log
  for select
  using (tenant_id = app.current_tenant_id());

-- Yazma politikası YOK ve olmayacak: tek yazan tetikleyici, o da
-- `security definer` olduğu için politikaya takılmıyor.
revoke all on audit_log from authenticated, anon;
grant select on audit_log to authenticated;
revoke all on sequence audit_log_id_seq from authenticated, anon;

-- ── Doğrulama ─────────────────────────────────────────────────────────────
-- Beklenen: 10 satır (izlenen her tablo için bir tetikleyici)
select event_object_table as tablo, trigger_name as tetikleyici
from information_schema.triggers
where trigger_name like 'denetim\_%'
order by 1;
