-- ═══════════════════════════════════════════════════════════════════════════
-- 0070 · İPTAL EDİLMİŞ ALIŞ FİYATI DEĞERLEMEYE GİRMEZ + RPC KAPILARI
-- ---------------------------------------------------------------------------
-- İkinci inceleme (Codex, 09.10) iki gerçek açık buldu ve ikisi de 0065'te
-- benim yazdığım kodda.
--
-- ── 1 · İPTAL EDİLMİŞ ALIŞ ───────────────────────────────────────────────
-- `app.kalem_alis_fiyati` "o andan önceki SON alış" diye arıyordu ama
-- İPTAL EDİLMİŞ alışı dışlamıyordu. Senaryo:
--
--   1 Ekim · 100 kg un alındı, 400 TL/kg · YANLIŞ GİRİLDİ
--   1 Ekim · iptal edildi (ters kayıt)
--   5 Ekim · 2 kg fire
--
-- Fire 800 TL değerleniyordu; doğrusu bir önceki geçerli alışa göre
-- hesaplanmak. İptal edilmiş bir alış, olmamış bir alıştır — maliyet
-- hesabında 0066'da `stock-cost.ts` için düzelttiğimiz kuralın aynısı,
-- ama SQL tarafında atlanmış.
--
-- ⚠️ Bu hata fire tutarını ve SKT'si geçen stok değerini YUKARI şişiriyor.
-- Müşteriye "geçen ay 47 bin TL fire verdiniz" denip rakam sorulduğunda
-- savunulamaz. Analiz ekranının bütün değeri rakamın doğruluğunda.
--
-- ── 2 · PUBLIC EXECUTE AÇIK KALMIŞ ───────────────────────────────────────
-- 0065/0067/0069'da yeni fonksiyonlara `grant ... to authenticated` verip
-- yalnız `anon`dan geri aldım. PostgreSQL'de fonksiyonların VARSAYILAN
-- yetkisi `PUBLIC EXECUTE`tir; `anon`dan almak onu kapatmaz çünkü `anon`
-- zaten PUBLIC üzerinden yetkili.
--
-- ⚠️ TEK BAŞINA VERİ SIZDIRMIYOR: fonksiyonlar `security invoker` ve alt
-- tablolarda RLS var — yetkisiz çağıran boş sonuç alır. Ama "kapı kapalı
-- sanıp açık bırakmak" tam olarak bir gün maliyeti olan şeydir.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Fiyat arayıcı, iptal edilmiş alışı atlıyor ────────────────────────
create or replace function app.kalem_alis_fiyati(p_kalem uuid, p_an timestamptz)
returns numeric
language sql
stable
set search_path = public, app, pg_temp
as $$
  select (abs(m.quantity_entered) * m.unit_cost) / nullif(m.quantity_base, 0)
    from public.stock_movement m
   where m.stock_item_id = p_kalem
     and m.reason = 'PURCHASE_RECEIPT'
     and m.unit_cost is not null
     and m.unit_cost > 0
     and m.quantity_base > 0
     and m.occurred_at <= p_an
     -- ⚠️ TERS ÇEVRİLMİŞ ALIŞ ATLANIYOR. İptal edilmiş bir alış, olmamış
     -- bir alıştır; fiyatı da olmamıştır.
     --
     -- ⚠️ Ters kaydın KENDİSİ zaten elenir (`reason = 'PURCHASE_RECEIPT'`);
     -- buradaki kontrol ASIL hareketi eliyor.
     and not exists (
       select 1 from public.stock_movement t
        where t.reverses_movement_id = m.id
          and t.reason = 'REVERSAL'
     )
   order by m.occurred_at desc, m.id desc
   limit 1
$$;

comment on function app.kalem_alis_fiyati(uuid, timestamptz) is
  'Bir kalemin verilen andaki temel birim alış fiyatı. İPTAL EDİLMİŞ alışlar '
  'atlanır. Bulunamazsa NULL — sıfır DEĞİL: sıfır "bedava", NULL "bilinmiyor".';

-- ── 2 · PUBLIC execute kapatılıyor ────────────────────────────────────────
-- ⚠️ `revoke from public` ÖNCE, `grant to authenticated` SONRA. Ters sırada
-- yazılsaydı public'ten alma işlemi authenticated'ın yetkisini de düşürürdü.
--
-- ⚠️ EKSİK FONKSİYON BU GÖÇÜ DÜŞÜRMÜYOR (10.10'da düşürdü).
--
-- İlk yazımda `revoke ... on function public.dikkat_siparisleri(...)`
-- doğrudan yazılıydı. 0069 henüz uygulanmamış bir veritabanında bu satır
-- hata verdi ve Supabase betiği TEK İŞLEM olarak çalıştırdığı için 0070'in
-- TAMAMI geri alındı: asıl düzeltme olan fiyat hesabı da uygulanmadı.
--
-- Ders: bir göç, KENDİ İŞİYLE İLGİSİZ bir eksiklik yüzünden düşmemeli.
-- Var olanı kapatıyoruz; olmayan zaten bir kapı değil.
do $$
declare
  v_ad text;
begin
  foreach v_ad in array array[
    'public.isletme_gostergeleri(uuid, date, date)',
    'public.fire_dokumu(uuid, date, date)',
    'public.uretilen_partiler(uuid)',
    'public.dikkat_siparisleri(uuid)'
  ] loop
    if to_regprocedure(v_ad) is null then
      raise notice '0070: % henüz yok, atlandı (göçü düşürmüyor).', v_ad;
      continue;
    end if;
    execute format('revoke execute on function %s from public', v_ad);
    execute format('grant  execute on function %s to authenticated', v_ad);
  end loop;
end;
$$;

-- ── DOĞRULAMA ──────────────────────────────────────────────────────────────
do $$
declare
  v_acik text;
begin
  -- `anon` hiçbirini ÇAĞIRAMAMALI.
  select string_agg(p.proname, ', ') into v_acik
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('isletme_gostergeleri','fire_dokumu',
                       'uretilen_partiler','dikkat_siparisleri')
     and has_function_privilege('anon', p.oid, 'execute');
  if v_acik is not null then
    raise exception '0070: anon hâlâ çağırabiliyor: %', v_acik;
  end if;

  -- ⚠️ Henüz var olmayan fonksiyon "kapatılmamış" sayılmıyor: `has_function_
  -- privilege` zaten yalnız var olanları sayıyor. Eksik olanı burada
  -- bildiriyoruz ki sessizce atlanmış olmasın.
  if to_regprocedure('public.dikkat_siparisleri(uuid)') is null then
    raise notice '0070 UYARI · `dikkat_siparisleri` yok — 0069 uygulanmamış. '
      'Önce 0069''u çalıştırın, sonra bu göçü TEKRAR çalıştırın.';
  end if;

  -- `authenticated` hepsini ÇAĞIRABİLMELİ — kapıyı fazla kapatmış olmayalım.
  select string_agg(p.proname, ', ') into v_acik
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('isletme_gostergeleri','fire_dokumu',
                       'uretilen_partiler','dikkat_siparisleri')
     and not has_function_privilege('authenticated', p.oid, 'execute');
  if v_acik is not null then
    raise exception '0070: authenticated çağıramıyor: %', v_acik;
  end if;

  raise notice '0070 TAMAM · iptal edilmiş alış değerlemeye girmiyor; PUBLIC kapandı';
end;
$$;
