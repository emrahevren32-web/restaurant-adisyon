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
