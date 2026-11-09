# Hijyen, haşere, ilaçlama ve bakım takibi · yapılacak (09.11.2026)

Emrah'ın isteği:

> *"Tüm işletme için hijyen ve haşere takip sistemi, ilaçlama ve fabrika
> bakım sistemi gibi bir panel olsun ve bu panelden müşteriler kendi
> rutin temizlik ve hijyen günlerini takip edebilsinler... Böylece
> proaktif bir davranış olmuş olur."*

**Durum: ⬜ yapılacaklar listesinde.** Demo öncesi değil (Emrah'ın
kararı: *"ikinci maddeyi de yapılacaklar listesine atarsın"*).

---

## Neden bu iş küçük değil — ve neden ACELE EDİLMEMELİ

Bu, dört ayrı defterin tek başlık altında toplanmış hâli:

1. **Rutin temizlik/hijyen planı** — hangi alan, hangi sıklıkta, kim,
   hangi kimyasalla. Yapıldı/yapılmadı kaydı ve imzası.
2. **Haşere izleme** — istasyon haritası, periyodik kontrol, bulgu kaydı.
3. **İlaçlama** — dış firma, uygulama tarihi, kullanılan ürün, **ruhsat
   ve sertifika belgesi**, bir sonraki uygulama tarihi.
4. **Fabrika/ekipman bakımı** — periyodik bakım planı, arıza kaydı,
   kalibrasyon.

⚠️ **Bu dördü denetimde SORULAN şeylerdir.** Yani bir müşteri bu ekrana
"yaptım" yazdığında, o kayıt bir gün müfettişin önüne çıkabilir. Dolayısıyla
şahit numune defteriyle **aynı sınıf**: imza sunucuda, defter append-only,
geçmişe tarih atılamaz, silme yok.

⚠️ **MİYOP'ta bunun yarısı ZATEN VAR:** HACCP modülü kontrol noktalarını
ve ölçümlerini tutuyor (`0024_haccp.sql`), `operation-checklists` rutin
kontrol listelerini tutuyor. Yeni bir modül açmadan önce **ölçülmesi
gereken şey şu: bu dördü var olanın içine mi oturur, yoksa gerçekten yeni
tablo mu ister?** Aynı işi ikinci kez yazmak, iki ayrı gerçek üretir —
bu depodaki en pahalı hata sınıfı.

## Başlamadan önce ÖLÇÜLECEKLER

- [ ] `operation_checklist` ve HACCP tabloları bu dördünü ne kadar
      karşılıyor? (Kod okunarak, tahminle değil.)
- [ ] Kaldırılan modüller listesinde bunun bir kopyası var mı?
      (`claude/kaldirilan-moduller.md` — eski adisyon ürününden gelen
      sahte modüller orada.)

## İsmet'e sorulacaklar (bu iş başlamadan)

- Bugün temizlik planı neyle takip ediliyor — kâğıt çizelge mi, duvarda
  asılı liste mi, hiç mi?
- İlaçlamayı dış firma mı yapıyor? Sertifikayı kim saklıyor?
- Haşere istasyonları var mı, kaç tane, kim kontrol ediyor?
- Bakımı kim yapıyor, periyodik bir plan var mı?
- Denetimde bu dördünden hangisi soruldu, hangi belge istendi?

⚠️ Bu beş soru cevaplanmadan ekran yazılmayacak. Yazılırsa yine "mış
gibi" olur — ve bu sefer *denetimde kullanılacak* bir defter hakkında.

## Satış tarafı (Emrah'ın gerekçesi)

*"Proaktif bir davranış olmuş olur."* Doğru: bu dördü bugün çoğu
işletmede kâğıtta ve denetimden bir gün önce toparlanıyor. MİYOP'un
bunları hatırlatması — "şu alanın temizliği 3 gündür gecikti", "ilaçlama
tarihi 10 gün sonra" — satışta somut bir cümle.
⚠️ Ama hatırlatma kurulmadan önce **defterin kendisi** doğru olmalı;
hatırlatma yanlış bir defterin üstüne kurulursa yanlış hatırlatır.
