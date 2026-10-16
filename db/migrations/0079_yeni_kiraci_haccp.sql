-- ═══════════════════════════════════════════════════════════════════════════
-- 0079 · YENİ KİRACI HACCP PLANIYLA DOĞAR
-- ---------------------------------------------------------------------------
-- ⚠️ DEMO ÖNCESİ BULUNDU (13.10.2026). Emrah Cumartesi demoyu TEMİZ BİR
-- TENANT'ta, ilk müşteri kaydından başlayarak canlı yapacak. "Yeni açılan
-- kiracının içinde ne var?" diye sorup ölçtüm:
--
--   order_approval_step  3 ✅   (tetikle doğuyor)
--   tenant_license       1 ✅   (0042'deki `firma_dogunca_lisans_ac` tetiği)
--   rol / izin / birim     ✅   (global)
--   haccp_plan           0 ❌
--   haccp_ccp            0 ❌
--
-- Yani yeni kiracıda HACCP EKRANI BOMBOŞ açılıyor. Demoda gösterilecek üç
-- şeyin BİRİNCİSİ HACCP (Emrah'ın müşteri öncelik listesi) ve o ekran boş
-- gelecekti.
--
-- ── SEBEP ────────────────────────────────────────────────────────────────
-- 0024 planı şöyle tohumluyor: `insert into haccp_plan ... from tenant t`.
-- Bu, GÖÇ ÇALIŞTIĞI ANDA var olan kiracıları doldurur. Sonradan doğan
-- kiracı hiçbir şey almaz. Tohumlama bir kerelik bir işti; kural değildi.
--
-- ── ÇÖZÜM: 0042'NİN KALIBI ───────────────────────────────────────────────
-- Lisans tarafında aynı sorun daha önce çözülmüş ve gerekçesi 0042'de yazılı:
--   "Kural fonksiyonda değil TABLODA: firmayı kim yaratırsa yaratsın
--    (onay, demo betiği, elle insert) lisans da doğar." (tuzak 35)
-- Aynısını HACCP için yapıyoruz: `tenant` tablosuna AFTER INSERT tetiği.
-- Böylece başvuru onayı, demo betiği ya da elle insert — hangisi olursa
-- olsun plan doğar.
--
-- ⚠️ CCP DEĞERLERİ ELLE YAZILMADI. Aşağıdaki liste 0024'ten BİREBİR
-- çıkarıldı. Elle kopyalamak, aynı gerçeği iki yerde tutmak olurdu; limitler
-- birinde değişip diğerinde kalsaydı hangisinin doğru olduğunu kimse
-- bilemezdi (tuzak 66). Buradan sonra TEK KAYNAK bu fonksiyondur; 0024'teki
-- tohumlama tarihsel kayıt olarak yerinde duruyor.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.kiraci_haccp_plani_kur(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_plan uuid;
begin
  if p_tenant is null then return; end if;

  -- Yürürlükte plan varsa hiçbir şey yapma (0042'deki lisans kalıbı).
  select id into v_plan from public.haccp_plan
   where tenant_id = p_tenant and code = 'HP-01';

  if v_plan is null then
    insert into public.haccp_plan (tenant_id, code, name, description, status)
    values (p_tenant, 'HP-01', 'Endüstriyel Mutfak HACCP Planı',
            'Mal kabulden sevkiyata kadar kritik kontrol noktaları.', 'ACTIVE')
    on conflict (tenant_id, code) do nothing
    returning id into v_plan;

    if v_plan is null then
      select id into v_plan from public.haccp_plan
       where tenant_id = p_tenant and code = 'HP-01';
    end if;
  end if;

  if v_plan is null then return; end if;

  -- ⚠️ Boş bir HACCP ekranı, olmayan bir HACCP ekranından biraz daha iyidir —
  -- ama DOLU bir ekran ikisinden de iyidir. İşletme kendi limitini
  -- değiştirebilir; sıfırdan kurmak zorunda değil.
  insert into public.haccp_ccp (
    tenant_id, plan_id, code, name, stage,
    limit_type, limit_min, limit_max, uom, limit_text,
    monitoring_method, monitoring_frequency, responsible_role,
    hazard_type, hazard_note, corrective_instruction)
  select p_tenant, v_plan, v.code, v.name, v.stage,
         v.limit_type, v.limit_min, v.limit_max, v.uom, v.limit_text,
         v.method, v.freq, v.role, v.hazard, v.hazard_note, v.corrective
  from (values

  ('CCP-1','Soğuk zincir · mal kabul','RECEIVING','MAX',null,4.0,'°C','En çok 4 °C',
   'Prob termometre, ürün merkezinden','Her teslimatta','Depo sorumlusu','BIOLOGICAL',
   'Soğuk zincir kırılması patojen üremesine yol açar',
   'Malı KABUL ETME. Tedarikçiye iade et, gerekçeyi belgeye yaz.'),
  ('CCP-2','Donmuş ürün · mal kabul','RECEIVING','MAX',null,-18.0,'°C','En çok -18 °C',
   'Prob termometre','Her teslimatta','Depo sorumlusu','BIOLOGICAL',
   'Kısmi çözünme ve yeniden donma',
   'Malı kabul etme; çözünme izi varsa kesinlikle iade.'),
  ('CCP-3','Soğuk oda sıcaklığı','STORAGE','RANGE',0.0,4.0,'°C','0 – 4 °C',
   'Oda termometresi','Günde 2 kez','Depo sorumlusu','BIOLOGICAL',
   'Depolama sıcaklığının yükselmesi',
   'Ürünleri başka odaya al, tekniğe haber ver, etkilenen partileri blokla.'),
  ('CCP-4','Derin donduruculu depo','STORAGE','MAX',null,-18.0,'°C','En çok -18 °C',
   'Oda termometresi','Günde 2 kez','Depo sorumlusu','BIOLOGICAL',
   'Çözünme',
   'Ürünleri başka dondurucuya al; çözünmüş ürünü imhaya ayır.'),
  ('CCP-5','Pişirme merkez sıcaklığı','COOKING','MIN',75.0,null,'°C','En az 75 °C',
   'Prob termometre, en kalın noktadan','Her kazanda','Üretim sorumlusu','BIOLOGICAL',
   'Patojenlerin canlı kalması',
   'Pişirmeye devam et, 75 °C sağlanana kadar ürünü çıkarma.'),
  ('CCP-6','Hızlı soğutma · 2 saatte 10 °C','BLAST_CHILLING','MAX',null,10.0,'°C',
   'En çok 10 °C (2 saat içinde)',
   'Prob termometre, şoklama çıkışında','Her partide','Üretim sorumlusu','BIOLOGICAL',
   'Tehlikeli sıcaklık aralığında geçirilen süre',
   'Soğutmaya devam et; 2 saat aşıldıysa ürünü imhaya ayır.'),
  ('CCP-7','Sıcak servis bekletme','HOT_HOLDING','MIN',65.0,null,'°C','En az 65 °C',
   'Prob termometre','Saat başı','Mutfak sorumlusu','BIOLOGICAL',
   'Bekletmede patojen üremesi',
   'Yeniden 75 °C''ye ısıt; 2 saatten uzun süre 65 °C altındaysa imha.'),
  ('CCP-8','Sevkiyat aracı sıcaklığı','DISPATCH','MAX',null,4.0,'°C','En çok 4 °C',
   'Araç termometresi, yükleme öncesi','Her seferde','Sevkiyat sorumlusu','BIOLOGICAL',
   'Dağıtımda soğuk zincir kırılması',
   'Aracı yükleme, soğutmayı çalıştır; kırılma olduysa sevkiyatı durdur.')
) as v(code, name, stage, limit_type, limit_min, limit_max, uom, limit_text,
         method, freq, role, hazard, hazard_note, corrective)
  on conflict (tenant_id, code) do nothing;
end;
$$;

comment on function app.kiraci_haccp_plani_kur(uuid) is
  'Kiracıya endüstriyel mutfak HACCP planını ve 8 kritik kontrol noktasını '
  'kurar. Planı varsa hiçbir şey yapmaz. CCP limitleri 0024 ile birebir.';


-- ── TETİK: KİRACI DOĞUNCA PLAN DA DOĞAR ──────────────────────────────────
-- ⚠️ Kural TABLODA, çağıran koda bırakılmıyor. Başvuru onayı, demo betiği,
-- elle insert — hepsi aynı yerden geçiyor. Kuralı onay fonksiyonuna
-- koysaydık, demoda elle açılan bir kiracı plansız kalırdı.
create or replace function app.kiraci_dogunca_haccp_kur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.kiraci_haccp_plani_kur(new.id);
  return null;
end;
$$;

drop trigger if exists trg_kiraci_haccp on public.tenant;
create trigger trg_kiraci_haccp
  after insert on public.tenant
  for each row execute function app.kiraci_dogunca_haccp_kur();


-- ── GERİYE DÖNÜK: PLANI OLMAYAN KİRACILAR ────────────────────────────────
-- Göçten önce doğmuş ve planı olmayan kiracılar da doldurulsun.
do $$
declare r record; v_say int := 0;
begin
  for r in select t.id from public.tenant t
            where not exists (select 1 from public.haccp_plan p
                               where p.tenant_id = t.id and p.code = 'HP-01')
  loop
    perform app.kiraci_haccp_plani_kur(r.id);
    v_say := v_say + 1;
  end loop;
  if v_say > 0 then
    raise notice '0079: planı olmayan % kiracıya HACCP kuruldu', v_say;
  end if;
end;
$$;


-- ── KAPILAR ──────────────────────────────────────────────────────────────
-- ⚠️ PostgreSQL varsayılanı `PUBLIC EXECUTE` (tuzak 67). Bu fonksiyonlar
-- yalnız tetik içinden çalışır; dışarıya hiç açılmıyor.
revoke all on function app.kiraci_haccp_plani_kur(uuid) from public;
revoke all on function app.kiraci_dogunca_haccp_kur() from public;
grant execute on function app.kiraci_haccp_plani_kur(uuid) to service_role;


-- ── DOĞRULAMA ────────────────────────────────────────────────────────────
-- ⚠️ BURADA DENEME KİRACISI AÇILMIYOR — VE BUNU DENEYEREK ÖĞRENDİM.
-- İlk hâli gerçekten bir kiracı açıp sonra siliyordu; silme
-- `audit_log_tenant_id_fkey` yüzünden başarısız oldu. Sebep doğru: denetim
-- defteri append-only (0027), bir kiracıyı açmak iz bırakır ve o iz
-- silinmemeli. Yani göç içinde "deneme verisi açıp temizlemek" mümkün değil
-- ve olmaması da doğru.
--
-- Bu yüzden iş bölünüyor:
--   GÖÇ      → YAPININ doğruluğunu sınar (tetik var mı, etkin mi, boşta
--               kiracı kaldı mı)
--   PROVA    → DAVRANIŞI sınar (`prova-0079.sql`, kendi işlemi içinde
--               kiracı açıp geri alıyor)
do $$
declare v_eksik int; v_az int;
begin
  if to_regprocedure('app.kiraci_haccp_plani_kur(uuid)') is null
     or to_regprocedure('app.kiraci_dogunca_haccp_kur()') is null then
    raise exception '0079: fonksiyonlar oluşmadı.';
  end if;

  -- Tetik VAR mı ve ETKİN mi? (`tgenabled = 'D'` devre dışı demektir —
  -- var olan ama kapatılmış bir tetik, olmayan tetikten daha kötüdür:
  -- kontrol listesinde yeşil görünür.)
  if not exists (
    select 1 from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
    where tg.tgname = 'trg_kiraci_haccp'
      and c.relname = 'tenant'
      and not tg.tgisinternal
      and tg.tgenabled <> 'D'
  ) then
    raise exception '0079: tetik yok ya da devre dışı — yeni kiracı plansız doğar.';
  end if;

  -- Planı olmayan kiracı kaldı mı? (geriye dönük doldurma çalıştı mı)
  select count(*) into v_eksik from public.tenant t
   where not exists (select 1 from public.haccp_plan p
                      where p.tenant_id = t.id and p.code = 'HP-01');
  if v_eksik > 0 then
    raise exception '0079: % kiracıda HACCP planı yok.', v_eksik;
  end if;

  -- Planı olup CCP'si eksik kiracı var mı?
  select count(*) into v_az from (
    select p.tenant_id from public.haccp_plan p
     where p.code = 'HP-01'
       and (select count(*) from public.haccp_ccp c
             where c.tenant_id = p.tenant_id and c.plan_id = p.id) < 8
  ) x;
  if v_az > 0 then
    raise exception '0079: % kiracıda CCP sayısı 8''den az.', v_az;
  end if;

  raise notice '0079 TAMAM · tetik etkin, planı eksik kiracı yok';
end;
$$;

notify pgrst, 'reload schema';
