-- ═══════════════════════════════════════════════════════════════════════════
-- 0073 · ETİKET BEYANINI KİM YAZABİLİR
-- ---------------------------------------------------------------------------
-- Emrah, 10.10: *"Kesinlikle o rol/yetki kime-hangi personele verildiyse o
-- personel yapabilsin. Kısaca yetkileri rollere, rolleri personellere
-- dağıtıyoruz, bu da o yetkiye sahip kişiyi yazabilir duruma getirsin. Rol
-- olarak gıda mühendisi ve kalite sorumlusu uygundur."*
--
-- 0072 beyanı ATOMİK yaptı ama KİMİN yazacağını sormadı: işletmedeki herkes
-- yazabiliyordu — depocu da, şoför de. Alerjen beyanı yasal bir beyandır;
-- yanlışı insanı hastaneye düşürür. Bu göç o kapıyı takıyor.
--
-- ⚠️ YENİ İZİN TEK: `quality.declaration`. Alerjen VE besin değeri birlikte,
-- çünkü ikisi de aynı ekranda girilen ve aynı etikete basılan YASAL BEYAN.
-- Alerjeni kapatıp besin değerini açık bırakmak kapıyı yarım takmaktır.
--
-- ⚠️ YENİ ROL: `gida_muhendisi`. `kalite_sorumlusu` zaten vardı; gıda
-- mühendisi ondan farklı bir iş yapıyor — reçeteyi ve beyanı kuran kişi o.
-- Reçeteyi GÖRÜR ama değiştirmez: alerjen reçeteden türetiliyor, beyanı
-- yazan kişi reçeteyi de değiştirebilseydi beyanı kendine uydurabilirdi.
--
-- ⚠️ ROL AÇIKLAMALARI YENİDEN YAZILDI. Emrah: *"rollerin tek tek açıklamaları
-- bile olmalı yanında ki, rolleri veren yetkili kişi kimin ne yapabileceğini
-- bilsin."* Açıklamalar ekranda zaten gösteriliyordu (Kullanıcılar ve
-- Yetkiler); eksik olan açıklamaların KENDİSİYDİ. Her biri artık iki şey
-- söylüyor: ne YAPAR ve neyi YAPAMAZ. Yapamadığı kısım daha önemli — yetkiyi
-- veren kişi onu bilmezse fazla yetki verir.
--
-- NE YAPILMADI, BİLEREK:
-- ⚠️ Var olan rollerin eski izinleri DEĞİŞTİRİLMEDİ; yalnız yeni izin
--   dağıtıldı. Demo öncesi çalışan bir akışı sessizce kırmamak için.
-- ⚠️ `quality.write` HÂLÂ BÖLÜNMEDİ (ölçüm girme ↔ ölçüm iptali). O ayrı iş,
--   `nerede-kaldik.md` kırmızı başlığında duruyor.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · YENİ İZİN ─────────────────────────────────────────────────────────
insert into permission (code, module_code, description) values
  ('quality.declaration', 'quality',
   'Etiket beyanı yazma: alerjen ve besin değeri. Yasal beyandır.')
on conflict (code) do nothing;


-- ── 2 · YENİ ROL ──────────────────────────────────────────────────────────
insert into role (code, name, description) values
  ('gida_muhendisi', 'Gıda Mühendisi',
   'Etiket beyanını (alerjen, besin değeri) ve kalite kaydını YAZAR. '
   'Reçeteyi, stoğu ve üretimi GÖRÜR ama değiştiremez.')
on conflict (code) do nothing;


-- ── 3 · YENİ İZİN DAĞITILIYOR ─────────────────────────────────────────────
-- ⚠️ "Her izne sahip" roller yeni izni KENDİLİĞİNDEN ALMAZ. 0015'teki
-- `select code from permission` o günkü katalogla çalıştı; bugün eklenen
-- izin o satırlara girmez. Açıkça yazılıyor.
insert into role_permission (role_code, permission_code)
select r, 'quality.declaration'
  from unnest(array[
    'super_admin',      -- platform
    'admin',            -- bugünkü Emrah hesabı
    'isletme_sahibi',   -- işletmesinde her şey
    'isletme_muduru',   -- operasyonun tamamı
    'kalite_sorumlusu', -- Emrah'ın kararı
    'gida_muhendisi'    -- Emrah'ın kararı
  ]) as r
 where exists (select 1 from role where code = r)
on conflict do nothing;

-- Gıda mühendisinin geri kalan izinleri — kalite sorumlusunun kümesi,
-- `products.read` eklenerek (ürün kartını görmeden beyan yazılamaz).
-- ⚠️ `recipe.write` ve `production.write` YOK: beyanı yazan kişi, beyanın
-- türetildiği reçeteyi değiştirebiliyorsa beyan kendi kendini doğrular.
insert into role_permission (role_code, permission_code)
select 'gida_muhendisi', c
  from unnest(array[
    'dashboard.read', 'quality.read', 'quality.write',
    'stock.read', 'production.read', 'recipe.read',
    'logistics.read', 'audit.read', 'branch.read', 'products.read'
  ]) as c
 where exists (select 1 from permission where code = c)
on conflict do nothing;


-- ── 4 · ROL AÇIKLAMALARI ──────────────────────────────────────────────────
-- Biçim: NE YAPAR. NEYİ YAPAMAZ. İkinci cümle olmadan yetki veren kişi
-- rolün sınırını göremiyor.
update role set description = v.aciklama
  from (values
    ('super_admin',
     'EVREN360 platformunun tamamında tam yetki. Bütün işletmeleri ve '
     'lisansları yönetir. Yalnız bizde olmalı.'),
    ('admin',
     'Bu kurulumun sahibi. Platform yönetimi dahil her şeyi yapabilir. '
     'Müşteri firmalarının sahiplerine bu rol VERİLMEZ — onlar "İşletme '
     'Sahibi" rolünü alır.'),
    ('isletme_sahibi',
     'Kendi işletmesinde her şeyi yapar: kullanıcı açar, rol dağıtır, '
     'fiyat ve maliyet görür. Platform ayarlarına ve başka işletmelerin '
     'verisine ERİŞEMEZ.'),
    ('isletme_muduru',
     'İşletmenin bütün operasyonunu yürütür ve maliyeti görür. '
     'Kullanıcı açamaz, rol dağıtamaz, işletme ayarlarını değiştiremez — '
     'o yetki işletme sahibinde kalır.'),
    ('depo_sorumlusu',
     'Mal kabul eder, sayım yapar, depodan mal çıkarır, sevkiyat yürütür. '
     'Fiyat ve maliyet GÖRMEZ; reçete ve etiket beyanı YAZAMAZ.'),
    ('satinalma_sorumlusu',
     'Satın alma talebi ve siparişi açar, tedarikçi yönetir, alış fiyatını '
     'görür. Depoya mal GİRMEZ (onu mal kabul yapar) ve üretime karışmaz.'),
    ('uretim_sorumlusu',
     'İş emri açar, üretimi yürütür, hammadde düşer, mamul girer. Ölçüm '
     'girer. Reçete yazar. Etiket beyanı (alerjen/besin) YAZAMAZ; satın '
     'alma ve finansa erişemez.'),
    ('kalite_sorumlusu',
     'Kalite kaydı ve HACCP ölçümü girer, geri çağırma başlatır, ETİKET '
     'BEYANINI (alerjen/besin) yazar, denetim kaydını okur. Üretimi ve '
     'stoğu yalnız GÖRÜR — denetleyen, denetlediği veriyi düzeltemez.'),
    ('gida_muhendisi',
     'Etiket beyanını (alerjen, besin değeri) ve kalite kaydını yazar; '
     'reçeteyi, üretimi ve stoğu görür. Reçeteyi DEĞİŞTİREMEZ: alerjen '
     'reçeteden türetildiği için beyanı yazan kişi reçeteye de '
     'dokunabilseydi beyan kendi kendini doğrulardı.'),
    ('sevkiyat_sorumlusu',
     'Sevkiyat yürütür, irsaliye keser, yükleme ölçümü girer, mal çıkışı '
     'yazar. Fiyat GÖRMEZ; üretim ve satın almaya karışmaz.'),
    ('muhasebe',
     'Finansı yürütür: kasa, cari, gelir-gider, tedarikçi ödemesi. Satın '
     'almayı ve stoğu GÖRÜR ama mala dokunmaz — stok hareketi yazamaz.'),
    ('personel',
     'Mutfak/depo personeli. Mal kabul girer, üretim tüketimi düşer, '
     'reçeteye bakar. Fiyat, tedarikçi, kullanıcı ve ayar GÖRMEZ; sipariş '
     'onaylayamaz.'),
    ('izleyici',
     'Her şeyi görür, hiçbir şeyi değiştiremez. Denetçi, danışman ve mali '
     'müşavir için. Fiyat ve maliyet dahil okuma yetkisi vardır.')
  ) as v(kod, aciklama)
 where role.code = v.kod;


-- ── 5 · ALERJEN KAPISI — RPC İÇİNDE ───────────────────────────────────────
-- ⚠️ 0072'deki fonksiyon AYNEN yeniden yazılıyor, tek fark en başa eklenen
-- yetki kontrolü. Gövdeyi bölmedim çünkü 0072'nin tek kazancı ATOMİKLİKTİ;
-- yetkiyi ayrı bir sarmalayıcıya alsaydım iki fonksiyon olurdu ve biri
-- doğrudan çağrılabilirdi.
create or replace function public.alerjen_beyani_yaz(
  p_kalem    uuid,
  p_satirlar jsonb default '[]'::jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant       uuid := app.current_tenant_id();
  v_kullanici    uuid;
  v_kalem_tenant uuid;
  v_damga        timestamptz := now();
  v_satir        jsonb;
  v_kod          text;
  v_tur          text;
begin
  if v_tenant is null then
    raise exception 'Oturumda işletme bilgisi yok; alerjen beyanı yazılamaz.'
      using errcode = 'MI403';
  end if;

  -- ⚠️ YETKİ KAPISI (0073). Hata mesajı HANGİ yetkinin gerektiğini ve kimde
  -- olduğunu söylüyor: "yetkiniz yok" diyen ama ne gerektiğini söylemeyen
  -- mesaj kullanıcıyı da yöneticiyi de çaresiz bırakır.
  if not app.yetkim_var('quality.declaration') then
    raise exception 'Etiket beyanı yazmak için `quality.declaration` izni '
      'gerekiyor. Bu izin gıda mühendisi, kalite sorumlusu, işletme müdürü '
      've işletme sahibi rollerinde bulunur.'
      using errcode = 'MI403';
  end if;

  select u.id into v_kullanici
    from public.app_user u
   where u.auth_user_id = auth.uid()
     and u.tenant_id    = v_tenant
     and u.is_active;
  if v_kullanici is null then
    raise exception 'Bu işlemi yapan kullanıcı bulunamadı veya pasif.'
      using errcode = 'MI403';
  end if;

  select si.tenant_id into v_kalem_tenant
    from public.stock_item si where si.id = p_kalem;
  if v_kalem_tenant is null then
    raise exception 'Stok kalemi bulunamadı.' using errcode = 'MI404';
  end if;
  if v_kalem_tenant <> v_tenant then
    raise exception 'Stok kalemi bu işletmeye ait değil.' using errcode = 'MI424';
  end if;

  if jsonb_typeof(p_satirlar) <> 'array' then
    raise exception 'Alerjen listesi bir dizi olmalı.' using errcode = 'MI400';
  end if;

  if (select count(distinct (s.e ->> 'kod'))
        from jsonb_array_elements(p_satirlar) as s(e))
     <> jsonb_array_length(p_satirlar) then
    raise exception 'Aynı alerjen iki kez işaretlenmiş.' using errcode = 'MI409';
  end if;

  perform set_config('app.alerjen_beyani_yaziliyor', '1', true);

  delete from public.stock_item_allergen where stock_item_id = p_kalem;

  for v_satir in select s.e from jsonb_array_elements(p_satirlar) as s(e) loop
    v_kod := upper(btrim(coalesce(v_satir ->> 'kod', '')));
    v_tur := coalesce(nullif(btrim(coalesce(v_satir ->> 'tur', '')), ''), 'İÇERİR');

    if v_kod = '' then
      raise exception 'Alerjen kodu boş olamaz.' using errcode = 'MI400';
    end if;
    if not exists (select 1 from public.allergen a where a.code = v_kod) then
      raise exception 'Tanınmayan alerjen kodu: %. Listeden seçilmeli.', v_kod
        using errcode = 'MI400';
    end if;
    if v_tur not in ('İÇERİR', 'İZ') then
      raise exception 'Alerjen türü "İÇERİR" veya "İZ" olmalı (gelen: %).', v_tur
        using errcode = 'MI400';
    end if;

    insert into public.stock_item_allergen
      (tenant_id, stock_item_id, allergen_code, kind, note)
    values
      (v_tenant, p_kalem, v_kod, v_tur,
       nullif(btrim(coalesce(v_satir ->> 'not', '')), ''));
  end loop;

  update public.stock_item
     set allergen_reviewed_at = v_damga,
         allergen_reviewed_by = v_kullanici
   where id = p_kalem;

  perform set_config('app.alerjen_beyani_yaziliyor', '', true);
  return v_damga;
end;
$$;

revoke all     on function public.alerjen_beyani_yaz(uuid, jsonb) from public;
revoke all     on function public.alerjen_beyani_yaz(uuid, jsonb) from anon;
grant  execute on function public.alerjen_beyani_yaz(uuid, jsonb)
  to authenticated, service_role;


-- ── 6 · BESİN DEĞERİ KAPISI — TETİKLE ─────────────────────────────────────
-- Besin değeri doğrudan tabloya yazılıyor (RPC'si yok). Kapı bu yüzden
-- tetikte. Alerjeni kapatıp besin değerini açık bırakmak kapıyı yarım
-- takmak olurdu — ikisi de aynı etikete basılan yasal beyan.
--
-- ⚠️ OTURUMSUZ BAĞLAM SERBEST. Göç, arka plan işi ve yedek geri yükleme
-- `auth.uid()` olmadan çalışır; orada izin diye bir kavram yok. PostgREST
-- üzerinden gelen her çağrının oturumu VARDIR, yani dışarıdan bu yoldan
-- girilemiyor.
create or replace function app.beyan_yetkisi_gerek()
returns trigger
language plpgsql
as $$
declare v_auth uuid;
begin
  begin
    v_auth := auth.uid();
  exception when others then v_auth := null;
  end;
  if v_auth is null then
    return coalesce(new, old);
  end if;
  if not app.yetkim_var('quality.declaration') then
    raise exception 'Besin değeri beyanı yazmak için `quality.declaration` '
      'izni gerekiyor. Bu izin gıda mühendisi, kalite sorumlusu, işletme '
      'müdürü ve işletme sahibi rollerinde bulunur.'
      using errcode = 'MI403';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists stock_item_nutrition_beyan_yetkisi on public.stock_item_nutrition;
create trigger stock_item_nutrition_beyan_yetkisi
  before insert or update or delete on public.stock_item_nutrition
  for each row execute function app.beyan_yetkisi_gerek();


-- ── 7 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare v_say int; v_eksik text;
begin
  if not exists (select 1 from permission where code = 'quality.declaration') then
    raise exception '0073: quality.declaration izni katalogda yok.';
  end if;

  if not exists (select 1 from role where code = 'gida_muhendisi') then
    raise exception '0073: gida_muhendisi rolü kurulmadı.';
  end if;

  -- İzni ALMASI gereken roller
  select string_agg(r, ', ') into v_eksik
    from unnest(array['admin','isletme_sahibi','isletme_muduru',
                      'kalite_sorumlusu','gida_muhendisi']) as r
   where not exists (select 1 from role_permission rp
                      where rp.role_code = r
                        and rp.permission_code = 'quality.declaration');
  if v_eksik is not null then
    raise exception '0073: beyan izni verilmemiş rol: %', v_eksik;
  end if;

  -- İzni ALMAMASI gereken roller. ⚠️ Bu kontrol olmasaydı bir gün biri
  -- "herkese verelim" diye tek satır ekler ve kimse fark etmezdi.
  select string_agg(r, ', ') into v_eksik
    from unnest(array['depo_sorumlusu','uretim_sorumlusu','sevkiyat_sorumlusu',
                      'satinalma_sorumlusu','muhasebe','personel','izleyici']) as r
   where exists (select 1 from role_permission rp
                  where rp.role_code = r
                    and rp.permission_code = 'quality.declaration');
  if v_eksik is not null then
    raise exception '0073: beyan izni SIZMIŞ rol: %', v_eksik;
  end if;

  -- Açıklamasız rol kalmamalı: ekran açıklamayı gösteriyor, boşsa
  -- yetkiyi veren kişi kör kalıyor.
  select count(*) into v_say from role where coalesce(btrim(description), '') = '';
  if v_say > 0 then
    raise exception '0073: açıklaması boş % rol var.', v_say;
  end if;

  if not exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.stock_item_nutrition'::regclass
       and t.tgname = 'stock_item_nutrition_beyan_yetkisi'
       and not t.tgisinternal
  ) then
    raise exception '0073: besin değeri yetki tetiği yok.';
  end if;

  if not exists (
    select 1 from pg_proc p
     where p.oid = to_regprocedure('public.alerjen_beyani_yaz(uuid, jsonb)')
       and pg_get_functiondef(p.oid) like '%quality.declaration%'
  ) then
    raise exception '0073: alerjen RPC''sinde yetki kontrolü yok.';
  end if;

  select count(*) into v_say from permission;
  raise notice '0073 TAMAM · katalogda % izin · beyan yetkisi gıda mühendisi '
    've kalite sorumlusunda · rol açıklamaları yenilendi', v_say;
end;
$$;
