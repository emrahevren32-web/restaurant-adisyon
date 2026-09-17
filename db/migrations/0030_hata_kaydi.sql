-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 4 / Güven katmanı
-- 0030 — Hata kaydı: "uygulama çöktü, kimse görmedi" olmasın
--
-- ── NEDEN SENTRY DEĞİL ───────────────────────────────────────────────────
-- Sentry iyi bir araçtır ama bir DIŞ SERVİSTİR: hesap, anahtar, üçüncü
-- tarafa giden veri. "Hata takibi" maddesinin amacı hesap açmak değil,
-- uygulama çöktüğünde bunun BİR YERE YAZILMASI. Onu kendi veritabanımızda
-- yapabiliyoruz; Sentry sonradan aynı arayüzün arkasına takılır
-- (src/errors/error-report.ts, HataDefteri).
--
-- Ayrıca KVKV tarafı: müşterinin verisi Almanya'da (ADR-006). Yığın izinin
-- (stack trace) içinde müşteri verisi parçaları bulunabilir. O parçaların
-- üçüncü bir tarafa gitmesi ayrı bir izin sorusudur. Kendi veritabanımızda
-- tutmak bu soruyu hiç doğurmuyor.
--
-- ── KİM OKUR: BİZ. MÜŞTERİ OKUMAZ. ───────────────────────────────────────
-- Bu tabloya `authenticated` rolü SADECE YAZAR, okuyamaz. Select politikası
-- YOK ve select GRANT'ı YOK — yani müşterinin oturumu bu satırları hiçbir
-- yoldan göremez.
--
-- Sebep: yığın izi dosya adları, fonksiyon adları, bazen veri parçaları
-- taşır. Bunlar "müşterinin görmemesi gereken" şeylerdir. Müşteri ekranında
-- sakin bir mesaj ve bir referans numarası görür; ayrıntı burada durur.
-- Biz SQL Editor'den (service_role) okuruz.
--
-- ── KİRACIYI UYGULAMA DEĞİL VERİTABANI YAZAR ─────────────────────────────
-- `tenant_id` ve `reported_by` kolonlarının VARSAYILANI var:
-- `app.current_tenant_id()` ve `app.hata_aktoru()`. Uygulama bu iki alanı
-- HİÇ göndermiyor.
--
-- İki sebep:
--   1. Güvenlik. Gönderen taraf kiracıyı yazabilse, bir kiracı hatayı
--      başka bir kiracının üstüne yazabilirdi.
--   2. Doğruluk. Tarayıcı tarafında hangi kiracıda olduğumuz her zaman
--      bilinmiyor (hata sayfa kurulmadan da olabilir). Veritabanı ise
--      oturumdan bunu her zaman biliyor.
--
-- Giriş ekranında çöken bir şeyin kiracısı yoktur; o zaman varsayılan null
-- olur ve politika `is not distinct from` sayesinde null = null'ı doğru
-- karşılaştırır.
--
-- ⚠️ BİLİNEN SINIR: `anon` rolüne insert VERMİYORUZ. Yani oturum
-- AÇILMADAN önceki çökmeler buraya düşmez — yalnız tarayıcı konsolunda
-- kalır. Açık bir uç noktaya yazma izni vermek, herkesin tabloyu
-- şişirebileceği anlamına gelirdi. A4D'de (başvuru → onay → giriş zinciri)
-- bu kapı yeniden değerlendirilecek; orada oturum öncesi akış gerçek bir
-- iş akışı olacak.
-- ═══════════════════════════════════════════════════════════════════════════

-- Oturumdaki kullanıcının app_user kimliği, tek değer olarak.
-- app.denetim_aktoru() bir tablo döndürüyor; kolon varsayılanı skalar ister.
create or replace function app.hata_aktoru()
returns uuid
language sql stable security definer set search_path = public, app as $$
  select user_id from app.denetim_aktoru()
$$;

create table if not exists client_error (
  id           bigserial primary key,

  -- ⚠️ Varsayılanla dolar, uygulama göndermez. Bkz. başlık.
  tenant_id    uuid references tenant(id) default app.current_tenant_id(),
  occurred_at  timestamptz not null default now(),
  reported_by  uuid references app_user(id) default app.hata_aktoru(),

  -- Aynı hatayı gruplamak için. Mesaj + ilk yığın satırından türetilir,
  -- sayılar ve kimlikler çıkarılarak. "Bu hata 40 kez oldu" sorusunun
  -- cevabı bu kolon olmadan alınamaz.
  fingerprint  text not null,

  -- 'crash'     → React sınırı yakaladı, ekran gitti
  -- 'error'     → yakalanmış ama raporlanan hata
  -- 'unhandled' → window.onerror / unhandledrejection
  kind         text not null default 'crash'
                 check (kind in ('crash', 'error', 'unhandled')),

  message      text not null,
  stack        text,
  route        text,
  user_agent   text,
  extra        jsonb
);

comment on table client_error is
  'Tarayıcıda oluşan hatalar. Sadece eklenir. MÜŞTERİ OKUMAZ: select '
  'politikası ve select yetkisi bilerek yok — yığın izi müşteri ekranına '
  'ait değil.';

create index if not exists client_error_zaman_ix
  on client_error (occurred_at desc);
create index if not exists client_error_parmak_ix
  on client_error (fingerprint, occurred_at desc);

-- ── Hata kaydı da değişmez ────────────────────────────────────────────────
-- Bir hatanın olmadığını göstermenin en kolay yolu kaydı silmektir.
create or replace function app.hata_kaydi_degismez()
returns trigger language plpgsql as $$
begin
  raise exception 'Hata kaydı değiştirilemez ve silinemez.'
    using errcode = 'MI403';
end $$;

drop trigger if exists client_error_degismez on client_error;
create trigger client_error_degismez
  before update or delete on client_error
  for each row execute function app.hata_kaydi_degismez();

-- ── Erişim ────────────────────────────────────────────────────────────────
-- ⚠️ RLS ve GRANT ayrı kapılar (bkz. 0006). İkisi de gerekli.
alter table client_error enable row level security;

-- SELECT POLİTİKASI YOK. Bu bir eksiklik değil, karardır: RLS açıkken
-- politikası olmayan işlem hiç kimseye açık değildir.

-- Yazma: kendi kiracısına (ya da kiracısı yoksa null'a) yazabilir.
-- `is not distinct from`: null = null karşılaştırmasını doğru yapar.
drop policy if exists client_error_yazma on client_error;
create policy client_error_yazma on client_error
  for insert with check (tenant_id is not distinct from app.current_tenant_id());

revoke all on client_error from authenticated, anon;
-- ⚠️ Kolon listesi DAR: tenant_id ve reported_by burada YOK. Yani uygulama
-- onları göndermeye çalışsa bile yetkisi olmaz; varsayılan kazanır.
grant insert (fingerprint, kind, message, stack, route, user_agent, extra)
  on client_error to authenticated;
grant usage on sequence client_error_id_seq to authenticated;

-- ── Doğrulama ─────────────────────────────────────────────────────────────
-- Beklenen: tablo 1 · tetikleyici 1 · politika 1 · okuma yetkisi 0
select 'tablo' as ne, count(*)::text as adet from pg_tables
  where schemaname = 'public' and tablename = 'client_error'
union all
select 'tetikleyici', count(*)::text from information_schema.triggers
  where event_object_table = 'client_error'
union all
select 'politika', count(*)::text from pg_policies
  where tablename = 'client_error'
union all
select 'okuma yetkisi (0 olmali)', count(*)::text
  from information_schema.role_table_grants
  where table_name = 'client_error'
    and privilege_type = 'SELECT'
    and grantee in ('authenticated', 'anon');
