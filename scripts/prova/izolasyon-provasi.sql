-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · İZOLASYON PROVASI (A4D madde 10)
--
-- ⚠️ BU DOSYA `db/migrations` ALTINDA DEĞİL VE OLMAMALI: oturum taklit
-- ediyor ve iki deneme kiracısı açıyor. Yalnız yerel provada koşar.
--
-- ── NİÇİN VAR ─────────────────────────────────────────────────────────────
-- "İki farklı firma birbirini görmüyor" cümlesi bu üründe bir özellik
-- değil, VAR OLMA ŞARTI. Bir müşteri diğerinin stok defterini, reçetesini
-- ya da müşteri listesini bir kez görürse ürün biter. O yüzden bu cümle
-- inanılarak değil KANITLANARAK taşınır ve kanıt her koşuda tekrarlanır.
--
-- ── İKİ KATMAN ────────────────────────────────────────────────────────────
-- 1. KAPSAM (dinamik): `tenant_id` kolonu taşıyan HER tabloda RLS açık mı
--    ve politikası gerçekten `current_tenant_id`ye bakıyor mu? Tablo
--    listesi elle yazılmıyor, veritabanından okunuyor — yani yarın
--    eklenecek tablo da kendiliğinden kapsama giriyor. Elle yazılmış bir
--    liste, en çok ihtiyaç duyulduğu anda eksik kalır.
-- 2. DAVRANIŞ: iki gerçek kiracı, gerçek veri, gerçek oturum. A'nın
--    oturumundan B'nin satırları OKUNAMAZ, GÜNCELLENEMEZ, SİLİNEMEZ.
--
-- Katman 1 olmadan katman 2 dar kalır (yalnız sınadığımız tabloları
-- korur); katman 2 olmadan katman 1 kâğıt üstünde kalır (politika var
-- ama işliyor mu?). İkisi birlikte anlamlı.
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- ── KATMAN 1 · Kapsam ─────────────────────────────────────────────────────
do $$
declare
  v_tablo   text;
  v_rls     boolean;
  v_politika int;
  v_tenant_politikasi int;
  v_eksik   text[] := array[]::text[];
  v_sayac   int := 0;

  -- ⚠️ MUAF TABLOLAR — HER BİRİNİN GEREKÇESİ YAZILI OLMAK ZORUNDA.
  -- Bu listeye gerekçesiz bir ad eklemek, izolasyonu sessizce delmektir.
  --
  --  · business_application / business_application_event
  --      Bunlar PLATFORM tabloları. `tenant_id` taşırlar ama o alan
  --      "onaydan sonra hangi işletmeye dönüştü" demektir; satırın SAHİBİ
  --      bir kiracı değil. Politikaları `app.yetkim_var('platform.manage')`
  --      ile korunuyor — yani müşteri hiç göremiyor (0032).
  --  · client_error
  --      Hata defteri. Müşterinin OKUMA yetkisi hiç yok (0030); tenant_id
  --      yalnız "hangi kiracıda oldu" bilgisi.
  --  · backup_log
  --      Yedek günlüğü; platform işi (0029).
  v_muaf text[] := array[
    'business_application', 'business_application_event',
    'client_error', 'backup_log'
  ];
begin
  for v_tablo in
    select c.table_name
      from information_schema.columns c
      join pg_tables t on t.tablename = c.table_name and t.schemaname = 'public'
     where c.table_schema = 'public' and c.column_name = 'tenant_id'
     order by c.table_name
  loop
    if v_tablo = any(v_muaf) then continue; end if;
    v_sayac := v_sayac + 1;

    select rowsecurity into v_rls
      from pg_tables where schemaname = 'public' and tablename = v_tablo;

    select count(*) into v_politika
      from pg_policies where schemaname = 'public' and tablename = v_tablo;

    -- Politikanın İFADESİNDE `current_tenant_id` geçiyor mu?
    -- `qual` okuma tarafı, `with_check` yazma tarafı.
    select count(*) into v_tenant_politikasi
      from pg_policies
     where schemaname = 'public' and tablename = v_tablo
       and (coalesce(qual, '') like '%current_tenant_id%'
            or coalesce(with_check, '') like '%current_tenant_id%');

    if not coalesce(v_rls, false) then
      v_eksik := v_eksik || (v_tablo || ' (RLS KAPALI)');
    elsif v_politika = 0 then
      v_eksik := v_eksik || (v_tablo || ' (politika YOK)');
    elsif v_tenant_politikasi = 0 then
      -- En sinsi hâl: RLS açık, politika var, ama politika kiracıya
      -- bakmıyor. Ekranda her şey çalışır; izolasyon yoktur.
      v_eksik := v_eksik || (v_tablo || ' (politika current_tenant_id''ye BAKMIYOR)');
    end if;
  end loop;

  if array_length(v_eksik, 1) > 0 then
    raise exception E'IZOLASYON KAPSAMI EKSIK. Su tablolar korunmuyor:\n  %',
      array_to_string(v_eksik, E'\n  ');
  end if;

  raise notice 'KAPSAM: % kiraci tablosunun hepsinde RLS acik ve politika current_tenant_id''ye bakiyor.', v_sayac;
end $$;

-- ── KATMAN 2 · Davranış ───────────────────────────────────────────────────
-- İki deneme kiracısı kuruluyor. E-postalar `@example.com` ile bitiyor;
-- 0037'nin bakım fonksiyonu sonda hepsini temizliyor.
do $$
declare
  v_a_kiraci uuid; v_a_firma uuid; v_a_sube uuid; v_a_kul uuid; v_a_auth uuid := gen_random_uuid();
  v_b_kiraci uuid; v_b_firma uuid; v_b_sube uuid; v_b_kul uuid; v_b_auth uuid := gen_random_uuid();
  v_a_stok uuid; v_b_stok uuid;
begin
  -- ── A kiracısı ──────────────────────────────────────────────────────────
  insert into tenant (code, name) values ('IZOA', 'Izolasyon A')
    on conflict (code) do update set name = excluded.name returning id into v_a_kiraci;
  insert into company (tenant_id, company_code, company_name)
    values (v_a_kiraci, 'IZOA', 'Izolasyon A')
    on conflict (tenant_id, company_code) do update set company_name = excluded.company_name
    returning id into v_a_firma;
  insert into branch (tenant_id, company_id, code, name, branch_type, is_head_office)
    values (v_a_kiraci, v_a_firma, 'MERKEZ', 'Merkez', 'merkez', true)
    on conflict (tenant_id, company_id, code) do update set name = excluded.name
    returning id into v_a_sube;
  insert into app_user (tenant_id, company_id, auth_user_id, username, username_key,
                        full_name, role_code, is_active)
    values (v_a_kiraci, v_a_firma, v_a_auth, 'izoa', 'izoa', 'Izolasyon A Sahibi',
            'isletme_sahibi', true)
    on conflict (tenant_id, username_key) do update set auth_user_id = excluded.auth_user_id
    returning id into v_a_kul;
  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (v_a_kiraci, v_a_sube, 'A-GIZLI', 'a-gizli', 'A kiracisinin gizli kalemi', 'kg')
    on conflict (tenant_id, branch_id, code_key) do update set name = excluded.name
    returning id into v_a_stok;

  -- ── B kiracısı ──────────────────────────────────────────────────────────
  insert into tenant (code, name) values ('IZOB', 'Izolasyon B')
    on conflict (code) do update set name = excluded.name returning id into v_b_kiraci;
  insert into company (tenant_id, company_code, company_name)
    values (v_b_kiraci, 'IZOB', 'Izolasyon B')
    on conflict (tenant_id, company_code) do update set company_name = excluded.company_name
    returning id into v_b_firma;
  insert into branch (tenant_id, company_id, code, name, branch_type, is_head_office)
    values (v_b_kiraci, v_b_firma, 'MERKEZ', 'Merkez', 'merkez', true)
    on conflict (tenant_id, company_id, code) do update set name = excluded.name
    returning id into v_b_sube;
  insert into app_user (tenant_id, company_id, auth_user_id, username, username_key,
                        full_name, role_code, is_active)
    values (v_b_kiraci, v_b_firma, v_b_auth, 'izob', 'izob', 'Izolasyon B Sahibi',
            'isletme_sahibi', true)
    on conflict (tenant_id, username_key) do update set auth_user_id = excluded.auth_user_id
    returning id into v_b_kul;
  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (v_b_kiraci, v_b_sube, 'B-GIZLI', 'b-gizli', 'B kiracisinin gizli kalemi', 'kg')
    on conflict (tenant_id, branch_id, code_key) do update set name = excluded.name
    returning id into v_b_stok;

  -- Sonraki bloğun kullanacağı kimlikleri ayarlara koyuyoruz.
  perform set_config('izo.a_kiraci', v_a_kiraci::text, false);
  perform set_config('izo.b_kiraci', v_b_kiraci::text, false);
  perform set_config('izo.a_auth',   v_a_auth::text,   false);
  perform set_config('izo.b_auth',   v_b_auth::text,   false);
  perform set_config('izo.a_stok',   v_a_stok::text,   false);
  perform set_config('izo.b_stok',   v_b_stok::text,   false);
  perform set_config('izo.b_kul',    v_b_kul::text,    false);

  raise notice 'Iki deneme kiracisi hazir: A=% B=%', v_a_kiraci, v_b_kiraci;
end $$;

-- ── A oturumunu aç ────────────────────────────────────────────────────────
select set_config('prova.uid',    current_setting('izo.a_auth'),   false);
select set_config('app.tenant_id', current_setting('izo.a_kiraci'), false);

set role authenticated;

do $$
declare
  v_b_stok uuid := current_setting('izo.b_stok')::uuid;
  v_b_kiraci uuid := current_setting('izo.b_kiraci')::uuid;
  v_b_kul uuid := current_setting('izo.b_kul')::uuid;
  v_adet int;
  v_etkilenen int;
begin
  -- 1) B'nin stok kalemi OKUNAMAZ
  select count(*) into v_adet from stock_item where id = v_b_stok;
  if v_adet <> 0 then
    raise exception 'IZOLASYON KIRIK: A oturumu B nin stok kalemini OKUYOR.';
  end if;

  -- 2) A kendi kalemini görüyor (test yanlış sebeple geçmesin)
  select count(*) into v_adet from stock_item where id = current_setting('izo.a_stok')::uuid;
  if v_adet <> 1 then
    raise exception 'PROVA GECERSIZ: A kendi stok kalemini de goremiyor (adet: %). '
      'Bu durumda 1. kontrol hicbir sey kanitlamaz.', v_adet;
  end if;

  -- 3) B'nin adı altında hiç satır görünmüyor
  select count(*) into v_adet from stock_item where tenant_id = v_b_kiraci;
  if v_adet <> 0 then
    raise exception 'IZOLASYON KIRIK: A oturumu B nin kiracisinda % satir goruyor.', v_adet;
  end if;

  -- 4) B'nin kullanıcısı OKUNAMAZ — müşteri listesi de veridir
  select count(*) into v_adet from app_user where id = v_b_kul;
  if v_adet <> 0 then
    raise exception 'IZOLASYON KIRIK: A oturumu B nin kullanicisini OKUYOR.';
  end if;

  -- 5) B'nin firması ve şubesi OKUNAMAZ
  select count(*) into v_adet from company where tenant_id = v_b_kiraci;
  if v_adet <> 0 then raise exception 'IZOLASYON KIRIK: A, B nin firmasini goruyor.'; end if;
  select count(*) into v_adet from branch where tenant_id = v_b_kiraci;
  if v_adet <> 0 then raise exception 'IZOLASYON KIRIK: A, B nin subesini goruyor.'; end if;

  -- 6) B'nin satırı GÜNCELLENEMEZ
  -- ⚠️ Burada hata beklenmiyor: RLS satırı görünmez yapar, güncelleme
  -- "0 satır etkilendi" ile sessizce geçer. Sınanan şey tam olarak bu —
  -- sessizce hiçbir şey yapmadığı.
  begin
    update stock_item set name = 'A tarafindan ele gecirildi' where id = v_b_stok;
    get diagnostics v_etkilenen = row_count;
    if v_etkilenen <> 0 then
      raise exception 'IZOLASYON KIRIK: A, B nin stok kalemini GUNCELLEDI (% satir).', v_etkilenen;
    end if;
  exception when insufficient_privilege then
    null;  -- guncelleme yetkisi hic yok
  end;

  -- 7) B'nin satırı SİLİNEMEZ
  --
  -- ⚠️ İKİ KABUL EDİLEBİLİR SONUÇ VAR ve ikisi de izolasyonun korunduğunu
  -- söyler:
  --   a) "0 satır etkilendi"  → RLS satırı görünmez yaptı
  --   b) "permission denied"  → GRANT hiç verilmemiş
  -- İlk yazdığımda yalnız (a)'yı bekliyordum ve prova (b) yüzünden
  -- kırmızıya düştü — oysa (b) DAHA SIKI bir koruma. Testin, korumanın
  -- hangi katmandan geldiğini şart koşması yanlıştı.
  begin
    delete from stock_item where id = v_b_stok;
    get diagnostics v_etkilenen = row_count;
    if v_etkilenen <> 0 then
      raise exception 'IZOLASYON KIRIK: A, B nin stok kalemini SILDI (% satir).', v_etkilenen;
    end if;
  exception when insufficient_privilege then
    null;  -- silme yetkisi hiç yok; kapı daha da kapalı
  end;

  -- 8) A, B'nin kiracısına satır YAZAMAZ
  -- Kendi oturumunda başka bir kiracının adına yazmak, izolasyonun
  -- diğer yönü. `with check` bunu reddetmeli.
  begin
    insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (v_b_kiraci, (select id from branch where tenant_id = v_b_kiraci limit 1),
            'A-SIZMA', 'a-sizma', 'A nin B ye yazdigi kalem', 'kg');
    raise exception 'IZOLASYON KIRIK: A, B nin kiracisina satir YAZDI.';
  exception
    when insufficient_privilege or check_violation then null;  -- beklenen
    when others then
      -- Şube alt sorgusu da RLS yüzünden boş dönebilir; o da geçerli bir
      -- engeldir (null branch_id → not null ihlali).
      if sqlstate not in ('23502', '42501', '23514') then raise; end if;
  end;

  -- 9) Platform tablosu: işletme sahibi başvuruları GÖREMEZ
  select count(*) into v_adet from business_application;
  if v_adet <> 0 then
    raise exception 'IZOLASYON KIRIK: isletme sahibi % basvuru goruyor. '
      'Basvurular MIYOP personelinin isidir.', v_adet;
  end if;

  raise notice 'A -> B yonu kapali: okuma, guncelleme, silme, yazma, basvurular.';
end $$;

reset role;

-- ── Ters yön: B oturumundan A ─────────────────────────────────────────────
-- Tek yönü sınamak yetmez: politika yanlış yazıldığında bir yön kapalı,
-- diğeri açık kalabilir.
select set_config('prova.uid',    current_setting('izo.b_auth'),   false);
select set_config('app.tenant_id', current_setting('izo.b_kiraci'), false);

set role authenticated;

do $$
declare
  v_adet int;
begin
  select count(*) into v_adet from stock_item where id = current_setting('izo.a_stok')::uuid;
  if v_adet <> 0 then
    raise exception 'IZOLASYON KIRIK (TERS YON): B oturumu A nin stok kalemini OKUYOR.';
  end if;

  select count(*) into v_adet from stock_item where id = current_setting('izo.b_stok')::uuid;
  if v_adet <> 1 then
    raise exception 'PROVA GECERSIZ: B kendi kalemini goremiyor.';
  end if;

  raise notice 'B -> A yonu de kapali.';
end $$;

reset role;

-- ── Oturumsuz (anon) yön ──────────────────────────────────────────────────
-- Müşteri verisine oturum AÇMADAN erişilemez. `anon` rolünün stok
-- tablosunda okuma yetkisi hiç olmamalı (0007).
select set_config('prova.uid', '', false);
select set_config('app.tenant_id', '', false);

do $$
declare
  v_yetki int;
begin
  select count(*) into v_yetki
    from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'
     and privilege_type = 'SELECT'
     and table_name in ('stock_item', 'stock_movement', 'app_user', 'company', 'branch');
  if v_yetki <> 0 then
    raise exception 'IZOLASYON KIRIK: anon rolu musteri tablolarinda % okuma yetkisine sahip.', v_yetki;
  end if;
  raise notice 'anon rolu musteri tablolarini okuyamiyor.';
end $$;

-- ── Temizlik: YAPILMIYOR, ve sebebi öğretici ──────────────────────────────
-- Önce deneme kiracılarını silmeye çalıştım. Olmadı, çünkü:
--   · `audit_log` şubeye yabancı anahtarla bağlı ve BİLEREK `cascade`
--     değil — bir şube silindiğinde orada ne olduğunun izi kaybolmamalı.
--   · Denetim kaydının kendisi de silinemiyor: `app.denetim_kaydi_degismez`
--     tetikleyicisi reddediyor (0027).
--
-- Yani bu prova, kendi temizliğini yapmaya çalışırken ürünün en sıkı
-- kurallarından birine çarptı. Tetikleyiciyi geçici kapatarak zorlayabilirdim
-- ama yapmadım: bir korumayı yalnız kendi rahatım için delmek, o korumaya
-- güvenilmez demektir.
--
-- Zaten gerekmiyor: `goc-prova.sh` her koşuda veritabanını sıfırdan kuruyor
-- (`drop database if exists miyop_prova`). Deneme kiracıları bir sonraki
-- koşuya taşınmıyor.

select 'IZOLASYON PROVASI' as ne, 'GECTI' as sonuc;
