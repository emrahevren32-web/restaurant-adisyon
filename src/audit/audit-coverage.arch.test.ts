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
import { DISA_AKTARILAN_TABLOLAR } from '../tenant-export/tenant-export'

const sql = gocMetni()
const izlenen = denetimIzlenenTablolar(sql)

describe('Tarama gerçekten çalışıyor', () => {
  it('0027 içindeki izlenen tablo listesini buluyor', () => {
    expect(izlenen.length).toBeGreaterThanOrEqual(10)
    expect(izlenen).toContain('stock_count')
    expect(izlenen).toContain('haccp_measurement')
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
  it('izlenen her tablo yedeğe de giriyor', () => {
    // Denetim kaydı satırlara ATIFTA bulunur ("SAY-2026-0008 · mercimek").
    // Atıf edilen tablo yedekte yoksa, geri yükleme sonrası denetim kaydı
    // var olmayan satırları anlatır.
    const yedekte = new Set<string>(DISA_AKTARILAN_TABLOLAR)
    const eksik = izlenen.filter(t => !yedekte.has(t))
    expect(eksik).toEqual([])
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
