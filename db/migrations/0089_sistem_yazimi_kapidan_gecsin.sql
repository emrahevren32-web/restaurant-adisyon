-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0089 · KENDİ KIRDIĞIM İKİ AKIŞ · MIYOP-038 ve MIYOP-039
--
-- 0088'de 27 tabloya iş izni kapısı koydum. Codex denetimi iki meşru akışın
-- kırıldığını buldu; ikisini de yerel PostgreSQL'de ürettim:
--
--   MIYOP-039 · MÜŞTERİ PORTALI. `public.portal_siparis_ver` dört gatelı
--     tabloya yazıyor (sales_order, revision, line, portal_user). Portal
--     müşterisinin `app_user` kaydı YOKTUR — rolü, izni yoktur. Kapı
--     MI403 veriyor. **Portaldan sipariş verilemiyordu.**
--
--   MIYOP-038 · SEVKİYAT SİPARİŞİ İLERLETİYOR. `app.sevkiyat_siparisi_ilerlet`
--     sevkiyat SHIPPED olunca siparişin durumunu günceller. Sevkiyat
--     sorumlusunda `logistics.write` var, `operations.write` YOK. Kapı
--     MI403 veriyor. **Sevkiyat sevk edilemiyordu.**
--
-- ── KÖK NEDEN ────────────────────────────────────────────────────────────
-- Kapı şunu soruyor: "bu satırı yazan kişinin izni var mı?" Ama bazı
-- yazımları KİŞİ yazmaz, SİSTEM yazar — kişinin zaten izinli olduğu
-- BAŞKA bir işlemin sonucu olarak. Sevkiyatçı sevkiyatı sevk etme iznine
-- sahiptir; siparişin durumunun ilerlemesi onun kararı değil, o kararın
-- sonucudur. Portal müşterisi sipariş verme hakkına sahiptir; o hakkı
-- veren `portal_siparis_ver`in kendi kontrolleridir (portal üyeliği,
-- nokta izni, sözleşmeli fiyat), kiracının iç rol tablosu değil.
--
-- ── ÇÖZÜM: "İSTEMCİDEN Mİ GELDİ" DİYE SOR ────────────────────────────────
-- PostgREST'ten gelen doğrudan yazımda `current_user` = `authenticated`
-- (ya da `anon`). Bizim `security definer` rutinlerimizin İÇİNDE
-- `current_user` o rutinin sahibidir (`postgres`). Yani tek bir soru iki
-- durumu ayırıyor:
--
--   current_user in ('anon','authenticated')  → istemci DOĞRUDAN yazıyor,
--                                               kapı sorulur
--   aksi hâlde                                → yazım bizim rutinimizin
--                                               içinden geliyor, kapı
--                                               rutinin kendi kontrolüdür
--
-- Bu, `app.bakim_baglami()`nin (oturum YOK **ve** rol istemci rolü değil)
-- gevşetilmiş hâlidir: oturum şartı kalkıyor.
--
-- ⚠️ BEDELİ AÇIK YAZIYORUM: bundan sonra `authenticated`a açık her
-- `security definer` fonksiyon, yazma kapılarının DIŞINDADIR. Güvenlik
-- artık o fonksiyonların kendi kontrollerine bağlıdır. Bu yüzden bu göç
-- o kümeyi SAYIYOR ve ADLARIYLA donduruyor (bölüm 3). Listeye yeni bir
-- ad eklenirse göç ve mimari test KIRMIZI olur; kimse sessizce bir kapı
-- deliği açamaz.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · YENİ SORU ─────────────────────────────────────────────────────────
create or replace function app.kapi_disi_baglam()
returns boolean
language sql
stable
set search_path = ''
as $$
  -- `anon` ve `authenticated` PostgREST'in istemci rolleridir. Başka her
  -- rol ya göç/yedek/service_role'dür ya da bizim `security definer`
  -- rutinimizin içidir.
  select current_user not in ('anon', 'authenticated');
$$;

comment on function app.kapi_disi_baglam() is
  'Bu yazim istemciden DOGRUDAN gelmiyor mu? Gocte, yedekte, service_role '
  'ile ya da bizim security definer rutinimizin icinde true doner. '
  '0089: MIYOP-038 ve MIYOP-039 bu ayrim olmadigi icin kirilmisti.';

revoke all on function app.kapi_disi_baglam() from public;
revoke all on function app.kapi_disi_baglam() from anon;
-- ⚠️ Kapı fonksiyonları `security definer` DEĞİLDİR: çağıran rolün bu
-- soruyu sorabilmesi gerekir. `app.bakim_baglami()` ile aynı haklar.
-- (Bu satır unutulunca kapı "permission denied" ile patlıyor ve yazma
-- 42501 veriyor — MI403 değil. Yanlış sebeple reddedilen bir yazım,
-- kapı çalışıyor sanılır.)
grant execute on function app.kapi_disi_baglam() to authenticated, service_role;


-- ── 2 · ON KAPIYI AYNI SORUYA BAĞLA ───────────────────────────────────────
-- Metin değiştirme ile yapılıyor: on fonksiyonu elden yeniden yazmak on
-- kopyala-yapıştır hatası fırsatıdır ve 0086'nın onardığı ince kuralları
-- (tuzak 79'un jsonb farkı gibi) kaybetme riski taşır.
do $$
declare
  v_kapilar constant text[] := array[
    'app.izin_gerek()', 'app.izin_gerek_coklu()', 'app.stok_hareketi_izni()',
    'app.stok_karti_izni()', 'app.lot_izni()', 'app.kullanici_satiri_izni()',
    'app.onay_karari_izni()', 'app.ambalaj_beyani_izni()',
    'app.haccp_olcum_izni()', 'app.haccp_faaliyet_izni()'
  ];
  v_ad     text;
  v_tanim  text;
  v_yeni   text;
  v_sayac  int := 0;
begin
  foreach v_ad in array v_kapilar loop
    if to_regprocedure(v_ad) is null then
      raise exception '0089: % kapisi yok. Esleme bayatlamis.', v_ad;
    end if;

    v_tanim := pg_get_functiondef(to_regprocedure(v_ad));

    if position('app.bakim_baglami()' in v_tanim) = 0 then
      raise exception
        '0089: % icinde `app.bakim_baglami()` bulunamadi. Kapi elle '
        'degistirilmis; once okunup elle duzeltilmeli.', v_ad;
    end if;

    v_yeni := replace(v_tanim, 'app.bakim_baglami()', 'app.kapi_disi_baglam()');
    execute v_yeni;
    v_sayac := v_sayac + 1;
  end loop;

  if v_sayac <> 10 then
    raise exception '0089: 10 kapi bekleniyordu, % degisti.', v_sayac;
  end if;
  raise notice '0089: % kapi `kapi_disi_baglam` sorusuna baglandi.', v_sayac;
end $$;

-- ⚠️ `app.bakim_baglami()` SİLİNMİYOR. 0082'nin kararı ve gerekçesi
-- geçerli; başka çağıranları olabilir ve "oturum yok" sorusu hâlâ anlamlı
-- bir sorudur. Yalnız KAPILAR daha geniş soruya bağlandı.


-- ── 3 · MUAFİYET YÜZEYİ SAYILIYOR VE ADLARIYLA DONDURULUYOR ───────────────
-- Bölüm 1'in bedeli burada ölçülüyor: `authenticated`a açık, kapılı bir
-- tabloya yazan `security definer` fonksiyonlar. Bunların her biri kendi
-- yetki kontrolünü yapmak ZORUNDADIR.
do $$
declare
  v_beklenen constant text[] := array[
    'app.basvuruyu_onayla',              -- basvuru onayi: platform yetkisi sorar
    'app.lisans_olayi_yaz',              -- lisans defteri, append-only
    'app.lisansi_uzat',                  -- platform sahibi kapisi icinde
    'app.personel_hesabi_ac',            -- users.manage sorar
    'app.personel_sifresi_sifirlandi',   -- kendi hesabi
    'app.sifremi_belirledim',            -- kendi hesabi
    'public.alerjen_beyani_yaz',         -- quality.declaration sorar (0072)
    'public.portal_siparis_guncelle',    -- portal uyeligi + nokta izni sorar
    'public.portal_siparis_ver',         -- portal uyeligi + nokta izni + fiyat
    'public.set_negative_stock_policy',  -- settings.manage sorar
    'public.set_primary_role'            -- roles.manage sorar
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
        select distinct c.relname, c.oid
          from pg_trigger t join pg_class c on c.oid = t.tgrelid
         where not t.tgisinternal
           and (t.tgname like 'izin\_%' or t.tgname like '%degismez%')
      ) k on p.prosrc ~* ('(insert into|update|delete from)[[:space:]]+(public\.)?'
                          || k.relname || '[[:space:](]')
     where p.prosecdef
       and pg_get_function_result(p.oid) <> 'trigger'
       and has_function_privilege('authenticated', p.oid, 'execute')
  ) s;

  select coalesce(array_agg(x), '{}') into v_fazla
    from unnest(v_bulunan) x where x <> all (v_beklenen);
  select coalesce(array_agg(x), '{}') into v_eksik
    from unnest(v_beklenen) x where x <> all (v_bulunan);

  if array_length(v_fazla, 1) is not null then
    raise exception
      '0089: kapi disinda YENI fonksiyon(lar) var: %. Her biri kendi yetki '
      'kontrolunu yapmali ve bu listeye GEREKCESIYLE eklenmeli.',
      array_to_string(v_fazla, ', ');
  end if;

  if array_length(v_eksik, 1) is not null then
    raise notice
      '0089: listede olup artik bulunmayanlar: % (kaldirilmis olabilir)',
      array_to_string(v_eksik, ', ');
  end if;

  raise notice '0089: muafiyet yuzeyi % fonksiyon, hepsi listede.',
    coalesce(array_length(v_bulunan, 1), 0);
end $$;


-- ── 4 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare v_ad text; v_tanim text;
begin
  if to_regprocedure('app.kapi_disi_baglam()') is null then
    raise exception '0089: app.kapi_disi_baglam olusmadi.';
  end if;

  -- Hicbir kapida eski soru KALMAMALI
  foreach v_ad in array array[
    'app.izin_gerek()', 'app.izin_gerek_coklu()', 'app.stok_hareketi_izni()',
    'app.stok_karti_izni()', 'app.lot_izni()', 'app.kullanici_satiri_izni()',
    'app.onay_karari_izni()', 'app.ambalaj_beyani_izni()',
    'app.haccp_olcum_izni()', 'app.haccp_faaliyet_izni()'
  ] loop
    v_tanim := pg_get_functiondef(to_regprocedure(v_ad));
    if position('app.bakim_baglami()' in v_tanim) > 0 then
      raise exception '0089: % hala eski soruya bagli.', v_ad;
    end if;
    if position('app.kapi_disi_baglam()' in v_tanim) = 0 then
      raise exception '0089: % yeni soruya baglanmamis.', v_ad;
    end if;
  end loop;

  -- 0086'nin ince kurali metin degistirmede kaybolmamali (tuzak 79)
  if position('(to_jsonb(new) - v_beyan) = (to_jsonb(old) - v_beyan)'
              in pg_get_functiondef(to_regprocedure('app.stok_karti_izni()'))) = 0 then
    raise exception '0089: stok karti kapisinin jsonb farki kayboldu.';
  end if;
  -- 0088'in MIYOP-035 kontrolu de durmali
  if position('MI436' in pg_get_functiondef(to_regprocedure('app.stok_karti_izni()'))) = 0 then
    raise exception '0089: MIYOP-035 kontrolu kayboldu.';
  end if;
  -- 0088'in argumansiz tetik korumasi da
  if position('tg_nargs = 0' in pg_get_functiondef(to_regprocedure('app.izin_gerek_coklu()'))) = 0 then
    raise exception '0089: izin_gerek_coklu argüman kontrolu kayboldu.';
  end if;

  if not has_function_privilege('authenticated', 'app.kapi_disi_baglam()', 'execute') then
    raise exception '0089: `authenticated` kapi_disi_baglam''i cagiramiyor; '
      'kapilar MI403 yerine 42501 verir.';
  end if;

  -- PUBLIC kapisi (tuzak 67 + 80)
  if exists (
    select 1 from pg_proc p,
      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
     where p.oid = to_regprocedure('app.kapi_disi_baglam()')
       and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception '0089: kapi_disi_baglam uzerinde PUBLIC EXECUTE acik.';
  end if;

  raise notice '0089 tamam: MIYOP-038 ve MIYOP-039 kapandi, 10 kapi tek soruya bagli.';
end $$;
