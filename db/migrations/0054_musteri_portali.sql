-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0054 — MÜŞTERİ SİPARİŞ PORTALI (A4C3 · temel)
-- ═══════════════════════════════════════════════════════════════════════════
-- Emrah'ın modeli: "Benim firmam ABC Gıda ve bir web sitem var. MİYOP bana
-- bir form linki verecek, ben o linki kendi siteme ekleyeceğim. Müşterimin
-- müşterileri oradan sipariş verecek."
--
-- Verilen kararlar:
--   · Fiyat GÖSTERİLMEYECEK.
--   · Sipariş 0053'teki onay zincirinden geçecek.
--   · Giriş e-posta ile (parola yok); e-posta müşteri kartında KAYITLI olmalı.
--   · "Duruma göre şubede sipariş verebilir, merkezde" → portal kullanıcısı
--     ya TÜM noktalara ya SEÇİLİ noktalara yazabilir.
--
-- ── EN ÖNEMLİ GÜVENLİK GERÇEĞİ ────────────────────────────────────────────
-- Portal kullanıcısının `app_user` satırı YOK, dolayısıyla JWT'sinde tenant
-- iddiası da yok. `app.current_tenant_id()` onun için NULL döner ve bütün
-- kiracı politikaları `tenant_id = null` → NULL → RED verir.
--
-- Yani portal kullanıcısı tablolardan HİÇBİR ŞEY göremez; bunu bu göçte
-- kurmuyoruz, mimari 0001'den beri böyle. Portalın TEK kapısı aşağıdaki
-- `security definer` fonksiyonlardır — 0033/0034'teki başvuru formuyla aynı
-- kalıp. Yeni bir yol icat etmiyoruz.
--
-- ⚠️ Bu yüzden her fonksiyon tenant'ı YALNIZ portal kullanıcısının kendi
-- satırından okur. Girdiden okusaydık, portal kullanıcısı başka bir
-- işletmenin kiracı kimliğini yazıp oraya sipariş yazabilirdi.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0 · ÖNCE BİR AÇIK KAPATILIYOR (0047'nin fonksiyonları) ────────────────
-- ⚠️ PROVADA BULUNAN GERÇEK HATA. 0047'deki `app.musteri_fiyati` ve
-- `app.siparis_penceresi` gövdelerinde tablo adları NİTELİKSİZ yazılmıştı
-- (`customer_price`, değil `public.customer_price`) ve fonksiyonların kendi
-- `search_path`i yoktu.
--
-- Bu, o fonksiyonları ÇAĞIRANIN search_path'ini miras aldıkları anlamına
-- geliyor. Portal kapıları `security definer set search_path = ''` ile
-- yazılıyor (doğru olan bu) ve o boş yol içinden çağrıldıklarında
-- "relation customer_price does not exist" ile PATLIYORLAR.
--
-- Şimdiye kadar patlamadılar çünkü hep normal bir oturumdan çağrıldılar.
-- Portal onları ilk kez sertleştirilmiş bir bağlamdan çağırıyor.
--
-- DERS: `security definer` bir fonksiyonun çağırdığı HER fonksiyonun gövdesi
-- de nitelikli olmak zorunda. Çağıranı sertleştirmek, çağrılanı düzeltmeden
-- yeterli değil.
create or replace function app.musteri_fiyati(
  p_nokta uuid, p_kalem uuid, p_tarih date default current_date
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case when k.removed then null else k.unit_price end
    from (
      select cp.unit_price, cp.removed
        from public.customer_price cp
        join public.delivery_point dp on dp.id = p_nokta
       where cp.stock_item_id = p_kalem
         and cp.valid_from   <= p_tarih
         and (
           cp.delivery_point_id = p_nokta
           or (cp.delivery_point_id is null and cp.customer_id = dp.customer_id)
         )
       order by (cp.delivery_point_id is not null) desc,
                cp.valid_from desc,
                cp.created_at desc
       limit 1
    ) k;
$$;

create or replace function app.siparis_penceresi(p_nokta uuid)
returns table (
  kesim_saati time,
  gun_farki   smallint,
  kaynak      text
)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(dp.order_cutoff_time,  c.order_cutoff_time),
    coalesce(dp.delivery_lead_days, c.delivery_lead_days),
    case
      when dp.order_cutoff_time is not null or dp.delivery_lead_days is not null
        then 'nokta'
      when c.order_cutoff_time  is not null or c.delivery_lead_days  is not null
        then 'musteri'
      else 'yok'
    end
    from public.delivery_point dp
    join public.customer c on c.id = dp.customer_id
   where dp.id = p_nokta;
$$;

-- ── 1 · PORTAL KULLANICISI ────────────────────────────────────────────────
create table if not exists portal_user (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete restrict,
  customer_id   uuid not null references customer(id) on delete restrict,
  -- Küçük harfe indirilmiş e-posta. Kimlik doğrulaması Supabase Auth'ta;
  -- burada YALNIZ "bu e-posta hangi müşteri kartına ait" yazıyor.
  email         text not null,
  full_name     text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz,
  constraint portal_user_email_bicimi check (email like '%@%' and email = lower(email)),
  constraint portal_user_email_kiraci_unique unique (tenant_id, email)
);

-- ⚠️ ETKİN e-posta GLOBAL tekil.
--
-- Sebebi: giriş yalnız e-postayla oluyor; aynı e-posta iki işletmede etkin
-- olsaydı "bu kişi kimin müşterisi" sorusunun iki cevabı olurdu ve
-- fonksiyon birini SESSİZCE seçerdi. Sessiz seçim, yanlış işletmenin
-- siparişini göstermek demektir.
--
-- BİLİNEN SINIR: iki ayrı mutfakla çalışan bir satın almacı iki ayrı
-- e-posta kullanmak zorunda. Bu gerçekten gerekirse çözüm, form
-- bağlantısının taşıdığı işletme kimliğiyle birlikte çözümlemektir —
-- yarım bir mekanizma kurmak yerine sınırı yazıyoruz.
create unique index if not exists portal_user_email_unique
  on portal_user (email) where is_active;

create index if not exists portal_user_musteri_ix on portal_user (tenant_id, customer_id);

alter table portal_user enable row level security;
alter table portal_user force  row level security;
drop policy if exists portal_user_tenant_isolation on portal_user;
create policy portal_user_tenant_isolation on portal_user
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- Kart ile kullanıcı TUTARLI olmalı. Yabancı anahtar "böyle bir müşteri var
-- mı" der, "BİZİM müşterimiz mi" demez (MI424 — altıncı kez).
create or replace function app.portal_kullanicisi_tutarli()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.customer
                  where id = new.customer_id and tenant_id = new.tenant_id) then
    raise exception 'Müşteri kartı bu işletmeye ait değil.'
      using errcode = 'MI424';
  end if;
  return new;
end;
$$;

drop trigger if exists portal_user_tutarli on portal_user;
create trigger portal_user_tutarli
  before insert or update of customer_id, tenant_id on portal_user
  for each row execute function app.portal_kullanicisi_tutarli();

-- ── 2 · HANGİ NOKTALARA YAZABİLİR ─────────────────────────────────────────
-- Emrah: "Duruma göre şubede sipariş verebilir, merkezde."
--
-- ⚠️ SATIR YOKSA = MERKEZ (müşterinin BÜTÜN noktaları).
--    SATIR VARSA  = YALNIZ o noktalar.
-- Boşluğun anlamı "hiçbiri" değil "hepsi" — bu, kolayca ters anlaşılacak
-- bir karar, o yüzden burada ve fonksiyonun içinde tekrar yazılı.
create table if not exists portal_user_point (
  portal_user_id    uuid not null references portal_user(id) on delete cascade,
  delivery_point_id uuid not null references delivery_point(id) on delete cascade,
  tenant_id         uuid not null references tenant(id) on delete restrict,
  primary key (portal_user_id, delivery_point_id)
);

alter table portal_user_point enable row level security;
alter table portal_user_point force  row level security;
drop policy if exists portal_user_point_tenant_isolation on portal_user_point;
create policy portal_user_point_tenant_isolation on portal_user_point
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- Nokta, portal kullanıcısının MÜŞTERİSİNE ait olmalı: yoksa bir müşteri
-- başka bir müşterinin kapısına sipariş yazdırabilirdi.
create or replace function app.portal_noktasi_tutarli()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.portal_user pu
      join public.delivery_point dp on dp.customer_id = pu.customer_id
     where pu.id = new.portal_user_id
       and dp.id = new.delivery_point_id
       and pu.tenant_id = new.tenant_id)
  then
    raise exception 'Teslim noktası, portal kullanıcısının müşterisine ait değil.'
      using errcode = 'MI424';
  end if;
  return new;
end;
$$;

drop trigger if exists portal_user_point_tutarli on portal_user_point;
create trigger portal_user_point_tutarli
  before insert on portal_user_point
  for each row execute function app.portal_noktasi_tutarli();

-- ── 3 · OTURUMDAKİ PORTAL KULLANICISI ─────────────────────────────────────
-- ⚠️ `security definer`: portal kullanıcısının kendi satırını okuyabilmesi
-- gerekiyor ama RLS onu (haklı olarak) engelliyor. Fonksiyon TEK bir satır
-- döndürüyor ve o satır yalnız kendi e-postasına ait.
create or replace function app.portal_kullanicisi()
returns portal_user
language sql
stable
security definer
set search_path = ''
as $$
  select pu.* from public.portal_user pu
   where pu.is_active
     and pu.email = lower(nullif(
           current_setting('request.jwt.claims', true)::json ->> 'email', ''))
   limit 1;
$$;

comment on function app.portal_kullanicisi() is
  'Oturumdaki portal kullanıcısı, JWT''deki e-postadan çözülür. Portal '
  'kullanıcısı olmayan bir oturumda BOŞ döner — bütün portal kapıları buna '
  'bakıp reddediyor.';

create or replace function app.portal_nokta_izinli(p_nokta uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- ⚠️ Kısıt satırı YOKSA bütün noktalar izinli (merkez). VARSA yalnız
  -- yazılı olanlar.
  select exists (
    select 1
      from app.portal_kullanicisi() pu
      join public.delivery_point dp on dp.id = p_nokta
     where dp.customer_id = pu.customer_id
       and ( not exists (select 1 from public.portal_user_point x
                          where x.portal_user_id = pu.id)
             or exists (select 1 from public.portal_user_point x
                         where x.portal_user_id = pu.id
                           and x.delivery_point_id = p_nokta) )
  );
$$;

-- ── 4 · PORTALIN GÖRDÜĞÜ NOKTALAR ─────────────────────────────────────────
create or replace function public.portal_noktalarim()
returns table (nokta_id uuid, nokta_adi text, adres text, ilce text, il text)
language sql
stable
security definer
set search_path = ''
as $$
  select dp.id, dp.name, dp.address, dp.district, dp.city
    from app.portal_kullanicisi() pu
    join public.delivery_point dp on dp.customer_id = pu.customer_id
   where dp.is_active
     and ( not exists (select 1 from public.portal_user_point x
                        where x.portal_user_id = pu.id)
           or exists (select 1 from public.portal_user_point x
                       where x.portal_user_id = pu.id
                         and x.delivery_point_id = dp.id) )
   order by dp.name;
$$;

-- ── 5 · PORTALIN SİPARİŞ EDEBİLECEĞİ ÜRÜNLER ──────────────────────────────
-- ⚠️ FİYAT DÖNDÜRÜLMÜYOR. Emrah'ın kararı: "Form fiyat gösterecek mi? Hayır."
--
-- Katalog, FİYAT DEFTERİNDEN süzülüyor: müşteri, sözleşmesi olan ürünü
-- sipariş eder. Bütün stok kalemlerini açsaydık müşteri bize üretmediğimiz
-- bir şeyi sipariş edebilirdi.
create or replace function public.portal_urunlerim(p_nokta uuid)
returns table (kalem_id uuid, kalem_adi text, birim text)
language sql
stable
security definer
set search_path = ''
as $$
  select si.id, si.name, si.base_uom
    from app.portal_kullanicisi() pu
    join public.delivery_point dp on dp.id = p_nokta and dp.customer_id = pu.customer_id
    join public.stock_item si on si.tenant_id = pu.tenant_id and si.is_active
   where app.portal_nokta_izinli(p_nokta)
     -- Bugün geçerli bir fiyatı olan kalemler. `musteri_fiyati` kaldırma
     -- satırında NULL döndürüyor, o kalem listeye girmiyor.
     and app.musteri_fiyati(p_nokta, si.id) is not null
   order by si.name;
$$;

-- ── 6 · EN ERKEN SEVK TARİHİ ──────────────────────────────────────────────
-- Sipariş penceresi (0047) burada işe yarıyor: kesim saatini geçtiyse
-- sipariş bir sonraki güne kayar. Bunu ekranda söylemek, müşterinin
-- "neden yarın değil" diye sormasını engelliyor.
create or replace function app.portal_en_erken_sevk(p_nokta uuid)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_kesim time;
  v_fark  int;
  v_gun   date := current_date;
begin
  select kesim_saati, gun_farki into v_kesim, v_fark
    from app.siparis_penceresi(p_nokta);

  -- Pencere tanımlı değilse söz veremeyiz; yarını öneriyoruz. Bugünü
  -- önermek, mutfağa "bugün yetiştir" demek olurdu.
  if v_kesim is null then return v_gun + 1; end if;
  if current_time::time > v_kesim then v_gun := v_gun + 1; end if;
  return v_gun + coalesce(v_fark, 0);
end;
$$;

create or replace function public.portal_en_erken_sevk(p_nokta uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select case when app.portal_nokta_izinli(p_nokta)
              then app.portal_en_erken_sevk(p_nokta) end;
$$;

-- ── 7 · SİPARİŞ VERME — TEK KAPI ──────────────────────────────────────────
-- ⚠️ Kiracı ve müşteri GİRDİDEN DEĞİL, portal kullanıcısının satırından
-- geliyor. Girdiden alsaydık portal kullanıcısı başka bir işletmeye sipariş
-- yazabilirdi. Bu, bu fonksiyonun en önemli satırıdır.
create or replace function public.portal_siparis_ver(
  p_nokta    uuid,
  p_satirlar jsonb,          -- [{"kalem_id":"...","miktar":10,"birim":"koli"}]
  p_teslim   date default null,
  p_not      text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pu       public.portal_user;
  v_sube     uuid;
  v_no       text;
  v_yil      text := to_char(current_date, 'YYYY');
  v_sira     int;
  v_siparis  uuid;
  v_rev      uuid;
  v_erken    date;
  v_satir    jsonb;
  v_i        int := 0;
  v_kalem    uuid;
  v_miktar   numeric;
  v_birim    text;
begin
  v_pu := app.portal_kullanicisi();
  if v_pu.id is null then
    raise exception 'Portal kullanıcısı bulunamadı. Bu e-posta bir müşteri '
                    'kartına bağlı değil ya da erişimi kapatılmış.'
      using errcode = 'MI431';
  end if;

  if not app.portal_nokta_izinli(p_nokta) then
    raise exception 'Bu teslim noktasına sipariş yazma yetkiniz yok.'
      using errcode = 'MI431';
  end if;

  if p_satirlar is null or jsonb_array_length(p_satirlar) = 0 then
    raise exception 'Sipariş en az bir kalem içermeli.' using errcode = 'MI431';
  end if;

  v_erken := app.portal_en_erken_sevk(p_nokta);
  if p_teslim is not null and p_teslim < v_erken then
    raise exception 'Bu nokta için en erken teslim tarihi %. Sipariş kesim '
                    'saatini geçtiyse sipariş bir sonraki güne kayar.',
                    to_char(v_erken, 'DD.MM.YYYY')
      using errcode = 'MI432';
  end if;

  -- Şube: müşterinin sevkiyatlarının çıktığı şube yerine kiracının ilk
  -- şubesi. ⚠️ Bilinçli basitlik: portal müşterisi hangi depodan
  -- karşılanacağını bilmez ve bilmemeli; o kararı mutfak onay zincirinde
  -- verir. Çok şubeli kiracıda bu, onayda düzeltilecek bir varsayımdır.
  select id into v_sube from public.branch
   where tenant_id = v_pu.tenant_id order by created_at limit 1;
  if v_sube is null then
    raise exception 'İşletmenin şubesi tanımlı değil.' using errcode = 'MI431';
  end if;

  -- Numara: iki kişi aynı anda gönderirse çakışmasın.
  perform pg_advisory_xact_lock(hashtext(v_pu.tenant_id::text || v_yil));
  select coalesce(max(substring(order_no from 10)::int), 0) + 1 into v_sira
    from public.sales_order
   where tenant_id = v_pu.tenant_id and order_no like 'SIP-' || v_yil || '-%';
  v_no := 'SIP-' || v_yil || '-' || lpad(v_sira::text, 4, '0');

  insert into public.sales_order
    (tenant_id, branch_id, order_no, customer_id, delivery_point_id,
     requested_ship_date, requested_delivery_date, status, note)
  values
    (v_pu.tenant_id, v_sube, v_no, v_pu.customer_id, p_nokta,
     v_erken, coalesce(p_teslim, v_erken),
     -- ⚠️ Doğrudan "Onay Bekliyor". Müşteri gönderdiyse niyeti nettir;
     -- sıradaki iş mutfağındır. Taslakta bırakmak, kimsenin bakmadığı bir
     -- kutuda sipariş biriktirmek olurdu.
     'Onay Bekliyor',
     nullif(btrim(coalesce(p_not, '')), ''))
  returning id into v_siparis;

  insert into public.sales_order_revision
    (tenant_id, order_id, revision_no, kind, source, reason)
  values (v_pu.tenant_id, v_siparis, 1, 'MIKTAR', 'Portal',
          'Müşteri portalından girildi')
  returning id into v_rev;

  for v_satir in select * from jsonb_array_elements(p_satirlar) loop
    v_i := v_i + 1;
    v_kalem  := (v_satir ->> 'kalem_id')::uuid;
    v_miktar := (v_satir ->> 'miktar')::numeric;
    v_birim  := v_satir ->> 'birim';

    if v_kalem is null or v_miktar is null or not (v_miktar > 0) or coalesce(v_birim,'') = '' then
      raise exception '%. satır eksik: ürün, miktar ve birim zorunlu.', v_i
        using errcode = 'MI431';
    end if;
    -- Sözleşmesi olmayan ürün sipariş edilemez. Bu kontrol olmadan müşteri
    -- katalogda görmediği bir kalem kimliğini elle gönderebilirdi.
    if app.musteri_fiyati(p_nokta, v_kalem) is null then
      raise exception '%. satırdaki ürün bu noktaya sipariş edilemez '
                      '(sözleşmeli fiyatı yok).', v_i using errcode = 'MI431';
    end if;

    insert into public.sales_order_line
      (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
    values (v_pu.tenant_id, v_siparis, v_rev, v_i, v_kalem, v_miktar, v_birim);
  end loop;

  update public.portal_user set last_login_at = now() where id = v_pu.id;
  return v_no;
end;
$$;

-- ── 8 · PORTALIN GÖRDÜĞÜ SİPARİŞLER ───────────────────────────────────────
-- ⚠️ FİYAT KOLONU YOK ve olmayacak. RLS kolonu gizleyemez; o yüzden portal
-- tabloyu değil bu fonksiyonu okuyor.
create or replace function public.portal_siparislerim()
returns table (
  siparis_no  text,
  nokta_adi   text,
  tarih       date,
  sevk_tarihi date,
  soz_tarihi  date,
  durum       text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.order_no, dp.name, o.order_date, o.requested_ship_date,
         o.promised_delivery_date, o.status
    from app.portal_kullanicisi() pu
    join public.sales_order o on o.customer_id = pu.customer_id
                             and o.tenant_id  = pu.tenant_id
    left join public.delivery_point dp on dp.id = o.delivery_point_id
   where ( not exists (select 1 from public.portal_user_point x
                        where x.portal_user_id = pu.id)
           or o.delivery_point_id in (select x.delivery_point_id
                                        from public.portal_user_point x
                                       where x.portal_user_id = pu.id) )
   order by o.order_date desc, o.order_no desc;
$$;

create or replace function public.portal_siparis_satirlarim(p_siparis_no text)
returns table (kalem_adi text, miktar numeric, birim text)
language sql
stable
security definer
set search_path = ''
as $$
  select si.name, l.qty, l.uom_code
    from app.portal_kullanicisi() pu
    join public.sales_order o on o.order_no = p_siparis_no
                             and o.customer_id = pu.customer_id
                             and o.tenant_id  = pu.tenant_id
    join app.siparis_guncel_satirlari(o.id) l on true
    join public.stock_item si on si.id = l.stock_item_id
   order by l.line_no;
$$;

-- ── 9 · ERİŞİM ────────────────────────────────────────────────────────────
-- ⚠️ RLS ve GRANT AYRI KAPILARDIR (0006).
grant select, insert, update on portal_user       to authenticated;
grant select, insert, delete on portal_user_point to authenticated;

-- Portal kapıları: yalnız GİRİŞ YAPMIŞ oturumlar. `anon` HİÇBİRİNİ
-- çağıramaz — kimliği doğrulanmamış bir istek müşteri olduğunu kanıtlamaz.
do $$
declare f text;
begin
  foreach f in array array[
    'public.portal_noktalarim()',
    'public.portal_urunlerim(uuid)',
    'public.portal_en_erken_sevk(uuid)',
    'public.portal_siparislerim()',
    'public.portal_siparis_satirlarim(text)',
    'public.portal_siparis_ver(uuid,jsonb,date,text)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke all on function %s from anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- İç çözümleyiciler dışarıya AÇILMIYOR.
revoke all on function app.portal_kullanicisi() from public, anon, authenticated;
revoke all on function app.portal_nokta_izinli(uuid) from public, anon, authenticated;

-- ── 10 · DENETİM ──────────────────────────────────────────────────────────
-- Portal erişimi VERMEK ve ALMAK denetlenir: bir müşteriye sipariş yazma
-- yetkisi verilmesi, sessiz kalmaması gereken bir karardır.
do $$
declare
  t text;
  izlenecek text[] := array[
    'portal_user'
  ];
begin
  foreach t in array izlenecek loop
    if to_regclass('public.' || t) is null then
      raise notice 'Denetim atlandı, tablo yok: %', t;
      continue;
    end if;
    execute format('drop trigger if exists %I on public.%I', 'denetim_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function app.denetim_yaz()',
      'denetim_' || t, t
    );
  end loop;
end $$;

-- ── 11 · YAZMA KİLİDİ ─────────────────────────────────────────────────────
do $$
declare v_eksik text;
begin
  perform app.lisans_kilidini_tak();
  select string_agg(a, ', ') into v_eksik
    from unnest(array['portal_user','portal_user_point']) as a
   where not exists (
     select 1 from pg_trigger t
      where t.tgrelid = ('public.' || a)::regclass
        and t.tgname = 'trg_lisans_kilidi_' || a and not t.tgisinternal);
  if v_eksik is not null then
    raise exception '0054: lisans kilidi takılmayan tablo: %', v_eksik;
  end if;
end;
$$;

-- ── 12 · DOĞRULAMA ────────────────────────────────────────────────────────
do $$
declare f text;
begin
  if to_regclass('public.portal_user') is null
     or to_regclass('public.portal_user_point') is null then
    raise exception '0054: tablolar kurulmadı.';
  end if;

  -- anon HİÇBİR portal kapısını çağıramamalı.
  foreach f in array array[
    'public.portal_noktalarim()','public.portal_urunlerim(uuid)',
    'public.portal_en_erken_sevk(uuid)','public.portal_siparislerim()',
    'public.portal_siparis_satirlarim(text)',
    'public.portal_siparis_ver(uuid,jsonb,date,text)'
  ] loop
    if has_function_privilege('anon', f, 'execute') then
      raise exception '0054: anon % çağırabiliyor.', f;
    end if;
    if not has_function_privilege('authenticated', f, 'execute') then
      raise exception '0054: authenticated % çağıramıyor.', f;
    end if;
  end loop;

  -- İç çözümleyici dışarıya kapalı olmalı.
  if has_function_privilege('authenticated', 'app.portal_kullanicisi()', 'execute') then
    raise exception '0054: app.portal_kullanicisi() dışarıya açık.';
  end if;

  raise notice '0054 TAMAM · portal kullanıcısı e-postayla çözülüyor · fiyat dönmüyor · sipariş Onay Bekliyor doğuyor';
end;
$$;
