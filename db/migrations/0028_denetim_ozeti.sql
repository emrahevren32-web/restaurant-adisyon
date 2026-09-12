-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 4 / Güven katmanı
-- 0028 — Denetim kaydında satırların OKUNABİLİR adı
--
-- ── SORUN ────────────────────────────────────────────────────────────────
-- 0027 canlıya alındı ve çalışıyor: 16 kayıt, aktör "ABC Bey", eski→yeni
-- değerler doğru. Ama liste şöyle görünüyor:
--
--   Sayım satırı  741e273a-abad-4c62-af7d-11298d0a1689   Sayılan: (yok) → 48.501
--
-- Denetimin sorduğu soru "hangi kalem" idi; cevap bir kimlik numarası.
-- Kayıt teknik olarak eksiksiz ama İŞE YARAMAZ. Kullanıcı bu satırdan
-- mercimeği mi lahanayı mı saydığını çıkaramıyor.
--
-- ── NEDEN 0027'DE OLMADI ─────────────────────────────────────────────────
-- Genel tetikleyici satırın KENDİ alanlarına bakıyordu: `count_no`, `name`,
-- `code`… Alt satırlarda (sayım satırı, sevkiyat satırı) bunların hiçbiri
-- yok; kimlik onları TAŞIYAN belgede ve GÖSTERDİKLERİ kalemde.
--
-- ── NEDEN EKRANDA ÇÖZÜLMEDİ ──────────────────────────────────────────────
-- Çözülebilirdi ama yanlış olurdu: kalem adı bugün değişirse, denetim kaydı
-- YENİ adı gösterirdi. Denetim geçmişi anlatır; o gün ne yazıyorsa onu
-- göstermeli. Bu yüzden ad, olayın olduğu anda kaydın içine yazılıyor.
--
-- ── GEÇMİŞ KAYITLAR ──────────────────────────────────────────────────────
-- Düzelmiyor ve düzeltilmeyecek. `audit_log` append-only; yazılmış satıra
-- dokunmak, kaydın bütün değerini yok ederdi. 0027 ile 0028 arasındaki
-- birkaç kayıt kimlikleriyle kalacak.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Tabloya özel özet çözücü ──────────────────────────────────────────
-- Bilinmeyen tabloda genel kurala düşüyor: numarası → adı → kodu → kimliği.
-- Uydurma bir ad üretmiyoruz; bilmiyorsak kimliği göstermek dürüst.
create or replace function app.denetim_ozet_coz(p_tablo text, p_satir jsonb)
returns text
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_ozet text;
  v_ust  text;
  v_kalem text;
  v_lot  text;
begin
  if p_satir is null then return null; end if;

  begin
    case p_tablo

      -- Sayım satırı: hangi sayımda, hangi kalem, hangi lot.
      when 'stock_count_line' then
        select c.count_no into v_ust
        from public.stock_count c where c.id = (p_satir ->> 'count_id')::uuid;
        select i.name into v_kalem
        from public.stock_item i where i.id = (p_satir ->> 'stock_item_id')::uuid;
        select l.lot_code into v_lot
        from public.stock_lot l where l.id = (p_satir ->> 'lot_id')::uuid;
        v_ozet := concat_ws(' · ',
          coalesce(v_ust, 'sayım?'),
          coalesce(v_kalem, 'kalem?'),
          v_lot);

      -- Sevkiyat satırı: hangi sevkiyatta, hangi kalem.
      when 'shipment_line' then
        select s.shipment_no into v_ust
        from public.shipment s where s.id = (p_satir ->> 'shipment_id')::uuid;
        select i.name into v_kalem
        from public.stock_item i where i.id = (p_satir ->> 'stock_item_id')::uuid;
        v_ozet := concat_ws(' · ', coalesce(v_ust, 'sevkiyat?'), coalesce(v_kalem, 'kalem?'));

      -- HACCP ölçümü: hangi kritik kontrol noktası.
      when 'haccp_measurement' then
        select concat_ws(' · ', p.code, p.name) into v_ust
        from public.haccp_ccp p where p.id = (p_satir ->> 'ccp_id')::uuid;
        v_ozet := coalesce(v_ust, 'CCP?');

      -- Düzeltici işlem: hangi ölçümün ardından.
      when 'haccp_corrective_action' then
        select concat_ws(' · ', p.code, p.name) into v_ust
        from public.haccp_measurement m
        join public.haccp_ccp p on p.id = m.ccp_id
        where m.id = (p_satir ->> 'measurement_id')::uuid;
        v_ozet := coalesce(v_ust, 'düzeltici işlem');

      -- Lot: kodu zaten kendinde, ama hangi kaleme ait olduğu da lazım.
      when 'stock_lot' then
        select i.name into v_kalem
        from public.stock_item i where i.id = (p_satir ->> 'stock_item_id')::uuid;
        v_ozet := concat_ws(' · ', coalesce(v_kalem, 'kalem?'), p_satir ->> 'lot_code');

      else
        v_ozet := null;
    end case;
  exception when others then
    -- Özet çözülemezse kayıt YİNE YAZILIR. Bir isim bulamamak, olayı hiç
    -- kaydetmemek için gerekçe değildir.
    v_ozet := null;
  end;

  return coalesce(
    nullif(btrim(v_ozet), ''),
    p_satir ->> 'count_no',
    p_satir ->> 'shipment_no',
    p_satir ->> 'name',
    p_satir ->> 'code',
    p_satir ->> 'lot_code',
    p_satir ->> 'id'
  );
end $$;

comment on function app.denetim_ozet_coz(text, jsonb) is
  'Denetim kaydının okunabilir satır adı. Ad OLAY ANINDA çözülür ve kayda '
  'yazılır — sonradan kalem adı değişse bile kayıt o günkü adı gösterir.';

-- ── 2 · Tetikleyiciyi özet çözücüyü kullanacak biçimde değiştir ──────────
create or replace function app.denetim_yaz()
returns trigger language plpgsql security definer set search_path = public, app as $$
declare
  v_eski     jsonb;
  v_yeni     jsonb;
  v_fark     jsonb;
  v_tenant   uuid;
  v_branch   uuid;
  v_satir    text;
  v_auth     uuid;
  v_user     uuid;
  v_ad       text;
  v_ozet     text;
begin
  v_eski := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_yeni := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_fark := app.denetim_farki(v_eski, v_yeni);

  -- Hiçbir alan değişmediyse kayıt yazmıyoruz: "kaydet"e basıp hiçbir şey
  -- değiştirmemek bir olay değildir.
  if tg_op = 'UPDATE' and v_fark = '{}'::jsonb then
    return null;
  end if;

  v_tenant := coalesce(v_yeni ->> 'tenant_id', v_eski ->> 'tenant_id')::uuid;
  if v_tenant is null then return null; end if;

  begin
    v_branch := coalesce(v_yeni ->> 'branch_id', v_eski ->> 'branch_id')::uuid;
  exception when others then v_branch := null;
  end;

  v_satir := coalesce(v_yeni ->> 'id', v_eski ->> 'id', '?');

  select auth_id, user_id, ad into v_auth, v_user, v_ad from app.denetim_aktoru();

  -- 0028: özet artık tabloya göre çözülüyor; alt satırlar da adlarıyla görünür.
  v_ozet := app.denetim_ozet_coz(tg_table_name, coalesce(v_yeni, v_eski));

  insert into audit_log (
    tenant_id, branch_id, table_name, row_id, action,
    actor_auth_id, actor_user_id, actor_name, changes, summary
  ) values (
    v_tenant, v_branch, tg_table_name, v_satir, tg_op,
    v_auth, v_user, v_ad,
    case
      when tg_op = 'INSERT' then jsonb_build_object('_kayit', v_yeni)
      when tg_op = 'DELETE' then jsonb_build_object('_kayit', v_eski)
      else v_fark
    end,
    v_ozet
  );

  return null;
end $$;

-- ── Doğrulama ─────────────────────────────────────────────────────────────
-- Bir sayım açıp başlatın; sonra bu sorgu satırların ADLARINI göstermeli
-- ("SAY-2026-0008 · mercimek · LOT-2601" gibi), kimlik numarası değil.
select occurred_at, table_name, summary, action
from audit_log
order by id desc
limit 10;
