-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0077 · KULLANICI ADIYLA GİRİŞ
-- Soru: Alaattin "depocu" yazıp girebilecek mi, ve bu kapı bir şey sızdırıyor mu?
-- ⚠️ Bu dosya göç DEĞİL. `db/migrations` altına ASLA konmaz.
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

-- ── KURULUM: iki işletme, gerçekçi hesaplar ──────────────────────────────
do $$
declare
  v_abc uuid := gen_random_uuid(); v_prv uuid := gen_random_uuid();
  a_patron uuid := gen_random_uuid(); a_depo uuid := gen_random_uuid();
  a_eski   uuid := gen_random_uuid(); p_depo  uuid := gen_random_uuid();
begin
  insert into public.tenant (id, code, name) values
    (v_abc, 'ABCGIDA', 'ABC Endüstriyel Mutfak A.Ş.'),
    (v_prv, 'PRV2',    'Prova İkinci');

  -- ⚠️ İŞLETME SAHİBİNİN GİRİŞ ADRESİ GERÇEK E-POSTASI — kurala uymuyor.
  -- Adresi kullanıcıadı@işletmekodu.miyop.local kuralından üretseydik bu
  -- kişi kapıda kalırdı. Prova bunu özellikle sınıyor.
  insert into auth.users (id, email) values
    (a_patron, 'ABC.Bey@Gercek-Eposta.COM'),
    (a_depo,   'depocu@abcgida.miyop.local'),
    (a_eski,   'eskici@abcgida.miyop.local'),
    (p_depo,   'depocu@prv2.miyop.local');

  insert into public.app_user (id, tenant_id, auth_user_id, username, username_key,
                               full_name, role_code, is_active) values
    (gen_random_uuid(), v_abc, a_patron, 'abcbey', 'abcbey',
     'ABC Bey', 'isletme_sahibi', true),
    (gen_random_uuid(), v_abc, a_depo, 'depocu', 'depocu',
     'Alaattin Kocatepe', 'depo_sorumlusu', true),
    (gen_random_uuid(), v_abc, a_eski, 'eskici', 'eskici',
     'Eski Çalışan', 'depo_sorumlusu', false),
    -- Auth hesabı HİÇ açılmamış kayıt: adres yok.
    (gen_random_uuid(), v_abc, null, 'kayitsiz', 'kayitsiz',
     'Kayıtsız Kişi', 'depo_sorumlusu', true),
    -- AYNI kullanıcı adı ikinci işletmede.
    (gen_random_uuid(), v_prv, p_depo, 'depocu', 'depocu',
     'Başka Depocu', 'depo_sorumlusu', true);
end; $$;

-- ── 1 · MUTLU YOL: PERSONEL ──────────────────────────────────────────────
-- ⚠️ OTURUM TAKLİDİ YOK VE OLMAMALI. Giriş ekranı henüz oturumsuz;
-- fonksiyon tam o koşulda çalışmak zorunda.
do $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
  perform prova_bak('oturum YOKken auth.uid() boş (prova gerçek koşulda)',
    auth.uid() is null);
  perform prova_bak('"depocu" + işletme kodu → gerçek giriş adresi',
    app.giris_adresi_bul('depocu', 'ABCGIDA') = 'depocu@abcgida.miyop.local');
  perform prova_bak('yazım farkı (büyük harf/boşluk) giriş adresini bozmuyor',
    app.giris_adresi_bul('  Depo Cu  ', 'ABCGIDA') = 'depocu@abcgida.miyop.local');
  perform prova_bak('işletme kodundaki tire/boşluk önemsiz',
    app.giris_adresi_bul('depocu', 'abc-gida') = 'depocu@abcgida.miyop.local');
end; $$;

-- ── 2 · İŞLETME SAHİBİ KAPIDA KALMIYOR ───────────────────────────────────
do $$
begin
  -- ⚠️ BU PROVANIN ASIL SEBEBİ. Adresi kuraldan üretmek bu satırı patlatır.
  perform prova_bak('⚠️ işletme sahibi kullanıcı adıyla GERÇEK e-postasına çözülüyor',
    app.giris_adresi_bul('abcbey', 'ABCGIDA') = 'abc.bey@gercek-eposta.com');
  perform prova_bak('kuraldan üretilmiş adres DÖNMÜYOR (uydurma yok)',
    app.giris_adresi_bul('abcbey', 'ABCGIDA') <> 'abcbey@abcgida.miyop.local');
end; $$;

-- ── 3 · E-POSTA YAZAN KİŞİ ENGELLENMİYOR ─────────────────────────────────
do $$
begin
  perform prova_bak('e-posta girdisi olduğu gibi (küçük harfe inerek) dönüyor',
    app.giris_adresi_bul('ABC.Bey@Gercek-Eposta.COM') = 'abc.bey@gercek-eposta.com');
  perform prova_bak('hiç tanımadığımız bir e-posta da geçiyor (Auth karar verir)',
    app.giris_adresi_bul('kimse@hicbiryer.com') = 'kimse@hicbiryer.com');
end; $$;

-- ── 4 · KULLANICI ADI SAYILAMIYOR (enumeration) ──────────────────────────
do $$
declare v_yok text; v_coklu text; v_bos text; v_kayitsiz text;
begin
  v_yok      := app.giris_adresi_bul('kesinlikle-boyle-biri-yok');
  v_coklu    := app.giris_adresi_bul('depocu');          -- iki işletmede var
  v_bos      := app.giris_adresi_bul('');
  v_kayitsiz := app.giris_adresi_bul('kayitsiz', 'ABCGIDA');

  perform prova_bak('olmayan ad NULL dönmüyor', v_yok is not null);
  perform prova_bak('olmayan ad geçerli e-posta biçiminde dönüyor',
    v_yok ~ '^[a-z0-9]+@bulunamadi\.miyop\.local$');
  perform prova_bak('⚠️ iki işletmede olan ad da AYNI biçimde dönüyor (hangisi olduğu sızmıyor)',
    v_coklu like '%@bulunamadi.miyop.local');
  perform prova_bak('boş girdi de geçerli biçimde dönüyor', v_bos ~ '^[a-z0-9]+@bulunamadi\.miyop\.local$');
  perform prova_bak('Auth hesabı olmayan kayıt da "bulunamadı" davranıyor',
    v_kayitsiz like '%@bulunamadi.miyop.local');
  perform prova_bak('⚠️ var olmayanla belirsiz olan ayırt EDİLEMİYOR (aynı alan adı)',
    split_part(v_yok, '@', 2) = split_part(v_coklu, '@', 2)
    and split_part(v_yok, '@', 2) = split_part(v_kayitsiz, '@', 2));
  perform prova_bak('yanlış işletme kodu verilirse adres sızmıyor',
    app.giris_adresi_bul('depocu', 'BASKAFIRMA') like '%@bulunamadi.miyop.local');
end; $$;

-- ── 5 · PASİF KULLANICI: BİLEREK ÇÖZÜLÜYOR ───────────────────────────────
do $$
begin
  -- ⚠️ Pasif hesabı burada saklamıyoruz. Saklasaydık ekran "şifre yanlış"
  -- derdi, kişi şifresini boşuna değiştirmeye uğraşırdı. Reddi
  -- `authenticateUser` veriyor ve sebebini söyleyebiliyor.
  perform prova_bak('pasif kullanıcı adresi çözülüyor (ret bir sonraki kapıda)',
    app.giris_adresi_bul('eskici', 'ABCGIDA') = 'eskici@abcgida.miyop.local');
end; $$;

-- ── 6 · GİRİŞ EKRANININ KAPISI: anon ÇAĞIRABİLİYOR ───────────────────────
do $$
begin
  perform prova_bak('anon public sarmalayıcıyı çağırabiliyor',
    has_function_privilege('anon', 'public.giris_adresi_bul(text, text)', 'execute'));
  perform prova_bak('app şemasındaki asıl fonksiyon anon''a açık DEĞİL',
    not has_function_privilege('anon', 'app.giris_adresi_bul(text, text)', 'execute'));
end; $$;

-- Gerçekten çağırıyor mu: rolü değiştirip deniyoruz.
set role anon;
select set_config('prova.anon_sonuc',
  public.giris_adresi_bul('depocu', 'ABCGIDA'), false);
reset role;

do $$
begin
  perform prova_bak('⚠️ anon ROLÜYLE gerçekten çağrıldı ve doğru adres döndü',
    current_setting('prova.anon_sonuc') = 'depocu@abcgida.miyop.local');
end; $$;

-- ── 7 · FONKSİYON ŞİFREYE DOKUNMUYOR ─────────────────────────────────────
do $$
declare v_kaynak text;
begin
  select prosrc into v_kaynak from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'giris_adresi_bul';
  -- ⚠️ İLK HÂLİ YANLIŞTI: gövdede "şifre" KELİMESİNİ arıyordu ve kendi
  -- açıklama satırıma takıldı. Aranan şey kelime değil, DAVRANIŞ: fonksiyon
  -- şifre sütununa/karma fonksiyonuna dokunuyor mu?
  perform prova_bak('⚠️ şifre sütununa ya da karma fonksiyonuna dokunmuyor',
    v_kaynak !~* '(encrypted_password|password_hash|crypt\s*\(|\mcrypt\M)');
  perform prova_bak('⚠️ auth.users''tan YALNIZ id ve email okuyor',
    (select count(*) from regexp_matches(v_kaynak, '\mu\.([a-z_]+)', 'g') m
      where m[1] not in ('id', 'email')) = 0);
  perform prova_bak('fonksiyon veri yazmıyor (stable)',
    (select provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app' and p.proname = 'giris_adresi_bul') = 's');
end; $$;

-- ── 8 · TEK SATIRLIK CEVAP: TOPLU DÖKÜM YOK ──────────────────────────────
do $$
begin
  perform prova_bak('fonksiyon text döndürüyor (liste/tablo değil)',
    (select pg_catalog.pg_get_function_result(p.oid)
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app' and p.proname = 'giris_adresi_bul') = 'text');
end; $$;

rollback;
