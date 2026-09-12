-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · I12'nin CANLI sınaması — 0011 tetikleyicisi gerçekten çalışıyor mu?
--
-- ⚠️ BU DOSYA VERİTABANINA HİÇBİR ŞEY BIRAKMAZ. Sonunda bilerek bir hata
-- fırlatarak tüm işlemi geri alır (rollback). Bu yüzden Supabase SQL
-- Editor'de sonuç KIRMIZI BİR HATA KUTUSU olarak görünecek — DOĞRUSU BUDUR.
-- Rapor o kırmızı kutunun içinde yazacak.
--
-- Neden böyle: `stock_movement` append-only bir defterdir (0003), silme
-- tetikleyiciyle yasaklı. Yani sınama verisi bir kez yazılırsa BİR DAHA
-- SİLİNEMEZ. Üretim defterine sahte hareket bırakmamanın tek güvenli yolu,
-- hiç commit etmemektir.
--
-- Sınanan dört davranış:
--   1. +10 giriş           → kabul edilmeli
--   2. -15 çıkış (→ -5)    → MI012 ile REDDEDİLMELİ   ← asıl sınanan şey
--   3. -10 çıkış (→ 0)     → kabul edilmeli (tam sıfır sınırı, `< 0` mı `<= 0` mı)
--   4. +10'un ters kaydı   → kabul edilmeli (I3 > I12 muafiyeti, bakiye -10 olur)
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_tenant uuid;
  v_branch uuid;
  v_item   uuid;
  v_mv1    uuid;
  v_rapor  text := E'\n\n═══ I12 CANLI SINAMA RAPORU ═══\n';
  v_gecti  int  := 0;
  v_toplam int  := 4;
begin
  select id into v_tenant from public.tenant where code = 'MIYOP' limit 1;
  if v_tenant is null then
    raise exception 'MIYOP tenant bulunamadı — 0008 çalıştırıldı mı?';
  end if;

  select id into v_branch from public.branch where tenant_id = v_tenant limit 1;
  if v_branch is null then
    raise exception 'MIYOP tenant''ında şube bulunamadı — 0008 çalıştırıldı mı?';
  end if;

  -- Geçici stok kartı. Rollback ile o da yok olacak.
  insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_tenant, v_branch, 'I12-SINAMA', 'i12-sinama', 'I12 canlı sınama kalemi', 'kg')
  returning id into v_item;

  -- ── 1. +10 giriş: kabul edilmeli (bakiyeyi artırıyor, tetikleyici erken çıkar)
  begin
    insert into public.stock_movement (
      tenant_id, branch_id, stock_item_id, quantity_base, quantity_entered,
      uom_entered, reason, source_type, idempotency_key, occurred_at
    ) values (
      v_tenant, v_branch, v_item, 10, 10,
      'kg', 'OPENING_BALANCE', 'i12-sinama', 'i12:sinama:1', now()
    ) returning id into v_mv1;
    v_rapor := v_rapor || E'✓ 1. +10 giriş           → kabul edildi (beklenen)\n';
    v_gecti := v_gecti + 1;
  exception when others then
    v_rapor := v_rapor || format(E'✗ 1. +10 giriş           → BEKLENMEYEN RED: %s %s\n', sqlstate, sqlerrm);
  end;

  -- ── 2. -15 çıkış (bakiye -5 olurdu): MI012 ile REDDEDİLMELİ
  --    Asıl sınanan madde bu. Kabul edilirse tetikleyici çalışmıyor demektir.
  begin
    insert into public.stock_movement (
      tenant_id, branch_id, stock_item_id, quantity_base, quantity_entered,
      uom_entered, reason, source_type, idempotency_key, occurred_at
    ) values (
      v_tenant, v_branch, v_item, -15, -15,
      'kg', 'PRODUCTION_CONSUME', 'i12-sinama', 'i12:sinama:2', now()
    );
    v_rapor := v_rapor || E'✗ 2. -15 çıkış (→ -5)    → KABUL EDİLDİ! TETİKLEYİCİ ÇALIŞMIYOR.\n';
  exception
    when sqlstate 'MI012' then
      v_rapor := v_rapor || E'✓ 2. -15 çıkış (→ -5)    → MI012 ile reddedildi (beklenen)\n';
      v_gecti := v_gecti + 1;
    when others then
      v_rapor := v_rapor || format(E'✗ 2. -15 çıkış (→ -5)    → reddedildi ama YANLIŞ kodla: %s %s\n', sqlstate, sqlerrm);
  end;

  -- ── 3. -10 çıkış (bakiye tam 0): kabul edilmeli
  --    Sınır koşulu: kontrol `< 0` olmalı, `<= 0` değil. Stoğu tam bitirmek meşrudur.
  begin
    insert into public.stock_movement (
      tenant_id, branch_id, stock_item_id, quantity_base, quantity_entered,
      uom_entered, reason, source_type, idempotency_key, occurred_at
    ) values (
      v_tenant, v_branch, v_item, -10, -10,
      'kg', 'PRODUCTION_CONSUME', 'i12-sinama', 'i12:sinama:3', now()
    );
    v_rapor := v_rapor || E'✓ 3. -10 çıkış (→ 0)     → kabul edildi (tam sıfır sınırı doğru)\n';
    v_gecti := v_gecti + 1;
  exception when others then
    v_rapor := v_rapor || format(E'✗ 3. -10 çıkış (→ 0)     → YANLIŞ REDDEDİLDİ (kontrol <= 0 olmuş): %s %s\n', sqlstate, sqlerrm);
  end;

  -- ── 4. 1. hareketin ters kaydı (bakiye -10 olur): kabul edilmeli
  --    I3 > I12 muafiyeti. Reddedilirse asıl hareket düzeltilemez kalırdı.
  begin
    insert into public.stock_movement (
      tenant_id, branch_id, stock_item_id, quantity_base, quantity_entered,
      uom_entered, reason, source_type, reverses_movement_id, idempotency_key, occurred_at
    ) values (
      v_tenant, v_branch, v_item, -10, -10,
      'kg', 'REVERSAL', 'i12-sinama', v_mv1, 'i12:sinama:4', now()
    );
    v_rapor := v_rapor || E'✓ 4. +10''un ters kaydı   → kabul edildi, bakiye -10 (I3 > I12 muafiyeti çalışıyor)\n';
    v_gecti := v_gecti + 1;
  exception when others then
    v_rapor := v_rapor || format(E'✗ 4. +10''un ters kaydı   → YANLIŞ REDDEDİLDİ (muafiyet çalışmıyor): %s %s\n', sqlstate, sqlerrm);
  end;

  v_rapor := v_rapor || format(E'\nSONUÇ: %s/%s geçti.\n', v_gecti, v_toplam);

  if v_gecti = v_toplam then
    v_rapor := v_rapor || E'I12 veritabanı seviyesinde GERÇEKTEN zorlanıyor. ✅\n';
  else
    v_rapor := v_rapor || E'⚠️ EN AZ BİR DAVRANIŞ YANLIŞ — yukarıdaki ✗ satırlarına bakın.\n';
  end if;

  v_rapor := v_rapor || E'\n(Bu bir hata değil: sınama verisini üretim defterine\n'
                     || E'bırakmamak için işlem bilerek geri alındı.)\n'
                     || E'══════════════════════════════\n';

  -- Bilerek: tüm sınama verisini geri alır. Rapor bu mesajın içinde.
  raise exception '%', v_rapor;
end $$;
