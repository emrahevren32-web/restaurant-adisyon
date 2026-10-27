-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · GÖÇ PAKETİ · 0094 → 0100 (YEDİSİ BİRDEN)
--
-- ⚠️ 0094–0098 CANLIDA UYGULANDI AMA METİN BOZUK GİTTİ (MIYOP-079).
-- Sebep bulundu: kaydet.ps1 panoya kopyalarken dosyayı ANSI sanıp okuyordu
-- (PowerShell 5.1, BOM'suz UTF-8). Türkçe harfler bozuldu; en önemlisi
-- app.kimlik_anahtari() GERÇEK 'İ' ve 'ı' yerine bozulmuş iki karakteri
-- aramaya başladı — yani numune kodu tekilliği zayıfladı. Hata mesajları da
-- okunamaz hâle geldi.
--
-- Betik düzeltildi. Bu paket yedi göçü de YENİDEN uygular; hepsi tekrar
-- çalıştırılabilir (idempotent), tek seferde yapıştırılır.
--
--   0094 · şahit numune: kiracı sınırı (P0), kilit, açık raf ömrü,
--          kimlik anahtarı  ← BOZUK GİDEN FONKSİYON BURADA
--   0095 · kullanılabilir bakiye görünümü (düzeltilmiş: _ham'a yazıyor)
--   0096 · saklama koşulu ve açık raf ömrü BEYAN alanı
--   0097 · şahit numune imhası bir ONAY işidir
--   0098 · gevşek kapı ardındaki security definer yüzeyi
--   0099 · MIYOP-078 (P0) · finans izin kapısı geri + kimlik anahtarı ölçümü
--   0100 · MIYOP-081 · açılış SONUCU sunucuda zorunlu
--
-- ⚠️ Beklenen: hiç ERROR olmamalı. Sonunda 'Success' görmelisin.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0094 — ŞAHİT NUMUNE: KİRACI SINIRI, SATIR KİLİDİ, AÇIK RAF ÖMRÜ
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


-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0097 — ŞAHİT NUMUNE İMHASI BİR ONAY İŞİDİR
--
-- ── EMRAH'IN KARARI (26.10.2026) ─────────────────────────────────────────
--   *"Müdür onaylar ama müdür yoksa gıda mühendisi veya kalitecide
--    onaylayabilir."*
--
-- 0093 numune defterini kurarken üç olayın (ALINDI, ACILDI, IMHA) hepsini
-- aynı kapıya bağlamıştı: `quality.record.manage` **veya**
-- `production.write`. Yani **üretim sorumlusu numuneyi imha edebiliyordu.**
-- Emrah'ın kararı bunu daraltıyor.
--
-- ── NEDEN DARALTMAK DOĞRU ────────────────────────────────────────────────
-- Numune almak ve açmak bir İŞTİR; imha etmek bir KARARDIR. Şahit numune
-- bir tartışmada işletmenin tek kanıtı; onu ortadan kaldırmak kanıtı
-- ortadan kaldırmak demek. Alan kişinin kendi aldığı numuneyi kendi başına
-- yok edebilmesi, defteri anlamsız kılar.
--
-- Bu, HACCP'te 0081'de verilen kararın aynısı: ölçümü GİRMEK geniş
-- (`quality.write`), ölçümü İPTAL ETMEK dar (`quality.record.manage`).
-- Aynı ayrım burada da geçerli.
--
-- ── KİM ONAYLAYABİLİYOR ──────────────────────────────────────────────────
-- `quality.record.manage` izni şu rollerde var (ölçüldü, tahmin değil —
-- `role_permission` tablosundan):
--   · isletme_muduru    ← Emrah'ın birinci tercihi
--   · gida_muhendisi    ← "müdür yoksa"
--   · kalite_sorumlusu  ← "müdür yoksa"
--   · isletme_sahibi    ← müdürün üstü
-- ⚠️ `uretim_sorumlusu` ve `depo_sorumlusu`da YOK — kararın istediği tam bu.
--
-- ⚠️ **"MÜDÜR YOKSA" KOŞULU SİSTEME YAZILMADI ve bu bilinçli.** Sistem
-- müdürün o gün işte olup olmadığını bilemez; bilmediği bir şeyi kural
-- gibi yazmak "mış gibi" yapmak olurdu. Üçü de onaylayabiliyor; sıralama
-- bir İŞLETME kuralı ve ekranda yazılı. Denetimde "kim onayladı" sorusunun
-- cevabı zaten kayıtta: imzayı sunucu atıyor (0093).
--
-- ⚠️ AYRI BİR "ONAYLAYAN" KOLONU AÇILMADI. İmha kaydını ancak onaylayabilen
-- biri yazabildiği için `actor_user_id` ZATEN onaylayandır. İkinci bir
-- kolon, doldurulmayan ya da ilkiyle çelişen bir alan olurdu.
--
-- ── NE DEĞİŞMİYOR ────────────────────────────────────────────────────────
-- ALINDI ve ACILDI olayları eski kapıda: `quality.record.manage` VEYA
-- `production.write`. Üretim numuneyi almaya ve müşteri önünde açmaya
-- devam ediyor (İsmet: *"üretim her ürettiği partiden numune alıyor"*).
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · OLAY TİPİNE GÖRE KAPI ────────────────────────────────────────────
-- ⚠️ `app.izin_gerek_coklu()` tek bir izin listesi alıyor; olay tipine göre
-- ayrışamıyor. Bu yüzden numuneye kendi kapısı yazılıyor. Genel tetiği
-- "ya da şu kolon şu değerse" diye karmaşıklaştırmak, 30 tabloda kullanılan
-- bir fonksiyona tek tablonun kuralını sokmak olurdu.
create or replace function app.numune_olayi_izni()
returns trigger
language plpgsql set search_path = public, app
as $$
begin
  -- Göç, yedek geri yükleme ve `security definer` rutinlerimiz serbest
  -- (0089 deseni).
  if app.kapi_disi_baglam() then
    return new;
  end if;

  -- ── İMHA · DAR KAPI ────────────────────────────────────────────────────
  if new.event_type = 'IMHA' then
    if app.yetkim_var('quality.record.manage') then
      return new;
    end if;
    raise exception
      'MİYOP: şahit numune imhası bir ONAY işidir. İşletme müdürü onaylar; '
      'müdür yoksa gıda mühendisi ya da kalite sorumlusu onaylayabilir. '
      'Numuneyi siz alabilir ve açabilirsiniz, ama imhayı onlar yazar.'
      using errcode = 'MI403';
  end if;

  -- ── ALINDI ve ACILDI · ORTAK İŞ (0093) ────────────────────────────────
  if app.yetkim_var('quality.record.manage')
     or app.yetkim_var('production.write') then
    return new;
  end if;

  raise exception
    'MİYOP: şahit numune kaydı için su izinlerden biri gerekiyor: '
    'quality.record.manage, production.write. Hesabinizda yok.'
    using errcode = 'MI403';
end $$;

revoke all on function app.numune_olayi_izni() from public;
revoke all on function app.numune_olayi_izni() from anon;
revoke all on function app.numune_olayi_izni() from authenticated;

-- ⚠️ ESKİ TETİK DÜŞÜRÜLÜYOR. Bırakılırsa iki kapı birlikte çalışır ve
-- gevşek olan (0093'ün ikili izni) imhayı yine geçirir — iki kapıdan
-- geçmesi gereken bir istek, en gevşek kapının izniyle geçer.
drop trigger if exists izin_witness_sample_event on public.witness_sample_event;
drop trigger if exists izin_numune_olayi on public.witness_sample_event;
create trigger izin_numune_olayi
  before insert on public.witness_sample_event
  for each row execute function app.numune_olayi_izni();


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
declare v_govde text; v_sayi int;
begin
  select pg_get_functiondef(p.oid) into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'numune_olayi_izni';
  if v_govde is null then
    raise exception '0097: app.numune_olayi_izni oluşmadı.';
  end if;
  if v_govde !~ 'new\.event_type = ''IMHA''' then
    raise exception '0097: kapı olay tipine göre ayrışmıyor.';
  end if;

  -- ⚠️ YENİ TETİK BAĞLI MI?
  if not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                  where c.relname = 'witness_sample_event'
                    and g.tgname = 'izin_numune_olayi' and not g.tgisinternal) then
    raise exception '0097: izin_numune_olayi tetiği bağlı değil.';
  end if;

  -- ⚠️ ESKİ GEVŞEK TETİK GİTTİ Mİ? Kalırsa imha yine geçerdi.
  if exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
              where c.relname = 'witness_sample_event'
                and g.tgname = 'izin_witness_sample_event' and not g.tgisinternal) then
    raise exception '0097: eski gevşek izin tetiği hâlâ bağlı.';
  end if;

  -- ⚠️ NUMUNE TABLOSUNUN kapısı DEĞİŞMEDİ mi? Numune almak hâlâ ortak iş.
  if not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                  where c.relname = 'witness_sample'
                    and g.tgname = 'izin_witness_sample' and not g.tgisinternal) then
    raise exception '0097: numune tablosunun izin tetiği kaybolmuş.';
  end if;

  -- ⚠️ ONAYLAYABİLECEK ROL VAR MI? İzni hiçbir rolde olmayan bir kapı,
  -- imhayı tamamen kilitlerdi — kural değil kilit olurdu (tuzak 121).
  select count(*) into v_sayi from public.role_permission
   where permission_code = 'quality.record.manage';
  if v_sayi = 0 then
    raise exception
      '0097: quality.record.manage hiçbir rolde yok; imha tamamen kilitlendi.';
  end if;

  -- ⚠️ Emrah'ın saydığı üç rolün üçü de onaylayabiliyor mu?
  select count(*) into v_sayi from public.role_permission
   where permission_code = 'quality.record.manage'
     and role_code in ('isletme_muduru', 'gida_muhendisi', 'kalite_sorumlusu');
  if v_sayi <> 3 then
    raise exception
      '0097: müdür/gıda mühendisi/kalite sorumlusundan %si onaylayamıyor '
      '(quality.record.manage eksik).', 3 - v_sayi;
  end if;

  -- ⚠️ Üretim sorumlusu onaylayamıyor olmalı — kararın asıl amacı bu.
  if exists (select 1 from public.role_permission
              where permission_code = 'quality.record.manage'
                and role_code = 'uretim_sorumlusu') then
    raise exception
      '0097: üretim sorumlusu imhayı onaylayabiliyor; karar bunu dışlıyordu.';
  end if;

  raise notice '0097: Numune imhası onay izni (quality.record.manage) istiyor.';
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0098 — GEVŞEK KAPININ ARDINDAKİ YÜZEY YENİDEN DONDURULDU
--
-- ── NASIL BULUNDU ────────────────────────────────────────────────────────
-- 0097'yi yazdıktan sonra kapı yüzeyini ölçen eski göçleri (0085, 0089,
-- 0090, 0091) GÜNCEL veritabanında yeniden çalıştırdım. 0090 kırmızı verdi:
--
--   "0090: gevsek kapinin ardinda LISTEDE OLMAYAN rutin(ler):
--    app.numune_olayi"
--
-- ── NE DEMEK ─────────────────────────────────────────────────────────────
-- 0090 şu soruyu donduruyor: **gevşek kapıya (`app.izin_gerek_coklu()`)
-- bağlı bir tabloya yazan, `security definer` kaç rutin var?** `security
-- definer` bir rutin RLS'i ve tablo kapılarını atlar; o yüzden listesi
-- gerekçeyle tutulur ve sessizce büyümesi yasaktır.
--
-- 0093 (şahit numune) `witness_sample` tablosunu gevşek kapıya bağladı ve
-- `app.numune_olayi()` adlı `security definer` bir tetik o tabloya
-- **UPDATE** yazıyor. Yani yüzey bir arttı — **ama 0090 zincirde 0093'ten
-- ÖNCE çalıştığı için bunu hiç görmedi.**
--
-- ⚠️ DERS: bir ölçümü ZİNCİRİN BİR NOKTASINDA çalıştırmak, o noktadan
-- sonra eklenen her şeyi ölçmez. Dondurduğum yüzey, dondurduktan sonra
-- büyüdü ve kimse fark etmedi. Bu göç ölçümü ŞİMDİKİ hâliyle tekrarlıyor.
--
-- ⚠️ Bu kusur Codex'in bulduğu MIYOP-075'in ta kendisinin yaşadığı yerdir:
-- `app.numune_olayi()` RLS'i atlıyordu ve kiracıyı doğrulamıyordu. 0094
-- onu onardı; bu göç o rutini **adıyla listeye alıyor** ki bir dahaki
-- denetimde gözden kaçmasın.
--
-- ── NEDEN RUTİNE AYRI BİR İZİN KONTROLÜ EKLENMEDİ ────────────────────────
-- `app.numune_olayi()` bir TETİKTİR; yalnız `witness_sample_event`e yapılan
-- bir INSERT'in sonucu olarak çalışır ve o INSERT zaten
-- `app.numune_olayi_izni()` kapısından geçmiştir (0097). Doğrudan
-- çağrılamaz: `authenticated`tan EXECUTE yetkisi geri alınmış.
--
-- Aynı izin kuralını rutinin içine ikinci kez yazmak, kuralı iki yere
-- kopyalamak olurdu — biri bir gün güncellenmez ve hangisinin doğru olduğu
-- bilinmez. ⚠️ Ama bu bir CÜMLE olarak bırakılmıyor: aşağıdaki doğrulama
-- üç şartı da ÖLÇÜYOR (kapı bağlı mı, rutin çağrılamıyor mu, kiracıyı
-- doğruluyor mu). Cümle yanlış olursa göç patlar.
--
-- Tekrar çalıştırılabilir (idempotent). Hiçbir şeyi DEĞİŞTİRMEZ; yalnız
-- ölçer ve dondurur.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  -- 0090'ın listesi + ŞAHİT NUMUNE RUTİNİ. Liste yalnız GEREKÇEYLE büyür.
  v_beklenen constant text[] := array[
    -- MIYOP-039'un onarımı · kendi üyelik/nokta/fiyat kontrolünü yapar
    'public.portal_siparis_ver',
    'public.portal_siparis_guncelle',
    -- MIYOP-038'in onarımı · kullanıcının izinli sevk işleminin sonucu
    'app.sevkiyat_siparisi_ilerlet',
    -- revizyon zincirinin kendi tetikleri · aynı gerekçe
    'app.revizyon_guncel_numara',
    'app.revizyon_onayi_dusurur',
    -- yeni kiracı kurulumu · yalnız service_role, HACCP planı/KKN yazar
    'app.kiraci_haccp_plani_kur',
    -- ── 0098 · YENİ ───────────────────────────────────────────────────────
    -- Şahit numune olay tetiği: `witness_sample.status` ve `keep_until`
    -- alanlarını yazar. Yalnız `witness_sample_event` INSERT'inin sonucu
    -- olarak çalışır; o INSERT `app.numune_olayi_izni()` kapısından geçer
    -- (0097). Kiracıyı kendisi doğrular ve satırı kilitler (0094 ·
    -- MIYOP-075/077). `authenticated` doğrudan çağıramaz.
    'app.numune_olayi'
  ];
  v_bulunan text[];
  v_fazla   text[];
  v_eksik   text[];
begin
  -- ⚠️ ÖLÇÜM 0090'IN AYNISI, bilerek birebir. Farklı yazmak "iki ayrı
  -- soru soran iki ölçüm" olurdu ve hangisinin doğru olduğu bilinmezdi.
  select coalesce(array_agg(x order by x), '{}') into v_bulunan from (
    select distinct n.nspname || '.' || p.proname as x
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join (
        -- YALNIZ gevşek kapıya bağlı tablolar
        select distinct c.relname
          from pg_trigger t join pg_class c on c.oid = t.tgrelid
         where not t.tgisinternal
           and t.tgfoid = to_regprocedure('app.izin_gerek_coklu()')
      ) k on p.prosrc ~* ('(insert into|update|delete from)[[:space:]]+(public\.)?'
                          || k.relname || '[[:space:](]')
     where p.prosecdef
       and n.nspname in ('app', 'public')
  ) s;

  select coalesce(array_agg(x), '{}') into v_fazla
    from unnest(v_bulunan) x where x <> all (v_beklenen);
  select coalesce(array_agg(x), '{}') into v_eksik
    from unnest(v_beklenen) x where x <> all (v_bulunan);

  if array_length(v_fazla, 1) is not null then
    raise exception
      '0098: gevsek kapinin ardinda LISTEDE OLMAYAN rutin(ler): %. Her biri '
      'kendi yetki kontrolunu yapmali ve bu listeye GEREKCESIYLE eklenmeli.',
      array_to_string(v_fazla, ', ');
  end if;
  if array_length(v_eksik, 1) is not null then
    raise notice '0098: listede olup bulunmayanlar: % (kaldirilmis olabilir)',
      array_to_string(v_eksik, ', ');
  end if;

  raise notice '0098: gevsek kapinin ardindaki yuzey % rutin (0090''da 6 idi).',
    coalesce(array_length(v_bulunan, 1), 0);
end $$;


-- ── GEREKÇENİN KENDİSİ ÖLÇÜLÜYOR ─────────────────────────────────────────
-- ⚠️ Yukarıdaki gerekçe üç iddia içeriyor. Üçü de burada sınanıyor; biri
-- yanlışsa göç patlar. Gerekçeyi yorumda bırakmak, kimsenin okumadığı bir
-- güvenlik iddiası bırakmak olurdu (tuzak 76).
do $$
begin
  -- 1 · Olay defterinin kapısı BAĞLI mı? Kapı yoksa rutin korumasız kalır.
  if not exists (
    select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
     where c.relname = 'witness_sample_event'
       and g.tgname = 'izin_numune_olayi'
       and not g.tgisinternal
  ) then
    raise exception
      '0098: witness_sample_event izin kapisi yok; app.numune_olayi korumasiz.';
  end if;

  -- 2 · Rutin DOĞRUDAN çağrılabiliyor mu? Çağrılabilirse kapı atlanır.
  if has_function_privilege('authenticated', 'app.numune_olayi()', 'execute') then
    raise exception
      '0098: authenticated app.numune_olayi() fonksiyonunu dogrudan cagirabiliyor.';
  end if;
  if has_function_privilege('anon', 'app.numune_olayi()', 'execute') then
    raise exception '0098: anon app.numune_olayi() fonksiyonunu cagirabiliyor.';
  end if;

  -- 3 · Rutin kiracıyı DOĞRULUYOR ve satırı KİLİTLİYOR mu? (0094)
  declare v_govde text;
  begin
    select pg_get_functiondef(p.oid) into v_govde
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app' and p.proname = 'numune_olayi';
    if v_govde !~ 'app\.current_tenant_id\(\)' or v_govde !~ 's\.tenant_id = v_kiraci' then
      raise exception
        '0098: app.numune_olayi kiraciyi dogrulamiyor (MIYOP-075 geri gelmis).';
    end if;
    if v_govde !~* 'for update' then
      raise exception
        '0098: app.numune_olayi satir kilidi almiyor (MIYOP-077 geri gelmis).';
    end if;
  end;

  raise notice '0098: Gerekce olculdu: kapi bagli, rutin cagrilamiyor, kiraci dogrulaniyor.';
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0099 — 0095 FİNANS KAPISINI YOK ETMİŞ, GERİ KONUYOR
--
-- ── NE OLDU · P0, BENİM HATAM (MIYOP-078 · Codex, 27.10) ─────────────────
-- 0065 `app.isletme_gostergeleri` fonksiyonunu yazdı. **0071 onu İKİYE
-- AYIRDI:**
--   · `app.isletme_gostergeleri_ham` → ham hesap (iç fonksiyon)
--   · `app.isletme_gostergeleri`     → `finance.read` İZİN KAPISI, _ham'ı sarar
--
-- 0095'i yazarken gövdeyi **0065'ten** kopyaladım ve `isletme_gostergeleri`
-- adına yazdım. Yani 0071'in izin kapısını ham hesapla EZDİM.
--
-- ⚠️ SONUÇ: `finance.read` izni OLMAYAN bir kullanıcı — depo sorumlusu,
-- üretim sorumlusu, kalite sorumlusu, gıda mühendisi — kendi kiracısının
-- fire tutarını, alış maliyetini ve stok maliyeti göstergelerini doğrudan
-- RPC'den okuyabiliyordu. Ekran kapısı duruyordu ama kapı ekranda değil
-- veritabanında olmalıydı ve orada artık yoktu.
--
-- ⚠️ **KENDİ DOĞRULAMAM BU HATAYI GİZLEDİ.** 0095 şunu ölçüyordu:
-- *"`isletme_gostergeleri` gövdesinde `stock_usable_balance` geçiyor mu?"*
-- Ham gövdeyi oraya yazdığım için ÖLÇÜM GEÇTİ. Doğru yere (`_ham`) yazsaydım
-- kendi doğrulamam KIRMIZI verecekti. Yani doğrulama, yanlış fonksiyonu
-- ölçüyordu (tuzak 127).
--
-- ⚠️ Provam da yakalayamadı: `prova-0095.sql` göstergeleri `isletme_sahibi`
-- oturumunda çağırıyordu ve onda `finance.read` VAR. Kapının kalkması o
-- oturumda hiçbir fark yaratmıyordu — **olumsuz kontrol yoktu.**
--
-- ── BU GÖÇ NE YAPIYOR ────────────────────────────────────────────────────
-- 1. Düzeltilmiş kritik stok hesabını DOĞRU YERE, `_ham` fonksiyonuna yazar.
-- 2. `app.isletme_gostergeleri` fonksiyonunu 0071'deki hâline — izin
--    kapısına — geri döndürür.
-- 3. Kapının gerçekten orada olduğunu, `security definer` OLMADIĞINI ve
--    ham hesabın doğru fonksiyonda olduğunu ölçer.
--
-- ⚠️ `fire_dokumu` kapısına DOKUNULMADI: 0095 onu hiç yazmamıştı.
-- ⚠️ 27.10 · ÖNCE BU GÖÇ onun durumunu da SINIYORDU ve canlıda patladı —
-- böylece P0 onarımını rehin aldı (Supabase tek işlem). Kontrol kaldırıldı;
-- `fire_dokumu` ayrı bir soru ve `araclar/teshis-fire-dokumu.sql` ile
-- ölçülüyor. Bir onarım göçü, onarımla ilgisi olmayan bir kontrol yüzünden
-- durmamalı (tuzak 129).
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · DÜZELTİLMİŞ HESAP DOĞRU YERE ─────────────────────────────────────
-- ⚠️ Gövde 0095'in aynısı; tek fark ADI. Kritik kalem bloğu
-- `stock_usable_balance` okuyor ve eşiği `<=` ile karşılaştırıyor
-- (MIYOP-074 · bkz. 0095 başlığı).
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

-- ── 2 · İZİN KAPISI GERİ ─────────────────────────────────────────────────
-- ⚠️ 0071'in metninin AYNISI, bilerek. Yeniden yazmak, kapının ifadesini
-- ikinci kez türetmek olurdu.
--
-- ⚠️ Kapı `security definer` OLMAMALI: definer olsaydı izin kontrolünü
-- geçen bir çağrı RLS'i de aşar ve BÜTÜN kiracıları okurdu. 0071 bunu
-- yazmıştı, doğrulama aşağıda tekrarlıyor.
create or replace function app.isletme_gostergeleri(
  p_sube uuid, p_bas date, p_bit date
)
returns table (anahtar text, deger numeric, ek numeric)
language plpgsql
stable
set search_path = public, app, pg_temp
as $$
begin
  -- ⚠️ HATA MESAJI NE OLDUĞUNU SÖYLÜYOR. "Yetkiniz yok" diyen ama hangi
  -- yetki olduğunu söylemeyen bir mesaj, kullanıcıyı da yöneticiyi de
  -- çaresiz bırakır.
  if not app.yetkim_var('finance.read') then
    raise exception 'Bu rapor maliyet bilgisi içeriyor; `finance.read` izni '
      'gerekiyor. İşletme sahibi, müdür, muhasebe ve satın alma görebilir.'
      using errcode = 'MI403';
  end if;

  return query select * from app.isletme_gostergeleri_ham(p_sube, p_bas, p_bit);
end;
$$;


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
declare v_kapi text; v_ham text; v_fire text;
begin
  select pg_get_functiondef(p.oid) into v_kapi
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'isletme_gostergeleri';
  select pg_get_functiondef(p.oid) into v_ham
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'isletme_gostergeleri_ham';
  select pg_get_functiondef(p.oid) into v_fire
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'fire_dokumu';

  if v_kapi is null or v_ham is null or v_fire is null then
    raise exception '0099: gösterge fonksiyonlarından biri yok.';
  end if;

  -- ⚠️ ASIL ÖLÇÜM: kapı GERİ GELDİ Mİ?
  if v_kapi !~ 'finance\.read' then
    raise exception
      '0099: app.isletme_gostergeleri finans izni sormuyor (MIYOP-078 açık).';
  end if;
  if v_kapi !~ 'isletme_gostergeleri_ham' then
    raise exception '0099: kapı ham hesabı çağırmıyor.';
  end if;
  -- ⚠️ Kapının içinde HAM HESAP OLMAMALI. Bu, 078'in geri gelmesinin tam
  -- imzası: hesap kapının içine yazılmışsa kapı yeniden ezilmiş demektir.
  if v_kapi ~ 'stock_usable_balance' or v_kapi ~ 'stock_movement' then
    raise exception
      '0099: ham hesap yine İZİN KAPISININ içine yazılmış (MIYOP-078 tekrarı).';
  end if;

  -- ⚠️ `security definer` olmamalı — yoksa RLS de aşılır.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'app'
                and p.proname in ('isletme_gostergeleri','fire_dokumu')
                and p.prosecdef) then
    raise exception '0099: gösterge kapısı security definer; RLS aşılabilir.';
  end if;

  -- ⚠️ DÜZELTME DOĞRU YERDE Mİ? (MIYOP-074)
  if v_ham !~ 'stock_usable_balance' then
    raise exception '0099: kullanılabilir bakiye düzeltmesi _ham''a yazılmamış.';
  end if;
  if v_ham !~ 'usable_qty, 0\) <= i\.min_qty' then
    raise exception '0099: kritik eşiği _ham''da <= değil.';
  end if;

  -- ⚠️ 27.10 · BURADA `fire_dokumu` KAPISI DA SINANIYOR VE `raise exception`
  -- İLE PATLIYORDU. Canlıda patladı ve **P0 ONARIMINI REHİN ALDI**: Supabase
  -- bütün betiği tek işlemde çalıştırdığı için, bu ikincil kontrol
  -- başarısız olunca yukarıdaki kapı onarımı da GERİ ALINDI. Yani fazladan
  -- koyduğum bir kontrol yüzünden açık kapalı kalmadı (tuzak 129).
  --
  -- Kontrol kaldırıldı. `fire_dokumu` AYRI bir sorudur ve ayrı ölçülür:
  -- `araclar/teshis-fire-dokumu.sql` bir TABLO döndürüyor (Supabase NOTICE
  -- göstermiyor, sonuç tablosu gösteriyor). Onarım göçünün işi onarmaktır;
  -- başka bir derdi teşhis etmek değil.
  --
  -- ⚠️ `v_fire` yine okunuyor ama YALNIZ fonksiyonun var olduğunu
  -- doğrulamak için (yukarıdaki null kontrolü). Durumu bu göç yargılamıyor.

  raise notice '0099: Finans kapısı geri kondu; düzeltilmiş hesap _ham''da.';
end $$;


-- ── 3 · PANODAN GELEN METİN BOZULMAMIŞ MI (MIYOP-079) ────────────────────
-- ⚠️ Codex, Codex'e YAPIŞTIRILAN metinde `İ/ı` karakterlerinin bozulduğunu
-- gördü (`Ä°`/`Ä±`). Depo dosyası doğru UTF-8 ve yerel provada doğru
-- çalışıyor — ama CANLIYA pano üzerinden gitti ve pano yolu metni
-- bozabilir. "Dosya doğru" demek "canlıdaki fonksiyon doğru" demek değildir.
--
-- Bu blok CANLIDA ölçüyor: dört i varyantı tek harfe katlanıyor mu?
-- Bozulmuş bir fonksiyon burada patlar.
do $$
begin
  if app.kimlik_anahtari('İSTANBUL') <> app.kimlik_anahtari('istanbul') then
    raise exception
      '0099: kimlik anahtarı dört i varyantını katlamıyor — 0094 metni pano '
      'yolunda bozulmuş olabilir (MIYOP-079). Gelen: % / %',
      app.kimlik_anahtari('İSTANBUL'), app.kimlik_anahtari('istanbul');
  end if;
  if app.kimlik_anahtari('ıI') <> 'II' or app.kimlik_anahtari('İi') <> 'II' then
    raise exception '0099: kimlik anahtarı ı/İ çevirisi bozuk.';
  end if;
  if app.kimlik_anahtari(' n-1 ') <> 'N-1' then
    raise exception '0099: kimlik anahtarı boşluk kırpmıyor.';
  end if;
  raise notice '0099: Kimlik anahtarı canlıda doğru (dört i varyantı katlanıyor).';
end $$;


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


