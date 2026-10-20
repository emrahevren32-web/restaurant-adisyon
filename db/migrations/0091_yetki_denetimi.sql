-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0091 · "BUNU KİM YAPTI?" · YETKİ TABLOLARI DENETİME GİRİYOR
--
-- Profilim ekranını gerçek veriye bağlarken `app_user` tablosunun denetim
-- tetiğine baktım ve **yoktu.** Sonra kalanlara baktım:
--
--   app_user            → DENETİM YOK   (role_code, is_active burada!)
--   user_role           → DENETİM YOK
--   user_branch_access  → DENETİM YOK
--   company             → DENETİM YOK
--   branch              → DENETİM YOK
--
-- Yani bugün şu soruların HİÇBİRİNİN cevabı yok:
--   · "Bu kişiyi kim admin yaptı?"
--   · "Bu kullanıcıya bu şubeyi kim açtı?"
--   · "Bu hesabı kim pasife aldı?"
--   · "Firmanın vergi numarasını kim değiştirdi?"
--
-- ⚠️ Oysa denetim sistemi 20'den fazla tabloda ÇALIŞIYOR (0027). Stok
-- hareketi, sevkiyat, HACCP ölçümü, müşteri kartı — hepsi kayıtlı. Yetki
-- tabloları eksik kalmış. Haftalardır tam olarak yetkiyi sertleştiriyoruz
-- ve "kim yaptı" sorusu yetkide cevapsız.
--
-- Emrah'ın kendi cümlesi (`claude/endustriyel-mutfak-kapsam.md`):
--   *"Pratikte müdür 'erişebilir mi' diye sormaz, BUNU KİM YAPTI diye
--    sorar."*
--
-- ── NEDEN YALNIZ BEŞ TABLO ───────────────────────────────────────────────
-- `tenant` ve `role_permission` tablolarında `tenant_id` kolonu YOK.
-- `app.denetim_yaz()` kiracısı olmayan satır için sessizce hiçbir şey
-- yazmıyor (0027'nin bilinçli kararı). O ikisine tetik takmak, çalışıyor
-- görünüp hiçbir şey yazmayan bir kapı olurdu — tam da kaçındığımız şey.
-- Onlar ayrı bir iş; HEDEFLER'e madde olarak yazıldı.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · BEŞ TABLO DENETİME GİRİYOR ────────────────────────────────────────
do $$
declare
  v_tablolar constant text[] := array[
    'app_user', 'user_role', 'user_branch_access', 'company', 'branch'
  ];
  v_tablo text;
  v_ad    text;
  v_say   int := 0;
begin
  foreach v_tablo in array v_tablolar loop
    if to_regclass('public.' || quote_ident(v_tablo)) is null then
      raise exception '0091: `%` tablosu yok.', v_tablo;
    end if;

    -- Kiracısı olmayan tabloya tetik takmıyoruz: yazamayacağı için
    -- "denetleniyor" görünüp hiçbir şey yazmazdı.
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = v_tablo
         and column_name = 'tenant_id'
    ) then
      raise exception '0091: `%` tablosunda tenant_id yok; denetim yazamaz.', v_tablo;
    end if;

    v_ad := 'denetim_' || v_tablo;
    execute format('drop trigger if exists %I on public.%I', v_ad, v_tablo);
    execute format(
      'create trigger %I after insert or update or delete on public.%I '
      'for each row execute function app.denetim_yaz()', v_ad, v_tablo);
    v_say := v_say + 1;
  end loop;

  if v_say <> 5 then
    raise exception '0091: 5 tetik bekleniyordu, % kuruldu.', v_say;
  end if;
  raise notice '0091: % yetki tablosu denetime girdi.', v_say;
end $$;


-- ── 2 · DOĞRULAMA ─────────────────────────────────────────────────────────
-- ⚠️ Tetik SAYMIYORUZ, DENETİMSİZ YÜZEY ÖLÇÜYORUZ (tuzak 90).
do $$
declare
  v_eksik text[];
  v_say   int;
begin
  -- Kiracısı olan, `authenticated` rolüne açık, ama denetimsiz tablo
  -- KALMAMALI — bu göçün asıl iddiası bu.
  select coalesce(array_agg(x order by x), '{}') into v_eksik from (
    select c.relname as x
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = c.relname
                      and column_name = 'tenant_id')
       and has_table_privilege('authenticated', c.oid, 'SELECT')
       and not exists (
         select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
          where t.tgrelid = c.oid and not t.tgisinternal
            and p.proname = 'denetim_yaz')
  ) s;

  if array_length(v_eksik, 1) is not null then
    raise notice
      '0091: denetimsiz kalan kiracili tablolar: %. Her biri ya denetime '
      'alinmali ya da GEREKCESIYLE listelenmeli.', array_to_string(v_eksik, ', ');
  end if;

  -- Beş tetik gerçekten yerinde mi
  select count(*) into v_say
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_proc p on p.oid = t.tgfoid
   where not t.tgisinternal and p.proname = 'denetim_yaz'
     and c.relname in ('app_user','user_role','user_branch_access','company','branch');
  if v_say <> 5 then
    raise exception '0091: bes yetki tetiginden % tanesi yerinde.', v_say;
  end if;

  -- Denetim defteri HÂLÂ değişmez olmalı (0027'nin kuralı bozulmasın)
  if not exists (
    select 1 from pg_trigger t where t.tgname = 'audit_log_degismez'
      and not t.tgisinternal
  ) then
    raise exception '0091: denetim defterinin degismezlik tetigi kayboldu.';
  end if;

  raise notice '0091 tamam: app_user, user_role, user_branch_access, company '
    've branch artik "bunu kim yapti" sorusunu cevapliyor.';
end $$;
