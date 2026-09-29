-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0051 — SEVKİYAT SİPARİŞE BAĞLANIYOR
-- ═══════════════════════════════════════════════════════════════════════════
-- Yol haritası maddesi: "Siparişten iş emri ve sevkiyat türetme"
--          Bitti sayılır ki: "Sevkiyat siparişten türetiliyor, kalan miktar
--                             sistemden okunuyor, sipariş durumu kendiliğinden
--                             ilerliyor."
--
-- ── NİÇİN ─────────────────────────────────────────────────────────────────
-- 0050 siparişi kurdu, 0023 sevkiyatı. İkisi arasında BAĞ YOKTU. Bağ
-- olmayınca "bu siparişin ne kadarı gitti" sorusunun cevabı da yok; kısmi
-- sevk elle işaretlenen, unutulunca yanlış kalan bir bayrak oluyor.
--
-- ── ÜÇ ŞEY GETİRİYOR ──────────────────────────────────────────────────────
--   1. `shipment.order_id` — sevkiyat hangi siparişin parçası.
--   2. `app.siparis_sevk_durumu()` — kalem kalem: sipariş / sevk / KALAN.
--   3. Sevkiyat SHIPPED olduğunda siparişin durumu KENDİLİĞİNDEN ilerliyor:
--      kalan varsa "Kısmi Sevk", kalmadıysa "Sevk Edildi".
--
-- Emrah'ın kuralı (29.09, sipariş numarası için söylendi, burada da geçerli):
-- "Sistem üretsin daha stabil olur, uğraştırmayalım insanları." Durumu elle
-- ilerletmek, unutulduğunda yanlış rapor üreten bir iştir.
--
-- ── KOLON NİÇİN `not null` DEĞİL ──────────────────────────────────────────
-- Her sevkiyat bir siparişten doğmaz: numune, ikram, iç transfer, telefonla
-- gelen acil bir istek. Bunları siparişsiz bırakmak dürüsttür; uydurma bir
-- siparişe bağlamak defteri kirletir.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · KOLON ─────────────────────────────────────────────────────────────
alter table shipment
  add column if not exists order_id uuid references sales_order(id) on delete restrict;

comment on column shipment.order_id is
  'Bu sevkiyatın parçası olduğu sipariş (0051). BOŞ olabilir: numune, ikram, '
  'iç transfer gibi sevkiyatlar siparişten doğmaz.';

create index if not exists shipment_order_ix on shipment (order_id)
  where order_id is not null;

-- ── 2 · TUTARLILIK ────────────────────────────────────────────────────────
-- Yabancı anahtar "böyle bir sipariş var mı" der, "BU müşterinin mi" demez.
-- Bu, bu projede dördüncü kez karşımıza çıkan sınıf (MI424 üç kez).
create or replace function app.sevkiyat_siparis_tutarli()
returns trigger
language plpgsql
as $$
declare
  v_o record;
begin
  if new.order_id is null then return new; end if;

  select tenant_id, customer_id, delivery_point_id, status, order_no
    into v_o
    from public.sales_order
   where id = new.order_id;

  if v_o.tenant_id is distinct from new.tenant_id then
    raise exception 'Sipariş başka bir işletmeye ait.'
      using errcode = 'MI426';
  end if;

  if new.customer_id is not null and v_o.customer_id is distinct from new.customer_id then
    raise exception
      'Sevkiyatın müşterisi, % siparişinin müşterisi değil. Başka bir '
      'müşterinin malı bu siparişten düşülemez.', v_o.order_no
      using errcode = 'MI426';
  end if;

  -- Teslim noktası: İKİSİ DE doluysa aynı olmalı. Nokta değişecekse önce
  -- siparişe LOJİSTİK revizyonu yazılır (0050) — Emrah'ın kuralı:
  -- "a noktasına değil b noktasına olur" ama bu bir REVİZYONDUR, sessiz bir
  -- sapma değil.
  if new.delivery_point_id is not null
     and v_o.delivery_point_id is not null
     and new.delivery_point_id is distinct from v_o.delivery_point_id then
    raise exception
      'Sevkiyatın teslim noktası, % siparişinin teslim noktası değil. '
      'Nokta değişecekse önce siparişe lojistik revizyonu yazın.', v_o.order_no
      using errcode = 'MI426';
  end if;

  -- Taslak sipariş bir taahhüt değildir; iptal edilmiş sipariş hiç değildir.
  if v_o.status in ('Taslak', 'İptal') then
    raise exception
      '% siparişi "%" durumunda; bu siparişe sevkiyat bağlanamaz.',
      v_o.order_no, v_o.status
      using errcode = 'MI427';
  end if;

  return new;
end;
$$;

comment on function app.sevkiyat_siparis_tutarli() is
  'Sevkiyat–sipariş bağı tutarlı mı: aynı kiracı, aynı müşteri, aynı teslim '
  'noktası (MI426) ve sipariş taslak/iptal değil (MI427).';

drop trigger if exists shipment_siparis_tutarli on shipment;
create trigger shipment_siparis_tutarli
  before insert or update of order_id, customer_id, delivery_point_id on shipment
  for each row execute function app.sevkiyat_siparis_tutarli();

-- ── 3 · KALEM KALEM SEVK DURUMU ───────────────────────────────────────────
-- Sipariş–teslim farkı raporunun da, "kalanı sevk et" düğmesinin de okuduğu
-- yer burası.
--
-- ⚠️ BİRİM UYUŞMAZLIĞI SESSİZCE ÇIKARILMIYOR. Sipariş 100 kg, sevkiyat
-- 5 koli ise 100−5=95 YANLIŞTIR ve yanlış olduğu belli olmaz. Böyle bir
-- durumda `kalan` NULL döner, `birim_uyusmuyor` doğrudur; ekran soruyu
-- insana bırakır. Uydurulmuş bir sayı, boş bir hücreden daha tehlikelidir.
--
-- ⚠️ Çıktı sütun adları TÜRKÇE: `language sql` fonksiyonlarında RETURNS TABLE
-- adları OUT parametresidir ve gövdedeki sütun adlarıyla çakışabilir.
create or replace function app.siparis_sevk_durumu(p_siparis uuid)
returns table (
  kalem_id        uuid,
  siparis_miktar  numeric,
  siparis_birim   text,
  sevk_miktar     numeric,
  sevk_birimleri  text[],
  kalan           numeric,
  birim_uyusmuyor boolean,
  siparis_disi    boolean
)
language sql
stable
as $$
  with siparilen as (
    select s.stock_item_id as kid, s.qty, s.uom_code
      from app.siparis_guncel_satirlari(p_siparis) s
  ),
  sevkedilen as (
    select l.stock_item_id as kid,
           sum(l.qty)                  as qty,
           array_agg(distinct l.uom)   as birimler
      from public.shipment_line l
      join public.shipment sh on sh.id = l.shipment_id
     where sh.order_id = p_siparis
       and sh.status = 'SHIPPED'
     group by l.stock_item_id
  )
  select
    coalesce(si.kid, se.kid),
    si.qty,
    si.uom_code,
    coalesce(se.qty, 0),
    coalesce(se.birimler, array[]::text[]),
    case
      when si.kid is null            then null            -- siparişte olmayan kalem
      when se.birimler is null       then si.qty          -- hiç sevk edilmemiş
      when se.birimler = array[si.uom_code] then si.qty - se.qty
      else null                                            -- birimler farklı
    end,
    coalesce(si.kid is not null and se.birimler is not null
             and se.birimler <> array[si.uom_code], false),
    si.kid is null
  from siparilen si
  full join sevkedilen se on se.kid = si.kid;
$$;

comment on function app.siparis_sevk_durumu(uuid) is
  'Siparişin kalem kalem sevk durumu: sipariş miktarı, SEVK EDİLMİŞ '
  'sevkiyatların toplamı ve KALAN. Birimler uyuşmuyorsa kalan NULL döner '
  '(birim_uyusmuyor=true): farklı birimdeki iki sayı çıkarılmaz. '
  'siparis_disi=true, siparişte olmayan bir kalemin gönderildiğini söyler.';

-- ── 4 · DIŞ KAPI ──────────────────────────────────────────────────────────
-- PostgREST yalnız `public` şemasını yayımlar; `app.*` dışarıdan görünmez.
-- ⚠️ Sarmalayıcı bilerek `security definer` DEĞİL: çağıranın RLS'i geçerli
-- kalsın, başka kiracının siparişi okunamasın (0048'deki karar).
create or replace function public.siparis_sevk_durumu(p_siparis uuid)
returns table (
  kalem_id        uuid,
  siparis_miktar  numeric,
  siparis_birim   text,
  sevk_miktar     numeric,
  sevk_birimleri  text[],
  kalan           numeric,
  birim_uyusmuyor boolean,
  siparis_disi    boolean
)
language sql
stable
as $$
  select * from app.siparis_sevk_durumu(p_siparis);
$$;

revoke all on function public.siparis_sevk_durumu(uuid) from public;
revoke all on function public.siparis_sevk_durumu(uuid) from anon;
grant execute on function public.siparis_sevk_durumu(uuid) to authenticated, service_role;

-- ── 5 · SİPARİŞ DURUMUNU SİSTEM İLERLETİYOR ───────────────────────────────
-- ⚠️ AFTER tetiği. BEFORE tetiği BAŞKA BİR TABLOYA YAZAMAZ — bu 0032'de bir
-- kez öğrenildi ve tuzak defterinde duruyor.
create or replace function app.sevkiyat_siparisi_ilerlet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_durum     text;
  v_no        text;
  v_kalan_var boolean;
  v_yeni      text;
begin
  if new.order_id is null then return null; end if;
  if new.status is distinct from 'SHIPPED' then return null; end if;

  -- Zaten sevk edilmiş ve siparişi değişmemişse tekrar hesaplama.
  if tg_op = 'UPDATE'
     and old.status = 'SHIPPED'
     and old.order_id is not distinct from new.order_id then
    return null;
  end if;

  select status, order_no into v_durum, v_no
    from public.sales_order where id = new.order_id;

  -- Hazır olmayan bir siparişin malı yola çıkmaz. Buradan geçirseydik
  -- 0050'nin durum tetiği anlaşılmaz bir MI422 ile patlardı; kullanıcı
  -- neyi düzelteceğini bilemezdi.
  if v_durum not in ('Hazır', 'Kısmi Sevk', 'Sevk Edildi') then
    raise exception
      '% siparişi "%" durumunda. Sevkiyatı sevk edebilmek için önce '
      'siparişi "Hazır" yapın.', v_no, v_durum
      using errcode = 'MI428';
  end if;

  -- ⚠️ Birimi uyuşmayan kalem (kalan IS NULL) "kalmış" sayılıyor. Bilmediğimiz
  -- bir şeyi "bitti" diye işaretlemek, siparişi kapatıp farkı görünmez yapar.
  select exists (
    select 1 from app.siparis_sevk_durumu(new.order_id)
     where siparis_disi = false
       and (kalan is null or kalan > 0)
  ) into v_kalan_var;

  v_yeni := case when v_kalan_var then 'Kısmi Sevk' else 'Sevk Edildi' end;

  if v_durum is distinct from v_yeni then
    update public.sales_order set status = v_yeni where id = new.order_id;
  end if;

  return null;
end;
$$;

comment on function app.sevkiyat_siparisi_ilerlet() is
  'Sevkiyat SHIPPED olunca siparişin durumunu ilerletir: kalan varsa '
  '"Kısmi Sevk", kalmadıysa "Sevk Edildi". Sipariş "Hazır" değilse MI428. '
  'AFTER tetiği: BEFORE başka tabloya yazamaz.';

drop trigger if exists shipment_siparisi_ilerlet on shipment;
create trigger shipment_siparisi_ilerlet
  after insert or update of status, order_id on shipment
  for each row execute function app.sevkiyat_siparisi_ilerlet();

-- Yeni KİRACI TABLOSU eklenmedi (yalnız kolon), o yüzden
-- `app.lisans_kilidini_tak()` çağrılmıyor: `shipment` kilidi 0046'dan beri
-- takılı ve kolon eklemek onu düşürmez.

-- ── 6 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare
  v_say int;
begin
  if to_regclass('public.shipment') is null then
    raise exception '0051: shipment tablosu yok.';
  end if;

  select count(*) into v_say
    from information_schema.columns
   where table_schema = 'public' and table_name = 'shipment' and column_name = 'order_id';
  if v_say <> 1 then raise exception '0051: shipment.order_id açılmadı.'; end if;

  select count(*) into v_say from pg_trigger
   where tgrelid = 'public.shipment'::regclass
     and tgname in ('shipment_siparis_tutarli', 'shipment_siparisi_ilerlet')
     and not tgisinternal;
  if v_say <> 2 then
    raise exception '0051: tetiklerden biri takılmadı (bulunan: %).', v_say;
  end if;

  -- Sarmalayıcı anon'a KAPALI olmalı.
  if has_function_privilege('anon', 'public.siparis_sevk_durumu(uuid)', 'execute') then
    raise exception '0051: anon siparis_sevk_durumu çalıştırabiliyor.';
  end if;
  if not has_function_privilege('authenticated', 'public.siparis_sevk_durumu(uuid)', 'execute') then
    raise exception '0051: authenticated siparis_sevk_durumu çalıştıramıyor.';
  end if;

  raise notice '0051 TAMAM · sevkiyat siparişe bağlandı · kalan miktar okunuyor · durum kendiliğinden ilerliyor';
end;
$$;
