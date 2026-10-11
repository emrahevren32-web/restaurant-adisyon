// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · İŞLETME GÖSTERGELERİ — SAF MANTIK
//
// Bu dosyanın tek işi: veritabanından gelen ham sayıları OKUNUR hâle
// getirmek ve onlardan KARAR ALDIRAN cümleler çıkarmak.
//
// ⚠️ BURADA KATSAYI YOKTUR. "Sektör ortalaması %3'tür", "bu size yılda şu
// kadar kazandırır" gibi bir cümle bu dosyaya giremez. Böyle bir rakam
// uydurma olurdu ve müşteri bir yıl sonra onu sorar.
//
// Karşılaştırma İŞLETMENİN KENDİ GEÇMİŞİYLE yapılıyor: "geçen aya göre"
// doğrulanabilir bir cümledir, "sektöre göre" değildir.
//
// ⚠️ HESAPLANAMAYAN HESAPLANMAZ. Fiyatı bilinmeyen fire varsa tutar
// EKSİKTİR ve ekran bunu yazar. Sessizce düşük bir rakam göstermek, hiç
// göstermemekten kötüdür: müşteri ona bakarak karar verir.
// ═══════════════════════════════════════════════════════════════════════════

/** Veritabanından gelen ham satır. */
export type GostergeSatiri = {
  anahtar: string
  deger: number
  ek?: number
}

export type Ozet = {
  fireTutari: number
  fireFiyatsizHareket: number
  fireKalemSayisi: number
  alimTutari: number
  sktGecmisDeger: number
  sktGecmisParti: number
  sktYaklasanDeger: number
  sktYaklasanParti: number
  negatifBakiyeliKalem: number
  kritikKalem: number
  siparisSayisi: number
  iptalSiparis: number
  gecikenSiparis: number
  onayBekleyenSiparis: number
  farkliTeslimSiparis: number
}

const BOS: Ozet = {
  fireTutari: 0, fireFiyatsizHareket: 0, fireKalemSayisi: 0, alimTutari: 0,
  sktGecmisDeger: 0, sktGecmisParti: 0, sktYaklasanDeger: 0, sktYaklasanParti: 0,
  negatifBakiyeliKalem: 0, kritikKalem: 0,
  siparisSayisi: 0, iptalSiparis: 0, gecikenSiparis: 0,
  onayBekleyenSiparis: 0, farkliTeslimSiparis: 0,
}

/**
 * Ham satırları isimli bir özete çevirir.
 *
 * ⚠️ TANIMAYAN ANAHTAR SESSİZCE ATILIR, hata verilmez: veritabanına yeni bir
 * gösterge eklendiğinde eski ekran ÇALIŞMAYA DEVAM ETMELİ. Yeni sayıyı
 * göstermez, ama var olanları göstermeyi bırakmaz.
 */
export const ozetiOku = (satirlar: readonly GostergeSatiri[]): Ozet => {
  const o: Ozet = { ...BOS }
  const say = (x: number | undefined) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)

  for(const s of satirlar){
    switch(s.anahtar){
      case 'fire_tutari':            o.fireTutari = say(s.deger); break
      case 'fire_fiyatsiz_hareket':  o.fireFiyatsizHareket = say(s.deger); break
      case 'fire_kalem_sayisi':      o.fireKalemSayisi = say(s.deger); break
      case 'alim_tutari':            o.alimTutari = say(s.deger); break
      case 'skt_gecmis_deger':
        o.sktGecmisDeger = say(s.deger); o.sktGecmisParti = say(s.ek); break
      case 'skt_yaklasan_deger':
        o.sktYaklasanDeger = say(s.deger); o.sktYaklasanParti = say(s.ek); break
      case 'negatif_bakiyeli_kalem':  o.negatifBakiyeliKalem = say(s.deger); break
      case 'kritik_kalem':            o.kritikKalem = say(s.deger); break
      case 'siparis_sayisi':          o.siparisSayisi = say(s.deger); break
      case 'iptal_siparis':           o.iptalSiparis = say(s.deger); break
      case 'geciken_siparis':         o.gecikenSiparis = say(s.deger); break
      case 'onay_bekleyen_siparis':   o.onayBekleyenSiparis = say(s.deger); break
      case 'farkli_teslim_siparis':   o.farkliTeslimSiparis = say(s.deger); break
      default: break
    }
  }
  return o
}

// ═══════════════════════════════════════════════════════════════════════════
// Biçimleme
// ═══════════════════════════════════════════════════════════════════════════

export const paraYaz = (tutar: number): string =>
  `${tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`

export const sayiYaz = (sayi: number): string =>
  sayi.toLocaleString('tr-TR', { maximumFractionDigits: 2 })

export const yuzdeYaz = (oran: number): string =>
  `%${(oran * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`

/**
 * Fire oranı = dönem firesi ÷ dönem alımı.
 *
 * ⚠️ ALIM SIFIRSA ORAN YOKTUR — sıfır değil, `undefined`. Sıfıra bölüp
 * sonsuz ya da 0 yazmak, "hiç fire yok" ya da "her şey fire" gibi iki
 * yanlış cümleden birini kurdururdu.
 *
 * ⚠️ ORAN %100'Ü AŞABİLİR VE BU BİR HATA DEĞİLDİR. Fire o dönemde ALINAN
 * maldan gelmek zorunda değil; önceki dönemlerden kalan stoktan da gelir.
 * Alımın düşük olduğu bir ayda oran %500 çıkabilir. Rakam doğrudur ama
 * TEK BAŞINA GÖSTERİLİRSE "bozuk" görünür — bu yüzden `oranAsiriMi` ile
 * işaretlenip cümlede SEBEBİ yazılıyor. (Emrah, 11.10: "%100'ü aşan bir
 * oran alıcıya bozuk görünür.")
 */
export const fireOrani = (fire: number, alim: number): number | undefined =>
  alim > 0 ? fire / alim : undefined

/** Oran %100'ü aşmış mı — ekranda açıklama gerektirir. */
export const oranAsiriMi = (oran: number | undefined): boolean =>
  oran !== undefined && oran > 1

// ═══════════════════════════════════════════════════════════════════════════
// BULGULAR — sayıdan karara
// ═══════════════════════════════════════════════════════════════════════════

export type Onem = 'kritik' | 'uyari' | 'bilgi' | 'iyi'

export type Bulgu = {
  anahtar: string
  onem: Onem
  baslik: string
  /** Ne olduğu — rakamla. */
  cumle: string
  /** NE YAPILACAĞI. Bu alan boş bırakılmaz: yapılacak bir şey yoksa bulgu da yoktur. */
  yapilacak: string
}

const ONEM_SIRASI: Record<Onem, number> = { kritik: 0, uyari: 1, bilgi: 2, iyi: 3 }

/**
 * Özetten bulgu çıkarır.
 *
 * ⚠️ HER BULGUNUN BİR "YAPILACAK"I VAR. Yapılacak bir şey söylemeyen bulgu,
 * ekranı doldurur ve kimseyi harekete geçirmez. Yol haritasının deyimiyle:
 * ortaya koyduğumuz şey çalışsın, "mış gibi" yapmasın.
 *
 * ⚠️ `onceki` VERİLMEZSE KARŞILAŞTIRMA CÜMLESİ KURULMAZ. "Geçen aya göre
 * arttı" diyebilmek için geçen ayın sayısı elde olmalı; tahmin edilmez.
 */
export const bulgular = (bugun: Ozet, onceki?: Ozet): Bulgu[] => {
  const liste: Bulgu[] = []

  // ── SKT'si geçmiş ve HÂLÂ DEPODA olan mal ─────────────────────────────
  // En kritik bulgu bu: satılamaz mal, satılabilir mal gibi duruyor.
  if(bugun.sktGecmisParti > 0){
    liste.push({
      anahtar: 'skt_gecmis',
      onem: 'kritik',
      baslik: 'Son kullanma tarihi geçmiş mal depoda',
      cumle: `${sayiYaz(bugun.sktGecmisParti)} partide, ${paraYaz(bugun.sktGecmisDeger)}`
        + ' değerinde mal tarihini geçmiş ve hâlâ stokta görünüyor.',
      yapilacak: 'Bu partileri imha kaydıyla düşün. Düşülmezse bakiye yanlış '
        + 'kalır ve FEFO bu partileri üretime vermeye devam eder.',
    })
  }

  // ── Yaklaşan SKT: HENÜZ kayıp değil, önlenebilir ──────────────────────
  if(bugun.sktYaklasanParti > 0){
    liste.push({
      anahtar: 'skt_yaklasan',
      onem: 'uyari',
      baslik: '30 gün içinde tarihi dolacak mal',
      cumle: `${sayiYaz(bugun.sktYaklasanParti)} partide ${paraYaz(bugun.sktYaklasanDeger)}`
        + ' değerinde mal 30 gün içinde tarihini dolduruyor.',
      yapilacak: 'Bu partileri önce tüket ya da bu kalemler için yeni sipariş '
        + 'verme. Henüz kayıp değil — önlenebilir.',
    })
  }

  // ── Fire ──────────────────────────────────────────────────────────────
  if(bugun.fireTutari > 0){
    const oran = fireOrani(bugun.fireTutari, bugun.alimTutari)
    const oncekiOran = onceki ? fireOrani(onceki.fireTutari, onceki.alimTutari) : undefined

    // ⚠️ Karşılaştırma yalnız İKİ ORAN DA VARSA kurulur.
    let kiyas = ''
    if(oran !== undefined && oncekiOran !== undefined){
      const fark = oran - oncekiOran
      if(Math.abs(fark) >= 0.005){
        kiyas = fark > 0
          ? ` Önceki döneme göre arttı (${yuzdeYaz(oncekiOran)} → ${yuzdeYaz(oran)}).`
          : ` Önceki döneme göre azaldı (${yuzdeYaz(oncekiOran)} → ${yuzdeYaz(oran)}).`
      }
    }

    liste.push({
      anahtar: 'fire',
      onem: oran !== undefined && oncekiOran !== undefined && oran > oncekiOran
        ? 'uyari' : 'bilgi',
      baslik: 'Dönem firesi',
      // ⚠️ "alımın %X'i" YAZILMIYOR. İki sebep:
      //   1. Türkçe yüzde eki okunuşa göre değişiyor (%12'si ama %576'sı);
      //      sayıdan ek üretmek çalışmaz, "'i" her zaman yanlış görünür.
      //   2. Oran %100'ü aşabiliyor ve "alımın %576'sı" cümlesi okuyana
      //      hata gibi geliyor. Oranı AYRI bir cümlede, sebebiyle veriyoruz.
      cumle: `${paraYaz(bugun.fireTutari)}`
        + ` · ${sayiYaz(bugun.fireKalemSayisi)} kalemde.`
        + (oran !== undefined ? ` Alıma oranı ${yuzdeYaz(oran)}.` : '')
        + (oranAsiriMi(oran)
          ? ` Oran %100'ü aşıyor çünkü bu dönemde alım ${paraYaz(bugun.alimTutari)}`
            + ' ile sınırlı kalmış; fire önceki dönemlerden kalan stoktan geliyor.'
          : '')
        + kiyas,
      yapilacak: 'Dökümde en üstteki kaleme bak: firenin büyük kısmı '
        + 'genellikle birkaç üründen gelir.',
    })
  }

  // ── DÜRÜSTLÜK BULGUSU ─────────────────────────────────────────────────
  // ⚠️ Bu bulgu RAKAMIN KENDİSİNE GÜVENİLMEMESİNİ söylüyor. Böyle bir
  // bulgu üretmek ekranı zayıf göstermez — tersine, güvenilir yapar.
  if(bugun.fireFiyatsizHareket > 0){
    liste.push({
      anahtar: 'fire_fiyatsiz',
      onem: 'uyari',
      baslik: 'Fire tutarı EKSİK',
      cumle: `${sayiYaz(bugun.fireFiyatsizHareket)} fire hareketinin alış fiyatı`
        + ' bulunamadı; yukarıdaki fire tutarı bu kadarını İÇERMİYOR.',
      yapilacak: 'Bu kalemlerin bir alış kaydı yok (çoğunlukla açılış '
        + 'bakiyesiyle giren mallar). Mal kabul yapıldıkça rakam kendiliğinden '
        + 'tamamlanır.',
    })
  }

  // ── Negatif bakiye: defter tutarsızlığı ───────────────────────────────
  if(bugun.negatifBakiyeliKalem > 0){
    liste.push({
      anahtar: 'negatif_bakiye',
      onem: 'kritik',
      baslik: 'Eksi bakiyeli kalem var',
      cumle: `${sayiYaz(bugun.negatifBakiyeliKalem)} kalemin bakiyesi eksi.`
        + ' Olmayan maldan çıkış yazılmış.',
      yapilacak: 'Bu kalemlerin defterine bak: ya bir giriş yazılmamış, ya '
        + 'çıkış iki kez yazılmış. Sayım yapmadan önce bunu çöz — sayım '
        + 'yanlış bakiyenin üstüne yazar.',
    })
  }

  // ── Geciken sipariş ───────────────────────────────────────────────────
  if(bugun.gecikenSiparis > 0){
    liste.push({
      anahtar: 'geciken_siparis',
      onem: 'kritik',
      baslik: 'Teslim tarihi geçmiş sipariş',
      cumle: `${sayiYaz(bugun.gecikenSiparis)} siparişin teslim tarihi geçti`
        + ' ve hâlâ teslim edilmedi.',
      yapilacak: 'Müşteriyi SEN ara. Müşterinin arayıp sorduğu bir gecikme, '
        + 'haber verilen bir gecikmeden pahalıdır.',
    })
  }

  // ── Onay bekleyen ─────────────────────────────────────────────────────
  if(bugun.onayBekleyenSiparis > 0){
    liste.push({
      anahtar: 'onay_bekleyen',
      onem: 'uyari',
      baslik: 'Onay bekleyen sipariş',
      cumle: `${sayiYaz(bugun.onayBekleyenSiparis)} sipariş onay zincirinde bekliyor.`,
      yapilacak: 'Onaylanmayan sipariş üretime girmiyor; bekledikçe teslim '
        + 'tarihi daralıyor.',
    })
  }

  // ── Teslimde fark ─────────────────────────────────────────────────────
  if(bugun.farkliTeslimSiparis > 0 && bugun.siparisSayisi > 0){
    const oran = bugun.farkliTeslimSiparis / bugun.siparisSayisi
    liste.push({
      anahtar: 'farkli_teslim',
      onem: oran >= 0.1 ? 'uyari' : 'bilgi',
      baslik: 'Teslimde fark çıkan sipariş',
      cumle: `${sayiYaz(bugun.farkliTeslimSiparis)} siparişte teslim farkı kaydı`
        + ` açıldı · dönemdeki siparişlere oranı ${yuzdeYaz(oran)}.`,
      yapilacak: 'Fark kayıtlarının gerekçesine bak: aynı müşteride ya da '
        + 'aynı üründe tekrarlıyorsa sebep tek bir yerdedir.',
    })
  }

  // ── Kritik seviye ─────────────────────────────────────────────────────
  if(bugun.kritikKalem > 0){
    liste.push({
      anahtar: 'kritik_kalem',
      onem: 'uyari',
      baslik: 'Kritik seviyenin altındaki kalem',
      cumle: `${sayiYaz(bugun.kritikKalem)} kalem kendi en az miktarının altında.`,
      yapilacak: 'Satın alma talebi aç. Bu kalemlerden biri üretimde '
        + 'kullanılıyorsa iş emri başlatılamaz.',
    })
  }

  // ── Hiçbir şey yoksa bunu da SÖYLE ────────────────────────────────────
  // ⚠️ Boş bir ekran "veri gelmedi mi, yoksa sorun mu yok" sorusunu
  // bıraktırır. Sessiz kalmak bir cevap değildir.
  if(liste.length === 0){
    liste.push({
      anahtar: 'temiz',
      onem: 'iyi',
      baslik: 'Dikkat gerektiren bir şey yok',
      cumle: 'Bu dönemde fire, gecikme, eksi bakiye ya da tarihi geçmiş mal '
        + 'görünmüyor.',
      yapilacak: 'Bir şey yapmana gerek yok.',
    })
  }

  return liste.sort((a, b) => ONEM_SIRASI[a.onem] - ONEM_SIRASI[b.onem])
}

// ═══════════════════════════════════════════════════════════════════════════
// Fire dökümü
// ═══════════════════════════════════════════════════════════════════════════

export type FireSatiri = {
  neden: string
  kalemId: string
  kalemAdi?: string
  miktar: number
  birim?: string
  tutar?: number
  fiyatsiz: boolean
}

/** Fire nedenlerinin okunur karşılığı. */
export const FIRE_NEDENLERI: Record<string, string> = {
  WASTE:            'Zayi (bozulma, döküntü)',
  EXPIRY_WRITE_OFF: 'Tarihi geçtiği için imha',
  PRODUCTION_WASTE: 'Üretim firesi',
  COUNT_SHORTAGE:   'Sayımda eksik çıktı',
}

export const fireNedeniYaz = (kod: string): string => FIRE_NEDENLERI[kod] ?? kod

/**
 * Fire dökümünü nedene göre toplar.
 *
 * ⚠️ Fiyatsız satır varsa grubun tutarı EKSİKTİR ve bu bayrak taşınır.
 * Eksik bir tutarı tam gibi göstermek, raporun tamamına olan güveni bitirir.
 */
export const nedeneGoreFire = (satirlar: readonly FireSatiri[]) => {
  const harita = new Map<string, { neden: string; tutar: number; eksik: boolean; kalem: number }>()
  for(const s of satirlar){
    const v = harita.get(s.neden) ?? { neden: s.neden, tutar: 0, eksik: false, kalem: 0 }
    v.tutar += s.tutar ?? 0
    v.eksik = v.eksik || s.fiyatsiz
    v.kalem += 1
    harita.set(s.neden, v)
  }
  return [...harita.values()].sort((a, b) => b.tutar - a.tutar)
}

/**
 * "Firenin büyük kısmı kaç kalemden geliyor?"
 *
 * Bir mutfakta fire genellikle birkaç üründe toplanır. Bu sayı, listenin
 * neresine bakılacağını söyler.
 */
export const fireninYogunlastigi = (
  satirlar: readonly FireSatiri[],
  pay = 0.8,
): { kalemSayisi: number; toplam: number; kapsanan: number } | undefined => {
  const tutarli = satirlar
    .filter(s => typeof s.tutar === 'number' && s.tutar > 0)
    .sort((a, b) => (b.tutar ?? 0) - (a.tutar ?? 0))

  const toplam = tutarli.reduce((t, s) => t + (s.tutar ?? 0), 0)
  if(toplam <= 0) return undefined

  let biriken = 0
  for(let i = 0; i < tutarli.length; i += 1){
    biriken += tutarli[i].tutar ?? 0
    if(biriken / toplam >= pay){
      return { kalemSayisi: i + 1, toplam, kapsanan: biriken }
    }
  }
  return { kalemSayisi: tutarli.length, toplam, kapsanan: biriken }
}

// ═══════════════════════════════════════════════════════════════════════════
// SATIŞ VE KÂRLILIK (0074)
// ---------------------------------------------------------------------------
// Emrah'ın bilirkişisinin demo şartı: "en çok/az satılan, en karlı/az karlı,
// stok devir hızı."
//
// ⚠️ HESAP BURADA DEĞİL, VERİTABANINDA (0074). Burası yalnız SIRALIYOR ve
// CÜMLEYE ÇEVİRİYOR. Toplamayı tarayıcıya taşımak, PostgREST'in satır
// sınırında sessizce kesilen bir kâr rakamı üretirdi.
//
// ⚠️ BU BRÜT KÂRDIR. İşçilik, nakliye, enerji ve genel gider İÇİNDE YOK.
// "Kârınız bu" demek yalan olur; "malın kendisinden kalan bu" doğrudur.
// ═══════════════════════════════════════════════════════════════════════════

export type SatisSatiri = {
  kalemId: string
  kalemAdi: string
  birim: string
  /** Temel birimde satılan miktar. */
  miktar: number
  /** Yalnız fiyatı BİLİNEN miktarın tutarı. */
  ciro: number
  /** Bilinmiyorsa `undefined` — sıfır DEĞİL. */
  maliyet?: number
  kar?: number
  marj?: number
  /** Fiyatı bulunamadığı için ciroya girmeyen miktar. */
  fiyatsizMiktar: number
  maliyetsiz: boolean
}

export type DevirSatiri = {
  kalemId: string
  kalemAdi: string
  birim: string
  cikis: number
  baslangicStok: number
  bitisStok: number
  ortalamaStok: number
  /** Ortalama stok sıfırsa hesaplanmaz. */
  devir?: number
  /** Kaç günde bir devrediyor. */
  gun?: number
}

export type SatisOzeti = {
  /** Dönemin toplam cirosu (maliyeti bilinmeyen kalemler dahil). */
  ciro: number
  /**
   * ⚠️ KÂR YALNIZ MALİYETİ BİLİNEN KALEMLER ÜZERİNDEN. Maliyeti
   * bilinmeyeni sıfır sayıp toplama katmak, kârı olduğundan yüksek
   * gösterirdi — bu raporun yapabileceği en pahalı yalan.
   */
  olculebilirCiro: number
  maliyet: number
  kar: number
  marj?: number
  kalemSayisi: number
  /** Fiyatı bulunamayan satış olan kalem sayısı. */
  fiyatsizKalem: number
  /** Maliyeti hiç hesaplanamayan kalem sayısı. */
  maliyetsizKalem: number
  /** Zarar eden (kârı eksi) kalem sayısı. */
  zararliKalem: number
}

export const satisOzeti = (satirlar: readonly SatisSatiri[]): SatisOzeti => {
  const olculebilir = satirlar.filter(s => s.maliyet !== undefined)
  const olculebilirCiro = olculebilir.reduce((t, s) => t + s.ciro, 0)
  const maliyet = olculebilir.reduce((t, s) => t + (s.maliyet ?? 0), 0)
  const kar = olculebilirCiro - maliyet
  return {
    ciro: satirlar.reduce((t, s) => t + s.ciro, 0),
    olculebilirCiro,
    maliyet,
    kar,
    marj: olculebilirCiro > 0 ? kar / olculebilirCiro : undefined,
    kalemSayisi: satirlar.length,
    fiyatsizKalem: satirlar.filter(s => s.fiyatsizMiktar > 0).length,
    maliyetsizKalem: satirlar.filter(s => s.maliyetsiz).length,
    zararliKalem: satirlar.filter(s => s.kar !== undefined && s.kar < 0).length,
  }
}

/** Ciroya göre en çok satanlar. */
export const enCokSatan = (satirlar: readonly SatisSatiri[], adet = 5): SatisSatiri[] =>
  [...satirlar].sort((a, b) => b.ciro - a.ciro).slice(0, adet)

/**
 * Ciroya göre en az satanlar.
 *
 * ⚠️ HİÇ SATILMAYAN KALEM BU LİSTEDE YOK. Rapor yalnız dönemde HAREKET
 * GÖRMÜŞ kalemleri getiriyor; "hiç satmadık" bilgisi ayrı bir sorudur ve
 * stok kartı listesinden gelir. Burada "en az satan" demek, "satılanların
 * en azı" demektir — ekranda da böyle yazılmalı.
 */
export const enAzSatan = (satirlar: readonly SatisSatiri[], adet = 5): SatisSatiri[] =>
  [...satirlar].filter(s => s.ciro > 0).sort((a, b) => a.ciro - b.ciro).slice(0, adet)

/** Marja göre en karlılar. Marjı bilinmeyen kalem listeye GİRMEZ. */
export const enKarli = (satirlar: readonly SatisSatiri[], adet = 5): SatisSatiri[] =>
  [...satirlar].filter(s => s.marj !== undefined)
    .sort((a, b) => (b.marj ?? 0) - (a.marj ?? 0)).slice(0, adet)

/** Marja göre en az karlılar — zarar edenler en başta. */
export const enAzKarli = (satirlar: readonly SatisSatiri[], adet = 5): SatisSatiri[] =>
  [...satirlar].filter(s => s.marj !== undefined)
    .sort((a, b) => (a.marj ?? 0) - (b.marj ?? 0)).slice(0, adet)

/** Zarar eden kalemler — ayrı liste, çünkü ayrı bir karar gerektiriyor. */
export const zararEdenler = (satirlar: readonly SatisSatiri[]): SatisSatiri[] =>
  [...satirlar].filter(s => s.kar !== undefined && s.kar < 0)
    .sort((a, b) => (a.kar ?? 0) - (b.kar ?? 0))

/** En yavaş devreden stok: parayı rafta bekleten kalemler. */
export const yavasDevredenler = (satirlar: readonly DevirSatiri[], adet = 5): DevirSatiri[] =>
  [...satirlar].filter(s => s.gun !== undefined)
    .sort((a, b) => (b.gun ?? 0) - (a.gun ?? 0)).slice(0, adet)

/** En hızlı devredenler: doğru çalışan taraf. */
export const hizliDevredenler = (satirlar: readonly DevirSatiri[], adet = 5): DevirSatiri[] =>
  [...satirlar].filter(s => s.gun !== undefined)
    .sort((a, b) => (a.gun ?? 0) - (b.gun ?? 0)).slice(0, adet)

/**
 * Satış tarafının bulguları — "ne yapmalı" listesine eklenecek cümleler.
 *
 * ⚠️ HER BULGU BİR EYLEM SÖYLÜYOR. Rakamı tekrar eden ama ne yapılacağını
 * söylemeyen bir satır, kullanıcıya hiçbir şey vermez.
 */
export const satisBulgulari = (
  ozet: SatisOzeti,
  satirlar: readonly SatisSatiri[],
  devir: readonly DevirSatiri[] = [],
): Bulgu[] => {
  const liste: Bulgu[] = []

  const zararli = zararEdenler(satirlar)
  if(zararli.length > 0){
    const enKotu = zararli[0]
    liste.push({
      anahtar: 'zararina_satis',
      onem: 'kritik',
      baslik: 'Zararına satılan ürün',
      cumle: `${sayiYaz(zararli.length)} üründe maliyet, satış fiyatının üstünde.`
        + ` En büyüğü: ${enKotu.kalemAdi} — ${paraYaz(Math.abs(enKotu.kar ?? 0))} zarar.`,
      yapilacak: 'Önce fiyatı mı yoksa reçeteyi mi kontrol edeceğine karar ver: '
        + 'maliyet arttıysa fiyat güncellenmeli, reçete değiştiyse maliyet yeniden '
        + 'hesaplanmalı. Bu ürünü satmaya devam etmek her sevkiyatta para kaybettirir.',
    })
  }

  if(ozet.maliyetsizKalem > 0){
    liste.push({
      anahtar: 'maliyetsiz_kalem',
      onem: 'uyari',
      baslik: 'Maliyeti hesaplanamayan ürün',
      cumle: `${sayiYaz(ozet.maliyetsizKalem)} ürünün birim maliyeti bulunamadı;`
        + ' kâr hesabına GİRMEDİLER.',
      yapilacak: 'Sebebi ikisinden biridir: ya o malın alış kaydı hiç yok, '
        + 'ya da reçetesindeki bir malzemenin alışı yok. Alış kaydını gir, '
        + 'maliyet kendiliğinden oluşur.',
    })
  }

  if(ozet.fiyatsizKalem > 0){
    liste.push({
      anahtar: 'fiyatsiz_satis',
      onem: 'uyari',
      baslik: 'Fiyatsız sevkiyat',
      cumle: `${sayiYaz(ozet.fiyatsizKalem)} üründe sevk edilen malın fiyatı`
        + ' bulunamadı; o miktar ciroya girmedi.',
      yapilacak: 'Genellikle siparişe bağlanmamış sevkiyattan gelir. '
        + 'Sevkiyatı siparişe bağla ya da sipariş satırına fiyat yaz — '
        + 'yoksa ciron olduğundan düşük görünür.',
    })
  }

  // ⚠️ 90 gün eşiği bir KARAR, ölçüm değil: gıdada üç ay rafta bekleyen mal
  // çoğu zaman bozulmadan önce satılamayacak demektir. Eşik değişirse bu
  // yorum da değişmeli.
  const yavas = yavasDevredenler(devir, 3).filter(d => (d.gun ?? 0) >= 90)
  if(yavas.length > 0){
    liste.push({
      anahtar: 'yavas_devir',
      onem: 'uyari',
      baslik: 'Rafta bekleyen stok',
      cumle: `${sayiYaz(yavas.length)} üründe stok 90 günden yavaş devrediyor.`
        + ` En yavaşı: ${yavas[0].kalemAdi} — ${sayiYaz(yavas[0].gun ?? 0)} gün.`,
      yapilacak: 'Bu kalemler için yeni sipariş vermeden önce eldekini tüket. '
        + 'Rafta bekleyen mal hem para hem de son kullanma tarihi riskidir.',
    })
  }

  return liste
}
