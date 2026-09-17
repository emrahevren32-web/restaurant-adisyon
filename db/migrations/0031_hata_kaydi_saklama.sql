-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 4 / Güven katmanı
-- 0031 — Hata kaydının saklama süresi
--
-- ── 0030'DA YAPTIĞIM HATA ────────────────────────────────────────────────
-- 0030, `client_error` tablosuna denetim kaydıyla aynı değişmezlik
-- tetikleyicisini koydu: ne güncellenir ne silinir. Canlı denemeden hemen
-- sonra bunun yanlış olduğu görüldü — dört test satırı ortada kaldı ve
-- silinemedi.
--
-- Düşününce: `authenticated` rolüne DELETE yetkisi hiç verilmemişti.
-- Yani müşteri bu satırları zaten silemiyordu; tetikleyicinin tek etkisi
-- BİZİ engellemekti. Yalnızca hizmet ettiği tarafı kısıtlayan bir koruma
-- koruma değildir; sonucu, hiç temizlenemeyen ve sonsuza kadar büyüyen bir
-- tablo olur.
--
-- Denetim kaydı (`audit_log`) ile fark buradadır ve bilinçlidir:
--   audit_log    → "kim ne yaptı". Yasal kayıt, ASLA silinmez.
--   client_error → "yazılım nerede çöktü". Teknik kayıt, eskiyince
--                  değerini yitirir ve temizlenebilir olmalıdır.
--
-- ── YENİ KURAL ───────────────────────────────────────────────────────────
-- GÜNCELLEME: her zaman yasak. Bir hata kaydının içeriği hiç değişmez.
-- SİLME: yalnızca 90 GÜNDEN ESKİ satırlar. Yani taze bir çökmeyi kimse
--        (biz de dahil) örtemez; eskiyen kayıtlar temizlenebilir.
--
-- 90 gün: bir çökmenin "yeni mi, süregelen mi" sorusu üç aylık pencerede
-- cevaplanır. Daha kısası (bir hafta) mevsimsel/aylık tekrar eden hataları
-- görünmez yapar.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.hata_kaydi_degismez()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' then
    raise exception 'Hata kaydı değiştirilemez.'
      using errcode = 'MI403';
  end if;

  -- TG_OP = 'DELETE'
  if OLD.occurred_at > now() - interval '90 days' then
    raise exception 'Son 90 günün hata kayıtları silinemez (% tarihli kayıt).',
      OLD.occurred_at::date using errcode = 'MI403';
  end if;

  -- BEFORE DELETE tetikleyicisinde OLD döndürmek "silmeye devam et" demektir.
  -- NULL döndürmek silmeyi iptal ederdi.
  return OLD;
end $$;

comment on function app.hata_kaydi_degismez() is
  'client_error: güncelleme her zaman yasak; silme yalnızca 90 günden eski '
  'satırlar için serbest. audit_log ile farkı bilinçlidir — orada silme hiç '
  'yok, çünkü o yasal kayıt.';

-- Tetikleyicinin kendisi 0030'da kuruldu, gövdesi değişti. Yine de
-- var olduğundan emin olalım (göç sırası bozulmuşsa diye).
drop trigger if exists client_error_degismez on client_error;
create trigger client_error_degismez
  before update or delete on client_error
  for each row execute function app.hata_kaydi_degismez();

-- ── Doğrulama ─────────────────────────────────────────────────────────────
-- Beklenen üç satır:
--   guncelleme yasak      → true   (denenip yakalandı)
--   taze silme yasak      → true   (denenip yakalandı)
--   eski silme serbest    → true   (90 gün öncesine alınmış satır silindi)
do $$
declare
  v_id bigint;
  v_guncelleme_yasak boolean := false;
  v_taze_yasak       boolean := false;
  v_eski_serbest     boolean := false;
begin
  insert into client_error (fingerprint, kind, message)
  values ('0031-dogrulama', 'error', '0031 dogrulama satiri')
  returning id into v_id;

  begin
    update client_error set message = 'degistirildi' where id = v_id;
  exception when others then v_guncelleme_yasak := true;
  end;

  begin
    delete from client_error where id = v_id;
  exception when others then v_taze_yasak := true;
  end;

  -- Satırı 100 gün geriye almak için tetikleyiciyi geçici olarak kapatmak
  -- gerekir; güncelleme yasak. Bunun yerine YENİ bir satırı doğrudan eski
  -- tarihle ekliyoruz (occurred_at varsayılanı now() ama yazılabilir).
  insert into client_error (fingerprint, kind, message, occurred_at)
  values ('0031-dogrulama-eski', 'error', '0031 eski satir',
          now() - interval '100 days')
  returning id into v_id;

  begin
    delete from client_error where id = v_id;
    v_eski_serbest := true;
  exception when others then v_eski_serbest := false;
  end;

  raise notice 'guncelleme yasak: %  ·  taze silme yasak: %  ·  eski silme serbest: %',
    v_guncelleme_yasak, v_taze_yasak, v_eski_serbest;

  if not (v_guncelleme_yasak and v_taze_yasak and v_eski_serbest) then
    raise exception 'DOGRULAMA BASARISIZ. Beklenen: true / true / true';
  end if;
end $$;

-- ⚠️ Doğrulama, tabloda BİR taze satır bırakır (`fingerprint =
-- '0031-dogrulama'`). Bırakmak zorunda: "taze kayıt silinemez" iddiasını
-- kanıtlamanın yolu, silinemeyen bir kayıt üretmektir. O satır 90 gün sonra
-- kendiliğinden silinebilir hale gelir.

select 'dogrulama' as ne,
       'gecti — guncelleme yasak, taze silme yasak, eski silme serbest' as sonuc
union all
select 'kalan test satiri',
       count(*)::text || ' adet (0031-dogrulama + MIYOP hata testi; 90 gun sonra silinebilir)'
from client_error
where fingerprint = '0031-dogrulama' or message like 'Error: MIYOP hata testi%';
