-- ═══════════════════════════════════════════════════════════════════════════
-- 0080 · ROL AÇIKLAMALARI EKRANDA DOĞRUYU SÖYLESİN
-- ---------------------------------------------------------------------------
-- Rol açıklamaları MÜŞTERİYE GÖSTERİLİYOR (Kullanıcılar → Kişiler → kişi
-- kartı). Gıda mühendisi bunları tek tek okuyacak. 14.10'da rol → ekran
-- matrisi ölçüldü (`claude/rol-ekran-matrisi.md`) ve iki açıklamanın
-- sistemle UYUŞMADIĞI görüldü.
--
-- ⚠️ Kural: ekranda yazan her cümle TUTULABİLİR olmalı. Tutulamayan bir
-- cümle, kodda olmayan bir hatadan daha pahalıdır — çünkü müşteri ona
-- güvenerek yetki dağıtır.
--
-- ── 1 · OPERASYON PERSONELİ · "Mal kabul girer" YANLIŞTI ─────────────────
-- Eski cümle: "Mutfak/depo personeli. Mal kabul girer, üretim tüketimi
-- düşer, reçeteye bakar. Fiyat, tedarikçi, kullanıcı ve ayar GÖRMEZ..."
--
-- Mal kabul, Satın Alma Siparişleri ekranının bir sekmesidir ve o ekran
-- `purchase.read` ister. Bu rolde o izin YOK — yani cümle bir işi
-- yapabildiğini söylüyor, sistem o işi yaptırmıyor.
--
-- İki çıkış vardı: (a) izni eklemek, (b) cümleyi düzeltmek.
-- ⚠️ (b) SEÇİLDİ, çünkü (a) aynı açıklamanın İKİNCİ yarısıyla çelişiyor:
-- "tedarikçi GÖRMEZ" diyor; `purchase.read` eklersek Tedarikçiler ekranı
-- da açılır. Yani açıklama kendi içinde tutarsızdı.
--
-- Doğrusu şu: MAL KABUL DEPO SORUMLUSUNUN İŞİDİR. O rolde `purchase.read`
-- zaten var ve mal kabulü o yapıyor. Operasyon personeli mutfak tarafıdır:
-- üretim tüketimi düşer, sayım yapar, fireyi kaydeder.
--
-- ── 2 · SEVKİYAT SORUMLUSU · etiketi görmesi YAZILMAMIŞTI ────────────────
-- Eski cümle "üretim ve satın almaya karışmaz" diyor ama rol Etiket ve
-- Alerjen ekranını görüyor (`quality.read` üzerinden). Bu doğru: sevk
-- ettiği malın alerjen bilgisini görmesi gerekir — yanlış etiketli mal
-- yüklemek onun durduracağı şeydir. Eksik olan cümleydi, izin değil.
-- ═══════════════════════════════════════════════════════════════════════════

update public.role
   set description =
       'Mutfak/depo personeli. Üretim tüketimini düşer, sayım yapar, '
       'fireyi kaydeder, reçeteye bakar. MAL KABUL ETMEZ — o depo '
       'sorumlusunun işidir. Fiyat, tedarikçi, kullanıcı ve ayar GÖRMEZ; '
       'sipariş onaylayamaz.'
 where code = 'personel';

update public.role
   set description =
       'Sevkiyat yürütür, irsaliye keser, yükleme ölçümü girer, mal çıkışı '
       'yazar. Sevk ettiği malın ETİKET ve ALERJEN bilgisini görür — yanlış '
       'etiketli mal yüklenmesin diye. Fiyat GÖRMEZ; üretime ve satın almaya '
       'karışmaz.'
 where code = 'sevkiyat_sorumlusu';


-- ── DOĞRULAMA ────────────────────────────────────────────────────────────
do $$
declare v_metin text;
begin
  -- ⚠️ "Güncelledim" demek yetmez; ESKİ YANLIŞ CÜMLENİN GİTTİĞİNİ sına.
  select description into v_metin from public.role where code = 'personel';
  if v_metin is null then
    raise exception '0080: `personel` rolü bulunamadı.';
  end if;
  if position('Mal kabul girer' in v_metin) > 0 then
    raise exception '0080: operasyon personeli açıklamasında hâlâ "Mal kabul girer" yazıyor.';
  end if;
  if position('MAL KABUL ETMEZ' in v_metin) = 0 then
    raise exception '0080: operasyon personeli açıklaması güncellenmemiş.';
  end if;

  select description into v_metin from public.role where code = 'sevkiyat_sorumlusu';
  if position('ALERJEN' in v_metin) = 0 then
    raise exception '0080: sevkiyat sorumlusu açıklaması güncellenmemiş.';
  end if;

  -- Açıklaması boş rol kalmasın (0073'ün kuralı korunuyor).
  if exists (select 1 from public.role
              where coalesce(btrim(description), '') = '') then
    raise exception '0080: açıklaması boş rol var.';
  end if;

  raise notice '0080 TAMAM · iki rol açıklaması sistemle uyumlu hâle geldi';
end;
$$;

notify pgrst, 'reload schema';
