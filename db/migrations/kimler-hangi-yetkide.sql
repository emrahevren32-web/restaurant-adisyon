-- ═══════════════════════════════════════════════════════════════════════
-- ABC GIDA · HANGİ HESAP, HANGİ YETKİDE
-- Supabase → SQL Editor → yapıştır → Run. Hiçbir şeyi DEĞİŞTİRMEZ, okur.
-- ═══════════════════════════════════════════════════════════════════════
select
  t.name                                   as "İşletme",
  u.full_name                              as "Ad Soyad",
  coalesce(nullif(app.giris_adi(u.id), ''),
           u.username || '@' || t.code)    as "Giriş adı",
  r.name                                   as "Ana görev (birincil rol)",
  coalesce(
    (select string_agg(r2.name, ' + ' order by r2.name)
       from user_role ur
       join role r2 on r2.code = ur.role_code
      where ur.user_id = u.id
        and ur.role_code <> u.role_code),
    '—')                                   as "Ek roller",
  (select count(distinct rp.permission_code)
     from role_permission rp
    where rp.role_code = u.role_code
       or rp.role_code in (select ur.role_code from user_role ur
                            where ur.user_id = u.id))
                                           as "Toplam izin",
  case when u.is_active then 'aktif' else 'KAPALI' end          as "Durum",
  case when u.must_change_password then 'EVET — ilk giriş bekliyor'
       else 'hayır' end                                          as "Şifre değiştirmeli",
  to_char(u.created_at, 'DD.MM.YYYY HH24:MI')                    as "Açılış"
from app_user u
join tenant t on t.id = u.tenant_id
left join role r on r.code = u.role_code
where t.is_platform is not true
order by t.name, r.name nulls last, u.full_name;
