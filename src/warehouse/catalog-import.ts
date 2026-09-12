// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Stok kartlarını Excel'den içe aktarma
//
// Yol haritası maddesi: "Excel ile stok kartı ve tedarikçi içe aktarma"
//
// ── NE İÇE AKTARILIR, NE AKTARILMAZ ──────────────────────────────────────
// Buradan yalnızca KART TANIMI gelir: kod, ad, birim, lot/SKT takibi, en az
// miktar. MİKTAR GELMEZ.
//
// Sebep ADR-001: bakiye defterden türetilir, dışarıdan atanmaz. Excel'den
// miktar okuyup yazsaydık, hareketi olmayan bir bakiye doğardı — "bu rakam
// nereden geldi?" sorusunun cevabı olmazdı. Açılış bakiyesi girmek isteyen
// kullanıcı, kartlar açıldıktan sonra Depo ekranından "Elle Giriş" yapar;
// o zaman defterde bir açılış hareketi olur ve izi kalır.
// ═══════════════════════════════════════════════════════════════════════════

import { normalizeIdentifier } from '../core/identifier'
import type { Birim, KatalogKalemi, YeniKalem } from './warehouse.catalog'
import {
  bosSatir,
  evetMi,
  hucre,
  sayaclariHesapla,
  sayiyaCevir,
  sutunlariEsle,
  type Onizleme,
  type OnizlemeSatiri,
  type SatirHatasi,
  type SutunTanimi,
} from '../core/import/sheet'

export const KALEM_SUTUNLARI: readonly SutunTanimi[] = [
  {
    alan: 'kod', baslik: 'Kod', zorunlu: true,
    esanlamlilar: ['stok kodu', 'urun kodu', 'malzeme kodu', 'code', 'sku'],
    aciklama: 'Benzersiz olmalı', ornek: 'MRC-001',
  },
  {
    alan: 'ad', baslik: 'Ad', zorunlu: true,
    esanlamlilar: ['urun adi', 'stok adi', 'malzeme adi', 'aciklama', 'name'],
    aciklama: 'Ürünün adı', ornek: 'Yeşil Mercimek',
  },
  {
    alan: 'kategori', baslik: 'Kategori',
    esanlamlilar: ['grup', 'category'],
    aciklama: 'İsteğe bağlı', ornek: 'Bakliyat',
  },
  {
    alan: 'temelBirim', baslik: 'Birim', zorunlu: true,
    esanlamlilar: ['olcu birimi', 'temel birim', 'birimi', 'uom', 'unit'],
    aciklama: 'kg, g, lt, adet…', ornek: 'kg',
  },
  {
    alan: 'lotTakipli', baslik: 'Lot Takibi',
    esanlamlilar: ['lot', 'parti takibi', 'lot takipli'],
    aciklama: 'Evet / Hayır', ornek: 'Evet',
  },
  {
    alan: 'sktTakipli', baslik: 'SKT Takibi',
    esanlamlilar: ['skt', 'son kullanma takibi', 'raf omru', 'skt takipli'],
    aciklama: 'Evet / Hayır', ornek: 'Evet',
  },
  {
    alan: 'minMiktar', baslik: 'En Az Miktar',
    esanlamlilar: ['min miktar', 'minimum', 'kritik seviye', 'asgari stok'],
    aciklama: 'Altına düşünce uyarır', ornek: '100',
  },
]

export type KalemOnizlemesi = Onizleme<YeniKalem>

/**
 * Dosya satırlarını çözümler ve ne olacağını gösterir. HİÇBİR ŞEY YAZMAZ.
 *
 * @param satirlar İlk satır başlık, kalanı veri.
 * @param mevcutlar Şu anki katalog — güncelleme mi yeni mi, ona bakılır.
 * @param birimler Geçerli birim kodları; tanımsız birim reddedilir.
 */
export const kalemleriCozumle = (
  satirlar: readonly (readonly unknown[])[],
  mevcutlar: readonly KatalogKalemi[],
  birimler: readonly Birim[],
): KalemOnizlemesi => {
  const [basliklar, ...veri] = satirlar
  const esleme = sutunlariEsle(basliklar ?? [], KALEM_SUTUNLARI)

  // Zorunlu bir sütun eksikse tek tek satır hatası basmak gürültü olur:
  // 400 satırın 400'ü aynı sebeple düşer. Onun yerine hiç okumuyoruz.
  if(esleme.eksikSutunlar.length > 0){
    return {
      satirlar: [], yeni: 0, guncelleme: 0, hatali: 0,
      bilinmeyenSutunlar: esleme.bilinmeyenSutunlar,
      eksikSutunlar: esleme.eksikSutunlar,
    }
  }

  const birimKodlari = new Set(birimler.map(b => b.kod))
  const mevcutHarita = new Map(mevcutlar.map(k => [normalizeIdentifier(k.kod), k]))
  const dosyadakiKodlar = new Map<string, number>()
  const sonuc: OnizlemeSatiri<YeniKalem>[] = []

  veri.forEach((satir, i) => {
    // +2: başlık 1. satır, dizi 0'dan başlıyor.
    const satirNo = i + 2
    if(bosSatir(satir)) return

    const hatalar: SatirHatasi[] = []
    const ekle = (alan: string, mesaj: string) => hatalar.push({ satir: satirNo, alan, mesaj })

    const kod = hucre(satir, esleme, 'kod')
    const ad = hucre(satir, esleme, 'ad')
    const temelBirim = hucre(satir, esleme, 'temelBirim')
    const kategori = hucre(satir, esleme, 'kategori')

    if(kod === '') ekle('Kod', 'Kod zorunludur.')
    if(ad === '') ekle('Ad', 'Ad zorunludur.')

    const anahtar = normalizeIdentifier(kod)
    if(kod !== ''){
      const oncekiSatir = dosyadakiKodlar.get(anahtar)
      if(oncekiSatir !== undefined){
        // Aynı kod dosyada iki kez: hangisi doğru bilemeyiz. İkincisini
        // reddedip birincisini bırakmak, sessizce üzerine yazmaktan iyidir.
        ekle('Kod', `Bu kod ${oncekiSatir}. satırda da var. Aynı kod iki kez olamaz.`)
      } else {
        dosyadakiKodlar.set(anahtar, satirNo)
      }
    }

    if(temelBirim === ''){
      ekle('Birim', 'Birim zorunludur.')
    } else if(!birimKodlari.has(temelBirim)){
      ekle('Birim', `"${temelBirim}" tanımlı bir birim değil. Geçerliler: ${[...birimKodlari].join(', ')}`)
    }

    const lotMetni = hucre(satir, esleme, 'lotTakipli')
    const lotTakipli = evetMi(lotMetni)
    if(lotTakipli === undefined) ekle('Lot Takibi', `"${lotMetni}" anlaşılmadı. Evet veya Hayır yazın.`)

    const sktMetni = hucre(satir, esleme, 'sktTakipli')
    const sktTakipli = evetMi(sktMetni)
    if(sktTakipli === undefined) ekle('SKT Takibi', `"${sktMetni}" anlaşılmadı. Evet veya Hayır yazın.`)

    const minMetni = hucre(satir, esleme, 'minMiktar')
    const minMiktar = minMetni === '' ? 0 : sayiyaCevir(minMetni)
    if(minMiktar === undefined) ekle('En Az Miktar', `"${minMetni}" sayı değil.`)
    else if(minMiktar < 0) ekle('En Az Miktar', 'Eksi olamaz.')

    if(hatalar.length > 0){
      sonuc.push({ durum: 'HATA', satir: satirNo, kod, hatalar })
      return
    }

    const girdi: YeniKalem = {
      kod, ad,
      kategori: kategori === '' ? undefined : kategori,
      temelBirim,
      lotTakipli: lotTakipli!,
      sktTakipli: sktTakipli!,
      minMiktar: minMiktar!,
    }

    const mevcut = mevcutHarita.get(anahtar)
    if(mevcut){
      sonuc.push({ durum: 'GUNCELLEME', satir: satirNo, kod, girdi, mevcutId: mevcut.id })
    } else {
      sonuc.push({ durum: 'YENI', satir: satirNo, kod, girdi })
    }
  })

  return {
    satirlar: sonuc,
    ...sayaclariHesapla(sonuc),
    bilinmeyenSutunlar: esleme.bilinmeyenSutunlar,
    eksikSutunlar: esleme.eksikSutunlar,
  }
}
