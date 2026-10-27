-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0100 — AÇILIŞ SONUCU SUNUCUDA ZORUNLU
--
-- ── NEDEN VAR (MIYOP-081 · Codex, 27.10) ─────────────────────────────────
-- 0093 olay defterinde **gerekçeyi** zorunlu kıldı:
--     check (event_type = 'ALINDI' or (reason is not null and btrim(reason) <> ''))
-- Ama **sonucu** zorunlu kılmadı. Ekran istiyordu, veritabanı istemiyordu.
--
-- ⚠️ Bu tam olarak `write-off.service.ts`te yazdığım kuralın ihlali:
-- *"Gerekçe EKRAN kuralı değil, SERVİS kuralıdır: hangi ekrandan gelirse
-- gelsin boş geçilemez."* Açılış sonucu için aynısını yazmamışım.
--
-- ── NEDEN ÖNEMLİ ─────────────────────────────────────────────────────────
-- Şahit numunenin BÜTÜN AMACI o cümledir. Numune müşteri önünde açılır ve
-- *"ürün uygun"* ya da *"koku var"* yazılır; bu yazılmazsa açılış hiçbir
-- şey kanıtlamaz — üstelik **açılış saklama sonunu KISALTIYOR** (0094), yani
-- sonuçsuz bir açılış numunenin ömrünü sebepsiz azaltabilirdi.
--
-- Ekran kapısı duruyordu; ama ekranı atlayan doğrudan bir API çağrısı
-- sonuçsuz açılış yazabiliyordu.
--
-- ── NEDEN TETİK DEĞİL KISIT ──────────────────────────────────────────────
-- `check` bildirimseldir: atlanamaz, unutulamaz, `security definer` bir
-- rutin bile ihlal edemez. Aynı kuralı tetiğe yazmak, 0093'ün gerekçe
-- kısıtıyla iki farklı mekanizma kullanmak olurdu.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · VAR OLAN KAYITLAR İHLAL EDİYOR MU ────────────────────────────────
-- ⚠️ Kısıt eklemeden ÖNCE bakılıyor. `alter table` ham bir PostgreSQL
-- hatasıyla patlasaydı, sebebi okuyana kadar vakit kaybı olurdu.
do $$
declare v_sayi int;
begin
  select count(*) into v_sayi from public.witness_sample_event
   where event_type = 'ACILDI'
     and (result is null or btrim(result) = '');
  if v_sayi > 0 then
    raise exception
      '0100: % adet AÇILDI kaydında sonuç yazılı değil. Kısıt eklenemez; '
      'önce o kayıtların sonucu girilmeli. Olay defteri DEĞİŞMEZ olduğu '
      'için bu kayıtlar düzeltilemez — bu durumda kuralı yalnız YENİ '
      'kayıtlar için zorlamak gerekir (`not valid` ile) ve o karar '
      'yazılarak verilmelidir.', v_sayi;
  end if;
end $$;


-- ── 2 · KISIT ────────────────────────────────────────────────────────────
alter table witness_sample_event
  drop constraint if exists witness_sample_event_result_required;

-- ⚠️ YALNIZ `ACILDI` için. `ALINDI`nın sonucu yoktur (numune alındı, o
-- kadar); `IMHA`nın sonucu gerekçesinin içindedir (imha tutanağı). Üçünü de
-- zorlamak, kullanıcıya anlamsız alan doldurtmak olurdu.
alter table witness_sample_event
  add constraint witness_sample_event_result_required check (
    event_type <> 'ACILDI'
    or (result is not null and btrim(result) <> '')
  );

comment on constraint witness_sample_event_result_required
  on witness_sample_event is
  'Acilis SONUC ister (0100). Sahit numunenin butun amaci o cumledir; '
  'ustelik acilis saklama sonunu KISALTIR (0094), sonucsuz acilis numunenin '
  'omrunu sebepsiz azaltirdi.';


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
declare v_tanim text;
begin
  select pg_get_constraintdef(c.oid) into v_tanim
    from pg_constraint c
   where c.conrelid = 'public.witness_sample_event'::regclass
     and c.conname = 'witness_sample_event_result_required';
  if v_tanim is null then
    raise exception '0100: sonuç kısıtı oluşmadı.';
  end if;
  if v_tanim !~ 'ACILDI' or v_tanim !~ 'result' then
    raise exception '0100: kısıt açılış sonucunu zorlamıyor: %', v_tanim;
  end if;
  -- ⚠️ `not valid` DEĞİL: eski kayıtlar da kapsanmalı. Yukarıdaki ön kontrol
  -- ihlal olmadığını gösterdi, dolayısıyla doğrulanmış kısıt eklenebildi.
  if exists (select 1 from pg_constraint c
              where c.conrelid = 'public.witness_sample_event'::regclass
                and c.conname = 'witness_sample_event_result_required'
                and not c.convalidated) then
    raise exception '0100: kısıt `not valid` olarak eklenmiş; eski kayıtlar kapsam dışı.';
  end if;

  -- ⚠️ 0093'ün GEREKÇE kısıtı duruyor mu? Birini eklerken diğerini
  -- düşürmek, bir kuralı diğeriyle takas etmek olurdu.
  if not exists (select 1 from pg_constraint c
                  where c.conrelid = 'public.witness_sample_event'::regclass
                    and c.conname = 'witness_sample_event_reason_required') then
    raise exception '0100: 0093''ün gerekçe kısıtı kaybolmuş.';
  end if;

  raise notice '0100: Açılış sonucu sunucuda zorunlu (ALINDI ve IMHA kapsam dışı).';
end $$;
