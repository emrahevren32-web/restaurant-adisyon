-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0094 — ŞAHİT NUMUNE: KİRACI SINIRI, SATIR KİLİDİ, AÇIK RAF ÖMRÜ
--
-- ── NEDEN VAR ────────────────────────────────────────────────────────────
-- Bu göç, BİR ÖNCEKİ GÖÇTE (0093) BENİM BIRAKTIĞIM üç kusuru kapatıyor.
-- Birincisini Codex buldu; ölçüm aynı kusurun ikinci bir yerde daha
-- olduğunu gösterdi. Üçü de "yazdım ama çalışmıyor" sınıfında.
--
-- **1 · MIYOP-075 · P0 · BAŞKA KİRACININ NUMUNESİNE YAZILABİLİYORDU.**
--    `app.numune_olayi()` `security definer`dı — yani RLS'i atlıyordu — ve
--    numuneyi YALNIZ `new.sample_id` ile buluyordu. Olay satırının kendi
--    `tenant_id`si saldırganın kendi kiracısını gösterdiği için RLS de
--    geçiyordu. Sonuç: A kiracısındaki bir üretim sorumlusu, B kiracısının
--    numunesini IMHA'ya çevirebiliyordu.
--    ⚠️ Prova ile CANLANDIRILDI, tahmin değil: `db/prova/prova-0094.sql`
--    sınama 1 ve 2. Onarımdan önce B'nin numunesi IMHA oluyordu.
--
--    ⚠️ AYNI KUSUR `app.numune_turet()`TE DE VARDI ve Codex'in raporunda
--    yoktu. `stock_lot`, `branch` ve `work_order` id'leri kiracı
--    doğrulanmadan okunuyordu: A kiracısı B'nin PARTİSİNDEN numune
--    alabiliyordu (hem B'nin SKT'sini ve saklama koşulunu okuyarak, hem
--    kendi defterine B'nin partisine bir referans yazarak). Bir kusurun
--    gösterildiği yeri onarıp aynı desenin diğer yerlerine bakmamak,
--    onarımı yarım bırakmak olurdu.
--
-- **2 · MIYOP-077 · P1 · DURUM OKUMASI KİLİTSİZDİ.**
--    `select status ... ; update ...` arasında satır serbestti. Eşzamanlı
--    iki olay (biri ACILDI, biri IMHA) sırayla okuyup sırayla yazabilir,
--    IMHA'nın üstüne ACILDI binebilirdi. Artık okuma `for update`.
--
-- **3 · MIYOP-076 · P1 · `opened_shelf_life_days` HİÇ KULLANILMIYORDU.**
--    0093 bu kolonu yarattı ve hiçbir yerde okumadı. Yazılı kural
--    "açılmış ise açık kalmaya uygun olduğu gün kadar" diyordu; numune
--    açıldıktan sonra da saklama sonu partinin SKT'si kalıyordu. Yani
--    ekranda bir alan vardı, hiçbir şey yapmıyordu — tam olarak
--    "mış gibi yapmak".
--
--    Kural şimdi şöyle işliyor:
--      · Mühürlü numune        → saklama sonu = partinin SKT'si (0093).
--      · Açıldığında           → saklama sonu = en yakın olanı:
--                                 partinin SKT'si **veya**
--                                 açılış günü + açık raf ömrü.
--    ⚠️ `least()` — yani açılış saklama sonunu yalnız KISALTABİLİR, asla
--    uzatamaz. Emrah'ın kuralı: *"süre dolunca aynı zamanda verilmiş SKT
--    süresi de dolmuş demektir."* Açılmış bir numunenin SKT'yi aşması,
--    o kuralı tersine çevirmek olurdu.
--    ⚠️ Açık raf ömrü de saklama koşulu gibi ÜRÜN KARTINDAN kopyalanıyor
--    (`stock_item.opened_shelf_life_days`), ekrandan değil. Aynı sebep:
--    ekrandan gelirse aynı ürün iki numunede iki farklı ömür taşır.
--
-- **4 · NUMUNE KODUNUN TEKİLLİĞİ İSTEMCİYE BIRAKILMIŞTI.**
--    `sample_code_key` NOT NULL'du ama hiçbir yerde TÜRETİLMİYORDU: ekran ne
--    gönderirse o yazılıyordu. Tekillik indeksi `sample_code_key` üzerinde
--    olduğu için, aynı kodu farklı bir anahtarla gönderen bir istemci indeksi
--    ATLAYABİLİRDİ — "N-1" ve "n-1" iki ayrı numune olurdu. Şahit numunenin
--    tek işi bir tartışmada hangi partinin numunesi olduğunu söylemek; iki
--    numunenin aynı kodu taşıması tam o işi bozar.
--    Anahtar artık sunucuda türetiliyor ve kural uygulamadaki
--    `core/identifier.ts > normalizeIdentifier()` ile BİREBİR aynı.
--
-- ── NE DEĞİŞMİYOR ────────────────────────────────────────────────────────
-- 0093'ün bütün kuralları yerinde: numune partiye bağlı, saklama koşulu
-- karttan kopyalanıyor, defter append-only, DELETE yok, UPDATE yok,
-- imza sunucuda. Bu göç yalnız kapıları sıkıyor.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · AÇIK RAF ÖMRÜ ÜRÜN KARTINA ───────────────────────────────────────
-- ⚠️ Geriye dönük DOLDURULMUYOR. Bilinmeyen bir açık raf ömrünü uydurmak,
-- numunenin saklama sonunu uydurmak demek olurdu.
alter table stock_item
  add column if not exists opened_shelf_life_days integer;

alter table stock_item drop constraint if exists stock_item_opened_shelf_life_check;
alter table stock_item add constraint stock_item_opened_shelf_life_check
  check (opened_shelf_life_days is null or opened_shelf_life_days > 0);

comment on column stock_item.opened_shelf_life_days is
  'Acildiktan sonra kac gun uygun kaldigi. Sahit numune bu alandan '
  'kopyalanir ve acilista saklama sonunu KISALTIR (0094). Bos olabilir.';


-- ── 2 · KİMLİK ANAHTARI · UYGULAMAYLA AYNI KURAL ─────────────────────────
-- ⚠️ `core/identifier.ts > normalizeIdentifier()` ile BİREBİR aynı:
-- NFC, dört i varyantı (i/ı/I/İ) tek harfe katlanır, sonra büyük harf.
-- ⚠️ Yerel ayarla küçültme YAPILMAZ: 'ISTANBUL' Türkçe küçültmede 'ıstanbul'
-- olur ve 'istanbul' ile eşleşmez. Bu hata G1'de bir kez yaşandı (0017 notu).
create or replace function app.kimlik_anahtari(p_deger text)
returns text
language sql immutable as $$
  select case
    when p_deger is null then null
    else upper(replace(replace(normalize(btrim(p_deger), nfc), 'İ', 'I'), 'ı', 'i'))
  end
$$;

grant execute on function app.kimlik_anahtari(text) to authenticated, service_role;


-- ── 3 · TÜRETME · KİRACI DOĞRULANIYOR ────────────────────────────────────
create or replace function app.numune_turet()
returns trigger
language plpgsql security definer set search_path = public, app, pg_temp
as $$
declare
  v_kiraci     uuid;
  v_skt        date;
  v_kosul      text;
  v_kalem      uuid;
  v_lot_kiraci uuid;
  v_acik       integer;
begin
  -- ⚠️ KİRACI SUNUCUDAN. İstemcinin gönderdiği `tenant_id` yok sayılıyor;
  -- 0081/0087'nin "imza istemciden gelmez" deseni kiracıya da uygulanıyor.
  -- Bunun yazılmaması MIYOP-075'in yarısıydı.
  v_kiraci := app.current_tenant_id();
  if v_kiraci is null then
    raise exception 'MİYOP: oturumda işletme kimliği yok; numune yazılamaz.'
      using errcode = 'MI403';
  end if;
  new.tenant_id := v_kiraci;

  -- ⚠️ PARTİ KENDİ KİRACIMIZIN MI? Doğrulanmazsa başka müşterinin
  -- partisinin SKT'si ve saklama koşulu okunabiliyordu.
  select l.expires_on, l.stock_item_id, l.tenant_id
    into v_skt, v_kalem, v_lot_kiraci
    from public.stock_lot l where l.id = new.lot_id;

  -- ⚠️ "YOK" ile "BAŞKASININ" AYNI MESAJI VERİYOR, bilerek. Ayrı mesaj
  -- vermek, denemeyle başka bir kiracıda o id'nin VAR olduğunu
  -- doğrulatırdı.
  if v_kalem is null or v_lot_kiraci is distinct from v_kiraci then
    raise exception 'MİYOP: numunenin partisi bulunamadı.' using errcode = 'MI404';
  end if;

  -- Kalem partiden gelir: istemcinin gönderdiği kalem yanlışsa düzeltilir.
  new.stock_item_id := v_kalem;

  -- ⚠️ ŞUBE de kendi kiracımızın olmalı.
  if not exists (select 1 from public.branch b
                  where b.id = new.branch_id and b.tenant_id = v_kiraci) then
    raise exception 'MİYOP: numunenin şubesi bulunamadı.' using errcode = 'MI404';
  end if;

  -- ⚠️ İŞ EMRİ de. Boş kalabilir (açılış bakiyesi gibi partiler var).
  if new.work_order_id is not null
     and not exists (select 1 from public.work_order w
                      where w.id = new.work_order_id and w.tenant_id = v_kiraci) then
    raise exception 'MİYOP: numunenin iş emri bulunamadı.' using errcode = 'MI404';
  end if;

  if v_skt is null then
    raise exception
      'MİYOP: bu partinin son kullanma tarihi yok; şahit numunenin saklama '
      'sonu hesaplanamaz. Önce partiye SKT yazın.'
      using errcode = 'MI422';
  end if;
  -- ⚠️ TÜRETİLİYOR (0093 kural 1). İstemci ne gönderirse göndersin.
  new.keep_until := v_skt;

  select nullif(btrim(i.storage_condition), ''), i.opened_shelf_life_days
    into v_kosul, v_acik
    from public.stock_item i where i.id = v_kalem;

  if v_kosul is null then
    raise exception
      'MİYOP: bu ürünün saklama koşulu tanımlı değil. Şahit numune, '
      'müşteriye bildirilen koşulun AYNISINDA saklanmak zorunda; önce ürün '
      'kartına saklama koşulunu yazın.'
      using errcode = 'MI422';
  end if;
  -- ⚠️ KOPYALANIYOR (0093 kural 3). Ekranın yazdığı değer yok sayılıyor.
  new.storage_condition := v_kosul;
  -- ⚠️ AÇIK RAF ÖMRÜ DE KOPYALANIYOR (0094). Ekran yazamaz.
  new.opened_shelf_life_days := v_acik;

  -- ⚠️ TEKİLLİK ANAHTARI SUNUCUDA (0094 · 4. madde). İstemcinin gönderdiği
  -- anahtar yok sayılıyor; yoksa aynı kod iki kez yazılabilirdi.
  new.sample_code_key := app.kimlik_anahtari(new.sample_code);

  -- ⚠️ İmza sunucuda (0081/0087 deseni).
  new.taken_by := app.aktif_kullanici_id();
  new.status   := 'SAKLANIYOR';

  return new;
end $$;

revoke all on function app.numune_turet() from public;
revoke all on function app.numune_turet() from anon;
revoke all on function app.numune_turet() from authenticated;


-- ── 4 · OLAY · KİRACI DOĞRULANIYOR, SATIR KİLİTLENİYOR, SÜRE KISALIYOR ──
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
  -- ⚠️ MIYOP-075'in ta kendisi: kiracı SUNUCUDAN okunuyor ve numune
  -- ARAMASINA kiracı da giriyor. Eskiden arama yalnız id ileydi.
  v_kiraci := app.current_tenant_id();
  if v_kiraci is null then
    raise exception 'MİYOP: oturumda işletme kimliği yok; numune kaydı yazılamaz.'
      using errcode = 'MI403';
  end if;
  new.tenant_id     := v_kiraci;
  new.actor_user_id := app.aktif_kullanici_id();
  v_an              := coalesce(new.occurred_at, now());

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
-- ⚠️ "Fonksiyonu yeniden yazdım" demek yetmez; göç YENİ halin yürürlükte
-- olduğunu kendi kendine ölçüyor. Eski gövde kalsa göç sessizce geçerdi.
do $$
declare v_turet text; v_olay text;
begin
  if not exists (select 1 from information_schema.columns
                  where table_name = 'stock_item'
                    and column_name = 'opened_shelf_life_days') then
    raise exception '0094: stock_item.opened_shelf_life_days oluşmadı.';
  end if;

  select pg_get_functiondef(p.oid) into v_turet
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'numune_turet';
  select pg_get_functiondef(p.oid) into v_olay
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'numune_olayi';

  if v_turet is null or v_olay is null then
    raise exception '0094: numune tetik fonksiyonları bulunamadı.';
  end if;

  -- Kiracı sınırı: ikisi de kiracıyı sunucudan okumalı.
  if v_turet !~ 'app\.current_tenant_id\(\)' then
    raise exception '0094: numune_turet kiracıyı sunucudan okumuyor.';
  end if;
  if v_olay !~ 'app\.current_tenant_id\(\)' then
    raise exception '0094: numune_olayi kiracıyı sunucudan okumuyor.';
  end if;
  -- Satır kilidi (MIYOP-077).
  if v_olay !~* 'for\s+update' then
    raise exception '0094: numune_olayi durum okumasında satır kilidi yok.';
  end if;
  -- Açık raf ömrü (MIYOP-076) gerçekten okunuyor mu?
  if v_olay !~ 'opened_shelf_life_days' or v_turet !~ 'opened_shelf_life_days' then
    raise exception '0094: açık raf ömrü hâlâ kullanılmıyor.';
  end if;
  if v_turet !~ 'app\.kimlik_anahtari' then
    raise exception '0094: numune kodu anahtarı sunucuda türetilmiyor.';
  end if;
  if app.kimlik_anahtari(' n-1 ') <> 'N-1'
     or app.kimlik_anahtari('ıI') <> 'II'
     or app.kimlik_anahtari('İi') <> 'II' then
    raise exception '0094: kimlik anahtarı kuralı uygulamayla aynı değil.';
  end if;
  if v_olay !~ 'least' then
    raise exception '0094: saklama sonu least() ile kısaltılmıyor; uzayabilir.';
  end if;

  -- 0093'ün tetikleri hâlâ bağlı mı? (Fonksiyonu değiştirmek tetiği
  -- düşürmez; yine de ölçüyoruz, çünkü varsayım değil ölçüm istiyoruz.)
  if not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                  where c.relname = 'witness_sample' and g.tgname = 'numune_turet'
                    and not g.tgisinternal) then
    raise exception '0094: numune_turet tetiği bağlı değil.';
  end if;
  if not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                  where c.relname = 'witness_sample_event' and g.tgname = 'numune_olayi'
                    and not g.tgisinternal) then
    raise exception '0094: numune_olayi tetiği bağlı değil.';
  end if;

  raise notice '0094: Numune kiracı sınırı, satır kilidi ve açık raf ömrü yürürlükte.';
end $$;
