-- ═══════════════════════════════════════════════════════════════════════════
-- 0059 · AMBALAJ BİRİMLERİ — palet, çuval, kasa, paket
-- ---------------------------------------------------------------------------
-- Emrah (03.10.2026): *"birim kısmı kilo, adet vs gibi belirli şeyler
-- arasında olsun. palet, çuval vs.."*
--
-- 0002'de sekiz birim vardı: kg · g · ton · lt · ml · adet · koli · tepsi.
-- Endüstriyel mutfakta sipariş belgesi bunlarla yazılmıyor; müşteri "2 palet",
-- "10 çuval" diyor. Birim listesi gerçeği karşılamıyorsa kullanıcı alana
-- elle yazar — ve 03.10'da tam olarak bu oldu: birim alanına "dasdasd"
-- yazılabildi, sonra karşılama ve teslim farkı o satırı hesaplayamadı.
--
-- ⚠️ BOYUT: hepsi COUNT. Bir paletin kaç kilo olduğu EVRENSEL DEĞİLDİR —
-- ürüne göre değişir. Bu yüzden `uom_conversion`a palet→kg satırı
-- YAZILMIYOR; o çevrim kalem kartındaki `net_qty/net_uom` ile yapılır
-- (0057). Buraya uydurma bir katsayı koymak, bütün tartıları bozardı.
--
-- Yeni tablo YOK, yeni kolon YOK: yalnız referans tablosuna satır ekliyor.
-- ═══════════════════════════════════════════════════════════════════════════

insert into uom (code, name, dimension) values
  ('palet', 'Palet',  'COUNT'),
  ('cuval', 'Çuval',  'COUNT'),
  ('kasa',  'Kasa',   'COUNT'),
  ('paket', 'Paket',  'COUNT')
on conflict (code) do nothing;

-- Aynı birime dönüşüm her zaman 1'dir (0002'deki kural yeni satırlar için de
-- geçerli olsun diye tekrarlanıyor; `on conflict` eskileri bozmuyor).
insert into uom_conversion (from_uom, to_uom, factor)
select code, code, 1 from uom
on conflict (from_uom, to_uom) do nothing;

do $$
declare
  v_eksik text;
begin
  select string_agg(k, ', ') into v_eksik
    from unnest(array['palet','cuval','kasa','paket']) k
   where not exists (select 1 from uom where code = k);

  if v_eksik is not null then
    raise exception '0059: şu birimler eklenemedi: %', v_eksik;
  end if;

  -- Uydurma çevrim olmadığının kanıtı: palet yalnız kendine çevrilebilir.
  if exists (
    select 1 from uom_conversion
     where from_uom = 'palet' and to_uom <> 'palet'
  ) then
    raise exception '0059: palet için evrensel bir çevrim yazılmış — '
      'bir paletin ağırlığı ürüne göre değişir, bu çevrim yanlıştır.';
  end if;

  raise notice '0059 TAMAM · palet · çuval · kasa · paket eklendi (COUNT)';
end;
$$;
