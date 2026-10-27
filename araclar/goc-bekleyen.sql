-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · CANLIYA YAPIŞTIRILACAK GÖÇ PAKETİ · 27.10.2026
--
-- Supabase → SQL Editor → hepsini seç, yapıştır, Run.
--
-- ⚠️ SUPABASE YAPIŞTIRILAN BETİĞİN TAMAMINI **TEK İŞLEMDE** ÇALIŞTIRIR.
-- Bir satır düşerse HİÇBİR ŞEY uygulanmaz. Bu yüzden:
--
--   KURAL (27.10, tuzak 129'un bedeli): **BİR GÜVENLİK ONARIMI, VERİYE
--   BAĞLI BİR GÖÇLE AYNI PAKETTE GİTMEZ.** Veriye bağlı göç (eski satırlar
--   yeni bir `check`'i ihlal ediyorsa düşen göç) onarımı rehin alır:
--   kapı açık kalır ve kimse fark etmez. Önce onarım paketi, Run, sonuç
--   görülür; sonra veriye bağlı paket.
--
-- BU PAKETTE TEK GÖÇ VAR ve o bir güvenlik onarımıdır. Rehin alacak bir şey
-- yok — bilerek böyle.
--
-- Beklenen çıktı: "Success. No rows returned."
-- Sonra `araclar/teshis-canli-durum.sql`'i çalıştırın: 8 satırın HEPSİ OK
-- olmalı (dün 7 OK + 1 "KAPI YOK" idi; onarılan satır o).
-- ═══════════════════════════════════════════════════════════════════════════

-- ══════════════ 0101_fire_kapisi_geri.sql ══════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · göç 0101 · `app.fire_dokumu` finans kapısı geri konuyor
--
-- ÖLÇÜM (27.10.2026, canlı teşhis tablosu, 8 satırın 7'si OK):
--     fire_dokumu (app) · finans kapısı → KAPI YOK
--
-- Depoda yalnız iki göç `app.fire_dokumu`'yu YAZIYOR:
--   · 0065 → ham hesabı yazar (kapı yoktur, o zaman kapı diye bir şey yoktu)
--   · 0071 → hesabı `_ham`'a taşır, ADININ ÜSTÜNE kapıyı yazar
-- Yerelde kapı DURUYOR, canlıda DURMUYOR. Yani canlıda 0065'in gövdesi
-- 0071'in kapısının üstüne yazılmış, ya da 0071 hiç çalışmamış.
--
-- ⚠️ HANGİSİ OLDUĞUNU BİLMİYORUM. Tahmin etmiyorum: bu göç İKİSİNİ DE
-- onarır ve hangi durumdan geldiğini `notice` ile söyler. Sebebi bilmemek
-- onarımı geciktirmemeli; ama "sebebini biliyorum" demek de yalan olur.
--
-- ⚠️ 0078 TUZAĞI (tuzak 127) AYNI AİLEDEN: bir hesabı `create or replace`
-- ile KAPININ ADINA yazmak kapıyı sessizce siler. Hata vermez, test kırmaz,
-- ekran çalışmaya devam eder — yalnız para herkese görünür olur.
-- `src/reporting/gosterge-kapisi.arch.test.ts` bu göçün metnini de ölçüyor.
--
-- ⚠️ TUZAK 129: bu göç KENDİ İŞİNDEN BAŞKA HİÇBİR ŞEYİ doğrulamıyor.
-- 0099'da `fire_dokumu` kontrolü koymuştum; o kontrol düştü ve Supabase
-- betiğin TAMAMINI geri aldı — asıl onarım da uygulanmadı. Bir göçün
-- doğrulaması yalnız KENDİ yazdığını ölçer.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── ÖN KOŞUL ───────────────────────────────────────────────────────────────
-- Gövde `app.fire_nedenleri()` ve `app.kalem_alis_fiyati()` çağırıyor.
-- Yoklarsa PostgreSQL çıplak bir 42883 verir ve kimse ne olduğunu anlamaz.
do $$
begin
  if to_regprocedure('app.fire_nedenleri()') is null then
    raise exception '0101: app.fire_nedenleri() yok. Bu göç 0065''ten SONRA '
      'çalışmalı.' using errcode = 'MI500';
  end if;
  if to_regprocedure('app.kalem_alis_fiyati(uuid, timestamptz)') is null then
    raise exception '0101: app.kalem_alis_fiyati(uuid, timestamptz) yok. '
      'Bu göç 0065''ten SONRA çalışmalı.' using errcode = 'MI500';
  end if;
end;
$$;

-- ── `_ham` VAR MI? ─────────────────────────────────────────────────────────
-- 0071'in atladığı adım burada telafi ediliyor: `_ham` yoksa hesap hâlâ
-- kapının adında duruyor demektir, önce taşınır.
do $$
begin
  if to_regprocedure('app.fire_dokumu_ham(uuid, date, date)') is not null then
    raise notice '0101: fire_dokumu_ham duruyor — 0071 çalışmış, '
      'kapının üstüne sonradan yazılmış.';
  elsif to_regprocedure('app.fire_dokumu(uuid, date, date)') is null then
    raise exception '0101: ne app.fire_dokumu ne app.fire_dokumu_ham var. '
      'Bu göç 0065''ten SONRA çalışmalı.' using errcode = 'MI500';
  else
    execute 'alter function app.fire_dokumu(uuid, date, date) '
         || 'rename to fire_dokumu_ham';
    raise notice '0101: fire_dokumu → _ham olarak taşındı — 0071 bu '
      'veritabanında hiç çalışmamış.';
  end if;
end;
$$;

-- ── HAM HESAP ──────────────────────────────────────────────────────────────
-- ⚠️ Gövde 0065'ten HARFİ HARFİNE kopya. Yerelde ölçtüm: canlı
-- `app.fire_dokumu_ham` gövdesi ile 0065'in metni BİREBİR aynı (fark yok).
-- 0070 bu fonksiyonun gövdesine dokunmuyor, yalnız yetki veriyor.
-- Yani buraya yazılan hesap hiçbir düzeltmeyi geri almıyor.
create or replace function app.fire_dokumu_ham(
  p_sube uuid,
  p_bas  date,
  p_bit  date
)
returns table (
  neden       text,
  kalem_id    uuid,
  kalem_adi   text,
  miktar      numeric,
  birim       text,
  tutar       numeric,
  fiyatsiz    boolean
)
language sql
stable
set search_path = public, app, pg_temp
as $$
with iptal as (
  select m.id from public.stock_movement m where m.reason = 'REVERSAL'
  union
  select m.reverses_movement_id from public.stock_movement m
   where m.reason = 'REVERSAL' and m.reverses_movement_id is not null
)
select d.reason,
       d.stock_item_id,
       -- ⚠️ `left join`: kalem kartı silinmişse satır KAYBOLMAZ (tuzak 54).
       k.name,
       sum(abs(d.quantity_base)),
       max(k.base_uom),
       sum(abs(d.quantity_base) * app.kalem_alis_fiyati(d.stock_item_id, d.occurred_at)),
       bool_or(app.kalem_alis_fiyati(d.stock_item_id, d.occurred_at) is null)
  from public.stock_movement d
  left join public.stock_item k on k.id = d.stock_item_id
 where d.branch_id = p_sube
   and d.occurred_at >= p_bas::timestamptz
   and d.occurred_at <  (p_bit + 1)::timestamptz
   and d.reason = any(app.fire_nedenleri())
   and d.quantity_base < 0
   and d.id not in (select id from iptal)
 group by d.reason, d.stock_item_id, k.name
 order by sum(abs(d.quantity_base) * app.kalem_alis_fiyati(d.stock_item_id, d.occurred_at))
          desc nulls last
$$;

-- ── KAPI ───────────────────────────────────────────────────────────────────
-- ⚠️ Metin 0071'den HARFİ HARFİNE kopya. Kapı `security invoker`
-- (yani `definer` DEĞİL): `definer` olsaydı kapının kendisi RLS'i atlardı.
create or replace function app.fire_dokumu(p_sube uuid, p_bas date, p_bit date)
returns table (neden text, kalem_id uuid, kalem_adi text, miktar numeric,
               birim text, tutar numeric, fiyatsiz boolean)
language plpgsql
stable
set search_path = public, app, pg_temp
as $$
begin
  if not app.yetkim_var('finance.read') then
    raise exception 'Fire dökümü maliyet bilgisi içeriyor; `finance.read` '
      'izni gerekiyor.'
      using errcode = 'MI403';
  end if;

  return query select * from app.fire_dokumu_ham(p_sube, p_bas, p_bit);
end;
$$;

comment on function app.fire_dokumu(uuid, date, date) is
  'Fire dökümü KAPISI. Hesap app.fire_dokumu_ham''da. Bu gövdeye hesap '
  'YAZILMAZ — yazıldığı an finans kapısı sessizce silinir (tuzak 127).';

-- ── DOĞRULAMA ──────────────────────────────────────────────────────────────
-- Yalnız bu göçün yazdığı üç şey ölçülüyor: kapı, ham hesap, dış yüzey.
--
-- ⚠️ İLK YAZIŞIMDA fonksiyonu `pg_get_function_identity_arguments(p.oid)
-- = 'uuid, date, date'` ile aradım ve BULAMADI: o fonksiyon argüman
-- ADLARINI DA döndürüyor ('p_sube uuid, p_bas date, p_bit date'). Yani
-- doğrulamam "fonksiyon yok" diye patlıyordu, oysa fonksiyon duruyordu.
-- Bozuk durum provası bunu YERELDE yakaladı; canlıda patlasaydı Supabase
-- bütün paketi geri alır ve kapı yine açık kalırdı. `to_regprocedure`
-- argüman TİPLERİNE göre arar; doğru arama budur.
do $$
declare
  v_kapi    text;
  v_ham     text;
  v_dis     text;
  v_definer boolean;
begin
  select p.prosrc, p.prosecdef into v_kapi, v_definer
    from pg_proc p
   where p.oid = to_regprocedure('app.fire_dokumu(uuid, date, date)');

  if v_kapi is null then
    raise exception '0101: app.fire_dokumu(uuid, date, date) yok.';
  end if;
  if v_kapi not like '%yetkim_var(''finance.read'')%' then
    raise exception '0101: app.fire_dokumu finans izin kapısı DEĞİL.';
  end if;
  if v_definer then
    raise exception '0101: kapı `security definer` olmuş — bu hâliyle kapı '
      'RLS''i atlar. `invoker` olmalı.';
  end if;
  if v_kapi like '%stock_movement%' then
    raise exception '0101: kapının gövdesinde HAM HESAP var. Hesap _ham''da '
      'kalmalı, yoksa hesabı değiştiren bir göç kapıyı yine siler.';
  end if;

  select p.prosrc, p.prosecdef into v_ham, v_definer
    from pg_proc p
   where p.oid = to_regprocedure('app.fire_dokumu_ham(uuid, date, date)');

  if v_ham is null then
    raise exception '0101: app.fire_dokumu_ham(uuid, date, date) yok.';
  end if;
  if v_ham not like '%stock_movement%' then
    raise exception '0101: _ham''da hesap yok.';
  end if;
  if v_ham like '%yetkim_var%' then
    raise exception '0101: _ham''a kapı yazılmış. Kapı tek yerde olmalı.';
  end if;
  if v_definer then
    raise exception '0101: _ham `security definer` olmuş.';
  end if;

  -- ⚠️ EN ÖNEMLİ ÖLÇÜM: dışarıdan gelen çağrı kapıdan GEÇİYOR mu?
  -- Kapıyı onarmak, dış yüzey `_ham`'ı çağırıyorsa hiçbir şey onarmaz.
  select p.prosrc into v_dis
    from pg_proc p
   where p.oid = to_regprocedure('public.fire_dokumu(uuid, date, date)');

  if v_dis is null then
    raise exception '0101: public.fire_dokumu(uuid, date, date) yok — '
      'ekran fire dökümünü hiç çağıramaz.';
  end if;
  if v_dis not like '%app.fire_dokumu(%' then
    raise exception '0101: public.fire_dokumu KAPIYI çağırmıyor. Gövde: %',
      left(v_dis, 200);
  end if;
  if v_dis like '%fire_dokumu_ham%' then
    raise exception '0101: public.fire_dokumu doğrudan _ham''ı çağırıyor — '
      'kapı ATLANIYOR.';
  end if;

  if has_function_privilege('anon',
       'public.fire_dokumu(uuid, date, date)'::regprocedure, 'execute') then
    raise exception '0101: anon fire dökümünü çağırabiliyor.';
  end if;

  raise notice '0101 TAMAM · app.fire_dokumu finans kapısı geri kondu · '
    'hesap _ham''da · dış yüzey kapıdan geçiyor · anon kapalı.';
end;
$$;
