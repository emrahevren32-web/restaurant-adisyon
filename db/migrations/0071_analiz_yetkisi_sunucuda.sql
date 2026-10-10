-- ═══════════════════════════════════════════════════════════════════════════
-- 0071 · ANALİZ YETKİSİ SUNUCUDA DENETLENİYOR
-- ---------------------------------------------------------------------------
-- İkinci inceleme (Codex, 09.10): *"Finans ve şube erişimi RPC içinde
-- denetlensin; UI kontrolüyle sınırlı kalmasın."* Haklı ve bu benim kendi
-- kuralımı çiğnediğim bir yer:
--
--   Emrah'ın kuralı: "Müşterinin görmemesi gereken hiçbir şey müşteri
--   ekranında olmasın."
--   Benim 08.10'da yazdığım: "⚠️ Menüde gizlemek YETMEZ; kapı burada da
--   duruyor." — ama o kapıyı EKRANA koydum, veritabanına koymadım.
--
-- Analiz ekranı `finance.read` istiyor (Analiz.tsx). Ama fonksiyonlar bunu
-- sormuyordu: `authenticated` olan herkes doğrudan RPC çağırıp kendi
-- işletmesinin FİRE TUTARINI, ALIM TUTARINI ve STOK DEĞERİNİ okuyabilirdi.
-- Depocu, üretimci, sevkiyatçı dahil. 08.10'da Emrah'ın kararı tam tersiydi:
-- *"fiyatı sadece müdür ve işletme sahibi görebilsin."*
--
-- ⚠️ EKRANDAKİ KAPI KALKMIYOR, İKİNCİSİ EKLENİYOR. Arayüz kapısı kullanıcıya
-- NEDEN göremediğini söylüyor; veritabanı kapısı ise söylemiyor ama
-- geçilmiyor. İkisi farklı iş yapar.
--
-- ⚠️ `fire_dokumu` da kapatılıyor: döküm tutar taşıyor, gösterge özetinden
-- daha ayrıntılı. Birini kapatıp ötekini açık bırakmak kapıyı hiç
-- kapatmamaktır.
--
-- ⚠️ `uretilen_partiler` ve `dikkat_siparisleri` KAPSAM DIŞI:
--   · parti listesi para taşımıyor, etiket basan herkes görmeli
--   · dikkat siparişleri panelde ve fiyat içermiyor
-- Gereksiz kapı, kullanılmayan ekran demektir.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── HAM HESAPLAR AYRILIYOR ────────────────────────────────────────────────
-- ⚠️ Hesap ile KAPI ayrı fonksiyonlarda. Aynı gövdeye `if yetkim_var`
-- eklemek daha kısa olurdu ama hesabı değiştiren her göç kapıyı da yeniden
-- yazmak zorunda kalırdı — ve bir gün biri kapıyı yazmayı unuturdu.
--
-- ⚠️ BU GÖÇ İKİ KEZ ÇALIŞTIRILABİLİR. 10.10'da Emrah göçü yeniden yapıştırdı
-- ve `alter function ... rename` ikinci turda patladı:
--   ERROR 42723: function isletme_gostergeleri_ham(uuid, date, date)
--                already exists in schema "app"
-- Yeniden çalıştırılamayan bir göç, bir gün yarıda kalmış bir kurulumu
-- kurtarmak isteyen kişiyi duvara çarpar. Ad değişikliği artık koşullu.
do $$
begin
  -- isletme_gostergeleri → _ham
  if to_regprocedure('app.isletme_gostergeleri_ham(uuid, date, date)') is not null then
    raise notice '0071: isletme_gostergeleri_ham zaten var — ad değişikliği atlandı.';
  elsif to_regprocedure('app.isletme_gostergeleri(uuid, date, date)') is null then
    raise exception '0071: app.isletme_gostergeleri(uuid, date, date) yok. '
      'Bu göç 0065''ten SONRA çalışmalı.'
      using errcode = 'MI500';
  else
    execute 'alter function app.isletme_gostergeleri(uuid, date, date) '
         || 'rename to isletme_gostergeleri_ham';
    raise notice '0071: isletme_gostergeleri → _ham olarak ayrıldı.';
  end if;

  -- fire_dokumu → _ham
  if to_regprocedure('app.fire_dokumu_ham(uuid, date, date)') is not null then
    raise notice '0071: fire_dokumu_ham zaten var — ad değişikliği atlandı.';
  elsif to_regprocedure('app.fire_dokumu(uuid, date, date)') is null then
    raise exception '0071: app.fire_dokumu(uuid, date, date) yok. '
      'Bu göç 0065''ten SONRA çalışmalı.'
      using errcode = 'MI500';
  else
    execute 'alter function app.fire_dokumu(uuid, date, date) '
         || 'rename to fire_dokumu_ham';
    raise notice '0071: fire_dokumu → _ham olarak ayrıldı.';
  end if;
end;
$$;

-- ⚠️ `_ham` fonksiyonlarının yetkisi BİLEREK dokunulmadan bırakılıyor.
-- Kapı `security invoker`; yani _ham'ı çağırırken çağıranın yetkisi geçerli.
-- _ham'dan execute yetkisini alsaydım kapının kendisi de çalışmaz olurdu.
-- `app` şeması PostgREST ile yayınlanmadığı için _ham dışarıdan çağrılamaz.

create or replace function app.isletme_gostergeleri(
  p_sube uuid, p_bas date, p_bit date
)
returns table (anahtar text, deger numeric, ek numeric)
language plpgsql
stable
set search_path = public, app, pg_temp
as $$
begin
  -- ⚠️ HATA MESAJI NE OLDUĞUNU SÖYLÜYOR. "Yetkiniz yok" diyen ama hangi
  -- yetki olduğunu söylemeyen bir mesaj, kullanıcıyı da yöneticiyi de
  -- çaresiz bırakır.
  if not app.yetkim_var('finance.read') then
    raise exception 'Bu rapor maliyet bilgisi içeriyor; `finance.read` izni '
      'gerekiyor. İşletme sahibi, müdür, muhasebe ve satın alma görebilir.'
      using errcode = 'MI403';
  end if;

  return query select * from app.isletme_gostergeleri_ham(p_sube, p_bas, p_bit);
end;
$$;

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

-- ── DOĞRULAMA ──────────────────────────────────────────────────────────────
do $$
declare
  v_say int;
begin
  -- Ham hesapları taşıyan iki fonksiyon DURMALI; yetki kapısı onları sarıyor.
  select count(*) into v_say
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app'
     and p.proname in ('isletme_gostergeleri_ham','fire_dokumu_ham');
  if v_say <> 2 then
    raise exception '0071: ham hesap fonksiyonları yok (% bulundu). '
      'Bu göç 0070''ten SONRA çalışmalı.', v_say;
  end if;

  -- ⚠️ Kapı `security definer` OLMAMALI: definer olsaydı yetki kontrolünü
  -- geçen bir çağrı RLS'i de aşardı ve bütün kiracıları okurdu.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app'
       and p.proname in ('isletme_gostergeleri','fire_dokumu')
       and p.prosecdef
  ) then
    raise exception '0071: yetki kapısı `security definer` olmuş — '
      'kiracı duvarını deler.';
  end if;

  raise notice '0071 TAMAM · analiz yetkisi artık veritabanında denetleniyor';
end;
$$;
