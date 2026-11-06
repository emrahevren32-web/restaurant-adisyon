\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0093 · ŞAHİT NUMUNE
--
-- Sorular:
--   1 · Üretim sorumlusu numune alabiliyor mu?           → ALABİLMELİ
--   2 · Kalite sorumlusu numune alabiliyor mu?           → ALABİLMELİ
--   3 · Depo sorumlusu numune alabiliyor mu?             → ALAMAMALI
--   4 · Saklama koşulu ÜRÜN KARTINDAN mı geliyor?        → EVET, kopyalanmalı
--   5 · Ekranın yazdığı koşul yok sayılıyor mu?          → YOK SAYILMALI
--   6 · Saklama sonu PARTİDEN mi türetiliyor?            → EVET
--   7 · Ekranın yazdığı saklama sonu yok sayılıyor mu?   → YOK SAYILMALI
--   8 · İmza sunucuda mı yazılıyor?                      → EVET
--   9 · SKT'siz partiden numune alınabiliyor mu?         → ALINAMAMALI
--  10 · Saklama koşulu tanımsız üründen?                 → ALINAMAMALI
--  11 · Numune satırı silinebiliyor mu?                  → SİLİNEMEMELİ
--  12 · Numune satırı değiştirilebiliyor mu?             → DEĞİŞTİRİLEMEMELİ
--  13 · Açılış gerekçesiz yazılabiliyor mu?              → YAZILAMAMALI
--  14 · Açılış durumu ACILDI yapıyor mu?                 → EVET
--  15 · Olay kaydı değiştirilebiliyor mu?                → DEĞİŞTİRİLEMEMELİ
--  16 · İmha durumu IMHA yapıyor mu?                     → EVET
--  17 · İmhadan sonra yeni olay yazılabiliyor mu?        → YAZILAMAMALI
--  18 · Aynı partide ikinci AÇIK numune?                 → AÇILAMAMALI
--  19 · İmhadan sonra yeniden numune alınabiliyor mu?    → ALINABİLMELİ
--  20 · Numune denetim kaydına düşüyor mu?               → DÜŞMELİ
-- ═══════════════════════════════════════════════════════════════════════════

-- ⚠️ 06.11.2026 · `coalesce` EKLENDİ VE SEBEBİ ŞU:
-- Bu dosya kırmızı verdiğinde ekrana sadece şu düşüyordu:
--     ✗ <NULL>
-- Yani HANGİ iddianın düştüğü söylenmiyordu. Sebep: iddia metinleri
-- ölçülen değeri içine katıyor ('... (gelen: '||v_kosul||')') ve o değer
-- NULL olunca METNİN TAMAMI NULL oluyor. Yani ölçümün başarısızlığı,
-- ölçümün ADINI da siliyordu.
-- ⚠️ Bir ölçüm aracının kırmızısı okunamıyorsa, o araca bakılmaz olur.
-- Ad üretilemediğinde bunu AÇIKÇA söylüyoruz; NULL'u sessizce boş metne
-- çevirmek de aynı bilgiyi gizlerdi.
create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
declare v_ad text := coalesce(p_ad,
  '(iddia metni NULL uretti - olculen deger NULL demektir)');
begin
  if p_kosul then raise notice '  ✓ %', v_ad;
  else raise exception '  ✗ %', v_ad; end if;
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
  v_t uuid; v_f uuid; v_b uuid; v_rol text; v_auth uuid; v_app uuid;
  v_kalem uuid; v_kalemsiz uuid;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);

  foreach v_rol in array array['uretim_sorumlusu','kalite_sorumlusu','depo_sorumlusu'] loop
    v_auth := gen_random_uuid(); v_app := gen_random_uuid();
    insert into auth.users (id, email) values (v_auth, 'p93.'||v_rol||'@o.local');
    insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                                 username_key, full_name, role_code, is_active)
    values (v_app, v_t, v_f, v_auth, 'p93'||left(md5(v_rol),6),
            'p93'||left(md5(v_rol),6), v_rol, v_rol, true);
    perform set_config('prova.auth.'||v_rol, v_auth::text, false);
    perform set_config('prova.app.'||v_rol,  v_app::text,  false);
  end loop;

  -- Saklama koşulu TANIMLI ürün
  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition)
  values (v_kalem, v_t, v_b, 'P93-CORBA', 'p93-corba', 'Prova Corbasi', 'kg',
          true, true, true, '-18 °C');
  perform set_config('prova.kalem', v_kalem::text, false);

  -- Saklama koşulu TANIMSIZ ürün
  v_kalemsiz := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active)
  values (v_kalemsiz, v_t, v_b, 'P93-KOSULSUZ', 'p93-kosulsuz', 'Kosulsuz Urun',
          'kg', true, true, true);
  perform set_config('prova.kalemsiz', v_kalemsiz::text, false);

  -- SKT'li parti, SKT'siz parti, ikinci SKT'li parti
  insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id, lot_code,
                                lot_code_key, expires_on, origin_type)
  values
    (gen_random_uuid(), v_t, v_b, v_kalem,    'P93-LOT1', 'p93-lot1',
      current_date + 90, 'PRODUCTION'),
    (gen_random_uuid(), v_t, v_b, v_kalem,    'P93-LOT2', 'p93-lot2',
      current_date + 60, 'PRODUCTION'),
    (gen_random_uuid(), v_t, v_b, v_kalem,    'P93-SKTSIZ', 'p93-sktsiz',
      null, 'PRODUCTION'),
    (gen_random_uuid(), v_t, v_b, v_kalemsiz, 'P93-KOSULSUZ-LOT', 'p93-kosulsuz-lot',
      current_date + 90, 'PRODUCTION');

  perform set_config('prova.lot1',
    (select id::text from public.stock_lot where lot_code_key = 'p93-lot1'), false);
  perform set_config('prova.lot2',
    (select id::text from public.stock_lot where lot_code_key = 'p93-lot2'), false);
  perform set_config('prova.sktsiz',
    (select id::text from public.stock_lot where lot_code_key = 'p93-sktsiz'), false);
  perform set_config('prova.kosulsuzlot',
    (select id::text from public.stock_lot where lot_code_key = 'p93-kosulsuz-lot'), false);

  raise notice 'KURULUM TAMAM';
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid) to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;

-- ── SINAMALAR ─────────────────────────────────────────────────────────────
do $$
declare
  v_kod text;
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_k uuid := current_setting('prova.kalem')::uuid;
  v_id uuid; v_kosul text; v_sonu date; v_imza uuid; v_durum text; v_n int;
begin
  raise notice '── KİM NUMUNE ALABİLİR';

  -- 1 · ÜRETİM alabilmeli
  perform prova_oturum(current_setting('prova.auth.uretim_sorumlusu')::uuid);
  begin
    insert into public.witness_sample (tenant_id, branch_id, stock_item_id, lot_id,
      sample_code, sample_code_key, storage_condition, keep_until)
    values (v_t, v_b, v_k, current_setting('prova.lot1')::uuid,
      'NUM-1', 'num-1', 'EKRANIN YAZDIGI', date '2000-01-01');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('1 · URETIM sorumlusu numune ALABILIYOR (gelen: '||v_kod||')',
    v_kod = '00000');

  -- 2 · KALİTE alabilmeli
  perform prova_oturum(current_setting('prova.auth.kalite_sorumlusu')::uuid);
  begin
    insert into public.witness_sample (tenant_id, branch_id, stock_item_id, lot_id,
      sample_code, sample_code_key, storage_condition, keep_until)
    values (v_t, v_b, v_k, current_setting('prova.lot2')::uuid,
      'NUM-2', 'num-2', 'x', date '2000-01-01');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('2 · KALITE sorumlusu numune ALABILIYOR (gelen: '||v_kod||')',
    v_kod = '00000');

  -- 3 · DEPO alamamalı
  perform prova_oturum(current_setting('prova.auth.depo_sorumlusu')::uuid);
  begin
    insert into public.witness_sample (tenant_id, branch_id, stock_item_id, lot_id,
      sample_code, sample_code_key, storage_condition, keep_until)
    values (v_t, v_b, v_k, current_setting('prova.sktsiz')::uuid,
      'NUM-X', 'num-x', 'x', date '2000-01-01');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('3 · DEPO sorumlusu numune ALAMIYOR (gelen: '||v_kod||')',
    v_kod = 'MI403');

  raise notice '── TÜRETME: EKRANIN YAZDIĞI DEĞİL, KAYNAĞIN SÖYLEDİĞİ';
  perform prova_oturum(current_setting('prova.auth.uretim_sorumlusu')::uuid);

  -- ⚠️ 06.11.2026 · ARAMA ANAHTARI DÜZELTİLDİ.
  -- Eskisi `sample_code_key = 'num-1'` diyordu ve HİÇ SATIR BULMUYORDU.
  -- Sebep: **0094** anahtarı artık ekranın gönderdiğinden değil
  -- `app.kimlik_anahtari()`den türetiyor ve o fonksiyon BÜYÜK HARFE
  -- çeviriyor (`num-1` → `NUM-1`), böylece `num-1` ile `NUM-1` aynı
  -- numune sayılıyor — tekillik kuralının tam olarak istediği şey.
  -- ⚠️ Yani kırmızı, 0094'ün ÇALIŞTIĞINI gösteriyordu; prova 0093'ün
  -- hâlini savunuyordu. Anahtar artık sabit yazılmıyor, FONKSİYONDAN
  -- alınıyor — kural bir daha değişirse prova kendiliğinden uyar.
  select id, storage_condition, keep_until, taken_by
    into v_id, v_kosul, v_sonu, v_imza
    from public.witness_sample
   where sample_code_key = app.kimlik_anahtari('NUM-1');

  -- 4-5 · koşul ürün kartından geldi, ekranınki yok sayıldı
  perform prova_bak('4 · saklama kosulu URUN KARTINDAN geldi (gelen: '||v_kosul||')',
    v_kosul = '-18 °C');
  perform prova_bak('5 · ekranin yazdigi kosul YOK SAYILDI',
    v_kosul <> 'EKRANIN YAZDIGI');

  -- 6-7 · saklama sonu partiden geldi, ekranınki yok sayıldı
  perform prova_bak('6 · saklama sonu PARTININ SKT''sinden turetildi',
    v_sonu = current_date + 90);
  perform prova_bak('7 · ekranin yazdigi saklama sonu YOK SAYILDI',
    v_sonu <> date '2000-01-01');

  -- 8 · imza sunucuda
  perform prova_bak('8 · imzayi SUNUCU yazdi (uretim sorumlusu)',
    v_imza = current_setting('prova.app.uretim_sorumlusu')::uuid);

  raise notice '── REDDEDİLENLER';

  -- 9 · SKT'siz parti
  begin
    insert into public.witness_sample (tenant_id, branch_id, stock_item_id, lot_id,
      sample_code, sample_code_key, storage_condition, keep_until)
    values (v_t, v_b, v_k, current_setting('prova.sktsiz')::uuid,
      'NUM-3', 'num-3', 'x', current_date);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('9 · SKT''siz partiden numune ALINAMIYOR (gelen: '||v_kod||')',
    v_kod = 'MI422');

  -- 10 · saklama koşulu tanımsız ürün
  begin
    insert into public.witness_sample (tenant_id, branch_id, stock_item_id, lot_id,
      sample_code, sample_code_key, storage_condition, keep_until)
    values (v_t, v_b, current_setting('prova.kalemsiz')::uuid,
      current_setting('prova.kosulsuzlot')::uuid,
      'NUM-4', 'num-4', 'x', current_date);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('10 · saklama kosulu TANIMSIZ urunden ALINAMIYOR (gelen: '||v_kod||')',
    v_kod = 'MI422');

  -- 11-12 · satır silinemez / değiştirilemez
  begin
    delete from public.witness_sample where id = v_id;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('11 · numune satiri SILINEMIYOR (gelen: '||v_kod||')',
    v_kod <> '00000');

  begin
    update public.witness_sample set status = 'IMHA' where id = v_id;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('12 · numune satiri DEGISTIRILEMIYOR (gelen: '||v_kod||')',
    v_kod <> '00000');

  raise notice '── OLAY DEFTERİ';

  -- 13 · gerekçesiz açılış
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type)
    values (v_t, v_id, 'ACILDI');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('13 · GEREKCESIZ acilis YAZILAMIYOR (gelen: '||v_kod||')',
    v_kod <> '00000');

  -- 14 · gerekçeli açılış durumu değiştiriyor
  insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason, result)
  values (v_t, v_id, 'ACILDI', 'Musteri itirazi: koku sikayeti', 'Urun uygun bulundu');
  select status into v_durum from public.witness_sample where id = v_id;
  perform prova_bak('14 · acilis durumu ACILDI yapti (gelen: '||v_durum||')',
    v_durum = 'ACILDI');

  -- 15 · olay değiştirilemez
  begin
    update public.witness_sample_event set result = 'degistirildi'
     where sample_id = v_id;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  -- ⚠️ Gelen kod `42501` (yetki yok), `MI403` değil — ve bu DOĞRU.
  -- İki savunma hattı var: (a) `authenticated` rolüne UPDATE yetkisi hiç
  -- verilmedi, (b) verilse bile `numune_olayi_degismez` tetiği reddediyor.
  -- Dıştaki hat önce ateşliyor. Burada "reddedildi mi" sınanıyor; tetiğin
  -- VARLIĞI aşağıda ayrıca ölçülüyor, çünkü bir gün biri UPDATE yetkisi
  -- verirse ikinci hat tek başına kalacak.
  perform prova_bak('15 · olay kaydi DEGISTIRILEMIYOR (gelen: '||v_kod||')',
    v_kod <> '00000');

  perform prova_bak('15b · degismezlik tetigi DURUYOR (ikinci savunma hatti)',
    exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
             where c.relname = 'witness_sample_event'
               and g.tgname = 'numune_olayi_degismez' and not g.tgisinternal));

  -- 16 · imha
  -- ⚠️ 06.11.2026 · BU BÖLÜM 0097'DEN SONRA DÜZELTİLDİ.
  -- Eskiden imhayı ÜRETİM SORUMLUSU yazıyordu ve prova geçiyordu.
  -- **0097 (numune imhasi onaydir)** o kapıyı bilerek daralttı: imhayı
  -- işletme müdürü onaylar, müdür yoksa gıda mühendisi ya da kalite
  -- sorumlusu. Prova eski hâli savunduğu için kırmızı veriyordu — yani
  -- kırmızı, 0097'nin ÇALIŞTIĞINI gösteriyordu.
  --
  -- ⚠️ Eski iddia silinmedi, OLUMSUZ KONTROLE çevrildi: imhayı yazamayan
  -- rolün yazamadığını görmek, kuralın yarısı değil tamamıdır.
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
    values (v_t, v_id, 'IMHA', 'uretim sorumlusu imha yazmayi deniyor');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('16a · ⚠️ URETIM sorumlusu IMHA YAZAMIYOR (0097) (gelen: '
    ||v_kod||')', v_kod <> '00000');

  -- Onaylayabilen role geçiliyor.
  perform prova_oturum(current_setting('prova.auth.kalite_sorumlusu')::uuid);

  insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
  values (v_t, v_id, 'IMHA', 'SKT doldu, imha edildi');
  select status into v_durum from public.witness_sample where id = v_id;
  perform prova_bak('16b · KALITE sorumlusu imhayi ONAYLADI, durum IMHA (gelen: '
    ||v_durum||')', v_durum = 'IMHA');

  -- 17 · imhadan sonra yeni olay
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
    values (v_t, v_id, 'ACILDI', 'tekrar acalim');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('17 · IMHA sonrasi yeni olay YAZILAMIYOR (gelen: '||v_kod||')',
    v_kod = 'MI409');

  raise notice '── PARTİ BAŞINA TEK AÇIK NUMUNE';

  -- 18 · lot2'nin zaten açık numunesi var (num-2)
  begin
    insert into public.witness_sample (tenant_id, branch_id, stock_item_id, lot_id,
      sample_code, sample_code_key, storage_condition, keep_until)
    values (v_t, v_b, v_k, current_setting('prova.lot2')::uuid,
      'NUM-5', 'num-5', 'x', current_date);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('18 · ayni partide IKINCI ACIK numune ACILAMIYOR (gelen: '||v_kod||')',
    v_kod = '23505');

  -- 19 · lot1'in numunesi imha edildi → yeniden alınabilmeli
  begin
    insert into public.witness_sample (tenant_id, branch_id, stock_item_id, lot_id,
      sample_code, sample_code_key, storage_condition, keep_until)
    values (v_t, v_b, v_k, current_setting('prova.lot1')::uuid,
      'NUM-6', 'num-6', 'x', current_date);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('19 · IMHA sonrasi ayni partiden YENIDEN alinabiliyor (gelen: '
    ||v_kod||')', v_kod = '00000');

  -- 20 · denetim
  select count(*) into v_n from public.audit_log
   where table_name in ('witness_sample','witness_sample_event');
  perform prova_bak('20 · numune DENETIME dusuyor (gelen: '||v_n||' kayit)', v_n >= 4);
end $$;

rollback;
