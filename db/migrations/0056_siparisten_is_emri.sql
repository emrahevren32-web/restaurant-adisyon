-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0056 — SİPARİŞTEN İŞ EMRİ TÜRETME
-- ═══════════════════════════════════════════════════════════════════════════
-- Yol haritası maddesi: "Siparişten iş emri türetme"
--          Bitti sayılır ki: "Depoda olan depodan, olmayan üretimden
--                             karşılanıyor"
--
-- ── SORU ──────────────────────────────────────────────────────────────────
-- Sipariş onaylandı. Mutfak ne üretecek? Cevabı elle hesaplamak demek, her
-- sipariş için birinin depoya bakıp çıkarma yapması demektir — ve o kişi
-- yorulduğunda yanlış hesaplar.
--
-- ── ⚠️ "DEPODA OLAN" NE DEMEK ─────────────────────────────────────────────
-- Ham bakiye YETMEZ. Aynı kalemi bekleyen BAŞKA siparişler varsa, bakiyenin
-- tamamını bu siparişe saymak iki siparişe aynı malı vaat etmektir ve ikisi
-- de eksik çıkar. O yüzden:
--
--      müsait = depo bakiyesi − (diğer açık siparişlerin KALANI)
--
-- Diğer açık sipariş = onaylanmış ama henüz sevk edilmemiş siparişler.
-- Taslak ve onay bekleyen siparişler sayılmıyor: henüz taahhüt değiller.
--
-- ── ⚠️ BİRİM UYUŞMAZLIĞI ──────────────────────────────────────────────────
-- Sipariş satırının birimi ile kalemin TEMEL birimi farklıysa çıkarma
-- YAPILMIYOR (0051'deki aynı kural). 100 kg'dan 5 koli çıkarmak, yanlış
-- olduğu belli olmayan bir sayı üretir.
--
-- ── ⚠️ ÜRETİLEMEYEN KALEM ─────────────────────────────────────────────────
-- Reçetesi olmayan kalem ÜRETİLEMEZ; satın alınır. Plan bunu söylüyor,
-- "üretilecek" diye bir iş emri önermiyor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · İŞ EMRİ SİPARİŞE BAĞLANIYOR ───────────────────────────────────────
alter table work_order
  add column if not exists order_id uuid references sales_order(id) on delete restrict;

comment on column work_order.order_id is
  'Bu iş emrinin karşıladığı sipariş (0056). BOŞ olabilir: stoğa üretim, '
  'numune ve deneme üretimleri siparişten doğmaz.';

create index if not exists work_order_order_ix on work_order (order_id)
  where order_id is not null;

create or replace function app.is_emri_siparis_tutarli()
returns trigger
language plpgsql
as $$
begin
  if new.order_id is null then return new; end if;
  if not exists (select 1 from public.sales_order
                  where id = new.order_id and tenant_id = new.tenant_id) then
    raise exception 'İş emri başka bir işletmenin siparişine bağlanamaz.'
      using errcode = 'MI426';
  end if;
  return new;
end;
$$;

drop trigger if exists work_order_siparis_tutarli on work_order;
create trigger work_order_siparis_tutarli
  before insert or update of order_id on work_order
  for each row execute function app.is_emri_siparis_tutarli();

-- ── 2 · BAŞKA SİPARİŞLERE AYRILMIŞ MİKTAR ─────────────────────────────────
-- "Açık" sipariş: onaylanmış ama henüz tamamı sevk edilmemiş.
-- ⚠️ Nitelikli adlar + `set search_path = ''`: bu fonksiyon sertleştirilmiş
-- bağlamlardan çağrılabiliyor (tuzak 44, 0054'te öğrenildi).
create or replace function app.kalem_rezervi(
  p_kalem uuid, p_sube uuid, p_haric uuid default null
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(k.kalan), 0)
    from public.sales_order o
    cross join lateral app.siparis_sevk_durumu(o.id) k
   where o.branch_id = p_sube
     and o.status in ('Onaylandı','Hazırlanıyor','Hazır','Kısmi Sevk')
     and (p_haric is null or o.id <> p_haric)
     and k.kalem_id = p_kalem
     and k.siparis_disi = false
     and k.birim_uyusmuyor = false
     and k.kalan > 0;
$$;

comment on function app.kalem_rezervi(uuid, uuid, uuid) is
  'Bu kalemden, BAŞKA açık siparişlere söz verilmiş ve henüz sevk edilmemiş '
  'miktar. Bakiyeden düşülmezse aynı mal iki siparişe vaat edilir.';

-- ── 3 · KARŞILAMA PLANI ───────────────────────────────────────────────────
-- ⚠️ Çıktı sütun adları TÜRKÇE: `language sql`da RETURNS TABLE adları OUT
-- parametresidir ve gövdedeki sütun adlarıyla çakışır.
create or replace function app.siparis_karsilama_plani(p_siparis uuid)
returns table (
  kalem_id        uuid,
  kalem_adi       text,
  siparis_miktar  numeric,
  birim           text,
  temel_birim     text,
  birim_uyusmuyor boolean,
  depo_bakiye     numeric,
  rezerve         numeric,
  musait          numeric,
  depodan         numeric,
  uretilecek      numeric,
  recete_id       uuid,
  uretilebilir    boolean
)
language sql
stable
set search_path = ''
as $$
  with s as (
    select o.id as oid, o.branch_id, o.tenant_id from public.sales_order o
     where o.id = p_siparis
  ),
  satir as (
    select l.stock_item_id as kid, l.qty, l.uom_code
      from app.siparis_guncel_satirlari(p_siparis) l
  ),
  hesap as (
    select
      satir.kid,
      si.name                       as ad,
      satir.qty                     as istenen,
      satir.uom_code                as birim,
      si.base_uom                   as temel,
      (satir.uom_code is distinct from si.base_uom) as uyusmaz,
      coalesce(b.qty, 0)            as bakiye,
      app.kalem_rezervi(satir.kid, s.branch_id, s.oid) as rez,
      r.id                          as rid
    from satir
    join s on true
    join public.stock_item si on si.id = satir.kid
    left join public.stock_balance b
           on b.stock_item_id = satir.kid and b.branch_id = s.branch_id
    -- Aktif reçete. Kalem üretilebiliyor mu sorusunun tek cevabı budur.
    left join lateral (
      select r2.id from public.recipe r2
       where r2.output_item_id = satir.kid
         and r2.tenant_id = s.tenant_id
         and r2.status = 'ACTIVE'
       order by r2.created_at desc limit 1
    ) r on true
  )
  select
    h.kid, h.ad, h.istenen, h.birim, h.temel, h.uyusmaz,
    h.bakiye, h.rez,
    case when h.uyusmaz then null else greatest(h.bakiye - h.rez, 0) end,
    -- Depodan karşılanacak: müsait kadarı, ama istenenden fazlası değil.
    case when h.uyusmaz then null
         else least(h.istenen, greatest(h.bakiye - h.rez, 0)) end,
    -- Üretilecek: kalanı. Birim uyuşmuyorsa HESAPLANMIYOR.
    case when h.uyusmaz then null
         else greatest(h.istenen - greatest(h.bakiye - h.rez, 0), 0) end,
    h.rid,
    h.rid is not null
  from hesap h
  order by h.ad;
$$;

comment on function app.siparis_karsilama_plani(uuid) is
  'Siparişi kalem kalem nasıl karşılarız: depodan ne kadar, üretimden ne '
  'kadar. Müsait = bakiye − başka açık siparişlerin kalanı. Birimler '
  'uyuşmuyorsa çıkarma YAPILMIYOR (null döner). Reçetesi olmayan kalem '
  'üretilemez; uretilebilir=false ile söylenir.';

-- ── 4 · DIŞ KAPI ──────────────────────────────────────────────────────────
-- ⚠️ Sarmalayıcı bilerek `security definer` DEĞİL: çağıranın RLS'i geçerli
-- kalsın, başka kiracının siparişi okunamasın (0048'deki karar).
create or replace function public.siparis_karsilama_plani(p_siparis uuid)
returns table (
  kalem_id        uuid,
  kalem_adi       text,
  siparis_miktar  numeric,
  birim           text,
  temel_birim     text,
  birim_uyusmuyor boolean,
  depo_bakiye     numeric,
  rezerve         numeric,
  musait          numeric,
  depodan         numeric,
  uretilecek      numeric,
  recete_id       uuid,
  uretilebilir    boolean
)
language sql
stable
as $$ select * from app.siparis_karsilama_plani(p_siparis); $$;

revoke all on function public.siparis_karsilama_plani(uuid) from public;
revoke all on function public.siparis_karsilama_plani(uuid) from anon;
grant execute on function public.siparis_karsilama_plani(uuid) to authenticated, service_role;

-- Yeni kiracı TABLOSU eklenmedi (yalnız kolon); `app.lisans_kilidini_tak()`
-- çağrılmıyor: `work_order` kilidi 0046'dan beri takılı.

-- ── 5 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='work_order' and column_name='order_id') then
    raise exception '0056: work_order.order_id açılmadı.';
  end if;
  if not exists (select 1 from pg_trigger
      where tgrelid='public.work_order'::regclass
        and tgname='work_order_siparis_tutarli' and not tgisinternal) then
    raise exception '0056: tutarlılık tetiği takılmadı.';
  end if;
  if has_function_privilege('anon','public.siparis_karsilama_plani(uuid)','execute') then
    raise exception '0056: anon karşılama planını okuyabiliyor.';
  end if;
  if not has_function_privilege('authenticated','public.siparis_karsilama_plani(uuid)','execute') then
    raise exception '0056: authenticated karşılama planını okuyamıyor.';
  end if;
  raise notice '0056 TAMAM · karşılama planı · depoda olan depodan, olmayan üretimden';
end;
$$;
