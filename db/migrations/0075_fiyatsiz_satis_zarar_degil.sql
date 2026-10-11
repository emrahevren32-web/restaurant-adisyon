-- ═══════════════════════════════════════════════════════════════════════════
-- 0075 · FİYATI BİLİNMEYEN MAL "ZARAR" DEĞİLDİR
-- ---------------------------------------------------------------------------
-- 0074 canlıya alındıktan sonra Emrah'ın GERÇEK verisinde görüldü:
--
--   mercimek · 35.000 g satıldı · ciro 0,00 ₺ · maliyet 1.902,17 ₺
--                                            · kâr −1.902,17 ₺
--
-- Rakamların hiçbiri uydurma değil ama BİRLİKTE YALAN SÖYLÜYORLAR. O iki
-- sevkiyat hiçbir siparişe bağlı değil, yani fiyatı BİLİNMİYOR. Ciro 0
-- çıkması doğru; ama maliyeti 35.000 gramın TAMAMI üzerinden yazıp
-- "kâr = 0 − 1.902" demek, bilmediğimiz bir şeyi zarar diye raporlamaktır.
--
-- Bunun bedeli sayısal değil, DAVRANIŞSAL: `satisBulgulari` bu satırı
-- "zararına satılan ürün" diye KRİTİK bulguya çevirir ve kullanıcıyı
-- olmayan bir yangına koşturur. Yanlış alarm, alarmın kendisini
-- değersizleştirir.
--
-- ⚠️ DÜZELTME: maliyet artık YALNIZ FİYATI BİLİNEN MİKTAR üzerinden.
-- Ciro ile maliyet aynı miktarı anlatmak zorunda; yoksa kâr iki farklı
-- şeyin farkı olur.
-- ⚠️ Fiyatı bilinen miktar sıfırsa maliyet de kâr da marj da NULL —
-- "bilmiyorum" demenin tek dürüst yolu bu.
-- ⚠️ `fiyatsiz_miktar` yerinde duruyor; kaç birimin hesap dışı kaldığı
-- kullanıcıdan GİZLENMİYOR, ekranda satırın altında yazıyor.
--
-- NE YAPILMADI, BİLEREK:
-- ⚠️ Fiyatsız miktarın maliyeti ayrı bir sütun olarak EKLENMEDİ. Faydalı
--   olurdu ama dönüş tipini değiştirmek ekranı, portu ve testleri birden
--   değiştirmeyi gerektiriyor; bu göç TEK bir hatayı düzeltiyor.
-- ⚠️ Fiyat defteri yedek olarak hâlâ kullanılmıyor (0074'teki gerekçe
--   aynen geçerli: `musteri_fiyati` hangi BİRİM için olduğunu söylemiyor).
--   Asıl çözüm sevkiyatı siparişe bağlamaktır; rapor bunu söylüyor.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.satis_karliligi_ham(p_sube uuid, p_bas date, p_bit date)
returns table (
  kalem_id        uuid,
  kalem_adi       text,
  birim           text,
  miktar          numeric,
  ciro            numeric,
  maliyet         numeric,
  kar             numeric,
  marj            numeric,
  fiyatsiz_miktar numeric,
  maliyetsiz      boolean
)
language sql
stable
set search_path = public, app, pg_temp
as $$
with
iptal as (
  select m.id from public.stock_movement m where m.reason = 'REVERSAL'
  union
  select m.reverses_movement_id from public.stock_movement m
   where m.reason = 'REVERSAL' and m.reverses_movement_id is not null
),
cikis as (
  select m.stock_item_id, m.occurred_at, m.source_id,
         (-m.quantity_base) as miktar
    from public.stock_movement m
   where m.reason = 'SHIPMENT_OUT'
     and (p_sube is null or m.branch_id = p_sube)
     and m.occurred_at >= p_bas::timestamptz
     and m.occurred_at <  (p_bit + 1)::timestamptz
     and m.id not in (select id from iptal)
     and m.quantity_base < 0
),
guncel_satir as (
  select distinct on (l.order_id, l.stock_item_id)
         l.order_id, l.stock_item_id, l.unit_price, l.uom_code, l.currency
    from public.sales_order_line l
    join public.sales_order_revision rv on rv.id = l.revision_id
   order by l.order_id, l.stock_item_id, rv.revision_no desc
),
fiyatli as (
  select c.stock_item_id,
         c.miktar,
         c.occurred_at,
         si.base_uom,
         case
           when gs.unit_price is null then null
           when coalesce(gs.currency, 'TRY') <> 'TRY' then null
           else gs.unit_price
                / nullif(app.birim_cevir_sessiz(1, gs.uom_code, si.base_uom), 0)
         end as birim_fiyat_temel
    from cikis c
    join public.stock_item si on si.id = c.stock_item_id
    left join public.shipment sh on sh.id = c.source_id
    left join guncel_satir gs
      on gs.order_id = sh.order_id and gs.stock_item_id = c.stock_item_id
),
toplanan as (
  select f.stock_item_id,
         min(f.base_uom)                                         as birim,
         sum(f.miktar)                                           as miktar,
         sum(case when f.birim_fiyat_temel is not null
                  then f.miktar * f.birim_fiyat_temel else 0 end) as ciro,
         -- ⚠️ 0075 · Cironun KARŞILIĞI olan miktar. Maliyet bunun üzerinden
         -- hesaplanacak; toplam miktar üzerinden hesaplanırsa fiyatı
         -- bilinmeyen mal zarar gibi görünür.
         sum(case when f.birim_fiyat_temel is not null
                  then f.miktar else 0 end)                      as fiyatli_miktar,
         sum(case when f.birim_fiyat_temel is null
                  then f.miktar else 0 end)                      as fiyatsiz_miktar,
         max(f.occurred_at)                                      as son_an
    from fiyatli f
   group by f.stock_item_id
),
hesap as (
  select t.*,
         app.kalem_maliyeti(t.stock_item_id, t.son_an) as birim_maliyet
    from toplanan t
)
select
  h.stock_item_id,
  coalesce(si.name, '(kart silinmiş)'),
  h.birim,
  h.miktar,
  round(h.ciro, 2),
  -- ⚠️ Fiyatlı miktar sıfırsa maliyet de YOK: elimizde kıyaslanacak bir
  -- ciro olmadığı için "bu malın maliyeti şu" demek yanıltıcı olurdu.
  case when h.fiyatli_miktar > 0 and h.birim_maliyet is not null
       then round(h.birim_maliyet * h.fiyatli_miktar, 2) end,
  case when h.fiyatli_miktar > 0 and h.birim_maliyet is not null
       then round(h.ciro - (h.birim_maliyet * h.fiyatli_miktar), 2) end,
  case when h.fiyatli_miktar > 0 and h.birim_maliyet is not null and h.ciro > 0
       then round((h.ciro - (h.birim_maliyet * h.fiyatli_miktar)) / h.ciro, 4) end,
  h.fiyatsiz_miktar,
  h.birim_maliyet is null
  from hesap h
  left join public.stock_item si on si.id = h.stock_item_id
 order by h.ciro desc nulls last, h.miktar desc;
$$;

-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('app.satis_karliligi_ham(uuid, date, date)') is null then
    raise exception '0075: satis_karliligi_ham kayboldu.';
  end if;

  -- ⚠️ Kapı ve PostgREST sarmalayıcısı 0074'ten geliyor; gövde değişti,
  -- imza değişmedi. Değişseydi `create or replace` zaten patlardı.
  if to_regprocedure('public.satis_karliligi(uuid, date, date)') is null then
    raise exception '0075: public.satis_karliligi yok — önce 0074 çalışmalı.';
  end if;

  if not exists (
    select 1 from pg_proc p
     where p.oid = to_regprocedure('app.satis_karliligi_ham(uuid, date, date)')
       and pg_get_functiondef(p.oid) like '%fiyatli_miktar%'
  ) then
    raise exception '0075: maliyet hâlâ toplam miktar üzerinden hesaplanıyor.';
  end if;

  raise notice '0075 TAMAM · fiyatı bilinmeyen mal artık zarar olarak raporlanmıyor';
end;
$$;
