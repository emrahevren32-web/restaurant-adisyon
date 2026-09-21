-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0041 · Sektör kimliği tek yazıma iniyor
--
-- ── BULUNAN ─────────────────────────────────────────────────────────────
-- `company.primary_sector_id` iki ayrı yazımla doluyordu:
--
--   'sector_industrial_kitchen'   ← demo kurulum betiği, eski kayıtlar
--   'industrial-kitchen'          ← basvuruyu_onayla (0035), başvurudaki KOD
--
-- Canlıda 6 firmanın 4'ü ikinci yazımdaydı — gerçek onay akışından geçen
-- HER müşteri. Uygulama tarafı 2026-09-20'de ikisini de kabul edecek hâle
-- getirildi; ama veritabanında iki yazım durdukça her yeni sorgu, rapor ve
-- ekran aynı tuzağa yeniden düşebilir.
--
-- ── ÇÖZÜM ────────────────────────────────────────────────────────────────
-- 1. Firmada sektör YAZILIRKEN tek yazıma çevrilir (BEFORE tetikleyicisi).
--    `basvuruyu_onayla`'ya dokunulmadı: kural fonksiyonda değil TABLODA,
--    yani bugün ya da yarın firmaya sektör yazan HER yol aynı kuraldan geçer.
-- 2. Var olan kayıtlar düzeltilir.
--
-- Çevirme kuralı uygulamadaki `createSectorId` ile BİREBİR aynı:
--   'sector_' + harf/rakam dışındaki her dizinin '_' ile değişmesi.
--
-- BEFORE tetikleyicisi burada DOĞRU araç: yalnız NEW'i düzeltiyor, başka
-- tabloya yazmıyor (tuzak 35).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.sektor_kimligi(p_deger text)
returns text
language sql immutable as $$
  select case
    when p_deger is null or btrim(p_deger) = '' then p_deger
    when btrim(p_deger) like 'sector\_%' then btrim(p_deger)
    else 'sector_' || regexp_replace(btrim(p_deger), '[^a-zA-Z0-9]+', '_', 'g')
  end
$$;

create or replace function app.firma_sektorunu_duzelt()
returns trigger
language plpgsql as $$
begin
  new.primary_sector_id := app.sektor_kimligi(new.primary_sector_id);
  return new;
end
$$;

drop trigger if exists company_sektor_kimligi on company;
create trigger company_sektor_kimligi
  before insert or update of primary_sector_id on company
  for each row execute function app.firma_sektorunu_duzelt();

-- Var olan kayıtlar
update company
   set primary_sector_id = app.sektor_kimligi(primary_sector_id)
 where primary_sector_id is not null
   and primary_sector_id <> app.sektor_kimligi(primary_sector_id);

-- ── DOĞRULAMA ────────────────────────────────────────────────────────────
do $$
declare
  v_kalan int;
begin
  if app.sektor_kimligi('industrial-kitchen') <> 'sector_industrial_kitchen' then
    raise exception '0041: kod yazımı çevrilmedi';
  end if;
  if app.sektor_kimligi('sector_industrial_kitchen') <> 'sector_industrial_kitchen' then
    raise exception '0041: kimlik yazımı bozuldu (iki kez çevrildi)';
  end if;
  if app.sektor_kimligi('beauty-center') <> 'sector_beauty_center' then
    raise exception '0041: çok parçalı kod yanlış çevrildi';
  end if;

  select count(*) into v_kalan
    from company
   where primary_sector_id is not null
     and btrim(primary_sector_id) <> ''
     and primary_sector_id not like 'sector\_%';
  if v_kalan > 0 then
    raise exception '0041: % firmada sektör hâlâ kod yazımında', v_kalan;
  end if;

  raise notice '0041 TAMAM · firma sektörleri tek yazımda · yeni kayıtlar tetikleyiciden geçiyor';
end
$$;
