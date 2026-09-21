-- ═══════════════════════════════════════════════════════════════════════════
-- BAKIM · Yanlış adrese açılmış giriş hesabını geri al
--
-- ── NE ZAMAN KULLANILIR ──────────────────────────────────────────────────
-- "Giriş hesabı aç ve davet gönder" yanlış bir e-postaya basıldı, ya da
-- prova sırasında açılan hesap temizlenmek isteniyor.
--
-- ⚠️ BU BİR GÖÇ DEĞİL. `db/migrations` altına KONULMAZ: her ortamda
-- çalışması gereken bir kural değil, elle yapılan bir onarım.
--
-- ── NE YAPAR, NE YAPMAZ ──────────────────────────────────────────────────
-- YAPAR : MİYOP tarafındaki kullanıcıyı ve bağlantılarını siler, başvuruyu
--         "hesap açılmamış" hâline döndürür. Böylece düğmeye tekrar
--         basılabilir.
-- YAPMAZ: Supabase Auth tarafındaki kullanıcıyı SİLMEZ. Onu panelden siz
--         silersiniz: Authentication → Users → ilgili satır → Delete user.
--         Silmezseniz o adres "already registered" sayılır ve akış şifre
--         belirleme yoluna girer — ki bu da çalışır.
--
-- ── KULLANIM ─────────────────────────────────────────────────────────────
-- Aşağıdaki `v_numara` değerini değiştirin, sonra TAMAMINI çalıştırın.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ⚠️ BURAYI DEĞİŞTİRİN. Geri alınacak başvurunun numarası.
  v_numara text := 'MIY-74AAT';

  v_basvuru  record;
  v_kullanici record;
begin
  select id, reference, company_name, email, status, owner_user_id
    into v_basvuru
    from business_application
   where reference = upper(btrim(v_numara));

  if v_basvuru.id is null then
    raise exception 'Basvuru bulunamadi: %', v_numara;
  end if;

  if v_basvuru.owner_user_id is null then
    raise notice 'Bu basvurunun MIYOP tarafinda acilmis bir giris hesabi YOK (% / %). Yapilacak bir sey kalmadi.',
      v_basvuru.reference, v_basvuru.company_name;
    return;
  end if;

  select id, username, role_code, tenant_id, auth_user_id
    into v_kullanici
    from app_user where id = v_basvuru.owner_user_id;

  -- ── KORUMA 1 · Platform yöneticisine dokunulmaz ─────────────────────────
  -- Yanlış numara yazıldığında kendi yönetici hesabını silmek, ekrana
  -- girişi tamamen kaybetmek demek olurdu.
  if v_kullanici.auth_user_id = '141939e8-5779-43af-b468-9cbc8ee2b1fb' then
    raise exception 'DURDU: bu satir PLATFORM YONETICISINE ait (%). Silinmez.',
      v_kullanici.username;
  end if;
  if v_kullanici.role_code in ('admin', 'super_admin') then
    raise exception 'DURDU: silinmek istenen kullanici % rolunde (%). Platform rolleri bu betikle silinmez.',
      v_kullanici.role_code, v_kullanici.username;
  end if;

  -- ── KORUMA 2 · Kiracının SON kullanıcısı değilse uyar ───────────────────
  -- İşletmenin başka kullanıcısı varsa, sahibini silmek onları yetim
  -- bırakır. Engellemiyoruz ama söylüyoruz — karar insanın.
  if (select count(*) from app_user where tenant_id = v_kullanici.tenant_id) > 1 then
    raise notice 'UYARI: bu kiracida % kullanici var. Yalnizca isletme sahibi siliniyor.',
      (select count(*) from app_user where tenant_id = v_kullanici.tenant_id);
  end if;

  -- ── Geri alma ───────────────────────────────────────────────────────────
  -- `user_role` ve `user_branch_access` `on delete cascade` ile gider.
  delete from app_user where id = v_kullanici.id;

  update business_application
     set owner_user_id = null,
         invited_at    = null,
         updated_at    = now()
   where id = v_basvuru.id;

  raise notice 'GERI ALINDI · basvuru % (%) · silinen kullanici % · Auth adresi: %',
    v_basvuru.reference, v_basvuru.company_name, v_kullanici.username, v_basvuru.email;
  raise notice 'SIRADAKI ADIM (elle): Supabase panelinde Authentication -> Users altinda % kaydini silin.',
    v_basvuru.email;
end $$;

-- ── Sonuç ────────────────────────────────────────────────────────────────
select reference as numara, company_name as firma, status as durum, email as eposta,
       case when owner_user_id is null then 'YOK' else 'VAR' end as giris_hesabi,
       invited_at as davet_zamani
  from business_application
 order by created_at;

select t.code as kiraci, u.username as kullanici, u.role_code as rol
  from app_user u join tenant t on t.id = u.tenant_id
 order by t.code, u.username;
