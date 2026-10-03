-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · KABUL TESTİ — İKİ MÜŞTERİ YALITIMI (A4C madde 12)
-- ═══════════════════════════════════════════════════════════════════════════
-- Yol haritası: "B müşterisi, A'nın siparişini hiçbir yoldan göremiyor"
--
-- ⚠️ BU BİR GÖÇ DEĞİLDİR. `db/migrations` altında DEĞİL ve olmamalı:
-- oturum taklit ediyor ve kendi verisini yazıyor.
--
-- ── NASIL ÇALIŞTIRILIR ────────────────────────────────────────────────────
-- Supabase SQL editöründe olduğu gibi çalıştırın. Hazırlık GEREKMİYOR:
-- test, şubesi olan işletmeyi kendisi buluyor. Birden çok işletme varsa
-- hangisinde çalışacağını SORUYOR — yanlış işletmede test verisi yazmak,
-- doğru işletmede test etmemekten kötüdür.
--
-- ⚠️ SONUNDA BİR HATA GÖRECEKSİNİZ VE BU BEKLENEN DAVRANIŞTIR:
--
--      KABUL TESTİ GEÇTİ ✅ — bu bir hata değildir.
--
-- Test kendi verisini yazıyor; o veriyi silemeyiz çünkü sipariş defteri
-- EKLEMELİ (MI403). Tek temiz çıkış yolu işlemi geri almaktır ve PostgreSQL'de
-- bunun yolu hata fırlatmaktır. Mesaj "GEÇTİ" diyorsa yalıtım çalışıyor;
-- "BAŞARISIZ" diyorsa çalışmıyor.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_t uuid; v_b uuid;
  v_a uuid; v_c uuid;          -- müşteri A (Migros), müşteri C (Carrefour)
  v_na uuid; v_nc uuid;        -- noktaları
  v_k uuid;                    -- ortak ürün
  v_pa uuid; v_pc uuid;        -- portal kullanıcıları
  v_no text;
  v_say int;
  v_eski text;       -- oturumun önceki JWT iddiaları
  v_bilgi text;      -- işletme kodu / liste
begin
  -- ── İŞLETMEYİ KENDİSİ BULUYOR ───────────────────────────────────────────
  -- SQL editöründe oturumun tenant iddiası yok. Kullanıcıdan kimlik
  -- yapıştırmasını istemek, testi çalıştırmayı zorlaştırırdı: çalıştırılmayan
  -- bir kabul testi, olmayan bir kabul testidir.
  v_t := app.current_tenant_id();

  if v_t is null then
    -- Platform kiracısı (MİYOP'un kendisi) aday değil; müşteri kartı ve
    -- portal orada anlam taşımıyor. Şubesi olan İŞLETME kiracıları aranıyor.
    select count(*) into v_say
      from public.tenant t
     where not t.is_platform
       and exists (select 1 from public.branch b where b.tenant_id = t.id);

    if v_say = 0 then
      raise exception 'KABUL TESTİ ÇALIŞTIRILAMADI: şubesi olan bir işletme yok. '
                      'Önce bir işletme kurulmalı.';
    end if;

    if v_say > 1 then
      -- Birden çok işletme varsa SEÇMİYORUZ: yanlış işletmede test verisi
      -- yazmak, doğru işletmede test etmemekten kötüdür.
      -- Hangisi olduğunu kolay seçebilmek için MÜŞTERİ SAYISI da yazılıyor:
      -- kurulum sırasında doğmuş boş kiracılarla gerçek işletme ancak böyle
      -- ayırt edilir. Kodu okuyup tahmin ettirmek, yanlış seçime davettir.
      select string_agg(
               t.code || '  (' || t.musteri || ' müşteri)  = ' || t.id::text,
               E'\n       ' order by t.musteri desc, t.code)
        into v_bilgi
        from (
          select t2.id, t2.code,
                 (select count(*) from public.customer c where c.tenant_id = t2.id) as musteri
            from public.tenant t2
           where not t2.is_platform
             and exists (select 1 from public.branch b where b.tenant_id = t2.id)
        ) t;
      raise exception E'KABUL TESTİ ÇALIŞTIRILAMADI: % işletme var, hangisi belirsiz.\nŞu satırı testin ÜSTÜNE ekleyip tekrar çalıştırın:\n\n  select set_config(''app.tenant_id'', ''<kimlik>'', true);\n\nİşletmeler:\n       %', v_say, v_bilgi;
    end if;

    select t.id into v_t
      from public.tenant t
     where not t.is_platform
       and exists (select 1 from public.branch b where b.tenant_id = t.id)
     limit 1;
    perform set_config('app.tenant_id', v_t::text, true);
  end if;

  select code into v_bilgi from public.tenant where id = v_t;
  raise notice 'Kabul testi şu işletmede çalışıyor: % (%)', v_bilgi, v_t;

  select id into v_b from public.branch where tenant_id = v_t order by created_at limit 1;
  if v_b is null then
    raise exception 'KABUL TESTİ ÇALIŞTIRILAMADI: bu işletmenin şubesi yok.';
  end if;

  v_eski := coalesce(current_setting('request.jwt.claims', true), '');

  -- ── Kurulum ─────────────────────────────────────────────────────────────
  insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (v_t, v_b, 'KABUL-URUN', 'kabul-urun', 'Kabul testi ürünü', 'koli')
    returning id into v_k;

  insert into public.customer (tenant_id, code, code_key, name)
    values (v_t, 'KABUL-A', 'kabul-a', 'Kabul A') returning id into v_a;
  insert into public.customer (tenant_id, code, code_key, name)
    values (v_t, 'KABUL-C', 'kabul-c', 'Kabul C') returning id into v_c;

  insert into public.delivery_point (tenant_id, customer_id, code, code_key, name)
    values (v_t, v_a, 'KA1', 'ka1', 'Kabul A noktası') returning id into v_na;
  insert into public.delivery_point (tenant_id, customer_id, code, code_key, name)
    values (v_t, v_c, 'KC1', 'kc1', 'Kabul C noktası') returning id into v_nc;

  insert into public.customer_price (tenant_id, customer_id, stock_item_id, unit_price, uom_code)
    values (v_t, v_a, v_k, 100, 'koli'), (v_t, v_c, v_k, 100, 'koli');

  insert into public.portal_user (tenant_id, customer_id, email, full_name)
    values (v_t, v_a, 'kabul-a@miyop.test', 'Kabul A') returning id into v_pa;
  insert into public.portal_user (tenant_id, customer_id, email, full_name)
    values (v_t, v_c, 'kabul-c@miyop.test', 'Kabul C') returning id into v_pc;

  -- ── ⚠️ GERÇEK BİR PORTAL OTURUMU TAKLİT EDİLİYOR ────────────────────────
  -- İki ayar birlikte değişmezse bu test YALAN SÖYLER:
  --   · `role`          → Supabase SQL editörü `postgres` ile çalışır ve
  --                       süper kullanıcı RLS'i BAŞTAN ATLAR. `authenticated`
  --                       rolüne geçmezsek 5. adım her zaman "sızdırıyor" der.
  --   · `app.tenant_id` → `app.current_tenant_id()` bu ayarı da okuyor
  --                       (0001). Temizlemezsek portal oturumu kendini
  --                       işletmenin içinde sanır ve RLS onu geçirir.
  perform set_config('app.tenant_id', '', true);
  perform set_config('role', 'authenticated', true);

  -- ── A müşterisi sipariş veriyor ─────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"email":"kabul-a@miyop.test"}', true);
  v_no := public.portal_siparis_ver(
    v_na,
    jsonb_build_array(jsonb_build_object('kalem_id', v_k, 'miktar', 10, 'birim', 'koli')));
  raise notice 'A müşterisi sipariş verdi: %', v_no;

  select count(*) into v_say from public.portal_siparislerim() where siparis_no = v_no;
  if v_say <> 1 then
    raise exception 'KABUL TESTİ BAŞARISIZ: A kendi siparişini GÖREMİYOR.';
  end if;

  -- ── C müşterisi A'nın siparişini HİÇBİR YOLDAN görememeli ───────────────
  perform set_config('request.jwt.claims', '{"email":"kabul-c@miyop.test"}', true);

  -- 1) Sipariş listesi
  select count(*) into v_say from public.portal_siparislerim() where siparis_no = v_no;
  if v_say <> 0 then
    raise exception 'KABUL TESTİ BAŞARISIZ: C, A''nın siparişini LİSTEDE görüyor.';
  end if;

  -- 2) Sipariş numarasını BİLEREK satır dökümü istemek
  select count(*) into v_say from public.portal_siparis_satirlarim(v_no);
  if v_say <> 0 then
    raise exception 'KABUL TESTİ BAŞARISIZ: C, numarayı bilerek A''nın SATIRLARINI okuyor.';
  end if;

  -- 3) A'nın teslim noktası
  if exists (select 1 from public.portal_noktalarim() where nokta_id = v_na) then
    raise exception 'KABUL TESTİ BAŞARISIZ: C, A''nın teslim noktasını görüyor.';
  end if;

  -- 4) A'nın noktasına sipariş yazmayı denemek
  begin
    perform public.portal_siparis_ver(
      v_na, jsonb_build_array(jsonb_build_object('kalem_id', v_k, 'miktar', 1, 'birim', 'koli')));
    raise exception 'KABUL TESTİ BAŞARISIZ: C, A''nın noktasına SİPARİŞ YAZDI.';
  exception
    when sqlstate 'MI431' then null;
    when others then
      if sqlstate = 'MI431' then null;
      else raise exception 'KABUL TESTİ BAŞARISIZ: beklenmeyen hata (%): %', sqlstate, sqlerrm;
      end if;
  end;

  -- 5) Tabloya DOĞRUDAN bakmayı denemek. Portal kullanıcısının oturumunda
  --    tenant iddiası yok; RLS her satırı reddetmeli.
  select count(*) into v_say from public.sales_order where order_no = v_no;
  if v_say <> 0 then
    raise exception 'KABUL TESTİ BAŞARISIZ: portal oturumu sales_order tablosunu OKUYOR '
                    '(bulunan satır: %). Bu, RLS''in değil arayüzün koruduğu anlamına gelir.', v_say;
  end if;

  perform set_config('role', 'none', true);
  perform set_config('app.tenant_id', v_t::text, true);
  perform set_config('request.jwt.claims', v_eski, true);

  raise notice '✅ 1/5 A kendi siparişini görüyor';
  raise notice '✅ 2/5 C, listede göremiyor';
  raise notice '✅ 3/5 C, numarayı bilerek satırları okuyamıyor';
  raise notice '✅ 4/5 C, A''nın noktasını göremiyor ve oraya yazamıyor';
  raise notice '✅ 5/5 Portal oturumu tabloyu doğrudan okuyamıyor';

  -- Tek temiz çıkış: işlemi geri al. Sebebi başlıkta yazılı.
  raise exception 'KABUL TESTİ GEÇTİ ✅ — bu bir hata değildir; test verisi bilerek geri alındı.';
end;
$$;
