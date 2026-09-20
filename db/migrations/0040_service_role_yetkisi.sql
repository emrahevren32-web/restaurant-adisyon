-- ═══════════════════════════════════════════════════════════════════════════
-- 0040 — Edge Function başvuruyu okuyamıyordu: `service_role` yetkisi yok
--
-- ── KAYITTAKİ KANIT ──────────────────────────────────────────────────────
--   [isletme-hesabi-ac] 500
--   {"hata":"Başvuru okunamadı: permission denied for table business_application"}
--
-- Bu hata TARAYICIDAN değil, Edge Function'ın KENDİ İÇİNDEN geldi. Yani
-- `service_role` anahtarıyla yapılan okuma reddedildi.
--
-- ── SEBEP: BENİM VARSAYIMIM ──────────────────────────────────────────────
-- 0032'de şunu yazdım:
--     revoke all on business_application from anon, authenticated;
--     grant select on business_application to authenticated;
-- `service_role`ü hiç düşünmedim; "zaten her şeye erişir" diye varsaydım.
-- Varsaymışım. `service_role` RLS'i atlar (bypassrls) AMA GRANT'ı atlamaz.
-- RLS ve GRANT iki ayrı kapıdır — bu depoda üçüncü kez aynı ders (0006).
--
-- Tabloyu yarattığım anda Supabase'in varsayılan yetkileri bu tabloya
-- uygulanmamış; sonra da ben yalnız `authenticated` için grant yazmışım.
-- Sonuç: Edge Function daha ilk sorguda duvara çarpıyordu.
--
-- ── NEDEN GÜVENLİ ────────────────────────────────────────────────────────
-- `service_role` anahtarı TARAYICIYA İNMEZ; yalnız Supabase'in kendi
-- sunucusunda, Edge Function'ın içinde bulunur. Ona yetki vermek dışarıya
-- bir kapı açmaz — Supabase'in kendi tasarımı da budur.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Başvuru tabloları ────────────────────────────────────────────────────
grant select, insert, update on table business_application       to service_role;
grant select, insert         on table business_application_event to service_role;
grant usage, select          on sequence business_application_event_id_seq to service_role;

-- ⚠️ DELETE YİNE KİMSEDE YOK. Başvurunun izi kalıcıdır (0032).

-- ── Hesap kurulumunun dokunduğu tablolar ─────────────────────────────────
-- `app.isletme_kullanicisi_ac` SECURITY DEFINER olduğu için bunlara sahibin
-- yetkisiyle yazıyor; yine de Edge Function ileride doğrudan okumak
-- isterse duvara çarpmasın diye OKUMA veriyoruz. Yazma YOK: hesap kurulumu
-- tek kapıdan, o fonksiyondan geçer.
grant select on table app_user           to service_role;
grant select on table user_role          to service_role;
grant select on table user_branch_access to service_role;
grant select on table tenant             to service_role;
grant select on table company            to service_role;
grant select on table branch             to service_role;

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- 1) Artık okuyabiliyor mu? Bu blok `service_role` rolüne geçip gerçekten
--    deniyor ve sonra geri dönüyor. Kalıcı bir etkisi yok.
do $$
declare
  v_adet int;
begin
  set local role service_role;
  select count(*) into v_adet from business_application;
  reset role;
  raise notice 'service_role basvurulari okuyabiliyor (% satir).', v_adet;
exception when others then
  reset role;
  raise exception 'DURDU: service_role hala okuyamiyor. Sebep: %', sqlerrm;
end $$;

-- 2) Kim neye erişiyor? `anon` satırında SELECT GÖRÜNMEMELİ.
select grantee as rol, privilege_type as yetki
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'business_application'
   and grantee in ('anon', 'authenticated', 'service_role')
 order by grantee, privilege_type;

-- 3) Davet durumu — düğmeye bastıktan sonra buraya bakılacak.
select reference as numara, company_name as firma, status as durum,
       case when owner_user_id is null then 'YOK' else 'VAR' end as giris_hesabi,
       invited_at as davet_zamani
  from business_application
 order by created_at;
