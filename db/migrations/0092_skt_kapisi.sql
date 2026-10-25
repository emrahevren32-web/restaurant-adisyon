-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0092 — SON KULLANMA TARİHİ KAPISI
--
-- ── NEDEN BU GÖÇ VAR ─────────────────────────────────────────────────────
-- 25.10.2026'da ölçüldüğünde şu çıktı: `stock_lot.expires_on` kolonu VAR
-- (0003), indeksi bile var (`stock_lot_expiry_ix`) — ama çıkışta onu
-- zorunlu kılan **hiçbir kapı yoktu.** Yani bugün süresi geçmiş bir parti
-- üretime girebiliyor ya da müşteriye sevk edilebiliyordu.
--
-- Bir endüstriyel mutfakta bu bir kolaylık eksiği değil; gıda güvenliği
-- kapısıdır. HACCP planını kuruyoruz (0024), şoklama CCP'sini otomatik
-- açıyoruz (0079), alerjen beyanını atomik yazıyoruz (0072) — ve süresi
-- geçmiş malın yemeğe girmesini engellemiyoruz. Sıra bu kapıya geldi.
--
-- ⚠️ İSTEMCİ TARAFI DA KUSURLUYDU (Codex, 25.10): `warehouse.service.ts`
-- FEFO sıralaması geçmiş tarihli partileri **elemeden** sıralıyor ve
-- yalnız pozitif bakiye süzülüyor. Yani bakiyesi olan süresi geçmiş bir
-- parti, geçerli partiden ÖNCE seçilebiliyordu. O taraf da aynı turda
-- onarıldı — ama asıl kapı burada: ekranı atlayıp doğrudan istek gönderen
-- de reddedilmeli (tuzak: "ekranda gizlemek koruma değildir").
--
-- ── NEYİ REDDEDİYOR, NEYİ REDDETMİYOR ────────────────────────────────────
-- REDDEDİLEN iki sebep:
--   · PRODUCTION_CONSUME — süresi geçmiş hammadde üretime giremez
--   · SHIPMENT_OUT       — süresi geçmiş ürün müşteriye sevk edilemez
--
-- REDDEDİLMEYENLER ve HER BİRİNİN GEREKÇESİ:
--   · EXPIRY_WRITE_OFF — süresi geçmiş malın ÇIKIŞ YOLU zaten burasıdır.
--     Burayı kapatmak, malı sistemde sonsuza kadar tutmak olurdu.
--   · WASTE / PRODUCTION_WASTE — imha ve fire meşru çıkıştır.
--   · PURCHASE_RETURN — süresi geçmiş malı tedarikçiye GERİ VERMEK
--     istenen davranıştır; engellemek ters etki yapar.
--   · COUNT_SURPLUS / COUNT_SHORTAGE — sayım gerçeği yazar, kural koymaz.
--     Sayımı engellemek, farkı görünmez yapmak olurdu.
--   · TRANSFER_IN / TRANSFER_OUT — taşımak tüketmek değildir; taşındığı
--     yerde tüketim yine bu kapıdan geçer.
--   · SHIPMENT_RETURN / OPENING_BALANCE — giriş hareketleri.
--   · REVERSAL ve `reverses_movement_id` dolu olan HER kayıt — ters kayıt
--     GEÇMİŞİ düzeltir. Bugünün kuralıyla dünün kaydını geri almayı
--     engellemek, yanlış kaydı kalıcı yapardı.
--
-- ⚠️ "SKT'si BUGÜN olan" parti REDDEDİLMEZ. Son kullanma tarihi, ürünün
-- son kullanılabileceği GÜNDÜR. `expires_on < current_date` yazıyoruz,
-- `<=` yazmıyoruz. Bu bir karar; `<=` yazmak bir günlük malı çöpe atardı.
--
-- ⚠️ `expires_on` NULL olan parti reddedilmez: kuru bakliyat gibi SKT
-- taşımayan kalemler var. "Bilinmiyor" ile "geçmiş" aynı şey değildir.
--
-- ── GEÇMİŞ KAYITLARA DOKUNULMUYOR ────────────────────────────────────────
-- Tetikleyici yalnız INSERT'te çalışıyor. Defter append-only; eski
-- satırları bugünün kuralıyla yargılamak hem anlamsız hem imkânsız.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.skt_kapisi()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_skt date;
  v_kod text;
begin
  -- Ters kayıt her zaman geçer: geçmişi düzeltmeyi engellemiyoruz.
  if new.reverses_movement_id is not null or new.reason = 'REVERSAL' then
    return new;
  end if;

  -- Yalnız iki sebep kapıdan geçiyor; gerekçeler başlıkta yazılı.
  if new.reason not in ('PRODUCTION_CONSUME', 'SHIPMENT_OUT') then
    return new;
  end if;

  -- Lotsuz hareket: kontrol edilecek tarih yok.
  if new.lot_id is null then
    return new;
  end if;

  select l.expires_on, l.lot_code into v_skt, v_kod
    from public.stock_lot l
   where l.id = new.lot_id;

  -- SKT taşımayan parti: "bilinmiyor" reddedilmez.
  if v_skt is null then
    return new;
  end if;

  -- ⚠️ `<` kullanıyoruz: SKT günü DAHİL kullanılabilir.
  if v_skt < current_date then
    raise exception
      'MİYOP: "%" partisinin son kullanma tarihi geçmiş (%). Bu parti üretime giremez ve sevk edilemez. Süresi geçmiş malın çıkış yolu imha kaydıdır (EXPIRY_WRITE_OFF).',
      coalesce(v_kod, new.lot_id::text), v_skt
      using errcode = 'MI437';
  end if;

  return new;
end;
$$;

revoke all on function app.skt_kapisi() from public;
revoke all on function app.skt_kapisi() from anon;
revoke all on function app.skt_kapisi() from authenticated;

drop trigger if exists skt_kapisi_stock_movement on public.stock_movement;
create trigger skt_kapisi_stock_movement
  before insert on public.stock_movement
  for each row execute function app.skt_kapisi();


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
declare
  v_var boolean;
begin
  select exists (
    select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
     where c.relname = 'stock_movement'
       and t.tgname  = 'skt_kapisi_stock_movement'
       and not t.tgisinternal
  ) into v_var;

  if not v_var then
    raise exception '0092: skt_kapisi_stock_movement tetikleyicisi oluşmadı.';
  end if;

  -- ⚠️ Fonksiyon doğrudan çağrılamamalı (tuzak 67: fonksiyon varsayılanı
  -- PUBLIC EXECUTE).
  if has_function_privilege('authenticated', 'app.skt_kapisi()', 'execute') then
    raise exception '0092: app.skt_kapisi() authenticated tarafından çağrılabiliyor.';
  end if;

  raise notice '0092: SKT kapısı kuruldu. Reddedilen sebepler: PRODUCTION_CONSUME, SHIPMENT_OUT.';
end $$;
