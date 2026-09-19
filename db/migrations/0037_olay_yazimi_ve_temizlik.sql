-- ═══════════════════════════════════════════════════════════════════════════
-- 0037 — İki kusur: (A) karar düğmeleri yazamıyor, (B) canlıda benim
--        doğrulama kayıtlarım duruyor
--
-- ── A · "permission denied for table business_application_event" ──────────
-- "İncelemeye Al" düğmesi bu hatayı verdi.
--
-- Sebep: `app.basvuru_olayi_yaz()` normal (INVOKER) bir tetikleyici
-- fonksiyonu. Yani olay defterine yazarken ÇAĞIRAN kullanıcının yetkisini
-- kullanıyor. `authenticated` rolüne `business_application_event` üzerinde
-- yalnız SELECT verdik (0032) — bilerek: kimse olay defterine elle
-- yazmasın. Ama tetikleyici de aynı kapıdan geçtiği için o da yazamıyor.
--
-- Açık formun çalışmasının sebebi buydu: `basvuru_gonder` SECURITY DEFINER,
-- tetikleyici onun yetkisini devralıyordu. Ekrandan yapılan doğrudan
-- UPDATE'te böyle bir sahip yok.
--
-- Doğru çözüm, `authenticated`a yazma yetkisi vermek DEĞİL — o, defteri
-- elle yazılabilir yapardı. Tetikleyicinin kendisini SECURITY DEFINER
-- yapmak: defter yalnız tetikleyici eliyle yazılır, o da yalnız bir durum
-- değişikliği olduğunda çalışır.
--
-- ── B · Canlıda 5 adet "Dogrulama" başvurusu var ──────────────────────────
-- 0032, 0033, 0034 ve 0035'in doğrulama blokları gerçek satır yazıyor ve
-- bırakıyor. 0032'ye "kayıt silinmiyor, iz kalıcıdır" diye not düşmüşüm.
-- O gerekçe YANLIŞTI: bunlar bir başvurunun izi değil, benim test
-- satırlarım. Emrah'ın başvuru listesinde "0032 Dogrulama Gida A.S." gibi
-- kayıtlar görünüyor. Kural açıktı: müşterinin (ve sahibinin) görmemesi
-- gereken hiçbir şey ekranda olmaz.
--
-- Silinememelerinin sebebi, olay defterinin değişmezlik tetikleyicisi.
-- Bu göç, yalnız kendi içinde ve yalnız `@example.com` satırları için o
-- tetikleyiciyi geçici kapatan bir bakım fonksiyonu kuruyor.
--
-- `@example.com` rastgele seçilmedi: RFC 2606 ile sınama için ayrılmış
-- alan adıdır, gerçek bir başvuranda bulunamaz.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A · Tetikleyici artık kendi yetkisiyle yazıyor ────────────────────────
create or replace function app.basvuru_olayi_yaz()
returns trigger
language plpgsql
security definer                      -- ⚠️ 0037'nin bütün meselesi bu satır
set search_path = public, app, pg_temp
as $$
declare
  v_ad  text;
  v_kim uuid;
begin
  if TG_OP = 'UPDATE' and NEW.status = OLD.status then
    return null;   -- durum değişmediyse olay yok
  end if;

  -- ⚠️ SECURITY DEFINER, `auth.uid()`i DEĞİŞTİRMEZ. Oturumun kim olduğu
  -- isteğin kendisinden okunur; fonksiyonun sahibi olmakla ilgisi yok.
  -- Yani olayın altındaki imza hâlâ kararı veren kişinin.
  select user_id, ad into v_kim, v_ad from app.denetim_aktoru();

  insert into business_application_event
    (application_id, from_status, to_status, actor_id, actor_name, note)
  values (
    NEW.id,
    case when TG_OP = 'INSERT' then null else OLD.status end,
    NEW.status, v_kim, v_ad,
    nullif(btrim(coalesce(NEW.decision_note, '')), '')
  );

  return null;
end $$;

comment on function app.basvuru_olayi_yaz() is
  'Başvurunun durumu her değiştiğinde olay defterine bir satır yazar. '
  'SECURITY DEFINER (0037): `authenticated` rolünün defterde yazma yetkisi '
  'YOKTUR ve olmamalıdır; defter yalnız bu tetikleyici eliyle dolar. '
  'Kararı verenin kimliği auth.uid() üzerinden okunur, değişmez.';

-- ── B · Doğrulama kayıtlarını temizleyen bakım fonksiyonu ─────────────────
-- Sahibinin yetkisiyle çalışır ve YALNIZCA `@example.com` satırlarına
-- dokunur. Başka hiçbir satır bu fonksiyonla silinemez.
create or replace function app.dogrulama_kayitlarini_sil()
returns int
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_adet int;
begin
  -- Olay defteri değişmez; silmek için tetikleyiciyi yalnız bu işlem
  -- boyunca kapatıyoruz. Kapalı kaldığı süre bu bloktan ibarettir.
  alter table business_application_event disable trigger business_application_event_degismez;

  begin
    delete from business_application_event e
     using business_application a
     where e.application_id = a.id
       and a.email like '%@example.com';

    delete from business_application
     where email like '%@example.com';
    get diagnostics v_adet = row_count;
  exception when others then
    -- Ne olursa olsun tetikleyici açık kalmalı. Kapalı bırakılmış bir
    -- değişmezlik kuralı, hiç olmamasından beterdir.
    alter table business_application_event enable trigger business_application_event_degismez;
    raise;
  end;

  alter table business_application_event enable trigger business_application_event_degismez;
  return v_adet;
end $$;

comment on function app.dogrulama_kayitlarini_sil() is
  'Göç doğrulama bloklarının bıraktığı sınama başvurularını siler. '
  'YALNIZCA e-postası @example.com ile biten satırlara dokunur (RFC 2606). '
  'Bundan sonraki her doğrulama bloğu sonunda bu çağrılmalıdır.';

-- Kimse çağıramaz. Yalnız göçler (sahip oturumu) çalıştırır.
revoke execute on function app.dogrulama_kayitlarini_sil() from public, anon, authenticated;

-- ── Temizliği şimdi yap ───────────────────────────────────────────────────
do $$
declare
  v_once int;
  v_silinen int;
  v_kalan int;
begin
  select count(*) into v_once from business_application where email like '%@example.com';
  select app.dogrulama_kayitlarini_sil() into v_silinen;
  select count(*) into v_kalan from business_application where email like '%@example.com';

  if v_kalan <> 0 then
    raise exception 'DURDU: % adet dogrulama kaydi hala duruyor.', v_kalan;
  end if;
  raise notice 'Dogrulama kaydi temizlendi: % bulundu, % silindi, % kaldi.',
    v_once, v_silinen, v_kalan;
end $$;

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- 1) Tetikleyici gerçekten SECURITY DEFINER mı?
do $$
declare
  v_definer boolean;
begin
  select p.prosecdef into v_definer
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'basvuru_olayi_yaz';

  if v_definer is not true then
    raise exception 'DURDU: app.basvuru_olayi_yaz hala SECURITY INVOKER. '
      'Karar dugmeleri yine "permission denied" verirdi.';
  end if;
  raise notice 'Olay tetikleyicisi SECURITY DEFINER.';
end $$;

-- 2) `authenticated` olay defterine HÂLÂ yazamamalı. Bu sıfır dönmeli;
--    sıfırdan büyükse defteri elle yazılabilir hâle getirmişiz demektir.
select count(*) as authenticated_yazma_yetkisi_sifir_olmali
  from information_schema.role_table_grants
 where table_name = 'business_application_event'
   and grantee = 'authenticated'
   and privilege_type in ('INSERT','UPDATE','DELETE');

-- 3) Ekranda ne kalıyor?
select status as durum, count(*) as adet
from business_application
group by status
order by status;

-- 4) Kalan başvuruların listesi — hepsi gerçek olmalı, "Dogrulama" olmamalı.
select reference as numara, company_name as firma, email as eposta, status as durum
from business_application
order by created_at;
