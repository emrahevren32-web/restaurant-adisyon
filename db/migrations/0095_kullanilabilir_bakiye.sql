-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0095 — KULLANILABİLİR BAKİYE TEK YERDE, ANALİZ ONU OKUYOR
--
-- ── NEDEN VAR ────────────────────────────────────────────────────────────
-- MIYOP-074'ün kalan ayağı. Göç 0092 SKT kapısını kurduğundan beri
-- "depodaki mal" ile "kullanılabilir mal" AYNI ŞEY DEĞİL: süresi geçmiş
-- partiden üretim ve sevkiyat çıkışı yazılamıyor.
--
-- Ekran tarafı bu ayrımı 25-26.10'da öğrendi (`warehouse.service.ts` →
-- `kullanilabilir`, İş Emirleri, Sevkiyatlar, Reçeteler, Kontrol Paneli).
-- Ama `app.isletme_gostergeleri` (0065) hâlâ FİZİKSEL bakiyeden kritik
-- kalem sayıyordu. Yani aynı işletmede:
--
--   Depo ekranı   : "Tavuk kritik" (kullanılabilir 0)
--   Analiz ekranı : kritik kalem sayısında Tavuk YOK (fiziksel 100)
--
-- İki ekranın aynı soruya iki cevap vermesi, kullanıcının ikisine de
-- güvenmesini bitirir — ve hangisinin doğru olduğunu söyleyemezdik.
--
-- ⚠️ İKİNCİ BİR FARK DAHA VARDI: eşik karşılaştırması. Depo ekranı
-- `kullanilabilir <= minMiktar` diyor, 0065 `< min_qty` diyordu. Minimum
-- miktara TAM OLARAK inmiş kalem bir ekranda kritik, diğerinde değildi.
--
-- ── ÇÖZÜM: KURAL TEK YERDE, GÖRÜNÜMDE ────────────────────────────────────
-- `stock_usable_balance` görünümü kuruluyor. Kuralı her sorgunun kendi
-- içinde tekrar yazmak, aynı hatayı üçüncü kez yapmanın en kolay yolu
-- olurdu: biri `<` yazar, biri lot tarihini unutur, kimse farkı görmez.
--
-- ⚠️ `security_invoker = on` ŞART. Onsuz görünüm SAHİBİNİN haklarıyla
-- çalışır ve RLS'i atlar: iki kiracı birbirinin bakiyesini görür (0006'nın
-- `stock_balance` için yazdığı notun aynısı).
--
-- ⚠️ Görünüm `expires_on` TARİHİNE bakıyor, `stock_item.tracks_expiry`
-- BAYRAĞINA değil. Sebep: 0092'nin kapısı da bayrağa bakmıyor. Bayrak bir
-- beyandır, tarih bir olgudur; kural olguya bakmak zorunda yoksa sunucu
-- reddederken rapor "stok var" der.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · KULLANILABİLİR BAKİYE GÖRÜNÜMÜ ───────────────────────────────────
-- kullanılabilir = fiziksel bakiye − SKT'si GEÇMİŞ partilerin bakiyesi
--
-- ⚠️ Negatife inmiyor: fiziksel bakiye negatif politikayla eksiye düşmüş
-- olabilir ve "kullanılabilir -3" anlamsız bir sayıdır. Ekran tarafı da
-- aynı şeyi yapıyor (`Math.max(0, miktar - suresiGecmis)`).
--
-- ⚠️ SKT GÜNÜ hâlâ kullanılabilir: `l.expires_on < current_date`. `<=`
-- yazmak bir günlük malı rapordan düşürürdü ve 0092'nin kararına aykırı
-- olurdu (orada da `<`).
create or replace view stock_usable_balance as
select
  b.tenant_id,
  b.branch_id,
  b.stock_item_id,
  b.qty as qty,
  coalesce(g.expired_qty, 0) as expired_qty,
  greatest(0, b.qty - coalesce(g.expired_qty, 0)) as usable_qty
from public.stock_balance b
left join (
  select lb.tenant_id, lb.branch_id, lb.stock_item_id,
         sum(lb.qty) as expired_qty
    from public.stock_lot_balance lb
    join public.stock_lot l on l.id = lb.lot_id
   where l.expires_on is not null
     and l.expires_on < current_date
     and lb.qty > 0
   group by lb.tenant_id, lb.branch_id, lb.stock_item_id
) g on g.tenant_id = b.tenant_id
   and g.branch_id = b.branch_id
   and g.stock_item_id = b.stock_item_id;

alter view stock_usable_balance set (security_invoker = on);

comment on view stock_usable_balance is
  'Fiziksel bakiye, SKT gecmis parti bakiyesi ve KULLANILABILIR bakiye. '
  'Uretim ve sevkiyat cikisi yalniz kullanilabilir bakiyeden yazilabilir '
  '(0092). Kural tek yerde: her sorgu kendi icinde tekrar yazmasin.';

grant select on stock_usable_balance to authenticated, service_role;
revoke all privileges on stock_usable_balance from anon;


-- ── 2 · GÖSTERGELER ONU OKUYOR ───────────────────────────────────────────
-- ⚠️ Gövdenin TAMAMI 0065'ten alındı ve YALNIZ `kritik_kalem` bloğu
-- değişti. `create or replace function` gövdeyi komple değiştirdiği için
-- tek satır yazmak mümkün değil; değişen yer aşağıda ⚠️ ile işaretli.
--
-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║ ⚠️ 27.10.2026 · BU DOSYA DÜZELTİLDİ · MIYOP-078 (P0, Codex)            ║
-- ╚═══════════════════════════════════════════════════════════════════════╝
-- İlk yazdığım hâlde gövde `app.isletme_gostergeleri` adına yazılıyordu.
-- Ama **0071 o adı bir İZİN KAPISINA çevirmişti** ve ham hesabı
-- `app.isletme_gostergeleri_ham` adına taşımıştı. Yani bu göç, gövdeyi
-- 0065'ten kopyalarken 0071'in `finance.read` kapısını EZİYORDU.
--
-- Sonucu: finans izni olmayan bir kullanıcı (depo, üretim, kalite, gıda
-- mühendisi) fire tutarını ve stok maliyetini doğrudan RPC'den okuyabildi.
-- Göç 0099 canlıdaki kapıyı geri koydu.
--
-- ⚠️ **DOSYA NEDEN DEĞİŞTİRİLDİ** — normalde uygulanmış bir göçe
-- dokunmuyorum (bkz. 0090/0098 kararı). Buradaki fark şu: 0090'ın bayat
-- hâli yeniden çalıştırılınca yalnız HATA veriyordu. Bu dosyanın eski hâli
-- ise yeniden çalıştırılınca **"Success" der ve bir güvenlik kapısını
-- sessizce düşürürdü.** Depoda böyle bir mayını not bırakarak çözmek,
-- kuralı yorumda tutmak olurdu (tuzak 74). Dosya artık doğru adı yazıyor;
-- canlıdaki durum değişmedi, yalnız aynı zararın tekrarı imkânsız oldu.
create or replace function app.isletme_gostergeleri_ham(
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
-- ⚠️ MIYOP-074 · BURADA `stock_balance` (FİZİKSEL bakiye) ve `<` YAZIYORDU.
-- İki ayrı fark, ikisi de Analiz ekranındaki sayıyı Depo ekranındakinden
-- AYIRIYORDU:
--   1. Fiziksel bakiye, süresi geçmiş malı da sayıyordu. Depo ekranı
--      (`warehouse.service.ts`) kritik kararını KULLANILABİLİR bakiyeden
--      veriyor; süresi geçmiş mal sipariş ihtiyacını karşılamaz.
--   2. `<` ile `<=` farkı: minimum miktara TAM OLARAK inmiş kalem Depo
--      ekranında kritik, Analiz'de değildi.
-- Aynı soruya iki ekranın iki ayrı cevap vermesi, ikisine de güveni bitirir.
select 'kritik_kalem', count(*)::numeric, null
  from public.stock_item i
  left join public.stock_usable_balance b
         on b.stock_item_id = i.id and b.branch_id = p_sube
 where i.branch_id = p_sube
   and i.is_active
   and i.min_qty > 0
   and coalesce(b.usable_qty, 0) <= i.min_qty

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

-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
declare v_govde text; v_sec boolean;
begin
  if not exists (select 1 from information_schema.views
                  where table_schema = 'public'
                    and table_name = 'stock_usable_balance') then
    raise exception '0095: stock_usable_balance görünümü oluşmadı.';
  end if;

  -- ⚠️ RLS'i atlayan bir görünüm, iki kiracıyı birbirine gösterir.
  select 'security_invoker=on' = any(c.reloptions) into v_sec
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'stock_usable_balance';
  if v_sec is not true then
    raise exception '0095: stock_usable_balance security_invoker KAPALI; RLS atlanıyor.';
  end if;

  if has_table_privilege('anon', 'public.stock_usable_balance', 'select') then
    raise exception '0095: anon kullanılabilir bakiyeyi görebiliyor.';
  end if;

  -- ⚠️ 27.10 · BU BLOK YANLIŞ FONKSİYONU ÖLÇÜYORDU (MIYOP-078).
  -- `isletme_gostergeleri` gövdesinde `stock_usable_balance` arıyordu; ham
  -- hesabı oraya yazdığım için ölçüm GEÇİYORDU. Doğru yere yazsaydım kendi
  -- doğrulamam kırmızı verecekti. Yani doğrulama, hatayı yakalamak şöyle
  -- dursun, hatayı GEREKTİRİYORDU (tuzak 127).
  select pg_get_functiondef(p.oid) into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'isletme_gostergeleri_ham';
  if v_govde is null then
    raise exception '0095: app.isletme_gostergeleri_ham bulunamadı. '
      'Bu göç 0071''den SONRA çalışmalı.';
  end if;
  if v_govde !~ 'stock_usable_balance' then
    raise exception '0095: göstergeler hâlâ fiziksel bakiyeden kritik kalem sayıyor.';
  end if;
  if v_govde !~ 'usable_qty, 0\) <= i\.min_qty' then
    raise exception '0095: kritik eşiği <= değil; Depo ekranından ayrı davranır.';
  end if;

  -- ⚠️ BU GÖÇ KAPIYI EZDİ Mİ? — ve YALNIZ bu soruluyor.
  --
  -- 27.10 akşamı burada *"kapı yerinde mi (finance.read var mı)"* diye
  -- soruyordum ve CANLIDA PATLADI: paket 0094→0100 sırayla çalışıyor,
  -- kapıyı 0099 onarıyor, ama bu kontrol 0095'te — yani onarımdan ÖNCE.
  -- Kapı o anda hâlâ ezikti (dün bu göçün eski hâli ezmişti) ve kontrol
  -- haklı olarak kırmızı verdi; ama Supabase betiği tek işlemde çalıştırdığı
  -- için **bütün paketi geri aldı** ve 0099'un onarımı hiç uygulanamadı.
  -- Yani doğru bir kontrol, yanlış yerde durduğu için onarımı rehin aldı
  -- (tuzak 129'un ikinci hâli).
  --
  -- ⚠️ Kapının VARLIĞI bu göçün sorumluluğu değil — 0071 kurar, 0099 onarır,
  -- ikisi de kendi içinde ölçer. Bu göçün sorumluluğu **kapıyı ezmemek**.
  -- Ölçülen soru da o: ham hesap kapının adına yazılmış mı?
  select pg_get_functiondef(p.oid) into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'isletme_gostergeleri';
  if v_govde is not null
     and (v_govde ~ 'stock_usable_balance' or v_govde ~ 'from public\.stock_movement')
  then
    raise exception
      '0095: ham hesap İZİN KAPISININ adına yazılmış (MIYOP-078 tekrarı). '
      'Hesap app.isletme_gostergeleri_ham fonksiyonuna yazılmalı; '
      'app.isletme_gostergeleri yalnız finance.read kapısıdır (0071).';
  end if;

  raise notice '0095: Kullanılabilir bakiye görünümü kuruldu; hesap _ham''da, kapı ezilmedi.';
end $$;
