-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Dilim 0 / G3.8 — Geri alma (down) betiği
--
-- BU DOSYAYI ÜRETİM PROJESİNDE ÇALIŞTIRMA. Bu, 0001-0008 migration'larının
-- oluşturduğu HER ŞEYİ (tablolar, görünümler, fonksiyonlar, politikalar,
-- veriler) siler. Amacı yalnızca "geri alınabilirlik" iddiasını bir kez,
-- ayrı/boş bir Supabase projesinde kanıtlamaktır.
--
-- Kapsam dışı: 0006 ve 0007. Onlar GRANT/REVOKE sertleştirmesidir (bkz.
-- ADR-004) ve tekrar çalıştırılabilir/idempotenttir. 0007'nin tersini almak
-- "anon rolüne müşteri verisini yeniden aç" demek olurdu — bu asla test
-- edilmemeli, edilmeyecek. Aşağıdaki tablolar zaten silinince o GRANT'ler de
-- kendiliğinden anlamsızlaşır (PostgreSQL bir tablo silinince üzerindeki
-- tüm GRANT'leri de siler).
--
-- Sıra, 0008'den 0001'e doğru, bağımlılıkların TERSİ yönünde.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ 0008 geri alma — ilk yönetici verisi ════════════════════════════════════
do $$
declare
  v_tenant uuid;
begin
  select id into v_tenant from tenant where code = 'MIYOP';
  if v_tenant is null then
    return;
  end if;

  delete from user_branch_access where tenant_id = v_tenant;
  delete from app_user           where tenant_id = v_tenant;
  update company set default_branch_id = null where tenant_id = v_tenant;
  delete from branch             where tenant_id = v_tenant;
  delete from company            where tenant_id = v_tenant;
  delete from tenant             where id = v_tenant;
end $$;


-- ═══ 0005 geri alma — referans tablosu okuma politikaları ════════════════════
do $$
declare
  v_tablo text;
begin
  foreach v_tablo in array array['permission','role','role_permission','uom','uom_conversion']
  loop
    execute format('drop policy if exists %I on %I', v_tablo || '_read_all', v_tablo);
  end loop;
end $$;


-- ═══ 0004 geri alma — doğrulama yardımcı fonksiyonu ══════════════════════════
-- (Betiğin kendisi zaten veri bırakmaz; burada yalnızca kalıcı fonksiyonu siliyoruz.)
drop function if exists app.dogrulama_temizlik();
drop table if exists _dogrulama;


-- ═══ 0003 geri alma — stok hareket defteri ═══════════════════════════════════
drop policy if exists lot_genealogy_tenant_isolation on lot_genealogy;
drop table  if exists lot_genealogy;

drop view if exists stock_lot_balance;
drop view if exists stock_balance;

drop trigger if exists stock_movement_lot_guard  on stock_movement;
drop trigger if exists stock_movement_no_update  on stock_movement;
drop trigger if exists stock_movement_no_delete  on stock_movement;
drop policy  if exists stock_movement_tenant_isolation on stock_movement;
drop table   if exists stock_movement;

drop function if exists app.stock_movement_requires_lot();
drop function if exists app.stock_movement_is_immutable();

drop policy if exists stock_lot_tenant_isolation on stock_lot;
drop table  if exists stock_lot;

drop policy if exists stock_item_tenant_isolation on stock_item;
drop table  if exists stock_item;


-- ═══ 0002 geri alma — ölçü birimleri ══════════════════════════════════════════
drop function if exists app.convert_uom(numeric, text, text);
drop table if exists uom_conversion;
drop table if exists uom;


-- ═══ 0001 geri alma — kimlik, firma, şube, rol, izin ═════════════════════════
drop policy if exists user_branch_access_tenant_isolation on user_branch_access;
drop table  if exists user_branch_access;

drop table if exists role_permission;
drop table if exists role;
drop table if exists permission;

drop policy if exists app_user_tenant_isolation on app_user;
drop table  if exists app_user;

-- company ve branch birbirine referans veriyor (company.default_branch_id ↔
-- branch.company_id). Döngüyü kırmadan hiçbiri silinemez.
alter table if exists company drop constraint if exists company_default_branch_fk;

drop policy if exists branch_tenant_isolation on branch;
drop table  if exists branch;

drop policy if exists company_tenant_isolation on company;
drop table  if exists company;

drop policy if exists tenant_self_isolation on tenant;
drop table  if exists tenant;

drop function if exists app.current_tenant_id();
drop schema if exists app;


-- ── Doğrulama ──────────────────────────────────────────────────────────────
-- Beklenen: 0 satır. Bir satır bile görünüyorsa bir şey silinmemiş demektir.
select c.relname as kalan_nesne, c.relkind as tur
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','app')
  and c.relkind in ('r','v')
  and c.relname in (
    'tenant','company','branch','app_user','user_branch_access',
    'permission','role','role_permission',
    'uom','uom_conversion',
    'stock_item','stock_lot','stock_movement','lot_genealogy',
    'stock_balance','stock_lot_balance','_dogrulama'
  )
order by c.relname;
