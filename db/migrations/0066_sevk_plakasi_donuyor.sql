-- ═══════════════════════════════════════════════════════════════════════════
-- 0066 · KESİLMİŞ İRSALİYENİN PLAKASI DEĞİŞMEZ
-- ---------------------------------------------------------------------------
-- 0064'te bilinçli bir karar vermiştim ve YANLIŞTI. Not şöyleydi:
--
--   "⚠️ Plaka DONDURULMUYOR (müşteri adının aksine): plaka BİZİM aracımızın
--    kimliğidir, join'le okunuyor."
--
-- Gerekçe şuydu: araç bizim malımız, kart düzeltilirse güncel hâli görünsün.
-- Ama KESİLMİŞ BİR İRSALİYE BİR BELGEDİR, BİR EKRAN DEĞİL. Plaka yanlış
-- girilip ertesi gün düzeltilirse, dün müşteriye imzalatılan kâğıt bugün
-- başka bir plaka basar. Müşterideki kopya ile bizdeki kopya tutmaz — ve o
-- tartışmada haklı çıkan, kâğıdı elinde tutan taraf olur.
--
-- `customer_name` için (0023) DOĞRUSU zaten yapılmıştı: karttan kopyalanıp
-- donduruluyor. Aynı kural plakaya ve şoföre de uygulanıyor.
--
-- ── NE ZAMAN DONUYOR ───────────────────────────────────────────────────────
-- ⚠️ OLUŞTURULURKEN DEĞİL, SEVK ANINDA. Bugün açılan bir taslak gelecek
-- hafta sevk edilebilir; arada kart düzeltilirse taslağın GÜNCEL plakayı
-- göstermesi doğrudur, çünkü ortada henüz kesilmiş bir kâğıt yoktur.
-- Belge, mal çıkınca doğar.
--
-- ⚠️ DONDUKTAN SONRA DEĞİŞMEZ. Tetikleyici dolu bir alanın üstüne
-- yazdırmıyor (MI435). "Düzeltme" diye geçmişi değiştirmek, defteri
-- ekleme-yapılır olmaktan çıkarır (ADR-001).
--
-- ⚠️ `vehicle_id` KALIYOR, kaldırılmıyor: "bu araç şu ay kaç sefer yaptı"
-- sorusunun cevabı ona bağlı. Donmuş metin BELGE içindir, ilişki RAPOR
-- içindir; ikisi ayrı işler.
-- ═══════════════════════════════════════════════════════════════════════════

alter table shipment add column if not exists vehicle_plate_frozen text;
alter table shipment add column if not exists vehicle_name_frozen  text;
alter table shipment add column if not exists driver_name_frozen   text;
alter table shipment add column if not exists driver_phone_frozen  text;

comment on column shipment.vehicle_plate_frozen is
  'Sevk anında araç kartından KOPYALANAN plaka. Kart sonradan değişse bile '
  'kesilmiş irsaliye değişmez.';

-- ── Sevk anında dondur ─────────────────────────────────────────────────────
create or replace function app.sevk_araci_dondur()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  -- Yalnız SHIPPED'e GEÇERKEN donuyor. Zaten SHIPPED olan bir satırın
  -- güncellenmesi (ör. not alanı) donmuş değerlere dokunmamalı.
  if new.status = 'SHIPPED'
     and (tg_op = 'INSERT' or coalesce(old.status, '') <> 'SHIPPED') then

    if new.vehicle_id is not null then
      select v.plate, nullif(btrim(coalesce(v.name, '')), '')
        into new.vehicle_plate_frozen, new.vehicle_name_frozen
        from public.vehicle v
       where v.id = new.vehicle_id;
    end if;

    if new.driver_id is not null then
      select d.full_name, nullif(btrim(coalesce(d.phone, '')), '')
        into new.driver_name_frozen, new.driver_phone_frozen
        from public.driver d
       where d.id = new.driver_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists shipment_arac_dondur on shipment;
create trigger shipment_arac_dondur
  before insert or update on shipment
  for each row execute function app.sevk_araci_dondur();

-- ── Donmuş alan değişmez ───────────────────────────────────────────────────
-- ⚠️ Tetikleyici YAZAN tetikleyiciden SONRA çalışmalı; PostgreSQL aynı
-- seviyedeki tetikleyicileri ADA GÖRE sırayla çalıştırır. `shipment_arac_
-- dondur` < `shipment_donmus_alan_korumasi` (alfabetik) olduğu için
-- dondurma önce, koruma sonra işliyor.
create or replace function app.sevk_donmus_alan_korumasi()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if old.vehicle_plate_frozen is not null
     and new.vehicle_plate_frozen is distinct from old.vehicle_plate_frozen then
    raise exception 'Kesilmiş irsaliyenin plakası değiştirilemez. Araç kartını '
      'düzeltmek dünkü kâğıdı değiştirmez; yanlış sevk edilmişse sevkiyat '
      'iptal edilip yenisi açılır.'
      using errcode = 'MI435';
  end if;

  if old.driver_name_frozen is not null
     and new.driver_name_frozen is distinct from old.driver_name_frozen then
    raise exception 'Kesilmiş irsaliyenin şoförü değiştirilemez.'
      using errcode = 'MI435';
  end if;

  return new;
end;
$$;

drop trigger if exists shipment_donmus_alan_korumasi on shipment;
create trigger shipment_donmus_alan_korumasi
  before update on shipment
  for each row execute function app.sevk_donmus_alan_korumasi();

-- ── Geçmiş sevkiyatlar ─────────────────────────────────────────────────────
-- ⚠️ GERİYE DÖNÜK DOLDURMA YAPILIYOR ama yalnız ARACI OLAN sevkiyatlar için.
-- Aracı olmayan eski sevkiyatların plakası HİÇ BİLİNMİYORDU; boş kalıyor ve
-- kâğıtta elle doldurulacak satır olarak basılıyor. Bilinmeyen bir şeyi
-- uydurmak, boş bırakmaktan kötüdür.
--
-- ⚠️ Bu doldurma BUGÜNKÜ kart değerini yazıyor ve bu bir TAHMİNDİR: 0064
-- bugün uygulandı, araç kartları bugün girildi, dolayısıyla aradaki süre
-- içinde kart değişmiş olamaz. Yarın aynı doldurmayı yapsaydık tahmin
-- olurdu; bugün değil.
update shipment s
   set vehicle_plate_frozen = v.plate,
       vehicle_name_frozen  = nullif(btrim(coalesce(v.name, '')), '')
  from public.vehicle v
 where v.id = s.vehicle_id
   and s.status = 'SHIPPED'
   and s.vehicle_plate_frozen is null;

update shipment s
   set driver_name_frozen  = d.full_name,
       driver_phone_frozen = nullif(btrim(coalesce(d.phone, '')), '')
  from public.driver d
 where d.id = s.driver_id
   and s.status = 'SHIPPED'
   and s.driver_name_frozen is null;

-- ── DOĞRULAMA ──────────────────────────────────────────────────────────────
do $$
declare
  v_eksik text;
begin
  select string_agg(k, ', ') into v_eksik
    from unnest(array['vehicle_plate_frozen','vehicle_name_frozen',
                      'driver_name_frozen','driver_phone_frozen']) k
   where not exists (
     select 1 from information_schema.columns
      where table_name = 'shipment' and column_name = k);
  if v_eksik is not null then
    raise exception '0066: şu kolonlar eklenemedi: %', v_eksik;
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'shipment_arac_dondur') then
    raise exception '0066: dondurma tetikleyicisi yok.';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'shipment_donmus_alan_korumasi') then
    raise exception '0066: koruma tetikleyicisi yok.';
  end if;

  -- ⚠️ SIRA ÖNEMLİ: önce dondurma, sonra koruma. Ters olsaydı koruma
  -- kendi yazdığımız değeri reddederdi.
  if 'shipment_arac_dondur' > 'shipment_donmus_alan_korumasi' then
    raise exception '0066: tetikleyici adları yanlış sırada — koruma, '
      'dondurmadan önce çalışır ve kendi yazdığımızı reddeder.';
  end if;

  raise notice '0066 TAMAM · sevk anında plaka ve şoför donuyor (MI435)';
end;
$$;
