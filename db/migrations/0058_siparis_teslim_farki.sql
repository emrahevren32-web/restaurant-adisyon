-- ═══════════════════════════════════════════════════════════════════════════
-- 0058 · SİPARİŞ–TESLİM FARKI — "ne istendi, ne hazırlandı, ne gitti"
-- ---------------------------------------------------------------------------
-- A4C'nin son rapor maddesi. Üç sayı tek satırda yan yana duruyor ve
-- aralarındaki fark KENDİLİĞİNDEN görünüyor:
--
--   İSTENDİ    → siparişin ŞU ANKİ satırları (0050, `siparis_guncel_satirlari`).
--                En son satırlı revizyon. Revize edilmiş bir siparişi ilk
--                hâliyle raporlamak, kimsenin istemediği bir malı eksik
--                göstermek olurdu.
--   HAZIRLANDI → bu siparişe bağlı iş emirlerinden defterе GERÇEKTEN yazılmış
--                mamul girişi (0022 + 0003).
--   GİTTİ      → sevk edilmiş sevkiyat satırları (0051).
--
-- ⚠️ HAZIRLANDI, 0056'daki PLAN DEĞİLDİR. 0056 "ne üretilmeli" der; bu rapor
-- "ne üretildi" der. Planı gerçekleşmiş gibi raporlamak, bu programın
-- varlık sebebine aykırıdır: plan bir niyettir, defter bir olaydır.
--
-- ⚠️ GERİ ALINAN ÜRETİM DÜŞÜLÜYOR. Defter ekleme-yalnız (ADR-001): bir mamul
-- girişi silinmez, TERS kayıtla iptal edilir. Ters kaydı saymasaydık iptal
-- edilmiş bir üretim raporda sonsuza kadar "hazırlandı" diye dururdu.
--
-- ⚠️ BİRİMLER UYUŞMUYORSA ÇIKARMA YAPILMIYOR — 0051'deki kuralın aynısı.
-- Üretim defter biriminde (`stock_item.base_uom`) ölçülür; sipariş kendi
-- biriminde yazılır. İkisi aynı değilse `uretim_olculebilir=false` döner ve
-- ekran tire gösterir. 100 kg sipariş ile 20 koli üretimi karşılaştırıp bir
-- sayı üretmek, yanlış olduğu belli olmayan bir sayı üretmektir.
--
-- ⚠️ "HAZIRLANDI = 0" EKSİKLİK DEĞİLDİR. Depodan karşılanan kalem hiç
-- üretilmez; o kalem için üretim sıfırdır ve bu doğrudur. Eksikliği söyleyen
-- sütun `kalan`dır (sipariş − sevk), üretim değil. Ekran da böyle yazıyor.
--
-- Fark KAYITLARI (`order_discrepancy`) bu fonksiyona KATILMIYOR: bir fark
-- kaydı kalemsiz de açılabilir (sevkiyatın tamamına dair) ve kaleme göre
-- gruplanınca o kayıtlar görünmez olurdu. Ekran onları ayrı okuyor.
--
-- Yeni tablo YOK, yeni kolon YOK — bu göç yalnızca iki fonksiyon ekler.
-- Dolayısıyla `DISA_AKTARILAN_TABLOLAR` / `TABLO_ETIKETLERI` listelerinde
-- değişiklik gerekmiyor (01.10'da unutulan üçüncü adım).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · RAPOR ─────────────────────────────────────────────────────────────
-- `security definer` DEĞİL ve bilerek: RLS çağıranın kimliğiyle işlesin.
-- Rapor, kullanıcının zaten göremediği bir siparişi göstermemeli.
create or replace function app.siparis_teslim_farki(p_siparis uuid)
returns table (
  kalem_id           uuid,
  kalem_adi          text,
  istendi            numeric,
  istendi_birim      text,
  hazirlandi         numeric,
  hazirlandi_birim   text,
  uretim_olculebilir boolean,
  is_emri_sayisi     integer,
  acik_is_emri       integer,
  gitti              numeric,
  gitti_birimleri    text[],
  kalan              numeric,
  birim_uyusmuyor    boolean,
  siparis_disi       boolean
)
language sql
stable
as $$
  with sevk as (
    -- İstendi + gitti + kalan 0051'den geliyor; burada YENİDEN hesaplanmıyor.
    -- İki yerde hesaplanan bir sayı, bir gün iki farklı cevap verir.
    select * from app.siparis_sevk_durumu(p_siparis)
  ),
  is_emirleri as (
    select w.id, w.output_item_id, w.status
      from public.work_order w
     where w.order_id = p_siparis
  ),
  is_emri_sayilari as (
    select output_item_id as kid,
           count(*)::int as toplam,
           count(*) filter (where status in ('DRAFT','STARTED'))::int as acik
      from is_emirleri
     group by output_item_id
  ),
  uretim_hareketleri as (
    select m.id, m.stock_item_id, m.quantity_base
      from public.stock_movement m
     where m.source_type = 'work_order'
       and m.source_id in (select id from is_emirleri)
       and m.reason = 'PRODUCTION_OUTPUT'
  ),
  geri_alinanlar as (
    -- Ters kayıt negatiftir; toplama katılınca üretimi kendiliğinden düşürür.
    select r.stock_item_id, r.quantity_base
      from public.stock_movement r
     where r.reverses_movement_id in (select id from uretim_hareketleri)
  ),
  uretim as (
    select kid, sum(qty) as qty
      from (
        select stock_item_id as kid, quantity_base as qty from uretim_hareketleri
        union all
        select stock_item_id as kid, quantity_base as qty from geri_alinanlar
      ) t
     group by kid
  )
  select
    s.kalem_id,
    i.name,
    s.siparis_miktar,
    s.siparis_birim,
    coalesce(u.qty, 0),
    i.base_uom,
    -- Sipariş birimi defter birimiyle aynıysa üretim sipariş miktarıyla
    -- karşılaştırılabilir; değilse sayı var ama kıyas YOK.
    coalesce(s.siparis_birim is not null and s.siparis_birim = i.base_uom, false),
    coalesce(w.toplam, 0),
    coalesce(w.acik, 0),
    s.sevk_miktar,
    s.sevk_birimleri,
    s.kalan,
    s.birim_uyusmuyor,
    s.siparis_disi
  from sevk s
  left join public.stock_item i on i.id = s.kalem_id
  left join uretim           u on u.kid = s.kalem_id
  left join is_emri_sayilari w on w.kid = s.kalem_id
  order by i.name nulls last;
$$;

comment on function app.siparis_teslim_farki(uuid) is
  'Sipariş–teslim farkı: ne istendi (güncel revizyon) · ne hazırlandı '
  '(iş emirlerinden defterе yazılmış GERÇEK mamul girişi, ters kayıtlar '
  'düşülmüş) · ne gitti (sevk edilmiş sevkiyat satırları). Birimler '
  'uyuşmuyorsa çıkarma yapılmaz.';

-- ── 2 · PostgREST KAPISI ──────────────────────────────────────────────────
-- PostgREST yalnız `public` şemasını yayımlar (ADR-003). `app.*` fonksiyonu
-- ekrandan çağrılamaz; `public` sarmalayıcı bu yüzden var.
create or replace function public.siparis_teslim_farki(p_siparis uuid)
returns table (
  kalem_id           uuid,
  kalem_adi          text,
  istendi            numeric,
  istendi_birim      text,
  hazirlandi         numeric,
  hazirlandi_birim   text,
  uretim_olculebilir boolean,
  is_emri_sayisi     integer,
  acik_is_emri       integer,
  gitti              numeric,
  gitti_birimleri    text[],
  kalan              numeric,
  birim_uyusmuyor    boolean,
  siparis_disi       boolean
)
language sql
stable
as $$
  select * from app.siparis_teslim_farki(p_siparis);
$$;

revoke all on function public.siparis_teslim_farki(uuid) from public;
revoke all on function public.siparis_teslim_farki(uuid) from anon;
grant execute on function public.siparis_teslim_farki(uuid) to authenticated, service_role;

-- ── 3 · KENDİ KENDİNİ SINAMA ──────────────────────────────────────────────
do $$
begin
  if to_regprocedure('app.siparis_teslim_farki(uuid)') is null then
    raise exception '0058: app.siparis_teslim_farki yok.';
  end if;
  if to_regprocedure('public.siparis_teslim_farki(uuid)') is null then
    raise exception '0058: public sarmalayıcı yok — ekran fonksiyonu çağıramaz.';
  end if;
  if has_function_privilege('anon', 'public.siparis_teslim_farki(uuid)', 'execute') then
    raise exception '0058: anon raporu çalıştırabiliyor.';
  end if;
  if not has_function_privilege('authenticated', 'public.siparis_teslim_farki(uuid)', 'execute') then
    raise exception '0058: authenticated raporu çalıştıramıyor.';
  end if;

  raise notice '0058 TAMAM · ne istendi / ne hazırlandı / ne gitti tek satırda';
end;
$$;
