-- ═══════════════════════════════════════════════════════════════════════════
-- 0068 · ÖLÇÜMÜ ÖLÇEN GİRSİN — üretim ve sevkiyata `quality.write`
-- ---------------------------------------------------------------------------
-- Emrah (08.10.2026): *"Bu işleyişe ters, müdür gelip ölçecek hali yok...
-- ölçüm girme yetkisi üretim ve sevkiyat sorumlusunda olsun."*
--
-- ── NEDEN ─────────────────────────────────────────────────────────────────
-- `quality.write` yalnız kalite sorumlusu, müdür ve işletme sahibindeydi.
-- Ama sıcaklığı pratikte FIRININ BAŞINDAKİ ve ARACI YÜKLEYEN kişi ölçer.
-- Ölçeni yazamayan bir sistemde ölçüm kâğıda yazılır, akşam birisi toplu
-- hâlde girer — ve o an HACCP'in anlamı biter: kayıt var, kontrol yok.
--
-- ⚠️ BU BİR GEVŞETME DEĞİL, DOĞRU YERE KOYMA. Ölçüm zaten yazıldığı anda
-- limite göre değerlendiriliyor (0024) ve sapma kendiliğinden düzeltici
-- faaliyet açıyor. Ölçümü girenin yetkisi, sonucu DEĞİŞTİRME yetkisi
-- değildir: karar sayıdan çıkıyor, kullanıcıdan değil.
--
-- ⚠️ EKSİ YÖNÜ VAR VE BURAYA YAZILIYOR: `quality.write` aynı zamanda
-- ÖLÇÜM İPTALİ ve DÜZELTİCİ FAALİYET KAPATMA yetkisini de taşıyor. Yani
-- sevkiyat sorumlusu kendi girdiği uygunsuz ölçümü iptal edebilir hâle
-- geliyor. Bunun üç karşı ağırlığı var:
--   1. İptal SİLME DEĞİL: kayıt gerekçesiyle duruyor (0024, append-only).
--   2. Gerekçe ZORUNLU — gerekçesiz iptal servis katmanında reddediliyor.
--   3. Her iptal denetim kaydına düşüyor (0027): kim, ne zaman, neden.
-- Yani kötüye kullanım mümkün ama GİZLENEMEZ. Gizlenebilen bir yetki
-- tehlikelidir; iz bırakan bir yetki yönetilebilir.
--
-- İlerisi için doğrusu `quality.write`'ı ikiye ayırmaktır (ölçüm girme /
-- kayıt düzeltme). Bugün yapmıyorum: yeni izin eklemek izin kataloğunu ve
-- ona bakan mimari testi değiştirir, ve demo öncesi bu riski almaya değmez.
-- ═══════════════════════════════════════════════════════════════════════════

insert into role_permission (role_code, permission_code)
select r, 'quality.write'
  from unnest(array['uretim_sorumlusu','sevkiyat_sorumlusu']) r
 where exists (select 1 from role where code = r)
on conflict (role_code, permission_code) do nothing;

-- ── DOĞRULAMA ──────────────────────────────────────────────────────────────
do $$
declare
  v_eksik text;
  v_say int;
begin
  select string_agg(r, ', ') into v_eksik
    from unnest(array['uretim_sorumlusu','sevkiyat_sorumlusu']) r
   where exists (select 1 from role where code = r)
     and not exists (
       select 1 from role_permission
        where role_code = r and permission_code = 'quality.write');

  if v_eksik is not null then
    raise exception '0068: şu rollere quality.write verilemedi: %', v_eksik;
  end if;

  -- ⚠️ KİMSE BAŞKA BİR YETKİ KAZANMAMALI. Bu göç TEK bir izin ekliyor;
  -- yanlışlıkla bir döngü yazılsaydı sessizce her şeyi dağıtabilirdi.
  select count(*) into v_say
    from role_permission
   where role_code in ('uretim_sorumlusu','sevkiyat_sorumlusu')
     and permission_code like 'quality%';
  if v_say <> 4 then   -- iki rol × (quality.read + quality.write)
    raise exception '0068: beklenmeyen kalite izni sayısı: % (4 olmalı)', v_say;
  end if;

  -- Ölçüm girmeyen rollere SIZMAMALI.
  if exists (
    select 1 from role_permission
     where permission_code = 'quality.write'
       and role_code in ('personel','depo_sorumlusu','muhasebe','izleyici')
  ) then
    raise exception '0068: quality.write beklenmeyen bir role sızdı.';
  end if;

  raise notice '0068 TAMAM · uretim_sorumlusu ve sevkiyat_sorumlusu ölçüm girebiliyor';
end;
$$;
