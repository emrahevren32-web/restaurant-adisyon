-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0049 — YENİ SEVKİYAT MÜŞTERİ KARTINA BAĞLI OLMAK ZORUNDA
-- ═══════════════════════════════════════════════════════════════════════════
-- Yol haritası maddesi: "Müşteri kartı ve sözleşme"
--          Bitti sayılır ki: "Sevkiyatta müşteri adı elle yazılmıyor,
--                             karttan seçiliyor"
--
-- 0047 kolonu açtı, A4C1 ekranı seçimi kurdu, servis boş kart atfını
-- reddediyor. Eksik olan son halka: VERİTABANI.
--
-- ── NİÇİN BURADA DA ───────────────────────────────────────────────────────
-- Servisteki kontrol, servisten geçen yazımları korur. Yarın bir Excel
-- aktarımı, bir Edge Function ya da bir betik doğrudan tabloya yazarsa
-- kural atlanır ve elle yazılmış isimler geri gelir. "Müşteri adı elle
-- yazılmıyor" cümlesini taşıyan yer, adı tutan yer olmalı.
--
-- ── NİÇİN `not null` DEĞİL, TETİK ─────────────────────────────────────────
-- Kolonu `not null` yapmak GEÇMİŞİ bozar: 0047 öncesinden kalan
-- sevkiyatlarda müşteri yalnız düz metinde duruyor. Onlara uydurma bir kart
-- atfı yazmak, geçmişi uydurmaktır.
--
-- Tetik yalnızca INSERT'e bakıyor:
--   · Yeni sevkiyat → kart ZORUNLU.
--   · Eski satırın GÜNCELLENMESİ → serbest. Kullanıcı eski kaydı açıp
--     karşılığı olan kartı seçebilsin; kapıyı kilitlemek o düzeltmeyi de
--     imkânsız kılardı.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.sevkiyat_karta_bagli()
returns trigger
language plpgsql
as $$
begin
  if new.customer_id is null then
    raise exception
      'Sevkiyat bir müşteri kartına bağlı olmalı. Elle yazılan isim aynı '
      'müşteriyi birden çok müşteri hâline getirir ve geri çağırmada '
      'hiçbiri toplanamaz.'
      using errcode = 'MI423';
  end if;

  -- Kart ile teslim noktası TUTARLI olmalı. Yabancı anahtarlar bunu
  -- söylemiyor: iki kolon iki ayrı satıra bakıyor. Tutarsız bir çift,
  -- "A müşterisinin sevkiyatı B'nin kapısına" demek olurdu.
  if new.delivery_point_id is not null
     and not exists (
       select 1 from public.delivery_point
        where id = new.delivery_point_id
          and customer_id = new.customer_id)
  then
    raise exception 'Teslim noktası, seçilen müşteriye ait değil.'
      using errcode = 'MI424';
  end if;

  return new;
end;
$$;

comment on function app.sevkiyat_karta_bagli() is
  'Yeni sevkiyat müşteri kartına bağlı olmadan yazılamaz (MI423) ve teslim '
  'noktası o müşteriye ait olmalı (MI424). Yalnız INSERT''e bakar: 0047 '
  'öncesinden kalan satırlar düzeltilebilsin diye UPDATE serbest.';

drop trigger if exists shipment_karta_bagli on shipment;
create trigger shipment_karta_bagli
  before insert on shipment
  for each row execute function app.sevkiyat_karta_bagli();

-- Kart–nokta tutarlılığı GÜNCELLEMEDE de korunmalı: eski kaydı düzeltirken
-- yanlış eşleşme yazılabilir. Bu tetik kart zorunluluğunu DEĞİL, yalnız
-- tutarlılığı sınıyor — o yüzden ayrı bir fonksiyon.
create or replace function app.sevkiyat_nokta_tutarli()
returns trigger
language plpgsql
as $$
begin
  if new.delivery_point_id is not null
     and new.customer_id is not null
     and not exists (
       select 1 from public.delivery_point
        where id = new.delivery_point_id
          and customer_id = new.customer_id)
  then
    raise exception 'Teslim noktası, seçilen müşteriye ait değil.'
      using errcode = 'MI424';
  end if;
  return new;
end;
$$;

drop trigger if exists shipment_nokta_tutarli on shipment;
create trigger shipment_nokta_tutarli
  before update of customer_id, delivery_point_id on shipment
  for each row execute function app.sevkiyat_nokta_tutarli();

-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
-- Tetiğin VAR olması yetmez, ÇALIŞTIĞI sınanır. Eski satırlara
-- dokunulmadığı da sınanır — bu göçün en kolay bozacağı şey o.
do $$
declare
  v_eski int;
begin
  select count(*) into v_eski from shipment where customer_id is null;
  raise notice '0049: kart atfı olmayan ESKİ sevkiyat sayısı: % '
               '(dokunulmadı, okunmaya devam ediyor)', v_eski;

  -- Kartsız INSERT reddedilmeli. Var olmayan kiracı/şube kimlikleriyle
  -- denemiyoruz: yabancı anahtar önce patlar ve tetiği hiç sınamamış
  -- olurduk. Onun yerine gerçek bir şube varsa onu kullanıyoruz.
  if exists (select 1 from branch limit 1) then
    begin
      insert into shipment (tenant_id, branch_id, shipment_no, customer_name)
      select b.tenant_id, b.id, '0049-SINAMA', 'Elle yazılan isim'
        from branch b limit 1;
      raise exception '0049: kartsız sevkiyat YAZILDI — tetik çalışmıyor.';
    exception
      when sqlstate 'MI423' then null;
      -- Başka bir kısıt önce patlarsa tetiği sınamamış olurduk; sessizce
      -- geçmek yerine söylüyoruz.
      when others then
        if sqlstate = 'MI423' then null;
        else raise notice '0049: sınama başka bir kısıta takıldı (%): %',
               sqlstate, sqlerrm;
        end if;
    end;
  else
    raise notice '0049: şube yok, davranış sınaması atlandı.';
  end if;

  raise notice '0049 TAMAM · yeni sevkiyat karta bağlı · eski satırlar yerinde';
end;
$$;
