-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · BEKLEYEN GÖÇ · DÖRT GÖÇ, SIRAYLA · 09.11.2026
--
-- Canlı veritabanı **göç 0108'de**. Bu dosya dört göç taşıyor; hepsi bu
-- dosyadaki SIRAYLA çalışmalı (tek "Run" yeter, dosya baştan sona tek
-- seferde koşar).
--
--   · 0109 · şahit numune OLAY ZAMANI sunucudan damgalanıyor   (MIYOP-101 · P1)
--   · 0110 · geri arama spam kapısı eşzamanlı yazıma kapandı   (MIYOP-102 · P1)
--   · 0111 · numune metin eşikleri ekranla aynı oldu            (MIYOP-105 · P2)
--   · 0112 · numune ALINMA zamanı da sunucudan damgalanıyor     (Codex bulgusu DEĞİL)
--
-- ⚠️ DÖRDÜ DE PROVA VERİTABANINDA UYGULANDI VE ÖLÇÜLDÜ (09.11.2026,
-- temiz PostgreSQL 16, **113 göç · 63 prova · 0 kırmızı**). Her göçün
-- sonunda bir özet tablosu var; son satırı `dogrulama | gecti` yazıyor.
-- O satırı görmeden göç bitmiş sayılmaz.
--
-- ⚠️ 0110 VAR OLAN KAYITLARA DOKUNUYOR: aynı telefon için birden fazla
-- AÇIK (NEW) geri arama talebi varsa en eskisi NEW kalıyor, sonrakiler
-- CLOSED'a çekiliyor ve notuna sebebi yazılıyor. Hiçbir kayıt SİLİNMİYOR.
-- Kaç kayıt değiştiyse NOTICE olarak yazıyor.
--
-- ⚠️ 0111 ESKİ KAYITLARI ÖLÇÜYOR: canlıda iki karakterden kısa numune kodu
-- ya da üç karakterden kısa gerekçe/sonuç varsa göç DURUR ve sayısını
-- söyler (kısıt eklenmez, veri bozulmaz). Prova veritabanında ihlal yoktu.
--
-- ⚠️ 0112 BİR CODEX BULGUSU DEĞİL, 0109'u yazarken görülen komşu kusur.
-- Ve 0109'unki kadar ciddi DEĞİL: `taken_at` hiçbir kuralın girdisi
-- değil, kaydırılması bir kapı açmıyor — bozduğu şey defterin kendi
-- doğruluğu ("kim"i damgalayıp "ne zaman"ı istemciye bırakmak).
--
-- ⚠️ Dördü de tekrar çalıştırılabilir (idempotent).
--
-- ⚠️ Bu dosyayı BOŞALTMAK, göçü uygulamanın SON adımıdır (kontrol
-- listesi 130). "Run" tuşuna basmak son adım değildir.
-- ═══════════════════════════════════════════════════════════════════════════



-- ▼▼▼ 0109_numune_olay_zamani_sunucudan.sql ▼▼▼

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


-- ▼▼▼ 0110_geri_arama_es_zaman_kapisi.sql ▼▼▼

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0110 — GERİ ARAMA SPAM KAPISI EŞZAMANLI YAZIMA KARŞI SAĞLAMLAŞTI
--
-- ── NEDEN VAR ────────────────────────────────────────────────────────────
-- **MIYOP-102 · P1 · İKİ SPAM KAPISI DA "OKU, SONRA YAZ" DESENİNDEYDİ.**
--
-- 0106'nın iki sınırı vardı:
--   · aynı telefon için AÇIK (NEW) bir talep varsa ikincisi reddedilir;
--   · aynı telefondan 24 saatte en çok 3 talep.
-- İkisi de `select ... ; insert ...` şeklinde yazılmıştı. PostgreSQL'in
-- öntanımlı yalıtımı READ COMMITTED: iki eşzamanlı çağrı, biri daha
-- COMMIT etmemişken diğerinin yazdığını GÖRMEZ. İkisi de "açık talep yok"
-- okur, ikisi de yazar. Kapı kâğıt üstünde kalır.
--
-- ⚠️ TAHMİN DEĞİL, ÖLÇÜLDÜ. Önce 20 paralel gerçek çağrı denendi; işletim
-- sisteminin süreç başlatma gecikmesi çağrıları sıraya dizdiği için yarış
-- OLUŞMADI (1 yazım, 19 ret). Yani "paralel koştu, geçti" demek yanlış
-- yeşil olurdu. Sonra fonksiyonun KENDİ sırası iki oturumda bilerek
-- araklandı:
--     A: begin → kapı okuması: 0 → (bekle) → insert → commit
--     B:        → kapı okuması: 0 → (bekle) → insert → commit
--     sonuç: 2 NEW satır (aynı telefon)
-- Kusur bu şekilde kesin olarak canlandırıldı.
--
-- ── ONARIM · İKİ KAT, BİRBİRİNDEN BAĞIMSIZ ───────────────────────────────
-- **1 · TELEFON BAŞINA İŞLEM KİLİDİ (asıl onarım).**
--    `pg_advisory_xact_lock(110, hashtext(telefon))` — aynı numara için
--    gelen ikinci çağrı, birincisi COMMIT edene kadar BEKLER; sonra kapı
--    okumasını birincinin yazdığı satırı GÖREREK yapar.
--    ⚠️ Kilit telefona göre: başka numaralardan gelen talepler hiç
--    beklemiyor. Tabloyu ya da formu kilitlemek, bir numaranın spam'i
--    yüzünden bütün formu yavaşlatmak olurdu.
--    ⚠️ 24 saat / 3 talep sınırı için kilit ZORUNLU: bir sayma kuralını
--    hiçbir tekillik indeksi ifade edemez.
--
-- **2 · KISMİ TEKİLLİK İNDEKSİ (fiziksel emniyet).**
--    `unique (phone) where status = 'NEW'` — ileride kilidi almayan bir
--    yol açılırsa veritabanı yine de ikinci açık talebi REDDEDER.
--    ⚠️ Tek başına YETMEZ (24 saat sınırını kapsamaz); kilidin yerine
--    değil, yanına konuyor.
--
-- **3 · HATA MESAJI DOĞRU SEBEBİ SÖYLÜYOR.**
--    0106'nın yazma döngüsü her `unique_violation`ı "numara çakıştı" sanıp
--    5 kez yeniden deniyor, sonra "Talep numarası üretilemedi" diyordu.
--    Yeni indeks devreye girdiğinde kullanıcı o YANLIŞ mesajı görürdü.
--    Artık kısıt adı okunuyor: açık talep çakışması MI409 ile kendi
--    mesajını veriyor, yalnız referans çakışması yeniden deniyor.
--
-- ── VAR OLAN ÇİFT KAYITLAR ───────────────────────────────────────────────
-- İndeks, aynı telefonda iki NEW satır varsa oluşamaz. Bu göç hiçbir
-- kaydı SİLMİYOR: aynı numaranın en ESKİ açık talebi NEW kalıyor (kapı
-- çalışsaydı zaten o yazılmış olacaktı), sonrakiler CLOSED'a çekiliyor ve
-- notuna sebebi yazılıyor. Metin, ad, telefon, onay — hepsi yerinde
-- duruyor; yalnız durum değişiyor.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · VAR OLAN ÇİFT AÇIK TALEPLER KAPATILIYOR (SİLİNMİYOR) ─────────────
do $$
declare v_say int;
begin
  with sira as (
    select id, row_number() over (partition by phone order by created_at, id) as n
      from public.callback_request
     where status = 'NEW'
  )
  update public.callback_request c
     set status       = 'CLOSED',
         contact_note = coalesce(c.contact_note || E'\n', '') ||
           '0110: ayni numara icin ikinci acik talep. Es zamanli yazim kapisi '
           'yoktu (MIYOP-102). Kayit SILINMEDI, kapatildi.',
         updated_at   = now()
    from sira s
   where s.id = c.id and s.n > 1;
  get diagnostics v_say = row_count;

  if v_say > 0 then
    raise notice '0110: % cift acik talep CLOSED yapildi (silinmedi).', v_say;
  else
    raise notice '0110: cift acik talep yok.';
  end if;
end $$;


-- ── 2 · KISMİ TEKİLLİK İNDEKSİ ───────────────────────────────────────────
create unique index if not exists callback_request_acik_talep_tekil
  on public.callback_request (phone) where status = 'NEW';

comment on index public.callback_request_acik_talep_tekil is
  'Ayni telefon icin en fazla BIR acik (NEW) talep. Es zamanli iki cagri '
  'kapi okumasini ayni anda yapsa bile veritabani ikincisini reddeder '
  '(MIYOP-102 / 0110). 24 saat sinirini KAPSAMAZ; onun icin islem kilidi var.';


-- ── 3 · KAPI · İŞLEM KİLİDİ VE DOĞRU HATA MESAJI ─────────────────────────
create or replace function app.geri_arama_gonder(
  p_full_name    text,
  p_phone        text,
  p_company_name text,
  p_email        text default null,
  p_topic        text default null,
  p_best_time    text default 'FARKETMEZ',
  p_consent      boolean default false
)
returns text
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_telefon text;
  v_saat    text;
  v_eposta  text;
  v_ref     text;
  v_adet    int;
  v_kisit   text;
  i         int;
begin
  -- ⚠️ ONAY İLK KONTROL. Onay yoksa hiçbir kişisel veri işlenmiyor:
  -- doğrulama bile yapılmıyor, çünkü doğrulama da bir işlemedir.
  if coalesce(p_consent, false) is not true then
    raise exception 'Formu gönderebilmek için kişisel verilerin işlenmesine onay vermeniz gerekiyor.'
      using errcode = 'MI422';
  end if;

  v_telefon := app.telefon_sadelestir(p_phone);
  if v_telefon is null then
    raise exception 'Telefon numarası anlaşılamadı. Başında sıfır olacak şekilde on bir hane yazın (örnek: 0532 123 45 67).'
      using errcode = 'MI422';
  end if;

  if length(btrim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'Ad soyad yazılmadı.' using errcode = 'MI422';
  end if;
  if length(btrim(coalesce(p_company_name, ''))) < 2 then
    raise exception 'İşletme adı yazılmadı.' using errcode = 'MI422';
  end if;

  v_saat := upper(btrim(coalesce(p_best_time, '')));
  if v_saat not in ('SABAH','OGLEDEN_SONRA','AKSAM','FARKETMEZ') then
    v_saat := 'FARKETMEZ';
  end if;

  v_eposta := nullif(lower(btrim(coalesce(p_email, ''))), '');
  -- E-posta isteğe bağlı; YAZILDIYSA e-postaya benzemek zorunda. Yarım
  -- yazılmış bir adres, hiç yazılmamış bir adresten kötüdür: oraya yazıp
  -- cevap bekleriz.
  if v_eposta is not null and v_eposta !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception 'E-posta adresi eksik görünüyor. Düzeltin ya da boş bırakın.'
      using errcode = 'MI422';
  end if;

  -- ── TELEFON BAŞINA İŞLEM KİLİDİ (0110 · MIYOP-102) ──────────────────────
  -- ⚠️ BU SATIR OLMADAN AŞAĞIDAKİ İKİ KAPI DA ETKİSİZDİ: eşzamanlı iki
  -- çağrı birbirinin henüz COMMIT edilmemiş satırını görmez, ikisi de
  -- "yok" okur. Kilit işlem sonunda kendiliğinden bırakılıyor.
  -- ⚠️ Doğrulamalardan SONRA alınıyor: geçersiz bir form yüzünden
  -- numaranın kilidi boşuna tutulmasın.
  perform pg_advisory_xact_lock(110, hashtext(v_telefon));

  -- ── Spam kapısı 1 · açık talep ──────────────────────────────────────────
  if exists (
    select 1 from public.callback_request
     where phone = v_telefon and status = 'NEW'
  ) then
    raise exception 'Bu numara için bekleyen bir geri arama talebi zaten var. En kısa sürede arayacağız.'
      using errcode = 'MI409';
  end if;

  -- ── Spam kapısı 2 · 24 saatte en çok üç ─────────────────────────────────
  select count(*) into v_adet
    from public.callback_request
   where phone = v_telefon
     and created_at > now() - interval '24 hours';
  if v_adet >= 3 then
    raise exception 'Bu numaradan bugün çok sayıda talep geldi. Yarın tekrar deneyin ya da bizi arayın.'
      using errcode = 'MI429';
  end if;

  for i in 1..5 loop
    begin
      insert into public.callback_request
        (reference, full_name, phone, company_name, email, topic, best_time,
         consent_at, consent_version)
      values
        (app.geri_arama_referansi(), btrim(p_full_name), v_telefon,
         btrim(p_company_name), v_eposta,
         nullif(btrim(coalesce(p_topic, '')), ''), v_saat,
         now(), app.kvkk_metin_surumu())
      returning reference into v_ref;
      return v_ref;
    exception when unique_violation then
      -- ⚠️ HANGİ TEKİLLİK ÇAKIŞTI? 0106 hepsini "referans çakıştı" sanıyordu.
      -- Açık talep indeksi çakıştığında yeniden denemek anlamsız: beşinci
      -- denemeden sonra kullanıcı "Talep numarası üretilemedi" gibi YANLIŞ
      -- bir sebep görürdü.
      get stacked diagnostics v_kisit = constraint_name;
      if v_kisit = 'callback_request_acik_talep_tekil' then
        raise exception 'Bu numara için bekleyen bir geri arama talebi zaten var. En kısa sürede arayacağız.'
          using errcode = 'MI409';
      end if;
      -- Referans çakışması: döngü tekrar denesin.
      null;
    end;
  end loop;

  raise exception 'Talep numarası üretilemedi. Lütfen tekrar deneyin.'
    using errcode = 'MI500';
end $$;

comment on function app.geri_arama_gonder is
  'Geri arama talebinin TEK giris kapisi. status, contacted_* ve consent_at '
  'PARAMETRE OLARAK BILE yok. Onay ilk kontrol (0106). Telefon basina islem '
  'kilidi + kismi tekillik indeksi ile es zamanli yazima kapali (0110).';


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
-- ⚠️ TUZAK 181: `pg_get_functiondef` yorumları da döndürür; ölçümden önce
-- yorumlar siliniyor. Aksi hâlde yukarıdaki açıklama satırları ölçümü
-- yanıltırdı.
do $$
declare v_govde text; v_say int;
begin
  select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'geri_arama_gonder';

  if v_govde is null then
    raise exception '0110 DOGRULAMA: app.geri_arama_gonder bulunamadi.';
  end if;

  if v_govde !~ 'pg_advisory_xact_lock' then
    raise exception '0110 DOGRULAMA: telefon basina islem kilidi yok.';
  end if;
  -- Kilit, kapı okumalarından ÖNCE mi? Sonra alınması hiçbir şey korumaz.
  if position('pg_advisory_xact_lock' in v_govde) >
     position('and status = ''NEW''' in v_govde) then
    raise exception '0110 DOGRULAMA: kilit kapi okumasindan SONRA aliniyor.';
  end if;
  if v_govde !~ 'constraint_name' then
    raise exception '0110 DOGRULAMA: cakisan kisit ayirt edilmiyor; '
      'kullanici yanlis sebep gorur.';
  end if;
  if v_govde !~ 'callback_request_acik_talep_tekil' then
    raise exception '0110 DOGRULAMA: acik talep indeksi govdede taninmiyor.';
  end if;

  -- İndeks gerçekten var ve KISMİ mi?
  if not exists (
    select 1 from pg_index x join pg_class c on c.oid = x.indexrelid
     where c.relname = 'callback_request_acik_talep_tekil'
       and x.indisunique and x.indpred is not null) then
    raise exception '0110 DOGRULAMA: kismi tekillik indeksi yok ya da kismi degil.';
  end if;

  -- İndeksin dayanabilmesi için çift açık talep kalmamış olmalı.
  select count(*) into v_say from (
    select phone from public.callback_request where status = 'NEW'
     group by phone having count(*) > 1) y;
  if v_say > 0 then
    raise exception '0110 DOGRULAMA: hala % numarada cift acik talep var.', v_say;
  end if;

  -- 0106'nın kuralları yerinde mi?
  if v_govde !~ 'app\.telefon_sadelestir' then
    raise exception '0110 DOGRULAMA: telefon normalizasyonu dustu.';
  end if;
  if v_govde !~ 'p_consent' or v_govde !~ 'MI422' then
    raise exception '0110 DOGRULAMA: KVKK onay kontrolu dustu.';
  end if;
  if v_govde ~ 'p_status|p_contacted' then
    raise exception '0110 DOGRULAMA: yazilamayacak alan parametreye girmis.';
  end if;

  raise notice '0110 TAMAM · geri arama spam kapisi es zamanli yazima kapali.';
end $$;


-- ── ÖZET ──────────────────────────────────────────────────────────────────
select 'islem kilidi' as ne, 'pg_advisory_xact_lock(110, hashtext(telefon))' as deger
union all
select 'kismi indeks', 'callback_request_acik_talep_tekil (phone) where NEW'
union all
select 'acik talebi olan numara', (select count(distinct phone)::text
  from public.callback_request where status='NEW')
union all
select 'cift acik talep (0 olmali)', (select count(*)::text from (
  select phone from public.callback_request where status='NEW'
   group by phone having count(*)>1) y)
union all
select 'dogrulama', 'gecti';


-- ▼▼▼ 0111_numune_metin_esikleri.sql ▼▼▼

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0111 — ŞAHİT NUMUNE METİN EŞİKLERİ EKRANLA AYNI OLDU
--
-- ── NEDEN VAR ────────────────────────────────────────────────────────────
-- **MIYOP-105 · P2 · EKRAN İLE VERİTABANI AYNI ŞEYİ İSTEMİYORDU.**
--
-- Ekranın eşikleri (`src/quality/witness-sample.service.ts`, ölçüldü):
--     numuneKoduYeterliMi  → btrim uzunluk >= 2
--     gerekceYeterliMi     → btrim uzunluk >= 3   (gerekçe VE açılış sonucu)
-- Ekran bunları gerçekten uyguluyor (`src/pages/SahitNumune.tsx` satır
-- 224, 292-293: düğme bu koşullar sağlanmadan etkin olmuyor).
--
-- Veritabanının istediği (0093, 0100):
--     sample_code → `btrim(sample_code) <> ''`      yani 1 karakter yeter
--     reason      → `btrim(reason) <> ''`           yani 1 karakter yeter
--     result      → `btrim(result) <> ''`           yani 1 karakter yeter
--
-- Yani API'den yazan biri — ya da ileride ekranı atlayan bir yol —
-- gerekçe yerine `.` yazıp geçebiliyordu. Şahit numune defterinin tek
-- işi bir tartışmada neyin neden yapıldığını söylemek; tek karakterlik
-- bir gerekçe o işi yapmaz. Tarayıcıdaki kontrol bir güvenlik sınırı
-- değildir (bu depodaki temel kural): kural veritabanında olmalı.
--
-- ⚠️ BU BİR "KAPI SIKMA" GÖÇÜ, DAVRANIŞ DEĞİŞİKLİĞİ DEĞİL: ekran zaten
-- bu eşikleri uyguluyordu, yani hiçbir ekran akışı değişmiyor. Değişen
-- tek şey, ekranı atlayan yolun da aynı eşiğe çarpması.
--
-- ── NE DEĞİŞMİYOR ────────────────────────────────────────────────────────
-- · `ALINDI` olayı gerekçe İSTEMİYOR (0093) — numune alındı, o kadar.
-- · Sonuç yalnız `ACILDI` için zorunlu (0100); `IMHA`nın sonucu
--   gerekçesinin içinde.
-- · Numune kodunun BİÇİMİ hâlâ serbest: işletmenin kendi defteri.
--
-- ── VAR OLAN KAYITLAR ────────────────────────────────────────────────────
-- 0100'ün deseni uygulanıyor: kısıt eklenmeden ÖNCE ihlal sayılıyor.
-- Olay defteri DEĞİŞMEZ (update/delete tetikle engelli), yani eski bir
-- kaydı düzeltmek mümkün değil. İhlal varsa göç DURUYOR ve ne yapılacağını
-- söylüyor — sessizce yarım uygulanmış bir kısıt bırakmıyor.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · ÖNCE ÖLÇ ─────────────────────────────────────────────────────────
do $$
declare v_kod int; v_ger int; v_son int;
begin
  select count(*) into v_kod from public.witness_sample
   where length(btrim(sample_code)) < 2;
  select count(*) into v_ger from public.witness_sample_event
   where event_type <> 'ALINDI'
     and length(btrim(coalesce(reason, ''))) < 3;
  select count(*) into v_son from public.witness_sample_event
   where event_type = 'ACILDI'
     and length(btrim(coalesce(result, ''))) < 3;

  if v_kod > 0 or v_ger > 0 or v_son > 0 then
    raise exception
      '0111: eski kayitlar yeni esikleri karsilamiyor '
      '(kisa kod: %, kisa gerekce: %, kisa sonuc: %). Kisit EKLENMEDI. '
      'Olay defteri degismez oldugu icin bu kayitlar duzeltilemez; bu '
      'durumda kurali yalniz YENI kayitlar icin zorlamak gerekir '
      '(`not valid` ile) ve o karar YAZILARAK verilmelidir.',
      v_kod, v_ger, v_son;
  end if;

  raise notice '0111: eski kayitlarda ihlal yok; kisitlar eklenebilir.';
end $$;


-- ── 2 · NUMUNE KODU · EN AZ İKİ KARAKTER ─────────────────────────────────
alter table public.witness_sample
  drop constraint if exists witness_sample_code_not_blank;
alter table public.witness_sample
  add constraint witness_sample_code_not_blank check (
    length(btrim(sample_code)) >= 2
  );

comment on constraint witness_sample_code_not_blank on public.witness_sample is
  'Numune kodu en az iki karakter (0111). Esik EKRANLA AYNI: '
  'numuneKoduYeterliMi (witness-sample.service.ts). Bicim serbest.';


-- ── 3 · GEREKÇE · EN AZ ÜÇ KARAKTER ──────────────────────────────────────
-- ⚠️ `ALINDI` dışarıda: numune almanın gerekçesi yoktur.
alter table public.witness_sample_event
  drop constraint if exists witness_sample_event_reason_required;
alter table public.witness_sample_event
  add constraint witness_sample_event_reason_required check (
    event_type = 'ALINDI'
    or length(btrim(coalesce(reason, ''))) >= 3
  );

comment on constraint witness_sample_event_reason_required
  on public.witness_sample_event is
  'Acilis ve imha gerekce ister, en az uc karakter (0093 + 0111). Esik '
  'EKRANLA AYNI: gerekceYeterliMi. Tek karakterlik gerekce defterin '
  'isini yapmaz.';


-- ── 4 · AÇILIŞ SONUCU · EN AZ ÜÇ KARAKTER ────────────────────────────────
alter table public.witness_sample_event
  drop constraint if exists witness_sample_event_result_required;
alter table public.witness_sample_event
  add constraint witness_sample_event_result_required check (
    event_type <> 'ACILDI'
    or length(btrim(coalesce(result, ''))) >= 3
  );

comment on constraint witness_sample_event_result_required
  on public.witness_sample_event is
  'Acilis SONUC ister, en az uc karakter (0100 + 0111). Esik EKRANLA AYNI: '
  'gerekceYeterliMi. Acilis saklama sonunu KISALTIR (0094); sonucsuz '
  'acilis numunenin omrunu sebepsiz azaltirdi.';


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
-- ⚠️ "Kısıtı yazdım" demek yetmez: kısıtın TANIMININ yürürlükte olduğu
-- ölçülüyor. Kısıtların GERÇEKTEN reddettiği ayrı ölçülüyor —
-- `db/prova/prova-0111.sql` canlı yazımla sınıyor; bu blok onun yerine
-- geçmez.
do $$
begin
  -- Kısıt tanımları yerinde mi?
  if not exists (select 1 from pg_constraint
                  where conname = 'witness_sample_code_not_blank'
                    and pg_get_constraintdef(oid) ~ '>= 2') then
    raise exception '0111 DOGRULAMA: numune kodu esigi 2 degil.';
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'witness_sample_event_reason_required'
                    and pg_get_constraintdef(oid) ~ '>= 3') then
    raise exception '0111 DOGRULAMA: gerekce esigi 3 degil.';
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'witness_sample_event_result_required'
                    and pg_get_constraintdef(oid) ~ '>= 3') then
    raise exception '0111 DOGRULAMA: sonuc esigi 3 degil.';
  end if;
  -- ALINDI hâlâ gerekçeden muaf mı?
  if not exists (select 1 from pg_constraint
                  where conname = 'witness_sample_event_reason_required'
                    and pg_get_constraintdef(oid) ~ 'ALINDI') then
    raise exception '0111 DOGRULAMA: ALINDI muafiyeti dustu.';
  end if;
  -- IMHA hâlâ sonuçtan muaf mı?
  if not exists (select 1 from pg_constraint
                  where conname = 'witness_sample_event_result_required'
                    and pg_get_constraintdef(oid) ~ 'ACILDI') then
    raise exception '0111 DOGRULAMA: sonuc kisiti ACILDI ile sinirli degil.';
  end if;

  raise notice '0111 TAMAM · numune metin esikleri ekranla ayni '
    '(kod >= 2, gerekce >= 3, sonuc >= 3).';
end $$;


-- ── ÖZET ──────────────────────────────────────────────────────────────────
select 'numune kodu' as ne, 'en az 2 karakter' as esik,
       (select count(*)::text from public.witness_sample) as mevcut_kayit
union all
select 'gerekce (ALINDI haric)', 'en az 3 karakter',
       (select count(*)::text from public.witness_sample_event where event_type <> 'ALINDI')
union all
select 'acilis sonucu', 'en az 3 karakter',
       (select count(*)::text from public.witness_sample_event where event_type = 'ACILDI')
union all
select 'dogrulama', 'gecti', '';


-- ▼▼▼ 0112_numune_alinma_zamani_sunucudan.sql ▼▼▼

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0112 — NUMUNE ALINMA ZAMANI DA SUNUCUDAN DAMGALANIYOR
--
-- ── NEDEN VAR ────────────────────────────────────────────────────────────
-- ⚠️ BU BİR CODEX BULGUSU DEĞİL. 0109'u yazarken (MIYOP-101) aynı desenin
-- komşu kolonda da durduğunu gördüm ve ölçtüm.
--
-- `app.numune_turet()` imzanın "KİM" tarafını damgalıyordu:
--     new.taken_by := app.aktif_kullanici_id();
-- Ama "NE ZAMAN" tarafı istemciye açıktı. `taken_at` kolonunun
-- `default now()` değeri var (0093) — ne var ki varsayılan, yalnız
-- İSTEMCİ BİR DEĞER GÖNDERMEDİĞİNDE devreye girer. Gönderirse o yazılır.
--
-- ── NE KADAR CİDDİ · ABARTMIYORUM ────────────────────────────────────────
-- ⚠️ Bu, 0109'un kapattığı kusurla AYNI ÖNEMDE DEĞİL. `occurred_at`
-- saklama sonunu hesaplayan kuralın GİRDİSİYDİ; onu kaydırmak kuralı
-- etkisiz bırakıyordu. `taken_at` hiçbir kuralın girdisi değil (ölçüldü:
-- göçlerde `taken_at` yalnız 0093'ün tablo tanımında ve bir indekste
-- geçiyor; `keep_until` partinin SKT'sinden geliyor, `taken_at`ten
-- değil). Yani kaydırılan bir `taken_at` bir kapıyı AÇMIYOR.
--
-- Bozduğu şey defterin KENDİSİ: şahit numune defterinin tek işi bir
-- tartışmada "hangi partinin numunesi, kim aldı, ne zaman aldı"
-- sorularına cevap vermek. "Kim"i sunucuya damgalayıp "ne zaman"ı
-- istemciye bırakmak, aynı satırın yarısına güvenip yarısına
-- güvenmemek demek.
--
-- ⚠️ HİÇBİR EKRAN AKIŞI KIRILMIYOR (ölçüldü):
-- `src/quality/witness-sample.repository.ts > numuneAl()` `taken_at`
-- GÖNDERMİYOR; ekranda böyle bir alan da yok. Yani bugün bu kolona
-- gelen bir değer ancak ekranı atlayan bir yoldan gelebilir.
--
-- ⚠️ İLERİDE "NUMUNE DÜN ALINDI, BUGÜN YAZILIYOR" İHTİYACI ÇIKARSA:
-- çözümü bu damgayı kaldırmak DEĞİL, geriye tarih atmayı **ayrı ve
-- yetkiye bağlı** bir yola koymaktır (0087'nin deseni). Damgayı kaldırmak,
-- herkese sessizce geriye tarih atma hakkı vermek olur.
--
-- ── NE DEĞİŞMİYOR ────────────────────────────────────────────────────────
-- 0094'ün bütün kuralları yerinde: kiracı sunucudan, parti/şube/iş emri
-- kiracı doğrulamalı, saklama sonu partinin SKT'sinden, saklama koşulu ve
-- açık raf ömrü ÜRÜN KARTINDAN, kimlik anahtarı sunucuda.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

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

  -- ⚠️ İmza sunucuda (0081/0087 deseni) — "kim" VE "ne zaman".
  -- ⚠️ 0112: `taken_at` de damgalanıyor. Eskiden kolonun `default now()`
  -- değeri vardı ama istemci gönderirse O yazılıyordu: "kim" damgalanıp
  -- "ne zaman" istemciye bırakılmıştı. Ekran bu alanı HİÇ göndermiyor
  -- (ölçüldü: `witness-sample.repository.ts > numuneAl()`), yani
  -- gönderilen bir değer ancak ekranı atlayan bir yoldan gelir.
  new.taken_at := now();
  new.taken_by := app.aktif_kullanici_id();
  new.status   := 'SAKLANIYOR';

  return new;
end $$;

revoke all on function app.numune_turet() from public;
revoke all on function app.numune_turet() from anon;
revoke all on function app.numune_turet() from authenticated;


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
-- ⚠️ TUZAK 181/194: `pg_get_functiondef` yorumları da döndürür ve bu göçün
-- kendi yorumları yasakladığı metni içeriyor. Ölçümden önce yorumlar
-- siliniyor.
do $$
declare v_govde text;
begin
  select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'numune_turet';

  if v_govde is null then
    raise exception '0112 DOGRULAMA: app.numune_turet() bulunamadi.';
  end if;

  if v_govde !~ 'new\.taken_at\s*:=\s*now\(\)' then
    raise exception '0112 DOGRULAMA: alinma zamani sunucuda damgalanmiyor.';
  end if;
  if v_govde !~ 'new\.taken_by\s*:=\s*app\.aktif_kullanici_id\(\)' then
    raise exception '0112 DOGRULAMA: imzanin KIM tarafi dustu.';
  end if;

  -- 0094'un kapilari yerinde mi? Bir kapiyi onarirken digerini dusurmemek
  -- icin olculuyor.
  if v_govde !~ 'app\.current_tenant_id\(\)' then
    raise exception '0112 DOGRULAMA: kiraci siniri dustu (MIYOP-075).';
  end if;
  if v_govde !~ 'app\.kimlik_anahtari' then
    raise exception '0112 DOGRULAMA: kimlik anahtari sunucuda turetilmiyor.';
  end if;
  if v_govde !~ 'opened_shelf_life_days' then
    raise exception '0112 DOGRULAMA: acik raf omru karttan kopyalanmiyor.';
  end if;
  if v_govde !~ 'storage_condition' then
    raise exception '0112 DOGRULAMA: saklama kosulu karttan kopyalanmiyor.';
  end if;
  if v_govde !~ 'MI422' then
    raise exception '0112 DOGRULAMA: SKT ve saklama kosulu zorunlulugu dustu.';
  end if;

  if not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                  where c.relname = 'witness_sample' and g.tgname = 'numune_turet'
                    and not g.tgisinternal) then
    raise exception '0112 DOGRULAMA: numune_turet tetigi bagli degil.';
  end if;

  raise notice '0112 TAMAM · numune imzasinin KIM ve NE ZAMAN tarafi da '
    'sunucudan damgalaniyor.';
end $$;


-- ── ÖZET ──────────────────────────────────────────────────────────────────
select 'alinma zamani (taken_at)' as ne, 'sunucu damgasi (now())' as deger
union all
select 'alan kisi (taken_by)', 'sunucu damgasi (aktif kullanici)'
union all
select 'istemcinin gonderdigi taken_at', 'yok sayiliyor'
union all
select 'dogrulama', 'gecti';

