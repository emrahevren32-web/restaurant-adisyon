-- ═══════════════════════════════════════════════════════════════════════════
-- 0069 · FİRMAYA BİLDİRİM — portal siparişi kontrol panelinde (A4C-14)
-- ---------------------------------------------------------------------------
-- Yol haritası ölçütü: *"Sipariş güncellendiğinde firma ANINDA görüyor"*
--
-- Bugüne kadar portaldan gelen ya da güncellenen bir sipariş hiçbir yerde
-- haber vermiyordu: kullanıcının Siparişler ekranını açıp bakması
-- gerekiyordu. Müşteri sabah 7'de miktarı yarıya indirdiyse ve kimse
-- bakmadıysa, mutfak eski miktarı üretir — ve bunu teslimde öğrenir.
--
-- ── NEDEN YENİ BİR SORGU ──────────────────────────────────────────────────
-- Kontrol paneli "hangi sipariş onay bekliyor" sorusunu `sales_order`dan
-- okuyabilirdi. Ama asıl soru şu: **bu sipariş MÜŞTERİDEN Mİ geldi, ve NE
-- ZAMANDIR bekliyor?** Bunun cevabı son revizyonun `source` alanında ve
-- ekran bu alanı hiç okumuyordu.
--
-- ⚠️ "SON REVİZYON" = EN BÜYÜK NUMARA, en son yazılan satır değil.
-- Revizyonlar sıralı yazılıyor ama geri doldurma (0063) sırası bozabilir;
-- numaraya bakmak kesin, zamana bakmak değil.
--
-- ⚠️ BEKLEME SÜRESİ REVİZYON ZAMANINDAN, siparişin açılışından DEĞİL.
-- Üç gün önce açılıp bu sabah güncellenen bir sipariş "3 gündür bekliyor"
-- değildir; o rakam paneli yalancı çıkarır ve kullanıcı bir daha inanmaz.
--
-- ⚠️ `security invoker`: RLS çağıranın yetkisiyle.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.dikkat_siparisleri(p_sube uuid)
returns table (
  siparis_id     uuid,
  siparis_no     text,
  musteri_adi    text,
  durum          text,
  kaynak         text,
  revizyon_no    integer,
  revizyon_zamani timestamptz,
  bekleme_saati  numeric,
  satir_sayisi   integer
)
language sql
stable
set search_path = public, app, pg_temp
as $$
  select s.id,
         s.order_no,
         -- ⚠️ `left join` değil alt sorgu: müşteri kartı silinmişse satır
         -- KAYBOLMAZ, adı boş gelir (tuzak 54).
         (select c.name from public.customer c where c.id = s.customer_id),
         s.status,
         r.source,
         r.revision_no,
         r.created_at,
         round(extract(epoch from (now() - r.created_at)) / 3600.0, 1),
         (select count(*)::int from public.sales_order_line l
           where l.order_id = s.id and l.revision_id = r.id)
    from public.sales_order s
    join lateral (
      select rv.id, rv.source, rv.revision_no, rv.created_at
        from public.sales_order_revision rv
       where rv.order_id = s.id
       order by rv.revision_no desc
       limit 1
    ) r on true
   where s.branch_id = p_sube
     and s.status = 'Onay Bekliyor'
   -- En uzun bekleyen en üstte: panelin işi en eskiyi öne çıkarmak.
   order by r.created_at asc
$$;

comment on function app.dikkat_siparisleri(uuid) is
  'Onay bekleyen siparişler, SON revizyonunun kaynağı ve bekleme süresiyle. '
  'Kontrol paneli portaldan geleni buradan ayırt eder.';

create or replace function public.dikkat_siparisleri(p_sube uuid)
returns table (siparis_id uuid, siparis_no text, musteri_adi text, durum text,
               kaynak text, revizyon_no integer, revizyon_zamani timestamptz,
               bekleme_saati numeric, satir_sayisi integer)
language sql stable
set search_path = public, app, pg_temp
as $$ select * from app.dikkat_siparisleri(p_sube) $$;

grant  execute on function public.dikkat_siparisleri(uuid) to authenticated;
revoke execute on function public.dikkat_siparisleri(uuid) from anon;

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'dikkat_siparisleri'
  ) then
    raise exception '0069: dış kapı açılmadı.';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public','app') and p.proname = 'dikkat_siparisleri'
       and p.prosecdef
  ) then
    raise exception '0069: `security definer` olmuş — bütün işletmelerin '
      'siparişlerini okutan bir deliktir.';
  end if;

  raise notice '0069 TAMAM · dikkat_siparisleri (portal siparişi panelde görünecek)';
end;
$$;
