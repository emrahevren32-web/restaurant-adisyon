-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · CANLIYA YAPIŞTIRILACAK GÖÇ PAKETİ · 30.10.2026
--
-- Supabase → SQL Editor → hepsini seç, yapıştır, Run.
-- Beklenen çıktı: "Success. No rows returned."
--
-- ⚠️ SUPABASE YAPIŞTIRILAN BETİĞİN TAMAMINI **TEK İŞLEMDE** ÇALIŞTIRIR.
-- Bir satır düşerse HİÇBİR ŞEY uygulanmaz.
-- BU PAKETTE TEK GÖÇ VAR: 0104.
--
-- ── 0104 NEDEN GEREKLİ ────────────────────────────────────────────────────
-- Denetim defteri (`audit_log`) her değişikliği yazıyor ama DÖRT tabloda
-- "hangi satır" sorusunun cevabını yazamıyordu: `row_id` alanına '?'
-- düşüyordu. O dört tablo `id` kolonu taşımıyor:
--   stock_item_allergen · stock_item_nutrition · user_branch_access · user_role
--
-- Yani besin değeri güncellemesinde defterde şu yazıyordu: "biri bir şeyin
-- yağ oranını 10'dan 12'ye çekti" — hangi ürün, belli değil.
--
-- Düzeltme, dört tabloyu tek tek yamamak DEĞİL: defteri YAZAN fonksiyon
-- düzeltiliyor. `id` yoksa birincil anahtardan kimlik üretiliyor
-- (`stock_item_id=... · allergen_code=GLUTEN`). Beşinci tablo eklendiğinde
-- de çalışır.
--
-- İkinci onarım aynı pakette: `company.updated_at` artık SUNUCUDA yazılıyor.
-- Firma Profili ekranı "Son kayıt: ..." yazıyor ve o tarihi istemci
-- gönderiyordu — yani ekranda yazan söz, istemcinin söylediği şeydi.
--
-- ── ÖLÇÜM ─────────────────────────────────────────────────────────────────
-- Prova veritabanında (105 göç, PostgreSQL 16) KOŞTURULDU:
--   db/prova/prova-0104.sql       → 5 bölüm, hepsi yeşil
--   db/prova/prova-0104-ters.sql  → 0104 geri alınınca '?' GERİ GELİYOR
--     (dört tablonun dördü de kör, company 2020 tarihini kabul ediyor)
--
-- Ters prova olmadan "düzelttim" demek ölçüm değil iddiadır.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Göç 0104 · DENETİM DEFTERİ DOĞRU SATIRI YAZSIN
--            · MIYOP-083 (P1) ve MIYOP-085 (P2) · Codex, 30.10.2026
--
-- Bu göç tek bir soruyu onarıyor: **"bu kaydı kim, ne zaman, NEYİ değiştirdi"**
-- sorusunun cevabı güvenilir olsun. İki ayrı yerden bozuluyordu.
--
-- ── MIYOP-083 · SATIR KİMLİĞİ KAYBOLUYOR ──────────────────────────────────
-- `app.denetim_yaz()` satır kimliğini şöyle okuyordu (0028):
--     v_satir := coalesce(v_yeni ->> 'id', v_eski ->> 'id', '?');
-- ⚠️ `id` kolonu OLMAYAN bir tabloda bu **'?'** demektir. Denetim kaydı
-- YAZILIYOR ama hangi satır olduğu belli değil.
--
-- Ölçüm (yerel prova veritabanı, 30.10.2026): denetim tetiği bağlı olup `id`
-- kolonu olmayan **DÖRT** tablo var —
--     stock_item_allergen   (pk: stock_item_id, allergen_code)
--     stock_item_nutrition  (pk: stock_item_id)
--     user_branch_access    (pk: user_id, branch_id)
--     user_role             (pk: user_id, role_code)
--
-- ⚠️ `stock_item_nutrition`taki hâli daha beter: yalnız yağ miktarı
-- değişirse `stock_item_id` DEĞİŞMEDİĞİ için farka da girmiyor. Yani
-- defterde ne satır kimliği var, ne de hangi ürün olduğu. *"Bu beyanı kim
-- değiştirdi"* sorusu alerjen/besin değeri için sorulacak en kritik
-- sorudur — etiket oradan basılıyor.
--
-- ⚠️ **BENİM KÖR NOKTAM.** 29.10'da `tenant_settings`te aynı kusuru
-- yaşadım (tuzak 149) ve YALNIZ KENDİ TABLOMU onardım; "başka nerede var"
-- diye sormadım. `audit-coverage.arch.test.ts` denetimin KAPSAMINI ölçüyor
-- ama `row_id`in ANLAMLI olduğunu ölçmüyordu. Codex dördünü de buldu.
--
-- ── ÇÖZÜM · TABLO DEĞİL, DEFTERİ ONAR ─────────────────────────────────────
-- Dört tabloya `id` kolonu EKLEMEDİM. Sebebi:
--   · hepsi birleşim (junction) tablosu; birincil anahtarları zaten var ve
--     yabancı anahtarlar/indeksler ona bağlı,
--   · asıl kusur tablolarda değil, defteri yazan fonksiyonda,
--   · tabloya kolon eklemek bugünkü dördünü çözer, YARIN eklenecek beşinciyi
--     çözmez. Fonksiyonu onarmak hepsini çözer.
-- `id` varsa aynen kullanılıyor (katalog sorgusu HİÇ yapılmıyor, sıcak yol
-- yavaşlamıyor); yoksa birincil anahtardan `kolon=değer` biçiminde kararlı
-- bir kimlik üretiliyor.
--
-- ── MIYOP-085 · "SON KAYIT" ZAMANI İSTEMCİDEN GELİYOR ─────────────────────
-- `company.updated_at` ekranın gönderdiği `new Date()` ile yazılıyordu ve
-- Firma Profili ekranı onu **"Son Kayıt"** diye, kaydın KANITI olarak
-- gösteriyor. ⚠️ Saati yanlış bir bilgisayar yanlış kanıt yazar.
-- 0103'te bunu `tenant_settings` için sunucuya yazdırmıştım; aynı commit'te
-- `company` için yazdırmamışım — kendi koyduğum standardı çiğnemişim.
--
-- ⚠️ `company`de `updated_by` kolonu YOK ve EKLENMİYOR: "kim" sorusunun
-- cevabı zaten `audit_log`da (0091) ve orada aktör sunucuda yazılıyor.
-- Kolon eklemek aynı cevabı ikinci bir yerde tutmak olurdu.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · SATIR KİMLİĞİ · birincil anahtardan ───────────────────────────────
-- ⚠️ `stable`: aynı girdi için aynı cevap, veri yazmıyor.
-- ⚠️ Katalog sorgusu YALNIZ `id` kolonu olmayan tablolar için çalışır
-- (`denetim_yaz` önce `id`ye bakıyor), yani stok hareketi gibi sıcak
-- yollarda bu fonksiyon HİÇ çağrılmaz.
create or replace function app.denetim_satir_kimligi(p_relid oid, p_satir jsonb)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_kimlik text;
begin
  if p_satir is null then return null; end if;

  select string_agg(a.attname || '=' || coalesce(p_satir ->> a.attname, '?'),
                    ' · ' order by k.ord)
    into v_kimlik
    from pg_catalog.pg_constraint con
    cross join lateral unnest(con.conkey) with ordinality as k(attnum, ord)
    join pg_catalog.pg_attribute a
      on a.attrelid = con.conrelid and a.attnum = k.attnum
   where con.conrelid = p_relid and con.contype = 'p';

  -- ⚠️ Birincil anahtarı olmayan tabloda `null` döner ve `denetim_yaz`
  -- eski davranışına ('?') düşer. Uydurma kimlik üretmekten dürüsttür.
  return v_kimlik;
end;
$$;

revoke all on function app.denetim_satir_kimligi(oid, jsonb) from public;
grant execute on function app.denetim_satir_kimligi(oid, jsonb) to service_role;


-- ── 2 · DEFTERİ YAZAN FONKSİYON ───────────────────────────────────────────
-- ⚠️ GÖVDE 0028'DEN BİREBİR ALINDI; değişen TEK ŞEY `v_satir` satırıdır.
-- (Tuzak 127'nin dersi: bir fonksiyonu `create or replace` ile yeniden
-- yazarken gövdeyi "hatırlayarak" yazmak, o gövdedeki başka bir kararı
-- sessizce siler. Gövde canlı tanımdan okundu.)
CREATE OR REPLACE FUNCTION app.denetim_yaz()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $function$
declare
  v_eski     jsonb;
  v_yeni     jsonb;
  v_fark     jsonb;
  v_tenant   uuid;
  v_branch   uuid;
  v_satir    text;
  v_auth     uuid;
  v_user     uuid;
  v_ad       text;
  v_ozet     text;
begin
  v_eski := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_yeni := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_fark := app.denetim_farki(v_eski, v_yeni);

  -- Hiçbir alan değişmediyse kayıt yazmıyoruz: "kaydet"e basıp hiçbir şey
  -- değiştirmemek bir olay değildir.
  if tg_op = 'UPDATE' and v_fark = '{}'::jsonb then
    return null;
  end if;

  v_tenant := coalesce(v_yeni ->> 'tenant_id', v_eski ->> 'tenant_id')::uuid;
  if v_tenant is null then return null; end if;

  begin
    v_branch := coalesce(v_yeni ->> 'branch_id', v_eski ->> 'branch_id')::uuid;
  exception when others then v_branch := null;
  end;

  -- ⚠️ 0104 · BURASI ESKİDEN ŞÖYLEYDİ:
  --     v_satir := coalesce(v_yeni ->> 'id', v_eski ->> 'id', '?');
  -- `id` kolonu OLMAYAN tablolarda `row_id` alanına '?' düşüyordu. Kayıt
  -- yazılıyordu ama HANGİ SATIR olduğu belli değildi. Artık `id` yoksa
  -- BİRİNCİL ANAHTARDAN kimlik üretiliyor.
  v_satir := coalesce(
    v_yeni ->> 'id',
    v_eski ->> 'id',
    app.denetim_satir_kimligi(tg_relid, coalesce(v_yeni, v_eski)),
    '?');

  select auth_id, user_id, ad into v_auth, v_user, v_ad from app.denetim_aktoru();

  -- 0028: özet artık tabloya göre çözülüyor; alt satırlar da adlarıyla görünür.
  v_ozet := app.denetim_ozet_coz(tg_table_name, coalesce(v_yeni, v_eski));

  insert into audit_log (
    tenant_id, branch_id, table_name, row_id, action,
    actor_auth_id, actor_user_id, actor_name, changes, summary
  ) values (
    v_tenant, v_branch, tg_table_name, v_satir, tg_op,
    v_auth, v_user, v_ad,
    case
      when tg_op = 'INSERT' then jsonb_build_object('_kayit', v_yeni)
      when tg_op = 'DELETE' then jsonb_build_object('_kayit', v_eski)
      else v_fark
    end,
    v_ozet
  );

  return null;
end $function$;

-- ── 3 · MIYOP-085 · `company.updated_at` SUNUCUDA ─────────────────────────
-- ⚠️ `updated_at` istemciden gelirse ekrandaki "Son Kayıt" bir KANIT değil,
-- bir İDDİA olur. Kanıt veritabanında üretilir.
create or replace function app.company_zaman_damgasi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  -- Doğum tarihi değiştirilemez.
  new.created_at := old.created_at;
  return new;
end;
$$;

revoke all on function app.company_zaman_damgasi() from public;

drop trigger if exists company_zaman_damgasi on public.company;
-- ⚠️ `before update` OLMAK ZORUNDA: denetim tetiği (`denetim_company`)
-- `after`tır ve satırın SON hâlini yazar. Zaman damgası `before`da
-- üretilirse defterde sunucu zamanı durur.
--
-- ⚠️ BURAYA ÖNCE *"ilk before tetiği olmalı, c < i"* DİYE BİR İDDİA
-- YAZMIŞTIM VE KENDİ DOĞRULAMAM ONU ÖLDÜRDÜ: göç uygulanmadı, hata verdi.
-- Ölçtüm — `company` üzerindeki before-update tetikleri alfabetik sırayla
-- `company_sektor_kimligi` → `company_zaman_damgasi` → `izin_company` →
-- `trg_lisans_kilidi_company`. Yani ilk değil, İKİNCİ.
-- ⚠️ Ve zaten "ilk olmak" GEREKMİYOR: öteki before tetiklerinin hiçbiri
-- `updated_at` okumuyor, denetim ise `after`. Fazladan bir şart koymuştum
-- ve o şart doğru bile değildi. Doğrulama artık GERÇEKTEN gerekeni ölçüyor.
create trigger company_zaman_damgasi
  before update on public.company
  for each row execute function app.company_zaman_damgasi();


-- ── 4 · DOĞRULAMA · YALNIZ BU GÖÇÜN YAZDIĞINI ÖLÇER ───────────────────────
do $$
declare v_say int; v_kimlik text;
begin
  if to_regprocedure('app.denetim_satir_kimligi(oid, jsonb)') is null then
    raise exception '0104: satır kimliği fonksiyonu oluşmadı.';
  end if;

  -- ⚠️ Gövde gerçekten yeni mi? Eski hâlinde `tg_relid` HİÇ geçmiyordu.
  if (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app' and p.proname = 'denetim_yaz')
     not like '%denetim_satir_kimligi(tg_relid%' then
    raise exception '0104: denetim_yaz hâlâ eski satır kimliğini kullanıyor.';
  end if;

  -- Dört tablonun hiçbirinde `id` yok; kimlik üretilebiliyor olmalı.
  for v_say in
    select 1 from (values ('public.stock_item_allergen'),
                          ('public.stock_item_nutrition'),
                          ('public.user_branch_access'),
                          ('public.user_role')) t(ad)
     where app.denetim_satir_kimligi(t.ad::regclass::oid, '{}'::jsonb) is null
  loop
    raise exception '0104: bir tablo için satır kimliği üretilemiyor.';
  end loop;

  -- Örnek: besin tablosunun kimliği ürün kartını TAŞIMALI.
  v_kimlik := app.denetim_satir_kimligi(
    'public.stock_item_nutrition'::regclass::oid,
    jsonb_build_object('stock_item_id', '11111111-1111-1111-1111-111111111111'));
  if v_kimlik is null or v_kimlik not like '%stock_item_id=11111111%' then
    raise exception '0104: besin tablosunun kimliği ürünü taşımıyor (% geldi).',
      coalesce(v_kimlik, 'null');
  end if;

  if not exists (select 1 from pg_trigger
       where tgrelid = 'public.company'::regclass
         and tgname = 'company_zaman_damgasi' and not tgisinternal) then
    raise exception '0104: company zaman damgası tetiği yok.';
  end if;

  -- ⚠️ `before update` olmak ZORUNDA (denetim `after`, son hâli yazıyor).
  if not exists (select 1 from pg_trigger
       where tgrelid = 'public.company'::regclass and not tgisinternal
         and tgname = 'company_zaman_damgasi'
         and tgtype & 2 = 2 and tgtype & 16 = 16) then
    raise exception '0104: zaman damgası BEFORE UPDATE tetiği değil.';
  end if;

  raise notice '✅ 0104: satır kimliği birincil anahtardan üretiliyor; company.updated_at sunucuda.';
end;
$$;
