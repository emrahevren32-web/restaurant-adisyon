// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 — DENETİM KAYDI KAPSAMI (mimari testi)
//
// Yol haritası maddesi: "İşlem geçmişi / denetim kaydı ekranı"
//
// Denetim kaydını VERİTABANI yazıyor (0027), ekran değil. Bu iyi: hiçbir
// kod yolu atlayamaz. Ama bir yan etkisi var — tetikleyicinin izlediği
// tablo listesi göçte, ekranın Türkçe adları ise kodda duruyor. İkisi
// AYRI YERDE.
//
// Göçe yeni bir tablo eklenip koda etiket yazılmazsa ne olur: ekran çökmez,
// hata vermez, sadece "goods_receipt_line" gibi ham bir ad gösterir.
// Müşteri o satırı okuyamaz. Sessiz bir bozulma — tam olarak testin
// yakalaması gereken tür.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { denetimIzlenenTablolar, gocMetni } from '../core/test-support/goc-tarama'
import { TABLO_ETIKETLERI } from './audit.repository'
import {
  DISA_AKTARILAN_TABLOLAR,
  YEDEK_DISI_TABLOLAR,
} from '../tenant-export/tenant-export'

const sql = gocMetni()
const izlenen = denetimIzlenenTablolar(sql)

describe('Tarama gerçekten çalışıyor', () => {
  it('0027 içindeki izlenen tablo listesini buluyor', () => {
    expect(izlenen.length).toBeGreaterThanOrEqual(10)
    expect(izlenen).toContain('stock_count')
    expect(izlenen).toContain('haccp_measurement')
  })

  // ⚠️ 30.10.2026 · ÜÇ SÖZ DİZİMİNİN ÜÇÜ DE GÖRÜLÜYOR.
  // Tarayıcı bir aydır yalnız birinci biçimi okuyordu ve denetim
  // yüzeyinin üçte birini görmüyordu. Bu sınamanın tek işi, aynı körlüğün
  // sessizce geri gelmesini engellemek: her biçimden BİR tanık.
  it('⚠️ üç ayrı kurulum biçimi de görülüyor', () => {
    // (1) `izlenecek text[] := array[...]` döngüsü (0027)
    expect(izlenen, 'birinci biçim görünmüyor').toContain('stock_count')
    // (2) başka adlı dizi değişkeniyle döngü (0091: `v_tablolar`)
    expect(izlenen, 'ikinci biçim görünmüyor — yetki tabloları kör').toContain('user_role')
    expect(izlenen).toContain('app_user')
    // (3) düz `create trigger ... app.denetim_yaz()` (0093, 0103)
    expect(izlenen, 'üçüncü biçim görünmüyor').toContain('witness_sample')
    expect(izlenen).toContain('tenant_settings')
  })

  it('⚠️ kolon adı tablo sayılmıyor', () => {
    // Döngü taraması aynı blokta duran kolon adı dizilerini de getiriyor.
    // Süzgeç `create table` gövdeleri; kalkarsa burası kırmızı verir.
    expect(izlenen, '`tenant_id` bir tablo değil, kolon').not.toContain('tenant_id')
  })
})

describe('Denetim kaydı ekranda okunabilir', () => {
  it('izlenen her tablonun Türkçe etiketi var', () => {
    const etiketsiz = izlenen.filter(t => !TABLO_ETIKETLERI[t])
    expect(etiketsiz).toEqual([])
  })

  it('etiket sözlüğünde artık izlenmeyen tablo kalmamış', () => {
    // Kullanılmayan etiket zararsız görünür ama listeyi yalancı yapar:
    // "bu tablo denetleniyor" izlenimi verir, oysa denetlenmiyor.
    const fazla = Object.keys(TABLO_ETIKETLERI).filter(t => !izlenen.includes(t))
    expect(fazla).toEqual([])
  })
})

describe('Denetim kaydı ile yedek birbirini tutuyor', () => {
  it('izlenen her tablo ya yedekte ya GEREKÇELİ dışarıda', () => {
    // Denetim kaydı satırlara ATIFTA bulunur ("SAY-2026-0008 · mercimek").
    // Atıf edilen tablo yedekte yoksa, geri yükleme sonrası denetim kaydı
    // var olmayan satırları anlatır.
    //
    // ⚠️ 30.10.2026 · "YA GEREKÇELİ DIŞARIDA" EKLENDİ. Tarayıcı düzelince
    // iki lisans tablosu da izlenenler arasına girdi ve ikisi BİLEREK
    // yedeğin dışında: lisans işletmenin verisi değil, MİYOP ile arasındaki
    // ticari ilişkidir — eski bir yedekten geri yüklenmesi süresi dolmuş
    // bir lisansı geri getirirdi (tenant-export.ts → YEDEK_DISI_TABLOLAR).
    //
    // Sınamayı gevşetmek DEĞİL bu: gerekçesi YAZILMAMIŞ bir tablo yine
    // kırmızı veriyor. Değişen tek şey, kararın susturulmak yerine
    // okunabilir olması.
    const yedekte = new Set<string>(DISA_AKTARILAN_TABLOLAR)
    const gerekceli = new Set(Object.keys(YEDEK_DISI_TABLOLAR))
    const eksik = izlenen.filter(t => !yedekte.has(t) && !gerekceli.has(t))
    expect(eksik, 'denetleniyor ama ne yedekte ne gerekçeli dışarıda').toEqual([])
  })

  it('⚠️ yedeğin dışında bırakılan denetimli tablonun gerekçesi BOŞ DEĞİL', () => {
    const yedekte = new Set<string>(DISA_AKTARILAN_TABLOLAR)
    const bos = izlenen
      .filter(t => !yedekte.has(t))
      .filter(t => (YEDEK_DISI_TABLOLAR[t] ?? '').trim().length < 40)
    expect(bos, 'gerekçe yerine tek kelime yazılmış').toEqual([])
  })

  it('denetim kaydının kendisi de yedeğe giriyor', () => {
    expect(DISA_AKTARILAN_TABLOLAR).toContain('audit_log')
  })
})

describe('stock_movement bilerek dışarıda', () => {
  it('denetim tetikleyicisi stok defterine BAĞLANMIYOR', () => {
    // Karar: defter zaten append-only ve kendi denetim kaydı. Kopyalamak
    // yazma hacmini ikiye katlar, yeni bilgi vermez. Bu bir eksiklik değil;
    // biri "tamamlık" adına eklemeye kalkarsa test onu durdurur ve buraya
    // yönlendirir.
    expect(izlenen).not.toContain('stock_movement')
  })

  it('ama defterin kendisi yedeğe giriyor', () => {
    expect(DISA_AKTARILAN_TABLOLAR).toContain('stock_movement')
  })
})
