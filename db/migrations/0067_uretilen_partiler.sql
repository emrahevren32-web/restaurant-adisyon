-- ═══════════════════════════════════════════════════════════════════════════
-- 0067 · ETİKETTEKİ PARTİ, ÜRETİLEN PARTİDEN GELİR
-- ---------------------------------------------------------------------------
-- Emrah (08.10.2026): *"yapıver o zaman."*
--
-- ── NEDEN ─────────────────────────────────────────────────────────────────
-- İzlenebilirlik zinciri defterde uçtan uca sağlam: mamulün partisinden iş
-- emrine, oradan tüketilen hammadde partilerine, oradan tedarikçiye
-- inilebiliyor. Geri çağırmada hangi müşteriye gittiği telefonuyla
-- listeleniyor.
--
-- AMA müşterinin eline geçen kâğıtta yazan parti numarası ELLE
-- YAZILIYORDU. Yani bütün zincirin son bir metresi klavyeye bağlıydı:
-- biri 20261007 yerine 20261006 yazdığı gün, geri çağırma YANLIŞ paleti
-- toplar ya da DOĞRU paleti kaçırır. İkisi de kötü, ve hangisinin olduğu
-- anlaşılmaz — çünkü kâğıtla sistem arasındaki tek bağ o numaraydı.
--
-- Üstelik etiket YASAL BELGEDİR. Üretim kaydıyla uyuşmayan bir lot
-- numarası, hiç lot yazmamaktan kötüdür: biri eksiklik, öteki YANLIŞ BEYAN.
--
-- ── NE YAPIYOR ────────────────────────────────────────────────────────────
-- Bir mamulün ÜRETİLMİŞ partilerini, üretim tarihi ve eldeki bakiyesiyle
-- birlikte döndürüyor. Etiket ekranı artık serbest metin yerine bu listeden
-- seçiyor; parti, üretim tarihi ve son kullanma KAYITTAN geliyor.
--
-- ⚠️ ÜRETİM TARİHİ `stock_lot.created_at`'TEN ALINMIYOR. O, parti KAYDININ
-- açıldığı an — iş emri bir gün önce açılıp ertesi gün üretilmiş olabilir.
-- Doğru olan, o partiye MAMUL GİRİŞİ yazan hareketin tarihidir: üretim,
-- malın deftere girdiği andır.
--
-- ⚠️ BAKİYESİ TÜKENMİŞ PARTİ DE LİSTEDE KALIYOR. Etiket bazen sonradan
-- yeniden basılır (yırtılan, kirlenen ambalaj). Listeden düşürseydik
-- kullanıcı elle yazmaya dönerdi ve bu göç boşa giderdi. Bakiye bilgi
-- olarak dönüyor; ekran "tükenmiş" diye işaretliyor, gizlemiyor.
--
-- ⚠️ `security invoker`: RLS çağıranın yetkisiyle işliyor.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.uretilen_partiler(p_kalem uuid)
returns table (
  parti_id       uuid,
  parti_kodu     text,
  uretim_tarihi  date,
  son_kullanma   date,
  bakiye         numeric,
  is_emri_no     text
)
language sql
stable
set search_path = public, app, pg_temp
as $$
  select l.id,
         l.lot_code,
         -- Üretim = malın deftere GİRDİĞİ an. Birden çok giriş varsa ilki.
         (select min(m.occurred_at)::date
            from public.stock_movement m
           where m.lot_id = l.id
             and m.reason = 'PRODUCTION_OUTPUT')                as uretim_tarihi,
         l.expires_on,
         -- ⚠️ Bakiye DEFTERDEN, görünümden: tarayıcıda toplasaydık
         -- PostgREST'in satır sınırında sessizce kesilirdi.
         coalesce((select b.qty from public.stock_lot_balance b
                    where b.lot_id = l.id), 0)                  as bakiye,
         -- Hangi iş emrinden doğdu. Kullanıcı listede partiyi bununla tanır;
         -- parti kodları birbirine benzer, iş emri numarası benzemez.
         (select w.order_no from public.work_order w
           where w.id = l.origin_id)                            as is_emri_no
    from public.stock_lot l
   where l.stock_item_id = p_kalem
     and l.origin_type = 'PRODUCTION'
   -- En yeni parti en üstte: etiket neredeyse her zaman son üretim içindir.
   order by (select min(m.occurred_at) from public.stock_movement m
              where m.lot_id = l.id and m.reason = 'PRODUCTION_OUTPUT')
            desc nulls last,
            l.created_at desc
$$;

comment on function app.uretilen_partiler(uuid) is
  'Bir mamulün üretilmiş partileri. Etiket ekranı parti, üretim tarihi ve '
  'son kullanmayı buradan alır — elle yazılmaz.';

-- ── DIŞ KAPI ───────────────────────────────────────────────────────────────
create or replace function public.uretilen_partiler(p_kalem uuid)
returns table (parti_id uuid, parti_kodu text, uretim_tarihi date,
               son_kullanma date, bakiye numeric, is_emri_no text)
language sql stable
set search_path = public, app, pg_temp
as $$ select * from app.uretilen_partiler(p_kalem) $$;

grant  execute on function public.uretilen_partiler(uuid) to authenticated;
revoke execute on function public.uretilen_partiler(uuid) from anon;

-- ── DOĞRULAMA ──────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'uretilen_partiler'
  ) then
    raise exception '0067: dış kapı açılmadı.';
  end if;

  -- ⚠️ `security definer` OLMAMALI: parti listesi işletmenin verisidir ve
  -- kiracı duvarının içinden okunmalı.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public','app') and p.proname = 'uretilen_partiler'
       and p.prosecdef
  ) then
    raise exception '0067: `security definer` olmuş — bu, bütün işletmelerin '
      'parti listesini okutan bir deliktir.';
  end if;

  raise notice '0067 TAMAM · uretilen_partiler (etiketteki parti artık kayıttan)';
end;
$$;
