\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- TERS PROVA 0110 · İNDEKSİ KALDIRINCA PROVA GERÇEKTEN KIRMIZI VERİYOR MU
--
-- ⚠️ NEDEN VAR: `prova-0110.sql` yeşil yanıyor. Ama bir emniyet provası,
-- emniyet OLMASAYDI DA yeşil yanıyorsa hiçbir şey ölçmüyordur. Bu dosya
-- kısmi tekillik indeksini düşürüp aynı telefona İKİNCİ açık talebin
-- GERÇEKTEN yazılabildiğini gösteriyor.
--
-- ⚠️ Kapı (fonksiyon) atlanarak yazılıyor — iki eşzamanlı çağrının
-- ürettiği durum tam budur: kapı okuması diğerinin henüz COMMIT edilmemiş
-- satırını görmez, iki yazım da tabloya gelir. Yarışın kendisi iki
-- oturumla ayrıca ölçüldü; çıktısı 0110 göçünün başlığında.
--
-- `rollback` ile bitiyor: veritabanına dokunmuyor — indeks de geri geliyor.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
declare v_ad text := coalesce(p_ad, '(iddia metni NULL uretti)');
begin
  if p_kosul then raise notice '  ✓ %', v_ad;
  else raise exception '  ✗ %', v_ad; end if;
end; $$;

-- ── ÖNCE · İNDEKS YERİNDEYKEN YAZILAMIYOR ────────────────────────────────
do $$
declare v_kod text; v_tel text := '5321100112';
begin
  insert into public.callback_request
    (reference, full_name, phone, company_name, best_time, consent_at, consent_version)
  values (app.geri_arama_referansi(),'Ters Bir',v_tel,'Ters Bir Ltd',
          'FARKETMEZ', now(), 'prova');
  begin
    insert into public.callback_request
      (reference, full_name, phone, company_name, best_time, consent_at, consent_version)
    values (app.geri_arama_referansi(),'Ters Iki',v_tel,'Ters Iki Ltd',
            'FARKETMEZ', now(), 'prova');
    v_kod := '00000';
  exception when unique_violation then v_kod := 'TEKILLIK';
  end;
  perform prova_bak('indeks yerindeyken ikinci acik talep yazilamadi ('||v_kod||')',
    v_kod = 'TEKILLIK');
end $$;

-- ── İNDEKS KALDIRILIYOR: 0110 ÖNCESİNİN HÂLİ ─────────────────────────────
drop index if exists public.callback_request_acik_talep_tekil;

-- ── SONRA · EMNİYET YOKKEN İKİ AÇIK TALEP OLUŞUYOR ───────────────────────
do $$
declare v_say int; v_tel text := '5321100113';
begin
  insert into public.callback_request
    (reference, full_name, phone, company_name, best_time, consent_at, consent_version)
  values (app.geri_arama_referansi(),'Ters Uc',v_tel,'Ters Uc Ltd',
          'FARKETMEZ', now(), 'prova'),
         (app.geri_arama_referansi(),'Ters Dort',v_tel,'Ters Dort Ltd',
          'FARKETMEZ', now(), 'prova');

  select count(*) into v_say from public.callback_request
   where phone = v_tel and status = 'NEW';

  -- ⚠️ BU SATIRIN YEŞİL YANMASI, KUSURUN GERÇEK OLDUĞUNUN KANITIDIR.
  -- 0110 öncesinde eşzamanlı iki ziyaretçi aynı numara için iki açık
  -- talep bırakabiliyordu; "aynı numaradan tek açık talep" kuralı
  -- yalnız yazıda vardı.
  perform prova_bak('⚠️ INDEKS YOKKEN ayni telefonda IKI acik talep olustu — '
    ||'kusur gercekti (NEW satir: '||v_say||')', v_say = 2);
end $$;

rollback;
