-- ═══════════════════════════════════════════════════════════════════════════
-- 0082 · 0081'İN AÇIK BIRAKTIĞI DELİKLER
-- ---------------------------------------------------------------------------
-- 0081, düzeltici faaliyeti kapatmayı `quality.record.manage` iznine bağladı.
-- Codex denetimi (15.10.2026) kapının YANINDAN dolaşan dört yol buldu. Dördü
-- de gerçek, dördü de benim gözümden kaçmıştı.
--
--   1. `OPEN → CANCELLED` GEÇİYORDU. Dar izin yalnız `COMPLETED`e geçişi
--      istiyordu. Oysa iptal de faaliyeti açık listeden düşürüyor — yani
--      sapmayı ortadan kaldırmanın ikinci yolu açıktı. Kapanışı kilitleyip
--      iptali açık bırakmak, ön kapıyı kilitleyip arka kapıyı açık
--      bırakmaktır.
--
--   2. KAPANMIŞ KAYIT SONRADAN DEĞİŞTİRİLEBİLİYORDU. `completed_by` imzası
--      yalnız KAPANIŞ ANINDA yazılıyordu; sonraki her UPDATE geniş izinle
--      geçiyordu. Yani `quality.write` sahibi biri, kapanmış bir faaliyetin
--      "ne yapıldı" metnini değiştirebiliyor, hatta `completed_by`yi
--      NULL yapıp imzayı silebiliyordu. **Sonradan silinebilen bir imza,
--      imza değildir.**
--
--   3. `COMPLETED → OPEN` GERİ ALINABİLİYORDU. Hedef durum `COMPLETED`
--      olmadığı için dar izin koşulu hiç oluşmuyordu. Kapanmış bir kaydı
--      açmak da kalite kararıdır.
--
--   4. `measurement_id` TAŞINABİLİYORDU. Faaliyet, başka bir ölçüme
--      bağlanabiliyordu. Sapma ile ona karşı yapılan iş arasındaki bağ,
--      bu tablonun tek varlık sebebi.
--
-- ── DÜZELTİLEN KURAL ──────────────────────────────────────────────────────
-- Artık KAPANMIŞ ya da İPTAL EDİLMİŞ bir satıra DOKUNMAK dar izin istiyor —
-- hangi kolonu değiştirdiğine bakılmaksızın. Tek tek kolon saymak yerine
-- durumu temel almak, bir sonraki kolonun da kendiliğinden kapsanmasını
-- sağlıyor. (Kolon sayarak yazsaydım, yarın eklenen bir kolon sessizce
-- açıkta kalırdı — 0081'de tam bu oldu.)
--
-- ⚠️ `completed_by` ARTIK İSTEMCİDEN HİÇ ALINMIYOR. Kapanış anında
-- `auth.uid()`den yazılıyor, diğer her güncellemede ESKİ DEĞER zorla
-- korunuyor. 0081'de "istemci gönderse de üstüne yazılır" diyordum; doğruydu
-- ama yalnız kapanış anı için. Şimdi her an için.
--
-- ── AYRICA · ÜÇ SERTLEŞTİRME ──────────────────────────────────────────────
-- 5. `app.izin_gerek()` ve üç tetik kardeşinde REVOKE YOKTU; PostgreSQL
--    varsayılanı `PUBLIC EXECUTE` olduğu için açık kaldılar (tuzak 67'nin
--    aynısı). Tetik fonksiyonu oldukları için RPC ile çağrılamıyorlar, ama
--    kural kuraldır.
--
-- 6. ⚠️ **0081'İN ACL DOĞRULAMASI BOZUKTU.** `aclexplode(p.proacl)` yazmıştım;
--    `proacl` NULL olduğunda — ki VARSAYILAN DURUM BUDUR, yani tam da
--    yakalanması gereken hâl — hiç satır dönmüyor ve kontrol "temiz" diyor.
--    Yani kontrolün kendisi, aradığı şeyi göremiyordu. Doğrusu
--    `coalesce(p.proacl, acldefault('f', p.proowner))`. 0039 bu kalıbı doğru
--    kullanmış; sonraki altı göç kopyalarken yanlışını taşımış.
--
-- 7. `app.aktif_kullanici_id()` `search_path = public, app` ile yazılmıştı.
--    `pg_temp` sona sabitlenmediği için, aynı oturumda geçici tablo
--    açabilen bir aktöre karşı isim gölgeleme riski vardı. 0077/0078'in
--    kalıbına geçiriliyor: `search_path = ''` ve tam nitelikli adlar.
--
-- 8. `auth.uid()` NULL olduğunda kapıyı serbest bırakıyordum ve yorumda
--    "PostgREST'ten gelen her çağrının oturumu VARDIR" yazıyordum.
--    **Bu doğru değil** — oturumsuz `anon` isteğinde `auth.uid()` NULL olur.
--    Bugün sömürülemiyor (yedi tablonun `anon` yetkileri ayrıca geri
--    alınmış) ama iddia yanlıştı. Artık serbestlik `anon` ve
--    `authenticated` rollerini DIŞLIYOR: yalnız göç/bakım rolleri geçiyor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · AKTİF KULLANICI — search_path sertleştirildi ──────────────────────
create or replace function app.aktif_kullanici_id()
returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_auth uuid; v_id uuid;
begin
  begin
    v_auth := auth.uid();
  exception when others then v_auth := null;
  end;
  if v_auth is null then return null; end if;

  select u.id into v_id
    from public.app_user u
   where u.auth_user_id = v_auth
     and u.is_active
   limit 1;

  return v_id;
end $$;

revoke all     on function app.aktif_kullanici_id() from public;
revoke all     on function app.aktif_kullanici_id() from anon;
grant  execute on function app.aktif_kullanici_id() to authenticated, service_role;


-- ── 2 · OTURUMSUZ SERBESTLİK ARTIK `anon`U DIŞLIYOR ───────────────────────
-- Göç, yedek geri yükleme ve bakım işleri `postgres`/`service_role` ile
-- çalışır ve orada izin diye bir kavram yoktur. Ama `anon` oturumsuzdur ve
-- ona serbest geçiş tanımak, kapıyı hiç takmamakla aynı şey.
create or replace function app.bakim_baglami()
returns boolean
language plpgsql stable set search_path = '' as $$
declare v_auth uuid;
begin
  begin
    v_auth := auth.uid();
  exception when others then v_auth := null;
  end;
  if v_auth is not null then return false; end if;
  -- Oturum YOK. Çağıran rol kullanıcı rollerinden biriyse bu bir bakım
  -- bağlamı DEĞİLDİR; kapı işlemeye devam etmeli.
  return current_user not in ('anon', 'authenticated');
end $$;

comment on function app.bakim_baglami() is
  'Oturumsuz VE kullanici rolu olmayan baglam mi (goc, yedek, bakim). '
  '0082: eskiden yalnizca "oturum yok" bakiliyordu ve `anon` da gecerdi.';

revoke all     on function app.bakim_baglami() from public;
revoke all     on function app.bakim_baglami() from anon;
grant  execute on function app.bakim_baglami() to authenticated, service_role;


-- ── 3 · GENEL İZİN TETİĞİ — bakım bağlamı düzeltildi ──────────────────────
create or replace function app.izin_gerek()
returns trigger
language plpgsql
as $$
declare v_izin text;
begin
  v_izin := tg_argv[0];
  if app.bakim_baglami() then
    return coalesce(new, old);
  end if;

  if not app.yetkim_var(v_izin) then
    raise exception 'Bu islem icin `%` izni gerekiyor; hesabinizda yok.', v_izin
      using errcode = 'MI403';
  end if;

  return coalesce(new, old);
end $$;


-- ── 4 · HACCP ÖLÇÜM KAPISI — bakım bağlamı düzeltildi ─────────────────────
create or replace function app.haccp_olcum_izni()
returns trigger
language plpgsql
as $$
declare v_izin text;
begin
  if app.bakim_baglami() then return coalesce(new, old); end if;

  if tg_op = 'INSERT' then v_izin := 'quality.write';
  else                     v_izin := 'quality.record.manage';
  end if;

  if not app.yetkim_var(v_izin) then
    if tg_op = 'INSERT' then
      raise exception 'HACCP olcumu girmek icin `quality.write` izni gerekiyor.'
        using errcode = 'MI403';
    else
      raise exception 'Olcum kaydini degistirmek/iptal etmek icin '
        '`quality.record.manage` izni gerekiyor. Bu izin kalite sorumlusu, '
        'gida muhendisi, isletme muduru ve isletme sahibi rollerindedir. '
        'Olcum GIRME yetkiniz ayri ve duruyor.'
        using errcode = 'MI403';
    end if;
  end if;

  return coalesce(new, old);
end $$;


-- ── 5 · AMBALAJ KAPISI — bakım bağlamı düzeltildi ─────────────────────────
create or replace function app.ambalaj_beyani_izni()
returns trigger
language plpgsql
as $$
declare v_degisti boolean;
begin
  if app.bakim_baglami() then return new; end if;

  if tg_op = 'INSERT' then
    v_degisti := (new.net_qty is not null or new.net_uom is not null);
  else
    v_degisti := (new.net_qty is distinct from old.net_qty)
                 or (new.net_uom is distinct from old.net_uom);
  end if;

  if v_degisti and not app.yetkim_var('quality.declaration') then
    raise exception 'Ambalaj miktari/birimi etiket beyaninin parcasidir; '
      'yazmak icin `quality.declaration` izni gerekiyor.'
      using errcode = 'MI403';
  end if;

  return new;
end $$;


-- ── 6 · DÜZELTİCİ FAALİYET KAPISI — DÖRT DELİK KAPANDI ────────────────────
create or replace function app.haccp_faaliyet_izni()
returns trigger
language plpgsql
as $$
declare
  v_kapanis boolean := false;   -- bu işlem AÇIK bir faaliyeti kapatıyor mu
  v_dar     boolean := false;   -- dar izin (quality.record.manage) gerekli mi
  v_bakim   boolean;
begin
  v_bakim := app.bakim_baglami();

  -- ⚠️ DELİK 4 · ÖLÇÜM BAĞI DEĞİŞTİRİLEMEZ — İZİNLE BİLE.
  -- Faaliyetin hangi sapmaya karşı açıldığı, bu tablonun varlık sebebidir.
  -- Bunu taşıyabilmek, "A sapmasına karşı yapılan iş"i "B sapmasına karşı
  -- yapılmış" gösterebilmek demektir. Yetki meselesi değil, defter meselesi.
  if tg_op = 'UPDATE' and new.measurement_id is distinct from old.measurement_id then
    raise exception 'Bir duzeltici faaliyetin bagli oldugu olcum '
      'DEGISTIRILEMEZ. Yanlis olcume acildiysa iptal edin ve dogru olcume '
      'yeni bir faaliyet acin.'
      using errcode = 'MI425';
  end if;

  if tg_op = 'DELETE' then
    v_dar := true;

  elsif tg_op = 'INSERT' then
    -- ⚠️ DELİK 1 · `CANCELLED` de kapanıştır. 0081 yalnız `COMPLETED`e
    -- bakıyordu; iptal, faaliyeti açık listeden düşürmenin ikinci yoluydu.
    v_kapanis := (new.status = 'COMPLETED');
    v_dar     := (new.status in ('COMPLETED', 'CANCELLED'));

  else
    v_kapanis := (new.status = 'COMPLETED'
                  and old.status is distinct from 'COMPLETED');

    v_dar :=
      -- kapatma ya da iptal (DELİK 1)
      (new.status in ('COMPLETED', 'CANCELLED')
        and old.status is distinct from new.status)
      -- ⚠️ DELİK 2 ve 3 · KAPANMIŞ/İPTAL EDİLMİŞ BİR SATIRA DOKUNMAK.
      -- Hangi kolon olduğuna BAKILMIYOR: metnini düzeltmek de, zamanını
      -- değiştirmek de, yeniden açmak da (COMPLETED → OPEN) kalite kararı.
      -- Kolon sayarak yazsaydım yarın eklenen kolon açıkta kalırdı.
      or (old.status in ('COMPLETED', 'CANCELLED'))
      -- atamayı değiştirmek
      or (new.assigned_role is distinct from old.assigned_role);
  end if;

  if not v_bakim and v_dar and not app.yetkim_var('quality.record.manage') then
    raise exception 'Duzeltici faaliyeti kapatmak, iptal etmek, yeniden '
      'acmak, kapanmis bir kaydi degistirmek ya da atamasini degistirmek '
      'icin `quality.record.manage` izni gerekiyor. Bu izin kalite '
      'sorumlusu, gida muhendisi, isletme muduru ve isletme sahibi '
      'rollerindedir. Yapilan isi yazip onlara bildirin.'
      using errcode = 'MI403';
  end if;

  if not v_bakim and not v_dar and tg_op <> 'DELETE'
     and not app.yetkim_var('quality.write') then
    raise exception 'Duzeltici faaliyet kaydi icin `quality.write` izni gerekiyor.'
      using errcode = 'MI403';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  -- ⚠️ DELİK 2 · İMZA İSTEMCİDEN HİÇ ALINMIYOR.
  -- Kapanış anında veritabanı yazıyor; BAŞKA HİÇBİR ANDA değiştirilemiyor.
  -- 0081'de yalnız kapanış anı korunuyordu, sonrası serbestti.
  if v_kapanis then
    new.completed_by := coalesce(app.aktif_kullanici_id(), old.completed_by);
  elsif tg_op = 'UPDATE' then
    new.completed_by := old.completed_by;
  elsif tg_op = 'INSERT' and not v_kapanis then
    new.completed_by := null;
  end if;

  return new;
end $$;


-- ── 7 · TETİK FONKSİYONLARINDA PUBLIC EXECUTE KAPATILDI ───────────────────
-- Tetik fonksiyonu RPC ile çağrılamaz ama kural istisna tanımaz (tuzak 67).
do $$
declare f text;
begin
  foreach f in array array[
    'app.izin_gerek()', 'app.haccp_olcum_izni()',
    'app.haccp_faaliyet_izni()', 'app.ambalaj_beyani_izni()'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke all on function %s from anon', f);
  end loop;
end $$;


-- ── 8 · DOĞRULAMA — bu sefer ACL KONTROLÜ ÇALIŞIYOR ───────────────────────
do $$
declare
  v_acik text;
  v_say  int;
begin
  -- ⚠️ `coalesce(proacl, acldefault(...))` — 0081'de bu YOKTU ve kontrol
  -- varsayılan (yani açık) durumu hiç göremiyordu.
  select string_agg(p.proname, ', ' order by p.proname) into v_acik
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app'
     and p.proname in ('izin_gerek', 'aktif_kullanici_id', 'bakim_baglami',
                       'haccp_olcum_izni', 'haccp_faaliyet_izni',
                       'ambalaj_beyani_izni')
     and exists (
       select 1
         from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'
     );
  if v_acik is not null then
    raise exception '0082: su fonksiyonlarda PUBLIC EXECUTE hala acik: %', v_acik;
  end if;

  -- Tetikler yerinde mi
  select count(*) into v_say
    from pg_trigger
   where tgname like 'izin\_%' and not tgisinternal and tgenabled <> 'D';
  if v_say <> 7 then
    raise exception '0082: 7 yetki tetigi bekleniyordu, % bulundu.', v_say;
  end if;

  -- `bakim_baglami` gerçekten rol bakıyor mu (yorum değil, kod)
  if pg_get_functiondef('app.bakim_baglami()'::regprocedure)
       not like '%current_user not in%' then
    raise exception '0082: bakim_baglami cagiran rolu kontrol etmiyor.';
  end if;

  -- Faaliyet kapısı CANCELLED'i de kapsıyor mu
  if pg_get_functiondef('app.haccp_faaliyet_izni()'::regprocedure)
       not like '%CANCELLED%' then
    raise exception '0082: faaliyet kapisi CANCELLED durumunu kapsamiyor.';
  end if;

  -- Ölçüm bağı kilidi var mı
  if pg_get_functiondef('app.haccp_faaliyet_izni()'::regprocedure)
       not like '%measurement_id is distinct from old.measurement_id%' then
    raise exception '0082: olcum bagi kilidi yok.';
  end if;

  raise notice '0082 TAMAM · faaliyet kapisinin dort deligi kapandi · '
    'imza her an korunuyor · ACL kontrolu artik calisiyor';
end $$;

notify pgrst, 'reload schema';
