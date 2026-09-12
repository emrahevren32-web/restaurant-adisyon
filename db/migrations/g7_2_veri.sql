-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · G7 · ADIM 2/2 — İki kiracılı sınama verisi
--
-- ⛔ BU DOSYAYI ÜRETİM PROJESİNDE ÇALIŞTIRMA. Yalnızca G7 sınama projesinde.
--
-- Yol haritası maddesi:
--   "İki tenant izolasyon kabul testi + ham SQL kontrolü"
--   Bitti sayılır ki: "B, A'nın verisini hiçbir yoldan göremiyor"
--
-- İki ayrı işletme kurar (A ve B), her birine bir firma, bir merkez şube,
-- birer yönetici ve BİRBİRİNDEN FARKLI stok kalemleri + hareketler verir.
-- Test sonra A'nın kullanıcısıyla bağlanıp B'nin verisini görebiliyor mu diye
-- bakar. Görebiliyorsa RLS çalışmıyor demektir.
--
-- ── ÖNCE YAPMAN GEREKEN ───────────────────────────────────────────────────
-- Bu sınama projesinin Authentication → Users bölümünde İKİ kullanıcı oluştur
-- ("Add user" → "Create new user"). E-postaları ve şifreleri SEN belirle;
-- bana söyleme, gerek yok. Sonra aşağıdaki İKİ SATIRI kendi e-postalarınla
-- değiştir ve dosyayı çalıştır.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ⬇️⬇️⬇️  BU İKİ SATIRI KENDİ E-POSTALARINLA DEĞİŞTİR  ⬇️⬇️⬇️
  v_email_a text := 'testa@ornek.com';
  v_email_b text := 'testb@ornek.com';
  -- ⬆️⬆️⬆️  BU İKİ SATIRI KENDİ E-POSTALARINLA DEĞİŞTİR  ⬆️⬆️⬆️

  v_auth_a uuid;
  v_auth_b uuid;

  v_tenant_a uuid; v_company_a uuid; v_branch_a uuid; v_user_a uuid;
  v_tenant_b uuid; v_company_b uuid; v_branch_b uuid; v_user_b uuid;

  v_item_a uuid; v_item_b uuid;
begin
  -- ── Auth kullanıcılarını bul ─────────────────────────────────────────
  select id into v_auth_a from auth.users where lower(email) = lower(v_email_a);
  select id into v_auth_b from auth.users where lower(email) = lower(v_email_b);

  if v_auth_a is null then
    raise exception
      'Authentication → Users içinde % bulunamadı. Önce iki kullanıcıyı oluştur, sonra bu dosyadaki e-postaları düzelt.',
      v_email_a;
  end if;
  if v_auth_b is null then
    raise exception
      'Authentication → Users içinde % bulunamadı. Önce iki kullanıcıyı oluştur, sonra bu dosyadaki e-postaları düzelt.',
      v_email_b;
  end if;
  if v_auth_a = v_auth_b then
    raise exception 'İki e-posta aynı kullanıcıya işaret ediyor. Testin anlamı için FARKLI iki hesap gerekir.';
  end if;

  -- ── İŞLETME A ─────────────────────────────────────────────────────────
  insert into tenant (code, name) values ('TESTA', 'Sınama İşletmesi A')
    on conflict (code) do update set name = excluded.name
    returning id into v_tenant_a;

  insert into company (tenant_id, company_code, company_name)
    values (v_tenant_a, 'TESTA', 'Sınama A A.Ş.')
    on conflict (tenant_id, company_code) do update set company_name = excluded.company_name
    returning id into v_company_a;

  insert into branch (tenant_id, company_id, code, name, branch_type, is_head_office)
    values (v_tenant_a, v_company_a, 'MERKEZ', 'A Merkez', 'merkez', true)
    on conflict (tenant_id, company_id, code) do update set name = excluded.name
    returning id into v_branch_a;

  update company set default_branch_id = v_branch_a where id = v_company_a;

  insert into app_user (tenant_id, company_id, auth_user_id, username, username_key, full_name, role_code, is_active)
    values (v_tenant_a, v_company_a, v_auth_a, 'testa', 'testa', 'Sınama Kullanıcısı A', 'admin', true)
    on conflict (tenant_id, username_key) do update
      set auth_user_id = excluded.auth_user_id, role_code = excluded.role_code, is_active = true
    returning id into v_user_a;

  -- ── İŞLETME B ─────────────────────────────────────────────────────────
  insert into tenant (code, name) values ('TESTB', 'Sınama İşletmesi B')
    on conflict (code) do update set name = excluded.name
    returning id into v_tenant_b;

  insert into company (tenant_id, company_code, company_name)
    values (v_tenant_b, 'TESTB', 'Sınama B A.Ş.')
    on conflict (tenant_id, company_code) do update set company_name = excluded.company_name
    returning id into v_company_b;

  insert into branch (tenant_id, company_id, code, name, branch_type, is_head_office)
    values (v_tenant_b, v_company_b, 'MERKEZ', 'B Merkez', 'merkez', true)
    on conflict (tenant_id, company_id, code) do update set name = excluded.name
    returning id into v_branch_b;

  update company set default_branch_id = v_branch_b where id = v_company_b;

  insert into app_user (tenant_id, company_id, auth_user_id, username, username_key, full_name, role_code, is_active)
    values (v_tenant_b, v_company_b, v_auth_b, 'testb', 'testb', 'Sınama Kullanıcısı B', 'admin', true)
    on conflict (tenant_id, username_key) do update
      set auth_user_id = excluded.auth_user_id, role_code = excluded.role_code, is_active = true
    returning id into v_user_b;

  -- ── Ayırt edici stok verisi ───────────────────────────────────────────
  -- Kalem KODLARI bilerek farklı: test, B'nin kaleminin kodunu A'nın
  -- oturumunda arayacak. Bulursa izolasyon kırılmış demektir.
  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (v_tenant_a, v_branch_a, 'A-UN', 'a-un', 'A İşletmesinin Unu', 'kg')
    on conflict (tenant_id, branch_id, code_key) do update set name = excluded.name
    returning id into v_item_a;

  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (v_tenant_b, v_branch_b, 'B-SEKER', 'b-seker', 'B İşletmesinin Şekeri', 'kg')
    on conflict (tenant_id, branch_id, code_key) do update set name = excluded.name
    returning id into v_item_b;

  -- Miktarlar da farklı: bakiye sızıntısı olursa sayıdan da anlaşılsın.
  insert into stock_movement (
    tenant_id, branch_id, stock_item_id, quantity_base, quantity_entered,
    uom_entered, reason, source_type, idempotency_key, occurred_at
  ) values
    (v_tenant_a, v_branch_a, v_item_a, 111, 111, 'kg', 'OPENING_BALANCE', 'g7-fixture', 'g7:a:acilis', now()),
    (v_tenant_b, v_branch_b, v_item_b, 222, 222, 'kg', 'OPENING_BALANCE', 'g7-fixture', 'g7:b:acilis', now())
  on conflict (tenant_id, idempotency_key) do nothing;

  raise notice 'A tenant=% user=% item=%', v_tenant_a, v_user_a, v_item_a;
  raise notice 'B tenant=% user=% item=%', v_tenant_b, v_user_b, v_item_b;
end $$;

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- Bu sorgu SÜPER KULLANICI olarak çalışır ve RLS'i ATLAR — yani burada iki
-- işletmeyi de görüyor olman NORMALDİR ve bir hata değildir. Asıl sınama,
-- uygulamanın kendi bağlantısıyla (npm run test:live) yapılır.
--
-- Beklenen: 2 satır — TESTA 111 kg, TESTB 222 kg.
select
  t.code                as isletme,
  si.code               as kalem,
  sum(sm.quantity_base) as bakiye,
  si.base_uom           as birim
from tenant t
join stock_item si     on si.tenant_id = t.id
join stock_movement sm on sm.stock_item_id = si.id
where t.code in ('TESTA','TESTB')
group by t.code, si.code, si.base_uom
order by t.code;

-- Her iki kullanıcının da doğru işletmeye bağlandığını göster.
-- Beklenen: 2 satır, farklı isletme değerleriyle.
select u.username, t.code as isletme, u.role_code, u.is_active
from app_user u join tenant t on t.id = u.tenant_id
where t.code in ('TESTA','TESTB')
order by t.code;
