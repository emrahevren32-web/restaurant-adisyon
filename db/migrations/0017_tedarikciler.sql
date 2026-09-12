-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 2 / Depo çekirdeği
-- 0017 — Tedarikçi kayıtları
--
-- Yol haritası maddesi: "Tedarikçi kayıtları"
--                       Bitti sayılır ki: "Ekle, düzenle, pasife al çalışıyor"
--
-- ── NEDEN AYRI BİR TABLO ─────────────────────────────────────────────────
-- Bugün tedarikçi bilgisi `stock_lot.supplier_name` içinde DÜZ METİN olarak
-- duruyor. Bu, "hangi partiyi kimden aldık" sorusunu cevaplar ama şu soruları
-- cevaplayamaz: bu tedarikçiden bu yıl ne kadar aldık, telefonu ne, bir sorun
-- çıkarsa kimi arayacağız, hangi partileri geri çağırmamız gerekir.
--
-- Aynı tedarikçi "Et Tedarik", "ET TEDARİK A.Ş.", "et tedarik as" diye üç kez
-- yazılınca üçü ayrı tedarikçi olur ve hiçbiri toplanamaz. Geri çağırma
-- senaryosunda bu, bulunamayan parti demektir — ürünün asıl sattığı şey tam
-- olarak buydu.
--
-- ── NEDEN ŞUBEYE DEĞİL KİRACIYA BAĞLI ────────────────────────────────────
-- `stock_item` şube kapsamlıdır çünkü stok fiziksel olarak bir depoda durur.
-- Tedarikçi ise fiziksel değildir: aynı firma bütün şubelere mal satar. Şube
-- kapsamlı yapsaydık, üç şubesi olan bir müşteri aynı tedarikçiyi üç kez
-- girmek zorunda kalırdı ve toplamları yine ayrışırdı.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists supplier (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete restrict,
  code          text not null,
  -- Tekillik bunun üzerinden. `code` kullanıcının yazdığı hâli korur;
  -- `code_key` normalleştirilmiş hâlidir ve uygulamadaki
  -- `core/identifier.ts > normalizeIdentifier()` ile BİREBİR aynı kuralı taşır:
  -- NFC, dört i varyantı (i/ı/I/İ) tek harfe katlanır, sonra büyük harf.
  -- Yerel ayarla küçültme YAPILMAZ — 'ISTANBUL'.toLowerCase('tr') → 'ıstanbul'
  -- olur ve 'istanbul' ile eşleşmez. Bu hata G1'de bir kez yaşandı.
  code_key      text not null,
  name          text not null,
  tax_number    text,
  contact_name  text,
  phone         text,
  email         text,
  address       text,
  notes         text,
  -- Tedarikçi SİLİNMEZ, pasife alınır. Silmek, o tedarikçiden alınmış
  -- partilerin geçmişini kopuk bırakırdı; geri çağırma o geçmişe dayanıyor.
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint supplier_code_unique unique (tenant_id, code_key),
  constraint supplier_name_not_blank check (btrim(name) <> ''),
  constraint supplier_code_not_blank check (btrim(code) <> '')
);

create index if not exists supplier_tenant_ix on supplier (tenant_id, is_active);

-- ── Kiracı yalıtımı (ADR-004) ─────────────────────────────────────────────
-- `force` satırı şart: onsuz tablonun SAHİBİ politikayı atlar ve iki kiracı
-- birbirinin tedarikçilerini görebilir.
alter table supplier enable row level security;
alter table supplier force  row level security;
drop policy if exists supplier_tenant_isolation on supplier;
create policy supplier_tenant_isolation on supplier
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- `updated_at` elle güncellenmeye bırakılmıyor: bir güncelleme yolunda
-- unutulursa "en son ne zaman değişti" sorusu sessizce yanlış cevaplanır.
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists supplier_touch_updated_at on supplier;
create trigger supplier_touch_updated_at
  before update on supplier
  for each row execute function app.touch_updated_at();

-- ── Tablo izinleri ────────────────────────────────────────────────────────
-- ⚠️ BU BLOK İLK YAZIMDA ATLANDI ve ekran "permission denied for table
-- supplier" hatası verdi. Sebebi öğretici:
--
-- RLS ile GRANT İKİ AYRI KAPIDIR ve ikisi de geçilmelidir.
--   • GRANT: "bu rol bu tabloya hiç dokunabilir mi?"  (Postgres'in kendi izni)
--   • RLS  : "dokunabiliyorsa HANGİ SATIRLARI görür?" (kiracı yalıtımı)
-- RLS politikası yazmak, GRANT verilmiş olmasını gerektirir. Politikayı
-- yazıp GRANT'i unutmak, kapıyı kilitleyip anahtarı kimseye vermemektir —
-- ve hata mesajı RLS'ten değil GRANT'ten gelir.
--
-- 0007, `anon`'un yeni tablolara otomatik erişmesini kapattı; `authenticated`
-- için ise varsayılan izin bu projede güvenilmez. Bu yüzden AÇIKÇA veriyoruz.
--
-- DELETE bilerek YOK. Tedarikçi silinmez, pasife alınır (bkz. yukarıdaki not).
-- İzni hiç vermemek, bunu bir kural olmaktan çıkarıp bir GARANTİYE çevirir:
-- uygulamada bir hata olsa bile tedarikçi silinemez.
grant select, insert, update on supplier to authenticated;

-- Oturum açmamış ziyaretçi tedarikçi listesini göremez. Müşteri verisidir.
revoke all privileges on supplier from anon;

-- ── Doğrulama ─────────────────────────────────────────────────────────────
-- 1) RLS açık ve zorlanıyor mu, politikası var mı?
select
  case when relrowsecurity      then 'açık' else 'KAPALI' end as rls,
  case when relforcerowsecurity then 'evet' else 'hayır'  end as force,
  (select count(*) from pg_policies where tablename = 'supplier') as politika
from pg_class where relname = 'supplier';

-- 2) İzinler zaten var mı? (0015'te tanımlandı — yeni izin eklenmedi.)
select code, description from permission where code in ('purchase.read','purchase.write');

-- 3) Hangi roller tedarikçi yönetebilir?
select role_code from role_permission where permission_code = 'purchase.write' order by role_code;

-- 4) TABLO İZİNLERİ — bu sorgu boş dönerse ekran "permission denied" verir.
--    Beklenen: authenticated için SELECT, INSERT, UPDATE (DELETE OLMAMALI),
--    ve `anon` hiç görünmemeli.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'supplier'
order by grantee, privilege_type;
