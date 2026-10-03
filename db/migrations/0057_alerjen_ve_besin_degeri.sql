-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0057 — ALERJEN VE BESİN DEĞERİ (A4B temeli)
-- ═══════════════════════════════════════════════════════════════════════════
-- Yol haritası maddeleri:
--   · "Malzemede besin değeri ve alerjen"  → Veri TEK yerde: stok kartında
--   · "Reçetede alerjen beyanı"            → Mamulün alerjenleri reçete
--                                             satırlarından TÜRETİLİYOR
--   · "Mamulün besin değeri reçeteden türetiliyor" → Hiçbir yerde ikinci kez
--                                             girilmiyor
--
-- ── NİÇİN ŞİMDİ ───────────────────────────────────────────────────────────
-- Demo gıda mühendislerine yapılacak. Soracakları ilk şey izlenebilirlik
-- değil, ALERJEN olacak: yanlış alerjen beyanı insan hayatına mal olur ve
-- yasal sorumluluğu doğrudandır (Türk Gıda Kodeksi Gıda Etiketleme ve
-- Tüketicileri Bilgilendirme Yönetmeliği).
--
-- ── TEK CÜMLELİK KARAR ────────────────────────────────────────────────────
-- ALERJEN VE BESİN DEĞERİ MAMULE ELLE YAZILMAZ; MALZEMEDEN TÜRETİLİR.
-- Elle yazılsaydı, reçete değişince etiket eski kalırdı — ve bunu kimse fark
-- etmezdi. Bu ürünün bütün defter kararlarıyla aynı mantık.
--
-- ── ⚠️ EN ÖNEMLİ KARAR: YARIM HESAP YOK ───────────────────────────────────
-- Bir malzemenin besin değeri girilmemişse ya da birimi grama çevrilemiyorsa,
-- mamulün besin değeri HESAPLANMAZ. Eksik veriyle hesaplanmış bir tablo,
-- etikete basıldığında YANLIŞ BEYANDIR. Fonksiyon sayı yerine EKSİK OLANIN
-- LİSTESİNİ döndürüyor.
--
-- Alerjen tarafı farklı: orada eksik veri "alerjen yok" demek DEĞİLDİR, ama
-- türetme yine de çalışır — çünkü bir malzemenin alerjeni varsa beyan
-- edilmiştir. Yine de hangi malzemelerin hiç incelenmediği ayrıca söyleniyor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · ALERJEN LİSTESİ (MEVZUAT · kiracıdan bağımsız) ────────────────────
-- Türk Gıda Kodeksi'nin 14 grubu. `uom` ve `permission` gibi REFERANS
-- tablosu: kiracıya ait değil, herkes aynısını kullanır.
create table if not exists allergen (
  code        text primary key,
  name        text not null,
  sort_order  smallint not null,
  note        text
);

insert into allergen (code, name, sort_order, note) values
  ('GLUTEN',   'Gluten içeren tahıllar',        1,  'Buğday, çavdar, arpa, yulaf ve bunların ürünleri'),
  ('KABUKLU',  'Kabuklular',                    2,  'Karides, yengeç, istakoz ve ürünleri'),
  ('YUMURTA',  'Yumurta',                       3,  null),
  ('BALIK',    'Balık',                         4,  null),
  ('YERFISTIGI','Yer fıstığı',                  5,  null),
  ('SOYA',     'Soya fasulyesi',                6,  null),
  ('SUT',      'Süt (laktoz dâhil)',            7,  null),
  ('SERTKABUK','Sert kabuklu meyveler',         8,  'Badem, fındık, ceviz, kaju, antep fıstığı, pekan, brezilya fıstığı, makadamya'),
  ('KEREVIZ',  'Kereviz',                       9,  null),
  ('HARDAL',   'Hardal',                        10, null),
  ('SUSAM',    'Susam',                         11, null),
  ('SULFIT',   'Kükürt dioksit ve sülfitler',   12, '10 mg/kg üzerindeki derişimlerde'),
  ('LUPEN',    'Acı bakla (lüpen)',             13, null),
  ('YUMUSAKCA','Yumuşakçalar',                  14, 'Midye, salyangoz, ahtapot ve ürünleri')
on conflict (code) do update
  set name = excluded.name, sort_order = excluded.sort_order, note = excluded.note;

alter table allergen enable row level security;
drop policy if exists allergen_read_all on allergen;
create policy allergen_read_all on allergen for select using (true);
grant select on allergen to authenticated, anon;

-- ── 2 · STOK KARTINDA ALERJEN ─────────────────────────────────────────────
-- ⚠️ "İÇERİR" ile "İZ" HUKUKEN FARKLIDIR. "İçerir" bileşendir; "iz" çapraz
-- bulaşma ihtimalidir. İkisini tek alana koymak, ya gereksiz korkutmak ya da
-- gerçek bir riski gizlemek olurdu.
create table if not exists stock_item_allergen (
  tenant_id     uuid not null references tenant(id) on delete restrict,
  stock_item_id uuid not null references stock_item(id) on delete cascade,
  allergen_code text not null references allergen(code) on delete restrict,
  kind          text not null default 'İÇERİR' check (kind in ('İÇERİR','İZ')),
  note          text,
  created_at    timestamptz not null default now(),
  primary key (stock_item_id, allergen_code)
);

create index if not exists stock_item_allergen_ix on stock_item_allergen (tenant_id, stock_item_id);

alter table stock_item_allergen enable row level security;
alter table stock_item_allergen force  row level security;
drop policy if exists stock_item_allergen_tenant_isolation on stock_item_allergen;
create policy stock_item_allergen_tenant_isolation on stock_item_allergen
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- ── 3 · AMBALAJ İÇERİĞİ (gramaj) ──────────────────────────────────────────
-- "1 koli kaç kg" sorusunun cevabı. İki yerde lazım: etiketteki GRAMAJ ve
-- adet/koli cinsinden malzemenin grama çevrilmesi.
alter table stock_item
  add column if not exists net_qty numeric(18,6),
  add column if not exists net_uom text references uom(code);

comment on column stock_item.net_qty is
  'Ambalajın net içeriği (0057). "1 koli = 5 kg" gibi. Etiketteki gramaj ve '
  'adet/koli cinsinden malzemenin grama çevrilmesi buna dayanıyor.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stock_item_net_tam') then
    alter table stock_item add constraint stock_item_net_tam
      check ((net_qty is null and net_uom is null)
          or (net_qty is not null and net_uom is not null and net_qty > 0));
  end if;
end;
$$;

-- ── 4 · STOK KARTINDA BESİN DEĞERİ ────────────────────────────────────────
-- Zorunlu beslenme bildirimi: enerji (kJ ve kcal), yağ, doymuş yağ,
-- karbonhidrat, şeker, protein, tuz — 100 g ya da 100 ml üzerinden.
create table if not exists stock_item_nutrition (
  stock_item_id   uuid primary key references stock_item(id) on delete cascade,
  tenant_id       uuid not null references tenant(id) on delete restrict,
  basis           text not null default '100g' check (basis in ('100g','100ml')),
  energy_kj       numeric(10,2),
  energy_kcal     numeric(10,2),
  fat             numeric(10,3),
  saturated_fat   numeric(10,3),
  carbohydrate    numeric(10,3),
  sugars          numeric(10,3),
  protein         numeric(10,3),
  salt            numeric(10,3),
  -- Veri nereden geldi: tedarikçi spesifikasyonu, analiz raporu, tablo.
  -- Kaynağı yazılmayan bir besin değeri, denetimde savunulamaz.
  source          text,
  updated_at      timestamptz not null default now(),

  -- Fizik: doymuş yağ yağın içindedir, şeker karbonhidratın içindedir.
  constraint nutrition_doymus_mantikli
    check (saturated_fat is null or fat is null or saturated_fat <= fat),
  constraint nutrition_seker_mantikli
    check (sugars is null or carbohydrate is null or sugars <= carbohydrate),
  constraint nutrition_eksi_olmaz
    check (coalesce(energy_kj,0) >= 0 and coalesce(energy_kcal,0) >= 0
       and coalesce(fat,0) >= 0 and coalesce(saturated_fat,0) >= 0
       and coalesce(carbohydrate,0) >= 0 and coalesce(sugars,0) >= 0
       and coalesce(protein,0) >= 0 and coalesce(salt,0) >= 0)
);

create index if not exists stock_item_nutrition_ix on stock_item_nutrition (tenant_id);

alter table stock_item_nutrition enable row level security;
alter table stock_item_nutrition force  row level security;
drop policy if exists stock_item_nutrition_tenant_isolation on stock_item_nutrition;
create policy stock_item_nutrition_tenant_isolation on stock_item_nutrition
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- Kart kiracıya ait olmalı (MI424 sınıfı — yedinci kez).
create or replace function app.kalem_eki_tutarli()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.stock_item
                  where id = new.stock_item_id and tenant_id = new.tenant_id) then
    raise exception 'Stok kalemi bu işletmeye ait değil.' using errcode = 'MI424';
  end if;
  return new;
end;
$$;

drop trigger if exists stock_item_allergen_tutarli on stock_item_allergen;
create trigger stock_item_allergen_tutarli
  before insert or update on stock_item_allergen
  for each row execute function app.kalem_eki_tutarli();

drop trigger if exists stock_item_nutrition_tutarli on stock_item_nutrition;
create trigger stock_item_nutrition_tutarli
  before insert or update on stock_item_nutrition
  for each row execute function app.kalem_eki_tutarli();

drop trigger if exists stock_item_nutrition_touch on stock_item_nutrition;
create trigger stock_item_nutrition_touch before update on stock_item_nutrition
  for each row execute function app.touch_updated_at();

-- "Alerjeni incelendi" damgası. Boş alerjen listesi ile incelenmemiş kalem
-- ancak böyle ayrılır.
alter table stock_item
  add column if not exists allergen_reviewed_at timestamptz,
  add column if not exists allergen_reviewed_by uuid references app_user(id) on delete set null;

comment on column stock_item.allergen_reviewed_at is
  'Bu kalemin alerjenleri İNCELENDİ damgası (0057). BOŞ = bakılmamış. '
  'Alerjen satırı olmaması "alerjen yok" demek DEĞİLDİR.';

-- ── 5 · MAMULÜN ALERJENLERİ — REÇETEDEN TÜRETİLİYOR ───────────────────────
-- ⚠️ Özyinelemeli: bir malzeme kendisi de üretilmiş bir yarı mamul olabilir
-- (ara ürün). Tek seviye bakan bir sorgu, çorbanın içindeki sosun içindeki
-- unu GÖRMEZ ve glüteni kaçırır.
--
-- ⚠️ DÖNGÜ KORUMASI: A'nın reçetesinde B, B'nin reçetesinde A varsa sorgu
-- sonsuza gider. Yol dizisi tutuluyor.
create or replace function app.mamul_alerjenleri(p_kalem uuid)
returns table (
  kod        text,
  ad         text,
  tur        text,     -- 'İÇERİR' her zaman 'İZ'i yener
  kaynaklar  text[]    -- hangi malzemelerden geldiği
)
language sql
stable
set search_path = ''
as $$
  with recursive agac as (
    select p_kalem as kalem_id, array[p_kalem] as yol, 0 as derinlik
    union all
    select rl.stock_item_id, a.yol || rl.stock_item_id, a.derinlik + 1
      from agac a
      join public.recipe r
        on r.output_item_id = a.kalem_id and r.status = 'ACTIVE'
      join public.recipe_line rl on rl.recipe_id = r.id
     -- Döngü koruması ve makul derinlik sınırı.
     where not (rl.stock_item_id = any (a.yol))
       and a.derinlik < 10
  ),
  beyan as (
    select distinct sia.allergen_code, sia.kind, si.name as kaynak
      from agac a
      join public.stock_item_allergen sia on sia.stock_item_id = a.kalem_id
      join public.stock_item si on si.id = a.kalem_id
  )
  select
    al.code,
    al.name,
    -- "İÇERİR" varsa "İZ" yazmak, gerçek bir riski küçük göstermek olurdu.
    case when bool_or(b.kind = 'İÇERİR') then 'İÇERİR' else 'İZ' end,
    array_agg(distinct b.kaynak order by b.kaynak)
    from beyan b
    join public.allergen al on al.code = b.allergen_code
   group by al.code, al.name, al.sort_order
   order by al.sort_order;
$$;

comment on function app.mamul_alerjenleri(uuid) is
  'Mamulün alerjenleri, reçete ağacının TAMAMINDAN türetilir (yarı mamuller '
  'dâhil). "İÇERİR" her zaman "İZ"i yener. Kaynak malzemeler de döner: '
  'denetimde "bu nereden geliyor" sorusunun cevabı.';

-- Hangi malzemelerin alerjeni HİÇ İNCELENMEMİŞ olduğu ayrı bir sorudur.
-- "Alerjen yok" ile "bakılmamış" aynı şey değildir ve etiket bu farkı
-- gizleyemez.
create or replace function app.mamul_alerjen_eksikleri(p_kalem uuid)
returns table (kalem_id uuid, kalem_adi text)
language sql
stable
set search_path = ''
as $$
  with recursive agac as (
    select p_kalem as kalem_id, array[p_kalem] as yol, 0 as derinlik
    union all
    select rl.stock_item_id, a.yol || rl.stock_item_id, a.derinlik + 1
      from agac a
      join public.recipe r
        on r.output_item_id = a.kalem_id and r.status = 'ACTIVE'
      join public.recipe_line rl on rl.recipe_id = r.id
     where not (rl.stock_item_id = any (a.yol)) and a.derinlik < 10
  )
  select distinct si.id, si.name
    from agac a
    join public.stock_item si on si.id = a.kalem_id
   where si.allergen_reviewed_at is null
     -- Kendisi üretilen bir yarı mamulün alerjeni zaten reçetesinden gelir;
     -- ondan ayrıca beyan beklemiyoruz.
     and not exists (select 1 from public.recipe r
                      where r.output_item_id = si.id and r.status = 'ACTIVE')
   order by si.name;
$$;

-- ── 5B · TUZAK 44 İKİNCİ KEZ: `app.convert_uom` NİTELİKSİZDİ ─────────────
-- ⚠️ PROVADA BULUNAN GERÇEK HATA. 0002'deki `app.convert_uom` gövdesinde
-- `uom_conversion` niteliksiz yazılmış ve fonksiyonun kendi `search_path`i
-- yok. Aşağıdaki `app.kalem_gram` `set search_path = ''` ile yazıldığı için
-- (doğru olan bu), çağrılan fonksiyon boş yolu miras alıyor ve HER
-- dönüşümde "relation uom_conversion does not exist" veriyor.
--
-- Sonuç sessizdi: `kalem_gram` hatayı yutup null döndürüyordu ve ekran
-- "kg grama çevrilemiyor" diyordu. Doğru görünen, tamamen yanlış bir cümle.
--
-- Aynı ders 0054'te `musteri_fiyati` için yaşandı. Bu ikinci kez: SERTLEŞMİŞ
-- BİR FONKSİYONUN ÇAĞIRDIĞI HER FONKSİYON DA NİTELİKLİ OLMAK ZORUNDA.
create or replace function app.convert_uom(
  p_qty numeric, p_from_uom text, p_to_uom text
)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  v_factor numeric;
begin
  if p_from_uom = p_to_uom then
    return p_qty;
  end if;

  select factor into v_factor
    from public.uom_conversion
   where from_uom = p_from_uom and to_uom = p_to_uom;

  if v_factor is null then
    raise exception 'Birim dönüşümü tanımlı değil: % → %', p_from_uom, p_to_uom
      using errcode = 'data_exception';
  end if;

  return p_qty * v_factor;
end $$;

-- ── 6 · GRAMA ÇEVİRME ─────────────────────────────────────────────────────
-- MASS birimleri doğrudan çevrilir. COUNT birimleri (koli, adet, tepsi)
-- ancak kartta ambalaj içeriği yazılıysa çevrilebilir. VOLUME çevrilmez:
-- yoğunluk bilgisi yok ve tahmin etmek beyan hatasıdır.
create or replace function app.kalem_gram(p_kalem uuid, p_miktar numeric, p_birim text)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  v_boyut text;
  v_net_qty numeric;
  v_net_uom text;
begin
  select dimension into v_boyut from public.uom where code = p_birim;
  if v_boyut = 'MASS' then
    return app.convert_uom(p_miktar, p_birim, 'g');
  end if;

  if v_boyut = 'COUNT' then
    select net_qty, net_uom into v_net_qty, v_net_uom
      from public.stock_item where id = p_kalem;
    if v_net_qty is null then return null; end if;
    if (select dimension from public.uom where code = v_net_uom) <> 'MASS' then
      return null;
    end if;
    return app.convert_uom(v_net_qty * p_miktar, v_net_uom, 'g');
  end if;

  -- VOLUME: yoğunluk bilinmiyor. Tahmin YAPILMIYOR.
  return null;
exception
  -- ⚠️ YALNIZ "dönüşüm tanımlı değil" yutuluyor. `when others` yazsaydık
  -- gerçek bir hata (yanlış şema, bozuk veri) "bilinmiyor" gibi görünür ve
  -- provada bulunamazdı — bu göçte tam olarak o oldu.
  when data_exception then return null;
end;
$$;

-- ── 7 · MAMULÜN BESİN DEĞERİ ──────────────────────────────────────────────
-- ⚠️ ÖZYİNELEMELİ. Bir malzeme kendisi de üretilmiş bir yarı mamul olabilir
-- (sos, harç, baz). Onun besin değeri kartında YAZMAZ — kendi reçetesinden
-- türer. Tek seviye bakan bir hesap, gerçek bir mutfakta neredeyse hiç
-- çalışmaz: endüstriyel mutfakta her şey bir yarı mamulden geçer.
--
-- Yol haritası ölçütü zaten bunu söylüyor: "Hiçbir yerde ikinci kez
-- girilmiyor; reçete değişince tablo değişiyor."
--
-- ⚠️ YARIM HESAP YOK. Bir dal çözülemiyorsa SAYI DÖNMÜYOR. Eksik veriyle
-- hesaplanmış tablo, etikete basıldığında yanlış beyandır.

-- 100 g kalem başına besin değeri: ya kartta yazılı, ya reçetesinden türer.
create or replace function app.kalem_besin_100g(p_kalem uuid, p_derinlik int default 0)
returns table (
  energy_kj numeric, energy_kcal numeric, fat numeric, saturated_fat numeric,
  carbohydrate numeric, sugars numeric, protein numeric, salt numeric
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_rec   record;
  v_gram  numeric;
  v_cikti numeric;
  v_alt   record;
  v_tkj numeric := 0; v_tkcal numeric := 0; v_tfat numeric := 0; v_tsat numeric := 0;
  v_tcarb numeric := 0; v_tsug numeric := 0; v_tpro numeric := 0; v_tsalt numeric := 0;
begin
  -- 1) Kartta yazılıysa o geçerlidir. Elle girilen değer, türetilene üstündür:
  --    tedarikçi analiz raporu varken hesap yapmak, raporu yok saymak olurdu.
  return query
    select n.energy_kj, n.energy_kcal, n.fat, n.saturated_fat,
           n.carbohydrate, n.sugars, n.protein, n.salt
      from public.stock_item_nutrition n
     where n.stock_item_id = p_kalem;
  if found then return; end if;

  if p_derinlik >= 10 then return; end if;

  -- 2) Yazılı değilse reçetesinden türet.
  select r.id, r.output_qty, r.output_uom into v_rec
    from public.recipe r
   where r.output_item_id = p_kalem and r.status = 'ACTIVE'
   order by r.created_at desc limit 1;
  if v_rec.id is null then return; end if;

  v_cikti := app.kalem_gram(p_kalem, v_rec.output_qty, v_rec.output_uom);
  if v_cikti is null or v_cikti <= 0 then return; end if;

  for v_alt in
    select rl.stock_item_id as kid, rl.qty, rl.uom
      from public.recipe_line rl where rl.recipe_id = v_rec.id
  loop
    v_gram := app.kalem_gram(v_alt.kid, v_alt.qty, v_alt.uom);
    -- Bir dal çözülemiyorsa TAMAMEN vazgeçiyoruz.
    if v_gram is null then return; end if;

    declare v_b record;
    begin
      select * into v_b from app.kalem_besin_100g(v_alt.kid, p_derinlik + 1);
      if v_b.energy_kcal is null and v_b.protein is null then return; end if;

      v_tkj   := v_tkj   + coalesce(v_b.energy_kj,0)     * v_gram / 100.0;
      v_tkcal := v_tkcal + coalesce(v_b.energy_kcal,0)   * v_gram / 100.0;
      v_tfat  := v_tfat  + coalesce(v_b.fat,0)           * v_gram / 100.0;
      v_tsat  := v_tsat  + coalesce(v_b.saturated_fat,0) * v_gram / 100.0;
      v_tcarb := v_tcarb + coalesce(v_b.carbohydrate,0)  * v_gram / 100.0;
      v_tsug  := v_tsug  + coalesce(v_b.sugars,0)        * v_gram / 100.0;
      v_tpro  := v_tpro  + coalesce(v_b.protein,0)       * v_gram / 100.0;
      v_tsalt := v_tsalt + coalesce(v_b.salt,0)          * v_gram / 100.0;
    end;
  end loop;

  return query select
    round(v_tkj   / v_cikti * 100, 2),
    round(v_tkcal / v_cikti * 100, 2),
    round(v_tfat  / v_cikti * 100, 3),
    round(v_tsat  / v_cikti * 100, 3),
    round(v_tcarb / v_cikti * 100, 3),
    round(v_tsug  / v_cikti * 100, 3),
    round(v_tpro  / v_cikti * 100, 3),
    round(v_tsalt / v_cikti * 100, 3);
end;
$$;

comment on function app.kalem_besin_100g(uuid, int) is
  '100 g kalem başına besin değeri. Önce kartta yazılı değere bakar '
  '(tedarikçi raporu hesaptan üstündür), yoksa aktif reçetesinden ÖZYİNELEMELİ '
  'türetir. Bir dal çözülemiyorsa HİÇ satır dönmez.';

-- Neyin eksik olduğu — ekranın "şunu gir" diyebilmesi için.
-- ⚠️ Çözülebilen bir yarı mamul EKSİK SAYILMAZ: kendi reçetesinden türüyor.
create or replace function app.mamul_besin_eksikleri(p_kalem uuid)
returns table (kalem_id uuid, kalem_adi text, sebep text)
language sql
stable
set search_path = ''
as $$
  with recursive agac as (
    select p_kalem as kid, array[p_kalem] as yol, 0 as derinlik
    union all
    select rl.stock_item_id, a.yol || rl.stock_item_id, a.derinlik + 1
      from agac a
      join public.recipe r on r.output_item_id = a.kid and r.status = 'ACTIVE'
      join public.recipe_line rl on rl.recipe_id = r.id
     where not (rl.stock_item_id = any (a.yol)) and a.derinlik < 10
  ),
  -- Reçete satırlarının grama çevrilebilirliği, satırın KENDİ biriminde
  -- sorulmalı: aynı kalem başka reçetede başka birimle geçebilir.
  satir as (
    select distinct rl.stock_item_id as kid, rl.qty, rl.uom
      from agac a
      join public.recipe r on r.output_item_id = a.kid and r.status = 'ACTIVE'
      join public.recipe_line rl on rl.recipe_id = r.id
  )
  select si.id, si.name,
         case when app.kalem_gram(si.id, s.qty, s.uom) is null
              then s.uom || ' grama çevrilemiyor (ambalaj içeriği girilmemiş olabilir)'
              else 'besin değeri girilmemiş ve reçetesinden türetilemiyor'
         end
    from satir s
    join public.stock_item si on si.id = s.kid
   where app.kalem_gram(si.id, s.qty, s.uom) is null
      or not exists (select 1 from app.kalem_besin_100g(si.id) b
                      where b.energy_kcal is not null or b.protein is not null)
   order by si.name;
$$;

create or replace function app.mamul_besin_degeri(p_kalem uuid)
returns table (
  basis         text,
  energy_kj     numeric,
  energy_kcal   numeric,
  fat           numeric,
  saturated_fat numeric,
  carbohydrate  numeric,
  sugars        numeric,
  protein       numeric,
  salt          numeric
)
language sql
stable
set search_path = ''
as $$
  select '100g'::text, b.energy_kj, b.energy_kcal, b.fat, b.saturated_fat,
         b.carbohydrate, b.sugars, b.protein, b.salt
    from app.kalem_besin_100g(p_kalem) b;
$$;

comment on function app.mamul_besin_degeri(uuid) is
  '100 g mamul başına besin değeri, reçete ağacından TÜRETİLİR. Bir dal '
  'çözülemiyorsa HİÇ SATIR DÖNMEZ — eksik veriyle hesaplanmış tablo, '
  'etikette yanlış beyandır. Neyin eksik olduğunu '
  '`app.mamul_besin_eksikleri()` söyler.';

-- ── 8 · DIŞ KAPILAR ───────────────────────────────────────────────────────
create or replace function public.mamul_alerjenleri(p_kalem uuid)
returns table (kod text, ad text, tur text, kaynaklar text[])
language sql stable as $$ select * from app.mamul_alerjenleri(p_kalem); $$;

create or replace function public.mamul_alerjen_eksikleri(p_kalem uuid)
returns table (kalem_id uuid, kalem_adi text)
language sql stable as $$ select * from app.mamul_alerjen_eksikleri(p_kalem); $$;

create or replace function public.mamul_besin_degeri(p_kalem uuid)
returns table (basis text, energy_kj numeric, energy_kcal numeric, fat numeric,
               saturated_fat numeric, carbohydrate numeric, sugars numeric,
               protein numeric, salt numeric)
language sql stable as $$ select * from app.mamul_besin_degeri(p_kalem); $$;

create or replace function public.mamul_besin_eksikleri(p_kalem uuid)
returns table (kalem_id uuid, kalem_adi text, sebep text)
language sql stable as $$ select * from app.mamul_besin_eksikleri(p_kalem); $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.mamul_alerjenleri(uuid)','public.mamul_alerjen_eksikleri(uuid)',
    'public.mamul_besin_degeri(uuid)','public.mamul_besin_eksikleri(uuid)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke all on function %s from anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

grant select, insert, update, delete on stock_item_allergen  to authenticated;
grant select, insert, update, delete on stock_item_nutrition to authenticated;

-- ── 9 · DENETİM ───────────────────────────────────────────────────────────
-- Alerjen beyanı DEĞİŞTİRİLEBİLİR bir veridir ve yanlış değiştirilmesi insan
-- sağlığına dokunur. Kim ne zaman değiştirdi, kayıtta kalmalı.
do $$
declare
  t text;
  izlenecek text[] := array[
    'stock_item_allergen', 'stock_item_nutrition'
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

-- ── 10 · YAZMA KİLİDİ ─────────────────────────────────────────────────────
do $$
declare v_eksik text;
begin
  perform app.lisans_kilidini_tak();
  select string_agg(a, ', ') into v_eksik
    from unnest(array['stock_item_allergen','stock_item_nutrition']) as a
   where not exists (
     select 1 from pg_trigger t
      where t.tgrelid = ('public.' || a)::regclass
        and t.tgname = 'trg_lisans_kilidi_' || a and not t.tgisinternal);
  if v_eksik is not null then
    raise exception '0057: lisans kilidi takılmayan tablo: %', v_eksik;
  end if;
end;
$$;

-- ── 11 · DOĞRULAMA ────────────────────────────────────────────────────────
do $$
declare v_say int;
begin
  select count(*) into v_say from allergen;
  if v_say <> 14 then raise exception '0057: alerjen listesi % satır (14 bekleniyordu).', v_say; end if;

  if to_regclass('public.stock_item_allergen') is null
     or to_regclass('public.stock_item_nutrition') is null then
    raise exception '0057: tablolar kurulmadı.';
  end if;

  if has_function_privilege('anon','public.mamul_besin_degeri(uuid)','execute') then
    raise exception '0057: anon besin değerini okuyabiliyor.';
  end if;

  raise notice '0057 TAMAM · 14 alerjen · alerjen ve besin değeri reçeteden türetiliyor · yarım hesap yok';
end;
$$;
