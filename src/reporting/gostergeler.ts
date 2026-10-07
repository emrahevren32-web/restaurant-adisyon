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
 */
export const fireOrani = (fire: number, alim: number): number | undefined =>
  alim > 0 ? fire / alim : undefined

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
      cumle: `${paraYaz(bugun.fireTutari)}`
        + (oran !== undefined ? ` — alımın ${yuzdeYaz(oran)}'i.` : '.')
        + ` ${sayiYaz(bugun.fireKalemSayisi)} kalemde.`
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
        + ` açıldı — dönemdeki siparişlerin ${yuzdeYaz(oran)}'i.`,
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
