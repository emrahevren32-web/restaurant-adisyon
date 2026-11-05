-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Göç 0105 · YENİ ÜRÜN KARTI KDV ORANINI İŞLETMEDEN ALSIN
--            · HEDEFLER 3.4.7 · Emrah'ın kararı (01.11.2026)
--
-- ── SORUN ─────────────────────────────────────────────────────────────────
-- 0103 işletme geneli bir KDV oranı açtı (`tenant_settings.vat_rate`) ve
-- İşletme Ayarları ekranı onu yazıyor. Ölçüldü (01.11): o değer **hiçbir
-- yerde kullanılmıyordu.** Ekran yalan söylemiyordu ama VERİLMEMİŞ BİR
-- SÖZÜN BEKLENTİSİNİ doğuruyordu: kullanıcı bir oran giriyor ve hiçbir şey
-- olmuyor. Ekrana geçici olarak *"Bu oran şu an yalnızca burada saklanıyor"*
-- cümlesi konmuştu — dürüst ama kalıcı bir cevap değil.
--
-- Emrah'ın kararı: *"KDV oranını firmanın şirket profili içinde kullanıcının
-- belirlemesini isteyelim."* Alan zaten orada; eksik olan KULLANILMASIYDI.
--
-- ── KARAR · ORAN YENİ ÜRÜN KARTINA VARSAYILAN OLARAK GEÇER ────────────────
-- `stock_item.vat_rate` boş bırakılırsa, kayıt yazılırken işletme geneli
-- oran KOPYALANIR. Kopyalanır — bağlanmaz: sonradan işletme oranı değişirse
-- eski ürünlerin oranı DEĞİŞMEZ. Bir ürünün vergisi kaydedildiği günün
-- cevabıdır; geçmişe dönük oran değişimi faturayı bozar.
--
-- ⚠️ BU, 0052'DEKİ ZİNCİRİN ÜÇÜNCÜ HALKASI. Zaten şöyle işliyordu:
--      sipariş satırı  ←(0052 tetiği)←  ürün kartı
-- Şimdi başına bir halka ekleniyor:
--      sipariş satırı  ←  ürün kartı  ←(0105 tetiği)←  işletme ayarı
-- Yani kural yeni değil, zincir TAMAMLANIYOR. 0052'nin kendi yorumunda
-- yazan gerekçe burada da geçerli: *"Sistem üretsin daha stabil olur,
-- uğraştırmayalım insanları."*
--
-- ── NEDEN EKRANDA DEĞİL VERİTABANINDA ─────────────────────────────────────
-- Ekran alanı önceden doldurulabilirdi. Yapılmadı: o zaman kural İKİ YERDE
-- olurdu (ekran + veritabanı) ve Excel'den toplu ürün yüklendiğinde,
-- portaldan kayıt açıldığında ya da ileride bir API'den yazıldığında
-- çalışmazdı. MIYOP-081'in dersi: *"gerekçe ekran kuralı değil SERVİS
-- kuralıdır."* Ekranın işi kuralı UYGULAMAK değil, AÇIKLAMAK.
--
-- ── ⚠️ UYDURMA VARSAYILAN DEĞİL · MIYOP-060b ──────────────────────────────
-- Değişmez kural: *"Sorulmamış soruya varsayılan cevap yazılmaz."* Burada
-- çiğnenmiyor, çünkü kopyalanan değer UYDURMA DEĞİL — kullanıcının kendi
-- girdiği işletme oranı. İşletme oranı da boşsa (`null`), ürünün oranı
-- **boş kalır**. "Belirlenmemiş" geçerli bir cevaptır; `0` ya da `10`
-- yazmak olurdu *mış gibi* yapmak.
--
-- ── ⚠️ YALNIZ INSERT · UPDATE'E DOKUNULMUYOR ──────────────────────────────
-- Bir kullanıcı var olan bir ürünün KDV oranını BİLEREK silebilir
-- ("bu üründe oran belirsiz"). UPDATE'te de doldursaydık o silmeyi sessizce
-- geri alırdık — kullanıcının kararını ezmek olurdu. 0052'nin tetiği de
-- yalnız INSERT'tir; aynı karar.
--
-- ── ⚠️ `security definer` ve SEBEBİ · 05.11.2026'da DÜZELTİLDİ ──────────
-- !! BURADA ÖNCE YANLIŞ BİR GEREKÇE YAZIYORDU (Codex buldu, ölçtüm):
-- *"`company.read` izni olmayan bir depo sorumlusu satırı GÖREMEZ"* deniyordu.
-- Tutmuyor. 0103 ölçüldü:
--     grant select, insert, update on public.tenant_settings to authenticated;
--     create policy tenant_settings_tenant_isolation on public.tenant_settings
--       using (tenant_id = app.current_tenant_id());
-- Yani hak `authenticated` rolünün TAMAMINA verilmiş ve politika yalnız
-- KİRACI EŞİTLİĞİNE bakıyor; hiçbir izin adı sorulmuyor. Depo sorumlusu
-- kendi kiracısının ayar satırını okuyabilir. Demek ki `security definer`
-- bu sebeple GEREKLİ DEĞİL.
--
-- Peki neden duruyor? Bugünkü hakka DEĞİL, yarınki daralmaya karşı:
-- `tenant_settings` üzerindeki grant ya da politika bir gün daraltılırsa
-- (ör. ayarları yalnız yöneticiye açmak), bu tetik SESSİZCE oranı boş
-- bırakmaya başlardı — kural bazı rollerde çalışır, bazılarında çalışmaz
-- olurdu. Sessiz bir kısmî kural, kuralsızlıktan kötüdür. `definer`
-- kuralı o değişiklikten bağımsız kılıyor.
-- Kapı genişletilmiyor: fonksiyon yalnız `new.tenant_id`nin satırını
-- OKUYOR, hiçbir şey yazmıyor, dışarıya veri döndürmüyor. Başka bir
-- kiracının satırını okutmak mümkün değil; `stock_item`ın kendi RLS'i
-- zaten o kiracıyı sınırlıyor.
--
-- ⚠️ Ders (tuzak 185): bir gerekçe, ÖLÇÜLMEDEN yazılırsa belge olmaz.
-- "RLS altında" demek "izin adı sorulur" demek değildir; politikanın
-- metnine bakılır.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · TETİK FONKSİYONU ──────────────────────────────────────────────────
create or replace function app.urun_kdv_isletmeden()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Açıkça bir oran verilmişse DOKUNULMAZ. Kullanıcının cevabı üstündür.
  if new.vat_rate is null then
    select ts.vat_rate into new.vat_rate
      from public.tenant_settings ts
     where ts.tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;

comment on function app.urun_kdv_isletmeden() is
  'Yeni ürün kartı yazılırken KDV oranını işletme ayarlarından KOPYALAR. '
  'Açıkça oran verilmişse dokunmaz; işletme oranı da boşsa boş bırakır. '
  'Kopyadır, bag degildir: isletme orani sonradan degisirse eski urunler '
  'degismez.';

revoke all on function app.urun_kdv_isletmeden() from public;

-- ⚠️ `before insert`: YAZILMAKTA OLAN satırı değiştiriyor, başka tabloya
-- yazmıyor (yalnız okuyor). Başka tabloya yazsaydı AFTER olmak zorundaydı
-- (0032 tuzağı). Denetim tetiği (`denetim_stock_item`) AFTER'dır ve satırın
-- SON hâlini yazar — yani defterde oranın kopyalanmış hâli görünür, doğrusu
-- da budur.
drop trigger if exists stock_item_kdv on public.stock_item;
create trigger stock_item_kdv
  before insert on public.stock_item
  for each row execute function app.urun_kdv_isletmeden();

-- ── 2 · DOĞRULAMA · YALNIZ BU GÖÇÜN YAZDIĞINI ÖLÇER ───────────────────────
do $$
begin
  if to_regprocedure('app.urun_kdv_isletmeden()') is null then
    raise exception '0105: tetik fonksiyonu oluşmadı.';
  end if;

  if not exists (select 1 from pg_trigger
       where tgrelid = 'public.stock_item'::regclass
         and tgname = 'stock_item_kdv' and not tgisinternal) then
    raise exception '0105: stock_item_kdv tetiği yok.';
  end if;

  -- ⚠️ BEFORE INSERT olmak ZORUNDA ve UPDATE'i KAPSAMAMALI.
  -- UPDATE'i de kapsasaydı, kullanıcının bilerek sildiği oranı geri yazardı.
  if not exists (select 1 from pg_trigger
       where tgrelid = 'public.stock_item'::regclass and not tgisinternal
         and tgname = 'stock_item_kdv'
         and tgtype & 2 = 2      -- BEFORE
         and tgtype & 4 = 4      -- INSERT
         and tgtype & 16 = 0) then  -- UPDATE DEĞİL
    raise exception '0105: tetik BEFORE INSERT değil (ya da UPDATE de kapsıyor).';
  end if;

  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app' and p.proname = 'urun_kdv_isletmeden'
         and p.prosecdef) then
    raise exception '0105: fonksiyon security definer değil; tenant_settings hakkı bir gün daraltılırsa oran sessizce boş kalır.';
  end if;

  raise notice '✅ 0105: yeni ürün kartı KDV oranını işletme ayarlarından alıyor.';
end;
$$;
