// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 — YEDEK KAPSAMI EKSİKSİZ (mimari testi)
//
// Yol haritası maddesi: "Kiracı verisini dışa aktarma"
//        Bitti sayılır ki: "İşletmenin TÜM verisi dosyada"
//
// "TÜM" kelimesi tek bir incelemeyle kanıtlanamaz. `DISA_AKTARILAN_TABLOLAR`
// bugün doğru olsa bile, yarın eklenecek bir tablo onu sessizce yanlış hâle
// getirir — ve bunu kimse fark etmez, çünkü yedek dosyası KENDİ listesine
// göre "eksiksiz" damgası alır.
//
// ── BU TEST YAZILIRKEN BULUNAN ÜÇ EKSİK ──────────────────────────────────
// Liste satın alma TALEPLERİNİ ve SİPARİŞLERİNİ yedekliyordu ama
// KALEMLERİNİ yedeklemiyordu. Müşterinin yedeğinde kalemsiz siparişler
// vardı. `user_branch_access` de yoktu: geri yüklenince kullanıcılar şube
// yetkilerini kaybederdi. Üçü de bu test sayesinde çıktı.
//
// Ders: "eksiksiz" damgası, damgayı basan listenin kendisini denetlemez.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  kiraciTablolari, rlsAcikTablolar, gocMetni,
} from '../core/test-support/goc-tarama'
import {
  DISA_AKTARILAN_TABLOLAR, YEDEK_DISI_TABLOLAR,
} from './tenant-export'

const sql = gocMetni()
const kiraci = kiraciTablolari(sql)
const yedekte = new Set<string>(DISA_AKTARILAN_TABLOLAR)
const disarida = new Set(Object.keys(YEDEK_DISI_TABLOLAR))

describe('Tarama gerçekten çalışıyor', () => {
  // ⚠️ Bu testin varlık sebebi: aşağıdaki testlerin hepsi "hiç tablo
  // bulamadım" durumunda SESSİZCE GEÇER. Yeşil olup hiçbir şeyi
  // korumayan test, hiç olmayan testten kötüdür.
  it('göç dosyalarından en az 30 kiracı tablosu buluyor', () => {
    expect(kiraci.length).toBeGreaterThanOrEqual(30)
  })

  it('bilinen tabloları görüyor', () => {
    expect(kiraci).toContain('stock_movement')
    expect(kiraci).toContain('shipment_line')
    expect(kiraci).toContain('audit_log')
  })
})

describe('Yedek kapsamı', () => {
  it('her kiracı tablosu ya yedekte ya GEREKÇELİ dışarıda', () => {
    const unutulmus = kiraci.filter(t => !yedekte.has(t) && !disarida.has(t))
    expect(unutulmus).toEqual([])
  })

  it('yedek listesindeki her tablo gerçekten var (yazım hatası koruması)', () => {
    // 'tenant' kiracı tablosu değil — satırın kendisi kiracıdır.
    const govdeler = new Set(
      [...gocMetni().matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/g)]
        .map(m => m[1]),
    )
    const olmayan = [...yedekte].filter(t => !govdeler.has(t))
    expect(olmayan).toEqual([])
  })

  it('gerekçe listesinde artık var olmayan tablo kalmamış', () => {
    // Kapanmış bir borcun listede kalması, listeyi zamanla yalancı yapar.
    const eskimis = [...disarida].filter(t => !kiraci.includes(t))
    expect(eskimis).toEqual([])
  })

  it('aynı tablo hem yedekte hem dışarıda olamaz', () => {
    const cifte = [...disarida].filter(t => yedekte.has(t))
    expect(cifte).toEqual([])
  })

  it('her dışarıda bırakma kararının gerekçesi yazılı', () => {
    for(const [tablo, gerekce] of Object.entries(YEDEK_DISI_TABLOLAR)){
      expect(gerekce.length, `${tablo} için gerekçe çok kısa`).toBeGreaterThan(40)
    }
  })
})

describe('Sıra: ebeveyn önce, kalem sonra', () => {
  // İçeri alma bu sırayla yazacak. Kalem başlıktan önce gelirse yabancı
  // anahtar reddeder ve geri yükleme yarıda kalır.
  const sira = (t: string) => DISA_AKTARILAN_TABLOLAR.indexOf(t as never)

  it('her "_line" tablosu başlığından SONRA geliyor', () => {
    const ters: string[] = []
    for(const tablo of DISA_AKTARILAN_TABLOLAR){
      if(!tablo.endsWith('_line')) continue
      const baslik = tablo.slice(0, -'_line'.length)
      if(!yedekte.has(baslik)) continue
      if(sira(tablo) < sira(baslik)) ters.push(`${tablo} < ${baslik}`)
    }
    expect(ters).toEqual([])
  })

  it('kimlik tabloları stok ve belgelerden önce geliyor', () => {
    expect(sira('tenant')).toBeLessThan(sira('stock_item'))
    expect(sira('app_user')).toBeLessThan(sira('user_branch_access'))
    expect(sira('branch')).toBeLessThan(sira('user_branch_access'))
    expect(sira('stock_item')).toBeLessThan(sira('stock_lot'))
    expect(sira('stock_lot')).toBeLessThan(sira('stock_movement'))
  })
})

describe('Kiracı izolasyonu göç seviyesinde', () => {
  // ADR-004. Bir kiracı tablosunda RLS kapalıysa, o tablo bütün
  // işletmelere açıktır — ve bunu ekranda görmek mümkün değil.
  it('her kiracı tablosunda RLS açık', () => {
    const acik = rlsAcikTablolar(sql)
    const kapali = kiraci.filter(t => !acik.has(t))
    expect(kapali).toEqual([])
  })
})
