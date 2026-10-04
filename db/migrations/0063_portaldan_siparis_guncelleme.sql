-- ═══════════════════════════════════════════════════════════════════════════
-- 0063 · PORTALDAN SİPARİŞ GÜNCELLEME
-- ---------------------------------------------------------------------------
-- Yol haritası (A4C): *"Portaldan sipariş girme ve güncelleme — Firma
-- onayına düşüyor."* Girme 0054'te açıldı; GÜNCELLEME eksikti.
--
-- Emrah'ın bu aşamayı anlatan cümlesi: *"Müşteri sipariş veriyor,
-- hazırlanırken defalarca değiştiriyor."* Bu göç o cümlenin portal ayağıdır.
--
-- ── NE YAZILMADI, BİLEREK ─────────────────────────────────────────────────
-- Yeni bir kural YOK. Defterin kuralları zaten yazılıydı; portal onlara
-- BAĞLANIYOR:
--   0050 · revizyon EKLEMELİ — hiçbir satır üstüne yazılmaz
--   0050 · MI425 — sevk edilmiş siparişin miktarı serbestçe değişmez
--   0055 · MİKTAR revizyonu onayları düşürür, sipariş "Onay Bekliyor"a döner
--          ve verilen SÖZ silinir (eski söz eski miktara verilmişti)
-- Portal bu üçünü yeniden yazmıyor; tetikleyiciler kendiliğinden işliyor.
--
-- ⚠️ MÜŞTERİ SİPARİŞİ "DÜZELTMİYOR", YENİ REVİZYON YAZIYOR. Eski satırlar
-- yerinde kalıyor ve mutfak "ne değişti" sorusunu Değişiklik geçmişi
-- sekmesinden cevaplayabiliyor. Üstüne yazsaydık, telefonla değiştirmekten
-- hiçbir farkı kalmazdı — bu ekranın var olma sebebi tam olarak bu.
--
-- ⚠️ HAZIR SİPARİŞ DE DEĞİŞTİRİLEBİLİR. Mal paketlenmiş olsa bile müşteri
-- değişiklik isteyebilir; engellersek müşteri telefonu açar ve değişiklik
-- SİSTEM DIŞINDA olur. Defterin işi gerçeği yazmaktır, gerçeği
-- engellemek değil. 0055 zaten onayları düşürüp zinciri yeniden işletiyor,
-- yani mutfak değişikliği görmeden üretime devam edemiyor.
--
-- ⚠️ SEVK BAŞLADIKTAN SONRA HAYIR. Mal yola çıkmışsa bu bir FARK kaydıdır,
-- revizyon değil (MI425). Portal bunu tetikleyiciye bırakmıyor, ÖNCEDEN ve
-- müşterinin anlayacağı dille söylüyor: tetikleyicinin mesajı mutfak için
-- yazılmış ("fark kaydı açın, incelensin"), müşteri o işi yapamaz.
--
-- ⚠️ FİYAT YOK. 0054'ün kararı: portal hiçbir yerde fiyat görmez ve yazmaz.
-- Satırlara `unit_price` KONULMUYOR; fiyatı mutfağın fiyat defteri belirler.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · ÖNCE BİR DELİK: `current_revision` YALNIZ TYPESCRIPT'TE YAZILIYORDU
-- ---------------------------------------------------------------------------
-- Portal güncellemesinin provası bunu ortaya çıkardı: revizyon 2 yazıldı ama
-- `sales_order.current_revision` 1'de kaldı.
--
-- ⚠️ BU, ONAY ZİNCİRİNİ SESSİZCE DELİYOR. `app.siparis_onayi_tam` onayları
-- `o.current_revision`a göre arıyor. Numara eskide kalırsa, revizyon 1 için
-- verilmiş ESKİ onay hâlâ geçerli sayılır: müşteri miktarı değiştirir,
-- 0055 siparişi "Onay Bekliyor"a geri alır, sonra sipariş hiç kimse yeni
-- miktarı onaylamadan "Onaylandı"ya geçebilir. 0053 ve 0055'in var olma
-- sebebi tam olarak budur.
--
-- Sebep: numarayı yazan tek yer `sales-order.repository.ts` içindeki
-- `revizyonEkle` — yani UYGULAMA KATMANI. Veritabanına revizyon yazan İKİNCİ
-- bir yazıcı (portal, Excel aktarımı, bir betik) o satırı unutursa kural
-- sessizce kırılıyor. 0012'nin dersi burada da geçerli: kuralı yazının
-- yanına koyma, VERİNİN yanına koy.
--
-- ⚠️ TS tarafındaki güncelleme KALDIRILMADI. Zararsız: tetik zaten doğru
-- numarayı yazıyor, ikinci yazım aynı değeri yazıyor. Kaldırmak bu göçün
-- işi değil ve kaldırmadan önce o kodun başka bir şey yapmadığından emin
-- olmak gerekir.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.revizyon_guncel_numara()
returns trigger
language plpgsql
security definer
-- ⚠️ TUZAK 44: sertleşmiş fonksiyonun çağırdığı HER şey nitelikli olmalı.
set search_path = ''
as $$
begin
  -- ⚠️ `current_revision < new.revision_no` koşulu bilinçli: geçmişe dönük
  -- bir revizyon (elle düzeltme, aktarım) numarayı GERİ almasın. Defterde
  -- ileri gidilir, geri dönülmez.
  update public.sales_order
     set current_revision = new.revision_no
   where id = new.order_id
     and current_revision < new.revision_no;
  return null;
end;
$$;

comment on function app.revizyon_guncel_numara() is
  'Yeni revizyon yazılınca sales_order.current_revision ilerler. Onay '
  'zinciri (0053) onayları bu numaraya göre arar; numara eskide kalırsa '
  'eski onay yeni miktara geçerli sayılır.';

-- ⚠️ Tetik ADI 0055'inkinden ÖNCE geliyor (g < o) ve AFTER tetikler ad
-- sırasına göre çalışır. 0055'in tetiği `status` okuyor, `current_revision`
-- okumuyor; yine de sıranın bilinçli olduğunu yazıyoruz.
drop trigger if exists sales_order_revision_guncel_numara on sales_order_revision;
create trigger sales_order_revision_guncel_numara
  after insert on sales_order_revision
  for each row execute function app.revizyon_guncel_numara();

-- Geçmişte kalmış satırlar varsa düzeltiliyor. TS yolu numarayı yazdığı
-- için burada bir şey çıkmaması beklenir; çıkarsa o sipariş zaten yanlış
-- onaylanmaya açıktı.
do $$
declare v_duzeltilen integer;
begin
  with en_son as (
    select order_id, max(revision_no) as no
      from public.sales_order_revision group by order_id
  )
  update public.sales_order o
     set current_revision = e.no
    from en_son e
   where e.order_id = o.id and o.current_revision < e.no;
  get diagnostics v_duzeltilen = row_count;
  if v_duzeltilen > 0 then
    raise notice '0063: % siparişin revizyon numarası geride kalmıştı, düzeltildi.',
      v_duzeltilen;
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · PORTALDAN GÜNCELLEME
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.portal_siparis_guncelle(
  p_siparis_no text,
  p_satirlar   jsonb,          -- [{"kalem_id":"...","miktar":10,"birim":"koli"}]
  p_gerekce    text default null
)
returns integer                -- yeni revizyon numarası
language plpgsql
security definer
-- ⚠️ TUZAK 44: sertleşmiş fonksiyonun çağırdığı HER şey nitelikli olmalı.
set search_path = ''
as $$
declare
  v_pu       public.portal_user;
  v_siparis  uuid;
  v_nokta    uuid;
  v_durum    text;
  v_rev_no   integer;
  v_rev      uuid;
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

  -- ── SİPARİŞ BENİM Mİ ────────────────────────────────────────────────────
  -- ⚠️ Süzme `portal_siparislerim` ile AYNI: müşteri + kiracı + (varsa)
  -- izinli teslim noktası. Buradaki koşul gevşek olsaydı, müşteri listede
  -- GÖREMEDİĞİ bir sipariş numarasını elle yazarak değiştirebilirdi.
  select o.id, o.delivery_point_id, o.status
    into v_siparis, v_nokta, v_durum
    from public.sales_order o
   where o.order_no   = p_siparis_no
     and o.customer_id = v_pu.customer_id
     and o.tenant_id   = v_pu.tenant_id
     and ( not exists (select 1 from public.portal_user_point x
                        where x.portal_user_id = v_pu.id)
           or o.delivery_point_id in (select x.delivery_point_id
                                        from public.portal_user_point x
                                       where x.portal_user_id = v_pu.id) );

  if v_siparis is null then
    -- ⚠️ "Bulunamadı" diyoruz, "yetkiniz yok" DEMİYORUZ. İkincisi, var
    -- olmayan bir numara için bile "böyle bir sipariş var ama sizin değil"
    -- bilgisini sızdırırdı.
    raise exception 'Böyle bir siparişiniz bulunamadı: %', p_siparis_no
      using errcode = 'MI431';
  end if;

  -- ── DEĞİŞTİRİLEBİLİR Mİ ─────────────────────────────────────────────────
  if v_durum in ('Kısmi Sevk','Sevk Edildi','Teslim Edildi') then
    raise exception 'Bu siparişin malı yola çıkmış durumda (%). Portaldan '
                    'miktar değiştirilemez; eksik, fazla ya da hasarlı bir '
                    'durum varsa işletmeye bildirin.', v_durum
      using errcode = 'MI433';
  end if;

  if v_durum = 'İptal' then
    raise exception 'Bu sipariş iptal edilmiş; değiştirilemez. Yeni bir '
                    'sipariş girebilirsiniz.' using errcode = 'MI433';
  end if;

  if p_satirlar is null or jsonb_array_length(p_satirlar) = 0 then
    -- ⚠️ Boş liste "siparişi iptal et" DEĞİLDİR. İptal ayrı bir karardır ve
    -- portalda yoktur; boş listeyi iptal saymak, yanlışlıkla silinen bir
    -- satırın siparişi yok etmesi demek olurdu.
    raise exception 'Sipariş en az bir kalem içermeli. Siparişi tamamen '
                    'iptal etmek istiyorsanız işletmeyi arayın.'
      using errcode = 'MI431';
  end if;

  -- ── YENİ REVİZYON ───────────────────────────────────────────────────────
  -- ⚠️ Aynı anda iki sekmeden gönderilirse revizyon numarası çakışmasın.
  perform pg_advisory_xact_lock(hashtext(v_siparis::text));
  select coalesce(max(revision_no), 0) + 1 into v_rev_no
    from public.sales_order_revision where order_id = v_siparis;

  insert into public.sales_order_revision
    (tenant_id, order_id, revision_no, kind, source, reason)
  values (v_pu.tenant_id, v_siparis, v_rev_no, 'MIKTAR', 'Portal',
          coalesce(nullif(btrim(coalesce(p_gerekce, '')), ''),
                   'Müşteri portaldan güncelledi'))
  returning id into v_rev;

  for v_satir in select * from jsonb_array_elements(p_satirlar) loop
    v_i := v_i + 1;
    v_kalem  := (v_satir ->> 'kalem_id')::uuid;
    v_miktar := (v_satir ->> 'miktar')::numeric;
    v_birim  := v_satir ->> 'birim';

    if v_kalem is null or v_miktar is null or not (v_miktar > 0)
       or coalesce(v_birim,'') = '' then
      raise exception '%. satır eksik: ürün, miktar ve birim zorunlu.', v_i
        using errcode = 'MI431';
    end if;

    -- Sözleşmesi olmayan ürün sipariş edilemez — 0054'teki kuralın aynısı.
    -- Bu kontrol olmadan müşteri, katalogda görmediği bir kalem kimliğini
    -- güncelleme sırasında araya sokabilirdi.
    if app.musteri_fiyati(v_nokta, v_kalem) is null then
      raise exception '%. satırdaki ürün bu noktaya sipariş edilemez '
                      '(sözleşmeli fiyatı yok).', v_i using errcode = 'MI431';
    end if;

    insert into public.sales_order_line
      (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
    values (v_pu.tenant_id, v_siparis, v_rev, v_i, v_kalem, v_miktar, v_birim);
  end loop;

  update public.portal_user set last_login_at = now() where id = v_pu.id;
  return v_rev_no;
end;
$$;

comment on function public.portal_siparis_guncelle(text, jsonb, text) is
  'Portal müşterisinin kendi siparişine YENİ REVİZYON yazar. Hiçbir satır '
  'üstüne yazılmaz. Sevk başlamış ya da iptal edilmiş siparişte reddeder '
  '(MI433). Miktar revizyonu olduğu için 0055 onayları düşürür ve sipariş '
  '"Onay Bekliyor"a döner.';

revoke all on function public.portal_siparis_guncelle(text, jsonb, text) from public;
revoke all on function public.portal_siparis_guncelle(text, jsonb, text) from anon;
grant execute on function public.portal_siparis_guncelle(text, jsonb, text)
  to authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · EKRANIN DÜZENLEME İÇİN İHTİYACI: KİMLİKLER
-- ---------------------------------------------------------------------------
-- Müşterinin siparişini DEĞİŞTİREBİLMESİ için ekranın mevcut satırları
-- düzenlenebilir bir forma doldurması gerekiyor. 0054'ün iki okuma
-- fonksiyonu yalnız ADLARI döndürüyordu:
--   `portal_siparis_satirlarim` → kalem_adi var, kalem_id YOK
--   `portal_siparislerim`       → nokta_adi var, nokta_id YOK
--
-- Ada göre eşleştirmek yanlış olurdu: iki ürün aynı ada sahip olabilir ve
-- ad değişince eşleşme sessizce kayardı. Kimlik açılıyor.
--
-- ⚠️ SIZINTI DEĞİL. Müşteri kendi noktasının kimliğini `portal_noktalarim`
-- ile, sipariş edebildiği ürünlerin kimliğini `portal_urunlerim` ile ZATEN
-- alıyor. Buradaki kimlikler o iki listenin içinden çıkıyor.
-- ⚠️ FİYAT YİNE YOK ve olmayacak (0054'ün kararı).
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.portal_siparis_satirlarim(text);
create or replace function public.portal_siparis_satirlarim(p_siparis_no text)
returns table (kalem_id uuid, kalem_adi text, miktar numeric, birim text)
language sql
stable
security definer
set search_path = ''
as $$
  select si.id, si.name, l.qty, l.uom_code
    from app.portal_kullanicisi() pu
    join public.sales_order o on o.order_no = p_siparis_no
                             and o.customer_id = pu.customer_id
                             and o.tenant_id  = pu.tenant_id
    join app.siparis_guncel_satirlari(o.id) l on true
    join public.stock_item si on si.id = l.stock_item_id
   order by l.line_no;
$$;

revoke all on function public.portal_siparis_satirlarim(text) from public, anon;
grant execute on function public.portal_siparis_satirlarim(text)
  to authenticated, service_role;

drop function if exists public.portal_siparislerim();
create or replace function public.portal_siparislerim()
returns table (
  siparis_no  text,
  nokta_id    uuid,
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
  select o.order_no, o.delivery_point_id, dp.name, o.order_date,
         o.requested_ship_date, o.promised_delivery_date, o.status
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

revoke all on function public.portal_siparislerim() from public, anon;
grant execute on function public.portal_siparislerim() to authenticated, service_role;

-- ── Doğrulama ────────────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.portal_siparis_guncelle(text, jsonb, text)') is null then
    raise exception '0063: portal_siparis_guncelle oluşmadı.';
  end if;

  -- ⚠️ `anon` çağırabiliyorsa portal kapısı açık kalmış demektir: 0007'nin
  -- kararı, oturumsuz hiçbir çağrının içeri girmemesidir.
  if has_function_privilege('anon',
       'public.portal_siparis_guncelle(text, jsonb, text)', 'execute') then
    raise exception '0063: fonksiyon anon''a açık — portal kapısı delik.';
  end if;

  -- 0055'in tetiği duruyor mu? Güncelleme onayları düşürmezse, mutfak
  -- onaylanmamış bir miktarı hazırlamaya devam eder.
  if not exists (
    select 1 from pg_trigger
     where tgname = 'sales_order_revision_onay_dusur'
       and tgrelid = 'public.sales_order_revision'::regclass
  ) then
    raise exception '0063: 0055''in onay düşürme tetiği yok — '
      'portal güncellemesi sessizce onaylı kalırdı.';
  end if;

  -- Revizyon numarasını ilerleten tetik duruyor mu? Yoksa eski onay yeni
  -- miktara geçerli sayılır ve zincir sessizce delinir.
  if not exists (
    select 1 from pg_trigger
     where tgname = 'sales_order_revision_guncel_numara'
       and tgrelid = 'public.sales_order_revision'::regclass
  ) then
    raise exception '0063: current_revision tetiği yok.';
  end if;

  -- Geride kalmış sipariş kalmadı mı?
  if exists (
    select 1 from public.sales_order o
     where o.current_revision < (select max(r.revision_no)
                                   from public.sales_order_revision r
                                  where r.order_id = o.id)
  ) then
    raise exception '0063: hâlâ revizyon numarası geride kalan sipariş var.';
  end if;

  -- Ekranın düzenleme için ihtiyacı olan kimlikler açıldı mı?
  if position('kalem_id' in coalesce(
       (select array_to_string(proargnames, ', ') from pg_proc
         where oid = 'public.portal_siparis_satirlarim(text)'::regprocedure), '')) = 0
  then
    raise exception '0063: portal_siparis_satirlarim kalem_id vermiyor.';
  end if;
  if position('nokta_id' in coalesce(
       (select array_to_string(proargnames, ', ') from pg_proc
         where oid = 'public.portal_siparislerim()'::regprocedure), '')) = 0
  then
    raise exception '0063: portal_siparislerim nokta_id vermiyor.';
  end if;

  raise notice '0063 TAMAM · portaldan sipariş güncelleme açıldı; '
    'revizyon numarası artık tetikle ilerliyor';
end;
$$;
