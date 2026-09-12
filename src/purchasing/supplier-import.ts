// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Tedarikçileri Excel'den içe aktarma
//
// Yol haritası maddesi: "Excel ile stok kartı ve tedarikçi içe aktarma"
//
// Stok kartı içe aktarmasıyla aynı iskelet (bkz. core/import/sheet.ts):
// önce çözümle ve göster, sonra yaz. Buradaki fark yalnızca sütunlar ve
// doğrulama kuralları.
//
// ── DOĞRULAMAYI İKİ KEZ YAZMIYORUZ ───────────────────────────────────────
// E-posta biçimi, kodun boş olamayacağı gibi kurallar `TedarikciServisi`
// içinde zaten var ve içe aktarma da o servisten geçiyor. Burada yalnızca
// DOSYAYA ÖZGÜ olanlar kontrol ediliyor: eksik sütun, aynı kodun dosyada iki
// kez geçmesi, okunamayan hücre. Servisin kuralını burada kopyalasaydık,
// biri değişince diğeri sessizce eskir.
//
// Tek istisna e-posta: onu burada da kontrol ediyoruz, çünkü 300 satırlık bir
// dosyada bozuk e-postanın YAZMA anında değil ÖNİZLEMEDE görünmesi gerekir —
// kullanıcı dosyayı düzeltip yeniden yükleyecek.
// ═══════════════════════════════════════════════════════════════════════════

import { normalizeIdentifier } from '../core/identifier'
import type { Tedarikci, TedarikciGirdisi } from './supplier.repository'
import {
  bosSatir,
  hucre,
  sayaclariHesapla,
  sutunlariEsle,
  type Onizleme,
  type OnizlemeSatiri,
  type SatirHatasi,
  type SutunTanimi,
} from '../core/import/sheet'

/** Servisteki desenle aynı: geçerli olmayanı elemek için, adres doğrulamak için değil. */
const EPOSTA_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const TEDARIKCI_SUTUNLARI: readonly SutunTanimi[] = [
  {
    alan: 'kod', baslik: 'Kod', zorunlu: true,
    esanlamlilar: ['tedarikci kodu', 'cari kod', 'firma kodu', 'code'],
    aciklama: 'Benzersiz olmalı', ornek: 'TED-001',
  },
  {
    alan: 'ad', baslik: 'Ad', zorunlu: true,
    esanlamlilar: ['tedarikci adi', 'firma adi', 'unvan', 'name'],
    aciklama: 'Firma unvanı', ornek: 'ABC Gıda San. Tic. Ltd. Şti.',
  },
  {
    alan: 'vergiNo', baslik: 'Vergi No',
    esanlamlilar: ['vkn', 'vergi numarasi', 'tckn', 'vergi kimlik no'],
    ornek: '1234567890',
  },
  {
    alan: 'yetkili', baslik: 'Yetkili',
    esanlamlilar: ['ilgili kisi', 'yetkili kisi', 'muhatap', 'contact'],
    ornek: 'Ahmet Yılmaz',
  },
  {
    alan: 'telefon', baslik: 'Telefon',
    esanlamlilar: ['tel', 'gsm', 'cep', 'phone'],
    ornek: '0212 000 00 00',
  },
  {
    alan: 'eposta', baslik: 'E-posta',
    esanlamlilar: ['email', 'e mail', 'mail', 'eposta adresi'],
    ornek: 'siparis@abcgida.com',
  },
  {
    alan: 'adres', baslik: 'Adres',
    esanlamlilar: ['acik adres', 'address'],
    ornek: 'İstanbul',
  },
  {
    alan: 'not', baslik: 'Not',
    esanlamlilar: ['aciklama', 'notlar', 'note'],
    ornek: 'Salı ve Cuma teslimat',
  },
]

export type TedarikciOnizlemesi = Onizleme<TedarikciGirdisi>

/** Dosya satırlarını çözümler ve ne olacağını gösterir. HİÇBİR ŞEY YAZMAZ. */
export const tedarikcileriCozumle = (
  satirlar: readonly (readonly unknown[])[],
  mevcutlar: readonly Tedarikci[],
): TedarikciOnizlemesi => {
  const [basliklar, ...veri] = satirlar
  const esleme = sutunlariEsle(basliklar ?? [], TEDARIKCI_SUTUNLARI)

  if(esleme.eksikSutunlar.length > 0){
    return {
      satirlar: [], yeni: 0, guncelleme: 0, hatali: 0,
      bilinmeyenSutunlar: esleme.bilinmeyenSutunlar,
      eksikSutunlar: esleme.eksikSutunlar,
    }
  }

  const mevcutHarita = new Map(mevcutlar.map(t => [normalizeIdentifier(t.kod), t]))
  const dosyadakiKodlar = new Map<string, number>()
  const sonuc: OnizlemeSatiri<TedarikciGirdisi>[] = []

  veri.forEach((satir, i) => {
    const satirNo = i + 2
    if(bosSatir(satir)) return

    const hatalar: SatirHatasi[] = []
    const ekle = (alan: string, mesaj: string) => hatalar.push({ satir: satirNo, alan, mesaj })

    const oku = (alan: string) => hucre(satir, esleme, alan)
    const bosOlmayan = (alan: string) => { const d = oku(alan); return d === '' ? undefined : d }

    const kod = oku('kod')
    const ad = oku('ad')

    if(kod === '') ekle('Kod', 'Kod zorunludur.')
    if(ad === '') ekle('Ad', 'Ad zorunludur.')

    const anahtar = normalizeIdentifier(kod)
    if(kod !== ''){
      const oncekiSatir = dosyadakiKodlar.get(anahtar)
      if(oncekiSatir !== undefined){
        ekle('Kod', `Bu kod ${oncekiSatir}. satırda da var. Aynı kod iki kez olamaz.`)
      } else {
        dosyadakiKodlar.set(anahtar, satirNo)
      }
    }

    const eposta = bosOlmayan('eposta')
    if(eposta && !EPOSTA_DESENI.test(eposta)){
      ekle('E-posta', `"${eposta}" geçerli bir e-posta adresine benzemiyor.`)
    }

    if(hatalar.length > 0){
      sonuc.push({ durum: 'HATA', satir: satirNo, kod, hatalar })
      return
    }

    const girdi: TedarikciGirdisi = {
      kod, ad,
      vergiNo: bosOlmayan('vergiNo'),
      yetkili: bosOlmayan('yetkili'),
      telefon: bosOlmayan('telefon'),
      eposta,
      adres: bosOlmayan('adres'),
      not: bosOlmayan('not'),
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
