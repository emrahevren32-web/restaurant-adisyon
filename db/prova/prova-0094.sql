\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0094 · ŞAHİT NUMUNE — KİRACI SINIRI, KİLİT, AÇIK RAF ÖMRÜ
--
-- Bu prova, 0093'te BENİM BIRAKTIĞIM üç kusuru ölçer (Codex buldu):
--
--   MIYOP-075 · P0 · `app.numune_olayi()` numuneyi YALNIZ id ile buluyordu.
--      Fonksiyon `security definer` olduğu için RLS'i atlıyor; olay satırının
--      kendi `tenant_id`si kendi kiracısını gösterdiği için RLS de geçiyordu.
--      Sonuç: A kiracısındaki bir kullanıcı, B kiracısının numunesinin
--      durumunu değiştirebiliyordu.
--      ⚠️ AYNI KUSUR `app.numune_turet()`te de vardı: parti, şube ve iş emri
--      id'leri kiracı doğrulanmadan okunuyordu. Codex birini gösterdi;
--      ölçüm ikincisini de buldu. Bu prova İKİSİNİ de sınar.
--
--   MIYOP-077 · P1 · Durum okuması KİLİTSİZDİ. Eşzamanlı iki olay
--      (ACILDI + IMHA) birbirinin üstüne yazabilirdi.
--      ⚠️ Eşzamanlılık tek oturumlu, geri alınan bir provada CANLANDIRILAMAZ.
--      Bu yüzden burada YAPISAL ölçülüyor: fonksiyonun gövdesinde satır
--      kilidi var mı? Bunu "eşzamanlılık sınandı" diye yazmak yalan olurdu.
--
--   MIYOP-076 · P1 · `opened_shelf_life_days` HİÇ KULLANILMIYORDU. Yazılı
--      kural "açılmış ise açık kalmaya uygun olduğu gün kadar" diyordu ama
--      numune açıldıktan sonra da saklama sonu partinin SKT'si kalıyordu.
--      Yani ekranda bir alan vardı, hiçbir şey yapmıyordu — "mış gibi".
--
-- Sorular:
--   1 · A kiracısı, B'nin numunesine olay yazabiliyor mu?   → YAZAMAMALI
--   2 · B'nin numunesinin durumu değişti mi?                → DEĞİŞMEMELİ
--   3 · A kiracısı, B'nin PARTİSİNDEN numune alabilir mi?   → ALAMAMALI
--   4 · A kiracısı, B'nin ŞUBESİNE numune yazabilir mi?     → YAZAMAMALI
--   5 · Olayın kiracısı istemciden mi geliyor?              → SUNUCUDAN
--   6 · Durum okuması satır kilidi alıyor mu?               → ALMALI (yapısal)
--   7 · Açık raf ömrü ÜRÜN KARTINDAN mı kopyalanıyor?       → EVET
--   8 · Ekranın yazdığı açık raf ömrü yok sayılıyor mu?     → YOK SAYILMALI
--   9 · Mühürlüyken saklama sonu partinin SKT'si mi?        → EVET
--  10 · Açılınca saklama sonu KISALIYOR mu?                 → KISALMALI
--  11 · Açık pencere SKT'yi AŞIYORSA uzuyor mu?             → UZAMAMALI
--  12 · Açık raf ömrü tanımsızsa saklama sonu değişiyor mu? → DEĞİŞMEMELİ
--  13 · Saklama sonu değişikliği denetime düşüyor mu?       → DÜŞMELİ
--  14 · 0093'ün kuralları hâlâ ayakta mı? (koşul kopyası)   → AYAKTA
--  15 · Numune kodu anahtarı sunucuda mı türetiliyor?       → SUNUCUDA
--  16 · Aynı kod farklı yazımla ikinci kez yazılabilir mi?  → YAZILAMAMALI
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

create or replace function prova_oturum(p_auth uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', current_setting('prova.t'))::text, false);
  perform set_config('app.tenant_id', current_setting('prova.t'), false);
end; $$;

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid; v_f uuid; v_b uuid; v_auth uuid; v_app uuid;
  v_kalem uuid; v_kisa uuid; v_acikyok uuid;
  v_tb uuid; v_fb uuid; v_bb uuid; v_kalemb uuid; v_lotb uuid; v_numuneb uuid;
begin
  -- ── A KİRACISI (bizim kullanıcımız) ─────────────────────────────────────
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);

  v_auth := gen_random_uuid(); v_app := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p94.uretim@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_app, v_t, v_f, v_auth, 'p94uretim', 'p94uretim',
          'Prova Uretim', 'uretim_sorumlusu', true);
  perform set_config('prova.auth', v_auth::text, false);
  perform set_config('prova.app',  v_app::text,  false);

  -- Ürün 1: açık raf ömrü 2 gün (SKT'den KISA pencere)
  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition, opened_shelf_life_days)
  values (v_kalem, v_t, v_b, 'P94-CORBA', 'p94-corba', 'Prova Corbasi', 'kg',
          true, true, true, '-18 °C', 2);
  perform set_config('prova.kalem', v_kalem::text, false);

  -- Ürün 2: açık raf ömrü 30 gün ama partinin SKT'si 1 gün (pencere UZUN)
  v_kisa := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition, opened_shelf_life_days)
  values (v_kisa, v_t, v_b, 'P94-KISA', 'p94-kisa', 'Kisa SKT Urun', 'kg',
          true, true, true, '0-4 °C', 30);
  perform set_config('prova.kisa', v_kisa::text, false);

  -- Ürün 3: açık raf ömrü TANIMSIZ
  v_acikyok := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition)
  values (v_acikyok, v_t, v_b, 'P94-ACIKYOK', 'p94-acikyok', 'Acik Omru Yok', 'kg',
          true, true, true, '-18 °C');
  perform set_config('prova.acikyok', v_acikyok::text, false);

  insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id, lot_code,
                                lot_code_key, expires_on, origin_type)
  values
    (gen_random_uuid(), v_t, v_b, v_kalem,   'P94-L1', 'p94-l1', current_date + 90, 'PRODUCTION'),
    (gen_random_uuid(), v_t, v_b, v_kisa,    'P94-L2', 'p94-l2', current_date +  1, 'PRODUCTION'),
    (gen_random_uuid(), v_t, v_b, v_acikyok, 'P94-L3', 'p94-l3', current_date + 90, 'PRODUCTION');
  perform set_config('prova.l1', (select id::text from public.stock_lot where lot_code_key='p94-l1'), false);
  perform set_config('prova.l2', (select id::text from public.stock_lot where lot_code_key='p94-l2'), false);
  perform set_config('prova.l3', (select id::text from public.stock_lot where lot_code_key='p94-l3'), false);

  -- ── B KİRACISI (BAŞKA bir müşteri) ──────────────────────────────────────
  v_tb := gen_random_uuid(); v_fb := gen_random_uuid(); v_bb := gen_random_uuid();
  insert into public.tenant (id, code, name) values (v_tb, 'P94B', 'Prova B Kiracisi');
  insert into public.company (id, tenant_id, company_code, company_name)
    values (v_fb, v_tb, 'P94B-F', 'Prova B Firma');
  insert into public.branch (id, tenant_id, company_id, code, name, branch_type,
                             is_active, is_head_office)
    values (v_bb, v_tb, v_fb, 'P94B-M', 'Prova B Merkez', 'merkez', true, true);

  v_kalemb := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition, opened_shelf_life_days)
  values (v_kalemb, v_tb, v_bb, 'P94B-URUN', 'p94b-urun', 'B Urunu', 'kg',
          true, true, true, '-18 °C', 3);

  v_lotb := gen_random_uuid();
  insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id, lot_code,
                                lot_code_key, expires_on, origin_type)
  values (v_lotb, v_tb, v_bb, v_kalemb, 'P94B-LOT', 'p94b-lot',
          current_date + 90, 'PRODUCTION');
  perform set_config('prova.lotb', v_lotb::text, false);
  perform set_config('prova.bb',   v_bb::text,   false);

  -- B'nin numunesi. Kiracı bağlamını B'ye alıp yazıyoruz: 0094 sonrası
  -- türetme kiracıyı SUNUCUDAN okuyor, uydurma tenant_id kabul etmiyor.
  perform set_config('app.tenant_id', v_tb::text, false);
  v_numuneb := gen_random_uuid();
  insert into public.witness_sample (id, tenant_id, branch_id, stock_item_id, lot_id,
                                     sample_code, sample_code_key, storage_condition,
                                     keep_until)
  values (v_numuneb, v_tb, v_bb, v_kalemb, v_lotb, 'B-NUM-1', 'b-num-1',
          'x', current_date);
  perform set_config('prova.numuneb', v_numuneb::text, false);
  perform set_config('app.tenant_id', v_t::text, false);

  raise notice 'KURULUM TAMAM';
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid) to authenticated;
grant usage on schema public to authenticated;

-- ── 6 · YAPISAL: DURUM OKUMASI KİLİTLİ Mİ? (MIYOP-077) ───────────────────
-- ⚠️ Rol değişmeden, okuma olarak. Eşzamanlılık canlandırılamadığı için
-- kilidin VARLIĞI ölçülüyor; "iki oturum denendi" demiyoruz.
do $$
declare v_govde text;
begin
  select pg_get_functiondef(p.oid) into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'numune_olayi';
  perform prova_bak('6 · durum okuması satır kilidi alıyor (for update)',
    v_govde ~* 'for\s+update');
end $$;

set local role authenticated;

-- ── SINAMALAR ─────────────────────────────────────────────────────────────
do $$
declare
  v_t  uuid := current_setting('prova.t')::uuid;
  v_b  uuid := current_setting('prova.b')::uuid;
  v_bb uuid := current_setting('prova.bb')::uuid;
  v_numuneb uuid := current_setting('prova.numuneb')::uuid;
  v_lotb uuid := current_setting('prova.lotb')::uuid;
  v_n1 uuid; v_n2 uuid; v_n3 uuid;
  v_durum text; v_sure date; v_acik integer; v_kiraci uuid; v_kod text;
  v_sayi integer;
begin
  perform prova_oturum(current_setting('prova.auth')::uuid);

  -- ── 1 · A, B'NİN NUMUNESİNE OLAY YAZAMAZ (MIYOP-075) ──────────────────
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
    values (v_t, v_numuneb, 'ACILDI', 'çapraz kiracı denemesi');
    perform prova_bak('1 · A kiracısı B''nin numunesine olay YAZAMAZ', false);
  exception
    when sqlstate 'MI404' then
      perform prova_bak('1 · A kiracısı B''nin numunesine olay YAZAMAZ', true);
    when others then
      perform prova_bak('1 · reddedildi ama MI404 değil: ' || sqlstate, false);
  end;

  -- ── 3 · A, B'NİN PARTİSİNDEN NUMUNE ALAMAZ ────────────────────────────
  begin
    insert into public.witness_sample (tenant_id, branch_id, stock_item_id, lot_id,
                                       sample_code, sample_code_key,
                                       storage_condition, keep_until)
    values (v_t, v_b, null, v_lotb, 'A-CAPRAZ-1', 'a-capraz-1', 'x', current_date);
    perform prova_bak('3 · A kiracısı B''nin PARTİSİNDEN numune ALAMAZ', false);
  exception
    when sqlstate 'MI404' then
      perform prova_bak('3 · A kiracısı B''nin PARTİSİNDEN numune ALAMAZ', true);
    when others then
      perform prova_bak('3 · reddedildi ama MI404 değil: ' || sqlstate, false);
  end;

  -- ── 4 · A, B'NİN ŞUBESİNE NUMUNE YAZAMAZ ──────────────────────────────
  begin
    insert into public.witness_sample (tenant_id, branch_id, stock_item_id, lot_id,
                                       sample_code, sample_code_key,
                                       storage_condition, keep_until)
    values (v_t, v_bb, null, current_setting('prova.l1')::uuid,
            'A-CAPRAZ-2', 'a-capraz-2', 'x', current_date);
    perform prova_bak('4 · A kiracısı B''nin ŞUBESİNE numune YAZAMAZ', false);
  exception
    when sqlstate 'MI404' then
      perform prova_bak('4 · A kiracısı B''nin ŞUBESİNE numune YAZAMAZ', true);
    when others then
      perform prova_bak('4 · reddedildi ama MI404 değil: ' || sqlstate, false);
  end;

  -- ── 7/8/9 · AÇIK RAF ÖMRÜ KARTTAN KOPYALANIYOR (MIYOP-076) ────────────
  v_n1 := gen_random_uuid();
  insert into public.witness_sample (id, tenant_id, branch_id, stock_item_id, lot_id,
                                     sample_code, sample_code_key, storage_condition,
                                     keep_until, opened_shelf_life_days)
  values (v_n1, v_t, v_b, null, current_setting('prova.l1')::uuid,
          'P94-N1', 'p94-n1',
          'EKRANIN YAZDIĞI KOŞUL',      -- yok sayılmalı (0093)
          current_date,                  -- yok sayılmalı (0093)
          999);                          -- yok sayılmalı (0094)

  select storage_condition, keep_until, opened_shelf_life_days
    into v_kod, v_sure, v_acik
    from public.witness_sample where id = v_n1;

  perform prova_bak('7 · açık raf ömrü ÜRÜN KARTINDAN kopyalandı (2 gün)',
    v_acik = 2);
  perform prova_bak('8 · ekranın yazdığı açık raf ömrü (999) YOK SAYILDI',
    v_acik <> 999);
  perform prova_bak('9 · mühürlüyken saklama sonu partinin SKT''si',
    v_sure = current_date + 90);
  perform prova_bak('14 · 0093 ayakta: saklama koşulu karttan kopyalandı',
    v_kod = '-18 °C');

  -- ── 10 · AÇILINCA SAKLAMA SONU KISALIYOR ──────────────────────────────
  insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason, result)
  values (v_t, v_n1, 'ACILDI', 'müşteri itirazı', 'ürün uygun');

  select status, keep_until into v_durum, v_sure
    from public.witness_sample where id = v_n1;
  perform prova_bak('10a · açılış durumu ACILDI yaptı', v_durum = 'ACILDI');
  perform prova_bak('10b · saklama sonu açık raf ömrüne KISALDI (bugün + 2)',
    v_sure = current_date + 2);

  -- ── 5 · OLAYIN KİRACISI SUNUCUDAN ─────────────────────────────────────
  -- Uydurma tenant_id (B) gönderiliyor; sunucu A'ya düzeltmeli.
  insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
  values (current_setting('prova.numuneb')::uuid,  -- uuid ama kiracı değil: uydurma
          v_n1, 'ACILDI', 'kiracı uydurma denemesi')
  returning tenant_id into v_kiraci;
  perform prova_bak('5 · olayın kiracısı SUNUCUDAN yazıldı', v_kiraci = v_t);

  -- ── 11 · AÇIK PENCERE SKT''Yİ AŞIYORSA UZAMAZ ─────────────────────────
  v_n2 := gen_random_uuid();
  insert into public.witness_sample (id, tenant_id, branch_id, stock_item_id, lot_id,
                                     sample_code, sample_code_key, storage_condition, keep_until)
  values (v_n2, v_t, v_b, null, current_setting('prova.l2')::uuid,
          'P94-N2', 'p94-n2', 'x', current_date);
  insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
  values (v_t, v_n2, 'ACILDI', 'kısa SKT denemesi');
  select keep_until into v_sure from public.witness_sample where id = v_n2;
  perform prova_bak('11 · açık pencere (30g) SKT''yi (1g) AŞMADI',
    v_sure = current_date + 1);

  -- ── 12 · AÇIK RAF ÖMRÜ TANIMSIZSA SAKLAMA SONU DEĞİŞMEZ ───────────────
  v_n3 := gen_random_uuid();
  insert into public.witness_sample (id, tenant_id, branch_id, stock_item_id, lot_id,
                                     sample_code, sample_code_key, storage_condition, keep_until)
  values (v_n3, v_t, v_b, null, current_setting('prova.l3')::uuid,
          'P94-N3', 'UYDURMA-ANAHTAR', 'x', current_date);
  insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
  values (v_t, v_n3, 'ACILDI', 'açık ömür yok denemesi');
  select keep_until, opened_shelf_life_days into v_sure, v_acik
    from public.witness_sample where id = v_n3;
  perform prova_bak('12a · açık raf ömrü tanımsız kaldı', v_acik is null);
  perform prova_bak('12b · saklama sonu DEĞİŞMEDİ (parti SKT''si)',
    v_sure = current_date + 90);

  -- ── 15/16 · KOD ANAHTARI SUNUCUDA TÜRETİLİYOR ─────────────────────────
  -- ⚠️ `l3` partisinin numunesi (v_n3) 'P94-N3' koduyla, anahtarı UYDURMA
  -- gönderilerek yazıldı mı? Anahtar sunucuda türetilmiş olmalı.
  select sample_code_key into v_kod
    from public.witness_sample where id = v_n3;
  perform prova_bak('15 · kod anahtarı sunucuda türetildi (P94-N3)',
    v_kod = 'P94-N3');

  -- Aynı kod, farklı yazım. İstemci anahtarı farklı gönderse bile tekillik
  -- indeksi yakalamalı — anahtar artık istemciden gelmiyor.
  begin
    insert into public.witness_sample (tenant_id, branch_id, stock_item_id, lot_id,
                                       sample_code, sample_code_key,
                                       storage_condition, keep_until)
    values (v_t, v_b, null, current_setting('prova.l2')::uuid,
            'p94-n3', 'BAMBASKA-ANAHTAR', 'x', current_date);
    perform prova_bak('16 · aynı kod farklı yazımla İKİNCİ KEZ yazılamaz', false);
  exception
    when unique_violation then
      perform prova_bak('16 · aynı kod farklı yazımla İKİNCİ KEZ yazılamaz', true);
    when others then
      perform prova_bak('16 · reddedildi ama tekillik ihlali değil: ' || sqlstate, false);
  end;

  -- ── 13 · SAKLAMA SONU DEĞİŞİKLİĞİ DENETİME DÜŞTÜ ──────────────────────
  select count(*) into v_sayi from public.audit_log
   where table_name = 'witness_sample' and action = 'UPDATE'
     and row_id = v_n1::text;
  perform prova_bak('13 · saklama sonu değişikliği denetim kaydına düştü',
    v_sayi >= 1);

  raise notice '--- A KİRACISI SINAMALARI BİTTİ ---';
end $$;

reset role;

-- ── 2 · B'NİN NUMUNESİ DOKUNULMAMIŞ MI? ──────────────────────────────────
-- ⚠️ Rol sıfırlandı: B'nin satırını A'nın RLS'i altında okuyamazdık, ve
-- okuyamamak "değişmedi" demek değildir. Doğrudan bakıyoruz.
do $$
declare v_durum text;
begin
  select status into v_durum from public.witness_sample
   where id = current_setting('prova.numuneb')::uuid;
  perform prova_bak('2 · B''nin numunesinin durumu DEĞİŞMEDİ (SAKLANIYOR)',
    v_durum = 'SAKLANIYOR');
end $$;

do $$ begin raise notice '═══ PROVA 0094 · HEPSİ YEŞİL ═══'; end $$;

rollback;
