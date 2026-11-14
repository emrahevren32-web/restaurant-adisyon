-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · BEKLEYEN GÖÇ · 0117 · 14.11.2026
--
-- ⚠️ BU DOSYA SUPABASE'E YAPIŞTIRILACAK. Canlı veritabanı **göç 0116'da**
-- (0115 + 0116 12.11 gecesi uygulandı; Supabase özeti: 3 / 3 · tamam ·
-- tamam · 7 · tamam). Aşağıdaki 0117 henüz UYGULANMADI.
--
-- 0117 · SİPARİŞE SON ONAY · TEK YETKİLİ (Emrah kararı, 12.11)
--   Bugüne kadar "Onaylandı" düğmesine sipariş açabilen HERKES basabiliyordu
--   ve veritabanı kimin bastığına bakmıyordu.
--   Yeni kural: son onayı İŞLETME MÜDÜRÜ verir. İşletmede müdür rolünde
--   aktif kimse yoksa İŞLETME SAHİBİ verir; müdür atandığı an sahip
--   devreden çıkar.
--   Ayrıca: bir siparişi KİMİN onayladığı artık deftere yazılıyor
--   (bugüne kadar yazılmıyordu).
--
-- ⚠️ BU GÖÇ UYGULANDIĞI AN KAPI YÜRÜRLÜKTE. Ekran yüklenene kadar
-- (`miyop-yukle.ps1`) düğme eski hâliyle görünür; yetkisi olmayan biri
-- basarsa veritabanı reddeder ve sebebini cümleyle söyler. Veri bozulmaz.
--
-- ⚠️ SON TABLODA BAKILACAK İKİ SATIR:
--   · `dogrulama | gecti`
--   · `UYARI . onay bekleyen siparisi olup son onay verecek KIMSESI olmayan
--     isletme` → **0** olmalı. 0 değilse o işletmelerde ne müdür ne sahip
--     var demektir (eski deneme kayıtları olabilir); bana sayıyı söyle.
--
-- ⚠️ Yeni izin AÇILMIYOR, hiçbir kullanıcının rolü DEĞİŞMİYOR, hiçbir
-- sipariş satırına DOKUNULMUYOR. Yalnız beş fonksiyon yazılıyor.
--
-- ⚠️ Bu dosyayı BOŞALTMAK, göçü uygulamanın SON adımıdır (kontrol
-- listesi 130). "Run" tuşuna basmak son adım değildir.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0117 — SON ONAY · TEK YETKİLİ: İŞLETME MÜDÜRÜ
--
-- ── KARAR ────────────────────────────────────────────────────────────────
-- Emrah (12.11.2026): *"ne olursa olsun son onayı veren tek bir yetkili
-- olsun."* Kim olacağı sorulunca: *"sence kim olsun? … bence işletme sahibi
-- değil de müdür olsun, çünkü her olan bitenden haberdar olması gerekir
-- adamın."* ve *"tekrar sormana gerek yok."*
--
-- ── BUGÜNE KADAR NE VARDI (12.11'de ölçüldü) ─────────────────────────────
-- Onay zinciri (0053) üç adım: depo görüşü · üretim görüşü · satış onayı.
-- Üçü de olumlu olunca sipariş KENDİLİĞİNDEN onaylanmıyor; biri durumu
-- "Onaylandı" yapıyor. O "biri":
--   · ekranda       → `operations.write` taşıyan HERKES (sipariş AÇMA izni)
--   · veritabanında → `app.siparis_onay_kapisi()` yalnız zincirin tamam
--     olduğuna bakıyordu; KİMİN bastığına bakmıyordu.
-- Yani "son onay" vardı ama "tek bir yetkili" yoktu: siparişi açan kişi son
-- onayı da verebiliyordu.
--
-- ── KURAL ────────────────────────────────────────────────────────────────
--   1 · Siparişi "Onaylandı" yapan kişi İŞLETME MÜDÜRÜ rolünde olmalı.
--   2 · İşletmede müdür rolünde AKTİF kimse YOKSA, son onayı İŞLETME
--       SAHİBİ verir. Müdür atandığı AN bu yol kendiliğinden kapanır.
--
-- ⚠️ 2. MADDE BENİM KARARIM VE GEREKÇESİ ŞU (Emrah "sen karar ver" dedi):
-- Yeni açılan her işletmede tek kullanıcı vardır: işletme sahibi. Kural
-- yalnız 1. madde olsaydı o işletme İLK SİPARİŞİNDE duvara çarpardı —
-- önce birine müdür rolü vermesi gerekirdi. Küçük işletmede sahip zaten
-- müdürdür. Emrah'ın cümlesinin özü korunuyor: müdürü olan işletmede
-- sahip son onayı VEREMEZ; iş müdürden geçer.
-- ⚠️ Geri alması tek satır: aşağıdaki `app.son_onay_yetkim_var()` içinde
-- "müdür yoksa sahip" dalı silinir.
--
-- ⚠️ NEDEN YENİ BİR İZİN DEĞİL DE ROL
-- İlk taslakta `operations.final_approve` diye bir izin açmıştım. Vazgeçtim:
--   · Kuralın ikinci maddesi ("müdür yoksa sahip") bir izinle İFADE
--     EDİLEMEZ; izin ya vardır ya yoktur, "işletmede başka kim var"a bakmaz.
--     Kural yine role bakmak zorunda kalır ve iki yerde iki gerçek olurdu.
--   · Karar zaten rol diliyle verildi ("müdür").
-- Bedeli yazılı: Yetki ekranındaki izin listesinde "son onay" diye bir satır
-- GÖRÜNMEZ (HEDEFLER 0.A.1.4.3).
--
-- ⚠️ GERİ ALMA (Onaylandı → Onay Bekliyor) ve sonraki adımlar
-- (Hazırlanıyor, Hazır…) bu göçle DEĞİŞMEDİ; onlar `operations.write`.
--
-- ⚠️ KİMİN ONAYLADIĞI BUGÜNE KADAR YAZILMIYORDU. `app.siparis_olayi_yaz()`
-- (0050) AÇILDI, REVİZYON ve FARK olaylarına imza yazıyor, DURUM olayına
-- YAZMIYORDU. "Son onayı tek bir yetkili verir" kararının kaydı olmadan
-- anlamı yok; bu göç DURUM olayına da imzayı ekliyor (sunucudan:
-- `app.aktif_kullanici_id()`).
-- ⚠️ GEÇMİŞ OLAYLAR DOLDURULMUYOR: kimin bastığı o gün yazılmadı, bugün
-- bilinemez. Uydurma bir ad yazmak, boş bırakmaktan kötüdür.
--
-- ⚠️ CEVAP CANLI: ekran yetkiyi girişte değil, ekran açılırken SUNUCUYA
-- soruyor (`public.son_onay_yetkim_var()`). Müdür atanınca yeniden giriş
-- gerekmez.
--
-- Tetik fonksiyonlarının imzası değişmedi → `create or replace` yeterli,
-- tetikler bağlı kalıyor. Tekrar çalıştırılabilir.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · İŞLETMEMDE MÜDÜR VAR MI ──────────────────────────────────────────
-- ⚠️ PARAMETRE YOK, bilerek: işletme çağıranın KENDİ kaydından okunuyor.
-- Parametre alsaydı herhangi bir oturum başka bir işletmenin müdürü olup
-- olmadığını sorabilirdi.
-- ⚠️ `security definer`: `app_user` ve `user_role` RLS ardında; çağıran
-- kendi işletmesindeki öteki kullanıcıların rolünü okuyamayabilir.
create or replace function app.isletmemde_mudur_var()
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_ben uuid; v_kiraci uuid;
begin
  v_ben := app.aktif_kullanici_id();
  if v_ben is null then return false; end if;
  select u.tenant_id into v_kiraci from public.app_user u where u.id = v_ben;

  return exists (
    select 1 from public.app_user m
     where m.tenant_id = v_kiraci
       and m.is_active
       and ( m.role_code = 'isletme_muduru'
             or exists (select 1 from public.user_role ur
                         where ur.user_id = m.id
                           and ur.role_code = 'isletme_muduru') )
  );
end $$;

comment on function app.isletmemde_mudur_var() is
  'Cagiranin isletmesinde Isletme Muduru rolunde AKTIF en az bir kullanici '
  'var mi (0117). Parametre almaz: isletme oturumdan okunur.';

revoke all     on function app.isletmemde_mudur_var() from public;
revoke all     on function app.isletmemde_mudur_var() from anon;
grant  execute on function app.isletmemde_mudur_var() to authenticated, service_role;


-- ── 2 · SON ONAYI BEN VEREBİLİR MİYİM ────────────────────────────────────
-- Kuralın TEK yazıldığı yer. Hem veritabanı kapısı hem ekran bunu soruyor.
create or replace function app.son_onay_yetkim_var()
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_ben uuid; v_mudurum boolean; v_sahibim boolean;
begin
  v_ben := app.aktif_kullanici_id();
  if v_ben is null then return false; end if;

  select ( u.role_code = 'isletme_muduru'
           or exists (select 1 from public.user_role ur
                       where ur.user_id = u.id and ur.role_code = 'isletme_muduru') ),
         ( u.role_code = 'isletme_sahibi'
           or exists (select 1 from public.user_role ur
                       where ur.user_id = u.id and ur.role_code = 'isletme_sahibi') )
    into v_mudurum, v_sahibim
    from public.app_user u
   where u.id = v_ben;

  -- 1 · Müdür her zaman verir.
  if coalesce(v_mudurum, false) then return true; end if;

  -- 2 · MÜDÜR YOKSA SAHİP. İşletmede müdür rolünde aktif biri olduğu an
  --     bu dal yanlış döner; sahip kendiliğinden devreden çıkar.
  --     ⚠️ Bu dalı silmek kuralı "yalnız müdür"e çevirir (başlıktaki not).
  if coalesce(v_sahibim, false) and not app.isletmemde_mudur_var() then
    return true;
  end if;

  return false;
end $$;

comment on function app.son_onay_yetkim_var() is
  'Cagiran siparise SON ONAYI verebilir mi (0117 . Emrah karari 12.11.2026): '
  'Isletme Muduru verir; isletmede aktif mudur yoksa isletme sahibi verir.';

revoke all     on function app.son_onay_yetkim_var() from public;
revoke all     on function app.son_onay_yetkim_var() from anon;
grant  execute on function app.son_onay_yetkim_var() to authenticated, service_role;


-- ── 3 · EKRANIN SORDUĞU KABUK ────────────────────────────────────────────
-- Düğme, kuralı kendisi hesaplamıyor; sunucuya soruyor. Ekranda ikinci bir
-- kural yazılsaydı biri bir gün güncellenmezdi.
create or replace function public.son_onay_yetkim_var()
returns boolean
language sql stable
set search_path = ''
as $$ select app.son_onay_yetkim_var(); $$;

revoke all     on function public.son_onay_yetkim_var() from public;
revoke all     on function public.son_onay_yetkim_var() from anon;
grant  execute on function public.son_onay_yetkim_var() to authenticated, service_role;


-- ── 4 · KAPI ─────────────────────────────────────────────────────────────
-- ⚠️ Gövde 0053'ten HARFİ HARFİNE alındı; eklenen tek şey en baştaki
-- yetki bloğu. Zincir kapısı ve söz verilen tarih hesabı aynı.
create or replace function app.siparis_onay_kapisi()
returns trigger
language plpgsql
as $$
declare
  v_eksik text;
  v_tarih date;
begin
  if new.status = 'Onaylandı' and old.status is distinct from 'Onaylandı' then
    -- ── SON ONAY · KİM BASIYOR (0117 · Emrah kararı 12.11.2026) ──────────
    -- ⚠️ ZİNCİRDEN ÖNCE: yetkisi olmayan biri zincirin hangi adımının eksik
    -- olduğunu bu kapıdan öğrenmesin; önce "sen değilsin" denir.
    -- ⚠️ `app.bakim_baglami()`: göç, yedek ve provanın sahne kurulumu
    -- oturumsuz çalışır; oradaki yazım kullanıcı kapısına takılmaz (0082).
    if not app.bakim_baglami() and not app.son_onay_yetkim_var() then
      if app.isletmemde_mudur_var() then
        raise exception
          'Bu işletmede siparişe son onayı İşletme Müdürü verir; hesabınızda '
          'o rol yok. Sipariş onay bekliyor olarak duruyor.'
          using errcode = 'MI403';
      end if;
      raise exception
        'Siparişe son onayı İşletme Müdürü verir; işletmede müdür rolünde '
        'kimse yoksa işletme sahibi verir. Hesabınız bu ikisinden biri değil.'
        using errcode = 'MI403';
    end if;

    if not app.siparis_onayi_tam(new.id) then
      select string_agg(s.name, ', ' order by s.sort_order) into v_eksik
        from public.order_approval_step s
       where s.tenant_id = new.tenant_id and s.is_active and s.required
         and coalesce((
               select a.decision from public.order_approval a
                where a.order_id = new.id and a.step_code = s.code
                  and a.revision_no = new.current_revision
                order by a.decided_at desc, a.id desc limit 1
             ), 'Yok') not in ('Olumlu','Şartlı');
      raise exception
        'Sipariş onaylanamaz: şu adımların onayı eksik → %. '
        'Sipariş revize edildiyse onaylar yeniden alınır — onaylanan miktar '
        'ile gönderilecek miktar aynı olmak zorunda.', v_eksik
        using errcode = 'MI429';
    end if;

    -- Söz verilen tarih: bu revizyonun kararlarındaki EN GEÇ tarih.
    -- En erkeni almak, sözü tutamayacağımız bir tarihi müşteriye söylemek
    -- olurdu.
    select max(a.promised_on) into v_tarih
      from public.order_approval a
     where a.order_id = new.id and a.revision_no = new.current_revision;
    if v_tarih is not null then new.promised_delivery_date := v_tarih; end if;
  end if;
  return new;
end;
$$;

comment on function app.siparis_onay_kapisi() is
  'Siparis Onaylandi olurken: (1) basan son onay yetkilisi olmali (0117 . '
  'Isletme Muduru; mudur yoksa isletme sahibi . MI403), (2) onay zinciri '
  'tamam olmali (0053 . MI429). Soz verilen tarihi kararlardan turetir.';


-- ── 5 · DURUM OLAYINA İMZA ───────────────────────────────────────────────
-- ⚠️ Gövde 0050'den HARFİ HARFİNE alındı; değişen tek şey DURUM satırı.
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
      -- ⚠️ 0117 · DURUMU KİMİN DEĞİŞTİRDİĞİ ARTIK YAZILIYOR. İmza istemciden
      -- gelmiyor: oturumdaki kullanıcıyı sunucu okuyor (0087'nin kuralı).
      -- Oturumsuz yazımda (göç, bakım) NULL kalır; uydurma bir ad yazılmaz.
      insert into public.sales_order_event (tenant_id, order_id, kind, from_status, to_status, actor_id)
      values (new.tenant_id, new.id, 'DURUM', old.status, new.status, app.aktif_kullanici_id());
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

comment on function app.siparis_olayi_yaz() is
  'Siparis defterine olay yazar (AFTER tetigi). 0117: DURUM olayi da '
  'imzali — durumu degistiren kullaniciyi sunucu okur.';

-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
-- ⚠️ Tanımın yürürlükte olduğu ölçülüyor. Kapının GERÇEKTEN reddettiğini
-- `db/prova/prova-0117.sql` `authenticated` rolüyle ölçüyor.
do $$
declare v_govde text; v_ad text;
begin
  select pg_get_functiondef('app.siparis_onay_kapisi()'::regprocedure) into v_govde;
  if v_govde !~ 'app\.son_onay_yetkim_var\(\)' then
    raise exception '0117 DOGRULAMA: kapi son onay yetkisini olcmuyor.';
  end if;
  if v_govde !~ 'MI429' or v_govde !~ 'siparis_onayi_tam' then
    raise exception '0117 DOGRULAMA: zincir kapisi dusmus (MI429).';
  end if;
  if v_govde !~ 'promised_delivery_date' then
    raise exception '0117 DOGRULAMA: soz verilen tarih hesabi dusmus.';
  end if;

  if not exists (select 1 from pg_trigger t
                  where t.tgrelid = 'public.sales_order'::regclass
                    and t.tgname = 'sales_order_onay_kapisi' and not t.tgisinternal) then
    raise exception '0117 DOGRULAMA: sales_order_onay_kapisi tetigi bagli degil.';
  end if;

  select pg_get_functiondef('app.siparis_olayi_yaz()'::regprocedure) into v_govde;
  if v_govde !~ '''DURUM'', old\.status, new\.status, app\.aktif_kullanici_id\(\)' then
    raise exception '0117 DOGRULAMA: DURUM olayi imzasiz yaziliyor.';
  end if;
  if v_govde !~ 'REVİZYON' or v_govde !~ 'FARK KARARI' then
    raise exception '0117 DOGRULAMA: olay yazicisinin oteki dallari dusmus.';
  end if;

  -- Üç yeni fonksiyon: anon ve PUBLIC kapalı, authenticated açık.
  foreach v_ad in array array[
    'app.isletmemde_mudur_var()', 'app.son_onay_yetkim_var()',
    'public.son_onay_yetkim_var()'
  ] loop
    if has_function_privilege('anon', v_ad, 'execute') then
      raise exception '0117 DOGRULAMA: % anon a acik.', v_ad;
    end if;
    if not has_function_privilege('authenticated', v_ad, 'execute') then
      raise exception '0117 DOGRULAMA: % authenticated a kapali.', v_ad;
    end if;
  end loop;

  -- ⚠️ İlk taslağın izni yanlışlıkla bir yere uygulandıysa görünsün.
  if exists (select 1 from public.permission where code = 'operations.final_approve') then
    raise exception '0117 DOGRULAMA: operations.final_approve izni katalogda '
                    'duruyor; bu goc izin ACMIYOR.';
  end if;

  raise notice '0117 TAMAM · son onay: Isletme Muduru (mudur yoksa isletme sahibi).';
end $$;


-- ── ÖZET ──────────────────────────────────────────────────────────────────
-- ⚠️ 5. satır bir UYARIDIR, hata değil: onay bekleyen siparişi olup ne
-- müdürü ne sahibi olan işletme varsa orada son onayı verebilecek KİMSE yok
-- demektir (eski deneme kayıtlarında olabilir).
select ne, deger from (
  select 1 as sira, 'son onay kurali' as ne,
         'Isletme Muduru . mudur yoksa isletme sahibi' as deger
  union all
  select 2, 'aktif isletme sayisi (platform haric)',
         (select count(*)::text from public.tenant
           where status = 'Aktif' and not is_platform)
  union all
  select 3, 'aktif muduru OLAN isletme',
         (select count(distinct u.tenant_id)::text
            from public.app_user u
            join public.tenant t on t.id = u.tenant_id
           where u.is_active and t.status = 'Aktif' and not t.is_platform
             and (u.role_code = 'isletme_muduru'
                  or exists (select 1 from public.user_role ur
                              where ur.user_id = u.id
                                and ur.role_code = 'isletme_muduru')))
  union all
  select 4, 'onay bekleyen siparis sayisi',
         (select count(*)::text from public.sales_order where status = 'Onay Bekliyor')
  union all
  select 5, 'UYARI . onay bekleyen siparisi olup son onay verecek KIMSESI olmayan isletme',
         (select count(distinct s.tenant_id)::text
            from public.sales_order s
           where s.status = 'Onay Bekliyor'
             and not exists (
               select 1 from public.app_user u
                where u.tenant_id = s.tenant_id and u.is_active
                  and (u.role_code in ('isletme_muduru', 'isletme_sahibi')
                       or exists (select 1 from public.user_role ur
                                   where ur.user_id = u.id
                                     and ur.role_code in ('isletme_muduru',
                                                          'isletme_sahibi')))))
  union all
  select 6, 'dogrulama', 'gecti'
) t
order by sira;
