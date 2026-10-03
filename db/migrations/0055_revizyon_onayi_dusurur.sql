-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0055 — MİKTAR REVİZYONU ONAYI DÜŞÜRÜR VE SİPARİŞİ ONAYA GERİ ALIR
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ 0053'TE AÇIK KALAN DELİK. Bulunması: onay bildirimini yazarken.
--
-- 0053 onayı revizyona bağladı: `app.siparis_onayi_tam()` yalnız GÜNCEL
-- revizyonun kararlarına bakıyor. Ama kapı SADECE "Onaylandı"ya GEÇERKEN
-- çalışıyordu.
--
-- Sonuç: onaylanmış bir siparişe yeni bir MİKTAR revizyonu yazıldığında
-- onaylar geçersizleşiyor AMA sipariş "Onaylandı" olarak kalıyordu. Üretim
-- onaylanmamış bir miktarı hazırlamaya devam ederdi ve bunu kimse görmezdi.
-- Tam olarak zincirin engellemek için var olduğu şey.
--
-- ── KURAL ─────────────────────────────────────────────────────────────────
-- Sevk edilmemiş bir siparişe MİKTAR revizyonu gelirse sipariş
-- "Onay Bekliyor"a geri döner. Zincir yeniden işler.
--
-- LOJİSTİK revizyonu düşürmez: nokta ya da tarih değişti, MİKTAR aynı.
-- Emrah'ın kuralı: "a noktasına değil b noktasına olur" — bu, üretimi
-- yeniden onaylatmayı gerektirmez. Yine de olay defterine yazılıyor.
--
-- Sevk edilmiş siparişe dokunulmuyor: orada miktar revizyonu zaten bir FARK
-- kaydına bağlı (0050, MI425) ve mal yola çıkmış durumda.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · DURUM AKIŞI: ONAYA GERİ DÖNÜŞ ─────────────────────────────────────
-- ⚠️ Bu tablo TS tarafında `IZINLI_GECISLER` olarak da duruyor ve bir test
-- onu BURADAN okuyup karşılaştırıyor. İkisi ayrışırsa test kırmızıya döner.
create or replace function app.siparis_durumu_gecerli()
returns trigger
language plpgsql
as $$
declare
  v_izinli text[];
begin
  if new.status is distinct from old.status then
    v_izinli := case old.status
      when 'Taslak'        then array['Onay Bekliyor','İptal']
      when 'Onay Bekliyor' then array['Onaylandı','Taslak','İptal']
      -- Onaya GERİ dönüş: miktar değiştiyse zincir yeniden işlemeli.
      when 'Onaylandı'     then array['Hazırlanıyor','Onay Bekliyor','İptal']
      when 'Hazırlanıyor'  then array['Hazır','Onay Bekliyor','İptal']
      when 'Hazır'         then array['Kısmi Sevk','Sevk Edildi','Onay Bekliyor','İptal']
      when 'Kısmi Sevk'    then array['Sevk Edildi','Teslim Edildi']
      when 'Sevk Edildi'   then array['Kısmi Sevk','Teslim Edildi']
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

-- ── 2 · REVİZYON GELİNCE ONAYA GERİ AL ────────────────────────────────────
-- ⚠️ AFTER tetiği: başka tabloya (sales_order) YAZIYOR. BEFORE olsaydı
-- revizyon satırı henüz yazılmamış olurdu (0032 tuzağı).
--
-- ⚠️ `current_revision` alanını bu tetik GÜNCELLEMİYOR; onu yazan yer
-- değişmedi. Burada yalnız DURUM geri alınıyor.
create or replace function app.revizyon_onayi_dusurur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_durum text;
begin
  if new.kind <> 'MIKTAR' then return null; end if;

  select status into v_durum from public.sales_order where id = new.order_id;

  -- Sevk edilmiş siparişe dokunulmuyor: orada revizyon zaten bir fark
  -- kaydına bağlı (MI425) ve mal yola çıkmış.
  if v_durum not in ('Onaylandı', 'Hazırlanıyor', 'Hazır') then
    return null;
  end if;

  update public.sales_order
     set status = 'Onay Bekliyor',
         -- Söz verilen tarih de düşüyor: eski söz, eski miktara verilmişti.
         promised_delivery_date = null
   where id = new.order_id;

  insert into public.sales_order_event
    (tenant_id, order_id, kind, from_status, to_status, detail, actor_id)
  values (new.tenant_id, new.order_id, 'DURUM', v_durum, 'Onay Bekliyor',
          'Miktar revizyonu yazıldı; onaylar düştü, zincir yeniden işliyor.',
          new.created_by);

  return null;
end;
$$;

comment on function app.revizyon_onayi_dusurur() is
  'Sevk edilmemiş siparişe MİKTAR revizyonu gelince sipariş "Onay Bekliyor"a '
  'döner ve söz verilen tarih silinir. LOJİSTİK revizyonu düşürmez: miktar '
  'aynı kalıyor.';

drop trigger if exists sales_order_revision_onay_dusur on sales_order_revision;
create trigger sales_order_revision_onay_dusur
  after insert on sales_order_revision
  for each row execute function app.revizyon_onayi_dusurur();

-- ── 3 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_trigger
      where tgrelid = 'public.sales_order_revision'::regclass
        and tgname = 'sales_order_revision_onay_dusur' and not tgisinternal) then
    raise exception '0055: tetik takılmadı.';
  end if;

  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'app' and p.proname = 'siparis_durumu_gecerli'
                and pg_get_functiondef(p.oid) like '%''Onaylandı''     then array[''Hazırlanıyor'',''Onay Bekliyor''%')
  then null; else
    raise exception '0055: Onaylandı → Onay Bekliyor geçişi açılmadı.';
  end if;

  raise notice '0055 TAMAM · miktar revizyonu onayı düşürür · sipariş onaya geri döner';
end;
$$;
