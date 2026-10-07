-- ═══════════════════════════════════════════════════════════════════════════
-- 0065 · İŞLETME GÖSTERGELERİ — GERÇEK DEFTERDEN, UYDURMA KATSAYI YOK
-- ---------------------------------------------------------------------------
-- Emrah (07.10.2026): *"görünsün ama gerçeğe dayalı olsun!"*
--
-- Eski KPI katmanı 27 ayrı `.mock` modülünden besleniyordu; hepsi tarayıcı
-- hafızasında. Bu göç onun yerine GEÇMİYOR — yanına, gerçek defterin üstüne
-- yeni bir kapı açıyor. Buradaki her sayının altında bir `stock_movement`
-- ya da bir `sales_order` satırı var.
--
-- ⚠️ BU DOSYADA "TAHMİN" YOKTUR. Katsayı yok, oran varsayımı yok, "ortalama
-- bir işletmede şu kadar olur" yok. Hesaplanamayan şey HESAPLANMIYOR ve
-- hesaplanamadığı SÖYLENİYOR (`fiyatsiz_hareket` göstergesi bunun içindir).
-- Müşteriye "size yılda şu kadar kazandırır" diyen bir ekranın altındaki
-- sayı uydurmaysa, o ekran satışın en kırılgan yeri olur: müşteri bir yıl
-- sonra o rakamı sorar.
--
-- ⚠️ BİR SORU, BİR SATIR. Ekran bu fonksiyondan anahtar/değer çiftleri
-- alıyor; başlıklar TypeScript tarafında (`src/reporting/gostergeler.ts`),
-- çünkü başlık bir METİN kararıdır ve metin değişince göç yazılmaz.
--
-- ⚠️ `security invoker` (varsayılan): RLS ÇAĞIRANIN yetkisiyle işliyor.
-- `security definer` yazsaydık bu fonksiyon kiracı duvarında bir delik
-- olurdu — bütün işletmelerin firesini tek sorguyla okutan bir delik.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Bir kalemin o andaki alış fiyatı ───────────────────────────────────────
-- ⚠️ "O ANDAKİ" — bugünkü değil. Dün yazılan bir fire, dünkü fiyatla
-- değerlenir; bugün gelen zam dünün firesini pahalılaştırmaz. Geçmişe dönük
-- değişen bir rapor, güvenilmeyen bir rapordur.
--
-- ⚠️ Fiyat YAZILAN BİRİMİN fiyatı, miktar temel birimde: bölme ikisini
-- buluşturuyor. (`stock-cost.ts` ile aynı kural; iki yerde iki farklı
-- hesap olsaydı ekranla rapor tutmazdı.)
create or replace function app.kalem_alis_fiyati(p_kalem uuid, p_an timestamptz)
returns numeric
language sql
stable
set search_path = public, app, pg_temp
as $$
  select (abs(m.quantity_entered) * m.unit_cost) / nullif(m.quantity_base, 0)
    from public.stock_movement m
   where m.stock_item_id = p_kalem
     and m.reason = 'PURCHASE_RECEIPT'
     and m.unit_cost is not null
     and m.unit_cost > 0
     and m.quantity_base > 0
     and m.occurred_at <= p_an
   order by m.occurred_at desc, m.id desc
   limit 1
$$;

comment on function app.kalem_alis_fiyati(uuid, timestamptz) is
  'Bir kalemin verilen andaki temel birim alış fiyatı. Bulunamazsa NULL — '
  'sıfır DEĞİL: sıfır "bedava" demektir, NULL "bilinmiyor" demektir.';

-- ── Fire sayılan hareketler ────────────────────────────────────────────────
-- ⚠️ `COUNT_SHORTAGE` de fire sayılıyor: sayımda eksik çıkan mal bir yere
-- gitmiştir. Saymasaydık "bizde fire yok" diyen bir rapor çıkardı ve
-- işletmenin asıl kaybı görünmezdi.
--
-- ⚠️ `REVERSAL` ve ters çevrilen hareket İKİSİ BİRDEN dışarıda: iptal
-- edilmiş bir fire, olmamış bir firedir.
create or replace function app.fire_nedenleri()
returns text[]
language sql
immutable
as $$ select array['WASTE','EXPIRY_WRITE_OFF','PRODUCTION_WASTE','COUNT_SHORTAGE'] $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- İŞLETME GÖSTERGELERİ
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function app.isletme_gostergeleri(
  p_sube uuid,
  p_bas  date,
  p_bit  date
)
returns table (
  anahtar text,
  deger   numeric,
  ek      numeric
)
language sql
stable
set search_path = public, app, pg_temp
as $$
with
-- İptal edilmiş hareketler: ters kayıt + ters çevirdiği, ikisi birden.
iptal as (
  select m.id from public.stock_movement m where m.reason = 'REVERSAL'
  union
  select m.reverses_movement_id from public.stock_movement m
   where m.reason = 'REVERSAL' and m.reverses_movement_id is not null
),
-- Dönem içi hareketler, iptal edilmişler ayıklanmış.
donem as (
  select m.*
    from public.stock_movement m
   where m.branch_id = p_sube
     and m.occurred_at >= p_bas::timestamptz
     and m.occurred_at <  (p_bit + 1)::timestamptz
     and m.id not in (select id from iptal)
),
fire as (
  select d.*,
         app.kalem_alis_fiyati(d.stock_item_id, d.occurred_at) as birim_fiyat
    from donem d
   where d.reason = any(app.fire_nedenleri())
     and d.quantity_base < 0
),
-- Bugün elde duran partiler. ⚠️ Bakiyesi SIFIR ya da EKSİ olan parti
-- "elde" değildir; SKT'si geçmiş ama tükenmiş bir parti riski değildir.
parti as (
  select b.lot_id, b.stock_item_id, b.qty, l.expires_on,
         app.kalem_alis_fiyati(b.stock_item_id, now()) as birim_fiyat
    from public.stock_lot_balance b
    join public.stock_lot l on l.id = b.lot_id
   where b.branch_id = p_sube
     and b.qty > 0
     and l.expires_on is not null
),
siparis as (
  select s.* from public.sales_order s
   where s.order_date >= p_bas and s.order_date <= p_bit
)

-- ── PARA ──────────────────────────────────────────────────────────────────
select 'fire_tutari',
       coalesce(sum(abs(f.quantity_base) * f.birim_fiyat), 0),
       null::numeric
  from fire f
union all
-- ⚠️ DÜRÜSTLÜK GÖSTERGESİ. Fiyatı bulunamayan fire hareketi varsa yukarıdaki
-- tutar EKSİKTİR ve ekran bunu yazmak zorunda. Sessizce düşük bir rakam
-- göstermek, hiç göstermemekten kötüdür.
select 'fire_fiyatsiz_hareket', count(*)::numeric, null
  from fire f where f.birim_fiyat is null
union all
select 'fire_kalem_sayisi', count(distinct f.stock_item_id)::numeric, null
  from fire f
union all
select 'alim_tutari',
       coalesce(sum(d.quantity_base * app.kalem_alis_fiyati(d.stock_item_id, d.occurred_at)), 0),
       null
  from donem d where d.reason = 'PURCHASE_RECEIPT' and d.quantity_base > 0

-- ── BUGÜNÜN RİSKİ ─────────────────────────────────────────────────────────
union all
select 'skt_gecmis_deger',
       coalesce(sum(p.qty * p.birim_fiyat), 0),
       count(*)::numeric
  from parti p where p.expires_on < current_date
union all
select 'skt_yaklasan_deger',
       coalesce(sum(p.qty * p.birim_fiyat), 0),
       count(*)::numeric
  from parti p
 where p.expires_on >= current_date
   and p.expires_on <= current_date + 30
union all
-- ⚠️ Negatif bakiye bir DEFTER TUTARSIZLIĞI işaretidir: olmayan maldan
-- çıkış yazılmış. Rapor bunu saklamaz; sayının kendisi bir uyarıdır.
select 'negatif_bakiyeli_kalem', count(*)::numeric, null
  from public.stock_balance b where b.branch_id = p_sube and b.qty < 0
union all
select 'kritik_kalem', count(*)::numeric, null
  from public.stock_item i
  left join public.stock_balance b
         on b.stock_item_id = i.id and b.branch_id = p_sube
 where i.branch_id = p_sube
   and i.is_active
   and i.min_qty > 0
   and coalesce(b.qty, 0) < i.min_qty

-- ── MÜŞTERİ ───────────────────────────────────────────────────────────────
union all
select 'siparis_sayisi', count(*)::numeric, null from siparis
union all
select 'iptal_siparis', count(*)::numeric, null
  from siparis s where s.status = 'İptal'
union all
-- ⚠️ "Geciken" = teslim tarihi GEÇMİŞ ve hâlâ teslim edilmemiş. İptal
-- edilenler sayılmaz: iptal bir gecikme değildir.
select 'geciken_siparis', count(*)::numeric, null
  from public.sales_order s
 where s.requested_delivery_date is not null
   and s.requested_delivery_date < current_date
   and s.status not in ('Teslim Edildi', 'İptal')
union all
select 'onay_bekleyen_siparis', count(*)::numeric, null
  from public.sales_order s where s.status = 'Onay Bekliyor'
union all
-- Teslimde fark kaydı açılmış sipariş sayısı: "ne istendi, ne gitti"
-- tartışmasının kaç kez yaşandığı.
select 'farkli_teslim_siparis', count(distinct g.order_id)::numeric, null
  from public.order_discrepancy g
  join siparis s on s.id = g.order_id
$$;

comment on function app.isletme_gostergeleri(uuid, date, date) is
  'Bir şubenin dönem göstergeleri. Her sayı gerçek defterden gelir; '
  'hesaplanamayan hesaplanmaz ve `fire_fiyatsiz_hareket` ile söylenir.';

-- ── FİRE DÖKÜMÜ ────────────────────────────────────────────────────────────
-- "Fire 47.000 TL" tek başına bir şey yaptırmaz. "31.000'i SKT'den, ve
-- bunun 19.000'i TEK BİR ÜRÜNDEN" bir karar aldırır. Rapor karar aldırmak
-- içindir.
create or replace function app.fire_dokumu(
  p_sube uuid,
  p_bas  date,
  p_bit  date
)
returns table (
  neden       text,
  kalem_id    uuid,
  kalem_adi   text,
  miktar      numeric,
  birim       text,
  tutar       numeric,
  fiyatsiz    boolean
)
language sql
stable
set search_path = public, app, pg_temp
as $$
with iptal as (
  select m.id from public.stock_movement m where m.reason = 'REVERSAL'
  union
  select m.reverses_movement_id from public.stock_movement m
   where m.reason = 'REVERSAL' and m.reverses_movement_id is not null
)
select d.reason,
       d.stock_item_id,
       -- ⚠️ `left join`: kalem kartı silinmişse satır KAYBOLMAZ (tuzak 54).
       k.name,
       sum(abs(d.quantity_base)),
       max(k.base_uom),
       sum(abs(d.quantity_base) * app.kalem_alis_fiyati(d.stock_item_id, d.occurred_at)),
       bool_or(app.kalem_alis_fiyati(d.stock_item_id, d.occurred_at) is null)
  from public.stock_movement d
  left join public.stock_item k on k.id = d.stock_item_id
 where d.branch_id = p_sube
   and d.occurred_at >= p_bas::timestamptz
   and d.occurred_at <  (p_bit + 1)::timestamptz
   and d.reason = any(app.fire_nedenleri())
   and d.quantity_base < 0
   and d.id not in (select id from iptal)
 group by d.reason, d.stock_item_id, k.name
 order by sum(abs(d.quantity_base) * app.kalem_alis_fiyati(d.stock_item_id, d.occurred_at))
          desc nulls last
$$;

-- ── DIŞ KAPILAR ────────────────────────────────────────────────────────────
-- PostgREST yalnız `public` şemasını yayınlar.
create or replace function public.isletme_gostergeleri(p_sube uuid, p_bas date, p_bit date)
returns table (anahtar text, deger numeric, ek numeric)
language sql stable
set search_path = public, app, pg_temp
as $$ select * from app.isletme_gostergeleri(p_sube, p_bas, p_bit) $$;

create or replace function public.fire_dokumu(p_sube uuid, p_bas date, p_bit date)
returns table (neden text, kalem_id uuid, kalem_adi text, miktar numeric,
               birim text, tutar numeric, fiyatsiz boolean)
language sql stable
set search_path = public, app, pg_temp
as $$ select * from app.fire_dokumu(p_sube, p_bas, p_bit) $$;

grant execute on function public.isletme_gostergeleri(uuid, date, date) to authenticated;
grant execute on function public.fire_dokumu(uuid, date, date)          to authenticated;

-- ⚠️ `anon`a VERİLMİYOR. Bu fonksiyonlar işletmenin fire ve sipariş
-- rakamlarını döndürüyor; giriş yapmamış birinin görecek işi yok.
revoke execute on function public.isletme_gostergeleri(uuid, date, date) from anon;
revoke execute on function public.fire_dokumu(uuid, date, date)          from anon;

-- ── DOĞRULAMA ──────────────────────────────────────────────────────────────
do $$
declare
  v_say int;
begin
  select count(*) into v_say
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('isletme_gostergeleri','fire_dokumu');
  if v_say <> 2 then
    raise exception '0065: dış kapılar açılmadı (% bulundu).', v_say;
  end if;

  -- ⚠️ `security definer` OLMAMALI: bu fonksiyonlar kiracı duvarının
  -- içinden çalışmalı. Biri sonradan `definer` yaparsa bu kontrol yakalar.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public','app')
       and p.proname in ('isletme_gostergeleri','fire_dokumu','kalem_alis_fiyati')
       and p.prosecdef
  ) then
    raise exception '0065: gösterge fonksiyonu `security definer` olmuş — '
      'bu, bütün işletmelerin verisini tek sorguyla okutan bir deliktir.';
  end if;

  raise notice '0065 TAMAM · isletme_gostergeleri · fire_dokumu (gerçek defterden)';
end;
$$;
