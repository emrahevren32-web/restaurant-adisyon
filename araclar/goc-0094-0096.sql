-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 26.10.2026 · ÜÇ GÖÇ BİR ARADA · 0094 + 0095 + 0096
--
-- Hepsi tekrar çalıştırılabilir (idempotent). Sırayla çalışır, tek seferde
-- yapıştırılabilir. Her birinin sonunda kendi doğrulaması var: bir şey
-- yürürlüğe girmediyse o blok hata verir ve sebebini yazar.
--
--   0094 · şahit numune: kiracı sınırı (P0), satır kilidi, açık raf ömrü,
--          numune kodu anahtarının sunucuda türetilmesi
--   0095 · kullanılabilir bakiye görünümü + Analiz kritik kalem sayısı
--   0096 · saklama koşulu ve açık raf ömrü BEYAN alanı sayılıyor
-- ═══════════════════════════════════════════════════════════════════════════

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

  select pg_get_functiondef(p.oid) into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'isletme_gostergeleri';
  if v_govde is null then
    raise exception '0095: app.isletme_gostergeleri bulunamadı.';
  end if;
  if v_govde !~ 'stock_usable_balance' then
    raise exception '0095: göstergeler hâlâ fiziksel bakiyeden kritik kalem sayıyor.';
  end if;
  if v_govde !~ 'usable_qty, 0\) <= i\.min_qty' then
    raise exception '0095: kritik eşiği <= değil; Depo ekranından ayrı davranır.';
  end if;

  raise notice '0095: Kullanılabilir bakiye görünümü kuruldu; Analiz onu okuyor.';
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0096 — SAKLAMA KOŞULU BİR BEYANDIR, KALİTE DE YAZABİLİR
--
-- ── NEDEN VAR ────────────────────────────────────────────────────────────
-- 0093 saklama koşulunu ürün kartına taşıdı (`stock_item.storage_condition`),
-- 0094 açık raf ömrünü ekledi (`opened_shelf_life_days`). İkisi de şahit
-- numunenin ZORUNLU girdisi: koşulu yazılmayan üründen numune alınamıyor.
--
-- Ama kartın yazma kapısı (`app.stok_karti_izni`, 0085/0072) bu iki alanı
-- "sıradan kart alanı" sayıyor ve `stock.write` istiyor. `stock.write` şu
-- rollerde var: depo sorumlusu, üretim sorumlusu, işletme müdürü, işletme
-- sahibi. ŞU ROLLERDE YOK: **kalite sorumlusu ve gıda mühendisi.**
--
-- Yani ortaya şu çıkıyordu: şahit numunenin kuralını kalite departmanı
-- uyguluyor, o kuralın girdisini kalite departmanı YAZAMIYOR. Numune
-- alınamadığında gidip depocuya "şu koşulu yazar mısın" demesi gerekiyordu.
--
-- ── NEDEN `quality.declaration` DOĞRU İZİN ───────────────────────────────
-- Saklama koşulu bir stok özelliği değil, MÜŞTERİYE YAPILAN BİR BEYANDIR.
-- Emrah'ın kuralı: *"Müşteriye saklaması gereken koşullar söylenir ve
-- satılan ürün aynı şartlarda bizde de saklanır."* Etikete basılan, müşteriye
-- söylenen ve numunenin uymak zorunda olduğu şey aynı cümle.
--
-- Alerjen beyanı 0072/0073'te tam bu sebeple `quality.declaration` iznine
-- bağlanmıştı ve kapı o alanlar için zaten "yalnız beyan alanları
-- değiştiyse yeter" diyor. Bu göç o listeye iki alan daha ekliyor.
--
-- ⚠️ `stock.write` KALDIRILMIYOR. Depocu ve üretim de yazmaya devam ediyor;
-- tek değişiklik kalite tarafının ARTIK YAZABİLMESİ. Birine izin vermek için
-- diğerinden almak, çalışan bir akışı bozmak olurdu.
--
-- ⚠️ Listeye alan eklemek, `quality.declaration` taşıyan birinin o alanları
-- değiştirebilmesi demek — kartın GERİ KALANINI değil. Kapı
-- `(to_jsonb(new) - v_beyan) = (to_jsonb(old) - v_beyan)` ile ölçüyor:
-- başka tek bir alan bile değiştiyse `stock.write` şartı geri geliyor.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.stok_karti_izni()
returns trigger
language plpgsql set search_path = public, app
as $$
declare
  -- ⚠️ YALNIZ BU ALANLAR DEĞİŞTİYSE `quality.declaration` yeter.
  -- `updated_at` listede olmak ZORUNDA: `app.touch_updated_at()` her
  -- güncellemede onu değiştiriyor, listede olmasaydı beyan yolu hiçbir
  -- zaman çalışmazdı.
  v_beyan constant text[] := array[
    'net_qty', 'net_uom',
    'allergen_reviewed_at', 'allergen_reviewed_by',
    -- ── 0096 · ŞAHİT NUMUNENİN GİRDİLERİ ──────────────────────────────
    -- Saklama koşulu müşteriye yapılan beyandır (0093); açık raf ömrü de
    -- aynı beyanın parçası (0094). Kalite sorumlusu ve gıda mühendisi
    -- bunları yazamazsa numune kuralını uygulayamazlar.
    'storage_condition', 'opened_shelf_life_days',
    'updated_at'
  ];
begin
  if app.bakim_baglami() then
    return coalesce(new, old);
  end if;

  -- ⚠️ MIYOP-035: YENİ KART İNCELENMİŞ DOĞAMAZ.
  -- 0072'nin damga koruması yalnız UPDATE'te çalışıyordu. Damga, beyan
  -- işleminin SONUCUDUR; kartın doğuştan gelen bir özelliği değil.
  if tg_op = 'INSERT'
     and (new.allergen_reviewed_at is not null
          or new.allergen_reviewed_by is not null)
  then
    raise exception
      'Yeni stok karti "alerjeni incelendi" damgasiyla olusturulamaz. '
      'Damga, beyan islemi yapildiginda sunucu tarafindan atilir.'
      using errcode = 'MI436';
  end if;

  if app.yetkim_var('stock.write') then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE'
     and app.yetkim_var('quality.declaration')
     and (to_jsonb(new) - v_beyan) = (to_jsonb(old) - v_beyan)
  then
    return new;
  end if;

  raise exception
    'Stok karti icin `stock.write` gerekiyor. Yalniz beyan alanlarini '
    '(net miktar, alerjen damgasi, saklama kosulu, acik raf omru) '
    'degistiriyorsaniz `quality.declaration` de yeter; hesabinizda ikisi de yok.'
    using errcode = 'MI403';
end $$;


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
declare v_govde text;
begin
  select pg_get_functiondef(p.oid) into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'stok_karti_izni';
  if v_govde is null then
    raise exception '0096: app.stok_karti_izni bulunamadı.';
  end if;

  -- Yeni iki alan beyan listesinde mi?
  if v_govde !~ 'storage_condition' or v_govde !~ 'opened_shelf_life_days' then
    raise exception '0096: saklama koşulu ve açık raf ömrü beyan listesine girmedi.';
  end if;

  -- ⚠️ ESKİ ALANLAR KAYBOLMADI MI? Fonksiyon gövdesi komple değiştiği için
  -- bir alanı düşürmek sessizce alerjen beyanını kırardı.
  if v_govde !~ 'net_qty' or v_govde !~ 'net_uom'
     or v_govde !~ 'allergen_reviewed_at' or v_govde !~ 'allergen_reviewed_by'
     or v_govde !~ 'updated_at' then
    raise exception '0096: eski beyan alanlarından biri listeden düştü.';
  end if;

  -- ⚠️ `stock.write` yolu duruyor mu? Kaldırmak depocuyu kilitlerdi.
  if v_govde !~ 'yetkim_var\(''stock\.write''\)' then
    raise exception '0096: stock.write yolu kaybolmuş.';
  end if;

  -- ⚠️ MIYOP-035 koruması duruyor mu?
  if v_govde !~ 'MI436' then
    raise exception '0096: yeni kartın damgayla doğma koruması kaybolmuş.';
  end if;

  -- Tetik hâlâ bağlı mı?
  if not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                  where c.relname = 'stock_item' and g.tgname = 'izin_stock_item'
                    and not g.tgisinternal) then
    raise exception '0096: izin_stock_item tetiği bağlı değil.';
  end if;

  raise notice '0096: Saklama koşulu ve açık raf ömrü beyan alanı sayılıyor.';
end $$;
