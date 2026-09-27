-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0047 — MÜŞTERİ KARTI, TESLİM NOKTASI, FİYAT LİSTESİ (A4C1)
-- ═══════════════════════════════════════════════════════════════════════════
-- Yol haritası maddesi: "Müşteri kartı ve sözleşme"
--          Bitti sayılır ki: "Sevkiyatta müşteri adı elle yazılmıyor,
--                             karttan seçiliyor"
--
-- ── BUGÜN NEREDEYİZ ───────────────────────────────────────────────────────
-- `shipment.customer_name` DÜZ METİN. Yani "Migros", "MİGROS", "migros tic"
-- üç ayrı müşteri oluyor. Bu, şu soruları cevapsız bırakıyor: bu müşteriye
-- bu yıl ne sattık, siparişi kime yazacağız, irsaliye hangi adrese gidecek,
-- bir geri çağırmada kimi arayacağız. Tedarikçide aynı hatayı 0017'de
-- düzeltmiştik; müşteri tarafı açık kalmıştı.
--
-- ── NİÇİN ÜÇ TABLO, İKİ DEĞİL ────────────────────────────────────────────
-- Emrah'ın gerçek işi şunu söylüyor: bir MÜŞTERİ (Migros) altında birden çok
-- TESLİM NOKTASI olur (Ataşehir, Kadıköy). Sipariş müşteriye değil NOKTAYA
-- yazılır — çünkü irsaliye oraya çıkar, araç oraya gider, yükleme sıcaklığı
-- orada ölçülür. Ticari kimlik (vergi no, ödeme vadesi) müşterideyken adres
-- ve teslim penceresi noktadadır.
--
-- Fiyat üçüncü tabloda, çünkü fiyat bir ÖZELLİK değil bir TARİHÇEDİR:
-- "bugün kaç lira" sorusundan daha önemlisi "o irsaliye kesildiğinde kaç
-- liraydı". Fiyatı müşteri kartında bir kolon yapmak, geçmişi her zam
-- yapıldığında silmek demekti.
--
-- ── EMRAH'IN İKİ CEVABI (2026-09-27) VE ŞEMAYA ETKİSİ ────────────────────
-- 1. "Aynı müşterinin farklı teslim noktalarına farklı fiyat uyguluyor
--    musun?" → EVET.
--    Bu yüzden `customer_price.delivery_point_id` var ve BOŞ BIRAKILABİLİR:
--    boşsa fiyat müşterinin BÜTÜN noktaları için geçerli, doluysa yalnız o
--    nokta için. Arama en ÖZELden genele iniyor. Fiyatı yalnız müşteri
--    seviyesinde tutup sonra nokta seviyesine taşımak, kesilmiş her
--    irsaliyenin fiyat geçmişini yeniden yorumlamak demekti.
-- 2. "Teslim noktasının kendi sipariş penceresi var mı?" → HEM EVET HEM
--    HAYIR. Yani bazı noktada var, bazısında yok.
--    Bu yüzden pencere alanları hem noktada hem müşteride ve İKİSİ DE
--    BOŞ BIRAKILABİLİR. Çözüm sırası: nokta → müşteri → pencere yok.
--    "Boş = sınırsız" kuralı, "boş = 0" kuralından çok daha az sürpriz
--    üretir; lisansta da (0042) aynı kararı vermiştik.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · MÜŞTERİ ───────────────────────────────────────────────────────────
-- Şubeye DEĞİL kiracıya bağlı. Gerekçe 0017'deki tedarikçiyle aynı: müşteri
-- fiziksel değildir, aynı firma bütün şubelerden mal alır. Şube kapsamlı
-- olsaydı üç şubeli bir mutfak Migros'u üç kez girer ve toplamları ayrışırdı.
create table if not exists customer (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete restrict,
  code          text not null,
  -- `code_key` normalleştirilmiş hâl. Kural `core/identifier.ts >
  -- normalizeIdentifier()` ile BİREBİR aynı: NFC, dört i varyantı (i/ı/I/İ)
  -- tek harfe katlanır, sonra büyük harf. ⚠️ Yerel ayarla küçültme YAPILMAZ:
  -- 'ISTANBUL'.toLowerCase('tr') → 'ıstanbul' olur ve 'istanbul' ile
  -- eşleşmez. Bu hata G1'de bir kez yaşandı.
  code_key      text not null,
  name          text not null,
  tax_number    text,
  tax_office    text,
  contact_name  text,
  phone         text,
  email         text,
  address       text,

  -- ── SÖZLEŞME TARAFI ───────────────────────────────────────────────────
  -- Ödeme vadesi gün cinsinden. Boş = vade konuşulmamış. Sıfır YAZMIYORUZ:
  -- sıfır "peşin" demektir ve o bir KARAR; boş, kararın verilmediğidir.
  payment_term_days smallint check (payment_term_days is null or payment_term_days >= 0),

  -- ── VARSAYILAN SİPARİŞ PENCERESİ ──────────────────────────────────────
  -- Noktanın kendi penceresi yoksa buraya düşülür. İkisi de boşsa pencere
  -- yok demektir — sipariş her saat girilebilir.
  order_cutoff_time  time,
  delivery_lead_days smallint check (delivery_lead_days is null or delivery_lead_days >= 0),

  notes         text,
  -- Müşteri SİLİNMEZ, pasife alınır. Silmek, o müşteriye kesilmiş
  -- irsaliyelerin ve siparişlerin geçmişini kopuk bırakırdı.
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint customer_code_unique   unique (tenant_id, code_key),
  constraint customer_name_not_blank check (btrim(name) <> ''),
  constraint customer_code_not_blank check (btrim(code) <> '')
);

create index if not exists customer_tenant_ix on customer (tenant_id, is_active);

alter table customer enable row level security;
-- ⚠️ `force` satırı şart: onsuz tablonun SAHİBİ politikayı atlar ve iki
-- kiracı birbirinin müşteri listesini görebilir (bkz. 0017).
alter table customer force  row level security;
drop policy if exists customer_tenant_isolation on customer;
create policy customer_tenant_isolation on customer
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop trigger if exists customer_touch on customer;
create trigger customer_touch before update on customer
  for each row execute function app.touch_updated_at();

-- ── 2 · TESLİM NOKTASI ────────────────────────────────────────────────────
-- Siparişin ve irsaliyenin gerçek hedefi. `tenant_id` hem burada hem
-- müşteride: yalıtım politikası doğrudan bu kolona bakıyor, müşteriye
-- JOIN atarak değil. JOIN'li bir politika, JOIN'in kendisi yalıtımlı
-- olmadığında sessizce delinir.
create table if not exists delivery_point (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id)   on delete restrict,
  customer_id   uuid not null references customer(id) on delete restrict,
  code          text not null,
  code_key      text not null,
  name          text not null,
  address       text,
  district      text,
  city          text,
  contact_name  text,
  phone         text,

  -- ── KENDİ SİPARİŞ PENCERESİ (boş olabilir) ────────────────────────────
  -- Örnek: kesim 06:00, gün farkı 0 → "sabah 06:00'dan önce girilen sipariş
  -- aynı gün çıkar, sonrası ertesi gün". Boş = müşterinin varsayılanı
  -- geçerli; müşteride de boşsa pencere yok.
  order_cutoff_time  time,
  delivery_lead_days smallint check (delivery_lead_days is null or delivery_lead_days >= 0),

  -- Teslim saat aralığı: aracın kapıda kabul edildiği saatler.
  delivery_window_start time,
  delivery_window_end   time,

  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Kod müşteri İÇİNDE tekil: iki ayrı müşterinin ikisinde de "MERKEZ"
  -- olabilir, bu doğaldır.
  constraint delivery_point_code_unique unique (customer_id, code_key),
  constraint delivery_point_name_not_blank check (btrim(name) <> ''),
  constraint delivery_point_code_not_blank check (btrim(code) <> ''),
  constraint delivery_point_window_sirasi check (
    delivery_window_start is null
    or delivery_window_end is null
    or delivery_window_end > delivery_window_start
  )
);

create index if not exists delivery_point_tenant_ix   on delivery_point (tenant_id, is_active);
create index if not exists delivery_point_customer_ix on delivery_point (customer_id, is_active);

alter table delivery_point enable row level security;
alter table delivery_point force  row level security;
drop policy if exists delivery_point_tenant_isolation on delivery_point;
create policy delivery_point_tenant_isolation on delivery_point
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop trigger if exists delivery_point_touch on delivery_point;
create trigger delivery_point_touch before update on delivery_point
  for each row execute function app.touch_updated_at();

-- Nokta, müşterisiyle AYNI kiracıda olmak zorunda. Yabancı anahtar bunu
-- söylemiyor: iki ayrı kolon iki ayrı satıra bakıyor. Yalıtım politikası
-- `tenant_id`ye baktığı için, yanlış eşleşmiş bir satır "kendi kiracısında
-- görünen ama başka kiracının müşterisine bağlı" bir kayıt olurdu.
create or replace function app.nokta_kiracisi_tutuyor()
returns trigger
language plpgsql
as $$
declare
  v_musteri_kiraci uuid;
begin
  select tenant_id into v_musteri_kiraci from customer where id = new.customer_id;
  if v_musteri_kiraci is distinct from new.tenant_id then
    raise exception 'Teslim noktası, müşterisinden farklı bir kiracıya yazılamaz.'
      using errcode = 'MI422';
  end if;
  return new;
end;
$$;

drop trigger if exists delivery_point_kiraci_kontrol on delivery_point;
create trigger delivery_point_kiraci_kontrol
  before insert or update of customer_id, tenant_id on delivery_point
  for each row execute function app.nokta_kiracisi_tutuyor();

-- ── 3 · FİYAT LİSTESİ ─────────────────────────────────────────────────────
-- ⚠️ EKLEMELİ DEFTER (ADR-001 ile aynı mantık). Fiyat GÜNCELLENMEZ, yeni
-- satır yazılır. Sebebi ticari: kesilmiş bir irsaliyenin fiyatı sonradan
-- değişirse o belge yalan söylemeye başlar. Zam yapmak = yeni `valid_from`
-- ile yeni satır. Fiyatı kaldırmak = `removed = true` satırı.
create table if not exists customer_price (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id)   on delete restrict,
  customer_id   uuid not null references customer(id) on delete restrict,
  -- BOŞ = müşterinin bütün noktaları. DOLU = yalnız o nokta.
  -- Emrah: "aynı müşterinin farklı noktalarına farklı fiyat: evet."
  delivery_point_id uuid references delivery_point(id) on delete restrict,
  stock_item_id uuid not null references stock_item(id) on delete restrict,

  unit_price    numeric(18,6) not null check (unit_price >= 0),
  currency      text not null default 'TRY' check (currency in ('TRY','USD','EUR')),
  -- Fiyatın hangi birim için olduğu. Sipariş palet/koli/kg ile girilebiliyor
  -- (A4C3); fiyat da o birimde yazılmalı, yoksa çarpım yanlış olur.
  uom_code      text not null,

  valid_from    date not null default current_date,
  -- Kaldırma satırı. `unit_price` sıfır yazılır ama anlamı "bedava" değil
  -- "artık fiyatlı değil" — okuyucu fonksiyon bunu NULL'a çeviriyor.
  removed       boolean not null default false,

  note          text,
  created_at    timestamptz not null default now(),
  created_by    uuid references app_user(id) on delete set null
);

-- Aynı kapsam + aynı kalem + aynı tarih iki kez yazılamaz. NULL'lar
-- Postgres'te birbirinden FARKLI sayıldığı için tek bir unique yetmez;
-- iki kısmi indeks gerekiyor.
create unique index if not exists customer_price_musteri_unique
  on customer_price (customer_id, stock_item_id, valid_from)
  where delivery_point_id is null;

create unique index if not exists customer_price_nokta_unique
  on customer_price (delivery_point_id, stock_item_id, valid_from)
  where delivery_point_id is not null;

create index if not exists customer_price_arama_ix
  on customer_price (tenant_id, stock_item_id, valid_from desc);

alter table customer_price enable row level security;
alter table customer_price force  row level security;
drop policy if exists customer_price_tenant_isolation on customer_price;
create policy customer_price_tenant_isolation on customer_price
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- Değişmezlik. 0043'teki lisans defteriyle aynı kalıp.
create or replace function app.fiyat_defteri_degismez()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Fiyat kaydı değiştirilemez ve silinemez. Yeni fiyat için '
                  'yeni satır yazılır; fiyatı kaldırmak için kaldırma satırı.'
    using errcode = 'MI403';
end;
$$;

-- ⚠️ KOMUT seviyesinde (`for each statement`), satır seviyesinde DEĞİL.
-- Satır seviyesinde olsaydı `update customer_price set ... where false` hiç
-- tetiklemez ve "tablo değişmez" cümlesi sınanamazdı — aşağıdaki doğrulama
-- bloğu tam bunu sınıyor. Ayrıca eklemeli bir defterde reddedilecek olan
-- satır değil KOMUTUN KENDİSİ.
drop trigger if exists customer_price_degismez on customer_price;
create trigger customer_price_degismez
  before update or delete on customer_price
  for each statement execute function app.fiyat_defteri_degismez();

-- ── 4 · GEÇERLİ FİYATI OKU ────────────────────────────────────────────────
-- Sıralama kuralı iki basamaklı ve ikisi de önemli:
--   1. Noktaya özel satır, müşteri geneline YENER (en özel kazanır).
--   2. Aynı kapsamda en YENİ `valid_from` kazanır.
-- Kazanan satır bir kaldırma satırıysa fiyat YOKTUR: NULL döner. Sıfır
-- dönmüyoruz — sıfır "bedava" demektir ve bu bir fiyattır.
create or replace function app.musteri_fiyati(
  p_nokta  uuid,
  p_kalem  uuid,
  p_tarih  date default current_date
)
returns numeric
language sql
stable
as $$
  select case when k.removed then null else k.unit_price end
    from (
      select cp.unit_price, cp.removed
        from customer_price cp
        join delivery_point dp on dp.id = p_nokta
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

comment on function app.musteri_fiyati(uuid, uuid, date) is
  'Bir teslim noktası için bir kalemin o tarihteki fiyatı. En özel kapsam '
  '(nokta > müşteri) ve en yeni valid_from kazanır. Kaldırma satırı NULL '
  'döndürür — sıfır DEĞİL, çünkü sıfır bir fiyattır.';

-- ── 5 · GEÇERLİ SİPARİŞ PENCERESİ ─────────────────────────────────────────
-- Emrah: "hem evet hem hayır." Yani çözüm sırası nokta → müşteri → yok.
-- `kaynak` alanı ekrana da yazılacak: kullanıcı pencerenin nereden geldiğini
-- görmezse, noktada değişiklik yaptığını sanıp müşteri varsayılanına
-- bakmaya devam eder.
create or replace function app.siparis_penceresi(p_nokta uuid)
returns table (
  kesim_saati time,
  gun_farki   smallint,
  kaynak      text
)
language sql
stable
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
    from delivery_point dp
    join customer c on c.id = dp.customer_id
   where dp.id = p_nokta;
$$;

comment on function app.siparis_penceresi(uuid) is
  'Teslim noktasının geçerli sipariş penceresi. Nokta boşsa müşterinin '
  'varsayılanı, o da boşsa pencere yok. `kaynak` hangisinden geldiğini '
  'söyler — ekranda gösterilecek.';

-- ── 6 · SEVKİYAT ARTIK KARTA BAĞLANABİLİR ─────────────────────────────────
-- Kolon BOŞ BIRAKILABİLİR ve bu bilinçli: var olan sevkiyatlarda müşteri
-- yalnız düz metin olarak duruyor, onları uydurma bir karta bağlamak
-- geçmişi bozmak olurdu. `customer_name` de KALIYOR — kesilmiş belgede ne
-- yazdıysa o durur.
--
-- ⚠️ "Elle yazılmıyor, karttan seçiliyor" maddesi bu göçle BİTMİYOR:
-- zorunluluk sevkiyat EKRANI karta bağlandığında kurulacak. Kolonu açıp
-- maddeyi işaretlemek, tam olarak yapmamaya söz verdiğimiz şey olurdu.
alter table shipment add column if not exists customer_id uuid
  references customer(id) on delete restrict;

alter table shipment add column if not exists delivery_point_id uuid
  references delivery_point(id) on delete restrict;

create index if not exists shipment_customer_card_ix
  on shipment (tenant_id, customer_id);

comment on column shipment.customer_id is
  'Müşteri kartı (0047). Boş olan satırlar 0047 ÖNCESİNDEN kalanlar: '
  'onlarda müşteri yalnız customer_name düz metninde.';

-- ── 7 · DENETİM ───────────────────────────────────────────────────────────
-- Müşteri ve nokta kullanıcı eliyle değişir; kim ne zaman neyi değiştirdi
-- durmak zorunda. Fiyat tablosu zaten değişmez ama EKLEME denetime girer:
-- "bu zammı kim girdi" sorusu ticari bir sorudur.
-- ⚠️ Aşağıdaki dizi değişkeninin adı 0027'dekiyle AYNI tutuluyor: mimari
-- testin tarayıcısı listeyi o kalıpla buluyor. Ad değişirse test sessizce
-- zayıflar.
-- ⚠️⚠️ VE BU YORUM SATIRI KALIBI TEKRAR YAZMIYOR — ilk yazımda yazmıştı ve
-- tarayıcı YORUMU eşleştirip gerçek listeyi atladı. Yani üç yeni tablo
-- denetime giriyordu ama test bunu görmüyordu. Kalıbı anlatan bir yorum,
-- kalıbı arayan bir tarayıcıyı yanıltır.
do $$
declare
  t text;
  izlenecek text[] := array[
    'customer', 'delivery_point', 'customer_price'
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

-- ── 8 · ERİŞİM ────────────────────────────────────────────────────────────
-- ⚠️ RLS VE GRANT AYRI KAPILARDIR (bkz. 0006). RLS "hangi satır"ı, GRANT
-- "hangi işlem"i söyler; biri açık biri kapalı olursa tablo ya görünmez ya
-- da korumasız kalır.
grant select, insert, update on customer       to authenticated;
grant select, insert, update on delivery_point to authenticated;
-- Fiyat: ekleme var, GÜNCELLEME VE SİLME YOK. Değişmezliği tetik de
-- koruyor ama iki kapı birlikte kapanır: tetik niyeti, GRANT yetkiyi söyler.
grant select, insert on customer_price to authenticated;
revoke update, delete on customer_price from authenticated;

-- `service_role` için GRANT YAZILMIYOR ve bu bilinçli: bu üç tabloya hiçbir
-- Edge Function dokunmuyor. 0040'ın dersi "her şeye grant ver" değil,
-- "grant'ı unutma" idi; ihtiyaç olmayan yetki de bir açıktır.

-- ── 9 · YAZMA KİLİDİNİ YENİ TABLOLARA DA TAK ──────────────────────────────
-- ⚠️ 0046 kilidi KENDİ KOŞTUĞU ANDA var olan tablolara taktı. Bu göçte üç
-- yeni kiracı tablosu doğdu; onlara takılmadı. Yani lisansı bitmiş bir
-- müşteri müşteri kartı ve FİYAT yazmaya devam edebilirdi.
--
-- Bunu her göçte elle tekrarlamak yerine takma işini bir FONKSİYONA
-- taşıyoruz. Bundan sonra kiracı tablosu ekleyen her göç son satırında
-- `select app.lisans_kilidini_tak();` çağırır. Muafiyet listesinin tek
-- kaynağı artık burası; 0046'nın içindeki döngü geçmiş kaydı olarak duruyor.
create or replace function app.lisans_kilidini_tak()
returns integer
language plpgsql
as $$
declare
  v_tablo text;
  v_sayac int := 0;
  -- Gerekçeler 0046'da yazılı. Kısaca: lisans tabloları (uzatmayı platform
  -- yazar), ek süre talebi (müşteri ek süreyi lisansı BİTTİĞİNDE ister),
  -- denetim kaydı (izin verilen yazımların tetiğinden yazılır — muaf
  -- olmazsa serbest işlem denetim satırında takılır), hata defteri, yedek
  -- günlüğü ve platform başvuru tabloları.
  v_muaf text[] := array[
    'license_extension_request',
    'tenant_license', 'license_event', 'license_package', 'license_package_module',
    'client_error', 'tenant_backup_log',
    'business_application', 'business_application_event',
    'audit_log'
  ];
  v_yok text;
begin
  -- Yanlış yazılmış bir muafiyet adı hata vermez, sessizce hiçbir şeyi muaf
  -- etmez. 0046'da tam bu oldu (`audit_event` / `backup_log`). O yüzden
  -- adlar önce şemadan doğrulanıyor.
  select string_agg(a, ', ') into v_yok
    from unnest(v_muaf) as a
   where not exists (
     select 1 from pg_tables where schemaname = 'public' and tablename = a);
  if v_yok is not null then
    raise exception 'Yazma kilidi: muafiyet listesinde şemada olmayan tablo: %', v_yok;
  end if;

  for v_tablo in
    select c.table_name
      from information_schema.columns c
      join pg_tables t on t.tablename = c.table_name and t.schemaname = 'public'
     where c.table_schema = 'public'
       and c.column_name  = 'tenant_id'
       and not (c.table_name = any (v_muaf))
     group by c.table_name
  loop
    execute format('drop trigger if exists %I on public.%I',
      'trg_lisans_kilidi_' || v_tablo, v_tablo);
    execute format(
      'create trigger %I before insert or update or delete on public.%I '
      'for each statement execute function app.lisans_yazma_kilidi()',
      'trg_lisans_kilidi_' || v_tablo, v_tablo);
    v_sayac := v_sayac + 1;
  end loop;

  return v_sayac;
end;
$$;

comment on function app.lisans_kilidini_tak() is
  'Lisans yazma kilidini (0046) kiracı tablolarının HEPSİNE yeniden takar. '
  'Kiracı tablosu ekleyen her göç son satırında bunu çağırmalı; yoksa yeni '
  'tablo kilitsiz kalır ve lisansı bitmiş müşteri oraya yazmaya devam eder.';

-- ── 10 · DOĞRULAMA ────────────────────────────────────────────────────────
do $$
declare
  v_kilit int;
  v_eksik text;
begin
  v_kilit := app.lisans_kilidini_tak();

  -- Üç yeni tablo gerçekten kilitlendi mi? "Fonksiyonu çağırdım" demek
  -- yetmez; sonucu sorulur.
  select string_agg(a, ', ') into v_eksik
    from unnest(array['customer','delivery_point','customer_price']) as a
   where not exists (
     select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
      where c.relname = a and g.tgname = 'trg_lisans_kilidi_' || a);
  if v_eksik is not null then
    raise exception '0047: yeni tabloya yazma kilidi takılmadı: %', v_eksik;
  end if;

  -- Fiyat tablosu gerçekten değişmez mi? Tetik VAR demek, tetik ÇALIŞIYOR
  -- demek değil. Boş bir güncelleme bile reddedilmeli.
  begin
    update customer_price set note = 'olmaz' where false;
    raise exception '0047: fiyat defteri güncellenebiliyor — değişmezlik yok.';
  exception when sqlstate 'MI403' then null;
  end;

  raise notice '0047 TAMAM · müşteri + teslim noktası + fiyat defteri · '
               'yazma kilidi % tabloda · fiyat değişmez', v_kilit;
end;
$$;
