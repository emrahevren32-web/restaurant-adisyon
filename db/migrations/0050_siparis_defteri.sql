-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0050 — SİPARİŞ DEFTERİ (A4C2)
-- ═══════════════════════════════════════════════════════════════════════════
-- Emrah'ın cümlesi: "Müşteri sipariş giriyor, o hazırlanırken arada birçok kez
-- siparişi güncelliyor... Sonradan kimse 'ben bunu istiyordum, eksik
-- hazırlanmış, fazla gelmiş, farklı gelmiş' diyemesin."
--
-- Bu, izlenebilirlikten ÖNCE gelen satış argümanı: izlenebilirlik yılda bir
-- kez lazım olur, sipariş kaosu her gün acıtır.
--
-- ── TEK CÜMLELİK KARAR ────────────────────────────────────────────────────
-- SİPARİŞ BİR EKRAN DEĞİL, BİR DEFTERDİR. Satır asla üstüne yazılmaz; her
-- değişiklik yeni bir REVİZYON doğurur. Stok defteriyle (ADR-001), lisans
-- defteriyle (0043) ve fiyat defteriyle (0047) aynı kalıp — beşinci kez.
--
-- "Şu andaki sipariş" = EN SON SATIRLI REVİZYONUN satırları. Geçmiş
-- kendiliğinden durur; silinen hiçbir şey yok.
--
-- ── EMRAH'IN 28.09 KARARLARI VE ŞEMAYA ETKİSİ ─────────────────────────────
-- 1. "Siparişte yazan neyse o gider." Sipariş bir SÖZLEŞME.
-- 2. "Bir şekilde mutlaka tamamlanır sipariş." → Sipariş, farkı sıfırlanmadan
--    TESLİM EDİLDİ olamaz. Ya tamamlanır ya gerekçeli revize edilir.
-- 3. "Sevk edildikten sonra 200 değil de 150 istiyorum olmaz — en başından
--    istediğini ürettim." AMA "a noktasına değil b noktasına olur".
--    → Sevkiyattan sonra MİKTAR değişmez, LOJİSTİK değişir. Şemada iki ayrı
--      revizyon türü var ve kural tetikte duruyor.
-- 4. "Sevk sonrası revizyon yalnız bir fark kaydına bağlı olabilir."
--    → `sales_order_revision.discrepancy_id`, sevk sonrası MİKTAR
--      revizyonunda ZORUNLU.
-- 5. "Farkı ilk fark eden bayrak kaldırmalı."
--    → Fark kaydı siparişten de sevkiyattan da açılabilir; kim, nerede fark
--      etti alanları zorunlu.
--
-- ── EN ÖNEMLİ AYRIM: REVİZYON ≠ FARK ──────────────────────────────────────
-- REVİZYON = niyet değişti. Müşteri fikrini değiştirdi.
-- FARK     = gerçek tutmadı. İstenen aynı, giden ya da varan farklı.
--
-- İkisini aynı kutuya koymak, bu ürünün satmaya çalıştığı şeyi yok eder:
-- 10 koli sipariş, 8 gitti. Siparişi 8'e "revize" edersen sipariş eksiksiz
-- görünür ve 2 kolinin kaybolduğuna dair TEK KANIT silinir. "O kişiye
-- ödetilir" cümlesinin dayanağı kalmaz.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · SİPARİŞ BAŞLIĞI ───────────────────────────────────────────────────
-- Şubeye bağlı, çünkü sipariş bir DEPODAN karşılanır (sevkiyatla aynı
-- gerekçe, 0023). Müşteri ve teslim noktası 0047'den geliyor.
create table if not exists sales_order (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  branch_id      uuid not null references branch(id) on delete restrict,
  order_no       text not null,
  customer_id    uuid not null references customer(id) on delete restrict,
  -- Sipariş müşteriye değil NOKTAYA yazılır: irsaliye oraya çıkar, araç oraya
  -- gider, yükleme sıcaklığı orada ölçülür (0047). Lojistik revizyonunda
  -- değişebilen alan da budur.
  delivery_point_id uuid references delivery_point(id) on delete restrict,

  order_date     date not null default current_date,
  -- ⚠️ SEVK ve TESLİM tarihi AYRI. Yol haritası maddesi bunu açıkça istiyor:
  -- mal bizden ne zaman çıkacak ile müşterinin kapısında ne zaman olacak
  -- aynı gün olmak zorunda değil (0047'deki teslim gün farkı tam bu).
  requested_ship_date     date,
  requested_delivery_date date,

  -- TASLAK ─→ ONAYLANDI ─→ HAZIRLANIYOR ─→ HAZIR ─→ SEVK EDİLDİ
  --                                                   └→ KISMİ SEVK
  --                                                   └→ TESLİM EDİLDİ
  -- Her durumdan İPTAL'e gidilebilir (sevk öncesi). İPTAL'den geri dönüş
  -- YENİDEN AÇILDI ile değil, yeni revizyonla olur — iptalin izi kalsın.
  status         text not null default 'Taslak'
                   check (status in ('Taslak','Onaylandı','Hazırlanıyor','Hazır',
                                     'Kısmi Sevk','Sevk Edildi','Teslim Edildi','İptal')),
  -- Güncel revizyon numarası. Satırlar revizyona ait; bu alan "kaçıncı
  -- turdayız" sorusunu tek okumada cevaplıyor.
  current_revision integer not null default 1 check (current_revision >= 1),

  note           text,
  created_at     timestamptz not null default now(),
  created_by     uuid references app_user(id) on delete set null,
  updated_at     timestamptz not null default now(),
  constraint sales_order_no_unique unique (tenant_id, order_no),
  constraint sales_order_no_not_blank check (btrim(order_no) <> ''),
  -- Teslim, sevkten önce olamaz. Yanlış yazılmış bir tarih çifti, bütün
  -- planlama ekranını sessizce yanıltır.
  constraint sales_order_tarih_sirasi check (
    requested_ship_date is null
    or requested_delivery_date is null
    or requested_delivery_date >= requested_ship_date
  )
);

create index if not exists sales_order_tenant_ix   on sales_order (tenant_id, status);
create index if not exists sales_order_customer_ix on sales_order (customer_id, order_date desc);
create index if not exists sales_order_sevk_ix     on sales_order (tenant_id, requested_ship_date);

alter table sales_order enable row level security;
alter table sales_order force  row level security;
drop policy if exists sales_order_tenant_isolation on sales_order;
create policy sales_order_tenant_isolation on sales_order
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop trigger if exists sales_order_touch on sales_order;
create trigger sales_order_touch before update on sales_order
  for each row execute function app.touch_updated_at();

-- ── 2 · FARK KAYDI ────────────────────────────────────────────────────────
-- Revizyondan ÖNCE tanımlanıyor çünkü revizyon ona atıf yapıyor.
--
-- "Farkı açan kişi farkı fark eden kişi olmalı. Herkes ne verdiğini ve ne
-- aldığını takip etmeli. Farkı ilk fark eden bayrak kaldırmalı." (Emrah)
-- Bu yüzden `noticed_by` ve `noticed_step` ZORUNLU: bayrağı kim, nerede
-- kaldırdı. Sahibi olmayan bir bayrak, incelemesi de olmayan bir bayraktır.
create table if not exists order_discrepancy (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  order_id       uuid not null references sales_order(id) on delete restrict,
  -- Hangi sevkiyatta fark edildi (varsa). Fark üretimde de çıkabilir,
  -- o zaman sevkiyat yok.
  shipment_id    uuid references shipment(id) on delete restrict,
  stock_item_id  uuid references stock_item(id) on delete restrict,

  kind           text not null
                   check (kind in ('Eksik','Fazla','Hasarlı','Yanlış ürün')),
  -- Fark miktarı. İşaretsiz tutuluyor; yönü `kind` söylüyor.
  qty            numeric(18,6) check (qty is null or qty > 0),
  uom_code       text,

  -- Zincirin hangi halkasında fark edildi. A4B'de araç/sefer/palet gelince
  -- bu alan o formlara bağlanacak; şimdiden yerini açıyoruz ki inceleme
  -- "nerede eksilmiş" sorusuna bakabilsin.
  noticed_step   text not null
                   check (noticed_step in ('Üretim','Paketleme','Yükleme','Yolda',
                                           'Teslimde','Müşteri bildirdi','Sayımda')),
  noticed_by     uuid not null references app_user(id) on delete restrict,
  noticed_at     timestamptz not null default now(),
  description    text not null check (btrim(description) <> ''),

  status         text not null default 'Açık'
                   check (status in ('Açık','İncelemede','Karara Bağlandı')),

  -- Karar. Emrah'ın anlattığı üç yol:
  --   Tamamlanacak   → aynı siparişe ikinci sevkiyat çıkar
  --   Sorumlu Bulundu→ kim, hangi aktarımda; para tarafı demo sonrası
  --   Müşteri Hatası → sipariş revize edilir AMA bu kayda bağlı olarak
  resolution     text
                   check (resolution is null or resolution in
                          ('Tamamlanacak','Sorumlu Bulundu','Müşteri Hatası','Diğer')),
  responsible_user_id uuid references app_user(id) on delete set null,
  decision_note  text,
  decided_by     uuid references app_user(id) on delete set null,
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- "Karara Bağlandı" demek, kararın YAZILDIĞI demektir. Durumu ilerletip
  -- kararı boş bırakmak, kapatılmış ama içi boş bir inceleme üretirdi.
  constraint order_discrepancy_karar_tam check (
    status <> 'Karara Bağlandı'
    or (resolution is not null and decided_by is not null and decided_at is not null)
  )
);

create index if not exists order_discrepancy_order_ix  on order_discrepancy (order_id, status);
create index if not exists order_discrepancy_tenant_ix on order_discrepancy (tenant_id, status, noticed_at desc);

alter table order_discrepancy enable row level security;
alter table order_discrepancy force  row level security;
drop policy if exists order_discrepancy_tenant_isolation on order_discrepancy;
create policy order_discrepancy_tenant_isolation on order_discrepancy
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop trigger if exists order_discrepancy_touch on order_discrepancy;
create trigger order_discrepancy_touch before update on order_discrepancy
  for each row execute function app.touch_updated_at();

-- ── 3 · REVİZYON (EKLEMELİ) ───────────────────────────────────────────────
create table if not exists sales_order_revision (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  order_id       uuid not null references sales_order(id) on delete cascade,
  revision_no    integer not null check (revision_no >= 1),

  -- MIKTAR   → satırlar değişiyor (kalem, miktar, birim, fiyat)
  -- LOJISTIK → yalnız teslim noktası/tarih değişiyor, SATIR YOK.
  --            Emrah: "a noktasına değil b noktasına olur."
  --            Satır kopyalamıyoruz: güncel satırlar "en son SATIRLI
  --            revizyonun" satırlarıdır. Kopyalamak, aynı veriyi iki yerde
  --            tutup ayrışmasını beklemek olurdu.
  kind           text not null default 'MIKTAR'
                   check (kind in ('MIKTAR','LOJISTIK')),

  -- ⚠️ KAYNAK ZORUNLU. "Kaynağı olmayan değişiklik, sonradan sahibi olmayan
  -- değişikliktir." Telefonla kim söyledi, portaldan mı geldi.
  source         text not null
                   check (source in ('Telefon','Portal','E-posta','WhatsApp','Yüz Yüze','Sistem')),
  reason         text not null check (btrim(reason) <> ''),

  -- Sevk SONRASI miktar revizyonunda ZORUNLU (aşağıdaki tetik zorluyor).
  -- Emrah kararı 28.09: "Serbest revizyon yok."
  discrepancy_id uuid references order_discrepancy(id) on delete restrict,

  created_by     uuid references app_user(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint sales_order_revision_unique unique (order_id, revision_no)
);

create index if not exists sales_order_revision_ix on sales_order_revision (order_id, revision_no desc);

alter table sales_order_revision enable row level security;
alter table sales_order_revision force  row level security;
drop policy if exists sales_order_revision_tenant_isolation on sales_order_revision;
create policy sales_order_revision_tenant_isolation on sales_order_revision
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- ── 4 · SATIR (REVİZYONA AİT, EKLEMELİ) ───────────────────────────────────
create table if not exists sales_order_line (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  order_id       uuid not null references sales_order(id) on delete cascade,
  revision_id    uuid not null references sales_order_revision(id) on delete cascade,
  line_no        integer not null check (line_no >= 1),
  stock_item_id  uuid not null references stock_item(id) on delete restrict,

  qty            numeric(18,6) not null check (qty > 0),
  -- ⚠️ FİRMANIN KENDİ BİRİMİ. Yol haritası maddesi: "Sipariş satırı palet /
  -- koli / kg birimiyle — firmanın kendi belgesindeki birimle giriliyor."
  -- Defterin temel birimine çevirmek stok tarafının işi; sipariş, müşterinin
  -- konuştuğu dili yazar.
  uom_code       text not null check (btrim(uom_code) <> ''),

  -- Fiyat, sipariş anında `app.musteri_fiyati` ile okunup DONDURULUR (0047).
  -- Sonradan zam gelse bile bu siparişin fiyatı değişmez — fiyat defterinin
  -- eklemeli olmasının sebebi tam olarak buydu.
  unit_price     numeric(18,6) check (unit_price is null or unit_price >= 0),
  currency       text default 'TRY' check (currency is null or currency in ('TRY','USD','EUR')),

  note           text,
  created_at     timestamptz not null default now(),
  constraint sales_order_line_no_unique unique (revision_id, line_no),
  -- Aynı kalem bir revizyonda iki kez olamaz: ikisi toplanmaz, biri
  -- diğerini gizler.
  constraint sales_order_line_kalem_unique unique (revision_id, stock_item_id)
);

create index if not exists sales_order_line_order_ix on sales_order_line (order_id);
create index if not exists sales_order_line_rev_ix   on sales_order_line (revision_id, line_no);

alter table sales_order_line enable row level security;
alter table sales_order_line force  row level security;
drop policy if exists sales_order_line_tenant_isolation on sales_order_line;
create policy sales_order_line_tenant_isolation on sales_order_line
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- ── 5 · OLAY DEFTERİ ──────────────────────────────────────────────────────
-- Durum akışı ve fark kararları buraya düşer. `business_application_event`
-- (0032) ile aynı kalıp.
create table if not exists sales_order_event (
  id             bigint generated always as identity primary key,
  tenant_id      uuid not null references tenant(id) on delete restrict,
  order_id       uuid not null references sales_order(id) on delete cascade,
  kind           text not null
                   check (kind in ('AÇILDI','DURUM','REVİZYON','FARK','FARK KARARI')),
  from_status    text,
  to_status      text,
  detail         text,
  actor_id       uuid references app_user(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists sales_order_event_ix on sales_order_event (order_id, created_at);

alter table sales_order_event enable row level security;
alter table sales_order_event force  row level security;
drop policy if exists sales_order_event_okuma on sales_order_event;
create policy sales_order_event_okuma on sales_order_event
  for select using (tenant_id = app.current_tenant_id());

-- ── 6 · DEĞİŞMEZLİK ───────────────────────────────────────────────────────
-- Satır ve revizyon üstüne YAZILMAZ. 0047'deki fiyat defteriyle aynı kalıp:
-- KOMUT seviyesinde, çünkü "0 satır güncelleyen" bir UPDATE de reddedilmeli
-- ve reddedilecek olan satır değil komutun kendisidir.
create or replace function app.siparis_defteri_degismez()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Sipariş defteri değiştirilemez ve silinemez. Değişiklik '
                  'için yeni revizyon açılır; böylece kim, ne zaman, neyi '
                  'değiştirdi kayıtta kalır.'
    using errcode = 'MI403';
end;
$$;

drop trigger if exists sales_order_line_degismez on sales_order_line;
create trigger sales_order_line_degismez
  before update or delete on sales_order_line
  for each statement execute function app.siparis_defteri_degismez();

drop trigger if exists sales_order_revision_degismez on sales_order_revision;
create trigger sales_order_revision_degismez
  before update or delete on sales_order_revision
  for each statement execute function app.siparis_defteri_degismez();

drop trigger if exists sales_order_event_degismez on sales_order_event;
create trigger sales_order_event_degismez
  before update or delete on sales_order_event
  for each statement execute function app.siparis_defteri_degismez();

-- ── 7 · TUTARLILIK ────────────────────────────────────────────────────────
-- Teslim noktası siparişin müşterisine ait olmalı. Yabancı anahtarlar bunu
-- söylemiyor: iki kolon iki ayrı satıra bakıyor (0049'daki aynı ders).
create or replace function app.siparis_noktasi_tutarli()
returns trigger
language plpgsql
as $$
begin
  if new.delivery_point_id is not null
     and not exists (
       select 1 from public.delivery_point
        where id = new.delivery_point_id and customer_id = new.customer_id)
  then
    raise exception 'Teslim noktası, siparişin müşterisine ait değil.'
      using errcode = 'MI424';
  end if;
  return new;
end;
$$;

-- Fark kaydındaki kullanıcılar da BU kiracıya ait olmalı.
-- ⚠️ Bu, şemada ÜÇÜNCÜ kez aynı sınıf hata: teslim noktası (0047), sevkiyat
-- (0049), şimdi fark kaydı. Yabancı anahtar "bu kullanıcı var mı" der,
-- "bu kullanıcı bu kiracıda mı" demez. Başka kiracının personelini sorumlu
-- gösteren bir inceleme, kiracı sınırını rapor üzerinden delerdi.
create or replace function app.fark_kullanicilari_tutarli()
returns trigger
language plpgsql
as $$
declare
  v_ad text;
begin
  select string_agg(x.ad, ', ') into v_ad
    from (values ('bildiren', new.noticed_by),
                 ('sorumlu',  new.responsible_user_id),
                 ('karar veren', new.decided_by)) as x(ad, kimlik)
   where x.kimlik is not null
     and not exists (select 1 from public.app_user
                      where id = x.kimlik and tenant_id = new.tenant_id);
  if v_ad is not null then
    raise exception 'Fark kaydındaki kullanıcı başka bir kiracıya ait: %', v_ad
      using errcode = 'MI424';
  end if;
  return new;
end;
$$;

drop trigger if exists order_discrepancy_kullanici on order_discrepancy;
create trigger order_discrepancy_kullanici
  before insert or update of noticed_by, responsible_user_id, decided_by
  on order_discrepancy
  for each row execute function app.fark_kullanicilari_tutarli();

drop trigger if exists sales_order_nokta_tutarli on sales_order;
create trigger sales_order_nokta_tutarli
  before insert or update of customer_id, delivery_point_id on sales_order
  for each row execute function app.siparis_noktasi_tutarli();

-- ── 8 · DURUM GEÇİŞLERİ ───────────────────────────────────────────────────
create or replace function app.siparis_durumu_gecerli()
returns trigger
language plpgsql
as $$
declare
  v_izinli text[];
begin
  if new.status is distinct from old.status then
    v_izinli := case old.status
      when 'Taslak'       then array['Onaylandı','İptal']
      when 'Onaylandı'    then array['Hazırlanıyor','İptal']
      when 'Hazırlanıyor' then array['Hazır','İptal']
      when 'Hazır'        then array['Kısmi Sevk','Sevk Edildi','İptal']
      when 'Kısmi Sevk'   then array['Sevk Edildi','Teslim Edildi']
      when 'Sevk Edildi'  then array['Kısmi Sevk','Teslim Edildi']
      -- Teslim Edildi ve İptal son duraktır. İptalden geri dönüş yeni
      -- SİPARİŞLE olur, durumu geri çevirerek değil: iptalin izi kalsın.
      else array[]::text[]
    end;

    if not (new.status = any (v_izinli)) then
      raise exception 'Sipariş durumu % → % yapılamaz.', old.status, new.status
        using errcode = 'MI422';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sales_order_durum_gecerli on sales_order;
create trigger sales_order_durum_gecerli
  before update of status on sales_order
  for each row execute function app.siparis_durumu_gecerli();

-- ── 9 · SEVK SONRASI REVİZYON KURALI ──────────────────────────────────────
-- Emrah kararı 28.09, iki cümle:
--   "Sevk edildikten sonra 200 değil de 150 istiyorum olmaz — en başından
--    istediği şeyi üretmişim, tekrar geri nasıl döneyim?"
--   "Ama a noktasına değil b noktasına olur."
--
-- Yani sevkiyattan sonra MİKTAR revizyonu yalnız bir FARK KAYDINA bağlı
-- olabilir (inceleme sonucu "müşteri yanlış sipariş vermiş" çıktıysa);
-- LOJİSTİK revizyonu serbesttir.
create or replace function app.siparis_revizyonu_gecerli()
returns trigger
language plpgsql
as $$
declare
  v_durum text;
  v_fark_siparisi uuid;
begin
  select status into v_durum from public.sales_order where id = new.order_id;

  if v_durum in ('Kısmi Sevk','Sevk Edildi','Teslim Edildi')
     and new.kind = 'MIKTAR'
     and new.discrepancy_id is null
  then
    raise exception
      'Sevk edilmiş siparişin miktarı serbestçe değiştirilemez. İstenen mal '
      'zaten üretilip yola çıktı. Miktar ancak bir FARK KAYDINA bağlı olarak '
      'değişebilir: önce farkı açın, incelensin, kararı bu revizyona bağlayın. '
      'Teslim noktası ya da tarih değişecekse LOJİSTİK revizyonu kullanın.'
      using errcode = 'MI425';
  end if;

  -- Fark kaydı BU siparişin olmalı. Başka bir siparişin incelemesine
  -- dayanan bir revizyon, gerekçesi olmayan bir revizyondur.
  if new.discrepancy_id is not null then
    select order_id into v_fark_siparisi
      from public.order_discrepancy where id = new.discrepancy_id;
    if v_fark_siparisi is distinct from new.order_id then
      raise exception 'Revizyon, başka bir siparişin fark kaydına bağlanamaz.'
        using errcode = 'MI424';
    end if;
  end if;

  -- LOJİSTİK revizyonu satır TAŞIMAZ: güncel satırlar en son satırlı
  -- revizyondan okunur. Bu kural burada yazılamaz (satırlar revizyondan
  -- SONRA yazılıyor); satır tarafındaki tetik zorluyor.
  return new;
end;
$$;

drop trigger if exists sales_order_revizyon_gecerli on sales_order_revision;
create trigger sales_order_revizyon_gecerli
  before insert on sales_order_revision
  for each row execute function app.siparis_revizyonu_gecerli();

-- LOJİSTİK revizyonuna satır yazılamaz.
create or replace function app.lojistik_revizyonuna_satir_yazilmaz()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.sales_order_revision
              where id = new.revision_id and kind = 'LOJISTIK') then
    raise exception 'Lojistik revizyonuna satır yazılamaz. Miktar değişecekse '
                    'MİKTAR revizyonu açılmalı.'
      using errcode = 'MI422';
  end if;
  return new;
end;
$$;

drop trigger if exists sales_order_line_lojistik on sales_order_line;
create trigger sales_order_line_lojistik
  before insert on sales_order_line
  for each row execute function app.lojistik_revizyonuna_satir_yazilmaz();

-- ── 10 · GÜNCEL SATIRLAR ──────────────────────────────────────────────────
-- "Şu andaki sipariş" = EN SON SATIRLI revizyonun satırları. Lojistik
-- revizyonu satır taşımadığı için atlanıyor. Kural tek yerde: ekran da,
-- rapor da, iş emri türetme de buradan okuyacak.
create or replace function app.siparis_guncel_satirlari(p_siparis uuid)
returns table (
  line_id       uuid,
  line_no       integer,
  stock_item_id uuid,
  qty           numeric,
  uom_code      text,
  unit_price    numeric,
  currency      text,
  revision_no   integer
)
language sql
stable
as $$
  select l.id, l.line_no, l.stock_item_id, l.qty, l.uom_code,
         l.unit_price, l.currency, r.revision_no
    from public.sales_order_line l
    join public.sales_order_revision r on r.id = l.revision_id
   where l.order_id = p_siparis
     and r.revision_no = (
       select max(r2.revision_no)
         from public.sales_order_revision r2
         join public.sales_order_line l2 on l2.revision_id = r2.id
        where r2.order_id = p_siparis
     )
   order by l.line_no;
$$;

comment on function app.siparis_guncel_satirlari(uuid) is
  'Siparişin şu andaki satırları = en son SATIRLI revizyonun satırları. '
  'Lojistik revizyonu satır taşımaz, o yüzden atlanır.';

-- ── 11 · OLAY YAZIMI ──────────────────────────────────────────────────────
-- ⚠️ OLAY KAYDI AFTER TETİĞİNDE YAZILIR. BEFORE INSERT çalışırken sipariş
-- satırı HENÜZ YAZILMAMIŞTIR; yabancı anahtar haklı olarak reddeder.
-- Bu hata 0032'de bir kez yaşandı (tuzak kaydı).
create or replace function app.siparis_olayi_yaz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'sales_order' then
    if tg_op = 'INSERT' then
      insert into public.sales_order_event (tenant_id, order_id, kind, to_status, detail, actor_id)
      values (new.tenant_id, new.id, 'AÇILDI', new.status, new.order_no, new.created_by);
    elsif new.status is distinct from old.status then
      insert into public.sales_order_event (tenant_id, order_id, kind, from_status, to_status)
      values (new.tenant_id, new.id, 'DURUM', old.status, new.status);
    end if;

  elsif tg_table_name = 'sales_order_revision' then
    insert into public.sales_order_event (tenant_id, order_id, kind, detail, actor_id)
    values (new.tenant_id, new.order_id, 'REVİZYON',
            format('Rev %s · %s · kaynak: %s · %s',
                   new.revision_no, new.kind, new.source, new.reason),
            new.created_by);

  elsif tg_table_name = 'order_discrepancy' then
    if tg_op = 'INSERT' then
      insert into public.sales_order_event (tenant_id, order_id, kind, detail, actor_id)
      values (new.tenant_id, new.order_id, 'FARK',
              format('%s · %s · %s', new.kind, new.noticed_step, new.description),
              new.noticed_by);
    elsif new.status is distinct from old.status and new.status = 'Karara Bağlandı' then
      insert into public.sales_order_event (tenant_id, order_id, kind, detail, actor_id)
      values (new.tenant_id, new.order_id, 'FARK KARARI',
              format('%s · %s', new.resolution, coalesce(new.decision_note, '')),
              new.decided_by);
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists sales_order_olay on sales_order;
create trigger sales_order_olay after insert or update on sales_order
  for each row execute function app.siparis_olayi_yaz();

drop trigger if exists sales_order_revision_olay on sales_order_revision;
create trigger sales_order_revision_olay after insert on sales_order_revision
  for each row execute function app.siparis_olayi_yaz();

drop trigger if exists order_discrepancy_olay on order_discrepancy;
create trigger order_discrepancy_olay after insert or update on order_discrepancy
  for each row execute function app.siparis_olayi_yaz();

-- ── 12 · ERİŞİM ───────────────────────────────────────────────────────────
-- ⚠️ RLS ve GRANT AYRI KAPILARDIR (0006).
grant select, insert, update on sales_order       to authenticated;
grant select, insert         on sales_order_revision to authenticated;
grant select, insert         on sales_order_line     to authenticated;
grant select, insert, update on order_discrepancy to authenticated;
grant select                 on sales_order_event    to authenticated;
-- Eklemeli defterlerde güncelleme/silme yetkisi VERİLMİYOR. Tetik niyeti,
-- GRANT yetkiyi söyler; ikisi birlikte kapanır.
revoke update, delete on sales_order_revision from authenticated;
revoke update, delete on sales_order_line     from authenticated;
revoke update, delete on sales_order_event    from authenticated;

-- ── 13 · YAZMA KİLİDİ ─────────────────────────────────────────────────────
-- Beş yeni kiracı tablosu doğdu. 0047'nin dersi: kilit kendiliğinden
-- takılmıyor, çağrılıyor.
do $$
declare
  v_kilit int;
  v_eksik text;
begin
  v_kilit := app.lisans_kilidini_tak();

  select string_agg(a, ', ') into v_eksik
    from unnest(array['sales_order','sales_order_revision','sales_order_line',
                      'sales_order_event','order_discrepancy']) as a
   where not exists (
     select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
      where c.relname = a and g.tgname = 'trg_lisans_kilidi_' || a);
  if v_eksik is not null then
    raise exception '0050: yeni tabloya yazma kilidi takılmadı: %', v_eksik;
  end if;

  raise notice '0050: yazma kilidi % tabloda', v_kilit;
end;
$$;

-- ── 14 · DOĞRULAMA ────────────────────────────────────────────────────────
do $$
begin
  -- Eklemeli defter gerçekten değişmez mi? Tetiğin VAR olması yetmez.
  begin
    update sales_order_line set note = 'olmaz' where false;
    raise exception '0050: sipariş satırı güncellenebiliyor — defter değişmez değil.';
  exception when sqlstate 'MI403' then null;
  end;

  begin
    delete from sales_order_revision where false;
    raise exception '0050: revizyon silinebiliyor — defter değişmez değil.';
  exception when sqlstate 'MI403' then null;
  end;

  -- Güncel satır fonksiyonu bilinmeyen siparişte HATA VERMEMELİ: ekran
  -- henüz sipariş seçmemişken de bu yolu çağırabilir.
  perform * from app.siparis_guncel_satirlari(gen_random_uuid());

  raise notice '0050 TAMAM · sipariş defteri · revizyon eklemeli · '
               'sevk sonrası miktar farka bağlı · olay defteri kurulu';
end;
$$;
