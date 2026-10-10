-- ═══════════════════════════════════════════════════════════════════════════
-- 0072 · ALERJEN BEYANI TEK PARÇADA YAZILIYOR
-- ---------------------------------------------------------------------------
-- Üçüncü inceleme (Codex, 10.10). Bulgunun kendisi doğru ve adım adım
-- üretilebilir olduğunu görünce bu göç yazıldı.
--
-- ⚠️ ÜRETİLEBİLİR SENARYO — bunu okuyan herkes neyi düzelttiğimizi bilsin:
--   Mercimek çorbasında GLUTEN ve SÜT beyan edilmiş, kalem geçen ay
--   "incelendi" damgası almış. Kullanıcı beyanı düzenleyip Kaydet'e basıyor.
--   Tarayıcı üç ayrı istek atıyordu:  DELETE → INSERT → UPDATE(damga)
--   DELETE gidiyor, INSERT düşüyor (ağ koptu, sekme kapandı, oturum bitti).
--   Geriye kalan: SIFIR alerjen satırı + GEÇEN AYIN "incelendi" damgası.
--
--   Bundan sonrası sessiz: `app.mamul_alerjen_eksikleri` yalnız
--   `allergen_reviewed_at is null` kalemleri "incelenmemiş" sayıyor, damga
--   dolu olduğu için bu kalemi hiç söylemiyor. Etiket TASLAK bandını da
--   basmıyor ve üstüne şunu yazıyor:
--
--       "Bilinen alerjen içermez."
--
--   Glüten ve süt içeren bir ürün için, ambalaja yapıştırılabilir bir etiket.
--   Bu bir yazılım hatası değil, BİR SAĞLIK OLAYIDIR.
--
-- ⚠️ 0057 bu kuralı zaten yazmıştı — ama YAZIYA, veriye değil:
--     "Alerjen satırı olmaması 'alerjen yok' demek DEĞİLDİR." (0057:186)
--   Kural TypeScript'teydi, veritabanında değildi. 0063'ün kendi dersi:
--     "Kuralı yazının yanına koyma, VERİNİN yanına koy."
--
-- NE YAZILMADI, BİLEREK:
-- ⚠️ "Damga dolu + satır yok" hali YASAKLANMADI. O hal GEÇERLİ ve gerekli:
--   "baktım, bu üründe alerjen yok" demenin tek yolu bu. Yasaklasaydık
--   alerjensiz ürün hiç damgalanamazdı. Sorun halin kendisi değil, o hale
--   KAZAYLA düşülmesiydi. Düzeltilen şey atomiklik.
-- ⚠️ Yeni bir İZİN KODU eklenmedi. Bugün bu beyanı kim yazabiliyorsa yarın da
--   o yazabilecek — demo öncesi sessizce kapı kapatmak, çalışan bir akışı
--   kırmaktır. Hangi rolün yazması gerektiği AYRI bir karar, Emrah'a sorulacak.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · ATOMİK YAZMA KAPISI ───────────────────────────────────────────────
-- ⚠️ Üç yazım TEK fonksiyon gövdesinde = tek işlem. Ortasında ne olursa olsun
-- ya hepsi yazılır ya hiçbiri. Tarayıcıdan işlem (transaction) açamıyoruz;
-- bu yüzden işlemi sunucuya taşıdık.
--
-- ⚠️ `security definer`: doğrudan tablo yazma yetkisini aşağıda GERİ ALIYORUZ
-- (bölüm 3), yani çağıranın artık o yetkisi yok. Kiracı duvarını bu yüzden
-- RLS'e bırakamıyoruz, BURADA kendimiz kuruyoruz — 0063'teki portal kapısının
-- aynısı. ⚠️ TUZAK 44: `search_path = ''`, içerideki HER ad nitelikli.
create or replace function public.alerjen_beyani_yaz(
  p_kalem    uuid,
  p_satirlar jsonb default '[]'::jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant       uuid := app.current_tenant_id();
  v_kullanici    uuid;
  v_kalem_tenant uuid;
  v_damga        timestamptz := now();
  v_satir        jsonb;
  v_kod          text;
  v_tur          text;
begin
  if v_tenant is null then
    raise exception 'Oturumda işletme bilgisi yok; alerjen beyanı yazılamaz.'
      using errcode = 'MI403';
  end if;

  -- Damgayı ATAN kişi kayda geçiyor. "Kim incelemiş" sorusunun cevabı bu.
  select u.id into v_kullanici
    from public.app_user u
   where u.auth_user_id = auth.uid()
     and u.tenant_id    = v_tenant
     and u.is_active;
  if v_kullanici is null then
    raise exception 'Bu işlemi yapan kullanıcı bulunamadı veya pasif.'
      using errcode = 'MI403';
  end if;

  select si.tenant_id into v_kalem_tenant
    from public.stock_item si where si.id = p_kalem;
  if v_kalem_tenant is null then
    raise exception 'Stok kalemi bulunamadı.' using errcode = 'MI404';
  end if;
  -- ⚠️ KİRACI DUVARI. `definer` olduğumuz için RLS bizi korumuyor.
  if v_kalem_tenant <> v_tenant then
    raise exception 'Stok kalemi bu işletmeye ait değil.' using errcode = 'MI424';
  end if;

  if jsonb_typeof(p_satirlar) <> 'array' then
    raise exception 'Alerjen listesi bir dizi olmalı.' using errcode = 'MI400';
  end if;

  -- Aynı alerjen hem "içerir" hem "iz" olamaz; hangisinin basılacağı belirsiz
  -- kalır. Aynı kural ekranda da var; ikisi birden duruyor çünkü ekran
  -- atlanabilir, veritabanı atlanamaz.
  if (select count(distinct (s.e ->> 'kod'))
        from jsonb_array_elements(p_satirlar) as s(e))
     <> jsonb_array_length(p_satirlar) then
    raise exception 'Aynı alerjen iki kez işaretlenmiş.' using errcode = 'MI409';
  end if;

  -- ⚠️ Damga koruması (bölüm 2) bu bayrağa bakıyor. İşlem sonunda kendiliğinden
  -- düşüyor: `set_config(..., true)` işlem yereldir.
  perform set_config('app.alerjen_beyani_yaziliyor', '1', true);

  delete from public.stock_item_allergen where stock_item_id = p_kalem;

  for v_satir in select s.e from jsonb_array_elements(p_satirlar) as s(e) loop
    v_kod := upper(btrim(coalesce(v_satir ->> 'kod', '')));
    v_tur := coalesce(nullif(btrim(coalesce(v_satir ->> 'tur', '')), ''), 'İÇERİR');

    if v_kod = '' then
      raise exception 'Alerjen kodu boş olamaz.' using errcode = 'MI400';
    end if;
    if not exists (select 1 from public.allergen a where a.code = v_kod) then
      raise exception 'Tanınmayan alerjen kodu: %. Listeden seçilmeli.', v_kod
        using errcode = 'MI400';
    end if;
    if v_tur not in ('İÇERİR', 'İZ') then
      raise exception 'Alerjen türü "İÇERİR" veya "İZ" olmalı (gelen: %).', v_tur
        using errcode = 'MI400';
    end if;

    insert into public.stock_item_allergen
      (tenant_id, stock_item_id, allergen_code, kind, note)
    values
      (v_tenant, p_kalem, v_kod, v_tur,
       nullif(btrim(coalesce(v_satir ->> 'not', '')), ''));
  end loop;

  -- ⚠️ KAYDETMEK = İNCELEMEK. Boş liste de bir beyandır: "baktım, yok".
  update public.stock_item
     set allergen_reviewed_at = v_damga,
         allergen_reviewed_by = v_kullanici
   where id = p_kalem;

  perform set_config('app.alerjen_beyani_yaziliyor', '', true);
  return v_damga;
end;
$$;

comment on function public.alerjen_beyani_yaz(uuid, jsonb) is
  'Bir stok kaleminin alerjen beyanını TEK İŞLEMDE yeniden yazar: eski '
  'satırları siler, yenilerini ekler ve "incelendi" damgasını atar. Yarım '
  'kalmaz. p_satirlar: [{"kod":"GLUTEN","tur":"İÇERİR","not":null}]. '
  'Döndürdüğü değer yeni damga zamanıdır. Hatalar: MI400 geçersiz girdi, '
  'MI403 oturum/kullanıcı, MI404 kalem yok, MI409 aynı alerjen iki kez, '
  'MI424 başka işletmenin kalemi.';

revoke all     on function public.alerjen_beyani_yaz(uuid, jsonb) from public;
revoke all     on function public.alerjen_beyani_yaz(uuid, jsonb) from anon;
grant  execute on function public.alerjen_beyani_yaz(uuid, jsonb)
  to authenticated, service_role;


-- ── 2 · DAMGA ELLE DEĞİŞTİRİLEMEZ ─────────────────────────────────────────
-- ⚠️ Atomik kapıyı yazmak yetmez; damga sütunları `stock_item` üzerinde ve
-- o tabloya herkes yazabiliyor. Kapıyı yapıp yan pencereyi açık bırakmak
-- kapı yapmamaktır (0066'daki donmuş alan korumasının aynısı).
create or replace function app.alerjen_damgasi_korumasi()
returns trigger
language plpgsql
as $$
begin
  if (new.allergen_reviewed_at is distinct from old.allergen_reviewed_at
      or new.allergen_reviewed_by is distinct from old.allergen_reviewed_by)
     and coalesce(current_setting('app.alerjen_beyani_yaziliyor', true), '') <> '1'
  then
    raise exception
      'Alerjen "incelendi" damgası elle değiştirilemez. Beyanı kaydedin; '
      'damga o işlemin parçası olarak atanır.'
      using errcode = 'MI436';
  end if;
  return new;
end;
$$;

drop trigger if exists stock_item_alerjen_damgasi on public.stock_item;
create trigger stock_item_alerjen_damgasi
  before update on public.stock_item
  for each row execute function app.alerjen_damgasi_korumasi();


-- ── 3 · DOĞRUDAN YAZMA KAPATILIYOR ────────────────────────────────────────
-- ⚠️ 0057 `insert, update, delete` yetkisini doğrudan vermişti. O yetki
-- açık kaldıkça atomik kapının yanından dolaşılabilir ve aynı yarım hal
-- yeniden üretilebilir. OKUMA açık kalıyor: ekran listeyi okuyor.
revoke insert, update, delete on public.stock_item_allergen from authenticated;


-- ── 4 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare v_say int;
begin
  if to_regprocedure('public.alerjen_beyani_yaz(uuid, jsonb)') is null then
    raise exception '0072: alerjen_beyani_yaz oluşmadı.';
  end if;

  if has_function_privilege('anon', 'public.alerjen_beyani_yaz(uuid, jsonb)', 'execute') then
    raise exception '0072: fonksiyon anon''a açık.';
  end if;

  -- ⚠️ PostgreSQL'de fonksiyonların VARSAYILANI `PUBLIC EXECUTE`tir; yalnız
  -- anon'dan almak kapıyı kapatmaz (0070'in dersi). PUBLIC'in grantee kimliği
  -- 0'dır.
  if exists (
    select 1
      from pg_proc p, aclexplode(p.proacl) a
     where p.oid = to_regprocedure('public.alerjen_beyani_yaz(uuid, jsonb)')
       and a.grantee = 0
       and a.privilege_type = 'EXECUTE'
  ) then
    raise exception '0072: PUBLIC EXECUTE açık kalmış.';
  end if;

  if has_table_privilege('authenticated', 'public.stock_item_allergen', 'insert')
     or has_table_privilege('authenticated', 'public.stock_item_allergen', 'update')
     or has_table_privilege('authenticated', 'public.stock_item_allergen', 'delete') then
    raise exception '0072: doğrudan yazma yetkisi hâlâ açık — atomik kapı dolanılabilir.';
  end if;

  if not has_table_privilege('authenticated', 'public.stock_item_allergen', 'select') then
    raise exception '0072: okuma yetkisi de kapanmış — ekran listeyi göremez.';
  end if;

  if not exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.stock_item'::regclass
       and t.tgname = 'stock_item_alerjen_damgasi'
       and not t.tgisinternal
  ) then
    raise exception '0072: damga koruma tetiği yok.';
  end if;

  -- Veri seviyesinde bugünkü durumu RAPORLA (düzeltme değil, uyarı):
  -- damgası dolu ama hiç alerjen satırı olmayan kalemler. Çoğu meşru
  -- ("baktım, yok"), ama yarım kalmış bir yazımın izi de burada görünür.
  select count(*) into v_say
    from public.stock_item si
   where si.allergen_reviewed_at is not null
     and not exists (select 1 from public.stock_item_allergen a
                      where a.stock_item_id = si.id);
  raise notice '0072 BİLGİ · damgalı ama alerjen satırı olmayan kalem: %. '
    'Bu hal GEÇERLİDİR ("baktım, alerjen yok"). Yine de gıda mühendisiyle '
    'bir kez gözden geçirilmeli.', v_say;

  raise notice '0072 TAMAM · alerjen beyanı tek işlemde yazılıyor; damga elle değiştirilemiyor';
end;
$$;
