\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0110 · GERİ ARAMA SPAM KAPISI EŞZAMANLI YAZIMA KAPALI (MIYOP-102)
--
-- Sorular:
--   1 · Kısmi tekillik indeksi var ve GERÇEKTEN kısmi mi?      → EVET
--   2 · Aynı telefona ikinci NEW satır FİZİKEN yazılabiliyor mu? → HAYIR
--   3 · Kapalı (CLOSED) talep ikinci açık talebi engelliyor mu?  → HAYIR
--        (indeks yalnız NEW satırları kapsıyor; eski talebi kapatan
--         kişi yeni talep bırakabilmeli)
--   4 · 24 saat / 3 talep sınırı işliyor mu?                   → EVET
--   5 · Gövdede işlem kilidi var ve kapı okumasından ÖNCE mi?  → EVET
--   6 · Çakışan kısıt ayırt ediliyor mu (yanlış mesaj yok)?    → EVET
--   7 · Veritabanında çift açık talep kaldı mı?                → HAYIR
--
-- ⚠️ EŞZAMANLILIĞIN KENDİSİ BU DOSYADA ÖLÇÜLEMEZ: prova tek işlem içinde
-- koşuyor, tek işlem kendi yazdığını görür. Yarış İKİ OTURUMLA ayrıca
-- ölçüldü ve çıktısı 0110 göçünün başlığında duruyor:
--     onarımdan önce → 2 NEW satır (iki kapı okuması da 0 gördü)
--     onarımdan sonra → B kilitte BEKLEDİ, sonra MI409 aldı
-- Buradaki ölçüm o yarışın FİZİKSEL emniyetini sınıyor: kilidi almayan
-- bir yol ikinci açık talebi yazabiliyor mu? Yazamaz — indeks reddediyor.
-- İki oturum araklandığında ham yazım tam bu indekse çarptı.
--
-- ⚠️ `set local role anon` TAKILIYOR (MIYOP-042): form oturumsuz çağrılıyor.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
declare v_ad text := coalesce(p_ad, '(iddia metni NULL uretti)');
begin
  if p_kosul then raise notice '  ✓ %', v_ad;
  else raise exception '  ✗ %', v_ad; end if;
end; $$;

-- ── 1 · İNDEKS VAR MI, KISMİ Mİ ──────────────────────────────────────────
do $$
begin
  perform prova_bak('kismi tekillik indeksi var (tekil VE kosullu)',
    exists (select 1 from pg_index x join pg_class c on c.oid = x.indexrelid
             where c.relname = 'callback_request_acik_talep_tekil'
               and x.indisunique and x.indpred is not null));
  perform prova_bak('indeks callback_request uzerinde',
    exists (select 1 from pg_index x
              join pg_class c on c.oid = x.indexrelid
              join pg_class t on t.oid = x.indrelid
             where c.relname = 'callback_request_acik_talep_tekil'
               and t.relname = 'callback_request'));
  perform prova_bak('⚠️ veritabaninda cift acik talep YOK',
    not exists (select 1 from public.callback_request where status='NEW'
                 group by phone having count(*) > 1));
end $$;

-- ── 2 · FİZİKSEL EMNİYET · İKİNCİ NEW SATIR YAZILAMIYOR ──────────────────
-- ⚠️ Kapıyı (fonksiyonu) ATLAYARAK doğrudan tabloya yazılıyor. İki
-- eşzamanlı çağrının ürettiği durum tam budur: kapı okuması hiçbir şey
-- görmemiş, yazım tabloya gelmiş.
do $$
declare v_kod text; v_tel text := '5321100110';
begin
  insert into public.callback_request
    (reference, full_name, phone, company_name, best_time, consent_at, consent_version)
  values (app.geri_arama_referansi(),'Prova Bir',v_tel,'Prova Bir Ltd',
          'FARKETMEZ', now(), 'prova');

  begin
    insert into public.callback_request
      (reference, full_name, phone, company_name, best_time, consent_at, consent_version)
    values (app.geri_arama_referansi(),'Prova Iki',v_tel,'Prova Iki Ltd',
            'FARKETMEZ', now(), 'prova');
    v_kod := '00000';
  exception when unique_violation then v_kod := 'TEKILLIK';
  end;
  perform prova_bak('⚠️ ayni telefona IKINCI acik talep FIZIKEN yazilamadi ('
    ||v_kod||')', v_kod = 'TEKILLIK');

  -- 3 · Kapatılan talepten sonra yeni talep yazılabilmeli: indeks yalnız
  -- NEW satırları kapsıyor. Aksi hâlde bir kez arayıp kapattığımız müşteri
  -- bir daha hiç talep bırakamazdı.
  update public.callback_request set status='CLOSED' where phone=v_tel and status='NEW';
  begin
    insert into public.callback_request
      (reference, full_name, phone, company_name, best_time, consent_at, consent_version)
    values (app.geri_arama_referansi(),'Prova Uc',v_tel,'Prova Uc Ltd',
            'FARKETMEZ', now(), 'prova');
    v_kod := 'YAZILDI';
  exception when unique_violation then v_kod := 'TEKILLIK';
  end;
  perform prova_bak('kapatilan talepten SONRA yeni talep yazilabildi ('||v_kod||')',
    v_kod = 'YAZILDI');
end $$;

-- ── 4 · 24 SAAT / 3 TALEP SINIRI ─────────────────────────────────────────
-- ⚠️ Bu sınırı hiçbir tekillik indeksi ifade edemez: sayma kuralı. Onu
-- eşzamanlı yazıma karşı koruyan tek şey işlem kilidi.
grant execute on function prova_bak(text,boolean) to anon;
grant usage on schema public to anon;

do $$
declare v_tel text := '5321100111'; i int;
begin
  -- Üç talep, hepsi KAPALI (açık talep kapısına çarpmasın), hepsi 24 saat içinde.
  for i in 1..3 loop
    insert into public.callback_request
      (reference, full_name, phone, company_name, best_time, consent_at,
       consent_version, status, created_at)
    values (app.geri_arama_referansi(),'Prova Sayac',v_tel,'Prova Sayac Ltd',
            'FARKETMEZ', now(), 'prova', 'CLOSED', now() - (i || ' hours')::interval);
  end loop;
end $$;

set local role anon;

do $$
declare v_kod text;
begin
  begin
    perform public.geri_arama_gonder('Prova Dorduncu','05321100111','Prova Ltd',
                                     null,null,'FARKETMEZ',true);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ 24 saatte DORDUNCU talep REDDEDILDI ('||v_kod||')',
    v_kod = 'MI429');
end $$;

reset role;

-- ── 5-6 · GÖVDE ÖLÇÜMÜ ───────────────────────────────────────────────────
-- ⚠️ TUZAK 181: `pg_get_functiondef` yorumları da döndürür; önce silinir.
do $$
declare v_govde text;
begin
  select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'geri_arama_gonder';

  perform prova_bak('govde: telefon basina islem kilidi var',
    v_govde ~ 'pg_advisory_xact_lock');
  perform prova_bak('govde: kilit kapi okumasindan ONCE aliniyor',
    position('pg_advisory_xact_lock' in v_govde)
      < position('and status = ''NEW''' in v_govde));
  perform prova_bak('govde: cakisan kisit ayirt ediliyor (yanlis mesaj yok)',
    v_govde ~ 'constraint_name'
      and v_govde ~ 'callback_request_acik_talep_tekil');
  perform prova_bak('govde: 0106 kurallari yerinde (telefon sadelestirme, onay)',
    v_govde ~ 'app\.telefon_sadelestir' and v_govde ~ 'p_consent');
  perform prova_bak('govde: yazilamayacak alan parametreye GIRMEDI',
    v_govde !~ 'p_status' and v_govde !~ 'p_contacted');
end $$;

rollback;
