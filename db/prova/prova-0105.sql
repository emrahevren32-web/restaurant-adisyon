-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0105 · YENİ ÜRÜN KARTI KDV ORANINI İŞLETMEDEN ALIYOR MU?
--
-- ⚠️ Ölçüm YAPISAL DEĞİL DAVRANIŞSALDIR: gerçekten ürün yazıp oranına
-- bakıyoruz. Göçün kendi doğrulaması tetiğin VARLIĞINI ölçer; bu dosya
-- SONUCU ölçer. 0103'te yapısal ölçümlerin hepsi yeşilken davranışı ölçen
-- sınama kırmızı vermişti (tuzak 149).
--
-- ⚠️ OLUMSUZ KONTROLLER BU DOSYANIN YARISI. 27.10'da öğrenildi: olumsuz
-- kontrolü olmayan bir sınama, kapının YOKLUĞUNU da onaylar. Burada dört
-- olumsuz kontrol var — açık oran ezilmiyor mu, boş işletme oranı uydurma
-- değere dönüyor mu, UPDATE kullanıcının silmesini geri alıyor mu, başka
-- kiracının oranı sızıyor mu.
--
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

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid; v_f uuid; v_b uuid := gen_random_uuid();
  v_t2 uuid := gen_random_uuid(); v_f2 uuid := gen_random_uuid();
  v_b2 uuid := gen_random_uuid();
  v_mus uuid := gen_random_uuid();
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;

  insert into public.branch (id, tenant_id, company_id, code, name)
  values (v_b, v_t, v_f, 'P105', 'Prova Şube');

  -- İşletme geneli oran: %18
  update public.tenant_settings set vat_rate = 18 where tenant_id = v_t;

  -- ⚠️ İKİNCİ KİRACI · yalıtım ölçümü için. Oranı BİLEREK farklı (%1):
  -- birinci kiracının ürünü %1 alırsa sızıntı var demektir.
  insert into public.tenant (id, code, name) values (v_t2, 'P105T2', 'Prova Kiraci 2');
  insert into public.company (id, tenant_id, company_code, company_name)
  values (v_f2, v_t2, 'P105F2', 'Prova Firma 2');
  insert into public.branch (id, tenant_id, company_id, code, name)
  values (v_b2, v_t2, v_f2, 'P105B', 'Prova Şube 2');
  update public.tenant_settings set vat_rate = 1 where tenant_id = v_t2;

  insert into public.customer (tenant_id, code, code_key, name)
  values (v_t, 'P105MUS', 'p105mus', 'Prova Müşteri')
  returning id into v_mus;

  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);
  perform set_config('prova.t2', v_t2::text, false);
  perform set_config('prova.b2', v_b2::text, false);
  perform set_config('prova.mus', v_mus::text, false);
  raise notice 'KURULUM TAMAM';
end $$;

-- ── 1 · YAPI ──────────────────────────────────────────────────────────────
do $$
begin
  raise notice '── 1 · YAPI';
  perform prova_bak('tetik fonksiyonu var',
    to_regprocedure('app.urun_kdv_isletmeden()') is not null);
  perform prova_bak('stock_item_kdv tetiği var',
    exists (select 1 from pg_trigger where tgrelid='public.stock_item'::regclass
              and tgname='stock_item_kdv' and not tgisinternal));
  perform prova_bak('⚠️ BEFORE INSERT ve UPDATE KAPSAMIYOR',
    exists (select 1 from pg_trigger where tgrelid='public.stock_item'::regclass
              and tgname='stock_item_kdv' and not tgisinternal
              and tgtype & 2 = 2 and tgtype & 4 = 4 and tgtype & 16 = 0));
  perform prova_bak('⚠️ security definer · izinsiz rolde sessizce boş kalmasın',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='app' and p.proname='urun_kdv_isletmeden' and p.prosecdef));
end $$;

-- ── 2 · ASIL DAVRANIŞ ─────────────────────────────────────────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid;
        v_b uuid := current_setting('prova.b')::uuid;
        v_id uuid; v_oran numeric;
begin
  raise notice '── 2 · ASIL DAVRANIŞ';
  insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_t, v_b, 'P105-BOS', 'p105bos', 'Oranı boş ürün', 'kg')
  returning id into v_id;
  select vat_rate into v_oran from public.stock_item where id = v_id;
  perform prova_bak('oran boş bırakılan ürün işletme oranını (%18) aldı', v_oran = 18);
  perform set_config('prova.urun', v_id::text, false);
end $$;

-- ── 3 · OLUMSUZ KONTROLLER ────────────────────────────────────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid;
        v_b uuid := current_setting('prova.b')::uuid;
        v_t2 uuid := current_setting('prova.t2')::uuid;
        v_b2 uuid := current_setting('prova.b2')::uuid;
        v_id uuid; v_oran numeric;
begin
  raise notice '── 3 · OLUMSUZ KONTROLLER';

  -- (a) Açıkça verilen oran EZİLMEZ.
  insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom, vat_rate)
  values (v_t, v_b, 'P105-ACIK', 'p105acik', 'Oranı yazılı ürün', 'kg', 8)
  returning id into v_id;
  select vat_rate into v_oran from public.stock_item where id = v_id;
  perform prova_bak('⚠️ açıkça yazılan %8 EZİLMEDİ', v_oran = 8);

  -- (b) Açıkça SIFIR yazıldıysa o da bir cevaptır; 18'e çevrilmemeli.
  insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom, vat_rate)
  values (v_t, v_b, 'P105-SIFIR', 'p105sifir', 'Oranı sıfır ürün', 'kg', 0)
  returning id into v_id;
  select vat_rate into v_oran from public.stock_item where id = v_id;
  perform prova_bak('⚠️ açık %0 bir CEVAPTIR, boş sayılmadı', v_oran = 0);

  -- (c) İşletme oranı BOŞSA ürünün oranı da BOŞ kalır — 0 ya da 10 değil.
  insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_t2, v_b2, 'P105-X', 'p105x', 'Ikinci kiraci urunu', 'kg')
  returning id into v_id;
  select vat_rate into v_oran from public.stock_item where id = v_id;
  perform prova_bak('⚠️ KİRACI YALITIMI: ikinci kiracı KENDİ oranını (%1) aldı', v_oran = 1);

  update public.tenant_settings set vat_rate = null where tenant_id = v_t2;
  insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_t2, v_b2, 'P105-BOSORAN', 'p105bosoran', 'Oranı belirsiz ürün', 'kg')
  returning id into v_id;
  select vat_rate into v_oran from public.stock_item where id = v_id;
  perform prova_bak('⚠️ işletme oranı BOŞSA ürün oranı da BOŞ (uydurma yok)', v_oran is null);

  -- (d) UPDATE ile BİLEREK silinen oran geri YAZILMAZ.
  update public.stock_item set vat_rate = null
   where id = current_setting('prova.urun')::uuid;
  select vat_rate into v_oran from public.stock_item
   where id = current_setting('prova.urun')::uuid;
  perform prova_bak('⚠️ UPDATE ile silinen oran GERİ YAZILMADI', v_oran is null);
end $$;

-- ── 4 · ZİNCİRİN TAMAMI · işletme → ürün → sipariş satırı ─────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid;
        v_b uuid := current_setting('prova.b')::uuid;
        v_mus uuid := current_setting('prova.mus')::uuid;
        v_urun uuid; v_sip uuid; v_rev uuid; v_oran numeric;
begin
  raise notice '── 4 · ZİNCİRİN TAMAMI';

  insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_t, v_b, 'P105-ZINCIR', 'p105zincir', 'Zincir ürünü', 'kg')
  returning id into v_urun;

  insert into public.sales_order (tenant_id, branch_id, order_no, customer_id)
  values (v_t, v_b, 'P105-SIP-1', v_mus) returning id into v_sip;

  insert into public.sales_order_revision (tenant_id, order_id, revision_no, source, reason)
  values (v_t, v_sip, 1, 'Sistem', 'prova-0105') returning id into v_rev;

  insert into public.sales_order_line
    (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
  values (v_t, v_sip, v_rev, 1, v_urun, 5, 'kg');

  select vat_rate into v_oran from public.sales_order_line
   where order_id = v_sip and line_no = 1;

  -- ⚠️ ASIL SORU BU: kullanıcı hiçbir yere oran yazmadı. İşletme ayarına
  -- yazdığı %18, iki tetikten geçerek sipariş satırına ulaştı mı?
  --      işletme ayarı →(0105)→ ürün kartı →(0052)→ sipariş satırı
  perform prova_bak('⚠️ ÜÇ HALKA: işletme %18 → ürün → sipariş satırı', v_oran = 18);
end $$;

-- ── 5 · DENETİM DEFTERİ ───────────────────────────────────────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid;
        v_kayit jsonb;
begin
  raise notice '── 5 · DENETİM DEFTERİ';
  -- Denetim tetiği AFTER'dır: satırın SON hâlini yazar, yani kopyalanmış
  -- oranı görmeli. Görmüyorsa defter, ekranda duran değerden farklı bir
  -- şey anlatıyor demektir.
  select changes into v_kayit from public.audit_log
   where tenant_id = v_t and table_name = 'stock_item' and action = 'INSERT'
     and changes -> '_kayit' ->> 'code' = 'P105-ZINCIR'
   limit 1;
  perform prova_bak('zincir ürününün denetim kaydı var', v_kayit is not null);
  perform prova_bak('⚠️ defterde oran KOPYALANMIŞ hâliyle duruyor (%18)',
    (v_kayit -> '_kayit' ->> 'vat_rate')::numeric = 18);
end $$;

rollback;
