-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0087 · SİPARİŞ ONAYI BAŞKASI ADINA VERİLEMEZ (Codex MIYOP-002)
--
-- ── NE BULUNDU ───────────────────────────────────────────────────────────
-- `0053:387-388` şunu veriyor:
--   grant select, insert, update on order_approval_step to authenticated;
--   grant select, insert         on order_approval      to authenticated;
--
-- Var olan tetik `app.onay_kullanicisi_tutarli()` yalnız şunu doğruluyor:
-- `decided_by` AYNI KİRACIYA ait mi. Üç şeyi doğrulamıyor:
--
--   1. ÇAĞIRANIN `decided_by` olduğunu. Yani personel, müdürün kimliğini
--      yazarak onay satırı ekleyebiliyor. Defterde müdür onaylamış görünür.
--   2. Çağıranın O ADIMIN iznini taşıdığını. `order_approval_step` her
--      adımın `permission_code`unu zaten tutuyor — kimse sormuyordu.
--   3. `decided_at`i istemcinin gönderdiğini. Geçmişe tarihli onay yazılabilir.
--
-- Ayrıca `order_approval_step` üzerinde UPDATE hakkı var: zorunlu bir onay
-- adımı `required = false` yapılıp ETKİSİZLEŞTİRİLEBİLİYOR.
--
-- ── ÇÖZÜM ────────────────────────────────────────────────────────────────
-- 0081'in `completed_by` deseni: **imzayı sunucu atar, istemci gönderemez.**
-- Sahte gönderirse üstüne yazılır — hata bile verilmez, çünkü istemcinin ne
-- gönderdiği önemli değil.
--
-- Adımın izni `order_approval_step.permission_code`dan OKUNUYOR, burada
-- sabit yazılmıyor: işletme zincirini değiştirirse kapı da değişsin.
--
-- ⚠️ Olmayan bir adım koduna onay yazılamaz. Eskiden `step_code` serbest
-- metindi; uydurma bir kod yazan biri hiçbir izne takılmadan satır
-- ekleyebilirdi.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · ONAY KARARI · İMZAYI SUNUCU ATAR ──────────────────────────────────
create or replace function app.onay_karari_izni()
returns trigger
language plpgsql
set search_path = public, app
as $$
declare
  v_ben   uuid;
  v_adim  record;
begin
  if app.bakim_baglami() then
    return new;
  end if;

  v_ben := app.aktif_kullanici_id();
  if v_ben is null then
    raise exception 'Onay icin oturum gerekiyor.' using errcode = 'MI403';
  end if;

  -- Adım gerçekten var mı ve HANGİ izni istiyor?
  select s.code, s.name, s.permission_code, s.is_active
    into v_adim
    from public.order_approval_step s
   where s.tenant_id = new.tenant_id
     and s.code      = new.step_code;

  if v_adim is null then
    raise exception
      'Onay zincirinde `%` adimi yok. Uydurma adim koduyla onay yazilamaz.',
      new.step_code
      using errcode = 'MI422';
  end if;

  if not v_adim.is_active then
    raise exception 'Onay adimi `%` kapali; karar yazilamaz.', v_adim.name
      using errcode = 'MI422';
  end if;

  if not app.yetkim_var(v_adim.permission_code) then
    raise exception
      '`%` adiminda karar vermek icin `%` izni gerekiyor; hesabinizda yok.',
      v_adim.name, v_adim.permission_code
      using errcode = 'MI403';
  end if;

  -- ⚠️ İMZAYI SUNUCU ATAR. İstemci ne gönderirse göndersin üstüne yazılır.
  -- Hata vermiyoruz: istemcinin ne gönderdiği önemli değil, kim olduğu önemli.
  new.decided_by := v_ben;
  new.decided_at := now();

  return new;
end $$;

comment on function app.onay_karari_izni() is
  'Siparis onayinin kapisi. Adimi `order_approval_step`ten okur, o adimin '
  'iznini sorar, imzayi (decided_by, decided_at) SUNUCU atar. Istemcinin '
  'gonderdigi kimlik ve tarih yok sayilir (0087).';

drop trigger if exists izin_order_approval on public.order_approval;
create trigger izin_order_approval
  before insert on public.order_approval
  for each row execute function app.onay_karari_izni();


-- ── 2 · ZİNCİRİN AYARI YÖNETİM İŞİDİR ─────────────────────────────────────
-- Zorunlu bir adımı `required = false` yapmak, onay zincirini kaldırmaktır.
-- Bu karar operasyon değil YÖNETİM kararı: `settings.manage`.
-- (admin, isletme_sahibi, super_admin)
drop trigger if exists izin_order_approval_step on public.order_approval_step;
create trigger izin_order_approval_step
  before insert or update on public.order_approval_step
  for each row execute function app.izin_gerek('settings.manage');


-- ⚠️ TUZAK 67
revoke all on function app.onay_karari_izni() from public;
revoke all on function app.onay_karari_izni() from anon;


-- ── 3 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare v_t text; v_ad text;
begin
  foreach v_t in array array['izin_order_approval','izin_order_approval_step'] loop
    if not exists (select 1 from pg_trigger t where t.tgname = v_t and not t.tgisinternal) then
      raise exception '0087: % tetigi olusmadi.', v_t;
    end if;
  end loop;

  -- Var olan "degismez" tetigi YERINDE kalmali: onay defteri append-only.
  if not exists (
    select 1 from pg_trigger t where t.tgname = 'order_approval_degismez' and not t.tgisinternal
  ) then
    raise exception '0087: order_approval_degismez tetigi kayboldu.';
  end if;

  -- Zincirdeki her adimin izni KATALOGDA olmali; yoksa kapi hic acilmaz.
  if exists (
    select 1 from order_approval_step s
     left join permission p on p.code = s.permission_code
     where p.code is null
  ) then
    raise exception '0087: onay zincirinde katalogda olmayan izin kodu var.';
  end if;

  -- PUBLIC kapisi (tuzak 67 + 80)
  v_ad := 'app.onay_karari_izni()';
  if exists (
    select 1 from pg_proc p,
      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
     where p.oid = to_regprocedure(v_ad)
       and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception '0087: % uzerinde PUBLIC EXECUTE acik.', v_ad;
  end if;

  raise notice '0087 tamam: onay imzasini sunucu atiyor, adim izni soruluyor.';
end $$;
