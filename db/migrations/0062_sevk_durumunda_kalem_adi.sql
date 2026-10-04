-- ═══════════════════════════════════════════════════════════════════════════
-- 0062 · SEVK DURUMUNDA ÜRÜN ADI
-- ---------------------------------------------------------------------------
-- Emrah ekranda şunu gördü (04.10.2026):
--
--   ÜRÜN                                    SİPARİŞ  GİDEN  KALAN
--   8a8a4988-fa77-46f9-a9ea-28b4cbc22d5c    45 kg      0     45
--
-- Sipariş kartının **Sevk durumu** sekmesi ürün adı yerine ham kimlik
-- basıyordu. Sebep: `siparis_sevk_durumu` (0051) yalnız `kalem_id`
-- döndürüyor, ad döndürmüyor; ekran da `kalemAdi ?? kalemId` yazdığı için
-- 36 karakterlik bir uuid'e düşüyordu.
--
-- ⚠️ EKRAN HATASI DEĞİL, EKSİK VERİ. Ekran uydurma yapmadı: elinde ad
-- olmadığı için elindekini yazdı. Doğru yer burası.
--
-- ⚠️ KARDEŞ FONKSİYONLARLA TUTARLILIK. `siparis_karsilama_plani` (0056) ve
-- `siparis_teslim_farki` (0058) `kalem_adi`yı ZATEN döndürüyor. Üçü aynı
-- sipariş kartının üç sekmesini besliyor; ikisi ad verip biri vermiyordu.
-- Adı ekranda katalogdan bakarak da çözebilirdik ama o zaman üç panelden
-- ikisi SQL'den, biri tarayıcıdan ad alırdı — ve LİSTEDEN DÜŞMÜŞ (pasif)
-- bir kalem, ekranın elindeki katalogda bulunmadığı için yine uuid olarak
-- görünürdü. `siparis_disi` satırları tam olarak böyle kalemlerdir.
--
-- ⚠️ `drop` + `create` gerekiyor: `returns table` sütun listesi değişince
-- `create or replace` "cannot change return type" der. Önce DIŞ KAPI
-- düşürülüyor — `public` sarmalayıcı `app`takine bağlı.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.siparis_sevk_durumu(uuid);
drop function if exists app.siparis_sevk_durumu(uuid);

-- ⚠️ Çıktı sütun adları TÜRKÇE: `language sql` fonksiyonlarında RETURNS TABLE
-- adları OUT parametresidir ve gövdedeki sütun adlarıyla çakışabilir.
create or replace function app.siparis_sevk_durumu(p_siparis uuid)
returns table (
  kalem_id        uuid,
  kalem_adi       text,
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
    -- ⚠️ `left join`: kalem kartı silinmiş ya da başka kiracıya aitse ad NULL
    -- gelir ve satır KAYBOLMAZ. `join` yazsaydık, adı bulunamayan bir kalem
    -- sevk tablosundan sessizce düşerdi — "giden mal yok" diye okunan en
    -- tehlikeli boşluk.
    k.name,
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
  full join sevkedilen se on se.kid = si.kid
  left join public.stock_item k on k.id = coalesce(si.kid, se.kid);
$$;

comment on function app.siparis_sevk_durumu(uuid) is
  'Siparişin kalem kalem sevk durumu: ürün adı, sipariş miktarı, SEVK EDİLMİŞ '
  'sevkiyatların toplamı ve KALAN. Birimler uyuşmuyorsa kalan NULL döner '
  '(birim_uyusmuyor=true): farklı birimdeki iki sayı çıkarılmaz. '
  'siparis_disi=true, siparişte olmayan bir kalemin gönderildiğini söyler.';

-- ── DIŞ KAPI ──────────────────────────────────────────────────────────────
-- PostgREST yalnız `public` şemasını yayımlar; `app.*` dışarıdan görünmez.
-- ⚠️ Sarmalayıcı bilerek `security definer` DEĞİL: çağıranın RLS'i geçerli
-- kalsın, başka kiracının siparişi okunamasın (0048'deki karar).
create or replace function public.siparis_sevk_durumu(p_siparis uuid)
returns table (
  kalem_id        uuid,
  kalem_adi       text,
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

-- ── Doğrulama ────────────────────────────────────────────────────────────
do $$
declare v_sutunlar text;
begin
  if to_regprocedure('public.siparis_sevk_durumu(uuid)') is null then
    raise exception '0062: dış kapı oluşmadı.';
  end if;

  select string_agg(a, ', ' order by o) into v_sutunlar
    from unnest(
      (select proargnames from pg_proc
        where oid = 'app.siparis_sevk_durumu(uuid)'::regprocedure)
    ) with ordinality as t(a, o);

  if position('kalem_adi' in coalesce(v_sutunlar, '')) = 0 then
    raise exception '0062: kalem_adi sütunu eklenmemiş. Sütunlar: %', v_sutunlar;
  end if;

  -- Kardeş fonksiyonlar da ad veriyor mu? Üçü aynı kartın üç sekmesi;
  -- biri ad vermezse o sekme yine uuid basar.
  if position('kalem_adi' in coalesce(
       (select array_to_string(proargnames, ', ') from pg_proc
         where oid = 'app.siparis_teslim_farki(uuid)'::regprocedure), '')) = 0
  then
    raise exception '0062: siparis_teslim_farki ad vermiyor — beklenmeyen durum.';
  end if;

  raise notice '0062 TAMAM · sevk durumu artık ürün adını da veriyor';
end;
$$;
