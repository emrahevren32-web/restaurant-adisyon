-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0044 · Ücretli / ücretsiz ayrımı ve lisans geçmişi
--
-- Emrah'ın sorusu: "Bir firmaya kaç defa ücretsiz/ücretli lisans verdiğimi
-- nerede göreceğim? Hangi tarihlerde ücretliymiş, ne kadar ücretsiz
-- kullanmış?"
--
-- Defter (0043) uzatmaları tutuyordu ama ÜCRETLİ Mİ diye sormuyordu. O bilgi
-- sonradan hatırlanamaz: "galiba o ay bedava vermiştik" diye bir muhasebe
-- olmaz. Bu yüzden ücret bilgisi UZATMA ANINDA, deftere yazılıyor.
--
-- ⚠️ Fiyat (tutar) BU GÖÇTE YOK. Fiyat modeli henüz kararlaştırılmadı
-- (yol haritası · karar bekleyen üç konu). Tutarı şimdi uydurmak yerine
-- yalnızca "ücretli mi" ayrımını tutuyoruz; tutar fiyat kararından sonra
-- eklenir ve defter zaten append-only olduğu için geçmiş bozulmaz.
-- ═══════════════════════════════════════════════════════════════════════════

alter table license_event add column if not exists paid boolean;

comment on column license_event.paid is
  'Bu uzatma ücretli miydi? NULL = uzatma dışı olay (açılış, talep, karar). '
  'false = ücretsiz (deneme uzatması), true = ücretli.';

-- ── Uzatma: ücretli/ücretsiz ayrımıyla ───────────────────────────────────
create or replace function app.lisansi_uzat(
  p_tenant uuid, p_yeni_bitis date default null,
  p_ay integer default null, p_not text default null,
  p_ucretli boolean default false
)
returns tenant_license
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_lisans tenant_license%rowtype;
  v_eski   date;
  v_bitis  date;
begin
  select * into v_lisans from tenant_license
   where tenant_id = p_tenant and status in ('Deneme','Aktif') limit 1;
  if not found then
    select * into v_lisans from tenant_license
     where tenant_id = p_tenant order by end_date desc limit 1;
    if not found then
      raise exception 'Bu kiracının lisansı yok.' using errcode = 'MI404';
    end if;
  end if;

  v_eski := v_lisans.end_date;

  if p_yeni_bitis is not null then
    v_bitis := p_yeni_bitis;
  elsif p_ay is not null then
    v_bitis := greatest(v_lisans.end_date, current_date) + make_interval(months => p_ay);
  else
    raise exception 'Uzatma için ya yeni bitiş tarihi ya da ay sayısı gerekir.'
      using errcode = 'MI400';
  end if;

  if v_bitis <= current_date then
    raise exception 'Yeni bitiş tarihi bugünden ileride olmalı.' using errcode = 'MI400';
  end if;

  -- ⚠️ ÜCRETSİZ uzatma lisansı "Aktif"e ÇEVİRMEZ; deneme olarak kalır.
  -- Önceki sürüm her uzatmada `is_trial = false` yazıyordu: ücretsiz verilen
  -- süre kayıtta ücretli müşteri gibi görünüyordu. Ücret bilgisi ile durum
  -- birbirini tutmak zorunda.
  update tenant_license
     set end_date = v_bitis,
         status   = case when p_ucretli then 'Aktif' else v_lisans.status end,
         is_trial = case when p_ucretli then false else v_lisans.is_trial end,
         note     = coalesce(p_not, note),
         updated_at = now()
   where id = v_lisans.id
   returning * into v_lisans;

  insert into license_event (tenant_id, license_id, kind, old_end, new_end,
                             added_days, paid, actor_id, actor_name, note)
  select p_tenant, v_lisans.id, 'UZATILDI', v_eski, v_bitis,
         (v_bitis - v_eski), coalesce(p_ucretli, false),
         a.user_id, a.ad, p_not
    from app.denetim_aktoru() a;

  return v_lisans;
end $$;

-- Eski imza (5 parametresiz) kaldırılıyor: iki imza kalırsa çağıran hangi
-- davranışı aldığını bilemez.
drop function if exists app.lisansi_uzat(uuid, date, integer, text);

create or replace function public.lisansi_uzat(
  p_tenant uuid, p_yeni_bitis date default null,
  p_ay integer default null, p_not text default null,
  p_ucretli boolean default false
)
returns tenant_license
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if not app.yetkim_var('platform.manage') then
    raise exception 'Lisans uzatma yetkiniz yok.' using errcode = 'MI403';
  end if;
  return app.lisansi_uzat(p_tenant, p_yeni_bitis, p_ay, p_not, p_ucretli);
end $$;

drop function if exists public.lisansi_uzat(uuid, date, integer, text);
revoke all on function public.lisansi_uzat(uuid, date, integer, text, boolean) from public, anon;
grant execute on function public.lisansi_uzat(uuid, date, integer, text, boolean)
  to authenticated, service_role;

-- ── Talep kararı da ücret bilgisi taşıyor ────────────────────────────────
create or replace function public.sure_talebini_karara_bagla(
  p_talep uuid, p_onay boolean, p_ay integer default 1,
  p_not text default null, p_ucretli boolean default false
)
returns license_extension_request
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_talep license_extension_request%rowtype;
  v_user  uuid;
begin
  if not app.yetkim_var('platform.manage') then
    raise exception 'Süre talebini karara bağlama yetkiniz yok.' using errcode = 'MI403';
  end if;

  select * into v_talep from license_extension_request where id = p_talep;
  if not found then raise exception 'Talep bulunamadı.' using errcode = 'MI404'; end if;
  if v_talep.status <> 'Bekliyor' then
    raise exception 'Bu talep zaten karara bağlanmış (%).', v_talep.status
      using errcode = 'MI409';
  end if;

  select user_id into v_user from app.denetim_aktoru();

  update license_extension_request
     set status = case when p_onay then 'Onaylandı' else 'Reddedildi' end,
         decided_by = v_user, decided_at = now(), decision_note = p_not
   where id = p_talep
   returning * into v_talep;

  if p_onay then
    perform app.lisansi_uzat(v_talep.tenant_id, null, coalesce(p_ay, 1),
                             coalesce(p_not, 'Süre talebi onaylandı'), p_ucretli);
    perform app.lisans_olayi_yaz(v_talep.tenant_id, null, 'TALEP_ONAYLANDI',
                                 null, null, p_not);
  else
    perform app.lisans_olayi_yaz(v_talep.tenant_id, null, 'TALEP_REDDEDILDI',
                                 null, null, p_not);
  end if;

  return v_talep;
end $$;

drop function if exists public.sure_talebini_karara_bagla(uuid, boolean, integer, text);
revoke all on function public.sure_talebini_karara_bagla(uuid, boolean, integer, text, boolean)
  from public, anon;
grant execute on function public.sure_talebini_karara_bagla(uuid, boolean, integer, text, boolean)
  to authenticated, service_role;

-- ── Geçmiş açılışı da ücretsiz sayılır ───────────────────────────────────
-- İlk 30 gün deneme, yani ücretsiz. Eski satırlarda `paid` boş kalmasın.
update license_event set paid = false
 where kind = 'UZATILDI' and paid is null;

-- ── Özet: ücretsiz ve ücretli gün ayrı ayrı ──────────────────────────────
-- ⚠️ `create or replace` DÖNÜŞ TİPİNİ değiştiremez ("cannot change return
-- type of existing function"). Yeni kolon eklediğimiz için önce düşürülüyor.
drop function if exists public.lisans_ozeti();

create or replace function public.lisans_ozeti()
returns table (
  tenant_id uuid, kiraci_kodu text, isletme text, paket text,
  durum text, baslangic date, bitis date, kalan_gun integer,
  uzatma_sayisi integer, toplam_gun integer, bekleyen_talep boolean,
  ucretsiz_gun integer, ucretli_gun integer,
  ucretsiz_uzatma integer, ucretli_uzatma integer
)
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if not app.yetkim_var('platform.manage') then
    raise exception 'Lisans listesini görme yetkiniz yok.' using errcode = 'MI403';
  end if;

  return query
  select t.id, t.code, coalesce(c.company_name, t.name), p.name,
         l.status, l.start_date, l.end_date,
         (l.end_date - current_date)::int,
         (select count(*)::int from license_event e
           where e.tenant_id = t.id and e.kind = 'UZATILDI'),
         (l.end_date - l.start_date)::int,
         exists (select 1 from license_extension_request r
                  where r.tenant_id = t.id and r.status = 'Bekliyor'),
         -- Ücretsiz gün: ilk deneme süresi + ücretsiz uzatmalar.
         (coalesce((select sum(e.added_days)::int from license_event e
                     where e.tenant_id = t.id and e.kind = 'UZATILDI'
                       and e.paid is not true), 0)
          + coalesce((select sum(e.new_end - e.old_end)::int from license_event e
                       where e.tenant_id = t.id and e.kind = 'ACILDI'), 0)),
         coalesce((select sum(e.added_days)::int from license_event e
                    where e.tenant_id = t.id and e.kind = 'UZATILDI'
                      and e.paid), 0),
         (select count(*)::int from license_event e
           where e.tenant_id = t.id and e.kind = 'UZATILDI' and e.paid is not true),
         (select count(*)::int from license_event e
           where e.tenant_id = t.id and e.kind = 'UZATILDI' and e.paid)
    from tenant t
    join tenant_license l on l.tenant_id = t.id and l.status in ('Deneme','Aktif')
    left join company c on c.tenant_id = t.id
    join license_package p on p.id = l.package_id
   where not t.is_platform
   order by l.end_date;
end $$;

revoke all on function public.lisans_ozeti() from public, anon;
grant execute on function public.lisans_ozeti() to authenticated, service_role;

-- ── Tek firmanın lisans geçmişi (defterin kendisi) ───────────────────────
create or replace function public.lisans_gecmisi(p_tenant uuid)
returns table (
  zaman timestamptz, olay text, eski_bitis date, yeni_bitis date,
  gun integer, ucretli boolean, kim text, aciklama text
)
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if not app.yetkim_var('platform.manage') then
    raise exception 'Lisans geçmişini görme yetkiniz yok.' using errcode = 'MI403';
  end if;

  return query
  select e.created_at, e.kind, e.old_end, e.new_end,
         e.added_days, e.paid, coalesce(e.actor_name, '—'), e.note
    from license_event e
   where e.tenant_id = p_tenant
   order by e.created_at desc;
end $$;

revoke all on function public.lisans_gecmisi(uuid) from public, anon;
grant execute on function public.lisans_gecmisi(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

-- ── DOĞRULAMA ────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid; v_bitis1 date; v_bitis2 date;
  v_ucretsiz int; v_ucretli int; v_durum text; v_deneme boolean;
begin
  select tenant_id into v_t from tenant_license
   where status in ('Deneme','Aktif') limit 1;

  if v_t is null then
    raise notice '0044 TAMAM (sınanacak lisans yok)';
    return;
  end if;

  -- 1) Ücretsiz uzatma denemeyi BOZMAMALI
  select end_date into v_bitis1 from app.lisansi_uzat(v_t, null, 1, '0044 ücretsiz', false);
  select status, is_trial into v_durum, v_deneme from tenant_license
   where tenant_id = v_t and status in ('Deneme','Aktif');
  if v_durum <> 'Deneme' or not v_deneme then
    raise exception '0044: ücretsiz uzatma lisansı ücretliye çevirdi (% / %).', v_durum, v_deneme;
  end if;

  -- 2) Ücretli uzatma Aktif'e çekmeli
  select end_date into v_bitis2 from app.lisansi_uzat(v_t, null, 1, '0044 ücretli', true);
  select status, is_trial into v_durum, v_deneme from tenant_license
   where tenant_id = v_t and status in ('Deneme','Aktif');
  if v_durum <> 'Aktif' or v_deneme then
    raise exception '0044: ücretli uzatma Aktif yapmadı (% / %).', v_durum, v_deneme;
  end if;

  -- 3) Defter ikisini AYIRT etmeli
  select count(*) into v_ucretsiz from license_event
   where tenant_id = v_t and kind = 'UZATILDI' and paid is not true;
  select count(*) into v_ucretli from license_event
   where tenant_id = v_t and kind = 'UZATILDI' and paid;
  if v_ucretsiz < 1 or v_ucretli < 1 then
    raise exception '0044: defter ücretli/ücretsiz ayrımını tutmuyor (% / %).',
      v_ucretsiz, v_ucretli;
  end if;

  raise notice '0044 TAMAM · ücretsiz uzatma % · ücretli uzatma % · defter ayırt ediyor',
    v_ucretsiz, v_ucretli;
end $$;
