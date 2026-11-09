-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0109 — ŞAHİT NUMUNE OLAY ZAMANI SUNUCUDAN DAMGALANIYOR
--
-- ── NEDEN VAR ────────────────────────────────────────────────────────────
-- **MIYOP-101 · P1 · İSTEMCİNİN GÖNDERDİĞİ `occurred_at` SAKLAMA KURALINI
-- ETKİSİZ BIRAKIYORDU.**
--
-- 0094'te açık raf ömrü kuralı şöyle yazıldı:
--     v_an := coalesce(new.occurred_at, now());
--     keep_until := least(s.keep_until, (v_an::date + v_acik));
--
-- `occurred_at` istemciden gelebilen bir kolon (0093: `default now()`, ama
-- NOT NULL default'u istemci yazarsa yazılır). Yani "ACILDI" olayını
-- gelecek bir tarihle yazan bir istemci için `v_an::date + v_acik`
-- partinin SKT'sinin ötesine düşüyor, `least()` eski değeri seçiyor ve
-- saklama sonu HİÇ KISALMIYOR. Açılmış numune mühürlüymüş gibi davranıyor.
--
-- ⚠️ TAHMİN DEĞİL, ÖLÇÜLDÜ. Prova veritabanında canlandırıldı:
--     NOTICE:  acilmadan once keep_until = 2026-11-28
--     NOTICE:  acildiktan sonra keep_until = 2026-11-28   ← kısalmadı
--     NOTICE:  dogrusu (bugun + 2) = 2026-11-10
-- Olayın `occurred_at`ı 2027'ye yazıldığında kural sessizce iptal oldu.
--
-- ── ONARIM · 0087'NİN KURALI BU KOLONA DA UYGULANIYOR ────────────────────
-- 0081/0087 deseni: "imza istemciden gelmez, sunucu damgalar." Aynısı
-- olay zamanına da geçerli. Şahit numune defterinde olayın zamanı, olayın
-- YAZILDIĞI andır; geçmişe ya da geleceğe tarih atmak defterin tek işini
-- (bir tartışmada neyin ne zaman olduğunu söylemek) bozar.
--
--     new.occurred_at := now();      -- coalesce DEĞİL: koşulsuz damga
--     v_an            := new.occurred_at;
--
-- ⚠️ `coalesce(new.occurred_at, now())` YETMEZ. Kolon NOT NULL olduğu için
-- istemci bir değer gönderdiğinde coalesce o değeri SEÇER. Kusur tam
-- oradaydı: yazılmış ama çalışmayan bir koruma.
--
-- ── NE DEĞİŞMİYOR ────────────────────────────────────────────────────────
-- Hiçbir ekran akışı kırılmıyor: `src/quality/witness-sample.repository.ts`
-- > `olayYaz()` `occurred_at` GÖNDERMİYOR (ölçüldü). Sunucu damgası bugüne
-- kadar da fiilen uygulanıyordu; bu göç onu kuralın kendisi yapıyor.
-- 0094'ün diğer bütün kuralları yerinde: kiracı sunucudan, satır kilidi
-- (`for update`), `least()` ile yalnız kısaltma, IMHA'dan sonra kapalı
-- defter, append-only.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.numune_olayi()
returns trigger
language plpgsql security definer set search_path = public, app, pg_temp
as $$
declare
  v_kiraci uuid;
  v_durum  text;
  v_acik   integer;
  v_an     timestamptz;
begin
  -- ⚠️ MIYOP-075 (0094): kiracı SUNUCUDAN okunuyor ve numune aramasına
  -- kiracı da giriyor.
  v_kiraci := app.current_tenant_id();
  if v_kiraci is null then
    raise exception 'MİYOP: oturumda işletme kimliği yok; numune kaydı yazılamaz.'
      using errcode = 'MI403';
  end if;
  new.tenant_id     := v_kiraci;
  new.actor_user_id := app.aktif_kullanici_id();

  -- ⚠️ MIYOP-101 (0109): OLAY ZAMANI SUNUCUDAN. Koşulsuz damga; istemcinin
  -- gönderdiği değer yok sayılıyor. `coalesce` ile bırakılırsa gelecek bir
  -- tarih `least()`i etkisiz bırakıp saklama sonunu kısaltmayı engelliyordu.
  new.occurred_at   := now();
  v_an              := new.occurred_at;

  -- ⚠️ `for update`: MIYOP-077. Okuma ile yazma arasında satır serbest
  -- kalmıyor; eşzamanlı ACILDI bir IMHA'nın üstüne binemiyor.
  select s.status, s.opened_shelf_life_days
    into v_durum, v_acik
    from public.witness_sample s
   where s.id = new.sample_id
     and s.tenant_id = v_kiraci
     for update;

  if v_durum is null then
    raise exception 'MİYOP: numune bulunamadı.' using errcode = 'MI404';
  end if;

  -- ⚠️ İmha edilmiş numuneye yeni olay yazılamaz: defter kapanmıştır.
  if v_durum = 'IMHA' then
    raise exception 'MİYOP: imha edilmiş numuneye yeni kayıt eklenemez.'
      using errcode = 'MI409';
  end if;

  if new.event_type = 'ACILDI' then
    -- ⚠️ MIYOP-076. Açılan numune artık mühürlü değil. Açık raf ömrü
    -- tanımlıysa saklama sonu KISALIR; `least()` olduğu için asla uzamaz.
    update public.witness_sample s
       set status     = 'ACILDI',
           keep_until = case
                          when v_acik is null then s.keep_until
                          else least(s.keep_until, (v_an::date + v_acik))
                        end
     where s.id = new.sample_id
       and s.tenant_id = v_kiraci;

  elsif new.event_type = 'IMHA' then
    update public.witness_sample s
       set status = 'IMHA'
     where s.id = new.sample_id
       and s.tenant_id = v_kiraci;
  end if;

  return new;
end $$;

revoke all on function app.numune_olayi() from public;
revoke all on function app.numune_olayi() from anon;
revoke all on function app.numune_olayi() from authenticated;


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
-- ⚠️ TUZAK 181 (bu depoda 5. kez): `pg_get_functiondef` YORUMLARI DA
-- döndürüyor. Yorumda geçen `coalesce(new.occurred_at` yazısı ölçümü
-- yanıltır. Bu yüzden ölçümden önce yorumlar siliniyor.
do $$
declare v_govde text; v_ham text;
begin
  select pg_get_functiondef(p.oid) into v_ham
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'numune_olayi';

  if v_ham is null then
    raise exception '0109 DOGRULAMA: app.numune_olayi() bulunamadi.';
  end if;

  v_govde := regexp_replace(v_ham, '--[^\n]*', '', 'g');

  -- 1 · Sunucu damgasi var mi?
  if v_govde !~ 'new\.occurred_at\s*:=\s*now\(\)' then
    raise exception '0109 DOGRULAMA: olay zamani sunucuda damgalanmiyor.';
  end if;
  -- 2 · Eski kosullu hal gitti mi? (Kusurun ta kendisi.)
  if v_govde ~ 'coalesce\s*\(\s*new\.occurred_at' then
    raise exception
      '0109 DOGRULAMA: coalesce(new.occurred_at, ...) hala duruyor; '
      'istemcinin tarihi kurali etkisiz birakabilir.';
  end if;
  -- 3 · 0094'un kurallari yerinde mi? Bir kapiyi onarirken digerini
  --     dusurmemek icin olculuyor.
  if v_govde !~ 'app\.current_tenant_id\(\)' then
    raise exception '0109 DOGRULAMA: kiraci siniri dustu (MIYOP-075).';
  end if;
  if v_govde !~* 'for\s+update' then
    raise exception '0109 DOGRULAMA: satir kilidi dustu (MIYOP-077).';
  end if;
  if v_govde !~ 'least' then
    raise exception '0109 DOGRULAMA: least() dustu; saklama sonu uzayabilir.';
  end if;
  if v_govde !~ 'opened_shelf_life_days' then
    raise exception '0109 DOGRULAMA: acik raf omru okunmuyor (MIYOP-076).';
  end if;
  if v_govde !~ 'IMHA' then
    raise exception '0109 DOGRULAMA: kapali defter kurali dustu.';
  end if;

  -- 4 · Tetik hala bagli mi? Fonksiyonu degistirmek tetigi dusurmez;
  --     yine de varsayim degil olcum.
  if not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                  where c.relname = 'witness_sample_event'
                    and g.tgname = 'numune_olayi' and not g.tgisinternal) then
    raise exception '0109 DOGRULAMA: numune_olayi tetigi bagli degil.';
  end if;

  raise notice '0109 TAMAM · olay zamani sunucudan damgalaniyor; '
    'istemcinin tarihi saklama kuralini etkisiz birakamaz.';
end $$;


-- ── ÖZET ──────────────────────────────────────────────────────────────────
select 'olay zamani' as ne, 'sunucu damgasi (now())' as deger
union all
select 'istemci occurred_at', 'yok sayiliyor'
union all
select 'dogrulama', 'gecti';
