-- ═══════════════════════════════════════════════════════════════════════════
-- 0074 · SATIŞ VE KÂRLILIK ANALİZİ
-- ---------------------------------------------------------------------------
-- Emrah'ın bilirkişiyle görüşmesinden çıkan madde, demo öncesi şartı:
-- *"en çok/az satılan, en karlı/az karlı, stok devir hızı."*
--
-- Emrah'ın müşterinin en çok dikkat edeceğini söylediği üç şeyden üçüncüsü:
-- *"şirket verileri ile faydalı bilgi üretme."* İlk ikisi (HACCP,
-- izlenebilirlik) hazır; bu göç üçüncünün eksik ayağını kapatıyor.
--
-- ⚠️ BU GÖÇ HESABI SUNUCUYA KOYUYOR, TARAYICIYA DEĞİL. Kârlılık, defterin
-- tamamını gezmeyi gerektiriyor; tarayıcıya çekilen 1000 satırlık sayfa
-- sessizce kesilir ve yanlış bir kâr rakamı doğru rakamdan beterdir.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- NE YAZILMADI, BİLEREK
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ FİYAT DEFTERİ (`app.musteri_fiyati`) YEDEK OLARAK KULLANILMADI.
--   Fonksiyon yalnız sayı döndürüyor, o sayının HANGİ BİRİM için olduğunu
--   döndürmüyor (`customer_price.uom_code` dışarı çıkmıyor). Koli fiyatını
--   kilo fiyatı sanmak, kârı on katı gösterir. Fiyat yalnız siparişin
--   kendi satırından okunuyor; bulunamazsa ciroya GİRMİYOR ve kaç birimin
--   fiyatsız kaldığı AYRICA raporlanıyor.
-- ⚠️ TL DIŞI PARA BİRİMİ CİROYA GİRMİYOR. USD ve EUR satır da fiyatsız
--   sayılıyor. Kur tablosu yok; olmayan kuru uydurmak yerine söylüyoruz.
-- ⚠️ MALİYET YÖNTEMİ "SON ALIŞ". `src/warehouse/stock-cost.ts` varsayılanı
--   ORTALAMA; iki rakam tutmayabilir. Ekranda hangisinin kullanıldığı
--   YAZILACAK. Ortalamayı SQL'e taşımak ayrı bir iş.
-- ⚠️ GENEL GİDER, İŞÇİLİK VE NAKLİYE MALİYETE GİRMİYOR. Bu BRÜT kârdır,
--   net kâr değildir. Ekranda böyle yazılacak; "kârınız bu" demek yalan olur.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · SESSİZ BİRİM ÇEVİRİMİ ─────────────────────────────────────────────
-- ⚠️ `app.convert_uom` tanımsız dönüşümde HATA VERİYOR (0002) — ve doğrusu
-- budur: mal çıkarırken tahmin yapılmamalı. Ama bir RAPORUN ortasında tek
-- bir tanımsız çevrim bütün raporu düşürür. Raporda doğru davranış
-- "bilmiyorum" demektir: NULL döner, satır fiyatsız/maliyetsiz sayılır ve
-- bu kullanıcıya SÖYLENİR.
create or replace function app.birim_cevir_sessiz(
  p_miktar numeric, p_kaynak text, p_hedef text
)
returns numeric
language plpgsql
stable
set search_path = public, app, pg_temp
as $$
begin
  if p_miktar is null or p_kaynak is null or p_hedef is null then
    return null;
  end if;
  return app.convert_uom(p_miktar, p_kaynak, p_hedef);
exception when others then
  return null;
end;
$$;

comment on function app.birim_cevir_sessiz(numeric, text, text) is
  'convert_uom''un rapor sürümü: tanımsız dönüşümde hata yerine NULL. '
  'Mal hareketi yazarken KULLANILMAZ — orada hata vermek doğrudur.';


-- ── 2 · BİR KALEMİN BİRİM MALİYETİ ────────────────────────────────────────
-- Satın alınan kalem → son alış fiyatı (0070).
-- Üretilen kalem → REÇETEDEN, özyinelemeli (yarı mamul yarı mamul içerebilir).
--
-- ⚠️ FORMÜL `recipe.service.ts`İN AYNISI. Orada:
--     net  = satır miktarı × ölçek × (100 / verim)
--     brüt = net / (1 - fire/100)
-- Burada ölçek 1 çıktı birimi için alınıyor. İki yer farklı formül
-- kullanırsa "reçete maliyeti" ile "iş emri tüketimi" tutmaz ve hangisinin
-- doğru olduğunu kimse bilemez.
--
-- ⚠️ BİR BİLEŞENİN MALİYETİ BİLİNMİYORSA TOPLAM DA BİLİNMİYOR → NULL.
-- Eksik bileşeni 0 saymak, maliyeti olduğundan düşük ve kârı olduğundan
-- yüksek gösterir. Bu raporun en tehlikeli yalanı o olurdu.
--
-- ⚠️ DÖNGÜ KORUMASI: A→B→A reçetesi veritabanında mümkün (yalnız doğrudan
-- A→A tetikle engelli, 0021). Yol dizisi tutuluyor, derinlik 8 ile sınırlı.
create or replace function app.kalem_maliyeti(
  p_kalem     uuid,
  p_an        timestamptz,
  p_derinlik  int    default 0,
  p_yol       uuid[] default '{}'::uuid[]
)
returns numeric
language plpgsql
stable
set search_path = public, app, pg_temp
as $$
declare
  v_recete       record;
  v_satir        record;
  v_cikti_birim  text;
  v_cikti_temel  numeric;
  v_girdi_temel  numeric;
  v_bilesen      numeric;
  v_toplam       numeric := 0;
  v_satir_var    boolean := false;
begin
  if p_kalem is null then return null; end if;
  if p_derinlik > 8 then return null; end if;
  if p_kalem = any(p_yol) then return null; end if;

  -- ⚠️ Aynı mamul için BİRDEN FAZLA aktif reçete olabilir (şemada engel
  -- yok). En son güncelleneni alıyoruz ve bunu burada yazıyoruz ki
  -- "neden bu reçete" sorusunun cevabı kodda dursun.
  select r.id, r.output_qty, r.output_uom, r.yield_pct
    into v_recete
    from public.recipe r
   where r.output_item_id = p_kalem
     and r.status = 'ACTIVE'
   order by r.updated_at desc, r.id desc
   limit 1;

  if not found then
    -- Üretilmiyorsa satın alınıyordur.
    return app.kalem_alis_fiyati(p_kalem, p_an);
  end if;

  select si.base_uom into v_cikti_birim
    from public.stock_item si where si.id = p_kalem;

  v_cikti_temel := app.birim_cevir_sessiz(
    v_recete.output_qty, v_recete.output_uom, v_cikti_birim);
  if v_cikti_temel is null or v_cikti_temel <= 0 then return null; end if;

  for v_satir in
    select l.stock_item_id, l.qty, l.uom, l.waste_pct, si.base_uom
      from public.recipe_line l
      join public.stock_item si on si.id = l.stock_item_id
     where l.recipe_id = v_recete.id
  loop
    v_satir_var := true;

    v_girdi_temel := app.birim_cevir_sessiz(v_satir.qty, v_satir.uom, v_satir.base_uom);
    if v_girdi_temel is null then return null; end if;

    -- Verim düzeltmesi (girdi tarafında — recipe.service.ts ile aynı)
    v_girdi_temel := v_girdi_temel
      * (100.0 / nullif(coalesce(v_recete.yield_pct, 100), 0));
    -- Fire payı
    v_girdi_temel := v_girdi_temel
      / nullif(1 - (coalesce(v_satir.waste_pct, 0) / 100.0), 0);
    if v_girdi_temel is null then return null; end if;

    v_bilesen := app.kalem_maliyeti(
      v_satir.stock_item_id, p_an, p_derinlik + 1, p_yol || p_kalem);
    if v_bilesen is null then return null; end if;

    v_toplam := v_toplam + (v_girdi_temel * v_bilesen);
  end loop;

  -- Satırı olmayan reçete bir maliyet beyanı değildir.
  if not v_satir_var then return null; end if;

  return v_toplam / v_cikti_temel;
end;
$$;

comment on function app.kalem_maliyeti(uuid, timestamptz, int, uuid[]) is
  'Bir stok kaleminin TEMEL BİRİM başına maliyeti. Aktif reçetesi varsa '
  'reçeteden (özyinelemeli, verim ve fire payı dahil), yoksa son alış '
  'fiyatından. Herhangi bir bileşen bilinmiyorsa NULL — sıfır DEĞİL.';


-- ── 3 · SATIŞ VE KÂRLILIK ─────────────────────────────────────────────────
-- ⚠️ "SATILDI" = DEFTERDEKİ ÇIKIŞ HAREKETİ (`SHIPMENT_OUT`), sipariş satırı
-- değil. Sipariş bir NİYET, sevkiyat bir OLAY. Sipariş üzerinden ciro
-- hesaplamak, hazırlanmayan malı satılmış gösterir.
-- ⚠️ Hareket miktarı TEMEL BİRİMDE; `shipment_line.qty` koli/palet olabilir.
drop function if exists app.satis_karliligi_ham(uuid, date, date);
create function app.satis_karliligi_ham(p_sube uuid, p_bas date, p_bit date)
returns table (
  kalem_id        uuid,
  kalem_adi       text,
  birim           text,
  miktar          numeric,   -- temel birimde satılan
  ciro            numeric,   -- TL, yalnız fiyatı BİLİNEN miktar
  maliyet         numeric,   -- TL, NULL = bilinmiyor
  kar             numeric,   -- ciro - maliyet, NULL = bilinmiyor
  marj            numeric,   -- kar / ciro
  fiyatsiz_miktar numeric,   -- fiyatı bulunamadığı için ciroya girmeyen
  maliyetsiz      boolean    -- birim maliyeti hiç bulunamadı
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
-- Siparişin GÜNCEL satırı: en yüksek numaralı revizyonun satırı.
-- ⚠️ `LOJISTIK` revizyonu satır taşımaz; `distinct on` zaten satırı olan
-- en yüksek revizyonu seçiyor (satırsız revizyon join'e hiç girmiyor).
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
         -- Satır fiyatı KENDİ biriminde; temel birime indiriyoruz.
         -- 1 koli = 10 kg ise koli fiyatı / 10 = kilo fiyatı.
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
         min(f.base_uom)                                        as birim,
         sum(f.miktar)                                          as miktar,
         sum(case when f.birim_fiyat_temel is not null
                  then f.miktar * f.birim_fiyat_temel else 0 end) as ciro,
         sum(case when f.birim_fiyat_temel is null
                  then f.miktar else 0 end)                     as fiyatsiz_miktar,
         max(f.occurred_at)                                     as son_an
    from fiyatli f
   group by f.stock_item_id
)
select
  t.stock_item_id,
  coalesce(si.name, '(kart silinmiş)'),
  t.birim,
  t.miktar,
  round(t.ciro, 2),
  round(app.kalem_maliyeti(t.stock_item_id, t.son_an) * t.miktar, 2),
  round(t.ciro - (app.kalem_maliyeti(t.stock_item_id, t.son_an) * t.miktar), 2),
  case
    when t.ciro > 0 and app.kalem_maliyeti(t.stock_item_id, t.son_an) is not null
    then round(
      (t.ciro - (app.kalem_maliyeti(t.stock_item_id, t.son_an) * t.miktar)) / t.ciro, 4)
  end,
  t.fiyatsiz_miktar,
  app.kalem_maliyeti(t.stock_item_id, t.son_an) is null
  -- ⚠️ `left join`: kartı silinmiş kalem RAPORDAN DÜŞMEZ (tuzak 54).
  from toplanan t
  left join public.stock_item si on si.id = t.stock_item_id
 order by t.ciro desc nulls last, t.miktar desc;
$$;


-- ── 4 · STOK DEVİR HIZI ───────────────────────────────────────────────────
-- Devir = dönemdeki ÇIKIŞ ÷ ORTALAMA STOK.
-- ⚠️ Çıkışa hem sevkiyat hem ÜRETİM TÜKETİMİ dahil: hammadde satılmaz,
-- üretime girer. Yalnız sevkiyata bakan bir devir hızı, un ve yağ için
-- her zaman sıfır gösterirdi.
-- ⚠️ Ortalama stok = (dönem başı + dönem sonu) / 2. Basit ama anlaşılır;
-- günlük ortalama daha doğru olurdu, ama anlatılamayan bir rakam
-- kullanılmayan bir rakamdır.
drop function if exists app.stok_devri_ham(uuid, date, date);
create function app.stok_devri_ham(p_sube uuid, p_bas date, p_bit date)
returns table (
  kalem_id       uuid,
  kalem_adi      text,
  birim          text,
  cikis          numeric,
  baslangic_stok numeric,
  bitis_stok     numeric,
  ortalama_stok  numeric,
  devir          numeric,   -- dönemde kaç kez devretti
  gun            numeric    -- kaç günde bir devrediyor
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
hareket as (
  select m.*
    from public.stock_movement m
   where (p_sube is null or m.branch_id = p_sube)
     and m.id not in (select id from iptal)
),
bas_stok as (
  select h.stock_item_id, sum(h.quantity_base) as qty
    from hareket h
   where h.occurred_at < p_bas::timestamptz
   group by h.stock_item_id
),
bit_stok as (
  select h.stock_item_id, sum(h.quantity_base) as qty
    from hareket h
   where h.occurred_at < (p_bit + 1)::timestamptz
   group by h.stock_item_id
),
donem_cikis as (
  select h.stock_item_id, sum(-h.quantity_base) as cikis
    from hareket h
   where h.reason in ('SHIPMENT_OUT', 'PRODUCTION_CONSUME')
     and h.quantity_base < 0
     and h.occurred_at >= p_bas::timestamptz
     and h.occurred_at <  (p_bit + 1)::timestamptz
   group by h.stock_item_id
),
birlesik as (
  select c.stock_item_id,
         c.cikis,
         coalesce(b.qty, 0) as bas,
         coalesce(e.qty, 0) as bit
    from donem_cikis c
    left join bas_stok b on b.stock_item_id = c.stock_item_id
    left join bit_stok e on e.stock_item_id = c.stock_item_id
   where c.cikis > 0
)
select
  u.stock_item_id,
  coalesce(si.name, '(kart silinmiş)'),
  si.base_uom,
  u.cikis,
  u.bas,
  u.bit,
  round((u.bas + u.bit) / 2.0, 4),
  -- ⚠️ Ortalama stok 0 veya eksi ise devir HESAPLANMAZ (NULL). Sıfıra
  -- bölüp sonsuz yazmak ya da 0 yazmak, iki ayrı yalan olurdu.
  case when (u.bas + u.bit) / 2.0 > 0
       then round(u.cikis / ((u.bas + u.bit) / 2.0), 2) end,
  case when (u.bas + u.bit) / 2.0 > 0 and u.cikis > 0
       then round(
         ((p_bit - p_bas) + 1)::numeric
         / nullif(u.cikis / ((u.bas + u.bit) / 2.0), 0), 1) end
  from birlesik u
  left join public.stock_item si on si.id = u.stock_item_id
 order by case when (u.bas + u.bit) / 2.0 > 0
               then u.cikis / ((u.bas + u.bit) / 2.0) end desc nulls last;
$$;


-- ── 5 · YETKİ KAPILARI ────────────────────────────────────────────────────
-- ⚠️ `security INVOKER` — kapı yetkiyi sorar, RLS kiracı duvarını tutar.
-- `definer` yazsaydık yetki kontrolünü geçen çağrı bütün kiracıları okurdu
-- (0071'in dersi).
create or replace function app.satis_karliligi(p_sube uuid, p_bas date, p_bit date)
returns table (
  kalem_id uuid, kalem_adi text, birim text, miktar numeric,
  ciro numeric, maliyet numeric, kar numeric, marj numeric,
  fiyatsiz_miktar numeric, maliyetsiz boolean
)
language plpgsql
stable
set search_path = public, app, pg_temp
as $$
begin
  if not app.yetkim_var('finance.read') then
    raise exception 'Satış ve kârlılık raporu maliyet ve fiyat bilgisi '
      'içeriyor; `finance.read` izni gerekiyor. İşletme sahibi, müdür, '
      'muhasebe ve satın alma görebilir.'
      using errcode = 'MI403';
  end if;
  return query select * from app.satis_karliligi_ham(p_sube, p_bas, p_bit);
end;
$$;

create or replace function app.stok_devri(p_sube uuid, p_bas date, p_bit date)
returns table (
  kalem_id uuid, kalem_adi text, birim text, cikis numeric,
  baslangic_stok numeric, bitis_stok numeric, ortalama_stok numeric,
  devir numeric, gun numeric
)
language plpgsql
stable
set search_path = public, app, pg_temp
as $$
begin
  -- ⚠️ Devir hızı PARA İÇERMİYOR (miktar bazlı) ama yine de finance kapısı
  -- arkasında: neyin ne hızla tükendiği, satın alma pazarlığında kullanılan
  -- ticari bir bilgidir ve aynı ekranda duruyor.
  if not app.yetkim_var('finance.read') then
    raise exception 'Stok devir hızı raporu için `finance.read` izni gerekiyor.'
      using errcode = 'MI403';
  end if;
  return query select * from app.stok_devri_ham(p_sube, p_bas, p_bit);
end;
$$;


-- ── 6 · PostgREST KAPILARI ────────────────────────────────────────────────
-- ⚠️ PostgREST yalnız `public` şemasını yayınlıyor; `app.*` dışarıdan
-- çağrılamaz. Sarmalayıcılar `security invoker`.
drop function if exists public.satis_karliligi(uuid, date, date);
create function public.satis_karliligi(p_sube uuid, p_bas date, p_bit date)
returns table (
  kalem_id uuid, kalem_adi text, birim text, miktar numeric,
  ciro numeric, maliyet numeric, kar numeric, marj numeric,
  fiyatsiz_miktar numeric, maliyetsiz boolean
)
language sql
stable
set search_path = public, app, pg_temp
as $$ select * from app.satis_karliligi(p_sube, p_bas, p_bit) $$;

drop function if exists public.stok_devri(uuid, date, date);
create function public.stok_devri(p_sube uuid, p_bas date, p_bit date)
returns table (
  kalem_id uuid, kalem_adi text, birim text, cikis numeric,
  baslangic_stok numeric, bitis_stok numeric, ortalama_stok numeric,
  devir numeric, gun numeric
)
language sql
stable
set search_path = public, app, pg_temp
as $$ select * from app.stok_devri(p_sube, p_bas, p_bit) $$;

-- ⚠️ PostgreSQL'de fonksiyonun VARSAYILAN yetkisi `PUBLIC EXECUTE`tir;
-- yalnız `anon`dan almak kapıyı KAPATMAZ (0070'in dersi).
do $$
declare v_ad text;
begin
  foreach v_ad in array array[
    'public.satis_karliligi(uuid, date, date)',
    'public.stok_devri(uuid, date, date)'
  ] loop
    execute format('revoke all on function %s from public', v_ad);
    execute format('revoke all on function %s from anon', v_ad);
    execute format('grant execute on function %s to authenticated, service_role', v_ad);
  end loop;
end;
$$;


-- ── 7 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare v_ad text; v_eksik text := '';
begin
  foreach v_ad in array array[
    'app.birim_cevir_sessiz(numeric, text, text)',
    'app.kalem_maliyeti(uuid, timestamptz, integer, uuid[])',
    'app.satis_karliligi_ham(uuid, date, date)',
    'app.satis_karliligi(uuid, date, date)',
    'app.stok_devri_ham(uuid, date, date)',
    'app.stok_devri(uuid, date, date)',
    'public.satis_karliligi(uuid, date, date)',
    'public.stok_devri(uuid, date, date)'
  ] loop
    if to_regprocedure(v_ad) is null then
      v_eksik := v_eksik || v_ad || ' ';
    end if;
  end loop;
  if v_eksik <> '' then
    raise exception '0074: oluşmayan fonksiyon(lar): %', v_eksik;
  end if;

  -- ⚠️ Kapılar `security definer` OLMAMALI: definer olsaydı yetki
  -- kontrolünü geçen bir çağrı RLS'i de aşar ve BÜTÜN kiracıların
  -- cirosunu okurdu.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.prosecdef
       and ((n.nspname = 'app'    and p.proname in ('satis_karliligi','stok_devri',
                                                    'satis_karliligi_ham','stok_devri_ham',
                                                    'kalem_maliyeti','birim_cevir_sessiz'))
         or (n.nspname = 'public' and p.proname in ('satis_karliligi','stok_devri')))
  ) then
    raise exception '0074: fonksiyonlardan biri `security definer` olmuş — kiracı duvarını deler.';
  end if;

  if exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
     where p.oid in (to_regprocedure('public.satis_karliligi(uuid, date, date)'),
                     to_regprocedure('public.stok_devri(uuid, date, date)'))
       and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception '0074: PUBLIC EXECUTE açık kalmış.';
  end if;

  if has_function_privilege('anon', 'public.satis_karliligi(uuid, date, date)', 'execute') then
    raise exception '0074: ciro anon''a açık.';
  end if;

  raise notice '0074 TAMAM · satış, brüt kâr ve stok devir hızı defterden hesaplanıyor';
end;
$$;
