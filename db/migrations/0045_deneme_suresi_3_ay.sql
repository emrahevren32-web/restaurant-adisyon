-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0045 · Standart deneme süresi 3 ay
--
-- Emrah kararı (2026-09-26): **standart 3 + 3.** İlk üye olan herkese üç ay
-- ücretsiz; sonunda üç ay daha ek süre; kalacaksa altıncı aydan itibaren
-- fiyatlandırma.
--
-- ⚠️ BU BİR SINIR DEĞİL, VARSAYILAN. "İstediğim kadar deneme verebileyim"
-- dedi ve sistem zaten buna izin veriyor: `lisansi_uzat` ya ay sayısı ya da
-- DOĞRUDAN BİR TARİH alır. Potansiyel bir müşteriye bir hafta da verilebilir,
-- bir yıl da. Değişen yalnız yeni açılan lisansın başlangıç süresi.
-- ═══════════════════════════════════════════════════════════════════════════

update license_package
   set trial_days = 90, updated_at = now()
 where trial_days = 30;

comment on column license_package.trial_days is
  'Yeni lisansın VARSAYILAN deneme günü (standart 3 ay = 90). Üst sınır değil; '
  'platform istediği tarihe kadar uzatabilir (app.lisansi_uzat).';

do $$
declare v_yanlis int;
begin
  select count(*) into v_yanlis from license_package where is_active and trial_days <> 90;
  if v_yanlis > 0 then
    raise exception '0045: % pakette deneme süresi 90 gün değil.', v_yanlis;
  end if;
  raise notice '0045 TAMAM · standart deneme 90 gün (3 ay) · uzatma sınırsız';
end $$;
