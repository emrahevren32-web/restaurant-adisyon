-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0116 — GERİ ARAMA · YENİDEN BEKLEMEYE ALMA ÇAKIŞMASI
--               (MIYOP-109 · Codex 4. tur, 11.11.2026)
--
-- ── NE OLDU ──────────────────────────────────────────────────────────────
-- 0110 "aynı telefonda tek açık talep" kuralını kısmi tekillik indeksiyle
-- (`callback_request_acik_talep_tekil`) zorladı ve başvuru yolunda
-- (`geri_arama_gonder`) indeks hatasını anlaşılır `MI409`a çevirdi.
-- Ama talebin durumunu değiştiren İKİNCİ yolu (`geri_arama_durumu_yaz`)
-- çevirmedi. Sonuç (Codex kaynaktan gösterdi, burada ölçüldü):
--
--   aynı numaranın eski bir CLOSED talebi + yeni bir NEW talebi varken
--   eski talepte "Tekrar beklemeye al" →
--   `duplicate key value violates unique constraint
--    "callback_request_acik_talep_tekil"`  (23505)
--
-- Veri KORUNUYORDU — indeks işini yapıyor. Bozuk olan şey cümleydi:
-- platform yöneticisi neden yeniden açamadığını ham indeks adından
-- okumak zorundaydı.
--
-- ⚠️ BU, 0110'DA YAZDIĞIM KONTROL LİSTESİ MADDESİNİN (147) İHLALİYDİ:
-- *"Yeni bir tekillik indeksi eklerken, yazma döngüsünün hangi yollardan
-- o indekse çarpabileceği sayılır."* INSERT yolunu saydım, UPDATE yolunu
-- saymadım. Brifte Codex'e sorduğum soru da tam buydu.
--
-- ── NE DEĞİŞİYOR ─────────────────────────────────────────────────────────
-- `app.geri_arama_durumu_yaz` yeniden yazılıyor — İMZA AYNI, o yüzden
-- `create or replace` yerinde değiştiriyor ve YETKİLER KORUNUYOR (düşürme
-- yok; tuzak 67 burada tetiklenmiyor, ama yetkiler yine de ölçülüyor).
--
--   1. ÖN KONTROL: talep yeniden NEW yapılıyorsa, telefon kilidi alınır
--      (0110'la aynı: 110 + telefon) ve o numaranın başka açık talebi
--      varsa `MI409` ile, **öteki talebin numarası söylenerek** durulur.
--   2. İKİNCİ KAT: UPDATE yine de indekse çarparsa aynı `MI409`a çevrilir —
--      ama yalnız O indeks için; başka bir tekillik bu cümleyle örtülmez.
--
-- ⚠️ ÇAKIŞMADA HİÇBİR ŞEY DEĞİŞMİYOR: ne durum, ne not defteri. Reddedilen
-- bir denemenin deftere "NEW" satırı düşürmesi, olmamış bir işi kayda
-- geçirmek olurdu.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0 · 0110 YÜRÜRLÜKTE Mİ ───────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_class where relname = 'callback_request_acik_talep_tekil') then
    raise exception '0116: GOC 0110 YURURLUKTE DEGIL (tekillik indeksi yok).';
  end if;
  raise notice '0116: 0110 yururlukte, olculdu. Devam.';
end $$;


-- ── 1 · DURUM YAZMA · çakışma anlaşılır cevap veriyor ────────────────────
create or replace function app.geri_arama_durumu_yaz(
  p_reference text,
  p_status    text,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_ben     uuid;
  v_ad      text;
  v_satir   public.callback_request;
  v_durum   text;
  v_not     text;
  v_satirim text;
  v_diger   text;
  v_kisit   text;
begin
  if not app.yetkim_var('platform.manage') then
    raise exception 'Geri arama talebini yalnızca EVREN360 platform yöneticisi güncelleyebilir.'
      using errcode = 'MI403';
  end if;

  -- ⚠️ İMZAYI SUNUCU ATAR. "Kim aradı" istemciden gelmiyor; parametresi
  -- bile yok (0087'nin kuralı).
  v_ben := app.aktif_kullanici_id();
  if v_ben is null then
    raise exception 'Bu işlem için oturum gerekiyor.' using errcode = 'MI403';
  end if;
  select full_name into v_ad from public.app_user where id = v_ben;

  v_durum := upper(btrim(coalesce(p_status, '')));
  if v_durum not in ('NEW','CONTACTED','CLOSED') then
    raise exception 'Geçersiz durum: %', p_status using errcode = 'MI422';
  end if;

  select * into v_satir from public.callback_request where reference = btrim(p_reference);
  if not found then
    raise exception 'Geri arama talebi bulunamadı: %', p_reference using errcode = 'MI404';
  end if;

  v_not := nullif(btrim(coalesce(p_note, '')), '');

  -- Kapatmak bir karardır: gerekçesiz kapanış, kapanmamış bir talepten
  -- kötüdür — liste temiz görünür, yapılan iş kayıtsız kalır.
  if v_durum = 'CLOSED' and v_not is null then
    raise exception 'Talebi kapatırken kısa bir not yazın (ne oldu?).'
      using errcode = 'MI422';
  end if;

  -- ⚠️ YENİDEN BEKLEMEYE ALMA ÇAKIŞMASI (MIYOP-109 · 0116).
  -- 0110 "aynı telefonda tek açık talep" kuralını indeksle zorluyor. Eski
  -- bir talebi yeniden NEW yapmak, o numaranın BAŞKA bir açık talebi varken
  -- indekse çarpar — ve bu fonksiyon o hatayı çevirmediği için platform
  -- yöneticisi ekranda ham indeks adını görüyordu.
  -- Kilit `geri_arama_gonder` ile AYNI (110 + telefon): yeniden açma ile
  -- yeni bir başvuru aynı anda gelirse sıraya girerler.
  if v_durum = 'NEW' and v_satir.status <> 'NEW' then
    perform pg_advisory_xact_lock(110, hashtext(v_satir.phone));
    select reference into v_diger
      from public.callback_request
     where phone = v_satir.phone and status = 'NEW' and id <> v_satir.id
     limit 1;
    if v_diger is not null then
      raise exception
        'Bu numaranın bekleyen başka bir talebi var (%). Aynı numara için '
        'iki açık talep olamaz; önce onu sonuçlandırın.', v_diger
        using errcode = 'MI409';
    end if;
  end if;

  -- Not BİRİKİYOR, üstüne yazılmıyor.
  v_satirim := to_char(now(), 'DD.MM.YYYY HH24:MI')
    || ' · ' || coalesce(v_ad, '(ad yok)')
    || ' · ' || v_durum
    || coalesce(' · ' || v_not, '');

  begin
    update public.callback_request
       set status       = v_durum,
           contact_note = coalesce(contact_note || E'\n', '') || v_satirim,
           -- İlk aramanın imzası bir daha değişmiyor.
           contacted_at = case when contacted_at is null and v_durum <> 'NEW'
                               then now() else contacted_at end,
           contacted_by = case when contacted_by is null and v_durum <> 'NEW'
                               then v_ben else contacted_by end,
           updated_at   = now(),
           updated_by   = v_ben
     where reference = btrim(p_reference);
  exception when unique_violation then
    -- ⚠️ İKİNCİ KAT. Yukarıdaki ön kontrol bunu zaten yakalar; buraya
    -- düşülmesi, kilidi almayan bir yazma yolunun araya girdiğini gösterir.
    -- Hangi kısıtın çarptığı OKUNUYOR: başka bir tekillik bu cümleyle
    -- örtülürse yanlış sebep söylenmiş olur (0110'un dersi).
    get stacked diagnostics v_kisit = constraint_name;
    if v_kisit = 'callback_request_acik_talep_tekil' then
      raise exception
        'Bu numaranın bekleyen başka bir talebi var. Aynı numara için iki '
        'açık talep olamaz; önce onu sonuçlandırın.'
        using errcode = 'MI409';
    end if;
    raise;
  end;
end $$;

comment on function app.geri_arama_durumu_yaz(text, text, text) is
  'Geri arama talebinin durumunu yazar (yalniz platform.manage). Imza '
  'sunucudan. Yeniden NEW yapilirken ayni numaranin baska acik talebi '
  'varsa MI409 verir ve HICBIR SEY degismez (0116 · MIYOP-109).';


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
declare v_govde text; v_say int;
begin
  -- Tek tanım: imza değişmedi, yanına ikincisi konmamış olmalı.
  select count(*) into v_say from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'geri_arama_durumu_yaz';
  if v_say <> 1 then
    raise exception '0116 DOGRULAMA: app.geri_arama_durumu_yaz % tanimli (1 olmali).', v_say;
  end if;

  select pg_get_functiondef('app.geri_arama_durumu_yaz(text, text, text)'::regprocedure)
    into v_govde;
  if v_govde !~ 'MI409' or v_govde !~ 'pg_advisory_xact_lock' then
    raise exception '0116 DOGRULAMA: govde cakisma kontrolunu tasimiyor.';
  end if;
  if v_govde !~ 'platform\.manage' then
    raise exception '0116 DOGRULAMA: platform kapisi govdeden dusmus.';
  end if;

  -- ⚠️ YETKİLER: `create or replace` yetkileri korur — ama "korur" bir
  -- beklentidir, ölçüm değil.
  if has_function_privilege('anon', 'public.geri_arama_durumu_yaz(text, text, text)', 'execute') then
    raise exception '0116 DOGRULAMA: anon durum yazabiliyor.';
  end if;
  if not has_function_privilege('authenticated', 'public.geri_arama_durumu_yaz(text, text, text)', 'execute') then
    raise exception '0116 DOGRULAMA: authenticated kabugu cagiramiyor.';
  end if;
  if has_function_privilege('authenticated', 'app.geri_arama_durumu_yaz(text, text, text)', 'execute')
     or has_function_privilege('anon', 'app.geri_arama_durumu_yaz(text, text, text)', 'execute') then
    raise exception '0116 DOGRULAMA: ic yardimci disaridan cagrilabiliyor.';
  end if;

  raise notice '0116 TAMAM · yeniden beklemeye alma cakismasi anlasilir cevap veriyor.';
end $$;


-- ── ÖZET ──────────────────────────────────────────────────────────────────
select 'degisen' as ne, 'app.geri_arama_durumu_yaz (imza ayni, yetkiler korundu)' as deger
union all
select 'cakisma cevabi', 'MI409 · oteki talebin numarasiyla'
union all
select 'cakismada degisen kayit', 'YOK (durum ve not defteri ayni kalir)'
union all
select 'acik talep', (select count(*)::text from public.callback_request where status = 'NEW')
union all
select 'ayni numarada cift acik talep',
       (select count(*)::text from (select phone from public.callback_request
                                     where status = 'NEW' group by phone having count(*) > 1) x)
union all
select 'dogrulama', 'gecti';
