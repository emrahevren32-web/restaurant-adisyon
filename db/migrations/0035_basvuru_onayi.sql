-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 4D / KAPI
-- 0035 — Onay gerçekten işletme açıyor
--
-- ── BUGÜNKÜ YALAN ────────────────────────────────────────────────────────
-- Onay bugün `storage.ts` içinde tarayıcı hafızasında firma, şube,
-- kullanıcı, lisans ve GEÇİCİ ŞİFRE üretiyor; ekrana "İlk Giriş Bilgileri"
-- kartı basıyor. Sonra o bilgilerle giriş denenince:
--
--   "Geçersiz e-posta veya şifre ya da kullanıcı pasif."
--
-- Çünkü giriş ekranı GERÇEK veritabanına bakıyor, onay ise tarayıcıya
-- yazıyor. Yani ekranda çalışıyormuş gibi görünen bir zincirin son halkası
-- kopuk. Tam olarak yasakladığımız şey.
--
-- ── BU GÖÇÜN YAPTIĞI VE YAPMADIĞI ───────────────────────────────────────
-- YAPIYOR : kiracı + firma + merkez şube, TEK İŞLEMDE (hepsi ya da hiçbiri)
--           ve başvuru APPROVED'a geçip `tenant_id` ile bağlanıyor.
-- YAPMIYOR: GİRİŞ HESABI. `app_user.auth_user_id` yalnızca Supabase Auth
--           tarafından üretilebilir; onu bir SQL göçü açamaz. O A4D'nin
--           4. maddesi (Edge Function) ve ayrı iş.
--
-- Bu sınır bilerek böyle. Yarım bir onayı "tamam" göstermek yerine, onay
-- ekranı "işletme açıldı, giriş hesabı henüz açılmadı" diyecek. Eksik ama
-- DOĞRU; bugünkü hâli tam görünüyor ama YANLIŞ.
--
-- ── PLATFORM YÖNETİCİSİ İÇİN YENİ POLİTİKALAR ───────────────────────────
-- `tenant`, `company`, `branch` tablolarında RLS `force` (0001): sahibi bile
-- politikaya tabi. Politika "satır benim kiracım olmalı" diyor. Yeni bir
-- kiracı açmak ise tanımı gereği BAŞKA bir kiracıya satır yazmaktır —
-- mevcut politikayla imkânsız.
--
-- Çözüm: `platform.manage` izniyle sınırlı AYRI politikalar. Platform
-- yöneticisinin işi zaten yeni işletme açmaktır. İzolasyon gevşemiyor;
-- yalnızca "platform yöneticisi" diye ayrı ve adı konmuş bir kapı açılıyor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Kiracı kodu ───────────────────────────────────────────────────────────
-- `Gümüş Tavukçuluk` → `GUM007`. Ekranlarda ve konuşmada kullanılan kısa ad.
create or replace function app.kiraci_kodu_uret(p_ad text)
returns text
language plpgsql volatile as $$
declare
  v_harf text;
  v_kod  text;
  i      int;
begin
  -- Türkçe harfleri ASCII'ye indir, sonra yalnız harf/rakam bırak.
  v_harf := upper(translate(coalesce(p_ad, ''),
    'çğıöşüÇĞİıÖŞÜâîûÂÎÛ', 'cgiosuCGIIOSUaiuAIU'));
  v_harf := regexp_replace(v_harf, '[^A-Z0-9]', '', 'g');
  v_harf := substr(v_harf || 'XXX', 1, 3);

  for i in 1..999 loop
    v_kod := v_harf || lpad(i::text, 3, '0');
    if not exists (select 1 from tenant where code = v_kod) then
      return v_kod;
    end if;
  end loop;

  raise exception 'Kiracı kodu üretilemedi (% için 999 deneme doldu).', v_harf
    using errcode = 'MI500';
end $$;

comment on function app.kiraci_kodu_uret(text) is
  'İşletme adından kısa kiracı kodu (GUM007). Tekil olana kadar artırır.';

-- ── Platform yöneticisi yeni işletme açabilir ────────────────────────────
-- ⚠️ Bunlar mevcut kiracı izolasyonunu GEVŞETMİYOR. Politikalar "izin
-- verici" (permissive) ve OR'lanır; yani var olan kural yerinde duruyor,
-- yanına adı konmuş ikinci bir kapı ekleniyor: `platform.manage`.
drop policy if exists tenant_platform_insert on tenant;
create policy tenant_platform_insert on tenant
  for insert with check (app.yetkim_var('platform.manage'));

-- Platform yöneticisi açtığı kiracıyı GÖREBİLMELİ (kod ve ad döndürülüyor).
drop policy if exists tenant_platform_select on tenant;
create policy tenant_platform_select on tenant
  for select using (app.yetkim_var('platform.manage'));

drop policy if exists company_platform_yazma on company;
create policy company_platform_yazma on company
  for insert with check (app.yetkim_var('platform.manage'));

drop policy if exists company_platform_okuma on company;
create policy company_platform_okuma on company
  for select using (app.yetkim_var('platform.manage'));

-- Firmanın merkez şubesini işaretlemek için güncelleme de gerekiyor.
drop policy if exists company_platform_guncelleme on company;
create policy company_platform_guncelleme on company
  for update using      (app.yetkim_var('platform.manage'))
             with check (app.yetkim_var('platform.manage'));

drop policy if exists branch_platform_yazma on branch;
create policy branch_platform_yazma on branch
  for insert with check (app.yetkim_var('platform.manage'));

drop policy if exists branch_platform_okuma on branch;
create policy branch_platform_okuma on branch
  for select using (app.yetkim_var('platform.manage'));

-- ── Onay ──────────────────────────────────────────────────────────────────
create or replace function app.basvuruyu_onayla(
  p_basvuru_id uuid,
  p_gerekce    text
)
returns table (
  kiraci_id   uuid,
  kiraci_kodu text,
  firma_id    uuid,
  sube_id     uuid
)
language plpgsql security definer set search_path = public, app as $$
declare
  v_b        business_application;
  v_kiraci   uuid;
  v_kod      text;
  v_firma    uuid;
  v_sube     uuid;
  v_kim      uuid;
begin
  -- ⚠️ YETKİ KONTROLÜ BURADA DEĞİL, `public` KABUĞUNDA.
  -- Sebep: bu iç fonksiyon `anon` ve `authenticated`tan tamamen alınmış
  -- (aşağıdaki revoke); dışarıdan çağrılamıyor. Yetki sınırı dış kapıda
  -- duruyor. Bölmenin ikinci faydası: iç fonksiyon oturumsuz da
  -- sınanabiliyor (SQL Editor, yerel göç provası).
  if length(btrim(coalesce(p_gerekce, ''))) < 3 then
    raise exception 'Onay gerekçesi en az 3 karakter olmalı.'
      using errcode = 'MI422';
  end if;

  -- 2. Başvuru. `for update`: aynı başvuru iki kez onaylanmasın.
  select * into v_b from business_application
   where id = p_basvuru_id for update;

  if v_b.id is null then
    raise exception 'Başvuru bulunamadı.' using errcode = 'MI404';
  end if;
  if v_b.status = 'APPROVED' then
    raise exception 'Bu başvuru zaten onaylanmış (işletme: %).', v_b.tenant_id
      using errcode = 'MI409';
  end if;
  -- Durum makinesi PENDING'den doğrudan APPROVED'a izin vermiyor (0032).
  -- Hatayı burada ANLAŞILIR cümleyle veriyoruz; tetikleyici teknik konuşur.
  if v_b.status <> 'IN_REVIEW' then
    raise exception 'Önce başvuruyu incelemeye almalısınız (şu an: %).', v_b.status
      using errcode = 'MI422';
  end if;

  select user_id into v_kim from app.denetim_aktoru();

  -- 3. Kiracı
  v_kod := app.kiraci_kodu_uret(v_b.company_name);
  insert into tenant (code, name)
  values (v_kod, v_b.company_name)
  returning id into v_kiraci;

  -- 4. Firma. Başvurudaki bilgiler olduğu gibi taşınıyor — müşteri aynı
  --    şeyi ikinci kez yazmasın.
  insert into company (
    tenant_id, company_code, company_name, legal_name,
    tax_office, tax_number, phone, email, address, city, district,
    authorized_person, authorized_email, authorized_phone,
    primary_sector_id, status
  ) values (
    v_kiraci, v_kod, v_b.company_name, v_b.company_name,
    v_b.tax_office, v_b.tax_number, v_b.phone, v_b.email, v_b.address,
    v_b.city, v_b.district,
    v_b.owner_name, v_b.email, v_b.phone,
    v_b.sector_code, 'Aktif'
  ) returning id into v_firma;

  -- 5. Merkez şube. Her işletme en az bir şubeyle doğar; yoksa stok
  --    hareketi yazacak yer olmaz.
  insert into branch (
    tenant_id, company_id, code, name, branch_type,
    phone, email, address, city, district, manager_name, is_head_office
  ) values (
    v_kiraci, v_firma, 'MERKEZ', 'Merkez', 'merkez',
    v_b.phone, v_b.email, v_b.address, v_b.city, v_b.district,
    v_b.owner_name, true
  ) returning id into v_sube;

  -- company.default_branch_id yetkili kaynak, branch.is_head_office aynası
  -- (0001 yorumu). İkisi birlikte yazılıyor.
  update company set default_branch_id = v_sube, updated_at = now()
   where id = v_firma;

  -- 6. Başvuruyu kapat. Tetikleyici olay defterine yazacak (0032).
  update business_application
     set status        = 'APPROVED',
         decision_note = btrim(p_gerekce),
         decided_at    = now(),
         decided_by    = v_kim,
         tenant_id     = v_kiraci
   where id = p_basvuru_id;

  return query select v_kiraci, v_kod, v_firma, v_sube;
end $$;

comment on function app.basvuruyu_onayla(uuid, text) is
  'Başvuruyu onaylar: kiracı + firma + merkez şube, tek işlemde. '
  'GİRİŞ HESABI AÇMAZ — o Supabase Auth işi (A4D madde 4).';

-- ⚠️ PostgREST yalnız `public` şemasını yayınlar (0016, 0034). Aynı hataya
-- üçüncü kez düşmemek için kabuk BURADA, göçle birlikte yazılıyor.
create or replace function public.basvuruyu_onayla(
  p_basvuru_id uuid,
  p_gerekce    text
)
returns table (
  kiraci_id   uuid,
  kiraci_kodu text,
  firma_id    uuid,
  sube_id     uuid
)
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  -- Yetki sınırı BURADA. `security definer` olduğu için yetkiyi kendisi
  -- sormak zorunda; yoksa çağıran herkes işletme açabilirdi.
  if not app.yetkim_var('platform.manage') then
    raise exception 'Başvuru onaylamak için platform yetkisi gerekir.'
      using errcode = 'MI403';
  end if;
  return query select * from app.basvuruyu_onayla(p_basvuru_id, p_gerekce);
end $$;

revoke all on function public.basvuruyu_onayla(uuid, text) from public;
grant execute on function public.basvuruyu_onayla(uuid, text) to authenticated;

revoke all on function app.basvuruyu_onayla(uuid, text) from anon, authenticated;

-- ── Doğrulama ─────────────────────────────────────────────────────────────
-- ⚠️ BURADA NE SINANIR, NE SINANMAZ.
-- SQL Editor'de oturum yok (`auth.uid()` null), dolayısıyla
-- `platform.manage` izni de yok. Kiracı/firma/şube yazma politikaları o
-- izne bağlı olduğu için ONAYIN MUTLU YOLU BURADA SINANAMAZ — denenirse
-- politika reddeder ve göç düşer.
--
-- Bu yüzden burada yalnız her koşulda geçerli olanı sınıyoruz:
--   · dış kapı yetkisiz çağrıyı reddediyor
--   · incelemeye alınmamış başvuru onaylanamıyor
--   · fonksiyonlar ve politikalar gerçekten kurulmuş
--
-- Mutlu yol iki yerde sınanıyor:
--   · yerel göç provası: `miyop-work/prova-akis.sql` (oturum taklit eder)
--   · canlı: Emrah'ın platform hesabıyla ekrandan
do $$
declare
  v_ref  text;
  v_id   uuid;
  v_yetkisiz_red  boolean := false;
  v_incelemesiz_red boolean := false;
begin
  v_ref := app.basvuru_gonder(
    '0035 Dogrulama Gida', 'Deneme Yetkili', '05321234700',
    'dogrulama-0035@example.com', '1234567890', 'Bornova',
    'İzmir', 'Bornova', 'Deneme adresi 1');
  select id into v_id from business_application where reference = v_ref;

  -- 1. Dış kapı: oturum yok, yetki yok → reddetmeli
  begin
    perform public.basvuruyu_onayla(v_id, 'yetkisiz onay denemesi');
  exception when others then v_yetkisiz_red := true;
  end;

  -- 2. İç fonksiyon: incelemeye alınmamış başvuruyu reddetmeli
  --    (durum makinesi PENDING → APPROVED'a izin vermiyor, 0032)
  begin
    perform app.basvuruyu_onayla(v_id, 'incelemesiz onay denemesi');
  exception when others then v_incelemesiz_red := true;
  end;

  raise notice 'yetkisiz red: % · incelemesiz red: %',
    v_yetkisiz_red, v_incelemesiz_red;

  if not (v_yetkisiz_red and v_incelemesiz_red) then
    raise exception 'DOGRULAMA BASARISIZ. Beklenen: true / true — gelen: % / %',
      v_yetkisiz_red, v_incelemesiz_red;
  end if;

  -- Doğrulama başvurusunu kapat (silinemez: olay defteri değişmez).
  update business_application
     set status = 'REJECTED', decided_at = now(),
         decision_note = '0035 dogrulama kaydi'
   where id = v_id;
end $$;

select 'public fonksiyonu' as ne,
       (select count(*)::text from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'basvuruyu_onayla') as adet
union all
select 'platform politikasi',
       (select count(*)::text from pg_policies
         where policyname like '%platform%'
           and tablename in ('tenant','company','branch'))
union all
select 'dogrulama',
       'gecti — yetkisiz onay ve incelemesiz onay reddedildi';
