-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Dilim 0 / G3
-- 0002 — Ölçü birimleri ve dönüşümler
--
-- ADR-001: birim dönüşümü defterin İÇİNDE çözülür. Dönüşüm şemada yoksa
-- aşağıdaki her sayı yanlış olur.
--
-- Dönüşümler tenant'a bağlı DEĞİLDİR: kg→g her yerde 1000'dir. Reçeteye özgü
-- verim (yield) burada değil, üretim iş emrinde tutulur.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists uom (
  code       text primary key,
  name       text not null,
  dimension  text not null check (dimension in ('MASS','VOLUME','COUNT'))
);

create table if not exists uom_conversion (
  from_uom  text not null references uom(code),
  to_uom    text not null references uom(code),
  factor    numeric(18,8) not null check (factor > 0),
  primary key (from_uom, to_uom)
);

comment on table uom_conversion is
  '1 birim from_uom = factor adet to_uom. Her çift iki yönlü olarak kaydedilir.';

insert into uom (code, name, dimension) values
  ('kg',    'Kilogram',  'MASS'),
  ('g',     'Gram',      'MASS'),
  ('ton',   'Ton',       'MASS'),
  ('lt',    'Litre',     'VOLUME'),
  ('ml',    'Mililitre', 'VOLUME'),
  ('adet',  'Adet',      'COUNT'),
  ('koli',  'Koli',      'COUNT'),
  ('tepsi', 'Tepsi',     'COUNT')
on conflict (code) do nothing;

insert into uom_conversion (from_uom, to_uom, factor) values
  ('kg',  'g',   1000),
  ('g',   'kg',  0.001),
  ('ton', 'kg',  1000),
  ('kg',  'ton', 0.001),
  ('ton', 'g',   1000000),
  ('g',   'ton', 0.000001),
  ('lt',  'ml',  1000),
  ('ml',  'lt',  0.001)
on conflict (from_uom, to_uom) do nothing;

-- Aynı birime dönüşüm her zaman 1'dir; sorguların özel durum yazmasına gerek kalmasın.
insert into uom_conversion (from_uom, to_uom, factor)
select code, code, 1 from uom
on conflict (from_uom, to_uom) do nothing;

-- ── Dönüşüm fonksiyonu ─────────────────────────────────────────────────────
-- Boyut uyuşmazlığı sessizce geçilmez: kg'ı litreye çevirmeye çalışan kod
-- yanlış bir sayı üretmek yerine hata alır.
create or replace function app.convert_uom(
  p_qty       numeric,
  p_from_uom  text,
  p_to_uom    text
)
returns numeric
language plpgsql
stable
as $$
declare
  v_factor numeric;
begin
  if p_from_uom = p_to_uom then
    return p_qty;
  end if;

  select factor into v_factor
  from uom_conversion
  where from_uom = p_from_uom and to_uom = p_to_uom;

  if v_factor is null then
    raise exception 'Birim dönüşümü tanımlı değil: % → %', p_from_uom, p_to_uom
      using errcode = 'data_exception';
  end if;

  return p_qty * v_factor;
end $$;

comment on function app.convert_uom(numeric, text, text) is
  'Miktarı hedef birime çevirir. Tanımsız dönüşümde hata verir, tahmin yapmaz.';
