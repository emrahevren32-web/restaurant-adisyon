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
