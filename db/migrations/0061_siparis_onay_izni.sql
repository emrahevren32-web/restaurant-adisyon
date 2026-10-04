-- ═══════════════════════════════════════════════════════════════════════════
-- 0061 · SİPARİŞ ONAYLAMA AYRI BİR İZİN OLDU — `operations.approve`
-- ---------------------------------------------------------------------------
-- Emrah (03.10.2026): *"siparişi onaylayanlar da böyle olmalı."*
--
-- ⚠️ ÖNCE BİR DÜZELTME. Yetki ekranını yazarken "sade `personel` rolünde
-- `operations.write` var, yani herhangi bir personel sipariş onaylayabiliyor"
-- diye rapor edildi. BU YANLIŞTI: o satır 0001'de vardı, 0015 departman
-- rollerini kurarken `role_permission`ı o roller için SİLİP yeniden yazdı ve
-- `personel` operasyon izinlerinin İKİSİNİ DE kaybetti. Bugünün gerçeği:
--   operations.read   → admin · isletme_muduru · isletme_sahibi · super_admin · izleyici
--   operations.write  → admin · isletme_muduru · isletme_sahibi · super_admin
-- Yerel prova veritabanı bunu gösterdi. Ders: izin tablosuna 0001'den değil,
-- ÇALIŞAN veritabanından bakılır.
--
-- ── O HÂLDE BU GÖÇ NEDEN VAR ──────────────────────────────────────────────
-- `operations.write` TEK başına iki ayrı işi taşıyor:
--   · sipariş AÇMAK ve revize etmek
--   · onay zincirinde KARAR VERMEK (0053'ün SATIS adımı buna bağlıydı)
-- İkisi aynı izinde durduğu sürece "siparişi açan ile onaylayan ayrı kişi
-- olsun" KURULAMAZ: açma yetkisi verdiğiniz an onay yetkisini de vermiş
-- oluyorsunuz. Yetki ekranında da tek bir satır olarak görünüyordu —
-- bölünemeyen bir yetki.
--
--   `operations.write`   → sipariş açar, revize eder
--   `operations.approve` → onay zincirinde KARAR VERİR
--
-- ⚠️ BUGÜN DAVRANIŞ DEĞİŞMİYOR. İzni bugün taşıyan dört rolün dördü de
-- yeni izni alıyor; kimse bir yetki kazanmıyor ya da kaybetmiyor. Değişen
-- şey, onaylamanın ayrı bir ad taşıması: artık "açsın ama onaylamasın"
-- denebilir bir rol tanımlanabilir ve ekran bunu gösterebilir.
--
-- ⚠️ ONAY KARARI SQL'DE DENETLENMİYOR. `order_approval` tetikleyicileri
-- kiracı tutarlılığına ve adımın tanımlı olmasına bakıyor; izne BAKMIYOR.
-- Yani bu bölme ARAYÜZ kapısını netleştirir, veritabanı kapısını açmaz.
-- Açıkça yazıyoruz ki "izni ayırdık, artık güvende" sanılmasın.
-- ═══════════════════════════════════════════════════════════════════════════

insert into permission (code, module_code, description) values
  ('operations.approve', 'business-workspace',
   'Sipariş onay zincirinde karar verme izni (onay/görüş).')
on conflict (code) do nothing;

-- ⚠️ KİMSE YETKİ KAYBETMİYOR: bugün `operations.write` taşıyan her rol yeni
-- izni de alıyor. Elle liste yazmak yerine var olan haktan türetiyoruz —
-- elle yazılan liste, araya yeni bir rol girdiğinde sessizce eksik kalır.
insert into role_permission (role_code, permission_code)
select rp.role_code, 'operations.approve'
  from role_permission rp
 where rp.permission_code = 'operations.write'
on conflict do nothing;

-- ── VAR OLAN ZİNCİRLER ────────────────────────────────────────────────────
-- ⚠️ Bu satır olmadan göç hiçbir işe yaramaz: kurulu kiracıların SATIS adımı
-- hâlâ `operations.write`e bakar ve iki iz tekrar tek izne döner. Yeni izni
-- tanımlayıp zinciri bağlamamak, en sessiz türden yarım iştir.
update order_approval_step
   set permission_code = 'operations.approve'
 where permission_code = 'operations.write';

-- ── YENİ KİRACILAR ────────────────────────────────────────────────────────
-- 0053'ün kurucu fonksiyonu `operations.write` yazıyordu; bundan sonra
-- kurulacak her işletmenin zinciri de yeni izinle kurulsun.
create or replace function app.onay_zincirini_kur(p_tenant uuid)
returns integer
language plpgsql
as $$
declare
  v_sayac int := 0;
begin
  insert into public.order_approval_step
    (tenant_id, code, name, sort_order, required, permission_code)
  values
    (p_tenant, 'DEPO',   'Depo — hammadde yeterli mi',  1, false, 'stock.read'),
    (p_tenant, 'URETIM', 'Üretim — yoğunluk ve tarih',  2, false, 'production.read'),
    (p_tenant, 'SATIS',  'Satış sorumlusu — onay',      3, true,  'operations.approve')
  on conflict (tenant_id, code) do nothing;
  get diagnostics v_sayac = row_count;
  return v_sayac;
end;
$$;

comment on function app.onay_zincirini_kur(uuid) is
  'Bir kiracıya varsayılan onay zincirini kurar: depo ve üretim GÖRÜŞ, satış '
  'ONAY (operations.approve). Var olan adımlara dokunmaz.';

-- ── Doğrulama ────────────────────────────────────────────────────────────
do $$
declare
  v_kalan integer;
  v_fark  text;
begin
  if not exists (select 1 from permission where code = 'operations.approve') then
    raise exception '0061: operations.approve izni eklenemedi.';
  end if;

  -- Kimse yetki KAYBETMEDİ mi? `operations.write` taşıyan her rol yeni izni
  -- de taşımalı; taşımıyorsa bu göç birini sessizce onay dışına itmiştir.
  select string_agg(rp.role_code, ', ') into v_fark
    from role_permission rp
   where rp.permission_code = 'operations.write'
     and not exists (
       select 1 from role_permission x
        where x.role_code = rp.role_code
          and x.permission_code = 'operations.approve');

  if v_fark is not null then
    raise exception '0061: şu roller sipariş açabiliyor ama onay izni almadı: %', v_fark;
  end if;

  -- Kimse yetki KAZANMADI mı? Yeni izin, eski izni olmayan bir role
  -- düşmüşse bu göç sessizce birini onaylayıcı yapmıştır.
  select string_agg(rp.role_code, ', ') into v_fark
    from role_permission rp
   where rp.permission_code = 'operations.approve'
     and not exists (
       select 1 from role_permission x
        where x.role_code = rp.role_code
          and x.permission_code = 'operations.write');

  if v_fark is not null then
    raise exception '0061: şu roller onay izni kazandı ama sipariş açamıyor: %', v_fark;
  end if;

  -- Hiçbir zincir eski izinde kalmadı mı?
  select count(*) into v_kalan
    from order_approval_step where permission_code = 'operations.write';

  if v_kalan > 0 then
    raise exception '0061: % onay adımı hâlâ operations.write''e bağlı.', v_kalan;
  end if;

  raise notice '0061 TAMAM · onaylamak ayrı bir izin oldu; bugün kimse yetki kaybetmedi';
end;
$$;
