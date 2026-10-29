-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Göç 0102 · Giriş adresi kapısı DIŞARI KAPANIYOR · MIYOP-043
--
-- ── ÖN KOŞUL · SIRA ÖNEMLİ ────────────────────────────────────────────────
-- ⚠️ Bu göç, `giris-yap` Edge Function'ı CANLIDA ÇALIŞMADAN önce
-- uygulanırsa GİRİŞİ TAMAMEN KIRAR: tarayıcı adresi soramaz, sunucu da
-- yoktur. Kimse giremez.
--
-- Ölçüm (29.10.2026 05:02 · Supabase → Edge Functions → giris-yap →
-- Invocations): `POST giris-yap 200`. Yani fonksiyon canlıda çalıştı ve
-- oturum verdi. Ön koşul SAĞLANDI — bu göç bundan SONRA yazıldı.
--
-- ⚠️ YENİ BİR SUPABASE PROJESİNDE: önce `giris-yap` dağıtılır, sonra bu
-- göç uygulanır. Ters sıra giriş ekranını kapatır.
--
-- ── NEDEN ─────────────────────────────────────────────────────────────────
-- 0078, `public.giris_adresi_bul`u `anon, authenticated, service_role`e
-- BİRLİKTE verdi. Giriş ekranı oturumsuzken adres çevirmek zorunda
-- olduğu için `anon` hakkı o gün doğruydu. Codex denetimi (18.10.2026)
-- iki sızıntı gösterdi:
--   · bulunan kullanıcı için GERÇEK Auth e-postası dönüyordu,
--   · bulunamayan ad `@bulunamadi.miyop.local` ile dönüyordu — yani
--     cevabın BİÇİMİ "bu kullanıcı var mı" sorusunu parola bilmeden
--     cevaplıyordu.
--
-- ⚠️ KAPSAM DÜZELTMESİ (Codex, 20.10): yalnız `anon`dan almak YARIM bir
-- onarımdır. Oturum açmış biri başka işletmenin kullanıcı adını sorup
-- gerçek Auth adresini alabilir — fonksiyonun İÇİNDE kiracı kapısı yok.
-- Bu yüzden `authenticated` hakkı da alınıyor.
--
-- ── NE YAPILMIYOR ─────────────────────────────────────────────────────────
-- ⚠️ Fonksiyon SİLİNMİYOR. `giris-yap` onu `service_role` ile çağırıyor;
--    silmek girişi kırar. Kapanan şey yalnızca DIŞARI açılan kapısıdır.
-- ⚠️ `public.personel_giris_adresi(uuid, text)` DOKUNULMUYOR.
--    `authenticated` hakkını topluca almak personel hesabı açmayı kırar.
--    Bu göç onu ölçüyor ve açık kaldığını doğruluyor.
-- ⚠️ `app.giris_adresi_bul`a dokunulmuyor — zaten yalnız `service_role`de.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · ÖN DENETİM ────────────────────────────────────────────────────────
-- ⚠️ `pg_get_function_identity_arguments` ARGÜMAN ADLARINI da içerir ve
-- metin karşılaştırması yanlış "fonksiyon yok" der (tuzak 137). Tür
-- üzerinden bakmanın doğru yolu `to_regprocedure`dır.
do $$
begin
  if to_regprocedure('public.giris_adresi_bul(text, text)') is null then
    raise exception '0102: public.giris_adresi_bul YOK — 0078 uygulanmamış.';
  end if;
  if to_regprocedure('app.giris_adresi_bul(text, text)') is null then
    raise exception '0102: app.giris_adresi_bul YOK — asıl fonksiyon eksik.';
  end if;
  if not has_function_privilege('service_role',
        'public.giris_adresi_bul(text, text)', 'execute') then
    raise exception
      '0102: service_role zaten çağıramıyor — Edge Function şu an kırık.';
  end if;
end;
$$;

-- ── 2 · KAPI KAPANIYOR ────────────────────────────────────────────────────
revoke all     on function public.giris_adresi_bul(text, text) from public;
revoke execute on function public.giris_adresi_bul(text, text) from anon;
revoke execute on function public.giris_adresi_bul(text, text) from authenticated;

-- ⚠️ Edge Function'ın yolu AÇIK KALIYOR. Bu satır gereksiz görünebilir
-- ama değildir: yukarıdaki `revoke all ... from public` bir gün
-- `service_role`ü de etkileyecek şekilde değişirse, bu satır onu geri
-- verir ve göç sessizce girişi kırmaz.
grant execute on function public.giris_adresi_bul(text, text) to service_role;

-- ── 3 · DOĞRULAMA · YALNIZ BU GÖÇÜN YAZDIĞINI ÖLÇER ───────────────────────
-- ⚠️ Doğrulama, göçün KENDİ iddiasını ölçmelidir: kapı kapandı mı,
-- Edge Function'ın yolu açık kaldı mı, personel akışı sağlam mı.
do $$
begin
  if has_function_privilege('anon',
        'public.giris_adresi_bul(text, text)', 'execute') then
    raise exception '0102: anon HÂLÂ çağırabiliyor — sızıntı kapanmadı.';
  end if;
  if has_function_privilege('authenticated',
        'public.giris_adresi_bul(text, text)', 'execute') then
    raise exception
      '0102: authenticated HÂLÂ çağırabiliyor — onarım yarım kaldı.';
  end if;
  if not has_function_privilege('service_role',
        'public.giris_adresi_bul(text, text)', 'execute') then
    raise exception '0102: service_role çağıramıyor — GİRİŞ KIRILDI.';
  end if;

  -- PUBLIC varsayılan olarak AÇIKTIR; kapandığını ayrıca ölçüyoruz.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(p.proacl) a
    where n.nspname = 'public' and p.proname = 'giris_adresi_bul'
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception '0102: fonksiyon HERKESE açık kalmış.';
  end if;

  -- Fonksiyon duruyor mu? (silmek girişi kırardı)
  if to_regprocedure('public.giris_adresi_bul(text, text)') is null then
    raise exception '0102: fonksiyon kayboldu.';
  end if;

  -- Personel akışı DOKUNULMAMIŞ olmalı.
  if to_regprocedure('public.personel_giris_adresi(uuid, text)') is null then
    raise exception '0102: public.personel_giris_adresi YOK.';
  end if;
  if not has_function_privilege('authenticated',
        'public.personel_giris_adresi(uuid, text)', 'execute') then
    raise exception
      '0102: personel_giris_adresi kapanmış — personel hesabı açmak kırıldı.';
  end if;

  raise notice '✅ 0102: giris_adresi_bul yalnız service_role''de; personel akışı açık.';
end;
$$;
