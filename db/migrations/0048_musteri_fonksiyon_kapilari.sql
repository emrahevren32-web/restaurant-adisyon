-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0048 — MÜŞTERİ FONKSİYONLARI İÇİN PUBLIC KAPISI
-- ═══════════════════════════════════════════════════════════════════════════
-- 0047 iki karar fonksiyonu kurdu: `app.musteri_fiyati` ve
-- `app.siparis_penceresi`. İkisi de `app` şemasında ve TARAYICIDAN
-- ÇAĞRILAMIYOR.
--
-- ── NİÇİN ─────────────────────────────────────────────────────────────────
-- PostgREST yalnızca `public` şemasını yayınlar. `app` şemasındaki bir
-- fonksiyon veritabanında vardır, çalışır, ama API'de YOKTUR. Bu tuzağa daha
-- önce lisans ekranında düşüldü (0043): fonksiyon yazıldı, ekran çağırdı,
-- "function not found" geldi.
--
-- ── NİÇİN KURALI KOPYALAMIYORUZ ──────────────────────────────────────────
-- En kolay yol, fiyat seçimini ve pencere çözümünü ekranda yeniden yazmaktı:
-- ekran iki seviyeyi de okuyor, `coalesce`i kendisi yapabilir. Yapmıyoruz.
-- Kural iki yerde durursa AYRIŞIR — ve ayrıştığı gün ekran bir fiyat
-- gösterip fatura başka bir fiyat keser. Sarmalayıcı ince: kuralın kendisi
-- hâlâ tek yerde, `app` içinde.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · FİYAT ─────────────────────────────────────────────────────────────
-- ⚠️ `security definer` DEĞİL ve olmayacak. Çağıranın RLS'i geçerli kalmalı:
-- başka kiracının teslim noktasının kimliği elle gönderilirse fonksiyon o
-- satırları GÖRMEMELİ ve boş dönmeli. Definer yapmak, kiracı yalıtımını
-- fonksiyon üzerinden delmek olurdu.
create or replace function public.musteri_fiyati(
  p_nokta uuid,
  p_kalem uuid,
  p_tarih date default null
)
returns numeric
language sql
stable
as $$
  select app.musteri_fiyati(p_nokta, p_kalem, coalesce(p_tarih, current_date));
$$;

comment on function public.musteri_fiyati(uuid, uuid, date) is
  'app.musteri_fiyati için PostgREST kapısı (0047). Kural app içinde, '
  'burada yalnız çağrı var. `security definer` DEĞİL: kiracı yalıtımı '
  'çağıranın RLS''iyle korunuyor.';

-- ── 2 · SİPARİŞ PENCERESİ ─────────────────────────────────────────────────
create or replace function public.siparis_penceresi(p_nokta uuid)
returns table (
  kesim_saati time,
  gun_farki   smallint,
  kaynak      text
)
language sql
stable
as $$
  select * from app.siparis_penceresi(p_nokta);
$$;

comment on function public.siparis_penceresi(uuid) is
  'app.siparis_penceresi için PostgREST kapısı (0047). `kaynak` alanı '
  'pencerenin noktadan mı müşteriden mi geldiğini söyler; ekranda gösteriliyor.';

-- ── 3 · ERİŞİM ────────────────────────────────────────────────────────────
-- ⚠️ RLS ve GRANT ayrı kapılardır (0006). Fonksiyonun var olması yetmez,
-- çağırma yetkisi de verilmeli. `anon`a VERİLMİYOR: fiyat ticari bilgidir,
-- oturumsuz bir istek görmemeli.
revoke all on function public.musteri_fiyati(uuid, uuid, date) from public, anon;
revoke all on function public.siparis_penceresi(uuid) from public, anon;
grant execute on function public.musteri_fiyati(uuid, uuid, date) to authenticated;
grant execute on function public.siparis_penceresi(uuid) to authenticated;

-- ── 4 · DOĞRULAMA ─────────────────────────────────────────────────────────
-- "Fonksiyonu yazdım" demek yetmez; çağrılabildiği ve `anon`un
-- çağıramadığı sınanır.
do $$
declare
  v_anon_gorebiliyor boolean;
begin
  -- Var olmayan bir nokta için boş dönmeli, HATA VERMEMELİ. Ekran bir
  -- noktayı henüz seçmemişken de bu yolu çağırabilir.
  if public.musteri_fiyati(gen_random_uuid(), gen_random_uuid()) is not null then
    raise exception '0048: bilinmeyen nokta için fiyat döndü.';
  end if;

  perform * from public.siparis_penceresi(gen_random_uuid());

  select has_function_privilege('anon', 'public.musteri_fiyati(uuid,uuid,date)', 'execute')
    into v_anon_gorebiliyor;
  if v_anon_gorebiliyor then
    raise exception '0048: anon rolü fiyat fonksiyonunu çağırabiliyor. '
                    'Fiyat ticari bilgidir, oturumsuz istek görmemeli.';
  end if;

  raise notice '0048 TAMAM · public kapıları açık · anon dışarıda';
end;
$$;
