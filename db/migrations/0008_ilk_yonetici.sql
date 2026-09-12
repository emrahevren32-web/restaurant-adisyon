-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Dilim 0 / G4
-- 0008 — İlk yönetici hesabı: tenant + firma + merkez şube + app_user eşleştirmesi
--
-- Bu migration, Supabase Authentication tarafında zaten oluşturulmuş olan
-- admin hesabını (auth.users) app_user tablosuyla eşler. Parola burada
-- YOKTUR ve OLMAYACAKTIR — kimlik doğrulama tamamen Supabase Auth'tadır.
-- Bkz. PLAN.md §5, ADR-004.
--
-- Tekrar çalıştırılabilir: aynı UID ile ikinci kez çalıştırılırsa veri
-- bozulmaz, yalnızca isim/eşleştirme alanları güncellenir.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_tenant_id    uuid;
  v_company_id   uuid;
  v_branch_id    uuid;
  v_user_id      uuid;
  -- Supabase Authentication → Users listesinden alınan UID (emrahevren32@gmail.com).
  v_auth_user_id uuid := '141939e8-5779-43af-b468-9cbc8ee2b1fb';
begin
  -- ── Tenant ─────────────────────────────────────────────────────────────
  insert into tenant (code, name)
  values ('MIYOP', 'MİYOP')
  on conflict (code) do update set name = excluded.name
  returning id into v_tenant_id;

  -- ── Firma ──────────────────────────────────────────────────────────────
  -- Firma adı ve kodu geçicidir, Firma Profili ekranından her zaman
  -- değiştirilebilir. Bu migration'ın kilitlediği tek şey UID eşleşmesidir.
  insert into company (tenant_id, company_code, company_name)
  values (v_tenant_id, 'MIYOP', 'MİYOP')
  on conflict (tenant_id, company_code) do update set company_name = excluded.company_name
  returning id into v_company_id;

  -- ── Merkez şube ────────────────────────────────────────────────────────
  insert into branch (tenant_id, company_id, code, name, branch_type, is_head_office)
  values (v_tenant_id, v_company_id, 'MERKEZ', 'Merkez', 'merkez', true)
  on conflict (tenant_id, company_id, code) do update set name = excluded.name
  returning id into v_branch_id;

  -- company.default_branch_id yetkili kaynaktır (bkz. 0001 yorum satırı).
  update company set default_branch_id = v_branch_id where id = v_company_id;

  -- ── İlk yönetici — Supabase Auth eşleştirmesi ─────────────────────────
  insert into app_user (
    tenant_id, company_id, auth_user_id,
    username, username_key, full_name, role_code, is_active
  )
  values (
    v_tenant_id, v_company_id, v_auth_user_id,
    'emrah', lower('emrah'), 'Emrah Evren', 'admin', true
  )
  on conflict (tenant_id, username_key)
  do update set
    auth_user_id = excluded.auth_user_id,
    full_name    = excluded.full_name,
    company_id   = excluded.company_id,
    role_code    = excluded.role_code,
    is_active    = true
  returning id into v_user_id;

  -- Şube erişimi: yönetici merkez şubeye erişebilir.
  insert into user_branch_access (tenant_id, user_id, branch_id)
  values (v_tenant_id, v_user_id, v_branch_id)
  on conflict (user_id, branch_id) do nothing;
end $$;

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- Bu sorgu TEK SATIR dönmeli ve supabase_auth_uid dolu olmalı. Boş dönerse
-- ya da hiç satır yoksa migration'ı Claude'a bildir, ilerleme.
select
  t.code         as tenant_kodu,
  c.company_name as firma,
  b.name         as merkez_sube,
  u.username     as kullanici_adi,
  u.full_name    as ad_soyad,
  u.auth_user_id as supabase_auth_uid,
  u.role_code    as rol,
  u.is_active    as aktif_mi
from app_user u
join tenant  t on t.id = u.tenant_id
join company c on c.id = u.company_id
left join branch b on b.company_id = c.id and b.is_head_office
where u.auth_user_id = '141939e8-5779-43af-b468-9cbc8ee2b1fb';
