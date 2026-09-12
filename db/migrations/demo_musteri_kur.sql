-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Demo müşteri — Endüstriyel Mutfak firması
--
-- AMAÇ: Uygulamaya PLATFORM YÖNETİCİSİ olarak değil, bir FİRMA SAHİBİ olarak
-- girebilmek. Depo ekranını, sektör menülerini ve izin çerçevesini müşterinin
-- gördüğü gibi görmek.
--
-- ── NEDEN BU DOSYA GEREKİYOR ──────────────────────────────────────────────
-- "Onay Bekleyen İşletmeler" ekranındaki onay, firmayı yalnızca tarayıcının
-- localStorage'ında oluşturuyor ve ekranda geçici bir parola gösteriyor.
-- Ama giriş artık Supabase Auth üzerinden yapılıyor — o parolanın karşılığı
-- olan bir Auth hesabı YOK. Bu yüzden onaylanan müşteri giriş yapamıyor.
-- (Onay akışının bu eksiği ayrı bir iştir: kalıcı çözüm bir Edge Function ile
-- Auth hesabı + app_user kaydı oluşturmaktır.)
--
-- Bu dosya o eksiği elle kapatır: gerçek bir kiracı, firma, merkez şube ve
-- firma sahibi kullanıcı oluşturur.
--
-- ── ÖNCE YAPMAN GEREKEN ───────────────────────────────────────────────────
-- 1) Supabase Dashboard → Authentication → Users → "Add user" → "Create new user"
--    • E-posta: aşağıdaki `v_email` ile AYNI olmalı
--    • Parolayı SEN belirle (bana söyleme, gerek yok)
--    • "Auto Confirm User" işaretli olsun — yoksa giriş e-posta onayı bekler
-- 2) Aşağıdaki e-postayı kendi yazdığınla değiştir
-- 3) SQL Editor'de bu dosyayı çalıştır
--
-- Betik yeniden çalıştırılabilir: aynı kodlarla ikinci kez koşarsa yeni kayıt
-- açmaz, mevcutları günceller.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ⬇️⬇️⬇️  BU SATIRI KENDİ E-POSTANLA DEĞİŞTİR  ⬇️⬇️⬇️
  v_email text := 'abcbey@gida.com';
  -- ⬆️⬆️⬆️  BU SATIRI KENDİ E-POSTANLA DEĞİŞTİR  ⬆️⬆️⬆️

  v_firma_adi  text := 'ABC Endüstriyel Mutfak A.Ş.';
  v_kod        text := 'ABCGIDA';
  v_kullanici  text := 'abcbey';
  v_ad_soyad   text := 'ABC Bey';

  v_auth   uuid;
  v_tenant uuid;
  v_firma  uuid;
  v_sube   uuid;
  v_user   uuid;
begin
  -- ── 1. Auth hesabını bul ───────────────────────────────────────────────
  select id into v_auth from auth.users where lower(email) = lower(v_email);

  if v_auth is null then
    raise exception
      'Authentication → Users içinde % bulunamadı. Önce Dashboard''dan bu e-posta ile bir kullanıcı oluştur (Auto Confirm User işaretli), sonra bu betiği tekrar çalıştır.',
      v_email;
  end if;

  -- ── 2. Kiracı ──────────────────────────────────────────────────────────
  -- Ayrı bir tenant: müşteri, senin MİYOP kiracının verisini GÖREMEMELİ.
  -- Bunu RLS zorluyor (ADR-004); burada yalnızca doğru kiracıyı kuruyoruz.
  insert into tenant (code, name)
    values (v_kod, v_firma_adi)
    on conflict (code) do update set name = excluded.name
    returning id into v_tenant;

  -- ── 3. Firma ───────────────────────────────────────────────────────────
  -- `primary_sector_id` KRİTİK: iş menülerini bu belirliyor. Boş kalırsa
  -- sektör şablonu bulunamaz ve OPERATIONS bölümü boş görünür.
  insert into company (tenant_id, company_code, company_name, primary_sector_id, city, status)
    values (v_tenant, v_kod, v_firma_adi, 'sector_industrial_kitchen', 'İzmir', 'Aktif')
    on conflict (tenant_id, company_code) do update
      set company_name      = excluded.company_name,
          primary_sector_id = excluded.primary_sector_id
    returning id into v_firma;

  -- ── 4. Merkez şube ─────────────────────────────────────────────────────
  insert into branch (tenant_id, company_id, code, name, branch_type, is_head_office, city)
    values (v_tenant, v_firma, 'MERKEZ', 'Merkez Depo', 'merkez', true, 'İzmir')
    on conflict (tenant_id, company_id, code) do update set name = excluded.name
    returning id into v_sube;

  update company set default_branch_id = v_sube where id = v_firma;

  -- ── 5. Firma sahibi ────────────────────────────────────────────────────
  -- Rol `isletme_sahibi`: kendi işletmesi kapsamında tam yetki, platform
  -- yönetimi HARİÇ (0015_departman_rolleri.sql). Bilerek 'admin' değil —
  -- 'admin' platform tarafının rolüdür ve bu kullanıcının EVREN360 panelini
  -- görmemesi gerekir. Fark `platform.manage` izniyle kuruluyor.
  insert into app_user (
    tenant_id, company_id, auth_user_id, username, username_key,
    full_name, role_code, is_active
  )
  values (
    v_tenant, v_firma, v_auth, v_kullanici, lower(v_kullanici),
    v_ad_soyad, 'isletme_sahibi', true
  )
  on conflict (tenant_id, username_key) do update
    set auth_user_id = excluded.auth_user_id,
        company_id   = excluded.company_id,
        role_code    = excluded.role_code,
        full_name    = excluded.full_name,
        is_active    = true
  returning id into v_user;

  raise notice 'Hazır → kiracı % · firma % · şube % · kullanıcı %', v_tenant, v_firma, v_sube, v_user;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- DOĞRULAMA — aşağıdaki üç sorgu da dolu satır döndürmeli
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Firma sektörüyle birlikte kuruldu mu?
select c.company_name, c.primary_sector_id, t.code as kiraci, b.name as merkez_sube
from company c
join tenant t on t.id = c.tenant_id
left join branch b on b.id = c.default_branch_id
where t.code = 'ABCGIDA';

-- 2) Kullanıcı Auth hesabına bağlandı mı, rolü doğru mu?
select u.username, u.role_code, u.is_active, au.email
from app_user u
join auth.users au on au.id = u.auth_user_id
join tenant t on t.id = u.tenant_id
where t.code = 'ABCGIDA';

-- 3) `isletme_sahibi` rolünün izinleri — `platform.` ile başlayan HİÇBİR
--    izin OLMAMALI. Bu sorgu satır döndürürse yetki çerçevesi delinmiş demektir.
select permission_code as olmamasi_gereken_izin
from role_permission
where role_code = 'isletme_sahibi' and permission_code like 'platform.%';
