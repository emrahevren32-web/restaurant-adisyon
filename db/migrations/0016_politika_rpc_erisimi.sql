-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Aşama 1 — Politika RPC'si dışarı açılıyor
-- 0016 — app.set_negative_stock_policy → public.set_negative_stock_policy
--
-- ⚠️ NEDEN BU MIGRATION VAR (2026-08-27, G7 hazırlığında fark edildi):
--
--   `0012` negatif stok politikasını değiştirmeyi yetki kontrollü bir RPC'nin
--   arkasına aldı — doğru karardı. Ama fonksiyonu `app` şemasına koydu.
--
--   Supabase'in REST katmanı (PostgREST) YALNIZCA `public` şemasındaki
--   fonksiyonları yayınlar. Yani `app.set_negative_stock_policy` tarayıcıdan
--   ÇAĞRILAMIYOR. Sonuç: `0012` yazma yolunu kapattı ama yerine koyduğu kapıyı
--   ulaşılamaz bıraktı — politika bugün yalnızca SQL Editor'den değiştirilebilir
--   durumda. Uygulamanın hiçbir ekranı bunu yapamaz.
--
--   `0015`'teki `assign_user_roles` doğru şekilde `public`'e konmuştu; bu
--   tutarsızlık gözden kaçmış.
--
-- Bu migration aynı fonksiyonu aynı yetki kurallarıyla `public`'e taşır.
-- `app` şemasındaki eski hâli KALIYOR (SQL Editor'den çağıranlar kırılmasın),
-- ama artık gövdeyi tekrarlamıyor — public sürümü çağırıyor.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.set_negative_stock_policy(p_policy text)
returns text
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  if p_policy is null or p_policy not in ('allow', 'warn', 'block') then
    raise exception 'Geçersiz negatif stok politikası: %. allow, warn veya block olmalı.', p_policy
      using errcode = 'MI400';
  end if;

  -- Hedef tenant çağıranın oturumundan türetilir, parametre olarak ALINMAZ —
  -- başka bir işletmenin politikasına dokunulamaz (0012'deki aynı kural).
  select u.tenant_id
    into v_tenant_id
  from public.app_user u
  join public.tenant   t on t.id = u.tenant_id
  where u.auth_user_id = auth.uid()
    and u.is_active
    and t.status    = 'Aktif'
    and u.role_code in ('super_admin', 'admin', 'isletme_sahibi');

  if v_tenant_id is null then
    raise exception 'Bu işlem için aktif tenant''ta yönetici yetkisi gerekir.'
      using errcode = 'MI403';
  end if;

  update public.tenant
     set negative_stock_policy = p_policy,
         updated_at            = now()
   where id = v_tenant_id;

  return p_policy;
end $$;

comment on function public.set_negative_stock_policy(text) is
  'ADR-001 I12 — tenant negatif stok politikasını değiştirir. Yalnızca aktif tenant''ın '
  'super_admin / admin / isletme_sahibi kullanıcısı çağırabilir. Hedef tenant çağıranın '
  'oturumundan türetilir. PostgREST yalnızca public şemasını yayınladığı için burada '
  '(0012''deki app sürümü SQL Editor için kaldı). Bkz. docs/yetki-cercevesi.md';

revoke execute on function public.set_negative_stock_policy(text) from public, anon;
grant  execute on function public.set_negative_stock_policy(text) to authenticated;

-- `app` şemasındaki eski sürüm artık gövdeyi tekrarlamıyor, public'i çağırıyor.
-- Tek bir yetki kuralı, tek bir yerde: ikisi ayrışamaz.
create or replace function app.set_negative_stock_policy(p_policy text)
returns text
language sql
security definer
set search_path = public, app, pg_temp
as $$
  select public.set_negative_stock_policy(p_policy)
$$;

comment on function app.set_negative_stock_policy(text) is
  'Geriye dönük uyumluluk kabuğu — gerçek gövde public.set_negative_stock_policy içindedir (0016).';

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- İki fonksiyon da görünmeli; `public` olan `authenticated` tarafından
-- çağrılabilir olmalı.
select
  n.nspname                                              as sema,
  p.proname                                              as fonksiyon,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_cagirabilir
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('set_negative_stock_policy', 'assign_user_roles')
order by p.proname, n.nspname;
