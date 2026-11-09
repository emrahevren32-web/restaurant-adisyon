-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0112 — NUMUNE ALINMA ZAMANI DA SUNUCUDAN DAMGALANIYOR
--
-- ── NEDEN VAR ────────────────────────────────────────────────────────────
-- ⚠️ BU BİR CODEX BULGUSU DEĞİL. 0109'u yazarken (MIYOP-101) aynı desenin
-- komşu kolonda da durduğunu gördüm ve ölçtüm.
--
-- `app.numune_turet()` imzanın "KİM" tarafını damgalıyordu:
--     new.taken_by := app.aktif_kullanici_id();
-- Ama "NE ZAMAN" tarafı istemciye açıktı. `taken_at` kolonunun
-- `default now()` değeri var (0093) — ne var ki varsayılan, yalnız
-- İSTEMCİ BİR DEĞER GÖNDERMEDİĞİNDE devreye girer. Gönderirse o yazılır.
--
-- ── NE KADAR CİDDİ · ABARTMIYORUM ────────────────────────────────────────
-- ⚠️ Bu, 0109'un kapattığı kusurla AYNI ÖNEMDE DEĞİL. `occurred_at`
-- saklama sonunu hesaplayan kuralın GİRDİSİYDİ; onu kaydırmak kuralı
-- etkisiz bırakıyordu. `taken_at` hiçbir kuralın girdisi değil (ölçüldü:
-- göçlerde `taken_at` yalnız 0093'ün tablo tanımında ve bir indekste
-- geçiyor; `keep_until` partinin SKT'sinden geliyor, `taken_at`ten
-- değil). Yani kaydırılan bir `taken_at` bir kapıyı AÇMIYOR.
--
-- Bozduğu şey defterin KENDİSİ: şahit numune defterinin tek işi bir
-- tartışmada "hangi partinin numunesi, kim aldı, ne zaman aldı"
-- sorularına cevap vermek. "Kim"i sunucuya damgalayıp "ne zaman"ı
-- istemciye bırakmak, aynı satırın yarısına güvenip yarısına
-- güvenmemek demek.
--
-- ⚠️ HİÇBİR EKRAN AKIŞI KIRILMIYOR (ölçüldü):
-- `src/quality/witness-sample.repository.ts > numuneAl()` `taken_at`
-- GÖNDERMİYOR; ekranda böyle bir alan da yok. Yani bugün bu kolona
-- gelen bir değer ancak ekranı atlayan bir yoldan gelebilir.
--
-- ⚠️ İLERİDE "NUMUNE DÜN ALINDI, BUGÜN YAZILIYOR" İHTİYACI ÇIKARSA:
-- çözümü bu damgayı kaldırmak DEĞİL, geriye tarih atmayı **ayrı ve
-- yetkiye bağlı** bir yola koymaktır (0087'nin deseni). Damgayı kaldırmak,
-- herkese sessizce geriye tarih atma hakkı vermek olur.
--
-- ── NE DEĞİŞMİYOR ────────────────────────────────────────────────────────
-- 0094'ün bütün kuralları yerinde: kiracı sunucudan, parti/şube/iş emri
-- kiracı doğrulamalı, saklama sonu partinin SKT'sinden, saklama koşulu ve
-- açık raf ömrü ÜRÜN KARTINDAN, kimlik anahtarı sunucuda.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.numune_turet()
returns trigger
language plpgsql security definer set search_path = public, app, pg_temp
as $$
declare
  v_kiraci     uuid;
  v_skt        date;
  v_kosul      text;
  v_kalem      uuid;
  v_lot_kiraci uuid;
  v_acik       integer;
begin
  -- ⚠️ KİRACI SUNUCUDAN. İstemcinin gönderdiği `tenant_id` yok sayılıyor;
  -- 0081/0087'nin "imza istemciden gelmez" deseni kiracıya da uygulanıyor.
  -- Bunun yazılmaması MIYOP-075'in yarısıydı.
  v_kiraci := app.current_tenant_id();
  if v_kiraci is null then
    raise exception 'MİYOP: oturumda işletme kimliği yok; numune yazılamaz.'
      using errcode = 'MI403';
  end if;
  new.tenant_id := v_kiraci;

  -- ⚠️ PARTİ KENDİ KİRACIMIZIN MI? Doğrulanmazsa başka müşterinin
  -- partisinin SKT'si ve saklama koşulu okunabiliyordu.
  select l.expires_on, l.stock_item_id, l.tenant_id
    into v_skt, v_kalem, v_lot_kiraci
    from public.stock_lot l where l.id = new.lot_id;

  -- ⚠️ "YOK" ile "BAŞKASININ" AYNI MESAJI VERİYOR, bilerek. Ayrı mesaj
  -- vermek, denemeyle başka bir kiracıda o id'nin VAR olduğunu
  -- doğrulatırdı.
  if v_kalem is null or v_lot_kiraci is distinct from v_kiraci then
    raise exception 'MİYOP: numunenin partisi bulunamadı.' using errcode = 'MI404';
  end if;

  -- Kalem partiden gelir: istemcinin gönderdiği kalem yanlışsa düzeltilir.
  new.stock_item_id := v_kalem;

  -- ⚠️ ŞUBE de kendi kiracımızın olmalı.
  if not exists (select 1 from public.branch b
                  where b.id = new.branch_id and b.tenant_id = v_kiraci) then
    raise exception 'MİYOP: numunenin şubesi bulunamadı.' using errcode = 'MI404';
  end if;

  -- ⚠️ İŞ EMRİ de. Boş kalabilir (açılış bakiyesi gibi partiler var).
  if new.work_order_id is not null
     and not exists (select 1 from public.work_order w
                      where w.id = new.work_order_id and w.tenant_id = v_kiraci) then
    raise exception 'MİYOP: numunenin iş emri bulunamadı.' using errcode = 'MI404';
  end if;

  if v_skt is null then
    raise exception
      'MİYOP: bu partinin son kullanma tarihi yok; şahit numunenin saklama '
      'sonu hesaplanamaz. Önce partiye SKT yazın.'
      using errcode = 'MI422';
  end if;
  -- ⚠️ TÜRETİLİYOR (0093 kural 1). İstemci ne gönderirse göndersin.
  new.keep_until := v_skt;

  select nullif(btrim(i.storage_condition), ''), i.opened_shelf_life_days
    into v_kosul, v_acik
    from public.stock_item i where i.id = v_kalem;

  if v_kosul is null then
    raise exception
      'MİYOP: bu ürünün saklama koşulu tanımlı değil. Şahit numune, '
      'müşteriye bildirilen koşulun AYNISINDA saklanmak zorunda; önce ürün '
      'kartına saklama koşulunu yazın.'
      using errcode = 'MI422';
  end if;
  -- ⚠️ KOPYALANIYOR (0093 kural 3). Ekranın yazdığı değer yok sayılıyor.
  new.storage_condition := v_kosul;
  -- ⚠️ AÇIK RAF ÖMRÜ DE KOPYALANIYOR (0094). Ekran yazamaz.
  new.opened_shelf_life_days := v_acik;

  -- ⚠️ TEKİLLİK ANAHTARI SUNUCUDA (0094 · 4. madde). İstemcinin gönderdiği
  -- anahtar yok sayılıyor; yoksa aynı kod iki kez yazılabilirdi.
  new.sample_code_key := app.kimlik_anahtari(new.sample_code);

  -- ⚠️ İmza sunucuda (0081/0087 deseni) — "kim" VE "ne zaman".
  -- ⚠️ 0112: `taken_at` de damgalanıyor. Eskiden kolonun `default now()`
  -- değeri vardı ama istemci gönderirse O yazılıyordu: "kim" damgalanıp
  -- "ne zaman" istemciye bırakılmıştı. Ekran bu alanı HİÇ göndermiyor
  -- (ölçüldü: `witness-sample.repository.ts > numuneAl()`), yani
  -- gönderilen bir değer ancak ekranı atlayan bir yoldan gelir.
  new.taken_at := now();
  new.taken_by := app.aktif_kullanici_id();
  new.status   := 'SAKLANIYOR';

  return new;
end $$;

revoke all on function app.numune_turet() from public;
revoke all on function app.numune_turet() from anon;
revoke all on function app.numune_turet() from authenticated;


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
-- ⚠️ TUZAK 181/194: `pg_get_functiondef` yorumları da döndürür ve bu göçün
-- kendi yorumları yasakladığı metni içeriyor. Ölçümden önce yorumlar
-- siliniyor.
do $$
declare v_govde text;
begin
  select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'numune_turet';

  if v_govde is null then
    raise exception '0112 DOGRULAMA: app.numune_turet() bulunamadi.';
  end if;

  if v_govde !~ 'new\.taken_at\s*:=\s*now\(\)' then
    raise exception '0112 DOGRULAMA: alinma zamani sunucuda damgalanmiyor.';
  end if;
  if v_govde !~ 'new\.taken_by\s*:=\s*app\.aktif_kullanici_id\(\)' then
    raise exception '0112 DOGRULAMA: imzanin KIM tarafi dustu.';
  end if;

  -- 0094'un kapilari yerinde mi? Bir kapiyi onarirken digerini dusurmemek
  -- icin olculuyor.
  if v_govde !~ 'app\.current_tenant_id\(\)' then
    raise exception '0112 DOGRULAMA: kiraci siniri dustu (MIYOP-075).';
  end if;
  if v_govde !~ 'app\.kimlik_anahtari' then
    raise exception '0112 DOGRULAMA: kimlik anahtari sunucuda turetilmiyor.';
  end if;
  if v_govde !~ 'opened_shelf_life_days' then
    raise exception '0112 DOGRULAMA: acik raf omru karttan kopyalanmiyor.';
  end if;
  if v_govde !~ 'storage_condition' then
    raise exception '0112 DOGRULAMA: saklama kosulu karttan kopyalanmiyor.';
  end if;
  if v_govde !~ 'MI422' then
    raise exception '0112 DOGRULAMA: SKT ve saklama kosulu zorunlulugu dustu.';
  end if;

  if not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                  where c.relname = 'witness_sample' and g.tgname = 'numune_turet'
                    and not g.tgisinternal) then
    raise exception '0112 DOGRULAMA: numune_turet tetigi bagli degil.';
  end if;

  raise notice '0112 TAMAM · numune imzasinin KIM ve NE ZAMAN tarafi da '
    'sunucudan damgalaniyor.';
end $$;


-- ── ÖZET ──────────────────────────────────────────────────────────────────
select 'alinma zamani (taken_at)' as ne, 'sunucu damgasi (now())' as deger
union all
select 'alan kisi (taken_by)', 'sunucu damgasi (aktif kullanici)'
union all
select 'istemcinin gonderdigi taken_at', 'yok sayiliyor'
union all
select 'dogrulama', 'gecti';
