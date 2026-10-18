-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0090 · 0089'U DARALTMA + MIYOP-044 · YARIM KALAN İŞİ BİTİRME
--
-- 0089, MIYOP-038 ve MIYOP-039'u onardı ama **gereğinden fazlasını açtı.**
-- Codex denetimi (18.10.2026) bunu satır satır gösterdi ve haklı:
--
--   "038 ve 039'u onarmak için gereken muaf yazımların tamamı
--    `izin_gerek_coklu()` üzerinden geçiyor. Diğer dokuz kapıyı topluca
--    gevşetmek bu iki onarımın zorunlu parçası değildi. Özellikle onay
--    imzası ve alerjen damgası gibi veri bütünlüğü kurallarını, genel iş
--    izni muafiyetinden ayrı tutmak daha sağlam olur."
--
-- Ölçtüm, doğru: iki kırık akışın yazdığı tabloların HEPSİ
-- (`sales_order`, `sales_order_revision`, `sales_order_line`, `portal_user`)
-- `izin_gerek_coklu()` kapısındadır. Dokuz kapıyı gevşetmem gereksizdi ve
-- iki somut zararı oldu:
--
--   ⚠️ MIYOP-035'in güvencesi zayıfladı. Sahte alerjen damgası kontrolü
--      (`MI436`) artık her `security definer` rutinin içinde atlanabilir.
--      Gıda etiketine basılan bir iddianın korumasını, iki ilgisiz akışı
--      onarmak için gevşetmek kabul edilemez.
--   ⚠️ 0087'nin onay imzası (`decided_by` sunucudan) aynı şekilde zayıfladı.
--
-- Bu göç dokuz kapıyı 0089 ÖNCESİNE döndürüyor. O hâl biliniyordu ve
-- çalışıyordu: MIYOP-038/039 dışında hiçbir akış kırık değildi.
--
-- ── 2 · MIYOP-044 · ÜÇ YARDIMCININ PUBLIC HAKKI AÇIK ─────────────────────
-- `app.basvuruyu_onayla`, `app.lisansi_uzat`, `app.lisans_olayi_yaz`
-- kendi yetki kontrolünü YAPMIYOR; yetkiyi dış `public` kabuğa bırakıyor.
-- Bu bilinçli bir tasarım, ama o zaman iç fonksiyona SQL'den ulaşılamaması
-- gerekir. 0035 yalnız `anon, authenticated`tan aldı — PostgreSQL'de
-- varsayılan **PUBLIC EXECUTE**tir ve o kalkmadı (tuzak 67).
--
-- ⚠️ 0089'un yorumu bu üçü için "kendi yetkisini doğrular" diyordu.
-- YANLIŞTI. Yorum da düzeltiliyor: yanlış belge, olmayan belgeden kötüdür.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · DOKUZ KAPI 0089 ÖNCESİNE DÖNÜYOR ─────────────────────────────────
do $$
declare
  -- `izin_gerek_coklu()` LİSTEDE YOK: 038/039'un onarımı odur, kalıyor.
  v_geri constant text[] := array[
    'app.izin_gerek()', 'app.stok_hareketi_izni()', 'app.stok_karti_izni()',
    'app.lot_izni()', 'app.kullanici_satiri_izni()', 'app.onay_karari_izni()',
    'app.ambalaj_beyani_izni()', 'app.haccp_olcum_izni()',
    'app.haccp_faaliyet_izni()'
  ];
  v_ad text; v_tanim text; v_donen int := 0; v_zaten int := 0;
begin
  foreach v_ad in array v_geri loop
    if to_regprocedure(v_ad) is null then
      raise exception '0090: % kapisi yok.', v_ad;
    end if;
    v_tanim := pg_get_functiondef(to_regprocedure(v_ad));

    if position('app.bakim_baglami()' in v_tanim) > 0
       and position('app.kapi_disi_baglam()' in v_tanim) = 0 then
      v_zaten := v_zaten + 1;                       -- tekrar calistirilabilir
    elsif position('app.kapi_disi_baglam()' in v_tanim) > 0 then
      execute replace(v_tanim, 'app.kapi_disi_baglam()', 'app.bakim_baglami()');
      v_donen := v_donen + 1;
    else
      raise exception
        '0090: % icinde iki sorudan biri de yok. Elle gozden gecirin.', v_ad;
    end if;
  end loop;

  if v_donen + v_zaten <> 9 then
    raise exception '0090: 9 kapi bekleniyordu, % islendi.', v_donen + v_zaten;
  end if;

  -- Gevşek kalan TEK kapı: 038/039'un onarımı.
  if position('app.kapi_disi_baglam()'
              in pg_get_functiondef(to_regprocedure('app.izin_gerek_coklu()'))) = 0 then
    raise exception
      '0090: `izin_gerek_coklu` gevsek kalmali — MIYOP-038 ve MIYOP-039 '
      'onun uzerinden onarildi. Simdi geri alinirsa portal yeniden kirilir.';
  end if;

  raise notice '0090: % kapi geri daraltildi, % kapi zaten dardi.',
    v_donen, v_zaten;
end $$;


-- ── 2 · MIYOP-044 · PUBLIC HAKKI KAPANIYOR ───────────────────────────────
-- ⚠️ TAM İMZA şart. İmzasız `revoke` birden çok aşırı yüklemede belirsizdir
-- ve sessizce yanlış fonksiyonu hedefleyebilir.
do $$
declare
  v_imza text;
  v_say  int := 0;
begin
  for v_imza in
    select n.nspname || '.' || p.proname
             || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app'
       and p.proname in ('basvuruyu_onayla', 'lisansi_uzat', 'lisans_olayi_yaz')
  loop
    execute format('revoke all on function %s from public', v_imza);
    execute format('revoke all on function %s from anon', v_imza);
    execute format('revoke all on function %s from authenticated', v_imza);
    execute format('grant execute on function %s to service_role', v_imza);
    v_say := v_say + 1;
  end loop;

  if v_say = 0 then
    raise exception '0090: uc ic yardimcidan hicbiri bulunamadi.';
  end if;
  raise notice '0090: % ic yardimci imzasinin PUBLIC hakki kapatildi.', v_say;
end $$;

-- Yorumlar düzeltiliyor: bu üçü kendi yetkisini DOĞRULAMAZ.
-- Yorumlar düzeltiliyor: bu üçü kendi yetkisini DOĞRULAMAZ. İmzayı elle
-- yazmıyoruz — `pg_get_function_identity_arguments` ile okuyoruz ki imza
-- değişirse göç patlasın, sessizce yanlış fonksiyonu yorumlamasın.
do $$
declare v_imza text; v_ad text;
begin
  for v_ad, v_imza in
    select p.proname,
           'app.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app'
       and p.proname in ('basvuruyu_onayla', 'lisansi_uzat', 'lisans_olayi_yaz')
  loop
    execute format(
      'comment on function %s is %L', v_imza,
      'KENDI YETKI KONTROLU YOKTUR: kiraci/lisans/basvuru kimligi '
      'parametreden gelir. Yetkiyi disaridaki `public` kabuk sorar. '
      'SQL erisimi 0090''da kapatildi (MIYOP-044). Bu fonksiyonu yeni bir '
      'yerden cagiracaksan once yetki kontrolunu kendi icine tasi.');
  end loop;
end $$;


-- ── 3 · MUAFİYET ENVANTERİ · DOĞRU KAPSAMLA (MIYOP-045) ──────────────────
-- 0089'un taraması iki yönden yanlıştı:
--   ÇOK GENİŞ · `%degismez%` tabloları da sayıyordu. O tetikler
--     DEĞİŞMEZLİK güvencesidir, iş izni kapısı değil; 0089 onlara hiç
--     dokunmadı. Oraya yazan bir rutin hiçbir şeyden muaf değildir.
--   ÇOK DAR · `trigger` dönenleri ve yalnız `service_role`a açık olanları
--     eliyordu. Elemek yüzeyi küçültmez, GÖRÜNMEZ yapar.
--
-- Doğru kapsam, 0090'dan sonra tek bir şeydir: **gevşek kalan tek kapıya
-- (`izin_gerek_coklu`) bağlı tablolara yazan `security definer` rutinler.**
-- Daraltmanın kazancı tam burada görülüyor — liste kısaldı.
do $$
declare
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
    'app.kiraci_haccp_plani_kur'
  ];
  v_bulunan text[];
  v_fazla   text[];
  v_eksik   text[];
begin
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
      '0090: gevsek kapinin ardinda LISTEDE OLMAYAN rutin(ler): %. Her biri '
      'kendi yetki kontrolunu yapmali ve bu listeye GEREKCESIYLE eklenmeli.',
      array_to_string(v_fazla, ', ');
  end if;
  if array_length(v_eksik, 1) is not null then
    raise notice '0090: listede olup bulunmayanlar: % (kaldirilmis olabilir)',
      array_to_string(v_eksik, ', ');
  end if;

  raise notice '0090: gevsek kapinin ardindaki yuzey % rutin (0089''da 11 idi).',
    coalesce(array_length(v_bulunan, 1), 0);
end $$;


-- ── 4 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare v_ad text; v_imza text; v_oid oid;
begin
  -- Dokuz kapı dar, bir kapı gevşek
  foreach v_ad in array array[
    'app.izin_gerek()', 'app.stok_hareketi_izni()', 'app.stok_karti_izni()',
    'app.lot_izni()', 'app.kullanici_satiri_izni()', 'app.onay_karari_izni()',
    'app.ambalaj_beyani_izni()', 'app.haccp_olcum_izni()',
    'app.haccp_faaliyet_izni()'
  ] loop
    if position('app.kapi_disi_baglam()'
                in pg_get_functiondef(to_regprocedure(v_ad))) > 0 then
      raise exception '0090: % hala gevsek.', v_ad;
    end if;
  end loop;

  -- 0086/0087/0088'in ince kuralları metin değiştirmede kaybolmamalı
  if position('(to_jsonb(new) - v_beyan) = (to_jsonb(old) - v_beyan)'
              in pg_get_functiondef(to_regprocedure('app.stok_karti_izni()'))) = 0 then
    raise exception '0090: stok karti kapisinin jsonb farki kayboldu.';
  end if;
  if position('MI436' in pg_get_functiondef(to_regprocedure('app.stok_karti_izni()'))) = 0 then
    raise exception '0090: MIYOP-035 kontrolu kayboldu.';
  end if;
  if position('new.decided_by := v_ben'
              in pg_get_functiondef(to_regprocedure('app.onay_karari_izni()'))) = 0 then
    raise exception '0090: onay imzasi kayboldu.';
  end if;

  -- MIYOP-044: üç yardımcı SQL'den ulaşılamaz olmalı
  -- ⚠️ `pg_get_function_identity_arguments` PARAMETRE ADLARINI da verir;
  -- o metin `to_regprocedure`a verilemez (sözdizimi hatası). Oid ile
  -- dolaşıyoruz.
  for v_oid, v_imza in
    select p.oid, n.nspname || '.' || p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app'
       and p.proname in ('basvuruyu_onayla', 'lisansi_uzat', 'lisans_olayi_yaz')
  loop
    if exists (
      select 1 from pg_proc p,
        lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       where p.oid = v_oid
         and a.grantee in (0, 'anon'::regrole, 'authenticated'::regrole)
         and a.privilege_type = 'EXECUTE'
    ) then
      raise exception '0090: % hala PUBLIC/anon/authenticated''a acik.', v_imza;
    end if;
  end loop;

  -- `public` kabuklar çalışmaya devam etmeli
  foreach v_ad in array array[
    'public.basvuruyu_onayla', 'public.lisansi_uzat'
  ] loop
    -- ⚠️ `to_regprocedure` bozuk imza metninde SÖZDİZİMİ HATASI atar,
    -- null dönmez. İmzayı tahmin etmek yerine ada göre arıyoruz.
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname || '.' || p.proname = v_ad
         and has_function_privilege('authenticated', p.oid, 'execute')
    ) then
      raise exception
        '0090: dis kabuk % yok ya da `authenticated` cagiramiyor. Ic '
        'yardimcinin SQL erisimini kapatmak, dis kapiyi da kapatmis olur.', v_ad;
    end if;
  end loop;

  raise notice '0090 tamam: dokuz kapi daraltildi, MIYOP-044 kapandi, '
    'muafiyet envanteri tetikleri de sayiyor.';
end $$;
