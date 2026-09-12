-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 4 / Güven katmanı
-- 0029 — Yedek günlüğü: "en son ne zaman yedek aldın?"
--
-- ── EMRAH'IN FİKRİ VE GERÇEĞİ ────────────────────────────────────────────
-- Fikir: "Müşteriye bir zamanlama koyalım, otomatik indirsin bilgisayarına."
--
-- Doğru fikir ama TARAYICI BUNU YAPAMAZ. Tarayıcı kapalıyken hiçbir şey
-- çalışmaz; sekme açık olsa bile işletim sistemi uykuya geçince durur. Bir
-- web uygulamasının "her gece 3'te dosya indir" diyebilmesi mümkün değil.
--
-- "Otomatik yedek" diye bir düğme koyup arka planda hiçbir şey yapmamak,
-- tam olarak yasakladığımız şeydir: ...mış gibi yapmak. Üstelik en tehlikeli
-- biçimi — kullanıcı yedeği olduğunu sanır.
--
-- ── BUNUN YERİNE: UNUTTURMAMAK ───────────────────────────────────────────
-- Yapılabilir olan şu: her yedek alışı KAYDETMEK ve üstünden çok geçtiyse
-- kullanıcının yüzüne söylemek. "Son yedek 23 gün önce alındı" uyarısı,
-- çalışmayan bir zamanlayıcıdan kat kat değerlidir.
--
-- Gerçek otomatik yedek A5'te geliyor: Hetzner sunucusunda `cron` +
-- `pg_dump`. Orada tarayıcı yok, makine hep açık. (docs/YEDEKLEME.md)
--
-- ── NEDEN AYRI TABLO, NEDEN tenant'ta BİR KOLON DEĞİL ────────────────────
-- Tek kolon yalnızca SON yedeği bilir. Denetimde sorulan soru "en son ne
-- zaman" değil, "düzenli mi": son altı ayda kaç kez, kim aldı, hangi
-- büyüklükte. Bunun cevabı ancak günlükte olur. Ayrıca kolon güncellenir,
-- günlük yalnızca eklenir — defterle aynı ilke.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists tenant_backup_log (
  id           bigserial primary key,
  tenant_id    uuid not null references tenant(id),
  taken_at     timestamptz not null default now(),
  taken_by     uuid references app_user(id),
  taken_by_name text,

  -- 'export'  → uygulama içi dışa aktarma (bu sürümde tek kaynak)
  -- 'pg_dump' → sunucu dökümü; A5'te cron buraya yazacak
  kind         text not null default 'export'
                 check (kind in ('export', 'pg_dump')),

  row_count    integer,
  byte_size    bigint,
  -- Eksik dosya da kaydedilir; "yedek aldım" demek yetmez, EKSİKSİZ almak
  -- gerekir. Uyarı hesabı yalnızca eksiksiz olanları sayar.
  is_complete  boolean not null default true,
  note         text
);

comment on table tenant_backup_log is
  'Yedek alma günlüğü. Sadece eklenir. "Son yedek ne zaman alındı" ve '
  '"düzenli alınıyor mu" sorularının kaynağı.';

create index if not exists tenant_backup_log_tenant_ix
  on tenant_backup_log (tenant_id, taken_at desc);

-- ── Günlük de değişmez ────────────────────────────────────────────────────
-- Yedek almadığını gizlemenin en kolay yolu, geçmiş kaydı düzeltmektir.
create or replace function app.yedek_gunlugu_degismez()
returns trigger language plpgsql as $$
begin
  raise exception 'Yedek günlüğü değiştirilemez ve silinemez.'
    using errcode = 'MI403';
end $$;

drop trigger if exists tenant_backup_log_degismez on tenant_backup_log;
create trigger tenant_backup_log_degismez
  before update or delete on tenant_backup_log
  for each row execute function app.yedek_gunlugu_degismez();

-- ── Erişim ────────────────────────────────────────────────────────────────
-- ⚠️ RLS ve GRANT ayrı kapılar (bkz. 0006). İkisi de gerekli.
alter table tenant_backup_log enable row level security;

drop policy if exists tenant_backup_log_okuma on tenant_backup_log;
create policy tenant_backup_log_okuma on tenant_backup_log
  for select using (tenant_id = app.current_tenant_id());

-- Yazma: kullanıcı kendi kiracısına yedek kaydı yazabilir. Denetim kaydından
-- farklı olarak burada yazan UYGULAMADIR — çünkü olay veritabanında değil
-- tarayıcıda oluyor (dosya kullanıcının diskine iniyor). Tetikleyici
-- yakalayamaz; yakalayabildiğimiz tek şey uygulamanın haber vermesi.
drop policy if exists tenant_backup_log_yazma on tenant_backup_log;
create policy tenant_backup_log_yazma on tenant_backup_log
  for insert with check (tenant_id = app.current_tenant_id());

revoke all on tenant_backup_log from authenticated, anon;
grant select, insert on tenant_backup_log to authenticated;
grant usage on sequence tenant_backup_log_id_seq to authenticated;

-- ── Doğrulama ─────────────────────────────────────────────────────────────
-- Beklenen: 1 satır (tablo), 1 satır (tetikleyici), 2 satır (politika)
select 'tablo' as ne, count(*)::text as adet from pg_tables
  where schemaname = 'public' and tablename = 'tenant_backup_log'
union all
select 'tetikleyici', count(*)::text from information_schema.triggers
  where event_object_table = 'tenant_backup_log'
union all
select 'politika', count(*)::text from pg_policies
  where tablename = 'tenant_backup_log';
