-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0052 — VERGİ ALANLARI (fatura için ucuz sigorta)
-- ═══════════════════════════════════════════════════════════════════════════
-- Emrah 29.09, muhasebeciden aldığı bilgiler üzerine:
--   "Önce müşteri olur sonra bunlar zamanla gelir."
--
-- Katılıyoruz — ENTEGRASYON için. Fatura kesme paneli, özel entegratör
-- bağlantısı, mali mühür, KEP: hepsi müşteri bulununca yapılacak iş.
--
-- ── AMA ALANLAR ERTELENEMEZ ───────────────────────────────────────────────
-- Bugün boş bir kolon açmak beş dakika. Bir yıl canlı veriden sonra
-- "müşterilerin vergi numarası yok" demek, o bir yılın kayıtlarını elle
-- düzeltmek demektir. Bu göç yalnızca ALANLARI açıyor; hiçbir yere fatura
-- kesmiyor, hiçbir dış servise bağlanmıyor.
--
-- ── NİÇİN SEVKİYAT SATIRINDA KDV YOK ──────────────────────────────────────
-- KDV oranı FİYATIN yanında anlamlıdır. `shipment_line`'da fiyat yok —
-- irsaliye malın gittiğini söyler, parayı değil. Oraya boş bir KDV kolonu
-- açmak, hiç doldurulmayacak bir alan açmak olurdu.
--
-- ── NİÇİN VARSAYILAN ORAN YOK ─────────────────────────────────────────────
-- Gıdada tek oran yok: temel gıda %1, yeme-içme hizmeti %10, bazıları %20.
-- Varsayılan olarak %10 yazsaydık, kimsenin sorgulamadığı YANLIŞ bir sayı
-- üretirdik. Boş = "belirlenmedi" ve ekran bunu söyleyecek.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · MÜŞTERİ KARTI ─────────────────────────────────────────────────────
-- `tax_number` ve `tax_office` 0047'de zaten açılmıştı. Eksik olanlar:
alter table customer
  add column if not exists legal_name        text,
  add column if not exists city              text,
  add column if not exists district          text,
  add column if not exists kep_address       text,
  add column if not exists efatura_user      boolean,
  add column if not exists efatura_checked_on date;

comment on column customer.legal_name is
  'Resmî ünvan (faturada yazan). `name` günlük kullanılan kısa addır; '
  'ikisi farklı olabilir ve faturaya resmî olan yazılır.';
comment on column customer.kep_address is
  'Kayıtlı Elektronik Posta — firmanın resmî tebligat adresi.';
comment on column customer.efatura_user is
  'Alıcı e-Fatura mükellefi mi. BOŞ = bilinmiyor. Bu bilgi GİB listesinden '
  'doğrulanır; burada yalnız SONUCU saklıyoruz.';
comment on column customer.efatura_checked_on is
  'efatura_user bilgisinin hangi tarihte kontrol edildiği. BOŞSA bayrağa '
  'GÜVENİLMEZ: mükellefiyet sonradan başlar, eski bir "hayır" yanlıştır.';

-- VKN 10, TCKN 11 hane. Yanlış uzunluktaki bir numara faturayı reddettirir
-- ve bu ancak fatura kesilirken anlaşılır — o yüzden girişte durduruyoruz.
--
-- ⚠️ `not valid`: bu göç ESKİ satırları sınamıyor. Yanlış yazılmış eski bir
-- numara yüzünden göçün durması, düzeltme imkânını da kilitlerdi. Yeni ve
-- güncellenen satırlar kısıttan geçer.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customer_vergi_no_bicimi') then
    alter table customer add constraint customer_vergi_no_bicimi
      check (tax_number is null or tax_number ~ '^[0-9]{10,11}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customer_kep_bicimi') then
    alter table customer add constraint customer_kep_bicimi
      check (kep_address is null or kep_address like '%@%') not valid;
  end if;
end;
$$;

-- Eski satırlar temizse kısıtları tam geçerli yapmayı DENİYORUZ; değilse
-- sessizce geçmiyoruz, söylüyoruz.
do $$
begin
  begin
    alter table customer validate constraint customer_vergi_no_bicimi;
    raise notice '0052: vergi no kısıtı eski satırlarda da geçerli.';
  exception when others then
    raise notice '0052: ⚠ ESKİ satırlarda bozuk vergi no var, kısıt yalnız '
                 'yeni kayıtlarda geçerli. Düzeltme sorgusu: '
                 'select id, code, name, tax_number from customer '
                 'where tax_number !~ ''^[0-9]{10,11}$'';';
  end;
  begin
    alter table customer validate constraint customer_kep_bicimi;
  exception when others then
    raise notice '0052: ⚠ ESKİ satırlarda bozuk KEP adresi var.';
  end;
end;
$$;

-- Aynı vergi numarası iki müşteri kartında olamaz. 0049'un çözdüğü sorunun
-- aynısı: aynı firmayı iki kart yapmak, borcu da geçmişi de ikiye böler.
create unique index if not exists customer_vergi_no_unique
  on customer (tenant_id, tax_number)
  where tax_number is not null;

-- ── 2 · KALEMİN KDV ORANI ─────────────────────────────────────────────────
alter table stock_item
  add column if not exists vat_rate numeric(5,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stock_item_kdv_araligi') then
    alter table stock_item add constraint stock_item_kdv_araligi
      check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100));
  end if;
end;
$$;

comment on column stock_item.vat_rate is
  'Kalemin GÜNCEL KDV oranı (%). BOŞ = belirlenmedi; varsayılan yazmıyoruz '
  'çünkü gıdada tek oran yok (temel gıda %1, yeme-içme %10, bazıları %20). '
  'Belgeye yazılan oran bu değil, satırda DONMUŞ olandır.';

-- Sabit bir liste (0/1/10/20) YAZMIYORUZ: oranlar devlet kararıyla değişir
-- ve o gün göç yazmak zorunda kalırdık. Aralık kontrolü yeter.

-- ── 3 · SİPARİŞ SATIRINDA DONMUŞ ORAN ─────────────────────────────────────
-- Fiyat defterindeki kuralın aynısı: oran yarın değişirse DÜNKÜ belge
-- değişmemeli. `sales_order_line` zaten değişmez (0050); oranı oraya
-- yazınca o da donuyor.
alter table sales_order_line
  add column if not exists vat_rate numeric(5,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sales_order_line_kdv_araligi') then
    alter table sales_order_line add constraint sales_order_line_kdv_araligi
      check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100));
  end if;
end;
$$;

comment on column sales_order_line.vat_rate is
  'Siparişin yazıldığı andaki KDV oranı — DONMUŞ. Kalemin oranı sonradan '
  'değişse bile bu satır değişmez.';

-- Oranı kullanıcıya YAZDIRMIYORUZ. Emrah''ın kuralı: "Sistem üretsin daha
-- stabil olur, uğraştırmayalım insanları."
--
-- ⚠️ BEFORE tetiği, çünkü YAZILMAKTA OLAN satırı değiştiriyor — başka bir
-- tabloya yazmıyor, yalnız OKUYOR. Başka tabloya yazsaydı AFTER olmak
-- zorundaydı (0032 tuzağı).
create or replace function app.siparis_satiri_kdv_donsun()
returns trigger
language plpgsql
as $$
begin
  if new.vat_rate is null then
    select si.vat_rate into new.vat_rate
      from public.stock_item si
     where si.id = new.stock_item_id;
  end if;
  return new;
end;
$$;

comment on function app.siparis_satiri_kdv_donsun() is
  'Sipariş satırı yazılırken KDV oranını kalem kartından KOPYALAR. '
  'Açıkça bir oran verilmişse ona dokunmaz.';

drop trigger if exists sales_order_line_kdv on sales_order_line;
create trigger sales_order_line_kdv
  before insert on sales_order_line
  for each row execute function app.siparis_satiri_kdv_donsun();

-- Yeni KİRACI TABLOSU eklenmedi (yalnız kolon), `app.lisans_kilidini_tak()`
-- çağrılmıyor: `customer`, `stock_item` ve `sales_order_line` kilitleri
-- zaten takılı ve kolon eklemek onları düşürmez.

-- ── 4 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare
  v_eksik text;
begin
  select string_agg(a, ', ') into v_eksik from unnest(array[
    'legal_name','city','district','kep_address','efatura_user','efatura_checked_on'
  ]) a
  where not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='customer' and column_name=a);
  if v_eksik is not null then
    raise exception '0052: customer kolonları açılmadı: %', v_eksik;
  end if;

  if not exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='stock_item' and column_name='vat_rate') then
    raise exception '0052: stock_item.vat_rate açılmadı.';
  end if;
  if not exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='sales_order_line' and column_name='vat_rate') then
    raise exception '0052: sales_order_line.vat_rate açılmadı.';
  end if;

  if not exists (select 1 from pg_trigger
      where tgrelid='public.sales_order_line'::regclass
        and tgname='sales_order_line_kdv' and not tgisinternal) then
    raise exception '0052: KDV dondurma tetiği takılmadı.';
  end if;

  if not exists (select 1 from pg_indexes
      where schemaname='public' and indexname='customer_vergi_no_unique') then
    raise exception '0052: vergi no tekillik indeksi kurulmadı.';
  end if;

  raise notice '0052 TAMAM · vergi alanları açıldı · KDV oranı satırda donuyor · fatura kesilmiyor';
end;
$$;
